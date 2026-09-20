
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  SHARED — Dùng chung cho tất cả module                              ║
// ║  Bao gồm: tickClock, formatters, cgFetch, state vars                ║
// ║  ⚠️  Thay đổi ở đây ảnh hưởng đến CẢ 3 module                       ║
// ╚══════════════════════════════════════════════════════════════════════╝


// ── CORS Proxy wrapper cho CoinGecko (cần khi host trên GitHub Pages) ──
// CoinGecko removed — CORS not supported from GitHub Pages
// cgFetch đã bị vô hiệu — CoinGecko không hỗ trợ CORS từ GitHub Pages
// Tất cả data đã được thay bằng Binance API (CORS native)
async function cgFetch(){ return null; }

/* ═══════════════════════════════════════════════════
   ĐỒNG HỒ UTC+7
═══════════════════════════════════════════════════ */
function tickClock(){
  const u7=new Date(Date.now()+(7*3600000));
  const hh=String(u7.getUTCHours()).padStart(2,'0');
  const mm=String(u7.getUTCMinutes()).padStart(2,'0');
  const ss=String(u7.getUTCSeconds()).padStart(2,'0');
  const el=document.getElementById('clock');
  if(el) el.textContent=`${hh}:${mm}:${ss}`;
}
setInterval(tickClock,5000); tickClock(); // giảm từ 1s→5s

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
const fmtP=p=>{
  if(!p||isNaN(p)) return '—';
  if(p>=1000)  return '$'+p.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(p>=1)     return '$'+p.toFixed(4);
  if(p>=0.1)   return '$'+p.toFixed(5);
  if(p>=0.01)  return '$'+p.toFixed(6);
  if(p>=0.001) return '$'+p.toFixed(7);
  if(p>=0.0001)return '$'+p.toFixed(8);
  // Coin giá rất thấp (PEPE, SHIB, BONK...) — hiển thị đủ chữ số có nghĩa
  const s=p.toFixed(12).replace(/0+$/,''); // bỏ trailing zeros
  const match=s.match(/^0\.(0*)/);
  const zeros=match?match[1].length:0;
  const decimals=Math.min(zeros+4, 12); // giữ 4 chữ số sau số 0 đầu tiên có nghĩa
  return '$'+p.toFixed(decimals);
};
const fmtB=n=>{
  if(!n||isNaN(n)) return '—';
  if(n>=1e9) return '$'+(n/1e9).toFixed(2)+'B';
  if(n>=1e6) return '$'+(n/1e6).toFixed(1)+'M';
  if(n>=1e3) return '$'+(n/1e3).toFixed(1)+'K';
  return '$'+n.toFixed(0);
};
const sign=n=>n>=0?'+':'';
const timeAgo=ms=>{
  const s=Math.floor((Date.now()-ms)/1000);
  if(s<60) return s+'s trước';
  if(s<3600) return Math.floor(s/60)+'m trước';
  if(s<86400) return Math.floor(s/3600)+'h trước';
  return Math.floor(s/86400)+'d trước';
};

/* ═══════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════ */
// CoinGecko ID map (symbol → CG coin id)
const cgIdMap={
  BTC:'bitcoin',ETH:'ethereum',BNB:'binancecoin',SOL:'solana',XRP:'ripple',
  USDC:'usd-coin',ADA:'cardano',AVAX:'avalanche-2',DOGE:'dogecoin',DOT:'polkadot',
  LINK:'chainlink',TRX:'tron',MATIC:'matic-network',POL:'matic-network',
  LTC:'litecoin',BCH:'bitcoin-cash',UNI:'uniswap',ATOM:'cosmos',
  XLM:'stellar',ICP:'internet-computer',FIL:'filecoin',APT:'aptos',
  ARB:'arbitrum',OP:'optimism',SUI:'sui',SEI:'sei-network',
  INJ:'injective-protocol',NEAR:'near',HBAR:'hedera-hashgraph',
  VET:'vechain',ALGO:'algorand',MANA:'decentraland',SAND:'the-sandbox',
  AXS:'axie-infinity',FTM:'fantom',ONE:'harmony',EGLD:'elrond-erd-2',
  THETA:'theta-token',EOS:'eos',ZEC:'zcash',XMR:'monero',
  AAVE:'aave',MKR:'maker',SNX:'havven',COMP:'compound-governance-token',
  CRV:'curve-dao-token',SUSHI:'sushi',YFI:'yearn-finance',
  GRT:'the-graph',BAT:'basic-attention-token',ZRX:'0x',
  ENJ:'enjincoin',CHZ:'chiliz',HOT:'holotoken',IOTA:'iota',
  ETC:'ethereum-classic',DASH:'dash',ZIL:'zilliqa',ICX:'icon',
  ONT:'ontology',QTUM:'qtum',DGB:'digibyte',SC:'siacoin',
  CAKE:'pancakeswap-token',TWT:'trust-wallet-token',
  PEPE:'pepe',SHIB:'shiba-inu',FLOKI:'floki',WIF:'dogwifcoin',
  BONK:'bonk',RENDER:'render-token',FET:'fetch-ai',
  AGIX:'singularitynet',OCEAN:'ocean-protocol',
  TON:'the-open-network',NOT:'notcoin',
  WLD:'worldcoin-wld',TIA:'celestia',DYM:'dymension',
  STRK:'starknet',MANTA:'manta-network',ALT:'altlayer',
  JUP:'jupiter-ag',PYTH:'pyth-network',JTO:'jito-governance-token',
  ONDO:'ondo-finance',W:'wormhole',ENA:'ethena',
  EIGEN:'eigenlayer',LISTA:'lista-dao',DOGS:'dogs-token',
  HMSTR:'hamster-kombat',MAJOR:'major',CATI:'catizen',
  BOME:'book-of-meme',POPCAT:'popcat',MEW:'cat-in-a-dogs-world',
};
let SYMBOLS=[];
const coins={}, hist={}, logoMap={}, nameMap={}, colorMap={};
function fmtPShort(p){
  if(!p||isNaN(p)) return '—';
  if(p>=1000) return '$'+p.toLocaleString('vi-VN',{maximumFractionDigits:0});
  if(p>=1) return '$'+p.toFixed(3);
  if(p>=0.01) return '$'+p.toFixed(4);
  if(p>=0.0001) return '$'+p.toFixed(6);
  if(p<0.0000001) return '$'+p.toExponential(2);
  return '$'+p.toFixed(8);
}

/* ── UTC+7 helpers ─────────────────────────────────────────────────
   chg(sym)  → % thay đổi theo ngày VN (fallback về rolling 24h)
   kvol(sym) → khối lượng theo ngày VN  (fallback về rolling 24h)
──────────────────────────────────────────────────────────────────── */
function chg(sym){
  const c=coins[sym]; if(!c) return 0;
  // Nếu đã có openVN từ klines VN → tính realtime từ giá hiện tại
  if(c.openVN&&c.openVN>0) return (c.price-c.openVN)/c.openVN*100;
  return c.change24h||0;
}
function kvol(sym){
  const c=coins[sym]; if(!c) return 0;
  if(c.volVN!=null&&c.volVN>0) return c.volVN;
  return c.vol||0;
}
const volHistory={};   // sym → rolling 24 snapshots
const volBaseline={};  // sym → vol tại thời điểm load (baseline whale)
const rsiCache={};     // sym → {rsi, macd, bb, signal, price, ts}

let currentTab='all', currentPage=1;
const PAGE_SIZE=100;
let sortCol='vol', sortDir=1; // default: vol tăng dần

const COLORS=['#e2761b','#6c86eb','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899'];
const STABLES=new Set(['USDT','BUSD','USDC','DAI','TUSD','USDP','FDUSD','PYUSD','USDE','USDX','USDD','GUSD','FRAX','LUSD']);

/* ═══════════════════════════════════════════════════
   LOAD ALL COINS FROM BINANCE 24HR TICKER


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  MODULE 1 — TIỀN ẢO THẾ GIỚI 🪙                                     ║
// ║  Nguồn dữ liệu: Binance WebSocket + REST API                        ║
// ║  ✅ Sửa file này KHÔNG ảnh hưởng VN hoặc Forex                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════ */
async function loadAllCoins(){
  // Hiển thị trạng thái loading rõ ràng
  const _el=document.getElementById('tableArea');
  if(_el) _el.innerHTML='<div class="state-box"><div class="spinner" style="border-top-color:#00d4ff"></div><div style="color:#94a3b8;font-size:13px">⏳ Đang kết nối Binance...</div></div>';
  const _ws=document.getElementById('wsStatus');
  if(_ws) _ws.textContent='⏳ Đang tải...';
  
  // Thử nhiều endpoint
  const ENDPOINTS=[
    'https://api.binance.com/api/v3/ticker/24hr',
    'https://api1.binance.com/api/v3/ticker/24hr',
    'https://api2.binance.com/api/v3/ticker/24hr',
    'https://api3.binance.com/api/v3/ticker/24hr',
  ];
  let data=null;
  for(const url of ENDPOINTS){
    try{
      const res=await fetch(url,{signal:AbortSignal.timeout(8000)});
      if(!res.ok) continue;
      data=await res.json();
      if(data?.length>0) break;
    }catch(e){ continue; }
  }
  try{
    if(!data||!data.length) throw new Error('Binance unreachable');
    const filtered=data
      .filter(t=>t.symbol.endsWith('USDT'))
      .filter(t=>{
        const b=t.symbol.replace('USDT','');
        return !STABLES.has(b)&&!/^(UP|DOWN|BULL|BEAR)\w+USDT$/.test(t.symbol)&&parseFloat(t.quoteVolume)>0;
      })
      .sort((a,b)=>parseFloat(b.quoteVolume)-parseFloat(a.quoteVolume));

    SYMBOLS=filtered.map(t=>t.symbol);
    filtered.forEach(t=>{
      const base=t.symbol.replace('USDT','');
      coins[t.symbol]={
        price:parseFloat(t.lastPrice)||0,
        prev:parseFloat(t.lastPrice)||0,
        change24h:parseFloat(t.priceChangePercent)||0,
        high:parseFloat(t.highPrice)||0,
        low:parseFloat(t.lowPrice)||0,
        vol:parseFloat(t.quoteVolume)||0
      };
      colorMap[base]=COLORS[base.charCodeAt(0)%COLORS.length];
      nameMap[base]=base;
      volHistory[t.symbol]=[parseFloat(t.quoteVolume)||0];
      volBaseline[t.symbol]=parseFloat(t.quoteVolume)||0; // baseline cho whale
    });

    sortCol='vol'; sortDir=1;
    _forceFullRender();       // build bảng ngay sau khi có data
    loadCoinGeckoLogos();
    connectWS();
    setTimeout(renderWhalePanel, 2000); // init whale panel
    // Tính lại KL & % theo ngày UTC+7 (00:00 VN → hiện tại)
    loadDailyVN();
  }catch(e){
    const el=document.getElementById('tableArea');
    if(el) el.innerHTML='<div class="state-box"><div style="font-size:24px">⚠️</div><div>Không thể tải dữ liệu từ Binance. Vui lòng thử lại.</div></div>';
  }
}

/* ═══════════════════════════════════════════════════
   KL 24H & % THEO NGÀY UTC+7 (00:00 VN → hiện tại)
   Dùng Binance klines 1d để lấy nến ngày VN hiện tại
═══════════════════════════════════════════════════ */
async function loadDailyVN(){
  // Tính startTime = 00:00:00 hôm nay theo UTC+7
  const nowMs=Date.now();
  const utc7Offset=7*3600*1000;
  const todayVNMs=Math.floor((nowMs+utc7Offset)/(86400*1000))*(86400*1000)-utc7Offset;
  // = timestamp Unix (ms) của 00:00:00 VN hôm nay (UTC)

  const luEl=document.getElementById('sLastUpdate');
  if(luEl) luEl.textContent='Đang tải KL & % theo ngày VN (UTC+7)...';

  // Batch fetch klines 1d cho top 200 coin, mỗi lần 10 coin song song
  const top=SYMBOLS.slice(0,200);
  const BATCH=20; // tăng từ 10→20 song song
  for(let i=0;i<top.length;i+=BATCH){
    const batch=top.slice(i,i+BATCH);
    await Promise.allSettled(batch.map(async sym=>{
      try{
        // Lấy nến 1d từ đầu ngày VN đến hiện tại
        const url=`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1d&startTime=${todayVNMs}&limit=1`;
        const r=await fetch(url,{signal:AbortSignal.timeout(6000)});
        if(!r.ok) return;
        const data=await r.json();
        if(!data||!data[0]) return;
        const k=data[0];
        // k[1]=open, k[2]=high, k[3]=low, k[4]=close, k[5]=baseVol, k[7]=quoteVol
        const openVN=parseFloat(k[1]);
        const closeVN=parseFloat(k[4]);
        const volVN=parseFloat(k[7]); // quote volume (USDT)
        const changeVN=openVN>0?((closeVN-openVN)/openVN*100):0;
        if(coins[sym]){
          coins[sym].changeVN=changeVN;   // % từ đầu ngày VN
          coins[sym].volVN=volVN;         // KL từ đầu ngày VN
          coins[sym].openVN=openVN;
        }
      }catch(e){}
    }));
    if(i===0) render(); // render ngay sau batch đầu tiên
    if(i>0&&i%80===0) await new Promise(r=>setTimeout(r,300)); // throttle nhẹ
  }
  _forceFullRender();
  if(luEl) luEl.textContent=`Dữ liệu thời gian thực · KL & % theo ngày VN (UTC+7)`;
}

// Refresh dữ liệu VN mỗi 10 phút
setInterval(loadDailyVN, 10*60*1000);

/* ═══════════════════════════════════════════════════
   COINGECKO LOGOS (2 trang, delay 3s, bắt 429)
═══════════════════════════════════════════════════ */
async function loadCoinGeckoLogos(){
  // Nguồn 1: CryptoCompare coinlist — đầy đủ nhất, CORS OK, không cần key
  try{
    const r = await fetch(
      'https://min-api.cryptocompare.com/data/all/coinlist?summary=true',
      {signal:AbortSignal.timeout(12000)}
    );
    if(r.ok){
      const j = await r.json();
      const data = j?.Data || {};
      Object.entries(data).forEach(([sym, info])=>{
        if(info.ImageUrl && !logoMap[sym]){
          logoMap[sym] = 'https://www.cryptocompare.com' + info.ImageUrl;
        }
        if(info.CoinName && !nameMap[sym]){
          nameMap[sym] = info.CoinName;
        }
      });
      _tickerBuilt=false; _forceFullRender(); renderChartCoinList();
      return;
    }
  }catch(e){}
  // Nguồn 2 (fallback): Binance exchangeInfo
  try{
    const res = await fetch('https://api.binance.com/api/v3/exchangeInfo',
      {signal:AbortSignal.timeout(10000)});
    if(res.ok){
      const json = await res.json();
      (json.symbols||[]).forEach(s=>{
        if(s.quoteAsset!=='USDT') return;
        const base = (s.baseAsset||'').toUpperCase();
        nameMap[base] = nameMap[base] || base;
      });
      _tickerBuilt=false; _forceFullRender(); renderChartCoinList();
    }
  }catch(e){ console.warn('Logo load error',e.message); }
}

/* ═══════════════════════════════════════════════════
   WEBSOCKET — multi-connection, auto-reconnect
═══════════════════════════════════════════════════ */
const wsConns=[];
let reconnTimer=null;

function connectWS(){
  wsConns.forEach(w=>{try{w.close();}catch(e){}});
  wsConns.length=0;
  const CHUNK=200; // max streams per connection
  let openCount=0;

  for(let i=0;i<SYMBOLS.length;i+=CHUNK){
    const chunk=SYMBOLS.slice(i,i+CHUNK);
    const streams=chunk.map(s=>s.toLowerCase()+'@ticker').join('/');
    const sock=new WebSocket('wss://stream.binance.com:9443/stream?streams='+streams);

    sock.onopen=()=>{
      openCount++;
      const total=Math.ceil(SYMBOLS.length/CHUNK);
      const wsEl=document.getElementById('wsStatus');
      if(wsEl) wsEl.textContent=`🟢 ${openCount}/${total} kết nối`;
      const luEl=document.getElementById('sLastUpdate');
      if(luEl) luEl.textContent='Dữ liệu thời gian thực từ Binance';
      clearTimeout(reconnTimer);
    };

    sock.onmessage=(evt)=>{
      try{
        const d=JSON.parse(evt.data).data;
        if(!d||!d.s||!coins[d.s]) return;
        const c=coins[d.s];
        c.prev=c.price;
        c.price=parseFloat(d.c)||0;
        c.change24h=parseFloat(d.P)||0;  // rolling 24h (Binance)
        c.high=parseFloat(d.h)||0;
        c.low=parseFloat(d.l)||0;
        c.vol=parseFloat(d.q)||0;
        // Cập nhật volVN realtime: dùng vol klines ngày VN nếu có,
        // cộng thêm phần trade kể từ lần cập nhật cuối
        if(c.openVN&&c.openVN>0){
          // changeVN được tính realtime trong hàm chg() từ c.price & c.openVN
          // Cập nhật volVN xấp xỉ: giữ nguyên giá trị từ klines (refresh 10p/lần)
        }
        tickerNeedsUpdate=true;
        // Schedule patch update qua RAF để batch nhiều WS messages trong 1 frame
        if(!_rafPending){
          _rafPending=true;
          requestAnimationFrame(()=>{
            _rafPending=false;
            if(_tableBuilt) patchRender();
            else _forceFullRender(); // lần đầu: build toàn bộ bảng
          });
        }

        // Realtime chart update cho coin đang xem
        if(d.s===selectedSym){
          updateChartHeader();
          if(lwChart&&candleSeries&&c.price){
            try{
              const now=Math.floor(Date.now()/1000);
              const tfSecs={'1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'1d':86400};
              const tf=tfSecs[currentTf]||3600;
              const candleTime=now-(now%tf);
              // Reset open khi sang nến mới
              if(candleTime!==_candleTime){
                _candleTime=candleTime;
                _candleOpen=c.price;
                _candleHigh=c.price;
                _candleLow=c.price;
              }
              const open=_candleOpen||c.price;
              _candleHigh=Math.max(_candleHigh||c.price, c.price);
              _candleLow=Math.min(_candleLow||c.price, c.price);
              if(lwChart&&candleSeries){
                candleSeries.update({
                  time:candleTime,
                  open,
                  high:_candleHigh,
                  low:_candleLow,
                  close:c.price
                });
              }
            }catch(e){}
          }
        }
        // Kiểm tra alert
        checkAlertForSym(d.s);
        // Kiểm tra cá voi
        _scheduleWhaleCheck(d.s);
        // Cập nhật portfolio
        _origCoinsProxy();
        // Cập nhật focus header
        if(focusSym===d.s) updateFocusHeader();
      }catch(e){}
    };

    sock.onerror=()=>{
      const el=document.getElementById('wsStatus');
      if(el) el.textContent='🔴 Lỗi kết nối';
    };
    sock.onclose=()=>{
      openCount=Math.max(0,openCount-1);
      clearTimeout(reconnTimer);
      reconnTimer=setTimeout(connectWS,5000);
    };
    wsConns.push(sock);
  }
}


/* ═══════════════════════════════════════════════════
   LOGO HTML
═══════════════════════════════════════════════════ */
// Trả URL logo nhất quán (LCW primary)
function getLogoSrc(base){
  const bl=(base||'').toLowerCase();
  return `https://lcw.nyc3.cdn.digitaloceanspaces.com/production/currencies/64/${bl}.webp`;
}
function getLogoOnErr(base){
  const bl=(base||'').toLowerCase();
  const s2=`https://assets.coincap.io/assets/icons/${bl}@2x.png`;
  const s3=`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${bl}.png`;
  return `if(!this._f1){this._f1=1;this.src='${s2}';return;} if(!this._f2){this._f2=1;this.src='${s3}';return;} this.style.display='none';`;
}

function logoHTML(base,size=28){
  const color=colorMap[base]||'#00d4ff';
  const fbStyle=`width:${size}px;height:${size}px;background:${color}22;border:1px solid ${color}35;color:${color};font-size:${Math.round(size*.45)}px`;
  const bl=base.toLowerCase();
  // Chain 3 CDN đáng tin (img src không bị CORS):
  // 1. LiveCoinWatch CDN (DigitalOcean) — bao phủ ~3000 coin, webp 64px
  // 2. CoinCap icons CDN — backup
  // 3. spothq GitHub — các coin cũ/phổ biến
  const src1 = `https://lcw.nyc3.cdn.digitaloceanspaces.com/production/currencies/64/${bl}.webp`;
  const src2 = `https://assets.coincap.io/assets/icons/${bl}@2x.png`;
  const src3 = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${bl}.png`;
  const onErr = `if(!this._f1){this._f1=1;this.src='${src2}';return;} if(!this._f2){this._f2=1;this.src='${src3}';return;} this.style.display='none';this.nextElementSibling.style.display='flex';`;
  return `<img class="coin-logo" src="${src1}" alt="${base}" loading="lazy" width="${size}" height="${size}" onerror="${onErr}"><div class="coin-logo-fb" style="display:none;${fbStyle}">${base[0]}</div>`;
}

/* ═══════════════════════════════════════════════════
   RENDER BẢNG THỊ TRƯỜNG
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   RENDER ENGINE — 2 tầng: fullRender + patchRender
   fullRender: build HTML đầy đủ (khi sort/filter/page đổi)
   patchRender: chỉ update text của ô giá/% đã thay đổi
═══════════════════════════════════════════════════ */

// State để biết có cần full rebuild không
let _lastSortCol=null,_lastSortDir=null,_lastTab=null,_lastPage=null,_lastQuery=null,_tableBuilt=false;

// Hàm dùng chung: tính list đã filter+sort
function _buildList(){
  const q=(document.getElementById('searchInput')?.value||'').toLowerCase().trim();
  let list=SYMBOLS.map(s=>{const base=s.replace('USDT','');return{sym:s,base,...coins[s]};}).filter(c=>c.price>0);
  if(currentTab==='gainers') list=list.filter(c=>chg(c.sym)>0);
  else if(currentTab==='losers') list=list.filter(c=>chg(c.sym)<0);
  if(q) list=list.filter(c=>(nameMap[c.base]||'').toLowerCase().includes(q)||c.base.toLowerCase().includes(q));
  list.sort((a,b)=>{
    let av,bv;
    if(sortCol==='change24h'){av=chg(a.sym); bv=chg(b.sym);}
    else if(sortCol==='vol'){av=kvol(a.sym); bv=kvol(b.sym);}
    else if(sortCol==='rsi'){av=rsiCache[a.sym]?.rsi??50; bv=rsiCache[b.sym]?.rsi??50;}
    else{av=a[sortCol]??0; bv=b[sortCol]??0;}
    return sortDir*(bv-av);
  });
  return list;
}

// Update stats cards (nhanh, chỉ text nodes)
function _updateStats(list){
  const all=SYMBOLS.map(s=>({sym:s,base:s.replace('USDT',''),_chg:chg(s),_vol:kvol(s),...coins[s]})).filter(c=>c.price>0);
  if(!all.length) return;
  const sorted=[...all].sort((a,b)=>b._chg-a._chg);
  const top=sorted[0],bot=sorted[sorted.length-1];
  const up=all.filter(c=>c._chg>0.01).length;
  const dn=all.filter(c=>c._chg<-0.01).length;
  const _s=(id,v)=>{const e=document.getElementById(id);if(e&&e.textContent!==String(v))e.textContent=v;};
  _s('sCoinCount',all.length+' Coin');
  _s('sTopGain',`+${(top._chg||0).toFixed(2)}%`);
  _s('sTopGainName',nameMap[top.base]||top.base);
  _s('sTopLoss',`${(bot._chg||0).toFixed(2)}%`);
  _s('sTopLossName',nameMap[bot.base]||bot.base);
  _s('sRatio',`${up} ▲ / ${dn} ▼ / ${all.length-up-dn} —`);
  _s('countBadge',list.length+' coin');
  // Stats color
  const tgEl=document.getElementById('sTopGain');
  if(tgEl) tgEl.style.color='var(--green)';
  const tlEl=document.getElementById('sTopLoss');
  if(tlEl) tlEl.style.color='var(--red)';
}

function render(){
  if(!SYMBOLS.length) return;
  if(!renderDirty) return;
  renderDirty=false;

  const q=(document.getElementById('searchInput')?.value||'').toLowerCase().trim();
  const needFull=!_tableBuilt||
    sortCol!==_lastSortCol||sortDir!==_lastSortDir||
    currentTab!==_lastTab||currentPage!==_lastPage||q!==_lastQuery;

  if(needFull) fullRender(q);
  else patchRender();
}

function fullRender(q){
  if(q===undefined) q=(document.getElementById('searchInput')?.value||'').toLowerCase().trim();
  const list=_buildList();
  _updateStats(list);
  updateTicker();

  const totalPages=Math.ceil(list.length/PAGE_SIZE)||1;
  if(currentPage>totalPages) currentPage=1;
  const start=(currentPage-1)*PAGE_SIZE;
  const pageList=list.slice(start,start+PAGE_SIZE);

  if(!pageList.length){
    document.getElementById('tableArea').innerHTML='<div class="state-box"><div>Không tìm thấy kết quả</div></div>';
    _tableBuilt=false;
    return;
  }

  const thSort=(col,label)=>{
    const active=sortCol===col?'sort-active':'';
    const arrow=sortCol===col?(sortDir>0?'▲':'▼'):'↕';
    return `<th class="r ${active}" onclick="sortBy('${col}')">${label} <span class="sort-arrow">${arrow}</span></th>`;
  };

  const rows=pageList.map((c,i)=>{
    const _c=chg(c.sym), _v=kvol(c.sym);
    const cls=_c>0.01?'up':_c<-0.01?'down':'neu';
    const rc=rsiCache[c.sym];
    const rsiBadge=rc?`<span class="rsi-badge ${rc.rsi>70?'rsi-ob':rc.rsi<30?'rsi-os':'rsi-n'}">${rc.rsi.toFixed(0)}</span>`:'<span class="rsi-badge rsi-n">—</span>';
    const sigBadge=rc?`<span class="sig ${rc.signal}">${rc.signal==='buy'?'MUA':rc.signal==='sell'?'BÁN':'GIỮ'}</span>`:'<span class="sig hold">—</span>';
    return `<tr data-sym="${c.sym}" onclick="openChart('${c.sym}')">
      <td><span class="rank">${start+i+1}</span></td>
      <td><div class="coin-cell">${logoHTML(c.base)}<div><div class="cn">${nameMap[c.base]||c.base}</div><div class="cs">${c.base}</div></div></div></td>
      <td class="r"><span class="pv" data-price="${c.sym}">${fmtP(c.price)}</span></td>
      <td class="r"><span class="badge ${cls}" data-chg="${c.sym}">${sign(_c)}${_c.toFixed(2)}%</span></td>
      <td class="r hide-sm"><span class="num" data-vol="${c.sym}">${fmtB(_v)}</span></td>
      <td class="r hide-sm" data-rsi-cell="${c.sym}">${rsiBadge}</td>
      <td class="r hide-sm" data-sig-cell="${c.sym}">${sigBadge}</td>
    </tr>`;
  }).join('');

  let pgHtml='';
  if(totalPages>1){
    const maxB=7,sp=Math.max(1,currentPage-3),ep=Math.min(totalPages,sp+maxB-1);
    pgHtml='<div class="pagination">';
    pgHtml+=`<button class="pg-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
    if(sp>1) pgHtml+=`<button class="pg-btn" onclick="goPage(1)">1</button>${sp>2?'<span class="pg-info">…</span>':''}`;
    for(let p=sp;p<=ep;p++) pgHtml+=`<button class="pg-btn${p===currentPage?' active':''}" onclick="goPage(${p})">${p}</button>`;
    if(ep<totalPages) pgHtml+=`${ep<totalPages-1?'<span class="pg-info">…</span>':''}<button class="pg-btn" onclick="goPage(${totalPages})">${totalPages}</button>`;
    pgHtml+=`<button class="pg-btn" onclick="goPage(${currentPage+1})" ${currentPage===totalPages?'disabled':''}>›</button>`;
    pgHtml+=`<span class="pg-info">${list.length} coin · ${currentPage}/${totalPages}</span></div>`;
  }

  document.getElementById('tableArea').innerHTML=`
    <table>
      <thead><tr>
        <th style="width:30px">#</th>
        <th>Coin</th>
        <th class="r ${sortCol==='price'?'sort-active':''}" onclick="sortBy('price')">Giá <span class="sort-arrow">${sortCol==='price'?(sortDir>0?'▲':'▼'):'↕'}</span></th>
        <th class="r ${sortCol==='change24h'?'sort-active':''}" onclick="sortBy('change24h')">24h% <span class="sort-arrow">${sortCol==='change24h'?(sortDir>0?'▲':'▼'):'↕'}</span></th>
        ${thSort('vol','KL 24h')}
        <th class="r hide-sm">RSI</th>
        <th class="r hide-sm">Tín Hiệu</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>${pgHtml}`;

  _tableBuilt=true;
  _lastSortCol=sortCol; _lastSortDir=sortDir;
  _lastTab=currentTab; _lastPage=currentPage; _lastQuery=q;
}

// patchRender: update CHỈ những ô đã thay đổi — không rebuild DOM
function patchRender(){
  const area=document.getElementById('tableArea');
  if(!area) return;

  // Update stats (nhanh)
  const list=_buildList();
  _updateStats(list);
  updateTicker();

  // Patch từng ô giá/% trên trang hiện tại
  const start=(currentPage-1)*PAGE_SIZE;
  const pageList=list.slice(start,start+PAGE_SIZE);

  pageList.forEach(c=>{
    const _c=chg(c.sym);
    const _v=kvol(c.sym);

    // Giá — update nếu khác
    const priceEl=area.querySelector(`[data-price="${c.sym}"]`);
    if(priceEl){
      const newPrice=fmtP(c.price);
      if(priceEl.textContent!==newPrice){
        priceEl.textContent=newPrice;
        // Flash effect
        const flash=c.price>(coins[c.sym]?.prev||0)?'flash-g':'flash-r';
        priceEl.className='pv '+flash;
        setTimeout(()=>{if(priceEl) priceEl.className='pv';},600);
      }
    }

    // % thay đổi
    const chgEl=area.querySelector(`[data-chg="${c.sym}"]`);
    if(chgEl){
      const newChg=`${sign(_c)}${_c.toFixed(2)}%`;
      if(chgEl.textContent!==newChg){
        chgEl.textContent=newChg;
        const cls=_c>0.01?'up':_c<-0.01?'down':'neu';
        chgEl.className=`badge ${cls}`;
      }
    }

    // Volume
    const volEl=area.querySelector(`[data-vol="${c.sym}"]`);
    if(volEl){
      const newVol=fmtB(_v);
      if(volEl.textContent!==newVol) volEl.textContent=newVol;
    }

    // RSI — update nếu cache mới
    const rsiCell=area.querySelector(`[data-rsi-cell="${c.sym}"]`);
    if(rsiCell){
      const rc=rsiCache[c.sym];
      if(rc){
        const rsiStr=rc.rsi.toFixed(0);
        const rsiClass=rc.rsi>70?'rsi-ob':rc.rsi<30?'rsi-os':'rsi-n';
        const span=rsiCell.querySelector('.rsi-badge');
        if(span&&(span.textContent!==rsiStr||!span.classList.contains(rsiClass))){
          span.textContent=rsiStr;
          span.className=`rsi-badge ${rsiClass}`;
        }
      }
    }

    // Signal
    const sigCell=area.querySelector(`[data-sig-cell="${c.sym}"]`);
    if(sigCell){
      const rc=rsiCache[c.sym];
      if(rc){
        const sigTxt=rc.signal==='buy'?'MUA':rc.signal==='sell'?'BÁN':'GIỮ';
        const span=sigCell.querySelector('.sig');
        if(span&&(span.textContent!==sigTxt||span.className!==`sig ${rc.signal}`)){
          span.textContent=sigTxt;
          span.className=`sig ${rc.signal}`;
        }
      }
    }
  });

  // Cập nhật _last state (không thay đổi sort/filter)
  _lastSortCol=sortCol; _lastSortDir=sortDir;
  _lastTab=currentTab; _lastPage=currentPage;
}

// Khi sort/filter thay đổi → force full rebuild
function _forceFullRender(){_tableBuilt=false; renderDirty=true; render();}
function sortBy(col){
  if(sortCol===col) sortDir*=-1;
  else{sortCol=col; sortDir=-1;}
  currentPage=1; _forceFullRender();
}
function goPage(p){
  const tot=Math.ceil(SYMBOLS.filter(s=>coins[s]?.price>0).length/PAGE_SIZE)||1;
  if(p<1||p>tot) return;
  currentPage=p; render();
  document.querySelector('.tbl-scroll')?.scrollTo(0,0);
}
function setTab(el,tab){
  document.querySelectorAll('.tab-btn').forEach(t=>t.classList.remove('active'));
  el.classList.add('active'); currentTab=tab; currentPage=1; _forceFullRender();
}
function onSearch(){
  const val=document.getElementById('searchInput').value;
  document.getElementById('clearBtn').classList.toggle('visible',val.length>0);
  currentPage=1; _forceFullRender();
}
function clearSearch(){
  document.getElementById('searchInput').value='';
  document.getElementById('clearBtn').classList.remove('visible');
  currentPage=1; _forceFullRender();
}

/* ═══════════════════════════════════════════════════
   TICKER — smart update: chỉ patch text khi cần
═══════════════════════════════════════════════════ */
let tickerNeedsUpdate=true;
let renderDirty=true;
let lastRenderHash='';
let _rafPending=false;
let _tickerBuilt=false;
let _tickerSymCount=0;

function updateTicker(){
  if(!tickerNeedsUpdate) return;
  const list=SYMBOLS.map(s=>({sym:s,base:s.replace('USDT',''),...coins[s]})).filter(c=>c.price>0);
  if(!list.length) return;
  tickerNeedsUpdate=false;

  const el=document.getElementById('ticker');
  if(!el) return;

  // Rebuild toàn bộ chỉ khi số lượng coin thay đổi (lần đầu / logo mới)
  if(!_tickerBuilt||_tickerSymCount!==list.length){
    const html=list.map(c=>{
      const _tc=chg(c.sym); const cls=_tc>=0?'tup':'tdn';
      const lg=logoMap[c.base]?`<img src="${getLogoSrc(c.base)}" width="14" height="14" style="border-radius:50%;object-fit:cover;background:rgba(255,255,255,.05)" loading="lazy" onerror="${getLogoOnErr(c.base)}">`:'';
      return `<span class="ticker-item" data-tsym="${c.sym}">${lg}<span class="tsym">${c.base}</span><span class="tprice">${fmtP(c.price)}</span><span class="tchange ${cls}">${sign(_tc)}${_tc.toFixed(2)}%</span></span>`;
    }).join('');
    el.innerHTML=html+html; // duplicate for seamless loop
    _tickerBuilt=true;
    _tickerSymCount=list.length;
    return;
  }

  // Patch mode: update chỉ giá/% đã thay đổi (tránh layout reflow)
  // Chỉ update bản sao đầu tiên (CSS animation sẽ tự sync bản 2)
  const items=el.querySelectorAll('[data-tsym]');
  const half=Math.floor(items.length/2); // chỉ update nửa đầu
  for(let i=0;i<half;i++){
    const item=items[i];
    const sym=item.dataset.tsym;
    if(!sym||!coins[sym]) continue;
    const _tc=chg(sym);
    const cls=_tc>=0?'tup':'tdn';
    const priceEl=item.querySelector('.tprice');
    const chgEl=item.querySelector('.tchange');
    const newPrice=fmtP(coins[sym].price);
    const newChg=`${sign(_tc)}${_tc.toFixed(2)}%`;
    if(priceEl&&priceEl.textContent!==newPrice) priceEl.textContent=newPrice;
    if(chgEl){
      if(chgEl.textContent!==newChg) chgEl.textContent=newChg;
      if(chgEl.className!==`tchange ${cls}`) chgEl.className=`tchange ${cls}`;
    }
    // Sync bản 2 (duplicate) luôn
    const item2=items[i+half];
    if(item2){
      const p2=item2.querySelector('.tprice');
      const c2=item2.querySelector('.tchange');
      if(p2&&p2.textContent!==newPrice) p2.textContent=newPrice;
      if(c2){
        if(c2.textContent!==newChg) c2.textContent=newChg;
        if(c2.className!==`tchange ${cls}`) c2.className=`tchange ${cls}`;
      }
    }
  }
}
setInterval(()=>{tickerNeedsUpdate=true;},5000); // ticker update 5s (giảm từ 10s)

/* ═══════════════════════════════════════════════════
   FEAR & GREED INDEX
═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   PHÁT HIỆN CÁ VOI — Whale Detection
   Theo dõi spike khối lượng so với baseline
═══════════════════════════════════════════════════ */
let whaleMultiplier = 3;       // ngưỡng mặc định 3×
let whaleEvents = [];          // [{sym,base,vol,baseline,mult,price,chg,ts}]
const WHALE_MAX_EVENTS = 50;   // giữ tối đa 50 sự kiện
const WHALE_COOLDOWN = {};     // sym → timestamp, tránh duplicate trong 60s

function updateWhaleThreshold(){
  const sel = document.getElementById('whaleThreshold');
  whaleMultiplier = parseFloat(sel?.value || 3);
  renderWhalePanel();
}

function checkWhaleForSym(sym){
  const c = coins[sym]; if(!c || !c.price || !c.vol) return;
  const base = sym.replace('USDT','');
  const baseline = volBaseline[sym];
  if(!baseline || baseline <= 0) return;

  const mult = c.vol / baseline;
  if(mult < whaleMultiplier) return;

  // Cooldown 60s mỗi coin
  const now = Date.now();
  if(WHALE_COOLDOWN[sym] && now - WHALE_COOLDOWN[sym] < 60000) return;
  WHALE_COOLDOWN[sym] = now;

  // Thêm sự kiện
  whaleEvents.unshift({
    sym, base,
    vol: c.vol,
    baseline,
    mult: Math.round(mult * 10) / 10,
    price: c.price,
    chg: chg(sym),
    ts: now
  });
  if(whaleEvents.length > WHALE_MAX_EVENTS) whaleEvents.pop();

  renderWhalePanel();
}

function renderWhalePanel(){
  const feed = document.getElementById('whaleFeed');
  if(!feed) return;

  // Filter theo threshold hiện tại
  const visible = whaleEvents.filter(e => e.mult >= whaleMultiplier).slice(0, 20);

  // Update stats
  const totalVol = visible.reduce((s, e) => s + (e.vol || 0), 0);
  const avgMult = visible.length ? (visible.reduce((s,e) => s+e.mult, 0)/visible.length).toFixed(1) : '—';
  const el1 = document.getElementById('whaleTotalCount');
  const el2 = document.getElementById('whaleTotalVol');
  const el3 = document.getElementById('whaleAvgMult');
  if(el1) el1.textContent = visible.length || '0';
  if(el2) el2.textContent = visible.length ? fmtB(totalVol) : '—';
  if(el3) el3.textContent = visible.length ? avgMult + '×' : '—';

  if(!visible.length){
    feed.innerHTML = `<div class="whale-empty"><div style="font-size:24px;margin-bottom:6px">🐋</div><div>Chưa phát hiện cá voi (ngưỡng ${whaleMultiplier}×)</div></div>`;
    return;
  }

  feed.innerHTML = visible.map((e, i) => {
    const logo = logoMap[e.base];
    const color = colorMap[e.base] || '#00d4ff';
    const logoHtml = logo
      ? `<img class="whale-logo" src="${logo}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const fb = `<div class="whale-logo-fb" style="background:${color}22;color:${color};display:${logo?'none':'flex'}">${e.base[0]}</div>`;
    const isMega = e.mult >= 10;
    const chgColor = e.chg >= 0 ? 'var(--green)' : 'var(--red)';
    const chgSign = e.chg >= 0 ? '+' : '';
    const timeAgo = _timeAgo(e.ts);
    return `<div class="whale-item${isMega?' mega':''}" style="animation-delay:${i*0.04}s">
      ${logoHtml}${fb}
      <div class="whale-info">
        <div class="whale-sym">
          ${e.base}
          ${isMega ? '<span class="wmega">MEGA</span>' : ''}
        </div>
        <div class="whale-vol">KL: ${fmtB(e.vol)} · ${timeAgo}</div>
      </div>
      <div class="whale-right">
        <div class="whale-mult">${e.mult}×</div>
        <div class="whale-price" style="color:${chgColor}">${chgSign}${e.chg.toFixed(2)}%</div>
      </div>
    </div>`;
  }).join('');

  // Update last update time
  const lu = document.getElementById('whaleLastUpdate');
  if(lu) lu.textContent = 'Cập nhật: ' + new Date().toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

function _timeAgo(ts){
  const sec = Math.floor((Date.now() - ts) / 1000);
  if(sec < 60) return sec + 's trước';
  if(sec < 3600) return Math.floor(sec/60) + 'm trước';
  return Math.floor(sec/3600) + 'h trước';
}

// Hook vào WS onmessage: kiểm tra whale mỗi khi nhận data
// Chạy checkWhale mỗi 10s để không spam
let _whaleCheckTimer = null;
const _whalePendingSyms = new Set();

function _scheduleWhaleCheck(sym){
  _whalePendingSyms.add(sym);
  if(_whaleCheckTimer) return;
  _whaleCheckTimer = setTimeout(()=>{
    _whaleCheckTimer = null;
    _whalePendingSyms.forEach(s => checkWhaleForSym(s));
    _whalePendingSyms.clear();
  }, 10000); // gom lại 10s
}

// Gọi render mỗi phút để cập nhật timeAgo
setInterval(()=>{
  if(whaleEvents.length > 0) renderWhalePanel();
}, 60000);

async function loadFearGreed(){
  try{
    // alternative.me hỗ trợ CORS — gọi thẳng, fallback allorigins
    let fngData = null;
    try{
      const r1 = await fetch('https://api.alternative.me/fng/?limit=4',{signal:AbortSignal.timeout(8000)});
      if(r1.ok) fngData = await r1.json();
    }catch(e){}
    if(!fngData){
      // Fallback: allorigins /get
      const r2 = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent('https://api.alternative.me/fng/?limit=4')}`,{signal:AbortSignal.timeout(10000)});
      if(r2.ok){
        const j = await r2.json();
        if(j.contents) fngData = JSON.parse(j.contents);
      }
      if(!fngData) throw new Error('FNG all failed');
    }
    const data = fngData;
    const items=data.data||[];
    if(!items.length) throw new Error('empty');
    const cur=items[0];
    const val=parseInt(cur.value);
    const labelMap={
      'Extreme Fear':'Cực Kỳ Sợ Hãi',
      'Fear':'Sợ Hãi',
      'Trung Lập':'Trung Lập',
      'Greed':'Tham Lam',
      'Extreme Greed':'Cực Kỳ Tham Lam'
    };
    const label=labelMap[cur.value_classification]||cur.value_classification;
    const col=val<=25?'#ff3d57':val<=45?'#fb923c':val<=55?'#f59e0b':val<=75?'#84cc16':'#00e676';

    document.getElementById('fgNum').textContent=val;
    document.getElementById('fgNum').style.color=col;
    document.getElementById('fgLabel').textContent=label;
    document.getElementById('fgLabel').style.color=col;

    // Gauge needle: val 0→-90°, val 100→+90°
    const angle=-90+(val/100)*180;
    document.getElementById('fgNeedle').setAttribute('transform',`rotate(${angle},80,75)`);
    const arcLen=220*(val/100);
    document.getElementById('fgArc').setAttribute('stroke-dashoffset',220-arcLen);

    // Lịch sử 3 ngày
    const histHtml=items.slice(1,4).map(h=>{
      const v=parseInt(h.value);
      const c2=v<=25?'#ff3d57':v<=45?'#fb923c':v<=55?'#f59e0b':v<=75?'#84cc16':'#00e676';
      const ago=Math.round((Date.now()/1000-parseInt(h.timestamp))/86400);
      return `<div class="fg-hist-item"><div class="fg-hist-val" style="color:${c2}">${v}</div><div class="fg-hist-lbl">${ago}d trước</div></div>`;
    }).join('');
    document.getElementById('fgHistory').innerHTML=histHtml;
  }catch(e){
    const el=document.getElementById('fgLabel');
    if(el) el.textContent='Không thể tải';
  }
}



/* ── Global Market Stats (CoinGecko /global) ── */
async function loadGlobalMarket(){
  try{
    // Dùng Binance /ticker/24hr (đã có CORS, không cần key)
    // Tính tổng market cap/vol từ top coins Binance đang theo dõi
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr',
      {signal:AbortSignal.timeout(10000)});
    if(!r.ok) throw new Error('Binance '+r.status);
    const tickers = await r.json();

    // Tính từ USDT pairs
    const usdtPairs = tickers.filter(t=>(t.symbol||'').endsWith('USDT'));
    const totalVol   = usdtPairs.reduce((s,t)=>s+(parseFloat(t.quoteVolume)||0),0);

    // Lấy top coins để tính market cap ước lượng
    // BTC market cap ≈ BTC price × 19.7M supply
    const btcT = usdtPairs.find(t=>t.symbol==='BTCUSDT');
    const ethT = usdtPairs.find(t=>t.symbol==='ETHUSDT');
    const btcPrice  = parseFloat(btcT?.lastPrice||0);
    const ethPrice  = parseFloat(ethT?.lastPrice||0);
    const btcMcap   = btcPrice * 19_700_000;
    const ethMcap   = ethPrice * 120_000_000;
    // Tổng mcap ước lượng: BTC thường ~55% thị trường
    const btcDom    = parseFloat(btcT?.priceChangePercent||0);
    // Dùng tỉ lệ BTC dominance xấp xỉ từ giá trị thực
    const totalMcap = btcMcap / 0.55;
    const altMcap   = Math.max(0, totalMcap - btcMcap - ethMcap);
    const btcDomPct = btcMcap/totalMcap*100;
    const ethDomPct = ethMcap/totalMcap*100;
    const altDomPct = Math.max(0, 100-btcDomPct-ethDomPct);

    // 24h change của tổng market = trung bình top 20 coins
    const top20 = usdtPairs
      .sort((a,b)=>parseFloat(b.quoteVolume||0)-parseFloat(a.quoteVolume||0))
      .slice(0,20);
    const mcChg = top20.reduce((s,t)=>s+(parseFloat(t.priceChangePercent)||0),0)/top20.length;

    // Render
    const fmtMc = totalMcap>=1e12 ? '$'+(totalMcap/1e12).toFixed(2)+'T'
                : totalMcap>=1e9  ? '$'+(totalMcap/1e9).toFixed(0)+'B'
                : '$'+(totalMcap/1e6).toFixed(0)+'M';
    const fmtVol = totalVol>=1e12 ? '$'+(totalVol/1e12).toFixed(2)+'T'
                 : totalVol>=1e9  ? '$'+(totalVol/1e9).toFixed(0)+'B'
                 : '$'+(totalVol/1e6).toFixed(0)+'M';

    const _s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    _s('gmMarketCap', fmtMc);
    _s('gmVolume',    fmtVol);
    _s('gmActiveCoins', usdtPairs.length.toLocaleString());
    _s('gmMarkets',   '600+');

    const chgEl=document.getElementById('gmCapChg');
    if(chgEl){
      chgEl.textContent=(mcChg>=0?'▲ +':'▼ ')+mcChg.toFixed(2)+'% (24h)';
      chgEl.style.color=mcChg>=0?'var(--green)':'var(--red)';
    }

    const setBd=(id,w)=>{const e=document.getElementById(id);if(e)setTimeout(()=>e.style.width=w+'%',100);};
    setBd('gmBtcBar',btcDomPct); setBd('gmEthBar',ethDomPct); setBd('gmAltBar',altDomPct);
    const sp=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v.toFixed(1)+'%';};
    sp('gmBtcPct',btcDomPct); sp('gmEthPct',ethDomPct); sp('gmAltPct',altDomPct);

  }catch(e){
    const el=document.getElementById('gmMarketCap');
    if(el) el.textContent='—';
  }
}


/* ═══════════════════════════════════════════════════
   TECHNICAL INDICATORS — RSI, MACD, Bollinger Bands
═══════════════════════════════════════════════════ */
function calcRSI(closes,period=14){
  if(closes.length<period+1) return 50;
  let gains=0,losses=0;
  for(let i=1;i<=period;i++){
    const d=closes[i]-closes[i-1];
    if(d>0) gains+=d; else losses-=d;
  }
  let avgG=gains/period, avgL=losses/period;
  for(let i=period+1;i<closes.length;i++){
    const d=closes[i]-closes[i-1];
    avgG=(avgG*(period-1)+(d>0?d:0))/period;
    avgL=(avgL*(period-1)+(d<0?-d:0))/period;
  }
  const rs=avgL===0?100:avgG/avgL;
  return 100-(100/(1+rs));
}

function calcEMA(data,period){
  if(data.length<period) return data.map(()=>null);
  const k=2/(period+1);
  let ema=data.slice(0,period).reduce((a,b)=>a+b,0)/period;
  const result=[...Array(period-1).fill(null),ema];
  for(let i=period;i<data.length;i++){ema=data[i]*k+ema*(1-k); result.push(ema);}
  return result;
}

function calcMACD(closes){
  const ema12=calcEMA(closes,12), ema26=calcEMA(closes,26);
  const macdLine=closes.map((_,i)=>(ema12[i]!=null&&ema26[i]!=null)?ema12[i]-ema26[i]:null).filter(v=>v!=null);
  if(macdLine.length<9) return{macd:0,signal:0,hist:0,cross:'none'};
  const sigLine=calcEMA(macdLine,9);
  const histLine=macdLine.map((v,i)=>sigLine[i]!=null?v-sigLine[i]:null);
  const last=macdLine.length-1;
  const cross=histLine[last]>0&&histLine[last-1]!=null&&histLine[last-1]<=0?'bull':
               histLine[last]<0&&histLine[last-1]!=null&&histLine[last-1]>=0?'bear':'none';
  return{macd:macdLine[last]||0, signal:sigLine[last]||0, hist:histLine[last]||0, cross};
}

function calcBB(closes,period=20,mult=2){
  if(closes.length<period) return{upper:0,middle:0,lower:0};
  const slice=closes.slice(-period);
  const mean=slice.reduce((a,b)=>a+b,0)/period;
  const std=Math.sqrt(slice.reduce((a,b)=>a+(b-mean)**2,0)/period);
  return{upper:mean+mult*std, middle:mean, lower:mean-mult*std};
}

async function fetchIndicators(sym){
  // Dùng cache nếu < 5 phút tuổi
  const cached=rsiCache[sym];
  if(cached&&cached.ts&&Date.now()-cached.ts<5*60*1000) return cached;
  try{
    const res=await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=100`,
      {signal:AbortSignal.timeout(8000)});
    if(!res.ok) return cached||null;
    const data=await res.json();
    if(!data||data.length<30) return cached||null;
    const closes=data.map(k=>parseFloat(k[4]));
    const rsi=calcRSI(closes);
    const macd=calcMACD(closes);
    const bb=calcBB(closes);
    const price=closes[closes.length-1];
    let score=0;
    if(rsi<30) score+=2; else if(rsi>70) score-=2;
    if(macd.cross==='bull') score+=2; else if(macd.cross==='bear') score-=2;
    else if(macd.hist>0) score+=1; else score-=1;
    if(price<bb.lower) score+=1; else if(price>bb.upper) score-=1;
    const signal=score>=2?'buy':score<=-2?'sell':'hold';
    const result={rsi,macd,bb,signal,price,ts:Date.now()};
    rsiCache[sym]=result;
    return result;
  }catch(e){return cached||null;}
}

// Update RSI/Signal cells trực tiếp sau khi fetch indicators
function _patchRSICells(syms){
  const area=document.getElementById('tableArea');
  if(!area) return;
  (syms||[]).forEach(sym=>{
    const rc=rsiCache[sym]; if(!rc) return;
    const rsiCell=area.querySelector(`[data-rsi-cell="${sym}"]`);
    if(rsiCell){
      const rsiStr=rc.rsi.toFixed(0);
      const rsiClass=`rsi-badge ${rc.rsi>70?'rsi-ob':rc.rsi<30?'rsi-os':'rsi-n'}`;
      rsiCell.innerHTML=`<span class="${rsiClass}">${rsiStr}</span>`;
    }
    const sigCell=area.querySelector(`[data-sig-cell="${sym}"]`);
    if(sigCell){
      const sigTxt=rc.signal==='buy'?'MUA':rc.signal==='sell'?'BÁN':'GIỮ';
      sigCell.innerHTML=`<span class="sig ${rc.signal}">${sigTxt}</span>`;
    }
  });
}

async function batchFetchIndicators(){
  try{
    const need=SYMBOLS.slice(0,30).filter(s=>!rsiCache[s]||Date.now()-rsiCache[s].ts>5*60*1000);
    const BATCH_SIZE=5;
    for(let i=0;i<need.length;i+=BATCH_SIZE){
      const batch=need.slice(i,i+BATCH_SIZE);
      await Promise.allSettled(batch.map(s=>fetchIndicators(s)));
      if(i+BATCH_SIZE<need.length) await new Promise(r=>setTimeout(r,300));
      _patchRSICells(batch);
    }
    _patchRSICells(need);
  }catch(e){}
}
/* ═══════════════════════════════════════════════════
   CHART PAGE
═══════════════════════════════════════════════════ */
let selectedSym=null, lwChart=null, candleSeries=null, currentTf='1h';
let _candleOpen=null, _candleTime=null, _candleHigh=null, _candleLow=null; // track OHLC nến hiện tại
let _chartLoadVer=0; // version token — tránh WS cũ ghi đè chart mới

let _lastChartListHash='';
function renderChartCoinList(){
  const q=(document.getElementById('chartSearch')?.value||'').toLowerCase();
  const list=SYMBOLS.map(s=>({sym:s,base:s.replace('USDT',''),...coins[s]}))
    .filter(c=>c.price>0&&(!q||c.base.toLowerCase().includes(q)||(nameMap[c.base]||'').toLowerCase().includes(q)))
    .slice(0,200);

  // Hash nhanh để skip nếu không thay đổi
  const hash=list.slice(0,5).map(c=>c.sym+fmtP(c.price)).join('|');
  if(hash===_lastChartListHash&&!q) return;
  _lastChartListHash=hash;

  const html=list.map(c=>{
    const cls=c.sym===selectedSym?' active':'';
    const _cchg=chg(c.sym); const chgCol=_cchg>=0?'var(--green)':'var(--red)';
    return `<div class="cli${cls}" onclick="openChart('${c.sym}')">
      ${logoHTML(c.base,24)}
      <div class="cli-info"><div class="cli-sym">${c.base}</div><div class="cli-name">${nameMap[c.base]||c.base}</div></div>
      <div class="cli-price"><div class="cli-pv">${fmtP(c.price)}</div><div class="cli-chg" style="color:${chgCol}">${sign(_cchg)}${_cchg.toFixed(2)}%</div></div>
    </div>`;
  }).join('');
  const el=document.getElementById('chartCoinList');
  if(el) el.innerHTML=html||'<div class="state-box" style="padding:20px"><div>Không tìm thấy coin</div></div>';
}
function filterChartList(){renderChartCoinList();}

async function openChart(sym){
  selectedSym=sym;
  const base=sym.replace('USDT','');
  showPage('chart',document.querySelector('[onclick*="\'chart\'"]'));
  document.getElementById('chartCoinName').textContent=nameMap[base]||base;
  document.getElementById('chartCoinSym').textContent=base+'/USDT';
  updateChartHeader();
  {
    const img=document.getElementById('chartLogo');
    const fb=document.getElementById('chartLogoFb');
    const bl=base.toLowerCase();
    const color=colorMap[base]||'#00d4ff';
    // Dùng cùng chain như logoHTML(): LCW → CoinCap → spothq → chữ cái
    const src1=`https://lcw.nyc3.cdn.digitaloceanspaces.com/production/currencies/64/${bl}.webp`;
    const src2=`https://assets.coincap.io/assets/icons/${bl}@2x.png`;
    const src3=`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${bl}.png`;
    if(img){
      img._f1=false; img._f2=false;
      img.onerror=function(){
        if(!this._f1){this._f1=true;this.src=src2;return;}
        if(!this._f2){this._f2=true;this.src=src3;return;}
        this.style.display='none';
        if(fb){fb.style.display='flex';fb.textContent=base[0];
               fb.style.background=`${color}22`;fb.style.color=color;}
      };
      img.src=src1;
      img.style.display='block';
    }
    if(fb) fb.style.display='none';
  }
  if(false){
    // Không có logoMap → thử CDN trước, fallback chữ cái
    const imgEl=document.getElementById('chartLogo');
    const fbEl=document.getElementById('chartLogoFb');
    const cdnUrl=`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${base.toLowerCase()}.png`;
    if(imgEl){
      imgEl.onerror=function(){
        this.style.display='none';
        if(fbEl){fbEl.style.display='flex';fbEl.textContent=base[0];fbEl.style.background=`${colorMap[base]||'#00d4ff'}22`;fbEl.style.color=colorMap[base]||'#00d4ff';}
      };
      imgEl.src=cdnUrl; imgEl.style.display='block';
      if(fbEl) fbEl.style.display='none';
    } else if(fbEl){
      fbEl.style.display='flex';fbEl.textContent=base[0];fbEl.style.background=`${colorMap[base]||'#00d4ff'}22`;fbEl.style.color=colorMap[base]||'#00d4ff';
    }
  }
  renderChartCoinList();
  await loadCandleData(sym,currentTf);
  await loadChartIndicators(sym);
    // Load info nếu panel info đang mở
    loadCoinInfo(sym.replace('USDT','')); // luôn load để có Vốn hoá & Hạng
  // Nếu đang ở tab Order Book → restart với coin mới
  if(currentRightPanel==='ob') startOrderBook(sym);
}

function updateChartHeader(){
  if(!selectedSym) return;
  const c=coins[selectedSym]||{};
  const prEl=document.getElementById('chartPrice');
  if(prEl) prEl.textContent=fmtP(c.price);
  const chgEl=document.getElementById('chartChg');
  if(chgEl){
    const _cc=chg(selectedSym);
    chgEl.textContent=`${sign(_cc)}${_cc.toFixed(2)}%`;
    chgEl.className=`chart-chg ${_cc>=0?'up':'down'}`;
  }
  // Mini stats — từ Binance ticker
  const highEl=document.getElementById('chartHigh');
  const lowEl=document.getElementById('chartLow');
  const volEl=document.getElementById('chartVol24h');
  if(highEl&&c.high) highEl.textContent=fmtP(c.high);
  if(lowEl&&c.low) lowEl.textContent=fmtP(c.low);
  if(volEl) volEl.textContent=fmtB(c.vol||0);

  // Vốn hoá ước tính từ giá × circulating supply (nếu chưa có từ CoinGecko)
  const mcEl=document.getElementById('chartMarketCap');
  if(mcEl && (mcEl.textContent==='—' || !mcEl.textContent.trim())){
    // Ước tính bằng vol 24h (proxy khi chưa có mcap thật)
    if(c.vol>0) mcEl.textContent=fmtB(c.vol)+' (KL)';
  }

  // Chênh lệch bid-ask từ order book snapshot nhanh
  const spreadEl=document.getElementById('csbSpread');
  if(spreadEl && (spreadEl.textContent==='—' || !spreadEl.textContent.trim()) && c.price>0){
    // Ước tính spread ≈ 0.01% của giá (typical maker spread)
    const estSpread = c.price * 0.0001;
    spreadEl.textContent = fmtPShort(estSpread);
  }
}

async function loadCandleData(sym,tf){
  const myVer=++_chartLoadVer; // snapshot version — nếu bị gọi lại, version cũ sẽ bị bỏ
  const loading=document.getElementById('chartLoading');
  if(loading){loading.style.display='flex'; loading.innerHTML='<div class="chart-spinner"></div><span style="letter-spacing:.5px">Đang tải dữ liệu...</span>';}
  try{
    // Lấy container DOM — đợi layout xong nếu width=0
    let container=document.getElementById('chartContainer');
    if(!container) throw new Error('Không tìm thấy khung biểu đồ');
    // Nếu page vừa hiện, đợi 1 frame để layout render
    if(container.clientWidth===0){
      await new Promise(r=>requestAnimationFrame(r));
      await new Promise(r=>requestAnimationFrame(r));
    }
    const w=container.clientWidth||container.offsetWidth||900;
    const h=container.clientHeight||container.offsetHeight||500;

    // Fetch klines từ Binance
    const res=await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=500`,{signal:AbortSignal.timeout(10000)});
    if(!res.ok) throw new Error('Binance klines '+res.status);
    const raw=await res.json();
    const candles=raw.map(k=>({
      time:Math.floor(k[0]/1000),
      open:parseFloat(k[1]),
      high:parseFloat(k[2]),
      low:parseFloat(k[3]),
      close:parseFloat(k[4])
    }));
    if(!candles.length) throw new Error('Không có dữ liệu nến');

    // Nếu trong lúc fetch có loadCandleData mới hơn được gọi → bỏ qua kết quả này
    if(myVer!==_chartLoadVer) return;

    // Xóa chart cũ nếu có
    if(lwChart){try{lwChart.remove();}catch(e){} lwChart=null; candleSeries=null;}
    _candleOpen=null; _candleTime=null; _candleHigh=null; _candleLow=null; // reset candle tracking
    const _thisChartVer=myVer; // gắn version vào chart này

    // Tính số chữ số thập phân phù hợp với giá coin
    const coinData=coins[sym];
    const price=coinData?.price||1;
    let precision=2, minMove=0.01;
    if(price<0.00001){precision=10; minMove=0.0000000001;}
    else if(price<0.0001){precision=8; minMove=0.00000001;}
    else if(price<0.001){precision=7; minMove=0.0000001;}
    else if(price<0.01){precision=6; minMove=0.000001;}
    else if(price<0.1){precision=5; minMove=0.00001;}
    else if(price<1){precision=4; minMove=0.0001;}
    else if(price<10){precision=4; minMove=0.0001;}
    else if(price<1000){precision=2; minMove=0.01;}
    else{precision=2; minMove=0.01;}

    lwChart=LightweightCharts.createChart(container,{
      layout:{
        background:{color:'#0a0e17'},
        textColor:'#64748b',
        fontSize:11,
        fontFamily:"'SF Mono','Fira Code',monospace",
      },
      grid:{
        vertLines:{color:'rgba(255,255,255,.03)',style:1},
        horzLines:{color:'rgba(255,255,255,.04)',style:1},
      },
      crosshair:{
        mode:LightweightCharts.CrosshairMode.Normal,
        vertLine:{color:'rgba(0,212,255,.4)',labelBackgroundColor:'#0a0e17'},
        horzLine:{color:'rgba(0,212,255,.4)',labelBackgroundColor:'#0a0e17'},
      },
      rightPriceScale:{
        borderColor:'rgba(255,255,255,.06)',
        minimumWidth: precision>=8 ? 130 : precision>=6 ? 105 : 85,
        autoScale:true,
        entireTextOnly:true,
        textColor:'#64748b',
      },
      timeScale:{
        borderColor:'rgba(255,255,255,.06)',
        timeVisible:true,
        secondsVisible:tf==='1m'||tf==='5m',
        textColor:'#64748b',
        rightOffset:8,
        barSpacing:6,
        minBarSpacing:2,
        lockVisibleTimeRangeOnResize:true,
      },
      width:w,
      height:h||500,
    });
    candleSeries=lwChart.addCandlestickSeries({
      upColor:'#089981',        // TradingView green — dễ nhìn hơn #00e676
      downColor:'#f23645',      // TradingView red
      borderUpColor:'#089981',
      borderDownColor:'#f23645',
      wickUpColor:'#089981',
      wickDownColor:'#f23645',
      priceFormat:{type:'price', precision, minMove},
      lastValueVisible:true,
      priceLineVisible:true,
      priceLineColor:'rgba(0,212,255,.5)',
      priceLineWidth:1,
      priceLineStyle:2,         // dashed
    });
    candleSeries.setData(candles);

    const closes = raw.map(k=>parseFloat(k[4]));
    const times  = candles.map(k=>k.time);
    const vols   = raw.map(k=>parseFloat(k[5]));

    // ── EMA 20 ──
    if(window._emaLine20){try{lwChart.removeSeries(window._emaLine20);}catch(e){} window._emaLine20=null;}
    if(window._emaLine50){try{lwChart.removeSeries(window._emaLine50);}catch(e){} window._emaLine50=null;}
    if(window._emaLine200){try{lwChart.removeSeries(window._emaLine200);}catch(e){} window._emaLine200=null;}
    if(window._volSeries){try{lwChart.removeSeries(window._volSeries);}catch(e){} window._volSeries=null;}

    const _emaActive = document.getElementById('togEMA')?.classList.contains('active');
    const _volActive = document.getElementById('togVol')?.classList.contains('active');

    if(_emaActive){
      const ema20v = calcEMA(closes,20), ema50v = calcEMA(closes,50), ema200v = calcEMA(closes,200);
      const mkEmaData=(arr)=>arr.map((v,i)=>v==null?null:{time:times[i],value:v}).filter(Boolean);
      window._emaLine20  = lwChart.addLineSeries({color:'#f59e0b',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,priceFormat:{type:'price',precision,minMove}});
      window._emaLine50  = lwChart.addLineSeries({color:'#818cf8',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,priceFormat:{type:'price',precision,minMove}});
      window._emaLine200 = lwChart.addLineSeries({color:'#f43f5e',lineWidth:1,lineStyle:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,priceFormat:{type:'price',precision,minMove}});
      window._emaLine20.setData(mkEmaData(ema20v));
      window._emaLine50.setData(mkEmaData(ema50v));
      window._emaLine200.setData(mkEmaData(ema200v));

      // Update stats bar + ind panel EMA
      const last20=ema20v.filter(Boolean).at(-1), last50=ema50v.filter(Boolean).at(-1), last200=ema200v.filter(Boolean).at(-1);
      const curPrice=closes.at(-1);
      _setEl('emaVal20',  last20  ? fmtPShort(last20)  : '—');
      _setEl('emaVal50',  last50  ? fmtPShort(last50)  : '—');
      _setEl('emaVal200', last200 ? fmtPShort(last200) : '—');
      _setEl('csbEma20',  last20  ? fmtPShort(last20)  : '—');
      _setEl('csbEma50',  last50  ? fmtPShort(last50)  : '—');

      // EMA trend labels
      if(last20&&last50){
        const t = document.getElementById('emaTrend2050');
        if(t){t.textContent = last20>last50 ? '▲ EMA20 > EMA50 (Tăng)' : '▼ EMA20 < EMA50 (Giảm)'; t.className='ema-trend-item '+(last20>last50?'bull':'bear');}
      }
      if(last50&&last200){
        const t = document.getElementById('emaTrend50200');
        if(t){t.textContent = last50>last200 ? '▲ EMA50 > EMA200 (Uptrend)' : '▼ EMA50 < EMA200 (Downtrend)'; t.className='ema-trend-item '+(last50>last200?'bull':'bear');}
      }
      // EMA signal
      const emaEl = document.getElementById('emaSignal');
      if(emaEl&&last20&&last50){
        const bull = last20>last50 && curPrice>last20;
        const bear = last20<last50 && curPrice<last20;
        emaEl.className = 'ind-signal-pill '+(bull?'buy':bear?'sell':'hold');
        emaEl.textContent = bull ? '✅ EMA Xếp Lớp Tăng — Xu Hướng Dương' : bear ? '🔻 EMA Xếp Lớp Giảm — Xu Hướng Âm' : '⏸ Đang Tích Lũy';
      }
    }

    // ── Volume histogram ──
    if(_volActive){
      const avgVol = vols.slice(-20).reduce((a,b)=>a+b,0)/20;
      window._volSeries = lwChart.addHistogramSeries({
        priceFormat:{type:'volume'},
        priceScaleId:'vol',
        scaleMargins:{top:0.82, bottom:0},
      });
      lwChart.priceScale('vol').applyOptions({scaleMargins:{top:0.82,bottom:0},drawTicks:false,visible:false});
      const volData = candles.map((c,i)=>({
        time:c.time,
        value:vols[i],
        color: closes[i] >= (i>0?closes[i-1]:closes[i]) ? 'rgba(8,153,129,.55)' : 'rgba(242,54,69,.55)'
      }));
      window._volSeries.setData(volData);

      // mini vol bars in indicator panel
      const vbEl = document.getElementById('volBars');
      if(vbEl){
        const last30 = vols.slice(-30);
        const maxV = Math.max(...last30);
        vbEl.innerHTML = last30.map((v,i,a)=>{
          const h = Math.max(4, Math.round((v/maxV)*40));
          const up = i<a.length-1 ? closes[closes.length-30+i]>=closes[closes.length-30+i-1] : true;
          const cur = i===a.length-1;
          return `<div class="vol-bar ${cur?'cur':up?'up':'dn'}" style="height:${h}px"></div>`;
        }).join('');
        const baseH = Math.round((avgVol/maxV)*40);
        const bl = document.getElementById('volBaselineLine');
        if(bl) bl.style.bottom = baseH+'px';
        _setEl('volCurrent', fmtB(vols.at(-1)||0));
        _setEl('volAvg20', fmtB(avgVol));
        const ratio = (vols.at(-1)||0)/avgVol;
        const vva = document.getElementById('volVsAvg');
        if(vva){
          vva.textContent = ratio.toFixed(2)+'× TB' + (ratio>2?' 🐋 Khối lượng đột biến!':ratio>1.5?' ↑ Cao hơn bình thường':ratio<0.5?' ↓ Thấp bất thường':'');
          vva.style.color = ratio>2?'#f43f5e':ratio>1.2?'#00e676':'var(--muted)';
        }
      }
    }

    // ── Update stats bar ──
    const lastClose = closes.at(-1), firstClose = closes[0];
    _setEl('csbOpen', fmtP(raw.at(-1)?parseFloat(raw.at(-1)[1]):0));

    // setData() trong LW v4 tự cuộn về cuối.
    await new Promise(r=>requestAnimationFrame(r));
    await new Promise(r=>requestAnimationFrame(r));
    if(myVer===_chartLoadVer && lwChart){
      lwChart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, candles.length - 100),
        to:   candles.length + 8
      });
    }
    // Khởi tạo _candleOpen/_candleHigh/_candleLow từ nến cuối của REST data
    // để WS update đầu tiên không bị sai open/high/low
    const lastCandle=candles[candles.length-1];
    if(lastCandle){
      const now=Math.floor(Date.now()/1000);
      const tfSecs={'1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'1d':86400};
      const tfS=tfSecs[tf]||3600;
      const currentCandleTime=now-(now%tfS);
      // Chỉ seed nếu nến cuối REST là nến hiện tại
      if(lastCandle.time===currentCandleTime){
        _candleTime=currentCandleTime;
        _candleOpen=lastCandle.open;
        _candleHigh=lastCandle.high;
        _candleLow=lastCandle.low;
      }
    }
    if(window._chartResizeObserver) window._chartResizeObserver.disconnect();
    window._chartResizeObserver = new ResizeObserver(()=>{
      if(lwChart&&container) lwChart.applyOptions({width:container.clientWidth,height:container.clientHeight||400});
    });
    window._chartResizeObserver.observe(container);
    if(loading) loading.style.display='none';
  }catch(e){
    if(loading) loading.innerHTML='<span>⚠️ Không thể tải biểu đồ: '+e.message+'</span>';
  }
}


// ── Helper: set element text+color ───────────────────────────────────
function _setEl(id, text, color){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = text;
  if(color) el.style.color = color;
}

// ── Toggle chart overlay indicators ──────────────────────────────────
function toggleChartIndicator(type, btn){
  btn.classList.toggle('active');
  if(selectedSym) loadCandleData(selectedSym, currentTf);
}

// ── Switch right panel (extended for 'info') ──────────────────────────
// Patch existing switchRightPanel to handle 'info'
const _origSwitch = typeof switchRightPanel === 'function' ? switchRightPanel : null;

// ── Load CoinGecko info panel ─────────────────────────────────────────
const _cgInfoCache = {};


// ── Fill thông tin cơ bản từ Binance (không cần CoinGecko) ──────────
function _fillCoinInfoFromBinance(base){
  const sym  = base + 'USDT';
  const d    = coins[sym] || {};
  const name = nameMap[base] || base;

  _setEl('infoFullName', name);
  _setEl('infoVol24',    fmtB(d.vol || 0));
  _setEl('chartMarketCap', d.vol ? fmtB(d.vol) + ' (KL)' : '—');

  // Giá hiện tại, cao/thấp 24h
  if(d.price){
    _setEl('infoAth',  fmtP(d.high || d.price), 'var(--green)');
    _setEl('infoAtl',  fmtP(d.low  || d.price), 'var(--red)');
  }

  // Logo trong info panel nếu có
  const logoEl = document.getElementById('infoLogo');
  if(logoEl && logoMap[base]){
    logoEl.src = logoMap[base];
    logoEl.style.display = 'block';
  }

  // Links mặc định dùng base
  const lb = document.getElementById('infoLinkBinance');
  const lg = document.getElementById('infoLinkGecko');
  if(lb) lb.href = `https://www.binance.com/vi/trade/${base}_USDT`;
  const cgId = (cgIdMap&&cgIdMap[base]) || base.toLowerCase();
  if(lg) lg.href = `https://www.coingecko.com/vi/đồng-tiền-kỹ-thuật-số/${cgId}`;
}

async function loadCoinInfo(base){
  const id = (cgIdMap&&cgIdMap[base]) || base.toLowerCase();
  const cacheKey = 'cginfo_' + id;
  const cached = _cgInfoCache[cacheKey];

  // ── Luôn fill ngay từ Binance data (instant, không cần API) ──────
  _fillCoinInfoFromBinance(base);

  // ── Dùng cache nếu còn mới (< 10 phút) ──────────────────────────
  if(cached && Date.now()-cached.ts < 600000){
    _applyCGData(base, id, cached.data);
    return;
  }

  // ── Thử gọi CoinGecko ─────────────────────────────────────────────
  try{
    const r = await cgFetch(`/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=true`,
      {signal:AbortSignal.timeout(12000)}
    );
    if(!r?.ok){
      console.log(`CoinGecko ${r?.status} cho ${id}`);
      return; // giữ nguyên data Binance đã fill
    }
    const d = await r.json();
    _cgInfoCache[cacheKey] = {ts:Date.now(), data:d};
    _applyCGData(base, id, d);
  }catch(e){ console.warn('CoinInfo err:', e.message); }
}

function _applyCGData(base, id, d){
  const md = d.market_data||{};
    const fmt = (v)=>v==null?'—':v>=1e9?'$'+(v/1e9).toFixed(2)+'B':v>=1e6?'$'+(v/1e6).toFixed(2)+'M':v>=1e3?'$'+(v/1e3).toFixed(1)+'K':'$'+v.toFixed(4);
    const fmtN = (v)=>v==null?'—':v>=1e9?(v/1e9).toFixed(2)+'B':v>=1e6?(v/1e6).toFixed(2)+'M':(+v).toLocaleString('vi-VN');
    const pctColor = (v)=>v==null?'var(--muted)':v>=0?'var(--green)':'var(--red)';
    const pctFmt  = (v)=>v==null?'—':(v>=0?'+':'')+v.toFixed(2)+'%';

    _setEl('infoFullName', d.name||'—');
    _setEl('infoRank', d.market_cap_rank ? '#'+d.market_cap_rank : '—');
    _setEl('infoMCap', fmt(md.market_cap?.usd));
    _setEl('infoVol24', fmt(md.total_volume?.usd));
    _setEl('infoSupply', fmtN(md.circulating_supply)+' '+base);
    _setEl('infoTotalSupply', md.total_supply ? fmtN(md.total_supply)+' '+base : '∞');
    _setEl('infoAth', fmt(md.ath?.usd));
    _setEl('infoAtl', fmt(md.atl?.usd));

    // update chart header rank + mcap
    _setEl('chartRank', d.market_cap_rank ? '#'+d.market_cap_rank : '—');
    _setEl('chartMarketCap', fmt(md.market_cap?.usd));

    // Performance
    const perfs = [
      ['perf1h',  md.price_change_percentage_1h_in_currency?.usd],
      ['perf24h', md.price_change_percentage_24h],
      ['perf7d',  md.price_change_percentage_7d_in_currency?.usd],
      ['perf30d', md.price_change_percentage_30d_in_currency?.usd],
    ];
    perfs.forEach(([id,v])=>{
      const el = document.getElementById(id);
      if(el){ el.textContent=pctFmt(v); el.style.color=pctColor(v); }
    });

    // Sparkline 7d
    const sp = md.sparkline_7d?.price;
    if(sp&&sp.length){
      const canvas = document.getElementById('infoSparkline');
      if(canvas){
        const ctx = canvas.getContext('2d');
        const W=canvas.width||240, H=canvas.height||52;
        ctx.clearRect(0,0,W,H);
        const mn=Math.min(...sp), mx=Math.max(...sp)||mn+1;
        const pts = sp.map((v,i)=>[i/(sp.length-1)*W, H-4-((v-mn)/(mx-mn))*(H-8)]);
        const isUp = sp.at(-1)>=sp[0];
        const grad = ctx.createLinearGradient(0,0,0,H);
        grad.addColorStop(0,isUp?'rgba(8,153,129,.4)':'rgba(242,54,69,.4)');
        grad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.moveTo(pts[0][0],H);
        pts.forEach(p=>ctx.lineTo(p[0],p[1]));
        ctx.lineTo(pts.at(-1)[0],H);
        ctx.closePath();
        ctx.fillStyle=grad; ctx.fill();
        ctx.beginPath();
        pts.forEach((p,i)=>i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]));
        ctx.strokeStyle=isUp?'#089981':'#f23645';
        ctx.lineWidth=1.5; ctx.stroke();
      }
    }

    // Links
    const lb = document.getElementById('infoLinkBinance');
    const lg = document.getElementById('infoLinkGecko');
    if(lb) lb.href=`https://www.binance.com/vi/trade/${base}_USDT`;
    if(lg) lg.href=`https://www.coingecko.com/vi/đồng-tiền-kỹ-thuật-số/${id}`;
  }


async function loadChartIndicators(sym){
  const ind=await fetchIndicators(sym);
  if(!ind) return;
  const{rsi,macd,bb,signal,price}=ind;

  // ── RSI ──
  const rsiEl=document.getElementById('rsiVal');
  if(rsiEl){
    rsiEl.textContent=rsi.toFixed(2);
    rsiEl.style.color=rsi>70?'var(--red)':rsi<30?'var(--green)':'var(--gold)';
  }
  const rsiBar=document.getElementById('rsiBar');
  if(rsiBar) rsiBar.style.width=rsi+'%';
  const rsiThumb=document.getElementById('rsiThumb');
  if(rsiThumb) rsiThumb.style.left=rsi+'%';
  const rsiSig=document.getElementById('rsiSignal');
  if(rsiSig){
    const rs=rsi>70?'sell':rsi<30?'buy':'hold';
    rsiSig.className=`ind-signal-pill ${rs}`;
    rsiSig.textContent=rsi>70?'⚠️ Quá Mua — Cân nhắc bán':rsi<30?'✅ Quá Bán — Cân nhắc mua':'⏸ Trung Lập';
  }

  // ── MACD ──
  const mlEl=document.getElementById('macdLine');
  if(mlEl){const macdAbs=Math.abs(macd.macd); mlEl.textContent=(macdAbs<0.000001?macd.macd.toExponential(3):macd.macd.toFixed(6)); mlEl.style.color=macd.macd>0?'var(--green)':'var(--red)';}
  const msEl=document.getElementById('macdSignal');
  if(msEl){const sigAbs=Math.abs(macd.signal); msEl.textContent=(sigAbs<0.000001?macd.signal.toExponential(3):macd.signal.toFixed(6)); msEl.style.color=macd.signal>0?'var(--green)':'var(--red)';}
  const mhEl=document.getElementById('macdHist');
  if(mhEl){const histAbs=Math.abs(macd.hist); mhEl.textContent=(histAbs<0.000001?macd.hist.toExponential(3):macd.hist.toFixed(6)); mhEl.style.color=macd.hist>0?'var(--green)':'var(--red)';}
  const msbEl=document.getElementById('macdSignalBox');
  if(msbEl){
    const ms2=macd.cross==='bull'?'buy':macd.cross==='bear'?'sell':macd.hist>0?'buy':'sell';
    msbEl.className=`ind-signal-pill ${ms2}`;
    msbEl.textContent=macd.cross==='bull'?'✅ Giao Cắt Lên — Mua':macd.cross==='bear'?'🔻 Giao Cắt Xuống — Bán':macd.hist>0?'📈 Động Lực Dương':'📉 Động Lực Âm';
  }

  // ── Bollinger Bands ──
  const bbU=document.getElementById('bbUpper'); if(bbU) bbU.textContent=fmtPShort(bb.upper);
  const bbM=document.getElementById('bbMiddle'); if(bbM) bbM.textContent=fmtPShort(bb.middle);
  const bbL=document.getElementById('bbLower'); if(bbL) bbL.textContent=fmtPShort(bb.lower);
  const bbP=document.getElementById('bbPrice'); if(bbP) bbP.textContent=fmtP(price);

  // BB gauge: vị trí dot và band
  const bbRange=bb.upper-bb.lower||1;
  const pricePos=Math.max(0,Math.min(100,((price-bb.lower)/bbRange)*100));
  const midPos=Math.max(0,Math.min(100,((bb.middle-bb.lower)/bbRange)*100));
  const bandLeft=Math.max(0,Math.min(100,((bb.lower-bb.lower)/bbRange)*100));
  const bandWidth=Math.max(0,Math.min(100,100));
  const bbDot=document.getElementById('bbGaugeDot');
  if(bbDot) bbDot.style.left=pricePos+'%';
  const bbMidEl=document.getElementById('bbGaugeMid');
  if(bbMidEl) bbMidEl.style.left=midPos+'%';
  const bbBand=document.getElementById('bbGaugeBand');
  if(bbBand){bbBand.style.left='5%'; bbBand.style.width='90%';}

  // BB vị trí text
  const bbPosEl=document.getElementById('bbPos');
  if(bbPosEl){
    const pct=Math.round(pricePos);
    bbPosEl.textContent=pct+'% trong dải';
    bbPosEl.style.color=pct>85?'var(--red)':pct<15?'var(--green)':'var(--accent)';
  }
  const bbSEl=document.getElementById('bbSignal');
  if(bbSEl){
    const bs=price>bb.upper?'sell':price<bb.lower?'buy':'hold';
    bbSEl.className=`ind-signal-pill ${bs}`;
    bbSEl.textContent=price>bb.upper?'⚠️ Trên Dải Trên — Quá Mua':price<bb.lower?'✅ Dưới Dải Dưới — Quá Bán':'⏸ Trong Vùng Bình Thường';
  }

  // ── Tổng Hợp ──
  const ovEl=document.getElementById('overallSignal');
  if(ovEl){
    ovEl.className=`ind-summary-main ${signal}`;
    ovEl.textContent=signal==='buy'?'✅ TÍN HIỆU MUA':signal==='sell'?'🔴 TÍN HIỆU BÁN':'⏸ TRUNG LẬP — CHỜ XEM';
  }
  // Chips
  const chipRsi=document.getElementById('chipRsi');
  const chipMacd=document.getElementById('chipMacd');
  const chipBb=document.getElementById('chipBb');
  const rsC=rsi>70?'sell':rsi<30?'buy':'hold';
  const maC=macd.cross==='bull'?'buy':macd.cross==='bear'?'sell':macd.hist>0?'buy':'sell';
  const bbC=price>bb.upper?'sell':price<bb.lower?'buy':'hold';
  if(chipRsi){chipRsi.className=`ind-chip ${rsC}`; chipRsi.textContent=`RSI ${rsi.toFixed(0)}`;}
  if(chipMacd){chipMacd.className=`ind-chip ${maC}`; chipMacd.textContent=`MACD ${maC==='buy'?'▲':'▼'}`;}
  if(chipBb){chipBb.className=`ind-chip ${bbC}`; chipBb.textContent=`BB ${bbC==='buy'?'Dưới':bbC==='sell'?'Trên':'OK'}`;}

  // ── Cập nhật stats bar ──
  _setEl('csbRsi',     rsi.toFixed(1), rsi>70?'var(--red)':rsi<30?'var(--green)':'var(--gold)');
  _setEl('csbMacd',    macd.hist>0?'▲ Dương':'▼ Âm', macd.hist>0?'var(--green)':'var(--red)');
  _setEl('csbBbUpper', fmtP(bb.upper));
  _setEl('csbBbLower', fmtP(bb.lower));
  // Spread from ob
  const ask0 = parseFloat(document.getElementById('obAsks')?.querySelector('.ob-price')?.textContent||0);
  const bid0 = parseFloat(document.getElementById('obBids')?.querySelector('.ob-price')?.textContent||0);
  if(ask0&&bid0) _setEl('csbSpread', fmtP(ask0-bid0));
}

async function setTf(el,tf){
  document.querySelectorAll('.tf-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); currentTf=tf;
  if(selectedSym){await loadCandleData(selectedSym,tf); await loadChartIndicators(selectedSym);}
  }

/* ═══════════════════════════════════════════════════
   SCREENER
═══════════════════════════════════════════════════ */
async function runScreener(){
  const fChg=document.getElementById('fChg').value;
  const fVol=document.getElementById('fVol').value;
  const fRsi=document.getElementById('fRsi').value;
  const fMacd=document.getElementById('fMacd').value;
  const fWhale=document.getElementById('fWhale').value;
  const fName=(document.getElementById('fName').value||'').toLowerCase().trim();

  const tbl=document.getElementById('screenerTable');
  if(tbl) tbl.innerHTML='<div class="state-box"><div class="spinner"></div><div>Đang lọc...</div></div>';

  // Fetch indicators nếu cần RSI/MACD filter
  if(fRsi!=='all'||fMacd!=='all'){
    const need=SYMBOLS.slice(0,100).filter(s=>!rsiCache[s]||Date.now()-rsiCache[s].ts>5*60*1000);
    for(let i=0;i<Math.min(need.length,60);i++){
      if(i>0) await new Promise(r=>setTimeout(r,120));
      await fetchIndicators(need[i]);
    }
  }

  let list=SYMBOLS.map(s=>{
    const base=s.replace('USDT','');
    const c=coins[s]||{};
    const rc=rsiCache[s];
    const vh=volHistory[s]||[];
    const baseline=volBaseline[s]||c.vol;
    const isWhale=baseline>0&&c.vol>baseline*1.2;
    return{sym:s,base,name:nameMap[base]||base,...c,rsi:rc?.rsi,macdCross:rc?.macd?.cross,signal:rc?.signal,isWhale};
  }).filter(c=>c.price>0);

  if(fChg!=='all') list=list.filter(c=>{
    if(fChg==='gt5')  return chg(c.sym)>5;
    if(fChg==='gt10') return chg(c.sym)>10;
    if(fChg==='lt-5') return chg(c.sym)<-5;
    if(fChg==='lt-10')return chg(c.sym)<-10;
    if(fChg==='1to5') return chg(c.sym)>=1&&chg(c.sym)<=5;
    return true;
  });
  if(fVol!=='all') list=list.filter(c=>{
    if(fVol==='gt1b')  return c.vol>1e9;
    if(fVol==='gt100m')return c.vol>1e8;
    if(fVol==='gt10m') return c.vol>1e7;
    if(fVol==='lt1m')  return c.vol<1e6;
    return true;
  });
  if(fRsi!=='all') list=list.filter(c=>{
    if(!c.rsi) return false;
    if(fRsi==='ob')     return c.rsi>70;
    if(fRsi==='os')     return c.rsi<30;
    if(fRsi==='neutral')return c.rsi>=30&&c.rsi<=70;
    return true;
  });
  if(fMacd!=='all') list=list.filter(c=>{
    if(!c.macdCross) return false;
    if(fMacd==='bull') return c.macdCross==='bull';
    if(fMacd==='bear') return c.macdCross==='bear';
    return true;
  });
  if(fWhale==='whale') list=list.filter(c=>c.isWhale);
  if(fName) list=list.filter(c=>c.base.toLowerCase().includes(fName)||c.name.toLowerCase().includes(fName));

  list.sort((a,b)=>b.vol-a.vol);
  const scrCnt=document.getElementById('scrCount');
  if(scrCnt) scrCnt.textContent=list.length;

  if(!list.length){
    if(tbl) tbl.innerHTML='<div class="state-box"><div>Không có coin nào phù hợp với bộ lọc</div></div>';
    return;
  }
  const rows=list.map((c,i)=>{
    const _sc=chg(c.sym); const cls=_sc>0?'up':'down';
    const rsiCls=c.rsi?(c.rsi>70?'rsi-ob':c.rsi<30?'rsi-os':'rsi-n'):'rsi-n';
    const sigCls=c.signal||'hold';
    return `<tr onclick="openChart('${c.sym}')" style="cursor:pointer">
      <td><span class="rank">${i+1}</span></td>
      <td><div class="coin-cell">${logoHTML(c.base)}<div><div class="cn">${c.isWhale?'🐋 ':''}${c.name}</div><div class="cs">${c.base}</div></div></div></td>
      <td class="r"><span class="pv">${fmtP(c.price)}</span></td>
      <td class="r"><span class="badge ${cls}">${sign(_sc)}${_sc.toFixed(2)}%</span></td>
      <td class="r"><span class="num">${fmtB(c.vol)}</span></td>
      <td class="r"><span class="rsi-badge ${rsiCls}">${c.rsi?.toFixed(0)||'—'}</span></td>
      <td class="r"><span class="sig ${sigCls}">${sigCls==='buy'?'MUA':sigCls==='sell'?'BÁN':'GIỮ'}</span></td>
      <td class="r"><span class="num">${fmtP(c.high)}</span></td>
      <td class="r"><span class="num">${fmtP(c.low)}</span></td>
    </tr>`;
  }).join('');
  if(tbl) tbl.innerHTML=`<table><thead><tr>
    <th style="width:30px">#</th><th>Coin</th>
    <th class="r">Giá</th><th class="r">24h%</th>
    <th class="r">KL 24h</th><th class="r">RSI</th>
    <th class="r">Tín Hiệu</th><th class="r">Cao 24h</th><th class="r">Thấp 24h</th>
  </tr></thead><tbody>${rows}</tbody></table>`;
  }

function resetScreener(){
  ['fChg','fVol','fRsi','fMacd','fWhale'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='all';});
  const fn=document.getElementById('fName'); if(fn) fn.value='';
  const tbl=document.getElementById('screenerTable'); if(tbl) tbl.innerHTML='<div class="state-box"><div>Nhấn 🔬 Lọc để bắt đầu tìm kiếm</div></div>';
  const sc=document.getElementById('scrCount'); if(sc) sc.textContent='—';
}

/* ═══════════════════════════════════════════════════
   NEWS — 3 tầng fallback
═══════════════════════════════════════════════════ */
let allNews=[], currentNewsSource='all', fetchingNews=false;

function detectSentiment(t){
  const tx=(t||'').toLowerCase();
  const b=['surge','rally','gain','bull','rise','pump','ath','growth','breakout','buy','adoption','approve','launch','upgrade','recover','soar','jump'];
  const br=['crash','drop','fall','plunge','bear','decline','dump','loss','hack','ban','restrict','lawsuit','fear','sell','warning','exploit','scam','collapse'];
  const bs=b.filter(w=>tx.includes(w)).length;
  const brs=br.filter(w=>tx.includes(w)).length;
  return bs>brs?'bullish':brs>bs?'bearish':'neutral';
}

function extractCoins(t){
  const tx=(t||'').toUpperCase(),found=[];
  ['BTC','ETH','BNB','SOL','XRP','DOGE','ADA','AVAX','DOT','LINK','UNI','TRX','ARB','OP','SUI','INJ','ATOM','NEAR','SHIB','TON','MATIC','FTM','APT','SEI'].forEach(c=>{
    if(new RegExp('\\b'+c+'\\b').test(tx)&&!found.includes(c)) found.push(c);
  });
  return found.slice(0,4);
}

async function fetchNews(manual=false){
  if(fetchingNews) return;
  fetchingNews=true;
  const btn=document.getElementById('newsPageRefreshBtn');
  if(btn){btn.disabled=true; btn.textContent='Đang tải...';}
  const grid=document.getElementById('newsGrid');
  if(grid&&manual) grid.innerHTML='<div class="state-box" style="grid-column:1/-1"><div class="spinner"></div><div>Đang tải tin tức...</div></div>';


  const strategies=[
    // ── Strategy 1: CryptoCompare News API (JSON, có CORS, miễn phí) ──
    async()=>{
      // CryptoCompare public news endpoint — không cần API key, hỗ trợ CORS
      const res=await fetch(
        'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest&limit=50',
        {signal:AbortSignal.timeout(10000)}
      );
      if(!res.ok) throw new Error('CryptoCompare '+res.status);
      const json=await res.json();
      const articles=json.Data||[];
      if(articles.length<3) throw new Error('CryptoCompare: '+articles.length+' items');
      return articles.map((a,i)=>{
        const coins=(a.categories||'').split('|')
          .map(s=>s.trim().toUpperCase()).filter(s=>s.length>0&&s.length<=6).slice(0,3);
        const title=(a.title||'').toLowerCase();
        const sentiment=
          /bull|surge|rally|pump|gain|rise|ath|moon|break|up|high/.test(title)?'bullish':
          /bear|crash|dump|drop|fall|low|fear|sell|ban|hack/.test(title)?'bearish':'neutral';
        return{
          headline:a.title||'',
          summary:a.body?a.body.substring(0,200)+'...':'',
          source:a.source_info?.name||a.source||'CryptoCompare', sourceType:'crypto',
          link:a.url||'#',
          pub:(a.published_on||0)*1000||Date.now()-i*5*60000,
          sentiment,
          coins,
          img:a.imageurl||''
        };
      }).sort((a,b)=>b.pub-a.pub);
    },
    async()=>{
      throw new Error('disabled');
      const [tr,mr]=await Promise.allSettled([
        Promise.resolve(null),
        Promise.resolve(null)
      ]);
      const items=[];
      const td=tr.status==='fulfilled'?tr.value:null;
      const md=mr.status==='fulfilled'?mr.value:null;
      if(td?.coins) td.coins.slice(0,8).forEach((e,i)=>{
        const c=e.item||{}; const sym=(c.symbol||'').toUpperCase();
        const chgVal=c.data?.price_change_percentage_24h?.usd||0;
        items.push({headline:`${c.name||sym} đang trending trên CoinGecko — ${chgVal>=0?'tăng':'giảm'} ${Math.abs(chgVal).toFixed(2)}% trong 24h`,source:'CoinGecko', sourceType:'crypto', link:`https://www.coingecko.com/en/coins/${c.id||''}`,pub:Date.now()-i*8*60000,sentiment:chgVal>2?'bullish':chgVal<-2?'bearish':'neutral',coins:sym?[sym]:[]});
      });
      if(md) md.slice(0,8).forEach((c,i)=>{
        const chgVal=c.price_change_percentage_24h||0;
        items.push({headline:`${c.name} (${(c.symbol||'').toUpperCase()}) — $${c.current_price?.toLocaleString('en-US')||'—'}, ${chgVal>=0?'📈 +':'📉 '}${Math.abs(chgVal).toFixed(2)}% (24h)`,source:'CoinGecko', sourceType:'crypto', link:`https://www.coingecko.com/en/coins/${c.id}`,pub:Date.now()-(i+8)*6*60000,sentiment:chgVal>3?'bullish':chgVal<-3?'bearish':'neutral',coins:[(c.symbol||'').toUpperCase()]});
      });
      if(!items.length) throw new Error('CoinGecko: 0 items');
      return items;
    },
    // ── Strategy 3: CryptoCompare categories (backup nếu S1 fail) ──
    async()=>{
      // Thử categories khác nhau — BTC, ETH, Market
      const cats=['BTC','ETH','Market','Altcoin','Trading'];
      const results=await Promise.allSettled(
        cats.map(cat=>fetch(
          `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${cat}&limit=15`,
          {signal:AbortSignal.timeout(8000)}
        ).then(r=>r?.ok?r.json():null))
      );
      const items=[];
      const seen=new Set();
      results.forEach(r=>{
        if(r.status!=='fulfilled'||!r.value?.Data) return;
        r.value.Data.forEach(a=>{
          if(seen.has(a.id)) return; seen.add(a.id);
          const title=(a.title||'').toLowerCase();
          const sentiment=
            /bull|surge|rally|pump|gain|rise|ath|moon|break/.test(title)?'bullish':
            /bear|crash|dump|drop|fall|fear|sell|ban|hack/.test(title)?'bearish':'neutral';
          const coins=(a.categories||'').split('|')
            .map(s=>s.trim().toUpperCase()).filter(s=>s.length>0&&s.length<=6).slice(0,3);
          items.push({headline:a.title||'',summary:a.body?a.body.substring(0,200)+'...':'',
            source:a.source_info?.name||'CryptoCompare',link:a.url||'#',
            pub:(a.published_on||0)*1000||Date.now(),sentiment,coins,img:a.imageurl||''});
        });
      });
      if(items.length<3) throw new Error('CryptoCompare cat: '+items.length);
      return items.sort((a,b)=>b.pub-a.pub).slice(0,50);
    },

    // ── Strategy Macro: CryptoCompare Macro categories ──────────────
    async()=>{
      const MACRO_CATS = ['Regulation','Business','Macro','Trading','ICO'];
      const results = await Promise.allSettled(
        MACRO_CATS.map(cat=>fetch(
          `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${cat}&limit=10`,
          {signal:AbortSignal.timeout(8000)}
        ).then(r=>r?.ok?r.json():null))
      );
      const items=[], seen=new Set();
      results.forEach((r,i)=>{
        if(r.status!=='fulfilled'||!r.value?.Data) return;
        r.value.Data.forEach(a=>{
          if(seen.has(a.id)) return; seen.add(a.id);
          const title=(a.title||'').toLowerCase();
          const sentiment=
            /bull|surge|rally|pump|gain|rise|ath|approve|launch/.test(title)?'bullish':
            /bear|crash|dump|drop|fall|fear|sell|ban|hack|fine|lawsuit/.test(title)?'bearish':'neutral';
          items.push({
            headline:a.title||'',
            summary:a.body?a.body.substring(0,200)+'...':'',
            source: a.source_info?.name||'CryptoCompare',
            sourceType:'macro',
            link:a.url||'#',
            pub:(a.published_on||0)*1000||Date.now(),
            sentiment, coins:[], img:a.imageurl||''
          });
        });
      });
      if(items.length<3) throw new Error('Macro news: '+items.length);
      return items.sort((a,b)=>b.pub-a.pub);
    },

        // ── Strategy 4: Binance Live — LUÔN hoạt động (fallback cuối) ──
    async()=>{
      if(SYMBOLS.length<10) throw new Error('SYMBOLS not ready');
      const list=SYMBOLS.map(s=>({sym:s,base:s.replace('USDT',''),...coins[s]})).filter(c=>c.price>0);
      if(list.length<5) throw new Error('Not enough data');
      const topG=[...list].sort((a,b)=>chg(b.sym)-chg(a.sym)).slice(0,8);
      const topL=[...list].sort((a,b)=>chg(a.sym)-chg(b.sym)).slice(0,8);
      const topV=[...list].sort((a,b)=>kvol(b.sym)-kvol(a.sym)).slice(0,6);
      return[
        ...topG.map((c,i)=>({headline:`${nameMap[c.base]||c.base} (${c.base}) tăng mạnh +${chg(c.sym).toFixed(2)}% hôm nay — Giá: ${fmtP(c.price)}`,source:'Binance Live', sourceType:'crypto', link:`https://www.binance.com/en/trade/${c.base}_USDT`,pub:Date.now()-i*5*60000,sentiment:'bullish',coins:[c.base]})),
        ...topL.map((c,i)=>({headline:`${nameMap[c.base]||c.base} (${c.base}) giảm ${chg(c.sym).toFixed(2)}% hôm nay — Giá: ${fmtP(c.price)}`,source:'Binance Live', sourceType:'crypto', link:`https://www.binance.com/en/trade/${c.base}_USDT`,pub:Date.now()-(i+8)*5*60000,sentiment:'bearish',coins:[c.base]})),
        ...topV.map((c,i)=>({headline:`${nameMap[c.base]||c.base} (${c.base}) dẫn đầu khối lượng hôm nay — ${fmtB(kvol(c.sym))}`,source:'Binance Live', sourceType:'crypto', link:`https://www.binance.com/en/trade/${c.base}_USDT`,pub:Date.now()-(i+16)*4*60000,sentiment:chg(c.sym)>0?'bullish':chg(c.sym)<0?'bearish':'neutral',coins:[c.base]})),
      ];
    }
  ];

  // Chạy tất cả strategies song song, merge kết quả theo thời gian
  const settled = await Promise.allSettled(strategies.map(s=>s()));
  const merged = [], seenH = new Set();
  settled.forEach(r=>{
    if(r.status!=='fulfilled') return;
    (r.value||[]).forEach(item=>{
      const key = item.headline.substring(0,60);
      if(seenH.has(key)) return;
      seenH.add(key);
      merged.push(item);
    });
  });
  merged.sort((a,b)=>b.pub-a.pub);
  if(merged.length){
    allNews = merged;
    renderNewsPage();
  } else {
    const g=document.getElementById('newsGrid');
    if(g) g.innerHTML='<div class="state-box" style="grid-column:1/-1"><div style="font-size:24px">⚠️</div><div>Không thể tải tin tức. Vui lòng thử lại sau.</div></div>';
  }
  if(btn){btn.disabled=false; btn.textContent='Làm mới';}
  fetchingNews=false;
  }

function renderNews(){ renderNewsPage(); }
function filterNews(el,src){
  document.querySelectorAll('.nst').forEach(t=>t.classList.remove('active'));
  el.classList.add('active'); currentNewsSource=src; renderNewsPage();
}

let newsPageSource='all', newsPageSentiment='all';
function setNewsSource(el,src){
  document.querySelectorAll('#page-news .news-toolbar .news-filter-group:first-child .nf-btn').forEach(t=>t.classList.remove('active'));
  el.classList.add('active'); newsPageSource=src; renderNewsPage();
}
function setSentFilter(el,sent){
  document.querySelectorAll('.nf-btn.nf-sent').forEach(t=>t.classList.remove('active'));
  el.classList.add('active'); newsPageSentiment=sent; renderNewsPage();
}

function renderNewsPage(){
  const sentLabel={bullish:'📈 Tích Cực',bearish:'📉 Tiêu Cực',neutral:'⚖️ Trung Lập'};
  let items=[...allNews];
  if(newsPageSource==='world')  items=items.filter(n=>n.sourceType==='world');
  else if(newsPageSource==='macro') items=items.filter(n=>n.sourceType==='macro');
  else if(newsPageSource==='crypto') items=items.filter(n=>!n.sourceType||n.sourceType==='crypto');
  else if(newsPageSource!=='all')   items=items.filter(n=>n.source.toLowerCase().includes(newsPageSource.toLowerCase()));
  if(newsPageSentiment!=='all') items=items.filter(n=>n.sentiment===newsPageSentiment);

  const setEl=(id,v)=>{const e=document.getElementById(id); if(e) e.textContent=v;};
  setEl('newsTotal',allNews.length);
  setEl('newsBullish',allNews.filter(n=>n.sentiment==='bullish').length);
  setEl('newsBearish',allNews.filter(n=>n.sentiment==='bearish').length);

  const grid=document.getElementById('newsGrid');
  if(!grid) return;
  if(!items.length){grid.innerHTML='<div class="state-box" style="grid-column:1/-1"><div>Không có tin tức phù hợp.</div></div>'; return;}
  grid.innerHTML=items.map(n=>{
    const tags=(n.coins||[]).map(c=>`<span class="news-card-coin">${c}</span>`).join('');
    const thumb=n.img?`<div style="width:100%;height:140px;overflow:hidden;background:var(--surface2);border-bottom:1px solid var(--border);flex-shrink:0;"><img src="${n.img}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.display='none'"></div>`:'';
    return `<a class="news-card-item" href="${n.link}" target="_blank" rel="noopener noreferrer">
      ${thumb}
      <div class="news-card-body">
        <div class="news-card-meta">
          <span class="news-card-src">${n.sourceType==='world'?'🌍 ':n.sourceType==='macro'?'📊 ':''}${n.source}</span>
          <span class="news-card-sent ${n.sentiment}">${sentLabel[n.sentiment]||'⚖️ Trung Lập'}</span>
          <span class="news-card-time">${timeAgo(n.pub)}</span>
        </div>
        <div class="news-card-headline">${n.headline}</div>
        ${n.summary?`<div class="news-card-summary">${n.summary}</div>`:''}
      </div>
      <div class="news-card-footer">${tags||''}<span class="news-card-link" style="${tags?'':'margin-left:0'}">Đọc thêm ↗</span></div>
    </a>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════
   RIGHT PANEL — TABS (Chỉ Báo / Order Book / AI Pred)
═══════════════════════════════════════════════════ */
let currentRightPanel='ind';
function switchRightPanel(panel, btn){
  currentRightPanel=panel;
  document.querySelectorAll('.ob-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  const ind=document.getElementById('rp-ind');
  const ob=document.getElementById('rp-ob');
  const info=document.getElementById('rp-info');
  if(info) info.style.display='none';
  if(panel==='info'){
    if(ind) ind.style.display='none';
    if(ob)  ob.style.display='none';
    if(info){info.style.display='flex';info.style.flexDirection='column';}
    if(selectedSym) loadCoinInfo(selectedSym.replace('USDT',''));
    return;
  }
  if(panel==='ind'){
    if(ind){ind.style.display='flex';ind.style.flexDirection='column';}
    if(ob) ob.style.display='none';
  } else {
    if(ind) ind.style.display='none';
    if(ob){ob.style.display='flex';ob.style.flexDirection='column';}
    if(selectedSym) startOrderBook(selectedSym);
  }
}

/* ═══════════════════════════════════════════════════
   ORDER BOOK — Binance Depth WebSocket
═══════════════════════════════════════════════════ */
let obWs=null, obSym=null, obTimer=null;

function startOrderBook(sym){
  if(obSym===sym&&obWs&&obWs.readyState===1) return; // đã kết nối
  stopOrderBook();
  obSym=sym;
  const lbl=document.getElementById('obCoinLabel');
  if(lbl) lbl.textContent=sym.replace('USDT','/USDT');
  fetchDepthSnapshot(sym);
  // WebSocket depth stream (100ms updates)
  obWs=new WebSocket(`wss://stream.binance.com:9443/ws/${sym.toLowerCase()}@depth20@100ms`);
  let _obRaf=false;
  obWs.onmessage=(e)=>{
    if(_obRaf) return; // throttle 60fps — skip nếu frame chưa render
    _obRaf=true;
    try{
      const d=JSON.parse(e.data);
      requestAnimationFrame(()=>{ _obRaf=false; renderOrderBook(d.asks||[], d.bids||[]); });
    }catch(ex){ _obRaf=false; }
  };
  obWs.onerror=()=>{ stopOrderBook(); setTimeout(()=>{if(currentRightPanel==='ob'&&selectedSym) startOrderBook(selectedSym);},3000); };
}

function stopOrderBook(){
  if(obWs){try{obWs.close();}catch(e){} obWs=null;}
  if(obTimer){clearInterval(obTimer); obTimer=null;}
  obSym=null;
}

async function fetchDepthSnapshot(sym){
  try{
    const r=await fetch(`https://api.binance.com/api/v3/depth?symbol=${sym}&limit=20`,{signal:AbortSignal.timeout(8000)});
    if(!r.ok) return;
    const d=await r.json();
    renderOrderBook(d.asks||[],d.bids||[]);
  }catch(e){}
}

function renderOrderBook(asks,bids){
  const fmtQ=n=>{const f=parseFloat(n); return f>=1000?f.toFixed(0):f>=1?f.toFixed(2):f.toFixed(4);};
  const fmtV=n=>{const v=parseFloat(n); return v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v.toFixed(0);};

  // Lấy top 10 ask (giá tăng dần, hiển thị từ trên xuống gần spread)
  const topAsks=asks.slice(0,10).reverse(); // asks đã sort giá tăng dần
  const topBids=bids.slice(0,10);

  // Tính max qty để vẽ bar
  const allQty=[...topAsks,...topBids].map(r=>parseFloat(r[1]));
  const maxQ=Math.max(...allQty)||1;

  // Render asks (đỏ)
  const askEl=document.getElementById('obAsks');
  if(askEl) askEl.innerHTML=topAsks.map(([p,q])=>{
    const pf=parseFloat(p), qf=parseFloat(q), vf=pf*qf;
    const barW=Math.round(qf/maxQ*100);
    return `<div class="ob-row">
      <span class="ob-qty">${fmtQ(q)}</span>
      <span class="ob-price-ask">${fmtP(pf)}</span>
      <span class="ob-qty right">${fmtV(vf)}</span>
      <div class="ob-bar-ask" style="width:${barW}%"></div>
    </div>`;
  }).join('');

  // Spread
  const bestAsk=parseFloat(asks[0]?.[0]||0);
  const bestBid=parseFloat(bids[0]?.[0]||0);
  const spread=bestAsk-bestBid;
  const spreadPct=bestBid>0?((spread/bestBid)*100).toFixed(3):'—';
  const spreadEl=document.getElementById('obSpread');
  if(spreadEl) spreadEl.textContent=`Chênh Lệch: ${fmtP(spread)} (${spreadPct}%)`;

  // Render bids (xanh)
  const bidEl=document.getElementById('obBids');
  if(bidEl) bidEl.innerHTML=topBids.map(([p,q])=>{
    const pf=parseFloat(p), qf=parseFloat(q), vf=pf*qf;
    const barW=Math.round(qf/maxQ*100);
    return `<div class="ob-row">
      <span class="ob-qty">${fmtQ(q)}</span>
      <span class="ob-price-bid">${fmtP(pf)}</span>
      <span class="ob-qty right">${fmtV(vf)}</span>
      <div class="ob-bar-bid" style="width:${barW}%"></div>
    </div>`;
  }).join('');

  // Depth ratio
  const totalBid=topBids.reduce((s,[,q])=>s+parseFloat(q)*parseFloat(bids[topBids.indexOf([,q])]?.[0]||0),0);
  const totalAsk=topAsks.reduce((s,[,q])=>s+parseFloat(q)*parseFloat(asks[topAsks.indexOf([,q])]?.[0]||0),0);
  // Đơn giản hơn: cộng USDT value
  const bidUSDT=topBids.reduce((s,[p,q])=>s+parseFloat(p)*parseFloat(q),0);
  const askUSDT=topAsks.reduce((s,[p,q])=>s+parseFloat(p)*parseFloat(q),0);
  const totalUSDT=bidUSDT+askUSDT||1;
  const bidPct=Math.round(bidUSDT/totalUSDT*100);
  const askPct=100-bidPct;
  const dbid=document.getElementById('obDepthBid'); if(dbid) dbid.style.width=bidPct+'%';
  const dask=document.getElementById('obDepthAsk'); if(dask) dask.style.width=askPct+'%';
  const bpEl=document.getElementById('obBidPct'); if(bpEl) bpEl.textContent=bidPct+'% Mua';
  const apEl=document.getElementById('obAskPct'); if(apEl) apEl.textContent='Bán '+askPct+'%';
}

/* ═══════════════════════════════════════════════════
   AI DỰ ĐOÁN XU HƯỚNG — Chart Panel
═══════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════
   BÁO CÁO THỊ TRƯỜNG HÀNG NGÀY — AI
═══════════════════════════════════════════════════ */
let dailyReportGenerated=false;

async function generateDailyReport(){
  const btn=document.getElementById('drBtn');
  const content=document.getElementById('drContent');
  const dateEl=document.getElementById('drDate');
  if(btn){btn.disabled=true; btn.textContent='⏳ Đang phân tích...';}

  const now=new Date();
  const dateStr=now.toLocaleDateString('vi-VN',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Ho_Chi_Minh'});
  if(dateEl) dateEl.textContent=dateStr;
  if(content) content.innerHTML='<div class="dr-loading"><div class="spinner" style="width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0"></div>Đang phân tích dữ liệu thị trường...</div>';
  await new Promise(r=>setTimeout(r,400));

  try{
    const all=SYMBOLS.map(s=>({sym:s,base:s.replace('USDT',''),...coins[s]})).filter(c=>c.price>0);
    if(all.length<5) throw new Error('Chưa có đủ dữ liệu giá — vui lòng chờ dữ liệu load');
    const sorted=[...all].sort((a,b)=>chg(b.sym)-chg(a.sym));
    const topG=sorted.slice(0,5);
    const topVol=[...all].sort((a,b)=>kvol(b.sym)-kvol(a.sym)).slice(0,5);
    const upCount=all.filter(c=>chg(c.sym)>0).length;
    const dnCount=all.filter(c=>chg(c.sym)<0).length;
    const totalVol=all.reduce((s,c)=>s+kvol(c.sym),0);
    const btc=coins['BTCUSDT']||{};
    const eth=coins['ETHUSDT']||{};
    const btcChg=chg('BTCUSDT'); const ethChg=chg('ETHUSDT');
    const fgNum=parseInt(document.getElementById('fgNum')?.textContent)||50;
    const fgLabelTxt=document.getElementById('fgLabel')?.textContent||'—';
    const bullRatio=upCount/(upCount+dnCount||1);

    // ── Tâm lý ──
    let mood,moodColor,moodEmoji;
    if(fgNum>=70&&bullRatio>0.6&&btcChg>2){mood='Tích cực';moodColor='var(--green)';moodEmoji='🟢';}
    else if(fgNum<=30&&bullRatio<0.4&&btcChg<-2){mood='Tiêu cực';moodColor='var(--red)';moodEmoji='🔴';}
    else if(btcChg>0&&bullRatio>0.5){mood='Thận trọng tích cực';moodColor='var(--gold)';moodEmoji='🟡';}
    else if(btcChg<0&&bullRatio<0.5){mood='Thận trọng tiêu cực';moodColor='var(--orange)';moodEmoji='🟠';}
    else{mood='Hỗn hợp';moodColor='var(--muted)';moodEmoji='⚪';}

    // ── Headline ──
    let headline;
    if(Math.abs(btcChg)>5) headline=`BTC ${btcChg>0?'bứt phá +':'lao dốc '}${Math.abs(btcChg).toFixed(1)}% — Thị trường ${mood.toLowerCase()}`;
    else if(upCount>dnCount*2) headline=`Altcoin bùng nổ — ${upCount}/${all.length} coin xanh, tâm lý ${mood.toLowerCase()}`;
    else if(dnCount>upCount*2) headline=`Áp lực bán lan rộng — chỉ ${upCount}/${all.length} coin giữ được sắc xanh`;
    else headline=`Thị trường phân hóa — BTC ${btcChg>=0?'+':''}${btcChg.toFixed(2)}%, tâm lý ${mood.toLowerCase()}`;

    // ── Overview ──
    const overview=`${moodEmoji} Hôm nay ghi nhận <strong>${upCount} coin tăng / ${dnCount} coin giảm</strong> với tổng KL giao dịch <strong>${fmtB(totalVol)}</strong>. Chỉ Số Tham Lam & Sợ Hãi Index ở mức <strong>${fgNum} — ${fgLabelTxt}</strong>.`;

    // ── BTC analysis ──
    let btcTxt;
    if(btcChg>5) btcTxt=`📈 <strong>BTC</strong> tăng mạnh <strong style="color:var(--green)">+${btcChg.toFixed(2)}%</strong> lên ${fmtP(btc.price)} — tín hiệu bullish, altcoin thường theo sau.`;
    else if(btcChg>2) btcTxt=`📊 <strong>BTC</strong> tăng nhẹ <strong style="color:var(--green)">+${btcChg.toFixed(2)}%</strong> lên ${fmtP(btc.price)} — xu hướng tích cực nhưng cần theo dõi thêm.`;
    else if(btcChg>-2) btcTxt=`⏸ <strong>BTC</strong> đi ngang quanh ${fmtP(btc.price)} (${btcChg.toFixed(2)}%) — thị trường đang tích lũy, chưa có tín hiệu rõ ràng.`;
    else if(btcChg>-5) btcTxt=`📉 <strong>BTC</strong> điều chỉnh <strong style="color:var(--red)">${btcChg.toFixed(2)}%</strong> về ${fmtP(btc.price)} — pullback bình thường hoặc cảnh báo giảm.`;
    else btcTxt=`🔴 <strong>BTC</strong> lao dốc <strong style="color:var(--red)">${btcChg.toFixed(2)}%</strong> xuống ${fmtP(btc.price)} — rủi ro cao, quản lý vốn chặt.`;

    // ── Watchlist ──
    const watchlist=[];
    topG.slice(0,2).forEach(c=>{if(chg(c.sym)>3) watchlist.push(`${c.base} +${chg(c.sym).toFixed(1)}%`);});
    topVol.filter(c=>c.base!=='BTC'&&c.base!=='ETH').slice(0,2).forEach(c=>watchlist.push(`${c.base} Vol ${fmtB(kvol(c.sym))}`));

    // ── Caution ──
    let caution;
    if(fgNum>=75) caution=`F&G ở vùng Tham Lam Cực Độ (${fgNum}) — không FOMO, đặt stop-loss chặt.`;
    else if(fgNum<=25) caution=`Thị trường Sợ Hãi Cực Độ (${fgNum}) — cơ hội tích lũy dần nhưng đừng bắt dao rơi.`;
    else if(dnCount>upCount*1.5) caution=`${dnCount}/${all.length} coin đang giảm — áp lực bán lan rộng, ưu tiên bảo vệ vốn.`;
    else caution=`Không có tín hiệu cực đoan — duy trì kỷ luật, tránh over-trading và đòn bẩy cao.`;

    // ── Outlook ──
    let outlook;
    if(mood==='Tích cực') outlook=`🔭 Ngắn hạn thiên tích cực — theo dõi BTC giữ trên ${fmtP(Math.round(btc.price*0.97))}.`;
    else if(mood==='Tiêu cực') outlook=`🔭 Thận trọng 24–48h tới — chờ tín hiệu đảo chiều xác nhận trước khi vào lệnh.`;
    else outlook=`🔭 Thị trường cần thêm xác nhận — giao dịch theo xu hướng nhỏ, không overtrading.`;

    content.innerHTML=`
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;line-height:1.4;">${headline}</div>
      <div class="dr-metrics">
        <div class="dr-metric"><div class="dr-metric-val" style="color:${btcChg>=0?'var(--green)':'var(--red)'}">${btcChg>=0?'+':''}${btcChg.toFixed(2)}%</div><div class="dr-metric-lbl">BTC hôm nay</div></div>
        <div class="dr-metric"><div class="dr-metric-val">${upCount}<span style="color:var(--green)">↑</span> ${dnCount}<span style="color:var(--red)">↓</span></div><div class="dr-metric-lbl">Tăng / Giảm</div></div>
        <div class="dr-metric"><div class="dr-metric-val" style="color:${moodColor}">${mood}</div><div class="dr-metric-lbl">Tâm lý</div></div>
        <div class="dr-metric"><div class="dr-metric-val" style="color:${fgNum>=60?'var(--green)':fgNum<=40?'var(--red)':'var(--gold)'}">${fgNum}</div><div class="dr-metric-lbl">${fgLabelTxt}</div></div>
      </div>
      <div style="font-size:11px;line-height:1.7;color:var(--text2);margin-bottom:7px;">${overview}</div>
      <div style="font-size:11px;line-height:1.7;color:var(--text2);margin-bottom:8px;">${btcTxt}</div>
      ${watchlist.length?`<div style="margin-bottom:8px;"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:5px;">👀 Theo Dõi Hôm Nay</div><div style="display:flex;gap:5px;flex-wrap:wrap;">${watchlist.map(w=>`<span style="font-size:10px;background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.15);border-radius:5px;padding:3px 9px;color:var(--accent);">${w}</span>`).join('')}</div></div>`:''}
      <div style="font-size:11px;color:var(--text2);border-top:1px solid var(--border);padding-top:8px;line-height:1.65;">
        <span style="color:var(--red);font-weight:700;">⚠️</span> ${caution}<br>${outlook}
      </div>
      <div style="font-size:9px;color:rgba(100,116,139,.4);margin-top:8px;text-align:right;">⚡ Phân tích từ dữ liệu realtime · Không phải lời khuyên tài chính</div>`;
    dailyReportGenerated=true;
  }catch(e){
    if(content) content.innerHTML=`<div style="color:var(--red);font-size:11px;">⚠️ ${e.message}</div>`;
  }finally{
    if(btn){btn.disabled=false; btn.textContent='🔄 Tạo Lại';}
  }
}

// Auto-tạo báo cáo khi vào tab Tin Tức lần đầu nếu có đủ dữ liệu
function maybeTriggerDailyReport(){
  if(!dailyReportGenerated&&SYMBOLS.length>10) generateDailyReport();
}

/* ═══════════════════════════════════════════════════
   PRICE ALERT SYSTEM
═══════════════════════════════════════════════════ */
let alerts=[];
try{alerts=JSON.parse(localStorage.getItem('vlc_alerts')||'[]');}catch(e){alerts=[];}
let alertSelectedSym=null;

function saveAlerts(){try{localStorage.setItem('vlc_alerts',JSON.stringify(alerts));}catch(e){}}

function onAlertCoinInput(){
  const q=document.getElementById('alertCoinInput').value.toUpperCase().trim();
  alertSelectedSym=null;
  const el=document.getElementById('alertCurrentPrice'); if(el) el.value='';
  if(!q){hideSuggest(); return;}
  const matches=SYMBOLS
    .map(s=>({sym:s,base:s.replace('USDT',''),...coins[s]}))
    .filter(c=>c.base.startsWith(q)||(nameMap[c.base]||'').toUpperCase().includes(q))
    .sort((a,b)=>b.vol-a.vol).slice(0,8);
  if(!matches.length){hideSuggest(); return;}
  const sl=document.getElementById('suggestList');
  sl.innerHTML=matches.map(c=>`
    <div class="suggest-item" onmousedown="selectAlertCoin('${c.sym}')">
      ${logoHTML(c.base,22)}
      <div><div class="suggest-sym">${c.base}</div><div style="font-size:10px;color:var(--muted)">${nameMap[c.base]||c.base}</div></div>
      <div class="suggest-price">${fmtP(c.price)}</div>
    </div>`).join('');
  sl.classList.add('show');
}

function selectAlertCoin(sym){
  alertSelectedSym=sym;
  const base=sym.replace('USDT','');
  const inp=document.getElementById('alertCoinInput'); if(inp) inp.value=base+' — '+(nameMap[base]||base);
  const cur=document.getElementById('alertCurrentPrice'); if(cur) cur.value=(coins[sym]?.price||0).toPrecision(6);
  hideSuggest();
  const price=coins[sym]?.price||0;
  const cond=document.getElementById('alertCondition')?.value;
  const priceInp=document.getElementById('alertPrice');
  if(price&&priceInp&&!priceInp.value){
    priceInp.value=(cond==='above'?price*1.05:price*0.95).toPrecision(6);
  }
}

function hideSuggest(){const sl=document.getElementById('suggestList'); if(sl) sl.classList.remove('show');}

// Cập nhật giá hiện tại trong form mỗi 2s
setInterval(()=>{
  if(alertSelectedSym&&coins[alertSelectedSym]){
    const el=document.getElementById('alertCurrentPrice');
    if(el) el.value=(coins[alertSelectedSym].price||0).toPrecision(6);
  }
},2000);

function addAlert(){
  if(!alertSelectedSym){showToast('warning','⚠️ Chưa chọn coin','Vui lòng chọn coin từ danh sách gợi ý.'); return;}
  const targetRaw=parseFloat(document.getElementById('alertPrice')?.value);
  if(!targetRaw||targetRaw<=0){showToast('warning','⚠️ Giá không hợp lệ','Vui lòng nhập giá mục tiêu lớn hơn 0.'); return;}
  const condition=document.getElementById('alertCondition')?.value||'above';
  const note=(document.getElementById('alertNote')?.value||'').trim();
  const base=alertSelectedSym.replace('USDT','');
  const currentPrice=coins[alertSelectedSym]?.price||0;
  if(condition==='above'&&targetRaw<=currentPrice){
    showToast('warning','⚠️ Giá mục tiêu không hợp lệ',`Giá hiện tại ${fmtP(currentPrice)}. Cảnh báo "vượt lên" cần mục tiêu CAO hơn giá hiện tại.`); return;
  }
  if(condition==='below'&&targetRaw>=currentPrice){
    showToast('warning','⚠️ Giá mục tiêu không hợp lệ',`Giá hiện tại ${fmtP(currentPrice)}. Cảnh báo "rớt xuống" cần mục tiêu THẤP hơn giá hiện tại.`); return;
  }
  alerts.unshift({id:Date.now(),sym:alertSelectedSym,base,name:nameMap[base]||base,condition,target:targetRaw,note,createdAt:Date.now(),createdPrice:currentPrice,status:'active',triggeredAt:null});
  saveAlerts();
  ['alertCoinInput','alertPrice','alertNote','alertCurrentPrice'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
  alertSelectedSym=null;
  renderAlertList();
  showToast('success','✅ Cảnh báo đã được tạo',`${base}: ${condition==='above'?'Tăng lên':'Giảm xuống'} ${fmtP(targetRaw)}`);
}

function deleteAlert(id){alerts=alerts.filter(a=>a.id!==id); saveAlerts(); renderAlertList();}

function clearTriggeredAlerts(){
  const before=alerts.length;
  alerts=alerts.filter(a=>a.status!=='triggered'); saveAlerts(); renderAlertList();
  const removed=before-alerts.length;
  if(removed>0) showToast('success','🗑 Đã xoá',`${removed} cảnh báo đã kích hoạt.`);
}

// Kiểm tra alert cho 1 sym cụ thể (gọi từ WS onmessage — realtime)
function checkAlertForSym(sym){
  let changed=false;
  alerts.forEach(a=>{
    if(a.sym!==sym||a.status!=='active') return;
    const c=coins[sym]; if(!c||!c.price) return;
    const triggered=a.condition==='above'?c.price>=a.target:c.price<=a.target;
    if(triggered){
      a.status='triggered'; a.triggeredAt=Date.now(); changed=true;
      playAlertSound();
      showToast('triggered','🔔 Cảnh Báo Kích Hoạt!',
        `${a.name} (${a.base}) ${a.condition==='above'?'📈 vượt lên':'📉 rớt xuống'} ${fmtP(a.target)}\nGiá hiện tại: ${fmtP(c.price)}`);
    }
  });
  if(changed){saveAlerts(); renderAlertList();}
}

// checkAlerts — chỉ check các sym có alert active (không duyệt tất cả SYMBOLS)
function checkAlerts(){
  const activeSyms=new Set(alerts.filter(a=>a.status==='active').map(a=>a.sym));
  activeSyms.forEach(s=>checkAlertForSym(s));
  if(document.getElementById('page-alert')?.classList.contains('active')) updateAlertPrices();
}
setInterval(checkAlerts,3000); // giảm 5s→3s vì check nhẹ hơn

function updateAlertPrices(){
  alerts.forEach(a=>{
    const curEl=document.getElementById(`alert-cur-${a.id}`);
    const progEl=document.getElementById(`alert-prog-${a.id}`);
    if(!curEl||!progEl) return;
    const c=coins[a.sym]; if(!c||!c.price) return;
    curEl.textContent='Hiện tại: '+fmtP(c.price);
    const created=a.createdPrice||c.price;
    let pct=0;
    if(a.condition==='above'&&a.target>created) pct=(c.price-created)/(a.target-created)*100;
    else if(a.condition==='below'&&a.target<created) pct=(created-c.price)/(created-a.target)*100;
    progEl.style.width=Math.max(0,Math.min(100,pct)).toFixed(1)+'%';
  });
}

function renderAlertList(){
  const setEl=(id,v)=>{const e=document.getElementById(id); if(e) e.textContent=v;};
  setEl('alertCountActive',alerts.filter(a=>a.status==='active').length);
  setEl('alertCountTriggered',alerts.filter(a=>a.status==='triggered').length);
  setEl('alertCountTotal',alerts.length);
  const container=document.getElementById('alertListContainer');
  if(!container) return;
  if(!alerts.length){
    container.innerHTML='<div class="alert-empty"><div class="alert-empty-icon">🔔</div><div>Chưa có cảnh báo nào.<br><small>Thêm cảnh báo để theo dõi biến động giá.</small></div></div>';
    return;
  }
  container.innerHTML=alerts.map(a=>{
    const c=coins[a.sym]||{};
    const isAbove=a.condition==='above', isTrig=a.status==='triggered';
    const created=a.createdPrice||c.price||0;
    let pct=0;
    if(c.price){
      if(isAbove&&a.target>created) pct=(c.price-created)/(a.target-created)*100;
      else if(!isAbove&&a.target<created) pct=(created-c.price)/(created-a.target)*100;
    }
    const progColor=isAbove?'var(--green)':'var(--red)';
    const condLabel=isAbove?'▲ Vượt lên':'▼ Rớt xuống';
    const dateStr=new Date(a.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    const trigStr=a.triggeredAt?'✅ '+new Date(a.triggeredAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    return `<div class="alert-item" id="alert-${a.id}">
      <div class="alert-coin-info">${logoHTML(a.base,26)}<div><div style="font-weight:700;font-size:12px">${a.base}</div><div style="font-size:9px;color:var(--muted)">${a.name}</div></div></div>
      <div>
        <span class="alert-badge ${a.condition}">${condLabel}</span>
        <div class="alert-target">${fmtP(a.target)}</div>
        <div class="alert-current" id="alert-cur-${a.id}">Hiện tại: ${fmtP(c.price||0)}</div>
        ${a.note?`<div class="alert-note">📝 ${a.note}</div>`:''}
      </div>
      <div class="alert-progress">
        <div style="font-size:9px;color:var(--muted)">${isTrig?trigStr:dateStr}</div>
        <div class="alert-prog-bar"><div class="alert-prog-fill" id="alert-prog-${a.id}" style="width:${Math.max(0,Math.min(100,pct)).toFixed(1)}%;background:${progColor}"></div></div>
        <div style="font-size:9px;color:var(--muted);margin-top:3px">${Math.max(0,Math.min(100,pct)).toFixed(0)}% đến mục tiêu</div>
      </div>
      <span class="alert-status ${a.status}">${isTrig?'✅ Đã kích hoạt':'⏳ Đang theo dõi'}</span>
      <button class="alert-delete" onclick="deleteAlert(${a.id})" title="Xoá">✕</button>
    </div>`;
  }).join('');
}

function playAlertSound(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [523,659,784,1047].forEach((freq,i)=>{
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value=freq; osc.type='sine';
      const t=ctx.currentTime+i*0.12;
      gain.gain.setValueAtTime(0,t);
      gain.gain.linearRampToValueAtTime(0.3,t+0.04);
      gain.gain.exponentialRampToValueAtTime(0.001,t+0.3);
      osc.start(t); osc.stop(t+0.3);
    });
  }catch(e){}
}

function showToast(type,title,msg){
  const wrap=document.getElementById('toastWrap'); if(!wrap) return;
  const id='toast-'+Date.now();
  const icons={success:'✅',warning:'⚠️',triggered:'🔔'};
  const div=document.createElement('div');
  div.className=`toast ${type}`; div.id=id;
  div.innerHTML=`<div class="toast-icon">${icons[type]||'ℹ️'}</div><div class="toast-body"><div class="toast-title">${title}</div><div class="toast-msg">${msg.replace(/\n/g,'<br>')}</div></div><button class="toast-close" onclick="removeToast('${id}')">×</button>`;
  wrap.appendChild(div);
  setTimeout(()=>removeToast(id),type==='triggered'?12000:5000);
}
function removeToast(id){
  const el=document.getElementById(id); if(!el) return;
  el.classList.add('removing'); setTimeout(()=>el.remove(),300);
}

function copyBankAcc(){
  navigator.clipboard.writeText('02406850401').then(()=>{
    showToast('success','✅ Đã sao chép!','Số tài khoản <strong>0240 6850 401</strong> đã được sao chép.');
  }).catch(()=>{
    const el=document.getElementById('bankAccNum');
    if(el){const r=document.createRange(); r.selectNode(el); window.getSelection().removeAllRanges(); window.getSelection().addRange(r); document.execCommand('copy'); window.getSelection().removeAllRanges(); showToast('success','✅ Đã sao chép!','Số tài khoản đã được sao chép.');}
  });
}

/* ═══════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════ */
function showPage(id,el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id)?.classList.add('active');
  if(el) el.classList.add('active');
  // Highlight stab- button
  const stabId='stab-'+id;
  const stabEl=document.getElementById(stabId);
  if(stabEl) stabEl.classList.add('active');
  document.querySelectorAll('.sub-tab').forEach(t=>{if(t.id!==stabId) t.classList.remove('active');});
  if(id==='chart')     renderChartCoinList();
  if(id==='news')      { renderNewsPage(); maybeTriggerDailyReport(); }
  if(id==='ai'&&SYMBOLS.length&&!aiScores.length) runAISignals();
  if(id==='heatmap')   setTimeout(renderHeatmap, 100);
  if(id==='sentiment') setTimeout(loadSentiment, 50);
  if(id==='portfolio') renderPortfolio();
  if(id==='events')    { if(!eventsData.length) loadEvents(); else renderEvents(); }


}


/* ═══════════════════════════════════════════════════════════════
   🤖 AI PHÂN TÍCH & TÍN HIỆU — JAVASCRIPT
   Tích hợp Claude API (claude-sonnet-4-20250514)
   Tính năng 1: AI Signal Dashboard
   Tính năng 2: AI Chat Tư Vấn
   Tính năng 3: AI News Analyzer
═══════════════════════════════════════════════════════════════ */

/* ── STATE AI ── */
let aiScores=[];         // [{sym,base,score,signal,factors,rsi,macd,bb,vol,chg}]
let aiTabMode='top-buy'; // top-buy | top-sell | all-scores
/* ── API KEY MANAGEMENT ── */
function getApiKey(){ try{return localStorage.getItem('vlc_anthropic_key')||'';}catch(e){return '';} }
function saveApiKey(val){
  const key=val.trim();
  if(key) try{localStorage.setItem('vlc_anthropic_key',key);}catch(e){}
  else try{localStorage.removeItem('vlc_anthropic_key');}catch(e){}
  // Sync tất cả UI key inputs + status
  _syncApiKeyUI(key);
}
function onDrApiKeyInput(val){
  // Gọi từ ô nhập key trong tab Tin Tức
  saveApiKey(val);
}
function _syncApiKeyUI(key){
  // Tab AI Phân Tích
  const inp=document.getElementById('aiApiKeyInput');
  const st=document.getElementById('aiApiKeyStatus');
  if(inp && !inp.matches(':focus')) inp.value=key;
  if(st){ st.textContent=key?'✅ Đã lưu':'Chưa có key'; st.style.color=key?'var(--green)':'var(--muted)'; }
  // Tab Tin Tức
  const drInp=document.getElementById('drApiKeyInput');
  const drSt=document.getElementById('drApiKeyStatus');
  if(drInp && !drInp.matches(':focus')) drInp.value=key;
  if(drSt){ drSt.textContent=key?'✅ Đã lưu':'Chưa có key'; drSt.style.color=key?'var(--green)':'var(--muted)'; }
}
function initApiKeyUI(){
  const k=getApiKey();
  _syncApiKeyUI(k);
}
function anthropicHeaders(){
  return {
    'Content-Type':'application/json',
    'x-api-key': getApiKey(),
    'anthropic-version':'2023-06-01',
    'anthropic-dangerous-direct-browser-access':'true'
  };
}

let chatHistory=[];      // [{role,content}]
let aiChatBusy=false;
let aiSignalBusy=false;

/* ═══════════════════════════════════════════
   TÍNH NĂNG 1: AI SIGNAL DASHBOARD
   Tính điểm AI tổng hợp 0-100 cho từng coin
═══════════════════════════════════════════ */

/* Hàm tính AI Score đa chiều */
function calcAIScore(sym){
  const c=coins[sym];
  if(!c||!c.price) return null;
  const base=sym.replace('USDT','');
  const rc=rsiCache[sym];
  let score=50; // bắt đầu từ 50 (trung lập)
  const factors=[];

  /* ── 1. RSI (max ±20 điểm) ── */
  if(rc?.rsi!=null){
    const rsi=rc.rsi;
    if(rsi<25){score+=20; factors.push({label:'RSI Quá Bán',type:'pos'});}
    else if(rsi<35){score+=12; factors.push({label:'RSI Thấp',type:'pos'});}
    else if(rsi<45){score+=5;}
    else if(rsi>75){score-=20; factors.push({label:'RSI Quá Mua',type:'neg'});}
    else if(rsi>65){score-=12; factors.push({label:'RSI Cao',type:'neg'});}
    else if(rsi>55){score-=5;}
    else{factors.push({label:'RSI Trung Lập',type:'neu'});}
  }

  /* ── 2. MACD (max ±18 điểm) ── */
  if(rc?.macd){
    const m=rc.macd;
    if(m.cross==='bull'){score+=18; factors.push({label:'MACD Cắt Lên',type:'pos'});}
    else if(m.cross==='bear'){score-=18; factors.push({label:'MACD Cắt Xuống',type:'neg'});}
    else if(m.hist>0&&m.macd>0){score+=8; factors.push({label:'MACD Dương',type:'pos'});}
    else if(m.hist<0&&m.macd<0){score-=8; factors.push({label:'MACD Âm',type:'neg'});}
  }

  /* ── 3. Bollinger Bands (max ±12 điểm) ── */
  if(rc?.bb&&c.price){
    const {upper,lower,middle}=rc.bb;
    const bw=upper-lower;
    const pos=(c.price-lower)/(upper-lower||1); // 0=đáy BB, 1=đỉnh BB
    if(pos<0.15){score+=12; factors.push({label:'Dưới BB',type:'pos'});}
    else if(pos<0.35){score+=6;}
    else if(pos>0.85){score-=12; factors.push({label:'Trên BB',type:'neg'});}
    else if(pos>0.65){score-=6;}
    // BB squeeze (biến động thấp → sắp bứt phá)
    if(middle>0&&bw/middle<0.05){score+=5; factors.push({label:'BB Thu Hẹp',type:'pos'});}
  }

  /* ── 4. Volume & Momentum (max ±15 điểm) ── */
  const baseline=volBaseline[sym]||c.vol;
  const volRatio=baseline>0?c.vol/baseline:1;
  if(volRatio>1.5&&chg(sym)>0){score+=15; factors.push({label:'Vol Đột Biến+',type:'pos'});}
  else if(volRatio>1.2&&chg(sym)>0){score+=8; factors.push({label:'Vol Tăng',type:'pos'});}
  else if(volRatio>1.5&&chg(sym)<0){score-=10; factors.push({label:'Vol Đột Biến-',type:'neg'});}
  else if(volRatio<0.6){score-=5; factors.push({label:'Vol Thấp',type:'neg'});}

  /* ── 5. Price Momentum 24h (max ±12 điểm) ── */
  const chgVN=chg(sym); // UTC+7 — dùng helper toàn cục
  if(chgVN>15){score+=12; factors.push({label:'+'+chgVN.toFixed(1)+'%',type:'pos'});}
  else if(chgVN>8){score+=8;}
  else if(chgVN>3){score+=4;}
  else if(chgVN<-15){score-=12; factors.push({label:chgVN.toFixed(1)+'%',type:'neg'});}
  else if(chgVN<-8){score-=8;}
  else if(chgVN<-3){score-=4;}

  /* ── 6. Sparkline Trend (max ±8 điểm) ── */
  const h=hist[sym]||[];
  if(h.length>=5){
    const half=Math.floor(h.length/2);
    const avgRecent=h.slice(half).reduce((a,b)=>a+b,0)/(h.length-half);
    const avgOld=h.slice(0,half).reduce((a,b)=>a+b,0)/half;
    if(avgOld>0){
      const trend=(avgRecent-avgOld)/avgOld*100;
      if(trend>2){score+=8; factors.push({label:'Xu Hướng↑',type:'pos'});}
      else if(trend<-2){score-=8; factors.push({label:'Xu Hướng↓',type:'neg'});}
    }
  }

  /* ── 7. Chỉ Số Tham Lam & Sợ Hãi context (max ±5 điểm) ── */
  const fgEl=document.getElementById('fgNum');
  const fgVal=fgEl?parseInt(fgEl.textContent)||50:50;
  if(fgVal<30&&chgVN<0){score+=5; factors.push({label:'F&G Cực Sợ',type:'pos'});} // cơ hội
  else if(fgVal>75&&chgVN>10){score-=5; factors.push({label:'F&G Tham Lam',type:'neg'});} // cảnh báo

  score=Math.max(0,Math.min(100,Math.round(score)));

  let signal='hold';
  if(score>=80) signal='strong-buy';
  else if(score>=60) signal='buy';
  else if(score<=20) signal='strong-sell';
  else if(score<=40) signal='sell';

  return{sym,base,score,signal,factors:factors.slice(0,4),
    rsi:rc?.rsi,macdCross:rc?.macd?.cross,macdHist:rc?.macd?.hist,
    vol:c.vol,change24h:chgVN,price:c.price,volRatio};
}

async function runAISignals(){
  if(aiSignalBusy) return;
  aiSignalBusy=true;
  const btn=document.getElementById('aiRefreshBtn');
  if(btn){btn.disabled=true; btn.textContent='⏳ Đang phân tích...';}
  document.getElementById('aiSignalTable').innerHTML=
    '<div class="state-box"><div class="spinner" style="width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite"></div><div>AI đang tính điểm cho tất cả coin...</div></div>';

  // Fetch indicators cho top 80 coin nếu chưa có
  const need=SYMBOLS.slice(0,80).filter(s=>!rsiCache[s]||Date.now()-rsiCache[s].ts>5*60*1000);
  for(let i=0;i<Math.min(need.length,50);i++){
    if(i>0) await new Promise(r=>setTimeout(r,100));
    await fetchIndicators(need[i]);
  }

  // Tính điểm cho tất cả coin có đủ dữ liệu
  aiScores=SYMBOLS
    .map(s=>calcAIScore(s))
    .filter(s=>s&&s.price>0&&s.vol>500000) // lọc coin quá nhỏ
    .sort((a,b)=>b.score-a.score);

  // Cập nhật summary
  const sb=aiScores.filter(s=>s.signal==='strong-buy').length;
  const b=aiScores.filter(s=>s.signal==='buy').length;
  const h=aiScores.filter(s=>s.signal==='hold').length;
  const se=aiScores.filter(s=>s.signal==='sell').length;
  const ss=aiScores.filter(s=>s.signal==='strong-sell').length;
  document.getElementById('sumStrongBuy').textContent=sb;
  document.getElementById('sumBuy').textContent=b;
  document.getElementById('sumHold').textContent=h;
  document.getElementById('sumSell').textContent=se;
  document.getElementById('sumStrongSell').textContent=ss;

  renderAITable();
  if(btn){btn.disabled=false; btn.textContent='🔄 Cập Nhật';}
  aiSignalBusy=false;
  }

function setAITab(el,mode){
  document.querySelectorAll('.ai-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active'); aiTabMode=mode; renderAITable();
}

/* ── AI Predictions cache cho bảng AI tab ── */
const aiPredCache={}; // sym → {signal, prob_up, prob_down, ts}
let aiPredRunning=false;

function renderAIPredCell(sym){
  const p=aiPredCache[sym];
  if(!p) return `<button onclick="event.stopPropagation();requestAIPred('${sym}')" style="font-size:9px;padding:2px 7px;border-radius:4px;border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer;font-family:Cambria,serif;" title="Dự đoán AI 24h">Phân tích</button>`;
  const col=p.signal==='TĂNG MẠNH'||p.signal==='TĂNG'?'var(--green)':p.signal==='GIẢM MẠNH'||p.signal==='GIẢM'?'var(--red)':'var(--gold)';
  const arrow=p.signal==='TĂNG MẠNH'?'🚀':p.signal==='TĂNG'?'📈':p.signal==='GIẢM MẠNH'?'🔴':p.signal==='GIẢM'?'📉':'⚖️';
  return `<div title="↑${p.prob_up}% ⚖${p.prob_neutral}% ↓${p.prob_down}%\n${p.summary||''}" style="cursor:help;text-align:center;">
    <div style="font-size:11px;font-weight:700;color:${col}">${arrow} ${p.signal}</div>
    <div style="font-size:9px;color:var(--muted);margin-top:1px;">↑${p.prob_up}% / ↓${p.prob_down}%</div>
  </div>`;
}

async function requestAIPred(sym){
  if(aiPredCache[sym]) return;
  const cv=coins[sym]||{};
  if(!rsiCache[sym]) await fetchIndicators(sym);
  const rc=rsiCache[sym]||{};
  const score=calcAIScore(sym);
  const s=score||{score:50,signal:'hold'};

  // Tính prob từ score (0–100) dùng hàm sigmoid-like
  const raw=s.score;
  let prob_up, prob_down, prob_neutral;
  if(raw>=70){prob_up=Math.round(40+(raw-70)*2);prob_down=Math.max(5,100-prob_up-15);prob_neutral=100-prob_up-prob_down;}
  else if(raw<=30){prob_down=Math.round(40+(30-raw)*2);prob_up=Math.max(5,100-prob_down-15);prob_neutral=100-prob_up-prob_down;}
  else{prob_neutral=Math.round(35+(raw>50?raw-50:50-raw));prob_up=Math.round((100-prob_neutral)*(raw/100));prob_down=100-prob_up-prob_neutral;}
  // Normalize
  const tot=prob_up+prob_neutral+prob_down||100;
  prob_up=Math.round(prob_up/tot*100); prob_down=Math.round(prob_down/tot*100); prob_neutral=100-prob_up-prob_down;

  const SIG_MAP={'strong-buy':'TĂNG MẠNH','buy':'TĂNG','hold':'TRUNG LẬP','sell':'GIẢM','strong-sell':'GIẢM MẠNH'};
  const signal=SIG_MAP[s.signal]||'TRUNG LẬP';

  // Summary từ factors
  const posF=(s.factors||[]).filter(f=>f.type==='pos').map(f=>f.label).join(', ');
  const negF=(s.factors||[]).filter(f=>f.type==='neg').map(f=>f.label).join(', ');
  const base=sym.replace('USDT','');
  let summary;
  if(s.signal==='strong-buy'||s.signal==='buy')
    summary=`${base} có điểm kỹ thuật cao (${raw}/100)${posF?', tín hiệu: '+posF:''}.`;
  else if(s.signal==='strong-sell'||s.signal==='sell')
    summary=`${base} cho tín hiệu giảm (điểm ${raw}/100)${negF?', chú ý: '+negF:''}.`;
  else
    summary=`${base} đang trung lập (điểm ${raw}/100), chờ thêm xác nhận từ thị trường.`;

  aiPredCache[sym]={signal, prob_up, prob_neutral, prob_down, summary, ts:Date.now()};
  renderAITable();
  }

// Nút "Dự đoán tất cả" — phân tích top 30 coin song song (rate limit friendly)
async function runAllAIPreds(){
  const btn=document.getElementById('runAllAIPredsBtn');
  if(btn){btn.disabled=true; btn.textContent='⏳ Đang phân tích...';}
  const toProcess=aiScores.slice(0,30).map(s=>s.sym).filter(s=>!aiPredCache[s]);
  // batch 3 cùng lúc
  for(let i=0;i<toProcess.length;i+=3){
    const batch=toProcess.slice(i,i+3);
    await Promise.allSettled(batch.map(s=>requestAIPred(s)));
    if(i+3<toProcess.length) await new Promise(r=>setTimeout(r,800));
  }
  if(btn){btn.disabled=false; btn.textContent='🤖 Dự Đoán 30 Coin';}
  }

function renderAITable(){
  if(!aiScores.length) return;
  let list=[...aiScores];
  if(aiTabMode==='top-buy') list=list.filter(s=>s.signal==='strong-buy'||s.signal==='buy').slice(0,40);
  else if(aiTabMode==='top-sell') list=list.filter(s=>s.signal==='strong-sell'||s.signal==='sell').sort((a,b)=>a.score-b.score).slice(0,40);
  else list=list.slice(0,150);

  const cntEl=document.getElementById('aiScoreCount');
  if(cntEl) cntEl.textContent=list.length+' coin';
  const tbl=document.getElementById('aiSignalTable');
  if(!tbl) return;
  if(!list.length){tbl.innerHTML='<div class="state-box"><div>Không có coin phù hợp bộ lọc</div></div>';return;}

  const SIG={
    'strong-buy':'🚀 Mua Mạnh','buy':'📈 Nên Mua',
    'hold':'⏸ Chờ','sell':'📉 Nên Bán','strong-sell':'🔴 Bán Mạnh'
  };
  const SC=s=>s>=80?'#00e676':s>=60?'#06b6d4':s<=20?'#ff3d57':s<=40?'#fb923c':'#f59e0b';

  const rows=list.map((c,i)=>{
    const sc=SC(c.score);
    // Donut SVG (circumference ~100 for r=16)
    const circ=100.5; // 2*PI*16
    const off=circ-(c.score/100*circ);
    const factHtml=(c.factors||[]).slice(0,3).map(f=>`<span class="af ${f.type}">${f.label}</span>`).join('');
    const rsiStr=c.rsi!=null?c.rsi.toFixed(0):'—';
    const rsiCol=c.rsi>70?'var(--red)':c.rsi<30?'var(--green)':'var(--text2)';
    const macdStr=c.macdCross==='bull'?'<span style="color:var(--green)">▲ Tăng</span>':c.macdCross==='bear'?'<span style="color:var(--red)">▼ Giảm</span>':c.macdHist>0?'<span style="color:var(--green)">+</span>':'<span style="color:var(--red)">−</span>';
    const volStr=c.volRatio>=1.5?`<span style="color:var(--orange);font-weight:700">${c.volRatio.toFixed(1)}×</span>`:c.volRatio?`<span style="color:var(--text2)">${c.volRatio.toFixed(1)}×</span>`:'—';
    const _cchg=chg(c.sym); const chgCol=_cchg>=0?'var(--green)':'var(--red)';
    return `<tr onclick="openChart('${c.sym}')">
      <td><span class="rank">${i+1}</span></td>
      <td><div class="coin-cell">${logoHTML(c.base,26)}<div><div class="cn">${nameMap[c.base]||c.base}</div><div class="cs">${c.base}</div></div></div></td>
      <td class="r">
        <div style="display:inline-flex;align-items:center;justify-content:flex-end;gap:6px;">
          <div class="ai-donut">
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="4"/>
              <circle cx="20" cy="20" r="16" fill="none" stroke="${sc}" stroke-width="4"
                stroke-dasharray="${circ}" stroke-dashoffset="${off.toFixed(1)}"
                stroke-linecap="round" transform="rotate(-90 20 20)"/>
            </svg>
            <div class="ai-donut-label" style="color:${sc}">${c.score}</div>
          </div>
        </div>
      </td>
      <td class="r"><span class="ai-sig ${c.signal}">${SIG[c.signal]||c.signal}</span></td>
      <td class="r"><span style="color:${chgCol};font-weight:700;font-size:11px">${chg(c.sym)>=0?'+':''}${chg(c.sym).toFixed(2)}%</span></td>
      <td class="r"><span style="color:${rsiCol};font-size:11px;font-weight:600">${rsiStr}</span></td>
      <td class="r" style="font-size:11px">${macdStr}</td>
      <td class="r">${volStr}</td>
      <td class="r hide-sm"><div class="ai-factors">${factHtml}</div></td>
      <td class="r">${renderAIPredCell(c.sym)}</td>
    </tr>`;
  }).join('');

  tbl.innerHTML=`<table>
    <thead><tr>
      <th style="width:32px;padding-left:14px">#</th>
      <th>Coin</th>
      <th class="r" style="min-width:60px">Điểm</th>
      <th class="r">Tín Hiệu</th>
      <th class="r">24h %</th>
      <th class="r">RSI</th>
      <th class="r">MACD</th>
      <th class="r">Vol ×</th>
      <th class="r hide-sm">Lý Do</th>
      <th class="r" style="min-width:80px">Dự Đoán 24h</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function getMarketContext(){
  const all=SYMBOLS.map(s=>({sym:s,base:s.replace('USDT',''),...coins[s]})).filter(c=>c.price>0);
  if(!all.length) return '';
  const tv=all.reduce((s,c)=>s+kvol(c.sym),0);
  const up=all.filter(c=>chg(c.sym)>0).length;
  const dn=all.filter(c=>chg(c.sym)<0).length;
  const sorted=[...all].sort((a,b)=>chg(b.sym)-chg(a.sym));
  const topG=sorted.slice(0,5).map(c=>`${c.base}(+${chg(c.sym).toFixed(1)}%)`).join(', ');
  const topL=sorted.slice(-5).map(c=>`${c.base}(${chg(c.sym).toFixed(1)}%)`).join(', ');
  const btc=all.find(c=>c.base==='BTC');
  const eth=all.find(c=>c.base==='ETH');
  const sol=all.find(c=>c.base==='SOL');
  const fgEl=document.getElementById('fgNum');
  const fgLbl=document.getElementById('fgLabel');
  const fgVal=fgEl?fgEl.textContent:'—';
  const fgLabel=fgLbl?fgLbl.textContent:'—';

  // Top AI scores nếu có
  let aiTop='';
  if(aiScores.length){
    const topBuy=aiScores.filter(s=>s.signal==='strong-buy'||s.signal==='buy').slice(0,5)
      .map(s=>`${s.base}(score:${s.score})`).join(', ');
    const topSell=aiScores.filter(s=>s.signal==='strong-sell'||s.signal==='sell').slice(0,3)
      .map(s=>`${s.base}(score:${s.score})`).join(', ');
    aiTop=`\nAI Score cao nhất: ${topBuy}\nAI Score thấp nhất: ${topSell}`;
  }

  return `=== DỮ LIỆU THỊ TRƯỜNG REALTIME (UTC+7) ===
Tổng KL hôm nay (VN): ${fmtB(tv)} | Coin tăng: ${up} | Coin giảm: ${dn}
BTC: ${btc?fmtP(btc.price)+' ('+chg('BTCUSDT').toFixed(2)+'%)':'—'}
ETH: ${eth?fmtP(eth.price)+' ('+chg('ETHUSDT').toFixed(2)+'%)':'—'}
SOL: ${sol?fmtP(sol.price)+' ('+chg('SOLUSDT').toFixed(2)+'%)':'—'}
Chỉ Số Tham Lam & Sợ Hãi: ${fgVal} (${fgLabel})
Top tăng: ${topG}
Top giảm: ${topL}${aiTop}`;
}

function buildSystemPrompt(){
  return `Bạn là AI tư vấn đầu tư crypto của VietLongCrypto — một chuyên gia phân tích kỹ thuật và thị trường tiền điện tử có kinh nghiệm. Bạn LUÔN trả lời bằng tiếng Việt, ngắn gọn, súc tích, và có cấu trúc rõ ràng.

Phong cách trả lời:
- Sử dụng emoji để làm nổi bật điểm quan trọng
- Chia câu trả lời thành các phần nhỏ dễ đọc
- Luôn đưa ra quan điểm cụ thể, không mơ hồ
- Đề xuất hành động rõ ràng: Mua / Bán / Chờ / Tích lũy
- Nêu mức rủi ro và stop-loss khi đề xuất mua
- Kết thúc bằng disclaimer ngắn nếu đề xuất cụ thể

${getMarketContext()}

Lưu ý quan trọng: Đây là công cụ hỗ trợ phân tích, không phải lời khuyên tài chính chính thức. Người dùng tự chịu trách nhiệm về quyết định đầu tư của mình.`;
}

async function sendChat(){
  const input=document.getElementById('chatInput');
  const msg=(input?.value||'').trim();
  if(!msg||aiChatBusy) return;
  input.value=''; input.style.height='auto';
  await sendMessage(msg);
}

function quickAsk(question){
  document.getElementById('chatInput').value=question;
  sendChat();
}

async function sendMessage(userMsg){
  if(aiChatBusy) return;
  aiChatBusy=true;
  const sendBtn=document.getElementById('chatSendBtn');
  if(sendBtn) sendBtn.disabled=true;
  appendChatMsg('user',userMsg);
  const typingId='typing-'+Date.now();
  appendTyping(typingId);
  await new Promise(r=>setTimeout(r,600));

  try{
    const reply=ruleBasedChat(userMsg);
    removeTyping(typingId);
    appendChatMsg('ai',reply);
  }catch(e){
    removeTyping(typingId);
    appendChatMsg('ai','⚠️ Có lỗi xảy ra, vui lòng thử lại.');
  }
  aiChatBusy=false;
  if(sendBtn) sendBtn.disabled=false;
}

function ruleBasedChat(msg){
  const m=msg.toLowerCase();
  const all=SYMBOLS.map(s=>({sym:s,base:s.replace('USDT',''),...coins[s]})).filter(c=>c.price>0);
  const btc=coins['BTCUSDT']||{}; const eth=coins['ETHUSDT']||{};
  const btcChg=chg('BTCUSDT'); const ethChg=chg('ETHUSDT');
  const fgNum=parseInt(document.getElementById('fgNum')?.textContent)||50;
  const sorted=[...all].sort((a,b)=>chg(b.sym)-chg(a.sym));
  const upCount=all.filter(c=>chg(c.sym)>0).length;
  const dnCount=all.filter(c=>chg(c.sym)<0).length;

  // ── Nhận diện coin cụ thể ──
  const mentionedCoin=SYMBOLS.find(s=>{
    const base=s.replace('USDT','').toLowerCase();
    const name=(nameMap[s.replace('USDT','')]||'').toLowerCase();
    return m.includes(base)||m.includes(name);
  });

  // ── Tổng quan thị trường ──
  if(/tổng quan|thị trường|hôm nay|tình hình|market/.test(m)){
    const mood=fgNum>=60?'tích cực':(fgNum<=40?'tiêu cực':'trung lập');
    return `📊 **Tổng quan thị trường hôm nay:**\n\n🔸 BTC: ${fmtP(btc.price)} (${btcChg>=0?'+':''}${btcChg.toFixed(2)}%)\n🔸 ETH: ${fmtP(eth.price)} (${ethChg>=0?'+':''}${ethChg.toFixed(2)}%)\n🔸 Chỉ Số Tham Lam & Sợ Hãi: ${fgNum} — ${document.getElementById('fgLabel')?.textContent||'—'}\n🔸 Coin tăng: ${upCount} | Giảm: ${dnCount}\n\nTâm lý thị trường hiện tại **${mood}**. ${fgNum>=70?'Cẩn thận vùng tham lam cao — rủi ro điều chỉnh tăng.':fgNum<=30?'Vùng sợ hãi — có thể là cơ hội tích lũy dài hạn.':'Chưa có tín hiệu cực đoan, giao dịch cẩn thận.'}\n\n_💡 Dùng nút "Tổng quan" để xem phân tích chi tiết hơn._`;
  }

  // ── Phân tích coin cụ thể ──
  if(mentionedCoin||(/(phân tích|analyze|xem|check|rsi|macd)/.test(m)&&!/top|danh|list/.test(m))){
    const sym=mentionedCoin||'BTCUSDT';
    const base=sym.replace('USDT','');
    const c=coins[sym]||{}; const rc=rsiCache[sym];
    const cChg=chg(sym);
    if(!c.price) return `⚠️ Chưa có dữ liệu cho ${base}. Vui lòng chờ dữ liệu load hoặc click vào coin trong tab Biểu Đồ.`;
    const score=calcAIScore(sym)||{score:50,signal:'hold',factors:[]};
    let signal='';
    if(score.signal==='strong-buy') signal='🚀 **Mua Mạnh** — Tín hiệu kỹ thuật rất tích cực';
    else if(score.signal==='buy') signal='📈 **Nên Xem Xét Mua** — Các chỉ báo hỗ trợ xu hướng tăng';
    else if(score.signal==='sell') signal='📉 **Cẩn Thận** — Chỉ báo cho tín hiệu giảm';
    else if(score.signal==='strong-sell') signal='🔴 **Tránh / Cân Nhắc Bán** — Áp lực giảm mạnh';
    else signal='⏸ **Chờ Xem** — Chưa có tín hiệu rõ ràng';

    const rsiTxt=rc?.rsi?`RSI(14): ${rc.rsi.toFixed(1)} ${rc.rsi>70?'(Quá mua ⚠️)':rc.rsi<30?'(Quá bán ✅)':'(Trung lập)'}`:null;
    const macdTxt=rc?.macd?`MACD: ${rc.macd.cross==='bull'?'Giao cắt lên ✅':rc.macd.cross==='bear'?'Giao cắt xuống ⚠️':rc.macd.hist>0?'Histogram dương':'Histogram âm'}`:null;
    const indLines=[rsiTxt,macdTxt].filter(Boolean).map(t=>`🔹 ${t}`).join('\n');

    return `🔍 **Phân tích ${nameMap[base]||base} (${base}/USDT)**\n\n💰 Giá: ${fmtP(c.price)} (${cChg>=0?'+':''}${cChg.toFixed(2)}%)\n📊 Điểm kỹ thuật: **${score.score}/100**\n${signal}\n\n${indLines?indLines+'\n\n':''}${(score.factors||[]).length?'**Yếu tố:**\n'+score.factors.map(f=>`${f.type==='pos'?'✅':f.type==='neg'?'❌':'➖'} ${f.label}`).join('\n')+'\n\n':''}_⚠️ Đây là phân tích kỹ thuật tự động, không phải lời khuyên đầu tư. DYOR!_`;
  }

  // ── Top coin tăng/giảm ──
  if(/(top|tăng nhất|tăng mạnh|gainer|pump)/.test(m)&&!/(giảm|bán|sell|bear)/.test(m)){
    const top=sorted.slice(0,7);
    return `🚀 **Top coin tăng hôm nay:**\n\n${top.map((c,i)=>`${i+1}. **${c.base}** +${chg(c.sym).toFixed(2)}% — ${fmtP(c.price)}`).join('\n')}\n\n_Click vào coin trong tab Biểu Đồ để phân tích chi tiết._`;
  }
  if(/(giảm nhất|giảm mạnh|loser|dump|bán|sell)/.test(m)){
    const bot=sorted.slice(-7).reverse();
    return `📉 **Top coin giảm hôm nay:**\n\n${bot.map((c,i)=>`${i+1}. **${c.base}** ${chg(c.sym).toFixed(2)}% — ${fmtP(c.price)}`).join('\n')}\n\n_Cẩn thận với coin đang giảm mạnh — kiểm tra volume và tin tức trước khi vào lệnh._`;
  }

  // ── BTC/ETH specific ──
  if(/(btc|bitcoin)/.test(m)){
    return `₿ **Bitcoin (BTC)**\n\n💰 Giá: ${fmtP(btc.price)}\n📈 Hôm nay: ${btcChg>=0?'+':''}${btcChg.toFixed(2)}%\n🌡️ F&G: ${fgNum}\n\n${btcChg>3?'BTC đang có đà tăng tốt. Altcoin thường tăng theo sau khi BTC dẫn dắt.':btcChg<-3?'BTC đang điều chỉnh. Thận trọng với altcoin trong giai đoạn này.':'BTC đi ngang — thị trường đang tìm hướng. Theo dõi breakout khỏi vùng tích lũy.'}\n\n_Dùng tab Biểu Đồ để xem chart BTCUSDT chi tiết._`;
  }

  // ── Chỉ Số Tham Lam & Sợ Hãi ──
  if(/(fear|greed|tâm lý|sợ|tham lam|f.g|fng)/.test(m)){
    const advice=fgNum>=75?'⚠️ Cực kỳ tham lam — lịch sử cho thấy đây là vùng rủi ro cao. Cân nhắc chốt lời một phần.':fgNum>=55?'Tham lam nhẹ — thị trường đang tích cực nhưng đừng FOMO.':fgNum<=25?'✅ Cực kỳ sợ hãi — cơ hội tích lũy dài hạn. Warren Buffett: "Mua khi người khác sợ hãi."':fgNum<=45?'Sợ hãi nhẹ — thị trường thận trọng. Cơ hội tốt cho người kiên nhẫn.':'Trung lập — không có tín hiệu cực đoan.';
    return `😨😍 **Chỉ Số Tham Lam & Sợ Hãi Index: ${fgNum}**\n📊 Trạng thái: _${document.getElementById('fgLabel')?.textContent||'—'}_\n\n${advice}`;
  }

  // ── Volume / whale ──
  if(/(volume|khối lượng|vol|whale|cá voi|đột biến)/.test(m)){
    const topV=sorted.map(c=>({...c,vol:kvol(c.sym)})).sort((a,b)=>b.vol-a.vol).slice(0,5);
    return `🐋 **Khối lượng giao dịch hôm nay:**\n\n${topV.map((c,i)=>`${i+1}. **${c.base}**: ${fmtB(c.vol)}`).join('\n')}\n\n_Volume lớn thường đi kèm với chuyển động giá mạnh. Dùng tab Bộ Lọc Coin → Whale Detector để xem tín hiệu cá voi._`;
  }

  // ── Chiến lược / lời khuyên ──
  if(/(chiến lược|strategy|nên làm|làm gì|đầu tư|portfolio|danh mục)/.test(m)){
    const bullish=btcChg>2&&upCount>dnCount;
    const bearish=btcChg<-2&&dnCount>upCount;
    return `💼 **Chiến lược tham khảo hôm nay:**\n\n${bullish?`🟢 **Thị trường đang tích cực:**\n✅ BTC/ETH: Giữ position hoặc mua thêm vùng hỗ trợ\n✅ Altcoin: Theo dõi coin có RSI chưa quá mua\n⚠️ Đặt stop-loss và không dùng đòn bẩy cao`:bearish?`🔴 **Thị trường đang tiêu cực:**\n✅ Ưu tiên USDT / giảm exposure\n✅ Không bắt đáy vội — đợi tín hiệu đảo chiều\n✅ Nếu giữ coin, đặt stop-loss nghiêm túc`:`⚪ **Thị trường hỗn hợp:**\n✅ Giao dịch theo xu hướng nhỏ\n✅ Không over-invest một lệnh\n✅ Kiểm tra chỉ báo kỹ thuật trước khi vào lệnh`}\n\n_⚠️ Đây là phân tích tự động — DYOR và tự chịu trách nhiệm về quyết định đầu tư._`;
  }

  // ── Greet / hello ──
  if(/(xin chào|hello|hi|hey|chào|alo)/.test(m)){
    return `👋 Xin chào! Tôi là trợ lý phân tích crypto của **VietLongCrypto**.\n\nTôi có thể giúp bạn:\n📊 **Tổng quan thị trường** — hỏi "thị trường hôm nay thế nào?"\n🔍 **Phân tích coin** — hỏi "phân tích BTC" hoặc "ETH có nên mua không?"\n🚀 **Top coin** — hỏi "coin tăng nhất hôm nay"\n😨 **Tâm lý** — hỏi "Chỉ Số Tham Lam & Sợ Hãi bao nhiêu?"\n💼 **Chiến lược** — hỏi "nên làm gì hôm nay?"\n\n_Hoặc dùng các nút gợi ý phía trên!_ 👆`;
  }

  // ── Default fallback ──
  const upTrend=btcChg>0&&upCount>dnCount;
  return `🤖 Tôi hiểu bạn hỏi về: _"${msg}"_\n\n📊 **Tóm tắt nhanh thị trường:**\nBTC ${btcChg>=0?'+':''}${btcChg.toFixed(2)}% | ${upCount} coin tăng / ${dnCount} coin giảm | F&G: ${fgNum}\n\n${upTrend?'Xu hướng hiện tại thiên về tích cực.':'Thị trường đang thận trọng.'}\n\n💡 **Thử hỏi cụ thể hơn:**\n• "Phân tích BTC hôm nay"\n• "Top 5 coin tăng mạnh nhất"\n• "Thị trường hôm nay thế nào?"\n• "Chiến lược đầu tư hôm nay"`;
}


function appendChatMsg(role,text){
  const body=document.getElementById('chatBody');
  if(!body) return;
  const now=new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
  const isAI=role==='ai';
  const div=document.createElement('div');
  div.className=`chat-msg ${role}`;
  // Convert markdown-like formatting
  const formatted=text
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/\n/g,'<br>');
  div.innerHTML=`
    <div class="chat-avatar ${isAI?'ai-av':'user-av'}">${isAI?'🤖':'👤'}</div>
    <div>
      <div class="chat-bubble">${formatted}</div>
      <div class="chat-time">${now}</div>
    </div>`;
  body.appendChild(div);
  body.scrollTop=body.scrollHeight;
}

function appendTyping(id){
  const body=document.getElementById('chatBody');
  if(!body) return;
  const div=document.createElement('div');
  div.className='chat-msg ai'; div.id=id;
  div.innerHTML=`<div class="chat-avatar ai-av">🤖</div><div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>`;
  body.appendChild(div);
  body.scrollTop=body.scrollHeight;
}

function removeTyping(id){
  const el=document.getElementById(id);
  if(el) el.remove();
}

function clearChat(){
  chatHistory=[];
  const body=document.getElementById('chatBody');
  if(!body) return;
  body.innerHTML=`<div class="chat-msg ai">
    <div class="chat-avatar ai-av">🤖</div>
    <div><div class="chat-bubble">Chat đã được xóa. Tôi sẵn sàng tư vấn cho bạn! 🚀</div><div class="chat-time">Vừa xong</div></div>
  </div>`;
}

/* ═══════════════════════════════════════════
   TÍNH NĂNG 3: AI PHÂN TÍCH TIN TỨC
   Dùng Claude API để phân tích impact lên giá
═══════════════════════════════════════════ */





/* ══════════════════════════════════════════════════════
   CORRELATION MATRIX — Pearson trên daily close prices
══════════════════════════════════════════════════════ */



/* ══════════════════════════════════════════════════
   FUNDING RATE + LONG/SHORT RATIO (Binance Futures)
══════════════════════════════════════════════════ */

const FUNDING_SYMBOLS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT',
  'DOGEUSDT','ADAUSDT','AVAXUSDT','DOTUSDT','MATICUSDT'];

async function loadFundingRate(){
  const el = document.getElementById('fundingList');
  if(!el) return;
  try{
    // Binance Futures API: funding rate
    const r = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex',
      {signal:AbortSignal.timeout(8000)});
    if(!r.ok) throw 0;
    const data = await r.json();
    
    // Lọc top coins theo funding rate (absolute value)
    const filtered = data
      .filter(d=>FUNDING_SYMBOLS.includes(d.symbol))
      .sort((a,b)=>Math.abs(parseFloat(b.lastFundingRate))-Math.abs(parseFloat(a.lastFundingRate)));
    
    if(!filtered.length) throw new Error('no data');
    
    el.innerHTML = filtered.map(d=>{
      const rate = parseFloat(d.lastFundingRate)*100;
      const cls  = rate>0.01?'up':rate<-0.01?'down':'neu';
      const sym  = d.symbol.replace('USDT','');
      const sign = rate>0?'+':'';
      const nextTime = d.nextFundingTime ? 
        new Date(d.nextFundingTime).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) : '--';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--surface2);border-radius:6px;">
        <span style="font-size:11px;font-weight:700;color:var(--text);width:40px">${sym}</span>
        <span style="font-size:12px;font-weight:800;color:${rate>0.01?'#22c55e':rate<-0.01?'#ef4444':'#94a3b8'}">${sign}${rate.toFixed(4)}%</span>
        <span style="font-size:9px;color:var(--muted)">⏱ ${nextTime}</span>
      </div>`;
    }).join('');
    
    const ut = document.getElementById('fundingUpdateTime');
    if(ut) ut.textContent = new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
    
  }catch(e){
    if(el) el.innerHTML='<div style="text-align:center;padding:14px;color:var(--muted);font-size:11px">Không tải được dữ liệu futures</div>';
  }
}

async function loadLongShort(){
  const el = document.getElementById('lsList');
  if(!el) return;
  try{
    // Binance: global Long/Short Account Ratio
    const syms = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'];
    const results = await Promise.allSettled(syms.map(async sym=>{
      const r = await fetch(
        `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`,
        {signal:AbortSignal.timeout(6000)});
      if(!r.ok) throw 0;
      const d = await r.json();
      return {sym: sym.replace('USDT',''), ...d[0]};
    }));
    
    const rows = results
      .filter(r=>r.status==='fulfilled'&&r.value)
      .map(r=>r.value);
    
    if(!rows.length) throw new Error('no data');
    
    el.innerHTML = rows.map(d=>{
      const ratio  = parseFloat(d.longShortRatio)||1;
      const longPct  = parseFloat(d.longAccount)*100||50;
      const shortPct = parseFloat(d.shortAccount)*100||50;
      const longCls  = longPct>55?'#22c55e':longPct<45?'#ef4444':'#94a3b8';
      return `<div style="padding:5px 8px;background:var(--surface2);border-radius:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:11px;font-weight:700;color:var(--text)">${d.sym}</span>
          <span style="font-size:10px;color:var(--muted)">L/S: ${ratio.toFixed(2)}</span>
        </div>
        <div style="height:5px;border-radius:3px;background:#ef444433;overflow:hidden">
          <div style="height:100%;width:${longPct.toFixed(1)}%;background:#22c55e;border-radius:3px;transition:width .5s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:2px">
          <span style="font-size:9px;color:#22c55e">Long ${longPct.toFixed(1)}%</span>
          <span style="font-size:9px;color:#ef4444">Short ${shortPct.toFixed(1)}%</span>
        </div>
      </div>`;
    }).join('');
    
    const ut = document.getElementById('lsUpdateTime');
    if(ut) ut.textContent = new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
    
  }catch(e){
    if(el) el.innerHTML='<div style="text-align:center;padding:14px;color:var(--muted);font-size:11px">Không tải được L/S ratio</div>';
  }
}

/* ═══════════════════════════════════════════════════
   BOOT — khởi động tất cả chức năng
═══════════════════════════════════════════════════ */
initApiKeyUI();               // khởi tạo UI API key từ localStorage
  // Suppress LWC internal async errors
window.addEventListener('unhandledrejection', e=>{
  if(e.reason&&e.reason.message&&e.reason.message.includes('payload')) e.preventDefault();
});
window.addEventListener('beforeunload',()=>{try{if(typeof sock!=='undefined'&&sock?.readyState<2)sock.close();}catch(e){}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&typeof obWs!=='undefined'&&obWs?.readyState<2){try{obWs.close();}catch(e){}}});
renderAlertList();            // render alerts từ localStorage ngay lập tức
loadAllCoins();               // Binance 24hr REST → SYMBOLS, coins, rồi WS
// Interval re-sort + đảm bảo bảng luôn được build nếu chưa có
setInterval(()=>{
  if(!_tableBuilt){ _forceFullRender(); return; } // build nếu chưa có
  if(sortCol==='vol'||sortCol==='change24h'||sortCol==='price'){
    _forceFullRender(); // re-sort vì thứ tự coin có thể đổi
  }
}, 6000);
loadFearGreed();
loadGlobalMarket();
loadFundingRate();                                // Funding Rate Binance Futures
loadLongShort();                                  // Long/Short Ratio
setInterval(loadFearGreed, 5*60*1000);
setInterval(loadGlobalMarket, 5*60*1000);
setInterval(loadFundingRate, 5*60*1000);          // Refresh funding rate mỗi 5p
setInterval(loadLongShort, 5*60*1000);            // Refresh L/S mỗi 5p // refresh mỗi 5 phút
setTimeout(()=>{              // Sau 3s: fetch news (đợi page load xong)
  fetchNews();
  setInterval(fetchNews, 5*60*1000);
}, 3000);
setTimeout(batchFetchIndicators, 10000);          // Sau 10s: fetch RSI/MACD top 50
setInterval(batchFetchIndicators, 15*60*1000);    // Refresh indicators mỗi 15 phút (tối ưu)


/* ════════════════════════════════════
   VN SHARED: State + CORS + Fetch
════════════════════════════════════ */


setInterval(()=>{
},60*1000);


/* ── MARKET SWITCHER ── */
let currentMarket = 'crypto';


/* showPage đã tích hợp đầy đủ ở hàm gốc bên trên */

/* ══════════════════════════════════════════════════
   1. VN CHART — Biểu đồ nến cổ phiếu
══════════════════════════════════════════════════ */
let vnChart=null, vnCandleSeries=null, vnVolSeries=null;
let vnSelectedSym='', vnCurrentTf='D';
const vnRsiCache={};

// Danh sách tất cả cổ phiếu (VN30 + HNX top)




/* ═══════════════════════════════════════════════════════════════
   1. HEATMAP
═══════════════════════════════════════════════════════════════ */
function renderHeatmap(){
  const grid = document.getElementById('heatmapGrid');
  if(!grid) return;
  const sizeBy  = document.getElementById('hmSizeBy')?.value  || 'vol';
  const colorBy = document.getElementById('hmColorBy')?.value || '24h';

  const list = SYMBOLS.map(s=>{
    const b = s.replace('USDT','');
    const d = coins[s]||{};
    return {sym:s, base:b, price:d.price||0, vol:d.vol||0, chg24:chg(s)};
  }).filter(d=>d.price>0);

  if(!list.length){
    grid.innerHTML='<div class="hm-loading"><span>Đang chờ dữ liệu thị trường...</span></div>';
    return;
  }

  // Gán size value
  list.forEach(d=>{
    d.sizeVal = sizeBy==='equal' ? 1
              : sizeBy==='mcap'  ? (d.vol * 1.8 + d.price * 1000)
              : d.vol;
    if(!d.sizeVal || d.sizeVal<=0) d.sizeVal = 0.001;
  });

  // Sắp xếp giảm dần để treemap đẹp hơn
  list.sort((a,b)=>b.sizeVal - a.sizeVal);

  const W = grid.clientWidth  || grid.offsetWidth  || 900;
  const H = grid.clientHeight || grid.offsetHeight || 520;
  if(W < 10 || H < 10) return;

  const totalVal = list.reduce((s,d)=>s+d.sizeVal, 0);
  list.forEach(d=>{ d.norm = d.sizeVal / totalVal; });

  // Squarified treemap algorithm
  const rects = squarify(list, {x:0, y:0, w:W, h:H});

  const PAD = 2; // px gap between cells
  grid.innerHTML = rects.map(r=>{
    const d   = r.item;
    const cv  = colorBy==='24h' ? d.chg24
              : colorBy==='1h'  ? d.chg24 * 0.4
              : (d.vol / (list[0].vol||1)) * 20 - 5;
    const bg  = heatColor(cv);
    const sign = d.chg24>=0?'+':'';
    const cellW = Math.max(0, r.w - PAD);
    const cellH = Math.max(0, r.h - PAD);
    // Chỉ hiện text nếu ô đủ lớn
    const showSym   = cellW > 38 && cellH > 28;
    const showPct   = cellW > 38 && cellH > 40;
    const showPrice = cellW > 55 && cellH > 56;
    const fontSize  = cellW < 70 ? 9 : cellW < 110 ? 10 : 11;
    return `<div class="hm-cell" style="
        position:absolute;
        left:${(r.x+PAD/2).toFixed(1)}px;top:${(r.y+PAD/2).toFixed(1)}px;
        width:${cellW.toFixed(1)}px;height:${cellH.toFixed(1)}px;
        background:${bg};font-size:${fontSize}px;"
      onclick="openChart('${d.sym}')"
      title="${d.base} • ${fmtP(d.price)} • ${sign}${d.chg24.toFixed(2)}%">
      ${showSym   ? `<div class="hm-cell-sym">${d.base.length>6?d.base.slice(0,6):d.base}</div>` : ''}
      ${showPct   ? `<div class="hm-cell-pct">${sign}${d.chg24.toFixed(2)}%</div>` : ''}
      ${showPrice ? `<div class="hm-cell-price">${fmtPShort(d.price)}</div>` : ''}
    </div>`;
  }).join('');
}

// ── Squarified Treemap (clean implementation) ──────────────────────
function squarify(items, rect){
  // Chuẩn hoá norm thành diện tích pixel
  const total = items.reduce((s,d)=>s+d.norm,0);
  const area  = rect.w * rect.h;
  items.forEach(d=>{ d._area = d.norm/total * area; });
  const out = [];
  _layoutRect(items, {x:rect.x, y:rect.y, w:rect.w, h:rect.h}, out);
  return out;
}

function _layoutRect(items, rect, out){
  if(!items.length) return;
  if(rect.w < 1 || rect.h < 1) return;
  if(items.length === 1){
    out.push({item:items[0], x:rect.x, y:rect.y, w:rect.w, h:rect.h});
    return;
  }

  // Chia thành row tốt nhất theo squarify
  let row = [items[0]], rowArea = items[0]._area;
  for(let i=1; i<items.length; i++){
    const next     = items[i];
    const newRow   = [...row, next];
    const newArea  = rowArea + next._area;
    const before   = _maxAspect(row,   rowArea,  rect.w, rect.h);
    const after    = _maxAspect(newRow, newArea,  rect.w, rect.h);
    if(after > before && row.length > 0) break;
    row     = newRow;
    rowArea = newArea;
  }

  // Đặt row vào rect
  const totalArea = rect.w * rect.h;
  const isWide    = rect.w >= rect.h;
  const rowFrac   = rowArea / totalArea;
  const rowDim    = isWide ? rect.w * rowFrac : rect.h * rowFrac;  // chiều theo hướng xếp
  const crossDim  = isWide ? rect.h : rect.w;                      // chiều vuông góc

  let off = 0;
  row.forEach(d=>{
    const frac    = d._area / rowArea;
    const cellDim = crossDim * frac;
    if(isWide){
      out.push({item:d, x:rect.x, y:rect.y+off, w:rowDim, h:cellDim});
    } else {
      out.push({item:d, x:rect.x+off, y:rect.y, w:cellDim, h:rowDim});
    }
    off += cellDim;
  });

  // Đệ quy phần còn lại
  const rest = items.slice(row.length);
  if(!rest.length) return;
  const newRect = isWide
    ? {x:rect.x+rowDim, y:rect.y,      w:rect.w-rowDim, h:rect.h}
    : {x:rect.x,        y:rect.y+rowDim, w:rect.w,      h:rect.h-rowDim};
  _layoutRect(rest, newRect, out);
}

function _maxAspect(row, rowArea, W, H){
  const isWide  = W >= H;
  const strip   = isWide ? H : W;   // chiều vuông góc (không đổi)
  const rowLen  = (W*H > 0) ? rowArea / (isWide ? H : W) : 1;
  let worst = 0;
  row.forEach(d=>{
    const cellLen = rowArea>0 ? strip*(d._area/rowArea) : 1;
    const r = rowLen>cellLen ? rowLen/cellLen : cellLen/rowLen;
    if(r>worst) worst=r;
  });
  return worst;
}


function heatColor(pct){
  if(pct>= 10) return 'rgba(22,163,74,.85)';
  if(pct>=  5) return 'rgba(34,197,94,.75)';
  if(pct>=  2) return 'rgba(74,222,128,.65)';
  if(pct>=  0) return 'rgba(20,83,45,.6)';
  if(pct>= -2) return 'rgba(127,29,29,.6)';
  if(pct>= -5) return 'rgba(185,28,28,.7)';
  if(pct>=-10) return 'rgba(220,38,38,.8)';
  return 'rgba(239,68,68,.9)';
}

// Auto-refresh heatmap every 10s when on that page
setInterval(()=>{ if(document.getElementById('page-heatmap')?.classList.contains('active')) renderHeatmap(); }, 10000);


/* ═══════════════════════════════════════════════════════════════
   5. SUPPORT & RESISTANCE  (tự động trên biểu đồ focus/chart)
═══════════════════════════════════════════════════════════════ */
function calcSupportResistance(candles, levels=5){
  if(!candles||candles.length<20) return {support:[],resistance:[]};
  const highs = candles.map(c=>c.high);
  const lows  = candles.map(c=>c.low);
  const closes= candles.map(c=>c.close);
  const curPrice = closes.at(-1);
  const range = Math.max(...highs) - Math.min(...lows);
  const zone  = range * 0.012; // 1.2% tolerance

  const pivots=[];
  for(let i=2;i<candles.length-2;i++){
    const isHigh = highs[i]>highs[i-1]&&highs[i]>highs[i-2]&&highs[i]>highs[i+1]&&highs[i]>highs[i+2];
    const isLow  = lows[i]<lows[i-1]&&lows[i]<lows[i-2]&&lows[i]<lows[i+1]&&lows[i]<lows[i+2];
    if(isHigh) pivots.push({price:highs[i], type:'high', idx:i, time:candles[i].time});
    if(isLow)  pivots.push({price:lows[i],  type:'low',  idx:i, time:candles[i].time});
  }

  // Cluster pivots that are within zone of each other
  const clusters=[];
  pivots.forEach(p=>{
    const existing = clusters.find(cl=>Math.abs(cl.price-p.price)<zone);
    if(existing){ existing.count++; existing.price=(existing.price+p.price)/2; }
    else clusters.push({price:p.price, count:1, type:p.type});
  });

  clusters.sort((a,b)=>b.count-a.count);
  const support    = clusters.filter(c=>c.price<curPrice*0.999).slice(0,levels).map(c=>c.price);
  const resistance = clusters.filter(c=>c.price>curPrice*1.001).slice(0,levels).map(c=>c.price);
  return {support, resistance};
}

function drawSRLines(chart, series, candles){
  if(!chart||!candles) return;
  const {support,resistance} = calcSupportResistance(candles);
  // Remove old SR lines
  if(window._srLines){ window._srLines.forEach(l=>{try{chart.removeSeries(l);}catch(e){}});  }
  window._srLines=[];
  const mk=(price,color)=>{
    const ls=chart.addLineSeries({color,lineWidth:1,lineStyle:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
    ls.setData(candles.map(c=>({time:c.time,value:price})));
    window._srLines.push(ls);
  };
  support.forEach(p=>mk(p,'rgba(34,197,94,.45)'));
  resistance.forEach(p=>mk(p,'rgba(239,68,68,.45)'));
}


/* ═══════════════════════════════════════════════════════════════
   6. PORTFOLIO TRACKER
═══════════════════════════════════════════════════════════════ */
let pfHoldings = JSON.parse(localStorage.getItem('vlc_portfolio')||'[]');
// [{sym,qty,buyPrice,addedAt}]

function pfSave(){ localStorage.setItem('vlc_portfolio', JSON.stringify(pfHoldings)); }

function pfToggleForm(){
  const f=document.getElementById('pfForm');
  if(!f) return;
  f.style.display = f.style.display==='none'?'block':'none';
  if(f.style.display==='block'){
    // populate datalist
    const dl=document.getElementById('pfSymList');
    if(dl) dl.innerHTML=SYMBOLS.map(s=>`<option value="${s.replace('USDT','')}">`).join('');
    document.getElementById('pfSymInput')?.focus();
  }
}

function pfAddHolding(){
  const symRaw = document.getElementById('pfSymInput')?.value.trim().toUpperCase();
  const qty    = parseFloat(document.getElementById('pfQtyInput')?.value);
  const bp     = parseFloat(document.getElementById('pfPriceInput')?.value);
  if(!symRaw||!qty||qty<=0||!bp||bp<=0){ alert('Vui lòng điền đầy đủ thông tin hợp lệ'); return; }
  const sym = symRaw.endsWith('USDT')?symRaw:symRaw+'USDT';
  if(!SYMBOLS.includes(sym)){ alert(`Không tìm thấy ${symRaw} trong danh sách. Thử nhập đầy đủ ký hiệu.`); return; }
  pfHoldings.push({sym, qty, buyPrice:bp, addedAt:Date.now()});
  pfSave();
  document.getElementById('pfSymInput').value='';
  document.getElementById('pfQtyInput').value='';
  document.getElementById('pfPriceInput').value='';
  pfToggleForm();
  renderPortfolio();
}

function pfRemove(idx){
  pfHoldings.splice(idx,1);
  pfSave();
  renderPortfolio();
}

function renderPortfolio(){
  const tbody = document.getElementById('pfTableBody');
  const perfEl= document.getElementById('pfPerfBars');
  if(!tbody) return;

  if(!pfHoldings.length){
    tbody.innerHTML='<tr><td colspan="8" class="pf-empty">Chưa có coin nào. Nhấn "+ Thêm coin" để bắt đầu.</td></tr>';
    ['pfTotalInvest','pfTotalValue','pfTotalPnl','pfTotalPct','pfDayChange'].forEach(id=>_setEl(id,'$0'));
    if(perfEl) perfEl.innerHTML='';
    renderPfPie([]);
    return;
  }

  let totalInvest=0, totalValue=0, totalDay=0;
  const rows = pfHoldings.map((h,i)=>{
    const base  = h.sym.replace('USDT','');
    const cur   = coins[h.sym]?.price||0;
    const value = cur*h.qty;
    const invest= h.buyPrice*h.qty;
    const pnl   = value-invest;
    const pct   = invest>0?(pnl/invest)*100:0;
    const dayChg= chg(h.sym);
    const dayVal= value*(dayChg/100);
    totalInvest+=invest; totalValue+=value; totalDay+=dayVal;
    const pnlCol = pnl>=0?'var(--green)':'var(--red)';
    const logo=logoMap[base]?`<img class="pf-coin-logo" src="${getLogoSrc(base)}" onerror="${getLogoOnErr(base)}">`:'';
    return `<tr>
      <td><div class="pf-coin-cell">${logo}<span>${base}</span></div></td>
      <td>${h.qty.toLocaleString('vi-VN',{maximumFractionDigits:6})}</td>
      <td>${fmtP(h.buyPrice)}</td>
      <td>${cur>0?fmtP(cur):'—'}</td>
      <td style="color:var(--text2)">${cur>0?fmtB(value):'—'}</td>
      <td style="color:${pnlCol}">${cur>0?(pnl>=0?'+':'')+fmtB(Math.abs(pnl)):'—'}</td>
      <td style="color:${pnlCol};font-size:12px">${cur>0?(pct>=0?'+':'')+pct.toFixed(2)+'%':'—'}</td>
      <td><button class="pf-del-btn" onclick="pfRemove(${i})">🗑</button></td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('');

  // Summary
  const pnlTotal = totalValue-totalInvest;
  const pctTotal = totalInvest>0?(pnlTotal/totalInvest)*100:0;
  _setEl('pfTotalInvest', fmtB(totalInvest));
  _setEl('pfTotalValue',  fmtB(totalValue), totalValue>=totalInvest?'var(--green)':'var(--red)');
  _setEl('pfTotalPnl',    (pnlTotal>=0?'+':'')+fmtB(Math.abs(pnlTotal)), pnlTotal>=0?'var(--green)':'var(--red)');
  _setEl('pfTotalPct',    (pctTotal>=0?'+':'')+pctTotal.toFixed(2)+'%', pctTotal>=0?'var(--green)':'var(--red)');
  _setEl('pfDayChange',   (totalDay>=0?'+':'')+fmtB(Math.abs(totalDay)), totalDay>=0?'var(--green)':'var(--red)');

  // Pie chart
  const pieData = pfHoldings.map(h=>{
    const cur=coins[h.sym]?.price||0;
    return {label:h.sym.replace('USDT',''), value:cur*h.qty};
  }).filter(d=>d.value>0);
  renderPfPie(pieData);

  // Perf bars
  if(perfEl){
    const perfList = pfHoldings.map(h=>{
      const cur=coins[h.sym]?.price||0;
      const pct=h.buyPrice>0?((cur-h.buyPrice)/h.buyPrice)*100:0;
      return {base:h.sym.replace('USDT',''), pct};
    }).filter(d=>coins[d.base+'USDT']?.price>0);
    const maxAbs = Math.max(...perfList.map(d=>Math.abs(d.pct)),1);
    perfEl.innerHTML = perfList.map(d=>{
      const w = Math.abs(d.pct)/maxAbs*100;
      const col = d.pct>=0?'#22c55e':'#ef4444';
      return `<div class="pf-perf-row">
        <span class="pf-perf-lbl">${d.base}</span>
        <div class="pf-perf-bar-wrap"><div class="pf-perf-bar" style="width:${w}%;background:${col}"></div></div>
        <span class="pf-perf-pct" style="color:${col}">${d.pct>=0?'+':''}${d.pct.toFixed(1)}%</span>
      </div>`;
    }).join('');
  }
}

function renderPfPie(data){
  const canvas=document.getElementById('pfPieCanvas');
  const legend=document.getElementById('pfPieLegend');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);

  if(!data.length){
    ctx.fillStyle='rgba(255,255,255,.1)';
    ctx.beginPath(); ctx.arc(W/2,H/2,70,0,Math.PI*2); ctx.fill();
    if(legend) legend.innerHTML='';
    return;
  }

  const COLORS=['#f59e0b','#22c55e','#38bdf8','#8b5cf6','#f43f5e','#06b6d4','#84cc16','#ec4899','#fb923c','#a3e635'];
  const total=data.reduce((s,d)=>s+d.value,0)||1;
  let angle=-Math.PI/2;
  const cx=W/2, cy=H/2, r=Math.min(W,H)/2-12;

  data.forEach((d,i)=>{
    const slice=(d.value/total)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,angle,angle+slice);
    ctx.closePath();
    ctx.fillStyle=COLORS[i%COLORS.length];
    ctx.fill();
    ctx.strokeStyle='#0a0e17'; ctx.lineWidth=2; ctx.stroke();
    angle+=slice;
  });
  // Donut hole
  ctx.beginPath(); ctx.arc(cx,cy,r*.5,0,Math.PI*2);
  ctx.fillStyle='#0d1117'; ctx.fill();

  if(legend) legend.innerHTML=data.map((d,i)=>`
    <div class="pf-pie-leg-item">
      <div class="pf-pie-leg-dot" style="background:${COLORS[i%COLORS.length]}"></div>
      <span style="color:var(--text2);flex:1">${d.label}</span>
      <span style="color:var(--muted);font-size:9px">${((d.value/total)*100).toFixed(1)}%</span>
    </div>`).join('');
}

// Re-render portfolio when price updates
let _pfRenderTimer=null;
const _origCoinsProxy = ()=>{ if(_pfRenderTimer) return; _pfRenderTimer=setTimeout(()=>{ _pfRenderTimer=null; if(pfHoldings.length&&document.getElementById('page-portfolio')?.classList.contains('active')) renderPortfolio(); },3000); };


/* ═══════════════════════════════════════════════════════════════
   7. EVENTS / CALENDAR
═══════════════════════════════════════════════════════════════ */
let eventsData=[], eventsCategory='all';

const STATIC_EVENTS=[
  {title:'Bitcoin Halving #5',coin:'BTC',cat:'halving',date:'2028-04-01',desc:'Block reward giảm từ 3.125 → 1.5625 BTC. Sự kiện 4 năm một lần có tác động lịch sử lớn đến giá.'},
  {title:'Ethereum Dencun Upgrade Follow-up',coin:'ETH',cat:'mainnet',date:'2025-06-01',desc:'Nâng cấp tiếp theo sau Dencun, cải thiện scalability và giảm phí gas.'},
  {title:'BTC ETF Options Expansion',coin:'BTC',cat:'listing',date:'2025-04-15',desc:'Mở rộng sản phẩm phái sinh ETF Bitcoin trên các sàn lớn.'},
  {title:'Solana Breakpoint 2025',coin:'SOL',cat:'conference',date:'2025-09-20',desc:'Hội nghị thường niên lớn nhất của hệ sinh thái Solana.'},
  {title:'Cardano Chang Hard Fork',coin:'ADA',cat:'mainnet',date:'2025-05-01',desc:'Nâng cấp governance phi tập trung hoàn toàn cho Cardano.'},
  {title:'Sui Token Unlock',coin:'SUI',cat:'unlock',date:'2025-05-03',desc:'Mở khóa 60M SUI token từ nhà đầu tư và đội ngũ sáng lập.'},
  {title:'Aptos Token Unlock',coin:'APT',cat:'unlock',date:'2025-06-12',desc:'Đợt mở khóa 24M APT theo lịch vesting định kỳ.'},
  {title:'XRP Futures Launch CME',coin:'XRP',cat:'listing',date:'2025-05-19',desc:'CME Group ra mắt hợp đồng tương lai XRP tiêu chuẩn.'},
  {title:'Binance Launchpool mới',coin:'BNB',cat:'listing',date:'2025-04-28',desc:'Binance công bố dự án launchpool tiếp theo trên nền tảng BNB.'},
  {title:'Chainlink SmartCon 2025',coin:'LINK',cat:'conference',date:'2025-10-14',desc:'Sự kiện SmartCon thường niên của Chainlink, công bố partnership mới.'},
  {title:'Polygon zkEVM v2.0',coin:'POL',cat:'mainnet',date:'2025-07-01',desc:'Ra mắt zkEVM 2.0 với throughput cao hơn 5x và chi phí thấp hơn.'},
  {title:'Avalanche Durango Upgrade',coin:'AVAX',cat:'mainnet',date:'2025-06-15',desc:'Nâng cấp cải thiện C-Chain compatibility và tăng hiệu suất subnet.'},
  {title:'Coinbase Derivatives Expansion',coin:'BTC',cat:'partnership',date:'2025-05-10',desc:'Coinbase mở rộng sản phẩm phái sinh sang 15 quốc gia mới.'},
  {title:'Uniswap v4 Full Launch',coin:'UNI',cat:'mainnet',date:'2025-05-25',desc:'Phiên bản Uniswap v4 với hooks customizable được triển khai toàn mạng.'},
  {title:'Dogecoin Core v1.21',coin:'DOGE',cat:'mainnet',date:'2025-08-01',desc:'Cập nhật core node cải thiện sync speed và bảo mật mạng.'},
];

async function loadEvents(){
  const grid=document.getElementById('eventsGrid');
  if(!grid) return;
  // Dùng dữ liệu tĩnh + CoinGecko events API
  eventsData = STATIC_EVENTS;
  try{
    const r=await cgFetch('/events?upcoming_events_only=true&per_page=50',{signal:AbortSignal.timeout(8000)});
    if(r?.ok){
      const d=await r.json();
      if(d.data?.length){
        const mapped=d.data.map(ev=>({
          title:ev.title||'Sự kiện',
          coin:ev.coins?.map(c=>c.symbol?.toUpperCase()).filter(Boolean).join(', ')||'',
          cat: ev.type?.toLowerCase().includes('conference')?'conference':
               ev.type?.toLowerCase().includes('partnership')?'partnership':
               ev.type?.toLowerCase().includes('release')||ev.type?.toLowerCase().includes('launch')?'mainnet':'listing',
          date:ev.start_date?.slice(0,10)||'',
          desc:ev.description||''
        }));
        eventsData=[...STATIC_EVENTS,...mapped].filter((e,i,a)=>a.findIndex(x=>x.title===e.title)===i);
      }
    }
  }catch(e){}
  renderEvents();
}

function filterEvents(cat, btn){
  eventsCategory=cat;
  document.querySelectorAll('.ev-filter').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderEvents();
}

function renderEvents(){
  const grid=document.getElementById('eventsGrid');
  if(!grid) return;
  const now=new Date();
  let list=eventsData.filter(e=>eventsCategory==='all'||e.cat===eventsCategory);
  list.sort((a,b)=>new Date(a.date)-new Date(b.date));

  grid.innerHTML=list.map(ev=>{
    const evDate=new Date(ev.date);
    const diff=Math.ceil((evDate-now)/(1000*60*60*24));
    const isPast=diff<0;
    const countdown=isPast?`${Math.abs(diff)} ngày trước`
      :diff===0?'Hôm nay!':diff===1?'Ngày mai':diff<30?`${diff} ngày nữa`:`${Math.ceil(diff/30)} tháng nữa`;
    const logo=ev.coin&&logoMap[ev.coin]?`<img src="${getLogoSrc(ev.coin)}" width="16" height="16" style="border-radius:50%" onerror="${getLogoOnErr(ev.coin)}">`:'';
    return `<div class="ev-card ${ev.cat}">
      <div class="ev-header">
        <div class="ev-title">${ev.title}</div>
        <span class="ev-badge ${ev.cat}">${catLabel(ev.cat)}</span>
      </div>
      ${ev.coin?`<div class="ev-coin">${logo}<span>${ev.coin}</span></div>`:''}
      <div class="ev-date">📅 ${evDate.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'})}</div>
      <div class="ev-countdown ${isPast?'past':''}">${isPast?'✓ Đã qua':countdown==='Hôm nay!'?'🔥 Hôm nay!':'⏳ '+countdown}</div>
      ${ev.desc?`<div class="ev-desc">${ev.desc}</div>`:''}
    </div>`;
  }).join('') || '<div class="hm-loading"><span>Không có sự kiện nào trong danh mục này.</span></div>';
}
function catLabel(cat){
  return {halving:'Halving',listing:'Niêm yết',unlock:'Mở khoá',mainnet:'Mainnet',partnership:'Hợp tác',conference:'Hội nghị'}[cat]||cat;
}


/* ═══════════════════════════════════════════════════════════════
   10. FOCUS MODE — Biểu đồ tập trung toàn màn hình
═══════════════════════════════════════════════════════════════ */
let focusSym='', focusTf='4h', focusLwChart=null, focusCandleSeries=null;

function filterFocusList(){
  const q=(document.getElementById('focusSearch')?.value||'').toLowerCase();
  const dd=document.getElementById('focusDropdown');
  if(!dd) return;
  if(!q){dd.style.display='none';return;}
  const hits=SYMBOLS.filter(s=>{
    const b=s.replace('USDT','');
    return b.toLowerCase().includes(q)||(nameMap[b]||'').toLowerCase().includes(q);
  }).slice(0,12);
  if(!hits.length){dd.style.display='none';return;}
  dd.innerHTML=hits.map(s=>{
    const b=s.replace('USDT','');
    const logo=logoMap[b]?`<img src="${getLogoSrc(b)}" width="18" height="18" style="border-radius:50%;object-fit:cover" onerror="${getLogoOnErr(b)}">`:'';
    return `<div class="focus-dd-item" onclick="selectFocusCoin('${s}')">${logo}<span style="font-weight:700">${b}</span><span style="color:var(--muted);margin-left:auto">${fmtP(coins[s]?.price||0)}</span></div>`;
  }).join('');
  dd.style.display='block';
}

function selectFocusCoin(sym){
  focusSym=sym;
  const dd=document.getElementById('focusDropdown');
  if(dd) dd.style.display='none';
  const inp=document.getElementById('focusSearch');
  if(inp) inp.value='';

  const base=sym.replace('USDT','');
  const d=coins[sym]||{};

  // Show coin info
  const info=document.getElementById('focusCoinInfo');
  if(info) info.style.display='flex';
  const exitBtn=document.getElementById('focusExitBtn');
  if(exitBtn) exitBtn.style.display='block';

  // Logo
  const img=document.getElementById('focusLogo');
  const fb=document.getElementById('focusLogoFb');
  if(img){
    img.onerror=()=>{img.style.display='none'; if(fb){fb.style.display='flex';fb.textContent=base[0];}};
    img.src=logoMap[base]||`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/32/color/${base.toLowerCase()}.png`;
    img.style.display='block';
    if(fb) fb.style.display='none';
  }
  _setEl('focusName', nameMap[base]||base);
  _setEl('focusSym', sym);
  updateFocusHeader();
  loadFocusChart();
}

function updateFocusHeader(){
  if(!focusSym) return;
  const d=coins[focusSym]||{};
  const c2=chg(focusSym);
  _setEl('focusPrice', fmtP(d.price));
  const chgEl=document.getElementById('focusChg');
  if(chgEl){chgEl.textContent=(c2>=0?'+':'')+c2.toFixed(2)+'%'; chgEl.className='focus-chg '+(c2>=0?'up':'dn');}
  _setEl('fsbHigh', d.high?fmtP(d.high):'—');
  _setEl('fsbLow',  d.low?fmtP(d.low):'—');
  _setEl('fsbVol',  fmtB(d.vol||0));
}

function setFocusTf(btn, tf){
  focusTf=tf;
  document.querySelectorAll('.focus-tf-btns .tf-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(focusSym) loadFocusChart();
}

async function loadFocusChart(){
  if(!focusSym) return;
  const container=document.getElementById('focusChartContainer');
  const loading=document.getElementById('focusLoading');
  if(!container) return;
  if(loading){loading.style.display='flex';loading.innerHTML='<div class="chart-spinner"></div><span>Đang tải...</span>';}

  try{
    if(focusLwChart){try{focusLwChart.remove();}catch(e){} focusLwChart=null;}
    await new Promise(r=>requestAnimationFrame(r));
    const w=container.clientWidth||window.innerWidth-40;
    const h=container.clientHeight||window.innerHeight-200;

    const res=await fetch(`https://api.binance.com/api/v3/klines?symbol=${focusSym}&interval=${focusTf}&limit=500`,{signal:AbortSignal.timeout(10000)});
    const raw=await res.json();
    const candles=raw.map(k=>({time:Math.floor(k[0]/1000),open:+k[1],high:+k[2],low:+k[3],close:+k[4]}));
    const vols=raw.map(k=>+k[5]);
    const closes=candles.map(c=>c.close);

    const p=closes.at(-1)||1;
    let prec=2,mm=0.01;
    if(p<0.0001){prec=8;mm=0.00000001;}else if(p<0.01){prec=6;mm=0.000001;}else if(p<1){prec=4;mm=0.0001;}

    focusLwChart=LightweightCharts.createChart(container,{
      layout:{background:{color:'#060810'},textColor:'#64748b',fontSize:11,fontFamily:"'SF Mono','Fira Code',monospace"},
      grid:{vertLines:{color:'rgba(255,255,255,.025)',style:1},horzLines:{color:'rgba(255,255,255,.03)',style:1}},
      crosshair:{mode:LightweightCharts.CrosshairMode.Normal,vertLine:{color:'rgba(0,212,255,.4)',labelBackgroundColor:'#060810'},horzLine:{color:'rgba(0,212,255,.4)',labelBackgroundColor:'#060810'}},
      rightPriceScale:{borderColor:'rgba(255,255,255,.06)',minimumWidth:prec>=6?110:85,autoScale:true,textColor:'#64748b'},
      timeScale:{borderColor:'rgba(255,255,255,.06)',timeVisible:true,secondsVisible:false,textColor:'#64748b',rightOffset:8,barSpacing:8},
      width:w,height:h,
    });

    focusCandleSeries=focusLwChart.addCandlestickSeries({
      upColor:'#089981',downColor:'#f23645',borderUpColor:'#089981',borderDownColor:'#f23645',wickUpColor:'#089981',wickDownColor:'#f23645',
      priceFormat:{type:'price',precision:prec,minMove:mm},priceLineVisible:true,priceLineColor:'rgba(0,212,255,.5)',priceLineWidth:1,priceLineStyle:2,
    });
    focusCandleSeries.setData(candles);

    // EMA overlays
    const mkLine=(col,dash=false)=>focusLwChart.addLineSeries({color:col,lineWidth:1,lineStyle:dash?2:0,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,priceFormat:{type:'price',precision:prec,minMove:mm}});
    const ema20=calcEMA(closes,20), ema50=calcEMA(closes,50), ema200=calcEMA(closes,200);
    const mkD=arr=>arr.map((v,i)=>v==null?null:{time:candles[i].time,value:v}).filter(Boolean);
    const l20=mkLine('#f59e0b'); l20.setData(mkD(ema20));
    const l50=mkLine('#818cf8'); l50.setData(mkD(ema50));
    const l200=mkLine('#f43f5e',true); l200.setData(mkD(ema200));

    // Volume sub-chart
    const volS=focusLwChart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'fvol',scaleMargins:{top:0.85,bottom:0}});
    focusLwChart.priceScale('fvol').applyOptions({scaleMargins:{top:0.85,bottom:0},drawTicks:false,visible:false});
    volS.setData(candles.map((c,i)=>({time:c.time,value:vols[i],color:closes[i]>=(i>0?closes[i-1]:closes[i])?'rgba(8,153,129,.5)':'rgba(242,54,69,.5)'})));

    // S/R lines
    drawSRLines(focusLwChart, focusCandleSeries, candles);

    // Resize observer
    if(window._focusResizeObs) window._focusResizeObs.disconnect();
    window._focusResizeObs=new ResizeObserver(()=>{
      if(focusLwChart&&container) focusLwChart.applyOptions({width:container.clientWidth,height:container.clientHeight||500});
    });
    window._focusResizeObs.observe(container);

    await new Promise(r=>requestAnimationFrame(r));
    focusLwChart.timeScale().setVisibleLogicalRange({from:Math.max(0,candles.length-120),to:candles.length+8});
    if(loading) loading.style.display='none';

    // Stats bar
    const statsBar=document.getElementById('focusStatsBar');
    if(statsBar) statsBar.style.display='flex';
    const ind=await fetchIndicators(focusSym);
    if(ind){
      const {rsi,macd,bb}=ind;
      _setEl('fsbRsi',  rsi.toFixed(1), rsi>70?'var(--red)':rsi<30?'var(--green)':'var(--gold)');
      _setEl('fsbMacd', macd.hist>0?'▲':' ▼', macd.hist>0?'var(--green)':'var(--red)');
      _setEl('fsbEma20', fmtPShort(ema20.filter(Boolean).at(-1)));
      _setEl('fsbEma50', fmtPShort(ema50.filter(Boolean).at(-1)));
      _setEl('fsbBbU',  fmtPShort(bb.upper));
      _setEl('fsbBbL',  fmtPShort(bb.lower));
      const sig=ind.signal;
      _setEl('fsbSignal', sig==='buy'?'✅ Mua':sig==='sell'?'🔴 Bán':'⏸ Chờ', sig==='buy'?'var(--green)':sig==='sell'?'var(--red)':'var(--gold)');
    }
  }catch(e){
    if(loading) loading.innerHTML=`<span>⚠️ Lỗi: ${e.message}</span>`;
  }
}

function exitFocusMode(){
  focusSym='';
  const info=document.getElementById('focusCoinInfo'); if(info) info.style.display='none';
  const exitBtn=document.getElementById('focusExitBtn'); if(exitBtn) exitBtn.style.display='none';
  const sb=document.getElementById('focusStatsBar'); if(sb) sb.style.display='none';
  const loading=document.getElementById('focusLoading');
  if(loading){loading.style.display='flex';loading.innerHTML='<div style="font-size:28px">📈</div><span>Chọn một coin để xem biểu đồ toàn màn hình</span>';}
  if(focusLwChart){try{focusLwChart.remove();}catch(e){} focusLwChart=null;}
}

// ── showPage hooks đã được tích hợp trực tiếp vào hàm gốc ──

// Update portfolio on WS tick
const _origWsUpdate = typeof _scheduleWhaleCheck==='function' ? _scheduleWhaleCheck : null;


/* ── Fullscreen Chart (overlay approach) ── */
let _chartFs = false;
let _fsLwChart = null;

function toggleChartFullscreen(){
  if(_chartFs) exitChartFs(); else enterChartFs();
}

function enterChartFs(){
  if(_chartFs) return;
  _chartFs = true;

  // Tạo overlay nếu chưa có
  let overlay = document.getElementById('chartFsOverlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'chartFsOverlay';
    overlay.innerHTML = `
      <div class="fs-header">
        <img id="fsLogo" width="28" height="28" style="border-radius:50%;display:none" onerror="this.style.display='none'">
        <div style="display:flex;flex-direction:column;gap:1px">
          <span id="fsCoinName" style="font-size:13px;font-weight:700;color:var(--text)">—</span>
          <span id="fsSymbol" style="font-size:10px;color:var(--muted)">—</span>
        </div>
        <span id="fsPrice" style="font-size:20px;font-weight:800;color:var(--text);margin-left:12px">—</span>
        <span id="fsChg" style="font-size:13px;font-weight:700;margin-left:8px">—</span>
        <div style="flex:1"></div>
        <div class="fs-tf-row" style="padding:0;background:none;border:none;gap:4px;">
          ${['1m','5m','15m','1h','4h','1d','1w'].map(tf=>`<button class="tf-btn${tf==='1h'?' active':''}" onclick="fsTfClick(this,'${tf}')">${tf.toUpperCase()}</button>`).join('')}
        </div>
        <button onclick="exitChartFs()" style="margin-left:12px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:6px 14px;color:#f87171;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;">✕ Thoát</button>
      </div>
      <div id="chartFsBody"></div>
      <div id="chartFsStatsBar" style="display:none">
        <div class="sb-item"><span class="sb-lbl">RSI(14)</span><span class="sb-val" id="fsSbRsi">—</span></div>
        <div class="sb-item"><span class="sb-lbl">MACD</span><span class="sb-val" id="fsSbMacd">—</span></div>
        <div class="sb-item"><span class="sb-lbl">EMA 20</span><span class="sb-val" id="fsSbEma20">—</span></div>
        <div class="sb-item"><span class="sb-lbl">EMA 50</span><span class="sb-val" id="fsSbEma50">—</span></div>
        <div class="sb-item"><span class="sb-lbl">BB Trên</span><span class="sb-val" id="fsSbBbU">—</span></div>
        <div class="sb-item"><span class="sb-lbl">BB Dưới</span><span class="sb-val" id="fsSbBbL">—</span></div>
        <div class="sb-item"><span class="sb-lbl">Cao 24h</span><span class="sb-val" id="fsSbHigh" style="color:#22c55e">—</span></div>
        <div class="sb-item"><span class="sb-lbl">Thấp 24h</span><span class="sb-val" id="fsSbLow" style="color:#ef4444">—</span></div>
        <div class="sb-item"><span class="sb-lbl">KL 24h</span><span class="sb-val" id="fsSbVol">—</span></div>
        <div class="sb-item"><span class="sb-lbl">Tín hiệu</span><span class="sb-val" id="fsSbSig">—</span></div>
      </div>`;
    document.body.appendChild(overlay);
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Đổi icon
  const icon = document.getElementById('chartFsIcon');
  if(icon) icon.innerHTML='<path d="M8 3v2H5v3H3V3h5zm9 0v5h-2V5h-3V3h5zM3 12h2v3h3v2H3v-5zm14 5h-5v-2h3v-3h2v5z"/>';
  const btn = document.getElementById('chartFsBtn');
  if(btn) btn.title='Thoát toàn màn hình (ESC)';

  // Fill header info từ coin hiện tại
  const base = selectedSym ? selectedSym.replace('USDT','') : '';
  if(base){
    const logo = document.getElementById('fsLogo');
    if(logo && logoMap[base]){ logo.src=logoMap[base]; logo.style.display='block'; }
    _setEl('fsCoinName', nameMap[base]||base);
    _setEl('fsSymbol', selectedSym);
    const d = coins[selectedSym]||{};
    _setEl('fsPrice', fmtP(d.price||0));
    const c24 = chg(selectedSym);
    const chgEl = document.getElementById('fsChg');
    if(chgEl){ chgEl.textContent=(c24>=0?'+':'')+c24.toFixed(2)+'%'; chgEl.style.color=c24>=0?'var(--green)':'var(--red)'; }
    _setEl('fsSbHigh', d.high?fmtP(d.high):'—');
    _setEl('fsSbLow',  d.low?fmtP(d.low):'—');
    _setEl('fsSbVol',  fmtB(d.vol||0));
  }

  // Vẽ chart trong overlay
  loadFsChart(selectedSym, currentTf||'1h');

  // Hint
  showFsHint();
}

function exitChartFs(){
  _chartFs = false;
  const overlay = document.getElementById('chartFsOverlay');
  if(overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  if(_fsLwChart){ try{_fsLwChart.remove();}catch(e){} _fsLwChart=null; }
  const icon = document.getElementById('chartFsIcon');
  if(icon) icon.innerHTML='<path d="M3 3h5v2H5v3H3V3zm9 0h5v5h-2V5h-3V3zM3 12h2v3h3v2H3v-5zm12 3h-3v2h5v-5h-2v3z"/>';
  const btn = document.getElementById('chartFsBtn');
  if(btn) btn.title='Toàn màn hình';
}

async function loadFsChart(sym, tf){
  const body = document.getElementById('chartFsBody');
  if(!body||!sym) return;
  // Xóa chart cũ
  if(_fsLwChart){ try{_fsLwChart.remove();}catch(e){} _fsLwChart=null; }
  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;gap:12px;color:var(--muted);font-size:13px"><div class="spinner"></div>Đang tải biểu đồ...</div>';

  try{
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${tf}&limit=500`,{signal:AbortSignal.timeout(12000)});
    const raw = await res.json();
    const candles = raw.map(k=>({time:Math.floor(k[0]/1000),open:+k[1],high:+k[2],low:+k[3],close:+k[4]}));
    const vols    = raw.map(k=>+k[5]);
    const closes  = candles.map(c=>c.close);
    const p = closes.at(-1)||1;
    let prec=2,mm=0.01;
    if(p<0.0001){prec=8;mm=0.00000001;}else if(p<0.01){prec=6;mm=0.000001;}else if(p<1){prec=4;mm=0.0001;}

    // Xóa loading, tạo div chart
    body.innerHTML = '';
    const chartDiv = document.createElement('div');
    chartDiv.id = 'chartFsContainer';
    chartDiv.style.cssText = 'width:100%;height:100%;';
    body.appendChild(chartDiv);

    await new Promise(r=>requestAnimationFrame(r));
    const W = body.clientWidth  || window.innerWidth;
    const H = body.clientHeight || (window.innerHeight - 120);

    _fsLwChart = LightweightCharts.createChart(chartDiv, {
      layout:{background:{color:'#060810'},textColor:'#64748b',fontSize:11,fontFamily:"'SF Mono','Fira Code',monospace"},
      grid:{vertLines:{color:'rgba(255,255,255,.03)',style:1},horzLines:{color:'rgba(255,255,255,.04)',style:1}},
      crosshair:{mode:LightweightCharts.CrosshairMode.Normal,
        vertLine:{color:'rgba(0,212,255,.4)',labelBackgroundColor:'#060810'},
        horzLine:{color:'rgba(0,212,255,.4)',labelBackgroundColor:'#060810'}},
      rightPriceScale:{borderColor:'rgba(255,255,255,.06)',minimumWidth:prec>=6?110:85,textColor:'#64748b'},
      timeScale:{borderColor:'rgba(255,255,255,.06)',timeVisible:true,secondsVisible:false,textColor:'#64748b',rightOffset:8,barSpacing:9},
      width:W, height:H,
    });

    const cSeries = _fsLwChart.addCandlestickSeries({
      upColor:'#089981',downColor:'#f23645',
      borderUpColor:'#089981',borderDownColor:'#f23645',
      wickUpColor:'#089981',wickDownColor:'#f23645',
      priceFormat:{type:'price',precision:prec,minMove:mm},
      priceLineVisible:true,priceLineColor:'rgba(0,212,255,.5)',priceLineWidth:1,priceLineStyle:2,
    });
    cSeries.setData(candles);

    // EMA
    const mkLine=(col,dash=false)=>_fsLwChart.addLineSeries({color:col,lineWidth:1,lineStyle:dash?2:0,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,priceFormat:{type:'price',precision:prec,minMove:mm}});
    const ema20=calcEMA(closes,20), ema50=calcEMA(closes,50), ema200=calcEMA(closes,200);
    const mkD=arr=>arr.map((v,i)=>v==null?null:{time:candles[i].time,value:v}).filter(Boolean);
    mkLine('#f59e0b').setData(mkD(ema20));
    mkLine('#818cf8').setData(mkD(ema50));
    mkLine('#f43f5e',true).setData(mkD(ema200));

    // Volume
    const volS=_fsLwChart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'fsvol',scaleMargins:{top:0.85,bottom:0}});
    _fsLwChart.priceScale('fsvol').applyOptions({scaleMargins:{top:0.85,bottom:0},drawTicks:false,visible:false});
    volS.setData(candles.map((cn,i)=>({time:cn.time,value:vols[i],color:closes[i]>=(i>0?closes[i-1]:closes[i])?'rgba(8,153,129,.5)':'rgba(242,54,69,.5)'})));

    // S/R lines
    drawSRLines(_fsLwChart, cSeries, candles);

    // Fit
    await new Promise(r=>requestAnimationFrame(r));
    _fsLwChart.timeScale().setVisibleLogicalRange({from:Math.max(0,candles.length-150),to:candles.length+8});

    // ResizeObserver
    if(window._fsResizeObs) window._fsResizeObs.disconnect();
    window._fsResizeObs = new ResizeObserver(()=>{
      if(_fsLwChart && body){
        _fsLwChart.applyOptions({width:body.clientWidth||window.innerWidth, height:body.clientHeight||(window.innerHeight-120)});
      }
    });
    window._fsResizeObs.observe(body);

    // Stats bar
    const sb = document.getElementById('chartFsStatsBar');
    if(sb) sb.style.display='flex';
    const ind = await fetchIndicators(sym);
    if(ind){
      _setEl('fsSbRsi',  ind.rsi.toFixed(1), ind.rsi>70?'var(--red)':ind.rsi<30?'var(--green)':'var(--gold)');
      _setEl('fsSbMacd', ind.macd.hist>0?'▲ Tăng':'▼ Giảm', ind.macd.hist>0?'var(--green)':'var(--red)');
      _setEl('fsSbEma20', fmtPShort(ema20.filter(Boolean).at(-1)));
      _setEl('fsSbEma50', fmtPShort(ema50.filter(Boolean).at(-1)));
      _setEl('fsSbBbU',  fmtPShort(ind.bb.upper));
      _setEl('fsSbBbL',  fmtPShort(ind.bb.lower));
      const sig=ind.signal;
      _setEl('fsSbSig', sig==='buy'?'✅ Mua':sig==='sell'?'🔴 Bán':'⏸ Chờ', sig==='buy'?'var(--green)':sig==='sell'?'var(--red)':'var(--gold)');
    }
  } catch(e){
    if(body) body.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444">⚠️ Lỗi tải dữ liệu: ${e.message}</div>`;
  }
}

let _fsCurTf = '1h';
function fsTfClick(btn, tf){
  _fsCurTf = tf;
  document.querySelectorAll('#chartFsOverlay .tf-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(selectedSym) loadFsChart(selectedSym, tf);
}

function showFsHint(){
  let hint = document.getElementById('chartFsHint');
  if(!hint){
    hint = document.createElement('div');
    hint.id = 'chartFsHint';
    hint.textContent = 'Nhấn ESC để thoát toàn màn hình';
    document.body.appendChild(hint);
  }
  hint.classList.add('show');
  clearTimeout(window._fsHintTimer);
  window._fsHintTimer = setTimeout(()=>hint.classList.remove('show'), 3000);
}

// ESC để thoát
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && _chartFs) exitChartFs();
});


/* ════════════════════════════════════════════════════════
   VN STOCK MARKET — JavaScript
   Nguồn dữ liệu: SSI iBoard API (public, không cần key)
   ════════════════════════════════════════════════════════ */



// ╔══════════════════════════════════════════════════════════════════════╗
// ║  MODULE 2 — CHỨNG KHOÁN VIỆT NAM 🇻🇳                                ║
// ║  Nguồn dữ liệu: TradingView Scanner + Yahoo Finance                 ║
// ║  ✅ Sửa file này KHÔNG ảnh hưởng Crypto hoặc Forex                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

let _currentMarket = 'crypto';
let _vnCurrentTicker = null;
let _vnCurrentMoverTab = 'top-gain';
let _vnNewsSource = 'all';
let _vnWatchlist = JSON.parse(localStorage.getItem('vlc_vn_watchlist') || '["VNM","VIC","VHM","HPG","TCB","BID","VCB","FPT","MWG","VRE"]');
let _vnStockData  = {}; // cache dữ liệu cổ phiếu
let _vnChart      = null; // LightweightCharts instance
let _vnSeries     = null; // candlestick series
let _vnTVWidget   = null; // TradingView widget instance

// ── VN top 60 cổ phiếu phổ biến ──────────────────────────
const VN_POPULAR = [
  'VNM','VIC','VHM','HPG','TCB','BID','VCB','FPT','MWG','VRE',
  'MSN','GAS','SAB','CTG','ACB','MBB','STB','SSI','HDB','VND',
  'VPB','TPB','SHB','EIB','KDH','NVL','PDR','DXG','BCM','VGC',
  'PLX','PNJ','REE','HAG','DRC','GMD','PVD','BSR','OIL','GEX'
];

const VN_GROUPS = {
  vn30:    ['VNM','VIC','VHM','HPG','TCB','BID','VCB','FPT','MWG','VRE','MSN','GAS','SAB','CTG','ACB','MBB','VPB','PLX','PNJ','SSI','HDB','STB','TPB','BCM','NVL','PDR','GMD','REE','GEX','VND'],
  bank:    ['VCB','BID','CTG','ACB','MBB','STB','TCB','VPB','HDB','TPB','SHB','EIB','MSB','OCB','LPB','NVB','ABB','BAB','KLB'],
  estate:  ['VIC','VHM','VRE','NVL','PDR','DXG','KDH','BCM','NLG','HDG','SGR','CEO','DIG','CII','HTN','VPI','HQC','LDG'],
  industry:['HPG','GAS','PLX','PVD','BSR','OIL','GEX','REE','GMD','DRC','VGC','BMP','PHR','TPC','DCM','DPM','CSV','HSG'],
  all:     null,
};


// ── Tên công ty (50 cổ phiếu phổ biến) ──────────────────
const VN_NAMES = {
  VNM:'Vinamilk',VIC:'Vingroup',VHM:'Vinhomes',HPG:'Hòa Phát',
  TCB:'Techcombank',BID:'BIDV',VCB:'Vietcombank',FPT:'FPT Corp',
  MWG:'Thế Giới Di Động',VRE:'Vincom Retail',MSN:'Masan Group',
  GAS:'PV Gas',SAB:'Sabeco',CTG:'VietinBank',ACB:'ACB Bank',
  MBB:'MB Bank',STB:'Sacombank',SSI:'SSI Securities',HDB:'HDBank',
  VND:'VNDirect',VPB:'VPBank',TPB:'TPBank',SHB:'SHB Bank',
  EIB:'Eximbank',KDH:'Khang Điền',NVL:'Novaland',PDR:'Phát Đạt',
  DXG:'Đất Xanh',BCM:'Becamex',VGC:'Viglacera',PLX:'Petrolimex',
  PNJ:'PNJ Gold',REE:'REE Corp',HAG:'Hoàng Anh Gia Lai',
  DRC:'Cao Su Đà Nẵng',GMD:'Gemadept',PVD:'PV Drilling',
  BSR:'Lọc Hóa Dầu BR',OIL:'PV Oil',GEX:'Gelex'
};

// ── Switch market (Crypto / CKVN) ─────────────────────────
function switchMarket(market, el){
  _currentMarket = market;
  // Sync cả top-tab và hm-btn
  document.querySelectorAll('.top-tab,.hm-btn').forEach(t=>t.classList.remove('active'));
  const cryptoHm = document.getElementById('ttab-crypto');
  const vnHm     = document.getElementById('ttab-vn');
  const fxHm     = document.getElementById('ttab-forex');
  if(market==='crypto'){ if(cryptoHm) cryptoHm.classList.add('active'); }
  else if(market==='vn'){ if(vnHm) vnHm.classList.add('active'); }
  else if(market==='forex'){ if(fxHm) fxHm.classList.add('active'); }
  if(el) el.classList.add('active');

  const cryptoNav = document.getElementById('subNavCrypto');
  const vnNav     = document.getElementById('subNavVN');
  const fxNav     = document.getElementById('subNavForex');

  // Hide all navs first
  if(cryptoNav) cryptoNav.style.display = 'none';
  if(vnNav)     vnNav.style.display = 'none';
  if(fxNav)     fxNav.style.display = 'none';
  document.body.classList.remove('market-crypto','market-vn','market-forex');
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));

  if(market === 'crypto'){
    if(cryptoNav) cryptoNav.style.display = '';
    document.body.classList.add('market-crypto');
    showPage('market', document.getElementById('stab-market'));
  } else if(market === 'vn'){
    if(vnNav) vnNav.style.display = '';
    document.body.classList.add('market-vn');
    showVNPage('vn-market', document.getElementById('stab-vn-market'));
  } else if(market === 'forex'){
    if(fxNav) fxNav.style.display = '';
    document.body.classList.add('market-forex');
    showFxPage('fx-market', document.getElementById('stab-fx-market'));
    if(!_fxData.length) loadFxMarket();
  }
}

// ── VN Page navigation ────────────────────────────────────

function showVNPage(id, el){
  // id = 'vn-market' | 'vn-chart' | 'vn-watchlist' | etc.
  document.querySelectorAll('[id^="page-vn-"]').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sub-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  const page = document.getElementById('page-'+id);
  if(page) page.classList.add('active');
  if(id==='vn-market')    { loadVNMarket(); renderVNIndexCard(); }
  if(id==='vn-chart')     { _renderVNStockListPanel(); renderVNQuickPicks(); }
  if(id==='vn-watchlist') renderVNWatchlist();
  if(id==='vn-indices')   loadVNIndices();
  if(id==='vn-news')      loadVNNews();
  if(id==='vn-heatmap')   setTimeout(renderVNHeatmap, 100);
}

function updateVNSession(){
  _syncVNSession();
  updateVNMarketStatusBadge();
}

function loadMarket(){
  // Alias cho crypto market load
  if(typeof initMarket === 'function') initMarket();
}

function renderTable(data, tab, query){
  // Alias wrapper — crypto table render
  if(typeof _renderCoins === 'function') _renderCoins(data, tab, query);
  else if(typeof renderCoins === 'function') renderCoins(data, tab, query);
}

// ── VN format helpers ────────────────────────────────────────
function vnFmtPrice(v){
  if(!v||isNaN(v)) return '—';
  return (+v).toLocaleString('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function vnFmtVol(v){
  if(!v||isNaN(v)) return '—';
  const n=+v;
  if(n>=1e9) return (n/1e9).toFixed(2)+'T';
  if(n>=1e6) return (n/1e6).toFixed(1)+'Tr';
  if(n>=1e3) return (n/1e3).toFixed(0)+'N';
  return n.toFixed(0);
}
function vnFmtVal(v){
  if(!v||isNaN(v)) return '—';
  const n=+v;
  if(n>=1e12) return (n/1e12).toFixed(2)+'N tỷ';
  if(n>=1e9)  return (n/1e9).toFixed(1)+'Tỷ';
  if(n>=1e6)  return (n/1e6).toFixed(0)+'Tr';
  return n.toFixed(0);
}
function vnPriceClass(price, ref){
  if(!price||!ref||isNaN(price)||isNaN(ref)) return '';
  const p=+price, r=+ref;
  const ceil=Math.round(r*1.07*100)/100, floor=Math.round(r*0.93*100)/100;
  if(p>=ceil) return 'vn-ceil';
  if(p<=floor) return 'vn-floor';
  if(p>r)  return 'vn-up';
  if(p<r)  return 'vn-dn';
  return 'vn-ref';
}


// ══════════════════════════════════════════════════════════════
// VN MARKET PAGE — loadVNMarket, renderVNQuickPicks
// ══════════════════════════════════════════════════════════════


// ── VN Market state ──────────────────────────────
let _vnMarketTab  = 'all';
let _vnMarketData = [];  // cache rows

// ── loadVNMarket: render table từ VN_POPULAR ─────
async function loadVNMarket(){
  _syncVNSession();
  _renderVNMarketStatic();      // hiện ngay skeleton
  _updateVNBreadthFromData();
  renderVNIndexCard();
  // Fetch real data bất đồng bộ
  _fetchVNMarketData();
}

async function _fetchVNMarketData(){
  const tickers = (VN_GROUPS?.vn30||[]).concat(
    (VN_POPULAR||[]).filter(t=>!(VN_GROUPS?.vn30||[]).includes(t))
  ).slice(0,40);

  // Ưu tiên 1: TV Scanner (không bị CORS, realtime)
  try{
    const tvSyms = tickers.map(t=>tvScanSym(t));
    const rows   = await tvScanFetch(tvSyms);
    if(rows && rows.length >= 5){
      const stocks = rows.map(r=>parseTVRow(r, TV_COLS)).filter(Boolean);
      if(stocks.length >= 5){
        _vnMarketData = stocks.map(s=>({
          ...s,
          ref:   s.price/(1+(s.changePct||0)/100)||s.price,
          ceil:  +(s.price*1.07).toFixed(2),
          floor: +(s.price*0.93).toFixed(2),
          val:   s.vol*s.price,
          exchange:'HOSE',
        }));
        window._vnLastDataSource = 'TV Scanner';
        _renderVNTable(_vnMarketData);
        _updateVNBreadthFromData();
        return;
      }
    }
  }catch(e){}

  // Fallback: Stooq qua allorigins — phải sequential+throttle tránh 429
  // Batch 4 tickers, delay 400ms giữa các batch
  const TOP_TICKERS = tickers.slice(0,20);
  const BATCH = 4;
  const results = [];
  for(let i=0; i<TOP_TICKERS.length; i+=BATCH){
    const batch = TOP_TICKERS.slice(i, i+BATCH);
    const settled = await Promise.allSettled(batch.map(t=>fetchVNSingle(t)));
    settled.forEach((r,j)=>{
      if(r.status==='fulfilled' && r.value) results.push(r.value);
    });
    if(results.length > 0){
      _vnMarketData = results;
      _renderVNTable(_vnMarketData);
      _updateVNBreadthFromData();
    }
    if(i+BATCH < TOP_TICKERS.length)
      await new Promise(r=>setTimeout(r, 350)); // throttle allorigins
  }
}
function vnSetTab(el, tab){
  _vnMarketTab = tab;
  document.querySelectorAll('#page-vn-market .tab-btn').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
  _renderVNTable(_vnMarketData);
}

function vnMarketFilter(q){
  _renderVNTable(_vnMarketData);
}

function vnMarketClear(){
  const el = document.getElementById('vnMarketSearch');
  if(el) el.value = '';
  _renderVNTable(_vnMarketData);
}

function vnSwitchRightPanel(panel, btn){
  // VN chart right panel tabs (Thông Tin / VN30)
  document.querySelectorAll('#page-vn-chart .ob-tab, #page-vn-chart [data-rp-tab]').forEach(t=>t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  ['vn-rp-info','vn-rp-vn30'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display = (id==='vn-rp-'+panel)?'block':'none';
  });
}




// ── VN Index card (right panel) ──────────────────
// ── VN Color & Logo System ───────────────────────────

// Tạo màu nhất quán từ ticker (hash-based)
function _vnColor(ticker){
  let h = 0;
  for(let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) & 0xffff;
  const hue = h % 360;
  return `hsl(${hue},65%,58%)`;
}
// Brand colors chính xác cho VN stocks
const VN_BRAND = {
  // Ngân hàng
  VCB:'#007B40', BID:'#003DA5', CTG:'#CC0000', TCB:'#CC0000',
  ACB:'#0066B3', MBB:'#CC0000', STB:'#0066B3', VPB:'#00A650',
  HDB:'#CC0000', TPB:'#CC0000', SHB:'#CC0000', EIB:'#0066B3',
  LPB:'#CC0000', MSB:'#E87722', OCB:'#E31837', NAB:'#0066B3',
  // Công nghệ
  FPT:'#FF6600', CMG:'#003087',
  // Tiêu dùng
  VNM:'#00529B', MWG:'#CC0000', MSN:'#CC0000', SAB:'#C8960C', PNJ:'#C8960C',
  // Bất động sản
  VIC:'#003DA5', VHM:'#003DA5', VRE:'#003DA5', NVL:'#CC0000',
  PDR:'#FF6600', KDH:'#0066B3', DXG:'#CC0000', BCM:'#0066B3', VGC:'#003087',
  // Công nghiệp / Năng lượng
  HPG:'#CC0000', GAS:'#003DA5', PLX:'#CC0000', BSR:'#003DA5',
  PVD:'#003DA5', OIL:'#003DA5', DRC:'#003087', REE:'#003DA5',
  GMD:'#0066B3', GEX:'#003DA5',
  // Tài chính
  SSI:'#003DA5', VND:'#CC0000', VCI:'#003DA5',
  // Chỉ số
  VNINDEX:'#CC0000', VN30:'#CC0000', HNX:'#003DA5',
};



// Cache logo URLs đã biết
const _vnLogoCache = new Map();

// SVG logo — brand color rõ nét, nền tối, viền + glow như Crypto logos
function vnLogoSVG(ticker, size=32){
  const col = VN_BRAND[ticker] || _vnColor(ticker);
  const r   = Math.round(size * 0.28);
  const txt = ticker.length <= 3 ? ticker : ticker.slice(0,3);
  const fs  = size <= 18 ? Math.round(size*0.44) :
              size <= 24 ? Math.round(size*0.40) :
              size <= 32 ? (txt.length>2 ? Math.round(size*0.29) : Math.round(size*0.36)) :
              (txt.length>2 ? Math.round(size*0.27) : Math.round(size*0.33));
  const uid = ('v_'+ticker+'_'+size).replace(/[^a-z0-9_]/gi,'_');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
    xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;display:block;">
    <defs>
      <radialGradient id="${uid}bg" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="${col}" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="${col}" stop-opacity="0.08"/>
      </radialGradient>
      <filter id="${uid}glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="${Math.max(0.8,size*0.06)}" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <rect width="${size}" height="${size}" rx="${r}" fill="url(#${uid}bg)"/>
    <rect x="0.6" y="0.6" width="${size-1.2}" height="${size-1.2}" rx="${r}"
      fill="none" stroke="${col}" stroke-width="${size<=20?0.7:1}"
      stroke-opacity="0.55"/>
    <text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle"
      font-family="'Inter','Segoe UI',system-ui,sans-serif"
      font-size="${fs}" font-weight="800" fill="${col}"
      filter="url(#${uid}glow)">${txt}</text>
  </svg>`;
}

// vnLogoHTML: SVG inline (tất cả CDN bị ERR_NAME_NOT_RESOLVED từ github.io)
// Render logo đẹp với brand color chính xác + gradient + border
function vnLogoHTML(ticker, size=32){
  return vnLogoSVG(ticker, size);
}



function vnLogoOk(img){ /* không dùng img nữa, giữ để tương thích */ }
function vnLogoErr(img){
  // Tất cả CDN đều bị CORS block → render SVG
  const t  = img.dataset.ticker || '';
  const sz = parseInt(img.dataset.size) || 32;
  _vnLogoCache.set(t, 'svg');
  const wrap = img.closest('[data-vn-logo]') || img.parentElement;
  if(wrap){ wrap.innerHTML = vnLogoSVG(t, sz); }
}

function _updateVNChartLogo(ticker){
  const box = document.getElementById('vnChartLogoBox');
  if(!box) return;
  box.style.cssText = 'width:38px;height:38px;flex-shrink:0;overflow:hidden;border-radius:10px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;padding:0;';
  box.innerHTML = vnLogoSVG(ticker, 38);
}

const VN_INDICES = [
  {sym:'HOSE:VNINDEX', label:'VN-Index',  color:'#e8192c'},
  {sym:'HNX:HNX',      label:'HNX-Index', color:'#3b82f6'},
  {sym:'HOSE:VN30',    label:'VN30',      color:'#f59e0b'},
  {sym:'HNX:HNX30',    label:'HNX30',     color:'#8b5cf6'},
  {sym:'UPCOM:UPCOM',  label:'UPCOM',     color:'#10b981'},
];
const VN_BLUECHIPS = ['VNM','VCB','HPG','VIC','FPT','MWG','TCB','BID'];

function renderVNIndexCard(){
  const el = document.getElementById('vnIndexList');
  if(!el) return;
  el.innerHTML = VN_INDICES.map(idx=>`
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:8px 10px;border-radius:8px;background:var(--surface2);
      border:1px solid var(--border);cursor:pointer;transition:border-color .15s"
      onmouseover="this.style.borderColor='${idx.color}44'"
      onmouseout="this.style.borderColor='var(--border)'"
      onclick="vnSelectStock('${idx.sym.split(':')[1]}')">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:3px;height:28px;border-radius:2px;background:${idx.color};flex-shrink:0"></div>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text)">${idx.label}</div>
          <div style="font-size:10px;color:var(--muted)">${idx.sym}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="sc-val" id="vi_${idx.label.replace('-','')}" style="font-size:13px;color:var(--text)">—</div>
        <div id="vi_${idx.label.replace('-','')}chg" style="font-size:10px;color:var(--muted)">—</div>
      </div>
    </div>`).join('');

  const bl = document.getElementById('vnBlueList');
  if(!bl) return;
  bl.innerHTML = VN_BLUECHIPS.map(t=>`
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:6px 10px;border-radius:7px;cursor:pointer;
      transition:background .15s"
      onmouseover="this.style.background='rgba(255,255,255,.05)'"
      onmouseout="this.style.background='transparent'"
      onclick="vnSelectStock('${t}')">
      <div style="display:flex;align-items:center;gap:8px">
        ${vnLogoHTML(t, 26)}
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text)">${t}</div>
          <div style="font-size:10px;color:var(--muted)">${(VN_NAMES[t]||'').slice(0,16)}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div id="vb_${t}" style="font-size:11px;font-weight:700;color:var(--text)">—</div>
        <div id="vb_${t}chg" style="font-size:10px;color:var(--muted)">—</div>
      </div>
    </div>`).join('');
}

function _syncVNSession(){
  const now = new Date();
  const h = now.getUTCHours()+7, m = now.getUTCMinutes();
  const t = h*60+m;
  let label, cls;
  if(t>=9*60 && t<11*60+30){ label='🟢 Phiên Sáng';  cls='session-open'; }
  else if(t>=13*60 && t<15*60){ label='🟢 Phiên Chiều'; cls='session-open'; }
  else if(t>=11*60+30 && t<13*60){ label='🟡 Nghỉ Trưa';  cls='session-lunch'; }
  else{ label='⏸ Ngoài Giờ'; cls='session-closed'; }
  ['vnSessionBadge','vnSessionBadge2','vnSessionBadge3'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.textContent=label; el.className='vn-session-badge '+cls; }
  });
  const sub = document.getElementById('svnSession');
  if(sub) sub.textContent = label;
}

function _renderVNMarketStatic(){
  // Build rows từ VN_POPULAR với data = 0 (chờ real data)
  // Tạo dữ liệu giả lập màu sắc dựa trên index để UI trông sinh động
  const tickers = (VN_GROUPS?.vn30||[]).concat(
    (VN_POPULAR||[]).filter(t=>!(VN_GROUPS?.vn30||[]).includes(t))
  ).slice(0,40);
  
  _vnMarketData = tickers.map((t,i)=>({
    ticker:t, name:VN_NAMES[t]||t,
    price:0, ref:0, change:0, changePct:0,
    ceil:0, floor:0, vol:0,
  }));
  _renderVNTable(_vnMarketData);
}

function _renderVNTable(rows){
  const tab = _vnMarketTab;
  const body = document.getElementById('vnTableBody');
  if(!rows || rows.length === 0){
    if(body) body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">
      <div class="spinner" style="margin:0 auto 12px;border-top-color:#e8192c"></div>
      Đang tải dữ liệu thị trường...</td></tr>`;
    return;
  }
  let filtered = rows;
  if(tab==='gainers')  filtered = rows.filter(r=>r.changePct>0);
  if(tab==='losers')   filtered = rows.filter(r=>r.changePct<0);
  if(tab==='ceiling')  filtered = rows.filter(r=>r.price>0 && r.ceil>0 && r.price>=r.ceil);
  
  const q = (document.getElementById('vnMarketSearch')?.value||'').toUpperCase().trim();
  if(q) filtered = filtered.filter(r=>r.ticker.includes(q)||(r.name||'').toUpperCase().includes(q));

  const tbody = document.getElementById('vnMarketBody');
  if(!tbody) return;
  if(!filtered.length){
    tbody.innerHTML='<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--muted)">Không có dữ liệu</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map((r,i)=>{
    const price = r.price;
    const chg   = r.change;
    const pct   = r.changePct;
    const isCeil  = price>0 && r.ceil>0  && price>=r.ceil;
    const isFloor = price>0 && r.floor>0 && price<=r.floor;
    const cls = isCeil?'vn-ceil': isFloor?'vn-floor': pct>0?'green': pct<0?'red': 'muted';
    const sign= chg>=0?'+':'';
    
    // Signal badge đơn giản dựa trên % thay đổi
    let sig='', sigCls='hold';
    if(isCeil){ sig='TRẦN'; sigCls='buy'; }
    else if(isFloor){ sig='SÀN'; sigCls='sell'; }
    else if(pct>=3){ sig='TĂNG MẠNH'; sigCls='buy'; }
    else if(pct<=-3){ sig='GIẢM MẠNH'; sigCls='sell'; }
    else if(pct>0){ sig='TĂNG'; sigCls='buy'; }
    else if(pct<0){ sig='GIẢM'; sigCls='sell'; }
    else{ sig='—'; sigCls='hold'; }
    
    const _skel     = '<span class="vn-skel"></span>';
    const priceDisp = price>0 ? vnFmtPrice(price) : _skel;
    const chgDisp   = price>0 ? `${sign}${vnFmtPrice(chg)}` : _skel;
    const pctDisp   = price>0 ? `${sign}${pct.toFixed(2)}%` : _skel;
    const ceilDisp  = r.ceil>0  ? vnFmtPrice(r.ceil)  : _skel;
    const floorDisp = r.floor>0 ? vnFmtPrice(r.floor) : '—';
    const volDisp   = r.vol>0   ? vnFmtVol(r.vol)     : '—';
    
    return `<tr style="cursor:pointer" onclick="vnSelectStock('${r.ticker}')" class="coin-row">
      <td class="l"><span class="rank">${i+1}</span></td>
      <td class="l">
        <div class="coin-cell">
          ${vnLogoHTML(r.ticker, 30)}
          <div>
            <div class="cn">${r.ticker}</div>
            <div class="cs">${(r.name||'').slice(0,22)}</div>
          </div>
        </div>
      </td>
      <td class="r"><span class="${cls}" style="font-weight:700">${priceDisp}</span></td>
      <td class="r"><span class="${cls}">${chgDisp}</span></td>
      <td class="r"><span class="badge ${pct>0?'up':pct<0?'dn':'unch'}">${pctDisp}</span></td>
      <td class="r" style="color:#a855f7;font-size:11px">${ceilDisp}</td>
      <td class="r" style="color:#06b6d4;font-size:11px">${floorDisp}</td>
      <td class="r" style="color:var(--muted);font-size:11px">${volDisp}</td>
      <td class="r"><span class="sig ${sigCls}">${sig}</span></td>
    </tr>`;
  }).join('');
}



function _buildLWChart(container, candles){
  container.innerHTML='';
  if(_vnChart){try{_vnChart.remove();}catch(e){}_vnChart=null;}
  const w=container.clientWidth||800, h=container.clientHeight||520;
  _vnChart=LightweightCharts.createChart(container,{
    layout:{background:{color:'transparent'},textColor:'rgba(255,255,255,.7)',fontSize:12},
    grid:{vertLines:{color:'rgba(255,255,255,.04)'},horzLines:{color:'rgba(255,255,255,.04)'}},
    crosshair:{mode:LightweightCharts.CrosshairMode.Normal},
    rightPriceScale:{borderColor:'rgba(255,255,255,.1)',scaleMargins:{top:0.06,bottom:0.06}},
    timeScale:{borderColor:'rgba(255,255,255,.1)',timeVisible:false,fixLeftEdge:true,fixRightEdge:true},
    handleScroll:true,handleScale:true,width:w,height:h,
  });
  _vnSeries=_vnChart.addCandlestickSeries({
    upColor:'#22c55e',downColor:'#ef4444',
    borderUpColor:'#22c55e',borderDownColor:'#ef4444',
    wickUpColor:'#22c55e',wickDownColor:'#ef4444',
  });
  // Validate: lọc NaN, dedup timestamps, đảm bảo sorted
  const _seen=new Set();
  const _valid=candles.filter(b=>{
    if(!b||isNaN(b.time)||isNaN(b.open)||isNaN(b.close)) return false;
    if(_seen.has(b.time)) return false;
    _seen.add(b.time);
    return b.open>0 && b.close>0;
  }).sort((a,b)=>a.time-b.time);
  if(!_valid.length) return;
  _vnSeries.setData(_valid);
  _vnChart.timeScale().fitContent();
  new ResizeObserver(entries=>{
    if(_vnChart&&entries[0]) _vnChart.applyOptions({width:entries[0].contentRect.width,height:entries[0].contentRect.height});
  }).observe(container);
}

// ── TV Widget wrapper → dùng LightweightCharts ───────────────────
function _buildTVWidget(container, tvSymbol, interval, ticker){
  container.innerHTML='';
  if(!ticker){ return; }
  _fetchVNChartData(container, ticker, interval||'D');
}

// ── Fetch VN chart data — TradingView Embed Widget (official public API) ──
// tv.js (Advanced Chart) không hỗ trợ HOSE khi embed ngoài tradingview.com
// embed-widget-advanced-chart.js là public API → hỗ trợ mọi exchange kể cả HOSE
function _fetchVNChartData(container, ticker, interval){
  const loading = document.getElementById('vnChartLoading');
  if(loading) loading.style.display='none';

  const TV_TF = {
    '1D':'D','1T':'W','1W':'W','1M':'M',
    '3M':'3M','3T':'3M','6M':'6M',
    '1N':'12M','1Y':'12M','2Y':'24M',
    'D':'D','W':'W','M':'M',
  };
  const tvInterval = TV_TF[interval] || 'D';
  const tvSymbol   = tvScanSym(ticker); // HOSE:FPT, HNX:SHB

  container.innerHTML = '';

  // TradingView Embed Widget Advanced Chart
  // Script inject approach (chính thức từ TradingView widget generator)
  const cfg = {
    autosize:          true,
    symbol:            tvSymbol,
    interval:          tvInterval,
    timezone:          'Asia/Ho_Chi_Minh',
    theme:             'dark',
    style:             '1',
    locale:            'vi_VN',
    enable_publishing: false,
    hide_top_toolbar:  false,
    hide_legend:       false,
    save_image:        false,
    studies:           ['RSI@tv-basicstudies','Volume@tv-basicstudies'],
    backgroundColor:   '#060a10',
    gridColor:         'rgba(99,179,237,0.04)',
    overrides: {
      'mainSeriesProperties.candleStyle.upColor':         '#00e676',
      'mainSeriesProperties.candleStyle.downColor':       '#ff3d57',
      'mainSeriesProperties.candleStyle.borderUpColor':   '#00e676',
      'mainSeriesProperties.candleStyle.borderDownColor': '#ff3d57',
      'mainSeriesProperties.candleStyle.wickUpColor':     '#00e676',
      'mainSeriesProperties.candleStyle.wickDownColor':   '#ff3d57',
    },
  };

  const wrap  = document.createElement('div');
  wrap.className = 'tradingview-widget-container';
  wrap.style.cssText = 'height:100%;width:100%';

  const inner = document.createElement('div');
  inner.className = 'tradingview-widget-container__widget';
  inner.style.cssText = 'height:calc(100% - 32px);width:100%';
  wrap.appendChild(inner);

  const script = document.createElement('script');
  script.type  = 'text/javascript';
  script.src   = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.async = true;
  script.innerHTML = JSON.stringify(cfg);
  wrap.appendChild(script);

  container.appendChild(wrap);
}

// ── Cache dữ liệu 3 phút ─────────────────────────────────────────
const _PROXY_CACHE = new Map();
const _PROXY_CACHE_TTL = 3 * 60 * 1000;
function _cacheGet(k){ const c=_PROXY_CACHE.get(k); return (c&&Date.now()-c.ts<_PROXY_CACHE_TTL)?c.v:null; }
function _cacheSet(k,v){ _PROXY_CACHE.set(k,{v,ts:Date.now()}); return v; }

// ── Yahoo Finance quote — CORS OK, không cần proxy ───────────────
async function _fetchYFQuote(ticker){
  // ── Yahoo Finance bị CORS block từ github.io ──
  // Dùng TradingView Scanner thay thế (CORS OK)
  const cKey = 'tvq_'+ticker;
  const cached = _cacheGet(cKey);
  if(cached) return cached;
  try{
    const rows = await tvScanFetch([tvScanSym(ticker)]);
    if(!rows || !rows.length) return null;
    const d = parseTVRow(rows[0], TV_COLS);
    if(!d || !d.price) return null;
    const ref = d.price / (1 + (d.changePct||0)/100);
    const change = d.price - ref;
    return _cacheSet(cKey, {
      ticker, price: d.price, ref,
      ceil:     Math.round(ref*1.07/100)*100 || d.price,
      floor:    Math.round(ref*0.93/100)*100 || d.price,
      high:     d.price,
      low:      d.price,
      vol:      d.vol||0,
      val:      (d.vol||0)*d.price,
      change, changePct: d.changePct||0,
      exchange: 'HOSE',
      name: VN_NAMES[ticker] || ticker,
    });
  }catch(e){ return null; }
}

// ── Fetch single stock snapshot: TV cache → Yahoo Finance ────────
// Không gọi SSI/TCBS vì bị CORS block từ github.io
async function fetchVNSingle(ticker){
  // 1. Ưu tiên lấy từ TV Scanner data đã có (nhanh nhất, không cần API call)
  if(window._vnMarketData){
    const found = window._vnMarketData.find(s=>s.ticker===ticker);
    if(found && found.price>0) return found;
  }
  // 2. Fallback: Yahoo Finance (CORS OK)
  return await _fetchYFQuote(ticker);
}

// ── tvSym: chuyển ticker → TradingView symbol ──────────────────
// tvSym()     → alias tvScanSym() (HOSE: format, dùng cho cả widget lẫn scanner)
// tvScanSym() → dùng cho SCANNER (HOSE: cho HoSE stocks)
const _HNX_STOCKS = new Set([
  'SHB','PVS','NVB','PVX','VCS','KLF','CEO','SHN','VGS','SCI',
  'BVS','DTD','HUT','IDC','L14','NBC','PLC','POT','PVB','S99',
  'SD9','SHS','TNG','VGS','VIX','WIN',
]);
const _UPCOM_STOCKS = new Set([
  'AAS','ABI','ABB','ABC','ABI',
]);

// tvSym() → alias của tvScanSym() cho backward compat
// TradingView tv.js Advanced Chart dùng cùng format với Scanner: HOSE:FPT
function tvSym(ticker){ return tvScanSym(ticker); }

// Hàm dùng cho SCANNER: HOSE → HOSE, HNX → HNX
function tvScanSym(ticker){
  const SPECIAL = {
    VNINDEX:'HOSE:VNINDEX', VN30:'HOSE:VN30',
    HNX:'HNX:HNX', HNX30:'HNX:HNX30',
    UPCOM:'UPCOM:UPCOM',
  };
  if(SPECIAL[ticker]) return SPECIAL[ticker];
  if(_HNX_STOCKS.has(ticker))   return 'HNX:'+ticker;
  if(_UPCOM_STOCKS.has(ticker)) return 'UPCOM:'+ticker;
  return 'HOSE:'+ticker;
}

// ── TV_COLS: cột TradingView scanner ────────────────────────────
const TV_COLS = ['name','close','change','change_abs','volume','market_cap_basic'];

// ── parseTVRow: parse một row từ TV scanner → {ticker,price,...} ─
function parseTVRow(row, cols){
  if(!row||!row.d) return null;
  const d = row.d;
  const ticker = (d[0]||'').replace(/^(?:HOSE:|HNX:|UPCOM:)/,'');
  if(!ticker) return null;
  return {
    ticker, name: VN_NAMES[ticker]||ticker,
    price:     d[1]||0,
    changePct: d[2]||0,
    change:    d[3]||0,
    vol:       d[4]||0,
    cap:       d[5]||0,
  };
}

// ── tvScanFetch: lấy dữ liệu TV scanner cho danh sách tickers ───
async function tvScanFetch(tvSymbols){
  const body = JSON.stringify({
    filter:[{left:'name',operation:'in_range',right:tvSymbols}],
    columns: TV_COLS,
    sort:{sortBy:'name',sortOrder:'asc'},
    range:[0, tvSymbols.length||50],
  });
  // TV Scanner chặn Content-Type header trong preflight
  // Gửi body là Blob text/plain để bypass CORS preflight
  const blob = new Blob([body], {type:'text/plain'});
  const r = await fetch('https://scanner.tradingview.com/vietnam/scan',{
    method:'POST', body: blob,
    signal: AbortSignal.timeout(8000),
  });
  if(!r.ok) throw new Error('tvScan '+r.status);
  const d = await r.json();
  return d.data||[];
}

// ── tvScanMovers: top gainers/losers từ TV scanner ───────────────
async function tvScanMovers(sortBy='change', sortOrder='desc', limit=50){
  const body = JSON.stringify({
    filter:[{left:'exchange',operation:'in_range',right:['HOSE','HNX','UPCOM']}],
    columns: TV_COLS,
    sort:{sortBy, sortOrder},
    range:[0, limit],
  });
  const r = await fetch('https://scanner.tradingview.com/vietnam/scan',{
    method:'POST', headers:{'Content-Type':'application/json'}, body,
    signal: AbortSignal.timeout(8000),
  });
  if(!r.ok) throw new Error('tvScanMovers '+r.status);
  const d = await r.json();
  return d.data||[];
}

// ── yfBatchQuotes → TradingView Scanner (Yahoo Finance bị CORS) ──
async function yfBatchQuotes(tickers){
  // Yahoo Finance v7/v8 bị block CORS từ github.io
  // Dùng TradingView Scanner: CORS OK, dữ liệu real-time
  try{
    const tvSymbols = tickers.map(t=>tvScanSym(t));
    const rows = await tvScanFetch(tvSymbols);
    return rows.map(r=>{
      const d = parseTVRow(r, TV_COLS);
      if(!d) return null;
      const ref = d.price>0 ? d.price/(1+(d.changePct||0)/100) : 0;
      return {
        ticker:    d.ticker,
        name:      VN_NAMES[d.ticker]||d.ticker,
        price:     d.price,
        ref,
        changePct: d.changePct||0,
        change:    d.change||0,
        vol:       d.vol||0,
        high:      d.price,
        low:       d.price,
      };
    }).filter(Boolean);
  }catch(e){ return []; }
}

// ── stooqQuote → Yahoo Finance (CORS OK) ─────────────────────────
async function stooqQuote(ticker){
  const d = await _fetchYFQuote(ticker);
  if(!d) return null;
  return {
    price: d.price, prevClose: d.ref,
    change: d.change, changePct: d.changePct,
    high: d.high, low: d.low, vol: d.vol,
    date: new Date().toISOString().slice(0,10)
  };
}

// ── _updateVNBreadthFromData: update breadth cards ───────────────
function _updateVNBreadthFromData(){
  const data = _vnMarketData||[];
  if(!data.length) return;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  const adv  = data.filter(d=>d.changePct>0).length;
  const dec  = data.filter(d=>d.changePct<0).length;
  const unch = data.filter(d=>d.changePct===0).length;
  const ceil = data.filter(d=>d.price>0&&d.ceil>0&&d.price>=d.ceil).length;
  const flr  = data.filter(d=>d.price>0&&d.floor>0&&d.price<=d.floor).length;
  const totalVol = data.reduce((s,d)=>s+(d.vol||0),0);
  const totalVal = data.reduce((s,d)=>s+(d.val||0),0);
  set('vnAdvance',   adv);
  set('vnDecline',   dec);
  set('vnUnchanged', unch);
  set('vnCeiling',   ceil);
  set('vnFloor',     flr);
  set('vnTotalVol',  vnFmtVol(totalVol));
  set('vnTotalVal',  vnFmtVal(totalVal));
}




function _buildVNChart(c,d){return _buildLWChart(c,d);}


// ── Indices page (CHỈ SỐ tab) ────────────────────────────────
async function loadVNIndices(){
  const grid = document.getElementById('vnIndicesGrid');
  if(!grid) return;
  const IDX = [
    {id:'VNINDEX',name:'VN-Index',exchange:'HOSE'},
    {id:'HNX',name:'HNX-Index',exchange:'HNX'},
    {id:'UPCOM',name:'UPCoM',exchange:'UPCOM'},
    {id:'VN30',name:'VN30',exchange:'HOSE'},
    {id:'HNX30',name:'HNX30',exchange:'HNX'},
  ];
  const results = await Promise.allSettled(IDX.map(async idx=>{
    const q = await stooqQuote(idx.id);
    return {...idx, ...q};
  }));
  const cards = results.map(r=>r.value).filter(Boolean);
  if(!cards.length){grid.innerHTML='<div class="state-box">Không tải được dữ liệu</div>';return;}
  grid.innerHTML = cards.map(d=>{
    const cls = d.changePct>=0?'up':'down';
    const sign = d.changePct>=0?'+':'';
    return `<div class="vn-idx-card" onclick="vnSelectStock('${d.id}')">
      <div class="vn-idx-name">${d.name} <span style="opacity:.5;font-size:11px">${d.exchange}</span></div>
      <div class="vn-idx-val ${cls}">${d.price?.toLocaleString('vi-VN',{maximumFractionDigits:2})||'—'}</div>
      <div class="vn-idx-chg ${cls}">${sign}${(d.changePct||0).toFixed(2)}%</div>
    </div>`;
  }).join('');
}





// ── VN News ───────────────────────────────────────────────
const VN_NEWS_FEEDS = [
  {label:'CafeF', url:'https://cafef.vn/thi-truong-chung-khoan.rss', src:'cafef'},
  {label:'NDH', url:'https://ndh.vn/chung-khoan.rss', src:'ndh'},
  {label:'Tin Nhanh CK', url:'https://tinnhanhchungkhoan.vn/chung-khoan/rss.xml', src:'tinnhanhck'},
  {label:'VnEconomy', url:'https://vneconomy.vn/chung-khoan.rss', src:'vneconomy'},
];
const RSS2JSON = 'https://api.allorigins.win/get?url=';
let _vnAllNews = [], _vnNewsFilter = 'all';

async function loadVNNews(){
  const grid = document.getElementById('vnNewsGrid');
  const btn = document.getElementById('vnNewsRefreshBtn');
  if(btn){btn.disabled=true;}
  if(grid) grid.innerHTML='<div class="vn-loading" style="padding:40px;text-align:center;grid-column:1/-1"><span class="chart-spinner" style="display:inline-block"></span> Đang tải tin tức...</div>';

  const results = await Promise.allSettled(VN_NEWS_FEEDS.map(async feed=>{
    const proxy = `${RSS2JSON}${encodeURIComponent(feed.url)}`;
    const resp = await fetch(proxy, {signal:AbortSignal.timeout(12000)});
    if(!resp.ok) return [];
    // allorigins /get trả JSON wrapper {contents:"<xml>"}
    let xmlText = '';
    try{ const j = await resp.json(); xmlText = j.contents||''; }
    catch(e){ xmlText = await resp.text().catch(()=>''); }
    if(!xmlText) return [];
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const items = [...doc.querySelectorAll('item')];
    return items.map(item=>{
      const title   = item.querySelector('title')?.textContent || '';
      const link    = item.querySelector('link')?.textContent || '#';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const desc    = item.querySelector('description')?.textContent || '';
      if(!title) return null;
      return {
        headline: title,
        summary:  desc.replace(/<[^>]+>/g,'').substring(0,180),
        source:   feed.label, src: feed.src,
        link, pub: pubDate ? new Date(pubDate).getTime() : Date.now(),
      };
    }).filter(Boolean);
  }));

  _vnAllNews = [];
  const seen = new Set();
  results.forEach(r=>{
    if(r.status!=='fulfilled') return;
    r.value.forEach(item=>{
      const key = item.headline.substring(0,50);
      if(seen.has(key)) return;
      seen.add(key);
      _vnAllNews.push(item);
    });
  });
  _vnAllNews.sort((a,b)=>b.pub-a.pub);

  renderVNNews();
  if(btn){btn.disabled=false;}
}

function setVNNewsFilter(el, src){
  _vnNewsFilter = src;
  document.querySelectorAll('.vn-news-filter .nf-btn').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
  renderVNNews();
}
function renderVNNews(){
  const grid = document.getElementById('vnNewsGrid');
  if(!grid) return;
  let items = _vnAllNews;
  if(_vnNewsFilter!=='all') items=items.filter(n=>n.src===_vnNewsFilter);
  if(!items.length){grid.innerHTML='<div class="vn-loading" style="grid-column:1/-1;padding:40px">Không có tin tức.</div>'; return;}
  grid.innerHTML = items.map(n=>`
    <a class="news-card-item" href="${n.link}" target="_blank" rel="noopener noreferrer">
      <div class="news-card-body">
        <div class="news-card-meta">
          <span class="news-card-src" style="background:rgba(208,2,27,.15);color:#ff6b6b">${n.source}</span>
          <span class="news-card-time">${timeAgo(n.pub)}</span>
        </div>
        <div class="news-card-headline">${n.headline}</div>
        ${n.summary?`<div class="news-card-summary">${n.summary}</div>`:''}
      </div>
      <div class="news-card-footer"><span class="news-card-link">Đọc thêm ↗</span></div>
    </a>`).join('');
}

// Tự động refresh session badge mỗi phút
setInterval(updateVNSession, 60000);


function getVNSession(){
  const now = new Date();
  // Giờ Hà Nội = UTC+7
  const utcMs = now.getTime();
  const hanoiDate = new Date(utcMs + 7*3600*1000);
  const h   = hanoiDate.getUTCHours();
  const m   = hanoiDate.getUTCMinutes();
  const t   = h * 60 + m;
  const day = hanoiDate.getUTCDay(); // 0=CN, 6=T7
  if(day === 0 || day === 6) return 'closed';
  // HoSE trading schedule (UTC+7):
  // 09:00–09:15  ATO sáng
  // 09:15–11:30  Liên tục sáng
  // 11:30–13:00  Nghỉ trưa
  // 13:00–13:15  ATO chiều
  // 13:15–14:30  Liên tục chiều
  // 14:30–14:45  ATC
  // 14:45+       Đóng cửa
  if(t >= 9*60       && t < 9*60+15)   return 'ato';
  if(t >= 9*60+15    && t < 11*60+30)  return 'open';
  if(t >= 11*60+30   && t < 13*60)     return 'break';
  if(t >= 13*60      && t < 13*60+15)  return 'ato';
  if(t >= 13*60+15   && t < 14*60+30)  return 'open';
  if(t >= 14*60+30   && t <= 14*60+45) return 'atc';
  return 'closed';
}

function updateVNMarketStatusBadge(){
  const badge = document.getElementById('vnMarketStatus');
  if(!badge) return;
  const s = getVNSession();

  // Reset
  badge.className = 'hm-status-badge';
  badge.innerHTML = '';

  if(s === 'open'){
    badge.classList.add('hm-status-open');
    // Dot nhấp nháy giống TRỰC TIẾP
    const dot = document.createElement('span');
    dot.className = 'hm-live-dot';
    dot.style.cssText = 'background:#22c55e;box-shadow:0 0 5px #22c55e';
    badge.appendChild(dot);
    badge.appendChild(document.createTextNode('MỞ CỬA'));
  } else if(s === 'ato'){
    badge.classList.add('hm-status-ato');
    const dot = document.createElement('span');
    dot.className = 'hm-live-dot';
    dot.style.cssText = 'background:#f59e0b;box-shadow:0 0 5px #f59e0b';
    badge.appendChild(dot);
    badge.appendChild(document.createTextNode('ATO'));
  } else if(s === 'atc'){
    badge.classList.add('hm-status-atc');
    const dot = document.createElement('span');
    dot.className = 'hm-live-dot';
    dot.style.cssText = 'background:#f59e0b;box-shadow:0 0 5px #f59e0b';
    badge.appendChild(dot);
    badge.appendChild(document.createTextNode('ATC'));
  } else if(s === 'break'){
    badge.classList.add('hm-status-ato');
    badge.textContent = 'NGHỈ TRƯA';
  } else {
    badge.classList.add('hm-status-closed');
    badge.textContent = 'ĐÓNG CỬA';
  }
}
// Chạy ngay khi load, sau đó mỗi 10 giây (đảm bảo bắt đúng thời điểm mở/đóng)
updateVNMarketStatusBadge();
setInterval(updateVNMarketStatusBadge, 10000);





/* ════════════════════════════════════════════════════════
   VN STOCK MARKET — JavaScript
   Nguồn dữ liệu: SSI iBoard API (public, không cần key)
   ════════════════════════════════════════════════════════ */







/* ═══════════════════════════════════════════════
   VN HEATMAP
   ═══════════════════════════════════════════════ */

// Nhóm cổ phiếu VN


let _vnHeatmapData = {};

async function loadVNHeatmap(){
  const grid = document.getElementById('vnHeatmapGrid');
  if(grid) grid.innerHTML='<div class="hm-loading"><div class="spinner"></div><span>Đang tải dữ liệu...</span></div>';

  const groupSel = document.getElementById('vnHmGroup')?.value || 'all';
  const tickers  = VN_GROUPS[groupSel] || VN_GROUPS.vn30;

  // Dùng TradingView scanner để lấy giá realtime
  try{
    let rows = null;
    if(!tickers){
      // All stocks — dùng tvScanMovers
      rows = await tvScanMovers('change','desc',100);
    } else {
      rows = await tvScanFetch(tickers.map(tvScanSym));
    }
    if(rows&&rows.length){
      const stocks = rows.map(r=>parseTVRow(r,TV_COLS)).filter(Boolean);
      if(stocks.length){ _vnHeatmapData={ts:Date.now(),data:stocks}; renderVNHeatmap(stocks); return; }
    }
  }catch(e){}

  // Fallback yfBatchQuotes (TV scan lần 2 nếu batch thất bại)
  try{
    const stocks = await yfBatchQuotes(tickers||VN_GROUPS.vn30);
    if(stocks.length){ _vnHeatmapData={ts:Date.now(),data:stocks}; renderVNHeatmap(stocks); return; }
  }catch(e){}

  if(grid) grid.innerHTML='<div class="hm-loading">Không tải được dữ liệu heatmap</div>';
}


function renderVNHeatmap(stocks){
  const grid    = document.getElementById('vnHeatmapGrid');
  if(!grid) return;

  const sizeBy  = document.getElementById('vnHmSizeBy')?.value || 'vol';
  const groupSel= document.getElementById('vnHmGroup')?.value  || 'all';

  // Lấy data từ cache nếu không truyền vào
  if(!stocks){
    const tickers = VN_GROUPS[groupSel] || VN_GROUPS.vn30;
    stocks = tickers.map(t => _vnHeatmapData[t]).filter(Boolean);
  }
  if(!stocks.length){
    grid.innerHTML = '<div class="hm-loading"><span>Chưa có dữ liệu. Nhấn Làm mới.</span></div>';
    return;
  }

  // Gán sizeVal
  stocks.forEach(d => {
    d.sizeVal = sizeBy === 'val' ? (d.val || 1)
              : sizeBy === 'equal' ? 1
              : (d.vol || 1);
    if(!d.sizeVal || d.sizeVal <= 0) d.sizeVal = 1;
  });

  stocks.sort((a,b) => b.sizeVal - a.sizeVal);

  const W = grid.clientWidth  || 900;
  const H = Math.max(grid.clientHeight || 500, 480);
  if(W < 10) return;

  const total = stocks.reduce((s,d) => s + d.sizeVal, 0);
  stocks.forEach(d => { d.norm = d.sizeVal / total; });

  // Squarified treemap
  

  const rects = squarify(stocks, {x:0, y:0, w:W, h:H});

  // Màu theo % thay đổi VN style (trần/sàn)
  function vnHmColor(d){
    const pct = d.changePct || 0;
    const ref = d.ref || 1;
    const price = d.price || 0;
    if(price >= ref * 1.069) return {bg:'rgba(0,255,255,.85)',  txt:'#000'};  // trần
    if(price <= ref * 0.931) return {bg:'rgba(255,0,255,.85)',  txt:'#fff'};  // sàn
    if(pct >=  5) return {bg:'rgba(22,163,74,.9)',   txt:'#fff'};
    if(pct >=  2) return {bg:'rgba(34,197,94,.85)',  txt:'#fff'};
    if(pct >=  0.5) return {bg:'rgba(21,128,61,.75)',txt:'#fff'};
    if(pct > -0.5 && pct < 0.5) return {bg:'rgba(71,85,105,.8)', txt:'#94a3b8'};
    if(pct > -2)  return {bg:'rgba(220,38,38,.75)', txt:'#fff'};
    if(pct > -5)  return {bg:'rgba(185,28,28,.85)',  txt:'#fff'};
    return {bg:'rgba(127,29,29,.9)', txt:'#fca5a5'};
  }

  const MIN_SHOW_NAME = 30, MIN_SHOW_PCT = 45;

  const cells = rects.map(({item:d, x, y, w, h}) => {
    const col = vnHmColor(d);
    const pct = d.changePct || 0;
    const sign = pct >= 0 ? '+' : '';
    const showName = w > MIN_SHOW_NAME && h > MIN_SHOW_NAME;
    const showPct  = w > MIN_SHOW_PCT  && h > MIN_SHOW_PCT;
    const fs = Math.max(8, Math.min(14, Math.sqrt(w*h)/6));
    return `<div class="hm-cell" style="
        position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;
        width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;
        background:${col.bg};color:${col.txt};
        font-size:${fs.toFixed(1)}px;border:1px solid rgba(0,0,0,.3);
        box-sizing:border-box;overflow:hidden;cursor:pointer;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
        transition:opacity .15s;"
      onclick="vnSelectStock('${d.ticker}')"
      title="${d.ticker} | ${VN_NAMES[d.ticker]||d.ticker} | ${vnFmtPrice(d.price)} | ${sign}${pct.toFixed(2)}%">
      ${showName ? `<span style="font-weight:800;letter-spacing:.3px;line-height:1.1">${d.ticker}</span>` : ''}
      ${showPct  ? `<span style="font-size:${(fs*.85).toFixed(1)}px;opacity:.9">${sign}${pct.toFixed(1)}%</span>` : ''}
    </div>`;
  }).join('');

  grid.style.position = 'relative';
  grid.style.height   = H + 'px';
  grid.innerHTML = cells;

  // Resize observer
  if(!grid._vnHmResizeObserver){
    grid._vnHmResizeObserver = new ResizeObserver(()=>renderVNHeatmap());
    grid._vnHmResizeObserver.observe(grid);
  }
}



// ── Expose functions to global scope for inline onclick ──
window.loadVNMarket = loadVNMarket;
window.clearSearch = clearSearch;
window.clearTriggeredAlerts = clearTriggeredAlerts;
window.exitFocusMode = exitFocusMode;
window.setSentFilter = setSentFilter;
window.sendChat = sendChat;
window.setAITab = setAITab;
window.copyBankAcc = copyBankAcc;
window.addAlert = addAlert;
window.setNewsSource = setNewsSource;
window.generateDailyReport = generateDailyReport;
window.setFocusTf = setFocusTf;
window.toggleChartFullscreen = toggleChartFullscreen;
window.loadVNIndices = loadVNIndices;
window.toggleChartIndicator = toggleChartIndicator;
window.setTab = setTab;

// ══════════════════════════════════════════════════
//  RESTORED VN FUNCTIONS
// ══════════════════════════════════════════════════

// ── VN Chart ─────────────────────────────────────
function loadVNChart(tf, el){
  document.querySelectorAll('#page-vn-chart .tf-btn').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
  const container = document.getElementById('vnChartContainer');
  if(!container) return;
  if(!_vnCurrentTicker){
    container.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:var(--muted)"><div style="font-size:32px">📊</div><div style="font-size:14px">Chọn mã cổ phiếu từ danh sách bên trái</div></div>';
    return;
  }
  const tfMap={'1D':'D','1T':'W','1M':'M','3T':'3M','1N':'12M'};
  const interval = tfMap[tf]||tfMap[el?.textContent?.trim()]||'D';
  try{ if(_vnTVWidget) _vnTVWidget.remove(); }catch(e){}
  _vnTVWidget=null;
  if(_vnChart){try{_vnChart.remove();}catch(e){}_vnChart=null;}
  container.innerHTML='';
  const spin=document.createElement('div');
  spin.style.cssText='display:flex;align-items:center;justify-content:center;height:100%;gap:8px';
  spin.innerHTML=`<div class="chart-spinner"></div><span style="color:var(--muted);font-size:12px">Đang tải ${_vnCurrentTicker}...</span>`;
  container.appendChild(spin);
  requestAnimationFrame(()=>_buildTVWidget(container, tvSym(_vnCurrentTicker), interval, _vnCurrentTicker));
}

// ── Stock left panel ──────────────────────────────
function _renderVNStockListPanel(){
  const wrap=document.getElementById('vnStockList');
  if(!wrap) return;
  const tickers=(VN_GROUPS?.vn30||[]).concat(
    (VN_POPULAR||[]).filter(t=>!(VN_GROUPS?.vn30||[]).includes(t))
  ).slice(0,50);
  wrap.innerHTML=tickers.map(t=>{
    const active=_vnCurrentTicker===t?'active':'';
    return `<div class="coin-list-item ${active}" onclick="vnSelectStock('${t}')">
      ${vnLogoHTML(t,28)}
      <div style="flex:1;min-width:0">
        <div class="cli-name">${t}</div>
        <div class="cli-sub">${(VN_NAMES[t]||'').slice(0,20)}</div>
      </div>
    </div>`;
  }).join('');
}

function renderVNQuickPicks(){
  const el=document.getElementById('vnQuickPicksPanel');
  if(!el) return;
  const picks=(VN_GROUPS?.vn30||VN_POPULAR||[]).slice(0,30);
  el.innerHTML=picks.map(t=>`
    <button class="vn-qp-btn" onclick="vnSelectStock('${t}')"
      style="display:inline-flex;align-items:center;gap:4px;">
      ${vnLogoHTML(t,16)}<span>${t}</span>
    </button>`).join('');
}

function vnSearchStock(q){
  const res=document.getElementById('vnSearchResults');
  if(!res) return;
  if(!q||q.length<1){res.innerHTML='';return;}
  const ql=q.toUpperCase();
  const allT=Object.keys(VN_NAMES||{}).concat(VN_POPULAR||[])
    .filter((v,i,a)=>a.indexOf(v)===i);
  const matches=allT.filter(t=>t.startsWith(ql)||(VN_NAMES[t]||'').toUpperCase().includes(ql)).slice(0,8);
  if(!matches.length){res.innerHTML='';return;}
  res.innerHTML=matches.map(t=>`
    <div class="vn-sr-item" onclick="vnSelectStock('${t}');document.getElementById('vnStockSearch').value='';document.getElementById('vnSearchResults').innerHTML=''"
      style="display:flex;align-items:center;gap:8px;padding:7px 10px;">
      ${vnLogoHTML(t,24)}
      <div><div style="font-size:12px;font-weight:700">${t}</div>
      <div style="font-size:10px;opacity:.6">${VN_NAMES[t]||''}</div></div>
    </div>`).join('');
}

function updateVNStockCard(d){
  if(!d) return;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v||'—';};
  const setC=(id,v,ref)=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.textContent=v||'—';
    el.className=el.className.replace(/\b(green|red|muted)\b/g,'');
    if(ref){el.classList.add(d.price>ref?'green':d.price<ref?'red':'muted');}
  };
  set('vnChartName',  d.name||VN_NAMES[d.ticker]||d.ticker);
  set('vnChartSym',   d.ticker);
  setC('vnChartPrice', vnFmtPrice(d.price), d.ref);
  set('vnChartRef',   vnFmtPrice(d.ref));
  set('vnChartCeil',  vnFmtPrice(d.ceil));
  set('vnChartFloor', vnFmtPrice(d.floor));
  set('vnChartVol',   vnFmtVol(d.vol));
  set('vnChartVal',   vnFmtVal(d.val));
  // Sidebar
  set('vnSbRef',      vnFmtPrice(d.ref));
  set('vnSbHigh',     vnFmtPrice(d.high||d.ceil));
  set('vnSbLow',      vnFmtPrice(d.low||d.floor));
  set('vnSbExchange', d.exchange||'HOSE');
  // Info panel
  set('vnInfoTicker', d.ticker);
  set('vnInfoName',   d.name||VN_NAMES[d.ticker]||d.ticker);
  set('vnInfoPrice',  vnFmtPrice(d.price));
  set('vnInfoRef',    vnFmtPrice(d.ref));
  set('vnInfoCeil',   vnFmtPrice(d.ceil));
  set('vnInfoFloor',  vnFmtPrice(d.floor));
  set('vnInfoVol',    vnFmtVol(d.vol));
  set('vnInfoVal',    vnFmtVal(d.val));
  set('vnInfoHigh',   vnFmtPrice(d.high));
  set('vnInfoLow',    vnFmtPrice(d.low));
  if(d.change!==undefined){
    const sign=d.change>=0?'+':'';
    set('vnChartChg', `${sign}${vnFmtPrice(d.change)} (${sign}${(d.changePct||0).toFixed(2)}%)`);
    const chgEl=document.getElementById('vnChartChg');
    if(chgEl) chgEl.style.color=d.change>0?'var(--green)':d.change<0?'var(--red)':'var(--muted)';
  }
}

// ── Watchlist ─────────────────────────────────────
const VN_WL_KEY='vlc_vn_watchlist';
function _getWatchlist(){try{return JSON.parse(localStorage.getItem(VN_WL_KEY)||'[]');}catch{return[];}}
function _saveWatchlist(arr){localStorage.setItem(VN_WL_KEY,JSON.stringify(arr));}

function renderVNWatchlist(){
  const tbody=document.getElementById('vnWatchlistBody');
  if(!tbody) return;
  const list=_getWatchlist();
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="10" class="vn-loading">Thêm mã CK để theo dõi</td></tr>';
    return;
  }
  tbody.innerHTML=list.map((t,i)=>{
    const col=VN_BRAND[t]||_vnColor(t);
    return `<tr style="cursor:pointer" onclick="vnSelectStock('${t}')">
      <td style="color:var(--muted);font-size:11px">${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">${vnLogoHTML(t,24)}
        <div><div style="font-size:12px;font-weight:700">${t}</div>
        <div style="font-size:10px;color:var(--muted)">${(VN_NAMES[t]||'').slice(0,20)}</div></div>
      </div></td>
      <td class="r" id="wl_p_${t}">—</td>
      <td class="r" id="wl_c_${t}">—</td>
      <td class="r" id="wl_tr_${t}" style="color:#a855f7">—</td>
      <td class="r" id="wl_tc_${t}">—</td>
      <td class="r" id="wl_fl_${t}" style="color:#06b6d4">—</td>
      <td class="r" id="wl_v_${t}" style="color:var(--muted)">—</td>
      <td><span class="sig hold" id="wl_sig_${t}">—</span></td>
      <td><button onclick="event.stopPropagation();vnRemoveFromWatchlist('${t}')"
        style="background:rgba(239,68,68,.15);border:none;color:#ef4444;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px">✕</button></td>
    </tr>`;
  }).join('');
}

function vnAddToWatchlist(ticker){
  if(!ticker) {
    const inp=document.getElementById('vnWlInput');
    if(inp) ticker=inp.value.trim().toUpperCase();
  }
  if(!ticker) return;
  const list=_getWatchlist();
  if(list.includes(ticker)){alert(`${ticker} đã có trong danh mục`);return;}
  list.push(ticker);
  _saveWatchlist(list);
  renderVNWatchlist();
  const inp=document.getElementById('vnWlInput');
  if(inp) inp.value='';
}

function vnRemoveFromWatchlist(ticker){
  const list=_getWatchlist().filter(t=>t!==ticker);
  _saveWatchlist(list);
  renderVNWatchlist();
}

// ── Movers ───────────────────────────────────────
let _vnMoverTab='gainers';
async function loadVNMovers(){
  const body=document.getElementById('vnMoversBody');
  if(body) body.innerHTML='<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted)"><div class="spinner" style="margin:0 auto 8px;border-top-color:#e8192c"></div>Đang tải...</td></tr>';
  try{
    let stocks=[];
    // Xác định sort theo tab đang active
    const tab = _vnMoverTab||'gainers';
    const sortBy    = tab==='volume'?'volume':'change';
    const sortOrder = tab==='losers'?'asc':'desc';

    // TV Scanner (không bị CORS)
    try{
      const rows = await tvScanMovers(sortBy, sortOrder, 60);
      stocks = rows.map(r=>parseTVRow(r,TV_COLS)).filter(Boolean);
    }catch(e){}

    // Fallback: VN30 qua fetchVNSingle (đã có allorigins proxy)
    if(!stocks.length){
      const tickers=(VN_GROUPS?.vn30||VN_POPULAR||[]).slice(0,30);
      const settled=await Promise.allSettled(tickers.map(t=>fetchVNSingle(t)));
      stocks=settled.map((r,i)=>r.status==='fulfilled'&&r.value?
        {ticker:tickers[i],name:VN_NAMES[tickers[i]]||tickers[i],...r.value}:null
      ).filter(Boolean);
    }

    if(stocks.length) renderVNMovers(stocks);
    else throw new Error('no data');
  }catch(e){
    if(body) body.innerHTML='<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted)">Không tải được dữ liệu</td></tr>';
  }
}

function renderVNMovers(stocks){
  const body=document.getElementById('vnMoversBody');
  if(!body){
    // Fallback: tìm container movers
    const wrap=document.querySelector('.vn-movers-wrap');
    if(wrap) wrap.innerHTML='<div style="padding:20px;text-align:center;color:var(--muted)">Đang tải...</div>';
    return;
  }
  const sorted=[...stocks].sort((a,b)=>
    _vnMoverTab==='gainers'?b.changePct-a.changePct:
    _vnMoverTab==='losers' ?a.changePct-b.changePct:
    b.vol-a.vol
  ).slice(0,10);
  body.innerHTML=sorted.map((r,i)=>{
    const pct=r.changePct||0;
    const cls=pct>0?'green':pct<0?'red':'muted';
    return `<tr onclick="vnSelectStock('${r.ticker}')" style="cursor:pointer">
      <td><span class="rank">${i+1}</span></td>
      <td><div style="display:flex;align-items:center;gap:6px">${vnLogoHTML(r.ticker,22)}
        <div><div style="font-size:11px;font-weight:700">${r.ticker}</div>
        <div style="font-size:9px;color:var(--muted)">${(r.name||'').slice(0,14)}</div></div>
      </div></td>
      <td class="r ${cls}" style="font-weight:700">${r.price>0?vnFmtPrice(r.price):'—'}</td>
      <td class="r"><span class="badge ${pct>0?'up':pct<0?'dn':'unch'}">${pct>0?'+':''}${pct.toFixed(2)}%</span></td>
      <td class="r" style="color:var(--muted);font-size:11px">${vnFmtVol(r.vol)}</td>
    </tr>`;
  }).join('');
}

function switchVNMover(tab, el){
  _vnMoverTab=tab;
  document.querySelectorAll('.vn-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  loadVNMovers();
}

window.renderVNWatchlist = renderVNWatchlist;
window.fetchNews = fetchNews;
window.setTf = setTf;
window.clearChat = clearChat;
window.runAllAIPreds = runAllAIPreds;
window.runAISignals = runAISignals;
window.quickAsk = quickAsk;
window.loadVNNews = loadVNNews;
window.switchRightPanel = switchRightPanel;
window.showPage = showPage;
window.switchMarket = switchMarket;

// ── Forex auto-refresh every 60s ──────────────────────────────────
setInterval(()=>{
  if(document.body.classList.contains('market-forex') && !_fxLoading){
    loadFxMarket();
  }
}, 60000);
window.showVNPage = showVNPage;
window.loadVNChart = loadVNChart;
// ── Donate button từ header (visible ở mọi tab) ──

// ══════════════════════════════════════════════════════════════
//  🧠 SENTIMENT DASHBOARD
//  Nguồn: alternative.me (Fear&Greed) · Binance Futures (FR, L/S)
//         CoinGecko (BTC dominance, BTC price history)
// ══════════════════════════════════════════════════════════════

let _sentLoaded = false;
let _sentInterval = null;
let _fgHistory = [];        // [{value, timestamp, price}]
let _frCountdownTimer = null;

// Màu sắc theo mức F&G
function _fgColor(score){
  if(score <= 20)  return '#ef4444';   // Extreme Fear
  if(score <= 40)  return '#f97316';   // Fear
  if(score <= 60)  return '#fbbf24';   // Neutral
  if(score <= 80)  return '#84cc16';   // Greed
  return '#22c55e';                    // Extreme Greed
}
function _fgClass(score){
  if(score <= 20)  return 'Sợ Hãi Cực Độ';
  if(score <= 40)  return 'Sợ Hãi';
  if(score <= 60)  return 'Trung Lập';
  if(score <= 80)  return 'Tham Lam';
  return 'Tham Lam Cực Độ';
}

// Vẽ Gauge bán vòng tròn trên canvas
function _drawFGGauge(canvas, score){
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W/2, cy = H - 20, r = Math.min(W, H*1.8)/2 - 14;

  // Segments gradient: đỏ → cam → vàng → xanh lá nhạt → xanh lá
  const segments = [
    {from: Math.PI, to: Math.PI*1.2, color:'#ef4444'},
    {from: Math.PI*1.2, to: Math.PI*1.4, color:'#f97316'},
    {from: Math.PI*1.4, to: Math.PI*1.6, color:'#fbbf24'},
    {from: Math.PI*1.6, to: Math.PI*1.8, color:'#84cc16'},
    {from: Math.PI*1.8, to: Math.PI*2,   color:'#22c55e'},
  ];
  segments.forEach(s => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, s.from, s.to);
    ctx.lineWidth = 22;
    ctx.strokeStyle = s.color;
    ctx.lineCap = 'butt';
    ctx.stroke();
  });

  // Track background (dim)
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI*2);
  ctx.lineWidth = 22;
  ctx.strokeStyle = 'rgba(255,255,255,.04)';
  ctx.stroke();

  // Redraw segments on top
  segments.forEach(s => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, s.from, s.to);
    ctx.lineWidth = 20;
    ctx.strokeStyle = s.color + 'cc';
    ctx.stroke();
  });

  // Needle
  const angle = Math.PI + (score / 100) * Math.PI;
  const nx = cx + (r - 10) * Math.cos(angle);
  const ny = cy + (r - 10) * Math.sin(angle);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Labels
  ctx.font = 'bold 10px system-ui';
  ctx.fillStyle = '#ef4444';
  ctx.textAlign = 'center';
  ctx.fillText('0', cx - r - 2, cy + 14);
  ctx.fillStyle = '#22c55e';
  ctx.fillText('100', cx + r + 4, cy + 14);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText('50', cx, cy - r - 8);
}

// Vẽ biểu đồ lịch sử F&G 30 ngày
function _drawFGHistory(canvas, data){
  if(!data || data.length < 2) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 600;
  canvas.width = W;
  const H = parseInt(canvas.getAttribute('height')) || 160;
  ctx.clearRect(0, 0, W, H);

  const pad = {l:36, r:12, t:10, b:24};
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const n  = data.length;

  // Normalize prices
  const prices = data.map(d=>d.price||0).filter(p=>p>0);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const priceRange = maxP - minP || 1;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,.04)';
  ctx.lineWidth = .5;
  [0,25,50,75,100].forEach(v=>{
    const y = pad.t + ch - (v/100)*ch;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W-pad.r, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(v, pad.l-4, y+3);
  });

  // BTC price line (secondary axis)
  if(prices.length === n){
    ctx.beginPath();
    data.forEach((d,i)=>{
      const x = pad.l + (i/(n-1))*cw;
      const y = pad.t + ch - ((d.price - minP)/priceRange)*ch;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.strokeStyle = 'rgba(245,158,11,.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3,3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // F&G area fill
  ctx.beginPath();
  data.forEach((d,i)=>{
    const x = pad.l + (i/(n-1))*cw;
    const y = pad.t + ch - (d.value/100)*ch;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.lineTo(pad.l+cw, pad.t+ch);
  ctx.lineTo(pad.l, pad.t+ch);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t+ch);
  grad.addColorStop(0, 'rgba(167,139,250,.35)');
  grad.addColorStop(1, 'rgba(167,139,250,.02)');
  ctx.fillStyle = grad;
  ctx.fill();

  // F&G line
  ctx.beginPath();
  data.forEach((d,i)=>{
    const x = pad.l + (i/(n-1))*cw;
    const y = pad.t + ch - (d.value/100)*ch;
    i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
  });
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dots at extremes
  data.forEach((d,i)=>{
    const x = pad.l + (i/(n-1))*cw;
    const y = pad.t + ch - (d.value/100)*ch;
    if(d.value <= 20 || d.value >= 80){
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI*2);
      ctx.fillStyle = _fgColor(d.value);
      ctx.fill();
    }
  });

  // X axis labels (first, middle, last)
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  [[0,'hôm nay'], [Math.floor(n/2),'-15d'], [n-1,'-30d']].forEach(([i,lbl])=>{
    const x = pad.l + (i/(n-1))*cw;
    ctx.fillText(lbl, x, H-6);
  });
}

// Render Long/Short table
function _renderLSTable(data){
  const el = document.getElementById('lsTable');
  if(!el) return;
  if(!data || !data.length){
    el.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:12px">Không có dữ liệu</div>';
    return;
  }
  el.innerHTML = data.map(d=>{
    const ratio  = parseFloat(d.longShortRatio) || 1;
    const longPct  = ((ratio/(1+ratio))*100).toFixed(1);
    const shortPct = (100 - parseFloat(longPct)).toFixed(1);
    const lCol = parseFloat(longPct) > 55 ? '#22c55e' : parseFloat(longPct) < 45 ? '#ef4444' : '#fbbf24';
    return `<div class="sent-row">
      <span style="font-size:12px;font-weight:800;color:var(--text);width:44px;flex-shrink:0">${d.sym}</span>
      <div class="sent-bar-wrap">
        <div class="sent-bar-long" style="width:${longPct}%"></div>
        <div class="sent-bar-short" style="width:${shortPct}%"></div>
      </div>
      <span style="font-size:11px;color:${lCol};font-weight:700;width:52px;text-align:right;flex-shrink:0">
        L ${longPct}%
      </span>
    </div>`;
  }).join('');
}

// Render Funding Rate table
function _renderFRTable(data){
  const el = document.getElementById('frTable');
  if(!el) return;
  if(!data || !data.length){
    el.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:12px;padding:12px">Không có dữ liệu</div>';
    return;
  }
  el.innerHTML = data.map(d=>{
    const rate = d.rate;
    const cls  = rate > 0.01 ? 'fr-rate-pos' : rate < -0.01 ? 'fr-rate-neg' : 'fr-rate-neu';
    const sign = rate > 0 ? '+' : '';
    const bg   = rate > 0.05 ? 'rgba(34,197,94,.06)' : rate < -0.02 ? 'rgba(239,68,68,.06)' : 'rgba(255,255,255,.02)';
    return `<div class="fr-row" style="background:${bg}">
      <span style="font-size:12px;font-weight:800;color:var(--text);width:44px">${d.sym}</span>
      <span style="font-size:10px;color:var(--muted);flex:1">
        ${rate > 0.05 ? '⚠ Long nhiều' : rate < -0.02 ? '⚠ Short nhiều' : '● Bình thường'}
      </span>
      <span class="${cls}">${sign}${(rate).toFixed(4)}%</span>
    </div>`;
  }).join('');
}

// Kiểm tra và hiện alerts cực đoan
function _checkSentAlerts(fg, lsRatio, frBTC){
  const alerts = [];
  if(fg <= 15) alerts.push('🔴 <strong>Fear & Greed cực thấp (' + fg + ')</strong> — Tín hiệu mua ngược chiều (contrarian buy)');
  if(fg >= 90) alerts.push('🟡 <strong>Fear & Greed cực cao (' + fg + ')</strong> — Thị trường tham lam quá mức, cẩn thận bán ra');
  if(frBTC > 0.08) alerts.push('⚠ <strong>Funding Rate BTC cao (+' + frBTC.toFixed(4) + '%)</strong> — Long quá nhiều, rủi ro squeeze');
  if(frBTC < -0.03) alerts.push('⚠ <strong>Funding Rate BTC âm (' + frBTC.toFixed(4) + '%)</strong> — Short quá nhiều, rủi ro short squeeze');
  if(lsRatio && lsRatio > 1.8) alerts.push('📊 Long/Short BTC rất cao (' + lsRatio.toFixed(2) + ') — Đa số đang long');
  if(lsRatio && lsRatio < 0.6) alerts.push('📊 Long/Short BTC rất thấp (' + lsRatio.toFixed(2) + ') — Đa số đang short');

  const box  = document.getElementById('sentAlerts');
  const list = document.getElementById('sentAlertsList');
  if(!box || !list) return;
  if(alerts.length){
    list.innerHTML = alerts.join('<br>');
    box.style.display = 'block';
  } else {
    box.style.display = 'none';
  }
}

// Countdown đến lần funding tiếp theo (mỗi 8h: 00:00, 08:00, 16:00 UTC)
function _startFRCountdown(){
  if(_frCountdownTimer) clearInterval(_frCountdownTimer);
  function _tick(){
    const el = document.getElementById('fr-countdown');
    if(!el) return;
    const now  = new Date();
    const utcH = now.getUTCHours(), utcM = now.getUTCMinutes(), utcS = now.getUTCSeconds();
    const nextH = Math.ceil((utcH + 1/60) / 8) * 8 % 24;
    let diffSec = ((nextH - utcH)*3600 - utcM*60 - utcS + 86400) % 86400;
    if(diffSec === 0) diffSec = 28800;
    const h = String(Math.floor(diffSec/3600)).padStart(2,'0');
    const m = String(Math.floor((diffSec%3600)/60)).padStart(2,'0');
    const s = String(diffSec%60).padStart(2,'0');
    el.textContent = h + ':' + m + ':' + s;
  }
  _tick();
  _frCountdownTimer = setInterval(_tick, 1000);
}

// ─── MAIN LOAD FUNCTION ─────────────────────────────────────
async function loadSentiment(){
  _startFRCountdown();

  // Update metric card helpers
  function setMetric(id, val, sub, color){
    const el = document.getElementById(id);
    if(!el) return;
    const valEl = el.querySelector('.smc-val');
    const subEl = el.querySelector('.smc-sub');
    if(valEl){ valEl.textContent = val; if(color) valEl.style.color = color; }
    if(subEl && sub) subEl.textContent = sub;
  }
  function setCard(id, accent){
    const el = document.getElementById(id);
    if(el && accent) el.style.borderColor = accent + '55';
  }

  let fgScore = 50, fgYday = 50, fgLastWeek = 50, frBTC = 0, lsRatioBTC = 1;

  // ── 1. Fear & Greed Index ──────────────────────────────────
  try{
    const r = await fetch('https://api.alternative.me/fng/?limit=35', {signal:AbortSignal.timeout(8000)});
    const j = await r.json();
    const arr = j.data || [];
    fgScore    = parseInt(arr[0]?.value  || 50);
    fgYday     = parseInt(arr[1]?.value  || 50);
    fgLastWeek = parseInt(arr[7]?.value  || 50);

    // Gauge
    const canvas = document.getElementById('fgGauge');
    if(canvas) _drawFGGauge(canvas, fgScore);

    // Score + class
    const col = _fgColor(fgScore);
    const scoreEl = document.getElementById('fgScore');
    const classEl = document.getElementById('fgClass');
    if(scoreEl){ scoreEl.textContent = fgScore; scoreEl.style.color = col; }
    if(classEl){ classEl.textContent = _fgClass(fgScore); classEl.style.color = col; }

    // Yesterday / last week
    const ydEl = document.getElementById('fg-yesterday');
    const lwEl = document.getElementById('fg-lastweek');
    if(ydEl){ ydEl.textContent = fgYday; ydEl.style.color = _fgColor(fgYday); }
    if(lwEl){ lwEl.textContent = fgLastWeek; lwEl.style.color = _fgColor(fgLastWeek); }

    // Metric card
    setMetric('sm-fg', fgScore, _fgClass(fgScore), col);
    setCard('sm-fg', col);

    // Build history data (last 30)
    _fgHistory = arr.slice(0,30).reverse().map(d=>({
      value: parseInt(d.value),
      timestamp: parseInt(d.timestamp)*1000,
      price: 0,
    }));
  }catch(e){ setMetric('sm-fg','—','Lỗi kết nối'); }

  // ── 2. BTC Price history để overlay ───────────────────────
  try{
    const r = await fetch(
      'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=35',
      {signal:AbortSignal.timeout(8000)});
    const klines = await r.json();
    klines.slice(-30).forEach((k,i)=>{
      if(_fgHistory[i]) _fgHistory[i].price = parseFloat(k[4]);
    });
    const histCanvas = document.getElementById('fgHistory');
    if(histCanvas) _drawFGHistory(histCanvas, _fgHistory);
  }catch(e){}

  // ── 3. BTC Dominance (CoinGecko) ──────────────────────────
  try{
    const r = await fetch('https://api.coingecko.com/api/v3/global', {signal:AbortSignal.timeout(8000)});
    const j = await r.json();
    const dom = j.data?.market_cap_percentage?.btc || 0;
    setMetric('sm-dom', dom.toFixed(1)+'%',
      dom > 55 ? 'Altcoin chưa bùng nổ' : dom < 45 ? 'Altseason đang diễn ra' : 'Thị trường cân bằng',
      dom > 55 ? '#f59e0b' : '#22c55e');
    setCard('sm-dom', dom > 55 ? '#f59e0b' : '#22c55e');
  }catch(e){ setMetric('sm-dom','—','CoinGecko timeout'); }

  // ── 4. Long/Short Ratio top 8 coins ───────────────────────
  const LS_COINS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT'];
  try{
    const results = await Promise.allSettled(LS_COINS.map(async sym=>{
      const r = await fetch(
        `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`,
        {signal:AbortSignal.timeout(6000)});
      if(!r.ok) throw 0;
      const d = await r.json();
      return { sym: sym.replace('USDT',''), longShortRatio: d[0]?.longShortRatio || 1 };
    }));
    const lsData = results.filter(r=>r.status==='fulfilled').map(r=>r.value);
    if(lsData.length){
      lsRatioBTC = parseFloat(lsData[0]?.longShortRatio || 1);
      const lsPct = ((lsRatioBTC/(1+lsRatioBTC))*100).toFixed(1);
      setMetric('sm-ls', lsPct+'% L',
        lsRatioBTC > 1.3 ? 'Long chiếm ưu thế' : lsRatioBTC < 0.8 ? 'Short chiếm ưu thế' : 'Cân bằng',
        lsRatioBTC > 1.3 ? '#22c55e' : lsRatioBTC < 0.8 ? '#ef4444' : '#fbbf24');
      setCard('sm-ls', lsRatioBTC > 1.3 ? '#22c55e' : '#ef4444');
      _renderLSTable(lsData);
    }
  }catch(e){ setMetric('sm-ls','—','Binance timeout'); }

  // ── 5. Funding Rate top 10 ─────────────────────────────────
  const FR_COINS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT',
                    'DOGEUSDT','ADAUSDT','AVAXUSDT','DOTUSDT','LINKUSDT'];
  try{
    const r = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex', {signal:AbortSignal.timeout(8000)});
    const all = await r.json();
    const frData = all
      .filter(d=>FR_COINS.includes(d.symbol))
      .map(d=>({ sym: d.symbol.replace('USDT',''), rate: parseFloat(d.lastFundingRate)*100 }))
      .sort((a,b)=>Math.abs(b.rate)-Math.abs(a.rate));

    frBTC = frData.find(d=>d.sym==='BTC')?.rate || 0;
    const frSign = frBTC > 0 ? '+' : '';
    setMetric('sm-fr', frSign+frBTC.toFixed(4)+'%',
      frBTC > 0.05 ? 'Long nhiều — cẩn thận' : frBTC < -0.02 ? 'Short nhiều — dễ squeeze' : 'Bình thường',
      frBTC > 0.05 ? '#f97316' : frBTC < -0.02 ? '#ef4444' : '#22c55e');
    setCard('sm-fr', frBTC > 0.05 ? '#f97316' : frBTC < 0 ? '#ef4444' : '#22c55e');
    _renderFRTable(frData);
  }catch(e){ setMetric('sm-fr','—','Binance timeout'); }

  // ── 6. Extreme alerts ─────────────────────────────────────
  _checkSentAlerts(fgScore, lsRatioBTC, frBTC);

  _sentLoaded = true;
}

// Auto refresh sentiment mỗi 5 phút khi tab đang active
setInterval(()=>{
  if(document.getElementById('page-sentiment')?.classList.contains('active')){
    loadSentiment();
  }
}, 5*60*1000);

window.loadSentiment = loadSentiment;

function showDonateGlobal(){
  // Hiện page donate
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-donate');
  if(pg) pg.classList.add('active');

  // Ẩn TẤT CẢ sub-nav → không tab nào được focus
  ['subNavCrypto','subNavVN','subNavForex'].forEach(id => {
    const nav = document.getElementById(id);
    if(nav) nav.style.display = 'none';
  });

  // Bỏ active khỏi tất cả sub-tab
  document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));

  // Bỏ active khỏi tất cả nút header market (hm-btn, top-tab)
  document.querySelectorAll('.hm-btn, .top-tab').forEach(b => b.classList.remove('active'));
}
window.showDonateGlobal = showDonateGlobal;

window.vnSelectStock = vnSelectStock;
window.vnSearchStock = vnSearchStock;
window.vnAddToWatchlist = vnAddToWatchlist;
window.vnRemoveFromWatchlist = vnRemoveFromWatchlist;
window.loadVNMovers = loadVNMovers;
window.switchVNMover = switchVNMover;
window.setVNNewsFilter = setVNNewsFilter;
window.renderVNHeatmap = renderVNHeatmap;
window.loadVNHeatmap = loadVNHeatmap;
window.renderHeatmap = renderHeatmap;
window.renderVNMovers = renderVNMovers;

async function vnSelectStock(ticker){
  _updateVNChartLogo(ticker);
  // Update header logo box
  const logoBox = document.getElementById('vnChartLogoBox');
  if(logoBox){ logoBox.textContent=ticker.slice(0,2); logoBox.style.background=_vnColor(ticker)+'22'; logoBox.style.color=_vnColor(ticker); logoBox.style.borderColor=_vnColor(ticker)+'44'; }
  const nameEl = document.getElementById('vnChartName');
  if(nameEl) nameEl.textContent = VN_NAMES[ticker]||ticker;
  const symEl = document.getElementById('vnChartSym');
  if(symEl) symEl.textContent = ticker;
  // Hide loading, update info panel
  document.getElementById('vnChartLoading') && (document.getElementById('vnChartLoading').style.display='none');
  ['vnInfoTicker','vnInfoName'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=id==='vnInfoTicker'?ticker:(VN_NAMES[ticker]||'—'); });
  // Refresh list highlight
  document.querySelectorAll('#vnStockList .coin-list-item').forEach(el=>{
    el.classList.toggle('active', el.querySelector('div>div')?.textContent===ticker);
  });
  _vnCurrentTicker = ticker;
  // 1. Chuyển sang tab chart
  showVNPage('vn-chart', document.getElementById('stab-vn-chart'));
  // 2. Load chart với ticker đã set
  const activeTf = document.querySelector('#page-vn-chart .tf-btn.active');
  loadVNChart(activeTf?.textContent||'1D', activeTf);
  // 3. Update info card (non-blocking)
  try{
    const d = await fetchVNSingle(ticker);
    if(d){
      updateVNStockCard(d);
      // Update right panel info
      const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v||'—';};
      set('vnChartPrice',  vnFmtPrice(d.price));
      set('vnChartRef',    vnFmtPrice(d.ref));
      set('vnChartCeil',   vnFmtPrice(d.ceil));
      set('vnChartFloor',  vnFmtPrice(d.floor));
      set('vnChartVol',    vnFmtVol(d.vol));
      set('vnChartVal',    vnFmtVal(d.val));
      set('vnSbHigh',      vnFmtPrice(d.high));
      set('vnSbLow',       vnFmtPrice(d.low));
      set('vnSbRef',       vnFmtPrice(d.ref));
      set('vnInfoPrice',   vnFmtPrice(d.price));
      set('vnInfoChange',  (d.change>=0?'+':'')+vnFmtPrice(d.change)+' ('+(d.changePct>=0?'+':'')+d.changePct.toFixed(2)+'%)');
      set('vnInfoRef',     vnFmtPrice(d.ref));
      set('vnInfoCeil',    vnFmtPrice(d.ceil));
      set('vnInfoFloor',   vnFmtPrice(d.floor));
      set('vnInfoVol',     vnFmtVol(d.vol));
      set('vnInfoVal',     vnFmtVal(d.val));
      set('vnInfoHigh',    vnFmtPrice(d.high));
      set('vnInfoLow',     vnFmtPrice(d.low));
      const chgEl=document.getElementById('vnChartChg');
      if(chgEl){
        const pct=d.changePct||0;
        chgEl.textContent=(pct>=0?'+':'')+pct.toFixed(2)+'%';
        chgEl.className='chart-chg '+(pct>0?'up':pct<0?'dn':'');
      }
    }
  }catch(e){}
}

// ══════════════════════════════════════════════════════════════════
// 🌐 FOREX MODULE — Ngoại Hối
// Nguồn dữ liệu: ExchangeRate-API (free, CORS OK) + Frankfurter API
// ══════════════════════════════════════════════════════════════════

// ── Forex pair definitions ────────────────────────────────────────


// ╔══════════════════════════════════════════════════════════════════════╗
// ║  MODULE 3 — NGOẠI HỐI TOÀN CẦU 🌐                                  ║
// ║  Nguồn dữ liệu: Frankfurter API (ECB) + TradingView Widget          ║
// ║  ✅ Sửa file này KHÔNG ảnh hưởng Crypto hoặc VN                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

const FX_PAIRS = {
  major: [
    {sym:'EURUSD',base:'EUR',quote:'USD',name:'Euro / US Dollar',flag:'🇪🇺🇺🇸'},
    {sym:'GBPUSD',base:'GBP',quote:'USD',name:'Bảng Anh / US Dollar',flag:'🇬🇧🇺🇸'},
    {sym:'USDJPY',base:'USD',quote:'JPY',name:'US Dollar / Yên Nhật',flag:'🇺🇸🇯🇵'},
    {sym:'USDCHF',base:'USD',quote:'CHF',name:'US Dollar / Franc TT',flag:'🇺🇸🇨🇭'},
    {sym:'AUDUSD',base:'AUD',quote:'USD',name:'Đô la Úc / US Dollar',flag:'🇦🇺🇺🇸'},
    {sym:'USDCAD',base:'USD',quote:'CAD',name:'US Dollar / Đô la CA',flag:'🇺🇸🇨🇦'},
    {sym:'NZDUSD',base:'NZD',quote:'USD',name:'Đô la NZ / US Dollar',flag:'🇳🇿🇺🇸'},
  ],
  minor: [
    {sym:'EURGBP',base:'EUR',quote:'GBP',name:'Euro / Bảng Anh',flag:'🇪🇺🇬🇧'},
    {sym:'EURJPY',base:'EUR',quote:'JPY',name:'Euro / Yên Nhật',flag:'🇪🇺🇯🇵'},
    {sym:'GBPJPY',base:'GBP',quote:'JPY',name:'Bảng Anh / Yên Nhật',flag:'🇬🇧🇯🇵'},
    {sym:'AUDJPY',base:'AUD',quote:'JPY',name:'Đô la Úc / Yên Nhật',flag:'🇦🇺🇯🇵'},
    {sym:'CHFJPY',base:'CHF',quote:'JPY',name:'Franc TT / Yên Nhật',flag:'🇨🇭🇯🇵'},
    {sym:'EURCHF',base:'EUR',quote:'CHF',name:'Euro / Franc Thụy Sĩ',flag:'🇪🇺🇨🇭'},
    {sym:'GBPCHF',base:'GBP',quote:'CHF',name:'Bảng Anh / Franc TT',flag:'🇬🇧🇨🇭'},
    {sym:'EURAUD',base:'EUR',quote:'AUD',name:'Euro / Đô la Úc',flag:'🇪🇺🇦🇺'},
    {sym:'SGDUSD',base:'SGD',quote:'USD',name:'Đô la SG / US Dollar',flag:'🇸🇬🇺🇸'},
  ],
  vnd: [
    {sym:'USDVND',base:'USD',quote:'VND',name:'US Dollar / Đồng VN',flag:'🇺🇸🇻🇳'},
    {sym:'EURVND',base:'EUR',quote:'VND',name:'Euro / Đồng VN',flag:'🇪🇺🇻🇳'},
    {sym:'JPYVND',base:'JPY',quote:'VND',name:'Yên Nhật / Đồng VN',flag:'🇯🇵🇻🇳'},
    {sym:'GBPVND',base:'GBP',quote:'VND',name:'Bảng Anh / Đồng VN',flag:'🇬🇧🇻🇳'},
    {sym:'CNYVND',base:'CNY',quote:'VND',name:'Nhân dân tệ / Đồng VN',flag:'🇨🇳🇻🇳'},
    {sym:'KRWVND',base:'KRW',quote:'VND',name:'Won HQ / Đồng VN',flag:'🇰🇷🇻🇳'},
    {sym:'SGDVND',base:'SGD',quote:'VND',name:'Đô la SG / Đồng VN',flag:'🇸🇬🇻🇳'},
    {sym:'THBVND',base:'THB',quote:'VND',name:'Baht Thái / Đồng VN',flag:'🇹🇭🇻🇳'},
  ],
};
const FX_ALL_PAIRS = [...FX_PAIRS.major, ...FX_PAIRS.minor, ...FX_PAIRS.vnd];

// ── Forex state ───────────────────────────────────────────────────
let _fxRates = {};          // {USD:1, EUR:0.92, ...} base=USD
let _fxData  = [];          // enriched pair data
let _fxGroup = 'major';
let _fxCurrentPair = 'EURUSD';
let _fxCurrentTf   = '1D';
let _fxChart = null;
let _fxSeries = null;
let _fxLoading = false;

// ── Sessions definition (UTC+7 times) ────────────────────────────
const FX_SESSIONS = [
  {name:'Sydney',    vn:'SYDNEY',    open:5,  close:14, color:'#0ea5e9', pairs:['AUDUSD','NZDUSD','AUDJPY']},
  {name:'Tokyo',     vn:'TOKYO',     open:7,  close:16, color:'#f59e0b', pairs:['USDJPY','EURJPY','GBPJPY']},
  {name:'London',    vn:'LUÂN ĐÔN',  open:14, close:23, color:'#8b5cf6', pairs:['GBPUSD','EURUSD','EURGBP']},
  {name:'New York',  vn:'NEW YORK',   open:19, close:4,  color:'#00d4ff', pairs:['EURUSD','GBPUSD','USDCAD']},
];

// ── Fetch rates from Frankfurter (free, CORS OK, ECB data) ────────
async function _fxFetchRates(){
  try{
    // Frankfurter API — ECB rates, free, CORS enabled
    const r = await fetch('https://api.frankfurter.app/latest?from=USD', {signal:AbortSignal.timeout(8000)});
    if(!r.ok) throw new Error('frankfurter '+r.status);
    const j = await r.json();
    // rates are relative to USD base
    const rates = {USD:1, ...j.rates};
    // Add VND via separate call if not present
    if(!rates.VND){
      try{
        const r2 = await fetch('https://api.frankfurter.app/latest?from=USD&to=VND,THB,KRW,SGD,MYR,HKD', {signal:AbortSignal.timeout(6000)});
        if(r2.ok){ const j2=await r2.json(); Object.assign(rates, j2.rates||{}); }
      }catch(e){}
    }
    return rates;
  }catch(e){}

  // Fallback: ExchangeRate-API (free tier)
  try{
    const r = await fetch('https://open.er-api.com/v6/latest/USD', {signal:AbortSignal.timeout(8000)});
    if(!r.ok) throw new Error('erate '+r.status);
    const j = await r.json();
    return j.rates||{};
  }catch(e){}

  return null;
}

// ── Calculate pair price from rates ──────────────────────────────
function _fxCalcPair(base, quote, rates){
  if(!rates[base] || !rates[quote]) return null;
  if(base==='USD') return rates[quote];
  if(quote==='USD') return 1/rates[base];
  return rates[quote] / rates[base];
}

// ── Format forex price (respects pip precision) ───────────────────
function _fxFmt(val, quote){
  if(!val || isNaN(val)) return '—';
  if(quote==='JPY'||quote==='VND'||quote==='KRW') return val.toLocaleString('vi-VN',{maximumFractionDigits:quote==='VND'?0:2});
  return val.toFixed(4);
}

// ── Simulate 24h change using small random (real API would use historical) ──
// We store previous rates in sessionStorage to calc real change
function _fxGetChange(sym, currentPrice){
  const key = 'fx_prev_'+sym;
  const stored = sessionStorage.getItem(key);
  if(!stored){
    // First load — simulate small change
    const sim = (Math.random()-0.48)*0.006; // ±0.6%
    sessionStorage.setItem(key, (currentPrice*(1-sim)).toString());
    return sim*100;
  }
  const prev = parseFloat(stored);
  if(!prev || prev<=0) return 0;
  return (currentPrice - prev)/prev*100;
}

// ── Load all forex market data ────────────────────────────────────
async function loadFxMarket(){
  if(_fxLoading) return;
  _fxLoading = true;
  const btn = document.getElementById('fxRefreshBtn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Đang tải...'; }

  const rates = await _fxFetchRates();
  _fxLoading = false;
  if(btn){ btn.disabled=false; btn.textContent='🔄 Làm Mới'; }

  if(!rates){ 
    _fxRenderError(); 
    return; 
  }
  _fxRates = rates;

  // Build enriched pair list
  _fxData = FX_ALL_PAIRS.map(p=>{
    const price = _fxCalcPair(p.base, p.quote, rates);
    if(!price) return null;
    const changePct = _fxGetChange(p.sym, price);
    const spread = p.quote==='JPY'?0.02 : p.quote==='VND'?50 : 0.0002;
    return {...p, price, changePct, change:price*changePct/100, spread,
      high:price*(1+Math.abs(changePct/100)*0.6+0.001),
      low: price*(1-Math.abs(changePct/100)*0.6-0.001),
    };
  }).filter(Boolean);

  _fxRenderPairsGrid();
  _fxRenderStats();
  _fxRenderSessions();
  _fxRenderStrengthBars();
  fxConvert();
  // Cập nhật list cặp tiền trong tab Biểu Đồ nếu đang mở
  if(document.getElementById('page-fx-chart')?.classList.contains('active')){
    _fxRenderPairList(_fxListGroup);
    _fxUpdateChartSidePanel(_fxCurrentPair);
  }
}

// ── Render pair cards grid ────────────────────────────────────────
function _fxRenderPairsGrid(){
  const grid = document.getElementById('fxPairsGrid');
  if(!grid) return;

  const groups = _fxGroup==='all' ? FX_ALL_PAIRS : (FX_PAIRS[_fxGroup]||FX_PAIRS.major);
  const q = (document.getElementById('fxSearchInput')?.value||'').toLowerCase();
  const pairs = _fxGroup==='all' ? _fxData : _fxData.filter(d=>groups.some(g=>g.sym===d.sym));
  const filtered = q ? pairs.filter(d=>d.sym.toLowerCase().includes(q)||d.name.toLowerCase().includes(q)) : pairs;

  const badge = document.getElementById('fxCountBadge');
  if(badge) badge.textContent = filtered.length + ' cặp';

  if(!filtered.length){ grid.innerHTML='<div class="state-box">Không tìm thấy cặp tiền nào</div>'; return; }

  grid.innerHTML = filtered.map(d=>{
    const cls = d.changePct>0?'up':d.changePct<0?'dn':'unch';
    const sign = d.changePct>=0?'+':'';
    const isActive = d.sym===_fxCurrentPair;
    return `<div class="forex-pair-card${isActive?' active-pair':''}" onclick="fxSelectPair('${d.sym}')">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div>
          <div class="fx-pair-name">${d.flag} ${d.sym.slice(0,3)}/${d.sym.slice(3)}</div>
          <div class="fx-pair-full">${d.name}</div>
        </div>
        <span class="fx-change ${cls}">${sign}${d.changePct.toFixed(2)}%</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <span class="fx-price">${_fxFmt(d.price,d.quote)}</span>
      </div>
      <div class="fx-meta" style="margin-top:6px">
        <span>H: <b>${_fxFmt(d.high,d.quote)}</b></span>
        <span>L: <b>${_fxFmt(d.low,d.quote)}</b></span>
        <span>Spread: <b>${d.quote==='VND'?d.spread.toFixed(0):(d.quote==='JPY'?d.spread.toFixed(3):d.spread.toFixed(4))}</b></span>
      </div>
    </div>`;
  }).join('');
}

// ── Render top stats ──────────────────────────────────────────────
function _fxRenderStats(){
  if(!_fxData.length) return;
  const sorted = [..._fxData].sort((a,b)=>b.changePct-a.changePct);
  const top = sorted[0], bot = sorted[sorted.length-1];
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('fxTopGain',  (top.changePct>=0?'+':'')+top.changePct.toFixed(2)+'%');
  set('fxTopGainName', top.sym.slice(0,3)+'/'+top.sym.slice(3));
  set('fxTopLoss',  bot.changePct.toFixed(2)+'%');
  set('fxTopLossName', bot.sym.slice(0,3)+'/'+bot.sym.slice(3));
  // DXY approximation (inverse-weighted USD pairs)
  const dxy = _fxRates['EUR'] ? (96.5 / _fxRates['EUR'] * 0.576).toFixed(2) : '—';
  set('fxDXY', dxy);
  set('fxDXYChange', 'USD Index (approx)');
}

// ── Render sessions status ────────────────────────────────────────
function _fxRenderSessions(){
  const nowH = new Date(Date.now()+(7*3600000)).getUTCHours();
  ['fxSessionsList','fxSessionsFull'].forEach(containerId=>{
    const el = document.getElementById(containerId);
    if(!el) return;
    el.innerHTML = FX_SESSIONS.map(s=>{
      const isOpen = s.close>s.open ? (nowH>=s.open&&nowH<s.close) : (nowH>=s.open||nowH<s.close);
      const nextEvt = isOpen ? 'Đóng '+_fxFmtHour(s.close) : 'Mở '+_fxFmtHour(s.open);
      return `<div class="session-item">
        <div class="session-name">
          <div class="session-dot ${isOpen?'open':'closed'}" style="background:${isOpen?s.color:'var(--muted)'}${isOpen?';box-shadow:0 0 6px '+s.color:''}"></div>
          <span>${s.vn||s.name}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="session-time">${_fxFmtHour(s.open)}–${_fxFmtHour(s.close)}</span>
          <span class="session-status ${isOpen?'open':'closed'}">${isOpen?'MỞ CỬA':'ĐÓNG CỬA'}</span>
        </div>
      </div>`;
    }).join('');
  });

  // Session timeline
  const timeline = document.getElementById('fxSessionTimeline');
  if(timeline){
    const barW = 100/24;
    timeline.innerHTML = `<div style="position:relative;height:60px;background:var(--surface2);border-radius:8px;overflow:hidden">
      ${FX_SESSIONS.map(s=>{
        const w = s.close>s.open?(s.close-s.open)*barW:((24-s.open)+s.close)*barW;
        const left = s.open*barW;
        return `<div style="position:absolute;left:${left}%;width:${Math.min(w,100-left)}%;top:${FX_SESSIONS.indexOf(s)*13+4}px;height:10px;background:${s.color};border-radius:3px;opacity:.7;title='${s.vn||s.name}'">
          <span style="font-size:8px;padding:1px 4px;color:#fff;font-weight:700">${s.vn||s.name}</span>
        </div>`;
      }).join('')}
      <div style="position:absolute;left:${nowH*barW}%;top:0;bottom:0;width:2px;background:#fff;opacity:.6"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-top:4px;padding:0 2px">
      ${[0,3,6,9,12,15,18,21,24].map(h=>`<span>${h}h</span>`).join('')}
    </div>`;
  }

  // Best pairs per session
  const bestEl = document.getElementById('fxBestPairs');
  if(bestEl){
    bestEl.innerHTML = FX_SESSIONS.map(s=>{
      const isOpen = s.close>s.open?(nowH>=s.open&&nowH<s.close):(nowH>=s.open||nowH<s.close);
      return `<div class="forex-pair-card${isOpen?' active-pair':''}" style="cursor:default">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div class="session-dot ${isOpen?'open':'closed'}" style="background:${s.color};width:10px;height:10px${isOpen?';box-shadow:0 0 6px '+s.color:''}"></div>
          <b style="color:${s.color}">${s.vn||s.name}</b>
          <span style="font-size:9px;color:var(--muted)">${_fxFmtHour(s.open)}–${_fxFmtHour(s.close)}</span>
        </div>
        ${s.pairs.map(p=>`<div style="font-size:11px;color:var(--text2);padding:2px 0">💱 ${p.slice(0,3)}/${p.slice(3)}</div>`).join('')}
      </div>`;
    }).join('');
  }
}

function _fxFmtHour(h){ return String(h%24).padStart(2,'0')+':00'; }

// ── Currency strength bars ────────────────────────────────────────
function _fxRenderStrengthBars(){
  const el = document.getElementById('fxStrengthBars');
  if(!el || !_fxData.length) return;
  const currencies = ['USD','EUR','GBP','JPY','AUD','CAD','CHF','NZD'];
  const strength = {};
  currencies.forEach(c=>{ strength[c]=0; });
  _fxData.forEach(d=>{
    if(strength[d.base]!==undefined) strength[d.base] += d.changePct;
    if(strength[d.quote]!==undefined) strength[d.quote] -= d.changePct;
  });
  const vals = Object.values(strength);
  const max = Math.max(...vals.map(Math.abs)) || 1;
  el.innerHTML = currencies.map(c=>{
    const v = strength[c]||0;
    const pct = Math.min(100, Math.abs(v)/max*100);
    const col = v>=0?'var(--green)':'var(--red)';
    return `<div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:11px;font-weight:700;width:28px;color:var(--text2)">${c}</span>
      <div style="flex:1;height:6px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${col};border-radius:3px;transition:width .5s"></div>
      </div>
      <span style="font-size:10px;color:${col};width:40px;text-align:right">${v>=0?'+':''}${v.toFixed(2)}%</span>
    </div>`;
  }).join('');
}

// ── Group filter ──────────────────────────────────────────────────
function fxSetGroup(el, group){
  _fxGroup = group;
  document.querySelectorAll('#fxGroupTabs .tab-btn').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
  _fxRenderPairsGrid();
}

// ── Search ────────────────────────────────────────────────────────
function fxSearch(q){ _fxRenderPairsGrid(); }

// ── Select pair ───────────────────────────────────────────────────
function fxSelectPair(sym){
  _fxCurrentPair = sym;
  _fxRenderPairsGrid();
  // Chuyển sang tab Biểu Đồ và load chart cho cặp được chọn
  const chartTab = document.getElementById('stab-fx-chart');
  showFxPage('fx-chart', chartTab);
  // Update side panel sau khi chart load
  setTimeout(() => _fxUpdateChartSidePanel(sym), 100);
}

// ── Currency converter ────────────────────────────────────────────
function fxConvert(){
  const amt  = parseFloat(document.getElementById('fxConvAmt')?.value)||1;
  const from = document.getElementById('fxConvFrom')?.value||'USD';
  const to   = document.getElementById('fxConvTo')?.value||'VND';
  const result = _fxConvertCalc(amt, from, to);
  const el = document.getElementById('fxConvResult');
  const rate = document.getElementById('fxConvRate');
  if(el) el.textContent = result!=null ? result.toLocaleString('vi-VN',{maximumFractionDigits:to==='VND'?0:4}) + ' ' + to : '—';
  if(rate){ const r=_fxConvertCalc(1,from,to); rate.textContent='1 '+from+' = '+(r!=null?r.toLocaleString('vi-VN',{maximumFractionDigits:to==='VND'?0:6}):'—')+' '+to; }
}
function fxConvert2(){
  const amt  = parseFloat(document.getElementById('fxConvAmt2')?.value)||100;
  const from = document.getElementById('fxConvFrom2')?.value||'VND';
  const to   = document.getElementById('fxConvTo2')?.value||'USD';
  const result = _fxConvertCalc(amt, from, to);
  const el = document.getElementById('fxConvResult2');
  const rate = document.getElementById('fxConvRate2');
  if(el) el.textContent = result!=null ? result.toLocaleString('vi-VN',{maximumFractionDigits:to==='VND'?0:4}) + ' ' + to : '—';
  if(rate){ const r=_fxConvertCalc(1,from,to); rate.textContent='Tỷ giá: 1 '+from+' = '+(r!=null?r.toLocaleString('vi-VN',{maximumFractionDigits:to==='VND'?0:6}):'—')+' '+to; }
  // Multi-convert table
  const currencies2 = ['USD','EUR','GBP','JPY','VND','CNY','AUD','CAD','CHF','SGD','KRW','THB'];
  const multiEl = document.getElementById('fxMultiConvTable');
  if(multiEl && result!=null){
    multiEl.innerHTML = currencies2.filter(c=>c!==from).map(c=>{
      const r = _fxConvertCalc(amt, from, c);
      return r!=null?`<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 12px">
        <div style="font-size:9px;color:var(--muted);margin-bottom:4px">${amt} ${from} =</div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${r.toLocaleString('vi-VN',{maximumFractionDigits:c==='VND'?0:4})} <span style="color:var(--accent)">${c}</span></div>
      </div>`:'';
    }).join('');
  }
}
function _fxConvertCalc(amt, from, to){
  if(!Object.keys(_fxRates).length) return null;
  const r = _fxRates;
  const usdFrom = from==='USD' ? 1 : (r[from] ? 1/r[from] : null);
  const usdTo   = to==='USD'   ? 1 : (r[to]   ? r[to]     : null);
  if(!usdFrom || !usdTo) return null;
  return amt * usdFrom * usdTo;
}
function fxSwapConv(){
  const f=document.getElementById('fxConvFrom'), t=document.getElementById('fxConvTo');
  if(f&&t){const tmp=f.value;f.value=t.value;t.value=tmp;} fxConvert();
}
function fxSwapConv2(){
  const f=document.getElementById('fxConvFrom2'), t=document.getElementById('fxConvTo2');
  if(f&&t){const tmp=f.value;f.value=t.value;t.value=tmp;} fxConvert2();
}

// ── Chart: load Yahoo Finance chart for forex pair ────────────────
function _fxLoadChart(sym, tf){
  const container = document.getElementById('fxChartContainer');
  if(!container) return;

  // Update header info từ _fxData cache
  const pairDef = FX_ALL_PAIRS.find(p=>p.sym===sym);
  const cached  = _fxData.find(d=>d.sym===sym);
  const el=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  const quote = sym.slice(3);
  el('fxChartTitle', sym.slice(0,3)+'/'+sym.slice(3));
  el('fxChartSub',   pairDef?.name||sym);

  if(cached){
    el('fxChartPrice', _fxFmt(cached.price, quote));
    const chgEl = document.getElementById('fxChartChg');
    if(chgEl){
      chgEl.textContent = (cached.changePct>=0?'+':'')+cached.changePct.toFixed(2)+'%';
      chgEl.style.color = cached.changePct>=0?'var(--green)':'var(--red)';
    }
    el('fxi-price', _fxFmt(cached.price, quote));
    el('fxi-chg',   (cached.changePct>=0?'+':'')+cached.changePct.toFixed(2)+'%');
    el('fxi-high',  _fxFmt(cached.high, quote));
    el('fxi-low',   _fxFmt(cached.low,  quote));
    const spread = quote==='JPY'?0.02:quote==='VND'?50:0.0002;
    el('fxi-spread', quote==='VND'?spread.toFixed(0):(quote==='JPY'?spread.toFixed(3):spread.toFixed(4)));

    // Pivot levels từ high/low/price
    const H=cached.high, L=cached.low, C=cached.price;
    const P=(H+L+C)/3;
    const pivots=[
      {label:'R3',val:P+2*(H-L),col:'#ff3d57'},
      {label:'R2',val:P+(H-L),  col:'#ff7043'},
      {label:'R1',val:2*P-L,    col:'#ffa726'},
      {label:'PP',val:P,         col:'#fbbf24'},
      {label:'S1',val:2*P-H,    col:'#66bb6a'},
      {label:'S2',val:P-(H-L),  col:'#42a5f5'},
      {label:'S3',val:P-2*(H-L),col:'#7e57c2'},
    ];
    const pvEl = document.getElementById('fxPivotLevels');
    if(pvEl) pvEl.innerHTML = pivots.map(pv=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:10px;font-weight:700;color:${pv.col}">${pv.label}</span>
        <span style="font-size:11px;font-weight:700">${_fxFmt(pv.val,quote)}</span>
      </div>`).join('');
  }

  // ── TradingView Widget — không cần fetch, không CORS ─────────────
  // Map sym → TradingView FX symbol (FX:EURUSD)
  // VND pairs không có trên TradingView → dùng OANDA:USDVND
  const TV_SYM_MAP = {
    'USDVND':'OANDA:USDVND','EURVND':'FX:EURUSD', // approx
    'JPYVND':'FX:USDJPY','GBPVND':'FX:GBPUSD',
    'CNYVND':'FX:USDCNH','KRWVND':'FX:USDKRW',
    'SGDVND':'FX:USDSGD','THBVND':'FX:USDTHB',
  };
  const tvSym = TV_SYM_MAP[sym] || ('FX:'+sym);

  const TF_TV = {'1H':'60','4H':'240','1D':'D','1W':'W','1M':'M'};
  const interval = TF_TV[tf]||'D';

  container.innerHTML = '';
  if(_fxChart){ try{_fxChart.remove();}catch(e){} _fxChart=null; _fxSeries=null; }

  // Build TradingView Advanced Chart widget iframe
  const widgetHtml = `
    <div class="tradingview-widget-container" style="height:100%;width:100%">
      <div id="fx_tv_chart_${sym}" style="height:100%;width:100%"></div>
      <script type="text/javascript">
      new TradingView.widget({
        "autosize": true,
        "symbol": "${tvSym}",
        "interval": "${interval}",
        "timezone": "Asia/Ho_Chi_Minh",
        "theme": "dark",
        "style": "1",
        "locale": "vi_VN",
        "toolbar_bg": "#0c1118",
        "enable_publishing": false,
        "hide_top_toolbar": false,
        "hide_legend": false,
        "save_image": false,
        "container_id": "fx_tv_chart_${sym}",
        "studies": ["RSI@tv-basicstudies","MACD@tv-basicstudies"],
        "backgroundColor": "#060a10",
        "gridColor": "rgba(99,179,237,0.05)",
        "overrides": {
          "mainSeriesProperties.candleStyle.upColor": "#00e676",
          "mainSeriesProperties.candleStyle.downColor": "#ff3d57",
          "mainSeriesProperties.candleStyle.borderUpColor": "#00e676",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ff3d57",
          "mainSeriesProperties.candleStyle.wickUpColor": "#00e676",
          "mainSeriesProperties.candleStyle.wickDownColor": "#ff3d57"
        }
      });
      <\/script>
    </div>`;

  // Dùng srcdoc iframe để isolate TradingView widget script
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:#060a10';
  iframe.setAttribute('allowtransparency','true');
  container.appendChild(iframe);

  const iDoc = iframe.contentDocument || iframe.contentWindow.document;
  iDoc.open();
  iDoc.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <script src="https://s3.tradingview.com/tv.js"><\/script>
    <style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#060a10;}</style>
    </head><body>${widgetHtml}</body></html>`);
  iDoc.close();
}

// ── Heatmap ───────────────────────────────────────────────────────
function _fxRenderHeatmap(){
  const table = document.getElementById('fxHeatmapTable');
  if(!table || !_fxData.length) return;

  const curs = ['USD','EUR','GBP','JPY','AUD','CAD','CHF','NZD'];

  // ── Header row ──────────────────────────────────────────────────
  let html = '<thead><tr><th></th>';
  curs.forEach(c => {
    html += `<th>${c}</th>`;
  });
  html += '</tr></thead><tbody>';

  // ── Data rows ───────────────────────────────────────────────────
  curs.forEach(base => {
    html += `<tr><td class="fx-hm-label">${base}</td>`;
    curs.forEach(quote => {
      if(base === quote){
        html += `<td class="fx-hm-self"><div class="fx-hm-cell-inner"><span style="font-size:16px;opacity:.3">—</span></div></td>`;
        return;
      }
      const pair = _fxData.find(d=>d.base===base&&d.quote===quote)
                || _fxData.find(d=>d.base===quote&&d.quote===base);
      const pct = pair ? (pair.base===base ? pair.changePct : -pair.changePct) : 0;

      const intensity = Math.min(Math.abs(pct) / 1.5, 1);
      const alpha = 0.08 + intensity * 0.65;
      const bg = pct > 0
        ? `rgba(0,230,118,${alpha})`
        : pct < 0
          ? `rgba(255,61,87,${alpha})`
          : 'rgba(255,255,255,.04)';
      const textCol = pct > 0 ? '#00e676' : pct < 0 ? '#ff3d57' : 'var(--muted)';
      const sign = pct >= 0 ? '+' : '';
      const pairLabel = base + '/' + quote;

      html += `<td style="background:${bg}"
        title="${pairLabel}: ${sign}${pct.toFixed(2)}%"
        onclick="fxSelectPair('${(pair?.sym)||base+quote}')">
        <div class="fx-hm-cell-inner">
          <span class="fx-hm-cell-pair">${pairLabel}</span>
          <span class="fx-hm-cell-pct" style="color:${textCol}">${sign}${pct.toFixed(2)}%</span>
        </div>
      </td>`;
    });
    html += '</tr>';
  });

  html += '</tbody>';
  table.innerHTML = html;

  // ── Strength bars (right panel) ─────────────────────────────────
  const strengthEl = document.getElementById('fxHeatmapStrength');
  if(!strengthEl) return;

  // Tính sức mạnh = tổng % thay đổi các cặp liên quan
  const strength = {};
  curs.forEach(c => { strength[c] = 0; });
  _fxData.forEach(d => {
    if(strength[d.base]  !== undefined) strength[d.base]  += d.changePct;
    if(strength[d.quote] !== undefined) strength[d.quote] -= d.changePct;
  });

  const sorted = [...curs].sort((a, b) => strength[b] - strength[a]);
  const maxAbs = Math.max(...Object.values(strength).map(Math.abs), 0.01);

  strengthEl.innerHTML = sorted.map((c, i) => {
    const v = strength[c] || 0;
    const pct = Math.abs(v) / maxAbs * 100;
    const col = v >= 0 ? 'var(--green)' : 'var(--red)';
    const rank = i + 1;
    return `<div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:10px;color:var(--muted);width:16px">#${rank}</span>
          <span style="font-size:13px;font-weight:700;color:var(--text)">${c}</span>
        </div>
        <span style="font-size:12px;font-weight:700;color:${col}">${v>=0?'+':''}${v.toFixed(3)}%</span>
      </div>
      <div style="height:8px;background:rgba(255,255,255,.05);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct.toFixed(1)}%;background:${col};border-radius:4px;transition:width .6s ease"></div>
      </div>
    </div>`;
  }).join('');
}

// ── Timeframe switcher ────────────────────────────────────────────
function fxSetTf(el, tf){
  _fxCurrentTf = tf;
  document.querySelectorAll('.fx-tf-btn').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
  _fxLoadChart(_fxCurrentPair, tf);
}

// ── Build chart pair buttons ──────────────────────────────────────
function _fxBuildChartPairBtns(){
  // Render danh sách cặp tiền dạng list panel (giống Module 1)
  _fxRenderPairList('all', '');
}

let _fxListGroup = 'all';

function _fxRenderPairList(group, query){
  const el = document.getElementById('fxPairListItems');
  if(!el) return;
  _fxListGroup = group || _fxListGroup;
  const q = (query !== undefined ? query : '').toLowerCase();

  const groups = _fxListGroup === 'all' ? FX_ALL_PAIRS : (FX_PAIRS[_fxListGroup] || FX_ALL_PAIRS);
  const filtered = groups.filter(p =>
    !q || p.sym.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
  );

  el.innerHTML = filtered.map(p => {
    const cached = _fxData.find(d => d.sym === p.sym);
    const price  = cached ? _fxFmt(cached.price, p.quote) : '—';
    const pct    = cached ? cached.changePct : null;
    const cls    = pct === null ? 'unch' : pct > 0 ? 'up' : pct < 0 ? 'dn' : 'unch';
    const sign   = pct !== null && pct >= 0 ? '+' : '';
    const pctTxt = pct !== null ? sign + pct.toFixed(2) + '%' : '—';
    const isActive = p.sym === _fxCurrentPair;
    return `<div class="fx-pair-item${isActive ? ' active' : ''}" onclick="fxSelectPairChart('${p.sym}')">
      <div>
        <div class="fpi-sym">${p.flag} ${p.sym.slice(0,3)}/${p.sym.slice(3)}</div>
        <div class="fpi-name">${p.name}</div>
      </div>
      <div style="text-align:right">
        <div class="fpi-price" style="color:${cls==='up'?'var(--green)':cls==='dn'?'var(--red)':'var(--text)'}">${price}</div>
        <div class="fpi-chg ${cls}">${pctTxt}</div>
      </div>
    </div>`;
  }).join('');
}

function fxChartFilter(q){ _fxRenderPairList(_fxListGroup, q); }

function fxChartGroup(el, group){
  document.querySelectorAll('.fx-list-grp').forEach(b => b.classList.remove('active'));
  if(el) el.classList.add('active');
  _fxListGroup = group;
  _fxRenderPairList(group, document.getElementById('fxChartSearch')?.value || '');
}

function fxSelectPairChart(sym){
  _fxCurrentPair = sym;
  _fxRenderPairList(_fxListGroup);
  _fxLoadChart(sym, _fxCurrentTf);
  // Sync thông tin side panel
  _fxUpdateChartSidePanel(sym);
}

function _fxUpdateChartSidePanel(sym){
  const cached = _fxData.find(d => d.sym === sym);
  if(!cached) return;
  const quote = sym.slice(3);
  const pairDef = FX_ALL_PAIRS.find(p => p.sym === sym);
  const set = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };

  // Update flag
  const flagEl = document.getElementById('fxChartFlag');
  if(flagEl && pairDef) flagEl.textContent = pairDef.flag;

  // Header
  set('fxChartTitle', sym.slice(0,3) + '/' + sym.slice(3));
  set('fxChartSub',   pairDef?.name || sym);
  set('fxChartPrice', _fxFmt(cached.price, quote));
  const chgEl = document.getElementById('fxChartChg');
  if(chgEl){
    chgEl.textContent = (cached.changePct >= 0 ? '+' : '') + cached.changePct.toFixed(2) + '%';
    chgEl.style.color = cached.changePct >= 0 ? 'var(--green)' : 'var(--red)';
  }
  // Mini stats
  set('fxi-high',  _fxFmt(cached.high, quote));
  set('fxi-low',   _fxFmt(cached.low,  quote));
  const spread = quote==='JPY'?'0.020':quote==='VND'?'50':'0.0002';
  set('fxi-spread', spread);
  set('fxi-chg', (cached.changePct>=0?'+':'')+cached.changePct.toFixed(2)+'%');

  // Right panel
  set('fxi-price',   _fxFmt(cached.price, quote));
  const chg2El = document.getElementById('fxi-chg2');
  if(chg2El){
    chg2El.textContent = (cached.changePct>=0?'+':'')+cached.changePct.toFixed(2)+'%';
    chg2El.style.color = cached.changePct>=0?'var(--green)':'var(--red)';
  }
  set('fxi-high2', _fxFmt(cached.high, quote));
  set('fxi-low2',  _fxFmt(cached.low, quote));
  set('fxi-spread2', spread);

  // Pivot levels
  const H=cached.high, L=cached.low, C=cached.price;
  const P=(H+L+C)/3;
  const pivots=[
    {label:'R3',val:P+2*(H-L),col:'#ff3d57'},
    {label:'R2',val:P+(H-L),  col:'#ff7043'},
    {label:'R1',val:2*P-L,    col:'#ffa726'},
    {label:'PP',val:P,         col:'#fbbf24'},
    {label:'S1',val:2*P-H,    col:'#66bb6a'},
    {label:'S2',val:P-(H-L),  col:'#42a5f5'},
    {label:'S3',val:P-2*(H-L),col:'#7e57c2'},
  ];
  const pvEl = document.getElementById('fxPivotLevels');
  if(pvEl) pvEl.innerHTML = pivots.map(pv=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:10px;font-weight:700;color:${pv.col}">${pv.label}</span>
      <span style="font-size:11px;font-weight:700">${_fxFmt(pv.val,quote)}</span>
    </div>`).join('');

  // Sessions
  const nowH = new Date(Date.now()+(7*3600000)).getUTCHours();
  const sessEl = document.getElementById('fxChartSessions');
  if(sessEl) sessEl.innerHTML = FX_SESSIONS.map(s=>{
    const isOpen = s.close>s.open?(nowH>=s.open&&nowH<s.close):(nowH>=s.open||nowH<s.close);
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:6px;font-size:11px">
        <div style="width:6px;height:6px;border-radius:50%;background:${isOpen?s.color:'var(--muted)'}${isOpen?';box-shadow:0 0 5px '+s.color:''}"></div>
        <span>${s.vn||s.name}</span>
      </div>
      <span style="font-size:9px;font-weight:700;color:${isOpen?s.color:'var(--muted)'}">${isOpen?'MỞ CỬA':'ĐÓNG CỬA'}</span>
    </div>`;
  }).join('');
}

// ── Page navigation ───────────────────────────────────────────────
function showFxPage(id, el){
  document.querySelectorAll('[id^="page-fx-"]').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#subNavForex .sub-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  const page = document.getElementById('page-'+id);
  if(page) page.classList.add('active');

  if(id==='fx-market'){ if(!_fxData.length) loadFxMarket(); else { _fxRenderPairsGrid(); _fxRenderSessions(); } }
  if(id==='fx-chart'){ _fxBuildChartPairBtns(); _fxLoadChart(_fxCurrentPair, _fxCurrentTf); _fxUpdateChartSidePanel(_fxCurrentPair); }
  if(id==='fx-heatmap'){ if(!_fxData.length) loadFxMarket().then(_fxRenderHeatmap); else _fxRenderHeatmap(); }
  if(id==='fx-converter'){ if(!Object.keys(_fxRates).length) loadFxMarket().then(fxConvert2); else fxConvert2(); }
  if(id==='fx-sessions'){ _fxRenderSessions(); }
}

// ── Error state ───────────────────────────────────────────────────
function _fxRenderError(){
  const grid = document.getElementById('fxPairsGrid');
  if(grid) grid.innerHTML='<div class="state-box"><div style="font-size:28px">📡</div><div>Không tải được dữ liệu ngoại hối</div><div style="font-size:11px;color:var(--muted)">Kiểm tra kết nối mạng và thử lại</div><button class="nf-refresh" onclick="loadFxMarket()" style="margin-top:12px">🔄 Thử Lại</button></div>';
  const chart = document.getElementById('fxChartContainer');
  if(chart && !chart.children.length) chart.innerHTML='<div class="state-box"><div style="font-size:28px">📡</div><div>Không tải được dữ liệu</div></div>';
}

// ── Update Forex status badge in header ──────────────────────────
function _fxUpdateStatusBadge(){
  const nowH = new Date(Date.now()+(7*3600000)).getUTCHours();
  const openSessions = FX_SESSIONS.filter(s=>{
    return s.close>s.open ? (nowH>=s.open&&nowH<s.close) : (nowH>=s.open||nowH<s.close);
  });

  const badge = document.getElementById('forexMarketStatus');
  const dot   = document.getElementById('fxLiveDot');
  const text  = document.getElementById('fxStatusText');
  if(!badge || !dot || !text) return;

  // Reset classes
  badge.className = 'hm-status-badge';

  if(openSessions.length===0){
    badge.classList.add('hm-fx-closed');
    dot.style.display = 'none';
    text.textContent  = 'ĐÓNG CỬA';
  } else {
    const hasLondon = openSessions.some(s=>s.name==='London');
    const hasNY     = openSessions.some(s=>s.name==='New York');
    const isOverlap = hasLondon && hasNY;

    // Dot — copy chính xác hm-live-dot behavior, chỉ đổi màu
    dot.style.display    = 'inline-block';
    dot.style.background = isOverlap ? '#00e676' : '#f59e0b';
    dot.style.boxShadow  = isOverlap ? '0 0 5px #00e676' : '0 0 5px #f59e0b';

    if(isOverlap){
      badge.classList.add('hm-fx-overlap');
      text.textContent = 'GIAO NHAU';
    } else if(openSessions.length===1){
      badge.classList.add('hm-fx-active');
      // Tên phiên ngắn gọn đồng bộ với "TRỰC TIẾP"
      text.textContent = openSessions[0].vn || openSessions[0].name.toUpperCase();
    } else {
      badge.classList.add('hm-fx-active');
      text.textContent = openSessions.length + ' PHIÊN';
    }
  }
}

// Run on load and every minute
_fxUpdateStatusBadge();
setInterval(_fxUpdateStatusBadge, 60000);

// ── Expose globals ────────────────────────────────────────────────
window.loadFxMarket   = loadFxMarket;
window.showFxPage     = showFxPage;
window.fxSetGroup     = fxSetGroup;
window.fxSearch       = fxSearch;
window.fxSelectPair   = fxSelectPair;
window.fxSelectPairChart = fxSelectPairChart;
window.fxChartFilter    = fxChartFilter;
window.fxChartGroup     = fxChartGroup;
window.fxConvert      = fxConvert;
window.fxConvert2     = fxConvert2;
window.fxSwapConv     = fxSwapConv;
window.fxSwapConv2    = fxSwapConv2;
window.fxSetTf        = fxSetTf;


function showChangelogModal(){
  const m = document.getElementById('changelogModal');
  m.style.display = 'flex';
  requestAnimationFrame(()=>{ m.style.opacity='0'; m.style.transition='opacity .2s'; requestAnimationFrame(()=>m.style.opacity='1'); });
}
function closeChangelogModal(){
  const m = document.getElementById('changelogModal');
  m.style.opacity='0';
  setTimeout(()=>m.style.display='none', 200);
}
document.addEventListener('keydown', e => { if(e.key==='Escape') closeChangelogModal(); });
