// ==UserScript==
// @name         크랙 무드 배경
// @namespace    https://github.com/mywishluv/wishlite
// @version      1.0.0
// @description  크랙 채팅 화면에 벚꽃·눈·비·반딧불 배경 효과를 은은하게 깔아줘요
// @author       muz
// @match        https://crack.wrtn.ai/*
// @grant        none
// @run-at       document-idle
// @noframes
// @downloadURL  https://github.com/mywishluv/wishlite/raw/main/crack-mood.user.js
// @updateURL    https://github.com/mywishluv/wishlite/raw/main/crack-mood.user.js
// ==/UserScript==
// v1.0.0 첫 버전: 벚꽃·눈·비·반딧불 4가지 효과, 양 3단계, 버튼 끌어서 옮기기(양옆에 착 붙음)
//
// 내 대화는 크랙에서 읽기만 하고 다른 곳으로 보내지 않아요.
// (이 스크립트는 채팅 내용을 아예 읽지 않아요. 화면 위에 그림만 그려요.)

(function () {
  'use strict';
  if (window.__crackMood) return;
  window.__crackMood = true;

  /* ───────── 설정 ───────── */
  const KEY = 'crackMood.v1';
  const DEF = { effect: 'off', amount: 1, btn: { side: 'right', y: 0.35 } };
  let cfg = load();
  function load() {
    try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return JSON.parse(JSON.stringify(DEF)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }

  const EFFECTS = [
    { id: 'sakura',  icon: '🌸', name: '벚꽃' },
    { id: 'snow',    icon: '❄️', name: '눈' },
    { id: 'rain',    icon: '🌧️', name: '비' },
    { id: 'firefly', icon: '✨', name: '반딧불' },
    { id: 'off',     icon: '⏸️', name: '끄기' },
  ];
  const OFF_ICON = '🎐';
  const AMOUNTS = [{ name: '적게', k: 0.5 }, { name: '보통', k: 1 }, { name: '많이', k: 1.7 }];
  const BASE = { sakura: 26, snow: 60, rain: 70, firefly: 22 }; // 폰 화면 기준 개수
  const CANVAS_OPACITY = '0.8'; // 전체 진하기 (글자 안 가리게 은은하게)

  /* ───────── 캔버스 ───────── */
  const cv = document.createElement('canvas');
  cv.id = 'crack-mood-canvas';
  cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, {
    position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh',
    pointerEvents: 'none', zIndex: '2147483000', opacity: '0',
    transition: 'opacity .8s ease', display: 'block', margin: '0', padding: '0',
  });
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  resize();

  /* 미리 그려둔 그림 조각 (매번 그리는 것보다 가벼워요) */
  function sprite(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    return c;
  }
  const SPR = {
    petal: sprite(64, (g, s) => {
      const gr = g.createLinearGradient(0, 0, s, s);
      gr.addColorStop(0, '#ffe6ee'); gr.addColorStop(1, '#ff9dbd');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(s * .5, s * .95);
      g.bezierCurveTo(s * .1, s * .7, s * .02, s * .3, s * .28, s * .06);
      g.quadraticCurveTo(s * .42, s * .02, s * .5, s * .17);
      g.quadraticCurveTo(s * .58, s * .02, s * .72, s * .06);
      g.bezierCurveTo(s * .98, s * .3, s * .9, s * .7, s * .5, s * .95);
      g.fill();
    }),
    snow: sprite(32, (g, s) => {
      const r = s / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(.5, 'rgba(255,255,255,.92)');
      gr.addColorStop(.78, 'rgba(165,185,215,.45)'); // 흰 화면에서도 보이게 살짝 테두리
      gr.addColorStop(1, 'rgba(165,185,215,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }),
    glow: sprite(48, (g, s) => {
      const r = s / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, 'rgba(255,255,225,1)');
      gr.addColorStop(.15, 'rgba(250,238,130,.95)');
      gr.addColorStop(.45, 'rgba(215,232,90,.35)');
      gr.addColorStop(1, 'rgba(200,228,80,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }),
  };

  /* ───────── 효과별 움직임 ───────── */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const SYS = {
    sakura: {
      spawn(p, init) {
        p.s = rnd(9, 17); p.x = rnd(-W * .3, W); p.y = init ? rnd(-20, H) : rnd(-60, -20);
        p.vy = rnd(28, 55); p.vx = rnd(8, 28); p.rot = rnd(0, 6.28); p.vr = rnd(-1.6, 1.6);
        p.t = rnd(0, 10); p.sf = rnd(.8, 1.6); p.ff = rnd(1.5, 3); p.a = rnd(.55, .85);
      },
      step(p, dt) {
        p.t += dt; p.y += p.vy * dt; p.x += (p.vx + Math.sin(p.t * p.sf) * 22) * dt; p.rot += p.vr * dt;
        if (p.y > H + 30 || p.x > W + 40) this.spawn(p, false);
        const c = Math.cos(p.rot), s = Math.sin(p.rot), fx = Math.cos(p.t * p.ff); // fx: 팔랑 뒤집힘
        ctx.globalAlpha = p.a;
        ctx.setTransform(dpr * c * fx, dpr * s * fx, -dpr * s, dpr * c, p.x * dpr, p.y * dpr);
        ctx.drawImage(SPR.petal, -p.s / 2, -p.s / 2, p.s, p.s);
      },
    },
    snow: {
      spawn(p, init) {
        p.r = rnd(1.5, 4.5); p.x = rnd(0, W); p.y = init ? rnd(0, H) : -10;
        p.vy = 12 + p.r * 9; p.t = rnd(0, 10); p.sw = rnd(8, 20); p.sf = rnd(.5, 1.2); p.a = rnd(.55, .95);
      },
      step(p, dt) {
        p.t += dt; p.y += p.vy * dt; p.x += Math.sin(p.t * p.sf) * p.sw * dt;
        if (p.y > H + 10) this.spawn(p, false);
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        const d = p.r * 2.6;
        ctx.globalAlpha = p.a;
        ctx.drawImage(SPR.snow, p.x - d / 2, p.y - d / 2, d, d);
      },
    },
    rain: {
      spawn(p, init) {
        p.x = rnd(-W * .2, W); p.y = init ? rnd(-H, H) : rnd(-H * .3, -20);
        p.l = rnd(10, 22); p.v = rnd(520, 820);
      },
      batch(ps, dt) {
        ctx.strokeStyle = 'rgba(120,150,195,.42)';
        ctx.lineWidth = 1.1; ctx.lineCap = 'round';
        ctx.beginPath();
        for (const p of ps) {
          p.y += p.v * dt; p.x += p.v * .12 * dt;
          if (p.y > H + 30) this.spawn(p, false);
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.l * .12, p.y - p.l);
        }
        ctx.stroke();
      },
    },
    firefly: {
      spawn(p) {
        p.x = rnd(0, W); p.y = rnd(H * .15, H); p.dir = rnd(0, 6.28); p.sp = rnd(10, 24);
        p.t = rnd(0, 10); p.pf = rnd(1, 2.2); p.s = rnd(12, 22);
      },
      step(p, dt) {
        p.t += dt; p.dir += rnd(-3, 3) * dt;
        p.x += Math.cos(p.dir) * p.sp * dt; p.y += Math.sin(p.dir) * p.sp * dt - 4 * dt;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
        const k = .5 + .5 * Math.sin(p.t * p.pf), d = p.s * (.8 + .3 * k);
        ctx.globalAlpha = .15 + .75 * k * k; // 깜빡깜빡
        ctx.drawImage(SPR.glow, p.x - d / 2, p.y - d / 2, d, d);
      },
    },
  };

  /* ───────── 돌리기 / 멈추기 ───────── */
  let parts = [], cur = null, raf = 0, last = 0, switchT = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    const sys = SYS[cur];
    if (!sys) return;
    if (sys.batch) sys.batch(parts, dt);
    else for (const p of parts) sys.step(p, dt);
  }
  function areaK() { return Math.min(1.6, Math.max(0.6, (W * H) / (390 * 844))); }
  function build() {
    const sys = SYS[cur];
    if (!sys) { parts = []; return; }
    const n = Math.round(BASE[cur] * AMOUNTS[cfg.amount].k * areaK());
    parts = [];
    for (let i = 0; i < n; i++) { const p = {}; sys.spawn(p, true); parts.push(p); }
  }
  function startLoop() {
    if (raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function begin(id) {
    cur = id; build(); startLoop();
    requestAnimationFrame(() => { cv.style.opacity = CANVAS_OPACITY; });
  }
  function applyEffect(id) {
    clearTimeout(switchT);
    if (id === 'off') {
      cv.style.opacity = '0';
      switchT = setTimeout(() => { stopLoop(); cur = null; parts = []; ctx.clearRect(0, 0, W, H); }, 850);
      return;
    }
    if (cur && cur !== id) { // 스르륵 사라졌다가 새 효과로
      cv.style.opacity = '0';
      switchT = setTimeout(() => begin(id), 450);
    } else begin(id);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop(); // 다른 탭 가면 멈춰서 배터리 아끼기
    else if (cur) startLoop();
  });
  let rT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => { resize(); placeBtn(false); }, 150);
  });

  /* ───────── 버튼 + 설정창 (크랙 디자인이랑 안 섞이게 따로 담아요) ───────── */
  const host = document.createElement('div');
  host.id = 'crack-mood-host';
  Object.assign(host.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', zIndex: '2147483001' });
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
<style>
  :host{all:initial}
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",Pretendard,"Noto Sans KR",sans-serif;-webkit-tap-highlight-color:transparent}
  button{font:inherit;margin:0;cursor:pointer}
  .fab{position:fixed;left:0;top:0;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.7);
    background:rgba(255,255,255,.75);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
    box-shadow:0 4px 16px rgba(0,0,0,.16);font-size:21px;line-height:1;display:flex;align-items:center;justify-content:center;
    padding:0;touch-action:none;user-select:none;-webkit-user-select:none;opacity:.88;
    transition:left .35s cubic-bezier(.32,.72,0,1),top .35s cubic-bezier(.32,.72,0,1),opacity .2s,box-shadow .25s}
  .fab.on{opacity:.95;box-shadow:0 4px 16px rgba(255,120,170,.3),0 0 0 2px rgba(255,175,205,.65)}
  .fab.drag{transition:none;opacity:1;box-shadow:0 10px 26px rgba(0,0,0,.25)}
  .dim{position:fixed;inset:0;background:rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:opacity .3s}
  .dim.show{opacity:1;pointer-events:auto}
  .sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;max-width:480px;color:#1c1c1e;
    background:rgba(255,255,255,.96);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);
    border-radius:22px 22px 0 0;padding:10px 18px calc(22px + env(safe-area-inset-bottom));
    box-shadow:0 -6px 30px rgba(0,0,0,.15);transform:translateY(110%);visibility:hidden;
    transition:transform .42s cubic-bezier(.32,.72,0,1),visibility 0s linear .42s}
  .sheet.show{transform:translateY(0);visibility:visible;transition:transform .42s cubic-bezier(.32,.72,0,1),visibility 0s}
  .handle{width:38px;height:5px;border-radius:3px;background:#d1d1d6;margin:0 auto 12px}
  .title{display:flex;justify-content:space-between;align-items:center;margin:0 2px 14px}
  .title b{font-size:17px}
  .done{border:0;background:none;color:#ff5c8a;font-size:16px;font-weight:600;padding:6px 2px}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px}
  .tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 0 10px;border-radius:16px;
    border:2px solid transparent;background:#f2f2f7;color:#3a3a3c;font-size:12px;
    transition:transform .15s,background .2s,border-color .2s,color .2s}
  .tile .ic{font-size:26px;line-height:1;display:block}
  .tile:active{transform:scale(.93)}
  .tile.sel{background:#fff0f5;border-color:#ff8fb1;color:#d6336c;font-weight:700}
  .label{font-size:13px;color:#8e8e93;margin:0 0 8px 2px}
  .seg{display:flex;background:#eeeef0;border-radius:10px;padding:2px;transition:opacity .2s}
  .seg button{flex:1;height:34px;border:0;background:transparent;border-radius:8px;font-size:14px;color:#3a3a3c;transition:background .2s}
  .seg button.sel{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12);font-weight:600}
  .seg.dis{opacity:.4;pointer-events:none}
  .note{font-size:12px;color:#8e8e93;text-align:center;margin-top:14px;line-height:1.5}
  @media (prefers-color-scheme:dark){
    .fab{background:rgba(44,44,46,.75);border-color:rgba(255,255,255,.15)}
    .sheet{background:rgba(28,28,30,.96);color:#f2f2f7}
    .handle{background:#48484a}
    .tile{background:#2c2c2e;color:#e5e5ea}
    .tile.sel{background:#3a2430;color:#ff9fbf}
    .seg{background:#2c2c2e}
    .seg button{color:#e5e5ea}
    .seg button.sel{background:#48484a}
  }
</style>
<button class="fab" aria-label="무드 배경 설정"></button>
<div class="dim"></div>
<div class="sheet" role="dialog" aria-label="무드 배경">
  <div class="handle"></div>
  <div class="title"><b>무드 배경</b><button class="done">완료</button></div>
  <div class="grid">${EFFECTS.map(e => `<button class="tile" data-id="${e.id}"><span class="ic">${e.icon}</span><span>${e.name}</span></button>`).join('')}</div>
  <div class="label">양</div>
  <div class="seg">${AMOUNTS.map((a, i) => `<button data-i="${i}">${a.name}</button>`).join('')}</div>
  <div class="note">채팅 터치·스크롤은 그대로 돼요 · 버튼은 끌어서 옮길 수 있어요</div>
</div>`;

  const fab = root.querySelector('.fab');
  const dim = root.querySelector('.dim');
  const sheet = root.querySelector('.sheet');
  const tiles = [...root.querySelectorAll('.tile')];
  const seg = root.querySelector('.seg');
  const segBtns = [...seg.querySelectorAll('button')];

  function pop(el) {
    if (el.animate) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.82)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
  }
  function refreshUI() {
    const e = EFFECTS.find(x => x.id === cfg.effect) || EFFECTS[4];
    fab.textContent = cfg.effect === 'off' ? OFF_ICON : e.icon;
    fab.classList.toggle('on', cfg.effect !== 'off');
    tiles.forEach(t => t.classList.toggle('sel', t.dataset.id === cfg.effect));
    segBtns.forEach((b, i) => b.classList.toggle('sel', i === cfg.amount));
    seg.classList.toggle('dis', cfg.effect === 'off');
  }

  /* 버튼 위치 (양옆에 착 붙기) */
  let bx = 0, by = 0;
  function setPos(x, y) {
    bx = Math.max(6, Math.min(W - 50, x));
    by = Math.max(6, Math.min(H - 50, y));
    fab.style.left = bx + 'px'; fab.style.top = by + 'px';
  }
  function placeBtn() {
    const b = cfg.btn || DEF.btn;
    setPos(b.side === 'left' ? 10 : W - 54, (b.y ?? .35) * (H - 44));
  }

  let drag = null;
  fab.addEventListener('pointerdown', e => {
    drag = { sx: e.clientX, sy: e.clientY, x0: bx, y0: by, moved: false };
    try { fab.setPointerCapture(e.pointerId); } catch (_) {}
  });
  fab.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    fab.classList.add('drag');
    setPos(drag.x0 + dx, drag.y0 + dy);
  });
  fab.addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    fab.classList.remove('drag');
    if (moved) {
      cfg.btn = { side: bx + 22 < W / 2 ? 'left' : 'right', y: by / Math.max(1, H - 44) };
      save(); placeBtn();
    } else { pop(fab); openSheet(); }
  });
  fab.addEventListener('pointercancel', () => { drag = null; fab.classList.remove('drag'); placeBtn(); });

  /* 설정창 */
  function openSheet() { refreshUI(); dim.classList.add('show'); sheet.classList.add('show'); }
  function closeSheet() { dim.classList.remove('show'); sheet.classList.remove('show'); }
  dim.addEventListener('click', closeSheet);
  root.querySelector('.done').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  tiles.forEach(t => t.addEventListener('click', () => {
    pop(t.querySelector('.ic'));
    if (cfg.effect === t.dataset.id) return;
    cfg.effect = t.dataset.id; save(); refreshUI(); pop(fab);
    applyEffect(cfg.effect);
  }));
  segBtns.forEach((b, i) => b.addEventListener('click', () => {
    if (cfg.amount === i) return;
    cfg.amount = i; save(); refreshUI();
    if (cur) build();
  }));

  /* ───────── 붙이기 ───────── */
  function mount() {
    if (!document.body) return;
    if (!document.body.contains(cv)) document.body.appendChild(cv);
    if (!document.body.contains(host)) document.body.appendChild(host);
  }
  mount();
  setInterval(mount, 2000); // 크랙이 화면을 새로 그려도 다시 붙도록
  placeBtn();
  refreshUI();
  if (cfg.effect !== 'off') applyEffect(cfg.effect);
})();
