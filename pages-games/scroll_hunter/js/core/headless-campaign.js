/* Node-only campaign simulator built on the game's real procedural data and rules. */
'use strict';

const vm = require('node:vm');
const { rules } = require('./heist-rules.js');
const { createGameContext } = require('./headless-vm.js');
const DEFAULT_START = Object.freeze({ gold:0, hp:4, maxHp:4, playerFocus:3, upgrades:0, week:1, tribute:300 });
const CRISIS_ACTIONS = Object.freeze([
    { id:'assist', base:34, traitWeights:{ courage:.3, cooperation:.3, loyalty:.22, caution:-.18 }, tags:['help','risk','assist'], needWeight:{ closeness:.16 } },
    { id:'condition', base:33, traitWeights:{ pragmatism:.22, greed:.3, fairness:.2, cooperation:.12 }, tags:['deal','share','fair-deal'], needWeight:{ debt:.3, fairness:.14 } },
    { id:'refuse', base:34, traitWeights:{ caution:.32, fear:.24, independence:.12, loyalty:-.18 }, tags:['refuse','safe','choice'], needWeight:{ safety:.16 } }
]);

function hashSeed(value) {
    let hash = 2166136261;
    for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0 || 0x6d2b79f5;
}

function seededRandom(seed) {
    let state = hashSeed(seed);
    return () => {
        state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
        return (state >>> 0) / 0x100000000;
    };
}

function serializable(value) { return JSON.parse(JSON.stringify(value)); }

function createGameWorld(seed) {
    const random = seededRandom(seed);
    const math = Object.create(Math);
    let gameContext = null;
    math.random = () => gameContext?.GameRng.next('mechanics') ?? random();
    const sandbox = {
        Math:math,
        clamp:(value,min,max) => Math.max(min,Math.min(max,value)),
        randInt:(min,max) => gameContext.GameRng.int('mechanics',min,max),
        randIntIn:(stream,min,max) => gameContext.GameRng.int(stream,min,max),
        randIn:(stream,min,max) => gameContext.GameRng.between(stream,min,max),
        shuffle:list => {
            return gameContext.GameRng.shuffle('mechanics',list);
        },
        shuffleIn:(stream,list) => gameContext.GameRng.shuffle(stream,list),
        stageLevels:() => 15,
        console
    };
    const sources = [
        'js/core/random.js', 'js/data/scrolls.js', 'js/data/rooms.js', 'js/data/events.js', 'js/data/rogi-personality.js',
        'js/core/two-rogues-story.js',
        'js/core/economy.js', 'js/core/event-deck.js', 'js/core/encounters.js', 'js/core/map.js', 'js/core/rogi-promises.js', 'js/core/rogi-ai.js'
    ];
    const context = createGameContext(sandbox, sources,
        'let stageIndex=0; let foundRelics=new Set(); let clearedWeak=new Set(); let headlessCurrentEvent=null; let campaignStoryFlags={inspectorCallbackResolved:false,merchantSearchPending:false};');
    gameContext = context;
    context.GameRng.start(seed);
    vm.runInContext(`
        globalThis.__campaignWorld = {
            generateMap:stageIndexValue => { stageIndex=stageIndexValue||0; foundRelics=new Set(); resetEventDeck(); return generateStageMap(STAGES[stageIndex]); },
            resetRelics:() => { foundRelics=new Set(); },
            generateRoom:mapAndId => {
                const node=nodeById(mapAndId.map,mapAndId.id);
                if (!node) throw new Error('unknown-map-node:'+mapAndId.id);
                const composition=roomComposition(node.type), kinds=[];
                for(let i=0;i<composition.relic;i++) kinds.push('RELIC');
                for(let i=0;i<composition.mimic;i++) kinds.push('MIMIC');
                for(let i=0;i<composition.empty;i++) kinds.push('EMPTY');
                const chests=shuffleIn('loot',kinds).map((kind,index)=>{
                    let type=kind==='RELIC'?'scroll':kind==='MIMIC'?'mimic':node.type==='DIG'?'dig':'empty';
                    return {id:String(index),kind,type,scrollId:null,value:0,opened:false};
                });
                return {node:{id:node.id,row:node.row,col:node.col,type:node.type},composition,chests};
            },
            makeScroll:(depth,rare) => {
                let pool=SCROLL_TYPES.filter(scroll=>!foundRelics.has(scroll.id));
                if(rare) { const rich=pool.filter(scroll=>scroll.price>=40); if(rich.length) pool=rich; }
                if(!pool.length) { foundRelics=new Set(); pool=SCROLL_TYPES; }
                const scroll=pool[randIntIn('loot',0,pool.length-1)]; foundRelics.add(scroll.id);
                const floor=Math.max(1,Math.min(15,depth));
                return {id:scroll.id,value:Math.round(scroll.price*ECONOMY.depthPrice[floor-1]),rogiSharePercent:0};
            },
            drawEvent:contextValues => {
                const context = contextValues ? { active:contextValues.rogi?.active !== false,
                    ai:contextValues.rogi?.ai, gold:contextValues.gold, hp:contextValues.hp,
                    trust:contextValues.trust, rogiFocus:contextValues.rogi?.ai?.focus,
                    scrolls:contextValues.scrolls || [], storyFlags:contextValues.storyFlags || {} } : null;
                headlessCurrentEvent=drawDungeonEvent(context);
                return headlessCurrentEvent?{id:headlessCurrentEvent.id,title:headlessCurrentEvent.title,
                    storyEvent:headlessCurrentEvent.storyEvent===true,
                    choices:headlessCurrentEvent.choices.map((choice,index)=>({index,id:choice.id||null,
                        storyChoiceId:choice.storyChoiceId||null,text:choice.text,hint:choice.hint||'',
                        disabled:choice.disabled===true,cost:choice.cost||0,healthCost:choice.healthCost||0,
                        relicForced:!!choice.relicForced}))}:null;
            },
            resolveEvent:(index, contextValues) => {
                const choice=headlessCurrentEvent?.choices[index];
                if(!choice) throw new Error('invalid-event-choice:'+index);
                if(headlessCurrentEvent.storyEvent) {
                    const rogi=contextValues?.rogi, ai=rogi?.ai;
                    const context={active:!!rogi?.active,ai,gold:contextValues.gold,hp:contextValues.hp,
                        trust:contextValues.trust,rogiFocus:ai?.focus,scrolls:contextValues.scrolls||[],
                        storyFlags:contextValues.storyFlags||{},
                        rogiDecision:(kind,actions,history)=>RogiAI.choose(rogi,actions,{
                            decisionKind:'story-'+kind,trust:contextValues.trust,tone:'polite',
                            financial:RogiAI.finances(rogi),playerHp:contextValues.hp,
                            companionHp:rogi.hp,companionFocus:ai.focus,promises:ai.promises,
                            historyBranch:history.branch,riskBearer:'rogi',initiator:'player',executor:'rogi'
                        })?.id,
                        roll:key=>rogi?.active?RogiAI.roll(rogi,key):GameRng.next('events')};
                    const outcome=TwoRoguesStory.resolve(headlessCurrentEvent.id,choice.storyChoiceId,context);
                    if(!outcome) throw new Error('invalid-story-choice:'+choice.storyChoiceId);
                    return {result:{...outcome,storyEvent:true},cost:0,healthCost:0};
                }
                const result=choice.apply()||{};
                return {result,cost:choice.cost||0,healthCost:choice.healthCost||0};
            },
            shopCash:storyFlags => {
                campaignStoryFlags=storyFlags || campaignStoryFlags;
                const stock=makeShopStock();
                return {cash:stock.cash,reducedCashNotice:stock.reducedCashNotice,storyFlags:{...campaignStoryFlags}};
            },
            treasureBase:() => randIntIn('loot',60,110),
            greedyTreasureWins:() => GameRng.next('loot')>=0.3,
            roll:() => GameRng.next('mechanics'),
            queueCallback:contextValues => queueStoryEvent('inspector-callback', contextValues),
            randomBossWave:() => {
                const stage=STAGES[0], size=stage.chests;
                const mimics=Math.max(1,Math.min(size-2,Math.round(size*stage.mimicRate*0.5)));
                return shuffleIn('loot',new Array(size-mimics).fill('scroll').concat(new Array(mimics).fill('mimic')));
            },
            createRogi:seed => RogiAI.create(seed),
            rogiAI:{
                newDungeon:(comp)=>RogiAI.newDungeon(comp), roomTransition:(comp)=>RogiAI.roomTransition(comp),
                choose:(comp,actions,context)=>RogiAI.choose(comp,actions,context),
                utility:(comp,actions,context)=>RogiAI.utility(comp,actions,context),
                spendFocus:(comp,cost,reason)=>RogiAI.spendFocus(comp,cost,reason),
                roll:(comp,key)=>RogiAI.roll(comp,key),
                event:(comp,type,detail)=>RogiAI.event(comp,type,detail), rest:(comp,full)=>RogiAI.rest(comp,full),
                endDungeon:(comp,options)=>RogiAI.endDungeon(comp,options),
                syncFinances:(comp,progress)=>RogiAI.syncFinances(comp,progress), finances:(comp)=>RogiAI.finances(comp)
            }
        };
    `,context);
    return context.__campaignWorld;
}

function createGeneratedCampaign({ seed, rogiSeed } = {}) {
    const normalizedSeed=String(seed ?? 'scroll-hunter-natural-week');
    const world=createGameWorld(normalizedSeed);
    const map=serializable(world.generateMap(0));
    const ai=world.createRogi(rogiSeed == null ? normalizedSeed+':rogi' : String(rogiSeed));
    const rogi=serializable({seed:ai.seed,profile:ai.profile,dimensions:ai.dimensions,needs:ai.needs,focus:ai.focus,stress:ai.stress});
    return Object.freeze({
        seed:normalizedSeed,map,start:{...DEFAULT_START},rogi,
        generateRoom:nodeId=>serializable(world.generateRoom({map,id:nodeId})),
        _world:world,_ai:ai
    });
}

function crisisOptions(state, unopened) {
    const rogiAvailable=state.rogi.active && state.rogi.hp>0 && state.rogi.ai.focus>0;
    return [
        {id:'pay-30',available:state.gold>=30,gold:30,focus:0,hp:0,risk:'none'},
        {id:'haggle-15',available:state.gold>=15,gold:15,focus:0,hp:0,risk:'rejected without payment'},
        {id:'haggle-20',available:state.gold>=20,gold:20,focus:0,hp:0,risk:'none'},
        {id:'hide',available:state.playerFocus>=2,gold:0,focus:2,hp:0,risk:'none'},
        {id:'flee',available:state.opened>0,gold:0,focus:0,hp:1,risk:'can kill the player'},
        {id:'give-scroll',available:state.inventory.length>0,gold:0,focus:0,hp:0,
            lostScrollValue:state.inventory.length?Math.min(...state.inventory.map(item=>item.value)):0,risk:'lose a scroll'},
        {id:'last-score-player',available:unopened>0&&state.playerFocus>=1&&state.gold>=15,gold:15,focus:1,hp:0,risk:'one unopened chest; mimic risk; forced exit'},
        {id:'last-score-rogi',available:unopened>0&&rogiAvailable,gold:0,focus:0,companionFocus:1,share:'25–50%',risk:'one unopened chest; mimic risk; forced exit'}
    ];
}

function routeScore(type,strategy,state) {
    const healthLow=state.hp<=2, focusLow=state.playerFocus<=1;
    if(strategy==='cautious') return ({CAMP:healthLow||focusLow?12:8,CAMP_FINALE:12,TREASURE:10,SHOP:state.gold<30?9:6,EVENT:7,DIG:4,FIGHT:3,ELITE:1,BOSS:0})[type]??0;
    if(strategy==='aggressive') return ({FIGHT:12,ELITE:11,DIG:9,TREASURE:healthLow?4:8,CAMP:healthLow?10:2,CAMP_FINALE:8,SHOP:6,EVENT:5,BOSS:0})[type]??0;
    return ({FIGHT:12,ELITE:10,DIG:8,CAMP:state.rogi.hp<=1||healthLow?11:4,CAMP_FINALE:10,TREASURE:8,SHOP:state.gold<30?8:5,EVENT:7,BOSS:0})[type]??0;
}

function strategyMethod(strategy,state) {
    return strategy==='cautious' && state.playerFocus>0 ? 'careful' : 'rough';
}

function makeRogi(seed,ai,world) {
    const companion={active:true,hp:3,maxHp:3,gold:0,debt:300,inventory:[],dungeon:1,settlement:null,ai};
    world.rogiAI.newDungeon(companion);
    return companion;
}

function applyDamage(state,amount,kind,log) {
    state.hp=Math.max(0,state.hp-amount);
    log.push({type:'damage',kind,amount,hp:state.hp});
    if(state.hp===0) state.alive=false;
}

function runNaturalScenario({seed,strategy}) {
    if(!['cautious','aggressive','rogi-assist'].includes(strategy)) throw new TypeError('unknown-strategy:'+strategy);
    const campaign=createGeneratedCampaign({seed});
    const world=campaign._world, rogi=makeRogi(seed,campaign._ai,world);
    const state={gold:0,hp:4,maxHp:4,playerFocus:3,rogi,inventory:[],companionGold:0,trust:0,alive:true,opened:0,
        storyFlags:{inspectorCallbackResolved:false,merchantSearchPending:false}};
    const heist=rules.createState(); heist.mode='B1';
    const pathLog=[],chestLog=[],crisisLog=[],guardedTreasuryEncounters=[],mapConnections=campaign.map.flat().flatMap(node=>node.next.map(to=>({from:node.id,to})));
    const visited=[];
    let current=campaign.map[0].slice().sort((a,b)=>a.col-b.col)[Math.floor(world.roll()*campaign.map[0].length)];
    let firstCrisis=null, outcome={status:'week-complete',reason:'boss-defeated'};
    const addScroll=(chest,node,sharePercent=0,provided=null)=>{
        const generated=provided||world.makeScroll(node.row+1,node.type==='ELITE');
        const item={...generated,rogiSharePercent:sharePercent};
        state.inventory.push(item);
        chest.scrollId=item.id; chest.value=item.value;
        return item;
    };

    function rogiChestAssessment(chest,method) {
        const focusCost=method==='break'?2:1;
        if(!rogi.active||rogi.hp<=0||rogi.ai.focus<focusCost) return {allowed:false,reason:'unavailable'};
        if(rogi.ai.promises.risk?.status==='active'||rogi.ai.promises.noKnownDanger?.status==='active') return {allowed:false,reason:'promise'};
        const actions=[
            {id:'assist',base:44,tags:['help'],traitWeights:{courage:.15,caution:-.08,cooperation:.04},needWeight:{safety:-.16}},
            {id:'refuse',base:20,tags:['caution'],traitWeights:{caution:.1,independence:.03},needWeight:{safety:.25}}
        ];
        const scores=world.rogiAI.utility(rogi,actions,{trust:state.trust,knownMimic:false,method:'open',tone:'polite',companionHp:rogi.hp});
        const refused=scores[0]?.id==='refuse'&&scores[0].score>scores[1].score+3;
        return {allowed:!refused,reason:refused?'personality-refusal':'assist',scores:serializable(scores)};
    }

    function rogiOwnScroll(scroll,node) {
        const item={...scroll,price:scroll.value,uid:rogi.ai.eventNo+1,
            sentimental:['family-relic','lost-scroll','quiet-library'].includes(rogi.ai.profile.bond.id)&&scroll.value>=90};
        const financial=world.rogiAI.syncFinances(rogi);
        world.rogiAI.event(rogi,'valuable-find',{key:item.id,price:item.value});
        const pick=world.rogiAI.choose(rogi,[
            {id:'keep',base:34,traitWeights:{pragmatism:.2},needWeight:{debt:.4,safety:.1},tags:['loot']},
            {id:'give',base:18,trustWeight:2,traitWeights:{generosity:.25,cooperation:.15},tags:['share','help']},
            {id:'offer',base:29,trustWeight:.2,traitWeights:{pragmatism:.2},tags:['deal','fairness'],needWeight:{fairness:.1}},
            {id:'split',base:21,trustWeight:.35,traitWeights:{cooperation:.25,generosity:.1},tags:['fairness','credit']},
            {id:'defer',base:25,traitWeights:{caution:.12,pragmatism:.1},needWeight:{safety:.18},tags:['preserve','uncertainty']}
        ],{trust:state.trust,rare:true,playerHp:state.hp,companionHp:rogi.hp,financial,decisionKind:'loot-ownership',
            initiator:'player',executor:'rogi',riskBearer:'rogi',lootOwner:'pending',uid:item.uid});
        item.decision=pick?.id||'keep';
        if(item.decision==='give') {
            state.inventory.push({id:item.id,value:item.value,rogiSharePercent:0});
            world.rogiAI.event(rogi,'fair-deal',{key:item.id,decision:'give',source:'companion'});
        } else {
            rogi.inventory.push(item);
            world.rogiAI.event(rogi,'loot-decision',{key:item.id,decision:item.decision,price:item.value});
        }
        return item;
    }

    function hurtRogi(amount,log,node,actor) {
        rogi.hp=Math.max(0,rogi.hp-amount); state.trust-=amount*2;
        world.rogiAI.event(rogi,'injury',{damage:amount,hp:rogi.hp,deferDrama:true,initiator:actor||'player',executor:'rogi',riskBearer:'rogi'});
        log.push({type:'rogi-injured',floor:node.row+1,nodeId:node.id,amount,hp:rogi.hp});
    }

    function sellRogiInventory(atExit,wallet=Infinity) {
        let cash=atExit?Infinity:Math.max(0,wallet),projected=rogi.gold;
        const sales=[],remaining=[];
        for(const item of rogi.inventory) {
            const price=atExit?Math.floor(item.value/2):item.value;
            if(cash<price) { remaining.push(item); continue; }
            const sentimental=item.sentimental||(['family-relic','quiet-library','lost-scroll'].includes(rogi.ai.profile.bond.id)&&item.value>=90);
            let sell=true;
            if(sentimental) {
                const need=Math.max(0,rogi.debt-projected);
                const decision=world.rogiAI.choose(rogi,[
                    {id:'sell',base:need>0?65:24,needWeight:{debt:.3},tags:['offer','debt','deal']},
                    {id:'retain',base:38,traitWeights:{independence:.12},tags:['keep','preserve','relic']}
                ],{financial:{...world.rogiAI.finances(rogi),cash:projected,shortCash:need},rare:true,atExit,
                    decisionKind:'sale',initiator:'rogi',executor:'rogi',riskBearer:null,uid:item.uid,lootOwner:'rogi'});
                sell=decision?.id==='sell';
            }
            if(!sell) { remaining.push(item); continue; }
            sales.push({id:item.id,proceeds:price}); projected+=price; cash-=price;
        }
        rogi.gold=projected; rogi.inventory=remaining;
        return {initialWallet:atExit?null:wallet,remainingWallet:atExit?null:cash,sales,kept:remaining.length};
    }

    function settleCrisis(node,room,unopened) {
        const options=crisisOptions(state,unopened.length), snapshot={gold:state.gold,hp:state.hp,playerFocus:state.playerFocus,
            rogiHp:rogi.hp,rogiGold:rogi.gold,rogiFocus:rogi.ai.focus,trust:state.trust,
            inventory:state.inventory.map(item=>({...item})),rogiInventory:rogi.inventory.map(item=>({id:item.id,value:item.price})),opened:state.opened};
        const entry={floor:node.row+1,nodeId:node.id,mode:'B1',noise:heist.noise,snapshot,options,
            haggle:{offer15:{available:state.gold>=15,result:state.gold>=20?'accepted':'rejected'},offer20:{available:state.gold>=20,result:'accepted'}},
            rogi:{available:options.at(-1).available,decision:null,agreement:null,focusBefore:rogi.ai.focus},resolution:null};
        if(!firstCrisis) firstCrisis=entry;
        crisisLog.push(entry);
        let target=null, sharePercent=0, useRogi=false;
        const available=id=>options.find(option=>option.id===id)?.available===true;
        if(strategy==='rogi-assist' && available('last-score-rogi')) {
            const personalRisk=(rogi.hp<=1?22:rogi.hp===2?8:0)+(rogi.ai.focus<=1?8:0);
            const financial=world.rogiAI.finances(rogi);
            const pick=world.rogiAI.choose(rogi,CRISIS_ACTIONS,{decisionKind:'heist-last-score',trust:state.trust,tone:'polite',
                roomThreat:heist.noise,financial,playerHp:state.hp,companionHp:rogi.hp,companionFocus:rogi.ai.focus,
                debt:rogi.debt,promises:rogi.ai.promises,riskBearer:'rogi'});
            entry.rogi.decision={choice:pick?.id||null,scores:serializable(rogi.ai.decisionLog||[]),profileSeed:rogi.ai.seed};
            if(pick?.id!=='refuse') {
                useRogi=true; sharePercent=pick?.id==='condition'?25:50;
                world.rogiAI.spendFocus(rogi,1,'heist-last-score');
                world.rogiAI.event(rogi,'heist-last-score-agreed',{key:node.id,share:sharePercent});
                world.rogiAI.event(rogi,'companion-risk',{key:'goblin-toll',method:'diversion-last-score',dangerous:true,
                    actor:'rogi',initiator:'player',executor:'rogi',riskBearer:'rogi',consented:true,share:sharePercent});
                entry.rogi.agreement={accepted:true,sharePercent};
            } else {
                world.rogiAI.event(rogi,'heist-last-score-refused',{key:node.id});
                entry.rogi.agreement={accepted:false,reason:'personality-refusal'};
            }
        }
        if(useRogi) target=unopened[0];
        else if(strategy==='aggressive' && available('last-score-player')) {
            target=unopened[0]; state.gold-=15;
            rules.commitLastScore(heist,Number(target.id),'player'); state.playerFocus=heist.playerFocus;
            entry.resolution='last-score-player';
        } else if(strategy==='aggressive' && available('haggle-20')) {
            state.gold-=20; entry.resolution='haggle-20';
        } else if(available('hide')) {
            state.playerFocus-=2; heist.playerFocus=state.playerFocus; entry.resolution='hide';
        } else if(available('pay-30')) {
            state.gold-=30; entry.resolution='pay-30';
        } else if(available('give-scroll')) {
            state.inventory.sort((a,b)=>a.value-b.value); const lost=state.inventory.shift();
            entry.resolution={action:'give-scroll',lostValue:lost.value};
        } else {
            applyDamage(state,1,'flee',chestLog); entry.resolution='flee';
        }
        if(useRogi) entry.resolution='last-score-rogi';
        if(target) {
            const found=room.chests.find(chest=>chest.id===target.id);
            if(useRogi) {
                rules.commitLastScore(heist,Number(found.id),'rogi');
                heist.crisis.lastScore.share=sharePercent;
            }
            found.opened=true;
            let result=found.type;
            if(result==='dig') result=world.roll()<0.55?'scroll':'empty';
            let scroll=null;
            if(result==='scroll') scroll=addScroll(found,node,sharePercent);
            else if(result==='mimic') applyDamage(state,node.type==='ELITE'?2:1,'last-score-mimic',chestLog);
            rules.settleLastScore(heist);
            entry.resolution={action:entry.resolution||'last-score-rogi',target:found.id,result,sharePercent,scrollId:scroll?.id||null,value:scroll?.value||0};
            chestLog.push({floor:node.row+1,nodeId:node.id,chestId:found.id,source:useRogi?'rogi':'player',result,scrollId:scroll?.id||null,value:scroll?.value||0});
        }
        if(!entry.resolution) entry.resolution='exit';
        entry.after={gold:state.gold,hp:state.hp,playerFocus:state.playerFocus,rogiFocus:rogi.ai.focus,
            rogiHp:rogi.hp,inventory:state.inventory.map(item=>({...item}))};
        rules.clearCrisis(heist); rules.leaveRoom(heist);
        return true;
    }

    function runChestRoom(node) {
        const room=worldRoom(node);
        rules.enterRoom(heist,node.id,node.type);
        if(heist.guardedTreasury?.status==='available')
            guardedTreasuryEncounters.push({floor:node.row+1,nodeId:node.id,noise:heist.noise});
        const available=room.chests.slice();
        state.opened=0;
        while(available.length && state.alive) {
            const chest=available.shift();
            let actor='player',assessment=null;
            if(strategy==='rogi-assist'&&state.opened===0) {
                assessment=rogiChestAssessment(chest,'open');
                if(assessment.allowed) {
                    actor='rogi'; world.rogiAI.spendFocus(rogi,1,'open');
                    world.rogiAI.event(rogi,'companion-risk',{key:'unknown',method:'open',dangerous:false,
                        actor:'rogi',initiator:'player',executor:'rogi',riskBearer:'rogi',consented:true});
                }
            }
            const method=actor==='rogi'?'careful':strategyMethod(strategy,state);
            rules.recordAction(heist,method,actor);
            state.playerFocus=heist.playerFocus;
            chest.opened=true; state.opened++;
            let result=chest.type;
            if(result==='dig') result=(actor==='rogi'?world.rogiAI.roll(rogi,'dig-outcome'):world.roll())<0.55?'scroll':'empty';
            let scroll=null;
            if(result==='scroll') {
                if(actor==='rogi') { scroll=world.makeScroll(node.row+1,node.type==='ELITE'); rogiOwnScroll(scroll,node); }
                else scroll=addScroll(chest,node);
            } else if(result==='mimic') {
                if(actor==='rogi') hurtRogi(node.type==='ELITE'?2:1,chestLog,node,'player');
                else { applyDamage(state,node.type==='ELITE'?2:1,'mimic',chestLog); state.trust++; }
            }
            chestLog.push({floor:node.row+1,nodeId:node.id,chestId:chest.id,result,scrollId:scroll?.id||null,value:scroll?.value||0,method,actor,
                rogiAssessment:assessment?{allowed:assessment.allowed,reason:assessment.reason,scores:assessment.scores}:null});
            if(state.alive && node.type==='FIGHT' && rules.beginCrisis(heist)) {
                settleCrisis(node,room,available);
                return;
            }
            if(strategy==='cautious' && state.alive) break;
        }
        if(state.alive) rules.leaveRoom(heist);
        else rules.leaveRoom(heist);
    }

    function worldRoom(node) { return world.generateRoom({map:campaign.map,id:node.id}); }
    function applyEvent(node) {
        const event=world.drawEvent({gold:state.gold,hp:state.hp,trust:state.trust,rogi,
            scrolls:state.inventory,storyFlags:state.storyFlags}); if(!event) return;
        const eligible=event.choices.filter(choice=>!choice.disabled&&!choice.cost&&choice.healthCost<state.hp&&!choice.relicForced);
        if(!eligible.length) return;
        let selected=strategy==='aggressive'?eligible[0]:eligible[eligible.length-1];
        if(event.storyEvent) {
            const preferred=strategy==='aggressive'?['bluff','sign','counter','ask-clerk']
                :strategy==='rogi-assist'?['counter','ask-clerk','answer-honestly','sign']
                    :['leave','refuse','answer-honestly','counter'];
            selected=preferred.map(id=>eligible.find(choice=>choice.id===id)).find(Boolean)||selected;
        }
        const {result,cost,healthCost}=world.resolveEvent(selected.index,{gold:state.gold,hp:state.hp,trust:state.trust,rogi,
            scrolls:state.inventory,storyFlags:state.storyFlags});
        if(result.storyEvent) {
            state.gold=Math.max(0,state.gold+result.goldDelta);
            state.hp=Math.max(0,Math.min(state.maxHp,state.hp+result.hpDelta));
            state.trust=Math.max(-100,Math.min(100,state.trust+result.trustDelta));
            if(result.consumeScroll) state.inventory.shift();
            if(result.recordInspectorSuccess && rogi.active) {
                rogi.ai.seen['counterfeit-inspector-success']=true;
                world.rogiAI.event(rogi,'counterfeit-inspector-success',{
                    key:'casino-witness:bluff',source:'casino-witness',outcome:'success',week:1,dungeon:rogi.dungeon
                });
                world.queueCallback({active:rogi.active,ai:rogi.ai,gold:state.gold,hp:state.hp,trust:state.trust,
                    rogiFocus:rogi.ai.focus,scrolls:state.inventory,storyFlags:state.storyFlags});
            }
            if(result.eventId==='inspector-callback') {
                state.storyFlags.inspectorCallbackResolved=true;
                state.storyFlags.merchantSearchPending=result.merchantSearchPending===true;
            }
            if(result.rogiFocusDelta<0 && rogi.active) world.rogiAI.spendFocus(rogi,-result.rogiFocusDelta,'story-'+result.eventId);
            if(result.riskRefused && rogi.active) world.rogiAI.event(rogi,'two-rogues-risk-refused',{
                key:result.eventId,eventId:result.eventId,choiceId:result.choiceId,branch:result.branch||'none'
            });
            if(result.rogiFocusDelta<0 && rogi.active) world.rogiAI.event(rogi,'companion-risk',{
                key:'story-'+result.eventId,method:result.choiceId,dangerous:true,
                actor:'rogi',initiator:'player',executor:'rogi',riskBearer:'rogi',consented:true
            });
            if(result.hpDelta<0 && rogi.active) world.rogiAI.event(rogi,'player-hurt-due-to-deal',{
                key:result.eventId,eventId:result.eventId,actor:'player',initiator:'player',
                executor:'player',riskBearer:'player',causedBy:'story-deal'
            });
            if(rogi.active) {
            rogi.ai.seen['two-rogues-story:'+result.eventId]=true;
            world.rogiAI.event(rogi,'two-rogues-story',{
                key:result.eventId,eventId:result.eventId,choiceId:result.choiceId,
                outcome:result.outcome,branch:result.branch||'none',rogiDecision:result.rogiDecision,
                playerHurt:result.hpDelta<0,riskRefused:result.riskRefused
            });
            }
            if(state.hp<=0) state.alive=false;
            pathLog.at(-1).event={id:event.id,title:event.title,story:true,choice:selected.id,
                text:result.text,result:serializable(result),gold:state.gold,hp:state.hp,trust:state.trust};
            return;
        }
        state.gold=Math.max(0,state.gold-cost+Math.max(0,Number(result.gold)||0));
        state.hp=Math.min(state.maxHp,Math.max(0,state.hp-healthCost+(Number(result.hp)||0)));
        if(result.relic) {
            state.inventory.push(world.makeScroll(node.row+1,false));
        }
        if(state.hp<=0) state.alive=false;
        pathLog[pathLog.length-1].event={id:event.id,choice:selected.index,text:selected.text,result:serializable(result)};
    }

    function resolveRoom(node) {
        if(node.type==='FIGHT'||node.type==='ELITE'||node.type==='DIG') { runChestRoom(node); return; }
        rules.enterRoom(heist,node.id,node.type);
        if(node.type==='CAMP'||node.type==='CAMP_FINALE') {
            if(state.hp<state.maxHp) state.hp++;
            rules.restAtCamp(heist,node.id); state.playerFocus=heist.playerFocus;
            world.rogiAI.rest(rogi,true); rogi.hp=Math.min(rogi.maxHp,rogi.hp+1);
        } else if(node.type==='TREASURE') {
            const base=world.treasureBase();
            if(strategy==='aggressive' && world.greedyTreasureWins()) state.gold+=Math.round(base*2.5);
            else if(strategy==='aggressive') applyDamage(state,1,'greedy-treasure',chestLog);
            else state.gold+=base;
            pathLog[pathLog.length-1].treasure={base,gold:state.gold};
        } else if(node.type==='SHOP') {
            const shop=world.shopCash(state.storyFlags);
            state.storyFlags=shop.storyFlags;
            let wallet=shop.cash, sold=[];
            const initialWallet=wallet,rogiSales=sellRogiInventory(false,wallet);
            wallet=rogiSales.remainingWallet;
            if(state.gold<30) {
                for(let i=state.inventory.length-1;i>=0;i--) {
                    const item=state.inventory[i]; if(wallet<item.value) continue;
                    wallet-=item.value;
                    const share=Math.min(Math.floor(item.value*item.rogiSharePercent/100),item.value);
                    state.gold+=item.value-share; rogi.gold+=share; sold.push({value:item.value,rogiShare:share});
                    state.inventory.splice(i,1);
                    if(state.gold>=30) break;
                }
            }
            pathLog[pathLog.length-1].shop={initialWallet,reducedCashNotice:shop.reducedCashNotice,
                rogiSales:rogiSales.sales,sales:sold,remainingWallet:wallet};
        } else if(node.type==='EVENT') applyEvent(node);
        rules.leaveRoom(heist);
    }

    function chooseNext(candidates) {
        return candidates.slice().sort((a,b)=>routeScore(b.type,strategy,state)-routeScore(a.type,strategy,state)||a.col-b.col)[0];
    }

    for(let row=0;row<15 && state.alive;row++) {
        if(row>0) {
            const previous=visited[visited.length-1];
            const reachable=campaign.map.flat().filter(node=>previous.next.includes(node.id));
            if(!reachable.length) throw new Error('generated map has a dead end at '+previous.id);
            current=chooseNext(reachable);
        }
        visited.push(current);
        pathLog.push({floor:row+1,nodeId:current.id,col:current.col,type:current.type,goldBefore:state.gold,hpBefore:state.hp,focusBefore:state.playerFocus});
        world.rogiAI.roomTransition(rogi);
        resolveRoom(current);
        pathLog[pathLog.length-1].goldAfter=state.gold;
        pathLog[pathLog.length-1].hpAfter=state.hp;
        pathLog[pathLog.length-1].focusAfter=state.playerFocus;
        if(firstCrisis && !firstCrisis.after) firstCrisis.after={gold:state.gold,hp:state.hp,playerFocus:state.playerFocus,rogiFocus:rogi.ai.focus,rogiHp:rogi.hp};
        if(!state.alive) outcome={status:'game-over',reason:'death',floor:row+1};
    }

    if(state.alive) {
        const bossNode=campaign.map[campaign.map.length-1][0];
        world.rogiAI.roomTransition(rogi);
        pathLog.push({floor:16,nodeId:bossNode.id,col:bossNode.col,type:'BOSS',goldBefore:state.gold,hpBefore:state.hp,focusBefore:state.playerFocus});
        let bossHp=3,round=0;
        while(bossHp>0&&state.alive&&round<30) {
            const wave=world.randomBossWave();
            for(const type of wave) {
                const result=type;
                if(result==='scroll') bossHp--;
                else applyDamage(state,2,'boss-mimic',chestLog);
                chestLog.push({floor:16,nodeId:bossNode.id,chestId:String(round)+':'+String(chestLog.length),result,bossHp});
                if(!state.alive||bossHp<=0) break;
            }
            round++;
        }
        if(state.alive&&bossHp<=0) {
            state.gold+=150;
            const soldAtExit=state.inventory.length;
            for(const item of state.inventory) {
                const gross=Math.floor(item.value/2),share=Math.floor(gross*item.rogiSharePercent/100);
                state.gold+=gross-share; rogi.gold+=share;
            }
            state.inventory=[];
            const rogiExitSales=sellRogiInventory(true);
            const playerBeforeRent=state.gold;
            const playerPaidRent=state.gold>=300;
            if(playerPaidRent) state.gold-=300;
            const rogiPaidDebt=playerPaidRent&&rogi.gold>=300;
            if(rogiPaidDebt) rogi.gold-=300;
            outcome={status:playerPaidRent?'week-complete':'game-over',reason:playerPaidRent?'rent-paid':'rent-shortfall',
                bossRounds:round,playerPaidRent,playerRentDue:300,playerGoldBeforeRent:playerBeforeRent,playerGoldAfterRent:state.gold,
                rogiDebtDue:300,rogiPaidDebt,rogiGoldRemaining:rogi.gold,rogiLeaves:playerPaidRent&&!rogiPaidDebt,
                scrollsSoldAtExit:soldAtExit,rogiExitSales:rogiExitSales.sales};
            if(playerPaidRent) {
                const companion={...rogi,settlement:null};
                world.rogiAI.endDungeon(companion,{atExit:true,final:true,playerAvailable:state.gold});
            }
        } else if(!state.alive) outcome={status:'game-over',reason:'boss-death',floor:16,bossHp};
        pathLog.at(-1).goldAfter=state.gold; pathLog.at(-1).hpAfter=state.hp; pathLog.at(-1).bossHp=bossHp;
    }

    const lostScrolls=!state.alive?state.inventory.length:0;
    if(!state.alive) state.inventory=[];
    return serializable({naturalCampaignRun:true,seed:String(seed),strategy,week:1,mode:'B1',start:{...DEFAULT_START},
        rogi:{seed:rogi.ai.seed,profile:rogi.ai.profile,focus:rogi.ai.focus,hp:rogi.hp,gold:rogi.gold,trust:0,
            decisions:rogi.ai.timeline,decisionLog:rogi.ai.decisionLog},map:campaign.map,
        mapConnections,path:pathLog,chests:chestLog,firstCrisis,crises:crisisLog,
        guardedTreasury:{available:guardedTreasuryEncounters.length>0,opportunities:guardedTreasuryEncounters},outcome,
        final:{gold:state.gold,hp:state.hp,playerFocus:state.playerFocus,rogiGold:rogi.gold,rogiFocus:rogi.ai.focus,
            rogiHp:rogi.hp,rogiInventory:rogi.inventory,inventory:state.inventory,lostScrollsOnDeath:lostScrolls,playerDebtDue:300,rogiDebtDue:300}});
}

function runNaturalScenarios({seeds,strategies=['cautious','aggressive','rogi-assist']}={}) {
    if(!Array.isArray(seeds)||!seeds.length) throw new TypeError('at least one generated seed is required');
    return strategies.flatMap(strategy=>seeds.map(seed=>runNaturalScenario({seed:String(seed),strategy})));
}

module.exports={createGeneratedCampaign,runNaturalScenario,runNaturalScenarios};
