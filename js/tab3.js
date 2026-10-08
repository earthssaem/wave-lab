/* 탭3: 풍랑·너울·연안 쇄파 — ① 바람 부는 해역의 풍랑 → ② 바람이 불지 않는 해역의 너울 → ③ 해안의 연안 쇄파를 이어서 자동 재생
   하나의 긴 바다(world x) 위에서 카메라가 파도를 따라 이동. 너울은 분산 관계(ω² = gk·tanh kh)로 수심에 따른 파장·속도를,
   에너지 흐름 보존(천수 계수)으로 파고를 계산하고, 파고가 수심의 0.78배에 이르면 부서진 뒤 파고 = 0.78 × 수심으로 줄어듦 (단순화한 모형) */
/* ================= 탭3: 풍랑·너울·연안 쇄파 ================= */
(function () {
  const TX = TEXT.tab3; // 이 탭의 문구
  const svg = $('#svg3');
  const TAU = 2 * Math.PI;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---- 장면 (단위: px, s) ---- */
  const Y0 = 290;                 // 평균 해수면
  const XW = 1100;                // 바람이 부는 해역의 끝
  const CAM2 = 1200;              // ② 너울을 보는 카메라 위치
  const XC = 2300;                // ③ 해안을 보는 카메라 위치
  const US = 830, XS = XC + US;   // 해안선 (해안 장면 안 x, world x)
  const BED = .34;                // 해저면 경사(그림)
  /* ---- 너울: 주기 T, 깊은 바다 파장 L0. 수심·파고는 그림에서 VEX배 과장 (파고/수심 비는 과장과 무관) ---- */
  const T = 2.5, OM = TAU / T, L0 = 260, G = TAU * L0 / (T * T), VEX = 18, H0 = 36, GAM = .78, DMIN = 8;
  const PH0 = 1.3;
  /* ---- 풍랑: 짧은 파장 성분들 (바람 부는 해역을 벗어나면 D 거리로 약해짐, 짧을수록 빨리) ---- */
  const WIND = [{ L: 58, a: 5, D: 70, p: .4 }, { L: 84, a: 7.5, D: 110, p: 2.3 }, { L: 112, a: 8.5, D: 160, p: 4.1 }, { L: 150, a: 7, D: 220, p: 1.3 }]
    .map(w => { const k = TAU / w.L; return { ...w, k, om: Math.sqrt(G * k) }; });
  const QW = .44; // 풍랑 마루를 뾰족하게 (Gerstner)

  /* ---- 타임라인: ① 12 s → ② 16 s → ③ 23 s ---- */
  const DUR = [12, 16, 23], START = [0, 12, 28], TOTAL = 51, PAN2 = 8, PAN3 = 4;

  /* ---- 수심·너울 표 (world x, 2 px 간격) ---- */
  const depth = x => { const u = x - XC; return u >= US ? 0 : u >= 0 ? BED * (US - u) : Math.min(4000, BED * US + 4 * -u); };
  const XMIN = -400, XMAX = XS + 400, DX = 2, N = (XMAX - XMIN) / DX + 1;
  const KK = new Float64Array(N), PHI = new Float64Array(N), HH = new Float64Array(N), MM = new Float64Array(N), LEAN = new Float64Array(N);
  let XB = XS;
  (function build() {
    const cg0 = G / (2 * OM);
    const Hsh = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const x = XMIN + i * DX, h = Math.max(depth(x), DMIN) / VEX;
      const q = OM * Math.sqrt(h / G), kh = q * q * Math.pow(1 - Math.exp(-Math.pow(q, 2.4908)), -.4015), k = kh / h;
      KK[i] = k; MM[i] = Math.min(2.4, 1 + 1.5 * (1 - Math.tanh(kh)));
      const c = OM / k, cg = c / 2 * (1 + 2 * kh / Math.sinh(2 * kh));
      Hsh[i] = H0 * (.7 + .3 * sm(-100, 900, x)) * Math.sqrt(cg0 / cg);
      if (i) PHI[i] = PHI[i - 1] + (KK[i - 1] + k) / 2 * DX;
    }
    for (let i = 0; i < N; i++) {
      const x = XMIN + i * DX, d = depth(x);
      if (XB === XS && x > XC && Hsh[i] >= GAM * d) XB = x;
      HH[i] = x >= XS ? 0 : Math.min(Hsh[i], GAM * d);
    }
    for (let i = 0; i < N; i++) { const x = XMIN + i * DX; LEAN[i] = x < XB ? .8 * sm(XB - 260, XB, x) : .85; }
  })();
  const at = (A, x) => { const f = clamp((x - XMIN) / DX, 0, N - 1.001), i = f | 0, r = f - i; return A[i] + (A[i + 1] - A[i]) * r; };
  const phiInv = v => { let lo = 0, hi = N - 1; if (v <= PHI[0]) return XMIN; if (v >= PHI[hi]) return XMAX; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (PHI[m] < v) lo = m; else hi = m; } return XMIN + (lo + (v - PHI[lo]) / (PHI[hi] - PHI[lo])) * DX; };
  const mu = m => 1 / Math.sqrt(Math.PI * (m + .25)); // ((1+cosθ)/2)^m 의 평균 → 평균 해수면 유지

  /* ---- 그림 요소 ---- */
  svg.appendChild(E('defs', {}, [
    E('linearGradient', { id: 's3-water', x1: 0, y1: 0, x2: 0, y2: 1 }, [E('stop', { offset: 0, 'stop-color': '#7CC4EA' }), E('stop', { offset: 1, 'stop-color': '#1E5A85' })]),
    E('linearGradient', { id: 's3-sky', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 1700, y2: 0 }, [E('stop', { offset: 0, 'stop-color': '#A9C3D1' }), E('stop', { offset: .6, 'stop-color': '#B1CCDA' }), E('stop', { offset: 1, 'stop-color': '#BFE3F5' })]),
  ]));
  const back = E('g'); svg.appendChild(back);           // world: 하늘·구름·바람
  back.appendChild(E('rect', { x: XMIN, y: -40, width: XMAX - XMIN, height: 620, fill: 'url(#s3-sky)' }));
  const cloud = (x, y, s, fill) => E('path', { d: 'M0 0 a26 26 0 0 1 50 -16 a30 30 0 0 1 58 8 a20 20 0 0 1 4 40 l-110 0 a22 22 0 0 1 -2 -32 Z', fill, stroke: '#24303A', 'stroke-width': 4 / s, transform: `translate(${x},${y}) scale(${s})` });
  [[90, 70, 1, '#D2DBE1'], [380, 52, .8, '#C7D1D8'], [640, 78, 1.1, '#D2DBE1'], [930, 56, .85, '#C7D1D8'], [1560, 64, .8, '#fff'], [2050, 80, .7, '#fff'], [2620, 60, .85, '#fff'], [3060, 84, .7, '#fff']].forEach(([x, y, s, f]) => back.appendChild(cloud(x, y, s, f)));
  back.appendChild(E('path', { d: `M${XW} 40 L${XW} ${Y0 - 50}`, stroke: '#24303A', 'stroke-width': 2, 'stroke-dasharray': '8 7', opacity: .45 }));
  const winds = [];
  for (let i = 0; i < 9; i++) {
    const d = 'M-44 0 Q-30 -9 -15 0 T14 0 M14 0 L4 -8 M14 0 L4 8';
    const g = E('g', {}, [E('path', { d, stroke: '#24303A', 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), E('path', { d, stroke: '#fff', 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]);
    back.appendChild(g); winds.push({ g, off: i * 131, y: 140 + (i * 37) % 95 });
  }
  const addPill = (parent, text, x, y, o) => { const p = pill(text, o); p.move(x, y); parent.appendChild(p.g); return p; };
  addPill(back, TX.wind, 250, 106, { fs: 16, pad: 8 });
  addPill(back, TX.windZone, 560, 30, { fs: 16, pad: 8, bg: '#E3EAEF' });
  addPill(back, TX.calmZone, 1690, 30, { fs: 16, pad: 8 });
  // 해: 아주 멀리 있으므로 화면에 고정, 바람 부는 해역(구름 아래)에서는 가려짐
  const sun = E('g', { transform: 'translate(868,70)' }); svg.appendChild(sun);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, r1 = 38, r2 = i % 2 ? 48 : 54;
    const l = [Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * r2, Math.sin(a) * r2];
    sun.appendChild(E('line', { x1: l[0], y1: l[1], x2: l[2], y2: l[3], stroke: '#24303A', 'stroke-width': 8, 'stroke-linecap': 'round' }));
    sun.appendChild(E('line', { x1: l[0], y1: l[1], x2: l[2], y2: l[3], stroke: '#FFE082', 'stroke-width': 4.5, 'stroke-linecap': 'round' }));
  }
  sun.appendChild(E('circle', { r: 30, fill: '#FFE082', stroke: '#24303A', 'stroke-width': 4 }));
  const water = E('path', { fill: 'url(#s3-water)', stroke: '#24303A', 'stroke-width': 3.5, 'stroke-linejoin': 'round' }); svg.appendChild(water);
  // world: 해저면·해안
  const front = E('g'); svg.appendChild(front);
  const beachY = u => u <= 100 ? Y0 - .3 * u : Y0 - 30 - .08 * (u - 100);
  let bed = `M${XC - 80} 600`;
  for (let x = XC - 80; x <= XS + 400; x += 10) bed += `L${x} ${(x < XS ? Y0 + depth(x) : beachY(x - XS)).toFixed(1)}`;
  front.appendChild(E('path', { d: bed + `L${XS + 400} 600Z`, fill: '#E6C377', stroke: '#24303A', 'stroke-width': 3.5, 'stroke-linejoin': 'round' }));
  for (let x = XC + 130; x < XS + 360; x += 46) { const y = (x < XS ? Y0 + depth(x) : beachY(x - XS)) + 16 + (x % 3) * 9; if (y < 545) front.appendChild(E('circle', { cx: x + (x % 5) * 4, cy: y, r: 3, fill: '#D9AD5C', stroke: '#24303A', 'stroke-width': 1.5 })); }
  front.appendChild(E('g', { transform: `translate(${XS + 105},${beachY(105) + 2})` }, [
    E('rect', { x: -4, y: -26, width: 8, height: 26, fill: '#8A5230', stroke: '#24303A', 'stroke-width': 2.5 }),
    E('circle', { cx: 0, cy: -42, r: 21, fill: '#5F9E4B', stroke: '#24303A', 'stroke-width': 3 }),
  ]));
  addPill(front, TX.shallow + ' →', XC + 330, Y0 + depth(XC + 330) + 34, { fs: 15, pad: 8, bg: '#FFF3CF' });
  const pBreak = addPill(front, TX.breaking, XB + 25, Y0 - 112, { fs: 17, pad: 8, bg: '#FFE082' });
  const swash = E('path', { fill: 'none', stroke: '#74BFE8', 'stroke-width': 6, 'stroke-linecap': 'round' }); svg.appendChild(swash);
  const swashFoam = E('path', { fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round' }); svg.appendChild(swashFoam);
  const fx = E('g'); svg.appendChild(fx);
  const ann = E('g'); svg.appendChild(ann);

  /* ---- 거품·쇄파 마루 (재사용 풀) ---- */
  const FOAM = [[0, 0, 6], [-7, 4, 4.5], [7, 3, 4], [13, 9, 3.2]];
  const foamPool = [], lipPool = [], rollPool = [];
  const getFoam = i => { if (!foamPool[i]) { const g = E('g'); FOAM.forEach(([x, y, r]) => g.appendChild(E('circle', { cx: x, cy: y, r, fill: '#fff', stroke: '#24303A', 'stroke-width': 1.5 }))); fx.appendChild(g); foamPool[i] = g; } return foamPool[i]; };
  const getLip = i => {
    if (!lipPool[i]) { const g = E('g'); const p = E('path', { fill: '#74BFE8', stroke: '#24303A', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }); g.appendChild(p); const sp = E('g'); [[0, 0, 5], [7, -5, 3.5], [-4, -7, 3], [9, 4, 3]].forEach(([x, y, r]) => sp.appendChild(E('circle', { cx: x, cy: y, r, fill: '#fff', stroke: '#24303A', 'stroke-width': 1.5 }))); g.appendChild(sp); fx.appendChild(g); lipPool[i] = { g, p, sp }; }
    return lipPool[i];
  };
  const ROLL = [[0, 0, 7], [8, 6, 6], [-8, 3, 5.5], [15, 13, 5], [3, 12, 5.5], [-14, 8, 4]];
  const getRoll = i => { if (!rollPool[i]) { const g = E('g'); ROLL.forEach(([x, y, r]) => g.appendChild(E('circle', { cx: x, cy: y, r, fill: '#fff', stroke: '#24303A', 'stroke-width': 1.5 }))); fx.appendChild(g); rollPool[i] = g; } return rollPool[i]; };
  const hideFrom = (pool, n) => { for (let i = n; i < pool.length; i++) (pool[i].g || pool[i]).style.display = 'none'; };

  /* ---- ③ 추적하는 마루의 표시: 점선 = 처음 값, 실선 = 지금 값 ---- */
  const AP = { stroke: '#E8553E', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const GP = { stroke: '#24303A', 'stroke-width': 3, fill: 'none', 'stroke-dasharray': '6 5', opacity: .7 };
  const mk = E('path', { d: 'M-9 -14 L9 -14 L0 0 Z', fill: '#E8553E', stroke: '#24303A', 'stroke-width': 2, 'stroke-linejoin': 'round' });
  const aSpeed = E('g'), sGhost = E('path', GP), sLine = E('path', AP), pSpeed = pill(TX.speed, { fs: 15, pad: 7 });
  aSpeed.append(sGhost, sLine, pSpeed.g);
  const aLen = E('g'), lGhost = E('path', GP), lLine = E('path', AP), pLen = pill(TX.length, { fs: 15, pad: 7 });
  aLen.append(lGhost, lLine, pLen.g);
  const aHt = E('g'), hGhost = E('path', GP), hLine = E('path', AP), pHt = pill(TX.height, { fs: 15, pad: 7 });
  aHt.append(hGhost, hLine, pHt.g);
  ann.append(aLen, aHt, aSpeed, mk);
  const tick = (x1, x2, y) => `M${x1} ${y - 8}L${x1} ${y + 8}M${x2} ${y - 8}L${x2} ${y + 8}M${x1} ${y}L${x2} ${y}`;
  const arrowR = (x1, x2, y) => `M${x1} ${y}L${x2} ${y}M${x2 - 9} ${y - 7}L${x2} ${y}L${x2 - 9} ${y + 7}`;

  /* ---- 상태 ---- */
  let t = 0, tau = 0, state = 'idle', stage = -1, camX = 0, track = null, phase = -1;
  const camAt = s => s < START[1] ? 0
    : s < START[2] ? CAM2 * sm(0, 1, (s - START[1]) / PAN2)
    : CAM2 + (XC - CAM2) * sm(0, 1, (s - START[2]) / PAN3);
  const stageAt = s => s < START[1] ? 0 : s < START[2] ? 1 : 2;

  /* ③에 들어설 때: 카메라 이동이 끝나는 순간 화면 왼쪽(해안 장면 x ≥ 50)에 막 들어온 마루를 골라 끝까지 따라감 */
  function pickTrack() {
    const te = t + (START[2] + PAN3 - tau), Ft = OM * te - PH0;
    const n = Math.ceil((at(PHI, XC + 50) - Ft) / TAU), xe = phiInv(Ft + TAU * n), k = at(KK, xe), H = at(HH, xe);
    const tb = (at(PHI, XB) + PH0 - TAU * n) / OM; // 이 마루가 부서지기 시작하는 시각
    track = { n, xe, te, tb, c: OM / k, L: TAU / k, H };
  }

  /* ---- 수면 그리기 ---- */
  const SX = [], SY = [], SW = [];
  function surface() {
    const Ft = OM * t - PH0;
    let d = '';
    SX.length = SY.length = SW.length = 0;
    for (let sx = -32; sx <= 992; sx += 4) {
      const x = camX + sx;
      const k = at(KK, x), m = at(MM, x), H = at(HH, x), th = at(PHI, x) - Ft, c2 = (1 + Math.cos(th)) / 2;
      let eta = H * (Math.pow(c2, m) - mu(m)), dx = at(LEAN, x) * 1.415 / k * c2 * c2, wsum = 0;
      if (x < XW + 900) {
        const fetch = .55 + .45 * sm(-200, 700, x);
        WIND.forEach((w, i) => {
          const env = fetch * (x < XW ? 1 : Math.exp(-(x - XW) / w.D)); if (env < .01) return;
          const a = w.a * env * (1 + .18 * Math.sin(.37 * t * (i + 1) + w.p)), th2 = w.k * x - w.om * t + w.p;
          eta += a * Math.cos(th2); dx -= QW * a * Math.sin(th2); wsum += env;
        });
      }
      const X = sx + dx, Y = Y0 - eta;
      SX.push(X); SY.push(Y); SW.push(wsum);
      d += (d ? 'L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1);
    }
    water.setAttribute('d', d + 'L992 600L-32 600Z');
    // 풍랑의 흰 물마루: 바람 부는 해역에서 높고 뾰족한 마루 위
    let nf = 0;
    for (let i = 1; i < SX.length - 1 && nf < 14; i++) {
      if (SW[i] < .8 || !(SY[i] < SY[i - 1] && SY[i] <= SY[i + 1])) continue;
      const hgt = Y0 - SY[i]; if (hgt < 13) continue;
      const g = getFoam(nf++); g.style.display = '';
      g.setAttribute('transform', `translate(${SX[i].toFixed(1)},${(SY[i] - 2).toFixed(1)}) scale(${clamp((hgt - 8) / 14, .45, 1).toFixed(2)})`);
    }
    hideFrom(foamPool, nf);
  }

  /* ---- 해안: 부서지는 마루·흰 물결·밀려 올라가는 물 ---- */
  function coast() {
    const inView = camX > XC - 980;
    let nl = 0, nr = 0;
    swash.style.display = swashFoam.style.display = inView ? '' : 'none';
    if (inView) {
      const Ft = OM * t - PH0, Hb = at(HH, XB);
      const n0 = Math.ceil((at(PHI, XB - 60) - Ft) / TAU), n1 = Math.floor((at(PHI, XS - 12) - Ft) / TAU);
      for (let n = n0; n <= n1; n++) {
        const x = phiInv(Ft + TAU * n), k = at(KK, x), H = at(HH, x), m = at(MM, x);
        const cx = x - camX + at(LEAN, x) * 1.415 / k, cy = Y0 - H * (1 - mu(m)), p = (x - XB) / 36;
        if (p > -.6 && p < 1.25) {   // 마루가 앞으로 말려 떨어짐
          const L = getLip(nl++), S = Hb, e1 = sm(-.6, .5, p), e2 = sm(.15, 1, p);
          const tx = cx + S * (.15 + .7 * e1), ty = cy + S * (-.1 * e1 + .95 * e2);
          L.g.style.display = ''; L.g.style.opacity = 1 - sm(1, 1.25, p);
          L.p.setAttribute('d', `M${cx - S * .1} ${cy + S * .02}C${cx + S * .25 * e1} ${cy - S * .2 * e1} ${tx + S * .2 * (1 - e2)} ${ty - S * .45 * (1 - .6 * e2)} ${tx} ${ty}C${tx - S * .08} ${ty - S * .22} ${cx + S * .25 * e1} ${cy + S * .12} ${cx + S * .1} ${cy + S * .5}Z`);
          const ss = sm(.45, 1.1, p); L.sp.style.display = ss > 0 ? '' : 'none';
          L.sp.setAttribute('transform', `translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${(.4 + .9 * ss).toFixed(2)})`);
        }
        if (p > .8) {                 // 부서진 뒤: 흰 물결이 해안으로 밀려감 (파고가 줄어들수록 작게)
          const g = getRoll(nr++), s = clamp(H / Hb, .2, 1) * sm(.8, 1.3, p);
          g.style.display = ''; g.setAttribute('transform', `translate(${(cx + 4).toFixed(1)},${(cy - 2).toFixed(1)}) scale(${s.toFixed(2)})`);
        }
      }
      // 해안에서 물이 비탈을 오르내림
      const ps = at(PHI, XS - 40) - Ft, r = 46 * Math.pow(.5 + .5 * Math.cos(ps - 1.2), 2);
      const u0 = XS - camX - 8; let d = `M${u0} ${Y0 - 1}`;
      for (let u = 0; u <= r; u += 4) d += `L${(XS - camX + u).toFixed(1)} ${(beachY(u) - 2).toFixed(1)}`;
      swash.setAttribute('d', d);
      const ut = Math.max(0, r - 10);
      swashFoam.setAttribute('d', r > 3 ? `M${(XS - camX + ut).toFixed(1)} ${(beachY(ut) - 3).toFixed(1)}L${(XS - camX + r).toFixed(1)} ${(beachY(r) - 3).toFixed(1)}` : '');
    }
    hideFrom(lipPool, nl); hideFrom(rollPool, nr);
  }

  /* ---- ③ 추적 마루 표시 + 관찰 순서(속도 → 파장 → 파고 → 부서짐) ---- */
  function annotate() {
    let ph = -1;
    if (state === 'end') ph = 4;
    else if (stage === 2 && track && t >= track.te) {
      // 관찰 순서는 시간으로 고르게 나눔 (해안 가까이에서 마루가 느려져도 단계마다 비슷한 시간)
      const Ft = OM * t - PH0, x = phiInv(Ft + TAU * track.n), f = (t - track.te) / (track.tb - track.te);
      ph = f >= 1 ? (t - track.tb > 2.5 ? 4 : 3) : f >= .64 ? 2 : f >= .32 ? 1 : 0;
      if (ph <= 2) {
        const k = at(KK, x), H = at(HH, x), m = at(MM, x), cx = x - camX + at(LEAN, x) * 1.415 / k, cy = Y0 - H * (1 - mu(m));
        mk.setAttribute('transform', `translate(${cx.toFixed(1)},${(cy - 6).toFixed(1)})`);
        // 속도: 화살표 길이 ∝ 속도
        const ys = cy - 34, x1 = cx + 14;
        sGhost.setAttribute('d', arrowR(x1, x1 + track.c * .62, ys)); sLine.setAttribute('d', arrowR(x1, x1 + OM / k * .62, ys));
        pSpeed.move(x1 + track.c * .31, ys - 22);
        // 파장: 이 마루와 바로 뒤 마루 사이
        const xb2 = phiInv(Ft + TAU * (track.n - 1)), kb = at(KK, xb2), bx = xb2 - camX + at(LEAN, xb2) * 1.415 / kb, yl = Y0 - 84;
        lGhost.setAttribute('d', tick(cx - track.L, cx, yl)); lLine.setAttribute('d', arrowD(bx, yl, cx, yl, 9));
        pLen.move((bx + cx) / 2, yl - 22);
        // 파고: 골에서 마루까지
        const yt = Y0 + H * mu(m), hx = cx - 20;
        hGhost.setAttribute('d', `M${hx - 12} ${yt}L${hx - 12} ${yt - track.H}M${hx - 18} ${yt - track.H}L${hx - 6} ${yt - track.H}`);
        hLine.setAttribute('d', arrowD(hx, yt, hx, cy, 8));
        pHt.move(hx - 40, cy - 16);
      }
    }
    const show = (g, from) => { g.style.display = ph >= from && ph <= 2 ? '' : 'none'; g.style.opacity = ph === from ? 1 : .5; };
    show(aSpeed, 0); show(aLen, 1); show(aHt, 2);
    mk.style.display = ph >= 0 && ph <= 2 ? '' : 'none';
    pBreak.g.style.display = ph >= 3 ? '' : 'none';
    if (ph !== phase) { phase = ph; checkEls.forEach((li, i) => { li.classList.toggle('now', i === ph); li.classList.toggle('done', i < ph); }); }
  }

  function render(dt) {
    t += dt;
    if (state === 'play') { tau += dt; if (tau >= TOTAL) { tau = TOTAL; state = 'end'; syncButtons(); } }
    const st = stageAt(tau); if (st !== stage) enterStage(st);
    camX = camAt(tau);
    back.setAttribute('transform', `translate(${-camX},0)`); front.setAttribute('transform', `translate(${-camX},0)`);
    sun.style.opacity = sm(600, 1150, camX);
    winds.forEach(w => {
      const x = -160 + mod(w.off + 150 * t, XW + 60), o = sm(-160, -60, x) * (1 - sm(XW - 160, XW - 20, x));
      w.g.setAttribute('transform', `translate(${x.toFixed(1)},${(w.y + 5 * Math.sin(t * 2 + w.off)).toFixed(1)})`); w.g.style.opacity = o.toFixed(2);
    });
    surface(); coast(); annotate(); syncProgress();
  }

  /* ---- 관찰 순서 카드·버튼·해설 ---- */
  const setExplain = explainCard($('#ex3'));
  const stepEls = TX.steps.map((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="st-btn"><span class="st-num">${i + 1}</span><span class="st-txt"><b>${s.name}</b><small>${s.where}</small></span></button><span class="st-bar"><i></i></span>`;
    li.querySelector('button').onclick = () => playFrom(START[i]);
    $('#st3').appendChild(li); return li;
  });
  const checks = document.createElement('ul'); checks.className = 'checks';
  checks.innerHTML = TX.checks.map((c, i) => `<li data-n="${i + 1}">${c}</li>`).join('');
  stepEls[2].appendChild(checks);
  const checkEls = Array.from(checks.children), bars = stepEls.map(li => li.querySelector('.st-bar i'));
  function syncProgress() {
    stepEls.forEach((li, i) => {
      const f = state === 'idle' ? 0 : clamp((tau - START[i]) / DUR[i], 0, 1);
      bars[i].style.width = (f * 100).toFixed(1) + '%';
      li.classList.toggle('on', i === stage); li.classList.toggle('done', state !== 'idle' && f >= 1 && i !== stage);
    });
  }
  function enterStage(st) {
    stage = st; $('#badge3').textContent = TX.steps[st].badge; setExplain(TX.cap[st]);
    track = null; if (st === 2) pickTrack();
  }
  const playBtn = $('#t3-play');
  function syncButtons() { playBtn.textContent = state === 'idle' ? TX.play : TX.replay; playBtn.classList.toggle('primary', state !== 'play'); }
  function playFrom(s) { tau = s; state = 'play'; stage = -1; setPaused(false); syncButtons(); }
  playBtn.onclick = () => playFrom(0);
  registerPauseBtn($('#t3-pause'));
  syncButtons(); render(0);
  frames['3'] = render;
})();
