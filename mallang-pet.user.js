// ==UserScript==
// @name         크랙 말랑펫
// @namespace    https://github.com/mywishluv/wishlite
// @version      2.0.0
// @description  크랙 채팅 화면 구석에서 키우는 픽셀 펫. 내가 크랙에서 보낸 말을 듣고 반응하며 자라요.
// @author       muz
// @match        https://crack.wrtn.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://github.com/mywishluv/wishlite/raw/main/crack-mallang-pet.user.js
// @updateURL    https://github.com/mywishluv/wishlite/raw/main/crack-mallang-pet.user.js
// ==/UserScript==
// v2.0.0 - 픽셀 펫으로 변신(몸·귀·눈·코·입·볼·장식·색 조립), 크랙에서 내가 보낸 말(지문 포함)을 듣고 반응·성장, 오늘 대화 통계
// v1.0.0 - 첫 버전: 돌보기(밥·놀기·잠·약), 성장·진화, 방치하면 아프고 떠남, 이름·색·장식 꾸미기, 말 걸면 알아듣고 반응

(function () {
  'use strict';

  /* =========================================================
   * 설정 — 숫자만 바꿔도 난이도를 조절할 수 있어요
   * ========================================================= */
  const CONFIG = {
    hatchMinutes: 10,      // 알이 깨어나는 데 걸리는 시간(분)
    babyHours: 24,         // 이만큼 자라면 아기 → 어린이
    childHours: 72,        // 이만큼 자라면 어린이 → 어른
    chatGrowHours: 0.25,   // 크랙에서 말 1번 보낼 때마다 이만큼(시간) 더 자란 걸로 쳐요
    perHourAwake: { hunger: -7, fun: -6, energy: -4 },
    perHourSleep: { hunger: -3, fun: -1, energy: 25 },
    healthDropPerLow: 2,
    sickExtraDrop: 1,
    healthRecover: 4,
    sickBelow: 40,
    maxOfflineHours: 24 * 7,
    tickSeconds: 20,
  };
  const STORE_KEY = 'mallangpet_v1';

  /* =========================================================
   * 크랙 화면 찾기 — 크랙이 바뀌면 여기만 고치면 돼요
   * ========================================================= */
  const SEL = {
    message: '[data-message-group-id]',   // 메시지 한 덩어리
    messageId: 'data-message-group-id',
    text: '.wrtn-markdown',               // 메시지 글자 부분
    botOnly: 'img[alt="model"]',          // 캐릭터 답장에만 있는 '이어서 생성' 모델 아이콘
    // 내가 보낸 말인지: 글 상자가 rounded-lg (캐릭터 답장은 rounded-none)
    isMine(msg, textEl) {
      const box = textEl.parentElement;
      if (!box) return false;
      if (msg.querySelector(this.botOnly)) return false;
      if (box.classList.contains('rounded-none')) return false;
      return box.classList.contains('rounded-lg');
    },
  };

  /* ===================== 공용 ===================== */
  const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hasBatchim = (s) => {
    const c = s.charCodeAt(s.length - 1);
    return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  };
  const josa = (s, a, b) => s + (hasBatchim(s) ? a : b);
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

  /* PIXEL-START */
  /* =========================================================
   * 픽셀 그림 (24 x 24)
   * ========================================================= */
  const N = 24;
  const INK = '#3A2E2E';

  const SHAPES = {
    round: { name: '동글', rx: 9.5, ry: 8, n: 2 },
    mochi: { name: '말랑', rx: 10.5, ry: 7, n: 2.8 },
    tall: { name: '길쭉', rx: 7.5, ry: 9.5, n: 2.2 },
    square: { name: '네모', rx: 9, ry: 8, n: 4 },
  };
  const STAGE_SCALE = { baby: 0.64, child: 0.82, adult: 1 };
  const TOPS = { none: '없음', bear: '곰귀', cat: '고양이귀', bunny: '토끼귀', bangs: '앞머리', antenna: '더듬이', sprout: '새싹' };
  const EYES = {
    dot: { name: '점눈', rows: ['E', 'E'] },
    round: { name: '동글눈', rows: ['EW', 'EE'] },
    big: { name: '왕눈', rows: ['EEW', 'EEE', '.E.'] },
    shine: { name: '반짝눈', rows: ['EWE', 'EEE', 'EEW'] },
    sleepy: { name: '졸린눈', rows: ['KKK', 'EEE'] },
    sharp: { name: '째릿눈', rows: ['KKK', '.EE'], mirror: true },
    smile: { name: '웃는눈', rows: ['.K.', 'K.K'] },
  };
  const EXPR_EYES = {
    happy: ['.K.', 'K.K'],
    sleep: ['K.K', '.K.'],
    sick: ['K.K', '.K.', 'K.K'],
    love: ['L.L', 'LLL', '.L.'],
  };
  const NOSES = {
    none: { name: '없음', rows: [] },
    dot: { name: '점코', rows: ['K'] },
    pink: { name: '분홍코', rows: ['P'] },
    animal: { name: '동물코', rows: ['KKK', '.K.'] },
  };
  const MOUTHS = {
    small: { name: '미소', rows: ['K.K', '.K.'] },
    smile: { name: '활짝', rows: ['K...K', '.KKK.'] },
    cat: { name: '고양이입', rows: ['K.K.K', '.K.K.'] },
    o: { name: '오', rows: ['.K.', 'K.K', '.K.'] },
    tongue: { name: '메롱', rows: ['KKK', '.M.'] },
    line: { name: '무표정', rows: ['KKK'] },
  };
  const CHEEKS = {
    none: { name: '없음', rows: [] },
    blush: { name: '발그레', rows: ['PP'] },
    round: { name: '동글볼', rows: ['PP', 'PP'] },
    line: { name: '빗금', rows: ['.Q', 'Q.'] },
  };
  const ACCS = { none: '없음', ribbon: '리본', flower: '꽃', crown: '왕관', hat: '모자', glasses: '안경' };

  const BODY_COLORS = ['#FFC8B4', '#FFB3C7', '#FFEBA8', '#BDEBD6', '#C4DEFF', '#E2D2FF', '#E3C3A8', '#F4F4F4', '#6E6E7A'];
  const HAIR_COLORS = ['#3A2E2E', '#8A5A3C', '#F2D16B', '#E8E8EE', '#FF8FB1', '#7DA7F0', '#9C7BE0', '#D9534F'];
  const EYE_COLORS = ['#3A2E2E', '#7B4A2A', '#3D7BE0', '#3FA36B', '#D64545', '#8B5CD6', '#E0A800'];
  const DEFAULT_LOOK = { shape: 'round', top: 'bear', eyes: 'round', nose: 'none', mouth: 'small', cheeks: 'blush', acc: 'none', body: '#FFC8B4', hair: null, eye: '#3A2E2E' };

  function hexToRgb(h) {
    h = String(h || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const toHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const shade = (h, f) => { const [r, g, b] = hexToRgb(h); return toHex(r * f, g * f, b * f); };
  const tint = (h, f) => { const [r, g, b] = hexToRgb(h); return toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f); };
  const mix = (a, b, f) => { const A = hexToRgb(a), B = hexToRgb(b); return toHex(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f); };
  const lineOf = (h) => { const [r, g, b] = hexToRgb(h); const l = 0.299 * r + 0.587 * g + 0.114 * b; return l < 90 ? shade(h, 0.55) : shade(h, 0.7); };

  function Canvas() {
    const g = [];
    for (let y = 0; y < N; y++) g.push(new Array(N).fill(null));
    return {
      g,
      set(x, y, c) { if (c && x >= 0 && x < N && y >= 0 && y < N) g[y][x] = c; },
    };
  }
  function fillMask(cv, mask, fill, line) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!mask(x, y)) continue;
      const edge = !mask(x - 1, y) || !mask(x + 1, y) || !mask(x, y - 1) || !mask(x, y + 1);
      cv.set(x, y, edge ? line : fill);
    }
  }
  function stamp(cv, rows, left, top, pal, clip) {
    rows.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        if (ch === '.' || ch === ' ') return;
        const x = left + dx, y = top + dy;
        if (clip && !clip(x, y)) return;
        cv.set(x, y, pal[ch]);
      });
    });
  }
  // 왼쪽 중심 cL에 찍고, 오른쪽엔 좌우 대칭 위치에 찍어요
  function stampPair(cv, rows, cL, top, pal, clip, mirrorContent) {
    if (!rows.length) return;
    const w = Math.max(...rows.map((r) => r.length));
    const l = cL - Math.floor(w / 2);
    stamp(cv, rows, l, top, pal, clip);
    const rRows = mirrorContent ? rows.map((r) => [...r.padEnd(w, '.')].reverse().join('')) : rows;
    stamp(cv, rRows, 22 - (l + w - 1), top, pal, clip);
  }
  function toSVG(cv) {
    let s = '';
    for (let y = 0; y < N; y++) {
      let x = 0;
      while (x < N) {
        const c = cv.g[y][x];
        if (!c) { x++; continue; }
        let w = 1;
        while (x + w < N && cv.g[y][x + w] === c) w++;
        s += `<rect x="${x}" y="${y}" width="${w}" height="1.02" fill="${c}"/>`;
        x += w;
      }
    }
    return `<svg viewBox="0 0 ${N} ${N}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${s}</svg>`;
  }

  function drawEgg(p) {
    const cv = Canvas();
    const L = p.look;
    const cy = 14;
    const mask = (x, y) => {
      const dy = y + 0.5 - cy;
      const rx = 6.6, ry = dy < 0 ? 8.2 : 7.6;
      const kx = dy < 0 ? rx * (1 + dy / 30) : rx;
      return x >= 0 && y >= 0 && x < N && y < N && Math.pow((x - 11) / kx, 2) + Math.pow(dy / ry, 2) <= 1;
    };
    for (let x = 0; x < N; x++) if (Math.abs(x - 11) <= 5) cv.set(x, 22, 'rgba(0,0,0,0.10)');
    fillMask(cv, mask, '#FFF6E9', lineOf(L.body));
    const inner = (x, y) => mask(x, y) && mask(x - 1, y) && mask(x + 1, y) && mask(x, y - 1) && mask(x, y + 1);
    const spot = L.body;
    [[8, 10], [9, 10], [8, 11], [13, 8], [14, 15], [15, 15], [14, 16], [15, 16], [7, 18], [11, 19], [12, 19]].forEach(([x, y]) => inner(x, y) && cv.set(x, y, spot));
    cv.set(9, 9, '#FFFFFF');
    const prog = clamp(((Date.now() - p.born) / (CONFIG.hatchMinutes * 60000) + (p.xp || 0) * CONFIG.chatGrowHours * 60 / CONFIG.hatchMinutes) * 100) / 100;
    if (prog > 0.5) [[6, 13], [7, 12], [8, 13], [9, 12], [10, 13], [11, 12], [12, 13], [13, 12], [14, 13], [15, 12], [16, 13]].forEach(([x, y]) => inner(x, y) && cv.set(x, y, INK));
    if (prog > 0.85) [[11, 8], [12, 9], [11, 10]].forEach(([x, y]) => inner(x, y) && cv.set(x, y, INK));
    return toSVG(cv);
  }

  function drawPet(p, expr) {
    if (p.gone) return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><text x="12" y="16" text-anchor="middle" font-size="11">🍃</text></svg>`;
    if (p.stage === 'egg') return drawEgg(p);
    const L = Object.assign({}, DEFAULT_LOOK, p.look || {});
    const cv = Canvas();
    const S = SHAPES[L.shape] || SHAPES.round;
    const k = STAGE_SCALE[p.stage] || 1;
    const rx = S.rx * k, ry = S.ry * k, n = S.n, cy = 22 - ry;
    const inBody = (x, y) => x >= 0 && x < N && y >= 0 && y < N &&
      Math.pow(Math.abs((x - 11) / rx), n) + Math.pow(Math.abs((y + 0.5 - cy) / ry), n) <= 1;
    const interior = (x, y) => inBody(x, y) && inBody(x - 1, y) && inBody(x + 1, y) && inBody(x, y - 1) && inBody(x, y + 1);
    let top = 0; while (top < N && !inBody(11, top)) top++;

    let body = L.body;
    if (expr === 'sick') body = mix(body, '#B9E4B2', 0.4);
    const line = lineOf(body);
    const hair = L.hair || L.body;
    const hairLine = lineOf(hair);
    const ox = Math.max(2, Math.round(rx * 0.6));
    const pal = { K: INK, E: L.eye, W: '#FFFFFF', M: '#D6455D', P: '#FF9DB0', Q: '#F27A93', L: '#FF4D7A', B: '#7EC8FF', Y: '#FFD54A', O: '#E0A800', R: '#FF6F91', D: '#D94B72', F: '#FFB3C7', C: '#FFD54A', G: '#3A3A44', h: '#4A4A5A', T: '#F3D3A3', t: '#D9AE73', g: '#6CC46A', G2: '#3E8E41' };

    // 그림자
    for (let x = 0; x < N; x++) if (Math.abs(x - 11) <= rx * 0.75) cv.set(x, 22, 'rgba(0,0,0,0.10)');

    // 몸 뒤쪽 부품(귀)
    const t = L.top;
    if (t === 'bear') {
      const r = 1.5 + 0.8 * k;
      const ear = (x, y) => Math.hypot(x - (11 - ox), y - (top + 0.5)) <= r || Math.hypot(x - (11 + ox), y - (top + 0.5)) <= r;
      fillMask(cv, ear, hair, hairLine);
      if (p.stage !== 'baby') { cv.set(11 - ox, top, pal.P); cv.set(11 + ox, top, pal.P); }
    } else if (t === 'cat') {
      const h = Math.round(3 + 2 * k);
      const ear = (x, y) => {
        const r = y - (top + 1 - h);
        if (r < 0 || r > h + 1) return false;
        const hw = Math.floor(r * 0.65);
        return Math.abs(x - (11 - ox)) <= hw || Math.abs(x - (11 + ox)) <= hw;
      };
      fillMask(cv, ear, hair, hairLine);
      if (p.stage !== 'baby') { cv.set(11 - ox, top - 1, pal.P); cv.set(11 + ox, top - 1, pal.P); }
    } else if (t === 'bunny') {
      const bx = Math.max(2, Math.round(rx * 0.4)), h = Math.round(4 + 3 * k);
      const ear = (x, y) => {
        if (y < top + 1 - h || y > top + 1) return false;
        const cxs = [11 - bx, 11 + bx];
        return cxs.some((c) => Math.abs(x - c) <= 1 && !(y === top + 1 - h && Math.abs(x - c) === 1));
      };
      fillMask(cv, ear, hair, hairLine);
      for (let y = top + 2 - h; y <= top - 1; y++) { cv.set(11 - bx, y, pal.P); cv.set(11 + bx, y, pal.P); }
    }

    // 몸
    fillMask(cv, inBody, body, line);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (interior(x, y) && !inBody(x, y + 2)) cv.set(x, y, shade(body, 0.93));
    const hx = 11 - Math.round(rx * 0.55);
    [[hx, top + 2], [hx + 1, top + 2], [hx, top + 3]].forEach(([x, y]) => interior(x, y) && cv.set(x, y, tint(body, 0.6)));

    // 몸 앞쪽 부품(앞머리, 더듬이, 새싹)
    if (t === 'bangs') {
      const base = Math.round(1.5 + 2 * k);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!inBody(x, y)) continue;
        const depth = base + ((x + 1) % 3 === 0 ? 1 : 0);
        if (y > top + depth) continue;
        const edge = !interior(x, y) || y === top + depth;
        cv.set(x, y, edge ? hairLine : hair);
      }
    } else if (t === 'antenna') {
      [[9, top - 1], [8, top - 2]].forEach(([x, y]) => { cv.set(x, y, INK); cv.set(22 - x, y, INK); });
      [[7, top - 4], [8, top - 4], [7, top - 3], [8, top - 3]].forEach(([x, y]) => { cv.set(x, y, hair); cv.set(22 - x, y, hair); });
      cv.set(7, top - 4, tint(hair, 0.5)); cv.set(15, top - 4, tint(hair, 0.5));
    } else if (t === 'sprout') {
      cv.set(11, top - 1, '#3E8E41'); cv.set(11, top - 2, '#3E8E41');
      [[9, top - 3], [10, top - 3], [10, top - 4]].forEach(([x, y]) => cv.set(x, y, '#6CC46A'));
      [[12, top - 3], [13, top - 3], [13, top - 4], [14, top - 4]].forEach(([x, y]) => cv.set(x, y, '#6CC46A'));
    }

    // 얼굴
    const eyeMid = Math.round(cy - ry * 0.1);
    const eDX = Math.max(3, Math.round(rx * 0.42));
    const cL = 11 - eDX;
    const E = EYES[L.eyes] || EYES.round;
    const eyeRows = EXPR_EYES[expr] || E.rows;
    const eyeTop = eyeMid - Math.floor(eyeRows.length / 2);
    stampPair(cv, eyeRows, cL, eyeTop, pal, null, !EXPR_EYES[expr] && E.mirror);
    if (expr === 'angry') stampPair(cv, ['K..', '.KK'], cL, eyeTop - 2, pal, interior, true);
    if (expr === 'sad') {
      stampPair(cv, ['.KK', 'K..'], cL, eyeTop - 2, pal, interior, true);
      [[cL - 1, eyeTop + eyeRows.length], [cL - 1, eyeTop + eyeRows.length + 1]].forEach(([x, y]) => interior(x, y) && cv.set(x, y, pal.B));
    }
    // 볼
    const ch = CHEEKS[L.cheeks] || CHEEKS.none;
    stampPair(cv, ch.rows, cL - 1, eyeMid + 3 - ch.rows.length, pal, interior);
    // 코
    const no = NOSES[L.nose] || NOSES.none;
    if (no.rows.length) { const w = no.rows[0].length; stamp(cv, no.rows, 11 - Math.floor(w / 2), eyeMid + 2, pal, interior); }
    // 입
    let mRows = (MOUTHS[L.mouth] || MOUTHS.small).rows;
    if ((expr === 'happy' || expr === 'love') && !['cat', 'tongue'].includes(L.mouth)) mRows = ['KKKKK', '.MMM.'];
    else if (expr === 'sad' || expr === 'sick') mRows = ['.K.', 'K.K'];
    else if (expr === 'angry') mRows = ['KKK'];
    else if (expr === 'sleep') mRows = ['K'];
    const mTop = eyeMid + 2 + Math.max(1, no.rows.length);
    const mw = Math.max(...mRows.map((r) => r.length));
    stamp(cv, mRows, 11 - Math.floor(mw / 2), mTop, pal, interior);

    // 장식
    const a = L.acc;
    if (a === 'ribbon') stamp(cv, ['RR.RR', 'RRDRR', 'RR.RR'], 11 + ox - 2, top - 1, pal);
    else if (a === 'flower') stamp(cv, ['.F.', 'FCF', '.F.'], 11 - ox - 1, top, pal);
    else if (a === 'crown') stamp(cv, ['Y.Y.Y', 'YYYYY', 'OOOOO'], 9, top - 2, pal);
    else if (a === 'hat') stamp(cv, ['.hhhhh.', '.hhhhh.', '.RRRRR.', 'hhhhhhh'], 8, top - 3, pal);
    else if (a === 'glasses') {
      const box = ['GGGGG', 'G...G', 'G...G', 'G...G', 'GGGGG'];
      stampPair(cv, box, cL, eyeMid - 2, pal);
      for (let x = cL + 3; x <= 22 - cL - 3; x++) cv.set(x, eyeMid - 1, pal.G);
    }
    // 진화 모습
    if (p.form === 'shiny') stamp(cv, ['.Y.', 'YWY', '.Y.'], Math.min(21, 11 + Math.round(rx)), top - 2, pal);
    if (p.form === 'naughty') stamp(cv, ['TtT'], 22 - cL + 0, eyeMid + 2, pal, interior);
    if (expr === 'sick') [[11 + Math.round(rx * 0.6), top + 2], [11 + Math.round(rx * 0.6), top + 3]].forEach(([x, y]) => interior(x, y) && cv.set(x, y, pal.B));

    return toSVG(cv);
  }
  /* PIXEL-END */

  /* ===================== 저장 ===================== */
  const store = {
    get() {
      try {
        const raw = typeof GM_getValue === 'function' ? GM_getValue(STORE_KEY, null) : localStorage.getItem(STORE_KEY);
        return raw ? migrate(JSON.parse(raw)) : null;
      } catch (e) { return null; }
    },
    set(v) {
      try {
        const s = JSON.stringify(v);
        if (typeof GM_setValue === 'function') GM_setValue(STORE_KEY, s);
        else localStorage.setItem(STORE_KEY, s);
      } catch (e) { /* 저장 실패해도 계속 */ }
    },
  };

  const V1_COLORS = { peach: '#FFC8B4', mint: '#BDEBD6', sky: '#C4DEFF', lemon: '#FFEBA8', lilac: '#E2D2FF', cocoa: '#E3C3A8' };
  function migrate(s) {
    if (!s) return s;
    if (!s.look) {
      s.look = Object.assign({}, DEFAULT_LOOK, { body: V1_COLORS[s.color] || DEFAULT_LOOK.body, acc: ACCS[s.acc] ? s.acc : 'none' });
    }
    s.look = Object.assign({}, DEFAULT_LOOK, s.look);
    if (s.xp == null) s.xp = 0;
    if (s.chats == null) s.chats = 0;
    if (s.good == null) s.good = 0;
    if (s.bad == null) s.bad = 0;
    if (!s.day) s.day = { d: todayKey(), chats: 0, good: 0, bad: 0 };
    s.v = 2;
    return s;
  }

  function newPet(keep) {
    const now = Date.now();
    return migrate({
      v: 2,
      name: (keep && keep.name) || '말랑이',
      look: keep && keep.look ? Object.assign({}, keep.look) : Object.assign({}, DEFAULT_LOOK),
      hidden: (keep && keep.hidden) || false,
      pos: (keep && keep.pos) || null,
      day: keep && keep.day,
      born: now, last: now, stage: 'egg', form: null,
      hunger: 80, fun: 80, energy: 80, health: 100,
      sleeping: false, sick: false, gone: false,
      care: 0, careHours: 0, xp: 0, chats: 0, good: 0, bad: 0,
    });
  }

  /* ===================== 시간 흐름 ===================== */
  const events = [];

  function growHours(p, t) { return (t - p.born) / 3600000 + (p.xp || 0) * CONFIG.chatGrowHours; }

  function updateStage(p, t) {
    const g = growHours(p, t);
    const s = g < CONFIG.hatchMinutes / 60 ? 'egg' : g < CONFIG.babyHours ? 'baby' : g < CONFIG.childHours ? 'child' : 'adult';
    const order = ['egg', 'baby', 'child', 'adult'];
    if (order.indexOf(s) > order.indexOf(p.stage)) {
      p.stage = s;
      if (s === 'adult' && !p.form) {
        let score = p.careHours ? p.care / p.careHours : 50;
        score += Math.min(10, (p.good || 0) * 0.2) - Math.min(10, (p.bad || 0) * 0.3);
        p.form = score >= 70 ? 'shiny' : score >= 45 ? 'normal' : 'naughty';
      }
      events.push({ type: 'grow', to: s });
    }
  }

  function simulate(p, now) {
    let remain = Math.min((now - p.last) / 3600000, CONFIG.maxOfflineHours);
    let t = now - remain * 3600000;
    p.last = now;
    if (p.gone || remain <= 0) { updateStage(p, now); return; }
    const STEP = 0.1;
    while (remain > 0 && !p.gone) {
      const h = Math.min(STEP, remain);
      remain -= h; t += h * 3600000;
      updateStage(p, t);
      if (p.stage === 'egg') continue;
      const r = p.sleeping ? CONFIG.perHourSleep : CONFIG.perHourAwake;
      p.hunger = clamp(p.hunger + r.hunger * h);
      p.fun = clamp(p.fun + r.fun * h);
      p.energy = clamp(p.energy + r.energy * h);
      if (p.sleeping && p.energy >= 100) { p.sleeping = false; events.push({ type: 'woke' }); }

      const low = (p.hunger < 20) + (p.fun < 15) + (p.energy < 10);
      if (low) p.health -= CONFIG.healthDropPerLow * low * h;
      else if (!p.sick && (p.hunger + p.fun + p.energy) / 3 > 60) p.health += CONFIG.healthRecover * h;
      if (p.sick) p.health -= CONFIG.sickExtraDrop * h;
      p.health = clamp(p.health);
      if (!p.sick && p.health < CONFIG.sickBelow) { p.sick = true; events.push({ type: 'sick' }); }
      if (p.health <= 0) { p.gone = true; p.sleeping = false; events.push({ type: 'gone' }); }

      p.care += ((p.hunger + p.fun + p.energy + p.health) / 4) * h;
      p.careHours += h;
    }
    updateStage(p, now);
  }

  /* ===================== 크랙 대화 알아듣기 ===================== */
  // 띄어쓰기를 지운 문장에 이 글자가 들어 있으면 반응해요 (*지문*도 같이 읽어요)
  const WORDS = {
    love: ['사랑', '좋아해', '좋아한', '보고싶', '보고 싶', '귀여', '귀엽', '예뻐', '이뻐', '잘생', '멋져', '멋있', '고마워', '고맙', '최고', '설레', '두근',
      '안아', '안는', '안았', '껴안', '포옹', '뽀뽀', '키스', '입맞', '쓰다듬', '토닥', '손잡', '손을잡', '기대', '부비', '웃는다', '웃었', '미소', '헤헤', '히히', '♡', '❤', '💕', '자기야', '여보'],
    bad: ['싫어', '미워', '짜증', '꺼져', '닥쳐', '바보', '멍청', '죽여', '죽을래', '시발', '씨발', 'ㅅㅂ', '개새', '병신', '미친', '때리', '때린', '때렸', '밀쳐', '밀친', '노려', '화내', '화났', '나빠', '실망', '헤어지', '헤어져'],
    sad: ['울어', '울었', '운다', '울먹', '눈물', '훌쩍', '흑흑', 'ㅠㅠ', 'ㅜㅜ', '슬퍼', '슬프', '외로', '힘들', '아파', '아프'],
    food: ['먹어', '먹자', '먹여', '먹었', '밥', '간식', '맛있', '달달', '도넛', '케이크', '배고'],
    sleep: ['잘자', '졸려', '졸리', '자자', '잠들', '침대', '하품', '하암'],
    hello: ['안녕', '다녀왔', '왔어', '좋은아침', '굿모닝'],
  };
  const NEG = /(안|못)(좋|예뻐|이뻐|귀여|귀엽|멋)|별로|안사랑/;

  function analyze(text) {
    const t = text.replace(/\s+/g, '');
    const count = (k) => WORDS[k].reduce((n, w) => n + (t.includes(w.replace(/\s+/g, '')) ? 1 : 0), 0);
    const neg = NEG.test(t);
    const c = { love: neg ? 0 : count('love'), bad: count('bad') + (neg ? 1 : 0), sad: count('sad'), food: count('food'), sleep: count('sleep'), hello: count('hello') };
    if (c.bad && c.bad >= c.love) return 'bad';
    if (c.love) return 'love';
    if (c.sad) return 'sad';
    if (c.food) return 'food';
    if (c.sleep) return 'sleep';
    if (c.hello) return 'hello';
    return 'neutral';
  }

  const REACT = {
    love: { fx: '💕', expr: 'love', lines: ['헤헤, 달달하다…♡', '나까지 두근거려!', '오늘 분위기 좋다!', '꺄아~'] },
    bad: { fx: '💢', expr: 'sad', lines: ['히익… 무서워', '싸우지 마…', '(눈치 보는 중)', '나 숨어 있을게…'] },
    sad: { fx: '💧', expr: 'sad', lines: ['울지 마… 내가 있잖아', '토닥토닥…', '괜찮아, 괜찮아'] },
    food: { fx: '🍩', expr: 'happy', lines: ['나도 한 입만!', '냠, 얻어먹었다!', '맛있겠다…'] },
    sleep: { fx: '💤', expr: 'sleep', lines: ['나도 졸려…', '같이 코 자자'] },
    hello: { fx: '👋', expr: 'happy', lines: ['왔구나! 기다렸어', '안녕안녕!'] },
    neutral: { fx: '💬', expr: null, lines: ['(귀 쫑긋)', '오호…', '(열심히 듣는 중)', '그래서 그래서?'] },
  };

  /* ===================== 혼잣말 ===================== */
  const LINES = {
    hello: ['왔구나! 보고 싶었어', '안녕안녕!', '반가워!'],
    sleepTalk: ['쿨… 쿨…', '음냐… 밥…', '(잠꼬대 중)'],
    hungry: ['배고파…', '꼬르륵…'],
    bored: ['심심해…', '놀아줘…'],
    sleepy: ['졸려…', '하암…'],
    sick: ['몸이 안 좋아…', '으슬으슬해…'],
    idle: ['오늘은 무슨 얘기 할 거야?', '여기 있으면 좋아', '랄랄라~', '같이 있어서 좋다'],
    fed: ['냠냠! 맛있어', '배불러~', '고마워!'],
    full: ['더는 못 먹어…'],
    played: ['재밌다!', '한 번 더!', '꺄르르'],
    tired: ['너무 졸려서 못 놀아…'],
    pet: ['헤헤 간지러워', '쓰담쓰담 좋아'],
    med: ['으, 써…! 그래도 나아지는 것 같아'],
  };

  /* ===================== 화면 ===================== */
  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",sans-serif;-webkit-tap-highlight-color:transparent;margin:0}
  button{font:inherit;cursor:pointer}
  [hidden]{display:none!important}
  svg{display:block;width:100%;height:100%}
  .fab{position:fixed;width:60px;height:60px;border-radius:30px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer}
  .fab-pet{width:50px;height:50px;pointer-events:none}
  .fab.react .fab-pet{animation:jump .5s ease}
  .fab-fx{position:absolute;left:50%;top:-4px;font-size:22px;pointer-events:none;animation:fabup 1.3s ease forwards}
  @keyframes fabup{0%{opacity:0;transform:translate(-50%,8px) scale(.6)}25%{opacity:1;transform:translate(-50%,-10px) scale(1.1)}100%{opacity:0;transform:translate(-50%,-38px)}}
  .dot{position:absolute;top:3px;right:3px;width:14px;height:14px;border-radius:7px;background:#FF3B30;border:2px solid #fff;display:none}
  .fab.alert .dot{display:block}
  .bg{position:fixed;inset:0;background:rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:opacity .2s}
  .open .bg{opacity:1;pointer-events:auto}
  .sheet{position:fixed;left:50%;bottom:0;transform:translate(-50%,105%);width:100%;max-width:420px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:#F2F2F7;border-radius:20px 20px 0 0;padding:8px 16px calc(16px + env(safe-area-inset-bottom));transition:transform .28s cubic-bezier(.2,.8,.2,1);color:#1C1C1E;box-shadow:0 -4px 24px rgba(0,0,0,.12)}
  .open .sheet{transform:translate(-50%,0)}
  .grab{width:36px;height:5px;border-radius:3px;background:#C7C7CC;margin:0 auto 10px}
  .head{display:flex;align-items:center;gap:8px;margin-bottom:12px}
  .title{flex:1;min-width:0}
  .name{font-size:20px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sub{font-size:13px;color:#8E8E93;margin-top:2px}
  .ibtn{width:40px;height:40px;border-radius:20px;border:0;background:#fff;font-size:17px;color:#3A3A3C;display:flex;align-items:center;justify-content:center;flex:none}
  .stage{position:relative;height:210px;border-radius:18px;background:linear-gradient(#FFF8F2,#FFE6D8);overflow:hidden;display:flex;align-items:flex-end;justify-content:center;transition:background .4s}
  .stage.night{background:linear-gradient(#2B2D4A,#4A4D78)}
  .pet{width:168px;height:168px;margin-bottom:2px;cursor:pointer}
  .bounce{animation:bounce 1.8s steps(2,end) infinite;transform-origin:50% 100%}
  .breathe{animation:breathe 3.2s ease-in-out infinite;transform-origin:50% 100%}
  .wobble{animation:wobble 2.4s ease-in-out infinite;transform-origin:50% 90%}
  .jump{animation:jump .5s ease}
  @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
  @keyframes breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.03,.97)}}
  @keyframes wobble{0%,70%,100%{transform:rotate(0)}76%{transform:rotate(-7deg)}82%{transform:rotate(6deg)}88%{transform:rotate(-4deg)}94%{transform:rotate(2deg)}}
  @keyframes jump{0%{transform:translateY(0)}40%{transform:translateY(-18px)}70%{transform:translateY(0) scale(1.05,.95)}100%{transform:translateY(0)}}
  .bubble{position:absolute;top:12px;left:50%;transform:translate(-50%,-4px);max-width:86%;background:#fff;border-radius:14px;padding:8px 13px;font-size:14px;line-height:1.4;color:#1C1C1E;box-shadow:0 2px 10px rgba(0,0,0,.1);opacity:0;transition:opacity .2s,transform .2s;text-align:center;pointer-events:none;word-break:keep-all}
  .bubble.show{opacity:1;transform:translate(-50%,0)}
  .zz{position:absolute;right:26%;top:52px;color:#D5D8FF;font-weight:700;font-size:20px;display:none;animation:zz 2.4s ease-in-out infinite}
  .night .zz{display:block}
  @keyframes zz{0%{opacity:0;transform:translate(0,8px)}50%{opacity:1}100%{opacity:0;transform:translate(10px,-14px)}}
  .fx{position:absolute;bottom:120px;left:50%;font-size:30px;pointer-events:none;animation:up 1s ease forwards}
  @keyframes up{0%{opacity:0;transform:translate(-50%,10px) scale(.6)}30%{opacity:1;transform:translate(-50%,-6px) scale(1.1)}100%{opacity:0;transform:translate(-50%,-50px)}}
  .stats{background:#fff;border-radius:16px;padding:12px 14px;margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}
  .stat .lb{font-size:12px;color:#636366;display:flex;justify-content:space-between}
  .bar{height:8px;border-radius:4px;background:#E5E5EA;overflow:hidden;margin-top:5px}
  .bar i{display:block;height:100%;border-radius:4px;transition:width .4s}
  .chatline{display:flex;justify-content:space-between;gap:8px;background:#fff;border-radius:16px;padding:11px 14px;margin-top:12px;font-size:13px;color:#3A3A3C}
  .chatline .total{color:#8E8E93;flex:none}
  .warn{background:#FFF4E5;color:#8A5300;border-radius:14px;padding:10px 14px;font-size:13px;margin-top:12px;line-height:1.5}
  .actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
  .actions.c4{grid-template-columns:repeat(4,1fr)}
  .actions.c1{grid-template-columns:1fr}
  .act{height:66px;border:0;border-radius:16px;background:#fff;font-size:13px;color:#1C1C1E;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;transition:transform .1s}
  .act b{font-size:23px;line-height:1}
  .act:active{transform:scale(.95);background:#E5E5EA}
  .act.med{background:#FFF1F0}
  .gone{background:#fff;border-radius:16px;padding:18px;margin-top:12px;text-align:center;font-size:15px;line-height:1.6;color:#3A3A3C}
  .wide{width:100%;height:50px;border:0;border-radius:14px;background:#fff;font-size:16px;font-weight:600;color:#007AFF;margin-top:10px}
  .wide.primary{background:#007AFF;color:#fff}
  .wide.danger{color:#FF3B30;font-weight:500}
  .card{background:#fff;border-radius:16px;padding:14px;margin-top:12px}
  .lbl{font-size:13px;color:#8E8E93;margin-bottom:10px}
  .card input[type=text]{width:100%;height:44px;border-radius:12px;border:0;background:#F2F2F7;padding:0 14px;font-size:16px;color:#1C1C1E;outline:none}
  .preview{position:sticky;top:-8px;z-index:1;height:140px;display:flex;justify-content:center;align-items:flex-end;background:linear-gradient(#FFF8F2,#FFE6D8);border-radius:18px}
  .preview div{width:128px;height:128px}
  .tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 0 4px;margin-top:12px;scrollbar-width:none}
  .tabs::-webkit-scrollbar{display:none}
  .tab{flex:none;height:36px;padding:0 14px;border-radius:18px;border:0;background:#fff;font-size:14px;color:#3A3A3C}
  .tab.on{background:#1C1C1E;color:#fff}
  .opts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}
  .opt{border:2px solid transparent;background:#fff;border-radius:14px;padding:6px 2px 8px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:12px;color:#3A3A3C}
  .opt.on{border-color:#007AFF}
  .opt div{width:58px;height:58px}
  .swrow{display:flex;gap:10px;flex-wrap:wrap}
  .sw{width:40px;height:40px;border-radius:20px;border:3px solid #fff;box-shadow:0 0 0 1px #D1D1D6;position:relative;overflow:hidden;padding:0}
  .sw.on{box-shadow:0 0 0 3px #007AFF}
  .sw.custom{background:conic-gradient(#ff6b6b,#ffd93d,#6bcB77,#4d96ff,#c77dff,#ff6b6b)}
  .sw.custom input{position:absolute;inset:-10px;width:64px;height:64px;opacity:0;cursor:pointer;border:0;padding:0}
  .sw.same{background:#F2F2F7;font-size:11px;color:#3A3A3C;width:auto;padding:0 12px;border-radius:20px}
  .foot{font-size:12px;color:#8E8E93;text-align:center;margin-top:14px;line-height:1.5}
  @media (prefers-reduced-motion:reduce){.bounce,.breathe,.wobble,.zz{animation:none}}
  `;

  const HTML = `
  <div class="bg"></div>
  <div class="sheet" role="dialog" aria-label="말랑펫">
    <div class="grab"></div>
    <div class="head">
      <div class="title"><div class="name"></div><div class="sub"></div></div>
      <button class="ibtn" data-k="deco" aria-label="꾸미기">🎨</button>
      <button class="ibtn" data-k="close" aria-label="닫기">✕</button>
    </div>
    <div class="v-main">
      <div class="stage"><div class="bubble"></div><div class="zz">z Z</div><div class="pet"></div></div>
      <div class="stats">
        <div class="stat"><div class="lb"><span>🍙 배부름</span><span data-n="hunger"></span></div><div class="bar"><i data-b="hunger" style="background:#FF9F0A"></i></div></div>
        <div class="stat"><div class="lb"><span>🎈 기분</span><span data-n="fun"></span></div><div class="bar"><i data-b="fun" style="background:#FF2D55"></i></div></div>
        <div class="stat"><div class="lb"><span>⚡ 기운</span><span data-n="energy"></span></div><div class="bar"><i data-b="energy" style="background:#FFCC00"></i></div></div>
        <div class="stat"><div class="lb"><span>💚 건강</span><span data-n="health"></span></div><div class="bar"><i data-b="health" style="background:#34C759"></i></div></div>
      </div>
      <div class="actions"></div>
      <div class="chatline"><span class="today"></span><span class="total"></span></div>
      <div class="warn" hidden></div>
      <div class="gone" hidden></div>
    </div>
    <div class="v-deco" hidden>
      <div class="preview"><div></div></div>
      <div class="card"><div class="lbl">이름</div><input class="name-in" type="text" maxlength="10" placeholder="말랑이"></div>
      <div class="tabs"></div>
      <div class="opts"></div>
      <div class="colors" hidden></div>
      <button class="wide primary" data-k="done">완료</button>
      <button class="wide danger" data-k="reset">새 알로 다시 시작</button>
      <p class="foot">내 대화는 크랙에서 읽기만 하고 다른 곳으로 보내지 않아요<br>펫 정보는 이 브라우저에만 저장돼요</p>
    </div>
  </div>
  <div class="fab" aria-label="말랑펫 열기"><div class="dot"></div><div class="fab-pet"></div></div>
  `;

  /* ===================== 상태 ===================== */
  let p = store.get() || newPet();
  let tempExpr = null, tempUntil = 0, lastSay = 0, lastPet = 0, resetArmed = 0;

  function load() { const s = store.get(); if (s) p = s; simulate(p, Date.now()); rollDay(); }
  function save() { store.set(p); }
  function rollDay() { const d = todayKey(); if (!p.day || p.day.d !== d) p.day = { d, chats: 0, good: 0, bad: 0 }; }

  function baseExpr() {
    if (p.sleeping) return 'sleep';
    if (p.sick) return 'sick';
    if (p.hunger < 25 || p.fun < 25 || p.energy < 15) return 'sad';
    if ((p.hunger + p.fun + p.energy) / 3 > 75) return 'happy';
    return 'normal';
  }
  const curExpr = () => (tempExpr && Date.now() < tempUntil ? tempExpr : baseExpr());
  function setExpr(e, ms = 2500) { tempExpr = e; tempUntil = Date.now() + ms; setTimeout(render, ms + 50); }

  /* ===================== 화면 만들기 ===================== */
  const host = document.createElement('div');
  host.id = 'mallangpet-host';
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style><div class="wrap">${HTML}</div>`;
  const $ = (sel) => root.querySelector(sel);
  const wrap = $('.wrap'), fab = $('.fab'), fabPet = $('.fab-pet');
  const petEl = $('.pet'), stage = $('.stage'), bubble = $('.bubble'), actionsEl = $('.actions');
  const goneEl = $('.gone'), warnEl = $('.warn');
  const vMain = $('.v-main'), vDeco = $('.v-deco');

  function mount() {
    const target = document.body;
    if (!target) return false;
    if (!host.isConnected) target.appendChild(host);
    return true;
  }

  // 크랙 단축키가 입력을 가로채지 않도록
  $('.name-in').addEventListener('keydown', (e) => e.stopPropagation());
  $('.name-in').addEventListener('keyup', (e) => e.stopPropagation());

  /* ---------- 떠 있는 버튼(끌어서 옮기기) ---------- */
  function placeFab() {
    const W = window.innerWidth, H = window.innerHeight;
    const pos = p.pos || { x: 1, y: 0.72 };
    fab.style.left = Math.round(clamp(pos.x, 0, 1) * (W - 60 - 16) + 8) + 'px';
    fab.style.top = Math.round(clamp(pos.y, 0, 1) * (H - 60 - 16) + 8) + 'px';
  }
  let drag = null;
  fab.addEventListener('pointerdown', (e) => {
    drag = { sx: e.clientX, sy: e.clientY, ox: fab.offsetLeft, oy: fab.offsetTop, moved: false };
    try { fab.setPointerCapture(e.pointerId); } catch (_) {}
  });
  fab.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
    if (drag.moved) {
      fab.style.left = clamp(drag.ox + dx, 8, window.innerWidth - 68) + 'px';
      fab.style.top = clamp(drag.oy + dy, 8, window.innerHeight - 68) + 'px';
    }
  });
  fab.addEventListener('pointerup', () => {
    if (!drag) return;
    if (drag.moved) {
      load();
      p.pos = { x: (fab.offsetLeft - 8) / Math.max(1, window.innerWidth - 76), y: (fab.offsetTop - 8) / Math.max(1, window.innerHeight - 76) };
      save();
    } else openSheet();
    drag = null;
  });
  fab.addEventListener('pointercancel', () => { drag = null; });
  window.addEventListener('resize', placeFab);

  function fabFx(emoji) {
    const el = document.createElement('div');
    el.className = 'fab-fx'; el.textContent = emoji;
    fab.appendChild(el);
    fab.classList.remove('react'); void fab.offsetWidth; fab.classList.add('react');
    setTimeout(() => { el.remove(); fab.classList.remove('react'); }, 1300);
  }

  /* ---------- 시트 열고 닫기 ---------- */
  const isOpen = () => wrap.classList.contains('open');
  function openSheet() { load(); flushEvents(); save(); showView('main'); wrap.classList.add('open'); render(); greet(); }
  function closeSheet() { wrap.classList.remove('open'); }
  $('.bg').addEventListener('click', closeSheet);

  function showView(v) {
    vMain.hidden = v !== 'main';
    vDeco.hidden = v !== 'deco';
    resetArmed = 0;
    $('[data-k="reset"]').textContent = '새 알로 다시 시작';
    if (v === 'deco') { decoTab = decoTab || 'shape'; buildDeco(); }
  }

  root.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]');
    if (!k) return;
    const key = k.dataset.k;
    if (key === 'close') closeSheet();
    else if (key === 'deco') showView(vDeco.hidden ? 'deco' : 'main');
    else if (key === 'done') { showView('main'); render(); }
    else if (key === 'reset') {
      if (Date.now() - resetArmed < 4000) {
        p = newPet(p); save(); showView('main'); render();
        say('새 알이 왔어요! 따뜻하게 지켜봐 주세요');
      } else {
        resetArmed = Date.now();
        k.textContent = '정말요? 한 번 더 누르면 새로 시작해요';
        setTimeout(() => { if (Date.now() - resetArmed >= 4000) k.textContent = '새 알로 다시 시작'; }, 4100);
      }
    }
  });

  /* ---------- 말풍선 · 효과 ---------- */
  let bubbleTimer = null;
  function say(text, ms = 3200) {
    bubble.textContent = text;
    bubble.classList.add('show');
    lastSay = Date.now();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  }
  function fx(emoji) {
    const el = document.createElement('div');
    el.className = 'fx'; el.textContent = emoji;
    stage.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
  function jump() {
    petEl.classList.remove('jump'); void petEl.offsetWidth; petEl.classList.add('jump');
    setTimeout(() => petEl.classList.remove('jump'), 520);
  }
  function needLine() {
    if (p.sick) return pick(LINES.sick);
    if (p.hunger < 30) return pick(LINES.hungry);
    if (p.energy < 20) return pick(LINES.sleepy);
    if (p.fun < 30) return pick(LINES.bored);
    return null;
  }
  function greet() {
    if (p.gone) return;
    if (p.stage === 'egg') return say('(알 속에서 무언가 꼼지락거려요)');
    if (p.sleeping) return say(pick(LINES.sleepTalk));
    say(needLine() || pick(LINES.hello));
  }

  function flushEvents() {
    while (events.length) {
      const ev = events.shift();
      if (ev.type === 'grow') {
        if (ev.to === 'baby') { say(`알이 깨어났어요! 안녕, 나는 ${p.name}!`, 4500); fx('🐣'); }
        else if (ev.to === 'child') { say('쑥쑥! 나 조금 컸어!', 4000); fx('🌱'); }
        else if (ev.to === 'adult') {
          const m = { shiny: '반짝반짝! 사랑 듬뿍 받아서 반짝이가 됐어 ✨', normal: '짠! 어른이 됐어!', naughty: '흥, 장난꾸러기로 컸지롱' };
          say(m[p.form] || m.normal, 4500); fx('🎉');
        }
      } else if (ev.type === 'sick') say('몸이 안 좋아… 약이 필요해', 4000);
      else if (ev.type === 'woke') say('하암~ 잘 잤다!');
    }
  }

  /* ---------- 돌보기 ---------- */
  function act(kind) {
    load(); flushEvents();
    if (p.gone) return render();
    if (p.stage === 'egg') {
      say(pick(['(따뜻해요)', '(톡톡… 안에서 대답했어요)', '(알이 살짝 흔들렸어요)'])); jump(); return;
    }
    if (kind === 'sleep') {
      p.sleeping = !p.sleeping;
      say(p.sleeping ? '잘 자… 쿨쿨' : '하암… 일어났어!');
      if (!p.sleeping) jump();
    } else if (p.sleeping) {
      say('쉿… 자고 있어요. 먼저 깨워 주세요');
    } else if (kind === 'feed') {
      if (p.hunger > 95) { p.fun = clamp(p.fun - 3); say(pick(LINES.full)); setExpr('sad'); }
      else { p.hunger = clamp(p.hunger + 25); say(pick(LINES.fed)); setExpr('happy'); fx(pick(['🍙', '🍓', '🍪', '🥛'])); jump(); }
    } else if (kind === 'play') {
      if (p.energy < 15) { say(pick(LINES.tired)); setExpr('sad'); }
      else {
        p.fun = clamp(p.fun + 20); p.energy = clamp(p.energy - 8); p.hunger = clamp(p.hunger - 4);
        say(pick(LINES.played)); setExpr('happy'); fx(pick(['🎾', '🎈', '⭐', '🎵'])); jump();
      }
    } else if (kind === 'med') {
      p.health = clamp(p.health + 30);
      if (p.health >= CONFIG.sickBelow) p.sick = false;
      say(p.sick ? '조금 나아졌어… 한 번만 더' : pick(LINES.med)); fx('💊'); setExpr(p.sick ? 'sick' : 'normal');
    }
    save(); render();
  }

  petEl.addEventListener('click', () => {
    if (p.gone) return;
    if (p.stage === 'egg') return act('egg');
    if (p.sleeping) return say(pick(LINES.sleepTalk));
    load();
    if (Date.now() - lastPet > 2500) { p.fun = clamp(p.fun + 3); lastPet = Date.now(); save(); }
    say(pick(LINES.pet)); setExpr('love', 1800); fx('💕'); jump(); render();
  });

  /* ---------- 크랙에서 내가 보낸 말 ---------- */
  function onMyChat(text) {
    load();
    if (p.gone) return;
    const before = p.stage;
    const kind = analyze(text);
    const R = REACT[kind];
    p.xp = (p.xp || 0) + 1;
    p.chats = (p.chats || 0) + 1;
    p.day.chats++;
    if (kind === 'love') { p.good++; p.day.good++; }
    if (kind === 'bad') { p.bad++; p.day.bad++; }
    updateStage(p, Date.now());

    if (p.stage !== 'egg' && !p.sleeping) {
      if (kind === 'love') p.fun = clamp(p.fun + 6);
      else if (kind === 'bad') p.fun = clamp(p.fun - 6);
      else if (kind === 'sad') p.fun = clamp(p.fun - 2);
      else if (kind === 'food') { p.hunger = clamp(p.hunger + 3); p.fun = clamp(p.fun + 1); }
      else p.fun = clamp(p.fun + 1);
    }
    save();

    const grew = p.stage !== before;
    if (p.stage === 'egg') fabFx('✨');
    else if (p.sleeping) fabFx('💤');
    else {
      fabFx(grew ? '🎉' : R.fx);
      if (R.expr) setExpr(R.expr, 3000);
    }
    if (isOpen() && !vMain.hidden) {
      flushEvents();
      if (!grew) {
        if (p.stage === 'egg') say('(알이 대화를 듣고 꼼지락거려요)');
        else if (p.sleeping) say(pick(LINES.sleepTalk));
        else { say(pick(R.lines)); fx(R.fx); if (kind !== 'neutral') jump(); }
      }
    }
    render();
  }

  // 새 메시지 지켜보기
  const seen = new Set();
  let intentAt = 0, enterAt = 0, ignoreUntil = Date.now() + 3000, lastMineAt = 0, lastNewAt = 0, missCount = 0, warned = false;
  const recentTexts = [];

  document.addEventListener('keydown', (e) => {
    const tg = e.target;
    if (e.key === 'Enter' && !e.shiftKey && tg && (tg.tagName === 'TEXTAREA' || tg.isContentEditable)) {
      intentAt = enterAt = Date.now();
      const at = enterAt;
      setTimeout(() => checkMiss(at), 10000);
    }
  }, true);
  document.addEventListener('click', (e) => {
    if (e.composedPath && e.composedPath().includes(host)) return;
    if (e.target && e.target.closest && e.target.closest('button')) intentAt = Date.now();
  }, true);

  function checkMiss(at) {
    if (lastMineAt >= at) { missCount = 0; return; }
    if (lastNewAt >= at) missCount++; // 새 메시지는 생겼는데 내 말을 못 찾음
    if (missCount >= 3 && !warned) {
      warned = true;
      console.warn('[크랙 말랑펫] 내가 보낸 말을 찾지 못하고 있어요. 크랙 화면 구조가 바뀌었을 수 있어요. (SEL 설정 확인)');
      warnEl.textContent = '⚠️ 크랙 화면이 바뀌어서 내가 보낸 말을 못 알아듣고 있어요. 댓글로 알려 주시면 고칠게요!';
      warnEl.hidden = false;
    }
  }

  function scanChat() {
    const msgs = document.querySelectorAll(SEL.message);
    const total = msgs.length;
    const now = Date.now();
    msgs.forEach((m, i) => {
      const id = m.getAttribute(SEL.messageId);
      if (!id || seen.has(id)) return;
      const textEl = m.querySelector(SEL.text);
      if (!textEl) return; // 아직 글자가 안 그려졌으면 다음에
      seen.add(id);
      if (now < ignoreUntil) return;              // 방 이동·처음 열 때 불러온 예전 대화
      lastNewAt = now;
      if (now - intentAt > 15000) return;         // 내가 방금 보낸 게 아니면 세지 않음
      if (i < total - 3) return;                  // 맨 아래 새 메시지만
      if (!SEL.isMine(m, textEl)) return;
      const text = (textEl.innerText || textEl.textContent || '').trim();
      if (!text) return;
      while (recentTexts.length && now - recentTexts[0].at > 60000) recentTexts.shift();
      if (recentTexts.some((r) => r.text === text)) return;
      recentTexts.push({ text, at: now });
      lastMineAt = now;
      try { onMyChat(text); } catch (err) { console.warn('[크랙 말랑펫]', err); }
    });
  }
  let scanTimer = null;
  const chatObserver = new MutationObserver(() => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanChat, 350);
  });
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) { lastHref = location.href; ignoreUntil = Date.now() + 4000; }
  }, 800);

  /* ---------- 꾸미기 ---------- */
  const TABS = [['shape', '몸'], ['top', '귀·머리'], ['eyes', '눈'], ['nose', '코'], ['mouth', '입'], ['cheeks', '볼'], ['acc', '장식'], ['color', '색깔']];
  const OPTIONS = {
    shape: Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [k, v.name])),
    top: TOPS,
    eyes: Object.fromEntries(Object.entries(EYES).map(([k, v]) => [k, v.name])),
    nose: Object.fromEntries(Object.entries(NOSES).map(([k, v]) => [k, v.name])),
    mouth: Object.fromEntries(Object.entries(MOUTHS).map(([k, v]) => [k, v.name])),
    cheeks: Object.fromEntries(Object.entries(CHEEKS).map(([k, v]) => [k, v.name])),
    acc: ACCS,
  };
  let decoTab = null;
  const showPet = () => (p.stage === 'egg' || p.gone ? Object.assign({}, p, { stage: 'child', gone: false, form: null }) : p);

  function setLook(key, val) { load(); p.look[key] = val; save(); buildDeco(); render(); }

  function buildDeco() {
    const nameIn = $('.name-in');
    if (root.activeElement !== nameIn) nameIn.value = p.name;
    nameIn.oninput = () => { load(); p.name = nameIn.value.trim() || '말랑이'; save(); renderHeader(); };

    const tabs = $('.tabs'); tabs.innerHTML = '';
    TABS.forEach(([k, label]) => {
      const b = document.createElement('button');
      b.className = 'tab' + (decoTab === k ? ' on' : '');
      b.textContent = label;
      b.onclick = () => { decoTab = k; buildDeco(); };
      tabs.appendChild(b);
    });

    const opts = $('.opts'), colors = $('.colors');
    opts.innerHTML = ''; colors.innerHTML = '';
    opts.hidden = decoTab === 'color';
    colors.hidden = decoTab !== 'color';
    const base = showPet();

    if (decoTab !== 'color') {
      Object.entries(OPTIONS[decoTab]).forEach(([k, label]) => {
        const b = document.createElement('button');
        b.className = 'opt' + (p.look[decoTab] === k ? ' on' : '');
        const look = Object.assign({}, p.look, { [decoTab]: k });
        const pic = document.createElement('div');
        pic.innerHTML = drawPet(Object.assign({}, base, { look }), 'normal');
        const span = document.createElement('span'); span.textContent = label;
        b.append(pic, span);
        b.onclick = () => setLook(decoTab, k);
        opts.appendChild(b);
      });
    } else {
      colors.append(
        colorCard('몸 색', 'body', BODY_COLORS, false),
        colorCard('귀·머리 색', 'hair', HAIR_COLORS.concat(BODY_COLORS.slice(0, 4)), true),
        colorCard('눈 색', 'eye', EYE_COLORS, false),
      );
    }
    $('.preview div').innerHTML = drawPet(base, 'happy');
  }

  function colorCard(title, key, list, allowSame) {
    const card = document.createElement('div'); card.className = 'card';
    const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = title;
    const row = document.createElement('div'); row.className = 'swrow';
    const cur = p.look[key];
    if (allowSame) {
      const s = document.createElement('button');
      s.className = 'sw same' + (!cur ? ' on' : ''); s.textContent = '몸이랑 같게';
      s.onclick = () => setLook(key, null);
      row.appendChild(s);
    }
    list.forEach((c) => {
      const s = document.createElement('button');
      s.className = 'sw' + (cur && cur.toLowerCase() === c.toLowerCase() ? ' on' : '');
      s.style.background = c; s.setAttribute('aria-label', c);
      s.onclick = () => setLook(key, c);
      row.appendChild(s);
    });
    const custom = document.createElement('label');
    const isCustom = cur && !list.some((c) => c.toLowerCase() === cur.toLowerCase());
    custom.className = 'sw custom' + (isCustom ? ' on' : '');
    custom.title = '직접 고르기';
    const inp = document.createElement('input');
    inp.type = 'color'; inp.value = cur || p.look.body || '#FFC8B4';
    inp.onchange = () => setLook(key, inp.value);
    custom.appendChild(inp);
    row.appendChild(custom);
    card.append(lbl, row);
    return card;
  }

  /* ---------- 그리기 ---------- */
  const STAGE_NAME = { egg: '알', baby: '아기', child: '어린이', adult: '어른' };
  const FORM_NAME = { shiny: '반짝이', normal: '어른', naughty: '장난꾸러기' };

  function renderHeader() {
    $('.name').textContent = p.name;
    const ageH = (Date.now() - p.born) / 3600000;
    let sub;
    if (p.gone) sub = '떠났어요';
    else if (p.stage === 'egg') {
      const left = Math.max(1, Math.ceil(CONFIG.hatchMinutes - growHours(p, Date.now()) * 60));
      sub = `알 · ${left}분 뒤 깨어나요 (대화하면 더 빨리!)`;
    } else {
      const st = p.stage === 'adult' ? FORM_NAME[p.form] || '어른' : STAGE_NAME[p.stage];
      sub = `${st} · ${Math.floor(ageH / 24) + 1}일째` + (p.sleeping ? ' · 자는 중' : p.sick ? ' · 아파요' : '');
    }
    $('.sub').textContent = sub;
  }

  let lastPetHTML = '', lastFabHTML = '';
  function render() {
    renderHeader();
    const expr = curExpr();
    const html = drawPet(p, expr);
    if (html !== lastPetHTML) { petEl.innerHTML = html; lastPetHTML = html; }
    petEl.className = 'pet ' + (p.gone ? '' : p.stage === 'egg' ? 'wobble' : p.sleeping ? 'breathe' : 'bounce');
    stage.classList.toggle('night', !!p.sleeping);

    ['hunger', 'fun', 'energy', 'health'].forEach((k) => {
      const v = Math.round(p[k]);
      root.querySelector(`[data-b="${k}"]`).style.width = v + '%';
      root.querySelector(`[data-n="${k}"]`).textContent = p.stage === 'egg' ? '-' : v;
    });

    let btns;
    if (p.gone) btns = [];
    else if (p.stage === 'egg') btns = [['egg', '🤲', '알 쓰다듬기']];
    else {
      btns = [['feed', '🍙', '밥 주기'], ['play', '🎾', '놀아주기'], ['sleep', p.sleeping ? '☀️' : '🌙', p.sleeping ? '깨우기' : '재우기']];
      if (p.sick) btns.push(['med', '💊', '약 주기']);
    }
    const sig = btns.map((b) => b.join()).join('|');
    if (actionsEl.dataset.sig !== sig) {
      actionsEl.dataset.sig = sig;
      actionsEl.className = 'actions' + (btns.length === 4 ? ' c4' : btns.length === 1 ? ' c1' : '');
      actionsEl.innerHTML = '';
      btns.forEach(([k, ico, label]) => {
        const b = document.createElement('button');
        b.className = 'act' + (k === 'med' ? ' med' : '');
        b.innerHTML = `<b>${ico}</b><span>${label}</span>`;
        b.onclick = () => act(k);
        actionsEl.appendChild(b);
      });
    }

    // 대화 통계
    rollDay();
    $('.today').textContent = p.day.chats
      ? `💬 오늘 ${p.day.chats}번 · 💕 ${p.day.good} · 💢 ${p.day.bad}`
      : '💬 크랙에서 대화하면 펫이 듣고 반응해요';
    $('.total').textContent = p.chats ? `전체 ${p.chats}번` : '';

    actionsEl.hidden = p.gone;
    $('.stats').hidden = p.gone;
    $('.chatline').hidden = p.gone;
    goneEl.hidden = !p.gone;
    if (p.gone && !goneEl.dataset.built) {
      goneEl.dataset.built = '1';
      goneEl.innerHTML = '';
      const msg = document.createElement('p');
      msg.textContent = `${josa(p.name, '이는', '는')} 더 자주 놀아줄 친구를 찾아 떠났어요.\n편지를 남겼어요: “그동안 고마웠어.”`;
      msg.style.whiteSpace = 'pre-line';
      const again = document.createElement('button');
      again.className = 'wide primary'; again.textContent = '🥚 새 알 받기';
      again.onclick = () => { p = newPet(p); save(); goneEl.dataset.built = ''; render(); say('새 알이 왔어요! 이번엔 자주 들여다봐 주세요'); };
      goneEl.append(msg, again);
    }
    if (!p.gone) goneEl.dataset.built = '';

    const fh = drawPet(p, expr);
    if (fh !== lastFabHTML) { fabPet.innerHTML = fh; lastFabHTML = fh; }
    const alert = !p.gone && p.stage !== 'egg' && !p.sleeping && (p.sick || p.hunger < 30 || p.fun < 30 || p.energy < 20);
    fab.classList.toggle('alert', alert || p.gone);
    fab.hidden = !!p.hidden;
  }

  /* ---------- 시간 흐르기 ---------- */
  function tick() {
    if (!mount()) return;
    load();
    if (isOpen()) flushEvents();
    else if (events.some((e) => e.type === 'grow' && !e.shown)) { events.forEach((e) => { e.shown = true; }); fabFx('🎉'); }
    save(); render();
    if (isOpen() && !vMain.hidden && Date.now() - lastSay > 25000 && !p.gone && p.stage !== 'egg') {
      say(p.sleeping ? pick(LINES.sleepTalk) : needLine() || pick(LINES.idle));
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  /* ---------- 탬퍼몽키 메뉴 ---------- */
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('말랑펫 버튼 보이기/숨기기', () => { load(); p.hidden = !p.hidden; save(); render(); });
    GM_registerMenuCommand('말랑펫 버튼 위치 초기화', () => { load(); p.pos = null; p.hidden = false; save(); placeFab(); render(); });
  }

  /* ---------- 시작 ---------- */
  function start() {
    if (!mount()) {
      console.warn('[크랙 말랑펫] 화면을 아직 못 찾았어요. 잠시 후 다시 시도할게요.');
      return setTimeout(start, 1000);
    }
    simulate(p, Date.now());
    rollDay();
    events.length = 0;
    save(); placeFab(); render();
    document.querySelectorAll(SEL.message).forEach((m) => seen.add(m.getAttribute(SEL.messageId)));
    chatObserver.observe(document.body, { childList: true, subtree: true });
    setInterval(tick, CONFIG.tickSeconds * 1000);
    setInterval(() => { if (!host.isConnected) mount(); }, 3000);
  }
  start();
})();
