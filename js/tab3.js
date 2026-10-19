/* 탭3: 풍랑·너울·연안 쇄파 — ① 바람 부는 해역의 풍랑 → (경계 정지) → ② 발생 해역 밖의 너울 → ③ 해안의 연안 쇄파를 이어서 자동 재생
   하나의 긴 바다(world x) 위에서 카메라가 이동. 너울은 분산 관계(ω² = gk·tanh kh)로 수심에 따른 파장·속도를,
   에너지 흐름 보존(천수 계수)으로 파고를 계산하고, 파고가 수심의 0.78배에 이르면 부서진 뒤 파고 = 0.78 × 수심으로 줄어듦 (단순화한 모형).
   ③은 구도·배율을 고정하고 이웃한 두 마루(앞 A·뒤 B)를 따라가며 속도·이동 거리 → 마루 사이 간격(파장) → A 의 파고 → 부서짐을 차례로 강조
   (물리량은 계산대로 늘 함께 변함). 부서질 때는 넘어지는 마루 끝을 밑바탕 수면 위에 따로 그려, 앞으로 뻗어 떨어진 뒤 흰 물결이 됨.
   그리기 층: 뒤 SVG(하늘·구름·경계·해역 이름표) < 캔버스(수면·흰 물결·바람 화살표·해저·해안) < 앞 SVG(관찰 표시·라벨, 화면 좌표라 배율과 무관하게 글자 크기 유지) */
/* ================= 탭3: 풍랑·너울·연안 쇄파 ================= */
(function () {
  const TX = TEXT.tab3; // 이 탭의 문구
  const svg = $('#svg3');                       // 뒤 SVG
  const stageEl = $('#stage3');
  const TAU = 2 * Math.PI;
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const INK = '#24303A', ACC = '#E8553E', GREY = '#7B8792';

  /* ---- 장면 (단위: px, s) ---- */
  const Y0 = 290;                 // 평균 해수면
  const XW = 1100;                // 바람이 부는 해역의 끝(경계)
  const CAM1 = 700;               // 경계 정지 카메라 (경계가 화면 x = 400)
  const CAM2 = 1550;              // ② 너울을 보는 카메라
  const XS = 3642;                // 해안선(world x)
  const BED = .34, U1 = 120;      // 해안 쪽 해저 경사(해안선에서 U1 까지 직선), 그 너머는 네제곱으로 깊어짐
  /* ---- 너울: 주기 T, 깊은 바다 파장 L0·속도 C0·파고 H0. 수심·파고는 그림에서 VEX배 과장 (파고/수심 비는 과장과 무관) ---- */
  const T = 3.2, OM = TAU / T, L0 = 220, G = TAU * L0 / (T * T), VEX = 18, H0 = 37.5, GAM = .78, DMIN = 8;
  const K0 = TAU / L0, C0 = OM / K0, PH0 = 1.3;
  /* 수심: 해안선에서 830 px 떨어진 곳(쇄파 구역 화면의 왼쪽 끝)에서 속도가 깊은 바다의 90%가 되도록 C4를 정함 */
  const D90 = Math.atanh(.9) / (K0 / .9) * VEX, C4 = (D90 - BED * 830) / Math.pow(830 - U1, 4);
  const depth = x => { const u = XS - x; return u <= 0 ? 0 : Math.min(4000, BED * u + C4 * Math.pow(Math.max(0, u - U1), 4)); };
  /* ---- 풍랑: 짧은 파장 성분들 (바람 부는 해역을 벗어나면 D 거리로 약해짐, 짧을수록 빨리) ---- */
  const WIND = [{ L: 58, a: 7.5, D: 70, p: .4 }, { L: 84, a: 10.5, D: 110, p: 2.3 }, { L: 112, a: 12, D: 160, p: 4.1 }, { L: 150, a: 10, D: 220, p: 1.3 }]
    .map(w => { const k = TAU / w.L; return { ...w, k, om: Math.sqrt(G * k) }; });
  const QW = .3; // 풍랑 마루를 뾰족하게 (Gerstner). 성분이 모두 겹쳐도 Σ k·a·QW < 1 이라 윤곽이 접히지 않음

  /* ---- 수심·너울 표 (world x, 2 px 간격) ---- */
  const XMIN = -400, XMAX = XS + 400, DX = 2, N = (XMAX - XMIN) / DX + 1;
  const KK = new Float64Array(N), PHI = new Float64Array(N), HH = new Float64Array(N), MM = new Float64Array(N), LEAN = new Float64Array(N), VF = new Float64Array(N);
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
      if (XB === XS && x > XS - 600 && Hsh[i] >= GAM * d) XB = x;
      HH[i] = x >= XS ? 0 : Math.min(Hsh[i], GAM * d);
    }
    for (let i = 0; i < N; i++) {
      const x = XMIN + i * DX;
      LEAN[i] = .92 * sm(XB - 260, XB - 16, x);                               // 앞으로 쏠림: 쇄파 직전까지 0 → .92 (앞면이 거의 수직까지 가팔라짐, 1.09 를 넘지 않아 접히지 않음)
      VF[i] = sm(XB + 16, XB + 44, x);                                        // 부서진 뒤: 마루 끝이 앞쪽 수면에 닿은 뒤 낮고 넓은 물결로 (0 → 1)
      if (x > XB + 16) MM[i] = MM[i] + (.6 - MM[i]) * VF[i];                 // 마루 모양: 뾰족 → 넓고 납작
    }
  })();
  const at = (A, x) => { const f = clamp((x - XMIN) / DX, 0, N - 1.001), i = f | 0, r = f - i; return A[i] + (A[i + 1] - A[i]) * r; };
  const phiInv = v => { let lo = 0, hi = N - 1; if (v <= PHI[0]) return XMIN; if (v >= PHI[hi]) return XMAX; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (PHI[m] < v) lo = m; else hi = m; } return XMIN + (lo + (v - PHI[lo]) / (PHI[hi] - PHI[lo])) * DX; };
  const mu = m => 1 / Math.sqrt(Math.PI * (m + .25)); // ((1+cosθ)/2)^m 의 평균 → 평균 해수면 유지

  /* ---- 카메라·타임라인: ① 10 s → 이동 6 s → 경계 정지 2.5 s → 이동 7.5 s → ② 8 s → 이동 9 s → ③ (관찰 마루에 따라 약 30 s) ----
     ③ 구도는 도착 뒤 위치·배율 모두 고정 (마루를 따라 움직이거나 쇄파 순간에 확대하지 않음): 비교적 깊은 바다(해안선에서 700 px,
     파장이 깊은 바다의 약 3/4)부터 해안까지 한 화면, 배율 Z3. 이동하는 동안 하늘을 줄이고 바다·해저를 넓게 보이도록 화면을 내림 */
  const CAM3 = XS - 700, Z3 = 1.25, VY3 = 166;
  const T1 = 10, P1 = 6, HOLD = 2.5, P2 = 7.5, T2 = 8, P3 = 9;
  const START = [0, T1, T1 + P1 + HOLD + P2 + T2];
  const DUR = [T1, START[2] - START[1], P3 + 42];
  let TOTAL = START[2] + DUR[2];  // ③ 길이는 pickTrack() 에서 추적 마루에 맞춰 다시 정함
  const camAt = s => {
    if (s < T1) return 0; s -= T1;
    if (s < P1) return CAM1 * sm(0, 1, s / P1); s -= P1;
    if (s < HOLD) return CAM1; s -= HOLD;
    if (s < P2) return CAM1 + (CAM2 - CAM1) * sm(0, 1, s / P2); s -= P2;
    if (s < T2) return CAM2; s -= T2;
    return CAM2 + (CAM3 - CAM2) * sm(0, 1, s / P3);
  };
  const viewAt = s => { const e = sm(START[2], START[2] + P3, s), z = 1 + (Z3 - 1) * e; return [0, VY3 * e, 960 / z, 540 / z]; }; // ③으로 이동하는 동안만 바뀌고 그 뒤 고정
  const stageAt = s => s < START[1] ? 0 : s < START[2] ? 1 : 2;
  /* ③ 관찰: 뒤 마루 B 가 화면 왼쪽(XIN)에 들어올 때 시작. 앞 마루 A 가 X1·X2 에 오면 강조를 속도 → 파장 → 파고로 옮김 */
  const XIN = CAM3 + 40, X1 = XS - 400, X2 = XS - 280;
  /* 쇄파: 마루가 BK0 에서 BK1 로 가는 동안 마루 끝이 앞으로 뻗어 떨어짐 (진행도 b = 0 → 1, 닿는 순간 b ≈ .78) */
  const BK0 = XB - 16, BK1 = XB + 30, brk = x => (x - BK0) / (BK1 - BK0);

  /* ---- 뒤 SVG: 하늘 (하늘색은 카메라의 50%, 흰 구름 50%, 먹구름·경계·이름표 100%). 해는 없음 ---- */
  svg.appendChild(E('defs', {}, [
    E('linearGradient', { id: 's3-sky', gradientUnits: 'userSpaceOnUse', x1: 900, y1: 0, x2: 1500, y2: 0 }, [E('stop', { offset: 0, 'stop-color': '#B3CAD6' }), E('stop', { offset: 1, 'stop-color': '#BFE3F5' })]),
  ]));
  const PAR_MID = .5;
  const mid = E('g'); svg.appendChild(mid);
  mid.appendChild(E('rect', { x: -200, y: -40, width: 1102, height: 760, fill: '#B3CAD6' }));
  mid.appendChild(E('rect', { x: 1498, y: -40, width: 1600, height: 760, fill: '#BFE3F5' }));
  mid.appendChild(E('rect', { x: 900, y: -40, width: 600, height: 760, fill: 'url(#s3-sky)' }));
  const cloud = (x, y, s, fill) => E('path', { d: 'M0 0 a26 26 0 0 1 50 -16 a30 30 0 0 1 58 8 a20 20 0 0 1 4 40 l-110 0 a22 22 0 0 1 -2 -32 Z', fill, stroke: INK, 'stroke-width': 4 / s, transform: `translate(${x},${y}) scale(${s})` });
  const clouds = E('g'); svg.appendChild(clouds);      // 흰 구름 두 개, 작게 (카메라의 50%)
  [[1130, 70, .6], [1800, 62, .55]].forEach(([x, y, s]) => clouds.appendChild(cloud(x, y, s, '#fff')));
  const back = E('g'); svg.appendChild(back);           // 바다에 붙은 것: 먹구름·경계 (100%)
  [[120, 72, .9], [520, 60, .75], [1000, 80, .9]].forEach(([x, y, s]) => back.appendChild(cloud(x, y, s, '#C7D1D8')));
  back.appendChild(E('path', { d: `M${XW} 40 L${XW} ${Y0 - 50}`, stroke: INK, 'stroke-width': 2, 'stroke-dasharray': '8 7', opacity: .45 }));
  const winds = []; for (let i = 0; i < 9; i++) winds.push({ off: i * 131, y: 160 + (i * 37) % 95 });

  /* ---- 캔버스 (수면·거품·물마루·바람 화살표·해저·해안): 배율은 1.5배까지, 느리면 더 낮춤 ---- */
  const cv = document.createElement('canvas'); cv.className = 'stage-cv'; svg.after(cv);
  const ctx = cv.getContext('2d');
  let cvW = 0, cvH = 0, base = { s: 1, ox: 0, oy: 0 }, dprCap = 1.5;
  let fAcc = 0, fN = 0;
  function watchFps(dt) { // 최근 2초 평균 프레임 간격이 25 ms 를 넘으면 캔버스 배율을 한 단계 낮춤 (1.5 → 1 → .75)
    fAcc += dt; fN++; if (fAcc < 2) return;
    if (fAcc / fN > .025 && dprCap > .75) { dprCap = dprCap > 1 ? 1 : .75; cvW = 0; }
    fAcc = 0; fN = 0;
  }
  function fitCanvas() {
    const r = stageEl.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w === cvW && h === cvH) return;
    cvW = cv.width = w; cvH = cv.height = h;
    const s = Math.max(w / 960, h / 540);                 // SVG 의 xMidYMid slice 와 같은 배치
    base = { s, ox: (w - 960 * s) / 2, oy: (h - 540 * s) / 2 };
  }
  if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe(stageEl); else window.addEventListener('resize', fitCanvas);
  const WIND_D = new Path2D('M-44 0 Q-30 -9 -15 0 T14 0 M14 0 L4 -8 M14 0 L4 8');
  const CAP_D = new Path2D('M-10 3 Q-8 -4 -2 -3 Q2 -7 7 -2 Q11 0 10 4 Q0 6 -10 3 Z');
  const beachY = u => u <= 100 ? Y0 - .3 * u : Y0 - 30 - .08 * (u - 100);
  const bedD = (() => { let d = `M${XS - 1400} 720`; for (let x = XS - 1400; x <= XS + 400; x += 10) d += `L${x} ${(x < XS ? Y0 + depth(x) : beachY(x - XS)).toFixed(1)}`; return new Path2D(d + `L${XS + 400} 720Z`); })();
  const pebbles = []; for (let x = XS - 530; x < XS + 360; x += 46) { const y = (x < XS ? Y0 + depth(x) : beachY(x - XS)) + 16 + (x % 3) * 9; if (y < 660) pebbles.push([x + (x % 5) * 4, y]); }
  let waterGrad = null;

  /* ---- 앞 SVG (화면 좌표 0~960 × 0~540, 확대와 무관): 추적 표시·측정선·라벨 ---- */
  const svgF = E('svg', { viewBox: '0 0 960 540', preserveAspectRatio: 'xMidYMid slice' }); cv.after(svgF);
  /* 해역 이름표: 바다(world x)에 붙어 카메라와 함께 옆으로 움직이지만 높이·크기는 화면 기준으로 고정 (③으로 갈 때 확대·화면 내림에 밀려 잘리지 않게).
     화면 가장자리에 닿기 전에 서서히 숨기고, ③으로 이동하기 시작하면 숨김 */
  const zoneG = E('g'); svgF.appendChild(zoneG);
  const zones = [[TX.wind, 250, 128], [TX.windZone, 850, 62, '#E3EAEF'], [TX.calmZone, 1350, 30], [TX.calmZone, 2050, 30]].map(([s, x, y, bg]) => {
    const p = pill(s, { fs: 16, pad: 8, bg }); zoneG.appendChild(p.g); return { p, x, y, hw: textW(s, 16) / 2 + 8 };
  });
  function placeZones() {
    const out = 1 - sm(START[2], START[2] + 1.2, tau);
    const sky = (1 - sm(START[2] + .5, START[2] + 3, tau)).toFixed(2); // 구름도 화면을 내리는 동안 위로 잘려 나가지 않게 서서히 숨김
    if (clouds.getAttribute('opacity') !== sky) { clouds.setAttribute('opacity', sky); back.setAttribute('opacity', sky); }
    for (const z of zones) {
      const sx = toX(z.x - camX), o = out * clamp((sx - z.hw - 6) / 40, 0, 1) * clamp((954 - sx - z.hw) / 40, 0, 1), k = o.toFixed(2) + f1(sx);
      if (k === z.k) continue; z.k = k;                // 카메라가 멈춰 있으면 건드리지 않음
      fade(z.p.g, o); if (o > .01) z.p.move(f1(sx), z.y);
    }
  }
  const ann = E('g'); svgF.appendChild(ann);
  const THIN = { stroke: INK, 'stroke-width': 1.5, fill: 'none', opacity: .55 };                 // 보조선: 가늘고 옅게
  const DASH = { stroke: GREY, 'stroke-width': 2.5, fill: 'none', 'stroke-dasharray': '5 4' };  // 처음 값
  const SOLID = { stroke: ACC, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }; // 현재 값
  const txt = (s, o = {}) => E('text', { 'font-family': 'Jua', 'font-size': o.fs || 19, fill: o.fill || INK, 'text-anchor': o.anchor || 'middle', 'paint-order': 'stroke', stroke: '#FFFDF8', 'stroke-width': 2.5, 'stroke-opacity': .8, 'stroke-linejoin': 'round', text: s });
  const place = (el, x, y) => { sa(el, 'x', f1(clamp(x, 14, 946))); sa(el, 'y', f1(clamp(y, 24, 526))); }; // 확대돼도 글자가 화면 밖으로 나가지 않게
  const mark = (letter, fill, color) => E('g', {}, [E('circle', { r: 11, fill, stroke: INK, 'stroke-width': 2 }), E('text', { 'text-anchor': 'middle', y: 5.5, 'font-family': 'Jua', 'font-size': 15, fill: color, text: letter })]);
  const mkA = mark(TX.a, ACC, '#fff'), mkB = mark(TX.b, '#fff', INK); // 관찰하는 두 마루 (앞 A · 뒤 B): 물 입자가 아니라 마루의 위치
  // 속도: 같은 시간 간격(DT)마다 마루가 있던 자리를 점으로 NT 개만 남김 (오래될수록 옅게) → 점 사이 거리 = 같은 시간 동안 나아간 거리
  const DT = 1, NT = 3, MKX = -15, MKY = -26;  // MKX·MKY: 마루 꼭대기에서 A·B 표시까지 (왼쪽 위, 보조선·마루를 가리지 않게)
  const gDot = E('g'), dotTr = [E('polyline', { ...THIN, stroke: ACC, opacity: .8 }), E('polyline', { ...THIN, opacity: .8 })];
  const dots = [0, 1].map(j => Array.from({ length: NT }, () => E('circle', { r: 4.5, fill: j ? '#fff' : ACC, stroke: INK, 'stroke-width': 1.5 })));
  const dotNote = txt(TX.dots, { fs: 14, anchor: 'start' });
  gDot.append(...dotTr, ...dots[0], ...dots[1], dotNote);
  /* 처음·지금 비교: 움직이는 동안에는 측정선을 그리지 않고, 잠깐 멈춘 화면에서 '처음'(관찰 시작 때, 회색)과 '지금'(빨강)을 나란히 보여 줌.
     처음 값은 관찰 시작 시각의 수면 식으로 다시 계산 (어느 장면에서 시작해도 같음) */
  const FIRST = { stroke: GREY, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const ghost = letter => E('g', {}, [E('circle', { r: 11, fill: '#FFFDF8', stroke: GREY, 'stroke-width': 2, 'stroke-dasharray': '3 2.5' }), E('text', { 'text-anchor': 'middle', y: 5.5, 'font-family': 'Jua', 'font-size': 15, fill: GREY, text: letter })]);
  // 파장: 처음(관찰 시작 때 A·B 마루 꼭대기 자리, 회색 점) · 지금(빨강) 을 같은 높이의 양방향 화살표로, 이름은 화살표 중앙 위
  const gLen0 = E('g'), len0Guide = E('path', { ...THIN, stroke: GREY, opacity: .9 }), len0Dot = E('path', { fill: GREY }), len0 = E('path', FIRST), len0T = txt(TX.firstLen, { fill: GREY, fs: 17 }), gA0 = ghost(TX.a), gB0 = ghost(TX.b);
  gLen0.append(len0Guide, len0Dot, len0, len0T, gB0, gA0);
  const gLen = E('g'), lenGuide = E('path', THIN), lenNow = E('path', SOLID), lenLabel = txt(TX.nowLen, { fill: ACC, fs: 17 });
  gLen.append(lenGuide, lenNow, lenLabel);
  // 파고: 지금 A(빨강 화살표: 마루 ~ A·B 사이 골)에 처음 A 의 마루 모양(회색 점선)을 같은 골 높이로 겹치고, 그 옆에 처음 파고(회색 화살표)
  const gHt = E('g'), htGhost = E('path', { stroke: GREY, 'stroke-width': 2.5, fill: 'none', 'stroke-dasharray': '6 5', 'stroke-linejoin': 'round' }), htBase = E('path', THIN), htFirst = E('path', FIRST), htNow = E('path', SOLID);
  const htFirstT = txt(TX.firstH, { fill: GREY, fs: 17 }), htLabel = txt(TX.nowH, { fill: ACC, fs: 17 });
  gHt.append(htGhost, htBase, htFirst, htNow, htFirstT, htLabel);
  const holdNote = txt(TX.hold, { fs: 16, fill: INK });                  // 잠깐 멈춤 안내 (화면 위 가운데, 고정)
  ann.append(gDot, gLen0, gLen, gHt, mkB, mkA, holdNote);
  const dArrowV = (x, y1, y2) => `M${f1(x)} ${f1(y1)}L${f1(x)} ${f1(y2)}M${f1(x - 6)} ${f1(y1 + 8)}L${f1(x)} ${f1(y1)}L${f1(x + 6)} ${f1(y1 + 8)}M${f1(x - 6)} ${f1(y2 - 8)}L${f1(x)} ${f1(y2)}L${f1(x + 6)} ${f1(y2 - 8)}`;
  const f1 = v => v.toFixed(1);
  const sa = (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); }; // 값이 바뀔 때만 씀 (멈춤 중 같은 값을 다시 써서 레이아웃을 다시 계산하지 않게)

  /* ---- 상태 ---- */
  let t = 0, tau = 0, state = 'idle', stage = -1, camX = 0, track = null, phase = -1, OFF = 0, zoom = '', view = [0, 0, 960, 540];
  const FREEZE = [3.5, 3.5];       // 처음·지금 비교를 위해 잠깐 멈추는 시간 (벽시계 s): [파장 비교, 파고 비교]
  let hold = 0, hk = -1, holdT = 0; // 남은 멈춤 시간, 멈춤 번호(-1: 아님), 멈춘 뒤 흐른 시간
  const OBS = .8, SLOW = .65; // ③ 관찰 중 재생 속도, 관찰 마루가 넘어지는 동안은 그 SLOW 배 (수면·거품·표시·설명·막대 모두 같은 시간 기준)
  const toX = x => (x - view[0]) * 960 / view[2], toY = y => (y - view[1]) * 540 / view[3]; // 캔버스 좌표 → 앞 SVG(화면) 좌표

  /* 마루 n 이 x 에 있는 시각 / 시각 tt 의 마루 n 위치 (n 이 클수록 앞쪽 마루) */
  const tOf = (n, x) => (at(PHI, x) + PH0 - TAU * n) / OM, xOf = (n, tt) => phiInv(OM * tt - PH0 + TAU * n);
  const Hd = x => at(HH, x) * (1 - .4 * at(VF, x));            // 그림에 쓰는 파고 (부서진 뒤 낮아짐)
  const crestEta = x => Hd(x) * (1 - mu(at(MM, x)));           // 마루 꼭대기 높이 (평균 해수면 위)
  /* 마루 n 의 파고 = 마루 꼭대기 ~ 바로 뒤 골 (반 파장 뒤, A·B 사이) — 그림의 수면과 같은 식 */
  const heightOf = (n, tt) => { const xc = xOf(n, tt), xt = xOf(n - .5, tt); return crestEta(xc) + Hd(xt) * mu(at(MM, xt)); };
  /* ③에 들어설 때: 카메라 도착 뒤 뒤 마루 B 가 화면 왼쪽(XIN)을 처음 지날 때 관찰 시작. A = B 바로 앞 마루 */
  function pickTrack() {
    const te = t + (START[2] + P3 - tau);               // 카메라 도착 시각 (전역 시간)
    const nB = Math.floor((at(PHI, XIN) + PH0 - OM * (te + .3)) / TAU), nA = nB + 1;
    const tin = tOf(nB, XIN);
    track = { nA, nB, tin, t1: tOf(nA, X1), t2: tOf(nA, X2), ts0: tOf(nA, BK0 - 6), ts1: tOf(nA, BK1 + 4), ta: tOf(nA, BK1 + 16) };
    track.stops = [track.t2 - .05, tOf(nA, BK0 - 14)]; track.fi = 0; track.seen = [false, false]; // 잠깐 멈춤: 파장 단계 끝 · 부서지기 직전
    hold = 0; hk = -1;
    track.L0 = xOf(nA, tin) - xOf(nB, tin);             // 관찰 시작 때 A·B 사이 거리
    track.H0 = heightOf(nA, tin);                       // 관찰 시작 때 A 의 파고
    track.tEnd = tOf(nA, XS - 40) + 2;
    OFF = tau - t; TOTAL = track.tEnd + OFF; DUR[2] = TOTAL - START[2];
  }
  const camNow = () => camAt(tau);

  /* ---- 수면 계산 (화면 x 5 px 간격, 넘어가는 마루 근처는 2.5 px) ---- */
  const SX = [], SY = [], SW = [], CR = [];
  const NW = WIND.length, WA = new Float64Array(NW), WP = new Float64Array(NW); // 풍랑 성분의 이번 프레임 진폭·위상 (x와 무관한 부분)
  function surface() {
    const Ft = OM * t - PH0;
    for (let j = 0; j < NW; j++) { const w = WIND[j]; WA[j] = w.a * (1 + .18 * Math.sin(.37 * t * (j + 1) + w.p)); WP[j] = w.p - w.om * t; }
    SX.length = SY.length = SW.length = 0;
    for (let sx = -32, step = 5; sx <= 992; sx += step) {
      const x = camX + sx;
      step = Math.abs(x - XB) < 80 ? 2.5 : 5;
      const f = clamp((x - XMIN) / DX, 0, N - 1.001), i = f | 0, r = f - i;
      const k = KK[i] + (KK[i + 1] - KK[i]) * r, m = MM[i] + (MM[i + 1] - MM[i]) * r, vf = VF[i] + (VF[i + 1] - VF[i]) * r;
      const H = (HH[i] + (HH[i + 1] - HH[i]) * r) * (1 - .4 * vf);   // 부서진 뒤 무너져 낮아짐 (그림용)
      const th = PHI[i] + (PHI[i + 1] - PHI[i]) * r - Ft, lean = LEAN[i] + (LEAN[i + 1] - LEAN[i]) * r, c2 = (1 + Math.cos(th)) / 2;
      let eta = H * (Math.pow(c2, m) - mu(m)), dx = lean * 1.415 / k * c2 * c2, wsum = 0;
      if (x < XW + 900) {
        const fetch = .55 + .45 * sm(-200, 700, x), past = x > XW ? x - XW : 0;
        for (let j = 0; j < NW; j++) {
          const w = WIND[j], env = past ? fetch * Math.exp(-past / w.D) : fetch; if (env < .01) continue;
          const a = WA[j] * env, th2 = w.k * x + WP[j];
          eta += a * Math.cos(th2); dx -= QW * a * Math.sin(th2); wsum += env;
        }
      }
      let X = sx + dx; const Y = Y0 - eta;
      if (x > XB - 120 && SX.length && X < SX[SX.length - 1] + .25) X = SX[SX.length - 1] + .25; // 밑바탕 수면은 x 가 되돌아가지 않음 (넘어지는 마루 끝은 breakers() 가 따로 그림)
      SX.push(X); SY.push(Y); SW.push(wsum);
    }
    CR.length = 0; // 풍랑의 흰 물마루 후보: 바람 부는 해역의 높고 뾰족한 마루
    for (let i = 1; i < SX.length - 1; i++) {
      if (SW[i] < .8 || !(SY[i] < SY[i - 1] && SY[i] <= SY[i + 1])) continue;
      const h = Y0 - SY[i]; if (h >= 11) CR.push({ X: SX[i], Y: SY[i], h });
    }
    breakers();
  }
  /* 화면 x 근처(±rad)에서 가장 높은 표본 → 마루 꼭대기 */
  function crestSample(sx, rad) { let i0 = -1, best = 1e9; for (let i = 1; i < SX.length - 1; i++) if (Math.abs(SX[i] - sx) < rad && SY[i] < best) { best = SY[i]; i0 = i; } return i0; }
  /* 표본 i 와 양옆 두 점을 지나는 포물선의 꼭짓점 [x, y] (표본 사이 양쪽 절반 안으로 제한)
     → 마루·골이 움직일 때 표시·라벨이 표본 간격(5 px)씩 건너뛰며 떨리지 않고 부드럽게 따라감 */
  function vertex(i) {
    const x0 = SX[i - 1], y0 = SY[i - 1], x1 = SX[i], y1 = SY[i], x2 = SX[i + 1], y2 = SY[i + 1];
    const a = x1 - x0, b = x2 - x1; if (a <= 1e-6 || b <= 1e-6) return [x1, y1];
    const s0 = (y1 - y0) / a, s1 = (y2 - y1) / b, A = (s1 - s0) / (a + b), B = (s0 * b + s1 * a) / (a + b); // y = y1 + B·u + A·u², u = x − x1
    if (Math.abs(A) < 1e-9) return [x1, y1];
    const u = clamp(-B / (2 * A), -a / 2, b / 2);
    return [x1 + u, y1 + B * u + A * u * u];
  }
  /* 마루(world x)의 화면 꼭대기 (표본에서 찾음; 그림과 항상 일치) — 거품 그리기용 */
  function crestTop(x) { const sx = x - camX + at(LEAN, x) * 1.415 / at(KK, x), i = crestSample(sx, 32); return i < 0 ? null : { i, x: SX[i], y: SY[i], k: at(KK, x), H: at(HH, x) }; }
  /* 표시·라벨용 마루 꼭대기: 근처의 볼록한 꼭대기들을 표본 사이까지 보간한 뒤 높이가 비슷할수록 크게 섞음
     → 마루가 움직여도, 부서질 때 원래 꼭대기와 떨어지는 마루 끝의 높이가 엇갈려도 표시가 건너뛰지 않고 미끄러지듯 옮겨 감 */
  function crestMark(x) {
    const c = crestTop(x); if (!c) return null;
    const sx = x - camX + at(LEAN, x) * 1.415 / c.k, tops = [];
    for (let i = Math.max(1, c.i - 26), i1 = Math.min(SX.length - 2, c.i + 26); i <= i1; i++) if (Math.abs(SX[i] - sx) < 32 && SY[i] <= SY[i - 1] && SY[i] <= SY[i + 1]) tops.push(vertex(i)); // c.i 근처만 (표본 간격 ≥ 2.5 px)
    if (!tops.length) tops.push(vertex(c.i));
    const top = Math.min(...tops.map(v => v[1])); let w = 0, mx = 0, my = 0;
    for (const [vx, vy] of tops) { const k = Math.exp(-(vy - top) / .6); w += k; mx += k * vx; my += k * vy; }
    return { ...c, x: mx / w, y: my / w };
  }

  /* ---- 쇄파: 넘어지는 마루 끝 (BK0 ~ BK1 을 지나는 마루마다, 모든 마루가 같은 자리에서 같은 모습으로 부서짐) ----
     밑바탕 수면(SX·SY)은 x 가 되돌아가지 않아 앞면이 수직까지만 가팔라짐. 마루 끝(입술)은 따로 곡선으로 만들어 그릴 윤곽(PX·PY)에 이어 붙임:
     위쪽 선(마루 뒤 → 앞으로 뻗은 끝) + 아래쪽 선(끝 → 마루 앞면). 아래쪽 선은 늘 밑바탕 수면보다 위, 위쪽 선은 늘 아래쪽 선보다 위라
     윤곽이 스스로 교차하지 않고, 그 사이 빈 곳(공기)이 보임. 진행도 b: 0~.6 끝이 뻗어 나감 → .78 앞쪽 수면에 닿음 → 1 빈 곳이 닫힘 → 1.3 흰 물결로 */
  const PX = [], PY = [], BRK = [];
  const HB = at(HH, XB);                                   // 부서지는 마루의 크기 기준 (쇄파 지점의 파고)
  const herm = (x, x0, y0, m0, x1, y1, m1) => { const d = x1 - x0, s = clamp((x - x0) / d, 0, 1), s2 = s * s, s3 = s2 * s; return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * d * m0 + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * d * m1; };
  const baseY = x => { let lo = 0, hi = SX.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (SX[m] <= x) lo = m; else hi = m; } const r = clamp((x - SX[lo]) / ((SX[hi] - SX[lo]) || 1), 0, 1); return SY[lo] + (SY[hi] - SY[lo]) * r; };
  function breakers() {
    PX.length = PY.length = BRK.length = 0;
    const Ft = OM * t - PH0, n0 = Math.ceil((at(PHI, BK0) - Ft) / TAU), n1 = Math.floor((at(PHI, BK0 + 1.3 * (BK1 - BK0)) - Ft) / TAU);
    let from = 0;
    for (let n = n0; n <= n1; n++) {
      const x = phiInv(Ft + TAU * n), b = brk(x); if (b < 0 || b > 1.3) continue;
      const ic = crestSample(x - camX + at(LEAN, x) * 1.415 / at(KK, x), 24); if (ic < 2 || ic < from) continue;
      const xt = SX[ic], yt = SY[ic];
      let i0 = ic; while (i0 > from + 1 && xt - SX[i0] < .35 * HB) i0--;
      const x0 = SX[i0], y0 = SY[i0], m0 = (SY[i0 + 1] - SY[i0 - 1]) / ((SX[i0 + 1] - SX[i0 - 1]) || 1);
      const R = HB * (.12 + .78 * sm(0, .62, b)), fall = Math.pow(sm(.18, .78, b), 1.25), xT = xt + R, yS = baseY(xT);
      const yT = Math.min(yt + .1 * HB + (yS - yt - .1 * HB) * fall, yS - .6);      // 끝: 마루 높이에서 앞쪽 수면까지 떨어짐 (수면 아래로는 안 들어감)
      const xp = xt + .25 * R, yp = yt - .06 * HB, mT = .4 + 2.6 * fall;             // 위쪽 선의 가장 높은 곳·끝의 기울기
      const w0 = HB * .42 * (1 - .3 * sm(.3, .9, b)), close = sm(.76, 1, b), merge = sm(1, 1.3, b);
      let ir = ic + 1; while (ir < SX.length - 2 && SY[ir] < yt + .75 * w0 && SX[ir] < xT - 2) ir++;   // 아래쪽 선이 앞면에 붙는 자리 (마루 꼭대기보다 조금 아래)
      const xr = SX[ir] < xT - 2 ? SX[ir] : xt;
      const upY = xx => { const y = xx <= xp ? herm(xx, x0, y0, m0, xp, yp, 0) : herm(xx, xp, yp, 0, xT, yT, mT); return xx <= xt ? Math.min(y, baseY(xx)) : y; };
      const up = [], lo = [];
      for (let xx = x0, st = Math.max(1.5, (xT - x0) / 40); ; xx = Math.min(xT, xx + st)) { up.push([xx, upY(xx)]); if (xx >= xT) break; }
      for (let xx = xT, st = Math.max(1.5, (xT - xr) / 24); ; xx = Math.max(xr, xx - st)) {
        const by = baseY(xx) - .6, g = Math.pow(clamp((xT - xx) / ((xT - xr) || 1), 0, 1), .5);   // 두께: 끝에서 0, 붙는 자리에서 w0
        let y = Math.min(upY(xx) + w0 * g, by); y += (by - y) * close; lo.push([xx, y]); if (xx <= xr) break;
      }
      // 위쪽 선이 아래쪽 선보다 늘 위에 있게, 흰 물결로 넘어가면 둘 다 밑바탕 수면에 겹쳐 사라짐
      for (const q of up) { const yl = q[0] >= xt ? Math.min(baseY(q[0]) - .6, lo.reduce((a, p) => Math.abs(p[0] - q[0]) < Math.abs(a[0] - q[0]) ? p : a)[1]) : baseY(q[0]); q[1] = Math.min(q[1], yl - .5 * (1 - close)); q[1] += (baseY(q[0]) - q[1]) * merge; }
      for (const q of lo) q[1] += (baseY(q[0]) - .6 - q[1]) * merge;
      for (let i = from; i < i0; i++) { PX.push(SX[i]); PY.push(SY[i]); }
      for (const q of up) { PX.push(q[0]); PY.push(q[1]); }
      for (const q of lo) { PX.push(q[0]); PY.push(q[1]); }
      from = SX[ir] < xT - 2 ? ir : ic + 1;
      BRK.push({ n, b, xT, up, lo });
    }
    for (let i = from; i < SX.length; i++) { PX.push(SX[i]); PY.push(SY[i]); }
  }
  /* ---- 풍랑의 흰 물마루: 마루에 붙은 작은 흰 조각 하나, 0.25 s 페이드, 나타날 때(≥15)·사라질 때(<11) 기준이 달라 깜빡이지 않음 ---- */
  const caps = [];
  function whitecaps(dt) {
    caps.forEach(c => { c.seen = false; });
    for (const p of CR) {
      let best = null, bd = 24;
      for (const c of caps) { const d = Math.abs(c.X - p.X); if (!c.seen && d < bd) { bd = d; best = c; } }
      if (best) { best.seen = true; best.X = p.X; best.Y = p.Y; best.h = p.h; }
      else if (p.h >= 15) caps.push({ X: p.X, Y: p.Y, h: p.h, op: 0, seen: true });
    }
    for (let i = caps.length - 1; i >= 0; i--) {
      const c = caps[i], up = c.seen && c.h >= 11;
      c.op = clamp(c.op + (up ? dt : -dt) / .25, 0, 1);
      if (!up && c.op <= 0) caps.splice(i, 1);
    }
  }

  /* ---- 캔버스 그리기 ---- */
  function setView(v) { const s = base.s * 960 / v[2]; ctx.setTransform(s, 0, 0, s, base.ox - v[0] * s, base.oy - v[1] * s); }
  function drawCanvas() {
    fitCanvas();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvW, cvH);
    setView(view);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (camX < XW + 100) {                                  // 바람 화살표 (바다에 붙어 움직임)
      for (const w of winds) {
        const x = -160 + mod(w.off + 150 * t, XW + 60), o = sm(-160, -60, x) * (1 - sm(XW - 160, XW - 20, x));
        const sx = x - camX; if (o <= 0 || sx < -60 || sx > 1020) continue;
        ctx.save(); ctx.globalAlpha = o; ctx.translate(sx, w.y + 5 * Math.sin(t * 2 + w.off));
        ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(WIND_D); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.stroke(WIND_D);
        ctx.restore();
      }
    }
    if (!waterGrad) { waterGrad = ctx.createLinearGradient(0, 230, 0, 600); waterGrad.addColorStop(0, '#7CC4EA'); waterGrad.addColorStop(1, '#1E5A85'); }
    ctx.beginPath(); ctx.moveTo(PX[0], PY[0]);              // 수면 (넘어지는 마루 끝까지 하나의 윤곽)
    for (let i = 1; i < PX.length; i++) ctx.lineTo(PX[i], PY[i]);
    ctx.lineTo(992, 720); ctx.lineTo(-32, 720); ctx.closePath();
    ctx.fillStyle = waterGrad; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke();
    for (const c of caps) {                                 // 풍랑 물마루
      ctx.save(); ctx.globalAlpha = c.op; ctx.translate(c.X, c.Y - 1); const s = clamp(c.h / 22, .7, 1.25); ctx.scale(s, s);
      ctx.fillStyle = '#fff'; ctx.fill(CAP_D); ctx.strokeStyle = INK; ctx.lineWidth = 2 / s; ctx.stroke(CAP_D); ctx.restore();
    }
    if (camX > XS - 1500) {                                 // 해저·해안 (수면 앞에)
      ctx.save(); ctx.translate(-camX, 0);
      ctx.fillStyle = '#E6C377'; ctx.fill(bedD); ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.stroke(bedD);
      ctx.fillStyle = '#D9AD5C'; ctx.lineWidth = 1.5;
      for (const [x, y] of pebbles) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      if (!svg.dataset.bare) foam();
    }
  }
  /* ---- 흰 물결: 마루 끝이 앞쪽 수면에 닿는 자리에서 생겨(b ≥ .72), 넘어진 마루를 덮고, 부서진 해파 앞면의 낮고 넓은 흰 물결이 되어
     해안 쪽으로 가며 옅어짐. 모양은 마루 번호로 정해지는 난수라 마루와 함께 움직이고 제자리에서 깜빡이거나 솟아오르지 않음 (테두리 없음) ---- */
  const rnd = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };
  function foam() {
    const Ft = OM * t - PH0;
    ctx.fillStyle = '#fff';
    for (const k of BRK) {
      const g = sm(.72, 1.05, k.b); if (g <= 0) continue;
      if (k.b > .78) {                                      // 넘어진 마루 끝·꼭대기가 하얗게 (닿은 뒤)
        ctx.globalAlpha = .9 * sm(.78, 1.02, k.b) * (1 - .6 * sm(1.1, 1.3, k.b));
        ctx.beginPath(); ctx.moveTo(k.up[0][0], k.up[0][1] + 1.5);
        for (const q of k.up) ctx.lineTo(q[0], q[1] + 1.5);
        for (const q of k.lo) ctx.lineTo(q[0], q[1] - 1);
        ctx.closePath(); ctx.fill();
      }
      const r = HB * (.07 + .2 * g), cx = k.xT + .35 * r * g; // 닿는 자리의 흰 덩어리: 커지며 앞쪽으로 퍼짐
      ctx.globalAlpha = .95 * (1 - .5 * sm(1.1, 1.3, k.b));
      for (let j = 0; j < 7; j++) {
        const ex = cx + (rnd(k.n, j) - .35) * 1.7 * r, ey = baseY(ex) - (.1 + .55 * rnd(k.n, j + 9)) * r, rr = r * (.42 + .3 * rnd(k.n, j + 20));
        ctx.beginPath(); ctx.ellipse(ex, ey, rr * 1.35, rr * .8, 0, 0, TAU); ctx.fill();
      }
    }
    // 부서진 해파 앞면의 흰 물결: 마루 조금 뒤 ~ 앞면 아래까지 수면을 따라, 앞면 쪽이 두껍고 해안에 가까울수록 얇고 옅게
    const n0 = Math.ceil((at(PHI, BK0 + .9 * (BK1 - BK0)) - Ft) / TAU), n1 = Math.floor((at(PHI, XS - 6) - Ft) / TAU);
    for (let n = n0; n <= n1; n++) {
      const x = phiInv(Ft + TAU * n), A = sm(.9, 1.2, brk(x)) * (1 - sm(XS - 130, XS - 10, x)); if (A < .02) continue;
      const ic = crestSample(x - camX + at(LEAN, x) * 1.415 / at(KK, x), 24); if (ic < 1) continue;
      const L = TAU / at(KK, x), xb = SX[ic] - .25 * L, xf = SX[ic] + .32 * L, th = HB * .34 * (1 - .45 * sm(BK1, XS - 30, x));
      const top = [], bot = [];
      for (let xx = xb; xx <= xf; xx += 2) {
        const s = (xx - xb) / (xf - xb), prof = Math.sin(Math.PI * Math.pow(s, .7)), bump = 1 + .3 * Math.sin(s * 9 + rnd(n, 1) * 6) * rnd(n, 2);
        const y = baseY(xx) + 1.2; top.push([xx, y]); bot.push([xx, y + th * prof * bump]);
      }
      ctx.globalAlpha = .96 * A; ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]);
      for (const q of top) ctx.lineTo(q[0], q[1]);
      for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const ps = at(PHI, XS - 40) - Ft, r = 46 * Math.pow(.5 + .5 * Math.cos(ps - 1.2), 2), x0 = XS - camX; // 해안에서 물이 비탈을 오르내림
    ctx.beginPath(); ctx.moveTo(x0 - 8, Y0 - 1); for (let u = 0; u <= r; u += 4) ctx.lineTo(x0 + u, beachY(u) - 2);
    ctx.strokeStyle = '#74BFE8'; ctx.lineWidth = 6; ctx.stroke();
    if (r > 3) { const ut = Math.max(0, r - 10); ctx.beginPath(); ctx.moveTo(x0 + ut, beachY(ut) - 3); ctx.lineTo(x0 + r, beachY(r) - 3); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke(); }
  }

  /* ---- ③ 관찰 표시 (화면 좌표): 물리량은 계산대로 함께 변하고, 강조만 속도·이동 거리 → 마루 사이 간격 → 파고 → 부서짐 순서 ---- */
  const show = (g, on) => { const v = on ? '' : 'none'; if (g.style.display !== v) g.style.display = v; };
  const fade = (g, o) => { show(g, o > .01); if (o > .01) sa(g, 'opacity', o.toFixed(2)); };
  /* 시각 tt 의 마루 n 꼭대기 (화면 좌표, 수면과 같은 식) — 지나간 시각의 점을 찍을 때 */
  const crestScr = (n, tt) => { const x = xOf(n, tt); return [toX(x - camX + at(LEAN, x) * 1.415 / at(KK, x)), toY(Y0 - crestEta(x))]; };
  function annotate() {
    let ph = -1, cA = null, cB = null;
    if (state === 'end') ph = 4;
    else if (stage === 2 && track && t >= track.tin) {
      ph = t < track.t1 ? 0 : t < track.t2 ? 1 : t < track.ts0 ? 2 : t < track.ta ? 3 : 4;
      cA = crestMark(xOf(track.nA, t)); cB = crestMark(xOf(track.nB, t));
    }
    const on = !!cA && state !== 'end' && !svg.dataset.bare;
    ann.style.display = svg.dataset.bare ? 'none' : '';
    const ax = on ? toX(cA.x) : 0, ay = on ? toY(cA.y) : 0, bx = cB ? toX(cB.x) : 0, by = cB ? toY(cB.y) : 0;
    // 마루 표시: 마루 꼭대기의 왼쪽 위(MKX·MKY)에 두어 마루와 측정선을 가리지 않음. A 는 부서져 해안에 닿을 때까지, B 는 파장을 볼 때까지
    const mk = (el, x, y) => sa(el, 'transform', `translate(${f1(clamp(x + MKX, 14, 946))},${f1(Math.max(y + MKY, 64))})`);
    show(mkA, on); if (on) mk(mkA, ax, ay);
    const out = (te, tt) => 1 - sm(te - .45, te, tt); // 강조가 바뀌기 직전에 앞 표시가 사라짐
    const oB = on && cB ? out(track.t2 + .5, t) : 0; fade(mkB, oB);   // B 는 파장 비교 멈춤이 끝난 뒤 사라짐
    if (oB > .01) mk(mkB, bx, by);
    // 속도: 같은 시간 간격의 점 (A·B 각각 최근 NT 개, 오래될수록 옅게)
    const oD = on ? out(track.t1, t) : 0; fade(gDot, oD);
    if (oD > .01) {
      const k1 = Math.floor((t - track.tin) / DT);
      [track.nA, track.nB].forEach((n, j) => {
        const pts = [];
        dots[j].forEach((el, q) => {
          const k = k1 - q; if (k < 0) { show(el, false); return; }
          const tk = track.tin + k * DT, [x, y] = crestScr(n, tk);
          show(el, true); attr(el, { cx: f1(x + MKX), cy: f1(y + MKY), opacity: (1 - .75 * (t - tk) / (NT * DT)).toFixed(2) }); // 표시(A·B)가 있던 자리 그대로
          pts.push(f1(x + MKX) + ',' + f1(y + MKY));
        });
        sa(dotTr[j], 'points', pts.join(' '));
      });
      place(dotNote, 16, 72);
    }
    // 잠깐 멈춤 비교의 보이는 정도: 멈추는 동안 나타나고, 다시 움직이면 사라짐 (그 멈춤을 거친 경우만)
    const cmpO = k => !on ? 0 : hk === k ? clamp(holdT / .4, 0, 1) : track.seen[k] && t >= track.stops[k] ? 1 - sm(track.stops[k], track.stops[k] + .5, t) : 0;
    fade(holdNote, hk >= 0 && on ? clamp(holdT / .3, 0, 1) : 0); place(holdNote, 480, 36);
    // 파장: 처음(관찰 시작 때 A·B 자리, 회색) · 지금(빨강) — 같은 높이의 화살표, 양 끝은 각 시각의 마루 꼭대기에서 올린 수직 보조선
    const oL = cB ? cmpO(0) : 0; fade(gLen0, oL); fade(gLen, oL);
    if (oL > .01) {
      const [xa0, ya0] = crestScr(track.nA, track.tin), [xb0, yb0] = crestScr(track.nB, track.tin), s2 = track.stops[0];
      const yr = Math.max(84, Math.min(ya0, yb0, crestScr(track.nA, s2)[1], crestScr(track.nB, s2)[1]) - 46);
      sa(len0Guide, 'd', `M${f1(xa0)} ${f1(ya0)}L${f1(xa0)} ${f1(yr - 8)}M${f1(xb0)} ${f1(yb0)}L${f1(xb0)} ${f1(yr - 8)}`);
      sa(len0Dot, 'd', [[xa0, ya0], [xb0, yb0]].map(([x, y]) => `M${f1(x - 4)} ${f1(y)}a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`).join(''));
      sa(len0, 'd', arrowD(xb0, yr, xa0, yr, 8)); place(len0T, (xa0 + xb0) / 2, yr - 9);
      mk(gA0, xa0, ya0); mk(gB0, xb0, yb0);
      sa(lenGuide, 'd', `M${f1(ax)} ${f1(ay - 3)}L${f1(ax)} ${f1(yr - 8)}M${f1(bx)} ${f1(by - 3)}L${f1(bx)} ${f1(yr - 8)}`);
      sa(lenNow, 'd', arrowD(bx, yr, ax, yr, 8)); place(lenLabel, (ax + bx) / 2, yr - 9);
    }
    // 파고: 지금 A 의 마루 ~ A·B 사이 골(빨강) + 처음 A 의 마루 모양(회색 점선)을 같은 골 높이에 겹쳐 처음 파고(회색)와 나란히
    const oH = cmpO(1); fade(gHt, oH);
    if (oH > .01) {
      let it = -1, worst = -1e9;
      for (let i = cB ? cB.i : Math.max(1, cA.i - 40); i < cA.i; i++) if (SY[i] > worst) { worst = SY[i]; it = i; }
      if (it > 0) {
        const [gx, gy] = vertex(it), ty = toY(gy);
        // 처음(관찰 시작 때) A 의 마루 모양: 수면 식으로 다시 계산해, 마루를 지금 A 위치·골을 지금 골 높이에 맞춤
        const xc = xOf(track.nA, track.tin), L = TAU / at(KK, xc), Ft0 = OM * track.tin - PH0, pts = [];
        for (let x = xc - .55 * L; x <= xc + .3 * L; x += 3) { const th = at(PHI, x) - Ft0, c2 = (1 + Math.cos(th)) / 2, m = at(MM, x); pts.push([x - xc, Hd(x) * (Math.pow(c2, m) - mu(m))]); }
        const sc = 540 / view[3], top = Math.max(...pts.map(q => q[1])), low = Math.min(...pts.filter(q => q[0] < 0).map(q => q[1])), h0 = (top - low) * sc;
        sa(htGhost, 'd', pts.map((q, i) => (i ? 'L' : 'M') + f1(ax + q[0] * sc) + ' ' + f1(ty - (q[1] - low) * sc)).join(''));
        const xr = ax - 20, xg = ax - 62;
        sa(htNow, 'd', dArrowV(xr, ay, ty)); sa(htFirst, 'd', dArrowV(xg, ty - h0, ty));
        sa(htBase, 'd', `M${f1(xg - 10)} ${f1(ty)}L${f1(ax + 8)} ${f1(ty)}M${f1(xg - 6)} ${f1(ty - h0)}L${f1(ax)} ${f1(ty - h0)}M${f1(xr - 6)} ${f1(ay)}L${f1(ax)} ${f1(ay)}`);
        place(htFirstT, xg, ty + 21); place(htLabel, xr, ty + 21);
      }
    }
    if (ph !== phase) {
      phase = ph;
      checkEls.forEach((li, i) => { li.classList.toggle('now', i === ph); li.classList.toggle('done', i < ph); });
      if (stage === 2) setExplain(ph < 0 ? TX.cap[2] : TX.cap3[ph]);
    }
  }
  /* 구도: ①·②는 배율 1, ③으로 이동하는 동안 배율 Z3·아래로 내린 구도로 바뀐 뒤 고정 (캔버스·뒤 SVG 에 같은 viewBox) */
  function setViewBox() {
    view = viewAt(tau);
    const vb = view.map(v => +v.toFixed(1)).join(' ');
    if (vb !== zoom) { zoom = vb; svg.setAttribute('viewBox', vb); }
  }
  let camStr = '';
  function render(dt) {
    if (state === 'play' && stage === 2 && track && hold > 0) {           // 잠깐 멈춤 중: 해파·표시는 그대로, 재생 막대만 진행
      hold = Math.max(0, hold - dt); holdT += dt; tau += dt; OFF += dt; TOTAL += dt; DUR[2] += dt; dt = 0;
      if (!hold) hk = -1;
    }
    if (state === 'play' && stage === 2 && track) // ③ 관찰은 조금 느리게, 넘어지는 동안은 더 느리게 (서서히 바뀜, 모든 움직임이 같은 시간 기준)
      dt *= (1 - (1 - OBS) * sm(START[2] + P3 - 1.5, START[2] + P3, tau)) * (1 - (1 - SLOW) * sm(track.ts0 - .6, track.ts0 + .2, t) * (1 - sm(track.ts1, track.ts1 + .8, t)));
    if (state === 'play' && stage === 2 && track && dt > 0 && track.fi < track.stops.length && t + dt >= track.stops[track.fi]) { // 멈출 자리에서 정확히 멈춤
      dt = Math.max(0, track.stops[track.fi] - t); hk = track.fi; hold = FREEZE[hk]; holdT = 0; track.seen[hk] = true; track.fi++;
    }
    t += dt;
    if (state === 'play') { tau += dt; if (tau >= TOTAL) { tau = TOTAL; state = 'end'; syncButtons(); } }
    const st = stageAt(tau); if (st !== stage) enterStage(st);
    camX = camNow();
    const cs = camX.toFixed(1);
    if (cs !== camStr) { // 카메라가 움직일 때만 SVG 그룹 이동
      camStr = cs;
      back.setAttribute('transform', `translate(${-cs},0)`);
      mid.setAttribute('transform', `translate(${(-camX * PAR_MID).toFixed(1)},0)`); clouds.setAttribute('transform', `translate(${(-camX * PAR_MID).toFixed(1)},0)`);
    }
    if (dt > 0 && dt < .1) watchFps(dt);
    surface(); whitecaps(dt); setViewBox(); drawCanvas(); placeZones(); annotate(); syncProgress();
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
  checks.innerHTML = TX.checks.map((c, i) => `<li data-n="${i + 1}"><button type="button" class="ck-btn">${c}</button></li>`).join('');
  stepEls[2].appendChild(checks);
  const checkEls = Array.from(checks.children), bars = stepEls.map(li => li.querySelector('.st-bar i')), barW = [];
  checkEls.forEach((li, i) => { li.querySelector('.ck-btn').onclick = () => jumpTo(i); });
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
    track = null; phase = -1; checkEls.forEach(li => li.classList.remove('now', 'done'));
    if (st === 2) pickTrack(); else { TOTAL = START[2] + DUR[2]; }
  }
  /* 관찰 순서의 속도·파장·파고·부서짐을 누르면 그 장면으로 바로 (①·②를 보는 중이거나 ③으로 이동 중이면 카메라가 ③에 도착한 상태로 옮긴 뒤) */
  function jumpTo(i) {
    if (!(stage === 2 && track) || state === 'idle' || tau < START[2] + P3) { tau = START[2] + P3; state = 'play'; enterStage(2); }
    const ts = [track.tin, track.t1, track.t2, track.ts0 - .8][i];
    track.fi = [0, 0, 1, 2][i]; track.seen = [false, false]; hold = 0; hk = -1;
    t = ts; tau = Math.max(ts + OFF, START[2] + P3); OFF = tau - t; TOTAL = track.tEnd + OFF; DUR[2] = TOTAL - START[2];
    state = 'play'; phase = -1; caps.length = 0; setPaused(false); syncButtons();
  }
  const playBtn = $('#t3-play');
  function syncButtons() { playBtn.textContent = state === 'idle' ? TX.play : TX.replay; playBtn.classList.toggle('primary', state !== 'play'); }
  function playFrom(s) { tau = s; state = 'play'; stage = -1; caps.length = 0; hold = 0; hk = -1; setPaused(false); syncButtons(); } // 장면을 건너뛸 때 앞 장면의 흰 물마루가 남지 않게
  playBtn.onclick = () => playFrom(0);
  registerPauseBtn($('#t3-pause'));
  syncButtons(); render(0);
  frames['3'] = render;
})();
