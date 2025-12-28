# Discord Voice Analytics Bot

Discord 서버의 음성 채널 활동을 실시간으로 수집·분석하고,
Redis + PostgreSQL 기반으로 통계를 집계하며,
Gemini AI를 통해 자동 리포트를 생성하는 봇입니다.

---

## ✨ Features

- 🎤 Discord 음성 채널 Join / Leave / Mute 이벤트 실시간 수집
- ⏱ Redis 세션 기반 음성 체류 시간 누적 (TTL 기반 세션 관리)
- 📊 PostgreSQL 일/월 단위 통계 집계
- 👥 유저 간 동시 체류 시간 분석 (가장 자주 함께한 유저)
- 🤖 Gemini AI 기반 자동 분석 리포트 생성
- 🧹 서버 비정상 종료 대비 세션 Flush 전략 적용

---

## 🛠 Tech Stack

### Backend

- NestJS
- TypeORM
- PostgreSQL
- Redis

### Infra

- Docker / Docker Compose

### AI

- Gemini API

## 🧩 Architecture

Discord Gateway
↓
NestJS Gateway
↓
Redis (Session / TTL)
↓
PostgreSQL (Daily / Monthly Stats)
↓
Gemini AI → Discord Embed Report

## 🚀 Getting Started

```bash
git clone https://github.com/yourname/discord-voice-analytics
cd discord-voice-analytics
docker compose up --build
```

.env 파일 예시:

```bash
# Database
DATABASE_HOST=db
DATABASE_PORT=5432
DATABASE_USER=USER
DATABASE_PASSWORD=YOUR_PASSWORD
DATABASE_NAME=dhyunbot

# Discord Bot
DISCORD_API_TOKEN=YOUR_BOT_TOKEN
DISCORD_CLIENT_ID=YOUR_CLIENT_ID

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_PASSWORD

# GEMINI
GEMINI_API_KEY=YOUR_OPEN_API_KEY
```
