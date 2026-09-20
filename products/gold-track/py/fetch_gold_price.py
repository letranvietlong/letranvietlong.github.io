#!/usr/bin/env python3
"""Fetch the current gold 9999 (nhẫn tròn) price from Ngọc Thịnh Jewelry's
price board page and write it as static JSON that GoldTrack reads
same-origin (no CORS).

Ngọc Thịnh is the shop the user actually buys from, so its price is what
matters for accurate lời/lỗ tracking. It has no API; the price table is
server-rendered HTML, so we scrape and regex-parse the one row we need.
Price is already quoted VNĐ/chỉ on the page, matching the unit the whole
app works in.
"""
import json
import os
import re
import ssl
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

import certifi

VN_TZ = timezone(timedelta(hours=7))  # Vietnam has no DST, so a fixed offset is exact and needs no tzdata

NGOCTHINH_URL = "https://ngocthinh-jewelry.vn/pages/bang-gia-vang"
NGOCTHINH_ROW_PATTERN = re.compile(
    r'headerindex1">\s*(?:&nbsp;)?\s*Vàng 9999 \(nhẫn tròn\)\s*(?:&nbsp;)?\s*</div>'
    r'.*?headerindex2">\s*([\d.]+)\s*</div>'
    r'.*?headerindex3">\s*([\d.]+)\s*</div>',
    re.DOTALL,
)

HISTORY_MAX = 500

PRODUCT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRICE_FILE = os.path.join(PRODUCT_ROOT, "data", "gold-price.json")
HISTORY_FILE = os.path.join(PRODUCT_ROOT, "data", "gold-price-history.json")


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

    return {"buy": buy, "sell": sell}


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def main():
    try:
        item = fetch_ngocthinh()
    except Exception as e:
        print("error: %s" % e, file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    price_doc = {
        "buy": item["buy"],
        "sell": item["sell"],
        "unit": "chi",
        "sourceUrl": NGOCTHINH_URL,
        "fetchedAt": now,
    }

    os.makedirs(os.path.dirname(PRICE_FILE), exist_ok=True)
    with open(PRICE_FILE, "w", encoding="utf-8") as f:
        json.dump(price_doc, f, ensure_ascii=False, indent=2)
        f.write("\n")

    history = load_json(HISTORY_FILE, [])
    if not isinstance(history, list):
        history = []

    # Only record a history point when the price actually moved or a new
    # Vietnam-local day started; otherwise every 30-minute run would add a
    # duplicate that makes the trend chart and "vs previous" comparison
    # meaningless. gold-price.json's fetchedAt still updates on every run so
    # the app can tell how fresh the last check was.
    last = history[-1] if history else None
    changed = (not last) or last.get("buy") != item["buy"] or last.get("sell") != item["sell"]
    new_day = (not last) or vn_day(last.get("at", "")) != vn_day(now)
    appended = False
    if changed or new_day:
        history.append({"buy": item["buy"], "sell": item["sell"], "at": now})
        history = history[-HISTORY_MAX:]
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
            f.write("\n")
        appended = True

    print("OK: buy=%d sell=%d fetchedAt=%s history=%s" % (
        item["buy"], item["sell"], now, "appended" if appended else "unchanged"))
    return 0


def vn_day(iso):
    """Calendar date in Vietnam for an ISO timestamp (any offset)."""
    try:
        return datetime.fromisoformat(iso).astimezone(VN_TZ).date()
    except (ValueError, TypeError):
        return None


if __name__ == "__main__":
    sys.exit(main())
