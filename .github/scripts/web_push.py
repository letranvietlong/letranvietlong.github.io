"""Shared Web Push sender for the price notifiers (GoldTrack, FuelTrack).

CI-only code used by more than one product, so it lives in .github/scripts/
instead of one product's py/ folder. Product scripts import it with
    sys.path.insert(0, os.path.join(<product root>, "..", "..", ".github", "scripts"))
Logic copied from products/love-days/py/send_push.py with the env names made
parameters (LoveDays still has its own copy).

The repo and its Actions logs are PUBLIC: never print an endpoint, a key or
the raw exception text (requests errors embed the URL) — only label, host
and HTTP status.
"""

import json
import os
import re
from urllib.parse import urlparse

DEFAULT_SUB = "https://letranvietlong.github.io"


class ConfigError(Exception):
    pass


def log(msg):
    print(msg, flush=True)


def clean_label(value, index):
    label = value if isinstance(value, str) else ""
    # A label is echoed into ::warning:: lines: strip anything that could
    # start a new workflow command.
    label = re.sub(r"[\r\n:%]", " ", label).strip()[:40]
    return label or "Máy %d" % (index + 1)


def load_vapid(env_name):
    key = os.environ.get(env_name, "").strip()
    if not key:
        raise ConfigError("thiếu secret %s" % env_name)
    try:
        from py_vapid import Vapid
    except ImportError:
        raise ConfigError("thiếu thư viện pywebpush (pip install pywebpush)")
    try:
        return Vapid.from_string(private_key=key)
    except Exception:
        raise ConfigError("%s không phải khoá VAPID hợp lệ (cần chuỗi privateKey dạng base64url)" % env_name)


def parse_subscriptions(raw):
    """Accept what people actually paste into the secret: a JSON array, one
    subscription object without brackets (the app's "Sao chép" output), or
    several objects separated by commas / newlines. Returns a flat list;
    raises ValueError when something doesn't parse."""
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


def load_devices(env_name):
    raw = os.environ.get(env_name, "").strip()
    if not raw:
        raise ConfigError("thiếu secret %s" % env_name)
    try:
        subs = parse_subscriptions(raw)
    except ValueError:
        raise ConfigError("%s không phải JSON hợp lệ — dán nguyên mã do nút Sao chép trong app tạo ra (nhiều máy: các mã cách nhau bằng dấu phẩy)" % env_name)
    if not subs:
        raise ConfigError("%s đang rỗng — dán mã do nút Sao chép trong app tạo ra" % env_name)
    devices = []
    for i, s in enumerate(subs):
        keys = s.get("keys") if isinstance(s, dict) else None
        endpoint = s.get("endpoint") if isinstance(s, dict) else None
        # http:// is accepted only so a local fake push server can be used in tests.
        if not (isinstance(endpoint, str) and endpoint.startswith(("https://", "http://"))
                and isinstance(keys, dict) and isinstance(keys.get("p256dh"), str) and isinstance(keys.get("auth"), str)):
            raise ConfigError("mục thứ %d trong %s thiếu endpoint hoặc keys.p256dh/keys.auth" % (i + 1, env_name))
        devices.append({
            "label": clean_label(s.get("label"), i),
            "host": urlparse(endpoint).hostname or "?",
            "info": {"endpoint": endpoint, "keys": {"p256dh": keys["p256dh"], "auth": keys["auth"]}},
        })
    return devices


def vapid_sub(env_name="PUSH_VAPID_SUB"):
    sub = os.environ.get(env_name, "").strip() or DEFAULT_SUB
    if not sub.startswith(("mailto:", "https://")):
        raise ConfigError("%s phải bắt đầu bằng mailto: hoặc https://" % env_name)
    return sub


def send_all(vapid, devices, payload, sub_claim, ttl, secret_name):
    """Returns (delivered, failed). pywebpush is imported here so that callers
    can decide, initialise state and dry-run without it installed."""
    from pywebpush import webpush, WebPushException

    data = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    delivered = failed = 0
    for d in devices:
        try:
            # pywebpush writes "aud" into the claims dict it is given, so each
            # device needs a fresh one — reusing it would sign Apple's endpoint
            # with another push service's audience (403).
            webpush(d["info"], data=data, vapid_private_key=vapid, vapid_claims={"sub": sub_claim},
                    ttl=ttl, headers={"Urgency": "normal"}, timeout=30)
            delivered += 1
            log('Đã gửi tới "%s" (%s)' % (d["label"], d["host"]))
        except WebPushException as e:
            failed += 1
            status = e.status_code
            if status in (404, 410):
                log('::warning::Thiết bị "%s" hết hạn đăng ký (%s) — gỡ khỏi secret %s và đăng ký lại trong app' % (d["label"], status, secret_name))
            elif status == 403:
                log('::warning::Thiết bị "%s" (%s) bị từ chối (403) — khoá VAPID trong app khác khoá trong secret?' % (d["label"], d["host"]))
            else:
                log('::warning::Thiết bị "%s" (%s) lỗi tạm (HTTP %s) — lần chạy sau sẽ thử lại' % (d["label"], d["host"], status if status is not None else "?"))
        except Exception as e:
            failed += 1
            log('::warning::Thiết bị "%s" (%s) lỗi tạm (%s) — lần chạy sau sẽ thử lại' % (d["label"], d["host"], type(e).__name__))
    return delivered, failed
