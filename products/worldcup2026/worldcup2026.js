// ═══════════════════════════════════════════
// BUILD VERSION
// Cập nhật số version này sau mỗi lần build để dễ phân biệt bản đang deploy.
// ═══════════════════════════════════════════
const APP_VERSION='v2.6.0';
const APP_BUILD_DATE='2026-06-23';
const APP_BUILD_TARGET='github-pages-single-file';
window.WC2026_BUILD={version:APP_VERSION,buildDate:APP_BUILD_DATE,target:APP_BUILD_TARGET};

// ═══════════════════════════════════════════
// DARK / LIGHT THEME
// ═══════════════════════════════════════════
function applyTheme(mode){
  document.documentElement.setAttribute('data-theme',mode);
  try{localStorage.setItem('wc2026-theme',mode);}catch(e){}
  const tc=document.querySelector('meta[name="theme-color"]');if(tc)tc.content=mode==='light'?'#F4F6F9':'#0D1117';
  const cs=document.querySelector('meta[name="color-scheme"]');if(cs)cs.content=mode;
  const btn=document.getElementById('themeToggleBtn');if(btn)btn.textContent=mode==='light'?'☀️':'🌙';
}
function toggleTheme(){
  applyTheme(document.documentElement.getAttribute('data-theme')==='light'?'dark':'light');
}

// ═══════════════════════════════════════════
// KHÓA SCROLL NỀN KHI CÓ POPUP MỞ (match/team modal, sheet phân tích/cầu thủ, changelog)
// Dùng MutationObserver theo dõi class .on trên toàn bộ body — không cần sửa từng nơi
// mở/đóng popup rải rác trong HTML/JS, tự bắt được cả changelogModal được tạo động sau này.
// ═══════════════════════════════════════════
function setupModalScrollLock(){
  const overlayIds=['mModal','tmModal','analysisSheet','changelogModal'];
  const updateLock=()=>{
    const anyOpen=overlayIds.some(id=>document.getElementById(id)?.classList.contains('on'));
    document.documentElement.style.overflow=anyOpen?'hidden':'';
  };
  new MutationObserver(updateLock).observe(document.body,{attributes:true,attributeFilter:['class'],subtree:true});
  updateLock();
}
function renderBuildVersion(){
  const versionEl=document.getElementById('appVersionLabel');
  const dateEl=document.getElementById('appBuildDate');
  if(versionEl)versionEl.textContent=APP_VERSION;
  if(dateEl)dateEl.textContent='Build '+APP_BUILD_DATE;
  document.documentElement.dataset.appVersion=APP_VERSION;
  console.info(`[WC2026] ${APP_VERSION} · Build ${APP_BUILD_DATE} · ${APP_BUILD_TARGET}`);
}


// Escape HTML để render dữ liệu an toàn từ API/RSS và tránh ReferenceError khi ticker/news render.
function escapeHTML(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

// ═══════════════════════════════════════════
// FLAG HELPER
// ═══════════════════════════════════════════
const FB='https://flagcdn.com/';
const CC_MAP={
  'Mexico':'mx','South Africa':'za','South Korea':'kr','Canada':'ca',
  'Qatar':'qa','Switzerland':'ch','Brazil':'br','Morocco':'ma',
  'Haiti':'ht','Scotland':'gb','USA':'us','Paraguay':'py',
  'Australia':'au','Germany':'de','Curaçao':'cw','Ivory Coast':'ci',
  'Ecuador':'ec','Netherlands':'nl','Japan':'jp','Tunisia':'tn',
  'Belgium':'be','Egypt':'eg','Iran':'ir','New Zealand':'nz',
  'Spain':'es','Saudi Arabia':'sa','Uruguay':'uy','Cape Verde':'cv',
  'France':'fr','Senegal':'sn','Norway':'no','Argentina':'ar',
  'Algeria':'dz','Austria':'at','Jordan':'jo','Portugal':'pt',
  'Uzbekistan':'uz','Colombia':'co','England':'gb','Croatia':'hr',
  'Ghana':'gh','Panama':'pa','Vietnam':'vn','Việt Nam':'vn',
  'Séc':'cz','Czechia':'cz','Czech Republic':'cz',
  'Bosnia & Herzegovina':'ba','Bosnia and Herzegovina':'ba',
  'Thổ Nhĩ Kỳ':'tr','Türkiye':'tr','Turkey':'tr',
  'Thụy Điển':'se','Sweden':'se',
  'Iraq':'iq',
  'CH Congo':'cd','DR Congo':'cd','Congo DR':'cd',
  'UEFA Path A winner':'eu','UEFA Path B winner':'eu','UEFA Path C winner':'eu',
  'UEFA Path D winner':'eu','IC Path 1 winner':'un','IC Path 2 winner':'un',

  'Nam Phi':'za',
  'Ả Rập Xê-út':'sa',
  'Hàn Quốc':'kr',
  'Thụy Sĩ':'ch',
  'Bờ Biển Ngà':'ci',
  'Hà Lan':'nl',
  'Cabo Verde':'cv',
  'Úc':'au',
  'Bồ Đào Nha':'pt',
  'Ma-rốc':'ma',
  'Đức':'de',
  'Bỉ':'be',
  'Áo':'at',
  'Anh':'gb',
  'Pháp':'fr',
  'Na Uy':'no',
  'Nhật Bản':'jp',
  'Ai Cập':'eg',
  'Tây Ban Nha':'es',
  'Mỹ':'us',
};
function getCC(name){
  if(!name)return'un';
  const cc=CC_MAP[name];
  if(cc)return cc;
  // try partial match
  for(const[k,v] of Object.entries(CC_MAP)){if(name.toLowerCase().includes(k.toLowerCase()))return v;}
  return'un';
}
function flagImg(cc,sz='w40'){
  const img=document.createElement('img');
  img.src=`${FB}${sz}/${cc.toLowerCase()}.png`;
  img.alt=cc;img.loading='lazy';
  img.onerror=()=>{img.style.display='none'};
  return img;
}
function mkFlag(cc,cls='md'){
  const sizes={xs:'w20',sm:'w20',md:'w40',lg:'w40',xl:'w80',xxl:'w80'};
  const s=document.createElement('span');
  s.className=`fl ${cls}`;
  s.appendChild(flagImg(cc,sizes[cls]||'w40'));
  return s;
}
function injectFlag(id,cc,cls='md'){
  const el=document.getElementById(id);
  if(el&&!el.dataset.done){el.appendChild(mkFlag(cc,cls));el.dataset.done='1';}
}

// ═══════════════════════════════════════════
// DATA FETCHING FROM REAL SOURCE
// ═══════════════════════════════════════════
const DATA_URL='https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
let WC_DATA=null;

async function fetchWCData(){
  try{
    const res=await fetch(DATA_URL);
    if(!res.ok)throw new Error('HTTP '+res.status);
    WC_DATA=await res.json();
    setApiStatus(true,'Dữ liệu thực tế · openfootball');
    return WC_DATA;
  }catch(e){
    setApiStatus(false,'Lỗi tải data · Dùng cache');
    WC_DATA=getFallbackData();
    return WC_DATA;
  }
}

function setApiStatus(state,txt){
  const dot=document.getElementById('apiDot');
  const t=document.getElementById('apiTxt');
  if(dot){
    let cls='api-dot';
    if(state===true||state==='live')cls+=' live';
    if(state===false||state==='error')cls+=' err';
    dot.className=cls;
  }
  if(t)t.textContent=txt||'';
}

// ═══════════════════════════════════════════
// TIME UTILITIES
// ═══════════════════════════════════════════
function parseMatchTime(date,time){
  // time format: "13:00 UTC-6" → trả về đúng instant UTC thật của trận đấu.
  // QUAN TRỌNG: chỉ lưu giờ UTC thật (utcH), KHÔNG cộng thêm +7 ở đây — nơi hiển thị
  // (toLocaleString/toLocaleTimeString với timeZone:'Asia/Ho_Chi_Minh') sẽ tự quy đổi sang giờ VN.
  // Trước đây code cộng +7 rồi setUTCHours(vnH,...) khiến instant lưu sai 7 giờ, làm lệch giờ
  // hiển thị (so với formatVNTime tính trực tiếp) và sai luôn cả thời điểm tính trạng thái live/done.
  if(!date||!time)return null;
  const [hm,utcPart]=time.split(' ');
  const [h,m]=hm.split(':').map(Number);
  const utcOffset=utcPart?parseInt(utcPart.replace('UTC',''),10):0;
  const utcH=h-utcOffset; // convert to UTC
  const dt=new Date(date);
  dt.setUTCHours(utcH,m,0,0);
  return dt;
}

function matchStatus(match){
  const now=new Date();
  // Chỉ coi là "done" khi đã có score.ft thật — match.score có thể tồn tại nhưng chỉ chứa ht (bán thời)
  // trong lúc trận đang diễn ra, lúc đó vẫn phải rơi xuống logic tính theo thời gian bên dưới (live/soon).
  if(match.score&&match.score.ft){
    return{status:'done',label:'FT',score:match.score.ft};
  }
  const start=parseMatchTime(match.date,match.time);
  if(!start)return{status:'soon',label:formatVNTime(null,match.date,match.time)};
  const diff=(now-start)/60000;
  if(diff>0&&diff<115){
    const min=Math.floor(diff);
    const displayMin=min>90?'90+':String(min)+"'";
    return{status:'live',label:displayMin};
  }
  if(diff>=115)return{status:'done',label:'FT',score:null};
  return{status:'soon',label:formatVNTime(start)};
}

function formatVNTime(dt,date,rawTime){
  // Convert UTC offset time to VN time string
  if(!dt&&date&&rawTime){
    const [hm,utcPart]=rawTime.split(' ');
    const [h,m]=hm.split(':').map(Number);
    const utcOffset=utcPart?parseInt(utcPart.replace('UTC',''),10):0;
    let vnH=h-utcOffset+7;
    if(vnH>=24)vnH-=24;
    return `${String(vnH).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  if(!dt)return'—';
  return dt.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});
}

function formatDate(dateStr){
  // Luôn neo theo nửa đêm giờ Việt Nam (UTC+7) rồi format lại theo đúng múi giờ này,
  // để ngày hiển thị không bị lệch nếu trình duyệt người xem ở múi giờ khác (ví dụ UTC+8/+9).
  const d=new Date(dateStr+'T00:00:00+07:00');
  return d.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'});
}

function vnDateKey(dt){
  if(!dt||isNaN(dt))return'';
  return dt.toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
}
function groupMatchesByDate(matches){
  // Nhóm theo ngày THỰC TẾ ở giờ Việt Nam (suy ra từ giờ đấu đã quy đổi),
  // không dùng trực tiếp m.date (ngày theo lịch nước chủ nhà) vì các trận tối ở
  // Mexico/USA/Canada (UTC-4 đến UTC-8) hầu hết rơi sang NGÀY KẾ TIẾP theo giờ VN (UTC+7).
  const groups={};
  matches.forEach(m=>{
    const key=vnDateKey(matchStartDate(m))||m.date;
    if(!groups[key])groups[key]=[];
    groups[key].push(m);
  });
  return groups;
}

// ═══════════════════════════════════════════
// RENDER SCHEDULE
// ═══════════════════════════════════════════
// Dịch tên đội từ API (tiếng Anh) → tiếng Việt
const EN_VN={
  'Germany':'Đức','France':'Pháp','England':'Anh','Netherlands':'Hà Lan',
  'Spain':'Tây Ban Nha','Japan':'Nhật Bản','South Korea':'Hàn Quốc',
  'Republic of Korea':'Hàn Quốc','Korea Republic':'Hàn Quốc',
  'Norway':'Na Uy','Switzerland':'Thụy Sĩ','Australia':'Úc',
  'Portugal':'Bồ Đào Nha','Morocco':'Ma-rốc','Saudi Arabia':'Ả Rập Xê-út',
  'Belgium':'Bỉ','Egypt':'Ai Cập','Ivory Coast':'Bờ Biển Ngà',
  "Côte d'Ivoire":"Bờ Biển Ngà",'South Africa':'Nam Phi',
  'Austria':'Áo','Tunisia':'Tunisia','Cape Verde':'Cabo Verde',
  'Senegal':'Senegal','Ecuador':'Ecuador','Colombia':'Colombia',
  'Algeria':'Algeria','Jordan':'Jordan','Croatia':'Croatia',
  'Ghana':'Ghana','Panama':'Panama','Uzbekistan':'Uzbekistan',
  'Uruguay':'Uruguay','Paraguay':'Paraguay','Haiti':'Haiti',
  'Scotland':'Scotland','New Zealand':'New Zealand','Qatar':'Qatar',
  'Iran':'Iran','Curaçao':'Curaçao','Iran IR':'Iran',
  'USA':'Mỹ','United States':'Mỹ','Mexico':'Mexico',
  'Brazil':'Brazil','Canada':'Canada','Argentina':'Argentina',
  'Czechia':'Séc','Czech Republic':'Séc',
  'Bosnia and Herzegovina':'Bosnia & Herzegovina',
  'Bosnia & Herzegovina':'Bosnia & Herzegovina',
  'Turkey':'Thổ Nhĩ Kỳ','Türkiye':'Thổ Nhĩ Kỳ',
  'Sweden':'Thụy Điển','Iraq':'Iraq',
  'DR Congo':'CH Congo','Congo DR':'CH Congo',
  'Democratic Republic of Congo':'CH Congo',
};
function tn(name){return EN_VN[name]||name;}
// Vị trí cầu thủ (từ cột Pos. squad Wikipedia) — dịch sang tiếng Việt, giữ lại mã gốc trong dấu ngoặc cho người quen thuật ngữ quốc tế.
const POS_VN={GK:'Thủ môn',DF:'Hậu vệ',MF:'Tiền vệ',FW:'Tiền đạo',CB:'Trung vệ',RB:'Hậu vệ phải',LB:'Hậu vệ trái',CM:'Tiền vệ trung tâm',DM:'Tiền vệ trụ',AM:'Tiền vệ tấn công',RW:'Tiền vệ cánh phải',LW:'Tiền vệ cánh trái',ST:'Tiền đạo cắm'};
function posVN(code){const c=String(code||'').trim().toUpperCase();return POS_VN[c]?POS_VN[c]+' ('+c+')':code;}

function renderSchedule(data){
  const container=document.getElementById('matchesContainer');
  if(!data||!data.matches){
    container.innerHTML='<div class="error-state">⚠ Không thể tải dữ liệu lịch thi đấu</div>';
    return;
  }

  // Group stage + knockout matches (all rounds)
  const groupStage=data.matches.filter(m=>m.group);
  const knockout=data.matches.filter(m=>!m.group&&m.round);

  // Build stats
  let totalGoals=0,doneCount=0;
  data.matches.forEach(m=>{
    if(m.score&&m.score.ft){
      totalGoals+=m.score.ft[0]+m.score.ft[1];
      doneCount++;
    }
  });
  document.getElementById('kpi-goals').textContent=totalGoals;
  document.getElementById('kpi-matches').textContent=doneCount+'/'+data.matches.length;

  // Build grouped by date
  const byDate=groupMatchesByDate(data.matches);
  const dates=Object.keys(byDate).sort();

  let html='';
  let currentFilter='all';

  // Live matches first
  const liveMatches=data.matches.filter(m=>matchStatus(m).status==='live');
  if(liveMatches.length>0){
    html+=`<div data-mf="live"><div class="day-sep"><div class="ds-txt red"><span class="live-dot"></span>Đang Thi Đấu</div><div class="ds-line"></div></div>`;
    liveMatches.forEach(m=>{
      const st=matchStatus(m);
      html+=buildMatchCard(m,st,'live-m');
    });
    html+='</div>';
  }

  // Done matches
  const doneMatches=data.matches.filter(m=>matchStatus(m).status==='done');
  if(doneMatches.length>0){
    // Group by date
    const doneByDate=groupMatchesByDate(doneMatches);
    const doneDates=Object.keys(doneByDate).sort().reverse().slice(0,3);
    html+=`<div data-mf="done">`;
    doneDates.forEach(date=>{
      html+=`<div class="day-sep"><div class="ds-line"></div><div class="ds-txt">${formatDate(date)} — Kết Thúc</div><div class="ds-line"></div></div>`;
      doneByDate[date].forEach(m=>{
        const st=matchStatus(m);
        html+=buildMatchCard(m,st,'');
      });
    });
    html+='</div>';
  }

  // Upcoming — by date, next 10 days
  const today=new Date().toISOString().split('T')[0];
  const soonDates=dates.filter(d=>d>=today).slice(0,10);
  if(soonDates.length>0){
    html+=`<div data-mf="soon">`;
    soonDates.forEach(date=>{
      const dayMatches=byDate[date].filter(m=>matchStatus(m).status==='soon');
      if(!dayMatches.length)return;
      html+=`<div class="day-sep"><div class="ds-line"></div><div class="ds-txt">${formatDate(date)}</div><div class="ds-line"></div></div>`;
      dayMatches.forEach(m=>{
        const st=matchStatus(m);
        html+=buildMatchCard(m,st,'');
      });
    });
    html+='</div>';
  }

  if(!html){
    html=`<div class="loading-state"><div style="font-size:32px">📅</div><div class="loading-txt">Giải đấu bắt đầu ngày 11/06/2026</div></div>`;
  }

  container.innerHTML=hiddenNote+html;

  // Inject flags after render
  container.querySelectorAll('[data-t1],[data-t2]').forEach(el=>{
    const cc=el.dataset.cc;
    if(cc&&!el.dataset.done){el.appendChild(flagImg(cc,'w40'));el.dataset.done='1';}
  });

  // Click handlers
  container.querySelectorAll('.mc').forEach(card=>{
    card.addEventListener('click',()=>{
      const t1=card.dataset.team1,t2=card.dataset.team2;
      const s1=card.dataset.s1,s2=card.dataset.s2;
      const grp=card.dataset.grp,ven=card.dataset.ven,st=card.dataset.st;
      const vnt=card.dataset.vnt||'';
      openMatchModal(t1,t2,s1,s2,getCC(t1),getCC(t2),st,grp,ven,'',vnt);
    });
  });
}

function buildMatchCard(m,st,extraCls){
  const cc1=getCC(m.team1),cc2=getCC(m.team2);
  const s1=m.score&&m.score.ft?String(m.score.ft[0]):'';
  const s2=m.score&&m.score.ft?String(m.score.ft[1]):'';
  // Tên đội/sân/bảng đấu đến từ nguồn mở bên ngoài (openfootball) — escape trước khi render qua innerHTML
  // để phòng vệ XSS nếu nguồn dữ liệu có ký tự HTML, dù hiện tại là repo đáng tin cậy.
  const team1Name=escapeHTML(tn(m.team1)),team2Name=escapeHTML(tn(m.team2));
  const grp=escapeHTML(m.group||m.round||'');
  const ven=escapeHTML(m.ground||'');
  const vnTime=formatVNTime(null,m.date,m.time);

  let timeHtml='',scoreHtml='',bdg='';
  if(st.status==='live'){
    timeHtml=`<div class="mc-time lv">${st.label}</div>`;
    scoreHtml=`<div class="mc-sv"><span class="mc-s">${s1}</span><span class="mc-dash">–</span><span class="mc-s">${s2}</span></div>`;
    bdg=`<span class="bdg bdg-lv">● Live</span>`;
  }else if(st.status==='done'){
    timeHtml=`<div class="mc-time">✓</div>`;
    scoreHtml=s1!==''
      ?`<div class="mc-sv"><span class="mc-s">${s1}</span><span class="mc-dash">–</span><span class="mc-s">${s2}</span></div>`
      :`<div class="mc-sv"><span class="mc-s" style="font-size:14px;color:var(--text3)">—</span></div>`;
    bdg='';
  }else{
    timeHtml=`<div class="mc-time">${vnTime}</div>`;
    scoreHtml=`<div class="mc-sv"><span class="mc-vs">VS</span></div>`;
    bdg=`<span class="bdg bdg-grp">${grp}</span>`;
  }
  // Store computed VN time for use in modal
  const modalStatus=st.status==='done'?'Đã kết thúc':st.status==='live'?'● Đang live: '+st.label:'Giờ VN: '+vnTime;

  return `<div class="mc ${extraCls}"
    data-team1="${team1Name}" data-team2="${team2Name}"
    data-s1="${s1}" data-s2="${s2}"
    data-grp="${grp}" data-ven="${ven}" data-st="${escapeHTML(modalStatus)}" data-vnt="${vnTime}"
    data-goals1="${escapeHTML(JSON.stringify(m.goals1||[]))}" data-goals2="${escapeHTML(JSON.stringify(m.goals2||[]))}">
    <div class="mc-t">${timeHtml}</div>
    <div class="mc-b">
      <div class="mc-tl">
        <span class="fl md"><img src="${FB}w40/${cc1}.png" onerror="this.style.display='none'" loading="lazy" alt="${cc1}"></span>
        <span class="mc-nm">${team1Name}</span>
      </div>
      ${scoreHtml}
      <div class="mc-tr">
        <span class="mc-nm">${team2Name}</span>
        <span class="fl md"><img src="${FB}w40/${cc2}.png" onerror="this.style.display='none'" loading="lazy" alt="${cc2}"></span>
      </div>
    </div>
    <div class="mc-r">${bdg}<span class="mc-ven">${ven}</span></div>
  </div>`;
}

// ═══════════════════════════════════════════
// GROUPS — build from real data
// ═══════════════════════════════════════════
function buildGroups(data){
  const FB='https://flagcdn.com/';

  // ── Bước 1: Xây dựng bảng từ TEAMS_STATIC (nguồn chính xác) ─────────────
  // Khởi tạo stats 0 cho tất cả đội
  const groups={}; // { 'A': { id:'A', teams:{ 'Brazil':{n,p,w,d,l,gf,ga,cc}, ... } } }
  TEAMS_STATIC.forEach(t=>{
    const gid=t.g; // 'A','B',...,'L'
    if(!groups[gid])groups[gid]={id:gid,teams:{}};
    groups[gid].teams[t.n]={n:t.n,cc:t.cc,p:0,w:0,d:0,l:0,gf:0,ga:0};
  });

  // ── Bước 2: Overlay kết quả thực từ API (nếu có) ─────────────────────────
  if(data&&data.matches){
    data.matches.filter(m=>m.group&&m.score&&m.score.ft).forEach(m=>{
      // Tên đội từ API là tiếng Anh → dịch sang tiếng Việt để match với TEAMS_STATIC
      const vnT1=tn(m.team1), vnT2=tn(m.team2);
      // Tìm bảng chứa trận đấu này (API dùng "Group A" → lấy chữ cuối)
      const gidFull=m.group; // 'Group A'
      const gid=gidFull.replace('Group ','');
      if(!groups[gid])return;
      const t1=groups[gid].teams[vnT1];
      const t2=groups[gid].teams[vnT2];
      if(!t1||!t2)return; // đội không có trong TEAMS_STATIC
      const [s1,s2]=m.score.ft;
      t1.gf+=s1;t1.ga+=s2;
      t2.gf+=s2;t2.ga+=s1;
      if(s1>s2){t1.w++;t1.p+=3;t2.l++;}
      else if(s1<s2){t2.w++;t2.p+=3;t1.l++;}
      else{t1.d++;t1.p++;t2.d++;t2.p++;}
    });
  }

  // ── Bước 3: Sắp xếp theo điểm ──────────────────────────────────────────
  function sortTeams(g){
    return Object.values(groups[g].teams)
      .sort((a,b)=>b.p-a.p||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);
  }

  const groupList=Object.keys(groups).sort()
    .map(id=>({id,teams:sortTeams(id)}));

  // ── Bước 4: Render tất cả bảng A→L theo thứ tự, trải dài từ trên xuống ──
  const sg=document.getElementById('sgGrid');
  if(sg)sg.innerHTML=groupList.map(g=>{
    let played=0;
    if(data&&data.matches){
      played=data.matches.filter(m=>m.group===('Group '+g.id)&&m.score&&m.score.ft).length;
    }
    const totalMatches=6; // mỗi bảng 4 đội × 6 trận vòng bảng
    const rows=g.teams.map((t,i)=>{
      const gd=t.gf-t.ga;
      return`<tr class="${i<2?'q':''}">
        <td><div class="sgt-team">
          <span class="fl sm"><img src="${FB}w40/${t.cc}.png"
            onerror="this.style.display='none'" loading="lazy" alt="${t.n}"></span>
          <span class="sgt-nm">${t.n}</span>
        </div></td>
        <td>${t.w+t.d+t.l}</td>
        <td>${t.w}</td>
        <td>${t.d}</td>
        <td>${t.l}</td>
        <td>${t.gf}</td>
        <td>${t.ga}</td>
        <td class="${gd>0?'clr-p':gd<0?'clr-n':''}">${gd>0?'+':''}${gd}</td>
        <td><span class="sgt-pts">${t.p}</span></td>
      </tr>`;
    }).join('');
    return `<div class="sgc">
      <div class="sgc-head">
        <div class="sgc-title">Bảng ${g.id}</div>
        <div class="sgc-sub">${played}/${totalMatches} trận đã đấu</div>
      </div>
      <table class="sgt">
        <thead><tr>
          <th>Đội</th><th>Trận</th><th>Thắng</th><th>Hòa</th><th>Thua</th>
          <th>Bàn thắng</th><th>Bàn thua</th><th>Hiệu số</th><th>Điểm</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════
// STATS — built from real data
// ═══════════════════════════════════════════
function buildStats(data){
  let totalGoals=0,doneCount=0,cards=0;
  const scorers={};
  if(data&&data.matches){
    data.matches.forEach(m=>{
      if(m.score&&m.score.ft){
        totalGoals+=m.score.ft[0]+m.score.ft[1];
        doneCount++;
      }
      // Count goals from goals1/goals2 arrays if available, ghi nhận luôn đội của cầu thủ để hiện cờ
      const mKey=m.date+'|'+m.team1+'|'+m.team2;
      (m.goals1||[]).forEach(g=>{
        const k=g.name;
        if(!scorers[k])scorers[k]={name:k,goals:0,team:m.team1,matches:new Set()};
        scorers[k].goals++;scorers[k].matches.add(mKey);
      });
      (m.goals2||[]).forEach(g=>{
        const k=g.name;
        if(!scorers[k])scorers[k]={name:k,goals:0,team:m.team2,matches:new Set()};
        scorers[k].goals++;scorers[k].matches.add(mKey);
      });
    });
  }

  const topScorers=Object.values(scorers).sort((a,b)=>b.goals-a.goals).slice(0,10);
  // Đồng hạng khi bằng số bàn (giống bảng thống kê thật: 2 người cùng 4 bàn thì cùng hạng 2).
  let lastGoals=null,lastRank=0;
  const ranked=topScorers.map((s,i)=>{
    if(s.goals!==lastGoals){lastRank=i+1;lastGoals=s.goals;}
    return{...s,rank:lastRank};
  });
  const el=document.getElementById('homeTopScorers');
  if(el)el.innerHTML=ranked.length?ranked.map((s,i)=>`
      <div class="sc-row" onclick="openPlayerSheet('${encodeURIComponent(s.name)}','${encodeURIComponent(s.team)}')">
        <span class="sc-rank ${s.rank===1?'g1':s.rank===2?'g2':s.rank===3?'g3':''}">${s.rank}</span>
        <span class="sc-avatar" id="scAvatar-${slugifyName(s.name)}">👤</span>
        <div class="sc-info">
          <div class="sc-nm">${escapeHTML(s.name)}</div>
          <div class="sc-tm"><span class="fl xs"><img src="${FB}w20/${getCC(s.team)}.png" onerror="this.style.display='none'" loading="lazy" alt=""></span>${escapeHTML(tn(s.team))} · ${s.matches.size} trận</div>
        </div>
        <div class="sc-goals">${s.goals}</div>
      </div>`).join('')
    :`<div class="home-empty">Dữ liệu vua phá lưới sẽ cập nhật sau khi các trận đầu tiên kết thúc.</div>`;
  if(ranked.length)loadScorerAvatars(ranked);
  loadTeamShotStats(data);
}
// Tải avatar cầu thủ — cache + dedup theo TÊN (không theo index) trong session, vì buildStats() có thể
// chạy lại nhiều lần (render từ cache rồi render lại từ data thật, refreshData() mỗi 60s...) — nếu dùng
// index làm id slot sẽ bị lệch ảnh/mất ảnh khi 2 lượt render chồng lên nhau với thứ tự cầu thủ khác nhau,
// và nếu không dedup sẽ bắn trùng nhiều request cho cùng 1 cầu thủ.
const PLAYER_AVATAR_CACHE={};
const PLAYER_AVATAR_INFLIGHT={};
function slugifyName(name){return String(name||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-');}
// Nguồn phụ — TheSportsDB (miễn phí, có CORS), dùng khi Wikipedia không có ảnh (cầu thủ trẻ/ít nổi tiếng
// thường có trang Wikipedia nhưng infobox chưa gắn ảnh). Đối chiếu quốc tịch để tránh nhầm người trùng tên.
async function fetchSportsDbAvatar(name,nationalityEN){
  try{
    const res=await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(name)}`);
    if(!res.ok)return null;
    const j=await res.json();
    const players=j?.player||[];
    if(!players.length)return null;
    const match=(nationalityEN&&players.find(p=>p.strNationality&&normalizeText(p.strNationality)===normalizeText(nationalityEN)))||players[0];
    return match?.strCutout||match?.strThumb||null;
  }catch(e){return null;}
}
// Nguồn ảnh DUY NHẤT dùng chung cho cả danh sách Vua phá lưới, danh sách cầu thủ trong modal đội tuyển,
// và popup chi tiết cầu thủ — đảm bảo đồng bộ ảnh ở mọi nơi (trước đây popup dùng path khác nên có thể ra ảnh khác).
// Thứ tự nguồn: Wikipedia (tiếng Anh, ổn định nhất với cầu thủ nổi tiếng) → TheSportsDB (phủ tốt hơn với
// cầu thủ trẻ/ít nổi tiếng mà Wikipedia chưa gắn ảnh).
function resolvePlayerAvatar(name,wikiSlug,nationalityEN){
  if(PLAYER_AVATAR_CACHE[name]!==undefined)return Promise.resolve(PLAYER_AVATAR_CACHE[name]);
  if(PLAYER_AVATAR_INFLIGHT[name])return PLAYER_AVATAR_INFLIGHT[name];
  const p=(async()=>{
    if(wikiSlug){
      try{
        const res=await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiSlug}`);
        if(res.ok){
          const j=await res.json();
          const src=j?.thumbnail?.source||null;
          if(src){PLAYER_AVATAR_CACHE[name]=src;return src;}
        }
      }catch(e){}
    }
    const fallback=await fetchSportsDbAvatar(name,nationalityEN);
    PLAYER_AVATAR_CACHE[name]=fallback;
    return fallback;
  })();
  PLAYER_AVATAR_INFLIGHT[name]=p;
  p.finally(()=>{delete PLAYER_AVATAR_INFLIGHT[name];});
  return p;
}
async function loadScorerAvatars(topScorers){
  try{await fetchSquadData();}catch(e){return;}
  topScorers.forEach(async(s)=>{
    const team=getTeamMeta(s.team);
    const squadMatch=team?findSquadForTeam(team):null;
    const info=squadMatch?.players?.find(p=>normalizeSquadKey(p.name)===normalizeSquadKey(s.name));
    const src=await resolvePlayerAvatar(s.name,info?.wikiSlug,s.team);
    if(src){const slot=document.getElementById(`scAvatar-${slugifyName(s.name)}`);if(slot)slot.innerHTML=`<img src="${src}" alt="" loading="lazy">`;}
  });
}

// ═══════════════════════════════════════════
// TEAMS — from real WC 2026 groups
// ═══════════════════════════════════════════
const TEAMS_STATIC=[
  // ── BẢNG A ──
  {n:'Mexico',g:'A',r:15,c:'NA',cc:'mx',coach:'Javier Aguirre',cap:'Andres Guardado',form:'4-3-3',
   players:['Guillermo Ochoa','Raúl Rangel','Edson Álvarez','Hirving Lozano','Raúl Jiménez','Henry Martín','Orbelin Pineda','Carlos Antuna','Santiago Giménez','Roberto Alvarado','Julián Araujo']},
  {n:'Nam Phi',g:'A',r:65,c:'AF',cc:'za',coach:'Hugo Broos',cap:'Ronwen Williams',form:'4-4-2',
   players:['Ronwen Williams','Bongani Zungu','Percy Tau','Lyle Foster','Themba Zwane','Evidence Makgopa','Teboho Mokoena','Itumeleng Khune','Keagan Dolly','Siyabonga Ngezana','Nkosinathi Sibisi']},
  {n:'Hàn Quốc',g:'A',r:23,c:'AS',cc:'kr',coach:'Hong Myung-bo',cap:'Son Heung-min',form:'4-2-3-1',
   players:['Son Heung-min','Kim Min-jae','Lee Kang-in','Hwang Hee-chan','Cho Gue-sung','Oh Hyeon-gyu','Kwon Chang-hoon','Jung Woo-young','Hwang In-beom','Kim Young-gwon','Kim Jin-su']},
  {n:'Séc',g:'A',r:38,c:'EU',cc:'cz',coach:'Ivan Hašek',cap:'Tomáš Souček',form:'4-2-3-1',
   players:['Tomáš Souček','Patrik Schick','Lukáš Provod','Vladimír Coufal','Jakub Jankto','Alex Král','Jan Kuchta','David Jurásek','Matěj Kovář','Pavel Kadeřábek','Ondřej Lingr']},

  // ── BẢNG B ──
  {n:'Canada',g:'B',r:43,c:'NA',cc:'ca',coach:'Jesse Marsch',cap:'Atiba Hutchinson',form:'4-3-3',
   players:['Alphonso Davies','Jonathan David','Cyle Larin','Tajon Buchanan','Stephen Eustáquio','Milan Borjan','Sam Adekugbe','Alistair Johnston','Liam Millar','Richie Laryea','Jonathan Osorio']},
  {n:'Thụy Sĩ',g:'B',r:19,c:'EU',cc:'ch',coach:'Murat Yakin',cap:'Granit Xhaka',form:'4-2-3-1',
   players:['Granit Xhaka','Xherdan Shaqiri','Haris Seferovic','Ruben Vargas','Breel Embolo','Yann Sommer','Manuel Akanji','Fabian Schär','Denis Zakaria','Steven Zuber','Noah Okafor']},
  {n:'Qatar',g:'B',r:37,c:'AS',cc:'qa',coach:'Marquez Lopez',cap:'Hassan Al-Haydos',form:'4-3-3',
   players:['Saad Al Sheeb','Hassan Al-Haydos','Almoez Ali','Akram Afif','Mohammed Muntari','Pedro Miguel','Abdelkarim Hassan','Boualem Khoukhi','Karim Boudiaf','Abdullah Al-Ahrak','Yusuf Abdurisag']},
  {n:'Bosnia & Herzegovina',g:'B',r:65,c:'EU',cc:'ba',coach:'Sergej Barbarez',cap:'Edin Džeko',form:'4-2-3-1',
   players:['Edin Džeko','Miralem Pjanić','Sead Kolašinac','Asmir Begović','Ermedin Demirović','Amar Dedić','Haris Hajradinović','Benjamin Šeško','Sinisa Stevanović','Hadžic Rijad','Denis Huseinbašić']},

  // ── BẢNG C ──
  {n:'Brazil',g:'C',r:6,c:'SA',cc:'br',coach:'Dorival Júnior',cap:'Marquinhos',form:'4-2-3-1',
   players:['Alisson Becker','Marquinhos','Casemiro','Vinicius Jr','Rodrygo','Raphinha','Endrick','Gabriel Martinelli','Bruno Guimarães','Militão','Renan Lodi']},
  {n:'Ma-rốc',g:'C',r:8,c:'AF',cc:'ma',coach:'Walid Regragui',cap:'Romain Saïss',form:'4-1-4-1',
   players:['Yassine Bounou','Achraf Hakimi','Nayef Aguerd','Romain Saïss','Hakim Ziyech','Sofiane Boufal','Youssef En-Nesyri','Azzedine Ounahi','Selim Amallah','Noussair Mazraoui','Yahya Attiyat Allah']},
  {n:'Haiti',g:'C',r:83,c:'NA',cc:'ht',coach:'Marc Collat',cap:'Duckens Nazon',form:'4-4-2',
   players:['Duckens Nazon','Frantzdy Pierrot','Barbra Murge','Steeven Saba','Thimothé Chery','James Léa Siliki','Zachary Herivaux','Joel Johnson','Derrick Etienne','Stevenson Jean','Derlin Mathurin']},
  {n:'Scotland',g:'C',r:38,c:'EU',cc:'gb',coach:'Steve Clarke',cap:'Andy Robertson',form:'3-4-3',
   players:['Andy Robertson','Scott McTominay','John McGinn','Callum McGregor','Lyndon Dykes','Stuart Armstrong','Ryan Christie','Lawrence Shankland','Kevin Nisbet','Greg Taylor','Billy Gilmour']},

  // ── BẢNG D ──
  {n:'Mỹ',g:'D',r:11,c:'NA',cc:'us',coach:'Mauricio Pochettino',cap:'Tyler Adams',form:'4-3-3',
   players:['Christian Pulisic','Tyler Adams','Weston McKennie','Gio Reyna','Ricardo Pepi','Josh Sargent','Brenden Aaronson','Antonee Robinson','Sergiño Dest','Matt Turner','Walker Zimmerman']},
  {n:'Paraguay',g:'D',r:55,c:'SA',cc:'py',coach:'Daniel Garnero',cap:'Gustavo Gómez',form:'4-4-2',
   players:['Gustavo Gómez','Miguel Almirón','Ángel Romero','Matías Rojas','Óscar Romero','Robert Morales','Alejandro Romero','Diego Gómez','Richard Sánchez','Ramón Sosa','Antonio Sanabria']},
  {n:'Úc',g:'D',r:25,c:'AS',cc:'au',coach:'Graham Arnold',cap:'Mat Ryan',form:'4-4-2',
   players:['Mat Ryan','Mathew Leckie','Ajdin Hrustic','Mitchell Duke','Awer Mabil','Riley McGree','Jackson Irvine','Marco Tilio','Keanu Baccus','Harry Souttar','Nathaniel Atkinson']},
  {n:'Thổ Nhĩ Kỳ',g:'D',r:28,c:'EU',cc:'tr',coach:'Vincenzo Montella',cap:'Hakan Çalhanoğlu',form:'4-3-3',
   players:['Arda Güler','Hakan Çalhanoğlu','Kenan Yıldız','Cenk Tosun','Zeki Çelik','Merih Demiral','Altay Bayındır','Cengiz Ünder','Ferdi Kadıoğlu','Okay Yokuşlu','Barış Alper Yılmaz']},

  // ── BẢNG E ──
  {n:'Đức',g:'E',r:10,c:'EU',cc:'de',coach:'Julian Nagelsmann',cap:'Manuel Neuer',form:'4-2-3-1',
   players:['Manuel Neuer','Joshua Kimmich','Toni Kroos','Kai Havertz','Leroy Sané','Thomas Müller','Jamal Musiala','Ilkay Gündogan','Antonio Rüdiger','Florian Wirtz','Niclas Füllkrug']},
  {n:'Curaçao',g:'E',r:82,c:'NA',cc:'cw',coach:'Dick Advocaat',cap:'Cuco Martina',form:'4-3-3',
   players:['Eloy Room','Leandro Bacuna','Jarchinio Antonia','Cuco Martina','Shermain Martina','Rangelo Janga','Quentin Braat','Gevaro Nepomuceno','Juriën Gaari','Jurien Namcho','Glenn Murray']},
  {n:'Bờ Biển Ngà',g:'E',r:45,c:'AF',cc:'ci',coach:'Emerse Faé',cap:'Serge Aurier',form:'4-3-3',
   players:['Serge Aurier','Franck Kessié','Nicolas Pépé','Sébastien Haller','Max-Alain Gradel','Jean-Michael Seri','Wilfried Zaha','Eric Bailly','Jonathan Kodjia','Ghislain Konan','Willy Boly']},
  {n:'Ecuador',g:'E',r:44,c:'SA',cc:'ec',coach:'Félix Sánchez',cap:'Enner Valencia',form:'4-4-2',
   players:['Enner Valencia','Moisés Caicedo','Pervis Estupiñán','Gonzalo Plata','Ángel Mena','Jeremy Sarmiento','Piero Hincapié','Djorkaeff Reasco','Xavier Arreaga','Michael Estrada','Romario Ibarra']},

  // ── BẢNG F ──
  {n:'Hà Lan',g:'F',r:7,c:'EU',cc:'nl',coach:'Ronald Koeman',cap:'Virgil van Dijk',form:'4-3-3',
   players:['Virgil van Dijk','Frenkie de Jong','Memphis Depay','Cody Gakpo','Steven Bergwijn','Denzel Dumfries','Nathan Aké','Davy Klaassen','Teun Koopmeiners','Wout Weghorst','Tijjani Reijnders']},
  {n:'Nhật Bản',g:'F',r:18,c:'AS',cc:'jp',coach:'Hajime Moriyasu',cap:'Maya Yoshida',form:'4-2-3-1',
   players:['Takumi Minamino','Wataru Endō','Daichi Kamada','Junya Ito','Kaoru Mitoma','Ritsu Doan','Hiroki Sakai','Ko Itakura','Ayase Ueda','Takehiro Tomiyasu','Shuichi Gonda']},
  {n:'Thụy Điển',g:'F',r:20,c:'EU',cc:'se',coach:'Jon Dahl Tomasson',cap:'Viktor Gyökeres',form:'4-3-3',
   players:['Viktor Gyökeres','Alexander Isak','Robin Olsen','Dejan Kulusevski','Emil Forsberg','Isak Hien','Victor Nilsson Lindelöf','Aleksandar Mitrović-Jokić','Sebastian Larsson','Mattias Svanberg','Joel Pohjanpalo']},
  {n:'Tunisia',g:'F',r:32,c:'AF',cc:'tn',coach:'Jalel Kadri',cap:'Wahbi Khazri',form:'4-3-3',
   players:['Wahbi Khazri','Youssef Msakni','Ellyes Skhiri','Hannibal Mejbri','Ghaylen Chaalali','Aïssa Laïdouni','Issam Jebali','Montassar Talbi','Dylan Bronn','Bechir Ben Said','Bilel Ifa']},

  // ── BẢNG G ──
  {n:'Bỉ',g:'G',r:9,c:'EU',cc:'be',coach:'Domenico Tedesco',cap:'Kevin De Bruyne',form:'4-3-3',
   players:['Kevin De Bruyne','Romelu Lukaku','Eden Hazard','Axel Witsel','Jan Vertonghen','Thibaut Courtois','Toby Alderweireld','Youri Tielemans','Leandro Trossard','Jérémy Doku','Dodi Lukebakio']},
  {n:'Ai Cập',g:'G',r:34,c:'AF',cc:'eg',coach:'Rui Vitória',cap:'Mohamed Salah',form:'4-2-3-1',
   players:['Mohamed Salah','Mostafa Mohamed','Omar Marmoush','Mahmoud Trezeguet','Ahmed Hegazi','Mohamed El Shenawy','Amr El Sulaya','Hamdi Fathi','Emam Ashour','Ahmed Sayed Zizo','Karim El Debes']},
  {n:'Iran',g:'G',r:22,c:'AS',cc:'ir',coach:'Amir Ghalenoei',cap:'Ehsan Hajsafi',form:'4-3-3',
   players:['Mehdi Taremi','Sardar Azmoun','Alireza Jahanbakhsh','Ali Gholizadeh','Ehsan Hajsafi','Ahmad Noorollahi','Saman Ghoddos','Saeid Ezatolahi','Morteza Pouraliganji','Ali Beiranvand','Majid Hosseini']},
  {n:'New Zealand',g:'G',r:85,c:'AS',cc:'nz',coach:'Darren Bazeley',cap:'Tommy Smith',form:'4-4-2',
   players:['Bill Tuilagi','Joe Bell','Elijah Just','Liberato Cacace','Ben Old','Marko Stamenic','Matthew Garbett','Clayton Lewis','Tim Payne','Cameron Howieson','Finn Surman']},

  // ── BẢNG H ──
  {n:'Tây Ban Nha',g:'H',r:2,c:'EU',cc:'es',coach:'Luis de la Fuente',cap:'Álvaro Morata',form:'4-3-3',
   players:['Álvaro Morata','Pedri','Gavi','Lamine Yamal','Nico Williams','Alejandro Balde','Rodri','Dani Carvajal','Aymeric Laporte','Unai Simón','Mikel Merino']},
  {n:'Cabo Verde',g:'H',r:69,c:'AF',cc:'cv',coach:'Pedro Brito',cap:'Garry Rodrigues',form:'4-3-3',
   players:['Garry Rodrigues','Gelson Dala','Ryan Mendes','Stopira','Jeffry Fortes','Patrick Andrade','Cláudio Winck','Julinho','Jamiro Monteiro','Rocha','Steven Rieder']},
  {n:'Ả Rập Xê-út',g:'H',r:56,c:'AS',cc:'sa',coach:'Roberto Mancini',cap:'Salem Al-Dawsari',form:'4-1-4-1',
   players:['Salem Al-Dawsari','Mohammed Al-Owais','Saleh Al-Shehri','Abdulrahman Al-Aboud','Ali Al-Bulayhi','Sultan Al-Ghannam','Hassan Al-Tambakti','Firas Al-Buraikan','Sami Al-Najei','Mohammed Al-Bréik','Yasser Al-Shahrani']},
  {n:'Uruguay',g:'H',r:14,c:'SA',cc:'uy',coach:'Marcelo Bielsa',cap:'Diego Godín',form:'4-4-2',
   players:['Darwin Núñez','Federico Valverde','Rodrigo Bentancur','Giorgian De Arrascaeta','Edinson Cavani','Luis Suárez','Diego Godín','Ronald Araújo','Nahitan Nández','Mathías Olivera','Sebastián Coates']},

  // ── BẢNG I ──
  {n:'Pháp',g:'I',r:1,c:'EU',cc:'fr',coach:'Didier Deschamps',cap:'Hugo Lloris',form:'4-3-3',
   players:['Kylian Mbappé','Antoine Griezmann','Désiré Doué','Rayan Cherki','Michael Olise','Marcus Thuram','Aurélien Tchouaméni','Adrien Rabiot','Jules Koundé','William Saliba','Mike Maignan']},
  {n:'Senegal',g:'I',r:20,c:'AF',cc:'sn',coach:'Aliou Cissé',cap:'Kalidou Koulibaly',form:'4-3-3',
   players:['Sadio Mané','Kalidou Koulibaly','Idrissa Gueye','Cheikhou Kouyaté','Ismaila Sarr','Boulaye Dia','Habib Diallo','Nampalys Mendy','Fodé Ballo-Touré','Edouard Mendy','Pape Abou Cissé']},
  {n:'Na Uy',g:'I',r:15,c:'EU',cc:'no',coach:'Ståle Solbakken',cap:'Erling Haaland',form:'4-3-3',
   players:['Erling Haaland','Martin Ødegaard','Alexander Sørloth','Joshua King','Sander Berge','Kristian Thorstvedt','Mohamed Elyounoussi','Leo Skiri Østigård','Veton Berisha','Mathias Normann','Andreas Hanche-Olsen']},
  {n:'Iraq',g:'I',r:58,c:'AS',cc:'iq',coach:'Graham Potter',cap:'Mohanad Ali',form:'4-4-2',
   players:['Mohanad Ali','Amjad Attwan','Ali Jasim','Bashar Resan','Aymen Hussein','Ali Adnan','Ahmed Ibrahim','Saad Abdul-Amir','Hussein Ali','Zeyad Tariq','Osama Rashid']},

  // ── BẢNG J ──
  {n:'Argentina',g:'J',r:3,c:'SA',cc:'ar',coach:'Lionel Scaloni',cap:'Lionel Messi',form:'4-3-3',
   players:['Lionel Messi','Julián Álvarez','Ángel Di María','Rodrigo De Paul','Leandro Paredes','Nicolás Otamendi','Cristian Romero','Emiliano Martínez','Exequiel Palacios','Giovani Lo Celso','Nahuel Molina']},
  {n:'Algeria',g:'J',r:30,c:'AF',cc:'dz',coach:'Djamel Belmadi',cap:'Riyad Mahrez',form:'4-3-3',
   players:['Riyad Mahrez','Islam Slimani','Sofiane Feghouli','Said Benrahma','Youcef Atal','Andy Delort','Aissa Mandi','Djamel Benlamri','Nabil Bentaleb','Haris Belkebla','Ismaël Bennacer']},
  {n:'Áo',g:'J',r:26,c:'EU',cc:'at',coach:'Ralf Rangnick',cap:'David Alaba',form:'4-2-3-1',
   players:['David Alaba','Marcel Sabitzer','Marko Arnautovic','Christoph Baumgartner','Konrad Laimer','Nicolas Seiwald','Michael Gregoritsch','Patrick Wimmer','Xaver Schlager','Romano Schmid','Florian Grillitsch']},
  {n:'Jordan',g:'J',r:63,c:'AS',cc:'jo',coach:'Hussein Ammouta',cap:'Mousa Al-Taamari',form:'4-4-2',
   players:['Mousa Al-Taamari','Yazan Al-Naimat','Ahmad Saleh','Ahmad Abu Aisheh','Emad Bsheesh','Ibrahim Hemdaan','Baha Faisal','Walid Al-Ahmad','Rami Hamdan','Khaled Al-Rasheed','Qusai Muqabala']},

  // ── BẢNG K ──
  {n:'Bồ Đào Nha',g:'K',r:5,c:'EU',cc:'pt',coach:'Roberto Martínez',cap:'Cristiano Ronaldo',form:'4-3-3',
   players:['Cristiano Ronaldo','Bruno Fernandes','Bernardo Silva','João Félix','Rafael Leão','Rúben Neves','Diogo Dalot','Pepe','Rúben Dias','Diogo Costa','João Cancelo']},
  {n:'CH Congo',g:'K',r:48,c:'AF',cc:'cd',coach:'Sébastien Migné',cap:'Yannick Bolasie',form:'4-3-3',
   players:['Yannick Bolasie','Chancel Mbemba','Ngonda Muzinga','Cédric Bakambu','Arthur Masuaku','Théo Bongonda','Marcel Tisserand','Merveille Bope Bokadi','Bryan Mbeumo','Gaël Kakuta','Silas']},
  {n:'Uzbekistan',g:'K',r:62,c:'AS',cc:'uz',coach:'Srecko Katanec',cap:'Eldor Shomurodov',form:'4-3-3',
   players:['Eldor Shomurodov','Jaloliddin Masharipov','Ikrom Alibaev','Akbar Tursunov','Odil Akhmedov','Dostonbek Khamdamov','Shamsiddin Karimov','Umid Igamberdiyev','Khurshid Yusupov','Jasur Jalolov','Otajon Iskanderov']},
  {n:'Colombia',g:'K',r:27,c:'SA',cc:'co',coach:'Néstor Lorenzo',cap:'Falcao García',form:'4-2-3-1',
   players:['James Rodríguez','Falcao García','Luis Díaz','Juan Cuadrado','Davinson Sánchez','Yerry Mina','Wilmar Barrios','Matheus Uribe','Duván Zapata','Luis Muriel','Rafael Santos Borré']},

  // ── BẢNG L ──
  {n:'Anh',g:'L',r:4,c:'EU',cc:'gb',coach:'Gareth Southgate',cap:'Harry Kane',form:'4-3-3',
   players:['Harry Kane','Phil Foden','Bukayo Saka','Jude Bellingham','Marcus Rashford','Jordan Henderson','Declan Rice','Raheem Sterling','Conor Gallagher','Trent Alexander-Arnold','Jordan Pickford']},
  {n:'Croatia',g:'L',r:10,c:'EU',cc:'hr',coach:'Zlatko Dalić',cap:'Luka Modrić',form:'4-3-3',
   players:['Luka Modrić','Ivan Perišić','Mateo Kovačić','Marcelo Brozović','Joško Gvardiol','Dejan Lovren','Ivan Rakitić','Andrej Kramarić','Mario Pašalić','Borna Ćarić','Dominik Livaković']},
  {n:'Ghana',g:'L',r:74,c:'AF',cc:'gh',coach:'Chris Hughton',cap:'Jordan Ayew',form:'4-4-2',
   players:['Jordan Ayew','Thomas Partey','Mohammed Kudus','André Ayew','Inaki Williams','Daniel-Kofi Kyereh','Daniel Amartey','Jonathan Mensah','Joseph Aidoo','Richard Ofori','Antoine Semenyo']},
  {n:'Panama',g:'L',r:72,c:'NA',cc:'pa',coach:'Thomas Christiansen',cap:'Blas Pérez',form:'4-4-2',
   players:['Blas Pérez','Rómulo Otero','Édgar Bárcenas','Abdiel Arroyo','Anibal Godoy','Felipe Baloy','Luis Mejía','Fidel Escobar','Adalberto Carrasquilla','Alberto Quintero','Cecilio Waterman']},
];
let LAST_TEAM_CONTINENT='all';
let TEAM_SEARCH_Q='';
function filterTeamSearch(q){
  TEAM_SEARCH_Q=q;
  buildTeams(LAST_TEAM_CONTINENT);
}
function buildTeams(filter='all'){
  LAST_TEAM_CONTINENT=filter;
  let data=filter==='all'?TEAMS_STATIC:TEAMS_STATIC.filter(t=>t.c===filter);
  if(TEAM_SEARCH_Q.trim()){
    const nq=normalizeText(TEAM_SEARCH_Q);
    data=data.filter(t=>normalizeText(t.n).includes(nq));
  }
  const el=document.getElementById('teamsGrid');
  el.innerHTML='';
  if(!data.length){
    el.innerHTML='<div class="home-empty" style="grid-column:1/-1">Không tìm thấy đội tuyển phù hợp.</div>';
    return;
  }
  data.forEach(t=>{
    const c=document.createElement('div');
    c.className='team-c';
    c.onclick=()=>openTeamModal(t);
    c.innerHTML=`
      <div class="team-c-flag">
        <span class="fl lg"><img src="https://flagcdn.com/w40/${t.cc}.png" loading="lazy" alt="${t.n}" onerror="this.style.display='none'"></span>
      </div>
      <div class="team-c-name">${t.n}</div>
      <div class="team-c-grp">Bảng ${t.g}</div>
      <div class="team-c-rank">FIFA #${t.r}</div>
      <div style="margin-top:8px;font-size:10px;color:var(--text3);border-top:1px solid var(--line);padding-top:8px">👥 Danh sách cầu thủ</div>`;
    el.appendChild(c);
  });
}

function navBtn(id){
  return document.querySelector(`.nav-btn[data-page="${id}"]`)||document.querySelector('.nav-btn');
}

function goTo(id,btn,fromHash=false){
  const page=document.getElementById('pg-'+id);
  if(!page)return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  page.classList.add('on');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  if(!fromHash&&location.hash!=='#'+id)history.replaceState(null,'','#'+id);
  window.scrollTo({top:0,behavior:'smooth'});
}
function filterMatches(f,btn){
  document.querySelectorAll('#pg-schedule .pills .pill').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  document.querySelectorAll('[data-mf]').forEach(d=>{
    const fl=d.getAttribute('data-mf')||'';
    d.style.display=(f==='all'||fl.includes(f))?'':'none';
  });
}
function filterTeam(f,btn){
  document.querySelectorAll('#pg-teams .pills .pill').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');buildTeams(f);
}
// goals = {goals1:[{name,min}],goals2:[{name,min}]} của trận (nếu có), lấy từ data-goals1/2 trên thẻ trận.
// Phút ghi bàn trong dữ liệu có dạng chuỗi như "90+4" (bù giờ) — không dùng Number() trực tiếp vì sẽ ra NaN.
function goalMinuteSortKey(v){
  const m=String(v||'0').match(/^(\d+)(?:\+(\d+))?$/);
  if(!m)return 0;
  return Number(m[1])+(m[2]?Number(m[2])/100:0);
}
function formatGoalMinute(v){return String(v||'0').trim()||'0';}
function renderGoalEvents(t1,t2,s1,s2,goals){
  if(s1===''||s2==='')return'';
  const g1=(goals&&goals.goals1)||[];
  const g2=(goals&&goals.goals2)||[];
  const merged=[...g1.map(g=>({...g,team:t1})),...g2.map(g=>({...g,team:t2}))]
    .sort((a,b)=>goalMinuteSortKey(a.min||a.minute)-goalMinuteSortKey(b.min||b.minute));
  const goalsHtml=merged.length?`<div class="mm-glbl">⚽ Diễn biến bàn thắng</div>${merged.map(g=>`<div class="mm-goal"><span class="mm-gmin">${formatGoalMinute(g.min||g.minute)}'</span><span>⚽ ${escapeHTML(g.name||'Chưa rõ cầu thủ')}</span><span style="margin-left:auto;color:var(--text3);font-size:10px">${escapeHTML(g.team)}</span></div>`).join('')}`:'';
  return goalsHtml;
}
// Tìm lại match object gốc theo tên đội + ngày — dùng cho các nơi chỉ có sẵn m khi render (Trang chủ, lịch sử đối đầu trong modal đội)
// thay vì phải nhúng cả object vào onclick string.
function findMatchByTeamsDate(t1,t2,dateStr){
  const all=(WC_FEATURE_STATE.lastData&&WC_FEATURE_STATE.lastData.matches)||[];
  return all.find(m=>m.date===dateStr&&((tn(m.team1)===t1&&tn(m.team2)===t2)||(tn(m.team1)===t2&&tn(m.team2)===t1)));
}
function openMatchModalForMatch(m){
  if(!m)return;
  const st=matchStatus(m);
  const s1=m.score&&m.score.ft?String(m.score.ft[0]):'';
  const s2=m.score&&m.score.ft?String(m.score.ft[1]):'';
  const grp=m.group||m.round||'';
  const ven=m.ground||'';
  const vnTime=formatVNTime(null,m.date,m.time);
  const modalStatus=st.status==='done'?'Đã kết thúc':st.status==='live'?'● Đang live: '+st.label:'Giờ VN: '+vnTime;
  openMatchModal(tn(m.team1),tn(m.team2),s1,s2,getCC(m.team1),getCC(m.team2),modalStatus,grp,ven,{goals1:m.goals1||[],goals2:m.goals2||[]},vnTime);
}
function openMatchModalByTeamsDate(t1Raw,t2Raw,dateStr){
  openMatchModalForMatch(findMatchByTeamsDate(decodeURIComponent(t1Raw),decodeURIComponent(t2Raw),dateStr));
}
function openMatchModal(t1,t2,s1,s2,cc1,cc2,status,grp,venue,goals,vnTime){
  const FB='https://flagcdn.com/';
  const mf=document.getElementById('mm-flags');mf.innerHTML='';
  const f1=document.createElement('span');f1.className='fl xl';
  const i1=document.createElement('img');i1.src=`${FB}w80/${cc1}.png`;i1.onerror=()=>i1.style.display='none';f1.appendChild(i1);
  const sep=document.createElement('span');sep.style.cssText='font-size:11px;font-weight:600;color:var(--text3);padding:0 6px';sep.textContent='VS';
  const f2=document.createElement('span');f2.className='fl xl';
  const i2=document.createElement('img');i2.src=`${FB}w80/${cc2}.png`;i2.onerror=()=>i2.style.display='none';f2.appendChild(i2);
  mf.append(f1,sep,f2);
  document.getElementById('mm-teams').textContent=t1+' vs '+t2;
  const ms=document.getElementById('mm-score');
  if(s1!==''&&s2!==''){ms.className='mm-score';ms.textContent=s1+' – '+s2;}
  else{
    ms.className='mm-score pending';
    // Show VN time if available, else pending text
    ms.textContent=vnTime?vnTime:'Chưa thi đấu';
  }
  document.getElementById('mm-meta').innerHTML=`${grp} &nbsp;·&nbsp; ${venue}<br><span style="color:var(--amber);font-weight:600">${status}</span>`;
  document.getElementById('mm-body').innerHTML=renderGoalEvents(t1,t2,s1,s2,goals);
  document.getElementById('mModal').classList.add('on');
}
function openTeamModal(t){
  const FB='https://flagcdn.com/';
  const tf=document.getElementById('tm-flag');tf.innerHTML='';
  const f=document.createElement('span');f.className='fl xl';
  const img=document.createElement('img');img.src=`${FB}w80/${t.cc}.png`;img.onerror=()=>img.style.display='none';
  f.appendChild(img);tf.appendChild(f);
  document.getElementById('tm-name').textContent=t.n;
  document.getElementById('tm-sub').textContent='Bảng '+t.g+' · FIFA #'+t.r;
  const conts={EU:'Châu Âu',SA:'Nam Mỹ',AS:'Châu Á',AF:'Châu Phi',NA:'Bắc & Trung Mỹ'};
  const squadHtml=`
    <div class="squad-box" id="teamSquadBox">
      <div class="squad-head">
        <div class="squad-title">👥 Danh sách cầu thủ cập nhật</div>
        <div class="squad-actions">
          <button class="squad-refresh" onclick="refreshTeamSquadFromButton()">⟳ Cập nhật</button>
          <a class="squad-source" href="https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads" target="_blank" rel="noopener">Nguồn squad</a>
        </div>
      </div>
      <div class="squad-note">Danh sách được tải động từ trang tổng hợp squad World Cup 2026. Đội nào chưa công bố hoặc nguồn chưa cập nhật sẽ hiển thị trạng thái chờ.</div>
      <div id="teamSquadContent" class="squad-loading">Đang tải danh sách cầu thủ mới nhất...</div>
    </div>`;
  document.getElementById('tm-body').innerHTML=`
    <div class="tm-row"><span class="tm-key">Bảng đấu</span><span class="tm-val">Bảng ${t.g}</span></div>
    <div class="tm-row"><span class="tm-key">Xếp hạng FIFA</span><span class="tm-val amber">#${t.r}</span></div>
    <div class="tm-row"><span class="tm-key">Châu lục</span><span class="tm-val">${conts[t.c]||t.c}</span></div>
    ${t.coach?`<div class="tm-row"><span class="tm-key">Huấn luyện viên</span><span class="tm-val">${t.coach}</span></div>`:''}
    ${t.cap?`<div class="tm-row"><span class="tm-key">Đội trưởng</span><span class="tm-val" style="color:var(--amber)">${t.cap}</span></div>`:''}
    ${t.form?`<div class="tm-row"><span class="tm-key">Sơ đồ chiến thuật</span><span class="tm-val">${t.form}</span></div>`:''}
    ${squadHtml}`;
  document.getElementById('tmModal').classList.add('on');
  renderTeamSquad(t);
}

// ═══════════════════════════════════════════
// LATEST SQUADS — Dynamic fetch from public squad page
// ═══════════════════════════════════════════
const SQUAD_CACHE_KEY='wc2026:squads:v2';
const SQUAD_CACHE_TTL=1000*60*60*12;
const SQUAD_API='https://en.wikipedia.org/w/api.php?action=parse&page=2026_FIFA_World_Cup_squads&prop=text&format=json&origin=*';
let SQUAD_DATA=null;
let CURRENT_TEAM_FOR_SQUAD=null;
const TEAM_WIKI_MAP={
  'Mexico':'Mexico','Nam Phi':'South Africa','Hàn Quốc':'South Korea','Séc':'Czech Republic',
  'Canada':'Canada','Thụy Sĩ':'Switzerland','Qatar':'Qatar','Bosnia & Herzegovina':'Bosnia and Herzegovina',
  'Brazil':'Brazil','Ma-rốc':'Morocco','Haiti':'Haiti','Scotland':'Scotland',
  'Mỹ':'United States','USA':'United States','Paraguay':'Paraguay','Úc':'Australia','Thổ Nhĩ Kỳ':'Turkey',
  'Đức':'Germany','Curaçao':'Curaçao','Bờ Biển Ngà':'Ivory Coast','Ecuador':'Ecuador',
  'Hà Lan':'Netherlands','Nhật Bản':'Japan','Thụy Điển':'Sweden','Tunisia':'Tunisia',
  'Bỉ':'Belgium','Ai Cập':'Egypt','Iran':'Iran','New Zealand':'New Zealand',
  'Tây Ban Nha':'Spain','Cabo Verde':'Cape Verde','Ả Rập Xê-út':'Saudi Arabia','Uruguay':'Uruguay',
  'Pháp':'France','Senegal':'Senegal','Na Uy':'Norway','Iraq':'Iraq',
  'Argentina':'Argentina','Algeria':'Algeria','Áo':'Austria','Jordan':'Jordan',
  'Bồ Đào Nha':'Portugal','Uzbekistan':'Uzbekistan','CH Congo':'DR Congo','Colombia':'Colombia',
  'Anh':'England','Croatia':'Croatia','Ghana':'Ghana','Panama':'Panama'
};
function cleanSquadText(v){return String(v||'').replace(/\[\d+\]/g,'').replace(/\s+/g,' ').trim();}
function squadCacheRead(){
  try{const raw=localStorage.getItem(SQUAD_CACHE_KEY);if(!raw)return null;const p=JSON.parse(raw);if(Date.now()-p.savedAt>SQUAD_CACHE_TTL)return null;return p.value||null;}catch(e){return null;}
}
function squadCacheSave(value){try{localStorage.setItem(SQUAD_CACHE_KEY,JSON.stringify({savedAt:Date.now(),value}));}catch(e){} }
function normalizeSquadKey(v){return cleanSquadText(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim();}
function findSquadForTeam(team){
  if(!SQUAD_DATA)return null;
  const target=TEAM_WIKI_MAP[team.n]||team.n;
  const keys=[target,team.n].map(normalizeSquadKey);
  for(const [name,players] of Object.entries(SQUAD_DATA.teams||{})){
    const k=normalizeSquadKey(name);
    if(keys.includes(k)||keys.some(x=>k.includes(x)||x.includes(k)))return {sourceName:name,players};
  }
  return null;
}
function isSquadHeadingNode(n){return !!n&&(/^H[234]$/i.test(n.tagName)||(n.classList&&n.classList.contains('mw-heading')));}
function extractTableAfterHeading(h){
  // Wikipedia (2024+) bọc heading trong <div class="mw-heading">, làm h.nextElementSibling không còn trỏ tới nội dung/bảng kế tiếp — phải dò từ div bọc ngoài.
  const startNode=h.closest('.mw-heading')||h;
  let node=startNode.nextElementSibling,table=null;
  while(node&&!isSquadHeadingNode(node)){
    if(node.matches&&node.matches('table.wikitable')){table=node;break;}
    table=node.querySelector&&node.querySelector('table.wikitable');
    if(table)break;
    node=node.nextElementSibling;
  }
  return table;
}
function extractPlayersFromTable(table){
  const rows=[...table.querySelectorAll('tr')];
  const headerCells=[...rows[0]?.querySelectorAll('th,td')||[]].map(x=>cleanSquadText(x.textContent));
  const idxPlayer=headerCells.findIndex(x=>/player|name/i.test(x));
  if(idxPlayer<0)return []; // không có cột Player => không phải bảng danh sách cầu thủ (vd: bảng thống kê HLV)
  const idxNo=headerCells.findIndex(x=>/^no\.?|number/i.test(x));
  const idxPos=headerCells.findIndex(x=>/pos|position/i.test(x));
  const idxClub=headerCells.findIndex(x=>/club/i.test(x));
  const idxDob=headerCells.findIndex(x=>/date of birth|born/i.test(x));
  const idxCaps=headerCells.findIndex(x=>/^caps/i.test(x));
  const idxCareerGoals=headerCells.findIndex(x=>/^goals/i.test(x));
  const players=[];
  rows.slice(1).forEach(r=>{
    const cells=[...r.querySelectorAll('td,th')];
    if(cells.length<2)return;
    const get=i=>i>=0&&cells[i]?cleanSquadText(cells[i].textContent):'';
    let player=get(idxPlayer).replace(/^\d+\s*/,'').replace(/\s*\(captain\)$/i,'');
    if(!player||/coach|manager|player/i.test(player))return;
    // Lấy slug Wikipedia chính xác từ href của tên cầu thủ (nếu có) để tra ảnh/tiểu sử không bị nhầm người trùng tên.
    const playerCell=cells[idxPlayer];
    const link=playerCell&&playerCell.querySelector('a[href^="/wiki/"]');
    const wikiSlug=link?link.getAttribute('href').replace(/^\/wiki\//,''):'';
    // Cột ngày sinh có span ẩn chứa ngày dạng ISO (vd "(2000-02-25)") lẫn vào textContent — bỏ phần đó đi.
    const dob=get(idxDob).replace(/^\([^)]*\)\s*/,'');
    players.push({no:get(idxNo)||'—',pos:get(idxPos).replace(/^\d+/,'')||'',name:player,club:get(idxClub)||'',dob,caps:get(idxCaps)||'',careerGoals:get(idxCareerGoals)||'',wikiSlug});
  });
  return players;
}
async function fetchSquadData(force=false){
  if(SQUAD_DATA&&!force)return SQUAD_DATA;
  const cached=!force?squadCacheRead():null;
  if(cached){SQUAD_DATA=cached;return cached;}
  const res=await fetch(SQUAD_API,{cache:force?'reload':'default'});
  if(!res.ok)throw new Error('Squad HTTP '+res.status);
  const json=await res.json();
  const html=json?.parse?.text?.['*'];
  if(!html)throw new Error('Squad page empty');
  const doc=new DOMParser().parseFromString(html,'text/html');
  const teams={};
  const headings=[...doc.querySelectorAll('h3,h4')];
  headings.forEach(h=>{
    const headline=h.querySelector('.mw-headline');
    const name=cleanSquadText(headline?headline.textContent:h.textContent);
    if(!name||/Group [A-L]/i.test(name)||/Notes|References|External links/i.test(name))return;
    const table=extractTableAfterHeading(h);
    if(!table)return;
    const players=extractPlayersFromTable(table);
    if(players.length)teams[name]=players.slice(0,30);
  });
  const value={updatedAt:Date.now(),teams};
  SQUAD_DATA=value;squadCacheSave(value);return value;
}
// Nguồn dự phòng: trang Wikipedia riêng của từng ĐTQG (mục "Current squad") — dùng khi trang tổng hợp
// không có/chưa cập nhật đội đó. Chỉ gọi khi cần (lazy), không tốn thêm request lúc tải trang.
async function fetchSquadFromTeamPage(wikiName){
  const page=`${wikiName} national football team`;
  const url=`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&origin=*`;
  const res=await fetch(url);
  if(!res.ok)return null;
  const json=await res.json();
  const html=json?.parse?.text?.['*'];
  if(!html)return null;
  const doc=new DOMParser().parseFromString(html,'text/html');
  const headings=[...doc.querySelectorAll('h2,h3,h4')];
  const h=headings.find(x=>{
    const headline=x.querySelector('.mw-headline');
    const t=cleanSquadText(headline?headline.textContent:x.textContent);
    return /current squad|^squad$/i.test(t);
  });
  if(!h)return null;
  const table=extractTableAfterHeading(h);
  if(!table)return null;
  return extractPlayersFromTable(table);
}
function renderSquadPlayers(match){
  const box=document.getElementById('teamSquadContent');if(!box)return;
  if(!match||!match.players||!match.players.length){
    box.className='squad-empty';
    box.innerHTML='Chưa tìm thấy danh sách cầu thủ đã công bố cho đội này trong nguồn đang dùng. Khi FIFA/đội tuyển công bố và nguồn cập nhật, mục này sẽ tự hiển thị.';
    return;
  }
  box.className='';
  const count=match.players.length;
  const time=match.updatedAt?new Date(match.updatedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'';
  const srcNote=match.fallback?' · nguồn dự phòng: trang ĐTQG':'';
  box.innerHTML=`<div class="squad-note">Đội: <b style="color:var(--amber)">${escapeHTML(match.sourceName)}</b> · ${count} cầu thủ · Cập nhật: ${escapeHTML(time)} GMT+7${srcNote}</div>
    <div class="squad-list">${match.players.map(p=>`<div class="squad-player"><span class="squad-avatar" id="sqAvatar-${slugifyName(p.name)}">👤</span><div class="squad-no">${escapeHTML(p.no||'—')}</div><div class="squad-info"><div class="squad-name" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</div><div class="squad-meta">${escapeHTML(p.pos?posVN(p.pos):'Thông tin đang cập nhật')}</div></div></div>`).join('')}</div>`;
  loadSquadAvatars(match.players,match.sourceName);
}
// Tải avatar cho danh sách cầu thủ đầy đủ trong modal đội tuyển — dùng chung resolvePlayerAvatar với loadScorerAvatars.
async function loadSquadAvatars(players,nationalityEN){
  players.forEach(async(p)=>{
    const src=await resolvePlayerAvatar(p.name,p.wikiSlug,nationalityEN);
    if(src){const slot=document.getElementById(`sqAvatar-${slugifyName(p.name)}`);if(slot)slot.innerHTML=`<img src="${src}" alt="" loading="lazy">`;}
  });
}
async function renderTeamSquad(team,force=false){
  CURRENT_TEAM_FOR_SQUAD=team;
  const box=document.getElementById('teamSquadContent');if(!box)return;
  box.className='squad-loading';box.textContent=force?'Đang làm mới danh sách cầu thủ...':'Đang tải danh sách cầu thủ mới nhất...';
  try{
    await fetchSquadData(force);
    let match=findSquadForTeam(team);
    if(match)match={...match,updatedAt:SQUAD_DATA?.updatedAt};
    if(!match||!match.players.length){
      const wikiName=TEAM_WIKI_MAP[team.n]||team.n;
      try{
        const players=await fetchSquadFromTeamPage(wikiName);
        if(players&&players.length)match={sourceName:wikiName,players,updatedAt:Date.now(),fallback:true};
      }catch(e){console.warn('Squad fallback fetch failed',e);}
    }
    renderSquadPlayers(match);
  }
  catch(e){console.warn('Squad fetch failed',e);box.className='squad-empty';box.innerHTML='Không tải được danh sách cầu thủ online lúc này. Hãy thử lại sau hoặc mở link nguồn squad ở phía trên.';}
}
function refreshTeamSquadFromButton(){if(CURRENT_TEAM_FOR_SQUAD)renderTeamSquad(CURRENT_TEAM_FOR_SQUAD,true);}

function getFallbackData(){
  return{name:'World Cup 2026',matches:[
    {round:'Matchday 1',date:'2026-06-11',time:'13:00 UTC-6',team1:'Mexico',team2:'South Africa',group:'Group A',ground:'Mexico City'},
    {round:'Matchday 1',date:'2026-06-11',time:'20:00 UTC-6',team1:'South Korea',team2:'UEFA Path D winner',group:'Group A',ground:'Guadalajara (Zapopan)'},
    {round:'Matchday 3',date:'2026-06-13',time:'18:00 UTC-4',team1:'Brazil',team2:'Morocco',group:'Group C',ground:'New York/New Jersey'},
    {round:'Matchday 3',date:'2026-06-13',time:'21:00 UTC-4',team1:'Haiti',team2:'Scotland',group:'Group C',ground:'Boston'},
    {round:'Matchday 4',date:'2026-06-14',time:'12:00 UTC-5',team1:'Germany',team2:'Curaçao',group:'Group E',ground:'Houston'},
    {round:'Matchday 4',date:'2026-06-14',time:'15:00 UTC-5',team1:'Netherlands',team2:'Japan',group:'Group F',ground:'Dallas'},
    {round:'Matchday 5',date:'2026-06-15',time:'12:00 UTC-7',team1:'Belgium',team2:'Egypt',group:'Group G',ground:'Seattle'},
    {round:'Matchday 5',date:'2026-06-15',time:'12:00 UTC-4',team1:'Spain',team2:'Cape Verde',group:'Group H',ground:'Atlanta'},
    {round:'Matchday 6',date:'2026-06-16',time:'15:00 UTC-4',team1:'France',team2:'Senegal',group:'Group I',ground:'New York/New Jersey'},
    {round:'Matchday 6',date:'2026-06-16',time:'20:00 UTC-5',team1:'Argentina',team2:'Algeria',group:'Group J',ground:'Kansas City'},
    {round:'Matchday 7',date:'2026-06-17',time:'15:00 UTC-5',team1:'England',team2:'Croatia',group:'Group L',ground:'Dallas'},
  ]};
}

// ═══════════════════════════════════════════
// GITHUB PAGES SINGLE-FILE HELPERS
// Cache dữ liệu, hash routing, chạy ổn định trên github.io
// ═══════════════════════════════════════════
const APP_CACHE={
  wcData:'wc2026:data:v1',
  lastUpdated:'wc2026:lastUpdated:v1'
};
function saveCache(key,value){
  try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),value}));}
  catch(e){console.warn('Cache save failed',e);}
}
function readCache(key,maxAgeMs=1000*60*60*12){
  try{
    const raw=localStorage.getItem(key);if(!raw)return null;
    const obj=JSON.parse(raw);if(!obj||!obj.savedAt)return null;
    if(Date.now()-obj.savedAt>maxAgeMs)return null;
    return obj.value||null;
  }catch(e){console.warn('Cache read failed',e);return null;}
}
function pageFromHash(){
  const h=(location.hash||'').replace('#','').trim();
  const ok=['home','schedule','groups','teams'];
  return ok.includes(h)?h:'home';
}
function syncHashToPage(){
  const id=pageFromHash();
  if(typeof goTo==='function')goTo(id,navBtn(id),true);
}
window.addEventListener('hashchange',syncHashToPage);

async function refreshData(){
  const cached=readCache(APP_CACHE.wcData);
  if(cached){
    renderSchedule(cached);buildGroups(cached);buildStats(cached);
    setApiStatus('live','Đang dùng dữ liệu đã lưu');
  }
  try{
    setApiStatus('loading','Đang cập nhật dữ liệu...');
    const data=await fetchWCData();
    if(data){
      saveCache(APP_CACHE.wcData,data);
      localStorage.setItem(APP_CACHE.lastUpdated,String(Date.now()));
      renderSchedule(data);buildGroups(data);buildStats(data);
      setApiStatus('live','Dữ liệu đã cập nhật');
    }else if(cached){
      setApiStatus('error','API lỗi · Đang dùng cache');
    }
  }catch(e){
    console.warn('refreshData failed',e);
    if(cached){setApiStatus('error','API lỗi · Đang dùng cache');return;}
    const fallback=getFallbackData();
    renderSchedule(fallback);buildGroups(fallback);buildStats(fallback);
    setApiStatus('error','API lỗi · Dùng dữ liệu dự phòng');
  }
}
async function manualRetryFetch(btn){
  if(btn){btn.disabled=true;btn.textContent='⟳ Đang tải...';}
  try{await refreshData();}
  finally{if(btn){btn.disabled=false;btn.textContent='⟳ Thử lại';}}
}


// =========================================================
// FEATURE PACK v1.2.0 → v1.23.0
// 14 requested features, one version per feature.
// =========================================================
const WC_CHANGELOG=[
  ['v1.2.0','Bộ lọc lịch thi đấu nâng cao: tìm đội, lọc bảng, lọc vòng, lọc trạng thái.'],
  ['v1.3.0','Chế độ giờ Việt Nam / giờ địa phương cho lịch thi đấu.'],
  ['v1.4.0','Version badge nâng cấp: bấm vào version để xem popup lịch sử phiên bản.'],
  ['v1.5.0','Countdown cho từng trận: còn bao lâu, đang diễn ra hoặc đã kết thúc.'],
  ['v1.6.0','Khu vực “Hôm nay có trận gì?” và gợi ý trận gần nhất nếu hôm nay chưa có trận.'],
  ['v1.7.0','Tìm kiếm toàn website: đội tuyển, trận đấu, sân vận động.'],
  ['v1.8.0','So sánh 2 đội trong popup trận đấu: bảng, FIFA rank, HLV, đội trưởng, cầu thủ nổi bật.'],
  ['v1.9.0','Chuyển layout lịch thi đấu giữa danh sách và lịch ngày.'],
  ['v1.10.0','PWA cơ bản: manifest data URL, theme color, app metadata cho GitHub Pages.'],
  ['v1.11.0','Share card cho từng trận: copy link sâu và hỗ trợ Web Share API trên thiết bị tương thích.'],
  ['v1.12.0','Popup chi tiết sân vận động: ảnh, thành phố, quốc gia, sức chứa, vai trò tổ chức.'],
  ['v1.13.0','SEO theo từng section: đổi title, meta description và canonical hash khi chuyển tab.'],
  ['v1.14.0','JSON-LD sạch hơn: bổ sung WebApplication + SportsEvent metadata đã kiểm soát.'],
  ['v1.17.0','Road to Final cho từng đội trong popup đội tuyển.'],
  ['v1.18.0','Bổ sung ảnh sân vận động thực tế bằng Wikipedia/Wikimedia, có cache và fallback khi ảnh lỗi.'],
  ['v1.20.0','Lịch thi đấu chỉ hiển thị các trận đã xác định đủ 2 đội; tự hiện trận knockout khi dữ liệu cập nhật đội thắng/nhất bảng/nhì bảng.'],
  ['v1.21.0','Chuẩn hóa toàn bộ website về một múi giờ duy nhất: Giờ Việt Nam (UTC+7); bỏ tùy chọn giờ máy người dùng để tránh lệch lịch.'],
  ['v1.22.0','Sửa lỗi buildTicker gọi isConcreteTeam khi hàm chưa được định nghĩa; ticker LIVE và luồng refresh dữ liệu hoạt động ổn định hơn.'],
  ['v1.23.0','Tách Trang chủ thành một tab riêng, thiết kế lại hero bắt mắt hơn và thêm dashboard/lối tắt nhanh.'],
  ['v1.24.0','Sửa lỗi escapeHTML is not defined khiến buildTicker bị crash sau khi refresh dữ liệu; bổ sung helper escapeHTML toàn cục.'],
  ['v1.26.0','Dọn lỗi Console do CORS proxy: bỏ corsproxy.io khỏi luồng tải RSS để tránh lỗi 403 khi chạy trên GitHub Pages.'],
  ['v1.28.0','Xóa thanh LIVE ticker chạy ngang ở đầu website; thiết kế lại Trang Chủ thành dashboard gọn trong một màn hình desktop, hạn chế scroll và ẩn footer ở trang chủ.'],
  ['v1.25.0','Thiết kế lại layout thẻ Lịch thi đấu: chống tràn text, bố cục đội/trạng thái rõ hơn và responsive tốt trên màn hình hẹp.'],
  ['v1.29.0','Cập nhật danh sách cầu thủ mới nhất trong popup đội tuyển: tải động từ nguồn squad online, có cache và nút làm mới.'],
  ['v2.0.0','Thiết kế lại toàn bộ giao diện cho mobile (iPhone 14 Pro Max): rút gọn về 4 tab chính (Trang chủ, Lịch đấu, Bảng đấu, Đội tuyển), bỏ Nhánh đấu/Highlights/Tin tức/Sân vận động. Thêm nút Ẩn/hiện trận đã đấu, phân tích trận đấu (tỷ lệ thắng tham khảo dựa trên xếp hạng FIFA) và mục Đánh giá tổng quan cho từng đội tuyển.'],
  ['v2.1.0','Thêm chế độ Sáng/Tối (dark/light mode): nút chuyển đổi trên header, tự nhận theme hệ thống lần đầu mở, lưu lựa chọn cho lần sau.'],
  ['v2.2.0','Bổ sung hiệu ứng: thẻ trận đấu xuất hiện theo hiệu ứng cuốn, hiệu ứng "ping" cho chỉ báo LIVE, khung chờ dạng shimmer khi tải lịch thi đấu, ánh sáng nền Trang chủ chuyển động nhẹ. Đồng thời khôi phục animation nhấp nháy cho dot LIVE/trạng thái API bị thiếu từ trước.'],
  ['v2.3.0','Tối ưu cấu trúc mã nguồn: tách CSS và JavaScript ra file riêng (css/worldcup2026.css, js/worldcup2026.js) để dễ bảo trì khi file đã lớn.'],
  ['v2.4.0','Sửa lỗi danh sách cầu thủ từng đội tuyển không hiển thị do Wikipedia đổi cấu trúc HTML; bổ sung nguồn dữ liệu dự phòng (trang Wikipedia riêng của từng ĐTQG) khi nguồn chính thiếu dữ liệu.'],
  ['v2.5.0','Nâng cấp hiển thị: thêm độ nổi (shadow) cho thẻ trận đấu/đội tuyển/bảng đấu, huy chương vàng-bạc-đồng cho top 3 Vua phá lưới.'],
  ['v2.6.0','Trang chủ: bấm vào lịch/kết quả trận đấu hoặc cầu thủ ghi bàn để xem chi tiết (số trận lập công, vị trí, CLB, ngày sinh, số liệu sự nghiệp). Gộp "So sánh trước trận" và "Phân tích" thành 1 popup duy nhất, bổ sung lịch sử đối đầu thật tại các kỳ World Cup 1998–2026, bỏ nút Phân tích riêng và chức năng Chia sẻ. Dịch vị trí cầu thủ (GK/DF/MF/FW) sang tiếng Việt. Bảng đấu ghi rõ tên cột thay viết tắt. Sửa lỗi hiển thị NaN ở bàn thắng phút bù giờ và lỗi bo góc ở popup lịch sử phiên bản.']
];

const WC_FEATURE_STATE={
  filters:{status:'all'},
  lastData:null,
  hideDone:true
};
// Một trận được coi là "cũ" nếu đã đấu xong VÀ ngày diễn ra (giờ VN) không phải hôm nay —
// tức chỉ giữ lại trận hôm nay (n), ẩn từ ngày n-1 trở về trước.
function isOldDoneMatch(match){
  if(matchStatus(match).status!=='done')return false;
  const cutoff=new Date(vnDateKey(new Date())+'T00:00:00+07:00');
  return matchStartDate(match)<cutoff;
}
function toggleDoneMatches(btn){
  WC_FEATURE_STATE.hideDone=!WC_FEATURE_STATE.hideDone;
  if(btn)btn.textContent=WC_FEATURE_STATE.hideDone?'Hiện trận đã đấu':'Ẩn trận đã đấu';
  renderSchedule(WC_FEATURE_STATE.lastData);
}

// v1.21.0 — Website dùng một múi giờ duy nhất để tránh lệch lịch giữa các thiết bị.
const APP_TIME_ZONE='Asia/Ho_Chi_Minh';
const APP_TIMEZONE_LABEL='Giờ Việt Nam (UTC+7)';

function getTeamMeta(name){
  const raw=String(name||'').trim();
  // raw có thể là tên tiếng Anh gốc (vd "France") hoặc tên tiếng Việt đã dịch (vd "Pháp") tùy nơi gọi —
  // t.n trong TEAMS_STATIC luôn là tên tiếng Việt, nên phải dịch raw sang tiếng Việt rồi so sánh (tn(raw)===t.n),
  // không phải dịch t.n rồi so raw (chiều cũ chỉ tình cờ đúng với các đội tên giống nhau ở 2 ngôn ngữ như Argentina/Brazil/Canada).
  return TEAMS_STATIC.find(t=>t.n===raw||tn(raw)===t.n)||null;
}

// ═══════════════════════════════════════════
// HEURISTIC STRENGTH / WIN-PROBABILITY
// Tham khảo nội bộ dựa trên field "r" (FIFA rank) có sẵn trong TEAMS_STATIC.
// Không dùng tỷ lệ cá cược hay dữ liệu đối đầu lịch sử — chỉ là ước tính đơn giản
// qua hàm logistic trên chênh lệch điểm sức mạnh, dùng cho mục đích tham khảo.
// ═══════════════════════════════════════════
function teamStrengthScore(team){
  if(!team)return 50;
  const ranks=TEAMS_STATIC.map(t=>t.r);
  const best=Math.min(...ranks),worst=Math.max(...ranks);
  if(best===worst)return 60;
  return Math.round(100-((team.r-best)/(worst-best))*80);
}
function strengthTier(score){
  if(score>=85)return{label:'Ứng cử viên vô địch',cls:'tier-top'};
  if(score>=70)return{label:'Đối thủ khó chịu',cls:'tier-strong'};
  if(score>=50)return{label:'Cửa trên vòng bảng',cls:'tier-mid'};
  return{label:'Underdog tiềm năng',cls:'tier-under'};
}
function matchWinProbability(teamA,teamB){
  const a=teamStrengthScore(teamA),b=teamStrengthScore(teamB);
  const diff=a-b;
  const pAraw=1/(1+Math.exp(-diff/14));
  const drawP=Math.max(0.16,0.30-Math.abs(diff)/250);
  let winA=Math.round(pAraw*(1-drawP)*100);
  let draw=Math.round(drawP*100);
  let winB=100-winA-draw;
  return{winA,draw,winB};
}
// Tỷ số dự đoán tham khảo — cùng cơ sở điểm sức mạnh (FIFA rank) với tỷ lệ thắng phía trên,
// KHÔNG phải dự đoán chính thức, chỉ là quy đổi đơn giản từ chênh lệch điểm sang số bàn kỳ vọng.
function predictScoreline(teamA,teamB){
  const diff=teamStrengthScore(teamA)-teamStrengthScore(teamB);
  const base=1.35;
  const adj=Math.max(-1.2,Math.min(1.2,diff/100*1.6));
  return{ga:Math.max(0,Math.round(base+adj)),gb:Math.max(0,Math.round(base-adj))};
}
// ═══════════════════════════════════════════
// LỊCH SỬ ĐỐI ĐẦU (HEAD-TO-HEAD) — dữ liệu thật từ các kỳ World Cup trước,
// cùng nguồn openfootball/worldcup.json (chỉ khác năm). Cache dài hạn vì dữ liệu lịch sử không đổi.
// ═══════════════════════════════════════════
const H2H_CACHE_KEY='wc2026:h2h:v1';
const H2H_CACHE_TTL=1000*60*60*24*30;
const H2H_YEARS=[1998,2002,2006,2010,2014,2018,2022];
let H2H_DATA=null;
async function fetchHistoricalMatches(){
  if(H2H_DATA)return H2H_DATA;
  try{
    const cached=localStorage.getItem(H2H_CACHE_KEY);
    if(cached){const p=JSON.parse(cached);if(Date.now()-p.savedAt<H2H_CACHE_TTL){H2H_DATA=p.value;return H2H_DATA;}}
  }catch(e){}
  const results=await Promise.allSettled(H2H_YEARS.map(y=>
    fetch(`https://raw.githubusercontent.com/openfootball/worldcup.json/master/${y}/worldcup.json`).then(r=>r.ok?r.json():null)
  ));
  const all=[];
  results.forEach((r,i)=>{
    if(r.status==='fulfilled'&&r.value&&r.value.matches){
      r.value.matches.forEach(m=>all.push({...m,year:H2H_YEARS[i]}));
    }
  });
  H2H_DATA=all;
  try{localStorage.setItem(H2H_CACHE_KEY,JSON.stringify({savedAt:Date.now(),value:all}));}catch(e){}
  return all;
}
// ═══════════════════════════════════════════
// THỐNG KÊ SÚT BÓNG THEO ĐỘI (cả giải) — nguồn TheSportsDB (miễn phí, có CORS). openfootball không có
// số liệu sút bóng nên phải khớp từng trận đã đấu sang event TheSportsDB theo NGÀY + TÊN ĐỘI (2 nguồn
// đặt tên đội hơi khác nhau, vd "Bosnia & Herzegovina" vs "Bosnia-Herzegovina" — phải chuẩn hóa bỏ hết
// ký tự không phải chữ/số rồi so khớp gần đúng). TheSportsDB bản miễn phí giới hạn số trận trả về khi
// truy vấn theo giải/mùa nên phải dò theo từng NGÀY có trận thay vì lấy 1 lần cho cả giải.
// Cache 6h (ngắn hơn H2H vì giải đang diễn ra, có thêm trận đã đấu mỗi ngày).
const SHOTS_CACHE_KEY='wc2026:shots:v1';
const SHOTS_CACHE_TTL=1000*60*60*6;
let SHOTS_DATA=null;
let SHOTS_INFLIGHT=null;
function teamMatchKey(s){return normalizeText(s||'').replace(/[^a-z0-9]+/g,'');}
async function fetchTeamShotStats(data){
  if(SHOTS_DATA)return SHOTS_DATA;
  if(SHOTS_INFLIGHT)return SHOTS_INFLIGHT;
  try{
    const cached=localStorage.getItem(SHOTS_CACHE_KEY);
    if(cached){const p=JSON.parse(cached);if(Date.now()-p.savedAt<SHOTS_CACHE_TTL){SHOTS_DATA=p.value;return SHOTS_DATA;}}
  }catch(e){}
  SHOTS_INFLIGHT=(async()=>{
    // Giới hạn 24 trận gần nhất (không phải toàn bộ trận đã đấu) — TheSportsDB free tier có rate-limit,
    // nếu giải đi càng xa số trận đã đấu càng tăng, lấy hết sẽ ngày càng nhiều request mỗi lần cache hết hạn.
    const allDone=(data&&data.matches?data.matches:[]).filter(m=>m.score&&m.score.ft);
    const done=allDone.slice().sort((a,b)=>matchStartDate(b)-matchStartDate(a)).slice(0,24);
    if(!done.length){const empty={byTeam:{},updatedAt:Date.now(),coveredMatches:0,totalDoneMatches:0};SHOTS_DATA=empty;return empty;}
    const dates=[...new Set(done.map(m=>m.date))];
    const dayEvents={};
    await Promise.allSettled(dates.map(async d=>{
      try{
        const res=await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${d}&s=Soccer`);
        if(!res.ok)return;
        const j=await res.json();
        dayEvents[d]=(j.events||[]).filter(e=>e.strLeague==='FIFA World Cup');
      }catch(e){}
    }));
    const matched=[];
    done.forEach(m=>{
      const evs=dayEvents[m.date]||[];
      const k1=teamMatchKey(m.team1),k2=teamMatchKey(m.team2);
      const ev=evs.find(e=>{
        const h=teamMatchKey(e.strHomeTeam),a=teamMatchKey(e.strAwayTeam);
        return ((h.includes(k1)||k1.includes(h))&&(a.includes(k2)||k2.includes(a)))||((h.includes(k2)||k2.includes(h))&&(a.includes(k1)||k1.includes(a)));
      });
      if(ev)matched.push({id:ev.idEvent,team1:m.team1,team2:m.team2,homeIsTeam1:teamMatchKey(ev.strHomeTeam).includes(k1)||k1.includes(teamMatchKey(ev.strHomeTeam))});
    });
    const byTeam={};
    const add=(team,key,val)=>{if(!byTeam[team])byTeam[team]={shotsOn:0,shotsTotal:0,shotsBox:0,matches:0};byTeam[team][key]+=val;};
    await Promise.allSettled(matched.map(async mi=>{
      try{
        const res=await fetch(`https://www.thesportsdb.com/api/v1/json/3/lookupeventstats.php?id=${mi.id}`);
        if(!res.ok)return;
        const j=await res.json();
        const stats=j.eventstats||[];
        const get=name=>{const s=stats.find(x=>x.strStat===name);return s?{home:Number(s.intHome)||0,away:Number(s.intAway)||0}:null;};
        const onGoal=get('Shots on Goal'),totalShots=get('Total Shots'),insideBox=get('Shots insidebox');
        if(!onGoal&&!totalShots)return;
        const t1Key=tn(mi.team1),t2Key=tn(mi.team2);
        if(onGoal){add(t1Key,'shotsOn',mi.homeIsTeam1?onGoal.home:onGoal.away);add(t2Key,'shotsOn',mi.homeIsTeam1?onGoal.away:onGoal.home);}
        if(totalShots){add(t1Key,'shotsTotal',mi.homeIsTeam1?totalShots.home:totalShots.away);add(t2Key,'shotsTotal',mi.homeIsTeam1?totalShots.away:totalShots.home);}
        if(insideBox){add(t1Key,'shotsBox',mi.homeIsTeam1?insideBox.home:insideBox.away);add(t2Key,'shotsBox',mi.homeIsTeam1?insideBox.away:insideBox.home);}
        add(t1Key,'matches',1);add(t2Key,'matches',1);
      }catch(e){}
    }));
    const value={byTeam,updatedAt:Date.now(),coveredMatches:matched.length,totalDoneMatches:done.length};
    SHOTS_DATA=value;
    try{localStorage.setItem(SHOTS_CACHE_KEY,JSON.stringify({savedAt:Date.now(),value}));}catch(e){}
    return value;
  })();
  try{return await SHOTS_INFLIGHT;}finally{SHOTS_INFLIGHT=null;}
}
async function loadTeamShotStats(data){
  const el=document.getElementById('homeShotStats');
  if(!el)return;
  if(!SHOTS_DATA)el.innerHTML='<div class="loading-state" style="padding:18px"><div class="spinner"></div><div class="loading-txt">Đang tổng hợp thống kê sút bóng...</div></div>';
  try{
    const shots=await fetchTeamShotStats(data);
    const teams=Object.entries(shots.byTeam).map(([name,s])=>({name,...s})).filter(t=>t.matches>0);
    if(!teams.length){el.innerHTML='<div class="home-empty">Chưa tổng hợp được dữ liệu sút bóng (nguồn phụ chưa khớp được trận nào).</div>';return;}
    const top=teams.sort((a,b)=>b.shotsTotal-a.shotsTotal).slice(0,10);
    el.innerHTML=`<div class="shot-coverage-note">Tổng hợp ${shots.coveredMatches}/${shots.totalDoneMatches} trận gần nhất có dữ liệu · nguồn TheSportsDB</div>
      ${top.map((t,i)=>`<div class="sc-row" style="cursor:default"><span class="sc-rank">${i+1}</span><span class="fl xs"><img src="${FB}w20/${getCC(t.name)}.png" onerror="this.style.display='none'" loading="lazy" alt=""></span><div class="sc-info"><div class="sc-nm">${escapeHTML(t.name)}</div><div class="sc-tm">${t.shotsOn} trúng đích · ${t.shotsBox} trong vòng cấm · ${t.matches} trận</div></div><div class="sc-goals">${t.shotsTotal}</div></div>`).join('')}`;
  }catch(e){console.warn('Shot stats failed',e);el.innerHTML='<div class="home-empty">Không tải được thống kê sút bóng lúc này.</div>';}
}
function findHeadToHead(t1,t2){
  const wc2026=((WC_FEATURE_STATE.lastData&&WC_FEATURE_STATE.lastData.matches)||[]).map(m=>({...m,year:2026}));
  const all=[...(H2H_DATA||[]),...wc2026];
  return all.filter(m=>m.score&&m.score.ft)
    .filter(m=>{const a=tn(m.team1),b=tn(m.team2);return (a===t1&&b===t2)||(a===t2&&b===t1);})
    .sort((x,y)=>y.year-x.year);
}
function renderH2HSection(t1,t2,meetings){
  if(!meetings.length){
    return `<div class="h2h-box"><div class="compare-card-title">🤝 Lịch sử đối đầu tại World Cup</div><div class="home-empty">${escapeHTML(t1)} và ${escapeHTML(t2)} chưa từng gặp nhau tại World Cup (dữ liệu từ 1998–2026).</div></div>`;
  }
  let w1=0,w2=0,d=0;
  const rows=meetings.map(m=>{
    const isT1Home=tn(m.team1)===t1;
    const s1=isT1Home?m.score.ft[0]:m.score.ft[1];
    const s2=isT1Home?m.score.ft[1]:m.score.ft[0];
    if(s1>s2)w1++;else if(s2>s1)w2++;else d++;
    return `<div class="home-mini-row" style="cursor:default"><div class="home-mini-grp" style="width:38px;flex-shrink:0">${m.year}</div><div class="home-mini-teams">${escapeHTML(t1)} <span class="home-mini-score">${s1}-${s2}</span> ${escapeHTML(t2)}</div></div>`;
  }).join('');
  return `<div class="h2h-box">
    <div class="compare-card-title">🤝 Lịch sử đối đầu tại World Cup (${meetings.length} lần, 1998–2026)</div>
    <div class="h2h-summary"><span>${escapeHTML(t1)} thắng <b>${w1}</b></span><span>Hòa <b>${d}</b></span><span>${escapeHTML(t2)} thắng <b>${w2}</b></span></div>
    <div class="home-mini-list" style="margin-top:8px">${rows}</div>
  </div>`;
}
function closeAnalysisSheet(){document.getElementById('analysisSheet').classList.remove('on');}
// Dịch "December 20, 1998 (aged 27)" (định dạng Wikipedia tiếng Anh) sang "20 tháng 12, 1998 (27 tuổi)".
// Không dùng API dịch cho mỗi ngày sinh — đây là pattern cố định, parse trực tiếp đáng tin cậy hơn.
function translateDobToVN(dob){
  const months={January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12};
  const m=String(dob||'').match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s*\(aged\s+(\d+)\)$/);
  if(!m||!months[m[1]])return dob;
  return `${Number(m[2])} tháng ${months[m[1]]}, ${m[3]} (${m[4]} tuổi)`;
}
// Lấy mô tả/tiểu sử cầu thủ — ưu tiên bản tiếng Việt thật trên Wikipedia (qua langlinks, không phải máy dịch);
// chỉ dùng bản tiếng Anh khi cầu thủ chưa có bài viết tiếng Việt.
async function fetchPlayerSummaryVN(wikiSlug){
  let viTitle=null;
  try{
    const r=await fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${wikiSlug}&prop=langlinks&lllang=vi&format=json&origin=*`);
    if(r.ok){
      const j=await r.json();
      const page=Object.values(j?.query?.pages||{})[0];
      viTitle=page?.langlinks?.[0]?.['*']||null;
    }
  }catch(e){}
  if(viTitle){
    try{
      const r2=await fetch(`https://vi.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(viTitle.replace(/ /g,'_'))}`);
      if(r2.ok){const j2=await r2.json();if(!j2.type||j2.type!=='disambiguation')return j2;}
    }catch(e){}
  }
  try{
    const r3=await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiSlug}`);
    if(r3.ok){const j3=await r3.json();if(!j3.type||j3.type!=='disambiguation')return j3;}
  }catch(e){}
  return null;
}
// Popup thông tin cầu thủ — dùng chung sheet với Phân tích trận đấu (chỉ hiện 1 trong 2 cùng lúc).
async function openPlayerSheet(nameRaw,teamRaw){
  const name=decodeURIComponent(nameRaw),teamName=decodeURIComponent(teamRaw);
  const team=getTeamMeta(teamName);
  const cc=getCC(teamName);
  document.getElementById('analysisTitle').textContent=name;
  const body=document.getElementById('analysisBody');
  body.innerHTML='<div class="loading-state"><div class="spinner"></div><div class="loading-txt">Đang tải thông tin cầu thủ...</div></div>';
  document.getElementById('analysisSheet').classList.add('on');

  const data=WC_FEATURE_STATE.lastData;
  const all=(data&&data.matches)||[];
  let goalsWC=0;const matchKeys=new Set();
  all.forEach(m=>{
    (m.goals1||[]).forEach(g=>{if(g.name===name){goalsWC++;matchKeys.add(m.date+'|'+m.team1+'|'+m.team2);}});
    (m.goals2||[]).forEach(g=>{if(g.name===name){goalsWC++;matchKeys.add(m.date+'|'+m.team1+'|'+m.team2);}});
  });

  let info=null;
  try{
    await fetchSquadData();
    let squadMatch=team?findSquadForTeam(team):null;
    if((!squadMatch||!squadMatch.players.length)&&team){
      const wikiName=TEAM_WIKI_MAP[team.n]||team.n;
      try{const players=await fetchSquadFromTeamPage(wikiName);if(players&&players.length)squadMatch={players};}catch(e){}
    }
    if(squadMatch)info=squadMatch.players.find(p=>normalizeSquadKey(p.name)===normalizeSquadKey(name));
  }catch(e){console.warn('Player info fetch failed',e);}

  // Tiểu sử ngắn từ Wikipedia REST API — ưu tiên bản tiếng Việt thật (qua langlinks), chỉ dùng bản tiếng Anh
  // nếu cầu thủ chưa có bài tiếng Việt.
  const summary=info?.wikiSlug?await fetchPlayerSummaryVN(info.wikiSlug):null;
  // Ảnh đại diện dùng CHUNG resolvePlayerAvatar với danh sách Vua phá lưới/danh sách cầu thủ — đảm bảo
  // luôn ra đúng 1 ảnh cho mỗi người dù mở từ đâu (trước đây popup tự lấy ảnh riêng từ summary nên có lúc lệch ảnh so với list).
  const avatarSrc=await resolvePlayerAvatar(name,info?.wikiSlug,teamName);

  const rows=[];
  rows.push(`<div class="compare-stat"><span>Bàn tại World Cup 2026</span><strong style="color:var(--amber)">${goalsWC} ⚽</strong></div>`);
  rows.push(`<div class="compare-stat"><span>Lập công trong</span><strong>${matchKeys.size} trận đã đấu</strong></div>`);
  if(info?.pos)rows.push(`<div class="compare-stat"><span>Vị trí</span><strong>${escapeHTML(posVN(info.pos))}</strong></div>`);
  if(info?.club)rows.push(`<div class="compare-stat"><span>CLB hiện tại</span><strong>${escapeHTML(info.club)}</strong></div>`);
  if(info?.dob)rows.push(`<div class="compare-stat"><span>Ngày sinh</span><strong>${escapeHTML(translateDobToVN(info.dob))}</strong></div>`);
  if(info?.caps)rows.push(`<div class="compare-stat"><span>Số lần khoác áo ĐTQG (sự nghiệp)</span><strong>${escapeHTML(info.caps)}</strong></div>`);
  if(info?.careerGoals)rows.push(`<div class="compare-stat"><span>Bàn thắng ĐTQG (sự nghiệp)</span><strong>${escapeHTML(info.careerGoals)}</strong></div>`);

  const avatarHtml=avatarSrc
    ?`<img class="player-avatar" src="${escapeHTML(avatarSrc)}" alt="${escapeHTML(name)}" loading="lazy" onerror="this.style.display='none'">`
    :`<div class="player-avatar player-avatar-ph">👤</div>`;
  const descHtml=summary?.description?`<div class="player-desc">${escapeHTML(summary.description)}</div>`:'';
  const extractHtml=summary?.extract?`<div class="player-extract">${escapeHTML(summary.extract)}</div>`:'';

  document.getElementById('analysisBody').innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      ${avatarHtml}
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:6px"><span class="fl xs"><img src="${FB}w20/${cc}.png" loading="lazy" alt=""></span><span style="font-size:12.5px;font-weight:700;color:var(--text)">${escapeHTML(team?team.n:teamName)}</span></div>
        ${descHtml}
      </div>
    </div>
    <div class="compare-card">${rows.join('')}</div>
    ${extractHtml}
    <div class="analysis-foot">⚠️ Số trận/bàn thắng tại World Cup 2026 tính từ dữ liệu trận đấu thực tế. Số liệu "sự nghiệp"/ảnh/tiểu sử lấy từ Wikipedia, không phải số liệu riêng cho giải này vì nguồn mở hiện chưa công khai dữ liệu ra sân theo từng trận.</div>
  `;
}
function normalizeText(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function matchStartDate(match){return parseMatchTime(match.date,match.time)||new Date((match.date||'')+'T00:00:00');}
function formatMatchDateTime(match){
  const dt=matchStartDate(match);
  return dt.toLocaleString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:APP_TIME_ZONE});
}
function displayMatchTime(match){
  const dt=matchStartDate(match);
  return dt.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',timeZone:APP_TIME_ZONE});
}
function countdownText(match){
  const st=matchStatus(match);
  if(st.status==='done')return 'Đã kết thúc';
  if(st.status==='live')return 'Đang diễn ra';
  const diff=matchStartDate(match)-new Date();
  if(diff<=0)return 'Sắp bắt đầu';
  const d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),m=Math.floor((diff%3600000)/60000);
  if(d>0)return `Còn ${d} ngày ${h} giờ`;
  if(h>0)return `Còn ${h} giờ ${m} phút`;
  return `Còn ${Math.max(1,m)} phút`;
}

// v1.20.0 — Chỉ hiển thị trận đã xác định đủ 2 đội.
// v1.21.0 — Múi giờ mặc định và duy nhất: Giờ Việt Nam (UTC+7).
// Các seed như Winner Group A / Runner-up Group B / 1A / 2A sẽ được tự resolve
// khi vòng bảng đã có đủ kết quả, sau đó trận sẽ tự xuất hiện trong lịch.
function isPlaceholderTeamName(name){
  const raw=String(name||'').trim();
  if(!raw)return true;
  const n=normalizeText(raw);
  if(['tbd','tba','to be determined','to be confirmed','unknown','-','—'].includes(n))return true;
  if(/\b(uefa|afc|caf|concacaf|conmebol|ofc)\s+(path|play\s*off|playoff)/i.test(raw))return true;
  if(/\b(path|play\s*off|playoff)\b/i.test(raw))return true;
  if(/\b(winner|runner\s*-?up|best\s+third|third\s+place|loser)\b/i.test(raw))return true;
  if(/\b(match|game)\s*\d+\b/i.test(raw))return true;
  if(/^\s*[12]\s*[A-L]\s*$/i.test(raw))return true;
  if(/^\s*[WL]\s*\d+\s*$/i.test(raw))return true;
  if(/^\s*(1st|2nd|first|second|1º|2º)\s+(place\s+)?(group\s+)?[A-L]\s*$/i.test(raw))return true;
  return false;
}
function computeResolvedGroupRankings(data){
  const groups={};
  (data&&data.matches?data.matches:[]).filter(m=>m.group).forEach(m=>{
    const g=m.group;
    if(!groups[g])groups[g]={teams:{},matches:[],done:0};
    groups[g].matches.push(m);
    [m.team1,m.team2].forEach(t=>{
      if(!isPlaceholderTeamName(t)&&!groups[g].teams[t])groups[g].teams[t]={team:t,pts:0,w:0,d:0,l:0,gf:0,ga:0};
    });
    if(m.score&&m.score.ft&&!isPlaceholderTeamName(m.team1)&&!isPlaceholderTeamName(m.team2)){
      groups[g].done++;
      const [s1,s2]=m.score.ft;
      const t1=groups[g].teams[m.team1],t2=groups[g].teams[m.team2];
      if(!t1||!t2)return;
      t1.gf+=s1;t1.ga+=s2;t2.gf+=s2;t2.ga+=s1;
      if(s1>s2){t1.w++;t1.pts+=3;t2.l++;}
      else if(s1<s2){t2.w++;t2.pts+=3;t1.l++;}
      else{t1.d++;t1.pts++;t2.d++;t2.pts++;}
    }
  });
  const out={};
  Object.entries(groups).forEach(([g,obj])=>{
    const teams=Object.values(obj.teams);
    const expectedMatches=teams.length===4?6:obj.matches.length;
    const complete=teams.length>=4&&obj.done>=expectedMatches;
    out[g]={complete,ranking:teams.sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf)};
  });
  return out;
}
function resolveSeedTeamName(data,name){
  const raw=String(name||'').trim();
  if(!raw)return raw;
  const rankings=computeResolvedGroupRankings(data);
  let rank=null, groupLetter=null;
  let m=raw.match(/^\s*1\s*([A-L])\s*$/i)||raw.match(/^\s*(?:1st|first|1º)\s+(?:place\s+)?(?:group\s+)?([A-L])\s*$/i)||raw.match(/\bwinner\s+(?:of\s+)?group\s+([A-L])\b/i)||raw.match(/\bgroup\s+([A-L])\s+winner\b/i);
  if(m){rank=0;groupLetter=m[1].toUpperCase();}
  if(rank===null){
    m=raw.match(/^\s*2\s*([A-L])\s*$/i)||raw.match(/^\s*(?:2nd|second|2º)\s+(?:place\s+)?(?:group\s+)?([A-L])\s*$/i)||raw.match(/\brunner\s*-?up\s+(?:of\s+)?group\s+([A-L])\b/i)||raw.match(/\bgroup\s+([A-L])\s+runner\s*-?up\b/i);
    if(m){rank=1;groupLetter=m[1].toUpperCase();}
  }
  if(rank===null)return raw;
  const g='Group '+groupLetter;
  const pack=rankings[g];
  if(!pack||!pack.complete||!pack.ranking[rank])return raw;
  return pack.ranking[rank].team;
}
function prepareVisibleScheduleMatch(data,match,index){
  if(!match)return null;
  const t1=resolveSeedTeamName(data,match.team1);
  const t2=resolveSeedTeamName(data,match.team2);
  if(isPlaceholderTeamName(t1)||isPlaceholderTeamName(t2))return null;
  return {...match,team1:t1,team2:t2,_sourceIndex:index};
}
function getVisibleScheduleMatches(data){
  return (data&&data.matches?data.matches:[]).map((m,i)=>prepareVisibleScheduleMatch(data,m,i)).filter(Boolean);
}

function matchPassesFilters(match){
  const f=WC_FEATURE_STATE.filters;
  const status=matchStatus(match).status;
  if(f.status!=='all'&&f.status!==status)return false;
  if(WC_FEATURE_STATE.hideDone&&isOldDoneMatch(match))return false;
  return true;
}
function getFilteredMatches(){
  const data=WC_FEATURE_STATE.lastData;
  return getVisibleScheduleMatches(data).filter(matchPassesFilters);
}
function buildEnhancedMatchCard(m,st,extraCls){
  const base=buildMatchCard(m,st,extraCls);
  const extra=`<div class="match-countdown">${countdownText(m)}</div><div class="mc-date-mini">${formatMatchDateTime(m)}</div>`;
  return base.replace('<span class="mc-ven">',''+extra+'<span class="mc-ven">');
}

function shortDateVN(dt){
  if(!dt||isNaN(dt))return'';
  return dt.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});
}
function renderHomeDashboard(dataObj, visibleMatches){
  const upcomingEl=document.getElementById('homeUpcomingList');
  const resultsEl=document.getElementById('homeResultsList');
  if(!upcomingEl&&!resultsEl)return;
  const all=visibleMatches||getVisibleScheduleMatches(dataObj||{});
  const flagHtml=name=>`<span class="fl xs"><img src="${FB}w20/${getCC(name)}.png" onerror="this.style.display='none'" loading="lazy" alt=""></span>`;
  const dateTimeBlock=m=>{const dt=matchStartDate(m);return `<div class="home-mini-time"><div class="home-mini-date">${shortDateVN(dt)}</div><div class="home-mini-hm">${displayMatchTime(m)}</div></div>`;};
  const upcoming=all.filter(m=>{const s=matchStatus(m).status;return s==='soon'||s==='live';})
    .sort((a,b)=>matchStartDate(a)-matchStartDate(b)).slice(0,4);
  const results=all.filter(m=>matchStatus(m).status==='done'&&m.score&&m.score.ft)
    .sort((a,b)=>matchStartDate(b)-matchStartDate(a)).slice(0,4);
  const rowClick=m=>`onclick="openMatchModalByTeamsDate('${encodeURIComponent(tn(m.team1))}','${encodeURIComponent(tn(m.team2))}','${m.date}')"`;
  if(upcomingEl)upcomingEl.innerHTML=upcoming.length?upcoming.map(m=>`<div class="home-mini-row" ${rowClick(m)}>${dateTimeBlock(m)}<div class="home-mini-teams">${flagHtml(m.team1)}${escapeHTML(tn(m.team1))} vs ${escapeHTML(tn(m.team2))}${flagHtml(m.team2)}</div><div class="home-mini-grp">${escapeHTML(m.group||m.round||'')}</div></div>`).join('')
    :'<div class="home-empty">Chưa có trận sắp tới đã xác định đủ 2 đội.</div>';
  if(resultsEl)resultsEl.innerHTML=results.length?results.map(m=>`<div class="home-mini-row" ${rowClick(m)}>${dateTimeBlock(m)}<div class="home-mini-teams">${flagHtml(m.team1)}${escapeHTML(tn(m.team1))} <span class="home-mini-score">${m.score.ft[0]}-${m.score.ft[1]}</span> ${escapeHTML(tn(m.team2))}${flagHtml(m.team2)}</div><div class="home-mini-grp">${escapeHTML(m.group||m.round||'')}</div></div>`).join('')
    :'<div class="home-empty">Chưa có kết quả trận đấu.</div>';
  // Badge LIVE trên Trang chủ trước đây hiện tĩnh dù không có trận nào đang diễn ra — chỉ hiện khi thật sự có trận live.
  const livePill=document.getElementById('homeLivePill');
  if(livePill)livePill.style.display=all.some(m=>matchStatus(m).status==='live')?'':'none';
}

const originalRenderSchedule_v115=renderSchedule;
renderSchedule=function(data){
  const container=document.getElementById('matchesContainer');
  if(!container)return;
  WC_FEATURE_STATE.lastData=data||WC_FEATURE_STATE.lastData;
  if(!WC_FEATURE_STATE.lastData||!WC_FEATURE_STATE.lastData.matches){originalRenderSchedule_v115(data);return;}
  const dataObj=WC_FEATURE_STATE.lastData;
  let totalGoals=0,doneCount=0;
  dataObj.matches.forEach(m=>{if(m.score&&m.score.ft){totalGoals+=m.score.ft[0]+m.score.ft[1];doneCount++;}});
  const kg=document.getElementById('kpi-goals'),km=document.getElementById('kpi-matches');
  if(kg)kg.textContent=totalGoals;
  if(km)km.textContent=doneCount+'/'+dataObj.matches.length;
  const visibleAll=getVisibleScheduleMatches(dataObj);
  renderHomeDashboard(dataObj, visibleAll);
  const hiddenCount=Math.max(0,(dataObj.matches||[]).length-visibleAll.length);
  const matches=getFilteredMatches().sort((a,b)=>matchStartDate(a)-matchStartDate(b));
  const hiddenNote=hiddenCount?`<div class="note-banner">🧩 Đã tạm ẩn ${hiddenCount} trận chưa xác định đủ 2 đội. Khi dữ liệu cập nhật đội thắng, nhất bảng hoặc nhì bảng, các trận này sẽ tự động hiển thị.</div>`:'';
  if(!matches.length){container.innerHTML=hiddenNote+'<div class="error-state">⚠ Không có trận đã xác định đủ 2 đội khớp bộ lọc hiện tại</div>';return;}
  const byDate=groupMatchesByDate(matches);
  const html=Object.keys(byDate).sort().map(date=>`<div class="day-sep"><div class="ds-line"></div><div class="ds-txt">${formatDate(date)}</div><div class="ds-line"></div></div>${byDate[date].map(m=>buildEnhancedMatchCard(m,matchStatus(m),matchStatus(m).status==='live'?'live-m':'')).join('')}`).join('');
  container.innerHTML=html;
  container.querySelectorAll('.mc').forEach((card,i)=>{
    card.style.animationDelay=Math.min(i*30,400)+'ms';
    card.addEventListener('click',()=>{
      let goals1=[],goals2=[];
      try{goals1=JSON.parse(card.dataset.goals1||'[]');}catch(e){}
      try{goals2=JSON.parse(card.dataset.goals2||'[]');}catch(e){}
      openMatchModal(card.dataset.team1,card.dataset.team2,card.dataset.s1,card.dataset.s2,getCC(card.dataset.team1),getCC(card.dataset.team2),card.dataset.st,card.dataset.grp,card.dataset.ven,{goals1,goals2},card.dataset.vnt);
    });
  });
};
filterMatches=function(f,btn){
  WC_FEATURE_STATE.filters.status=f;
  renderSchedule(WC_FEATURE_STATE.lastData);
  if(btn){document.querySelectorAll('#pg-schedule .pills .pill').forEach(b=>b.classList.remove('on'));btn.classList.add('on');}
};

// So sánh version dạng 'vX.Y.Z' theo đúng giá trị số, không theo thứ tự xuất hiện trong mảng
// (mảng WC_CHANGELOG được thêm dần qua thời gian nên có vài bản không nằm đúng thứ tự, ví dụ v1.25.0 nằm sau v1.28.0).
function compareVersions(a,b){
  const pa=String(a||'').replace(/^v/i,'').split('.').map(Number);
  const pb=String(b||'').replace(/^v/i,'').split('.').map(Number);
  for(let i=0;i<Math.max(pa.length,pb.length);i++){
    const d=(pa[i]||0)-(pb[i]||0);
    if(d)return d;
  }
  return 0;
}
function ensureChangelogModal(){
  if(document.getElementById('changelogModal'))return;
  const m=document.createElement('div');m.id='changelogModal';m.className='changelog-modal';m.onclick=e=>{if(e.target===m)m.classList.remove('on')};
  const sorted=WC_CHANGELOG.slice().sort((a,b)=>compareVersions(b[0],a[0]));
  m.innerHTML=`<div class="change-box"><div class="change-head"><div><div class="change-title">Build ${APP_VERSION}</div><div style="font-size:11px;color:var(--text3);margin-top:3px">Lịch sử version theo từng chức năng</div></div><button class="close-lite" onclick="document.getElementById('changelogModal').classList.remove('on')">✕</button></div><div class="change-body">${sorted.map(([v,t])=>`<div class="change-item"><div class="change-ver">${v}</div><div class="change-text">${t}</div></div>`).join('')}</div></div>`;
  document.body.appendChild(m);
}
function showChangelog(){ensureChangelogModal();document.getElementById('changelogModal').classList.add('on');}

const originalOpenMatchModal_v115=openMatchModal;
openMatchModal=function(t1,t2,s1,s2,cc1,cc2,status,grp,venue,goals,vnTime){
  originalOpenMatchModal_v115(t1,t2,s1,s2,cc1,cc2,status,grp,venue,goals,vnTime);
  const body=document.getElementById('mm-body');if(!body)return;
  const a=getTeamMeta(t1),b=getTeamMeta(t2);
  let html=`<div class="compare-box"><div class="mm-glbl">⚖️ So sánh trước trận</div><div class="compare-grid"><div class="compare-card"><div class="compare-name">${t1}</div>${teamCompareRows(a)}</div><div class="compare-card"><div class="compare-name">${t2}</div>${teamCompareRows(b)}</div></div></div>`;
  const isUpcoming=s1===''||s2==='';
  if(isUpcoming){
    const prob=matchWinProbability(a,b);
    const score=predictScoreline(a,b);
    html+=`<div class="compare-box"><div class="mm-glbl">📊 Tỷ lệ thắng tham khảo</div>
      <div class="prob-labels"><span>${escapeHTML(t1)}</span><span>Hòa</span><span>${escapeHTML(t2)}</span></div>
      <div class="prob-bar">
        <div class="prob-seg a" style="flex:${Math.max(prob.winA,6)}">${prob.winA}%</div>
        <div class="prob-seg d" style="flex:${Math.max(prob.draw,6)}">${prob.draw}%</div>
        <div class="prob-seg b" style="flex:${Math.max(prob.winB,6)}">${prob.winB}%</div>
      </div>
      <div class="predicted-score"><span>${escapeHTML(t1)}</span><strong>${score.ga} - ${score.gb}</strong><span>${escapeHTML(t2)}</span></div>
      <div class="analysis-foot">⚠️ Tỷ lệ và tỷ số phía trên chỉ là quy đổi tham khảo từ xếp hạng FIFA qua hàm logistic, không dùng lịch sử đối đầu hay cá cược, không phải dự đoán chính thức từ FIFA.</div>
    </div>`;
  }
  html+=`<div id="mmH2H"><div class="loading-state" style="padding:18px"><div class="spinner"></div><div class="loading-txt">Đang tải lịch sử đối đầu...</div></div></div>`;
  body.innerHTML+=html;
  fetchHistoricalMatches().then(()=>{
    const slot=document.getElementById('mmH2H');
    if(slot)slot.innerHTML=renderH2HSection(t1,t2,findHeadToHead(t1,t2));
  }).catch(()=>{
    const slot=document.getElementById('mmH2H');
    if(slot)slot.innerHTML='<div class="home-empty">Không tải được lịch sử đối đầu lúc này.</div>';
  });
};
function teamCompareRows(t){
  if(!t)return '<div class="compare-stat"><span>Dữ liệu</span><strong>Đang cập nhật</strong></div>';
  return `<div class="compare-stat"><span>Bảng</span><strong>${t.g}</strong></div><div class="compare-stat"><span>FIFA</span><strong>#${t.r}</strong></div><div class="compare-stat"><span>HLV</span><strong>${t.coach||'—'}</strong></div><div class="compare-stat"><span>Đội trưởng</span><strong>${t.cap||'—'}</strong></div><div class="compare-stat"><span>Ngôi sao</span><strong>${(t.players&&t.players[0])||'—'}</strong></div>`;
}

// Trả về HTML danh sách kết quả các trận ĐÃ HOÀN THÀNH của đội t tại giải này.
function teamMatchResultsHtml(t){
  const data=WC_FEATURE_STATE.lastData;
  const matches=(data&&data.matches?data.matches:[]).filter(m=>m.score&&m.score.ft&&(tn(m.team1)===t.n||tn(m.team2)===t.n))
    .sort((a,b)=>matchStartDate(b)-matchStartDate(a));
  const flagHtml=name=>`<span class="fl xs"><img src="${FB}w20/${getCC(name)}.png" onerror="this.style.display='none'" loading="lazy" alt=""></span>`;
  const body=matches.length?matches.map(m=>{
    const isTeam1=tn(m.team1)===t.n;
    const opp=isTeam1?m.team2:m.team1;
    const myScore=isTeam1?m.score.ft[0]:m.score.ft[1];
    const oppScore=isTeam1?m.score.ft[1]:m.score.ft[0];
    const result=myScore>oppScore?{lbl:'Thắng',cls:'win'}:myScore<oppScore?{lbl:'Thua',cls:'loss'}:{lbl:'Hòa',cls:'draw'};
    return `<div class="home-mini-row" onclick="openMatchModalByTeamsDate('${encodeURIComponent(tn(m.team1))}','${encodeURIComponent(tn(m.team2))}','${m.date}')"><span class="result-tag ${result.cls}">${result.lbl}</span><div class="home-mini-teams">${flagHtml(opp)}${escapeHTML(tn(opp))} <span class="home-mini-score">${myScore}-${oppScore}</span></div><div class="home-mini-grp">${shortDateVN(matchStartDate(m))}</div></div>`;
  }).join(''):'<div class="home-empty">Đội chưa có trận nào hoàn thành tại giải này.</div>';
  return `<div class="squad-box"><div class="squad-title">⚽ Kết quả tại World Cup 2026 (${matches.length} trận)</div><div class="home-mini-list" style="margin-top:10px">${body}</div></div>`;
}
const originalOpenTeamModal_v115=openTeamModal;
openTeamModal=function(t){
  originalOpenTeamModal_v115(t);
  const body=document.getElementById('tm-body');if(!body)return;
  const score=teamStrengthScore(t),tier=strengthTier(score);
  body.innerHTML+=`<div class="tm-row"><span class="tm-key">Đánh giá tổng quan</span><span class="tm-val amber">${score}/100 · ${tier.label}</span></div>${teamMatchResultsHtml(t)}<div class="road-box"><div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);margin-bottom:10px">🛣 Road to Final</div><div class="road-line"><div class="road-step current"><strong>Vòng bảng</strong><span>Bảng ${t.g}</span></div><div class="road-step"><strong>1/32</strong><span>Chờ kết quả</span></div><div class="road-step"><strong>1/8</strong><span>Chờ kết quả</span></div><div class="road-step"><strong>Tứ kết</strong><span>Chờ kết quả</span></div><div class="road-step"><strong>Bán kết</strong><span>Chờ kết quả</span></div><div class="road-step"><strong>Chung kết</strong><span>19/07</span></div></div><div class="analysis-foot">⚠️ Đánh giá tham khảo dựa trên xếp hạng FIFA trong dữ liệu nội bộ, không phải xếp hạng chính thức.</div></div>`;
};

function setupPWA(){
  const manifest={name:'FIFA World Cup 2026 Fan Site',short_name:'WC2026',start_url:'./worldcup2026.html',display:'standalone',background_color:'#0D1117',theme_color:'#0D1117',lang:'vi',description:'Lịch thi đấu, bảng đấu và đội tuyển FIFA World Cup 2026.'};
  let link=document.querySelector('link[rel="manifest"]');if(!link){link=document.createElement('link');link.rel='manifest';document.head.appendChild(link);}link.href='data:application/manifest+json;charset=utf-8,'+encodeURIComponent(JSON.stringify(manifest));
  if(!document.querySelector('meta[name="application-name"]')){const m=document.createElement('meta');m.name='application-name';m.content='WC2026';document.head.appendChild(m);}
}
const SEO_MAP={home:['FIFA World Cup 2026 Fan Site','Trang chủ fan site FIFA World Cup 2026: lịch thi đấu, đội tuyển và bảng đấu bằng tiếng Việt.'],schedule:['Lịch thi đấu World Cup 2026','Xem lịch thi đấu FIFA World Cup 2026, lọc theo đội, bảng, vòng đấu và giờ Việt Nam.'],groups:['Bảng đấu World Cup 2026','Bảng xếp hạng 12 bảng A–L của FIFA World Cup 2026.'],teams:['Đội tuyển World Cup 2026','Danh sách đội tuyển tham dự FIFA World Cup 2026.']};
function updateSectionSEO(id){
  const cfg=SEO_MAP[id]||SEO_MAP.home;document.title=cfg[0]+' · FIFA World Cup 2026 Fan Site';
  let desc=document.querySelector('meta[name="description"]');if(desc)desc.content=cfg[1];
  let canon=document.querySelector('link[rel="canonical"]');if(canon)canon.href=location.origin+location.pathname+'#'+id;
}
const originalGoTo_v115=goTo;
goTo=function(id,btn,fromHash=false){originalGoTo_v115(id,btn,fromHash);updateSectionSEO(id);};
function injectCleanJsonLd(){
  if(document.getElementById('wc-clean-jsonld'))return;
  const data={"@context":"https://schema.org","@type":"WebApplication","name":"FIFA World Cup 2026 Fan Site","applicationCategory":"SportsApplication","operatingSystem":"Web","inLanguage":"vi","url":location.origin+location.pathname,"version":APP_VERSION,"description":"Fan site một file HTML cho lịch thi đấu, bảng đấu, nhánh đấu, tin tức và thống kê FIFA World Cup 2026."};
  const script=document.createElement('script');script.type='application/ld+json';script.id='wc-clean-jsonld';script.textContent=JSON.stringify(data);document.head.appendChild(script);
}
function setupFeaturePack(){
  ensureChangelogModal();
  const chip=document.querySelector('.build-chip');if(chip){chip.title='Bấm để xem lịch sử version';chip.onclick=showChangelog;}
  setupPWA();injectCleanJsonLd();updateSectionSEO(pageFromHash());
}

(async()=>{
  applyTheme(document.documentElement.getAttribute('data-theme')||'dark');
  setupModalScrollLock();
  renderBuildVersion();
  setupFeaturePack();
  // Render ngay lập tức từ dữ liệu tĩnh — phù hợp GitHub Pages, không cần backend
  buildGroups(null);
  buildTeams();
  syncHashToPage();
  // Sau đó fetch API để overlay kết quả thực tế (nếu có)
  await refreshData();
  setInterval(refreshData,60000);
})();
