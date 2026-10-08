/* 공통 유틸·해설 카드·토글 버튼·전역 일시 정지·전역 애니메이션 루프·탭 전환·공용 그림(drawSky/drawBoat/drawGull/drawFoam) — 모든 탭이 쓰는 전역을 제공 */
/* ================= 공통 ================= */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
/* 해설 카드: '<b>제목</b> — 핵심 해설<small>추가 설명</small>' 형식의 글을 받아
   제목 · 핵심 해설(항상 보임) · 추가 설명('자세히 보기'로 펼치고 접음)으로 나눠 시뮬레이션 아래 카드에 표시.
   <small> 이 없으면 '자세히 보기' 버튼을 숨김. 반환값: set(html) 함수 */
function explainCard(el) {
  el.classList.add('explain');
  el.innerHTML = '<div class="ex-row"><span class="ex-title"></span><div class="ex-main" aria-live="polite"></div><button type="button" class="ex-btn" aria-expanded="false"></button></div><div class="ex-more"></div>';
  const title = el.querySelector('.ex-title'), main = el.querySelector('.ex-main'), btn = el.querySelector('.ex-btn'), more = el.querySelector('.ex-more');
  let open = false;
  const sync = () => { more.hidden = !open || btn.hidden; btn.setAttribute('aria-expanded', open); btn.textContent = open ? '접기 ▴' : '자세히 보기 ▾'; };
  btn.onclick = () => { open = !open; sync(); };
  return html => {
    const sm = html.match(/<small>([\s\S]*)<\/small>\s*$/);
    let body = sm ? html.slice(0, sm.index) : html;
    const m = body.match(/^<b>(.*?)<\/b>\s*—\s*/);
    if (m) body = body.slice(m[0].length);
    title.innerHTML = m ? m[1] : ''; title.hidden = !m;
    main.innerHTML = body.trim();
    more.innerHTML = sm ? sm[1] : ''; btn.hidden = !sm;
    el.hidden = !html;
    sync();
  };
}
/* 관찰 보조 토글 버튼: .on 클래스·aria-pressed 를 함께 바꾸고 cb(켜짐 여부) 호출 */
function bindToggle(btn, cb) {
  btn.setAttribute('aria-pressed', btn.classList.contains('on'));
  btn.addEventListener('click', () => { const v = !btn.classList.contains('on'); btn.classList.toggle('on', v); btn.setAttribute('aria-pressed', v); cb(v); });
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
function setPaused(v) { _paused = v; syncPauseBtns(); }

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
