/* Rogi is a party member. Room-local riddles remain in rogi.js. */
'use strict';
const COMPANION_BALANCE = Object.freeze({
    startHp: 3, refuseTrust: -40, woundedHp: 1, shareTrust: 40,
    breakDamage: 2, breakNeutralizeChance: 0.5, breakLootLossChance: 0.35,
    breakLootValue: 0.75, repeatedRiskTrust: -3, knownDangerTrust: -5,
    giftTrustPerGold: 10, giftTrustCapPerDungeon: 20, offerPriceFactor: 0.5
});
function freshCompanion() {
    return { active: true, hp: COMPANION_BALANCE.startHp, maxHp: COMPANION_BALANCE.startHp,
        gold: 0, debt: 0, inventory: [], debtChecked: false, settled: false,
        dungeon: 0, requests: 0, giftGold: 0, giftTrust: 0, helpReceived: 0,
        line: 'У нас два долга. Давай выберемся отсюда вместе.',
        reaction: 'idle', lastLoot: null, nextLootId: 1, farewell: '', dialogueLine: '', dialogueChoices: [] };
}
let companion = freshCompanion();
let companionModal = null;
let companionAdviceUntil = 0;
let lastStableRun = '';
const RUN_SAVE_KEY = 'scroll_hunter_run_v2';

function companionAvailable() { return companion.active && companion.hp > 0; }
function companionRelation() {
    return rogiTrust < -20 ? 'Не доверяет' : rogiTrust < 25 ? 'Осторожна' : rogiTrust < 75 ? 'Доверяет' : 'Верная спутница';
}
function companionActionAssessment(method, index = selected) {
    const denied = (reason, text, context = {}) => ({ allowed:false, reason, context,
        text:typeof RogiVoice !== 'undefined' && ['injured','exhaustion','promise-risk','promise-danger','danger','resentment','pride','stress'].includes(reason)
            ? RogiVoice.compose(companion,'refusal',{reason,...context}).text : text });
    if (!companion.active) return denied('absent','Роги больше не в группе.');
    if (companion.hp <= 0) return denied('injured','Роги ранена и не может действовать. Нужен отдых у костра.');
    if(companion.ai?.restAgreement?.status==='active')return denied('rest-agreement','Мы договорились: до костра сундуки открываешь ты.');
    const c = chests[index];
    if (!c || c.opened) return denied('selection','Выберите закрытый сундук.');
    const focusCost = method === 'break' ? 2 : 1;
    const ai = typeof RogiAI !== 'undefined' ? RogiAI.ensure(companion) : null;
    const knowledge = RogiAI.knowledge(companion,c);
    if (ai && ai.focus < focusCost) return denied('exhaustion','Не хватает сосредоточенности. Нужен отдых у костра.',{focusCost});
    if (['unknown','mimic'].includes(knowledge.shared) && ai?.promises.risk?.status === 'active') return denied('promise-risk','Ты обещал принять следующий риск на себя. Этот сундук открой сам.');
    if (knowledge.shared === 'mimic' && ai?.promises.noKnownDanger?.status === 'active') return denied('promise-danger','Ты обещал не посылать меня в известную опасность.',{chest:c});
    if (method === 'break' && !chests.some(item => item.opened && !item.destroyed) && chests.filter(item => !item.opened).length <= 1) return denied('last-chest','Последний сундук нужно открыть, чтобы завершить комнату.');
    {
        const scores = RogiAI.utility(companion, [
            { id: 'assist', base: 44, tags: ['help'], traitWeights: { courage: 0.15, caution: -0.08, cooperation: 0.04 }, needWeight: { safety: -0.16 }, trustWeight: 0.1, reason: 'готовность помочь с учётом риска' },
            { id: 'refuse', base: 20, tags: ['caution'], traitWeights: { caution: 0.1, independence: 0.03 }, needWeight: { safety: 0.25 }, reason: 'личная безопасность и накопившаяся усталость' }
        ], { trust: rogiTrust, knownMimic: knowledge.shared === 'mimic', method, tone: method === 'break' ? 'command' : 'polite', companionHp: companion.hp });
        if (scores[0]?.id === 'refuse' && scores[0].score > scores[1].score + 3) {
            const repeated = ai.memory.filter(e => e.type === 'forced-risk').reduce((n,e)=>n+e.count,0);
            const reason = knowledge.shared === 'mimic' ? 'danger' : repeated >= 3 && rogiTrust < 25 ? 'resentment'
                : method === 'break' && ai.dimensions.pride + ai.dimensions.independence > 130 ? 'pride' : 'stress';
            return {...denied(reason,'Сейчас я не готова принять этот риск.',{chest:c}),scores};
        }
        return {allowed:true,reason:'agree',text:'',context:{chest:c,method},scores};
    }
    return {allowed:true,reason:'agree',text:'',context:{chest:c,method}};
}
function companionActionReason(method,index = selected) { return companionActionAssessment(method,index).text; }
function requestCompanionChest(method) {
    if (gameState !== STATES.CHOOSE || !['open', 'break'].includes(method)) return;
    RogiAI.syncFinances(companion);
    const assessment = companionActionAssessment(method);
    if(typeof RogiConversation!=='undefined'){
        RogiConversation.trace(companion,'chest-request',{method,known:RogiAI.knowledge(companion,chests[selected]||{}).shared,
            initiator:'player',executor:'rogi',riskBearer:'rogi',chestId:chests[selected]?.id},[{id:'assist'},{id:'refuse'}],assessment.scores||[],assessment.allowed?'assist':'refuse');
        if(!assessment.allowed&&!['absent','selection','last-chest'].includes(assessment.reason)){
            RogiConversation.start(companion,'refusal',{reason:assessment.reason});
        }
    }
    if (!assessment.allowed) {
        companion.line = ['absent','selection','last-chest','rest-agreement'].includes(assessment.reason) ? assessment.text
            : RogiAI.voice(companion,'refusal',{reason:assessment.reason,...assessment.context},assessment.text);
        lastEvent = companion.line; updateUI(); return;
    }
    const c = chests[selected];
    if (typeof RogiAI !== 'undefined' && !RogiAI.spendFocus(companion, method === 'break' ? 2 : 1, method)) {
        companion.line = 'Мне нужно немного собраться.'; lastEvent = companion.line; updateUI(); return;
    }
    if (!HeistLoop.beforeOpen(method === 'break' ? 'rough' : 'careful', 'rogi')) return;
    companion.requests++;
    const overburdened=companion.hp<=1||companion.ai.focus<=1;
    if (companion.requests >= 3 && overburdened) bumpTrust(COMPANION_BALANCE.repeatedRiskTrust);
    if (companion.requests === 3 && overburdened) RogiAI.event(companion, 'repeated-asks', { count: companion.requests });
    if (c.known === 'mimic') bumpTrust(COMPANION_BALANCE.knownDangerTrust);
    if (method === 'break') bumpTrust(c.known === 'scroll' ? -8 : -2);
    c.actor = 'rogi'; c.method = method;
    companion.reaction = method === 'break' ? 'breaking' : 'opening';
    if (typeof RogiAI !== 'undefined') RogiAI.event(companion, 'companion-risk', { key: c.known || 'unknown', method, dangerous:RogiAI.knowledge(companion,c).shared === 'mimic', actor: 'rogi',initiator:'player',executor:'rogi',riskBearer:'rogi',consented:true });
    if (c.known === 'mimic') {
        RogiAI.event(companion, 'known-danger', { method,actor:'rogi' });
    }
    companion.line = RogiAI.voice(companion,'agree',{method},method === 'break' ? 'Разобью замок, но находка может не пережить удар.' : 'Я попробую. Только помни: находка сначала моя.');
    openChest(selected);
    if (method === 'break') c.openSpeed = 2.8;
}
function hurtCompanion(damage) {
    if (!companionAvailable()) return;
    if(typeof RogiConversation!=='undefined')RogiConversation.trace(companion,'injury-reaction',{damage,initiator:'player',executor:'rogi',riskBearer:'rogi'},[{id:'react'}],[],'react');
    companion.hp = Math.max(0, companion.hp - damage);
    companion.reaction = 'danger';
    bumpTrust(-damage * 2);
    if (typeof RogiAI !== 'undefined') RogiAI.event(companion, 'injury', { damage, hp: companion.hp,deferDrama:true,initiator:'player',executor:'rogi',riskBearer:'rogi' });
    companion.line = RogiAI.voice(companion,'injury',{excludeCurrent:true},companion.hp ? 'Зубы оказались настоящими. Дальше осторожнее.' : 'Мне нужен отдых.');
    RogiAI.queueDrama(companion,'injury',{damage,hp:companion.hp,line:companion.line,meaningful:true,authoritative:true});
}
function companionLootValue() { return companion.inventory.reduce((sum, item) => sum + Math.floor(item.price / 2), 0); }
function companionOwnLoot(sc, price, method) {
    const item = { id: sc.id, price: Math.max(0, price), uid: companion.nextLootId++, asked: false,
        sentimental:['family-relic','lost-scroll','quiet-library'].includes(companion.ai.profile.bond.id) && price >= 90 };
    const finance = RogiAI.syncFinances(companion);
    companion.reaction = 'reward';
    RogiAI.event(companion, 'valuable-find', { key: sc.id, price,deferDrama:true });
    const pick = RogiAI.choose(companion, [
        { id: 'keep', base: 34, traitWeights: { pragmatism: 0.2 }, needWeight: { debt: 0.4, safety: 0.1 }, tags: ['loot'], reason: 'собственная задолженность и финансовая безопасность' },
        { id: 'give', base: 18, trustWeight: 2, traitWeights: { generosity: 0.25, cooperation: 0.15 }, tags: ['share', 'help'], reason: 'доверие, щедрость и состояние игрока' },
        { id: 'offer', base: 29, trustWeight: 0.2, traitWeights: { pragmatism: 0.2 }, tags: ['deal', 'fairness'], needWeight: { fairness: 0.1 }, reason: 'честный выкуп сохраняет её долю' },
        { id: 'split', base: 21, trustWeight: 0.35, traitWeights: { cooperation: 0.25, generosity: 0.1 }, tags: ['fairness', 'credit'], reason: 'общее решение и раздел вклада' },
        { id: 'defer', base: 25, traitWeights: { caution: 0.12, pragmatism: 0.1 }, needWeight: { safety: 0.18 }, tags: ['preserve', 'uncertainty'], reason: 'отложить решение до более безопасного места' }
    ], { trust: rogiTrust, rare: true, playerHp: hp, companionHp: companion.hp,financial:finance,
        decisionKind:'loot-ownership',initiator:'player',executor:'rogi',riskBearer:'rogi',lootOwner:'pending',uid:item.uid });
    const decision = pick?.id || 'keep';
    if (decision === 'give') {
        addScrollToInventory(sc, item.price);
        companion.lastLoot = { name: sc.name, owner: 'player', uid:item.uid,decision,text: 'Роги решила отдать находку.' };
        RogiAI.event(companion, 'fair-deal', { key: sc.id, decision, source: 'companion' });
    } else {
        companion.inventory.push(item);
        const offer = decision === 'offer' || decision === 'split';
        companion.lastLoot = { name: sc.name, owner: 'rogi', uid: item.uid,
            decision,
            offer, price: Math.max(1, Math.floor(price * COMPANION_BALANCE.offerPriceFactor)),
            text: decision === 'split' ? 'Роги предлагает обсудить раздел находки.' : offer ? 'Роги оставила свиток себе, но готова предложить выкуп.' : 'Роги оставила находку на собственный долг.' };
        if (decision === 'split') companion.lastLoot.splitOffer = true;
        RogiAI.event(companion, 'loot-decision', { key: sc.id, decision, price });
    }
    RogiAI.syncFinances(companion);
    const intent = ({give:'loot-give',offer:'loot-offer',split:'loot-split',defer:'loot-defer'})[decision] || 'loot-keep';
    companion.line = RogiAI.voice(companion,intent,{price:companion.lastLoot.price,uid:item.uid},companion.lastLoot.text);
    RogiAI.queueDrama(companion,'valuable-find',{decision,line:companion.line,meaningful:['give','offer','split'].includes(decision),authoritative:true});
    lastEvent = 'Роги нашла ' + sc.name + '. ' + companion.lastLoot.text;
}
function companionLootDiscussion(item) {
    item.discussion ||= {requested:!!item.asked,negotiated:false,pressureCount:0,closed:false};
    return item.discussion;
}
function giveCompanionLoot(item, options = {}) {
    const index = companion.inventory.indexOf(item);
    if (index < 0 || companion.lastLoot?.owner !== 'rogi') return false;
    if (item.teamHeistContractId) {
        if (options.coerced) {
            bumpTrust(-12);
            RogiAI.event(companion,'team-heist-contract-broken',{key:item.teamHeistContractId,action:'pressure-transfer',trustDelta:-12});
        } else RogiAI.event(companion,'team-heist-contract-amended',{key:item.teamHeistContractId,action:'voluntary-transfer'});
    }
    companion.inventory.splice(index,1);
    addScrollToInventory(SCROLL_TYPES.find(sc => sc.id === item.id),item.price);
    companion.lastLoot.owner = 'player'; companion.lastLoot.offer = false;
    companionLootDiscussion(item).closed = true;
    return true;
}
function requestCompanionLoot(tone = 'polite') {
    if (tone === 'pressure') return pressureCompanionLoot();
    const loot = companion.lastLoot;
    if (isLocked() || !companionAvailable() || !loot || loot.owner !== 'rogi') return;
    const item = companion.inventory.find(entry => entry.uid === loot.uid);
    if (!item) return;
    const discussion = companionLootDiscussion(item);
    if (discussion.requested || discussion.closed) return;
    discussion.requested = true; item.asked = true;
    const financial = RogiAI.syncFinances(companion);
    RogiAI.event(companion,'polite-request',{key:loot.uid,actor:'player',tone:'polite'});
    const pick = RogiAI.choose(companion, [
        { id: 'give', base: 20, trustWeight: 2, traitWeights: { generosity: 0.2, cooperation: 0.15 }, tags: ['share', 'help'], reason: 'готовность поделиться с учётом доверия и собственной нужды' },
        { id: 'keep', base: 31, traitWeights: { pragmatism: 0.2 }, needWeight: { debt: 0.45, safety: 0.1 }, tags: ['loot'], reason: 'срок долга и запас личных средств' }
    ], { trust: rogiTrust, rare: true, playerHp: hp, companionHp: companion.hp, tone:'polite',financial });
    if (pick?.id === 'give') {
        giveCompanionLoot(item);
        RogiAI.event(companion, 'player-fair-deal', { key: item.id, decision: 'request-share' });
        companion.line = RogiAI.voice(companion,'loot-give',{uid:item.uid},'Я хочу тебе помочь. Держи свиток.');
    } else {
        RogiAI.event(companion,'loot-request-declined',{key:item.id,decision:'refuse',tone,actor:'player'});
        companion.line = RogiAI.voice(companion,'loot-keep',{uid:item.uid},'Я пока оставлю этот свиток себе.');
    }
    discussion.outcome = pick?.id || 'keep'; RogiAI.syncFinances(companion);
    updateUI();
}
function pressureCompanionLoot() {
    const loot = companion.lastLoot;
    if (isLocked() || !companionAvailable() || loot?.owner !== 'rogi') return;
    const item = companion.inventory.find(entry => entry.uid === loot.uid);
    if (!item) return;
    const d = companionLootDiscussion(item);
    if (d.closed || d.pressureCount >= 2) return;
    const ai = RogiAI.ensure(companion), m = RogiAI.collectModifiers(ai.profile), repeated = d.pressureCount > 0;
    d.pressureCount++; d.requested = true; item.asked = true;
    const pressureCost = Math.max(2,Math.min(8,2+Math.round((m.situational.anger || 0)/8)+Math.round((m.actions.revenge || 0)/10)));
    bumpTrust(-pressureCost); ai.stress = Math.min(100,ai.stress+4+Math.max(0,Math.round((m.situational.anger||0)/4)));
    RogiAI.event(companion,'player-pressure',{key:loot.uid,actor:'player',repeated,deferDrama:true});
    RogiAI.event(companion,'player-unfair-loot',{key:loot.uid,actor:'player',decision:'pressure',deferDrama:true});
    let decision = 'end';
    if (!repeated) {
        const result = RogiAI.choose(companion,[
            {id:'give',base:20,trustWeight:2,traitWeights:{generosity:0.2,cooperation:0.15},tags:['share','help']},
            {id:'keep',base:31,traitWeights:{pragmatism:0.2},needWeight:{debt:0.45,safety:0.1},tags:['loot','choice']},
            {id:'counter',base:25,traitWeights:{pragmatism:0.25,cooperation:0.1},tags:['offer','fair-deal','bargain']},
            {id:'end',base:12,traitWeights:{independence:0.4,pride:0.4},needWeight:{fairness:0.3},tags:['choice','refuse','pressure']}
        ],{trust:rogiTrust,rare:true,tone:'pressure',financial:RogiAI.syncFinances(companion),playerHp:hp,companionHp:companion.hp});
        decision = result?.id || 'keep';
    }
    d.outcome = decision;
    if (decision === 'give') giveCompanionLoot(item,{coerced:true});
    if (decision === 'counter') { loot.offer = true; loot.price = Math.max(1,Math.floor(item.price*COMPANION_BALANCE.offerPriceFactor)); d.negotiated = true; }
    if (decision === 'end') { d.closed = true; loot.offer = false; }
    const intent = repeated ? 'pressure-repeat' : ({give:'pressure-give',counter:'pressure-counter',end:'pressure-end'})[decision] || 'pressure-keep';
    companion.line = RogiAI.voice(companion,intent,{price:loot.price,uid:item.uid},'Я уже ответила. Этот спор закончен.');
    RogiAI.syncFinances(companion);
    RogiAI.queueDrama(companion,'unfair-loot',{line:companion.line,authoritative:true,meaningful:!companionModal});
    updateUI();
}
function negotiateCompanionLoot() {
    const loot = companion.lastLoot;
    if (isLocked() || !companionAvailable() || loot?.owner !== 'rogi') return;
    const item = companion.inventory.find(entry => entry.uid === loot.uid);
    if (!item) return;
    const d = companionLootDiscussion(item);
    if (d.closed || d.negotiated) return;
    d.negotiated = true;
    const decision = loot.offer ? 'offer' : RogiAI.choose(companion,[
        {id:'offer',base:35,traitWeights:{pragmatism:0.25,cooperation:0.15},tags:['offer','fair-deal']},
        {id:'keep',base:25,traitWeights:{independence:0.15},tags:['keep','preserve']}
    ],{trust:rogiTrust,financial:RogiAI.syncFinances(companion),rare:true,tone:'polite'})?.id;
    if (decision === 'offer') { loot.offer = true; loot.price = Math.max(1,Math.floor(item.price*COMPANION_BALANCE.offerPriceFactor)); }
    companion.line = RogiAI.voice(companion,decision === 'offer' ? 'loot-offer' : 'negotiation-refuse',{price:loot.price,uid:item.uid},'Давай спокойно обсудим условия.');
    RogiAI.event(companion,'loot-negotiated',{key:item.uid,decision}); updateUI();
}
function buyCompanionLoot() {
    const loot = companion.lastLoot;
    if (isLocked() || !companionAvailable() || !loot || !loot.offer || loot.owner !== 'rogi' || gold < loot.price) return;
    const index = companion.inventory.findIndex(item => item.uid === loot.uid);
    if (index < 0) return;
    const item = companion.inventory.splice(index, 1)[0];
    gold -= loot.price; companion.gold += loot.price;
    addScrollToInventory(SCROLL_TYPES.find(sc => sc.id === item.id), item.price);
    loot.owner = 'player'; loot.offer = false;
    companion.line = RogiAI.voice(companion,'trade',{uid:item.uid},'Честная сделка. Свиток твой.');
    RogiAI.event(companion, 'player-fair-deal', { key: item.id, decision: 'buyout', amount: loot.price, actor: 'player' });
    RogiAI.syncFinances(companion);
    updateUI();
}
function resolveCompanionChest(c) {
    const breaking = c.method === 'break';
    const isBoss = currentNode && currentNode.type === 'BOSS';
    let type = c.type;
    if (type === 'dig') { stats.digs++; type = RogiAI.roll(companion, 'dig-outcome') < 0.55 ? 'scroll' : 'empty'; }
    if (typeof HeistLoop.teamHeist === 'function' && HeistLoop.teamHeist()?.target === chests.indexOf(c))
        c.teamHeistOutcome=type==='scroll'?'scroll-found':type==='mimic'?'mimic':'empty';
    companion.reaction = type === 'mimic' ? 'danger' : type === 'scroll' ? 'reward' : 'idle';
    const cx = c.x + (c.w || CHEST_W) / 2;
    if (breaking) { c.destroyed = true; shakeScreen(0.2, 6); burstEmpty(cx, c.y + 30); }
    if (type === 'mimic') {
        const neutralized = breaking && RogiAI.roll(companion, 'break-mimic') < COMPANION_BALANCE.breakNeutralizeChance;
        if (!neutralized) {
            const guardian = currentNode && ['ELITE', 'GUARD', 'BOSS'].includes(currentNode.type);
            hurtCompanion(breaking ? COMPANION_BALANCE.breakDamage : guardian ? 2 : 1);
            burstMimic(cx, c.y + 40); Sfx.play('bite');
        } else { companion.line = 'Успела разбить пасть до укуса.'; bumpTrust(2); }
        lastEvent = neutralized ? 'Роги обезвредила мимика ударом.' : 'Мимик укусил Роги. Её здоровье: ' + companion.hp + '/' + companion.maxHp + '.';
    } else if (type === 'scroll') {
        const ruined = breaking && RogiAI.roll(companion, 'break-scroll') < COMPANION_BALANCE.breakLootLossChance;
        if (ruined) { lastEvent = 'Свиток не пережил удар. Добыча уничтожена.'; companion.line = 'Я предупреждала: содержимое хрупкое.'; RogiAI.event(companion, 'scroll-destroyed', { method: c.method }); }
        else if (isBoss) { boss.hp = Math.max(0, boss.hp - 1); stats.hits++; lastEvent = 'Роги нашла реликвию и ударила предводителя.'; }
        else {
            const sc = takeScroll(currentNode && currentNode.type === 'ELITE');
            let price = relicPrice(sc, floor);
            if (breaking) price = Math.floor(price * COMPANION_BALANCE.breakLootValue);
            const assignedByTeamDeal = typeof HeistLoop.applyTeamHeistScroll === 'function'
                ? HeistLoop.applyTeamHeistScroll(sc,price) : false;
            if (!assignedByTeamDeal) companionOwnLoot(sc, price, c.method);
        }
        burstScroll(cx, c.y + 30); Sfx.play('scroll');
    } else { lastEvent = 'Роги проверила сундук: пусто.'; Sfx.play('empty'); }
    gameState = STATES.REACTION; updateUI();
    later(0.9, () => {
        companion.reaction = 'idle';
        if (isBoss) {
            if (boss.hp <= 0) { winBoss(); return; }
            const stage = STAGES[stageIndex];
            if (stage.bossRule === 'reanimate' && type === 'scroll') boss.mimicBonus = Math.min(stage.chests - 2, boss.mimicBonus + 1);
            if (stage.bossRule === 'falseAdvice') boosts.lieNext = true;
            spawnBossWave(false); gameState = STATES.CHOOSE; updateUI();
        } else continueRoom();
    });
}
function transferCompanionGold(amount, conditions = null) {
    if (!companion.active || isLocked() || !Number.isSafeInteger(amount) || amount <= 0 || amount > gold) return false;
    const offer = RogiAI.goldOfferDecision(companion,amount,{conditions,trust:rogiTrust});
    if (offer.id !== 'accept-help') {
        companion.line = RogiAI.voice(companion,offer.id === 'clarify-help' ? 'help-terms' : 'help-refuse',{},'На помощь с такими условиями я не согласна.');
        RogiAI.setDialogue(companion,companion.line); updateUI(); return false;
    }
    gold -= amount; companion.gold += amount; companion.helpReceived += amount;
    companion.giftGold += amount;
    const target = Math.min(COMPANION_BALANCE.giftTrustCapPerDungeon, Math.floor(companion.giftGold / COMPANION_BALANCE.giftTrustPerGold));
    bumpTrust(Math.max(0, target - companion.giftTrust)); companion.giftTrust = target;
    if (typeof RogiAI !== 'undefined') RogiAI.event(companion, 'debt-help', { amount });
    RogiAI.syncFinances(companion); RogiAI.reviewFinancialPromise(companion);
    companion.line = RogiAI.voice(companion,'thanks',{},'Спасибо за помощь.');
    RogiAI.closeDialogue(companion);
    companionModal = null; updateUI(); return true;
}
function sellCompanionLoot(atExit = false) {
    if (!companion.active) return;
    const remaining = [], sales = [];
    let cash = atExit ? Infinity : Math.max(0,shopStock?.cash || 0), projectedGold = companion.gold;
    for (const item of companion.inventory) {
        const price = atExit ? Math.floor(item.price / 2) : item.price;
        if (cash < price) { remaining.push(item); continue; }
        const sentimental = item.sentimental || (['family-relic','quiet-library','lost-scroll'].includes(companion.ai.profile.bond.id) && item.price >= 90);
        let sell = true;
        if (sentimental) {
            const need = Math.max(0,companion.debt-projectedGold);
            const decision = RogiAI.choose(companion,[
                {id:'sell',base:need > 0 ? 65 : 24,needWeight:{debt:0.3},tags:['offer','debt','deal']},
                {id:'retain',base:38,traitWeights:{independence:0.12},tags:['keep','preserve','relic']}
            ],{financial:{...RogiAI.finances(companion),cash:projectedGold,shortCash:need},rare:true,atExit,decisionKind:'sale',initiator:'rogi',executor:'rogi',riskBearer:null,uid:item.uid,lootOwner:'rogi'});
            sell = decision?.id === 'sell';
        }
        if (!sell) { remaining.push(item); continue; }
        sales.push({uid:item.uid,id:item.id,price,sentimental}); projectedGold += price; cash -= price;
    }
    // Commit the complete plan once. No UI callbacks occur between the money and inventory updates.
    companion.gold = projectedGold;
    if (!atExit && shopStock) shopStock.cash = cash;
    companion.inventory = remaining;
    if(sales.length&&!atExit&&typeof RogiWorld!=='undefined')RogiWorld.enqueue('sale',{sentimental:sales.some(s=>s.sentimental)},'sale-rogi:'+companion.dungeon+':'+currentNodeId);
    if (companion.lastLoot && !remaining.some(item => item.uid === companion.lastLoot.uid)) companion.lastLoot = null;
    if (sales.some(s => s.sentimental) || remaining.some(i => i.sentimental)) {
        const released = sales.some(s => s.sentimental);
        companion.line = RogiAI.voice(companion,released ? 'sale-release' : 'sale-retain',{},released ? 'Эта продажа поможет с долгом.' : 'Эту находку я пока сохраню.');
    }
    RogiAI.syncFinances(companion);
    return sales;
}
function prepareCompanionSettlement() {
    if (!companion.active || !attemptOver) return;
    if (companion.settlement?.dungeon === companion.dungeon) return;
    if (!companion.debtChecked) companion.debt = currentTribute();
    const before = RogiAI.finances(companion), legacyPrepared = companion.settled;
    const sales = legacyPrepared ? [] : sellCompanionLoot(true);
    companion.settlement = {dungeon:companion.dungeon,phase:'prepared',before,sales:sales || [],short:Math.max(0,companion.debt-companion.gold),paid:0};
    companion.settled = true;
    RogiAI.endDungeon(companion,{atExit:true,final:false});
}
function settleCompanionDebt(options = {}) {
    if (!companion.active) return;
    prepareCompanionSettlement();
    const settlement = companion.settlement;
    if (settlement?.phase === 'finalized') return;
    RogiAI.endDungeon(companion,{atExit:true,final:true,playerAvailable:options.playerAvailable});
    const short = Math.max(0, companion.debt - companion.gold);
    if (!short) {
        if (settlement) settlement.paid = companion.debt;
        companion.gold -= companion.debt; companion.debt = 0; companion.debtChecked = true;
        companion.line = RogiAI.voice(companion,'settled',{},'С этой выплатой разобралась. Я остаюсь.');
    } else if (!companion.debtChecked) {
        const line = RogiAI.voice(companion,'farewell',{},'Мне не хватает ' + short + ' зол. Придётся искать другой выход. Береги себя.');
        for(const [kind,promise] of Object.entries(companion.ai.promises || {})) if(promise.status==='active') {
            const noOpportunity=promise.lastReview?.outcome==='no-opportunity';
            promise.status=noOpportunity?'no-opportunity':'cancelled';
            promise.resolvedAt=companion.ai.eventNo;
            promise.lastReview={...(promise.lastReview||{}),outcome:promise.status,reason:'companion-departed',remainsActive:false};
        }
        companion.active = false; companion.farewell = 'Роги затягивает ремень плаща: «' + line + '» Дальше вы идёте в одиночку.';
        companion.line = companion.farewell; rogi = null; rogiPanelData = null;
        boosts.rogiInsurance = false; boosts.rogiDebt = false; boosts.rogiShare = 0;
    } else {
        if (settlement) settlement.paid = companion.gold;
        companion.debt -= companion.gold; companion.gold = 0;
        companion.line = 'Первый долг мы закрыли вместе. Остаток нового я ещё соберу.';
    }
    if (settlement) { settlement.phase = 'finalized'; settlement.outcome = !companion.active ? 'departed' : short ? 'part-paid' : 'paid'; }
    RogiAI.syncFinances(companion);
}

/* Save only stable states. An unfinished animation replays from its last safe checkpoint. */
function saveRunCheckpoint() {
    try {
        if ([STATES.GAME_OVER, STATES.VICTORY].includes(gameState)) {
            localStorage.removeItem(RUN_SAVE_KEY);
            lastStableRun = '';
            return;
        }
        if (!map || !map.length || [STATES.INTRO, STATES.QUARTERMASTER, STATES.OPENING, STATES.REACTION].includes(gameState)) return;
        const state = gameState === STATES.INVENTORY ? inventoryReturnState : gameState;
        const data = { version: 8, rngVersion:GameRng.CONTRACT_VERSION, rng:GameRng.snapshot(),
            campaignStoryFlags, state, companion, rogiTrust, week, gold, stageIndex, giftFlags,
            firstFriday: firstFridayProgress.snapshot(),
            giftsTaken, techniques, usedElixirs, clearedWeak: [...clearedWeak], boss, currentGift, floor, hp, maxHp,
            map, currentNodeId, visitedNodes: [...visitedNodes], attemptOver, chests, selected, rogiAsks,
            roomTouched, roomGoatHint, roomNoBite, roomNoChecks, roomInfo, scrollInventory, readScrollIds,
            foundRelics: [...foundRelics], forgeNext, currentEventId: currentEvent ? currentEvent.id : -1,
            eventDeckRemaining, lastDrawnEventId,
            shopStock, lastEvent, stats, boosts, rogi, rogiQuestFound, rogiSaid, rogiLine,
            letterText, mapLetterInbox, mapLetterSelected, mapLetterCollapsed, campaignDustStats, attemptDustStatsAccumulated,
            applied: appliedStack.map(item => ({ sc: item.sc, snapshot: item.snapshot, after: item.after })),
            heistLoop: HeistLoop.snapshot() };
        const json = JSON.stringify(data);
        if (json !== lastStableRun) {
            localStorage.setItem(RUN_SAVE_KEY, json);
            lastStableRun = json;
        }
    } catch (_) {
        /* A blocked or full storage must not interrupt the current run. */
    }
}
function restoreRunCheckpoint() {
    try {
        const d = JSON.parse(localStorage.getItem(RUN_SAVE_KEY) || 'null');
        if (!d || ![2, 3, 4, 5, 6, 7, 8].includes(d.version) || !Array.isArray(d.map) || !d.map.length || !d.companion || d.hp <= 0 ||
            !Object.values(STATES).includes(d.state) || !Number.isFinite(d.gold) || d.gold < 0) return false;
        if (d.rngVersion !== GameRng.CONTRACT_VERSION || !GameRng.restore(d.rng))
            GameRng.start(GameRng.legacySeed(d));
        campaignStoryFlags = { inspectorCallbackResolved:false, merchantSearchPending:false,
            ...(d.campaignStoryFlags && typeof d.campaignStoryFlags === 'object' ? d.campaignStoryFlags : {}) };
        companion = { ...freshCompanion(), ...d.companion };
        if (typeof RogiAI !== 'undefined') {
            const legacySeed = d.companion.ai?.seed || ('legacy-' + [d.week, d.companion.dungeon, d.companion.debt, d.companion.gold, d.state].join('-'));
            companion.ai = d.companion.ai ? d.companion.ai : RogiAI.create(legacySeed);
            delete companion.ai.conversation; delete companion.ai.conversationActionId;
            if(typeof RogiConversation!=='undefined')RogiConversation.migrateLegacyRoles(companion);
            RogiAI.ensure(companion);
        }
        companion.hp = clamp(Number(companion.hp) || 0, 0, companion.maxHp);
        companion.gold = Math.max(0, Number(companion.gold) || 0);
        rogiTrust = clamp(d.rogiTrust || 0, -100, 100);
        if (d.firstFriday) firstFridayProgress = FirstFridayStory.createProgress(d.firstFriday);
        week = d.week; gold = d.gold; stageIndex = d.stageIndex; giftFlags = d.giftFlags;
        giftsTaken = d.giftsTaken; techniques = d.techniques; usedElixirs = d.usedElixirs;
        clearedWeak = new Set(d.clearedWeak); boss = d.boss;
        currentGift = d.currentGift ? BOSS_GIFTS.find(item => item.id === d.currentGift.id) : null;
        floor = d.floor; hp = d.hp; maxHp = d.maxHp; map = d.map; currentNodeId = d.currentNodeId;
        currentNode = currentNodeId ? nodeById(map, currentNodeId) : null; visitedNodes = new Set(d.visitedNodes);
        attemptOver = d.attemptOver; chests = d.chests; selected = d.selected; openingIdx = -1;
        rogiAsks = d.rogiAsks; roomTouched = d.roomTouched; roomGoatHint = d.roomGoatHint;
        roomNoBite = d.roomNoBite; roomNoChecks = d.roomNoChecks; roomInfo = d.roomInfo;
        scrollInventory = d.scrollInventory; readScrollIds = d.readScrollIds; foundRelics = new Set(d.foundRelics);
        forgeNext = d.forgeNext;
        currentEvent = Number.isInteger(d.currentEventId)
            ? EVENTS[d.currentEventId] || null
            : typeof eventForId === 'function' ? eventForId(d.currentEventId, storyEventContext()) : null;
        shopStock = d.shopStock;
        restoreEventDeck(d.eventDeckRemaining, d.lastDrawnEventId);
        if (shopStock) {
            shopStock.technique = TECHNIQUES.find(item => item.id === shopStock.technique?.id) || shopStock.technique;
            shopStock.elixir = ELIXIRS.find(item => item.id === shopStock.elixir?.id) || shopStock.elixir;
            shopStock.relic = SCROLL_TYPES.find(item => item.id === shopStock.relic?.id) || shopStock.relic;
        }
        lastEvent = d.lastEvent; stats = d.stats; boosts = d.boosts; rogi = companion.active ? d.rogi : null;
        rogiQuestFound = d.rogiQuestFound; rogiSaid = d.rogiSaid; rogiLine = d.rogiLine;
        letterText = d.letterText; mapLetterInbox = d.mapLetterInbox; mapLetterSelected = d.mapLetterSelected;
        mapLetterCollapsed = d.mapLetterCollapsed; campaignDustStats = d.campaignDustStats;
        attemptDustStatsAccumulated = d.attemptDustStatsAccumulated;
        appliedStack = (d.applied || []).filter(item => item.snapshot && item.after).map(item => ({ ...item, undo: makeScrollUndo(item.snapshot, item.after) }));
        HeistLoop.restore(d.heistLoop);
        clearTimeline(); gameState = d.state; return true;
    } catch (_) { return false; }
}
