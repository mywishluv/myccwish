// ==UserScript==
// @name         크랙 대화 북마크
// @namespace    https://github.com/mywishluv/wishlite
// @version      1.1.1
// @description  크랙 채팅에서 마음에 드는 메시지에 ☆를 눌러 저장하고, 메모를 달고, 목록에서 눌러 그 턴으로 바로 이동해요.
// @author       muz
// @match        https://crack.wrtn.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @downloadURL  https://github.com/mywishluv/wishlite/raw/main/crack-bookmark.user.js
// @updateURL    https://github.com/mywishluv/wishlite/raw/main/crack-bookmark.user.js
// ==/UserScript==
// v1.1.1 - 설정 창 '대화 북마크' 아이콘을 노란 그라데이션 별 + 분홍 반짝이로 변경
// v1.1.0 - 떠 있던 ★ 버튼 없애고 채팅방 설정 '전체 설정' 밑에 '대화 북마크' 메뉴로 이동, 북마크마다 메모 추가
// v1.0.0 - 첫 버전: 메시지마다 ☆ 저장, ★ 목록, 그 턴으로 이동(예전 대화 자동 불러오기)
// 내 대화는 크랙에서 읽기만 하고 다른 곳으로 보내지 않아요. (저장은 이 브라우저 안에만)

(function () {
  'use strict';

  /* ───────── 크랙 화면 구조 (바뀌면 여기만 고치면 돼요) ───────── */
  const SEL = {
    message: '[data-message-group-id]',          // 메시지 한 덩어리
    idAttr: 'data-message-group-id',             // 메시지 고유 번호
    optionsBtn: 'button[aria-label="메시지 옵션"]', // ⋯ 버튼 (이 옆에 ☆를 붙임)
    optionsWrap: '.dropdown-button',             // ⋯ 버튼 감싸는 칸
    text: '.wrtn-markdown',                      // 메시지 본문
    userMark: '.border-outline_tertiary',        // 내 메시지에만 있는 테두리
    menuLabel: 'span.typo-text-sm_leading-none_medium', // 설정 창 메뉴 글자
    menuBtn: '[role="button"]',                  // 설정 창 메뉴 한 줄의 버튼
  };
  const TXT = {
    sidebarTitle: '채팅방 설정',   // 설정 창이 열렸는지 확인용
    anchor: '글꼴',               // 이 메뉴 바로 위에 넣어요 ('전체 설정' 밑 첫 줄)
  };

  const NAME = '크랙 대화 북마크';
  const MENU = '대화 북마크';
  const GOLD = '#F5B301';
  const Z = 2147483000;

  /* ───────── 저장 (채팅방마다 따로, 이 브라우저에만) ───────── */
  let path = location.pathname;
  let cache = load();

  function roomKey() { return 'bm:' + location.pathname.replace(/\/+$/, ''); }
  function load() {
    try { const v = JSON.parse(GM_getValue(roomKey(), '[]')); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function persist() { GM_setValue(roomKey(), JSON.stringify(cache)); }
  function has(id) { return cache.some(x => x.id === id); }

  /* ───────── 작은 도구들 ───────── */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const css = (el, s) => { Object.assign(el.style, s); return el; };
  function h(tag, style, text) {
    const el = document.createElement(tag);
    if (style) css(el, style);
    if (text != null) el.textContent = text;
    return el;
  }
  function findMsg(id) {
    try { return document.querySelector(`[${SEL.idAttr}="${CSS.escape(id)}"]`); } catch (e) { return null; }
  }
  function allMsgs() { return [...document.querySelectorAll(SEL.message)]; }
  function idOf(m) { return m.getAttribute(SEL.idAttr) || ''; }
  function getText(m) {
    return [...m.querySelectorAll(SEL.text)].map(e => (e.innerText || '').trim()).filter(Boolean).join('\n\n');
  }
  function roleOf(m) { return m.querySelector(SEL.userMark) ? 'me' : 'char'; }
  function textIs(el, t) { return (el.textContent || '').replace(/\s/g, '') === t.replace(/\s/g, ''); }

  function isDark() {
    for (const el of [document.body, document.documentElement]) {
      const c = (getComputedStyle(el).backgroundColor.match(/[\d.]+/g) || []).map(Number);
      if (c.length >= 3 && !(c.length === 4 && c[3] === 0)) {
        return c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114 < 128;
      }
    }
    return matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function theme() {
    return isDark()
      ? { bg: '#1C1C1E', card: '#2C2C2E', text: '#F2F2F7', sub: '#98989F', line: '#3A3A3C', btn: '#3A3A3C', input: '#1C1C1E' }
      : { bg: '#F2F2F7', card: '#FFFFFF', text: '#1C1C1E', sub: '#8E8E93', line: '#E5E5EA', btn: '#F2F2F7', input: '#F2F2F7' };
  }
  const FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Malgun Gothic", sans-serif';

  /* ───────── 알림 (아래쪽 작은 말풍선) ───────── */
  let toastEl = null, toastTimer = null;
  function toast(msg, action, ms = 1800) {
    hideToast();
    const t = theme();
    toastEl = h('div', {
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      bottom: 'calc(90px + env(safe-area-inset-bottom))', zIndex: String(Z + 2),
      maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 16px', borderRadius: '14px',
      background: t.text, color: t.bg, fontFamily: FONT, fontSize: '14px', lineHeight: '1.4',
      boxShadow: '0 6px 24px rgba(0,0,0,.25)',
    });
    toastEl.appendChild(h('span', null, msg));
    if (action) {
      const b = h('button', {
        border: 'none', background: 'transparent', color: GOLD, fontWeight: '700',
        fontSize: '14px', padding: '4px 2px', cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
      }, action.label);
      b.onclick = () => { hideToast(); action.fn(); };
      toastEl.appendChild(b);
    }
    document.body.appendChild(toastEl);
    if (ms) toastTimer = setTimeout(hideToast, ms);
  }
  function hideToast() {
    clearTimeout(toastTimer);
    if (toastEl) { toastEl.remove(); toastEl = null; }
  }

  /* ───────── 메시지마다 ☆ 버튼 ───────── */
  function paintStar(b, on) {
    const want = on ? '★' : '☆';
    if (b.textContent !== want) b.textContent = want;
    const color = on ? GOLD : 'var(--icon_primary, #8E8E93)';
    if (b.style.color !== color) b.style.color = color;
    b.style.opacity = on ? '1' : '.75';
  }
  function makeStar(id) {
    const b = h('button', {
      width: '30px', height: '30px', padding: '0', border: 'none', borderRadius: '50%',
      background: 'transparent', cursor: 'pointer', fontSize: '18px', lineHeight: '1',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0',
      WebkitTapHighlightColor: 'transparent', fontFamily: FONT,
    });
    b.type = 'button';
    b.className = 'cbm-star';
    b.setAttribute('aria-label', '대화 북마크');
    b.dataset.cbmId = id;
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggle(id); });
    return b;
  }

  let warnedMsg = false, problemSince = 0;
  function injectStars() {
    const msgs = allMsgs();
    let placed = 0;
    msgs.forEach(m => {
      const id = idOf(m);
      if (!id) return;
      let star = m.querySelector('.cbm-star');
      if (!star) {
        const opt = m.querySelector(SEL.optionsBtn);
        if (!opt) return;
        const wrap = opt.closest(SEL.optionsWrap) || opt;
        const parent = wrap.parentElement;
        if (!parent) return;
        if (getComputedStyle(parent).display !== 'flex') {
          css(parent, { display: 'flex', alignItems: 'center', gap: '4px' });
        }
        star = makeStar(id);
        parent.insertBefore(star, wrap);
      }
      placed++;
      paintStar(star, has(id));
    });

    // 크랙 화면이 바뀌어서 못 찾으면 조용히 넘어가지 않고 한 번 알려줘요
    if (warnedMsg) return;
    const hasChatText = !!document.querySelector(SEL.text);
    const broken = (hasChatText && msgs.length === 0) || (msgs.length > 0 && placed === 0);
    if (!broken) { problemSince = 0; return; }
    if (!problemSince) { problemSince = Date.now(); return; }
    if (Date.now() - problemSince > 6000) {
      warnedMsg = true;
      toast(`크랙 화면이 바뀌어서 ☆ 버튼을 못 달았어요. 디시 댓글로 알려주세요 (${NAME})`, null, 6000);
    }
  }

  /* ───────── 채팅방 설정 창에 '대화 북마크' 메뉴 ───────── */
  // 말랑한 노란 별 + 반짝이 (크랙 아이콘 색에 안 묻히게 색을 직접 지정)
  const STAR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">' +
    '<defs><linearGradient id="cbm-star-g" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#FFE27A"/><stop offset="1" stop-color="#FFB547"/></linearGradient></defs>' +
    '<path d="M11.2 4.3c.33-.67 1.27-.67 1.6 0l1.9 3.86 4.26.62c.73.1 1.03 1 .5 1.52l-3.08 3 .73 4.24c.12.73-.64 1.29-1.3.94L12 16.5l-3.81 2c-.66.35-1.42-.21-1.3-.94l.73-4.24-3.08-3c-.53-.52-.23-1.41.5-1.52l4.26-.62z" style="fill:url(#cbm-star-g);stroke:#F29A1F;stroke-width:1.1;stroke-linejoin:round"/>' +
    '<ellipse cx="9.7" cy="9.9" rx="1.3" ry=".8" transform="rotate(-30 9.7 9.9)" style="fill:#fff;opacity:.75"/>' +
    '<path d="M19.6 2.2l.42 1.1 1.1.42-1.1.42-.42 1.1-.42-1.1-1.1-.42 1.1-.42z" style="fill:#FF8FB1"/>' +
    '<circle cx="4.3" cy="4.6" r=".7" style="fill:#FF8FB1;opacity:.8"/>' +
    '</svg>';

  let warnedMenu = false, menuMissSince = 0;
  function ensureMenu() {
    if (document.querySelector('[data-cbm-entry]')) { updateMenuCount(); return; }

    const labels = [...document.querySelectorAll(SEL.menuLabel)];
    const anchorLabel = labels.find(el => textIs(el, TXT.anchor));
    const sidebarOpen = labels.some(el => textIs(el, TXT.sidebarTitle)) ||
      [...document.querySelectorAll('span,p')].some(el => el.children.length === 0 && textIs(el, TXT.sidebarTitle));

    if (!anchorLabel) {
      // 설정 창은 열렸는데 '글꼴'을 못 찾으면 한 번 안내
      if (sidebarOpen && !warnedMenu) {
        if (!menuMissSince) menuMissSince = Date.now();
        else if (Date.now() - menuMissSince > 3000) {
          warnedMenu = true;
          toast(`설정 창 모양이 바뀌어서 '${MENU}' 메뉴를 못 넣었어요. 디시 댓글로 알려주세요`, null, 6000);
        }
      }
      return;
    }
    menuMissSince = 0;

    const btn = anchorLabel.closest(SEL.menuBtn);
    const row = btn && btn.parentElement;
    if (!row || !row.parentElement) return;

    // '글꼴' 줄을 그대로 본떠서 같은 모양으로 만들어요
    const entry = row.cloneNode(true);
    entry.setAttribute('data-cbm-entry', '1');
    entry.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    entry.querySelectorAll('[role="switch"]').forEach(e => (e.closest('span') || e).remove());
    const eBtn = entry.querySelector(SEL.menuBtn) || entry;
    eBtn.removeAttribute('id');
    eBtn.setAttribute('aria-label', MENU);
    const oldSvg = entry.querySelector('svg');
    if (oldSvg) {
      const tmp = document.createElement('div');
      tmp.innerHTML = STAR_SVG;
      oldSvg.replaceWith(tmp.firstChild);
    }
    const label = entry.querySelector(SEL.menuLabel) || entry.querySelector('span span') || eBtn;
    label.textContent = MENU;
    label.classList.add('cbm-label');

    const count = h('span', {
      fontSize: '12px', fontWeight: '600', color: GOLD, marginLeft: 'auto', paddingLeft: '8px',
    });
    count.className = 'cbm-count';
    eBtn.appendChild(count);

    const open = e => { e.preventDefault(); e.stopPropagation(); openPanel(); };
    eBtn.addEventListener('click', open);
    eBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(e); });

    row.parentElement.insertBefore(entry, row);
    updateMenuCount();
  }
  function updateMenuCount() {
    const c = document.querySelector('[data-cbm-entry] .cbm-count');
    if (!c) return;
    const want = cache.length ? String(cache.length) : '';
    if (c.textContent !== want) c.textContent = want;
  }

  /* ───────── 저장 / 삭제 / 메모 ───────── */
  function toggle(id) {
    const i = cache.findIndex(x => x.id === id);
    if (i >= 0) {
      const removed = cache.splice(i, 1)[0];
      persist(); refresh();
      toast('북마크를 지웠어요', { label: '되돌리기', fn: () => restore(removed) }, 3500);
      return;
    }
    const m = findMsg(id);
    if (!m) return;
    const text = getText(m);
    if (!text) { toast('메시지 내용을 읽지 못했어요'); return; }
    cache.push({ id, role: roleOf(m), text: text.slice(0, 20000), memo: '', at: Date.now() });
    sortCache(); persist(); refresh();
    toast(`★ ${MENU}에 저장했어요`);
  }
  function restore(item) {
    if (has(item.id)) return;
    cache.push(item); sortCache(); persist(); refresh();
  }
  function setMemo(id, memo) {
    const it = cache.find(x => x.id === id);
    if (!it) return;
    it.memo = memo.trim().slice(0, 200);
    persist(); renderList();
  }
  // 대화 순서대로 (메시지 번호가 시간순이라 그대로 정렬)
  function sortCache() { cache.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); }

  /* ───────── 대화 북마크 목록 (아래에서 올라오는 창) ───────── */
  let overlay = null, listBox = null, titleEl = null, prevOverflow = '';
  function openPanel() {
    if (overlay) return;
    const t = theme();
    overlay = h('div', {
      position: 'fixed', inset: '0', zIndex: String(Z), background: 'rgba(0,0,0,.35)', fontFamily: FONT,
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });

    const sheet = h('div', {
      position: 'absolute', left: '0', right: '0', bottom: '0', margin: '0 auto',
      maxWidth: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      background: t.bg, color: t.text, borderRadius: '18px 18px 0 0',
      paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -8px 30px rgba(0,0,0,.2)',
      transform: 'translateY(100%)', transition: 'transform .25s ease',
    });

    const head = h('div', { padding: '8px 16px 10px', flexShrink: '0' });
    head.appendChild(h('div', {
      width: '36px', height: '5px', borderRadius: '3px', background: t.line, margin: '0 auto 10px',
    }));
    const row = h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
    titleEl = h('div', { fontSize: '17px', fontWeight: '700' });
    const close = h('button', {
      width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: t.btn,
      color: t.sub, fontSize: '15px', cursor: 'pointer', fontFamily: FONT,
    }, '✕');
    close.type = 'button';
    close.setAttribute('aria-label', '닫기');
    close.onclick = closePanel;
    row.append(titleEl, close);
    head.appendChild(row);

    listBox = h('div', {
      overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
      padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: '10px',
    });

    sheet.append(head, listBox);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    renderList();
    requestAnimationFrame(() => { sheet.style.transform = 'translateY(0)'; });
  }
  function closePanel() {
    if (!overlay) return;
    overlay.remove(); overlay = null; listBox = null; titleEl = null;
    document.body.style.overflow = prevOverflow;
  }
  function fmtDate(ms) {
    const d = new Date(ms);
    return `${d.getMonth() + 1}.${d.getDate()} 저장`;
  }
  function renderList() {
    if (!listBox) return;
    const t = theme();
    titleEl.textContent = `★ ${MENU} ${cache.length}`;
    listBox.textContent = '';
    if (!cache.length) {
      listBox.appendChild(h('div', {
        textAlign: 'center', color: t.sub, fontSize: '14px', lineHeight: '1.6', padding: '36px 0 28px',
        whiteSpace: 'pre-line',
      }, '아직 저장한 장면이 없어요\n마음에 드는 메시지 옆 ☆를 눌러보세요'));
      return;
    }
    cache.forEach(item => listBox.appendChild(makeCard(item, t)));
  }

  function makeCard(item, t) {
    const card = h('div', {
      background: t.card, borderRadius: '14px', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: '8px',
    });

    // 위쪽: 누가 쓴 메시지인지 + 저장한 날
    const meta = h('div', { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: t.sub });
    meta.append(
      h('span', {
        padding: '2px 8px', borderRadius: '8px', fontWeight: '600',
        background: item.role === 'me' ? 'rgba(10,132,255,.14)' : 'rgba(245,179,1,.16)',
        color: item.role === 'me' ? '#0A84FF' : '#C78F00',
      }, item.role === 'me' ? '내 메시지' : '캐릭터'),
      h('span', null, fmtDate(item.at)),
    );

    // 메모 (있을 때만)
    const memoLine = h('div', {
      fontSize: '13px', lineHeight: '1.45', color: t.sub, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      display: item.memo ? 'block' : 'none',
    }, item.memo ? '📝 ' + item.memo : '');

    // 본문 미리보기 (3줄)
    const body = h('div', {
      fontSize: '14px', lineHeight: '1.55', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: '3', overflow: 'hidden',
      cursor: 'pointer',
    }, item.text);
    body.onclick = () => jump(item.id);

    // 메모 쓰는 칸 (메모 버튼 누르면 열림)
    const memoBox = h('div', { display: 'none', flexDirection: 'column', gap: '6px' });
    const ta = h('textarea', {
      width: '100%', boxSizing: 'border-box', minHeight: '64px', resize: 'vertical',
      border: `1px solid ${t.line}`, borderRadius: '10px', padding: '10px 12px',
      background: t.input, color: t.text, fontFamily: FONT, fontSize: '16px', lineHeight: '1.4',
      outline: 'none',
    });
    ta.maxLength = 200;
    ta.placeholder = '이 장면에 대한 짧은 메모 (200자까지)';
    const memoBtns = h('div', { display: 'flex', gap: '8px', justifyContent: 'flex-end' });

    const mk = (label, kind) => {
      const b = h('button', {
        flex: '1', height: '36px', borderRadius: '10px', border: 'none',
        background: kind === 'primary' ? GOLD : t.btn, color: kind === 'primary' ? '#fff' : kind === 'danger' ? '#FF453A' : t.text,
        fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: FONT, padding: '0 6px',
      }, label);
      b.type = 'button';
      return b;
    };

    const cancel = mk('취소');
    const save = mk('메모 저장', 'primary');
    cancel.style.flex = save.style.flex = '0 0 auto';
    cancel.style.padding = save.style.padding = '0 16px';
    memoBtns.append(cancel, save);
    memoBox.append(ta, memoBtns);

    // 아래 버튼 줄
    const btns = h('div', { display: 'flex', gap: '6px' });
    const go = mk('가기', 'primary');
    const more = mk('전체');
    const memoBtn = mk(item.memo ? '메모 ✓' : '메모');
    const del = mk('삭제', 'danger');
    btns.append(go, more, memoBtn, del);

    go.onclick = () => jump(item.id);
    let open = false;
    more.onclick = () => {
      open = !open;
      body.style.webkitLineClamp = open ? 'unset' : '3';
      body.style.display = open ? 'block' : '-webkit-box';
      body.style.userSelect = open ? 'text' : '';
      body.style.cursor = open ? 'text' : 'pointer';
      body.onclick = open ? null : () => jump(item.id);
      more.textContent = open ? '접기' : '전체';
    };
    const showMemoEditor = on => {
      memoBox.style.display = on ? 'flex' : 'none';
      btns.style.display = on ? 'none' : 'flex';
      if (on) { ta.value = item.memo || ''; setTimeout(() => ta.focus(), 30); }
    };
    memoBtn.onclick = () => showMemoEditor(true);
    cancel.onclick = () => showMemoEditor(false);
    save.onclick = () => { setMemo(item.id, ta.value); toast(ta.value.trim() ? '메모를 저장했어요' : '메모를 지웠어요'); };
    del.onclick = () => toggle(item.id);

    card.append(meta, memoLine, body, memoBox, btns);
    return card;
  }

  /* ───────── 그 턴으로 이동 ───────── */
  let searching = false;
  function scrollParent(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 5) return p;
    }
    return document.scrollingElement || document.documentElement;
  }
  function oldestMsg() {
    let best = null;
    allMsgs().forEach(m => { if (!best || idOf(m) < idOf(best)) best = m; });
    return best;
  }
  function flash(el) {
    const prev = el.style.backgroundColor;
    el.style.transition = 'background-color .5s';
    el.style.backgroundColor = 'rgba(245,179,1,.20)';
    setTimeout(() => {
      el.style.backgroundColor = prev;
      setTimeout(() => { el.style.transition = ''; }, 600);
    }, 1600);
  }
  async function jump(id) {
    closePanel();
    if (searching) return;
    let el = findMsg(id);
    if (!el) {
      const oldest = oldestMsg();
      if (oldest && id > idOf(oldest)) {
        toast('이 메시지는 지워졌거나 다시 생성된 것 같아요. 내용은 목록의 "전체"로 볼 수 있어요.', null, 4000);
        return;
      }
      el = await loadOlderUntil(id);
      if (el === 'cancel') return;
      if (!el) {
        toast('찾지 못했어요. 내용은 목록의 "전체"로 볼 수 있어요.', null, 4000);
        return;
      }
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => flash(el), 350);
  }
  // 예전 대화가 아직 안 불러와졌으면 위로 올려가며 찾기
  async function loadOlderUntil(id) {
    searching = true;
    let lastMin = null, still = 0;
    try {
      for (let n = 1; n <= 25; n++) {
        if (!searching) return 'cancel';
        toast(`예전 대화를 불러오는 중… (${n})`, { label: '그만', fn: () => { searching = false; } }, 0);
        const oldest = oldestMsg();
        if (!oldest) return null;
        oldest.scrollIntoView({ block: 'start' });
        scrollParent(oldest).scrollBy(0, -1500);
        await sleep(800);
        if (!searching) return 'cancel';
        const el = findMsg(id);
        if (el) return el;
        const min = idOf(oldestMsg() || oldest);
        if (min && id > min) return null;        // 지나쳤는데 없음 = 지워진 메시지
        if (min === lastMin) { if (++still >= 3) return null; }
        else { still = 0; lastMin = min; }
      }
      return null;
    } finally {
      searching = false;
      hideToast();
    }
  }

  /* ───────── 화면 변화 감시 ───────── */
  function refresh() {
    injectStars();
    ensureMenu();
    updateMenuCount();
    renderList();
  }
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (location.pathname !== path) {   // 다른 채팅방으로 옮김
        path = location.pathname;
        cache = load();
        closePanel();
        warnedMsg = false; problemSince = 0;
      }
      injectStars();
      ensureMenu();
    });
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
  setInterval(schedule, 2000); // 구조 점검 + 주소 변경 대비
  schedule();
})();
