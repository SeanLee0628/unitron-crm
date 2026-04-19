from fastapi import FastAPI, UploadFile, File, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import or_
import pandas as pd
import io
import os
import math

from database import engine, get_db, Base
import json
import hashlib
import random
import smtplib
from email.mime.text import MIMEText
from models import (Customer, Company, Opportunity, User,
                    Contract, Estimate, Proposal, SalesActivity, Support, Revenue)

def hash_pw(pw):
    return hashlib.sha256(pw.encode()).hexdigest()


def send_verification_email(to_email, code):
    """인증번호 이메일 발송 (SMTP 설정 필요)"""
    smtp_user = os.environ.get("SMTP_USER", "sean94kr@gmail.com")
    smtp_pass = os.environ.get("SMTP_PASS", "pbel bcoo znwu lwgx")
    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))

    if not smtp_user or not smtp_pass:
        print(f"[인증코드] {to_email}: {code} (SMTP 미설정, 콘솔 출력)")
        return False

    msg = MIMEText(f"UNITRONTECH CRM 인증번호: {code}\n\n이 코드를 입력하여 회원가입을 완료하세요.", "plain", "utf-8")
    msg["Subject"] = f"[UNITRONTECH CRM] 인증번호: {code}"
    msg["From"] = smtp_user
    msg["To"] = to_email

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"이메일 발송 실패: {e}")
        return False


GENERIC_MODELS = {
    "contracts":   (Contract, "contract_id", "계약ID"),
    "estimates":   (Estimate, "estimate_id", "견적ID"),
    "proposals":   (Proposal, "proposal_id", "제안ID"),
    "activities":  (SalesActivity, "activity_id", "영업활동ID"),
    "supports":    (Support, "support_id", "고객지원ID"),
    "revenues":    (Revenue, "revenue_id", "매출ID"),
}

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== 인증 ====================

@app.post("/api/auth/signup")
async def signup(data: dict, db: Session = Depends(get_db)):
    email = data.get("email", "").strip().lower()
    name = data.get("name", "").strip()
    password = data.get("password", "")
    department = data.get("department", "").strip()

    if not email or not name or not password or not department:
        return {"error": "모든 항목을 입력하세요"}
    if not email.endswith("@unitrontech.com"):
        return {"error": "유니트론텍 이메일(@unitrontech.com)만 가입 가능합니다"}
    if len(password) < 4:
        return {"error": "비밀번호는 4자리 이상이어야 합니다"}

    existing = db.query(User).filter(User.email == email).first()
    if existing and existing.is_verified == "Y":
        return {"error": "이미 가입된 이메일입니다"}

    code = str(random.randint(100000, 999999))
    if existing:
        existing.name = name
        existing.department = department
        existing.password_hash = hash_pw(password)
        existing.verify_code = code
        existing.is_verified = "N"
    else:
        db.add(User(email=email, name=name, department=department, password_hash=hash_pw(password), verify_code=code, is_verified="N"))
    db.commit()

    sent = send_verification_email(email, code)
    return {
        "success": True,
        "message": f"인증번호가 {email}로 발송되었습니다" if sent else f"인증번호: {code} (SMTP 미설정)",
        "debug_code": code if not sent else None,
    }


@app.post("/api/auth/verify")
async def verify(data: dict, db: Session = Depends(get_db)):
    email = data.get("email", "").strip().lower()
    code = data.get("code", "").strip()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"error": "등록되지 않은 이메일입니다"}
    if user.verify_code != code:
        return {"error": "인증번호가 일치하지 않습니다"}
    user.is_verified = "Y"
    user.verify_code = None
    db.commit()
    return {"success": True, "message": "인증 완료! 로그인하세요"}


@app.post("/api/auth/login")
async def login(data: dict, db: Session = Depends(get_db)):
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"error": "등록되지 않은 이메일입니다"}
    if user.is_verified != "Y":
        return {"error": "이메일 인증이 완료되지 않았습니다"}
    if user.password_hash != hash_pw(password):
        return {"error": "비밀번호가 일치하지 않습니다"}
    return {"success": True, "user": {"email": user.email, "name": user.name, "department": user.department}}


# ==================== AI 보고서 ====================

import anthropic

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "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")


def get_activities_for_report(db, manager_name=None, department=None):
    """영업활동 데이터 조회 (개인 또는 실 단위)"""
    from models import SalesActivity
    query = db.query(SalesActivity)

    all_rows = query.all()
    results = []
    for r in all_rows:
        data = json.loads(r.data) if r.data else {}
        담당자 = data.get("담당자", "")

        if manager_name and manager_name not in str(담당자):
            continue
        if department and not manager_name:
            # 실 단위: 해당 실 소속 사원들 조회
            dept_members = db.query(User).filter(User.department == department, User.is_verified == "Y").all()
            member_names = [m.name for m in dept_members]
            if not any(name in str(담당자) for name in member_names):
                continue

        results.append(data)

    return results


@app.post("/api/ai/report")
async def generate_report(data: dict, db: Session = Depends(get_db)):
    report_type = data.get("type", "personal")  # personal or team
    user_name = data.get("name", "")
    department = data.get("department", "")

    if report_type == "personal":
        activities = get_activities_for_report(db, manager_name=user_name)
        title = f"{user_name} 주간 영업보고서"
    else:
        activities = get_activities_for_report(db, department=department)
        title = f"{department} 주간 영업보고서"

    if not activities:
        return {"error": "영업활동 데이터가 없습니다"}

    # 최근 활동만 (최대 50건)
    activities = activities[:50]

    # 활동 데이터 정리
    activity_text = ""
    for a in activities:
        content = a.get("활동내용", "")
        if content and content != "None" and content != "nan":
            content_str = str(content)[:300]
        else:
            content_str = "내용 없음"
        activity_text += f"""
- 날짜: {a.get('영업활동일', '')}
  고객사: {a.get('고객사', '')} / 고객: {a.get('고객', '')}
  활동분류: {a.get('활동분류', '')} / 목적: {a.get('활동목적', '')}
  담당자: {a.get('담당자', '')}
  내용: {content_str}
"""

    prompt = f"""다음은 {title}에 포함할 영업활동 데이터입니다.
이 데이터를 기반으로 깔끔한 주간 영업보고서를 작성해주세요.

형식:
1. 요약 (2~3줄)
2. 주요 활동 내역 (고객사별로 정리)
3. 진행 중인 안건 및 다음 주 계획
4. 특이사항

영업활동 데이터:
{activity_text}
"""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        report = message.content[0].text
    except Exception as e:
        return {"error": f"AI 생성 실패: {str(e)}"}

    return {"report": report, "title": title, "activity_count": len(activities)}


@app.post("/api/ai/briefing")
async def generate_briefing(data: dict, db: Session = Depends(get_db)):
    company_name = data.get("company_name", "")

    if not company_name:
        return {"error": "고객사명을 입력하세요"}

    # 관련 데이터 수집
    from models import SalesActivity
    activities = db.query(SalesActivity).all()
    related = []
    for r in activities:
        d = json.loads(r.data) if r.data else {}
        if company_name in str(d.get("고객사", "")):
            related.append(d)

    # 영업기회
    opps = db.query(Opportunity).filter(Opportunity.company_name.ilike(f"%{company_name}%")).all()
    opp_text = ""
    for o in opps:
        opp_text += f"- {o.opp_name} | 단계: {o.stage} | 상태: {o.status} | 성공확률: {o.success_pct}%\n"

    # 고객사 정보
    company = db.query(Company).filter(Company.name.ilike(f"%{company_name}%")).first()
    company_info = f"고객사: {company.name}, 등급: {company.grade}, 상태: {company.status}, 담당: {company.manager}" if company else ""

    # 고객 목록
    customers = db.query(Customer).filter(Customer.company_name.ilike(f"%{company_name}%")).all()
    cust_text = "\n".join([f"- {c.name} ({c.department}/{c.position}) {c.mobile}" for c in customers])

    activity_text = ""
    for a in related[:20]:
        content = a.get("활동내용", "")
        if content and content != "None":
            content = str(content)[:300]
        else:
            content = ""
        activity_text += f"- {a.get('영업활동일', '')} | {a.get('활동분류', '')} | {a.get('고객', '')} | {content}\n"

    prompt = f"""영업사원이 '{company_name}' 고객사를 방문하기 전에 볼 브리핑을 작성해주세요.

고객사 정보: {company_info}
담당 고객: {cust_text}
영업기회: {opp_text if opp_text else "없음"}
최근 영업활동: {activity_text if activity_text else "없음"}

형식:
■ 핵심 이슈 (2~3개)
■ 진행 중인 영업기회
■ 최근 활동 요약
■ 담당 고객 정보
■ 추천 액션
"""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        briefing = message.content[0].text
    except Exception as e:
        return {"error": f"AI 생성 실패: {str(e)}"}

    return {"briefing": briefing, "company": company_name}


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return str(v) if v is not None else None


def to_float(v):
    if v is None:
        return None
    try:
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    except (ValueError, TypeError):
        return None


# ==================== 고객사 ====================

@app.post("/api/companies/upload")
async def upload_companies(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), header=0)

    db.query(Company).delete()
    count = 0
    for _, row in df.iterrows():
        cid = clean(row.get("고객사ID"))
        if not cid:
            continue
        db.add(Company(
            company_id=cid,
            name=clean(row.get("고객사명")),
            category=clean(row.get("고객사 구분")),
            grade=clean(row.get("고객사 등급")),
            status=clean(row.get("진행상태")),
            revenue=to_float(row.get("매출금액")),
            employees=to_float(row.get("사원수")),
            biz_number=clean(row.get("사업자번호")),
            phone=clean(row.get("유선번호")),
            fax=clean(row.get("팩스번호")),
            website=clean(row.get("웹사이트")),
            zipcode=clean(row.get("우편번호")),
            address=clean(row.get("주소")),
            manager=clean(row.get("담당자")),
            creator=clean(row.get("등록자")),
            created_at=clean(row.get("등록일")),
            modifier=clean(row.get("변경자")),
            modified_at=clean(row.get("변경일")),
        ))
        count += 1
    db.commit()
    return {"uploaded": count}


@app.get("/api/companies")
async def list_companies(
    q: str = "",
    grade: str = "",
    status: str = "",
    manager: str = "",
    page: int = 1,
    size: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(Company)
    if q:
        query = query.filter(or_(
            Company.name.ilike(f"%{q}%"),
            Company.company_id.ilike(f"%{q}%"),
        ))
    if grade:
        query = query.filter(Company.grade == grade)
    if status:
        query = query.filter(Company.status == status)
    if manager:
        query = query.filter(Company.manager.ilike(f"%{manager}%"))

    total = query.count()
    rows = query.order_by(Company.id).offset((page - 1) * size).limit(size).all()

    data = []
    for r in rows:
        # 해당 고객사의 고객 수
        cust_count = db.query(Customer).filter(Customer.company_id == r.company_id).count()
        data.append({
            "고객사ID": r.company_id,
            "고객사명": r.name,
            "고객사 구분": r.category,
            "고객사 등급": r.grade,
            "진행상태": r.status,
            "매출금액": r.revenue,
            "사원수": r.employees,
            "주소": r.address,
            "담당자": r.manager,
            "등록일": r.created_at,
            "고객수": cust_count,
        })

    return {"data": data, "total": total, "page": page, "size": size}


@app.post("/api/companies/create")
async def create_company(data: dict, db: Session = Depends(get_db)):
    import uuid
    cid = str(uuid.uuid4().int)[:7]
    today_str = __import__("datetime").datetime.now().strftime("%Y.%m.%d")
    db.add(Company(
        company_id=cid,
        name=data.get("name"),
        category=data.get("category", "고객사"),
        grade=data.get("grade", "C등급"),
        status=data.get("status", "진행중"),
        manager=data.get("manager"),
        address=data.get("address"),
        creator=data.get("manager"),
        created_at=today_str,
    ))
    db.commit()
    return {"created": cid}


@app.post("/api/companies/update")
async def update_company(data: dict, db: Session = Depends(get_db)):
    cid = data.get("고객사ID")
    if not cid:
        return {"error": "고객사ID 없음"}
    row = db.query(Company).filter(Company.company_id == cid).first()
    if not row:
        return {"error": "not found"}

    field_map = {
        "고객사명": "name", "고객사 구분": "category", "고객사 등급": "grade",
        "진행상태": "status", "담당자": "manager", "주소": "address",
        "매출금액": "revenue", "사원수": "employees", "사업자번호": "biz_number",
        "유선번호": "phone", "팩스번호": "fax", "웹사이트": "website",
    }
    for k, attr in field_map.items():
        if k in data:
            val = data[k]
            if attr in ("revenue", "employees"):
                val = to_float(val)
            setattr(row, attr, val)
    db.commit()
    return {"updated": cid}


# ==================== 고객 ====================

@app.post("/api/customers/upload")
async def upload_customers(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), header=0)

    db.query(Customer).delete()
    count = 0
    for _, row in df.iterrows():
        cid = clean(row.get("고객ID"))
        if not cid:
            continue
        db.add(Customer(
            customer_id=cid,
            company_id=clean(row.get("고객사ID")),
            company_name=clean(row.get("고객사")),
            name=clean(row.get("고객명")),
            department=clean(row.get("부서")),
            position=clean(row.get("직책")),
            mobile=clean(row.get("휴대번호")),
            phone=clean(row.get("유선번호")),
            email=clean(row.get("메일")),
            grade=clean(row.get("고객등급")),
            keyman=clean(row.get("KeyMan")),
            manager=clean(row.get("담당자")),
            sales_date=clean(row.get("영업활동일")),
            creator=clean(row.get("등록자")),
            created_at=clean(row.get("등록일")),
            modifier=clean(row.get("변경자")),
            modified_at=clean(row.get("변경일")),
        ))
        count += 1
    db.commit()
    return {"uploaded": count}


@app.get("/api/customers")
async def list_customers(
    q: str = "",
    keyman: str = "",
    manager: str = "",
    company: str = "",
    page: int = 1,
    size: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(Customer)
    if q:
        query = query.filter(or_(
            Customer.name.ilike(f"%{q}%"),
            Customer.company_name.ilike(f"%{q}%"),
            Customer.email.ilike(f"%{q}%"),
            Customer.mobile.ilike(f"%{q}%"),
        ))
    if keyman and keyman != "전체":
        query = query.filter(Customer.keyman == keyman)
    if manager:
        query = query.filter(Customer.manager.ilike(f"%{manager}%"))
    if company:
        query = query.filter(Customer.company_name.ilike(f"%{company}%"))

    total = query.count()
    rows = query.order_by(Customer.id).offset((page - 1) * size).limit(size).all()

    data = []
    for r in rows:
        data.append({
            "고객ID": r.customer_id,
            "고객사ID": r.company_id,
            "고객사": r.company_name,
            "고객명": r.name,
            "부서": r.department,
            "직책": r.position,
            "휴대번호": r.mobile,
            "유선번호": r.phone,
            "메일": r.email,
            "고객등급": r.grade,
            "KeyMan": r.keyman,
            "담당자": r.manager,
            "영업활동일": r.sales_date,
            "등록일": r.created_at,
        })

    return {"data": data, "total": total, "page": page, "size": size}


@app.get("/api/customers/{customer_id}")
async def get_customer(customer_id: str, db: Session = Depends(get_db)):
    row = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not row:
        return {"error": "not found"}
    return {
        "고객ID": row.customer_id,
        "고객사ID": row.company_id,
        "고객사": row.company_name,
        "고객명": row.name,
        "부서": row.department,
        "직책": row.position,
        "휴대번호": row.mobile,
        "유선번호": row.phone,
        "메일": row.email,
        "고객등급": row.grade,
        "KeyMan": row.keyman,
        "담당자": row.manager,
        "영업활동일": row.sales_date,
        "등록자": row.creator,
        "등록일": row.created_at,
    }


@app.post("/api/customers/create")
async def create_customer(data: dict, db: Session = Depends(get_db)):
    import uuid
    cid = str(uuid.uuid4().int)[:7]
    today_str = __import__("datetime").datetime.now().strftime("%Y.%m.%d")
    db.add(Customer(
        customer_id=cid,
        company_name=data.get("company"),
        name=data.get("name"),
        department=data.get("dept"),
        position=data.get("position"),
        mobile=data.get("mobile"),
        email=data.get("email"),
        keyman=data.get("keyman", "N"),
        manager=data.get("manager"),
        creator=data.get("manager"),
        created_at=today_str,
    ))
    db.commit()
    return {"created": cid}


@app.post("/api/customers/update")
async def update_customer(data: dict, db: Session = Depends(get_db)):
    cid = data.get("고객ID")
    if not cid:
        return {"error": "고객ID 없음"}
    row = db.query(Customer).filter(Customer.customer_id == cid).first()
    if not row:
        return {"error": "not found"}

    field_map = {
        "고객명": "name", "고객사": "company_name", "부서": "department",
        "직책": "position", "휴대번호": "mobile", "유선번호": "phone",
        "메일": "email", "고객등급": "grade", "KeyMan": "keyman", "담당자": "manager",
    }
    for k, attr in field_map.items():
        if k in data:
            setattr(row, attr, data[k])
    db.commit()
    return {"updated": cid}


# ==================== 영업기회 생성 ====================

@app.post("/api/opportunities/create")
async def create_opportunity(data: dict, db: Session = Depends(get_db)):
    import uuid
    opp_id = str(uuid.uuid4().int)[:6]
    db.add(Opportunity(
        opp_id=opp_id,
        opp_name=data.get("opp_name"),
        company_name=data.get("company_name"),
        customer_name=data.get("customer_name"),
        manager=data.get("manager"),
        status=data.get("status", "진행중"),
        expected_revenue=to_float(data.get("expected_revenue")),
        expected_margin_pct=to_float(data.get("expected_margin_pct")),
        expected_margin_amt=to_float(data.get("expected_margin_amt")),
        start_date=data.get("start_date"),
        end_date=data.get("end_date"),
        revenue_type=data.get("revenue_type"),
        biz_type=data.get("biz_type"),
        detail=data.get("detail"),
        process=data.get("process"),
        stage=data.get("stage"),
        category=data.get("category"),
        success_pct=to_float(data.get("success_pct")),
        source=data.get("source"),
        note=data.get("note"),
        address=data.get("address"),
        creator=data.get("manager"),
        created_at=data.get("start_date"),
    ))
    db.commit()
    return {"created": opp_id}


@app.post("/api/opportunities/update")
async def update_opportunity(data: dict, db: Session = Depends(get_db)):
    opp_id = data.get("영업기회ID")
    if not opp_id:
        return {"error": "영업기회ID 없음"}
    row = db.query(Opportunity).filter(Opportunity.opp_id == opp_id).first()
    if not row:
        return {"error": "not found"}

    field_map = {
        "영업기회": "opp_name", "고객사": "company_name", "고객명": "customer_name",
        "담당자": "manager", "진행상태": "status", "단계": "stage",
        "성공확률(%)": "success_pct", "예상매출": "expected_revenue",
        "시작일": "start_date", "종료일": "end_date", "비고": "note",
    }
    for k, attr in field_map.items():
        if k in data:
            val = data[k]
            if attr in ("success_pct", "expected_revenue"):
                val = to_float(val)
            setattr(row, attr, val)

    if "단계" in data:
        cat_map = {"기회인지": "인지", "제안": "제안", "협상": "협상", "계약": "계약"}
        row.category = cat_map.get(data["단계"], data["단계"])

    db.commit()
    return {"updated": opp_id}


@app.delete("/api/opportunities/{opp_id}")
async def delete_opportunity(opp_id: str, db: Session = Depends(get_db)):
    db.query(Opportunity).filter(Opportunity.opp_id == opp_id).delete()
    db.commit()
    return {"deleted": opp_id}


@app.delete("/api/companies/{company_id}")
async def delete_company_item(company_id: str, db: Session = Depends(get_db)):
    db.query(Company).filter(Company.company_id == company_id).delete()
    db.commit()
    return {"deleted": company_id}


@app.delete("/api/customers/{customer_id}")
async def delete_customer_item(customer_id: str, db: Session = Depends(get_db)):
    db.query(Customer).filter(Customer.customer_id == customer_id).delete()
    db.commit()
    return {"deleted": customer_id}


# ==================== 범용 업로드/조회 ====================

@app.post("/api/generic/{table_name}/upload")
async def upload_generic(table_name: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if table_name not in GENERIC_MODELS:
        return {"error": f"Unknown table: {table_name}"}

    Model, id_field, id_col = GENERIC_MODELS[table_name]
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), header=0)

    db.query(Model).delete()
    count = 0
    for _, row in df.iterrows():
        rid = clean(row.get(id_col))
        if not rid:
            continue
        record = {}
        for col in df.columns:
            v = row[col]
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                record[col] = None
            elif hasattr(v, 'strftime'):
                record[col] = v.strftime("%Y-%m-%d %H:%M") if hasattr(v, 'hour') else str(v)
            else:
                record[col] = str(v) if v is not None else None
        obj = Model()
        setattr(obj, id_field, rid)
        obj.data = json.dumps(record, ensure_ascii=False)
        db.add(obj)
        count += 1
    db.commit()
    return {"uploaded": count, "columns": list(df.columns)}


@app.get("/api/generic/{table_name}")
async def list_generic(
    table_name: str,
    q: str = "",
    page: int = 1,
    size: int = 50,
    db: Session = Depends(get_db),
):
    if table_name not in GENERIC_MODELS:
        return {"error": f"Unknown table: {table_name}"}

    Model, id_field, id_col = GENERIC_MODELS[table_name]
    query = db.query(Model)

    if q:
        query = query.filter(Model.data.ilike(f"%{q}%"))

    total = query.count()
    rows = query.order_by(Model.id.desc()).offset((page - 1) * size).limit(size).all()

    data = []
    columns = []
    for r in rows:
        record = json.loads(r.data) if r.data else {}
        data.append(record)
        if not columns and record:
            columns = list(record.keys())

    return {"data": data, "columns": columns, "total": total, "page": page, "size": size}


@app.post("/api/generic/{table_name}/create")
async def create_generic(table_name: str, record: dict, db: Session = Depends(get_db)):
    if table_name not in GENERIC_MODELS:
        return {"error": f"Unknown table: {table_name}"}
    Model, id_field, id_col = GENERIC_MODELS[table_name]
    rid = record.get(id_col) or str(__import__("uuid").uuid4().int)[:7]
    obj = Model()
    setattr(obj, id_field, rid)
    obj.data = json.dumps(record, ensure_ascii=False)
    db.add(obj)
    db.commit()
    return {"created": rid}


@app.post("/api/generic/{table_name}/update")
async def update_generic(table_name: str, record: dict, db: Session = Depends(get_db)):
    if table_name not in GENERIC_MODELS:
        return {"error": f"Unknown table: {table_name}"}
    Model, id_field, id_col = GENERIC_MODELS[table_name]
    rid = record.get(id_col)
    if not rid:
        return {"error": "ID 없음"}
    row = db.query(Model).filter(getattr(Model, id_field) == rid).first()
    if not row:
        return {"error": "not found"}
    row.data = json.dumps(record, ensure_ascii=False)
    db.commit()
    return {"updated": rid}


@app.get("/api/managers")
async def list_managers(db: Session = Depends(get_db)):
    """담당자 목록 (쉼표/공백으로 구분된 복수 담당자를 개별 이름으로 분리)"""
    rows = db.query(Customer.manager).distinct().filter(Customer.manager.isnot(None)).all()
    names = set()
    for r in rows:
        if not r[0]:
            continue
        for name in r[0].replace(",", " ").replace("/", " ").split():
            name = name.strip()
            if name:
                names.add(name)
    return {"managers": sorted(names)}


# ==================== 영업기회 ====================

@app.post("/api/opportunities/upload")
async def upload_opportunities(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), header=0)

    db.query(Opportunity).delete()
    count = 0
    for _, row in df.iterrows():
        oid = clean(row.get("영업기회ID"))
        if not oid:
            continue
        db.add(Opportunity(
            opp_id=oid,
            opp_name=clean(row.get("영업기회")),
            company_id=clean(row.get("고객사ID")),
            company_name=clean(row.get("고객사")),
            customer_id=clean(row.get("고객ID")),
            customer_name=clean(row.get("고객명")),
            manager=clean(row.get("담당자")),
            status=clean(row.get("진행상태")),
            fail_reason=clean(row.get("실패구분")),
            competitor=clean(row.get("경쟁사(제품)")),
            product=clean(row.get("제품")),
            expected_revenue=to_float(row.get("예상매출")),
            expected_margin_pct=to_float(row.get("예상이익률(%)")),
            expected_margin_amt=to_float(row.get("예상이익금액")),
            start_date=clean(row.get("시작일")),
            end_date=clean(row.get("종료일")),
            revenue_type=clean(row.get("매출구분")),
            biz_type=clean(row.get("사업유형")),
            detail=clean(row.get("상세")),
            process=clean(row.get("프로세스")),
            stage=clean(row.get("단계")),
            category=clean(row.get("카테고리")),
            success_pct=to_float(row.get("성공확률(%)")),
            source=clean(row.get("인지경로")),
            note=clean(row.get("비고")),
            address=clean(row.get("주소")),
            creator=clean(row.get("등록자")),
            created_at=clean(row.get("등록일")),
            modifier=clean(row.get("변경자")),
            modified_at=clean(row.get("변경일")),
        ))
        count += 1
    db.commit()
    return {"uploaded": count}


@app.get("/api/opportunities")
async def list_opportunities(
    q: str = "",
    status: str = "",
    stage: str = "",
    manager: str = "",
    date_from: str = "",
    date_to: str = "",
    page: int = 1,
    size: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(Opportunity)
    if q:
        query = query.filter(or_(
            Opportunity.opp_name.ilike(f"%{q}%"),
            Opportunity.company_name.ilike(f"%{q}%"),
            Opportunity.customer_name.ilike(f"%{q}%"),
        ))
    if status:
        query = query.filter(Opportunity.status == status)
    if date_from:
        df = date_from.replace("-", ".")
        query = query.filter(Opportunity.start_date >= df)
    if date_to:
        dt = date_to.replace("-", ".")
        query = query.filter(Opportunity.start_date <= dt)
    if stage:
        query = query.filter(Opportunity.stage == stage)
    if manager:
        query = query.filter(Opportunity.manager.ilike(f"%{manager}%"))

    total = query.count()
    rows = query.order_by(Opportunity.id.desc()).offset((page - 1) * size).limit(size).all()

    data = []
    for r in rows:
        data.append({
            "영업기회ID": r.opp_id,
            "영업기회": r.opp_name,
            "고객사": r.company_name,
            "고객명": r.customer_name,
            "담당자": r.manager,
            "진행상태": r.status,
            "단계": r.stage,
            "성공확률(%)": r.success_pct,
            "예상매출": r.expected_revenue,
            "시작일": r.start_date,
            "종료일": r.end_date,
            "비고": r.note,
        })

    return {"data": data, "total": total, "page": page, "size": size}


# 프론트엔드 정적 파일 서빙
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(STATIC_DIR, "static")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
