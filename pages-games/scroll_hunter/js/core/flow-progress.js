/* Room rewards, exits, and run progression. */
'use strict';

function resolveTreasure(node) {
    const stage = STAGES[clamp(stageIndex, 0, STAGES.length - 1)];

    /* Сокровищница всегда предлагает награду или риск. */
    treasureBase = Math.round(randIntIn('loot', 60, 110) * stage.goldBonus * (giftFlags.goldBonus || 1));
    gameState = STATES.TREASURE_CHOICE;
    updateUI();
}

/* Забрать сокровищницу: осторожно или азартно */
function takeTreasure(greedy) {
    if (greedy) {
        if (GameRng.next('loot') < 0.3) {
            hp--;
            addFloater(VIEW_W / 2, VIEW_H / 2, 'МИМИК ИЗ СОКРОВИЩНИЦЫ!', '#ff5470', 26);
            Sfx.play('mimic');
            shakeScreen(0.4, 12);
            lastEvent = 'Ловушка. Только потерянное сердце.';
            if (resolvePlayerDeath('Сокровищница оказалась пастью. Арендодатель заберёт остаток.')) return;
        } else {
            const gain = Math.round(treasureBase * 2.5);
            gold += gain;
            stats.gold += gain;
            addFloater(VIEW_W / 2, VIEW_H / 2, '+' + gain + ' ЗОЛОТА!', '#ffd76a', 30);
            Sfx.play('scroll');
            lastEvent = 'Из сокровищницы: ' + gain + ' зол.';
        }
    } else {
        gold += treasureBase;
        stats.gold += treasureBase;
        addFloater(VIEW_W / 2, VIEW_H / 2, '+' + treasureBase + ' ЗОЛОТА', '#ffd76a', 28);
        Sfx.play('scroll');
        lastEvent = 'Забрали ' + treasureBase + ' зол.';
    }
    gameState = STATES.STEP;
    updateUI();
}

function resolvePlayerDeath(reason, onRevive) {
    if (hp > 0) return false;

    if (boosts.revive > 0) {
        boosts.revive--;
        hp = 1;
        addFloater(VIEW_W / 2, VIEW_H / 2, 'ВЫ ВОСКРЕСЛИ!', '#ffd76a', 30);
        Sfx.play('heart');
        flashScreen(0.5, '#ffd76a');
        lastEvent = 'Вы воскресли с одним сердцем.';
        if (onRevive) {
            onRevive();
        } else {
            gameState = STATES.STEP;
            updateUI();
        }
    } else {
        finishCampaign(false, reason);
    }
    return true;
}

/* После реликвии возвращаемся в контекст текущего узла.
   В бою остаёмся, пока есть невскрытые сундуки; иначе уходим. */
function continueRoom() {
    const committedScore = typeof HeistLoop.lastScore === 'function' ? HeistLoop.lastScore() : null;
    const teamHeist = typeof HeistLoop.teamHeist === 'function' ? HeistLoop.teamHeist() : null;
    const forceLastScoreExit = !!committedScore?.committed;
    const settleTreasuryHeist = !!teamHeist?.committed && !teamHeist.settled && teamHeist.scope === 'guarded-treasury';
    const forceTeamHeistExit = !!teamHeist?.committed && !teamHeist.settled && teamHeist.scope !== 'guarded-treasury';
    const forcedExit = forceTeamHeistExit || forceLastScoreExit ? () => {
        if (forceTeamHeistExit) HeistLoop.completeTeamHeist();
        else HeistLoop.completeLastScore();
        gameState = STATES.CHOOSE;
        leaveRoom();
    } : undefined;
    if (resolvePlayerDeath('Вы потеряли последнее сердце. Подземелье вас больше не отпустит.',forcedExit)) return;
    if (settleTreasuryHeist) HeistLoop.completeTeamHeist();
    if (forceTeamHeistExit) {
        HeistLoop.completeTeamHeist();
        lastEvent += ' Афера закончена — сборщик выгнал вас из комнаты.';
        gameState = STATES.CHOOSE;
        leaveRoom();
        return;
    }
    if (forceLastScoreExit) {
        HeistLoop.completeLastScore();
        lastEvent += ' Попытка закончена — сборщик выгнал вас из комнаты.';
        gameState = STATES.CHOOSE;
        leaveRoom();
        return;
    }
    if (HeistLoop.noteResolution()) return;

    const roomType = currentNode && currentNode.type;
    const left = chests.some(c => !c.opened);
    if (roomType === 'SHOP') {
        gameState = STATES.SHOP;
    } else if (roomType === 'EVENT') {
        gameState = STATES.STEP;
    } else if (left && hp > 0) {
        gameState = STATES.CHOOSE;
        selected = -1;
    } else {
        /* Содержимое уже обработано: снимаем блокировку завершённого
           вскрытия/реакции перед автоматическим выходом из комнаты. */
        gameState = STATES.CHOOSE;
        leaveRoom();
    }
    updateUI();
}

/* Уйти из комнаты, оставив добычу */
function leaveRoom() {
    if (isLocked()) return;
    if (chests.length && !chests.some(chest => chest.opened && !chest.destroyed)) {
        lastEvent = 'Чтобы уйти из комнаты, откройте хотя бы один сундук.';
        updateUI();
        return;
    }
    roomNoBite = false;
    roomNoChecks = false;
    HeistLoop.leaveRoom();
    clearTransientSceneEffects();
    say('leave');
    bumpTrust(1);
    gameState = STATES.STEP;
    updateUI();
}

function stepActions() {
    const actions = [];
    const reachable = reachableNodes(map, currentNodeId);

    reachable.forEach(id => {
        const node = nodeById(map, id);
        if (!node) return;
        const t = ROOM_TYPES[node.type] || ROOM_TYPES.FIGHT;
        actions.push({
            text: t.name,
            icon: ICONS[node.type] || ICONS.FIGHT,
            sub: t.risk || '',
            cls: 'btn-path',
            action: () => chooseNode(id)
        });
    });

    return actions;
}

/* Забег окончен: на поверхности предстоит расчёт долга за неделю. */
function endAttempt(reason) {
    lastEvent = reason;
    attemptOver = true;
    gameState = STATES.STEP;
    updateUI();
}
