/* 탭5: 핵심 퀴즈 — 6문항 진행·결과 화면·틀린 문제만 다시 보기 (문항 텍스트는 text.js, 그림 함수는 여기) */
/* ================= 탭5: 핵심 퀴즈 ================= */
(function () {
  const TX = TEXT.tab5; // 이 탭의 문구
  const quiz = $('#quiz');
  const sea = (s, y, w = 300, h = 190) => { s.appendChild(E('rect', { width: w, height: h, fill: '#CFE8F5' })); };
  const wavePath = (y, A, L, w = 300, ph = 0) => { let d = `M0 ${y - A * Math.cos(ph)}`; for (let x = 4; x <= w; x += 4) d += `L${x} ${(y - A * Math.cos(2 * Math.PI * x / L + ph)).toFixed(1)}`; return d + `L${w} 300L0 300Z`; };
  function artBoat() {
    const s = E('svg', { viewBox: '0 0 300 190' }); sea(s);
    s.appendChild(E('path', { d: wavePath(120, 14, 120), fill: '#5FB0DE', stroke: '#24303A', 'stroke-width': 3 }));
    const b = drawBoat(); b.setAttribute('transform', 'translate(150,112) scale(.55)'); s.appendChild(b);
    s.appendChild(E('g', {}, [E('rect', { x: 70, y: 14, width: 160, height: 30, rx: 8, fill: '#fff', stroke: '#24303A', 'stroke-width': 2.5 }), E('text', { x: 150, y: 35, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 17, fill: '#24303A', text: TX.art.boatWatch })]));
    s.appendChild(E('g', {}, [E('path', { d: 'M20 70 L64 70 M64 70 L54 62 M64 70 L54 78', stroke: '#E8553E', 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' }), E('text', { x: 42, y: 60, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 14, fill: '#C7432E', text: TX.art.boatSpeed })]));
    return s;
  }
  function artBall() {
    const s = E('svg', { viewBox: '0 0 300 190' }); sea(s);
    s.appendChild(E('path', { d: wavePath(120, 14, 120, 300, .6), fill: '#5FB0DE', stroke: '#24303A', 'stroke-width': 3 }));
    s.appendChild(E('circle', { cx: 150, cy: 112, r: 14, fill: 'none', stroke: '#E8553E', 'stroke-width': 2.5, 'stroke-dasharray': '4 4' }));
    s.appendChild(E('g', { transform: 'translate(150,100)' }, [E('circle', { r: 12, fill: '#FFE082', stroke: '#24303A', 'stroke-width': 3 }), E('path', { d: 'M-12 0 A12 12 0 0 0 12 0 Z', fill: '#E8553E', stroke: '#24303A', 'stroke-width': 3 })]));
    s.appendChild(E('path', { d: 'M20 40 L70 40 M70 40 L60 32 M70 40 L60 48', stroke: '#24303A', 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' }));
    s.appendChild(E('text', { x: 45, y: 30, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 13, fill: '#24303A', text: TX.art.ballDir }));
    s.appendChild(E('rect', { x: 250, y: 60, width: 50, height: 130, fill: '#E6C377', stroke: '#24303A', 'stroke-width': 3 }));
    s.appendChild(E('text', { x: 275, y: 130, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 14, fill: '#24303A', text: TX.art.ballShore }));
    return s;
  }
  function artOrbit(deep) {
    const s = E('svg', { viewBox: '0 0 300 190' }); sea(s);
    s.appendChild(E('path', { d: wavePath(40, 10, 150), fill: '#5FB0DE', stroke: '#24303A', 'stroke-width': 3 }));
    if (!deep) s.appendChild(E('rect', { x: 0, y: 150, width: 300, height: 40, fill: '#E6C377', stroke: '#24303A', 'stroke-width': 3 }));
    [75, 150, 225].forEach(x => {
      if (deep) [[40, 10], [70, 6], [96, 3.5], [118, 2], [136, 1]].forEach(([y, r]) => s.appendChild(E('circle', { cx: x, cy: y, r, fill: 'none', stroke: '#24303A', 'stroke-width': 2 })));
      else [[40, 16, 10], [70, 16, 7], [98, 15, 4], [124, 15, 1.5]].forEach(([y, rx, ry]) => s.appendChild(E('ellipse', { cx: x, cy: y, rx, ry, fill: 'none', stroke: '#24303A', 'stroke-width': 2 })));
      if (!deep) s.appendChild(E('path', { d: `M${x - 15} 144 L${x + 15} 144 M${x - 15} 144 L${x - 9} 139 M${x - 15} 144 L${x - 9} 149 M${x + 15} 144 L${x + 9} 139 M${x + 15} 144 L${x + 9} 149`, stroke: '#24303A', 'stroke-width': 2, fill: 'none' }));
    });
    return s;
  }
  function artRatio() {
    const s = E('svg', { viewBox: '0 0 300 190' }); sea(s);
    s.appendChild(E('path', { d: wavePath(70, 8, 240, 300, Math.PI), fill: '#5FB0DE', stroke: '#24303A', 'stroke-width': 3 }));
    s.appendChild(E('rect', { x: 0, y: 130, width: 300, height: 60, fill: '#E6C377', stroke: '#24303A', 'stroke-width': 3 }));
    s.appendChild(E('path', { d: arrowD(30, 30, 270, 30, 8), stroke: '#5B9BD5', 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round' }));
    s.appendChild(E('text', { x: 150, y: 22, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 15, fill: '#24303A', text: TX.art.ratioL }));
    s.appendChild(E('path', { d: arrowD(150, 78, 150, 130, 8), stroke: '#E8553E', 'stroke-width': 3.5, fill: 'none', 'stroke-linecap': 'round' }));
    s.appendChild(E('text', { x: 160, y: 110, 'font-family': 'Jua', 'font-size': 15, fill: '#C7432E', text: TX.art.ratioH }));
    return s;
  }
  function artCapeTop() {
    const s = E('svg', { viewBox: '0 0 300 190' }); s.appendChild(E('rect', { width: 300, height: 190, fill: '#5FB0DE' }));
    const sh = x => 120 - 46 * Math.cos(2 * Math.PI * (x - 90) / 300);
    let d = `M-5 ${sh(-5)}`; for (let x = 0; x <= 305; x += 5) d += `L${x} ${sh(x).toFixed(1)}`;
    // 굴절된 마루 (해안선과 나란해지는 곡선)
    [18, 40, 62].forEach((off, i) => { let c = `M-5 ${sh(-5) - off * (1 + i * .6)}`; for (let x = 0; x <= 305; x += 5) c += `L${x} ${(sh(x) * (1 - i * .28) - off + i * 20).toFixed(1)}`; s.appendChild(E('path', { d: c, fill: 'none', stroke: '#fff', 'stroke-width': 3, opacity: .9 })); });
    s.appendChild(E('path', { d: d + 'L305 200L-5 200Z', fill: '#E6C377', stroke: '#24303A', 'stroke-width': 3 }));
    s.appendChild(E('text', { x: 90, y: sh(90) + 40, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 18, fill: '#24303A', text: TX.art.cape }));
    s.appendChild(E('text', { x: 240, y: sh(240) + 30, 'text-anchor': 'middle', 'font-family': 'Jua', 'font-size': 18, fill: '#24303A', text: TX.art.bay }));
    s.appendChild(E('rect', { x: 0, y: 0, width: 300, height: 190, fill: 'none', stroke: '#24303A', 'stroke-width': 4 }));
    return s;
  }
  /* 문항 텍스트는 text.js 에서 가져오고, 그림은 이름 → 함수 참조로 연결 */
  const ART = { artBoat, artBall, artOrbitDeep: () => artOrbit(true), artOrbitShallow: () => artOrbit(false), artRatio, artCapeTop };
  const QS = TX.QS.map(q => q.type === 'pic2' ? { ...q, options: q.options.map(o => ({ ...o, art: ART[o.art] })) } : { ...q, art: ART[q.art] });
  let queue = QS.map((_, i) => i), pos = 0, results = QS.map(() => null);
  function render() {
    quiz.innerHTML = '';
    if (pos >= queue.length) return renderEnd();
    const qi = queue[pos], Q = QS[qi];
    const box = document.createElement('div'); box.className = 'q tall';
    box.innerHTML = `<div class="qtop"><span class="qn">Q${qi + 1} / ${QS.length}</span><span class="qtag">${Q.tag}</span></div><h3>${Q.q}</h3><div class="qbody"></div><div class="qfeed" hidden></div><div class="qctl"><button class="btn ok big" id="q-next" style="display:none">${TX.next}</button></div>`;
    quiz.appendChild(box);
    const body = box.querySelector('.qbody'), feed = box.querySelector('.qfeed'), next = box.querySelector('#q-next');
    let answered = false;
    const finish = (ok, popEl) => {
      if (answered) return; answered = true; results[qi] = ok;
      feed.hidden = false; feed.className = 'qfeed ' + (ok ? 'good' : 'bad');
      feed.innerHTML = `<div class="fh">${ok ? TX.good : TX.bad}</div><div>${Q.exp}</div>`;
      next.style.display = ''; next.textContent = pos + 1 < queue.length ? TX.next : TX.result;
      if (popEl) popEl.classList.add('pop');
      feed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    if (Q.type === 'pic2') {
      const row = document.createElement('div'); row.className = 'pic2'; body.appendChild(row);
      Q.options.forEach((o, i) => {
        const cdiv = document.createElement('div'); cdiv.className = 'piccard'; cdiv.setAttribute('role', 'button'); cdiv.tabIndex = 0;
        cdiv.appendChild(o.art()); cdiv.insertAdjacentHTML('beforeend', `<div class="pl">${o.label}</div>`);
        const pick = () => {
          if (answered) return; const okA = i === Q.ans;
          Array.from(row.children).forEach((el, k) => {
            if (k === Q.ans) { el.classList.add('right'); el.insertAdjacentHTML('beforeend', '<span class="mark ok">✔</span>'); }
            else if (el === cdiv) { el.classList.add('wrong'); el.insertAdjacentHTML('beforeend', '<span class="mark no">✖</span>'); }
            else el.classList.add('dim');
          });
          finish(okA, row.children[Q.ans]);
        };
        cdiv.onclick = pick; cdiv.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
        row.appendChild(cdiv);
      });
    } else if (Q.type === 'ox') {
      const art = document.createElement('div'); art.className = 'qart'; art.appendChild(Q.art()); body.appendChild(art);
      const row = document.createElement('div'); row.className = 'oxrow'; body.appendChild(row);
      TX.ox.forEach(([icon, txt], i) => {
        const b = document.createElement('button'); b.className = 'oxbtn'; b.innerHTML = `<span>${icon}<small>${txt}</small></span>`;
        b.onclick = () => { if (answered) return; const okA = i === Q.ans; row.children[Q.ans].classList.add('right'); if (!okA) b.classList.add('wrong'); finish(okA, row.children[Q.ans]); };
        row.appendChild(b);
      });
    } else {
      const art = document.createElement('div'); art.className = 'qart'; art.appendChild(Q.art()); body.appendChild(art);
      body.insertAdjacentHTML('beforeend', `<div class="choices"${Q.choices.length === 3 ? ' style="grid-template-columns:repeat(3,1fr)"' : ''}>${Q.choices.map((c, i) => `<button class="choice" data-i="${i}">${c}</button>`).join('')}</div>`);
      body.querySelectorAll('.choice').forEach(c => c.onclick = () => {
        if (answered) return; const okA = +c.dataset.i === Q.ans;
        body.querySelectorAll('.choice').forEach(x => { if (+x.dataset.i === Q.ans) { x.classList.add('right'); x.insertAdjacentHTML('beforeend', ' ✔'); } else if (x === c) { x.classList.add('wrong'); x.insertAdjacentHTML('beforeend', ' ✖'); } });
        finish(okA, body.querySelector('.choice.right'));
      });
    }
    next.onclick = () => { pos++; render(); };
  }
  function renderEnd() {
    const score = results.filter(Boolean).length, wrong = QS.map((_, i) => i).filter(i => !results[i]);
    const msg = score === QS.length ? TX.msgPerfect : score >= 4 ? TX.msgGood : TX.msgOk;
    const box = document.createElement('div'); box.className = 'q';
    box.innerHTML = `<div class="score">${TX.score(score, QS.length)}</div><div style="text-align:center;margin-top:10px;font-size:16px">${msg}</div><div class="review">${QS.map((q, i) => `<span class="rv ${results[i] ? 'ok' : 'no'}">Q${i + 1} ${results[i] ? '○' : '✕'}</span>`).join('')}</div><div class="qctl" style="justify-content:center;flex-wrap:wrap;gap:10px">${wrong.length ? `<button class="btn warn big" id="q-wrong">${TX.btnWrong}</button>` : ''}<button class="btn big" id="q-back">${TX.btnBack}</button><button class="btn primary big" id="q-restart">${TX.btnRestart}</button></div>`;
    quiz.appendChild(box);
    const w = box.querySelector('#q-wrong'); if (w) w.onclick = () => { queue = wrong; pos = 0; render(); };
    box.querySelector('#q-back').onclick = () => $('.tab[data-tab="2"]').click();
    box.querySelector('#q-restart').onclick = () => { queue = QS.map((_, i) => i); pos = 0; results = QS.map(() => null); render(); };
  }
  render();
})();
