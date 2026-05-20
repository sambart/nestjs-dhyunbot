# Onyu 랜딩 — 고양이 에셋 AI 생성 프롬프트 (ChatGPT / GPT-4o·DALL·E 용)

> 목적: `img_onyu_cat.png`(브랜드 마스코트) 화풍을 **기준(레퍼런스)**으로, 나머지 고양이 에셋을 전부 동일 화풍으로 ChatGPT에서 재생성한다.
> 대상 방향: 랜딩 리디자인 방향 A("고양이 마을"). 참고: [landing-redesign-report.md](./landing-redesign-report.md) · [landing-redesign-handoff.md](./landing-redesign-handoff.md)
> 작성일: 2026-05-20 · 도구: ChatGPT (GPT-4o 이미지 생성 / DALL·E)

---

## ✅ 생성 완료 (2026-05-20)

본 프롬프트로 고양이 에셋이 **생성·리네임 완료**되었다. `apps/web/public/landing/` 에 마스코트 화풍 7종이 배치됨. 아래 프롬프트 본문(영문 생성 지시)은 **향후 재생성용으로 보존**한다. 단 옛 타깃 파일명(`01_scene.png` 등)은 더 이상 사용하지 않으니, 실제 생성된 파일명으로 매핑해 참고할 것.

### 옛 타깃 파일명 → 실제 생성/리네임된 파일명

| 프롬프트 항목 (옛 타깃) | 실제 파일명 (현재) | 내용 | 배경 |
|---|---|---|---|
| §2-1 `01_scene.png` | `cat-group.png` | 4마리(크림·그레이·주황·턱시도) 모임 + 말풍선 | 어두운 비네팅 |
| §2-2 `03_cat_newmember.png` | `cat-flag.png` | 분홍 펜넌트 깃발 든 고양이 (글씨 없음) | 흰 ⚠️누끼 |
| §2-3 `07_cat_plain.png` (Setup) | `cat-wave.png` | 한 발 흔드는 안내 고양이 | 흰 ⚠️누끼 |
| §2-3 `07_cat_plain.png` (CTA) → 분리 | `cat-cheer.png` | 두 발 들고 환호 + 컨페티 (§3-2 프롬프트 기반) | 흰 ⚠️누끼 |
| §3-1 `cat_sleeping.png` | `cat-sleeping.png` | 웅크려 자는 고양이 +zZ | 흰 ⚠️누끼 |
| (계획 외 보너스) | `cat-wave-sitting.png` | 앉아서 한 발 든 고양이 (cat-wave 대안) | 투명 |
| (계획 외 보너스) | `cat-mug.png` | 앉아서 하트 머그컵 든 고양이 | 투명 |

> 변경점: ① 파일명을 의미있는 `cat-{내용}.png` 케밥케이스로 통일(옛 번호식 폐기). ② Setup/CTA 가 옛엔 `07_cat_plain` 1장 공유였으나 → `cat-wave`(Setup) / `cat-cheer`(CTA) **2장으로 분리**. ③ 보너스 2종(`cat-wave-sitting`, `cat-mug`) 추가 생성.
> ⚠️ **배경 caveat (라이트 기준 — 방향 A-라이트 확정 2026-05-21)**: 흰 배경 컷(`cat-flag/wave/cheer/sleeping`)은 **라이트 섹션·흰 카드 본문 위에선 누끼 부담↓**(자연스럽게 섞임). 단 **컬러 배경(CTA 그라데이션 / 액센트 박스) 위**에 얹는 자리에선 여전히 누끼 필요. 반대로 `cat-group`(어두운 비네팅)은 라이트 레이아웃에서 가장 이질적이라 처리 필요(누끼 후 라이트 합성 / 라이트·투명 재생성 / 어두운 카드 컨테인 택1). `cat-mug`/`cat-wave-sitting` 은 투명(어디든 OK). 자리별 정리·옵션은 handoff §11.
> 🔧 **코드 영향**: 파일명이 옛 번호식에서 바뀌었으므로 "동일 파일명 덮어쓰기 → 코드 변경 불필요" 전제는 더 이상 성립하지 않는다. `page.tsx`/`FEATURE_BLOCKS` 의 경로/아이콘 참조 갱신 필요(handoff §0·§2-c). + 기능 카드 객체 아이콘은 PNG 가 아니라 lucide-react 로 확정(handoff §2-b).

---

## 0. ChatGPT 사용 절차 (이대로 따라하면 됨)

1. **새 대화를 하나 열고, 맨 처음에 `img_onyu_cat.png`를 업로드**한다. 그리고 아래 한 줄을 먼저 보낸다:
   > "This uploaded grey kitten is my brand mascot **'Onyu'**. For every image I ask next, **keep the exact same art style, fur color, eye shape, blush, nose, and proportions as this reference.** Same character, different poses/scenes."
2. 그 다음, 아래 **각 에셋 프롬프트를 하나씩** 같은 대화 안에서 보낸다. (대화를 이어가야 캐릭터 일관성이 유지됨 — 새 대화로 바꾸면 화풍이 어긋난다.)
3. **투명 배경**이 필요하면 프롬프트 끝의 "transparent background" 지시를 유지. ChatGPT가 투명을 못 주면 → "pure white background" 로 다시 받은 뒤 누끼(배경 제거 도구/remove.bg).
4. **종횡비**는 자연어로 지시한다 (DALL·E는 `--ar` 플래그 없음). "wide landscape banner", "square", "portrait" 식.
5. 5(~7)종을 다 받은 뒤 **한 화면에 나란히 놓고** 눈색·볼터치·라인 굵기 일관성 검수. 어긋난 컷만 "regenerate, match the reference more closely" 로 재생성.
6. 파일명/경로: **새 케밥케이스 이름**으로 저장한다 — `apps/web/public/landing/cat-group.png`, `cat-flag.png`, `cat-wave.png`, `cat-cheer.png`, `cat-sleeping.png` (상단 매핑 표 참조). ⚠️ 옛 번호식(`01_scene.png` 등)은 폐기됨. 파일명이 바뀌었으므로 `page.tsx` 경로 참조 갱신 필요(handoff §0·§2-c).

> 💡 **ChatGPT 주의점**
> - 캐릭터 일관성이 Midjourney보다 약하다 → 매 요청마다 "same kitten as the reference" 를 꼭 반복.
> - **글자(텍스트)를 이미지에 못 그린다** → 깃발 글씨는 굽지 말고 비워서 받고, 앱에서 오버레이.
> - 한 컷에 고양이를 여러 마리 넣으면 개체별로 화풍이 흔들릴 수 있다 → `01_scene`은 안 되면 1마리씩 받아 합성하는 방법도 고려.

---

## 1. 공통 스타일 문장 (BASE STYLE — 매 프롬프트 앞에 붙이는 자연어 블록)

> DALL·E는 태그 나열보다 **흐르는 자연어 묘사**에 강하다. 아래 문단을 각 프롬프트 앞에 그대로 붙인다.

```
Draw in the exact same style as my uploaded reference: a soft digital-painted
children's storybook illustration with a cute kawaii chibi look — a big round head
on a small chubby body, soft airbrushed shading, gentle fluffy fur texture, and very
soft almost-lineless edges. Warm, cozy, wholesome mood.

The character is "Onyu", a fluffy round kitten with solid cool light-grey fur and a
slightly lighter chest and belly. It has very large round eyes with pale cream /
butter-yellow irises and big glossy dark pupils each with a tiny white highlight, a
tiny pink inverted-triangle nose, soft pink oval blush on both cheeks, a gentle happy
smile, and thin light whiskers. Keep it innocent and adorable, identical to the
reference character.

ANATOMY (very important): this kitten has a normal cat body with exactly FOUR limbs
total and ONE tail. It is NOT a six-limbed creature. When it makes a gesture, treat it
as an upright chibi mascot standing on its two hind legs and using its two front paws
as little arms — so there are exactly two arms and two legs (four limbs total) plus one
tail. Never draw four legs and a separate pair of arms at the same time. Every paw must
be clearly accounted for; no floating, duplicated, or extra limbs.

Please avoid: hard black cartoon outlines, a flat vector look, pixel art, a 3D render,
photorealism, tabby stripes (unless I ask), harsh shadows, busy backgrounds, baked-in
text, deformed eyes, or any watermark. The body must have the correct number of limbs.
```

> 🦴 **6지(다리4+팔2) 고양이 방지 — 핵심 룰**
> - 확산 모델은 "no extra limbs"(부정문)에 약하다. **개수를 긍정문으로 못 박아라.**
> - 동작 컷(깃발/손인사/환호) = "**이족(bipedal) 치비 마스코트**, 뒷다리 2 + 앞발(팔) 2, 사지 총 4". → 아래 2-2·2-3·3-2 프롬프트가 이렇게 작성됨.
> - 쉬는 컷(자기/모임) = "**네발 고양이, 네 발 모두 바닥에**". → 2-1·3-1.
> - 한 프롬프트 안에 "sitting cat" + "raising a paw to do a human action" 을 **동시에 쓰지 마라** (이게 6지의 주범).
> - 그래도 키메라가 나오면: ① 마릿수/디테일 줄이기, ② "full body, all paws visible, correct anatomy" 추가, ③ 생성 후 이미지 편집(inpaint)로 여분 다리 제거.

**색 가이드**: 기본 onyu = 쿨 그레이(`#9aa0aa`~`#c4c9d1`). 눈 = 크림/버터 옐로(`#f3e7b3`). 코·볼 = 소프트 핑크(`#f4a9b8`).

---

## 2. 에셋별 프롬프트

### 2-1. `cat-group.png` (옛 `01_scene.png`) — Hero 풀블리드 배너 ("고양이 마을 / 음성 채널에 모인 고양이들")

- **용도**: Hero 섹션 하단 가로 배너. 커뮤니티/보이스채널에 모인 느낌.
- **크기/비율**: **가로 와이드 배너 (약 3:1)**. 모바일에선 중앙이 크롭되니 **주요 고양이를 가로 중앙**에.
- **변경 핵심**: 기존 납작한 파랑·주황 젤리고양이 + 픽셀 숲 → 마스코트 화풍 아기고양이 여러 마리. 화풍은 동일하게, "멤버 다양성"은 **털색만 변주**(그레이=onyu 본체, 크림/주황/턱시도 블랙). 눈·볼·라인은 동일.

```
[BASE STYLE 문단 붙이기]

Now make a WIDE LANDSCAPE BANNER image (roughly 3:1, much wider than tall) of a cozy
little gathering: three or four Onyu-style kittens sitting close together on a soft
rounded grassy mound, as if hanging out together in a friendly voice-chat. The main
grey Onyu kitten is in the front center. The others use the SAME art style but
different fur colors — one cream/beige, one soft orange, one black tuxedo with a white
chest. They look happy, some glancing at each other with a gentle chatting vibe. Add a
few subtle floating chat bubbles or soft sparkles. Each kitten is a NORMAL FOUR-LEGGED
cat sitting naturally with all four paws on the ground and one tail — no upright arms,
no extra limbs. Keep the background clean and airy (no detailed scenery) so it works as
a hero banner, and place the group in the horizontal center. Transparent background.
```

> ⚠️ 다크 섹션 위에 얹을 거라 **고양이에 어두운 배경을 굽지 말고** 투명으로 받는다.

---

### 2-2. `cat-flag.png` (옛 `03_cat_newmember.png`) — 신규멤버 기능 카드 (깃발 든 고양이)

- **용도**: Features "신규사용자 관리" 카드.
- **크기/비율**: **약 4:3 (가로가 살짝 긴 형)**. 표시 96~120px.
- **변경 핵심**: 거친 스케치 → 마스코트 화풍. **깃발 글씨는 비운다**(다국어 오버레이용, DALL·E 텍스트 약함).

```
[BASE STYLE 문단 붙이기]

Now make a slightly-landscape image (roughly 4:3) of the grey Onyu kitten as an UPRIGHT
CHIBI MASCOT, standing on its two hind legs. It has exactly two arms and two legs (four
limbs total) and one tail — a normal cat body, NOT six limbs. One front paw (its right
arm) holds a small triangular pennant flag on a thin pole; the other front paw (its
left arm) is raised in a cheerful little wave, as if welcoming a newcomer. Show the full
body so both legs (standing) and both arms are clearly visible and correctly placed.
Happy, inviting expression. The pennant is a soft pastel pink-to-lavender gradient and
is LEFT BLANK with no text on it. Transparent background.
```

> 깃발에 영어 "NEW MEMBER"를 꼭 굽고 싶다면 마지막 문장을 `... with cute hand-lettered text "NEW MEMBER" on it.` 로 교체. (단 DALL·E 글자 깨짐 빈번 → 비추천)

---

### 2-3. `cat-wave.png` (옛 `07_cat_plain.png`) — Setup 안내 고양이

> 실제 생성 시 Setup/CTA 를 1장 공유 대신 **2장으로 분리**했다: 이 프롬프트 = `cat-wave.png`(Setup 안내냥), CTA 밴드는 §3-2 환호 프롬프트 → `cat-cheer.png`.

- **용도**: Setup 섹션 안내 (옛엔 CTA 밴드와 공유였으나 분리됨).
- **크기/비율**: **정사각형 (1:1)**. 표시 120~160px.
- **변경 핵심**: 줄무늬 태비 + 스케치풍 → **줄무늬 제거, 무지 그레이**. Hero 본체와 **포즈 차별**(안내 제스처).

```
[BASE STYLE 문단 붙이기]

Now make a SQUARE image (1:1) of the grey Onyu kitten as an UPRIGHT CHIBI MASCOT,
standing on its two hind legs. It has exactly two arms and two legs (four limbs total)
and one tail — a normal cat body, NOT six limbs. One front paw (arm) is raised to point
forward and up in a friendly "this way!" guiding gesture; the other arm rests at its
side. Head tilted slightly, warm welcoming smile. Show the full body so both standing
legs and both arms are clearly visible. Solid grey fur with NO tabby stripes. Use a
slightly three-quarter angle (not a flat straight-on front view) so it reads as a
distinct illustration from the main mascot. Transparent background.
```

---

## 3. (선택) 방향 A 신규 갭 보강용 고양이

핸드오프 지적: `대시보드`·`비활동회원`이 같은 `icon_settings.png` 사용(중복). 고양이로 해결하면 브랜드 톤 ↑.

### 3-1. `cat-sleeping.png` (옛 타깃 `cat_sleeping.png`) — 비활동 회원 일러스트

> ✅ 생성됨. 기능 카드 아이콘 자체는 lucide `Moon` 으로 확정(handoff §2-b)이고, `cat-sleeping` 은 inactiveMember 카드에 **병행 일러스트**로 활용.

- **크기/비율**: **정사각형 (1:1)**, 표시 48~64px → 단순·명료하게.

```
[BASE STYLE 문단 붙이기]

Now make a SQUARE image (1:1) of the grey Onyu kitten as a NORMAL FOUR-LEGGED cat
curled up asleep in a cozy round ball with its tail wrapped around its body — four
limbs and one tail, no extra limbs. Eyes closed as two gentle happy curves, with tiny
"z Z z" sleep symbols floating above its head. Peaceful and simple, with a clear
icon-friendly silhouette and minimal detail. Transparent background.
```

### 3-2. `cat-cheer.png` (옛 타깃 `cat_cheer.png`) — CTA 밴드 전용

> ✅ 생성됨. 옛 `07_cat_plain` 1장 공유 대신, CTA 밴드는 이 환호 컷(`cat-cheer.png`)으로 분리 채택.

```
[BASE STYLE 문단 붙이기]

Now make a SQUARE image (1:1) of the grey Onyu kitten as an UPRIGHT CHIBI MASCOT,
standing on its two hind legs. It has exactly two arms and two legs (four limbs total)
and one tail — a normal cat body, NOT six limbs. Both front paws (arms) are raised up in
joyful celebration, with a big happy smile and a few subtle sparkles or bits of confetti
around it, giving a warm "join us!" energy. Show the full body so both standing legs and
both raised arms are clearly visible. Transparent background.
```

---

## 4. 생성 체크리스트 (납품 전)

- [ ] 대화 첫머리에 `img_onyu_cat.png` 업로드 + "same character/style" 지시 보냄
- [ ] 모든 컷을 **같은 대화 스레드**에서 이어 생성 (일관성)
- [ ] 5(~7)종 나란히 놓고 눈색/볼터치/코/라인 굵기/털 질감 일관성 확인
- [ ] 전부 **투명 배경 PNG** (다크 섹션 위 헤일로/흰 테두리 없음)
- [x] `cat-group`(옛 `01_scene`)는 가로 와이드 + 주요 고양이 중앙 (모바일 크롭 대비)
- [x] 깃발 글씨 비움 (다국어 오버레이) — `cat-flag` 생성 완료
- [x] 새 케밥케이스 파일명으로 저장 (`cat-*.png`) — 옛 번호식 폐기. ⚠️ 파일명 변경으로 `page.tsx` 경로 참조 갱신 필요(handoff §0·§2-c)
- [x] `cat-sleeping` 생성 — inactiveMember 병행 일러스트 (아이콘 자체는 lucide `Moon`)
- [ ] (라이트 기준) 흰 배경 컷은 흰 섹션 위 누끼 불필요 — **컬러 밴드 위 `cat-cheer`** 만 누끼. `cat-group`(어두운 비네팅) 라이트 적용 방식 택1 (handoff §11)

---

## 5. 요약 — 생성된 고양이 목록 (✅ 2026-05-20 완료)

| 파일 (현재) | 옛 타깃 | 포즈/내용 | 비율(자연어) | 배경 | 비고 |
|---|---|---|---|---|---|
| `cat-group.png` | `01_scene.png` | 아기고양이 4마리 모임 + 말풍선 | wide landscape ~3:1 | 어두운 비네팅 | 중앙 배치, 누끼 불필요 |
| `cat-flag.png` | `03_cat_newmember.png` | 분홍 펜넌트 깃발 (글씨 없음) | ~4:3 | 흰 ⚠️누끼 | 깃발 글씨 비움 |
| `cat-wave.png` | `07_cat_plain.png` (Setup) | 한 발 흔드는 안내 손짓 | square 1:1 | 흰 ⚠️누끼 | Setup 안내냥 |
| `cat-cheer.png` | `cat_cheer.png`(§3-2) | 두 발 들고 환호 + 컨페티 | square 1:1 | 흰 ⚠️누끼 | CTA 전용 (Setup/CTA 분리) |
| `cat-sleeping.png` | `cat_sleeping.png`(§3-1) | 웅크려 자는 고양이 +zZ | square 1:1 | 흰 ⚠️누끼 | inactiveMember 병행 (아이콘은 lucide Moon) |
| `cat-wave-sitting.png` | (계획 외 보너스) | 앉아서 한 발 든 고양이 | square 1:1 | 투명 | cat-wave 대안/예비 |
| `cat-mug.png` | (계획 외 보너스) | 앉아서 하트 머그컵 | square 1:1 | 투명 | 장식/예비 |

> **온유 본체(`img_onyu_cat.png`)는 생성하지 않는다 — 모든 생성물의 기준 레퍼런스 (유지).**
> 기능 카드 객체 아이콘(옛 `icon_*.png` 5종)은 생성 대상이 아니다 — **lucide-react 컴포넌트로 확정**(handoff §2-b).
