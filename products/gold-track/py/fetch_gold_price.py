#!/usr/bin/env python3
"""Fetch current gold prices from two shops — Ngọc Thịnh Jewelry and Huy
Thanh Jewelry — each offering several gold types, and write them as static
JSON that GoldTrack reads same-origin (no CORS).

Ngọc Thịnh has no API; its price table is server-rendered HTML, so we
scrape and regex-parse each row we need. Huy Thanh is a Next.js site that
embeds its price data as an escaped JSON blob inside a React Server
Components script chunk, so instead of scraping the visible table we
regex-match that embedded blob directly (no full-DOM/full-JSON parse
needed). Prices are already quoted VNĐ/chỉ on both pages, matching the
unit the whole app works in.
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

USER_AGENT = "Mozilla/5.0 (compatible; GoldTrack/1.0)"

NGOCTHINH_URL = "https://ngocthinh-jewelry.vn/pages/bang-gia-vang"
# Ngọc Thịnh's page publishes several gold rows, but the user only wants
# this shop tracked for "Vàng 9999 (nhẫn tròn)" — it's also the historical
# default type id, relied on elsewhere in the app.
NGOCTHINH_TYPES = [
    ("9999-nhan-tron", "Vàng 9999 (nhẫn tròn)"),
]

HUYTHANH_URL = "https://huythanhjewelry.vn/gia-vang-hom-nay"
# loaivang code -> (type id, label). Huy Thanh's page publishes several rows
# (22K/18K/14K/10K nguyên liệu, plus a "24KTT" market-reference row with no
# real sell price), but the user only wants this shop tracked for its own
# "Vàng Huy Thanh 24k" quote.
HUYTHANH_TYPES = {
    "24K": ("24k-huy-thanh", "Vàng Huy Thanh 24k"),
}
# Matches each price entry directly in the raw backslash-escaped JSON blob
# embedded in the page's __next_f RSC script chunk, without reconstructing
# and json.loads()-ing the whole escaped string (fragile).
HUYTHANH_ROW_PATTERN = re.compile(
    r'\\"giaban\\":(\d+),\\"giamua\\":(\d+),\\"loaivang\\":\\"([^"\\]+)\\"'
)

HISTORY_MAX = 500

PRODUCT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRICE_FILE = os.path.join(PRODUCT_ROOT, "data", "gold-price.json")
HISTORY_FILE = os.path.join(PRODUCT_ROOT, "data", "gold-price-history.json")


def fetch_html(url):
    ctx = ssl.create_default_context(cafile=certifi.where())
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
        return resp.read().decode("utf-8")


def fetch_ngocthinh():
    html = fetch_html(NGOCTHINH_URL)

    types = {}
    for type_id, label in NGOCTHINH_TYPES:
        pattern = re.compile(
            r'headerindex1">\s*(?:&nbsp;)?\s*' + re.escape(label) + r'\s*(?:&nbsp;)?\s*</div>'
            r'.*?headerindex2">\s*([\d.]+)\s*</div>'
            r'.*?headerindex3">\s*([\d.]+)\s*</div>',
            re.DOTALL,
        )
        match = pattern.search(html)
        if not match:
            print("warning: Ngọc Thịnh row not found for %r, skipping" % label, file=sys.stderr)
            continue

        buy = int(match.group(1).replace(".", ""))
        sell = int(match.group(2).replace(".", ""))
        if buy <= 0 or sell <= 0:
            print("warning: Ngọc Thịnh row %r parsed non-positive price, skipping" % label, file=sys.stderr)
            continue

        types[type_id] = {"label": label, "buy": buy, "sell": sell}

    if not types:
        raise RuntimeError("could not find any gold rows on Ngọc Thịnh's price page")
    return types


def fetch_huythanh():
    html = fetch_html(HUYTHANH_URL)

    types = {}
    for match in HUYTHANH_ROW_PATTERN.finditer(html):
        giaban_str, giamua_str, loaivang = match.groups()
        giaban = int(giaban_str)  # giá bán ra của tiệm -> this app's "sell"
        giamua = int(giamua_str)  # giá tiệm mua vào -> this app's "buy"

        if giaban == 0:
            continue  # "24KTT" market-reference row, not a tradeable quote

        mapped = HUYTHANH_TYPES.get(loaivang)
        if not mapped:
            print("warning: unrecognized Huy Thanh loaivang %r, skipping" % loaivang, file=sys.stderr)
            continue

        type_id, label = mapped
        types[type_id] = {"label": label, "buy": giamua, "sell": giaban}

    if not types:
        raise RuntimeError("could not find any gold rows on Huy Thanh's price page")
    return types


SHOPS = [
    ("ngoc-thinh", "Ngọc Thịnh Jewelry", NGOCTHINH_URL, fetch_ngocthinh),
    ("huy-thanh", "Huy Thanh Jewelry", HUYTHANH_URL, fetch_huythanh),
]


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def vn_day(iso):
    """Calendar date in Vietnam for an ISO timestamp (any offset)."""
    try:
        return datetime.fromisoformat(iso).astimezone(VN_TZ).date()
    except (ValueError, TypeError):
        return None


def load_price_doc():
    doc = load_json(PRICE_FILE, {})
    # Old shape was a flat {buy,sell,unit,sourceUrl,fetchedAt} snapshot with
    # no per-shop "types" structure. It's just a snapshot (fully overwritten
    # every run anyway), so there's nothing worth migrating — start fresh.
    if not isinstance(doc, dict) or not any(
        isinstance(v, dict) and "types" in v for v in doc.values()
    ):
        return {}
    return doc


def load_history():
    history = load_json(HISTORY_FILE, {})
    # Old shape was a flat array of Ngọc Thịnh 9999 points. Self-heal into
    # the new shop -> type -> array shape so real historical data collected
    # under the old shape is never silently dropped. Idempotent: once
    # migrated, the loaded value is already a dict and this is a no-op.
    if isinstance(history, list):
        return {"ngoc-thinh": {"9999-nhan-tron": history}} if history else {}
    if not isinstance(history, dict):
        return {}
    return history


def append_history(history, shop_id, type_id, item, now):
    """Append a history point for (shop_id, type_id) only when the price
    actually moved or a new Vietnam-local day started; otherwise every
    30-minute run would add a duplicate that makes the trend chart and "vs
    previous" comparison meaningless. Returns True if a point was appended."""
    arr = history.setdefault(shop_id, {}).setdefault(type_id, [])
    last = arr[-1] if arr else None
    changed = (not last) or last.get("buy") != item["buy"] or last.get("sell") != item["sell"]
    new_day = (not last) or vn_day(last.get("at", "")) != vn_day(now)
    if not (changed or new_day):
        return False
    arr.append({"buy": item["buy"], "sell": item["sell"], "at": now})
    del arr[:-HISTORY_MAX]
    return True


def main():
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    price_doc = load_price_doc()
    history = load_history()

    ok_shops = 0
    any_appended = False
    for shop_id, shop_name, source_url, fetch_fn in SHOPS:
        try:
            types = fetch_fn()
        except Exception as e:
            # One shop's page changing/going down must not block the other
            # shop from updating, nor drop that shop's last-known-good data.
            print("error: %s fetch failed: %s" % (shop_id, e), file=sys.stderr)
            continue

        price_doc[shop_id] = {
            "name": shop_name,
            "sourceUrl": source_url,
            "fetchedAt": now,
            "unit": "chi",
            "types": types,
        }

        appended_types = [
            type_id for type_id, item in types.items()
            if append_history(history, shop_id, type_id, item, now)
        ]
        any_appended = any_appended or bool(appended_types)

        ok_shops += 1
        print("OK %s: %s" % (shop_id, ", ".join(
            "%s buy=%d sell=%d" % (tid, t["buy"], t["sell"]) for tid, t in types.items()
        )))
        print("  history appended: %s" % (", ".join(appended_types) if appended_types else "(none, unchanged)"))

    if ok_shops == 0:
        print("error: both shops failed to fetch", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(PRICE_FILE), exist_ok=True)
    with open(PRICE_FILE, "w", encoding="utf-8") as f:
        json.dump(price_doc, f, ensure_ascii=False, indent=2)
        f.write("\n")

    if any_appended:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
            f.write("\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
