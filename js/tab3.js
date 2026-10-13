/* 탭3: 풍랑·너울·연안 쇄파 — ① 바람 부는 해역의 풍랑 → (경계 정지) → ② 바람이 불지 않는 해역의 너울 → ③ 해안의 연안 쇄파를 이어서 자동 재생
   하나의 긴 바다(world x) 위에서 카메라가 이동. 너울은 분산 관계(ω² = gk·tanh kh)로 수심에 따른 파장·속도를,
   에너지 흐름 보존(천수 계수)으로 파고를 계산하고, 파고가 수심의 0.78배에 이르면 부서진 뒤 파고 = 0.78 × 수심으로 줄어듦 (단순화한 모형).
   ③에서는 마루 하나를 골라 부서질 때까지 따라가며 속도 → 파장 → 파고 → 부서짐을 차례로 강조 (물리량은 항상 함께 변함) */
/* ================= 탭3: 풍랑·너울·연안 쇄파 ================= */
(function () {
  const TX = TEXT.tab3; // 이 탭의 문구
  const svg = $('#svg3');
  const TAU = 2 * Math.PI;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const INK = '#24303A';

  /* ---- 장면 (단위: px, s) ---- */
  const Y0 = 290;                 // 평균 해수면
  const XW = 1100;                // 바람이 부는 해역의 끝(경계)
  const CAM1 = 700;               // 경계 정지 카메라 (경계가 화면 x = 400)
  const CAM2 = 1550;              // ② 너울을 보는 카메라
  const US = 830;                 // 해안선의 ③ 화면 안 x
  const XC = 2812, XS = XC + US;  // ③ 카메라, 해안선(world x)
  const BED = .34, U1 = 120;      // 해안 쪽 해저 경사(해안선에서 U1 까지 직선), 그 너머는 네제곱으로 깊어짐
  /* ---- 너울: 주기 T, 깊은 바다 파장 L0·속도 C0·파고 H0. 수심·파고는 그림에서 VEX배 과장 (파고/수심 비는 과장과 무관) ---- */
  const T = 3.2, OM = TAU / T, L0 = 220, G = TAU * L0 / (T * T), VEX = 18, H0 = 37.5, GAM = .78, DMIN = 8;
  const K0 = TAU / L0, C0 = OM / K0, PH0 = 1.3;
  /* 수심: ③ 화면 왼쪽 끝(u = US)에서 속도가 깊은 바다의 90%가 되도록 C4를 정함 (kh = atanh(.9)) */
  const D90 = Math.atanh(.9) / (K0 / .9) * VEX, C4 = (D90 - BED * US) / Math.pow(US - U1, 4);
  const depth = x => { const u = XS - x; return u <= 0 ? 0 : Math.min(4000, BED * u + C4 * Math.pow(Math.max(0, u - U1), 4)); };
  /* ---- 풍랑: 짧은 파장 성분들 (바람 부는 해역을 벗어나면 D 거리로 약해짐, 짧을수록 빨리) ---- */
  const WIND = [{ L: 58, a: 7.5, D: 70, p: .4 }, { L: 84, a: 10.5, D: 110, p: 2.3 }, { L: 112, a: 12, D: 160, p: 4.1 }, { L: 150, a: 10, D: 220, p: 1.3 }]
    .map(w => { const k = TAU / w.L; return { ...w, k, om: Math.sqrt(G * k) }; });
  const QW = .3; // 풍랑 마루를 뾰족하게 (Gerstner). 성분이 모두 겹쳐도 Σ k·a·QW < 1 이라 윤곽이 접히지 않음

  /* ---- 타임라인: ① 10 s → 이동 6 s → 경계 정지 2.5 s → 이동 7.5 s → ② 8 s → 이동 11 s → ③ (추적 마루에 따라 약 27 s) ---- */
  const T1 = 10, P1 = 6, HOLD = 2.5, P2 = 7.5, T2 = 8, P3 = 11;
  const START = [0, T1, T1 + P1 + HOLD + P2 + T2];
  const DUR = [T1, START[2] - START[1], P3 + 27];
  let TOTAL = START[2] + DUR[2];  // ③ 길이는 pickTrack() 에서 추적 마루에 맞춰 다시 정함
  const camAt = s => {
    if (s < T1) return 0; s -= T1;
    if (s < P1) return CAM1 * sm(0, 1, s / P1); s -= P1;
    if (s < HOLD) return CAM1; s -= HOLD;
    if (s < P2) return CAM1 + (CAM2 - CAM1) * sm(0, 1, s / P2); s -= P2;
    if (s < T2) return CAM2; s -= T2;
    return CAM2 + (XC - CAM2) * sm(0, 1, s / P3);
  };
  const stageAt = s => s < START[1] ? 0 : s < START[2] ? 1 : 2;

  /* ---- 수심·너울 표 (world x, 2 px 간격) ---- */
  const XMIN = -400, XMAX = XS + 400, DX = 2, N = (XMAX - XMIN) / DX + 1;
  const KK = new Float64Array(N), PHI = new Float64Array(N), HH = new Float64Array(N), MM = new Float64Array(N), LEAN = new Float64Array(N), CU = new Float64Array(N);
  let XB = XS;
  (function build() {
    const cg0 = G / (2 * OM);
    const Hsh = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const x = XMIN + i * DX, h = Math.max(depth(x), DMIN) / VEX;
      const q = OM * Math.sqrt(h / G), kh = q * q * Math.pow(1 - Math.exp(-Math.pow(q, 2.4908)), -.4015), k = kh / h;
      KK[i] = k; MM[i] = Math.min(2.4, 1 + 1.5 * (1 - Math.tanh(kh)));
      const c = OM / k, cg = c / 2 * (1 + 2 * kh / Math.sinh(2 * kh));
      // 바람 부는 해역에서는 너울 성분이 35%만, 경계를 지나며 100%로 (풍랑 성분이 잦아드는 만큼 드러남)
      Hsh[i] = H0 * (.35 + .65 * sm(XW - 250, XW + 450, x)) * Math.sqrt(cg0 / cg);
      if (i) PHI[i] = PHI[i - 1] + (KK[i - 1] + k) / 2 * DX;
    }
    for (let i = 0; i < N; i++) {
      const x = XMIN + i * DX, d = depth(x);
      if (XB === XS && x > XC && Hsh[i] >= GAM * d) XB = x;
      HH[i] = x >= XS ? 0 : Math.min(Hsh[i], GAM * d);
    }
    for (let i = 0; i < N; i++) {
      const x = XMIN + i * DX;
      // 앞으로 쏠림: 쇄파 직전까지 0 → .8, 부서진 뒤에는 1.05 (앞면이 거의 수직인 톱니형)
      LEAN[i] = x < XB ? .8 * sm(XB - 260, XB, x) : .8 + .25 * sm(XB, XB + 40, x);
      // 말려 넘어감: 쇄파 지점 앞뒤 45 px 에서만
      CU[i] = sm(XB - 45, XB - 8, x) * (1 - sm(XB + 8, XB + 45, x));
    }
  })();
  const at = (A, x) => { const f = clamp((x - XMIN) / DX, 0, N - 1.001), i = f | 0, r = f - i; return A[i] + (A[i + 1] - A[i]) * r; };
  const phiInv = v => { let lo = 0, hi = N - 1; if (v <= PHI[0]) return XMIN; if (v >= PHI[hi]) return XMAX; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (PHI[m] < v) lo = m; else hi = m; } return XMIN + (lo + (v - PHI[lo]) / (PHI[hi] - PHI[lo])) * DX; };
  const mu = m => 1 / Math.sqrt(Math.PI * (m + .25)); // ((1+cosθ)/2)^m 의 평균 → 평균 해수면 유지
  const CURL_F = s => Math.exp(-(s - .3) * (s - .3) / .3), CURL_G = s => Math.exp(-(s - .62) * (s - .62) / .3); // 말림: 앞으로(f)·아래로(g)
  const CF0 = CURL_F(0);
  /* 마루(world x)의 화면 x·y (앞으로 쏠린 만큼 포함) */
  const crestXY = x => { const k = at(KK, x), m = at(MM, x), H = at(HH, x); return { x: x - camX + at(LEAN, x) * 1.415 / k + at(CU, x) * 1.45 / k * CF0, y: Y0 - H * (1 - mu(m)) + at(CU, x) * .55 * H * CURL_G(0), k, m, H }; };
  /* ③ 단계 경계: 추적 마루가 해안선에서 이 거리(u)에 올 때 다음 단계로 */
  const X1 = XS - 560, X2 = XS - 370;

  /* ---- 그림 요소: 하늘은 깊이별 시차 (해 15% · 하늘색/흰 구름 50% · 먹구름/바람/이름표 100%) ---- */
  svg.appendChild(E('defs', {}, [
    E('linearGradient', { id: 's3-water', x1: 0, y1: 0, x2: 0, y2: 1 }, [E('stop', { offset: 0, 'stop-color': '#7CC4EA' }), E('stop', { offset: 1, 'stop-color': '#1E5A85' })]),
    E('linearGradient', { id: 's3-sky', gradientUnits: 'userSpaceOnUse', x1: 900, y1: 0, x2: 1500, y2: 0 }, [E('stop', { offset: 0, 'stop-color': '#A9C3D1' }), E('stop', { offset: .6, 'stop-color': '#B1CCDA' }), E('stop', { offset: 1, 'stop-color': '#BFE3F5' })]),
  ]));
  const PAR_FAR = .15, PAR_MID = .5;
  const mid = E('g'); svg.appendChild(mid);            // 하늘색·흰 구름 (카메라의 50%)
  // 하늘: 색이 변하는 900~1500 구간만 그라데이션, 양 옆은 단색 (2 px 겹쳐 이음새 없음)
  mid.appendChild(E('rect', { x: -200, y: -40, width: 1102, height: 620, fill: '#A9C3D1' }));
  mid.appendChild(E('rect', { x: 1498, y: -40, width: 1600, height: 620, fill: '#BFE3F5' }));
  mid.appendChild(E('rect', { x: 900, y: -40, width: 600, height: 620, fill: 'url(#s3-sky)' }));
  const far = E('g'); svg.appendChild(far);            // 해 (카메라의 15%): ①에서는 화면 밖 오른쪽
  const sun = E('g', { transform: 'translate(1130,70)' }); far.appendChild(sun);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, r1 = 38, r2 = i % 2 ? 48 : 54;
    const l = [Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * r2, Math.sin(a) * r2];
    sun.appendChild(E('line', { x1: l[0], y1: l[1], x2: l[2], y2: l[3], stroke: INK, 'stroke-width': 8, 'stroke-linecap': 'round' }));
    sun.appendChild(E('line', { x1: l[0], y1: l[1], x2: l[2], y2: l[3], stroke: '#FFE082', 'stroke-width': 4.5, 'stroke-linecap': 'round' }));
  }
  sun.appendChild(E('circle', { r: 30, fill: '#FFE082', stroke: INK, 'stroke-width': 4 }));
  const cloud = (x, y, s, fill) => E('path', { d: 'M0 0 a26 26 0 0 1 50 -16 a30 30 0 0 1 58 8 a20 20 0 0 1 4 40 l-110 0 a22 22 0 0 1 -2 -32 Z', fill, stroke: INK, 'stroke-width': 4 / s, transform: `translate(${x},${y}) scale(${s})` });
  const clouds = E('g'); svg.appendChild(clouds);      // 흰 구름 (카메라의 50%, 해 앞)
  [[1110, 80, .9], [1486, 84, .85], [1826, 78, 1]].forEach(([x, y, s]) => clouds.appendChild(cloud(x, y, s, '#fff')));
  const back = E('g'); svg.appendChild(back);           // 바다에 붙은 것: 먹구름·경계·바람·이름표 (100%)
  [[90, 76, 1], [380, 60, .8], [600, 84, 1.1], [1000, 64, .85]].forEach(([x, y, s]) => back.appendChild(cloud(x, y, s, '#C7D1D8')));
  back.appendChild(E('path', { d: `M${XW} 40 L${XW} ${Y0 - 50}`, stroke: INK, 'stroke-width': 2, 'stroke-dasharray': '8 7', opacity: .45 }));
  const winds = [];
  for (let i = 0; i < 9; i++) {
    const d = 'M-44 0 Q-30 -9 -15 0 T14 0 M14 0 L4 -8 M14 0 L4 8';
    const g = E('g', {}, [E('path', { d, stroke: INK, 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), E('path', { d, stroke: '#fff', 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })]);
    back.appendChild(g); winds.push({ g, off: i * 131, y: 150 + (i * 37) % 95 });
  }
  const addPill = (parent, text, x, y, o) => { const p = pill(text, o); p.move(x, y); parent.appendChild(p.g); return p; };
  addPill(back, TX.wind, 250, 118, { fs: 16, pad: 8 });
  addPill(back, TX.windZone, 850, 62, { fs: 16, pad: 8, bg: '#E3EAEF' });   // ①·경계 정지 화면용 (경계 정지 때 배지와 겹치지 않게 아래 줄)
  addPill(back, TX.calmZone, 1350, 30, { fs: 16, pad: 8 });   // 경계 정지 화면용
  addPill(back, TX.calmZone, 2100, 30, { fs: 16, pad: 8 });   // ② 화면용
  const water = E('path', { fill: 'url(#s3-water)', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }); svg.appendChild(water);
  // world: 해저면·해안 (100%)
  const front = E('g'); svg.appendChild(front);
  const beachY = u => u <= 100 ? Y0 - .3 * u : Y0 - 30 - .08 * (u - 100);
  let bed = `M${XC - 80} 600`;
  for (let x = XC - 80; x <= XS + 400; x += 10) bed += `L${x} ${(x < XS ? Y0 + depth(x) : beachY(x - XS)).toFixed(1)}`;
  front.appendChild(E('path', { d: bed + `L${XS + 400} 600Z`, fill: '#E6C377', stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round' }));
  for (let x = XC + 300; x < XS + 360; x += 46) { const y = (x < XS ? Y0 + depth(x) : beachY(x - XS)) + 16 + (x % 3) * 9; if (y < 545) front.appendChild(E('circle', { cx: x + (x % 5) * 4, cy: y, r: 3, fill: '#D9AD5C', stroke: INK, 'stroke-width': 1.5 })); }
  front.appendChild(E('g', { transform: `translate(${XS + 105},${beachY(105) + 2})` }, [
    E('rect', { x: -4, y: -26, width: 8, height: 26, fill: '#8A5230', stroke: INK, 'stroke-width': 2.5 }),
    E('circle', { cx: 0, cy: -42, r: 21, fill: '#5F9E4B', stroke: INK, 'stroke-width': 3 }),
  ]));
  addPill(front, TX.shallow + ' →', XC + 430, Y0 + depth(XC + 430) + 34, { fs: 15, pad: 8, bg: '#FFF3CF' });
  const flagsG = E('g'); front.appendChild(flagsG);     // 주기 깃발 (바다에 고정)
  const swash = E('path', { fill: 'none', stroke: '#74BFE8', 'stroke-width': 6, 'stroke-linecap': 'round' }); svg.appendChild(swash);
  const swashFoam = E('path', { fill: 'none', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round' }); svg.appendChild(swashFoam);
  const fx = E('g'); svg.appendChild(fx);
  const ann = E('g'); svg.appendChild(ann);
  const pBreak = addPill(ann, TX.breaking, 0, 0, { fs: 17, pad: 8, bg: '#FFE082' });

  /* ---- 풍랑의 흰 물마루: 마루에 붙은 작은 흰 조각 하나, 0.25 s 페이드, 나타날 때(≥15)·사라질 때(<11) 기준이 달라 깜빡이지 않음 ---- */
  const CAP_D = 'M-10 3 Q-8 -4 -2 -3 Q2 -7 7 -2 Q11 0 10 4 Q0 6 -10 3 Z';
  const caps = [], capPool = [];
  const getCap = () => { let c = capPool.find(c => !c.on); if (!c) { const g = E('path', { d: CAP_D, fill: '#fff', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }); fx.appendChild(g); c = { g, on: false, op: 0, os: '' }; capPool.push(c); } c.on = true; c.op = 0; return c; };
  function whitecaps(cr, dt) {   // cr: 이번 프레임의 마루 후보 [{X, Y, h}]
    caps.forEach(c => { c.seen = false; });
    for (const p of cr) {
      let best = null, bd = 24;
      for (const c of caps) { const d = Math.abs(c.X - p.X); if (!c.seen && d < bd) { bd = d; best = c; } }
      if (best) { best.seen = true; best.X = p.X; best.Y = p.Y; best.h = p.h; }
      else if (p.h >= 15) { const c = getCap(); c.X = p.X; c.Y = p.Y; c.h = p.h; c.seen = true; caps.push(c); }
    }
    for (let i = caps.length - 1; i >= 0; i--) {
      const c = caps[i], up = c.seen && c.h >= 11;
      c.op = clamp(c.op + (up ? dt : -dt) / .25, 0, 1);
      if (!up && c.op <= 0) { c.on = false; c.g.style.display = 'none'; caps.splice(i, 1); continue; }
      c.g.style.display = '';
      c.g.setAttribute('transform', `translate(${c.X.toFixed(1)},${(c.Y - 1).toFixed(1)}) scale(${clamp(c.h / 22, .7, 1.25).toFixed(2)})`);
      const os = c.op.toFixed(2); if (os !== c.os) { c.os = os; c.g.style.opacity = os; }
    }
  }

  /* ---- 쇄파 거품: 수면 윤곽에서 만든 흰 덩어리(앞면) + 뒤로 남는 얇은 띠 + 넘어가는 순간의 물보라 ---- */
  const foamPool = [];
  const getFoam = i => {
    if (!foamPool[i]) {
      const band = E('path', { fill: 'none', stroke: '#fff', 'stroke-width': 3.5, 'stroke-linecap': 'round' });
      const blob = E('path', { fill: '#fff', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' });
      const sp = E('g', {}, [[0, 0, 2.6], [9, -6, 2], [-5, -9, 1.8]].map(([x, y, r]) => E('circle', { cx: x, cy: y, r, fill: '#fff', stroke: INK, 'stroke-width': 1.5 })));
      const g = E('g', {}, [band, blob, sp]); fx.appendChild(g); foamPool[i] = { g, band, blob, sp, bo: '', so: '' };
    }
    return foamPool[i];
  };
  /* 점 목록을 중점끼리 2차 곡선으로 이어 둥근 닫힌 path 로 */
  const roundPath = P => { const n = P.length; let d = ''; for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; d += i ? `Q${a[0].toFixed(1)} ${a[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}` : `M${mx.toFixed(1)} ${my.toFixed(1)}`; } const a = P[0], b = P[1]; return d + `Q${a[0].toFixed(1)} ${a[1].toFixed(1)} ${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)}Z`; };
  const hideFrom = (pool, n) => { for (let i = n; i < pool.length; i++) pool[i].g.style.display = 'none'; };

  /* ---- ③ 추적 표시 ---- */
  const AP = { stroke: '#E8553E', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const GP = { stroke: INK, 'stroke-width': 3, fill: 'none', 'stroke-dasharray': '6 5', opacity: .7 };
  const mk = E('path', { d: 'M-9 -14 L9 -14 L0 0 Z', fill: '#E8553E', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' });
  const aSpeed = E('g'), sGhost = E('path', GP), sLine = E('path', AP), sLine2 = E('path', AP), pSpeed = pill(TX.speed, { fs: 15, pad: 7 }), pDeep1 = pill(TX.deep, { fs: 13, pad: 6, sw: 2 }), pNow1 = pill(TX.now, { fs: 13, pad: 6, sw: 2, bg: '#FBE5E2' });
  aSpeed.append(sGhost, pSpeed.g, pDeep1.g, pNow1.g);
  const aArrows = E('g'); aArrows.append(sLine, sLine2); // 속도 화살표(실선): 속도·파장 단계에서
  const aLen = E('g'), lGhost = E('path', GP), lLine = E('path', AP), pLen = pill(TX.length, { fs: 15, pad: 7 }), pDeep2 = pill(TX.deep, { fs: 13, pad: 6, sw: 2 }), pNow2 = pill(TX.now, { fs: 13, pad: 6, sw: 2, bg: '#FBE5E2' });
  aLen.append(lGhost, lLine, pLen.g, pDeep2.g, pNow2.g);
  const aHt = E('g'), hGhost = E('path', GP), hLine = E('path', AP), pHt = pill(TX.height, { fs: 15, pad: 7 }), pDeep3 = pill(TX.deep, { fs: 13, pad: 6, sw: 2 }), pNow3 = pill(TX.now, { fs: 13, pad: 6, sw: 2, bg: '#FBE5E2' });
  aHt.append(hGhost, hLine, pHt.g, pDeep3.g, pNow3.g);
  const pPeriod = pill(TX.perPeriod, { fs: 13, pad: 6, sw: 2 });
  ann.append(aLen, aHt, aSpeed, aArrows, pPeriod.g, mk);
  const tick = (x1, x2, y) => `M${x1} ${y - 8}L${x1} ${y + 8}M${x2} ${y - 8}L${x2} ${y + 8}M${x1} ${y}L${x2} ${y}`;
  const arrowR = (x1, x2, y) => `M${x1} ${y}L${x2} ${y}M${x2 - 9} ${y - 7}L${x2} ${y}L${x2 - 9} ${y + 7}`;
  const KA = 1; // 속도 화살표 길이 = 속도(px/s) × KA
  // 깊은 바다의 마루·골 높이 (파고 증가 단계의 가로 기준선)
  const Y_CREST0 = Y0 - H0 * (1 - mu(1)), Y_TROUGH0 = Y0 + H0 * mu(1);

  /* ---- 상태 ---- */
  let t = 0, tau = 0, state = 'idle', stage = -1, camX = 0, track = null, phase = -1, OFF = 0, zoom = '';
  const SLOW = .5; // 추적 마루가 넘어가는 동안의 재생 속도

  /* ③에 들어설 때: 카메라 도착 직후 화면 왼쪽 끝에 들어오는 마루를 골라 부서질 때까지 따라감 */
  function pickTrack() {
    const te = t + (START[2] + P3 - tau);               // 카메라 도착 시각 (전역 시간)
    const xin = XC + 4, n = Math.floor((at(PHI, xin) - (OM * (te - 1.2) - PH0)) / TAU); // 도착 1.2 s 전 이후에 xin 을 지나는 첫 마루
    const tAt = x => (at(PHI, x) + PH0 - TAU * n) / OM; // 이 마루가 x 에 있는 시각
    const xAt = tt => phiInv(OM * tt - PH0 + TAU * n);  // 시각 tt 의 마루 위치
    const tin = tAt(xin), tb = tAt(XB);
    const flags = []; for (let j = 0; j < 20; j++) { const tt = tin + j * T, x = xAt(tt); if (x >= XB - 6) break; flags.push({ x, t: tt }); }
    track = { n, tin, tAt, xAt, tb, t1: tAt(X1), t2: tAt(X2), ts0: tAt(XB - 45), ts1: tAt(XB + 12), ta: tAt(XB + 40), flags };
    track.tEnd = track.ta + 6;
    OFF = tau - t; TOTAL = track.tEnd + OFF; DUR[2] = TOTAL - START[2];
    flagsG.innerHTML = '';
    flags.forEach(f => {
      const g = E('g', { transform: `translate(${f.x.toFixed(1)},${Y0})` }, [
        E('line', { x1: 0, y1: 6, x2: 0, y2: -30, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
        E('path', { d: 'M0 -30 L16 -24 L0 -18 Z', fill: '#E8553E', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
        E('circle', { r: 3.5, fill: '#fff', stroke: INK, 'stroke-width': 2 }),
      ]);
      g.style.display = 'none'; flagsG.appendChild(g); f.g = g; f.shown = false;
    });
  }

  /* ---- 수면 그리기 ---- */
  const SX = [], SY = [], SW = [], CR = [];
  const NW = WIND.length, WA = new Float64Array(NW), WP = new Float64Array(NW); // 풍랑 성분의 이번 프레임 진폭·위상 (x와 무관한 부분)
  function surface() {
    const Ft = OM * t - PH0;
    for (let j = 0; j < NW; j++) { const w = WIND[j]; WA[j] = w.a * (1 + .18 * Math.sin(.37 * t * (j + 1) + w.p)); WP[j] = w.p - w.om * t; }
    let d = '';
    SX.length = SY.length = SW.length = 0;
    for (let sx = -32, step = 4; sx <= 992; sx += step) {
      const x = camX + sx;
      step = Math.abs(x - XB) < 70 ? 2 : 4; // 넘어가는 마루 근처는 촘촘히
      const f = clamp((x - XMIN) / DX, 0, N - 1.001), i = f | 0, r = f - i;
      const k = KK[i] + (KK[i + 1] - KK[i]) * r, m = MM[i] + (MM[i + 1] - MM[i]) * r, H = HH[i] + (HH[i + 1] - HH[i]) * r;
      const th = PHI[i] + (PHI[i + 1] - PHI[i]) * r - Ft, lean = LEAN[i] + (LEAN[i + 1] - LEAN[i]) * r, cu = CU[i] + (CU[i + 1] - CU[i]) * r, c2 = (1 + Math.cos(th)) / 2;
      let eta = H * (Math.pow(c2, m) - mu(m)), dx = lean * 1.415 / k * c2 * c2, wsum = 0;
      if (cu > 0) { // 쇄파 지점: 마루 바로 앞이 앞으로 쏠리며(f) 아래로 떨어짐(g) → 윤곽이 실제로 넘어감
        const s = th - Math.round(th / TAU) * TAU;   // 마루 기준 위상 (-π~π, +가 앞쪽)
        dx += cu * 1.45 / k * CURL_F(s); eta -= cu * .55 * H * CURL_G(s);
      }
      if (x < XW + 900) {
        const fetch = .55 + .45 * sm(-200, 700, x), past = x > XW ? x - XW : 0;
        for (let j = 0; j < NW; j++) {
          const w = WIND[j], env = past ? fetch * Math.exp(-past / w.D) : fetch; if (env < .01) continue;
          const a = WA[j] * env, th2 = w.k * x + WP[j];
          eta += a * Math.cos(th2); dx -= QW * a * Math.sin(th2); wsum += env;
        }
      }
      const X = sx + dx, Y = Y0 - eta;
      SX.push(X); SY.push(Y); SW.push(wsum);
      d += (d ? 'L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1);
    }
    water.setAttribute('d', d + 'L992 600L-32 600Z');
    // 풍랑의 흰 물마루 후보: 바람 부는 해역의 높고 뾰족한 마루
    CR.length = 0;
    for (let i = 1; i < SX.length - 1; i++) {
      if (SW[i] < .8 || !(SY[i] < SY[i - 1] && SY[i] <= SY[i + 1])) continue;
      const h = Y0 - SY[i]; if (h >= 11) CR.push({ X: SX[i], Y: SY[i], h });
    }
  }

  /* ---- 해안: 부서지는 마루마다 거품, 밀려 올라가는 물 ---- */
  function coast() {
    const inView = camX > XC - 980;
    let nf = 0;
    swash.style.display = swashFoam.style.display = inView ? '' : 'none';
    if (inView) {
      const Ft = OM * t - PH0, Hb = at(HH, XB);
      const n0 = Math.ceil((at(PHI, XB - 30) - Ft) / TAU), n1 = Math.floor((at(PHI, XS - 12) - Ft) / TAU);
      for (let n = n0; n <= n1; n++) {
        const x = phiInv(Ft + TAU * n), c = crestXY(x), p = (x - XB) / 36, L = TAU / c.k;
        const F = getFoam(nf++); F.g.style.display = '';
        // 마루 꼭대기 표본 찾기 (화면 x 가 마루 근처이고 가장 높은 점)
        let i0 = -1, best = 1e9;
        for (let i = 1; i < SX.length - 1; i++) { if (Math.abs(SX[i] - c.x) < 30 && SY[i] < best) { best = SY[i]; i0 = i; } }
        if (i0 < 0) { F.g.style.display = 'none'; nf--; continue; }
        // 흰 덩어리: 마루 꼭대기에서 앞면을 따라(표본 순서 = 넘어간 윤곽도 그대로 따라감) 파고의 60% 아래까지, 바깥쪽 법선 방향으로 올록볼록하게 부풀림
        const grow = sm(-.9, .2, p), R = (.2 + .16 * grow) * c.H, ib = Math.max(1, i0 - 2);
        let i1 = i0; while (i1 < SX.length - 2 && SY[i1 + 1] - best < .6 * c.H && i1 - i0 < 14) i1++;
        const NX = [], NY = [];
        for (let i = ib; i <= i1; i++) { const tx = SX[i + 1] - SX[i - 1], ty = SY[i + 1] - SY[i - 1], l = Math.hypot(tx, ty) || 1; NX.push(ty / l); NY.push(-tx / l); }
        const P = []; // 바깥 가장자리(올록볼록) → 안쪽 가장자리, 둥글게 잇기
        for (let i = ib; i <= i1; i++) { const q = (i - ib) / Math.max(1, i1 - ib), w = Math.sin(q * Math.PI) * .75 + .25, rr = R * w * (.65 + .35 * Math.sin(i * 2.3 + n)), j = i - ib; P.push([SX[i] + NX[j] * rr, SY[i] + NY[j] * rr]); }
        for (let i = i1; i >= ib; i--) { const q = (i - ib) / Math.max(1, i1 - ib), w = Math.sin(q * Math.PI) * .75 + .25, rr = R * .4 * w, j = i - ib; P.push([SX[i] - NX[j] * rr, SY[i] - NY[j] * rr]); }
        F.blob.setAttribute('d', roundPath(P));
        const bo = (sm(-.7, .1, p) * (1 - sm(0, 1, (Hb * .35 - c.H) / (Hb * .2)))).toFixed(2); if (bo !== F.bo) { F.bo = bo; F.blob.style.opacity = bo; }
        // 뒤로 남는 얇은 띠: 마루 뒤 0.45 파장
        if (p > .3) {
          let ia = i0; while (ia > 0 && SX[i0] - SX[ia] < .45 * L) ia--;
          let s = '';
          for (let i = ia; i <= i0; i++) s += (s ? 'L' : 'M') + SX[i].toFixed(1) + ' ' + (SY[i] - 1.5).toFixed(1);
          F.band.setAttribute('d', s); F.band.style.display = '';
          F.band.style.opacity = (.75 * sm(.3, 1, p) * (1 - sm(0, 1, (Hb * .4 - c.H) / (Hb * .25)))).toFixed(2);
        } else F.band.style.display = 'none';
        // 물보라: 넘어가는 순간에만, 립 끝(가장 앞으로 나간 점)에 2~3개
        const cu = at(CU, x);
        if (cu > .5 && p < .3) {
          let it = i0; for (let i = i0; i <= i1; i++) if (SX[i] > SX[it]) it = i;
          F.sp.style.display = ''; F.sp.setAttribute('transform', `translate(${(SX[it] + 4).toFixed(1)},${(SY[it] - 6).toFixed(1)}) rotate(${(p * 40).toFixed(0)})`);
        } else F.sp.style.display = 'none';
      }
      // 해안에서 물이 비탈을 오르내림
      const ps = at(PHI, XS - 40) - Ft, r = 46 * Math.pow(.5 + .5 * Math.cos(ps - 1.2), 2);
      const u0 = XS - camX - 8; let d = `M${u0} ${Y0 - 1}`;
      for (let u = 0; u <= r; u += 4) d += `L${(XS - camX + u).toFixed(1)} ${(beachY(u) - 2).toFixed(1)}`;
      swash.setAttribute('d', d);
      const ut = Math.max(0, r - 10);
      swashFoam.setAttribute('d', r > 3 ? `M${(XS - camX + ut).toFixed(1)} ${(beachY(ut) - 3).toFixed(1)}L${(XS - camX + r).toFixed(1)} ${(beachY(r) - 3).toFixed(1)}` : '');
    }
    hideFrom(foamPool, nf);
  }

  /* ---- ③ 추적 마루 표시 + 관찰 순서(속도 → 파장 → 파고 → 부서짐 → 부서진 뒤) ---- */
  const ratio = { c: 0, L: 0, H: 0 }; // 지금 값 ÷ 깊은 바다 값 (오른쪽 카드 막대)
  function annotate() {
    let ph = -1;
    if (state === 'end') ph = 4;
    else if (stage === 2 && track && t >= track.tin) {
      ph = t < track.t1 ? 0 : t < track.t2 ? 1 : t < track.ts0 ? 2 : t < track.ta ? 3 : 4;
      const x = track.xAt(t), c = crestXY(x);
      ratio.c = OM / c.k / C0; ratio.L = K0 / c.k; ratio.H = c.H / H0;
      track.flags.forEach(f => { const on = t >= f.t; if (on !== f.shown) { f.shown = on; f.g.style.display = on ? '' : 'none'; } });
      if (ph <= 2) mk.setAttribute('transform', `translate(${c.x.toFixed(1)},${(c.y - 6).toFixed(1)})`);
      if (ph === 0) {        // 속도: 화살표 길이 ∝ 속도 (실선 = 지금, 점선 = 깊은 바다)
        const ys = c.y - 36, x1 = c.x + 14;
        sGhost.setAttribute('d', arrowR(x1, x1 + C0 * KA, ys - 22)); sLine.setAttribute('d', arrowR(x1, x1 + OM / c.k * KA, ys));
        pDeep1.move(x1 + C0 * KA + 40, ys - 22); pNow1.move(x1 + OM / c.k * KA + 30, ys);
        pSpeed.move(x1 - 36, ys - 11);
        const f0 = track.flags[0]; pPeriod.g.style.display = f0 && t >= f0.t ? '' : 'none';
        if (f0) pPeriod.move(f0.x - camX + 46, Y0 - 44);
      } else if (ph === 1) { // 파장: 이 마루와 바로 뒤 마루 사이 (실선) + 깊은 바다 파장 (점선), 두 마루에 속도 화살표
        const xb2 = phiInv(OM * t - PH0 + TAU * (track.n - 1)), b = crestXY(xb2), yl = Y0 - 96;
        lGhost.setAttribute('d', tick(c.x - L0, c.x, yl - 24)); lLine.setAttribute('d', arrowD(b.x, yl, c.x, yl, 9));
        pDeep2.move(c.x - L0 - 46, yl - 24); pNow2.move((b.x + c.x) / 2, yl + 20); pLen.move((b.x + c.x) / 2, yl - 2);
        sLine.setAttribute('d', arrowR(c.x + 14, c.x + 14 + OM / c.k * KA, c.y - 36)); sLine2.setAttribute('d', arrowR(b.x + 14, b.x + 14 + OM / b.k * KA, b.y - 36));
      } else if (ph === 2) { // 파고: 골에서 마루까지 (실선) + 깊은 바다의 마루·골 높이 (가로 점선)
        const yt = Y0 + c.H * mu(c.m), hx = c.x - 22;
        hGhost.setAttribute('d', `M0 ${Y_CREST0}L960 ${Y_CREST0}M0 ${Y_TROUGH0}L960 ${Y_TROUGH0}`);
        hLine.setAttribute('d', arrowD(hx, yt, hx, c.y, 8));
        pDeep3.move(60, Y_CREST0 - 16); pNow3.move(c.x + 40, c.y - 10); pHt.move(hx - 40, (c.y + yt) / 2);
      }
    } else { ratio.c = ratio.L = ratio.H = 0; }
    aSpeed.style.display = ph === 0 ? '' : 'none'; aLen.style.display = ph === 1 ? '' : 'none'; aHt.style.display = ph === 2 ? '' : 'none';
    if (ph !== 0) pPeriod.g.style.display = 'none';
    aArrows.style.display = ph >= 0 && ph <= 1 ? '' : 'none'; sLine2.style.display = ph === 1 ? '' : 'none';
    mk.style.display = ph >= 0 && ph <= 2 ? '' : 'none';
    pBreak.g.style.display = ph >= 3 ? '' : 'none';
    if (ph >= 3) pBreak.move(XB - camX - 70, Y0 - 118);
    if (ph !== phase) {
      phase = ph;
      checkEls.forEach((li, i) => { li.classList.toggle('now', i === ph); li.classList.toggle('done', i < ph); });
      if (stage === 2) setExplain(ph < 0 ? TX.cap[2] : TX.cap3[ph]);
    }
    syncBars();
  }
  /* 쇄파 순간 확대 (부서짐 단계에서만, 쇄파 지점 중심 1.5배, 부드럽게 들어가고 나옴) */
  function zoomView() {
    let z = 1;
    if (stage === 2 && track) z = 1 + .5 * sm(track.ts0 - .8, track.ts0 + .4, t) * (1 - sm(track.ts1 - .3, track.ts1 + 1.2, t));
    const w = 960 / z, h = 540 / z, cx = XB - XC + 10, cy = Y0 - 14;
    const vb = z === 1 ? '0 0 960 540' : `${clamp(cx - w / 2, 0, 960 - w).toFixed(1)} ${clamp(cy - h / 2, 0, 540 - h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
    if (vb !== zoom) { zoom = vb; svg.setAttribute('viewBox', vb); }
  }

  function render(dt) {
    if (state === 'play' && stage === 2 && track && t >= track.ts0 && t < track.ts1) dt *= SLOW; // 넘어가는 순간은 느리게 (수면·거품·해설·막대 모두 같은 시간 기준)
    t += dt;
    if (state === 'play') { tau += dt; if (tau >= TOTAL) { tau = TOTAL; state = 'end'; syncButtons(); } }
    const st = stageAt(tau); if (st !== stage) enterStage(st);
    camX = camAt(tau);
    back.setAttribute('transform', `translate(${-camX},0)`); front.setAttribute('transform', `translate(${-camX},0)`);
    mid.setAttribute('transform', `translate(${(-camX * PAR_MID).toFixed(1)},0)`); clouds.setAttribute('transform', `translate(${(-camX * PAR_MID).toFixed(1)},0)`);
    far.setAttribute('transform', `translate(${(-camX * PAR_FAR).toFixed(1)},0)`);
    winds.forEach(w => {
      const x = -160 + mod(w.off + 150 * t, XW + 60), o = sm(-160, -60, x) * (1 - sm(XW - 160, XW - 20, x));
      w.g.setAttribute('transform', `translate(${x.toFixed(1)},${(w.y + 5 * Math.sin(t * 2 + w.off)).toFixed(1)})`);
      const os = o.toFixed(2); if (os !== w.o) { w.o = os; w.g.style.opacity = os; } // 값이 바뀔 때만 스타일 갱신
    });
    surface(); whitecaps(CR, dt); coast(); annotate(); zoomView(); syncProgress();
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
  // 속도·파장·파고 항목에는 막대 (길이 = 지금 값 ÷ 깊은 바다 값, 눈금 = 깊은 바다)
  checks.innerHTML = TX.checks.map((c, i) => `<li data-n="${i + 1}"><button type="button" class="ck-btn">${c}</button>${i < 3 ? `<span class="ck-bar"><i></i><b></b>${i === 0 ? `<small>${TX.deep}</small>` : ''}</span>` : ''}</li>`).join('');
  stepEls[2].appendChild(checks);
  const checkEls = Array.from(checks.children), bars = stepEls.map(li => li.querySelector('.st-bar i')), barW = [];
  const ckBars = checkEls.slice(0, 3).map(li => li.querySelector('.ck-bar i')), ckW = [];
  const BAR_MAX = 1.4; // 막대 끝 = 140 % (깊은 바다 100 % 눈금은 CSS 에서 같은 비율로)
  checkEls.forEach((li, i) => { li.querySelector('.ck-btn').onclick = () => jumpTo(i); });
  function syncBars() {
    [ratio.c, ratio.L, ratio.H].forEach((v, i) => {
      const w = Math.round(clamp(v / BAR_MAX, 0, 1) * 200) / 2 + '%'; // 0.5 % 단위로만 갱신
      if (ckW[i] !== w) { ckW[i] = w; ckBars[i].style.width = w; }
    });
  }
  function syncProgress() {
    stepEls.forEach((li, i) => {
      const f = state === 'idle' ? 0 : clamp((tau - START[i]) / DUR[i], 0, 1);
      const w = Math.round(f * 200) / 2 + '%'; // 0.5 % 단위로만 바꿔 매 프레임 페이지 레이아웃을 피함
      if (barW[i] !== w) { barW[i] = w; bars[i].style.width = w; }
      li.classList.toggle('on', i === stage); li.classList.toggle('done', state !== 'idle' && f >= 1 && i !== stage);
    });
  }
  function enterStage(st) {
    stage = st; $('#badge3').textContent = TX.steps[st].badge; setExplain(TX.cap[st]);
    track = null; phase = -1; flagsG.innerHTML = ''; checkEls.forEach(li => li.classList.remove('now', 'done'));
    if (st === 2) pickTrack(); else { TOTAL = START[2] + DUR[2]; }
  }
  /* 관찰 순서 카드의 항목을 누르면 그 단계의 처음부터 (③ 밖이면 ③ 처음부터) */
  function jumpTo(i) {
    if (!(stage === 2 && track) || state === 'idle') { playFrom(START[2]); return; }
    const ts = [track.tin, track.t1, track.t2, track.ts0][i];
    t = ts; tau = Math.max(ts + OFF, START[2] + P3); OFF = tau - t; TOTAL = track.tEnd + OFF; DUR[2] = TOTAL - START[2];
    state = 'play'; phase = -1; setPaused(false); syncButtons();
  }
  const playBtn = $('#t3-play');
  function syncButtons() { playBtn.textContent = state === 'idle' ? TX.play : TX.replay; playBtn.classList.toggle('primary', state !== 'play'); }
  function playFrom(s) { tau = s; state = 'play'; stage = -1; setPaused(false); syncButtons(); }
  playBtn.onclick = () => playFrom(0);
  registerPauseBtn($('#t3-pause'));
  syncButtons(); render(0);
  frames['3'] = render;
})();
