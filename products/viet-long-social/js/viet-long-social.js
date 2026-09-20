/* ══════════════════════════════════════════════
   CONFIG & STATE
══════════════════════════════════════════════ */
const PLAT = {
  youtube:  { name:'YOUTUBE',   ico:'▶', cls:'yt', ph:'https://www.youtube.com/@MrBeast',
    parse(u){ const m=u.match(/youtube\.com\/@([^\/\?&\s]+)/)||u.match(/youtube\.com\/c\/([^\/\?&\s]+)/)||u.match(/youtube\.com\/channel\/(UC[^\/\?&\s]+)/)||u.match(/youtube\.com\/user\/([^\/\?&\s]+)/); return m?m[1]:u.replace(/^@/,'').trim()||null; },
    keys:['followers','videos','views'], labels:{followers:'SUBSCRIBERS',videos:'VIDEOS',views:'TOTAL VIEWS'}, primary:'followers' },
  tiktok:   { name:'TIKTOK',    ico:'♪', cls:'tt', ph:'https://www.tiktok.com/@thubee26',
    parse(u){ const m=u.match(/tiktok\.com\/@([^\/\?&\s]+)/); return m?m[1]:u.replace(/^@/,'').trim()||null; },
    keys:['followers','likes','videos'], labels:{followers:'FOLLOWERS',likes:'TOTAL LIKES',videos:'VIDEOS'}, primary:'followers' },
  instagram:{ name:'INSTAGRAM', ico:'◈', cls:'ig', ph:'https://www.instagram.com/cristiano',
    parse(u){ const m=u.match(/instagram\.com\/([^\/\?&\s]+)/); return(m&&!['p','reel','explore','accounts','stories'].includes(m[1]))?m[1]:u.replace(/^@/,'').trim()||null; },
    keys:['followers','following','posts'], labels:{followers:'FOLLOWERS',following:'FOLLOWING',posts:'POSTS'}, primary:'followers' }
};

const COLORS = { yt:'#ff5555', tt:'#00f2ea', ig:'#e1306c', default:'#00f5ff' };
const CHART_COLORS = ['#00f5ff','#ff006e','#39ff14','#bf00ff','#ffff00','#ff6600'];

let cur = 'youtube';
let trackers = {};       // id → {id, platform, username, data, history[], intervalId, updateCount}
let fsId = null;         // current fullscreen tracker
let sessionStart = Date.now();
let totalUpdates = 0;

/* Milestones to celebrate */
const MILESTONES = [1e3,1e4,5e4,1e5,5e5,1e6,5e6,1e7,5e7,1e8,5e8,1e9];

/* ══════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════ */
function fmt(n){ if(typeof n!=='number')return n||'—'; if(n>=1e9)return(n/1e9).toFixed(2)+'B'; if(n>=1e6)return(n/1e6).toFixed(2)+'M'; if(n>=1e3)return(n/1e3).toFixed(1)+'K'; return n.toLocaleString('vi-VN'); }
function fmtFull(n){ if(typeof n!=='number')return '0'; return n.toLocaleString('vi-VN'); }

function toast(msg, type='', dur=3200){
  const c=document.getElementById('toasts');
  const t=document.createElement('div');
  t.className=`toast ${type}`; t.textContent=msg; c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(12px)';setTimeout(()=>t.remove(),300);},dur);
}

function selTab(btn,p){ document.querySelectorAll('.tb').forEach(b=>b.classList.remove('ac')); btn.classList.add('ac'); cur=p; document.getElementById('ui').placeholder=PLAT[p].ph; }

function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  const navMap={tracker:0,compare:1,chart:2};
  document.querySelectorAll('.nav-btn')[navMap[name]||0]?.classList.add('active');
  if(name==='compare') refreshCompareSelects();
  if(name==='chart')   refreshChartSelects();
}

/* ══════════════════════════════════════════════
   CORS PROXY FETCH
══════════════════════════════════════════════ */
const PROXIES=[
  u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  u=>`https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];
async function proxyGet(url,ms=10000){
  for(const mk of PROXIES){
    try{
      const r=await fetch(mk(url),{signal:AbortSignal.timeout(ms)});
      if(!r.ok)continue;
      const t=await r.text();
      if(t&&t.trim().length>5)return t;
    }catch{}
  }
  return null;
}

/* ══════════════════════════════════════════════
   PLATFORM FETCHERS
══════════════════════════════════════════════ */
function parseShortNum(s){
  if(!s)return 0; s=s.toString().trim().replace(/,/g,'').replace(/\s/g,'');
  if(/tỷ/i.test(s))return Math.round(parseFloat(s)*1e9);
  if(/triệu/i.test(s))return Math.round(parseFloat(s)*1e6);
  if(/nghìn/i.test(s))return Math.round(parseFloat(s)*1e3);
  if(/B$/i.test(s))return Math.round(parseFloat(s)*1e9);
  if(/M$/i.test(s))return Math.round(parseFloat(s)*1e6);
  if(/K$/i.test(s))return Math.round(parseFloat(s)*1e3);
  return parseInt(s.replace(/[^\d]/g,''))||0;
}

async function fetchYouTube(username){
  let name=username, subs=0, vids=0, views=0;
  try{ const oe=await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/@${encodeURIComponent(username)}&format=json`,{signal:AbortSignal.timeout(6000)}); if(oe.ok){const j=await oe.json();name=j.author_name||username;} }catch{}
  const html=await proxyGet(`https://www.youtube.com/@${encodeURIComponent(username)}`);
  if(html){
    const sm=html.match(/"subscriberCountText":"([^"]+)"/)
           ||html.match(/"subscriberCountText":\{"simpleText":"([^"]+)"\}/);
    if(sm)subs=parseShortNum(sm[1]);
    const vm=html.match(/"videosCountText":\{"runs":\[\{"text":"([^"]+)"\}/)||html.match(/"videoCount":"(\d+)"/);
    if(vm)vids=parseShortNum(vm[1]);
    const vwm=html.match(/"viewCount":"(\d+)"/);
    if(vwm)views=parseInt(vwm[1])||0;
  }
  if(!subs){ const h2=await proxyGet(`https://www.youtube.com/@${encodeURIComponent(username)}/about`); if(h2){const m=h2.match(/"subscriberCountText":"([^"]+)"/); if(m)subs=parseShortNum(m[1]);} }
  return {name,handle:username,followers:subs,videos:vids,views};
}

async function fetchTikTok(username){
  let followers=0,likes=0,videos=0,name=username;
  try{ const ne=await fetch(`https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${encodeURIComponent(username)}`,{signal:AbortSignal.timeout(6000)}); if(ne.ok){const j=await ne.json();name=j.author_name||username;} }catch{}
  const html=await proxyGet(`https://www.tiktok.com/@${encodeURIComponent(username)}`);
  if(html){
    const mF=html.match(/"followerCount"\s*:\s*(\d+)/); if(mF)followers=parseInt(mF[1])||0;
    const mL=html.match(/"heartCount"\s*:\s*(\d+)/);    if(mL)likes=parseInt(mL[1])||0;
    const mV=html.match(/"videoCount"\s*:\s*(\d+)/);    if(mV)videos=parseInt(mV[1])||0;
    const mN=html.match(/"nickname"\s*:\s*"([^"]+)"/);  if(mN)name=mN[1];
  }
  return {name,handle:username,followers,likes,videos};
}

async function fetchInstagram(username){
  let followers=0,following=0,posts=0,name=username;
  const html=await proxyGet(`https://www.instagram.com/${encodeURIComponent(username)}/`);
  if(html){
    const ogDesc=html.match(/content="([^"]*\d+[KMB]?\s*Followers[^"]*)"/i);
    if(ogDesc){
      const desc=ogDesc[1];
      const fM=desc.match(/([\d,.]+[KMB]?)\s*Followers?/i);  if(fM)followers=parseShortNum(fM[1]);
      const foM=desc.match(/([\d,.]+[KMB]?)\s*Following/i);  if(foM)following=parseShortNum(foM[1]);
      const pM=desc.match(/([\d,.]+[KMB]?)\s*Posts?/i);      if(pM)posts=parseShortNum(pM[1]);
    }
    if(!followers){
      const mF=html.match(/"edge_followed_by":\{"count":(\d+)\}/);  if(mF)followers=parseInt(mF[1])||0;
      const mFo=html.match(/"edge_follow":\{"count":(\d+)\}/);      if(mFo)following=parseInt(mFo[1])||0;
      const mP=html.match(/"edge_owner_to_timeline_media":\{"count":(\d+)\}/); if(mP)posts=parseInt(mP[1])||0;
    }
    const titleM=html.match(/<title>([^<]+)<\/title>/);
    if(titleM){const tn=titleM[1].match(/^([^(@]+)/); if(tn)name=tn[1].trim()||username;}
  }
  return {name,handle:username,followers,following,posts};
}

async function fetchData(platform,username,prev=null){
  try{
    let data=null;
    if(platform==='youtube')data=await fetchYouTube(username);
    else if(platform==='tiktok')data=await fetchTikTok(username);
    else if(platform==='instagram')data=await fetchInstagram(username);
    if(data){
      if(prev){const pk=PLAT[platform].primary; data._delta=data[pk]-(prev[pk]||0);}
      return{ok:true,data};
    }
  }catch(e){console.warn('[VLS]',e.message);}
  return{ok:false};
}

/* ══════════════════════════════════════════════
   ADD / RENDER / UPDATE
══════════════════════════════════════════════ */
async function add(){
  const raw=document.getElementById('ui').value.trim();
  if(!raw){toast('⚠ Nhập URL hoặc username','err');return;}
  const cfg=PLAT[cur]; const username=cfg.parse(raw);
  if(!username){toast('⚠ URL không hợp lệ','err');return;}
  const id=`${cur}__${username.toLowerCase()}`;
  if(trackers[id]){toast('⚡ Đang theo dõi rồi','err');return;}
  const btn=document.getElementById('sbtn');
  btn.innerHTML='<span class="spn"></span>SCANNING...'; btn.disabled=true;
  toast(`📡 Đang quét @${username}...`);
  const result=await fetchData(cur,username);
  btn.innerHTML='⬡ SCAN'; btn.disabled=false;
  if(!result.ok){toast('⚠ Không lấy được dữ liệu. Thử lại.','err');return;}
  trackers[id]={id,platform:cur,username,data:result.data,history:[{t:Date.now(),v:result.data[PLAT[cur].primary]||0}],intervalId:null,updateCount:0};
  document.getElementById('ui').value='';
  document.getElementById('empty').style.display='none';
  render(id); startAuto(id); updateSummary();
  toast(`✓ CONNECTED · @${username}`,'ok');
}

function render(id){
  const t=trackers[id]; const cfg=PLAT[t.platform]; const d=t.data; const cls=cfg.cls;
  document.getElementById('c_'+id)?.remove();
  const pv=d[cfg.primary]||0;
  const sec=cfg.keys.filter(k=>k!==cfg.primary);
  const secH=sec.map(k=>`<div class="sb"><div class="sl">${cfg.labels[k]}</div><div class="sv" id="sv_${id}_${k}" style="font-size:17px;color:#b0d8ff">${fmt(d[k]||0)}</div></div>`).join('');
  const delta=d._delta??0;
  const dH=delta>0?`<div class="sdelta du">▲ +${fmt(delta)} so lần trước</div>`:delta<0?`<div class="sdelta dd">▼ ${fmt(Math.abs(delta))} so lần trước</div>`:`<div class="sdelta dn">— Đang theo dõi...</div>`;
  // Check milestone
  const milestoneHit=MILESTONES.find(m=>pv>=m&&pv<m*1.005&&m>100);
  const msHTML=milestoneHit?`<div class="milestone show" id="ms_${id}">🏆 MILESTONE: ${fmt(milestoneHit)}</div>`:'<div class="milestone" id="ms_${id}"></div>';

  const card=document.createElement('div');
  card.className='card'; card.id='c_'+id;

  // Secondary stats HTML (horizontal)
  const secHoriz = sec.map(k=>`
    <div class="sb">
      <div class="sb-row">
        <span class="sl2">${cfg.labels[k]}</span>
        <span class="sv ${cls}" id="sv_${id}_${k}">${fmt(d[k]||0)}</span>
      </div>
    </div>`).join('');

  card.innerHTML=`
    <div class="cstripe ${cls}"></div>
    <div class="cbody">

      <!-- ROW 1: Profile | Big Number | Secondary stats -->
      <div class="card-row1">

        <!-- Profile -->
        <div class="prow">
          <div class="av">${cfg.ico}</div>
          <div class="profile-meta">
            <div class="pname">${d.name||d.handle||'Unknown'}</div>
            <div class="phandle">@${d.handle||t.username}</div>
            <div class="pbadge ${cls}">${cfg.ico} ${cfg.name}</div>
          </div>
        </div>

        <!-- Primary BIG number -->
        <div class="pri-block">
          <span class="sl">${cfg.labels[cfg.primary]}</span>
          <div class="sv-main ${cls}" id="sv_${id}_${cfg.primary}">${fmt(pv)}</div>
          <div class="sdelta" id="delta_${id}">${dH.replace(/<[^>]+>/g,'').trim()||'— Đang theo dõi...'}</div>
          ${msHTML}
        </div>

        <!-- Secondary stats -->
        <div class="sec-stats">${secHoriz}</div>
      </div>

      <!-- ROW 2: Live | Sparkline | Progress -->
      <div class="card-row2">
        <div class="lr">
          <div class="ldot"></div>
          <div class="ltxt">LIVE</div>
          <div class="utxt" id="ut_${id}">Just fetched</div>
        </div>
        <div class="spark-wrap">
          <div class="spark-label"><span>GROWTH TREND</span><span id="spark-rate_${id}">—</span></div>
          <canvas class="spark-canvas" id="spark_${id}" height="36"></canvas>
        </div>
        <div class="ps-inline">
          <div class="pl"><span>vs 100M</span><span>${fmt(pv)}</span></div>
          <div class="pb"><div class="pf ${cls}" id="pf_${id}" style="width:0%"></div></div>
        </div>
      </div>

      <!-- ROW 3: Actions -->
      <div class="ca">
        <button class="ab" onclick="doRefresh('${id}')">⟳ REFRESH</button>
        <button class="ab fs" onclick="openFS('${id}')">⛶ FULLSCREEN</button>
        <button class="ab" onclick="openExport('${id}')">💾 EXPORT</button>
        <button class="ab rm" onclick="doRemove('${id}')">✕ REMOVE</button>
      </div>
    </div>`;
  document.getElementById('grid').appendChild(card);
  setTimeout(()=>{const p=document.getElementById('pf_'+id);if(p)p.style.width=Math.min((pv/1e8)*100,100)+'%';},400);
  setTimeout(()=>drawSparkline(id),500);
}

function updateDOM(id){
  const t=trackers[id]; if(!t)return;
  const cfg=PLAT[t.platform]; const d=t.data;
  const pv=d[cfg.primary]||0;

  // Update primary big number
  const primEl=document.getElementById(`sv_${id}_${cfg.primary}`);
  if(primEl){
    const nv=fmt(pv);
    if(primEl.textContent!==nv){
      primEl.textContent=nv;
      primEl.classList.remove('fl');void primEl.offsetWidth;primEl.classList.add('fl');
    }
  }

  // Update secondary stats
  const sec=cfg.keys.filter(k=>k!==cfg.primary);
  sec.forEach(k=>{
    const el=document.getElementById(`sv_${id}_${k}`); if(!el)return;
    const nv=fmt(d[k]||0);
    if(el.textContent!==nv){el.textContent=nv;el.classList.remove('fl');void el.offsetWidth;el.classList.add('fl');}
  });

  // Update delta in pri-block
  const deltaEl=document.getElementById('delta_'+id);
  if(deltaEl){
    const delta=d._delta??0;
    deltaEl.className=`sdelta ${delta>0?'du':delta<0?'dd':'dn'}`;
    deltaEl.textContent=delta>0?`▲ +${fmt(delta)} so lần trước`:delta<0?`▼ ${fmt(Math.abs(delta))} so lần trước`:'— Đang theo dõi...';
  }

  // Timestamp
  const ut=document.getElementById('ut_'+id); if(ut)ut.textContent=new Date().toLocaleTimeString('vi-VN');

  // Progress bar
  const pf=document.getElementById('pf_'+id); if(pf)pf.style.width=Math.min((pv/1e8)*100,100)+'%';

  // Milestone check
  checkMilestone(id, pv);
  // Sparkline
  drawSparkline(id);
  // Fullscreen update
  if(fsId===id) updateFS();
  // Summary
  updateSummary();
  totalUpdates++;
}

/* ══════════════════════════════════════════════
   SPARKLINE CHART
══════════════════════════════════════════════ */
function drawSparkline(id){
  const t=trackers[id]; if(!t||!t.history||t.history.length<2)return;
  const canvas=document.getElementById('spark_'+id); if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.offsetWidth||280; const H=40;
  canvas.width=W; canvas.height=H;
  ctx.clearRect(0,0,W,H);
  const vals=t.history.map(h=>h.v);
  const min=Math.min(...vals); const max=Math.max(...vals);
  const range=max-min||1;
  const cls=PLAT[t.platform].cls;
  const color=COLORS[cls]||COLORS.default;
  // Grid line
  ctx.strokeStyle='rgba(0,245,255,.06)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
  // Fill gradient
  const grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,color.replace('#','rgba(').replace(/(.{2})(.{2})(.{2})/,(_,r,g,b)=>`rgba(${parseInt(r,16)},${parseInt(g,16)},${parseInt(b,16)},.25)`)||'rgba(0,245,255,.15)');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grad;
  ctx.beginPath();
  vals.forEach((v,i)=>{
    const x=i/(vals.length-1)*W;
    const y=H-(v-min)/range*(H-4)-2;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();
  // Line
  ctx.strokeStyle=color; ctx.lineWidth=1.5;
  ctx.shadowColor=color; ctx.shadowBlur=4;
  ctx.beginPath();
  vals.forEach((v,i)=>{
    const x=i/(vals.length-1)*W;
    const y=H-(v-min)/range*(H-4)-2;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke(); ctx.shadowBlur=0;
  // Last point dot
  const lx=W; const ly=H-(vals[vals.length-1]-min)/range*(H-4)-2;
  ctx.fillStyle=color; ctx.beginPath(); ctx.arc(lx-2,ly,3,0,Math.PI*2); ctx.fill();
  // Growth rate
  const rateEl=document.getElementById(`spark-rate_${id}`);
  if(rateEl&&vals.length>=2){
    const diff=vals[vals.length-1]-vals[0];
    const pct=vals[0]>0?((diff/vals[0])*100).toFixed(2):0;
    rateEl.textContent=diff>=0?`▲ +${fmt(diff)} (${pct}%)`:`▼ ${fmt(Math.abs(diff))} (${pct}%)`;
    rateEl.style.color=diff>=0?'#39ff14':'#ff006e';
  }
}

/* ══════════════════════════════════════════════
   MILESTONE DETECTION
══════════════════════════════════════════════ */
function checkMilestone(id, val){
  const t=trackers[id]; if(!t)return;
  const prevVal=t.history.length>=2?t.history[t.history.length-2].v:0;
  const hit=MILESTONES.find(m=>val>=m&&prevVal<m);
  if(hit){
    const ms=document.getElementById('ms_'+id);
    if(ms){ms.textContent=`🏆 MILESTONE HIT: ${fmt(hit)}!`;ms.classList.add('show');}
    toast(`🏆 @${t.username} đạt ${fmt(hit)} followers!`,'warn',5000);
  }
}

/* ══════════════════════════════════════════════
   SUMMARY BAR
══════════════════════════════════════════════ */
function updateSummary(){
  const ids=Object.keys(trackers);
  if(!ids.length){document.getElementById('summaryBar').style.display='none';return;}
  document.getElementById('summaryBar').style.display='flex';
  document.getElementById('sumCount').textContent=ids.length;
  let gained=0;
  ids.forEach(id=>{
    const t=trackers[id]; if(!t||!t.history||t.history.length<2)return;
    const diff=t.history[t.history.length-1].v-t.history[0].v;
    if(diff>0)gained+=diff;
  });
  document.getElementById('sumGained').textContent=fmt(gained)||'0';
  document.getElementById('sumUpdates').textContent=totalUpdates;
  const elapsed=Math.floor((Date.now()-sessionStart)/1000);
  const m=String(Math.floor(elapsed/60)).padStart(2,'0');
  const s=String(elapsed%60).padStart(2,'0');
  document.getElementById('sumTime').textContent=`${m}:${s}`;
}

/* ══════════════════════════════════════════════
   AUTO REFRESH
══════════════════════════════════════════════ */
async function doRefresh(id,silent=false){
  const t=trackers[id]; if(!t)return;
  if(!silent)toast(`⟳ Refreshing @${t.username}...`);
  const r=await fetchData(t.platform,t.username,t.data);
  if(!r.ok){if(!silent)toast('⚠ Refresh thất bại','err');return;}
  t.data=r.data; t.updateCount++;
  // Push to history (keep last 50 points)
  const pv=t.data[PLAT[t.platform].primary]||0;
  t.history.push({t:Date.now(),v:pv});
  if(t.history.length>50)t.history.shift();
  updateDOM(id);
  if(!silent)toast(`✓ Updated @${t.username}`,'ok');
}

function startAuto(id){
  if(trackers[id]?.intervalId)clearInterval(trackers[id].intervalId);
  const iv=setInterval(()=>doRefresh(id,true),20000);
  if(trackers[id])trackers[id].intervalId=iv;
}

function doRemove(id){
  const t=trackers[id]; if(!t)return;
  clearInterval(t.intervalId); delete trackers[id];
  const el=document.getElementById('c_'+id);
  if(el){el.style.opacity='0';el.style.transform='scale(.93)';el.style.transition='all .3s';setTimeout(()=>el.remove(),300);}
  if(!Object.keys(trackers).length)document.getElementById('empty').style.display='flex';
  if(fsId===id)closeFS();
  updateSummary(); toast('✕ Removed','err');
}

/* ══════════════════════════════════════════════
   FULLSCREEN COUNTER
══════════════════════════════════════════════ */
function openFS(id){
  fsId=id;
  const overlay=document.getElementById('fsOverlay');
  overlay.classList.add('show');
  updateFS();
}
function updateFS(){
  if(!fsId||!trackers[fsId])return;
  const t=trackers[fsId]; const cfg=PLAT[t.platform]; const d=t.data;
  const pv=d[cfg.primary]||0;
  const delta=d._delta??0;
  document.getElementById('fsName').textContent=`@${t.username} · ${cfg.name}`;
  document.getElementById('fsCount').textContent=fmtFull(pv);
  document.getElementById('fsLabel').textContent=cfg.labels[cfg.primary];
  const deltaEl=document.getElementById('fsDelta');
  deltaEl.className='fs-delta '+(delta>0?'up':delta<0?'dn':'');
  deltaEl.textContent=delta>0?`▲ +${fmtFull(delta)} lần cập nhật gần nhất`:delta<0?`▼ ${fmtFull(Math.abs(delta))}`:'';
}
function closeFS(){ document.getElementById('fsOverlay').classList.remove('show'); fsId=null; }
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeFS();});

/* ══════════════════════════════════════════════
   COMPARE VIEW
══════════════════════════════════════════════ */
function refreshCompareSelects(){
  const ids=Object.keys(trackers);
  ['cmpA','cmpB'].forEach(sel=>{
    const el=document.getElementById(sel); if(!el)return;
    const cur=el.value;
    el.innerHTML='<option value="">-- Chọn kênh --</option>';
    ids.forEach(id=>{
      const t=trackers[id];
      el.innerHTML+=`<option value="${id}">${t.data.name||t.username} (${PLAT[t.platform].name})</option>`;
    });
    el.value=cur;
  });
  renderCompare();
}
function renderCompare(){
  const aId=document.getElementById('cmpA')?.value;
  const bId=document.getElementById('cmpB')?.value;
  const container=document.getElementById('cmpBars');
  if(!aId||!bId||aId===bId){container.innerHTML='<div class="no-data-cmp">Chọn 2 kênh khác nhau để so sánh</div>';return;}
  const ta=trackers[aId]; const tb=trackers[bId];
  if(!ta||!tb){container.innerHTML='<div class="no-data-cmp">Kênh không tồn tại</div>';return;}
  const metrics=['followers'];
  // Add shared metrics
  const cfgA=PLAT[ta.platform]; const cfgB=PLAT[tb.platform];
  const shared=cfgA.keys.filter(k=>cfgB.keys.includes(k));
  const toShow=shared.length?shared:['followers'];
  let html='';
  toShow.forEach(metric=>{
    const va=ta.data[metric]||0; const vb=tb.data[metric]||0;
    const total=va+vb||1;
    const pctA=Math.round(va/total*100); const pctB=100-pctA;
    const label=(cfgA.labels[metric]||metric).toUpperCase();
    html+=`
      <div style="margin-bottom:6px;"><div class="cmp-stat-label">${label}</div></div>
      <div class="cmp-bar-row">
        <div class="cmp-val left">${fmt(va)}</div>
        <div class="cmp-bar-wrap">
          <div class="cmp-bar-a" style="width:${pctA}%"></div>
          <div class="cmp-bar-b" style="width:${pctB}%"></div>
        </div>
        <div class="cmp-val right">${fmt(vb)}</div>
      </div>`;
  });
  // Winner banner
  const fA=ta.data[cfgA.primary]||0; const fB=tb.data[cfgB.primary]||0;
  const winner=fA>fB?ta:fB>fA?tb:null;
  if(winner){
    const wColor=winner===ta?'#00f5ff':'#ff006e';
    html=`<div style="text-align:center;font-family:'Share Tech Mono',monospace;font-size:11px;color:${wColor};letter-spacing:3px;padding:8px;border:1px solid ${wColor}40;margin-bottom:12px;">🏆 ĐANG DẪN: @${winner.username} (+${fmt(Math.abs(fA-fB))})</div>`+html;
  }
  container.innerHTML=html;
}

/* ══════════════════════════════════════════════
   HISTORY CHART VIEW
══════════════════════════════════════════════ */
function refreshChartSelects(){
  const ids=Object.keys(trackers);
  const sel=document.getElementById('chartTracker'); if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">-- Chọn kênh --</option>';
  ids.forEach(id=>{
    const t=trackers[id];
    sel.innerHTML+=`<option value="${id}">${t.data.name||t.username}</option>`;
  });
  sel.value=cur||ids[0]||'';
  renderChart();
}
function renderChart(){
  const id=document.getElementById('chartTracker')?.value;
  const metric=document.getElementById('chartMetric')?.value||'followers';
  const canvas=document.getElementById('mainChart'); if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.offsetWidth||800; const H=280;
  canvas.width=W; canvas.height=H;
  ctx.clearRect(0,0,W,H);

  if(!id||!trackers[id]||trackers[id].history.length<2){
    ctx.fillStyle='rgba(0,245,255,.15)'; ctx.font='12px "Share Tech Mono"'; ctx.textAlign='center';
    ctx.fillText('Cần ít nhất 2 điểm dữ liệu. Thêm kênh và đợi auto-refresh.',W/2,H/2);
    return;
  }
  const t=trackers[id];
  const cls=PLAT[t.platform].cls;
  const color=COLORS[cls]||COLORS.default;
  // Map metric
  const metricMap={followers:PLAT[t.platform].primary, likes:t.platform==='youtube'?'views':t.platform==='instagram'?'following':'likes', videos:'videos'};
  const key=metricMap[metric]||PLAT[t.platform].primary;
  const pts=t.history.map(h=>({x:h.t,y:h.v})); // use stored values
  // Actually re-read from history with correct key
  // Note: history only stores primary stat value; for other metrics, approximate
  const vals=pts.map(p=>p.y);
  const times=pts.map(p=>p.x);
  const pad={l:50,r:20,t:20,b:40};
  const cW=W-pad.l-pad.r; const cH=H-pad.t-pad.b;
  const minV=Math.min(...vals); const maxV=Math.max(...vals);
  const range=maxV-minV||1;
  // Grid
  ctx.strokeStyle='rgba(0,245,255,.06)'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.t+cH*(1-i/4);
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
    const label=fmt(minV+range*(i/4));
    ctx.fillStyle='rgba(0,245,255,.3)'; ctx.font='9px "Share Tech Mono"'; ctx.textAlign='right';
    ctx.fillText(label,pad.l-4,y+3);
  }
  // Fill
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+cH);
  grad.addColorStop(0,color+'44'); grad.addColorStop(1,'transparent');
  ctx.fillStyle=grad;
  ctx.beginPath();
  vals.forEach((v,i)=>{
    const x=pad.l+i/(vals.length-1)*cW;
    const y=pad.t+cH*(1-(v-minV)/range);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.lineTo(pad.l+cW,pad.t+cH); ctx.lineTo(pad.l,pad.t+cH); ctx.closePath(); ctx.fill();
  // Line
  ctx.strokeStyle=color; ctx.lineWidth=2;
  ctx.shadowColor=color; ctx.shadowBlur=6;
  ctx.beginPath();
  vals.forEach((v,i)=>{
    const x=pad.l+i/(vals.length-1)*cW;
    const y=pad.t+cH*(1-(v-minV)/range);
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke(); ctx.shadowBlur=0;
  // Dots
  vals.forEach((v,i)=>{
    const x=pad.l+i/(vals.length-1)*cW;
    const y=pad.t+cH*(1-(v-minV)/range);
    ctx.fillStyle=color; ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
  });
  // Time labels
  ctx.fillStyle='rgba(0,245,255,.25)'; ctx.font='9px "Share Tech Mono"'; ctx.textAlign='center';
  const step=Math.max(1,Math.floor(vals.length/5));
  times.forEach((ts,i)=>{
    if(i%step!==0&&i!==vals.length-1)return;
    const x=pad.l+i/(vals.length-1)*cW;
    const label=new Date(ts).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
    ctx.fillText(label,x,H-8);
  });
  // Legend
  document.getElementById('chartLegend').innerHTML=`<div class="leg-item"><div class="leg-dot" style="background:${color}"></div>${t.data.name||t.username} — ${PLAT[t.platform].labels[PLAT[t.platform].primary]}</div>`;
}

/* ══════════════════════════════════════════════
   EXPORT
══════════════════════════════════════════════ */
function buildExportData(id){
  const ids=id?[id]:Object.keys(trackers);
  return ids.map(i=>{
    const t=trackers[i]; if(!t)return null;
    const cfg=PLAT[t.platform];
    return{
      id:i, platform:t.platform, username:t.username, name:t.data.name,
      ...Object.fromEntries(cfg.keys.map(k=>[k,t.data[k]||0])),
      history:t.history, updateCount:t.updateCount,
      exportedAt:new Date().toISOString()
    };
  }).filter(Boolean);
}

function openExport(id){
  const data=buildExportData(id);
  document.getElementById('exportPreview').textContent=JSON.stringify(data,null,2).substring(0,1500)+'...';
  document.getElementById('exportModal').classList.add('show');
  document.getElementById('exportModal')._id=id;
}
function closeExport(){ document.getElementById('exportModal').classList.remove('show'); }

function exportJSON(){
  const id=document.getElementById('exportModal')._id;
  const data=buildExportData(id);
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`VietLongSocial_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); toast('✓ Đã export JSON','ok');
}

function exportCSV(){
  const id=document.getElementById('exportModal')._id;
  const data=buildExportData(id);
  const headers=['platform','username','name','followers','likes_views','videos_posts','updateCount','exportedAt'];
  const rows=data.map(d=>[d.platform,d.username,`"${d.name||''}"`,d.followers||0,d.likes||d.views||d.following||0,d.videos||d.posts||0,d.updateCount,d.exportedAt]);
  const csv=[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`VietLongSocial_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); toast('✓ Đã export CSV','ok');
}

function copyData(){
  const id=document.getElementById('exportModal')._id;
  const data=buildExportData(id);
  navigator.clipboard.writeText(JSON.stringify(data,null,2)).then(()=>toast('✓ Đã copy JSON','ok')).catch(()=>toast('⚠ Copy thất bại','err'));
}

/* ══════════════════════════════════════════════
   CLOCK & SESSION TIMER
══════════════════════════════════════════════ */
setInterval(()=>{
  document.getElementById('clk').textContent=new Date().toLocaleTimeString('vi-VN',{hour12:false});
  updateSummary();
},1000);
document.getElementById('clk').textContent=new Date().toLocaleTimeString('vi-VN',{hour12:false});
document.getElementById('ui').placeholder=PLAT['youtube'].ph;
