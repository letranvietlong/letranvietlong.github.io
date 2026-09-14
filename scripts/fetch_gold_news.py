#!/usr/bin/env python3
"""Fetch Vietnamese finance RSS feeds and keep only items relevant to gold
prices — either directly about gold, or about things that commonly move
gold prices (Fed/interest rates, USD, inflation, safe-haven demand) — and
write them as static JSON that GoldTrack.html reads same-origin.

None of these sources publish a dedicated gold-only RSS feed, so this
pulls broader finance/business feeds and filters by keyword instead.
"""
import json
import os
import ssl
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import certifi

FEEDS = [
    {"url": "https://cafef.vn/tai-chinh-ngan-hang.rss", "source": "CafeF"},
    {"url": "https://cafef.vn/vi-mo-dau-tu.rss", "source": "CafeF"},
    {"url": "https://vnexpress.net/rss/kinh-doanh.rss", "source": "VnExpress"},
]

# Substring match against the lowercased title — direct gold terms plus the
# handful of macro drivers that regularly move gold (Fed policy, USD,
# inflation, safe-haven flight). Deliberately excludes bare "lãi suất" /
# "tỷ giá" — CafeF publishes near-daily routine bank deposit-rate listicles
# that use those words with zero connection to gold; "fed"/"usd" alone
# catch the ones that actually matter without that noise.
KEYWORDS = [
    "vàng", "sjc", "doji", "pnj", "bảo tín", "kim loại quý",
    "fed", "usd", "đô la", "đồng đô la",
    "lạm phát", "trái phiếu mỹ", "ngân hàng nhà nước", "dự trữ ngoại hối",
]

NEWS_MAX = 40
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS_FILE = os.path.join(ROOT, "data", "gold-news.json")


def fetch_feed(url):
    ctx = ssl.create_default_context(cafile=certifi.where())
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; GoldTrack/1.0)"})
    with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
        return resp.read()


def parse_date(raw):
    if not raw:
        return None
    try:
        dt = parsedate_to_datetime(raw)
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def parse_items(xml_bytes, source):
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []
    channel = root.find("channel")
    if channel is None:
        return []
    items = []
    for item in channel.findall("item"):
        title_el = item.find("title")
        link_el = item.find("link")
        date_el = item.find("pubDate")
        title = (title_el.text or "").strip() if title_el is not None else ""
        link = (link_el.text or "").strip() if link_el is not None else ""
        if not title or not link:
            continue
        dt = parse_date(date_el.text if date_el is not None else None)
        items.append({
            "title": title,
            "link": link,
            "source": source,
            "publishedAt": dt.astimezone(timezone.utc).isoformat(timespec="seconds") if dt else None,
        })
    return items


def is_relevant(title):
    low = title.lower()
    return any(kw in low for kw in KEYWORDS)


def main():
    collected = []
    any_feed_ok = False
    for feed in FEEDS:
        try:
            raw = fetch_feed(feed["url"])
        except Exception as e:
            print("warn: could not fetch %s: %s" % (feed["url"], e), file=sys.stderr)
            continue
        any_feed_ok = True
        collected.extend(parse_items(raw, feed["source"]))

    if not any_feed_ok:
        print("error: all feeds failed, leaving existing data/gold-news.json untouched", file=sys.stderr)
        return 1

    relevant = [it for it in collected if is_relevant(it["title"])]

    # Dedupe by link (same story sometimes appears in more than one feed),
    # keeping the first occurrence.
    seen = set()
    deduped = []
    for it in relevant:
        if it["link"] in seen:
            continue
        seen.add(it["link"])
        deduped.append(it)

    # Items without a parseable pubDate sort last rather than crashing.
    deduped.sort(key=lambda it: it["publishedAt"] or "", reverse=True)
    deduped = deduped[:NEWS_MAX]

    doc = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "articles": deduped,
    }
    os.makedirs(os.path.dirname(NEWS_FILE), exist_ok=True)
    with open(NEWS_FILE, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print("OK: %d relevant articles from %d feeds" % (len(deduped), len(FEEDS)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
