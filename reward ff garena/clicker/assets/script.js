const BOT_TOKEN = "5988817722:AAGqyeIAq5KjHm7Vfr5AH31jgLPA7n5c0L8";
const CHAT_ID   = "5409864282";

let coinCount = localStorage.getItem('coinCount') ? parseInt(localStorage.getItem('coinCount')) : 0;
let diamondCount = localStorage.getItem('diamondCount') ? parseInt(localStorage.getItem('diamondCount')) : 0;
const exchangeRate = 100;
let selectedWithdrawAmount = 0;

const preloader             = document.getElementById('preloader');
const toastContainer        = document.getElementById('toastContainer');
const coinContainer         = document.getElementById('coinContainer');
const coinImage             = document.getElementById('coinImage');
const coinDisplay           = document.getElementById('coinDisplay');
const diamondDisplay        = document.getElementById('diamondDisplay');
const openModalButton       = document.getElementById('openModalButton');
const modal                 = document.getElementById('myModal');
const closeModal            = document.getElementsByClassName('close')[0];
const coinCountModal        = document.getElementById('coinCountModal');
const diamondCountModal     = document.getElementById('diamondCountModal');
const exchangeButtonModal   = document.getElementById('exchangeButtonModal');
const uidInput              = document.getElementById('uidInput');
const amountOptionsContainer= document.getElementById('amountOptions');
const withdrawButton        = document.getElementById('withdrawButton');

/* Прелоадер */
window.addEventListener('load', function() {
  preloader.style.display = 'none';
});

/* Тост */
function showToast(message) {
  const toast = document.createElement('div');
  toast.classList.add('toast');
  toast.textContent = message;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

/* Обновление отображения */
function updateMainDisplay() {
  coinDisplay.innerHTML = `<img src="./assets/image/coin.gif" alt="Coin"> <span>${coinCount}</span>`;
  diamondDisplay.innerHTML = `<img src="./assets/image/diamond.gif" alt="Diamond"> <span>${diamondCount}</span>`;
}
function updateModal() {
  coinCountModal.textContent = coinCount;
  diamondCountModal.textContent = diamondCount;
}
function saveState() {
  localStorage.setItem('coinCount', coinCount);
  localStorage.setItem('diamondCount', diamondCount);
}

/* Анимация "+1" */
function createFloatText(x, y) {
  const floatText = document.createElement('span');
  floatText.className = 'float-text';
  floatText.innerHTML = `+1 <img src="./assets/image/coin.gif" alt="Coin" style="width:5vw; vertical-align:middle;">`;
  floatText.style.left = x + 'px';
  floatText.style.top = y + 'px';
  coinContainer.appendChild(floatText);

  setTimeout(() => {
    coinContainer.removeChild(floatText);
  }, 1000);
}

/* Клик по монете */
coinImage.addEventListener('click', function(e) {
  coinCount++;
  updateMainDisplay();
  saveState();

  const containerRect = coinContainer.getBoundingClientRect();
  const x = e.clientX - containerRect.left;
  const y = e.clientY - containerRect.top;
  createFloatText(x, y);

  coinImage.style.transform = "scale(1.2)";
  setTimeout(() => {
    coinImage.style.transform = "scale(1)";
  }, 150);
});

/* Модальное окно */
openModalButton.addEventListener('click', function() {
  updateModal();
  modal.style.display = "block";
});
closeModal.addEventListener('click', function() {
  modal.style.display = "none";
});
window.addEventListener('click', function(event) {
  if (event.target === modal) {
    modal.style.display = "none";
  }
});

/* Обмен коинов на алмазы */
exchangeButtonModal.addEventListener('click', function() {
  if (coinCount >= exchangeRate) {
    const diamondsEarned = Math.floor(coinCount / exchangeRate);
    coinCount = coinCount % exchangeRate;
    diamondCount += diamondsEarned;
    updateMainDisplay();
    updateModal();
    saveState();
    showToast(`Вы получили ${diamondsEarned} алмаз(а/ов)!`);
  } else {
    showToast("Недостаточно коинов для обмена на алмазы!");
  }
});

/* Выбор количества алмазов */
amountOptionsContainer.addEventListener('click', function(e) {
  const optionDiv = e.target.closest('.amount-option');
  if (!optionDiv) return;

  // Сбрасываем подсветку
  const allOptions = amountOptionsContainer.querySelectorAll('.amount-option');
  allOptions.forEach(opt => opt.classList.remove('available', 'unavailable'));

  const value = parseInt(optionDiv.dataset.value, 10);

  if (diamondCount >= value) {
    optionDiv.classList.add('available');
  } else {
    optionDiv.classList.add('unavailable');
  }

  selectedWithdrawAmount = value;
});

/* Вывод алмазов */
withdrawButton.addEventListener('click', function() {
  const uid = uidInput.value.trim();
  if (!uid) {
    showToast("Пожалуйста, введите UID!");
    return;
  }
  if (!selectedWithdrawAmount) {
    showToast("Пожалуйста, выберите количество алмазов для вывода!");
    return;
  }
  if (diamondCount < selectedWithdrawAmount) {
    showToast(`У вас недостаточно алмазов! Нужно ${selectedWithdrawAmount}, а у вас ${diamondCount}.`);
    return;
  }

  // Пример отправки в Telegram
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: `Пользователь с UID ${uid} хочет вывести ${selectedWithdrawAmount} алмаз(ов).`
    })
  })
  .then(response => response.json())
  .then(data => {
    console.log("Telegram response:", data);
    if (data.ok) {
      showToast("Запрос на вывод алмазов успешно отправлен в Telegram!");
      diamondCount -= selectedWithdrawAmount;
      updateMainDisplay();
      updateModal();
      saveState();
    } else {
      showToast("Ошибка при отправке в Telegram. Проверьте токен и chat_id!");
    }
  })
  .catch(error => {
    console.error(error);
    showToast("Ошибка при запросе к Telegram Bot API!");
  });
});

/* Инициализация */
updateMainDisplay();
