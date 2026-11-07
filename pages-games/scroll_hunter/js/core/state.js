/* ================================================================
   SCROLL HUNTER · core/state.js
   Состояние игры, константы и сохранения.
   ================================================================ */
'use strict';

const STATES = {
    INTRO: 'INTRO',
    PROLOGUE: 'PROLOGUE',
    STEP: 'STEP',           // выбор пути / итоги забега
    CHOOSE: 'CHOOSE',
    HEIST_CRISIS: 'HEIST_CRISIS',
    VERDICT: 'VERDICT',
    OPENING: 'OPENING',
    REACTION: 'REACTION',
    INVENTORY: 'INVENTORY',
    TREASURE_CHOICE: 'TREASURE_CHOICE',
    BOSS_GIFT: 'BOSS_GIFT',
    CAMP: 'CAMP',
    SHOP: 'SHOP',
    EVENT: 'EVENT',
    QUARTERMASTER: 'QUARTERMASTER',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY'
};

const START_HP = 4;

const ui = {
    round: document.getElementById('ui-round'),
    scrolls: document.getElementById('ui-scrolls'),
    hp: document.getElementById('ui-hp'),
    checks: document.getElementById('ui-checks'),
    week: document.getElementById('ui-week'),
    goldTarget: document.getElementById('ui-goldtarget'),
    goldWrap: document.getElementById('ui-goldwrap'),
    boons: document.getElementById('ui-boons'),
    container: document.querySelector('.game-container'),
    muteBtn: document.getElementById('btn-mute'),
    /* Сообщение — модель, а не DOM: присваивание разбирает текст на отрезки */
    message: {
        set html(value) {
            if (typeof setMessage === 'function') setMessage(value);
        }
    },
    goldBar: document.getElementById('ui-goldbar'),
    map: document.getElementById('ui-map'),
    rogiPanel: document.getElementById('ui-rogi')
};

/* ---------------------------------------------------------------
   Сохранение настроек, рекордов и мета-прогрессии
--------------------------------------------------------------- */
const SAVE_KEY = 'scroll_hunter_save_v1';
const settings = { muted: false };
let heistMode = 'A';
const record = { best: 0, wins: 0, runs: 0, deepest: 0 };
const tutorial = { mapStartHintSeen: false };
let mapStartHintVisible = true;
let firstFridayProgress = FirstFridayStory.createProgress();

function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return;
        if (typeof data.muted === 'boolean') settings.muted = data.muted;
        if (data.heistMode === 'B1') heistMode = 'B1';
        if (data.firstFriday) firstFridayProgress = FirstFridayStory.createProgress(data.firstFriday);
        tutorial.mapStartHintSeen = data.mapStartHintSeen === true;
        mapStartHintVisible = !tutorial.mapStartHintSeen;
        if (typeof data.best === 'number') record.best = data.best;
        if (typeof data.wins === 'number') record.wins = data.wins;
        if (typeof data.runs === 'number') record.runs = data.runs;
        if (typeof data.deepest === 'number') record.deepest = data.deepest;
        if (typeof data.dust === 'number') meta.dust = data.dust;
        if (Array.isArray(data.readScrollIds)) {
            readScrollIds = data.readScrollIds.filter(id => typeof id === 'string' && id.length > 0);
        }
        if (data.levels && typeof data.levels === 'object' && !Array.isArray(data.levels)) {
            meta.levels = data.levels;
        }
    } catch (e) {
        /* повреждённое сохранение — просто начинаем с чистого листа */
    }
}

function persist() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
            muted: settings.muted,
            heistMode,
            mapStartHintSeen: tutorial.mapStartHintSeen,
            firstFriday: firstFridayProgress.snapshot(),
            best: record.best,
            wins: record.wins,
            runs: record.runs,
            deepest: record.deepest,
            dust: meta.dust,
            levels: meta.levels,
            readScrollIds: readScrollIds
        }));
    } catch (e) { /* приватный режим — просто не сохраняем */ }
}

/* ---------------------------------------------------------------
   Состояние игры
--------------------------------------------------------------- */
let gameState = STATES.INTRO;

/* кампания */
let week = 1;             // неделя 1..6
let gold = 0;             // золото (переживает забеги)
let stageIndex = 0;       // текущий этап 0..2
let giftFlags = {};       // флаги даров боссов
let rogiTrust = 0;        // доверие Роги: -100..100
let letterText = '';        // письмо арендодателя (ставка игрока)
let giftsTaken = [];
let techniques = [];      // купленные боевые приёмы
let usedElixirs = [];
let clearedWeak = new Set();
let boss = null;
let currentGift = null;

/* данж */
let floor = 1;            // текущий уровень этапа
let hp = START_HP;
let maxHp = START_HP;

/* карта этапа */
let map = [];
let currentNodeId = null;
let visitedNodes = new Set();
let attemptOver = false;  // забег окончен (смерть или подъём)
let currentNode = null;

/* комната */
let chests = [];
let selected = -1;
let rogiAsks = 0;         // сколько бесплатных советов Роги осталось в этой комнате
let roomTouched = false;
let openingIdx = -1;
let roomGoatHint = false;
let roomNoBite = false;    // мимики не кусают в текущей комнате
let roomNoChecks = false;  // Роги не появляется в текущей комнате
let rogiMsg = '';                 // последняя реплика Роги (показывается в панели)
let roomInfo = { total: 0, room: 'FIGHT' };   /* состав комнаты считается по сундукам */  // состав текущей комнаты

/* свитки в сумке и прочитанный набор, который переживает успешные походы */
let scrollInventory = [];
let readScrollIds = [];
let inventoryReturnState = null;
let inventoryPage = 0;
let selectedInventoryIndex = -1;
let replayingReadScrolls = false;
let treasureBase = 0;      // базовая ценность сокровищницы
let foundRelics = new Set();
let forgeNext = false;    // следующая реликвия дороже на 50% (ковка в лагере)

/* события и торговля */
let currentEvent = null;
let shopStock = null;
let campaignStoryFlags = { inspectorCallbackResolved:false, merchantSearchPending:false };

/* прочее */
let rogueUsedHere = false;
let lastEvent = '';
let timeline = [];

let stats = { floors: 0, bites: 0, checks: 0, sold: 0, used: 0, digs: 0, gold: 0, events: 0, hits: 0 };
let appliedStack = [];
let boosts = freshBoosts();

function freshBoosts() {
    return {
        /* постоянные */
        curse: false,          // проклятие неудачи: первый выбор всегда пуст
        asks: 0,               // +N бесплатных советов Роги в каждой комнате
        goldBoost: 1,          // множитель продаж (приёмы, дары)
        shield: 0,             // сколько укусов ещё поглотит щит
        revive: 0,             // сколько воскрешений осталось
        noMimic: false,        // огненный шар: след. открытый сундук не мимик
        doubleNext: false,     // след. реликвия стоит вдвое
        doubleAll: false,      // все реликвии стоят вдвое
        guaranteedNext: false,
        gambleNext: false,
        luckyScroll: false,
        emptyScores: false,
        emptyHurts: false,
        freeFirstAsk: false,  // первый спрос у Роги бесплатный
        peekNext: false,       // след. выбранный сундук виден насквозь
        freeChecks: 0,         // проверки, не тратящие заряд
        lieNext: false,        // след. проверка соврёт
        noRead: false,         // читать свитки больше нельзя
        doubleBiteNext: false,
        curseNext: false,      // проклятие только на следующий этаж
        rogiDebt: false,       // активный долг: Роги заберёт первую найденную реликвию
        rogiInsurance: false,  // Роги примет первый удар на себя
        rogiShare: 0,          // доля добычи, которую заберёт Роги

        /* эффекты следующей комнаты */
        next: {
            safe: false,       // мимика нет вовсе
            charm: false,      // мимик превращается в пустой
            swap: false,       // два сундука меняются местами
            moveMimic: false,  // мимик перепрыгивает и отмечается
            markMimic: false,
            markScroll: false,
            markEmpty: false,
            markAll: false,
            goat: false,
            noBite: false,     // мимик не кусает
            noChecks: false,   // проверок нет
            lucky: false,      // только реликвии, без мимиков
            asks: 0            // дополнительные бесплатные советы у Роги
        }
    };
}

/* ---------------------------------------------------------------
   Таймеры на игровом времени (а не на setTimeout)
--------------------------------------------------------------- */
function later(delay, fn) {
    timeline.push({ t: 0, delay: delay, fn: fn });
}

function clearTimeline() {
    timeline = [];
}

function updateTimeline(dt) {
    for (let i = timeline.length - 1; i >= 0; i--) {
        timeline[i].t += dt;
        if (timeline[i].t >= timeline[i].delay) {
            const fn = timeline[i].fn;
            timeline.splice(i, 1);
            fn();
        }
    }
}
