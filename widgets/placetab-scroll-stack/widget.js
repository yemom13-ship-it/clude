const DEFAULT_DISTANCE = 700;
const MIN_PIN_TOP = 16;
const PIN_TOLERANCE = 2;
const ENTER_RANGE = 0.8;

const root = document.querySelector('.iw-stack');

function clamp01(value) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function initStack() {
  if (!root) return;
  const track = root.querySelector('.iw-stack__track');
  const stage = root.querySelector('.iw-stack__stage');
  const panels = root.querySelectorAll('.iw-stack__panel');
  if (!track || !stage || panels.length === 0) return;

  const distance = parseFloat(root.getAttribute('data-distance')) || DEFAULT_DISTANCE;
  const maxShift = (panels.length - 1) * distance;
  let useJsPin = false;
  let running = false;
  let rafId = 0;
  let lastTop = null;
  let lastVh = null;

  function isMotionOff() {
    return window.getComputedStyle(stage).position === 'static';
  }

  function measure() {
    root.style.setProperty('--track-h', `${stage.offsetHeight + maxShift}px`);
    lastTop = null;
  }

  // 조상 요소의 overflow 때문에 sticky 가 풀리면 transform 고정으로 전환
  function checkPin(pinTop, scrolled) {
    if (useJsPin || scrolled <= 0 || scrolled >= maxShift) return;
    const top = stage.getBoundingClientRect().top;
    if (Math.abs(top - pinTop) <= PIN_TOLERANCE) return;
    useJsPin = true;
    root.setAttribute('data-pin', 'js');
  }

  function update() {
    if (isMotionOff()) return;
    const vh = window.innerHeight;
    const trackTop = track.getBoundingClientRect().top;
    if (trackTop === lastTop && vh === lastVh) return;
    lastTop = trackTop;
    lastVh = vh;

    const stageH = stage.offsetHeight;
    const pinTop = Math.max(MIN_PIN_TOP, (vh - stageH) / 2);
    root.style.setProperty('--pin-top', `${pinTop}px`);

    const scrolled = Math.min(Math.max(pinTop - trackTop, 0), maxShift);
    checkPin(pinTop, scrolled);
    stage.style.transform = useJsPin ? `translateY(${scrolled}px)` : '';

    const stageTop = trackTop + (useJsPin ? scrolled : 0);
    const enter = clamp01((vh - stageTop) / (stageH * ENTER_RANGE));
    panels[0].style.setProperty('--rise', String(enter));

    for (let i = 1; i < panels.length; i++) {
      const progress = clamp01((scrolled - (i - 1) * distance) / distance);
      panels[i].style.setProperty('--slide', String(progress));
      panels[i].style.setProperty('--rise', String(progress));
      panels[i - 1].style.setProperty('--q', String(progress));
    }
  }

  function loop() {
    update();
    if (running) rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    lastTop = null;
    update();
  }

  function handleIntersect(entries) {
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) start();
      else stop();
    }
  }

  measure();
  update();

  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(stage);

  const intersectionObserver = new IntersectionObserver(handleIntersect);
  intersectionObserver.observe(track);
}

initStack();
