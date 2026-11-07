/* ================================================================
   SCROLL HUNTER · core/meta.js
   Мета-прогрессия: пыль, постоянные улучшения, квартирмейстер.
   ================================================================ */
'use strict';

const META_UPGRADES = [
    {
        id: 'heart', name: 'КРЕПКОЕ СЕРДЦЕ', icon: '❤️',
        desc: '+1 стартовое сердце', cost: 45, max: 2,
        detail: 'Начать каждую неделю с дополнительным сердцем за уровень.'
    },
    {
        id: 'checks', name: 'ВЗЯТКА', icon: '🗡',
        desc: '+1 бесплатный совет в зале', cost: 60, max: 2,
        detail: 'В каждом зале один совет Роги будет бесплатным.'
    },
    {
        id: 'purse', name: 'КОШЕЛЬ', icon: '👛',
        desc: '+25 стартового золота за уровень', cost: 40, max: 3,
        detail: 'Каждый уровень добавляет 25 золота к началу кампании; максимум — 75.'
    },
    {
        id: 'greed', name: 'СКУПЕРДИНА', icon: '💰',
        desc: 'Реликвии дороже на 10%', cost: 50, max: 3,
        detail: 'Каждая проданная реликвия приносит на 10% больше.'
    },
    {
        id: 'mercy', name: 'ЩЕДРОСТЬ РОГИ', icon: '🤝',
        desc: '25% шанс не платить Роги', cost: 80, max: 2,
        detail: 'Роги может простить плату за совет или свою долю: +25% шанса за уровень.'
    },
    {
        id: 'depths', name: 'ГЛУБОКОЕ ПОДЗЕМЕЛЬЕ', icon: '🕳️',
        desc: '+1 уровень к этапу', cost: 110, max: 2,
        detail: 'Этап становится длиннее, а реликвии на дне — дороже.'
    },
    {
        id: 'insight', name: 'ПРОНИЦАТЕЛЬНОСТЬ', icon: '👁',
        desc: '1 бесплатный совет в забеге', cost: 70, max: 1,
        detail: 'Один совет Роги за неделю будет бесплатным.'
    },
    {
        id: 'tally', name: 'СЧЁТОВОД', icon: '📒',
        desc: '+30% пыли за забег', cost: 55, max: 2,
        detail: 'Квартирмейстер щедрее делится пылью.'
    }
];

const meta = { levels: {}, dust: 0 };

function metaLevel(id) {
    return meta.levels[id] || 0;
}

/* Цена следующего уровня улучшения */
function upgradeCost(up) {
    const lvl = metaLevel(up.id);
    return Math.round(up.cost * (1 + lvl * 0.75));
}

function canBuy(up) {
    const lvl = metaLevel(up.id);
    return lvl < up.max && meta.dust >= upgradeCost(up);
}

function buyUpgrade(up) {
    if (!canBuy(up)) return false;
    meta.dust -= upgradeCost(up);
    meta.levels[up.id] = metaLevel(up.id) + 1;
    persist();
    return true;
}

function dustForRun(result) {
    if (!result) return 0;
    const base = Math.floor(result.gold / 6) + result.floors * 3 + result.sold * 2;
    const mult = 1 + metaLevel('tally') * 0.3;
    return Math.round(base * mult);
}

function metaStartHp() {
    return START_HP + metaLevel('heart');
}

function metaStartGold() {
    return metaLevel('purse') * 25;
}

function metaGoldMultiplier() {
    return 1 + metaLevel('greed') * 0.1;
}

function metaRogueMercy() {
    /* 25% шанс, что Роги не возьмёт плату */
    return metaLevel('mercy') > 0 && GameRng.next('mechanics') < 0.25 * metaLevel('mercy');
}

function metaExtraFloors() {
    return metaLevel('depths');
}

/* Сколько уровней в этапе с учётом улучшений */
function stageLevels() {
    return ECONOMY.floors + metaExtraFloors();
}

function metaFreeCheckPerRoom() {
    return metaLevel('insight') > 0 ? 1 : 0;
}

/* Постоянные улучшения: сколько бесплатных советов у Роги за комнату */
function metaStartAsks() {
    return metaLevel('checks');
}
