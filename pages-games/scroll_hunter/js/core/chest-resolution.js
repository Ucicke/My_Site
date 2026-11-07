/* ================================================================
   SCROLL HUNTER · core/chest-resolution.js
   Разрешение сундуков, добычи и эффектов свитков.
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   Что оказалось в сундуке
--------------------------------------------------------------- */
function resolveOpen(idx) {
    const c = chests[idx];
    if (!c || c.resolved) return;
    c.resolved = true;
    c.opened = true;
    if (c.actor === 'rogi') { resolveCompanionChest(c); return; }
    if (companion.active && companion.requests && c.type === 'mimic') {
        companion.requests = 0; bumpTrust(2);
        companion.line = 'Спасибо, что не перекладываешь весь риск на меня.';
    }
    const cx = c.x + CHEST_W / 2;
    const guardian = currentNode && (currentNode.type === 'ELITE' || currentNode.type === 'GUARD');

    /* Бой с боссом идёт по своим правилам */
    if (currentNode && currentNode.type === 'BOSS') {
        resolveBossRound(idx);
        return;
    }

    if (boosts.noMimic && c.type === 'mimic') {
        boosts.noMimic = false;
        c.type = 'empty';
        c.known = 'empty';
        addFloater(cx, c.y - 60, 'ОГНЕННЫЙ ШАР! МИМИК СБЕЖАЛ!', '#ffb347', 20);
        burstScroll(cx, c.y + 40);
        Sfx.play('shield');
    }

    if (boosts.guaranteedNext) {
        boosts.guaranteedNext = false;
        if (c.type !== 'scroll') {
            c.type = 'scroll';
            c.known = 'scroll';
            addFloater(cx, c.y - 60, 'ТОЧНО! СВИТОК!', '#ffd76a', 24);
        }
    }

    let gambleMimicDamage = false;
    if (boosts.gambleNext) {
        boosts.gambleNext = false;
        if (c.type === 'scroll') {
            boosts.doubleNext = true;
            addFloater(cx, c.y - 62, 'АЗАРТ ×2!', '#ffd76a', 30);
        } else if (c.type === 'mimic') {
            gambleMimicDamage = true;
            addFloater(cx, c.y - 62, 'АЗАРТ: −2 ЖИЗНИ', '#ff5470', 30);
        }
    }

    if (c.type === 'dig') {
        resolveDigChest(c, cx);
        return;
    }
    if (c.type === 'scroll') {
        resolveScrollChest(c, cx);
        return;
    }
    if (c.type === 'mimic') {
        if (typeof HeistLoop.teamHeist === 'function' && HeistLoop.teamHeist()?.target === idx) c.teamHeistOutcome='mimic';
        resolveMimicChest(c, cx, gambleMimicDamage, guardian);
        return;
    }
    if (typeof HeistLoop.teamHeist === 'function' && HeistLoop.teamHeist()?.target === idx) c.teamHeistOutcome='empty';
    resolveEmptyChest(c, cx);
}

/* Раскопки: то ли реликвия, то ли пустота. */
function resolveDigChest(chest, centerX) {
    stats.digs++;
    if (GameRng.next('loot') < 0.55) {
        const scroll = randomRelic();
        const price = relicPrice(scroll, floor);
        const assignedByTeamDeal = typeof HeistLoop.applyTeamHeistScroll === 'function'
            ? HeistLoop.applyTeamHeistScroll(scroll,price) : false;
        if (!assignedByTeamDeal) addScrollToInventory(scroll, price);
        else chest.teamHeistOutcome='scroll-found';
        burstScroll(centerX, chest.y + 40);
        Sfx.play('scroll');
        lastEvent = 'Вы нашли в слое камня свиток: ' + scroll.name + '. Он теперь в сумке.';
        continueRoom();
        return;
    }
    if (typeof HeistLoop.teamHeist === 'function' && HeistLoop.teamHeist()?.target === chests.indexOf(chest))
        chest.teamHeistOutcome='empty';
    burstEmpty(centerX, chest.y + 30);
    Sfx.play('empty');
    addFloater(centerX, chest.y - 62, 'ТОЛЬКО КАМЕНЬ…', '#94a3b8', 26);
    lastEvent = 'Под слоем песка — только камень и ржавчина.';
    gameState = STATES.REACTION;
    updateUI();
    later(1.0, continueRoom);
}

function resolveScrollChest(chest, centerX) {
    stats.floors++;
    burstScroll(centerX, chest.y + 40);
    Sfx.play('scroll');
    addFloater(centerX, chest.y - 62, 'РЕЛИКВИЯ', '#ffd76a', 24);
    shakeScreen(0.18, 3);

    if (boosts.luckyScroll) {
        boosts.luckyScroll = false;
        hp = maxHp;
        addFloater(centerX, chest.y - 96, 'ПОЛНОЕ ИСЦЕЛЕНИЕ!', '#7dd3fc', 24);
        Sfx.play('heart');
    }

    const scroll = takeScroll(currentNode && currentNode.type === 'ELITE');
    let price = relicPrice(scroll, floor);
    if (!rogiQuestFound || scroll.id !== 'ashes') say('relic');
    else say('ashes');
    if (boosts.doubleNext) boosts.doubleNext = false;
    if (forgeNext) {
        forgeNext = false;
        price = Math.round(price * 1.5);
    }

    const assignedByTeamDeal = typeof HeistLoop.applyTeamHeistScroll === 'function'
        ? HeistLoop.applyTeamHeistScroll(scroll,price) : false;
    if (assignedByTeamDeal) chest.teamHeistOutcome='scroll-found';
    if (!assignedByTeamDeal) {
        addScrollToInventory(scroll, price);
        lastEvent = `${scroll.name} убран в сумку. Прочитать его можно позже.`;
    }
    continueRoom();
}

function resolveMimicChest(chest, centerX, gambleDamage, guardian) {
    stats.floors++;
    stats.bites++;
    Sfx.play('mimic');
    Sfx.play('bite');
    burstMimic(centerX, chest.y + 50);
    shakeScreen(0.55, 17);
    flashScreen(0.4, '#ff2d55');
    gameState = STATES.REACTION;

    let damage = gambleDamage ? 2 : (guardian ? 2 : 1);
    let playerDamaged = false;
    let biteProtection = '';
    if (boosts.doubleBiteNext) {
        boosts.doubleBiteNext = false;
        damage += 1;
    }

    if (roomNoBite) {
        biteProtection = 'room';
        addFloater(centerX, chest.y - 62, 'МИМИК НЕ УКУСИЛ!', '#9fe8ff', 26);
        Sfx.play('shield');
    } else if (boosts.shield > 0) {
        biteProtection = 'shield';
        boosts.shield--;
        addFloater(centerX, chest.y - 62, 'ЩИТ ПОГЛОТИЛ УКУС!', '#7dd3fc', 26);
        Sfx.play('shield');
    } else if (boosts.rogiInsurance && companionAvailable()) {
        biteProtection = 'rogi';
        boosts.rogiInsurance = false;
        if (companionAvailable()) hurtCompanion(damage);
        addFloater(centerX, chest.y - 62, 'РОГИ ПРИНЯЛ УДАР', '#c7b6ff', 24);
        Sfx.play('shield');
    } else {
        playerDamaged = true;
        hp -= damage;
        addFloater(centerX, chest.y - 62, '−' + damage + ' ♥', '#ff5470', 28);
        say('mimic');
        bumpTrust(1);
    }
    updateUI();

    later(1.6, () => {
        const lastScore = typeof HeistLoop.lastScore === 'function' ? HeistLoop.lastScore() : null;
        const teamHeist = typeof HeistLoop.teamHeist === 'function' ? HeistLoop.teamHeist() : null;
        if (teamHeist?.committed && !teamHeist.settled) HeistLoop.completeTeamHeist();
        const forcedExit = teamHeist?.committed && teamHeist.scope !== 'guarded-treasury' ? () => {
            gameState = STATES.CHOOSE;
            leaveRoom();
        } : lastScore?.committed ? () => {
            HeistLoop.completeLastScore();
            gameState = STATES.CHOOSE;
            leaveRoom();
        } : undefined;
        if (resolvePlayerDeath('Мимики перекусили вашу решимость. Подземелье вас больше не отпустит.',forcedExit)) return;
        lastEvent = playerDamaged
            ? 'Мимик укусил вас. Потеряно ' + damage + ' ♥.'
            : biteProtection === 'room' ? 'Мимик не смог вас укусить.'
                : biteProtection === 'shield' ? 'Щит поглотил укус мимика.'
                    : biteProtection === 'rogi' ? 'Роги приняла укус на себя.' : 'Укус мимика прошёл мимо.';
        continueRoom();
    });
}

function resolveEmptyChest(chest, centerX) {
    stats.floors++;
    burstEmpty(centerX, chest.y + 30);
    Sfx.play('empty');
    addFloater(centerX, chest.y - 62, 'ПУСТО…', '#94a3b8', 26);
    gameState = STATES.REACTION;

    if (boosts.emptyScores) {
        const bounty = Math.round(ECONOMY.emptyBounty * (boosts.goldBoost || 1));
        gold += bounty;
        stats.gold += bounty;
        addFloater(centerX, chest.y - 92, '+' + bounty + ' ЗОЛОТА (МЕЛОЧЬ)', '#cbd5e1', 22);
    }
    if (boosts.emptyHurts) {
        hp--;
        addFloater(centerX, chest.y - 92, 'УКОЛО', '#ff9f6b', 22);
    }
    lastEvent = 'Пусто.';
    updateUI();

    later(1.2, continueRoom);
}

/* ---------------------------------------------------------------
   Реликвии
--------------------------------------------------------------- */
function takeScroll(rare) {
    let pool = SCROLL_TYPES.filter(s => !foundRelics.has(s.id) && !clearedWeak.has(s.id));
    if (rare) {
        const rich = pool.filter(s => s.price >= 40);
        if (rich.length) pool = rich;
    }
    if (pool.length === 0) {
        foundRelics = new Set();
        pool = SCROLL_TYPES.filter(s => !clearedWeak.has(s.id));
        if (pool.length === 0) pool = SCROLL_TYPES;
    }
    const sc = pool[randIntIn('loot', 0, pool.length - 1)];
    foundRelics.add(sc.id);
    return sc;
}

function applyPower(powerId, n) {
    const p = POWERS[powerId];
    if (!p) return;
    p.apply(n || 1);
}

function makeScrollUndo(snapshot, after) {
    const undoChangedBoosts = (before, applied, current) => {
        if (!before || typeof before !== 'object' || Array.isArray(before) ||
            !applied || typeof applied !== 'object' || Array.isArray(applied) ||
            !current || typeof current !== 'object' || Array.isArray(current)) {
            return current === applied ? JSON.parse(JSON.stringify(before)) : current;
        }

        Object.keys(applied).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(before, key) ||
                !Object.prototype.hasOwnProperty.call(current, key)) return;
            current[key] = undoChangedBoosts(before[key], applied[key], current[key]);
        });
        return current;
    };

    return () => {
        /* Undo only the scroll's own change. Consumed charges stay consumed. */
        boosts = undoChangedBoosts(snapshot.boosts, after.boosts, boosts);
        maxHp = Math.max(1, maxHp - (after.maxHp - snapshot.maxHp));
        hp -= after.hp - snapshot.hp;
        hp = Math.min(hp, maxHp);
        gold = Math.max(0, gold - (after.gold - snapshot.gold));
        if (rogiAsks === after.rogiAsks) rogiAsks = snapshot.rogiAsks;
    };

}

function applyScrollPower(sc, silent) {
    const snapshot = {
        boosts: JSON.parse(JSON.stringify(boosts)),
        hp: hp,
        maxHp: maxHp,
        gold: gold,
        rogiAsks: rogiAsks
    };

    applyPower(sc.power, sc.n);

    const after = {
        boosts: JSON.parse(JSON.stringify(boosts)),
        hp: hp,
        maxHp: maxHp,
        gold: gold,
        rogiAsks: rogiAsks
    };

    const undo = makeScrollUndo(snapshot, after);

    if (sc.power !== 'undo') {
        appliedStack.push({ sc: sc, undo: undo, snapshot, after });
    }

    if (!silent && (sc.power === 'maxHp' || sc.power === 'heal' || sc.power === 'healFull' || sc.power === 'invuln')) {
        Sfx.play('heart');
    }
    if (!silent && sc.curse) Sfx.play('curse');
}

