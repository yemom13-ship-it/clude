#!/usr/bin/env node
// 설정 세트 3종을 넣은 위젯 코드를 검사한다.
//   - 세트 조합 순서 (TDZ 함정, 클론/도트 순서)
//   - 세트별 필수 구성 누락
//   - widget-generator 금지 패턴
//
//   node scripts/check-sets.mjs widget.html widget.css widget.js
//   (확장자로 판별하므로 순서는 상관없다. 일부만 넘겨도 된다.)
//
// 종료코드: ERROR 있으면 1.
import fs from 'fs';
import path from 'path';

const ERR = [];
const WARN = [];
const OK = [];
const err = (m) => ERR.push(m);
const warn = (m) => WARN.push(m);
const ok = (m) => OK.push(m);

const files = process.argv.slice(2);
if (!files.length) {
  console.error('사용법: node scripts/check-sets.mjs widget.html widget.css widget.js');
  process.exit(2);
}

let html = '', css = '', js = '';
for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  const src = fs.readFileSync(f, 'utf8');
  if (ext === '.html' || ext === '.hbs' || ext === '.handlebars') html += src + '\n';
  else if (ext === '.css') css += src + '\n';
  else if (ext === '.js' || ext === '.mjs') js += src + '\n';
  else warn(`확장자를 모르겠어 건너뜀: ${f}`);
}

// ── 어떤 세트가 들어있나 ──────────────────────────────────────────
const hasEntry = /data-anim\b/.test(html) || /data-animduration/.test(js);
const hasSlide = /data-transition-speed|iw-track|CLONE_OFFSET/.test(html + js);
const hasSched = /parsePeriodDateTime|data-date-start/.test(html + js);

console.log(`검출된 세트: ${[hasEntry && '등장 애니메이션', hasSlide && '슬라이드 동작', hasSched && '노출 예약'].filter(Boolean).join(' · ') || '(없음)'}`);
console.log('');

// ── 1. 조합 순서 ────────────────────────────────────────────────
if (js) {
  const callIdx = js.search(/^\s*filterPeriodItems\s*\(/m);
  const defIdx = js.search(/^\s*const\s+filterPeriodItems\s*=/m);

  if (callIdx !== -1 && defIdx !== -1 && callIdx < defIdx) {
    err('filterPeriodItems 호출이 정의보다 위에 있다 — const 는 호이스팅되지 않아 '
      + 'ReferenceError 로 슬라이드 블록 전체가 죽는다. 노출 예약 함수 정의를 맨 위로 올린다.');
  } else if (callIdx !== -1 && defIdx !== -1) {
    ok('노출 예약 함수가 호출보다 먼저 정의됨');
  }
  if (hasSched && callIdx === -1) {
    warn('노출 예약 함수는 정의됐는데 filterPeriodItems(...) 호출이 없다 — 필터가 동작하지 않는다');
  }

  if (hasSlide && hasSched) {
    const cloneIdx = js.search(/cloneNode\s*\(/);
    if (callIdx !== -1 && cloneIdx !== -1 && callIdx > cloneIdx) {
      err('노출 예약 필터가 클론 생성보다 뒤에 있다 — 만료 슬라이드의 클론이 남아 빈 화면이 낀다');
    } else if (callIdx !== -1 && cloneIdx !== -1) {
      ok('필터가 클론 생성보다 먼저 실행됨');
    }
    const dotIdx = js.search(/createElement\s*\(\s*['"]button['"]\s*\)/);
    if (callIdx !== -1 && dotIdx !== -1 && callIdx > dotIdx) {
      err('노출 예약 필터가 도트 생성보다 뒤에 있다 — 도트 개수가 슬라이드 수와 안 맞는다');
    }
  }

  if (hasSlide && hasEntry) {
    const entryIdx = js.search(/startEntryAnimation\s*\(\s*\)\s*;|applyAnimationTiming\s*\(\s*\)\s*;/);
    const layoutIdx = js.search(/refreshLayout\s*\(\s*\)\s*;/);
    if (entryIdx !== -1 && layoutIdx !== -1 && entryIdx < layoutIdx) {
      warn('등장 애니메이션이 슬라이드 레이아웃 확정보다 먼저 실행된다 — '
        + 'opacity:0 상태에서 offsetWidth 를 재 위치가 0 으로 깔릴 수 있다');
    }
  }
}

// ── 2. 세트별 필수 구성 ─────────────────────────────────────────
if (hasEntry) {
  if (!/\[data-state=["']animated["']\]/.test(css)) {
    err('등장 애니메이션: CSS 에 [data-state="animated"] 발화 규칙이 없다');
  }
  if (css && !/\[data-state=["']animated["']\][\s\S]{0,200}opacity:\s*1/.test(css)) {
    err('등장 애니메이션: 발화 상태에 opacity:1 이 없다 — 위젯이 투명하게 갇힌다');
  }
  if (css && !/prefers-reduced-motion/.test(css)) {
    warn('등장 애니메이션: prefers-reduced-motion 대응이 없다');
  } else if (css && !/prefers-reduced-motion[\s\S]{0,300}opacity:\s*1/.test(css)) {
    err('등장 애니메이션: prefers-reduced-motion 에서 animation:none 만 있고 opacity:1 이 없다 — 접근성 설정 시 사라진다');
  }
  if (js && !/getAttribute\(\s*['"]data-anim['"]\s*\)\s*===\s*['"]none['"]/.test(js)) {
    warn('등장 애니메이션: "없음"(none) 선택 시 조기 반환하는 분기가 안 보인다');
  }
  if (js && !/IntersectionObserver/.test(js)) {
    warn('등장 애니메이션: IntersectionObserver 가 없다 — 스크롤 진입 발화가 안 된다');
  }
  if (js && /IntersectionObserver/.test(js) && !/disconnect\s*\(|unobserve\s*\(/.test(js)) {
    warn('등장 애니메이션: 옵저버를 해제하지 않는다 — 재발화·누수');
  }
  if (js && !/innerHeight/.test(js)) {
    warn('등장 애니메이션: 위젯이 뷰포트보다 큰 경우(tall) 분기가 없다 — 모바일에서 안 뜰 수 있다');
  }
  if (hasEntry && css && !/animation-fill-mode/.test(css)) {
    warn('등장 애니메이션: animation-fill-mode: both 가 없다');
  }
}

if (hasSlide) {
  if (js && !/requestAnimationFrame[\s\S]{0,120}requestAnimationFrame/.test(js)) {
    err('슬라이드: 클론 → 실물 순간이동에 더블 requestAnimationFrame 이 없다 — 되감기가 눈에 보인다');
  }
  if (js && !/isAnimating/.test(js)) {
    warn('슬라이드: 연타 가드(isAnimating)가 없다 — 빠르게 누르면 위치가 튄다');
  }
  if (js && /setInterval\s*\(/.test(js)) {
    err('슬라이드: setInterval 사용 — 조작 직후 바로 넘어간다. 세대 카운터 + setTimeout 방식을 쓴다');
  }
  if (js && /addEventListener\(\s*['"]click['"]/.test(js) && !/suppressClick/.test(js)) {
    warn('슬라이드: 드래그 후 click 억제가 없다 — 드래그했는데 링크가 열린다');
  }
  if (js && /suppressClick\s*=\s*true/.test(js) && !/suppressClick\s*=\s*false/.test(js)) {
    err('슬라이드: suppressClick 을 켜기만 하고 내리지 않는다 — 이후 클릭이 전멸한다');
  }
  if (js && /ResizeObserver/.test(js) && !/try\s*\{[\s\S]{0,200}ResizeObserver/.test(js)) {
    warn('슬라이드: ResizeObserver 가 try/catch 로 감싸여 있지 않다 — 미지원 환경에서 위젯 전체가 죽는다');
  }
  if (js && /offsetWidth/.test(js)) ok('슬라이드: 반응형 판정이 컨테이너 폭 기준');
  if (js && /getAttribute\(\s*['"]data-autoplay['"]\s*\)/.test(js) && !/===\s*['"]true['"]/.test(js)) {
    err('슬라이드: switch 값을 boolean 처럼 쓴다 — 렌더 값은 "true"/"false" 문자열이다');
  }
}

if (hasSched) {
  if (js && !/\+09:00/.test(js)) {
    err('노출 예약: 타임존이 +09:00 로 고정돼 있지 않다 — 해외 접속자에게 다르게 보인다');
  }
  if (js && !/오전[\s\S]{0,80}12/.test(js)) {
    err('노출 예약: 오전/오후 12시 보정이 없다 — 정오 근처에서 하루 두 번 어긋난다');
  }
  if (js && !/removeChild/.test(js)) {
    err('노출 예약: 기간 밖 아이템을 DOM 에서 제거하지 않는다 — 숨기면 인덱스·도트 계산에 섞인다');
  }
  if (css && /data-date-start[\s\S]{0,80}display:\s*none/.test(css)) {
    err('노출 예약: CSS 로 숨기고 있다 — 제거해야 한다');
  }
  if (js && !/for\s*\(\s*let\s+\w+\s*=\s*\w+\.length\s*-\s*1/.test(js)) {
    warn('노출 예약: 제거 순회가 역순이 아니다 — 순회 중 제거하면 인덱스가 밀린다');
  }
  const need = ['data-date-start', 'data-time-start', 'data-date-end', 'data-time-end'];
  const missing = need.filter((n) => !html.includes(n));
  if (html && missing.length) err(`노출 예약: HTML 에 ${missing.join(', ')} 누락 — 4개가 한 세트다`);
  else if (html) ok('노출 예약: 4종 data 속성 모두 존재');
}

// ── 3. widget-generator 금지 패턴 ───────────────────────────────
const banned = [
  [js, /\bvar\s+\w/, 'JS: var 사용 — const/let 을 쓴다'],
  [js, /\.dataset\b/, 'JS: el.dataset 접근 — getAttribute/setAttribute 로 통일한다'],
  [js, /document\.addEventListener/, 'JS: document.addEventListener — 런타임 미제공. 위젯 루트에 바인딩한다'],
  [js, /querySelectorAll\([^)]*\)\.forEach/, 'JS: NodeList 에 forEach — for 루프를 쓴다'],
  [js, /setAttribute\(\s*['"]style['"]/, "JS: setAttribute('style', ...) — el.style.prop 을 쓴다"],
  [js, /\b(eval|fetch|XMLHttpRequest|localStorage|sessionStorage)\b/, 'JS: 차단 API 사용'],
  [js, /matchMedia/, 'JS: matchMedia — 샌드박스에 없다. offsetWidth + ResizeObserver 를 쓴다'],
  [js, /window\.innerWidth/, 'JS: innerWidth 로 반응형 판정 — 디자인모드에서 틀린 답이 나온다'],
  [css, /!important/, 'CSS: !important — specificity 로 해결한다'],
  [css, /@import/, 'CSS: @import — 저장 차단'],
  [css, /url\(\s*['"]?data:/, 'CSS: url(data:) — 저장 차단'],
  [css, /@media\s+(screen|only|not)\b/, 'CSS: 미디어 타입이 섞인 쿼리 — 순수 width 쿼리만 디자인모드 모바일 뷰에 반영된다'],
  [html, /\{\{\{|\{\{&/, 'HTML: 삼중 중괄호 / ampersand — 저장 차단'],
  [html, /\son[a-z]+\s*=/i, 'HTML: on* 인라인 핸들러 — 저장 차단'],
  [html, /\sstyle\s*=/, 'HTML: 인라인 style — 모든 스타일은 CSS 탭으로'],
  [html, /<(script|iframe|object|embed|form|style)\b/i, 'HTML: 차단 태그'],
  [html, /\{\{\s*[\w-]+\.[\w-]+\s*\}\}/, 'HTML: 점 경로 — top-level 변수만 참조 가능'],
];
for (const [src, re, msg] of banned) {
  if (src && re.test(src)) err(msg);
}
if (css && !/:where\(\s*\*/.test(css)) {
  warn('CSS: :where(*, *::before, *::after) 박스 리셋으로 시작하지 않는다');
}

// ── 출력 ────────────────────────────────────────────────────────
if (ERR.length) {
  console.log(`ERROR ${ERR.length}건`);
  ERR.forEach((e) => console.log(`  ✗ ${e}`));
  console.log('');
}
if (WARN.length) {
  console.log(`WARN ${WARN.length}건`);
  WARN.forEach((w) => console.log(`  ! ${w}`));
  console.log('');
}
if (OK.length) {
  console.log('확인됨');
  OK.forEach((o) => console.log(`  ✓ ${o}`));
  console.log('');
}
if (!ERR.length && !WARN.length) console.log('통과 — 세트 조합·구성·금지 패턴 위반 없음');
process.exit(ERR.length ? 1 : 0);
