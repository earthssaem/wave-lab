/* 탭4: 해파의 굴절 — fast marching 도착 시각 T(x,y), 마루선(등치선)·파향선(∇T) 추적, 4단계 설명 */
/* ================= 탭4: 해파의 굴절 (위에서 본 모습, 육지가 위·바다가 아래) ================= */
(function () {
  const TX = TEXT.tab4; // 이 탭의 문구
  const svg = $('#svg4');
  const CP = 4, GW = 240, GH = 135, M = 60, MB = 40, W = GW + 2 * M, HT = GH + MB, N = W * HT, CM = 4; // 셀 = 4 px = 4 m
  const g = 9.8, L0 = 64, TP = Math.sqrt(2 * Math.PI * L0 / g), OM = 2 * Math.PI / TP, C0 = L0 / TP, HMAX = 70, SLOPE = HMAX / 230, HMIN = 1.2, TPV = 2.2;
  const H_SHAL = 12, H_MID = 30, H_SURF = 2.5;
  const scenes = {
    cape: { shore: x => 205 + 92 * Math.cos(2 * Math.PI * (x - 300) / 960), ang: 0 },
    line: { shore: () => 130, ang: 40 },
  };
  let scene = 'cape', ang = 0, land, dep, slow, Tf, rays = [], tt = 0, step = 0, inited = false, nLevels = 8;
  let crestG, crestBack, crestFront, rayG, labelG;

  function buildDepth() {
    const sh = scenes[scene].shore; land = new Uint8Array(N); dep = new Float32Array(N); slow = new Float32Array(N);
    const sx = [], sy = [];
    for (let px = -M * CP; px <= (GW + M) * CP; px += 2) { sx.push(px / CP + M); sy.push(sh(px) / CP); }
    const n = sx.length;
    for (let cy = 0; cy < HT; cy++) for (let cx = 0; cx < W; cx++) {
      const i = cy * W + cx, px = (cx - M) * CP + CP / 2, ys = sh(px) / CP;
      if (cy + .5 < ys) { land[i] = 1; continue; }
      let best = 1e9; const j0 = Math.max(0, (cx - 70) * 2), j1 = Math.min(n - 1, (cx + 70) * 2);
      for (let j = j0; j <= j1; j++) { const dx = sx[j] - (cx + .5), dy = sy[j] - (cy + .5); const d2 = dx * dx + dy * dy; if (d2 < best) best = d2; }
      const h = Math.min(HMAX, HMIN + SLOPE * Math.sqrt(best) * CM); dep[i] = h;
      const x = OM * Math.sqrt(h / g); const kh = x * x * Math.pow(1 - Math.exp(-Math.pow(x, 2.4908)), -.4015);
      slow[i] = CM / (OM / (kh / h));
    }
  }
  /* 도착 시각 T(x,y): 먼바다(균일 수심)는 평면파 해석해, 나머지는 fast marching */
  function march() {
    Tf = new Float64Array(N).fill(Infinity); const known = new Uint8Array(N);
    const th = ang * Math.PI / 180, dxs = Math.sin(th), dys = -Math.cos(th);
    const hv = [], hi = [];
    const push = (v, i) => { hv.push(v); hi.push(i); let j = hv.length - 1; while (j > 0) { const p = (j - 1) >> 1; if (hv[p] <= hv[j]) break; [hv[p], hv[j]] = [hv[j], hv[p]]; [hi[p], hi[j]] = [hi[j], hi[p]]; j = p; } };
    const pop = () => { const i = hi[0]; const lv = hv.pop(), li = hi.pop(); if (hv.length) { hv[0] = lv; hi[0] = li; let j = 0; for (; ;) { const l = 2 * j + 1, r = l + 1; let m = j; if (l < hv.length && hv[l] < hv[m]) m = l; if (r < hv.length && hv[r] < hv[m]) m = r; if (m === j) break; [hv[m], hv[j]] = [hv[j], hv[m]]; [hi[m], hi[j]] = [hi[j], hi[m]]; j = m; } } return i; };
    let tmin = Infinity;
    for (let i = 0; i < N; i++) { if (land[i] || dep[i] < HMAX - 1e-3) continue; const t = ((i % W) * dxs + ((i / W) | 0) * dys) * CM / C0; Tf[i] = t; known[i] = 1; if (t < tmin) tmin = t; }
    for (let i = 0; i < N; i++) if (known[i]) Tf[i] -= tmin;
    const update = i => {
      if (land[i] || known[i]) return; const cx = i % W, cy = (i / W) | 0; let a = Infinity, b = Infinity;
      if (cx > 0 && known[i - 1]) a = Tf[i - 1]; if (cx < W - 1 && known[i + 1]) a = Math.min(a, Tf[i + 1]);
      if (cy > 0 && known[i - W]) b = Tf[i - W]; if (cy < HT - 1 && known[i + W]) b = Math.min(b, Tf[i + W]);
      const f = slow[i]; let t;
      if (a < Infinity && b < Infinity) { const d = Math.abs(a - b); t = d < f ? (a + b + Math.sqrt(2 * f * f - d * d)) / 2 : Math.min(a, b) + f; } else t = Math.min(a, b) + f;
      if (t < Tf[i]) { Tf[i] = t; push(t, i); }
    };
    const nb = i => { const cx = i % W, cy = (i / W) | 0; if (cx > 0) update(i - 1); if (cx < W - 1) update(i + 1); if (cy > 0) update(i - W); if (cy < HT - 1) update(i + W); };
    for (let i = 0; i < N; i++) if (known[i]) nb(i);
    while (hv.length) { const i = pop(); if (known[i]) continue; known[i] = 1; nb(i); }
    let tmax = 0;
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) { const i = cy * W + cx + M; if (!land[i] && dep[i] >= H_SURF && isFinite(Tf[i]) && Tf[i] > tmax) tmax = Tf[i]; }
    nLevels = Math.ceil(tmax / TP) + 1;
  }
  /* 파향선: 도착 시각의 기울기 방향을 따라 추적 (아래 먼바다에서 출발) */
  function traceRays() {
    rays = []; const th = ang * Math.PI / 180; const starts = [];
    for (let cx = 6; cx < W; cx += 18) starts.push([cx, HT - 2]);
    if (th > .01) for (let cy = 18; cy < HT; cy += 18) starts.push([1, cy]);
    if (th < -.01) for (let cy = 18; cy < HT; cy += 18) starts.push([W - 2, cy]);
    const v = j => (land[j] || !isFinite(Tf[j])) ? null : Tf[j];
    const grad = (x, y) => {
      const cx = clamp(Math.round(x), 1, W - 2), cy = clamp(Math.round(y), 1, HT - 2), i = cy * W + cx;
      const c = v(i); if (c === null) return null; const l = v(i - 1), r = v(i + 1), u = v(i - W), d = v(i + W);
      const gx = (l !== null && r !== null) ? (r - l) / 2 : r !== null ? r - c : l !== null ? c - l : 0;
      const gy = (u !== null && d !== null) ? (d - u) / 2 : d !== null ? d - c : u !== null ? c - u : 0;
      const m = Math.hypot(gx, gy); return m > 1e-9 ? [gx / m, gy / m] : null;
    };
    starts.forEach(([x, y]) => {
      const pts = [];
      for (let n = 0; n < 900; n++) {
        const cx = Math.round(x), cy = Math.round(y);
        if (cx < 1 || cx > W - 2 || cy < 1 || cy > HT - 2 || land[cy * W + cx] || dep[cy * W + cx] < H_SURF) break;
        pts.push([((x - M) * CP).toFixed(1), (y * CP).toFixed(1)]);
        const gd = grad(x, y); if (!gd) break; x += gd[0] * .6; y += gd[1] * .6;
      }
      if (pts.length > 6) rays.push(pts);
    });
  }
  /* 마루선: 도착 시각 T 의 등치선 (marching squares, 2셀 간격) */
  function crestPaths() {
    const frac = mod(tt / TPV, 1); let d = '';
    const val = (cx, cy) => { const i = cy * W + cx + M; return (land[i] || dep[i] < H_SURF || !isFinite(Tf[i])) ? null : Tf[i]; };
    const S = 2;
    for (let n = 0; n < nLevels; n++) {
      const lv = (n + frac) * TP;
      for (let cy = 0; cy + S <= GH; cy += S) for (let cx = 0; cx + S <= GW; cx += S) {
        const a = val(cx, cy), b = val(cx + S, cy), c = val(cx + S, cy + S), e = val(cx, cy + S);
        if (a === null || b === null || c === null || e === null) continue;
        const idx = (a >= lv ? 8 : 0) | (b >= lv ? 4 : 0) | (c >= lv ? 2 : 0) | (e >= lv ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const x0 = cx * CP, y0 = cy * CP, L = S * CP;
        const top = [x0 + L * (lv - a) / (b - a), y0], right = [x0 + L, y0 + L * (lv - b) / (c - b)], bot = [x0 + L * (lv - e) / (c - e), y0 + L], left = [x0, y0 + L * (lv - a) / (e - a)];
        const seg = (p, q) => { d += `M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`; };
        switch (idx) {
          case 1: case 14: seg(left, bot); break;
          case 2: case 13: seg(bot, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 5: seg(top, left); seg(bot, right); break;
          case 10: seg(top, right); seg(left, bot); break;
          case 6: case 9: seg(top, bot); break;
          case 7: case 8: seg(top, left); break;
        }
      }
    }
    return d;
  }
  function tree(x, y) {
    return E('g', { transform: `translate(${x},${y})` }, [
      E('rect', { x: -3, y: -14, width: 6, height: 14, fill: '#8A5230', stroke: '#24303A', 'stroke-width': 2 }),
      E('circle', { cx: 0, cy: -24, r: 14, fill: '#5F9E4B', stroke: '#24303A', 'stroke-width': 2.5 }),
    ]);
  }
  /* 해안선에서 바다 쪽으로 d(px) 떨어진 곡선 (수심선) */
  function offsetPath(d, closeUp) {
    const sh = scenes[scene].shore; let p = '';
    for (let x = -40; x <= 1000; x += 4) {
      const y = sh(x), s = (sh(x + 1) - sh(x - 1)) / 2, m = Math.hypot(1, s);
      const qx = x - s / m * d, qy = y + 1 / m * d;
      p += (p ? 'L' : 'M') + qx.toFixed(1) + ' ' + qy.toFixed(1);
    }
    return closeUp ? p + 'L1000 -60L-40 -60Z' : p;
  }
  function buildSvg() {
    svg.innerHTML = '';
    const sh = scenes[scene].shore;
    svg.appendChild(E('defs', {}, [
      E('marker', { id: 'arr4', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' }, [E('path', { d: 'M0 0 L10 5 L0 10 Z', fill: '#E8553E' })]),
    ]));
    // 바다: 깊음 → 중간 → 얕음 (밝을수록 얕음)
    svg.appendChild(E('rect', { x: -40, y: -40, width: 1040, height: 620, fill: '#2E7DB0' }));
    const dMid = (H_MID - HMIN) / SLOPE, dShal = (H_SHAL - HMIN) / SLOPE;
    svg.appendChild(E('path', { d: offsetPath(dMid, true), fill: '#5FB0DE' }));
    svg.appendChild(E('path', { d: offsetPath(dShal, true), fill: '#9DDBF3' }));
    svg.appendChild(E('path', { d: offsetPath(dMid), fill: 'none', stroke: '#1E5A85', 'stroke-width': 2, 'stroke-dasharray': '8 6', opacity: .55 }));
    svg.appendChild(E('path', { d: offsetPath(dShal), fill: 'none', stroke: '#1E5A85', 'stroke-width': 2, 'stroke-dasharray': '8 6', opacity: .55 }));
    // 마루선 (뒤: 진한 테두리, 앞: 흰 선)
    crestG = E('g');
    crestBack = E('path', { fill: 'none', stroke: '#1E5A85', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: .7 });
    crestFront = E('path', { fill: 'none', stroke: '#fff', 'stroke-width': 3.5, 'stroke-linecap': 'round' });
    crestG.appendChild(crestBack); crestG.appendChild(crestFront); svg.appendChild(crestG);
    // 해안 거품
    svg.appendChild(E('path', { d: offsetPath(6), fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-dasharray': '10 8', 'stroke-linecap': 'round', opacity: .9 }));
    rayG = E('g'); svg.appendChild(rayG);
    // 육지 (위쪽): 모래 띠 + 초록
    let d1 = `M-40 ${sh(-40)}`, d2 = `M-40 ${sh(-40) - 46}`;
    for (let x = -32; x <= 1000; x += 8) { d1 += `L${x} ${sh(x).toFixed(1)}`; d2 += `L${x} ${(sh(x) - 46).toFixed(1)}`; }
    svg.appendChild(E('path', { d: d1 + 'L1000 -60L-40 -60Z', fill: '#E6C377', stroke: '#24303A', 'stroke-width': 4, 'stroke-linejoin': 'round' }));
    svg.appendChild(E('path', { d: d2 + 'L1000 -60L-40 -60Z', fill: '#8FB07A', stroke: '#24303A', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    [120, 520, 900].forEach(x => svg.appendChild(tree(x, sh(x) - 60)));
    if (scene === 'cape') {
      svg.appendChild(E('g', { transform: `translate(300,${sh(300) - 6})` }, [
        E('path', { d: 'M-70 -8 L-50 14 L-22 2 L-6 22 L20 6 L44 18 L66 -8 Z', fill: '#8A8276', stroke: '#24303A', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
        E('path', { d: 'M-50 14 L-40 -2 M-6 22 L-2 4 M44 18 L36 0', stroke: '#24303A', 'stroke-width': 2, opacity: .5 }),
      ]));
      svg.appendChild(E('g', { transform: `translate(780,${sh(780) - 22})` }, [
        E('path', { d: 'M-26 0 A26 26 0 0 1 26 0 Z', fill: '#E8553E', stroke: '#24303A', 'stroke-width': 3 }),
        E('path', { d: 'M-13 -22 A13 13 0 0 1 13 -22', fill: 'none', stroke: '#24303A', 'stroke-width': 3 }),
        E('path', { d: 'M0 0 L0 20', stroke: '#24303A', 'stroke-width': 3 }),
      ]));
      for (let i = 0; i < 12; i++) { const x = 700 + (i * 37) % 170; svg.appendChild(E('circle', { cx: x, cy: sh(x) - 10 - (i * 13) % 28, r: 2.5, fill: '#D9AD5C', stroke: '#24303A', 'stroke-width': 1.2 })); }
    }
    labelG = E('g'); svg.appendChild(labelG);
    const add = (p, steps) => { p.g.dataset.steps = steps; labelG.appendChild(p.g); };
    if (scene === 'cape') {
      const a = pill(TX.labels.cape.cape, { fs: 22, bg: '#FFE082' }); a.move(300, sh(300) - 78); add(a, '0123');
      const b = pill(TX.labels.cape.bay, { fs: 22, bg: '#FFE082' }); b.move(780, sh(780) + 42); add(b, '0123');
      const c1 = pill(TX.labels.cape.c1, { fs: 14, pad: 7 }); c1.move(560, 236); add(c1, '1');
      const c2 = pill(TX.labels.cape.c2, { fs: 14, pad: 7 }); c2.move(560, 420); add(c2, '1');
      const r1 = pill(TX.labels.cape.r1, { fs: 14, pad: 7 }); r1.move(300, sh(300) + 62); add(r1, '2');
      const r2 = pill(TX.labels.cape.r2, { fs: 14, pad: 7 }); r2.move(780, sh(780) + 120); add(r2, '2');
      const a2 = pill(TX.labels.cape.a2, { fs: 13, pad: 6, bg: '#FBE5E2' }); a2.move(300, sh(300) - 50); add(a2, '3');
      const b2 = pill(TX.labels.cape.b2, { fs: 13, pad: 6, bg: '#E4F3E8' }); b2.move(780, sh(780) + 70); add(b2, '3');
    } else {
      const c1 = pill(TX.labels.line.c1, { fs: 14, pad: 7 }); c1.move(700, sh(700) + 60); add(c1, '1');
      const c2 = pill(TX.labels.line.c2, { fs: 14, pad: 7 }); c2.move(700, 400); add(c2, '1');
      const s3 = pill(TX.labels.line.s3, { fs: 14, pad: 7 }); s3.move(700, sh(700) + 60); add(s3, '2');
      const s4 = pill(TX.labels.line.s4, { fs: 14, pad: 7, bg: '#FFE082' }); s4.move(700, sh(700) + 60); add(s4, '3');
    }
  }
  function renderRays() {
    rayG.innerHTML = '';
    rays.forEach(pts => rayG.appendChild(E('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: '#E8553E', 'stroke-width': 3, opacity: .95, 'stroke-linejoin': 'round', 'marker-end': 'url(#arr4)' })));
  }
  function applyView() {
    rayG.style.display = step >= 2 ? '' : 'none';
    labelG.querySelectorAll('[data-steps]').forEach(el => el.style.display = el.dataset.steps.includes(String(step)) ? '' : 'none');
  }
  function recompute(full) {
    if (full) { buildDepth(); buildSvg(); }
    march(); traceRays(); renderRays(); applyView(); drawCrests();
  }
  function drawCrests() { const d = crestPaths(); crestBack.setAttribute('d', d); crestFront.setAttribute('d', d); }
  const setCap = h => { $('#cap4').innerHTML = hangCap(h); };
  const STEPS = TX.STEPS;
  function applyStep() {
    const st = STEPS[scene][step]; $('#badge4').textContent = st.badge; setCap(st.cap);
    $$('#t4-steps .dot').forEach((d, i) => { d.classList.toggle('on', i === step); d.classList.toggle('done', i < step); });
    $('#t4-prev').disabled = step === 0; $('#t4-next').disabled = step === 3;
    applyView();
  }
  function render(dt) {
    if (!inited) return;
    tt += dt; drawCrests();
  }
  function setScene(sc) {
    scene = sc; ang = scenes[sc].ang; $('#r4-ang').value = ang; angLabel();
    $$('#seg4-scene button').forEach(b => b.classList.toggle('sel', b.dataset.v === sc));
    step = 0; recompute(true); applyStep();
  }
  function angLabel() { $('#v4-ang').textContent = ang === 0 ? TX.angFront : (ang > 0 ? TX.angLeft : TX.angRight) + Math.abs(ang) + '°'; }
  let pendingAng = false;
  $('#r4-ang').addEventListener('input', e => { ang = +e.target.value; angLabel(); if (pendingAng) return; pendingAng = true; requestAnimationFrame(() => { pendingAng = false; recompute(false); }); });
  $$('#seg4-scene button').forEach(b => b.onclick = () => setScene(b.dataset.v));
  for (let i = 0; i < 4; i++) { const d = document.createElement('div'); d.className = 'dot'; $('#t4-steps').appendChild(d); }
  $('#t4-prev').onclick = () => { if (step > 0) { step--; applyStep(); } };
  $('#t4-next').onclick = () => { if (step < 3) { step++; applyStep(); } };
  registerPauseBtn($('#t4-pause'));
  tabInit['4'] = () => { if (inited) return; inited = true; setScene('cape'); };
  frames['4'] = render;
})();
