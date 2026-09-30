/* ============================================================
 * 아임웹 위젯 설정 세트 3종 합본 JS
 * 배치 순서 고정: ① 노출 예약 함수 정의 → ② 슬라이드 동작 → ③ 등장 애니메이션
 *   이 순서를 바꾸면 filterPeriodItems 가 TDZ 에 걸려 슬라이드 블록 전체가 죽는다.
 * 출처: imweb-widget-common-patterns / -slide-animation / -entry-animation
 * ============================================================ */

/* ── ① 노출 예약 ─────────────────────────────────────────── */
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

/* ── ② 슬라이드 동작 ─────────────────────────────────────── */
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

/* ── ③ 등장 애니메이션 ───────────────────────────────────── */
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
