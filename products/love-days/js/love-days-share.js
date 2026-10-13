// Share image ("N ngày bên nhau"): plan() decides every string and position,
// render() only paints that plan. Stateless; never touches IndexedDB.
// Sources are the page's own ArrayBuffers, so the canvas is never tainted.
(function(root){
  "use strict";
  var C = root.LoveCore;

  var W = 1080, HEIGHTS = { post: 1350, story: 1920 }, PAD = 72, MAXW = W - PAD * 2;
  var HEART = "M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.5 1.1 4.3 2.4h2c.8-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z";
  var WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  var PINK = ["#E8507F", "#C2185B"], WARM = ["#E06A3A", "#C2185B"];
  var COVER_FILL = ["#FF9DB5", "#FFC3A8", "#F8B4E0"];
  var WHITE = "#FFFFFF", SOFT_WHITE = "rgba(255,255,255,.9)";

  var STYLES = {
    cover: { av: 160, num: 230, label: 56, name: 46, sub: 36, emoji: 100, title: 76, line: 42,
             main: WHITE, text: WHITE, muted: SOFT_WHITE, ring: WHITE },
    card:  { av: 176, num: 200, label: 52, name: 44, sub: 34, emoji: 84, title: 64, line: 38,
             main: "#C2185B", text: "#2A1520", muted: "#6E4A5A", ring: WHITE },
    plain: { av: 220, num: 280, label: 60, name: 48, sub: 38, emoji: 110, title: 84, line: 44,
             main: WHITE, text: WHITE, muted: SOFT_WHITE, ring: WHITE }
  };

  function fmtDate(s){ return s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4); }
  function weekday(s){ return WEEKDAYS[((C.dayIdx(s) + 4) % 7 + 7) % 7]; }
  function initial(name){
    var parts = String(name).trim().split(/\s+/);
    return (parts[parts.length - 1] || "♥").charAt(0).toUpperCase();
  }

  // Width guess used when plan() gets no measurer (no DOM needed). The page
  // always passes measurer(fontFamily) so the plan matches what is painted.
  function estimate(text, size, weight){
    var w = 0, s = String(text);
    for(var i = 0; i < s.length; i++){
      var c = s.charCodeAt(i);
      if(c >= 0xD800 && c <= 0xDBFF){ w += 1.15; i++; }
      else if(c >= 0xDC00 && c <= 0xDFFF || c === 0x200D || c === 0xFE0F) continue;
      else if(c === 32) w += 0.3;
      else if(c >= 48 && c <= 57) w += 0.62;
      else if(c >= 0x2600 && c <= 0x27BF) w += 1.15;
      else if(c >= 65 && c <= 90 || c >= 0xC0 && c <= 0xDE) w += 0.7;
      else w += 0.58;
    }
    return w * size * (weight >= 700 ? 1.06 : 1);
  }

  function measurer(fontFamily){
    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    var ctx = canvas.getContext("2d");
    return function(text, size, weight){
      ctx.font = weight + " " + size + "px " + fontFamily;
      return ctx.measureText(text).width;
    };
  }

  // Longest prefix of whole graphemes (plus "…") that fits.
  function clipToWidth(text, size, weight, maxW, measure){
    if(measure(text, size, weight) <= maxW) return text;
    for(var n = text.length - 1; n > 0; n--){
      var cut = C.clipGraphemes(text, n).replace(/\s+$/, "");
      if(cut.length > n) continue;
      if(measure(cut + "…", size, weight) <= maxW) return cut + "…";
      n = Math.min(n, cut.length);
    }
    return "…";
  }

  // Shrinks to `floor`, then cuts with "…".
  function fitLine(text, size, floor, weight, maxW, measure){
    while(size > floor && measure(text, size, weight) > maxW) size -= 2;
    if(size < floor) size = floor;
    return { text: clipToWidth(text, size, weight, maxW, measure), size: size };
  }

  // "A & B" on one line: shrink first, then shorten the longer name so a long
  // first name can never push the second one out.
  function fitNames(a, b, size, floor, weight, maxW, measure){
    function join(x, y){ return x && y ? x + " & " + y : x || y; }
    while(size > floor && measure(join(a, b), size, weight) > maxW) size -= 2;
    if(size < floor) size = floor;
    var ca = a, cb = b, la = a.length, lb = b.length;
    while(measure(join(ca, cb), size, weight) > maxW && (la > 1 || lb > 1)){
      if(la >= lb && la > 1){
        la = Math.min(la - 1, C.clipGraphemes(a, la - 1).length);
        ca = C.clipGraphemes(a, la).replace(/\s+$/, "") + "…";
      } else {
        lb = Math.min(lb - 1, C.clipGraphemes(b, lb - 1).length);
        cb = C.clipGraphemes(b, lb).replace(/\s+$/, "") + "…";
      }
    }
    return { text: join(ca, cb), size: size };
  }

  function wrapLines(text, size, weight, maxW, measure){
    var words = text.split(/\s+/).filter(Boolean), lines = [], cur = "";
    function push(){ if(cur){ lines.push(cur); cur = ""; } }
    words.forEach(function(word){
      // A single word wider than the line is broken between graphemes.
      while(measure(word, size, weight) > maxW){
        push();
        var n = word.length, head = "";
        for(; n > 0; n--){
          head = C.clipGraphemes(word, n);
          if(head && measure(head, size, weight) <= maxW) break;
          n = Math.min(n, head.length);
        }
        if(n <= 0 || !head) head = word;
        lines.push(head);
        word = word.slice(head.length);
        if(!word) return;
      }
      var next = cur ? cur + " " + word : word;
      if(measure(next, size, weight) <= maxW) cur = next;
      else { push(); cur = word; }
    });
    push();
    return lines;
  }

  // At most two lines: shrink to `floor`, then end the second line with "…".
  function fitTitle(text, size, floor, weight, maxW, measure){
    var lines = wrapLines(text, size, weight, maxW, measure);
    while(lines.length > 2 && size > floor){
      size = Math.max(floor, size - 4);
      lines = wrapLines(text, size, weight, maxW, measure);
    }
    if(lines.length > 2){
      lines = [lines[0], clipToWidth(lines.slice(1).join(" "), size, weight, maxW, measure)];
    }
    return { lines: lines.length ? lines : [""], size: size };
  }

  // The text column under the avatars, top to bottom: [{ role, text, size,
  // weight, color, gap (above), h, base }].
  function content(o, st, measure){
    var items = [], names = o.names;
    function add(role, text, size, weight, color, gap, h, base){
      items.push({ role: role, text: text, size: size, weight: weight, color: color, gap: gap,
                   h: h == null ? size : h, base: base == null ? Math.round(size * 0.8) : base });
    }
    var nm;
    if(o.mode === "milestone"){
      var m = o.milestone, emoji = C.clipGraphemes(String(m.emoji || "💗"), 16) || "💗";
      // The emoji sits on a white disc: platform emoji art (a red 💯) can
      // vanish on the pink background.
      var es = Math.min(120, st.emoji), disc = Math.round(es * 1.5);
      while(es > 40 && measure(emoji, es, 400) > disc * 0.74) es -= 4;
      add("emoji", emoji, es, 400, st.text, 0, disc, Math.round(disc / 2));
      var t = fitTitle(String(m.title || ""), st.title, Math.round(st.title * 0.72), 800, MAXW, measure);
      t.lines.forEach(function(line, i){
        add("title", line, t.size, 800, st.main, i ? Math.round(t.size * 0.16) : 26);
      });
      add("date", weekday(m.date) + ", " + fmtDate(m.date), st.line, 600, st.text, 24);
      var dayNo = m.dayNo === undefined ? C.dayIdx(m.date) - C.dayIdx(o.startDate) + 1 : m.dayNo;
      if(typeof dayNo === "number" && dayNo >= 1){
        add("dayNo", "Ngày thứ " + C.fmtInt(dayNo) + " bên nhau", st.line, 800, st.main, 14);
      }
      nm = fitNames(names[0], names[1], st.line, Math.round(st.line * 0.7), 700, MAXW, measure);
      add("names", nm.text, nm.size, 700, st.muted, 28);
    } else {
      var num = fitLine(C.fmtInt(o.n), st.num, 110, 800, MAXW, measure);
      add("number", num.text, num.size, 800, st.main, 0, Math.round(num.size * 0.8), Math.round(num.size * 0.76));
      add("label", "ngày bên nhau", st.label, 700, st.text, 14);
      nm = fitNames(names[0], names[1], st.name, Math.round(st.name * 0.7), 700, MAXW, measure);
      add("names", nm.text, nm.size, 700, st.text, 30);
      add("since", "Từ " + fmtDate(o.startDate), st.sub, 600, st.muted, 16);
    }
    return items;
  }
  function stackHeight(items){
    return items.reduce(function(sum, it){ return sum + it.gap + it.h; }, 0);
  }

  function plan(opts, measure){
    measure = measure || estimate;
    var template = STYLES[opts.template] ? opts.template : "plain";
    var size = opts.size === "story" ? "story" : "post";
    var mode = opts.mode === "milestone" && opts.milestone ? "milestone" : "days";
    var names = [String((opts.names || [])[0] || "").trim(), String((opts.names || [])[1] || "").trim()];
    var has = opts.has || {};
    var o = { mode: mode, n: opts.n, startDate: opts.startDate, names: names, milestone: opts.milestone };
    var H = HEIGHTS[size], st = STYLES[template], cx = W / 2;
    var p = { w: W, h: H, template: template, size: size, mode: mode,
              bg: null, shades: [], hearts: [], chips: [], images: [], texts: [], textShadow: false };
    var items = content(o, st, measure), ch = stackHeight(items);
    var av = template === "card" && mode === "milestone" ? 156 : st.av;

    function placeText(top){
      var y = top;
      items.forEach(function(it){
        y += it.gap;
        var w = measure(it.text, it.size, it.weight), isEmoji = it.role === "emoji";
        if(isEmoji) p.chips.push({ x: cx, y: Math.round(y + it.h / 2), r: Math.round(it.h / 2), color: template === "card" ? WHITE : "rgba(255,255,255,.94)" });
        p.texts.push({ role: it.role, text: it.text, x: cx, y: Math.round(y + it.base), size: it.size, weight: it.weight,
                       align: "center", baseline: isEmoji ? "middle" : "alphabetic", maxWidth: MAXW, color: it.color, width: Math.round(w) });
        y += it.h;
      });
    }
    // Two circles 0.28 × diameter apart with the heart chip on their axis —
    // the same arrangement as the app's hero.
    function placeAvatars(cy){
      var r = av / 2, off = r + av * 0.14, ringW = Math.round(av * 0.045);
      [["avatarLong", -1, PINK, 0], ["avatarThu", 1, WARM, 1]].forEach(function(a){
        var x = cx + a[1] * off;
        p.images.push({ id: a[0], box: { x: Math.round(x - r), y: Math.round(cy - r), w: av, h: av }, shape: "circle",
                        has: !!has[a[0]], fill: a[2], ring: { width: ringW, color: st.ring } });
        if(!has[a[0]]){
          var isz = Math.round(av * 0.42);
          p.texts.push({ role: "initial", text: initial(names[a[3]]), x: Math.round(x), y: Math.round(cy + isz * 0.36), size: isz, weight: 800,
                         align: "center", baseline: "alphabetic", maxWidth: av, color: WHITE, width: Math.round(measure(initial(names[a[3]]), isz, 800)) });
        }
      });
      p.hearts.push({ x: cx, y: Math.round(cy), size: Math.round(av * 0.3), color: "#E8505B", chip: { r: Math.round(av * 0.25), color: WHITE } });
    }
    function deco(list, color){
      list.forEach(function(d){ p.hearts.push({ x: Math.round(d[0]), y: Math.round(d[1]), size: d[2], color: color, chip: null }); });
    }

    if(template === "cover"){
      var total = av + 30 + ch, top = H - (size === "story" ? 250 : 84) - total;
      p.bg = { colors: ["#F2789C", "#C2185B"], dir: "v" };
      if(has.cover){
        p.images.push({ id: "cover", box: { x: 0, y: 0, w: W, h: H }, shape: "fill", has: true, fill: null, ring: null });
        // White text has to stay readable on a bright photo.
        p.shades.push({ x: 0, y: top - 320, w: W, h: H - (top - 320),
                        stops: [[0, "rgba(40,8,22,0)"], [0.18, "rgba(40,8,22,.16)"], [0.4, "rgba(40,8,22,.5)"], [0.68, "rgba(40,8,22,.74)"], [1, "rgba(40,8,22,.88)"]] });
        p.textShadow = true;
      } else {
        deco([[540, top * 0.5, Math.round(Math.min(460, top * 0.62))]], "rgba(255,255,255,.16)");
        deco([[170, top * 0.2, 110], [900, top * 0.3, 84], [800, top * 0.84, 56], [250, top * 0.8, 64]], "rgba(255,255,255,.22)");
      }
      placeAvatars(top + av / 2);
      placeText(top + av + 30);
    } else if(template === "card"){
      p.bg = { colors: ["#FFF5F7", "#FFE4EC"], dir: "v" };
      var gap = 26, room = 1350 - 84 - 100 - av / 2 - gap - ch;
      var fh = Math.round(Math.min(702, room)), fw = Math.round(fh * 4 / 3);
      var whole = fh + av / 2 + gap + ch, fy = Math.round((H - whole) / 2), fx = Math.round((W - fw) / 2);
      p.images.push({ id: "cover", box: { x: fx, y: fy, w: fw, h: fh }, shape: "round", radius: 44, has: !!has.cover, fill: COVER_FILL, ring: null });
      if(!has.cover){
        deco([[fx + fw * 0.16, fy + fh * 0.3, 120], [fx + fw * 0.84, fy + fh * 0.62, 84], [fx + fw * 0.74, fy + fh * 0.2, 56]], "rgba(255,255,255,.6)");
      }
      placeAvatars(fy + fh);
      placeText(fy + fh + av / 2 + gap);
    } else {
      p.bg = { colors: PINK, dir: "d" };
      deco([[150, H * 0.1, 210], [950, H * 0.2, 120], [930, H * 0.86, 230], [130, H * 0.8, 110], [560, H * 0.955, 64]], "rgba(255,255,255,.12)");
      var all = av + 44 + ch, t0 = Math.round((H - all) / 2);
      placeAvatars(t0 + av / 2);
      placeText(t0 + av + 44);
    }
    return p;
  }

  // ---------- Painting ----------
  function gradient(ctx, colors, x0, y0, x1, y1){
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    colors.forEach(function(c, i){ g.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), c); });
    return g;
  }
  function shapePath(ctx, im){
    var b = im.box;
    ctx.beginPath();
    if(im.shape === "circle") ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2);
    else if(im.shape === "round"){
      var r = im.radius;
      ctx.moveTo(b.x + r, b.y);
      ctx.arcTo(b.x + b.w, b.y, b.x + b.w, b.y + b.h, r);
      ctx.arcTo(b.x + b.w, b.y + b.h, b.x, b.y + b.h, r);
      ctx.arcTo(b.x, b.y + b.h, b.x, b.y, r);
      ctx.arcTo(b.x, b.y, b.x + b.w, b.y, r);
    } else ctx.rect(b.x, b.y, b.w, b.h);
    ctx.closePath();
  }
  function drawHeart(ctx, h){
    if(h.chip){
      ctx.save();
      ctx.shadowColor = "rgba(120,20,50,.28)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      ctx.fillStyle = h.chip.color;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.chip.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    var k = h.size / 24;
    ctx.save();
    // The glyph's box inside its 24×24 viewBox is centred on (12, 12.75).
    ctx.translate(h.x - 12 * k, h.y - 12.75 * k);
    ctx.scale(k, k);
    ctx.fillStyle = h.color;
    ctx.fill(new Path2D(HEART));
    ctx.restore();
  }

  // Decodes one source, paints it and releases the bitmap before the next one
  // is touched (a decoded 1600px cover is ~7MB, the canvas another 8MB).
  function drawImage(ctx, im, buf){
    var b = im.box;
    if(im.ring){
      ctx.save();
      ctx.shadowColor = "rgba(60,10,30,.3)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
      ctx.fillStyle = im.ring.color;
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 + im.ring.width, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if(im.shape === "round"){
      ctx.save();
      ctx.shadowColor = "rgba(170,40,90,.22)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
      ctx.fillStyle = "#FFFFFF";
      shapePath(ctx, im); ctx.fill();
      ctx.restore();
    }
    if(im.fill){
      ctx.save();
      shapePath(ctx, im); ctx.clip();
      ctx.fillStyle = gradient(ctx, im.fill, b.x, b.y, b.x + b.w, b.y + b.h);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.restore();
    }
    if(!im.has || !buf) return Promise.resolve();
    return root.LoveMedia.decode(new Blob([buf], { type: "image/jpeg" })).then(function(img){
      try{
        var scale = Math.max(b.w / img.w, b.h / img.h);
        var sw = b.w / scale, sh = b.h / scale;
        // Faces sit above the middle more often than below it.
        var sx = (img.w - sw) / 2, sy = (img.h - sh) * (im.shape === "circle" ? 0.5 : 0.4);
        ctx.save();
        shapePath(ctx, im); ctx.clip();
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img.source, sx, sy, sw, sh, b.x, b.y, b.w, b.h);
        ctx.restore();
      } finally { img.release(); }
    }, function(){});
  }

  function render(p, sources, fontFamily){
    sources = sources || {};
    var canvas = document.createElement("canvas");
    canvas.width = p.w; canvas.height = p.h;
    var ctx = canvas.getContext("2d");
    function free(){ canvas.width = 0; canvas.height = 0; }
    function image(id){
      var im = null;
      p.images.forEach(function(x){ if(x.id === id) im = x; });
      return im ? drawImage(ctx, im, sources[id]) : Promise.resolve();
    }
    return Promise.resolve().then(function(){
      ctx.fillStyle = gradient(ctx, p.bg.colors, 0, 0, p.bg.dir === "d" ? p.w * 0.55 : 0, p.h);
      ctx.fillRect(0, 0, p.w, p.h);
      return image("cover");
    }).then(function(){
      p.shades.forEach(function(s){
        var g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
        s.stops.forEach(function(stop){ g.addColorStop(stop[0], stop[1]); });
        ctx.fillStyle = g;
        ctx.fillRect(s.x, s.y, s.w, s.h);
      });
      p.hearts.forEach(function(h){ if(!h.chip) drawHeart(ctx, h); });
      return image("avatarLong");
    }).then(function(){
      return image("avatarThu");
    }).then(function(){
      p.hearts.forEach(function(h){ if(h.chip) drawHeart(ctx, h); });
      p.chips.forEach(function(c){
        ctx.save();
        ctx.shadowColor = "rgba(120,20,50,.22)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
        ctx.fillStyle = c.color;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      ctx.textAlign = "center";
      p.texts.forEach(function(t){
        ctx.save();
        ctx.textBaseline = t.baseline;
        if(p.textShadow && t.role !== "initial" && t.role !== "emoji"){ ctx.shadowColor = "rgba(20,4,10,.55)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 2; }
        ctx.font = t.weight + " " + t.size + "px " + fontFamily;
        ctx.fillStyle = t.color;
        // maxWidth is only a last guard for a plan made without measurer().
        ctx.fillText(t.text, t.x, t.y, t.maxWidth);
        ctx.restore();
      });
      return new Promise(function(resolve, reject){
        canvas.toBlob(function(blob){
          if(blob) resolve(blob); else reject(new Error("encode"));
        }, "image/jpeg", 0.9);
      });
    }).then(function(blob){ free(); return blob; }, function(err){ free(); throw err; });
  }

  root.LoveShare = { plan: plan, render: render, measurer: measurer, SIZES: { post: [W, HEIGHTS.post], story: [W, HEIGHTS.story] } };
})(self);
