---
name: imweb-widget-setting-sets
description: >
  아임웹 커스텀 위젯의 "함께 넣어야 하는 설정 세트" 3종을 변수 탭 + HTML + CSS + JS
  한 벌로 구현·검수한다 — 등장 애니메이션, 슬라이드 동작(자동 재생·전환 속도·좌우 버튼·
  드래그/스와이프), 노출 예약(시작/종료 날짜·시간 4종 세트). 세 세트를 **한 위젯에 같이
  넣을 때의 배치 순서**와 그때만 터지는 사고(TDZ 로 슬라이드 블록 전멸, 만료 슬라이드의
  클론 잔존, 도트 개수 불일치)를 다룬다.
  "설정 세트 코드 정리해줘", "슬라이드에 노출 예약 붙여줘", "등장 애니메이션까지 같이
  넣어줘", "자동 재생 + 기간 설정 위젯", "세트 코드 한 벌로 줘", "설정 세트 검수",
  "슬라이드가 빈 화면으로 나온다", "도트 개수가 안 맞는다", "만료된 슬라이드가 남아 있다"
  같은 요청·증상에 사용.
  세트 하나만 깊게 파야 하면 imweb-widget-entry-animation / -slide-animation 을,
  설정 패널 이름·그룹 규칙은 imweb-widget-panel-rules 를 쓴다.
---

# 설정 세트 3종 — 변수 탭 + 코드 한 벌

아임웹 기본 제공 위젯 30종에서 **여러 위젯이 반복해서 같이 쓰는 설정 묶음** 중,
코드까지 딸려 오는 3종을 한 벌로 정리했다.

| 세트 | 기본 위젯 사용 | 코드가 필요한 곳 |
|---|---|---|
| 등장 애니메이션 | 27/30 | CSS 키프레임 + JS 옵저버 |
| 슬라이드 동작 | 11/30 (좌우 버튼 5/30) | CSS 레이아웃 + JS 클론 캐러셀 |
| 노출 예약 | 9/30 (슬라이드·배너 계열) | JS 필터 (CSS 없음) |

코드 원본은 형제 스킬에서 가져왔다. **이 스킬의 고유 가치는 "셋을 같이 넣을 때"** 다 —
따로 쓰면 안 터지고 합쳐야만 터지는 사고가 있다.

---

## 1. 바로 쓰기

`assets/` 를 그대로 4개 탭에 붙여 넣으면 세 세트가 다 들어간 슬라이드 위젯이 된다.

| 파일 | 붙여넣을 탭 |
|---|---|
| `assets/variables.jsonc` | 변수 탭 |
| `assets/widget.html` | HTML 탭 |
| `assets/widget.css` | CSS 탭 |
| `assets/widget.js` | JS 탭 (**배치 순서가 이미 맞춰져 있다**) |

세트별 전문·사고 사례·변수 탭 조각은 `references/sets.md`.

---

## 2. 배치 순서 — 이 스킬의 핵심

세 세트를 한 위젯에 넣을 때, **JS 탭 안의 선언 순서가 틀리면 조용히 죽는다.**

```
① 노출 예약 — 함수 정의만        parsePeriodDateTime / isItemExpired / filterPeriodItems
② 슬라이드 동작                  이 블록 안에서 filterPeriodItems(...) 를 호출한다
③ 등장 애니메이션                맨 마지막
```

### 왜 이 순서인가

| 어기면 | 결과 |
|---|---|
| 노출 예약 정의가 슬라이드보다 **아래** | `ReferenceError: Cannot access 'filterPeriodItems' before initialization` — `const` 화살표 함수는 호이스팅되지 않는다. **슬라이드 블록 전체가 실행되지 않아 빈 위젯**이 된다. 문법 검사로는 안 잡히고 런타임에만 터진다 |
| 필터가 **클론 생성 뒤** | 만료 슬라이드의 클론이 남아 빈 화면이 낀다 |
| 필터가 **도트 생성 뒤** | 도트 개수가 슬라이드 수와 안 맞는다 |
| 등장 애니메이션이 **레이아웃 확정 앞** | `opacity:0` 상태에서 `offsetWidth` 를 재 슬라이드 위치가 0 으로 깔린다 |

세트를 **하나만** 쓸 때는 순서를 신경 쓸 필요가 없다. 이 규칙은 조합할 때만 적용된다.

---

## 3. 세트 요약

전문은 `references/sets.md`. 여기서는 빠뜨리기 쉬운 것만 짚는다.

### 3-1. 등장 애니메이션 (27/30 완전 동일)

변수 3개 — `select-anim`(스타일 7종) · `text-animduration` · `text-animdelay`.
뒤 둘은 `"suffix": "초"`. 그룹은 **항상 맨 마지막**. **변형하지 않는다.**

- 발화 상태에 `opacity:1; transform:none` 을 **반드시** 쓴다. 없으면 키프레임 시작값에 갇혀 투명해진다.
- `prefers-reduced-motion` 에서 `animation:none` 과 `opacity:1` 은 **세트**다. 하나만 쓰면 사라진다.
- 위젯이 뷰포트보다 크면 `threshold` 가 영영 충족되지 않는다 → `rootMargin` 분기가 필요하다.
- 옵저버는 1회 발화 후 `disconnect()`.

### 3-2. 슬라이드 동작 (11/30)

`슬라이드 애니메이션` 그룹(전환 속도 · 자동 재생 · 자동 재생 간격) +
`슬라이드 좌우 버튼` 그룹(좌우 버튼 크기 · 화살표 형태 · 화살표 컬러).

- `자동 재생` 과 `자동 전환` 은 **한 위젯 안에서 하나만** 쓴다.
- switch 값은 렌더 시 `"true"`/`"false"` **문자열**이다. `=== 'true'` 로 비교한다.
- 클론 → 실물 순간이동에 **더블 `requestAnimationFrame`** 이 없으면 되감기가 보인다.
- 자동 재생은 `setInterval` 이 아니라 **세대 카운터 + `setTimeout`**. 조작할 때마다 리셋된다.
- 드래그 후 `click` 을 capture 단계에서 **1회만** 죽인다. 안 내리면 이후 클릭이 전멸한다.
- 반응형 판정은 `wrapper.offsetWidth`. `window.innerWidth` 는 디자인모드에서 틀린 답을 준다.
- `ResizeObserver` 는 `try/catch` 로 감싼다.

### 3-3. 노출 예약 (9/30)

아이템 `fields` **맨 끝**에 4종 — `date-start` · `time-start` · `date-end` · `time-end`.
인스턴스 배열의 값은 전부 빈 문자열 `""`.

- **4개가 한 세트.** 2개로 줄이거나 날짜만 넣은 사례는 기본 위젯에 0건이다.
- 타임존은 **`+09:00` 하드코딩**. 로컬 타임존을 쓰면 해외 접속자에게 다르게 보인다.
- `오전 12시 → 00`, `오후 12시 → 12` 보정을 빠뜨리면 **하루에 두 번 어긋난다.**
- 시간 값은 `"오후 3시 30분"`(한국어)과 `"15:30"`(ISO) 두 형태로 온다. 둘 다 파싱한다.
- 기간 밖 아이템은 **숨기지 않고 DOM 에서 제거**한다. 숨기면 인덱스·도트 계산에 섞인다.
- 제거 순회는 **역순**. 순회 중 제거하면 인덱스가 밀린다.
- 날짜가 없으면 파서가 `null` 을 돌려주고 그때는 **통과**시킨다. 비운 기간 = 항상 노출.

**카운트다운 타이머는 다른 세트다.** 아이템이 아니라 `타이머` 그룹에
`date-end` + `time-end` 2종만 넣는다.

---

## 4. 검수

```bash
node scripts/check-sets.mjs widget.html widget.css widget.js
```

확장자로 판별하므로 순서는 상관없고, 일부만 넘겨도 된다. 검사 항목:

- **배치 순서** — TDZ 함정, 필터↔클론, 필터↔도트, 등장↔레이아웃
- **세트별 필수 구성** — 발화 상태 `opacity:1`, reduced-motion 짝, tall 분기, 옵저버 해제,
  더블 rAF, 연타 가드, `setInterval` 사용, `suppressClick` 해제, `+09:00`, 오전/오후 12시,
  `removeChild`, 역순 순회, `data-*` 4종
- **widget-generator 금지 패턴** — `var` · `dataset` · `document.addEventListener` ·
  NodeList `forEach` · `matchMedia` · `innerWidth` · `!important` · `@import` ·
  `url(data:)` · `screen and` 미디어쿼리 · 삼중 중괄호 · `on*` · 인라인 `style` · 차단 태그 · 점 경로

변수 탭은 `imweb-widget-panel-rules` 스킬의 린터로 따로 본다.

```bash
node ../imweb-widget-panel-rules/scripts/lint-variables.mjs variables.jsonc
```

---

## 5. 함께 보는 문서

| 스킬 | 역할 |
|---|---|
| `imweb-widget-panel-rules` | 설정 패널 이름·그룹·순서 규칙, 변수 탭 스키마 린터 |
| `widget-generator` | 위젯 코드 생성 규칙 — 금지 패턴의 원 출처 |
| `imweb-widget-entry-animation` | 등장 애니메이션 단독 심화 |
| `imweb-widget-slide-animation` | 슬라이드·롤링 단독 심화 (마퀴 등 다른 유형 포함) |
| `imweb-widget-interaction` | 드래그·스와이프 입력 처리 심화 |
| `imweb-widget-common-patterns` | 샌드박스 제약, 값 파싱, 링크 이동, 노출 기간 필터 원본 |

`assets/` 의 코드는 위 형제 스킬에서 가져온 **사본**이다.
로직이 어긋나 보이면 형제 스킬 쪽이 원본이다.
