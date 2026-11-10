// ==UserScript==
// @name         📔 뉴다이어리 v2.4.1 (누적·월별 통계)
// @namespace    cracker-diary-integrated
// @version      2.4.1
// @description  크래커 사용량 달력, 월별 통계, 절약 목표, 일기장 꾸미기 기능
// @author       muz
// @match        https://crack.wrtn.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// v2.4.1 변경점: 달력 숫자를 k 대신 실제 숫자로, 통계 화면 짧게 정리, '오늘 한 줄'을 달력 아래로
// v2.4.0 변경점: 딸기우유·밤하늘 별빛 테마 새로 디자인, 색 진하기 달력, '오늘 한 줄' 바로 쓰기, 일기 자동 저장, 하단 빈 공간 제거

 (() => {
   'use strict';
   if (window.__crackerDiary23) return;
   window.__crackerDiary23 = true;

   const KEY='cracker-diary-v1';
   const API='https://crack-api.wrtn.ai/crack-cash/crackers/history';
   const DIARY_FETCH_WIDTH=4;
   const read=k=>{try{return JSON.parse(localStorage.getItem(k))||{}}catch{return {}}};
   const defaults={
     theme:'pink',goalDaily:10000,goalMonthly:250000,
     notes:{},stickers:{},custom:[],manual:{},events:{},
     captures:{},paper:'lined',paperColor:'cream',diaryFont:'basic'
   };
   let db={...defaults,...read(KEY)};
   for(const k of ['notes','stickers','manual','events','captures'])
     db[k] ||= {};
   db.custom ||= [];

   const old1=read('cracker-diary-paper-v1');
   const old2=read('cracker-paper-diary-v1');
   for(const source of [old1,old2]){
     for(const [day,p] of Object.entries(source.pages||{}))
       if(!db.stickers[day]?.length && p.stickers?.length)
         db.stickers[day]=p.stickers;
     for(const p of [...(source.custom||[]),...(source.photos||[])])
       if(p.data&&!db.custom.some(x=>x.data===p.data))
         db.custom.push({id:p.id||crypto.randomUUID(),name:p.name||'사진',data:p.data});
   }

   // 글꼴: 폰에 없는 글꼴은 구글 폰트에서 글꼴 파일만 받아온다 (내 데이터는 보내지 않음)
   if(!document.querySelector('link[data-crd-font]')){
     const fl=document.createElement('link');
     fl.rel='stylesheet';fl.setAttribute('data-crd-font','');
     fl.href='https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Nanum+Myeongjo&family=Nanum+Pen+Script&display=swap';
     document.head.appendChild(fl);
   }
   const UI_ROUND='"Gowun Dodum",system-ui,-apple-system,sans-serif';
   const UI_SYS='-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';

   // ---- 그림(아이콘) ----
   const ART={
     berry:'<path d="M12 7.5c3.9 0 6.8 1.9 6.8 5.2 0 4.1-3.9 8-6.8 9.3-2.9-1.3-6.8-5.2-6.8-9.3 0-3.3 2.9-5.2 6.8-5.2z" fill="#ef5470"/><path d="M12 8.6 8.2 6.4l2.5-.2L9.6 3.9l2.4 1.7 2.4-1.7-1.1 2.3 2.5.2z" fill="#5fae6e"/><g fill="#ffe7ad"><circle cx="9.2" cy="11.6" r=".65"/><circle cx="12" cy="10.9" r=".65"/><circle cx="14.8" cy="11.6" r=".65"/><circle cx="10.5" cy="14.4" r=".65"/><circle cx="13.5" cy="14.4" r=".65"/><circle cx="12" cy="17.3" r=".65"/></g>',
     moon:'<path d="M15.2 3.6a8.6 8.6 0 1 0 5.2 15.3A7.1 7.1 0 0 1 15.2 3.6z" fill="#f6d88f"/><path d="M19.2 3.5l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" fill="#fff6d6"/><circle cx="9.5" cy="12" r="1" fill="#e2c272"/><circle cx="12.5" cy="16" r=".7" fill="#e2c272"/>',
     cookie:'<circle cx="12" cy="12" r="8.5" fill="#d9a66a"/><g fill="#7a4b2a"><circle cx="9" cy="9.5" r="1.2"/><circle cx="14.5" cy="8.5" r="1"/><circle cx="13" cy="13.5" r="1.3"/><circle cx="8.5" cy="14.5" r="1"/><circle cx="16" cy="15" r=".9"/></g>'
   };
   const art=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ART[k]}</svg>`;
   const LINE={
     cal:'<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
     chart:'<path d="M5 20v-8M12 20V5M19 20v-5"/>',
     set:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
     x:'<path d="M6 6l12 12M18 6 6 18"/>',
     left:'<path d="M15 6l-6 6 6 6"/>',
     right:'<path d="M9 6l6 6-6 6"/>',
     cam:'<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
     check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
     pencil:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'
   };
   const ic=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[k]}</svg>`;
   const svgUrl=s=>`url("data:image/svg+xml,${encodeURIComponent(s)}")`;
   const berryAt=(x,y,r)=>`<g transform="translate(${x} ${y}) rotate(${r} 9 9) scale(.75)" opacity=".42">${ART.berry}</g>`;
   const PATTERNS={
     berry:[svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="76" height="54" viewBox="0 0 76 54">${berryAt(4,3,-16)}${berryAt(44,24,14)}<circle cx="36" cy="10" r="1.7" fill="#f6a5b6" opacity=".55"/><circle cx="14" cy="42" r="1.7" fill="#f6a5b6" opacity=".55"/><circle cx="66" cy="8" r="1.2" fill="#9ccf9f" opacity=".6"/></svg>`),'76px 54px'],
     dots:[svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="3" cy="3" r="1.3" fill="#c9a77d" opacity=".38"/></svg>'),'16px 16px']
   };

   // ---- 테마 ----
   const THEMES={
     pink:{name:'딸기우유',bg:'#fff4f6',paper:'#ffffff',solid:'#ffffff',accent:'#ec5a76',ink:'#5d3a45',soft:'#a77d8a',line:'#f7dde4',cell:'#fff0f3',on:'#ffffff',over:'#c42f4e',leaf:'#5fae6e',font:UI_ROUND,icon:'berry',pattern:'berry',preview:'#fff4f6'},
     night:{name:'밤하늘 별빛',bg:'#161936',paper:'rgba(48,52,104,.6)',solid:'#262a55',accent:'#f6d88f',ink:'#eef0ff',soft:'#a9aedb',line:'rgba(255,255,255,.1)',cell:'rgba(255,255,255,.07)',on:'#1d1f45',over:'#ff8da1',leaf:'#fff6d6',font:UI_ROUND,icon:'moon',preview:'linear-gradient(160deg,#121532,#2b2457)'},
     cream:{name:'빈티지 크림',bg:'#f7efe2',paper:'#fffaf2',solid:'#fffaf2',accent:'#b9844f',ink:'#5b4532',soft:'#9c8770',line:'#ecdfc8',cell:'#f4eadb',on:'#ffffff',over:'#c4513f',leaf:'#7c9a5d',font:UI_ROUND,icon:'cookie',pattern:'dots',preview:'#f7efe2'},
     simple:{name:'심플',bg:'#f2f2f7',paper:'#ffffff',solid:'#ffffff',accent:'#007aff',ink:'#1c1c1e',soft:'#8e8e93',line:'#e5e5ea',cell:'#f2f2f7',on:'#ffffff',over:'#ff3b30',leaf:'#34c759',font:UI_SYS,icon:'',preview:'#f2f2f7'}
   };
   // 예전 테마를 쓰던 사람은 가장 비슷한 새 테마로 옮김
   const THEME_ALIAS={dark:'night',ios:'simple',purple:'pink',blue:'pink',green:'pink'};
   if(!THEMES[db.theme])db.theme=THEME_ALIAS[db.theme]||'pink';
   const theme=()=>THEMES[db.theme]||THEMES.pink;
   const logo=()=>theme().icon?art(theme().icon):ic('pencil');

   const PAPERS={
     cream:['크림','#fffaf3','#e9dcd3','#71584f'],
     pink:['딸기우유','#ffe9f0','#efbfcf','#79536a'],
     lavender:['라벤더','#f0e9ff','#d6c6f2','#66547e'],
     soda:['소다','#e7f5ff','#c0dff3','#496a83'],
     vintage:['빈티지','#e9d7b5','#c5ae8a','#624b3a'],
     white:['화이트','#ffffff','#eeeeee','#555555'],
     mint:['민트','#e8f8ee','#c8e9d4','#456e56'],
     dark:['다크','#292638','#59536d','#f6eefa']
   };
   const FONTS={
     basic:['기본','system-ui, sans-serif'],
     gothic:['고딕','"Malgun Gothic","Apple SD Gothic Neo",sans-serif'],
     serif:['명조','"Nanum Myeongjo","Batang",serif'],
     handwriting:['손글씨','"Nanum Pen Script",cursive'],
     rounded:['둥근 글씨','"Gowun Dodum","Nanum Gothic",sans-serif'],
     mono:['타자기','"Courier New",monospace']
   };
   const PACKS={
     큐티:'🎀 💗 🐰 🍓 🧸 🍰 🌷 🍒',
     자연:'🍀 🌻 🌿 🍄 🦋 🌼 🌱 🐝',
     반짝이:'✨ ⭐ 🌙 💎 🪄 🪐 ☁️ 🫧',
     감정:'🥰 😭 😴 😡 🥹 🥳 💸 🔥',
     문구:'📌 📎 📝 💌 📚 ✏️ 🎟️ 🗒️',
     먹거리:'🍮 🍩 🍪 🍕 🧋 🍦 🍉 🍡'
   };

   const fmt=n=>Math.round(Number(n)||0).toLocaleString('ko-KR');
   const short=n=>n>=10000?Math.round(n/1000)+'k':n>=1000?(n/1000).toFixed(1).replace(/\.0$/,'')+'k':String(Math.round(n));
   const esc=s=>String(s??'').replace(/[&<>"']/g,
     c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const dateKey=ms=>{
     const p=new Intl.DateTimeFormat('en-US',{
       timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'
     }).formatToParts(new Date(ms));
     const v=k=>p.find(x=>x.type===k)?.value;
     return `${v('year')}-${v('month')}-${v('day')}`;
   };
   const today=()=>dateKey(Date.now());
   const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db));return true}
     catch{alert('저장 공간이 부족해요. JSON 백업 후 사진을 정리해 주세요.');return false}};
   const download=(name,data,type)=>{
     const blob=data instanceof Blob?data:new Blob([data],{type});
     const url=URL.createObjectURL(blob),a=document.createElement('a');
     a.href=url;a.download=name;a.click();
     setTimeout(()=>URL.revokeObjectURL(url),3000);
   };

   // 일별 합계는 db.usage에 누적 저장. from 이전 날짜는 저장값 유지, from 이후는 새 조회값으로 교체.
   const mergeUsage=(stored,fresh,from)=>{const out={};for(const [d,v] of Object.entries(stored))if(from&&d<from)out[d]=v;for(const [d,v] of Object.entries(fresh))if(!from||d>=from)out[d]=v;return Object.fromEntries(Object.entries(out).sort())};
   // 전체·월별 합계. amount와 같은 기준(보정 포함, 0 이하는 미사용)으로 계산.
   const usageOverview=(usage,manual)=>{const months={};let total=0,days=0,first='';for(const d of [...new Set([...Object.keys(usage),...Object.keys(manual)])].sort()){const v=Math.max(0,(Number(usage[d])||0)+(Number(manual[d])||0));if(!v)continue;first||=d;total+=v;days++;const m=months[d.slice(0,7)]||={month:d.slice(0,7),total:0,days:0};m.total+=v;m.days++}return {total,days,first,months:Object.values(months)}};
   let usage=db.usage||{},apiOk=false,status='연결 전',busy=false;
   let tab='calendar',month=today().slice(0,7),day=today();
   let diaryOpen=false,pack='큐티',selected=-1,noteTimer=null,showAllMonths=false;
   let selectedCapture=-1;

   const amount=d=>Math.max(0,(Number(usage[d])||0)+(Number(db.manual[d])||0));
   const total=m=>{
     const [y,mo]=m.split('-').map(Number);
     return Array.from({length:new Date(y,mo,0).getDate()},(_,i)=>
       amount(`${m}-${String(i+1).padStart(2,'0')}`))
       .reduce((a,b)=>a+b,0);
   };
   const dateMove=(d,n)=>{
     const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);
     return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
   };
   const hasDiary=d=>!!(db.notes[d]||db.stickers[d]?.length||db.captures[d]?.length);

   const css=document.createElement('style');
   css.textContent=`
   #crd-root{--bg:#fff4f6;--paper:#fff;--solid:#fff;--accent:#ec5a76;--ink:#5d3a45;--soft:#a77d8a;
     --line:#f7dde4;--cell:#fff0f3;--on:#fff;--over:#c42f4e;--leaf:#5fae6e;--ui-font:${UI_ROUND};
     position:fixed;inset:0;z-index:2147483000;pointer-events:none;
     font-family:var(--ui-font);color:var(--ink);letter-spacing:-.2px}
   #crd-root *{box-sizing:border-box}
   #crd-root button,#crd-root input,#crd-root textarea,#crd-root select{font:inherit;letter-spacing:inherit}
   #crd-root button{cursor:pointer;-webkit-tap-highlight-color:transparent}
   #crd-root svg{display:block}
   #crd-root .fab{display:none;position:absolute;right:12px;top:55%;pointer-events:auto;
     border:1px solid var(--accent);background:var(--solid);color:var(--ink);
     border-radius:50px;padding:10px 14px;box-shadow:0 5px 20px #0003;font-size:12px}
   #crd-root .mask{display:none;position:absolute;inset:0;background:rgba(0,0,0,.35);pointer-events:auto}
   #crd-root.open .mask{display:block}
   #crd-root .panel{display:none;position:absolute;right:15px;bottom:15px;
     width:min(420px,calc(100vw - 30px));height:min(760px,90vh);background:var(--bg);
     border-radius:24px;overflow:hidden;pointer-events:auto;flex-direction:column;
     box-shadow:0 14px 44px rgba(0,0,0,.24)}
   #crd-root.open .panel{display:flex}
   #crd-root .head,#crd-root .content,#crd-root .bottom{position:relative;z-index:1}
   #crd-root .head{display:flex;align-items:center;justify-content:space-between;
     padding:10px 10px 10px 16px;background-color:var(--bg);background-image:var(--pattern,none);
     background-size:var(--pattern-size,auto);border-bottom:1px solid var(--line)}
   #crd-root .brand{display:flex;align-items:center;gap:7px;font-size:15px;font-weight:700}
   #crd-root .brand svg{width:24px;height:24px}
   #crd-root .iconbtn{flex:none;width:34px;height:34px;border:0;border-radius:50%;padding:0;
     background:transparent;color:var(--soft);display:grid;place-items:center}
   #crd-root .iconbtn svg{width:19px;height:19px}
   #crd-root .iconbtn.fill{background:var(--accent);color:var(--on)}
   #crd-root .head .iconbtn{background:var(--paper);border:1px solid var(--line);width:32px;height:32px}
   #crd-root .content{flex:1;min-height:0;padding:10px 12px 16px;overflow:auto;overscroll-behavior:contain;overflow-anchor:none}
   #crd-root .bottom{display:flex;padding:3px 6px 5px;background:var(--paper);border-top:1px solid var(--line)}
   #crd-root .bottom button{flex:1;border:0;background:transparent;color:var(--soft);display:flex;
     flex-direction:column;align-items:center;gap:2px;padding:6px 0 3px;font-size:11px}
   #crd-root .bottom button svg{width:22px;height:22px}
   #crd-root .bottom button.active{color:var(--accent);font-weight:700}
   #crd-root .card{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:12px;margin-bottom:10px}
   #crd-root .title{font-weight:700;font-size:14px;margin-bottom:10px}
   #crd-root .row{display:flex;align-items:center;justify-content:space-between;gap:7px}
   #crd-root .muted{font-size:11px;color:var(--soft);line-height:1.5}
   #crd-root .btn{border:1px solid var(--line);background:var(--paper);color:var(--ink);
     padding:8px 10px;border-radius:12px;font-size:12px}
   #crd-root .primary{background:var(--accent);border-color:var(--accent);color:var(--on)}
   #crd-root .tools{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0}

   #crd-root .strip-top{display:flex;justify-content:space-between;align-items:flex-end;gap:8px}
   #crd-root .lbl{display:block;font-size:11px;color:var(--soft);margin-bottom:2px}
   #crd-root .big{font-size:25px;font-weight:700;letter-spacing:-.6px}
   #crd-root .strip-top .of{font-size:12px;color:var(--soft)}
   #crd-root .strip-top .right{text-align:right;font-size:15px;font-weight:700}
   #crd-root .bars{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
   #crd-root .bar{height:6px;border-radius:6px;background:var(--cell);overflow:hidden}
   #crd-root .bar span{display:block;height:100%;background:var(--accent);border-radius:6px}
   #crd-root .bar.over span{background:var(--over)}
   #crd-root .bars small{display:block;font-size:10px;color:var(--soft);margin-top:4px}
   #crd-root .msg{font-size:12px;color:var(--soft);margin-top:8px}

   #crd-root .quick{display:flex;gap:4px;align-items:center;background:var(--paper);border:1px solid var(--line);
     border-radius:18px;padding:5px 5px 5px 12px;margin-bottom:10px}
   #crd-root .quick .qicon svg{width:20px;height:20px;color:var(--accent)}
   #crd-root .quick input{flex:1;min-width:0;border:0;background:transparent;padding:9px 4px;outline:0;color:var(--ink);font-size:14px}
   #crd-root .quick input::placeholder{color:var(--soft)}
   #crd-root .note-peek{display:block;width:100%;text-align:left;border:0;background:var(--paper);color:var(--ink);
     border-radius:14px;padding:9px 12px;font-size:13px;line-height:1.55;margin:-4px 0 4px;
     white-space:pre-wrap;max-height:70px;overflow:hidden;position:relative}

   #crd-root .cal-head{display:flex;align-items:center;justify-content:space-between;margin:-4px -4px 6px}
   #crd-root .cal-head b{font-size:15px}
   #crd-root .cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
   #crd-root .week{text-align:center;font-size:10px;padding:2px 0 4px;color:var(--soft)}
   #crd-root .cal button{position:relative;height:44px;min-width:0;border:0;border-radius:11px;
     background:var(--cell);color:var(--ink);padding:0;font-size:12px;display:flex;flex-direction:column;
     align-items:center;justify-content:center;gap:2px}
   #crd-root .cal button small{font-size:9px;line-height:1;color:var(--soft);letter-spacing:-.4px;
     max-width:100%;overflow:hidden;white-space:nowrap}
   #crd-root .l1{background:color-mix(in srgb,var(--accent) 20%,var(--cell))!important}
   #crd-root .l2{background:color-mix(in srgb,var(--accent) 42%,var(--cell))!important}
   #crd-root .l3{background:color-mix(in srgb,var(--accent) 68%,var(--cell))!important;color:var(--on)!important}
   #crd-root .l4{background:var(--accent)!important;color:var(--on)!important}
   #crd-root .lover{background:var(--over)!important;color:#fff!important}
   #crd-root .cal .l3 small,#crd-root .cal .l4 small,#crd-root .cal .lover small{color:inherit;opacity:.85}
   #crd-root .cal button.today{box-shadow:inset 0 0 0 2px var(--ink)}
   #crd-root .cal button.future{opacity:.5}
   #crd-root .cal .dot{position:absolute;top:4px;right:5px;width:5px;height:5px;border-radius:50%;background:var(--leaf)}
   #crd-root .legend{display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:8px;font-size:10px;color:var(--soft)}
   #crd-root .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--cell)}
   #crd-root .legend .gap{width:6px}
   #crd-root .legend .dotk{width:6px;height:6px;border-radius:50%;background:var(--leaf)}

   #crd-root .diary-top{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:8px}
   #crd-root .daynav{display:flex;align-items:center;gap:2px;font-size:15px;font-weight:700}
   #crd-root .back{display:flex;align-items:center;gap:2px;border:0;background:transparent;color:var(--soft);padding:6px 4px;font-size:12px}
   #crd-root .back svg{width:17px;height:17px}
   #crd-root .save-state{font-size:11px;color:var(--soft);min-width:42px;text-align:right}
   #crd-root .dayinfo{display:flex;align-items:center;gap:6px;background:var(--cell);border-radius:12px;
     padding:7px 10px;margin-bottom:8px;font-size:12px}
   #crd-root .dayinfo svg{width:18px;height:18px;flex:none}
   #crd-root .capture-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin:10px 0 4px;padding:11px}
   #crd-root .capture-btn svg{width:18px;height:18px}
   #crd-root .diary-fold{border:1px solid var(--line);border-radius:14px;background:var(--paper);margin:8px 0;overflow:hidden}
   #crd-root .diary-fold>summary{display:flex;align-items:center;justify-content:space-between;list-style:none;cursor:pointer;padding:12px;font-size:12px;font-weight:700;user-select:none}
   #crd-root .diary-fold>summary::-webkit-details-marker{display:none}
   #crd-root .diary-fold>summary::after{content:'⌄';font-size:17px;color:var(--soft);transition:transform .15s}
   #crd-root .diary-fold[open]>summary::after{transform:rotate(180deg)}
   #crd-root .fold-body{padding:0 10px 10px;border-top:1px solid var(--line)}
   #crd-root .fold-body .tools{margin:8px 0}
   #crd-root .fold-body .muted{margin:8px 0 4px}

   #crd-root .metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}
   #crd-root .metric{background:var(--cell);border-radius:12px;padding:10px}
   #crd-root .metric strong{display:block;font-size:18px;margin-top:4px}
   #crd-root .progress{height:7px;background:var(--cell);border-radius:10px;overflow:hidden;margin:8px 0}
   #crd-root .progress span{display:block;height:100%;background:var(--accent);border-radius:10px}
   #crd-root .mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
   #crd-root .mini>div{background:var(--cell);border-radius:11px;padding:7px 8px;min-width:0}
   #crd-root .mini span{display:block;font-size:10px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   #crd-root .mini b{display:block;font-size:14px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   #crd-root .mlist{margin-top:10px}
   #crd-root .mrow{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:inherit;
     padding:6px 4px;border-radius:9px;font-size:12px;text-align:left}
   #crd-root .mrow.sel{background:var(--cell)}
   #crd-root .mname{flex:none;width:44px}
   #crd-root .mname small{font-size:9px;color:var(--soft)}
   #crd-root .mbar{flex:1;height:6px;border-radius:6px;background:var(--cell);overflow:hidden}
   #crd-root .mrow.sel .mbar{background:var(--paper)}
   #crd-root .mbar span{display:block;height:100%;background:var(--accent);border-radius:6px}
   #crd-root .mval{flex:none;min-width:62px;text-align:right;font-weight:700}
   #crd-root .more{display:block;width:100%;margin-top:4px;border:0;background:transparent;color:var(--accent);font-size:12px;padding:6px}
   #crd-root .month-row{display:block;width:100%;text-align:left;background:var(--cell);color:inherit;
     border:1px solid transparent;border-radius:12px;padding:9px 10px;margin-top:6px}
   #crd-root .month-row.sel{border-color:var(--accent)}
   #crd-root .month-row .progress,#crd-root .month-row .muted{display:block}
   #crd-root .month-row .progress{background:var(--paper)}
   #crd-root input,#crd-root select{width:100%;padding:9px;border:1px solid var(--line);
     border-radius:12px;background:var(--paper);color:var(--ink)}
   #crd-root select option{color:#222;background:#fff}

   #crd-root .sheet{--sheet-bg:#fffaf3;--sheet-line:#e9dcd3;--sheet-ink:#71584f;
     position:relative;min-height:410px;border:1px solid var(--line);border-radius:14px;
     background:var(--sheet-bg);color:var(--sheet-ink);overflow:hidden}
   #crd-root .sheet.lined{background-image:repeating-linear-gradient(
     to bottom,transparent 0,transparent 30px,var(--sheet-line) 31px)}
   #crd-root .sheet.grid{background-image:linear-gradient(var(--sheet-line) 1px,transparent 1px),
     linear-gradient(90deg,var(--sheet-line) 1px,transparent 1px);background-size:24px 24px}
   #crd-root .writing{display:block;position:relative;z-index:1;
     width:calc(100% - 24px);height:250px;margin:12px;padding:0;
     background:transparent;border:0;outline:0;resize:none;
     color:inherit;font:14px/31px system-ui,sans-serif}
   #crd-root .writing::placeholder{color:inherit;opacity:.45}
   #crd-root .captures{position:absolute;inset:0;z-index:2;pointer-events:none}
   #crd-root .capture{position:absolute;left:0;top:0;width:85%;padding:0;
     pointer-events:auto;cursor:grab;touch-action:none;user-select:none}
   #crd-root .capture:active{cursor:grabbing}
   #crd-root .sheet.crd-dragging{overflow:hidden;overflow-anchor:none}
   #crd-root .sheet.crd-dragging .capture-toolbar,#crd-root .sheet.crd-dragging .sticker-toolbar{visibility:hidden!important}
   #crd-root .capture.selected-capture{outline:1px dashed var(--accent);outline-offset:3px;border-radius:7px}
   #crd-root .capture img{display:block;width:100%;height:auto;pointer-events:none;border-radius:5px}
   #crd-root .capture-toolbar{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);
     z-index:20;display:flex;gap:4px;padding:5px;margin-bottom:5px;border-radius:12px;
     background:var(--solid);border:1px solid var(--line);box-shadow:0 3px 12px #0003;
     pointer-events:auto;white-space:nowrap;touch-action:manipulation}
   #crd-root .capture-toolbar button{border:0;background:var(--cell);color:var(--ink);
     width:32px;height:30px;border-radius:8px;font-size:15px;cursor:pointer}
   #crd-root .capture-toolbar button[data-capture-action="delete"]{color:var(--over)}
   #crd-root .layer{position:absolute;inset:0;z-index:3;pointer-events:none}
   #crd-root .sticker{position:absolute;display:grid;place-items:center;
     transform:translate(-50%,-50%);touch-action:none;user-select:none;
     pointer-events:auto;cursor:grab;line-height:1}
   #crd-root .sticker.text-sticker{display:block;width:max-content!important;height:auto!important;max-width:92%;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left;padding:3px 5px;line-height:1.35;min-height:25px}
   #crd-root .sticker img{width:100%;height:100%;object-fit:contain;pointer-events:none}
   #crd-root .sticker.chosen{outline:1px dashed var(--accent);outline-offset:3px}
   #crd-root .sticker-toolbar{position:absolute;z-index:15;display:flex;gap:3px;
     padding:5px;background:var(--solid);border:1px solid var(--line);border-radius:12px;
     box-shadow:0 4px 14px #0003;pointer-events:auto;white-space:nowrap}
   #crd-root .sticker-toolbar button{border:0;background:var(--cell);color:var(--ink);
     min-width:30px;height:30px;border-radius:8px;font-size:15px;padding:0 5px}
   #crd-root .sticker-toolbar button[data-act="delete-sticker"]{color:var(--over)}
   #crd-root .picker{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:4px;margin:8px 0}
   #crd-root .picker button{min-width:0;min-height:37px;background:var(--cell);
     border:0;border-radius:9px;font-size:19px}
   #crd-root .photo-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin:8px 0}
   #crd-root .photo-tile{position:relative;aspect-ratio:1;min-width:0;color:var(--soft);
     border:1px solid var(--line);border-radius:10px;background:var(--cell);
     overflow:hidden;display:grid;place-items:center;padding:2px}
   #crd-root .photo-tile img{width:100%;height:100%;object-fit:contain}
   #crd-root .photo-tile .x{position:absolute;right:0;top:0;border:0;
     background:#fff;color:#b35d7a;border-radius:0 0 0 6px;font-size:12px}

   #crd-root .theme-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
   #crd-root .theme-choice{display:flex;align-items:center;gap:8px;border:2px solid transparent;border-radius:14px;
     padding:12px;text-align:left;font-size:13px;font-weight:700;min-height:52px;
     box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
   #crd-root .theme-choice svg{width:22px;height:22px;flex:none}
   #crd-root .theme-choice.sel{border-color:var(--accent)}
   .crd-capture-hover{outline:2px solid #ec5a76!important;cursor:crosshair!important}

   /* 밤하늘 별빛 */
   #crd-root[data-theme="night"] .panel{background:linear-gradient(180deg,#111432 0%,#1c1c48 55%,#2a2356 100%)}
   #crd-root[data-theme="night"] .panel::before,#crd-root[data-theme="night"] .panel::after{
     content:'';position:absolute;inset:0;pointer-events:none;z-index:0;
     animation:crd-twinkle 3.6s ease-in-out infinite alternate}
   #crd-root[data-theme="night"] .panel::before{background-size:210px 210px;background-image:
     radial-gradient(1.2px 1.2px at 22px 34px,#fff,transparent),radial-gradient(1px 1px at 96px 82px,#fff,transparent),
     radial-gradient(1.6px 1.6px at 158px 24px,#fff6d6,transparent),radial-gradient(1px 1px at 62px 146px,#cfd4ff,transparent),
     radial-gradient(1.5px 1.5px at 186px 122px,#fff,transparent),radial-gradient(1px 1px at 128px 178px,#fff,transparent)}
   #crd-root[data-theme="night"] .panel::after{background-size:270px 270px;animation-delay:-1.8s;background-image:
     radial-gradient(1px 1px at 40px 210px,#fff,transparent),radial-gradient(1.4px 1.4px at 230px 60px,#fff6d6,transparent),
     radial-gradient(1px 1px at 140px 120px,#dfe2ff,transparent),radial-gradient(1.2px 1.2px at 200px 240px,#fff,transparent),
     radial-gradient(1px 1px at 90px 20px,#fff,transparent)}
   @keyframes crd-twinkle{from{opacity:.35}to{opacity:1}}
   #crd-root[data-theme="night"] .head{background:transparent;border-bottom-color:rgba(255,255,255,.08)}
   #crd-root[data-theme="night"] .head .brand{text-shadow:0 0 12px rgba(246,216,143,.35)}
   #crd-root[data-theme="night"] .bottom{background:rgba(14,16,42,.55)}
   #crd-root[data-theme="night"] .card,#crd-root[data-theme="night"] .quick,#crd-root[data-theme="night"] .diary-fold{
     backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
   #crd-root[data-theme="night"] .theme-choice{box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}

   @media(max-width:699px){
     #crd-root .mask{background:transparent;pointer-events:none}
     #crd-root .panel{left:auto;right:8px;bottom:max(8px,env(safe-area-inset-bottom));
       width:min(92vw,400px);height:min(70dvh,620px);max-height:calc(100dvh - 24px);
       border-radius:22px;box-shadow:0 10px 32px rgba(0,0,0,.28)}
     #crd-root .head{padding:8px 8px 8px 14px}
     #crd-root .content{padding:8px 10px 12px}
     #crd-root .card{padding:11px;margin-bottom:8px}
   }
   @media (prefers-reduced-motion:reduce){#crd-root .panel::before,#crd-root .panel::after{animation:none!important}}
   `;
   document.head.appendChild(css);

   const root=document.createElement('div');
   root.id='crd-root';
   root.innerHTML=`
     <div class="mask"></div>
     <button class="fab">📔 다이어리</button>
     <section class="panel">
       <header class="head">
         <div class="brand"><span class="logo"></span><span>크래커 다이어리</span></div>
         <button class="iconbtn" data-act="close" aria-label="닫기">${ic('x')}</button>
       </header>
       <main class="content"></main>
       <nav class="bottom"></nav>
     </section>`;
   document.body.appendChild(root);

   const content=root.querySelector('.content');
   const bottom=root.querySelector('.bottom');
   const fab=root.querySelector('.fab');

   function applyTheme(){
     const t=theme();
     root.dataset.theme=db.theme;
     const vars={bg:t.bg,paper:t.paper,solid:t.solid,accent:t.accent,ink:t.ink,soft:t.soft,
       line:t.line,cell:t.cell,on:t.on,over:t.over,leaf:t.leaf,'ui-font':t.font};
     for(const [k,v] of Object.entries(vars))root.style.setProperty('--'+k,v);
     const p=PATTERNS[t.pattern];
     root.style.setProperty('--pattern',p?p[0]:'none');
     root.style.setProperty('--pattern-size',p?p[1]:'auto');
     root.querySelector('.logo').innerHTML=logo();
   }
   const card=(title,body)=>`<section class="card">
     ${title?`<div class="title">${title}</div>`:''}${body}</section>`;

   // 오늘·이번 달 요약 (한 덩어리)
   function summary(){
     const used=amount(today()),goal=Number(db.goalDaily)||0;
     const monthUsed=total(today().slice(0,7)),monthGoal=Number(db.goalMonthly)||0;
     const pd=goal?Math.round(used/goal*100):0,pm=monthGoal?Math.round(monthUsed/monthGoal*100):0;
     const msg=goal?(used<=goal?'🌿 오늘은 절약 목표 이내예요 ♡':'💸 오늘은 설정한 예산을 넘었어요'):'오늘도 즐거운 플레이 ♡';
     return card('',`
       <div class="strip-top">
         <div><span class="lbl">오늘 쓴 크래커</span><b class="big">${fmt(used)}</b>${goal?` <span class="of">/ ${fmt(goal)}</span>`:''}</div>
         <div class="right"><span class="lbl">이번 달</span>${fmt(monthUsed)}</div>
       </div>
       <div class="bars">
         <div><div class="bar ${pd>100?'over':''}"><span style="width:${Math.min(100,pd)}%"></span></div><small>하루 한도 ${pd}%</small></div>
         <div><div class="bar ${pm>100?'over':''}"><span style="width:${Math.min(100,pm)}%"></span></div><small>월 한도 ${pm}%</small></div>
       </div>
       <div class="msg">${msg}</div>`);
   }

   // 오늘 한 줄: 달력 화면에서 바로 쓰기
   function quick(){
     const t=today(),note=db.notes[t]||'';
     return `<div class="quick">
       <span class="qicon">${logo()}</span>
       <input id="quick-line" maxlength="300" enterkeyhint="done" autocomplete="off"
         placeholder="${note?'한 줄 더 남기기':'오늘 한 줄 남기기'}">
       <button class="iconbtn fill" data-act="quick-save" aria-label="저장">${ic('check')}</button>
       <button class="iconbtn" data-act="quick-capture" aria-label="채팅 캡처">${ic('cam')}</button>
     </div>${note?`<button class="note-peek" data-day="${t}">${esc(note)}</button>`:''}`;
   }

   function calendar(){
     const [y,m]=month.split('-').map(Number);
     const days=new Date(y,m,0).getDate();
     const offset=new Date(y,m-1,1).getDay();
     const t=today(),goal=Number(db.goalDaily)||0;
     const keys=Array.from({length:days},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`);
     const max=Math.max(1,...keys.map(amount));
     const level=v=>{
       if(!v)return '';
       if(goal&&v>goal)return 'lover';
       const r=v/(goal||max);
       return r<=.25?'l1':r<=.5?'l2':r<=.8?'l3':'l4';
     };
     let cells=['일','월','화','수','목','금','토']
       .map(x=>`<div class="week">${x}</div>`).join('');
     for(let i=0;i<offset;i++)cells+='<div></div>';
     keys.forEach((d,i)=>{
       const used=amount(d);
       const cls=[level(used),d===t?'today':'',d>t?'future':''].filter(Boolean).join(' ');
       cells+=`<button data-day="${d}" class="${cls}" aria-label="${m}월 ${i+1}일 ${fmt(used)}">
         ${hasDiary(d)?'<span class="dot"></span>':''}<span>${i+1}</span><small>${used?fmt(used):''}</small></button>`;
     });
     return card('',`
       <div class="cal-head">
         <button class="iconbtn" data-act="prev-month" aria-label="이전 달">${ic('left')}</button>
         <b>${y}년 ${m}월</b>
         <button class="iconbtn" data-act="next-month" aria-label="다음 달">${ic('right')}</button>
       </div>
       <div class="cal">${cells}</div>
       <div class="legend">적게<i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i>많이
         ${goal?'<span class="gap"></span><i class="lover"></i>한도 초과':''}
         <span class="gap"></span><i class="dotk"></i>일기</div>`);
   }

   function diary(){
     const [y,m,d]=day.split('-').map(Number);
     const wd='일월화수목금토'[new Date(y,m-1,d).getDay()];
     const used=amount(day),goal=Number(db.goalDaily)||0;
     const judge=day>today()?'아직 오지 않은 날이에요'
       :goal?(used<=goal?'목표 이내 🌿':'한도를 넘었어요 💸'):'';
     return `
       <div class="diary-top">
         <button class="back" data-act="back">${ic('left')}달력</button>
         <div class="daynav">
           <button class="iconbtn" data-act="prev-day" aria-label="전날">${ic('left')}</button>
           <span>${m}.${d} (${wd})</span>
           <button class="iconbtn" data-act="next-day" aria-label="다음날">${ic('right')}</button>
         </div>
         <span class="save-state" id="save-state"></span>
       </div>
       <div class="dayinfo">${logo()}<span><b>${fmt(used)}</b> 크래커${judge?' · '+judge:''}</span></div>
       <div class="sheet ${esc(db.paper)}" id="diary-sheet">
         <textarea id="diary-writing" class="writing"
           placeholder="오늘의 이야기를 적어봐 ♡ (쓰는 대로 자동 저장돼요)"></textarea>
         <div class="captures" id="capture-list"></div>
         <div class="layer" id="sticker-layer"></div>
       </div>
       <button class="btn primary capture-btn" data-act="capture">${ic('cam')}채팅 캡처 붙이기</button>
       <details class="diary-fold">
         <summary>📝 종이·글꼴</summary>
         <div class="fold-body">
           <div class="tools">
             <select id="paper-color" style="flex:1;min-width:90px">
               ${Object.entries(PAPERS).map(([id,p])=>
                 `<option value="${id}" ${db.paperColor===id?'selected':''}>${p[0]}</option>`).join('')}
             </select>
             <select id="paper-kind" style="flex:1;min-width:90px">
               <option value="lined" ${db.paper==='lined'?'selected':''}>줄노트</option>
               <option value="grid" ${db.paper==='grid'?'selected':''}>모눈</option>
               <option value="blank" ${db.paper==='blank'?'selected':''}>무지</option>
             </select>
             <select id="diary-font" style="flex:1;min-width:90px">
               ${Object.entries(FONTS).map(([id,f])=>
                 `<option value="${id}" ${db.diaryFont===id?'selected':''}>${f[0]}</option>`).join('')}
             </select>
           </div>
         </div>
       </details>
       <details class="diary-fold">
         <summary>✍️ 자유 글자 꾸미기</summary>
         <div class="fold-body">
           <textarea id="free-text-input" placeholder="일기장에 붙일 글자를 입력해 줘 ♡" rows="3" style="width:100%;margin-top:8px;resize:vertical;border:1px solid var(--line);border-radius:10px;padding:9px;background:var(--paper);color:var(--ink)"></textarea>
           <div class="tools">
             <select id="free-text-font" style="flex:1;min-width:100px">${Object.entries(FONTS).map(([id,f])=>`<option value="${id}">${f[0]}</option>`).join('')}</select>
             <input type="color" id="free-text-color" value="#654552" title="글자 색상" style="width:54px;height:37px;padding:3px;flex:none">
             <button class="btn primary" data-act="add-free-text">＋ 글자 붙이기</button>
           </div>
           <p class="muted">붙인 글자를 누르면 이동·크기·회전·수정·삭제할 수 있어요.</p>
         </div>
       </details>
       <details class="diary-fold">
         <summary>🎀 스티커 꾸미기</summary>
         <div class="fold-body">
           <div class="tools" id="pack-buttons"></div>
           <div class="picker" id="picker"></div>
           <p class="muted">스티커를 누르면 바로 옆에서 크기·회전·삭제를 조절할 수 있어요.</p>
         </div>
       </details>
       <details class="diary-fold">
         <summary>🖼️ 내 사진 스티커</summary>
         <div class="fold-body">
           <p class="muted">사진을 누르면 일기장에 붙여져요.</p>
           <div class="photo-grid" id="photo-grid"></div>
         </div>
       </details>
       <input type="file" id="photo-upload" accept="image/png,image/jpeg,image/webp"
         multiple style="display:none">`;
   }

   function overview(){
     const o=usageOverview(usage,db.manual),goal=Number(db.goalMonthly)||0;
     const peak=Math.max(0,...o.months.map(x=>x.total));
     const peakMonth=o.months.find(x=>x.total===peak);
     const list=[...o.months].reverse();
     const shown=showAllMonths?list:list.slice(0,4);
     return card(`전체 통계${o.first?` <span class="muted" style="font-weight:400">${o.first.replaceAll('-','.')}부터</span>`:''}`,`
       <div class="mini">
         <div><span>총 누적</span><b>${fmt(o.total)}</b></div>
         <div><span>사용한 날</span><b>${fmt(o.days)}일</b></div>
         <div><span>사용일 평균</span><b>${fmt(o.days?o.total/o.days:0)}</b></div>
       </div>
       <div class="mlist">${shown.map(x=>{
         const over=goal&&x.total>goal;
         return `<button class="mrow ${x.month===month?'sel':''}" data-stat-month="${x.month}" aria-pressed="${x.month===month}">
           <span class="mname">${Number(x.month.slice(5))}월${x.month.slice(0,4)!==today().slice(0,4)?` <small>${x.month.slice(2,4)}</small>`:''}</span>
           <span class="mbar"><span style="width:${peak?x.total/peak*100:0}%${over?';background:var(--over)':''}"></span></span>
           <span class="mval">${fmt(x.total)}</span>
         </button>`}).join('')||'<p class="muted">아직 기록이 없어요.</p>'}</div>
       ${list.length>4?`<button class="more" data-act="toggle-months">${showAllMonths?'접기':`지난 달 ${list.length-4}개 더 보기`}</button>`:''}
       ${peakMonth?`<p class="muted" style="margin-top:6px">가장 많이 쓴 달: ${peakMonth.month.replace('-','.')} · ${fmt(peak)}</p>`:''}`);
   }

   function stats(){
     const [y,m]=month.split('-').map(Number);
     const days=new Date(y,m,0).getDate();
     const vals=Array.from({length:days},(_,i)=>
       amount(`${month}-${String(i+1).padStart(2,'0')}`));
     const active=vals.filter(x=>x>0).length;
     const limit=Number(db.goalDaily)||0;
     // 사용 기록이 있는 과거 및 오늘만 집계 (미래 날짜 제외)
     const savedDays=Array.from({length:days},(_,i)=>{
       const d=`${month}-${String(i+1).padStart(2,'0')}`;
       return {d,used:amount(d)};
     }).filter(x=>x.d<=today() && x.used>0 && limit>0 && x.used<=limit);
     return card('',`
       <div class="cal-head">
         <button class="iconbtn" data-act="prev-month" aria-label="이전 달">${ic('left')}</button>
         <b>${y}년 ${m}월 통계</b>
         <button class="iconbtn" data-act="next-month" aria-label="다음 달">${ic('right')}</button>
       </div>
       <div class="mini">
         <div><span>총 사용</span><b>${fmt(vals.reduce((a,b)=>a+b,0))}</b></div>
         <div><span>사용한 날</span><b>${active}일</b></div>
         <div><span>사용일 평균</span><b>${fmt(active?total(month)/active:0)}</b></div>
         <div><span>최대 사용</span><b>${fmt(Math.max(0,...vals))}</b></div>
         <div><span>🌿 절약한 날</span><b>${limit?savedDays.length+'일':'-'}</b></div>
         <div><span>절약률</span><b>${limit&&active?Math.round(savedDays.length/active*100)+'%':'-'}</b></div>
       </div>
       ${limit?'':'<p class="muted" style="margin-top:6px">설정에서 일일 한도를 정하면 절약한 날이 나와요.</p>'}`);
   }

   function settings(){
     return card('테마',`<div class="theme-grid">${
       Object.entries(THEMES).map(([id,t])=>`
       <button data-theme="${id}" class="theme-choice ${db.theme===id?'sel':''}"
         style="background:${t.preview};color:${t.ink}">${t.icon?art(t.icon):ic('pencil')}<span>${t.name}</span></button>`).join('')
     }</div>`)+card('목표 설정',`
       <p class="muted">일일 사용 한도 (이하로 사용하면 절약 성공)</p>
       <input id="goal-daily" type="number" min="0" value="${db.goalDaily}">
       <p class="muted" style="margin-top:6px">월간 사용 한도</p>
       <input id="goal-monthly" type="number" min="0" value="${db.goalMonthly}">
     `)+card('사용량 조회',`
       <div class="row"><span class="muted">${esc(status)}</span>
       <button class="btn" data-act="refresh">새로고침</button></div>
     `)+card('데이터 백업',`
       <div class="tools">
         <button class="btn" data-act="backup">JSON 백업</button>
         <button class="btn" data-act="csv">CSV 내보내기</button>
         <button class="btn" data-act="restore">백업 복원</button>
       </div>
       <input type="file" id="restore-file" accept=".json" style="display:none">
       <p class="muted">사진과 메모는 현재 브라우저에 저장돼요. 백업을 권장해요.</p>
     `)+card('사용량 보정',`
       <input type="date" id="adjust-day" value="${day}">
       <input type="number" id="adjust-value" value="${Number(db.manual[day]||0)}"
         style="margin-top:7px">
       <button class="btn primary" data-act="adjust" style="margin-top:7px">보정 저장</button>
     `);
   }

   function render(){
     applyTheme();
     fab.textContent=`📔 오늘 ${fmt(amount(today()))}${apiOk?'':' · !'}`;
     bottom.innerHTML=[
       ['calendar','cal','달력'],['stats','chart','통계'],['settings','set','설정']
     ].map(([id,i,t])=>`<button data-tab="${id}" class="${tab===id?'active':''}">${ic(i)}<span>${t}</span></button>`).join('');
     content.innerHTML=tab==='calendar'
       ?diaryOpen?diary():summary()+calendar()+quick()
       :tab==='stats'?stats()+overview():settings();
     if(tab==='calendar'&&diaryOpen)initDiary();
   }
   // 입력 중에는 화면을 다시 그리지 않음 (자동 새로고침 때문에 키보드가 닫히지 않게)
   const typing=()=>{const a=document.activeElement;return !!a&&root.contains(a)&&/^(INPUT|TEXTAREA)$/.test(a.tagName)};
   const softRender=()=>{if(typing())fab.textContent=`📔 오늘 ${fmt(amount(today()))}`;else render()};

   function applyPaper(){
     const sheet=root.querySelector('#diary-sheet');
     if(!sheet)return;
     const p=PAPERS[db.paperColor]||PAPERS.cream;
     sheet.style.setProperty('--sheet-bg',p[1]);
     sheet.style.setProperty('--sheet-line',p[2]);
     sheet.style.setProperty('--sheet-ink',p[3]);
     sheet.className='sheet '+db.paper;
   }

   function applyDiaryFont(){
     const font=FONTS[db.diaryFont]||FONTS.basic;
     const writing=root.querySelector('#diary-writing');
     if(!writing)return;
     writing.style.fontFamily=font[1];
     writing.style.fontSize=db.diaryFont==='handwriting'?'20px':'';
   }

   function initDiary(){
     const writing=root.querySelector('#diary-writing');
     writing.value=db.notes[day]||'';
     applyPaper();
     applyDiaryFont();

     const buttons=root.querySelector('#pack-buttons');
     for(const name of Object.keys(PACKS)){
       const b=document.createElement('button');
       b.className='btn'+(pack===name?' primary':'');
       b.textContent=name;
       b.onclick=()=>{
         pack=name;renderPicker();
         buttons.querySelectorAll('button').forEach(x=>
           x.classList.toggle('primary',x.textContent===name));
       };
       buttons.appendChild(b);
     }
     renderPicker();renderPhotos();renderCaptures();paintStickers();
   }

   function renderPicker(){
     const picker=root.querySelector('#picker');
     if(!picker)return;
     picker.innerHTML='';
     for(const emoji of PACKS[pack].split(' ')){
       const b=document.createElement('button');
       b.textContent=emoji;
       b.onclick=()=>addSticker('emoji',emoji);
       picker.appendChild(b);
     }
   }

   function renderPhotos(){
     const grid=root.querySelector('#photo-grid');
     if(!grid)return;
     grid.innerHTML='';

     const add=document.createElement('button');
     add.className='photo-tile';
     add.textContent='＋';
     add.style.fontSize='24px';
     add.title='사진 스티커 추가';
     add.onclick=()=>root.querySelector('#photo-upload').click();
     grid.appendChild(add);

     for(const p of db.custom){
       const tile=document.createElement('div');
       tile.className='photo-tile';
       const img=document.createElement('img');
       img.src=p.data;
       img.title=p.name;
       img.onclick=()=>addSticker('image',p.id);

       const del=document.createElement('button');
       del.className='x';
       del.textContent='×';
       del.title='등록 사진 삭제';
       del.onclick=()=>{
         if(!confirm('이 사진 스티커를 목록에서 삭제할까요?'))return;
         db.custom=db.custom.filter(x=>x.id!==p.id);
         save();renderPhotos();
       };
       tile.append(img,del);grid.appendChild(tile);
     }
   }

   async function uploadPhotos(files){
     for(const file of [...files].slice(0,12)){
       if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>12000000){
         alert('12MB 이하 JPG, PNG, WebP 파일만 가능해요.');continue;
       }
       try{
         const bmp=await createImageBitmap(file);
         const canvas=document.createElement('canvas');
         const scale=Math.min(1,320/Math.max(bmp.width,bmp.height));
         canvas.width=Math.max(1,Math.round(bmp.width*scale));
         canvas.height=Math.max(1,Math.round(bmp.height*scale));
         canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height);
         bmp.close();
         const item={id:crypto.randomUUID(),name:file.name,
           data:canvas.toDataURL('image/png')};
         db.custom.push(item);
         if(!save())db.custom.pop();
       }catch(err){alert('사진 처리 실패: '+err.message)}
     }
     renderPhotos();
   }

   function addSticker(type,value){
     db.stickers[day] ||= [];
     db.stickers[day].push({type,value,x:50,y:35,size:52,rot:0});
     selected=-1;
     save();paintStickers();
   }

   function paintStickers(){
     const layer=root.querySelector('#sticker-layer');
     const sheet=root.querySelector('#diary-sheet');
     if(!layer||!sheet)return;
     layer.innerHTML='';
     const stickers=db.stickers[day]||[];
     stickers.forEach((s,i)=>{
       const el=document.createElement('div');
       el.className='sticker'+(s.type==='text'?' text-sticker':'')+(selected===i?' chosen':'');
       el.style.left=(s.x??50)+'%';
       el.style.top=(s.y??35)+'%';
       el.style.width=s.type==='text'?'max-content':(s.size||52)+'px';
       el.style.height=s.type==='text'?'auto':(s.size||52)+'px';
       el.style.transform=`translate(-50%,-50%) rotate(${s.rot||0}deg)`;
       if(s.type==='text'){
         el.textContent=s.value;
         el.style.width='max-content';el.style.height='auto';
         el.style.fontSize=(s.size||22)+'px';
         el.style.fontFamily=(FONTS[s.font]||FONTS.basic)[1];
         el.style.color=s.color||'#654552';
       }else if(s.type==='image'){
         const p=db.custom.find(x=>x.id===s.value);
         const src=p?.data||(String(s.value).startsWith('data:image/')?s.value:null);
         if(src){const img=document.createElement('img');img.src=src;el.appendChild(img)}
         else el.textContent='🖼️';
       }else{
         el.textContent=s.value;
         el.style.fontSize=(s.size||52)*.8+'px';
       }
       let dragging=false,moved=false,startX=0,startY=0,lockedScroll=0,scrollHost=null;
       el.onpointerdown=e=>{
         e.preventDefault();e.stopPropagation();
         selected=i;dragging=true;moved=false;startX=e.clientX;startY=e.clientY;
         scrollHost=root.querySelector('.content');lockedScroll=scrollHost?.scrollTop||0;
         if(scrollHost)scrollHost.style.overflowY='hidden';
         el.setPointerCapture(e.pointerId);
         paintStickerToolbar();
         layer.querySelectorAll('.sticker').forEach((x,n)=>x.classList.toggle('chosen',n===i));
       };
       el.onpointermove=e=>{
         if(!dragging)return;
         e.preventDefault();
         if(scrollHost&&scrollHost.scrollTop!==lockedScroll)scrollHost.scrollTop=lockedScroll;
         if(Math.hypot(e.clientX-startX,e.clientY-startY)<4&&!moved)return;
         moved=true;
         const r=sheet.getBoundingClientRect();
         s.x=Math.max(3,Math.min(97,(e.clientX-r.left)/r.width*100));
         s.y=Math.max(3,Math.min(97,(e.clientY-r.top)/r.height*100));
         el.style.left=s.x+'%';el.style.top=s.y+'%';
         // 드래그 중 툴바 DOM을 반복 생성하면 브라우저 스크롤 앵커가 움직일 수 있음
         const bar=layer.querySelector('.sticker-toolbar');if(bar)bar.style.visibility='hidden';
       };
       const finishDrag=()=>{if(!dragging)return;dragging=false;
         if(scrollHost){scrollHost.style.overflowY='';scrollHost.scrollTop=lockedScroll;}
         save();paintStickerToolbar();};
       el.onpointerup=finishDrag;
       el.onpointercancel=finishDrag;
       layer.appendChild(el);
     });
     paintStickerToolbar();
   }

   function paintStickerToolbar(){
     const layer=root.querySelector('#sticker-layer');
     const sheet=root.querySelector('#diary-sheet');
     if(!layer||!sheet)return;
     layer.querySelector('.sticker-toolbar')?.remove();
     const s=(db.stickers[day]||[])[selected];
     if(!s)return;
     const bar=document.createElement('div');
     bar.className='sticker-toolbar';
     bar.innerHTML=`${s.type==='text'?'<button data-act="edit-free-text" title="글자 수정">✎</button>':''}<button data-act="shrink" title="축소">−</button>
       <button data-act="grow" title="확대">＋</button>
       <button data-act="rotate" title="회전">↻</button>
       <button data-act="delete-sticker" title="삭제">×</button>`;
     bar.onpointerdown=e=>e.stopPropagation();
     layer.appendChild(bar);
     const w=bar.offsetWidth||150,h=bar.offsetHeight||40;
     const cx=(s.x??50)/100*sheet.clientWidth;
     const cy=(s.y??35)/100*sheet.clientHeight;
     const size=s.type==='text'?Math.max(36,(s.value||'').length*(s.size||22)*.5):(s.size||52);
     const x=Math.max(4,Math.min(sheet.clientWidth-w-4,cx-w/2));
     const above=cy-size/2-h-8;
     const below=cy+size/2+8;
     bar.style.left=Math.max(0,x)+'px';
     bar.style.top=Math.max(4,above>=4?above:Math.min(sheet.clientHeight-h-4,below))+'px';
   }

   function startCapture() {
  root.classList.remove('open');

  let selectedText = '';
  let selecting = true;
  const isMobileCapture = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const T=theme();
  const bar = document.createElement('div');
  bar.id = 'crd-capture-bar';

  bar.style.cssText = `
    position:fixed;z-index:2147483647;top:calc(env(safe-area-inset-top, 0px) + 8px);
    right:8px;left:auto;transform:none;width:min(280px,calc(100vw - 16px));
    max-height:min(48dvh,340px);overflow:auto;overscroll-behavior:contain;
    padding:10px;background:${T.solid};color:${T.ink};
    border:1px solid ${T.accent};border-radius:16px;
    box-shadow:0 6px 22px #0003;font:12px/1.4 ${T.font};
    display:flex;flex-direction:column;gap:6px;
  `;

  bar.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:5px">
      <strong style="font-size:12px">📸 명장면 캡처</strong>
      <div style="display:flex;gap:4px">
        <button type="button" id="crd-capture-toggle" style="border:1px solid ${T.line};background:transparent;color:inherit;border-radius:9px;padding:4px 8px">편집 ▾</button>
        <button type="button" id="crd-selection-cancel" style="border:1px solid ${T.line};background:transparent;color:inherit;border-radius:9px;padding:4px 8px">✕</button>
      </div>
    </div>
    <div id="crd-selection-status" style="font-size:11px;max-height:32px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${isMobileCapture?'캡처할 말풍선을 터치하세요':'마우스로 글자를 선택하세요'}</div>
    <div id="crd-capture-details" style="display:none;flex-direction:column;gap:7px">
      <label style="display:flex;align-items:center;gap:5px;font-size:11px">배경
        <select id="crd-capture-paper" style="flex:1;min-width:0;padding:5px;border:1px solid ${T.line};border-radius:8px;background:${T.solid};color:${T.ink}">
          <option value="transparent">투명 PNG</option>
          ${Object.entries(PAPERS).map(([id,p])=>`<option value="${id}" ${db.paperColor===id?'selected':''}>${p[0]}</option>`).join('')}
        </select>
      </label>
      <label id="crd-mobile-capture-editor-wrap" style="display:${isMobileCapture?'flex':'none'};flex-direction:column;gap:3px;font-size:11px">글귀 편집
        <textarea id="crd-mobile-capture-editor" rows="3" placeholder="말풍선을 터치하면 글귀가 들어와요" style="box-sizing:border-box;width:100%;padding:7px;border:1px solid ${T.line};border-radius:9px;resize:vertical;font:12px/1.4 system-ui;background:${T.solid};color:${T.ink}"></textarea>
      </label>
      <div style="display:flex;gap:5px">
        <button id="crd-selection-preview" style="flex:1;padding:8px;border:1px solid ${T.line};border-radius:9px;background:transparent;color:inherit">미리보기</button>
        <button id="crd-selection-save" style="flex:1;padding:8px;border:0;border-radius:9px;background:${T.accent};color:${T.on};font-weight:700">💾 저장</button>
      </div>
    </div>
  `;

  bar.style.touchAction='manipulation';
  document.body.appendChild(bar);

  const statusEl = bar.querySelector('#crd-selection-status');
  const editor = bar.querySelector('#crd-mobile-capture-editor');
  const details=bar.querySelector('#crd-capture-details');
  const toggle=bar.querySelector('#crd-capture-toggle');
  const setExpanded=(yes)=>{
    details.style.display=yes?'flex':'none';
    toggle.textContent=yes?'접기 ▴':'편집 ▾';
    bar.style.width=yes?'min(300px,calc(100vw - 16px))':'min(230px,calc(100vw - 16px))';
  };
  toggle.onclick=()=>setExpanded(details.style.display==='none');
  setExpanded(false);

  if (isMobileCapture) {
    editor.addEventListener('input', () => {
      selectedText = editor.value.trim();
      statusEl.textContent = selectedText ? `✅ ${selectedText.length}자 준비됨` : '아직 선택한 문장이 없어요.';
    });
  }

  // 모바일 사이트에서는 길게 누르기 선택이 막히기도 하므로
  // 말풍선 탭으로 대사 텍스트를 가져오고 편집창에서 범위를 조절한다.
  function captureBubbleTap(e) {
    if (!selecting || !isMobileCapture || bar.contains(e.target) || root.contains(e.target)) return;
    if (e.target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="button"]')) return;
    const node = e.target.closest('p,[data-message-id],[data-testid*="message"],[class*="message"],[class*="bubble"],article,div');
    if (!node) return;
    let candidate = node;
    let value = '';
    for (let i=0; i<5 && candidate && candidate!==document.body; i++,candidate=candidate.parentElement) {
      if (candidate.closest('#crd-capture-bar,#crd-root')) break;
      const raw=(candidate.innerText||'').trim();
      if (raw.length>=2 && raw.length<=5000 && !candidate.querySelector('textarea,input') && candidate.getBoundingClientRect().height<window.innerHeight*1.5) {
        value=raw; break;
      }
    }
    if (!value) return;
    e.preventDefault();
    e.stopPropagation();
    selectedText=value;
    editor.value=value;
    statusEl.textContent=`✅ ${value.length.toLocaleString()}자 선택됨`;
  }
  if (isMobileCapture) document.addEventListener('click',captureBubbleTap,true);


  // 드래그가 끝났을 때 선택된 텍스트 저장
  function rememberSelection() {
    if (!selecting) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    // 다이어리나 캡처 도구 내부 선택은 제외
    const anchor = selection.anchorNode?.parentElement;
    const focus = selection.focusNode?.parentElement;

    if (
      (anchor && (bar.contains(anchor) || root.contains(anchor))) ||
      (focus && (bar.contains(focus) || root.contains(focus)))
    ) return;

    selectedText = text;
    if (isMobileCapture) editor.value=text;

    statusEl.textContent = `✅ ${text.length.toLocaleString()}자 선택 완료`;
  }

  // 모바일은 손가락을 뗀 뒤에도 선택 손잡이로 범위를 조정한다.
  // selectionchange를 감시해야 마지막 단어 변경까지 반영된다.
  let selectionTimer=null;
  const scheduleSelection=()=>{
    clearTimeout(selectionTimer);
    selectionTimer=setTimeout(rememberSelection,120);
  };
  document.addEventListener('selectionchange', scheduleSelection, true);
  document.addEventListener('mouseup', rememberSelection, true);
  document.addEventListener('touchend', scheduleSelection, true);
  document.addEventListener('keyup', rememberSelection, true);

  function cleanup() {
    selecting = false;
    document.removeEventListener('click',captureBubbleTap,true);
    clearTimeout(selectionTimer);
    document.removeEventListener('selectionchange',scheduleSelection,true);
    document.removeEventListener('mouseup', rememberSelection, true);
    document.removeEventListener('touchend', scheduleSelection, true);
    document.removeEventListener('keyup', rememberSelection, true);

    bar.remove();
    root.classList.add('open');

    const selection = window.getSelection();
    selection?.removeAllRanges();
  }

  function makeCanvas(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const width = 760;
    const padding = 42;
    const fontSize = 23;
    const lineHeight = 39;
    const maxWidth = width - padding * 2;

    ctx.font = `${fontSize}px sans-serif`;

    const lines = [];

    for (const paragraph of text.split(/\r?\n/)) {
      if (!paragraph.trim()) {
        lines.push('');
        continue;
      }

      let current = '';

      for (const char of paragraph) {
        if (
          current &&
          ctx.measureText(current + char).width > maxWidth
        ) {
          lines.push(current);
          current = char;
        } else {
          current += char;
        }
      }

      if (current) lines.push(current);
    }

    if (!lines.length) lines.push('');

    const height = Math.max(
      180,
      padding * 2 + lines.length * lineHeight
    );

    if (height > 30000) {
      throw new Error(
        '선택한 글이 너무 길어요. 구간을 나눠서 캡처해 주세요.'
      );
    }

    canvas.width = width;
    canvas.height = height;

    // 캡처 배경 선택: 현재 일기장 색상을 기본값으로 사용
    const paperId = bar.querySelector('#crd-capture-paper')?.value || db.paperColor;
    const capturePaper = PAPERS[paperId] || PAPERS.cream;
    if(paperId !== 'transparent'){
      ctx.fillStyle = capturePaper[1];
      ctx.fillRect(0, 0, width, height);
    }

    // 왼쪽 장식선
    if(paperId !== 'transparent'){
      ctx.fillStyle = capturePaper[2];
      ctx.fillRect(20, 20, 3, height - 40);
    }

    // 글자
    ctx.fillStyle = paperId === 'transparent' ? '#654552' : capturePaper[3];
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textBaseline = 'top';

    lines.forEach((line, i) => {
      ctx.fillText(line, padding, padding + i * lineHeight);
    });

    return canvas;
  }

  bar.querySelector('#crd-selection-preview').onclick = () => {
    if (isMobileCapture) selectedText=editor.value.trim();
    if (!selectedText) {
      alert('채팅 말풍선을 터치하거나 글귀를 입력해 주세요.');
      return;
    }

    const preview = document.createElement('div');
    preview.style.cssText = `
      position:fixed;inset:0;z-index:2147483647;background:#000a;
      display:flex;justify-content:center;align-items:center;padding:20px;
    `;

    const inner = document.createElement('div');
    inner.style.cssText = `
      background:white;border-radius:16px;padding:12px;width:min(95vw,520px);
      max-height:85vh;overflow:auto;display:flex;flex-direction:column;gap:10px;
    `;

    try {
      const canvas = makeCanvas(selectedText);
      canvas.style.cssText =
        'display:block;width:100%;height:auto;border-radius:8px';

      const close = document.createElement('button');
      close.textContent = '미리보기 닫기';
      close.style.cssText =
        `padding:10px;border:0;border-radius:10px;background:${T.accent};color:${T.on}`;

      close.onclick = () => preview.remove();

      inner.append(canvas, close);
      preview.appendChild(inner);
      document.body.appendChild(preview);
    } catch (err) {
      alert(err.message);
    }
  };

  bar.querySelector('#crd-selection-save').onclick = () => {
    if (isMobileCapture) selectedText=editor.value.trim();
    if (!selectedText) {
      alert('먼저 채팅 말풍선을 터치하거나 글귀를 입력해 주세요.');
      return;
    }

    try {
      const canvas = makeCanvas(selectedText);

      db.captures[day] ||= [];

      db.captures[day].push({
        id: crypto.randomUUID(),
        data: canvas.toDataURL('image/png'),
        text: selectedText,
        createdAt: new Date().toISOString()
      });

      if (!save()) {
        db.captures[day].pop();
        return;
      }

      cleanup();
      render();

      alert('📸 명장면을 일기장에 저장했어요!');
    } catch (err) {
      alert('캡처 저장 실패: ' + err.message);
    }
  };

  bar.querySelector('#crd-selection-cancel').onclick = cleanup;
}


   function renderCaptures(){
     const list=root.querySelector('#capture-list');
     const sheet=root.querySelector('#diary-sheet');
     if(!list||!sheet)return;
     list.innerHTML='';
     const captures=db.captures[day]||[];
     if(selectedCapture>=captures.length)selectedCapture=-1;
     const sw=sheet.clientWidth||350;
     // 기존 버전의 순서형 캡처도 첫 표시 시 자유 배치 좌표로 변환
     let initialY=300;
     captures.forEach((p,i)=>{
       if(!Number.isFinite(Number(p.x)))p.x=7;
       if(!Number.isFinite(Number(p.y)))p.y=initialY;
       const pct=Math.max(30,Math.min(100,Number(p.width)||85));
       initialY+=Math.max(120,sw*pct/100*.5)+18;
       const box=document.createElement('div');
       box.className='capture'+(selectedCapture===i?' selected-capture':'');
       box.dataset.captureIndex=String(i);
       box.style.width=pct+'%';
       const img=document.createElement('img');
       img.src=p.data;
       img.alt='저장한 채팅 캡처';
       box.appendChild(img);
       const position=()=>{
         const maxX=Math.max(0,sheet.clientWidth-box.offsetWidth);
         box.style.left=Math.max(0,Math.min(maxX,Number(p.x)/100*sheet.clientWidth))+'px';
         box.style.top=Math.max(0,Number(p.y)||0)+'px';
       };
       img.onload=()=>{position();ensureCaptureSpace()};
       position();
       // 캡처의 좌표만 이동한다. 드래그 중 DOM/종이 높이/스크롤을 변경하지 않는다.
       let start=null,scrollHost=null,lockedScroll=0,oldOverflow='',oldHeight='';
       const move=e=>{
         if(!start||e.pointerId!==start.id)return;
         e.preventDefault();e.stopPropagation();
         const dx=e.clientX-start.clientX,dy=e.clientY-start.clientY;
         const x=Math.max(0,Math.min(sheet.clientWidth-box.offsetWidth,start.left+dx));
         const y=Math.max(0,start.top+dy);
         box.style.left=x+'px';box.style.top=y+'px';
         p.x=x/Math.max(1,sheet.clientWidth)*100;p.y=y;
         if(scrollHost&&scrollHost.scrollTop!==lockedScroll)scrollHost.scrollTop=lockedScroll;
       };
       const end=e=>{
         if(!start||e.pointerId!==start.id)return;
         e.preventDefault();e.stopPropagation();
         start=null;
         window.removeEventListener('pointermove',move,true);
         window.removeEventListener('pointerup',end,true);
         window.removeEventListener('pointercancel',end,true);
         sheet.classList.remove('crd-dragging');
         if(scrollHost){scrollHost.style.overflow=oldOverflow;scrollHost.scrollTop=lockedScroll;}
         sheet.style.height=oldHeight;
         ensureCaptureSpace();save();
       };
       box.addEventListener('pointerdown',e=>{
         if(e.target.closest('button'))return;
         e.preventDefault();e.stopPropagation();
         // 선택 툴바는 기존 것을 재사용. 위치 변경은 종료 시에만 수행.
         selectedCapture=i;selected=-1;paintStickerToolbar();
         list.querySelectorAll('.capture').forEach((el,j)=>el.classList.toggle('selected-capture',j===i));
         list.querySelectorAll('.capture-toolbar').forEach(el=>el.remove());
         attachCaptureToolbar(box,p,i,captures);
         scrollHost=root.querySelector('.content');
         lockedScroll=scrollHost?.scrollTop||0;
         oldOverflow=scrollHost?.style.overflow||'';
         oldHeight=sheet.style.height;
         // 종이의 크기와 스크롤 컨테이너를 드래그 동안 완전히 고정
         sheet.classList.add('crd-dragging');
         if(scrollHost)scrollHost.style.overflow='hidden';
         start={id:e.pointerId,clientX:e.clientX,clientY:e.clientY,
           left:box.offsetLeft,top:box.offsetTop};
         window.addEventListener('pointermove',move,true);
         window.addEventListener('pointerup',end,true);
         window.addEventListener('pointercancel',end,true);
       });
       list.appendChild(box);
       if(selectedCapture===i)attachCaptureToolbar(box,p,i,captures);
     });
     ensureCaptureSpace();
   }

   function ensureCaptureSpace(){
     const sheet=root.querySelector('#diary-sheet');
     const list=root.querySelector('#capture-list');
     if(!sheet||!list)return;
     let bottom=410;
     list.querySelectorAll('.capture').forEach(el=>{
       bottom=Math.max(bottom,el.offsetTop+el.offsetHeight+25);
     });
     sheet.style.minHeight=Math.ceil(bottom)+'px';
   }

   function attachCaptureToolbar(box,p,i,captures){
     box.querySelector('.capture-toolbar')?.remove();
     const bar=document.createElement('div');
     bar.className='capture-toolbar';
     bar.innerHTML=`<button data-capture-action="shrink" title="축소">−</button>
       <button data-capture-action="grow" title="확대">＋</button>
       <button data-capture-action="delete" title="삭제">×</button>`;
     bar.addEventListener('pointerdown',e=>e.stopPropagation());
     bar.onclick=e=>{
       const act=e.target.closest('button')?.dataset.captureAction;
       if(!act)return;
       e.stopPropagation();
       if(act==='delete'){
         if(!confirm('이 캡처를 삭제할까요?'))return;
         captures.splice(i,1);selectedCapture=-1;
       }else if(act==='grow')p.width=Math.min(100,(Number(p.width)||85)+10);
       else if(act==='shrink')p.width=Math.max(30,(Number(p.width)||85)-10);
       save();renderCaptures();
     };
     box.appendChild(bar);
   }

   function token(){
     const x=document.cookie.split(';').map(s=>s.trim())
       .find(s=>s.startsWith('access_token='));
     if(!x)return '';
     try{return decodeURIComponent(x.slice(13))}catch{return x.slice(13)}
   }
   function records(p){
     return Array.isArray(p?.data)?p.data:
       Array.isArray(p?.data?.items)?p.data.items:
       Array.isArray(p?.data?.histories)?p.data.histories:
       Array.isArray(p?.items)?p.items:
       Array.isArray(p?.histories)?p.histories:[];
   }
   function consumed(r){
     if(r?.isConsumed===false||r?.isConsumed==='false')return 0;
     const hint=[r?.consumedType,r?.type,r?.transactionType,r?.title]
       .filter(Boolean).join(' ');
     const raw=[r?.balance?.total,r?.crackerQuantity,r?.quantity,r?.amount]
       .map(v=>Number(String(v??'').replace(/[^0-9.-]/g,'')))
       .find(v=>Number.isFinite(v)&&v!==0)||0;
     if(!raw)return 0;
     if(r?.isConsumed!==true &&
       !/consum|usage|used|차감|사용|소모/i.test(hint)&&raw>0)return 0;
     return Math.abs(raw);
   }
   // 쪽 단위 수집. width>1이면 동시에 받되, 그사이 새 기록이 생기면(1쪽 맨 앞이 바뀜) 쪽이 밀려 빠질 수 있어 해당 구간을 순서대로 다시 받는다.
   const collectPages=async(getPage,width,take)=>{
     let next=1,last=[],prevFirst='',prevHead;
     const eat=(items,page)=>{
       const first=JSON.stringify(items[0]??null);
       if(page>1&&first===prevFirst)return true; // 같은 페이지가 반복되면 중단
       prevFirst=first;
       return take(items,page)||items.length<20;
     };
     const inOrder=async pages=>{
       prevFirst='';
       for(const p of pages)if(eat(await getPage(p),p))return true;
       return false;
     };
     if(width>1)prevHead=JSON.stringify((await getPage(1))[0]??null); // 첫 구간 비교 기준
     for(;;){
       if(width===1){
         if(eat(await getPage(next),next))return;
         next++;continue;
       }
       const pages=Array.from({length:width},(_,i)=>next+i);
       let got;
       try{got=await Promise.all([1,...pages].map(p=>getPage(p)))}
       catch(err){
         if(err.status!==429)throw err;
         // 요청 제한에 걸리면 잠시 쉬고 직전 구간부터 순차로 내려간다.
         await new Promise(r=>setTimeout(r,2000));
         if(last.length)next=last[0];
         prevFirst='';width=1;continue;
       }
       const head=JSON.stringify(got[0][0]??null);
       const stop=head!==prevHead
         ?await inOrder([...last,...pages])
         :pages.some((p,i)=>eat(got[i+1],p));
       prevHead=head;last=pages;next+=width;
       if(stop){
         const end=JSON.stringify((await getPage(1))[0]??null);
         if(end!==head)await inOrder(last);
         return;
       }
     }
   };
   async function refresh(){
     if(busy)return;busy=true;status='조회 중';
     try{
       const out={},seen=new Set(),start=today();
       // 저장된 기록이 없으면 끝까지 전체 수집, 있으면 마지막 조회일까지만.
       const from=db.usage&&db.usageThrough||null;
       const getPage=async page=>{
         const controller=new AbortController();
         const timer=setTimeout(()=>controller.abort(),12000);
         let response;
         try{
           const headers={Accept:'application/json'};
           if(token())headers.Authorization='Bearer '+token();
           response=await fetch(`${API}?limit=20&type=all&page=${page}`,{
             headers,credentials:'include',cache:'no-store',
             signal:controller.signal
           });
         }finally{clearTimeout(timer)}
         if(!response.ok){const err=Error('HTTP '+response.status);err.status=response.status;throw err}
         return records(await response.json());
       };
       // 전체 수집만 동시에 받는다. 평소 새로고침은 몇 쪽이면 끝나 순차로 충분하다.
       await collectPages(getPage,from?1:DIARY_FETCH_WIDTH,(items,page)=>{
         let oldest='';
         for(const r of items){
           const ts=Date.parse(r.date||r.createdAt||r.created_at||r.updatedAt||'');
           if(!Number.isFinite(ts))continue;
           if(!oldest||dateKey(ts)<oldest)oldest=dateKey(ts);
           const value=consumed(r);
           if(!value)continue;
           const id=r._id||r.id||r.historyId||r.transactionId||
             `${ts}:${value}:${r.title||''}`;
           if(seen.has(id))continue;
           seen.add(id);
           const d=dateKey(ts);
           out[d]=(out[d]||0)+value;
         }
         if(!from&&page%50===0){status=`전체 기록 받는 중 ${page}쪽`;softRender()}
         return Boolean(from&&oldest&&oldest<from); // from 날짜까지 빠짐없이 받음
       });
       const next=mergeUsage(db.usage||{},out,from);
       if(JSON.stringify(next)!==JSON.stringify(db.usage)||db.usageThrough!==start){
         db.usage=next;db.usageThrough=start;save();
       }
       usage=next;apiOk=true;
       status='정상 · '+new Date().toLocaleTimeString('ko-KR');
     }catch(err){
       status='조회 실패 ('+err.message+')';
       console.warn('[Cracker Diary]',err);
     }finally{busy=false;softRender()}
   }

   function quickSave(){
     const input=root.querySelector('#quick-line');
     const v=input?.value.trim();
     if(!v){input?.focus();return}
     const t=today(),cur=(db.notes[t]||'').replace(/\s+$/,'');
     db.notes[t]=cur?cur+'\n'+v:v;
     if(save()){input.value='';input.blur();render()}
   }

   root.addEventListener('pointerdown',e=>{
     if(e.target.closest('.sticker,.sticker-toolbar,.capture,.capture-toolbar'))return;
     if(e.target.closest('#diary-sheet')){
       if(selectedCapture!==-1){selectedCapture=-1;renderCaptures()}
       selected=-1;paintStickerToolbar();
       root.querySelectorAll('#sticker-layer .sticker').forEach(x=>x.classList.remove('chosen'));
     }
   });
   root.querySelector('.mask').onclick=()=>{root.classList.remove('open');syncMenuLauncher()};
   // 메뉴가 열린 동안에만, '나의 크래커' 바로 아래에 항목 삽입.
   // 사이트에 '진짜 크래커' 항목이 있는 경우 그 아래로 이동.
   let menuLauncher=null;
   function findVisibleLabel(label){
     return [...document.querySelectorAll('span,p,div,button,a,[role="menuitem"]')]
       .filter(el=>!root.contains(el)&&!el.hasAttribute('data-crd-menu-launcher')&&
         (el.textContent||'').trim().replace(/\s+/g,' ')===label)
       .filter(el=>{
         const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
         return r.width>12&&r.height>9&&cs.display!=='none'&&cs.visibility!=='hidden'&&
           !!el.getClientRects().length;
       })
       .sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length)[0]||null;
   }
   function menuRow(el){
     if(!el)return null;
     return el.closest('button,a,[role="menuitem"],li')||el.parentElement||el;
   }
   function syncMenuLauncher(){
     if(root.classList.contains('open')){
       if(menuLauncher)menuLauncher.remove();
       return;
     }
     const mine=menuRow(findVisibleLabel('나의 크래커'));
     const real=menuRow(findVisibleLabel('진짜 크래커'));
     // '나의 크래커'가 메뉴에 없으면 버튼을 절대 띄우지 않음.
     if(!mine||!mine.isConnected){
       if(menuLauncher)menuLauncher.remove();
       return;
     }
     const anchor=real&&real!==mine&&real.parentElement===mine.parentElement?real:mine;
     if(!anchor.parentElement){if(menuLauncher)menuLauncher.remove();return;}
     if(!menuLauncher){
       menuLauncher=document.createElement('button');
       menuLauncher.type='button';
       menuLauncher.textContent='📔 다이어리';
       menuLauncher.setAttribute('data-crd-menu-launcher','');
       menuLauncher.style.cssText='display:flex;align-items:center;gap:10px;width:100%;min-height:43px;padding:10px 14px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px;text-align:left;cursor:pointer;flex-shrink:0;';
       menuLauncher.onmouseenter=()=>menuLauncher.style.background='rgba(150,150,150,.1)';
       menuLauncher.onmouseleave=()=>menuLauncher.style.background='transparent';
       menuLauncher.onclick=e=>{
         e.preventDefault();e.stopPropagation();
         root.classList.add('open');render();menuLauncher.remove();
       };
     }
     if(anchor.nextElementSibling!==menuLauncher){
       anchor.insertAdjacentElement('afterend',menuLauncher);
     }
   }
   document.addEventListener('click',()=>setTimeout(syncMenuLauncher,80),true);
   window.addEventListener('resize',syncMenuLauncher);
   window.addEventListener('scroll',syncMenuLauncher,true);
   setInterval(syncMenuLauncher,650);
   syncMenuLauncher();
   fab.onclick=()=>{root.classList.add('open');render()};

   root.addEventListener('click',e=>{
     const b=e.target.closest('button');
     if(!b)return;
     if(b.dataset.tab){tab=b.dataset.tab;diaryOpen=false;render();return}
     if(b.dataset.statMonth){month=b.dataset.statMonth;render();return}
     if(b.dataset.day){day=b.dataset.day;month=day.slice(0,7);diaryOpen=true;selected=-1;selectedCapture=-1;render();content.scrollTop=0;return}
     if(b.dataset.theme){db.theme=b.dataset.theme;save();render();return}
     const action=b.dataset.act;
     if(!action)return;

     if(action==='close'){root.classList.remove('open');syncMenuLauncher();return}
     if(action==='back'){diaryOpen=false;render();return}
     if(action==='prev-day'||action==='next-day'){
       day=dateMove(day,action==='prev-day'?-1:1);
       month=day.slice(0,7);selected=-1;selectedCapture=-1;render();return;
     }
     if(action==='prev-month'||action==='next-month'){
       const [y,m]=month.split('-').map(Number);
       const d=new Date(y,m-1+(action==='prev-month'?-1:1),1);
       month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
       render();return;
     }
     if(action==='toggle-months'){showAllMonths=!showAllMonths;render();return}
     if(action==='quick-save'){quickSave();return}
     if(action==='quick-capture'){
       day=today();month=day.slice(0,7);tab='calendar';diaryOpen=true;
       selected=-1;selectedCapture=-1;render();startCapture();return;
     }
     if(action==='capture'){startCapture();return}
     if(action==='add-free-text'){
       const input=root.querySelector('#free-text-input');
       const value=input?.value.trim();
       if(!value){alert('붙일 글자를 먼저 입력해 줘.');return}
       db.stickers[day] ||= [];
       db.stickers[day].push({type:'text',value,x:50,y:35,size:22,rot:0,
         font:root.querySelector('#free-text-font')?.value||'basic',
         color:root.querySelector('#free-text-color')?.value||'#654552'});
       selected=db.stickers[day].length-1;
       save();paintStickers();input.value='';return;
     }
     if(action==='edit-free-text'){
       const s=(db.stickers[day]||[])[selected];
       if(!s||s.type!=='text')return;
       const value=prompt('글자를 수정해 줘',s.value);
       if(value===null)return;
       if(!value.trim()){alert('빈 글자는 저장할 수 없어.');return}
       s.value=value;save();paintStickers();return;
     }
     if(['grow','shrink','rotate','delete-sticker'].includes(action)){
       const arr=db.stickers[day]||[],s=arr[selected];
       if(!s)return;
       if(action==='grow')s.size=Math.min(s.type==='text'?72:180,(s.size||(s.type==='text'?22:52))+(s.type==='text'?3:10));
       if(action==='shrink')s.size=Math.max(s.type==='text'?10:20,(s.size||(s.type==='text'?22:52))-(s.type==='text'?3:10));
       if(action==='rotate')s.rot=((s.rot||0)+15)%360;
       if(action==='delete-sticker'){arr.splice(selected,1);selected=-1}
       save();paintStickers();return;
     }
     if(action==='refresh'){refresh();return}
     if(action==='backup'){
       download('cracker-diary-'+today()+'.json',
         JSON.stringify({version:'2.4',diary:db},null,2),'application/json');
       return;
     }
     if(action==='csv'){
       const dates=new Set([...Object.keys(usage),...Object.keys(db.manual)]);
       const rows=[['날짜','크래커 사용량'],
         ...[...dates].sort().map(d=>[d,amount(d)])];
       download('cracker-usage-'+today()+'.csv',
         '﻿'+rows.map(x=>x.join(',')).join('\r\n'),'text/csv');
       return;
     }
     if(action==='restore'){root.querySelector('#restore-file').click();return}
     if(action==='adjust'){
       const d=root.querySelector('#adjust-day').value;
       const v=Number(root.querySelector('#adjust-value').value);
       if(d&&Number.isFinite(v)){db.manual[d]=v;save();render()}
     }
   });

   root.addEventListener('keydown',e=>{
     if(e.target.id==='quick-line'&&e.key==='Enter'&&!e.isComposing){e.preventDefault();quickSave()}
   });

   root.addEventListener('change',async e=>{
     if(e.target.id==='photo-upload'){
       await uploadPhotos(e.target.files);e.target.value='';
     }
     if(e.target.id==='paper-color'){
       db.paperColor=e.target.value;save();applyPaper();
     }
     if(e.target.id==='diary-font'){
       db.diaryFont=e.target.value;save();applyDiaryFont();
     }
     if(e.target.id==='paper-kind'){
       db.paper=e.target.value;save();applyPaper();
     }
     if(e.target.id==='restore-file'){
       const file=e.target.files?.[0];if(!file)return;
       try{
         const x=JSON.parse(await file.text());
         if(!x.diary)throw Error('백업 형식이 아니에요.');
         if(!confirm('현재 데이터를 백업 내용으로 교체할까요?'))return;
         db={...defaults,...x.diary};
         if(!THEMES[db.theme])db.theme=THEME_ALIAS[db.theme]||'pink';
         usage=db.usage||{};save();render();
       }catch(err){alert('복원 실패: '+err.message)}
     }
   });

   root.addEventListener('input',e=>{
     if(e.target.id==='diary-writing'){
       const v=e.target.value;
       if(v.trim())db.notes[day]=v;else delete db.notes[day];
       const st=root.querySelector('#save-state');
       if(st)st.textContent='저장 중…';
       clearTimeout(noteTimer);
       noteTimer=setTimeout(()=>{
         const ok=save();
         const s=root.querySelector('#save-state');
         if(s)s.textContent=ok?'저장됨 ✓':'저장 실패';
       },500);
     }
     if(e.target.id==='goal-daily'){
       db.goalDaily=Math.max(0,Number(e.target.value)||0);save();
     }
     if(e.target.id==='goal-monthly'){
       db.goalMonthly=Math.max(0,Number(e.target.value)||0);save();
     }
   });

   applyTheme();render();refresh();
   setInterval(()=>{if(!document.hidden)refresh()},60000);
   document.addEventListener('visibilitychange',()=>{
     if(!document.hidden)refresh();
   });
 })();
