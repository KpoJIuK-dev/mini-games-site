import base64
import json

from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

from core.config import AES_IV, AES_KEY, NICKNAME_XOR_KEY


def encrypt(data: bytes) -> bytes:
    cipher = AES.new(AES_KEY, AES.MODE_CBC, AES_IV)
    return cipher.encrypt(pad(data, AES.block_size))


def varint(value: int) -> bytes:
    if value < 0:
        raise ValueError("varint must be non-negative")
    out = bytearray()
    while True:
        bits = value & 0x7F
        value >>= 7
        out.append(bits | (0x80 if value else 0))
        if not value:
            break
    return bytes(out)


def tag(field: int, wire: int) -> bytes:
    return varint((field << 3) | wire)


def encode_string(text: str) -> bytes:
    raw = text.encode("utf-8")
    return varint(len(raw)) + raw


def encode_bio(bio: str, style: int = 17) -> bytes:
    body = bytearray()
    body += tag(2, 0) + varint(style)
    body += tag(5, 2) + varint(0)
    body += tag(6, 2) + varint(0)
    body += tag(8, 2) + encode_string(bio)
    body += tag(9, 0) + varint(1)
    body += tag(11, 2) + varint(0)
    body += tag(12, 2) + varint(0)
    return bytes(body)


def b64url_decode(chunk: str) -> bytes:
    pad_len = (-len(chunk)) % 4
    return base64.urlsafe_b64decode(chunk + ("=" * pad_len))


def decode_nickname(encoded: str) -> str:
    try:
        raw = base64.b64decode(encoded, validate=False)
        if len(raw) < 2:
            return encoded
        dec = bytes(b ^ NICKNAME_XOR_KEY[i % len(NICKNAME_XOR_KEY)] for i, b in enumerate(raw))
        text = dec.decode("utf-8")
        if not text or any(ord(ch) < 32 for ch in text):
            return encoded
        return text
    except Exception:
        return encoded


def clean_jwt(token: str) -> str:
    text = (token or "").strip()
    if text.lower().startswith("bearer "):
        text = text[7:].strip()
    parts = text.split(".")
    if len(parts) < 3:
        return text
    header, payload, sig = parts[0], parts[1], "".join(parts[2:])
    try:
        hdr = json.loads(b64url_decode(header).decode("utf-8"))
    except Exception:
        hdr = {}
    want = {"HS256": 43, "HS384": 64, "HS512": 86}.get(str(hdr.get("alg") or "HS256").upper())
    if want and len(sig) > want:
        sig = sig[:want]
    return "%s.%s.%s" % (header, payload, sig)


def extract_jwt(raw: str) -> str:
    text = (raw or "").strip()
    if text.lower().startswith("bearer "):
        text = text[7:].strip()
    idx = text.find("eyJ")
    if idx >= 0:
        end = idx
        alphabet = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.")
        while end < len(text) and text[end] in alphabet:
            end += 1
        token = text[idx:end]
        if token.count(".") >= 2:
            return clean_jwt(token)
    if "://" in text or text.lower().startswith("http"):
        return ""
    if text.count(".") >= 2 and "eat=" not in text:
        return clean_jwt(text)
    return ""


def decode_jwt(token: str) -> dict:
    parts = token.split(".")
    if len(parts) < 2:
        raise ValueError("Это не JWT")
    payload = json.loads(b64url_decode(parts[1]).decode("utf-8"))
    nick = payload.get("nickname")
    if isinstance(nick, str) and nick:
        payload["nickname_decoded"] = decode_nickname(nick)
    return payload
