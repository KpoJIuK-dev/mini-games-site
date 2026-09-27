/**
 * Время у имитированных комментариев: коротко HH:MM, шаг +35 мин сверху вниз,
 * якорь первого комментария хранится в localStorage.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ff_roulette_sim_comments_anchor_ts';
  var STEP_MS = 35 * 60 * 1000;

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatHm(d) {
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function getAnchorFirstCommentTs(count) {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw != null && raw !== '') {
      var t = parseInt(raw, 10);
      if (!isNaN(t)) return t;
    }
    var lastIdx = Math.max(0, count - 1);
    var anchor = Date.now() - lastIdx * STEP_MS;
    try {
      localStorage.setItem(STORAGE_KEY, String(anchor));
    } catch (e) {}
    return anchor;
  }

  function run() {
    var nodes = document.querySelectorAll('.comments-main > .comments-item .comments-time');
    var n = nodes.length;
    if (!n) return;

    var anchor = getAnchorFirstCommentTs(n);
    var i;
    for (i = 0; i < n; i++) {
      var ts = anchor + i * STEP_MS;
      nodes[i].textContent = formatHm(new Date(ts));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
