// ==UserScript==
// @name         크랙 말랑펫
// @namespace    https://github.com/mywishluv/wishlite
// @version      1.0.0
// @description  크랙 채팅 화면 구석에서 키우는 작은 펫. 밥 주고, 놀아주고, 재우고, 말 걸어 주세요.
// @author       muz
// @match        https://crack.wrtn.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @downloadURL  https://github.com/mywishluv/wishlite/raw/main/crack-mallang-pet.user.js
// @updateURL    https://github.com/mywishluv/wishlite/raw/main/crack-mallang-pet.user.js
// ==/UserScript==
// v1.0.0 - 첫 버전: 돌보기(밥·놀기·잠·약), 성장·진화, 방치하면 아프고 떠남, 이름·색·장식 꾸미기, 말 걸면 알아듣고 반응

(function () {
  'use strict';

  /* =========================================================
   * 설정 — 숫자만 바꿔도 난이도를 조절할 수 있어요
   * ========================================================= */
  const CONFIG = {
    hatchMinutes: 10,      // 알이 깨어나는 데 걸리는 시간(분)
    babyHours: 24,         // 이 시간이 지나면 아기 → 어린이
    childHours: 72,        // 이 시간이 지나면 어린이 → 어른
    perHourAwake: { hunger: -7, fun: -6, energy: -4 },  // 깨어 있을 때 1시간마다 변화
    perHourSleep: { hunger: -3, fun: -1, energy: 25 },  // 잘 때 1시간마다 변화
    healthDropPerLow: 2,   // 낮은 수치 하나당 1시간마다 건강 감소
    sickExtraDrop: 1,      // 아플 때 추가로 줄어드는 건강(1시간마다)
    healthRecover: 4,      // 잘 돌보면 1시간마다 회복되는 건강
    sickBelow: 40,         // 건강이 이 아래로 내려가면 아파요
    maxOfflineHours: 24 * 7,
    tickSeconds: 20,
  };
  const STORE_KEY = 'mallangpet_v1';

  // 이 스크립트는 크랙 화면 구조(클래스명)를 쓰지 않아요.
  // 화면 맨 위에 따로 떠 있는 버튼만 만들기 때문에 크랙이 바뀌어도 영향이 적어요.
  const MOUNT_TARGET = () => document.body;

  /* ===================== 저장 ===================== */
  const store = {
    get() {
      try {
        const raw = typeof GM_getValue === 'function' ? GM_getValue(STORE_KEY, null) : localStorage.getItem(STORE_KEY);
        return raw ? JSON.parse(raw) : null;
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

  const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hasBatchim = (s) => {
    const c = s.charCodeAt(s.length - 1);
    return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  };
  const josa = (s, a, b) => s + (hasBatchim(s) ? a : b);

  function newPet(keep) {
    const now = Date.now();
    return {
      v: 1,
      name: (keep && keep.name) || '말랑이',
      color: (keep && keep.color) || 'peach',
      acc: (keep && keep.acc) || 'none',
      hidden: (keep && keep.hidden) || false,
      pos: (keep && keep.pos) || null,
      born: now, last: now, stage: 'egg', form: null,
      hunger: 80, fun: 80, energy: 80, health: 100,
      sleeping: false, sick: false, gone: false,
      care: 0, careHours: 0,
    };
  }

  /* ===================== 시간 흐름 ===================== */
  const events = [];

  function updateStage(p, t) {
    const ageH = (t - p.born) / 3600000;
    const s = ageH < CONFIG.hatchMinutes / 60 ? 'egg'
      : ageH < CONFIG.babyHours ? 'baby'
      : ageH < CONFIG.childHours ? 'child' : 'adult';
    if (s !== p.stage) {
      p.stage = s;
      if (s === 'adult' && !p.form) {
        const avg = p.careHours ? p.care / p.careHours : 50;
        p.form = avg >= 70 ? 'shiny' : avg >= 45 ? 'normal' : 'naughty';
      }
      events.push({ type: 'grow', to: s });
    }
  }

  function simulate(p, now) {
    let remain = Math.min((now - p.last) / 3600000, CONFIG.maxOfflineHours);
    let t = now - remain * 3600000;
    p.last = now;
    if (p.gone || remain <= 0) { updateStage(p, now); return; }
    const STEP = 0.1; // 6분 단위로 계산
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

  /* ===================== 펫 그림 ===================== */
  const COLORS = {
    peach: { name: '복숭아', body: '#FFC8B4', dark: '#E89A82', cheek: '#FF8FA3' },
    mint: { name: '민트', body: '#BDEBD6', dark: '#7FC9A8', cheek: '#FF9EB1' },
    sky: { name: '하늘', body: '#C4DEFF', dark: '#8CB6EE', cheek: '#FF9EB1' },
    lemon: { name: '레몬', body: '#FFEBA8', dark: '#E2C25E', cheek: '#FF9E8F' },
    lilac: { name: '라일락', body: '#E2D2FF', dark: '#B49BEA', cheek: '#FF9EC4' },
    cocoa: { name: '코코아', body: '#E3C3A8', dark: '#B48C6C', cheek: '#FF9E9E' },
  };
  const ACCS = { none: '없음', ribbon: '리본', hat: '모자', flower: '꽃', glasses: '안경', crown: '왕관' };
  const INK = '#4A3A3A';

  function eggSVG(p, c) {
    const prog = clamp(((Date.now() - p.born) / (CONFIG.hatchMinutes * 60000)) * 100) / 100;
    let s = `<ellipse cx="60" cy="110" rx="22" ry="4" fill="rgba(0,0,0,.08)"/>`;
    s += `<path d="M60 38 C80 38 88 72 86 86 C84 102 72 108 60 108 C48 108 36 102 34 86 C32 72 40 38 60 38Z" fill="#FFF8EE" stroke="${c.dark}" stroke-width="2.5"/>`;
    s += `<circle cx="50" cy="68" r="6" fill="${c.body}"/><circle cx="70" cy="60" r="5" fill="${c.body}"/>`;
    s += `<circle cx="67" cy="90" r="7" fill="${c.body}"/><circle cx="47" cy="94" r="4" fill="${c.body}"/>`;
    if (prog > 0.5) s += `<path d="M42 76 L49 71 L54 77 L61 70 L66 76 L74 71" fill="none" stroke="${c.dark}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (prog > 0.85) s += `<path d="M56 52 L60 58 L57 63" fill="none" stroke="${c.dark}" stroke-width="2" stroke-linecap="round"/>`;
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
  }

  function petSVG(p, expr) {
    const c = COLORS[p.color] || COLORS.peach;
    if (p.gone) return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><text x="60" y="80" text-anchor="middle" font-size="44">🍃</text></svg>`;
    if (p.stage === 'egg') return eggSVG(p, c);

    const [rx, ry] = { baby: [27, 23], child: [33, 29], adult: [39, 34] }[p.stage];
    const cx = 60, cy = 108 - ry, top = cy - ry;
    const ex = rx * 0.38, ey = cy - ry * 0.12, my = ey + 10;
    const stroke = `stroke="${c.dark}" stroke-width="2.5"`;
    let s = `<ellipse cx="60" cy="110" rx="${rx * 0.8}" ry="4" fill="rgba(0,0,0,.08)"/>`;

    // 날개(반짝이 어른)
    if (p.stage === 'adult' && p.form === 'shiny') {
      s += `<ellipse cx="${cx - rx - 2}" cy="${cy - 6}" rx="12" ry="7" fill="#fff" ${stroke} transform="rotate(-25 ${cx - rx - 2} ${cy - 6})"/>`;
      s += `<ellipse cx="${cx + rx + 2}" cy="${cy - 6}" rx="12" ry="7" fill="#fff" ${stroke} transform="rotate(25 ${cx + rx + 2} ${cy - 6})"/>`;
    }
    // 귀
    if (p.stage !== 'baby') {
      if (p.form === 'naughty') {
        s += `<path d="M${cx - rx * 0.75} ${top + 10} L${cx - rx * 0.6} ${top - 10} L${cx - rx * 0.2} ${top + 4}Z" fill="${c.body}" ${stroke} stroke-linejoin="round"/>`;
        s += `<path d="M${cx + rx * 0.75} ${top + 10} L${cx + rx * 0.6} ${top - 10} L${cx + rx * 0.2} ${top + 4}Z" fill="${c.body}" ${stroke} stroke-linejoin="round"/>`;
      } else {
        s += `<ellipse cx="${cx - rx * 0.55}" cy="${top + 4}" rx="8" ry="10" fill="${c.body}" ${stroke}/>`;
        s += `<ellipse cx="${cx + rx * 0.55}" cy="${top + 4}" rx="8" ry="10" fill="${c.body}" ${stroke}/>`;
      }
    }
    // 발
    if (p.stage !== 'baby') {
      s += `<ellipse cx="${cx - rx * 0.45}" cy="106" rx="8" ry="4.5" fill="${c.dark}"/>`;
      s += `<ellipse cx="${cx + rx * 0.45}" cy="106" rx="8" ry="4.5" fill="${c.dark}"/>`;
    }
    // 몸
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c.body}" ${stroke}/>`;
    s += `<ellipse cx="${cx}" cy="${cy + ry * 0.38}" rx="${rx * 0.55}" ry="${ry * 0.42}" fill="rgba(255,255,255,.45)"/>`;
    if (expr === 'sick') s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 1}" ry="${ry - 1}" fill="rgba(110,190,120,.18)"/>`;
    // 아기 새싹 / 장난꾸러기 앞머리
    if (p.stage === 'baby') s += `<path d="M${cx} ${top + 1} Q${cx + 2} ${top - 10} ${cx + 10} ${top - 8}" fill="none" stroke="${c.dark}" stroke-width="2.5" stroke-linecap="round"/>`;
    if (p.form === 'naughty') s += `<path d="M${cx - 9} ${top + 3} L${cx - 4} ${top - 7} L${cx} ${top + 2} L${cx + 4} ${top - 8} L${cx + 9} ${top + 3}Z" fill="${c.dark}"/>`;

    // 볼
    s += `<ellipse cx="${cx - rx * 0.62}" cy="${ey + 7}" rx="5" ry="3" fill="${c.cheek}" opacity=".55"/>`;
    s += `<ellipse cx="${cx + rx * 0.62}" cy="${ey + 7}" rx="5" ry="3" fill="${c.cheek}" opacity=".55"/>`;

    // 눈
    const eye = (x) => {
      const y = ey;
      switch (expr) {
        case 'happy': return `<path d="M${x - 5} ${y + 2} Q${x} ${y - 5} ${x + 5} ${y + 2}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
        case 'sleep': return `<path d="M${x - 5} ${y} Q${x} ${y + 4} ${x + 5} ${y}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
        case 'love': return `<path transform="translate(${x} ${y})" d="M0 4.5 C-8 -1 -4.5 -7.5 0 -3 C4.5 -7.5 8 -1 0 4.5Z" fill="#FF5C8A"/>`;
        case 'sick': return `<path d="M${x - 4} ${y - 4} L${x + 4} ${y + 4} M${x + 4} ${y - 4} L${x - 4} ${y + 4}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
        default: return `<circle cx="${x}" cy="${y}" r="4.2" fill="${INK}"/><circle cx="${x + 1.4}" cy="${y - 1.5}" r="1.4" fill="#fff"/>`;
      }
    };
    const brow = (x) => {
      const sg = x < cx ? 1 : -1;
      if (expr === 'sad') return `<path d="M${x - 5 * sg} ${ey - 8} L${x + 4 * sg} ${ey - 11}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
      if (expr === 'angry') return `<path d="M${x - 5 * sg} ${ey - 11} L${x + 4 * sg} ${ey - 7}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
      return '';
    };
    s += eye(cx - ex) + eye(cx + ex) + brow(cx - ex) + brow(cx + ex);

    // 입
    if (expr === 'happy' || expr === 'love') s += `<path d="M${cx - 6} ${my - 1} Q${cx} ${my + 8} ${cx + 6} ${my - 1}Z" fill="#C0485A" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
    else if (expr === 'sad' || expr === 'sick') s += `<path d="M${cx - 5} ${my + 3} Q${cx} ${my - 3} ${cx + 5} ${my + 3}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
    else if (expr === 'angry') s += `<path d="M${cx - 5} ${my + 1} L${cx + 5} ${my + 1}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
    else if (expr === 'sleep') s += `<ellipse cx="${cx}" cy="${my + 1}" rx="2.5" ry="2" fill="${INK}"/>`;
    else s += `<path d="M${cx - 4} ${my} Q${cx} ${my + 4} ${cx + 4} ${my}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;

    if (expr === 'sad') s += `<path d="M${cx - ex - 1} ${ey + 5} q-3 5 0 7 q3 -2 0 -7z" fill="#7EC8FF"/>`;
    if (expr === 'sick') s += `<path d="M${cx + rx * 0.7} ${top + 8} q-3 5 0 7 q3 -2 0 -7z" fill="#7EC8FF"/>`;

    // 장식
    const a = p.acc;
    if (a === 'ribbon') {
      const x = cx + rx * 0.45, y = top + 5;
      s += `<path d="M${x} ${y} L${x - 9} ${y - 6} L${x - 9} ${y + 6}Z M${x} ${y} L${x + 9} ${y - 6} L${x + 9} ${y + 6}Z" fill="#FF6F91" stroke="#E0476E" stroke-width="1.2" stroke-linejoin="round"/><circle cx="${x}" cy="${y}" r="3" fill="#E0476E"/>`;
    } else if (a === 'hat') {
      s += `<rect x="${cx - 10}" y="${top - 15}" width="20" height="14" rx="2" fill="#4A4A5A"/><rect x="${cx - 10}" y="${top - 6}" width="20" height="3" fill="#FF6F91"/><rect x="${cx - 15}" y="${top - 3}" width="30" height="4" rx="2" fill="#4A4A5A"/>`;
    } else if (a === 'flower') {
      const x = cx - rx * 0.5, y = top + 5;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        s += `<circle cx="${(x + Math.cos(ang) * 4.5).toFixed(1)}" cy="${(y + Math.sin(ang) * 4.5).toFixed(1)}" r="3.6" fill="#FFB3C7"/>`;
      }
      s += `<circle cx="${x}" cy="${y}" r="2.8" fill="#FFD54A"/>`;
    } else if (a === 'glasses') {
      s += `<circle cx="${cx - ex}" cy="${ey}" r="7.5" fill="rgba(255,255,255,.25)" stroke="#3A3A3A" stroke-width="1.8"/><circle cx="${cx + ex}" cy="${ey}" r="7.5" fill="rgba(255,255,255,.25)" stroke="#3A3A3A" stroke-width="1.8"/><path d="M${cx - ex + 7.5} ${ey} L${cx + ex - 7.5} ${ey}" stroke="#3A3A3A" stroke-width="1.8"/>`;
    } else if (a === 'crown') {
      s += `<path d="M${cx - 11} ${top + 2} L${cx - 11} ${top - 9} L${cx - 5} ${top - 3} L${cx} ${top - 12} L${cx + 5} ${top - 3} L${cx + 11} ${top - 9} L${cx + 11} ${top + 2}Z" fill="#FFD54A" stroke="#E0A800" stroke-width="1.5" stroke-linejoin="round"/>`;
    }
    if (p.form === 'shiny') s += `<path transform="translate(${cx + rx - 2} ${top + 2})" d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5Z" fill="#FFD54A"/>`;

    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
  }

  /* ===================== 대사 ===================== */
  const WORDS = {
    love: ['사랑', '좋아', '귀여', '귀엽', '예뻐', '이뻐', '착해', '착하', '최고', '잘했', '고마', '보고싶', '쓰담', '기특', '멋져', '멋있', '짱', '♡', '❤'],
    bad: ['싫어', '바보', '미워', '못생', '짜증', '저리가', '꺼져', '멍청', '시끄러', '나빠', '실망', '귀찮'],
    hello: ['안녕', '하이', '반가', '왔어', '나왔', '다녀왔'],
    night: ['잘자', '굿나잇', '자자', '졸려', '자러'],
    food: ['밥', '배고', '먹자', '간식', '맛있'],
    play: ['놀자', '놀아', '심심', '산책'],
  };
  const LINES = {
    love: ['헤헤, 나도 좋아!', '부끄러워…♡', '기분 최고야!', '더 말해줘!'],
    bad: ['힝… 너무해', '나 미워…?', '훌쩍…', '…삐졌어'],
    angry: ['흥! 계속 그러면 진짜 삐질 거야', '그만해…!'],
    hello: ['왔구나! 보고 싶었어', '안녕안녕!', '반가워!'],
    night: ['나도 졸려… 재워줄래?', '잘 자! 좋은 꿈 꿔'],
    food: ['밥?! 밥 줘 밥!', '냠냠, 생각만 해도 좋아'],
    play: ['놀자 놀자!', '공놀이 할래?'],
    unknown: ['응? 무슨 말이야?', '…?', '(고개 갸웃)', '음… 잘 모르겠지만 좋아!'],
    name: ['내 이름 불렀다!'],
    sleepTalk: ['쿨… 쿨…', '음냐… 밥…', '(잠꼬대 중)'],
    hungry: ['배고파…', '꼬르륵…'],
    bored: ['심심해…', '놀아줘…'],
    sleepy: ['졸려…', '하암…'],
    sick: ['몸이 안 좋아…', '으슬으슬해…'],
    idle: ['오늘 어땠어?', '여기 있으면 좋아', '랄랄라~', '같이 있어서 좋다'],
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
  .fab{position:fixed;width:60px;height:60px;border-radius:30px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer}
  .fab-pet{width:52px;height:52px;pointer-events:none}
  .fab-pet svg{width:100%;height:100%;display:block}
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
  .pet{width:170px;height:170px;margin-bottom:4px;cursor:pointer}
  .pet svg{width:100%;height:100%;display:block}
  .bounce{animation:bounce 1.8s ease-in-out infinite;transform-origin:50% 100%}
  .breathe{animation:breathe 3.2s ease-in-out infinite;transform-origin:50% 100%}
  .wobble{animation:wobble 2.4s ease-in-out infinite;transform-origin:50% 90%}
  .jump{animation:jump .5s ease}
  @keyframes bounce{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-6px) scale(.98,1.02)}}
  @keyframes breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.03,.97)}}
  @keyframes wobble{0%,70%,100%{transform:rotate(0)}76%{transform:rotate(-7deg)}82%{transform:rotate(6deg)}88%{transform:rotate(-4deg)}94%{transform:rotate(2deg)}}
  @keyframes jump{0%{transform:translateY(0)}40%{transform:translateY(-22px) scale(.95,1.05)}70%{transform:translateY(0) scale(1.06,.94)}100%{transform:translateY(0)}}
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
  .actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
  .actions.c4{grid-template-columns:repeat(4,1fr)}
  .actions.c1{grid-template-columns:1fr}
  .act{height:66px;border:0;border-radius:16px;background:#fff;font-size:13px;color:#1C1C1E;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;transition:transform .1s}
  .act b{font-size:23px;line-height:1}
  .act:active{transform:scale(.95);background:#E5E5EA}
  .act.med{background:#FFF1F0}
  .talk{display:flex;gap:8px;margin-top:12px}
  .talk input{flex:1;min-width:0;height:46px;border-radius:23px;border:0;background:#fff;padding:0 16px;font-size:16px;color:#1C1C1E;outline:none}
  .send{height:46px;padding:0 18px;border-radius:23px;border:0;background:#007AFF;color:#fff;font-size:15px;font-weight:600;flex:none}
  .send:active{opacity:.7}
  .gone{background:#fff;border-radius:16px;padding:18px;margin-top:12px;text-align:center;font-size:15px;line-height:1.6;color:#3A3A3C}
  .wide{width:100%;height:50px;border:0;border-radius:14px;background:#fff;font-size:16px;font-weight:600;color:#007AFF;margin-top:10px}
  .wide.primary{background:#007AFF;color:#fff}
  .wide.danger{color:#FF3B30;font-weight:500}
  .card{background:#fff;border-radius:16px;padding:14px;margin-top:12px}
  .lbl{font-size:13px;color:#8E8E93;margin-bottom:10px}
  .card input{width:100%;height:44px;border-radius:12px;border:0;background:#F2F2F7;padding:0 14px;font-size:16px;color:#1C1C1E;outline:none}
  .preview{height:130px;display:flex;justify-content:center;align-items:flex-end;background:linear-gradient(#FFF8F2,#FFE6D8);border-radius:18px}
  .preview div{width:120px;height:120px}
  .preview svg{width:100%;height:100%;display:block}
  .swatches{display:flex;gap:12px;flex-wrap:wrap}
  .sw{width:42px;height:42px;border-radius:21px;border:3px solid #fff;box-shadow:0 0 0 1px #E5E5EA}
  .sw.on{box-shadow:0 0 0 3px #007AFF}
  .chips{display:flex;gap:8px;flex-wrap:wrap}
  .chip{height:38px;padding:0 15px;border-radius:19px;border:0;background:#F2F2F7;font-size:14px;color:#1C1C1E}
  .chip.on{background:#007AFF;color:#fff}
  .foot{font-size:12px;color:#8E8E93;text-align:center;margin-top:14px}
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
      <div class="talk"><input type="text" maxlength="60" placeholder="말 걸기 (예: 사랑해, 잘 자)" enterkeyhint="send"><button class="send">보내기</button></div>
      <div class="gone" hidden></div>
    </div>
    <div class="v-deco" hidden>
      <div class="preview"><div></div></div>
      <div class="card"><div class="lbl">이름</div><input class="name-in" type="text" maxlength="10" placeholder="말랑이"></div>
      <div class="card"><div class="lbl">색깔</div><div class="swatches"></div></div>
      <div class="card"><div class="lbl">장식</div><div class="chips"></div></div>
      <button class="wide primary" data-k="done">완료</button>
      <button class="wide danger" data-k="reset">새 알로 다시 시작</button>
      <p class="foot">펫 정보는 이 브라우저에만 저장돼요</p>
    </div>
  </div>
  <div class="fab" aria-label="말랑펫 열기"><div class="dot"></div><div class="fab-pet"></div></div>
  `;

  /* ===================== 상태 ===================== */
  let p = store.get() || newPet();
  let tempExpr = null, tempUntil = 0, lastSay = 0, badStreak = 0, lastPet = 0;
  let resetArmed = 0;

  function load() { const s = store.get(); if (s) p = s; simulate(p, Date.now()); }
  function save() { store.set(p); }

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
  const wrap = $('.wrap'), fab = $('.fab'), fabPet = $('.fab-pet'), sheet = $('.sheet');
  const petEl = $('.pet'), stage = $('.stage'), bubble = $('.bubble'), actionsEl = $('.actions');
  const input = $('.talk input'), goneEl = $('.gone');
  const vMain = $('.v-main'), vDeco = $('.v-deco');

  function mount() {
    const target = MOUNT_TARGET();
    if (!target) return false;
    if (!host.isConnected) target.appendChild(host);
    return true;
  }

  // 크랙 단축키가 입력을 가로채지 않도록
  root.querySelectorAll('input').forEach((el) => {
    ['keydown', 'keyup', 'keypress'].forEach((t) => el.addEventListener(t, (e) => e.stopPropagation()));
  });

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
  const endDrag = () => {
    if (!drag) return;
    if (drag.moved) {
      const s = store.get(); if (s) p = s;
      p.pos = {
        x: (fab.offsetLeft - 8) / Math.max(1, window.innerWidth - 76),
        y: (fab.offsetTop - 8) / Math.max(1, window.innerHeight - 76),
      };
      save();
    } else openSheet();
    drag = null;
  };
  fab.addEventListener('pointerup', endDrag);
  fab.addEventListener('pointercancel', () => { drag = null; });
  window.addEventListener('resize', placeFab);

  /* ---------- 시트 열고 닫기 ---------- */
  function openSheet() { load(); flushEvents(); save(); showView('main'); wrap.classList.add('open'); render(); greet(); }
  function closeSheet() { wrap.classList.remove('open'); input.blur(); }
  $('.bg').addEventListener('click', closeSheet);

  function showView(v) {
    vMain.hidden = v !== 'main';
    vDeco.hidden = v !== 'deco';
    resetArmed = 0;
    $('[data-k="reset"]').textContent = '새 알로 다시 시작';
    if (v === 'deco') buildDeco();
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
          const m = { shiny: '반짝반짝! 잘 돌봐줘서 반짝이가 됐어 ✨', normal: '짠! 어른이 됐어!', naughty: '흥, 장난꾸러기로 컸지롱 😝' };
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

  /* ---------- 말 걸기 ---------- */
  function talk(raw) {
    const text = (raw || '').trim();
    if (!text) return;
    load(); flushEvents();
    if (p.gone) return;
    if (p.stage === 'egg') { say('(알이 살짝 흔들렸어요)'); jump(); return; }
    if (p.sleeping) { say(pick(LINES.sleepTalk)); return; }

    const t = text.replace(/\s+/g, '');
    const has = (k) => WORDS[k].some((w) => t.includes(w));
    const neg = /(안|못)(좋|예뻐|이뻐|귀여|귀엽|착해)|별로/.test(t);
    const isBad = has('bad') || neg;
    const isLove = has('love') && !neg;
    const calledName = p.name && t.includes(p.name.replace(/\s+/g, ''));
    let reply;

    if (isBad && !isLove) {
      badStreak++;
      p.fun = clamp(p.fun - 12);
      if (badStreak >= 3) { reply = pick(LINES.angry); setExpr('angry', 3500); }
      else { reply = pick(LINES.bad); setExpr('sad', 3500); }
    } else if (isLove) {
      badStreak = 0; p.fun = clamp(p.fun + 10);
      reply = pick(LINES.love); setExpr('love', 3000); fx('💗'); jump();
    } else if (has('hello')) {
      p.fun = clamp(p.fun + 5); reply = pick(LINES.hello); setExpr('happy'); jump();
    } else if (has('night')) {
      reply = pick(LINES.night); setExpr('sleep', 2000);
    } else if (has('food')) {
      reply = pick(LINES.food); setExpr('happy');
    } else if (has('play')) {
      reply = pick(LINES.play); setExpr('happy'); jump();
    } else {
      p.fun = clamp(p.fun + 2); reply = pick(LINES.unknown);
    }
    if (calledName && !(isBad && !isLove)) reply = pick(LINES.name) + ' ' + reply;
    say(reply);
    save(); render();
  }
  const sendTalk = () => { talk(input.value); input.value = ''; };
  $('.send').addEventListener('click', sendTalk);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendTalk(); } });

  /* ---------- 꾸미기 ---------- */
  function buildDeco() {
    const nameIn = $('.name-in');
    nameIn.value = p.name;
    nameIn.oninput = () => {
      load(); p.name = nameIn.value.trim() || '말랑이'; save(); renderHeader(); renderPreview();
    };
    const sw = $('.swatches'); sw.innerHTML = '';
    Object.entries(COLORS).forEach(([k, c]) => {
      const b = document.createElement('button');
      b.className = 'sw' + (p.color === k ? ' on' : '');
      b.style.background = c.body; b.setAttribute('aria-label', c.name);
      b.onclick = () => { load(); p.color = k; save(); buildDeco(); render(); };
      sw.appendChild(b);
    });
    const ch = $('.chips'); ch.innerHTML = '';
    Object.entries(ACCS).forEach(([k, label]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (p.acc === k ? ' on' : '');
      b.textContent = label;
      b.onclick = () => { load(); p.acc = k; save(); buildDeco(); render(); };
      ch.appendChild(b);
    });
    renderPreview();
  }
  function renderPreview() {
    const show = Object.assign({}, p, p.stage === 'egg' || p.gone ? { stage: 'child', gone: false } : {});
    $('.preview div').innerHTML = petSVG(show, 'happy');
  }

  /* ---------- 그리기 ---------- */
  const STAGE_NAME = { egg: '알', baby: '아기', child: '어린이', adult: '어른' };
  const FORM_NAME = { shiny: '반짝이', normal: '어른', naughty: '장난꾸러기' };

  function renderHeader() {
    $('.name').textContent = p.name;
    const ageH = (Date.now() - p.born) / 3600000;
    let sub;
    if (p.gone) sub = '떠났어요';
    else if (p.stage === 'egg') sub = `알 · ${Math.max(1, Math.ceil(CONFIG.hatchMinutes - ageH * 60))}분 뒤 깨어나요`;
    else {
      const st = p.stage === 'adult' ? FORM_NAME[p.form] || '어른' : STAGE_NAME[p.stage];
      sub = `${st} · ${Math.floor(ageH / 24) + 1}일째` + (p.sleeping ? ' · 자는 중' : p.sick ? ' · 아파요' : '');
    }
    $('.sub').textContent = sub;
  }

  let lastPetHTML = '', lastFabHTML = '';
  function render() {
    renderHeader();
    const expr = curExpr();
    const html = petSVG(p, expr);
    if (html !== lastPetHTML) { petEl.innerHTML = html; lastPetHTML = html; }
    const anim = p.gone ? '' : p.stage === 'egg' ? 'wobble' : p.sleeping ? 'breathe' : 'bounce';
    petEl.firstElementChild && (petEl.firstElementChild.className.baseVal = anim);
    stage.classList.toggle('night', !!p.sleeping);

    ['hunger', 'fun', 'energy', 'health'].forEach((k) => {
      const v = Math.round(p[k]);
      root.querySelector(`[data-b="${k}"]`).style.width = v + '%';
      root.querySelector(`[data-n="${k}"]`).textContent = p.stage === 'egg' ? '-' : v;
    });

    // 버튼
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
    actionsEl.hidden = p.gone;
    $('.talk').hidden = p.gone;
    $('.stats').hidden = p.gone;
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

    // 떠 있는 버튼
    const fh = petSVG(p, expr);
    if (fh !== lastFabHTML) { fabPet.innerHTML = fh; lastFabHTML = fh; }
    const alert = !p.gone && p.stage !== 'egg' && !p.sleeping && (p.sick || p.hunger < 30 || p.fun < 30 || p.energy < 20);
    fab.classList.toggle('alert', alert || p.gone);
    fab.hidden = !!p.hidden;
  }

  /* ---------- 시간 흐르기 ---------- */
  function tick() {
    if (!mount()) return;
    load();
    const open = wrap.classList.contains('open');
    if (open) flushEvents();
    save(); render();
    if (open && !vMain.hidden && Date.now() - lastSay > 25000 && !p.gone && p.stage !== 'egg') {
      say(p.sleeping ? pick(LINES.sleepTalk) : needLine() || pick(LINES.idle));
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  /* ---------- 탬퍼몽키 메뉴 ---------- */
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('말랑펫 버튼 보이기/숨기기', () => {
      load(); p.hidden = !p.hidden; save(); render();
    });
    GM_registerMenuCommand('말랑펫 버튼 위치 초기화', () => {
      load(); p.pos = null; p.hidden = false; save(); placeFab(); render();
    });
  }

  /* ---------- 시작 ---------- */
  function start() {
    if (!mount()) {
      console.warn('[크랙 말랑펫] 화면을 아직 못 찾았어요. 잠시 후 다시 시도할게요.');
      return setTimeout(start, 1000);
    }
    simulate(p, Date.now());
    events.length = 0; // 시작할 때 밀린 알림은 열었을 때 상태로 보여줘요
    save(); placeFab(); render();
    setInterval(tick, CONFIG.tickSeconds * 1000);
    setInterval(() => { if (!host.isConnected) mount(); }, 3000); // 페이지가 바뀌어도 다시 붙이기
  }
  start();
})();
