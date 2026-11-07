/* ================================================================
   SCROLL HUNTER · core/ui.js
   Интерфейс: шапка, карта, сообщения, кнопки.
   ================================================================ */
'use strict';

function createButtons(list) {
    /* Кнопки рисуются на холсте — здесь только модель и клавиатура */
    const buttons = (list || []).slice();

    canvasButtons = buttons;
    primaryAction = null;
    buttons.forEach((cfg) => {
        if (!cfg.disabled && !primaryAction) primaryAction = cfg.action;
    });
}

function isLocked() {
    return gameState === STATES.OPENING || gameState === STATES.REACTION;
}

function heartsHtml() {
    let html = '';
    for (let i = 0; i < maxHp; i++) {
        html += `<span class="heart ${i < hp ? 'full' : 'empty'}">♥</span>`;
    }
    return html;
}

function boonChips() {
    const chips = [];
    const nx = boosts.next;

    if (boosts.curse) chips.push({ icon: '💀', text: 'Проклятие', cls: 'bad' });
    if (boosts.curseNext) chips.push({ icon: '🌫️', text: 'Проклятие (1 зал)', cls: 'bad' });
    if (boosts.asks > 0) chips.push({ icon: '⏰', text: `Бесплатных советов: +${boosts.asks}`, cls: 'good' });
    if (boosts.shield > 0) chips.push({ icon: '🛡', text: `Щит ×${boosts.shield}`, cls: 'good' });
    if (boosts.revive > 0) chips.push({ icon: '🕊️', text: `Воскрешение ×${boosts.revive}`, cls: 'good' });
    if (roomNoBite) chips.push({ icon: '🛡️', text: 'В этом зале мимики не кусают', cls: 'good' });
    if (roomNoChecks) chips.push({ icon: '🌑', text: 'В этом зале Роги не появится', cls: 'good' });
    if (boosts.noMimic) chips.push({ icon: '🔥', text: 'Огненный шар', cls: 'good' });
    if (boosts.doubleNext) chips.push({ icon: '🎰', text: 'Реликвия ×2', cls: 'good' });
    if (boosts.doubleAll) chips.push({ icon: '💰', text: 'Все ×2', cls: 'good' });
    if (boosts.guaranteedNext) chips.push({ icon: '🎯', text: 'Гарант. свиток', cls: 'good' });
    if (boosts.gambleNext) chips.push({ icon: '🎲', text: 'Азарт: ×2 / −2 ♥', cls: 'bad' });
    if (boosts.luckyScroll) chips.push({ icon: '🍀', text: 'Свиток лечит', cls: 'good' });
    if (boosts.emptyScores) chips.push({ icon: '🪙', text: 'Пустые платят', cls: 'good' });
    if (boosts.emptyHurts) chips.push({ icon: '😠', text: 'Пустые ранят', cls: 'bad' });
    if (boosts.peekNext) chips.push({ icon: '🪟', text: 'Сундук виден', cls: 'good' });
    if (boosts.freeChecks > 0) chips.push({ icon: '🕶️', text: `Бесплатных советов: ${boosts.freeChecks}`, cls: 'good' });
    if (boosts.lieNext) chips.push({ icon: '🎭', text: 'Роги соврёт', cls: 'bad' });
    if (boosts.noRead) chips.push({ icon: '🤐', text: 'Читать нельзя', cls: 'bad' });
    if (boosts.doubleBiteNext) chips.push({ icon: '🌑', text: 'Двойной укус', cls: 'bad' });
    if (boosts.freeFirstAsk) chips.push({ icon: '🌊', text: 'Первый вопрос Роги — бесплатно', cls: 'good' });
    if (boosts.goldBoost && boosts.goldBoost > 1) chips.push({ icon: '💰', text: 'Продажи +50%', cls: 'good' });
    if (forgeNext) chips.push({ icon: '🔨', text: 'Реликвия +50%', cls: 'good' });
    if (maxHp > START_HP) chips.push({ icon: '❤️', text: `Здоровье ${maxHp}`, cls: 'good' });

    if (nx.safe) chips.push({ icon: '🏛️', text: 'Без мимика', cls: 'good' });
    if (nx.charm) chips.push({ icon: '💖', text: 'Мимик → пусто', cls: 'good' });
    if (nx.swap) chips.push({ icon: '🔀', text: 'Сундуки меняются', cls: 'good' });
    if (nx.moveMimic) chips.push({ icon: '🧲', text: 'Мимик прыгнет', cls: 'good' });
    if (nx.markMimic) chips.push({ icon: '🪞', text: 'Мимик отмечен', cls: 'good' });
    if (nx.markScroll) chips.push({ icon: '🗺️', text: 'Свиток отмечен', cls: 'good' });
    if (nx.markEmpty) chips.push({ icon: '🔮', text: 'Пустой отмечен', cls: 'good' });
    if (nx.markAll) chips.push({ icon: '🦅', text: 'Всё известно', cls: 'good' });
    if (nx.goat || roomGoatHint) {
        chips.push({
            icon: '🐐',
            text: roomGoatHint ? 'Козы: пустой' : 'Козы',
            cls: 'good'
        });
    }
    if (nx.noBite) chips.push({ icon: '🛡️', text: 'В следующем зале мимики не укусят', cls: 'good' });
    if (nx.noChecks) chips.push({ icon: '🌑', text: 'В следующем зале Роги не появится', cls: 'bad' });
    if (nx.lucky) chips.push({ icon: '🔁', text: 'Только реликвии', cls: 'good' });
    if (nx.asks > 0) chips.push({ icon: '🏮', text: `В след. зале бесплатно: +${nx.asks}`, cls: 'good' });

    return chips;
}


function updateUI() {
    if(typeof RogiConversation!=='undefined')RogiConversation.flush(companion);
    if (typeof RogiAI !== 'undefined' && companion?.active) RogiAI.syncFinances(companion);
    if (attemptOver && gameState === STATES.STEP) prepareCompanionSettlement();
    if(typeof RogiWorld!=='undefined')RogiWorld.observe();
    if (typeof RogiAI !== 'undefined' && companion?.active && !companionModal && companion.ai?.drama?.pending &&
        [STATES.CHOOSE, STATES.STEP].includes(gameState)) RogiAI.openDialogue(companion);
    try { saveRunCheckpoint(); } catch (_) {}
    const menu = [STATES.INTRO, STATES.PROLOGUE, STATES.GAME_OVER, STATES.VICTORY, STATES.QUARTERMASTER]
        .includes(gameState);
    ui.container.classList.toggle('menu-mode', menu);

    const onMap = gameState === STATES.STEP;
    const inShop = gameState === STATES.QUARTERMASTER;
    ui.container.classList.toggle('show-map', onMap);
    ui.container.classList.toggle('show-scene', !onMap);
    ui.container.classList.toggle('show-shop', inShop);

    const stage = STAGES[clamp(stageIndex, 0, STAGES.length - 1)];
    const tribute = currentTribute();

    /* Шапка */
    /* Шапку, чипы и полосу золота рисует холст — здесь ничего трогать не нужно */

    /* на карте Роги нет — он ждёт в комнатах */
    if ([STATES.STEP, STATES.PROLOGUE, STATES.GAME_OVER, STATES.VICTORY].includes(gameState)) rogiPanelData = null;
    else renderRogi();

    renderStateUI(stage, tribute);
}

function blockedByStinginess() {
    return boosts.noRead;
}
