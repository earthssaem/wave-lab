/* 공통 유틸·폰 자막 이동·전역 일시 정지·전역 애니메이션 루프·탭 전환·공용 그림(drawSky/drawBoat/drawGull/drawFoam) — 모든 탭이 쓰는 전역을 제공 */
/* ================= 공통 ================= */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
/* 폰에서는 자막을 그림 아래 칸으로 옮겨 그림을 가리지 않게 함 */
(function () {
  const mq = matchMedia('(max-width:600px)');
  const apply = () => {
    $$('.stage-wrap').forEach(sw => {
      let slot = sw.nextElementSibling;
      if (!slot || !slot.classList.contains('cap-slot')) { slot = document.createElement('div'); slot.className = 'cap-slot'; sw.after(slot); }
      const cap = (mq.matches ? sw : slot).querySelector('.caption');
      if (!cap) return;
      cap.classList.toggle('below', mq.matches);
      (mq.matches ? slot : sw).appendChild(cap);
    });
  };
  apply();
  mq.addEventListener('change', apply);
})();
function hangCap(html) {
  const sm = html.match(/<small>[\s\S]*<\/small>\s*$/);
  let main = sm ? html.slice(0, sm.index) : html; const tail = sm ? sm[0] : '';
  const m = main.match(/^<b>(.*?)<\/b>\s*—\s*/);
  if (m) main = main.slice(m[0].length);
  const body = main.trim().replace(/([.!?…])\s+/g, '$1\u0001').split('\u0001').map(t => `<span class="cap-s">${t}</span>`).join(' ');
  if (!m) return body + tail;
  return `<span class="cap-line"><b>${m[1]}</b><span class="cap-rest">${body}</span></span>${tail}`;
}
const SVGNS = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;
function E(tag, attrs = {}, children = []) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) {
    if (k === 'text') e.textContent = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  for (const c of children) if (c) e.appendChild(c);
  return e;
}
function attr(e, o) { for (const k in o) e.setAttribute(k, o[k]); return e; }
const fmt = (v, d = 1) => (+v).toFixed(d).replace(/\.0+$/, '');

/* ---- 일시 정지 (전역) ---- */
let _paused = false;
const _pauseBtns = [];
function syncPauseBtns() { _pauseBtns.forEach(b => { b.textContent = _paused ? '▶ 재생' : '⏸ 일시 정지'; }); }
function registerPauseBtn(btn) { _pauseBtns.push(btn); btn.addEventListener('click', () => { _paused = !_paused; syncPauseBtns(); }); }

/* ---- 전역 애니메이션 루프: 활성 탭의 frame(dt)만 호출 ---- */
let activeTab = '1'; const frames = {}; const tabInit = {};
let _last = performance.now();
(function loop(now) {
  let dt = (now - _last) / 1000; _last = now; if (dt > 0.1) dt = 0.1;
  if (!_paused && frames[activeTab]) frames[activeTab](dt);
  requestAnimationFrame(loop);
})(performance.now());
$$('.tab').forEach(b => b.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.toggle('active', x === b)); b.scrollIntoView({ inline: 'center', block: 'nearest' });
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel' + b.dataset.tab));
  activeTab = b.dataset.tab;
  if (tabInit[activeTab]) { tabInit[activeTab](); }
}));

/* ---- 글자 폭 추정 + 알약 이름표 ---- */
function textW(t, fs) { let w = 0; for (const ch of t) { w += /[가-힣]/.test(ch) ? fs * .92 : /[①-⑳ⓐ-ⓩ⏱↔→←]/.test(ch) ? fs * .95 : /[A-Z]/.test(ch) ? fs * .64 : /[0-9a-z.]/.test(ch) ? fs * .52 : ch === ' ' ? fs * .3 : fs * .62; } return w; }
function pill(text, o = {}) {
  const fs = o.fs || 18, pad = o.pad ?? 10, h = fs + pad;
  const g = E('g', { class: 'pill' });
  const r = E('rect', { rx: h / 2, fill: o.bg || '#FFFDF8', stroke: '#24303A', 'stroke-width': o.sw ?? 3, y: -h / 2, height: h });
  const t = E('text', { 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': fs, fill: o.color || '#24303A', y: fs * .36, text });
  g.appendChild(r); g.appendChild(t);
  const set = s => { t.textContent = s; const w = textW(s, fs) + pad * 2; attr(r, { x: -w / 2, width: w }); };
  set(text);
  const move = (x, y) => g.setAttribute('transform', `translate(${x},${y})`);
  return { g, set, move };
}
/* 양방향 화살표 path */
function arrowD(x1, y1, x2, y2, h = 10) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = (x, y, dir) => `M${x + Math.cos(dir + Math.PI * .8) * h} ${y + Math.sin(dir + Math.PI * .8) * h} L${x} ${y} L${x + Math.cos(dir - Math.PI * .8) * h} ${y + Math.sin(dir - Math.PI * .8) * h}`;
  return `M${x1} ${y1} L${x2} ${y2} ${head(x2, y2, ang)} ${head(x1, y1, ang + Math.PI)}`;
}
/* 하늘·해·구름 배경 (옆에서 본 바다 장면 공용) */
function drawSky(svg, id, o = {}) {
  svg.appendChild(E('defs', {}, [
    E('linearGradient', { id: id + '-water', x1: 0, y1: 0, x2: 0, y2: 1 }, [E('stop', { offset: 0, 'stop-color': '#7CC4EA' }), E('stop', { offset: 1, 'stop-color': '#1E5A85' })]),
  ]));
  svg.appendChild(E('rect', { x: -40, y: -40, width: 1040, height: 620, fill: '#BFE3F5' }));
  const SX = o.sunX ?? 850, SY = o.sunY ?? 80, SR = 34; const sun = E('g', { class: 'sun' });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r1 = SR + 8, r2 = SR + (i % 2 ? 18 : 25);
    const x1 = SX + Math.cos(a) * r1, y1 = SY + Math.sin(a) * r1, x2 = SX + Math.cos(a) * r2, y2 = SY + Math.sin(a) * r2;
    sun.appendChild(E('line', { x1, y1, x2, y2, stroke: '#24303A', 'stroke-width': 9, 'stroke-linecap': 'round' }));
    sun.appendChild(E('line', { x1, y1, x2, y2, stroke: '#FFE082', 'stroke-width': 5, 'stroke-linecap': 'round' }));
  }
  sun.appendChild(E('circle', { cx: SX, cy: SY, r: SR, fill: '#FFE082', stroke: '#24303A', 'stroke-width': 4 }));
  svg.appendChild(sun);
  const dy = o.cloudDy ?? 0;
  svg.appendChild(E('g', { transform: `translate(0,${dy})` }, [
    E('path', { d: 'M120 90 a26 26 0 0 1 50 -16 a30 30 0 0 1 58 8 a20 20 0 0 1 4 40 l-110 0 a22 22 0 0 1 -2 -32 Z', fill: '#fff', stroke: '#24303A', 'stroke-width': 4 }),
    E('path', { d: 'M560 60 a20 20 0 0 1 40 -12 a24 24 0 0 1 46 6 a16 16 0 0 1 3 32 l-88 0 a18 18 0 0 1 -1 -26 Z', fill: '#fff', stroke: '#24303A', 'stroke-width': 4 }),
  ]));
}
function drawBoat() {
  return E('g', {}, [
    E('path', { d: 'M-46 0 L46 0 L30 22 L-30 22 Z', fill: '#B9744A', stroke: '#24303A', 'stroke-width': 4, 'stroke-linejoin': 'round' }),
    E('rect', { x: -3, y: -62, width: 6, height: 62, fill: '#8A8276', stroke: '#24303A', 'stroke-width': 3 }),
    E('path', { d: 'M6 -56 L42 -12 L6 -12 Z', fill: '#fff', stroke: '#24303A', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
    E('path', { d: 'M-3 -62 L-24 -54 L-3 -46 Z', fill: '#E8553E', stroke: '#24303A', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
    E('path', { d: 'M-32 -4 L-14 -4 L-12 4 L-34 4 Z', fill: '#5B9BD5', stroke: '#24303A', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
    E('circle', { cx: -23, cy: -14, r: 9, fill: '#F7D9B5', stroke: '#24303A', 'stroke-width': 3 }),
    E('path', { d: 'M-32 -17 Q-23 -28 -14 -17', fill: '#24303A' }),
  ]);
}
function drawGull() {
  return E('g', {}, [
    E('ellipse', { cx: 0, cy: -13, rx: 24, ry: 13, fill: '#fff', stroke: '#24303A', 'stroke-width': 3 }),
    E('path', { d: 'M-8 -19 Q6 -34 26 -21 Q10 -16 -8 -19 Z', fill: '#B8C4CC', stroke: '#24303A', 'stroke-width': 2.5 }),
    E('path', { d: 'M-22 -18 L-38 -30', stroke: '#24303A', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    E('path', { d: 'M12 -22 L18 -30', stroke: '#24303A', 'stroke-width': 4, 'stroke-linecap': 'round' }),
    E('circle', { cx: 20, cy: -32, r: 9, fill: '#fff', stroke: '#24303A', 'stroke-width': 3 }),
    E('path', { d: 'M28 -33 L41 -30 L28 -27 Z', fill: '#F2B233', stroke: '#24303A', 'stroke-width': 2 }),
    E('circle', { cx: 22, cy: -34, r: 2.2, fill: '#24303A' }),
  ]);
}
function drawFoam() { return E('g', {}, [E('rect', { x: -10, y: -10, width: 20, height: 13, rx: 4, fill: '#fff', stroke: '#24303A', 'stroke-width': 2.5 })]); }
/* 모양에 따른 해파의 종류: 바람 → 풍랑(뾰족) → 너울(둥글고 긴 파장) → 연안 쇄파(파장↓ 파고↑ 부서짐). 300×120 좌표계의 g 반환 (탭3 카드·퀴즈 그림 공용) */
function drawWaveTypes(t) {
  const g = E('g');
  g.appendChild(E('rect', { width: 300, height: 120, fill: '#CFE8F5' }));
  const tri = (x, L) => 1 - Math.abs(((x / L) % 1) * 2 - 1); // 0~1 삼각파
  const y = x => {
    if (x < 100) return 66 - 9 * tri(x + 4, 22) - 4 * tri(x, 13);          // 풍랑: 뾰족하고 불규칙
    if (x < 200) return 66 - 6 * Math.cos(2 * Math.PI * (x - 100) / 62);   // 너울: 둥글고 긴 파장
    const s = (x - 200) / 100, L = 62 - 30 * s, A = 6 + 8 * s;             // 연안: 얕아지며 파장↓ 파고↑
    return 66 - A * Math.cos(2 * Math.PI * (x - 200) / L);
  };
  let d = `M0 ${y(0).toFixed(1)}`; for (let x = 2; x <= 300; x += 2) d += `L${x} ${y(x).toFixed(1)}`;
  g.appendChild(E('path', { d: d + 'L300 120L0 120Z', fill: '#5FB0DE', stroke: '#24303A', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
  [100, 200].forEach(x => g.appendChild(E('line', { x1: x, y1: 8, x2: x, y2: 98, stroke: '#24303A', 'stroke-width': 1.5, 'stroke-dasharray': '4 4', opacity: .4 })));
  // 부서지는 마루의 거품: 해안 앞 가장 높은 마루를 찾아 표시
  let xc = 225, yc = 200; for (let x = 225; x <= 258; x += 1) { const v = y(x); if (v < yc) { yc = v; xc = x; } }
  [[0, 0, 6], [8, 5, 4.5], [-7, 4, 4], [14, 10, 3.5]].forEach(([dx, dy, r]) => g.appendChild(E('circle', { cx: xc + dx, cy: yc + dy, r, fill: '#fff', stroke: '#24303A', 'stroke-width': 1.5 })));
  // 해안(모래)
  g.appendChild(E('path', { d: 'M256 120 L300 62 L300 120 Z', fill: '#E6C377', stroke: '#24303A', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
  // 바람: 구름 + 화살표
  g.appendChild(E('path', { d: 'M12 30 a8 8 0 0 1 16 -5 a9 9 0 0 1 18 3 a6 6 0 0 1 1 12 l-34 0 a7 7 0 0 1 -1 -10 Z', fill: '#fff', stroke: '#24303A', 'stroke-width': 2 }));
  g.appendChild(E('path', { d: 'M54 32 L84 32 M84 32 L76 26 M84 32 L76 38', stroke: '#E8553E', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }));
  g.appendChild(E('text', { x: 69, y: 22, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 11, fill: '#C7432E', text: t.wind }));
  // 이름표
  [[t.names[0], 50], [t.names[1], 150], [t.names[2], 230]].forEach(([s, x]) => g.appendChild(E('text', { x, y: 110, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 13, fill: '#24303A', text: s })));
  return g;
}
