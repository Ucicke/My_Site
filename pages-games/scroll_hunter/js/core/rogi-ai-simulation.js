/* ================================================================
   SCROLL HUNTER · core/rogi-ai-simulation.js
   Детерминированные сценарии и отчётность симулятора Роги.
   ================================================================ */
'use strict';

const RogiAISimulation = (() => {
const SIMULATION_SCENARIOS = Object.freeze({
    scrollOwnership: {
        actions:[
            { id:'keep',base:34,needWeight:{ debt:0.4,safety:0.1 },tags:['loot','debt'] },
            { id:'give',base:18,trustWeight:2,traitWeights:{ generosity:0.25,cooperation:0.15 },tags:['share','help'] },
            { id:'offer',base:29,trustWeight:0.2,traitWeights:{ pragmatism:0.2 },tags:['deal','fairness'] },
            { id:'split',base:21,trustWeight:0.35,traitWeights:{ cooperation:0.25,generosity:0.1 },tags:['fairness','credit'] },
            { id:'defer',base:25,traitWeights:{ caution:0.12,pragmatism:0.1 },needWeight:{ safety:0.18 },tags:['preserve','uncertainty'] }
        ], context:{ trust:35,rare:true,playerHp:3,companionHp:2 }, needs:{ debtUrgency:82,safety:48,fairness:56 }
    },
    dangerousRequest: {
        actions:[
            { id:'assist',base:44,traitWeights:{ courage:0.15,caution:-0.08,cooperation:0.04 },needWeight:{ safety:-0.16 },trustWeight:0.1,tags:['help','risk'] },
            { id:'refuse',base:20,traitWeights:{ caution:0.1,independence:0.03 },needWeight:{ safety:0.25 },tags:['caution','safe'] }
        ], context:{ trust:20,knownMimic:true,method:'open',companionHp:2 }, needs:{ safety:88,fairness:55,debtUrgency:60 }, stress:62
    },
    rudeCommand: {
        actions:[
            { id:'agree',base:39,tags:['agree','help','polite'] },
            { id:'refuse',base:36,tags:['refuse','command','choice'] }
        ], context:{ trust:25,tone:'command' }, needs:{ fairness:55,closeness:45,debtUrgency:60 }
    },
    politeRequest: {
        actions:[
            { id:'agree',base:39,tags:['agree','help','polite'] },
            { id:'refuse',base:36,tags:['refuse','command','choice'] }
        ], context:{ trust:25,tone:'polite' }, needs:{ fairness:55,closeness:45,debtUrgency:60 }
    },
    financialHelp: {
        actions:[
            { id:'accept-help',base:1,tags:['help','accept-help','polite'] }
        ], context:{ trust:38,offeredGold:25 }, needs:{ debtUrgency:92,closeness:52,safety:45,fairness:55 }
    },
    conditionalHelp: {
        actions:[{id:'decline-help',base:38,tags:['independent','choice']},{id:'clarify-help',base:38,tags:['choice','polite','bargain']}],
        context:{trust:38,offeredGold:25,conditions:'obedience'},needs:{debtUrgency:92,closeness:52,safety:45,fairness:55}
    },
    fairDeal: {
        actions:[
            { id:'accept-deal',base:38,trustWeight:0.8,tags:['offer','split','fair-deal','bargain','polite'] },
            { id:'reject-deal',base:38,tags:['keep','refuse','pressure'] }
        ], context:{ trust:28,tone:'polite',priceFair:true,rare:true }, needs:{ fairness:78,debtUrgency:72 }
    },
    brokenPromise: {
        actions:[
            { id:'repair',base:36,tags:['repair','apology','honest','polite'] },
            { id:'withdraw',base:33,tags:['leave','broken','refuse'] }
        ], context:{ trust:-35,brokenPromise:true }, needs:{ fairness:88,closeness:74 }, event:'broken-promise'
    },
    information: {
        actions:[
            { id:'inspect',base:33,tags:['inspect','curiosity','knowledge'] },
            { id:'skip',base:31,tags:['avoid','safe'] }
        ], context:{ unknown:true }, needs:{ safety:61,fairness:50,debtUrgency:50 }, focus:2
    },
    changedPlan: {
        actions:[
            { id:'adapt',base:32,tags:['choice','adapt','inspect','polite'] },
            { id:'hold',base:35,tags:['keep','command','safe'] }
        ], context:{ planChanged:true }, needs:{ safety:55,fairness:50,debtUrgency:50 }
    },
    recovery: {
        actions:[
            { id:'rest',base:31,tags:['rest','safe'] },
            { id:'press-on',base:40,tags:['initiative','risk'] }
        ], context:{ }, needs:{ safety:70,fairness:50,debtUrgency:60 }, stress:68, focus:1
    }
});
function scenarioComp(seed, scenarioId) {
    const spec = SIMULATION_SCENARIOS[scenarioId];
    const comp = { active:true,hp:3,maxHp:3,gold:0,debt:120,inventory:[],dungeon:1,ai:RogiAI.create(seed) };
    comp.ai.needs = { ...comp.ai.needs, ...spec.needs };
    if (spec.stress != null) comp.ai.stress = spec.stress;
    if (spec.focus != null) comp.ai.focus = spec.focus;
    if (spec.event) RogiAI.event(comp, spec.event, { key:'simulation:' + scenarioId });
    return comp;
}
function scenarioDecision(comp, scenarioId, contextOverrides = {}) {
    const spec = SIMULATION_SCENARIOS[scenarioId];
    if (contextOverrides.needs) Object.assign(comp.ai.needs, contextOverrides.needs);
    if (contextOverrides.finances) Object.assign(comp,contextOverrides.finances);
    const context = {...spec.context,...contextOverrides};
    if (scenarioId === 'scrollOwnership') context.financial = RogiAI.finances(comp);
    if (['financialHelp','conditionalHelp'].includes(scenarioId)) return RogiAI.goldOfferDecision(comp,context.offeredGold,context);
    return RogiAI.choose(comp, spec.actions, context);
}
function compareProfiles(firstSeed, secondSeed, scenarioId = 'scrollOwnership') {
    if (!SIMULATION_SCENARIOS[scenarioId]) throw new Error('Unknown Rogi AI scenario: ' + scenarioId);
    const run = seed => {
        const comp = scenarioComp(String(seed), scenarioId), result = scenarioDecision(comp, scenarioId);
        return { seed:String(seed), profile:{ traits:comp.ai.profile.traits.map(item => item.name), ideal:comp.ai.profile.ideal.name, bond:comp.ai.profile.bond.name, flaw:comp.ai.profile.flaw.name }, decision:result?.id || null, scores:comp.ai.decisionLog };
    };
    return { scenario:scenarioId, first:run(firstSeed), second:run(secondSeed) };
}
function profileSignatures(count) {
    const signatures = new Set();
    for (let i=0;i<count;i++) {
        const ai = RogiAI.create('sim-profile-' + i);
        signatures.add([ai.profile.traits.map(t=>t.id).join(','),ai.profile.ideal.id,ai.profile.bond.id,ai.profile.flaw.id].join('|'));
    }
    return signatures.size;
}
function simulateScenarios(count = 1000) {
    const categories = {}, outcomes = {}, countsByScenario = {}, invalidByScenario = {};
    let situations = 0, invalid = 0;
    for (const scenarioId of Object.keys(SIMULATION_SCENARIOS)) {
        const spec = SIMULATION_SCENARIOS[scenarioId], counts = {}, invalidCount = 0;
        for (let i=0;i<count;i++) {
            const comp = scenarioComp('sim-' + scenarioId + '-' + i, scenarioId);
            const result = scenarioDecision(comp, scenarioId);
            situations++;
            if (!result || !Number.isFinite(result.score) || !spec.actions.some(action=>action.id===result.id)) { invalid++; invalidCount++; continue; }
            counts[result.id] = (counts[result.id] || 0) + 1;
        }
        const rates = Object.fromEntries(Object.entries(counts).map(([id,n])=>[id,Math.round(n/count*1000)/10]));
        countsByScenario[scenarioId] = counts; invalidByScenario[scenarioId] = invalidCount;
        categories[scenarioId] = { decisions:counts, percentages:rates, diversity:Object.keys(counts).length, refusalRate:Math.round(Object.entries(counts).filter(([id])=>['refuse','decline-help','reject-deal','withdraw','skip'].includes(id)).reduce((n,[,v])=>n+v,0)/count*1000)/10 };
        for (const [id,n] of Object.entries(counts)) outcomes[id] = (outcomes[id] || 0) + n;
    }
    const compareRate = (scenarioId, low, high, matcher) => {
        let lowN=0,highN=0;
        for(let i=0;i<count;i++) {
            const a=scenarioComp('paired-'+scenarioId+'-'+i,scenarioId), b=JSON.parse(JSON.stringify(a));
            const lowChoice=scenarioDecision(a,scenarioId,low), highChoice=scenarioDecision(b,scenarioId,high);
            if(matcher(lowChoice?.id)) lowN++; if(matcher(highChoice?.id)) highN++;
        }
        return { low:Math.round(lowN/count*1000)/10, high:Math.round(highN/count*1000)/10, delta:Math.round((highN-lowN)/count*1000)/10 };
    };
    const financialNeed = compareRate('scrollOwnership',{ needs:{ debtUrgency:15 } },{ needs:{ debtUrgency:95 } },id=>id==='keep');
    const cashCoverage = compareRate('scrollOwnership',{finances:{gold:0}},{finances:{gold:120}},id=>id==='keep');
    const trustSensitivity = compareRate('scrollOwnership',{ trust:-80 },{ trust:80 },id=>['give','split'].includes(id));
    const focusRecovery = (()=>{
        let low=0,high=0;
        for(let i=0;i<count;i++) {
            const a={ai:RogiAI.create('rest-pair-'+i)},b=JSON.parse(JSON.stringify(a));
            a.ai.focus=1;b.ai.focus=1;RogiAI.rest(a,false);RogiAI.rest(b,false);low+=a.ai.focus-1;high+=b.ai.focus-1;
        }
        return { activeModifier:false,reason:'Костёр восстанавливает полный запас; focusRecovery удалён из активного пула.',low:Math.round(low/count*100)/100,high:Math.round(high/count*100)/100 };
    })();
    const factors = [
        ['courage','dangerousRequest','dimension'],['caution','dangerousRequest','dimension'],['generosity','scrollOwnership','dimension'],
        ['independence','rudeCommand','dimension'],['pride','rudeCommand','dimension'],['pragmatism','scrollOwnership','dimension'],
        ['cooperation','scrollOwnership','dimension'],['sensitivity','politeRequest','dimension'],
        ['fear','dangerousRequest','situational'],['greed','scrollOwnership','situational'],['loyalty','scrollOwnership','situational'],
        ['curiosity','information','situational'],['initiative','information','situational'],['focusSkill','information','situational'],
        ['perception','information','situational'],['anger','rudeCommand','situational'],['patience','fairDeal','situational'],
        ['debtStress','scrollOwnership','situational'],['trust','financialHelp','situational'],['askHelp','financialHelp','situational'],
        ['adaptability','changedPlan','situational'],['stressResistance','recovery','situational'],['forgive','brokenPromise','actions'],
        ['fairness','scrollOwnership','actions']
    ];
    const contribution = {};
    for(const [key,scenarioId,kind] of factors) {
        let changed=0, totalDelta=0, n=0;
        for(let i=0;i<Math.min(count,250);i++) {
            const low=scenarioComp('factor-'+key+'-'+i,scenarioId), high=JSON.parse(JSON.stringify(low));
            if(kind==='dimension') {
                low.ai.dimensions[key]=20; low.ai.profile.dimensions[key]=20;
                high.ai.dimensions[key]=80; high.ai.profile.dimensions[key]=80;
            } else if(kind==='situational') {
                low.ai.profile.modifierOverrides={situational:{[key]:-24}};
                high.ai.profile.modifierOverrides={situational:{[key]:24}};
            } else {
                low.ai.profile.modifierOverrides={actions:{[key]:-24}};
                high.ai.profile.modifierOverrides={actions:{[key]:24}};
            }
            const before=RogiAI.utility(low,SIMULATION_SCENARIOS[scenarioId].actions,SIMULATION_SCENARIOS[scenarioId].context);
            const after=RogiAI.utility(high,SIMULATION_SCENARIOS[scenarioId].actions,SIMULATION_SCENARIOS[scenarioId].context);
            if(before[0]?.id!==after[0]?.id)changed++;
            const afterById=new Map(after.map(row=>[row.id,row.score]));
            totalDelta+=Math.max(0,...before.map(row=>Math.abs(row.score-(afterById.get(row.id) ?? row.score)))); n++;
        }
        contribution[key]={decisionSwitchRate:Math.round(changed/n*1000)/10,meanTopScoreDelta:Math.round(totalDelta/n*100)/100,scenario:scenarioId,comparison:kind==='dimension'?'20 vs 80':kind==='situational'?'−24 vs +24':'−24 vs +24'};
    }
    let bondSwitches=0,bondScoreDelta=0;
    for(let i=0;i<Math.min(count,250);i++) {
        const comp=scenarioComp('bond-effect-'+i,'scrollOwnership'),neutral=JSON.parse(JSON.stringify(comp));
        neutral.ai.profile.bond={id:'no-bond',name:'',history:'',motive:''};
        const before=RogiAI.utility(comp,SIMULATION_SCENARIOS.scrollOwnership.actions,SIMULATION_SCENARIOS.scrollOwnership.context);
        const after=RogiAI.utility(neutral,SIMULATION_SCENARIOS.scrollOwnership.actions,SIMULATION_SCENARIOS.scrollOwnership.context);
        if(before[0]?.id!==after[0]?.id)bondSwitches++;
        const afterById=new Map(after.map(row=>[row.id,row.score]));
        bondScoreDelta+=Math.max(0,...before.map(row=>Math.abs(row.score-(afterById.get(row.id) ?? row.score))));
    }
    const repeatedA=scenarioDecision(scenarioComp('repeatability','scrollOwnership'),'scrollOwnership')?.id;
    const repeatedB=scenarioDecision(scenarioComp('repeatability','scrollOwnership'),'scrollOwnership')?.id;
    const knownRequirements=new Set(['always','room-unseen','chest-unseen','can-help-debt','no-debt-promise','can-promise-gift','no-share-promise','no-risk-promise','no-danger-promise','bond-unrevealed','follow-bond','trust-question-ready','fear-question-ready','has-harm-memory','loot-dispute','loot-repeat-pressure','loot-negotiate','loot-offer','loot-owned','more-choices']);
    const knownEffects=new Set(['survey','inspect','debt','transfer','promise-help','promise-gift','promise-cover','promise-conditional','promise-share','promise-risk','promise-danger','bond','clarify-bond','trust','fear','future','support','joke','apology','argue','pressure','repeat-pressure','negotiate-loot','buy-loot','share-loot','next-page']);
    const unreachableActions=ROGI_DIALOGUE_ACTIONS.filter(action=>!knownRequirements.has(action.requires)||!knownEffects.has(action.effect)).map(action=>action.id);
    return {
        profiles:count,distinctProfiles:profileSignatures(count),scenarios:Object.keys(SIMULATION_SCENARIOS).length,situations,invalid,
        categories,financialNeed,cashCoverage,trustSensitivity,focusRecovery,contribution,
        bondContribution:{decisionSwitchRate:Math.round(bondSwitches/Math.min(count,250)*1000)/10,meanTopScoreDelta:Math.round(bondScoreDelta/Math.min(count,250)*100)/100},unreachableActions,
        repeatedSeed:{ first:repeatedA,second:repeatedB,equal:repeatedA===repeatedB }
    };
}
function simulateProfiles(count = 1000) { return simulateScenarios(count); }
    return { SIMULATION_SCENARIOS, compareProfiles, simulateScenarios, simulateProfiles };
})();

Object.assign(RogiAI, RogiAISimulation);
