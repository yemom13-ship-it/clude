#!/usr/bin/env node
// 아임웹 기본 제공 위젯 30종의 설정패널을 변수 탭 형식으로 조회한다.
//
//   panel-ref.mjs                    그룹 사용 빈도 요약 + 위젯 목록
//   panel-ref.mjs <검색어>            제목 검색 → 그룹 구성 한 줄 요약
//   panel-ref.mjs --show <제목>       그 위젯의 변수 JSON 전문 (복사해 쓰면 된다)
//   panel-ref.mjs --group <그룹명>    그 그룹을 쓴 위젯들의 실제 구성
//   panel-ref.mjs --label <라벨조각>  그 라벨을 어디서 어떤 type 으로 썼는지
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const W = JSON.parse(fs.readFileSync(path.join(HERE, '../assets/default-widget-variables.json'), 'utf8'));

const entries = (g) => Object.entries(g.children || {});

const line = (name, d, indent = '    ') => {
  const bits = [d.type];
  if (d.placeholder) bits.push(`placeholder="${d.placeholder}"`);
  let s = `${indent}${name}  —  ${d.label}  (${bits.join(', ')})`;
  if (d.values) s += `\n${indent}    ${d.values.map((v, i) => `${d.valueNames?.[i] ?? v}=${v}`).join(', ')}`;
  if (d.fields) {
    for (const [fn, fd] of Object.entries(d.fields)) {
      s += `\n${indent}    ↳ ${fn}  —  ${fd.label}  (${fd.type})`;
    }
  }
  return s;
};

const [flag, ...rest] = process.argv.slice(2);
const arg = rest.join(' ');

function main() {
  if (flag === '--show') {
    const hits = W.filter((w) => w.title.includes(arg));
    if (!hits.length) return void console.log(`'${arg}' 로 찾은 위젯 없음`);
    for (const w of hits) {
      console.log(`// ${w.title}  (${w.code})`);
      console.log(JSON.stringify(w.variables, null, 2));
    }
    return;
  }

  if (flag === '--group') {
    let n = 0;
    for (const w of W) {
      const gs = Object.entries(w.variables);
      gs.forEach(([label, g], i) => {
        if (!label.includes(arg)) return;
        n++;
        console.log(`\n${w.title}  —  [${i + 1}/${gs.length}] ${label}${g.opened ? '  (펼침)' : ''}`);
        entries(g).forEach(([name, d]) => console.log(line(name, d, '  ')));
      });
    }
    console.log(`\n총 ${n}개 위젯에서 사용`);
    return;
  }

  if (flag === '--label') {
    const seen = new Map();
    for (const w of W) {
      for (const [gl, g] of Object.entries(w.variables)) {
        const scan = (name, d, parent) => {
          if (!d.label?.includes(arg)) return;
          const k = `${d.label}\t${d.type}\t${name}`;
          if (!seen.has(k)) seen.set(k, []);
          seen.get(k).push(`${w.title}/${gl}${parent ? `/${parent}` : ''}`);
        };
        entries(g).forEach(([name, d]) => {
          scan(name, d, null);
          Object.entries(d.fields || {}).forEach(([fn, fd]) => scan(fn, fd, name));
        });
      }
    }
    if (!seen.size) return void console.log(`'${arg}' 라벨 없음`);
    [...seen.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([k, v]) => {
        const [label, type, name] = k.split('\t');
        console.log(`\n"${label}"   type: ${type}   변수명: ${name}   x${v.length}`);
        console.log(`   ${v.join(', ')}`);
      });
    return;
  }

  if (flag) {
    const q = [flag, ...rest].join(' ');
    const hits = W.filter((w) => w.title.includes(q));
    if (!hits.length) return void console.log(`'${q}' 로 찾은 위젯 없음. 전체 목록:\n  ${W.map((w) => w.title).join(', ')}`);
    hits.forEach((w) => console.log(`${w.title.padEnd(18)} : ${Object.keys(w.variables).join(' > ')}`));
    console.log(`\n전문을 보려면: panel-ref.mjs --show "${hits[0].title}"`);
    return;
  }

  const g = new Map();
  W.forEach((w) => Object.keys(w.variables).forEach((label, i) => {
    if (!g.has(label)) g.set(label, []);
    g.get(label).push(i);
  }));
  console.log(`위젯 ${W.length}종, 그룹 ${g.size}종\n`);
  console.log('그룹'.padEnd(24) + '사용  평균위치');
  [...g.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => {
    const avg = (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1);
    console.log(`${k.padEnd(24)}${String(v.length).padStart(4)}  ${avg}`);
  });
  console.log(`\n위젯 목록:\n  ${W.map((w) => w.title).join(', ')}`);
}
main();
