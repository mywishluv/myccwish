// ==UserScript==
// @name         크랙 무드 배경
// @namespace    https://github.com/mywishluv/wishlite
// @version      1.1.1
// @description  크랙 채팅 화면에 벚꽃·눈·비·반딧불·낙엽·별똥별·비눗방울·하트 배경 효과를 은은하게 깔아줘요
// @author       muz
// @match        https://crack.wrtn.ai/*
// @grant        none
// @run-at       document-idle
// @noframes
// @downloadURL  https://github.com/mywishluv/wishlite/raw/main/crack-mood.user.js
// @updateURL    https://github.com/mywishluv/wishlite/raw/main/crack-mood.user.js
// ==/UserScript==
// v1.1.1 폰에서 버튼을 눌러도 설정창이 안 열리던(열리자마자 닫히던) 문제 수정
// v1.1.0 효과 4개 추가(낙엽·별똥별·비눗방울·하트), 터치 반응, 대화 보고 자동 전환(🪄), '배경이미지보기' 밑에 메뉴 버튼
// v1.0.0 첫 버전: 벚꽃·눈·비·반딧불 4가지 효과, 양 3단계, 버튼 끌어서 옮기기(양옆에 착 붙음)
//
// 내 대화는 크랙에서 읽기만 하고 다른 곳으로 보내지 않아요.
// (자동 모드일 때만 화면에 뜬 글에서 '눈송이', '빗소리' 같은 단어를 찾아요. 저장·전송은 안 해요.)

(function () {
  'use strict';
  if (window.__crackMood) return;
  window.__crackMood = true;

  /* ───────── 크랙 화면에서 찾는 것 (바뀌면 여기만 고치면 돼요) ───────── */
  const FIND = {
    bgButtonText: /배경\s*이미지\s*보기/, // 이 글자가 있는 버튼 밑에 '무드 배경' 버튼을 넣어요
    clickable: 'button,a,[role="button"],[role="menuitem"],[role="menuitemcheckbox"],[role="switch"],li,label',
    ignoreText: 'input,textarea,[contenteditable="true"],[data-crack-mood]', // 자동 모드에서 안 읽는 곳(입력창 등)
  };

  /* ───────── 설정 ───────── */
  const KEY = 'crackMood.v1';
  const DEF = { effect: 'off', amount: 1, touch: true, btn: { side: 'right', y: 0.35 } };
  let cfg = load();
  function load() {
    try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return JSON.parse(JSON.stringify(DEF)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }

  const EFFECTS = [
    { id: 'auto',    icon: '🪄', name: '자동' },
    { id: 'sakura',  icon: '🌸', name: '벚꽃' },
    { id: 'snow',    icon: '❄️', name: '눈' },
    { id: 'rain',    icon: '🌧️', name: '비' },
    { id: 'firefly', icon: '✨', name: '반딧불' },
    { id: 'leaves',  icon: '🍂', name: '낙엽' },
    { id: 'meteor',  icon: '🌠', name: '별똥별' },
    { id: 'bubble',  icon: '🫧', name: '비눗방울' },
    { id: 'heart',   icon: '💗', name: '하트' },
    { id: 'off',     icon: '⏸️', name: '끄기' },
  ];
  const effInfo = id => EFFECTS.find(e => e.id === id);
  const OFF_ICON = '🎐';
  const AMOUNTS = [{ name: '적게', k: 0.5 }, { name: '보통', k: 1 }, { name: '많이', k: 1.7 }];
  const BASE = { sakura: 26, snow: 60, rain: 70, firefly: 22, leaves: 20, meteor: 28, bubble: 14, heart: 16 };
  const CANVAS_OPACITY = '0.8';

  /* 자동 모드 단어표 — 많이 나온 효과로 바뀌어요 */
  const KEYWORDS = {
    sakura:  ['벚꽃', '꽃잎', '꽃비', '봄바람', '꽃이 흩날', '꽃향기'],
    snow:    ['눈이 내', '눈이 오', '눈이 쌓', '눈 내리', '눈송이', '눈발', '함박눈', '첫눈', '눈보라', '폭설', '설원', '눈밭', '하얀 눈', '눈사람'],
    rain:    ['비가 내', '비가 오', '비가 쏟', '빗방울', '빗소리', '빗줄기', '빗물', '소나기', '장대비', '폭우', '장마', '이슬비', '우산', '비에 젖'],
    firefly: ['반딧불', '개똥벌레', '여름밤', '풀벌레'],
    leaves:  ['낙엽', '단풍', '은행잎', '가을바람', '가을'],
    meteor:  ['별똥별', '유성', '밤하늘', '은하수', '별빛', '쏟아지는 별'],
    bubble:  ['비눗방울', '물방울', '거품', '욕조', '바닷속', '물속'],
    heart:   ['사랑해', '좋아해', '두근', '설레', '심장이 뛰', '고백', '입맞춤', '키스'],
  };

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

  /* 미리 그려둔 그림 조각 */
  function sprite(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    return c;
  }
  function radial(g, s, stops) {
    const r = s / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }
  function leafSprite(color, vein) {
    return sprite(64, (g, s) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(s * .5, s * .04);
      g.quadraticCurveTo(s * .98, s * .42, s * .5, s * .9);
      g.quadraticCurveTo(s * .02, s * .42, s * .5, s * .04);
      g.fill();
      g.strokeStyle = vein; g.lineWidth = s * .04; g.lineCap = 'round';
      g.beginPath(); g.moveTo(s * .5, s * .12); g.lineTo(s * .5, s * .98); g.stroke();
    });
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
    snow: sprite(32, (g, s) => radial(g, s, [
      [0, 'rgba(255,255,255,1)'], [.5, 'rgba(255,255,255,.92)'],
      [.78, 'rgba(165,185,215,.45)'], [1, 'rgba(165,185,215,0)'],
    ])),
    glow: sprite(48, (g, s) => radial(g, s, [
      [0, 'rgba(255,255,225,1)'], [.15, 'rgba(250,238,130,.95)'],
      [.45, 'rgba(215,232,90,.35)'], [1, 'rgba(200,228,80,0)'],
    ])),
    gold: sprite(32, (g, s) => radial(g, s, [
      [0, 'rgba(255,250,230,1)'], [.25, 'rgba(255,215,120,.9)'],
      [.6, 'rgba(255,190,90,.25)'], [1, 'rgba(255,190,90,0)'],
    ])),
    leaf: [leafSprite('#f4a259', '#c97a35'), leafSprite('#e76f51', '#b44a32'), leafSprite('#e9c46a', '#b8963f')],
    heart: sprite(64, (g, s) => {
      const gr = g.createLinearGradient(0, 0, 0, s);
      gr.addColorStop(0, '#ffb8cc'); gr.addColorStop(1, '#ff5c8a');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(s * .5, s * .88);
      g.bezierCurveTo(s * .1, s * .6, s * .02, s * .3, s * .27, s * .18);
      g.bezierCurveTo(s * .4, s * .12, s * .48, s * .22, s * .5, s * .3);
      g.bezierCurveTo(s * .52, s * .22, s * .6, s * .12, s * .73, s * .18);
      g.bezierCurveTo(s * .98, s * .3, s * .9, s * .6, s * .5, s * .88);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.beginPath(); g.ellipse(s * .32, s * .32, s * .07, s * .045, -.6, 0, 6.283); g.fill();
    }),
    bubble: sprite(64, (g, s) => {
      radial(g, s, [
        [0, 'rgba(255,255,255,0)'], [.68, 'rgba(200,230,255,.08)'],
        [.86, 'rgba(160,195,255,.45)'], [.94, 'rgba(255,185,240,.55)'], [1, 'rgba(255,255,255,0)'],
      ]);
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.beginPath(); g.ellipse(s * .33, s * .3, s * .09, s * .05, -.7, 0, 6.283); g.fill();
    }),
  };

  /* ───────── 효과별 움직임 ───────── */
  const rnd = (a, b) => a + Math.random() * (b - a);
  function drawRot(img, x, y, s, rot, fx, a) {
    const c = Math.cos(rot), n = Math.sin(rot);
    ctx.globalAlpha = a;
    ctx.setTransform(dpr * c * fx, dpr * n * fx, -dpr * n, dpr * c, x * dpr, y * dpr);
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
  }
  function drawAt(img, x, y, d, a) {
    ctx.globalAlpha = a;
    ctx.drawImage(img, x - d / 2, y - d / 2, d, d);
  }

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
        drawRot(SPR.petal, p.x, p.y, p.s, p.rot, Math.cos(p.t * p.ff), p.a);
      },
    },
    leaves: {
      spawn(p, init) {
        p.img = SPR.leaf[Math.random() * 3 | 0];
        p.s = rnd(13, 22); p.x = rnd(-W * .2, W); p.y = init ? rnd(-20, H) : rnd(-60, -20);
        p.vy = rnd(35, 65); p.vx = rnd(-5, 20); p.rot = rnd(0, 6.28); p.vr = rnd(-2, 2);
        p.t = rnd(0, 10); p.sf = rnd(.6, 1.2); p.ff = rnd(1.2, 2.4); p.a = rnd(.6, .9);
      },
      step(p, dt) {
        p.t += dt; p.y += p.vy * dt; p.x += (p.vx + Math.sin(p.t * p.sf) * 38) * dt; p.rot += p.vr * dt;
        if (p.y > H + 30 || p.x > W + 40 || p.x < -60) this.spawn(p, false);
        drawRot(p.img, p.x, p.y, p.s, p.rot, Math.cos(p.t * p.ff), p.a);
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
        drawAt(SPR.snow, p.x, p.y, p.r * 2.6, p.a);
      },
    },
    rain: {
      spawn(p, init) {
        p.x = rnd(-W * .2, W); p.y = init ? rnd(-H, H) : rnd(-H * .3, -20);
        p.l = rnd(10, 22); p.v = rnd(520, 820);
      },
      batch(ps, dt) {
        ctx.globalAlpha = 1;
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
        p.t = rnd(0, 10); p.pf = rnd(1, 2.2); p.s = rnd(12, 22); p.att = 0;
      },
      step(p, dt) {
        p.t += dt;
        let sp = p.sp;
        if (p.att > 0) { // 터치한 곳으로 모여들기
          p.att -= dt;
          let d = Math.atan2(p.ty - p.y, p.tx - p.x) - p.dir;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          p.dir += d * Math.min(1, dt * 4);
          sp = Math.hypot(p.tx - p.x, p.ty - p.y) < 30 ? p.sp * .5 : p.sp * 3;
        } else p.dir += rnd(-3, 3) * dt;
        p.x += Math.cos(p.dir) * sp * dt; p.y += Math.sin(p.dir) * sp * dt - 4 * dt;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
        const k = .5 + .5 * Math.sin(p.t * p.pf);
        drawAt(SPR.glow, p.x, p.y, p.s * (.8 + .3 * k), .15 + .75 * k * k);
      },
    },
    meteor: {
      build(n, k) {
        const a = [];
        for (let i = 0; i < n; i++) { const p = { kind: 'star' }; this.spawn(p, true); a.push(p); }
        const m = Math.max(1, Math.round(3 * k));
        for (let i = 0; i < m; i++) { const p = { kind: 'meteor' }; this.spawn(p, true); a.push(p); }
        return a;
      },
      spawn(p, init) {
        if (p.kind === 'star') {
          p.x = rnd(0, W); p.y = rnd(0, H * .75); p.s = rnd(4, 8); p.t = rnd(0, 10); p.pf = rnd(.8, 2);
        } else {
          const v = rnd(520, 820), ang = rnd(.45, .7);
          p.x = rnd(W * .3, W * 1.15); p.y = rnd(-H * .1, H * .35);
          p.vx = -Math.cos(ang) * v; p.vy = Math.sin(ang) * v;
          p.len = rnd(80, 140); p.life = 0; p.wait = init ? rnd(.5, 5) : rnd(2.5, 8);
        }
      },
      step(p, dt) {
        if (p.kind === 'star') {
          p.t += dt;
          const k = .5 + .5 * Math.sin(p.t * p.pf);
          drawAt(SPR.gold, p.x, p.y, p.s, .15 + .5 * k);
          return;
        }
        if (p.wait > 0) { p.wait -= dt; return; }
        p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -200 || p.y > H + 200 || p.life > 1.6) { this.spawn(p, false); return; }
        const sp = Math.hypot(p.vx, p.vy), tx = p.x - p.vx / sp * p.len, ty = p.y - p.vy / sp * p.len;
        const fade = Math.min(1, p.life * 4) * Math.max(0, 1 - Math.max(0, p.life - 1) * 1.7);
        const gr = ctx.createLinearGradient(p.x, p.y, tx, ty);
        gr.addColorStop(0, `rgba(255,212,120,${.95 * fade})`);
        gr.addColorStop(1, 'rgba(255,212,120,0)');
        ctx.globalAlpha = 1; ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.stroke();
        drawAt(SPR.gold, p.x, p.y, 12, fade);
      },
    },
    bubble: {
      spawn(p, init) {
        p.r = rnd(8, 22); p.x = rnd(0, W); p.y = init ? rnd(H * .2, H) : H + p.r + rnd(0, 40);
        p.vy = rnd(15, 35); p.t = rnd(0, 10); p.sf = rnd(.6, 1.3); p.popY = rnd(-20, H * .55); p.pop = 0;
      },
      step(p, dt) {
        p.t += dt;
        if (p.pop > 0) { // 톡 터지기
          p.pop += dt;
          const k = p.pop / .25;
          if (k >= 1) { this.spawn(p, false); return; }
          drawAt(SPR.bubble, p.x, p.y, p.r * 2 * (1 + k * .5), .8 * (1 - k));
          return;
        }
        p.y -= p.vy * dt; p.x += Math.sin(p.t * p.sf) * 14 * dt;
        if (p.y < p.popY) p.pop = .001;
        const wob = 1 + Math.sin(p.t * 3) * .04;
        drawAt(SPR.bubble, p.x, p.y, p.r * 2 * wob, .8);
      },
    },
    heart: {
      spawn(p, init) {
        p.s = rnd(10, 18); p.x = rnd(0, W); p.y = init ? rnd(0, H) : H + rnd(10, 60);
        p.vy = rnd(20, 40); p.t = rnd(0, 10); p.sf = rnd(.6, 1.2); p.a = rnd(.5, .8);
      },
      step(p, dt) {
        p.t += dt; p.y -= p.vy * dt; p.x += Math.sin(p.t * p.sf) * 16 * dt;
        if (p.y < -20) this.spawn(p, false);
        const fade = Math.min(1, Math.max(0, p.y / (H * .3)));
        const beat = 1 + Math.max(0, Math.sin(p.t * 4)) * .08; // 콩닥
        drawRot(SPR.heart, p.x, p.y, p.s * beat, Math.sin(p.t * p.sf) * .25, 1, p.a * fade);
      },
    },
  };

  /* ───────── 터치 반응 ───────── */
  let bursts = [];
  function burstAt(x, y) {
    if (!cur) return;
    if (cur === 'firefly') {
      for (const p of parts) if (Math.hypot(p.x - x, p.y - y) < 240) { p.tx = x; p.ty = y; p.att = 2.5; }
      return;
    }
    if (cur === 'rain') {
      bursts.push({ k: 'ring', x, y, t: 0, max: .7 }, { k: 'ring', x, y, t: -.14, max: .7 });
      return;
    }
    const pick = {
      sakura: () => SPR.petal, leaves: () => SPR.leaf[Math.random() * 3 | 0], snow: () => SPR.snow,
      heart: () => SPR.heart, bubble: () => SPR.bubble, meteor: () => SPR.gold,
    }[cur];
    if (!pick) return;
    const up = cur === 'heart' || cur === 'bubble';
    const n = cur === 'meteor' ? 10 : 8;
    for (let i = 0; i < n; i++) {
      const ang = rnd(0, 6.28), sp = rnd(60, 170);
      bursts.push({
        k: 'spr', img: pick(), x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30,
        g: up ? -70 : 90, s: cur === 'snow' ? rnd(6, 10) : rnd(8, 14),
        rot: rnd(0, 6.28), vr: rnd(-4, 4), t: 0, max: rnd(.8, 1.3),
      });
    }
    if (bursts.length > 120) bursts.splice(0, bursts.length - 120);
  }
  function drawBursts(dt) {
    if (!bursts.length) return;
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.t += dt;
      if (b.t < 0) continue;
      if (b.t >= b.max) { bursts.splice(i, 1); continue; }
      const k = b.t / b.max;
      if (b.k === 'ring') {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const r = 6 + k * 34;
        ctx.globalAlpha = .6 * (1 - k);
        ctx.strokeStyle = 'rgb(120,150,195)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(b.x, b.y, r, r * .45, 0, 0, 6.283); ctx.stroke();
      } else {
        b.vx -= b.vx * 1.8 * dt;
        b.vy += b.g * dt - b.vy * 1.8 * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
        drawRot(b.img, b.x, b.y, b.s * (1 - k * .3), b.rot, 1, .9 * (1 - k));
      }
    }
  }
  document.addEventListener('click', e => {
    if (!cfg.touch || !cur || e.detail === 0) return; // 키보드(엔터)로 누른 건 무시
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(host) || (e.target.closest && e.target.closest('[data-crack-mood]'))) return;
    burstAt(e.clientX, e.clientY);
  }, { capture: true, passive: true });

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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBursts(dt);
  }
  function areaK() { return Math.min(1.6, Math.max(0.6, (W * H) / (390 * 844))); }
  function build() {
    const sys = SYS[cur];
    if (!sys) { parts = []; return; }
    const k = AMOUNTS[cfg.amount].k;
    const n = Math.round(BASE[cur] * k * areaK());
    if (sys.build) { parts = sys.build(n, k); return; }
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
    cur = id; bursts = []; build(); startLoop();
    requestAnimationFrame(() => { cv.style.opacity = CANVAS_OPACITY; });
    refreshUI();
  }
  function applyEffect(id) { // id: 실제로 보여줄 효과 또는 'off'
    clearTimeout(switchT);
    if (id === 'off') {
      cv.style.opacity = '0';
      switchT = setTimeout(() => { stopLoop(); cur = null; parts = []; bursts = []; ctx.clearRect(0, 0, W, H); refreshUI(); }, 850);
      return;
    }
    if (cur === id) return;
    if (cur) { // 스르륵 사라졌다가 새 효과로
      cv.style.opacity = '0';
      switchT = setTimeout(() => begin(id), 450);
    } else begin(id);
  }
  function choose(id) { // 사용자가 고른 것 ('auto' 포함)
    cfg.effect = id; save();
    if (id === 'auto') { autoLast = 0; autoScan(pageTail()); }
    else applyEffect(id);
    refreshUI();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else if (cur) startLoop();
  });
  let rT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => { resize(); placeBtn(); }, 150);
  });

  /* ───────── 자동 모드: 새로 뜬 글에서 장면 단어 찾기 ───────── */
  let autoSet = new Set(), autoT = 0, autoLast = 0;
  function score(text) {
    let best = null, bestN = 0;
    for (const id in KEYWORDS) {
      let n = 0;
      for (const w of KEYWORDS[id]) { let i = -1; while ((i = text.indexOf(w, i + 1)) !== -1) n++; }
      if (n > bestN) { bestN = n; best = id; }
    }
    return best;
  }
  function autoScan(text) {
    if (cfg.effect !== 'auto' || !text) return;
    const found = score(text);
    if (!found || found === cur) return;
    const now = Date.now();
    if (now - autoLast < 6000) return; // 너무 자주 바뀌지 않게
    autoLast = now;
    applyEffect(found);
  }
  function pageTail() {
    try { return (document.querySelector('main') || document.body).innerText.slice(-3000); } catch (e) { return ''; }
  }
  const mo = new MutationObserver(list => {
    if (cfg.effect !== 'auto') return;
    for (const m of list) {
      if (m.type === 'characterData') { if (m.target.parentElement) autoSet.add(m.target.parentElement); }
      else m.addedNodes.forEach(n => {
        const el = n.nodeType === 1 ? n : n.parentElement;
        if (el && el !== cv && el !== host) autoSet.add(el);
      });
    }
    if (autoSet.size > 300) autoSet = new Set([...autoSet].slice(-300));
    clearTimeout(autoT);
    autoT = setTimeout(() => { // 글이 다 써지고 1.5초 조용해지면 확인
      const text = [...autoSet]
        .filter(el => el.isConnected && !el.closest(FIND.ignoreText))
        .map(el => el.innerText || el.textContent || '')
        .join(' ').slice(-4000);
      autoSet.clear();
      autoScan(text);
    }, 1500);
  });

  /* ───────── 버튼 + 설정창 ───────── */
  const host = document.createElement('div');
  host.id = 'crack-mood-host';
  Object.assign(host.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', zIndex: '2147483001' });
  host.style.setProperty('pointer-events', 'auto', 'important'); // 크랙 메뉴가 열려 화면 터치를 막아도 우리 창은 눌리게
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
<style>
  :host{all:initial}
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",Pretendard,"Noto Sans KR",sans-serif;-webkit-tap-highlight-color:transparent}
  button{font:inherit;margin:0;cursor:pointer;touch-action:manipulation;pointer-events:auto}
  .sheet,.dim.show{pointer-events:auto}
  .fab{position:fixed;left:0;top:0;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.7);
    background:rgba(255,255,255,.75);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
    box-shadow:0 4px 16px rgba(0,0,0,.16);font-size:21px;line-height:1;display:flex;align-items:center;justify-content:center;
    padding:0;touch-action:none;user-select:none;-webkit-user-select:none;opacity:.88;
    transition:left .35s cubic-bezier(.32,.72,0,1),top .35s cubic-bezier(.32,.72,0,1),opacity .2s,box-shadow .25s}
  .fab.on{opacity:.95;box-shadow:0 4px 16px rgba(255,120,170,.3),0 0 0 2px rgba(255,175,205,.65)}
  .fab.drag{transition:none;opacity:1;box-shadow:0 10px 26px rgba(0,0,0,.25)}
  .fab.hide{display:none}
  .dim{position:fixed;inset:0;background:rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:opacity .3s}
  .dim.show{opacity:1;pointer-events:auto}
  .sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;max-width:480px;color:#1c1c1e;
    background:rgba(255,255,255,.96);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);
    border-radius:22px 22px 0 0;padding:10px 18px calc(20px + env(safe-area-inset-bottom));
    box-shadow:0 -6px 30px rgba(0,0,0,.15);transform:translateY(110%);visibility:hidden;
    transition:transform .42s cubic-bezier(.32,.72,0,1),visibility 0s linear .42s}
  .sheet.show{transform:translateY(0);visibility:visible;transition:transform .42s cubic-bezier(.32,.72,0,1),visibility 0s}
  .handle{width:38px;height:5px;border-radius:3px;background:#d1d1d6;margin:0 auto 12px}
  .title{display:flex;justify-content:space-between;align-items:center;margin:0 2px 14px}
  .title b{font-size:17px}
  .done{border:0;background:none;color:#ff5c8a;font-size:16px;font-weight:600;padding:6px 2px}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px}
  .tile{display:flex;flex-direction:column;align-items:center;gap:5px;padding:11px 0 9px;border-radius:16px;
    border:2px solid transparent;background:#f2f2f7;color:#3a3a3c;font-size:11.5px;white-space:nowrap;
    transition:transform .15s,background .2s,border-color .2s,color .2s}
  .tile .ic{font-size:25px;line-height:1;display:block}
  .tile:active{transform:scale(.93)}
  .tile.sel{background:#fff0f5;border-color:#ff8fb1;color:#d6336c;font-weight:700}
  .status{font-size:12.5px;color:#8e8e93;text-align:center;min-height:18px;margin:0 0 12px}
  .label{font-size:13px;color:#8e8e93;margin:0 0 8px 2px}
  .seg{display:flex;background:#eeeef0;border-radius:10px;padding:2px;transition:opacity .2s}
  .seg button{flex:1;height:34px;border:0;background:transparent;border-radius:8px;font-size:14px;color:#3a3a3c;transition:background .2s}
  .seg button.sel{background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.12);font-weight:600}
  .seg.dis{opacity:.4;pointer-events:none}
  .row{display:flex;justify-content:space-between;align-items:center;margin-top:16px;font-size:15px}
  .row small{display:block;font-size:12px;color:#8e8e93;margin-top:2px}
  .sw{width:51px;height:31px;border-radius:16px;border:0;background:#e5e5ea;position:relative;padding:0;flex:none;transition:background .25s}
  .sw::after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;
    box-shadow:0 2px 4px rgba(0,0,0,.2);transition:transform .25s cubic-bezier(.32,.72,0,1)}
  .sw.on{background:#ff7aa2}
  .sw.on::after{transform:translateX(20px)}
  .note{font-size:12px;color:#8e8e93;text-align:center;margin-top:16px;line-height:1.5}
  .toast{position:fixed;left:50%;bottom:calc(90px + env(safe-area-inset-bottom));transform:translate(-50%,10px);
    max-width:88vw;padding:10px 16px;border-radius:20px;background:rgba(30,30,32,.88);color:#fff;font-size:13px;line-height:1.45;
    text-align:center;opacity:0;pointer-events:none;transition:opacity .3s,transform .3s}
  .toast.show{opacity:1;transform:translate(-50%,0)}
  @media (prefers-color-scheme:dark){
    .fab{background:rgba(44,44,46,.75);border-color:rgba(255,255,255,.15)}
    .sheet{background:rgba(28,28,30,.96);color:#f2f2f7}
    .handle{background:#48484a}
    .tile{background:#2c2c2e;color:#e5e5ea}
    .tile.sel{background:#3a2430;color:#ff9fbf}
    .seg{background:#2c2c2e}
    .seg button{color:#e5e5ea}
    .seg button.sel{background:#48484a}
    .sw{background:#39393d}
  }
</style>
<button class="fab" aria-label="무드 배경 설정"></button>
<div class="dim"></div>
<div class="sheet" role="dialog" aria-label="무드 배경">
  <div class="handle"></div>
  <div class="title"><b>무드 배경</b><button class="done">완료</button></div>
  <div class="grid">${EFFECTS.map(e => `<button class="tile" data-id="${e.id}"><span class="ic">${e.icon}</span><span>${e.name}</span></button>`).join('')}</div>
  <div class="status"></div>
  <div class="label">양</div>
  <div class="seg">${AMOUNTS.map((a, i) => `<button data-i="${i}">${a.name}</button>`).join('')}</div>
  <div class="row"><div>터치하면 반응<small>화면을 톡 누르면 효과가 반응해요</small></div><button class="sw" role="switch" aria-label="터치하면 반응"></button></div>
  <div class="note">채팅 터치·스크롤은 그대로 돼요</div>
</div>
<div class="toast"></div>`;

  const fab = root.querySelector('.fab');
  const dim = root.querySelector('.dim');
  const sheet = root.querySelector('.sheet');
  const tiles = [...root.querySelectorAll('.tile')];
  const status = root.querySelector('.status');
  const seg = root.querySelector('.seg');
  const segBtns = [...seg.querySelectorAll('button')];
  const sw = root.querySelector('.sw');
  const toastEl = root.querySelector('.toast');

  function pop(el) {
    if (el && el.animate) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(.82)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
  }
  let toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 3500);
  }
  function iconNow() {
    if (cfg.effect === 'off') return OFF_ICON;
    if (cfg.effect === 'auto') return cur ? effInfo(cur).icon : '🪄';
    return effInfo(cfg.effect).icon;
  }
  function refreshUI() {
    fab.textContent = iconNow();
    fab.classList.toggle('on', cfg.effect !== 'off');
    tiles.forEach(t => t.classList.toggle('sel', t.dataset.id === cfg.effect));
    segBtns.forEach((b, i) => b.classList.toggle('sel', i === cfg.amount));
    seg.classList.toggle('dis', cfg.effect === 'off');
    sw.classList.toggle('on', !!cfg.touch);
    sw.setAttribute('aria-checked', cfg.touch ? 'true' : 'false');
    if (cfg.effect === 'auto') {
      const e = cur && effInfo(cur);
      status.textContent = e ? `🪄 대화에 맞춰 바뀌어요 · 지금은 ${e.icon} ${e.name}` : '🪄 대화에 맞춰 바뀌어요 · 아직 어울리는 장면이 없어요';
    } else status.textContent = '';
    if (inlineLabel) inlineLabel.textContent = iconNow();
  }

  /* 떠있는 버튼 위치 (양옆에 착 붙기) */
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
  let justDragged = 0;
  fab.addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    fab.classList.remove('drag');
    if (moved) {
      justDragged = Date.now();
      cfg.btn = { side: bx + 22 < W / 2 ? 'left' : 'right', y: by / Math.max(1, H - 44) };
      save(); placeBtn();
    }
  });
  fab.addEventListener('pointercancel', () => { drag = null; fab.classList.remove('drag'); placeBtn(); });
  fab.addEventListener('click', e => { // 열기는 click에서 (폰에서 터치가 두 번 먹는 문제 방지)
    e.preventDefault(); e.stopPropagation();
    if (Date.now() - justDragged < 400) return; // 끌어서 옮긴 직후엔 안 열기
    pop(fab); openSheet();
  });

  /* 설정창 */
  let openedAt = 0;
  function openSheet() {
    openedAt = Date.now();
    refreshUI(); dim.classList.add('show'); sheet.classList.add('show');
  }
  function closeSheet() { dim.classList.remove('show'); sheet.classList.remove('show'); }
  dim.addEventListener('click', () => {
    if (Date.now() - openedAt < 500) return; // 열자마자 따라온 터치로 바로 닫히지 않게
    closeSheet();
  });
  root.querySelector('.done').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

  tiles.forEach(t => t.addEventListener('click', () => {
    pop(t.querySelector('.ic'));
    if (cfg.effect === t.dataset.id) return;
    choose(t.dataset.id);
    pop(fab);
  }));
  segBtns.forEach((b, i) => b.addEventListener('click', () => {
    if (cfg.amount === i) return;
    cfg.amount = i; save(); refreshUI();
    if (cur) build();
  }));
  sw.addEventListener('click', () => { cfg.touch = !cfg.touch; save(); refreshUI(); });

  /* ───────── '배경이미지보기' 밑에 메뉴 버튼 넣기 ───────── */
  let bgItem = null, inlineBtn = null, inlineLabel = null, everFound = false, lastSearch = 0;

  function findBgItem() {
    for (const el of document.querySelectorAll(FIND.clickable)) {
      if (el.closest('[data-crack-mood]')) continue;
      const t = (el.textContent || '').trim();
      if (t.length < 40 && FIND.bgButtonText.test(t)) return el;
    }
    // 버튼 모양이 아닌 경우: 글자 칸을 찾아서 그 글자만 감싼 가장 바깥 칸으로
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const n = tw.currentNode;
      if (n.nodeValue.length > 40 || !FIND.bgButtonText.test(n.nodeValue)) continue;
      let el = n.parentElement;
      if (!el || el.closest('[data-crack-mood]')) continue;
      for (let i = 0; i < 4; i++) {
        const p = el.parentElement;
        if (!p || p === document.body || (p.textContent || '').trim() !== (el.textContent || '').trim()) break;
        el = p;
      }
      return el;
    }
    return null;
  }
  function makeInline(item) {
    const c = item.cloneNode(true); // 크랙 버튼 모양을 그대로 빌려 써요
    c.setAttribute('data-crack-mood', '1');
    c.removeAttribute('id'); c.removeAttribute('href');
    ['aria-checked', 'aria-pressed', 'aria-selected', 'data-state', 'disabled'].forEach(a => c.removeAttribute(a));
    if (c.getAttribute('role') === 'switch') c.setAttribute('role', 'button');
    c.querySelectorAll('input,[role="switch"],[id]').forEach(n => { if (n.matches('input,[role="switch"]')) n.remove(); else n.removeAttribute('id'); });
    const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT), texts = [];
    while (tw.nextNode()) if (tw.currentNode.nodeValue.trim()) texts.push(tw.currentNode);
    texts.forEach((n, i) => { n.nodeValue = i === 0 ? '무드 배경' : ''; });
    if (!texts.length) c.textContent = '무드 배경';
    inlineLabel = document.createElement('span');
    inlineLabel.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:1.3em;font-size:1.05em;line-height:1;flex:none';
    const svg = c.querySelector('svg, img');
    if (svg) svg.replaceWith(inlineLabel);
    else { inlineLabel.style.marginRight = '6px'; (texts[0] ? texts[0].parentNode : c).insertBefore(inlineLabel, texts[0] || c.firstChild); }
    inlineLabel.textContent = iconNow();
    // 크랙 메뉴가 터치하자마자 닫히면서 버튼이 사라질 수 있어서, 손 뗄 때 바로 열어요
    let down = null;
    c.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; e.stopPropagation(); }, true);
    c.addEventListener('pointerup', e => {
      e.stopPropagation();
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down = null; return; }
      down = null;
      openSheet();
    }, true);
    c.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (Date.now() - openedAt > 600) openSheet(); // 키보드 등으로 눌렀을 때
    }, true);
    return c;
  }
  function ensureInline() {
    if (inlineBtn && inlineBtn.isConnected && bgItem && bgItem.isConnected) return;
    const now = Date.now();
    if (now - lastSearch < 1200) return;
    lastSearch = now;
    const item = findBgItem();
    if (!item) return;
    if (inlineBtn) inlineBtn.remove();
    bgItem = item;
    inlineBtn = makeInline(item);
    item.after(inlineBtn);
    everFound = true;
  }
  function inlineVisible() {
    return !!(inlineBtn && inlineBtn.isConnected && inlineBtn.getClientRects().length);
  }

  /* ───────── 붙이기 ───────── */
  function mount() {
    if (!document.body) return;
    if (!document.body.contains(cv)) document.body.appendChild(cv);
    if (!document.body.contains(host)) document.body.appendChild(host);
  }
  function tick() {
    mount();
    try { ensureInline(); } catch (e) {}
    fab.classList.toggle('hide', inlineVisible()); // 메뉴 버튼이 보이면 떠있는 버튼은 숨겨요
  }
  mount();
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  placeBtn();
  refreshUI();
  if (cfg.effect === 'auto') setTimeout(() => autoScan(pageTail()), 1500);
  else if (cfg.effect !== 'off') applyEffect(cfg.effect);
  setInterval(tick, 1000);
  tick();
  setTimeout(() => {
    if (everFound) return;
    try {
      if (sessionStorage.getItem('crackMood.toast')) return;
      sessionStorage.setItem('crackMood.toast', '1');
    } catch (e) {}
    toast("'배경이미지보기' 버튼을 아직 못 찾았어요. 옆에 떠있는 🎐 버튼으로 쓸 수 있어요");
  }, 10000);
})();
