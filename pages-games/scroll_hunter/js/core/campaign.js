/* ================================================================
   SCROLL HUNTER · core/campaign.js
   Кампания: недели, попытки (забеги), дань, этапы, дары боссов.
   ================================================================ */
'use strict';

const CAMPAIGN = { 
    weeks: 6          // один забег занимает неделю
};

let campaignDustStats = { floors: 0, sold: 0 };
let attemptDustStatsAccumulated = true;

function freshGiftFlags() {
    return {
        goldBonus: 1,
        tributePenalty: 1,
        startCurse: false,
        freeAsksPerWeek: 0,
        incomePenalty: 1,
        freeBite: 0,
        maxHpDelta: 0
    };
}

/* ---------------------------------------------------------------
   Размер дани на текущей неделе
--------------------------------------------------------------- */
function currentTribute() {
    const base = TRIBUTE_BY_WEEK[clamp(week - 1, 0, TRIBUTE_BY_WEEK.length - 1)];
    return Math.round(base * (giftFlags.tributePenalty || 1));
}

function accumulateAttemptDustStats() {
    if (attemptDustStatsAccumulated) return;
    campaignDustStats.floors += stats.floors;
    campaignDustStats.sold += stats.sold;
    attemptDustStatsAccumulated = true;
}

/* ---------------------------------------------------------------
   Начало кампании
--------------------------------------------------------------- */
function startCampaign(seed = GameRng.createSeed()) {
    GameRng.start(seed);
    resetEventDeck();
    if(typeof RogiWorld!=='undefined')RogiWorld.reset();
    companion = freshCompanion();
    companion.ai = RogiAI.create(String(seed) + ':rogi');
    companionModal = null;
    lastStableRun = '';
    try { localStorage.removeItem(RUN_SAVE_KEY); } catch (_) {}
    mapStartHintVisible = !tutorial.mapStartHintSeen;
    week = 1;
    scrollInventory = [];
    // Scroll powers belong to a campaign, not to the permanent upgrades.
    readScrollIds = [];
    appliedStack = [];
    campaignDustStats = { floors: 0, sold: 0 };
    attemptDustStatsAccumulated = true;
    gold = metaStartGold();
    stageIndex = 0;
    giftFlags = freshGiftFlags();
    giftsTaken = [];
    techniques = [];
    usedElixirs = [];
    clearedWeak = new Set();
    map = null;
    campaignStoryFlags = { inspectorCallbackResolved:false, merchantSearchPending:false };
    /* новая партия — Роги снова чужой, а арендодатель снова ждёт */
    rogiTrust = 0;
    rogiQuestFound = false;
    rogiSaid = {};
    letterText = 'Надеюсь, вы уже отправились в подземелье, которое я вам указал. Рассчитываю, что вы вынесете оттуда свитков хотя бы на 300 золотых. К концу недели жду всю сумму. Не заплатите — сгною в долговой яме. И не надейтесь, что там я забуду о вашем долге.\n\nАрендодатель';
    receiveMapLetter(letterText, true);
    record.runs++;
    persist();
    startAttempt();
}

function beginCampaignFromMenu() {
    startCampaign();
    if (!firstFridayProgress.snapshot().seen) {
        firstFridayProgress.begin();
        gameState = STATES.PROLOGUE;
        persist();
        updateUI();
    }
}

function chooseFirstFriday(choiceId) {
    if (gameState !== STATES.PROLOGUE || firstFridayProgress.snapshot().choice) return false;
    const effect = FirstFridayStory.choiceEffect(choiceId);
    if (!effect.trust) return false;
    firstFridayProgress.setChoice(choiceId);
    bumpTrust(effect.trust);
    RogiAI.event(companion,'first-friday-choice',{key:choiceId,choice:choiceId,trustDelta:effect.trust});
    companion.line = FirstFridayStory.replyFor(companion.ai.profile,choiceId);
    persist();
    updateUI();
    return true;
}

function advanceFirstFridayPrologue() {
    if (gameState !== STATES.PROLOGUE) return false;
    const story = firstFridayProgress.snapshot();
    if (story.page === 1 && !story.choice) return false;
    if (story.page < 2) {
        firstFridayProgress.setPage(story.page + 1);
        persist();
        updateUI();
        return true;
    }
    return finishFirstFridayPrologue();
}

function finishFirstFridayPrologue() {
    if (gameState !== STATES.PROLOGUE) return false;
    firstFridayProgress.complete();
    persist();
    gameState = STATES.STEP;
    updateUI();
    return true;
}

/* ---------------------------------------------------------------
   Новый забег занимает целую неделю
--------------------------------------------------------------- */
function startAttempt() {
    HeistLoop.resetRun();
    companion.dungeon++;
    if (companion.active) {
        companion.hp = companion.maxHp;
        companion.debt += currentTribute();
        companion.settled = false;
        companion.settlement = null;
        companion.giftGold = 0; companion.giftTrust = 0; companion.requests = 0;
        RogiAI.newDungeon(companion);
    }
    clearTimeline();
    roomNoBite = false;
    roomNoChecks = false;
    maxHp = Math.max(1, metaStartHp() + (giftFlags.maxHpDelta || 0));
    hp = maxHp;
    boosts = freshBoosts();
    /* «Проницательность»: один бесплатный совет Роги на забег */
    boosts.freeChecks += metaFreeCheckPerRoom();
    appliedStack = [];
    foundRelics = new Set();
    forgeNext = false;
    stats = { floors: 0, bites: 0, checks: 0, sold: 0, used: 0, digs: 0, gold: 0, events: 0, hits: 0 };
    attemptDustStatsAccumulated = false;

    selected = -1;
    openingIdx = -1;
    rogiAsks = 0;
    roomTouched = false;
    roomGoatHint = false;
    currentEvent = null;
    shopStock = null;
    boss = null;
    currentGift = null;
    floor = 1;
    attemptOver = false;
    currentNodeId = null;
    currentNode = null;
    visitedNodes = new Set();
    lastEvent = '';

    techniques.forEach(t => {
        const tech = TECHNIQUES.find(x => x.id === t);
        if (tech) tech.apply();
    });
    if (giftFlags.startCurse) boosts.curse = true;
    if (giftFlags.freeAsksPerWeek > 0) {
        boosts.asks += giftFlags.freeAsksPerWeek;
    }

    replayingReadScrolls = true;
    try {
        readScrollIds.forEach(id => {
            const scroll = SCROLL_TYPES.find(item => item.id === id);
            if (scroll) applyScrollPower(scroll, true);
        });
    } finally {
        replayingReadScrolls = false;
    }

    const stage = STAGES[clamp(stageIndex, 0, STAGES.length - 1)];
    map = generateStageMap(stage);
    say(stageIndex === 0 ? 'stage1' : 'enter');
    if (companion.active && week >= 5 && !companion.ai.seen['deadline:' + week]) {
        companion.ai.seen['deadline:' + week] = true;
        RogiAI.event(companion, 'deadline-near', { week, key: week });
    }

    gameState = STATES.STEP;
    updateUI();
}

/* ---------------------------------------------------------------
   Босс: мини-бой в логове
--------------------------------------------------------------- */
function bossState() {
    const stage = STAGES[clamp(stageIndex, 0, STAGES.length - 1)];
    return {
        hp: stage.hp,
        max: stage.hp,
        opened: 0,
        mimicBonus: 0
    };
}

/* Войти в логово предводителя */
function enterBoss() {
    const stage = STAGES[clamp(stageIndex, 0, STAGES.length - 1)];
    roomNoBite = boosts.next.noBite;
    roomNoChecks = false;
    boosts.next.noBite = false;
    boss = bossState();
    say('boss');
    /* Роги в логово не ходит — здесь и так всё перемешивается */
    rogi = null;
    roomInfo = { total: stage.chests, room: 'BOSS' };
    spawnBossWave(true);
    gameState = STATES.CHOOSE;
    Sfx.play('mimic');
    updateUI();
}

/* Ряд сундуков логова: кубышки.
   Реликвии бьют босса, мимики кусают. После каждого вскрытия
   ряд перемешивается заново — знание обесценивается. */
function spawnBossWave(first) {
    const stage = STAGES[clamp(stageIndex, 0, STAGES.length - 1)];
    const size = stage.chests;

    /* В каждом ряду остаются свитки; Костяной король постепенно поднимает мимиков. */
    const baseMimics = clamp(Math.round(size * stage.mimicRate * 0.5), 1, size - 2);
    const reanimated = stage.bossRule === 'reanimate' ? boss.mimicBonus : 0;
    const mimics = clamp(baseMimics + reanimated, 1, size - 2);
    const relics = size - mimics;

    const types = shuffleIn('loot',
        new Array(relics).fill('scroll').concat(new Array(mimics).fill('mimic'))
    );
    const xs = chestXs(size);
    chests = types.map((type, i) => ({
        x: xs[i],
        y: 170,
        w: chestWidth(size),
        type: type,
        kind: type === 'scroll' ? 'RELIC' : 'MIMIC',
        openT: 0,
        openSpeed: 1.55,
        opened: false,
        known: null,
        hint: false,
        selected: false
    }));
    selected = -1;
    roomTouched = !first;
    rogiAsks = 0;
    if (!first) {
        addFloater(VIEW_W / 2, 240, 'ПЕРЕМЕШАЛИ!', '#c7b6ff', 28);
        Sfx.play('curse');
    }
}

/* Разрешение раунда боя с боссом */
function resolveBossRound(idx) {
    const c = chests[idx];
    if (!c) return;
    const cx = c.x + CHEST_W / 2;
    const stage = STAGES[clamp(stageIndex, 0, STAGES.length - 1)];

    if (c.type === 'scroll') {
        boss.hp = Math.max(0, boss.hp - 1);
        stats.hits++;
        burstScroll(cx, c.y + 40);
        Sfx.play('scroll');
        addFloater(cx, c.y - 62, 'УДАР! ' + boss.hp + ' ХП ОСТАЛОСЬ', '#ffd76a', 26);
        shakeScreen(0.2, 5);
    } else {
        stats.bites++;
        Sfx.play('bite');
        burstMimic(cx, c.y + 50);
        shakeScreen(0.5, 15);
        flashScreen(0.35, '#ff2d55');
        const damage = stage.bossRule === 'fire' ? 2 : 1;
        if (roomNoBite) {
            addFloater(cx, c.y - 62, 'МИМИК НЕ УКУСИЛ!', '#9fe8ff', 26);
            Sfx.play('shield');
        } else if (giftFlags.freeBite > 0) {
            giftFlags.freeBite--;
            addFloater(cx, c.y - 62, 'КЛЫК ПРИНЯЛ УДАР', '#9fe8ff', 24);
        } else if (boosts.shield > 0) {
            boosts.shield--;
            addFloater(cx, c.y - 62, 'ЩИТ ПОГЛОТИЛ УКУС!', '#7dd3fc', 26);
            Sfx.play('shield');
        } else if (boosts.rogiInsurance && companionAvailable()) {
            boosts.rogiInsurance = false;
            hurtCompanion(damage);
            addFloater(cx, c.y - 62, 'РОГИ ПРИНЯЛ УДАР', '#c7b6ff', 24);
            Sfx.play('shield');
        } else {
            hp -= damage;
            addFloater(cx, c.y - 62, '−' + damage + (damage === 1 ? ' ЖИЗНЬ' : ' ЖИЗНИ'), '#ff5470', 30);
        }
    }

    gameState = STATES.REACTION;
    updateUI();

    later(0.8, () => {
        if (boss.hp <= 0) { winBoss(); return; }
        if (stage.bossRule === 'reanimate' && c.type === 'scroll') {
            boss.mimicBonus = Math.min(stage.chests - 2, boss.mimicBonus + 1);
        }
        if (stage.bossRule === 'falseAdvice') {
            boosts.lieNext = true;
            addFloater(VIEW_W / 2, 240, 'РОГИ ШЕПЧЕТ ЛОЖЬ', '#c7b6ff', 24);
        }
        if (resolvePlayerDeath('Предводитель оказался сильнее. Вас вынесли из логова.', () => {
            spawnBossWave(false);
            gameState = STATES.CHOOSE;
            selected = -1;
            roomTouched = true;
            updateUI();
        })) return;
        spawnBossWave(false);
        gameState = STATES.CHOOSE;
        selected = -1;
        roomTouched = true;
        updateUI();
    });
}

/* Победа над боссом: дар + награда + следующий этап */
function winBoss() {
    roomNoBite = false;
    roomNoChecks = false;
    const stage = STAGES[clamp(stageIndex, 0, STAGES.length - 1)];
    const reward = Math.round(150 * stage.goldBonus * (giftFlags.goldBonus || 1));
    gold += reward;

    /* Дар: ещё не взятый */
    const pool = BOSS_GIFTS.filter(g => !giftsTaken.includes(g.id));
    const gift = pool.length ? pool[randIntIn('loot', 0, pool.length - 1)] : null;

    gameState = STATES.BOSS_GIFT;
    currentGift = gift;
    updateUI();
}

/* Принять дар босса */
function acceptGift() {
    if (currentGift) {
        currentGift.apply();
        giftsTaken.push(currentGift.id);
    }
    currentGift = null;
    stageIndex = Math.min(STAGES.length - 1, stageIndex + 1);
    say('stage' + (stageIndex + 1));
    lastEvent = 'Логово повержено. Пора рассчитаться с арендодателем.';
    attemptOver = true;
    gameState = STATES.STEP;
    updateUI();
}

/* ---------------------------------------------------------------
   Выход из подземелья: расчёт долга за неделю
--------------------------------------------------------------- */
function payTribute(confirmAlone = false) {
    if (!attemptOver || hp <= 0 || gameState !== STATES.STEP) return;
    prepareCompanionSettlement();
    if (companion.active && !companion.debtChecked && companion.gold < companion.debt && gold >= currentTribute() && !confirmAlone) {
        companionModal = { type: 'farewell' }; updateUI(); return;
    }
    accumulateAttemptDustStats();
    const tribute = currentTribute();
    if (gold < tribute) {
        finishCampaign(false, `Неделя окончена. Долг — ${tribute} зол., а в кошеле ${gold}. Вас бросили в долговую яму.`);
        return;
    }
    const playerAvailable = Math.max(0,gold-tribute);
    gold -= tribute;
    settleCompanionDebt({playerAvailable});
    say('tribute');

    if (week >= CAMPAIGN.weeks) {
        finishCampaign(true, 'Последняя неделя окончена. Долг выплачен. Арендодатель подтвердил: вы свободны.');
        return;
    }

    const settledWeek = week;
    week++;
    /* арендодатель не забывает: каждую неделю — письмо */
    const letters = (typeof ROGI_LINES !== 'undefined' && ROGI_LINES.letter) ? ROGI_LINES.letter : [];
    letterText = settledWeek === 1
        ? 'Первый платёж получен. Это не отменяет вашу расписку и не продлевает срок. Пять пятниц осталось.\n\nАрендодатель'
        : letters.length ? letters[(week - 1) % letters.length] : 'Арендодатель ждёт. Как всегда.';
    receiveMapLetter(letterText, false);
    lastEvent = `Дань уплачена. Началась неделя ${week}.`;
    startAttempt();
    if (companion.farewell) {
        lastEvent = companion.farewell;
        receiveMapLetter(companion.farewell, false);
        updateUI();
    }
}

/* ---------------------------------------------------------------
   Финал кампании
--------------------------------------------------------------- */
let lastResult = {
    win: false, reason: '', gold: 0, profit: 0, dust: 0,
    floors: 0, bites: 0, sold: 0, used: 0, digs: 0, events: 0,
    week: 1, stage: 0, tribute: 0
};

/* Финальные строки: что стало с вами и с Роги */
function epilogue(win) {
    if (!companion.active) return companion.farewell || 'В этот раз вы прошли свой путь в одиночку.';
    if (win) return rogiTrust >= 50
        ? 'Роги опускает фиолетовый капюшон и улыбается: «Оба долга позади. В следующий поход — уже ради себя?»'
        : 'Роги пересчитывает последние монеты. Вы выбрались. Теперь можно выбирать свой путь.';
    return 'Роги молча сжимает край фиолетового плаща. До выхода оставалось ещё столько тёмных залов.';
}

function finishCampaign(win, reason) {
    if (typeof clearTransientSceneEffects === 'function') clearTransientSceneEffects();
    if(hp<0)hp=0;
    settleScrollInventory(win);
    accumulateAttemptDustStats();
    roomNoBite = false;
    roomNoChecks = false;
    gameState = win ? STATES.VICTORY : STATES.GAME_OVER;
    clearTimeline();
    attemptOver = true;   // карта не должна предлагать путь после конца забега

    const profit = gold;
    if (win && profit > record.best) record.best = profit;
    if (win) record.wins++;
    if (week > record.deepest) record.deepest = week;

    lastResult = {
        win: win,
        reason: reason,
        gold: gold,
        profit: profit,
        floors: stats.floors,
        bites: stats.bites,
        sold: stats.sold,
        used: stats.used,
        digs: stats.digs,
        events: stats.events,
        week: week,
        stage: stageIndex,
        tribute: currentTribute()
    };

    const dust = dustForRun({
        ...lastResult,
        floors: campaignDustStats.floors,
        sold: campaignDustStats.sold
    });
    meta.dust += dust;
    lastResult.dust = dust;
    persist();

    if (!win) say('death');
    Sfx.play(win ? 'win' : 'lose');
    if (win) {
        burstScroll(VIEW_W / 2, VIEW_H / 2);
        flashScreen(0.6, '#ffd76a');
    } else {
        shakeScreen(0.6, 12);
        flashScreen(0.5, '#ff2d55');
    }
    updateUI();
}
