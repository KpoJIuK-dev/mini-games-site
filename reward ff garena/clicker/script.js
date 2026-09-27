document.addEventListener("DOMContentLoaded", function() {
  /* ===================== Переменные кликера ===================== */
  let coins = 0;
  let diamonds = 0;

  /* Функции обновления отображения */
  function updateCoinDisplay() {
    document.querySelector("#coinDisplay span").innerText = coins;
  }
  function updateDiamondDisplay() {
    document.querySelector("#diamondDisplay span").innerText = diamonds;
  }

  /* Функция показа тоста */
  function showToast(message) {
    const toastContainer = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("show");
    }, 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toastContainer.removeChild(toast);
      }, 300);
    }, 3000);
  }

  /* ===================== Логика Clicker Game ===================== */
  // Клик по монете
  document.getElementById("coinImage").addEventListener("click", function() {
    coins++;
    updateCoinDisplay();
    // Можно добавить анимацию "+1"
  });

  /* Логика модального окна обмена */
  function openExchangeModal() {
    document.getElementById("myModal").style.display = "block";
    document.getElementById("coinCountModal").innerText = coins;
    document.getElementById("diamondCountModal").innerText = diamonds;
  }
  function closeExchangeModal() {
    document.getElementById("myModal").style.display = "none";
  }
  document.getElementById("openModalButton").addEventListener("click", openExchangeModal);
  document.getElementById("closeExchangeModal").addEventListener("click", closeExchangeModal);

  /* Здесь можно добавить обработку кнопок обмена, выбора количества и вывода алмазов */

  /* ===================== Интеграция игры "Найди пару" ===================== */
  // Запуск игры "Найди пару" по кнопке, если достаточно алмазов
  document.getElementById("startPairGameButton").addEventListener("click", function() {
    if(diamonds >= 10) {
      diamonds -= 10;
      updateDiamondDisplay();
      openPairGameModal();
    } else {
      showToast("Недостаточно алмазов для запуска игры 'Найди пару'!");
    }
  });

  // Обработчик закрытия модального окна игры "Найди пару"
  document.getElementById("closePairGameModal").addEventListener("click", function() {
    closePairGameModal();
  });

  // Обработка кнопки "Забрать" награду по итогам игры "Найди пару"
  document.getElementById("claimPairGameReward").addEventListener("click", function() {
    diamonds += pairGameEarned;
    updateDiamondDisplay();
    closePairGameModal();
  });

  /* ===================== Логика игры "Найди пару" ===================== */
  let pairGameEarned = 0;
  let firstCard = null;
  let secondCard = null;
  let matchedPairs = 0;
  const totalPairs = 24; // 24 пары = 48 карточек

  function openPairGameModal() {
    document.getElementById("pairGameModal").style.display = "block";
    initializePairGame();
  }

  function closePairGameModal() {
    document.getElementById("pairGameModal").style.display = "none";
    resetPairGame();
  }

  function resetPairGame() {
    pairGameEarned = 0;
    firstCard = null;
    secondCard = null;
    matchedPairs = 0;
    document.getElementById("pairGameBoard").innerHTML = "";
    document.getElementById("pairGameDiamondsEarned").innerText = "0";
  }

  function initializePairGame() {
    const board = document.getElementById("pairGameBoard");
    board.innerHTML = "";
    let cards = [];
    // Создаём 24 пары карточек
    for (let i = 1; i <= totalPairs; i++) {
      cards.push({ id: i, content: i });
      cards.push({ id: i, content: i });
    }
    // Перемешиваем карточки
    cards.sort(() => 0.5 - Math.random());

    // Создаём элементы карточек
    cards.forEach(card => {
      const cardElem = document.createElement("div");
      cardElem.classList.add("card");
      cardElem.dataset.id = card.id;

      // Внутренняя структура для эффекта переворота
      const inside = document.createElement("div");
      inside.classList.add("inside");

      const front = document.createElement("div");
      front.classList.add("front");
      front.innerText = card.content; // Можно заменить на изображение

      const back = document.createElement("div");
      back.classList.add("back");
      // Оформление задней стороны карточки по желанию

      inside.appendChild(front);
      inside.appendChild(back);
      cardElem.appendChild(inside);

      // Обработчик клика по карточке
      cardElem.addEventListener("click", function() {
        flipCard(cardElem);
      });

      board.appendChild(cardElem);
    });
  }

  function flipCard(cardElem) {
    if (cardElem.classList.contains("flipped") || cardElem.classList.contains("matched")) return;
    cardElem.classList.add("flipped");

    if (!firstCard) {
      firstCard = cardElem;
    } else if (!secondCard) {
      secondCard = cardElem;
      checkForMatch();
    }
  }

  function checkForMatch() {
    if (firstCard.dataset.id === secondCard.dataset.id) {
      // Найдена пара: отмечаем как найденную
      firstCard.classList.add("matched");
      secondCard.classList.add("matched");
      pairGameEarned += 2; // 2 алмаза за пару
      matchedPairs++;
      document.getElementById("pairGameDiamondsEarned").innerText = pairGameEarned;
      resetTurn();

      // Если все пары найдены, даём бонус +2 алмаза
      if (matchedPairs === totalPairs) {
        pairGameEarned += 2;
        document.getElementById("pairGameDiamondsEarned").innerText = pairGameEarned;
        showToast("Поздравляем! Вы нашли все пары!");
      }
    } else {
      // Если не совпадает, возвращаем карточки в исходное состояние
      setTimeout(() => {
        firstCard.classList.remove("flipped");
        secondCard.classList.remove("flipped");
        resetTurn();
      }, 1000);
    }
  }

  function resetTurn() {
    firstCard = null;
    secondCard = null;
  }
  
  /* Инициализация начальных значений */
  updateCoinDisplay();
  updateDiamondDisplay();
});
