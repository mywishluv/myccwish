// ==UserScript==
// @name         크랙 대화 다운로드
// @namespace    https://github.com/mywishluv
// @version      1.0.0
// @description  크랙 채팅방 설정(⋯)의 '플레이 가이드' 위에 대화 다운로드 버튼을 추가합니다 · 전체 다운 / 지난번 이후 새 대화만 이어서 다운 (txt)
// @author       muz
// @match        https://crack.wrtn.ai/*
// @connect      crack-api.wrtn.ai
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

// 변경점 v1.0.0: 첫 버전 · 전체 다운로드 + 이어서 다운로드(지난번 이후 새 대화만), txt 저장

(function () {
  'use strict';

  /* ===================== 크랙 화면/주소 설정 (바뀌면 여기만 고치기) ===================== */
  const CFG = {
    menuAnchorText: /^플레이\s?가이드$/,          // 이 메뉴 항목 바로 위에 버튼을 넣음
    settingsTitleText: /^채팅방 설정$/,           // 설정 창이 열렸는지 확인용
    settingsTitleSel: 'span.text-text_tertiary, p.text-text_tertiary',
    menuLabelSel: 'div[role="button"] span.whitespace-nowrap, div[role="button"] span',
    chatIdFromPath: [/\/episodes\/([^/?#]+)/, /\/chats\/([^/?#]+)/, /\/u\/[^/]+\/c\/([^/?#]+)/],
    api: id => `https://crack-api.wrtn.ai/crack-gen/v3/chats/${encodeURIComponent(id)}/messages`,
    pageSize: 50,
    maxPages: 600,                                 // 안전 한도 (50 × 600 = 3만 메시지)
  };
  const ENTRY_ATTR = 'data-ccd-entry';
  const STORE_KEY = id => 'ccd-last-' + id;

  /* ===================== 공통 도구 ===================== */
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function getCookie(name) {
    for (const part of String(document.cookie || '').split(';')) {
      const f = part.trim(), at = f.indexOf('=');
      if (at < 0 || f.slice(0, at) !== name) continue;
      const v = f.slice(at + 1);
      try { return decodeURIComponent(v); } catch (_) { return v; }
    }
    return '';
  }

  function currentChatId() {
    for (const re of CFG.chatIdFromPath) {
      const m = location.pathname.match(re);
      if (m) return decodeURIComponent(m[1]);
    }
    return '';
  }

  function roomTitle() {
    const t = String(document.title || '').split(/\s[|\-–·]\s/)[0].trim();
    return t || '크랙 대화';
  }

  function safeName(s) {
    return String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 60) || '대화';
  }

  function stamp(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function niceTime(ts) {
    return new Date(ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function downloadText(text, filename) {
    const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ===================== 메시지 해석 ===================== */
  const msgId = m => String(m?._id || m?.id || m?.messageId || '');
  const msgRole = m => String(m?.role || m?.speaker || '').toLowerCase();
  const isUser = m => msgRole(m) === 'user';
  const isAi = m => ['assistant', 'character', 'bot'].includes(msgRole(m));
  const isIncomplete = m => ['pending', 'queued', 'streaming', 'generating', 'processing', 'in_progress', 'in-progress']
    .includes(String(m?.status || m?.generationStatus || m?.state || '').toLowerCase());

  function msgText(m) {
    let s = typeof m?.content === 'string' ? m.content : typeof m?.message === 'string' ? m.message : '';
    // 다른 확프(위시라이트 등)가 몰래 붙여 보낸 기억 주입 블록은 대화가 아니므로 뺌
    s = s
      .replace(/\\?<!--RP_CONTEXT_MANAGER_START[\s\S]*?RP_CONTEXT_MANAGER_END-->/gi, '')
      .replace(/<rp_context_manager\b[\s\S]*?<\/rp_context_manager>/gi, '')
      .replace(/<ooc_lore_context>[\s\S]*?<\/ooc_lore_context>/gi, '');
    return s.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const isDialogue = m => (isUser(m) || isAi(m)) && !isIncomplete(m) && msgText(m);

  /* ===================== 크랙 서버에서 내 대화 읽기 ===================== */
  async function getToken() {
    for (let i = 0; i < 5; i++) {
      const t = getCookie('access_token');
      if (t) return t;
      await sleep(250);
    }
    throw new Error('크랙 로그인 정보를 못 읽었어요. 새로고침하거나 다시 로그인해 주세요.');
  }

  async function getJson(url) {
    const token = await getToken();
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 20000,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json, text/plain, */*',
          platform: 'web', 'wrtn-locale': 'ko-KR',
        },
        onload: res => {
          let data = null;
          try { data = JSON.parse(res.responseText); } catch (_) {}
          if (res.status >= 200 && res.status < 300 && data) resolve(data);
          else reject(new Error(`크랙 서버 응답 오류 (${res.status})`));
        },
        ontimeout: () => reject(new Error('응답이 너무 늦어요. 잠시 뒤 다시 해 주세요.')),
        onerror: () => reject(new Error('네트워크 오류가 났어요.')),
      });
    });
  }

  async function getPage(chatId, cursor) {
    const url = `${CFG.api(chatId)}?limit=${CFG.pageSize}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;
    let last;
    for (let i = 0; i < 3; i++) {
      try { return await getJson(url); } catch (e) { last = e; await sleep(700 * (i + 1)); }
    }
    throw last;
  }

  // 최신 → 과거 순으로 읽음. stopIds 중 하나를 만나면 거기서 멈춤(이어서 다운용)
  async function loadMessages(chatId, { stopIds = [], onProgress, isCancelled }) {
    const got = [], seenIds = new Set(), seenCursors = new Set();
    let cursor = '', found = false;
    for (let pageNo = 0; pageNo < CFG.maxPages; pageNo++) {
      if (isCancelled()) throw new Error('취소했어요.');
      const data = await getPage(chatId, cursor);
      const page = data?.data?.messages || data?.messages;
      if (!Array.isArray(page)) throw new Error('대화 형식을 못 읽었어요. 크랙이 바뀌었을 수 있어요.');
      for (const m of page) {
        const id = msgId(m);
        if (id && stopIds.includes(id)) { found = true; break; }
        if (id && seenIds.has(id)) continue;
        if (id) seenIds.add(id);
        got.push(m);
      }
      onProgress(got.length);
      if (found) break;
      const next = String(data?.data?.nextCursor || data?.nextCursor || '');
      if (!next || !page.length) return { messages: got.reverse(), found: false, complete: true };
      if (seenCursors.has(next)) throw new Error('대화를 끝까지 읽지 못했어요. 다시 시도해 주세요.');
      seenCursors.add(next); cursor = next;
      await sleep(120);
    }
    if (!found) throw new Error('대화가 너무 길어 안전 한도에서 멈췄어요.');
    return { messages: got.reverse(), found: true, complete: true };
  }

  /* ===================== txt 만들기 ===================== */
  function buildText(title, list, startNo, mode) {
    const blocks = list.map((m, i) => `【#${startNo + i} · ${isUser(m) ? '나' : 'AI'}】\n${msgText(m)}`);
    const range = mode === 'full'
      ? `전체 대화 · 메시지 ${list.length}개`
      : `이어서 받은 대화 · #${startNo} ~ #${startNo + list.length - 1} (${list.length}개)`;
    const head = `${title}\n${range}\n저장 시각: ${new Date().toLocaleString('ko-KR')}\n`;
    return `${head}\n━━━━━━━━━━━━━━━━━━━━\n\n${blocks.join('\n\n────────────\n\n')}\n`;
  }

  /* ===================== 다운로드 실행 ===================== */
  let busy = false, cancelled = false;

  async function run(mode, ui) {
    if (busy) return;
    const chatId = currentChatId();
    if (!chatId) { ui.status('채팅방 안에서만 쓸 수 있어요.', 'err'); return; }
    const saved = GM_getValue(STORE_KEY(chatId), null);
    if (mode === 'resume' && !saved) { ui.status('아직 받은 기록이 없어요. 전체 다운로드를 먼저 해 주세요.', 'err'); return; }

    busy = true; cancelled = false; ui.lock(true);
    ui.status('대화 읽는 중…');
    try {
      const res = await loadMessages(chatId, {
        stopIds: mode === 'resume' ? saved.ids : [],
        onProgress: n => ui.status(`대화 ${n.toLocaleString('ko-KR')}개 읽는 중…`),
        isCancelled: () => cancelled,
      });
      if (mode === 'resume' && !res.found) {
        ui.status('지난번 저장 지점을 못 찾았어요. 그 대화가 삭제·리롤됐을 수 있어요. 전체 다운로드를 써 주세요.', 'err');
        return;
      }
      const list = res.messages.filter(isDialogue);
      if (!list.length) {
        ui.status(mode === 'resume' ? '지난번 이후 새 대화가 없어요.' : '받을 대화가 없어요.', 'ok');
        return;
      }
      const startNo = mode === 'resume' ? (saved.total || 0) + 1 : 1;
      const title = roomTitle();
      const label = mode === 'full' ? '전체' : '이어서';
      downloadText(buildText(title, list, startNo, mode), `${safeName(title)}_${label}_${stamp()}.txt`);

      const newestIds = list.slice(-5).reverse().map(msgId).filter(Boolean);
      const record = { ids: newestIds, at: Date.now(), total: startNo + list.length - 1 };
      GM_setValue(STORE_KEY(chatId), record);
      ui.status(`메시지 ${list.length.toLocaleString('ko-KR')}개를 저장했어요.`, 'ok');
      ui.refresh();
    } catch (e) {
      ui.status(e.message || String(e), 'err');
    } finally {
      busy = false; ui.lock(false);
    }
  }

  /* ===================== 스타일 ===================== */
  const style = document.createElement('style');
  style.textContent = `
    #ccd-dim{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.35);display:flex;
      align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard",system-ui,sans-serif;
      -webkit-tap-highlight-color:transparent;animation:ccdFade .15s ease}
    #ccd-sheet{width:min(360px,calc(100vw - 32px));background:#f2f2f7;border-radius:18px;padding:18px 16px 14px;
      box-shadow:0 12px 40px rgba(0,0,0,.25);color:#1c1c1e;box-sizing:border-box;animation:ccdUp .2s ease}
    #ccd-sheet *{box-sizing:border-box}
    #ccd-sheet h3{margin:0 0 2px;font-size:17px;font-weight:700;text-align:center}
    #ccd-sheet .ccd-sub{margin:0 0 14px;font-size:13px;color:#8e8e93;text-align:center;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #ccd-sheet .ccd-group{background:#fff;border-radius:12px;overflow:hidden}
    #ccd-sheet .ccd-btn{display:flex;align-items:center;gap:12px;width:100%;min-height:58px;padding:10px 14px;
      border:0;background:#fff;text-align:left;cursor:pointer;font:inherit;color:inherit}
    #ccd-sheet .ccd-btn + .ccd-btn{border-top:.5px solid #d1d1d6}
    #ccd-sheet .ccd-btn:active{background:#e5e5ea}
    #ccd-sheet .ccd-btn:disabled{opacity:.4;cursor:default}
    #ccd-sheet .ccd-ico{flex:0 0 32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:16px}
    #ccd-sheet .ccd-txt b{display:block;font-size:15px;font-weight:600}
    #ccd-sheet .ccd-txt small{display:block;margin-top:2px;font-size:12px;color:#8e8e93;line-height:1.35}
    #ccd-sheet .ccd-status{min-height:20px;margin:12px 4px 0;font-size:13px;text-align:center;color:#3a3a3c;line-height:1.45}
    #ccd-sheet .ccd-status.ok{color:#248a3d}
    #ccd-sheet .ccd-status.err{color:#d70015}
    #ccd-sheet .ccd-close{display:block;width:100%;margin-top:12px;height:46px;border:0;border-radius:12px;background:#fff;
      font:inherit;font-size:16px;font-weight:600;color:#007aff;cursor:pointer}
    #ccd-sheet .ccd-close:active{background:#e5e5ea}
    @media (max-width:600px){
      #ccd-dim{align-items:flex-end}
      #ccd-sheet{width:100%;border-radius:18px 18px 0 0;padding-bottom:calc(14px + env(safe-area-inset-bottom))}
    }
    @keyframes ccdFade{from{opacity:0}to{opacity:1}}
    @keyframes ccdUp{from{transform:translateY(16px);opacity:.6}to{transform:none;opacity:1}}
    #ccd-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483001;max-width:calc(100vw - 32px);
      background:rgba(30,30,30,.92);color:#fff;padding:10px 16px;border-radius:12px;font:13px/1.45 system-ui,sans-serif;text-align:center}
  `;
  document.head.appendChild(style);

  function toast(text, ms = 4500) {
    document.getElementById('ccd-toast')?.remove();
    const t = document.createElement('div');
    t.id = 'ccd-toast'; t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  /* ===================== 다운로드 창 ===================== */
  function openSheet() {
    if (document.getElementById('ccd-dim')) return;
    const chatId = currentChatId();
    if (!chatId) { toast('채팅방 안에서만 쓸 수 있어요.'); return; }

    const dim = document.createElement('div');
    dim.id = 'ccd-dim';
    dim.innerHTML = `
      <div id="ccd-sheet" role="dialog" aria-label="대화 다운로드">
        <h3>대화 다운로드</h3>
        <p class="ccd-sub"></p>
        <div class="ccd-group">
          <button type="button" class="ccd-btn" data-mode="full">
            <span class="ccd-ico" style="background:#007aff">⬇</span>
            <span class="ccd-txt"><b>전체 다운로드</b><small>처음부터 지금까지 모든 대화</small></span>
          </button>
          <button type="button" class="ccd-btn" data-mode="resume">
            <span class="ccd-ico" style="background:#34c759">↻</span>
            <span class="ccd-txt"><b>이어서 다운로드</b><small class="ccd-resume-sub"></small></span>
          </button>
        </div>
        <div class="ccd-status" aria-live="polite"></div>
        <button type="button" class="ccd-close">닫기</button>
      </div>`;
    document.body.appendChild(dim);

    const $ = s => dim.querySelector(s);
    $('.ccd-sub').textContent = roomTitle();
    const statusEl = $('.ccd-status');

    const ui = {
      status(text, kind = '') { statusEl.textContent = text; statusEl.className = 'ccd-status' + (kind ? ' ' + kind : ''); },
      lock(on) {
        dim.querySelectorAll('.ccd-btn').forEach(b => { b.disabled = on || (b.dataset.mode === 'resume' && !GM_getValue(STORE_KEY(chatId), null)); });
        $('.ccd-close').textContent = on ? '취소' : '닫기';
      },
      refresh() {
        const saved = GM_getValue(STORE_KEY(chatId), null);
        $('.ccd-resume-sub').textContent = saved
          ? `지난번(${niceTime(saved.at)}, #${saved.total}까지) 이후 새 대화만`
          : '전체 다운로드를 한 번 하면 쓸 수 있어요';
        ui.lock(busy);
      },
    };
    ui.refresh();

    const close = () => {
      if (busy) { cancelled = true; return; }
      dim.remove(); document.removeEventListener('keydown', onKey);
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    dim.addEventListener('click', e => { if (e.target === dim) close(); });
    $('.ccd-close').onclick = close;
    dim.querySelectorAll('.ccd-btn').forEach(b => { b.onclick = () => run(b.dataset.mode, ui); });
  }

  /* ===================== 채팅방 설정 메뉴에 버튼 넣기 ===================== */
  const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="var(--icon_secondary)"><path d="M11.2 3h1.6v10.07l3.63-3.63 1.13 1.13L12 16.13l-5.56-5.56 1.13-1.13 3.63 3.63z"/><path d="M4.2 14.5h1.6v4.7h12.4v-4.7h1.6v5c0 .72-.58 1.3-1.3 1.3h-13a1.3 1.3 0 0 1-1.3-1.3z"/></svg>`;

  function findAnchorLabel() {
    for (const el of document.querySelectorAll(CFG.menuLabelSel)) {
      if (el.children.length === 0 && CFG.menuAnchorText.test(el.textContent.trim())) return el;
    }
    return null;
  }

  function settingsOpen() {
    for (const el of document.querySelectorAll(CFG.settingsTitleSel)) {
      if (el.children.length === 0 && CFG.settingsTitleText.test(el.textContent.trim())) return true;
    }
    return false;
  }

  let warned = false;
  function inject() {
    const label = findAnchorLabel();
    if (!label) {
      if (!warned && settingsOpen()) {
        warned = true;
        toast("대화 다운로드 버튼 자리를 못 찾았어요. 탬퍼몽키 메뉴의 '대화 다운로드 열기'를 써 주세요.", 6000);
      }
      return;
    }
    const btn = label.closest('div[role="button"]');
    const wrap = btn?.parentElement;
    if (!btn || !wrap?.parentElement) return;
    if (wrap.previousElementSibling?.hasAttribute(ENTRY_ATTR)) return;

    const entry = wrap.cloneNode(false);
    entry.setAttribute(ENTRY_ATTR, '1');
    entry.removeAttribute('id');
    const item = btn.cloneNode(false);
    item.removeAttribute('id');
    item.setAttribute('aria-label', '대화 다운로드');
    const inner = document.createElement('span');
    inner.className = label.parentElement?.className || 'flex space-x-2 items-center';
    inner.innerHTML = ICON;
    const text = document.createElement('span');
    text.className = label.className;
    text.textContent = '대화 다운로드';
    inner.appendChild(text);
    item.appendChild(inner);
    entry.appendChild(item);

    item.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openSheet(); });
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(); } });
    wrap.parentElement.insertBefore(entry, wrap);
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; inject(); });
  }).observe(document.body, { childList: true, subtree: true });
  inject();

  try { GM_registerMenuCommand('대화 다운로드 열기', openSheet); } catch (_) {}
})();
