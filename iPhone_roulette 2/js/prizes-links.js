/**
 * Страница ссылок: загрузка prizes.json, Base64(id) для ?win=, копирование.
 */
(function () {
  'use strict';

  var CONFIG = {
    prizesJsonUrl: './data/prizes.json',
    prizesJsonRevision: 1,
    roulettePath: 'index.html',
    queryParam: 'win',
  };

  function parseJsonText(text) {
    return JSON.parse(String(text || '').replace(/^\uFEFF/, '').trim());
  }

  function cardIdToBase64(id) {
    try {
      return btoa(String(id));
    } catch (e) {
      return '';
    }
  }

  function defaultRouletteBaseHref() {
    try {
      var u = new URL(CONFIG.roulettePath, window.location.href);
      return u.href.replace(/[?#].*$/, '');
    } catch (e) {
      return CONFIG.roulettePath;
    }
  }

  function buildPrizeUrl(baseHref, cardId) {
    var b64 = cardIdToBase64(cardId);
    var sep = baseHref.indexOf('?') === -1 ? '?' : '&';
    return baseHref + sep + CONFIG.queryParam + '=' + encodeURIComponent(b64);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function copyText(text, btn) {
    function ok() {
      if (btn) {
        var t = btn.textContent;
        btn.textContent = 'Скопировано';
        setTimeout(function () {
          btn.textContent = t;
        }, 1500);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(function () {
        fallbackCopy(text, ok);
      });
    } else {
      fallbackCopy(text, ok);
    }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (done) done();
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function renderTable(tbody, cards, baseHref, title) {
    if (!cards.length) return;
    var trHead = document.createElement('tr');
    trHead.className = 'prizes-links__subhead';
    trHead.innerHTML =
      '<td colspan="5"><strong>' +
      escapeHtml(title) +
      '</strong> (' +
      cards.length +
      ')</td>';
    tbody.appendChild(trHead);

    var i;
    for (i = 0; i < cards.length; i++) {
      var c = cards[i];
      var b64 = cardIdToBase64(c.id);
      var fullUrl = buildPrizeUrl(baseHref, c.id);
      var tr = document.createElement('tr');
      var imgCell = c.img
        ? '<img class="prizes-links__thumb" src="' + escapeHtml(c.img) + '" alt="">'
        : '<span class="prizes-links__noimg">—</span>';

      tr.innerHTML =
        '<td class="prizes-links__td-img">' +
        imgCell +
        '</td>' +
        '<td><code>' +
        c.id +
        '</code></td>' +
        '<td>' +
        escapeHtml(c.title || '—') +
        '</td>' +
        '<td><code>' +
        escapeHtml(c.code || '—') +
        '</code></td>' +
        '<td class="prizes-links__td-actions">' +
        '<div class="prizes-links__action-stack">' +
        '<button type="button" class="prizes-links__btn prizes-links__btn--ghost" data-copy="b64" title="Base64 от id для параметра win">Код win</button>' +
        '<button type="button" class="prizes-links__btn" data-copy="url" title="Полная ссылка с параметром win">Ссылка</button>' +
        '</div></td>';

      var btnB64 = tr.querySelector('[data-copy="b64"]');
      if (btnB64) {
        btnB64.addEventListener('click', function (payload, btn) {
          return function () {
            copyText(payload, btn);
          };
        }(b64, btnB64));
      }

      var btnUrl = tr.querySelector('[data-copy="url"]');
      if (btnUrl) {
        btnUrl.addEventListener('click', function (url, btn) {
          return function () {
            copyText(url, btn);
          };
        }(fullUrl, btnUrl));
      }

      tbody.appendChild(tr);
    }
  }

  function run() {
    var statusEl = document.getElementById('prizes-links-status');
    var tbody = document.getElementById('prizes-links-tbody');
    var baseInput = document.getElementById('prizes-links-base');
    if (!tbody || !baseInput) return;

    baseInput.value = defaultRouletteBaseHref();

    function rebuild() {
      var baseHref = String(baseInput.value || '').trim() || defaultRouletteBaseHref();
      var rows = tbody.querySelectorAll('tr');
      var i;
      for (i = 0; i < rows.length; i++) {
        rows[i].remove();
      }
      if (!window.__PRIZES_LINKS_CARDS) return;

      var payload = window.__PRIZES_LINKS_CARDS;

      var prizes = [];
      var retries = [];
      var j;
      for (j = 0; j < payload.cards.length; j++) {
        var card = payload.cards[j];
        if (card.isRetry) retries.push(card);
        else prizes.push(card);
      }

      renderTable(tbody, prizes, baseHref, 'Призы (финальный спин)');
      renderTable(tbody, retries, baseHref, 'Доп. попытка');
    }

    baseInput.addEventListener('input', rebuild);
    baseInput.addEventListener('change', rebuild);

    var url =
      CONFIG.prizesJsonUrl +
      (CONFIG.prizesJsonUrl.indexOf('?') === -1 ? '?' : '&') +
      'r=' +
      (CONFIG.prizesJsonRevision | 0);

    if (window.location.protocol === 'file:') {
      if (statusEl) {
        statusEl.textContent =
          'Откройте страницу через HTTP (npm run dev), иначе prizes.json не загрузится.';
        statusEl.className = 'prizes-links__status prizes-links__status--warn';
      }
      return;
    }

    fetch(url, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        var data = parseJsonText(text);
        if (!data.cards || !data.cards.length) throw new Error('Нет cards');
        var retrySet = {};
        var ri;
        if (Array.isArray(data.retryCardIds)) {
          for (ri = 0; ri < data.retryCardIds.length; ri++) {
            var rx = parseInt(data.retryCardIds[ri], 10);
            if (!isNaN(rx)) retrySet[rx] = true;
          }
        }
        var normalized = [];
        var seen = {};
        var k;
        for (k = 0; k < data.cards.length; k++) {
          var c = data.cards[k];
          if (!c || typeof c !== 'object') continue;
          var idNum = parseInt(c.id, 10);
          if (isNaN(idNum) || seen[idNum]) continue;
          seen[idNum] = true;
          var isR = retrySet[idNum] === true || c.isRetry === true;
          normalized.push({
            id: idNum,
            code: String(c.code != null ? c.code : ''),
            img: String(c.img != null ? c.img : ''),
            title: String(c.title != null ? c.title : ''),
            isRetry: isR,
          });
        }
        window.__PRIZES_LINKS_CARDS = { cards: normalized, retryCardIds: data.retryCardIds || [] };
        if (statusEl) {
          statusEl.textContent = 'Загружено карточек: ' + normalized.length;
          statusEl.className = 'prizes-links__status';
        }
        rebuild();
      })
      .catch(function (e) {
        if (statusEl) {
          statusEl.textContent = 'Ошибка загрузки: ' + (e.message || e);
          statusEl.className = 'prizes-links__status prizes-links__status--warn';
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
