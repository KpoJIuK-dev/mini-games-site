import requests
import urllib3

from core.config import DEFAULT_CLIENT, RELEASE_VERSION, client_base, game_headers, region_code
from core.crypto import decode_jwt, decode_nickname, encode_bio, encrypt
from core.eat import parse_token_input
from core.jwt_login import jwt_from_access, jwt_from_eat, jwt_from_uid, version_cfg
from core.otrss import eat_to_access

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BIO_MAX = 1799
PP_CLIENT = "https://clientbp.ppmainecoonghj.com"
NATIVE_FALLBACKS = (
    PP_CLIENT,
    DEFAULT_CLIENT,
    "https://clientbp.common.ggbluefox.com",
    "https://clientbp.ggblueshark.com",
    "https://client.ind.freefiremobile.com",
    "https://client.us.freefiremobile.com",
)


def session_from_token(raw_token, region=None, kind=None):
    parsed = parse_token_input(raw_token, kind=kind)
    token_kind = parsed.get("kind")
    lock = region_code(region) or parsed.get("region")

    if token_kind == "access":
        return {
            "kind": "access",
            "access": parsed["access"],
            "account_id": parsed.get("account_id"),
            "nickname": parsed.get("nickname") or "",
            "region": lock,
            "server_url": "",
            "base": client_base(lock),
            "exp": None,
            "release_version": None,
        }
    if token_kind == "eat":
        return {
            "kind": "eat",
            "eat": parsed["eat"],
            "account_id": parsed.get("account_id"),
            "nickname": parsed.get("nickname") or "",
            "region": lock,
            "server_url": "",
            "base": client_base(lock),
            "exp": None,
            "release_version": None,
        }
    if token_kind != "jwt":
        raise ValueError(
            "Вставь access token, ссылку kiosgamer с eat=, JWT или UID с паролем."
        )
    payload = decode_jwt(parsed["jwt"])
    lock = region_code(region) or payload.get("lock_region") or payload.get("noti_region")
    server_url = payload.get("server_url") or payload.get("url") or ""
    return {
        "kind": "jwt",
        "token": parsed["jwt"],
        "payload": payload,
        "account_id": payload.get("account_id"),
        "nickname": payload.get("nickname_decoded") or payload.get("nickname") or "",
        "region": lock,
        "server_url": server_url,
        "base": client_base(lock, server_url),
        "exp": payload.get("exp"),
        "release_version": payload.get("release_version"),
    }


def _pretty_nick(*values):
    for value in values:
        text = str(value or "").strip()
        if not text:
            continue
        if text.endswith("=") and "@" not in text:
            decoded = decode_nickname(text)
            if decoded and decoded != text:
                return decoded
            continue
        return text
    return ""


def _ok_result(bio, session, extra=None, via=None):
    extra = extra or {}
    status = extra.get("http_code")
    if status not in (200, 201):
        status = 200
    return {
        "ok": True,
        "status": status,
        "bio": bio,
        "account_id": extra.get("account_id") or extra.get("uid") or extra.get("player_uid") or session.get("account_id"),
        "nickname": _pretty_nick(
            extra.get("account_nickname"),
            extra.get("nickname"),
            extra.get("name"),
            session.get("nickname"),
        ),
        "region": extra.get("region") or extra.get("lock_region") or session.get("region"),
        "server": extra.get("server") or extra.get("server_url") or session.get("base") or via,
        "release_version": session.get("release_version"),
        "via": via or session.get("kind"),
        "body": str(extra.get("message") or extra.get("server_response") or "")[:400],
    }


def _fail_result(message, bio, session, status=502, extra=None, via=None):
    extra = extra or {}
    return {
        "ok": False,
        "error": message,
        "status": status,
        "bio": bio,
        "account_id": session.get("account_id") if session else extra.get("account_id"),
        "nickname": session.get("nickname") if session else extra.get("nickname"),
        "region": session.get("region") if session else extra.get("region"),
        "server": (session or {}).get("base") or via,
        "release_version": (session or {}).get("release_version"),
        "via": via or (session or {}).get("kind"),
        "body": str(extra)[:400],
    }


def _native_bases(session):
    region = (session.get("region") or "").upper()
    prefer_login_host = region in ("", "RU", "CIS", "EU")
    ordered = []
    if prefer_login_host:
        ordered.append(PP_CLIENT)
    ordered.extend((
        client_base(session.get("region"), session.get("server_url")),
        (session.get("server_url") or "").rstrip("/"),
    ))
    ordered.extend(NATIVE_FALLBACKS)
    bases = []
    for url in ordered:
        url = (url or "").rstrip("/")
        if url and url not in bases:
            bases.append(url)
    return bases


def _release_for(session):
    release = session.get("release_version")
    if release:
        return release
    try:
        return version_cfg().get("release") or RELEASE_VERSION
    except Exception:
        return RELEASE_VERSION


def _native_update(session, bio):
    last_error = None
    payload = encrypt(encode_bio(bio))
    release = _release_for(session)
    for base in _native_bases(session):
        url = base + "/UpdateSocialBasicInfo"
        headers = game_headers(session["token"], release=release)
        headers["Host"] = url.split("/")[2]
        try:
            resp = requests.post(
                url,
                data=payload,
                headers=headers,
                timeout=20,
                verify=False,
            )
        except requests.exceptions.RequestException as exc:
            last_error = exc
            print("[bio] native %s: %s" % (base, exc), flush=True)
            continue
        try:
            body = resp.content.decode("utf-8")
        except Exception:
            try:
                body = resp.content.decode("latin1")
            except Exception:
                body = resp.content[:80].hex()
        if resp.status_code != 200:
            low = (body or "").lower()
            if resp.status_code in (401, 403) or "signature" in low or "invalid" in low:
                hint = "JWT не принят. Вставь живой токен, пока он не истёк."
            elif resp.status_code == 400:
                hint = "Запрос отклонён. Проверь регион и токен."
            else:
                hint = "Сервер не принял bio (HTTP %s)." % resp.status_code
            last_error = hint
            print("[bio] native %s HTTP %s" % (base, resp.status_code), flush=True)
            continue
        session = dict(session)
        session["base"] = base
        return _ok_result(bio, session, extra={"http_code": resp.status_code, "server": base}, via="jwt")
    return _fail_result(
        str(last_error or "Игровой сервер недоступен."),
        bio,
        session,
        extra={"body": str(last_error)[:400]},
        via="jwt",
    )


def _session_from_jwt_info(info, region=None):
    payload = decode_jwt(info["jwt"])
    lock = region_code(region) or info.get("region") or payload.get("lock_region") or payload.get("noti_region")
    server_url = info.get("server_url") or payload.get("server_url") or payload.get("url") or ""
    return {
        "kind": "jwt",
        "token": info["jwt"],
        "payload": payload,
        "account_id": info.get("account_id") or payload.get("account_id"),
        "nickname": payload.get("nickname_decoded") or payload.get("nickname") or "",
        "region": lock,
        "server_url": server_url,
        "base": client_base(lock, server_url),
        "exp": payload.get("exp"),
        "release_version": info.get("release_version") or payload.get("release_version"),
    }


def _eat_update(session, bio):
    jwt_info = None
    try:
        jwt_info = jwt_from_eat(session["eat"])
    except Exception as exc:
        print("[bio] jwt_from_eat: %s" % exc, flush=True)

    if jwt_info and jwt_info.get("jwt"):
        native = _native_update(_session_from_jwt_info(jwt_info, session.get("region")), bio)
        native["account_id"] = native.get("account_id") or jwt_info.get("account_id") or session.get("account_id")
        native["nickname"] = _pretty_nick(native.get("nickname"), session.get("nickname"))
        native["region"] = native.get("region") or jwt_info.get("region") or session.get("region")
        if native.get("ok"):
            native["via"] = "eat-jwt"
            return native
        print("[bio] eat jwt native: %s" % native.get("error"), flush=True)
        return native

    try:
        converted = eat_to_access(session["eat"])
    except ValueError as exc:
        return _fail_result(str(exc), bio, session, status=401, via="eat")
    except Exception as exc:
        return _fail_result("Garena callback недоступен: %s" % exc, bio, session, via="eat")

    session = dict(session)
    session["access"] = converted["access"]
    session["account_id"] = converted.get("account_id") or session.get("account_id")
    session["nickname"] = converted.get("nickname") or session.get("nickname")
    session["region"] = region_code(converted.get("region")) or session.get("region")
    result = _access_update(session, bio)
    result["account_id"] = result.get("account_id") or session.get("account_id")
    result["nickname"] = _pretty_nick(result.get("nickname"), session.get("nickname"))
    result["region"] = result.get("region") or session.get("region")
    if result.get("via") in (None, "access", "access-jwt"):
        result["via"] = "eat-" + str(result.get("via") or "access")
    return result


def _access_update(session, bio):
    try:
        info = jwt_from_access(session["access"])
        native = _native_update(_session_from_jwt_info(info, session.get("region")), bio)
        if native.get("ok"):
            native["via"] = "access-jwt"
            return native
        print("[bio] native jwt: %s" % native.get("error"), flush=True)
        return native
    except Exception as exc:
        print("[bio] jwt_from_access: %s" % exc, flush=True)
        return _fail_result(str(exc), bio, session, via="access")


def _uid_update(uid, password, bio, region=None):
    session = {
        "kind": "uid",
        "account_id": uid,
        "nickname": "",
        "region": region_code(region),
        "base": client_base(region),
        "release_version": None,
    }
    try:
        info = jwt_from_uid(uid, password)
        native = _native_update(_session_from_jwt_info(info, region), bio)
        if native.get("ok"):
            native["via"] = "uid-jwt"
            native["account_id"] = native.get("account_id") or uid
            return native
        return native
    except Exception as exc:
        return _fail_result(str(exc), bio, session, via="uid")


def _jwt_update(session, bio):
    return _native_update(session, bio)


def update_bio(raw_token, bio, region=None, kind=None, uid=None, password=None, server_url=None):
    bio = bio or ""
    if not bio.strip():
        raise ValueError("Bio пустой")
    if len(bio) > BIO_MAX:
        raise ValueError("Bio длиннее %s символов" % BIO_MAX)

    kind = (kind or "").strip().lower() or None
    if kind == "uid" or (uid and password):
        if not uid or not password:
            raise ValueError("Нужны UID и пароль")
        return _uid_update(str(uid).strip(), str(password).strip(), bio, region)

    session = session_from_token(raw_token, region, kind=kind)
    if server_url:
        session["server_url"] = str(server_url).strip().rstrip("/")
        session["base"] = client_base(session.get("region"), session["server_url"])
    if session.get("kind") == "access":
        return _access_update(session, bio)
    if session.get("kind") == "eat":
        return _eat_update(session, bio)
    return _jwt_update(session, bio)
