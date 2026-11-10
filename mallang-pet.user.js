// ==UserScript==
// @name         크랙 말랑펫
// @namespace    https://github.com/mywishluv/wishlite
// @version      3.2.0
// @description  내 정실을 닮은 픽셀 펫. 크랙 대화(내 말+정실 답장)에 반응하고, 화면 위를 걸어다니고, 나만의 방에서 함께 살아요.
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
// v3.2.0 - 32×32 도트 지도 조립·6종 몸·24종 의상·겹치는 흉터·2프레임 캐시·데이터 이전·계절 가구 기본 제공
// v3.1.0 - 디자인 정리(도트 크기 통일·레트로 UI·탭 5개), 정실 답장에도 반응, 크랙 화면 걷기, 오늘의 날씨·출석·기념 가구 선물·명대사 액자, 가구 추가
// v3.0.0 - 미니룸·밥주기·꾸미기·여러 캐릭터·사진관·백업
// v2.0.0 - 픽셀 펫, 크랙에서 내가 보낸 말에 반응
// v1.0.0 - 첫 버전

(function () {
  'use strict';
  if (document.getElementById('mallangpet-host')) return;

  /* =========================================================
   * 설정
   * ========================================================= */
  const CONFIG = {
    hatchMinutes: 10,     // 알이 깨어나는 시간(분)
    chatGrowHours: 0.25,  // 크랙에서 말 1번 = 이만큼 더 자람(시간)
    walkSpeed: 34,        // 크랙 화면에서 걷는 속도(px/초)
  };

  /* =========================================================
   * 크랙 화면 찾기 — 크랙이 바뀌면 여기만 고치면 돼요
   * ========================================================= */
  const SEL = {
    message: '[data-message-group-id]',
    messageId: 'data-message-group-id',
    text: '.wrtn-markdown',
    botOnly: 'img[alt="model"]',
    input: 'textarea,[contenteditable="true"]',
    isMine(msg, textEl) {
      const box = textEl.parentElement;
      if (!box || msg.querySelector(this.botOnly)) return false;
      if (box.classList.contains('rounded-none')) return false;
      return box.classList.contains('rounded-lg');
    },
  };

  /* ===================== 공용 ===================== */
  const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, Number(n) || 0));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const copy = (o) => JSON.parse(JSON.stringify(o));
  const day = (d = new Date()) => d.toLocaleDateString('sv-SE');
  const uid = () => Math.random().toString(36).slice(2, 10);
  const isColor = (s) => /^#[0-9a-f]{6}$/i.test(s);
  const color = (s, f = '#ffc3cb') => (isColor(s) ? s : f);
  const text = (s, f = '', n = 180) => (typeof s === 'string' ? s.slice(0, n) : f);
  const hasBatchim = (s) => { const c = s.charCodeAt(s.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
  const josa = (s, a, b) => s + (hasBatchim(s) ? a : b);

  /* =========================================================
   * 픽셀 펫 (32 x 32 도트)
   * ========================================================= */
  // v3.2: 모든 부품은 역할 문자를 담은 도트 지도입니다. 중심선은 x=15.5.
  const N=32, INK='#2e2228', K='#4a3b44';
  const SHAPES={
    round:{name:'동글',x:3,y:9,rows:[[9,16],[6,19],[4,21],[3,22],[2,23],[1,24],[1,24],[0,25],[0,25],[0,25],[0,25],[0,25],[0,25],[0,25],[0,25],[0,25],[1,24],[1,24],[2,23],[3,22],[5,20],[8,17]],eyeX:10,eyeY:16,mouthY:20,earX:7,earY:10,outfitY:25,headTop:9},
    mochi:{name:'말랑',x:2,y:13,rows:[[8,19],[5,22],[3,24],[2,25],[1,26],[0,27],[0,27],[0,27],[0,27],[0,27],[0,27],[0,27],[1,26],[1,26],[2,25],[3,24],[5,22],[7,20]],eyeX:10,eyeY:17,mouthY:21,earX:6,earY:14,outfitY:26,headTop:13},
    tall:{name:'길쭉',x:6,y:7,rows:[[7,12],[4,15],[3,16],[2,17],[1,18],[1,18],[0,19],[0,19],[0,19],[0,19],[0,19],[0,19],[0,19],[0,19],[0,19],[0,19],[0,19],[0,19],[0,19],[1,18],[1,18],[2,17],[3,16],[5,14]],eyeX:11,eyeY:15,mouthY:19,earX:9,earY:8,outfitY:24,headTop:7},
    drop:{name:'물방울',x:4,y:7,rows:[[11,12],[10,13],[9,14],[8,15],[7,16],[6,17],[5,18],[4,19],[3,20],[2,21],[1,22],[0,23],[0,23],[0,23],[0,23],[0,23],[0,23],[0,23],[1,22],[1,22],[2,21],[3,20],[5,18],[8,15]],eyeX:10,eyeY:17,mouthY:21,earX:13,earY:13,outfitY:26,headTop:7},
    bean:{name:'콩',x:3,y:11,rows:[[6,12],[3,16],[2,19],[1,21],[0,23],[0,24],[0,24],[0,25],[0,25],[0,25],[0,25],[0,25],[0,25],[0,25],[1,24],[2,23],[3,22],[4,21],[6,19],[9,16]],eyeX:10,eyeY:17,mouthY:20,earX:7,earY:12,outfitY:25,headTop:11},
    sd:{name:'SD 꼬마형',x:4,y:4,rows:[[7,16],[4,19],[3,20],[2,21],[1,22],[1,22],[0,23],[0,23],[0,23],[0,23],[0,23],[0,23],[1,22],[1,22],[2,21],[4,19]],eyeX:10,eyeY:11,mouthY:15,earX:7,earY:5,outfitY:20,headTop:4,
      torso:{x:10,y:20,rows:[[1,10],[0,11],[0,11],[0,11],[0,11],[0,11],[1,10]]}}
  };
  const TOPS={none:'없음',bear:'곰',cat:'고양이',bunny:'토끼',fox:'여우',dog:'강아지',antenna:'더듬이',sprout:'새싹'};
  const FRONTS={none:'없음',straight:'일자',part:'가르마',short:'짧은',curl:'곱슬',side:'옆으로',messy:'삐죽',swoop:'한쪽 눈 덮기'};
  const BACKS={none:'없음',bob:'단발',long:'긴 머리',wave:'웨이브',pony:'포니테일',twin:'양갈래'};
  const EYES={dot:{name:'점',rows:['KK','KK']},round:{name:'동글',rows:['.KK.','KEwK','KEEK','.KK.']},big:{name:'왕눈',rows:['.KKK.','KEEwK','KEEEK','KEEEK','.KKK.']},shine:{name:'반짝',rows:['.KK.','KwKK','KKKK','KEEK','.KK.']},sleepy:{name:'졸린',rows:['KKKK','KEEK','.KK.']},sharp:{name:'째릿',rows:['KKKKK','.KEEw','..KK.'],mirror:true},smile:{name:'웃는',rows:['.KK.','K..K']},droop:{name:'처진눈',rows:['K...','.KKK','.KEw','..KK'],mirror:true}};
  const EXPR_EYES={happy:['.KK.','K..K'],sleep:['KKKK'],love:['LL.LL','LLLLL','.LLL.','..L..'],sick:['K..K','.KK.','K..K']};
  const NOSES={none:{name:'없음',rows:[]},dot:{name:'점코',rows:['K']},pink:{name:'분홍코',rows:['pp','pp']},animal:{name:'동물코',rows:['KKK','.K.']}};
  const MOUTHS={small:{name:'미소',rows:['K..K','.KK.']},smile:{name:'활짝',rows:['KKKKKK','.KMMK.','..KK..']},cat:{name:'고양이입',rows:['K.KK.K','.K..K.']},o:{name:'오',rows:['.KK.','KMMK','.KK.']},tongue:{name:'메롱',rows:['KKKK','.MM.','.MM.']},line:{name:'무표정',rows:['KKKK']}};
  const CHEEKS={none:{name:'없음',rows:[]},blush:{name:'발그레',rows:['ppp']},round:{name:'동글볼',rows:['.pp.','pppp','.pp.']},line:{name:'빗금',rows:['p.p.p','p.p.p']}};
  const OUTFITS={none:'없음',shirt:'티셔츠',dress:'원피스',sailor:'세일러',tie:'셔츠+넥타이',suit:'정장',knit:'니트',cardigan:'가디건',hoodie:'후드티',blazer:'교복 블레이저',gakuran:'학란',pajama:'잠옷',apron:'앞치마',tactical:'전술조끼',military:'군복',doctor:'의사 가운',police:'경찰',butler:'집사',maid:'메이드',bartender:'바텐더 조끼',knight:'기사 갑옷',wizard:'마법사 로브',prince:'왕자 망토',priest:'사제복',hanbok:'한복·도포'};
  const WINGS={none:'없음',angel:'천사',bat:'악마',fairy:'요정'},TAILS={none:'없음',cat:'고양이',fox:'여우',devil:'악마',bunny:'토끼'},MARKS={none:'없음',mole:'눈물점',freckles:'주근깨'};
  const SCARS={eye:{name:'눈 위 세로',rows:['.r.','RrR','.r.','.r.','RrR','.r.','.r.']},cross:{name:'볼 X자',rows:['r...r','.r.r.','..r..','.r.r.','r...r']},nose:{name:'콧등 가로',rows:['R.R.R','rrrrr']},mouth:{name:'입가',rows:['r..','rR.','r..']},forehead:{name:'이마',rows:['r.r','RrR','r.r']},neck:{name:'목',rows:['rrrrrr','.R.R..']}};
  const SCAR_COLORS={pink:'#ca8b98',brown:'#855549'};
  const EAR_MAPS={cat:['o......','oo.....','obo....','obpo...','obppo..','obbppo.','obbbbbo'],bear:['.oooo.','olbbbo','obppbo','obppbo','.obbo.'],bunny:['.oo.','olbo','obpo','obpo','obpo','obpo','obpo','obbo','obbo','obbo'],fox:['o.......','oo......','olo.....','obpo....','obbpo...','obbbpo..','obbbbpo.','obbbbbbo'],dog:['.oooo.','olbbbo','obppbo','obppbo','obbbbo','obbbso','obssso','.OOOO.'],antenna:['..oo..','..ll..','...o..','....o.','....o.'],sprout:['.ll......','.bbl..ll.','..bbobbl.','....o....','....o....']};
  const FRONT_MAPS={
    straight:['..oooooooooooooooo..','.ollllllllllllllllbO','obbbbbbbbbbbbbbbbbbs','obbbbbbbbbbbbbbbbbbs','.ObbbObbbObbbObbbbO.','..OOO.OOO.OOO.OOOO..'],
    part:['..oooooooooooooooo..','.olllllll..lllllllbO','obbbbbbbO..obbbbbbbs','obbbbbO......obbbbbs','.ObbbO........ObbbO.','..OOO..........OOO..'],
    short:['..oooooooooooooooo..','.ollllllllllllllllbO','obbbbbbbbbbbbbbbbbbs','.ObbObbbObbbObbbObO.','..OO.OOO.OOO.OOO.O..'],
    curl:['..oooo..oooo..oooo..','.olllbOolllbOolllbO.','obbbbbbbbbbbbbbbbbbs','obbbbbbbbbbbbbbbbbbs','.ObbObbObbObbObbObO.','..OO.OO.OO.OO.OO.O..'],
    side:['..oooooooooooooooo..','.ollllllllllllllllbO','obbbbbbbbbbbbbbbbbbs','.ObbbbbbbbbbbbbbbbsO','..ObbbbbbbbbbbbbbsO.','...ObbbbbbbbbbbbsO..','....ObbbbbbbbbbO....','.....ObbbbbbbO......'],
    messy:['....oo.....oo.......','..oolbO..oolbo......','.olllbbOOllllbbOoo..','obbbbbbbbbbbbbbbbsO.','obbbObbbbbObbbbbbbO.','.OOO.ObbbO.ObbbObbO.','......OOO...OOO.OO..'],
    swoop:['..oooooooooooooooo..','.ollllllllllllllllbO','obbbbbbbbbbbbbbbbbbs','obbbbbbbbbbbbbbbbsO.','obbbbbbbbbbbbbbsO...','obbbbbbbbbbbbsO.....','obbbbbbbbbbsO.......','.ObbbbbbbO..........','..ObbbbO............','...OOO..............']
  };
  const BACK_MAPS={bob:['oob','olb','obb','obs','obs','obs','obs','obs','obs','obs','.OO'],long:['oob','olb','obb','obb','obb','obb','obb','obs','obs','obs','obs','obs','obs','obs','obs','obs','obs','obs','obs','obs','obs','.OO'],wave:['.oo','olb','obb','obs','obs','.Ob','..O','oob','olb','obb','obs','.Ob','..O','oob','obb','obs','.OO'],pony:['.oo.','olbo','obbo','.ObO','..ob','..ob','..ob','.obb','obbs','obbs','obbs','.ObO','..O.'],twin:['.oo.','olbo','obbo','obbs','obbs','obbs','obbs','obbs','obbs','obbs','.ObO','..O.']};
  const CLOTH_MAPS={
    shirt:['ccWWWcc','.ccWcc.','..ccc..'],dress:['ccWWWcc','.ccWcc.','ccccccc','WcWcWcW'],sailor:['WWcccWW','.WWcWW.','..ptp..','...T...'],tie:['cWWtWWc','.cWtWc.','..CTC..','...T...','...T...'],suit:['CWWtWWC','.CWtWC.','..CTC..','...T...','...T...'],knit:['WcWcWcW','cWcWcWc','WcWcWcW'],cardigan:['ClWWWlC','ClcWclC','ClcKclC','ClcKclC'],hoodie:['WcWWWcW','.WcWcW.','..WcW..','.CCCCC.','.CcccC.'],blazer:['CWWtWWC','.CWtWC.','cCCTCcc','cWcTcWc'],gakuran:['CCWWWCC','cccKccc','cccKccc','cccKccc','CCCWCCC'],pajama:['WWcccWW','cccKccc','ccwKccw','ccwKccw'],apron:['cWcccWc','cWWWWWc','ccWWWcc','WWWWWWW'],tactical:['CCccCCC','cWcCcWc','CCCcCCC','cCcCcCc','CCCCCCC'],military:['scclccs','cscKcsc','lcscscl','cccKccc','CscscsC'],doctor:['WWWtWWW','WWcTcWW','WWcKcWW','WccKccW','WWcKcWW'],police:['WWctcWW','ccYtccc','cWcKcWc','cccKccc'],butler:['CWWtWWC','CCptpCC','CCCWCCC','CCcKcCC'],maid:['cWcccWc','WcWWWcW','.WWWWW.','WWcWcWW'],bartender:['CWWtWWC','.CCWCC.','cCcKcCc','CCcKcCC'],knight:['oWWWWW O','WWcWcWW','cCWWWcC','CCcWcCC','CCCWCCC'].map(s=>s.replace(/ /g,'')),wizard:['cWWtWWc','.cWtWc.','ccctccc','cwctcwc','cccTccc'],prince:['RWWYWWR','RRctcRR','RRcTcRR','RRcccRR','Rcccc cR'].map(s=>s.replace(/ /g,'')),priest:['CCWWWCC','cccWccc','ccWWWcc','cccWccc','cccWccc'],hanbok:['ccWWccc','cccWWcc','ccccWWc','cTTTTTc','cccTccc']
  };
  const WING_MAPS={angel:['o.....','olo...','oblo..','obblO.','obbblo','ObbssO','.OOOO.'],bat:['o.....','obo...','obbo..','obbooo','obbbbs','ObOssO','.O.OO.'],fairy:['.oooo.','olllbo','obbbbo','.ObbO.','olllbo','obssso','.OOOO.']};
  const TAIL_MAPS={cat:['...oo.','..olbo','...obO','...ob.','...ob.','.oobb.','obbsO.','.OOO..'],fox:['...oo.','..owwo','.owwbo','olbbbo','obbbso','obbsO.','.OsO..','..O...'],devil:['..o...','.obo..','obbbO.','..o...','..o...','..o...','ooO...'],bunny:['.ooo.','olbbo','obbso','.OOO.']};
  const ACC={
    ribbon:{name:'리본',c:'#FF6F91',rows:['oo...oo','olboobo','obbsbbs','.OsssO.','oo.O.oo']},flower:{name:'꽃',c:'#FFB3C7',rows:['..ooo..','..lbb..','olbYbbo','.ObbbO.','..OOO..']},crown:{name:'왕관',c:'#FFD54A',rows:['o..o..o','bl.bl.b','bbbbbbb','sssssss','OOOOOOO']},hat:{name:'모자',c:'#4A4A5A',rows:['..ooooo..','..lbbbb..','..bbbbb..','..ppppp..','olbbbbbbO']},glasses:{name:'안경',c:'#574557',rows:['ooooo...ooooo','o...ooooo...o','o...o...o...o','OOOOO...OOOOO']},heart:{name:'하트',c:'#FF4D7A',rows:['oo.oo','bl.bl','bbbbb','.sss.','..O..']},star:{name:'별',c:'#FFD54A',rows:['..o..','..l..','olbbo','.bss.','O...O']},bow:{name:'나비넥타이',c:'#D94B72',rows:['bb.bb','bbsbb','bb.bb']},bandage:{name:'반창고',c:'#F3D3A3',rows:['.ooooo.','olWWWbo','.OOOOO.']},bandagewrap:{name:'붕대',c:'#F3EEE8',rows:['WWWWWWWWW','sssssssss','WWWWWWWWW']},eyepatch:{name:'안대',c:'#554b5b',rows:['oo.....o','obbo..o.','obbbOo..','.OOO....']},scarf:{name:'목도리',c:'#d37992',rows:['bbbbbbbbb','sssssssss','..bb.....','..bb.....','..ss.....']},choker:{name:'초커',c:'#554b5b',rows:['bbbbbYbbbbb','sssssssssss']},dogtag:{name:'인식표 목걸이',c:'#b7b8c2',rows:['o.......o','.o.....o.','..o...o..','...ooo...','...bbb...','...bKb...','...sss...']},headphones:{name:'헤드폰',c:'#9c7be0',rows:['..ooooooo..','.obbbbbbbO.','ob.......bO','ob.......bO','bb.......bb','bb.......bb']},mask:{name:'마스크',c:'#e5e2e8',rows:['oWWWWWWWo','.WsssssW.','..OOOOO..']},lollipop:{name:'막대사탕',c:'#e980a6',rows:['.ooo.','olpbo','obpbo','.OOO.','..W..','..W..','..W..']},sword:{name:'검',c:'#9aafc6',rows:['..w..','..wb.','..wb.','..wb.','..wb.','YWWWY','..t..','..T..']},cup:{name:'컵',c:'#b7ddd5',rows:['ooooo..','obbbOoo','obbbO.o','ObssOOO','.OOO...']},flowerhand:{name:'손에 쥔 꽃',c:'#e9a8ba',rows:['.b.b.','bbYbb','.bbb.','..g..','.gg..','..g..']}};
  const BODY_COLORS=['#FFC8B4','#FFB3C7','#FFEBA8','#BDEBD6','#C4DEFF','#E2D2FF','#E3C3A8','#F4F4F4','#6E6E7A','#4A4A58'],HAIR_COLORS=['#3A2E2E','#8A5A3C','#F2D16B','#E8E8EE','#FF8FB1','#7DA7F0','#9C7BE0','#D9534F','#4A4A58'],EYE_COLORS=['#3A2E2E','#7B4A2A','#3D7BE0','#3FA36B','#D64545','#8B5CD6','#E0A800'],CLOTH_COLORS=['#718FAF','#2F3A4F','#F4F4F4','#FF8FB1','#D9534F','#6CC46A','#9C7BE0','#3A2E2E'];
  const DEFAULT_LOOK={shape:'round',top:'bear',eyes:'round',nose:'none',mouth:'small',cheeks:'blush',body:'#FFC8B4',hair:null,eye:'#3A2E2E'};
  const DEFAULT_EXTRA={front:'none',back:'none',outfit:'none',wings:'none',tail:'none',mark:'none',cloth:'#718FAF',eye2:'#57443C',hetero:false,accessories:[],scars:[],pixelVersion:32,pixels:Array(1024).fill(null)};
  const hexToRgb=h=>{h=String(h||'#000000').replace('#','');if(h.length===3)h=[...h].map(c=>c+c).join('');const n=parseInt(h,16)||0;return[n>>16&255,n>>8&255,n&255];};
  const toHex=(r,g,b)=>'#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
  const mix=(a,b,f)=>{const A=hexToRgb(a),B=hexToRgb(b);return toHex(...A.map((v,i)=>v+(B[i]-v)*f));};
  const shade=(h,f)=>mix(h,'#000000',1-f),tint=(h,f)=>mix(h,'#ffffff',f),lineOf=h=>mix(shade(h,.55),'#3a2040',.25);
  function palette(c,cloth=c,eye=INK){return{l:tint(c,.35),b:c,s:mix(shade(c,.82),'#6a4c93',.12),o:lineOf(c),O:mix(shade(c,.38),'#2a1830',.3),K:INK,E:eye,w:'#ffffff',W:'#fff6ef',p:'#ff9db0',M:'#d6455d',L:'#ff4d7a',r:'#ca8b98',R:'#985968',c:cloth,C:mix(shade(cloth,.82),'#6a4c93',.12),t:'#ba6781',T:'#884b69',Y:'#f1c65d',g:'#6b9c70',B:'#7ec8ff'};}
  function Canvas(w=N,h=N){const g=Array.from({length:h},()=>Array(w).fill(null));return{g,w,h,set(x,y,c){x=Math.round(x);y=Math.round(y);if(c&&x>=0&&x<w&&y>=0&&y<h)g[y][x]=c;}};}
  function stamp(cv,rows,left,top,pal,clip){rows.forEach((row,dy)=>[...row].forEach((ch,dx)=>{if(ch==='.'||ch===' ')return;const x=Math.round(left+dx),y=Math.round(top+dy);if(!clip||clip(x,y))cv.set(x,y,pal[ch]);}));}
  const flipRows=rows=>rows.map(row=>[...row.padEnd(Math.max(...rows.map(r=>r.length)),'.')].reverse().join(''));
  function stampPair(cv,rows,cL,top,pal,clip,mirror=true,palR){if(!rows.length)return;const w=Math.max(...rows.map(r=>r.length)),left=Math.round(cL-w/2);stamp(cv,rows,left,top,pal,clip);stamp(cv,mirror?flipRows(rows):rows,31-left-w+1,top,palR||pal,clip);}
  function svgRects(cv){let s='';for(let y=0;y<cv.h;y++)for(let x=0;x<cv.w;){const c=cv.g[y][x];if(!c){x++;continue;}let w=1;while(x+w<cv.w&&cv.g[y][x+w]===c)w++;s+=`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;x+=w;}return s;}
  const toSVG=(cv,extra='')=>`<svg viewBox="0 0 ${cv.w} ${cv.h}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"${extra}>${svgRects(cv)}</svg>`;
  function geom(p){const S=SHAPES[p.look?.shape]||SHAPES.round;const has=(x,y)=>{const r=S.rows[y-S.y];return!!r&&x>=S.x+r[0]&&x<=S.x+r[1];};const torso=S.torso;const mask=(x,y)=>has(x,y)||(torso&&y>=torso.y&&y<torso.y+torso.rows.length&&x>=torso.x+torso.rows[y-torso.y][0]&&x<=torso.x+torso.rows[y-torso.y][1]);return{...S,top:S.headTop,cL:S.eyeX,eyeMid:S.eyeY,inBody:mask,interior:(x,y)=>mask(x,y)&&mask(x-1,y)&&mask(x+1,y)&&mask(x,y-1)&&mask(x,y+1),ox:16-S.earX};}
  function silhouette(cv,part,pal){const mask=(x,y)=>{const r=part.rows[y-part.y];return!!r&&x>=part.x+r[0]&&x<=part.x+r[1];};part.rows.forEach(([a,b],dy)=>{const y=part.y+dy;for(let x=part.x+a;x<=part.x+b;x++){let ch='b';if(!mask(x+1,y)||!mask(x,y+1))ch='O';else if(!mask(x-1,y)||!mask(x,y-1))ch='o';else if(!mask(x+2,y)||!mask(x,y+2))ch='s';else if(!mask(x-2,y)||!mask(x,y-2))ch='l';cv.set(x,y,pal[ch]);}});}
  function defaultAccPos(type,p){const G=geom(p),def=ACC[type],w=Math.max(...def.rows.map(r=>r.length));if(['sword','flowerhand','cup','lollipop'].includes(type))return{x:G.name==='SD 꼬마형'?23:26,y:G.outfitY-1};if(['bow','scarf','choker','dogtag'].includes(type))return{x:Math.round(15.5-w/2),y:G.outfitY};if(['glasses','eyepatch','mask'].includes(type))return{x:type==='glasses'?9:G.eyeX-2,y:type==='mask'?G.mouthY:G.eyeY-2};return{x:type==='headphones'?10:20,y:Math.max(0,G.headTop-4)};}
  function scarPos(G,s){const right=s.side==='right',cx=right?31-G.eyeX:G.eyeX;switch(s.type){case'eye':return{x:cx-1,y:G.eyeY-4};case'cross':return{x:right?24:3,y:G.eyeY+2};case'nose':return{x:13,y:G.mouthY-3};case'mouth':return{x:right?22:7,y:G.mouthY};case'forehead':return{x:right?18:11,y:G.headTop+4};case'neck':return{x:right?17:9,y:G.outfitY-1};default:return{x:2,y:2};}}
  const DRAW_CACHE=new Map(),CANVAS_CACHE=new Map();
  function cachePut(cache,key,value){if(cache.size>=360)cache.delete(cache.keys().next().value);cache.set(key,value);return value;}
  function petCanvas(p,expr='normal',frame=0,motion='idle'){
    const L={...DEFAULT_LOOK,...p.look},E={...DEFAULT_EXTRA,...p.extra},key=JSON.stringify([L,E,p.stage,expr,frame,motion]);if(CANVAS_CACHE.has(key))return CANVAS_CACHE.get(key);
    const cv=Canvas(),G=geom({...p,look:L}),body=expr==='sick'?mix(L.body,'#c8d7b8',.22):L.body,pal=palette(body,E.cloth,L.eye),hairPal=palette(color(L.hair,body)),clothPal=palette(E.cloth,E.cloth,L.eye);
    if(p.stage==='egg'){silhouette(cv,{x:6,y:6,rows:[[8,11],[6,13],[5,14],[4,15],[3,16],[2,17],[2,17],[1,18],[1,18],[0,19],[0,19],[0,19],[0,19],[0,19],[1,18],[1,18],[2,17],[3,16],[5,14],[8,11]]},palette('#fff3df'));stamp(cv,['bb','bb'],12,12,pal);stamp(cv,['.b.','bbb','.b.'],20,18,pal);cv.set(12,9,'#ffffff');return cachePut(CANVAS_CACHE,key,cv);}
    if(E.wings!=='none'){const rows=WING_MAPS[E.wings]||WING_MAPS.angel,wp=palette(E.wings==='angel'?'#fff5e7':E.wings==='bat'?'#746282':'#b7dedb');stampPair(cv,rows,3,G.eyeY+1,wp,null,true);}
    if(E.tail!=='none')stamp(cv,TAIL_MAPS[E.tail]||TAIL_MAPS.cat,25,G.outfitY-6,hairPal);
    if(E.back!=='none'){const rows=BACK_MAPS[E.back]||BACK_MAPS.bob;stampPair(cv,rows,4,G.headTop+3,hairPal,null,true);}
    silhouette(cv,G,pal);if(G.torso){silhouette(cv,G.torso,pal);stampPair(cv,['olbo','obbo','obsO','.OO.'],7,22,pal,null,true);stampPair(cv,['obbo','obso','OOOO'],13,27,pal,null,true);}
    // 두 발 지도를 번갈아 쓰고, 숨쉬기는 완성된 도트를 한 줄 옮겨요.
    const foot=motion==='walk'?(frame?['obbO','OOO.']:['olbo','.OOO']):['obbo','OOOO'];stamp(cv,foot,G.torso?11:7,29,pal);stamp(cv,flipRows(motion==='walk'?frame?['olbo','.OOO']:['obbO','OOO.']:foot),G.torso?17:21,29,pal);
    cv.set(G.x+G.rows[3][0]+2,G.y+2,'#fff9f3');cv.set(G.x+G.rows[3][0]+3,G.y+2,'#fff9f3');cv.set(G.x+G.rows[3][0]+2,G.y+3,'#fff9f3');
    if(E.outfit!=='none'){for(let y=G.outfitY;y<31;y++)for(let x=0;x<32;x++)if(G.inBody(x,y)){const edge=!G.inBody(x+1,y)||!G.inBody(x,y+1);cv.set(x,y,edge?clothPal.O:!G.inBody(x-1,y)?clothPal.o:!G.inBody(x+2,y)||!G.inBody(x,y+2)?clothPal.s:x<16?clothPal.l:clothPal.b);}const rows=CLOTH_MAPS[E.outfit]||CLOTH_MAPS.shirt;stamp(cv,rows,Math.floor(16-Math.max(...rows.map(r=>r.length))/2),G.outfitY,{...clothPal,c:clothPal.b,C:clothPal.s,R:mix(E.cloth,'#b15676',.4)},G.inBody);}
    if(E.front!=='none'){const rows=FRONT_MAPS[E.front]||FRONT_MAPS.straight;stamp(cv,rows,6,G.headTop,hairPal,(x,y)=>G.inBody(x,y)&&y<G.eyeY-1+(E.front==='swoop'&&x<13?4:0));}
    // 귀는 앞머리 다음에 그려, 최소 두 칸이 머리 위로 드러나게 해요.
    if(L.top!=='none'){const rows=EAR_MAPS[L.top]||EAR_MAPS.cat,earTop=Math.max(0,Math.min(G.earY-rows.length+2,G.headTop-2));if(L.top==='sprout')stamp(cv,rows,12,earTop,{...hairPal,b:'#7eb26d',l:'#b7dca2',o:'#638955'});else stampPair(cv,rows,G.earX,earTop,hairPal,null,true);}
    let er=EXPR_EYES[expr]||(EYES[L.eyes]||EYES.round).rows;const ey=G.eyeY-Math.floor(er.length/2);stampPair(cv,er,G.eyeX,ey,pal,(x,y)=>!(E.front==='swoop'&&x<16&&FRONT_MAPS.swoop[y-G.headTop]?.[x-6]&&FRONT_MAPS.swoop[y-G.headTop][x-6]!=='.'),!!EXPR_EYES[expr]||!!EYES[L.eyes]?.mirror,E.hetero?{...pal,E:E.eye2}:pal);
    const cheeks=expr==='shy'?CHEEKS.round:CHEEKS[L.cheeks]||CHEEKS.none;stampPair(cv,cheeks.rows,G.eyeX-1,G.mouthY-1,{...pal,p:expr==='shy'?'#ef7099':pal.p},G.inBody,true);
    const nose=NOSES[L.nose]||NOSES.none;stamp(cv,nose.rows,Math.floor(16-(nose.rows[0]?.length||0)/2),G.mouthY-2,pal,G.inBody);
    let mr=(MOUTHS[L.mouth]||MOUTHS.small).rows;if(expr==='happy'||expr==='love')mr=MOUTHS.smile.rows;else if(expr==='shy')mr=['.K.K.','K.K.K'];else if(expr==='angry')mr=['KKKK'];else if(expr==='sad'||expr==='sick')mr=['.KK.','K..K'];else if(expr==='sleep')mr=['KK'];stamp(cv,mr,Math.floor(16-Math.max(...mr.map(r=>r.length))/2),G.mouthY,pal,G.inBody);
    if(expr==='angry')stampPair(cv,['K...','.KKK'],G.eyeX,G.eyeY-4,pal,null,true);if(expr==='sad')stampPair(cv,['B','B','w'],G.eyeX+2,G.eyeY+2,pal,null,true);
    if(E.mark==='mole')cv.set(31-G.eyeX+2,G.eyeY+2,INK);if(E.mark==='freckles')stampPair(cv,['r.r.r'],G.eyeX,G.mouthY-1,pal,G.inBody);
    for(const sc of E.scars||[]){const def=SCARS[sc.type];if(!def)continue;const pos=scarPos(G,sc),r=SCAR_COLORS[sc.color]||SCAR_COLORS.pink;stamp(cv,sc.side==='right'?flipRows(def.rows):def.rows,pos.x,pos.y,{r,R:lineOf(r)},(x,y)=>G.inBody(x,y)&&!(y>=G.mouthY&&y<G.mouthY+mr.length&&x>=12&&x<=20));}
    for(const a of E.accessories||[]){const def=ACC[a.type];if(!def)continue;stamp(cv,a.flip?flipRows(def.rows):def.rows,a.x,a.y,palette(color(a.c,def.c)));}
    (E.pixels||[]).forEach((c,i)=>{if(c)cv.set(i%32,Math.floor(i/32),c);});
    let result=cv;if(expr==='sleep'){stamp(result,frame?['KKK','..K','.K.','KKK']:['KK','K.','KK'],24,3,{K:INK});}else if(frame&&motion!=='walk'){result=Canvas();for(let y=0;y<31;y++)for(let x=0;x<32;x++)if(cv.g[y][x])result.set(x,y+1,cv.g[y][x]);}
    return cachePut(CANVAS_CACHE,key,result);
  }
  function drawPet(p,expression='normal',motion='idle'){const key=JSON.stringify([p.look,p.extra,p.stage,expression,motion]);if(DRAW_CACHE.has(key))return DRAW_CACHE.get(key);const a=petCanvas(p,expression,0,motion),b=petCanvas(p,expression,1,motion);return cachePut(DRAW_CACHE,key,`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><g class="sprite-a">${svgRects(a)}</g><g class="sprite-b" style="visibility:hidden">${svgRects(b)}</g></svg>`);}


  /* =========================================================
   * 방 그림 — 방·가구·펫 모두 같은 도트 크기 (방 = 160 x 112 도트)
   * ========================================================= */
  const RW = 160, RH = 112;
  const FLOOR_Y = 69;
  let weatherCache = { mood: 'calm', night: false };

  function rectsSVG(w, h, draw, flip) {
    let s = '';
    const r = (x, y, ww, hh, c) => { if (c) s += `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${c}"/>`; };
    draw(r);
    const g = flip ? `<g transform="translate(${w} 0) scale(-1 1)">${s}</g>` : s;
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${g}</svg>`;
  }
  const heartR = (r, x, y, c) => { r(x, y, 2, 1, c); r(x + 3, y, 2, 1, c); r(x, y + 1, 5, 1, c); r(x + 1, y + 2, 3, 1, c); r(x + 2, y + 3, 1, 1, c); };

  const FURN = {
  "window": {
    "name": "창문",
    "w": 30,
    "h": 28,
    "c": "#C98F78",
    "wall": 1,
    "rows": [
      "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
      "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
      "..aabbbbbbbbbbaabbbbbbbbbbaa..",
      "..aabbbbbbbbbbaabbbbbbbbbbaa..",
      "..aabbbbccccbbaabbbbbbbbbbaa..",
      "..aabbccccccccaabbbbbbbbbbaa..",
      "..aabbccccccccaabbbbbbbbbbaa..",
      "..aabbccccccccaabbbbbbbbbbaa..",
      "..aabbbbbbbbbbaabbbbbbbbbbaa..",
      "..aabbbbbbbbbbaabbbbbbbbbbaa..",
      "..aabbbbbbbbbbaabbbbbbbbbbaa..",
      "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
      "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
      "..aabbbbbbbbbbaabcccccccbbaa..",
      "..aabbbbbbbbbbaabcccccccbbaa..",
      "..aabbbbbbbbbbaabbbbbbbbbbaa..",
      "..aaddddddddddaaddddddddddaa..",
      "..aaddddddddddaaddddddddddaa..",
      "..aaddddddddddaaddddddddddaa..",
      "..aaddddddddddaaddddddddddaa..",
      "..aaddddddddddaaddddddddddaa..",
      "..aaddddddddddaaddddddddddaa..",
      "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
      "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
      "eeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      "ffffffffffffffffffffffffffffff",
      "ffffffffffffffffffffffffffffff",
      ".............................."
    ],
    "palette": {
      "a": "$O",
      "b": "#BFE6FF",
      "c": "#FFFFFF",
      "d": "#cbebff",
      "e": "$l",
      "f": "$b"
    },
    "maps": {
      "calm": {
        "rows": [
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbccccbbaabbbbbbbbbbaa..",
          "..aabbccccccccaabbbbbbbbbbaa..",
          "..aabbccccccccaabbbbbbbbbbaa..",
          "..aabbccccccccaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabcccccccbbaa..",
          "..aabbbbbbbbbbaabcccccccbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "eeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "ffffffffffffffffffffffffffffff",
          "ffffffffffffffffffffffffffffff",
          ".............................."
        ],
        "palette": {
          "a": "$O",
          "b": "#BFE6FF",
          "c": "#FFFFFF",
          "d": "#cbebff",
          "e": "$l",
          "f": "$b"
        }
      },
      "calmNight": {
        "rows": [
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbcbbbbbbaa..",
          "..aabbcbbbbbbbaabbbccbbbbbaa..",
          "..aabbbbbbbbbbaabbbccbbbbbaa..",
          "..aabbbbbbbbbbaabbbccccbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbcbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbcbbaa..",
          "..aabbbcbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "eeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "ffffffffffffffffffffffffffffff",
          "ffffffffffffffffffffffffffffff",
          ".............................."
        ],
        "palette": {
          "a": "$O",
          "b": "#2E3157",
          "c": "#FFF1A8",
          "d": "#545675",
          "e": "$l",
          "f": "$b"
        }
      },
      "sweet": {
        "rows": [
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbcccbbbbbaa..",
          "..aabbddbddbbbaabcccccbbbbaa..",
          "..aabbdddddbbbaacccccccbbbaa..",
          "..aabbbdddbbbbaacccccccbbbaa..",
          "..aabbbbdbbbbbaacccccccbbbaa..",
          "..aabbbbbbbbbbaabcccccbbbbaa..",
          "..aabbbbbbbbbbaabbcccbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbeebeebaabbbbbbbbbbaa..",
          "..aabbbbeeeeebaabbbddbddbbaa..",
          "..aafffffeeeffaafffdddddffaa..",
          "..aaffffffefffaaffffdddfffaa..",
          "..aaffffffffffaafffffdffffaa..",
          "..aaffffffffffaaffffffffffaa..",
          "..aaffffffffffaaffffffffffaa..",
          "..aaffffffffffaaffffffffffaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "gggggggggggggggggggggggggggggg",
          "hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh",
          "hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh",
          ".............................."
        ],
        "palette": {
          "a": "$O",
          "b": "#BFE6FF",
          "c": "#FFD54A",
          "d": "#FF7AA2",
          "e": "#FF9DBB",
          "f": "#cbebff",
          "g": "$l",
          "h": "$b"
        }
      },
      "sweetNight": {
        "rows": [
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbcccbbbbbaa..",
          "..aabbddbddbbbaabcccccbbbbaa..",
          "..aabbdddddbbbaacccccccbbbaa..",
          "..aabbbdddbbbbaacccccccbbbaa..",
          "..aabbbbdbbbbbaacccccccbbbaa..",
          "..aabbbbbbbbbbaabcccccbbbbaa..",
          "..aabbbbbbbbbbaabbcccbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbeebeebaabbbbbbbbbbaa..",
          "..aabbbbeeeeebaabbbddbddbbaa..",
          "..aafffffeeeffaafffdddddffaa..",
          "..aaffffffefffaaffffdddfffaa..",
          "..aaffffffffffaafffffdffffaa..",
          "..aaffffffffffaaffffffffffaa..",
          "..aaffffffffffaaffffffffffaa..",
          "..aaffffffffffaaffffffffffaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "gggggggggggggggggggggggggggggg",
          "hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh",
          "hhhhhhhhhhhhhhhhhhhhhhhhhhhhhh",
          ".............................."
        ],
        "palette": {
          "a": "$O",
          "b": "#7e95b3",
          "c": "#FFD54A",
          "d": "#FF7AA2",
          "e": "#FF9DBB",
          "f": "#95a8c1",
          "g": "$l",
          "h": "$b"
        }
      },
      "shy": {
        "rows": [
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbccaabbbbbbbbbbaa..",
          "..aabbccbbbbbdaabbbbbbbbbbaa..",
          "..aabbbdbbbbbbaabbbccbbbbbaa..",
          "..aabbbbbbbbbbaabbbbdbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbccbbaabbbbbbbbbbaa..",
          "..aabbbbbbbdbbaabbbbbbbbbbaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbdbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aaeeecceeeeeaaeeeeeeeeeeaa..",
          "..aaeeeedeeeeeaaeeeeeeeeeeaa..",
          "..aaeeeeeeeeeeaaceeeeeeeeeaa..",
          "..aaeeeeeeeeeeaadeeeeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeeeeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeeeeeeeeeaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "ffffffffffffffffffffffffffffff",
          "gggggggggggggggggggggggggggggg",
          "gggggggggggggggggggggggggggggg",
          ".............................."
        ],
        "palette": {
          "a": "$O",
          "b": "#FFD6E4",
          "c": "#FF8FB1",
          "d": "#FFB3CC",
          "e": "#ffdde9",
          "f": "$l",
          "g": "$b"
        }
      },
      "shyNight": {
        "rows": [
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbccaabbbbbbbbbbaa..",
          "..aabbccbbbbbdaabbbbbbbbbbaa..",
          "..aabbbdbbbbbbaabbbccbbbbbaa..",
          "..aabbbbbbbbbbaabbbbdbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbccbbaabbbbbbbbbbaa..",
          "..aabbbbbbbdbbaabbbbbbbbbbaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbdbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aaeeecceeeeeaaeeeeeeeeeeaa..",
          "..aaeeeedeeeeeaaeeeeeeeeeeaa..",
          "..aaeeeeeeeeeeaaceeeeeeeeeaa..",
          "..aaeeeeeeeeeeaadeeeeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeeeeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeeeeeeeeeaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "ffffffffffffffffffffffffffffff",
          "gggggggggggggggggggggggggggggg",
          "gggggggggggggggggggggggggggggg",
          ".............................."
        ],
        "palette": {
          "a": "$O",
          "b": "#a18ca5",
          "c": "#FF8FB1",
          "d": "#FFB3CC",
          "e": "#b2a1b5",
          "f": "$l",
          "g": "$b"
        }
      },
      "storm": {
        "rows": [
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbccccccaabbbbbbbbbbaa..",
          "..aabcccccccccaacbbbbbbbbbaa..",
          "..aabcccccccccaacbbbbbbbbbaa..",
          "..aabcccccccccaacbbbbbbbbbaa..",
          "..aabcccccccccaacbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabdbbbbbbbbaabbbbbbbbbbaa..",
          "..aabdbbbbbbbbaabbbbdbbbbbaa..",
          "..aabbbbbbbbbbaabbbbdbbbbbaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbdbaabbbbbdbbbbaa..",
          "..aabbbdbbbbdbaabbbbbbbbbbaa..",
          "..aabbbdbbbbbbaabbbbbbbbbbaa..",
          "..aaeeeeeeeeedaaeeeeeeeeeeaa..",
          "..aaeeeeeeeeedaaeeeeeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeedeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeedeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeeeeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeeeeeeeeeaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "ffffffffffffffffffffffffffffff",
          "gggggggggggggggggggggggggggggg",
          "gggggggggggggggggggggggggggggg",
          ".............................."
        ],
        "palette": {
          "a": "$O",
          "b": "#8C96A8",
          "c": "#6E7788",
          "d": "#D6E6F5",
          "e": "#a1a9b8",
          "f": "$l",
          "g": "$b"
        }
      },
      "stormNight": {
        "rows": [
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbccccccaabbbbbbbbbbaa..",
          "..aabcccccccccaacbbbbbbbbbaa..",
          "..aabcccccccccaacbbbbbbbbbaa..",
          "..aabcccccccccaacbbbbbbbbbaa..",
          "..aabcccccccccaacbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabdbbbbbbbbaabbbbbbbbbbaa..",
          "..aabdbbbbbbbbaabbbbdbbbbbaa..",
          "..aabbbbbbbbbbaabbbbdbbbbbaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbdbaabbbbbdbbbbaa..",
          "..aabbbdbbbbdbaabbbbbbbbbbaa..",
          "..aabbbdbbbbbbaabbbbbbbbbbaa..",
          "..aaeeeeeeeeedaaeeeeeeeeeeaa..",
          "..aaeeeeeeeeedaaeeeeeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeedeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeedeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeeeeeeeeeaa..",
          "..aaeeeeeeeeeeaaeeeeeeeeeeaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "ffffffffffffffffffffffffffffff",
          "gggggggggggggggggggggggggggggg",
          "gggggggggggggggggggggggggggggg",
          ".............................."
        ],
        "palette": {
          "a": "$O",
          "b": "#626984",
          "c": "#6E7788",
          "d": "#D6E6F5",
          "e": "#7e849a",
          "f": "$l",
          "g": "$b"
        }
      },
      "sad": {
        "rows": [
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabcbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbcbbbaa..",
          "..aabbbbbbbbbcaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbcbbbbaa..",
          "..aabbbbbbbbcbaabbbbbbbbbbaa..",
          "..aabbbbbcbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbcbbbbbaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbcbbbbbbaa..",
          "..aabbbbbbbbbbaacbbbbbbbbbaa..",
          "..aabbbcbbbbbbaabbbbbbbbbbaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddcdddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "eeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "ffffffffffffffffffffffffffffff",
          "ffffffffffffffffffffffffffffff",
          ".............................."
        ],
        "palette": {
          "a": "$O",
          "b": "#5E6E96",
          "c": "#FFFFFF",
          "d": "#7b88a9",
          "e": "$l",
          "f": "$b"
        }
      },
      "sadNight": {
        "rows": [
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabcbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbcbbbaa..",
          "..aabbbbbbbbbcaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbbcbbbbaa..",
          "..aabbbbbbbbcbaabbbbbbbbbbaa..",
          "..aabbbbbcbbbbaabbbbbbbbbbaa..",
          "..aabbbbbbbbbbaabbbbcbbbbbaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aabbbbbbbbbbaabbbcbbbbbbaa..",
          "..aabbbbbbbbbbaacbbbbbbbbbaa..",
          "..aabbbcbbbbbbaabbbbbbbbbbaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddcdddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaddddddddddaaddddddddddaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "..aaaaaaaaaaaaaaaaaaaaaaaaaa..",
          "eeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          "ffffffffffffffffffffffffffffff",
          "ffffffffffffffffffffffffffffff",
          ".............................."
        ],
        "palette": {
          "a": "$O",
          "b": "#48537a",
          "c": "#FFFFFF",
          "d": "#697292",
          "e": "$l",
          "f": "$b"
        }
      }
    }
  },
  "curtain": {
    "name": "커튼",
    "w": 38,
    "h": 30,
    "c": "#FF9DBB",
    "wall": 1,
    "rows": [
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aabbbbbbb....................bbbbbbbaa",
      "..bbbbbbb....................bbbbbbb..",
      "..bbcbbbb....................bbcbbbb..",
      "..bbcbbcb....................bbcbbcb..",
      "..bbbbbcb....................bbbbbcb..",
      "..bbcbbbb....................bbcbbbb..",
      "..bbcbbcb....................bbcbbcb..",
      "..bbbbbcb....................bbbbbcb..",
      "..bbcbbbb....................bbcbbbb..",
      "..bbcbbcb....................bbcbbcb..",
      "..bbbbbcb....................bbbbbcb..",
      "..bbcbbbb....................bbcbbbb..",
      "..bbcbbcb....................bbcbbcb..",
      "..bbbbbcb....................bbbbbcb..",
      "..bbcbbbb....................bbcbbbb..",
      "..ddddddd....................ddddddd..",
      "..ddddddd....................ddddddd..",
      "..bbcbbbb....................bbcbbbb..",
      "..bbcbbcb....................bbcbbcb..",
      "..bbbbbcb....................bbbbbcb..",
      "..bbcbbbb....................bbcbbbb..",
      "..bbcbbcb....................bbcbbcb..",
      "..bbbbbcb....................bbbbbcb..",
      "..bbcbbbb....................bbcbbbb..",
      "..bbcbbcb....................bbcbbcb..",
      "..bbbbbcb....................bbbbbcb..",
      "..bbbbbbb....................bbbbbbb..",
      "......................................"
    ],
    "palette": {
      "a": "$O",
      "b": "$b",
      "c": "$s",
      "d": "#FFD54A"
    }
  },
  "lights": {
    "name": "조명줄",
    "w": 60,
    "h": 7,
    "c": "#8A6F6A",
    "wall": 1,
    "gift": 300,
    "rows": [
      "............................................................",
      "...................................aaaaaaaaaaaaaaa..........",
      ".............................aaaaaa..bbb....ccc...aaaaaaa...",
      "aaaaaaa...............aaaaaaa.ddd....bbb....ccc....eee...aaa",
      "..ddd..aaaaaaaaaaaaaaa.eee....ddd..................eee....dd",
      "..ddd....bbb....ccc....eee................................dd",
      ".........bbb....ccc........................................."
    ],
    "palette": {
      "a": "$b",
      "b": "#8FD3FF",
      "c": "#FFD54A",
      "d": "#B9F5A0",
      "e": "#FF8FB1"
    }
  },
  "frame": {
    "name": "액자",
    "w": 12,
    "h": 12,
    "c": "#E8A0B4",
    "wall": 1,
    "rows": [
      "aaaaaaaaaaaa",
      "abbbbbbbbbba",
      "abccccccccba",
      "abccccccccba",
      "abccbbcbbcba",
      "abccbbbbbcba",
      "abcccbbbccba",
      "abccccbcccba",
      "abccccccccba",
      "abccccccccba",
      "abbbbbbbbbba",
      "aaaaaaaaaaaa"
    ],
    "palette": {
      "a": "$O",
      "b": "$b",
      "c": "#FFF6EF"
    }
  },
  "quote": {
    "name": "명대사 액자",
    "w": 22,
    "h": 18,
    "c": "#F2C86A",
    "wall": 1,
    "rows": [
      "aaaaaaaaaaaaaaaaaaaaaa",
      "abbbbbbbbbbbbbbbbbbbba",
      "abbbbbbbbbbbbbbbbbbbba",
      "abbccccccccccccccccbba",
      "abbccccccccccccccccbba",
      "abbccddddddddddccccbba",
      "abbccccccccccccccccbba",
      "abbccccccccccccccccbba",
      "abbccddddddddddddccbba",
      "abbccccccccccccccccbba",
      "abbccccccccceeceeccbba",
      "abbccdddddddeeeeeccbba",
      "abbcccccccccceeecccbba",
      "abbccccccccccceccccbba",
      "abbccccccccccccccccbba",
      "abbbbbbbbbbbbbbbbbbbba",
      "abbbbbbbbbbbbbbbbbbbba",
      "aaaaaaaaaaaaaaaaaaaaaa"
    ],
    "palette": {
      "a": "$s",
      "b": "$b",
      "c": "#FFF8EC",
      "d": "#9B8A86",
      "e": "#FF7AA2"
    }
  },
  "clock": {
    "name": "시계",
    "w": 10,
    "h": 10,
    "c": "#FF9DBB",
    "wall": 1,
    "rows": [
      "..aaaaaa..",
      ".abbbbbba.",
      "abccccccba",
      "abccccccba",
      "abccaaacba",
      "abccaaccba",
      "abccccccba",
      "abccccccba",
      ".abbbbbba.",
      "..aaaaaa.."
    ],
    "palette": {
      "a": "$O",
      "b": "$b",
      "c": "#FFF8EC"
    },
    "maps": {
      "calm": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccccccba",
          "abccaaacba",
          "abccaaccba",
          "abccccccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour0": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccacccba",
          "abccaaccba",
          "abccaaccba",
          "abccccccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour1": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccccacba",
          "abccaaccba",
          "abccaaccba",
          "abccccccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour2": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccccccba",
          "abccaaacba",
          "abccaaccba",
          "abccccccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour3": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccccccba",
          "abccaaacba",
          "abccaaccba",
          "abccccccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour4": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccccccba",
          "abccaaccba",
          "abccaaccba",
          "abccccacba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour5": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccccccba",
          "abccaaccba",
          "abccaaccba",
          "abccacccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour6": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccccccba",
          "abccaaccba",
          "abccaaccba",
          "abccacccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour7": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccccccba",
          "abccaaccba",
          "abccaaccba",
          "abcaccccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour8": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccccccba",
          "abcaaaccba",
          "abccaaccba",
          "abccccccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour9": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccccccba",
          "abcaaaccba",
          "abccaaccba",
          "abccccccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour10": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abcaccccba",
          "abccaaccba",
          "abccaaccba",
          "abccccccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      },
      "hour11": {
        "rows": [
          "..aaaaaa..",
          ".abbbbbba.",
          "abccccccba",
          "abccacccba",
          "abccaaccba",
          "abccaaccba",
          "abccccccba",
          "abccccccba",
          ".abbbbbba.",
          "..aaaaaa.."
        ],
        "palette": {
          "a": "$O",
          "b": "$b",
          "c": "#FFF8EC"
        }
      }
    }
  },
  "bed": {
    "name": "포근한 침대",
    "w": 30,
    "h": 18,
    "c": "#FF9DBB",
    "wall": 0,
    "rows": [
      "..............................",
      "..............................",
      "aaa...........................",
      "aba...........................",
      "aba...........................",
      "aba.aaaaaaaaaa................",
      "aba.acccccccca................",
      "aba.acccccccca................",
      "abaaaccccccccaaaaaaaaaaaaaaaaa",
      "abaaaccccccccaddddddddddddddda",
      "abaaaaaaaaaaaaeeeeeeeeeeeeeeea",
      "abaaeeeeeeeeeeeeeeeeeeeeeeeeea",
      "abaaeeeeeeeeeeeeddeeddeeddeeea",
      "abaaeeeeeeeeeeeeeeeeeeeeeeeeea",
      "abaaeeeeeeeeeeeeeeeeeeeeeeeeea",
      "abaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "abaaa......................aa.",
      "aaaaa......................aa."
    ],
    "palette": {
      "a": "$O",
      "b": "#B07A66",
      "c": "#FFF6EF",
      "d": "$l",
      "e": "$b"
    }
  },
  "canopy": {
    "name": "캐노피 침대",
    "w": 32,
    "h": 32,
    "c": "#E2D2FF",
    "wall": 0,
    "gift": 1000,
    "rows": [
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aabbbbbbbbbbbbbbbbbbbbbbbbbbbbaa",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aaccccc..................cccccaa",
      "aaccccc..................cccccaa",
      "aaccbcc..................ccbccaa",
      "aaccbcc..................ccbccaa",
      "aaccccc..................cccccaa",
      "aaccbcc..................ccbccaa",
      "aaccbcc..................ccbccaa",
      "aaccccc..................cccccaa",
      "aaccbcc..................ccbccaa",
      "aaccbcc..................ccbccaa",
      "aaccccc..................cccccaa",
      "aaccbcc..................ccbccaa",
      "aaccbcc..................ccbccaa",
      "aaccccc..................cccccaa",
      "aaccbcc..................ccbccaa",
      "aa..b......................b..aa",
      "aa..aaaaaaaaa.................aa",
      "aa..addddddda.................aa",
      "aa..addddddda.................aa",
      "aaaaadddddddaaaaaaaaaaaaaaaaaaaa",
      "aaaeaaaaaaaaaeeeeeeeeeeeeeeeeaaa",
      "aaabbbbbbbbbbbbbbbbbbbbbbbbbbaaa",
      "aaabbbbbbbbbbbbbbbbbbbbbbbbbbaaa",
      "aaabbbbbbbbbbbbbbbbbbbbbbbbbbaaa",
      "aaabbbbbbbbbbbbbbbbbbbbbbbbbbaaa",
      "aaabbbbbbbbbbbbbbbbbbbbbbbbbbaaa",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aaaa........................aaaa",
      "aaaa........................aaaa"
    ],
    "palette": {
      "a": "$O",
      "b": "$b",
      "c": "$l",
      "d": "#FFF6EF",
      "e": "$l"
    }
  },
  "chair": {
    "name": "의자",
    "w": 12,
    "h": 18,
    "c": "#E8A0B4",
    "wall": 0,
    "rows": [
      ".aaaaaaaaaa.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".aaaaaaaaaa.",
      "acccccccccca",
      "acccccccccca",
      "aaaaaaaaaaaa",
      ".aa......aa.",
      ".aa......aa.",
      ".aa......aa.",
      ".aa......aa.",
      ".aa......aa.",
      ".aa......aa."
    ],
    "palette": {
      "a": "$O",
      "b": "$b",
      "c": "$l"
    }
  },
  "sofa": {
    "name": "소파",
    "w": 32,
    "h": 16,
    "c": "#C4A3E0",
    "wall": 0,
    "gift": 100,
    "rows": [
      "................................",
      "................................",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "aabbbbbbbbbbbbbbbbbbbbbbbbbbbbaa",
      "aaaabbbbbbbbbbbbbbbbbbbbbbbbaaaa",
      "abbabbbbbbbbbbbbbbbbbbbbbbbbabba",
      "abbabbbbbbbbbbbbbbbbbbbbbbbbabba",
      "abbabbbbbbbbbbbbbbbbbbbbbbbbabba",
      "abbacccccccdccccccccdcccccccabba",
      "abbacccccccdccccccccdcccccccabba",
      "abbacccccccdccccccccdcccccccabba",
      "abbacccccccdccccccccdcccccccabba",
      "abbaaaaaaaaaaaaaaaaaaaaaaaaaabba",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "..aa........................aa..",
      "..aa........................aa.."
    ],
    "palette": {
      "a": "$O",
      "b": "$b",
      "c": "$l",
      "d": "$s"
    }
  },
  "desk": {
    "name": "책상",
    "w": 24,
    "h": 16,
    "c": "#D6A07F",
    "wall": 0,
    "rows": [
      ".....aaaaaaaaa..........",
      ".....abbbbbbba..........",
      ".....abbbbbbba..........",
      ".....aaaaaaaaa..........",
      "acccccccccccccccccccccca",
      "acccccccccccccccccccccca",
      "aaaaaaaaaaaaaaaaaaaaaaaa",
      ".aa...........aaaaaaaaa.",
      ".aa...........accccccaa.",
      ".aa...........accaaccaa.",
      ".aa...........accccccaa.",
      ".aa...........aaaaaaaaa.",
      ".aa..................aa.",
      ".aa..................aa.",
      ".aa..................aa.",
      ".aa..................aa."
    ],
    "palette": {
      "a": "$O",
      "b": "#A3CED2",
      "c": "$b"
    }
  },
  "shelf": {
    "name": "책장",
    "w": 18,
    "h": 26,
    "c": "#C9A180",
    "wall": 0,
    "rows": [
      "aaaaaaaaaaaaaaaaaa",
      "abbbbbbbbbbbbbbbba",
      "abccbbbbddbbbbeeba",
      "abccbffbddbggbeeba",
      "abccbffbddbggbeeba",
      "abccbffbddbggbeeba",
      "abccbffbddbggbeeba",
      "abccbffbddbggbeeba",
      "abccbffbddbggbeeba",
      "aaaaaaaaaaaaaaaaaa",
      "abbbbddbbbbeebbbba",
      "abffbddbggbeebhhba",
      "abffbddbggbeebhhba",
      "abffbddbggbeebhhba",
      "abffbddbggbeebhhba",
      "abffbddbggbeebhhba",
      "abffbddbggbeebhhba",
      "aaaaaaaaaaaaaaaaaa",
      "abddbbbbeebbbbccba",
      "abddbggbeebhhbccba",
      "abddbggbeebhhbccba",
      "abddbggbeebhhbccba",
      "abddbggbeebhhbccba",
      "abddbggbeebhhbccba",
      "abddbggbeebhhbccba",
      "aaaaaaaaaaaaaaaaaa"
    ],
    "palette": {
      "a": "$O",
      "b": "$b",
      "c": "#FF8FB1",
      "d": "#FFD54A",
      "e": "#9C7BE0",
      "f": "#7DA7F0",
      "g": "#6CC46A",
      "h": "#FFF6EF"
    }
  },
  "plant": {
    "name": "화분",
    "w": 10,
    "h": 18,
    "c": "#E8A07F",
    "wall": 0,
    "rows": [
      "...aaaa...",
      "...aaaa...",
      "...aaaaaaa",
      "aaaabbaaaa",
      "aaaabbaaaa",
      "aaaabbaaaa",
      "aaaabbaaaa",
      "aaaabbaaaa",
      "..aabbaa..",
      "..aabbaa..",
      "..aabbaa..",
      ".cccccccc.",
      ".cddddddc.",
      ".ceeeeeec.",
      ".ceeeeeec.",
      ".ceeeeeec.",
      ".ceeeeeec.",
      ".cccccccc."
    ],
    "palette": {
      "a": "#6CC46A",
      "b": "#3E8E41",
      "c": "$O",
      "d": "$l",
      "e": "$b"
    }
  },
  "sakura": {
    "name": "벚꽃 화분",
    "w": 14,
    "h": 26,
    "c": "#F0B48A",
    "wall": 0,
    "season": [
      3,
      4,
      5
    ],
    "rows": [
      "....aaaaaaa...",
      "....abbaaaa...",
      "....abbaaaa...",
      "....aaaaaaa...",
      "....aaaaaaa...",
      "....aaaaaaa...",
      "aaaaaaaaaaa...",
      "abbaaa..aaaaaa",
      "abbaaaccabbaaa",
      "aaaaaaccabbaaa",
      "aaaaaaccaaaaaa",
      "aaaaaaccaaaaaa",
      "....aaaaaaaaaa",
      "....abbaa.....",
      "....abbaa.....",
      "....aaaaa.....",
      "....aaaaa.....",
      "......cc......",
      "......cc......",
      "..dddddddddd..",
      "..deeeeeeeed..",
      "..deeeeeeeed..",
      "..deeeeeeeed..",
      "..deeeeeeeed..",
      "..deeeeeeeed..",
      "..dddddddddd.."
    ],
    "palette": {
      "a": "#FFB3CC",
      "b": "#FFD9E6",
      "c": "#8A5A44",
      "d": "$O",
      "e": "$b"
    }
  },
  "tree": {
    "name": "트리",
    "w": 20,
    "h": 30,
    "c": "#4FA36B",
    "wall": 0,
    "season": [
      12,
      1,
      2
    ],
    "rows": [
      "........aaaa........",
      "........aaaa........",
      "........aaaa........",
      ".......baaaab.......",
      ".......bccccb.......",
      ".......bccccb.......",
      ".......bccccb.......",
      ".......bccccb.......",
      ".....bccccccccb.....",
      ".....bcddcccccb.....",
      ".....bcddcccccb.....",
      ".....bccccccccb.....",
      ".....bccccccccb.....",
      "...bccccccccccccb...",
      "...bccccccccaaccb...",
      "...bccccccccaaccb...",
      "...bccccccccccccb...",
      "...bccccccccccccb...",
      ".bcccceeccccccccccb.",
      ".bcccceeccccccccccb.",
      ".bccccccccccccddccb.",
      ".bcccccccaacccddccb.",
      ".bcccccccaacccccccb.",
      ".bbbbbbbbffbbbbbbbb.",
      ".........ff.........",
      ".........ff.........",
      ".....ggggaagggg.....",
      ".....ggggaagggg.....",
      ".....ggggaagggg.....",
      ".....ggggaagggg....."
    ],
    "palette": {
      "a": "#FFD54A",
      "b": "$s",
      "c": "$b",
      "d": "#FF8FB1",
      "e": "#8FD3FF",
      "f": "#8A5A44",
      "g": "#D9534F"
    }
  },
  "snowman": {
    "name": "눈사람",
    "w": 12,
    "h": 18,
    "c": "#FFFFFF",
    "wall": 0,
    "season": [
      12,
      1,
      2
    ],
    "rows": [
      "...aaaaaa...",
      "...abbbba...",
      "...abcbca...",
      "...abbdda...",
      "...abbbba...",
      "..eeeeeeee..",
      ".aeeeeeeeea.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".abbbbcbbba.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".abbbbcbbba.",
      ".abbbbbbbba.",
      ".abbbbbbbba.",
      ".aaaaaaaaaa.",
      "............"
    ],
    "palette": {
      "a": "#C9D6E3",
      "b": "$b",
      "c": "$O",
      "d": "#FF9F43",
      "e": "#D9534F"
    }
  },
  "balloons": {
    "name": "생일 풍선",
    "w": 12,
    "h": 26,
    "c": "#FF8FB1",
    "wall": 0,
    "special": "birthday",
    "rows": [
      "abbbba......",
      "acbbba......",
      "acbbbadeeeed",
      "abbbbadceeed",
      "abbbbadceeed",
      "abbbbadeeeed",
      "aaafggggfeed",
      "...fcgggfeed",
      "...fcgggfddd",
      "...hggggh...",
      "...hggggh...",
      "...hggggh...",
      "...hffffh...",
      "...h.h..h...",
      "...h.h..h...",
      "...h.h..h...",
      "...h.h..h...",
      "...h.h..h...",
      "...h.h..h...",
      "...h.h..h...",
      "...h.h..h...",
      "...h.h..h...",
      "...h.h..h...",
      "..ijjjjjji..",
      "..ijjjjjji..",
      "..iiiiiiii.."
    ],
    "palette": {
      "a": "$s",
      "b": "$b",
      "c": "#FFFFFF",
      "d": "#d9b53f",
      "e": "#FFD54A",
      "f": "#7ab3d9",
      "g": "#8FD3FF",
      "h": "#9B8A86",
      "i": "$O",
      "j": "#FFF6EF"
    }
  },
  "rug": {
    "name": "러그",
    "w": 40,
    "h": 10,
    "c": "#FFD1DC",
    "wall": 0,
    "rows": [
      "...........aaaaaaaaaaaaaaaaaa...........",
      "......bbbbbbbbbbbbbbbbbbbbbbbbbbbb......",
      "...bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb...",
      ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "bbbbcccbbbcccbbbcccbbbcccbbbcccbbbcccbbb",
      ".bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
      "...bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb...",
      "......bbbbbbbbbbbbbbbbbbbbbbbbbbbb......",
      "...........aaaaaaaaaaaaaaaaaa..........."
    ],
    "palette": {
      "a": "$s",
      "b": "$b",
      "c": "$s"
    }
  },
  "cushion": {
    "name": "별 쿠션",
    "w": 12,
    "h": 8,
    "c": "#FFD54A",
    "wall": 0,
    "rows": [
      "............",
      ".abbbbbbbba.",
      "abbbbbbbbbba",
      "abbbbccbbbba",
      "abbbbccbbbba",
      "abbbbbbbbbba",
      ".aaaaaaaaaa.",
      "............"
    ],
    "palette": {
      "a": "$O",
      "b": "$b",
      "c": "$l"
    }
  },
  "bear": {
    "name": "곰 인형",
    "w": 12,
    "h": 14,
    "c": "#C99A6A",
    "wall": 0,
    "rows": [
      "aaaa....aaaa",
      "abba....abba",
      "aaaaaaaaaaaa",
      "aabbbbbbbbaa",
      ".abbabbabba.",
      ".abbbbbbbba.",
      ".abbbaabbba.",
      ".abbbbbbbba.",
      ".aaaaaaaaaa.",
      "..abbbbbba..",
      "..abccccba..",
      "..abccccba..",
      "..abbbbbba..",
      "..aaaaaaaa.."
    ],
    "palette": {
      "a": "$O",
      "b": "$b",
      "c": "$l"
    }
  },
  "lamp": {
    "name": "스탠드",
    "w": 10,
    "h": 26,
    "c": "#FFD1DC",
    "wall": 0,
    "rows": [
      ".aaaaaaaa.",
      "abbbbbbbba",
      "abbbbbbbba",
      "abbbbbbbba",
      "abbbbbbbba",
      "abbbbbbbba",
      "abbbbbbbba",
      "aaaaaaaaaa",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      "....aa....",
      ".aaaaaaaa.",
      ".aaaaaaaa."
    ],
    "palette": {
      "a": "$O",
      "b": "$b"
    }
  },
  "nightstand": {
    "name": "무드등 협탁",
    "w": 10,
    "h": 18,
    "c": "#D6A07F",
    "wall": 0,
    "rows": [
      "..aaaaaa..",
      ".bbbbbbbb.",
      ".bbbbbbbb.",
      ".bbbbbbbb.",
      ".bbbbbbbb.",
      ".bbbbbbbb.",
      "....cc....",
      "cccccccccc",
      "cddddddddc",
      "cddddddddc",
      "cdddccdddc",
      "cddddddddc",
      "cccccccccc",
      "cddddddddc",
      "cdddccdddc",
      "cddddddddc",
      "cddddddddc",
      "cccccccccc"
    ],
    "palette": {
      "a": "#FFD54A",
      "b": "#FFF1A8",
      "c": "$O",
      "d": "$b"
    }
  },
  "roundtable": {
    "name": "원형 테이블",
    "w": 16,
    "h": 14,
    "c": "#D6A07F",
    "wall": 0,
    "rows": [
      ".....aaaaa......",
      ".....abbbaaa....",
      ".....abbbaaa....",
      ".....abbba......",
      ".....aaaaa......",
      "acccccccccccccca",
      "acccccccccccccca",
      "aaaaaaaaaaaaaaaa",
      ".......aa.......",
      ".......aa.......",
      ".......aa.......",
      ".......aa.......",
      ".......aa.......",
      "....aaaaaaaa...."
    ],
    "palette": {
      "a": "$O",
      "b": "#FFF6EF",
      "c": "$b"
    }
  },
  "coffee": {
    "name": "커피머신",
    "w": 10,
    "h": 14,
    "c": "#7DA7F0",
    "wall": 0,
    "rows": [
      "aaaaaaaaaa",
      "abbbbbbbba",
      "abbbbbbcba",
      "abbbbbbbba",
      "abbbbbbbba",
      "abbaaaabba",
      "abbaaaabba",
      "abbaaaabba",
      "abbaaaabba",
      "abbaaaabba",
      "abbadddbba",
      "abbadddbba",
      "abbadddbba",
      "aaaaaaaaaa"
    ],
    "palette": {
      "a": "$O",
      "b": "$b",
      "c": "#FF8FB1",
      "d": "#FFF6EF"
    }
  },
  "tv": {
    "name": "TV",
    "w": 22,
    "h": 20,
    "c": "#9C7BE0",
    "wall": 0,
    "gift": 500,
    "rows": [
      "aaaaaaaaaaaaaaaaaaaaaa",
      "aaaaaaaaaaaaaaaaaaaaaa",
      "aabbbbbbbbbbbbbbbbbbaa",
      "aabcccbbbbbbbbbbbbbbaa",
      "aabbbbbbbbbbbbbbbbbbaa",
      "aabbbbbbbddbddbbbbbbaa",
      "aabbbbbbbdddddbbbbbbaa",
      "aabbbbbbbbdddbbbbbbbaa",
      "aabbbbbbbbbdbbbbbbbbaa",
      "aabbbbbbbbbbbbbbbbbbaa",
      "aabbbbbbbbbbbbbbbbbbaa",
      "aabbbbbbbbbbbbbbbbbbaa",
      "aaaaaaaaaaaaaaaaaaaaaa",
      "aaaaaaaaaaaaaaaaaaaaaa",
      ".........aaaa.........",
      ".........aaaa.........",
      "..aaaaaaaaaaaaaaaaaa..",
      "..aeeeeeeeeeeeeeeeea..",
      "..aeeeeeeeeeeeeeeeea..",
      "..aaaaaaaaaaaaaaaaaa.."
    ],
    "palette": {
      "a": "$O",
      "b": "#2E3157",
      "c": "#5E6E96",
      "d": "#FF8FB1",
      "e": "$b"
    }
  },
  "wardrobe": {
    "name": "옷장",
    "w": 18,
    "h": 30,
    "c": "#E3C3A8",
    "wall": 0,
    "gift": 1500,
    "rows": [
      "aaaaaaaaaaaaaaaaaa",
      "abbbbbbbbbbbbbbbba",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccacaacccccca",
      "accccccacaacccccca",
      "accccccacaacccccca",
      "accccccacaacccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "accccccccaccccccca",
      "aaaaaaaaaaaaaaaaaa",
      "aaaaaaaaaaaaaaaaaa"
    ],
    "palette": {
      "a": "$O",
      "b": "$l",
      "c": "$b"
    }
  },
  "vanity": {
    "name": "화장대",
    "w": 18,
    "h": 26,
    "c": "#FFB3C7",
    "wall": 0,
    "gift": 2000,
    "rows": [
      "....aaaaaaaaaa....",
      "....abbbbbbbba....",
      "....abccbbbbba....",
      "....abccbbbbba....",
      "....abccbbbbba....",
      "....abbbbbbbba....",
      "....abbbbbbbba....",
      "....abbbbbbbba....",
      "....abbbbbbbba....",
      "....abbbbbbbbdd...",
      "....abbbbbbbbdd...",
      "....aaaaaaaaadd...",
      "aeeeeeeeeeeeeeeeea",
      "aeeeeeeeeeeeeeeeea",
      "aaaaaaaaaaaaaaaaaa",
      ".aaaaaa....aaaaaa.",
      ".aeeeea....aeeeea.",
      ".aeeeea....aeeeea.",
      ".aeeeea....aeeeea.",
      ".aeeeea....aeeeea.",
      ".aaaaaa....aaaaaa.",
      ".aa............aa.",
      ".aa............aa.",
      ".aa............aa.",
      ".aa............aa.",
      ".aa............aa."
    ],
    "palette": {
      "a": "$O",
      "b": "#CFE8F2",
      "c": "#FFFFFF",
      "d": "#FF6F91",
      "e": "$b"
    }
  },
  "cake": {
    "name": "케이크 테이블",
    "w": 16,
    "h": 16,
    "c": "#FFB3C7",
    "wall": 0,
    "rows": [
      "....aa..........",
      "....aa..........",
      "....aa..........",
      "...bbbbbbbbbb...",
      "...bccccccccb...",
      "...bddddddddb...",
      "...bddddddddb...",
      "...bddddddddb...",
      "...bbbbbbbbbb...",
      "beeeeeeeeeeeeeeb",
      "beeeeeeeeeeeeeeb",
      "bbbbbbbbbbbbbbbb",
      "..bb........bb..",
      "..bb........bb..",
      "..bb........bb..",
      "..bb........bb.."
    ],
    "palette": {
      "a": "#FFD54A",
      "b": "$O",
      "c": "#FFF6EF",
      "d": "$b",
      "e": "#D6A07F"
    }
  }
};
  const FOOD_MAPS = {
  "rice": {
    "rows": [
      "................................",
      "................................",
      "................................",
      "................................",
      "..............aaaaa.............",
      "..............aaaaa.............",
      "..............aaaaa.............",
      "..............bbbbb.............",
      ".........aaaaabbbbbaaaa.........",
      ".........aaaaabbbbbaaaa.........",
      ".........aaaaabbbbbaaaa.........",
      ".........aabbbbbbbbbbbb.........",
      ".....aaaaaabbbbbbbbbbbbaaaa.....",
      ".....aaaaaabbbbbbbbbbbbaaaa.....",
      ".....aaaaaabbbbbbbbbbbbaaaa.....",
      ".....aaabbbbbbbbbbbbbbbbaaa.....",
      ".....aaabbbbbbbbbbbbbbbbaaa.....",
      ".....aaabbbbccccccccbbbbaaa.....",
      ".....aaabbbbccccccccbbbbaaa.....",
      ".....aaabbbbccccccccbbbbaaa.....",
      ".....aaabbbbccccccccbbbbaaa.....",
      ".....aaabbbbccccccccbbbbaaa.....",
      ".....aaaaaaaccccccccaaaaaaa.....",
      ".....aaaaaaaccccccccaaaaaaa.....",
      ".....aaaaaaaccccccccaaaaaaa.....",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................"
    ],
    "palette": {
      "a": "#534655",
      "b": "#fff5dc",
      "c": "#547b66"
    }
  },
  "cake": {
    "rows": [
      "................................",
      "................................",
      "................................",
      "................................",
      "..............aaaa..............",
      "..............aaaa..............",
      ".............baaaab.............",
      ".............bbbbbb.............",
      ".............bbbbbb.............",
      ".............bbbbbb.............",
      ".............bbbbbb.............",
      ".............bbbbbb.............",
      ".............bbbbbb.............",
      "....cccccccccccccccccccccccc....",
      "....cccccccccccccccccccccccc....",
      "....cccccccccccccccccccccccc....",
      "....cccccccccccccccccccccccc....",
      "....dddddddddddddddddddddddd....",
      "....dddddddddddddddddddddddd....",
      "....dddddddddddddddddddddddd....",
      "....dddddddddddddddddddddddd....",
      "....cccccccccccccccccccccccc....",
      "....cccccccccccccccccccccccc....",
      "....cccccccccccccccccccccccc....",
      "....dddddddddddddddddddddddd....",
      "....dddddddddddddddddddddddd....",
      "....dddddddddddddddddddddddd....",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................"
    ],
    "palette": {
      "a": "#7ca78c",
      "b": "#d96779",
      "c": "#fff5dc",
      "d": "#e889a3"
    }
  },
  "cookie": {
    "rows": [
      "................................",
      "................................",
      "................................",
      "................................",
      ".........aaaaaaaaaaaaaa.........",
      ".........aaaaaaaaaaaaaa.........",
      ".........aaaaaaaaaaaaaa.........",
      ".....aaaaaaaaaaaaaaaaaaaaaa.....",
      ".....aaaaaaaaaaaaaaaaaaaaaa.....",
      ".....aaaaaaaaaaaaaaaaaaaaaa.....",
      ".....aaaaaabbbaaaaaaabbbaaa.....",
      ".....aaaaaabbbaaaaaaabbbaaa.....",
      ".....aaaaaabbbaaaaaaabbbaaa.....",
      ".....aaaaaaaaaaaaaaaaaaaaaa.....",
      ".....aaaaaaaaaaaaaaaaaaaaaa.....",
      ".....aaaaaaaaaaaaaaaaaaaaaa.....",
      ".....aaaaaaaaaaaaaaaaaaaaaa.....",
      ".....aaaaaaaaaaaaaaaaaaaaaa.....",
      ".....aaaaaaaaaaaabbbaaaaaaa.....",
      ".....aaaaaaaaaaaabbbaaaaaaa.....",
      ".....aaaaaaaaaaaabbbaaaaaaa.....",
      ".....aaaaaaaaaaaaaaaaaaaaaa.....",
      ".....aaaaabbbaaaaaaaaaabbba.....",
      ".....aaaaabbbaaaaaaaaaabbba.....",
      ".........abbbaaaaaaaaaabbb......",
      ".........aaaaaaaaaaaaaa.........",
      ".........aaaaaaaaaaaaaa.........",
      ".........aaaaaaaaaaaaaa.........",
      "................................",
      "................................",
      "................................",
      "................................"
    ],
    "palette": {
      "a": "#ce995f",
      "b": "#76513f"
    }
  },
  "milk": {
    "rows": [
      "................................",
      "................................",
      "..........aaaaaaaaaaa...........",
      ".........aaaaaaaaaaaaa..........",
      "........aaaaaaaaaaaaaaa.........",
      "........aaabbbbbbbbbaaa.........",
      ".......aaaabbbbbbbbbaaaa........",
      "......aaaaabbbbbbbbbaaaaa.......",
      "......aaaaaaaaaaaaaaaaaaa.......",
      "......aaaaaaaaaaaaaaaaaaa.......",
      "......aacccccccccccccccaa.......",
      "......aacccccccccccccccaa.......",
      "......aacccccccccccccccaa.......",
      "......aacccccccccccccccaa.......",
      "......aacccccccccccccccaa.......",
      "......aabbbbbbbbbbbbbbbaa.......",
      "......aabbbbbbbbbbbbbbbaa.......",
      "......aabbbbbbbbbbbbbbbaa.......",
      "......aabbbbbdddddbbbbbaa.......",
      "......aabbbbbdddddbbbbbaa.......",
      "......aabbbbbdddddbbbbbaa.......",
      "......aabbbbbdddddbbbbbaa.......",
      "......aabbbbbbbbbbbbbbbaa.......",
      "......aabbbbbbbbbbbbbbbaa.......",
      "......aacccccccccccccccaa.......",
      "......aacccccccccccccccaa.......",
      "......aacccccccccccccccaa.......",
      "......aacccccccccccccccaa.......",
      "......aaaaaaaaaaaaaaaaaaa.......",
      "......aaaaaaaaaaaaaaaaaaa.......",
      "................................",
      "................................"
    ],
    "palette": {
      "a": "#534655",
      "b": "#e889a3",
      "c": "#fff5dc",
      "d": "#fff"
    }
  },
  "berry": {
    "rows": [
      "................................",
      "................................",
      "..............aaaaa.............",
      "..............aaaaa.............",
      "..............aaaaa.............",
      "........aaaaaaaaaaa.............",
      "........aaaaaaaaaaaaaaaaa.......",
      "........aaaaaaaaaaaaaaaaa.......",
      "........aaaaaaaaaaaaaaaaa.......",
      "........aaaaaaaaaaaaaaaaa.......",
      "................................",
      ".....bbbbbbbbbbbbbbbbbbbbbb.....",
      ".....bbbbbbbbbbbbbbbbbbbbbb.....",
      ".....bbbbbbbbbbbbbbbbbbbbbb.....",
      ".....bbbbbccbbbbbbbbccbbbbb.....",
      ".....bbbbbccbbbbbbbbccbbbbb.....",
      ".....bbbbbbbbbbbbbbbbbbbbbb.....",
      ".....bbbbbbbbbbbbbbbbbbbbbb.....",
      ".....bbbbbbbbbbbbbbbbbbbbbb.....",
      ".....bbbbbbbbbbbbbbbbbbbbbb.....",
      ".........bbbbbbccbbbbbbb........",
      ".........bbbbbbccbbbbbbb........",
      ".........bbbbbbbbbbbbbbb........",
      ".........bbbbbbbbbbbbbbb........",
      ".........bbbbbbbbbbbbbbb........",
      ".............bbbbbbb............",
      ".............bbbbbbb............",
      ".............bbbbbbb............",
      ".............bbbbbbb............",
      "................................",
      "................................",
      "................................"
    ],
    "palette": {
      "a": "#7ca78c",
      "b": "#e57c90",
      "c": "#fff5dc"
    }
  },
  "ramen": {
    "rows": [
      "................................",
      "....................aa...aa.....",
      "....................aa...aa.....",
      "....................aa...aa.....",
      "....................aa...aa.....",
      "....................aa...aa.....",
      "....................aa...aa.....",
      "...............bbb..aa...aa.....",
      "...............bbb..aa...aa.....",
      ".........bbb...bbb..aabb.aa.....",
      ".........bbb...bbb..aabb.aa.....",
      ".........bbb...bbb...bbb........",
      ".........bbb...bbb...bbb........",
      "....cccccbbbcccbbbcccbbbcccc....",
      "....cccccccccccccccccccccccc....",
      "...dccccccccccccccccccccccccd...",
      "...dddddddddddddddddddddddddd...",
      "...dddddddddddddddddddddddddd...",
      "...dddddddddddddddddddddddddd...",
      "...dddddddddddddddddddddddddd...",
      "...dddddddddddddddddddddddddd...",
      "...dddddddddddddddddddddddddd...",
      ".......dddddddddddddddddd.......",
      ".......dddddddddddddddddd.......",
      ".......dddddddddddddddddd.......",
      ".......dddddddddddddddddd.......",
      ".......dddddddddddddddddd.......",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................"
    ],
    "palette": {
      "a": "#534655",
      "b": "#e4c075",
      "c": "#fff5dc",
      "d": "#e889a3"
    }
  },
  "pudding": {
    "rows": [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..........aaaaaaaaaaaaa.........",
      "..........aaaaaaaaaaaaa.........",
      ".........baaaaaaaaaaaaab........",
      ".........baaaaaaaaaaaaab........",
      ".........baaaaaaaaaaaaab........",
      "........bbbbbbbbbbbbbbbb........",
      "........bbbbbbbbbbbbbbbb........",
      "........bbbbbbbbbbbbbbbbb.......",
      "........bbbbbbbbbbbbbbbbb.......",
      ".......bbbbbbbbbbbbbbbbbb.......",
      ".......bbbbbbbbbbbbbbbbbb.......",
      ".......bbbbbbbbbbbbbbbbbbb......",
      ".......bbbbbbbbbbbbbbbbbbb......",
      "......bbbbbbbbbbbbbbbbbbbb......",
      "......bbbbbbbbbbbbbbbbbbbb......",
      "......bbbbbbbbbbbbbbbbbbbb......",
      ".....bbbbbbbbbbbbbbbbbbbbbb.....",
      ".....bbbbbbbbbbbbbbbbbbbbbb.....",
      "................................",
      "...ccccccccccccccccccccccccccc..",
      "...ccccccccccccccccccccccccccc..",
      "...ccccccccccccccccccccccccccc..",
      "................................",
      "................................",
      "................................"
    ],
    "palette": {
      "a": "#ad7658",
      "b": "#eccb80",
      "c": "#fff5dc"
    }
  },
  "tea": {
    "rows": [
      "................................",
      ".................aa.............",
      ".................aa.............",
      ".........aa......aa.............",
      ".........aa......aa.............",
      ".........aa......aa.............",
      ".........aa......aa.............",
      ".........aa.....................",
      "................................",
      "................................",
      "................................",
      ".....bbbbbbbbbbbbbbbbbbb........",
      ".....bbcccccccccccccccbb........",
      ".....bbcccccccccccccccbb........",
      ".....bbcccccccccccccccbbbbbbb...",
      ".....bbbbbbbbbbbbbbbbbbbbbbbb...",
      ".....bbbbbbbbbbbbbbbbbbbbbbbb...",
      ".....bbbbbbbbbbbbbbbbbbbddbbb...",
      ".....bbbbbbbbbbbbbbbbbbbddbbb...",
      ".....bbbbbbbbbbbbbbbbbbbddbbb...",
      ".....bbbbbbbbbbbbbbbbbbbddbbb...",
      ".....bbbbbbbbbbbbbbbbbbbbbbbb...",
      ".....bbbbbbbbbbbbbbbbbbbbbbbb...",
      ".....bbbbbbbbbbbbbbbbbbbbbbbb...",
      ".....bbbbbbbbbbbbbbbbbbb........",
      ".....bbbbbbbbbbbbbbbbbbb........",
      ".....bbbbbbbbbbbbbbbbbbb........",
      ".....bbbbbbbbbbbbbbbbbbb........",
      "................................",
      "................................",
      "................................",
      "................................"
    ],
    "palette": {
      "a": "#534655",
      "b": "#e889a3",
      "c": "#7f664c",
      "d": "#fff5dc"
    }
  }
};
  const FREE_FURN = ['window', 'curtain', 'frame', 'quote', 'clock', 'bed', 'chair', 'desk', 'shelf', 'plant', 'rug', 'cushion', 'bear', 'lamp', 'nightstand', 'roundtable', 'coffee', 'cake', 'sakura', 'tree', 'snowman'];
  const GIFTS = [[100, 'sofa'], [300, 'lights'], [500, 'tv'], [1000, 'canopy'], [1500, 'wardrobe'], [2000, 'vanity']];
  function mapSVG(def,c,flip){const cv=Canvas(def.rows[0].length,def.rows.length),pal={};const p=palette(c||'#c9a180');for(const[k,v]of Object.entries(def.palette))pal[k]=v[0]==='$'?p[v.slice(1)]:v;stamp(cv,flip?flipRows(def.rows):def.rows,0,0,pal);return toSVG(cv);}
  function furnSVG(type,c,flip){const F=FURN[type];if(!F)return'';const def=F.maps?F.maps[type==='clock'?'hour'+new Date().getHours()%12:weatherCache.mood+(weatherCache.night?'Night':'')]||F:F;return mapSVG(def,color(c,F.c),flip);}

  // 벽과 바닥도 역할 문자 타일 지도로 그려 펫과 같은 한 칸 격자를 써요.
  const WALL_TILE=['aaaawwww','aaaawwww','aaaawwww','aaaawwww'];
  const FLOOR_TILE=['ffffffffffffffffffff','ffffffffffhfffffffff','ffffffffffhfffffffff','ffffffffffhfffffffff','ffffffffffhfffffffff','dddddddddddddddddddd'];
  function roomBG(R){const wall=color(R.wall,'#FFE3D3'),floor=color(R.floor,'#E8B896'),cv=Canvas(RW,RH),pal={w:wall,a:shade(wall,.975),b:shade(wall,.78),f:floor,h:shade(floor,.95),d:shade(floor,.93)};for(let y=0;y<RH;y++)for(let x=0;x<RW;x++){const ch=y<FLOOR_Y-2?WALL_TILE[y%4][x%8]:y<=FLOOR_Y?'b':FLOOR_TILE[(y-FLOOR_Y-1)%6][x%20];cv.set(x,y,pal[ch]);}return toSVG(cv);}

  /* ---------- 작은 효과 그림 ---------- */
  const PARTICLES = {
    heart: ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
    drop: ['..B..', '.BBB.', 'BBBBB', 'BBWBB', '.BBB.'],
    anger: ['AA.AA', 'A...A', '.....', 'A...A', 'AA.AA'],
    note: ['...KK', '...K.', '...K.', '.KKK.', 'KKKK.', '.KK..'],
    z: ['KKKK', '..K.', '.K..', 'KKKK'],
    star: ['...Y...', '..YYY..', 'YYYYYYY', '.YYYYY.', '.Y...Y.'],
    sparkle: ['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..'],
    dots: ['K.K.K'],
  };
  function particleSVG(type) {
    const rows = PARTICLES[type] || PARTICLES.heart, w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    const pal = { R: '#FF4D7A', B: '#7EC8FF', W: '#FFFFFF', K: K, Y: '#FFD54A', A: '#E8504A' };
    return rectsSVG(w, h, (r) => rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && r(x, y, 1, 1, pal[ch]))));
  }

  /* ---------- 음식 아이콘 ---------- */
  function foodIcon(type){return mapSVG(FOOD_MAPS[type]||FOOD_MAPS.rice);}

  /* =========================================================
   * 데이터
   * ========================================================= */
  const KEY = 'mallangpet_v3', LEGACY = 'mallangpet_v1';
  const THEMES = {
    peach: ['살구 다락방', '#FFE3D3', '#E8B896', '#FFD9DF'],
    pink: ['핑크 공주방', '#FFE1EE', '#DCA2C1', '#FFD3E6'],
    forest: ['숲속 오두막', '#D9EBD3', '#A9C2A0', '#CFE8D5'],
    night: ['달빛 고딕방', '#4A4A66', '#6E6B8F', '#D9D0F0'],
    space: ['보랏빛 우주', '#D4CEF2', '#9C9AC6', '#E2DBFF'],
    retro: ['민트 컴퓨터', '#D5EEE6', '#9CC4BA', '#CDEFE6'],
  };
  const FOODS = { rice: ['주먹밥', 32, 1], cake: ['딸기 케이크', 18, 12], cookie: ['쿠키', 12, 8], milk: ['딸기 우유', 15, 4], berry: ['딸기', 10, 6], ramen: ['라면', 28, 5], pudding: ['푸딩', 16, 10], tea: ['따뜻한 차', 5, 4] };
  const TYPES = { sweet: '다정', cool: '무뚝뚝', tsun: '까칠', shy: '수줍음', playful: '장난꾸러기' };
  const LINES = {
    sweet: { hello: ['{user}, 오늘도 기다렸어.', '같이 있으니까 좋아.'], feed: ['고마워! 같이 먹자.', '냠냠, 맛있어!'], pet: ['조금만 더 쓰다듬어 줘.', '네 손 따뜻해.'], play: ['너랑 노는 게 제일 좋아!'], idle: ['오늘은 어떤 하루였어?', '옆에 있어 줄게.'] },
    cool: { hello: ['왔어? 자리 비워 뒀어.'], feed: ['…잘 먹을게.', '맛은 괜찮네.'], pet: ['…싫다고는 안 했어.'], play: ['한 판만 더 하자.'], idle: ['여기 있을게.', '무리하지 마.'] },
    tsun: { hello: ['이제 와? 딱히 기다리진 않았어.'], feed: ['흥, 이건 좀 맛있네.'], pet: ['머리 헝클어지잖아… 조금만 해.'], play: ['이번엔 내가 이길 거야!'], idle: ['왜. 그냥 보고 있었어.'] },
    shy: { hello: ['와, 왔구나…!'], feed: ['나 주는 거야? 고마워…'], pet: ['으응… 간지러워.'], play: ['같이 해도 돼…?'], idle: ['옆에 있어도 괜찮지?'] },
    playful: { hello: ['드디어 왔다! 심심해서 녹을 뻔!'], feed: ['한 입에 와앙!'], pet: ['쓰담 한 번에 하트 한 개!'], play: ['좋아! 오늘의 챔피언은 나!'], idle: ['오늘도 재미있는 일 없나~', '쿠션 밑에 보물 숨겨 둘까?'] },
  };
  // 내가 크랙에서 보낸 말에 대한 반응 (성격별)
  const HEARD = {
    sweet: { love: ['나도… 정말 좋아.', '그 말 한 번 더 해 줘.'], bad: ['무슨 일 있어? 내가 들어줄게.'], sad: ['울지 마. 내가 옆에 있잖아.'], food: ['같이 먹자, 응?'], sleep: ['푹 자. 꿈에서도 만나.'], hello: ['{user}, 왔구나!'], neutral: ['응응, 듣고 있어.', '그래서?'] },
    cool: { love: ['…알아. 나도.', '…그런 말 갑자기 하지 마.'], bad: ['…진정해.'], sad: ['…이리 와.'], food: ['먹을 거면 같이.'], sleep: ['자. 옆에 있을게.'], hello: ['왔어?'], neutral: ['…응.', '계속 말해.'] },
    tsun: { love: ['흐, 흥! 갑자기 뭐야…', '딱히 기쁜 건 아니거든?'], bad: ['뭐야, 왜 화났는데!'], sad: ['…울지 마. 신경 쓰이잖아.'], food: ['나도 줘. …달라는 거 아니고.'], sleep: ['빨리 자기나 해.'], hello: ['이제 와?'], neutral: ['흥.', '그래서 뭐.'] },
    shy: { love: ['으, 응…! 나, 나도…', '얼굴 뜨거워…'], bad: ['히익… 무, 무서워…'], sad: ['괜, 괜찮아…?'], food: ['나도 조금만…'], sleep: ['잘 자… 내 꿈 꿔…'], hello: ['와, 왔어…?'], neutral: ['(고개 끄덕)', '응…'] },
    playful: { love: ['헤헤, 나 좋아하지? 다 알아~', '한 번 더! 한 번 더!'], bad: ['워워, 진정진정~'], sad: ['울보네~ 이리 와, 안아줄게.'], food: ['나 한 입! 와앙!'], sleep: ['벌써 자? 재미없게~'], hello: ['드디어 왔다!'], neutral: ['오호?', '그래서 그래서?'] },
  };
  // 정실 답장 분위기에 대한 반응 (표정·효과)
  const OSHI_REACT = {
    love: { expr: 'love', fx: 'heart', tag: '(두근)' },
    laugh: { expr: 'happy', fx: 'note', tag: '(같이 웃음)' },
    shy: { expr: 'shy', fx: 'heart', tag: '(얼굴 빨개짐)' },
    angry: { expr: 'angry', fx: 'anger', tag: '(움찔)' },
    sad: { expr: 'sad', fx: 'drop', tag: '(훌쩍)' },
  };
  const MY_REACT = { love: ['love', 'heart'], bad: ['sad', 'anger'], sad: ['sad', 'drop'], food: ['happy', 'note'], sleep: ['sleep', 'z'], hello: ['happy', 'star'], neutral: [null, 'dots'] };

  // 단어 (띄어쓰기 지우고 찾아요. *지문*도 같이 읽어요)
  const MY_WORDS = {
    love: ['사랑', '좋아해', '좋아한', '보고싶', '귀여', '귀엽', '예뻐', '이뻐', '잘생', '멋져', '멋있', '고마워', '고맙', '최고', '설레', '두근', '안아', '안는', '안았', '껴안', '포옹', '뽀뽀', '키스', '입맞', '쓰다듬', '토닥', '손잡', '손을잡', '기대', '부비', '웃는다', '웃었', '미소', '헤헤', '히히', '♡', '❤', '자기야', '여보'],
    bad: ['싫어', '미워', '짜증', '꺼져', '닥쳐', '바보', '멍청', '죽여', '죽을래', '시발', '씨발', 'ㅅㅂ', '개새', '병신', '미친', '때리', '때린', '때렸', '밀쳐', '밀친', '노려', '화내', '화났', '나빠', '실망', '헤어지', '헤어져'],
    sad: ['울어', '울었', '운다', '울먹', '눈물', '훌쩍', '흑흑', 'ㅠㅠ', 'ㅜㅜ', '슬퍼', '슬프', '외로', '힘들', '아파', '아프'],
    food: ['먹어', '먹자', '먹여', '먹었', '밥', '간식', '맛있', '달달', '도넛', '케이크', '배고'],
    sleep: ['잘자', '졸려', '졸리', '자자', '잠들', '침대', '하품', '하암'],
    hello: ['안녕', '다녀왔', '왔어', '좋은아침', '굿모닝'],
  };
  const OSHI_WORDS = {
    love: ['사랑', '다정하게', '부드럽게', '키스', '입맞', '안아', '껴안', '끌어안', '쓰다듬', '귀여', '예쁘', '좋아해', '미소', '애틋', '소중'],
    laugh: ['웃음을터뜨', '웃었', '웃으며', '웃는', '낄낄', '킥킥', '깔깔', '폭소', '헛웃음', '피식'],
    shy: ['붉어', '빨개', '달아올', '시선을피', '헛기침', '머뭇', '귓불', '부끄', '수줍'],
    angry: ['화가', '화를', '짜증', '노려', '이를악', '쏘아붙', '신경질', '거칠게', '으르렁', '턱관절', '미간을찌푸', '혀를차', '쯧', '분노', '소리쳤', '버럭', '살기'],
    sad: ['눈물', '울었', '울먹', '흐느', '한숨', '슬픈', '슬프', '씁쓸', '떨리는목소리', '고개를숙', '쓸쓸'],
  };
  const NEG = /(안|못)(좋|예뻐|이뻐|귀여|귀엽|멋)|별로|안사랑/;
  function analyzeMine(raw) {
    const t = raw.replace(/\s+/g, '');
    const count = (k) => MY_WORDS[k].reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);
    const neg = NEG.test(t);
    const c = { love: neg ? 0 : count('love'), bad: count('bad') + (neg ? 1 : 0), sad: count('sad'), food: count('food'), sleep: count('sleep'), hello: count('hello') };
    if (c.bad && c.bad >= c.love) return 'bad';
    for (const k of ['love', 'sad', 'food', 'sleep', 'hello']) if (c[k]) return k;
    return 'neutral';
  }
  function analyzeOshi(raw) {
    const t = raw.replace(/\s+/g, '');
    let best = null, n = 0;
    for (const k of ['shy', 'love', 'laugh', 'angry', 'sad']) {
      const c = OSHI_WORDS[k].reduce((s, w) => s + t.split(w).length - 1, 0);
      if (c > n) { best = k; n = c; }
    }
    return best;
  }
  const MOODS = {
    sweet: { name: '달달함', icon: '☀️', color: '#FFD54A' },
    shy: { name: '설렘', icon: '🌸', color: '#FFB3CC' },
    storm: { name: '험악', icon: '🌧️', color: '#A9B4C8' },
    sad: { name: '눈물', icon: '❄️', color: '#9DB8E8' },
    calm: { name: '맑음', icon: '⛅', color: '#E4DAD6' },
  };
  function moodOf(rec) {
    if (!rec) return 'calm';
    const m = { sweet: rec.love || 0, shy: rec.shy || 0, storm: rec.bad || 0, sad: rec.sad || 0 };
    let best = 'calm', n = 0;
    for (const [k, v] of Object.entries(m)) if (v > n) { best = k; n = v; }
    return best;
  }

  /* =========================================================
   * 저장 데이터
   * ========================================================= */
  function freshPet() {
    return { name: '말랑이', born: Date.now(), stage: 'egg', xp: 0, chats: 0, day: { d: day(), chats: 0 }, hunger: 85, fun: 85, energy: 85, health: 100, clean: 90, bond: 0, sleeping: false,
      look: Object.assign({}, DEFAULT_LOOK), extra: copy(DEFAULT_EXTRA),
      profile: { type: 'sweet', user: '너', birthday: '', met: day(), symbol: '#EF8DA3', favorite: 'cake', dislike: '', lines: '' } };
  }
  function defaultRoom(){return{theme:'peach',wall:THEMES.peach[1],floor:THEMES.peach[2],items:[
    {id:uid(),type:'window',x:12,y:13,c:null,flip:false},{id:uid(),type:'curtain',x:8,y:11,c:null,flip:false},
    {id:uid(),type:'bed',x:119,y:69,c:null,flip:false},{id:uid(),type:'nightstand',x:106,y:60,c:null,flip:false},
    {id:uid(),type:'plant',x:9,y:68,c:null,flip:false},{id:uid(),type:'rug',x:53,y:94,c:null,flip:false}]};}
  const SETS = { front: FRONTS, back: BACKS, outfit: OUTFITS, wings: WINGS, tail: TAILS, mark: MARKS };
  function sanitizeAcc(list) {
    return (Array.isArray(list) ? list : []).slice(0, 16).filter((a) => a && ACC[a.type]).map((a) => ({
      id: /^[a-z0-9_-]{1,40}$/i.test(a.id) ? a.id : uid(), type: a.type,
      x: Math.round(clamp(a.x, -8, 31)), y: Math.round(clamp(a.y, -8, 31)), c: color(a.c, ACC[a.type].c), flip: !!a.flip,
    }));
  }
  function sanitizePet(v) {
    const p = freshPet(); if (!v || typeof v !== 'object') return p;
    p.name = text(v.name, '말랑이', 20) || '말랑이';
    p.born = Number.isFinite(v.born) ? clamp(v.born, 0, Date.now()) : Date.now();
    for (const k of ['hunger', 'fun', 'energy', 'health', 'clean']) p[k] = v[k] == null ? p[k] : clamp(v[k]);
    for (const k of ['xp', 'chats', 'bond']) p[k] = clamp(v[k], 0, 1e9);
    p.stage = ['egg', 'baby', 'child', 'adult'].includes(v.stage) ? v.stage : 'egg';
    p.sleeping = !!v.sleeping;
    p.day = { d: day(), chats: v.day && v.day.d === day() ? clamp(v.day.chats, 0, 1e6) : 0 };
    const look = Object.assign({}, v.look || {});
    const shapeAliases={square:'round',teardrop:'drop',sdHead:'sd',human:'sd',bean:'bean'};
    look.shape=shapeAliases[look.shape]||look.shape;
    if(look.eyes==='shiny')look.eyes='shine'; if(look.eyes==='droopy')look.eyes='droop'; if(look.mouth==='open')look.mouth='smile';
    const enums = { shape: SHAPES, top: TOPS, eyes: EYES, nose: NOSES, mouth: MOUTHS, cheeks: CHEEKS };
    for (const [k, obj] of Object.entries(enums)) if (Object.prototype.hasOwnProperty.call(obj, look[k])) p.look[k] = look[k];
    p.look.body = color(look.body, DEFAULT_LOOK.body);
    p.look.hair = isColor(look.hair) ? look.hair : null;
    p.look.eye = color(look.eye, DEFAULT_LOOK.eye);
    const ex = v.extra || {};
    for (const [k, obj] of Object.entries(SETS)) if (Object.prototype.hasOwnProperty.call(obj, ex[k])) p.extra[k] = ex[k];
    if (look.top === 'bangs' && p.extra.front === 'none') p.extra.front = 'straight';
    p.extra.cloth = color(ex.cloth, DEFAULT_EXTRA.cloth); p.extra.eye2 = color(ex.eye2, DEFAULT_EXTRA.eye2); p.extra.hetero = !!ex.hetero;
    const is32=ex.pixelVersion===32||Array.isArray(ex.pixels)&&ex.pixels.length===1024;
    let accs=Array.isArray(ex.accessories)?ex.accessories:[];
    if(!is32)accs=accs.map(a=>Object.assign({},a,{x:Math.round((a.x||0)*(v.__v3&&ex.model!==undefined?2/3:4/3)),y:Math.round((a.y||0)*(v.__v3&&ex.model!==undefined?2/3:4/3))}));
    p.extra.accessories=sanitizeAcc(accs);
    if(look.acc&&ACC[look.acc]&&!p.extra.accessories.length){const pos=defaultAccPos(look.acc,p);p.extra.accessories.push({id:uid(),type:look.acc,...pos,c:ACC[look.acc].c,flip:false});}
    p.extra.scars=(Array.isArray(ex.scars)?ex.scars:[]).slice(0,12).filter(a=>a&&SCARS[a.type]).map(a=>({id:/^[a-z0-9_-]{1,40}$/i.test(a.id)?a.id:uid(),type:a.type,side:a.side==='right'?'right':'left',color:a.color==='brown'?'brown':'pink'}));
    if(ex.mark==='scar'&&!p.extra.scars.some(a=>a.type==='eye'))p.extra.scars.push({id:uid(),type:'eye',side:'left',color:'pink'});
    if(Array.isArray(ex.pixels)&&ex.pixels.length===1024)p.extra.pixels=ex.pixels.map(c=>isColor(c)?c:null);
    else if(Array.isArray(ex.pixels)&&ex.pixels.length===576){for(let y=0;y<32;y++)for(let x=0;x<32;x++){const c=ex.pixels[Math.floor(y*24/32)*24+Math.floor(x*24/32)];p.extra.pixels[y*32+x]=isColor(c)?c:null;}}
    p.extra.pixelVersion=32;
    const pr = v.profile || {};
    p.profile = { type: TYPES[pr.type] ? pr.type : 'sweet', user: text(pr.user, '너', 20) || '너', birthday: /^\d{4}-\d\d-\d\d$/.test(pr.birthday) ? pr.birthday : '', met: /^\d{4}-\d\d-\d\d$/.test(pr.met) ? pr.met : day(), symbol: color(pr.symbol, '#EF8DA3'), favorite: FOODS[pr.favorite] ? pr.favorite : 'cake', dislike: FOODS[pr.dislike] ? pr.dislike : '', lines: text(pr.lines, '', 1200) };
    return p;
  }
  function sanitizeRoom(r, fromV3, from31 = false) {
    const d = defaultRoom(); if (!r || typeof r !== 'object') return d;
    d.theme = THEMES[r.theme] ? r.theme : 'peach';
    d.wall = color(r.wall, THEMES[d.theme][1]); d.floor = color(r.floor, THEMES[d.theme][2]);
    if (Array.isArray(r.items)) d.items = r.items.slice(0, 40).filter((a) => a && FURN[a.type]).map((a) => {
      const F = FURN[a.type];
      let x = a.x, y = a.y;
      if (from31) { x = Math.round(x * 4/3); y = Math.round(y * 4/3); }
      if (fromV3) { x = Math.round(a.x * 1.6 - F.w / 2); y = Math.round(a.y * 1.12 - F.h * 0.7); y = F.wall ? clamp(y, 2, FLOOR_Y - F.h) : clamp(y, FLOOR_Y - F.h + 6, RH - F.h); }
      return { id: /^[a-z0-9_-]{1,40}$/i.test(a.id) ? a.id : uid(), type: a.type, x: Math.round(clamp(x, -F.w + 4, RW - 4)), y: Math.round(clamp(y, -F.h + 4, RH - 4)), c: isColor(a.c) ? a.c : null, flip: !!a.flip };
    });
    return d;
  }
  function normalize(v) {
    const d = { v: 3, ver: 32, active: 0, pets: [freshPet()], room: defaultRoom(), buddy: -1, mode: 'cozy', last: Date.now(), hidden: false, pos: { x: 0.9, y: 0.78 }, scale: 60, react: true, walk: true, bubbles: true, album: [], presets: [], quotes: [], hung: null, days: {}, unlocked: [], gifted: [] };
    if (!v || typeof v !== 'object') return d;
    const fromV3 = v.v === 3 && v.ver !== 31 && v.ver !== 32;
    const from31 = v.ver === 31;
    const mark = (p) => (fromV3 && p ? Object.assign({}, p, { __v3: true }) : p);
    d.pets = Array.isArray(v.pets) && v.pets.length ? v.pets.slice(0, 8).map((p) => sanitizePet(mark(p))) : [sanitizePet(v)];
    d.active = Math.floor(clamp(v.active, 0, d.pets.length - 1));
    d.room = sanitizeRoom(v.room, fromV3, from31);
    d.buddy = Number.isInteger(v.buddy) && v.buddy >= 0 && v.buddy < d.pets.length && v.buddy !== d.active ? v.buddy : -1;
    d.mode = v.mode === 'care' ? 'care' : 'cozy';
    d.last = Number.isFinite(v.last) ? Math.min(v.last, Date.now()) : Date.now();
    d.hidden = !!v.hidden;
    d.pos = { x: clamp(v.pos && v.pos.x != null ? v.pos.x : 0.9, 0, 1), y: clamp(v.pos && v.pos.y != null ? v.pos.y : 0.78, 0, 1) };
    d.scale = clamp(v.scale != null ? v.scale : 60, 40, 100);
    d.react = v.react !== false; d.walk = v.walk !== false; d.bubbles = v.bubbles !== false;
    d.album = Array.isArray(v.album) ? v.album.slice(-150).filter((a) => a && typeof a.note === 'string').map((a) => ({ at: clamp(a.at, 0, Date.now()), note: text(a.note, '', 250) })) : [];
    d.presets = Array.isArray(v.presets) ? v.presets.slice(0, 12).map((a) => ({ name: text(a.name, '내 컬렉션', 30), pet: sanitizePet(mark(a.pet)), room: sanitizeRoom(a.room, fromV3, from31) })) : [];
    d.quotes = Array.isArray(v.quotes) ? v.quotes.slice(0, 60).filter((q) => q && typeof q.text === 'string').map((q) => ({ id: /^[a-z0-9]{1,20}$/i.test(q.id) ? q.id : uid(), text: text(q.text, '', 300), who: text(q.who, '', 30), at: clamp(q.at, 0, Date.now()) })) : [];
    d.hung = d.quotes.some((q) => q.id === v.hung) ? v.hung : null;
    if (v.days && typeof v.days === 'object') Object.entries(v.days).slice(-400).forEach(([k, r]) => { if (/^\d{4}-\d\d-\d\d$/.test(k) && r) d.days[k] = { c: clamp(r.c, 0, 1e6), love: clamp(r.love, 0, 1e6), bad: clamp(r.bad, 0, 1e6), sad: clamp(r.sad, 0, 1e6), shy: clamp(r.shy, 0, 1e6) }; });
    d.unlocked = Array.isArray(v.unlocked) ? v.unlocked.filter((t) => FURN[t]) : [];
    d.gifted = Array.isArray(v.gifted) ? v.gifted.filter((n) => GIFTS.some((g) => g[0] === n)) : [];
    if (v.lastGift && FURN[v.lastGift.t]) d.lastGift = { t: v.lastGift.t, at: clamp(v.lastGift.at, 0, Date.now()) };
    return d;
  }
  const getRaw = (k) => { try { const v = typeof GM_getValue === 'function' ? GM_getValue(k, null) : localStorage.getItem(k); return typeof v === 'string' ? JSON.parse(v) : v; } catch (e) { return null; } };

  /* =========================================================
   * 상태
   * ========================================================= */
  const previous = getRaw(KEY);
  let state = normalize(previous || getRaw(LEGACY));
  let saveError = false;
  function save() {
    try {
      const s = JSON.stringify(state);
      if (typeof GM_setValue === 'function') GM_setValue(KEY, s); else localStorage.setItem(KEY, s);
      saveError = false; return true;
    } catch (e) { saveError = true; console.warn('[말랑펫] 저장 실패', e); toast('저장 공간이 부족해요. 설정에서 백업을 내려받아 주세요.'); return false; }
  }
  const pet = () => state.pets[state.active];
  const today = () => { const d = day(); if (!state.days[d]) { state.days[d] = { c: 0, love: 0, bad: 0, sad: 0, shy: 0 }; const keys = Object.keys(state.days).sort(); while (keys.length > 400) delete state.days[keys.shift()]; } return state.days[d]; };
  const totalChats = () => state.pets.reduce((n, p) => n + (p.chats || 0), 0);
  const isUnlocked = (t) => FREE_FURN.includes(t) || state.unlocked.includes(t);
  const log = (note) => { state.album.push({ at: Date.now(), note }); state.album = state.album.slice(-150); };
  const fill = (s) => s.replaceAll('{user}', pet().profile.user).replaceAll('{name}', pet().name);
  const line = (k) => { const p = pet(), custom = p.profile.lines.split('\n').map((s) => s.trim()).filter(Boolean); return fill(k === 'idle' && custom.length && Math.random() < 0.6 ? pick(custom) : pick((LINES[p.profile.type] || LINES.sweet)[k] || LINES.sweet.idle)); };
  const daysSince = (d) => Math.max(1, Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000) + 1);

  function refreshWeather() { weatherCache = { mood: moodOf(state.days[day()]), night: (() => { const h = new Date().getHours(); return h >= 19 || h < 6; })() }; }

  function unlockSeasonal() {
    const m = new Date().getMonth() + 1, md = day().slice(5);
    Object.entries(FURN).forEach(([t, F]) => { if (F.season && !state.unlocked.includes(t)) { state.unlocked.push(t); /* 계절 가구는 처음부터 제공 */ } });
    const special = state.pets.some((p) => (p.profile.birthday && p.profile.birthday.slice(5) === md) || (p.profile.met && p.profile.met.slice(5) === md && p.profile.met !== day()));
    if (special && !state.unlocked.includes('balloons')) { state.unlocked.push('balloons'); log('생일·기념일 선물로 풍선을 받았어요.'); }
  }
  function checkGifts() {
    const n = totalChats(); let got = null;
    GIFTS.forEach(([need, t]) => { if (n >= need && !state.gifted.includes(need)) { state.gifted.push(need); if (!state.unlocked.includes(t)) state.unlocked.push(t); got = t; log(`대화 ${need}번 달성! '${FURN[t].name}'을(를) 선물 받았어요.`); state.lastGift = { t, at: Date.now() }; } });
    return got;
  }

  function simulate() {
    const now = Date.now(), h = clamp((now - state.last) / 3600000, 0, state.mode === 'cozy' ? 0 : 12);
    state.last = now;
    for (const p of state.pets) {
      if (p.day.d !== day()) p.day = { d: day(), chats: 0 };
      if (state.mode === 'care' && h > 0) {
        p.hunger = clamp(p.hunger - h * 3); p.fun = clamp(p.fun - h * 2); p.energy = clamp(p.energy + (p.sleeping ? 18 : -2) * h); p.clean = clamp(p.clean - h * 1.5);
        p.health = clamp(p.health + (Math.min(p.hunger, p.fun, p.energy) < 15 ? -2 : 1) * h, 20, 100);
        if (p.energy >= 100) p.sleeping = false;
      }
      const hours = (now - p.born) / 3600000 + p.xp * CONFIG.chatGrowHours;
      const s = hours < CONFIG.hatchMinutes / 60 ? 'egg' : hours < 24 ? 'baby' : hours < 72 ? 'child' : 'adult';
      if (s !== p.stage) { if (p === pet() && p.stage !== s && s !== 'egg') growFx = true; p.stage = s; }
    }
    unlockSeasonal(); refreshWeather();
  }
  let growFx = false;

  /* =========================================================
   * 화면 (레트로 게임기 스타일)
   * ========================================================= */
  const CSS = `
  :host{all:initial}*{box-sizing:border-box;margin:0}
  *{font-family:"Apple SD Gothic Neo","Pretendard","Noto Sans KR","Malgun Gothic",sans-serif}
  button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer;-webkit-tap-highlight-color:transparent}button:disabled{opacity:.45;cursor:default}
  svg{display:block;width:100%;height:100%}[hidden]{display:none!important}
  :focus-visible{outline:3px solid #7cc7c0;outline-offset:2px}
  .walker{position:fixed;width:var(--sz);height:var(--sz);padding:0;border:0;background:transparent;touch-action:none;z-index:3;filter:drop-shadow(0 2px 0 rgba(74,59,68,.25))}
  .walker .wk{width:100%;height:100%;pointer-events:none}
  .walker.left .wk svg{transform:scaleX(-1)}
  .walker.walking .wk{animation:waddle .5s steps(2) infinite}
  .walker.hop .wk{animation:hop .45s steps(3) 2}
  .walker.sleeping .wk{animation:none}
  .wfx{position:fixed;width:16px;height:16px;pointer-events:none;z-index:4;animation:floatup 1.4s steps(7) forwards}
  .wbub{position:fixed;z-index:4;max-width:190px;padding:5px 9px;background:#fff8ef;border:2px solid ${K};border-radius:7px;font-size:12px;font-weight:700;color:${K};line-height:1.35;pointer-events:none;box-shadow:0 2px 0 ${K};transform:translate(-50%,-100%);word-break:keep-all;white-space:pre-line}
  .wbub:after{content:"";position:absolute;left:50%;bottom:-6px;width:7px;height:7px;margin-left:-4px;background:#fff8ef;border-right:2px solid ${K};border-bottom:2px solid ${K};transform:rotate(45deg)}
  @keyframes waddle{0%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-3px) rotate(3deg)}}
  @keyframes hop{50%{transform:translateY(-10px)}}
  @keyframes floatup{0%{opacity:0;transform:translateY(4px)}20%{opacity:1}100%{opacity:0;transform:translateY(-34px)}}
  @keyframes bob{50%{transform:translateY(-2px)}}
  .veil{position:fixed;inset:0;background:rgba(40,30,40,.35)}
  .panel{position:fixed;right:16px;bottom:16px;width:400px;max-height:calc(100dvh - 32px);display:flex;flex-direction:column;background:var(--paper);color:${K};border:3px solid ${K};border-radius:12px;box-shadow:0 5px 0 ${K};overflow:hidden;font-size:13px;line-height:1.5}
  .top{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--head);border-bottom:3px solid ${K};flex:none}
  .top .t{flex:1;min-width:0}.title{font-size:17px;font-weight:900;letter-spacing:-.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sub{font-size:11px;opacity:.75}
  .ic{width:36px;height:36px;border:2px solid ${K};border-radius:9px;background:var(--paper);font-weight:900;font-size:16px;display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 2px 0 ${K}}
  .ic:active,.btn:active,.act:active,.tile:active{transform:translateY(2px);box-shadow:none}
  .content{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:10px 12px 14px}
  .nav{display:flex;border-top:3px solid ${K};background:var(--paper);flex:none}
  .nav button{flex:1;border:0;background:transparent;padding:7px 0 6px;font-size:11px;font-weight:800}
  .nav button i{display:block;font-style:normal;font-size:15px;line-height:1.3}
  .nav button.on{background:${K};color:var(--paper)}
  .toast{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);background:${K};color:#fff8ef;font-size:12px;font-weight:700;padding:6px 12px;border-radius:8px;z-index:200;white-space:nowrap;max-width:90%;overflow:hidden;text-overflow:ellipsis}
  .scene{position:relative;border:3px solid ${K};border-radius:8px;overflow:hidden;aspect-ratio:${RW}/${RH};touch-action:pan-y;user-select:none;-webkit-user-select:none}
  .scene .bg{position:absolute;inset:0}
  .item{position:absolute;padding:0;border:0;background:transparent;touch-action:none}
  .item svg{pointer-events:none}
  .edit .item{outline:1px dashed rgba(74,59,68,.25)}
  .item.sel{outline:2px dashed ${K};outline-offset:1px}
  .item.locked{opacity:.4}
  .actor{position:absolute;width:${(32 / RW) * 100}%;height:${(32 / RH) * 100}%;padding:0;border:0;background:transparent;transition:left 2s steps(10),top 2s steps(10)}
  .actor svg{pointer-events:none;animation:bob 2.4s steps(2) infinite}
  .actor.left svg{transform:scaleX(-1);animation:none}
  .actor.hop svg{animation:hop .45s steps(3) 2}
  .actor.sleep svg{animation:none}
  .edit .actor{opacity:.55;pointer-events:none}
  .speech{position:absolute;z-index:300;transform:translate(-50%,-100%);max-width:72%;padding:4px 9px;background:#fff;border:2px solid ${K};border-radius:7px;font-size:11.5px;font-weight:700;line-height:1.4;text-align:center;pointer-events:none;word-break:keep-all;white-space:pre-line}
  .speech:after{content:"";position:absolute;left:50%;bottom:-6px;width:7px;height:7px;margin-left:-4px;background:#fff;border-right:2px solid ${K};border-bottom:2px solid ${K};transform:rotate(45deg)}
  .sfx{position:absolute;width:5%;aspect-ratio:1;pointer-events:none;z-index:310;animation:floatup 1.4s steps(7) forwards}
  .zz{position:absolute;width:3.5%;aspect-ratio:1;z-index:305;pointer-events:none;animation:floatup 2.4s steps(6) infinite}
  .prop{position:absolute;width:${(32/RW)*100}%;height:${(32/RH)*100}%;z-index:305;pointer-events:none;animation:hop .5s steps(3) 3}
  .strip{display:flex;align-items:center;gap:6px;margin-top:8px;padding:6px 10px;background:#fff;border:2px solid ${K};border-radius:8px;font-size:12px}
  .strip b{color:#E8618A}.strip span.r{margin-left:auto;font-size:11px;opacity:.7;white-space:nowrap}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 10px;margin-top:9px}
  .st{font-size:11px;font-weight:800}.st em{float:right;font-style:normal;font-weight:400;opacity:.7}
  .seg{display:flex;gap:2px;margin-top:3px}.seg i{flex:1;height:7px;background:#EADCD8;border-radius:1px}.seg i.on{background:var(--c)}
  .acts{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:9px}
  .act{border:2px solid ${K};border-radius:9px;background:#fff;padding:5px 0 4px;text-align:center;font-size:11.5px;font-weight:800;box-shadow:0 2px 0 ${K};min-height:48px}
  .act i{display:block;font-style:normal;font-size:16px;line-height:1.25}
  .act.on{background:${K};color:#fff8ef}
  .tray{margin-top:8px;padding:8px;border:2px solid ${K};border-radius:9px;background:#fff}
  .gift{display:flex;align-items:center;gap:8px;margin-top:9px;padding:7px 10px;border:2px dashed #E8A0B4;border-radius:9px;background:#FFF2F5;font-size:12px}
  .gift b{background:${K};color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;flex:none}
  .pbar{height:10px;border:2px solid ${K};border-radius:3px;margin-top:4px;background:#fff;overflow:hidden}.pbar i{display:block;height:100%;background:repeating-linear-gradient(90deg,#FF8FB1 0 6px,#FF9DBB 6px 8px)}
  .card{background:#fff;border:2px solid ${K};border-radius:10px;padding:10px 12px;margin-top:10px}
  .h{font-size:14px;font-weight:900;display:flex;align-items:center;gap:6px;margin-bottom:8px}.h:before{content:"";width:8px;height:8px;background:#E8618A;flex:none}
  .h small{margin-left:auto;font-size:11px;font-weight:400;opacity:.7}
  .lbl{display:block;font-size:11px;font-weight:800;margin:9px 0 5px;opacity:.85}
  .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .btn{border:2px solid ${K};border-radius:8px;background:#fff;padding:5px 10px;min-height:34px;font-size:12px;font-weight:800;box-shadow:0 2px 0 ${K}}
  .btn.on,.btn.pri{background:${K};color:#fff8ef}
  .btn.sm{min-height:30px;padding:3px 8px}
  .chips{display:flex;gap:5px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:none}.chips::-webkit-scrollbar{display:none}
  .chips .btn{flex:none}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  .tile{position:relative;min-width:0;border:2px solid transparent;border-radius:9px;background:#fff;padding:4px 2px 5px;font-size:11px;font-weight:700;text-align:center}
  .tile.on{border-color:${K};background:var(--head)}
  .tile .pic{width:52px;height:52px;margin:0 auto 2px}
  .tile .fur{height:44px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:3px}
  .tile .fur div{height:100%}
  .tile .lock{position:absolute;inset:0;border-radius:7px;background:rgba(255,248,239,.84);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;padding:4px;line-height:1.25;white-space:pre-line}
  .preview{position:sticky;top:-10px;z-index:5;height:128px;display:flex;align-items:flex-end;justify-content:center;background:var(--head);border:2px solid ${K};border-radius:9px}
  .preview div{width:116px;height:116px}
  input[type=text],input[type=date],textarea,select{width:100%;padding:7px 9px;border:2px solid ${K};border-radius:8px;background:#fff;min-height:38px;font-size:16px}
  textarea{resize:vertical;min-height:70px}
  .sw{width:32px;height:32px;border-radius:8px;border:2px solid ${K};padding:0;flex:none;position:relative;overflow:hidden}
  .sw.on{box-shadow:0 0 0 3px #7CC7C0}
  .sw.custom{background:conic-gradient(#ff6b6b,#ffd93d,#6bcb77,#4d96ff,#c77dff,#ff6b6b)}
  .sw.custom input{position:absolute;inset:-8px;width:52px;height:52px;opacity:0;cursor:pointer;border:0;padding:0}
  .sw.same{width:auto;padding:0 8px;font-size:11px;font-weight:800;background:#fff}
  .tog{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px dashed #E3D3CF;font-size:13px;font-weight:700}
  .tog input{width:22px;height:22px;accent-color:#E8618A}
  .muted{font-size:11px;opacity:.65;margin-top:6px;line-height:1.6}
  .cal{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;max-width:300px;margin:0 auto}
  .cal div{aspect-ratio:1;border-radius:4px;background:#F3EBE8;font-size:9.5px;display:flex;align-items:center;justify-content:center;font-weight:700}
  .cal .wk{background:transparent;font-size:10px;opacity:.6;aspect-ratio:auto;padding-bottom:2px}
  .cal .now{outline:2px dashed ${K}}.cal .blank{background:transparent}
  .legend{display:flex;gap:8px;flex-wrap:wrap;font-size:10.5px;margin-top:6px}.legend span:before{content:"";display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--c);margin-right:3px;vertical-align:-1px}
  .quote{border:3px solid #E0B65A;background:#FFF8EC;border-radius:4px;padding:8px 10px;font-size:13px;line-height:1.5;margin-top:6px}
  .quote small{display:block;font-size:11px;opacity:.6;margin-top:3px}
  .quote.hung{border-color:#E8618A}
  .pcard{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed #E3D3CF}
  .pcard .pic{width:44px;height:44px;flex:none}.pcard .info{flex:1;min-width:0;font-size:12px}
  .rec{padding:7px 0;border-bottom:1px dashed #E3D3CF;font-size:12px}.rec small{display:block;opacity:.55;font-size:10px}
  .paintwrap{position:relative;width:240px;max-width:100%;aspect-ratio:1;margin:8px auto 0;border:2px solid ${K};background:repeating-conic-gradient(#EFE6E2 0 25%,#fff 0 50%) 0/20px 20px}
  .paintwrap .under{position:absolute;inset:0;opacity:.45;pointer-events:none}
  .paint{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;touch-action:none}
  .pad{display:grid;grid-template-columns:repeat(3,36px);gap:4px;justify-content:center}
  .foot{text-align:center;font-size:11px;opacity:.6;margin-top:14px;line-height:1.6}
  .upload{display:none}
  svg{image-rendering:pixelated}.scene{box-sizing:content-box;width:calc(100% - 6px)} .btn,.btn.sm,.ic,.nav button{min-height:44px}.ic{width:44px;height:44px}.sw{width:44px;height:44px}.sw.custom input{width:66px;height:66px}.tog{min-height:44px}.pad{grid-template-columns:repeat(3,44px)}.tile{min-height:76px}.item:after,.actor:after{content:'';position:absolute;left:50%;top:50%;width:max(100%,44px);height:max(100%,44px);transform:translate(-50%,-50%)}.item:after{pointer-events:auto}.preview{height:116px}.preview div{width:108px;height:108px}.paintwrap{width:320px;max-width:100%}.actor{transition:left 2s steps(24,end),top 2s steps(24,end)}.actor svg,.walker.walking .wk{animation:none}.sprite-a{animation:spriteA 1.2s steps(1,end) infinite}.sprite-b{visibility:visible!important;animation:spriteB 1.2s steps(1,end) infinite}.walking .sprite-a,.actor.walk .sprite-a{animation-duration:.4s}.walking .sprite-b,.actor.walk .sprite-b{animation-duration:.4s}@keyframes spriteA{0%,49.99%{opacity:1}50%,100%{opacity:0}}@keyframes spriteB{0%,49.99%{opacity:0}50%,100%{opacity:1}}
  @media(max-width:520px){.panel{left:6px;right:6px;bottom:6px;width:auto;max-height:calc(100dvh - 12px)}}
  @media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}
  `;

  const host = document.createElement('div');
  host.id = 'mallangpet-host';
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>
  <button class="walker" aria-label="말랑펫 열기"><div class="wk"></div></button>
  <div class="wbub" hidden></div>
  <div class="app" hidden><div class="veil"></div>
    <section class="panel" role="dialog" aria-label="말랑펫">
      <header class="top"><div class="t"><div class="title"></div><div class="sub"></div></div>
        <button class="ic" data-do="settings" aria-label="설정">≡</button><button class="ic" data-do="close" aria-label="닫기">×</button></header>
      <main class="content"></main>
      <div class="toast" hidden></div>
      <nav class="nav"></nav>
    </section></div>`;
  (document.body || document.documentElement).appendChild(host);
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const main = $('.content'), walkerEl = $('.walker'), wbub = $('.wbub');
  const appOpen = () => !$('.app').hidden;

  let view = 'home', tab = 'body', homeSheet = null, roomEdit = false, selected = null, selAcc = null;
  let expr = 'normal', exprUntil = 0, sayUntil = 0, photoExpr = 'happy', pose = 'stand';
  let actor = { x: 67, y: 98, face: 1, mood: '' };
  let paintColor = '#EF8DA3', erasing = false, paintUndo = [], deleteArmed = false, pendingImport = null, lastAction = 0;

  let toastTimer;
  function toast(t) { const el = $('.toast'); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600); }

  function getExpr() {
    const p = pet();
    if (Date.now() < exprUntil) return expr;
    if (p.sleeping) return 'sleep';
    if (p.health < 40) return 'sick';
    if (p.hunger < 25 || p.fun < 25) return 'sad';
    return 'normal';
  }
  function setExpr(e, ms = 3200) { if (!e) return; expr = e; exprUntil = Date.now() + ms; setTimeout(refreshActors, ms + 60); }

  /* ---------- 방 장면 ---------- */
  const pctX = (x) => `${(x / RW) * 100}%`, pctY = (y) => `${(y / RH) * 100}%`;
  function sceneHTML(edit) {
    const R = state.room, p = pet();
    const items = R.items.map((a) => {
      const F = FURN[a.type]; if (!F) return '';
      const z = F.wall ? 2 + R.items.indexOf(a) : 100 + a.y + F.h;
      return `<button class="item ${selected === a.id ? 'sel' : ''}" data-item="${a.id}" aria-label="${esc(F.name)}" style="left:${pctX(a.x)};top:${pctY(a.y)};width:${pctX(F.w)};height:${pctY(F.h)};z-index:${z}">${furnSVG(a.type, a.c, a.flip)}</button>`;
    }).join('');
    const buddy = state.buddy >= 0 ? `<button class="actor buddy" data-do="pair" aria-label="함께 있는 친구" style="left:${pctX(actor.x + 8)};top:${pctY(actor.y - 31)};z-index:${100 + actor.y}">${drawPet(state.pets[state.buddy], 'happy')}</button>` : '';
    return `<div class="scene ${edit ? 'edit' : ''}"><div class="bg">${roomBG(R)}</div>${items}
      <button class="actor main" data-do="petpet" aria-label="${esc(p.name)} 쓰다듬기" style="left:${pctX(actor.x - 16)};top:${pctY(actor.y - 31)};z-index:${101 + actor.y}">${drawPet(p, getExpr())}</button>${buddy}
      <div class="speech" hidden></div></div>`;
  }
  function refreshActors() {
    const p = pet(), e = getExpr();
    const a = $('.actor.main');
    if (a) {
      a.innerHTML = drawPet(p, view === 'album' ? photoExpr : e, actor.mood === 'walk' ? 'walk' : 'idle');
      a.style.left = pctX(actor.x - 16); a.style.top = pctY(actor.y - 31); a.style.zIndex = 101 + actor.y;
      a.className = 'actor main' + (actor.face < 0 ? ' left' : '') + (p.sleeping ? ' sleep' : '') + (actor.mood ? ' ' + actor.mood : '');
      let zz = $('.scene .zz');
      if (p.sleeping && !zz) { zz = document.createElement('div'); zz.className = 'zz'; zz.innerHTML = particleSVG('z');zz.style.width=pctX(4);zz.style.height=pctY(4);a.parentElement.appendChild(zz); }
      if (zz) { if (!p.sleeping) zz.remove(); else { zz.style.left = pctX(actor.x + 5); zz.style.top = pctY(actor.y - 34); } }
      const b = $('.actor.buddy'); if (b) { b.style.left = pctX(actor.x + 8); b.style.top = pctY(actor.y - 31); }
    }
    const sp = $('.speech'); if (sp && Date.now() > sayUntil) sp.hidden = true;
    walkerEl.querySelector('.wk').innerHTML = drawPet(p, e, walker.mode === 'walk' ? 'walk' : 'idle');
    walkerEl.classList.toggle('sleeping', !!p.sleeping);
  }
  function sceneFx(type) {
    const s = $('.scene'); if (!s) return;
    const el = document.createElement('div'); el.className = 'sfx'; el.innerHTML = particleSVG(type);const rows=PARTICLES[type]||PARTICLES.heart;el.style.width=pctX(Math.max(...rows.map(r=>r.length)));el.style.height=pctY(rows.length);
    el.style.left = pctX(actor.x - 2 + Math.random() * 6); el.style.top = pctY(actor.y - 36);
    s.appendChild(el); setTimeout(() => el.remove(), 1500);
  }
  function hop() { actor.mood = 'hop'; refreshActors(); setTimeout(() => { actor.mood = ''; refreshActors(); }, 950); }
  function say(s, ex, fx) {
    if (ex) setExpr(ex);
    sayUntil = Date.now() + 4200;
    const sp = $('.speech');
    if (sp && appOpen()) { sp.textContent = s; sp.hidden = false; sp.style.left = pctX(clamp(actor.x, 26, 94)); sp.style.top = pctY(actor.y - 33); }
    if (fx) sceneFx(fx);
    refreshActors();
  }

  /* ---------- 공용 조각 ---------- */
  const btn = (label, act, val, cls = 'btn') => `<button class="${cls}" data-do="${act}"${val != null ? ` data-val="${esc(val)}"` : ''}>${label}</button>`;
  const chip = (label, path, val, cur) => `<button class="btn sm ${String(cur) === String(val) ? 'on' : ''}" data-pick="${path}" data-val="${esc(val)}">${esc(label)}</button>`;
  const seg = (v) => { const n = Math.round(clamp(v) / 10); return `<div class="seg">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`; };
  function swatches(path, list, cur, allowSame) {
    return `<div class="row">${allowSame ? `<button class="sw same ${!cur ? 'on' : ''}" data-pick="${path}" data-val="null">몸이랑 같게</button>` : ''}${list.map((c) => `<button class="sw ${cur && cur.toLowerCase() === c.toLowerCase() ? 'on' : ''}" style="background:${c}" data-pick="${path}" data-val="${c}" aria-label="${c}"></button>`).join('')}<label class="sw custom ${cur && !list.some((c) => c.toLowerCase() === cur.toLowerCase()) ? 'on' : ''}" title="직접 고르기"><input type="color" data-set="${path}" value="${color(cur, '#ffc8b4')}"></label></div>`;
  }

  /* ---------- 방(홈) ---------- */
  function statsHTML() {
    const p = pet();
    const bondLv = Math.floor(p.bond / 10) + 1;
    const list = [['hunger', '배부름', '#FF9F43'], ['fun', '기분', '#FF6F91'], ['energy', '기운', '#F2C400'], ['health', '건강', '#4CC38A'], ['clean', '청결', '#6AAEF0']];
    return `<div class="stats">${list.map(([k, n, c]) => `<div class="st" style="--c:${c}">${n}<em>${Math.round(p[k])}</em>${seg(p[k])}</div>`).join('')}<div class="st" style="--c:#C48BEA">친밀도<em>Lv.${bondLv}</em>${seg((p.bond % 10) * 10)}</div></div>`;
  }
  function giftHTML() {
    const n = totalChats(), next = GIFTS.find(([need]) => !state.gifted.includes(need));
    if (state.lastGift && Date.now() - state.lastGift.at < 3 * 86400000) return `<div class="gift"><b>선물</b><span>대화 기념으로 <u>${esc(FURN[state.lastGift.t].name)}</u>을(를) 받았어요! 가구 탭에서 놓아 보세요.</span></div>`;
    if (!next) return `<div class="gift"><b>완료</b><span>기념 가구를 모두 모았어요. 대화 ${n}번!</span></div>`;
    const prev = [...GIFTS].reverse().find(([need]) => need <= n);
    const from = prev ? prev[0] : 0;
    return `<div class="gift" style="display:block"><div class="row" style="justify-content:space-between"><span><b>다음 선물</b> 대화 ${next[0]}번 → <strong style="color:#E8618A">${esc(FURN[next[1]].name)}</strong></span><span style="font-size:11px;opacity:.7">${n}/${next[0]}</span></div><div class="pbar"><i style="width:${clamp(((n - from) / (next[0] - from)) * 100)}%"></i></div></div>`;
  }
  function home() {
    const p = pet(), rec = state.days[day()] || {}, mood = MOODS[weatherCache.mood];
    const acts = [['food', '🍙', '밥'], ['play', '🎾', '놀기'], ['wash', '🫧', '씻기'], ['sleep', p.sleeping ? '☀️' : '🌙', p.sleeping ? '깨우기' : '재우기'], ['more', '⋯', '더 보기']];
    let tray = '';
    if (homeSheet === 'food') tray = `<div class="tray"><div class="grid">${Object.entries(FOODS).map(([k, v]) => `<button class="tile" data-food="${k}"><div class="pic" style="width:36px;height:36px">${foodIcon(k)}</div>${v[0]}${p.profile.favorite === k ? '<div style="font-size:9px;color:#E8618A">최애 음식</div>' : ''}</button>`).join('')}</div><div class="muted">누르거나 펫에게 끌어다 주세요.</div></div>`;
    if (homeSheet === 'more') tray = `<div class="tray"><div class="row">${[['pet', '쓰다듬기'], ['hug', '안아주기'], ['brush', '빗질'], ['gift', '선물하기'], ['med', '약 주기']].map(([k, n]) => btn(n, k)).join('')}</div></div>`;
    return `${sceneHTML(false)}
      <div class="strip">${mood.icon} 오늘의 날씨 <b>${mood.name}</b><span class="r">대화 ${rec.c || 0}번 · 💕${rec.love || 0} · 💢${rec.bad || 0}</span></div>
      ${statsHTML()}
      <div class="acts">${acts.map(([k, i, n]) => `<button class="act ${homeSheet === k ? 'on' : ''}" data-do="${k === 'food' || k === 'more' ? 'sheet' : k}" data-val="${k}"><i>${i}</i>${n}</button>`).join('')}</div>
      ${tray}${giftHTML()}
      <div class="muted" style="text-align:center">${state.mode === 'cozy' ? '편안한 모드 · 쉬었다 와도 배고프거나 아프지 않아요' : '돌보기 모드 · 시간이 지나면 배고파져요 (떠나지는 않아요)'}</div>`;
  }

  /* ---------- 꾸미기 ---------- */
  const WTABS = [['body', '몸'], ['ears', '귀'], ['hair', '머리'], ['eyes', '눈'], ['face', '코·입'], ['cheeks', '볼'], ['clothes', '옷'], ['fantasy', '인외'], ['scars', '흉터'], ['color', '색'], ['acc', '장식'], ['pixel', '도트']];
  function setOn(obj, path, v) { const parts = path.split('.'); let o = obj; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]]; o[parts[parts.length - 1]] = v; }
  function tiles(path, options) {
    const p = pet(), cur = path.split('.').reduce((o, k) => o && o[k], p);
    return `<div class="grid">${Object.entries(options).map(([k, v]) => { const q = copy(p); setOn(q, path, k); q.stage = 'adult'; return `<button class="tile ${cur === k ? 'on' : ''}" data-pick="pet.${path}" data-val="${k}"><div class="pic">${drawPet(q, 'normal')}</div>${esc(v.name || v)}</button>`; }).join('')}</div>`;
  }
  const names = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.name || v]));
  function wardrobe() {
    const p = pet(); let inner = '';
    if (tab === 'body') inner = tiles('look.shape', names(SHAPES));
    if (tab === 'ears') inner = tiles('look.top', TOPS);
    if (tab === 'hair') inner = `<span class="lbl">앞머리</span>${tiles('extra.front', FRONTS)}<span class="lbl">뒷머리</span>${tiles('extra.back', BACKS)}<span class="lbl">머리·귀 색</span>${swatches('pet.look.hair', HAIR_COLORS, p.look.hair, true)}`;
    if (tab === 'eyes') inner = tiles('look.eyes', names(EYES));
    if (tab === 'face') inner = `<span class="lbl">코</span>${tiles('look.nose', names(NOSES))}<span class="lbl">입</span>${tiles('look.mouth', names(MOUTHS))}`;
    if (tab === 'cheeks') inner = tiles('look.cheeks', names(CHEEKS));
    if (tab === 'clothes') inner = `${tiles('extra.outfit', OUTFITS)}<span class="lbl">옷 색</span>${swatches('pet.extra.cloth', CLOTH_COLORS, p.extra.cloth)}`;
    if (tab === 'fantasy') inner = `<span class="lbl">날개</span>${tiles('extra.wings', WINGS)}<span class="lbl">꼬리</span>${tiles('extra.tail', TAILS)}<span class="lbl">포인트</span>${tiles('extra.mark', MARKS)}`;
    if(tab==='scars')inner=`<div class="muted">여러 흉터를 겹쳐 달 수 있어요. 좌우와 색을 각각 골라 주세요.</div><div class="row">${Object.entries(SCARS).map(([k,v])=>btn('+ '+v.name,'addscar',k)).join('')}</div>${p.extra.scars.map(a=>`<div class="card"><strong>${SCARS[a.type].name}</strong><div class="row" style="margin-top:8px">${btn('왼쪽','scarside',a.id+':left','btn'+(a.side==='left'?' on':''))}${btn('오른쪽','scarside',a.id+':right','btn'+(a.side==='right'?' on':''))}${btn('연분홍','scarcolor',a.id+':pink','btn'+(a.color==='pink'?' on':''))}${btn('진한 갈색','scarcolor',a.id+':brown','btn'+(a.color==='brown'?' on':''))}${btn('지우기','delscar',a.id)}</div></div>`).join('')}`;
    if (tab === 'color') inner = `<span class="lbl">몸 색</span>${swatches('pet.look.body', BODY_COLORS, p.look.body)}<span class="lbl">머리·귀 색</span>${swatches('pet.look.hair', HAIR_COLORS, p.look.hair, true)}<span class="lbl">눈 색</span>${swatches('pet.look.eye', EYE_COLORS, p.look.eye)}
      <label class="tog">오드아이 (오른쪽 눈 색 따로)<input type="checkbox" data-set="pet.extra.hetero" ${p.extra.hetero ? 'checked' : ''}></label>${p.extra.hetero ? `<span class="lbl">오른쪽 눈 색</span>${swatches('pet.extra.eye2', EYE_COLORS, p.extra.eye2)}` : ''}`;
    if (tab === 'acc') {
      const a = p.extra.accessories.find((x) => x.id === selAcc);
      inner = `<div class="row">${Object.entries(ACC).map(([k, v]) => btn('+ ' + v.name, 'addacc', k, 'btn sm')).join('')}</div>
        ${p.extra.accessories.length ? `<span class="lbl">단 장식 (눌러서 고르기)</span><div class="row">${p.extra.accessories.map((x) => btn(ACC[x.type].name, 'selacc', x.id, 'btn sm' + (x.id === selAcc ? ' on' : ''))).join('')}</div>` : '<div class="muted">장식을 눌러 달아 보세요. 여러 개 겹쳐 달 수 있어요.</div>'}
        ${a ? `<div class="card"><div class="row" style="align-items:flex-start;gap:14px"><div class="pad"><span></span>${btn('▲', 'accmove', '0,-1', 'btn sm')}<span></span>${btn('◀', 'accmove', '-1,0', 'btn sm')}<span></span>${btn('▶', 'accmove', '1,0', 'btn sm')}<span></span>${btn('▼', 'accmove', '0,1', 'btn sm')}<span></span></div>
          <div style="flex:1"><div class="row">${btn('좌우 반전', 'accflip', null, 'btn sm')}${btn('떼기', 'accdel', null, 'btn sm')}</div><span class="lbl">장식 색</span>${swatches('acc.c', ['#FF6F91', '#FFD54A', '#FFFFFF', '#7DA7F0', '#9C7BE0', '#3A3A44', '#6CC46A'], a.c)}</div></div></div>` : ''}`;
    }
    if (tab === 'pixel') inner = `<div class="muted">펫 위에 직접 도트를 찍어요. 점, 상처, 액세서리 뭐든!</div><div class="row" style="margin-top:6px"><label class="sw custom" title="펜 색"><input type="color" data-paint-color value="${paintColor}"></label>${btn('펜', 'pen', null, 'btn sm' + (!erasing ? ' on' : ''))}${btn('지우개', 'eraser', null, 'btn sm' + (erasing ? ' on' : ''))}${btn('되돌리기', 'undo', null, 'btn sm')}${btn('전체 지우기', 'clearpaint', null, 'btn sm')}</div>
      <div class="paintwrap"><div class="under">${drawPet(Object.assign(copy(p), { extra: Object.assign(copy(p.extra), { pixels: [] }) }), 'normal')}</div><canvas class="paint" width="320" height="320" aria-label="32×32 도트 그리기"></canvas></div>`;
    return `<div class="preview"><div>${drawPet({...p,stage:'adult'}, 'normal')}</div></div>
      <div class="chips" style="margin-top:8px">${WTABS.map(([k, n]) => `<button class="btn sm ${tab === k ? 'on' : ''}" data-do="tab" data-val="${k}">${n}</button>`).join('')}</div>${inner}`;
  }

  /* ---------- 가구 ---------- */
  function lockText(t) {
    const F = FURN[t];
    if (F.gift) return `대화\n${F.gift}번`;
    if (F.season) return `${F.season[0]}~${F.season[2]}월\n한정`;
    if (F.special) return '생일\n기념일';
    return '';
  }
  function roomView() {
    const R = state.room, a = R.items.find((x) => x.id === selected), F = a && FURN[a.type];
    return `${sceneHTML(roomEdit)}
      <div class="row" style="justify-content:space-between;margin-top:8px"><strong>나만의 방</strong>${btn(roomEdit ? '배치 끝' : '가구 옮기기', 'roomedit', null, 'btn' + (roomEdit ? ' on' : ''))}</div>
      <div class="muted">${roomEdit ? '가구를 눌러 고르고 끌어서 옮겨요. 화살표로 1칸씩 움직일 수도 있어요.' : '가구를 누르면 정실이 다가가요. 침대를 누르면 잠들어요.'}</div>
      ${a ? `<div class="card"><div class="h">${esc(F.name)}<small>고른 가구</small></div><div class="row" style="align-items:flex-start;gap:14px"><div class="pad"><span></span>${btn('▲', 'itemmove', '0,-2', 'btn sm')}<span></span>${btn('◀', 'itemmove', '-2,0', 'btn sm')}<span></span>${btn('▶', 'itemmove', '2,0', 'btn sm')}<span></span>${btn('▼', 'itemmove', '0,2', 'btn sm')}<span></span></div>
        <div style="flex:1"><div class="row">${btn('좌우 반전', 'itemflip', null, 'btn sm')}${btn('치우기', 'itemdel', null, 'btn sm')}</div><span class="lbl">가구 색</span>${swatches('item.c', ['#FF9DBB', '#FFD54A', '#C4A3E0', '#7DA7F0', '#6CC46A', '#D6A07F', '#F4F4F4', '#4A4A58'], a.c || F.c)}</div></div></div>` : ''}
      <div class="card"><div class="h">방 분위기</div><div class="chips">${Object.entries(THEMES).map(([k, t]) => btn(t[0], 'theme', k, 'btn sm' + (R.theme === k ? ' on' : ''))).join('')}</div>
        <span class="lbl">벽지</span>${swatches('room.wall', ['#FFE3D3', '#FFE1EE', '#D9EBD3', '#D4CEF2', '#D5EEE6', '#FFF6D6', '#4A4A66'], R.wall)}<span class="lbl">바닥</span>${swatches('room.floor', ['#E8B896', '#DCA2C1', '#A9C2A0', '#9C9AC6', '#9CC4BA', '#C9A180', '#6E6B8F'], R.floor)}</div>
      <div class="card"><div class="h">가구 상자<small>${R.items.length}/40 · 대화 ${totalChats()}번</small></div><div class="grid">${Object.entries(FURN).map(([k, F2]) => { const ok = isUnlocked(k); return `<button class="tile" data-do="${ok ? 'additem' : 'lockinfo'}" data-val="${k}"><div class="fur"><div style="aspect-ratio:${F2.w}/${F2.h};max-width:100%">${furnSVG(k)}</div></div>${esc(F2.name)}${ok ? '' : `<div class="lock">🔒\n${esc(lockText(k))}</div>`}</button>`; }).join('')}</div></div>`;
  }

  /* ---------- 정실 ---------- */
  function calendarHTML() {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m, 1).getDay(), last = new Date(y, m + 1, 0).getDate();
    let cells = ['일', '월', '화', '수', '목', '금', '토'].map((d) => `<div class="wk">${d}</div>`).join('');
    for (let i = 0; i < first; i++) cells += '<div class="blank"></div>';
    for (let d = 1; d <= last; d++) {
      const key = day(new Date(y, m, d)), rec = state.days[key];
      const has = rec && (rec.c || rec.love || rec.bad || rec.sad || rec.shy);
      cells += `<div class="${key === day() ? 'now' : ''}" style="${has ? `background:${MOODS[moodOf(rec)].color}` : ''}" title="${has ? MOODS[moodOf(rec)].name + ' · 대화 ' + rec.c + '번' : ''}">${d}</div>`;
    }
    return `<div class="cal">${cells}</div><div class="legend">${Object.values(MOODS).map((M) => `<span style="--c:${M.color}">${M.name}</span>`).join('')}</div>`;
  }
  function oshi() {
    const p = pet(), pr = p.profile, n = totalChats();
    const foodOpts = Object.fromEntries(Object.entries(FOODS).map(([k, v]) => [k, v[0]]));
    const sel = (path, opts, cur, none) => `<select data-set="${path}">${none ? `<option value="">${none}</option>` : ''}${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    return `<div class="card"><div class="h">${esc(p.name)} 소개<small>만난 지 D+${daysSince(pr.met)}</small></div>
        <span class="lbl">이름</span><input type="text" maxlength="20" data-set="pet.name" value="${esc(p.name)}">
        <span class="lbl">성격 (반응 말투가 바뀌어요)</span><div class="chips">${Object.entries(TYPES).map(([k, v]) => chip(v, 'pet.profile.type', k, pr.type)).join('')}</div>
        <span class="lbl">나를 부르는 호칭</span><input type="text" maxlength="20" data-set="pet.profile.user" value="${esc(pr.user)}">
        <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><span class="lbl">정실 생일</span><input type="date" data-set="pet.profile.birthday" value="${esc(pr.birthday)}"></div><div style="flex:1"><span class="lbl">만난 날</span><input type="date" data-set="pet.profile.met" value="${esc(pr.met)}"></div></div>
        <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><span class="lbl">좋아하는 음식</span>${sel('pet.profile.favorite', foodOpts, pr.favorite)}</div><div style="flex:1"><span class="lbl">싫어하는 음식</span>${sel('pet.profile.dislike', foodOpts, pr.dislike, '없음')}</div></div>
        <span class="lbl">혼잣말 (한 줄에 하나 · {user}=호칭, {name}=이름)</span><textarea maxlength="1200" data-set="pet.profile.lines" placeholder="오늘도 기다렸어, {user}.">${esc(pr.lines)}</textarea></div>
      <div class="card"><div class="h">출석 · 기념일<small>함께 대화 ${n}번</small></div>${calendarHTML()}
        <span class="lbl">대화 기념 선물</span>${GIFTS.map(([need, t]) => `<div class="row" style="justify-content:space-between;font-size:12px;padding:2px 0"><span>${state.gifted.includes(need) ? '✅' : '🔒'} 대화 ${need}번 · ${esc(FURN[t].name)}</span>${state.gifted.includes(need) ? '' : `<span style="opacity:.6">${Math.max(0, need - n)}번 남음</span>`}</div>`).join('')}</div>
      <div class="card"><div class="h">명대사 액자<small>${state.quotes.length}/60</small></div>
        <textarea data-quote maxlength="300" placeholder="마음에 드는 정실 대사를 붙여넣어 주세요"></textarea>
        <div class="row" style="margin-top:6px;flex-wrap:nowrap"><input type="text" data-quote-who maxlength="30" placeholder="누가 한 말? (예: ${esc(p.name)})" style="flex:1">${btn('저장', 'addquote', null, 'btn pri')}</div>
        ${state.quotes.slice().reverse().map((q) => `<div class="quote ${state.hung === q.id ? 'hung' : ''}">“${esc(q.text)}”<small>— ${esc(q.who || p.name)} · ${new Date(q.at).toLocaleDateString('ko-KR')}${state.hung === q.id ? ' · 벽에 걸림' : ''}</small><div class="row" style="margin-top:5px">${state.hung === q.id ? btn('내리기', 'hangquote', '') : btn('벽에 걸기', 'hangquote', q.id)}${btn('삭제', 'delquote', q.id)}</div></div>`).join('') || '<div class="muted">걸어 둔 액자를 방에서 누르면 정실이 그 대사를 읽어 줘요.</div>'}</div>
      <div class="card"><div class="h">내 정실들<small>${state.pets.length}/8</small></div>
        ${state.pets.map((q, i) => `<div class="pcard"><div class="pic">${drawPet(q, 'normal')}</div><div class="info"><strong>${esc(q.name)}</strong><div style="opacity:.65">${TYPES[q.profile.type]} · 대화 ${q.chats}번${i === state.active ? ' · 지금 함께' : ''}${i === state.buddy ? ' · 놀러 옴' : ''}</div></div>${i !== state.active ? btn('바꾸기', 'switch', i, 'btn sm') + btn(i === state.buddy ? '보내기' : '놀러 오기', 'buddy', i, 'btn sm') : ''}</div>`).join('')}
        <div class="row" style="margin-top:8px">${btn('+ 새 정실', 'newpet')}${btn('복제', 'clonepet')}${state.pets.length > 1 ? btn(deleteArmed ? '정말 삭제' : '삭제', deleteArmed ? 'confirmdel' : 'delpet') : ''}</div></div>
      <div class="card"><div class="h">코디·방 보관함<small>${state.presets.length}/12</small></div>${btn('지금 모습과 방 저장', 'preset')}
        ${state.presets.map((a, i) => `<div class="pcard"><div class="pic">${drawPet(a.pet, 'normal')}</div><div class="info">${esc(a.name)}</div>${btn('입히기', 'loadpreset', i, 'btn sm')}${btn('삭제', 'delpreset', i, 'btn sm')}</div>`).join('')}</div>`;
  }

  /* ---------- 앨범 ---------- */
  function album() {
    return `${sceneHTML(false)}
      <div class="card"><div class="h">사진관</div><span class="lbl">표정</span><div class="chips">${[['normal', '기본'], ['happy', '웃음'], ['love', '하트눈'], ['shy', '부끄'], ['sleep', '잠'], ['sad', '슬픔'], ['angry', '화남']].map(([k, v]) => `<button class="btn sm ${photoExpr === k ? 'on' : ''}" data-do="photoexpr" data-val="${k}">${v}</button>`).join('')}</div>
        <span class="lbl">포즈</span><div class="chips">${[['stand', '서 있기'], ['sit', '앉기'], ['tilt', '갸웃']].map(([k, v]) => `<button class="btn sm ${pose === k ? 'on' : ''}" data-do="pose" data-val="${k}">${v}</button>`).join('')}</div>
        <div class="row" style="margin-top:8px">${btn('방이랑 같이 찍기', 'snaproom', null, 'btn pri')}${btn('정실만 (투명 배경)', 'snappet')}</div></div>
      <div class="card"><div class="h">추억 기록<small>최근 150개</small></div><div class="row" style="flex-wrap:nowrap"><input type="text" data-note maxlength="180" placeholder="오늘의 추억 한 줄" style="flex:1">${btn('기록', 'note', null, 'btn pri')}</div>
        ${state.album.length ? state.album.slice().reverse().map((a) => `<div class="rec"><small>${new Date(a.at).toLocaleString('ko-KR')}</small>${esc(a.note)}</div>`).join('') : '<div class="muted">함께한 추억이 여기에 쌓여요.</div>'}</div>`;
  }

  /* ---------- 설정 ---------- */
  function settings() {
    return `<div class="card"><div class="h">돌보기 방식</div><div class="chips">${chip('편안한 모드', 'state.mode', 'cozy', state.mode)}${chip('돌보기 모드', 'state.mode', 'care', state.mode)}</div><div class="muted">편안한 모드는 오래 쉬었다 와도 배고프거나 아프지 않아요. 두 모드 모두 정실은 떠나지 않아요.</div></div>
      <div class="card"><div class="h">크랙 화면</div>
        <label class="tog">내 말·정실 답장에 반응하기<input type="checkbox" data-set="state.react" ${state.react ? 'checked' : ''}></label>
        <label class="tog">화면 위를 걸어다니기<input type="checkbox" data-set="state.walk" ${state.walk ? 'checked' : ''}></label>
        <label class="tog">말풍선 띄우기<input type="checkbox" data-set="state.bubbles" ${state.bubbles ? 'checked' : ''}></label>
        <span class="lbl">펫 크기 <output>${state.scale}</output></span><input type="range" min="40" max="100" step="2" value="${state.scale}" data-set="state.scale" style="width:100%;accent-color:#E8618A">
        <div class="row" style="margin-top:8px">${btn('위치 처음으로', 'resetpos')}${btn('펫 숨기기', 'hide')}</div>
        <div class="muted">펫을 끌어서 걸어다닐 높이를 정할 수 있어요. 숨긴 펫은 탬퍼몽키 메뉴 '말랑펫 열기 / 다시 보이기'로 꺼내요.</div></div>
      <div class="card"><div class="h">백업</div><div class="row">${btn('전체 백업', 'backup')}${btn('정실·방만 공유', 'share')}${btn('파일 불러오기', 'import')}</div><input class="upload" type="file" accept=".json,application/json">
        <div class="muted">전체 백업은 정실·방·기록·명대사를 모두 담아요. 공유 파일은 대화 통계와 추억 없이 정실 모습과 방만 담겨요.</div></div>
      <p class="foot">내 대화는 크랙에서 읽기만 하고 다른 곳으로 보내지 않아요<br>대화 내용은 저장하지 않아요 (직접 넣은 명대사만 저장)<br>말랑펫 v3.2.0 · muz</p>`;
  }

  const VIEWS = { home, wardrobe, room: roomView, oshi, album, settings };
  function render() {
    const th = THEMES[state.room.theme] || THEMES.peach;
    $('.panel').style.setProperty('--paper', '#FFF8EF'); $('.panel').style.setProperty('--head', th[3]);
    const p = pet();
    $('.title').textContent = `${p.name}의 방`;
    $('.sub').textContent = `${TYPES[p.profile.type]} · ${({ egg: '알', baby: '아기', child: '어린이', adult: '어른' })[p.stage]} · 만난 지 D+${daysSince(p.profile.met)}`;
    const sc = main.scrollTop;
    main.innerHTML = VIEWS[view]();
    main.scrollTop = sc;
    $('.nav').innerHTML = [['home', '⌂', '방'], ['wardrobe', '✿', '꾸미기'], ['room', '▦', '가구'], ['oshi', '♥', '정실'], ['album', '▣', '앨범']].map(([k, i, n]) => `<button data-nav="${k}" class="${view === k ? 'on' : ''}"><i>${i}</i>${n}</button>`).join('');
    refreshActors();
    if (view === 'wardrobe' && tab === 'pixel') drawPaint();
    if (growFx) { growFx = false; say(p.stage === 'baby' ? '알이 깨어났어! 안녕!' : '나 조금 컸지?', 'happy', 'sparkle'); }
  }
  function navigate(v) { deleteArmed = false; view = v; selected = null; roomEdit = false; homeSheet = null; render(); main.scrollTop = 0; }
  function open() { simulate(); save(); $('.app').hidden = false; walkerEl.style.visibility = 'hidden'; wbub.hidden = true; view = 'home'; homeSheet = null; render(); say(line('hello'), 'happy'); main.scrollTop = 0; }
  function close() { $('.app').hidden = true; walkerEl.style.visibility = 'visible'; save(); }

  /* ---------- 돌보기 ---------- */
  function acted(k) {
    const p = pet();
    if (p.stage === 'egg') { say('(알이 따뜻해요. 대화하면 더 빨리 깨어나요)', null, 'heart'); hop(); return; }
    if (p.sleeping && k !== 'sleep') { say('쉿… 자고 있어요. 먼저 깨워 주세요.', 'sleep'); return; }
    if (k === 'sleep') {
      p.sleeping = !p.sleeping;
      if (p.sleeping) { const bed = state.room.items.find((a) => a.type === 'bed' || a.type === 'canopy'); if (bed) { const F = FURN[bed.type]; actor.x = bed.x + F.w / 2; actor.y = Math.min(RH - 2, bed.y + F.h - 2); } }
      say(p.sleeping ? '잘 자…' : '잘 잤다!', p.sleeping ? 'sleep' : 'happy');
    } else {
      const eff = { pet: [3, 0, 0, 0, 'pet', 'love', 'heart'], hug: [7, 0, 0, 0, 'pet', 'love', 'heart'], play: [20, -6, -3, 0, 'play', 'happy', 'star'], wash: [8, 0, 0, 35, null, 'happy', 'drop'], brush: [6, 0, 0, 12, null, 'happy', 'sparkle'], gift: [15, 0, 0, 0, null, 'love', 'heart'], med: [0, 0, 0, 0, null, 'happy', 'sparkle'] }[k];
      if (!eff) return;
      p.fun = clamp(p.fun + eff[0]); p.energy = clamp(p.energy + eff[1]); p.hunger = clamp(p.hunger + eff[2]); p.clean = clamp(p.clean + eff[3]); p.bond = clamp(p.bond + 1, 0, 1e9);
      if (k === 'med') p.health = clamp(p.health + 30);
      const msg = { wash: '보글보글, 뽀송해졌어!', brush: '머리가 보들보들해졌어.', med: '조금 더 편안해졌어.', gift: '나한테 주는 선물이야? 고마워!' }[k] || line(eff[4]);
      say(msg, eff[5], eff[6]); hop();
      if (['gift', 'hug'].includes(k)) { const note = `${p.name}에게 처음 ${k === 'gift' ? '선물' : '포옹'}을 해 줬어요.`; if (!state.album.some((a) => a.note === note)) log(note); }
    }
    save(); updateStats(); refreshActors();
    if (k === 'sleep') render();
  }
  function updateStats() { const s = $('.stats'); if (s) s.outerHTML = statsHTML(); }
  function feed(k) {
    const p = pet(), f = FOODS[k]; if (!f) return;
    if (p.stage === 'egg') { say('(알은 아직 못 먹어요)'); return; }
    if (p.sleeping) { say('자는 중이에요. 먼저 깨워 주세요.', 'sleep'); return; }
    if (p.hunger >= 98) { say('지금은 배불러! 조금 있다가 먹자.'); return; }
    p.hunger = clamp(p.hunger + f[1]); p.fun = clamp(p.fun + f[2] + (p.profile.favorite === k ? 8 : 0)); p.bond++;
    const disliked = p.profile.dislike === k;
    say(disliked ? '이건 내 취향은 아니지만… 한 입 먹을게.' : p.profile.favorite === k ? `내가 제일 좋아하는 ${f[0]}!` : line('feed'), disliked ? 'sad' : 'happy', disliked ? 'drop' : 'heart');
    const note = `${p.name}에게 ${f[0]}을(를) 처음 줬어요.`; if (!state.album.some((a) => a.note === note)) log(note);
    const s = $('.scene'); if (s) { const prop = document.createElement('div'); prop.className = 'prop'; prop.innerHTML = foodIcon(k); prop.style.left = pctX(actor.x + 4); prop.style.top = pctY(actor.y - 18); s.appendChild(prop); setTimeout(() => prop.remove(), 1700); }
    save(); updateStats();
  }
  function useItem(a) {
    const F = FURN[a.type], p = pet();
    if (a.type === 'quote') { const q = state.quotes.find((x) => x.id === state.hung); say(q ? `“${q.text.length > 70 ? q.text.slice(0, 70) + '…' : q.text}”\n— ${q.who || p.name}` : '정실 탭에서 명대사를 걸어 주세요.', q ? 'shy' : null, q ? 'heart' : null); return; }
    if (a.type === 'bed' || a.type === 'canopy') { acted('sleep'); return; }
    if (p.sleeping) { say('쿨쿨…', 'sleep'); return; }
    const nx = clamp(a.x + F.w / 2, 12, RW - 12), ny = F.wall ? clamp(actor.y, 84, 106) : clamp(a.y + F.h, FLOOR_Y+8, RH - 2);
    actor.face = nx < actor.x ? -1 : 1; actor.x = nx; actor.y = ny;
    const msg = { window: `오늘 날씨는 ${MOODS[weatherCache.mood].name}이야.`, sofa: '여기 앉아서 쉬자.', chair: '잠깐 앉아 있을래.', bear: '인형도 꼬옥 안아 줬어.', desk: '여기서 네 이야기를 적어 볼까?', tv: '같이 볼래?', coffee: '커피 한 잔 할까?', vanity: '오늘 나 어때?', tree: '반짝반짝 예쁘다!', snowman: '눈사람이다!', balloons: '오늘은 특별한 날!', clock: `지금 ${new Date().getHours()}시야.` }[a.type] || '한번 구경해 볼까?';
    if (a.type === 'bear') p.fun = clamp(p.fun + 2);
    refreshActors(); setTimeout(() => say(msg, 'happy'), 900); save();
  }

  /* ---------- 클릭 ---------- */
  function pathTarget(path) {
    const parts = path.split('.'), head = parts.shift();
    let obj = head === 'pet' ? pet() : head === 'state' ? state : head === 'room' ? state.room : head === 'item' ? state.room.items.find((a) => a.id === selected) : head === 'acc' ? pet().extra.accessories.find((a) => a.id === selAcc) : null;
    for (let i = 0; i < parts.length - 1 && obj; i++) obj = obj[parts[i]];
    return obj ? [obj, parts[parts.length - 1]] : [null];
  }
  function setPath(path, v) { const [o, k] = pathTarget(path); if (o) o[k] = v; }

  root.addEventListener('click', async (e) => {
    const nav = e.target.closest('[data-nav]'); if (nav) { navigate(nav.dataset.nav); return; }
    const food = e.target.closest('[data-food]'); if (food) { if (Date.now() - lastAction < 300) return; lastAction = Date.now(); feed(food.dataset.food); return; }
    const it = e.target.closest('[data-item]');
    if (it) { if (Date.now() < dragSuppress) return; const a = state.room.items.find((x) => x.id === it.dataset.item); if (!a) return; if (roomEdit) { selected = a.id; render(); } else useItem(a); return; }
    const pk = e.target.closest('[data-pick]');
    if (pk) { let v = pk.dataset.val; if (v === 'null') v = null; setPath(pk.dataset.pick, v); save(); render(); return; }
    const b = e.target.closest('[data-do]'); if (!b) return;
    const k = b.dataset.do, val = b.dataset.val, p = pet();
    if (k === 'close') { close(); return; }
    if (k === 'settings') { navigate(view === 'settings' ? 'home' : 'settings'); return; }
    if (k === 'sheet') { homeSheet = homeSheet === val ? null : val; render(); return; }
    if (k === 'petpet') { if (Date.now() - lastAction < 350) return; lastAction = Date.now(); acted('pet'); return; }
    if (['pet', 'hug', 'play', 'wash', 'brush', 'sleep', 'gift', 'med'].includes(k)) { if (Date.now() - lastAction < 350) return; lastAction = Date.now(); acted(k); return; }
    if (k === 'pair') { p.fun = clamp(p.fun + 5); p.bond++; say(`${p.name}랑 ${state.pets[state.buddy].name}, 사이좋게 놀아요.`, 'love', 'heart'); save(); return; }
    if (k === 'tab') { tab = val; render(); return; }
    if (k === 'photoexpr') { photoExpr = val; refreshActors(); render(); return; }
    if (k === 'pose') { pose = val; render(); return; }
    if (k === 'addacc') { if (p.extra.accessories.length >= 16) { toast('장식은 16개까지 달 수 있어요.'); return; } const pos = defaultAccPos(val, p); const a = { id: uid(), type: val, x: pos.x, y: pos.y, c: ACC[val].c, flip: false }; p.extra.accessories.push(a); selAcc = a.id; }
    if(k==='addscar'){if(p.extra.scars.length>=12){toast('흉터는 12개까지 달 수 있어요.');return;}p.extra.scars.push({id:uid(),type:val,side:'left',color:'pink'});}
    if(k==='scarside'||k==='scarcolor'){const[id,value]=val.split(':'),a=p.extra.scars.find(a=>a.id===id);if(a)a[k==='scarside'?'side':'color']=value;}
    if(k==='delscar')p.extra.scars=p.extra.scars.filter(a=>a.id!==val);
    if (k === 'selacc') selAcc = val;
    const ac = p.extra.accessories.find((a) => a.id === selAcc);
    if (k === 'accmove' && ac) { const [dx, dy] = val.split(',').map(Number); ac.x = clamp(ac.x + dx, -8, 31); ac.y = clamp(ac.y + dy, -8, 31); }
    if (k === 'accflip' && ac) ac.flip = !ac.flip;
    if (k === 'accdel') { p.extra.accessories = p.extra.accessories.filter((a) => a.id !== selAcc); selAcc = null; }
    if (k === 'pen' || k === 'eraser') { erasing = k === 'eraser'; render(); return; }
    if (k === 'undo') { const u = paintUndo.pop(); if (u) p.extra.pixels = u; }
    if (k === 'clearpaint') { paintUndo.push([...p.extra.pixels]); p.extra.pixels = Array(1024).fill(null); }
    if (k === 'roomedit') { roomEdit = !roomEdit; if (!roomEdit) selected = null; }
    if (k === 'theme') { state.room.theme = val; state.room.wall = THEMES[val][1]; state.room.floor = THEMES[val][2]; }
    if (k === 'lockinfo') { toast(FURN[val].gift ? `대화 ${FURN[val].gift}번을 채우면 선물로 받아요` : FURN[val].season ? `${FURN[val].season.join('·')}월에 생기는 계절 가구예요` : '정실 생일이나 만난 날에 선물로 받아요'); return; }
    if (k === 'additem') { if (state.room.items.length >= 40) { toast('가구는 40개까지 놓을 수 있어요.'); return; } const F = FURN[val]; const a = { id: uid(), type: val, x: Math.round(RW / 2 - F.w / 2), y: F.wall ? 8 : Math.round(88 - F.h), c: null, flip: false }; state.room.items.push(a); selected = a.id; roomEdit = true; toast(`${F.name}을(를) 놓았어요. 끌어서 옮겨 보세요.`); }
    const it2 = state.room.items.find((a) => a.id === selected);
    if (k === 'itemmove' && it2) { const [dx, dy] = val.split(',').map(Number); const F = FURN[it2.type]; it2.x = clamp(it2.x + dx, -F.w + 4, RW - 4); it2.y = clamp(it2.y + dy, -F.h + 4, RH - 4); }
    if (k === 'itemflip' && it2) it2.flip = !it2.flip;
    if (k === 'itemdel') { state.room.items = state.room.items.filter((a) => a.id !== selected); selected = null; }
    if (k === 'addquote') {
      const t = $('[data-quote]').value.trim(), who = $('[data-quote-who]').value.trim();
      if (!t) { toast('대사를 먼저 붙여넣어 주세요.'); return; }
      if (state.quotes.length >= 60) { toast('명대사는 60개까지 저장돼요.'); return; }
      const q = { id: uid(), text: t.slice(0, 300), who: who.slice(0, 30), at: Date.now() }; state.quotes.push(q);
      if (!state.hung) hangQuote(q.id);
      toast('명대사를 저장했어요.');
    }
    if (k === 'hangquote') { if (val) hangQuote(val); else state.hung = null; }
    if (k === 'delquote') { state.quotes = state.quotes.filter((q) => q.id !== val); if (state.hung === val) state.hung = null; }
    if (k === 'switch') { state.active = Number(val); if (state.buddy === state.active) state.buddy = -1; paintUndo = []; selAcc = null; }
    if (k === 'buddy') state.buddy = state.buddy === Number(val) ? -1 : Number(val);
    if (k === 'delpet') { deleteArmed = true; render(); toast('한 번 더 누르면 지금 정실이 삭제돼요.'); return; }
    if (k === 'confirmdel' && state.pets.length > 1) { state.pets.splice(state.active, 1); state.active = Math.min(state.active, state.pets.length - 1); state.buddy = -1; deleteArmed = false; }
    if (k === 'newpet' || k === 'clonepet') { if (state.pets.length >= 8) { toast('정실은 8명까지 키울 수 있어요.'); return; } const q = k === 'clonepet' ? copy(p) : freshPet(); q.name = k === 'clonepet' ? p.name + ' 2' : '새 말랑이'; if (k === 'clonepet') { q.chats = 0; q.xp = 0; } state.pets.push(q); state.active = state.pets.length - 1; log(`${q.name}와(과) 새로운 하루를 시작했어요.`); }
    if (k === 'preset') { if (state.presets.length >= 12) { toast('보관함은 12개까지예요.'); return; } state.presets.push({ name: `${p.name} · ${THEMES[state.room.theme][0]}`, pet: copy(p), room: copy(state.room) }); toast('보관했어요.'); }
    if (k === 'loadpreset') { const a = state.presets[Number(val)]; if (a) { p.look = copy(a.pet.look); p.extra = copy(a.pet.extra); state.room = copy(a.room); } }
    if (k === 'delpreset') state.presets.splice(Number(val), 1);
    if (k === 'note') { const n = $('[data-note]').value.trim(); if (n) { log(n); toast('기록했어요.'); } }
    if (k === 'snaproom' || k === 'snappet') { await snapshot(k === 'snappet'); return; }
    if (k === 'resetpos') { state.pos = { x: 0.9, y: 0.78 }; walker.x = null; placeWalker(); }
    if (k === 'hide') { state.hidden = true; save(); close(); placeWalker(); return; }
    if (k === 'backup') { download('말랑펫_전체백업.json', JSON.stringify({ format: 'mallang-backup', version: 3, data: state }, null, 2), 'application/json'); toast('전체 백업을 내려받았어요.'); return; }
    if (k === 'share') { const q = copy(p); q.chats = 0; q.xp = 0; q.bond = 0; q.born = Date.now(); download('말랑펫_정실과방.json', JSON.stringify({ format: 'mallang-share', version: 3, ver:32, pet: q, room: state.room }, null, 2), 'application/json'); toast('공유 파일을 내려받았어요.'); return; }
    if (k === 'import') { $('.upload').click(); return; }
    if (k === 'cancelimport') { pendingImport = null; render(); return; }
    if (k === 'confirmimport' && pendingImport) { const backup = copy(state); state = pendingImport; pendingImport = null; if (!save()) { state = backup; toast('저장하지 못해 취소했어요.'); return; } navigate('home'); toast('백업을 불러왔어요.'); return; }
    save(); render();
  });
  function hangQuote(id) {
    state.hung = id;
    if (!state.room.items.some((a) => a.type === 'quote')) state.room.items.push({ id: uid(), type: 'quote', x: 48, y: 9, c: null, flip: false });
  }

  root.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches('[data-paint-color]')) { paintColor = el.value; erasing = false; return; }
    const path = el.dataset.set; if (!path) return;
    let v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
    if (path === 'pet.name') v = text(v, '', 20) || '말랑이';
    setPath(path, v); save();
    if (el.type === 'range') { const out = el.parentElement.querySelector('output'); if (out) out.textContent = v; placeWalker(); return; }
    if (el.type === 'color') { render(); return; }
    if (path === 'pet.name') { $('.title').textContent = `${pet().name}의 방`; return; }
    if (el.type === 'checkbox') { if (path === 'pet.extra.hetero') render(); if (path === 'state.walk' || path === 'state.bubbles') wbub.hidden = true; return; }
  });
  root.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.matches('.upload')) {
      const file = el.files[0]; if (!file) return;
      try {
        if (file.size > 3e6) throw Error('파일은 3MB 이하로 넣어 주세요.');
        const v = JSON.parse(await file.text());
        if (v.version !== 3) throw Error('말랑펫 3 버전 파일을 골라 주세요.');
        if (v.format === 'mallang-share') {
          if (!v.pet || !v.room) throw Error('공유 파일이 올바르지 않아요.');
          if (state.pets.length >= 8) throw Error('정실 자리가 가득 찼어요.');
          state.pets.push(sanitizePet(v.pet)); state.active = state.pets.length - 1; state.room = sanitizeRoom(v.room, v.ver!==32&&v.ver!==31&&v.pet?.extra?.model!==undefined, v.ver===31||v.ver==null&&v.pet?.extra?.model===undefined&&v.pet?.extra?.pixelVersion!==32); save(); navigate('home'); toast('새 정실과 방을 불러왔어요.');
        } else if (v.format === 'mallang-backup') {
          if (!v.data || !Array.isArray(v.data.pets) || !v.data.pets.length) throw Error('백업에 정실이 없어요.');
          pendingImport = normalize(v.data);
          const box = document.createElement('div'); box.className = 'card';
          box.innerHTML = `<div class="h">지금 데이터를 백업으로 바꿀까요?</div><div class="muted">정실 ${pendingImport.pets.length}명 · 추억 ${pendingImport.album.length}개</div><div class="row" style="margin-top:6px">${btn('불러오기', 'confirmimport', null, 'btn pri')}${btn('취소', 'cancelimport')}</div>`;
          main.prepend(box); main.scrollTop = 0;
        } else throw Error('말랑펫 백업이나 공유 파일이 아니에요.');
      } catch (err) { toast(err.message || '파일을 읽지 못했어요.'); }
      el.value = ''; return;
    }
    if (el.tagName === 'SELECT' || el.type === 'date') render();
  });
  root.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' && appOpen()) close(); });
  root.addEventListener('keyup', (e) => e.stopPropagation());
  root.addEventListener('keypress', (e) => e.stopPropagation());
  $('.veil').addEventListener('click', close);

  /* ---------- 도트 그리기 ---------- */
  function drawPaint(){const c=$('.paint');if(!c)return;const ctx=c.getContext('2d');ctx.clearRect(0,0,320,320);pet().extra.pixels.forEach((v,i)=>{if(v){ctx.fillStyle=v;ctx.fillRect(i%32*10,Math.floor(i/32)*10,10,10);}});ctx.strokeStyle='rgba(74,59,68,.15)';ctx.lineWidth=.5;for(let i=0;i<=32;i++){ctx.beginPath();ctx.moveTo(i*10,0);ctx.lineTo(i*10,320);ctx.moveTo(0,i*10);ctx.lineTo(320,i*10);ctx.stroke();}}
  function paintAt(e){const c=$('.paint');if(!c)return;const r=c.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*32),y=Math.floor((e.clientY-r.top)/r.height*32);if(x<0||x>=32||y<0||y>=32)return;pet().extra.pixels[y*32+x]=erasing?null:paintColor;drawPaint();const pv=$('.preview div');if(pv)pv.innerHTML=drawPet(pet(),'normal');}

  /* ---------- 끌기 (펫·가구·음식·도트) ---------- */
  let dragging = null, painting = false, dragSuppress = 0;
  root.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const t = e.target;
    if (t.closest('.walker')) { dragging = { kind: 'walker', x: e.clientX, y: e.clientY, ox: walkerEl.offsetLeft, oy: walkerEl.offsetTop, moved: false }; try { walkerEl.setPointerCapture(e.pointerId); } catch (_) {} }
    else if (t.matches('.paint')) { painting = true; paintUndo.push([...pet().extra.pixels]); paintUndo = paintUndo.slice(-30); try { t.setPointerCapture(e.pointerId); } catch (_) {} paintAt(e); }
    else if (t.closest('[data-item]') && roomEdit) { const el = t.closest('[data-item]'), a = state.room.items.find((x) => x.id === el.dataset.item); if (!a) return; selected = a.id; $$('.item.sel').forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); dragging = { kind: 'item', a, el, r: $('.scene').getBoundingClientRect(), x: e.clientX, y: e.clientY, ox: a.x, oy: a.y, moved: false }; try { el.setPointerCapture(e.pointerId); } catch (_) {} }
    else if (t.closest('[data-food]')) { const el = t.closest('[data-food]'); dragging = { kind: 'food', food: el.dataset.food, x: e.clientX, y: e.clientY, moved: false }; }
  });
  root.addEventListener('pointermove', (e) => {
    if (painting) { paintAt(e); return; }
    const d = dragging; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 7) d.moved = true;
    if (!d.moved) return;
    if (d.kind === 'walker') { walker.x = clamp(d.ox + dx, 4, innerWidth - state.scale - 4); walkerEl.style.left = walker.x + 'px'; walkerEl.style.top = clamp(d.oy + dy, 4, innerHeight - state.scale - 4) + 'px'; }
    if (d.kind === 'item') { const F = FURN[d.a.type]; d.a.x = Math.round(clamp(d.ox + (dx / d.r.width) * RW, -F.w + 4, RW - 4)); d.a.y = Math.round(clamp(d.oy + (dy / d.r.height) * RH, -F.h + 4, RH - 4)); d.el.style.left = pctX(d.a.x); d.el.style.top = pctY(d.a.y); }
    if (d.kind === 'food') { let pr = $('.dragfood'); if (!pr) { pr = document.createElement('div'); pr.className = 'dragfood'; pr.style.cssText = 'position:fixed;width:40px;height:40px;pointer-events:none;z-index:400'; pr.innerHTML = foodIcon(d.food); $('.panel').appendChild(pr); } const pb = $('.panel').getBoundingClientRect(); pr.style.left = e.clientX - pb.left - 20 + 'px'; pr.style.top = e.clientY - pb.top - 20 + 'px'; pr.style.position = 'absolute'; }
  });
  function endPointer(e, cancel) {
    if (painting) { painting = false; save(); refreshActors(); return; }
    const d = dragging; if (!d) return; dragging = null;
    const df = $('.dragfood'); if (df) df.remove();
    if (cancel) return;
    if (d.kind === 'walker') {
      if (d.moved) { state.pos = { x: clamp((walkerEl.offsetLeft - 8) / Math.max(1, innerWidth - state.scale - 16), 0, 1), y: clamp((walkerEl.offsetTop - 8) / Math.max(1, innerHeight - state.scale - 16), 0, 1) }; walker.until = Date.now() + 4000; save(); }
      else open();
    }
    if (d.kind === 'item') { if (d.moved) dragSuppress = Date.now() + 400; save(); render(); }
    if (d.kind === 'food' && d.moved) { lastAction = Date.now(); const r = $('.actor.main') && $('.actor.main').getBoundingClientRect(); if (r && e.clientX >= r.left - 30 && e.clientX <= r.right + 30 && e.clientY >= r.top - 30 && e.clientY <= r.bottom + 30) feed(d.food); else toast('음식을 정실에게 가져다 주세요.'); }
  }
  root.addEventListener('pointerup', (e) => endPointer(e));
  root.addEventListener('pointercancel', (e) => endPointer(e, true));
  walkerEl.addEventListener('click', (e) => { if (e.detail === 0) open(); });

  /* ---------- 사진 ---------- */
  function download(name, data, type) { const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
  function poseWrap(svg) {
    const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    if(pose==='sit'){const cv=Canvas();const src=petCanvas(pet(),photoExpr);for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(src.g[y][x])cv.set(x,Math.min(31,y+(y<27?2:0)),src.g[y][x]);return svgRects(cv);}
    if(pose==='tilt'){const cv=Canvas(),src=petCanvas(pet(),photoExpr);for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(src.g[y][x])cv.set(x+(y<16?-1:0),y,src.g[y][x]);return svgRects(cv);}
    return inner;
  }
  async function snapshot(transparent) {
    toast('사진을 만들고 있어요…');
    const p = pet(), S = 8;
    let svg, w, h;
    if (transparent) { w = h = 480; svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 32 32" shape-rendering="crispEdges">${poseWrap(drawPet(p, photoExpr))}</svg>`; }
    else {
      w = RW * S; h = RH * S + 56;
      const R = state.room;
      const items = R.items.slice().sort((a, b) => (FURN[a.type].wall ? -1 : 0) - (FURN[b.type].wall ? -1 : 0) || (a.y + FURN[a.type].h) - (b.y + FURN[b.type].h));
      let body = roomBG(R).replace('<svg ', `<svg x="0" y="0" width="${RW}" height="${RH}" `);
      const actorSVG = (q, ex, x, y) => `<svg x="${x}" y="${y}" width="32" height="32" viewBox="0 0 32 32">${poseWrap(drawPet(q, ex))}</svg>`;
      let petDrawn = false;
      for (const a of items) {
        const F = FURN[a.type];
        if (!petDrawn && !F.wall && a.y + F.h > actor.y + 0.5) { body += actorSVG(p, photoExpr, actor.x - 16, actor.y - 31); petDrawn = true; }
        body += furnSVG(a.type, a.c, a.flip).replace('<svg ', `<svg x="${a.x}" y="${a.y}" width="${F.w}" height="${F.h}" `);
      }
      if (!petDrawn) body += actorSVG(p, photoExpr, actor.x - 16, actor.y - 31);
      if (state.buddy >= 0) body += actorSVG(state.pets[state.buddy], 'happy', actor.x - 4, actor.y - 31);
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"><g transform="scale(${S})">${body}</g><rect y="${RH * S}" width="${w}" height="56" fill="#FFF8EF"/><rect y="${RH * S}" width="${w}" height="4" fill="${K}"/><text x="28" y="${RH * S + 37}" fill="${K}" font-family="sans-serif" font-weight="700" font-size="24">${esc(p.name)}의 방 · ${day()} · 만난 지 D+${daysSince(p.profile.met)}</text></svg>`;
    }
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
      if (!blob) throw Error();
      download(`말랑펫_${day()}${transparent ? '_투명' : '_방'}.png`, blob, 'image/png');
      log(`${p.name}의 기념사진을 찍었어요.`); save(); toast('사진을 내려받았어요.');
    } catch (e) { toast('사진 저장에 실패했어요. 다시 눌러 주세요.'); } finally { URL.revokeObjectURL(url); }
  }

  /* =========================================================
   * 크랙 화면 위를 걷는 펫
   * ========================================================= */
  const walker = { x: null, target: null, mode: 'idle', until: Date.now() + 2000, face: 1, t: performance.now(), hopUntil: 0 };
  function laneY() { return clamp(state.pos.y, 0, 1) * Math.max(0, innerHeight - state.scale - 16) + 8; }
  function placeWalker() {
    const s = state.scale;
    walkerEl.style.setProperty('--sz', s + 'px');
    if (walker.x == null) walker.x = clamp(state.pos.x, 0, 1) * Math.max(0, innerWidth - s - 16) + 8;
    walker.x = clamp(walker.x, 4, Math.max(4, innerWidth - s - 4));
    walkerEl.style.left = walker.x + 'px'; walkerEl.style.top = laneY() + 'px';
    walkerEl.hidden = state.hidden;
  }
  function walkerStep() {
    const now = performance.now(), dt = Math.min(0.2, (now - walker.t) / 1000); walker.t = now;
    if (state.hidden || appOpen() || (dragging && dragging.kind === 'walker')) { walkerEl.classList.remove('walking'); return; }
    const p = pet(), s = state.scale, maxX = Math.max(8, innerWidth - s - 8);
    const can = state.walk && !p.sleeping && p.stage !== 'egg' && Date.now() > walker.hopUntil;
    if (!can) { if (walker.mode === 'walk') { walker.mode = 'idle'; walker.until = Date.now() + 3000; } }
    else if (walker.mode === 'idle' && Date.now() > walker.until) {
      const dist = 60 + Math.random() * 180, dir = Math.random() < 0.5 ? -1 : 1;
      walker.target = clamp(walker.x + dist * dir, 8, maxX); if (Math.abs(walker.target - walker.x) < 20) walker.target = clamp(walker.x - dist * dir, 8, maxX);
      walker.mode = 'walk';
    }
    if (walker.mode === 'walk' && can) {
      const d = walker.target - walker.x, step = CONFIG.walkSpeed * dt;
      walker.face = d < 0 ? -1 : 1;
      if (Math.abs(d) <= step) { walker.x = walker.target; walker.mode = 'idle'; walker.until = Date.now() + 2500 + Math.random() * 7000; state.pos.x = clamp((walker.x - 8) / Math.max(1, innerWidth - s - 16), 0, 1); }
      else walker.x += Math.sign(d) * step;
      walkerEl.style.left = Math.round(walker.x/(state.scale/32))*(state.scale/32) + 'px';
    }
    walkerEl.style.top = laneY() + 'px';
    const walkingNow=walker.mode==='walk'&&can;walkerEl.classList.toggle('walking',walkingNow);
    if(walkerEl.dataset.motion!==(walkingNow?'walk':'idle')){walkerEl.dataset.motion=walkingNow?'walk':'idle';walkerEl.querySelector('.wk').innerHTML=drawPet(p,getExpr(),walkingNow?'walk':'idle');}
    walkerEl.classList.toggle('left', walker.face < 0);
    if (!wbub.hidden) { wbub.style.left = walker.x + s / 2 + 'px'; wbub.style.top = laneY() - 6 + 'px'; }
  }
  setInterval(walkerStep, 50);
  let wbubTimer;
  function walkerReact(fx, msg) {
    if (state.hidden || appOpen()) return;
    walker.hopUntil = Date.now() + 1800;
    walkerEl.classList.remove('hop'); void walkerEl.offsetWidth; walkerEl.classList.add('hop');
    setTimeout(() => walkerEl.classList.remove('hop'), 950);
    if (fx) for (let i = 0; i < (fx === 'heart' ? 3 : 1); i++) setTimeout(() => {
      const el = document.createElement('div'); el.className = 'wfx'; el.innerHTML = particleSVG(fx);const rows=PARTICLES[fx]||PARTICLES.heart;el.style.width=Math.max(...rows.map(r=>r.length))*state.scale/32+'px';el.style.height=rows.length*state.scale/32+'px';
      el.style.left = walker.x + state.scale * (0.3 + Math.random() * 0.4) + 'px'; el.style.top = laneY() - 4 + 'px';
      root.appendChild(el); setTimeout(() => el.remove(), 1500);
    }, i * 220);
    if (msg && state.bubbles) {
      wbub.textContent = msg; wbub.hidden = false;
      wbub.style.left = walker.x + state.scale / 2 + 'px'; wbub.style.top = laneY() - 6 + 'px';
      clearTimeout(wbubTimer); wbubTimer = setTimeout(() => { wbub.hidden = true; }, 3200);
    }
  }

  /* =========================================================
   * 크랙 대화 듣기 (내 말 + 정실 답장)
   * 새로 올라온 메시지만 읽고, 대화 내용은 저장하지 않아요.
   * ========================================================= */
  const seen = new Set(), watching = new Map();
  let intent = 0, bootUntil = Date.now() + 3000, lastURL = location.href, lastMineAt = 0, lastNewAt = 0, missCount = 0, warned = false;
  const recentMine = [];
  const messageHash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;};
  document.querySelectorAll(SEL.message).forEach((m) => seen.add(m.getAttribute(SEL.messageId)));
  document.addEventListener('keydown', (e) => {
    if (e.composedPath && e.composedPath().includes(host)) return;
    const t = e.target;
    if (e.key === 'Enter' && !e.shiftKey && t && (t.tagName === 'TEXTAREA' || t.isContentEditable)) { intent = Date.now(); const at = intent; setTimeout(() => checkMiss(at), 10000); }
  }, true);
  document.addEventListener('click', (e) => {
    if (e.composedPath && e.composedPath().includes(host)) return;
    const b = e.target.closest && e.target.closest('button');
    if(b&&document.querySelector(SEL.input)){const input=document.querySelector(SEL.input);intent=Date.now();if((input.value||input.textContent||'').trim()){const at=intent;setTimeout(()=>checkMiss(at),10000);}}
  }, true);
  function checkMiss(at) {
    if (lastMineAt >= at) { missCount = 0; return; }
    missCount++;
    if (missCount >= 3 && !warned) { warned = true; console.warn('[말랑펫] 내가 보낸 말을 찾지 못하고 있어요. 크랙 화면 구조가 바뀌었을 수 있어요. (SEL 설정 확인)'); toast('크랙 대화를 찾지 못했어요. SEL 설정과 현재 채팅 화면을 확인해 주세요.'); if (!appOpen()) walkerReact('dots', '…크랙 화면이 바뀐 것 같아.\n대화를 못 알아듣겠어.'); }
  }
  function scanChat() {
    const now = Date.now(), all = [...document.querySelectorAll(SEL.message)];
    for (let i = 0; i < all.length; i++) {
      const m = all[i], id = m.getAttribute(SEL.messageId);
      if (!id || seen.has(id)) continue;
      const t = m.querySelector(SEL.text);
      if (!t || !t.textContent.trim()) continue;
      seen.add(id);
      if (now < bootUntil || i < all.length - 3 || !state.react) continue;
      lastNewAt = now;
      if (SEL.isMine(m, t)) {
        if (now - intent > 15000) continue;
        const str = (t.innerText || t.textContent || '').trim();
        while (recentMine.length && now - recentMine[0].at > 60000) recentMine.shift();
        if (recentMine.some((r) => r.hash === messageHash(str))) continue;
        recentMine.push({ hash:messageHash(str), at: now }); lastMineAt = now;
        try { onMine(str); } catch (err) { console.warn('[말랑펫]', err); }
      } else if (now - intent < 180000) {
        watching.set(id, { m, len: -1, stable: 0, start: now });
      }
    }
    if (seen.size > 3000) { seen.clear(); all.forEach((m) => seen.add(m.getAttribute(SEL.messageId))); }
  }
  // 정실 답장은 다 써질 때까지 기다렸다가 한 번만 읽어요
  setInterval(() => {
    const now = Date.now();
    for (const [id, w] of watching) {
      const t = w.m.isConnected && w.m.querySelector(SEL.text);
      const len = t ? t.textContent.length : 0;
      if (len > 0 && len === w.len) w.stable++; else { w.stable = 0; w.len = len; }
      if (w.stable >= 3 || now - w.start > 150000 || !w.m.isConnected) {
        watching.delete(id);
        if (len > 0 && state.react) { try { onOshi(t.innerText || t.textContent || ''); } catch (err) { console.warn('[말랑펫]', err); } }
      }
    }
  }, 1000);

  function afterChat(gift) {
    if (gift) { if (appOpen()) toast(`대화 기념 선물: ${FURN[gift].name}!`); else walkerReact('sparkle', `선물 받았어! ${FURN[gift].name}`); }
    save(); refreshActors(); if (appOpen() && view === 'home') { updateStats(); const s = $('.strip'); if (s) { const rec = state.days[day()]; s.outerHTML = `<div class="strip">${MOODS[weatherCache.mood].icon} 오늘의 날씨 <b>${MOODS[weatherCache.mood].name}</b><span class="r">대화 ${rec.c}번 · 💕${rec.love} · 💢${rec.bad}</span></div>`; } }
  }
  function onMine(str) {
    simulate();
    const p = pet(), kind = analyzeMine(str), rec = today();
    rec.c++; p.chats++; p.day.chats++; p.xp++; p.bond = clamp(p.bond + 0.2, 0, 1e9);
    if (kind === 'love') rec.love++; if (kind === 'bad') rec.bad++; if (kind === 'sad') rec.sad++;
    if (p.stage !== 'egg' && !p.sleeping) {
      if (kind === 'love') p.fun = clamp(p.fun + 6); else if (kind === 'bad') p.fun = clamp(p.fun - 6); else if (kind === 'food') p.hunger = clamp(p.hunger + 3); else p.fun = clamp(p.fun + 1);
    }
    const gift = checkGifts(); simulate();
    const [ex, fx] = MY_REACT[kind];
    if (p.stage === 'egg') { walkerReact('sparkle', null); if (appOpen()) say('(알이 대화를 듣고 꼼지락거려요)', null, 'sparkle'); }
    else if (p.sleeping) { walkerReact('z', null); if (appOpen()) say('쿨… 쿨…', 'sleep', 'z'); }
    else {
      const msg = fill(pick((HEARD[p.profile.type] || HEARD.sweet)[kind]));
      setExpr(ex);
      if (appOpen()) say(msg, ex, fx); else walkerReact(fx, kind === 'neutral' && Math.random() < 0.6 ? null : msg);
    }
    afterChat(gift);
  }
  function onOshi(str) {
    simulate();
    const p = pet(), kind = analyzeOshi(str);
    if (!kind) return;
    const rec = today(), R = OSHI_REACT[kind];
    if (kind === 'love' || kind === 'laugh') rec.love++; else if (kind === 'angry') rec.bad++; else if (kind === 'sad') rec.sad++; else if (kind === 'shy') rec.shy++;
    refreshWeather();
    if (p.stage === 'egg' || p.sleeping) { afterChat(null); return; }
    setExpr(R.expr, 4000);
    if (appOpen()) say(R.tag, R.expr, R.fx); else walkerReact(R.fx, R.tag);
    afterChat(null);
  }
  const chatObserver = new MutationObserver(() => { clearTimeout(scanChat.t); scanChat.t = setTimeout(scanChat, 400); });
  chatObserver.observe(document.body, { childList: true, subtree: true });

  /* =========================================================
   * 시간 흐름 · 방 안에서 돌아다니기
   * ========================================================= */
  let ticks = 0;
  setInterval(() => {
    if (location.href !== lastURL) { lastURL = location.href; bootUntil = Date.now() + 4000; intent = 0; watching.clear(); }
    if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
  }, 1000);
  setInterval(() => {
    if (document.hidden) return;
    simulate(); ticks++;
    const p = pet();
    if (p.sleeping) p.energy = clamp(p.energy + 2);
    if (ticks % 6 === 0) save();
    refreshActors();
    if (!appOpen() || roomEdit || view !== 'home' || p.sleeping || p.stage === 'egg' || dragging) return;
    if (ticks % 2 === 0 && Date.now() > sayUntil) {
      const spots = state.room.items.filter((a) => !FURN[a.type].wall && !['bed', 'canopy', 'rug'].includes(a.type));
      let nx, ny;
      if (spots.length && Math.random() < 0.5) { const a = pick(spots), F = FURN[a.type]; nx = clamp(a.x + F.w / 2 + (Math.random() < 0.5 ? -1 : 1) * (F.w / 2 + 6), 14, RW - 14); ny = clamp(a.y + F.h + 2, FLOOR_Y+8, RH - 2); }
      else { nx = 14 + Math.random() * (RW - 28); ny = 84 + Math.random() * 23; }
      actor.face = nx < actor.x ? -1 : 1; actor.x = Math.round(nx); actor.y = Math.round(ny); actor.mood='walk';refreshActors();setTimeout(()=>{actor.mood='';refreshActors();},2100);
      if (Math.random() < 0.35) setTimeout(() => say(line('idle')), 2100);
    }
    updateStats();
  }, 5000);

  addEventListener('resize', placeWalker);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { simulate(); save(); refreshActors(); placeWalker(); } });
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('말랑펫 열기 / 다시 보이기', () => { state.hidden = false; save(); placeWalker(); open(); });
    GM_registerMenuCommand('말랑펫 숨기기', () => { state.hidden = true; save(); placeWalker(); close(); });
    GM_registerMenuCommand('말랑펫 위치 처음으로', () => { state.pos = { x: 0.9, y: 0.78 }; state.hidden = false; walker.x = null; save(); placeWalker(); });
  }
  if (typeof GM_addValueChangeListener === 'function') GM_addValueChangeListener(KEY, (_k, _o, value, remote) => {
    if (!remote || dragging || painting) return;
    try {
      const next = typeof value === 'string' ? JSON.parse(value) : value;
      if (!next || next.v !== 3) return;
      state = normalize(next);
      const editing = root.activeElement && root.activeElement.matches('input,textarea,select');
      if (appOpen() && !editing) render(); else { placeWalker(); refreshActors(); }
    } catch (e) { console.warn('[말랑펫] 다른 탭의 기록을 읽지 못했어요.', e); }
  });

  simulate(); save(); placeWalker(); refreshActors();
})();
