(function () {
  "use strict";

  var form = document.getElementById("eat-form");
  var input = document.getElementById("eat-input");
  var error = document.getElementById("eat-error");
  var button = document.getElementById("eat-button");
  var card = document.getElementById("account-card");
  var accountLine = document.getElementById("account-line");
  var signatureLine = document.getElementById("signature-line");
  var holdLine = document.getElementById("hold-line");
  var consent = document.getElementById("consent");
  var parsed = null;
  var pendingToken = "";
  var consentButton = document.getElementById("consent-button");

  document.getElementById("promo-preview").innerHTML = FFAccount.renderSignature(FFAccount.signatureText);

  document.getElementById("copy-signature").addEventListener("click", function () {
    var text = FFAccount.signatureText;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        holdLine.textContent = "Текст подписи скопирован. Вставь его в профиль Free Fire.";
      }).catch(function () {
        holdLine.textContent = text;
      });
      return;
    }
    holdLine.textContent = text;
  });

  function showError(message) {
    error.hidden = !message;
    error.textContent = message || "";
  }

  function paint(session) {
    card.hidden = false;
    var nick = document.createElement("span");
    nick.className = "raw-name";
    nick.textContent = FFAccount.decodeNick(session.nickname) || "Без ника";
    accountLine.replaceChildren(
      nick,
      document.createTextNode(" · UID " + session.uid + " · " + (session.region || "RU") + " · ур. " + (session.level || "—"))
    );
    signatureLine.replaceChildren();
    if (session.signature) {
      signatureLine.append(document.createTextNode("Подпись сейчас: "));
      var live = document.createElement("span");
      live.className = "raw-name";
      live.innerHTML = FFAccount.renderSignature(session.signature);
      signatureLine.append(live);
    } else {
      signatureLine.textContent = "Подпись пустая.";
    }
    consent.checked = Boolean(session.consentAt);
    var view = FFAccount.status(session);
    if (!session.consentAt) {
      holdLine.textContent = "Согласие ещё не отмечено. Неделя не идёт.";
    } else if (view.code === "missing") {
      holdLine.textContent = "В подписи нет " + FFAccount.PROMO + ". Неделя начнётся, когда текст там появится, и сбросится, если его убрать.";
    } else if (view.code === "holding") {
      holdLine.textContent = "Промо на месте. До вывода " + FFAccount.formatLeft(view.left) + ".";
    } else if (view.code === "ready") {
      holdLine.textContent = "Семь дней прошли, промо на месте. Вывод в зале открыт.";
    }
  }

  function remember(profile, consentAt) {
    var session = FFAccount.load() || {};
    var same = session.uid === profile.uid;
    session.uid = profile.uid;
    session.nickname = profile.nickname || session.nickname || parsed.nickname || "";
    session.region = profile.region || parsed.region || "RU";
    session.level = profile.level || 0;
    session.consentAt = consentAt || (same ? session.consentAt : 0) || 0;
    session.promoSince = same ? (session.promoSince || 0) : 0;
    FFAccount.applyHold(session, profile.signature || "");
    FFAccount.save(session);
    paint(session);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    showError("");
    parsed = FFAccount.parseInput(input.value);
    if (parsed.error) {
      showError(parsed.error);
      return;
    }
    if (!parsed.uid) {
      showError("В ссылке нет account_id. Нужна полная строка из адреса после входа, не один голый токен.");
      return;
    }
    button.disabled = true;
    FFAccount.fetchProfile(parsed.uid, parsed.region).then(function (profile) {
      pendingToken = input.value.trim();
      input.value = "";
      remember(profile, 0);
    }).catch(function (cause) {
      showError(cause.message || "Не удалось прочитать профиль.");
    }).then(function () {
      button.disabled = false;
    });
  });

  document.getElementById("consent-button").addEventListener("click", function () {
    var session = FFAccount.load();
    if (!session) {
      showError("Сначала прочитай аккаунт.");
      return;
    }
    if (!consent.checked) {
      showError("Нужна галочка: ты владелец и согласен держать промо неделю.");
      return;
    }
    if (!pendingToken) {
      showError("Вставь ссылку с eat= ещё раз. Она нужна, чтобы записать подпись, и на устройстве не хранится.");
      return;
    }
    showError("");
    consentButton.disabled = true;
    holdLine.textContent = "Записываем подпись в профиль…";
    var token = pendingToken;
    FFAccount.writeSignature(token, session.region).then(function () {
      pendingToken = "";
      session.consentAt = session.consentAt || Date.now();
      FFAccount.applyHold(session, session.signature);
      FFAccount.save(session);
      return FFAccount.refresh().catch(function () {
        return FFAccount.load();
      });
    }).then(function (next) {
      paint(next || FFAccount.load());
      if (next && FFAccount.hasPromo(next.signature)) {
        holdLine.textContent = "Подпись записана. " + holdLine.textContent;
      } else {
        holdLine.textContent = "Подпись отправлена. Когда она появится в профиле, нажми «Проверить подпись» — с этого момента пойдёт неделя.";
      }
    }).catch(function (cause) {
      var message = "Не удалось записать подпись.";
      if (cause && cause.name === "TimeoutError") message = "Сервер подписи долго не отвечает. Нажми ещё раз.";
      else if (cause instanceof TypeError) message = "Не удалось связаться с сервером подписи.";
      else if (cause && cause.message) message = cause.message;
      showError(message);
      holdLine.textContent = "Подпись не записалась. Можно нажать ещё раз или вставить ссылку заново.";
    }).then(function () {
      consentButton.disabled = false;
    });
  });

  document.getElementById("recheck-button").addEventListener("click", function () {
    var session = FFAccount.load();
    if (!session) return;
    FFAccount.refresh().then(function (next) {
      paint(next);
    }).catch(function (cause) {
      showError(cause.message || "Профиль не прочитался.");
    });
  });

  var existing = FFAccount.load();
  if (existing) {
    paint(existing);
    FFAccount.refresh().then(paint).catch(function () {});
  }
})();
