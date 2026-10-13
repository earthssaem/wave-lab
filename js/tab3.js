/* 탭3: 풍랑·너울·연안 쇄파 — ① 바람 부는 해역의 풍랑 → (경계 정지) → ② 발생 해역 밖의 너울 → ③ 해안의 연안 쇄파를 이어서 자동 재생
   하나의 긴 바다(world x) 위에서 카메라가 이동. 너울은 분산 관계(ω² = gk·tanh kh)로 수심에 따른 파장·속도를,
   에너지 흐름 보존(천수 계수)으로 파고를 계산하고, 파고가 수심의 0.78배에 이르면 부서진 뒤 파고 = 0.78 × 수심으로 줄어듦 (단순화한 모형).
   ③에서는 마루 하나를 골라 부서질 때까지 따라가며 속도 → 파장 → 파고 → 부서짐을 차례로 강조 (물리량은 항상 함께 변함).
   그리기 층: 뒤 SVG(하늘·구름·경계·해역 이름표, 확대됨) < 캔버스(수면·거품·바람 화살표·해저·해안, 확대됨) < 앞 SVG(추적 표시·라벨, 화면 좌표라 확대돼도 글자 크기 유지) */
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
  const KK = new Float64Array(N), PHI = new Float64Array(N), HH = new Float64Array(N), MM = new Float64Array(N), LEAN = new Float64Array(N), CU = new Float64Array(N), VF = new Float64Array(N);
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
      LEAN[i] = .8 * sm(XB - 260, XB, x);                                     // 앞으로 쏠림: 쇄파 직전까지 0 → .8 (앞면이 가팔라짐)
      CU[i] = sm(XB - 50, XB - 4, x) * (1 - sm(XB + 8, XB + 40, x));         // 말려 떨어짐: 쇄파 지점 바로 앞뒤에서만
      VF[i] = sm(XB + 4, XB + 30, x);                                         // 부서진 뒤: 마루가 무너져 낮고 넓은 물결로 (0 → 1)
      if (x > XB + 4) MM[i] = MM[i] + (.6 - MM[i]) * VF[i];                  // 마루 모양: 뾰족 → 넓고 납작
    }
  })();
  const at = (A, x) => { const f = clamp((x - XMIN) / DX, 0, N - 1.001), i = f | 0, r = f - i; return A[i] + (A[i + 1] - A[i]) * r; };
  const phiInv = v => { let lo = 0, hi = N - 1; if (v <= PHI[0]) return XMIN; if (v >= PHI[hi]) return XMAX; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (PHI[m] < v) lo = m; else hi = m; } return XMIN + (lo + (v - PHI[lo]) / (PHI[hi] - PHI[lo])) * DX; };
  const mu = m => 1 / Math.sqrt(Math.PI * (m + .25)); // ((1+cosθ)/2)^m 의 평균 → 평균 해수면 유지
  const CURL_F = s => Math.exp(-(s - .35) * (s - .35) / (s < .35 ? .25 : 1.0)), CURL_G = s => Math.exp(-(s - .55) * (s - .55) / .25); // 마루 끝(s≈.2~.8)이 앞으로 뻗으며(f, 앞쪽은 천천히 줄어 앞면도 함께 기욺) 아래로 떨어져(g) 앞면 위에 닿음

  /* ---- 카메라·타임라인: ① 10 s → 이동 6 s → 경계 정지 2.5 s → 이동 7.5 s → ② 8 s → 이동 9 s → ③ (추적 마루에 따라 약 42 s) ----
     ③ 처음 구도(CAM3A)는 쇄파 구역이 화면 밖 오른쪽. 추적 마루가 다가오면 CAM3B 로 구도 이동 (마루 위치의 함수라 재생·점프와 무관하게 같음) */
  const CAM3A = XB - 1010, CAM3B = XB - 640;
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
    return CAM2 + (CAM3A - CAM2) * sm(0, 1, s / P3);
  };
  const stageAt = s => s < START[1] ? 0 : s < START[2] ? 1 : 2;
  /* ③ 단계 경계: 추적 마루가 해안선에서 이 거리(u)에 올 때 다음 단계로 */
  const X1 = XS - 700, X2 = XS - 440, XPAN0 = XS - 790, XPAN1 = XS - 540;

  /* ---- 뒤 SVG: 하늘 (하늘색은 카메라의 50%, 흰 구름 50%, 먹구름·경계·이름표 100%). 해는 없음 ---- */
  svg.appendChild(E('defs', {}, [
    E('linearGradient', { id: 's3-sky', gradientUnits: 'userSpaceOnUse', x1: 900, y1: 0, x2: 1500, y2: 0 }, [E('stop', { offset: 0, 'stop-color': '#B3CAD6' }), E('stop', { offset: 1, 'stop-color': '#BFE3F5' })]),
  ]));
  const PAR_MID = .5;
  const mid = E('g'); svg.appendChild(mid);
  mid.appendChild(E('rect', { x: -200, y: -40, width: 1102, height: 620, fill: '#B3CAD6' }));
  mid.appendChild(E('rect', { x: 1498, y: -40, width: 1600, height: 620, fill: '#BFE3F5' }));
  mid.appendChild(E('rect', { x: 900, y: -40, width: 600, height: 620, fill: 'url(#s3-sky)' }));
  const cloud = (x, y, s, fill) => E('path', { d: 'M0 0 a26 26 0 0 1 50 -16 a30 30 0 0 1 58 8 a20 20 0 0 1 4 40 l-110 0 a22 22 0 0 1 -2 -32 Z', fill, stroke: INK, 'stroke-width': 4 / s, transform: `translate(${x},${y}) scale(${s})` });
  const clouds = E('g'); svg.appendChild(clouds);      // 흰 구름 두 개, 작게 (카메라의 50%)
  [[1130, 70, .6], [1800, 62, .55]].forEach(([x, y, s]) => clouds.appendChild(cloud(x, y, s, '#fff')));
  const back = E('g'); svg.appendChild(back);           // 바다에 붙은 것: 먹구름·경계·이름표 (100%)
  [[120, 72, .9], [520, 60, .75], [1000, 80, .9]].forEach(([x, y, s]) => back.appendChild(cloud(x, y, s, '#C7D1D8')));
  back.appendChild(E('path', { d: `M${XW} 40 L${XW} ${Y0 - 50}`, stroke: INK, 'stroke-width': 2, 'stroke-dasharray': '8 7', opacity: .45 }));
  const addPill = (parent, text, x, y, o) => { const p = pill(text, o); p.move(x, y); parent.appendChild(p.g); return p; };
  addPill(back, TX.wind, 250, 128, { fs: 16, pad: 8 });
  addPill(back, TX.windZone, 850, 62, { fs: 16, pad: 8, bg: '#E3EAEF' });   // ①·경계 정지 화면용 (경계 정지 때 배지와 겹치지 않게 아래 줄)
  addPill(back, TX.calmZone, 1350, 30, { fs: 16, pad: 8 });                 // 경계 정지 화면용
  addPill(back, TX.calmZone, 2050, 30, { fs: 16, pad: 8 });                 // ② 화면용
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
  const bedD = (() => { let d = `M${XS - 1400} 600`; for (let x = XS - 1400; x <= XS + 400; x += 10) d += `L${x} ${(x < XS ? Y0 + depth(x) : beachY(x - XS)).toFixed(1)}`; return new Path2D(d + `L${XS + 400} 600Z`); })();
  const pebbles = []; for (let x = XS - 530; x < XS + 360; x += 46) { const y = (x < XS ? Y0 + depth(x) : beachY(x - XS)) + 16 + (x % 3) * 9; if (y < 545) pebbles.push([x + (x % 5) * 4, y]); }
  let waterGrad = null;

  /* ---- 앞 SVG (화면 좌표 0~960 × 0~540, 확대와 무관): 추적 표시·측정선·라벨 ---- */
  const svgF = E('svg', { viewBox: '0 0 960 540', preserveAspectRatio: 'xMidYMid slice' }); cv.after(svgF);
  const ann = E('g'); svgF.appendChild(ann);
  const THIN = { stroke: INK, 'stroke-width': 1.5, fill: 'none', opacity: .55 };                 // 보조선: 가늘고 옅게
  const DASH = { stroke: GREY, 'stroke-width': 2.5, fill: 'none', 'stroke-dasharray': '5 4' };  // 처음 값
  const SOLID = { stroke: ACC, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }; // 현재 값
  const txt = (s, o = {}) => E('text', { 'font-family': o.body ? "'Noto Sans KR',sans-serif" : 'Jua', 'font-size': o.fs || 15, fill: o.fill || INK, 'text-anchor': o.anchor || 'middle', 'font-weight': o.body ? 500 : 400, 'paint-order': 'stroke', stroke: '#FFFDF8', 'stroke-width': 4, 'stroke-linejoin': 'round', text: s });
  /* 짧은 설명 태그: 테두리 없는 흰 바탕 + 본문 글꼴 */
  const note = s => { const w = textW(s, 13) + 18, g = E('g', {}, [E('rect', { x: -w / 2, y: -11, width: w, height: 22, rx: 6, fill: 'rgba(255,253,248,.92)' }), E('text', { y: 4, 'text-anchor': 'middle', 'font-family': "'Noto Sans KR',sans-serif", 'font-size': 13, 'font-weight': 500, fill: INK, text: s })]); g.w = w; return g; };
  const mkMain = E('path', { d: 'M-8 -13 L8 -13 L0 0 Z', fill: ACC, stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round' });            // 관찰 대상 마루 (끝까지)
  const mkRear = E('path', { d: 'M-7 -12 L7 -12 L0 -1 Z', fill: '#fff', stroke: GREY, 'stroke-width': 1.5, 'stroke-linejoin': 'round' });        // 파장 단계의 뒤 마루
  // 속도: 마루 위 화살표 두 개 (현재 = 실선, 처음 = 점선), 이름은 화살표 끝에
  const gSpd = E('g'), spdNow = E('path', SOLID), spdFirst = E('path', DASH), spdNowT = txt(TX.now, { fs: 12, fill: ACC, anchor: 'start' }), spdFirstT = txt(TX.first, { fs: 12, fill: GREY, anchor: 'start' });
  const spdLabel = txt(TX.speed, { fs: 17, fill: ACC }), spdLead = E('path', THIN);
  gSpd.append(spdFirst, spdNow, spdFirstT, spdNowT, spdLead, spdLabel);
  // 수심: 평균 해수면 ~ 해저 세로 측정선 + 여백의 이름
  const gDep = E('g'), depLine = E('path', { stroke: INK, 'stroke-width': 2, fill: 'none', opacity: .7, 'stroke-dasharray': '3 4' }), depLabel = txt(TX.depth, { fs: 15, fill: INK }), depLead = E('path', THIN);
  gDep.append(depLine, depLead, depLabel);
  // 파장: 두 마루에서 올린 수직 보조선 + 수평 양방향 화살표(현재), 그 위에 처음 파장(점선)
  const gLen = E('g'), lenGuide = E('path', THIN), lenNow = E('path', SOLID), lenFirst = E('path', DASH), lenFirstT = txt(TX.first, { fs: 12, fill: GREY, anchor: 'start' }), lenNowT = txt(TX.now, { fs: 12, fill: ACC, anchor: 'start' });
  const lenLabel = txt(TX.length, { fs: 17, fill: ACC }), lenLead = E('path', THIN);
  gLen.append(lenGuide, lenFirst, lenNow, lenFirstT, lenNowT, lenLead, lenLabel);
  // 파고: 골 높이 ~ 마루 높이 세로 양방향 화살표(측정), 여백의 이름, 오른쪽 위의 작은 비교 막대(처음/현재)
  const gHt = E('g'), htGuide = E('path', THIN), htNow = E('path', SOLID), htLabel = txt(TX.height, { fs: 17, fill: ACC }), htLead = E('path', THIN);
  const cmp = E('g', { transform: 'translate(842,66)' }, [
    E('rect', { x: -58, y: -14, width: 116, height: 150, rx: 8, fill: 'rgba(255,253,248,.92)' }),
    txt(TX.compare, { fs: 13, body: true }),
  ]);
  const cmpFirst = E('rect', { x: -40, width: 26, fill: '#C3CDD5', stroke: GREY, 'stroke-width': 1.5 }), cmpNow = E('rect', { x: 10, width: 26, fill: '#F5B3A6', stroke: ACC, 'stroke-width': 2 });
  const cmpBase = E('path', { d: 'M-50 104 L50 104', stroke: INK, 'stroke-width': 1.5 });
  cmp.append(cmpFirst, cmpNow, cmpBase, E('text', { x: -27, y: 122, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 12, fill: GREY, text: TX.first }), E('text', { x: 23, y: 122, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 12, fill: ACC, text: TX.now }));
  gHt.append(htGuide, htNow, htLead, htLabel, cmp);
  // 부서짐: 짧은 설명 + 마루를 가리키는 연결선
  const gBrk = E('g'), brkNote = note(TX.breakNote), brkLead = E('path', { stroke: INK, 'stroke-width': 1.5, fill: 'none', opacity: .7 });
  gBrk.append(brkLead, brkNote);
  ann.append(gDep, gSpd, gLen, gHt, gBrk, mkRear, mkMain);
  const dArrowV = (x, y1, y2) => `M${x} ${y1}L${x} ${y2}M${x - 6} ${y1 + 8}L${x} ${y1}L${x + 6} ${y1 + 8}M${x - 6} ${y2 - 8}L${x} ${y2}L${x + 6} ${y2 - 8}`;
  const arrowR = (x1, x2, y) => `M${x1} ${y}L${x2} ${y}M${x2 - 8} ${y - 6}L${x2} ${y}L${x2 - 8} ${y + 6}`;
  const KA = 1; // 속도 화살표 길이 = 속도(px/s) × KA
  const f1 = v => v.toFixed(1);

  /* ---- 상태 ---- */
  let t = 0, tau = 0, state = 'idle', stage = -1, camX = 0, track = null, phase = -1, OFF = 0, zoom = '', view = [0, 0, 960, 540];
  const SLOW = .55; // 추적 마루가 넘어가는 동안의 재생 속도
  const toX = x => (x - view[0]) * 960 / view[2], toY = y => (y - view[1]) * 540 / view[3]; // 캔버스 좌표 → 앞 SVG(화면) 좌표

  /* ③에 들어설 때: 카메라 도착 직후 화면 왼쪽 끝에 들어오는 마루를 골라 부서질 때까지 따라감 */
  function pickTrack() {
    const te = t + (START[2] + P3 - tau);               // 카메라 도착 시각 (전역 시간)
    const xin = CAM3A + 4, n = Math.floor((at(PHI, xin) - (OM * (te - 1.2) - PH0)) / TAU); // 도착 1.2 s 전 이후에 xin 을 지나는 첫 마루
    const tAt = x => (at(PHI, x) + PH0 - TAU * n) / OM; // 이 마루가 x 에 있는 시각
    const xAt = tt => phiInv(OM * tt - PH0 + TAU * n);  // 시각 tt 의 마루 위치
    const tin = tAt(xin);
    const k = at(KK, xin);
    track = { n, tin, tAt, xAt, c0: OM / k, L0: TAU / k, H0: at(HH, xin), t1: tAt(X1), t2: tAt(X2), ts0: tAt(XB - 40), ts1: tAt(XB + 28), ta: tAt(XB + 44) };
    track.tEnd = track.ta + 6;
    OFF = tau - t; TOTAL = track.tEnd + OFF; DUR[2] = TOTAL - START[2];
  }
  const camNow = () => (stage === 2 && track && tau >= START[2] + P3) ? CAM3A + (CAM3B - CAM3A) * sm(XPAN0, XPAN1, track.xAt(t)) : camAt(tau);

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
      const th = PHI[i] + (PHI[i + 1] - PHI[i]) * r - Ft, lean = LEAN[i] + (LEAN[i + 1] - LEAN[i]) * r, cu = CU[i] + (CU[i + 1] - CU[i]) * r, c2 = (1 + Math.cos(th)) / 2;
      let eta = H * (Math.pow(c2, m) - mu(m)), dx = lean * 1.415 / k * c2 * c2, wsum = 0;
      if (cu > 0) { // 쇄파 지점: 마루 끝이 앞으로 기울며(f) 아래로 떨어져(g) 앞쪽 수면에 닿음 → 윤곽이 자기 자신과 만나며 한 덩어리가 됨
        const s = th - Math.round(th / TAU) * TAU;   // 마루 기준 위상 (-π~π, +가 앞쪽)
        dx += cu * 1.9 / k * CURL_F(s); eta -= cu * .8 * H * CURL_G(s);
      }
      if (x < XW + 900) {
        const fetch = .55 + .45 * sm(-200, 700, x), past = x > XW ? x - XW : 0;
        for (let j = 0; j < NW; j++) {
          const w = WIND[j], env = past ? fetch * Math.exp(-past / w.D) : fetch; if (env < .01) continue;
          const a = WA[j] * env, th2 = w.k * x + WP[j];
          eta += a * Math.cos(th2); dx -= QW * a * Math.sin(th2); wsum += env;
        }
      }
      SX.push(sx + dx); SY.push(Y0 - eta); SW.push(wsum);
    }
    CR.length = 0; // 풍랑의 흰 물마루 후보: 바람 부는 해역의 높고 뾰족한 마루
    for (let i = 1; i < SX.length - 1; i++) {
      if (SW[i] < .8 || !(SY[i] < SY[i - 1] && SY[i] <= SY[i + 1])) continue;
      const h = Y0 - SY[i]; if (h >= 11) CR.push({ X: SX[i], Y: SY[i], h });
    }
  }
  /* 화면 x 근처(±rad)에서 가장 높은 표본 → 마루 꼭대기 */
  function crestSample(sx, rad) { let i0 = -1, best = 1e9; for (let i = 1; i < SX.length - 1; i++) if (Math.abs(SX[i] - sx) < rad && SY[i] < best) { best = SY[i]; i0 = i; } return i0; }
  /* 마루(world x)의 화면 꼭대기 (표본에서 찾음; 그림과 항상 일치) */
  function crestTop(x) { const sx = x - camX + at(LEAN, x) * 1.415 / at(KK, x), i = crestSample(sx, 32); return i < 0 ? null : { i, x: SX[i], y: SY[i], k: at(KK, x), H: at(HH, x) }; }

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
    ctx.beginPath(); ctx.moveTo(SX[0], SY[0]);              // 수면 (넘어가는 마루까지 하나의 윤곽)
    for (let i = 1; i < SX.length; i++) ctx.lineTo(SX[i], SY[i]);
    ctx.lineTo(992, 600); ctx.lineTo(-32, 600); ctx.closePath();
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
      ctx.translate(XS + 105, beachY(105) + 2);
      ctx.fillStyle = '#8A5230'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.rect(-4, -26, 8, 26); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5F9E4B'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -42, 21, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      foam();
    }
  }
  /* 점 목록을 중점끼리 2차 곡선으로 이어 둥근 닫힌 경로로 */
  function roundPath(P) {
    const n = P.length; ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; if (i) ctx.quadraticCurveTo(a[0], a[1], mx, my); else ctx.moveTo(mx, my); }
    const a = P[0], b = P[1]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); ctx.closePath();
  }
  /* ---- 거품: 부서진 마루마다 수면을 따라 퍼지는 불규칙한 흰 띠 (테두리 없음), 충돌 순간의 물보라, 해안에서 밀려 오르는 물 ---- */
  function foam() {
    const Ft = OM * t - PH0, Hb = at(HH, XB);
    const n0 = Math.ceil((at(PHI, XB - 12) - Ft) / TAU), n1 = Math.floor((at(PHI, XS - 12) - Ft) / TAU);
    for (let n = n0; n <= n1; n++) {
      const x = phiInv(Ft + TAU * n), p = (x - XB) / 36, L = TAU / at(KK, x), H = at(HH, x);
      const c = crestTop(x); if (!c) continue;
      const fade = 1 - sm(0, 1, (Hb * .3 - H) / (Hb * .15));              // 파고가 아주 낮아지면 사라짐
      const A = sm(-.3, .5, p) * fade; if (A < .02) continue;
      // 띠 범위: 마루 뒤 0.15 파장 ~ 앞 0.45 파장(부서지며 앞으로 퍼짐)
      let ia = c.i, ib = c.i; const backL = .15 * L + .25 * L * sm(.3, 2, p), fwdL = .12 * L + .33 * L * sm(-.2, .8, p);
      while (ia > 0 && SX[c.i] - SX[ia] < backL) ia--;
      while (ib < SX.length - 1 && SX[ib] - SX[c.i] < fwdL) ib++;
      const R = Hb * (.12 + .1 * sm(-.2, .6, p)) * (.6 + .4 * fade), P = [];
      for (let i = ia; i <= ib; i++) { const q = (i - ia) / Math.max(1, ib - ia), w = Math.sin(q * Math.PI) ** .6, rr = R * w * (.6 + .4 * Math.sin(i * .5 + n * 1.3) * Math.sin(i * .23 + n)); P.push([SX[i], SY[i] - rr]); }
      for (let i = ib; i >= ia; i--) { const q = (i - ia) / Math.max(1, ib - ia), w = Math.sin(q * Math.PI) ** .6; P.push([SX[i], SY[i] + R * .4 * w]); }
      roundPath(P); ctx.globalAlpha = A; ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1;
      if (p > -.15 && p < .45) {                                            // 충돌 순간의 물보라 (작은 흰 점 2~3개)
        let it = c.i; for (let i = c.i; i <= Math.min(ib, c.i + 12); i++) if (SX[i] > SX[it]) it = i;
        const s = sm(-.15, .05, p) * (1 - sm(.3, .45, p));
        ctx.globalAlpha = s; ctx.fillStyle = '#fff';
        for (const [dx, dy, r] of [[6, -8, 2.4], [14, -3, 1.8], [10, -15, 1.5]]) { ctx.beginPath(); ctx.arc(SX[it] + dx * (1 + p), SY[it] + dy - 10 * sm(0, .4, p), r, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
    const ps = at(PHI, XS - 40) - Ft, r = 46 * Math.pow(.5 + .5 * Math.cos(ps - 1.2), 2), x0 = XS - camX; // 해안에서 물이 비탈을 오르내림
    ctx.beginPath(); ctx.moveTo(x0 - 8, Y0 - 1); for (let u = 0; u <= r; u += 4) ctx.lineTo(x0 + u, beachY(u) - 2);
    ctx.strokeStyle = '#74BFE8'; ctx.lineWidth = 6; ctx.stroke();
    if (r > 3) { const ut = Math.max(0, r - 10); ctx.beginPath(); ctx.moveTo(x0 + ut, beachY(ut) - 3); ctx.lineTo(x0 + r, beachY(r) - 3); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke(); }
  }

  /* ---- ③ 추적 마루 표시 (화면 좌표) + 관찰 순서(속도 → 파장 → 파고 → 부서짐 → 부서진 뒤) ---- */
  const ratio = { c: 0, L: 0, H: 0 }; // 현재 값 ÷ 처음 값 (오른쪽 카드 막대)
  const show = (g, on) => { const v = on ? '' : 'none'; if (g.style.display !== v) g.style.display = v; };
  function annotate() {
    let ph = -1, c = null;
    if (state === 'end') ph = 4;
    else if (stage === 2 && track && t >= track.tin) {
      ph = t < track.t1 ? 0 : t < track.t2 ? 1 : t < track.ts0 ? 2 : t < track.ta ? 3 : 4;
      const x = track.xAt(t), k = at(KK, x);
      ratio.c = OM / k / track.c0; ratio.L = TAU / k / track.L0; ratio.H = at(HH, x) / track.H0;
      c = crestTop(x);
    } else { ratio.c = ratio.L = ratio.H = 0; }
    show(mkMain, !!c && ph <= 4 && state !== 'end');
    if (c) {
      const cx = toX(c.x), cy = toY(c.y), x = track.xAt(t);
      mkMain.setAttribute('transform', `translate(${f1(cx)},${f1(cy - 5)})`);
      if (ph === 0) {        // 속도: 마루 위 화살표 (현재 실선 · 처음 점선), 수심 측정선
        const x1 = cx + 10, ys = cy - 30, ln = OM / c.k * KA, lf = track.c0 * KA;
        spdNow.setAttribute('d', arrowR(x1, x1 + ln, ys)); spdFirst.setAttribute('d', arrowR(x1, x1 + lf, ys - 18));
        attr(spdNowT, { x: f1(x1 + ln + 8), y: f1(ys + 4) }); attr(spdFirstT, { x: f1(x1 + lf + 8), y: f1(ys - 14) });
        attr(spdLabel, { x: 150, y: 170 }); spdLead.setAttribute('d', `M150 178 L${f1(x1 - 4)} ${f1(ys - 9)}`);
        const dy = toY(Y0), db = toY(Y0 + Math.min(depth(x), 300)), dxs = cx - 2;
        depLine.setAttribute('d', `M${f1(dxs - 6)} ${f1(dy)}L${f1(dxs + 6)} ${f1(dy)}M${f1(dxs)} ${f1(dy)}L${f1(dxs)} ${f1(db)}M${f1(dxs - 6)} ${f1(db)}L${f1(dxs + 6)} ${f1(db)}`);
        attr(depLabel, { x: 70, y: 470 }); depLead.setAttribute('d', `M96 466 L${f1(dxs - 4)} ${f1((dy + db) / 2)}`);
      } else if (ph === 1) { // 파장: 두 마루의 수직 보조선 + 사이의 양방향 화살표(현재), 바로 위에 처음 파장(점선)
        const b = crestTop(phiInv(OM * t - PH0 + TAU * (track.n - 1)));
        if (b) {
          const bx = toX(b.x), by = toY(b.y), yt = Math.min(cy, by) - 46;
          mkRear.setAttribute('transform', `translate(${f1(bx)},${f1(by - 5)})`);
          lenGuide.setAttribute('d', `M${f1(cx)} ${f1(cy - 18)}L${f1(cx)} ${f1(yt - 24)}M${f1(bx)} ${f1(by - 18)}L${f1(bx)} ${f1(yt - 24)}`);
          lenNow.setAttribute('d', arrowD(bx, yt, cx, yt, 8)); lenFirst.setAttribute('d', `M${f1(cx - track.L0 * 960 / view[2])} ${f1(yt - 20)}L${f1(cx)} ${f1(yt - 20)}`);
          attr(lenNowT, { x: f1(cx + 10), y: f1(yt + 4) }); attr(lenFirstT, { x: f1(cx + 10), y: f1(yt - 16) });
          attr(lenLabel, { x: 480, y: 170 }); lenLead.setAttribute('d', `M480 178 L${f1((bx + cx) / 2)} ${f1(yt - 6)}`);
        }
        show(mkRear, !!b);
      } else if (ph === 2) { // 파고: 골 ~ 마루 세로 양방향 화살표 + 가로 보조선, 오른쪽 위 비교 막대
        let it = c.i, worst = -1e9; for (let i = c.i; i < Math.min(SX.length, c.i + 60); i++) { if (SX[i] - SX[c.i] > .9 * TAU / c.k) break; if (SY[i] > worst) { worst = SY[i]; it = i; } }
        const ty = toY(SY[it]), ax = cx - 26;
        htNow.setAttribute('d', dArrowV(ax, cy, ty)); htGuide.setAttribute('d', `M${f1(ax - 8)} ${f1(cy)}L${f1(cx + 2)} ${f1(cy)}M${f1(ax - 8)} ${f1(ty)}L${f1(toX(SX[it]))} ${f1(ty)}`);
        attr(htLabel, { x: 560, y: 170 }); htLead.setAttribute('d', `M560 178 L${f1(ax - 4)} ${f1((cy + ty) / 2)}`);
        const sc = 70 / track.H0, hN = ratio.H * track.H0 * sc, hF = track.H0 * sc;
        attr(cmpFirst, { y: f1(104 - hF), height: f1(hF) }); attr(cmpNow, { y: f1(104 - hN), height: f1(hN) });
      } else if (ph === 3) { // 부서짐: 짧은 설명 + 연결선 (화면 여백 고정, 끝만 마루를 따라감)
        let it = c.i; for (let i = c.i; i < Math.min(SX.length, c.i + 14); i++) { if (SY[i] > c.y + .55 * c.H) break; if (SX[i] > SX[it]) it = i; } // 마루 끝 (앞면 위쪽에서 가장 앞으로 나간 점)
        const nx = 640, ny = 150; brkNote.setAttribute('transform', `translate(${nx},${ny})`);
        brkLead.setAttribute('d', `M${f1(nx - brkNote.w / 2 + 10)} ${ny + 11} L${f1(toX(SX[it]))} ${f1(toY(SY[it]) - 6)}`);
      }
    }
    show(gSpd, ph === 0 && !!c); show(gDep, ph === 0 && !!c); show(gLen, ph === 1 && !!c); show(gHt, ph === 2 && !!c); show(gBrk, ph === 3 && !!c);
    if (ph !== 1) show(mkRear, false);
    if (ph !== phase) {
      phase = ph;
      checkEls.forEach((li, i) => { li.classList.toggle('now', i === ph); li.classList.toggle('done', i < ph); });
      if (stage === 2) setExplain(ph < 0 ? TX.cap[2] : TX.cap3[ph]);
    }
    syncBars();
  }
  /* 쇄파 순간 확대: 부서지는 마루와 그 앞 수면 중심(쇄파 지점 기준), 1.7배, 하늘·해저 비중을 줄임. 캔버스·뒤 SVG 에 같은 viewBox */
  function zoomView() {
    let z = 1;
    if (stage === 2 && track) z = 1 + .7 * sm(track.ts0 - .6, track.ts0 + .6, t) * (1 - sm(track.ts1 - .4, track.ts1 + 1.4, t));
    const w = 960 / z, h = 540 / z, cx = XB - camX + 40, cy = Y0 + 6;
    view = z === 1 ? [0, 0, 960, 540] : [clamp(cx - w / 2, 0, 960 - w), clamp(cy - h / 2, 0, 540 - h), w, h];
    const vb = view.map(v => +v.toFixed(1)).join(' ');
    if (vb !== zoom) { zoom = vb; svg.setAttribute('viewBox', vb); }
  }
  let camStr = '';
  function render(dt) {
    if (state === 'play' && stage === 2 && track && t >= track.ts0 && t < track.ts1) dt *= SLOW; // 넘어가는 순간은 느리게 (수면·거품·표시·설명·막대 모두 같은 시간 기준)
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
    surface(); whitecaps(dt); zoomView(); drawCanvas(); annotate(); syncProgress();
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
  // 속도·파장·파고 항목에는 막대 (길이 = 현재 값 ÷ 처음 값, 눈금 = 처음)
  checks.innerHTML = TX.checks.map((c, i) => `<li data-n="${i + 1}"><button type="button" class="ck-btn">${c}</button>${i < 3 ? `<span class="ck-bar"><i></i><b></b>${i === 0 ? `<small>${TX.first}</small>` : ''}</span>` : ''}</li>`).join('');
  stepEls[2].appendChild(checks);
  const checkEls = Array.from(checks.children), bars = stepEls.map(li => li.querySelector('.st-bar i')), barW = [];
  const ckBars = checkEls.slice(0, 3).map(li => li.querySelector('.ck-bar i')), ckW = [];
  const BAR_MAX = 1.4; // 막대 끝 = 140 % (처음 100 % 눈금은 CSS 에서 같은 비율로)
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
    track = null; phase = -1; checkEls.forEach(li => li.classList.remove('now', 'done'));
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
