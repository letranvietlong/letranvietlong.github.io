// Backup = one uncompressed ZIP (method 0 "STORE", no zip64) holding
// love-days.json + photos/<id>.jpg + avatars/long.jpg + avatars/thu.jpg +
// cover.jpg. JPEGs don't shrink under deflate, and STORE lets the reader slice
// entries straight out of the File without inflating anything in memory.
// The reader accepts only what this writer produces.
(function(root){
  "use strict";

  var C = root.LoveCore, M = root.LoveMedia;

  var APP = "love-days";
  var FORMAT = 1;
  var MANIFEST = "love-days.json";
  // Shared by export and import so the app never writes a file it would
  // refuse to read back. 10.000 album photos (~4 GB at 1600px) already sit at
  // the no-zip64 4 GB ceiling, so a higher count could never be exported anyway.
  var MAX_PHOTOS = 10000;
  var MAX_MILESTONES = 2000;
  var MAX_ENTRIES = MAX_PHOTOS + 10;
  var MAX_MANIFEST_BYTES = 8 * 1048576;
  var MAX_ZIP_BYTES = 0xFFFFFFFF - 1048576;
  var IMAGE_NAMES = { "avatar-long": "avatars/long.jpg", "avatar-thu": "avatars/thu.jpg", cover: "cover.jpg" };
  var PHOTO_NAME_RE = /^photos\/([\w-]{1,64})\.jpg$/;

  function fail(msg){ var e = new Error(msg); e.userMessage = msg; throw e; }

  // Reads the cycle list of a backup. A malformed list (not an array, too
  // long, an item the validator rejects) returns null and refuses the file.
  // Cycles that merely clash with an earlier one (same id, same start,
  // overlapping) are dropped one by one and counted: the writer exports the
  // log as it is, so a clash must never make a backup unreadable.
  function readCycles(list){
    if(!Array.isArray(list) || list.length > C.MAX_CYCLES) return null;
    var out = [], ids = Object.create(null), skipped = 0;
    for(var i = 0; i < list.length; i++){
      var v = C.validateCycle(list[i]);
      if(!v) return null;
      if(ids[v.id] || C.cycleConflict(out, v, null)){ skipped++; continue; }
      ids[v.id] = true;
      out.push(v);
    }
    return { items: out, skipped: skipped };
  }

  // Same contract for the "Muốn làm" list: a malformed list refuses the file,
  // a repeated id only drops that one item.
  function readWishes(list){
    if(!Array.isArray(list) || list.length > C.MAX_WISHES) return null;
    var out = [], ids = Object.create(null), skipped = 0;
    for(var i = 0; i < list.length; i++){
      var v = C.validateWish(list[i]);
      if(!v) return null;
      if(ids[v.id]){ skipped++; continue; }
      ids[v.id] = true;
      out.push(v);
    }
    return { items: out, skipped: skipped };
  }

  // ---------- CRC32 ----------
  var CRC_TABLE = (function(){
    var t = new Uint32Array(256);
    for(var n = 0; n < 256; n++){
      var c = n;
      for(var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(data){
    var u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    var c = 0xFFFFFFFF;
    for(var i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function asciiBytes(s){
    var u8 = new Uint8Array(s.length);
    for(var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }
  function utf8Bytes(s){ return new TextEncoder().encode(s); }
  function isJpeg(buf){
    var u8 = new Uint8Array(buf, 0, Math.min(3, buf.byteLength));
    return u8.length === 3 && u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF;
  }

  // ---------- ZIP writer ----------
  // Each entry is turned into its own Blob right away so the ArrayBuffer read
  // from IndexedDB can be garbage-collected before the next one is loaded.
  function zipWriter(nowMs){
    var w = C.wall(nowMs);
    var dosTime = (w.h << 11) | (w.mi << 5) | (w.s >> 1);
    var dosDate = ((Math.max(1980, w.y) - 1980) << 9) | (w.m << 5) | w.d;
    var parts = [], central = [], offset = 0, count = 0;
    return {
      add: function(name, data){
        var bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        var nameB = asciiBytes(name), crc = crc32(bytes), size = bytes.length;
        if(offset + 30 + nameB.length + size > MAX_ZIP_BYTES) fail("Bản sao lưu vượt quá 4 GB — hãy xoá bớt ảnh rồi thử lại.");
        var lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true);
        lh.setUint16(4, 20, true);
        lh.setUint16(6, 0, true);
        lh.setUint16(8, 0, true);
        lh.setUint16(10, dosTime, true);
        lh.setUint16(12, dosDate, true);
        lh.setUint32(14, crc, true);
        lh.setUint32(18, size, true);
        lh.setUint32(22, size, true);
        lh.setUint16(26, nameB.length, true);
        lh.setUint16(28, 0, true);
        parts.push(new Blob([lh.buffer, nameB, bytes]));
        var ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true);
        ch.setUint16(4, 20, true);
        ch.setUint16(6, 20, true);
        ch.setUint16(8, 0, true);
        ch.setUint16(10, 0, true);
        ch.setUint16(12, dosTime, true);
        ch.setUint16(14, dosDate, true);
        ch.setUint32(16, crc, true);
        ch.setUint32(20, size, true);
        ch.setUint32(24, size, true);
        ch.setUint16(28, nameB.length, true);
        ch.setUint16(30, 0, true);
        ch.setUint16(32, 0, true);
        ch.setUint16(34, 0, true);
        ch.setUint16(36, 0, true);
        ch.setUint32(38, 0, true);
        ch.setUint32(42, offset, true);
        central.push(ch.buffer, nameB);
        offset += 30 + nameB.length + size;
        count++;
      },
      finish: function(){
        var cdBlob = new Blob(central);
        if(count > 0xFFFF || offset + cdBlob.size + 22 > MAX_ZIP_BYTES) fail("Bản sao lưu quá lớn — hãy xoá bớt ảnh rồi thử lại.");
        var e = new DataView(new ArrayBuffer(22));
        e.setUint32(0, 0x06054b50, true);
        e.setUint16(4, 0, true);
        e.setUint16(6, 0, true);
        e.setUint16(8, count, true);
        e.setUint16(10, count, true);
        e.setUint32(12, cdBlob.size, true);
        e.setUint32(16, offset, true);
        e.setUint16(20, 0, true);
        return new Blob(parts.concat([cdBlob, e.buffer]), { type: "application/zip" });
      }
    };
  }

  // src: { profile, milestones, photos (validated metadata), cycles (validated; null or empty = no "cycles" key),
  //        wishes (same rule as cycles), readBlob(id) → Promise<record|null> }
  async function buildBackup(src, nowMs, onProgress){
    if(src.photos.length > MAX_PHOTOS) fail("Album có " + C.fmtInt(src.photos.length) + " ảnh, vượt giới hạn " + C.fmtInt(MAX_PHOTOS) + " ảnh của một bản sao lưu. Hãy xoá bớt ảnh rồi thử lại.");
    if(src.milestones.length > MAX_MILESTONES) fail("Có " + C.fmtInt(src.milestones.length) + " kỷ niệm, vượt giới hạn " + C.fmtInt(MAX_MILESTONES) + " kỷ niệm của một bản sao lưu. Hãy xoá bớt rồi thử lại.");
    // An empty log writes no "cycles" key at all: importing with "Thay thế"
    // must never read "this backup has no cycles" as "delete the device's".
    var cycles = null;
    if(src.cycles && src.cycles.length){
      if(src.cycles.length > C.MAX_CYCLES) fail("Có " + C.fmtInt(src.cycles.length) + " kỳ, vượt giới hạn " + C.fmtInt(C.MAX_CYCLES) + " kỳ của một bản sao lưu. Hãy xoá bớt rồi thử lại.");
      cycles = src.cycles.map(function(c){ return { id: c.id, start: c.start, end: c.end, note: c.note, createdAt: c.createdAt }; });
    }
    var wishes = null;
    if(src.wishes && src.wishes.length){
      if(src.wishes.length > C.MAX_WISHES) fail("Có " + C.fmtInt(src.wishes.length) + " việc muốn làm, vượt giới hạn " + C.fmtInt(C.MAX_WISHES) + " việc của một bản sao lưu. Hãy xoá bớt rồi thử lại.");
      wishes = src.wishes.map(function(w){
        return { id: w.id, title: w.title, cat: w.cat, note: w.note, planDate: w.planDate, doneDate: w.doneDate, milestoneId: w.milestoneId, createdAt: w.createdAt };
      });
    }
    var zip = zipWriter(nowMs);
    var photos = src.photos.slice().sort(function(a, b){ return a.order - b.order; });
    var manifestPhotos = [], images = {}, done = 0;
    var total = photos.length + C.PROFILE_BLOB_IDS.length;
    for(var i = 0; i < photos.length; i++){
      var p = photos[i];
      var rec = await src.readBlob(p.id);
      if(rec && rec.data instanceof ArrayBuffer && rec.data.byteLength){
        var file = "photos/" + p.id + ".jpg";
        zip.add(file, rec.data);
        manifestPhotos.push({ id: p.id, caption: p.caption, takenAt: p.takenAt, addedAt: p.addedAt, order: p.order,
                              w: p.w, h: p.h, bytes: rec.data.byteLength, sha256: p.sha256, file: file });
      }
      rec = null;
      if(onProgress) onProgress(++done, total);
    }
    for(var j = 0; j < C.PROFILE_BLOB_IDS.length; j++){
      var id = C.PROFILE_BLOB_IDS[j];
      var b = await src.readBlob(id);
      if(b && b.data instanceof ArrayBuffer && b.data.byteLength){
        zip.add(IMAGE_NAMES[id], b.data);
        images[id] = IMAGE_NAMES[id];
      }
      if(onProgress) onProgress(++done, total);
    }
    // A link to a photo that isn't in this file (deleted, or its blob is gone) would point at nothing after import.
    var inFile = Object.create(null);
    manifestPhotos.forEach(function(x){ inFile[x.id] = true; });
    var pr = src.profile;
    var manifest = {
      app: APP, format: FORMAT, exportedAt: new Date(nowMs).toISOString(),
      profile: { startDate: pr.startDate, persons: pr.persons.map(function(x){ return { id: x.id, name: x.name, dob: x.dob }; }),
                 hasCover: !!images.cover },
      milestones: src.milestones.map(function(m){
        return { id: m.id, title: m.title, date: m.date, emoji: m.emoji, note: m.note, repeatYearly: m.repeatYearly, createdAt: m.createdAt,
                 photoIds: (m.photoIds || []).filter(function(id){ return inFile[id]; }) };
      }),
      photos: manifestPhotos,
      images: images
    };
    if(cycles) manifest.cycles = cycles;
    if(wishes) manifest.wishes = wishes;
    // Written last because it records the byte size of every image read
    // above; entry order doesn't matter to readZip().
    zip.add(MANIFEST, utf8Bytes(JSON.stringify(manifest)));
    var blob = zip.finish();
    var name = "love-days-backup-" + C.todayStr(nowMs) + ".zip";
    return { file: new File([blob], name, { type: "application/zip" }), name: name, size: blob.size,
             counts: { photos: manifestPhotos.length, milestones: manifest.milestones.length, images: Object.keys(images).length,
                       cycles: cycles ? cycles.length : null, wishes: wishes ? wishes.length : null } };
  }

  // ---------- ZIP reader ----------
  async function readZip(file){
    if(!file || typeof file.size !== "number" || file.size < 22) fail("File này không phải bản sao lưu LoveDays (.zip).");
    var head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    var startsPK = head[0] === 0x50 && head[1] === 0x4B && head[2] === 0x03 && head[3] === 0x04;
    var tail = new DataView(await file.slice(file.size - 22).arrayBuffer());
    if(tail.getUint32(0, true) !== 0x06054b50){
      if(startsPK) fail("File sao lưu bị thiếu phần cuối (có thể tải về chưa xong hoặc bị cắt). Hãy lấy lại file gốc.");
      fail("File này không phải bản sao lưu LoveDays (.zip).");
    }
    var n = tail.getUint16(10, true), cdSize = tail.getUint32(12, true), cdOff = tail.getUint32(16, true);
    if(tail.getUint16(4, true) || tail.getUint16(6, true) || tail.getUint16(8, true) !== n || tail.getUint16(20, true)){
      fail("File .zip này không do LoveDays tạo nên không đọc được.");
    }
    if(!startsPK || cdOff + cdSize !== file.size - 22) fail("File sao lưu bị hỏng (cấu trúc .zip không khớp).");
    if(n < 1 || n > MAX_ENTRIES) fail("File sao lưu có số mục không hợp lệ.");
    var cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
    var entries = {}, pos = 0;
    for(var i = 0; i < n; i++){
      if(pos + 46 > cdSize || cd.getUint32(pos, true) !== 0x02014b50) fail("File sao lưu bị hỏng (mục lục .zip sai).");
      var flags = cd.getUint16(pos + 8, true), method = cd.getUint16(pos + 10, true);
      var crc = cd.getUint32(pos + 16, true), csize = cd.getUint32(pos + 20, true), usize = cd.getUint32(pos + 24, true);
      var nlen = cd.getUint16(pos + 28, true), elen = cd.getUint16(pos + 30, true), clen = cd.getUint16(pos + 32, true);
      var lho = cd.getUint32(pos + 42, true);
      if(flags & 0x0009 || method !== 0 || csize !== usize){
        fail("File .zip này đã bị nén lại hoặc mã hoá bởi ứng dụng khác — hãy dùng đúng file LoveDays đã tạo.");
      }
      if(pos + 46 + nlen + elen + clen > cdSize || nlen < 1 || nlen > 200) fail("File sao lưu bị hỏng (tên mục sai).");
      var name = "";
      for(var k = 0; k < nlen; k++) name += String.fromCharCode(cd.getUint8(pos + 46 + k));
      if(!/^[\w./-]+$/.test(name) || name.indexOf("..") !== -1 || name.charAt(0) === "/") fail("File sao lưu chứa tên mục không hợp lệ.");
      if(entries[name]) fail("File sao lưu bị hỏng (trùng mục " + name + ").");
      if(lho + 30 + nlen + usize > cdOff) fail("File sao lưu bị hỏng (vị trí dữ liệu sai).");
      entries[name] = { name: name, crc: crc, size: usize, offset: lho };
      pos += 46 + nlen + elen + clen;
    }
    return { file: file, entries: entries, cdOff: cdOff };
  }

  async function readEntry(zip, entry, wantJpeg){
    var lh = new DataView(await zip.file.slice(entry.offset, entry.offset + 30).arrayBuffer());
    if(lh.byteLength < 30 || lh.getUint32(0, true) !== 0x04034b50 || lh.getUint16(8, true) !== 0) fail("Mục " + entry.name + " trong bản sao lưu bị hỏng.");
    var start = entry.offset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    var end = start + entry.size;
    if(end > zip.cdOff) fail("Mục " + entry.name + " trong bản sao lưu bị hỏng.");
    var buf = await zip.file.slice(start, end).arrayBuffer();
    if(buf.byteLength !== entry.size || crc32(buf) !== entry.crc) fail("Mục " + entry.name + " trong bản sao lưu bị hỏng (sai mã kiểm tra CRC).");
    if(wantJpeg && !isJpeg(buf)) fail("Mục " + entry.name + " không phải ảnh JPEG.");
    return buf;
  }

  // ---------- Parse + validate ----------
  function badData(msg){ fail("Dữ liệu trong bản sao lưu bị lỗi: " + msg + "."); }
  function validName(v){ return typeof v === "string" && v.trim() && v.length <= 40; }

  async function parseBackup(file, nowMs){
    var zip = await readZip(file);
    var me = zip.entries[MANIFEST];
    if(!me) fail("File .zip này không phải bản sao lưu LoveDays (thiếu love-days.json).");
    if(me.size > MAX_MANIFEST_BYTES) fail("love-days.json trong bản sao lưu lớn bất thường.");
    var raw = await readEntry(zip, me, false);
    var data;
    try{ data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); }
    catch(e){ fail("love-days.json trong bản sao lưu không đọc được."); }
    if(!data || typeof data !== "object" || data.app !== APP) fail("File này không phải bản sao lưu LoveDays.");
    if(data.format !== FORMAT) fail('Bản sao lưu dùng định dạng "' + String(data.format) + '" mà phiên bản app này chưa hỗ trợ.');

    var p = data.profile;
    if(!p || typeof p !== "object") badData("thiếu hồ sơ");
    var st = C.checkStartDate(p.startDate, nowMs);
    if(st === "invalid") badData('ngày bắt đầu "' + String(p.startDate).slice(0, 20) + '" không hợp lệ');
    if(st === "future") badData("ngày bắt đầu " + p.startDate + " nằm sau hôm nay");
    if(!Array.isArray(p.persons) || p.persons.length !== 2) badData("hồ sơ phải có đúng 2 người");
    var persons = p.persons.map(function(x, i){
      var def = C.DEFAULT_PERSONS[i];
      if(!x || typeof x !== "object" || x.id !== def.id || !validName(x.name)) badData("tên người thứ " + (i + 1) + " không hợp lệ");
      if(x.dob != null && C.checkStartDate(x.dob, nowMs) !== "ok") badData('ngày sinh "' + String(x.dob).slice(0, 20) + '" không hợp lệ');
      return { id: def.id, name: x.name.trim(), dob: x.dob || null };
    });
    var profile = { key: "profile", startDate: p.startDate, persons: persons, hasCover: false, activeGen: "g1", updatedAt: nowMs };

    if(!Array.isArray(data.milestones) || data.milestones.length > MAX_MILESTONES) badData("danh sách kỷ niệm sai");
    var seenM = {};
    var milestones = data.milestones.map(function(m, i){
      var v = C.validateMilestone(m);
      if(!v) badData("kỷ niệm thứ " + (i + 1) + " không hợp lệ");
      if(seenM[v.id]) badData("trùng mã kỷ niệm " + v.id);
      seenM[v.id] = true;
      return v;
    });

    if(!Array.isArray(data.photos) || data.photos.length > MAX_PHOTOS) badData("danh sách ảnh sai");
    var seenP = {};
    var photos = data.photos.map(function(ph, i){
      var v = ph && typeof ph === "object" ? C.validatePhoto(Object.assign({}, ph, { gen: "import" })) : null;
      if(!v) badData("ảnh thứ " + (i + 1) + " có thông tin không hợp lệ");
      if(seenP[v.id]) badData("trùng mã ảnh " + v.id);
      seenP[v.id] = true;
      var m = typeof ph.file === "string" && PHOTO_NAME_RE.exec(ph.file);
      if(!m) badData("tên file của ảnh thứ " + (i + 1) + " không hợp lệ");
      if(!zip.entries[ph.file]) fail("Bản sao lưu thiếu ảnh " + ph.file + ".");
      v.file = ph.file;
      return v;
    });

    var images = {};
    var imgs = data.images && typeof data.images === "object" ? data.images : {};
    Object.keys(imgs).forEach(function(id){
      if(!IMAGE_NAMES[id] || imgs[id] !== IMAGE_NAMES[id]) badData("mục ảnh " + String(id).slice(0, 20) + " không hợp lệ");
      if(!zip.entries[imgs[id]]) fail("Bản sao lưu thiếu ảnh " + imgs[id] + ".");
      images[id] = imgs[id];
    });
    profile.hasCover = !!images.cover;

    // null = the file brings no cycles (older backup, or an empty list): the
    // device's log is then left alone in both import modes.
    var cycles = null, cyclesSkipped = 0;
    if(data.cycles != null){
      var rc = readCycles(data.cycles);
      if(!rc) badData("danh sách chu kỳ sai");
      if(rc.items.length) cycles = rc.items;
      cyclesSkipped = rc.skipped;
    }
    var wishes = null, wishesSkipped = 0;
    if(data.wishes != null){
      var rw = readWishes(data.wishes);
      if(!rw) badData("danh sách việc muốn làm sai");
      if(rw.items.length) wishes = rw.items;
      wishesSkipped = rw.skipped;
    }

    // Dry run: the exact derivation the home/milestone screens perform.
    try{
      var r = C.computeAll(C.validateProfile(profile, nowMs), milestones, nowMs);
      if(!r || !isFinite(r.n)) throw new Error("n");
      if(cycles){
        var cs = C.cycleStats(cycles, nowMs);
        if(!cs || !isFinite(cs.cycleLen) || cs.list.length !== cycles.length) throw new Error("cycles");
      }
      if(wishes){
        var wv = C.wishView(wishes, nowMs);
        if(!wv || wv.soon.length + wv.open.length + wv.done.length !== wishes.length) throw new Error("wishes");
      }
    }catch(e){ fail("Dữ liệu trong bản sao lưu không hiển thị được nên không nhập."); }

    var exportedAt = Date.parse(data.exportedAt);
    return { zip: zip, profile: profile, milestones: milestones, photos: photos, images: images, cycles: cycles, cyclesSkipped: cyclesSkipped,
             wishes: wishes, wishesSkipped: wishesSkipped,
             exportedAt: isFinite(exportedAt) ? exportedAt : null };
  }

  // What a MERGE would add, for the confirmation screen.
  function planMerge(parsed, local, nowMs){
    var shas = {}, seen = {}, add = 0, skip = 0;
    local.photos.forEach(function(p){ if(p.sha256) shas[p.sha256] = true; });
    parsed.photos.forEach(function(p){
      if(p.sha256 && (shas[p.sha256] || seen[p.sha256])){ skip++; return; }
      if(p.sha256) seen[p.sha256] = true;
      add++;
    });
    var ids = {};
    local.milestones.forEach(function(m){ ids[m.id] = true; });
    var addM = parsed.milestones.filter(function(m){ return !ids[m.id]; }).length;
    var cy = planCycles(parsed, local, false, nowMs);
    var wi = planWishes(parsed, local, false, nowMs);
    return { addPhotos: add, skipPhotos: skip, addMilestones: addM, skipMilestones: parsed.milestones.length - addM,
             addCycles: cy.added, skipCycles: cy.skipped, addWishes: wi.added, skipWishes: wi.skipped, overWishes: wi.over };
  }

  // planCycles' twin for the "Muốn làm" list (kv 'wishes'), same rules.
  function planWishes(parsed, local, replace, nowMs){
    var mine = local.wishes || [], bad = local.wishesBad || [];
    if(!parsed.wishes) return { record: null, added: 0, skipped: 0, over: 0, kept: replace && (mine.length > 0 || bad.length > 0 || !!local.wishesBroken) };
    if(local.wishesBroken) return { record: null, added: 0, skipped: 0, over: 0, kept: true };
    var next, added, skipped = 0, over = 0;
    if(replace){ next = parsed.wishes; added = next.length; }
    else {
      var mg = C.mergeWishes(mine, parsed.wishes);
      next = mg.items; added = mg.added; skipped = mg.skipped; over = mg.over || 0;
    }
    var stamp = typeof local.wishesStamp === "number" && nowMs <= local.wishesStamp ? local.wishesStamp + 1 : nowMs;
    return { record: replace || added ? { key: "wishes", items: next.concat(bad), updatedAt: stamp } : null,
             added: added, skipped: skipped, over: over, kept: false };
  }

  // What an import does to the cycle log. record = the kv record to write, or
  // null to leave the stored one untouched: a file without a cycle list never
  // clears the device's, and an unreadable stored record is never overwritten.
  function planCycles(parsed, local, replace, nowMs){
    var mine = local.cycles || [], bad = local.cyclesBad || [];
    if(!parsed.cycles) return { record: null, added: 0, skipped: 0, kept: replace && (mine.length > 0 || bad.length > 0 || !!local.cyclesBroken) };
    if(local.cyclesBroken) return { record: null, added: 0, skipped: 0, kept: true };
    var next, added, skipped = 0;
    if(replace){ next = parsed.cycles; added = next.length; }
    else {
      var mg = C.mergeCycles(mine, parsed.cycles, nowMs);
      next = mg.items; added = mg.added; skipped = mg.skipped;
    }
    // The stamp must differ from the one other windows loaded (see saveCycles in love-days.js).
    var stamp = typeof local.cyclesStamp === "number" && nowMs <= local.cyclesStamp ? local.cyclesStamp + 1 : nowMs;
    return { record: replace || added ? { key: "cycles", items: next.concat(bad), updatedAt: stamp } : null,
             added: added, skipped: skipped, kept: false };
  }

  function newId(){ return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ---------- Import ----------
  // Crash safety without one long transaction (IndexedDB auto-commits across
  // awaits): every imported image is staged as a blob under a FRESH id with no
  // photo record, so it is invisible and cleanupGenerations() removes it on the
  // next open if we never finish. The visible switch — photo records, profile,
  // milestones, avatars/cover — is ONE final transaction. Existing records are
  // never rewritten before that point; REPLACE deletes them inside it.
  //
  // ctx: { db, parsed, mode:'merge'|'replace',
  //        local:{ profileOk, profile, photos, milestones, hasBlob:{id:bool}, cycles, cyclesBad, cyclesBroken, cyclesStamp,
  //                wishes, wishesBad, wishesBroken, wishesStamp },
  //        nowMs, onProgress(done,total) }
  async function importBackup(ctx){
    var db = ctx.db, parsed = ctx.parsed, local = ctx.local, replace = ctx.mode === "replace";
    // REPLACE removes every existing photo, so "g1" is safe; MERGE must keep
    // whatever gen the existing photos are filtered by (see genForWrite).
    var gens = replace ? { write: "g1", trusted: "g1", tag: "g1" } : C.genForWrite(local.profile, local.photos);
    var activeGen = gens.tag;
    // Photo ids change on import (fresh id per staged photo; a duplicate keeps
    // the copy already on the device), so milestone links are rewritten through
    // idMap: id in the file → id the photo ends up with.
    var shaLocal = Object.create(null), shaFile = Object.create(null), idMap = Object.create(null), sameAs = [];
    if(!replace) local.photos.forEach(function(p){ if(p.sha256 && !shaLocal[p.sha256]) shaLocal[p.sha256] = p.id; });

    var todo = [];
    parsed.photos.slice().sort(function(a, b){ return a.order - b.order; }).forEach(function(p){
      if(p.sha256 && shaLocal[p.sha256]){ idMap[p.id] = shaLocal[p.sha256]; return; }
      if(p.sha256 && shaFile[p.sha256]){ sameAs.push([p.id, shaFile[p.sha256]]); return; }
      if(p.sha256) shaFile[p.sha256] = p.id;
      todo.push(p);
    });

    var imageIds = Object.keys(parsed.images).filter(function(id){ return replace || !local.hasBlob[id]; });
    var total = todo.length + imageIds.length, done = 0;
    var staged = [], records = [];
    var baseOrder = 0;
    if(!replace) local.photos.forEach(function(p){ if(p.order + 1 > baseOrder) baseOrder = p.order + 1; });

    async function discardStaged(){
      if(!staged.length) return;
      try{
        var tx = db.transaction("blobs", "readwrite");
        staged.forEach(function(id){ tx.objectStore("blobs").delete(id); });
        await C.txDone(tx);
      }catch(e){}
    }

    try{
      for(var i = 0; i < todo.length; i++){
        var p = todo[i];
        var buf = await readEntry(parsed.zip, parsed.zip.entries[p.file], true);
        var sha = await M.sha256(buf);
        if(p.sha256 && sha && sha !== p.sha256) fail("Ảnh " + p.file + " không khớp mã kiểm tra trong bản sao lưu.");
        var thumb = null;
        try{ thumb = await M.thumbFromJpeg(buf); }catch(e){ thumb = null; }
        var id = newId();
        await C.idbPut(db, "blobs", { id: id, gen: activeGen, mime: "image/jpeg", data: buf, thumb: thumb });
        staged.push(id);
        idMap[p.id] = id;
        records.push({ id: id, gen: activeGen, caption: p.caption, takenAt: p.takenAt, addedAt: p.addedAt,
                       order: replace ? i : baseOrder + i, w: p.w, h: p.h, bytes: buf.byteLength, sha256: sha || p.sha256 || null });
        buf = null; thumb = null;
        if(ctx.onProgress) ctx.onProgress(++done, total);
      }
      // Avatars/cover keep fixed ids, so they can't be staged without
      // overwriting the live copy; they are small and go in the final tx.
      var imageBufs = {};
      for(var j = 0; j < imageIds.length; j++){
        imageBufs[imageIds[j]] = await readEntry(parsed.zip, parsed.zip.entries[parsed.images[imageIds[j]]], true);
        if(ctx.onProgress) ctx.onProgress(++done, total);
      }
    }catch(err){
      await discardStaged();
      if(isQuota(err)) fail("Bộ nhớ máy không đủ chỗ để nhập bản sao lưu này. Dữ liệu hiện tại không bị thay đổi.");
      throw err;
    }

    var keepProfile = !replace && local.profileOk;
    var profile;
    if(keepProfile){
      profile = Object.assign({}, local.profile, { activeGen: gens.write });
    } else {
      profile = Object.assign({}, parsed.profile, { activeGen: gens.write, updatedAt: ctx.nowMs });
    }
    var finalHas = {};
    C.PROFILE_BLOB_IDS.forEach(function(id){ finalHas[id] = imageBufs[id] ? true : (!replace && !!local.hasBlob[id]); });
    profile.hasCover = finalHas.cover;
    delete profile.startStatus;
    delete profile.activeGenOk;
    delete profile.rawActiveGen;

    var localMIds = {};
    local.milestones.forEach(function(m){ localMIds[m.id] = true; });
    sameAs.forEach(function(a){ idMap[a[0]] = idMap[a[1]]; });
    var newMilestones = (replace ? parsed.milestones : parsed.milestones.filter(function(m){ return !localMIds[m.id]; })).map(function(m){
      var seen = Object.create(null), ids = [];
      (m.photoIds || []).forEach(function(old){
        var id = idMap[old];
        if(id && !seen[id]){ seen[id] = true; ids.push(id); }
      });
      return Object.assign({}, m, { photoIds: ids });
    });

    var cy = planCycles(parsed, local, replace, ctx.nowMs);
    var wi = planWishes(parsed, local, replace, ctx.nowMs);

    try{
      await finalSwitch(db, {
        replace: replace, staged: staged, records: records, profile: profile,
        milestones: newMilestones, imageBufs: imageBufs, activeGen: activeGen, cycles: cy.record, wishes: wi.record
      });
    }catch(err){
      await discardStaged();
      if(isQuota(err)) fail("Bộ nhớ máy không đủ chỗ để nhập bản sao lưu này. Dữ liệu hiện tại không bị thay đổi.");
      if(err && err.userMessage) throw err;
      fail("Không ghi được dữ liệu vào máy. Dữ liệu hiện tại không bị thay đổi.");
    }
    try{ await C.cleanupGenerations(db, gens.trusted); }catch(e){}
    return { addedPhotos: records.length, skippedPhotos: parsed.photos.length - records.length,
             addedMilestones: newMilestones.length, images: Object.keys(imageBufs).length, profileKept: keepProfile,
             cyclesInFile: !!parsed.cycles, addedCycles: cy.added, skippedCycles: cy.skipped, cyclesKept: cy.kept,
             clashedCycles: parsed.cyclesSkipped || 0,
             wishesInFile: !!parsed.wishes, addedWishes: wi.added, skippedWishes: wi.skipped, overWishes: wi.over, wishesKept: wi.kept,
             clashedWishes: parsed.wishesSkipped || 0 };
  }

  function finalSwitch(db, s){
    return new Promise(function(resolve, reject){
      var tx = db.transaction(["kv", "milestones", "photos", "blobs"], "readwrite");
      var aborted = null;
      tx.oncomplete = function(){ resolve(); };
      tx.onerror = function(){ if(!aborted) aborted = tx.error; };
      tx.onabort = function(){
        var e = aborted && aborted.userMessage ? aborted : (aborted || tx.error || new Error("abort"));
        reject(e);
      };
      var blobs = tx.objectStore("blobs");
      // Another LoveDays window opening meanwhile runs cleanup, which deletes
      // staged (record-less) blobs. Verify they all still exist first.
      var pending = s.staged.length, missing = 0;
      function writeAll(){
        if(missing){
          var e = new Error("missing");
          e.userMessage = "Có cửa sổ LoveDays khác vừa mở trong lúc nhập. Hãy đóng các cửa sổ khác rồi nhập lại. Dữ liệu hiện tại không bị thay đổi.";
          aborted = e;
          tx.abort();
          return;
        }
        var photos = tx.objectStore("photos"), ms = tx.objectStore("milestones");
        if(s.replace){
          photos.clear();
          ms.clear();
          C.PROFILE_BLOB_IDS.forEach(function(id){ if(!s.imageBufs[id]) blobs.delete(id); });
        }
        s.records.forEach(function(r){ photos.put(r); });
        s.milestones.forEach(function(m){ ms.put(m); });
        Object.keys(s.imageBufs).forEach(function(id){
          blobs.put({ id: id, gen: s.activeGen, mime: "image/jpeg", data: s.imageBufs[id], thumb: null });
        });
        tx.objectStore("kv").put(s.profile);
        if(s.cycles) tx.objectStore("kv").put(s.cycles);
        if(s.wishes) tx.objectStore("kv").put(s.wishes);
      }
      if(!pending){ writeAll(); return; }
      s.staged.forEach(function(id){
        var r = blobs.getKey(id);
        r.onsuccess = function(){
          if(r.result === undefined) missing++;
          if(--pending === 0) writeAll();
        };
      });
    });
  }

  function isQuota(e){ return !!e && (e.name === "QuotaExceededError" || e.code === 22); }

  root.LoveBackup = {
    crc32: crc32, readZip: readZip, readEntry: readEntry,
    buildBackup: buildBackup, parseBackup: parseBackup, planMerge: planMerge,
    importBackup: importBackup, isQuota: isQuota
  };
})(self);
