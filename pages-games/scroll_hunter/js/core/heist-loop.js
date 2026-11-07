/* ================================================================
   SCROLL HUNTER · experimental heist loop
   Revert point: set HEIST_LOOP_ENABLED to false to restore ordinary
   player chest opening in FIGHT rooms.
   ================================================================ */
'use strict';

const HEIST_LOOP_ENABLED = true;
const HEIST_LOOP_RULES = ScrollHunterHeistRules.config;
const HeistRules = ScrollHunterHeistRules.rules;
const TEAM_HEIST_PLANS = ScrollHunterHeistRules.teamHeistPlans;
const TEAM_HEIST_TERMS = ScrollHunterHeistRules.teamHeistTerms;
const teamHeistTermsForPlan = ScrollHunterHeistRules.teamHeistTermsForPlan;
const teamHeistAvailable = ScrollHunterHeistRules.teamHeistAvailable;
const teamHeistCounterTerm = ScrollHunterHeistRules.teamHeistCounterTerm;
const teamHeistDetectionChance = ScrollHunterHeistRules.teamHeistDetectionChance;

let heistState = HeistRules.createState();
const HeistLoop = (() => {
    function active() {
        return HEIST_LOOP_ENABLED && !!currentNode && currentNode.type === 'FIGHT' &&
            heistState.roomId === String(currentNode.id);
    }
    function resetRun() { heistState = HeistRules.createState(); heistState.mode = heistMode === 'B1' ? 'B1' : 'A'; }
    function enterRoom(node) {
        if (!HEIST_LOOP_ENABLED) { heistState = HeistRules.createState(); return; }
        HeistRules.enterRoom(heistState, node?.id, node?.type);
        if (heistState.guardedTreasury?.roomId === String(node?.id) && heistState.guardedTreasury.status === 'available')
            lastEvent = 'Часовой обходит сокровищницу. Тревога уже ' + heistState.noise + '/' + HEIST_LOOP_RULES.alertAt + '; грубый взлом может поднять тревогу сразу.';
    }
    function snapshot() { return JSON.parse(JSON.stringify(heistState)); }
    function restore(data) { heistState = HeistRules.restore(data); heistMode = heistState.mode; }
    function focus() { return heistState.playerFocus; }
    function noise() { return heistState.noise; }
    function beforeOpen(method = 'careful', actor = 'player') {
        if (!active()) return true;
        const result = HeistRules.recordAction(heistState, method, actor);
        if (!result.ok) {
            lastEvent = 'Для аккуратного взлома нужен 1 пункт личного фокуса.';
            updateUI();
            return false;
        }
        return true;
    }
    function noteResolution() {
        if (!active()) return false;
        if (HeistRules.beginCrisis(heistState)) {
            gameState = STATES.HEIST_CRISIS;
            selected = -1;
            lastEvent = heistState.mode === 'B1'
                ? 'Гоблин-сборщик пошлины услышал шум: «За незаконное вскрытие — тариф. И не спорьте, я сам его утвердил».'
                : 'Слишком громкий шум привлёк обитателя подземелья.';
            if (companion.active) companion.line = heistState.mode === 'B1'
                ? 'Он сам придумал этот тариф и называет его официальным. Удивительно.'
                : 'Тише. Слышишь? Кажется, нас услышали.';
            if (companion.active) RogiAI.event(companion, 'heist-crisis', { key: currentNodeId, noise: heistState.noise });
            updateUI();
            return true;
        }
        if (!['careful','rough'].includes(heistState.lastMethod)) return false;
        const line = heistState.lastMethod === 'careful'
            ? 'Тихий взлом не привлёк лишнего внимания.'
            : 'Грохот замка разносится по комнате. Тревога ' + heistState.noise + '/' + HEIST_LOOP_RULES.alertAt + '.';
        if (lastEvent) lastEvent += ' ' + line; else lastEvent = line;
        if (companion.active && heistState.lastMethod === 'rough')
            companion.line = 'Если план был разбудить весь этаж — поздравляю.';
        else if (companion.active && heistState.lastMethod === 'careful')
            companion.line = 'Тихо и чисто. Давай не будем испытывать удачу дважды.';
        return false;
    }
    function enterCrisis() { return HeistRules.beginCrisis(heistState); }
    function resolve(action, value, source) {
        if (!heistState.crisis || gameState !== STATES.HEIST_CRISIS) return false;
        if (action === 'guarded-heist-continue') {
            if (heistState.crisis.scene !== 'guarded-treasury' || heistState.crisis.view !== 'treasury-briefing') return false;
            heistState.crisis.view = 'team-plan'; updateUI(); return true;
        }
        if (action === 'guarded-heist-decline') return declineGuardedTreasury();
        if (action === 'last-score') {
            if (!HeistRules.canStartLastScore(heistState,
                chests.filter(item => !item.opened && !item.destroyed).length,gold)) return false;
            heistState.crisis.view = 'targets'; updateUI(); return true;
        }
        if (action === 'last-score-target') return beginLastScoreTarget(value, source || 'player');
        if (action === 'last-score-rogi') return requestRogiLastScore();
        if (action === 'team-heist') return openTeamHeistPlans();
        if (action === 'team-heist-plan') return selectTeamHeistPlan(value);
        if (action === 'team-heist-offer') return offerTeamHeistTerms(value);
        if (action === 'team-heist-counter-accept') return acceptTeamHeistCounter();
        if (action === 'team-heist-counter-decline') return declineTeamHeistCounter();
        if (action === 'team-heist-target') return commitTeamHeistTarget(value);
        if (action === 'team-heist-back') return backOutOfTeamHeist();
        if (action === 'resume-team-heist') return startCommittedTeamHeist();
        if (action === 'last-score-back') {
            if (heistState.crisis.lastScore) return false;
            heistState.crisis.rogiOfferPending = false;
            heistState.crisis.rogiDealPending = false;
            heistState.crisis.view = 'main'; updateUI(); return true;
        }
        if (['rogi-deal-accept','rogi-deal-counter','rogi-deal-decline'].includes(action)) {
            const crisis = heistState.crisis;
            if (!crisis?.rogiOfferPending || crisis.view !== 'rogi-terms') return false;
            if (action === 'rogi-deal-decline') {
                crisis.rogiOfferPending = false;
                crisis.view = 'main';
                companion.line = 'Ладно. Решай сам, как будем выбираться.';
                lastEvent = 'Вы отказались от условий Роги. Фокус не потрачен.';
                updateUI(); return true;
            }
            if (!RogiAI.spendFocus(companion,1,'heist-last-score')) return false;
            crisis.rogiSharePercent = action === 'rogi-deal-counter' ? 25 : 50;
            crisis.rogiOfferPending = false;
            crisis.rogiDealPending = true;
            crisis.view = 'targets';
            companion.line = crisis.rogiSharePercent === 25
                ? 'Четверть выручки. Ладно, но только потому что ты предложил честно.'
                : 'Половина выручки. Договорились.';
            lastEvent = 'Условия сделки приняты. Доля будет выплачена только из фактической продажи свитка.';
            RogiAI.event(companion,'heist-last-score-agreed',{key:currentNodeId,share:crisis.rogiSharePercent});
            RogiAI.event(companion,'companion-risk',{key:'goblin-toll',method:'diversion-last-score',dangerous:true,
                actor:'rogi',initiator:'player',executor:'rogi',riskBearer:'rogi',consented:true,share:crisis.rogiSharePercent});
            saveRunCheckpoint(); updateUI(); return true;
        }
        if (action === 'escape-options') { heistState.crisis.view = 'escape'; updateUI(); return true; }
        if (action === 'crisis-back') { heistState.crisis.view = 'main'; updateUI(); return true; }
        if (action === 'resume-last-score') return startCommittedLastScore();
        if (action === 'haggle') {
            const offer = Math.max(0,Math.floor(Number(value)||0));
            if (heistState.crisis.mode !== 'B1' || offer > gold || offer < 1) return false;
            const accepted = offer >= 20;
            if (accepted) {
                gold -= offer;
                HeistRules.clearCrisis(heistState);
                lastEvent = 'Сборщик пересчитал предложенные ' + offer + ' зол. и нехотя освободил проход.';
            } else {
                lastEvent = 'Сборщик отодвинул ' + offer + ' зол.: «Маловато. Приходи с двадцатью».';
                if (companion.active) companion.line = 'Он назвал нижнюю цену. Решай, принимаешь её или выбираешь другой выход.';
                updateUI();
                return true;
            }
            finishCrisis(); return true;
        }
        if (action === 'hide') {
            if (heistState.playerFocus < HEIST_LOOP_RULES.hideCost) return false;
            heistState.playerFocus -= HEIST_LOOP_RULES.hideCost;
            HeistRules.clearCrisis(heistState);
            lastEvent = heistState.mode === 'B1'
                ? 'Вы переждали, пока сборщик пошлины ушёл искать нарушителей с более громкими замками. Личный фокус −2.'
                : 'Вы затаились, дождались ухода монстра и выбрались из комнаты. Личный фокус −2.';
            if (companion.active) companion.line = 'Уходим тихо. И больше не называй это «планом».';
            finishCrisis();
            return true;
        }
        if (action === 'scroll') {
            if (!scrollInventory.length) return false;
            const index = scrollInventory.reduce((best, item, i, list) => item.price < list[best].price ? i : best, 0);
            const [lost] = scrollInventory.splice(index, 1);
            if (typeof HeistLoop.noteTeamHeistNoSale === 'function') HeistLoop.noteTeamHeistNoSale(lost,'collector-toll');
            const name = SCROLL_TYPES.find(item => item.id === lost.id)?.name || 'свиток';
            HeistRules.clearCrisis(heistState);
            lastEvent = heistState.mode === 'B1'
                ? 'Вы отдали сборщику ' + name + '. Он сверил его с «тарифной сеткой» и разрешил уйти.'
                : 'Вы бросили монстру ' + name + ' и выбрались, пока он отвлёкся. Свиток потерян.';
            if (companion.active) companion.line = heistState.mode === 'B1'
                ? 'Он забрал свиток и всё ещё требует расписаться в книге, которой у него нет.'
                : 'Свиток ему понравился. Я бы выбрала золото.';
            finishCrisis();
            return true;
        }
        if (action === 'gold') {
            if (gold < HEIST_LOOP_RULES.bribeGold) return false;
            gold -= HEIST_LOOP_RULES.bribeGold;
            HeistRules.clearCrisis(heistState);
            lastEvent = heistState.mode === 'B1'
                ? 'Гоблин взял пошлину ' + HEIST_LOOP_RULES.bribeGold + ' зол. и заверил, что квитанция будет воображаемой.'
                : 'Монстр забрал ' + HEIST_LOOP_RULES.bribeGold + ' золотых. Вы выбрались из комнаты.';
            if (companion.active) companion.line = heistState.mode === 'B1'
                ? 'Тридцать? Официальный тариф — пятнадцать. Он даже печать рисует от руки.'
                : 'Дорого вышло. Надеюсь, он умеет считать.';
            finishCrisis();
            return true;
        }
        if (action === 'rogi') return askRogiToDistract();
        if (action === 'flee') {
            if (!chests.some(item => item.opened && !item.destroyed)) return false;
            HeistRules.clearCrisis(heistState);
            lastEvent = heistState.mode === 'B1'
                ? 'Вы вырвались из комнаты, потеряв 1 ♥. Гоблин кричит вслед, что это ещё не последний сбор.'
                : 'Вы вырвались из комнаты, потеряв 1 ♥. В следующий раз отвлекать монстра будешь ты.';
            if (companion.active) companion.line = rogiTrust < 0
                ? 'Я предупреждала, что греметь не стоит. Не смотри на меня.'
                : heistState.mode === 'B1' ? 'В следующий раз торговаться будешь ты.' : 'В следующий раз отвлекать монстра будешь ты.';
            hp--;
            gameState = STATES.CHOOSE;
            if (resolvePlayerDeath('Монстр настиг вас при бегстве.', () => leaveRoom())) return true;
            leaveRoom();
            return true;
        }
        return false;
    }
    function openTeamHeistPlans() {
        const crisis = heistState.crisis;
        const unopened = chests.filter(item => !item.opened && !item.destroyed).length;
        if (!crisis || crisis.mode !== 'B1' || crisis.teamHeistTried || !companionAvailable() || unopened < 1) return false;
        crisis.view = 'team-plan'; updateUI(); return true;
    }
    function selectTeamHeistPlan(planId) {
        const crisis = heistState.crisis, ai = companion.active ? RogiAI.ensure(companion) : null;
        const unopened = chests.filter(item => !item.opened && !item.destroyed).length;
        if (!crisis || crisis.view !== 'team-plan' || !TEAM_HEIST_PLANS[planId] || !ai ||
            !teamHeistAvailable(heistState,{planId,unopened,companionActive:companion.active,companionHp:companion.hp,companionFocus:ai.focus})) {
            lastEvent = 'Для аферы обоим нужен хотя бы 1 фокус, а Роги должна быть в строю.'; updateUI(); return false;
        }
        crisis.teamHeistDraft = { planId };
        crisis.view = 'team-terms';
        const plan = TEAM_HEIST_PLANS[planId];
        companion.line = plan.opener === 'rogi'
            ? 'Я вскрываю, ты отвлекаешь. Сразу договоримся, кому достанется находка.'
            : 'Я отвлекаю сборщика, ты вскрываешь. И давай заранее решим, кому свиток.';
        lastEvent = crisis.scene === 'guarded-treasury'
            ? 'В сокровищнице: выберите распределение добычи до риска. Оба потратят по 1 фокусу; тревога не вырастет, если вас не заметят.'
            : 'План выбран. Сначала назовите условия, потом оба примут на себя риск.';
        saveRunCheckpoint(); updateUI(); return true;
    }
    function offerTeamHeistTerms(termId) {
        const crisis = heistState.crisis, planId = crisis?.teamHeistDraft?.planId;
        const plan = TEAM_HEIST_PLANS[planId], term = TEAM_HEIST_TERMS[termId];
        if (!crisis || crisis.view !== 'team-terms' || !plan || !term ||
            !teamHeistTermsForPlan(planId).some(item=>item.id===termId)) return false;
        const ai = RogiAI.ensure(companion);
        if (ai.promises.risk?.status === 'active' || ai.promises.noKnownDanger?.status === 'active') {
            if (crisis.scene === 'guarded-treasury') {
                const reason=ai.promises.risk?.status === 'active'
                    ? 'Ты обещал принять следующий риск на себя. Я не буду отвлекать часового.'
                    : 'Ты обещал не втягивать меня в известную опасность. Я останусь у выхода.';
                RogiAI.event(companion,'team-heist-refused',{key:currentNodeId,reason:'active-promise',plan:planId,terms:termId});
                return declineGuardedTreasury('refused',reason+' Обычный способ остался доступен.');
            }
            crisis.teamHeistTried = true; crisis.teamHeistDraft = null; crisis.view = 'main';
            companion.line = ai.promises.risk?.status === 'active'
                ? 'Ты обещал принять следующий риск на себя. Сегодня без меня.'
                : 'Ты обещал не втягивать меня в известную опасность. Я останусь здесь.';
            lastEvent = companion.line + ' Остальные способы выбраться остались.';
            RogiAI.event(companion,'team-heist-refused',{key:currentNodeId,reason:'active-promise',plan:planId,terms:termId});
            saveRunCheckpoint(); updateUI(); return true;
        }
        const ownerOf = candidate => candidate.owner === 'opener' ? plan.opener : candidate.owner;
        const financial = RogiAI.syncFinances(companion);
        const modifiers=RogiAI.collectModifiers(ai.profile);
        const greed=modifiers.situational.greed||0, resentment=modifiers.situational.resentment||0;
        const priorReads=ai.memory.filter(item=>item.type==='team-heist-no-sale'&&item.detail?.reason==='read')
            .reduce((total,item)=>total+(item.count||1),0);
        const priorBreaches=ai.memory.filter(item=>item.type==='team-heist-contract-broken')
            .reduce((total,item)=>total+(item.count||1),0);
        const priorSales=ai.memory.filter(item=>item.type==='team-heist-sale-settled'&&Number(item.detail?.sharePaid)>0)
            .reduce((total,item)=>total+(item.count||1),0);
        const planRisk=(plan.opener==='rogi'?1:0.65)+(plan.distractor==='rogi'?0.35:0);
        const healthRisk=companion.hp<=1?28:companion.hp===2?12:0;
        const focusRisk=ai.focus<=1?10:ai.focus===2?4:0;
        const exposure=healthRisk+focusRisk+Math.max(0,heistState.noise-1)*2;
        const playerExposure=plan.opener==='player'?(hp<=1?20:hp===2?9:0):0;
        const playerDistractionExposure=plan.distractor==='player'
            ? (hp<=1?20:hp===2?9:0)+(heistState.playerFocus<=1?10:heistState.playerFocus===2?4:0) : 0;
        const playerRisk=(playerExposure+playerDistractionExposure)*
            (0.35+(modifiers.situational.loyalty||0)/220+ai.dimensions.cooperation/240);
        const personalRisk=exposure*planRisk+playerRisk;
        const contractValue=candidate=>{
            const owner=ownerOf(candidate);
            const cashNeed=clamp((companion.debt-companion.gold)/Math.max(1,companion.debt),0,1);
            let value=owner==='rogi'?12+cashNeed*8: candidate.sharePercent?4+cashNeed*5:-11;
            if(candidate.sharePercent&&priorReads)value-=Math.min(18,priorReads*7);
            if(candidate.sharePercent&&priorSales)value+=Math.min(8,priorSales*2);
            if(owner==='rogi')value+=greed*.08;
            return value;
        };
        const offerValue=contractValue(term);
        const counterTerms=teamHeistTermsForPlan(planId).filter(candidate=>candidate.id!==termId);
        const actions = [
            {id:'accept-deal',base:37+offerValue-personalRisk*.62+greed*(ownerOf(term)==='rogi'?.12:-.06)-resentment*.16+
                    (modifiers.situational.loyalty||0)*(plan.distractor==='rogi'?.08:.04),
                traitWeights:{cooperation:.24,generosity:.15,courage:.12,sensitivity:.12,pragmatism:.1,caution:-.08},
                tags:['deal','help','fair-deal','share','choice'],needWeight:{closeness:.1,fairness:.14,debt:.08},trustWeight:.48,
                reason:'условия и риск приняты'},
            {id:'refuse',base:26+personalRisk*.92+(modifiers.situational.fear||0)*.16+resentment*.12+priorBreaches*2,
                traitWeights:{caution:.45,independence:.24,courage:-.1,cooperation:-.1},tags:['refuse','safe','choice'],needWeight:{safety:.18},trustWeight:-.12,
                reason:priorBreaches?'прошлый договор был нарушен':'опасность слишком велика'}
        ];
        counterTerms.forEach(candidate=>{
            const candidateOwner=ownerOf(candidate),candidateValue=contractValue(candidate);
            const countersReadLoop=priorReads>0&&term.sharePercent>0&&candidateOwner==='rogi';
            const countersBrokenDeal=priorBreaches>0&&candidateOwner==='rogi';
            actions.push({id:'counter:'+candidate.id,
                base:13+candidateValue*.35+Math.max(0,candidateValue-offerValue)*.12+
                    (countersReadLoop?10+Math.min(10,priorReads*3):0)+(countersBrokenDeal?18:0)+
                    greed*(candidateOwner==='rogi'?.14:.02),
                traitWeights:candidateOwner==='rogi'
                    ? {pragmatism:.36,generosity:-.2,cooperation:-.18,independence:.25,sensitivity:-.1}
                    : {pragmatism:.18,generosity:.25,cooperation:.24,independence:-.08,sensitivity:.12},
                tags:candidateOwner==='rogi'?['deal','keep','bargain','choice']:['deal','share','bargain','fair-deal'],
                needWeight:{debt:.18,fairness:.12},
                reason:countersBrokenDeal?'после нарушения Роги требует владение находкой':
                    countersReadLoop?'доля от продажи уже не кажется надёжной':
                    candidateOwner==='rogi'?'просит закрепить находку за собой':'предлагает более честный раздел'});
        });
        const pick = RogiAI.choose(companion,actions,{decisionKind:'team-heist-contract',trust:rogiTrust,tone:'negotiation',financial,
            debt:companion.debt,playerHp:hp,companionHp:companion.hp,companionFocus:ai.focus,roomThreat:heistState.noise,
            riskBearer:plan.opener,distractor:plan.distractor,teamHeistPlan:planId,offeredTerms:termId,
            priorReadWithoutSale:priorReads,priorContractBreaches:priorBreaches,openingRisk:personalRisk,
            priorPaidSales:priorSales,guardedTreasury:crisis.scene==='guarded-treasury'});
        crisis.teamHeistTried = true;
        RogiAI.event(companion,'team-heist-offer',{key:currentNodeId,plan:planId,terms:termId,decision:pick?.id||'refuse',riskBearer:plan.opener});
        if (pick?.id === 'refuse') {
            if (crisis.scene === 'guarded-treasury') {
                declineGuardedTreasury('refused',lastEvent);
                RogiAI.event(companion,'team-heist-refused',{key:currentNodeId,plan:planId,terms:termId,reason:'utility-risk'});
                return true;
            }
            crisis.teamHeistDraft = null; crisis.view = 'main';
            companion.line = RogiAI.voice(companion,'refusal',{reason:'danger'},'Нет. Сегодня я в этой афере не участвую. Выбирай обычный выход.');
            lastEvent = companion.line + ' Фокус не потрачен; остальные варианты остались.';
            RogiAI.event(companion,'team-heist-refused',{key:currentNodeId,plan:planId,terms:termId});
            saveRunCheckpoint(); updateUI(); return true;
        }
        if (pick?.id?.startsWith('counter:')) {
            const counterTermId=pick.id.slice('counter:'.length);
            crisis.teamHeistDraft = {planId,offeredTermId:termId,counterTermId};
            crisis.view = 'team-counter';
            const counterTerm=TEAM_HEIST_TERMS[counterTermId],counterOwner=ownerOf(counterTerm);
            companion.line = counterOwner==='rogi'?'Я не хочу рассчитывать на будущую продажу. Отдай находку мне по договору.'
                : counterTerm.sharePercent?'Свиток остаётся у тебя, но четверть — только с продажи.':'Пусть в этот раз находка останется за тобой.';
            lastEvent = 'Роги меняет условия: '+pick.reason+'. Можно принять или отказаться без потери фокуса.';
            RogiAI.event(companion,'team-heist-counteroffer',{key:currentNodeId,plan:planId,offered:termId,counter:counterTerm.id,
                reason:pick.reason,priorReadWithoutSale:priorReads,priorContractBreaches:priorBreaches});
            saveRunCheckpoint(); updateUI(); return true;
        }
        return acceptTeamHeistTerms(planId,termId);
    }
    function acceptTeamHeistTerms(planId,termId) {
        const crisis = heistState.crisis, plan = TEAM_HEIST_PLANS[planId], term = TEAM_HEIST_TERMS[termId];
        if (!crisis || !plan || !term || !teamHeistTermsForPlan(planId).some(item=>item.id===termId)) return false;
        const dealId = 'team-heist-' + String(currentNodeId || 'room') + '-' + heistState.actions + '-' + (companion.ai.eventNo + 1);
        crisis.teamHeist = {id:dealId,planId,termId,scope:crisis.scene==='guarded-treasury'?'guarded-treasury':'crisis',committed:false,settled:false};
        crisis.teamHeistDraft = null; crisis.view = 'team-targets';
        const owner = term.owner === 'opener' ? plan.opener : term.owner;
        companion.line = owner === 'rogi' ? 'Договорились. Если сундук что-то хранит, по договору это моё.'
            : term.sharePercent ? 'Договорились: свиток твой, мне причитается доля только с продажи.'
                : 'Ладно. Находка твоя, если там вообще что-то есть.';
        lastEvent = 'Договор заключён до риска. Оба потратят по 1 фокусу; мимик кусает того, кто вскрывал.';
        RogiAI.event(companion,'team-heist-agreement-made',{key:dealId,plan:planId,terms:termId,owner,sharePercent:term.sharePercent||0});
        saveRunCheckpoint(); updateUI(); return true;
    }
    function acceptTeamHeistCounter() {
        const crisis=heistState.crisis,draft=crisis?.teamHeistDraft;
        if(!crisis||crisis.view!=='team-counter'||!draft)return false;
        RogiAI.event(companion,'team-heist-counter-accepted',{key:currentNodeId,terms:draft.counterTermId});
        return acceptTeamHeistTerms(draft.planId,draft.counterTermId);
    }
    function declineTeamHeistCounter() {
        const crisis=heistState.crisis,draft=crisis?.teamHeistDraft;
        if(!crisis||crisis.view!=='team-counter'||!draft)return false;
        const guarded=crisis.scene==='guarded-treasury';
        if (guarded) return declineGuardedTreasury('declined','Вы отклонили встречные условия. Фокус не потрачен; можно действовать обычным способом.');
        crisis.teamHeistDraft=null;crisis.view='main';
        companion.line='Тогда без аферы. Выбирай другой выход.';
        lastEvent='Встречное предложение отклонено. Ресурсы не потрачены; обычные выходы доступны.';
        RogiAI.event(companion,'team-heist-counter-declined',{key:currentNodeId,plan:draft.planId});
        saveRunCheckpoint();updateUI();return true;
    }
    function backOutOfTeamHeist() {
        const crisis=heistState.crisis;
        if(!crisis||!['team-plan','team-terms','team-counter','team-targets'].includes(crisis.view))return false;
        if(crisis.teamHeist?.committed)return false;
        if(crisis.teamHeist) { RogiAI.event(companion,'team-heist-deal-withdrawn',{key:crisis.teamHeist.id}); crisis.teamHeist=null; }
        if(crisis.scene==='guarded-treasury') {
            crisis.teamHeistDraft=null;crisis.view='treasury-briefing';lastEvent='План отменён до риска. Сокровищница остаётся доступна.';
            updateUI();return true;
        }
        crisis.teamHeistDraft=null;crisis.view='main';lastEvent='Вы отказались от совместной аферы. Остальные варианты доступны.';
        updateUI();return true;
    }
    function commitTeamHeistTarget(index) {
        const crisis=heistState.crisis,deal=crisis?.teamHeist,plan=TEAM_HEIST_PLANS[deal?.planId],chest=chests[index];
        const ai=companion.active?RogiAI.ensure(companion):null;
        const unopened=chests.filter(item=>!item.opened&&!item.destroyed).length;
        if(!crisis||crisis.view!=='team-targets'||!deal||deal.committed||!plan||!chest||chest.opened||chest.destroyed||!ai||
            !teamHeistAvailable(heistState,{planId:plan.id,unopened,companionActive:companion.active,companionHp:companion.hp,companionFocus:ai.focus}))return false;
        const distractorHp=plan.distractor==='player'?hp:companion.hp;
        const distractorFocus=plan.distractor==='player'?heistState.playerFocus:ai.focus;
        const chance=teamHeistDetectionChance({distractorHp,distractorFocus});
        const roll=RogiAI.roll(companion,'team-heist-detection');
        if(!RogiAI.spendFocus(companion,HEIST_LOOP_RULES.teamHeistFocusCost,'team-heist-'+plan.id))return false;
        if(!HeistRules.commitTeamHeist(heistState,{id:deal.id,planId:deal.planId,termId:deal.termId,target:index,
            detectionChance:chance,detectionRoll:roll,scope:deal.scope}))return false;
        selected=index;
        RogiAI.event(companion,'team-heist-committed',{key:deal.id,target:index,plan:plan.id,opener:plan.opener,distractor:plan.distractor,
            detectionChance:chance,detectionRoll:roll});
        RogiAI.event(companion,'companion-risk',{key:deal.id,method:'team-heist',actor:plan.opener==='rogi'?'rogi':plan.distractor,
            initiator:'player',executor:plan.opener,riskBearer:plan.opener,distractor:plan.distractor,consented:true,plan:plan.id});
        companion.line=plan.opener==='rogi'?'Расскажу сборщику о пошлине на кражу. Ты пока проверь замок.':'Я заговорю со сборщиком. Ты проверь, что сундук не кусается.';
        lastEvent=deal.scope==='guarded-treasury'
            ? 'Роги заговорила сборщика пошлиной на краденое. План стоит вам обоим по 1 фокусу; шанс, что вас заметят, '+Math.round(chance*100)+'%.'
            : 'План стоит вам обоим по 1 фокусу; риск обнаружения — '+Math.round(chance*100)+'%.';
        saveRunCheckpoint();
        return startCommittedTeamHeist();
    }
    function startCommittedTeamHeist() {
        const deal=heistState.crisis?.teamHeist;
        if(!deal?.committed||deal.settled)return false;
        if(deal.detected)return resolveTeamHeistDetection();
        const plan=TEAM_HEIST_PLANS[deal.planId],chest=chests[deal.target];
        if(!plan||!chest||chest.destroyed||chest.opened)return false;
        chest.actor=plan.opener;chest.method='careful';
        gameState=STATES.CHOOSE;openChest(deal.target);
        return gameState===STATES.OPENING;
    }
    function resolveTeamHeistDetection() {
        const deal=heistState.crisis?.teamHeist,plan=TEAM_HEIST_PLANS[deal?.planId];
        if(!deal?.committed||deal.settled||!deal.detected||!plan)return false;
        settleTeamHeist('detected',{distractor:plan.distractor});
        if (deal.scope === 'guarded-treasury') HeistRules.finishGuardedTreasury(heistState,'detected');
        companion.line=plan.distractor==='rogi'?'Сборщик меня заметил. Уходим, пока он не выписал ещё и штраф за бег.':'Он заметил тебя. Сундук подождёт, жизнь — нет.';
        lastEvent=plan.distractor==='rogi'
            ? 'Сборщик раскусил отвлечение. У каждого ушёл 1 фокус; Роги потеряла 1 ♥.'
            : 'Сборщик раскусил отвлечение. У каждого ушёл 1 фокус; вы потеряли 1 ♥.';
        if(plan.distractor==='rogi') hurtCompanion(1);
        else { hp--; gameState=STATES.CHOOSE; if(resolvePlayerDeath('Гоблин поймал вас во время аферы.',()=>leaveRoom()))return true; }
        if(![STATES.GAME_OVER,STATES.VICTORY].includes(gameState)) { gameState=STATES.CHOOSE;leaveRoom(); }
        return true;
    }
    function settleTeamHeist(outcome,detail={}) {
        const deal=heistState.crisis?.teamHeist;
        if(!deal?.committed||deal.settled)return false;
        deal.settled=true;deal.outcome=outcome;
        if(outcome==='detected') RogiAI.event(companion,'team-heist-aborted',{key:deal.id,cause:'collector-detected',...detail});
        else if(outcome==='mimic') RogiAI.event(companion,'team-heist-mimic',{key:deal.id,plan:deal.planId,terms:deal.termId,...detail});
        else if(outcome==='empty') RogiAI.event(companion,'team-heist-no-loot',{key:deal.id,plan:deal.planId,terms:deal.termId});
        else {
            RogiAI.event(companion,'team-heist-kept',{key:deal.id,outcome,plan:deal.planId,terms:deal.termId,...detail});
            if(outcome==='scroll-found') bumpTrust(2);
        }
        const humor=RogiAI.collectModifiers(companion.ai.profile).situational.humor||0;
        const quip=['empty','scroll-found'].includes(outcome) &&
            RogiAI.roll(companion,'team-heist-quip')<Math.max(.12,Math.min(.68,.2+humor/140));
        if(outcome==='empty') companion.line=quip
            ? detail.distractor==='rogi'?'Я отвлекала сборщика от тебя, а ты отвлёк меня пустым сундуком.':'Я обсуждала с гоблином налоги на кражу. Сундук оказался налоговой льготой: пустой.'
            : 'Сундук пуст. Договор выполнен, добычи нет.';
        else if(outcome==='scroll-found') companion.line=quip
            ? detail.owner==='rogi'?'Находка моя по договору. Удивительно, как быстро бумага стала полезнее отмычки.':'Свиток твой. Моя четверть появится только если ты продашь его, а не прочитаешь.'
            : detail.owner==='rogi'?'Находка моя по договору.':'Свиток твой по договору; доля положена только с продажи.';
        else if(outcome==='mimic') companion.line=detail.opener==='rogi'
            ? 'Сборщик отвлёкся. Сундук — нет. В следующий раз сначала проверим зубы.'
            : 'Ты открыл сундук. Пожалуйста, объясни, где в плане была часть с зубами.';
        saveRunCheckpoint();
        return true;
    }
    function completeTeamHeist() {
        const deal=heistState.crisis?.teamHeist;
        if(!deal?.committed||deal.settled)return false;
        const chest=chests[deal.target],plan=TEAM_HEIST_PLANS[deal.planId];
        if(!chest||!plan)return false;
        const outcome=chest.teamHeistOutcome || (chest.type==='mimic'?'mimic':chest.type==='scroll'?'scroll-found':'empty');
        const settled=settleTeamHeist(outcome,{opener:plan.opener,distractor:plan.distractor,owner:deal.owner});
        if (settled && deal.scope==='guarded-treasury') HeistRules.finishGuardedTreasury(heistState,'success');
        return settled;
    }
    function applyTeamHeistScroll(scroll,price) {
        const deal=heistState.crisis?.teamHeist,terms=TEAM_HEIST_TERMS[deal?.termId],plan=TEAM_HEIST_PLANS[deal?.planId];
        if(!deal?.committed||deal.settled||!terms||!plan)return false;
        const owner=terms.owner==='opener'?plan.opener:terms.owner;
        deal.owner=owner;
        if(owner==='player') {
            addScrollToInventory(scroll,price);
            const item=scrollInventory.at(-1);item.teamHeistContractId=deal.id;
            item.rogiSharePercent=terms.sharePercent||0;
            companion.line=terms.sharePercent?'Свиток твой, мне причитается четверть только с реальной продажи.':'Находка твоя, как мы и договорились.';
        } else {
            const item={id:scroll.id,price:Math.max(0,Math.round(price||0)),uid:companion.nextLootId++,asked:false,
                teamHeistContractId:deal.id,sentimental:false};
            companion.inventory.push(item);
            companion.lastLoot={name:scroll.name,owner:'rogi',uid:item.uid,decision:'team-heist-contract',offer:false,price:0,
                text:'По договору эта находка принадлежит Роги.'};
            companion.line='Свиток мой по договору. К покупке и разговору о нём применяются обычные правила.';
            RogiAI.syncFinances(companion);
        }
        lastEvent='Найден '+scroll.name+'.';
        RogiAI.event(companion,'team-heist-loot-assigned',{key:deal.id,owner,scroll:scroll.id,sharePercent:owner==='player'?terms.sharePercent||0:0});
        return true;
    }
    function noteTeamHeistNoSale(item,reason) {
        if(!item?.teamHeistContractId)return false;
        RogiAI.event(companion,'team-heist-no-sale',{key:item.teamHeistContractId,reason});return true;
    }
    function noteTeamHeistSale(item,sharePaid) {
        if(!item?.teamHeistContractId)return false;
        RogiAI.event(companion,'team-heist-sale-settled',{key:item.teamHeistContractId,sharePaid:Math.max(0,Math.floor(sharePaid||0))});return true;
    }
    function teamHeistPlansForUI() {
        const ai=companion.active?RogiAI.ensure(companion):null;
        const unopened=chests.filter(item=>!item.opened&&!item.destroyed).length;
        return Object.values(TEAM_HEIST_PLANS).map(plan=>({ ...plan,
            available:!!ai&&teamHeistAvailable(heistState,{planId:plan.id,unopened,companionActive:companion.active,
                companionHp:companion.hp,companionFocus:ai.focus}),
            detectionChance:teamHeistDetectionChance({distractorHp:plan.distractor==='player'?hp:companion.hp,
                distractorFocus:plan.distractor==='player'?heistState.playerFocus:ai?.focus||0}) }));
    }
    function teamHeistTermsForUI(planId) { return teamHeistTermsForPlan(planId).map(term=>({...term})); }
    function finishCrisis() {
        gameState = STATES.CHOOSE;
        selected = -1;
        if (chests.some(item => item.opened && !item.destroyed)) { leaveRoom(); return; }
        updateUI();
    }
    function askRogiToDistract() {
        const crisis = heistState.crisis;
        if (!crisis || crisis.rogiTried || !companion.active || companion.hp <= 0) return false;
        const ai = RogiAI.ensure(companion);
        if (ai.focus < 1) { crisis.rogiTried = true; lastEvent = 'У Роги не осталось фокуса, чтобы отвлечь монстра.'; updateUI(); return false; }
        if (ai.promises.risk?.status === 'active' || ai.promises.noKnownDanger?.status === 'active') {
            crisis.rogiTried = true;
            companion.line = ai.promises.risk?.status === 'active'
                ? 'Ты обещал принять следующий риск на себя. Я не стану забирать его обратно.'
                : 'Ты обещал не посылать меня в известную опасность. Я останусь здесь.';
            lastEvent = companion.line + ' Вы можете сами затаиться, заплатить или бежать.';
            RogiAI.event(companion, 'heist-help-refused', { key:currentNodeId, promise:true });
            updateUI();
            return false;
        }
        const decision = RogiAI.choose(companion, [
            { id:'assist', base:38, traitWeights:{ courage:0.34, cooperation:0.22, loyalty:0.2, caution:-0.24 }, tags:['help','protect','assist'], needWeight:{ closeness:0.12 } },
            { id:'refuse', base:37, traitWeights:{ caution:0.28, fear:0.25, independence:0.16, loyalty:-0.2 }, tags:['refuse','safe','choice'], needWeight:{ safety:0.1 } }
        ], { decisionKind:'heist-crisis-help', trust:rogiTrust, tone:'polite', roomThreat:heistState.noise,
            playerHp:hp, companionHp:companion.hp, companionFocus:ai.focus, riskBearer:'rogi' });
        crisis.rogiTried = true;
        if (decision?.id !== 'assist') {
            companion.line = RogiAI.voice(companion, 'refusal', { reason:'danger' }, 'Нет. После такого шума я в эту сторону не пойду.');
            lastEvent = companion.line + ' Вы всё ещё можете затаиться, заплатить или бежать.';
            RogiAI.event(companion, 'heist-help-refused', { key:currentNodeId });
            updateUI();
            return false;
        }
        if (!RogiAI.spendFocus(companion, 1, 'heist-distraction')) return false;
        RogiAI.event(companion, 'companion-risk', { key:'monster', method:'diversion', dangerous:true,
            actor:'rogi', initiator:'player', executor:'rogi', riskBearer:'rogi', consented:true });
        companion.line = 'Я отвлеку его, пока мы уходим. А ты постарайся ничего не уронить.';
        HeistRules.clearCrisis(heistState);
        lastEvent = 'Роги выманила монстра, пока вы выбрались. Она потратила 1 фокус и перенервничала.';
        finishCrisis();
        return true;
    }
    function markRoomExit() { HeistRules.leaveRoom(heistState); }
    function restAtCamp(nodeId) { return HEIST_LOOP_ENABLED ? HeistRules.restAtCamp(heistState, nodeId) : 0; }
    function hasRestedAtCamp(nodeId) { return HeistRules.hasRestedAtCamp(heistState, nodeId); }
    function mode() { return heistState.mode || 'A'; }
    function setMode(value) {
        if (gameState !== STATES.INTRO) return false;
        heistMode = value === 'B1' ? 'B1' : 'A';
        heistState.mode = heistMode;
        persist();
        return true;
    }
    function lastScore() { return heistState.crisis?.lastScore || null; }
    function beginLastScoreTarget(index, source = 'player') {
        const crisis = heistState.crisis;
        const chest = chests[index];
        if (!crisis || crisis.mode !== 'B1' || crisis.lastScore || !chest || chest.opened || chest.destroyed) return false;
        if (source === 'player' && !HeistRules.canStartLastScore(heistState,
            chests.filter(item => !item.opened && !item.destroyed).length,gold)) return false;
        if (source === 'rogi' && (crisis.view !== 'targets' || !crisis.rogiDealPending)) return false;
        if (!HeistRules.commitLastScore(heistState,index,source)) return false;
        if (source === 'rogi') heistState.crisis.lastScore.share = crisis.rogiSharePercent || 50;
        if (source === 'player') gold -= 15;
        selected = index;
        lastEvent = source === 'rogi'
            ? 'Роги отвлекла сборщика. Её доля будет выплачена из выручки, если свиток продадут.'
            : 'Вы внесли гоблину пошлину 15 зол. и потратили 1 личный фокус. Назад дороги нет.';
        saveRunCheckpoint();
        return startCommittedLastScore();
    }
    function startCommittedLastScore() {
        const score = heistState.crisis?.lastScore;
        if (!score?.committed || score.settled) return false;
        const chest = chests[score.target];
        if (!chest || chest.destroyed || chest.opened) return false;
        chest.actor = 'player';
        chest.method = 'careful';
        gameState = STATES.CHOOSE;
        openChest(score.target);
        return gameState === STATES.OPENING;
    }
    function requestRogiLastScore() {
        const crisis = heistState.crisis;
        if (!crisis || crisis.mode !== 'B1' || crisis.rogiScoreTried || crisis.lastScore || crisis.rogiDealPending ||
            !chests.some(item => !item.opened && !item.destroyed) || !companion.active || companion.hp <= 0) return false;
        crisis.rogiScoreTried = true;
        const ai = RogiAI.ensure(companion);
        if (ai.focus < 1 || ai.promises.risk?.status === 'active' || ai.promises.noKnownDanger?.status === 'active') {
            companion.line = ai.focus < 1 ? 'У меня не осталось сосредоточенности на такую выходку.' : 'Ты обещал не втягивать меня в эту опасность.';
            lastEvent = companion.line + ' Решать, уходить или рисковать одному, будешь сам.';
            saveRunCheckpoint();
            updateUI();
            return false;
        }
        const financial = RogiAI.syncFinances(companion);
        const personalRisk = (companion.hp <= 1 ? 22 : companion.hp === 2 ? 8 : 0) + (ai.focus <= 1 ? 8 : 0);
        const pick = RogiAI.choose(companion, [
            { id:'assist', base:34-personalRisk, traitWeights:{ courage:.3, cooperation:.3, loyalty:.22, caution:-.18 }, tags:['help','risk','assist'], needWeight:{ closeness:.16 } },
            { id:'condition', base:33-personalRisk*0.25, traitWeights:{ pragmatism:.22, greed:.3, fairness:.2, cooperation:.12 }, tags:['deal','share','fair-deal'], needWeight:{ debt:.3, fairness:.14 } },
            { id:'refuse', base:34+personalRisk*0.7, traitWeights:{ caution:.32, fear:.24, independence:.12, loyalty:-.18 }, tags:['refuse','safe','choice'], needWeight:{ safety:.16 } }
        ], { decisionKind:'heist-last-score', trust:rogiTrust, tone:'polite', roomThreat:heistState.noise, financial,
            playerHp:hp, companionHp:companion.hp, companionFocus:ai.focus, debt:companion.debt,
            promises:ai.promises, riskBearer:'rogi' });
        if (pick?.id === 'refuse') {
            companion.line = RogiAI.voice(companion,'refusal',{reason:'danger'},'Нет. Я не отвлекаю гоблина ради ещё одного сундука.');
            lastEvent = companion.line + ' Другие пути всё ещё открыты.';
            RogiAI.event(companion,'heist-last-score-refused',{key:currentNodeId});
            saveRunCheckpoint();
            updateUI(); return false;
        }
        crisis.rogiOfferPending = true;
        crisis.view = 'rogi-terms';
        companion.line = pick?.id === 'condition'
            ? 'Отвлеку его. Половина выручки с продажи свитка — моя. Согласен?'
            : 'Я отвлеку сборщика. Половина выручки с продажи свитка — моя. Согласен?';
        lastEvent = companion.line;
        lastEvent += ' Вы можете принять условия, предложить четверть выручки или отказаться.';
        saveRunCheckpoint();
        updateUI(); return true;
    }
    function completeLastScore() {
        const score = heistState.crisis?.lastScore;
        if (!score?.committed || score.settled) return false;
        const chest = chests[score.target];
        if (score.source === 'rogi' && score.share && chest?.type === 'scroll') {
            const item = scrollInventory.at(-1);
            if (item) {
                item.rogiSharePercent = score.share;
                lastEvent += ' Доля Роги будет выплачена из фактической цены, если свиток продадут.';
            }
        }
        HeistRules.settleLastScore(heistState);
        score.committed = false;
        return true;
    }
    function beginCrisis() { return HeistRules.beginCrisis(heistState); }
    function guardedTreasuryAvailable() {
        const scene = heistState.guardedTreasury;
        return !!scene && scene.status === 'available' && scene.roomId === String(currentNode?.id || '') &&
            heistState.mode === 'B1' && active() && !heistState.alerted && !heistState.crisis;
    }
    function beginGuardedTreasury() {
        if (!guardedTreasuryAvailable() || !companion.active || companion.hp <= 0) return false;
        const ai = RogiAI.ensure(companion);
        if (!ai || heistState.playerFocus < HEIST_LOOP_RULES.teamHeistFocusCost || ai.focus < HEIST_LOOP_RULES.teamHeistFocusCost) {
            lastEvent = 'Для плана обоим нужен хотя бы 1 фокус. Можно действовать обычным способом.';
            updateUI(); return false;
        }
        if (!HeistRules.beginGuardedTreasury(heistState)) return false;
        gameState = STATES.HEIST_CRISIS;
        companion.line = 'Сокровищница под надзором. Один отвлечёт сборщика, второй проверит сундук. Если нас заметят — уйдём ни с чем.';
        lastEvent = 'Замысел: отвлечь часового и проверить один сундук. Успех не поднимет тревогу; обнаружение ранит того, кто отвлекал.';
        saveRunCheckpoint(); updateUI(); return true;
    }
    function declineGuardedTreasury(outcome = 'declined', message = 'Вы отказались от аферы. Можно вскрывать сундуки обычным способом.') {
        if (!HeistRules.finishGuardedTreasury(heistState,outcome)) return false;
        gameState = STATES.CHOOSE; selected = -1; lastEvent = message;
        if (companion.active) companion.line = outcome === 'refused'
            ? 'Нет. С таким риском и этими условиями я не согласна. Решай, что делать дальше.'
            : 'План отменяется. У меня нет претензий — пока.';
        saveRunCheckpoint(); updateUI(); return true;
    }
    return { active, resetRun, enterRoom, snapshot, restore, focus, noise, beforeOpen,
        noteResolution, resolve, leaveRoom:markRoomExit, restAtCamp, hasRestedAtCamp, beginCrisis,
        guardedTreasuryAvailable, beginGuardedTreasury, declineGuardedTreasury,
        mode, setMode, lastScore, completeLastScore, startCommittedLastScore,
        teamHeist:() => heistState.crisis?.teamHeist || null, completeTeamHeist, applyTeamHeistScroll,
        noteTeamHeistNoSale, noteTeamHeistSale, teamHeistPlans:teamHeistPlansForUI, teamHeistTerms:teamHeistTermsForUI,
        state:() => heistState, enabled:() => HEIST_LOOP_ENABLED };
})();
