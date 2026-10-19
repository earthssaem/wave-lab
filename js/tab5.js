/* 탭5: 해파의 굴절 — 곶과 만, 먼바다에서 정면으로 들어오는 너울 (입사 방향 고정)
   수심 → 파속(분산 관계) → fast marching 도착 시각 T(x,y) 한 번 계산 → 마루선(T 의 등치선)·파향선(∇T 방향) 모두 여기서 얻음
   마루선은 파향선 위에서 T 가 같은 점을 이어 그림 → 마루선과 파향선이 늘 수직이고, A·B·진행 방향 화살표가 같은 마루를 따라감
   6단계마다 볼 부분만 강조하고 나머지는 흐리게 */
/* ================= 탭5: 해파의 굴절 (위에서 본 모습, 육지가 위·바다가 아래) ================= */
(function () {
  const TX = TEXT.tab5; // 이 탭의 문구
  const svg = $('#svg5');
  /* 계산 격자: 셀 4 px = 4 m. 그림(960×540) 좌우로 M 셀, 아래로 MB 셀 여유를 두고 맨 아래 줄에서 평면파가 출발 */
  const CP = 4, GW = 240, GH = 135, M = 60, MB = 40, W = GW + 2 * M, HT = GH + MB, N = W * HT, CM = 4;
  /* 해파: 먼바다 파장 L0 의 너울. 주기 TP 는 어디서나 같고, 속도·파장만 수심에 따라 변함 */
  const g = 9.8, L0 = 140, TP = Math.sqrt(2 * Math.PI * L0 / g), OM = 2 * Math.PI / TP, C0 = L0 / TP;
  /* 해안선: 곶 끝 x = XC, 만 안쪽 x = XB */
  const XC = 300, XB = 780, PER = 960, Y0 = 205, AMP = 130;
  const shore = x => Y0 + AMP * Math.cos(2 * Math.PI * (x - XC) / PER);
  /* 수심: 해안선을 바다 쪽(아래)으로 s px 옮긴 선이 등수심선 → 곶 앞의 얕은 바다가 먼바다 쪽으로 튀어나온 모형
     h(s) = HMIN + (HMAX − HMIN)(s/S1)^PW, s ≥ S1 은 먼바다(HMAX). H_SURF 보다 얕은 쇄파대에서는 마루선·파향선을 그리지 않음 */
  const HMIN = 0.6, HMAX = 70, S1 = 360, PW = 1.6, H_SURF = 1.3;
  const depthAt = s => HMIN + (HMAX - HMIN) * Math.pow(Math.min(1, s / S1), PW);
  const sOfDepth = h => S1 * Math.pow((h - HMIN) / (HMAX - HMIN), 1 / PW);
  const ISO = [5, 15, 35], SEA = ['#9DDBF3', '#7DC6EA', '#5FB0DE', '#2E7DB0']; // 등수심선(m) · 그 사이 바다 색 (얕음 → 깊음)
  /* 파속 = 위상 속도 ω/k (분산 관계의 근사식, 모든 수심) */
  const speed = h => { const x = OM * Math.sqrt(h / g); const kh = x * x * Math.pow(1 - Math.exp(-Math.pow(x, 2.4908)), -.4015); return OM * h / kh; };
  /* 재생 속도: 보통은 화면 TPV 초에 한 주기, ③·④ 관찰은 OBS_D 초 동안 천천히 진행한 뒤 OBS_HOLD 초 멈췄다가 처음부터 */
  const TPV = 4.4, OBS_D = 12, OBS_HOLD = 4, TICKS = 5;
  const RS = 4, RAY_SHOW = 80; // 파향선 출발 간격(px): 계산용 RS, ⑤·⑥에 그리는 것은 곶·만 축을 사이에 두고 RAY_SHOW 간격

  let land, dep, Tf, rays, TV0, TV1, OBS_T0, OBS_T1, rA, rB, ticks;
  let step = 0, st = 0, inited = false, ks = 1; // st: 현재 단계를 시작(또는 다시 보기)한 뒤 흐른 시간, ks: 작은 화면에서 이름표를 키우는 배율
  const L = {}; // 단계별로 켜고 끄는 그림 묶음

  /* ---------- 계산 ---------- */
  const X = i => (i - M + .5) * CP, Y = j => (j + .5) * CP; // 격자점 → 그림 좌표
  function compute() {
    land = new Uint8Array(N); dep = new Float32Array(N); const slow = new Float32Array(N);
    for (let j = 0; j < HT; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, s = Y(j) - shore(X(i));
      if (s < 0) { land[k] = 1; continue; }
      const h = depthAt(s); dep[k] = h; slow[k] = CM / speed(h);
    }
    /* 도착 시각 T(x,y): 맨 아래 줄(먼바다) T = 0 에서 출발하는 fast marching */
    Tf = new Float64Array(N).fill(Infinity); const known = new Uint8Array(N);
    const hv = [], hi = [];
    const push = (v, i) => { hv.push(v); hi.push(i); let j = hv.length - 1; while (j > 0) { const p = (j - 1) >> 1; if (hv[p] <= hv[j]) break; [hv[p], hv[j]] = [hv[j], hv[p]]; [hi[p], hi[j]] = [hi[j], hi[p]]; j = p; } };
    const pop = () => { const i = hi[0]; const lv = hv.pop(), li = hi.pop(); if (hv.length) { hv[0] = lv; hi[0] = li; let j = 0; for (; ;) { const l = 2 * j + 1, r = l + 1; let m = j; if (l < hv.length && hv[l] < hv[m]) m = l; if (r < hv.length && hv[r] < hv[m]) m = r; if (m === j) break; [hv[m], hv[j]] = [hv[j], hv[m]]; [hi[m], hi[j]] = [hi[j], hi[m]]; j = m; } } return i; };
    for (let i = 0; i < W; i++) { const k = (HT - 1) * W + i; Tf[k] = 0; known[k] = 1; }
    const update = i => {
      if (land[i] || known[i]) return; const cx = i % W, cy = (i / W) | 0; let a = Infinity, b = Infinity;
      if (cx > 0 && known[i - 1]) a = Tf[i - 1]; if (cx < W - 1 && known[i + 1]) a = Math.min(a, Tf[i + 1]);
      if (cy > 0 && known[i - W]) b = Tf[i - W]; if (cy < HT - 1 && known[i + W]) b = Math.min(b, Tf[i + W]);
      const f = slow[i]; let t;
      if (a < Infinity && b < Infinity) { const d = Math.abs(a - b); t = d < f ? (a + b + Math.sqrt(2 * f * f - d * d)) / 2 : Math.min(a, b) + f; } else t = Math.min(a, b) + f;
      if (t < Tf[i]) { Tf[i] = t; push(t, i); }
    };
    const nb = i => { const cx = i % W, cy = (i / W) | 0; if (cx > 0) update(i - 1); if (cx < W - 1) update(i + 1); if (cy > 0) update(i - W); if (cy < HT - 1) update(i + W); };
    for (let i = (HT - 1) * W; i < N; i++) nb(i);
    while (hv.length) { const i = pop(); if (known[i]) continue; known[i] = 1; nb(i); }
    /* 파향선: ∇T 방향(마루선에 수직)을 따라 먼바다에서 쇄파대까지 추적 (RK2, 기울기는 격자점 값의 쌍선형 보간) */
    const ok = k => !land[k] && isFinite(Tf[k]);
    const GX = new Float32Array(N), GY = new Float32Array(N);
    for (let j = 0; j < HT; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; if (!ok(k)) continue;
      const l = i > 0 && ok(k - 1), r = i < W - 1 && ok(k + 1), u = j > 0 && ok(k - W), d = j < HT - 1 && ok(k + W);
      GX[k] = l && r ? (Tf[k + 1] - Tf[k - 1]) / 2 : r ? Tf[k + 1] - Tf[k] : l ? Tf[k] - Tf[k - 1] : 0;
      GY[k] = u && d ? (Tf[k + W] - Tf[k - W]) / 2 : d ? Tf[k + W] - Tf[k] : u ? Tf[k] - Tf[k - W] : 0;
    }
    const samp = (F, u, v) => { const i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j, k = j * W + i; return F[k] * (1 - fx) * (1 - fy) + F[k + 1] * fx * (1 - fy) + F[k + W] * (1 - fx) * fy + F[k + W + 1] * fx * fy; };
    const wet = (u, v) => { const i = Math.floor(u), j = Math.floor(v); if (i < 0 || j < 0 || i >= W - 1 || j >= HT - 1) return false; const k = j * W + i; for (const q of [k, k + 1, k + W, k + W + 1]) if (!ok(q) || dep[q] < H_SURF) return false; return true; };
    const dir = (u, v) => { const gx = samp(GX, u, v), gy = samp(GY, u, v), m = Math.hypot(gx, gy); return m > 1e-12 ? [gx / m, gy / m] : null; };
    dirAtPx = (x, y) => { const u = x / CP + M - .5, v = y / CP - .5; return wet(u, v) ? dir(u, v) : null; };
    const trace = x0 => {
      let u = x0 / CP + M - .5, v = HT - 1.5; const xs = [], ys = [], ts = [];
      for (let n = 0; n < 2000; n++) {
        if (!wet(u, v)) break;
        xs.push((u - M + .5) * CP); ys.push((v + .5) * CP); ts.push(Math.max(samp(Tf, u, v), ts.length ? ts[ts.length - 1] + 1e-6 : 0));
        const d1 = dir(u, v); if (!d1) break; const um = u + d1[0] * .25, vm = v + d1[1] * .25; if (!wet(um, vm)) break;
        const d2 = dir(um, vm); if (!d2) break; u += d2[0] * .5; v += d2[1] * .5;
      }
      return { x0, xs: Float32Array.from(xs), ys: Float32Array.from(ys), ts: Float64Array.from(ts) };
    };
    rays = [];
    for (let x0 = -M * CP; x0 <= (GW + M) * CP; x0 += RS) rays.push(trace(x0));
    /* 그림 안에 마루선이 보이는 시각 범위, ③·④ 관찰 시각 */
    TV0 = Infinity; TV1 = 0;
    rays.forEach(r => { const n = r.ts.length; if (n < 2) return; const t = tAtY(r, 540); if (t !== null) TV0 = Math.min(TV0, t); if (r.xs[n - 1] > -20 && r.xs[n - 1] < 980) TV1 = Math.max(TV1, r.ts[n - 1]); });
    rA = rayAt(XC); rB = rayAt(XB);
    OBS_T0 = tAtY(rB, 528);              // 관찰 시작: B 가 그림 아래 가장자리 근처 (마루선이 아직 거의 곧음)
    OBS_T1 = rA.ts[rA.ts.length - 1] - .6; // 관찰 끝: A 가 곶 앞 쇄파대에 닿기 직전
    ticks = []; for (let k = 0; k <= TICKS; k++) ticks.push(OBS_T0 + (OBS_T1 - OBS_T0) * k / TICKS);
  }
  let dirAtPx = () => null;
  const rayAt = x0 => rays[Math.round((x0 + M * CP) / RS)];
  /* 파향선 r 위에서 도착 시각이 t 인 점 [x, y, 앞 점 번호] (아직 오지 않았거나 이미 쇄파대에 닿았으면 null) */
  function at(r, t) {
    const T = r.ts, n = T.length; if (n < 2 || t < T[0] || t > T[n - 1]) return null;
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
    const f = (t - T[lo]) / (T[hi] - T[lo]);
    return [r.xs[lo] + (r.xs[hi] - r.xs[lo]) * f, r.ys[lo] + (r.ys[hi] - r.ys[lo]) * f, lo];
  }
  function tAtY(r, y) { const ys = r.ys; for (let k = 1; k < ys.length; k++) if (ys[k] <= y) return r.ts[k - 1] + (r.ts[k] - r.ts[k - 1]) * (ys[k - 1] - y) / (ys[k - 1] - ys[k]); return null; }
  /* 시각 t 의 마루선: 이웃한 파향선 위의 같은 시각 점을 이음 (그림 밖·쇄파대에서 끊김, 쇄파대에 닿으며 남는 아주 짧은 조각은 뺌) */
  function crestD(t) {
    let d = '', seg = '', len = 0, px = null, py = 0;
    const flush = () => { if (len > 26) d += seg; seg = ''; len = 0; px = null; };
    for (const r of rays) {
      const p = at(r, t);
      if (!p || p[1] > 560 || p[0] < -30 || p[0] > 990) { flush(); continue; }
      const step = px === null ? 0 : Math.abs(p[0] - px) + Math.abs(p[1] - py);
      if (px !== null && step >= 40) flush();
      seg += (px === null ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); if (px !== null) len += step;
      px = p[0]; py = p[1];
    }
    flush(); return d;
  }
  /* 시각 tc 의 마루선과 한 주기씩 앞뒤의 마루선 모두 (skip0: tc 자신은 빼고) */
  function crestsD(tc, skip0) {
    let d = ''; const n0 = Math.floor((TV0 - tc) / TP), n1 = Math.ceil((TV1 - tc) / TP);
    for (let n = n0; n <= n1; n++) if (!(skip0 && n === 0)) d += crestD(tc + n * TP);
    return d;
  }
  /* 파향선 r 의 시각 t0~t1 부분 (그림 아래 밖은 뺌) */
  function raySeg(r, t0, t1) {
    const a = at(r, t0), b = at(r, t1); if (!a || !b) return '';
    let s = a[0].toFixed(1) + ',' + a[1].toFixed(1);
    for (let k = a[2] + 1; k <= b[2]; k += 3) s += ' ' + r.xs[k].toFixed(1) + ',' + r.ys[k].toFixed(1);
    return s + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1);
  }
  const rayPts = r => { const out = []; for (let k = 0; k < r.xs.length; k += 3) if (r.ys[k] < 548) out.push(r.xs[k].toFixed(1) + ',' + r.ys[k].toFixed(1)); const n = r.xs.length - 1; out.push(r.xs[n].toFixed(1) + ',' + r.ys[n].toFixed(1)); return out; };

  /* ---------- 그림 요소 ---------- */
  const tags = []; // 이름표: 그림이 작게 보이면(휴대폰) ks 배로 키움
  function tag(text, x, y, o = {}) {
    const fs = o.fs || 15, pad = 8, h = fs + pad, w = textW(text, fs) + pad * 2, ox = o.anchor === 'end' ? -w / 2 : 0;
    const g = E('g', {}, [
      E('rect', { x: ox - w / 2, y: -h / 2, width: w, height: h, rx: h / 2, fill: o.bg || '#FFFDF8', stroke: '#24303A', 'stroke-width': 1.5 }),
      E('text', { x: ox, y: fs * .36, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': fs, fill: '#24303A', text }),
    ]);
    const t = { g, x, y }; tags.push(t); placeTag(t); return g;
  }
  const placeTag = t => t.g.setAttribute('transform', `translate(${t.x},${t.y}) scale(${ks})`);
  function halo(text, x, y, o = {}) {
    const g = E('g', {}, [E('text', { 'text-anchor': o.anchor || 'middle', 'font-family': 'Jua', 'font-size': o.fs || 14, fill: o.color || '#1E5A85', stroke: '#fff', 'stroke-width': 3.5, 'paint-order': 'stroke', 'stroke-linejoin': 'round', y: 5, text })]);
    const t = { g, x, y }; tags.push(t); placeTag(t); return g;
  }
  /* 화살표 (0,0) → (len,0): 굵은 테두리 위에 색 선 + 머리 */
  function arrow(color, len, head = 11) {
    const d = `M0 0 L${len - head * .6} 0`, hd = `M${len} 0 L${len - head} ${-head * .62} L${len - head} ${head * .62} Z`;
    return E('g', {}, [
      E('path', { d, stroke: '#24303A', 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none' }),
      E('path', { d, stroke: color, 'stroke-width': 3.6, 'stroke-linecap': 'round', fill: 'none' }),
      E('path', { d: hd, fill: color, stroke: '#24303A', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }),
    ]);
  }
  const marker = letter => E('g', {}, [E('circle', { r: 12, fill: '#FFE082', stroke: '#24303A', 'stroke-width': 2.2 }), E('text', { 'text-anchor': 'middle', y: 5.5, 'font-family': 'Jua', 'font-size': 16, fill: '#24303A', text: letter })]);
  /* 해안선을 아래로 s 만큼 옮긴 선 (등수심선) — closeUp: 위쪽(육지 쪽)을 닫은 면 */
  function isoPath(s, closeUp) {
    let p = ''; for (let x = -40; x <= 1000; x += 8) p += (p ? 'L' : 'M') + x + ' ' + (shore(x) + s).toFixed(1);
    return closeUp ? p + 'L1000 -60L-40 -60Z' : p;
  }
  function tree(x, y) {
    return E('g', { transform: `translate(${x},${y})` }, [
      E('circle', { cx: 0, cy: 0, r: 15, fill: '#5F9E4B', stroke: '#24303A', 'stroke-width': 2.5 }),
      E('circle', { cx: -4, cy: -4, r: 5, fill: '#7DB866' }),
    ]);
  }
  function buildSvg() {
    svg.innerHTML = '';
    const add = (el, parent = svg) => (parent.appendChild(el), el);
    const grp = () => add(E('g'));
    add(E('defs', {}, [
      E('marker', { id: 'arr5', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: 'auto' }, [E('path', { d: 'M0 0 L10 5 L0 10 Z', fill: '#E8553E' })]),
    ]));
    /* 바다: 먼바다 색 위에 얕은 곳일수록 밝은 색 (등수심선 사이) */
    add(E('rect', { x: -40, y: -40, width: 1040, height: 620, fill: SEA[3] }));
    L.sea = grp();
    for (let n = ISO.length - 1; n >= 0; n--) add(E('path', { d: isoPath(sOfDepth(ISO[n]), true), fill: SEA[n] }), L.sea);
    L.iso = grp();
    ISO.forEach(h => add(E('path', { d: isoPath(sOfDepth(h)), fill: 'none', stroke: '#1E5A85', 'stroke-width': 2, 'stroke-dasharray': '8 6' }), L.iso));
    // 쇄파대 거품
    add(E('path', { d: isoPath(sOfDepth(H_SURF) * .55), fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-dasharray': '10 8', 'stroke-linecap': 'round', opacity: .9 }));
    // 마루선 (뒤: 진한 테두리, 앞: 흰 선)
    const crestPair = (back, front) => { const gg = grp(); return [add(E('path', { fill: 'none', stroke: '#1E5A85', 'stroke-width': back, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .7 }), gg), add(E('path', { fill: 'none', stroke: '#fff', 'stroke-width': front, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), gg), gg]; };
    const [cb, cf, cg] = crestPair(7, 3.5); L.crest = cg; L.crestPaths = [cb, cf];
    /* ⑤·⑥ 파향선: 먼바다에서 같은 간격으로 출발 (곶·만 축을 사이에 둠). 축 양옆 이웃한 두 파향선 사이를 노란 띠로 */
    L.rays = grp();
    const band = (xa, xb) => { const a = rayPts(rayAt(xa)), b = rayPts(rayAt(xb)).reverse(); return E('polygon', { points: a.concat(b).join(' '), fill: '#FFE082', opacity: .8 }); };
    L.bands = add(E('g'), L.rays);
    add(band(XC - RAY_SHOW / 2, XC + RAY_SHOW / 2), L.bands); add(band(XB - RAY_SHOW / 2, XB + RAY_SHOW / 2), L.bands);
    L.rayLines = add(E('g'), L.rays);
    for (let x0 = XC - RAY_SHOW / 2 - Math.floor((XC - RAY_SHOW / 2) / RAY_SHOW) * RAY_SHOW; x0 < 960; x0 += RAY_SHOW) {
      const pts = rayPts(rayAt(x0)); if (pts.length < 3) continue;
      add(E('polyline', { points: pts.join(' '), fill: 'none', stroke: '#E8553E', 'stroke-width': 3, 'stroke-linejoin': 'round', 'marker-end': 'url(#arr5)' }), L.rayLines);
    }
    /* ③·④ 관찰하는 마루선 하나: 처음 위치(점선) · 앞선 위치(④, 점선) · A·B 자취와 같은 시간 간격 점(③) · 진행 방향(④) */
    L.obs = grp();
    add(E('path', { d: crestD(OBS_T0), fill: 'none', stroke: '#fff', 'stroke-width': 2.5, 'stroke-dasharray': '9 7', opacity: .85 }), L.obs);
    L.past = add(E('g'), L.obs);
    L.pastPaths = ticks.slice(1, -1).map(t => add(E('path', { d: crestD(t), fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '5 6', opacity: .7 }), L.past));
    const [hb, hf, hg] = crestPair(10, 5.5); L.obs.appendChild(hg); hb.setAttribute('opacity', .85); L.hlPaths = [hb, hf];
    L.trail = add(E('g'), L.obs);
    L.trailLines = [rA, rB].map(() => add(E('polyline', { fill: 'none', stroke: '#24303A', 'stroke-width': 3, opacity: .75, 'stroke-linecap': 'round' }), L.trail));
    L.tickDots = [];
    [rA, rB].forEach(r => ticks.forEach((t, k) => { const p = at(r, t); L.tickDots.push({ k, el: add(E('circle', { cx: p[0], cy: p[1], r: 4.5, fill: '#fff', stroke: '#24303A', 'stroke-width': 2 }), L.trail) }); }));
    L.dir = add(E('g'), L.obs);
    L.dirArrows = [60, 180, XC, 420, 540, 660, XB, 900].map(x0 => ({ r: rayAt(x0), el: add(arrow('#E8553E', 44), L.dir) }));
    L.marks = [rA, rB].map((r, i) => ({ r, el: add(marker(i ? 'B' : 'A'), L.obs) }));
    /* ② 속도 화살표: 그 자리의 수심으로 계산한 파속에 비례하는 길이, 방향은 그 자리 진행 방향 */
    L.speed = grp();
    for (let x = 60; x < 960; x += 120) {
      const y = 440, d = dirAtPx(x, y); if (!d) continue;
      const len = 66 * speed(depthAt(y - shore(x))) / C0;
      add(E('g', { transform: `translate(${x},${y}) rotate(${(Math.atan2(d[1], d[0]) * 180 / Math.PI).toFixed(1)})` }, [arrow('#FFE082', len, 12)]), L.speed);
      add(E('circle', { cx: x, cy: y, r: 4, fill: '#24303A' }), L.speed);
    }
    /* 육지 (위쪽): 모래 띠 + 초록 */
    let d1 = `M-40 ${shore(-40)}`, d2 = `M-40 ${shore(-40) - 46}`;
    for (let x = -32; x <= 1000; x += 8) { d1 += `L${x} ${shore(x).toFixed(1)}`; d2 += `L${x} ${(shore(x) - 46).toFixed(1)}`; }
    add(E('path', { d: d1 + 'L1000 -60L-40 -60Z', fill: '#E6C377', stroke: '#24303A', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    add(E('path', { d: d2 + 'L1000 -60L-40 -60Z', fill: '#8FB07A', stroke: '#24303A', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    [130, 520, 880].forEach(x => add(tree(x, shore(x) - 72)));
    /* ① 곶 = 평균 해안선(점선)보다 바다 쪽으로 튀어나온 육지, 만 = 평균 해안선보다 육지 쪽으로 들어온 바다 */
    L.focus = grp();
    const region = xc => { let p = `M${xc - 240} ${Y0}`; for (let x = xc - 240; x <= xc + 240; x += 6) p += `L${x} ${shore(x).toFixed(1)}`; return p + 'Z'; };
    add(E('path', { d: region(XC), fill: '#FFE082', opacity: .6 }), L.focus);
    add(E('path', { d: region(XB), fill: '#fff', opacity: .4 }), L.focus);
    add(E('path', { d: `M${XC - 240} ${Y0}L${XB + 240} ${Y0}`, stroke: '#24303A', 'stroke-width': 1.5, 'stroke-dasharray': '6 6', opacity: .45 }), L.focus);
    /* ⑥ 곶의 바위 해안(해식 절벽): 위에서 본 지도처럼 해안을 따라 회색 띠 + 바다 쪽으로 향한 짧은 빗금 */
    L.coast = grp();
    let rk = ''; for (let x = XC - 125; x <= XC + 125; x += 6) rk += (rk ? 'L' : 'M') + x + ' ' + (shore(x) - 11).toFixed(1);
    add(E('path', { d: rk, fill: 'none', stroke: '#24303A', 'stroke-width': 21, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), L.coast);
    add(E('path', { d: rk, fill: 'none', stroke: '#A39A8C', 'stroke-width': 17, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), L.coast);
    let hach = ''; for (let x = XC - 112; x <= XC + 112; x += 14) { const y = shore(x), s = (shore(x + 1) - shore(x - 1)) / 2, m = Math.hypot(1, s); hach += `M${(x + s / m * 17).toFixed(1)} ${(y - 17 / m).toFixed(1)}l${(-s / m * 11).toFixed(1)} ${(11 / m).toFixed(1)}`; }
    add(E('path', { d: hach, stroke: '#24303A', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: .65 }), L.coast);
    /* 이름표 (data-steps: 보이는 단계 번호들) */
    L.labels = grp();
    const lab = (el, steps) => { el.dataset.steps = steps; L.labels.appendChild(el); };
    const LB = TX.labels;
    lab(tag(LB.cape, XC, shore(XC) - 52, { fs: 20, bg: '#FFE082' }), '0');
    lab(tag(LB.bay, XB, shore(XB) + 62, { fs: 20, bg: '#FFE082' }), '0');
    lab(tag(LB.land, 560, 96, { fs: 16 }), '0');
    lab(tag(LB.sea, 560, 470, { fs: 16 }), '0');
    lab(tag(LB.cape, XC, shore(XC) - 30), '123');
    lab(tag(LB.bay, XB, shore(XB) + 34), '123');
    lab(tag(LB.iso, 640, shore(640) + sOfDepth(ISO[1]) + 2, { fs: 14 }), '1');
    ISO.forEach(h => lab(halo(LB.depth(h), 922, shore(922) + sOfDepth(h) - 10), '1'));
    lab(tag(LB.capeEnergy, XC, shore(XC) - 44, { bg: '#FBE5E2' }), '4');
    lab(tag(LB.cliff, XC, shore(XC) - 60, { bg: '#FBE5E2' }), '5');
    const bl = rayAt(XB - RAY_SHOW / 2); let bx = 999; for (let k = 0; k < bl.ys.length; k++) if (bl.ys[k] < 215) bx = Math.min(bx, bl.xs[k]); // 만 띠 왼쪽 끝 (y < 215)
    lab(tag(LB.bayEnergy, bx - 12, 172, { anchor: 'end', bg: '#E4F3E8' }), '4');
    lab(tag(LB.beach, 650, shore(650) - 24, { bg: '#E4F3E8' }), '5');
  }

  /* ---------- 단계 ---------- */
  /* 단계별로 보이는 정도: 0 숨김, 0~1 흐리게 */
  const VIEW = [
    { sea: .22, iso: 0, crest: .3, focus: 1 },                                  // ① 해안 모양에 집중
    { sea: 1, iso: 1, crest: .45, speed: 1 },                                   // ② 수심 색·등수심선·속도 화살표
    { sea: .85, iso: .35, crest: .16, obs: 1, trail: 1 },                       // ③ 마루선 하나 + A·B 자취
    { sea: .85, iso: .35, crest: .16, obs: 1, past: 1, dir: 1 },                // ④ 같은 마루선 + 진행 방향
    { sea: .6, iso: 0, crest: .2, rays: 1 },                                    // ⑤ 파향선과 그 사이 폭
    { sea: .6, iso: 0, crest: .2, rays: 1, rayLines: .45, coast: 1 },           // ⑥ 해안 지형과 연결 (파향선은 흐리게, 띠는 그대로)
  ];
  const STEPS = TX.STEPS, NS = STEPS.length;
  /* '화면에서 볼 부분' 범례 그림 (30×14) */
  const LEG_ICON = {
    shallow: `<rect width="30" height="14" fill="${SEA[0]}"/>`,
    deep: `<rect width="30" height="14" fill="${SEA[3]}"/>`,
    iso: `<rect width="30" height="14" fill="${SEA[2]}"/><path d="M1 7H29" stroke="#1E5A85" stroke-width="2" stroke-dasharray="5 3"/>`,
    speed: `<rect width="30" height="14" fill="${SEA[3]}"/><path d="M3 7H20" stroke="#24303A" stroke-width="5"/><path d="M3 7H20" stroke="#FFE082" stroke-width="2.5"/><path d="M28 7L19 2V12Z" fill="#FFE082" stroke="#24303A"/>`,
    crest: `<rect width="30" height="14" fill="${SEA[2]}"/><path d="M2 7H28" stroke="#1E5A85" stroke-width="6" stroke-linecap="round"/><path d="M2 7H28" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
    start: `<rect width="30" height="14" fill="${SEA[2]}"/><path d="M1 7H29" stroke="#fff" stroke-width="2" stroke-dasharray="5 3"/>`,
    past: `<rect width="30" height="14" fill="${SEA[2]}"/><path d="M1 7H29" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 3"/>`,
    dots: `<rect width="30" height="14" fill="${SEA[2]}"/><path d="M4 7H26" stroke="#24303A" stroke-width="2"/><circle cx="6" cy="7" r="3" fill="#fff" stroke="#24303A" stroke-width="1.5"/><circle cx="15" cy="7" r="3" fill="#fff" stroke="#24303A" stroke-width="1.5"/><circle cx="24" cy="7" r="3" fill="#fff" stroke="#24303A" stroke-width="1.5"/>`,
    dir: `<rect width="30" height="14" fill="${SEA[2]}"/><path d="M3 7H20" stroke="#24303A" stroke-width="5"/><path d="M3 7H20" stroke="#E8553E" stroke-width="2.5"/><path d="M28 7L19 2V12Z" fill="#E8553E" stroke="#24303A"/>`,
    ray: `<rect width="30" height="14" fill="${SEA[2]}"/><path d="M2 7H28" stroke="#E8553E" stroke-width="2.5"/>`,
    band: `<rect width="30" height="14" fill="${SEA[2]}"/><path d="M0 3H30V11H0Z" fill="#FFE082" opacity=".8"/><path d="M0 2.5H30M0 11.5H30" stroke="#E8553E" stroke-width="1.8"/>`,
  };
  const LEG = [[], ['shallow', 'deep', 'iso', 'speed'], ['crest', 'start', 'dots'], ['crest', 'past', 'dir'], ['ray', 'band'], ['ray', 'band']];
  const show = (el, v) => { el.style.display = v ? '' : 'none'; if (v) el.style.opacity = v; };
  function applyStep() {
    const s = STEPS[step], v = VIEW[step];
    $('#badge5').textContent = TX.nums[step] + ' ' + s.short;
    $('#t5-stepnum').innerHTML = TX.stepLabel(step + 1, NS, s.short);
    $('#t5-title').textContent = TX.nums[step] + ' ' + s.title;
    $('#t5-key').innerHTML = s.key; $('#t5-body').innerHTML = s.body; $('#t5-look').innerHTML = s.look;
    $('#t5-leg').innerHTML = LEG[step].map(k => `<li><svg viewBox="0 0 30 14" aria-hidden="true">${LEG_ICON[k]}</svg>${TX.legend[k]}</li>`).join('');
    const sum = $('#t5-sum'); sum.hidden = step !== NS - 1;
    sum.innerHTML = TX.summary.map(line => '<div>' + line.map(w => `<span>${w}</span>`).join('<i>→</i>') + '</div>').join('') + `<small>${TX.note}</small>`;
    const more = $('#t5-more'); more.hidden = !s.more; more.open = false; $('#t5-more-body').innerHTML = s.more || '';
    $('#t5-prev').disabled = step === 0; $('#t5-next').disabled = step === NS - 1;
    show(L.sea, v.sea); show(L.iso, v.iso); show(L.crest, v.crest); show(L.focus, v.focus); show(L.speed, v.speed);
    show(L.obs, v.obs); show(L.trail, v.trail); show(L.past, v.past); show(L.dir, v.dir);
    show(L.rays, v.rays); show(L.rayLines, v.rayLines || 1); show(L.coast, v.coast);
    L.iso.querySelectorAll('path').forEach(p => p.setAttribute('stroke-width', step === 1 ? 2.6 : 2));
    L.labels.querySelectorAll('[data-steps]').forEach(el => el.style.display = el.dataset.steps.includes(String(step)) ? '' : 'none');
    st = 0; draw();
  }
  /* ③·④ 관찰하는 마루의 도착 시각: OBS_D 초 동안 OBS_T0 → OBS_T1, OBS_HOLD 초 멈춘 뒤 처음부터 */
  const obsT = () => OBS_T0 + (OBS_T1 - OBS_T0) * Math.min(1, (st % (OBS_D + OBS_HOLD)) / OBS_D);
  function draw() {
    const obs = step === 2 || step === 3;
    const tc = obs ? obsT() : OBS_T0 + st * TP / TPV;
    const d = crestsD(tc, obs); L.crestPaths.forEach(p => p.setAttribute('d', d));
    if (!obs) return;
    const hd = crestD(tc); L.hlPaths.forEach(p => p.setAttribute('d', hd));
    L.marks.forEach(m => { const p = at(m.r, tc); m.el.style.display = p ? '' : 'none'; if (p) m.el.setAttribute('transform', `translate(${p[0].toFixed(1)},${p[1].toFixed(1)}) scale(${ks})`); });
    if (step === 2) {
      L.trailLines.forEach((el, i) => el.setAttribute('points', raySeg(i ? rB : rA, OBS_T0, tc)));
      L.tickDots.forEach(o => o.el.style.display = tc >= ticks[o.k] - 1e-6 ? '' : 'none');
    } else {
      L.pastPaths.forEach((el, i) => el.style.display = tc >= ticks[i + 1] - 1e-6 ? '' : 'none');
      L.dirArrows.forEach(a => {
        const p = at(a.r, tc); a.el.style.display = p ? '' : 'none'; if (!p) return;
        const k = Math.min(p[2] + 1, a.r.xs.length - 1), j = Math.max(0, k - 2);
        const ang = Math.atan2(a.r.ys[k] - a.r.ys[j], a.r.xs[k] - a.r.xs[j]) * 180 / Math.PI;
        a.el.setAttribute('transform', `translate(${p[0].toFixed(1)},${p[1].toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${Math.min(ks, 1.5)})`);
      });
    }
  }
  function render(dt) {
    if (!inited) return;
    st += dt; draw();
  }
  /* 그림이 작게 보이면(휴대폰) 이름표·A·B 를 키움 */
  function fit() {
    const w = svg.clientWidth; if (!w) return;
    const k = clamp(.75 / (w / 960), 1, 2.1); if (Math.abs(k - ks) < .02) return;
    ks = k; tags.forEach(placeTag); if (inited) draw();
  }
  function init() {
    compute(); buildSvg();
    inited = true; fit(); applyStep();
  }
  $('#t5-prev').onclick = () => { if (step > 0) { step--; applyStep(); } };
  $('#t5-next').onclick = () => { if (step < NS - 1) { step++; applyStep(); } };
  $('#t5-replay').onclick = () => { st = 0; setPaused(false); draw(); };
  registerPauseBtn($('#t5-pause'));
  if (window.ResizeObserver) new ResizeObserver(fit).observe(svg); else addEventListener('resize', fit);
  tabInit['5'] = () => { if (inited) return; init(); };
  frames['5'] = render;
})();
