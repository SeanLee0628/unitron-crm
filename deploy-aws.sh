#!/bin/bash
set -e

REGION="ap-northeast-2"
REPO_NAME="unitron-crm"
CLUSTER_NAME="unitron-crm-cluster"
SERVICE_NAME="unitron-crm-service"
TASK_NAME="unitron-crm-task"

echo "=== 1. ECR 리포지토리 생성 ==="
aws ecr create-repository --repository-name $REPO_NAME --region $REGION 2>/dev/null || echo "이미 존재"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME"

echo "=== 2. Docker 빌드 & 푸시 ==="
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI
docker build -t $REPO_NAME .
docker tag $REPO_NAME:latest $ECR_URI:latest
docker push $ECR_URI:latest

echo "=== 3. ECS 클러스터 생성 ==="
aws ecs create-cluster --cluster-name $CLUSTER_NAME --region $REGION 2>/dev/null || echo "이미 존재"

echo "=== 완료 ==="
echo "ECR URI: $ECR_URI"
echo ""
echo "다음 단계:"
echo "1. AWS 콘솔에서 ECS Task Definition 생성 (이미지: $ECR_URI:latest)"
echo "2. 환경변수 설정: AWS_REGION, ANTHROPIC_API_KEY, SMTP_USER, SMTP_PASS"
echo "3. ECS Service 생성 (Fargate)"
echo "4. ALB 연결"
