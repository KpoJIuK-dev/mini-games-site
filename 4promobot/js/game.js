(function () {
  "use strict";

  var BOT_URL = "https://t.me/ffcis_bot?start=start";
  var ASSET_DIAMOND = "assets/diamond.png";
  var ASSET_MINE = "assets/mine.png";

  var COLS = 5;
  var ROWS = 5;
  var MINE_COUNT = 5;

  var LABEL_CLAIM = "Забрать";
  var LABEL_PLAY_AGAIN = "Играть снова";

  var LEAVE_MS = 920;
  var CHAR_DELAY_CAP = 36;

  var introScreen = document.getElementById("introScreen");
  var btnEnterGame = document.getElementById("btnEnterGame");
  var gameRoot = document.getElementById("gameRoot");
  var gridEl = document.getElementById("grid");
  var diamondEl = document.getElementById("diamondCount");
  var minesLeftEl = document.getElementById("minesLeft");
  var btnClaim = document.getElementById("btnClaim");

  var state = {
    cells: [],
    revealed: 0,
    diamonds: 0,
    ended: false,
    lost: false,
  };

  var gameReady = false;
  var transitionPending = false;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function splitIntroText() {
    document.querySelectorAll("[data-intro-split]").forEach(function (el) {
      var text = el.textContent;
      el.textContent = "";
      var i = 0;
      var k;
      for (k = 0; k < text.length; k++) {
        var ch = text[k];
        var span = document.createElement("span");
        span.className = "intro-char";
        if (ch === " ") {
          span.classList.add("intro-char--space");
          span.innerHTML = "\u00a0";
        } else {
          span.textContent = ch;
        }
        span.style.setProperty("--i", String(Math.min(i, CHAR_DELAY_CAP)));
        i++;
        el.appendChild(span);
      }
    });
  }

  function scatterIntroChars() {
    document.querySelectorAll(".intro-char").forEach(function (span) {
      var tx = (Math.random() - 0.5) * 220;
      var ty = Math.random() * 160 + 30;
      var rot = (Math.random() - 0.5) * 100;
      span.style.setProperty("--tx", tx + "px");
      span.style.setProperty("--ty", ty + "px");
      span.style.setProperty("--rot", rot + "deg");
    });
  }

  function enterGame() {
    if (gameReady) return;
    gameReady = true;
    transitionPending = false;

    document.body.classList.remove("phase-intro");
    document.body.classList.add("phase-game");
    introScreen.hidden = true;
    introScreen.classList.remove("intro-screen--leaving");

    gameRoot.hidden = false;
    gameRoot.removeAttribute("inert");

    buildField();
    renderGrid();
  }

  function startEnterTransition() {
    if (gameReady || transitionPending) return;

    if (prefersReducedMotion()) {
      enterGame();
      return;
    }

    transitionPending = true;
    scatterIntroChars();
    introScreen.classList.add("intro-screen--leaving");
    btnEnterGame.disabled = true;

    window.setTimeout(function () {
      enterGame();
    }, LEAVE_MS);
  }

  function randomInt(max) {
    return Math.floor(Math.random() * max);
  }

  function shuffle(arr) {
    var i = arr.length;
    while (i > 1) {
      var j = randomInt(i);
      i--;
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function buildField() {
    var total = COLS * ROWS;
    var types = [];
    var m;
    for (m = 0; m < MINE_COUNT; m++) types.push("mine");
    while (types.length < total) types.push("diamond");
    shuffle(types);

    state.cells = [];
    state.revealed = 0;
    state.diamonds = 0;
    state.ended = false;
    state.lost = false;

    var idx = 0;
    var r, c;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        state.cells.push({
          row: r,
          col: c,
          type: types[idx],
          revealed: false,
        });
        idx++;
      }
    }

    minesLeftEl.textContent = String(MINE_COUNT);
    diamondEl.textContent = "0";
    updateClaimButton();
  }

  function diamondReward() {
    return 50 + randomInt(151);
  }

  function updateClaimButton() {
    btnClaim.href = BOT_URL;

    if (state.lost) {
      btnClaim.className = "btn btn-accent";
      btnClaim.textContent = LABEL_PLAY_AGAIN;
      btnClaim.classList.remove("is-disabled");
      btnClaim.setAttribute("aria-disabled", "false");
      return;
    }

    btnClaim.className = "btn btn-primary";
    btnClaim.textContent = LABEL_CLAIM;

    if (state.diamonds > 0 && !state.ended) {
      btnClaim.classList.remove("is-disabled");
      btnClaim.setAttribute("aria-disabled", "false");
    } else {
      btnClaim.classList.add("is-disabled");
      btnClaim.setAttribute("aria-disabled", "true");
    }
  }

  function cellIcon(src, label) {
    var img = document.createElement("img");
    img.className = "cell-icon";
    img.src = src;
    img.alt = label;
    img.width = 64;
    img.height = 64;
    img.decoding = "async";
    img.draggable = false;
    return img;
  }

  function renderGrid() {
    gridEl.style.setProperty("--cols", String(COLS));
    gridEl.innerHTML = "";

    state.cells.forEach(function (cell, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.setAttribute("role", "gridcell");
      btn.setAttribute("aria-label", "Клетка " + (i + 1));
      btn.dataset.index = String(i);

      if (cell.revealed) {
        btn.classList.add("open");
        btn.disabled = true;
        if (cell.type === "mine") {
          btn.classList.add("mine");
          btn.appendChild(cellIcon(ASSET_MINE, "Мина"));
          btn.setAttribute("aria-label", "Мина");
        } else {
          btn.classList.add("diamond");
          btn.appendChild(cellIcon(ASSET_DIAMOND, "Алмаз"));
          btn.setAttribute("aria-label", "Алмаз");
        }
      }

      btn.addEventListener("click", function () {
        onCellClick(i);
      });
      gridEl.appendChild(btn);
    });
  }

  function revealAllMines() {
    state.cells.forEach(function (cell) {
      if (cell.type === "mine") cell.revealed = true;
    });
  }

  function onCellClick(index) {
    if (state.ended) return;
    var cell = state.cells[index];
    if (cell.revealed) return;

    cell.revealed = true;
    state.revealed++;

    if (cell.type === "mine") {
      state.ended = true;
      state.lost = true;
      state.diamonds = 0;
      diamondEl.textContent = "0";
      revealAllMines();
      renderGrid();
      updateClaimButton();
      return;
    }

    var gain = diamondReward();
    state.diamonds += gain;
    diamondEl.textContent = String(state.diamonds);
    renderGrid();
    updateClaimButton();
  }

  btnClaim.addEventListener("click", function (e) {
    if (btnClaim.classList.contains("is-disabled")) {
      e.preventDefault();
    }
  });

  splitIntroText();
  btnEnterGame.addEventListener("click", startEnterTransition);
})();
