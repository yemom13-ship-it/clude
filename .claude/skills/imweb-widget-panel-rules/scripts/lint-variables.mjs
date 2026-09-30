#!/usr/bin/env node
// 위젯 변수 탭 JSONC 문서를 「4. 설정패널 규정」으로 검사한다.
//   [스키마]  widget-generator 스펙 위반 → 저장 차단·무음 유실
//   [규정]    가이드라인 4-1~4-4 (제작 원칙·명칭·그룹핑·플레이스홀더)
//
//   node scripts/lint-variables.mjs variables.jsonc
//   pbpaste | node scripts/lint-variables.mjs
//
// 종료코드: ERROR 있으면 1.
import fs from 'fs';

const ERR = [];
const WARN = [];
const err = (p, m) => ERR.push(`${p}: ${m}`);
const warn = (p, m) => WARN.push(`${p}: ${m}`);

// ---------- 스펙 상수 (widget-generator §4) ----------
const PREFIX = {
  textfield: 'text', 'text-editor': 'editor', select: 'select', segment: 'segment',
  color: 'color', image: 'image', date: 'date', time: 'time', switch: 'switch', item: 'item',
};
const TYPES = Object.keys(PREFIX);
// 타입별 허용 키 (label 은 공통). 인식 키를 잘못된 타입에 쓰면 저장 차단.
const ALLOWED = {
  textfield: ['default', 'placeholder', 'suffix'],
  'text-editor': ['default', 'placeholder'],
  select: ['values', 'valueNames', 'default', 'placeholder'],
  segment: ['values', 'valueNames', 'default', 'placeholder'],
  color: ['default', 'placeholder'],
  image: ['placeholder'],
  date: ['default', 'placeholder'],
  time: ['default', 'placeholder'],
  switch: ['default'],
  item: ['fields', 'default', 'maxLength'],
};
const RECOGNIZED = new Set(['type', 'label', 'default', 'placeholder', 'values', 'valueNames', 'suffix', 'maxLength', 'fields', 'length']);
const LIMIT = {
  vars: 50, itemRows: 20, itemFields: 20, label: 30, groupLabel: 18, help: 35,
  placeholder: 15, suffix: 5, name: 30, selectOpts: 10, segmentOpts: 4,
  segmentName: 8, selectName: 51, optValue: 51, stringDefault: 4000,
};
const RESERVED = new Set(['type', 'widget']);

// ---------- 디자인 관례 (기본 위젯 30종) ----------
const LEXICON = [
  { bad: /색상/, ok: /컬러/, msg: '색상 → 컬러' },
  { bad: /글자|문자열|폰트/, ok: /텍스트/, msg: '글자/문자/폰트 → 텍스트' },
  { bad: /패딩|padding/i, ok: /여백/, msg: '패딩 → 여백' },
  { bad: /마진|margin|갭|gap/i, ok: /간격/, msg: '마진/갭 → 간격' },
  { bad: /라운드|radius/i, ok: /모서리 둥글기/, msg: '라운드/radius → 모서리 둥글기' },
  { bad: /보더|border/i, ok: /테두리/, msg: '보더 → 테두리' },
  { bad: /사이즈|size/i, ok: /크기/, msg: '사이즈 → 크기' },
  { bad: /백그라운드/, ok: /배경/, msg: '백그라운드 → 배경' },
  { bad: /폭|넓이/, ok: /너비/, msg: '폭/넓이 → 너비' },
  { bad: /제목/, ok: /타이틀/, msg: '제목 → 타이틀' },
  { bad: /부제/, ok: /서브 텍스트/, msg: '부제 → 서브 텍스트' },
  { bad: /마우스오버|마우스호버|호버|hover/i, ok: /마우스 오버/, msg: '마우스오버/마우스호버/호버 → "마우스 오버"' },
  { bad: /선 두께/, ok: /테두리 두께/, msg: '선 두께 → 테두리 두께' },
  { bad: /새 창으로 열기|새창으로 열기|새 ?탭으로/, msg: '→ "새창으로 이동"' },
  { bad: /링크 ?URL/i, msg: '링크 URL → 링크' },
  { bad: /링크 바로가기|바로가기/, msg: '링크 바로가기 → 링크' },
  { bad: /연결 ?링크/, msg: '연결 링크 → 링크' },
];
const PX_LABEL = /크기|여백|간격|두께|둥글기|높이|너비/;
const SEC_LABEL = /속도|지속 시간|지연 시간|전환 시간|재생 간격|전환 간격|표시 시간/;

// ---------- JSONC 파싱 ----------
function stripJsonc(src) {
  let out = '';
  const comments = [];
  let i = 0, inStr = false, quote = '';
  while (i < src.length) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
      if (c === quote) inStr = false;
      i++; continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; out += c; i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      let j = src.indexOf('\n', i);
      if (j === -1) j = src.length;
      comments.push({ text: src.slice(i + 2, j).trim(), line: src.slice(0, i).split('\n').length });
      out += ' '.repeat(j - i);
      i = j; continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      err('문서', '/* */ 블록 주석은 파싱에 실패한다 — // 라인 주석만 쓴다');
      let j = src.indexOf('*/', i);
      if (j === -1) j = src.length; else j += 2;
      out += ' '.repeat(j - i);
      i = j; continue;
    }
    out += c; i++;
  }
  return { text: out.replace(/,(\s*[}\]])/g, '$1'), comments };
}

// ---------- 입력 ----------
const raw = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : fs.readFileSync(0, 'utf8');
if (!raw.trim()) {
  console.error('빈 문서는 파싱에 실패한다 — 변수가 없어도 최소 {} 를 넣는다.');
  process.exit(2);
}
const { text, comments } = stripJsonc(raw);
let root;
try {
  root = JSON.parse(text);
} catch (e) {
  console.error(`JSONC 파싱 실패: ${e.message}`);
  process.exit(2);
}
if (Array.isArray(root) || typeof root !== 'object' || root === null) {
  console.error('최상위는 하나의 JSON 객체여야 합니다.');
  process.exit(2);
}
if (root.variables && typeof root.variables === 'object' && !root.variables.type) root = root.variables;

// 도움말(// 주석) 길이
for (const c of comments) {
  if (c.text.length > LIMIT.help) warn(`${c.line}행 주석`, `도움말은 ${LIMIT.help}자 이내 (현재 ${c.text.length}자)`);
}

// ---------- 분류 ----------
const isVar = (v) => v && typeof v === 'object' && !Array.isArray(v) && 'type' in v;
const isGroup = (v) => v && typeof v === 'object' && !Array.isArray(v) && !('type' in v) && 'children' in v;

const groups = [];
const rootVars = [];
for (const [key, val] of Object.entries(root)) {
  if (isVar(val)) { rootVars.push([key, val]); continue; }
  if (isGroup(val)) {
    if (typeof val.children !== 'object' || Array.isArray(val.children)) { err(key, 'children 은 객체여야 한다'); continue; }
    if (val.opened !== undefined && typeof val.opened !== 'boolean') err(`그룹 "${key}"`, 'opened 는 boolean 이다');
    const kids = Object.entries(val.children);
    for (const [ck, cv] of kids) {
      if (cv && typeof cv === 'object' && !('type' in cv) && 'children' in cv) {
        err(`그룹 "${key}"`, `중첩 그룹 "${ck}" — 안쪽 그룹과 그 자식이 통째로 조용히 폐기된다`);
      }
    }
    groups.push({ label: key, opened: val.opened !== false, vars: kids.filter(([, v]) => isVar(v)) });
    continue;
  }
  err(key, 'type 도 children 도 없다 — 이 항목은 오류 없이 조용히 사라진다 (가장 흔한 무음 유실)');
}
const allVars = [...groups.flatMap((g) => g.vars.map(([n, d]) => [n, d, g.label])), ...rootVars.map(([n, d]) => [n, d, null])];

// ---------- 이름 ----------
const seenNames = new Map();
function checkName(name, p, { inItem = false } = {}) {
  if (!/^[A-Za-z]/.test(name)) err(p, `변수명은 영문으로 시작한다: "${name}"`);
  if (!/^[A-Za-z0-9-]+$/.test(name)) err(p, `변수명은 영문·숫자·하이픈만 쓴다: "${name}"`);
  if (name.endsWith('-')) err(p, `변수명은 하이픈으로 끝날 수 없다: "${name}"`);
  if (name.length > LIMIT.name) err(p, `변수명은 ${LIMIT.name}자 이내 (현재 ${name.length}자): "${name}"`);
  if (RESERVED.has(name)) err(p, `예약어는 변수명으로 쓸 수 없다: "${name}"`);
  if (name.startsWith('_')) err(p, `"_" 접두는 시스템 예약이다: "${name}"`);
  if (/^imweb/i.test(name)) err(p, `"imweb" 접두는 플랫폼 예약이다: "${name}"`);
  if (name !== name.toLowerCase()) warn(p, `소문자 kebab-case 를 쓴다: "${name}"`);
  if (!inItem) {
    if (seenNames.has(name)) err(p, `변수명은 그룹과 무관하게 전역 유일해야 한다 — "${name}" 중복`);
    else seenNames.set(name, p);
  }
}

// ---------- 변수 검사 ----------
const labels = [];
let itemCount = 0;
const itemFieldNames = [];

function checkVar(name, def, where, { inItem = false } = {}) {
  const p = where ? `${where} > ${name}` : name;
  checkName(name, p, { inItem });

  const type = def.type;
  if (!type) return err(p, 'type 누락 — 이 항목은 조용히 사라진다');
  if (!TYPES.includes(type)) return err(p, `알 수 없는 type "${type}" — 사용 가능: ${TYPES.join(', ')}`);
  if (inItem && type === 'item') return err(p, '중첩 리스트 불가 — 아이템 하위에 item 을 둘 수 없다');

  // 접두사 (관례)
  const want = PREFIX[type];
  const got = name.split('-')[0];
  if (got !== want && name !== want && name !== `${want}s`) {
    const msg = `변수명 접두는 type 과 맞춘다: ${type} → "${want}-…" (현재 "${name}")`;
    if (Object.values(PREFIX).includes(got)) err(p, `${msg} — 다른 type 의 접두다`);
    else if (!inItem) warn(p, msg);   // 아이템 하위 필드는 접두사 선택
  }

  // 키 검증
  const allowed = new Set(['type', 'label', ...ALLOWED[type]]);
  for (const k of Object.keys(def)) {
    if (k === 'length') { err(p, 'length 키는 폐기됐다 — default 배열이 행 개수의 단일 출처다 (병용 시 저장 차단)'); continue; }
    if (!RECOGNIZED.has(k)) { warn(p, `인식되지 않는 키 "${k}" — 경고 후 무시된다`); continue; }
    if (!allowed.has(k)) err(p, `"${k}" 는 ${type} 에 쓸 수 없는 키다 — 저장이 차단된다`);
  }
  if (type === 'image' && 'default' in def) err(p, 'image 에는 default 를 쓰지 않는다 — 값으로 파생되지 않아 무의미하다');
  if ((type === 'select' || type === 'segment') && !def.values) err(p, `${type} 에 values 는 필수다`);
  if (type === 'item' && !def.fields) err(p, 'item 에 fields 는 필수다');

  // 라벨
  const label = def.label;
  if (label === undefined || label === '') {
    err(p, 'label 누락 — 패널에 변수명이 그대로 노출된다');
  } else if (typeof label !== 'string') {
    err(p, 'label 은 문자열이어야 한다');
  } else {
    labels.push(label);
    if (label.length > LIMIT.label) err(p, `label 은 ${LIMIT.label}자 이내 (현재 ${label.length}자)`);
    if (label !== label.trim()) err(p, `label 앞뒤 공백: "${label}"`);
    if (/ {2}/.test(label)) err(p, `label 이중 공백: "${label}"`);
    if (/\((초|px|ms|개|%)\)/.test(label)) warn(p, `단위는 label 이 아니라 suffix 로: "${label}"`);
    else if (/[(（][^)）]{1,20}[)）]/.test(label)) warn(p, `부연 문구를 제거한다 (규정 4-2 9번): "${label}"`);
    if (/데스크톱|데스크탑/.test(label)) err(p, `데스크톱 → PC: "${label}"`);
    if (/[가-힣]\d/.test(label.replace(/\d+:\d+/g, ''))) warn(p, `숫자 앞에 공백 (예: "텍스트 1"): "${label}"`);
    if (/(?<![0-9])-(?![0-9])/.test(label)) warn(p, `요소 연결은 가운뎃점(·): "${label}"`);
    if (/여부$|사용$/.test(label)) warn(p, `"~여부/~사용" 접미 지양 — 켜진 상태를 서술한다: "${label}"`);
    if (label.length > 14) warn(p, `라벨이 길다(${label.length}자) — 기본 위젯 최장 14자, 패널 폭이 좁다: "${label}"`);
    for (const { bad, ok, msg } of LEXICON) {
      if (bad.test(label) && !(ok && ok.test(label))) warn(p, `어휘: ${msg} — "${label}"`);
    }
  }

  // suffix (textfield 전용)
  if ('suffix' in def) {
    const s = String(def.suffix);
    if (s.length > LIMIT.suffix) err(p, `suffix 는 ${LIMIT.suffix}자 이내 (현재 "${s}")`);
    if (s === 'ms') warn(p, 'ms 대신 초를 쓴다 (기본 위젯 76 : 3)');
    else if (!['px', '초', '%'].includes(s)) warn(p, `기본 위젯의 suffix 는 px · 초 뿐이다 (현재 "${s}")`);
  } else if (type === 'textfield' && label) {
    if (PX_LABEL.test(label) && !SEC_LABEL.test(label)) err(p, `"${label}" 에는 suffix: "px" 를 넣는다 (기본 위젯 258건, 누락 0건)`);
    else if (SEC_LABEL.test(label)) err(p, `"${label}" 에는 suffix: "초" 를 넣는다 (기본 위젯 76건)`);
  }

  // 선택지
  if (type === 'select' || type === 'segment') {
    const v = def.values, n = def.valueNames;
    const maxOpt = type === 'select' ? LIMIT.selectOpts : LIMIT.segmentOpts;
    const maxName = type === 'select' ? LIMIT.selectName : LIMIT.segmentName;
    if (Array.isArray(v)) {
      if (!v.length) err(p, 'values 는 1개 이상이어야 한다');
      if (v.length > maxOpt) err(p, `${type} 선택지는 최대 ${maxOpt}개 (현재 ${v.length})`);
      for (const x of v) {
        if (String(x).length > LIMIT.optValue) err(p, `옵션 값은 ${LIMIT.optValue}자 이내: "${x}"`);
        if (!/^[a-z0-9.:_-]+$/i.test(String(x))) warn(p, `옵션 값은 영문 kebab-case 를 쓴다: "${x}"`);
      }
      if (n !== undefined) {
        if (!Array.isArray(n)) err(p, 'valueNames 는 배열이어야 한다');
        else {
          if (n.length !== v.length) err(p, `valueNames(${n.length}) 는 values(${v.length}) 와 길이가 정확히 같아야 한다`);
          for (const x of n) if (String(x).length > maxName) err(p, `${type} 옵션 이름은 ${maxName}자 이내: "${x}"`);
        }
      } else {
        warn(p, 'valueNames 가 없으면 패널에 내부값이 그대로 노출된다');
      }
      if (def.default !== undefined && !v.includes(def.default)) err(p, `default "${def.default}" 가 values 에 없다`);
      if (type === 'select' && v.length <= 2) warn(p, `선택지 ${v.length}개면 segment 가 적합하다`);
      if (type === 'segment' && v.length >= 5) warn(p, `선택지 ${v.length}개면 select 가 적합하다`);
    } else if (v !== undefined) {
      err(p, 'values 는 배열이어야 한다');
    }
  }

  // default 형식
  if ('default' in def && type !== 'item') {
    const d = def.default;
    if (typeof d === 'string' && d.length > LIMIT.stringDefault) err(p, `문자열 default 는 ${LIMIT.stringDefault}자 이내`);
    if (type === 'switch' && typeof d !== 'boolean') err(p, `switch 의 default 는 boolean 리터럴 true/false (현재 ${JSON.stringify(d)})`);
    if (type === 'color' && !/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(d))) err(p, `color 의 default 는 #RRGGBB 또는 #RRGGBBAA (3자리·rgba·hsl 불가, 현재 ${JSON.stringify(d)})`);
    if (type === 'date' && d !== '' && !/^\d{4}\.\d{2}\.\d{2}$/.test(String(d))) err(p, `date 의 default 는 "YYYY.MM.DD" (현재 ${JSON.stringify(d)})`);
    if (type === 'time' && d !== '' && !/^(오전|오후) \d{1,2}시 \d{2}분$/.test(String(d))) err(p, `time 의 default 는 "오전|오후 H시 MM분" (현재 ${JSON.stringify(d)})`);
    if (type === 'textfield') {
      if (typeof d === 'number') err(p, 'textfield 의 default 는 문자열이다 (예: "16")');
      else if (/^\d+(\.\d+)?(px|%|초|s|ms|em|rem)$/.test(String(d))) err(p, `숫자 default 에 단위를 붙이지 않는다 — suffix 로 표기한다 (현재 "${d}")`);
    }
  }

  // placeholder
  if ('placeholder' in def) {
    const ph = String(def.placeholder);
    if (ph.length > LIMIT.placeholder) err(p, `placeholder 는 ${LIMIT.placeholder}자 이내 (현재 ${ph.length}자)`);
    if (/^\d+(\.\d+)?(px|초|s|ms|%)$/.test(ph)) warn(p, `숫자 placeholder 에 단위를 붙이지 않는다: "${ph}"`);
  }
  if (type === 'textfield' && /^링크/.test(label || '') && def.placeholder !== 'https://') {
    warn(p, '링크 입력의 placeholder 는 "https://"');
  }

  // item
  if (type === 'item') {
    itemCount++;
    const fields = def.fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return;
    const fnames = Object.keys(fields);
    if (!fnames.length) return err(p, 'fields 는 1개 이상이어야 한다');
    if (fnames.length > LIMIT.itemFields) err(p, `아이템 하위 필드는 최대 ${LIMIT.itemFields}개 (현재 ${fnames.length})`);

    const fl = [];
    for (const [fn, fd] of Object.entries(fields)) {
      if (!fd || typeof fd !== 'object') { err(`${p} > ${fn}`, '필드 정의는 객체여야 한다'); continue; }
      if ('default' in fd) err(`${p} > ${fn}`, '하위 필드 정의에는 default 를 두지 않는다 — 값은 전부 default 인스턴스 배열에 (저장 차단)');
      itemFieldNames.push(fn);
      checkVar(fn, fd, p, { inItem: true });
      if (fd.label) fl.push(fd.label);
    }

    // maxLength
    const rows = Array.isArray(def.default) ? def.default.length : 0;
    if ('maxLength' in def) {
      const ml = def.maxLength;
      if (!Number.isInteger(ml) || ml < 1 || ml > LIMIT.itemRows) err(p, `maxLength 는 1~${LIMIT.itemRows} 정수 (현재 ${JSON.stringify(ml)})`);
      else if (ml < rows) err(p, `maxLength(${ml}) 가 default 행 수(${rows})보다 작다`);
    }

    // default 인스턴스
    if (!Array.isArray(def.default)) {
      err(p, 'default 인스턴스 배열이 없다 — 초기 행의 단일 출처다');
    } else {
      if (rows > LIMIT.itemRows) err(p, `default 행은 최대 ${LIMIT.itemRows}행 (현재 ${rows})`);
      if (rows === 0) err(p, 'default 배열이 비어 있다 — 실제 내용이 담긴 행을 채운다');
      def.default.forEach((inst, i) => {
        if (!inst || typeof inst !== 'object' || Array.isArray(inst)) return err(`${p}.default[${i}]`, '인스턴스는 객체여야 한다');
        const keys = Object.keys(inst);
        const missing = fnames.filter((k) => !keys.includes(k));
        const extra = keys.filter((k) => !fnames.includes(k));
        if (missing.length) err(`${p}.default[${i}]`, `fields 에 있는 키 누락: ${missing.join(', ')}`);
        if (extra.length) err(`${p}.default[${i}]`, `fields 에 없는 키: ${extra.join(', ')}`);
        for (const [k, v] of Object.entries(inst)) {
          const ft = fields[k]?.type;
          if (ft === 'image' && v !== '') warn(`${p}.default[${i}]`, `image 하위 필드 "${k}" 값은 빈 문자열이어야 한다`);
          if (ft === 'switch' && typeof v !== 'boolean') err(`${p}.default[${i}]`, `switch 하위 필드 "${k}" 값은 boolean 이다`);
        }
      });
      const allSame = rows > 1 && new Set(def.default.map((x) => JSON.stringify(x))).size === 1;
      if (allSame) warn(p, '모든 행의 값이 같다 — 행마다 그 항목의 실제 내용을 채운다');
    }

    // 링크 ↔ 새창
    if (fl.some((l) => /^링크/.test(l)) && !fl.some((l) => /새창으로 이동|새 ?창으로 열기|새 ?탭/.test(l))) {
      err(p, '"링크" 필드가 있으면 "새창으로 이동" 스위치를 함께 넣는다 (기본 위젯 예외 0건)');
    }
    // 노출 예약 4종
    const SCHED = /^(시작|종료|노출 시작|노출 종료)\s*(날짜|시간|일)$/;
    const entries = Object.entries(fields);
    const sched = entries.filter(([, fd]) => SCHED.test((fd?.label || '').trim()));
    if (sched.length) {
      if (sched.length !== 4) {
        err(p, `노출 예약은 시작 날짜/시작 시간/종료 날짜/종료 시간 4개 한 세트 (현재 ${sched.length}개)`);
      } else {
        const got2 = sched.map(([, fd]) => fd.label.trim());
        const want2 = ['시작 날짜', '시작 시간', '종료 날짜', '종료 시간'];
        const alt = ['노출 시작일', '노출 시작 시간', '노출 종료일', '노출 종료 시간'];
        if (got2.join('|') !== want2.join('|')) {
          if (got2.join('|') === alt.join('|')) warn(p, `노출 예약 라벨은 "${want2.join(' / ')}" 를 쓴다 (기본 위젯 6:3)`);
          else err(p, `노출 예약은 "${want2.join(' → ')}" 순서로 넣는다 (현재 ${got2.join(' → ')})`);
        }
        for (const [fn, fd] of sched) {
          const wantT = /(날짜|일)$/.test(fd.label.trim()) ? 'date' : 'time';
          if (fd.type !== wantT) err(`${p} > ${fn}`, `"${fd.label}" 은 type: "${wantT}" 이어야 한다 (현재 "${fd.type}")`);
        }
        const names = sched.map(([fn]) => fn);
        const std = ['date-start', 'time-start', 'date-end', 'time-end'];
        if (names.join('|') !== std.join('|')) warn(p, `노출 예약 변수명은 ${std.join(' · ')} 를 쓴다 (현재 ${names.join(' · ')})`);
        if (entries.slice(-4).map(([fn]) => fn).join('|') !== names.join('|')) warn(p, '노출 예약 4종은 아이템 필드 맨 끝에 둔다');
      }
    }
  }
}

for (const [name, def, gLabel] of allVars) checkVar(name, def, gLabel);

// ---------- 그룹 ----------
for (const g of groups) {
  const gp = `그룹 "${g.label}"`;
  if (!g.label.trim()) { err('그룹', '그룹 라벨이 비어 있다'); continue; }
  if (g.label !== g.label.trim()) err(gp, '그룹 라벨 앞뒤 공백');
  if (g.label.length > LIMIT.groupLabel) err(gp, `그룹 라벨은 ${LIMIT.groupLabel}자 이내 (현재 ${g.label.length}자)`);
  if (/^(그룹|항목 이름)\s*\d+$/.test(g.label)) err(gp, '자동 생성 기본 이름이 남아 있다');
  if (!g.vars.length) err(gp, '빈 그룹은 저장이 차단된다 — 하위 항목이 최소 1개 필요하다');
  for (const { bad, ok, msg } of LEXICON) {
    if (bad.test(g.label) && !(ok && ok.test(g.label))) warn(gp, `어휘: ${msg}`);
  }
  const ls = g.vars.map(([, d]) => d?.label).filter(Boolean);
  [...new Set(ls.filter((l, i) => ls.indexOf(l) !== i))].forEach((l) => err(gp, `같은 그룹 안에 중복 라벨: "${l}"`));
}

// ---------- 문서 전체 ----------
if (allVars.length > LIMIT.vars) err('전체', `변수는 최대 ${LIMIT.vars}개 (현재 ${allVars.length}개)`);
if (itemCount > 1) err('전체', `item 은 위젯 전체에서 1종 (현재 ${itemCount}종) — 모든 항목을 하나의 배열에 모은다`);
for (const fn of itemFieldNames) {
  if (seenNames.has(fn)) err('전체', `아이템 하위 필드명 "${fn}" 이 최상위 변수명과 겹친다 — 에디터가 루트 참조로 해석한다`);
}
if (rootVars.length && groups.length) {
  warn('전체', `그룹 밖 변수 ${rootVars.length}개: ${rootVars.map(([n]) => n).join(', ')} — 기본 위젯 30종은 모든 항목이 그룹 안에 있다`);
}
const opened = groups.filter((g) => g.opened);
if (opened.length > 1) warn('전체', `펼친 그룹이 ${opened.length}개 (${opened.map((g) => g.label).join(', ')}) — 위젯당 1개까지만. opened 기본값이 true 이므로 나머지는 false 를 명시한다`);

// 규정 4-3: 노출 예약은 그룹이 아니라 아이템 하위 필드다
const schedGroup = groups.find((g) => /^노출\s*예약$/.test(g.label));
if (schedGroup) {
  err('그룹 "노출 예약"', '노출 예약은 최상위 그룹이 아니라 아이템 하위 필드로 넣는다 — '
    + '그룹으로 만들면 위젯 전체에 기간이 하나만 걸려 슬라이드별 예약이 불가능하다 '
    + '(기본 위젯 30종: 최상위 그룹 0건 / 아이템 하위 9건)');
}
// 아이템 밖 최상위에 날짜·시간 4종이 흩어져 있는 경우도 같은 사고다
const topSched = groups.flatMap((g) => g.vars)
  .filter(([, d]) => (d?.type === 'date' || d?.type === 'time')
    && /^(시작|종료|노출 시작|노출 종료)\s*(날짜|시간|일)$/.test((d.label || '').trim()));
if (!schedGroup && topSched.length >= 3) {
  err('전체', `노출 예약 항목 ${topSched.length}개가 아이템 밖에 있다 — 아이템 fields 안에 넣어야 슬라이드별 예약이 된다`);
}

const gLabels = groups.map((g) => g.label);
const animIdx = gLabels.findIndex((l) => l === '등장 애니메이션' || l === '애니메이션');
if (animIdx === -1) {
  warn('전체', '"등장 애니메이션" 그룹이 없다 — 기본 위젯 27/30 이 제공한다');
} else {
  if (animIdx !== gLabels.length - 1) err('전체', `"${gLabels[animIdx]}" 은 항상 마지막 그룹이어야 한다 (현재 ${animIdx + 1}/${gLabels.length})`);
  if (gLabels[animIdx] === '애니메이션' && groups.length > 5) warn('전체', '그룹이 5개를 넘으면 "등장 애니메이션" 을 쓴다');
  const af = groups[animIdx].vars.map(([, d]) => (d?.label || '').replace(/\s*\([^)]*\)\s*$/, '').trim());
  for (const need of ['스타일', '지속 시간', '지연 시간']) {
    if (!af.includes(need)) err('전체', `등장 애니메이션은 스타일·지속 시간·지연 시간 3종 한 세트 — "${need}" 누락`);
  }
}

const btnColors = allVars.filter(([n, d]) => d?.type === 'color' && /버튼|btn/i.test(`${d.label} ${n}`));
if (btnColors.length) {
  const hover = btnColors.filter(([n, d]) => /마우스 ?오버|hover/i.test(`${d.label} ${n}`)).length;
  if (hover > 0 && hover !== 3) err('전체', `버튼 마우스 오버 색상은 텍스트·배경·테두리 3개 한 세트 (현재 ${hover}개)`);
}
for (const [, d] of allVars) {
  const m = /^(.+) 크기$/.exec(d?.label || '');
  if (!m || d.type !== 'textfield') continue;
  if (!labels.includes(`${m[1]} 컬러`) && !labels.includes(`${m[1]} 색상`)) {
    warn('전체', `"${d.label}" 만 있고 "${m[1]} 컬러" 가 없다 — 크기·컬러는 쌍으로 넣는다`);
  }
}
const pc = labels.filter((l) => /^PC /.test(l)).map((l) => l.slice(3));
const mo = labels.filter((l) => /^모바일 /.test(l)).map((l) => l.slice(4));
pc.filter((k) => !mo.includes(k)).forEach((k) => warn('전체', `"PC ${k}" 만 있고 "모바일 ${k}" 가 없다`));
mo.filter((k) => !pc.includes(k)).forEach((k) => warn('전체', `"모바일 ${k}" 만 있고 "PC ${k}" 가 없다`));

// ---------- 출력 ----------
const byType = {};
allVars.forEach(([, d]) => (byType[d?.type || '(없음)'] = (byType[d?.type || '(없음)'] || 0) + 1));
console.log(`그룹 ${groups.length}개 · 변수 ${allVars.length}개 · 도움말 ${comments.length}개`);
console.log(`그룹 순서: ${gLabels.join(' > ') || '(없음)'}`);
console.log(Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('');
if (ERR.length) {
  console.log(`ERROR ${ERR.length}건 — 제출 전 반드시 수정`);
  ERR.forEach((e) => console.log(`  ✗ ${e}`));
  console.log('');
}
if (WARN.length) {
  console.log(`WARN ${WARN.length}건 — 기본 위젯 관례와 다름`);
  WARN.forEach((w) => console.log(`  ! ${w}`));
  console.log('');
}
if (!ERR.length && !WARN.length) console.log('통과 — 스키마·관례 위반 없음');
process.exit(ERR.length ? 1 : 0);
