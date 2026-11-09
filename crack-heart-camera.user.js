// ==UserScript==
// @name         크랙 하트카메라 캡처 v3.7.3 (소설 원고형)
// @namespace    https://crack.wrtn.ai/
// @author       muz
// @updateURL    https://raw.githubusercontent.com/mywishluv/wishlite/main/crack-heart-camera.user.js
// @downloadURL  https://raw.githubusercontent.com/mywishluv/wishlite/main/crack-heart-camera.user.js
// @version      3.7.3
// @description  모바일 미리보기/설정 분리·접기, 대사 속 이름 ★강조, 글꼴 31종, 하단 고정 하트카메라 버튼, 문단 선택 및 소설 원고 이미지(WebP/PNG) 저장
// @match        https://crack.wrtn.ai/*
// @match        https://*.crack.wrtn.ai/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM.xmlHttpRequest
// @grant        GM.registerMenuCommand
// @connect      fonts.googleapis.com
// @connect      fonts.gstatic.com
// @connect      cdn.jsdelivr.net
// @connect      hangeul.pstatic.net
// @connect      *
// @run-at       document-idle
// @noframes
// @license      MIT
// ==/UserScript==

/*
 * 쓰는 법
 *  1) 크랙 채팅방 화면 하단의 작은 하트카메라 버튼을 누른다
 *     (안 보이면 탬퍼몽키 메뉴의 '📷 익명 캡처 시작')
 *  2) 캡처할 시작 문단 → 끝 문단을 차례로 누른다
 *  3) 아래 탭: 이름(이름 바꾸기·★강조) / 꾸미기(형광펜·밑줄·스티커) / 모양 / 저장
 *
 * 크랙 화면 구조가 바뀌어 메시지를 못 찾으면 아래 CCParse 의 SELECTORS 를 고치면 돼요.
 */
try {

/* ======== text.js ======== */
/*
 * 크랙 익명 캡처 — 글자 처리
 *  - 문구 바꾸기(조사 자동 맞춤 포함)
 *  - 문장부호 다듬기
 *  - 대사 / 서술 / 속마음 구분, 대사 줄 나누기
 *
 * runs: [{ t: '텍스트', b?: 굵게, i?: 기울임, hl?: 형광펜색, k?: 'n'|'d'|'t' }]
 */
(function (root) {
  'use strict';

  /* ---------- 서식 있는 글자 배열 <-> runs ---------- */

  function styleOf(run) {
    const s = {};
    for (const key in run) if (key !== 't' && run[key] !== undefined && run[key] !== false && run[key] !== null) s[key] = run[key];
    return s;
  }

  function sameStyle(a, b) {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (a[k] !== b[k]) return false;
    return true;
  }

  function toStyled(runs) {
    let text = '';
    const styles = [];
    for (const run of runs || []) {
      const t = String(run.t ?? '');
      if (!t) continue;
      const s = styleOf(run);
      text += t;
      for (let i = 0; i < t.length; i++) styles.push(s);
    }
    return { text, styles };
  }

  function fromStyled(text, styles) {
    const runs = [];
    let cur = null;
    for (let i = 0; i < text.length; i++) {
      const s = styles[i] || {};
      if (cur && sameStyle(cur.s, s)) cur.t += text[i];
      else {
        cur = { t: text[i], s };
        runs.push(cur);
      }
    }
    return runs.map(r => Object.assign({ t: r.t }, r.s));
  }

  function mergeRuns(runs) {
    const st = toStyled(runs);
    return fromStyled(st.text, st.styles);
  }

  function plainText(runs) {
    return (runs || []).map(r => r.t).join('');
  }

  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ---------- 받침 판별 ---------- */
  // 0: 받침 없음, 1: 받침 있음(ㄹ 제외), 2: ㄹ 받침, -1: 판별 불가
  function finalSound(str) {
    const s = String(str || '').replace(/[\s"'“”‘’()[\]{}<>.,!?~…·\-_*「」『』]+$/u, '');
    if (!s) return -1;
    const ch = s[s.length - 1];
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const jong = (code - 0xAC00) % 28;
      if (jong === 0) return 0;
      return jong === 8 ? 2 : 1;
    }
    if (/[0-9]/.test(ch)) return { 0: 1, 1: 2, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1, 7: 2, 8: 2, 9: 0 }[ch];
    if (/[a-zA-Z]/.test(ch)) {
      const c = ch.toLowerCase();
      if (c === 'l' || c === 'r') return 2;
      if (c === 'm' || c === 'n') return 1;
      return 0;
    }
    return -1;
  }

  // [받침 있을 때, 받침 없을 때, ㄹ 받침일 때(없으면 받침 있을 때와 같음)]
  const PARTICLES = [
    ['으로써', '로써', '로써'],
    ['으로서', '로서', '로서'],
    ['이라고', '라고'],
    ['이라는', '라는'],
    ['이에요', '예요'],
    ['이었', '였', null, true], // 뒤에 다른 글자가 붙어도 됨 (이었다/였다)
    ['으로', '로', '로'],
    ['이랑', '랑'],
    ['이나', '나'],
    ['이다', '다'],
    ['은', '는'],
    ['이', '가'],
    ['을', '를'],
    ['과', '와'],
    ['아', '야']
  ];
  const PARTICLE_FORMS = [];
  PARTICLES.forEach((p, gi) => {
    const forms = new Set([p[0], p[1], p[2] || p[0]]);
    forms.forEach(f => PARTICLE_FORMS.push({ form: f, group: gi }));
  });
  PARTICLE_FORMS.sort((a, b) => b.form.length - a.form.length);

  // 이름 뒤 '이' (지훈이가, 지훈이는 …) 다음에 올 수 있는 말
  const AFTER_NAME_I = ['한테', '에게', '까지', '처럼', '보다', '하고', '네', '가', '는', '를', '랑', '와', '야', '나', '로', '도', '만', '의', '라고', '라는', '예요', '였', '다'];

  function isHangul(ch) {
    if (!ch) return false;
    const c = ch.charCodeAt(0);
    return (c >= 0xAC00 && c <= 0xD7A3) || (c >= 0x3131 && c <= 0x318E);
  }

  function pickForm(group, sound) {
    const p = PARTICLES[group];
    if (sound === 0) return p[1];
    if (sound === 2) return p[2] || p[0];
    return p[0];
  }

  /*
   * 뒤에 오는 조사를 새 이름에 맞게 고친다.
   * 반환: { consume: 원래 글자 수, insert: 넣을 글자 } 또는 null
   */
  function adjustParticle(rest, fromSound, toSound) {
    if (toSound < 0) return null;

    // 지훈이가 → 민수가 (받침 있는 이름 뒤 '이' 정리)
    if (fromSound > 0 && rest[0] === '이') {
      const after = rest.slice(1);
      for (const word of AFTER_NAME_I) {
        if (!after.startsWith(word)) continue;
        const next = after[word.length];
        if (word === '였' || !isHangul(next)) {
          if (toSound === 0) return { consume: 1, insert: '' };
          return null;
        }
      }
    }

    for (const pf of PARTICLE_FORMS) {
      if (!rest.startsWith(pf.form)) continue;
      const anyNext = PARTICLES[pf.group][3];
      const next = rest[pf.form.length];
      if (!anyNext && isHangul(next)) continue;
      const want = pickForm(pf.group, toSound);
      if (want === pf.form) return null;
      return { consume: pf.form.length, insert: want };
    }
    return null;
  }

  /* ---------- 문구 바꾸기 ---------- */

  function cleanRules(rules) {
    const seen = new Set();
    return (rules || [])
      .map(r => ({ from: String(r.from || '').trim(), to: String(r.to ?? '').trim() }))
      .filter(r => {
        if (!r.from || seen.has(r.from)) return false;
        seen.add(r.from);
        return true;
      });
  }

  function ruleKey(rule) {
    return rule.from + '\u0000' + rule.to;
  }

  function buildMatcher(rules) {
    const list = cleanRules(rules).sort((a, b) => b.from.length - a.from.length);
    if (!list.length) return null;
    const map = new Map(list.map(r => [r.from, r.to]));
    const re = new RegExp(list.map(r => escapeRegExp(r.from)).join('|'), 'g');
    return { re, map };
  }

  function replaceStyled(text, styles, matcher, particles) {
    if (!matcher) return { text, styles };
    let out = '';
    const outStyles = [];
    let last = 0;
    matcher.re.lastIndex = 0;
    let m;
    while ((m = matcher.re.exec(text))) {
      if (m[0] === '') { matcher.re.lastIndex++; continue; }
      const start = m.index, end = start + m[0].length;
      for (let i = last; i < start; i++) { out += text[i]; outStyles.push(styles[i]); }
      const to = matcher.map.get(m[0]);
      const st = styles[start];
      for (let i = 0; i < to.length; i++) { out += to[i]; outStyles.push(st); }
      let cursor = end;
      if (particles && to) {
        const adj = adjustParticle(text.slice(end, end + 6), finalSound(m[0]), finalSound(to));
        if (adj) {
          const pst = styles[end] || st;
          for (let i = 0; i < adj.insert.length; i++) { out += adj.insert[i]; outStyles.push(pst); }
          cursor = end + adj.consume;
        }
      }
      last = cursor;
      matcher.re.lastIndex = cursor;
    }
    for (let i = last; i < text.length; i++) { out += text[i]; outStyles.push(styles[i]); }
    return { text: out, styles: outStyles };
  }

  function applyReplacements(runs, rules, options) {
    const matcher = buildMatcher(rules);
    if (!matcher) return runs;
    const st = toStyled(runs);
    const r = replaceStyled(st.text, st.styles, matcher, !options || options.particles !== false);
    return fromStyled(r.text, r.styles);
  }

  function replaceText(text, rules, options) {
    return plainText(applyReplacements([{ t: String(text || '') }], rules, options));
  }

  function countMatches(texts, from) {
    const f = String(from || '').trim();
    if (!f) return 0;
    let n = 0;
    for (const t of texts) {
      let i = 0;
      while ((i = t.indexOf(f, i)) !== -1) { n++; i += f.length; }
    }
    return n;
  }

  /* ---------- 문장부호 다듬기 ---------- */

  function regexReplaceStyled(text, styles, re, to) {
    let out = '';
    const os = [];
    let last = 0;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      for (let i = last; i < m.index; i++) { out += text[i]; os.push(styles[i]); }
      const rep = typeof to === 'function' ? to(m) : to;
      for (let i = 0; i < rep.length; i++) { out += rep[i]; os.push(styles[m.index] || {}); }
      last = m.index + m[0].length;
      if (m[0] === '') re.lastIndex++;
    }
    for (let i = last; i < text.length; i++) { out += text[i]; os.push(styles[i]); }
    return { text: out, styles: os };
  }

  function tidyRuns(runs, options) {
    const opt = Object.assign({ punctuation: true }, options);
    let { text, styles } = toStyled(runs);
    text = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ');
    // 공백 정리
    ({ text, styles } = regexReplaceStyled(text, styles, /[ \t　]{2,}/g, ' '));
    ({ text, styles } = regexReplaceStyled(text, styles, / *\n */g, '\n'));
    ({ text, styles } = regexReplaceStyled(text, styles, /\n{3,}/g, '\n\n'));
    // 화면에서 안 바뀐 *기울임*, **굵게** 표시를 진짜 서식으로
    {
      let out = '';
      const os = [];
      let last = 0;
      const re = /(\*\*|\*)(?=\S)([^*\n]*?\S)\1/g;
      let m;
      while ((m = re.exec(text))) {
        for (let i = last; i < m.index; i++) { out += text[i]; os.push(styles[i]); }
        const start = m.index + m[1].length;
        const add = m[1] === '**' ? { b: true } : { i: true };
        for (let i = 0; i < m[2].length; i++) { out += m[2][i]; os.push(Object.assign({}, styles[start + i], add)); }
        last = m.index + m[0].length;
      }
      for (let i = last; i < text.length; i++) { out += text[i]; os.push(styles[i]); }
      text = out;
      styles = os;
    }
    if (opt.punctuation) {
      ({ text, styles } = regexReplaceStyled(text, styles, /\.{3,}|…{2,}|。{3,}/g, '…'));
      // 곧은 따옴표 → 둥근 따옴표 (짝 맞추기)
      let open = true;
      const chars = text.split('');
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === '\n') open = true;
        if (chars[i] === '"') {
          chars[i] = open ? '“' : '”';
          open = !open;
        }
      }
      text = chars.join('');
    }
    // 앞뒤 공백 제거
    const lead = text.length - text.replace(/^\s+/, '').length;
    const trail = text.length - text.replace(/\s+$/, '').length;
    text = text.slice(lead, text.length - trail);
    styles = styles.slice(lead, styles.length - trail);
    return fromStyled(text, styles);
  }

  /* ---------- 대사 / 서술 / 속마음 ---------- */

  const DQ_PAIRS = { '“': '”', '「': '」', '『': '』', '"': '"', '＂': '＂' };
  const SQ_PAIRS = { '‘': '’' };

  function classifyText(text, styles, options) {
    const opt = Object.assign({ italicThought: true }, options);
    const kinds = new Array(text.length).fill('n');
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      const close = DQ_PAIRS[ch] || SQ_PAIRS[ch];
      if (close) {
        let j = text.indexOf(close, i + 1);
        const nl = text.indexOf('\n', i + 1);
        // 줄이 바뀌면 거기서 끝난 것으로 본다
        if (j === -1 || (nl !== -1 && nl < j)) j = (nl === -1 ? text.length : nl) - 1;
        const kind = DQ_PAIRS[ch] ? 'd' : 't';
        for (let x = i; x <= j; x++) kinds[x] = kind;
        i = j + 1;
        continue;
      }
      if (ch === "'") {
        const prev = text[i - 1];
        if (!prev || /[\s(\[]/.test(prev)) {
          const j = text.indexOf("'", i + 1);
          const nl = text.indexOf('\n', i + 1);
          if (j > i + 1 && (nl === -1 || nl > j)) {
            for (let x = i; x <= j; x++) kinds[x] = 't';
            i = j + 1;
            continue;
          }
        }
      }
      i++;
    }
    if (opt.italicThought) {
      for (let x = 0; x < text.length; x++) if (styles[x] && styles[x].i && kinds[x] === 'n') kinds[x] = 't';
    }
    return kinds;
  }

  function classifyRuns(runs, options) {
    const { text, styles } = toStyled(runs);
    const kinds = classifyText(text, styles, options);
    const forced = options && options.force;
    const ns = styles.map((s, i) => Object.assign({}, s, { k: forced || kinds[i] }));
    return fromStyled(text, ns);
  }

  function kindOf(runs) {
    let d = 0, n = 0, t = 0;
    for (const r of runs) {
      const len = r.t.replace(/\s/g, '').length;
      if (!len) continue;
      if (r.k === 'd') d += len;
      else if (r.k === 't') t += len;
      else n += len;
    }
    if (d && !n && !t) return 'dialogue';
    if (t && !n && !d) return 'thought';
    if (d) return 'mixed';
    return 'narration';
  }

  const SENTENCE_END = /[.!?…~。」』”’)\]！？♡♥]$/u;

  // 대사가 문장 중간에 끼어 있지 않을 때만 따로 줄을 나눈다
  function splitDialogue(runs) {
    const { text, styles } = toStyled(runs);
    if (!text) return [];
    const kinds = styles.map(s => (s.k === 'd' ? 'd' : 'x'));
    // 연속 구간
    const spans = [];
    let s = 0;
    for (let i = 1; i <= text.length; i++) {
      if (i === text.length || kinds[i] !== kinds[s]) {
        spans.push({ start: s, end: i, d: kinds[s] === 'd' });
        s = i;
      }
    }
    const cuts = new Set();
    spans.forEach(sp => {
      if (!sp.d) return;
      const before = text.slice(0, sp.start);
      const after = text.slice(sp.end);
      const beforeTrim = before.replace(/\s+$/, '');
      const okBefore = !beforeTrim || (/\s$/.test(before) && SENTENCE_END.test(beforeTrim));
      const okAfter = !after.trim() || /^\s/.test(after);
      if (okBefore && okAfter) {
        if (beforeTrim) cuts.add(sp.start);
        if (after.trim()) cuts.add(sp.end);
      }
    });
    if (!cuts.size) return [runs];
    const points = [0, ...Array.from(cuts).sort((a, b) => a - b), text.length];
    const pieces = [];
    for (let p = 0; p < points.length - 1; p++) {
      let a = points[p], b = points[p + 1];
      while (a < b && /\s/.test(text[a])) a++;
      while (b > a && /\s/.test(text[b - 1])) b--;
      if (b > a) pieces.push(fromStyled(text.slice(a, b), styles.slice(a, b)));
    }
    return pieces;
  }

  /* ---------- 꾸미기(형광펜·밑줄)와 이름 강조 ---------- */

  // marks: [{ start, end, text, type: 'hl'|'ul', color, wave }]
  function resolveMark(text, mark) {
    if (text.slice(mark.start, mark.end) === mark.text) return [mark.start, mark.end];
    if (!mark.text) return null;
    // 글이 조금 바뀌었으면 가장 가까운 같은 글을 찾는다
    let best = -1, bestD = Infinity, i = -1;
    while ((i = text.indexOf(mark.text, i + 1)) !== -1) {
      const d = Math.abs(i - mark.start);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best === -1 ? null : [best, best + mark.text.length];
  }

  function applyMarks(runs, marks) {
    if (!marks || !marks.length) return runs;
    const st = toStyled(runs);
    const styles = st.styles.map(s => Object.assign({}, s));
    for (const mk of marks) {
      const r = resolveMark(st.text, mk);
      if (!r) continue;
      for (let i = r[0]; i < r[1]; i++) {
        if (mk.type === 'hl') {
          styles[i].hl = mk.color;
          if (mk.alpha !== undefined) styles[i].ha = mk.alpha; else delete styles[i].ha;
        } else {
          styles[i].ul = mk.color;
          styles[i].uw = mk.style || (mk.wave ? 'wave' : 'line');
          if (mk.alpha !== undefined) styles[i].ua = mk.alpha; else delete styles[i].ua;
        }
      }
    }
    return fromStyled(st.text, styles);
  }

  // ★ 강조는 이름 변경과 별개로 적용된다.
  // 대사만: 따옴표로 감싼 대사(k=d), 혹은 사용자가 대사로 지정한 문단에서만 이름에 색을 입힌다.
  // 전체: 옛 버전처럼 서술/속마음까지 포함한다. (이름 문자열을 삭제하거나 바꾸지는 않음)
  function applyEmphasis(runs, names, options) {
    const list = (names || []).map(n => String(n || '').trim()).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!list.length) return runs;
    const dialogueOnly = !options || options.dialogueOnly !== false;
    const st = toStyled(runs);
    const styles = st.styles.slice();
    const re = new RegExp(list.map(escapeRegExp).join('|'), 'g');
    let m;
    while ((m = re.exec(st.text))) {
      const start = m.index, end = start + m[0].length;
      // 이름 일부만 대사 안에 걸쳐 있는 잘못된 매칭은 강조하지 않는다.
      if (!dialogueOnly || styles.slice(start, end).every(x => x && x.k === 'd')) {
        for (let i = start; i < end; i++) styles[i] = Object.assign({}, styles[i], { nm: true });
      }
      if (!m[0]) re.lastIndex++;
    }
    return fromStyled(st.text, styles);
  }

  // 누른 글자가 속한 낱말 범위 (앞뒤 따옴표는 뺀다)
  function wordAt(text, index) {
    if (index < 0 || index >= text.length || /\s/.test(text[index])) return null;
    let a = index, b = index + 1;
    while (a > 0 && !/\s/.test(text[a - 1])) a--;
    while (b < text.length && !/\s/.test(text[b])) b++;
    while (a < b - 1 && /[“"‘'「『(\[]/.test(text[a])) a++;
    while (b > a + 1 && /[”"’'」』)\]]/.test(text[b - 1])) b--;
    return [a, b];
  }

  // 나뉜 조각들이 원래 문단 글의 어디서 시작하는지
  function pieceOffsets(fullText, pieces) {
    let cursor = 0;
    return pieces.map(pc => {
      const t = plainText(pc);
      const at = fullText.indexOf(t, cursor);
      const off = at === -1 ? cursor : at;
      cursor = off + t.length;
      return off;
    });
  }

  const api = {
    applyMarks, applyEmphasis, resolveMark, wordAt, pieceOffsets,
    toStyled, fromStyled, mergeRuns, plainText, styleOf, sameStyle,
    finalSound, adjustParticle, cleanRules, ruleKey, buildMatcher,
    applyReplacements, replaceText, countMatches,
    tidyRuns, classifyRuns, kindOf, splitDialogue, escapeRegExp
  };
  root.CCText = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ======== layout.js ======== */
/*
 * 크랙 익명 캡처 — 조판(줄 나누기·쪽 나누기)
 * 글자 폭 재기(measure)는 밖에서 넣어 준다. 같은 설정이면 미리보기와 저장 결과가 똑같이 나온다.
 */
(function (root) {
  'use strict';

  const FAMILIES = {
    serif: '"CC Serif", "CC Sans", serif',
    sans: '"CC Sans", sans-serif'
  };

  const CLOSING = /^[.,!?…~。、」』”’)\]}%:;！？，．·♡♥]$/u;

  function fontString(style, size, family) {
    const weight = style && style.b ? 700 : 400;
    const italic = style && style.i ? 'italic ' : '';
    return `${italic}${weight} ${size}px ${FAMILIES[family] || FAMILIES.serif}`;
  }

  /* ---------- 줄 나누기 ---------- */

  function tokenize(runs) {
    // 글자 단위 → 낱말/공백/줄바꿈 토큰. si = 문단 안에서의 글자 위치
    const tokens = [];
    let word = null;
    let si = 0;
    const flushWord = () => { if (word) { tokens.push(word); word = null; } };
    for (const run of runs) {
      const style = Object.assign({}, run);
      delete style.t;
      for (const ch of Array.from(run.t)) {
        const at = si;
        si += ch.length;
        if (ch === '\n') { flushWord(); tokens.push({ type: 'br' }); continue; }
        if (/\s/.test(ch)) { flushWord(); tokens.push({ type: 'space', style, si: at }); continue; }
        if (!word) word = { type: 'word', parts: [] };
        const last = word.parts[word.parts.length - 1];
        if (last && sameStyle(last.style, style)) last.text += ch;
        else word.parts.push({ text: ch, style, si: at });
      }
    }
    flushWord();
    return tokens;
  }

  function sameStyle(a, b) {
    if (a === b) return true;
    const ka = Object.keys(a || {}), kb = Object.keys(b || {});
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (a[k] !== b[k]) return false;
    return true;
  }

  /*
   * runs → lines: [{ segs: [{ text, style, x, w }], w }]
   * ctx: { measure(font, text), size, family }
   */
  function breakLines(runs, maxW, ctx, firstIndent) {
    const tokens = tokenize(runs);
    const lines = [];
    let line = { segs: [], w: 0 };
    let pendingSpace = null;
    let indent = firstIndent || 0;
    line.w = indent;

    const m = (style, text) => ctx.measure(fontString(style, ctx.size, ctx.family), text);

    function pushSeg(text, style, w, si) {
      const last = line.segs[line.segs.length - 1];
      if (last && sameStyle(last.style, style) && Math.abs(last.x + last.w - line.w) < 0.01 && last.si + last.text.length === si) {
        last.text += text;
        last.w += w;
      } else {
        line.segs.push({ text, style, x: line.w, w, si });
      }
      line.w += w;
    }
    function newLine() {
      lines.push(line);
      line = { segs: [], w: 0 };
      pendingSpace = null;
    }

    for (const tk of tokens) {
      if (tk.type === 'br') {
        newLine();
        continue;
      }
      if (tk.type === 'space') {
        if (line.segs.length) pendingSpace = tk;
        continue;
      }
      const parts = tk.parts.map(p => ({ text: p.text, style: p.style, si: p.si, w: m(p.style, p.text) }));
      const wordW = parts.reduce((s, p) => s + p.w, 0);
      const spaceW = pendingSpace && line.segs.length ? m(pendingSpace.style, ' ') : 0;

      if (line.w + spaceW + wordW <= maxW + 0.01) {
        if (spaceW) pushSeg(' ', pendingSpace.style, spaceW, pendingSpace.si);
        parts.forEach(p => pushSeg(p.text, p.style, p.w, p.si));
        pendingSpace = null;
        continue;
      }
      if (line.segs.length && wordW <= maxW) {
        // 끝 문장부호 하나 정도는 줄 끝에 매달아 둔다
        const tail = parts.length === 1 && Array.from(parts[0].text).length === 1 && CLOSING.test(parts[0].text);
        if (tail) {
          if (spaceW) pushSeg(' ', pendingSpace.style, spaceW, pendingSpace.si);
          pushSeg(parts[0].text, parts[0].style, parts[0].w, parts[0].si);
          pendingSpace = null;
          continue;
        }
        newLine();
        parts.forEach(p => pushSeg(p.text, p.style, p.w, p.si));
        continue;
      }
      // 한 줄보다 긴 낱말: 글자 단위로 자른다
      if (spaceW && line.segs.length) {
        if (line.w + spaceW < maxW) pushSeg(' ', pendingSpace.style, spaceW, pendingSpace.si);
        else newLine();
      }
      pendingSpace = null;
      for (const p of parts) {
        let at = p.si;
        for (const ch of Array.from(p.text)) {
          const cw = m(p.style, ch);
          if (line.w + cw > maxW + 0.01 && line.segs.length && !CLOSING.test(ch)) newLine();
          pushSeg(ch, p.style, cw, at);
          at += ch.length;
        }
      }
    }
    if (line.segs.length || !lines.length) lines.push(line);
    return lines;
  }

  /* ---------- 흐름 만들기 ---------- */

  const LINE_HEIGHTS = { tight: 1.65, normal: 1.85, loose: 2.05 };
  const WIDTHS = { phone: 540, normal: 680, wide: 820 };
  const RATIOS = { long: 0, '4:5': 1.25, '9:16': 16 / 9, '3:4': 4 / 3 };

  function resolveOptions(o) {
    const width = WIDTHS[o.width] || Number(o.width) || WIDTHS.phone;
    const size = Number(o.fontSize) || 16;
    const lh = LINE_HEIGHTS[o.lineHeight] || Number(o.lineHeight) || LINE_HEIGHTS.normal;
    const margin = Math.round(Math.max(28, Math.min(64, width * 0.075)));
    return {
      width,
      size,
      lineH: Math.round(size * lh * 100) / 100,
      margin,
      family: o.font || 'serif',
      pageHeight: Number(o.pageHeight) || 0,
      dialogueStyle: o.dialogueStyle || 'bar',
      indent: !!o.indent,
      showLabels: o.showLabels !== false,
      pageMode: RATIOS[o.pageMode] !== undefined ? o.pageMode : 'long',
      maxLongHeight: o.maxLongHeight || 5400,
      paraGap: Math.round(size * 0.85),
      turnGap: Math.round(size * 2.1),
      title: String(o.title || '').trim(),
      pageNumbers: o.pageNumbers !== false
    };
  }

  /*
   * model: { turns: [{ id, role, label, blocks: [...] }] }
   * block: { pid, mi, type: 'p', kind, runs, forceBreak }
   *        { pid, mi, type: 'img', key, w, h }
   *        { pid, mi, type: 'hr' }
   *        { pid, mi, type: 'status', runs }
   */
  function buildFlow(model, opt, measure) {
    const flow = [];
    const blocks = {};
    const turns = {};
    const contentW = opt.width - opt.margin * 2;
    const S = opt.size;

    const textCtx = { measure, size: S, family: opt.family };
    const smallCtx = { measure, size: Math.round(S * 0.8 * 10) / 10, family: 'sans' };
    const labelSize = Math.round(S * 0.78 * 10) / 10;

    if (opt.title) {
      const titleSize = Math.round(S * 1.35);
      const tctx = { measure, size: titleSize, family: opt.family };
      const lines = breakLines([{ t: opt.title, b: true }], contentW, tctx, 0);
      lines.forEach((ln, i) => flow.push({
        kind: 'line', h: Math.round(titleSize * 1.5), before: 0, x: 0, line: ln,
        size: titleSize, family: opt.family, role: 'title', keepNext: true, isTitle: true
      }));
      flow.push({ kind: 'rule', h: 1, before: Math.round(S * 0.9), x: 0, w: contentW, keepNext: true });
      flow.push({ kind: 'space', h: Math.round(S * 1.4), before: 0 });
    }

    let firstTurn = true;
    for (const turn of model.turns) {
      if (!turn.blocks.length) continue;
      const isUser = turn.role === 'user';
      const card = isUser;
      const cardPadX = card ? Math.round(S * 1.0) : 0;
      const cardPadY = card ? Math.round(S * 0.85) : 0;
      const turnX = cardPadX;
      const turnW = contentW - cardPadX * 2;
      turns[turn.id] = { card, x: 0, w: contentW, role: turn.role };

      const turnStartIndex = flow.length;
      const forceTurn = turn.blocks[0] && turn.blocks[0].forceBreak;
      const gapBefore = firstTurn ? 0 : opt.turnGap;
      firstTurn = false;

      if (card) flow.push({ kind: 'pad', h: cardPadY, before: gapBefore, turn: turn.id, keepNext: true });

      if (opt.showLabels && turn.label) {
        flow.push({
          kind: 'label', h: Math.round(labelSize * 1.9), before: card ? 0 : gapBefore, x: turnX,
          text: turn.label, size: labelSize, role: turn.role, turn: turn.id, keepNext: true
        });
      }

      turn.blocks.forEach((b0, bi) => {
        let b = b0;
        const bid = turn.id + ':' + bi;
        const first = bi === 0;
        // 첫 블록의 쪽 나누기는 차례(이름표 포함) 맨 앞에서 처리한다
        b = Object.assign({}, b, { forceBreak: first ? false : b.forceBreak });
        let before = first ? (flow.length > turnStartIndex ? Math.round(S * 0.15) : gapBefore) : opt.paraGap;

        if (b.type === 'p') {
          const isDialogueBlock = b.kind === 'dialogue';
          let deco = null;
          if (isDialogueBlock && opt.dialogueStyle === 'bar') deco = 'bar';
          if (isDialogueBlock && opt.dialogueStyle === 'bubble') deco = 'bubble';
          const barGap = Math.round(S * 0.95);
          const padX = deco === 'bubble' ? Math.round(S * 0.85) : 0;
          const padY = deco === 'bubble' ? Math.round(S * 0.5) : 0;
          const x = turnX + (deco === 'bar' ? barGap : 0) + padX;
          const avail = turnW - (deco === 'bar' ? barGap : 0) - padX * 2;
          const indent = opt.indent && (b.kind === 'narration' || b.kind === 'mixed') ? S : 0;
          const lines = breakLines(b.runs, avail, textCtx, indent);
          const maxLineW = Math.max(...lines.map(l => l.w), S);
          blocks[bid] = {
            deco, pid: b.pid, turn: turn.id, color: b.color || null,
            x: turnX, w: deco === 'bubble' ? Math.min(turnW, maxLineW + padX * 2) : turnW,
            barX: turnX + Math.round(S * 0.12)
          };
          if (deco === 'bubble') {
            flow.push({ kind: 'pad', h: padY, before, block: bid, turn: turn.id, pid: b.pid, keepNext: true, forceBreak: b.forceBreak });
            before = 0;
          }
          lines.forEach((ln, li) => {
            flow.push({
              kind: 'line', h: opt.lineH, before: li === 0 ? before : 0, x, line: ln,
              size: S, family: opt.family, block: bid, turn: turn.id, pid: b.pid, mi: b.mi, off: b.off || 0,
              keepNext: li === 0 && lines.length > 2,
              forceBreak: li === 0 && deco !== 'bubble' ? b.forceBreak : false
            });
          });
          if (deco === 'bubble') flow.push({ kind: 'pad', h: padY, before: 0, block: bid, turn: turn.id, pid: b.pid });
        } else if (b.type === 'status') {
          const padX = Math.round(S * 0.8), padY = Math.round(S * 0.6);
          const lines = breakLines(b.runs, turnW - padX * 2, smallCtx, 0);
          blocks[bid] = { deco: 'status', pid: b.pid, turn: turn.id, x: turnX, w: turnW };
          flow.push({ kind: 'pad', h: padY, before, block: bid, turn: turn.id, pid: b.pid, keepNext: true, forceBreak: b.forceBreak });
          lines.forEach(ln => flow.push({
            kind: 'line', h: Math.round(smallCtx.size * 1.6), before: 0, x: turnX + padX, line: ln,
            size: smallCtx.size, family: 'sans', block: bid, turn: turn.id, pid: b.pid, mi: b.mi, status: true, off: 0
          }));
          flow.push({ kind: 'pad', h: padY, before: 0, block: bid, turn: turn.id, pid: b.pid });
        } else if (b.type === 'img') {
          let w = Math.min(turnW, b.w || turnW);
          let h = b.w ? Math.round((b.h / b.w) * w) : Math.round(w * 0.75);
          flow.push({ kind: 'img', h, w, before, x: turnX + (turnW - w) / 2, key: b.key, pid: b.pid, mi: b.mi, turn: turn.id, ratio: b.h / b.w, maxW: turnW, forceBreak: b.forceBreak });
        } else if (b.type === 'hr') {
          flow.push({ kind: 'hr', h: Math.round(S * 1.4), before, x: turnX, w: turnW, pid: b.pid, mi: b.mi, turn: turn.id, forceBreak: b.forceBreak });
        }
      });

      if (card) flow.push({ kind: 'pad', h: cardPadY, before: 0, turn: turn.id });
      if (forceTurn) flow[turnStartIndex].forceBreak = true;
    }
    return { flow, blocks, turns, contentW };
  }

  /* ---------- 쪽 나누기 ---------- */

  function paginate(flowData, opt) {
    const { flow } = flowData;
    const ratio = RATIOS[opt.pageMode];
    const pageH = ratio ? (opt.pageHeight || Math.round(opt.width * ratio)) : 0;
    const contentH = ratio ? pageH - opt.margin * 2 : opt.maxLongHeight - opt.margin * 2;

    // 고정 비율이면 너무 큰 그림은 줄인다
    flow.forEach(it => {
      if (it.kind === 'img' && it.h > contentH * 0.92) {
        it.h = Math.round(contentH * 0.92);
        it.w = Math.round(it.h / (it.ratio || 1));
        it.x = it.x + 0; // 가운데 정렬은 아래에서 다시
      }
    });

    const pages = [];
    let cur = { items: [], used: 0 };
    const pushPage = () => { pages.push(cur); cur = { items: [], used: 0 }; };

    for (let i = 0; i < flow.length; i++) {
      const it = flow[i];
      if (it.forceBreak && cur.items.length) pushPage();
      const before = cur.items.length ? it.before : 0;
      // 다음 것과 붙어 있어야 하는 묶음 높이
      let chain = before + it.h;
      if (it.keepNext) {
        let j = i;
        while (flow[j] && flow[j].keepNext && flow[j + 1]) {
          chain += flow[j + 1].before + flow[j + 1].h;
          j++;
          if (chain > contentH * 0.5) break;
        }
      }
      if (cur.items.length && cur.used + chain > contentH + 0.01) {
        pushPage();
        cur.items.push(Object.assign({}, it, { y: 0 }));
        cur.used = it.h;
        continue;
      }
      if (!cur.items.length && (it.kind === 'space' || it.kind === 'pad') && !it.block && it.turn && pages.length) {
        // 쪽 맨 위에 남는 카드 여백은 그대로 둔다(카드 모양 유지)
      }
      cur.items.push(Object.assign({}, it, { y: cur.used + before }));
      cur.used += before + it.h;
    }
    if (cur.items.length) pages.push(cur);

    return pages.map((p, idx) => ({
      index: idx,
      w: opt.width,
      h: ratio ? pageH : Math.round(p.used + opt.margin * 2),
      items: p.items
    }));
  }

  /* ---------- 장식(카드·말풍선·세로선) 위치 ---------- */

  function decorate(pages, flowData, opt) {
    pages.forEach(page => {
      const decos = [];
      const groups = new Map();
      const add = (key, it) => {
        if (!groups.has(key)) groups.set(key, { top: Infinity, bottom: -Infinity, items: [] });
        const g = groups.get(key);
        g.top = Math.min(g.top, it.y);
        g.bottom = Math.max(g.bottom, it.y + it.h);
        g.items.push(it);
      };
      page.items.forEach(it => {
        if (it.turn && flowData.turns[it.turn] && flowData.turns[it.turn].card) add('t|' + it.turn, it);
        if (it.block) add('b|' + it.block, it);
      });
      groups.forEach((g, key) => {
        const [type, id] = key.split('|');
        if (type === 't') {
          const t = flowData.turns[id];
          decos.push({ type: 'card', x: t.x, y: g.top, w: t.w, h: g.bottom - g.top, role: t.role, z: 0 });
        } else {
          const b = flowData.blocks[id];
          if (!b || !b.deco) return;
          if (b.deco === 'bar') {
            const lines = g.items.filter(x => x.kind === 'line');
            if (!lines.length) return;
            const top = lines[0].y + opt.lineH * 0.2;
            const bottom = lines[lines.length - 1].y + opt.lineH * 0.8;
            decos.push({ type: 'bar', x: b.barX, y: top, w: Math.max(2, Math.round(opt.size * 0.17)), h: bottom - top, z: 1, color: b.color });
          } else {
            decos.push({ type: b.deco, x: b.x, y: g.top, w: b.w, h: g.bottom - g.top, z: 1, pid: b.pid, color: b.color });
          }
        }
      });
      // 고정 비율 쪽에서 크게 줄인 그림 가운데 맞추기
      page.items.forEach(it => {
        if (it.kind === 'img' && it.maxW) {
          const t = flowData.turns[it.turn];
          const turnX = t && t.card ? Math.round(opt.size) : 0;
          it.x = turnX + (it.maxW - it.w) / 2;
        }
      });
      decos.sort((a, b) => a.z - b.z);
      page.decos = decos;
    });
    return pages;
  }

  function layout(model, options, measure) {
    const opt = resolveOptions(options || {});
    const flowData = buildFlow(model, opt, measure);
    const pages = decorate(paginate(flowData, opt), flowData, opt);
    return { pages, opt };
  }

  // 미리보기에서 누른 곳 찾기 (쪽 기준 좌표)
  function hitTest(page, opt, x, y) {
    const cy = y - opt.margin;
    const cx = x - opt.margin;
    let best = null;
    for (const it of page.items) {
      if (!it.pid) continue;
      const top = it.y - (it.kind === 'line' ? 0 : 2);
      const bottom = it.y + it.h;
      if (cy >= top - 4 && cy <= bottom + 4 && cx >= -opt.margin && cx <= opt.width) {
        best = it;
        if (cy >= top && cy <= bottom) break;
      }
    }
    return best;
  }

  // 줄 안 x 위치 → 문단 안 글자 위치
  function charAt(item, x, measure) {
    const segs = item.line.segs;
    if (!segs.length) return null;
    const lx = x - item.x;
    let seg = segs[0];
    for (const sg of segs) { if (lx >= sg.x) seg = sg; }
    if (lx > seg.x + seg.w) return { index: item.off + seg.si + seg.text.length - 1, seg };
    const font = fontString(seg.style, item.size, item.family);
    let acc = seg.x, idx = 0;
    for (const ch of Array.from(seg.text)) {
      const w = measure(font, ch);
      if (lx < acc + w) break;
      acc += w;
      idx += ch.length;
    }
    idx = Math.min(idx, seg.text.length - 1);
    return { index: item.off + seg.si + idx, seg };
  }

  const api = { charAt, fontString, breakLines, tokenize, resolveOptions, layout, hitTest, FAMILIES, WIDTHS, RATIOS, LINE_HEIGHTS };
  root.CCLayout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ======== render.js ======== */
/*
 * 크랙 익명 캡처 — 그리기 (canvas)
 */
(function (root) {
  'use strict';
  const L = root.CCLayout || (typeof require !== 'undefined' ? require('./layout.js') : null);

  const T = (o) => Object.assign({ hlAlpha: 0.34, cardLabel: o.accent, charLabel: o.accent }, o);
  // decor: 꾸밈 모드일 때 깔리는 무늬
  const THEMES = {
    paper: T({ name: '종이', decor: 'book', bg: '#FBF7EF', frame: '#E9E1D2', text: '#2A2018', narration: '#5E5146', thought: '#8C7B6B', accent: '#B9783A', dialogueColor: '#7A3B12', bubble: 'rgba(185,120,58,0.11)', card: '#F2E9DA', status: 'rgba(94,81,70,0.07)', rule: 'rgba(94,81,70,0.22)', nameColor: '#C2410C', sticker: '#E2457A', page: '#A39484' }),
    white: T({ name: '화이트', decor: 'dots', bg: '#FFFFFF', frame: '#E6E8EE', text: '#111114', narration: '#4A4A50', thought: '#8E8E93', accent: '#007AFF', dialogueColor: '#0A5BD3', bubble: '#F0F1F5', card: '#EEF4FF', status: '#F4F4F6', rule: 'rgba(60,60,67,0.16)', nameColor: '#D6336C', sticker: '#E2457A', page: '#AEAEB2' }),
    cream: T({ name: '크림', decor: 'sparkle', bg: '#FFF9EC', frame: '#F0E4C8', text: '#3A2A1A', narration: '#6B5A47', thought: '#9A8670', accent: '#C8963E', dialogueColor: '#8A4B12', bubble: 'rgba(200,150,62,0.13)', card: '#F6ECD6', status: 'rgba(107,90,71,0.07)', rule: 'rgba(107,90,71,0.2)', nameColor: '#C2410C', sticker: '#E2457A', page: '#B0A08A' }),
    rose: T({ name: '로즈', decor: 'hearts', bg: '#FFF6F6', frame: '#F4E0E3', text: '#33201F', narration: '#6B5150', thought: '#9C8180', accent: '#DB5C7A', dialogueColor: '#B23A58', bubble: 'rgba(219,92,122,0.10)', card: '#FBE7EA', status: 'rgba(107,81,80,0.07)', rule: 'rgba(107,81,80,0.2)', nameColor: '#9B2C5E', sticker: '#D63B6E', page: '#B59A9A' }),
    sakura: T({ name: '벚꽃', decor: 'petals', bg: '#FFF8FA', bgTop: '#FFEFF4', frame: '#F7DDE5', text: '#3A2329', narration: '#6E5258', thought: '#A38A90', accent: '#E58AA6', dialogueColor: '#B8456A', bubble: 'rgba(229,138,166,0.12)', card: '#FCE8EE', status: 'rgba(110,82,88,0.07)', rule: 'rgba(110,82,88,0.18)', nameColor: '#C2335E', sticker: '#E2457A', page: '#B99AA2' }),
    sunset: T({ name: '노을', decor: 'sun', bg: '#FBEFF3', bgTop: '#FFE6D2', frame: '#EED5D2', text: '#35202B', narration: '#6A5059', thought: '#A0848E', accent: '#E8865A', dialogueColor: '#B44A3A', bubble: 'rgba(232,134,90,0.12)', card: '#F8E1E1', status: 'rgba(106,80,89,0.07)', rule: 'rgba(106,80,89,0.18)', nameColor: '#C2335E', sticker: '#E2457A', page: '#B39AA2' }),
    sage: T({ name: '세이지', decor: 'leaves', bg: '#F4F7F2', frame: '#DCE5D9', text: '#1F2A22', narration: '#4E5C52', thought: '#84918A', accent: '#5E8C6A', dialogueColor: '#2F6B45', bubble: 'rgba(94,140,106,0.12)', card: '#E4EDE3', status: 'rgba(78,92,82,0.07)', rule: 'rgba(78,92,82,0.2)', nameColor: '#B4532A', sticker: '#E2457A', page: '#98A59C' }),
    lavender: T({ name: '라벤더', decor: 'bokeh', bg: '#F8F5FD', frame: '#E5DDF3', text: '#2A2238', narration: '#5D5370', thought: '#948AA6', accent: '#8B6FD6', dialogueColor: '#6A44C2', bubble: 'rgba(139,111,214,0.12)', card: '#ECE6F8', status: 'rgba(93,83,112,0.07)', rule: 'rgba(93,83,112,0.2)', nameColor: '#D6336C', sticker: '#D6336C', page: '#A79FB8' }),
    dark: T({ name: '다크', decor: 'vignette', bg: '#121214', frame: '#050506', text: '#F5F5F7', narration: '#B9B9C0', thought: '#8A8A92', accent: '#0A84FF', dialogueColor: '#6CC4FF', bubble: '#25252A', card: '#1B2536', status: '#1E1E22', rule: 'rgba(235,235,245,0.14)', nameColor: '#FF8FB1', sticker: '#FF7AA8', page: '#6E6E75', hlAlpha: 0.4, dark: true }),
    night: T({ name: '밤하늘', decor: 'stars', bg: '#0F1529', bgTop: '#151D38', frame: '#070B18', text: '#EEF1FA', narration: '#B9C0D6', thought: '#8890AA', accent: '#8FA8FF', dialogueColor: '#A9C1FF', bubble: 'rgba(143,168,255,0.12)', card: '#18213D', status: 'rgba(185,192,214,0.08)', rule: 'rgba(185,192,214,0.14)', nameColor: '#FFB4CB', sticker: '#FF8FB1', page: '#6C7594', hlAlpha: 0.4, dark: true })
  };

  // 예전 이름으로 저장된 색도 읽을 수 있게
  const NAMED = { yellow: '#FFD60A', pink: '#FF6BA6', green: '#34C778', blue: '#409CFF' };
  const PALETTE = [
    ['#FFD60A', '노랑'], ['#FF9F0A', '주황'], ['#FF453A', '빨강'], ['#FF6BA6', '분홍'], ['#B57BFF', '보라'],
    ['#409CFF', '파랑'], ['#5AC8FA', '하늘'], ['#34C778', '초록'], ['#1C1C1E', '검정']
  ];

  function rgba(color, alpha) {
    let c = NAMED[color] || color || '#FFD60A';
    if (c[0] === '#' && c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    const n = parseInt(c.slice(1, 7), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function textColor(style, theme, look, item) {
    if (item.status) return theme.thought;
    if (item.isTitle) return theme.text;
    if (style.nm) return theme.nameColor;
    const k = style.k;
    if (k === 'd') return look.dialogueStyle === 'color' ? theme.dialogueColor : theme.text;
    if (k === 't') return theme.thought;
    return look.muteNarration === false ? theme.text : theme.narration;
  }

  const metricCache = new Map();
  function clearMetrics() { metricCache.clear(); }
  function metrics(ctx, font) {
    if (metricCache.has(font)) return metricCache.get(font);
    ctx.save();
    ctx.font = font;
    const m = ctx.measureText('가Hg');
    ctx.restore();
    const v = { asc: m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || 12, desc: m.fontBoundingBoxDescent || m.actualBoundingBoxDescent || 4 };
    metricCache.set(font, v);
    return v;
  }

  /* ---------- 배경 ---------- */
  function rand(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function sparkle(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.fill();
  }
  function heart(ctx, x, y, s, rot, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.35);
    ctx.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.45, -s * 1.05, 0, -s * 0.45);
    ctx.bezierCurveTo(s * 0.45, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.35);
    ctx.fill();
    ctx.restore();
  }
  function petal(ctx, x, y, s, rot, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.8, -s * 0.6, s * 0.6, s * 0.7, 0, s);
    ctx.bezierCurveTo(-s * 0.6, s * 0.7, -s * 0.8, -s * 0.6, -s * 0.12, -s * 0.85);
    ctx.lineTo(0, -s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function sprig(ctx, x, y, size, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size * 0.025;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(size * 0.5, -size * 0.12, size, 0);
    ctx.stroke();
    for (let i = 1; i <= 5; i++) {
      const t = i / 6, px = size * t, py = -size * 0.12 * 4 * t * (1 - t) * 0.5;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(side * 0.75 - 0.15);
        ctx.beginPath();
        ctx.ellipse(size * 0.07, 0, size * 0.09 * (1.1 - t * 0.4), size * 0.035, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawStars(ctx, w, h, seed) {
    const r = rand(seed * 7919 + 17);
    const n = Math.round((w * h) / 2600);
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h, s = 0.3 + r() * 0.7, a = 0.06 + r() * 0.22;
      ctx.fillStyle = `rgba(230,236,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    const m = Math.max(2, Math.round((w * h) / 90000));
    for (let i = 0; i < m; i++) {
      const x = r() * w, y = r() * h, s = 2 + r() * 2.2, a = 0.16 + r() * 0.14;
      ctx.strokeStyle = `rgba(235,240,255,${a})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
      ctx.stroke();
      ctx.fillStyle = `rgba(245,248,255,${a + 0.15})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (seed === 1) {
      // 첫 장 오른쪽 위 옅은 초승달
      const cx = w - 44, cy = 40, rr = 11;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.rect(cx - rr - 2, cy - rr - 2, rr * 2 + 4, rr * 2 + 4);
      ctx.arc(cx + rr * 0.5, cy - rr * 0.35, rr * 0.92, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244,238,210,0.3)';
      ctx.fill('evenodd');
      ctx.restore();
    }
  }
  function drawGrain(ctx, w, h, theme, seed, amount) {
    const r = rand(seed * 104729 + 3);
    const n = Math.round((w * h) / 90 * (amount || 1));
    for (let i = 0; i < n; i++) {
      const a = 0.018 + r() * 0.035;
      ctx.fillStyle = theme.dark ? `rgba(255,255,255,${a})` : `rgba(90,70,40,${a})`;
      ctx.fillRect(r() * w, r() * h, 0.6 + r() * 0.9, 0.6 + r() * 0.9);
    }
  }

  function drawDecor(ctx, page, theme) {
    const w = page.w, h = page.h, seed = page.index + 1;
    const r = rand(seed * 2654435 + 97);
    const area = w * h;
    switch (theme.decor) {
      case 'stars': drawStars(ctx, w, h, seed); break;
      case 'book': {
        drawGrain(ctx, w, h, theme, seed, 0.6);
        ctx.strokeStyle = theme.rule;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(12.5, 12.5, w - 25, h - 25);
        ctx.lineWidth = 0.5;
        ctx.strokeRect(16.5, 16.5, w - 33, h - 33);
        for (const [x, y] of [[14.5, 14.5], [w - 14.5, 14.5], [14.5, h - 14.5], [w - 14.5, h - 14.5]]) {
          ctx.fillStyle = theme.accent;
          ctx.globalAlpha = 0.45;
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.2, -2.2, 4.4, 4.4); ctx.restore();
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'dots': {
        ctx.fillStyle = 'rgba(60,60,67,0.09)';
        for (let y = 12; y < h; y += 18) for (let x = 12; x < w; x += 18) { ctx.beginPath(); ctx.arc(x, y, 0.75, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'sparkle': {
        const n = Math.max(6, Math.round(area / 26000));
        for (let i = 0; i < n; i++) sparkle(ctx, r() * w, r() * h, 2.5 + r() * 4.5, `rgba(200,150,62,${0.14 + r() * 0.2})`);
        for (let i = 0; i < n * 2; i++) { ctx.fillStyle = `rgba(200,150,62,${0.1 + r() * 0.12})`; ctx.beginPath(); ctx.arc(r() * w, r() * h, 0.6 + r() * 0.8, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'hearts': {
        const n = Math.max(8, Math.round(area / 16000));
        for (let i = 0; i < n; i++) heart(ctx, r() * w, r() * h, 4 + r() * 6, (r() - 0.5) * 0.9, `rgba(219,92,122,${0.12 + r() * 0.14})`);
        break;
      }
      case 'petals': {
        const n = Math.max(10, Math.round(area / 13000));
        for (let i = 0; i < n; i++) petal(ctx, r() * w, r() * h, 3.5 + r() * 5, r() * Math.PI * 2, `rgba(240,140,170,${0.2 + r() * 0.2})`);
        break;
      }
      case 'sun': {
        const cx = w * 0.82, cy = Math.min(h * 0.12, 90), R = Math.min(w, 420) * 0.32;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, 'rgba(255,190,140,0.45)');
        g.addColorStop(0.45, 'rgba(255,175,150,0.18)');
        g.addColorStop(1, 'rgba(255,175,150,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, Math.min(h, cy + R));
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineCap = 'round';
        const n = Math.max(3, Math.round(area / 90000));
        for (let i = 0; i < n; i++) {
          const y = 30 + r() * (h - 60), x = r() * w * 0.8, len = 40 + r() * 70;
          ctx.lineWidth = 1.2 + r() * 1.4;
          ctx.globalAlpha = 0.5 + r() * 0.4;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + len * 0.25, y + 6); ctx.lineTo(x + len * 0.85, y + 6); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'leaves': {
        const c = 'rgba(94,140,106,0.22)';
        sprig(ctx, w - 6, 8, 96, Math.PI * 0.78, c);
        sprig(ctx, w - 2, 34, 64, Math.PI * 0.9, c);
        sprig(ctx, 6, h - 8, 96, -Math.PI * 0.22, c);
        sprig(ctx, 2, h - 34, 64, -Math.PI * 0.1, c);
        break;
      }
      case 'bokeh': {
        const n = Math.max(4, Math.round(area / 50000));
        for (let i = 0; i < n; i++) {
          const x = r() * w, y = r() * h, R = 26 + r() * 54;
          const g = ctx.createRadialGradient(x, y, 0, x, y, R);
          g.addColorStop(0, `rgba(170,140,235,${0.1 + r() * 0.08})`);
          g.addColorStop(1, 'rgba(170,140,235,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - R, y - R, R * 2, R * 2);
        }
        for (let i = 0; i < n; i++) sparkle(ctx, r() * w, r() * h, 2 + r() * 3, `rgba(139,111,214,${0.18 + r() * 0.15})`);
        break;
      }
      case 'vignette': {
        drawGrain(ctx, w, h, theme, seed, 0.8);
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        break;
      }
    }
  }

  function drawBackground(ctx, page, theme, look) {
    if (theme.bgTop) {
      const g = ctx.createLinearGradient(0, 0, 0, Math.min(page.h, 1400));
      g.addColorStop(0, theme.bgTop);
      g.addColorStop(1, theme.bg);
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, page.w, page.h);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, page.w, Math.min(page.h, 1400));
    } else {
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, page.w, page.h);
    }
    if (look.decor !== 'simple') drawDecor(ctx, page, theme);
    if (look.pattern === 'grain') drawGrain(ctx, page.w, page.h, theme, page.index + 1);
  }

  /* ---------- 형광펜·밑줄 ---------- */
  function runsOf(it, key) {
    const out = [];
    let run = null;
    for (const seg of it.line.segs) {
      const s = seg.style || {};
      const v = s[key];
      const sig = v ? [v, s[key === 'hl' ? 'ha' : 'ua'], s.uw].join('|') : null;
      if (sig && run && run.sig === sig && Math.abs(run.x + run.w - seg.x) < 0.5) run.w += seg.w;
      else { if (run) out.push(run); run = sig ? { sig, color: v, alpha: s[key === 'hl' ? 'ha' : 'ua'], style: s.uw, x: seg.x, w: seg.w } : null; }
    }
    if (run) out.push(run);
    return out;
  }

  function lineGeom(ctx, it) {
    const mt = metrics(ctx, L.fontString({}, it.size, it.family));
    const glyphH = mt.asc + mt.desc;
    const baseline = it.y + (it.h - glyphH) / 2 + mt.asc;
    return { mt, glyphH, top: it.y + (it.h - glyphH) / 2, baseline };
  }

  function drawMarksBehind(ctx, it, theme) {
    const g = lineGeom(ctx, it);
    for (const r of runsOf(it, 'hl')) {
      ctx.fillStyle = rgba(r.color, r.alpha !== undefined ? r.alpha : theme.hlAlpha);
      roundRect(ctx, it.x + r.x - 1.5, g.top + g.glyphH * 0.08, r.w + 3, g.glyphH * 0.9, 3);
      ctx.fill();
    }
    // 형광 밑줄: 글자 아래쪽 절반만
    for (const r of runsOf(it, 'ul')) {
      if (r.style !== 'marker') continue;
      const a = (r.alpha !== undefined ? r.alpha : 0.85) * 0.55;
      ctx.fillStyle = rgba(r.color, a);
      const y0 = g.baseline - g.mt.asc * 0.38;
      roundRect(ctx, it.x + r.x - 1, y0, r.w + 2, g.baseline + g.mt.desc * 0.35 - y0, 2);
      ctx.fill();
    }
  }

  function drawUnderlines(ctx, it) {
    const g = lineGeom(ctx, it);
    const y = g.baseline + Math.max(2, g.mt.desc * 0.55);
    for (const r of runsOf(it, 'ul')) {
      if (r.style === 'marker') continue;
      ctx.save();
      ctx.strokeStyle = rgba(r.color, r.alpha !== undefined ? r.alpha : 0.85);
      const lw = Math.max(1.3, it.size * 0.09);
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      const x0 = it.x + r.x, x1 = it.x + r.x + r.w;
      ctx.beginPath();
      if (r.style === 'wave') {
        const amp = it.size * 0.11, len = it.size * 0.42;
        ctx.moveTo(x0, y);
        let i = 0;
        for (let x = x0; x < x1; x += len / 2, i++) {
          const nx = Math.min(x1, x + len / 2);
          ctx.quadraticCurveTo((x + nx) / 2, y + (i % 2 ? amp : -amp) * 1.6, nx, y);
        }
      } else if (r.style === 'dot') {
        ctx.setLineDash([0.01, lw * 2.6]);
        ctx.lineWidth = lw * 1.5;
        ctx.moveTo(x0 + lw, y); ctx.lineTo(x1, y);
      } else if (r.style === 'double') {
        ctx.lineWidth = lw * 0.75;
        ctx.moveTo(x0, y - lw * 0.9); ctx.lineTo(x1, y - lw * 0.9);
        ctx.moveTo(x0, y + lw * 1.1); ctx.lineTo(x1, y + lw * 1.1);
      } else {
        ctx.moveTo(x0, y); ctx.lineTo(x1, y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------- 스티커 ---------- */
  const STICKER_SIZES = { s: 1.35, m: 1.85, l: 2.5 };

  function stickerLayout(ctx, st, opt) {
    const base = opt.size * (STICKER_SIZES[st.size] || STICKER_SIZES.m) * (st.style === 'hand' ? 1 : 0.62);
    const font = st.style === 'hand' ? `400 ${base}px "CC Hand", "CC Sans", sans-serif` : `700 ${base}px "CC Sans", sans-serif`;
    ctx.save();
    ctx.font = font;
    const lines = String(st.text || '').split('\n');
    const widths = lines.map(l => ctx.measureText(l).width);
    ctx.restore();
    const lineH = base * (st.style === 'hand' ? 1.05 : 1.3);
    const padX = st.style === 'hand' ? base * 0.15 : base * 0.75;
    const padY = st.style === 'hand' ? base * 0.1 : base * 0.45;
    const w = Math.max(...widths, base) + padX * 2;
    const h = lines.length * lineH + padY * 2;
    return { font, lines, lineH, padX, padY, w, h, base };
  }

  function drawSticker(ctx, st, opt, theme) {
    const lay = stickerLayout(ctx, st, opt);
    const rot = (st.rot || 0) * Math.PI / 180;
    st.box = { cx: st.x, cy: st.y, w: lay.w, h: lay.h, rot };
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.rotate(rot);
    const x0 = -lay.w / 2, y0 = -lay.h / 2;
    let fg = theme.sticker;
    if (st.style === 'bubble') {
      ctx.shadowColor = 'rgba(0,0,0,0.14)';
      ctx.shadowBlur = lay.base * 0.5;
      ctx.shadowOffsetY = lay.base * 0.12;
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, x0, y0, lay.w, lay.h, Math.min(lay.h / 2, lay.base * 1.1));
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x0 + lay.w * 0.22, y0 + lay.h - 1);
      ctx.lineTo(x0 + lay.w * 0.16, y0 + lay.h + lay.base * 0.55);
      ctx.lineTo(x0 + lay.w * 0.34, y0 + lay.h - 1);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      fg = '#1C1C1E';
    } else if (st.style === 'neon') {
      ctx.shadowColor = theme.sticker;
      ctx.shadowBlur = lay.base * 0.8;
      ctx.fillStyle = theme.sticker;
      roundRect(ctx, x0, y0, lay.w, lay.h, lay.h / 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      fg = '#FFFFFF';
    }
    ctx.font = lay.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lay.lines.forEach((ln, i) => {
      const y = y0 + lay.padY + lay.lineH * (i + 0.5);
      if (st.style === 'hand') {
        ctx.lineJoin = 'round';
        ctx.lineWidth = lay.base * 0.09;
        ctx.strokeStyle = theme.bg;
        ctx.strokeText(ln, 0, y);
      }
      ctx.fillStyle = fg;
      ctx.fillText(ln, 0, y);
    });
    ctx.restore();
  }

  /*
   * 한 쪽 그리기. ctx 에는 배율이 이미 걸려 있다.
   * look: { theme, dialogueStyle, muteNarration, pageNumbers, pattern, frame }
   * page.frame 이 있으면 바깥 여백 + 카드 모양으로 그린다.
   */
  function renderPage(ctx, page, opt, look, images, totalPages) {
    const theme = THEMES[look.theme] || THEMES.paper;
    const F = page.frame || 0;
    ctx.save();
    if (F) {
      ctx.fillStyle = theme.frame;
      ctx.fillRect(0, 0, page.w + F * 2, page.h + F * 2);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.16)';
      ctx.shadowBlur = F * 0.9;
      ctx.shadowOffsetY = F * 0.25;
      ctx.fillStyle = theme.bg;
      roundRect(ctx, F, F, page.w, page.h, 14);
      ctx.fill();
      ctx.restore();
      roundRect(ctx, F, F, page.w, page.h, 14);
      ctx.clip();
      ctx.translate(F, F);
    }
    drawBackground(ctx, page, theme, look);
    renderContent(ctx, page, opt, look, images, totalPages, theme);
    ctx.restore();
  }

  function renderContent(ctx, page, opt, look, images, totalPages, theme) {
    const M = opt.margin;
    ctx.save();
    ctx.translate(M, M);
    ctx.textBaseline = 'alphabetic';

    // 줄 노트
    if (look.pattern === 'lines') {
      ctx.fillStyle = theme.rule;
      for (const it of page.items) {
        if (it.kind !== 'line' || it.status || it.isTitle) continue;
        const g = lineGeom(ctx, it);
        ctx.fillRect(-M * 0.35, Math.round(g.baseline + g.mt.desc + (it.h - g.glyphH) * 0.3), page.w - M * 1.3, 0.8);
      }
    }

    // 1) 장식
    for (const d of page.decos || []) {
      if (d.type === 'card') { ctx.fillStyle = theme.card; roundRect(ctx, d.x, d.y, d.w, d.h, Math.round(opt.size * 1.05)); ctx.fill(); }
      else if (d.type === 'bubble') { ctx.fillStyle = d.color ? rgba(d.color, theme.dark ? 0.16 : 0.11) : theme.bubble; roundRect(ctx, d.x, d.y, d.w, d.h, Math.round(opt.size * 0.95)); ctx.fill(); }
      else if (d.type === 'status') { ctx.fillStyle = theme.status; roundRect(ctx, d.x, d.y, d.w, d.h, Math.round(opt.size * 0.7)); ctx.fill(); }
      else if (d.type === 'bar') { ctx.fillStyle = d.color || theme.accent; ctx.globalAlpha = 0.85; roundRect(ctx, d.x, d.y, d.w, d.h, d.w / 2); ctx.fill(); ctx.globalAlpha = 1; }
    }

    // 2) 형광펜·형광 밑줄 (글자 뒤)
    for (const it of page.items) if (it.kind === 'line') drawMarksBehind(ctx, it, theme);

    // 3) 글자·그림
    for (const it of page.items) {
      if (it.kind === 'line') {
        const g = lineGeom(ctx, it);
        for (const seg of it.line.segs) {
          if (!seg.text.trim()) continue;
          const style = Object.assign({}, seg.style, it.isTitle || seg.style.nm ? { b: true } : null);
          ctx.font = L.fontString(style, it.size, it.family);
          ctx.fillStyle = textColor(style, theme, look, it);
          ctx.fillText(seg.text, it.x + seg.x, g.baseline);
        }
        drawUnderlines(ctx, it);
      } else if (it.kind === 'img') {
        const img = images && images.get(it.key);
        ctx.save();
        roundRect(ctx, it.x, it.y, it.w, it.h, Math.round(opt.size * 0.75));
        if (img) { ctx.clip(); ctx.drawImage(img, it.x, it.y, it.w, it.h); } else { ctx.fillStyle = theme.status; ctx.fill(); }
        ctx.restore();
      } else if (it.kind === 'hr') {
        ctx.fillStyle = theme.thought;
        const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
        const gap = opt.size * 0.9, r = Math.max(1.2, opt.size * 0.1);
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(cx + k * gap, cy, r, 0, Math.PI * 2); ctx.fill(); }
      } else if (it.kind === 'rule') {
        ctx.fillStyle = theme.rule;
        ctx.fillRect(it.x, it.y, it.w, 1);
      }
    }
    ctx.restore();

    // 4) 스티커
    for (const st of page.stickers || []) drawSticker(ctx, st, opt, theme);

    // 5) 쪽 번호
    if (look.pageNumbers && totalPages > 1) {
      const size = Math.round(opt.size * 0.72);
      ctx.save();
      ctx.font = `400 ${size}px "CC Sans", sans-serif`;
      ctx.fillStyle = theme.page;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${page.index + 1} / ${totalPages}`, page.w / 2, page.h - M / 2);
      ctx.restore();
    }
  }

  const api = { THEMES, PALETTE, NAMED, rgba, renderPage, roundRect, stickerLayout, clearMetrics, drawBackground };
  root.CCRender = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ======== parse.js ======== */
/*
 * 크랙 익명 캡처 — 크랙 채팅 화면에서 메시지 읽어 오기
 * 크랙 화면 구조가 바뀌면 이 파일의 SELECTORS 만 고치면 된다.
 */
(function (root) {
  'use strict';

  const SELECTORS = {
    bubble: '.wrtn-markdown',
    group: '[data-message-group-id]',
    userBubbleBg: '.bg-surface_chat_secondary',
    status: '.not-wrtn-markdown, .wrtn-codeblock, pre.shiki, pre'
  };

  const BLOCK_TAGS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'HEADER', 'FOOTER', 'FIGURE', 'DL', 'DT', 'DD']);
  const SKIP_TAGS = new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'IFRAME', 'VIDEO', 'AUDIO', 'CANVAS']);

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function getBubbles() {
    return Array.from(document.querySelectorAll(SELECTORS.bubble))
      .filter(el => !el.parentElement || !el.parentElement.closest(SELECTORS.bubble))
      .filter(isVisible)
      .sort((a, b) => {
        const pos = a.compareDocumentPosition(b);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });
  }

  function getRole(bubble) {
    const group = bubble.closest(SELECTORS.group);
    if (group) {
      let cur = bubble;
      while (cur && cur.parentElement && cur.parentElement !== group) cur = cur.parentElement;
      if (cur && cur.classList) {
        if (cur.classList.contains('items-end')) return 'user';
        if (cur.classList.contains('items-start')) return 'char';
      }
    }
    if (bubble.closest(SELECTORS.userBubbleBg)) return 'user';
    // 마지막 수단: 화면 오른쪽에 붙어 있으면 내 메시지
    const r = bubble.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    if (r.left > vw * 0.45 && r.right > vw * 0.7 && r.width < vw * 0.6) return 'user';
    return 'char';
  }

  function parseBubble(bubble) {
    const blocks = [];
    let runs = [];

    const flush = () => {
      const text = runs.map(r => r.t).join('');
      if (text.replace(/\s/g, '')) blocks.push({ type: 'p', runs: mergeRuns(runs) });
      runs = [];
    };
    const addText = (t, style) => {
      if (!t) return;
      runs.push(Object.assign({ t }, style));
    };

    function walk(node, style) {
      if (node.nodeType === Node.TEXT_NODE) {
        addText(node.nodeValue.replace(/[\r\n\t]+/g, ' '), style);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node;
      const tag = el.tagName;
      if (SKIP_TAGS.has(tag)) return;
      if (el.getAttribute('aria-hidden') === 'true') return;
      if (el.matches(SELECTORS.status) || tag === 'PRE' || tag === 'TABLE') {
        flush();
        const text = statusText(el);
        if (text) blocks.push({ type: 'status', runs: [{ t: text }] });
        return;
      }
      if (tag === 'BR') { addText('\n', style); return; }
      if (tag === 'HR') { flush(); blocks.push({ type: 'hr' }); return; }
      if (tag === 'IMG') {
        const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
        if (w && h && (w < 40 || h < 40)) return; // 작은 아이콘은 건너뛴다
        const src = el.currentSrc || el.src;
        if (src) { flush(); blocks.push({ type: 'img', src, w: w || 0, h: h || 0 }); }
        return;
      }
      const cs = el.nodeType === 1 ? getComputedStyle(el) : null;
      if (cs && cs.display === 'none') return;

      const next = Object.assign({}, style);
      if (tag === 'STRONG' || tag === 'B' || (cs && Number(cs.fontWeight) >= 650 && !/^H[1-6]$/.test(tag))) next.b = true;
      if (tag === 'EM' || tag === 'I' || (cs && cs.fontStyle === 'italic')) next.i = true;

      const isBlock = BLOCK_TAGS.has(tag) || (cs && (cs.display === 'block' || cs.display === 'flex' || cs.display === 'list-item'));
      if (isBlock) flush();
      for (const child of el.childNodes) walk(child, next);
      if (isBlock) flush();
    }

    for (const child of bubble.childNodes) walk(child, {});
    flush();
    return blocks;
  }

  function statusText(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('button, svg, [aria-label="copy code"]').forEach(x => x.remove());
    return (clone.innerText || clone.textContent || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function mergeRuns(runs) {
    const out = [];
    for (const r of runs) {
      const last = out[out.length - 1];
      if (last && !!last.b === !!r.b && !!last.i === !!r.i) last.t += r.t;
      else out.push({ t: r.t, ...(r.b ? { b: true } : {}), ...(r.i ? { i: true } : {}) });
    }
    return out;
  }

  /* ---------- 문단 단위 ---------- */
  const UNIT_SEL = '.not-wrtn-markdown, .wrtn-codeblock, pre, p, li, h1, h2, h3, h4, h5, h6, hr, img, table, blockquote';

  // 말풍선 안에서 서로 겹치지 않는 문단들
  function getUnits(bubble) {
    const cands = Array.from(bubble.querySelectorAll(UNIT_SEL))
      .filter(el => el.closest(SELECTORS.bubble) === bubble && isVisible(el));
    const units = cands.filter(el => !cands.some(p => p !== el && p.contains(el)));
    return units.length ? units : [bubble];
  }

  function getAllUnits() {
    const out = [];
    for (const b of getBubbles()) for (const u of getUnits(b)) out.push({ el: u, bubble: b });
    return out;
  }

  // 문단 하나 → 블록들
  function parseUnit(el) {
    const tag = el.tagName;
    if (tag === 'IMG') {
      const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
      const src = el.currentSrc || el.src;
      return src && !(w && h && (w < 40 || h < 40)) ? [{ type: 'img', src, w: w || 0, h: h || 0 }] : [];
    }
    if (tag === 'HR') return [{ type: 'hr' }];
    if (el.matches(SELECTORS.status) || tag === 'PRE' || tag === 'TABLE') {
      const text = statusText(el);
      return text ? [{ type: 'status', runs: [{ t: text }] }] : [];
    }
    return parseBubble(el);
  }

  // 고른 문단들 → 메시지 묶음 (같은 말풍선끼리 모은다)
  function collectUnits(list) {
    const msgs = [];
    let cur = null;
    for (const u of list) {
      const blocks = u.blocks || parseUnit(u.el);
      if (!blocks.length) continue;
      if (!cur || cur.bubble !== u.bubble) {
        cur = { bubble: u.bubble, role: u.role || getRole(u.bubble), blocks: [] };
        msgs.push(cur);
      }
      cur.blocks.push(...blocks);
    }
    return msgs.map(m => ({ role: m.role, blocks: m.blocks }));
  }

  function parseMessages(bubbles) {
    return bubbles.map(b => ({ role: getRole(b), blocks: parseBubble(b) })).filter(m => m.blocks.length);
  }

  root.CCParse = { SELECTORS, getBubbles, getRole, parseBubble, parseMessages, isVisible, getUnits, getAllUnits, parseUnit, collectUnits };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* ======== 화면 스타일 ======== */
const CC_CSS = "/* ===== 아이폰 느낌 기본값 ===== */\n.cc-root {\n  --bg: #F2F2F7; --cell: #FFFFFF; --cell-press: #E5E5EA; --label: #000; --label2: rgba(60,60,67,.6); --label3: rgba(60,60,67,.3);\n  --sep: rgba(60,60,67,.18); --fill: rgba(118,118,128,.12); --fill2: rgba(118,118,128,.2); --blue: #007AFF; --green: #34C759;\n  --red: #FF3B30; --orange: #FF9500; --pink: #FF2D55; --bar: rgba(249,249,251,.88); --preview: #E9E9EE; --seg-on: #FFFFFF;\n  --shadow-lg: 0 12px 40px rgba(0,0,0,.2), 0 0 0 .5px rgba(0,0,0,.08);\n  --font: -apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Apple SD Gothic Neo\", \"Pretendard\", \"Noto Sans KR\", \"Malgun Gothic\", sans-serif;\n  --safe-b: env(safe-area-inset-bottom, 0px); --safe-t: env(safe-area-inset-top, 0px);\n  font-family: var(--font); font-size: 15px; letter-spacing: -0.2px; color: var(--label); line-height: 1.35;\n  -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;\n}\n@media (prefers-color-scheme: dark) {\n  .cc-root {\n    --bg: #000; --cell: #1C1C1E; --cell-press: #2C2C2E; --label: #fff; --label2: rgba(235,235,245,.6); --label3: rgba(235,235,245,.3);\n    --sep: rgba(84,84,88,.6); --fill: rgba(118,118,128,.24); --fill2: rgba(118,118,128,.36); --blue: #0A84FF; --green: #30D158;\n    --red: #FF453A; --orange: #FF9F0A; --pink: #FF375F; --bar: rgba(28,28,30,.9); --preview: #0C0C0E; --seg-on: #636366;\n    --shadow-lg: 0 12px 40px rgba(0,0,0,.6), 0 0 0 .5px rgba(255,255,255,.1);\n  }\n}\n.cc-root { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; transform: translateZ(0); pointer-events: none; overflow: visible; }\n.cc-root > * { pointer-events: auto; }\n.cc-root *, .cc-root *::before, .cc-root *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }\n.cc-root button, .cc-root input, .cc-root textarea { font: inherit; color: inherit; letter-spacing: inherit; margin: 0; }\n.cc-root button { cursor: pointer; touch-action: manipulation; }\n.cc-root .hidden { display: none !important; }\n\n/* 공통 부품 */\n.group { background: var(--cell); border-radius: 12px; overflow: hidden; }\n.group-title { margin: 20px 16px 7px; font-size: 13px; color: var(--label2); font-weight: 400; }\n.foot { margin: 8px 16px 0; font-size: 12.5px; color: var(--label2); line-height: 1.45; }\n.row { position: relative; display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 8px 16px; background: transparent; border: none; text-align: left; }\n.row + .row::before { content: \"\"; position: absolute; top: 0; left: 16px; right: 0; height: .5px; background: var(--sep); }\n.row .label { flex: 1; min-width: 0; }\n.row.col { flex-direction: column; align-items: stretch; gap: 9px; padding-top: 12px; padding-bottom: 12px; }\n.row.blue { color: var(--blue); }\n.seg { display: flex; padding: 2px; border-radius: 9px; background: var(--fill); }\n.seg button { flex: 1; border: none; background: transparent; padding: 7px 4px; font-size: 13.5px; font-weight: 500; border-radius: 7px; white-space: nowrap; transition: background .2s, box-shadow .2s; }\n.seg button.on { background: var(--seg-on); font-weight: 600; box-shadow: 0 3px 8px rgba(0,0,0,.12), 0 3px 1px rgba(0,0,0,.04); }\n.btn-fill { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; border: none; border-radius: 14px; background: var(--blue); color: #fff; font-size: 17px; font-weight: 600; padding: 15px 18px; }\n.btn-fill:active { filter: brightness(.92); }\n.btn-gray { display: flex; align-items: center; justify-content: center; width: 100%; border: none; border-radius: 14px; background: var(--fill); color: var(--blue); font-size: 16px; font-weight: 600; padding: 14px 18px; }\n.btn-text { border: none; background: none; color: var(--blue); font-size: 16px; padding: 8px 6px; border-radius: 8px; }\n.btn-text.bold { font-weight: 600; }\n.btn-text.red { color: var(--red); }\n.btn-text:disabled { color: var(--label3); cursor: default; }\n.field { flex: 1; min-width: 0; border: none; outline: none; background: var(--fill); border-radius: 9px; padding: 9px 10px; font-size: 16px; }\n.field::placeholder { color: var(--label3); }\n.stepper { display: inline-flex; border-radius: 9px; background: var(--fill); overflow: hidden; }\n.stepper button { border: none; background: transparent; width: 48px; height: 34px; font-size: 21px; line-height: 1; }\n.stepper button + button { border-left: .5px solid var(--sep); }\n.stepper button:active { background: var(--fill2); }\n\n/* ===== 크랙 화면 위: 버튼·안내 막대 ===== */\n.pickbar { position: fixed; left: 50%; bottom: calc(16px + var(--safe-b)); transform: translateX(-50%); width: min(560px, calc(100% - 20px)); background: var(--bar); -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%); border-radius: 20px; padding: 12px 12px 12px 14px; box-shadow: var(--shadow-lg); display: flex; align-items: center; gap: 10px; animation: cc-up .28s cubic-bezier(.2,.9,.3,1.12); z-index: 3; }\n@keyframes cc-up { from { transform: translate(-50%, 24px); opacity: 0; } }\n.pickbar .step { flex: none; width: 32px; height: 32px; border-radius: 50%; background: var(--blue); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 15px; }\n.pickbar .step.orange { background: var(--orange); }\n.pickbar .msg { flex: 1; min-width: 0; }\n.pickbar .msg b { display: block; font-size: 15px; font-weight: 600; }\n.pickbar .msg span { display: block; font-size: 12.5px; color: var(--label2); margin-top: 2px; }\n.pill { flex: none; border: none; font-size: 14px; font-weight: 600; padding: 9px 13px; border-radius: 999px; background: var(--fill); color: var(--blue); }\n\n/* ===== 편집 화면 ===== */\n.app { position: fixed; inset: 0; display: flex; flex-direction: column; background: var(--preview); z-index: 4; animation: cc-in .22s ease; }\n@keyframes cc-in { from { opacity: 0; } }\n.nav { flex: none; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: calc(6px + var(--safe-t)) 8px 6px; background: var(--bar); -webkit-backdrop-filter: blur(20px) saturate(180%); backdrop-filter: blur(20px) saturate(180%); border-bottom: .5px solid var(--sep); }\n.nav .left { display: flex; gap: 2px; justify-self: start; }\n.nav .right { justify-self: end; }\n.nav .title { text-align: center; }\n.nav .title b { display: block; font-size: 16px; font-weight: 600; }\n.nav .title small { display: block; font-size: 11.5px; color: var(--label2); margin-top: 1px; }\n.icon-btn { width: 40px; height: 36px; display: grid; place-items: center; border: none; background: none; color: var(--blue); border-radius: 10px; padding: 0; }\n.icon-btn:disabled { color: var(--label3); }\n.icon-btn svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }\n\n.pages { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 18px 12px 140px; display: flex; flex-direction: column; align-items: center; gap: 22px; position: relative; }\n.page-wrap { position: relative; flex: none; }\n.page-wrap canvas { display: block; border-radius: 4px; box-shadow: 0 8px 24px rgba(0,0,0,.12), 0 0 0 .5px rgba(0,0,0,.08); touch-action: pan-y; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }\n.page-tag { position: absolute; top: -17px; left: 2px; font-size: 11px; font-weight: 600; color: var(--label2); }\n.pending { position: absolute; pointer-events: none; border-radius: 4px; background: rgba(0,122,255,.22); box-shadow: 0 0 0 2px rgba(0,122,255,.7); }\n.loading { margin: 18vh auto 0; display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--label2); font-size: 14px; text-align: center; padding: 0 24px; }\n\n/* 꾸미기 도구 막대 */\n.toolbar { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(66px + var(--safe-b)); width: min(520px, calc(100% - 16px)); background: var(--bar); -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%); border-radius: 18px; box-shadow: var(--shadow-lg); padding: 10px 10px 9px; z-index: 5; animation: cc-up .25s cubic-bezier(.2,.9,.3,1.1); }\n.toolbar .tb-top { display: flex; gap: 8px; align-items: center; }\n.toolbar .seg { flex: 1; }\n.colors { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 2px 4px; }\n.colors::-webkit-scrollbar { display: none; }\n.dot.custom { position: relative; background: conic-gradient(#ff453a, #ffd60a, #34c778, #5ac8fa, #b57bff, #ff6ba6, #ff453a); display: grid; place-items: center; overflow: hidden; cursor: pointer; }\n.dot.custom::after { content: \"\"; width: 12px; height: 12px; border-radius: 50%; background: var(--cc, #fff); box-shadow: 0 0 0 2px #fff; }\n.dot.custom input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; border: none; padding: 0; }\n.alpha-row { display: flex; align-items: center; gap: 10px; padding: 6px 2px 2px; font-size: 13px; color: var(--label2); }\n.alpha-row input { flex: 1; accent-color: var(--blue); height: 28px; }\n.alpha-row b { width: 40px; text-align: right; font-weight: 600; color: var(--label); }\n.ul-seg { margin-top: 6px; }\n.ul-seg button { font-size: 12.5px; padding: 6px 2px; }\n.tb-hint { font-size: 12.5px; color: var(--label2); line-height: 1.35; margin: 8px 2px 0; }\n.dot { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--cell); box-shadow: 0 0 0 .5px var(--sep); padding: 0; flex: none; }\n.dot.on { box-shadow: 0 0 0 2.5px var(--blue); }\n.dot[data-c=\"yellow\"] { background: #FFD60A; } .dot[data-c=\"pink\"] { background: #FF69A0; }\n.dot[data-c=\"green\"] { background: #34C778; } .dot[data-c=\"blue\"] { background: #409CFF; }\n.wave-toggle { flex: none; border: none; background: var(--fill); border-radius: 8px; height: 30px; padding: 0 10px; font-size: 13px; font-weight: 600; color: var(--label2); }\n.wave-toggle.on { background: color-mix(in srgb, var(--blue) 16%, transparent); color: var(--blue); }\n.done-btn { flex: none; border: none; background: var(--blue); color: #fff; border-radius: 999px; padding: 7px 13px; font-size: 13.5px; font-weight: 600; }\n\n/* 아래 탭 */\n.tabbar { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; padding: 5px 8px calc(5px + var(--safe-b)); background: var(--bar); -webkit-backdrop-filter: blur(20px) saturate(180%); backdrop-filter: blur(20px) saturate(180%); border-top: .5px solid var(--sep); z-index: 6; }\n.tab { flex: 1; max-width: 130px; display: flex; flex-direction: column; align-items: center; gap: 3px; border: none; background: none; color: var(--label2); font-size: 10.5px; font-weight: 600; padding: 4px 0; }\n.tab svg { width: 25px; height: 25px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }\n.tab.on { color: var(--blue); }\n.tab.save { color: var(--blue); }\n.tab.save .bubble { width: 44px; height: 30px; border-radius: 15px; background: var(--blue); color: #fff; display: grid; place-items: center; }\n.tab.save .bubble svg { width: 20px; height: 20px; stroke-width: 2.3; }\n\n/* 대사 구분 말풍선 메뉴 */\n.kind-pop { position: absolute; z-index: 7; background: var(--bar); -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 6px; display: flex; gap: 4px; animation: cc-pop .18s ease; }\n@keyframes cc-pop { from { transform: scale(.92); opacity: 0; } }\n.kind-pop button { border: none; background: transparent; border-radius: 9px; padding: 8px 12px; font-size: 14px; font-weight: 600; }\n.kind-pop button.on { background: var(--blue); color: #fff; }\n\n/* 시트 */\n.backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.28); z-index: 10; animation: cc-fade .2s ease; }\n.backdrop.clear { background: transparent; }\n@keyframes cc-fade { from { opacity: 0; } }\n.sheet { position: fixed; left: 50%; bottom: 0; transform: translateX(-50%); width: min(560px, 100%); max-height: min(78%, 680px); display: flex; flex-direction: column; background: var(--bg); border-radius: 14px 14px 0 0; box-shadow: 0 -8px 40px rgba(0,0,0,.18); z-index: 11; animation: cc-sheet .32s cubic-bezier(.2,.9,.3,1.02); }\n@keyframes cc-sheet { from { transform: translate(-50%, 100%); } }\n.sheet.short { max-height: 58%; }\n.grabber { width: 36px; height: 5px; border-radius: 3px; background: var(--fill2); margin: 7px auto 0; flex: none; }\n.sheet-nav { flex: none; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 4px 8px 6px; }\n.sheet-nav b { font-size: 17px; font-weight: 600; }\n.sheet-nav > :first-child { justify-self: start; } .sheet-nav > :last-child { justify-self: end; }\n.sheet-body { overflow-y: auto; padding: 4px 16px calc(20px + var(--safe-b)); overscroll-behavior: contain; }\n\n.rule-row { gap: 6px; padding: 7px 10px 7px 12px; }\n.rule-row .arrow { color: var(--label3); flex: none; }\n.rule-row .star { flex: none; width: 34px; height: 34px; border: none; border-radius: 9px; background: var(--fill); color: var(--label3); font-size: 17px; display: grid; place-items: center; padding: 0; }\n.rule-row .star.on { background: color-mix(in srgb, var(--pink) 16%, transparent); color: var(--pink); }\n.rule-row .del { flex: none; width: 22px; height: 22px; border-radius: 50%; border: none; background: var(--red); color: #fff; font-size: 15px; font-weight: 800; line-height: 1; display: grid; place-items: center; padding: 0; }\n.rule-count { display: block; padding: 0 0 6px 14px; margin-top: -3px; font-size: 11.5px; color: var(--label2); }\n.rule-wrap + .rule-wrap { border-top: .5px solid var(--sep); }\n.add-row .plus { width: 22px; height: 22px; border-radius: 50%; background: var(--green); color: #fff; display: grid; place-items: center; font-size: 15px; font-weight: 700; }\n\n.themes { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px 4px; padding: 14px 6px 12px; }\n.theme { border: none; background: transparent; display: flex; flex-direction: column; align-items: center; gap: 7px; font-size: 12.5px; color: var(--label2); padding: 0; }\n.theme .sw { width: 58px; height: 74px; border-radius: 12px; box-shadow: 0 0 0 .5px rgba(0,0,0,.15), 0 2px 6px rgba(0,0,0,.08); display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 0 9px; }\n.theme .sw i { display: block; height: 4px; border-radius: 2px; }\n.theme .sw i.d { width: 70%; margin-left: 7px; position: relative; }\n.theme .sw i.d::before { content: \"\"; position: absolute; left: -7px; top: -2px; width: 2.5px; height: 8px; border-radius: 2px; background: var(--ac); }\n.theme .sw i.n { width: 90%; opacity: .5; } .theme .sw i.n2 { width: 55%; opacity: .5; }\n.theme.on { color: var(--blue); font-weight: 600; }\n.themes .theme .sw { display: block; width: 52px; height: 65px; padding: 0; }\n.theme span { font-size: 12px; }\n.fonts { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 4px; scrollbar-width: none; }\n.fonts::-webkit-scrollbar { display: none; }\n.font-card { flex: none; min-width: 96px; border: none; border-radius: 12px; background: var(--fill); padding: 10px 10px 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; }\n.font-card .fs { font-size: 19px; line-height: 1.2; white-space: nowrap; }\n.font-card .fl { font-size: 11.5px; color: var(--label2); white-space: nowrap; }\n.font-card.on { background: color-mix(in srgb, var(--blue) 14%, var(--cell)); box-shadow: 0 0 0 2px var(--blue); }\n.font-card.on .fl { color: var(--blue); font-weight: 600; }\n.theme.on .sw { box-shadow: 0 0 0 2.5px var(--blue); }\n\n/* 스티커 시트 */\n.st-input { width: 100%; min-height: 76px; resize: none; border: none; outline: none; border-radius: 12px; background: var(--cell); padding: 12px 14px; font-size: 17px; line-height: 1.4; }\n.st-styles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }\n.st-style { border: none; border-radius: 12px; background: var(--cell); padding: 12px 4px; font-size: 14px; font-weight: 600; display: flex; flex-direction: column; align-items: center; gap: 6px; box-shadow: 0 0 0 .5px var(--sep); }\n.st-style.on { box-shadow: 0 0 0 2.5px var(--blue); }\n.st-style .pv { font-size: 15px; padding: 3px 10px; border-radius: 999px; }\n.st-style .pv.hand { font-family: \"CC Hand\", cursive; font-size: 21px; color: #E2457A; font-weight: 400; }\n.st-style .pv.bubble { background: #fff; color: #1C1C1E; box-shadow: 0 2px 8px rgba(0,0,0,.15); }\n.st-style .pv.neon { background: #E2457A; color: #fff; box-shadow: 0 0 10px #E2457A; }\n.mt12 { margin-top: 12px; } .mt16 { margin-top: 16px; }\n.two { display: flex; gap: 10px; }\n\n/* 글 고치기 */\n.editor { position: fixed; inset: 0; z-index: 12; background: var(--bg); display: flex; flex-direction: column; animation: cc-sheet2 .3s cubic-bezier(.2,.9,.3,1.02); }\n@keyframes cc-sheet2 { from { transform: translateY(40px); opacity: 0; } }\n.editor .nav { background: var(--bar); }\n.ed-body { flex: 1; overflow-y: auto; padding: 12px 12px calc(40px + var(--safe-b)); overscroll-behavior: contain; }\n.ed-tip { font-size: 12.5px; color: var(--label2); margin: 2px 6px 12px; line-height: 1.45; }\n.ed-msg { background: var(--cell); border-radius: 14px; padding: 6px 0; margin-bottom: 10px; }\n.ed-msg.user { background: color-mix(in srgb, var(--blue) 9%, var(--cell)); }\n.ed-who { font-size: 11.5px; font-weight: 700; color: var(--label2); padding: 6px 14px 0; }\n.ed-p { margin: 0; padding: 8px 14px; outline: none; font-family: \"CC Serif\", \"Noto Serif KR\", serif; font-size: 16.5px; line-height: 1.75; white-space: pre-wrap; word-break: keep-all; overflow-wrap: anywhere; border-radius: 8px; }\n.ed-p:focus { background: color-mix(in srgb, var(--blue) 7%, transparent); box-shadow: inset 3px 0 0 var(--blue); }\n.ed-p.status { font-family: var(--font); font-size: 14px; color: var(--label2); background: var(--fill); margin: 6px 10px; }\n.ed-gone { display: flex; align-items: center; gap: 8px; margin: 4px 10px; padding: 8px 10px; border-radius: 10px; background: var(--fill); font-size: 13px; color: var(--label2); }\n.ed-gone span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.ed-gone button { flex: none; border: none; background: none; color: var(--blue); font-weight: 600; font-size: 13.5px; }\n.ed-img { display: flex; align-items: center; gap: 8px; margin: 4px 10px; padding: 8px 10px; font-size: 13px; color: var(--label2); }\n.ed-img span { flex: 1; }\n\n/* 저장 결과 */\n.thumbs { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px 12px; }\n.thumbs img { height: 150px; width: auto; border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,.14), 0 0 0 .5px var(--sep); flex: none; }\n.save-info { text-align: center; font-size: 13px; color: var(--label2); margin: 2px 0 14px; }\n\n.hud { position: fixed; left: 50%; top: 45%; transform: translate(-50%, -50%); min-width: 170px; padding: 22px 22px 18px; border-radius: 18px; background: var(--bar); -webkit-backdrop-filter: blur(30px); backdrop-filter: blur(30px); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; align-items: center; gap: 14px; font-size: 14.5px; font-weight: 600; z-index: 20; }\n.spinner { width: 30px; height: 30px; border-radius: 50%; border: 3px solid var(--fill2); border-top-color: var(--label2); animation: cc-spin .8s linear infinite; }\n@keyframes cc-spin { to { transform: rotate(360deg); } }\n.toast { position: fixed; left: 50%; top: calc(64px + var(--safe-t)); transform: translateX(-50%); background: rgba(30,30,32,.92); color: #fff; font-size: 14px; font-weight: 600; padding: 10px 16px; border-radius: 14px; box-shadow: 0 8px 24px rgba(0,0,0,.25); z-index: 30; animation: cc-drop .22s ease; max-width: calc(100% - 32px); text-align: center; }\n@keyframes cc-drop { from { opacity: 0; transform: translate(-50%, -8px); } }\n\n.row.link .value { color: var(--label2); }\n.font-row { min-height: 60px; }\n.font-row .label { display: flex; flex-direction: column; gap: 3px; }\n.font-row .fname { font-size: 12px; color: var(--label2); font-weight: 600; }\n.font-row .fsample { font-size: 19px; line-height: 1.3; color: var(--label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.font-row .check { color: var(--blue); font-weight: 700; font-size: 18px; visibility: hidden; }\n.font-row.on .check { visibility: visible; }\n.font-row.on .fname { color: var(--blue); }\n.sheet-body.choice { text-align: center; padding-top: 14px; }\n.sheet-body.choice b { display: block; font-size: 17px; font-weight: 600; }\n.sheet-body.choice p { margin: 6px 0 4px; font-size: 14px; color: var(--label2); }\n.btn-fill.red { background: var(--red); }\n.sheet-body { -webkit-overflow-scrolling: touch; touch-action: pan-y; }\n\n.seg.fmt { margin: 2px 0 10px; }\n.seg.fmt button { font-size: 12.5px; }\n\n/* v3.7.3: mobile color selector stays on one row (yellow preset removed) */\n@media (max-width: 700px) {\n  .toolbar .colors { flex-wrap: nowrap; justify-content: space-between; gap: 4px; overflow-x: auto; padding: 8px 1px 3px; }\n  .toolbar .colors .dot { width: 25px; height: 25px; flex: 0 0 25px; }\n}\n/* v3.7: 작은 화면에서는 설정이 원고를 덮지 않도록 미리보기와 설정을 분리 */\n.cc-panel-toggle { display: none; }\n@media (max-width: 700px) {\n  .cc-root { height: 100dvh; }\n  .app { height: 100dvh; min-height: 0; }\n  .app.cc-preview-split .pages {\n    min-height: 85px;\n    margin-bottom: calc(var(--cc-panel-h, min(36dvh, 300px)) + 48px + var(--safe-b));\n    padding: 14px 9px 18px;\n    scroll-padding-bottom: 20px;\n  }\n  .app:not(.cc-preview-split) .pages { padding-bottom: calc(68px + var(--safe-b)); }\n  .tabbar { height: calc(46px + var(--safe-b)); min-height: 46px; padding: 3px 6px calc(3px + var(--safe-b)); gap: 3px; align-items: center; }\n  .tab { max-width: none; min-height: 36px; padding: 4px 2px; flex-direction: row; justify-content: center; gap: 5px; font-size: 12px; line-height: 1.1; }\n  .tab svg { width: 19px; height: 19px; }\n  .tab.save .bubble { width: 28px; height: 27px; border-radius: 10px; }\n  .tab.save .bubble svg { width: 17px; height: 17px; }\n  .sheet.cc-mobile-panel {\n    bottom: calc(46px + var(--safe-b));\n    height: min(36dvh, 300px);\n    max-height: none;\n    width: 100%;\n    border-radius: 16px 16px 0 0;\n    box-shadow: 0 -3px 15px rgba(0,0,0,.10);\n    animation: none;\n    overflow: hidden;\n  }\n  .sheet.cc-mobile-panel.cc-panel-expanded { height: min(70dvh, 640px); }\n  .sheet.cc-mobile-panel.cc-panel-collapsed { height: 46px; }\n  .sheet.cc-mobile-panel.cc-panel-collapsed .sheet-body,\n  .sheet.cc-mobile-panel.cc-panel-collapsed .grabber { display: none; }\n  .sheet.cc-mobile-panel .grabber { width: 30px; height: 4px; margin-top: 5px; }\n  .sheet.cc-mobile-panel .sheet-nav { min-height: 39px; padding: 1px 12px 4px; grid-template-columns: minmax(74px, 1fr) auto minmax(74px, 1fr); column-gap: 4px; }\n  .sheet.cc-mobile-panel .sheet-nav b { font-size: 14px; white-space: nowrap; }\n  .sheet.cc-mobile-panel .sheet-nav .btn-text { font-size: 13px; padding: 5px 4px; }\n  .sheet.cc-mobile-panel .sheet-body { min-height: 0; flex: 1; padding: 3px 12px 12px; overscroll-behavior: contain; }\n  .cc-panel-toggle { display: inline-flex; align-items: center; justify-content: center; gap: 3px; border: none; background: var(--fill); color: var(--blue); border-radius: 8px; padding: 5px 6px; font-size: 11.5px; font-weight: 600; white-space: nowrap; min-height: 29px; }\n  .cc-panel-left { display: flex; gap: 2px; align-items: center; min-width: 0; }\n  .cc-panel-left .btn-text { white-space: nowrap; }\n  .sheet.cc-mobile-panel .rule-row { padding: 5px 7px; gap: 5px; }\n  .sheet.cc-mobile-panel .row { min-height: 39px; }\n  .sheet.cc-mobile-panel .group-title { margin-top: 9px; }\n  .sheet.cc-mobile-panel .row.col { gap: 5px; padding-top: 7px; padding-bottom: 7px; }\n  .sheet.cc-mobile-panel .foot { margin: 6px 7px 0; font-size: 11px; }\n  .sheet.cc-mobile-panel .btn-gray { padding: 9px 11px; font-size: 13px; }\n  .sheet.cc-mobile-panel .btn-fill { padding: 10px 12px; font-size: 14px; }\n  .sheet.cc-mobile-panel .font-row { min-height: 49px; }\n  .sheet.cc-mobile-panel .font-row .fsample { font-size: 17px; }\n  .sheet.cc-mobile-panel .thumbs img { height: 94px; }\n  .backdrop.clear { pointer-events: none; }\n}\n@media (max-width: 360px) {\n  .tab { gap: 3px; font-size: 11px; }\n  .tab svg { width: 17px; height: 17px; }\n  .sheet.cc-mobile-panel .sheet-nav { grid-template-columns: minmax(70px, 1fr) auto minmax(70px, 1fr); padding-inline: 8px; }\n}\n";

/* ======== app.js ======== */
/* ===================== 크랙 익명 캡처 — 화면과 동작 ===================== */
(function () {
  'use strict';
  if (window.top !== window.self) return;
  if (window.__ccCaptureLoaded) return;
  window.__ccCaptureLoaded = true;

  const T = CCText, L = CCLayout, R = CCRender, P = CCParse;
  const clone = v => JSON.parse(JSON.stringify(v));

  /* ---------- 저장소·인터넷 (탬퍼몽키 / 아이폰 Userscripts / 그 밖) ---------- */
  const PREFIX = 'ccap3_';
  const store = {
    get(k, d) {
      try { if (typeof GM_getValue === 'function') { const v = GM_getValue(PREFIX + k); return v === undefined || v === null ? d : v; } } catch (e) { /* 아래로 */ }
      try { const v = localStorage.getItem(PREFIX + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) {
      try { if (typeof GM_setValue === 'function') { GM_setValue(PREFIX + k, v); return; } } catch (e) { /* 아래로 */ }
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* 무시 */ }
    }
  };
  function netGet(url, type) {
    return new Promise((resolve, reject) => {
      const opts = {
        method: 'GET', url, responseType: type, timeout: 25000,
        onload: r => (r.status >= 200 && r.status < 300 ? resolve(r.response) : reject(new Error('HTTP ' + r.status))),
        onerror: () => reject(new Error('network')), ontimeout: () => reject(new Error('timeout'))
      };
      try {
        if (typeof GM_xmlhttpRequest === 'function') return void GM_xmlhttpRequest(opts);
        if (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') return void GM.xmlHttpRequest(opts);
      } catch (e) { /* 아래로 */ }
      fetch(url).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return type === 'arraybuffer' ? r.arrayBuffer() : type === 'blob' ? r.blob() : r.text();
      }).then(resolve, reject);
    });
  }

  /* ---------- 기기 ---------- */
  const UA = navigator.userAgent || '';
  const IS_ANDROID = /Android/i.test(UA);
  const IS_IOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(UA));
  const IS_MOBILE = IS_ANDROID || IS_IOS || /Mobi/i.test(UA) || (navigator.userAgentData && navigator.userAgentData.mobile === true);
  const MAX_PIXELS = IS_IOS ? 15e6 : IS_MOBILE ? 24e6 : 48e6;
  const MAX_SIDE = 16000; // WebP 한계(16383)보다 조금 작게
  const SCALE = 3;
  const PAGE_W = 540;

  /* ---------- 설정 ---------- */
  const DEFAULTS = {
    rules: [{ from: '', to: '', star: false }], starScope: 'dialogue', theme: 'paper', dialogueStyle: 'bar', font: 'noto', enFont: 'auto', fontSize: 16, pageMode: 'long',
    pattern: 'none', frame: 'none', decor: 'deco', format: 'webp', tool: 'hl', color: '#FFD60A', customColor: '#FF7EB6', hlAlpha: 0.35, ulAlpha: 0.85, ulStyle: 'line', stStyle: 'hand'
  };
  let settings = Object.assign(clone(DEFAULTS), store.get('settings', {}));
  if (!Array.isArray(settings.rules) || !settings.rules.length) settings.rules = clone(DEFAULTS.rules);
  delete settings.speakerColors; // 이전 버전의 인물별 대사 색상 설정 폐기
  if (!['dialogue', 'all'].includes(settings.starScope)) settings.starScope = 'dialogue';
  // 예전 설정 옮기기
  if (settings.font === 'serif') settings.font = 'noto';
  if (settings.font === 'sans') settings.font = 'notosans';
  if (settings.color && settings.color[0] !== '#') settings.color = R.NAMED[settings.color] || DEFAULTS.color;
  let saveTimer = null;
  const saveSettings = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set('settings', settings), 250); };

  /* ---------- 글꼴: 쓰는 글자 조각만 받아서 고정 ---------- */
  const G = q => 'https://fonts.googleapis.com/css2?family=' + q + '&display=swap';
  // alias: 우리 이름, src: 글꼴 CSS 주소, fam: 그 CSS 안의 글꼴 이름
  const FONT_SRC = {
    'CC Serif': { src: G('Noto+Serif+KR:wght@400;700'), fam: 'Noto Serif KR' },
    'CC Sans': { src: G('Noto+Sans+KR:wght@400;700'), fam: 'Noto Sans KR' },
    'CC Hand': { src: G('Nanum+Pen+Script'), fam: 'Nanum Pen Script' },
    'CCK Gowun Batang': { src: G('Gowun+Batang:wght@400;700'), fam: 'Gowun Batang' },
    'CCK Nanum Myeongjo': { src: G('Nanum+Myeongjo:wght@400;700'), fam: 'Nanum Myeongjo' },
    'CCK Hahmlet': { src: G('Hahmlet:wght@400;700'), fam: 'Hahmlet' },
    'CCK RIDIBatang': { file: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.0/RIDIBatang.woff', fam: 'RIDIBatang' },
    'CCK MaruBuri': { src: 'https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css', fam: 'MaruBuri', famBold: 'MaruBuriBold' },
    'CCK Pretendard': { src: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css', fam: 'Pretendard' },
    'CCK IBM Plex': { src: G('IBM+Plex+Sans+KR:wght@400;700'), fam: 'IBM Plex Sans KR' },
    'CCK Nanum Gothic': { src: G('Nanum+Gothic:wght@400;700'), fam: 'Nanum Gothic' },
    'CCK Gothic A1': { src: G('Gothic+A1:wght@400;700'), fam: 'Gothic A1' },
    'CCK Gowun Dodum': { src: G('Gowun+Dodum'), fam: 'Gowun Dodum' },
    'CCK NanumSquareRound': { src: 'https://cdn.jsdelivr.net/gh/innks/NanumSquareRound@master/nanumsquareround.min.css', fam: 'NanumSquareRound' },
    'CCK Gaegu': { src: G('Gaegu:wght@400;700'), fam: 'Gaegu' },
    'CCK Hi Melody': { src: G('Hi+Melody'), fam: 'Hi Melody' },
    'CCK Song Myung': { src: G('Song+Myung'), fam: 'Song Myung' },
    'CCK Diphylleia': { src: G('Diphylleia'), fam: 'Diphylleia' },
    'CCK Sunflower': { src: G('Sunflower:wght@300;500;700'), fam: 'Sunflower' },
    'CCK Jua': { src: G('Jua'), fam: 'Jua' },
    'CCK Dongle': { src: G('Dongle:wght@300;400;700'), fam: 'Dongle' },
    'CCK Single Day': { src: G('Single+Day'), fam: 'Single Day' },
    'CCK Gamja Flower': { src: G('Gamja+Flower'), fam: 'Gamja Flower' },
    'CCK Poor Story': { src: G('Poor+Story'), fam: 'Poor Story' },
    'CCK Nanum Pen Script': { src: G('Nanum+Pen+Script'), fam: 'Nanum Pen Script' },
    'CCK Nanum Brush Script': { src: G('Nanum+Brush+Script'), fam: 'Nanum Brush Script' },
    'CCK Cute Font': { src: G('Cute+Font'), fam: 'Cute Font' },
    'CCK Yeon Sung': { src: G('Yeon+Sung'), fam: 'Yeon Sung' },
    'CCK Stylish': { src: G('Stylish'), fam: 'Stylish' },
    'CCK Gugi': { src: G('Gugi'), fam: 'Gugi' },
    'CCK Do Hyeon': { src: G('Do+Hyeon'), fam: 'Do Hyeon' },
    'CCK Black Han Sans': { src: G('Black+Han+Sans'), fam: 'Black Han Sans' },
    'CCE Lora': { src: G('Lora:wght@400;700'), fam: 'Lora' },
    'CCE Garamond': { src: G('EB+Garamond:wght@400;700'), fam: 'EB Garamond' },
    'CCE Baskerville': { src: G('Libre+Baskerville:wght@400;700'), fam: 'Libre Baskerville' },
    'CCE Merriweather': { src: G('Merriweather:wght@400;700'), fam: 'Merriweather' },
    'CCE Crimson': { src: G('Crimson+Pro:wght@400;700'), fam: 'Crimson Pro' },
    'CCE Playfair': { src: G('Playfair+Display:wght@400;700'), fam: 'Playfair Display' },
    'CCE Inter': { src: G('Inter:wght@400;700'), fam: 'Inter' },
    'CCE Lato': { src: G('Lato:wght@400;700'), fam: 'Lato' },
    'CCE Nunito': { src: G('Nunito:wght@400;700'), fam: 'Nunito' },
    'CCE Poppins': { src: G('Poppins:wght@400;700'), fam: 'Poppins' },
    'CCE Montserrat': { src: G('Montserrat:wght@400;700'), fam: 'Montserrat' },
    'CCE DM Sans': { src: G('DM+Sans:wght@400;700'), fam: 'DM Sans' },
    'CCE Caveat': { src: G('Caveat:wght@400;700'), fam: 'Caveat' }
  };
  // 한글 글꼴 + 어울리는 영어 글꼴 묶음 (group: 목록에서 묶어 보여 줄 이름)
  const FONT_SETS = {
    noto: { group: '명조 · 소설책', label: '본명조', kr: 'CC Serif', en: 'CCE Lora', generic: 'serif' },
    gowunb: { group: '명조 · 소설책', label: '고운바탕', kr: 'CCK Gowun Batang', en: 'CCE Lora', generic: 'serif' },
    ridi: { group: '명조 · 소설책', label: '리디바탕', kr: 'CCK RIDIBatang', en: 'CCE Baskerville', generic: 'serif' },
    maru: { group: '명조 · 소설책', label: '마루부리', kr: 'CCK MaruBuri', en: 'CCE Merriweather', generic: 'serif' },
    nanumm: { group: '명조 · 소설책', label: '나눔명조', kr: 'CCK Nanum Myeongjo', en: 'CCE Garamond', generic: 'serif' },
    hahmlet: { group: '명조 · 소설책', label: '함렛', kr: 'CCK Hahmlet', en: 'CCE Crimson', generic: 'serif' },
    songmyung: { group: '명조 · 소설책', label: '송명', kr: 'CCK Song Myung', en: 'CCE Garamond', generic: 'serif' },
    diphylleia: { group: '명조 · 소설책', label: '산하엽', kr: 'CCK Diphylleia', en: 'CCE Garamond', generic: 'serif' },
    notosans: { group: '고딕 · 깔끔', label: '본고딕', kr: 'CC Sans', en: 'CCE Inter', generic: 'sans-serif' },
    pretendard: { group: '고딕 · 깔끔', label: '프리텐다드', kr: 'CCK Pretendard', en: null, generic: 'sans-serif' },
    ibmplex: { group: '고딕 · 깔끔', label: 'IBM 플렉스', kr: 'CCK IBM Plex', en: null, generic: 'sans-serif' },
    nanumg: { group: '고딕 · 깔끔', label: '나눔고딕', kr: 'CCK Nanum Gothic', en: 'CCE Lato', generic: 'sans-serif' },
    gothica1: { group: '고딕 · 깔끔', label: '고딕 A1', kr: 'CCK Gothic A1', en: 'CCE DM Sans', generic: 'sans-serif' },
    sunflower: { group: '고딕 · 깔끔', label: '해바라기', kr: 'CCK Sunflower', en: 'CCE Nunito', generic: 'sans-serif' },
    gowund: { group: '둥글 · 손글씨', label: '고운돋움', kr: 'CCK Gowun Dodum', en: 'CCE Nunito', generic: 'sans-serif' },
    nanumsr: { group: '둥글 · 손글씨', label: '나눔스퀘어라운드', kr: 'CCK NanumSquareRound', en: 'CCE Nunito', generic: 'sans-serif' },
    gaegu: { group: '둥글 · 손글씨', label: '개구쟁이', kr: 'CCK Gaegu', en: null, generic: 'sans-serif' },
    himelody: { group: '둥글 · 손글씨', label: '하이멜로디', kr: 'CCK Hi Melody', en: 'CCE Caveat', generic: 'sans-serif' },
    dongle: { group: '둥글 · 손글씨', label: '동글', kr: 'CCK Dongle', en: 'CCE Nunito', generic: 'sans-serif' },
    singleday: { group: '둥글 · 손글씨', label: '싱글데이', kr: 'CCK Single Day', en: 'CCE Caveat', generic: 'sans-serif' },
    gamja: { group: '둥글 · 손글씨', label: '감자꽃', kr: 'CCK Gamja Flower', en: 'CCE Caveat', generic: 'sans-serif' },
    poorstory: { group: '둥글 · 손글씨', label: '서툰이야기', kr: 'CCK Poor Story', en: 'CCE Caveat', generic: 'sans-serif' },
    nanumpen: { group: '둥글 · 손글씨', label: '나눔손글씨 펜', kr: 'CCK Nanum Pen Script', en: 'CCE Caveat', generic: 'sans-serif' },
    nanumbrush: { group: '둥글 · 손글씨', label: '나눔손글씨 붓', kr: 'CCK Nanum Brush Script', en: 'CCE Caveat', generic: 'sans-serif' },
    cutefont: { group: '둥글 · 손글씨', label: '귀여운 폰트', kr: 'CCK Cute Font', en: 'CCE Nunito', generic: 'sans-serif' },
    yeonsung: { group: '둥글 · 손글씨', label: '연성', kr: 'CCK Yeon Sung', en: 'CCE Caveat', generic: 'sans-serif' },
    stylish: { group: '둥글 · 손글씨', label: '스타일리시', kr: 'CCK Stylish', en: 'CCE Caveat', generic: 'sans-serif' },
    jua: { group: '굵은 글씨 · 개성', label: '주아', kr: 'CCK Jua', en: 'CCE Nunito', generic: 'sans-serif' },
    dohyeon: { group: '굵은 글씨 · 개성', label: '도현', kr: 'CCK Do Hyeon', en: 'CCE Montserrat', generic: 'sans-serif' },
    gugi: { group: '굵은 글씨 · 개성', label: '구기', kr: 'CCK Gugi', en: 'CCE Montserrat', generic: 'sans-serif' },
    blackhan: { group: '굵은 글씨 · 개성', label: '검은고딕', kr: 'CCK Black Han Sans', en: 'CCE Montserrat', generic: 'sans-serif' }
  };
  const EN_FONTS = {
    'CCE Lora': { group: '세리프 · 책', label: 'Lora' },
    'CCE Garamond': { group: '세리프 · 책', label: 'EB Garamond' },
    'CCE Baskerville': { group: '세리프 · 책', label: 'Libre Baskerville' },
    'CCE Merriweather': { group: '세리프 · 책', label: 'Merriweather' },
    'CCE Crimson': { group: '세리프 · 책', label: 'Crimson Pro' },
    'CCE Playfair': { group: '세리프 · 책', label: 'Playfair Display' },
    'CCE Inter': { group: '산세리프 · 깔끔', label: 'Inter' },
    'CCE Lato': { group: '산세리프 · 깔끔', label: 'Lato' },
    'CCE DM Sans': { group: '산세리프 · 깔끔', label: 'DM Sans' },
    'CCE Poppins': { group: '산세리프 · 깔끔', label: 'Poppins' },
    'CCE Montserrat': { group: '산세리프 · 깔끔', label: 'Montserrat' },
    'CCE Nunito': { group: '둥글 · 손글씨', label: 'Nunito' },
    'CCE Caveat': { group: '둥글 · 손글씨', label: 'Caveat' }
  };
  if (settings.enFont === 'serif') settings.enFont = 'CCE Lora';
  if (settings.enFont === 'sans') settings.enFont = 'CCE Inter';
  if (!FONT_SETS[settings.font]) settings.font = 'noto';
  function fontSet() {
    const set = FONT_SETS[settings.font] || FONT_SETS.noto;
    const en = settings.enFont !== 'auto' && EN_FONTS[settings.enFont] ? settings.enFont : set.en;
    return { set, en, family: [en, set.kr, 'CC Sans'].filter(Boolean).map(f => `"${f}"`).join(', ') + ', ' + set.generic };
  }

  let fontFailed = false, fontVersion = 0;
  const cssCache = new Map();
  const fontJobs = new Map();
  function parseRanges(str) {
    return str.split(',').map(s => s.trim().replace(/^U\+/i, '')).filter(Boolean).map(s => {
      if (s.includes('-')) { const [a, b] = s.split('-'); return [parseInt(a, 16), parseInt(b, 16)]; }
      if (s.includes('?')) return [parseInt(s.replace(/\?/g, '0'), 16), parseInt(s.replace(/\?/g, 'F'), 16)];
      const v = parseInt(s, 16); return [v, v];
    });
  }
  function pickUrl(srcText, base) {
    const list = [];
    srcText.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)\s*(?:format\(\s*['"]?([^'")]+)['"]?\s*\))?/g, (m, u, f) => { list.push({ u, f: (f || u.split('?')[0].split('.').pop() || '').toLowerCase() }); return m; });
    const rank = f => (f.includes('woff2') ? 0 : f.includes('woff') ? 1 : /truetype|opentype|ttf|otf/.test(f) ? 2 : 9);
    list.sort((a, b) => rank(a.f) - rank(b.f));
    const best = list.find(x => rank(x.f) < 9);
    if (!best) return null;
    try { return new URL(best.u, base).href; } catch (e) { return null; }
  }
  function faceList(src, def) {
    if (def && def.file) return Promise.resolve([{ fam: def.fam, weight: '400', url: def.file, rangeStr: 'U+0-10FFFF', ranges: [[0, 0x10FFFF]] }]);
    if (!cssCache.has(src)) {
      cssCache.set(src, netGet(src, 'text').then(css => css.split('@font-face').slice(1).map(block => {
        const fam = ((block.match(/font-family:\s*([^;}]+)/) || [])[1] || '').replace(/['"]/g, '').trim();
        let weight = ((block.match(/font-weight:\s*([^;}]+)/) || [])[1] || '400').trim().split(/\s+/)[0];
        if (weight === 'normal') weight = '400';
        if (weight === 'bold') weight = '700';
        const srcText = (block.match(/src:\s*([^;}]+)/) || [])[1] || '';
        const url = pickUrl(srcText, src);
        const range = ((block.match(/unicode-range:\s*([^;}]+)/) || [])[1] || 'U+0-10FFFF').trim();
        return { fam, weight, url, rangeStr: range, ranges: parseRanges(range) };
      }).filter(f => f.url)).catch(() => { cssCache.delete(src); return null; }));
    }
    return cssCache.get(src);
  }
  // needs: [{ alias, weight, text }]
  async function ensureFonts(needs) {
    const jobs = [];
    for (const need of needs) {
      if (!need.text || !FONT_SRC[need.alias]) continue;
      const def = FONT_SRC[need.alias];
      const list = await faceList(def.src, def);
      if (!list) { if (need.core) fontFailed = true; continue; }
      const cps = new Set();
      for (const ch of need.text + '0123456789/ ') cps.add(ch.codePointAt(0));
      let faces;
      if (def.famBold) faces = list.filter(f => f.fam === (need.weight === '700' ? def.famBold : def.fam));
      else {
        faces = list.filter(f => f.fam === def.fam && f.weight === need.weight);
        if (!faces.length && need.weight === '700') continue; // 굵은 글꼴이 없으면 흉내 낸 굵게로
        if (!faces.length) faces = list.filter(f => f.fam === def.fam);
      }
      for (const f of faces) {
        const key = need.alias + '|' + f.weight + '|' + f.url;
        if (fontJobs.has(key)) { jobs.push(fontJobs.get(key)); continue; }
        if (!Array.from(cps).some(cp => f.ranges.some(([a, b]) => cp >= a && cp <= b))) continue;
        const job = netGet(f.url, 'arraybuffer')
          .then(buf => new FontFace(need.alias, buf, { weight: need.weight, unicodeRange: f.rangeStr }).load())
          .then(ff => { document.fonts.add(ff); fontVersion++; })
          .catch(() => { fontJobs.delete(key); });
        fontJobs.set(key, job);
        jobs.push(job);
      }
    }
    await Promise.all(jobs);
  }

  const mctx = document.createElement('canvas').getContext('2d');
  const mcache = new Map();
  let mcacheVersion = -1;
  function measure(font, text) {
    if (mcacheVersion !== fontVersion) { mcache.clear(); R.clearMetrics(); mcacheVersion = fontVersion; }
    const k = font + '\u0001' + text;
    let v = mcache.get(k);
    if (v === undefined) { mctx.font = font; v = mctx.measureText(text).width; mcache.set(k, v); }
    return v;
  }

  /* ---------- 화면 뼈대 (Shadow DOM: 크랙 스타일과 안 섞이게) ---------- */
  const ICON = {
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.4A2.4 2.4 0 0 1 6.4 5h1.2L9 3.5h6L16.4 5h1.2A2.4 2.4 0 0 1 20 7.4v9.2a2.4 2.4 0 0 1-2.4 2.4H6.4A2.4 2.4 0 0 1 4 16.6z"/><path d="M12 16.4c-2.9-1.8-4.3-3.2-4.3-4.8 0-1.1.8-1.9 1.9-1.9.9 0 1.7.5 2.4 1.3.7-.8 1.5-1.3 2.4-1.3 1.1 0 1.9.8 1.9 1.9 0 1.6-1.4 3-4.3 4.8z" fill="#FF6E9A" stroke="#FF6E9A" stroke-width="1.1"/></svg>',
    name: '<svg viewBox="0 0 24 24"><path d="M4 7h9M4 12h6M4 17h9"/><path d="m15 9 5 3-5 3"/></svg>',
    deco: '<svg viewBox="0 0 24 24"><path d="m14.5 4.5 5 5L9 20H4v-5z"/><path d="m12.5 6.5 5 5"/></svg>',
    look: '<svg viewBox="0 0 24 24"><path d="M5 19 12 5l7 14"/><path d="M8 13h8"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };

  const host = document.createElement('div');
  host.id = 'cc-capture-host';
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${CC_CSS}</style><div class="cc-root" id="root">
  <button class="cc-run hidden" id="cc-run" type="button" title="캡처 시작" aria-label="하트카메라 캡처 실행">${ICON.camera}</button>
  <div class="pickbar hidden" id="pickbar">
    <div class="step" id="pk-step">1</div>
    <div class="msg"><b id="pk-title"></b><span id="pk-sub"></span></div>
    <button class="pill" id="pk-cancel">취소</button>
  </div>

  <div class="app hidden" id="app">
    <nav class="nav">
      <div class="left">
        <button class="icon-btn" id="close" aria-label="닫기">${ICON.close}</button>
        <button class="icon-btn" id="undo" aria-label="되돌리기" disabled>${ICON.undo}</button>
      </div>
      <div class="title"><b>캡처 편집</b><small id="summary"></small></div>
      <div class="right"><button class="btn-text bold" id="open-editor">글 고치기</button></div>
    </nav>
    <div class="pages" id="pages"><div class="loading"><div class="spinner"></div>글꼴을 준비하는 중…</div></div>

    <div class="toolbar hidden" id="toolbar">
      <div class="tb-top">
        <div class="seg" id="tool-seg"><button data-t="hl">형광펜</button><button data-t="ul">밑줄</button><button data-t="st">스티커</button></div>
        <button class="done-btn" id="tool-done">끝내기</button>
      </div>
      <div id="mark-opts">
        <div class="colors" id="colors"></div>
        <div class="alpha-row"><span>진하기</span><input type="range" id="alpha" min="20" max="100" step="5"><b id="alpha-v"></b></div>
        <div class="seg ul-seg" id="ul-style"><button data-v="line">반듯</button><button data-v="wave">물결</button><button data-v="marker">형광</button><button data-v="dot">점선</button><button data-v="double">두 줄</button></div>
      </div>
      <div class="tb-hint" id="tool-hint"></div>
    </div>

    <div class="tabbar">
      <button class="tab" data-tab="name">${ICON.name}이름</button>
      <button class="tab" data-tab="deco">${ICON.deco}꾸미기</button>
      <button class="tab" data-tab="look">${ICON.look}모양</button>
      <button class="tab save" data-tab="save"><span class="bubble">${ICON.save}</span>저장</button>
    </div>
  </div>

  <div class="backdrop hidden" id="backdrop"></div>

  <div class="sheet hidden" id="sheet-name">
    <div class="grabber"></div>
    <div class="sheet-nav"><span></span><b>이름 바꾸기</b><button class="btn-text bold" data-close>완료</button></div>
    <div class="sheet-body">
      <div class="group" id="rules"></div>
      <div class="group mt12"><button class="row blue add-row" id="rule-add"><span class="plus">＋</span><span class="label">바꿀 이름 추가</span></button></div>
      <div class="group mt12">
        <div class="row col"><span class="label">★ 이름 색상 강조 범위</span>
          <div class="seg" data-seg="starScope"><button data-v="dialogue">대사 안만</button><button data-v="all">전체 원고</button></div></div>
      </div>
      <p class="foot">★은 이름에 <b>색상만</b> 입혀요(원래 굵기는 그대로). 기본값인 <b>대사 안만</b>은 “ ”, 「 」, " " 안의 이름이나 수동으로 ‘대사’ 지정한 문단에만 적용되고, 서술·속마음·상태창의 이름은 강조하지 않아요.<br>왼쪽은 원래 이름, 오른쪽은 바꿀 이름이에요. 이름 자체를 바꾸는 기능은 기존처럼 전체 원고에 적용됩니다. 색만 바꾸려면 양쪽에 같은 이름을 적으세요. 조사도 자동으로 맞춰요.</p>
    </div>
  </div>

  <div class="sheet hidden" id="sheet-look">
    <div class="grabber"></div>
    <div class="sheet-nav"><span></span><b>모양</b><button class="btn-text bold" data-close>완료</button></div>
    <div class="sheet-body">
      <div class="group themes" id="themes"></div>
      <div class="group mt12">
        <div class="row col"><span class="label">테마 꾸밈</span>
          <div class="seg" data-seg="decor"><button data-v="simple">심플</button><button data-v="deco">꾸밈</button></div></div>
      </div>
      <div class="group mt12">
        <div class="row col"><span class="label">대사 표시</span>
          <div class="seg" data-seg="dialogueStyle"><button data-v="bar">세로선</button><button data-v="bubble">말풍선</button><button data-v="color">글자색</button></div></div>
        <button class="row link" id="open-font"><span class="label">글꼴</span><span class="value" id="font-v"></span><span class="chev">›</span></button>
        <button class="row link" id="open-enfont"><span class="label">영어 글꼴</span><span class="value" id="enfont-v"></span><span class="chev">›</span></button>
        <div class="row"><span class="label">글자 크기 <b id="fs-v" style="color:var(--label2);font-weight:500"></b></span>
          <div class="stepper"><button id="fs-minus">−</button><button id="fs-plus">＋</button></div></div>
        <div class="row col"><span class="label">나누기</span>
          <div class="seg" data-seg="pageMode"><button data-v="long">길게 한 장</button><button data-v="4:5">4:5</button><button data-v="9:16">9:16</button></div></div>
      </div>
      <p class="foot">길게 한 장도 너무 길면 알아서 몇 장으로 나눠요. 4:5는 인스타그램 게시물, 9:16은 스토리 크기예요.</p>
    </div>
  </div>

  <div class="sheet short hidden" id="sheet-sticker">
    <div class="grabber"></div>
    <div class="sheet-nav"><button class="btn-text" data-close>취소</button><b id="st-title">스티커 글씨</b><button class="btn-text bold" id="st-ok">붙이기</button></div>
    <div class="sheet-body">
      <textarea class="st-input" id="st-text" rows="2" maxlength="80" placeholder="주접 한마디 (예: 미쳤다 진짜…)"></textarea>
      <div class="st-styles mt12" id="st-styles">
        <button class="st-style" data-s="hand"><span class="pv hand">손글씨</span></button>
        <button class="st-style" data-s="bubble"><span class="pv bubble">말풍선</span></button>
        <button class="st-style" data-s="neon"><span class="pv neon">네온</span></button>
      </div>
      <div class="group mt12">
        <div class="row col"><span class="label">크기</span><div class="seg" id="st-size"><button data-v="s">작게</button><button data-v="m">보통</button><button data-v="l">크게</button></div></div>
        <div class="row col"><span class="label">기울기</span><div class="seg" id="st-rot"><button data-v="-7">↖ 왼쪽</button><button data-v="0">똑바로</button><button data-v="7">오른쪽 ↗</button></div></div>
      </div>
      <button class="btn-gray mt12 hidden" id="st-del" style="color:var(--red)">스티커 지우기</button>
      <p class="foot">붙인 뒤에는 손가락으로 끌어서 옮길 수 있어요. 누르면 다시 고칠 수 있어요.</p>
    </div>
  </div>

  <div class="sheet short hidden" id="sheet-save">
    <div class="grabber"></div>
    <div class="sheet-nav"><span></span><b id="save-title">저장 준비 완료</b><button class="btn-text bold" data-close>닫기</button></div>
    <div class="sheet-body">
      <div class="thumbs" id="thumbs"></div>
      <div class="seg fmt" id="fmt"><button data-v="webp">WebP · 가볍고 선명</button><button data-v="png">PNG · 원본 그대로</button></div>
      <p class="save-info" id="save-info"></p>
      <button class="btn-fill" id="save-share">사진첩에 저장 · 공유</button>
      <button class="btn-gray mt12" id="save-file">파일로 내려받기</button>
      <button class="btn-gray mt12 hidden" id="save-copy">이미지 복사하기</button>
    </div>
  </div>

  <div class="sheet short hidden" id="sheet-choice">
    <div class="grabber"></div>
    <div class="sheet-body choice">
      <b id="cs-title"></b><p id="cs-text"></p>
      <div id="cs-options"></div>
      <button class="btn-gray mt12" data-close>취소</button>
    </div>
  </div>

  <div class="sheet hidden" id="sheet-font">
    <div class="grabber"></div>
    <div class="sheet-nav"><button class="btn-text" id="font-back">‹ 모양</button><b id="font-title">글꼴</b><span></span></div>
    <div class="sheet-body" id="font-list"></div>
  </div>

  <div class="editor hidden" id="editor">
    <nav class="nav">
      <div class="left"><button class="btn-text" id="ed-cancel">취소</button></div>
      <div class="title"><b>글 고치기</b></div>
      <div class="right"><button class="btn-text bold" id="ed-done">완료</button></div>
    </nav>
    <div class="ed-body" id="ed-body"></div>
  </div>

  <div class="hud hidden" id="hud"><div class="spinner"></div><span id="hud-text">만드는 중…</span></div>
  <div class="toast hidden" id="toast"></div>
</div>`;

  // 모바일/PC 공통: 실제 보이는 화면 하단에 작은 하트카메라 버튼 하나만 표시.
  const launcherStyle = document.createElement('style');
  launcherStyle.textContent = `
    .cc-run {
      position: absolute; left: 50%; bottom: calc(8px + var(--safe-b));
      transform: translateX(-50%); z-index: 2;
      width: 38px; height: 34px; padding: 5px;
      display: grid; place-items: center;
      border: 1px solid rgba(120,120,128,.25); border-radius: 9px;
      background: rgba(255,255,255,.96); color: #35353B;
      font-size: 12px; font-weight: 600; line-height: 1;
      box-shadow: 0 1px 5px rgba(0,0,0,.12);
      touch-action: manipulation; -webkit-appearance: none;
    }
    .cc-run svg { width: 24px; height: 24px; display: block; pointer-events: none; }
    .cc-run:active { opacity: .7; }
    .cc-run:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
    @media (prefers-color-scheme: dark) {
      .cc-run { background: rgba(38,38,41,.96); color: #F4F4F6; border-color: rgba(255,255,255,.15); }
    }
  `;
  shadow.appendChild(launcherStyle);

  const $ = id => shadow.getElementById(id);
  const qa = sel => Array.from(shadow.querySelectorAll(sel));
  const root = $('root');

  function mount() { if (document.body && !host.isConnected) document.body.appendChild(host); }
  mount();
  setInterval(mount, 1500);

  // 화면에 실제로 보이는 영역(visual viewport)에 맞춰 붙인다.
  // 폰에서 페이지가 옆으로 넓거나 키보드가 올라와도 버튼과 시트가 화면 안에 있게.
  function fitRoot() {
    const vv = window.visualViewport;
    const st = root.style;
    if (vv) {
      st.left = vv.offsetLeft + 'px';
      st.top = vv.offsetTop + 'px';
      st.width = vv.width + 'px';
      st.height = vv.height + 'px';
    } else {
      st.left = '0px'; st.top = '0px'; st.width = window.innerWidth + 'px'; st.height = window.innerHeight + 'px';
    }
  }
  fitRoot();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitRoot);
    window.visualViewport.addEventListener('scroll', fitRoot);
  }
  window.addEventListener('resize', fitRoot);
  window.addEventListener('scroll', fitRoot, { passive: true });

  // 편집 화면에서 친 글자가 크랙 화면으로 새어 나가지 않게
  ['keydown', 'keyup', 'keypress', 'input', 'paste', 'copy', 'cut', 'beforeinput'].forEach(type =>
    root.addEventListener(type, e => { if (editorOpen) e.stopPropagation(); }));

  let toastTimer = null;
  function toast(text, ms) {
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 2400);
  }
  function hud(text) {
    if (text) { $('hud-text').textContent = text; $('hud').classList.remove('hidden'); } else $('hud').classList.add('hidden');
  }

  /* ======================= 1. 크랙 화면: 문단 고르기 ======================= */
  let stage = 'idle';
  let start = null; // { el, bubble, role, blocks }
  let editorOpen = false;

  const pageStyle = document.createElement('style');
  pageStyle.textContent = `
    body.cc-picking ${P.SELECTORS.bubble} :is(p, li, h1, h2, h3, h4, h5, h6, pre, table, blockquote, hr, img, .not-wrtn-markdown, .wrtn-codeblock),
    body.cc-picking .cc-unit-self { cursor: pointer !important; border-radius: 6px; transition: background-color .12s, box-shadow .12s; }
    body.cc-picking ${P.SELECTORS.bubble} :is(p, li, h1, h2, h3, h4, h5, h6, pre, table, blockquote, .not-wrtn-markdown, .wrtn-codeblock):hover { background-color: rgba(0,122,255,.10) !important; box-shadow: 0 0 0 3px rgba(0,122,255,.10) !important; }
    body.cc-picking .cc-start { background-color: rgba(255,159,10,.20) !important; box-shadow: 0 0 0 3px rgba(255,159,10,.35) !important; }
    body.cc-picking .cc-picked { background-color: rgba(0,122,255,.16) !important; box-shadow: 0 0 0 3px rgba(0,122,255,.16) !important; }
`;
  (document.head || document.documentElement).appendChild(pageStyle);

  function showBar(step, title, sub, o) {
    o = o || {};
    $('pickbar').classList.remove('hidden');
    $('pk-step').textContent = step;
    $('pk-step').className = 'step' + (o.orange ? ' orange' : '');
    $('pk-title').textContent = title;
    $('pk-sub').textContent = sub;
  }

  function startPicking() {
    if (editorOpen) return;
    if (!P.getBubbles().length) { toast('메시지를 찾지 못했어요. 크랙 채팅방에서 눌러 주세요.'); return; }
    stopPicking(true);
    stage = 'start';
    document.body.classList.add('cc-picking');
    updateLauncher();
    showBar('1', '시작 문단을 눌러 주세요', '캡처할 부분의 첫 문단이에요', {});
  }
  function stopPicking(silent) {
    stage = 'idle';
    if (start && start.el) start.el.classList.remove('cc-start');
    start = null;
    document.querySelectorAll('.cc-picked, .cc-start').forEach(el => el.classList.remove('cc-picked', 'cc-start'));
    document.body.classList.remove('cc-picking');
    $('pickbar').classList.add('hidden');
    if (!silent) updateLauncher();
  }
  $('pk-cancel').addEventListener('click', () => stopPicking());

  function unitFromEvent(e) {
    const bubble = e.target.closest && e.target.closest(P.SELECTORS.bubble);
    if (!bubble) return null;
    const units = P.getUnits(bubble);
    const el = units.find(u => u === e.target || u.contains(e.target)) || (units.length === 1 ? units[0] : null);
    if (!el) return null;
    return { el, bubble };
  }

  document.addEventListener('click', e => {
    if (stage === 'idle') return;
    if (e.composedPath().includes(host)) return;
    const u = unitFromEvent(e);
    if (!u) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (stage === 'start') {
      start = { el: u.el, bubble: u.bubble, role: P.getRole(u.bubble), blocks: P.parseUnit(u.el) };
      u.el.classList.add('cc-start');
      stage = 'end';
      showBar('2', '끝 문단을 눌러 주세요', '스크롤해서 찾아도 돼요 · 같은 문단을 또 누르면 그 문단만', { orange: true });
      return;
    }
    // 끝 문단
    const all = P.getAllUnits();
    let a = all.findIndex(x => x.el === start.el);
    const b = all.findIndex(x => x.el === u.el);
    if (b === -1) return;
    let list;
    if (a === -1) list = [start].concat(all.slice(0, b + 1)); // 시작 문단이 화면에서 사라졌을 때
    else list = all.slice(Math.min(a, b), Math.max(a, b) + 1);
    list.forEach(x => x.el && x.el.classList && x.el.classList.add('cc-picked'));
    const messages = P.collectUnits(list);
    setTimeout(() => {
      stopPicking(true);
      if (!messages.length) { toast('가져올 내용이 없어요.'); updateLauncher(); return; }
      openEditor({ messages, meta: { url: location.href, at: Date.now() }, edits: {} });
    }, 180);
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && stage !== 'idle') stopPicking(); }, true);

  /* ---------- 캡처 실행 버튼: 화면 하단 고정 ---------- */
  $('cc-run').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation(); startPicking();
  });
  function updateLauncher() {
    $('cc-run').classList.toggle('hidden', editorOpen || stage !== 'idle');
  }
  updateLauncher();

  // 탬퍼몽키 메뉴에서도 시작할 수 있게
  try {
    if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('📷 익명 캡처 시작', startPicking);
    else if (typeof GM !== 'undefined' && GM && typeof GM.registerMenuCommand === 'function') GM.registerMenuCommand('📷 익명 캡처 시작', startPicking);
  } catch (e) { /* 무시 */ }

  /* ======================= 2. 편집 화면 ======================= */
  let doc = null, edits = null, undoStack = [];
  const images = new Map();
  let current = null;
  let prevOverflow = ['', ''];

  function normEdits(e) {
    e = e || {};
    return { overrides: e.overrides || {}, kind: e.kind || {}, hidden: e.hidden || {}, marks: e.marks || {}, stickers: e.stickers || [] };
  }

  function openEditor(d) {
    doc = d;
    edits = normEdits(d.edits);
    undoStack = [];
    editorOpen = true;
    updateLauncher();
    $('app').classList.remove('hidden');
    prevOverflow = [document.documentElement.style.overflow, document.body.style.overflow];
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    $('pages').innerHTML = '<div class="loading"><div class="spinner"></div>글꼴을 준비하는 중…</div>';
    setTool(null);
    updateUndo();
    loadImages().then(() => scheduleRefresh(0));
    scheduleRefresh(0);
  }
  function closeEditor() {
    closeSheets();
    setTool(null);
    editorOpen = false;
    $('app').classList.add('hidden');
    document.documentElement.style.overflow = prevOverflow[0];
    document.body.style.overflow = prevOverflow[1];
    updateLauncher();
  }
  $('close').addEventListener('click', async () => {
    if (!undoStack.length) { closeEditor(); return; }
    const ok = await choose('편집을 끝낼까요?', '닫으면 지금까지 꾸민 내용은 사라져요.', [{ label: '끝내기', value: true, red: true }]);
    if (ok) closeEditor();
  });

  function change(fn) {
    undoStack.push(JSON.stringify(edits));
    if (undoStack.length > 60) undoStack.shift();
    fn(edits);
    updateUndo();
    scheduleRefresh(0);
  }
  function updateUndo() { $('undo').disabled = !undoStack.length; }
  $('undo').addEventListener('click', () => {
    if (!undoStack.length) return;
    edits = normEdits(JSON.parse(undoStack.pop()));
    pendingMark = null;
    updateUndo(); scheduleRefresh(0);
    toast('되돌렸어요', 1100);
  });

  async function loadImages() {
    const srcs = new Set();
    doc.messages.forEach(m => m.blocks.forEach(b => { if (b.type === 'img' && b.src) srcs.add(b.src); }));
    let failed = 0;
    await Promise.all(Array.from(srcs).map(async src => {
      if (images.has(src)) return;
      try {
        const blob = src.startsWith('data:') ? await (await fetch(src)).blob() : await netGet(src, 'blob');
        images.set(src, await createImageBitmap(blob));
      } catch (e) { failed++; }
    }));
    if (failed) toast(`이미지 ${failed}개를 못 불러와서 빼고 만들어요`, 3000);
  }

  /* ---------- 글 만들기 ---------- */
  const activeRules = () => T.cleanRules(settings.rules);
  const starNames = () => settings.rules.filter(r => r.star).map(r => (r.to || '').trim() || (r.from || '').trim()).filter(Boolean);

  function finalRuns(mi, bi) {
    const block = doc.messages[mi].blocks[bi];
    const ov = edits.overrides[mi + '.' + bi];
    if (ov) {
      const fresh = activeRules().filter(r => !ov.rules.includes(T.ruleKey(r)));
      return T.applyReplacements(ov.runs, fresh, { particles: true });
    }
    return T.applyReplacements(T.tidyRuns(block.runs || [], { punctuation: true }), activeRules(), { particles: true });
  }

  function buildModel() {
    const turns = [];
    const texts = {};
    const order = [];
    const names = starNames();
    doc.messages.forEach((m, mi) => {
      const turn = { id: 't' + mi, role: m.role, label: '', blocks: [] };
      m.blocks.forEach((b, bi) => {
        const pid = mi + '.' + bi;
        if (edits.hidden[pid]) return;
        if (b.type === 'p' || b.type === 'status') {
          let runs = finalRuns(mi, bi);
          const full = T.plainText(runs);
          if (!full.trim()) return;
          texts[pid] = full;
          order.push(pid);
          runs = T.applyMarks(runs, edits.marks[pid]);
          // 상태창은 이름 강조 대상에서 제외 (대사/서술 구분 대상이 아님)
          if (b.type === 'status') { turn.blocks.push({ pid, mi, type: 'status', runs }); return; }
          const force = edits.kind[pid];
          // 대사 여부를 먼저 판별해야 ★가 서술 부분까지 퍼지지 않는다.
          runs = T.classifyRuns(runs, { italicThought: true, force });
          runs = T.applyEmphasis(runs, names, { dialogueOnly: settings.starScope !== 'all' });
          const pieces = force ? [runs] : T.splitDialogue(runs);
          const offs = T.pieceOffsets(full, pieces);
          // 이름/구분자 패턴은 인물마다 달라서 해석하지 않고 원문 그대로 보존한다.
          pieces.forEach((pc, i) => {
            turn.blocks.push({ pid, mi, type: 'p', kind: T.kindOf(pc), runs: pc, off: offs[i] });
          });
        } else if (b.type === 'img') {
          const im = images.get(b.src);
          if (im) { turn.blocks.push({ pid, mi, type: 'img', key: b.src, w: im.width, h: im.height }); order.push(pid); }
        } else if (b.type === 'hr') {
          turn.blocks.push({ pid, mi, type: 'hr' });
          order.push(pid);
        }
      });
      if (turn.blocks.length) turns.push(turn);
    });
    return { turns, texts, order };
  }

  const RATIO = { long: 0, '4:5': 1.25, '9:16': 16 / 9 };
  const frameSize = () => 0;
  const OW = page => page.w + 2 * (page.frame || 0);
  const OH = page => page.h + 2 * (page.frame || 0);
  function layoutOpts() {
    const F = frameSize();
    const maxH = Math.floor(Math.min(MAX_SIDE, MAX_PIXELS / (PAGE_W * SCALE)) / SCALE) - 2 * F;
    const ratio = RATIO[settings.pageMode] || 0;
    L.FAMILIES.body = fontSet().family;
    return {
      width: PAGE_W - 2 * F, pageHeight: ratio ? Math.round(PAGE_W * ratio) - 2 * F : 0,
      fontSize: settings.fontSize, lineHeight: 'normal', font: 'body', dialogueStyle: settings.dialogueStyle,
      indent: false, showLabels: false, pageMode: settings.pageMode, maxLongHeight: maxH, title: '', pageNumbers: true
    };
  }
  const look = () => ({ theme: settings.theme, dialogueStyle: settings.dialogueStyle, muteNarration: true, pageNumbers: true, pattern: 'none', decor: settings.decor });

  function fontNeeds(model) {
    const fs = fontSet();
    let reg = '', bold = '', small = '', hand = '';
    model.turns.forEach(t => t.blocks.forEach(b => {
      if (!b.runs) return;
      for (const r of b.runs) {
        if (b.type === 'status') small += r.t;
        else if (r.b) bold += r.t; else reg += r.t;
      }
    }));
    edits.stickers.forEach(st => { if (st.style === 'hand') hand += st.text; else small += st.text; });
    const latin = t => t.replace(/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/g, '');
    const needs = [
      { alias: fs.set.kr, weight: '400', text: reg + bold, core: true },
      { alias: fs.set.kr, weight: '700', text: bold },
      { alias: 'CC Sans', weight: '400', text: small + reg.slice(0, 1), core: true },
      { alias: 'CC Sans', weight: '700', text: small },
      { alias: 'CC Hand', weight: '400', text: hand }
    ];
    if (fs.en) needs.push({ alias: fs.en, weight: '400', text: latin(reg + bold) }, { alias: fs.en, weight: '700', text: latin(bold) });
    return needs;
  }

  /* ---------- 스티커 위치 ---------- */
  function anchorY(page, pid) {
    let y = Infinity;
    for (const it of page.items) if (it.pid === pid && it.y < y) y = it.y;
    return y === Infinity ? null : y + current.opt.margin;
  }
  function placeStickers() {
    current.pages.forEach(p => { p.stickers = []; });
    for (const st of edits.stickers) {
      for (const page of current.pages) {
        const ay = anchorY(page, st.pid);
        if (ay === null) continue;
        page.stickers.push(Object.assign({}, st, { y: Math.max(8, Math.min(page.h - 8, ay + st.dy)), x: Math.max(8, Math.min(page.w - 8, st.x)), ref: st }));
        break;
      }
    }
  }
  function nearestPid(page, y) {
    const cy = y - current.opt.margin;
    let best = null, bd = Infinity;
    for (const it of page.items) {
      if (!it.pid) continue;
      const d = cy < it.y ? it.y - cy : cy > it.y + it.h ? cy - it.y - it.h : 0;
      if (d < bd) { bd = d; best = it.pid; }
    }
    return best;
  }

  /* ---------- 다시 그리기 ---------- */
  let refreshTimer = null, refreshToken = 0;
  function scheduleRefresh(delay) { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, delay === undefined ? 140 : delay); }
  async function refresh() {
    if (!editorOpen || !doc) return;
    const token = ++refreshToken;
    const model = buildModel();
    await ensureFonts(fontNeeds(model));
    if (token !== refreshToken || !editorOpen) return;
    if (fontFailed && !refresh.warned) { refresh.warned = true; toast('글꼴을 못 불러와서 기본 글꼴로 보여요. 인터넷 연결을 확인해 주세요.', 3600); }
    current = L.layout(model, layoutOpts(), measure);
    current.model = model;
    const F = frameSize();
    current.pages.forEach(p => { p.frame = F; });
    placeStickers();
    renderPreview();
    const n = current.pages.length;
    $('summary').textContent = model.turns.length ? `${n}장 · ${settings.format === 'png' ? 'PNG' : 'WebP'}` : '';
  }

  function cssWidth(page) {
    const avail = $('pages').clientWidth - 24;
    return Math.min(OW(page), Math.max(240, avail));
  }
  function drawPage(i) {
    const page = current.pages[i];
    const wrap = $('pages').children[i];
    if (!page || !wrap) return;
    const canvas = wrap.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const s = canvas.width / OW(page);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    R.renderPage(ctx, page, current.opt, look(), images, current.pages.length);
  }
  function renderPreview() {
    const box = $('pages');
    const pages = current.pages;
    if (!current.model.turns.length) {
      box.innerHTML = '<div class="loading">보일 내용이 없어요.<br>‘글 고치기’에서 숨긴 문단을 되살려 보세요.</div>';
      return;
    }
    if (box.querySelector('.loading')) box.innerHTML = '';
    while (box.children.length > pages.length) box.lastChild.remove();
    while (box.children.length < pages.length) box.appendChild(makePageWrap());
    const dpr = Math.min(IS_MOBILE ? 2 : 2, window.devicePixelRatio || 1);
    pages.forEach((page, i) => {
      const wrap = box.children[i];
      wrap.dataset.index = i;
      const canvas = wrap.querySelector('canvas');
      const cw = cssWidth(page), ch = cw * OH(page) / OW(page);
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      drawPage(i);
      wrap.querySelector('.page-tag').textContent = pages.length > 1 ? `${i + 1} / ${pages.length}` : '';
    });
    drawPending();
  }

  function pageCoords(wrap, e) {
    const page = current && current.pages[Number(wrap.dataset.index)];
    if (!page) return null;
    const rect = wrap.querySelector('canvas').getBoundingClientRect();
    const k = OW(page) / rect.width;
    const F = page.frame || 0;
    return { page, idx: Number(wrap.dataset.index), x: (e.clientX - rect.left) * k - F, y: (e.clientY - rect.top) * k - F, k, F };
  }
  function stickerAt(page, x, y) {
    const list = page.stickers || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i].box;
      if (!b) continue;
      const dx = x - b.cx, dy = y - b.cy;
      const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
      const rx = dx * c - dy * s, ry = dx * s + dy * c;
      if (Math.abs(rx) <= b.w / 2 + 8 && Math.abs(ry) <= b.h / 2 + 8) return list[i];
    }
    return null;
  }

  function makePageWrap() {
    const wrap = document.createElement('div');
    wrap.className = 'page-wrap';
    wrap.innerHTML = '<div class="page-tag"></div><canvas></canvas>';
    const canvas = wrap.querySelector('canvas');
    let press = null;

    const begin = e => {
      const pc = pageCoords(wrap, e);
      if (!pc) return;
      const st = stickerAt(pc.page, pc.x, pc.y);
      press = { x: e.clientX, y: e.clientY, pc, st, moved: false, ox: st ? pc.x - st.x : 0, oy: st ? pc.y - st.y : 0 };
    };
    canvas.addEventListener('pointerdown', e => { if (e.button === 0 || e.pointerType !== 'mouse') begin(e); });
    // 스티커를 잡으면 화면이 스크롤되지 않게
    canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      const pc = pageCoords(wrap, t);
      if (pc && stickerAt(pc.page, pc.x, pc.y)) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('pointermove', e => {
      if (!press) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) press.moved = true;
      if (press.st && press.moved) {
        const pc = pageCoords(wrap, e);
        press.st.x = Math.max(10, Math.min(pc.page.w - 10, pc.x - press.ox));
        press.st.y = Math.max(10, Math.min(pc.page.h - 10, pc.y - press.oy));
        drawPage(pc.idx);
      }
    });
    const end = () => {
      if (!press) return;
      const p = press;
      press = null;
      if (p.st && p.moved) {
        const page = p.pc.page;
        const pid = nearestPid(page, p.st.y);
        const ay = anchorY(page, pid);
        const id = p.st.ref.id;
        change(ed => {
          const s = ed.stickers.find(x => x.id === id);
          if (s && pid !== null && ay !== null) { s.pid = pid; s.dy = p.st.y - ay; s.x = p.st.x; }
        });
        return;
      }
      if (p.moved) return;
      if (p.st) { openStickerSheet(p.st.ref); return; }
      onTap(p.pc, wrap);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', () => { if (press && press.st && press.moved) end(); press = null; });
    return wrap;
  }

  /* ---------- 누르기 ---------- */
  function hitText(pc) {
    const it = L.hitTest(pc.page, current.opt, pc.x, pc.y);
    if (!it) return null;
    if (it.kind !== 'line' || !it.line) return { it };
    const ch = L.charAt(it, pc.x - current.opt.margin, measure);
    return { it, index: ch ? ch.index : null };
  }

  function onTap(pc, wrap) {
    hideKindPop();
    if (tool === 'st') { openStickerSheet(null, pc); return; }
    const h = hitText(pc);
    if (tool === 'hl' || tool === 'ul') { if (h && h.index !== null && h.index !== undefined) onMarkTap(h.it.pid, h.index); return; }
    if (!h) return;
    const blk = blockOf(h.it.pid);
    if (blk && blk.type === 'p') showKindPop(h.it.pid, wrap, pc);
  }

  function blockOf(pid) {
    const [mi, bi] = pid.split('.').map(Number);
    return doc.messages[mi] && doc.messages[mi].blocks[bi];
  }

  /* 대사 구분 */
  let kindPop = null;
  function hideKindPop() { if (kindPop) { kindPop.remove(); kindPop = null; } }
  function showKindPop(pid, wrap, pc) {
    hideKindPop();
    const pop = document.createElement('div');
    pop.className = 'kind-pop';
    const cur = edits.kind[pid] || 'auto';
    [['auto', '자동'], ['d', '대사'], ['n', '서술'], ['t', '속마음']].forEach(([k, label]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.classList.toggle('on', k === cur);
      b.addEventListener('click', () => {
        hideKindPop();
        if (k === cur) return;
        change(ed => { if (k === 'auto') delete ed.kind[pid]; else ed.kind[pid] = k; });
        toast(k === 'auto' ? '자동으로 구분해요' : `‘${label}’로 바꿨어요`, 1200);
      });
      pop.appendChild(b);
    });
    const box = $('pages');
    box.appendChild(pop);
    const z = 1 / pc.k;
    const canvas = wrap.querySelector('canvas');
    const top = wrap.offsetTop + canvas.offsetTop + (pc.y + pc.F) * z - pop.offsetHeight - 14;
    const left = Math.max(8, Math.min(box.clientWidth - pop.offsetWidth - 8, wrap.offsetLeft + (pc.x + pc.F) * z - pop.offsetWidth / 2));
    pop.style.top = Math.max(box.scrollTop + 6, top) + 'px';
    pop.style.left = left + 'px';
    kindPop = pop;
  }
  $('pages').addEventListener('scroll', hideKindPop, { passive: true });

  /* ---------- 꾸미기 도구 ---------- */
  let tool = null; // 'hl' | 'ul' | 'st' | null
  let pendingMark = null; // { pid, a, b }
  function setTool(t) {
    tool = t;
    pendingMark = null;
    hideKindPop();
    $('toolbar').classList.toggle('hidden', !t);
    qa('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === 'deco' && !!t));
    if (t) { settings.tool = t; saveSettings(); }
    $('tool-seg').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    $('mark-opts').classList.toggle('hidden', t === 'st');
    $('ul-style').classList.toggle('hidden', t !== 'ul');
    syncMarkOpts();
    updateHint();
    drawPending();
  }
  function syncMarkOpts() {
    const box = $('colors');
    if (!box.children.length) {
      R.PALETTE.filter(([hex]) => hex !== '#FFD60A').forEach(([hex, name]) => {
        const b = document.createElement('button');
        b.className = 'dot';
        b.title = name;
        b.dataset.c = hex;
        b.style.background = hex;
        box.appendChild(b);
      });
      const custom = document.createElement('label');
      custom.className = 'dot custom';
      custom.title = '직접 고르기';
      custom.innerHTML = '<input type="color" id="custom-color">';
      box.appendChild(custom);
      box.addEventListener('click', e => {
        const b = e.target.closest('button.dot');
        if (!b) return;
        settings.color = b.dataset.c; saveSettings(); syncMarkOpts();
      });
      const input = custom.querySelector('input');
      input.addEventListener('input', () => { settings.customColor = settings.color = input.value.toUpperCase(); saveSettings(); syncMarkOpts(); });
    }
    const custom = box.querySelector('.custom');
    const inPalette = R.PALETTE.some(([hex]) => hex !== '#FFD60A' && hex === settings.color);
    // 설정에 남은 노란색은 삭제하지 않고 '직접 고르기' 선택으로 보여준다.
    const displayCustomColor = inPalette ? settings.customColor : settings.color;
    custom.style.setProperty('--cc', displayCustomColor);
    custom.querySelector('input').value = displayCustomColor;
    box.querySelectorAll('button.dot').forEach(b => b.classList.toggle('on', b.dataset.c === settings.color));
    custom.classList.toggle('on', !inPalette);
    const a = tool === 'ul' ? settings.ulAlpha : settings.hlAlpha;
    $('alpha').value = Math.round(a * 100);
    $('alpha-v').textContent = Math.round(a * 100) + '%';
    $('ul-style').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === settings.ulStyle));
  }
  $('alpha').addEventListener('input', () => {
    const v = Number($('alpha').value) / 100;
    if (tool === 'ul') settings.ulAlpha = v; else settings.hlAlpha = v;
    $('alpha-v').textContent = Math.round(v * 100) + '%';
    saveSettings();
  });
  $('ul-style').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { settings.ulStyle = b.dataset.v; saveSettings(); syncMarkOpts(); } });
  function updateHint() {
    const h = $('tool-hint');
    if (tool === 'st') h.textContent = '원고에서 붙일 곳을 누르세요';
    else if (pendingMark) h.textContent = '이제 끝 낱말을 누르세요 (같은 낱말을 또 누르면 그 낱말만)';
    else if (tool) h.textContent = '시작 낱말을 누르세요 · 칠한 곳을 누르면 지워져요';
  }
  $('tool-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTool(b.dataset.t); });
  $('tool-done').addEventListener('click', () => setTool(null));

  function onMarkTap(pid, index) {
    const text = current.model.texts[pid];
    if (text === undefined) return;
    const type = tool;
    if (!pendingMark) {
      // 이미 칠한 곳을 누르면 지우기
      const list = edits.marks[pid] || [];
      const hitIdx = list.findIndex(mk => {
        if (mk.type !== type) return false;
        const r = T.resolveMark(text, mk);
        return r && index >= r[0] && index < r[1];
      });
      if (hitIdx !== -1) {
        change(ed => { ed.marks[pid].splice(hitIdx, 1); if (!ed.marks[pid].length) delete ed.marks[pid]; });
        toast('지웠어요', 900);
        return;
      }
      const w = T.wordAt(text, index);
      if (!w) return;
      pendingMark = { pid, a: w[0], b: w[1] };
      updateHint();
      drawPending();
      return;
    }
    const w = T.wordAt(text, index);
    if (!w) return;
    const startM = pendingMark;
    pendingMark = null;
    const order = current.model.order;
    let i0 = order.indexOf(startM.pid), i1 = order.indexOf(pid);
    let s = { pid: startM.pid, a: startM.a, b: startM.b }, e2 = { pid, a: w[0], b: w[1] };
    if (i1 < i0 || (i1 === i0 && e2.a < s.a)) { [s, e2] = [e2, s]; [i0, i1] = [i1, i0]; }
    const color = settings.color, alpha = type === 'ul' ? settings.ulAlpha : settings.hlAlpha, style = type === 'ul' ? settings.ulStyle : undefined;
    change(ed => {
      for (let i = i0; i <= i1; i++) {
        const p = order[i];
        const t = current.model.texts[p];
        if (t === undefined) continue;
        const a = i === i0 ? s.a : 0;
        const b = i === i1 ? (i0 === i1 ? Math.max(s.b, e2.b) : e2.b) : t.length;
        if (b <= a) continue;
        const list = ed.marks[p] || (ed.marks[p] = []);
        list.push({ start: a, end: b, text: t.slice(a, b), type, color, alpha, style });
      }
    });
    updateHint();
    drawPending();
  }

  // 시작 낱말 표시 (파란 상자)
  function drawPending() {
    qa('.pending').forEach(x => x.remove());
    if (!pendingMark || !current) return;
    const box = $('pages');
    current.pages.forEach((page, i) => {
      const wrap = box.children[i];
      if (!wrap) return;
      const canvas = wrap.querySelector('canvas');
      const z = canvas.getBoundingClientRect().width / OW(page);
      const F = page.frame || 0;
      for (const it of page.items) {
        if (it.pid !== pendingMark.pid || it.kind !== 'line') continue;
        for (const seg of it.line.segs) {
          const sa = it.off + seg.si, sb = sa + seg.text.length;
          const a = Math.max(sa, pendingMark.a), b = Math.min(sb, pendingMark.b);
          if (a >= b) continue;
          const font = L.fontString(seg.style, it.size, it.family);
          const x0 = seg.x + measure(font, seg.text.slice(0, a - sa));
          const x1 = seg.x + measure(font, seg.text.slice(0, b - sa));
          const d = document.createElement('div');
          d.className = 'pending';
          const M = current.opt.margin + F;
          d.style.left = (wrap.offsetLeft + (M + it.x + x0 - 2) * z) + 'px';
          d.style.top = (wrap.offsetTop + canvas.offsetTop + (M + it.y + 2) * z) + 'px';
          d.style.width = ((x1 - x0 + 4) * z) + 'px';
          d.style.height = ((it.h - 4) * z) + 'px';
          box.appendChild(d);
        }
      }
    });
  }

  /* ---------- 스티커 ---------- */
  let stDraft = null; // { id?, x, pid, dy, page }
  function openStickerSheet(ref, pc) {
    hideKindPop();
    if (ref) {
      stDraft = { id: ref.id, text: ref.text, style: ref.style, size: ref.size, rot: ref.rot };
      $('st-title').textContent = '스티커 고치기';
      $('st-ok').textContent = '완료';
      $('st-del').classList.remove('hidden');
    } else {
      const pid = nearestPid(pc.page, pc.y);
      const ay = anchorY(pc.page, pid);
      if (pid === null || ay === null) return;
      stDraft = { id: null, pid, dy: pc.y - ay, x: pc.x, text: '', style: settings.stStyle || 'hand', size: 'm', rot: -4 };
      $('st-title').textContent = '스티커 글씨';
      $('st-ok').textContent = '붙이기';
      $('st-del').classList.add('hidden');
    }
    $('st-text').value = stDraft.text;
    syncStickerSheet();
    openSheet('sheet-sticker', true);
    setTimeout(() => $('st-text').focus(), 120);
  }
  function syncStickerSheet() {
    qa('.st-style').forEach(b => b.classList.toggle('on', b.dataset.s === stDraft.style));
    $('st-size').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === stDraft.size));
    $('st-rot').querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) === Number(stDraft.rot) || (b.dataset.v === '-7' && stDraft.rot < 0) || (b.dataset.v === '7' && stDraft.rot > 0)));
  }
  qa('.st-style').forEach(b => b.addEventListener('click', () => { stDraft.style = b.dataset.s; settings.stStyle = b.dataset.s; saveSettings(); syncStickerSheet(); }));
  $('st-size').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { stDraft.size = b.dataset.v; syncStickerSheet(); } });
  $('st-rot').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { stDraft.rot = Number(b.dataset.v); syncStickerSheet(); } });
  $('st-ok').addEventListener('click', () => {
    const text = $('st-text').value.trim();
    if (!text) { toast('글씨를 적어 주세요', 1200); return; }
    const d = stDraft;
    closeSheets();
    change(ed => {
      if (d.id) {
        const s = ed.stickers.find(x => x.id === d.id);
        if (s) Object.assign(s, { text, style: d.style, size: d.size, rot: d.rot });
      } else {
        ed.stickers.push({ id: 's' + Date.now().toString(36), pid: d.pid, dy: d.dy, x: d.x, text, style: d.style, size: d.size, rot: d.rot });
      }
    });
  });
  $('st-del').addEventListener('click', () => {
    const id = stDraft.id;
    closeSheets();
    change(ed => { ed.stickers = ed.stickers.filter(x => x.id !== id); });
    toast('스티커를 지웠어요', 1100);
  });

  /* ---------- 시트 ---------- */
  let sheetOpenedAt = 0;
  // v3.7: mobile preview and settings split; only settings sheet takes reserved space.
  const MOBILE_PANELS = new Set(['sheet-name', 'sheet-look', 'sheet-font', 'sheet-save']);
  function isCompactViewport() { return window.innerWidth <= 700; }
  function setMobilePanelMode(sheet, mode) {
    if (!sheet || !isCompactViewport() || !MOBILE_PANELS.has(sheet.id)) return;
    const app = $('app');
    sheet.classList.add('cc-mobile-panel');
    sheet.classList.toggle('cc-panel-collapsed', mode === 'collapsed');
    sheet.classList.toggle('cc-panel-expanded', mode === 'expanded');
    app.classList.add('cc-preview-split');
    app.style.setProperty('--cc-panel-h', mode === 'collapsed' ? '46px' : mode === 'expanded' ? 'min(70dvh, 640px)' : 'min(36dvh, 300px)');
    sheet.dataset.panelMode = mode;
    const btn = sheet.querySelector('.cc-panel-toggle');
    if (btn) {
      btn.textContent = mode === 'collapsed' ? '설정 보기' : mode === 'expanded' ? '작게 보기' : '미리보기';
      btn.setAttribute('aria-expanded', String(mode !== 'collapsed'));
    }
  }
  function setupMobilePanelButtons() {
    for (const id of MOBILE_PANELS) {
      const sheet = $(id), nav = sheet && sheet.querySelector('.sheet-nav');
      if (!nav || nav.querySelector('.cc-panel-toggle')) continue;
      const left = nav.firstElementChild;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cc-panel-toggle';
      btn.textContent = '미리보기';
      btn.setAttribute('aria-label', '원고 미리보기 넓히기 또는 설정 열기');
      btn.addEventListener('click', () => {
        const mode = sheet.dataset.panelMode || 'compact';
        setMobilePanelMode(sheet, mode === 'collapsed' ? 'compact' : mode === 'expanded' ? 'compact' : 'collapsed');
      });
      if (left.tagName === 'SPAN' && !left.textContent.trim()) left.replaceWith(btn);
      else {
        const holder = document.createElement('div');
        holder.className = 'cc-panel-left';
        left.replaceWith(holder);
        holder.append(left, btn);
      }
    }
  }
  setupMobilePanelButtons();
  function openSheet(id, clear) {
    closeSheets();
    sheetOpenedAt = Date.now();
    $('backdrop').classList.remove('hidden');
    $('backdrop').classList.toggle('clear', !!clear);
    const sheet = $(id);
    sheet.classList.remove('hidden');
    if (isCompactViewport() && MOBILE_PANELS.has(id)) setMobilePanelMode(sheet, 'compact');
  }
  let choiceResolve = null;
  function choose(title, text, options) {
    return new Promise(resolve => {
      openSheet('sheet-choice');
      $('cs-title').textContent = title;
      $('cs-text').textContent = text || '';
      const box = $('cs-options');
      box.innerHTML = '';
      options.forEach(o => {
        const b = document.createElement('button');
        b.className = 'btn-fill mt12' + (o.red ? ' red' : '');
        b.textContent = o.label;
        b.addEventListener('click', () => { choiceResolve = null; closeSheets(); resolve(o.value); });
        box.appendChild(b);
      });
      choiceResolve = resolve;
    });
  }
  function closeSheets() {
    if (choiceResolve) { const r = choiceResolve; choiceResolve = null; r(null); }
    qa('.sheet').forEach(s => {
      s.classList.add('hidden');
      s.classList.remove('cc-mobile-panel', 'cc-panel-collapsed', 'cc-panel-expanded');
      delete s.dataset.panelMode;
    });
    $('app').classList.remove('cc-preview-split');
    $('app').style.removeProperty('--cc-panel-h');
    $('backdrop').classList.add('hidden');
    qa('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === 'deco' && !!tool));
  }
  // 손가락으로 누른 뒤 따라오는 클릭이 바로 시트를 닫지 않게
  $('backdrop').addEventListener('click', () => { if (Date.now() - sheetOpenedAt > 500) closeSheets(); });
  qa('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
  // 시트를 아래로 끌어 닫기
  qa('.sheet').forEach(sheet => {
    const grab = sheet.querySelector('.grabber');
    let y0 = null;
    const navEl = sheet.querySelector('.sheet-nav');
    [grab, navEl].filter(Boolean).forEach(el => {
      el.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
      el.addEventListener('touchmove', e => {
        if (y0 === null) return;
        const dy = Math.max(0, e.touches[0].clientY - y0);
        sheet.style.transform = `translate(-50%, ${dy}px)`;
      }, { passive: true });
      el.addEventListener('touchend', e => {
        if (y0 === null) return;
        const dy = e.changedTouches[0].clientY - y0;
        y0 = null;
        sheet.style.transform = '';
        if (isCompactViewport() && sheet.classList.contains('cc-mobile-panel')) {
          if (dy < -55) setMobilePanelMode(sheet, 'expanded');
          else if (dy > 55) {
            const mode = sheet.dataset.panelMode || 'compact';
            setMobilePanelMode(sheet, mode === 'expanded' ? 'compact' : 'collapsed');
          }
        } else if (dy > 80) closeSheets();
      });
    });
  });

  qa('.tab').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.tab;
    if (t === 'name') { setTool(null); renderRules(); syncLook(); openSheet('sheet-name', true); b.classList.add('on'); }
    else if (t === 'look') { setTool(null); syncLook(); openSheet('sheet-look', true); b.classList.add('on'); }
    else if (t === 'deco') { closeSheets(); setTool(tool ? null : (settings.tool || 'hl')); }
    else if (t === 'save') { setTool(null); exportImages(); }
  }));

  /* 이름 시트 */
  function sourceTexts() {
    const out = [];
    doc.messages.forEach(m => m.blocks.forEach(b => { if (b.runs) out.push(T.plainText(b.runs)); }));
    return out;
  }
  function renderRules() {
    const box = $('rules');
    box.innerHTML = '';
    const src = sourceTexts();
    settings.rules.forEach((r, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'rule-wrap';
      wrap.innerHTML = `<div class="row rule-row"><input class="field from" maxlength="40" placeholder="원래 이름"><span class="arrow">→</span><input class="field to" maxlength="40" placeholder="바꿀 이름"><button class="star" title="강조">★</button><button class="del" title="지우기">−</button></div><span class="rule-count"></span>`;
      const from = wrap.querySelector('.from'), to = wrap.querySelector('.to'), star = wrap.querySelector('.star'), cnt = wrap.querySelector('.rule-count');
      from.value = r.from || ''; to.value = r.to || '';
      star.classList.toggle('on', !!r.star);
      const count = () => {
        const f = from.value.trim();
        const n = f ? T.countMatches(src, f) : 0;
        cnt.textContent = f ? (n ? `대화에서 ${n}번 찾았어요` : '대화에 없는 이름이에요') : '';
        cnt.classList.toggle('hidden', !f);
      };
      count();
      from.addEventListener('input', () => { settings.rules[i].from = from.value; saveSettings(); count(); scheduleRefresh(220); });
      to.addEventListener('input', () => { settings.rules[i].to = to.value; saveSettings(); scheduleRefresh(220); });
      from.addEventListener('keydown', e => { if (e.key === 'Enter') to.focus(); });
      to.addEventListener('keydown', e => { if (e.key === 'Enter') to.blur(); });
      star.addEventListener('click', () => { settings.rules[i].star = !settings.rules[i].star; star.classList.toggle('on', settings.rules[i].star); saveSettings(); scheduleRefresh(0); });
      wrap.querySelector('.del').addEventListener('click', () => {
        settings.rules.splice(i, 1);
        if (!settings.rules.length) settings.rules.push({ from: '', to: '', star: false });
        saveSettings(); renderRules(); scheduleRefresh(0);
      });
      box.appendChild(wrap);
    });
  }
  $('rule-add').addEventListener('click', () => {
    settings.rules.push({ from: '', to: '', star: false });
    saveSettings(); renderRules();
    $('rules').lastChild.querySelector('.from').focus();
  });

  /* 모양 시트 */
  function drawSwatch(canvas, key) {
    const th = R.THEMES[key];
    const W = 200, H = 250, k = canvas.width / W;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
    R.drawBackground(ctx, { w: W, h: H, index: 0 }, th, { decor: settings.decor, pattern: 'none' });
    // 작은 글줄 모양
    const bar = (x, y, w, c, a) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, 9, 4.5) : ctx.rect(x, y, w, 9); ctx.fill(); ctx.globalAlpha = 1; };
    bar(42, 70, 116, th.narration, 0.55);
    ctx.fillStyle = th.accent; ctx.fillRect(42, 100, 5, 22);
    bar(56, 106, 96, th.text, 0.95);
    bar(42, 142, 126, th.narration, 0.55);
    bar(42, 166, 80, th.narration, 0.55);
  }
  function syncLook() {
    const box = $('themes');
    if (!box.children.length) {
      Object.entries(R.THEMES).forEach(([key, th]) => {
        const b = document.createElement('button');
        b.className = 'theme';
        b.dataset.theme = key;
        b.innerHTML = `<canvas class="sw" width="120" height="150"></canvas><span>${th.name}</span>`;
        b.addEventListener('click', () => setLook('theme', key));
        box.appendChild(b);
      });
    }
    box.querySelectorAll('.theme').forEach(b => {
      b.classList.toggle('on', b.dataset.theme === settings.theme);
      drawSwatch(b.querySelector('canvas'), b.dataset.theme);
    });
    qa('[data-seg]').forEach(seg => seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(settings[seg.dataset.seg]))));
    $('fs-v').textContent = settings.fontSize;
    const fs = fontSet();
    $('font-v').textContent = fs.set.label;
    $('enfont-v').textContent = settings.enFont === 'auto' ? `맞춤 (${fs.en ? EN_FONTS[fs.en].label : '글꼴 그대로'})` : EN_FONTS[settings.enFont].label;
  }

  /* 글꼴 고르기 목록: 폰 화면에서 보이는 항목만 웹폰트 내려받기 */
  let fontPreviewObserver = null;
  function openFontList(kind) {
    const list = $('font-list');
    if (fontPreviewObserver) { fontPreviewObserver.disconnect(); fontPreviewObserver = null; }
    list.innerHTML = '';
    const previewJobs = [];
    $('font-title').textContent = kind === 'kr' ? '글꼴' : '영어 글꼴';
    const items = kind === 'kr'
      ? Object.entries(FONT_SETS).map(([key, f]) => ({ key, group: f.group, label: f.label, css: [f.en, f.kr].filter(Boolean).map(x => `"${x}"`).join(',') + ',' + f.generic, sample: '그는 조용히 웃었다. Hello', need: [{ alias: f.kr, weight: '400', text: '그는조용히웃었다' }].concat(f.en ? [{ alias: f.en, weight: '400', text: 'Hello.' }] : []) }))
      : [{ key: 'auto', group: '', label: '글꼴에 맞춤', css: 'inherit', sample: '고른 한글 글꼴에 어울리는 영어 글꼴을 써요', need: [] }].concat(Object.entries(EN_FONTS).map(([key, f]) => ({ key, group: f.group, label: f.label, css: `"${key}", serif`, sample: 'The quiet night, 2026.', need: [{ alias: key, weight: '400', text: 'The quiet night, 2026.' }] })));
    const cur = kind === 'kr' ? settings.font : settings.enFont;
    let group = null, groupBox = null;
    items.forEach(it => {
      if (it.group !== group) {
        group = it.group;
        if (group) { const h = document.createElement('h3'); h.className = 'group-title'; h.textContent = group; list.appendChild(h); }
        groupBox = document.createElement('div');
        groupBox.className = 'group' + (group ? '' : ' mt12');
        list.appendChild(groupBox);
      }
      const b = document.createElement('button');
      b.className = 'row font-row' + (it.key === cur ? ' on' : '');
      b.dataset.key = it.key;
      b.innerHTML = '<span class="label"><span class="fname"></span><span class="fsample"></span></span><span class="check">✓</span>';
      b.querySelector('.fname').textContent = it.label;
      const sm = b.querySelector('.fsample');
      sm.textContent = it.sample;
      sm.style.fontFamily = it.css;
      b.addEventListener('click', () => {
        if (kind === 'kr') settings.font = it.key; else settings.enFont = it.key;
        saveSettings();
        list.querySelectorAll('.font-row').forEach(x => x.classList.toggle('on', x === b));
        scheduleRefresh(0);
      });
      groupBox.appendChild(b);
      if (it.need.length) previewJobs.push({ node: b, need: it.need });
    });
    openSheet('sheet-font', true);
    list.scrollTop = 0;
    if ('IntersectionObserver' in window) {
      fontPreviewObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const job = previewJobs.find(x => x.node === entry.target);
          if (job) { void ensureFonts(job.need); fontPreviewObserver.unobserve(entry.target); }
        });
      }, { root: list, rootMargin: '180px 0px' });
      previewJobs.forEach(x => fontPreviewObserver.observe(x.node));
    } else {
      // 구형 모바일 브라우저: 시작 화면의 글꼴만 먼저 불러옴
      previewJobs.slice(0, 6).forEach(x => void ensureFonts(x.need));
    }
  }
  $('open-font').addEventListener('click', () => openFontList('kr'));
  $('open-enfont').addEventListener('click', () => openFontList('en'));
  $('font-back').addEventListener('click', () => { syncLook(); openSheet('sheet-look', true); });

  function setLook(key, v) { settings[key] = v; saveSettings(); syncLook(); scheduleRefresh(0); }
  qa('[data-seg]').forEach(seg => seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLook(seg.dataset.seg, b.dataset.v); }));
  $('fs-minus').addEventListener('click', () => setLook('fontSize', Math.max(13, settings.fontSize - 1)));
  $('fs-plus').addEventListener('click', () => setLook('fontSize', Math.min(23, settings.fontSize + 1)));

  /* ---------- 글 고치기 (전체) ---------- */
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function runsToHtml(runs) {
    return runs.map(r => {
      const st = [];
      if (r.b) st.push('font-weight:700');
      if (r.i) st.push('font-style:italic');
      const text = r.t.split('\n').map(esc).join('<br>');
      return st.length ? `<span style="${st.join(';')}">${text}</span>` : text;
    }).join('');
  }
  function serialize(el) {
    const runs = [];
    const walk = (node, style) => {
      if (node.nodeType === 3) { if (node.nodeValue) runs.push(Object.assign({ t: node.nodeValue.replace(/ /g, ' ') }, style)); return; }
      if (node.nodeType !== 1) return;
      if (node.tagName === 'BR') { runs.push({ t: '\n' }); return; }
      const s = Object.assign({}, style);
      const cs = node.style;
      if (node.tagName === 'B' || node.tagName === 'STRONG' || Number(cs.fontWeight) >= 600 || cs.fontWeight === 'bold') s.b = true;
      if (node.tagName === 'I' || node.tagName === 'EM' || cs.fontStyle === 'italic') s.i = true;
      const block = (node.tagName === 'DIV' || node.tagName === 'P') && node !== el;
      if (block && runs.length && !runs[runs.length - 1].t.endsWith('\n')) runs.push({ t: '\n' });
      node.childNodes.forEach(c => walk(c, s));
    };
    walk(el, {});
    const st = T.toStyled(T.mergeRuns(runs.filter(r => r.t)));
    let text = st.text, styles = st.styles;
    while (text.endsWith('\n')) { text = text.slice(0, -1); styles = styles.slice(0, -1); }
    return T.tidyRuns(T.fromStyled(text, styles), { punctuation: false });
  }

  let edState = null;
  function openWriteEditor() {
    hideKindPop();
    setTool(null);
    const body = $('ed-body');
    body.innerHTML = '<p class="ed-tip">원고 전체를 바로 고칠 수 있어요. 문단을 통째로 지우면 그 문단은 빠져요. 이름 바꾸기는 여기서 고친 글에도 그대로 적용돼요.</p>';
    edState = { items: [], hidden: Object.assign({}, edits.hidden) };
    doc.messages.forEach((m, mi) => {
      const card = document.createElement('div');
      card.className = 'ed-msg' + (m.role === 'user' ? ' user' : '');
      card.innerHTML = `<div class="ed-who">${m.role === 'user' ? '내 메시지' : '캐릭터'}</div>`;
      m.blocks.forEach((b, bi) => {
        const pid = mi + '.' + bi;
        if (b.type === 'img' || b.type === 'hr') {
          const row = document.createElement('div');
          row.className = 'ed-img';
          const label = b.type === 'img' ? '🖼 이미지' : '· · · 구분선';
          const sync = () => { row.innerHTML = `<span>${label}${edState.hidden[pid] ? ' (빠짐)' : ''}</span><button class="btn-text bold">${edState.hidden[pid] ? '넣기' : '빼기'}</button>`; row.querySelector('button').onclick = () => { edState.hidden[pid] = !edState.hidden[pid]; if (!edState.hidden[pid]) delete edState.hidden[pid]; sync(); }; };
          sync();
          card.appendChild(row);
          return;
        }
        const runs = finalRuns(mi, bi);
        const html = runsToHtml(runs);
        const p = document.createElement('div');
        p.className = 'ed-p' + (b.type === 'status' ? ' status' : '');
        p.contentEditable = 'true';
        p.spellcheck = false;
        p.innerHTML = html;
        p.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); } });
        p.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
        const gone = document.createElement('div');
        gone.className = 'ed-gone';
        gone.innerHTML = '<span></span><button>되살리기</button>';
        gone.querySelector('span').textContent = '빠진 문단 · ' + T.plainText(runs).replace(/\s+/g, ' ').slice(0, 40);
        gone.querySelector('button').onclick = () => { delete edState.hidden[pid]; p.classList.remove('hidden'); gone.classList.add('hidden'); p.focus(); };
        if (edState.hidden[pid]) p.classList.add('hidden'); else gone.classList.add('hidden');
        card.appendChild(p);
        card.appendChild(gone);
        edState.items.push({ pid, el: p, original: JSON.stringify(serialize(p)) });
      });
      body.appendChild(card);
    });
    $('editor').classList.remove('hidden');
    body.scrollTop = 0;
  }
  $('open-editor').addEventListener('click', openWriteEditor);
  $('ed-cancel').addEventListener('click', () => { $('editor').classList.add('hidden'); edState = null; });
  $('ed-done').addEventListener('click', () => {
    const st = edState;
    $('editor').classList.add('hidden');
    edState = null;
    const changes = [];
    st.items.forEach(item => {
      if (st.hidden[item.pid]) return;
      const runs = serialize(item.el);
      if (JSON.stringify(runs) !== item.original) changes.push({ pid: item.pid, runs });
    });
    const hiddenChanged = JSON.stringify(st.hidden) !== JSON.stringify(edits.hidden);
    if (!changes.length && !hiddenChanged) return;
    const keys = activeRules().map(T.ruleKey);
    change(ed => {
      ed.hidden = st.hidden;
      changes.forEach(c => {
        if (!T.plainText(c.runs).trim()) { ed.hidden[c.pid] = true; return; }
        ed.overrides[c.pid] = { runs: c.runs, rules: keys };
      });
    });
    toast('고친 내용을 반영했어요', 1300);
  });

  /* ---------- 저장 ---------- */
  function stamp() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function toBlob(canvas, type, q) {
    return new Promise((res, rej) => canvas.toBlob(b => (b && b.size ? res(b) : rej(new Error('blob'))), type, q));
  }
  let saved = null; // { files: File[], urls: [] }
  async function exportImages() {
    clearTimeout(refreshTimer);
    await refresh();
    if (!current || !current.model.turns.length) return;
    const pages = current.pages;
    const files = [];
    const base = `크랙캡처_${stamp()}`;
    try {
      for (let i = 0; i < pages.length; i++) {
        hud(pages.length > 1 ? `이미지 만드는 중… (${i + 1}/${pages.length})` : '이미지 만드는 중…');
        await new Promise(r => setTimeout(r, 30));
        const page = pages[i];
        let scale = SCALE;
        while (scale > 1 && (OW(page) * scale * OH(page) * scale > MAX_PIXELS || OH(page) * scale > MAX_SIDE)) scale--;
        const c = document.createElement('canvas');
        c.width = Math.round(OW(page) * scale);
        c.height = Math.round(OH(page) * scale);
        const ctx = c.getContext('2d');
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        R.renderPage(ctx, page, current.opt, look(), images, pages.length);
        let blob = null;
        if (settings.format !== 'png') { try { blob = await toBlob(c, 'image/webp', 0.92); } catch (e) { blob = null; } }
        const isWebp = !!blob && blob.type === 'image/webp';
        if (!isWebp) blob = await toBlob(c, 'image/png');
        c.width = c.height = 0; // 폰 메모리 비우기
        const name = `${base}${pages.length > 1 ? '_' + String(i + 1).padStart(2, '0') : ''}.${isWebp ? 'webp' : 'png'}`;
        files.push(new File([blob], name, { type: blob.type }));
      }
    } catch (e) {
      hud(null);
      toast('이미지를 만들지 못했어요. 나누기를 4:5로 바꿔서 다시 해 보세요.', 4000);
      return;
    }
    hud(null);
    if (saved) saved.urls.forEach(u => URL.revokeObjectURL(u));
    saved = { files, urls: files.map(f => URL.createObjectURL(f)), base };
    $('thumbs').innerHTML = '';
    saved.urls.forEach(u => { const im = document.createElement('img'); im.src = u; $('thumbs').appendChild(im); });
    const total = files.reduce((s, f) => s + f.size, 0);
    $('save-title').textContent = files.length > 1 ? `이미지 ${files.length}장 준비 완료` : '저장 준비 완료';
    $('save-info').textContent = `${files[0].name.endsWith('webp') ? 'WebP' : 'PNG'} · ${(total / 1048576).toFixed(1)}MB`;
    const canShare = !!(navigator.canShare && navigator.share && navigator.canShare({ files }));
    $('save-share').classList.toggle('hidden', !canShare || !IS_MOBILE);
    $('save-file').className = canShare && IS_MOBILE ? 'btn-gray mt12' : 'btn-fill';
    $('save-file').textContent = files.length > 1 ? `파일로 내려받기 (${files.length}장)` : '파일로 내려받기';
    $('save-copy').classList.toggle('hidden', IS_MOBILE || files.length !== 1 || typeof ClipboardItem === 'undefined');
    $('fmt').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === (files[0].name.endsWith('webp') ? 'webp' : 'png')));
    openSheet('sheet-save');
  }
  $('fmt').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.dataset.v === settings.format) return;
    settings.format = b.dataset.v;
    saveSettings();
    exportImages();
  });
  $('save-share').addEventListener('click', async () => {
    try { await navigator.share({ files: saved.files }); }
    catch (e) { if (e && e.name !== 'AbortError') toast('공유 창을 열지 못했어요. ‘파일로 내려받기’를 써 주세요.', 3000); }
  });
  $('save-file').addEventListener('click', async () => {
    const f = saved.files;
    for (const x of f) { download(x, x.name); await new Promise(r => setTimeout(r, 450)); }
    toast('내려받았어요 ✨', 1600);
  });
  $('save-copy').addEventListener('click', async () => {
    try {
      const src = saved.files[0];
      let png = src;
      if (src.type !== 'image/png') {
        const bmp = await createImageBitmap(src);
        const c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0);
        png = await toBlob(c, 'image/png');
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      toast('복사했어요 · 붙여넣기(Ctrl+V) 하세요');
    } catch (e) { toast('이 브라우저에서는 복사가 안 돼요', 2400); }
  });

  if (window.__CC_TEST__) window.__CC_TEST__.get = () => ({ current, edits, settings, cssWidth, tool, pendingMark });

  window.addEventListener('resize', () => {
    const visible = qa('.sheet').find(el => !el.classList.contains('hidden') && MOBILE_PANELS.has(el.id));
    if (visible && isCompactViewport()) setMobilePanelMode(visible, visible.dataset.panelMode || 'compact');
    else if (!isCompactViewport()) { $('app').classList.remove('cc-preview-split'); $('app').style.removeProperty('--cc-panel-h'); }
    if (editorOpen && current) { clearTimeout(window.__ccRz); window.__ccRz = setTimeout(renderPreview, 150); }
  });
  document.addEventListener('keydown', e => {
    if (!editorOpen) return;
    if (e.key === 'Escape') { if (!$('editor').classList.contains('hidden')) return; closeSheets(); hideKindPop(); if (pendingMark) { pendingMark = null; updateHint(); drawPending(); } }
  }, true);
})();

} catch (ccErr) {
  (function () {
    var show = function () {
      var d = document.createElement('div');
      d.textContent = '익명 캡처 오류: ' + (ccErr && ccErr.message ? ccErr.message : ccErr);
      d.style.cssText = 'position:fixed;left:10px;right:10px;bottom:90px;z-index:2147483647;background:#FF3B30;color:#fff;padding:10px 14px;border-radius:12px;font:600 13px/1.4 sans-serif;';
      (document.body || document.documentElement).appendChild(d);
      setTimeout(function () { d.remove(); }, 20000);
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  })();
}
