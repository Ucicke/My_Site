/* Chest selection, interaction, and room composition. */
'use strict';

function selectChest(i) {
    if (gameState !== STATES.CHOOSE) return;
    if (!chests[i] || chests[i].destroyed) return;
    if (companion.active && selected >= 0 && selected !== i) RogiAI.event(companion, 'plan-changed', { from: selected, to: i, actor: 'player' });

    if (!roomTouched) {
        roomTouched = true;
        if (boosts.curse) applyCurse(i);
        if (boosts.curseNext) {
            boosts.curseNext = false;
            applyCurse(i);
        }
    }

    if (boosts.peekNext && !chests[i].known) {
        boosts.peekNext = false;
        chests[i].known = chests[i].type;
        addFloater(chests[i].x + CHEST_W / 2, chests[i].y - 60, 'ВИДНО', '#9fe8ff', 20);
        Sfx.play('check');
    }

    selected = i;
    Sfx.play('select');
    updateUI();
}

function applyCurse(i) {
    const c = chests[i];
    if (!c || c.type === 'empty') return;
    const j = chests.findIndex(ch => ch.type === 'empty');
    if (j < 0) return;
    const tmp = c.type;
    c.type = chests[j].type;
    chests[j].type = tmp;
    c.known = null;
    addFloater(c.x + CHEST_W / 2, c.y - 60, 'ПРОКЛЯТИЕ!', '#ff5470', 24);
    Sfx.play('curse');
}

/* ---------------------------------------------------------------
 * Разведка -> спрос Роги
--------------------------------------------------------------- */
/* Спросить Роги: про выбранный сундук, а если его не выбрано — про комнату */
function askRogi() {
    if (!rogi) return;
    if (selected >= 0) askRogiChest();
    else askRogiRoom();
}

function requestOpen(heistMethod = 'careful') {
    if (gameState !== STATES.CHOOSE) return;
    if (selected < 0) return;
    if (!chests[selected] || chests[selected].opened) return;
    if (companion.active && companion.ai?.promises.risk?.status === 'active')
        RogiAI.event(companion, 'player-risk', { key: chests[selected].id || selected, actor: 'player',initiator:'player',executor:'player',riskBearer:'player' });
    if (companion.active && chests[selected].known === 'mimic' && companion.ai?.promises.noKnownDanger?.status === 'active')
        RogiAI.event(companion, 'player-known-danger', { key: chests[selected].id || selected, actor: 'player',initiator:'player',executor:'player',riskBearer:'player' });
    if (!HeistLoop.beforeOpen(heistMethod, 'player')) return;
    openChest(selected);
}

function canDestroyChest(index) {
    const chest = chests[index];
    if (gameState !== STATES.CHOOSE || !chest || chest.opened) return false;
    // Оставляем хотя бы один сундук для обязательного вскрытия перед выходом.
    return chests.some(item => item.opened && !item.destroyed) ||
        chests.filter(item => !item.opened).length > 1;
}

function requestDestroy() {
    if (!canDestroyChest(selected)) return;
    if (!HeistLoop.beforeOpen('rough', 'player')) return;
    const chest = chests[selected];
    const kind = chestKind(chest);
    const before = rogiTrust;
    chest.opened = true;
    chest.destroyed = true;
    chest.known = null;
    chest.hint = false;
    chest.selected = false;
    roomTouched = true;
    if (kind === 'mimic') bumpTrust(10);
    else if (kind === 'relic') bumpTrust(-10);
    if (companion.active && kind === 'mimic') RogiAI.event(companion, 'mimic-destroyed', { key: selected });
    else if (companion.active && kind === 'relic') RogiAI.event(companion, 'relic-destroyed', { key: selected });
    const delta = rogiTrust - before;
    const result = kind === 'mimic' ? 'Мимик уничтожен.'
        : kind === 'relic' ? 'Реликвия уничтожена вместе с сундуком.' : 'Сундук уничтожен.';
    lastEvent = result + (delta ? ' Доверие Роги ' + (delta > 0 ? '+' : '') + delta + '.' : '');
    if (rogi && kind !== 'empty') {
        rogi.line = kind === 'mimic' ? 'Одной зубастой тварью меньше. Хорошая работа.'
            : 'Свитки не для того пережили века, чтобы ты их крушил.';
    }
    const cx = chest.x + (chest.w || CHEST_W) / 2;
    burstEmpty(cx, chest.y + 30);
    shakeScreen(0.15, 4);
    Sfx.play('empty');
    addFloater(cx, chest.y - 62, delta ? 'ДОВЕРИЕ ' + (delta > 0 ? '+' : '') + delta : 'УНИЧТОЖЕНО',
        delta > 0 ? '#9bd4b2' : '#db8588', 22);
    selected = -1;
    if (currentNode && currentNode.type === 'BOSS') {
        // Уничтожение не наносит удар боссу и не запускает награду или укус.
        updateUI();
    } else continueRoom();
}

function openChest(idx) {
    if (gameState !== STATES.CHOOSE || isLocked()) return;
    const c = chests[idx];
    if (!c) return;
    /* сундук вскрывают один раз: ни реликвии дважды, ни два укуса */
    if (c.opened) {
        lastEvent = 'Этот сундук уже вскрыт.';
        updateUI();
        return;
    }
    c.opened = true;
    openingIdx = idx;
    c.openT = 0;
    c.openSpeed = 1.55;
    gameState = STATES.OPENING;
    Sfx.play('open');
    updateUI();
}

/* ---------------------------------------------------------------
   Карта этапа: выбор узла
--------------------------------------------------------------- */
function setupChests(roomType) {
    const nx = boosts.next;
    roomNoBite = nx.noBite;
    roomNoChecks = nx.noChecks;
    const comp = roomComposition(roomType);
    roomInfo = { total: comp.total, room: roomType };
    rogiAsks = boosts.asks + nx.asks + metaStartAsks() + (rogiQuestFound ? 1 : 0);

    /* Виды сундуков: реликвия, мимик, пусто (в раскопках пусто — это котлован) */
    const kinds = [];
    for (let i = 0; i < comp.relic; i++) kinds.push('RELIC');
    for (let i = 0; i < comp.mimic; i++) kinds.push('MIMIC');
    for (let i = 0; i < comp.empty; i++) kinds.push('EMPTY');
    // A random sort comparator is inconsistent: its result and number of RNG
    // calls can change with the JS engine's sort optimisation. Use the same
    // Fisher–Yates shuffle as the rest of the game instead.
    const shuffledKinds = shuffleIn('loot', kinds);

    let types = shuffledKinds.map(k => {
        if (k === 'RELIC') return 'scroll';
        if (k === 'MIMIC') return 'mimic';
        /* в раскопках «пусто» — это место, где можно что-то выкопать */
        return roomType === 'DIG' ? 'dig' : 'empty';
    });

    /* Безопасная комната: мимики превращаются в пустые */
    if (nx.safe) types = types.map(t => (t === 'mimic' ? 'empty' : t));
    /* Чистая комната — только для обычного боя */
    if (nx.lucky && roomType !== 'ELITE') types = types.map(() => 'scroll');
    if (nx.charm) {
        const mi = types.indexOf('mimic');
        if (mi >= 0) types[mi] = 'empty';
    }

    const count = types.length;
    const xs = chestXs(count);
    chests = types.map((type, i) => ({
        x: xs[i],
        y: 170,
        w: chestWidth(count),
        type: type,
        kind: shuffledKinds[i] || 'RELIC',
        openT: 0,
        openSpeed: 1.55,
        opened: false,      /* вскрыт ли уже — второй раз не открыть */
        known: null,
        hint: false,
        selected: false
    }));

    if (nx.swap) {
        const a = randIntIn('loot', 0, count - 1);
        let b = randIntIn('loot', 0, count - 1);
        while (b === a) b = randIntIn('loot', 0, count - 1);
        const tmp = chests[a].type;
        chests[a].type = chests[b].type;
        chests[b].type = tmp;
    }

    if (nx.moveMimic) {
        const mi = chests.findIndex(c => c.type === 'mimic');
        if (mi >= 0) {
            let ti = randIntIn('loot', 0, count - 1);
            while (ti === mi) ti = randIntIn('loot', 0, count - 1);
            chests[mi].type = 'empty';
            chests[ti].type = 'mimic';
            chests[ti].known = 'mimic';
        }
    }

    if (nx.markAll) {
        chests.forEach(c => { c.known = c.type; });
    } else {
        if (nx.markMimic) markType('mimic');
        if (nx.markScroll) markType('scroll');
        if (nx.markEmpty) markType('empty');
    }

    function markType(type) {
        const idx = chests.findIndex(c => c.type === type);
        if (idx >= 0) chests[idx].known = type;
    }

    roomGoatHint = false;
    if (nx.goat) {
        const ei = chests.findIndex(c => c.type === 'empty');
        if (ei >= 0) {
            chests[ei].hint = true;
            roomGoatHint = true;
        }
    }

    /* Роги приходит последним: теперь он видит именно эту комнату
       и считает мимиков по настоящим сундукам. Некоторые комнаты проходят без него. */
    rogi = null;
    if (!roomNoChecks) spawnRogi();

    boosts.next = freshBoosts().next;

    selected = -1;
    roomTouched = false;
    rogueUsedHere = false;

    roomTint = { h: randIntIn('visual', 190, 260), s: randIntIn('visual', 25, 55), a: randIn('visual', 0.015, 0.045) };
}

/* ---------------------------------------------------------------
   Сокровищница: гарантированная награда или риск
--------------------------------------------------------------- */
