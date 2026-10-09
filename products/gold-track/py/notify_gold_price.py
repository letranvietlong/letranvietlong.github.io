"""Send a Web Push when the gold price of a watched shop changes.
Run by .github/workflows/update-gold-price.yml right after the fetch step,
before the commit, so data/push-state.json lands in the same commit as the
prices.

The gold bot commits on EVERY run (fetchedAt changes), so "a new commit" does
not mean "the price changed". This compares data/gold-price.json with the
LAST NOTIFIED prices (data/push-state.json):
  - no state yet          → store the current prices as baseline, send nothing
  - a watched type is new → add it to the baseline, send nothing for it
  - same prices           → nothing to do
  - 22:00–07:00 VN        → defer to a later run (state untouched, so the
                            night's changes are merged into one morning push)
  - otherwise             → one push listing every changed type

Env: PUSH_VAPID_PRIVATE_KEY, GOLD_PUSH_SUBSCRIPTIONS (GitHub secrets),
     PUSH_VAPID_SUB (optional). See products/gold-track/docs/gold-track.md.

Exit codes: 0 sent to ≥ 1 device / nothing to send / deferred / dry run,
            1 every device failed (state not written), 2 configuration error.
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
DEFAULT_PRICE = os.path.join(PRODUCT, "data", "gold-price.json")
SECRET = "GOLD_PUSH_SUBSCRIPTIONS"
KEY_ENV = "PUSH_VAPID_PRIVATE_KEY"
TTL_SECONDS = 6 * 3600
VN = dt.timedelta(hours=7)
MINUS = "−"

# Must match SHOP_TYPES in js/gold-track.js / the fetcher's catalog.
WATCH = [
    ("ngoc-thinh", "9999-nhan-tron", "Ngọc Thịnh 9999"),
    ("huy-thanh", "24k-huy-thanh", "Huy Thanh 24k"),
]


def wkey(shop, gold_type):
    return "%s/%s" % (shop, gold_type)


def parse_now(value):
    if not value:
        return dt.datetime.now(dt.timezone.utc)
    try:
        t = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ConfigError("--now không đúng định dạng ISO 8601 (ví dụ 2026-10-08T07:16:00Z)")
    if t.tzinfo is None:
        raise ConfigError("--now phải có múi giờ (ví dụ ...Z hoặc +07:00)")
    return t.astimezone(dt.timezone.utc)


def is_quiet(now_utc):
    hour = (now_utc + VN).hour
    return hour < 7 or hour >= 22


def fmt_int(n):
    return "{:,}".format(int(n)).replace(",", ".")


def fmt_delta(d):
    return ("+" if d > 0 else MINUS) + fmt_int(abs(d))


def valid_price(v):
    return isinstance(v, int) and not isinstance(v, bool) and v > 0


def valid_pair(p):
    return isinstance(p, dict) and valid_price(p.get("buy")) and valid_price(p.get("sell"))


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def read_current(path):
    data = read_json(path)
    cur = {}
    for shop, gold_type, _name in WATCH:
        t = (((data.get(shop) or {}).get("types") or {}).get(gold_type)) if isinstance(data, dict) else None
        if isinstance(t, dict) and valid_price(t.get("buy")) and valid_price(t.get("sell")):
            cur[wkey(shop, gold_type)] = {"buy": t["buy"], "sell": t["sell"]}
    return cur


def read_state(path):
    try:
        data = read_json(path)
    except FileNotFoundError:
        return None
    except (ValueError, OSError):
        log("::warning::Không đọc được %s — coi như chưa có mốc" % os.path.basename(path))
        return None
    n = data.get("notified") if isinstance(data, dict) else None
    if not isinstance(n, dict):
        return None
    return {k: {"buy": v["buy"], "sell": v["sell"]} for k, v in n.items() if isinstance(k, str) and valid_pair(v)}


def write_state(path, notified, now, delivered, failed):
    state = {
        "notified": {k: notified[k] for k in sorted(notified)},
        "notifiedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "delivered": delivered,
        "failed": failed,
    }
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def side(label, price, old):
    d = price - old if old is not None else 0
    return "%s %s" % (label, fmt_int(price)) + (" (%s)" % fmt_delta(d) if d else "")


def build_message(cur, notified, keys):
    lines, deltas = [], []
    for shop, gold_type, name in WATCH:
        k = wkey(shop, gold_type)
        if k not in keys or k not in cur:
            continue
        old = notified.get(k) or {}
        c = cur[k]
        lines.append("%s: %s · %s" % (name, side("mua", c["buy"], old.get("buy")), side("bán", c["sell"], old.get("sell"))))
        for f in ("buy", "sell"):
            if old.get(f) is not None and c[f] != old[f]:
                deltas.append(c[f] - old[f])
    if not deltas:
        title = "Giá vàng hiện tại"
    elif all(d > 0 for d in deltas):
        title = "Giá vàng tăng"
    elif all(d < 0 for d in deltas):
        title = "Giá vàng giảm"
    else:
        title = "Giá vàng thay đổi"
    return title, "\n".join(lines) or "Mở app để xem giá mới"


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Gửi thông báo khi giá vàng đổi")
    ap.add_argument("--now", help="giờ hiện tại ISO 8601 có múi giờ (để test)")
    ap.add_argument("--force", action="store_true", help="gửi kể cả khi chưa có mốc / không đổi / giờ yên lặng")
    ap.add_argument("--dry-run", action="store_true", help="chỉ in ra, không gửi, không ghi trạng thái")
    ap.add_argument("--state", default=DEFAULT_STATE, help="đường dẫn push-state.json")
    ap.add_argument("--price-file", default=DEFAULT_PRICE, help="đường dẫn gold-price.json")
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
        cur = read_current(args.price_file)
    except (OSError, ValueError, AttributeError):
        log("::warning::Không đọc được giá vàng hiện tại — bỏ qua thông báo")
        return 0
    if not cur:
        log("Không có giá của tiệm nào đang theo dõi — bỏ qua thông báo")
        return 0

    notified = read_state(args.state)
    if not notified and not args.force:
        if args.dry_run:
            log("Chạy thử: chưa có mốc, lần chạy thật sẽ lưu giá hiện tại làm mốc (không gửi)")
            return 0
        write_state(args.state, cur, now, 0, 0)
        log("Khởi tạo mốc, chưa gửi")
        return 0
    notified = dict(notified or {})

    added = [k for k in cur if k not in notified]
    for k in added:
        notified[k] = cur[k]
        log("Thêm mốc cho %s, chưa gửi" % k)

    changed = [k for k in cur if cur[k] != notified[k]]
    if not changed and not args.force:
        log("Giá không đổi so với lần báo gần nhất")
        if added and not args.dry_run:
            write_state(args.state, notified, now, 0, 0)
        return 0

    if is_quiet(now) and not args.force:
        log("Giờ yên lặng (22:00–07:00 giờ VN), để lượt sau")
        return 0

    title, body = build_message(cur, notified, set(changed) or set(cur))
    payload = {"v": 1, "title": title, "body": body, "tag": "gold-price",
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
    for k in cur:
        notified[k] = cur[k]
    write_state(args.state, notified, now, delivered, failed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
