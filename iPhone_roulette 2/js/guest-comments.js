/**
 * Комментарии гостя: localStorage, снизу списка, порядок старые → новые, относительное время.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ff_roulette_guest_comments';
  var MAX_ITEMS = 80;
  var AVATAR_SRC = 'img/noava.jpg';
  var RELATIVE_TICK_MS = 30000;
  var MONTHS_SHORT = [
    'янв',
    'фев',
    'мар',
    'апр',
    'мая',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'ноя',
    'дек',
  ];

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatHm(d) {
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function loadList() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveList(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  /** Человекочитаемо от текущего момента now (мс). */
  function formatRelativeTimeRu(ts, now) {
    var diffMs = now - ts;
    if (diffMs < 0) diffMs = 0;
    var sec = Math.floor(diffMs / 1000);
    var dThen = new Date(ts);
    var dNow = new Date(now);

    if (sec < 50) return 'только что';

    if (sec < 3600) {
      var m = Math.floor(sec / 60);
      if (m < 1) m = 1;
      return m + ' мин назад';
    }

    if (sec < 86400) {
      var h = Math.floor(sec / 3600);
      if (h < 1) h = 1;
      return h + ' ч назад';
    }

    var startToday = new Date(dNow.getFullYear(), dNow.getMonth(), dNow.getDate()).getTime();
    var startThen = new Date(dThen.getFullYear(), dThen.getMonth(), dThen.getDate()).getTime();
    var dayDiff = Math.round((startToday - startThen) / 86400000);

    var hm = formatHm(dThen);

    if (dayDiff === 0) return 'сегодня в ' + hm;
    if (dayDiff === 1) return 'вчера в ' + hm;
    if (dayDiff === 2) return 'позавчера в ' + hm;
    if (dayDiff > 2 && dayDiff < 7) return dayDiff + ' дн. назад';

    var mo = MONTHS_SHORT[dThen.getMonth()] || '';
    return dThen.getDate() + ' ' + mo + ' ' + dThen.getFullYear() + ', ' + hm;
  }

  function refreshTimes(mount) {
    var now = Date.now();
    var nodes = mount.querySelectorAll('.guest-comment__time[data-ts]');
    var i;
    for (i = 0; i < nodes.length; i++) {
      var raw = nodes[i].getAttribute('data-ts');
      var ts = parseInt(raw, 10);
      if (isNaN(ts)) continue;
      nodes[i].textContent = formatRelativeTimeRu(ts, now);
    }
  }

  function renderItem(c) {
    var text = String(c.text || '').trim();
    var id = c.id != null ? String(c.id).replace(/[^\d-]/g, '') : '';
    var ts = c.ts != null ? parseInt(c.ts, 10) : 0;
    var tsAttr = isNaN(ts) ? '0' : String(ts);
    var timeLabel = formatRelativeTimeRu(ts, Date.now());

    return (
      '<div class="comments-item isvisible guest-comment" data-guest-id="' +
      escapeHtml(id) +
      '">' +
      '<div class="comments-item__wrap">' +
      '<div class="comments-item__img">' +
      '<img src="' +
      escapeHtml(AVATAR_SRC) +
      '" alt="">' +
      '</div>' +
      '<div class="comments-content">' +
      '<div class="comments-name">Гость</div>' +
      '<div class="comments-text">' +
      escapeHtml(text) +
      '</div>' +
      '<div class="comments-time guest-comment__time" data-ts="' +
      escapeHtml(tsAttr) +
      '">' +
      escapeHtml(timeLabel) +
      '</div>' +
      '<div class="comments-links">Нравится · <span>Ответить</span></div>' +
      '</div></div></div>'
    );
  }

  function renderAll(mount, list) {
    var sorted = list.slice().sort(function (a, b) {
      return (a.ts || 0) - (b.ts || 0);
    });
    mount.innerHTML = sorted.map(renderItem).join('');
  }

  function submit(mount, textInput, btn) {
    var text = String(textInput.value || '').trim();
    if (!text) {
      textInput.focus();
      return;
    }
    var ts = Date.now();
    var item = { id: ts, text: text.slice(0, 500), ts: ts };

    var list = loadList();
    list.push(item);
    if (list.length > MAX_ITEMS) {
      list = list.slice(list.length - MAX_ITEMS);
    }
    saveList(list);
    renderAll(mount, list);
    textInput.value = '';
    var orig = btn.textContent;
    btn.textContent = 'Готово';
    btn.disabled = true;
    setTimeout(function () {
      btn.textContent = orig;
      btn.disabled = false;
    }, 1200);
  }

  function run() {
    var mount = document.getElementById('guest-comments-mount');
    var textInput = document.getElementById('guest-comment-text');
    var btn = document.getElementById('guest-comment-submit');
    if (!mount || !textInput || !btn) return;

    renderAll(mount, loadList());

    setInterval(function () {
      refreshTimes(mount);
    }, RELATIVE_TICK_MS);

    btn.addEventListener('click', function () {
      submit(mount, textInput, btn);
    });

    textInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit(mount, textInput, btn);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
