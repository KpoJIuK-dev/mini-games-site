/**
 * Рулетка: карточки из data/prizes.json, анимация через transform (без Swiper).
 * Позиция выигрыша = точный расчёт translateX по ширине карточки и вьюпорта.
 */
(function (global) {
  'use strict';

  var DEFAULT_PRIZES_PAYLOAD = {
    /** Сколько раз продублировать ленту в DOM (массовка); фактическое число не ниже минимума для анимации спина */
    stripVisualRepeats: 3,
    /** id карточек «доп. попытка»: без картинки/приза, только слот; можно несколько */
    retryCardIds: [104, 108],
    /** На первый спин останавливаемся на этой карточке (должна быть из retryCardIds) */
    firstSpinCardId: 104,
    cards: [
      { id: 101, code: 'gems5600', img: 'img/dcase2.png', title: '+5,600💎' },
      { id: 102, code: 'gems2180', img: 'img/dcase.png', title: '+2,180💎' },
      { id: 103, code: 'win500', img: 'img/diamond.png', title: '+500💎' },
      { id: 104, code: 'retry_a', img: 'img/1.png' },
      { id: 105, code: 'jackpot1', img: 'img/802000001.png', title: 'Купон джекпота' },
      { id: 106, code: 'cube1', img: 'img/801000183.png', title: 'Фрагмент Куба' },
      { id: 107, code: 'stashmap', img: 'img/500000007.png', title: 'Карта схрона' },
      { id: 108, code: 'retry_b', img: 'img/1.png' },
      { id: 109, code: 'cube2', img: 'img/801000183.png', title: 'Фрагмент Куба' },
      { id: 110, code: 'hunter', img: 'img/500000008.png', title: 'Жетон охотника' },
      { id: 111, code: 'msacura', img: 'img/710000345.png', title: 'Набор Сакура' },
      { id: 112, code: 'inyan', img: 'img/Icon_male_yinyang.png', title: 'Набор Инь-Янь' },
      { id: 113, code: 'jackpot2', img: 'img/802000000.png', title: 'Купон джекпота' },
    ],
  };

  var CONFIG = {
    telegramBotUsername: 'YOUR_BOT_USERNAME',
    prizesJsonUrl: './data/prizes.json',
    /** Увеличьте на 1, если хост/CDN отдаёт старый prizes.json из кэша */
    prizesJsonRevision: 1,
    prizesJsonEmbedId: 'prizes-config',
    trackId: 'raffle-track',
    wheelSelector: '#raffle-wheel',
    /**
     * В Mini App передать код боту через WebApp.sendData (сервисное сообщение web_app_data).
     * Имеет смысл только если telegramWebAppEntry не 'inline'.
     */
    telegramPreferWebAppSendData: true,
    /**
     * Как открывается Mini App (от этого зависит sendData — см. core.telegram.org/bots/webapps):
     * 'keyboard_or_menu' — reply KeyboardButton web_app ИЛИ кнопка меню чата / attachment menu → sendData работает;
     * 'inline' — InlineKeyboardButton с web_app → sendData в клиентах недоступен, используется openTelegramLink (t.me внутри Telegram).
     */
    telegramWebAppEntry: 'inline',
    /** Показать нативную MainButton внизу для отправки приза (только вместе с sendData, не лечит inline) */
    telegramPrizeUseMainButton: false,
    /** Развернуть мини-приложение на весь экран при открытии из Telegram */
    telegramWebAppExpand: true,
    /** Желаемое число дублей ленты (×3 и т.д.); итог = max(этого, минимум для спина) */
    stripVisualRepeats: 3,
    /** Подпись на слоте «доп. попытка», если в JSON не задан title */
    retryCardTitle: 'Ещё попытка',
    /** Картинка для retry, если в карточке не указан img */
    retryCardImg: 'img/1.png',
    transitionMs: 8500,
    easingCss: 'cubic-bezier(0.12, 0.78, 0.18, 1)',
    minFullStripLoops: 2,
    maxFullStripLoops: 5,
    firstSpinStripIndex: 0,
    queryParamKeys: ['prize', 'win', 'record'],
    /** Base64 от числового id карточки из cards[] (тот же id, что в JSON), или JSON {"id":103} */
    queryPrizeIdBase64: true,
    /** То же число link id без Base64 (удобно для тестов) */
    queryPrizeIdPlainFallback: true,
    /** false — без блокировки и без записи в localStorage (для отладки) */
    spinCooldownEnabled: true,
    /** Секунды после финального приза, когда «Крутить» снова недоступна */
    spinCooldownSeconds: 300,
    /** Ключ в localStorage; сброс вручную: localStorage.removeItem('ff_roulette_spin_locked_until') */
    spinCooldownStorageKey: 'ff_roulette_spin_locked_until',
  };

  var PRIZE_STRIP = [];

  function stripLength() {
    return PRIZE_STRIP.length;
  }

  /** Дубли ленты: желаемый ×N (массовка), но не меньше минимума для корректного спина */
  function effectiveStripRepeatCount() {
    var n = stripLength();
    var visual = Math.max(3, CONFIG.stripVisualRepeats | 0);
    if (n <= 0) return visual;
    var minForSpin = 2 * CONFIG.maxFullStripLoops + 1;
    return Math.max(visual, minForSpin);
  }

  function getTelegramWebApp() {
    return global.Telegram && global.Telegram.WebApp ? global.Telegram.WebApp : null;
  }

  /** sendData разрешён в API Telegram только при входе с клавиатуры/меню, не с inline web_app */
  function telegramWebAppEntryAllowsSendData() {
    var e = String(CONFIG.telegramWebAppEntry || 'keyboard_or_menu')
      .toLowerCase()
      .replace(/-/g, '_');
    if (e === 'inline') return false;
    return (
      e === 'keyboard_or_menu' ||
      e === 'keyboard' ||
      e === 'menu' ||
      e === 'attachment' ||
      e === 'attachment_menu'
    );
  }

  function hideTelegramMainButtonIfAny() {
    var w = getTelegramWebApp();
    if (!w || !w.MainButton) return;
    try {
      w.MainButton.hide();
    } catch (e) {}
  }

  function initTelegramWebAppShell() {
    var w = getTelegramWebApp();
    if (!w) return;
    try {
      w.ready();
      if (CONFIG.telegramWebAppExpand) w.expand();
    } catch (e) {}
  }

  function spinCooldownUntilMs() {
    if (!CONFIG.spinCooldownEnabled) return 0;
    try {
      var raw = global.localStorage.getItem(CONFIG.spinCooldownStorageKey);
      var ms = parseInt(raw, 10);
      return !isNaN(ms) ? ms : 0;
    } catch (e) {
      return 0;
    }
  }

  function isSpinCooldownActive() {
    var u = spinCooldownUntilMs();
    return u > 0 && Date.now() < u;
  }

  function rememberSpinCooldown() {
    if (!CONFIG.spinCooldownEnabled) return;
    try {
      var sec = Math.max(1, CONFIG.spinCooldownSeconds | 0);
      global.localStorage.setItem(
        CONFIG.spinCooldownStorageKey,
        String(Date.now() + sec * 1000)
      );
    } catch (e) {}
  }

  function formatCooldownRemaining() {
    var u = spinCooldownUntilMs();
    var left = u - Date.now();
    if (left <= 0) return '';
    var m = Math.floor(left / 60000);
    var s = Math.ceil((left % 60000) / 1000);
    if (s >= 60) {
      m += 1;
      s -= 60;
    }
    if (m > 0) return m + ' мин ' + s + ' с';
    return s + ' с';
  }

  function applySpinCooldownUi(app) {
    var hint = document.getElementById('raffle-spin-lock-hint');
    var btn = app && app.spinBtn;
    if (!CONFIG.spinCooldownEnabled) {
      if (hint) hint.textContent = '';
      return;
    }
    if (!btn) return;
    if (isSpinCooldownActive()) {
      btn.disabled = true;
      if (hint) hint.textContent = 'Повторная попытка через ' + formatCooldownRemaining();
    } else {
      if (!(app && app.wheel && app.wheel.busy)) btn.disabled = false;
      if (hint) hint.textContent = '';
      try {
        var raw = global.localStorage.getItem(CONFIG.spinCooldownStorageKey);
        if (raw && parseInt(raw, 10) <= Date.now()) {
          global.localStorage.removeItem(CONFIG.spinCooldownStorageKey);
        }
      } catch (e) {}
    }
  }

  function parsePrizesPayload(parsed) {
    var rawList = [];
    var firstSpinStrip;
    var firstSpinCardId;
    var stripVisualRepeats;
    var retryCardIds = [];
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.cards)) {
      rawList = parsed.cards;
      if (typeof parsed.firstSpinStripIndex === 'number' && !isNaN(parsed.firstSpinStripIndex)) {
        firstSpinStrip = parsed.firstSpinStripIndex;
      }
      if (typeof parsed.firstSpinCardId === 'number' && !isNaN(parsed.firstSpinCardId)) {
        firstSpinCardId = parsed.firstSpinCardId;
      }
      if (typeof parsed.stripVisualRepeats === 'number' && !isNaN(parsed.stripVisualRepeats)) {
        stripVisualRepeats = parsed.stripVisualRepeats;
      }
      if (Array.isArray(parsed.retryCardIds)) {
        retryCardIds = parsed.retryCardIds;
      }
    }
    var retrySet = {};
    var r;
    for (r = 0; r < retryCardIds.length; r++) {
      var rid = parseInt(retryCardIds[r], 10);
      if (!isNaN(rid)) retrySet[rid] = true;
    }
    var normalized = [];
    var seenIds = {};
    var i;
    for (i = 0; i < rawList.length; i++) {
      var c = rawList[i];
      if (!c || typeof c !== 'object') continue;
      var idNum = parseInt(c.id, 10);
      if (isNaN(idNum)) {
        console.warn('[Roulette] Карточка без числового id, пропуск:', i);
        continue;
      }
      if (seenIds[idNum]) {
        console.warn('[Roulette] Дубликат id карточки:', idNum);
        continue;
      }
      seenIds[idNum] = true;
      var isRetry = retrySet[idNum] === true || c.isRetry === true;
      var title = String(c.title != null ? c.title : '');
      var img = String(c.img != null ? c.img : '');
      if (isRetry) {
        if (!title) title = CONFIG.retryCardTitle;
        if (!img && CONFIG.retryCardImg) img = String(CONFIG.retryCardImg);
      }
      normalized.push({
        id: idNum,
        code: String(c.code != null ? c.code : 'card_' + idNum),
        img: img,
        title: title,
        isRetry: isRetry,
      });
    }
    return {
      cards: normalized,
      firstSpinStripIndex: firstSpinStrip,
      firstSpinCardId:
        typeof firstSpinCardId === 'number' && !isNaN(firstSpinCardId) ? firstSpinCardId : undefined,
      stripVisualRepeats:
        typeof stripVisualRepeats === 'number' && !isNaN(stripVisualRepeats)
          ? stripVisualRepeats
          : undefined,
      retryCardIds: retryCardIds,
    };
  }

  /**
   * Base64 → числовой id карточки (как в cards[].id). Строка "103" или JSON {"id":103}.
   */
  function decodeBase64ToCardId(raw) {
    if (raw == null || raw === '') return null;
    if (!global.atob) return null;
    var s = String(raw).trim();
    s = s.replace(/\s/g, '+');
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    var pad = s.length % 4;
    if (pad) s += '===='.slice(pad);
    try {
      var bin = global.atob(s);
      var t = String(bin).replace(/^\uFEFF/, '').trim();
      var n = parseInt(t, 10);
      if (!isNaN(n)) return n;
      if (t.charAt(0) === '{') {
        var o = JSON.parse(t);
        if (o && typeof o.id !== 'undefined') {
          var idn = parseInt(o.id, 10);
          if (!isNaN(idn)) return idn;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function findStripIndexByCardId(cardId) {
    var idNum = parseInt(cardId, 10);
    if (isNaN(idNum)) return null;
    var j;
    for (j = 0; j < PRIZE_STRIP.length; j++) {
      if (PRIZE_STRIP[j].id === idNum) return j;
    }
    return null;
  }

  function findFirstRetryStripIndex() {
    var j;
    for (j = 0; j < PRIZE_STRIP.length; j++) {
      if (PRIZE_STRIP[j].isRetry) return j;
    }
    return null;
  }

  function tryResolveStripIndexFromPrizeQuery(raw) {
    if (raw == null || raw === '') return null;
    var s = String(raw).trim();
    var cardId = null;
    if (CONFIG.queryPrizeIdBase64) {
      cardId = decodeBase64ToCardId(s);
    }
    if (cardId == null && CONFIG.queryPrizeIdPlainFallback) {
      var p = parseInt(s, 10);
      if (!isNaN(p)) cardId = p;
    }
    if (cardId == null) return null;
    return findStripIndexByCardId(cardId);
  }

  function parsePrizesJsonText(text) {
    return JSON.parse(String(text || '').replace(/^\uFEFF/, '').trim());
  }

  function loadPrizesConfig(done) {
    function finishOk(parsed) {
      try {
        var out = parsePrizesPayload(parsed);
        if (!out.cards.length) {
          done(new Error('cards пустой'), null);
          return;
        }
        if (global.console && console.info) {
          console.info('[Roulette] Загружено карточек:', out.cards.length);
        }
        done(null, out);
      } catch (e) {
        if (global.console && console.warn) {
          console.warn('[Roulette] Ошибка разбора JSON призов:', e);
        }
        done(e, null);
      }
    }

    function tryEmbedded() {
      var el = document.getElementById(CONFIG.prizesJsonEmbedId);
      if (!el || !String(el.textContent || '').trim()) return false;
      try {
        finishOk(parsePrizesJsonText(el.textContent));
        if (global.console && console.info) {
          console.info('[Roulette] Использован встроенный JSON (#' + CONFIG.prizesJsonEmbedId + ')');
        }
        return true;
      } catch (e) {
        if (global.console && console.warn) {
          console.warn('[Roulette] Некорректный JSON в #' + CONFIG.prizesJsonEmbedId);
        }
        return false;
      }
    }

    if (tryEmbedded()) return;

    function fail(err) {
      if (global.console && console.warn) {
        console.warn('[Roulette] Не удалось загрузить prizes.json:', err && err.message ? err.message : err);
      }
      if (tryEmbedded()) return;
      if (global.console && console.warn) {
        console.warn('[Roulette] Подставляется DEFAULT_PRIZES_PAYLOAD из main.js');
      }
      finishOk(DEFAULT_PRIZES_PAYLOAD);
    }

    if (global.location.protocol === 'file:') {
      if (global.console && console.warn) {
        console.warn(
          '[Roulette] Страница открыта как file:// — запрос к data/prizes.json браузером блокируется. ' +
            'Запустите сайт через HTTP (например: npx serve . в папке проекта) или вставьте JSON в <script type="application/json" id="prizes-config">…</script> в index.html.'
        );
      }
      fail(new Error('file://'));
      return;
    }

    var url = CONFIG.prizesJsonUrl;
    url += (url.indexOf('?') === -1 ? '?' : '&') + 'r=' + (CONFIG.prizesJsonRevision | 0);

    if (global.fetch) {
      fetch(url, { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function (text) {
          finishOk(parsePrizesJsonText(text));
        })
        .catch(fail);
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          finishOk(parsePrizesJsonText(xhr.responseText));
        } catch (e) {
          fail(e);
        }
      } else {
        fail(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = function () {
      fail(new Error('network'));
    };
    xhr.send();
  }

  function escapeAttr(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function buildTrackHtml() {
    var html = [];
    var repeats = effectiveStripRepeatCount();
    var r;
    var i;
    for (r = 0; r < repeats; r++) {
      for (i = 0; i < PRIZE_STRIP.length; i++) {
        var p = PRIZE_STRIP[i];
        var cardCls = 'raffle-wheel__card' + (p.isRetry ? ' raffle-wheel__card--retry' : '');
        html.push(
          '<div class="' +
            cardCls +
            '" data-strip-index="' +
            i +
            '" data-prize-id="' +
            p.id +
            '"><div class="raffle-item">'
        );
        if (p.isRetry && !p.img) {
          html.push(
            '<div class="raffle-item__img raffle-item__img--retry"><span class="raffle-item__retry-label">' +
              escapeAttr(p.title) +
              '</span></div>'
          );
        } else {
          html.push(
            '<div class="raffle-item__img"><img src="' +
              escapeAttr(p.img) +
              '" alt="' +
              escapeAttr(p.title) +
              '"></div>'
          );
        }
        html.push(
          '<div class="raffle-item__content"><h4 class="raffle-item__title">' +
            escapeAttr(p.title) +
            '</h4></div></div></div>'
        );
      }
    }
    return html.join('');
  }

  /** Глобальный индекс слота в ленте (0 … repeats*N-1) для логического индекса приза */
  function globalSlotForLogical(logicalIndex, middleRepeat) {
    var n = stripLength();
    if (n <= 0) return 0;
    return middleRepeat * n + logicalIndex;
  }

  function defaultFinalStripIndex() {
    var i;
    for (i = 0; i < PRIZE_STRIP.length; i++) {
      if (!PRIZE_STRIP[i].isRetry) return i;
    }
    return 0;
  }

  function stripIndexFromQueryString() {
    var q;
    try {
      q = new URLSearchParams(global.location.search);
    } catch (e) {
      return defaultFinalStripIndex();
    }
    var explicit = q.get('strip');
    if (explicit !== null && explicit !== '') {
      var si = parseInt(explicit, 10);
      if (!isNaN(si) && si >= 0 && si < stripLength()) return si;
    }
    var raw = null;
    var k = CONFIG.queryParamKeys;
    var j;
    for (j = 0; j < k.length; j++) {
      raw = q.get(k[j]);
      if (raw) break;
    }
    if (raw == null || raw === '') return defaultFinalStripIndex();
    var s = String(raw).trim();
    var fromMap = tryResolveStripIndexFromPrizeQuery(s);
    if (fromMap !== null) return fromMap;
    for (j = 0; j < PRIZE_STRIP.length; j++) {
      if (PRIZE_STRIP[j].code === s) return j;
    }
    var n = parseInt(s, 10);
    if (!isNaN(n)) {
      for (j = 0; j < PRIZE_STRIP.length; j++) {
        if (PRIZE_STRIP[j].id === n) return j;
      }
      if (n >= 0 && n < stripLength()) return n;
    }
    return defaultFinalStripIndex();
  }

  function prizeAtStripIndex(i) {
    if (i < 0 || i >= PRIZE_STRIP.length) return PRIZE_STRIP[0];
    return PRIZE_STRIP[i];
  }

  function normalizeBotUsername(name) {
    return String(name || '')
      .replace(/^@/, '')
      .trim();
  }

  function telegramDeepLink(prize) {
    var u = normalizeBotUsername(CONFIG.telegramBotUsername);
    if (!u || u === 'YOUR_BOT_USERNAME') return null;
    return 'https://t.me/' + encodeURIComponent(u) + '?start=' + encodeURIComponent(prize.code);
  }

  function wireTelegramPrizeButton(prize) {
    var el = document.getElementById('modal-telegram-btn');
    var li = document.getElementById('modal-finish-li-telegram');
    if (!el) return;
    el.onclick = null;
    el.style.display = '';
    hideTelegramMainButtonIfAny();

    var webApp = getTelegramWebApp();
    var deep = telegramDeepLink(prize);
    var useSendData =
      CONFIG.telegramPreferWebAppSendData &&
      telegramWebAppEntryAllowsSendData() &&
      webApp &&
      typeof webApp.sendData === 'function';

    var payloadStr = JSON.stringify({
      t: 'roulette_prize',
      code: prize.code,
      id: prize.id,
      title: prize.title,
    });

    function hintInline() {
      if (li) {
        li.textContent =
          'Открытие с inline-кнопки: данные в бота через sendData недоступны — откроется чат с ботом с кодом в start.';
      }
    }
    function hintSendData() {
      if (li) {
        li.textContent =
          'Нажмите кнопку ниже — код уйдёт боту через Mini App (sendData), без ссылки в браузер.';
      }
    }
    function hintLink() {
      if (li) {
        li.textContent =
          'Нажмите кнопку ниже — откроется Telegram-бот с вашим кодом приза.';
      }
    }

    function bindOpenInTelegramLink() {
      el.setAttribute('href', '#');
      el.removeAttribute('target');
      el.textContent = 'Открыть бота с кодом';
      el.onclick = function (ev) {
        ev.preventDefault();
        if (!deep) return;
        if (webApp && typeof webApp.openTelegramLink === 'function') {
          try {
            webApp.openTelegramLink(deep);
          } catch (err) {
            global.location.href = deep;
          }
        } else {
          global.location.href = deep;
        }
      };
    }

    if (useSendData && CONFIG.telegramPrizeUseMainButton && webApp.MainButton) {
      el.style.display = 'none';
      try {
        webApp.MainButton.setText('Отправить приз боту');
        webApp.MainButton.onClick(function () {
          try {
            webApp.sendData(payloadStr);
          } catch (err) {
            console.warn('[Roulette] sendData', err);
            el.style.display = '';
            hideTelegramMainButtonIfAny();
            if (deep) bindOpenInTelegramLink();
          }
        });
        webApp.MainButton.show();
        hintSendData();
        return;
      } catch (e) {
        el.style.display = '';
      }
    }

    if (useSendData) {
      el.setAttribute('href', '#');
      el.removeAttribute('target');
      el.textContent = 'Отправить приз боту';
      el.onclick = function (ev) {
        ev.preventDefault();
        try {
          webApp.sendData(payloadStr);
        } catch (err) {
          console.warn('[Roulette] sendData', err);
          if (deep && webApp && typeof webApp.openTelegramLink === 'function') {
            try {
              webApp.openTelegramLink(deep);
            } catch (e2) {
              global.location.href = deep;
            }
          } else if (deep) {
            global.location.href = deep;
          }
        }
      };
      hintSendData();
      return;
    }

    if (webApp && deep) {
      bindOpenInTelegramLink();
      if (String(CONFIG.telegramWebAppEntry || '').toLowerCase() === 'inline') {
        hintInline();
      } else {
        hintLink();
      }
      return;
    }

    hintLink();
  }

  function ModalStack() {
    this.closeAll = function () {
      hideTelegramMainButtonIfAny();
      var tgel = document.getElementById('modal-telegram-btn');
      if (tgel) tgel.style.display = '';
      document.documentElement.classList.remove('js-modal', 'js-spin');
      var nodes = document.querySelectorAll('.modal');
      var i;
      for (i = 0; i < nodes.length; i++) {
        nodes[i].classList.remove('isactive');
      }
    };
    this.open = function (id) {
      document.documentElement.classList.add('js-modal');
      var el = document.getElementById(id);
      if (el) el.classList.add('isactive');
    };
  }

  function PrizeFinishView() {
    var img = document.getElementById('modal-prize-img');
    var title = document.getElementById('modal-prize-title');
    var code = document.getElementById('modal-prize-code');
    var tg = document.getElementById('modal-telegram-btn');
    var imins = document.getElementById('imins');
    var hsecs = document.getElementById('hsecs');

    this.fill = function (prize) {
      if (img) {
        img.src = prize.img;
        img.alt = prize.title;
      }
      if (title) title.textContent = prize.title;
      if (code) code.textContent = prize.code;
      if (tg) {
        var link = telegramDeepLink(prize);
        if (link) {
          tg.href = link;
          tg.removeAttribute('title');
        } else {
          tg.setAttribute('href', '#');
          tg.setAttribute('title', 'Укажите telegramBotUsername в CONFIG');
        }
      }
      if (imins) imins.textContent = '4';
      if (hsecs) hsecs.textContent = '59';
      wireTelegramPrizeButton(prize);
    };
  }

  function CountdownTimer() {
    var id = null;
    this.stop = function () {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    this.start = function () {
      this.stop();
      id = setInterval(tick, 1000);
    };

    function tick() {
      var im = document.getElementById('imins');
      var hs = document.getElementById('hsecs');
      if (!im || !hs) return;
      var d = parseInt(im.textContent, 10);
      var c = parseInt(hs.textContent, 10);
      var nextMin;
      var nextSec;
      if (d !== 0 && c === 0) {
        nextMin = d - 1;
        nextSec = 59;
      } else if (d !== 0 || c !== 0) {
        nextMin = d;
        nextSec = c - 1;
      } else {
        nextMin = d;
        nextSec = c;
      }
      hs.textContent = nextSec < 10 ? '0' + nextSec : String(nextSec);
      im.textContent = String(nextMin);
    }
  }

  function CommentsReveal() {
    this.run = function () {
      /* Только имитированные комментарии (не гостевые внутри #guest-comments-mount).
         Время задаёт sim-comments-time.js + localStorage — здесь не трогаем .comments-time. */
      var items = document.querySelectorAll('.comments-main > .comments-item');
      var i;
      for (i = 0; i < items.length; i++) {
        (function (idx) {
          setTimeout(function () {
            items[idx].classList.add('isvisible');
          }, idx * 4000);
        })(i);
      }
    };
  }

  function bindCommentsChrome() {
    var send = document.querySelector('.comments-btn');
    if (send) {
      send.addEventListener('click', function () {
        var inp = document.querySelector('.comments__input');
        if (inp && inp.value !== '') {
          inp.value = '';
          var bar = document.querySelector('.comments-bottom');
          if (bar) bar.classList.add('isactive');
        }
      });
    }
    var firstReply = document.querySelector('.comments-links span');
    if (firstReply) {
      firstReply.addEventListener('click', function () {
        var inp = document.querySelector('.comments__input');
        if (inp) inp.focus();
      });
    }
  }

  /**
   * Рулетка: translateX так, что центр карточки index совпадает с центром вьюпорта.
   */
  function PrizeWheel(track, viewport) {
    this.track = track;
    this.viewport = viewport;
    this.step = 0;
    this.stripWidth = 0;
    this.currentIndex = 0;
    this.middleRepeat = 0;
    this.stripRepeatCount = 3;
    this.busy = false;
    this._onTransitionEnd = null;
  }

  PrizeWheel.prototype.measure = function () {
    var kids = this.track.children;
    var n = kids.length;
    var logicalN = stripLength();
    if (n < 1) {
      this.step = 200;
      this.stripWidth = logicalN > 0 ? this.step * logicalN : 0;
      return;
    }
    if (n < 2) {
      this.step = kids[0].offsetWidth + 10;
    } else {
      this.step = kids[1].offsetLeft - kids[0].offsetLeft;
    }
    this.stripWidth = logicalN > 0 ? this.step * logicalN : this.step * n;
  };

  /** index — глобальный слот в ленте (номер карточки среди всех дубликатов) */
  PrizeWheel.prototype.xCenterCard = function (globalSlotIndex) {
    var V = this.viewport.clientWidth;
    var kids = this.track.children;
    var c0 = kids[0];
    if (!c0) return 0;
    var cardW = c0.offsetWidth;
    var s = this.step || cardW + 10;
    var centerCardFromTrackLeft = globalSlotIndex * s + cardW / 2;
    return Math.round(V / 2 - centerCardFromTrackLeft);
  };

  PrizeWheel.prototype.setTranslate = function (xPx, transitionMs) {
    var tr = this.track;
    if (transitionMs) {
      tr.style.transition = 'transform ' + transitionMs + 'ms ' + CONFIG.easingCss;
    } else {
      tr.style.transition = 'none';
    }
    tr.style.transform = 'translateX(' + xPx + 'px)';
  };

  PrizeWheel.prototype.readTranslate = function () {
    var st = global.getComputedStyle(this.track).transform;
    if (!st || st === 'none') return 0;
    var m = st.match(/matrix\(([^)]+)\)/);
    if (!m) return 0;
    var p = m[1].split(',');
    return Math.round(parseFloat(p[4]) || 0);
  };

  PrizeWheel.prototype.snapToIndex = function (logicalIndex, noTransition) {
    this.measure();
    if (logicalIndex < 0 || logicalIndex >= stripLength()) logicalIndex = 0;
    var g = globalSlotForLogical(logicalIndex, this.middleRepeat);
    if (g >= this.track.children.length) {
      this.middleRepeat = Math.max(0, Math.floor(this.stripRepeatCount / 2));
      g = globalSlotForLogical(logicalIndex, this.middleRepeat);
    }
    var x = this.xCenterCard(g);
    this.setTranslate(x, noTransition ? 0 : null);
    void this.track.offsetWidth;
    if (!noTransition) {
      this.track.style.transition = '';
    }
    this.currentIndex = logicalIndex;
  };

  PrizeWheel.prototype.spinToIndex = function (targetLogicalIndex, onDone) {
    var self = this;
    if (self.busy) return;
    self.busy = true;
    self.measure();
    if (targetLogicalIndex < 0 || targetLogicalIndex >= stripLength()) targetLogicalIndex = 0;

    var endGlobal = globalSlotForLogical(targetLogicalIndex, self.middleRepeat);
    if (endGlobal >= self.track.children.length) {
      self.middleRepeat = Math.max(0, Math.floor(self.stripRepeatCount / 2));
      endGlobal = globalSlotForLogical(targetLogicalIndex, self.middleRepeat);
    }
    var endX = self.xCenterCard(endGlobal);
    var w = self.stripWidth;
    if (w <= 0) {
      self.snapToIndex(targetLogicalIndex, true);
      self.busy = false;
      if (onDone) onDone();
      return;
    }

    var curX = self.readTranslate();
    var loops =
      CONFIG.minFullStripLoops +
      Math.floor(Math.random() * (CONFIG.maxFullStripLoops - CONFIG.minFullStripLoops + 1));
    var logicalN = stripLength();
    var totalSlots = self.track.children.length;
    var needSlots = loops * logicalN;
    var startGlobal = endGlobal - needSlots;
    while (startGlobal < 0 && loops > CONFIG.minFullStripLoops) {
      loops -= 1;
      needSlots = loops * logicalN;
      startGlobal = endGlobal - needSlots;
    }
    if (startGlobal < 0) {
      startGlobal = 0;
    }
    var startX = self.xCenterCard(startGlobal);
    while (startX <= curX) {
      startX += w;
    }

    if (self._onTransitionEnd) {
      self.track.removeEventListener('transitionend', self._onTransitionEnd);
      self._onTransitionEnd = null;
    }

    self.setTranslate(startX, 0);
    void self.track.offsetWidth;

    var finished = false;
    function doneOnce() {
      if (finished) return;
      finished = true;
      self.track.removeEventListener('transitionend', self._onTransitionEnd);
      self._onTransitionEnd = null;
      self.setTranslate(endX, 0);
      void self.track.offsetWidth;
      self.track.style.transition = '';
      self.currentIndex = targetLogicalIndex;
      self.busy = false;
      if (onDone) onDone();
    }

    self._onTransitionEnd = function (ev) {
      if (ev.target !== self.track) return;
      if (ev.propertyName !== 'transform') return;
      doneOnce();
    };
    self.track.addEventListener('transitionend', self._onTransitionEnd);

    self.setTranslate(endX, CONFIG.transitionMs);

    setTimeout(doneOnce, CONFIG.transitionMs + 500);
  };

  function RaffleApp(wheel, modals, finishView, timer, finalStripIndex, firstSpinIndex) {
    this.wheel = wheel;
    this.modals = modals;
    this.finishView = finishView;
    this.timer = timer;
    this.finalStripIndex = finalStripIndex;
    this.firstSpinIndex = firstSpinIndex;
    this.spinBtn = document.getElementById('raffle-btn-spin');
  }

  RaffleApp.prototype.setBusyUi = function (on) {
    document.documentElement.classList.toggle('js-spin', on);
    if (this.spinBtn) {
      var lock = CONFIG.spinCooldownEnabled && isSpinCooldownActive();
      this.spinBtn.disabled = on || lock;
      this.spinBtn.classList.toggle('is-busy', on);
    }
  };

  RaffleApp.prototype.firstRound = function () {
    var self = this;
    if (self.wheel.busy) return;
    if (CONFIG.spinCooldownEnabled && isSpinCooldownActive()) return;
    self.modals.closeAll();
    self.setBusyUi(true);
    self.wheel.spinToIndex(self.firstSpinIndex, function () {
      self.setBusyUi(false);
      self.modals.open('modal-retry');
    });
  };

  RaffleApp.prototype.finalRound = function () {
    var self = this;
    if (self.wheel.busy) return;
    var target = self.finalStripIndex;
    if (target < 0 || target >= stripLength()) target = 0;
    self.modals.closeAll();
    self.setBusyUi(true);
    self.wheel.spinToIndex(target, function () {
      self.setBusyUi(false);
      self.finishView.fill(prizeAtStripIndex(target));
      rememberSpinCooldown();
      applySpinCooldownUi(self);
      self.timer.stop();
      self.modals.open('modal-finish');
      self.timer.start();
    });
  };

  var timerGlobal = new CountdownTimer();

  function exposeApi(modals, app) {
    global.showModal = function (id) {
      modals.open(id);
    };
    global.closeModal = function () {
      timerGlobal.stop();
      modals.closeAll();
    };
    global.firstSpin = function () {
      app.firstRound();
    };
    global.secondSpin = function () {
      app.finalRound();
    };
  }

  function registerStubApi(modals) {
    global.closeModal = function () {
      timerGlobal.stop();
      modals.closeAll();
    };
    global.showModal = function (id) {
      modals.open(id);
    };
    global.firstSpin = global.secondSpin = function () {};
  }

  function bindResize(wheel) {
    var t;
    function onResize() {
      clearTimeout(t);
      t = setTimeout(function () {
        wheel.measure();
        wheel.snapToIndex(wheel.currentIndex, true);
      }, 120);
    }
    global.addEventListener('resize', onResize);
    global.addEventListener('orientationchange', onResize);
  }

  function initAfterConfig(modals, payload) {
    PRIZE_STRIP = payload.cards;
    if (typeof payload.stripVisualRepeats === 'number' && !isNaN(payload.stripVisualRepeats)) {
      CONFIG.stripVisualRepeats = payload.stripVisualRepeats;
    }
    if (typeof payload.firstSpinStripIndex === 'number' && !isNaN(payload.firstSpinStripIndex)) {
      CONFIG.firstSpinStripIndex = payload.firstSpinStripIndex;
    }

    var track = document.getElementById(CONFIG.trackId);
    var wheelRoot = document.querySelector(CONFIG.wheelSelector);
    if (!track || !wheelRoot) {
      console.error('[Roulette] Нет #raffle-track или #raffle-wheel');
      registerStubApi(modals);
      return;
    }
    var viewport = wheelRoot.querySelector('.raffle-wheel__viewport');
    if (!viewport) {
      registerStubApi(modals);
      return;
    }

    track.innerHTML = buildTrackHtml();

    var wheel = new PrizeWheel(track, viewport);
    wheel.stripRepeatCount = effectiveStripRepeatCount();
    wheel.middleRepeat = Math.floor(wheel.stripRepeatCount / 2);
    wheel.measure();
    wheel.snapToIndex(0, true);

    global.addEventListener('load', function () {
      wheel.measure();
      wheel.snapToIndex(wheel.currentIndex, true);
    });

    bindResize(wheel);

    var firstIdx = null;
    if (typeof payload.firstSpinCardId === 'number' && !isNaN(payload.firstSpinCardId)) {
      firstIdx = findStripIndexByCardId(payload.firstSpinCardId);
    }
    if (firstIdx == null && typeof CONFIG.firstSpinStripIndex === 'number') {
      firstIdx = CONFIG.firstSpinStripIndex;
    }
    if (firstIdx == null || firstIdx < 0 || firstIdx >= stripLength()) {
      var rj = findFirstRetryStripIndex();
      firstIdx = rj != null ? rj : 0;
    }
    if (firstIdx < 0 || firstIdx >= stripLength()) {
      firstIdx = 0;
    }

    var finalIdx = stripIndexFromQueryString();
    var finishView = new PrizeFinishView();
    var app = new RaffleApp(wheel, modals, finishView, timerGlobal, finalIdx, firstIdx);

    exposeApi(modals, app);

    if (CONFIG.spinCooldownEnabled) {
      global.setInterval(function () {
        applySpinCooldownUi(app);
      }, 1000);
      applySpinCooldownUi(app);
    }

    var retryOk = document.getElementById('modal-btn-retry-ok');
    if (retryOk) {
      retryOk.addEventListener('click', function () {
        app.finalRound();
      });
    }
    var spin = document.getElementById('raffle-btn-spin');
    if (spin) {
      spin.addEventListener('click', function () {
        app.firstRound();
      });
    }
  }

  function boot() {
    initTelegramWebAppShell();
    bindCommentsChrome();
    new CommentsReveal().run();

    var modals = new ModalStack();
    var startOk = document.getElementById('modal-btn-start-ok');
    if (startOk) {
      startOk.addEventListener('click', function () {
        timerGlobal.stop();
        modals.closeAll();
      });
    }

    loadPrizesConfig(function (err, payload) {
      var data = payload;
      if (err || !data || !data.cards || !data.cards.length) {
        if (err) console.warn('[Roulette]', err.message || err);
        data = parsePrizesPayload(DEFAULT_PRIZES_PAYLOAD);
      }
      initAfterConfig(modals, data);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : this);
