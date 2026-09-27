window.addEventListener("load", function() {
    const preloader = document.querySelector(".preloader");
    preloader.style.display = "none"; // Скрываем прелоадер после загрузки страницы
});

(function(){
    var Memory = {
        timer: null,
        timeLeft: 300, // Время в секундах (5 минут)
        score: 0,
        prize: 0, // Переменная для накопления награды в алмазах
        timerStarted: false, // Убедимся, что таймер запускается только один раз

        init: function(cards){
            this.$game = $(".game");
            this.$modal = $(".modal");
            this.$overlay = $(".modal-overlay").hide(); // Скрываем overlay при инициализации
            this.$timerDisplay = $(".timer"); // Элемент для отображения таймера
            this.$scoreDisplay = $(".score"); // Элемент для отображения очков
            this.$claimButton = $(".claim").click(this.claimReward.bind(this));
            this.cardsArray = $.merge(cards, cards);
            this.shuffleCards(this.cardsArray);
            this.setup();
            this.updateTimerDisplay();
            this.updateScoreDisplay();
        },

        shuffleCards: function(cardsArray){
            this.$cards = $(this.shuffle(this.cardsArray));
        },

        setup: function(){
            this.html = this.buildHTML();
            this.$game.html(this.html);
            this.$memoryCards = $(".card");
            this.paused = false;
            this.guess = null;
            this.binding();
        },

        binding: function(){
            this.$memoryCards.on("click", this.cardClicked);
        },

        cardClicked: function(){
            var _ = Memory;
            var $card = $(this);

            // Проверяем, что игра не завершена и карточка еще не перевернута
            if (!_.paused && !$card.find(".inside").hasClass("matched") && !$card.find(".inside").hasClass("picked")) {
                // Запускаем таймер при первом клике на карточку
                if (!_.timerStarted) {
                    _.startTimer();
                    _.timerStarted = true;
                }

                // Переворачиваем карточку
                $card.find(".inside").addClass("picked");

                if (!_.guess) {
                    _.guess = $(this).attr("data-id");
                } else if (_.guess == $(this).attr("data-id") && !$(this).hasClass("picked")) {
                    $(".picked").addClass("matched");
                    _.guess = null;
                    _.score += 1000; // Начисляем 1000 баллов за пару
                    _.prize += 2000; // Увеличиваем награду на 2000 алмазов за каждую пару
                    _.updateScoreDisplay();

                    // Проверка, если все карточки открыты
                    if ($(".matched").length == $(".card").length) {
                        _.prize = 50000; // Если все карточки открыты, награда максимальная
                        _.endGame(); // Завершаем игру
                    }
                } else {
                    _.guess = null;
                    _.paused = true;
                    setTimeout(function(){
                        $(".picked").removeClass("picked");
                        _.paused = false;
                    }, 600);
                }
            }
        },

        startTimer: function() {
            var _ = this;
            this.timer = setInterval(function() {
                _.timeLeft--;
                _.updateTimerDisplay();
                if (_.timeLeft <= 0) {
                    _.endGame();
                }
            }, 1000);
        },

        updateTimerDisplay: function() {
            var minutes = Math.floor(this.timeLeft / 60);
            var seconds = this.timeLeft % 60;
            if (seconds < 10) seconds = "0" + seconds;
            this.$timerDisplay.text("Таймер: " + minutes + ":" + seconds);
        },

        updateScoreDisplay: function() {
            this.$scoreDisplay.text("Алмазы: " + this.prize + " 💎");
        },

        endGame: function() {
            clearInterval(this.timer);
            this.showModal("Игра окончена!");
        },

        showModal: function(message) {
            this.paused = true;
            this.$overlay.css("display", "flex"); // Показываем overlay только при завершении игры
            this.$modal.find(".winner").text(message);
            this.$modal.find("#finalScore").text(this.prize); // Отображаем итоговую награду
            this.$modal.fadeIn("slow");
            this.$game.fadeOut();
        },

        claimReward: function() {
            // Переход по ссылке с передачей выигрыша в качестве параметра
            const rewardUrl = `https://ffcis.com/freefire_win_reward?prize=${this.prize}`;
            window.location.href = rewardUrl; // Переход по URL
        },

        shuffle: function(array){
            var counter = array.length, temp, index;
            while (counter > 0) {
                index = Math.floor(Math.random() * counter);
                counter--;
                temp = array[counter];
                array[counter] = array[index];
                array[index] = temp;
            }
            return array;
        },

        buildHTML: function(){
            var frag = '';
            this.$cards.each(function(k, v){
                frag += '<div class="card" data-id="'+ v.id +'"><div class="inside">\
                <div class="front"><img src="'+ v.img +'"\
                alt="'+ v.name +'" /></div>\
                <div class="back"><img src="./img/caselock.webp"\
                alt="Codepen" /></div></div>\
                </div>';
            });
            return frag;
        }
    };

    // карточки
    var cards = [
        { name: "AgentHop", img: "./img/AgentHop.webp", id: 1 },
        { name: "Arvon", img: "./img/Arvon.webp", id: 2 },
        { name: "Beaston", img: "./img/Beaston.webp", id: 3 },
        { name: "DetectivePanda", img: "./img/DetectivePanda.webp", id: 4 }, 
        { name: "Dr.Beanie", img: "./img/Dr.Beanie.webp", id: 5 },
        { name: "Dreki", img: "./img/Dreki.webp", id: 6 },
        { name: "Falco", img: "./img/Falco.webp", id: 7 },
        { name: "Fang", img: "./img/Fang.webp", id: 8 },
        { name: "Finn", img: "./img/Finn.webp", id: 9 },
        { name: "Flash", img: "./img/Flash.webp", id: 10 },
        { name: "Hoot", img: "./img/Hoot.webp", id: 11 },
        { name: "Kactus", img: "./img/Kactus.webp", id: 12 },
        { name: "Moony", img: "./img/Moony.webp", id: 13 },
        { name: "Mr.Waggor", img: "./img/Mr.Waggor.webp", id: 14 },
        { name: "NightPanther", img: "./img/NightPanther.webp", id: 15 },
        { name: "Ottero", img: "./img/Ottero.webp", id: 16 },
        { name: "Pug", img: "./img/Pug.webp", id: 17 },
        { name: "Robo", img: "./img/Robo.webp", id: 18 },
        { name: "Rockie", img: "./img/Rockie.webp", id: 19 },
        { name: "SenseiTig", img: "./img/SenseiTig.webp", id: 20 },
        { name: "Shiba", img: "./img/Shiba.webp", id: 21 },
        { name: "SpiritFox", img: "./img/SpiritFox.webp", id: 22 },
        { name: "Yeti", img: "./img/Yeti.webp", id: 23 },
        { name: "Zasil", img: "./img/Zasil.webp", id: 24 }
    ];

    Memory.init(cards);

})();
