/* Map navigation and room entry. */
'use strict';

function chooseNode(nodeId) {
    const node = nodeById(map, nodeId);
    if (!node) return;
    if (!tutorial.mapStartHintSeen || mapStartHintVisible) {
        tutorial.mapStartHintSeen = true;
        mapStartHintVisible = false;
        persist();
    }

    floor = node.row + 1;
    currentNodeId = node.id;
    currentNode = node;
    if (companion.active) RogiAI.roomTransition(companion);
    visitedNodes.add(node.id);
    enterNode(node);
}

function clearTransientSceneEffects() {
    if (typeof floaters !== 'undefined') floaters.length = 0;
    if (typeof particles !== 'undefined') particles.length = 0;
    if (typeof shake !== 'undefined') shake.time = 0;
    if (typeof flash !== 'undefined') flash.time = 0;
}

function enterNode(node) {
    /* Прошлая боевая комната больше не активна. */
    /* Short-lived chest VFX belong to the room that spawned them. */
    clearTransientSceneEffects();
    lastEvent = '';
    chests = [];
    selected = -1;
    openingIdx = -1;
    rogi = null;
    rogiAsks = 0;
    rogiMsg = '';
    roomTouched = false;
    roomGoatHint = false;
    roomNoBite = false;
    roomNoChecks = false;
    roomInfo = { total: 0, room: node.type };
    HeistLoop.enterRoom(node);

    switch (node.type) {
        case 'BOSS':
            enterBoss();
            return;
        case 'TREASURE':
            resolveTreasure(node);
            return;
        case 'CAMP':
        case 'CAMP_FINALE':
            gameState = STATES.CAMP;
            break;
        case 'SHOP':
            shopStock = makeShopStock();
            sellCompanionLoot(false);
            if (shopStock.reducedCashNotice)
                lastEvent = 'На двери записка: купец Фен ищет тех, кто заверил его партию. Кошелёк лавки на 35 зол. легче.' +
                    (lastEvent ? ' ' + lastEvent : '');
            gameState = STATES.SHOP;
            break;
        case 'EVENT':
            currentEvent = drawDungeonEvent() || EVENTS[0] || null;
            stats.events++;
            gameState = STATES.EVENT;
            break;
        default:
            setupChests(node.type);
            gameState = STATES.CHOOSE;
    }
    Sfx.play('room');
    updateUI();
}

/* Подготовка сундуков по типу комнаты */
