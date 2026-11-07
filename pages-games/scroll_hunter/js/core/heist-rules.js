/* Shared domain rules for the browser client and the headless game session. */
(function (root, factory) {
    const shared = factory();
    if (typeof module === 'object' && module.exports) module.exports = shared;
    root.ScrollHunterHeistRules = shared;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
    'use strict';

    const config = Object.freeze({
        maxFocus:3, startingFocus:3, carefulCost:1, carefulNoise:1, roughNoise:2,
        alertAt:4, hideCost:2, bribeGold:30, campFocus:1, carryThreshold:3, carryCap:1,
        teamHeistFocusCost:1, teamHeistDetectionBase:0.2, guardedTreasuryStartingNoise:2
    });

    const teamHeistPlans = Object.freeze({
        'player-distracts-rogi-opens':Object.freeze({ id:'player-distracts-rogi-opens', opener:'rogi', distractor:'player' }),
        'rogi-distracts-player-opens':Object.freeze({ id:'rogi-distracts-player-opens', opener:'player', distractor:'rogi' })
    });
    const teamHeistTerms = Object.freeze({
        'opener-keeps':Object.freeze({ id:'opener-keeps', owner:'opener', sharePercent:0 }),
        'player-keeps':Object.freeze({ id:'player-keeps', owner:'player', sharePercent:0 }),
        'player-keeps-share25':Object.freeze({ id:'player-keeps-share25', owner:'player', sharePercent:25 }),
        'rogi-keeps':Object.freeze({ id:'rogi-keeps', owner:'rogi', sharePercent:0 })
    });

    function teamHeistTermsForPlan(planId) {
        if (!teamHeistPlans[planId]) return [];
        return Object.values(teamHeistTerms).filter(term =>
            !(planId === 'player-distracts-rogi-opens' && term.id === 'rogi-keeps') &&
            !(planId === 'rogi-distracts-player-opens' && term.id === 'player-keeps'));
    }

    function teamHeistCounterTerm(planId, offeredTermId) {
        if (!teamHeistPlans[planId] || !teamHeistTermsForPlan(planId).some(term => term.id === offeredTermId)) return null;
        if (offeredTermId === 'opener-keeps') return teamHeistTerms['player-keeps-share25'];
        if (offeredTermId === 'player-keeps') return teamHeistTerms['player-keeps-share25'];
        if (offeredTermId === 'player-keeps-share25')
            return teamHeistTerms[planId === 'player-distracts-rogi-opens' ? 'opener-keeps' : 'rogi-keeps'];
        if (offeredTermId === 'rogi-keeps') return teamHeistTerms['player-keeps-share25'];
        return null;
    }

    function teamHeistAvailable(state, { planId, unopened, companionActive, companionHp, companionFocus } = {}) {
        if (!state?.crisis || state.crisis.mode !== 'B1' ||
            !Number.isInteger(unopened) || unopened < 1 || companionActive !== true || companionHp < 1 ||
            !teamHeistPlans[planId]) return false;
        return state.playerFocus >= config.teamHeistFocusCost && companionFocus >= config.teamHeistFocusCost;
    }

    function teamHeistDetectionChance({ distractorHp = 3, distractorFocus = 3 } = {}) {
        let chance = config.teamHeistDetectionBase;
        if (distractorHp <= 1) chance += 0.1;
        if (distractorFocus <= 1) chance += 0.05;
        return Math.round(Math.max(0, Math.min(0.35, chance)) * 100) / 100;
    }

    function freshState() {
        return { version:1, playerFocus:config.startingFocus, noise:0, carry:0, roomId:null,
            roomType:null, alerted:false, pending:false, crisis:null, campRestedNodes:[],
            actions:0, lastMethod:null, mode:'A', guardedTreasury:{ roomId:null,status:'pending' } };
    }

    const rules = Object.freeze({
        splitSaleProceeds(gross, sharePercent = 0) {
            const total = Math.max(0,Math.floor(Number(gross)||0));
            const percent = Math.max(0,Math.min(100,Math.floor(Number(sharePercent)||0)));
            const companion = Math.floor(total*percent/100);
            return { gross:total, player:total-companion, companion };
        },
        createState:freshState,
        enterRoom(state, id, type) {
            const carry = Math.max(0, Math.min(config.carryCap, Number(state.carry) || 0));
            state.roomId = id == null ? null : String(id);
            state.roomType = type || null;
            state.noise = type === 'FIGHT' ? carry : 0;
            if (type === 'FIGHT' && state.mode === 'B1' && state.guardedTreasury?.status === 'pending') {
                state.guardedTreasury = { roomId:state.roomId,status:'available' };
            }
            state.carry = 0;
            state.alerted = false;
            state.pending = false;
            state.crisis = null;
            state.lastMethod = null;
            return state;
        },
        beginGuardedTreasury(state) {
            const scene = state.guardedTreasury;
            if (state.mode !== 'B1' || state.roomType !== 'FIGHT' || !scene || scene.status !== 'available' ||
                scene.roomId !== state.roomId || state.alerted || state.crisis || state.noise >= config.alertAt) return false;
            scene.status = 'negotiating';
            state.crisis = { rogiTried:false,mode:'B1',view:'treasury-briefing',rogiScoreTried:false,
                teamHeistTried:false,teamHeistDraft:null,teamHeist:null,lastScore:null,scene:'guarded-treasury' };
            return true;
        },
        finishGuardedTreasury(state, outcome = 'declined') {
            const scene = state.guardedTreasury;
            if (!scene || scene.status !== 'negotiating') return false;
            scene.status = outcome === 'success' ? 'resolved' : outcome === 'detected' ? 'resolved' : 'declined';
            if (state.crisis?.scene === 'guarded-treasury' && outcome !== 'success') state.crisis = null;
            return true;
        },
        recordAction(state, method, actor = 'player') {
            if (state.roomType !== 'FIGHT')
                return { ok:true, noise:state.noise, cost:0, triggered:false };
            if (!['careful','rough'].includes(method))
                return { ok:false, reason:'method', cost:0, noise:state.noise, triggered:false };
            const cost = actor === 'player' && method === 'careful' ? config.carefulCost : 0;
            if (state.playerFocus < cost) return { ok:false, reason:'focus', cost, noise:state.noise, triggered:false };
            state.playerFocus -= cost;
            state.noise = Math.min(config.alertAt, state.noise + (method === 'careful' ? config.carefulNoise : config.roughNoise));
            state.actions++;
            state.lastMethod = method;
            const triggered = state.noise >= config.alertAt && !state.alerted;
            if (triggered) state.pending = true;
            return { ok:true, cost, noise:state.noise, triggered };
        },
        beginCrisis(state) {
            if (!state.pending || state.alerted) return false;
            state.pending = false;
            state.alerted = true;
            state.crisis = { rogiTried:false, mode:state.mode === 'B1' ? 'B1' : 'A', view:'main', rogiScoreTried:false,
                teamHeistTried:false, teamHeistDraft:null, teamHeist:null, lastScore:null };
            return true;
        },
        canStartLastScore(state, unopenedCount, gold) {
            return state.crisis?.mode === 'B1' && !state.crisis.lastScore &&
                unopenedCount > 0 && state.playerFocus >= 1 && gold >= 15;
        },
        commitLastScore(state, target, source = 'player') {
            const crisis = state.crisis;
            if (!crisis || crisis.mode !== 'B1' || crisis.lastScore || !Number.isInteger(target) || target < 0 ||
                (source !== 'player' && source !== 'rogi')) return false;
            crisis.lastScore = { target, source, committed:true, settled:false, share:source === 'rogi' ? 50 : 0 };
            crisis.rogiDealPending = source === 'rogi';
            crisis.view = 'targets';
            if (source === 'player') state.playerFocus--;
            return true;
        },
        commitTeamHeist(state, { id, planId, termId, target, detectionChance, detectionRoll, scope = 'crisis' }) {
            const crisis = state.crisis;
            const accepted = crisis?.teamHeist;
            if (!crisis || crisis.mode !== 'B1' || accepted?.committed ||
                (accepted && (accepted.id !== id || accepted.planId !== planId || accepted.termId !== termId)) || !teamHeistPlans[planId] ||
                !teamHeistTermsForPlan(planId).some(term => term.id === termId) || !Number.isInteger(target) || target < 0 ||
                state.playerFocus < config.teamHeistFocusCost) return false;
            state.playerFocus -= config.teamHeistFocusCost;
            const chance = Math.max(0,Math.min(0.35,Number(detectionChance)||0));
            crisis.teamHeist = { id:String(id || 'team-heist'),planId,termId,target,scope:scope === 'guarded-treasury' ? scope : 'crisis',committed:true,settled:false,
                detectionChance:chance,
                detectionRoll:Math.max(0,Math.min(0.999999,Number(detectionRoll)||0)),
                detected:Number(detectionRoll) < chance };
            if (accepted.scope === 'guarded-treasury') state.noise = Math.max(state.noise,config.guardedTreasuryStartingNoise);
            crisis.view = 'team-targets';
            return true;
        },
        settleLastScore(state) {
            if (!state.crisis?.lastScore?.committed || state.crisis.lastScore.settled) return false;
            state.crisis.lastScore.settled = true;
            state.crisis.rogiDealPending = false;
            return true;
        },
        clearCrisis(state) {
            if (!state.crisis) return false;
            state.noise = 0;
            state.pending = false;
            state.crisis = null;
            return true;
        },
        leaveRoom(state) {
            if (state.guardedTreasury?.roomId === state.roomId && ['available','negotiating'].includes(state.guardedTreasury.status))
                state.guardedTreasury.status = 'missed';
            state.carry = state.roomType === 'FIGHT' && !state.alerted && state.noise >= config.carryThreshold
                ? config.carryCap : 0;
            state.roomId = null;
            state.roomType = null;
            state.noise = 0;
            state.pending = false;
            state.crisis = null;
            state.lastMethod = null;
            return state.carry;
        },
        restAtCamp(state, nodeId) {
            const key = String(nodeId == null ? 'camp' : nodeId);
            if (state.campRestedNodes.includes(key)) return 0;
            state.campRestedNodes.push(key);
            const restored = Math.min(config.campFocus, config.maxFocus - state.playerFocus);
            state.playerFocus += restored;
            return restored;
        },
        hasRestedAtCamp(state, nodeId) {
            return state.campRestedNodes.includes(String(nodeId == null ? 'camp' : nodeId));
        },
        restore(snapshot) {
            const state = freshState();
            if (!snapshot || typeof snapshot !== 'object') return state;
            state.playerFocus = Math.max(0, Math.min(config.maxFocus, Math.floor(Number(snapshot.playerFocus) || 0)));
            state.noise = Math.max(0, Math.min(config.alertAt, Math.floor(Number(snapshot.noise) || 0)));
            state.carry = Math.max(0, Math.min(config.carryCap, Math.floor(Number(snapshot.carry) || 0)));
            state.roomId = typeof snapshot.roomId === 'string' ? snapshot.roomId : null;
            state.roomType = typeof snapshot.roomType === 'string' ? snapshot.roomType : null;
            state.alerted = snapshot.alerted === true;
            state.pending = snapshot.pending === true;
            state.mode = snapshot.mode === 'B1' ? 'B1' : 'A';
            state.crisis = snapshot.crisis && typeof snapshot.crisis === 'object'
                ? { ...snapshot.crisis,
                    rogiTried:snapshot.crisis.rogiTried === true,
                    mode:snapshot.crisis.mode === 'B1' ? 'B1' : state.mode,
                    view:['main','escape','targets','rogi-terms','team-plan','team-terms','team-counter','team-targets','treasury-briefing'].includes(snapshot.crisis.view) ? snapshot.crisis.view : 'main',
                    rogiScoreTried:snapshot.crisis.rogiScoreTried === true,
                    teamHeistTried:snapshot.crisis.teamHeistTried === true,
                    teamHeistDraft:snapshot.crisis.teamHeistDraft && teamHeistPlans[snapshot.crisis.teamHeistDraft.planId]
                        ? { planId:snapshot.crisis.teamHeistDraft.planId,
                            ...(teamHeistTerms[snapshot.crisis.teamHeistDraft.offeredTermId] ? { offeredTermId:snapshot.crisis.teamHeistDraft.offeredTermId } : {}),
                            ...(teamHeistTerms[snapshot.crisis.teamHeistDraft.counterTermId] ? { counterTermId:snapshot.crisis.teamHeistDraft.counterTermId } : {}) }
                        : null,
                    teamHeist:snapshot.crisis.teamHeist && teamHeistPlans[snapshot.crisis.teamHeist.planId] && teamHeistTerms[snapshot.crisis.teamHeist.termId]
                        ? { id:typeof snapshot.crisis.teamHeist.id === 'string' ? snapshot.crisis.teamHeist.id : 'team-heist-restored',
                            planId:snapshot.crisis.teamHeist.planId,termId:snapshot.crisis.teamHeist.termId,
                            committed:snapshot.crisis.teamHeist.committed === true,settled:snapshot.crisis.teamHeist.settled === true,
                            target:Number.isInteger(snapshot.crisis.teamHeist.target) ? snapshot.crisis.teamHeist.target : -1,
                            detected:snapshot.crisis.teamHeist.detected === true,
                            detectionChance:Math.max(0,Math.min(0.35,Number(snapshot.crisis.teamHeist.detectionChance)||0)),
                            detectionRoll:Math.max(0,Math.min(0.999999,Number(snapshot.crisis.teamHeist.detectionRoll)||0)),
                            scope:snapshot.crisis.teamHeist.scope === 'guarded-treasury' ? 'guarded-treasury' : 'crisis',
                            resultSummary:typeof snapshot.crisis.teamHeist.resultSummary === 'string' ? snapshot.crisis.teamHeist.resultSummary : null,
                            outcome:typeof snapshot.crisis.teamHeist.outcome === 'string' ? snapshot.crisis.teamHeist.outcome : null }
                        : null,
                    rogiDealPending:snapshot.crisis.rogiDealPending === true,
                    lastScore:snapshot.crisis.lastScore && typeof snapshot.crisis.lastScore === 'object'
                        ? { target:Number.isInteger(snapshot.crisis.lastScore.target) ? snapshot.crisis.lastScore.target : -1,
                            source:snapshot.crisis.lastScore.source === 'rogi' ? 'rogi' : 'player',
                            committed:snapshot.crisis.lastScore.committed === true,
                            settled:snapshot.crisis.lastScore.settled === true,
                            share:snapshot.crisis.lastScore.share === 50 ? 50 : 0 }
                        : null }
                : null;
            const treasury = snapshot.guardedTreasury;
            state.guardedTreasury = treasury && ['pending','available','negotiating','resolved','declined','missed'].includes(treasury.status)
                ? { roomId:typeof treasury.roomId === 'string' ? treasury.roomId : null,status:treasury.status }
                : { roomId:null,status:'pending' };
            state.campRestedNodes = Array.isArray(snapshot.campRestedNodes)
                ? [...new Set(snapshot.campRestedNodes.filter(value => typeof value === 'string'))] : [];
            state.actions = Math.max(0, Math.floor(Number(snapshot.actions) || 0));
            state.lastMethod = ['careful','rough'].includes(snapshot.lastMethod) ? snapshot.lastMethod : null;
            return state;
        }
    });

    return Object.freeze({ config, rules, teamHeistPlans, teamHeistTerms, teamHeistTermsForPlan, teamHeistAvailable,
        teamHeistCounterTerm, teamHeistDetectionChance });
});
