/* ================================================================
   SCROLL HUNTER · core/headless-scroll-runtime.js
   Node-only adapter for exercising the real inventory read path.
   ================================================================ */
'use strict';

const vm = require('node:vm');
const { createGameContext } = require('./headless-vm.js');

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createScrollRuntime(options = {}) {
    const baseBoosts = {
        curse: false, asks: 0, goldBoost: 1, shield: 0, revive: 0,
        noMimic: false, doubleNext: false, doubleAll: false,
        guaranteedNext: false, gambleNext: false, luckyScroll: false,
        emptyScores: false, emptyHurts: false, freeFirstAsk: false,
        peekNext: false, freeChecks: 0, lieNext: false, noRead: false,
        doubleBiteNext: false, curseNext: false, rogiDebt: false,
        rogiInsurance: false, rogiShare: 0,
        next: {
            safe: false, charm: false, swap: false, moveMimic: false,
            markMimic: false, markScroll: false, markEmpty: false,
            markAll: false, goat: false, noBite: false, noChecks: false,
            lucky: false, asks: 0
        }
    };
    const state = {
        scrollInventory: clone(options.inventory || []),
        readScrollIds: [],
        appliedStack: [],
        boosts: Object.assign(baseBoosts, clone(options.boosts || {})),
        hp: options.hp ?? 4,
        maxHp: options.maxHp ?? 4,
        gold: options.gold ?? 0,
        companion: { active: true, gold: options.companionGold ?? 0 },
        rogiAsks: 0,
        rogiTrust: 0,
        stats: { floors: 0, bites: 0, checks: 0, sold: 0, used: 0, digs: 0, gold: 0, events: 0, hits: 0 },
        lastEvent: null,
        selectedInventoryIndex: 0,
        inventoryReturnState: 'STEP',
        gameState: 'INVENTORY',
        rogiQuestFound: false,
        resolvedDeath: null,
        persistenceWrites: 0,
        uiUpdates: 0
    };

    const states = {
        STEP: 'STEP', CHOOSE: 'CHOOSE', VERDICT: 'VERDICT',
        TREASURE_CHOICE: 'TREASURE_CHOICE', BOSS_GIFT: 'BOSS_GIFT',
        CAMP: 'CAMP', SHOP: 'SHOP', EVENT: 'EVENT', INVENTORY: 'INVENTORY',
        GAME_OVER: 'GAME_OVER', VICTORY: 'VICTORY'
    };
    const sandbox = {
        ...state,
        STATES: states,
        stage: 1,
        tribute: 0,
        VIEW_W: 1280,
        VIEW_H: 720,
        replayingReadScrolls: false,
        Sfx: { play() {} },
        blockedByStinginess: () => state.boosts.noRead,
        say() {},
        bumpTrust: amount => { state.rogiTrust += amount; },
        persist: () => { state.persistenceWrites += 1; },
        updateUI: () => { state.uiUpdates += 1; },
        addFloater() {},
        renderRogi() {},
        renderStateUI() {},
        isLocked: () => false,
        resolvePlayerDeath: reason => { state.resolvedDeath = reason; },
        rogiPanelData: null,
        rogiTrust: 0
    };
    const context = createGameContext(sandbox, [
        'js/data/scrolls.js',
        'js/data/powers.js',
        'js/core/chest-resolution.js',
        'js/core/inventory.js'
    ]);

    const snapshot = () => clone({
        hp: context.hp,
        maxHp: context.maxHp,
        gold: context.gold,
        companionGold: context.companion.gold,
        inventory: context.scrollInventory,
        readScrollIds: context.readScrollIds,
        boosts: context.boosts,
        used: context.stats.used,
        persistenceWrites: context.persistenceWrites,
        uiUpdates: context.uiUpdates,
        resolvedDeath: context.resolvedDeath
    });

    vm.runInContext('globalThis.__headlessCatalog = () => SCROLL_TYPES.map(scroll => ({ id: scroll.id, power: scroll.power, registered: Boolean(POWERS[scroll.power]) }))', context);
    const catalog = () => clone(context.__headlessCatalog());

    return {
        read(index) {
            context.readInventoryScroll(index);
            return snapshot();
        },
        state: snapshot,
        catalog
    };
}

module.exports = { createScrollRuntime };
