/* ================================================================
   SCROLL HUNTER · core/inventory.js
   Инвентарь свитков, чтение и расчёт продажи.
   ================================================================ */
'use strict';

function addScrollToInventory(scroll, price) {
    if (!scroll) return;
    scrollInventory.push({ id: scroll.id, price: Math.max(0, Math.round(price || 0)) });
}

function canOpenInventory() {
    return !isLocked() && [STATES.STEP, STATES.CHOOSE, STATES.VERDICT,
        STATES.TREASURE_CHOICE, STATES.BOSS_GIFT, STATES.CAMP, STATES.SHOP,
        STATES.EVENT].includes(gameState);
}

function openInventory() {
    if (!canOpenInventory()) return;
    inventoryReturnState = gameState;
    inventoryPage = 0;
    selectedInventoryIndex = -1;
    gameState = STATES.INVENTORY;
    updateUI();
}

function closeInventory() {
    gameState = inventoryReturnState || STATES.STEP;
    inventoryReturnState = null;
    inventoryPage = 0;
    selectedInventoryIndex = -1;
    updateUI();
}

function removeReadScroll(scrollId) {
    const index = readScrollIds.lastIndexOf(scrollId);
    if (index >= 0) readScrollIds.splice(index, 1);
}

function readInventoryScroll(index) {
    const entry = scrollInventory[index];
    if (!entry || blockedByStinginess()) return;
    const scroll = SCROLL_TYPES.find(item => item.id === entry.id);
    if (!scroll) {
        scrollInventory.splice(index, 1);
        selectedInventoryIndex = -1;
        updateUI();
        return;
    }

    const returnState = inventoryReturnState || STATES.STEP;
    const undoTarget = scroll.power === 'undo' && appliedStack.length
        ? appliedStack[appliedStack.length - 1].sc.id : null;
    const stackLength = appliedStack.length;
    if (typeof HeistLoop !== 'undefined' && typeof HeistLoop.noteTeamHeistNoSale === 'function')
        HeistLoop.noteTeamHeistNoSale(entry,'read');
    scrollInventory.splice(index, 1);
    stats.used++;
    applyScrollPower(scroll);
    if (scroll.power === 'undo') {
        if (appliedStack.length < stackLength && undoTarget) removeReadScroll(undoTarget);
    } else {
        readScrollIds.push(scroll.id);
    }
    say('use');
    bumpTrust(2);
    lastEvent = scroll.desc;
    inventoryReturnState = null;
    selectedInventoryIndex = -1;
    gameState = returnState;
    persist();

    if (hp <= 0) {
        resolvePlayerDeath('Свиток отнял последнее сердце. Подземелье вас больше не отпустит.');
        return;
    }
    updateUI();
}

function quoteInventorySale(entry) {
    if (atDungeonExit()) {
        const proceeds = Math.floor((entry ? entry.price : 0) / 2);
        const share = entry?.rogiSharePercent ? Math.floor(proceeds * entry.rogiSharePercent / 100) : 0;
        return proceeds - share;
    }
    let price = entry ? entry.price : 0;
    if (companion.active && boosts.rogiDebt) price = 0;
    if (companion.active && boosts.rogiShare && !inventorySaleMercy()) {
        price = Math.round(price * (1 - boosts.rogiShare));
    }
    if (entry?.rogiSharePercent) price -= Math.floor(price * entry.rogiSharePercent / 100);
    return Math.max(0, Math.round(price));
}

function inventoryBuyerCost(entry) {
    return entry?.rogiSharePercent ? Math.max(0,Math.round(entry.price)) : quoteInventorySale(entry);
}

function atDungeonExit() {
    return attemptOver && hp > 0 && (gameState === STATES.STEP ||
        (gameState === STATES.INVENTORY && inventoryReturnState === STATES.STEP));
}

function inventorySaleMercy() {
    if (boosts.saleMercy === undefined) boosts.saleMercy = metaRogueMercy();
    return boosts.saleMercy;
}

function exitScrollValue() {
    return scrollInventory.reduce((sum, entry) => sum + Math.floor(entry.price / 2), 0);
}

function sellExitInventory() {
    if (!atDungeonExit()) return;
    const count = scrollInventory.length;
    let total = 0, rogiTotal = 0;
    scrollInventory.splice(0).forEach(entry => {
        const scroll = SCROLL_TYPES.find(item => item.id === entry.id);
        if (!scroll) return;
        const proceeds = Math.floor(entry.price / 2);
        const split = ScrollHunterHeistRules.rules.splitSaleProceeds(proceeds,entry.rogiSharePercent || 0);
        if (typeof HeistLoop !== 'undefined' && typeof HeistLoop.noteTeamHeistSale === 'function')
            HeistLoop.noteTeamHeistSale(entry,split.companion);
        const price = split.player;
        companion.gold += split.companion;
        rogiTotal += split.companion;
        sellRelic(scroll, price, false);
        total += proceeds;
    });
    const soldText = count === 1 ? `Продан ${scrollCountText(count)}` : `Продано ${scrollCountText(count)}`;
    lastEvent = `На выходе ${soldText} за ${total} зол. (50% стоимости).` +
        (rogiTotal ? ` Из выручки Роги получила ${rogiTotal} зол. по договору.` : '');
    if (companion.active && typeof RogiAI !== 'undefined') RogiAI.syncFinances(companion);
    persist();
    updateUI();
}

function applyInventorySaleModifiers(entry) {
    let price = entry ? entry.price : 0;
    let note = '';
    if (companion.active && boosts.rogiDebt) {
        boosts.rogiDebt = false;
        note = ' Роги забрал эту находку себе — он же обещал.';
        price = 0;
    }
    if (companion.active && boosts.rogiShare) {
        const share = boosts.rogiShare;
        boosts.rogiShare = 0;
        if (inventorySaleMercy()) note += ' Роги простил свою долю.';
        else {
            price = Math.round(price * (1 - share));
            note += ' Роги взял свою долю.';
        }
        delete boosts.saleMercy;
    }
    const split = ScrollHunterHeistRules.rules.splitSaleProceeds(price,entry.rogiSharePercent || 0);
    if (typeof HeistLoop !== 'undefined' && typeof HeistLoop.noteTeamHeistSale === 'function')
        HeistLoop.noteTeamHeistSale(entry,split.companion);
    price = split.player;
    if (split.companion) note += ' Доля Роги: ' + split.companion + ' зол. из выручки.';
    companion.gold += Math.max(0, entry.price - price);
    if (companion.active && typeof RogiAI !== 'undefined') RogiAI.syncFinances(companion);
    return { price: Math.max(0, Math.round(price)), note };
}

function sellInventoryScroll(index) {
    const exit = atDungeonExit();
    if (gameState !== STATES.INVENTORY || (!exit && inventoryReturnState !== STATES.SHOP)) return;
    const entry = scrollInventory[index];
    const scroll = entry && SCROLL_TYPES.find(item => item.id === entry.id);
    if (!entry || !scroll) return;

    const quoted = quoteInventorySale(entry);
    const buyerCost = exit ? quoted : inventoryBuyerCost(entry);
    if (!exit && (!shopStock || shopStock.cash < buyerCost)) return;
    const exitGross = Math.floor(entry.price / 2);
    const exitSplit = exit ? ScrollHunterHeistRules.rules.splitSaleProceeds(exitGross,entry.rogiSharePercent || 0) : null;
    const exitShare = exitSplit?.companion || 0;
    const sale = exit ? { price: exitSplit.player, note: ' Выкуп на выходе: половина стоимости.' } : applyInventorySaleModifiers(entry);
    if (exit && exitShare) {
        companion.gold += exitShare;
        sale.note += ' Доля Роги: ' + exitShare + ' зол. из выручки.';
        if (typeof RogiAI !== 'undefined') RogiAI.syncFinances(companion);
    }
    if (exit && typeof HeistLoop !== 'undefined' && typeof HeistLoop.noteTeamHeistSale === 'function')
        HeistLoop.noteTeamHeistSale(entry,exitShare);
    if (!exit) shopStock.cash -= buyerCost;
    scrollInventory.splice(index, 1);
    sellRelic(scroll, sale.price);
    say('sell');
    lastEvent = `Продали ${scroll.name} за ${sale.price} зол.` + sale.note;
    selectedInventoryIndex = -1;
    inventoryPage = Math.min(inventoryPage, Math.max(0, Math.ceil(scrollInventory.length / 8) - 1));
    updateUI();
}

function settleScrollInventory(win) {
    if (!win) {
        scrollInventory = [];
        readScrollIds = [];
        appliedStack = [];
        persist();
        return;
    }

    // При победе автоматической продажи нет: выкуп выполняется на выходе перед оплатой долга.
}

/* ---------------------------------------------------------------
   Между уровнями: выбор пути и завершение забега
--------------------------------------------------------------- */
/* Общая проверка смерти и воскрешения после урона. */
