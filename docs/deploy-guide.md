# 배포 가이드

## 아키텍처

```
GitHub (develop push) → CI 검증 (lint + build)
GitHub (main push)    → CI 검증 → Lightsail SSH 배포
```

---

## 1. Lightsail 인스턴스 초기 설정

### 1-1. 시스템 업데이트 + Docker 설치

```bash
sudo apt update && sudo apt upgrade -y

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# 확인
docker --version
docker compose version
```

### 1-2. Swap 추가 (저사양 인스턴스 권장)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 1-3. 타임존 설정

```bash
sudo timedatectl set-timezone Asia/Seoul
```

### 1-4. 방화벽

```bash
sudo ufw allow OpenSSH
sudo ufw allow 3000   # API
sudo ufw allow 4000   # Web
sudo ufw enable
```

> Lightsail 콘솔 > Networking 탭에서도 3000, 4000 포트를 열어야 한다.

### 1-5. 프로젝트 클론 + 환경변수

```bash
git clone <repo-url> ~/nest-dhyunbot
cd ~/nest-dhyunbot
nano .env.prod   # 환경변수 입력
```

### 1-6. 최초 실행

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 2. GitHub Secrets 설정

리포지토리 > Settings > Secrets and variables > Actions에 추가:

| Secret | 값 | 예시 |
|---|---|---|
| `LIGHTSAIL_HOST` | Lightsail 퍼블릭 IP | `STATIC_IP` |
| `LIGHTSAIL_USER` | SSH 유저명 | `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | SSH 프라이빗 키 전체 내용 | `-----BEGIN RSA PRIVATE KEY-----\n...` |

### SSH 키 확인 방법

Lightsail 콘솔에서 다운로드한 `.pem` 파일 내용 전체를 `LIGHTSAIL_SSH_KEY`에 붙여넣는다.

---

## 3. CI/CD 워크플로우

### CI (`ci.yml`)

| 트리거 | 동작 |
|---|---|
| `develop` push | lint + build 검증 |
| `main` push | lint + build 검증 |
| `main` PR | lint + build 검증 |

### Deploy (`deploy.yml`)

| 트리거 | 동작 |
|---|---|
| `main` push | Lightsail SSH 접속 → `git pull` → `docker compose up --build -d` |

---

## 4. 배포 흐름

```
1. develop 브랜치에서 작업 + push → CI 자동 검증
2. develop → main PR 생성 → CI 자동 검증
3. main에 merge → CI 검증 + 자동 배포
```

---

## 5. 수동 배포 (긴급 시)

```bash
ssh ubuntu@<LIGHTSAIL_IP>
cd ~/nest-dhyunbot
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

---

## 6. 운영 명령어

```bash
# 로그 확인
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web

# 특정 서비스 재시작
docker compose -f docker-compose.prod.yml restart api

# 전체 중지
docker compose -f docker-compose.prod.yml down

# 전체 재빌드 + 시작
docker compose -f docker-compose.prod.yml up -d --build

# 미사용 이미지 정리
docker image prune -f

# DB 접속 (디버깅)
docker exec -it postgres-prod psql -U $DATABASE_USER -d $DATABASE_NAME
```

---

## 7. 트러블슈팅

### 빌드 실패 시

```bash
# 캐시 없이 재빌드
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

### 디스크 부족 시

```bash
docker system prune -a   # 미사용 이미지/컨테이너 전체 정리
```

### DB 마이그레이션 필요 시

TypeORM `synchronize: true` (개발)이 아닌 프로덕션에서는 마이그레이션 실행:

```bash
docker exec -it nest-api-prod node -e "require('./dist/apps/api/src/data-source').default.runMigrations()"
```
