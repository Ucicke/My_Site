/* In-process, DOM-free command API for the room/heist rules. */
(function (root, factory) {
    const shared = root.ScrollHunterHeistRules ||
        (typeof module === 'object' && module.exports ? require('./heist-rules.js') : null);
    const api = factory(shared);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.ScrollHunterHeadless = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function (shared) {
    'use strict';
    if (!shared) throw new Error('Load heist-rules.js before headless-session.js');

    const { config, rules, teamHeistPlans, teamHeistTerms, teamHeistTermsForPlan, teamHeistAvailable,
        teamHeistCounterTerm, teamHeistDetectionChance } = shared;
    const SAVE_KEY = 'scroll-hunter-headless-session';
    const CHEST_TYPES = new Set(['scroll','empty','mimic']);
    const ROOM_TYPES = new Set(['FIGHT','CAMP']);
    const ROGI_MAX_FOCUS = 5;

    function copy(value) { return JSON.parse(JSON.stringify(value)); }
    function int(value, fallback, min, max) {
        const number = Number(value);
        return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
    }
    function seedHash(seed) {
        let hash = 2166136261;
        for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
        return hash >>> 0 || 0x6d2b79f5;
    }
    function createMemoryStorage(initial = {}) {
        const values = new Map(Object.entries(initial).map(([key,value]) => [key,String(value)]));
        return Object.freeze({
            getItem:key => values.has(key) ? values.get(key) : null,
            setItem:(key,value) => values.set(key,String(value)),
            removeItem:key => values.delete(key)
        });
    }

    function initialState(options) {
        const maxHp = int(options.maxHp, 4, 1, 99);
        const seed = String(options.seed ?? 'scroll-hunter');
        const mode = options.mode === 'B1' ? 'B1' : 'A';
        const heist = rules.createState();
        heist.mode = mode;
        heist.playerFocus = int(options.focus, config.startingFocus, 0, config.maxFocus);
        return { version:1, seed, rngState:seedHash(seed), status:'ready', mode,
            gold:int(options.gold, 0, 0, 1000000), hp:int(options.hp, maxHp, 0, maxHp), maxHp,
            revives:int(options.revives, 0, 0, 99), trust:int(options.trust, 0, -100, 100),
            companionGold:int(options.companionGold, 0, 0, 1000000), companionFocus:int(options.companionFocus, ROGI_MAX_FOCUS, 0, ROGI_MAX_FOCUS),
            companionActive:options.companionActive !== false, companionHp:int(options.companionHp, 3, 0, 3),
            rogiMemory:[], companionInventory:[],
            inventory:[], room:null, heist };
    }

    function hydrate(raw) {
        if (!raw || raw.version !== 1 || !['ready','map','room','crisis','negotiation','targeting','opening','game-over'].includes(raw.status)) return null;
        const state = initialState({ seed:raw.seed, mode:raw.mode, gold:raw.gold, hp:raw.hp,
            maxHp:raw.maxHp, revives:raw.revives, trust:raw.trust, companionGold:raw.companionGold,
            companionFocus:raw.companionFocus, companionActive:raw.companionActive, companionHp:raw.companionHp });
        state.status = raw.status;
        state.rngState = int(raw.rngState, seedHash(state.seed), 0, 0xffffffff) >>> 0;
        state.inventory = Array.isArray(raw.inventory)
            ? raw.inventory.filter(item => item && typeof item.id === 'string').map(item => ({ id:item.id,
                value:int(item.value,0,0,1000000), rogiShareDue:int(item.rogiShareDue,0,0,1000000),
                rogiSharePercent:int(item.rogiSharePercent,0,0,100),
                agreementId:typeof item.agreementId === 'string' ? item.agreementId : null,
                owner:item.owner === 'rogi' ? 'rogi' : 'player' })) : [];
        state.companionInventory = Array.isArray(raw.companionInventory) ? raw.companionInventory.filter(item => item && typeof item.id === 'string').map(item => copy(item)) : [];
        state.rogiMemory = Array.isArray(raw.rogiMemory) ? raw.rogiMemory.filter(item => item && typeof item.type === 'string').map(item => copy(item)) : [];
        state.room = raw.room && typeof raw.room.id === 'string' && ROOM_TYPES.has(raw.room.type)
            ? { id:raw.room.id, type:raw.room.type,
                chests:Array.isArray(raw.room.chests) ? raw.room.chests.map((chest,index) => ({
                    id:String(chest.id ?? index), type:CHEST_TYPES.has(chest.type) ? chest.type : 'empty',
                    value:int(chest.value,20,0,1000000), opened:chest.opened === true
                })) : [] } : null;
        state.heist = rules.restore(raw.heist);
        state.heist.mode = state.mode;
        if (['room','crisis','negotiation','targeting','opening'].includes(state.status) &&
            (!state.room || state.heist.roomId !== state.room.id)) return null;
        if (['crisis','negotiation'].includes(state.status) && !state.heist.crisis) return null;
        if (state.status === 'negotiation' && state.heist.crisis?.scene !== 'guarded-treasury') return null;
        if (state.status === 'targeting' && (!state.heist.crisis || !['targets','team-targets'].includes(state.heist.crisis.view))) return null;
        if (state.status === 'opening' && !state.heist.crisis?.lastScore?.committed && !state.heist.crisis?.teamHeist?.committed) return null;
        return state;
    }

    function createSession(options = {}) {
        const storage = options.storage || createMemoryStorage();
        const storageKey = options.storageKey || SAVE_KEY;
        for (const method of ['getItem','setItem','removeItem']) {
            if (typeof storage[method] !== 'function') throw new TypeError('storage.' + method + ' must be a function');
        }
        let state = null;
        const saved = storage.getItem(storageKey);
        if (saved) {
            try { state = hydrate(JSON.parse(saved)); } catch (_) { state = null; }
        }
        if (!state) state = initialState(options);

        function view() {
            const result = copy(state);
            if (result.room) result.room.chests = result.room.chests.map(chest => ({
                id:chest.id, opened:chest.opened, type:chest.opened ? chest.type : null,
                value:chest.opened && chest.type === 'scroll' ? chest.value : null
            }));
            return result;
        }
        function persist(next) {
            if (next.status === 'game-over') storage.removeItem(storageKey);
            else storage.setItem(storageKey, JSON.stringify(next));
        }
        function fail(error) { return { ok:false, error, state:view(), events:[] }; }
        function remember(next, type, detail, events) {
            const item = { eventNo:next.rogiMemory.length + 1, type, ...(detail || {}) };
            next.rogiMemory.push(item);
            events.push({ type:'rogi-memory', memory:item });
            return item;
        }
        function nextRandom(next) {
            let value = next.rngState || 0x6d2b79f5;
            value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
            next.rngState = value >>> 0;
            return next.rngState / 0x100000000;
        }
        function finishTeamHeist(next, outcome, events, detail = {}) {
            const deal = next.heist.crisis?.teamHeist;
            if (!deal || deal.settled) return false;
            deal.settled = true;
            deal.outcome = outcome;
            if (outcome === 'detected') remember(next,'team-heist-aborted',
                { agreementId:deal.id,cause:'collector-detected',...detail },events);
            else if (outcome === 'empty') remember(next,'team-heist-no-loot',
                { agreementId:deal.id,plan:deal.planId,terms:deal.termId },events);
            else remember(next,'team-heist-kept',
                { agreementId:deal.id,outcome,plan:deal.planId,terms:deal.termId,...detail },events);
            if (deal.scope === 'guarded-treasury') {
                rules.finishGuardedTreasury(next.heist,outcome === 'detected' ? 'detected' : 'success');
                if (outcome !== 'detected') {
                    deal.resultSummary = outcome === 'mimic' ? 'План выполнен, но мимик укусил открывавшего; добычи нет.'
                        : outcome === 'empty' ? 'План выполнен, оба целы, но сундук пуст.'
                            : 'План выполнен; договорная добыча назначена владельцу.';
                    next.status = 'room';
                }
            }
            return true;
        }
        function leaveRoom(next, events) {
            rules.clearCrisis(next.heist);
            rules.leaveRoom(next.heist);
            next.room = null;
            next.status = 'map';
            events.push({ type:'room-exited' });
        }
        function damage(next, amount, events) {
            next.hp = Math.max(0, next.hp - amount);
            events.push({ type:'player-damaged', amount, hp:next.hp });
            if (next.hp > 0) return true;
            if (next.revives > 0) {
                next.revives--;
                next.hp = 1;
                events.push({ type:'player-revived', hp:1, revives:next.revives });
                return true;
            }
            next.status = 'game-over';
            next.room = null;
            rules.clearCrisis(next.heist);
            rules.leaveRoom(next.heist);
            events.push({ type:'run-ended', reason:'death' });
            return false;
        }
        function openChest(next, index, events, lastScore = false, teamHeist = null) {
            const chest = next.room?.chests[index];
            if (!chest || chest.opened) return false;
            chest.opened = true;
            events.push({ type:'chest-opened', index, result:chest.type });
            if (chest.type === 'scroll') {
                if (teamHeist) {
                    const plan = teamHeistPlans[teamHeist.planId], terms = teamHeistTerms[teamHeist.termId];
                    const owner = terms.owner === 'opener' ? plan.opener : terms.owner;
                    const sharePercent = owner === 'player' ? terms.sharePercent : 0;
                    const agreementId = teamHeist.id;
                    const item = { id:'scroll-' + index + '-' + next.heist.actions, value:chest.value,
                        owner, agreementId, rogiSharePercent:sharePercent,
                        rogiShareDue:Math.floor(chest.value * sharePercent / 100) };
                    if (owner === 'rogi') next.companionInventory.push(item);
                    else next.inventory.push(item);
                    events.push({ type:'scroll-found', index, value:chest.value, owner, sharePercent, agreementId });
                    finishTeamHeist(next,'scroll-found',events,{owner});
                    if (teamHeist.scope !== 'guarded-treasury') leaveRoom(next,events);
                    return true;
                }
                const sharePercent = lastScore && next.heist.crisis?.lastScore?.source === 'rogi'
                    ? (next.heist.crisis.lastScore.share || 50) : 0;
                const shareDue = Math.floor(chest.value * sharePercent / 100);
                next.inventory.push({ id:'scroll-' + index + '-' + next.heist.actions, value:chest.value,
                    rogiShareDue:shareDue, rogiSharePercent:sharePercent });
                events.push({ type:'scroll-found', index, value:chest.value });
            } else if (chest.type === 'mimic' && teamHeist) {
                const opener = teamHeistPlans[teamHeist.planId].opener;
                events.push({ type:'mimic-bit-opener',opener,damage:1 });
                if (opener === 'rogi') {
                    next.companionHp = Math.max(0,next.companionHp - 1);
                    next.trust = Math.max(-100,next.trust - 2);
                    events.push({ type:'companion-damaged',amount:1,hp:next.companionHp,cause:'mimic-bite' });
                    remember(next,'injury',{damage:1,hp:next.companionHp,source:'mimic',agreementId:teamHeist.id},events);
                    finishTeamHeist(next,'mimic',events,{opener});
                    if (teamHeist.scope !== 'guarded-treasury') leaveRoom(next,events);
                    return true;
                } else {
                    finishTeamHeist(next,'mimic',events,{opener});
                    damage(next,1,events);
                    if (teamHeist.scope !== 'guarded-treasury' && next.status !== 'game-over') leaveRoom(next,events);
                }
                return true;
            } else if (chest.type === 'mimic' && !damage(next,1,events)) return true;

            if (teamHeist) {
                finishTeamHeist(next,'empty',events);
                if (teamHeist.scope !== 'guarded-treasury') leaveRoom(next,events);
                return true;
            }

            if (lastScore) {
                rules.settleLastScore(next.heist);
                if (next.status !== 'game-over') leaveRoom(next,events);
                return true;
            }
            if (rules.beginCrisis(next.heist)) {
                next.status = 'crisis';
                events.push({ type:'crisis-started', mode:next.heist.crisis.mode, noise:next.heist.noise });
            }
            return true;
        }

        function dispatch(command) {
            if (!command || typeof command !== 'object' || typeof command.type !== 'string') return fail('invalid-command');
            const next = copy(state), events = [];
            let error = null;
            switch (command.type) {
                case 'start-run':
                    if (next.status !== 'ready') error = 'run-already-started';
                    else { next.status = 'map'; events.push({ type:'run-started', mode:next.mode, seed:next.seed }); }
                    break;
                case 'enter-room': {
                    if (next.status !== 'map') { error = 'not-on-map'; break; }
                    const roomId = String(command.roomId ?? '');
                    if (!roomId || !ROOM_TYPES.has(command.roomType)) { error = 'invalid-room'; break; }
                    if (command.roomType === 'FIGHT' && (!Array.isArray(command.chestTypes) || !command.chestTypes.length ||
                        command.chestTypes.some(type => !CHEST_TYPES.has(type)))) { error = 'invalid-chests'; break; }
                    const chests = command.roomType === 'FIGHT' ? command.chestTypes.map((type,index) => ({
                        id:String(index), type, value:int(command.scrollValues?.[index],20,0,1000000), opened:false
                    })) : [];
                    next.room = { id:roomId, type:command.roomType, chests };
                    rules.enterRoom(next.heist,roomId,command.roomType);
                    next.status = 'room';
                    events.push({ type:'room-entered', roomId, roomType:command.roomType, chestCount:chests.length });
                    break;
                }
                case 'begin-guarded-treasury': {
                    if (next.status !== 'room' || !next.companionActive || next.companionHp<=0 ||
                        next.heist.playerFocus<config.teamHeistFocusCost || next.companionFocus<config.teamHeistFocusCost ||
                        !rules.beginGuardedTreasury(next.heist)) { error = 'guarded-treasury-unavailable'; break; }
                    next.status = 'negotiation';
                    events.push({ type:'guarded-treasury-discovered',roomId:next.room.id,noise:next.heist.noise,
                        focusCost:{player:config.teamHeistFocusCost,companion:config.teamHeistFocusCost} });
                    break;
                }
                case 'continue-guarded-treasury': {
                    if (next.status !== 'negotiation' || next.heist.crisis?.scene!=='guarded-treasury' ||
                        next.heist.crisis.view!=='treasury-briefing') { error = 'no-guarded-treasury-briefing'; break; }
                    next.heist.crisis.view='team-plan';
                    events.push({ type:'guarded-treasury-planning' });
                    break;
                }
                case 'decline-guarded-treasury': {
                    if (next.status !== 'negotiation' || next.heist.crisis?.scene !== 'guarded-treasury') { error = 'no-guarded-treasury-negotiation'; break; }
                    rules.finishGuardedTreasury(next.heist,'declined'); next.status = 'room';
                    events.push({ type:'guarded-treasury-declined',resourceCost:{playerFocus:0,companionFocus:0} });
                    break;
                }
                case 'open-chest': {
                    if (next.status !== 'room' || next.room?.type !== 'FIGHT') { error = 'not-in-fight'; break; }
                    const index = command.index;
                    if (!Number.isInteger(index) || !next.room.chests[index] || next.room.chests[index].opened) { error = 'invalid-chest'; break; }
                    const action = rules.recordAction(next.heist,command.method || 'careful','player');
                    if (!action.ok) { error = action.reason || 'action-blocked'; break; }
                    events.push({ type:'chest-action', method:command.method || 'careful', focus:next.heist.playerFocus, noise:next.heist.noise });
                    openChest(next,index,events);
                    break;
                }
                case 'resolve-crisis': {
                    if (next.status !== 'crisis' || !next.heist.crisis) { error = 'no-crisis'; break; }
                    if (command.action === 'last-score') {
                        const unopened = next.room.chests.filter(chest => !chest.opened).length;
                        if (!rules.canStartLastScore(next.heist,unopened,next.gold)) { error = 'last-score-unavailable'; break; }
                        next.heist.crisis.view = 'targets'; next.status = 'targeting';
                        events.push({ type:'last-score-targeting' });
                    } else if (command.action === 'hide') {
                        if (next.heist.playerFocus < config.hideCost) { error = 'insufficient-focus'; break; }
                        next.heist.playerFocus -= config.hideCost;
                        events.push({ type:'crisis-escaped', action:'hide', focus:next.heist.playerFocus });
                        leaveRoom(next,events);
                    } else if (command.action === 'bribe') {
                        if (next.gold < config.bribeGold) { error = 'insufficient-gold'; break; }
                        next.gold -= config.bribeGold;
                        events.push({ type:'crisis-escaped', action:'bribe', gold:next.gold });
                        leaveRoom(next,events);
                    } else if (command.action === 'haggle' && next.mode === 'B1') {
                        const offer = int(command.offer,0,0,1000000);
                        if (offer > next.gold) { error = 'insufficient-gold'; break; }
                        const demand = 20;
                        if (offer >= demand) {
                            next.gold -= offer;
                            events.push({ type:'collector-deal', accepted:true, offer, demand, gold:next.gold,
                                message:'Сборщик пересчитывает золото и нехотя освобождает проход.' });
                        } else {
                            events.push({ type:'collector-deal', accepted:false, offer, demand,
                                message:'Сборщик отодвигает монеты: «Маловато. Договор не состоялся».' });
                            break;
                        }
                        leaveRoom(next,events);
                    } else if (command.action === 'ask-rogi-deal' && next.mode === 'B1') {
                        if (next.companionFocus < 1) { error = 'rogi-insufficient-focus'; break; }
                        next.heist.crisis.view = 'rogi-terms';
                        events.push({ type:'rogi-terms-offered', share:50, message:'Роги предлагает половину выручки со свитка, если его удастся продать.' });
                    } else if (command.action === 'team-heist' && next.mode === 'B1') {
                        const unopened = next.room.chests.filter(chest => !chest.opened).length;
                        if (!next.companionActive || next.companionHp <= 0 || unopened < 1 || next.heist.crisis.teamHeistTried) {
                            error = 'team-heist-unavailable'; break;
                        }
                        next.heist.crisis.view = 'team-plan';
                        next.heist.crisis.teamHeistDraft = null;
                        events.push({ type:'team-heist-plans-offered', plans:Object.keys(teamHeistPlans) });
                    } else if (command.action === 'flee') {
                        if (!next.room.chests.some(chest => chest.opened)) { error = 'must-open-chest-before-flee'; break; }
                        damage(next,1,events);
                        if (next.status !== 'game-over') leaveRoom(next,events);
                    } else if (command.action === 'give-scroll') {
                        if (!next.inventory.length) { error = 'no-scroll-to-give'; break; }
                        next.inventory.sort((a,b) => a.value - b.value);
                        const [lost] = next.inventory.splice(0,1);
                        events.push({ type:'scroll-surrendered', value:lost.value });
                        leaveRoom(next,events);
                    } else error = 'unsupported-crisis-action';
                    break;
                }
                case 'select-last-score-target': {
                    if (next.status !== 'targeting' || !next.room || !Number.isInteger(command.index)) { error = 'not-selecting-target'; break; }
                    const chest = next.room.chests[command.index];
                    if (!chest || chest.opened) { error = 'invalid-chest'; break; }
                    const source = next.heist.crisis.rogiDealAccepted ? 'rogi' : 'player';
                    if (source === 'player' && (next.gold < 15 || next.heist.playerFocus < 1)) { error = 'last-score-unavailable'; break; }
                    if (source === 'rogi' && next.companionFocus < 1) { error = 'rogi-insufficient-focus'; break; }
                    if (!rules.commitLastScore(next.heist,command.index,source)) { error = 'last-score-unavailable'; break; }
                    if (source === 'rogi') {
                        next.heist.crisis.lastScore.share = next.heist.crisis.rogiShare || 50;
                        next.companionFocus--;
                        next.heist.crisis.rogiDealAccepted = false;
                    } else next.gold -= 15;
                    next.status = 'opening';
                    events.push({ type:'last-score-committed', target:command.index, gold:next.gold, focus:next.heist.playerFocus });
                    break;
                }
                case 'choose-team-heist-plan': {
                    const crisis = next.heist.crisis;
                    if (!['crisis','negotiation'].includes(next.status) || crisis?.view !== 'team-plan' || !teamHeistPlans[command.planId]) {
                        error = 'no-team-heist-plan'; break;
                    }
                    const unopened = next.room?.chests.filter(chest => !chest.opened).length || 0;
                    if (!teamHeistAvailable(next.heist,{ planId:command.planId,unopened,companionActive:next.companionActive,
                        companionHp:next.companionHp,companionFocus:next.companionFocus })) {
                        error = 'team-heist-resources-unavailable'; break;
                    }
                    crisis.teamHeistDraft = { planId:command.planId };
                    crisis.view = 'team-terms';
                    events.push({ type:'team-heist-plan-selected', plan:teamHeistPlans[command.planId],
                        resourceCost:{ playerFocus:config.teamHeistFocusCost,companionFocus:config.teamHeistFocusCost } });
                    break;
                }
                case 'offer-team-heist-terms': {
                    const crisis = next.heist.crisis, planId = crisis?.teamHeistDraft?.planId;
                    const terms = teamHeistTerms[command.termId];
                    if (!['crisis','negotiation'].includes(next.status) || crisis?.view !== 'team-terms' || !planId ||
                        !teamHeistTermsForPlan(planId).some(item=>item.id===command.termId)) {
                        error = 'no-team-heist-terms'; break;
                    }
                    const decision = ['accept','counter','refuse'].includes(command.rogiDecision) ? command.rogiDecision : 'accept';
                    if (decision === 'refuse') {
                        crisis.teamHeistTried = true; crisis.teamHeistDraft = null; crisis.view = 'main';
                        if (crisis.scene === 'guarded-treasury') { rules.finishGuardedTreasury(next.heist,'refused'); next.status = 'room'; }
                        remember(next,'team-heist-refused',{plan:planId,terms:terms.id},events);
                        events.push({ type:'team-heist-refused',fallback:'existing-crisis-options' });
                    } else if (decision === 'counter') {
                        const counter = teamHeistTerms[command.counterTermId] || teamHeistCounterTerm(planId,terms.id);
                        if (!counter || counter.id === terms.id || !teamHeistTermsForPlan(planId).some(item=>item.id===counter.id)) {
                            error = 'invalid-team-heist-counter'; break;
                        }
                        crisis.teamHeistDraft = { planId,offeredTermId:terms.id,counterTermId:counter.id };
                        crisis.view = 'team-counter';
                        events.push({ type:'team-heist-countered',offered:terms.id,counter:counter.id });
                    } else {
                        const agreementId = 'team-heist-' + next.room.id + '-' + next.heist.actions;
                        crisis.teamHeist = { id:agreementId,planId,termId:terms.id,scope:crisis.scene==='guarded-treasury'?'guarded-treasury':'crisis',committed:false,settled:false };
                        crisis.teamHeistDraft = null; crisis.view = 'team-targets';
                        if (next.status !== 'negotiation') next.status = 'targeting';
                        remember(next,'team-heist-agreement-made',{agreementId,plan:planId,terms:terms.id},events);
                        events.push({ type:'team-heist-terms-accepted',agreementId,planId,terms });
                    }
                    break;
                }
                case 'resolve-team-heist-counter': {
                    const crisis = next.heist.crisis, draft = crisis?.teamHeistDraft;
                    if (!['crisis','negotiation'].includes(next.status) || crisis?.view !== 'team-counter' || !draft) { error = 'no-team-heist-counter'; break; }
                    if (command.choice === 'decline') {
                        crisis.teamHeistTried = true; crisis.teamHeistDraft = null; crisis.view = 'main';
                        if (crisis.scene === 'guarded-treasury') { rules.finishGuardedTreasury(next.heist,'declined'); next.status = 'room'; }
                        remember(next,'team-heist-counter-declined',{plan:draft.planId},events);
                        events.push({ type:'team-heist-negotiation-ended',accepted:false });
                    } else if (command.choice === 'accept') {
                        const terms = teamHeistTerms[draft.counterTermId];
                        if (!terms || !teamHeistTermsForPlan(draft.planId).some(item=>item.id===terms.id)) {
                            error = 'invalid-team-heist-counter'; break;
                        }
                        const agreementId = 'team-heist-' + next.room.id + '-' + next.heist.actions;
                        crisis.teamHeist = { id:agreementId,planId:draft.planId,termId:terms.id,scope:crisis.scene==='guarded-treasury'?'guarded-treasury':'crisis',committed:false,settled:false };
                        crisis.teamHeistDraft = null; crisis.view = 'team-targets';
                        if (next.status !== 'negotiation') next.status = 'targeting';
                        remember(next,'team-heist-agreement-made',{agreementId,plan:draft.planId,terms:terms.id,counterAccepted:true},events);
                        events.push({ type:'team-heist-counter-accepted',agreementId,terms });
                    } else error = 'invalid-team-heist-counter-choice';
                    break;
                }
                case 'select-team-heist-target': {
                    const crisis = next.heist.crisis, deal = crisis?.teamHeist;
                    if (!['targeting','negotiation'].includes(next.status) || crisis?.view !== 'team-targets' || !deal || deal.committed) {
                        error = 'no-team-heist-target'; break;
                    }
                    const plan = teamHeistPlans[deal.planId], chest = next.room?.chests[command.index];
                    if (!plan || !chest || chest.opened) { error = 'invalid-team-heist-target'; break; }
                    const unopened = next.room.chests.filter(item => !item.opened).length;
                    if (!teamHeistAvailable(next.heist,{planId:deal.planId,unopened,companionActive:next.companionActive,
                        companionHp:next.companionHp,companionFocus:next.companionFocus})) { error = 'team-heist-resources-unavailable'; break; }
                    const distractorHp = plan.distractor === 'player' ? next.hp : next.companionHp;
                    const distractorFocus = plan.distractor === 'player' ? next.heist.playerFocus : next.companionFocus;
                    const chance = teamHeistDetectionChance({ distractorHp,distractorFocus });
                    const roll = typeof command.detectionRoll === 'number'
                        ? Math.max(0,Math.min(0.999999,command.detectionRoll)) : nextRandom(next);
                    if (!rules.commitTeamHeist(next.heist,{id:deal.id,planId:deal.planId,termId:deal.termId,target:command.index,
                        detectionChance:chance,detectionRoll:roll,scope:deal.scope})) { error = 'team-heist-commit-failed'; break; }
                    next.companionFocus -= config.teamHeistFocusCost;
                    next.status = 'opening';
                    events.push({ type:'team-heist-committed',target:command.index,scope:deal.scope||'crisis',planId:plan.id,
                        opener:plan.opener,distractor:plan.distractor,playerFocus:next.heist.playerFocus,
                        companionFocus:next.companionFocus,detectionChance:chance,detectionRoll:roll,detected:deal.detected });
                    break;
                }
                case 'resolve-rogi-deal': {
                    if (next.status !== 'crisis' || next.heist.crisis?.view !== 'rogi-terms') { error = 'no-rogi-terms'; break; }
                    if (!['accept','decline','counter'].includes(command.choice)) { error = 'invalid-rogi-choice'; break; }
                    if (command.choice === 'decline') {
                        next.heist.crisis.view = 'main';
                        events.push({ type:'rogi-deal-declined' });
                    } else {
                        const share = command.choice === 'counter' ? int(command.share,25,1,49) : 50;
                        next.heist.crisis.rogiDealAccepted = true;
                        next.heist.crisis.rogiShare = share;
                        next.heist.crisis.view = 'targets';
                        next.status = 'targeting';
                        next.companionFocus--;
                        events.push({ type:'rogi-deal-accepted', share, choice:command.choice });
                    }
                    break;
                }
                case 'read-scroll': {
                    const item = next.inventory[command.index];
                    if (!item || !Number.isInteger(command.index)) { error = 'invalid-scroll'; break; }
                    next.inventory.splice(command.index,1);
                    events.push({ type:'scroll-consumed', id:item.id, value:item.value,
                        waivedShare:item.rogiShareDue, effectSimulation:'not-implemented' });
                    if (item.agreementId) remember(next,'team-heist-no-sale',
                        { agreementId:item.agreementId,reason:'read',waivedShare:item.rogiShareDue,contractBreach:false },events);
                    break;
                }
                case 'sell-scroll': {
                    const item = next.inventory[command.index];
                    const price = int(command.price,0,0,1000000);
                    const buyerGold = int(command.buyerGold,0,0,1000000);
                    if (!item || !Number.isInteger(command.index)) { error = 'invalid-scroll'; break; }
                    if (price > buyerGold) { error = 'buyer-insufficient-gold'; break; }
                    const split = rules.splitSaleProceeds(price,item.rogiSharePercent);
                    const paidShare = Math.min(item.rogiShareDue,split.companion);
                    const playerTake = split.gross-paidShare;
                    next.gold += playerTake;
                    next.companionGold += paidShare;
                    next.inventory.splice(command.index,1);
                    events.push({ type:'scroll-sold', proceeds:price, playerGold:playerTake, rogiGold:paidShare,
                        buyerGoldRemaining:buyerGold-price });
                    if (item.agreementId) remember(next,'team-heist-sale-settled',
                        { agreementId:item.agreementId,proceeds:price,rogiGold:paidShare,playerGold:playerTake },events);
                    break;
                }
                case 'exit-sell-scrolls': {
                    const split = next.inventory.reduce((total,item) => {
                        const sale = rules.splitSaleProceeds(Math.floor(item.value/2),item.rogiSharePercent);
                        const share = Math.min(item.rogiShareDue,sale.companion);
                        return { gross:total.gross+sale.gross, player:total.player+sale.gross-share, companion:total.companion+share };
                    },{gross:0,player:0,companion:0});
                    const proceeds = split.gross, share = split.companion;
                    next.gold += split.player;
                    next.companionGold += share;
                    events.push({ type:'exit-scroll-sale', proceeds, playerGold:split.player, rogiGold:share });
                    for (const item of state.inventory) if (item.agreementId) remember(next,'team-heist-sale-settled',
                        { agreementId:item.agreementId,proceeds:Math.floor(item.value / 2),
                            rogiGold:Math.min(item.rogiShareDue,rules.splitSaleProceeds(Math.floor(item.value / 2),item.rogiSharePercent).companion) },events);
                    next.inventory = [];
                    break;
                }
                case 'pressure-team-heist-loot': {
                    const item = next.companionInventory[command.index];
                    if (!item || item.owner !== 'rogi' || !item.agreementId) { error = 'no-contracted-rogi-loot'; break; }
                    next.companionInventory.splice(command.index,1);
                    next.inventory.push({ ...item,owner:'player',rogiSharePercent:0,rogiShareDue:0 });
                    next.trust = Math.max(-100,next.trust - 12);
                    remember(next,'team-heist-contract-broken',{agreementId:item.agreementId,action:'pressure-transfer',trustDelta:-12},events);
                    events.push({ type:'contracted-loot-taken',id:item.id,trust:next.trust });
                    break;
                }
                case 'resolve-opening': {
                    const score = next.heist.crisis?.lastScore;
                    const deal = next.heist.crisis?.teamHeist;
                    if (next.status !== 'opening') { error = 'no-pending-opening'; break; }
                    if (deal?.committed && !deal.settled) {
                        const plan = teamHeistPlans[deal.planId];
                        if (deal.detected) {
                            finishTeamHeist(next,'detected',events,{cause:'collector-detected',distractor:plan.distractor});
                            if (plan.distractor === 'player') damage(next,1,events);
                            else {
                                next.companionHp = Math.max(0,next.companionHp - 1);
                                next.trust = Math.max(-100,next.trust - 2);
                                events.push({ type:'companion-damaged',amount:1,hp:next.companionHp,cause:'collector-caught-distractor' });
                                remember(next,'injury',{damage:1,hp:next.companionHp,source:'collector',agreementId:deal.id},events);
                            }
                            if (next.status !== 'game-over') leaveRoom(next,events);
                        } else openChest(next,deal.target,events,false,deal);
                    } else if (score?.committed && !score.settled) openChest(next,score.target,events,true);
                    else { error = 'no-pending-opening'; break; }
                    break;
                }
                case 'rest': {
                    if (next.status !== 'room' || next.room?.type !== 'CAMP') { error = 'not-at-camp'; break; }
                    if (rules.hasRestedAtCamp(next.heist,next.room.id)) {
                        events.push({ type:'camp-already-used', hp:next.hp, focus:next.heist.playerFocus });
                        break;
                    }
                    const focus = rules.restAtCamp(next.heist,next.room.id);
                    const oldHp = next.hp;
                    if (next.hp < next.maxHp) next.hp++;
                    events.push({ type:'camp-rested', focus:next.heist.playerFocus, focusRestored:focus, hp:next.hp, hpRestored:next.hp-oldHp });
                    break;
                }
                case 'leave-room':
                    if (next.status !== 'room' || next.room?.type === 'FIGHT' && !next.room.chests.some(chest => chest.opened)) {
                        error = 'room-exit-blocked'; break;
                    }
                    leaveRoom(next,events);
                    break;
                default: error = 'unsupported-command';
            }
            if (error) return fail(error);
            try { persist(next); } catch (saveError) { return fail('save-failed'); }
            state = next;
            return { ok:true, state:view(), events:copy(events) };
        }

        function random() {
            const next = copy(state);
            const result = nextRandom(next);
            persist(next);
            state = next;
            return result;
        }

        function getCrisisOptions() {
            const unopened = state.room?.chests.filter(chest => !chest.opened).length || 0;
            const crisis = state.status === 'crisis' && !!state.heist.crisis;
            return [
                { id:'pay', available:crisis && state.gold >= config.bribeGold, gold:config.bribeGold, focus:0, hp:0, risk:'none' },
                { id:'haggle-15', available:crisis && state.mode === 'B1' && state.gold >= 15, gold:15, focus:0, hp:0, risk:'rejected; no payment' },
                { id:'haggle-20', available:crisis && state.mode === 'B1' && state.gold >= 20, gold:20, focus:0, hp:0, risk:'none' },
                { id:'hide', available:crisis && state.heist.playerFocus >= config.hideCost, gold:0, focus:config.hideCost, hp:0, risk:'none' },
                { id:'flee', available:crisis && !!state.room?.chests.some(chest => chest.opened), gold:0, focus:0, hp:1, risk:'one damage; possible death/revive' },
                { id:'give-scroll', available:crisis && state.inventory.length > 0, gold:0, focus:0, hp:0,
                    lostScrollValue:state.inventory.length ? Math.min(...state.inventory.map(item => item.value)) : 0, risk:'lose lowest-value scroll' },
                { id:'last-score-player', available:crisis && rules.canStartLastScore(state.heist,unopened,state.gold),
                    gold:15, focus:1, hp:0, risk:'one unopened chest; mimic damage; forced exit' },
                { id:'last-score-rogi', available:crisis && state.mode === 'B1' && unopened > 0 &&
                    state.companionActive && state.companionFocus >= 1, gold:0, focus:0, companionFocus:1,
                    share:50, risk:'one unopened chest; mimic damage; deferred share of sale' },
                { id:'team-heist', available:crisis && state.mode === 'B1' && unopened > 0 && state.companionActive &&
                    state.companionHp > 0 && state.heist.playerFocus >= config.teamHeistFocusCost &&
                    state.companionFocus >= config.teamHeistFocusCost && !state.heist.crisis.teamHeistTried,
                    focus:config.teamHeistFocusCost, companionFocus:config.teamHeistFocusCost,
                    risk:'detection can injure distractor; mimic injures opener' }
            ];
        }

        function getTeamHeistOptions() {
            const crisis = ['crisis','negotiation'].includes(state.status) && state.heist.crisis?.mode === 'B1';
            const unopened = state.room?.chests.filter(chest => !chest.opened).length || 0;
            return Object.values(teamHeistPlans).map(plan => {
                const distractorHp = plan.distractor === 'player' ? state.hp : state.companionHp;
                const distractorFocus = plan.distractor === 'player' ? state.heist.playerFocus : state.companionFocus;
                return { ...plan, available:crisis && teamHeistAvailable(state.heist,{planId:plan.id,unopened,
                    companionActive:state.companionActive,companionHp:state.companionHp,companionFocus:state.companionFocus}),
                    focusCost:config.teamHeistFocusCost,detectionChance:teamHeistDetectionChance({distractorHp,distractorFocus}),
                    terms:teamHeistTermsForPlan(plan.id).map(item=>({...item})) };
            });
        }

        return Object.freeze({
            dispatch,
            getState:view,
            getCrisisOptions,
            getTeamHeistOptions,
            exportSave:() => copy(state),
            random,
            save:() => { persist(state); return true; }
        });
    }

    return Object.freeze({ SAVE_KEY, createMemoryStorage, createSession });
});
