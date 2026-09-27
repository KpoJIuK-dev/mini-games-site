import os

AES_KEY = b"Yg&tc%DEuh6%Zc^8"
AES_IV = b"6oyZDr22E3ychjM%"

RELEASE_VERSION = os.getenv("FF_OB", "OB55")
DEFAULT_CLIENT = os.getenv("FF_CLIENT_ETC", "https://clientbp.ggpolarbear.com").rstrip("/")
USER_AGENT = "Dalvik/2.1.0 (Linux; U; Android 13; SM-S908E Build/TP1A.220624.014)"
CLIENT_ID = "100067"
CLIENT_SECRET = "2ee44819e9b4598845141067b281621874d0d5d7af9d8f7e00c1e54715b7d1e3"
UNITY = "2018.4.11f1"
NICKNAME_XOR_KEY = b"1e5898ccb8dfdd921f9bdea848768b64a201"


OAUTH_REDIRECT = (
    "https://api.ff.garena.co.id/auth/auth/callback_n"
    "?site=https://api-discountstore.kiosgamer.gameid.garena.co.id/oauth/callback_redirect/"
)
OAUTH_PROVIDERS = [
    {"id": "google", "name": "Google", "platform": "8"},
    {"id": "facebook", "name": "Facebook", "platform": "3"},
    {"id": "apple", "name": "Apple", "platform": "10"},
    {"id": "x", "name": "X", "platform": "11"},
    {"id": "vk", "name": "VK", "platform": "5"},
]

IND_CLIENT = "https://client.ind.freefiremobile.com"
US_CLIENT = "https://client.us.freefiremobile.com"
ME_CLIENT = "https://clientbp.common.ggbluefox.com"
RU_CLIENT = "https://clientbp.ggpolarbear.com"

REGION_CLIENT = {
    "IND": IND_CLIENT,
    "IN": IND_CLIENT,
    "BR": US_CLIENT,
    "NA": US_CLIENT,
    "SAC": US_CLIENT,
    "US": US_CLIENT,
    "ME": ME_CLIENT,
    "TH": ME_CLIENT,
    "RU": RU_CLIENT,
    "CIS": RU_CLIENT,
    "EU": RU_CLIENT,
}

DEAD_CLIENT_HOSTS = {
    "client.ru.freefiremobile.com",
    "client.cis.freefiremobile.com",
    "client.freefiremobile.com",
}

REGIONS = [
    "IND", "BR", "NA", "SG", "RU", "CIS", "BD", "EU", "TH", "ME", "ID", "VN", "PK", "TW", "SAC",
]


def region_code(region):
    region = (region or "").upper()
    if region in ("IN",):
        return "IND"
    if region == "CIS":
        return "RU"
    return region


def _host_of(url):
    text = (url or "").strip().rstrip("/")
    if "://" in text:
        return text.split("/")[2].lower()
    return text.lower()


def client_base(region=None, server_url=None):
    region = region_code(region)
    mapped = REGION_CLIENT.get(region, DEFAULT_CLIENT) if region else DEFAULT_CLIENT
    if server_url:
        host = _host_of(server_url)
        if host in DEAD_CLIENT_HOSTS or host.startswith("client.ru.") or host.startswith("client.cis."):
            return mapped
        if "loginbp" not in host and "connect.garena" not in host:
            return server_url.rstrip("/")
    return mapped


def oauth_login_url(platform):
    return (
        "https://auth.garena.com/universal/oauth"
        "?platform=%s&response_type=code&locale=en-SG&client_id=%s&redirect_uri=%s"
        % (platform, CLIENT_ID, OAUTH_REDIRECT)
    )


def game_headers(token, release=None):
    return {
        "User-Agent": USER_AGENT,
        "Connection": "Keep-Alive",
        "Accept-Encoding": "gzip",
        "Content-Type": "application/octet-stream",
        "X-Unity-Version": UNITY,
        "X-GA": "v1 1",
        "ReleaseVersion": release or RELEASE_VERSION,
        "Authorization": "Bearer " + token,
    }
