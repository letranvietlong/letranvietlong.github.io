#!/usr/bin/env python3
"""Fetch the current gold 9999 (ring) price and write it as static JSON
that GoldTrack.html reads same-origin (no CORS).

Primary source: Ngọc Thịnh Jewelry's own price board page — this is the
actual shop the user buys from, so its price is what matters for accurate
lời/lỗ tracking. It has no API; the price table is server-rendered HTML,
so we scrape and regex-parse the one row we need.

Fallback source: BTMC's public price API, used only if Ngọc Thịnh's page
is unreachable or its markup changes and breaks the parse, so the app
doesn't go stale on a temporary hiccup. api.btmc.vn's server also omits
its intermediate TLS certificate, which breaks standard HTTPS clients
(including GitHub Actions runners) unless that intermediate is supplied
explicitly — fetched fresh each run via the leaf cert's AIA URL rather
than hardcoded, since Sectigo can rotate which intermediate signs it.

Both sources are normalized to VNĐ per chỉ before writing, since that's
the unit the whole app works in.
"""
import json
import os
import re
import ssl
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone

import certifi

NGOCTHINH_URL = "https://ngocthinh-jewelry.vn/pages/bang-gia-vang"
NGOCTHINH_ROW_PATTERN = re.compile(
    r'headerindex1">\s*(?:&nbsp;)?\s*Vàng 9999 \(nhẫn tròn\)\s*(?:&nbsp;)?\s*</div>'
    r'.*?headerindex2">\s*([\d.]+)\s*</div>'
    r'.*?headerindex3">\s*([\d.]+)\s*</div>',
    re.DOTALL,
)

BTMC_URL = "https://api.btmc.vn/api/BTMCAPI/getpricebtmc?key=3kd8ub1llcg9t45hnoh8hmn7t8hzlong"
INTERMEDIATE_AIA_URL = "http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt"
PRODUCT_NAME_MARKER = "NHẪN TRÒN TRƠN"

HISTORY_MAX = 500

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRICE_FILE = os.path.join(ROOT, "data", "gold-price.json")
HISTORY_FILE = os.path.join(ROOT, "data", "gold-price-history.json")


def fetch_ngocthinh():
    ctx = ssl.create_default_context(cafile=certifi.where())
    req = urllib.request.Request(NGOCTHINH_URL, headers={"User-Agent": "Mozilla/5.0 (compatible; GoldTrack/1.0)"})
    with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
        html = resp.read().decode("utf-8")

    match = NGOCTHINH_ROW_PATTERN.search(html)
    if not match:
        raise RuntimeError("could not find the 'Vàng 9999 (nhẫn tròn)' row on Ngọc Thịnh's price page")

    buy = int(match.group(1).replace(".", ""))
    sell = int(match.group(2).replace(".", ""))
    if buy <= 0 or sell <= 0:
        raise RuntimeError("parsed non-positive price from Ngọc Thịnh's price page")

    return {
        "buy": buy,
        "sell": sell,
        "product": "Vàng 9999 (nhẫn tròn)",
        "source": "Ngọc Thịnh Jewelry — giá vàng 9999 (nhẫn tròn)",
        "sourceUrl": NGOCTHINH_URL,
    }


def build_btmc_ssl_context():
    """certifi's root bundle, plus BTMC's missing intermediate if fetchable."""
    with open(certifi.where(), "rb") as f:
        bundle = f.read()
    try:
        der = urllib.request.urlopen(INTERMEDIATE_AIA_URL, timeout=10).read()
        pem = ssl.DER_cert_to_PEM_cert(der).encode("ascii")
        bundle += b"\n" + pem
    except Exception as e:
        print("warning: could not fetch BTMC intermediate cert, trying without it:", e, file=sys.stderr)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
    tmp.write(bundle)
    tmp.close()
    return ssl.create_default_context(cafile=tmp.name), tmp.name


def extract_btmc_row(payload):
    rows = payload.get("DataList", {}).get("Data", [])
    for row in rows:
        for key, name in row.items():
            if not key.startswith("@n_"):
                continue
            if PRODUCT_NAME_MARKER not in name.upper():
                continue
            idx = key.split("_", 1)[1]
            buy = row.get("@pb_" + idx)
            sell = row.get("@ps_" + idx)
            if buy is None or sell is None:
                continue
            buy, sell = int(buy), int(sell)
            if buy <= 0 or sell <= 0:
                continue
            return {"buy": buy, "sell": sell, "product": name}
    return None


def fetch_btmc():
    ctx, ca_path = build_btmc_ssl_context()
    try:
        req = urllib.request.Request(BTMC_URL, headers={"User-Agent": "GoldTrack/1.0"})
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    finally:
        try:
            os.unlink(ca_path)
        except OSError:
            pass

    item = extract_btmc_row(payload)
    if not item:
        raise RuntimeError("could not find the gold ring 9999 price row in BTMC response")

    # BTMC's raw numbers land in the same range as Ngọc Thịnh's explicit VNĐ/chỉ
    # price for the same product (confirmed by cross-checking both sources on
    # the same day), so no /10 conversion here — despite BTMC's own site
    # presenting it as if it were a per-lượng price.
    return {
        "buy": item["buy"],
        "sell": item["sell"],
        "product": item["product"],
        "source": "Bảo Tín Minh Châu (BTMC) — giá vàng nhẫn tròn trơn 9999 (dự phòng)",
        "sourceUrl": "https://btmc.vn",
    }


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def main():
    item = None
    errors = []
    for fetch in (fetch_ngocthinh, fetch_btmc):
        try:
            item = fetch()
            break
        except Exception as e:
            errors.append("%s: %s" % (fetch.__name__, e))

    if not item:
        print("error: all sources failed:\n  " + "\n  ".join(errors), file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    price_doc = {
        "buy": item["buy"],
        "sell": item["sell"],
        "unit": "chi",
        "product": item["product"],
        "source": item["source"],
        "sourceUrl": item["sourceUrl"],
        "fetchedAt": now,
    }

    os.makedirs(os.path.dirname(PRICE_FILE), exist_ok=True)
    with open(PRICE_FILE, "w", encoding="utf-8") as f:
        json.dump(price_doc, f, ensure_ascii=False, indent=2)
        f.write("\n")

    history = load_json(HISTORY_FILE, [])
    if not isinstance(history, list):
        history = []
    history.append({"buy": item["buy"], "sell": item["sell"], "at": now})
    history = history[-HISTORY_MAX:]
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("OK: buy=%d sell=%d fetchedAt=%s" % (item["buy"], item["sell"], now))
    return 0


if __name__ == "__main__":
    sys.exit(main())
