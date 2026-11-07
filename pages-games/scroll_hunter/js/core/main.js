/* ================================================================
   SCROLL HUNTER · core/main.js
   Настройки, хуки для движка, запуск.
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   Настройки
--------------------------------------------------------------- */
function toggleMute() {
    settings.muted = !settings.muted;
    Sfx.setMuted(settings.muted);
    persist();
}

function openRules(open) {
    rulesOpen = !!open;
    if (open) rulesScrollY = 0;
    if (open) Sfx.play('click');
    updateUI();
}

/* ---------------------------------------------------------------
   Хуки для движка
--------------------------------------------------------------- */
function gameUpdate(dt) {
    updateTimeline(dt);
    if(typeof RogiWorld!=='undefined')RogiWorld.update(dt);

    /* Открывается только тот сундук, который реально вскрывают */
    if (openingIdx >= 0 && chests[openingIdx]) {
        const c = chests[openingIdx];
        c.openT = Math.min(1, c.openT + dt * c.openSpeed);
        if (c.openT >= 1 && gameState === STATES.OPENING) {
            const idx = openingIdx;
            openingIdx = -1;
            resolveOpen(idx);
        }
    }
}

function gameRender(t) {
    /* сцена живёт в движке: каждый экран рисует свой контекст */
    const renderState = gameState === STATES.INVENTORY ? inventoryReturnState : gameState;
    const scene = {
        'CAMP': 'camp', 'SHOP': 'shop', 'EVENT': 'event', 'BOSS_GIFT': 'boss'
    }[renderState] || null;
    drawScene(scene);

    switch (gameState) {
        case STATES.INTRO:
            drawOverlay('intro', {}, t);
            break;
        case STATES.PROLOGUE:
            break;
        case STATES.GAME_OVER:
            drawOverlay('over', {
                line1: lastResult.reason,
                line2: `Золота в кошеле: ${lastResult.gold}   ·   Неделя ${lastResult.week}   ·   Уровней пройдено: ${lastResult.floors}   ·   Укусов: ${lastResult.bites}`,
                line3: `Лучшая добыча: ${record.best} зол.   ·   Побед: ${record.wins}`
            }, t);
            break;
        case STATES.VICTORY:
            drawOverlay('win', {
                line1: lastResult.reason,
                line2: `Золота в кошеле: ${lastResult.gold}   ·   Неделя ${lastResult.week}   ·   Уровней пройдено: ${lastResult.floors}   ·   Реликвий продано: ${lastResult.sold}`,
                line3: `Реликвий использовано: ${lastResult.used}   ·   Пыли: ${lastResult.dust}   ·   Побед: ${record.wins}`
            }, t);
            break;
        case STATES.CAMP:
            drawScene('camp');
            drawNodeScene(t);
            break;
        case STATES.SHOP:
            drawScene('shop');
            drawNodeScene(t);
            break;
        case STATES.EVENT:
            drawScene('event');
            drawNodeScene(t);
            break;
        case STATES.BOSS_GIFT:
            drawScene('boss');
            drawOverlay('node', {
                icon: '👑',
                title: 'ДАР ПРЕДВОДИТЕЛЯ',
                sub: 'Сила взамен на ограничение. Ваш выбор.',
                color: '#ff2d55'
            }, t);
            break;
        case STATES.STEP:
            if (currentNode) drawNodeScene(t);
            break;
        case STATES.INVENTORY:
            if ([STATES.CAMP, STATES.SHOP, STATES.EVENT].includes(inventoryReturnState)) {
                drawNodeScene(t);
            } else if (inventoryReturnState === STATES.BOSS_GIFT) {
                drawOverlay('node', {
                    icon: '👑',
                    title: 'ДАР ПРЕДВОДИТЕЛЯ',
                    sub: 'Сила взамен на ограничение. Ваш выбор.',
                    color: '#ff2d55'
                }, t);
            } else if (inventoryReturnState === STATES.STEP && !currentNode) {
                /* The map and stage title are rendered by the canvas HUD. */
            } else if (inventoryReturnState === STATES.STEP) {
                drawNodeScene(t);
            } else {
                drawRoomComposition();
                chests.forEach(c => {
                    c.selected = (chests.indexOf(c) === selected);
                    drawChest(c, t);
                });
                drawRogiFigure(t);
            }
            break;
        case STATES.QUARTERMASTER:
            /* лавка — экран вне подземелья, сундуки из прошлого забега не рисуем */
            break;

        default:
            drawRoomComposition();
            chests.forEach(c => {
                c.selected = (chests.indexOf(c) === selected);
                drawChest(c, t);
            });
            drawRogiFigure(t);
    }
}


/* Сцена текущего узла карты */
function drawNodeScene(t) {
    const node = currentNode;
    const type = node ? (ROOM_TYPES[node.type] || ROOM_TYPES.FIGHT) : null;
    if (!type) return;
    drawRoomPlaque(floor, stageLevels() + 1);
    /* EVENT content is already presented in the interactive message panel.
       A second, oversized room title behind it duplicates and competes with
       the actual choice screen, especially for story events. */
    if (node.type === 'EVENT') return;
    /* Camp and merchant are composed as full illustrated locations and get
       their own compact headings in Canvas UI. The generic room overlay used
       to duplicate the location title and obscure the new artwork. */
    if (node.type === 'CAMP' || node.type === 'CAMP_FINALE' || node.type === 'SHOP') return;
    drawOverlay('node', {
        icon: type.icon,
        noIcon: true,
        title: type.name,
        sub: type.desc,
        color: type.color
    }, t);
}

/* ---------------------------------------------------------------
   Старт
--------------------------------------------------------------- */
let primaryAction = null;

function boot() {
    loadSave();
    Sfx.muted = settings.muted;
    /* Кнопка звука и карта теперь на холсте */


    if (!restoreRunCheckpoint()) gameState = STATES.INTRO;
    updateUI();

    if (typeof startGameLoop === 'function') startGameLoop();
}

boot();
