/* ================================================================
   SCROLL HUNTER · core/encounters.js
   Лагерь, лавка торговца и события подземелья.
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   Лагерь
--------------------------------------------------------------- */
function campRest() {
    say('camp');
    const firstRest = !HeistLoop.hasRestedAtCamp(currentNodeId);
    const focusRestored = HeistLoop.restAtCamp(currentNodeId);
    if (!firstRest) {
        lastEvent = 'У этого костра вы уже отдыхали. Запас сил не бесконечен.';
        updateUI(); return;
    }
    if (companion.active) companion.hp = Math.min(companion.maxHp, companion.hp + 1);
    if (companion.active) RogiAI.rest(companion, true);
    if(typeof RogiWorld!=='undefined')RogiWorld.enqueue('camp',{rested:true},'camp-rest:'+companion.dungeon+':'+currentNodeId);
    if (hp >= maxHp) {
        lastEvent = focusRestored ? 'Вы перевели дух у костра: личный фокус +1. Роги тоже отдохнула.' : 'Роги отдохнула у костра.';
        updateUI(); return;
    }
    hp = Math.min(maxHp, hp + 1);
    lastEvent = 'Вы передохнули у костра. Одно сердце вернулось.' + (focusRestored ? ' Личный фокус +1.' : '');
    Sfx.play('heart');
    leaveNode();
}

function campForge() {
    forgeNext = true;
    lastEvent = 'Вы выковали сундук: следующая реликвия будет стоить на 50% дороже.';
    Sfx.play('shield');
    leaveNode();
}

function campPurify() {
    if (!boosts.curse && !boosts.noRead && !boosts.curseNext) {
        lastEvent = 'Прозрачной водой проклятие не смыть — его и не было.';
        leaveNode();
        return;
    }
    boosts.curse = false;
    boosts.noRead = false;
    boosts.curseNext = false;
    lastEvent = 'Вы окунули проклятие в святую воду. Оно ушло.';
    Sfx.play('heart');
    leaveNode();
}

/* ---------------------------------------------------------------
   Лавка: фиксированный ассортимент
--------------------------------------------------------------- */
function makeShopStock() {
    const reducedCashNotice = campaignStoryFlags.merchantSearchPending === true;
    const tech = TECHNIQUES[randIntIn('loot', 0, TECHNIQUES.length - 1)];
    const elixir = ELIXIRS[randIntIn('loot', 0, ELIXIRS.length - 1)];
    const stock = {
        cash: Math.max(0, randIntIn('loot', 120, 180) + stageIndex * 30 - (reducedCashNotice ? 35 : 0)),
        reducedCashNotice,
        technique: tech,
        techniqueSold: false,
        elixir: elixir,
        elixirSold: false,
        relic: randomRelic(),
        relicSold: false,
        cleaned: false
    };
    if (reducedCashNotice) campaignStoryFlags.merchantSearchPending = false;
    return stock;
}

function shopBuyTechnique() {
    if (!shopStock || shopStock.techniqueSold || gold < shopStock.technique.price) return;
    gold -= shopStock.technique.price;
    shopStock.cash += shopStock.technique.price;
    shopStock.techniqueSold = true;
    techniques.push(shopStock.technique.id);
    shopStock.technique.apply();
    lastEvent = `Вы купили приём «${shopStock.technique.name}»: ${shopStock.technique.desc}`;
    Sfx.play('scroll');
    updateUI();
}

function shopBuyElixir() {
    if (!shopStock || shopStock.elixirSold || gold < shopStock.elixir.price) return;
    gold -= shopStock.elixir.price;
    shopStock.cash += shopStock.elixir.price;
    shopStock.elixirSold = true;
    usedElixirs.push(shopStock.elixir.id);
    shopStock.elixir.apply();
    lastEvent = `Вы выпили «${shopStock.elixir.name}»: ${shopStock.elixir.desc}`;
    Sfx.play('heart');
    updateUI();
}

function shopBuyRelic() {
    say('shop');
    if (!shopStock || shopStock.relicSold || gold < 45) return;
    gold -= 45;
    shopStock.cash += 45;
    shopStock.relicSold = true;
    const scroll = shopStock.relic;
    const salePrice = Math.min(44, relicPrice(scroll, floor));
    addScrollToInventory(scroll, salePrice);
    lastEvent = `Вы купили ${scroll.name} за 45 золота и убрали в сумку. Прочитать его можно позже.`;
    gameState = STATES.SHOP;
    updateUI();
}

/* Услуга «очистка колоды»: убрать слабые свитки из колоды навсегда */
function shopCleanDeck() {
    if (!shopStock || shopStock.cleaned || gold < 60) return;
    gold -= 60;
    shopStock.cash += 60;
    shopStock.cleaned = true;

    const weak = SCROLL_TYPES
        .filter(s => !clearedWeak.has(s.id) && s.price <= 20)
        .sort((a, b) => a.price - b.price)
        .slice(0, 3);
    weak.forEach(s => clearedWeak.add(s.id));
    lastEvent = weak.length
        ? 'Торговец вычистил из колоды: ' + weak.map(s => s.name.replace('СВИТОК ', '')).join(', ') + '.'
        : 'Торговец посмотрел на вашу колоду и сказал, что слабых свитков в ней нет.';
    Sfx.play('shield');
    updateUI();
}

/* ---------------------------------------------------------------
   Событие
--------------------------------------------------------------- */
function chooseEvent(choiceIndex) {
    if (gameState !== STATES.EVENT) return;
    say('event');
    if (!currentEvent) return;
    const ch = currentEvent.choices[choiceIndex];
    if (!ch || ch.disabled) return;
    if (currentEvent.storyEvent) {
        const active = companion.active === true;
        const ai = active ? RogiAI.ensure(companion) : companion.ai || null;
        const history = TwoRoguesStory.summarizeHistory({ ai });
        const result = TwoRoguesStory.resolve(currentEvent.id, ch.storyChoiceId, {
            active, ai, gold, hp, trust:rogiTrust, rogiFocus:ai?.focus,
            scrolls:scrollInventory, storyFlags:campaignStoryFlags,
            rogiDecision:(kind, actions, prior) => RogiAI.choose(companion, actions, {
                decisionKind:'story-' + kind, trust:rogiTrust, tone:'polite',
                financial:RogiAI.finances(companion), playerHp:hp, companionHp:companion.hp,
                companionFocus:ai?.focus || 0, promises:ai?.promises || {}, historyBranch:prior.branch,
                riskBearer:'rogi', initiator:'player', executor:'rogi'
            })?.id,
            roll:key => active ? RogiAI.roll(companion, key) : GameRng.next('events')
        });
        if (!result) return;
        const eventGold = gold, eventHp = hp;
        gold = Math.max(0, gold + result.goldDelta);
        stats.gold += Math.max(0, result.goldDelta);
        hp = Math.max(0, Math.min(maxHp, hp + result.hpDelta));
        if (active && result.rogiFocusDelta < 0) RogiAI.spendFocus(companion, -result.rogiFocusDelta, 'story-' + result.eventId);
        if (active && result.trustDelta) bumpTrust(result.trustDelta);
        else if (!active && result.trustDelta) rogiTrust = clamp(rogiTrust + result.trustDelta, -100, 100);
        if (result.consumeScroll && scrollInventory.length) {
            const surrendered = scrollInventory.shift();
            selectedInventoryIndex = -1;
            result.text += ' Залог: свиток «' + (SCROLL_TYPES.find(item => item.id === surrendered.id)?.name || surrendered.id) + '».';
        }
        if (result.recordInspectorSuccess && active) {
            ai.seen['counterfeit-inspector-success'] = true;
            RogiAI.event(companion, 'counterfeit-inspector-success', {
                key:'casino-witness:bluff', source:'casino-witness', outcome:'success', week, dungeon:companion.dungeon
            });
            queueStoryEvent('inspector-callback');
        }
        if (currentEvent.id === 'inspector-callback') {
            campaignStoryFlags.inspectorCallbackResolved = true;
            campaignStoryFlags.merchantSearchPending = result.merchantSearchPending === true;
        }
        if (active && result.riskRefused) RogiAI.event(companion, 'two-rogues-risk-refused', {
            key:result.eventId, eventId:result.eventId, choiceId:result.choiceId, branch:history.branch
        });
        if (active && result.rogiFocusDelta < 0) RogiAI.event(companion, 'companion-risk', {
            key:'story-' + result.eventId, method:result.choiceId, dangerous:true,
            actor:'rogi', initiator:'player', executor:'rogi', riskBearer:'rogi', consented:true
        });
        if (active && result.hpDelta < 0) RogiAI.event(companion, 'player-hurt-due-to-deal', {
            key:result.eventId, eventId:result.eventId, actor:'player', initiator:'player',
            executor:'player', riskBearer:'player', causedBy:'story-deal'
        });
        if (active) {
            ai.seen['two-rogues-story:' + result.eventId] = true;
            RogiAI.event(companion, 'two-rogues-story', {
                key:result.eventId, eventId:result.eventId, choiceId:result.choiceId,
                outcome:result.outcome, branch:history.branch, rogiDecision:result.rogiDecision,
                playerHurt:result.hpDelta < 0, riskRefused:result.riskRefused
            });
        }
        lastEvent = result.text;
        if (hp <= 0) {
            resolvePlayerDeath('Событие «' + currentEvent.title + '»: ' + result.text + '. Ранение оказалось смертельным.');
            return;
        }
        if (active && typeof RogiWorld !== 'undefined') RogiWorld.enqueue('event', {
            hurt:hp < eventHp, gainedGold:gold > eventGold,
            storyId:result.eventId, choiceId:result.choiceId,
            pursuit:result.merchantSearchPending===true, collateral:result.consumeScroll===true,
            rogiDecision:result.rogiDecision
        }, 'event:' + companion.dungeon + ':' + currentNodeId);
        gameState = STATES.STEP;
        updateUI();
        return;
    }
    if ((ch.cost && gold < ch.cost) ||
        (ch.healthCost && hp <= ch.healthCost) ||
        (ch.relicForced && !scrollInventory.length)) return;
    const eventGold=gold,eventHp=hp;
    if (ch.cost) gold -= ch.cost;
    if (ch.healthCost) hp -= ch.healthCost;
    const res = ch.apply() || {};

    if (res.gold) {
        gold += Math.round(res.gold * (giftFlags.goldBonus || 1));
        stats.gold += Math.max(0, res.gold);
    }
    if (res.hp > 0) hp = Math.min(maxHp, hp + res.hp);
    else if (res.hp < 0) hp += res.hp;
    if (res.ask) boosts.freeChecks += res.ask;
    if (res.curse) boosts.curse = true;
    if (res.purify) {
        boosts.curse = false;
        boosts.noRead = false;
        boosts.curseNext = false;
    }
    if (hp <= 0) {
        resolvePlayerDeath('Событие «'+currentEvent.title+'»: '+(res.text||ch.text)+'. Ранение оказалось смертельным.');
        return;
    }
    if (res.relicForced) {
        const taken = scrollInventory.shift();
        const scroll = taken && SCROLL_TYPES.find(item => item.id === taken.id);
        lastEvent = scroll
            ? `${res.text} Потерян свиток «${scroll.name}».`
            : res.text;
        selectedInventoryIndex = -1;
    } else if (res.relic) {
        const scroll = randomRelic();
        const price = Math.round(relicPrice(scroll, floor) * (res.priceMul || 1));
        addScrollToInventory(scroll, price);
        lastEvent = `${res.text} «${scroll.name}» теперь в сумке.`;
    } else {
        lastEvent = res.text || 'Ничего не произошло.';
    }

    if(typeof RogiWorld!=='undefined')RogiWorld.enqueue('event',{hurt:hp<eventHp,gainedGold:gold>eventGold},'event:'+companion.dungeon+':'+currentNodeId);
    gameState = STATES.STEP;
    updateUI();
}

/* Уйти из комнаты без выбора */
function leaveNode() {
    clearTransientSceneEffects();
    gameState = STATES.STEP;
    updateUI();
}
