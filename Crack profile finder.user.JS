// ==UserScript==
// @name         크랙 대화 프로필 찾기
// @namespace    https://github.com/mywishluv
// @version      1.4.1
// @description  크랙 '대화 프로필' 창에 검색 · 이름 칩 · 색 부제목 · 즐겨찾기 · 2열/4열 보기를 추가합니다
// @author       muz
// @match        https://crack.wrtn.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const HEADER_TEXT = '대화 프로필';
  const PANEL_ID = 'kpf-panel';
  const MODE_KEY = 'kpf-mode';
  const LABEL_KEY = 'kpf-labels';
  const FAV_KEY = 'kpf-favs';
  const COLORS = ['#ff5c8a', '#ff9f43', '#f7c948', '#2ecc71', '#3b9cff', '#9b6bff', '#8a8a8a'];
  const MODES = [
    { id: 'list', name: '기본' },
    { id: 'fold', name: '접기' },
    { id: 'g2', name: '2열' },
    { id: 'g4', name: '4열' },
  ];

  /* ---------- 스타일 ---------- */
  const style = document.createElement('style');
  style.textContent = `
    /* ── 패널 ── */
    #${PANEL_ID}{padding:0 20px 10px;box-sizing:border-box;width:100%;max-width:100%;min-width:0;
      font-family:inherit;color:#1a1a1a}
    #${PANEL_ID} .kpf-row{display:flex;gap:8px;align-items:center;min-width:0}
    #${PANEL_ID} .kpf-search{position:relative;flex:1;min-width:0}
    #${PANEL_ID} .kpf-search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#a0a0a0;pointer-events:none}
    #${PANEL_ID} input{width:100%;box-sizing:border-box;height:34px;border:none;border-radius:10px;
      padding:0 10px 0 32px;font-size:14px;outline:none;background:#f3f3f4;color:#1a1a1a;-webkit-appearance:none}
    #${PANEL_ID} input::placeholder{color:#a0a0a0}
    #${PANEL_ID} input:focus{background:#ececee}

    /* 보기 전환: 회색 트랙 + 흰 선택 */
    #${PANEL_ID} .kpf-seg{display:flex;flex:none;background:#f3f3f4;border-radius:10px;padding:3px;gap:2px}
    #${PANEL_ID} .kpf-seg button{height:28px;padding:0 9px;border:none;border-radius:8px;background:none;
      color:#8a8a8e;font-size:12px;font-weight:600;transition:all .15s}
    #${PANEL_ID} .kpf-seg button.on{background:#fff;color:#1a1a1a;box-shadow:0 1px 3px rgba(0,0,0,.12)}

    /* 칩 줄 */
    #${PANEL_ID} .kpf-chips{display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;margin-top:8px;
      width:100%;min-width:0;touch-action:pan-x;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;
      scrollbar-width:none}
    #${PANEL_ID} .kpf-chips::-webkit-scrollbar{display:none}
    #${PANEL_ID} .kpf-chip{flex:none;display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px;
      border-radius:999px;background:#fff;color:#3a3a3c;border:1px solid #e3e3e6;font-size:12px;font-weight:500;
      max-width:160px;white-space:nowrap}
    #${PANEL_ID} .kpf-chip span{overflow:hidden;text-overflow:ellipsis}
    #${PANEL_ID} .kpf-chip.cur{background:#1a1a1a;color:#fff;border-color:#1a1a1a}
    #${PANEL_ID} .kpf-chip i{flex:none;width:7px;height:7px;border-radius:50%;background:var(--kpf-c)}
    #${PANEL_ID} .kpf-chip svg{flex:none;color:#f5b400}
    #${PANEL_ID} .kpf-empty{font-size:12px;color:#a0a0a0;padding:6px 2px 0}
    body[data-kpf-mode="g4"] #${PANEL_ID} .kpf-chips{display:none}

    /* ── 카드 안 버튼 ── */
    .kpf-ico{flex:none;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;
      border:none;background:none;padding:0;color:#b8b8bc;border-radius:8px}
    .kpf-ico:active{background:rgba(0,0,0,.06)}
    .kpf-favbtn.on{color:#f5b400}
    .kpf-favbtn.on svg{fill:currentColor}
    .kpf-sub{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#6e6e73;line-height:1.3;
      word-break:break-all}
    .kpf-sub:empty{display:none}
    .kpf-colored .kpf-sub{color:var(--kpf-c)}
    .kpf-colored .kpf-sub::before{content:'';flex:none;width:7px;height:7px;border-radius:50%;background:var(--kpf-c)}

    /* ── 부제목 편집 창 ── */
    .kpf-modal{position:absolute;inset:0;z-index:100;background:rgba(0,0,0,.28);display:flex;
      align-items:flex-end;justify-content:center;padding:12px;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
    .kpf-box{background:#fff;border-radius:18px;padding:18px;width:100%;max-width:420px;box-sizing:border-box;
      box-shadow:0 10px 30px rgba(0,0,0,.15)}
    .kpf-box h3{margin:0 0 12px;font-size:15px;font-weight:700;color:#1a1a1a}
    .kpf-box h3 small{display:block;margin-top:3px;font-size:12px;font-weight:400;color:#8a8a8e}
    .kpf-box input{width:100%;box-sizing:border-box;height:40px;border:none;border-radius:10px;background:#f3f3f4;
      padding:0 12px;font-size:15px;outline:none;color:#1a1a1a}
    .kpf-sw{display:flex;gap:10px;margin:14px 0 16px;flex-wrap:wrap}
    .kpf-sw button{width:26px;height:26px;border-radius:50%;border:none;padding:0;position:relative}
    .kpf-sw button.none{background:#fff;box-shadow:inset 0 0 0 1.5px #d8d8dc}
    .kpf-sw button.none::after{content:'';position:absolute;left:50%;top:4px;bottom:4px;width:1.5px;
      background:#d8d8dc;transform:rotate(45deg)}
    .kpf-sw button.on{box-shadow:0 0 0 2px #fff,0 0 0 4px #1a1a1a}
    .kpf-sw button.none.on{box-shadow:inset 0 0 0 1.5px #d8d8dc,0 0 0 2px #fff,0 0 0 4px #1a1a1a}
    .kpf-acts{display:flex;gap:8px}
    .kpf-acts button{flex:1;height:42px;border:none;border-radius:12px;font-size:14px;font-weight:600}
    .kpf-acts .del{flex:none;padding:0 14px;background:none;color:#e5484d}
    .kpf-acts .cancel{background:#f3f3f4;color:#3a3a3c}
    .kpf-acts .ok{background:#1a1a1a;color:#fff}

    /* 프로필 추가 버튼 맨 위로 (DOM은 그대로, 보이는 순서만) */
    .kpf-addbtn{order:-1!important;margin:0 0 10px!important}

    .kpf-hidden{display:none!important}
    .kpf-flash{box-shadow:0 0 0 2px #1a1a1a!important;border-radius:12px;transition:box-shadow .3s}

    /* 시트 키우기 */
    .kpf-scroller{height:auto!important;max-height:42vh!important}
    /* 접기: 설명 1줄 */
    body[data-kpf-mode="fold"] .kpf-list > * > p{display:-webkit-box!important;-webkit-line-clamp:1;
      -webkit-box-orient:vertical;overflow:hidden!important;white-space:normal!important}
    body[data-kpf-mode="fold"] .kpf-list > *{padding-top:10px!important;padding-bottom:10px!important}
    body[data-kpf-mode="fold"] .kpf-list{gap:8px!important}
    /* 2열: 설명 3줄 */
    body[data-kpf-mode="g2"] .kpf-list{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px!important}
    body[data-kpf-mode="g2"] .kpf-list > *{padding:10px!important;min-width:0}
    body[data-kpf-mode="g2"] .kpf-list > * > p{display:-webkit-box!important;-webkit-line-clamp:3;
      -webkit-box-orient:vertical;overflow:hidden!important;white-space:normal!important;
      font-size:12px!important;line-height:1.35!important}
    /* 4열: 이름 + 부제목만 */
    body[data-kpf-mode="g4"] .kpf-list{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px!important}
    body[data-kpf-mode="g4"] .kpf-list > *{padding:8px 6px!important;min-width:0;gap:4px!important}
    body[data-kpf-mode="g4"] .kpf-list > * > p{display:none!important}
    body[data-kpf-mode="g4"] .kpf-list > * > div:first-child{flex-wrap:wrap;row-gap:4px}
    body[data-kpf-mode="g4"] .kpf-list > * > div:first-child > div{min-width:0;flex-wrap:wrap}
    body[data-kpf-mode="g4"] .kpf-list [class*="semibold"]{font-size:13px!important;overflow:hidden;
      text-overflow:ellipsis;white-space:nowrap}
    body[data-kpf-mode="g4"] .kpf-list .kpf-sub{font-size:11px}

  `;
  document.head.appendChild(style);

  const ICON = {
    search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    star: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z"/></svg>',
    starSm: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z"/></svg>',
    tag: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3.5 12.2V4.5a1 1 0 011-1h7.7l8.3 8.3a1 1 0 010 1.4l-7.3 7.3a1 1 0 01-1.4 0z"/><circle cx="8" cy="8" r="1.4"/></svg>',
  };

  /* ---------- 저장 ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  let labels = store.get(LABEL_KEY, {});
  let favs = store.get(FAV_KEY, {});
  // 예전 버전은 부제목이 문자열이었음 → {t, c}로 통일
  function getLabel(key) {
    const v = labels[key];
    if (!v) return { t: '', c: '' };
    return typeof v === 'string' ? { t: v, c: '' } : { t: v.t || '', c: v.c || '' };
  }
  function rank(c) { return c.current ? 0 : favs[c.key] ? 1 : 2; }
  let mode = store.get(MODE_KEY, 'fold');

  function hash(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /* ---------- 찾기 ---------- */
  function findDialog() {
    for (const h of document.querySelectorAll('[role=dialog] h2, [aria-modal=true] h2')) {
      if (h.textContent.trim() === HEADER_TEXT) return h.closest('[role=dialog], [aria-modal=true]');
    }
    return null;
  }

  function findScroller(dialog) {
    for (const el of dialog.querySelectorAll('div')) {
      if (el.closest('#' + PANEL_ID)) continue;
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
    }
    return null;
  }

  // 카드 = 이름(semibold span) + ... 버튼이 든 블록. 그 부모가 목록
  function findList(scroller) {
    const name = scroller.querySelector('span[class*="semibold"]');
    if (!name) return null;
    let card = name;
    while (card.parentElement && card.parentElement !== scroller) {
      const p = card.parentElement;
      const sameKids = [...p.children].filter(c => c.querySelector && c.querySelector('span[class*="semibold"]'));
      if (sameKids.length >= 2) return p;
      card = p;
    }
    return card.parentElement;
  }

  function info(card) {
    const nameEl = card.querySelector('span[class*="semibold"]');
    const descEl = card.querySelector(':scope > p');
    const name = nameEl ? nameEl.textContent.trim() : '';
    const desc = descEl ? descEl.textContent.trim() : '';
    const current = !!card.querySelector('[class*="ivory"]');
    return { nameEl, name, desc, current };
  }

  /* ---------- 상태 ---------- */
  let st = null; // { dialog, scroller, list, panel, cards:[{el,key,name,desc,current}] }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="kpf-row">
        <label class="kpf-search">${ICON.search}<input type="search" placeholder="검색" autocomplete="off"></label>
        <div class="kpf-seg">${MODES.map(m => `<button data-mode="${m.id}">${m.name}</button>`).join('')}</div>
      </div>
      <div class="kpf-chips" data-vaul-no-drag></div>`;
    panel.querySelector('input').addEventListener('input', applyFilter);
    panel.querySelectorAll('.kpf-seg button').forEach(b => b.addEventListener('click', () => {
      mode = b.dataset.mode;
      store.set(MODE_KEY, mode);
      applyMode();
    }));
    panel.setAttribute('data-vaul-no-drag', '');
    // 시트가 터치를 가로채서 칩 줄이 옆으로 안 밀리던 문제 → 패널 안 터치는 시트로 안 보냄
    ['click', 'touchstart', 'touchmove', 'mousedown', 'pointerdown', 'pointermove', 'wheel']
      .forEach(ev => panel.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    return panel;
  }

  function makeBtn(cls, text, title, onTap) {
    const btn = document.createElement('button');
    btn.className = 'kpf-ico ' + cls;
    btn.innerHTML = text;
    btn.title = title;
    ['touchstart', 'mousedown', 'pointerdown'].forEach(ev => btn.addEventListener(ev, e => e.stopPropagation()));
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); onTap(); });
    return btn;
  }

  // 카드마다 부제목 줄 + ☆ + 🏷 버튼, 색, 순서
  function decorate(c) {
    const card = c.el;
    const row = card.firstElementChild;
    let sub = card.querySelector(':scope > .kpf-sub');
    if (!sub) {
      sub = document.createElement('div');
      sub.className = 'kpf-sub';
      row ? row.after(sub) : card.prepend(sub);
    }
    const { t, c: color } = getLabel(c.key);
    if (sub.textContent !== t) sub.textContent = t;

    if (color) {
      if (card.style.getPropertyValue('--kpf-c') !== color) card.style.setProperty('--kpf-c', color);
      if (!card.classList.contains('kpf-colored')) card.classList.add('kpf-colored');
    } else if (card.classList.contains('kpf-colored')) {
      card.classList.remove('kpf-colored');
      card.style.removeProperty('--kpf-c');
    }

    const order = String(rank(c) - 2); // 현재 -2, 즐겨찾기 -1, 나머지 0
    if (card.style.order !== order) card.style.order = order;

    if (row && !card.querySelector('.kpf-tagbtn')) {
      const more = row.querySelector(':scope > button:not(.kpf-tagbtn):not(.kpf-favbtn)');
      const fav = makeBtn('kpf-favbtn', ICON.star, '즐겨찾기', () => toggleFav(card));
      const tag = makeBtn('kpf-tagbtn', ICON.tag, '부제목 달기', () => editLabel(card));
      if (more) { more.before(fav); more.before(tag); } else { row.append(fav, tag); }
    }
    const fb = card.querySelector('.kpf-favbtn');
    if (fb) {
      const on = !!favs[c.key];
      if (fb.classList.contains('on') !== on) fb.classList.toggle('on', on);
    }
  }

  function toggleFav(card) {
    const c = st && st.cards.find(x => x.el === card);
    if (!c) return;
    if (favs[c.key]) delete favs[c.key]; else favs[c.key] = 1;
    store.set(FAV_KEY, favs);
    decorate(c);
    renderChips();
  }

  function editLabel(card) {
    const c = st && st.cards.find(x => x.el === card);
    if (!c) return;
    const cur = getLabel(c.key);
    let pick = cur.c;

    const modal = document.createElement('div');
    modal.className = 'kpf-modal';
    modal.innerHTML = `
      <div class="kpf-box">
        <h3>부제목<small>${c.name.replace(/[<>&"]/g, '')} · ${c.desc.replace(/[<>&"]/g, '').replace(/\s+/g, ' ').slice(0, 24)}</small></h3>
        <input type="text" maxlength="30" placeholder="예: 수인 버전, 신경구속">
        <div class="kpf-sw">
          <button class="none" data-c=""></button>
          ${COLORS.map(col => `<button data-c="${col}" style="background:${col}"></button>`).join('')}
        </div>
        <div class="kpf-acts">
          <button class="del">삭제</button><button class="cancel">취소</button><button class="ok">저장</button>
        </div>
      </div>`;
    const input = modal.querySelector('input');
    input.value = cur.t;
    const paint = () => modal.querySelectorAll('.kpf-sw button').forEach(b => b.classList.toggle('on', b.dataset.c === pick));
    paint();
    modal.querySelectorAll('.kpf-sw button').forEach(b => b.addEventListener('click', () => { pick = b.dataset.c; paint(); }));
    const close = () => modal.remove();
    const save = (t, col) => {
      if (t || col) labels[c.key] = { t, c: col }; else delete labels[c.key];
      store.set(LABEL_KEY, labels);
      decorate(c); renderChips(); close();
    };
    modal.querySelector('.ok').addEventListener('click', () => save(input.value.trim(), pick));
    modal.querySelector('.del').addEventListener('click', () => save('', ''));
    modal.querySelector('.cancel').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') save(input.value.trim(), pick); });
    modal.setAttribute('data-vaul-no-drag', '');
    ['click', 'touchstart', 'touchmove', 'mousedown', 'pointerdown', 'pointermove', 'keydown'].forEach(ev => modal.addEventListener(ev, e => e.stopPropagation()));
    st.dialog.appendChild(modal); // 시트 안에 띄워야 입력이 막히지 않음
    setTimeout(() => input.focus(), 50);
  }

  function chipText(c) {
    const label = getLabel(c.key).t;
    if (label) return label;
    const snip = c.desc.replace(/\s+/g, ' ').slice(0, 8);
    return snip ? `${c.name}·${snip}` : c.name;
  }

  function matches(c, q) {
    if (!q) return true;
    return (c.name + ' ' + getLabel(c.key).t + ' ' + c.el.textContent).toLowerCase().includes(q);
  }

  function renderChips() {
    const box = st.panel.querySelector('.kpf-chips');
    box.innerHTML = '';
    if (!st.cards.length) {
      box.innerHTML = '<div class="kpf-empty">프로필 카드를 찾지 못했어요.</div>';
      return;
    }
    const q = st.panel.querySelector('input').value.trim().toLowerCase();
    const sorted = st.cards.map((c, i) => [c, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(x => x[0]);
    sorted.forEach(c => {
      if (!matches(c, q)) return;
      const b = document.createElement('button');
      b.className = 'kpf-chip' + (c.current ? ' cur' : '');
      const col = getLabel(c.key).c;
      if (col) { b.style.setProperty('--kpf-c', col); b.appendChild(document.createElement('i')); }
      else if (favs[c.key] && !c.current) b.insertAdjacentHTML('beforeend', ICON.starSm);
      const t = document.createElement('span');
      t.textContent = (c.current ? '현재 · ' : '') + chipText(c);
      b.appendChild(t);
      b.addEventListener('click', () => jumpTo(c.el));
      box.appendChild(b);
    });
  }

  function jumpTo(card) {
    const sc = st.scroller;
    const top = card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 8;
    sc.scrollTo({ top, behavior: 'smooth' });
    card.classList.add('kpf-flash');
    setTimeout(() => card.classList.remove('kpf-flash'), 1200);
  }

  function applyFilter() {
    if (!st) return;
    const q = st.panel.querySelector('input').value.trim().toLowerCase();
    st.cards.forEach(c => c.el.classList.toggle('kpf-hidden', !matches(c, q)));
    renderChips();
  }

  function applyMode() {
    if (!st) return;
    if (document.body.dataset.kpfMode !== mode) document.body.dataset.kpfMode = mode;
    if (st.list && !st.list.classList.contains('kpf-list')) st.list.classList.add('kpf-list');
    if (!st.scroller.classList.contains('kpf-scroller')) st.scroller.classList.add('kpf-scroller');
    st.panel.querySelectorAll('.kpf-seg button').forEach(b => {
      const on = b.dataset.mode === mode;
      if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
    });
  }

  /* ---------- 감지 루프 ---------- */
  function sync() {
    const dialog = findDialog();
    if (!dialog) { st = null; delete document.body.dataset.kpfMode; return; }

    if (!st || st.dialog !== dialog || !dialog.contains(st.panel)) {
      const scroller = findScroller(dialog);
      if (!scroller) return;
      dialog.querySelector('#' + PANEL_ID)?.remove();
      const panel = buildPanel();
      scroller.before(panel); // 스크롤 영역 바깥 위쪽에 고정
      st = { dialog, scroller, panel, list: null, cards: [], sig: '' };
    }

    const list = findList(st.scroller);
    const els = list ? [...list.children].filter(el => el.querySelector('span[class*="semibold"]')) : [];
    const seen = {};
    const cards = els.map(el => {
      const i = info(el);
      const h = hash(i.name + '\n' + i.desc);
      seen[h] = (seen[h] || 0) + 1;
      return { el, key: h + '#' + seen[h], ...i };
    });
    const sig = cards.map(c => c.key + (c.current ? '*' : '')).join('|');

    cards.forEach(decorate);
    for (const b of st.scroller.querySelectorAll('button:not(.kpf-ico)')) {
      if (b.textContent.trim() === '프로필 추가') {
        if (!b.classList.contains('kpf-addbtn')) b.classList.add('kpf-addbtn');
        break;
      }
    }
    if (sig !== st.sig || list !== st.list) {
      if (st.list && st.list !== list) st.list.classList.remove('kpf-list');
      st.list = list;
      st.cards = cards;
      st.sig = sig;
      applyFilter();
    }
    applyMode();
  }

  let timer = null;
  new MutationObserver(muts => {
    if (muts.every(m => {
      const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      return t && t.closest && t.closest('#' + PANEL_ID + ', .kpf-sub, .kpf-modal');
    })) return;
    clearTimeout(timer);
    timer = setTimeout(sync, 250);
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });

  sync();
})();
