import os
from collections import defaultdict, deque
from pathlib import Path
from time import time

from flask import Flask, jsonify, request, send_from_directory

from core.bio import update_bio
from core.config import RELEASE_VERSION

ARCADE = Path(__file__).resolve().parent / "arcade"
app = Flask(__name__)

_RATE = defaultdict(deque)
_RATE_WINDOW = 60
_RATE_LIMIT = 20


def rate_ok():
    forwarded = request.headers.get("X-Forwarded-For") or ""
    ip = forwarded.split(",")[0].strip() if forwarded else (request.remote_addr or "0")
    now = time()
    bucket = _RATE[ip]
    while bucket and now - bucket[0] > _RATE_WINDOW:
        bucket.popleft()
    if len(bucket) >= _RATE_LIMIT:
        return False
    bucket.append(now)
    return True


@app.post("/api/bio")
def api_bio():
    if not rate_ok():
        return jsonify({"ok": False, "error": "Слишком много запросов. Подожди минуту."}), 429
    data = request.get_json(silent=True) or {}
    token = data.get("token") or data.get("jwt") or data.get("access_token") or data.get("access") or data.get("eat") or ""
    bio = data.get("bio") or ""
    region = (data.get("region") or "").upper() or None
    kind = (data.get("kind") or "").lower() or None
    try:
        result = update_bio(
            token,
            bio,
            region,
            kind=kind,
            uid=data.get("uid"),
            password=data.get("password"),
            server_url=data.get("server_url") or data.get("server"),
        )
        if not result["ok"]:
            return jsonify(result), 502
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 502


@app.get("/health")
def health():
    return jsonify({"ok": True, "release": RELEASE_VERSION, "host": "panelss.garena.win"})


@app.get("/")
def index():
    return send_from_directory(ARCADE, "index.html")


@app.get("/<path:filename>")
def arcade_file(filename):
    root = ARCADE.resolve()
    target = (ARCADE / filename).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        return jsonify({"ok": False, "error": "Не найдено."}), 404
    if not target.is_file():
        return jsonify({"ok": False, "error": "Не найдено."}), 404
    return send_from_directory(ARCADE, filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8081"))
    app.run(host="0.0.0.0", port=port, debug=False)
