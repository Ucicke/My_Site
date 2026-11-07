/* ================================================================
   SCROLL HUNTER · data/powers.js — реестр сил
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   Реестр сил: power -> что именно происходит
   --------------------------------------------------------------- */
const POWERS = {
    /* спросы у Роги */
    checksNextRoom: {
            label: 'Спросов', apply: (n) => { boosts.next.asks += n; },
            chip: n => `Бесплатных советов: +${n} (след. зал)`
    },
    markMimic: {
        label: 'Зеркало', apply: () => { boosts.next.markMimic = true; },
        chip: () => 'Мимик отмечен'
    },
    markScroll: {
        label: 'Карта', apply: () => { boosts.next.markScroll = true; },
        chip: () => 'Свиток отмечен'
    },
    markEmpty: {
        label: 'Оракул', apply: () => { boosts.next.markEmpty = true; },
        chip: () => 'Пустой отмечен'
    },
    markAll: {
        label: 'Орёл', apply: () => { boosts.next.markAll = true; },
        chip: () => 'Всё известно'
    },
    echo: {
        label: 'Эхо', apply: () => {
            /* Повторяем исходную силу, не вызывая предыдущие «Эхо». */
            let last = null;
            for (let i = appliedStack.length - 1; i >= 0; i--) {
                if (appliedStack[i].sc.power !== 'echo') {
                    last = appliedStack[i];
                    break;
                }
            }
            if (!last) return;
            applyPower(last.sc.power, last.sc.n);
            if (!replayingReadScrolls) addFloater(VIEW_W / 2, VIEW_H / 2, 'ЭХО: ' + last.sc.name, '#c7b6ff', 22);
        },
        chip: () => 'Эхо последнего свитка'
    },
    undo: {
        label: 'Отмена', apply: () => {
            const last = appliedStack.pop();
            if (!last) return;
            last.undo();
            if (!replayingReadScrolls) addFloater(VIEW_W / 2, VIEW_H / 2, 'ОТМЕНЕНО: ' + last.sc.name, '#ffb347', 22);
        },
        chip: () => 'Отмена последнего свитка'
    },
    peekNext: {
        label: 'Окно', apply: () => { boosts.peekNext = true; },
        chip: () => 'Следующий сундук виден'
    },

    /* спросы у Роги */
    checksPerRoom: {
        label: 'Бесплатно', apply: (n) => { boosts.asks += n; },
        chip: n => `Бесплатных советов у Роги: +${n} в зале`
    },
    freeCheckNext: {
        label: 'Верный глаз', apply: (n) => { boosts.freeChecks += n; },
        chip: n => `Бесплатных советов: ${n}`
    },

    /* здоровье */
    maxHp: {
        label: 'Здоровье', apply: (n) => { maxHp += n; hp = maxHp; },
        chip: n => `Макс. здоровье +${n}`
    },
    heal: {
        label: 'Лечение', apply: (n) => { hp = Math.min(maxHp, hp + n); },
        chip: n => `Лечение +${n}`
    },
    healFull: {
        label: 'Лечение', apply: () => { hp = maxHp; },
        chip: () => 'Полное лечение'
    },
    bloodPrice: {
        label: 'Кровь', apply: (n) => {
            maxHp += n; hp = Math.max(1, hp - n);
        },
        chip: n => `Кровь дракона: +${n} HP, −${n} сейчас`
    },
    shield: {
        label: 'Щит', apply: (n) => { boosts.shield += n; },
        chip: n => `Щит ×${n}`
    },
    revive: {
        label: 'Воскрешение', apply: (n) => { boosts.revive += n; },
        chip: n => `Воскрешение ×${n}`
    },
    noBiteNext: {
        label: 'Панцирь', apply: () => { boosts.next.noBite = true; },
        chip: () => 'Мимик не укусит'
    },
    invuln: {
        label: 'Неуязвимость', apply: () => { hp = maxHp; boosts.shield += 1; },
        chip: () => 'Неуязвимость'
    },
    luckyScroll: {
        label: 'Счастливая карта', apply: () => { boosts.luckyScroll = true; },
        chip: () => 'След. свиток лечит полностью'
    },

    /* счёт */
    scoreNow: {
        label: 'Золото', apply: (n) => { gold += n; if (!replayingReadScrolls) addFloater(VIEW_W / 2, VIEW_H / 2, '+' + n + ' ЗОЛОТА', '#ffd76a', 30); },
        chip: n => `Сразу +${n} зол.`
    },
    doubleNext: {
        label: 'Фортуна', apply: () => { boosts.doubleNext = true; },
        chip: () => 'След. свиток ×2'
    },
    doubleAll: {
        label: 'Торговец', apply: () => { boosts.doubleAll = true; },
        chip: () => 'Все свитки ×2'
    },
    guaranteedNext: {
        label: 'Точность', apply: () => { boosts.guaranteedNext = true; },
        chip: () => 'След. сундук — точно свиток'
    },
    gambleNext: {
        label: 'Азарт', apply: () => { boosts.gambleNext = true; },
        chip: () => 'Азарт: ×2 или −2 жизни'
    },
    emptyScores: {
        label: 'Мелочь', apply: () => { boosts.emptyScores = true; },
        chip: () => 'Пустые сундуки дают золото'
    },
    emptyIsFree: {
        label: 'Течение', apply: () => { boosts.freeFirstAsk = true; },
        chip: () => 'Первый спрос у Роги — бесплатно'
    },
    emptyHurts: {
        label: 'Недовольство', apply: () => { boosts.emptyHurts = true; },
        chip: () => 'Пустые сундуки ранят'
    },

    /* комната */
    safeRoom: {
        label: 'Пустой зал', apply: () => { boosts.next.safe = true; },
        chip: () => 'След. зал без мимика'
    },
    charmNext: {
        label: 'Очарование', apply: () => { boosts.next.charm = true; },
        chip: () => 'Мимик станет пустым'
    },
    swapNext: {
        label: 'Перестановка', apply: () => { boosts.next.swap = true; },
        chip: () => 'Сундуки поменяются'
    },
    mimicMovedNext: {
        label: 'Магнит', apply: () => { boosts.next.moveMimic = true; },
        chip: () => 'Мимик перепрыгнет'
    },
    extraOpen: {
        label: 'Чистая комната', apply: () => { boosts.next.lucky = true; },
        chip: () => 'След. комната: только реликвии'
    },
    extraRoom: {
        label: 'Знание подземелья', apply: () => { boosts.freeChecks += 2; },
        chip: () => 'Два бесплатных совета'
    },
    mindRead: {
        label: 'Мысли', apply: () => { boosts.next.markAll = true; boosts.next.noChecks = true; },
        chip: () => 'Всё известно, но без проверок'
    },
    darkRoom: {
        label: 'Темнота', apply: () => { boosts.next.noChecks = true; boosts.next.noBite = true; },
        chip: () => 'Темнота: без проверок, без укусов'
    },

    /* проклятия */
    curseEmpty: {
        label: 'Проклятие', apply: () => { boosts.curse = true; },
        chip: () => 'Проклятие: первый выбор пуст'
    },
    curseEmptyNext: {
        label: 'Забвение', apply: () => { boosts.curseNext = true; },
        chip: () => 'Проклятие на один зал'
    },
    stingy: {
        label: 'Скупость', apply: (n) => { gold += n; boosts.noRead = true; },
        chip: n => `+${n} зол., читать нельзя`
    },
    doubleBiteNext: {
        label: 'Двойной укус', apply: () => { boosts.doubleBiteNext = true; },
        chip: () => 'След. мимик кусает дважды'
    },
    silenceCurse: {
        label: 'Молчание', apply: (n) => {
            boosts.asks = 0;
            maxHp += n; hp = Math.min(maxHp, hp + n);
        },
        chip: n => `Роги ушёл, +${n} макс. HP`
    },
    cursedGold: {
        label: 'Проклятое золото', apply: () => { boosts.doubleAll = true; boosts.curse = true; },
        chip: () => 'Свитки ×2, но с проклятием'
    },
    heavyNight: {
        label: 'Тяжёлая ночь', apply: (n) => { gold += n; hp = Math.max(1, hp - 1); },
        chip: n => `+${n} зол., −1 здоровья`
    },
    lieNext: {
        label: 'Обман', apply: () => { boosts.lieNext = true; },
        chip: () => 'Роги соврёт'
    },
    greed: {
        label: 'Жадность', apply: (n) => {
            gold += n; maxHp = Math.max(1, maxHp - 1); hp = Math.min(hp, maxHp);
        },
        chip: n => `+${n} зол., −1 макс. HP`
    },
    shadow: {
        label: 'Тень', apply: (n) => {
            maxHp = Math.max(1, maxHp - 1); hp = Math.min(hp, maxHp);
            boosts.asks += n;
        },
        chip: n => `−1 макс. HP, +${n} спрос`
    },
    goats: {
        label: 'Козы', apply: () => { boosts.next.goat = true; },
        chip: () => 'Козы подскажут'
    },
    noMimicOpen: {
        label: 'Огненный шар', apply: () => { boosts.noMimic = true; },
        chip: () => 'След. сундук не мимик'
    },
    ashes: {
        label: 'Пепел', apply: () => {
            rogiQuestFound = true;
            if (typeof bumpTrust === 'function') bumpTrust(30);
            if (typeof say === 'function') say('ashes');
        },
        chip: () => 'Роги нашёл свой свиток — он отвечает на один вопрос больше'
    },
    none: {
        label: 'Ничего', apply: () => { },
        chip: () => 'Ничего не происходит'
    }
};

