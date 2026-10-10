#!/usr/bin/env python3
"""Fetch PVOIL retail fuel prices (Đà Nẵng = Vùng 1) and write them as static
JSON that FuelTrack reads same-origin (no CORS).

pvoil.com.vn sits behind a Cloudflare challenge that blocks every non-browser
client (and even a real headful Chromium), so the data comes from
giaxanghomnay.com's JSON API instead, which republishes PVOIL's daily list.
Since 2026-10 that "PVOIL" feed is itself a copy of Petrolimex Vùng 1 (rows
flagged is_reference) under Petrolimex's "Mức" product names, and it has no KO
row — KO comes from Petrolimex's zone1_price. Anything not a genuine PVOIL row
is tagged with source "petrolimex-v1" for the UI to disclose.

The source renames apply retroactively to every past date, so never rebuild
history from scratch: periods recorded under the old feed (e.g. ron95-iii)
would be lost.

History stores only change points (a new entry whenever the set of prices
differs from the previous entry); the UI forward-fills them per day.

Usage:
  python fetch_fuel_price.py                         # today (falls back to yesterday)
  python fetch_fuel_price.py --backfill-from 2025-09-01
"""
import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone

import certifi

VN_TZ = timezone(timedelta(hours=7))  # Vietnam has no DST, so a fixed offset is exact and needs no tzdata

USER_AGENT = "Mozilla/5.0 (compatible; FuelTrack/1.0)"
API = "https://giaxanghomnay.com/api/pvdate/%s"

ITEMS = [
    ("e10-ron95-iii", "Xăng E10 RON 95-III"),
    ("e5-ron92-ii", "Xăng E5 RON 92-II"),
    ("ron95-iii", "Xăng RON 95-III"),
    ("do-005s-ii", "Dầu DO 0,05S-II"),
    ("ko", "Dầu hỏa (KO)"),
]
ITEM_LABELS = dict(ITEMS)
ITEM_ORDER = [i for i, _ in ITEMS]

# Exact titles only, no fuzzy matching: "Mức 3" and "Mức 5" are different
# products one character apart.
PV_TITLES = {
    "Xăng E10 RON 95-III": "e10-ron95-iii",
    "Xăng E10 RON 95 Mức 3": "e10-ron95-iii",
    "Xăng E5 RON 92-II": "e5-ron92-ii",
    "Xăng E5 RON 92 Mức 2": "e5-ron92-ii",
    "Xăng RON 95-III": "ron95-iii",
    "Xăng RON 95 Mức 3": "ron95-iii",
    "Dầu DO 0,05S-II": "do-005s-ii",
    "Dầu DO 0,05S Mức 2": "do-005s-ii",
    "Dầu KO": "ko",
    "Dầu hỏa 2-K": "ko",
}
PV_IGNORED = {
    "Dầu DO 0,001S-V",
    "Dầu DO 0,001S Mức 5",
    "Xăng E10 RON 95 Mức 5",
    "Xăng RON 95 Mức 5",
}
# Only used when the PVOIL feed lacks the item. DO 0,001S is deliberately
# absent: Petrolimex's price for it did not match PVOIL's.
PLX_FALLBACK = {
    "Xăng E10 RON 95-III": "e10-ron95-iii",
    "Xăng E10 RON 95 Mức 3": "e10-ron95-iii",
    "Dầu hỏa 2-K": "ko",
}
REQUIRED = ("e5-ron92-ii", "do-005s-ii")
# Items no longer listed by the source: not carried forward when missing.
RETIRED = {"ron95-iii"}

# No per-change amplitude cap: KO really did jump 19.460 -> 35.380 once.
PRICE_MIN, PRICE_MAX = 5000, 100000

BACKFILL_SLEEP = 2.0
RETRY_BACKOFF = (5, 10, 20, 40)

PRODUCT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRICE_FILE = os.path.join(PRODUCT_ROOT, "data", "fuel-price.json")
HISTORY_FILE = os.path.join(PRODUCT_ROOT, "data", "fuel-price-history.json")


def norm_title(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def fetch_day(day, backoff):
    """GET the API for one date. Retries on network errors / 429 / 5xx with
    the given backoff schedule; raises the last error when exhausted."""
    ctx = ssl.create_default_context(cafile=certifi.where())
    req = urllib.request.Request(
        API % day.isoformat(),
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    attempt = 0
    while True:
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500:
                raise
            err = e
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            err = e
        if attempt >= len(backoff):
            raise err
        wait = backoff[attempt]
        attempt += 1
        print("  retry %d for %s in %ds (%s)" % (attempt, day, wait, err), file=sys.stderr)
        time.sleep(wait)


def warn(msg):
    print("warning: " + msg, file=sys.stderr)
    print("::warning::" + msg)


def valid_price(v):
    return isinstance(v, int) and not isinstance(v, bool) and PRICE_MIN <= v <= PRICE_MAX


def parse_day(payload):
    """-> (date_str, prices, source_updated_at, sources) or None when the day
    has no usable PVOIL record. sources only lists non-PVOIL items (including
    PVOIL-feed rows the source flags as Petrolimex reference copies)."""
    if not isinstance(payload, list) or len(payload) < 2:
        return None
    pv = payload[1] if isinstance(payload[1], list) else []
    plx = payload[0] if isinstance(payload[0], list) else []
    if not pv:
        return None

    prices, sources = {}, {}
    date_str, updated = None, None
    for row in pv:
        if not isinstance(row, dict):
            continue
        title = norm_title(row.get("title"))
        item_id = PV_TITLES.get(title)
        if not item_id:
            if title not in PV_IGNORED:
                warn("unknown PVOIL title %r, skipping" % title)
            continue
        price = row.get("price")
        if not valid_price(price):
            warn("%s has implausible price %r, skipping" % (item_id, price))
            continue
        prices[item_id] = price
        if row.get("is_reference"):
            sources[item_id] = "petrolimex-v1"
        date_str = date_str or str(row.get("date", ""))[:10]
        upd = row.get("updated_at")
        if upd and (updated is None or upd > updated):
            updated = upd

    for row in plx:
        if not isinstance(row, dict):
            continue
        item_id = PLX_FALLBACK.get(norm_title(row.get("title")))
        if not item_id or item_id in prices:
            continue
        price = row.get("zone1_price")
        if valid_price(price):
            prices[item_id] = price
            sources[item_id] = "petrolimex-v1"

    if not date_str or not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return None
    if any(r not in prices for r in REQUIRED):
        print("warning: %s missing required items, skipping" % date_str, file=sys.stderr)
        return None
    if updated:
        updated = re.sub(r"\.\d+Z$", "Z", updated)
    ordered = {k: prices[k] for k in ITEM_ORDER if k in prices}
    return date_str, ordered, updated, sources


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def load_history():
    h = load_json(HISTORY_FILE, {})
    if not isinstance(h, dict) or not isinstance(h.get("changes"), list):
        h = {"changes": []}
    return {"items": dict(ITEMS), "changes": h["changes"]}


REVERT_WINDOW_DAYS = 3


def _days_between(a, b):
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def same_state(entry, prices):
    return entry.get("prices") == prices


def set_sources(entry, sources):
    """Relabel an entry's sources in place. Returns True if it changed. A
    source-label change alone must not open a new period: nothing changed at
    the pump."""
    if (entry.get("sources") or {}) == (sources or {}):
        return False
    if sources:
        entry["sources"] = sources
    else:
        entry.pop("sources", None)
    return True


def carry_forward(history, prices, sources):
    """Fill items missing from today's response with their last recorded price
    and source, so a renamed or dropped row never makes a product vanish from
    the page. Mutates prices/sources; returns them reordered."""
    for item_id in ITEM_ORDER:
        if item_id in prices or item_id in RETIRED:
            continue
        for entry in reversed(history["changes"]):
            if item_id in entry.get("prices", {}):
                prices[item_id] = entry["prices"][item_id]
                src = (entry.get("sources") or {}).get(item_id)
                if src:
                    sources[item_id] = src
                warn("carry forward %s=%d from %s (missing from source)"
                     % (item_id, prices[item_id], entry["date"]))
                break
    ordered = {k: prices[k] for k in ITEM_ORDER if k in prices}
    return ordered, sources


def apply_observation(history, date_str, prices, src_upd, sources):
    """Record one day's observation. Returns True if history changed."""
    changes = history["changes"]
    last = changes[-1] if changes else None
    if last and date_str < last["date"]:
        print("warning: %s is older than last change %s, ignoring" % (date_str, last["date"]), file=sys.stderr)
        return False
    if last and same_state(last, prices):
        return set_sources(last, sources)
    # The source occasionally serves a bad record for a day or two — a stale
    # price set from an earlier period (seen 2025-10-25, 2025-12-26) or a row
    # missing — then snaps back. Official adjustments are at least a week
    # apart, so an entry that both appeared within a few days of the one before
    # it AND is now reverted within a few days was a blip: drop it instead of
    # recording the snap-back. (Checking only the revert side would misfire on
    # a stale record arriving two days after a real Thursday change — it would
    # drop the real change.)
    if (len(changes) >= 2 and date_str != last["date"]
            and same_state(changes[-2], prices)
            and _days_between(changes[-2]["date"], last["date"]) <= REVERT_WINDOW_DAYS
            and _days_between(last["date"], date_str) <= REVERT_WINDOW_DAYS):
        print("warning: %s reverted to the %s state, dropping %s as a source glitch"
              % (date_str, changes[-2]["date"], last["date"]), file=sys.stderr)
        changes.pop()
        return True

    entry = {"date": date_str, "detectedAt": src_upd, "prices": prices}
    if sources:
        entry["sources"] = sources

    if last and date_str == last["date"]:
        # Same-day correction (the source overwrites the day's record when an
        # adjustment takes effect mid-day): keep one entry per date.
        changes.pop()
        prev = changes[-1] if changes else None
        if prev and same_state(prev, prices):
            set_sources(prev, sources)
            return True
    changes.append(entry)
    return True


def build_price_doc(history):
    changes = history["changes"]
    if not changes:
        return None
    last = changes[-1]
    prev = changes[-2] if len(changes) > 1 else None
    srcs = last.get("sources") or {}
    items = []
    for item_id in ITEM_ORDER:
        if item_id not in last["prices"]:
            continue
        price = last["prices"][item_id]
        prev_price = prev["prices"].get(item_id) if prev else None
        items.append({
            "id": item_id,
            "label": ITEM_LABELS[item_id],
            "price": price,
            "prevPrice": prev_price,
            "change": (price - prev_price) if prev_price is not None else None,
            "source": srcs.get(item_id, "pvoil"),
        })
    return {
        "brand": "PVOIL",
        "region": "Đà Nẵng",
        "zone": "Vùng 1",
        "unit": "đ/lít",
        "sourceName": "giaxanghomnay.com (dữ liệu PVOIL)",
        "sourceUrl": "https://giaxanghomnay.com/",
        "officialUrl": "https://www.pvoil.com.vn/tin-gia-xang-dau",
        "effectiveDate": last["date"],
        "detectedAt": last.get("detectedAt"),
        "items": items,
    }


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"


def write_if_changed(path, obj):
    text = dump(obj)
    try:
        with open(path, "r", encoding="utf-8") as f:
            if f.read() == text:
                return False
    except OSError:
        pass
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    return True


def save(history, history_changed):
    wrote = []
    if history_changed or not os.path.exists(HISTORY_FILE):
        if write_if_changed(HISTORY_FILE, history):
            wrote.append("history")
    doc = build_price_doc(history)
    if doc and write_if_changed(PRICE_FILE, doc):
        wrote.append("price")
    print("files written: %s" % (", ".join(wrote) if wrote else "(none, unchanged)"))


def vn_today():
    return datetime.now(VN_TZ).date()


def run_today():
    history = load_history()
    today = vn_today()
    parsed = None
    errors = 0
    for day in (today, today - timedelta(days=1)):
        try:
            parsed = parse_day(fetch_day(day, RETRY_BACKOFF[:2]))
        except Exception as e:
            # A failed request for one date must not stop the fallback to the
            # other: the source has returned errors for "today" while
            # yesterday's record (same prices between adjustments) still loads.
            errors += 1
            print("error: fetch %s failed: %s" % (day, e), file=sys.stderr)
            continue
        if parsed:
            break
        print("no PVOIL record for %s" % day)
    if not parsed:
        print("error: no usable PVOIL data for today or yesterday (%d request error(s))" % errors, file=sys.stderr)
        return 1

    date_str, prices, upd, sources = parsed
    prices, sources = carry_forward(history, prices, sources)
    changed = apply_observation(history, date_str, prices, upd, sources)
    print("OK %s: %s" % (date_str, ", ".join("%s=%d" % kv for kv in prices.items())))
    print("  history: %s" % ("new change point" if changed else "unchanged"))
    save(history, changed)
    return 0


def run_backfill(start):
    history = load_history()
    end = vn_today()
    day = start
    changed_any = False
    last_done = None
    first = True
    while day <= end:
        if not first:
            time.sleep(BACKFILL_SLEEP)
        first = False
        try:
            payload = fetch_day(day, RETRY_BACKOFF)
        except Exception as e:
            print("error: giving up at %s: %s" % (day, e), file=sys.stderr)
            save(history, changed_any)
            print("last processed day: %s — rerun with --backfill-from %s" % (
                last_done or "(none)", day.isoformat()), file=sys.stderr)
            return 1
        parsed = parse_day(payload)
        if parsed:
            date_str, prices, upd, sources = parsed
            prices, sources = carry_forward(history, prices, sources)
            if apply_observation(history, date_str, prices, upd, sources):
                changed_any = True
                print("%s change: %s" % (date_str, ", ".join("%s=%d" % kv for kv in prices.items())))
        else:
            print("%s: no record" % day)
        last_done = day
        day += timedelta(days=1)
    save(history, changed_any)
    print("backfill done through %s, %d change points" % (last_done, len(history["changes"])))
    return 0


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--backfill-from", metavar="YYYY-MM-DD")
    args = ap.parse_args()
    if args.backfill_from:
        try:
            start = date.fromisoformat(args.backfill_from)
        except ValueError:
            print("error: --backfill-from must be YYYY-MM-DD", file=sys.stderr)
            return 2
        return run_backfill(start)
    return run_today()


if __name__ == "__main__":
    sys.exit(main())
