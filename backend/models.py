from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    department = Column(String)  # 영업1실~5실
    password_hash = Column(String)
    is_verified = Column(String, default="N")
    verify_code = Column(String)
    created_at = Column(DateTime, server_default=func.now())


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(String, unique=True, index=True)
    company_id = Column(String, index=True)
    company_name = Column(String, index=True)
    name = Column(String, index=True)
    department = Column(String)
    position = Column(String)
    mobile = Column(String)
    phone = Column(String)
    email = Column(String)
    grade = Column(String)
    keyman = Column(String)
    manager = Column(String, index=True)
    sales_date = Column(String)
    creator = Column(String)
    created_at = Column(String)
    modifier = Column(String)
    modified_at = Column(String)


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    opp_id = Column(String, unique=True, index=True)
    opp_name = Column(String)
    company_id = Column(String, index=True)
    company_name = Column(String)
    customer_id = Column(String, index=True)
    customer_name = Column(String)
    manager = Column(String, index=True)
    status = Column(String, index=True)
    fail_reason = Column(String)
    competitor = Column(String)
    product = Column(String)
    expected_revenue = Column(Float)
    expected_margin_pct = Column(Float)
    expected_margin_amt = Column(Float)
    start_date = Column(String)
    end_date = Column(String)
    revenue_type = Column(String)
    biz_type = Column(String)
    detail = Column(String)
    process = Column(String)
    stage = Column(String)
    category = Column(String)
    success_pct = Column(Float)
    source = Column(String)
    note = Column(String)
    address = Column(String)
    creator = Column(String)
    created_at = Column(String)
    modifier = Column(String)
    modified_at = Column(String)


class Contract(Base):
    __tablename__ = "contracts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    contract_id = Column(String, unique=True, index=True)
    data = Column(String)  # JSON blob


class Estimate(Base):
    __tablename__ = "estimates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    estimate_id = Column(String, unique=True, index=True)
    data = Column(String)


class Proposal(Base):
    __tablename__ = "proposals"
    id = Column(Integer, primary_key=True, autoincrement=True)
    proposal_id = Column(String, unique=True, index=True)
    data = Column(String)


class SalesActivity(Base):
    __tablename__ = "sales_activities"
    id = Column(Integer, primary_key=True, autoincrement=True)
    activity_id = Column(String, unique=True, index=True)
    data = Column(String)


class Support(Base):
    __tablename__ = "supports"
    id = Column(Integer, primary_key=True, autoincrement=True)
    support_id = Column(String, unique=True, index=True)
    data = Column(String)


class Revenue(Base):
    __tablename__ = "revenues"
    id = Column(Integer, primary_key=True, autoincrement=True)
    revenue_id = Column(String, unique=True, index=True)
    data = Column(String)


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    category = Column(String)
    grade = Column(String)
    status = Column(String)
    revenue = Column(Float)
    employees = Column(Float)
    biz_number = Column(String)
    phone = Column(String)
    fax = Column(String)
    website = Column(String)
    zipcode = Column(String)
    address = Column(String)
    manager = Column(String, index=True)
    creator = Column(String)
    created_at = Column(String)
    modifier = Column(String)
    modified_at = Column(String)
