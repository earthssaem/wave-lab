/* 탭3: 심해파·천이파·천해파 — 파장·수심으로 판정, 속도 카드, 비선형 깊이 자 */
/* ================= 탭3: 심해파·천이파·천해파 ================= */
(function () {
  const TX = TEXT.tab3; // 이 탭의 문구
  const svg = $('#svg3'); drawSky(svg, 's3', { cloudDy: -46, sunY: 46 });
  const YS = 110, LPX = 320, A0 = 12, T = 4, TAU = 2 * Math.PI;
  const S = { L: 60, h: 40 };
  const f = r => r <= 0 ? 0 : 262 * Math.pow(r / .5, .6);
  const water = E('path', { fill: 'url(#s3-water)', stroke: '#24303A', 'stroke-width': 4, 'stroke-linejoin': 'round' }); svg.appendChild(water);
  const floor = E('path', { fill: '#E6C377', stroke: '#24303A', 'stroke-width': 4, 'stroke-linejoin': 'round' }); svg.appendChild(floor);
  const floorDots = E('g'); svg.appendChild(floorDots);
  const pFloor = pill(TX.floor, { fs: 15, pad: 8, bg: '#E6C377' }); svg.appendChild(pFloor.g);
  const pFloorFar = pill(TX.floorFar, { fs: 15, pad: 8, bg: '#E6C377' }); svg.appendChild(pFloorFar.g);
  // 깊이 자: 해저면이 어느 색 구간에 있는지로 판정
  const rx = 62, rw = 18;
  const y05 = YS + f(.05), y50 = YS + f(.5);
  svg.appendChild(E('rect', { x: rx, y: YS, width: rw, height: y05 - YS, fill: '#6AAE78', stroke: '#24303A', 'stroke-width': 2.5 }));
  svg.appendChild(E('rect', { x: rx, y: y05, width: rw, height: y50 - y05, fill: '#E0A93B', stroke: '#24303A', 'stroke-width': 2.5 }));
  svg.appendChild(E('rect', { x: rx, y: y50, width: rw, height: 560 - y50, fill: '#5B9BD5', stroke: '#24303A', 'stroke-width': 2.5 }));
  [[TX.ruler[0], YS, '#fff'], [TX.ruler[1], y05, '#FFE082'], [TX.ruler[2], y50, '#FFE082']].forEach(([t, y, bg]) => { const p = pill(t, { fs: 13, pad: 6, bg }); p.move(34, y); svg.appendChild(p.g); });
  [[TX.zones[0], (YS + y05) / 2, '#6AAE78'], [TX.zones[1], (y05 + y50) / 2, '#E0A93B'], [TX.zones[2], y50 + 20, '#5B9BD5']].forEach(([t, y, bg]) => { const p = pill(t, { fs: 13, pad: 6, bg, color: '#fff' }); p.move(116, y); svg.appendChild(p.g); });
  const pRuler = pill(TX.rulerTitle, { fs: 13, pad: 6 }); pRuler.move(88, YS - 26); svg.appendChild(pRuler.g);
  const marker = E('path', { d: 'M0 0 L16 -9 L16 9 Z', fill: '#E6C377', stroke: '#24303A', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }); svg.appendChild(marker);
  const COLS = [280, 470, 660, 850], ROWS = [0, .02, .05, .1, .15, .2, .3, .4, .5];
  const orbitG = E('g'), dotG = E('g'); svg.appendChild(orbitG); svg.appendChild(dotG);
  const items = [];
  COLS.forEach((x0, ci) => { ROWS.forEach((rz, ri) => {
    const isGull = ci === 1 && ri === 0;
    const el = E('ellipse', { fill: 'none', stroke: isGull ? '#E8553E' : '#24303A', 'stroke-width': ri ? 2 : 2.5, 'stroke-dasharray': '5 5', opacity: .85 });
    const dot = ri ? E('g', {}, [E('circle', { r: 5.5, fill: '#5B9BD5', stroke: '#24303A', 'stroke-width': 2.5 })]) : (isGull ? drawGull() : drawFoam());
    items.push({ x0, rz, ri, el, dot, bottom: false }); orbitG.appendChild(el); dotG.appendChild(dot);
  });
    // 해저면 바로 위 입자 (수평 왕복)
    const el = E('ellipse', { fill: 'none', stroke: '#24303A', 'stroke-width': 2, 'stroke-dasharray': '5 5', opacity: .85 });
    const dot = E('g', {}, [E('circle', { r: 5.5, fill: '#5B9BD5', stroke: '#24303A', 'stroke-width': 2.5 })]);
    items.push({ x0, rz: 0, ri: 99, el, dot, bottom: true }); orbitG.appendChild(el); dotG.appendChild(dot);
  });
  let s = 0, orbitOn = true;
  const cls = () => { const r = S.h / S.L; return r > .5 ? 'deep' : r < .05 ? 'shal' : 'mid'; };

  function render(dt) {
    s += LPX / T * dt;
    const k = TAU / LPX, r = S.h / S.L, kh = TAU * r, sh = Math.sinh(kh);
    const eta = x => A0 * Math.cos(k * (x - s));
    let d = `M-20 ${(YS - eta(-20)).toFixed(1)}`;
    for (let x = -12; x <= 984; x += 6) d += `L${x} ${(YS - eta(x)).toFixed(1)}`;
    d += 'L984 600L-20 600Z'; water.setAttribute('d', d);
    const showFloor = r <= .6; const yb = YS + f(Math.min(r, .6));
    floor.style.display = showFloor ? '' : 'none'; floorDots.style.display = showFloor ? '' : 'none';
    pFloor.g.style.display = showFloor ? '' : 'none'; pFloorFar.g.style.display = showFloor ? 'none' : '';
    if (showFloor) {
      floor.setAttribute('d', `M-20 ${yb} L984 ${yb} L984 600 L-20 600 Z`);
      floorDots.innerHTML = ''; for (let x = 150; x < 960; x += 90) floorDots.appendChild(E('circle', { cx: x + (x % 180 ? 20 : 0), cy: yb + 14 + (x % 270 ? 8 : 0), r: 3, fill: '#D9AD5C', stroke: '#24303A', 'stroke-width': 1.5 }));
      pFloor.move(900, yb + 24); marker.setAttribute('transform', `translate(82,${yb})`);
    } else { pFloorFar.move(560, 516); marker.setAttribute('transform', 'translate(82,548)'); }
    orbitG.style.display = orbitOn ? '' : 'none';
    items.forEach(it => {
      let show, rz, y0;
      if (it.bottom) { show = showFloor; rz = r; y0 = yb - 8; } else { rz = it.rz; show = rz < r * .93 || rz === 0; y0 = YS + f(rz); }
      it.el.style.display = show ? '' : 'none'; it.dot.style.display = show ? '' : 'none';
      if (!show) return;
      let a, b;
      if (kh > 20) { a = b = A0 * Math.exp(-TAU * rz); } else { a = A0 * Math.cosh(kh - TAU * rz) / sh; b = A0 * Math.sinh(kh - TAU * rz) / sh; }
      a = Math.min(a, A0 * 4); if (it.bottom) { b = 0; y0 = yb - 8; }
      const th = k * (it.x0 - s), x = it.x0 - a * Math.sin(th), y = y0 - b * Math.cos(th);
      attr(it.el, { cx: it.x0, cy: y0, rx: Math.max(a, .6), ry: Math.max(b, .6) });
      it.dot.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
    });
  }
  const NAME = TX.NAME, COL = { deep: '#5B9BD5', mid: '#E0A93B', shal: '#6AAE78' };
  function upd() {
    const L = S.L, h = S.h, r = h / L, c = cls(), g = 9.8, k = TAU / L;
    $('#v3-L').textContent = L + ' m'; $('#v3-h').textContent = h + ' m';
    $('#v3-ratio').textContent = r >= 10 ? fmt(r, 0) : r >= 1 ? fmt(r, 1) : fmt(r, 3);
    const badge = $('#cls3'); badge.textContent = NAME[c]; badge.style.background = COL[c]; $('#badge3').textContent = NAME[c];
    $('#cls3-why').innerHTML = TX.why[c](h, L);
    const cf = Math.sqrt(g / k * Math.tanh(k * h)), cd = Math.sqrt(g * L / TAU), cs = Math.sqrt(g * h);
    const eD = Math.abs(cd - cf) / cf, eS = Math.abs(cs - cf) / cf;
    $('#sp-full b').textContent = fmt(cf) + ' m/s';
    $('#sp-deep b').textContent = fmt(cd) + ' m/s'; $('#sp-shal b').textContent = fmt(cs) + ' m/s';
    $('#sp-deep').classList.toggle('best', eD < .05); $('#sp-shal').classList.toggle('best', eS < .05);
    $('#sp-deep span small').textContent = TX.spDeep(eD < .0005 ? '0' : fmt(eD * 100, eD < .01 ? 1 : 0));
    $('#sp-shal span small').textContent = TX.spShal(eS < .0005 ? '0' : fmt(eS * 100, eS < .01 ? 1 : 0));
    $('#sp-note').textContent = TX.note[c];
    $$('#seg3-preset button').forEach(b => b.classList.remove('sel'));
    $('#cap3').innerHTML = hangCap(TX.cap[c](h, L));
  }
  ['L', 'h'].forEach(key => { const r = $('#r3-' + key); r.addEventListener('input', () => { S[key] = +r.value; upd(); }); });
  const PRE = { deep: [60, 50], mid: [60, 10], shal: [100, 3] };
  $$('#seg3-preset button').forEach(b => b.onclick = () => { const [L, h] = PRE[b.dataset.v]; S.L = L; S.h = h; $('#r3-L').value = L; $('#r3-h').value = h; upd(); b.classList.add('sel'); });
  $('#t3-orbit').onclick = e => { orbitOn = !orbitOn; e.currentTarget.classList.toggle('on', orbitOn); };
  registerPauseBtn($('#t3-pause'));
  upd(); render(0);
  frames['3'] = render;
})();
