(function () {
  "use strict";

  var KEY = "ff-arcade-v1";
  var REGEN_MS = 8 * 60 * 1000;
  var ENERGY_MAX = 5;
  var ENERGY_CAP = 8;
  var app = document.getElementById("app");
  var active = new AbortController();
  var state = fresh();

  var PETS = [
    { name: "AgentHop", img: "assets/pets/AgentHop.webp" },
    { name: "Arvon", img: "assets/pets/Arvon.webp" },
    { name: "Beaston", img: "assets/pets/Beaston.webp" },
    { name: "DetectivePanda", img: "assets/pets/DetectivePanda.webp" },
    { name: "Dr.Beanie", img: "assets/pets/Dr.Beanie.webp" },
    { name: "Dreki", img: "assets/pets/Dreki.webp" },
    { name: "Falco", img: "assets/pets/Falco.webp" },
    { name: "Fang", img: "assets/pets/Fang.webp" }
  ];

  var PRIZES = [
    { title: "+40 алмазов", img: "assets/img/diamond.png", weight: 26, kind: "gems", amount: 40 },
    { title: "+90 алмазов", img: "assets/img/diamond.png", weight: 18, kind: "gems", amount: 90 },
    { title: "+180 алмазов", img: "assets/img/diamond.png", weight: 10, kind: "gems", amount: 180 },
    { title: "+350 алмазов", img: "assets/img/diamond.png", weight: 4, kind: "gems", amount: 350 },
    { title: "Шанс", img: "assets/img/crystal.png", weight: 24, kind: "chance", amount: 1 },
    { title: "Двойной шанс", img: "assets/img/crystal.png", weight: 12, kind: "chance", amount: 2 },
    { title: "Ещё шанс", img: "assets/img/crystal.png", weight: 6, kind: "chance", amount: 1 }
  ];
  var DROP_KEY = "ff-arcade-drop";
  var dropOffer = null;

  var BADGES = {
    firstCash: "Первый кэшаут",
    deep: "Глубокая шахта",
    clear: "Все пары",
    combo: "Комбо 25",
    jack: "Купон джекпота"
  };

  function fresh() {
    return {
      diamonds: 0,
      coins: 0,
      earned: 0,
      coinMark: 0,
      energy: ENERGY_MAX,
      energyMax: ENERGY_MAX,
      energyAt: Date.now(),
      streak: 0,
      lastClaim: "",
      xp: 0,
      buffs: { double: 0, lucky: 0 },
      stats: { cashes: 0, busts: 0, pairs: 0, spins: 0 },
      best: { field: 0, pairs: 0, combo: 0, spin: 0 },
      badges: {},
      welcomed: false,
      withdrawals: []
    };
  }

  function clamp(value, min, max, fallback) {
    var n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
  }

  function load() {
    var next = fresh();
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!raw || typeof raw !== "object") return next;
      next.diamonds = clamp(raw.diamonds, 0, 9999999, 0);
      next.coins = clamp(raw.coins, 0, 9999999, 0);
      next.earned = clamp(raw.earned, 0, 9999999, 0);
      next.coinMark = clamp(raw.coinMark, 0, 999999, 0);
      next.energy = clamp(raw.energy, 0, ENERGY_CAP, ENERGY_MAX);
      next.energyAt = clamp(raw.energyAt, 0, Date.now() + REGEN_MS, Date.now());
      next.streak = clamp(raw.streak, 0, 999, 0);
      next.lastClaim = typeof raw.lastClaim === "string" ? raw.lastClaim : "";
      next.xp = clamp(raw.xp, 0, 9999999, 0);
      next.welcomed = Boolean(raw.welcomed);
      if (raw.buffs) {
        next.buffs.double = clamp(raw.buffs.double, 0, 9, 0);
        next.buffs.lucky = clamp(raw.buffs.lucky, 0, 9, 0);
      }
      if (raw.stats) {
        next.stats.cashes = clamp(raw.stats.cashes, 0, 999999, 0);
        next.stats.busts = clamp(raw.stats.busts, 0, 999999, 0);
        next.stats.pairs = clamp(raw.stats.pairs, 0, 999999, 0);
        next.stats.spins = clamp(raw.stats.spins, 0, 999999, 0);
      }
      if (raw.best) {
        next.best.field = clamp(raw.best.field, 0, 9999999, 0);
        next.best.pairs = clamp(raw.best.pairs, 0, 9999999, 0);
        next.best.combo = clamp(raw.best.combo, 0, 999999, 0);
        next.best.spin = clamp(raw.best.spin, 0, 9999999, 0);
      }
      if (raw.badges && typeof raw.badges === "object") {
        Object.keys(BADGES).forEach(function (id) {
          if (raw.badges[id]) next.badges[id] = true;
        });
      }
      if (Array.isArray(raw.withdrawals)) {
        next.withdrawals = raw.withdrawals.slice(-20).map(function (item) {
          return {
            amount: clamp(item && item.amount, 0, 9999999, 0),
            at: clamp(item && item.at, 0, Date.now() + 86400000, 0),
            uid: String((item && item.uid) || "").replace(/\D/g, "").slice(0, 20)
          };
        });
      }
    } catch (err) {
      return fresh();
    }
    return next;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      /* private mode */
    }
  }

  function dayKey(offset) {
    var d = new Date();
    d.setDate(d.getDate() + offset);
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function levelState(xp) {
    var level = 1;
    var rest = xp;
    var need = 120;
    while (rest >= need && level < 40) {
      rest -= need;
      level += 1;
      need = 120 + (level - 1) * 40;
    }
    return { level: level, rest: rest, need: need };
  }

  function addXp(amount) {
    var before = levelState(state.xp).level;
    state.xp += amount;
    var after = levelState(state.xp);
    if (after.level > before) {
      var bonus = 40 * after.level;
      state.diamonds += bonus;
      toast("Уровень " + after.level + ". +" + bonus + " алмазов");
    }
  }

  function syncEnergy() {
    if (state.energy >= state.energyMax) {
      state.energyAt = Date.now();
      return;
    }
    var gained = Math.floor((Date.now() - state.energyAt) / REGEN_MS);
    if (gained <= 0) return;
    state.energy = Math.min(state.energyMax, state.energy + gained);
    state.energyAt += gained * REGEN_MS;
    if (state.energy >= state.energyMax) state.energyAt = Date.now();
    save();
  }

  function refundEnergy() {
    state.energy = Math.min(ENERGY_CAP, state.energy + 1);
    if (state.energy >= state.energyMax) state.energyAt = Date.now();
    save();
  }

  function spendEnergy() {
    syncEnergy();
    if (state.energy < 1) {
      toast("Нет энергии. Лавка или таймер.");
      return false;
    }
    var wasFull = state.energy >= state.energyMax;
    state.energy -= 1;
    if (wasFull && state.energy < state.energyMax) state.energyAt = Date.now();
    save();
    return true;
  }

  function regenLabel() {
    if (state.energy >= state.energyMax) return "полная";
    var left = Math.max(0, REGEN_MS - (Date.now() - state.energyAt));
    var total = Math.ceil(left / 1000);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return "+1 через " + m + ":" + String(s).padStart(2, "0");
  }

  function payout(base, useDouble, series) {
    var notes = [];
    var amount = Math.round(base);
    if (series) {
      amount = Math.round(amount * 1.25);
      notes.push("чистая серия +25%");
    }
    if (useDouble && state.buffs.double > 0) {
      state.buffs.double -= 1;
      amount *= 2;
      notes.push("удвоение ×2");
    }
    state.diamonds += amount;
    addXp(Math.max(10, Math.round(amount / 12)));
    return { amount: amount, notes: notes };
  }

  function unlock(id) {
    if (state.badges[id] || !BADGES[id]) return;
    state.badges[id] = true;
    toast("Знак: " + BADGES[id]);
  }

  function toast(message) {
    var box = document.getElementById("toasts");
    var el = document.createElement("p");
    el.className = "toast";
    el.textContent = message;
    box.appendChild(el);
    setTimeout(function () { el.classList.add("show"); }, 20);
    setTimeout(function () { el.remove(); }, 2800);
  }

  function closeModal() {
    var modal = document.getElementById("modal");
    modal.hidden = true;
    modal.innerHTML = "";
  }

  function enter(run) {
    active.abort();
    closeModal();
    active = new AbortController();
    run(active.signal);
    paintWallet();
  }

  function shuffle(list) {
    var arr = list.slice();
    var i = arr.length;
    while (i > 1) {
      var j = Math.floor(Math.random() * i);
      i -= 1;
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function walletHtml() {
    var lv = levelState(state.xp);
    var width = Math.max(0, Math.min(100, (lv.rest / lv.need) * 100));
    return (
      '<section class="wallet" aria-label="Копилка">' +
      '<div class="wallet__row"><span>Алмазы <b id="w-diamonds">' + state.diamonds + "</b></span>" +
      '<span>Монеты <b id="w-coins">' + state.coins + "</b></span>" +
      '<span>Энергия <b id="w-energy">' + state.energy + "/" + state.energyMax + "</b></span></div>" +
      '<div class="wallet__row"><span class="muted">Уровень <b id="w-level">' + lv.level + "</b></span>" +
      '<span class="muted" id="w-regen">' + regenLabel() + "</span></div>" +
      '<div class="xp" aria-hidden="true"><span id="w-xp" style="width:' + width + '%"></span></div>' +
      '<button type="button" class="cta gold" data-act="withdraw">Вывести алмазы</button>' +
      "</section>"
    );
  }

  function paintWallet() {
    syncEnergy();
    var diamonds = document.getElementById("w-diamonds");
    if (!diamonds) return;
    var lv = levelState(state.xp);
    diamonds.textContent = String(state.diamonds);
    document.getElementById("w-coins").textContent = String(state.coins);
    document.getElementById("w-energy").textContent = state.energy + "/" + state.energyMax;
    document.getElementById("w-regen").textContent = regenLabel();
    document.getElementById("w-level").textContent = String(lv.level);
    document.getElementById("w-xp").style.width = Math.max(0, Math.min(100, (lv.rest / lv.need) * 100)) + "%";
  }

  function nextDaily() {
    if (state.lastClaim === dayKey(0)) return state.streak;
    if (state.lastClaim === dayKey(-1)) return state.streak + 1;
    return 1;
  }

  function showLobby() {
    enter(function (signal) {
      var claimed = state.lastClaim === dayKey(0);
      var daily = 100 + nextDaily() * 30;
      var chips = [];
      if (state.buffs.double) chips.push("Удвоение ×" + state.buffs.double);
      if (state.buffs.lucky) chips.push("Щит удачи ×" + state.buffs.lucky);
      if (state.streak) chips.push("Серия " + state.streak + " дн.");
      Object.keys(BADGES).forEach(function (id) {
        if (state.badges[id]) chips.push(BADGES[id]);
      });
      app.innerHTML =
        walletHtml() +
        '<p class="demo-tag">Демо в браузере</p>' +
        '<h1 class="main__title">Награда за заход</h1>' +
        '<p class="lede">Игры крутятся локально. Вывод алмазов открывается после входа и недели с промо в подписи.</p>' +
        '<div class="stack">' +
        '<button type="button" class="cta gold" data-act="daily"' + (claimed ? " disabled" : "") + ">" +
        (claimed ? "Серия забрана" : "Ежедневка +" + daily) +
        "</button>" +
        card("field", "1 энергия", "Алмазное поле", "25 клеток, 5 мин. Забирай банк, пока не открыл мину.", "Рекорд " + state.best.field) +
        card("pairs", "1 энергия", "Найди пару", "6 пар питомцев, 70 секунд. Закрытие поля платит сверху.", "Рекорд " + state.best.pairs) +
        card("clicker", "бесплатно", "Кликер", "Комбо растит монету. Каждые 100 монет — сундук. Обмен: 100 → 1 алмаз.", "Комбо " + state.best.combo) +
        card("roulette", "1 энергия", "Рулетка", "Полоса призов: алмазы и шансы.", "Рекорд " + state.best.spin) +
        "</div>" +
        '<section class="panel"><h2 class="home-panel__title">Лавка</h2>' +
        '<div class="shop">' +
        shop("energy", "Энергия +1", "250") +
        shop("double", "Удвоение", "400") +
        shop("lucky", "Щит удачи", "300") +
        "</div></section>" +
        '<section class="panel"><h2 class="home-panel__title">Как платит зал</h2><ul>' +
        "<li>Мина сжигает только банк захода. Копилка остаётся.</li>" +
        "<li>6 безопасных клеток на поле: +25% к кэшауту.</li>" +
        "<li>Щит снимает одну мину до старта поля.</li>" +
        "<li>Удвоение садится на кэшаут, пары и алмазы рулетки.</li>" +
        "<li>Энергия +1 каждые 8 минут, потолок " + ENERGY_MAX + ". Лавка поднимает до " + ENERGY_CAP + ".</li>" +
        "</ul>" +
        (chips.length ? '<div class="chips">' + chips.map(function (c) { return '<span class="chip">' + c + "</span>"; }).join("") + "</div>" : "") +
        "</section>";

      app.addEventListener("click", function (e) {
        var dailyBtn = e.target.closest("[data-act=daily]");
        var go = e.target.closest("[data-go]");
        var buy = e.target.closest("[data-buy]");
        if (dailyBtn) claimDaily();
        if (go) startGame(go.getAttribute("data-go"));
        if (buy) buyItem(buy.getAttribute("data-buy"));
      }, { signal: signal });
    });
  }

  function card(id, kicker, name, text, best) {
    return (
      '<button type="button" class="game-card" data-go="' + id + '">' +
      '<span class="game-card__kicker">' + kicker + "</span>" +
      '<span class="game-card__name">' + name + "</span>" +
      '<span class="game-card__text">' + text + "</span>" +
      '<span class="game-card__best">' + best + "</span></button>"
    );
  }

  function shop(id, name, cost) {
    return (
      '<button type="button" class="shop-card" data-buy="' + id + '"><b>' + name + "</b><span>" + cost + " алмазов</span></button>"
    );
  }

  function claimDaily() {
    if (state.lastClaim === dayKey(0)) {
      toast("Сегодня уже забрал");
      return;
    }
    state.streak = state.lastClaim === dayKey(-1) ? state.streak + 1 : 1;
    state.lastClaim = dayKey(0);
    var amount = 100 + state.streak * 30;
    state.diamonds += amount;
    addXp(20);
    save();
    toast("Серия " + state.streak + " дн. +" + amount);
    showLobby();
  }

  function buyItem(id) {
    var cost = id === "energy" ? 250 : id === "double" ? 400 : 300;
    if (state.diamonds < cost) {
      toast("Не хватает алмазов");
      return;
    }
    if (id === "energy" && state.energy >= ENERGY_CAP) {
      toast("Энергия на потолке");
      return;
    }
    if (id === "double" && state.buffs.double >= 5) {
      toast("Удвоений и так пачка");
      return;
    }
    if (id === "lucky" && state.buffs.lucky >= 5) {
      toast("Щитов и так пачка");
      return;
    }
    state.diamonds -= cost;
    if (id === "energy") state.energy += 1;
    if (id === "double") state.buffs.double += 1;
    if (id === "lucky") state.buffs.lucky += 1;
    save();
    toast("Взял из лавки");
    showLobby();
  }

  function startGame(id) {
    if (id === "field") enter(playField);
    else if (id === "pairs") enter(playPairs);
    else if (id === "clicker") enter(playClicker);
    else if (id === "roulette") enter(playRoulette);
  }

  function frame(title, body) {
    return walletHtml() +
      '<div class="gamebar"><button type="button" class="back" data-act="back">Назад</button>' +
      '<h1 class="main__title">' + title + "</h1></div>" + body;
  }

  function withdrawModal(title, lead, extra) {
    return (
      '<div class="modal-back" data-act="close"></div>' +
      '<div class="modal-card" role="dialog" aria-modal="true" aria-label="' + title + '">' +
      '<p class="eyebrow">' + title + "</p>" +
      "<p>" + lead + "</p>" +
      (extra || "") +
      "</div>"
    );
  }

  function openWithdraw() {
    var session = window.FFAccount ? FFAccount.load() : null;
    function show(view) {
      var body;
      var actions;
      if (!view || view.code === "guest") {
        body = "Браузерная версия — демо. Алмазы лежат только здесь. Чтобы вывести их, нужно войти в аккаунт.";
        actions = '<div class="row"><button type="button" class="cta" data-act="close">Закрыть</button><a class="cta gold" href="login.html">Войти</a></div>';
      } else if (view.code === "consent" || view.code === "missing") {
        body = "Вывод закрыт. В подписи профиля должен быть " + FFAccount.PROMO + ", с согласия владельца, и простоять там семь дней без перерыва.";
        actions = '<div class="row"><button type="button" class="cta" data-act="close">Закрыть</button><a class="cta gold" href="login.html">К аккаунту</a></div>';
      } else if (view.code === "holding") {
        body = (FFAccount.decodeNick(view.session.nickname) || "Аккаунт").replace(/[&<>]/g, "") + ": промо на месте. До вывода осталось " + FFAccount.formatLeft(view.left) + ".";
        actions = '<div class="row"><button type="button" class="cta" data-act="close">Закрыть</button></div>';
      } else {
        body = "Семь дней прошли, " + FFAccount.PROMO + " всё ещё в подписи. Можно забрать " + state.diamonds + " алмазов из демо-копилки.";
        actions = '<div class="row"><button type="button" class="cta" data-act="close">Закрыть</button><button type="button" class="cta gold" data-act="claim">Вывести</button></div>';
      }
      openModal(withdrawModal(view && view.code === "guest" ? "Нужен вход" : "Вывод", body, actions), active.signal, function (e) {
        if (e.target.closest("[data-act=close]")) closeModal();
        if (e.target.closest("[data-act=claim]")) claimWithdraw();
      });
    }
    if (!session) {
      show({ code: "guest" });
      return;
    }
    show(FFAccount.status(session));
    FFAccount.refresh().then(function (next) {
      show(FFAccount.status(next));
    }).catch(function () {
      show(FFAccount.status(FFAccount.load()));
    });
  }

  function claimWithdraw() {
    var view = FFAccount.status(FFAccount.load());
    if (!view || view.code !== "ready") return;
    if (state.diamonds < 1) {
      closeModal();
      toast("В копилке пусто");
      return;
    }
    var amount = state.diamonds;
    state.diamonds = 0;
    state.withdrawals.push({ amount: amount, at: Date.now(), uid: view.session.uid });
    save();
    closeModal();
    paintWallet();
    toast("Заявка на " + amount + " алмазов");
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-act=withdraw]")) openWithdraw();
  });

  function openModal(html, signal, onClick) {
    var modal = document.getElementById("modal");
    var next = modal.cloneNode(false);
    modal.replaceWith(next);
    next.id = "modal";
    next.hidden = false;
    next.innerHTML = html;
    next.addEventListener("click", onClick, { signal: signal });
  }

  function resultHtml(title, lead, amount, notes, again) {
    var list = (notes || []).map(function (n) { return "<li>" + n + "</li>"; }).join("");
    return (
      '<div class="modal-back"></div><div class="modal-card" role="dialog" aria-modal="true" aria-label="' + title + '">' +
      '<p class="eyebrow">' + title + "</p>" +
      (amount ? '<strong class="big">+' + amount + "</strong>" : "") +
      (lead ? "<p>" + lead + "</p>" : "") +
      (list ? "<ul>" + list + "</ul>" : "") +
      '<div class="row"><button type="button" class="cta" data-act="lobby">В зал</button>' +
      (again ? '<button type="button" class="cta gold" data-act="again" data-game="' + again + '">Ещё раз</button>' : "") +
      "</div></div>"
    );
  }

  function playField(signal) {
    if (!spendEnergy()) {
      showLobby();
      return;
    }
    var types = [];
    var i;
    for (i = 0; i < 5; i += 1) types.push("mine");
    while (types.length < 25) types.push("safe");
    types = shuffle(types);
    var shield = "";
    var shieldUsed = false;
    if (state.buffs.lucky > 0) {
      var mineAt = types.indexOf("mine");
      if (mineAt >= 0) {
        types[mineAt] = "safe";
        state.buffs.lucky -= 1;
        shieldUsed = true;
        shield = "Щит удачи снял одну мину.";
        save();
      }
    }
    var cells = types.map(function (type) { return { type: type, open: false }; });
    var pot = 0;
    var opened = 0;
    var ended = false;

    app.innerHTML = frame("Алмазное поле", '<div id="stage"></div>');
    var stage = document.getElementById("stage");

    function minesHidden() {
      return cells.filter(function (c) { return c.type === "mine" && !c.open; }).length;
    }

    function draw(shake) {
      var buttons = cells.map(function (cell, index) {
        var cls = "cell" + (cell.open ? " open " + cell.type : "");
        var img = "";
        if (cell.open) {
          img = '<img src="assets/img/' + (cell.type === "mine" ? "mine" : "diamond") + '.png" alt="' + (cell.type === "mine" ? "Мина" : "Алмаз") + '">';
        }
        return '<button type="button" class="' + cls + '" data-i="' + index + '"' + (cell.open ? " disabled" : "") + ">" + img + "</button>";
      }).join("");
      stage.innerHTML =
        '<p class="hint">' + (shield || "Мина сжигает банк захода. Копилка не трогается.") + "</p>" +
        '<div class="statrow"><span>Банк <b id="pot">' + pot + "</b></span><span>Мины <b>" + minesHidden() + "</b></span></div>" +
        '<div class="field' + (shake ? " shake" : "") + '">' + buttons + "</div>" +
        '<div class="row"><button type="button" class="cta gold" data-act="cash"' + (pot < 1 || ended ? " disabled" : "") + ">Забрать " + pot + "</button></div>";
    }

    function settle(series) {
      var result = payout(pot, true, series);
      state.stats.cashes += 1;
      if (result.amount > state.best.field) state.best.field = result.amount;
      unlock("firstCash");
      if (opened >= 10) unlock("deep");
      save();
      openModal(
        resultHtml("Банк забран", "В копилке уже с бонусами.", result.amount, result.notes, "field"),
        signal,
        onResult("field")
      );
    }

    draw(false);

    app.addEventListener("click", function (e) {
      if (e.target.closest("[data-act=back]")) {
        if (ended) return;
        if (opened === 0) {
          if (shieldUsed) state.buffs.lucky += 1;
          refundEnergy();
          showLobby();
          return;
        }
        ended = true;
        settle(opened >= 6);
        return;
      }
      if (e.target.closest("[data-act=cash]")) {
        if (ended || pot < 1) return;
        ended = true;
        settle(opened >= 6);
        return;
      }
      var btn = e.target.closest("[data-i]");
      if (!btn || ended) return;
      var index = Number(btn.getAttribute("data-i"));
      var cell = cells[index];
      if (!cell || cell.open) return;
      cell.open = true;
      if (cell.type === "mine") {
        ended = true;
        cells.forEach(function (item) {
          if (item.type === "mine") item.open = true;
        });
        pot = 0;
        state.stats.busts += 1;
        addXp(8);
        save();
        draw(true);
        openModal(
          resultHtml("Мина", "Банк захода сгорел. Копилка на месте.", 0, [], "field"),
          signal,
          onResult("field")
        );
        return;
      }
      pot += 50 + Math.floor(Math.random() * 151);
      opened += 1;
      draw(false);
    }, { signal: signal });
  }

  function onResult(game) {
    return function (e) {
      if (e.target.closest("[data-act=lobby]")) showLobby();
      var again = e.target.closest("[data-act=again]");
      if (again) startGame(again.getAttribute("data-game") || game);
    };
  }

  function playPairs(signal) {
    if (!spendEnergy()) {
      showLobby();
      return;
    }
    var picked = shuffle(PETS).slice(0, 6);
    var deck = shuffle(picked.concat(picked)).map(function (pet) {
      return { name: pet.name, img: pet.img, up: false, matched: false };
    });
    var first = null;
    var lock = false;
    var matched = 0;
    var left = 70;
    var started = false;
    var ended = false;
    var timer = 0;

    app.innerHTML = frame("Найди пару", '<div id="stage"></div>');
    var stage = document.getElementById("stage");

    function clock() {
      var s = left % 60;
      return Math.floor(left / 60) + ":" + String(s).padStart(2, "0");
    }

    function paint() {
      var cards = deck.map(function (card, index) {
        var cls = "mem" + (card.up || card.matched ? " flipped" : "") + (card.matched ? " matched" : "");
        return (
          '<button type="button" class="' + cls + '" data-i="' + index + '"' + (card.matched ? " disabled" : "") + ">" +
          '<span class="flip"><span class="face back"><img src="assets/img/caselock.webp" alt=""></span>' +
          '<span class="face front"><img src="' + card.img + '" alt="' + card.name + '"></span></span></button>'
        );
      }).join("");
      stage.innerHTML =
        '<p class="hint">Пара +100. Все шесть пар: +400 и +5 за каждую секунду.</p>' +
        '<div class="statrow"><span>Пары <b id="pair-count">' + matched + "/6</b></span><span>Время <b id=\"time\">" + clock() + "</b></span></div>" +
        '<div class="board">' + cards + "</div>";
    }

    function syncBoard() {
      deck.forEach(function (card, index) {
        var btn = stage.querySelector('[data-i="' + index + '"]');
        if (!btn) return;
        btn.classList.toggle("flipped", card.up || card.matched);
        btn.classList.toggle("matched", card.matched);
        btn.disabled = !!card.matched;
      });
      var count = document.getElementById("pair-count");
      if (count) count.textContent = matched + "/6";
    }

    function finish(cleared, leftEarly) {
      if (ended) return;
      ended = true;
      clearInterval(timer);
      var pairPay = matched * 100;
      var clearPay = cleared ? 400 : 0;
      var timePay = cleared ? left * 5 : 0;
      var notes = [];
      if (pairPay) notes.push("пары +" + pairPay);
      if (clearPay) notes.push("закрытие +" + clearPay);
      if (timePay) notes.push("время +" + timePay);
      var gained = { amount: 0, notes: [] };
      if (pairPay + clearPay + timePay > 0) {
        gained = payout(pairPay + clearPay + timePay, true, false);
        notes = notes.concat(gained.notes);
      } else {
        addXp(6);
      }
      state.stats.pairs += 1;
      if (gained.amount > state.best.pairs) state.best.pairs = gained.amount;
      if (cleared) unlock("clear");
      save();
      syncBoard();
      openModal(
        resultHtml(
          cleared ? "Поле закрыто" : (leftEarly ? "Пары забраны" : "Время вышло"),
          "",
          gained.amount,
          notes,
          "pairs"
        ),
        signal,
        onResult("pairs")
      );
    }

    signal.addEventListener("abort", function () { clearInterval(timer); });
    paint();

    app.addEventListener("click", function (e) {
      if (e.target.closest("[data-act=back]")) {
        if (!started) {
          refundEnergy();
          showLobby();
          return;
        }
        finish(false, true);
        return;
      }
      var btn = e.target.closest("[data-i]");
      if (!btn || lock || ended) return;
      var index = Number(btn.getAttribute("data-i"));
      var card = deck[index];
      if (!card || card.up || card.matched) return;
      card.up = true;
      if (!started) {
        started = true;
        timer = setInterval(function () {
          left -= 1;
          var node = document.getElementById("time");
          if (node) node.textContent = clock();
          if (left <= 0) finish(false);
        }, 1000);
      }
      if (first === null) {
        first = index;
        syncBoard();
        return;
      }
      if (deck[first].name === card.name && first !== index) {
        deck[first].matched = true;
        card.matched = true;
        matched += 1;
        first = null;
        syncBoard();
        if (matched === 6) finish(true);
        return;
      }
      var previous = first;
      first = null;
      lock = true;
      syncBoard();
      var wait = setTimeout(function () {
        if (ended) return;
        deck[previous].up = false;
        card.up = false;
        lock = false;
        syncBoard();
      }, 650);
      signal.addEventListener("abort", function () { clearTimeout(wait); });
    }, { signal: signal });
  }

  function playClicker(signal) {
    var combo = 0;
    var last = 0;
    app.innerHTML = frame(
      "Кликер",
      '<p class="hint">Тап по монете. Комбо копится, если бить быстрее 0.9 с. Обмен: 100 монет → 1 алмаз.</p>' +
      '<p class="combo" id="combo">Комбо 0</p>' +
      '<div class="gemwrap"><button type="button" class="gem is-loading" id="gem" aria-label="Монета" disabled><span class="gem-loader" aria-hidden="true"></span><img src="assets/img/coin.png" alt="" draggable="false"></button></div>' +
      '<div class="row"><button type="button" class="cta gold" data-act="exchange">Обменять 100</button></div>'
    );

    var coinButton = app.querySelector("#gem");
    var coinImage = coinButton.querySelector("img");
    function showCoin() {
      coinButton.classList.remove("is-loading");
      coinButton.disabled = false;
    }
    if (coinImage.complete && coinImage.naturalWidth) showCoin();
    else {
      coinImage.addEventListener("load", showCoin, { signal: signal });
      coinImage.addEventListener("error", showCoin, { signal: signal });
    }

    coinButton.addEventListener("dragstart", function (e) {
      e.preventDefault();
    }, { signal: signal });
    app.querySelector("#gem").addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var selection = window.getSelection();
      if (selection) selection.removeAllRanges();
      var now = performance.now();
      combo = now - last < 900 ? combo + 1 : 1;
      last = now;
      var bonus = Math.min(6, Math.floor((combo - 1) / 6));
      var gain = 1 + bonus;
      state.coins += gain;
      state.earned += gain;
      if (combo > state.best.combo) state.best.combo = combo;
      if (combo >= 25) unlock("combo");
      var mark = Math.floor(state.earned / 100);
      if (mark > state.coinMark) {
        var steps = mark - state.coinMark;
        state.coinMark = mark;
        state.diamonds += 20 * steps;
        addXp(6 * steps);
        toast("Сундук кликера +" + (20 * steps));
      }
      save();
      paintWallet();
      document.getElementById("combo").textContent = "Комбо " + combo + " · +" + gain;
      var rect = e.currentTarget.getBoundingClientRect();
      var flo = document.createElement("span");
      flo.className = "flo";
      flo.textContent = "+" + gain;
      flo.style.left = (e.clientX - rect.left) + "px";
      flo.style.top = (e.clientY - rect.top) + "px";
      e.currentTarget.appendChild(flo);
      setTimeout(function () { flo.remove(); }, 700);
    }, { signal: signal });

    app.addEventListener("click", function (e) {
      if (e.target.closest("[data-act=back]")) showLobby();
      if (!e.target.closest("[data-act=exchange]")) return;
      if (state.coins < 100) {
        toast("Нужно 100 монет");
        return;
      }
      state.coins -= 100;
      state.diamonds += 1;
      addXp(2);
      save();
      paintWallet();
      toast("Обмен +1");
    }, { signal: signal });
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function bannerSrc(uid) {
    return "https://banner.garena.win/banner?" + new URLSearchParams({
      uid: String(uid),
      region: "ru",
      apikey: "FFDEV"
    }).toString();
  }

  function readDropQuery() {
    var params = new URLSearchParams(window.location.search);
    var item = "";
    var uid = "";
    params.forEach(function (value, key) {
      var idMatch = /^id(\d{5,12})$/i.exec(String(value).trim());
      if (idMatch) item = idMatch[1];
      if (String(key).toLowerCase() === "uid" && /^\d{5,16}$/.test(String(value).trim())) uid = String(value).trim();
    });
    if (!item || !uid) return null;
    return { item: item, uid: uid };
  }

  function loadDropBook(spec) {
    var raw = null;
    try {
      raw = JSON.parse(sessionStorage.getItem(DROP_KEY) || "null");
    } catch (e) {
      raw = null;
    }
    if (!raw || raw.item !== spec.item || raw.uid !== spec.uid) {
      raw = {
        item: spec.item,
        uid: spec.uid,
        target: 3 + Math.floor(Math.random() * 3),
        spins: 0,
        done: false
      };
    }
    if (raw.target < 3 || raw.target > 5) raw.target = 3 + Math.floor(Math.random() * 3);
    sessionStorage.setItem(DROP_KEY, JSON.stringify(raw));
    return raw;
  }

  function saveDropBook() {
    if (!dropOffer) return;
    sessionStorage.setItem(DROP_KEY, JSON.stringify({
      item: dropOffer.item,
      uid: dropOffer.uid,
      target: dropOffer.target,
      spins: dropOffer.spins,
      done: dropOffer.done
    }));
  }

  function openDropWithdraw(signal) {
    var prize = dropOffer.prize;
    var html =
      '<div class="modal-back"></div><div class="modal-card" role="dialog" aria-modal="true" aria-label="Вывод">' +
      '<img class="profile-banner" src="' + esc(dropOffer.banner) + '" alt="Баннер профиля">' +
      '<img class="drop-icon" src="' + esc(prize.img) + '" alt="">' +
      '<p class="eyebrow">' + esc(prize.title) + "</p>" +
      '<strong class="big">' + state.diamonds + "</strong>" +
      "<p>Алмазы на балансе. Предмет и копилка уходят одной заявкой на UID " + esc(dropOffer.uid) + ".</p>" +
      '<div class="row"><button type="button" class="cta" data-act="lobby">В зал</button>' +
      '<button type="button" class="cta gold" data-act="claim-drop">Вывести</button></div></div>';
    openModal(html, signal, function (e) {
      if (e.target.closest("[data-act=lobby]")) showLobby();
      if (e.target.closest("[data-act=claim-drop]")) claimDrop();
    });
  }

  function claimDrop() {
    if (!dropOffer) return;
    if (state.diamonds < 1) {
      closeModal();
      toast("В копилке пусто");
      return;
    }
    var amount = state.diamonds;
    state.diamonds = 0;
    state.withdrawals.push({
      amount: amount,
      at: Date.now(),
      uid: dropOffer.uid,
      item: dropOffer.item,
      title: dropOffer.prize ? dropOffer.prize.title : ""
    });
    save();
    closeModal();
    paintWallet();
    toast("Заявка на " + amount + " алмазов");
  }

  function playRoulette(signal) {
    var spinning = false;
    var landed = false;
    var forceItem = dropOffer && dropOffer.prize && !dropOffer.done && dropOffer.spins + 1 === dropOffer.target;
    var deck = PRIZES.slice();
    if (forceItem) deck.push(dropOffer.prize);
    var strip = deck.concat(deck).concat(deck);
    var cards = strip.map(function (prize) {
      return '<div class="prize"><img src="' + esc(prize.img) + '" alt=""><span>' + esc(prize.title) + "</span></div>";
    }).join("");
    app.innerHTML = frame(
      "Рулетка",
      '<img class="kelly" src="assets/img/Kelly-GIF__ff.gif" alt="">' +
      '<p class="hint">Приз останавливается на жёлтой риске.</p>' +
      '<div class="wheel" id="wheel"><div class="track" id="track">' + cards + "</div></div>" +
      '<div class="row"><button type="button" class="cta gold" id="spin">Крутить</button></div>'
    );
    var track = document.getElementById("track");
    var wheel = document.getElementById("wheel");

    function pickIndex() {
      if (forceItem) return deck.length - 1;
      var total = PRIZES.reduce(function (sum, prize) { return sum + prize.weight; }, 0);
      var roll = Math.random() * total;
      var index = 0;
      for (index = 0; index < PRIZES.length; index += 1) {
        roll -= PRIZES[index].weight;
        if (roll <= 0) return index;
      }
      return PRIZES.length - 1;
    }

    function land(prize) {
      if (landed) return;
      landed = true;
      var notes = [];
      var amount = 0;
      if (dropOffer && !dropOffer.done) {
        dropOffer.spins += 1;
        if (prize.kind === "icon") dropOffer.done = true;
        saveDropBook();
      }
      if (prize.kind === "gems") {
        var gained = payout(prize.amount, true, false);
        amount = gained.amount;
        notes = gained.notes;
        if (prize.amount >= 350) unlock("jack");
      } else if (prize.kind === "chance") {
        var spins = prize.amount || 1;
        state.energy = Math.min(ENERGY_CAP, state.energy + spins);
        notes = ["энергия +" + spins];
        addXp(4);
      }
      state.stats.spins += 1;
      if (amount > state.best.spin) state.best.spin = amount;
      save();
      paintWallet();
      if (prize.kind === "icon") {
        openDropWithdraw(signal);
        return;
      }
      openModal(resultHtml(prize.title, "", amount, notes, "roulette"), signal, onResult("roulette"));
    }

    document.getElementById("spin").addEventListener("click", function () {
      if (spinning) return;
      if (!spendEnergy()) return;
      paintWallet();
      spinning = true;
      this.disabled = true;
      var chosen = pickIndex();
      var index = deck.length + chosen;
      var first = track.children[0].getBoundingClientRect();
      var second = track.children[1].getBoundingClientRect();
      var step = second.left - first.left;
      var view = wheel.getBoundingClientRect().width;
      var pad = first.left - track.getBoundingClientRect().left;
      var x = view / 2 - first.width / 2 - pad - index * step;
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        track.style.transform = "translateX(" + x + "px)";
        land(deck[chosen]);
        return;
      }
      track.style.transition = "none";
      track.style.transform = "translateX(0px)";
      requestAnimationFrame(function () {
        track.style.transition = "transform 3.5s cubic-bezier(.08,.72,.12,1)";
        track.style.transform = "translateX(" + x + "px)";
      });
      var backup = setTimeout(function () { land(deck[chosen]); }, 3900);
      function onEnd(ev) {
        if (ev.propertyName !== "transform") return;
        clearTimeout(backup);
        track.removeEventListener("transitionend", onEnd);
        land(deck[chosen]);
      }
      track.addEventListener("transitionend", onEnd);
      signal.addEventListener("abort", function () {
        clearTimeout(backup);
        track.removeEventListener("transitionend", onEnd);
      });
    }, { signal: signal });

    app.addEventListener("click", function (e) {
      if (e.target.closest("[data-act=back]")) {
        if (spinning && !landed) return;
        showLobby();
      }
    }, { signal: signal });
  }

  state = load();
  syncEnergy();
  var starter = !state.welcomed;
  if (starter) {
    state.welcomed = true;
    state.diamonds += 80;
    save();
  }
  var dropSpec = readDropQuery();
  if (dropSpec) {
    dropOffer = loadDropBook(dropSpec);
    fetch("/api/item?id=" + encodeURIComponent(dropSpec.item)).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data };
      });
    }).then(function (res) {
      if (!res.ok || !res.data || !res.data.ok) {
        dropOffer = null;
        showLobby();
        toast((res.data && res.data.error) || "Предмет не найден");
        return;
      }
      dropOffer.prize = { title: res.data.title, img: res.data.icon, kind: "icon", itemId: res.data.id };
      dropOffer.banner = bannerSrc(dropSpec.uid);
      enter(playRoulette);
    }).catch(function () {
      dropOffer = null;
      showLobby();
      toast("Не удалось загрузить предмет");
    });
  } else {
    showLobby();
  }
  if (starter) toast("Стартовый кейс: +80 алмазов");
  setInterval(paintWallet, 1000);
})();
