from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import pandas as pd
import io
import os
import math
import json
import hashlib
import random
import smtplib
import uuid
from email.mime.text import MIMEText
from dynamo import DynamoTable, create_tables

# 테이블 생성
try:
    create_tables()
except Exception as e:
    print(f"Table creation skipped: {e}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DynamoDB 테이블
users_tb = DynamoTable("users")
customers_tb = DynamoTable("customers")
companies_tb = DynamoTable("companies")
opportunities_tb = DynamoTable("opportunities")
generic_tb = DynamoTable("generic")


def hash_pw(pw):
    return hashlib.sha256(pw.encode()).hexdigest()


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


def send_verification_email(to_email, code):
    smtp_user = os.environ.get("SMTP_USER", "sean94kr@gmail.com")
    smtp_pass = os.environ.get("SMTP_PASS", "pbel bcoo znwu lwgx")
    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    if not smtp_user or not smtp_pass:
        print(f"[인증코드] {to_email}: {code}")
        return False
    msg = MIMEText(f"UNITRONTECH CRM 인증번호: {code}", "plain", "utf-8")
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


# ==================== 인증 ====================

@app.post("/api/auth/signup")
async def signup(request: Request):
    data = await request.json()
    email = data.get("email", "").strip().lower()
    name = data.get("name", "").strip()
    password = data.get("password", "")
    department = data.get("department", "").strip()

    if not email or not name or not password or not department:
        return {"error": "모든 항목을 입력하세요"}
    if not email.endswith("@unitrontech.com"):
        return {"error": "유니트론텍 이메일(@unitrontech.com)만 가입 가능합니다"}

    existing = users_tb.get(email)
    if existing and existing.get("is_verified") == "Y":
        return {"error": "이미 가입된 이메일입니다"}

    code = str(random.randint(100000, 999999))
    users_tb.put({
        "email": email, "name": name, "department": department,
        "password_hash": hash_pw(password), "verify_code": code, "is_verified": "N",
    })
    sent = send_verification_email(email, code)
    return {
        "success": True,
        "message": f"인증번호가 {email}로 발송되었습니다" if sent else f"인증번호: {code}",
        "debug_code": code if not sent else None,
    }


@app.post("/api/auth/verify")
async def verify(request: Request):
    data = await request.json()
    email = data.get("email", "").strip().lower()
    code = data.get("code", "").strip()
    user = users_tb.get(email)
    if not user:
        return {"error": "등록되지 않은 이메일입니다"}
    if user.get("verify_code") != code:
        return {"error": "인증번호가 일치하지 않습니다"}
    user["is_verified"] = "Y"
    user["verify_code"] = ""
    users_tb.put(user)
    return {"success": True, "message": "인증 완료! 로그인하세요"}


@app.post("/api/auth/login")
async def login(request: Request):
    data = await request.json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    user = users_tb.get(email)
    if not user:
        return {"error": "등록되지 않은 이메일입니다"}
    if user.get("is_verified") != "Y":
        return {"error": "이메일 인증이 완료되지 않았습니다"}
    if user.get("password_hash") != hash_pw(password):
        return {"error": "비밀번호가 일치하지 않습니다"}
    return {"success": True, "user": {"email": user["email"], "name": user["name"], "department": user.get("department", "")}}


# ==================== 고객사 ====================

@app.post("/api/companies/upload")
async def upload_companies(file: UploadFile = File(...)):
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), header=0)
    companies_tb.delete_all()
    count = 0
    for _, row in df.iterrows():
        cid = clean(row.get("고객사ID"))
        if not cid:
            continue
        companies_tb.put({
            "company_id": cid, "name": clean(row.get("고객사명")),
            "category": clean(row.get("고객사 구분")), "grade": clean(row.get("고객사 등급")),
            "status": clean(row.get("진행상태")), "manager": clean(row.get("담당자")),
            "address": clean(row.get("주소")), "created_at": clean(row.get("등록일")),
            "phone": clean(row.get("유선번호")), "fax": clean(row.get("팩스번호")),
            "website": clean(row.get("웹사이트")), "zipcode": clean(row.get("우편번호")),
            "biz_number": clean(row.get("사업자번호")),
            "employees": str(to_float(row.get("사원수")) or 0),
        })
        count += 1
    return {"uploaded": count}


@app.get("/api/companies")
async def list_companies(q: str = "", grade: str = "", status: str = "", manager: str = "", page: int = 1, size: int = 50):
    items = companies_tb.scan_all()
    if q:
        q_lower = q.lower()
        items = [i for i in items if q_lower in str(i.get("name", "")).lower() or q_lower in str(i.get("company_id", "")).lower()]
    if grade:
        items = [i for i in items if i.get("grade") == grade]
    if status:
        items = [i for i in items if i.get("status") == status]
    if manager:
        items = [i for i in items if manager in str(i.get("manager", ""))]

    total = len(items)
    paged = items[(page-1)*size : page*size]

    data = []
    for r in paged:
        cust_count = len([c for c in customers_tb.scan_all() if c.get("company_id") == r.get("company_id")]) if total < 200 else 0
        data.append({
            "고객사ID": r.get("company_id"), "고객사명": r.get("name"),
            "고객사 구분": r.get("category"), "고객사 등급": r.get("grade"),
            "진행상태": r.get("status"), "주소": r.get("address"),
            "담당자": r.get("manager"), "등록일": r.get("created_at"), "고객수": cust_count,
        })
    return {"data": data, "total": total, "page": page, "size": size}


@app.post("/api/companies/create")
async def create_company(request: Request):
    data = await request.json()
    cid = str(uuid.uuid4().int)[:7]
    from datetime import datetime
    companies_tb.put({
        "company_id": cid, "name": data.get("name"), "category": data.get("category", "고객사"),
        "grade": data.get("grade", "C등급"), "status": data.get("status", "진행중"),
        "manager": data.get("manager"), "address": data.get("address"),
        "created_at": datetime.now().strftime("%Y.%m.%d"),
    })
    return {"created": cid}


@app.post("/api/companies/update")
async def update_company(request: Request):
    data = await request.json()
    cid = data.get("고객사ID")
    if not cid:
        return {"error": "ID 없음"}
    existing = companies_tb.get(cid)
    if not existing:
        return {"error": "not found"}
    field_map = {"고객사명": "name", "고객사 구분": "category", "고객사 등급": "grade",
                 "진행상태": "status", "담당자": "manager", "주소": "address"}
    for k, attr in field_map.items():
        if k in data:
            existing[attr] = data[k]
    companies_tb.put(existing)
    return {"updated": cid}


# ==================== 고객 ====================

@app.post("/api/customers/upload")
async def upload_customers(file: UploadFile = File(...)):
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), header=0)
    customers_tb.delete_all()
    count = 0
    for _, row in df.iterrows():
        cid = clean(row.get("고객ID"))
        if not cid:
            continue
        customers_tb.put({
            "customer_id": cid, "company_id": clean(row.get("고객사ID")),
            "company_name": clean(row.get("고객사")), "name": clean(row.get("고객명")),
            "department": clean(row.get("부서")), "position": clean(row.get("직책")),
            "mobile": clean(row.get("휴대번호")), "phone": clean(row.get("유선번호")),
            "email": clean(row.get("메일")), "grade": clean(row.get("고객등급")),
            "keyman": clean(row.get("KeyMan")), "manager": clean(row.get("담당자")),
            "sales_date": clean(row.get("영업활동일")), "created_at": clean(row.get("등록일")),
        })
        count += 1
    return {"uploaded": count}


@app.get("/api/customers")
async def list_customers(q: str = "", keyman: str = "", manager: str = "", company: str = "", page: int = 1, size: int = 50):
    items = customers_tb.scan_all()
    if q:
        q_lower = q.lower()
        items = [i for i in items if q_lower in str(i.get("name", "")).lower() or q_lower in str(i.get("company_name", "")).lower() or q_lower in str(i.get("email", "")).lower()]
    if keyman and keyman != "전체":
        items = [i for i in items if i.get("keyman") == keyman]
    if manager:
        items = [i for i in items if manager in str(i.get("manager", ""))]
    if company:
        items = [i for i in items if company.lower() in str(i.get("company_name", "")).lower()]

    total = len(items)
    paged = items[(page-1)*size : page*size]
    data = [{
        "고객ID": r.get("customer_id"), "고객사ID": r.get("company_id"),
        "고객사": r.get("company_name"), "고객명": r.get("name"),
        "부서": r.get("department"), "직책": r.get("position"),
        "휴대번호": r.get("mobile"), "유선번호": r.get("phone"),
        "메일": r.get("email"), "고객등급": r.get("grade"),
        "KeyMan": r.get("keyman"), "담당자": r.get("manager"),
        "영업활동일": r.get("sales_date"), "등록일": r.get("created_at"),
    } for r in paged]
    return {"data": data, "total": total, "page": page, "size": size}


@app.post("/api/customers/create")
async def create_customer(request: Request):
    data = await request.json()
    cid = str(uuid.uuid4().int)[:7]
    from datetime import datetime
    customers_tb.put({
        "customer_id": cid, "company_name": data.get("company"),
        "name": data.get("name"), "department": data.get("dept"),
        "position": data.get("position"), "mobile": data.get("mobile"),
        "email": data.get("email"), "keyman": data.get("keyman", "N"),
        "manager": data.get("manager"), "created_at": datetime.now().strftime("%Y.%m.%d"),
    })
    return {"created": cid}


@app.post("/api/customers/update")
async def update_customer(request: Request):
    data = await request.json()
    cid = data.get("고객ID")
    if not cid:
        return {"error": "ID 없음"}
    existing = customers_tb.get(cid)
    if not existing:
        return {"error": "not found"}
    field_map = {"고객명": "name", "고객사": "company_name", "부서": "department",
                 "직책": "position", "휴대번호": "mobile", "메일": "email",
                 "고객등급": "grade", "KeyMan": "keyman", "담당자": "manager"}
    for k, attr in field_map.items():
        if k in data:
            existing[attr] = data[k]
    customers_tb.put(existing)
    return {"updated": cid}


@app.get("/api/managers")
async def list_managers():
    items = customers_tb.scan_all()
    names = set()
    for r in items:
        m = r.get("manager", "")
        if not m:
            continue
        for name in m.replace(",", " ").replace("/", " ").split():
            name = name.strip()
            if name:
                names.add(name)
    return {"managers": sorted(names)}


# ==================== 영업기회 ====================

@app.post("/api/opportunities/upload")
async def upload_opportunities(file: UploadFile = File(...)):
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), header=0)
    opportunities_tb.delete_all()
    count = 0
    for _, row in df.iterrows():
        oid = clean(row.get("영업기회ID"))
        if not oid:
            continue
        opportunities_tb.put({
            "opp_id": oid, "opp_name": clean(row.get("영업기회")),
            "company_name": clean(row.get("고객사")), "customer_name": clean(row.get("고객명")),
            "manager": clean(row.get("담당자")), "status": clean(row.get("진행상태")),
            "stage": clean(row.get("단계")), "category": clean(row.get("카테고리")),
            "success_pct": str(to_float(row.get("성공확률(%)")) or 0),
            "expected_revenue": str(to_float(row.get("예상매출")) or 0),
            "start_date": clean(row.get("시작일")), "end_date": clean(row.get("종료일")),
            "note": clean(row.get("비고")), "created_at": clean(row.get("등록일")),
        })
        count += 1
    return {"uploaded": count}


@app.get("/api/opportunities")
async def list_opportunities(q: str = "", status: str = "", stage: str = "", manager: str = "", date_from: str = "", date_to: str = "", page: int = 1, size: int = 50):
    items = opportunities_tb.scan_all()
    if q:
        q_lower = q.lower()
        items = [i for i in items if q_lower in str(i.get("opp_name", "")).lower() or q_lower in str(i.get("company_name", "")).lower()]
    if status:
        items = [i for i in items if i.get("status") == status]
    if stage:
        items = [i for i in items if i.get("stage") == stage]
    if manager:
        items = [i for i in items if manager in str(i.get("manager", ""))]
    if date_from:
        df = date_from.replace("-", ".")
        items = [i for i in items if str(i.get("start_date", "")) >= df]
    if date_to:
        dt = date_to.replace("-", ".")
        items = [i for i in items if str(i.get("start_date", "")) <= dt]

    total = len(items)
    paged = items[(page-1)*size : page*size]
    data = [{
        "영업기회ID": r.get("opp_id"), "영업기회": r.get("opp_name"),
        "고객사": r.get("company_name"), "고객명": r.get("customer_name"),
        "담당자": r.get("manager"), "진행상태": r.get("status"),
        "단계": r.get("stage"), "성공확률(%)": float(r.get("success_pct", 0)),
        "예상매출": float(r.get("expected_revenue", 0)),
        "시작일": r.get("start_date"), "종료일": r.get("end_date"),
        "비고": r.get("note"),
    } for r in paged]
    return {"data": data, "total": total, "page": page, "size": size}


@app.post("/api/opportunities/create")
async def create_opportunity(request: Request):
    data = await request.json()
    oid = str(uuid.uuid4().int)[:6]
    opportunities_tb.put({
        "opp_id": oid, "opp_name": data.get("opp_name"),
        "company_name": data.get("company_name"), "customer_name": data.get("customer_name"),
        "manager": data.get("manager"), "status": data.get("status", "진행중"),
        "stage": data.get("stage", "기회인지"), "success_pct": str(data.get("success_pct", 0)),
        "expected_revenue": str(data.get("expected_revenue", 0)),
        "start_date": data.get("start_date"), "end_date": data.get("end_date"),
        "note": data.get("note"),
    })
    return {"created": oid}


@app.post("/api/opportunities/update")
async def update_opportunity(request: Request):
    data = await request.json()
    oid = data.get("영업기회ID")
    if not oid:
        return {"error": "ID 없음"}
    existing = opportunities_tb.get(oid)
    if not existing:
        return {"error": "not found"}
    field_map = {"영업기회": "opp_name", "고객사": "company_name", "고객명": "customer_name",
                 "담당자": "manager", "진행상태": "status", "단계": "stage",
                 "성공확률(%)": "success_pct", "예상매출": "expected_revenue",
                 "시작일": "start_date", "종료일": "end_date", "비고": "note"}
    for k, attr in field_map.items():
        if k in data:
            existing[attr] = str(data[k])
    opportunities_tb.put(existing)
    return {"updated": oid}


@app.delete("/api/opportunities/{opp_id}")
async def delete_opportunity(opp_id: str):
    opportunities_tb.delete(opp_id)
    return {"deleted": opp_id}


@app.delete("/api/companies/{company_id}")
async def delete_company(company_id: str):
    companies_tb.delete(company_id)
    return {"deleted": company_id}


@app.delete("/api/customers/{customer_id}")
async def delete_customer(customer_id: str):
    customers_tb.delete(customer_id)
    return {"deleted": customer_id}


# ==================== 범용 (계약/견적/제안/영업활동/고객지원/매출) ====================

GENERIC_TABLES = {
    "contracts": "계약ID", "estimates": "견적ID", "proposals": "제안ID",
    "activities": "영업활동ID", "supports": "고객지원ID", "revenues": "매출ID",
}


@app.post("/api/generic/{table_name}/upload")
async def upload_generic(table_name: str, file: UploadFile = File(...)):
    if table_name not in GENERIC_TABLES:
        return {"error": f"Unknown: {table_name}"}
    id_col = GENERIC_TABLES[table_name]
    contents = await file.read()
    df = pd.read_excel(io.BytesIO(contents), header=0)

    # 기존 삭제
    existing = generic_tb.query_by_pk(table_name)
    for item in existing:
        generic_tb.delete(table_name, item["item_id"])

    count = 0
    for _, row in df.iterrows():
        rid = clean(row.get(id_col))
        if not rid:
            continue
        record = {}
        for col in df.columns:
            v = row[col]
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                continue
            elif hasattr(v, 'strftime'):
                record[col] = str(v)
            elif v is not None:
                record[col] = str(v)
        generic_tb.put({"table_name": table_name, "item_id": rid, "data": json.dumps(record, ensure_ascii=False)})
        count += 1
    return {"uploaded": count, "columns": list(df.columns)}


@app.get("/api/generic/{table_name}")
async def list_generic(table_name: str, q: str = "", page: int = 1, size: int = 50):
    if table_name not in GENERIC_TABLES:
        return {"error": f"Unknown: {table_name}"}
    items = generic_tb.query_by_pk(table_name)

    data = []
    columns = []
    for item in items:
        record = json.loads(item.get("data", "{}"))
        if q and q.lower() not in json.dumps(record, ensure_ascii=False).lower():
            continue
        data.append(record)
        if not columns and record:
            columns = list(record.keys())

    total = len(data)
    paged = data[(page-1)*size : page*size]
    return {"data": paged, "columns": columns, "total": total, "page": page, "size": size}


@app.post("/api/generic/{table_name}/create")
async def create_generic(table_name: str, request: Request):
    record = await request.json()
    if table_name not in GENERIC_TABLES:
        return {"error": f"Unknown: {table_name}"}
    id_col = GENERIC_TABLES[table_name]
    rid = record.get(id_col) or str(uuid.uuid4().int)[:7]
    generic_tb.put({"table_name": table_name, "item_id": rid, "data": json.dumps(record, ensure_ascii=False)})
    return {"created": rid}


@app.post("/api/generic/{table_name}/update")
async def update_generic(table_name: str, request: Request):
    record = await request.json()
    if table_name not in GENERIC_TABLES:
        return {"error": f"Unknown: {table_name}"}
    id_col = GENERIC_TABLES[table_name]
    rid = record.get(id_col)
    if not rid:
        return {"error": "ID 없음"}
    generic_tb.put({"table_name": table_name, "item_id": rid, "data": json.dumps(record, ensure_ascii=False)})
    return {"updated": rid}


# ==================== AI 보고서 ====================

import anthropic

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "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")


@app.post("/api/ai/report")
async def generate_report(request: Request):
    data = await request.json()
    report_type = data.get("type", "personal")
    user_name = data.get("name", "")
    department = data.get("department", "")

    all_activities = generic_tb.query_by_pk("activities")
    activities = []
    for item in all_activities:
        record = json.loads(item.get("data", "{}"))
        담당자 = record.get("담당자", "")

        if report_type == "personal":
            if user_name not in str(담당자):
                continue
        else:
            dept_members = [u["name"] for u in users_tb.scan_all() if u.get("department") == department and u.get("is_verified") == "Y"]
            if not any(name in str(담당자) for name in dept_members):
                continue
        activities.append(record)

    if not activities:
        return {"error": "영업활동 데이터가 없습니다"}

    title = f"{user_name} 주간 영업보고서" if report_type == "personal" else f"{department} 주간 영업보고서"
    activities = activities[:50]

    activity_text = ""
    for a in activities:
        content = a.get("활동내용", "")
        if content and content != "None":
            content = str(content)[:300]
        else:
            content = "내용 없음"
        activity_text += f"- 날짜: {a.get('영업활동일', '')} | 고객사: {a.get('고객사', '')} | 고객: {a.get('고객', '')} | {a.get('활동분류', '')} | {content}\n"

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-20250514", max_tokens=2000,
            messages=[{"role": "user", "content": f"""다음 영업활동 데이터로 {title}을 작성해주세요.
형식: 1.요약 2.주요활동(고객사별) 3.다음주계획 4.특이사항
데이터:\n{activity_text}"""}],
        )
        return {"report": message.content[0].text, "title": title, "activity_count": len(activities)}
    except Exception as e:
        return {"error": f"AI 생성 실패: {str(e)}"}


@app.post("/api/ai/briefing")
async def generate_briefing(request: Request):
    data = await request.json()
    company_name = data.get("company_name", "")
    if not company_name:
        return {"error": "고객사명을 입력하세요"}

    # 관련 데이터 수집
    activities = []
    for item in generic_tb.query_by_pk("activities"):
        record = json.loads(item.get("data", "{}"))
        if company_name in str(record.get("고객사", "")):
            activities.append(record)

    opps = [o for o in opportunities_tb.scan_all() if company_name in str(o.get("company_name", ""))]
    company = next((c for c in companies_tb.scan_all() if company_name in str(c.get("name", ""))), None)
    custs = [c for c in customers_tb.scan_all() if company_name in str(c.get("company_name", ""))]

    company_info = f"{company.get('name')}, 등급: {company.get('grade')}, 담당: {company.get('manager')}" if company else ""
    cust_text = "\n".join([f"- {c.get('name')} ({c.get('department')}/{c.get('position')}) {c.get('mobile')}" for c in custs])
    opp_text = "\n".join([f"- {o.get('opp_name')} | {o.get('stage')} | {o.get('status')}" for o in opps])
    act_text = "\n".join([f"- {a.get('영업활동일', '')} | {a.get('활동분류', '')} | {str(a.get('활동내용', ''))[:200]}" for a in activities[:20]])

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-20250514", max_tokens=1500,
            messages=[{"role": "user", "content": f"""'{company_name}' 방문 전 브리핑을 작성해주세요.
고객사: {company_info}
고객: {cust_text}
영업기회: {opp_text or "없음"}
활동이력: {act_text or "없음"}
형식: ■핵심이슈 ■영업기회 ■최근활동 ■고객정보 ■추천액션"""}],
        )
        return {"briefing": message.content[0].text, "company": company_name}
    except Exception as e:
        return {"error": f"AI 생성 실패: {str(e)}"}


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
