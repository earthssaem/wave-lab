/* 탭1: 해파의 구조 — 파장·파고·주기 슬라이더, 이름표, 배 위 시계 (슬라이더별 힌트는 그림 아래 해설 카드) */
/* ================= 탭1: 해파의 구조 ================= */
(function () {
  const TX = TEXT.tab1; // 이 탭의 문구
  const svg = $('#svg1'); drawSky(svg, 's1');
  const PXM = 3, PXV = 10, Y0 = 300, XB = 800;
  const S = { L: 60, H: 3, T: 8 };
  const water = E('path', { fill: 'url(#s1-water)', stroke: '#24303A', 'stroke-width': 4, 'stroke-linejoin': 'round' }); svg.appendChild(water);
  const lab = E('g'); svg.appendChild(lab);
  const guideCrest = E('path', { stroke: '#24303A', 'stroke-width': 2, 'stroke-dasharray': '6 6', fill: 'none' });
  const guideTrough = E('path', { stroke: '#24303A', 'stroke-width': 2, 'stroke-dasharray': '6 6', fill: 'none' });
  const lGuide = E('path', { stroke: '#5B9BD5', 'stroke-width': 2, 'stroke-dasharray': '6 6', fill: 'none' });
  const hArrow = E('path', { stroke: '#E8553E', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const lArrow = E('path', { stroke: '#5B9BD5', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const pCrest = pill(TX.crest, { bg: '#FFE082' }), pTrough = pill(TX.trough, { bg: '#fff' }), pH = pill(TX.height, { bg: '#E8553E', color: '#fff' }), pL = pill(TX.length, { bg: '#5B9BD5', color: '#fff' });
  [guideCrest, guideTrough, lGuide, hArrow, lArrow, pCrest.g, pTrough.g, pH.g, pL.g].forEach(e => lab.appendChild(e));
  const dirArrow = E('g', { transform: 'translate(430,150)' }, [
    E('path', { d: 'M-60 0 L40 0 M40 0 L22 -14 M40 0 L22 14', stroke: '#24303A', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }),
    E('path', { d: 'M-60 0 L40 0 M40 0 L22 -14 M40 0 L22 14', stroke: '#E8553E', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }),
  ]);
  const pDir = pill(TX.dir, { fs: 16, pad: 8 }); pDir.move(420, 118); svg.appendChild(dirArrow); svg.appendChild(pDir.g);
  const boat = E('g'); boat.appendChild(drawBoat()); svg.appendChild(boat);
  const sw = E('g', {}, [
    E('rect', { x: -78, y: -32, width: 156, height: 64, rx: 12, fill: '#FFFDF8', stroke: '#24303A', 'stroke-width': 3 }),
    E('path', { d: 'M-10 32 L0 46 L10 32 Z', fill: '#FFFDF8', stroke: '#24303A', 'stroke-width': 3, 'stroke-linejoin': 'round' }),
    E('rect', { x: -12, y: 26, width: 24, height: 8, fill: '#FFFDF8' }),
  ]);
  const swT = E('text', { x: 0, y: 2, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 26, fill: '#24303A', text: TX.watch0 });
  const swS = E('text', { x: 0, y: 22, 'text-anchor': 'middle', 'font-family': 'Noto Sans KR', 'font-size': 12, fill: '#4A5763', text: TX.watchSub });
  sw.appendChild(swT); sw.appendChild(swS); svg.appendChild(sw);
  const flash = pill(TX.pass, { bg: '#E8553E', color: '#fff', fs: 22 }); flash.g.style.opacity = 0; svg.appendChild(flash.g);
  let s = 0, prevPh = 0, fl = 0, labelsOn = true;

  function render(dt) {
    const Lpx = S.L * PXM, k = 2 * Math.PI / Lpx, c = S.L / S.T * PXM, A = S.H / 2 * PXV;
    s += c * dt;
    const eta = x => A * Math.cos(k * (x - s));
    let d = `M-20 ${(Y0 - eta(-20)).toFixed(1)}`;
    for (let x = -12; x <= 984; x += 6) d += `L${x} ${(Y0 - eta(x)).toFixed(1)}`;
    d += 'L984 600L-20 600Z'; water.setAttribute('d', d);
    lab.style.display = labelsOn ? '' : 'none';
    if (labelsOn) {
      const start = Lpx / 2 + 30; const xc = start + mod(s - start, Lpx), xt = xc - Lpx / 2, xn = xc + Lpx;
      const yc = Y0 - A, yt = Y0 + A;
      pCrest.move(xc, yc - 28); pTrough.move(xt, yt + 30);
      attr(guideCrest, { d: `M${xt - 16} ${yc} L${xc + 16} ${yc}` }); attr(guideTrough, { d: `M${xt - 16} ${yt} L${xc + 16} ${yt}` });
      const xm = (xc + xt) / 2; hArrow.setAttribute('d', arrowD(xm, yc, xm, yt)); pH.move(xm - 58, (yc + yt) / 2);
      const yl = yc - 66; lArrow.setAttribute('d', arrowD(xc, yl, xn, yl)); attr(lGuide, { d: `M${xc} ${yl} L${xc} ${yc - 4} M${xn} ${yl} L${xn} ${yc - 4}` }); pL.move((xc + xn) / 2, yl - 22);
    }
    const yb = Y0 - eta(XB); const slope = A * k * Math.sin(k * (XB - s)); const ang = Math.atan(slope) * 180 / Math.PI * .7;
    boat.setAttribute('transform', `translate(${XB},${(yb - 10).toFixed(1)}) rotate(${ang.toFixed(1)})`);
    sw.setAttribute('transform', `translate(${XB},${(yb - 130).toFixed(1)})`);
    const ph = mod((s - XB) / Lpx, 1); if (ph < prevPh) fl = 1.2; prevPh = ph;
    swT.textContent = TX.watch((ph * S.T).toFixed(1));
    fl = Math.max(0, fl - dt); flash.g.style.opacity = Math.min(1, fl); flash.move(XB, yb - 190);
  }
  const HINT = TX.HINT, setExplain = explainCard($('#ex1'));
  function upd(which) {
    const c = S.L / S.T;
    $('#v1-L').textContent = S.L + ' m'; $('#v1-H').textContent = fmt(S.H) + ' m'; $('#v1-T').textContent = fmt(S.T) + ' s';
    $('#f1-L').textContent = S.L + ' m'; $('#f1-T').textContent = fmt(S.T) + ' s'; $('#v1-c').textContent = fmt(c, 2) + ' m/s';
    $('#v1-steep').innerHTML = TX.steep(fmt(S.H), S.L, fmt(S.H / S.L, 3));
    setExplain(TX.cap(HINT[which] || TX.hintDefault, fmt(S.T)));
  }
  ['L', 'H', 'T'].forEach(key => { const r = $('#r1-' + key); r.addEventListener('input', () => { S[key] = +r.value; upd(key); }); });
  bindToggle($('#t1-labels'), v => { labelsOn = v; });
  registerPauseBtn($('#t1-pause'));
  upd(); render(0);
  frames['1'] = render;
})();
