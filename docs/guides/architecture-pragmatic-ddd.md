# Architecture Guide — Pragmatic DDD (소규모 팀용)

> 2~3명 팀 + NestJS 환경을 위한 실용 가이드입니다.
> NestJS 모듈 단위를 따르되, 모듈 내부에서 레이어를 폴더로 구분합니다.
> 구조보다 **도메인 로직 보호**를 우선합니다. 복잡도가 생길 때 확장합니다.

---

## 목차

1. [핵심 원칙](#1-핵심-원칙)
2. [레이어 아키텍처](#2-레이어-아키텍처)
3. [전술적 설계](#3-전술적-설계)
4. [디렉토리 구조](#4-디렉토리-구조)
5. [코드 컨벤션](#5-코드-컨벤션)
6. [의사결정 기준](#6-의사결정-기준)
7. [안티패턴](#7-안티패턴)
8. [확장 시점](#8-확장-시점)
9. [용어집](#9-용어집)

---

## 1. 핵심 원칙

### 우리가 반드시 지키는 것 (협상 불가)

| 원칙                       | 이유                                                |
| -------------------------- | --------------------------------------------------- |
| **Ubiquitous Language**    | 팀원이 적을수록 용어 혼선이 빠르게 버그가 됨        |
| **도메인 로직은 도메인에** | Service/Controller에 비즈니스 규칙이 새면 추적 불가 |
| **의존성 방향**            | 도메인은 DB·HTTP를 모름. 외부가 도메인에 맞춤       |

### 우리가 의식적으로 미루는 것

```
❌ 지금 하지 않음                 ✅ 언제 도입하나
────────────────────────────────────────────────────
Bounded Context 분리           팀이 5명+, 도메인이 확연히 분리될 때
CQRS                          읽기 모델이 쓰기 모델과 달라질 때
EventBus / 메시지 큐            서비스 간 비동기 통신이 필요할 때
Context Map 문서화             Context가 2개 이상 생길 때
```

### 지금 우리의 구조

2~3명 팀은 **단일 Context + 레이어 분리**로 시작합니다.
Context 분리는 "팀이 나뉠 때" 또는 "배포 단위가 달라질 때" 합니다.

---

## 2. 레이어 아키텍처

### NestJS와의 접합 방식

NestJS는 **모듈(기능) 우선** 구조를 권장합니다. 레이어 우선 폴더 구조를 억지로 맞추면 `order.module.ts`가 여러 레이어를 가로질러 import하게 되어 의존성이 복잡해집니다.

우리는 **NestJS 모듈 단위를 따르되, 모듈 내부를 레이어 폴더로 구분**합니다.

```
┌─────────────────────────────────────────────┐
│              NestJS Module (order/)          │
│                                             │
│  presentation/   ── Controllers, DTO        │
│       ↓                                     │
│  application/    ── Services (Use Cases)    │
│       ↓                                     │
│  domain/         ── Entities, VOs (순수)    │
│       ↑                                     │
│  infrastructure/ ── Repository 구현체       │
└─────────────────────────────────────────────┘

의존성 방향: presentation → application → domain ← infrastructure
```

### 레이어별 책임과 경계

**presentation/**

- `@Controller`, `@Get`, `@Post` 등 NestJS HTTP 데코레이터
- DTO 정의 및 변환, `class-validator`로 입력 형식 검증
- 비즈니스 규칙 검증은 여기서 하지 않음

**application/**

- `@Injectable()` Service — Use Case 하나당 메서드 하나
- 도메인 객체를 조율, 직접 로직을 갖지 않음
- `@Transactional()` 또는 QueryRunner로 트랜잭션 경계 관리

**domain/**

- Entity, Value Object — `@Injectable()` 없음, 순수 TypeScript 클래스
- NestJS·TypeORM import 없음. 이 폴더에서 외부 라이브러리 import가 보이면 잘못된 것
- 비즈니스 규칙 위반 시 `DomainException` throw
- Repository **인터페이스**만 여기에 위치

**infrastructure/**

- Repository 구현체 (`@Injectable()`로 NestJS DI에 등록)
- TypeORM Entity(ORM 매핑용), Mapper 클래스
- 외부 API 클라이언트

### NestJS DI에서 Repository 인터페이스 사용

TypeScript 인터페이스는 런타임에 사라지므로 NestJS DI 토큰으로 직접 쓸 수 없습니다. **Symbol 토큰**으로 해결합니다.

```typescript
// domain/order/order.repository.ts — 인터페이스 + 토큰 같이 정의
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
```

```typescript
// order.module.ts — Symbol 토큰으로 구현체 등록
@Module({
  imports: [TypeOrmModule.forFeature([Orderorm])],
  providers: [
    OrderService,
    {
      provide: ORDER_REPOSITORY, // Symbol 토큰
      useClass: TypeOrmOrderRepository, // 구현체
    },
  ],
  controllers: [OrderController],
})
export class OrderModule {}
```

```typescript
// application/order.service.ts — @Inject()로 주입
@Injectable()
export class OrderService {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepo: OrderRepository // 인터페이스 타입 유지
  ) {}
}
```

### 소규모 팀 실용 팁

```
Application Service가 얇다면 — Controller에 합쳐도 됨
  단, 도메인 로직이 따라 올라오면 안 됨

단순 조회 — Repository 인터페이스 없이 TypeORM Repository 직접 주입 허용
  @InjectRepository(OrderOrm) 로 바로 사용 가능
```

---

## 3. 전술적 설계

### 복잡도에 따른 패턴 선택

```
복잡도 낮음 (CRUD, 단순 상태 저장)
└── Transaction Script
    서비스 메서드에 로직 직접 작성
    Entity는 데이터 홀더 역할

복잡도 중간 (상태 전이, 조건부 규칙)
└── Entity + 메서드
    상태 변경은 반드시 Entity 메서드를 통해서
    불변식 검증을 Entity 내부에서

복잡도 높음 (복잡한 불변식, 여러 객체 간 규칙)
└── Aggregate + Domain Service
    트랜잭션 경계 = Aggregate 경계
    여러 Entity에 걸친 규칙은 Domain Service로
```

**판단 기준 — 모르겠으면 Entity부터 시작**
Transaction Script로 시작했다가 규칙이 늘어나면 Entity 메서드로 올리면 됩니다. 처음부터 Aggregate를 만들 필요는 없습니다.

---

### Entity

```typescript
// 상태 변경은 메서드를 통해서만
class Order {
  private status: OrderStatus;
  private items: OrderItem[];

  // ✅ 상태 변경 = 메서드
  confirm(): void {
    if (this.items.length === 0) throw new DomainException('주문 항목이 없습니다.', 'EMPTY_ITEMS');
    if (this.status !== OrderStatus.DRAFT)
      throw new DomainException('확정할 수 없는 상태입니다.', 'INVALID_STATUS');

    this.status = OrderStatus.CONFIRMED;
  }

  // ✅ 읽기는 getter 허용
  get isConfirmed(): boolean {
    return this.status === OrderStatus.CONFIRMED;
  }
}
```

```typescript
// ❌ 이렇게 하면 안 됨 — 규칙이 밖으로 샘
class OrderService {
  confirm(order: Order) {
    if (order.items.length === 0) throw new Error('...');
    order.status = 'CONFIRMED'; // 직접 접근
  }
}
```

---

### Value Object

불변(immutable), 값으로 동등성 비교, 생성 시 유효성 검증.

```typescript
class Money {
  private constructor(
    readonly amount: number,
    readonly currency: string
  ) {}

  static of(amount: number, currency: string): Money {
    if (amount < 0) throw new DomainException('금액은 0 이상이어야 합니다.', 'NEGATIVE_AMOUNT');
    if (!currency) throw new DomainException('통화 코드가 필요합니다.', 'MISSING_CURRENCY');
    return new Money(amount, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency)
      throw new DomainException('통화가 다릅니다.', 'CURRENCY_MISMATCH');
    return Money.of(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

**언제 Value Object로 만드나**

```
✅ Value Object로 만들 것
- 의미 있는 제약이 있는 원시값: 이메일, 금액, 수량, 좌표
- 여러 필드가 묶여야 의미가 생기는 것: 주소 (시/구/동/우편번호)
- 도메인 개념을 명확히 표현하고 싶을 때

❌ 굳이 안 해도 되는 것
- 제약 없는 단순 string/number
- 팀이 Value Object 개념에 아직 익숙하지 않을 때 → Entity부터
```

---

### Repository

인터페이스는 `domain/` 에, 구현체는 `infrastructure/` 에 둡니다. NestJS DI는 Symbol 토큰으로 연결합니다 (2번 섹션 참고).

```typescript
// infrastructure/persistence/typeorm-order.repository.ts
@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(
    @InjectRepository(OrderOrm)
    private readonly ormRepo: Repository<OrderOrm>,
    private readonly mapper: OrderMapper
  ) {}

  async findById(id: string): Promise<Order | null> {
    const record = await this.ormRepo.findOne({ where: { id } });
    return record ? this.mapper.toDomain(record) : null;
  }

  async save(order: Order): Promise<void> {
    const record = this.mapper.toOrm(order);
    await this.ormRepo.save(record);
  }
}
```

```typescript
// infrastructure/persistence/order.mapper.ts — ORM ↔ 도메인 변환
@Injectable()
export class OrderMapper {
  toDomain(orm: OrderOrm): Order {
    return Order.reconstitute({
      // 도메인 Entity 재구성 팩토리
      id: orm.id,
      status: orm.status as OrderStatus,
      items: orm.items.map(/* ... */),
    });
  }

  toOrm(order: Order): OrderOrm {
    const orm = new OrderOrm();
    orm.id = order.id;
    orm.status = order.status;
    return orm;
  }
}
```

**규칙**

- 메서드 이름은 도메인 언어로 (`findActiveOrders`, `findByCustomer`)
- 단순 목록 조회는 `@InjectRepository(OrderOrm)`으로 TypeORM 직접 사용 허용
- 페이지네이션·검색 등 읽기 전용 쿼리는 별도 QueryService로 분리

---

### Domain Event (필요할 때만)

이벤트 버스 없이, **Application Service 직접 호출**로 시작합니다.

```typescript
// application/order.service.ts
@Injectable()
export class OrderService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepo: OrderRepository,
    private readonly inventoryService: InventoryService,
    private readonly notificationService: NotificationService
  ) {}

  async confirmOrder(orderId: string): Promise<void> {
    const order = await this.orderRepo.findById(orderId);
    order.confirm();
    await this.orderRepo.save(order);

    // 후속 처리 직접 호출 — 단순하고 추적하기 쉬움
    await this.inventoryService.releaseReservation(orderId);
    await this.notificationService.sendConfirmationEmail(orderId);
  }
}
```

```
직접 호출 → NestJS EventEmitter2 전환 시점
- 후속 처리가 5개 이상 늘어날 때
- Application Service 간 순환 의존이 생길 때

NestJS EventEmitter2 → 외부 메시지 큐 전환 시점
- 실패 시 재시도(retry)가 필요할 때
- 다른 서비스(마이크로서비스)로 이벤트를 보내야 할 때
```

---

## 4. 디렉토리 구조

### NestJS 모듈 내부 레이어 구조 (기본)

NestJS 모듈을 최상위 단위로, 그 안에서 레이어를 폴더로 구분합니다.

```
src/
├── order/                              # NestJS 모듈 = 도메인 단위
│   ├── order.module.ts                 # 모듈 정의, DI 연결
│   │
│   ├── domain/                         # 순수 TypeScript — NestJS import 없음
│   │   ├── order.entity.ts             # Entity (비즈니스 규칙 포함)
│   │   ├── order-item.vo.ts            # Value Object
│   │   ├── order-status.enum.ts
│   │   ├── money.vo.ts                 # Value Object
│   │   └── order.repository.ts        # 인터페이스 + Symbol 토큰
│   │
│   ├── application/                    # Use Cases (@Injectable)
│   │   ├── order.service.ts            # 쓰기 Use Cases
│   │   └── order.query-service.ts      # 읽기 전용 쿼리
│   │
│   ├── infrastructure/                 # NestJS/TypeORM 의존
│   │   ├── typeorm-order.repository.ts # Repository 구현체
│   │   ├── order.orm-entity.ts         # TypeORM Entity (ORM 매핑용)
│   │   └── order.mapper.ts             # ORM ↔ 도메인 변환
│   │
│   └── presentation/                   # HTTP 진입점
│       ├── order.controller.ts
│       └── dto/
│           ├── confirm-order.request.ts
│           └── order-detail.response.ts
│
├── inventory/                          # 다른 도메인 모듈
│   └── ...
│
├── shared/                             # 전 모듈 공통
│   ├── domain-exception.ts
│   └── exception.filter.ts            # NestJS ExceptionFilter
│
└── app.module.ts
```

**파일 역할 구분 한눈에 보기**

| 파일 접미사                   | 위치              | NestJS 데코레이터     |
| ----------------------------- | ----------------- | --------------------- |
| `.entity.ts`                  | `domain/`         | 없음 (순수 클래스)    |
| `.vo.ts`                      | `domain/`         | 없음                  |
| `.repository.ts` (인터페이스) | `domain/`         | 없음                  |
| `.service.ts`                 | `application/`    | `@Injectable()`       |
| `.query-service.ts`           | `application/`    | `@Injectable()`       |
| `.orm-entity.ts`              | `infrastructure/` | `@Entity()` (TypeORM) |
| `.repository.ts` (구현체)     | `infrastructure/` | `@Injectable()`       |
| `.mapper.ts`                  | `infrastructure/` | `@Injectable()`       |
| `.controller.ts`              | `presentation/`   | `@Controller()`       |

**규칙**

- `domain/` 안에는 NestJS·TypeORM import 없음 — CI lint 규칙으로 강제 권장
- `order.module.ts`에서만 `provide/useClass`로 인터페이스 ↔ 구현체 연결
- 파일이 200줄 넘으면 분리 신호

### 모듈 연결 예시

```typescript
// order/order.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([OrderOrm]), // ORM Entity 등록
  ],
  providers: [
    // Application
    OrderService,
    OrderQueryService,
    // Infrastructure
    OrderMapper,
    {
      provide: ORDER_REPOSITORY, // 인터페이스 ↔ 구현체 연결
      useClass: TypeOrmOrderRepository,
    },
  ],
  controllers: [OrderController],
  exports: [OrderService], // 다른 모듈에서 쓸 경우만
})
export class OrderModule {}
```

### 확장 시 구조 (모듈이 많아질 때)

모듈 수가 늘어나도 각 모듈의 내부 구조는 동일하게 유지합니다.

```
src/
├── order/
├── inventory/
├── payment/
├── notification/
└── shared/
```

---

## 5. 코드 컨벤션

### Ubiquitous Language

코드 네이밍은 도메인 용어를 그대로 씁니다. 기술 용어로 포장하지 않습니다.

```
✅ 도메인 언어                  ❌ 기술 언어
─────────────────────────────────────────
order.confirm()               order.setStatus('CONFIRMED')
stock.reserve()               stock.updateCount()
invoice.markAsPaid()          invoice.save(paid=true)
```

용어가 헷갈리면 → **9번 용어집**에서 확인. 없으면 팀이 합의 후 추가.

### Application Service 네이밍

```typescript
// Use Case 중심으로 메서드 이름 지정
@Injectable()
export class OrderService {
  async confirmOrder(orderId: string): Promise<void> { ... }
  async cancelOrder(orderId: string, reason: string): Promise<void> { ... }
  async addItemToOrder(orderId: string, productId: string, qty: number): Promise<void> { ... }
}

// 조회는 별도 QueryService로 분리, get/list/search 접두사
@Injectable()
export class OrderQueryService {
  async getOrderDetail(orderId: string): Promise<OrderDetailResponse> { ... }
  async listOrdersByCustomer(customerId: string): Promise<OrderSummaryResponse[]> { ... }
}
```

### 에러 처리

```typescript
// shared/domain-exception.ts
export class DomainException extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = 'DomainException';
  }
}

// 도메인에서 throw — HTTP를 모름
throw new DomainException('재고가 부족합니다.', 'INSUFFICIENT_STOCK');
```

```typescript
// shared/exception.filter.ts — NestJS ExceptionFilter로 HTTP 매핑
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    ctx.getResponse<Response>().status(400).json({
      code: exception.code,
      message: exception.message,
    });
  }
}

// app.module.ts 또는 main.ts에 전역 등록
app.useGlobalFilters(new DomainExceptionFilter());
```

---

## 6. 의사결정 기준

### 새 기능 추가 시 질문 순서

```
1. 어떤 도메인 개념인가?
   → 용어집에 없으면 팀이 합의 후 추가

2. 비즈니스 규칙이 있는가?
   있음 → Domain 레이어에 구현
   없음 (단순 저장/조회) → Transaction Script 허용

3. 상태가 변하는가?
   있음 → Entity 메서드로 캡슐화
   없음 → Value Object 또는 단순 함수

4. 다른 도메인 객체에 영향을 주는가?
   있음 → Application Service에서 조율
   없음 → Entity 내부 처리
```

### PR 체크리스트

```
[ ] 도메인 로직이 application/ 또는 presentation/ 레이어에 있지 않은가?
[ ] domain/ 폴더 안에 NestJS·TypeORM import가 없는가?
[ ] Repository 인터페이스 ↔ 구현체 연결이 module.ts에만 있는가?
[ ] 새 도메인 용어를 썼다면 용어집에 추가했는가?
[ ] 비즈니스 규칙 위반은 DomainException으로 처리했는가?
```

---

## 7. 안티패턴

### Anemic Domain Model — 가장 흔한 문제

규칙이 Entity 밖으로 새는 패턴. 코드베이스가 커질수록 규칙 추적이 불가능해집니다.

```typescript
// ❌ Entity가 데이터 홀더만 됨
class Order {
  status: string;
  setStatus(s: string) { this.status = s; }
}

// 규칙이 여기저기 흩어짐
class OrderService {
  confirm(order: Order) {
    if (order.items.length === 0) throw new Error('...');  // 규칙이 서비스에
    order.setStatus('CONFIRMED');
  }
}
class OrderController {
  confirm(req) {
    if (!req.user.isVerified) throw new Error('...');  // 규칙이 컨트롤러에도
    this.orderService.confirm(...);
  }
}
```

```typescript
// ✅ 규칙이 Entity 안에
class Order {
  confirm(): void {
    if (this.items.length === 0) throw new DomainException('주문 항목이 없습니다.', 'EMPTY_ITEMS');
    this.status = OrderStatus.CONFIRMED;
  }
}
```

---

### Infrastructure가 Domain을 오염시키는 패턴

NestJS + TypeORM 환경에서 가장 흔하게 발생합니다. TypeORM Entity를 도메인 Entity로 그대로 쓰는 경우입니다.

```typescript
// ❌ 도메인 Entity에 TypeORM 어노테이션이 들어옴
import { Entity, Column } from 'typeorm'; // infrastructure 의존성 침투

@Entity('orders')
export class Order {
  @Column()
  status: string; // 도메인 규칙도 없고, ORM도 섞임
}
```

```typescript
// ✅ 도메인 Entity와 ORM Entity 분리

// domain/order.entity.ts — 순수
export class Order {
  private constructor(
    readonly id: string,
    private status: OrderStatus,
    private items: OrderItem[]
  ) {}

  static reconstitute(props: { id: string; status: OrderStatus; items: OrderItem[] }): Order {
    return new Order(props.id, props.status, props.items);
  }

  confirm(): void {
    if (this.items.length === 0) throw new DomainException('주문 항목이 없습니다.', 'EMPTY_ITEMS');
    this.status = OrderStatus.CONFIRMED;
  }
}

// infrastructure/order.orm-entity.ts — TypeORM 전용
@Entity('orders')
export class OrderOrm {
  @PrimaryColumn()
  id: string;

  @Column()
  status: string;
}
```

---

### 레이어 건너뛰기

```typescript
// ❌ Controller에서 TypeORM Repository 직접 주입
@Controller('orders')
export class OrderController {
  constructor(
    @InjectRepository(OrderOrm)
    private readonly ormRepo: Repository<OrderOrm> // 레이어 건너뜀
  ) {}

  @Post(':id/confirm')
  async confirm(@Param('id') id: string) {
    const orm = await this.ormRepo.findOne({ where: { id } });
    orm.status = 'CONFIRMED'; // 도메인 규칙 없이 직접 변경
    await this.ormRepo.save(orm);
  }
}
```

```typescript
// ✅ Application Service 경유
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post(':id/confirm')
  async confirm(@Param('id') id: string) {
    await this.orderService.confirmOrder(id);
  }
}
```

---

## 8. 확장 시점

지금 구조에서 다음 신호가 보이면 해당 패턴을 검토합니다.

| 신호                                    | 검토할 것                    |
| --------------------------------------- | ---------------------------- |
| Application Service 메서드가 15개 이상  | 도메인별 서비스 분리         |
| 도메인 모델을 두 사람이 독립적으로 변경 | Bounded Context 분리         |
| 조회 DTO가 도메인 모델과 많이 달라짐    | CQRS (Query Side 분리)       |
| 후속 처리가 5개 이상, 실패 재시도 필요  | Domain Event + EventBus      |
| 서비스가 물리적으로 분리되어야 함       | 마이크로서비스 + Context Map |

**원칙: 신호가 없으면 확장하지 않습니다.**
구조를 미리 만들어 두면 유지 비용만 늘어납니다.

---

## 9. 용어집

> 코드·문서·대화에서 동일하게 사용합니다.
> 새 용어 합의 후 PR에 이 표 업데이트를 포함합니다.

| 도메인 용어 | 설명                                   | 코드 표현                  |
| ----------- | -------------------------------------- | -------------------------- |
| 평가        | 조직 역량 평가 단위                    | `Evaluation`               |
| 평가 참여자 | 평가에 소속된 사용자                   | `EvaluationParticipant`    |
| 평가 배정   | 평가자-피평가자 쌍                     | `EvaluationAssignment`     |
| 응답        | 개별 문항에 대한 점수 입력             | `Response`                 |
| 측정 영역   | 평가 대분류 영역                       | `MeasurementArea`          |
| 역량        | 측정 영역 하위 중분류                  | `Competency`               |
| 문항        | 평가 항목 (점수 입력 단위)             | `Question`                 |
| 가중치      | 평가 유형별 반영 비율                  | `Weight`                   |
| 가중치 예외 | 개인/부서별 가중치 재정의              | `WeightException`          |
| 결과 스냅샷 | 완료된 평가의 결과 고정본              | `EvaluationResultSnapshot` |
| 부서        | 조직 트리 구조 단위                    | `Department`               |
| 평가 상태   | draft → active → completed / cancelled | `EvaluationStatus`         |

---

## 참고 자료

- Vlad Khononov — _Learning Domain-Driven Design_ (소규모 팀 입문으로 적합)
- Eric Evans — _Domain-Driven Design_ (레퍼런스용)
- [DDD Reference](https://domainlanguage.com/ddd/reference/) — Evans 공식 요약본

---

_문의: 팀 채널 또는 직접 대화_
