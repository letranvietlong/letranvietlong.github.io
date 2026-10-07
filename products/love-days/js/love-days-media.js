// Image decode + compression. A 48MP iPhone photo decodes to ~195MB, so jobs
// run strictly one at a time and every bitmap/canvas is released right after.
(function(root){
  "use strict";

  var queue = Promise.resolve();
  function enqueue(job){
    var run = queue.then(job, job);
    queue = run.catch(function(){});
    return run;
  }

  // Relies on the browser's own EXIF auto-orientation (default in iOS 13.4+
  // and Chromium for both createImageBitmap 'from-image' and <img>).
  function decode(file){
    if(typeof createImageBitmap === "function"){
      return createImageBitmap(file, { imageOrientation: "from-image" }).then(function(bmp){
        return { source: bmp, w: bmp.width, h: bmp.height, release: function(){ try{ bmp.close(); }catch(e){} } };
      }, function(){ return decodeWithImg(file); });
    }
    return decodeWithImg(file);
  }

  function decodeWithImg(file){
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.src = url;
    var ready = img.decode ? img.decode() : new Promise(function(res, rej){ img.onload = res; img.onerror = rej; });
    return ready.then(function(){
      return { source: img, w: img.naturalWidth, h: img.naturalHeight,
               release: function(){ URL.revokeObjectURL(url); img.src = ""; } };
    }, function(err){
      URL.revokeObjectURL(url);
      throw err;
    });
  }

  function canvasToBuffer(canvas, quality){
    return new Promise(function(resolve, reject){
      canvas.toBlob(function(blob){
        if(!blob){ reject(new Error("encode")); return; }
        blob.arrayBuffer().then(resolve, reject);
      }, "image/jpeg", quality);
    });
  }

  // opts: { square: px } → center-crop square; or { maxEdge: px } → fit long edge.
  function compress(file, opts){
    return enqueue(function(){
      return decode(file).then(function(img){
        var sx = 0, sy = 0, sw = img.w, sh = img.h, dw, dh;
        if(opts.square){
          var side = Math.min(img.w, img.h);
          sx = Math.round((img.w - side) / 2); sy = Math.round((img.h - side) / 2);
          sw = sh = side;
          dw = dh = Math.min(opts.square, side);
        } else {
          var scale = Math.min(1, opts.maxEdge / Math.max(img.w, img.h));
          dw = Math.max(1, Math.round(img.w * scale)); dh = Math.max(1, Math.round(img.h * scale));
        }
        var canvas = document.createElement("canvas");
        canvas.width = dw; canvas.height = dh;
        var ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img.source, sx, sy, sw, sh, 0, 0, dw, dh);
        img.release();
        return canvasToBuffer(canvas, opts.quality).then(function(buf){
          canvas.width = 0; canvas.height = 0;
          return { data: buf, w: dw, h: dh, mime: "image/jpeg", bytes: buf.byteLength };
        }, function(err){
          canvas.width = 0; canvas.height = 0;
          throw err;
        });
      });
    });
  }

  function fitSize(w, h, maxEdge){
    var scale = Math.min(1, maxEdge / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
  }

  // Album photo: one decode → 1600px JPEG 0.82 + 480px thumbnail 0.75 (drawn
  // from the 1600px canvas so the full-size bitmap is released first).
  // takenAt comes from the ORIGINAL bytes: the canvas re-encode drops EXIF.
  function compressAlbum(file){
    return readExifDate(file).then(function(takenAt){
      return enqueue(function(){
        return decode(file).then(function(img){
          var main = fitSize(img.w, img.h, 1600);
          var canvas = document.createElement("canvas");
          canvas.width = main.w; canvas.height = main.h;
          var ctx = canvas.getContext("2d");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img.source, 0, 0, main.w, main.h);
          img.release();
          var tsz = fitSize(main.w, main.h, 480);
          var tcanvas = document.createElement("canvas");
          function release(){ canvas.width = 0; canvas.height = 0; tcanvas.width = 0; tcanvas.height = 0; }
          return canvasToBuffer(canvas, 0.82).then(function(data){
            tcanvas.width = tsz.w; tcanvas.height = tsz.h;
            var tctx = tcanvas.getContext("2d");
            tctx.imageSmoothingQuality = "high";
            tctx.drawImage(canvas, 0, 0, tsz.w, tsz.h);
            return canvasToBuffer(tcanvas, 0.75).then(function(thumb){
              release();
              return sha256(data).then(function(sha){
                return { data: data, thumb: thumb, w: main.w, h: main.h, mime: "image/jpeg",
                         bytes: data.byteLength, sha256: sha, takenAt: takenAt };
              });
            });
          }).catch(function(err){ release(); throw err; });
        });
      });
    });
  }

  function thumbFromJpeg(buf){
    return compress(new Blob([buf], { type: "image/jpeg" }), { maxEdge: 480, quality: 0.75 }).then(function(r){ return r.data; });
  }

  function sha256(buf){
    try{
      if(!root.crypto || !root.crypto.subtle) return Promise.resolve(null);
      return root.crypto.subtle.digest("SHA-256", buf).then(function(d){
        var u8 = new Uint8Array(d), out = "";
        for(var i = 0; i < u8.length; i++) out += (u8[i] < 16 ? "0" : "") + u8[i].toString(16);
        return out;
      }, function(){ return null; });
    }catch(e){ return Promise.resolve(null); }
  }

  // ---------- EXIF DateTimeOriginal ----------
  // Only the first 256KB is read: APP1 (≤64KB) sits right after SOI/APP0.
  function readExifDate(file){
    try{
      return file.slice(0, 262144).arrayBuffer().then(parseExifDate, function(){ return null; });
    }catch(e){ return Promise.resolve(null); }
  }

  // EXIF times are the camera's wall clock. OffsetTimeOriginal (iPhone writes
  // it) gives the zone; without it the time is taken as Vietnam time (+07).
  function parseExifDate(buf){
    try{
      var v = new DataView(buf), len = buf.byteLength, off = 2;
      if(len < 4 || v.getUint16(0) !== 0xFFD8) return null;
      while(off + 4 <= len){
        if(v.getUint8(off) !== 0xFF) return null;
        var marker = v.getUint8(off + 1);
        if(marker === 0xFF){ off++; continue; }
        if(marker === 0xD9 || marker === 0xDA) return null;
        if((marker >= 0xD0 && marker <= 0xD7) || marker === 0x01){ off += 2; continue; }
        var segLen = v.getUint16(off + 2);
        if(segLen < 2) return null;
        if(marker === 0xE1 && off + 10 <= len && v.getUint32(off + 4) === 0x45786966 && v.getUint16(off + 8) === 0){
          return parseTiffDate(v, off + 10, Math.min(len, off + 2 + segLen));
        }
        off += 2 + segLen;
      }
    }catch(e){}
    return null;
  }

  function parseTiffDate(v, t, end){
    var bo = v.getUint16(t), le = bo === 0x4949;
    if(!le && bo !== 0x4D4D) return null;
    function u16(o){ if(o + 2 > end) throw new RangeError(); return v.getUint16(o, le); }
    function u32(o){ if(o + 4 > end) throw new RangeError(); return v.getUint32(o, le); }
    if(u16(t + 2) !== 42) return null;
    function findTag(ifd, tag){
      var n = u16(ifd);
      for(var i = 0; i < n; i++){
        var e = ifd + 2 + i * 12;
        if(u16(e) === tag) return { type: u16(e + 2), count: u32(e + 4), at: e + 8 };
      }
      return null;
    }
    function ascii(entry){
      if(!entry || entry.type !== 2) return null;
      var at = entry.count > 4 ? t + u32(entry.at) : entry.at, s = "";
      for(var i = 0; i < entry.count && i < 64; i++){
        if(at + i >= end) return null;
        var c = v.getUint8(at + i);
        if(!c) break;
        s += String.fromCharCode(c);
      }
      return s;
    }
    var exifPtr = findTag(t + u32(t + 4), 0x8769);
    if(!exifPtr) return null;
    var exifIfd = t + u32(exifPtr.at);
    var dto = ascii(findTag(exifIfd, 0x9003));
    var m = dto && /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(dto);
    if(!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5], s = +m[6];
    if(y < 1970 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return null;
    var offMs = 7 * 3600000;
    var ot = ascii(findTag(exifIfd, 0x9011));
    var om = ot && /^([+-])(\d{2}):(\d{2})$/.exec(ot);
    if(om) offMs = (om[1] === "-" ? -1 : 1) * (+om[2] * 3600000 + +om[3] * 60000);
    return Date.UTC(y, mo - 1, d, h, mi, s) - offMs;
  }

  root.LoveMedia = {
    compressAvatar: function(file){ return compress(file, { square: 512, quality: 0.85 }); },
    compressCover: function(file){ return compress(file, { maxEdge: 1600, quality: 0.82 }); },
    compressAlbum: compressAlbum,
    thumbFromJpeg: thumbFromJpeg,
    sha256: sha256,
    parseExifDate: parseExifDate,
    compress: compress
  };
})(self);
