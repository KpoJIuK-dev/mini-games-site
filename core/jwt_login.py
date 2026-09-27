import os
import re
import time
from datetime import datetime

import requests
import urllib3
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from core.config import CLIENT_ID, CLIENT_SECRET, RELEASE_VERSION
from core.crypto import clean_jwt, decode_jwt, extract_jwt
from core.MjrLgn_pb2 import MajorLoginReq, MajorLoginRes

CLIENT_HOST_RE = re.compile(r"https://client(?:bp)?\.[a-z0-9._-]+", re.I)

AES_KEY = b"Yg&tc%DEuh6%Zc^8"
AES_IV = b"6oyZDr22E3ychjM%"
VERSION_URL = "https://version.ggwhitehawk.com/live/ver.php"
OAUTH_URL = "https://100067.connect.garena.com/oauth/guest/token/grant"
INSPECT_URL = "https://100067.connect.garena.com/oauth/token/inspect"
LOGIN_FALLBACK = "https://loginbp.ppmainecoonghj.com/"


def _enc(raw):
    return AES.new(AES_KEY, AES.MODE_CBC, AES_IV).encrypt(pad(raw, 16))


def _dec(raw):
    return unpad(AES.new(AES_KEY, AES.MODE_CBC, AES_IV).decrypt(raw), 16)


def version_cfg():
    try:
        resp = requests.get(
            VERSION_URL,
            params={
                "version": "1.132.3",
                "lang": "hi",
                "device": "android",
                "channel": "android",
                "appstore": "googleplay",
                "region": "IND",
                "whitelist_version": "1.3.0",
                "whitelist_sp_version": "1.0.0",
            },
            timeout=10,
        )
        data = resp.json()
        server = data.get("server_url")
        release = data.get("latest_release_version")
        client = data.get("remote_version") or data.get("play_version") or data.get("current_version")
        if server and release:
            return {
                "release": release,
                "client": client or "1.132.3",
                "server": server.rstrip("/") + "/",
            }
    except Exception:
        pass
    return {
        "release": RELEASE_VERSION,
        "client": "1.132.3",
        "server": LOGIN_FALLBACK,
    }


def inspect_access(token):
    try:
        resp = requests.get(
            INSPECT_URL,
            params={"token": token},
            headers={"User-Agent": "GarenaMSDK/4.0.19P4(G011A ;Android 9;en;US;)"},
            timeout=10,
        )
        data = resp.json() if resp.content else {}
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def oauth_guest(uid, password):
    resp = requests.post(
        OAUTH_URL,
        headers={
            "User-Agent": "GarenaMSDK/5.5.2P3(RMX3085;Android 15;en-US;IND;)",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={
            "uid": str(uid),
            "password": str(password),
            "response_type": "token",
            "client_type": "2",
            "client_secret": CLIENT_SECRET,
            "client_id": CLIENT_ID,
        },
        timeout=12,
    )
    data = resp.json() if resp.content else {}
    token = data.get("access_token")
    open_id = data.get("open_id")
    if not token or not open_id:
        raise RuntimeError(data.get("error") or data.get("message") or "OAuth не выдал токен")
    return {
        "access": token,
        "open_id": open_id,
        "platform": data.get("platform", 4),
    }


def _payload(open_id, access, platform, client_version):
    req = MajorLoginReq()
    req.event_time = str(datetime.now())[:-7]
    req.game_name = "free fire"
    req.platform_id = 2
    req.client_version = client_version
    req.client_version_code = "2024010012"
    req.system_software = "Android OS 11 / API-30"
    req.system_hardware = "Handheld"
    req.device_type = "Handheld"
    req.telecom_operator = "Verizon"
    req.network_operator_a = "Verizon"
    req.network_type = "WIFI"
    req.network_type_a = "WIFI"
    req.screen_width = 1080
    req.screen_height = 2400
    req.screen_dpi = "440"
    req.processor_details = "ARMv8"
    req.cpu_type = 2
    req.cpu_architecture = "64"
    req.memory = 6144
    req.gpu_renderer = "Adreno (TM) 650"
    req.gpu_version = "OpenGL ES 3.2"
    req.graphics_api = "OpenGLES3"
    req.unique_device_id = "Google|34a7dcdf-a7d5-4cb6-8d7e-3b0e448a0c57"
    req.language = "en"
    req.open_id = open_id
    req.open_id_type = str(platform)
    req.login_open_id_type = int(platform)
    req.access_token = access
    req.login_by = 3
    req.platform_sdk_id = 2
    req.origin_platform_type = str(platform)
    req.primary_platform_type = str(platform)
    req.external_storage_total = 128512
    req.external_storage_available = 45000
    req.internal_storage_total = 110731
    req.internal_storage_available = 25000
    req.game_disk_storage_total = 26628
    req.game_disk_storage_available = 20000
    req.external_sdcard_total_storage = 119234
    req.external_sdcard_avail_storage = 40000
    req.library_path = "/data/app/~~random/base.apk"
    req.library_token = "hash|base.apk"
    req.client_using_version = "7428b253defc164018c604a1ebbfebdf"
    req.supported_astc_bitset = 16383
    req.analytics_detail = b"FwQVTgUPX1UaUllDDwcWCRBpWAUOUgsvA1snWlBaO1kFYg=="
    req.loading_time = 12000
    req.release_channel = "android"
    req.channel_type = 3
    req.reg_avatar = 1
    req.if_push = 1
    req.is_vpn = 0
    req.android_engine_init_flag = 110009
    return _enc(req.SerializeToString())


def _rd_varint(buf, pos, end=None):
    if end is None:
        end = len(buf)
    value = 0
    shift = 0
    while pos < end:
        byte = buf[pos]
        pos += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, pos
        shift += 7
        if shift > 35:
            break
    raise ValueError("bad varint")


def _walk_proto(buf, pos=0, end=None):
    if end is None:
        end = len(buf)
    out = {}
    while pos < end:
        tag, pos = _rd_varint(buf, pos, end)
        field = tag >> 3
        wire = tag & 7
        if wire == 0:
            value, pos = _rd_varint(buf, pos, end)
            out.setdefault(field, []).append(value)
        elif wire == 2:
            length, pos = _rd_varint(buf, pos, end)
            if pos + length > end:
                break
            raw = buf[pos:pos + length]
            pos += length
            try:
                text = raw.decode("utf-8")
                if all(ch.isprintable() or ch in "\n\r\t" for ch in text):
                    out.setdefault(field, []).append(text)
                    continue
            except Exception:
                pass
            out.setdefault(field, []).append(raw)
        elif wire == 5:
            pos += 4
        elif wire == 1:
            pos += 8
        else:
            break
    return out


def _login_fields(raw):
    for i in range(0, max(0, len(raw) - 10)):
        if raw[i] not in (0x08, 0x12):
            continue
        try:
            tree = _walk_proto(raw, i)
        except Exception:
            continue
        token = ""
        for item in tree.get(8) or []:
            if isinstance(item, str) and item.startswith("eyJ") and item.count(".") >= 2:
                token = item
                break
        if not token:
            continue
        uid = next((x for x in (tree.get(1) or []) if isinstance(x, int) and x > 100000000), None)
        region = next((x for x in (tree.get(2) or []) if isinstance(x, str) and x.isalpha()), "")
        url = next((x for x in (tree.get(10) or []) if isinstance(x, str) and x.startswith("http")), "")
        if uid or region:
            return token, uid, region, url
    return "", None, "", ""


def _jwt_by_len(raw):
    start = 0
    while True:
        idx = raw.find(b"eyJ", start)
        if idx < 0:
            return ""
        for n in range(1, 5):
            if idx - n < 0:
                continue
            try:
                length, pos = _rd_varint(raw, idx - n)
            except Exception:
                continue
            if pos != idx or length < 80 or idx + length > len(raw):
                continue
            token = raw[idx:idx + length]
            if token.count(b".") < 2:
                continue
            try:
                text = token.decode("ascii")
                decode_jwt(text)
                return text
            except Exception:
                continue
        start = idx + 1


def _server_from_login(raw):
    blobs = [raw]
    try:
        blobs.append(_dec(raw))
    except Exception:
        pass
    for blob in blobs:
        text = blob.decode("latin1", "replace")
        for url in CLIENT_HOST_RE.findall(text):
            host = url.split("/")[2].lower()
            if "loginbp" in host or "connect.garena" in host:
                continue
            return url.rstrip("/")
    return ""


def _jwt_result(jwt, extra=None):
    extra = extra or {}
    jwt = clean_jwt(jwt)
    payload = decode_jwt(jwt)
    return {
        "jwt": jwt,
        "account_id": extra.get("account_id") or payload.get("account_id"),
        "region": extra.get("region") or payload.get("lock_region") or payload.get("noti_region"),
        "server_url": extra.get("server_url") or payload.get("server_url") or payload.get("url"),
        "release_version": extra.get("release_version") or payload.get("release_version"),
    }


def _parse_login_body(raw):
    text = raw.decode("utf-8", "replace")
    if "SignError" in text:
        raise RuntimeError("MajorLogin SignError1")
    blobs = [raw]
    try:
        blobs.append(_dec(raw))
    except Exception:
        pass
    scanned = extract_jwt(raw.decode("latin1", "replace"))
    for blob in blobs:
        jwt, uid, region, url = _login_fields(blob)
        if jwt:
            if scanned and len(scanned) != len(jwt):
                print("[jwt] proto field8 len=%s scan len=%s" % (len(jwt), len(scanned)), flush=True)
            return _jwt_result(jwt, {
                "account_id": uid,
                "region": region,
                "server_url": url or _server_from_login(blob),
            })
        jwt = _jwt_by_len(blob)
        if jwt:
            return _jwt_result(jwt, {"server_url": _server_from_login(blob)})
        try:
            res = MajorLoginRes()
            res.ParseFromString(blob)
            if res.token:
                return _jwt_result(res.token, {
                    "account_id": res.account_id or None,
                    "region": res.region or None,
                    "server_url": res.url or _server_from_login(blob),
                })
        except Exception:
            pass
    jwt = scanned or extract_jwt(blobs[-1].decode("latin1", "replace"))
    if jwt:
        print("[jwt] fallback scan len=%s" % len(jwt), flush=True)
        return _jwt_result(jwt, {"server_url": _server_from_login(raw)})
    raise RuntimeError("MajorLogin не вернул JWT")


def major_login(open_id, access, platform=4):
    cfg = version_cfg()
    payload = _payload(open_id, access, platform, cfg["client"])
    headers = {
        "User-Agent": "UnityPlayer/2018.4.12f1 (UnityWebRequest/1.0, libcurl/8.5.0-DEV)",
        "Accept": "*/*",
        "Accept-Encoding": "deflate, gzip",
        "X-Ga-Sv": str(int(time.time())),
        "Authorization": "Bearer",
        "X-Ga": "v1 1",
        "Releaseversion": cfg["release"],
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Unity-Version": "2018.4.12f1",
    }
    resp = requests.post(
        cfg["server"].rstrip("/") + "/MajorLogin",
        headers=headers,
        data=payload,
        timeout=15,
        verify=False,
    )
    if resp.status_code != 200:
        body = (resp.content or b"")[:80]
        raise RuntimeError("MajorLogin HTTP %s %s" % (resp.status_code, body.decode("utf-8", "replace")))
    result = _parse_login_body(resp.content)
    result["release_version"] = cfg.get("release")
    if not result.get("server_url"):
        result["server_url"] = "https://clientbp.ppmainecoonghj.com"
    return result


def jwt_from_eat(eat):
    eat = (eat or "").strip()
    if not eat:
        raise RuntimeError("EAT пустой")
    from core.otrss import eat_to_access

    converted = eat_to_access(eat)
    access = converted.get("access")
    if not access:
        raise RuntimeError("OTRSS не отдал access")
    out = jwt_from_access(access)
    out["access"] = access
    out["account_id"] = out.get("account_id") or converted.get("account_id")
    out["region"] = out.get("region") or converted.get("region")
    return out


def jwt_from_access(access):
    info = inspect_access(access)
    open_id = info.get("open_id")
    if not open_id or info.get("error"):
        raise RuntimeError("inspect не нашёл open_id")
    return major_login(open_id, access, info.get("platform", 4))


def jwt_from_uid(uid, password):
    guest = oauth_guest(uid, password)
    try:
        return major_login(guest["open_id"], guest["access"], guest["platform"])
    except Exception:
        return jwt_from_access(guest["access"])
