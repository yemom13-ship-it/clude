# 함께 넣어야 하는 설정 세트 — 코드 정리

`등장 애니메이션` · `슬라이드 동작` · `노출 예약` 세 세트의 **변수 탭 + HTML + CSS + JS** 전문.
아임웹 기본 제공 위젯 30종의 원본 로직을 그대로 쓰고, 변수 탭 스펙(`widget-generator`)에 맞춰 정리했다.

---

## 0. 세 세트를 한 위젯에 같이 넣을 때 — 실행 순서

JS 안에서의 **순서가 틀리면 조용히 깨진다.**

```
① 노출 예약 필터   기간 밖 슬라이드를 DOM 에서 제거
        ↓         ← 여기서 제거해야 클론·인덱스·도트가 어긋나지 않는다
② 슬라이드 초기화   클론 생성 → 위치 계산 → 도트 생성 → 자동 재생 시작
        ↓
③ 등장 애니메이션   IntersectionObserver 로 1회 발화
```

| 순서를 어기면 | 증상 |
|---|---|
| 필터를 클론 뒤에 실행 | 만료된 슬라이드의 클론이 남아 빈 화면이 끼어든다 |
| 필터를 도트 생성 뒤에 실행 | 도트 개수가 슬라이드 수와 안 맞는다 |
| 등장 애니메이션을 먼저 | `opacity:0` 상태에서 `offsetWidth` 를 재 슬라이드 위치가 0 으로 깔린다 |

### JS 탭에 붙이는 순서 — 아래 문서 순서와 다르다

이 문서는 읽기 좋으라고 `1. 등장 → 2. 슬라이드 → 3. 노출 예약` 순으로 썼지만,
**JS 탭에는 반드시 이 순서로 붙인다.**

```
① 3-4. 노출 예약 — 함수 정의만  (맨 아래 filterPeriodItems('.iw-slide'); 호출줄은 뺀다)
② 2-4. 슬라이드 동작            (이 블록 안에서 필터를 호출한다)
③ 1-4. 등장 애니메이션
```

문서 순서대로 붙이면 슬라이드 블록이 `filterPeriodItems` 를 그 `const` 선언보다 먼저 호출하게 되어
**`ReferenceError: Cannot access 'filterPeriodItems' before initialization`** 이 난다.
`const` 화살표 함수는 호이스팅되지 않기 때문이다(TDZ).

문법 검사로는 잡히지 않고 런타임에만 터지며, 그 순간 **슬라이드 블록 전체가 실행되지 않아
빈 위젯이 된다.** 셋 중 하나만 쓸 때는 순서를 신경 쓸 필요가 없다.

---

## 1. 등장 애니메이션

기본 위젯 **27/30 이 완전히 동일**하다. 변형하지 않고 그대로 복사해 쓴다.

### 1-1. 변수 탭

그룹은 **항상 맨 마지막**에 둔다.

```jsonc
"등장 애니메이션": {
  "opened": false,
  "children": {
    "select-anim": {
      "type": "select",
      "label": "스타일",
      "default": "none",
      "values":     ["none", "fade", "slide-up", "slide-down", "slide-left", "slide-right", "zoom-in"],
      "valueNames": ["없음", "페이드", "슬라이드인-업", "슬라이드인-다운", "슬라이드인-왼쪽", "슬라이드인-오른쪽", "줌-인"]
    },
    "text-animduration": { "type": "textfield", "label": "지속 시간", "default": "0.7", "placeholder": "0.7", "suffix": "초" },
    "text-animdelay":    { "type": "textfield", "label": "지연 시간", "default": "0",   "placeholder": "0",   "suffix": "초" }
  }
}
```

### 1-2. HTML

값은 **루트의 `data-*` 로만** 넘긴다. JS 는 `{{토큰}}` 을 보간하지 않는다.

```handlebars
<section class="iw-wrap"
  data-anim="{{select-anim}}"
  data-animduration="{{text-animduration}}"
  data-animdelay="{{text-animdelay}}">
  <!-- 위젯 본문 -->
</section>
```

### 1-3. CSS

```css
/* 초기 은닉 — "없음"일 때는 숨기지 않는다 */
.iw-wrap[data-anim="fade"],
.iw-wrap[data-anim="slide-up"],
.iw-wrap[data-anim="slide-down"],
.iw-wrap[data-anim="slide-left"],
.iw-wrap[data-anim="slide-right"],
.iw-wrap[data-anim="zoom-in"] {
  opacity: 0;
}

/* 발화 상태 — opacity/transform 을 명시 복구해야 '투명하게 갇힘'을 막는다 */
.iw-wrap[data-state="animated"] {
  opacity: 1;
  transform: none;
  animation-timing-function: cubic-bezier(0.22, 0.61, 0.36, 1);
  animation-fill-mode: both;
  /* animation-duration / animation-delay 는 JS 가 인라인 주입 */
}

.iw-wrap[data-state="animated"][data-anim="fade"]        { animation-name: iw-fade; }
.iw-wrap[data-state="animated"][data-anim="slide-up"]    { animation-name: iw-slide-up; }
.iw-wrap[data-state="animated"][data-anim="slide-down"]  { animation-name: iw-slide-down; }
.iw-wrap[data-state="animated"][data-anim="slide-left"]  { animation-name: iw-slide-left; }
.iw-wrap[data-state="animated"][data-anim="slide-right"] { animation-name: iw-slide-right; }
.iw-wrap[data-state="animated"][data-anim="zoom-in"]     { animation-name: iw-zoom-in; }

@keyframes iw-fade        { from { opacity: 0; }                               to { opacity: 1; transform: none; } }
@keyframes iw-slide-up    { from { opacity: 0; transform: translateY(24px); }  to { opacity: 1; transform: none; } }
@keyframes iw-slide-down  { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: none; } }
@keyframes iw-slide-left  { from { opacity: 0; transform: translateX(24px); }  to { opacity: 1; transform: none; } }
@keyframes iw-slide-right { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: none; } }
@keyframes iw-zoom-in     { from { opacity: 0; transform: scale(0.94); }       to { opacity: 1; transform: none; } }

/* 모션 최소화 — animation:none 과 opacity:1 은 반드시 세트로 */
@media (prefers-reduced-motion: reduce) {
  .iw-wrap[data-state="animated"] { animation: none; opacity: 1; transform: none; }
}
```

### 1-4. JS

```js
const ROOT_SELECTOR = '.iw-wrap';
const TARGET_SELECTOR = null;          // 카드 배열형이면 '.iw-card'

const DEFAULT_ANIM_DURATION_S = 0.7;
const DEFAULT_ANIM_DELAY_S = 0;
const IO_THRESHOLD = 0.25;
const IO_TALL_ROOT_MARGIN = '0px 0px -25% 0px';
const IO_FALLBACK_MS = 50;

const animRoot = document.querySelector(ROOT_SELECTOR);

const parseSeconds = (raw, fallback) => {
  const value = Number.parseFloat(raw);
  return (Number.isNaN(value) || value < 0) ? fallback : value;
};

const applyAnimationTiming = () => {
  const duration = parseSeconds(animRoot.getAttribute('data-animduration'), DEFAULT_ANIM_DURATION_S);
  const delay = parseSeconds(animRoot.getAttribute('data-animdelay'), DEFAULT_ANIM_DELAY_S);
  const targets = TARGET_SELECTOR ? animRoot.querySelectorAll(TARGET_SELECTOR) : [animRoot];
  for (let i = 0; i < targets.length; i++) {
    targets[i].style.setProperty('animation-duration', `${duration}s`);
    targets[i].style.setProperty('animation-delay', `${delay}s`);
  }
};

const showAnimation = () => {
  animRoot.setAttribute('data-state', 'animated');
};

// 위젯이 뷰포트보다 크면 threshold 0.25 가 영영 충족되지 않는다 → rootMargin 방식으로 전환
const buildObserverOptions = () => {
  const viewportH = window.innerHeight || 0;
  const tallerThanViewport = viewportH === 0 || animRoot.getBoundingClientRect().height > viewportH;
  return tallerThanViewport
    ? { threshold: 0, rootMargin: IO_TALL_ROOT_MARGIN }
    : { threshold: IO_THRESHOLD };
};

const startEntryAnimation = () => {
  if (animRoot.getAttribute('data-anim') === 'none') return;

  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver((entries) => {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          showAnimation();
          io.disconnect();          // 1회성 — 재발화·누수 방지
          break;
        }
      }
    }, buildObserverOptions());
    io.observe(animRoot);
  } else {
    setTimeout(showAnimation, IO_FALLBACK_MS);
  }
};

if (animRoot) {
  applyAnimationTiming();
  startEntryAnimation();
}
```

### 1-5. 자주 나오는 사고

| 증상 | 원인 |
|---|---|
| 위젯이 투명하게 갇혀 안 보인다 | 발화 상태에 `opacity:1; transform:none` 을 안 써서 키프레임 시작값에 갇힘 |
| 모바일에서만 안 나타난다 | 위젯이 뷰포트보다 큰데 `threshold` 방식만 씀 → tall 분기 필요 |
| 스크롤해도 안 뜬다 | `dataset` 으로 읽음 (샌드박스에서 불안정) → `getAttribute` 로 |
| 접근성 설정 시 사라진다 | `prefers-reduced-motion` 에서 `animation:none` 만 쓰고 `opacity:1` 누락 |

---

## 2. 슬라이드 동작

기본 위젯 11종이 쓰는 **슬라이드 애니메이션** 그룹 + 5종이 쓰는 **슬라이드 좌우 버튼** 그룹.
아래 코드는 **클론 경계 방식**(큰 배너 슬라이드 원본)이다.

### 2-1. 변수 탭

```jsonc
"슬라이드 좌우 버튼": {
  "opened": false,
  "children": {
    "text-arrowsize": { "type": "textfield", "label": "좌우 버튼 크기", "default": "40", "suffix": "px" },
    "segment-arrow":  { "type": "segment",   "label": "화살표 형태", "default": "line",
                        "values": ["line", "angle"], "valueNames": ["→", ">"] },
    "color-arrow":    { "type": "color",     "label": "화살표 컬러", "default": "#FFFFFF" }
  }
},
"슬라이드 애니메이션": {
  "opened": false,
  "children": {
    "text-transition": { "type": "textfield", "label": "전환 속도",      "default": "0.6", "placeholder": "0.6", "suffix": "초" },
    "switch-autoplay": { "type": "switch",    "label": "자동 재생",      "default": true },
    "text-autoplay":   { "type": "textfield", "label": "자동 재생 간격", "default": "4",   "placeholder": "4",   "suffix": "초" }
  }
}
```

`자동 재생` 과 `자동 전환` 은 **한 위젯 안에서 하나만** 쓴다. 섞지 않는다.

### 2-2. HTML

```handlebars
<section class="iw-wrap" id="iw-wrap"
  data-anim="{{select-anim}}"
  data-animduration="{{text-animduration}}"
  data-animdelay="{{text-animdelay}}"
  data-transition-speed="{{text-transition}}"
  data-autoplay="{{switch-autoplay}}"
  data-autoplay-speed="{{text-autoplay}}"
  data-arrow="{{segment-arrow}}"
  aria-label="슬라이드">

  <div class="iw-track" id="iw-track">
    {{#each item-slides}}
    <div class="iw-slide"
      data-date-start="{{date-start}}"
      data-time-start="{{time-start}}"
      data-date-end="{{date-end}}"
      data-time-end="{{time-end}}">
      <img class="iw-slide__img" src="{{image-slide}}" alt="" />
      <div class="iw-slide__body">
        <div class="iw-slide__title editor-content">{{editor-title}}</div>
        <div class="iw-slide__desc editor-content">{{editor-desc}}</div>
      </div>
    </div>
    {{/each}}
  </div>

  <button class="iw-nav iw-nav--prev" id="iw-prev" type="button" aria-label="이전 슬라이드">
    <span class="iw-nav__line">←</span><span class="iw-nav__angle">‹</span>
  </button>
  <button class="iw-nav iw-nav--next" id="iw-next" type="button" aria-label="다음 슬라이드">
    <span class="iw-nav__line">→</span><span class="iw-nav__angle">›</span>
  </button>

  <div class="iw-dots" id="iw-dots"></div>
</section>
```

화살표 형태는 **두 글리프를 다 넣고 CSS 로 골라 보여 준다.** `{{#if}}` 로 분기하지 않는다.

### 2-3. CSS

```css
:where(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }

.iw-wrap {
  --arrow-size: {{text-arrowsize}}px;   /* 숫자 변수는 루트에서 단위 concat */
  --arrow-color: {{color-arrow}};
  --slide-radius: 8px;

  position: relative;
  overflow: hidden;
  width: 100%;
}

.iw-track { display: flex; will-change: transform; }

.iw-slide {
  flex: 0 0 100%;
  min-width: 0;
  position: relative;
  border-radius: var(--slide-radius);
  overflow: hidden;
}
.iw-slide__img { width: 100%; height: auto; display: block; object-fit: cover; }
.iw-slide__body { padding: 16px; }

/* 드래그 중에는 이미지 고스트·텍스트 선택을 막는다 */
.iw-wrap[data-dragging] { cursor: grabbing; user-select: none; }
.iw-wrap[data-dragging] .iw-slide__img { pointer-events: none; }

/* 좌우 버튼 */
.iw-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: var(--arrow-size);
  height: var(--arrow-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--arrow-color);
  font-size: calc(var(--arrow-size) * 0.5);
  line-height: 1;
  cursor: pointer;
}
.iw-nav--prev { left: 8px; }
.iw-nav--next { right: 8px; }
.iw-nav:focus-visible { outline: 2px solid var(--arrow-color); outline-offset: 2px; }

/* 화살표 형태 — 선택된 글리프만 노출 */
.iw-nav__line,
.iw-nav__angle { display: none; }
.iw-wrap[data-arrow="line"] .iw-nav__line   { display: inline; }
.iw-wrap[data-arrow="angle"] .iw-nav__angle { display: inline; }

/* 도트 */
.iw-dots {
  position: absolute;
  left: 0; right: 0; bottom: 12px;
  display: flex;
  justify-content: center;
  gap: 8px;
}
.iw-dot {
  width: 8px; height: 8px;
  border: none; border-radius: 50%;
  background: var(--arrow-color);
  opacity: 0.4;
  cursor: pointer;
}
.iw-dot[data-state="active"] { opacity: 1; }

@media (max-width: 768px) {
  .iw-nav { width: calc(var(--arrow-size) * 0.75); height: calc(var(--arrow-size) * 0.75); }
  .iw-slide__body { padding: 12px; }
}
```

### 2-4. JS

```js
const DEFAULT_TRANSITION_SPEED_S = 0.6;
const DEFAULT_AUTOPLAY_SPEED_S = 4;
const SWIPE_THRESHOLD_PX = 40;
const DRAG_MOVE_THRESHOLD_PX = 5;
const CLONE_OFFSET = 2;
const MOBILE_MAX_W = 768;

const wrapper = document.getElementById('iw-wrap');
const track = document.getElementById('iw-track');
const btnPrev = document.getElementById('iw-prev');
const btnNext = document.getElementById('iw-next');
const dotsEl = document.getElementById('iw-dots');

const parseFloatOr = (value, fallback) => {
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
};

// 빈 문자열도 폴백으로 — 사용자가 필드를 비우는 경우
const readConfig = (attr, fallback) => {
  if (!wrapper) return fallback;
  const v = wrapper.getAttribute(attr);
  return v === null || v === '' ? fallback : v;
};

const transitionSpeed = parseFloatOr(readConfig('data-transition-speed', DEFAULT_TRANSITION_SPEED_S), DEFAULT_TRANSITION_SPEED_S);
const isAutoPlay = readConfig('data-autoplay', 'false') === 'true';   // switch 는 "true"/"false" 문자열
const autoPlaySpeed = parseFloatOr(readConfig('data-autoplay-speed', DEFAULT_AUTOPLAY_SPEED_S), DEFAULT_AUTOPLAY_SPEED_S) * 1000;

if (wrapper && track) {
  // ← ① 노출 예약 필터. 반드시 클론보다 먼저.
  //    3-4 의 함수 정의가 이 블록보다 위에 있어야 한다 (const 는 호이스팅되지 않는다)
  filterPeriodItems('.iw-slide');

  const initialSlides = document.querySelectorAll('.iw-slide');
  const len = initialSlides.length;

  if (len > 0) {
    // 앞뒤 2장씩 클론 (1장짜리도 안 깨지게 인덱스 클램프)
    const secondLastIdx = len >= 2 ? len - 2 : len - 1;
    const secondIdx = len >= 2 ? 1 : 0;

    const lastClone = initialSlides[len - 1].cloneNode(true);
    const firstClone = initialSlides[0].cloneNode(true);
    const secondLastClone = initialSlides[secondLastIdx].cloneNode(true);
    const secondClone = initialSlides[secondIdx].cloneNode(true);

    const clones = [lastClone, firstClone, secondLastClone, secondClone];
    for (let i = 0; i < clones.length; i++) clones[i].setAttribute('data-clone', '1');

    track.insertBefore(lastClone, initialSlides[0]);
    track.insertBefore(secondLastClone, lastClone);
    track.appendChild(firstClone);
    track.appendChild(secondClone);
    // cloneNode 는 리스너를 복사하지 않는다 — 클론에 필요한 바인딩은 여기서 다시 한다

    let normIdx = CLONE_OFFSET;
    let current = 0;
    let paused = false;
    let timerKey = 0;
    let isAnimating = false;

    const isMobile = () => wrapper.offsetWidth <= MOBILE_MAX_W;   // viewport 아닌 컨테이너 폭 기준

    const setPos = (idx, anim) => {
      track.style.transition = anim ? `transform ${transitionSpeed}s ease` : 'none';
      track.style.transform = `translateX(-${idx * wrapper.offsetWidth}px)`;
    };

    const normalizeCurrent = () => ((normIdx - CLONE_OFFSET) % len + len) % len;

    const updateDots = () => {
      const dots = document.querySelectorAll('.iw-dot');
      for (let i = 0; i < dots.length; i++) {
        if (i === current) dots[i].setAttribute('data-state', 'active');
        else dots[i].removeAttribute('data-state');
      }
    };

    const goTo = (rawIdx) => {
      if (isAnimating) return;
      isAnimating = true;
      normIdx = rawIdx;
      current = normalizeCurrent();
      setPos(normIdx, true);
      updateDots();
    };

    const prev = () => goTo(normIdx - 1);
    const next = () => goTo(normIdx + 1);

    // 클론에 도착하면 실물로 순간이동. 더블 rAF 없으면 되감기가 눈에 보인다.
    const snapToReal = (targetNormIdx) => {
      normIdx = targetNormIdx;
      track.style.transition = 'none';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPos(normIdx, false);
          current = normalizeCurrent();
          updateDots();
          isAnimating = false;
        });
      });
    };

    const handleTransitionEnd = (e) => {
      if (e.target !== track) return;
      if (e.propertyName !== 'transform') return;
      if (normIdx === 1) { snapToReal(len + 1); return; }
      if (normIdx === len + CLONE_OFFSET) { snapToReal(CLONE_OFFSET); return; }
      current = normalizeCurrent();
      updateDots();
      isAnimating = false;
    };
    track.addEventListener('transitionend', handleTransitionEnd);

    function startTimer() {
      if (!isAutoPlay) return;
      const key = ++timerKey;                 // 이전 세대 무효화
      const tick = () => {
        if (key !== timerKey) return;
        if (!paused && !isAnimating) next();
        setTimeout(tick, autoPlaySpeed);
      };
      setTimeout(tick, autoPlaySpeed);
    }

    if (dotsEl) {
      for (let d = 0; d < len; d++) {
        const dot = document.createElement('button');
        dot.className = 'iw-dot';
        dot.setAttribute('type', 'button');
        if (d === 0) dot.setAttribute('data-state', 'active');
        dot.setAttribute('aria-label', `${d + 1}번 슬라이드`);
        const idx = d;
        dot.addEventListener('click', () => { goTo(idx + CLONE_OFFSET); startTimer(); });
        dotsEl.appendChild(dot);
      }
    }

    if (btnPrev) btnPrev.addEventListener('click', () => { prev(); startTimer(); });
    if (btnNext) btnNext.addEventListener('click', () => { next(); startTimer(); });

    // 스와이프 / 드래그 + 드래그 후 클릭 억제
    const performSwipe = (dx) => {
      if (dx < -SWIPE_THRESHOLD_PX) { next(); startTimer(); }
      else if (dx > SWIPE_THRESHOLD_PX) { prev(); startTimer(); }
    };

    let isDragging = false;
    let dragStartX = 0;
    let dragMoved = false;
    let suppressClick = false;

    const endDrag = (endX, fromPointerUp) => {
      if (!isDragging) return;
      isDragging = false;
      wrapper.removeAttribute('data-dragging');
      if (fromPointerUp && dragMoved) suppressClick = true;
      performSwipe(endX - dragStartX);
    };

    wrapper.addEventListener('mouseenter', () => { paused = true; });
    wrapper.addEventListener('mouseleave', (e) => { paused = false; endDrag(e.clientX, false); });

    wrapper.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      dragMoved = false;
      suppressClick = false;
      dragStartX = e.clientX;
      wrapper.setAttribute('data-dragging', '1');
    });

    wrapper.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      if (Math.abs(e.clientX - dragStartX) > DRAG_MOVE_THRESHOLD_PX) dragMoved = true;
    });

    wrapper.addEventListener('mouseup', (e) => endDrag(e.clientX, true));
    wrapper.addEventListener('dragstart', (e) => e.preventDefault());

    // 드래그 직후 click 1회만 무력화. 소비 후 즉시 내리지 않으면 클릭이 전멸한다.
    wrapper.addEventListener('click', (e) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    }, true);

    let touchStartX = 0;
    wrapper.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    wrapper.addEventListener('touchend', (e) => performSwipe(e.changedTouches[0].clientX - touchStartX), { passive: true });

    const refreshLayout = () => {
      wrapper.setAttribute('data-breakpoint', isMobile() ? 'mobile' : '');
      setPos(normIdx, false);
    };
    try {
      const ro = new ResizeObserver(refreshLayout);
      ro.observe(wrapper);
    } catch (err) {}   // 미지원 환경에서 위젯 전체가 죽지 않도록

    refreshLayout();               // ← ② 슬라이드 초기화
    setPos(CLONE_OFFSET, false);
    updateDots();
    startTimer();
  }
}
```

### 2-5. 자주 나오는 사고

| 증상 | 원인 |
|---|---|
| 슬라이드가 끊기거나 되감기가 보인다 | `snapToReal` 에 더블 `requestAnimationFrame` 이 없음 |
| 드래그했는데 링크가 열린다 | 드래그 후 `click` 억제(capture 단계 1회) 누락 |
| 클릭이 아예 안 된다 | `suppressClick` 을 소비 후 즉시 내리지 않음 |
| 연타하면 위치가 튄다 | `isAnimating` 연타 가드 없음 |
| 조작 직후 바로 자동 넘어간다 | `setInterval` 사용 — 세대 카운터 방식으로 리셋해야 함 |
| 모바일 뷰에서 반응형이 안 먹는다 | `window.innerWidth` 사용 — `wrapper.offsetWidth` 로 |

---

## 3. 노출 예약

아이템 하나하나를 정해진 기간에만 보이게 한다. 슬라이드·배너 계열 기본 위젯 **9종**이 쓰고,
전부 **4개가 한 세트**다. 2개로 줄이거나 날짜만 넣은 사례는 0건이다.

### 3-1. 변수 탭

아이템 `fields` **맨 끝**에 이 순서로 붙인다.

```jsonc
"item-slides": {
  "type": "item",
  "label": "슬라이드 목록",
  "maxLength": 20,
  "fields": {
    "image-slide":   { "type": "image",       "label": "슬라이드 이미지" },
    "editor-title":  { "type": "text-editor", "label": "텍스트 1" },
    "text-link":     { "type": "textfield",   "label": "링크", "placeholder": "https://" },
    "switch-newtab": { "type": "switch",      "label": "새창으로 이동" },

    "date-start":    { "type": "date", "label": "시작 날짜" },
    "time-start":    { "type": "time", "label": "시작 시간" },
    "date-end":      { "type": "date", "label": "종료 날짜" },
    "time-end":      { "type": "time", "label": "종료 시간" }
  },
  "default": [
    { "image-slide": "", "editor-title": "**첫 번째 슬라이드**", "text-link": "", "switch-newtab": false,
      "date-start": "", "time-start": "", "date-end": "", "time-end": "" }
  ]
}
```

- 인스턴스 배열의 네 값은 **빈 문자열 `""`**. 비워 두면 항상 노출된다.
- `fields` 안의 정의에는 `default` 를 두지 않는다. (저장 차단)
- 날짜와 시간을 한 항목에 합치지 않는다. `date` + `time` 두 개다.

### 3-2. HTML

각 아이템의 `data-*` 로 네 값을 내린다.

```handlebars
{{#each item-slides}}
<div class="iw-slide"
  data-date-start="{{date-start}}"
  data-time-start="{{time-start}}"
  data-date-end="{{date-end}}"
  data-time-end="{{time-end}}">
  <!-- 아이템 본문 -->
</div>
{{/each}}
```

### 3-3. CSS

**없다.** 기간 밖 아이템은 숨기는 게 아니라 **DOM 에서 제거**하므로 CSS 가 관여하지 않는다.
`display:none` 으로 숨기면 슬라이드 인덱스·도트 개수 계산에 섞여 들어간다.

### 3-4. JS

```js
// 노출 기간 파서. KST(+09:00) 고정.
const parsePeriodDateTime = (dateStr, timeStr, fallbackTime) => {
  if (!dateStr) return null;
  const ds = String(dateStr).trim();
  if (ds.length === 0) return null;

  const dateMatch = ds.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!dateMatch) return null;

  const y = dateMatch[1];
  const m = `0${dateMatch[2]}`.slice(-2);
  const d = `0${dateMatch[3]}`.slice(-2);

  let time = fallbackTime || '00:00';
  if (timeStr) {
    const ts = String(timeStr).trim();
    // ① 한국어 형식: "오후 3시 30분"
    const korMatch = ts.match(/(오전|오후)\s*(\d{1,2})\s*시\s*(\d{1,2})\s*분/);
    if (korMatch) {
      let hh = Number.parseInt(korMatch[2], 10);
      const mm = Number.parseInt(korMatch[3], 10);
      if (korMatch[1] === '오전' && hh === 12) hh = 0;          // 오전 12시 = 00시
      else if (korMatch[1] === '오후' && hh !== 12) hh += 12;   // 오후 12시는 그대로 12
      time = `${`0${hh}`.slice(-2)}:${`0${mm}`.slice(-2)}`;
    } else {
      // ② ISO 형식: "15:30"
      const isoMatch = ts.match(/(\d{1,2}):(\d{2})/);
      if (isoMatch) time = `${`0${isoMatch[1]}`.slice(-2)}:${isoMatch[2]}`;
    }
  }

  const dt = new Date(`${y}-${m}-${d}T${time}:00+09:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const isItemExpired = (item, now) => {
  const startDt = parsePeriodDateTime(item.getAttribute('data-date-start'), item.getAttribute('data-time-start'), '00:00');
  const endDt = parsePeriodDateTime(item.getAttribute('data-date-end'), item.getAttribute('data-time-end'), '23:59');
  if (startDt && now < startDt) return true;
  if (endDt && now > endDt) return true;
  return false;
};

// 기간 밖 아이템을 DOM 에서 제거. 역순 순회 — 순회 중 제거해도 인덱스가 밀리지 않게.
const filterPeriodItems = (itemSelector, companionSelector) => {
  const now = new Date();
  const items = document.querySelectorAll(itemSelector);
  const companions = companionSelector ? document.querySelectorAll(companionSelector) : null;

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!isItemExpired(item, now)) continue;
    if (item.parentNode) item.parentNode.removeChild(item);
    if (companions && companions[i] && companions[i].parentNode) {
      companions[i].parentNode.removeChild(companions[i]);   // 도트 등 짝 요소도 함께
    }
  }
};

filterPeriodItems('.iw-slide');   // ← 클론 생성보다 반드시 먼저
```

### 3-5. 자주 나오는 사고

| 증상 | 원인 |
|---|---|
| 정오 근처에 하루 두 번 어긋난다 | `오전 12시 → 00`, `오후 12시 → 12` 처리 누락 |
| 해외 접속자에게 다르게 보인다 | 브라우저 로컬 타임존 사용 — `+09:00` 하드코딩해야 함 |
| 만료 슬라이드의 빈 화면이 끼어든다 | 필터를 클론 생성 뒤에 실행 |
| 도트 개수가 안 맞는다 | 도트 생성 뒤에 필터 실행, 또는 짝 요소를 같이 안 지움 |
| 기간을 비웠는데 아무것도 안 나온다 | 빈 값을 만료로 판정 — 파서가 `null` 을 돌려주고 그때는 통과시켜야 함 |
| 시간만 넣었는데 안 먹는다 | 파서가 날짜 없으면 `null` — **날짜가 있어야 시간이 의미를 가진다** |

---

## 4. 전체 변수 탭 합본

세 세트를 다 넣은 슬라이드 위젯의 변수 탭 전문. 그대로 붙여 넣고 쓰면 된다.

```jsonc
{
  // 슬라이드는 아이템에서 추가·수정해요
  "아이템": {
    "opened": true,
    "children": {
      "item-slides": {
        "type": "item",
        "label": "슬라이드 목록",
        "maxLength": 20,
        "fields": {
          "image-slide":   { "type": "image",       "label": "슬라이드 이미지" },
          "editor-title":  { "type": "text-editor", "label": "텍스트 1" },
          "editor-desc":   { "type": "text-editor", "label": "텍스트 2" },
          "text-link":     { "type": "textfield",   "label": "링크", "placeholder": "https://" },
          "switch-newtab": { "type": "switch",      "label": "새창으로 이동" },
          "date-start":    { "type": "date",        "label": "시작 날짜" },
          "time-start":    { "type": "time",        "label": "시작 시간" },
          "date-end":      { "type": "date",        "label": "종료 날짜" },
          "time-end":      { "type": "time",        "label": "종료 시간" }
        },
        "default": [
          { "image-slide": "", "editor-title": "**첫 번째 슬라이드**", "editor-desc": "설명을 입력하세요",
            "text-link": "", "switch-newtab": false,
            "date-start": "", "time-start": "", "date-end": "", "time-end": "" },
          { "image-slide": "", "editor-title": "**두 번째 슬라이드**", "editor-desc": "설명을 입력하세요",
            "text-link": "", "switch-newtab": false,
            "date-start": "", "time-start": "", "date-end": "", "time-end": "" },
          { "image-slide": "", "editor-title": "**세 번째 슬라이드**", "editor-desc": "설명을 입력하세요",
            "text-link": "", "switch-newtab": false,
            "date-start": "", "time-start": "", "date-end": "", "time-end": "" }
        ]
      }
    }
  },
  "슬라이드 좌우 버튼": {
    "opened": false,
    "children": {
      "text-arrowsize": { "type": "textfield", "label": "좌우 버튼 크기", "default": "40", "suffix": "px" },
      "segment-arrow":  { "type": "segment",   "label": "화살표 형태", "default": "line",
                          "values": ["line", "angle"], "valueNames": ["→", ">"] },
      "color-arrow":    { "type": "color",     "label": "화살표 컬러", "default": "#FFFFFF" }
    }
  },
  "슬라이드 애니메이션": {
    "opened": false,
    "children": {
      "text-transition": { "type": "textfield", "label": "전환 속도",      "default": "0.6", "placeholder": "0.6", "suffix": "초" },
      "switch-autoplay": { "type": "switch",    "label": "자동 재생",      "default": true },
      "text-autoplay":   { "type": "textfield", "label": "자동 재생 간격", "default": "4",   "placeholder": "4",   "suffix": "초" }
    }
  },
  "등장 애니메이션": {
    "opened": false,
    "children": {
      "select-anim": {
        "type": "select", "label": "스타일", "default": "none",
        "values":     ["none", "fade", "slide-up", "slide-down", "slide-left", "slide-right", "zoom-in"],
        "valueNames": ["없음", "페이드", "슬라이드인-업", "슬라이드인-다운", "슬라이드인-왼쪽", "슬라이드인-오른쪽", "줌-인"]
      },
      "text-animduration": { "type": "textfield", "label": "지속 시간", "default": "0.7", "placeholder": "0.7", "suffix": "초" },
      "text-animdelay":    { "type": "textfield", "label": "지연 시간", "default": "0",   "placeholder": "0",   "suffix": "초" }
    }
  },
}
```

그룹 4개 · 변수 10개. `등장 애니메이션` 이 맨 끝, `아이템` 이 맨 앞 — 기본 위젯 순서 규칙 그대로다.

검사:

```bash
node ../imweb-widget-panel-rules/scripts/lint-variables.mjs variables.jsonc
```
