/* 탭2: 물 입자의 운동 — 갈매기 예측 → 관찰 → 자막 공개, 궤적/깊이별 입자/번호 토글 */
/* ================= 탭2: 물 입자의 운동 ================= */
(function () {
  const TX = TEXT.tab2; // 이 탭의 문구
  const svg = $('#svg2'); drawSky(svg, 's2');
  const PX = 4, Y0 = 215, T = 5;
  const S = { L: 80, H: 8 };
  const water = E('path', { fill: 'url(#s2-water)', stroke: '#24303A', 'stroke-width': 4, 'stroke-linejoin': 'round' }); svg.appendChild(water);
  // 진행 방향 화살표
  svg.appendChild(E('g', { transform: 'translate(480,112)' }, [
    E('path', { d: 'M-60 0 L40 0 M40 0 L22 -14 M40 0 L22 14', stroke: '#24303A', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }),
    E('path', { d: 'M-60 0 L40 0 M40 0 L22 -14 M40 0 L22 14', stroke: '#E8553E', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }),
  ]));
  const pDir = pill(TX.dir, { fs: 16, pad: 8 }); pDir.move(470, 80); svg.appendChild(pDir.g);
  // 깊이 자 + L/2 기준선
  const halfLine = E('path', { stroke: '#fff', 'stroke-width': 2.5, 'stroke-dasharray': '10 8', fill: 'none', opacity: .85 }); svg.appendChild(halfLine);
  const pHalf = pill(TX.half, { fs: 15, pad: 8 }); svg.appendChild(pHalf.g);
  const rulerLine = E('path', { stroke: '#24303A', 'stroke-width': 3, fill: 'none' }); svg.appendChild(rulerLine);
  const pR0 = pill(TX.ruler[0], { fs: 14, pad: 8 }), pR1 = pill(TX.ruler[1], { fs: 14, pad: 8 }), pR2 = pill(TX.ruler[2], { fs: 14, pad: 8, bg: '#FFE082' });
  [pR0, pR1, pR2].forEach(p => svg.appendChild(p.g));
  const COLS = [200, 480, 760], FR = [0, 1 / 8, 1 / 4, 3 / 8, 1 / 2];
  const orbitG = E('g'), trail = E('polyline', { fill: 'none', stroke: '#E8553E', 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), numG = E('g'), dotG = E('g');
  svg.appendChild(orbitG); svg.appendChild(trail); svg.appendChild(numG); svg.appendChild(dotG);
  const items = [];
  COLS.forEach((x0, ci) => FR.forEach((f, ri) => {
    const isGull = ci === 1 && ri === 0;
    const circ = E('circle', { fill: 'none', stroke: isGull ? '#E8553E' : '#24303A', 'stroke-width': ri ? 2 : 2.5, 'stroke-dasharray': '5 5', opacity: .85 });
    const dot = ri ? E('g', {}, [E('circle', { r: 5.5, fill: '#5B9BD5', stroke: '#24303A', 'stroke-width': 2.5 })]) : (isGull ? drawGull() : drawFoam());
    items.push({ x0, f, ri, ci, circ, dot, isGull }); orbitG.appendChild(circ); dotG.appendChild(dot);
  }));
  const nums = TX.nums.map(t => { const p = pill(t, { fs: 15, pad: 6, bg: '#FFE082' }); numG.appendChild(p.g); return p; });
  let s = 0, tt = 0, pts = [], started = false, predicted = null, revealed = false, view = { trail: true, deep: true, num: true };
  const setCap = h => { $('#cap2').innerHTML = hangCap(h); };

  function render(dt) {
    const Lpx = S.L * PX, k = 2 * Math.PI / Lpx, c = Lpx / T, A = S.H / 2 * PX;
    if (started) { s += c * dt; tt += dt; }
    const eta = x => A * Math.cos(k * (x - s));
    let d = `M-20 ${(Y0 - eta(-20)).toFixed(1)}`;
    for (let x = -12; x <= 984; x += 6) d += `L${x} ${(Y0 - eta(x)).toFixed(1)}`;
    d += 'L984 600L-20 600Z'; water.setAttribute('d', d);
    // 자·기준선
    const yh = Y0 + Lpx / 2;
    attr(rulerLine, { d: `M90 ${Y0} L90 ${yh + 14} M78 ${Y0} L102 ${Y0} M78 ${Y0 + Lpx / 4} L102 ${Y0 + Lpx / 4} M78 ${yh} L102 ${yh}` });
    pR0.move(46, Y0); pR1.move(46, Y0 + Lpx / 4); pR2.move(46, yh);
    attr(halfLine, { d: `M120 ${yh} L960 ${yh}` }); pHalf.move(760, yh - 22);
    items.forEach(it => {
      const z = it.f * Lpx, r = A * Math.exp(-k * z), y0 = Y0 + z, th = k * (it.x0 - s);
      const x = it.x0 - r * Math.sin(th), y = y0 - r * Math.cos(th);
      attr(it.circ, { cx: it.x0, cy: y0, r: Math.max(r, .6) });
      it.dot.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      const show = it.ri === 0 || view.deep;
      it.circ.style.display = show ? '' : 'none'; it.dot.style.display = show ? '' : 'none';
      if (it.isGull) {
        if (started) { pts.push({ x, y, t: tt }); while (pts.length && tt - pts[0].t > T * .92) pts.shift(); }
        trail.setAttribute('points', view.trail ? pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : '');
        const R = A + 46;
        [[-R - 6, 0], [0, -R - 8], [R + 4, 0], [0, R - 8]].forEach(([dx, dy], i) => nums[i].move(it.x0 + dx, y0 + dy));
        numG.style.display = view.num ? '' : 'none';
      }
    });
    if (started && !revealed && tt > T * 1.6) {
      revealed = true;
      setCap(TX.capReveal(predicted));
    }
  }
  function info() {
    $('#v2-L').textContent = S.L + ' m'; $('#v2-H').textContent = S.H + ' m';
    $('#info2').innerHTML = TX.info(S);
  }
  const reset = () => { started = false; revealed = false; predicted = null; pts = []; tt = 0; $('#pred2').hidden = false; $('#chip2').hidden = true; setCap(TX.capPredict); };
  $$('#pred2 .pbtns .btn').forEach(b => b.onclick = () => {
    predicted = b.dataset.v; $('#pred2').hidden = true; const chip = $('#chip2'); chip.hidden = false; chip.textContent = TX.chip + b.textContent.trim().slice(0, 1);
    started = true; tt = 0; pts = [];
    setCap(TX.capObserve);
  });
  $('#t2-again').onclick = reset;
  [['trail', '#t2-trail'], ['deep', '#t2-deep'], ['num', '#t2-num']].forEach(([key, id]) => { $(id).onclick = e => { view[key] = !view[key]; e.currentTarget.classList.toggle('on', view[key]); }; });
  ['L', 'H'].forEach(key => { const r = $('#r2-' + key); r.addEventListener('input', () => { S[key] = +r.value; pts = []; info(); }); });
  registerPauseBtn($('#t2-pause'));
  info(); reset(); render(0);
  frames['2'] = render;
})();
