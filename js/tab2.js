/* 탭2: 물 입자의 운동 — 갈매기 하나가 해파를 따라 원 궤도를 한 바퀴 도는 모습을 크게 관찰.
   정지 화면 → '예측하기' → 예측 창에서 고르고 '관찰 시작' → 재생 (한 바퀴를 마치면 처음 위치에서 잠깐 멈춘 뒤 반복)
   → 첫 바퀴가 끝나면 해설 카드에 예측 결과·해설.
   수면은 수면의 물 입자들이 원 궤도 위에서 이루는 곡선(트로코이드)으로 그려, 수면 입자인 갈매기가 늘 수면 위에 놓임.
   카메라·궤도 중심 고정. 그림 칸 비율에 맞춰 viewBox 폭만 바꾸고 높이(VH)는 고정 */
/* ================= 탭2: 물 입자의 운동 ================= */
(function () {
  const TX = TEXT.tab2; // 이 탭의 문구
  const svg = $('#svg2'), stage = $('#stage2');
  const VH = 300, Y0 = 160, R = 42, KA = .4;   // 보이는 높이, 평균 수면, 궤도 반지름(= 파고의 1/2), 파형의 가파른 정도 kR (파고/파장 ≈ 0.13)
  const K = KA / R, L = 2 * Math.PI / K, T = 5, C = L / T;
  const SLOW = .6, TURN = 1.4;                 // 관찰 재생 배속, 한 바퀴 뒤 처음 위치에서 멈추는 시간 (s)
  const GS = 1;                                // 갈매기 그림 배율 (몸길이 ≈ 궤도 지름)
  const RED = '#E8553E', INK = '#24303A';
  const f1 = v => v.toFixed(1);
  /* 그림 순서: 하늘 → 수면 → 궤도(점선) → 지나온 궤적 → 갈매기 → 처음 위치 표시 → 이동 방향 화살표 */
  const skyG = E('g'); svg.appendChild(skyG);
  const water = E('path', { fill: 'url(#s2-water)', stroke: INK, 'stroke-linejoin': 'round' }); svg.appendChild(water);
  const orbitG = E('g'); svg.appendChild(orbitG);
  const orbit = E('circle', { cy: Y0, r: R, fill: 'none', stroke: INK, opacity: .45 }); orbitG.appendChild(orbit);
  const trailBack = E('polyline', { fill: 'none', stroke: INK, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const trail = E('polyline', { fill: 'none', stroke: RED, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  orbitG.append(trailBack, trail);
  const gull = drawGull(); svg.appendChild(gull);
  const markG = E('g'); svg.appendChild(markG);
  const home = E('circle', { cy: Y0, fill: '#fff', stroke: RED }); markG.appendChild(home);
  const arcBack = E('path', { fill: 'none', stroke: INK, 'stroke-linecap': 'round' }), arc = E('path', { fill: 'none', stroke: RED, 'stroke-linecap': 'round' });
  const head = E('path', { fill: RED, stroke: INK, 'stroke-linejoin': 'round' });
  markG.append(arcBack, arc, head);
  $('#dir2 span').textContent = TX.dir;
  const mom = $('#mom2');
  let W = 0, xg = 0, sf = 1, pxu = 1, tt = 0, hold = 0, started = false, revealed = false, predicted = null, choice = null, momKey = '';
  const setCap = explainCard($('#ex2'));
  const pred = $('#pred2'), cta = $('#t2-predict'), go = $('#pred2-go'), chip = $('#chip2'), turnBtn = $('#t2-turn');
  turnBtn.textContent = TX.turn;

  /* 선 굵기: 넓은 화면에서 확대된 만큼 줄여 다른 탭과 비슷한 굵기로 (폰에서는 그대로) */
  const strokes = [];
  const keepStroke = (el, w) => { strokes.push([el, w]); };
  [[water, 4], [orbit, 2.5], [trailBack, 7.5], [trail, 4], [home, 2.5], [arcBack, 7.5], [arc, 4], [head, 2]].forEach(([el, w]) => keepStroke(el, w));
  gull.querySelectorAll('[stroke-width]').forEach(el => keepStroke(el, +el.getAttribute('stroke-width')));
  function applyStrokes() {
    strokes.forEach(([el, w]) => el.setAttribute('stroke-width', f1(w * sf)));
    orbit.setAttribute('stroke-dasharray', `${f1(6 * sf)} ${f1(6 * sf)}`);
    home.setAttribute('r', f1(5 * sf));
  }

  /* 그림 칸 비율이 바뀌면 viewBox 폭을 맞추고 궤도를 가운데에 둠. 가로·세로 축척은 항상 같음 */
  function layout(w) {
    W = w; xg = Math.round(W / 2); svg.setAttribute('viewBox', `0 0 ${W} ${VH}`);
    skyG.innerHTML = ''; drawSky(skyG, 's2', { w: W });
    skyG.querySelector('.sun').remove();                     // 하늘 장식은 작은 구름 하나만 (넓은 화면)
    const clouds = skyG.lastChild; clouds.lastChild.remove();
    clouds.setAttribute('transform', `translate(${f1(W * .2)},56) scale(.5) translate(-176,-102)`);
    clouds.style.display = W / VH >= 2 ? '' : 'none';
    orbit.setAttribute('cx', xg); home.setAttribute('cx', xg - R);
    render(0);
  }
  function fit() {
    const sw = stage.clientWidth, sh = stage.clientHeight, r = sw / sh;
    if (!isFinite(r) || r <= 0) return;      // 탭이 숨어 있으면 크기가 0
    if (pred.hidden || innerWidth > 600) {   // 폰에서 예측 창 때문에 그림 칸이 늘어난 동안에는 배치를 바꾸지 않음
      const w = Math.round(VH * clamp(r, 16 / 9, 3));
      pxu = Math.max(sw / w, sh / VH); sf = Math.min(1, 1.4 / pxu);
      applyStrokes();
      if (w !== W) layout(w);
    }
    placePredict();
  }
  /* 예측 창은 갈매기를 가리지 않도록 궤도 오른쪽에 두고, 자리가 모자라면 가운데에 둠 */
  function placePredict() {
    const sw = stage.clientWidth, gx = sw / 2 + R * pxu, side = innerWidth >= 900 && sw - gx - 40 >= 340;
    pred.classList.toggle('side', side);
    pred.style.paddingLeft = side ? `${Math.round(gx + 40)}px` : '';
  }

  /* 궤도 위의 점: 출발(ψ = 0)은 궤도 왼쪽(①), 시계 방향으로 ψ 만큼 돈 자리 */
  const onOrbit = psi => [xg - R * Math.cos(psi), Y0 - R * Math.sin(psi)];
  function render(dt) {
    if (started) {
      if (hold > 0) { hold = Math.max(0, hold - dt); if (!hold) tt = 0; }   // 처음 위치에서 멈춘 뒤 다음 바퀴 (해파 모양은 한 주기 뒤와 같음)
      else {
        tt += dt * SLOW;
        if (tt >= T) {
          tt = T; hold = TURN;
          if (!revealed) { revealed = true; setCap(TX.capReveal(predicted)); }
        }
      }
    }
    const psi = 2 * Math.PI * tt / T;
    // 수면: 쉴 때 a 에 있던 물 입자가 반지름 R 의 원 위 (위상 θ) 에 있음. 갈매기(a = xg)도 이 입자 중 하나
    const s = xg - Math.PI / 2 / K + C * tt, step = 5, a0 = xg - step * Math.ceil((xg + R + 30) / step);
    let d = '';
    for (let a = a0; a <= W + R + 30; a += step) { const th = K * (a - s); d += (d ? 'L' : 'M') + f1(a - R * Math.sin(th)) + ' ' + f1(Y0 - R * Math.cos(th)); }
    water.setAttribute('d', d + `L${W + R + 30} ${VH + 40}L${a0} ${VH + 40}Z`);
    const [x, y] = onOrbit(psi);
    gull.setAttribute('transform', `translate(${f1(x)},${f1(y)}) scale(${GS})`);
    // 관찰 표시 (예측 전에는 숨겨 정답이 드러나지 않게)
    orbitG.style.display = markG.style.display = started ? '' : 'none';
    mom.hidden = !started;
    if (!started) return;
    const pts = []; for (let q = 0; q < psi; q += .06) pts.push(onOrbit(q)); pts.push([x, y]);
    const pl = pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ');
    trail.setAttribute('points', pl); trailBack.setAttribute('points', pl);
    // 이동 방향: 갈매기 바로 앞의 궤도를 따라 굽은 화살표 (궤도상의 위치에 따라 방향이 바뀜)
    const p1 = onOrbit(psi + .32), p2 = onOrbit(psi + 1.15), ad = `M${f1(p1[0])} ${f1(p1[1])}A${R} ${R} 0 0 1 ${f1(p2[0])} ${f1(p2[1])}`;
    arc.setAttribute('d', ad); arcBack.setAttribute('d', ad);
    const ux = Math.sin(psi + 1.15), uy = -Math.cos(psi + 1.15), hl = Math.max(11 * sf, 8 / pxu), hw = hl * .6;
    const tip = [p2[0] + ux * hl * .6, p2[1] + uy * hl * .6];
    head.setAttribute('d', `M${f1(tip[0])} ${f1(tip[1])}L${f1(tip[0] - ux * hl - uy * hw)} ${f1(tip[1] - uy * hl + ux * hw)}L${f1(tip[0] - ux * hl + uy * hw)} ${f1(tip[1] - uy * hl - ux * hw)}Z`);
    // 화면 아래 한 줄: 가장 가까운 순간 (①~④), 한 바퀴를 마치고 멈춘 동안은 '처음 위치'
    const k = hold > 0 ? -1 : Math.floor((psi + Math.PI / 4) / (Math.PI / 2)) % 4;
    const key = String(k);
    if (key !== momKey) { momKey = key; mom.innerHTML = k < 0 ? TX.back : `<b>${TX.nums[k]}</b>${TX.moments[k]}`; }
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
    ['#t2-turn', '#t2-pause', '#t2-again'].forEach(id => { $(id).disabled = !started; });
  }
  function openPredict() { pred.hidden = false; placePredict(); syncChoices(); syncControls(); (choiceBtns.find(b => b.dataset.v === choice) || choiceBtns[0]).focus(); }
  function closePredict() { pred.hidden = true; syncControls(); }
  function startObserve() {
    if (!choice) return;
    predicted = choice; started = true; revealed = false; tt = 0; hold = 0;
    chip.hidden = false; chip.textContent = TX.chip + TX.keys[predicted];
    closePredict(); setPaused(false); setCap(TX.capObserve(predicted)); render(0);
  }
  function reset() {
    started = false; revealed = false; predicted = null; choice = null; tt = 0; hold = 0;
    chip.hidden = true; pred.hidden = true; setCap(''); syncChoices(); syncControls(); render(0);
  }
  cta.onclick = openPredict;
  $('#pred2-close').onclick = () => { closePredict(); cta.focus(); };
  go.onclick = startObserve;
  pred.addEventListener('keydown', e => { if (e.key === 'Escape') { closePredict(); cta.focus(); } });
  $('#t2-again').onclick = reset;
  turnBtn.onclick = () => { tt = 0; hold = 0; setPaused(false); render(0); }; // 한 바퀴 다시 보기: 처음 위치(①)부터
  registerPauseBtn($('#t2-pause'));
  layout(Math.round(VH * 2.2)); applyStrokes(); reset();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage); else addEventListener('resize', fit);
  frames['2'] = render;
})();
