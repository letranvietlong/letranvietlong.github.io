"""Send a Web Push when PVOIL fuel prices change (one per adjustment period).
Run by .github/workflows/update-fuel-price.yml right after the fetch step,
before the commit, so data/push-state.json lands in the same commit as the
prices.

Compares the newest change point in data/fuel-price-history.json with the
LAST NOTIFIED prices (data/push-state.json), not with the previous commit:
  - no state yet          → store the current period as baseline, send nothing
  - state file unreadable → ::warning::, baseline = the period before the
    newest one if the newest is ≤ 2 days old (so it still gets notified),
    else the newest one (never re-announce an old period)
  - same prices           → nothing to do
  - no item listed on both sides changed price (an item was only added or
    dropped, e.g. RON 95-III retired 05/06/2026) → update state, send nothing
  - newest entry equals one of the last 6 periods (≤ 60 days) and is ≤ 3 days
    old → probably the source's noisy record (fetch_fuel_price.py heals those
    within ~3 days) → wait
  - 22:00–07:00 VN        → defer to a later run (cron is hourly)
  - otherwise             → send; same period changed again → title "(cập nhật)"

Env: PUSH_VAPID_PRIVATE_KEY, FUEL_PUSH_SUBSCRIPTIONS (GitHub secrets),
     PUSH_VAPID_SUB (optional). See products/fuel-track/docs/fuel-track.md.

Exit codes: 0 sent to ≥ 1 device / nothing to send / deferred / dry run,
            1 every device failed (state not written) or history file
              unreadable/malformed, 2 configuration error.
"""

import argparse
import datetime as dt
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PRODUCT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(PRODUCT, "..", "..", ".github", "scripts"))
import web_push  # noqa: E402
from web_push import ConfigError, log  # noqa: E402

DEFAULT_STATE = os.path.join(PRODUCT, "data", "push-state.json")
DEFAULT_HISTORY = os.path.join(PRODUCT, "data", "fuel-price-history.json")
SECRET = "FUEL_PUSH_SUBSCRIPTIONS"
KEY_ENV = "PUSH_VAPID_PRIVATE_KEY"
TTL_SECONDS = 24 * 3600
VN = dt.timedelta(hours=7)
NOISE_DAYS = 3
NOISE_LOOKBACK = 6
NOISE_LOOKBACK_DAYS = 60
BAD_STATE_RECENT_DAYS = 2
BAD_STATE = "bad"
MINUS = "−"
UP, DOWN = "▲", "▼"
EARLY_VN_HOUR = 7

# Same order as ITEMS in fetch_fuel_price.py.
SHORT = {
    "e10-ron95-iii": "E10 RON95",
    "e5-ron92-ii": "E5 RON92",
    "ron95-iii": "RON95-III",
    "do-005s-ii": "Dầu DO",
    "ko": "Dầu hỏa",
}


def parse_now(value):
    if not value:
        return dt.datetime.now(dt.timezone.utc)
    try:
        t = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ConfigError("--now không đúng định dạng ISO 8601 (ví dụ 2026-10-08T09:23:00Z)")
    if t.tzinfo is None:
        raise ConfigError("--now phải có múi giờ (ví dụ ...Z hoặc +07:00)")
    return t.astimezone(dt.timezone.utc)


def is_quiet(now_utc):
    hour = (now_utc + VN).hour
    return hour < 7 or hour >= 22


def fmt_int(n):
    return "{:,}".format(int(n)).replace(",", ".")


def fmt_change(d, old):
    """'▲1.070 (+3,94%)' — percent of the old price, rounded half up."""
    if old <= 0:
        return "%s%s" % (UP if d > 0 else DOWN, fmt_int(abs(d)))
    hundredths = (abs(d) * 20000 + old) // (2 * old)
    pct = "%d,%02d" % divmod(hundredths, 100)
    return "%s%s (%s%s%%)" % (UP if d > 0 else DOWN, fmt_int(abs(d)), "+" if d > 0 else MINUS, pct)


def applied_all_day(change):
    """Same rule as appliedAllDay() in js/fuel-track.js: a point the source
    wrote before 07:00 VN of its own day applied all day, not from 15:00."""
    raw = change.get("detectedAt")
    if not isinstance(raw, str):
        return False
    try:
        t = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return False
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    vn = t.astimezone(dt.timezone.utc) + VN
    day = vn.strftime("%Y-%m-%d")
    return day < change["date"] or (day == change["date"] and vn.hour < EARLY_VN_HOUR)


def valid_prices(p):
    return isinstance(p, dict) and all(isinstance(k, str) and isinstance(v, int) and not isinstance(v, bool) for k, v in p.items())


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def read_state(path):
    """None = no state file yet; BAD_STATE = present but unusable."""
    try:
        data = read_json(path)
    except FileNotFoundError:
        return None
    except (ValueError, OSError):
        log("::warning::Không đọc được %s" % os.path.basename(path))
        return BAD_STATE
    n = data.get("notified") if isinstance(data, dict) else None
    if not (isinstance(n, dict) and isinstance(n.get("date"), str) and valid_prices(n.get("prices"))):
        log("::warning::%s không đúng định dạng" % os.path.basename(path))
        return BAD_STATE
    return n


def days_old(today_vn, date_str):
    try:
        return (today_vn - dt.date.fromisoformat(date_str)).days
    except ValueError:
        return None


def moved_items(base, last):
    return [k for k, v in last.items() if k in base and base[k] != v]


def write_state(path, notified, now, delivered, failed):
    state = {
        "notified": {"date": notified["date"], "prices": notified["prices"]},
        "notifiedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "delivered": delivered,
        "failed": failed,
    }
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def item_order(history, ids):
    known = [k for k in SHORT if k in ids]
    extra = [k for k in (history.get("items") or {}) if k in ids and k not in known]
    return known + extra + sorted(k for k in ids if k not in known and k not in extra)


def build_message(history, last, prev, notified, current_only=False):
    labels = history.get("items") or {}
    prev_prices = prev["prices"] if prev else {}
    lines, deltas = [], []
    for k in item_order(history, set(last["prices"])):
        price = last["prices"][k]
        name = SHORT.get(k) or labels.get(k) or k
        if k not in prev_prices:
            lines.append("%s: %s (mới)" % (name, fmt_int(price)))
        elif price != prev_prices[k]:
            deltas.append(price - prev_prices[k])
            lines.append("%s: %s %s" % (name, fmt_int(price), fmt_change(price - prev_prices[k], prev_prices[k])))
        else:
            lines.append("%s: %s · không đổi" % (name, fmt_int(price)))
    d = last["date"]
    day = "%s/%s" % (d[8:10], d[5:7])
    if current_only:
        title = "Giá xăng dầu hiện tại (kỳ %s)" % day
    else:
        if deltas and all(x > 0 for x in deltas):
            title = "Giá xăng dầu tăng"
        elif deltas and all(x < 0 for x in deltas):
            title = "Giá xăng dầu giảm"
        else:
            title = "Giá xăng dầu điều chỉnh"
        title += (" · %s" if applied_all_day(last) else " từ 15:00 · %s") % day
        if notified and notified["date"] == last["date"] and notified["prices"] != last["prices"]:
            title += " (cập nhật)"
    return title, "\n".join(lines) or "Mở app để xem giá mới"


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Gửi thông báo khi giá xăng dầu đổi")
    ap.add_argument("--now", help="giờ hiện tại ISO 8601 có múi giờ (để test)")
    ap.add_argument("--force", action="store_true", help="gửi kể cả khi chưa có mốc / không đổi / giờ yên lặng")
    ap.add_argument("--dry-run", action="store_true", help="chỉ in ra, không gửi, không ghi trạng thái")
    ap.add_argument("--state", default=DEFAULT_STATE, help="đường dẫn push-state.json")
    ap.add_argument("--history-file", default=DEFAULT_HISTORY, help="đường dẫn fuel-price-history.json")
    args = ap.parse_args(argv)

    try:
        now = parse_now(args.now)
        # The key itself is parsed only right before sending (needs
        # pywebpush), so the baseline/skip paths work without the library.
        if not os.environ.get(KEY_ENV, "").strip():
            raise ConfigError("thiếu secret %s" % KEY_ENV)
        devices = web_push.load_devices(SECRET)
        sub_claim = web_push.vapid_sub("PUSH_VAPID_SUB")
    except ConfigError as e:
        log("::error::Cấu hình sai: %s" % e)
        return 2

    try:
        history = read_json(args.history_file)
    except (OSError, ValueError):
        log("::warning::Không đọc được lịch sử giá — bỏ qua thông báo")
        return 1
    if not (isinstance(history, dict) and isinstance(history.get("changes", []), list)
            and isinstance(history.get("items") or {}, dict)):
        log("::warning::Lịch sử giá sai cấu trúc (cần object có changes là mảng) — bỏ qua thông báo")
        return 1
    changes = [c for c in history.get("changes", [])
               if isinstance(c, dict) and isinstance(c.get("date"), str) and valid_prices(c.get("prices"))]
    if not changes:
        log("Lịch sử giá trống — bỏ qua thông báo")
        return 0
    last = changes[-1]
    prev = changes[-2] if len(changes) >= 2 else None

    today_vn = (now + VN).date()
    notified = read_state(args.state)
    if notified == BAD_STATE:
        age_last = days_old(today_vn, last["date"])
        if prev and age_last is not None and 0 <= age_last <= BAD_STATE_RECENT_DAYS:
            # The newest period may not have been announced yet — compare it
            # with the one before, so a corrupt file can't swallow it.
            notified = {"date": prev["date"], "prices": prev["prices"]}
            log("::warning::Lấy kỳ %s làm mốc thay cho trạng thái hỏng" % prev["date"])
        else:
            notified = None
            log("::warning::Lưu lại mốc từ kỳ %s thay cho trạng thái hỏng" % last["date"])
    if notified is None and not args.force:
        if args.dry_run:
            log("Chạy thử: chưa có mốc, lần chạy thật sẽ lưu kỳ %s làm mốc (không gửi)" % last["date"])
            return 0
        write_state(args.state, {"date": last["date"], "prices": last["prices"]}, now, 0, 0)
        log("Khởi tạo mốc kỳ %s, chưa gửi" % last["date"])
        return 0

    if notified and notified["prices"] == last["prices"] and not args.force:
        log("Giá không đổi so với lần báo gần nhất (kỳ %s)" % notified["date"])
        return 0

    if notified and not moved_items(notified["prices"], last["prices"]) and not args.force:
        log("::notice::Kỳ %s chỉ thêm/bớt mặt hàng, không mặt hàng nào đổi giá — cập nhật mốc, không gửi" % last["date"])
        if not args.dry_run:
            write_state(args.state, {"date": last["date"], "prices": last["prices"]}, now, 0, 0)
        return 0

    age = days_old(today_vn, last["date"])
    if age is None:
        age = NOISE_DAYS + 1
    # Only recent periods: a genuine adjustment can land on a price set from a
    # year ago, and must not be held as "noise" for that.
    recent = [c for c in changes[:-1][-NOISE_LOOKBACK:]
              if days_old(today_vn, c["date"]) is not None and days_old(today_vn, c["date"]) <= NOISE_LOOKBACK_DAYS]
    dup = next((c["date"] for c in recent if c["prices"] == last["prices"]), None)
    if dup and age <= NOISE_DAYS and not args.force:
        log("::notice::Nghi bản ghi lỗi của nguồn (trùng kỳ %s), chờ" % dup)
        return 0

    if is_quiet(now) and not args.force:
        log("Giờ yên lặng (22:00–07:00 giờ VN), để lượt sau")
        return 0

    # True only under --force: nothing new since the last notification.
    unchanged = bool(notified) and notified["prices"] == last["prices"]
    title, body = build_message(history, last, prev, notified, current_only=unchanged)
    payload = {"v": 1, "title": title, "body": body, "tag": "fuel-price",
               "ts": now.strftime("%Y-%m-%dT%H:%M:%SZ")}

    # Dry run before parsing the key: parsing needs pywebpush (py_vapid), and a
    # dry run must work without it.
    if args.dry_run:
        log("Chạy thử (--dry-run), sẽ gửi tới %d thiết bị:" % len(devices))
        log("  Tiêu đề: %s" % title)
        for line in body.split("\n"):
            log("  Nội dung: %s" % line)
        for d in devices:
            log('  - "%s" (%s)' % (d["label"], d["host"]))
        return 0

    try:
        vapid = web_push.load_vapid(KEY_ENV)
    except ConfigError as e:
        log("::error::Cấu hình sai: %s" % e)
        return 2

    log("Gửi \"%s\" tới %d thiết bị" % (title, len(devices)))
    delivered, failed = web_push.send_all(vapid, devices, payload, sub_claim, TTL_SECONDS, SECRET)
    log("Kết quả: %d thành công, %d lỗi" % (delivered, failed))
    if delivered == 0:
        log("::error::Không gửi được tới thiết bị nào — chưa ghi trạng thái, lần chạy sau sẽ thử lại")
        return 1
    write_state(args.state, {"date": last["date"], "prices": last["prices"]}, now, delivered, failed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
