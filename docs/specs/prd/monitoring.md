# Monitoring 도메인 PRD

> 변경이력: [prd-changelog.md](../../archive/prd-changelog.md)

## 개요

봇의 실시간 상태(온라인/오프라인, 업타임, 핑, 메모리)와 서버 음성 접속자 수를 웹 대시보드에서 모니터링하는 도메인이다. 1분 간격 스케줄러가 메트릭을 수집하여 PostgreSQL에 저장하고, REST API로 실시간 상태 및 시계열 차트 데이터를 제공한다.

## 관련 모듈

- `apps/api/src/monitoring/monitoring.module.ts` — 모니터링 모듈
- `apps/api/src/monitoring/monitoring.service.ts` — 메트릭 수집 및 조회 서비스
- `apps/api/src/monitoring/monitoring.controller.ts` — REST API 엔드포인트
- `apps/api/src/monitoring/monitoring.scheduler.ts` — 1분 간격 메트릭 수집 스케줄러
- `apps/api/src/monitoring/domain/bot-metric.entity.ts` — BotMetric 엔티티
- `apps/api/src/monitoring/infrastructure/bot-metric.repository.ts` — DB 저장소
- `apps/web/app/dashboard/guild/[guildId]/monitoring/page.tsx` — 모니터링 대시보드 페이지
- `apps/web/app/lib/monitoring-api.ts` — 프론트엔드 API 클라이언트

## 아키텍처

```
[MonitoringScheduler] ← @Cron('*/1 * * * *') 1분 간격
    │
    ├── Discord Client에서 상태 수집 (status, ping, guilds.cache.size)
    ├── Node.js process.memoryUsage()에서 메모리 수집
    ├── Guild별 음성 접속자 수 집계
    │
    └──► DB: BotMetric INSERT

Web Dashboard (모니터링 페이지)
    │
    ├── GET /api/guilds/:guildId/bot/status        → 실시간 상태 (Redis 캐시 10초)
    └── GET /api/guilds/:guildId/bot/metrics       → 시계열 차트 데이터

[MonitoringScheduler] ← @Cron('0 3 * * *') 매일 03:00
    │
    └──► DB: 30일 초과 BotMetric DELETE (보존 정책)
```

---

## 기능 상세

### F-MONITORING-001: 실시간 봇 상태 조회

- **엔드포인트**: `GET /api/guilds/:guildId/bot/status`
- **인증**: `JwtAuthGuard` 적용
- **동작**:
  1. Redis 캐시 조회 (`monitoring:status`, TTL 10초)
  2. 캐시 미스 시 Discord Client에서 실시간 데이터 수집:
     - `client.ws.ping` — Discord API 지연시간 (ms)
     - `client.uptime` — 봇 업타임 (ms)
     - `client.readyAt` — 봇 시작 시각
     - `client.guilds.cache.size` — 참여 서버 수
     - `client.ws.status` — WebSocket 연결 상태 (0=READY)
     - `process.memoryUsage()` — heapUsed, heapTotal (bytes)
  3. `guildId`로 해당 서버의 음성 채널 접속자 수 집계
  4. Redis에 결과 캐싱 (TTL 10초)
- **응답 형식**:
  ```json
  {
    "online": true,
    "uptimeMs": 302400000,
    "startedAt": "2026-03-07T12:00:00.000Z",
    "pingMs": 42,
    "guildCount": 3,
    "memoryUsage": {
      "heapUsedMb": 128.5,
      "heapTotalMb": 256.0
    },
    "voiceUserCount": 12
  }
  ```
- **응답 필드**:

  | 필드 | 타입 | 설명 |
  |------|------|------|
  | `online` | `boolean` | 봇 온라인 여부 (`client.ws.status === 0`) |
  | `uptimeMs` | `number` | 봇 업타임 (밀리초) |
  | `startedAt` | `string` | 봇 시작 시각 (ISO 8601) |
  | `pingMs` | `number` | Discord API 왕복 지연시간 (ms) |
  | `guildCount` | `number` | 봇이 참여한 서버 수 |
  | `memoryUsage.heapUsedMb` | `number` | 사용 중인 힙 메모리 (MB, 소수점 1자리) |
  | `memoryUsage.heapTotalMb` | `number` | 전체 힙 메모리 (MB, 소수점 1자리) |
  | `voiceUserCount` | `number` | 해당 서버의 음성 채널 총 접속자 수 |

- **오류 처리**: Discord Client 미연결 시 `online: false`, 나머지 필드 0 또는 null 반환

---

### F-MONITORING-002: 메트릭 수집 스케줄러

- **트리거**: `@Cron('*/1 * * * *')` — 매 1분
- **동작**:
  1. Discord Client에서 상태 데이터 수집
  2. `client.guilds.cache`를 순회하며 길드별 음성 접속자 수 집계
  3. 길드별로 `BotMetric` 레코드 INSERT
- **수집 항목**:

  | 항목 | 소스 |
  |------|------|
  | `status` | `client.ws.status === 0` → `ONLINE`, 그 외 → `OFFLINE` |
  | `pingMs` | `client.ws.ping` |
  | `heapUsedMb` | `process.memoryUsage().heapUsed / 1024 / 1024` |
  | `heapTotalMb` | `process.memoryUsage().heapTotal / 1024 / 1024` |
  | `voiceUserCount` | `guild.voiceStates.cache.filter(vs => vs.channelId).size` (봇 제외) |
  | `guildCount` | `client.guilds.cache.size` |

- **오류 처리**: 수집 실패 시 로그 기록 후 다음 주기까지 대기. 프로세스 중단하지 않음

---

### F-MONITORING-003: 시계열 메트릭 조회 API

- **엔드포인트**: `GET /api/guilds/:guildId/bot/metrics`
- **인증**: `JwtAuthGuard` 적용
- **쿼리 파라미터**:

  | 파라미터 | 타입 | 필수 | 기본값 | 설명 |
  |---------|------|------|--------|------|
  | `from` | `string` | N | 24시간 전 | 시작 시각 (ISO 8601) |
  | `to` | `string` | N | 현재 | 종료 시각 (ISO 8601) |
  | `interval` | `string` | N | `1m` | 집계 간격 (`1m`, `5m`, `1h`, `1d`) |

- **동작**:
  1. `guildId` + `from` ~ `to` 범위로 `BotMetric` 조회
  2. `interval`에 따라 `date_trunc` 기반 집계:
     - `1m`: 원본 데이터 그대로 (집계 없음)
     - `5m`: 5분 단위 평균
     - `1h`: 1시간 단위 평균
     - `1d`: 1일 단위 평균
  3. 결과 배열 반환
- **응답 형식**:
  ```json
  {
    "interval": "1h",
    "availabilityPercent": 99.2,
    "data": [
      {
        "timestamp": "2026-03-10T00:00:00.000Z",
        "online": true,
        "pingMs": 45,
        "heapUsedMb": 130.2,
        "heapTotalMb": 256.0,
        "voiceUserCount": 8,
        "guildCount": 3
      }
    ]
  }
  ```
- **`availabilityPercent`**: 조회 기간 내 `status = ONLINE` 비율 (소수점 1자리)
- **interval 자동 선택 가이드** (프론트엔드 권장):
  - 24시간 이하: `1m`
  - 7일 이하: `5m`
  - 30일 이하: `1h`

---

### F-MONITORING-004: 메트릭 보존 정책

- **트리거**: `@Cron('0 3 * * *')` — 매일 03:00 (KST)
- **동작**: `recordedAt < NOW() - 30일`인 `BotMetric` 레코드 일괄 삭제
- **로그**: `[MONITORING] Cleanup: deleted {count} metrics older than 30 days`

---

### F-WEB-MONITORING-001: 모니터링 대시보드 페이지

- **경로**: `/dashboard/guild/{guildId}/monitoring`
- **위치**: 대시보드 사이드바 > 모니터링 (Activity 아이콘)
- **접근 조건**: Discord OAuth 로그인 + 해당 서버 멤버

#### 기간 선택

- 프리셋 버튼: `24시간` | `7일` | `30일`
- 모든 차트에 동시 적용
- 기본값: `24시간`

#### 섹션 1: 상태 요약 카드 (Summary Cards)

| 카드 | 데이터 소스 | 표시 형식 |
|------|------------|----------|
| 봇 상태 | `online` | 초록 배지 "온라인" / 빨간 배지 "오프라인" |
| 업타임 | `uptimeMs` | `3일 14시간 22분` (사람이 읽을 수 있는 형식) |
| 핑 | `pingMs` | `42ms` (초록: <100, 노랑: <200, 빨강: ≥200) |
| 서버 수 | `guildCount` | `3개 서버` |
| 메모리 | `memoryUsage` | `128MB / 256MB` (사용량/전체, 퍼센트 표시) |
| 음성 접속자 | `voiceUserCount` | `12명` |

- **데이터 소스**: `GET /api/guilds/{guildId}/bot/status`
- **갱신 주기**: 10초 폴링 (`setInterval`)

#### 섹션 2: 차트 영역

##### 차트 1 — 업타임 히스토리 (UptimeChart, AreaChart)
- X축: 시간
- Y축: 상태 (1=온라인, 0=오프라인)
- 온라인 구간: 초록 영역, 오프라인 구간: 빨간 영역
- 차트 상단에 **가용률(%)** 텍스트 표시 (`availabilityPercent`)
- recharts `AreaChart` + `Area` 컴포넌트

##### 차트 2 — 핑 추이 (PingChart, LineChart)
- X축: 시간
- Y축: 지연시간 (ms)
- 단일 라인 (평균 핑)
- 200ms 임계치 기준선 (빨간 점선, recharts `ReferenceLine`)
- recharts `LineChart` + `Line` 컴포넌트

##### 차트 3 — 메모리 사용량 추이 (MemoryChart, AreaChart)
- X축: 시간
- Y축: MB 단위
- heapUsed: 진한 영역, heapTotal: 연한 영역 (두 Area 겹침)
- recharts `AreaChart` + `Area` 2개

##### 차트 4 — 시간대별 음성 접속자 수 (VoiceUserChart, BarChart)
- X축: 시간대 (0시~23시) — 기간 내 평균
- Y축: 평균 접속자 수
- 피크 시간대 하이라이트 (최대값 바 색상 강조)
- recharts `BarChart` + `Bar` 컴포넌트
- **집계 방식**: 프론트엔드에서 메트릭 데이터의 `timestamp`를 시간대(hour)로 그룹핑하여 평균 계산

- **데이터 소스**: `GET /api/guilds/{guildId}/bot/metrics?from=&to=&interval=`
- **갱신 주기**: 페이지 로드 시 1회 + 기간 변경 시 재조회

#### 차트 레이아웃

```
[상태 카드 6개 가로 배치]

[업타임 히스토리 — 전체 너비]

[핑 추이 — 1/2 너비] [메모리 사용량 — 1/2 너비]

[시간대별 음성 접속자 — 전체 너비]
```

#### API 클라이언트 함수

`apps/web/app/lib/monitoring-api.ts`에 다음 함수 추가:

```typescript
export interface BotStatus {
  online: boolean;
  uptimeMs: number;
  startedAt: string;
  pingMs: number;
  guildCount: number;
  memoryUsage: {
    heapUsedMb: number;
    heapTotalMb: number;
  };
  voiceUserCount: number;
}

export interface MetricPoint {
  timestamp: string;
  online: boolean;
  pingMs: number;
  heapUsedMb: number;
  heapTotalMb: number;
  voiceUserCount: number;
  guildCount: number;
}

export interface MetricsResponse {
  interval: string;
  availabilityPercent: number;
  data: MetricPoint[];
}

export async function fetchBotStatus(guildId: string): Promise<BotStatus>
export async function fetchBotMetrics(guildId: string, from: string, to: string, interval: string): Promise<MetricsResponse>
```

---

## 데이터 모델

### BotMetric (`bot_metric`)

봇 상태 메트릭 시계열 데이터를 저장한다.

| 컬럼 | 타입 | 제약조건 | 설명 |
|-------|------|----------|------|
| `id` | `int` | PK, AUTO_INCREMENT | 내부 ID |
| `guildId` | `varchar` | NOT NULL | 디스코드 서버 ID |
| `status` | `enum('ONLINE','OFFLINE')` | NOT NULL | 봇 상태 |
| `pingMs` | `int` | NOT NULL, DEFAULT `0` | Discord API 핑 (ms) |
| `heapUsedMb` | `float` | NOT NULL, DEFAULT `0` | 사용 중인 힙 메모리 (MB) |
| `heapTotalMb` | `float` | NOT NULL, DEFAULT `0` | 전체 힙 메모리 (MB) |
| `voiceUserCount` | `int` | NOT NULL, DEFAULT `0` | 해당 서버 음성 접속자 수 |
| `guildCount` | `int` | NOT NULL, DEFAULT `0` | 봇 참여 서버 수 |
| `recordedAt` | `timestamp` | NOT NULL, DEFAULT `now()` | 기록 시각 |

**인덱스**:
- `IDX_bot_metric_guild_recorded` — `(guildId, recordedAt)` — 시계열 조회 최적화
- `IDX_bot_metric_recorded` — `(recordedAt)` — 보존 정책 삭제용

---

## Redis 키 구조

| 키 패턴 | TTL | 타입 | 설명 |
|---------|-----|------|------|
| `monitoring:status` | 10초 | `String` (JSON) | 실시간 봇 상태 캐시 (F-MONITORING-001) |

---

## 외부 의존성

| 서비스 | 용도 |
|--------|------|
| Discord.js Client | `ws.ping`, `ws.status`, `uptime`, `readyAt`, `guilds.cache`, `voiceStates.cache` 조회 |

Discord 관련 데이터는 `@InjectDiscordClient()`로 주입된 `Client` 객체에서 직접 읽는다. Discord REST API 호출은 발생하지 않는다.

---

## Health Check 엔드포인트

- **`GET /health`**: 전체 readiness 확인 (PostgreSQL + Redis + Discord Gateway)
- **`GET /health/liveness`**: 프로세스 alive 확인
- **인증**: 불필요 (공개 엔드포인트)
- **Rate Limiting**: 제외
- **구현**: `@nestjs/terminus` 기반

## Web 도메인 연계

| 연계 지점 | 방향 | 설명 |
|-----------|------|------|
| 모니터링 대시보드 | web → monitoring | `/dashboard/guild/{guildId}/monitoring`에서 F-MONITORING-001, F-MONITORING-003 API 호출 |
| Next.js API 프록시 | web → api | `apps/web/app/api/guilds/[...path]/route.ts`가 `/api/guilds/:guildId/bot/*` 요청을 백엔드로 프록시 |
| DashboardSidebar | web | 사이드바 메뉴에 "모니터링" 항목 추가 (Activity 아이콘) |
