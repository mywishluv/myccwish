// ==UserScript==
// @name         크랙 말랑펫
// @namespace    https://github.com/mywishluv/wishlite
// @version      3.0.0
// @description  나만의 최애 픽셀 펫, 자유로운 미니룸과 도트 편집, 밥주기·돌보기·성격·사진관
// @author       muz
// @match        https://crack.wrtn.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// @downloadURL  https://github.com/mywishluv/wishlite/raw/main/crack-mallang-pet.user.js
// @updateURL    https://github.com/mywishluv/wishlite/raw/main/crack-mallang-pet.user.js
// ==/UserScript==
(function () {
 'use strict';
 if(document.getElementById('mallangpet-host')) return;
 const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number(n)||0));
 const pick=a=>a[Math.floor(Math.random()*a.length)];
 const CONFIG={hatchMinutes:10,chatGrowHours:.25};

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

  function drawBasePet(p, expr) {
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

 const KEY='mallangpet_v3', LEGACY='mallangpet_v1';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const copy=o=>JSON.parse(JSON.stringify(o));
 const day=()=>new Date().toLocaleDateString('sv-SE');
 const id=()=>Math.random().toString(36).slice(2,10);
 const color=(s,f='#ffc3cb')=>/^#[0-9a-f]{6}$/i.test(s)?s:f;
 const text=(s,f='',n=180)=>typeof s==='string'?s.slice(0,n):f;
 const THEMES={
  peach:['살구 다락방','#ffe5d7','#e5af91','#fff9ed','#d46c77','#553e49'],
  pink:['핑크 공주방','#ffe1ee','#dca2c1','#fff4fb','#b55789','#593747'],
  forest:['숲속 오두막','#d4e8cf','#91b299','#faf2dc','#547f69','#334d40'],
  night:['달빛 고딕방','#39394f','#73718f','#eee5fa','#8c67ae','#383148'],
  space:['보랏빛 우주','#c9c3ed','#9290bc','#f4f0ff','#6e62a5','#393752'],
  retro:['민트 컴퓨터','#d5eee6','#92b9b0','#f5fff7','#407e77','#304f4c']
 };
 const FOODS={rice:['주먹밥',32,1,'rice'],cake:['딸기 케이크',18,12,'cake'],cookie:['쿠키',12,8,'cookie'],milk:['딸기 우유',15,4,'milk'],berry:['딸기',10,6,'berry'],ramen:['라면',28,5,'ramen'],pudding:['푸딩',16,10,'pudding'],tea:['따뜻한 차',5,4,'tea']};
 const FURN={bed:'포근한 침대',chair:'의자',desk:'책상',shelf:'책장',plant:'화분',rug:'러그',star:'별 쿠션',frame:'액자',bear:'곰 인형',lamp:'스탠드',cake:'케이크 테이블',window:'창문'};
 const ACC={ribbon:'리본',flower:'꽃',crown:'왕관',hat:'모자',glasses:'안경',heart:'하트',star:'별',bow:'나비넥타이',bandage:'반창고'};
 const TYPES={sweet:'다정',cool:'무뚝뚝',tsun:'까칠',shy:'수줍음',playful:'장난꾸러기'};
 const WORDS={
 sweet:{hello:['{user}, 오늘도 기다렸어.','같이 있으니까 좋아.'],feed:['고마워! 같이 먹자.','냠냠, 맛있어!'],pet:['조금만 더 쓰다듬어 줘.','네 손 따뜻해.'],play:['너랑 노는 게 제일 좋아!'],idle:['오늘은 어떤 하루였어?','옆에 있어 줄게.']},
 cool:{hello:['왔어? 자리 비워 뒀어.'],feed:['…잘 먹을게.','맛은 괜찮네.'],pet:['…싫다고는 안 했어.'],play:['한 판만 더 하자.'],idle:['여기 있을게.','무리하지 마.']},
 tsun:{hello:['이제 와? 딱히 기다리진 않았어.'],feed:['흥, 이건 좀 맛있네.'],pet:['머리 헝클어지잖아… 조금만 해.'],play:['이번엔 내가 이길 거야!'],idle:['왜. 그냥 보고 있었어.']},
 shy:{hello:['와, 왔구나…!'],feed:['나 주는 거야? 고마워…'],pet:['으응… 간지러워.'],play:['같이 해도 돼…?'],idle:['옆에 있어도 괜찮지?']},
 playful:{hello:['드디어 왔다! 심심해서 녹을 뻔!'],feed:['한 입에 와앙!'],pet:['쓰담 한 번에 하트 한 개!'],play:['좋아! 오늘의 챔피언은 나!'],idle:['오늘도 재미있는 일 없나~','쿠션 밑에 보물 숨겨 둘까?']}
 };
 const BASEEX={model:'pet',front:'none',back:'none',tail:'none',wings:'none',outfit:'none',cloth:'#718faf',eye2:'#57443c',hetero:false,mark:'none',accessories:[],pixels:Array(576).fill(null)};
 function fresh(){return {name:'말랑이',born:Date.now(),stage:'child',xp:0,chats:0,day:{d:day(),chats:0},hunger:85,fun:85,energy:85,health:100,clean:90,bond:0,sleeping:false,look:{...DEFAULT_LOOK},extra:copy(BASEEX),profile:{type:'sweet',user:'너',birthday:'',met:day(),symbol:'#ef8da3',favorite:'cake',dislike:'',lines:''}};}
 function defaultRoom(){return {theme:'peach',wall:'#ffe5d7',floor:'#e5af91',items:[{id:id(),type:'window',x:68,y:20,size:1,flip:false,c:'#b5d6db'},{id:id(),type:'bed',x:77,y:70,size:1,flip:false,c:'#cc8a9d'},{id:id(),type:'plant',x:18,y:58,size:.9,flip:false,c:'#77a28b'},{id:id(),type:'rug',x:43,y:86,size:1.1,flip:false,c:'#f4d4ad'}]};}
 function sanitizePet(v){
  const p=fresh(); if(!v||typeof v!=='object')return p;
  p.name=text(v.name,'말랑이',20); p.born=Number.isFinite(v.born)?clamp(v.born,0,Date.now()):Date.now();
  for(const k of ['hunger','fun','energy','health','clean'])p[k]=v[k]==null?p[k]:clamp(v[k]);
  for(const k of ['xp','chats','bond'])p[k]=clamp(v[k],0,1e9);
  p.stage=['egg','baby','child','adult'].includes(v.stage)?v.stage:'child'; p.sleeping=!!v.sleeping;
  p.day={d:day(),chats:v.day?.d===day()?clamp(v.day.chats,0,1e6):0};
  const look=v.look||{};
  const enums={shape:SHAPES,top:TOPS,eyes:EYES,nose:NOSES,mouth:MOUTHS,cheeks:CHEEKS,acc:ACCS};
  for(const [k,obj]of Object.entries(enums))if(Object.hasOwn(obj,look[k]))p.look[k]=look[k];
  for(const k of ['body','hair','eye'])p.look[k]=color(look[k],p.look[k]||p.look.body);
  const ex=v.extra||{};
  const sets={model:['pet','human'],front:['none','straight','part','short','curl','side','messy','swoop'],back:['none','bob','long','pony','twin','wave'],tail:['none','cat','fox','devil','bunny'],wings:['none','angel','bat','fairy'],outfit:['none','shirt','dress','hoodie','suit','sailor'],mark:['none','mole','scar','freckles']};
  for(const[k,arr]of Object.entries(sets))if(arr.includes(ex[k]))p.extra[k]=ex[k];
  p.extra.cloth=color(ex.cloth,BASEEX.cloth);p.extra.eye2=color(ex.eye2,BASEEX.eye2);p.extra.hetero=!!ex.hetero;
  p.extra.accessories=Array.isArray(ex.accessories)?ex.accessories.slice(0,16).filter(a=>a&&Object.hasOwn(ACC,a.type)).map(a=>({id:/^[a-z0-9_-]{1,40}$/i.test(a.id)?a.id:id(),type:a.type,x:clamp(a.x,0,48),y:clamp(a.y,0,48),size:clamp(a.size,.5,3),flip:!!a.flip,c:color(a.c)})):[];
  if(Array.isArray(ex.pixels)&&ex.pixels.length===576)p.extra.pixels=ex.pixels.map(c=>/^#[0-9a-f]{6}$/i.test(c)?c:null);
  const pr=v.profile||{}; p.profile={type:Object.hasOwn(TYPES,pr.type)?pr.type:'sweet',user:text(pr.user,'너',20),birthday:/^\d{4}-\d\d-\d\d$/.test(pr.birthday)?pr.birthday:'',met:/^\d{4}-\d\d-\d\d$/.test(pr.met)?pr.met:day(),symbol:color(pr.symbol,'#ef8da3'),favorite:Object.hasOwn(FOODS,pr.favorite)?pr.favorite:'cake',dislike:Object.hasOwn(FOODS,pr.dislike)?pr.dislike:'',lines:text(pr.lines,'',1200)};
  return p;
 }
 function sanitizeRoom(r){const d=defaultRoom();if(!r||typeof r!=='object')return d;d.theme=Object.hasOwn(THEMES,r.theme)?r.theme:'peach';d.wall=color(r.wall,THEMES[d.theme][1]);d.floor=color(r.floor,THEMES[d.theme][2]);if(Array.isArray(r.items))d.items=r.items.slice(0,40).filter(a=>a&&Object.hasOwn(FURN,a.type)).map(a=>({id:/^[a-z0-9_-]{1,40}$/i.test(a.id)?a.id:id(),type:a.type,x:clamp(a.x,8,92),y:clamp(a.y,12,90),size:clamp(a.size,.4,2),flip:!!a.flip,c:color(a.c)}));return d;}
 const get=k=>{try{const v=typeof GM_getValue==='function'?GM_getValue(k,null):localStorage.getItem(k);return typeof v==='string'?JSON.parse(v):v;}catch{return null;}};
 function normalize(v){const d={v:3,active:0,pets:[fresh()],room:defaultRoom(),buddy:-1,mode:'cozy',last:Date.now(),hidden:false,pos:{x:.94,y:.65},scale:64,react:true,album:[],presets:[]};if(!v||typeof v!=='object')return d;
  d.pets=Array.isArray(v.pets)&&v.pets.length?v.pets.slice(0,8).map(sanitizePet):[sanitizePet(v)];d.active=Math.floor(clamp(v.active,0,d.pets.length-1));d.room=sanitizeRoom(v.room);d.buddy=Number.isInteger(v.buddy)&&v.buddy>=0&&v.buddy<d.pets.length&&v.buddy!==d.active?v.buddy:-1;
  d.mode=v.mode==='care'?'care':'cozy';d.last=Number.isFinite(v.last)?Math.min(v.last,Date.now()):Date.now();d.hidden=!!v.hidden;d.pos={x:clamp(v.pos?.x??.94,0,1),y:clamp(v.pos?.y??.65,0,1)};d.scale=clamp(v.scale??64,40,100);d.react=v.react!==false;
  d.album=Array.isArray(v.album)?v.album.slice(-150).filter(a=>a&&typeof a.note==='string').map(a=>({at:clamp(a.at,0,Date.now()),note:text(a.note,'',250)})):[];d.presets=Array.isArray(v.presets)?v.presets.slice(0,12).map(a=>({name:text(a.name,'내 컬렉션',30),pet:sanitizePet(a.pet),room:sanitizeRoom(a.room)})):[];return d;}
 const previous=get(KEY);let state=normalize(previous||get(LEGACY));
 // 기존 버전 기록은 그대로 보관하고 새 버전은 별도 키에 저장해요.
 if(!previous){const old=get(LEGACY);if(old){state.pets=[sanitizePet(old)];if(old.gone){state.pets[0].health=70;state.pets[0].sleeping=false;}}}
 let saveError=false;
 function save(){try{const s=JSON.stringify(state);if(typeof GM_setValue==='function')GM_setValue(KEY,s);else localStorage.setItem(KEY,s);saveError=false;return true;}catch(e){saveError=true;console.warn('[말랑펫] 저장 실패',e);status('저장 공간이 부족해요. 백업을 내려받아 주세요.');return false;}}
 const pet=()=>state.pets[state.active];
 let view='home',tab='body',expr='normal',exprUntil=0,selected=null,editRoom=false,pose='stand',photoExpr='happy',paintColor='#ef8da3',erasing=false,paintUndo=[],sceneMood='idle',sceneX=44,sceneY=76,sayUntil=0,sessionTicks=0;
 const log=note=>{state.album.push({at:Date.now(),note});state.album=state.album.slice(-150);};
 const line=k=>{const p=pet(),custom=p.profile.lines.split('\n').map(s=>s.trim()).filter(Boolean);return (k==='idle'&&custom.length?pick(custom):pick(WORDS[p.profile.type][k]||WORDS[p.profile.type].idle)).replaceAll('{user}',p.profile.user).replaceAll('{name}',p.name);};
 function simulate(){const now=Date.now(),h=clamp((now-state.last)/3600000,0,state.mode==='cozy'?0:12);state.last=now;for(const p of state.pets){if(p.day.d!==day())p.day={d:day(),chats:0};if(state.mode==='care'){p.hunger=clamp(p.hunger-h*3);p.fun=clamp(p.fun-h*2);p.energy=clamp(p.energy+(p.sleeping?18:-2)*h);p.clean=clamp(p.clean-h*1.5);p.health=clamp(p.health+(Math.min(p.hunger,p.fun,p.energy)<15?-2:1)*h,20,100);if(p.energy===100)p.sleeping=false;}
  const hours=(now-p.born)/3600000+p.xp*.25;p.stage=hours<1/6?'egg':hours<24?'baby':hours<72?'child':'adult';}}
 // Pixel art: all decorative assets are SVG rectangles/paths, never platform emoji.
 function pixelIcon(type,c='#d88aa3'){
  const s='#534655',a=color(c),p='#fff5dc',g='#7ca78c';let shapes='';const r=(x,y,w,h,f)=>shapes+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
  const path=(d,f)=>shapes+=`<path d="${d}" fill="${f}"/>`;
  if(type==='bed'){r(1,9,30,12,s);r(3,10,26,8,a);r(3,10,8,7,p);r(1,5,3,20,s);r(29,12,3,13,s);r(13,10,16,2,'#fff8ee');}
  else if(type==='chair'){r(8,3,16,16,s);r(10,5,12,12,a);r(5,18,22,5,s);r(8,23,3,8,s);r(21,23,3,8,s);}
  else if(type==='desk'||type==='cake'){r(1,14,30,5,s);r(4,19,3,12,s);r(25,19,3,12,s);r(2,14,28,2,a);if(type==='desk'){r(10,2,12,10,s);r(12,4,8,6,'#a3ced2');r(15,12,2,2,s);}else{r(10,7,12,7,a);r(10,7,12,2,p);r(15,4,3,3,'#d65d79');}}
  else if(type==='shelf'){r(4,1,24,29,s);r(6,3,20,25,'#c9a180');for(let y=5;y<28;y+=10){r(6,y+7,20,2,s);for(let x=8;x<25;x+=4)r(x,y,3,7,x%3?a:p);}}
  else if(type==='plant'){path('M14 19H6V15H3V8H7V11H12V4H17V1H21V7H18V13H24V8H29V16H23V20Z',g);r(10,19,14,3,s);path('M11 22H23L21 31H13Z',a);r(14,23,3,5,p);}
  else if(type==='rug'){path('M5 12H27V14H31V22H27V24H5V22H1V14H5Z',a);r(6,15,20,6,p);r(10,17,12,2,a);}
  else if(type==='star'){path('M14 2H18V11H29V16H23V20H25V29H19V25H13V29H7V20H9V16H3V11H14Z',a);r(13,15,2,3,s);r(19,15,2,3,s);}
  else if(type==='frame'||type==='window'){r(3,1,26,28,s);r(5,3,22,24,a);r(7,5,18,20,type==='window'?'#b2d7df':p);if(type==='window'){r(15,5,2,20,s);r(7,14,18,2,s);r(8,8,5,2,p);}else{r(12,9,7,7,a);r(10,16,12,7,a);}}
  else if(type==='bear'){r(6,4,6,6,a);r(21,4,6,6,a);r(8,8,17,14,a);r(10,22,13,8,a);r(5,22,5,5,a);r(23,22,5,5,a);r(11,13,2,3,s);r(21,13,2,3,s);r(15,17,4,3,p);}
  else if(type==='lamp'){r(15,14,2,15,s);r(8,29,16,2,s);path('M10 2H23L28 15H5Z',a);r(8,13,17,2,p);}
  else if(type==='rice'){path('M14 4H19V8H23V12H27V25H5V12H9V8H14Z',s);path('M14 7H19V11H23V15H24V22H8V15H11V11H14Z',p);r(12,17,8,8,'#547b66');}
  else if(type==='cake'){r(4,13,24,14,a);r(4,13,24,4,p);r(4,21,24,3,p);r(13,6,6,7,'#d96779');r(14,4,4,3,g);}
  else if(type==='cookie'){path('M9 4H23V7H27V24H23V28H9V24H5V7H9Z','#ce995f');for(const[x,y]of[[11,10],[21,10],[17,18],[10,22],[23,22]])r(x,y,3,3,'#76513f');}
  else if(type==='milk'){path('M10 2H21L25 8V30H6V8Z',s);r(8,10,15,18,p);r(8,15,15,9,a);r(11,5,9,3,a);r(13,18,5,4,'#fff');}
  else if(type==='berry'){path('M5 11H27V20H24V25H20V29H13V25H9V20H5Z','#e57c90');path('M8 5H14V2H19V6H25V10H8Z',g);for(const[x,y]of[[10,14],[20,14],[15,20]])r(x,y,2,2,p);}
  else if(type==='ramen'){path('M3 15H29V22H25V27H7V22H3Z',a);r(4,13,24,3,p);r(9,9,3,5,'#e4c075');r(15,7,3,7,'#e4c075');r(21,9,3,5,'#e4c075');r(20,1,2,10,s);r(25,1,2,10,s);}
  else if(type==='pudding'){path('M10 7H23L27 25H5Z','#eccb80');r(10,7,13,5,'#ad7658');r(3,26,27,3,p);}
  else if(type==='tea'){r(5,11,19,17,a);r(24,14,5,10,a);r(24,17,2,4,p);r(7,12,15,3,'#7f664c');r(9,3,2,5,s);r(17,1,2,6,s);}
  else if(type==='heart'){path('M4 6H12V10H20V6H28V18H24V22H20V26H12V22H8V18H4Z',a);r(7,9,4,3,p);}
  else {r(7,7,18,18,a);r(10,10,4,4,p);}
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">${shapes}</svg>`;
 }
 function accessory(a){const c=color(a.c),ink='#443a48';const icons={ribbon:`<path d="M0 0H4V2H6V0H10V6H6V4H4V6H0Z" fill="${c}"/><rect x="4" y="2" width="2" height="2" fill="${ink}"/>`,flower:`<path d="M3 0H6V3H9V6H6V9H3V6H0V3H3Z" fill="${c}"/><rect x="3" y="3" width="3" height="3" fill="#ffe5a0"/>`,crown:`<path d="M0 0H2V3H4V0H6V3H8V0H10V8H0Z" fill="${c}"/><rect y="7" width="10" height="2" fill="${ink}"/>`,hat:`<path d="M2 0H10V7H13V9H0V7H2Z" fill="${c}"/><rect x="2" y="5" width="8" height="2" fill="#ffe5df"/>`,glasses:`<path d="M0 0H7V2H10V0H17V7H10V3H7V7H0ZM1 1V6H6V1ZM11 1V6H16V1Z" fill="${c}" fill-rule="evenodd"/>`,heart:`<path d="M0 0H3V2H5V0H8V4H6V6H4V8H2V6H0Z" fill="${c}"/>`,star:`<path d="M4 0H6V3H10V5H8V9H6V7H4V9H2V5H0V3H4Z" fill="${c}"/>`,bow:`<path d="M0 0H3V2H5V0H8V6H5V4H3V6H0Z" fill="${c}"/>`,bandage:`<rect width="9" height="4" fill="${c}"/><rect x="3" y="1" width="3" height="2" fill="#fff5dc"/>`};return `<g transform="translate(${a.x} ${a.y}) scale(${a.flip?-a.size:a.size} ${a.size})">${icons[a.type]||''}</g>`;}
 function portrait(p,expression='normal',photo=false){
  const L=p.look,E=p.extra,ink='#443a48',h=color(L.hair,L.body),hc=lineOf(h),body=color(L.body),cloth=E.cloth;
  let s='',rect=(x,y,w,h,c)=>s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`,path=(d,c)=>s+=`<path d="${d}" fill="${c}"/>`;
  if(E.wings!=='none'){const c=E.wings==='bat'?'#756080':E.wings==='fairy'?'#b8e0db':'#fff7ec';path('M14 26L2 16V31L8 37L16 34ZM34 26L46 16V31L40 37L32 34Z',ink);path('M13 27L4 20V30L9 34L15 32ZM35 27L44 20V30L39 34L33 32Z',c);}
  if(E.tail!=='none'){const c=E.tail==='devil'?'#ce7890':h;path(E.tail==='fox'?'M31 36H38V25H43V33H41V39H33Z':E.tail==='bunny'?'M33 32H40V39H33Z':'M32 37H40V29H43V39H32Z',c);}
  if(E.model==='human'){
   if(E.back!=='none'){const ends={bob:28,long:40,pony:38,twin:39,wave:39}[E.back];path(`M12 7H36V${ends}H10V12H12Z`,hc);rect(13,9,20,ends-9,h);if(['twin','pony'].includes(E.back)){rect(7,13,6,24,h);if(E.back==='twin')rect(35,13,6,24,h);}if(E.back==='wave'){rect(8,21,4,15,h);rect(34,21,4,15,h);}}
   rect(18,38,5,8,ink);rect(26,38,5,8,ink);rect(19,36,10,5,body);rect(14,28,20,13,ink);rect(16,29,16,10,cloth);rect(11,29,4,9,body);rect(33,29,4,9,body);rect(21,26,6,4,body);
   path('M15 7H33V10H36V23H33V27H15V24H12V11H15Z',ink);path('M16 9H32V12H34V22H31V25H17V22H14V12H16Z',body);
   const eye=expression==='sleep'?'sleepy':expression==='happy'?'smile':L.eyes;
   if(['smile','sleepy'].includes(eye)){path('M17 16H21V18H17ZM27 16H31V18H27Z',ink);}else {rect(17,15,eye==='big'?4:3,eye==='sharp'?2:4,L.eye);rect(27,15,eye==='big'?4:3,eye==='sharp'?2:4,E.hetero?E.eye2:L.eye);if(['shine','big','round'].includes(eye)){rect(17,15,1,1,'#fff');rect(27,15,1,1,'#fff');}}
   if(expression==='love'){path('M16 15H18V16H20V15H22V18H20V20H18V18H16ZM26 15H28V16H30V15H32V18H30V20H28V18H26Z','#dc7892');}
   if(L.cheeks!=='none'){rect(15,20,4,2,'#eea1ad');rect(30,20,3,2,'#eea1ad');}
   rect(23,22,3,1,ink);if(L.mouth==='o')rect(24,23,1,1,ink);if(L.mouth==='tongue')rect(24,23,2,2,'#de7990');
   if(E.front!=='none'){const shapes={straight:'M13 7H35V15H30V13H27V15H24V13H21V15H18V13H13Z',part:'M13 7H35V15H31V12H26V10H23V12H18V16H13Z',short:'M13 7H35V12H30V10H25V12H20V10H13Z',curl:'M13 7H35V13H33V17H29V12H26V16H22V12H18V17H13Z',side:'M13 7H35V12H30V15H25V18H21V21H18V15H13Z',messy:'M16 5H21V3H26V6H32V4H35V9H38V14H31V12H26V16H23V12H18V15H12V9H16Z',swoop:'M13 7H35V12H29V15H23V18H18V21H14Z'};path(shapes[E.front],h);}
   if(L.top==='cat')path('M12 10V0L21 7ZM27 7L36 0V10Z',h);if(L.top==='bunny'){rect(15,0,5,9,h);rect(28,0,5,9,h);}if(L.top==='bear'){rect(10,4,7,7,h);rect(31,4,7,7,h);}
  }else{
   const q={...p,stage:'adult',gone:false,form:null,look:{...L,acc:'none'}};
   s+=`<g>${drawBasePet(q,expression).replace(/^<svg[^>]*>/,'<svg x="0" y="0" width="48" height="48" viewBox="0 0 24 24">')}</g>`;
   if(E.hetero){rect(29,29,2,4,E.eye2);}
   if(E.front!=='none')path('M9 14H37V20H31V18H26V22H22V18H17V22H10Z',h);
   if(E.back!=='none'){rect(5,22,4,20,h);rect(38,22,4,20,h);}
  }
  if(E.outfit!=='none'){
   const y=E.model==='human'?30:36;path(`M14 ${y}H34V42H14Z`,cloth);rect(22,y,4,3,'#fff4df');
   if(E.outfit==='dress')path(`M15 ${y+4}H33L38 44H10Z`,cloth);
   if(E.outfit==='suit'){path(`M16 ${y}H23L24 37L25 ${y}H32L28 42H20Z`,'#fff3e9');rect(23,y+2,2,5,ink);}
   if(E.outfit==='sailor'){path(`M14 ${y}H34L27 36H21Z`,'#fff7ec');rect(23,34,3,5,'#da879b');}
   if(E.outfit==='hoodie'){rect(14,y,20,3,lineOf(cloth));rect(19,37,10,4,lineOf(cloth));}
  }
  if(E.mark==='mole')rect(30,E.model==='human'?20:34,1,1,ink);
  if(E.mark==='scar'){rect(17,E.model==='human'?18:29,1,5,'#bd7f84');}
  if(E.mark==='freckles')for(const x of[16,19,29,32])rect(x,E.model==='human'?20:34,1,1,'#b47f70');
  if(!E.accessories.length&&L.acc!=='none')s+=accessory({type:L.acc,x:30,y:8,size:1,c:'#ec91a5'});
  s+=E.accessories.map(accessory).join('');
  E.pixels.forEach((c,i)=>{if(c)rect((i%24)*2,Math.floor(i/24)*2,2,2,c);});
  if(expression==='sleep'){rect(39,5,5,1,ink);rect(42,6,1,2,ink);rect(39,8,5,1,ink);}
  if(photo&&pose==='sit')s=`<g transform="translate(0 7) scale(1 .83)">${s}</g>`;
  if(photo&&pose==='tilt')s=`<g transform="rotate(-10 24 35)">${s}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" shape-rendering="crispEdges">${s}</svg>`;
 }
 const CSS=`
 :host{all:initial}*{box-sizing:border-box}button,input,select,textarea{font:inherit}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #65a49a;outline-offset:2px}*{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif}button{color:inherit}svg{display:block;width:100%;height:100%;image-rendering:pixelated}[hidden]{display:none!important}
 .launcher{position:fixed;width:var(--sz,64px);height:var(--sz,64px);padding:2px;border:0;background:transparent;touch-action:none;filter:drop-shadow(2px 3px 0 #51404b30);z-index:2}.launcher svg{pointer-events:none}.launcher:after{content:'♥';position:absolute;right:0;top:0;font-size:12px;color:#a85b77}.launcher.hot{animation:hop .5s steps(3) 2}
 .veil{position:fixed;inset:0;background:#263f3b66;backdrop-filter:blur(3px)}.panel{position:fixed;right:24px;bottom:24px;width:430px;max-height:calc(100dvh - 48px);background:var(--paper);color:var(--ink);border:3px solid var(--ink);box-shadow:5px 5px 0 var(--ink);display:flex;flex-direction:column;overflow:hidden;font-size:13px;line-height:1.5;--paper:#fff9ed;--ink:#553e49;--accent:#d46c77;--soft:#f3e9da}
 .top{padding:12px 15px 10px;display:flex;align-items:center;gap:10px;border-bottom:2px solid var(--ink);background:var(--paper)}.brand{font:10px monospace;letter-spacing:2px;color:var(--accent)}.title{font-weight:900;font-size:18px;letter-spacing:-.8px}.heading{flex:1}.tiny{font-size:11px;opacity:.7}.square{width:30px;height:30px;border:1.5px solid var(--ink);background:transparent;box-shadow:2px 2px 0 var(--ink);font-weight:900}.content{overflow:auto;overscroll-behavior:contain;padding:0 15px 16px;min-height:0;scrollbar-width:thin}.nav{display:flex;border-top:2px solid var(--ink);background:var(--paper);flex:none}.nav button{flex:1;border:0;background:transparent;padding:10px 1px 8px;font-size:11px;position:relative}.nav button.on{background:var(--ink);color:var(--paper)}.nav b{display:block;font-size:14px;margin-bottom:2px;font-family:monospace}
 .scene{position:relative;height:258px;margin:14px 0 0;border:2px solid var(--ink);overflow:hidden;isolation:isolate;background-color:var(--wall);background-image:linear-gradient(90deg,#fff3 1px,transparent 1px),linear-gradient(#fff3 1px,transparent 1px);background-size:16px 16px;touch-action:pan-y}.floor{position:absolute;inset:62% 0 0;background:var(--floor);border-top:3px solid #66534b55;background-image:linear-gradient(#614a4820 1px,transparent 1px),linear-gradient(90deg,#614a481a 1px,transparent 1px);background-size:40px 18px}.scenelabel{position:absolute;top:8px;left:9px;font:9px monospace;letter-spacing:2px;background:#fff9edbd;padding:2px 5px;color:#553e49;z-index:70}.item{position:absolute;width:76px;height:76px;padding:0;border:0;background:transparent;transform:translate(-50%,-70%) scale(var(--scale,1));transform-origin:center 70%;touch-action:none}.item svg{pointer-events:none}.item.selected{outline:2px dashed var(--ink);outline-offset:4px}.item.flip svg{transform:scaleX(-1)}.actor{position:absolute;left:44%;top:76%;width:100px;height:100px;transform:translate(-50%,-75%);border:0;background:transparent;padding:0;transition:left 2.3s steps(12),top 2.3s steps(12);z-index:55}.actor svg{pointer-events:none;animation:bob 2.5s steps(2) infinite}.actor.sleep svg{animation:none;transform:rotate(-8deg)}.actor.hop svg{animation:hop .45s steps(3) 2}.actor.buddy{left:65%;width:85px;height:85px;z-index:54}.actor.feed svg{animation:chew .25s steps(2) 8}.speech{position:absolute;bottom:81%;left:50%;transform:translateX(-50%);min-width:120px;max-width:230px;padding:7px 10px;background:var(--paper);border:2px solid var(--ink);font-size:12px;line-height:1.45;z-index:90;text-align:center;box-shadow:2px 2px 0 #553e4930;pointer-events:none}.speech:after{content:'';position:absolute;left:50%;bottom:-6px;width:8px;height:8px;transform:rotate(45deg);background:var(--paper);border-right:2px solid var(--ink);border-bottom:2px solid var(--ink)}.prop{position:absolute;width:38px;height:38px;left:53%;top:69%;z-index:65;pointer-events:none;animation:hop .5s steps(3) 3}
 .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.between{justify-content:space-between}.section{margin-top:15px}.label{display:block;font-size:11px;letter-spacing:1px;font-weight:700;margin:12px 0 7px;color:var(--accent)}.btn{border:1.5px solid var(--ink);background:var(--paper);padding:7px 10px;min-height:35px;box-shadow:2px 2px 0 #553e4925;font-size:12px}.btn.on,.btn.primary{background:var(--ink);color:var(--paper)}.btn:hover{filter:brightness(.96)}.btn:active{transform:translate(1px,1px);box-shadow:none}.muted{font-size:11px;opacity:.65;line-height:1.7;margin:8px 0}.status{padding:5px 15px;min-height:26px;font-size:11px;border-top:1px dashed var(--ink);background:var(--soft);flex:none}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px 12px;margin:13px 0}.stat{font-size:10px}.bar{height:5px;margin-top:4px;background:#c3aaa833}.bar i{display:block;height:100%;background:var(--accent);transition:width .4s}.stats b{float:right;font-weight:400}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.tile{min-width:0;border:1.5px solid #553e492b;background:transparent;padding:6px 3px;font-size:10px;cursor:pointer}.tile.on{border-color:var(--ink);background:var(--soft)}.tile .pic{height:54px;width:54px;margin:0 auto 3px}.tile .icon{height:40px;width:40px;margin:0 auto 4px}.food{touch-action:none}.tabs{display:flex;gap:5px;overflow-x:auto;padding:12px 0 6px;scrollbar-width:thin}.tabs button{flex:none}.preview{height:134px;display:flex;align-items:center;justify-content:center;background:var(--soft);margin-top:14px;border:1px dashed #553e4955;position:relative}.preview svg{height:116px;width:116px}.preview span{position:absolute;bottom:6px;right:8px;font:9px monospace;letter-spacing:1px}.field{margin-top:10px}.field>span{display:block;margin-bottom:4px;font-size:11px}input[type=text],input[type=date],textarea,select{width:100%;padding:8px;border:1.5px solid #553e4955;background:var(--paper);color:var(--ink);border-radius:0;min-height:36px;font-size:14px}textarea{resize:vertical;min-height:85px}input[type=color]{width:30px;height:28px;padding:0;border:1px solid var(--ink);background:none;vertical-align:middle}input[type=range]{width:100%;accent-color:var(--accent)}.twocol{display:grid;grid-template-columns:1fr 1fr;gap:10px}.swatch{display:inline-flex;align-items:center;gap:7px;font-size:11px;margin:6px 14px 6px 0}.empty{padding:22px 8px;text-align:center;font-size:12px;opacity:.65}.record{padding:10px 0;border-bottom:1px dashed #553e4933;font-size:12px}.record small{display:block;opacity:.55;font-size:10px}.paint{width:240px;height:240px;max-width:100%;display:block;margin:12px auto;image-rendering:pixelated;touch-action:none;border:2px solid var(--ink);background:repeating-conic-gradient(#e4ded6 0 25%,#fff9ed 0 50%) 0/20px 20px}.foot{font:9px monospace;letter-spacing:1px;text-align:center;margin-top:16px;opacity:.5}.hint{padding:8px 10px;background:var(--soft);font-size:11px;margin-top:10px;border-left:3px solid var(--accent)}.screenhead{padding-top:14px;font-size:16px;font-weight:800}.petcard{display:flex;align-items:center;gap:10px;border:1px solid #553e4933;padding:7px;margin-top:7px}.petcard svg{width:48px;height:48px}.petcard .info{flex:1}.chip{font-size:10px;padding:2px 6px;border:1px solid #553e4944}.upload{display:none}.pending{font-size:11px;color:var(--accent)}
 @keyframes bob{50%{transform:translateY(-3px)}}@keyframes hop{50%{transform:translateY(-9px)}}@keyframes chew{50%{transform:scale(1.04,.94)}}
 @media(max-width:520px){.panel{right:8px;bottom:8px;width:calc(100vw - 20px);max-height:calc(100dvh - 24px);box-shadow:3px 3px 0 var(--ink)}.scene{height:230px}.content{padding-left:12px;padding-right:12px}.actor{width:88px;height:88px}.grid{gap:5px}.nav button{padding:9px 0}.btn{padding:7px 8px}.top{padding:9px 12px}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}
 `;
 const host=document.createElement('div');host.id='mallangpet-host';host.style.cssText='position:fixed;inset:0;width:0;height:0;z-index:2147483000;';
 const root=host.attachShadow({mode:'open'});root.innerHTML=`<style>${CSS}</style><button class="launcher" aria-label="말랑펫 열기"></button><div class="app" hidden><div class="veil"></div><section class="panel" role="dialog" aria-label="말랑펫 픽셀 미니룸"><header class="top"><div class="heading"><div class="brand">MALLANG / PIXEL ROOM</div><div class="title">말랑펫</div></div><button class="square" data-do="settings" aria-label="설정">≡</button><button class="square" data-do="close" aria-label="닫기">×</button></header><main class="content"></main><div class="status" role="status" aria-live="polite">자동 저장 · 오늘도 함께</div><nav class="nav"></nav></section></div>`;
 document.body.appendChild(host);const $=s=>root.querySelector(s),$$=s=>[...root.querySelectorAll(s)];
 const main=$('.content'),launcher=$('.launcher');
 function status(t){$('.status').textContent=t;}
 function theme(){const t=THEMES[state.room.theme];$('.panel').style.cssText=`--paper:${t[3]};--ink:${t[5]};--accent:${t[4]};--soft:${t[1]}88`;}
 function say(s,ex='happy'){expr=ex;exprUntil=Date.now()+3500;sayUntil=Date.now()+4200;const speech=$('.speech');if(speech){speech.textContent=s;speech.hidden=false;}status(s);refreshActors();}
 function getExpr(){return Date.now()<exprUntil?expr:pet().sleeping?'sleep':'normal';}
 function refreshActors(){const p=pet(),a=$('.actor.mainpet');if(a){a.innerHTML=portrait(p,view==='photo'?photoExpr:getExpr(),view==='photo');a.className='actor mainpet '+(p.sleeping?'sleep':sceneMood);a.style.left=sceneX+'%';a.style.top=sceneY+'%';}launcher.innerHTML=portrait(p,getExpr());if(Date.now()>sayUntil&&$('.speech'))$('.speech').hidden=true;}
 function positionFab(){const s=state.scale;launcher.style.setProperty('--sz',s+'px');launcher.style.left=clamp(state.pos.x,0,1)*Math.max(0,innerWidth-s-16)+8+'px';launcher.style.top=clamp(state.pos.y,0,1)*Math.max(0,innerHeight-s-16)+8+'px';launcher.hidden=state.hidden;}
 function open(){simulate();save();$('.app').hidden=false;launcher.style.visibility='hidden';view='home';render();say(line('hello'));$('.content').scrollTop=0;$('.square').focus();}
 function close(){$('.app').hidden=true;launcher.style.visibility='visible';save();launcher.focus();}
 function button(label,action,extra=''){const cls=extra.match(/class="([^"]*)"/);return `<button class="${cls?cls[1]:'btn'}" data-do="${action}" ${extra.replace(/class="[^"]*"/,'')}>${label}</button>`;}
 function selectField(label,key,options,value){return `<label class="field"><span>${label}</span><select data-field="${key}">${Object.entries(options).map(([k,v])=>`<option value="${k}" ${value===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`;}
 function colorField(label,key,value){return `<label class="swatch">${label} <input type="color" data-field="${key}" value="${color(value)}"></label>`;}
 function inputField(label,key,value,type='text'){return `<label class="field"><span>${label}</span><input type="${type}" data-field="${key}" maxlength="${key==='name'?20:40}" value="${esc(value)}"></label>`;}
 function scene(){const R=state.room;return `<div class="scene" style="--wall:${R.wall};--floor:${R.floor}"><div class="floor"></div><div class="scenelabel">${editRoom?'ROOM EDIT':view==='photo'?'PHOTO STUDIO':'MY LITTLE ROOM'}</div>${R.items.map((a,i)=>`<button class="item ${a.flip?'flip':''} ${selected===a.id?'selected':''}" aria-label="${FURN[a.type]}" data-item="${a.id}" style="left:${a.x}%;top:${a.y}%;--scale:${a.size};z-index:${i+1}">${pixelIcon(a.type,a.c)}</button>`).join('')}<button class="actor mainpet ${pet().sleeping?'sleep':''}" data-do="pet" aria-label="${esc(pet().name)} 쓰다듬기" style="left:${sceneX}%;top:${sceneY}%">${portrait(pet(),view==='photo'?photoExpr:getExpr(),view==='photo')}</button>${state.buddy>=0?`<button class="actor buddy" data-do="pair" aria-label="함께 놀기">${portrait(state.pets[state.buddy],'happy')}</button>`:''}<div class="speech" hidden></div></div>`;}
 function stats(){const p=pet();return `<div class="stats">${[['hunger','포만감'],['fun','기분'],['energy','기력'],['health','건강'],['clean','청결'],['bond','친밀도']].map(([k,n])=>`<div class="stat">${n}<b>${Math.round(p[k])}</b><div class="bar"><i style="width:${clamp(p[k])}%"></i></div></div>`).join('')}</div>`;}
 function home(){const p=pet(),birthday=p.profile.birthday.slice(5)===day().slice(5);return `${scene()}<div class="row between" style="margin-top:10px"><strong>${esc(p.name)} <span class="chip">${TYPES[p.profile.type]}</span> <span class="chip">${({egg:'알',baby:'아기',child:'어린이',adult:'어른'})[p.stage]}</span></strong><span class="tiny">함께한 지 ${Math.max(1,Math.floor((Date.now()-p.born)/86400000)+1)}일</span></div>${birthday?'<div class="hint">오늘은 생일! 케이크를 주고 기념사진을 남겨 봐.</div>':''}${stats()}<div class="grid">${[['pet','쓰다듬기'],['hug','안아주기'],['play','놀아주기'],['wash','씻기기'],['brush','빗질'],['sleep',p.sleeping?'깨우기':'재우기'],['gift','선물하기'],['med','약 주기']].map(([k,n])=>button(n,k)).join('')}</div><div class="label">TODAY / 대화 ${p.day.chats}번 · 누적 ${p.chats}번</div><div class="muted">${state.mode==='cozy'?'편안한 모드 · 쉬었다 와도 아프거나 떠나지 않아요.':'돌보기 모드 · 시간이 지나면 배고파져요. 펫은 떠나지 않아요.'}</div><div class="foot">A LITTLE SPACE FOR YOUR FAVORITE</div>`;}
 function kitchen(){const p=pet();return `${scene()}<div class="screenhead">오늘은 뭘 먹을까?</div><p class="muted">눌러서 먹이거나, 음식을 펫에게 끌어다 주세요.</p><div class="grid">${Object.entries(FOODS).map(([k,v])=>`<button class="tile food" data-food="${k}"><div class="icon">${pixelIcon(v[3])}</div>${v[0]}<div class="tiny">포만감 +${v[1]}</div>${p.profile.favorite===k?'<span class="chip">최애 음식</span>':''}</button>`).join('')}</div><div class="hint">프로필에서 좋아하는 음식과 싫어하는 음식을 정할 수 있어요.</div>`;}
 const APPEAR={body:['모양',SHAPES,'shape'],ears:['귀',TOPS,'top'],eyes:['눈',EYES,'eyes'],nose:['코',NOSES,'nose'],mouth:['입',MOUTHS,'mouth'],cheeks:['볼',CHEEKS,'cheeks']};
 const FRONT={none:'없음',straight:'일자 앞머리',part:'가르마',short:'짧은 머리',curl:'곱슬',side:'옆머리',messy:'삐죽 머리',swoop:'눈 덮는 머리'};
 const BACK={none:'없음',bob:'단발',long:'긴 머리',pony:'포니테일',twin:'양갈래',wave:'웨이브'};
 function wardrobe(){const p=pet();let inner='';if(APPEAR[tab]){const[_,opts,key]=APPEAR[tab];inner=`<div class="grid">${Object.entries(opts).map(([k,v])=>{const q=copy(p);q.look[key]=k;return `<button class="tile ${p.look[key]===k?'on':''}" data-look="${key}:${k}"><div class="pic">${portrait(q)}</div>${esc(v.name||v)}</button>`;}).join('')}</div>`;}
  if(tab==='hair')inner=selectField('앞머리','extra.front',FRONT,p.extra.front)+selectField('뒷머리','extra.back',BACK,p.extra.back)+colorField('머리 색','look.hair',p.look.hair);
  if(tab==='clothes')inner=selectField('의상','extra.outfit',{none:'없음',shirt:'티셔츠',dress:'원피스',hoodie:'후드티',suit:'정장',sailor:'세일러'},p.extra.outfit)+colorField('옷 색','extra.cloth',p.extra.cloth);
  if(tab==='fantasy')inner=selectField('날개','extra.wings',{none:'없음',angel:'천사',bat:'악마',fairy:'요정'},p.extra.wings)+selectField('꼬리','extra.tail',{none:'없음',cat:'고양이',fox:'여우',devil:'악마',bunny:'토끼'},p.extra.tail)+selectField('포인트','extra.mark',{none:'없음',mole:'눈물점',scar:'흉터',freckles:'주근깨'},p.extra.mark);
  if(tab==='color')inner=colorField('피부·몸','look.body',p.look.body)+colorField('머리·귀','look.hair',p.look.hair)+colorField('눈','look.eye',p.look.eye)+colorField('오른쪽 눈','extra.eye2',p.extra.eye2)+`<label class="field"><input type="checkbox" data-field="extra.hetero" ${p.extra.hetero?'checked':''}> 오드아이</label>`;
  if(tab==='accessory'){inner=`<p class="muted">여러 개를 겹쳐 달 수 있어요. 선택한 장식은 아래에서 위치를 조절하세요.</p><div class="row">${Object.entries(ACC).map(([k,n])=>button('+ '+n,'addacc',`data-val="${k}"`)).join('')}</div>`;inner+=p.extra.accessories.map((a,i)=>`<div class="record"><div class="row between"><strong>${ACC[a.type]} ${i+1}</strong>${button('선택','selectacc',`data-val="${a.id}" class="btn ${selected===a.id?'on':''}"`)}</div>${selected===a.id?`<div class="twocol">${range('가로',a.x,0,48,'acc.x')}${range('세로',a.y,0,48,'acc.y')}</div>${range('크기',a.size,.5,3,'acc.size',.1)}${colorField('장식 색','acc.c',a.c)}<div class="row">${button('반전','flipacc',`data-val="${a.id}"`)}${button('맨 앞으로','frontacc',`data-val="${a.id}"`)}${button('삭제','delacc',`data-val="${a.id}"`)}</div>`:''}</div>`).join('');}
  if(tab==='pixel')inner=`<p class="muted">투명한 24×24 도트 레이어에 직접 그려요. 그림은 캐릭터 맨 앞에 겹쳐집니다.</p><div class="row"><input aria-label="도트 색" type="color" data-paint-color value="${paintColor}">${button('펜','pen',`class="btn ${!erasing?'on':''}"`)}${button('지우개','eraser',`class="btn ${erasing?'on':''}"`)}${button('되돌리기','undo')}${button('전체 지우기','clearpaint')}</div><canvas class="paint" width="240" height="240" aria-label="도트 그리기"></canvas>`;
  return `<div class="preview">${portrait(p)}<span>LIVE PREVIEW</span></div>${selectField('캐릭터 타입','extra.model',{pet:'말랑 동물형',human:'최애 사람형'},p.extra.model)}<div class="tabs">${[['body','몸'],['ears','귀'],['hair','머리'],['eyes','눈'],['nose','코'],['mouth','입'],['cheeks','볼'],['clothes','옷'],['fantasy','인외'],['color','색'],['accessory','장식'],['pixel','직접 그리기']].map(([k,n])=>button(n,'tab',`data-val="${k}" class="btn ${tab===k?'on':''}"`)).join('')}</div>${inner}`;}
 function range(label,v,min,max,key,step=1){return `<label class="field"><span>${label} <output>${Math.round(v*10)/10}</output></span><input type="range" data-field="${key}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;}
 function roomView(){const r=state.room,a=r.items.find(x=>x.id===selected);return `${scene()}<div class="row between section"><strong>나만의 미니룸</strong>${button(editRoom?'배치 완료':'가구 옮기기','editroom',`class="btn ${editRoom?'on':''}"`)}</div><div class="muted">${editRoom?'가구를 눌러 선택하고 드래그해 배치하세요.':'침대·의자·인형을 누르면 펫이 다가가요.'}</div><div class="tabs">${Object.entries(THEMES).map(([k,t])=>button(t[0],'theme',`data-val="${k}" class="btn ${r.theme===k?'on':''}"`)).join('')}</div>${colorField('벽지','room.wall',r.wall)}${colorField('바닥','room.floor',r.floor)}${a?`<div class="hint">선택: ${FURN[a.type]}</div>${range('크기',a.size,.4,2,'item.size',.1)}${colorField('가구 색','item.c',a.c)}<div class="row">${button('좌우 반전','flipitem')}${button('맨 앞으로','frontitem')}${button('맨 뒤로','backitem')}${button('삭제','delitem')}</div>`:''}<div class="label">FURNITURE / ${r.items.length} · 최대 40개</div><div class="grid">${Object.entries(FURN).map(([k,n])=>`<button class="tile" data-do="additem" data-val="${k}"><div class="icon">${pixelIcon(k)}</div>${n}</button>`).join('')}</div>`;}
 function profile(){const p=pet(),pr=p.profile;return `<div class="screenhead">최애 소개</div>${inputField('이름','name',p.name)}${selectField('성격','profile.type',TYPES,pr.type)}${inputField('나를 부르는 호칭','profile.user',pr.user)}<div class="twocol">${inputField('생일','profile.birthday',pr.birthday,'date')}${inputField('만난 날','profile.met',pr.met,'date')}</div>${colorField('상징색','profile.symbol',pr.symbol)}<div class="twocol">${selectField('좋아하는 음식','profile.favorite',Object.fromEntries(Object.entries(FOODS).map(([k,v])=>[k,v[0]])),pr.favorite)}${selectField('싫어하는 음식','profile.dislike',{'':'없음',...Object.fromEntries(Object.entries(FOODS).map(([k,v])=>[k,v[0]]))},pr.dislike)}</div><label class="field"><span>혼잣말 직접 설정 · 한 줄에 하나씩</span><textarea maxlength="1200" data-field="profile.lines" placeholder="오늘도 기다렸어, {user}.\n{name}도 같이 갈래.">${esc(pr.lines)}</textarea></label><p class="muted">{user}는 내 호칭, {name}은 펫 이름으로 바뀌어요. 대사는 입력한 문장과 기본 문장으로 반응하며 별도 AI API는 사용하지 않아요.</p><div class="label">CHARACTERS / ${state.pets.length} · 최대 8명</div>${state.pets.map((q,i)=>`<div class="petcard">${portrait(q)}<div class="info"><strong>${esc(q.name)}</strong><div class="tiny">${TYPES[q.profile.type]}${i===state.active?' · 현재 최애':''}${i===state.buddy?' · 함께 있는 친구':''}</div></div>${i!==state.active?button('선택','switch',`data-val="${i}"`):''}${i!==state.active?button(i===state.buddy?'함께 끄기':'함께 두기','buddy',`data-val="${i}"`):''}</div>`).join('')}<div class="row section">${button('+ 새 캐릭터','newpet')}${button('현재 캐릭터 복제','clonepet')}${state.pets.length>1?button(deleteArmed?'정말 삭제하기':'현재 캐릭터 삭제',deleteArmed?'confirmdelpet':'delpet'):''}</div><div class="label">PRESETS / 코디와 방 보관</div>${button('지금 모습과 방 저장','preset')}${state.presets.map((a,i)=>`<div class="record row between"><span>${esc(a.name)}</span><div class="row">${button('적용','loadpreset',`data-val="${i}"`)}${button('삭제','delpreset',`data-val="${i}"`)}</div></div>`).join('')}`;}
 function photo(){return `${scene()}<div class="screenhead">최애 사진관</div><p class="muted">현재 꾸민 방과 함께 있는 친구까지 한 장에 담아요.</p>${selectField('표정','photoExpr',{normal:'기본',happy:'웃음',love:'하트눈',sleep:'잠',sad:'슬픔'},photoExpr)}${selectField('포즈','pose',{stand:'서 있기',sit:'앉기',tilt:'고개 기울이기'},pose)}<div class="row section">${button('방과 함께 PNG','snaproom','class="btn primary"')}${button('캐릭터 투명 PNG','snappet')}</div><div class="label">MEMORIES / 최근 150개</div><div class="row"><input type="text" data-note maxlength="180" placeholder="오늘의 추억 한 줄" style="flex:1;min-width:120px">${button('기록','note')}</div>${state.album.length?state.album.slice().reverse().map(a=>`<div class="record"><small>${new Date(a.at).toLocaleString('ko-KR')}</small>${esc(a.note)}</div>`).join(''):'<div class="empty">함께한 추억이 여기에 쌓여요.</div>'}`;}
 function settings(){return `<div class="screenhead">작은 방 설정</div>${selectField('돌보기 방식','mode',{cozy:'편안한 모드 · 방치 페널티 없음',care:'돌보기 모드 · 배고픔·기력 감소'},state.mode)}<p class="muted">두 모드 모두 펫이 떠나지 않아요. 편안한 모드에서도 밥·놀이·잠으로 상태를 채울 수 있어요.</p><label class="field"><input type="checkbox" data-field="react" ${state.react?'checked':''}> 크랙에서 내가 보낸 말에 반응하기</label><p class="muted">대화 내용은 저장하거나 외부로 보내지 않아요. 방 이동으로 불러온 과거 대화는 세지 않아요.</p>${range('화면 위 펫 크기',state.scale,40,100,'scale')}<div class="row section">${button('펫 위치 초기화','resetpos')}${button('펫 버튼 숨기기','hide')}</div><p class="muted">숨긴 펫은 템퍼몽키 메뉴의 ‘말랑펫 열기 / 다시 보이기’로 꺼낼 수 있어요.</p><div class="label">BACKUP / 파일로 보관하고 공유</div><div class="row">${button('전체 백업','backup')}${button('최애·방만 공유','share')}${button('파일 불러오기','import')}</div><input class="upload" type="file" accept=".json,application/json"><div class="hint">전체 백업은 캐릭터·방·기록을 포함해요. 최애·방 공유 파일은 새 캐릭터로 추가되며, 개인 대화 통계와 추억은 포함하지 않아요. 전체 백업을 불러오면 현재 데이터와 교체돼요.</div><div class="foot">MALLANG PET / VERSION 3.0.0</div>`;}
 const views={home,kitchen,wardrobe,room:roomView,profile,photo,settings};
 function render(){theme();$('.title').textContent=pet().name+'의 작은 방';const scroll=main.scrollTop;main.innerHTML=views[view]();main.scrollTop=scroll;$('.nav').innerHTML=[['home','⌂','돌보기'],['kitchen','+','밥주기'],['wardrobe','✧','꾸미기'],['room','▦','미니룸'],['profile','♥','최애'],['photo','▣','사진관']].map(([k,i,n])=>`<button data-view="${k}" class="${view===k?'on':''}"><b>${i}</b>${n}</button>`).join('');refreshActors();if(view==='photo'){const a=$('.actor.mainpet');a.innerHTML=portrait(pet(),photoExpr,true);}if(tab==='pixel'&&view==='wardrobe')drawPaint();positionFab();}
 function navigate(v){deleteArmed=false;view=v;selected=null;editRoom=false;sceneX=44;sceneY=76;sceneMood='idle';render();main.scrollTop=0;}
 function acted(k){const p=pet();if(p.sleeping&&k!=='sleep'){say('지금은 자고 있어요. 먼저 깨워 주세요.','sleep');return;}
  if(k==='sleep'){p.sleeping=!p.sleeping;sceneMood='idle';if(p.sleeping){const bed=state.room.items.find(a=>a.type==='bed');if(bed){sceneX=bed.x;sceneY=bed.y;}}say(p.sleeping?'포근한 이불 덮고… 잘 자.':'잘 잤다!','sleep');}
  else {const effects={pet:[3,0,0,0,'pet'],hug:[7,0,0,0,'pet'],play:[20,-6,-3,0,'play'],wash:[8,0,0,35,'pet'],brush:[6,0,0,12,'pet'],gift:[15,0,0,0,'hello'],med:[0,0,0,0,'hello']},e=effects[k];if(!e)return;p.fun=clamp(p.fun+e[0]);p.energy=clamp(p.energy+e[1]);p.hunger=clamp(p.hunger+e[2]);p.clean=clamp(p.clean+e[3]);p.bond=clamp(p.bond+1,0,1e9);if(k==='med')p.health=clamp(p.health+30);sceneMood='hop';say(k==='wash'?'보글보글, 뽀송해졌어!':k==='brush'?'머리가 보들보들해졌어.':k==='med'?'조금 더 편안해졌어.':k==='gift'?'나한테 주는 선물이야? 고마워!':line(e[4]),k==='pet'||k==='hug'?'love':'happy');}
  if(['gift','hug'].includes(k)&&!state.album.some(a=>a.note===`${p.name}에게 처음 ${k==='gift'?'선물':'포옹'}을 해 줬어요.`))log(`${p.name}에게 처음 ${k==='gift'?'선물':'포옹'}을 해 줬어요.`);
  save();updateStats();refreshActors();if(k==='sleep')render();setTimeout(()=>{sceneMood='idle';refreshActors();},1200);
 }
 function updateStats(){if($('.stats'))$('.stats').outerHTML=stats();}
 function feed(k){const p=pet(),f=FOODS[k];if(!f)return;if(p.sleeping){say('자는 중이에요. 먼저 깨워 주세요.','sleep');return;}if(p.hunger>=98){say('지금은 배불러! 조금 있다가 먹자.');return;}p.hunger=clamp(p.hunger+f[1]);p.fun=clamp(p.fun+f[2]+(p.profile.favorite===k?8:0));p.bond++;sceneMood='feed';say(p.profile.dislike===k?'이건 내 취향은 아니지만… 한 입 먹을게.':p.profile.favorite===k?'내가 제일 좋아하는 '+f[0]+'!':line('feed'),p.profile.dislike===k?'sad':'happy');if(!state.album.some(a=>a.note===`${p.name}에게 ${f[0]}을 처음 줬어요.`))log(`${p.name}에게 ${f[0]}을 처음 줬어요.`);const s=$('.scene');if(s){const prop=document.createElement('div');prop.className='prop';prop.innerHTML=pixelIcon(f[3]);s.append(prop);setTimeout(()=>prop.remove(),1900);}save();updateStats();refreshActors();setTimeout(()=>{sceneMood='idle';refreshActors();},2200);}
 function interactItem(a){if(editRoom){selected=a.id;render();return;}sceneX=clamp(a.x,18,82);sceneY=clamp(a.y+5,42,84);let s='한번 구경해 볼까?';if(a.type==='bed'){acted('sleep');return;}if(a.type==='chair')s='여기 잠깐 앉아 있을래.';if(a.type==='bear'){s='인형도 꼬옥 안아 줬어.';pet().fun=clamp(pet().fun+2);}if(a.type==='desk')s='여기서 네 이야기를 적어 볼까?';say(s);save();refreshActors();}
 let lastAction=0,pendingImport=null,deleteArmed=false;
 root.addEventListener('click',async e=>{const v=e.target.closest('[data-view]');if(v){navigate(v.dataset.view);return;}const food=e.target.closest('[data-food]');if(food){if(Date.now()-lastAction<300)return;lastAction=Date.now();feed(food.dataset.food);return;}const it=e.target.closest('[data-item]');if(it){if(Date.now()<dragSuppress)return;interactItem(state.room.items.find(a=>a.id===it.dataset.item));return;}const look=e.target.closest('[data-look]');if(look){const[k,val]=look.dataset.look.split(':');pet().look[k]=val;save();render();return;}
  const b=e.target.closest('[data-do]');if(!b)return;const k=b.dataset.do,val=b.dataset.val,p=pet();
  if(k==='close'){close();return;}if(k==='settings'){navigate('settings');return;}
  if(['pet','hug','play','wash','brush','sleep','gift','med'].includes(k)){if(Date.now()-lastAction<350)return;lastAction=Date.now();acted(k);return;}
  if(k==='pair'){p.fun=clamp(p.fun+5);p.bond++;if(state.buddy>=0)state.pets[state.buddy].bond++;say(p.name+'와 '+state.pets[state.buddy].name+'가 나란히 쉬고 있어.','love');save();return;}
  if(k==='tab'){tab=val;selected=null;render();return;}
  if(k==='addacc'){if(p.extra.accessories.length>=16){status('장식은 최대 16개까지 달 수 있어요.');return;}const a={id:id(),type:val,x:28,y:9,size:1,flip:false,c:'#e990a8'};p.extra.accessories.push(a);p.look.acc='none';selected=a.id;}
  if(k==='selectacc')selected=val;
  if(k==='delacc')p.extra.accessories=p.extra.accessories.filter(a=>a.id!==val);
  if(k==='flipacc'){const a=p.extra.accessories.find(a=>a.id===val);if(a)a.flip=!a.flip;}
  if(k==='frontacc'){const a=p.extra.accessories.find(a=>a.id===val);p.extra.accessories=p.extra.accessories.filter(a=>a.id!==val).concat(a||[]);}
  if(k==='pen'||k==='eraser'){erasing=k==='eraser';render();return;}
  if(k==='undo'){const a=paintUndo.pop();if(a)p.extra.pixels=a;}
  if(k==='clearpaint'){paintUndo.push([...p.extra.pixels]);p.extra.pixels=Array(576).fill(null);}
  if(k==='editroom')editRoom=!editRoom;
  if(k==='theme'){state.room.theme=val;state.room.wall=THEMES[val][1];state.room.floor=THEMES[val][2];}
  if(k==='additem'){if(state.room.items.length>=40){status('가구는 최대 40개까지 배치할 수 있어요.');return;}const a={id:id(),type:val,x:50,y:65,size:1,flip:false,c:'#d79aac'};state.room.items.push(a);selected=a.id;editRoom=true;}
  const a=state.room.items.find(a=>a.id===selected);
  if(k==='delitem')state.room.items=state.room.items.filter(a=>a.id!==selected);
  if(k==='flipitem'&&a)a.flip=!a.flip;
  if(k==='frontitem'&&a)state.room.items=state.room.items.filter(b=>b!==a).concat(a);
  if(k==='backitem'&&a)state.room.items=[a,...state.room.items.filter(b=>b!==a)];
  if(k==='switch'){state.active=Number(val);if(state.buddy===state.active)state.buddy=-1;paintUndo=[];sceneX=44;sceneY=76;}
  if(k==='buddy')state.buddy=state.buddy===Number(val)?-1:Number(val);
  if(k==='delpet'){deleteArmed=true;render();status('현재 캐릭터를 삭제하려면 ‘정말 삭제하기’를 누르세요.');return;}
  if(k==='confirmdelpet'&&state.pets.length>1){const old=state.active;state.pets.splice(old,1);state.active=Math.min(old,state.pets.length-1);state.buddy=-1;deleteArmed=false;paintUndo=[];}
  if(k==='newpet'||k==='clonepet'){if(state.pets.length>=8){status('캐릭터는 최대 8명까지 만들 수 있어요.');return;}const q=k==='clonepet'?copy(p):fresh();q.name=k==='clonepet'?p.name+' 2':'새 말랑이';state.pets.push(q);state.active=state.pets.length-1;paintUndo=[];log(q.name+'와 새로운 하루를 시작했어요.');}
  if(k==='preset'){if(state.presets.length>=12){status('프리셋은 12개까지 보관할 수 있어요.');return;}state.presets.push({name:p.name+' · '+THEMES[state.room.theme][0],pet:copy(p),room:copy(state.room)});}
  if(k==='loadpreset'){const a=state.presets[Number(val)];if(a){p.look=copy(a.pet.look);p.extra=copy(a.pet.extra);state.room=copy(a.room);}}
  if(k==='delpreset')state.presets.splice(Number(val),1);
  if(k==='note'){const n=$('[data-note]').value.trim();if(n)log(n);}
  if(k==='snaproom'||k==='snappet'){await snapshot(k==='snappet');return;}
  if(k==='resetpos')state.pos={x:.94,y:.65};
  if(k==='hide'){state.hidden=true;close();}
  if(k==='backup'){download('말랑펫_전체백업.json',JSON.stringify({format:'mallang-backup',version:3,data:state},null,2),'application/json');status('전체 백업 파일을 내려받았어요.');return;}
  if(k==='share'){const q=copy(p);q.chats=0;q.xp=0;q.day={d:day(),chats:0};q.bond=0;q.born=Date.now();download('말랑펫_최애와방.json',JSON.stringify({format:'mallang-share',version:3,pet:q,room:state.room},null,2),'application/json');status('공유 파일을 내려받았어요.');return;}
  if(k==='import'){$('.upload').click();return;}
  if(k==='cancelimport'){pendingImport=null;render();return;}
  if(k==='confirmimport'&&pendingImport){const backup=copy(state);state=pendingImport;pendingImport=null;if(!save()){state=backup;status('저장하지 못해 불러오기를 취소했어요.');return;}navigate('home');status('백업을 불러왔어요.');return;}
  save();render();if(!saveError)status('저장했어요 · '+pet().name+'의 작은 방');
 });
 function setField(key,value){let target;if(key.startsWith('acc.'))target=pet().extra.accessories.find(a=>a.id===selected);else if(key.startsWith('item.'))target=state.room.items.find(a=>a.id===selected);else if(key.startsWith('look.'))target=pet().look;else if(key.startsWith('extra.'))target=pet().extra;else if(key.startsWith('profile.'))target=pet().profile;else if(key.startsWith('room.'))target=state.room;else if(key==='name')target=pet();else target=state;
  if(key==='photoExpr'){photoExpr=value;return;}if(key==='pose'){pose=value;return;}if(target)target[key.split('.').pop()]=value;
 }
 root.addEventListener('input',e=>{const el=e.target;if(el.matches('[data-paint-color]')){paintColor=el.value;return;}const key=el.dataset.field;if(!key)return;const v=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;setField(key,v);if(el.type==='range'){const out=el.parentElement.querySelector('output');if(out)out.textContent=v;}save();if(key==='scale')positionFab();if(key==='name')$('.title').textContent=pet().name+'의 작은 방';const preview=$('.preview');if(preview)preview.innerHTML=portrait(pet())+'<span>LIVE PREVIEW</span>';refreshActors();if(view==='photo')$('.actor.mainpet').innerHTML=portrait(pet(),photoExpr,true);
  if(key.startsWith('room.')){const s=$('.scene');if(s){s.style.setProperty('--wall',state.room.wall);s.style.setProperty('--floor',state.room.floor);}}
  if(key.startsWith('item.')){const a=state.room.items.find(a=>a.id===selected),el=$(`[data-item="${selected}"]`);if(a&&el){el.style.setProperty('--scale',a.size);el.innerHTML=pixelIcon(a.type,a.c);}}
 });
 root.addEventListener('change',async e=>{if(e.target.matches('.upload')){const file=e.target.files[0];if(!file)return;try{if(file.size>2e6)throw Error('파일은 2MB 이하로 넣어 주세요.');const v=JSON.parse(await file.text());if(v.version!==3)throw Error('말랑펫 3 버전 파일을 선택해 주세요.');if(v.format==='mallang-share'){if(!v.pet||!v.room)throw Error('공유 파일이 올바르지 않아요.');if(state.pets.length>=8)throw Error('캐릭터 슬롯이 가득 찼어요.');state.pets.push(sanitizePet(v.pet));state.active=state.pets.length-1;state.room=sanitizeRoom(v.room);save();navigate('home');status('새 최애와 방을 불러왔어요.');}else if(v.format==='mallang-backup'){if(!Array.isArray(v.data?.pets)||!v.data.pets.length)throw Error('백업에 캐릭터가 없어요.');pendingImport=normalize(v.data);const box=document.createElement('div');box.className='hint';box.innerHTML=`<strong>현재 데이터를 백업 파일로 바꿀까요?</strong><p>캐릭터 ${pendingImport.pets.length}명 · 추억 ${pendingImport.album.length}개</p><div class="row">${button('불러오기','confirmimport')}${button('취소','cancelimport')}</div>`;main.prepend(box);main.scrollTop=0;}else throw Error('말랑펫 백업 또는 공유 파일이 아니에요.');}catch(err){status(err.message||'파일을 읽지 못했어요.');}e.target.value='';return;}
  if(e.target.dataset.field&&!['text','date','color','range','checkbox','textarea'].includes(e.target.type))render();
 });
 function drawPaint(){const c=$('.paint');if(!c)return;const ctx=c.getContext('2d');ctx.clearRect(0,0,240,240);pet().extra.pixels.forEach((v,i)=>{if(v){ctx.fillStyle=v;ctx.fillRect(i%24*10,Math.floor(i/24)*10,10,10);}});ctx.strokeStyle='#553e4925';ctx.lineWidth=.5;for(let i=0;i<=24;i++){ctx.beginPath();ctx.moveTo(i*10,0);ctx.lineTo(i*10,240);ctx.moveTo(0,i*10);ctx.lineTo(240,i*10);ctx.stroke();}}
 let dragging=null,painting=false,dragSuppress=0;
 function paintAt(e){const c=$('.paint');if(!c)return;const r=c.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*24),y=Math.floor((e.clientY-r.top)/r.height*24);if(x>=0&&x<24&&y>=0&&y<24){pet().extra.pixels[y*24+x]=erasing?null:paintColor;drawPaint();const pr=$('.preview');if(pr)pr.innerHTML=portrait(pet())+'<span>LIVE PREVIEW</span>';}}
 root.addEventListener('pointerdown',e=>{if(e.button>0)return;const t=e.target;if(t.closest('.launcher')){dragging={kind:'fab',x:e.clientX,y:e.clientY,ox:launcher.offsetLeft,oy:launcher.offsetTop,moved:false};launcher.setPointerCapture(e.pointerId);}
  else if(t.matches('.paint')){painting=true;paintUndo.push([...pet().extra.pixels]);paintUndo=paintUndo.slice(-30);t.setPointerCapture(e.pointerId);paintAt(e);}
  else if(t.closest('[data-item]')&&editRoom){const el=t.closest('[data-item]'),a=state.room.items.find(a=>a.id===el.dataset.item),r=$('.scene').getBoundingClientRect();selected=a.id;dragging={kind:'item',a,el,r,x:e.clientX,y:e.clientY,ox:a.x,oy:a.y,moved:false};el.setPointerCapture(e.pointerId);}
  else if(t.closest('[data-food]')){const el=t.closest('[data-food]');dragging={kind:'food',food:el.dataset.food,x:e.clientX,y:e.clientY,moved:false};el.setPointerCapture(e.pointerId);}
 });
 root.addEventListener('pointermove',e=>{if(painting){paintAt(e);return;}const d=dragging;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>6)d.moved=true;if(!d.moved)return;if(d.kind==='fab'){launcher.style.left=clamp(d.ox+dx,8,innerWidth-state.scale-8)+'px';launcher.style.top=clamp(d.oy+dy,8,innerHeight-state.scale-8)+'px';}if(d.kind==='item'){d.a.x=clamp(d.ox+dx/d.r.width*100,8,92);d.a.y=clamp(d.oy+dy/d.r.height*100,12,90);d.el.style.left=d.a.x+'%';d.el.style.top=d.a.y+'%';d.el.classList.add('selected');}if(d.kind==='food'){let prop=$('.dragfood');if(!prop){prop=document.createElement('div');prop.className='dragfood';prop.style.cssText='position:fixed;width:42px;height:42px;pointer-events:none;z-index:100';prop.innerHTML=pixelIcon(FOODS[d.food][3]);$('.panel').append(prop);}prop.style.left=e.clientX-21+'px';prop.style.top=e.clientY-21+'px';}});
 function endPointer(e,cancel=false){if(painting){painting=false;save();refreshActors();return;}const d=dragging;if(!d)return;dragging=null;$('.dragfood')?.remove();if(cancel)return;if(d.kind==='fab'){if(d.moved){state.pos={x:clamp((launcher.offsetLeft-8)/Math.max(1,innerWidth-state.scale-16),0,1),y:clamp((launcher.offsetTop-8)/Math.max(1,innerHeight-state.scale-16),0,1)};save();}else open();}
  if(d.kind==='item'){if(d.moved)dragSuppress=Date.now()+400;save();render();}
  if(d.kind==='food'&&d.moved){lastAction=Date.now();const r=$('.actor.mainpet')?.getBoundingClientRect();if(r&&e.clientX>=r.left-30&&e.clientX<=r.right+30&&e.clientY>=r.top-30&&e.clientY<=r.bottom+30)feed(d.food);else status('음식을 펫에게 가져다 주세요.');}}
 root.addEventListener('pointerup',e=>endPointer(e));root.addEventListener('pointercancel',e=>endPointer(e,true));
 // Keyboard launcher support; pointer opening is handled by pointerup.
 launcher.addEventListener('click',e=>{if(e.detail===0)open();});$('.veil').addEventListener('click',close);
 root.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close();if(e.key==='Tab'&&!$('.app').hidden){const els=$$('.panel button,.panel input,.panel select,.panel textarea').filter(x=>!x.disabled&&x.offsetParent!==null);const first=els[0],last=els.at(-1);if(e.shiftKey&&root.activeElement===first){last?.focus();e.preventDefault();}else if(!e.shiftKey&&root.activeElement===last){first?.focus();e.preventDefault();}}});root.addEventListener('keyup',e=>e.stopPropagation());
 function download(name,data,type){const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 async function snapshot(transparent){status('사진을 만들고 있어요…');const p=pet(),w=transparent?480:960,h=transparent?480:720;let s='';if(transparent)s=portrait(p,photoExpr,true).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');else{const r=state.room;s=`<rect width="960" height="720" fill="${r.wall}"/><rect y="420" width="960" height="300" fill="${r.floor}"/>`;for(let y=440;y<720;y+=48)s+=`<path d="M0 ${y}H960" stroke="#553e4920" stroke-width="2"/>`;for(const a of r.items){const size=a.size*195,x=a.x*9.6-size/2,y=a.y*6.3-size*.7;s+=`<g transform="translate(${x} ${y})">${a.flip?`<g transform="translate(${size} 0) scale(-1 1)">`:''}${pixelIcon(a.type,a.c).replace('<svg ',`<svg width="${size}" height="${size}" `)}${a.flip?'</g>':''}</g>`;}s+=portrait(p,photoExpr,true).replace('<svg ',`<svg x="${sceneX*9.6-125}" y="${sceneY*6.3-170}" width="250" height="250" `);if(state.buddy>=0)s+=portrait(state.pets[state.buddy],photoExpr,true).replace('<svg ','<svg x="540" y="310" width="220" height="220" ');s+=`<rect x="0" y="650" width="960" height="70" fill="${THEMES[r.theme][3]}"/><text x="36" y="694" fill="${THEMES[r.theme][5]}" font-family="sans-serif" font-size="24">${esc(p.name)} · ${day()}</text>`;}
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${transparent?'48 48':'960 720'}" shape-rendering="crispEdges">${s}</svg>`,url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{const image=new Image();await new Promise((res,rej)=>{image.onload=res;image.onerror=rej;image.src=url;});const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,w,h);const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));if(!blob)throw Error();download('말랑펫_'+day()+(transparent?'_투명':'_미니룸')+'.png',blob,'image/png');log(p.name+'의 기념사진을 찍었어요.');save();status('기념사진을 내려받았어요.');}catch{status('사진 저장에 실패했어요. 다시 눌러 주세요.');}finally{URL.revokeObjectURL(url);}}
 // Only newly added user messages after a real send action count. Never store text.
 const seen=new Set();let intent=0,bootUntil=Date.now()+3000,scanTimer,lastURL=location.href;
 const messageSelector='[data-message-group-id]';
 document.querySelectorAll(messageSelector).forEach(m=>seen.add(m.getAttribute('data-message-group-id')));
 document.addEventListener('keydown',e=>{if(e.composedPath().includes(host))return;const t=e.target;if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&(t?.tagName==='TEXTAREA'||t?.isContentEditable))intent=Date.now();},true);
 document.addEventListener('click',e=>{if(e.composedPath().includes(host))return;const b=e.target.closest?.('button');if(b&&document.querySelector('textarea,[contenteditable="true"]'))intent=Date.now();},true);
 function scan(){const now=Date.now(),all=[...document.querySelectorAll(messageSelector)];for(let i=0;i<all.length;i++){const m=all[i],mid=m.getAttribute('data-message-group-id');if(!mid||seen.has(mid))continue;const t=m.querySelector('.wrtn-markdown');if(!t||!t.textContent.trim())continue;seen.add(mid);if(now<bootUntil||now-intent>15000||i<all.length-3||!state.react)continue;if(m.querySelector('img[alt="model"]')||!t.parentElement?.classList.contains('rounded-lg')||t.parentElement.classList.contains('rounded-none'))continue;const str=t.textContent.replace(/\s/g,'');const p=pet();p.chats++;p.day.chats++;p.xp++;p.bond=clamp(p.bond+.2,0,1e9);if(!p.sleeping){const love=/사랑|좋아해|쓰다듬|안아|귀여|고마워/.test(str),sad=/ㅠㅠ|ㅜㅜ|슬퍼|힘들|울었/.test(str);if(!$('.app').hidden)say(love?line('pet'):sad?'괜찮아. 여기 같이 있을게.':line('idle'),love?'love':sad?'sad':'happy');else{expr=love?'love':'happy';exprUntil=now+3000;launcher.classList.add('hot');setTimeout(()=>launcher.classList.remove('hot'),1100);}}simulate();save();refreshActors();updateStats();}if(seen.size>2500){seen.clear();all.forEach(m=>seen.add(m.getAttribute('data-message-group-id')));}}
 const observer=new MutationObserver(()=>{clearTimeout(scanTimer);scanTimer=setTimeout(scan,400);});observer.observe(document.body,{childList:true,subtree:true});
 setInterval(()=>{if(location.href!==lastURL){lastURL=location.href;bootUntil=Date.now()+4000;intent=0;}if(!host.isConnected)document.body.appendChild(host);},1000);
 setInterval(()=>{if(document.hidden)return;simulate();sessionTicks++;if(pet().sleeping)pet().energy=clamp(pet().energy+2);save();refreshActors();updateStats();if($('.app').hidden||editRoom||view==='photo'||!['home','kitchen','room'].includes(view)||pet().sleeping)return;if(sessionTicks%3===0&&Date.now()>sayUntil){const items=state.room.items.filter(a=>!['window','frame','bed'].includes(a.type));if(items.length&&Math.random()>.4){const a=pick(items);sceneX=clamp(a.x,20,80);sceneY=clamp(a.y+5,55,84);}else{sceneX=25+Math.random()*45;sceneY=65+Math.random()*16;}say(line('idle'));}},10000);
 addEventListener('resize',positionFab);document.addEventListener('visibilitychange',()=>{if(!document.hidden){simulate();save();refreshActors();positionFab();}});
 if(typeof GM_registerMenuCommand==='function'){GM_registerMenuCommand('말랑펫 열기 / 다시 보이기',()=>{state.hidden=false;save();positionFab();open();});GM_registerMenuCommand('말랑펫 버튼 숨기기',()=>{state.hidden=true;save();positionFab();close();});GM_registerMenuCommand('말랑펫 위치 초기화',()=>{state.pos={x:.94,y:.65};state.hidden=false;save();positionFab();});}
 if(typeof GM_addValueChangeListener==='function')GM_addValueChangeListener(KEY,(_key,_old,value,remote)=>{if(!remote||dragging||painting)return;try{const next=typeof value==='string'?JSON.parse(value):value;if(!next||next.v!==3)return;state=normalize(next);const editing=root.activeElement?.matches('input,textarea,select');if(!$('.app').hidden&&!editing)render();else{positionFab();refreshActors();}}catch(e){console.warn('[말랑펫] 다른 탭의 기록을 읽지 못했어요.',e);}});
 simulate();save();theme();positionFab();refreshActors();
})();
