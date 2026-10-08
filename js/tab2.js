/* 탭2: 물 입자의 운동 — 정지 화면 → '예측하기' → 예측 창에서 고르고 '관찰 시작' → 재생 → 해설 카드에 예측 결과·해설,
   궤적/깊이별 입자/번호 토글. 파장·파고는 기본값 고정, 그림 축척은 가로·세로 같게(1 m = 4 px) 두고
   그림 칸의 실제 비율에 맞춰 viewBox 폭을 바꿔 입자 기둥을 넓게 배치 (찌그러짐·잘림 없음).
   넓은 화면(가로 ÷ 세로 ≥ 2)에서는 빈 하늘·깊은 바다를 덜 보여 주어(세로 40~460) 입자 운동을 크게 보여 줌 */
/* ================= 탭2: 물 입자의 운동 ================= */
(function () {
  const TX = TEXT.tab2; // 이 탭의 문구
  const svg = $('#svg2'), stage = $('#stage2');
  const PX = 4, Y0 = 215, T = 5;
  const S = { L: 80, H: 8 };
  const Lpx = S.L * PX, k = 2 * Math.PI / Lpx, c = Lpx / T, A = S.H / 2 * PX;
  const TH0 = Math.PI / 2;                  // 처음 정지 화면에서 갈매기는 ① 위치
  const FR = [0, 1 / 8, 1 / 4, 3 / 8, 1 / 2];
  const skyG = E('g'); svg.appendChild(skyG);
  const water = E('path', { fill: 'url(#s2-water)', stroke: '#24303A', 'stroke-width': 4, 'stroke-linejoin': 'round' }); svg.appendChild(water);
  // 진행 방향 화살표
  const dirG = E('g', {}, [
    E('path', { d: 'M-60 0 L40 0 M40 0 L22 -14 M40 0 L22 14', stroke: '#24303A', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }),
    E('path', { d: 'M-60 0 L40 0 M40 0 L22 -14 M40 0 L22 14', stroke: '#E8553E', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }),
  ]); svg.appendChild(dirG);
  const pDir = pill(TX.dir, { fs: 16, pad: 8 }); svg.appendChild(pDir.g);
  // 깊이 자 + L/4·L/2 기준선
  const yq = Y0 + Lpx / 4, yh = Y0 + Lpx / 2;
  const quarterLine = E('path', { stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '4 9', fill: 'none', opacity: .55 }); svg.appendChild(quarterLine);
  const halfLine = E('path', { stroke: '#fff', 'stroke-width': 2.5, 'stroke-dasharray': '10 8', fill: 'none', opacity: .85 }); svg.appendChild(halfLine);
  const pHalf = pill(TX.half, { fs: 15, pad: 8 }); svg.appendChild(pHalf.g);
  svg.appendChild(E('path', { stroke: '#24303A', 'stroke-width': 3, fill: 'none', d: `M90 ${Y0} L90 ${yh + 14} M78 ${Y0} L102 ${Y0} M78 ${yq} L102 ${yq} M78 ${yh} L102 ${yh}` }));
  [[TX.ruler[0], Y0, '#FFFDF8'], [TX.ruler[1], yq, '#FFFDF8'], [TX.ruler[2], yh, '#FFE082']].forEach(([t, y, bg]) => { const p = pill(t, { fs: 14, pad: 8, bg }); p.move(46, y); svg.appendChild(p.g); });
  const orbitG = E('g'), trail = E('polyline', { fill: 'none', stroke: '#E8553E', 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), numG = E('g'), dotG = E('g');
  svg.appendChild(orbitG); svg.appendChild(trail); svg.appendChild(numG); svg.appendChild(dotG);
  const nums = TX.nums.map(t => { const p = pill(t, { fs: 15, pad: 6, bg: '#FFE082' }); numG.appendChild(p.g); return p; });
  let W = 0, VY = 0, VH = 540, xg = 0, items = [];
  let tt = 0, pts = [], started = false, revealed = false, predicted = null, choice = null, view = { trail: true, deep: true, num: true };
  const setCap = explainCard($('#ex2'));
  const pred = $('#pred2'), cta = $('#t2-predict'), go = $('#pred2-go'), chip = $('#chip2');

  /* 그림 칸 비율이 바뀌면 viewBox(보이는 범위)를 맞추고 기둥을 다시 배치. 가로·세로 축척은 항상 같음 */
  function layout(w, vy, vh) {
    W = w; VY = vy; VH = vh; svg.setAttribute('viewBox', `0 ${VY} ${W} ${VH}`);
    // 입자 기둥: 깊이 자 오른쪽(170 ~ W−60)에 홀수 개를 고르게, 가운데가 갈매기
    const x1 = 170, x2 = W - 60, n = 2 * Math.max(1, Math.round((x2 - x1) / 400)) + 1, gap = (x2 - x1) / (n - 1);
    const cols = Array.from({ length: n }, (_, i) => Math.round(x1 + gap * i));
    xg = cols[(n - 1) / 2];
    skyG.innerHTML = ''; drawSky(skyG, 's2', { w: W, sunX: W - 170, sunY: VY ? 100 : 80, cloud2Dx: xg + 100 - 558 });
    dirG.setAttribute('transform', `translate(${xg - 120},112)`); pDir.move(xg - 130, 80);
    attr(quarterLine, { d: `M120 ${yq} L${W} ${yq}` }); attr(halfLine, { d: `M120 ${yh} L${W} ${yh}` });
    pHalf.move(cols.length > 1 ? (cols[cols.length - 1] + cols[cols.length - 2]) / 2 : W - 200, yh - 22);
    orbitG.innerHTML = ''; dotG.innerHTML = ''; items = []; pts = [];
    cols.forEach(x0 => FR.forEach((f, ri) => {
      const isGull = x0 === xg && ri === 0;
      const circ = E('circle', { fill: 'none', stroke: isGull ? '#E8553E' : '#24303A', 'stroke-width': ri ? 2 : 2.5, 'stroke-dasharray': '5 5', opacity: .85 });
      const dot = ri ? E('g', {}, [E('circle', { r: 5.5, fill: '#5B9BD5', stroke: '#24303A', 'stroke-width': 2.5 })]) : (isGull ? drawGull() : drawFoam());
      items.push({ x0, f, ri, circ, dot, isGull }); orbitG.appendChild(circ); dotG.appendChild(dot);
    }));
    render(0);
  }
  function fit() {
    const r = stage.clientWidth / stage.clientHeight;
    if (!isFinite(r) || r <= 0) return;      // 탭이 숨어 있으면 크기가 0
    if (pred.hidden || innerWidth > 600) {   // 폰에서 예측 창 때문에 그림 칸이 늘어난 동안에는 배치를 바꾸지 않음
      const a = clamp(r, 16 / 9, 3), vh = a >= 2 ? 420 : 540, w = Math.round(vh * a);
      if (w !== W || vh !== VH) layout(w, a >= 2 ? 40 : 0, vh);
    }
    placePredict();
  }
  /* 예측 창은 갈매기를 가리지 않도록 갈매기 오른쪽에 두고, 자리가 모자라면 가운데에 둠 */
  function placePredict() {
    const sw = stage.clientWidth, gx = sw * xg / W, side = innerWidth >= 900 && sw - gx - 68 >= 340;
    pred.classList.toggle('side', side);
    pred.style.paddingLeft = side ? `${Math.round(gx + 56)}px` : '';
  }

  function render(dt) {
    if (started) tt += dt;
    const s = xg - TH0 / k + c * tt;         // 갈매기 위상 θ = k(x₀ − s): tt = 0 일 때 ① 위치
    const eta = x => A * Math.cos(k * (x - s));
    let d = `M-20 ${(Y0 - eta(-20)).toFixed(1)}`;
    for (let x = -12; x <= W + 24; x += 6) d += `L${x} ${(Y0 - eta(x)).toFixed(1)}`;
    d += `L${W + 24} 600L-20 600Z`; water.setAttribute('d', d);
    // 예측 전에는 궤도·궤적·위치 번호를 숨겨 정답이 드러나지 않게 함
    orbitG.style.display = started ? '' : 'none';
    numG.style.display = started && view.num ? '' : 'none';
    items.forEach(it => {
      const z = it.f * Lpx, r = A * Math.exp(-k * z), y0 = Y0 + z, th = k * (it.x0 - s);
      const x = it.x0 - r * Math.sin(th), y = y0 - r * Math.cos(th);
      attr(it.circ, { cx: it.x0, cy: y0, r: Math.max(r, .6) });
      it.dot.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      const show = it.ri === 0 || view.deep;
      it.circ.style.display = show ? '' : 'none'; it.dot.style.display = show ? '' : 'none';
      if (it.isGull) {
        if (started) { pts.push({ x, y, t: tt }); while (pts.length && tt - pts[0].t > T * .92) pts.shift(); }
        trail.setAttribute('points', started && view.trail ? pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : '');
        // ①왼쪽 ②위 ③오른쪽 ④아래: ④는 바로 아래 L/8 입자와 겹치지 않게 오른쪽 아래에 둠
        const R = A + 46;
        [[-R - 6, 0], [0, -R - 8], [R + 4, 0], [30, A + 18]].forEach(([dx, dy], i) => nums[i].move(it.x0 + dx, y0 + dy));
      }
    });
    if (started && !revealed && tt > T * 1.6) {
      revealed = true;
      setCap(TX.capReveal(predicted, S));
    }
  }

  /* ---- 예측 → 관찰 흐름 ---- */
  $('#pred2-q').textContent = TX.question;
  const choiceBtns = Object.keys(TX.choices).map(v => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pchoice'; b.dataset.v = v;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
    b.innerHTML = `<span class="pk">${TX.keys[v]}</span><span>${TX.choices[v]}</span>`;
    b.onclick = () => { choice = v; syncChoices(); };
    $('#pred2-choices').appendChild(b); return b;
  });
  function syncChoices() {
    choiceBtns.forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === choice)));
    go.disabled = !choice;
  }
  function syncControls() {
    cta.hidden = started || !pred.hidden;
    ['#t2-trail', '#t2-num', '#t2-pause', '#t2-again'].forEach(id => { $(id).disabled = !started; });
  }
  function openPredict() { pred.hidden = false; placePredict(); syncChoices(); syncControls(); (choiceBtns.find(b => b.dataset.v === choice) || choiceBtns[0]).focus(); }
  function closePredict() { pred.hidden = true; syncControls(); }
  function startObserve() {
    if (!choice) return;
    predicted = choice; started = true; revealed = false; tt = 0; pts = [];
    chip.hidden = false; chip.textContent = TX.chip + TX.keys[predicted];
    closePredict(); setPaused(false); setCap(TX.capObserve(predicted));
  }
  function reset() {
    started = false; revealed = false; predicted = null; choice = null; tt = 0; pts = [];
    chip.hidden = true; pred.hidden = true; setCap(''); syncChoices(); syncControls(); render(0);
  }
  cta.onclick = openPredict;
  $('#pred2-close').onclick = () => { closePredict(); cta.focus(); };
  go.onclick = startObserve;
  pred.addEventListener('keydown', e => { if (e.key === 'Escape') { closePredict(); cta.focus(); } });
  $('#t2-again').onclick = reset;
  [['trail', '#t2-trail'], ['deep', '#t2-deep'], ['num', '#t2-num']].forEach(([key, id]) => bindToggle($(id), v => { view[key] = v; if (!started) render(0); }));
  registerPauseBtn($('#t2-pause'));
  layout(1176, 40, 420); reset();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage); else addEventListener('resize', fit);
  frames['2'] = render;
})();
