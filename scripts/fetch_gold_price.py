#!/usr/bin/env python3
"""Fetch the current gold ring 9999 (nhẫn tròn trơn) price from BTMC's
public price feed and write it as static JSON that GoldTrack.html reads
same-origin (no CORS).

api.btmc.vn's server does not send its intermediate certificate, so
standard TLS clients (including GitHub Actions runners) fail verification
unless that intermediate is supplied explicitly. We fetch it fresh each
run (via the issuing cert's AIA URL) rather than hardcoding it, since
Sectigo can rotate which intermediate signs the leaf certificate.
"""
import json
import os
import ssl
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone

import certifi

BTMC_URL = "https://api.btmc.vn/api/BTMCAPI/getpricebtmc?key=3kd8ub1llcg9t45hnoh8hmn7t8hzlong"
INTERMEDIATE_AIA_URL = "http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt"
PRODUCT_NAME_MARKER = "NHẪN TRÒN TRƠN"
HISTORY_MAX = 500

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRICE_FILE = os.path.join(ROOT, "data", "gold-price.json")
HISTORY_FILE = os.path.join(ROOT, "data", "gold-price-history.json")


def build_ssl_context():
    """certifi's root bundle, plus BTMC's missing intermediate if fetchable."""
    with open(certifi.where(), "rb") as f:
        bundle = f.read()
    try:
        der = urllib.request.urlopen(INTERMEDIATE_AIA_URL, timeout=10).read()
        pem = ssl.DER_cert_to_PEM_cert(der).encode("ascii")
        bundle += b"\n" + pem
    except Exception as e:
        print("warning: could not fetch intermediate cert, trying without it:", e, file=sys.stderr)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
    tmp.write(bundle)
    tmp.close()
    return ssl.create_default_context(cafile=tmp.name), tmp.name


def fetch_btmc(ctx):
    req = urllib.request.Request(BTMC_URL, headers={"User-Agent": "GoldTrack/1.0"})
    with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def extract_price_row(payload):
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


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def main():
    ctx, ca_path = build_ssl_context()
    try:
        payload = fetch_btmc(ctx)
    finally:
        try:
            os.unlink(ca_path)
        except OSError:
            pass

    item = extract_price_row(payload)
    if not item:
        print("error: could not find the gold ring 9999 price row in BTMC response", file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    price_doc = {
        "buy": item["buy"],
        "sell": item["sell"],
        "unit": "luong",
        "product": item["product"],
        "source": "Bảo Tín Minh Châu (BTMC) — giá vàng nhẫn tròn trơn 9999",
        "sourceUrl": "https://btmc.vn",
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
