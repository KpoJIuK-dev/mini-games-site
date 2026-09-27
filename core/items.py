import json
import re
from pathlib import Path

_CATALOG = Path(__file__).resolve().parent.parent / "itemsData_OB55.json"
_ICON = "https://cdn.jsdelivr.net/gh/ShahGCreator/icon@main/PNG/{item_id}.png"
_SLOT = re.compile(r"\(([^)]+)\)\s*$")
_INDEX = None

_PHRASES = {
    "laggy": "Лаги",
    "t-pose": "Т-поза",
    "treasure rain": "Дождь сокровищ",
    "gloo wall": "Глу-стена",
    "loot box": "Лутбокс",
}

_SLOTS = {
    "top": "верх",
    "bottom": "низ",
    "shoes": "обувь",
    "head": "голова",
    "mask": "маска",
    "facepaint": "грим",
}

_TYPES = {
    "box": "Коробка",
    "bundle": "Набор",
    "token": "Жетон",
    "crate": "Ящик",
    "banner": "Баннер",
    "avatar": "Аватар",
    "backpack": "Рюкзак",
    "skyboard": "Скайборд",
    "weapon": "Оружие",
    "parachute": "Парашют",
    "pack": "Набор",
    "badge": "Значок",
    "package": "Пакет",
    "gun": "Пушка",
    "pet": "Питомец",
    "voucher": "Ваучер",
    "skin": "Скин",
    "jersey": "Форма",
    "grenade": "Граната",
    "fragment": "Фрагмент",
    "card": "Карта",
    "mask": "Маска",
    "emote": "Эмоция",
    "wall": "Стена",
}

_WORDS = {
    "loot": "добыча",
    "ranked": "рейтинг",
    "heroic": "героический",
    "golden": "золотой",
    "gold": "золото",
    "red": "красный",
    "blue": "синий",
    "green": "зелёный",
    "pink": "розовый",
    "black": "чёрный",
    "purple": "фиолетовый",
    "silver": "серебряный",
    "platinum": "платиновый",
    "season": "сезон",
    "master": "мастер",
    "special": "особый",
    "choice": "выбор",
    "exclusive": "эксклюзив",
    "bunny": "кролик",
    "booyah": "буйя",
    "star": "звезда",
    "dragon": "дракон",
    "warrior": "воин",
    "shadow": "тень",
    "beast": "зверь",
    "airdrop": "аирдроп",
    "cyber": "кибер",
    "night": "ночь",
    "day": "день",
    "diamond": "алмаз",
    "skull": "череп",
    "hunter": "охотник",
    "fire": "огонь",
    "bat": "бита",
    "katana": "катана",
    "monster": "монстр",
    "deluxe": "делюкс",
    "street": "улица",
    "the": "",
    "of": "",
    "a": "",
    "cs": "CS",
    "br": "БР",
    "ffws": "FFWS",
    "permanent": "навсегда",
    "temporary": "временный",
    "rare": "редкий",
    "epic": "эпический",
    "legendary": "легендарный",
    "mythic": "мифический",
    "elite": "элитный",
    "royal": "королевский",
    "dark": "тёмный",
    "light": "светлый",
    "ice": "лёд",
    "flame": "пламя",
    "thunder": "гром",
    "storm": "шторм",
    "ocean": "океан",
    "desert": "пустыня",
    "forest": "лес",
    "urban": "город",
    "neon": "неон",
    "crystal": "кристалл",
    "crown": "корона",
    "king": "король",
    "queen": "королева",
    "wolf": "волк",
    "tiger": "тигр",
    "lion": "лев",
    "eagle": "орёл",
    "phoenix": "феникс",
    "demon": "демон",
    "angel": "ангел",
    "ghost": "призрак",
    "ninja": "ниндзя",
    "samurai": "самурай",
    "pirate": "пират",
    "robot": "робот",
    "mecha": "меха",
    "christmas": "рождество",
    "halloween": "хэллоуин",
    "summer": "лето",
    "winter": "зима",
    "spring": "весна",
    "autumn": "осень",
    "new": "новый",
    "old": "старый",
    "big": "большой",
    "mini": "мини",
    "super": "супер",
    "ultra": "ультра",
    "prime": "прайм",
    "pro": "про",
    "plus": "плюс",
    "pass": "пропуск",
    "level": "уровень",
    "reward": "награда",
    "gift": "подарок",
    "chest": "сундук",
    "key": "ключ",
    "ticket": "билет",
    "coupon": "купон",
    "coin": "монета",
    "coins": "монеты",
    "gem": "алмаз",
    "gems": "алмазы",
    "head": "голова",
    "hair": "волосы",
    "face": "лицо",
    "eyes": "глаза",
    "set": "комплект",
    "suit": "костюм",
    "outfit": "образ",
    "shirt": "рубашка",
    "pants": "штаны",
    "shorts": "шорты",
    "jacket": "куртка",
    "coat": "плащ",
    "hood": "капюшон",
    "hat": "шляпа",
    "cap": "кепка",
    "helmet": "шлем",
    "glasses": "очки",
    "scarf": "шарф",
    "gloves": "перчатки",
    "boots": "ботинки",
    "shoes": "обувь",
    "wings": "крылья",
    "tail": "хвост",
    "pose": "поза",
    "dance": "танец",
    "idle": "стойка",
    "victory": "победа",
    "defeat": "поражение",
    "treasure": "сокровище",
    "rain": "дождь",
    "male": "мужской",
    "female": "женский",
    "top": "верх",
    "bottom": "низ",
}


def _index():
    global _INDEX
    if _INDEX is None:
        names = {}
        with _CATALOG.open(encoding="utf-8") as handle:
            for item in json.load(handle):
                item_id = item.get("itemID")
                name = (item.get("name") or "").strip()
                if item_id and name:
                    names[int(item_id)] = name
        _INDEX = names
    return _INDEX


def _cap(word):
    if not word:
        return ""
    if word.isupper() or any(ch.isdigit() for ch in word):
        return word
    return word[:1].upper() + word[1:]


def translate_name(name):
    raw = (name or "").strip()
    if not raw:
        return ""
    slot = ""
    slot_match = _SLOT.search(raw)
    if slot_match:
        slot_key = slot_match.group(1).strip().lower()
        slot = _SLOTS.get(slot_key, slot_match.group(1).strip())
        raw = raw[: slot_match.start()].strip()
    phrase = _PHRASES.get(raw.lower())
    if phrase:
        titled = phrase
    else:
        parts = raw.replace(":", " ").split()
        kind = ""
        if len(parts) >= 2 and parts[-2].lower() == "loot" and parts[-1].lower() == "box":
            kind = _PHRASES["loot box"]
            parts = parts[:-2]
        elif parts and parts[-1].lower().rstrip(":") in _TYPES:
            kind = _TYPES[parts[-1].lower().rstrip(":")]
            parts = parts[:-1]
        words = []
        for part in parts:
            key = part.lower().strip(":,.")
            if key in _WORDS:
                mapped = _WORDS[key]
                if mapped:
                    words.append(_cap(mapped))
            elif part:
                words.append(part)
        body = " ".join(words).strip()
        titled = (kind + " " + body).strip() if kind else body
    if slot:
        titled = (titled + " (" + slot + ")").strip()
    return titled or name


def lookup_item(item_id):
    try:
        numeric = int(item_id)
    except (TypeError, ValueError):
        return None
    name = _index().get(numeric)
    if not name:
        return None
    return {
        "ok": True,
        "id": numeric,
        "name": name,
        "title": translate_name(name),
        "icon": _ICON.format(item_id=numeric),
    }
