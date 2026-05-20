# 랜딩 리디자인 — 개발자 핸드오프

> designer → 주니어 FE 개발자. 이 문서만 보고 `apps/web/app/page.tsx` + `LandingNav.tsx` 를 구현 가능하도록.
> 대상 방향: **방향 A-라이트 확정** — A 의 레이아웃/구조/에셋 활용(마스코트 전면, `cat-group` Hero 배너, 기능 카드 lucide 아이콘+고양이 일러스트, Setup 안내냥, CTA 환호냥, 비활동 자는냥)은 **그대로 유지**하되, **무드는 기존 라이트 테마를 유지**한다. A 제안서의 다크 블러플 무드(#1e1f2e 다크 배경/다크 섹션 전환)는 **폐기**됨.
> 결정 근거: 나머지 페이지가 전부 라이트 테마라 랜딩만 다크면 일관성이 깨진다. A 의 가치는 "다크 리컬러"가 아니라 **레이아웃 재구성 + 마스코트 전면화 + 새 고양이 에셋 + lucide 아이콘 + 섹션 리듬**이므로 라이트 톤에서도 그대로 유효하다.
> 토큰: 기존 라이트 테마 토큰(현행 `globals.css` / `tailwind.config.ts` — 흰/연한 배경 + indigo 액센트)을 **그대로 유지**. 신규 다크 팔레트 도입 없음 → 디자인 토큰 파괴적 변경 HITL **불필요**.
>
> **에셋 갱신 (2026-05-20)**: 고양이 일러스트가 전면 교체되었다. 옛 `01_scene.png` / `03_cat_newmember.png` / `07_cat_plain.png` 와 객체 아이콘 PNG 5종(`icon_*.png`)은 **모두 삭제**되었고, 마스코트 화풍의 새 고양이 7종(`cat-*.png`)으로 대체되었다. 기능 카드 아이콘은 **lucide-react 컴포넌트**로 확정 대체. 본 문서는 새 상태 기준으로 갱신됨. 옛 파일명 참조는 더 이상 유효하지 않다.

---

## 0. 가장 먼저 — placeholder 제거 (방향 무관 공통, 즉시 효과)

현재 `page.tsx` 는 실제 에셋 경로를 `FEATURE_BLOCKS` 에 정의해놓고도 **점선박스만 렌더**한다. 이것만 고쳐도 절반은 끝난다.

| 위치 | 현재 (제거 대상) | 교체 |
|---|---|---|
| `HeroSection` 우측 | `<div ... border-dashed>Hero Image</div>` | `<Image src="/brand/img_onyu_cat.png" ... />` (마스코트) |
| `FeatureItem` 이미지 컬럼 | `<div ... border-dashed>{isIllustration ? 'Illustration' : 'Icon'}</div>` | 아이콘: **lucide 컴포넌트** `<block.icon className=... />` (§2-b) / 일러스트 동반 카드(newbie·inactiveMember): `<Image src="/landing/cat-flag.png" />` 등 |
| `CtaBandSection` | `<div ... border-dashed>CTA Image</div>` | `<Image src="/landing/cat-cheer.png" ... />` (환호 고양이) |

> `next/image` 사용 시 외부가 아닌 로컬 PNG 이므로 `unoptimized` 는 선택. `width`/`height` 명시 필수(레이아웃 시프트 방지).
> ⚠️ **배경 누끼 주의 (라이트 기준 재평가)**: 흰 배경 컷(`cat-flag / cat-wave / cat-cheer / cat-sleeping`)은 **흰/연한 라이트 섹션 위에선 자연스럽게 섞여 누끼 부담이 크게 줄어든다**. 단 **색 배경 위에 얹는 자리**에선 여전히 누끼 필요(① 컬러풀 그라데이션 CTA 밴드 위 `cat-cheer`, ② 액센트색 아이콘 박스 안 고양이 일러스트). 또한 `cat-group`(어두운 비네팅)은 라이트 레이아웃에서 가장 이질적이라 별도 처리 필요. 자리별 정리는 §11 참조.

---

## 1. 화면 / 진입 경로

| 화면 | URL | 진입 | 파일 |
|---|---|---|---|
| 랜딩 | `/` | 루트 | `apps/web/app/page.tsx` (server component) |
| 네비 | `/` 상단 fixed | — | `apps/web/app/components/LandingNav.tsx` (`'use client'`) |

---

## 2. 사용 에셋 (2026-05-20 전면 교체 반영)

### 2-a. 고양이 일러스트 PNG (전부 실재 확인됨 — `apps/web/public/`)

> 전부 브랜드 마스코트(`img_onyu_cat.png`) 화풍으로 ChatGPT 재생성. 6지 키메라 없음.

| 경로 | 내용 | 용도 (방향 A) | 권장 크기 | 배경 |
|---|---|---|---|---|
| `/brand/img_onyu_cat.png` | 둥근 그레이 새끼고양이 (마스코트) | Hero 주인공 + nav/footer 로고 | hero 180~220 / nav 40 | 흰 (라이트 위 OK) |
| `/landing/cat-group.png` | 4마리(크림·그레이·주황·턱시도) 모임 + 말풍선 | ⭐ Hero 하단 풀블리드 배너 (옛 `01_scene` 대체) | width 100%, height auto | 어두운 비네팅 ❓라이트서 처리 |
| `/landing/cat-flag.png` | 분홍 펜넌트 깃발 든 고양이 (글씨 없음) | 신규멤버 기능 일러스트 (옛 `03_cat_newmember` 대체) | 96~120 | 흰 (흰 카드 본문 위 OK) |
| `/landing/cat-wave.png` | 한 발 흔드는 안내 고양이 | Setup "안내냥" (옛 `07_cat_plain` 대체) | 120~160 | 흰 (라이트 섹션 위 OK) |
| `/landing/cat-cheer.png` | 두 발 들고 환호 + 컨페티 | CTA 밴드 (옛 `07_cat_plain` 대체) | 120~160 | 흰 🔴 컬러밴드 위 누끼 |
| `/landing/cat-sleeping.png` | 웅크려 자는 고양이 +zZ | 비활동회원 일러스트 (lucide `Moon` 과 병행 가능) | 96~120 | 흰 (흰 카드 본문 위 OK) |
| `/landing/cat-wave-sitting.png` | 앉아서 한 발 든 고양이 | 예비/장식 (cat-wave 대안) | — | 투명 |
| `/landing/cat-mug.png` | 앉아서 하트 머그컵 든 고양이 | 예비/장식 (계획 외 보너스) | — | 투명 |

> 라이트 기준: 흰 배경 컷은 **흰/연한 섹션·흰 카드 본문 위에선 누끼 불필요**. **색 배경(CTA 그라데이션 / 액센트 박스) 위**에서만 누끼 필요. `cat-group`(어두운 비네팅)은 라이트 레이아웃에서 별도 처리. 자리별 정리 §11 참조.

### 2-b. 기능 카드 아이콘 → lucide-react 매핑 (확정 — PNG 아이콘 폐기)

> 옛 `icon_*.png` 5종은 **전부 삭제**되었다. 기능 카드 아이콘은 `lucide-react@0.562.0`(이미 설치/사용 중) 컴포넌트로 렌더한다. 아래 아이콘은 전부 존재 검증됨.

| 기능 (`FEATURE_BLOCKS` key) | lucide 아이콘 (import 명) | 대안 |
|---|---|---|
| 음성 통계 `voiceStats` | `TrendingUp` | `BarChart3`, `LineChart` |
| 자동 채널 `autoChannel` | `Mic` | — |
| AI 분석 `gemini` | `Sparkles` | `Zap` |
| 신규 멤버 `newbie` | `UserPlus` | — |
| 웹 대시보드 `dashboard` | `LayoutDashboard` | — |
| 비활동 회원 `inactiveMember` | `Moon` | `UserMinus`, `BedDouble` |

> 이로써 옛 `icon_settings.png` 중복(dashboard·inactiveMember 공유) 문제는 **자연 해소**됨 (§6).

### 2-c. FEATURE_BLOCKS 구조 변경 노트 (구현 시 필수)

현재 `FEATURE_BLOCKS` 는 아이콘을 **문자열 경로**(`icon: '/landing/icon_trend.png'`)로 들고 있다. 이를 **lucide 컴포넌트 참조**로 교체해야 한다.

```tsx
import { TrendingUp, Mic, Sparkles, UserPlus, LayoutDashboard, Moon, type LucideIcon } from 'lucide-react';

const FEATURE_BLOCKS = [
  { key: 'voiceStats',      icon: TrendingUp,      accent: 'indigo',  illustration: null },
  { key: 'autoChannel',     icon: Mic,             accent: 'blue',    illustration: null },
  { key: 'gemini',          icon: Sparkles,        accent: 'purple',  illustration: null },
  { key: 'newbie',          icon: UserPlus,        accent: 'green',   illustration: '/landing/cat-flag.png' },
  { key: 'dashboard',       icon: LayoutDashboard, accent: 'yellow',  illustration: null },
  { key: 'inactiveMember',  icon: Moon,            accent: 'pink',    illustration: '/landing/cat-sleeping.png' },
] satisfies ReadonlyArray<{ key: string; icon: LucideIcon; accent: string; illustration: string | null }>;
```

렌더 시 (카드 헤더 아이콘):
```tsx
<div className={`inline-flex rounded-2xl p-3 ${accent.iconBg}`}>
  <block.icon className={`h-6 w-6 ${accent.text}`} aria-hidden />
</div>
```
- `block.icon` 은 **컴포넌트**이므로 `<Image>` 가 아니라 JSX 엘리먼트로 렌더. 대문자 변수로 받아 `<block.icon .../>` 형태.
- 색은 §3 / `ACCENT_CLASSES` 의 `text`(예: `text-indigo-400`)를 `className` 으로 전달 — 별도 색 정의 X.
- `newbie` / `inactiveMember` 는 lucide 아이콘 + (선택) `illustration` 고양이를 카드 본문에 병행 노출 가능.

---

## 3. 디자인 토큰 매핑 (방향 A-라이트 — 기존 라이트 테마 유지)

> ✅ 기존 라이트 토큰을 **그대로 사용** — 신규 토큰/팔레트 추가 없음 → 디자인 토큰 파괴적 변경 HITL 불필요. 색은 현행 `globals.css` / `tailwind.config.ts` + Tailwind 기본 팔레트로 충분.

| 의미 | Tailwind 클래스 | raw |
|---|---|---|
| 페이지 배경 | **현행 유지** `bg-gradient-to-b from-indigo-50 via-white to-sky-50` | 흰/연한 그라데이션 |
| 카드 서피스 | `bg-white` | #FFFFFF |
| 카드 보더 | `border border-gray-100` (또는 `border-gray-200`) | 연한 그레이 |
| 브랜드 액센트 | `bg-indigo-600` / `text-indigo-600` (현행 액센트 유지) | indigo |
| 따뜻한 보조 액센트 | `text-amber-700` / `bg-amber-100` | amber (라이트용) |
| 텍스트 주 | `text-gray-900` | #111827 |
| 텍스트 보조 | `text-gray-600` | #4B5563 |
| 성공 | `text-green-600` / `text-discord-green` | — |
| 카드 부양 shadow | `shadow-sm` → hover `shadow-lg` (또는 `shadow-[0_8px_30px_rgba(99,102,241,0.12)]` indigo glow) | — |
| 카드 radius | `rounded-2xl` / `rounded-3xl` | 16/24px |
| 버튼 radius | `rounded-full` (🟨 #3) | pill |

> 라이트 테마 유지가 핵심. `discord-blurple`(#5865F2)은 CTA 밴드 그라데이션 등 강조 포인트에만 선택적으로 쓸 수 있으나, 페이지 기본 액센트는 **현행 indigo** 를 유지해 사이트 전체와 일관. amber/회색/green 은 Tailwind 기본 팔레트.
> ⚠️ 다크용이던 `text-{c}-400` / `bg-{c}-500/15` / `text-[#F1F2F5]` / `text-[#A3A6B4]` / `border-white/10` 류 className 은 **사용하지 않는다**. 라이트 등가(`text-{c}-600` / `bg-{c}-100` / `text-gray-900` / `text-gray-600` / `border-gray-100`)로 대체.

---

## 4. 컴포넌트 변경 요약

| 컴포넌트 | 조치 | 비고 |
|---|---|---|
| `HeroSection` | 구조 개편 — placeholder→마스코트, badge 추가, scene 배너 | §5.1 |
| `FeatureItem` | **삭제 후 `FeatureCard` 로 교체** | 좌우교차→카드그리드. §5.2 |
| `FeaturesSection` | 대표 1 split + 그리드 5 로 리듬 부여 | §5.2 |
| `SetupCards` | 거의 유지 + 안내 고양이 추가(선택) | §5.3 |
| `CtaBandSection` | placeholder→마스코트 | §5.4 |
| `LandingNav` | **현행 라이트 유지** — 변경 없음 (`bg-transparent`→스크롤 시 `bg-white/90`) | §5.5 |
| `LandingFooter` | **현행 라이트 유지**, 링크 유지 | 변경 없음 |
| (신규) `FloatingMascot` | 선택 — floating 모션 wrapper (CSS만이면 불필요) | §5.1 |
| (신규) `RevealOnScroll` | 선택 🟨 #7 — `'use client'` IntersectionObserver wrapper | 미승인 시 생략 |

---

## 5. 섹션별 구현 가이드

### 5.1 HeroSection

**현재 문제**: h1 이 `<Image 96/> + Onyu` 한 줄 flex (320px 넘침 위험), 가치제안이 작은 본문, placeholder, badge 미노출.

**새 구조 (트리)**
```
<section> (px-4 sm:px-6 lg:px-8, pt-24 pb-0, max-w-7xl mx-auto)
├── <div grid md:grid-cols-2 gap-12 items-center>
│   ├── <div text-center md:text-left>   (텍스트 컬럼)
│   │   ├── <span badge>  ✦ {후킹 문구} ✦   ← amber, 신규 노출 (무료 문구 사용 안 함 — §8)
│   │   ├── <h1>  음성 채널이 살아있는 디스코드 서버  ← 가치제안. 🟨 카피는 §8 참조
│   │   ├── <p>   {t('hero.description')}
│   │   └── <HeroCta>  (pill 버튼, blurple)
│   └── <div flex justify-center md:justify-end>  (마스코트 컬럼)
│       └── <Image src="/brand/img_onyu_cat.png" width={220} height={220}
│             className="animate-[float_4s_ease-in-out_infinite] motion-reduce:animate-none drop-shadow-2xl" />
└── <div>  scene 풀블리드 배너 (섹션 하단, 좌우 패딩 없이 풀폭)
    └── <Image src="/landing/cat-group.png" className="w-full h-auto" alt="음성 채널에 모인 고양이들" />
```
> ⚠️ `cat-group` 은 **어두운 비네팅 배경**이라 **라이트 레이아웃에서 가장 이질적**이다. Hero 배너로 쓰려면 (a) 누끼 후 라이트 배경에 합성 / (b) 라이트·투명으로 재생성 / (c) 의도된 어두운 라운드 카드 안에 컨테인(`rounded-3xl` + 어두운 매트로 감싸 "밤하늘 모임" 의도된 카드처럼) 중 택1. → ❓ **미정**. §11 참조.

**핵심 className (라이트)**
- 로고를 h1 밖으로 분리 (마스코트는 우측 컬럼으로 이동 → h1 은 텍스트만).
- badge: `inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold mb-5`
- h1: `text-4xl md:text-6xl font-extrabold leading-tight tracking-tight text-gray-900 mb-5`
- 본문: `text-base md:text-lg text-gray-600 mb-8`
- 마스코트 floating keyframe — `globals.css` 에 추가:
  ```css
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
  ```

**HeroCta 버튼 (pill, 현행 indigo 액센트 유지)**
- 1차: `inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white rounded-full hover:brightness-110 hover:scale-[1.02] active:scale-95 transition font-semibold text-lg focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2` (라이트 배경이라 `ring-offset` 기본 흰색 OK)
- 2차(ghost): `rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50`

### 5.2 FeaturesSection — 대표 1 + 그리드 5

`FeatureItem`(좌우교차) 삭제 → `FeatureCard`(라이트 흰 카드) 신설.

**대표 카드(예: voiceStats)** — 풀폭 split 1개:
```
<div grid md:grid-cols-2 gap-8 items-center bg-white rounded-3xl p-6 md:p-10 border border-gray-100 shadow-sm>
├── (lucide) <TrendingUp className="h-10 w-10 text-indigo-600" /> + 텍스트
└── (선택) 미니 차트 목업 div
```

**나머지 5개 그리드**:
```
<div grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6>
  └── <FeatureCard> × 5
       ├── 아이콘 박스: <div bg-{accent}-100 rounded-2xl p-3 inline-flex>
       │            <block.icon className="h-6 w-6 text-{accent}-600" aria-hidden />
       │            (lucide 컴포넌트 — §2-b/§2-c. 문자열 경로 아님)
       │            (newbie 는 cat-flag, inactiveMember 는 cat-sleeping 일러스트 추가 노출 가능)
       │            ⚠️ 고양이 일러스트를 액센트색 박스(bg-{c}-100) "안"에 넣을 경우 흰 배경 컷은 누끼 필요(§11). 카드 본문 흰 영역에 별도로 놓으면 누끼 불필요.
       ├── <h3 text-xl font-bold text-gray-900>{t(`features.${key}.title`)}</h3>
       ├── <p text-{accent}-600 text-sm font-medium>{...description}</p>
       └── <p text-gray-600>{...detail}</p>
```
- 카드 공통: `bg-white rounded-2xl p-6 border border-gray-100 shadow-sm transition hover:-translate-y-1 hover:shadow-lg motion-reduce:hover:translate-y-0`
- `ACCENT_CLASSES` 는 **현행 파스텔 라이트 매핑 유지**: `iconBg` → `bg-{c}-100`, `text` → `text-{c}-600`. (safelist 회피 위해 기존처럼 정적 매핑 유지 — 동적 클래스 금지.)

### 5.3 SetupSection

거의 유지(현행 라이트 톤 그대로). + (선택) `cat-wave.png` 안내 고양이("안내냥")를 섹션 헤더 옆 작게.
- step 카드 배경: **현행 흰/연한 카드 유지** / step2 강조는 amber 유지(현행 `border-amber-300 bg-amber-50` 등 라이트 톤).
- 연결선: **현행 `bg-gray-300` 유지**.
- ✅ 안내 고양이(`cat-wave`)는 흰 배경 컷이지만 **흰/연한 Setup 섹션 위에 놓으면 누끼 부담 거의 없음**(라이트의 이점, §11).

### 5.4 CtaBandSection

- 밴드 배경: **현행 컬러풀 그라데이션 유지** (`from-indigo-600 via-purple-600 to-pink-500` 등 현행 톤). 라이트 페이지 안에서도 이 밴드는 강조 포인트로 **유지 가능**(다크 전환 아님 — 라이트 페이지의 단일 컬러 액센트 밴드).
- placeholder div → `<Image src="/landing/cat-cheer.png" width={160} height={160} alt="환호하는 Onyu 고양이" />` (환호+컨페티 컷이 CTA 무드에 적합).
- ⚠️ `cat-cheer`(흰 배경)를 **컬러풀 그라데이션 밴드 위**에 직접 얹으면 흰 네모가 보인다 → 이 자리에선 **누끼 필요**(§11. 라이트 페이지지만 색 배경 위라 예외).
- 모바일: 마스코트를 텍스트 **아래**로 (현재 `order-first` 제거).
- badge 로 `5분이면 끝` 등 비-무료 후킹 강조 (무료 문구 제외 — §8).

### 5.5 LandingNav (현행 라이트 유지 — 변경 없음)

- ✅ **현행 그대로 유지**. `isScrolled` false → `bg-transparent`, true → `bg-white/90 backdrop-blur-sm border-b shadow-sm`.
- `NAV_LINK_CLASS` (`text-gray-700 hover:text-indigo-600`) / `LOGIN_BTN_CLASS` (`bg-indigo-600`) 모두 **변경 없음**.
- `Home` 루트 `<div>` 배경도 **현행 라이트 그라데이션 유지** (다크 전환 폐기). nav 변경 불필요.

---

## 6. 아이콘 중복 처리 — ✅ lucide 로 해소됨 (2026-05-20)

옛 상태: `dashboard` 와 `inactiveMember` 가 둘 다 `icon_settings.png` 를 공유해 시각 변별이 없었다.
**현재**: 아이콘 PNG 5종 전부 삭제 + 기능 카드 아이콘을 **lucide-react 컴포넌트**로 확정 대체 (§2-b). dashboard=`LayoutDashboard`, inactiveMember=`Moon` 으로 **서로 다른 아이콘** → 중복 자연 해소. 추가 발주/에셋 없음.
- 색은 accent 로 `className="text-{c}-600"`(라이트). 동적 클래스 금지(safelist 회피) → §5.2 정적 매핑 유지.

---

## 7. 톤 결정 — A-라이트 확정 (참고: 폐기된 다크 옵션)

본 핸드오프는 이미 **A-라이트(A 구조 + 라이트 톤)** 기준으로 §3~§5 가 작성되어 있다. 별도 분기 불필요.

| 항목 | A-라이트 (확정) | (폐기됨) A-다크 초기 제안 |
|---|---|---|
| 페이지 배경 | `from-indigo-50 via-white to-sky-50` (현행) | ~~`bg-[#1e1f2e]` 다크~~ |
| 카드 | 흰 카드 `bg-white` + 현행 `ACCENT_CLASSES`(파스텔 `bg-{c}-100`/`text-{c}-600`) | ~~`bg-[#2b2d3a]` + `text-{c}-400`~~ |
| 텍스트 | `text-gray-900 / text-gray-600` (현행) | ~~`text-[#F1F2F5] / text-[#A3A6B4]`~~ |
| Nav / Footer | **현행 유지** — 변경 없음 | ~~다크 톤 전환~~ |
| 토큰 | 신규 토큰 추가 없음 → 디자인 토큰 HITL **불필요** | ~~랜딩 전용 다크 팔레트(🔴)~~ |
| A 의 핵심 가치(유지) | 레이아웃 재구성 + 마스코트 전면화 + 새 고양이 7종 에셋 + lucide 아이콘 + 섹션 리듬 | (좌동 — 다크는 가치 아님) |
> **A 의 레이아웃/구조/에셋은 그대로, 무드만 라이트.** 다크 전환·blurple 베이스·랜딩 전용 다크 팔레트는 전부 폐기.

---

## 8. 카피 (i18n) 검토

- ⚠️ **'무료' 류 문구는 사용하지 않는다 (2026-05-21 결정).** 기존 i18n `hero.badge`("완전 무료")는 **노출하지 않는다.** 배지를 쓰려면 비-무료 후킹(예: "5분이면 끝")으로 **카피를 교체**해야 함 → `libs/i18n/locales/{ko,en}/web/landing.json` 의 `hero.badge` 값을 비-무료 문구로 변경(ko/en 동반). 미정 시 배지 자체를 생략해도 됨.
- 🟨 Hero h1 가치제안 카피("음성 채널이 살아있는…")는 **신규 제안** — 현재 i18n 엔 hero.description 만 있음. 새 키 `hero.headline` 추가 필요 시 `libs/i18n/locales/{ko,en}/web/landing.json` 양쪽 수정 (en 번역 동반). 미승인 시 기존 description 을 h1 로 승격해도 됨.
- 그 외 카피 전부 기존 키 재사용 — 신규 번역 부담 최소.

---

## 9. 반응형 / 접근성 체크리스트

- [ ] 320px: Hero h1 줄바꿈 정상(로고 분리됨), 버튼 풀폭, 마스코트 140px
- [ ] md(768): Hero 2단 split, 기능 카드 2열
- [ ] lg(1024): 기능 카드 3열, scene 풀폭 배너, `max-w-7xl mx-auto`
- [ ] skip link 유지
- [ ] 모든 `<Image>` 에 의미있는 `alt` (마스코트="Onyu 마스코트 고양이", `cat-group`="음성 채널에 모인 고양이들"). lucide 아이콘은 텍스트 라벨이 동반되므로 `aria-hidden`
- [ ] `focus-visible:ring` 라이트 배경 기준 — `ring-offset-2` (offset 기본 흰색) 그대로. 별도 다크 offset 불필요
- [ ] `motion-reduce:animate-none` 모든 모션에 부착
- [ ] 라이트 대비비: 본문 `text-gray-600`(#4B5563) on 흰/연한 배경 ≈ 7:1 (AA 통과). 액센트 텍스트는 `*-600` 사용(라이트 배경 위 대비 충분)

---

## 10. 구현 순서 권장

1. §0 placeholder → 실제 에셋 (즉시 PR 가능).
2. Hero 마스코트 키우기 + badge + pill (라이트 톤 유지).
3. 기능 카드 그리드화 (`FeatureItem`→`FeatureCard`, 흰 카드).
4. (다크 톤 전환 단계 폐기 — 라이트 유지. nav/배경/카드/footer 변경 없음.)
5. floating/hover 모션 + reduced-motion.
6. 아이콘 중복 해결 — lucide 로 이미 확정(§2-b/§6). `FEATURE_BLOCKS` 의 문자열 경로 → lucide 컴포넌트 참조로 교체(§2-c).
7. 색 배경 위 고양이 컷만 누끼(§11) — CTA 밴드 위 `cat-cheer`, 액센트 박스 안 일러스트, `cat-group`(다크 비네팅) 처리. 흰 섹션 위 컷은 누끼 불필요.
8. lint: `pnpm --filter @onyu/web lint` 통과 확인.

---

## 11. 배경 누끼 caveat (라이트 기준 재평가 — 2026-05-21)

방향 A-라이트 확정으로 누끼 부담이 **뒤집혔다**. 라이트 페이지에선 **흰 배경 컷이 흰/연한 섹션에 자연스럽게 섞여** 누끼 부담이 크게 줄고, 오히려 **색 배경 위 자리**와 **다크 비네팅 `cat-group`** 이 새 과제다.

### 11-1. 자리별 누끼 필요/불필요 (라이트 기준)

| 컷 | 컷 배경 | 놓이는 자리 | 자리 배경 | 누끼? |
|---|---|---|---|---|
| `img_onyu_cat` | 흰 | Hero 우측 / nav·footer 로고 | 흰/연한 그라데이션 | ❌ 불필요 |
| `cat-wave` | 흰 | Setup 안내냥 | 흰/연한 섹션 | ❌ 불필요 |
| `cat-flag` | 흰 | newbie 카드 **본문 흰 영역** | 흰 카드 | ❌ 불필요 |
| `cat-flag` | 흰 | newbie 카드 **액센트 박스 안**(`bg-{c}-100`) | 연한 색 박스 | ⚠️ 필요(또는 본문 흰 영역에 배치로 회피) |
| `cat-sleeping` | 흰 | inactiveMember 카드 **본문 흰 영역** | 흰 카드 | ❌ 불필요 |
| `cat-sleeping` | 흰 | inactiveMember **액센트 박스 안** | 연한 색 박스 | ⚠️ 필요(또는 본문 배치로 회피) |
| `cat-cheer` | 흰 | **CTA 밴드 위**(컬러풀 그라데이션 indigo→purple→pink) | 진한 컬러 | 🔴 **필요** (가장 두드러짐) |
| `cat-group` | **어두운 비네팅** | Hero 하단 풀블리드 배너 | 라이트 Hero | ❓ **별도 처리**(11-3) |
| `cat-mug`, `cat-wave-sitting` | 투명 | 어디든 | — | ❌ 불필요 |

> 요약: **흰 섹션·흰 카드 본문 위 = 누끼 불필요**(라이트의 이점). **색 배경(CTA 그라데이션 / 액센트 박스) 위 = 누끼 필요**. 액센트 박스 자리는 고양이를 **카드 본문 흰 영역으로 옮기면** 누끼 자체를 회피 가능(권장).

### 11-2. CTA 밴드 위 `cat-cheer` 처리 (택1)
- (a) **누끼 후 덮어쓰기**: remove.bg / Photoshop 으로 배경 제거 → 동일 파일명 덮어쓰기 → 코드 변경 없음. (권장 — 컬러 밴드 위 자연스러움)
- (b) **흰 라운드 컨테이너**: `bg-white rounded-2xl p-3` 안에 담아 의도된 카드처럼 노출(누끼 생략 가능). 단 밴드 위 흰 카드가 다소 무거워 보일 수 있음.

### 11-3. `cat-group`(다크 비네팅) — 라이트 레이아웃 처리 ❓미정 (신규 핵심 과제)
라이트 확정으로 `cat-group` 의 어두운 비네팅 배경이 **이제 가장 이질적**이다(다크였을 땐 자연스러웠음). Hero 풀블리드 배너로 쓰려면 택1:
- (a) **누끼 후 라이트 배경 합성**: 어두운 비네팅 제거 → 투명/라이트 배경으로 저장. 고양이 4마리만 라이트 Hero 위에 자연스럽게 얹힘. (가장 톤 일관)
- (b) **라이트/투명으로 재생성**: AI 프롬프트에서 "어두운 배경" 지시 제거하고 투명/라이트 배경으로 재생성(ai-prompts §2-1 참조 — 본래 투명 의도였으나 어두운 비네팅으로 생성됨).
- (c) **의도된 어두운 라운드 카드로 컨테인**: `rounded-3xl` 어두운 매트 안에 담아 "밤하늘 음성 채널 모임" 의도된 단일 어두운 카드로 연출(라이트 페이지 안 1개의 의도적 다크 카드). 누끼 불필요하나 톤 통일감은 (a)/(b)보다 약함.
> ❓ **미정**: (a)/(b)/(c) 중 택1 — 디자인/FE 협의 필요. 보고서 HITL 누끼 항목과 연동.
