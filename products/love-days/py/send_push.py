"""Send LoveDays' daily Web Push to every subscribed iPhone (at most once per
Vietnam day). Run by .github/workflows/love-days-push.yml.

Env (GitHub secrets):
  LOVE_VAPID_PRIVATE_KEY   required — raw base64url private key ("privateKey"
                           from `npx web-push generate-vapid-keys --json`)
  LOVE_PUSH_SUBSCRIPTIONS  required — JSON array of the objects the app's
                           "Sao chép" button produces: {label, endpoint, keys:{p256dh, auth}}
  LOVE_START_DATE          optional — YYYY-MM-DD, only a fallback in the payload;
                           the phone computes the day from its own data
  LOVE_VAPID_SUB           optional — VAPID "sub" claim (Apple requires mailto: or https:)

Exit codes: 0 delivered to >= 1 device / already sent today / dry run,
            1 every device failed (state not written), 2 configuration error.

The repo and its Actions logs are PUBLIC: never print an endpoint, a key or
the raw exception text (requests errors embed the URL) — only label, host
and HTTP status.
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
from urllib.parse import urlparse

DEFAULT_STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "push-state.json")
DEFAULT_SUB = "https://letranvietlong.github.io"
TTL_SECONDS = 12 * 3600
VN = dt.timedelta(hours=7)
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class ConfigError(Exception):
    pass


def log(msg):
    print(msg, flush=True)


def clean_label(value, index):
    label = value if isinstance(value, str) else ""
    # A label is echoed into ::warning:: lines: strip anything that could
    # start a new workflow command.
    label = re.sub(r"[\r\n:%]", " ", label).strip()[:40]
    return label or "thiết bị %d" % (index + 1)


def parse_now(value):
    if not value:
        return dt.datetime.now(dt.timezone.utc)
    try:
        t = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ConfigError("--now không đúng định dạng ISO 8601 (ví dụ 2026-10-01T23:30:00Z)")
    if t.tzinfo is None:
        raise ConfigError("--now phải có múi giờ (ví dụ ...Z hoặc +07:00)")
    return t.astimezone(dt.timezone.utc)


def parse_date(value, name):
    if not isinstance(value, str) or not DATE_RE.match(value):
        raise ConfigError("%s phải có dạng YYYY-MM-DD" % name)
    try:
        return dt.date.fromisoformat(value)
    except ValueError:
        raise ConfigError("%s không phải ngày có thật" % name)


def parse_subscriptions(raw):
    """Accept what people actually paste into the secret: a JSON array, one
    subscription object without brackets (the app's "Sao chép" output), or
    several objects separated by commas / newlines. Same helper as
    .github/scripts/web_push.py (this script doesn't import that library yet)."""
    dec = json.JSONDecoder()
    out, i, n = [], 0, len(raw)
    while i < n:
        while i < n and (raw[i].isspace() or raw[i] == ","):
            i += 1
        if i >= n:
            break
        val, i = dec.raw_decode(raw, i)
        out.extend(val if isinstance(val, list) else [val])
    return out


def load_config(today_vn):
    key = os.environ.get("LOVE_VAPID_PRIVATE_KEY", "").strip()
    if not key:
        raise ConfigError("thiếu secret LOVE_VAPID_PRIVATE_KEY")
    try:
        from py_vapid import Vapid
        vapid = Vapid.from_string(private_key=key)
    except Exception:
        raise ConfigError("LOVE_VAPID_PRIVATE_KEY không phải khoá VAPID hợp lệ (cần chuỗi privateKey dạng base64url)")

    raw = os.environ.get("LOVE_PUSH_SUBSCRIPTIONS", "").strip()
    if not raw:
        raise ConfigError("thiếu secret LOVE_PUSH_SUBSCRIPTIONS")
    try:
        subs = parse_subscriptions(raw)
    except ValueError:
        raise ConfigError("LOVE_PUSH_SUBSCRIPTIONS không phải JSON hợp lệ — dán nguyên mã do nút Sao chép trong app tạo ra (nhiều máy: các mã cách nhau bằng dấu phẩy)")
    if not subs:
        raise ConfigError("LOVE_PUSH_SUBSCRIPTIONS đang rỗng — dán mã do nút Sao chép trong app tạo ra")
    devices = []
    for i, s in enumerate(subs):
        keys = s.get("keys") if isinstance(s, dict) else None
        endpoint = s.get("endpoint") if isinstance(s, dict) else None
        if not (isinstance(endpoint, str) and endpoint.startswith(("https://", "http://"))
                and isinstance(keys, dict) and isinstance(keys.get("p256dh"), str) and isinstance(keys.get("auth"), str)):
            raise ConfigError("mục thứ %d trong LOVE_PUSH_SUBSCRIPTIONS thiếu endpoint hoặc keys.p256dh/keys.auth" % (i + 1))
        devices.append({
            "label": clean_label(s.get("label"), i),
            "host": urlparse(endpoint).hostname or "?",
            "info": {"endpoint": endpoint, "keys": {"p256dh": keys["p256dh"], "auth": keys["auth"]}},
        })

    payload = {"date": today_vn.isoformat()}
    start = os.environ.get("LOVE_START_DATE", "").strip()
    if start:
        start_date = parse_date(start, "LOVE_START_DATE")
        n = (today_vn - start_date).days + 1
        if n < 1:
            raise ConfigError("LOVE_START_DATE nằm sau hôm nay")
        payload = {"startDate": start, "n": n, "date": today_vn.isoformat()}

    sub_claim = os.environ.get("LOVE_VAPID_SUB", "").strip() or DEFAULT_SUB
    if not sub_claim.startswith(("mailto:", "https://")):
        raise ConfigError("LOVE_VAPID_SUB phải bắt đầu bằng mailto: hoặc https://")
    return vapid, devices, payload, sub_claim


def read_state(path):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except (ValueError, OSError):
        log("::warning::Không đọc được %s — coi như hôm nay chưa gửi" % os.path.basename(path))
        return {}


def write_state(path, state):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def send_all(vapid, devices, payload, sub_claim):
    from pywebpush import webpush, WebPushException

    data = json.dumps(payload, separators=(",", ":"))
    delivered = failed = 0
    for d in devices:
        try:
            # pywebpush writes "aud" into the claims dict it is given, so each
            # device needs a fresh one — reusing it would sign Apple's endpoint
            # with another push service's audience (403).
            webpush(d["info"], data=data, vapid_private_key=vapid, vapid_claims={"sub": sub_claim},
                    ttl=TTL_SECONDS, timeout=30)
            delivered += 1
            log('Đã gửi tới "%s" (%s)' % (d["label"], d["host"]))
        except WebPushException as e:
            failed += 1
            status = e.status_code
            if status in (404, 410):
                log('::warning::Thiết bị "%s" hết hạn đăng ký (%s) — gỡ khỏi secret LOVE_PUSH_SUBSCRIPTIONS và đăng ký lại trong app' % (d["label"], status))
            else:
                log('::warning::Thiết bị "%s" (%s) lỗi tạm (HTTP %s) — lần chạy sau sẽ thử lại' % (d["label"], d["host"], status if status is not None else "?"))
        except Exception as e:
            failed += 1
            log('::warning::Thiết bị "%s" (%s) lỗi tạm (%s) — lần chạy sau sẽ thử lại' % (d["label"], d["host"], type(e).__name__))
    return delivered, failed


def main(argv=None):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Gửi thông báo đẩy hằng ngày của LoveDays")
    ap.add_argument("--now", help="giờ hiện tại ISO 8601 có múi giờ (để test)")
    ap.add_argument("--force", action="store_true", help="gửi kể cả khi hôm nay đã gửi")
    ap.add_argument("--dry-run", action="store_true", help="chỉ in ra, không gửi, không ghi trạng thái")
    ap.add_argument("--state", default=DEFAULT_STATE, help="đường dẫn push-state.json")
    args = ap.parse_args(argv)

    try:
        now = parse_now(args.now)
        today_vn = (now + VN).date()
        vapid, devices, payload, sub_claim = load_config(today_vn)
    except ConfigError as e:
        log("::error::Cấu hình sai: %s" % e)
        return 2

    state = read_state(args.state)
    today = today_vn.isoformat()
    if state.get("lastSentDate") == today and not args.force:
        log("Đã gửi hôm nay, bỏ qua (%s, giờ Việt Nam)" % today)
        return 0

    payload_desc = "ngày thứ %s" % payload["n"] if "n" in payload else "không kèm ngày bắt đầu"
    if args.dry_run:
        log("Chạy thử (--dry-run): sẽ gửi %s, %s, tới %d thiết bị:" % (today, payload_desc, len(devices)))
        for d in devices:
            log('  - "%s" (%s)' % (d["label"], d["host"]))
        return 0

    log("Gửi thông báo %s (%s) tới %d thiết bị" % (today, payload_desc, len(devices)))
    delivered, failed = send_all(vapid, devices, payload, sub_claim)
    log("Kết quả: %d thành công, %d lỗi" % (delivered, failed))
    if delivered == 0:
        log("::error::Không gửi được tới thiết bị nào — chưa ghi trạng thái, lần chạy sau sẽ thử lại")
        return 1
    write_state(args.state, {
        "lastSentDate": today,
        "sentAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "delivered": delivered,
        "failed": failed,
    })
    return 0


if __name__ == "__main__":
    sys.exit(main())
