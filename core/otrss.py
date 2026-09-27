from urllib.parse import parse_qs, unquote, urlparse

import requests

OTRSS_URL = "https://api-otrss.garena.com/support/callback/"
BROWSER = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
PLACEHOLDERS = {
    "{eat_token}",
    "{eat}",
    "{eat_id}",
    "{your_eat_id}",
    "{your_eat_token}",
    "your_eat_token_here",
    "eat_token",
}


def is_placeholder(value):
    text = unquote(value or "").strip()
    if not text:
        return True
    low = text.lower()
    if text in PLACEHOLDERS or low in {item.lower() for item in PLACEHOLDERS}:
        return True
    return text.startswith("{") and text.endswith("}")


def _from_url(url):
    if not url:
        return {}
    parsed = urlparse(url)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    if parsed.fragment:
        qs.update(parse_qs(parsed.fragment, keep_blank_values=True))
    err = (qs.get("err") or qs.get("error") or [None])[0]
    access = (qs.get("access_token") or qs.get("access") or [None])[0]
    if access:
        access = unquote(access)
    return {
        "url": url,
        "error": err,
        "access": access,
        "account_id": (qs.get("account_id") or [None])[0],
        "nickname": unquote((qs.get("nickname") or [""])[0] or "") or None,
        "region": ((qs.get("region") or [""])[0] or "").upper() or None,
        "game": (qs.get("game") or [None])[0],
        "lang": (qs.get("lang") or [None])[0],
    }


def eat_to_access(eat):
    eat = unquote((eat or "").strip())
    if not eat:
        raise ValueError("EAT пустой")
    if is_placeholder(eat):
        raise ValueError(
            "Это шаблон {eat_token}, не токен. Вставь ссылку kiosgamer с eat=."
        )

    resp = requests.get(
        OTRSS_URL,
        params={"access_token": eat},
        headers={
            "User-Agent": BROWSER,
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
        },
        allow_redirects=False,
        timeout=25,
    )

    loc = resp.headers.get("Location") or resp.headers.get("location") or ""
    found = _from_url(loc) if loc else {}
    if not found.get("access") and not found.get("error"):
        found = _from_url(resp.url)

    if found.get("error"):
        err = found["error"]
        if err in ("error_gop", "invalid_token", "invalid"):
            raise ValueError("EAT не принят Garena callback. Возьми свежую ссылку kiosgamer.")
        raise ValueError("Garena callback: %s" % err)

    access = found.get("access")
    if not access or is_placeholder(access):
        raise ValueError("Callback не отдал access_token. Проверь EAT.")

    found["eat"] = eat
    found["same_token"] = access == eat

    try:
        from core.jwt_login import inspect_access

        info = inspect_access(access)
    except Exception:
        info = {}
    if isinstance(info, dict) and info.get("open_id") and not info.get("error"):
        found["open_id"] = info.get("open_id")
        found["platform"] = info.get("platform")
        found["inspect_uid"] = info.get("uid")
        found["app_id"] = info.get("app_id")
        found["inspect_ok"] = True
    else:
        found["inspect_ok"] = False

    return found
