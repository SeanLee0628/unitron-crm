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
            "process": clean(row.get("프로세스")),
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
        "프로세스": r.get("process", "기본영업프로세스"),
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


@app.delete("/api/generic/{table_name}/{item_id}")
async def delete_generic(table_name: str, item_id: str):
    if table_name not in GENERIC_TABLES:
        return {"error": f"Unknown: {table_name}"}
    generic_tb.delete(table_name, item_id)
    return {"deleted": item_id}


# ==================== 아침 알림 메일 ====================

from datetime import datetime, timedelta


def build_morning_briefing(user_name):
    """해당 사원의 아침 브리핑 데이터 생성"""
    today = datetime.now().strftime("%Y.%m.%d")
    week_later = (datetime.now() + timedelta(days=7)).strftime("%Y.%m.%d")
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y.%m.%d")

    # 1. 진행 중인 영업기회 (이번 주 종료 예정)
    all_opps = opportunities_tb.scan_all()
    expiring = []
    my_opps = []
    for o in all_opps:
        if user_name not in str(o.get("manager", "")):
            continue
        if o.get("status") != "진행중":
            continue
        my_opps.append(o)
        end = o.get("end_date", "")
        if end and end <= week_later:
            expiring.append(o)

    # 2. 7일 이상 연락 안 한 고객
    all_customers = customers_tb.scan_all()
    inactive = []
    for c in all_customers:
        if user_name not in str(c.get("manager", "")):
            continue
        last = c.get("sales_date", "")
        if not last or last == "None":
            inactive.append(c)
        elif last < week_ago:
            inactive.append(c)

    # 3. 최근 영업활동
    all_activities = generic_tb.query_by_pk("activities")
    recent = []
    for item in all_activities:
        data = json.loads(item.get("data", "{}"))
        if user_name not in str(data.get("담당자", "")):
            continue
        act_date = data.get("영업활동일", "")
        if act_date and act_date >= week_ago:
            recent.append(data)

    return {
        "today": today,
        "my_opps_count": len(my_opps),
        "expiring_opps": expiring[:10],
        "inactive_customers": inactive[:10],
        "recent_activities": recent[:10],
    }


def format_briefing_email(user_name, briefing):
    """HTML 이메일 생성"""
    lines = []
    lines.append(f"<h2>안녕하세요 {user_name}님, 오늘의 영업 브리핑입니다.</h2>")
    lines.append(f"<p style='color:#888'>{briefing['today']}</p>")

    # 이번 주 종료 예정
    lines.append(f"<h3 style='color:#e74c3c'>이번 주 종료 예정 영업기회 ({len(briefing['expiring_opps'])}건)</h3>")
    if briefing["expiring_opps"]:
        for o in briefing["expiring_opps"]:
            lines.append(f"<p>- <b>{o.get('opp_name','')}</b> | {o.get('company_name','')} | 종료: {o.get('end_date','')} | 성공확률: {o.get('success_pct',0)}%</p>")
    else:
        lines.append("<p style='color:#999'>없음</p>")

    # 연락 안 한 고객
    lines.append(f"<h3 style='color:#e67e22'>7일 이상 연락 안 한 고객 ({len(briefing['inactive_customers'])}명)</h3>")
    if briefing["inactive_customers"]:
        for c in briefing["inactive_customers"]:
            last = c.get("sales_date", "없음")
            if last == "None":
                last = "없음"
            lines.append(f"<p>- <b>{c.get('name','')}</b> ({c.get('company_name','')}) | 마지막 활동: {last}</p>")
    else:
        lines.append("<p style='color:#999'>없음</p>")

    # 최근 활동 요약
    lines.append(f"<h3 style='color:#2e7d32'>최근 7일 영업활동 ({len(briefing['recent_activities'])}건)</h3>")
    if briefing["recent_activities"]:
        for a in briefing["recent_activities"]:
            lines.append(f"<p>- {a.get('영업활동일','')} | {a.get('고객사','')} {a.get('고객','')} | {a.get('활동분류','')}</p>")
    else:
        lines.append("<p style='color:#999'>없음</p>")

    # 파이프라인 요약
    lines.append(f"<h3>내 파이프라인 요약</h3>")
    lines.append(f"<p>진행 중인 영업기회: <b>{briefing['my_opps_count']}건</b></p>")

    lines.append("<br><p style='color:#aaa;font-size:12px'>UNITRONTECH CRM | 이 메일은 자동 발송되었습니다</p>")

    return "\n".join(lines)


@app.post("/api/daily-briefing")
async def send_daily_briefing():
    """모든 인증된 사용자에게 아침 브리핑 발송"""
    users = users_tb.scan_all()
    verified = [u for u in users if u.get("is_verified") == "Y"]

    if not verified:
        return {"error": "인증된 사용자가 없습니다"}

    results = []
    for user in verified:
        name = user.get("name", "")
        email = user.get("email", "")

        briefing = build_morning_briefing(name)
        html = format_briefing_email(name, briefing)

        smtp_user = os.environ.get("SMTP_USER", "sean94kr@gmail.com")
        smtp_pass = os.environ.get("SMTP_PASS", "pbel bcoo znwu lwgx")

        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText as MT

        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[CRM 아침 브리핑] {name}님의 오늘 영업 현황 - {briefing['today']}"
        msg["From"] = smtp_user
        msg["To"] = email
        msg.attach(MT(html, "html", "utf-8"))

        try:
            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            results.append({"email": email, "name": name, "status": "sent",
                            "opps": briefing["my_opps_count"],
                            "expiring": len(briefing["expiring_opps"]),
                            "inactive": len(briefing["inactive_customers"])})
        except Exception as e:
            results.append({"email": email, "name": name, "status": f"failed: {e}"})

    return {"sent_to": len(results), "results": results}


@app.get("/api/daily-briefing/preview/{user_name}")
async def preview_briefing(user_name: str):
    """브리핑 미리보기"""
    briefing = build_morning_briefing(user_name)
    html = format_briefing_email(user_name, briefing)
    return {"html": html, "data": briefing}


# ==================== AI 보고서 ====================

import anthropic

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "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")


@app.post("/api/ai/team-report")
async def generate_team_report(request: Request):
    data = await request.json()
    department = data.get("department", "")

    if not department:
        return {"error": "소속 정보가 없습니다"}

    all_opps = opportunities_tb.scan_all()
    all_activities = generic_tb.query_by_pk("activities")
    all_customers = customers_tb.scan_all()

    # 해당 실 소속 등록 사원
    registered = [u["name"] for u in users_tb.scan_all() if u.get("department") == department and u.get("is_verified") == "Y"]

    # 해당 실 담당자 전원 (등록 안 한 사람 포함, 데이터 기반)
    all_managers = set()
    for o in all_opps:
        m = o.get("manager", "")
        if m:
            for name in m.replace(",", " ").replace("/", " ").split():
                all_managers.add(name.strip())

    # 등록된 사원 + 그 사원의 데이터에서 같이 나오는 사원
    dept_members = set(registered)
    if not dept_members:
        return {"error": f"{department}에 등록된 사원이 없습니다"}

    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y.%m.%d")
    week_later = (datetime.now() + timedelta(days=7)).strftime("%Y.%m.%d")
    today = datetime.now().strftime("%Y.%m.%d")

    # 사원별 데이터 수집
    members_data = []
    ai_input = ""

    for name in sorted(dept_members):
        # 영업기회
        my_opps = [o for o in all_opps if name in str(o.get("manager", ""))]
        in_progress = [o for o in my_opps if o.get("status") == "진행중"]
        won = [o for o in my_opps if o.get("status") == "종료(성공)"]
        expiring = [o for o in in_progress if o.get("end_date", "") and o.get("end_date", "") <= week_later]
        overdue = [o for o in in_progress if o.get("end_date", "") and o.get("end_date", "") < today]

        # 영업활동
        my_acts = []
        for item in all_activities:
            rec = json.loads(item.get("data", "{}"))
            if name in str(rec.get("담당자", "")):
                my_acts.append(rec)
        recent_acts = [a for a in my_acts if a.get("영업활동일", "") >= week_ago]

        # 활동 분류 집계
        act_types = {}
        for a in recent_acts:
            t = a.get("활동분류", "기타")
            act_types[t] = act_types.get(t, 0) + 1

        # 미연락 고객
        inactive = [c for c in all_customers if name in str(c.get("manager", ""))
                     and (not c.get("sales_date") or c.get("sales_date") == "None" or c.get("sales_date", "") < week_ago)]

        member = {
            "name": name,
            "total_opps": len(my_opps),
            "in_progress": len(in_progress),
            "won": len(won),
            "win_rate": round(len(won) / len(my_opps) * 100) if my_opps else 0,
            "expiring": len(expiring),
            "overdue": len(overdue),
            "week_activities": len(recent_acts),
            "act_types": act_types,
            "inactive_customers": len(inactive),
            "top_opps": [{"name": o.get("opp_name"), "company": o.get("company_name"),
                          "stage": o.get("stage"), "pct": o.get("success_pct")} for o in in_progress[:5]],
            "top_acts": [{"date": a.get("영업활동일"), "company": a.get("고객사"),
                          "customer": a.get("고객"), "type": a.get("활동분류"),
                          "content": str(a.get("활동내용", ""))[:100]} for a in recent_acts[:5]],
        }
        members_data.append(member)

        # AI 입력용 텍스트
        act_summary = ", ".join([f"{k} {v}건" for k, v in act_types.items()]) or "없음"
        ai_input += f"""
[{name}]
영업기회: 진행중 {len(in_progress)}건, 성공 {len(won)}건, 성공률 {member['win_rate']}%
이번 주 활동: {len(recent_acts)}건 ({act_summary})
종료일 경과: {len(overdue)}건, 이번 주 종료 예정: {len(expiring)}건
미연락 고객: {len(inactive)}명
주요 활동:
"""
        for a in recent_acts[:3]:
            content = str(a.get("활동내용", ""))[:150]
            if content and content != "None":
                ai_input += f"  - {a.get('영업활동일', '')} {a.get('고객사', '')} {a.get('고객', '')}: {content}\n"

    # AI 요약
    ai_summary = ""
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-20250514", max_tokens=1500,
            messages=[{"role": "user", "content": f"""{department} 영업회의 자료를 작성해주세요.
간결하고 액션 중심으로. 형식:

■ 이번 주 핵심 요약 (3줄)
■ 사원별 한줄 코멘트
■ 즉시 조치 필요 사항
■ 다음 주 중점 사항

데이터:
{ai_input}"""}],
        )
        ai_summary = message.content[0].text
    except Exception as e:
        ai_summary = f"AI 요약 생성 실패: {str(e)}"

    return {
        "department": department,
        "period": f"{week_ago} ~ {today}",
        "members": members_data,
        "ai_summary": ai_summary,
        "total_members": len(dept_members),
    }


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
