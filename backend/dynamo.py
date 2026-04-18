import os
import boto3
from boto3.dynamodb.conditions import Key, Attr

AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-2")
DYNAMO_ENDPOINT = os.environ.get("DYNAMO_ENDPOINT", None)  # 로컬 개발용
TABLE_PREFIX = os.environ.get("DYNAMO_TABLE_PREFIX", "crm_")

TABLES = {
    "users": {"pk": "email", "sk": None},
    "customers": {"pk": "customer_id", "sk": None},
    "companies": {"pk": "company_id", "sk": None},
    "opportunities": {"pk": "opp_id", "sk": None},
    "generic": {"pk": "table_name", "sk": "item_id"},
}


def get_dynamodb():
    kwargs = {"region_name": AWS_REGION}
    if DYNAMO_ENDPOINT:
        kwargs["endpoint_url"] = DYNAMO_ENDPOINT
    return boto3.resource("dynamodb", **kwargs)


def get_table(name):
    db = get_dynamodb()
    return db.Table(f"{TABLE_PREFIX}{name}")


def create_tables():
    """DynamoDB 테이블 생성 (존재하지 않으면)"""
    db = get_dynamodb()
    client = db.meta.client
    existing = client.list_tables()["TableNames"]

    for name, schema in TABLES.items():
        table_name = f"{TABLE_PREFIX}{name}"
        if table_name in existing:
            continue

        key_schema = [{"AttributeName": schema["pk"], "KeyType": "HASH"}]
        attr_defs = [{"AttributeName": schema["pk"], "AttributeType": "S"}]

        if schema["sk"]:
            key_schema.append({"AttributeName": schema["sk"], "KeyType": "RANGE"})
            attr_defs.append({"AttributeName": schema["sk"], "AttributeType": "S"})

        client.create_table(
            TableName=table_name,
            KeySchema=key_schema,
            AttributeDefinitions=attr_defs,
            BillingMode="PAY_PER_REQUEST",
        )
        print(f"Created table: {table_name}")


class DynamoTable:
    """DynamoDB 테이블 래퍼"""

    def __init__(self, name):
        self.name = name
        self.table = get_table(name)
        self.schema = TABLES[name]

    def put(self, item):
        """항목 저장 (None 값 제거)"""
        clean = {}
        for k, v in item.items():
            if v is not None and v != "" and v != "None" and v != "nan":
                clean[k] = v
        self.table.put_item(Item=clean)

    def get(self, pk_value, sk_value=None):
        """PK로 조회"""
        key = {self.schema["pk"]: pk_value}
        if sk_value and self.schema["sk"]:
            key[self.schema["sk"]] = sk_value
        resp = self.table.get_item(Key=key)
        return resp.get("Item")

    def delete(self, pk_value, sk_value=None):
        key = {self.schema["pk"]: pk_value}
        if sk_value and self.schema["sk"]:
            key[self.schema["sk"]] = sk_value
        self.table.delete_item(Key=key)

    def scan_all(self, filter_expr=None, limit=None):
        """전체 스캔"""
        kwargs = {}
        if filter_expr:
            kwargs["FilterExpression"] = filter_expr
        items = []
        while True:
            resp = self.table.scan(**kwargs)
            items.extend(resp.get("Items", []))
            if "LastEvaluatedKey" not in resp:
                break
            kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
        return items

    def query_by_pk(self, pk_value):
        """PK로 쿼리 (SK 있는 테이블용)"""
        resp = self.table.query(
            KeyConditionExpression=Key(self.schema["pk"]).eq(pk_value)
        )
        return resp.get("Items", [])

    def delete_all(self):
        """테이블 전체 삭제"""
        items = self.scan_all()
        with self.table.batch_writer() as batch:
            for item in items:
                key = {self.schema["pk"]: item[self.schema["pk"]]}
                if self.schema["sk"]:
                    key[self.schema["sk"]] = item[self.schema["sk"]]
                batch.delete_item(Key=key)

    def search(self, text, fields=None):
        """텍스트 검색 (스캔 기반)"""
        items = self.scan_all()
        if not text:
            return items
        text = text.lower()
        results = []
        for item in items:
            for k, v in item.items():
                if fields and k not in fields:
                    continue
                if text in str(v).lower():
                    results.append(item)
                    break
        return results

    def count(self):
        resp = self.table.scan(Select="COUNT")
        return resp["Count"]
