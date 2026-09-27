(function () {
  "use strict";

  var KEY = "ff-arcade-account";
  var promo = window.FFPromo || {};
  var PROMO = String(promo.marker || "garena.win");
  var SIGNATURE = String(promo.signature || PROMO);
  var WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  function decodeNick(value) {
    var text = String(value || "").trim();
    var i;
    for (i = 0; i < 3; i += 1) {
      if (!/%[0-9A-Fa-f]{2}/.test(text)) break;
      try {
        var next = decodeURIComponent(text.replace(/\+/g, " "));
        if (next === text) break;
        text = next;
      } catch (err) {
        break;
      }
    }
    text = text.replace(/\\u([0-9a-fA-F]{4})/g, function (_, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
    return text.slice(0, 64);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function renderSignature(raw) {
    var parts = String(raw || "").split(/(\[[A-Fa-f0-9]{6}\]|\[B\]|\[I\]|\[U\]|\[S\]|\[C\])/gi);
    var color = "";
    var bold = false;
    var italic = false;
    var underline = false;
    var strike = false;
    var center = false;
    var html = "";
    parts.forEach(function (part) {
      if (!part) return;
      var up = part.toUpperCase();
      if (/^\[[A-F0-9]{6}\]$/.test(up)) {
        color = up.slice(1, 7);
        return;
      }
      if (up === "[B]") { bold = !bold; return; }
      if (up === "[I]") { italic = !italic; return; }
      if (up === "[U]") { underline = !underline; return; }
      if (up === "[S]") { strike = !strike; return; }
      if (up === "[C]") { center = !center; return; }
      var style = "";
      if (color && /^[A-F0-9]{6}$/.test(color)) style += "color:#" + color + ";";
      if (bold) style += "font-weight:700;";
      if (italic) style += "font-style:italic;";
      if (underline) style += "text-decoration:underline;";
      if (strike) style += "text-decoration:line-through;";
      if (center) style += "display:block;text-align:center;";
      part.split("\n").forEach(function (line, index) {
        if (index) html += "<br>";
        if (!line) return;
        html += style
          ? "<span style=\"" + style + "\">" + escapeHtml(line) + "</span>"
          : escapeHtml(line);
      });
    });
    return html;
  }

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!raw || typeof raw !== "object" || !raw.uid) return null;
      return {
        uid: String(raw.uid).replace(/\D/g, "").slice(0, 20),
        nickname: decodeNick(raw.nickname),
        region: String(raw.region || "RU").slice(0, 8),
        level: Math.max(0, Number(raw.level) || 0),
        signature: String(raw.signature || "").slice(0, 1500),
        consentAt: Math.max(0, Number(raw.consentAt) || 0),
        promoSince: Math.max(0, Number(raw.promoSince) || 0)
      };
    } catch (err) {
      return null;
    }
  }

  function save(session) {
    if (!session || !session.uid) {
      localStorage.removeItem(KEY);
      return;
    }
    var stored = {
      uid: session.uid,
      nickname: session.nickname || "",
      region: session.region || "RU",
      level: session.level || 0,
      signature: session.signature || "",
      consentAt: session.consentAt || 0,
      promoSince: session.promoSince || 0
    };
    localStorage.setItem(KEY, JSON.stringify(stored));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function param(text, name) {
    var match = text.match(new RegExp("[?&#]" + name + "=([^&#\\s]+)", "i"));
    if (!match) return "";
    try {
      return decodeURIComponent(match[1].replace(/\+/g, " "));
    } catch (err) {
      return match[1];
    }
  }

  function parseInput(raw) {
    var text = String(raw || "").trim();
    if (!text) return { error: "Вставь ссылку после входа Garena или сам токен EAT." };
    var eat = "";
    var uid = "";
    var nickname = "";
    var region = "";
    if (/eat=/i.test(text) || /^https?:/i.test(text)) {
      eat = param(text, "eat");
      if (!eat) return { error: "В ссылке нет параметра eat." };
      uid = param(text, "account_id").replace(/\D/g, "");
      nickname = decodeNick(param(text, "nickname"));
      region = param(text, "region");
    } else {
      eat = text.replace(/\s+/g, "");
    }
    if (eat.length < 8) return { error: "Токен слишком короткий." };
    return { eat: eat, uid: uid, nickname: nickname, region: region || "RU" };
  }

  function hasPromo(signature) {
    return String(signature || "").toLowerCase().indexOf(PROMO) !== -1;
  }

  function applyHold(session, signature) {
    session.signature = signature || "";
    if (session.consentAt && hasPromo(session.signature)) {
      if (!session.promoSince) session.promoSince = Date.now();
    } else {
      session.promoSince = 0;
    }
    return session;
  }

  function fetchProfile(uid, region) {
    var query = new URLSearchParams({
      uid: uid,
      region: (region || "RU").toUpperCase(),
      key: "FFLKDEV"
    });
    return fetch("https://uid-info.vercel.app/accinfo?" + query).then(function (response) {
      if (!response.ok) throw new Error("Профиль по этому UID не открылся.");
      return response.json();
    }).then(function (player) {
      var info = player.basicInfo || {};
      var social = player.socialInfo || {};
      if (!info.accountId) throw new Error("В ответе нет аккаунта.");
      return {
        uid: String(info.accountId),
        nickname: decodeNick(info.nickname),
        region: info.region || region || "RU",
        level: Number(info.level) || 0,
        signature: social.signature || ""
      };
    });
  }

  function writeSignature(token, region) {
    var endpoint = String((window.FFPromo && window.FFPromo.bioApi) || "/api/bio");
    var signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout
      ? AbortSignal.timeout(20000)
      : undefined;
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: signal,
      body: JSON.stringify({
        bio: SIGNATURE,
        region: String(region || "").toUpperCase(),
        kind: "eat",
        token: token
      })
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        if (!response.ok || data.ok === false) {
          throw new Error(data.error || "Сервер не записал подпись.");
        }
        return data;
      });
    });
  }

  function refresh() {
    var session = load();
    if (!session) return Promise.resolve(null);
    return fetchProfile(session.uid, session.region).then(function (profile) {
      session.nickname = profile.nickname || session.nickname;
      session.region = profile.region || session.region;
      session.level = profile.level;
      applyHold(session, profile.signature);
      save(session);
      return session;
    });
  }

  function status(session) {
    if (!session || !session.uid) return { code: "guest" };
    if (!session.consentAt) return { code: "consent", session: session };
    if (!session.promoSince || !hasPromo(session.signature)) {
      return { code: "missing", session: session };
    }
    var left = session.promoSince + WEEK_MS - Date.now();
    if (left > 0) return { code: "holding", left: left, session: session };
    return { code: "ready", session: session };
  }

  function formatLeft(ms) {
    var total = Math.ceil(ms / 1000);
    var days = Math.floor(total / 86400);
    var hours = Math.floor((total % 86400) / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    if (days > 0) return days + " дн. " + hours + " ч.";
    if (hours > 0) return hours + " ч. " + minutes + " мин.";
    return Math.max(1, minutes) + " мин.";
  }

  window.FFAccount = {
    PROMO: PROMO,
    signatureText: SIGNATURE,
    decodeNick: decodeNick,
    renderSignature: renderSignature,
    writeSignature: writeSignature,
    WEEK_MS: WEEK_MS,
    load: load,
    save: save,
    clear: clear,
    parseInput: parseInput,
    hasPromo: hasPromo,
    applyHold: applyHold,
    fetchProfile: fetchProfile,
    refresh: refresh,
    status: status,
    formatLeft: formatLeft
  };
})();
