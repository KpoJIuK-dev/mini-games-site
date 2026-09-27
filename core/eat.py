import re
from urllib.parse import parse_qs, unquote, urlparse

from core.otrss import is_placeholder

EAT_RE = re.compile(r"^[0-9a-fA-F]{64,}$")
ACCESS_RE = re.compile(r"^[0-9a-fA-F]{32,}$")
EAT_HEX_MIN = 128


def _qs(text):
    if "://" in text:
        parsed = urlparse(text)
        qs = parse_qs(parsed.query, keep_blank_values=True)
        if parsed.fragment:
            qs.update(parse_qs(parsed.fragment, keep_blank_values=True))
        return qs, parsed
    return parse_qs(text.lstrip("?"), keep_blank_values=True), None


def _meta(qs):
    return {
        "region": ((qs.get("region") or [""])[0] or "").upper() or None,
        "account_id": (qs.get("account_id") or [""])[0] or None,
        "nickname": unquote((qs.get("nickname") or [""])[0] or "") or None,
        "lang": (qs.get("lang") or [""])[0] or None,
        "game": (qs.get("game") or [""])[0] or None,
    }


def _host(parsed):
    return (parsed.netloc if parsed else "").lower()


def _hex_kind(text):
    if not ACCESS_RE.match(text or ""):
        return None
    if len(text) >= EAT_HEX_MIN:
        return "eat"
    return "access"


def parse_token_input(raw, kind=None):
    text = (raw or "").strip()
    kind = (kind or "").strip().lower() or None
    if not text and kind != "uid":
        return {"kind": "empty"}

    if text.lower().startswith("bearer "):
        text = text[7:].strip()

    qs = {}
    parsed_url = None
    if "=" in text and (
        "eat=" in text.lower()
        or "access_token=" in text.lower()
        or "access=" in text.lower()
    ):
        try:
            qs, parsed_url = _qs(text)
        except Exception:
            qs, parsed_url = {}, None

    host = _host(parsed_url)
    eat = unquote((qs.get("eat") or [""])[0] or "")
    access = unquote((qs.get("access_token") or qs.get("access") or [""])[0] or "")

    if eat and is_placeholder(eat):
        return {"kind": "unknown", "error": "Это шаблон, не EAT. Вставь ссылку kiosgamer."}
    if access and is_placeholder(access):
        return {
            "kind": "unknown",
            "error": "В ссылке шаблон {eat_token}. Вставь живой EAT с kiosgamer.",
        }

    if eat:
        return {"kind": "eat", "eat": eat, **_meta(qs)}

    if access:
        token_kind = _hex_kind(access) or ("eat" if kind == "eat" else "access")
        if token_kind == "eat" or kind == "eat":
            if EAT_RE.match(access) or len(access) >= EAT_HEX_MIN:
                return {"kind": "eat", "eat": access, **_meta(qs)}
        if kind != "eat":
            return {"kind": "access", "access": access, **_meta(qs)}

    if kind != "eat":
        if kind == "access":
            hex_kind = _hex_kind(text)
            if hex_kind == "eat":
                return {"kind": "eat", "eat": text}
            if ACCESS_RE.match(text) or text:
                return {"kind": "access", "access": text}

    if kind == "eat" and EAT_RE.match(text):
        return {"kind": "eat", "eat": text}
    if not kind:
        hex_kind = _hex_kind(text)
        if hex_kind == "eat":
            return {"kind": "eat", "eat": text}
        if hex_kind == "access":
            return {"kind": "access", "access": text}
        if EAT_RE.match(text):
            return {"kind": "eat", "eat": text}

    from core.crypto import extract_jwt
    jwt = extract_jwt(text)
    if jwt:
        return {"kind": "jwt", "jwt": jwt}

    if kind == "jwt":
        return {"kind": "unknown"}

    if kind == "access" and text:
        return {"kind": "access", "access": text}

    if "api-otrss.garena.com" in host or "help.garena.com" in host:
        return {
            "kind": "unknown",
            "error": "В callback нет токена. Вставь kiosgamer с eat= или живой access.",
        }

    return {"kind": "unknown"}
