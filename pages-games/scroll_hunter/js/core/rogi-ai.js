/* Local, deterministic-on-state procedural character model for Rogi. */
'use strict';

const RogiAI = (() => {
    const MAX_FOCUS = 5;
    const DIMENSIONS = ['courage', 'caution', 'generosity', 'independence', 'pride', 'pragmatism', 'cooperation', 'sensitivity'];
    const SITUATIONAL_MODIFIERS = Object.freeze({
        humor: ['joke quality and relief'], talk: ['personal dialogue availability'], curiosity: ['survey and inspection'],
        greed: ['loot retention and bargaining'], initiative: ['proactive information and assistance'], loyalty: ['sharing and protection'],
        closeness: ['help and relationship choices'], resentment: ['memory of harm and refusals'], trust: ['trust calibration'],
        focusSkill: ['survey and inspection accuracy'], stressResistance: ['stress accumulation and recovery'], perception: ['survey accuracy'],
        fear: ['risk refusal and uncertainty'], stress: ['starting stress and crisis threshold'], debtStress: ['deadline stress'],
        adaptability: ['response to changed plans'], anger: ['response to pressure and rudeness'], patience: ['negotiation'],
        confess: ['honesty and personal disclosure'], askHelp: ['acceptance of help'], forgiveness: ['apology response']
    });
    const ACTION_BIAS_TARGETS = Object.freeze({
        keep:['keep'], give:['give'], share:['give','split','offer'], split:['split','offer'], offer:['offer','split'], deal:['offer','split','agree'],
        help:['give','assist','help','accept-help'], protect:['give','assist','protect'], leave:['leave','refuse'], polite:['agree','assist','give','fair-deal'],
        command:['refuse','resist','disagree'], independent:['refuse','defer','choice'], debt:['keep','help','accept-help'], promise:['promise','fair-deal'],
        lie:['lie','hide'], pressure:['refuse','resist','disagree'], safe:['refuse','defer','inspect','survey'], risk:['assist','risk','keep'],
        rest:['rest','safe'], choice:['agree','polite','choice'], apology:['apology','repair'], revenge:['pressure','disagree'],
        bully:['pressure','command'], inspect:['inspect','survey'], reckless:['risk','assist'], broken:['broken-promise','disagree'],
        security:['keep','safe','defer'], focus:['inspect','survey'], honest:['honest','apology'], kindness:['give','assist','help'],
        invest:['keep','offer','future'], shortTerm:['keep','offer'], extreme:['risk','pressure'], repair:['apology','repair','fair-deal'],
        panic:['refuse','defer'], credit:['split','share','give'], preserve:['keep','defer','preserve'], break:['break','pressure'],
        avoid:['refuse','defer','safe'], conflict:['pressure','disagree'], coercion:['pressure','command'], despair:['refuse','help'],
        askHelp:['accept-help','give','help'], forgive:['apology','repair'], curiosity:['inspect','survey'], fairness:['split','offer','fair-deal'],
        challenge:['risk','assist','disagree'], bargain:['offer','split','fair-deal'], tone:['polite','pressure'], support:['support','help'],
        personal:['bond','ask-fear','ask-future'], relic:['preserve','keep'], survey:['survey','inspect'], consent:['polite','choice'],
        initiative:['assist','survey','inspect','offer'], closeness:['give','assist','support'], humor:['joke','support'], trust:['give','assist','accept-help','fair-deal']
    });
    const MODIFIER_KEYS = Object.freeze({ dimensions: DIMENSIONS, situational: Object.keys(SITUATIONAL_MODIFIERS), actions: Object.keys(ACTION_BIAS_TARGETS) });
    const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
    const clamp100 = value => Math.max(0, Math.min(100, Number(value) || 0));
    function createDefaultGamePort() {
        return {
            playerGold: () => typeof gold === 'number' ? gold : 0,
            playerHp: () => typeof hp === 'number' ? hp : 0,
            playerTrust: () => typeof rogiTrust === 'number' ? rogiTrust : 0,
            playerScrollCount: () => typeof scrollInventory !== 'undefined' ? scrollInventory.length : 0,
            tribute: () => typeof currentTribute === 'function' ? currentTribute() : 0,
            runProgress: () => typeof attemptOver !== 'undefined' && attemptOver ? 1
                : typeof floor === 'number' ? clamp(floor / (typeof map !== 'undefined' && map?.length || 17), 0, 1) : 0,
            floor: () => typeof floor === 'number' ? floor : 1,
            roomId: () => typeof currentNodeId !== 'undefined' ? currentNodeId : 'room',
            roomType: () => typeof currentNode !== 'undefined' ? currentNode?.type || null : null,
            roomFacts: () => typeof roomFacts === 'function' ? roomFacts() : {},
            advisor: () => typeof rogi !== 'undefined' ? rogi : null,
            companion: () => typeof companion !== 'undefined' ? companion : null,
            selectedChestIndex: () => typeof selected === 'number' ? selected : -1,
            chestAt: index => typeof chests !== 'undefined' ? chests[index] || null : null,
            isChoosingChest: () => typeof gameState !== 'undefined' && typeof STATES !== 'undefined' && gameState === STATES.CHOOSE,
            isRoomAdviceAvailable: () => typeof rogi !== 'undefined' && !!rogi && !rogi.roomAdviceBought,
            isChestAdviceAvailable: chest => !!chest && !chest.opened && !chest.adviceBought,
            questionFree: () => typeof rogiQuestionFree === 'function' && rogiQuestionFree(),
            hasRequestLoot: () => typeof requestCompanionLoot === 'function',
            hasAskRoom: () => typeof askRogiRoom === 'function',
            hasAskChest: () => typeof askRogiChest === 'function',
            hasBuyLoot: () => typeof buyCompanionLoot === 'function',
            hasNegotiateLoot: () => typeof negotiateCompanionLoot === 'function',
            hasPressureLoot: () => typeof pressureCompanionLoot === 'function',
            advicePrice: actionId => {
                const advisor = typeof rogi !== 'undefined' ? rogi : null;
                return advisor ? actionId === 'survey-room' ? advisor.roomPrice : advisor.chestPrice : 0;
            },
            canCompanionAct: (method, index) => typeof companionActionAssessment === 'function'
                ? companionActionAssessment(method, index) : { allowed: false, reason: 'unavailable' },
            modalType: () => typeof companionModal !== 'undefined' ? companionModal?.type || null : null,
            setModal: modal => { if (typeof companionModal !== 'undefined') companionModal = modal; },
            setSelectedChest: index => { if (typeof selected === 'number') selected = index; },
            updateUI: () => { if (typeof updateUI === 'function') updateUI(); },
            askRoom: () => typeof askRogiRoom === 'function' ? askRogiRoom() : undefined,
            askChest: () => typeof askRogiChest === 'function' ? askRogiChest() : undefined,
            buyLoot: () => typeof buyCompanionLoot === 'function' ? buyCompanionLoot() : undefined,
            requestLoot: tone => typeof requestCompanionLoot === 'function' ? requestCompanionLoot(tone) : undefined,
            negotiateLoot: () => typeof negotiateCompanionLoot === 'function' ? negotiateCompanionLoot() : undefined,
            pressureLoot: () => typeof pressureCompanionLoot === 'function' ? pressureCompanionLoot() : undefined,
            requestOpen: () => typeof requestOpen === 'function' ? requestOpen() : undefined,
            requestCompanionChest: method => typeof requestCompanionChest === 'function' ? requestCompanionChest(method) : undefined,
            companionLootDiscussion: item => typeof companionLootDiscussion === 'function'
                ? companionLootDiscussion(item) : (item.discussion ||= {}),
            bumpTrust: amount => typeof bumpTrust === 'function' ? bumpTrust(amount) : undefined
        };
    }
    let gamePort = createDefaultGamePort();
    const gamePortApi = Object.freeze(Object.fromEntries(
        Object.keys(gamePort).map(name => [name, (...args) => gamePort[name](...args)])
    ));
    function configureGamePort(overrides = {}) {
        if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides))
            throw new TypeError('RogiAI game port overrides must be an object.');
        for (const [name, implementation] of Object.entries(overrides)) {
            if (!(name in gamePort) || typeof implementation !== 'function')
                throw new TypeError('Invalid RogiAI game port method: ' + name);
        }
        Object.assign(gamePort, overrides);
        return gamePort;
    }
    const hash = value => {
        let h = 2166136261;
        for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
        return h >>> 0;
    };
    function random(seed, salt = '') {
        let x = hash(String(seed) + '|' + salt) || 0x9e3779b9;
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        return (x >>> 0) / 4294967296;
    }
    function campaignSeed() {
        try {
            const bytes = new Uint32Array(2);
            if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
            else { bytes[0] = Date.now() >>> 0; bytes[1] = Math.floor(performance.now() * 1000) >>> 0; }
            return (bytes[0].toString(16) + bytes[1].toString(16));
        } catch (_) { return hash(Date.now() + ':' + (performance?.now?.() || 0)).toString(16); }
    }
    function pick(list, seed, key) { return list[Math.floor(random(seed, key) * list.length) % list.length]; }
    function collectModifiers(profile) {
        const situational = {}, actions = {};
        for (const item of [...(profile.traits || []), profile.flaw].filter(Boolean)) {
            for (const [name, amount] of Object.entries(item.mods || {})) {
                if (DIMENSIONS.includes(name)) continue;
                if (Object.hasOwn(SITUATIONAL_MODIFIERS, name)) situational[name] = (situational[name] || 0) + Number(amount || 0);
                else if (Object.hasOwn(ACTION_BIAS_TARGETS, name)) actions[name] = (actions[name] || 0) + Number(amount || 0);
            }
        }
        for (const [name, amount] of Object.entries(profile.ideal?.utility || {}))
            if (Object.hasOwn(ACTION_BIAS_TARGETS, name)) actions[name] = (actions[name] || 0) + Number(amount || 0);
        for (const [name, amount] of Object.entries(profile.modifierOverrides?.situational || {}))
            if (Object.hasOwn(SITUATIONAL_MODIFIERS, name)) situational[name] = Number(amount) || 0;
        for (const [name, amount] of Object.entries(profile.modifierOverrides?.actions || {}))
            if (Object.hasOwn(ACTION_BIAS_TARGETS, name)) actions[name] = Number(amount) || 0;
        return { situational, actions };
    }
    function generateProfile(seed) {
        const db = ROGI_PERSONALITY_DATABASE;
        const first = pick(db.traits, seed, 'trait:0');
        let second = pick(db.traits.filter(item => item.id !== first.id), seed, 'trait:1');
        if (random(seed, 'trait:count') < 0.3) second = null;
        const profile = {
            seed: String(seed), traits: second ? [first, second] : [first],
            ideal: pick(db.ideals, seed, 'ideal'), bond: pick(db.bonds, seed, 'bond'), flaw: pick(db.flaws, seed, 'flaw')
        };
        profile.dimensions = Object.fromEntries(DIMENSIONS.map(name => [name, 50 + Math.floor(random(seed, 'base:' + name) * 21) - 10]));
        const applyMods = mods => Object.entries(mods || {}).forEach(([name, amount]) => {
            if (DIMENSIONS.includes(name)) profile.dimensions[name] += amount;
        });
        profile.traits.forEach(item => applyMods(item.mods));
        applyMods(profile.flaw.mods);
        Object.keys(profile.dimensions).forEach(name => { profile.dimensions[name] = clamp100(profile.dimensions[name]); });
        profile.modifiers = collectModifiers(profile);
        return profile;
    }
    function create(seed = campaignSeed()) {
        const profile = generateProfile(seed);
        const initialStress = clamp100(15 + Math.round((profile.modifiers.situational.stress || 0) / 4));
        return {
            seed: String(seed), profile, dimensions: { ...profile.dimensions },
            development: Object.fromEntries(DIMENSIONS.map(key => [key, 0])),
            needs: { safety: 50, fairness: 50, closeness: 40, debtUrgency: 55, rest: 30 },
            stress: initialStress, mood: 'neutral', focus: MAX_FOCUS, focusMax: MAX_FOCUS,
            eventNo: 0, decisionLog: [], memory: [], timeline: [], promises: {}, seen: {},
            bondState: { affinity: 0, triggers: 0, last: null },
            drama: { cooldown: 0, pending: null, last: '' }, disclosedBond: false, state: 'exploring',
            behaviorState: { root: 'companion', branch: 'journey', leaf: 'exploring' }, choicePage: 0, rng: {}
        };
    }
    function ensure(comp) {
        if (!comp) return null;
        if (!comp.ai || !comp.ai.profile || !comp.ai.seed) comp.ai = create(hash(JSON.stringify({ dungeon: comp.dungeon || 0, debt: comp.debt || 0, gold: comp.gold || 0, hp: comp.hp || 0 })).toString(16));
        const ai = comp.ai;
        ai.needs ||= { safety: 50, fairness: 50, closeness: 40, debtUrgency: 55, rest: 30 };
        ai.development ||= Object.fromEntries(DIMENSIONS.map(key => [key, 0]));
        ai.dimensions ||= { ...ai.profile.dimensions };
        ai.memory ||= []; ai.timeline ||= []; ai.promises ||= {}; ai.seen ||= {}; ai.decisionLog ||= [];
        ai.bondState ||= { affinity: 0, triggers: 0, last: null };
        ai.eventNo = Math.max(0, Number(ai.eventNo) || 0);
        if (!ai.profile.modifiers) ai.profile.modifiers = collectModifiers(ai.profile);
        ai.rng ||= {};
        ai.behaviorState ||= { root: 'companion', branch: 'journey', leaf: ai.state || 'exploring' };
        ai.focusMax = MAX_FOCUS; ai.focus = Math.max(0, Math.min(MAX_FOCUS, Number(ai.focus ?? MAX_FOCUS)));
        if (ai.profile.flaw?.mods?.focusRecovery != null) {
            const { focusRecovery, ...mods } = ai.profile.flaw.mods;
            ai.profile.flaw = { ...ai.profile.flaw, mods };
            ai.profile.modifiers = collectModifiers(ai.profile);
        }
        return ai;
    }
    function refreshMood(comp) {
        const ai = ensure(comp);
        ai.mood = ai.stress >= 75 ? 'worried' : ai.stress >= 55 ? 'tense' : ai.stress <= 18 ? 'calm' : 'neutral';
        return ai.mood;
    }
    function moodLabel(mood) { return ({ calm:'Собрана', neutral:'Спокойна', tense:'Напряжена', worried:'Тревожится' })[mood] || 'Спокойна'; }
    function finances(comp) {
        const cash = Math.max(0, Math.floor(Number(comp.gold) || 0)), debt = Math.max(0, Math.floor(Number(comp.debt) || 0));
        const salesComplete = comp.settlement?.dungeon === comp.dungeon && ['prepared','finalized'].includes(comp.settlement.phase);
        const liquid = salesComplete ? 0 : (comp.inventory || []).reduce((sum,item) => sum + Math.floor(Math.max(0,Number(item.price)||0)/2),0);
        const progress = gamePort.runProgress();
        return { cash, debt, liquid, shortCash:Math.max(0,debt-cash), shortLiquid:Math.max(0,debt-cash-liquid), progress };
    }
    function freePlayerGold() {
        return Math.max(0, gamePort.playerGold() - gamePort.tribute());
    }
    function syncFinances(comp, progressOverride) {
        const ai = ensure(comp), f = finances(comp);
        if (Number.isFinite(progressOverride)) f.progress = progressOverride;
        ai.needs.debtUrgency = f.debt ? clamp100(10 + 75 * f.shortLiquid / f.debt + 15 * f.progress) : 0;
        const promise = ai.promises.helpDebt;
        if (promise?.status === 'active' && promise.contract && !promise.contract.reviewFinalized)
            promise.contract.opportunityGold = Math.max(promise.contract.opportunityGold || 0, freePlayerGold());
        return f;
    }
    function goldOfferDecision(comp, amount, context = {}) {
        const ai = ensure(comp);
        if (!context.conditions) {
            const result = {id:'accept-help',score:1,reason:'Помощь без условий принимается без случайного отказа.',factors:{unconditional:true}};
            ai.decisionLog = [result];
            if(typeof RogiConversation!=='undefined')RogiConversation.trace(comp,'gold-offer',{amount,conditions:null,initiator:'player',executor:'player',riskBearer:null},[{id:'accept-help'}],[result],result.id);
            return result;
        }
        return choose(comp,[
            {id:'decline-help',base:38,traitWeights:{independence:0.25,pride:0.2},tags:['independent','choice','refuse']},
            {id:'clarify-help',base:38,traitWeights:{pragmatism:0.2,cooperation:0.1},needWeight:{debt:0.12},tags:['choice','polite','bargain']}
        ],{...context,offeredGold:amount,tone:'command',financial:finances(comp)});
    }
    // Action availability sees observations only. The world truth (chest.type) is intentionally absent.
    function knowledge(comp, chest) {
        const disclosed = ['mimic','scroll','empty','safe','dig'].includes(chest?.known) ? chest.known : 'unknown';
        const observed = chest?.rogiKnowledge;
        return { player:disclosed, companion:observed?.kind || disclosed,
            willingToShare:observed?.willingToShare !== false, shared:disclosed,
            source:observed?.source || (disclosed === 'unknown' ? 'none' : 'public-observation') };
    }
    function voice(comp, intent, context = {}, fallback = '') {
        return typeof RogiVoice !== 'undefined' ? RogiVoice.say(comp,intent,context) : fallback || comp.line || 'Давай решим, как идти дальше.';
    }
    function setDialogue(comp, text) {
        if (comp.dialogueLine !== text && comp.ai?.narrative) comp.ai.narrative.textPage = 0;
        comp.dialogueLine = text; return text;
    }
    function event(comp, type, detail = {}) {
        const ai = ensure(comp); if (!ai) return;
        ai.eventNo++;
        const chronology = { no: ai.eventNo, type, detail: { ...detail }, dungeon: Number(comp.dungeon) || 0 };
        ai.timeline.push(chronology);
        if (ai.timeline.length > 600) ai.timeline.splice(0, ai.timeline.length - 600);
        const key = type + ':' + String(detail.key || detail.value || '');
        const old = ai.memory.find(item => item.key === key);
        if (old) { old.count++; old.last = ai.eventNo; old.detail = { ...old.detail, ...detail }; }
        else ai.memory.push({ key, type, detail: { ...detail }, count: 1, first: ai.eventNo, last: ai.eventNo });
        if (ai.memory.length > 60) ai.memory.splice(0, ai.memory.length - 60);
        if (type === 'injury' || type === 'known-danger' || type === 'forced-risk' || type === 'companion-risk') {
            const resistance = collectModifiers(ai.profile).situational.stressResistance || 0;
            const rawStress = type === 'injury' ? 20 : 10;
            ai.stress = clamp100(ai.stress + Math.max(1, Math.round(rawStress * clamp(1 - resistance / 100, 0.75, 1.25))));
            ai.needs.safety = Math.min(100, ai.needs.safety + 18);
        } else if (type === 'support' || type === 'rest' || type === 'debt-help') {
            ai.stress = Math.max(0, ai.stress - 12);
            ai.needs.closeness = Math.max(0, ai.needs.closeness - (type === 'support' ? 10 : 4));
        } else if (type === 'unfair-loot') ai.needs.fairness = Math.min(100, ai.needs.fairness + 18);
        else if (type === 'team-heist-contract-broken') {
            ai.needs.fairness = clamp100(ai.needs.fairness + 16);
            ai.stress = clamp100(ai.stress + 14);
        }
        else if (type === 'broken-promise') {
            const actions = collectModifiers(ai.profile).actions;
            const respect = (actions.promise || 0) - (actions.broken || 0) + (actions.honest || 0);
            const mercy = (actions.apology || 0) + (actions.repair || 0);
            ai.needs.fairness = clamp100(ai.needs.fairness + clamp(18 + Math.round(respect * 0.15 - mercy * 0.08), 8, 28));
            ai.stress = clamp100(ai.stress + clamp(16 + Math.round(respect * 0.12 - mercy * 0.08), 8, 26));
        } else if (type === 'fair-deal' || type === 'promise-kept') ai.needs.fairness = Math.max(0, ai.needs.fairness - 12);
        if (type === 'debt-help') ai.needs.debtUrgency = Math.max(0, ai.needs.debtUrgency - 14);
        if (type === 'promise-kept') {
            const respect = collectModifiers(ai.profile).actions.promise || 0;
            ai.stress = Math.max(0, ai.stress - clamp(8 + Math.round(respect * 0.1), 4, 11));
        }
        if (type === 'deadline-near') {
            const debtStress = collectModifiers(ai.profile).situational.debtStress || 0;
            ai.stress = clamp100(ai.stress + Math.max(0, 3 + Math.round(debtStress * 0.3)));
        }
        if (type === 'plan-changed') {
            const adaptability = collectModifiers(ai.profile).situational.adaptability || 0;
            ai.stress = clamp100(ai.stress + Math.round(-adaptability * 0.35));
            if (adaptability < -8) ai.needs.safety = clamp100(ai.needs.safety + 3);
        }
        applyBondReaction(comp, type, detail);
        promiseDomain.trackEvidence(comp, type, detail, ai.eventNo);
        const learning = { 'fair-deal': ['cooperation', 0.8], support: ['sensitivity', 0.5], 'debt-help': ['generosity', 0.7], 'forced-risk': ['caution', 0.35], 'promise-kept': ['cooperation', 0.5], 'broken-promise': ['caution', 0.5] }[type];
        if (learning) {
            const [dimension, amount] = learning;
            ai.development[dimension] = Math.max(-12, Math.min(12, ai.development[dimension] + amount));
            ai.dimensions[dimension] = clamp100(ai.profile.dimensions[dimension] + ai.development[dimension]);
        }
        if (!detail.skipTransition) transition(comp, type);
        refreshMood(comp);
        if (!detail.deferDrama && ['injury', 'valuable-find', 'debt-help', 'unfair-loot', 'broken-promise', 'team-heist-contract-broken', 'promise-kept', 'repeated-asks', 'deadline-near'].includes(type)) queueDrama(comp, type, detail);
    }
    function applyBondReaction(comp, type, detail = {}) {
        const ai = ensure(comp), mechanics = ROGI_BOND_MECHANICS?.[ai.profile.bond?.id];
        if (!mechanics || !mechanics.triggers.includes(type==='companion-risk'?'forced-risk':type)) return;
        const hurt = ['injury','forced-risk','known-danger','broken-promise','unfair-loot','player-pressure','relic-destroyed','scroll-destroyed','repeated-asks','deadline-near'].includes(type);
        const affinity = hurt ? -5 : 3;
        ai.bondState.affinity = clamp(ai.bondState.affinity + affinity, -50, 50);
        ai.bondState.triggers++;
        ai.bondState.last = { type, detail: { ...detail }, eventNo: ai.eventNo, delta: affinity };
        if (hurt) {
            ai.needs.fairness = clamp100(ai.needs.fairness + 3);
            ai.stress = clamp100(ai.stress + 2);
        } else ai.needs.closeness = Math.max(0, ai.needs.closeness - 2);
    }
    function transition(comp, eventType) {
        const ai = ensure(comp); if (!ai) return;
        const next = {
            injury: ['survival', 'recovering'], 'known-danger': ['survival', 'assessing-threat'], 'forced-risk': ['survival', 'taking-risk'], 'companion-risk':['survival','taking-risk'],
            'fair-deal': ['relationship', 'negotiating'], 'unfair-loot': ['relationship', 'conflict'], 'debt-help': ['relationship', 'accepting-help'],
            'promise-kept': ['relationship', 'trust-repaired'], 'broken-promise': ['relationship', 'conflict'],
            'team-heist-contract-broken':['relationship','conflict'],
            rest: ['recovery', 'resting'], 'conversation': ['relationship', 'speaking'], 'room-survey': ['journey', 'researching'], 'chest-inspected': ['journey', 'researching']
        }[eventType] || ['journey', 'exploring'];
        ai.state = next[1];
        ai.behaviorState = { root: 'companion', branch: next[0], leaf: next[1] };
    }
    function queueDrama(comp, type, detail = {}) {
        const ai = ensure(comp); if (!ai) return false;
        const priority = detail.priority || ({ 'broken-promise':95, 'team-heist-contract-broken':95, injury:80, 'unfair-loot':85, 'valuable-find':60, 'debt-help':45, 'promise-kept':50, 'repeated-asks':70, 'deadline-near':70 })[type] || 30;
        const meaningful = detail.meaningful ?? (type === 'valuable-find' ? !!detail.decision && ['give','offer','split'].includes(detail.decision)
            : type === 'debt-help' ? !!ai.promises.helpDebt && ai.promises.helpDebt.status === 'kept'
                : type === 'promise-kept' ? false : true);
        if (!meaningful || (ai.drama.cooldown > 0 && priority < 90 && !detail.authoritative)) return false;
        if (ai.drama.pending && (ai.drama.pending.priority || 0) >= priority && !detail.authoritative) return false;
        const key = type + ':' + Math.floor(ai.eventNo / 3);
        if (ai.seen[key] && !detail.authoritative) return false;
        ai.seen[key] = true;
        ai.drama.pending = { type, detail, key, priority, line:detail.line || dramaLine(type, ai) };
        ai.drama.cooldown = 3;
        return true;
    }
    function dramaLine(type, ai) {
        const lines = {
            injury: 'Подожди. После такого укуса нам надо обсудить, как дальше рисковать.',
            'valuable-find': 'Вот это находка. Давай решим, что она значит для нас обоих.',
            'debt-help': 'Я запомню эту помощь. Долги редко становятся легче в одиночку.',
            'unfair-loot': 'Я не хочу ссориться из-за добычи, но мне важно, чтобы мой вклад тоже считали.',
            'broken-promise': 'Ты обещал иначе. Объясни, что изменилось.',
            'team-heist-contract-broken':'Мы заранее договорились о находке. Ты продавил моё право на неё — в следующий раз условия будут другими.',
            'promise-kept': 'Ты сдержал слово. Для меня это весит больше красивой речи.',
            'repeated-asks': 'Ты уже несколько раз просил меня принять риск. Давай решим, как делить его дальше.',
            'deadline-near': 'До конца походов осталось мало времени. Я не хочу, чтобы мой долг затмил всё остальное.'
        };
        return lines[type] || (ai.profile.traits.some(item => item.tags.includes('joke')) ? 'Ну что, поговорим, пока подземелье не решило за нас?' : 'Есть кое-что, что я хочу обсудить.');
    }
    function traitTags(ai) { return [...ai.profile.traits, ai.profile.flaw].flatMap(item => item.tags || []); }
    function actionMatch(action, key) {
        const targets = ACTION_BIAS_TARGETS[key] || [key];
        if (targets.includes(action.id)) return 1;
        if ((action.tags || []).includes(key) || (action.tags || []).some(tag => targets.includes(tag))) return 0.65;
        return 0;
    }
    function situationalScore(ai, action, context) {
        const m = collectModifiers(ai.profile).situational;
        const id = action.id, d = ai.dimensions;
        let score = 0;
        if (id === 'keep') score += (d.pragmatism - 50) * 0.12 - (d.generosity - 50) * 0.05;
        if (id === 'give') score += (d.generosity - 50) * 0.14 + (d.cooperation - 50) * 0.12;
        if (id === 'offer') score += (d.pragmatism - 50) * 0.12 + (d.cooperation - 50) * 0.05;
        if (id === 'split') score += (d.generosity - 50) * 0.08 + (d.cooperation - 50) * 0.14;
        if (['assist','agree'].includes(id)) score += (d.courage - 50) * 0.08 + (d.cooperation - 50) * 0.09;
        if (['refuse','decline'].includes(id)) score += (d.caution - 50) * 0.09 + (d.independence - 50) * 0.10;
        if (['keep','refuse','resist','disagree'].includes(id) && context.tone === 'command') score += (d.pride + d.independence - 100) * 0.12;
        if (['keep','offer','split','give','defer'].includes(id)) score += (m.greed || 0) * (id === 'keep' ? 0.34 : id === 'offer' ? 0.18 : id === 'give' ? -0.22 : 0.05);
        if (['give','assist','help','protect','accept-help'].includes(id)) score += (m.loyalty || 0) * 0.32 + (m.closeness || 0) * 0.22;
        if (['give','assist','agree'].includes(id)) score += (m.resentment || 0) * -0.18;
        if (['assist','risk','keep'].includes(id) && context.rare) score += (m.curiosity || 0) * 0.12;
        if (['inspect','survey'].includes(id)) score += (m.curiosity || 0) * 0.22 + (m.initiative || 0) * 0.13;
        if (['assist','give','help'].includes(id)) score += (m.initiative || 0) * 0.12;
        if (['refuse','defer','safe','inspect','survey'].includes(id)) score += (m.fear || 0) * (id === 'refuse' ? 0.30 : id === 'inspect' ? 0.14 : 0.20);
        if (['give','assist','agree','accept-help','accept-deal','fair-deal'].includes(id)) score += (m.trust || 0) * ((Number(context.trust) || 0) / 100) * 0.45;
        if (['keep','refuse','defer'].includes(id)) score += (m.debtStress || 0) * (ai.needs.debtUrgency / 100) * 0.22;
        if (['rest','safe','refuse'].includes(id)) score += (m.stressResistance || 0) * (ai.stress / 100) * 0.14;
        if (['inspect','survey'].includes(id)) score += ((m.focusSkill || 0) + (m.perception || 0)) * 0.12;
        if (['agree','assist','give','fair-deal','accept-help','accept-deal'].includes(id) && context.tone === 'polite') score += 3 + Math.max(0, (ai.dimensions.sensitivity - 50) * 0.05);
        if (['keep','refuse','defer','decline-help','reject-deal'].includes(id) && ['pressure','command'].includes(context.tone)) score += 4 + (ai.dimensions.independence + ai.dimensions.pride - 100) * 0.07 + (m.anger || 0) * 0.28 + (m.resentment || 0) * 0.16;
        if (['agree','assist','give','accept-help','accept-deal'].includes(id) && ['pressure','command'].includes(context.tone)) score -= 3 + (ai.dimensions.independence + ai.dimensions.pride - 100) * 0.05 + (m.anger || 0) * 0.24 + (m.resentment || 0) * 0.12;
        if (context.planChanged && ['adapt','inspect','survey'].includes(id)) score += (m.adaptability || 0) * (id === 'adapt' ? 0.8 : 0.4);
        if (['offer','split','fair-deal','accept-deal'].includes(id)) score += (m.patience || 0) * 0.45;
        if (context.financial) {
            const f = context.financial, ratio = f.debt > 0 ? clamp(f.shortLiquid / f.debt,0,1) : 0;
            if (['keep','offer','counter','sell'].includes(id) || id.startsWith('counter:')) score += ratio * (10 + 8 * (f.progress || 0)) - (ratio === 0 ? 8 : 0);
            if (id === 'give') score += ratio === 0 ? 8 : -ratio * 9;
        }
        if (['assist','break'].includes(id) && context.method === 'break') score += (collectModifiers(ai.profile).actions.break || 0) * 0.35;
        if (id === 'accept-help') score += (m.askHelp || 0) * 0.34 - (d.independence - 50) * 0.10 - (d.pride - 50) * 0.06 + ai.needs.debtUrgency * 0.05;
        if (id === 'decline-help') score += (d.independence - 50) * 0.12 + (d.pride - 50) * 0.09 - (m.askHelp || 0) * 0.22 - ai.needs.debtUrgency * 0.04;
        if (['repair','trust-repair','apology'].includes(id)) score += (d.sensitivity - 50) * 0.08 + (m.resentment || 0) * -0.14 + (collectModifiers(ai.profile).actions.forgive || 0) * 0.35;
        if (['withdraw','refuse'].includes(id) && context.brokenPromise) score += (m.resentment || 0) * 0.25 + (Number(context.trust) < 0 ? 4 : 0);
        if (id === 'rest') score += ai.stress * 0.08 + (MAX_FOCUS - ai.focus) * 1.4 + (m.stressResistance || 0) * 0.18;
        if (id === 'press-on') score += (m.initiative || 0) * 0.32 - ai.stress * 0.04 - (MAX_FOCUS - ai.focus) * 0.8;
        if (id === 'adapt') score += (m.adaptability || 0) * 0.55 + (ai.dimensions.pragmatism - 50) * 0.12;
        if (id === 'skip') score += (m.fear || 0) * 0.12 - (m.curiosity || 0) * 0.18 - (m.initiative || 0) * 0.14;
        return score;
    }
    function utility(comp, actions, context = {}) {
        const ai = ensure(comp); if (!ai) return [];
        const tags = traitTags(ai), d = ai.dimensions, modifiers = collectModifiers(ai.profile), bond = ROGI_BOND_MECHANICS?.[ai.profile.bond?.id];
        const repeated = ai.memory.filter(item => item.type === 'forced-risk').reduce((sum, item) => sum + item.count, 0);
        const scores = actions.map(action => {
            let score = Number(action.base) || 0;
            const factors = { base: score };
            for (const [dimension, weight] of Object.entries(action.traitWeights || {})) {
                if (!DIMENSIONS.includes(dimension)) continue;
                const contribution = Number(weight || 0) * (d[dimension] - 50) * 0.7;
                score += contribution; factors[dimension] = contribution;
            }
            for (const [key, amount] of Object.entries(modifiers.actions)) {
                const match = actionMatch(action, key);
                if (!match) continue;
                const contribution = amount * 0.62 * match;
                score += contribution; factors['action:' + key] = contribution;
            }
            if (bond) for (const [key, amount] of Object.entries(bond.actions)) {
                const match = actionMatch(action, key);
                if (!match) continue;
                const contribution = amount * 0.58 * match * (1 + clamp(ai.bondState.affinity, -50, 50) / 100);
                score += contribution; factors['bond:' + key] = contribution;
            }
            const situation = situationalScore(ai, action, context);
            score += situation; if (situation) factors.situation = situation;
            if (action.tags) score += action.tags.reduce((n, tag) => n + (tags.includes(tag) ? 5 : 0), 0);
            score += (action.trustWeight || 0) * ((Number(context.trust) || 0) / 10);
            score += (action.needWeight?.debt || 0) * ai.needs.debtUrgency / 10;
            score += (action.needWeight?.safety || 0) * ai.needs.safety / 10;
            score += (action.needWeight?.fairness || 0) * ai.needs.fairness / 10;
            score += (action.needWeight?.closeness || 0) * ai.needs.closeness / 10;
            if (action.id === 'help' && context.companionHp <= 1) score += 14;
            if (action.id === 'assist' && context.knownMimic) score -= 25 + (d.caution * 0.25) + repeated * 5 - (d.courage * 0.08);
            if (action.id === 'assist' && context.method === 'break') score -= 6;
            if (action.id === 'assist' && context.companionHp <= 1) score -= 12;
            if (action.id === 'assist' && ai.stress >= 75) score -= 8;
            if (action.id === 'assist' && ai.behaviorState?.branch === 'survival') score -= 4;
            if (action.id === 'keep' && context.rare) score += tags.includes('relic') ? 10 : 0;
            if (action.id === 'give' && context.playerHp <= 1) score += 18;
            if (action.id === 'refuse' && context.knownMimic) score += 12;
            return { id: action.id, score: Math.round(score * 100) / 100, reason: action.reason || 'характер, потребности и обстоятельства', factors };
        }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        return scores;
    }
    function choose(comp, actions, context = {}) {
        const scores=utility(comp,actions,context),ai=ensure(comp);
        ai.decisionLog=scores.slice(0,8).map(item=>({...item,event:ai.eventNo}));
        if(typeof RogiConversation!=='undefined') RogiConversation.trace(comp,context.decisionKind||'utility',context,actions,scores,scores[0]?.id||null);
        return scores[0]||null;
    }
    function roll(comp, key = 'behavior') {
        const ai = ensure(comp); if (!ai) return 0;
        const index = ai.rng[key] || 0; ai.rng[key] = index + 1;
        return random(ai.seed, 'roll:' + key + ':' + index);
    }
    function spendFocus(comp, cost, reason) {
        const ai = ensure(comp); cost = Math.max(0, Math.floor(cost));
        if (!ai || ai.focus < cost) return false;
        ai.focus -= cost;
        if (cost) event(comp, 'focus-spent', { cost, reason });
        return true;
    }
    function rest(comp, full = false) {
        const ai = ensure(comp); if (!ai) return;
        if(ai.restAgreement?.status==='active')ai.restAgreement.status='kept';
        const modifiers = collectModifiers(ai.profile).situational;
        const recovery = full ? MAX_FOCUS : 2;
        ai.focus = full ? MAX_FOCUS : Math.min(MAX_FOCUS, ai.focus + recovery);
        ai.stress = Math.max(0, ai.stress - (full ? 25 : 12) - Math.max(0, Math.round((modifiers.stressResistance || 0) / 8)));
        ai.needs.safety = Math.max(0, ai.needs.safety - (full ? 20 : 10));
        ai.drama.cooldown = Math.max(0, ai.drama.cooldown - 1);
        ai.mood = ai.stress < 20 ? 'calm' : 'neutral';
        event(comp, 'rest', { full });
    }
    function newDungeon(comp) {
        const ai = ensure(comp); if (!ai) return;
        ai.focus = MAX_FOCUS; ai.stress = Math.max(0, ai.stress - 10);
        ai.drama.cooldown = Math.max(0, ai.drama.cooldown - 1);
        ai.choicePage = 0;
        syncFinances(comp,0); refreshMood(comp);
        transition(comp, 'dungeon-start');
    }
    function roomTransition(comp) {
        const ai = ensure(comp); if (!ai) return;
        ai.drama.cooldown = Math.max(0, ai.drama.cooldown - 1);
        if (ai.behaviorState.branch !== 'relationship') transition(comp, 'room-transition');
        syncFinances(comp);
        event(comp, 'room-transition', { dungeon:Number(comp.dungeon) || 0, skipTransition:true });
    }
    function survey(comp, facts, floorNo = 1) {
        const ai = ensure(comp), threatCount = (facts.mimics || []).length, modifiers = collectModifiers(ai.profile).situational;
        const perception = clamp100((ai.dimensions.caution + ai.dimensions.pragmatism) / 2 + (modifiers.perception || 0) + (modifiers.curiosity || 0) * 0.35 + (modifiers.focusSkill || 0) * 0.25 + (ai.profile.ideal.utility.inspect || 0));
        const exactCount = perception >= 78 && random(ai.seed, 'survey:' + ai.eventNo + ':' + floorNo) > 0.28;
        event(comp, 'room-survey', { floor: floorNo, count: threatCount });
        return exactCount
            ? threatCount === 0 ? 'Я не вижу признаков мимиков. Это не гарантия, но явной угрозы пока нет.' : 'Нашла следы ' + (threatCount === 1 ? 'одного подозрительного сундука.' : 'примерно ' + threatCount + ' подозрительных сундуков.')
            : threatCount === 0 ? 'Комната кажется сравнительно спокойной. Явных признаков угрозы не заметила.' : threatCount === 1 ? 'Есть подозрительные следы. Я бы считала риск небольшим, но реальным.' : 'Следов опасности несколько. Точное число пока не назову.';
    }
    function inspectChest(comp, chest) {
        const ai = ensure(comp), kind = chest && chest.type;
        const modifiers = collectModifiers(ai.profile).situational;
        const caution = ai.dimensions.caution + (ai.profile.ideal.utility.inspect || 0) * 0.6 + (modifiers.focusSkill || 0) + (modifiers.perception || 0) + (modifiers.curiosity || 0) * 0.35;
        const accuracy = Math.max(0.82, Math.min(0.99, 0.88 + caution / 1000));
        const correctlyRead = random(ai.seed, 'inspect:' + ai.eventNo + ':' + (chest && chest.id || 'selected')) < accuracy;
        let text;
        if (correctlyRead) {
            chest.known = kind === 'scroll' ? 'scroll' : kind;
            chest.rogiKnowledge = { kind:chest.known, source:'paid-inspection', willingToShare:true, shared:true, eventNo:ai.eventNo };
            text = kind === 'mimic' ? 'На этом сундуке следы пасти. Почти уверена, что это мимик.' : kind === 'scroll' ? 'За замком чувствуется вес свитка. Похоже на ценную находку.' : 'Пустой. Ни магического следа, ни механизма я не нашла.';
        } else {
            // Rare mistake is an explicitly uncertain estimate; the underlying room fact never changes.
            text = 'Улики противоречивы. Я не стану делать уверенный вывод — решай, готов ли ты рискнуть.';
        }
        event(comp, 'chest-inspected', { key: chest && chest.id || 'selected', result: chest && chest.known || 'uncertain' });
        return text;
    }
    function availableChoices(comp, selectedChest = -1, requestedPageSize = 3) {
        const ai = ensure(comp);
        const pageSize = clamp(Math.floor(Number(requestedPageSize) || 3), 1, 3);
        ai.choicePageSize = pageSize;
        const harm = ai.memory.some(item => ['injury','unfair-loot','forced-risk','broken-promise','team-heist-contract-broken','player-pressure'].includes(item.type));
        const selectedItem = selectedChest >= 0 ? gamePort.chestAt(selectedChest) : null;
        const ownItem = comp.inventory?.find(item => item.uid === comp.lastLoot?.uid);
        const discussion = ownItem?.discussion || { requested:!!ownItem?.asked,pressureCount:0,negotiated:false,closed:false };
        const canPromise = ai.promises.helpDebt?.status !== 'active' && ai.promises.helpDebt?.dungeon !== (Number(comp.dungeon)||0);
        const requirementMet = requirement => {
            switch (requirement) {
                case 'always': return true;
                case 'room-unseen': return gamePort.isChoosingChest() && gamePort.isRoomAdviceAvailable();
                case 'chest-unseen': return gamePort.isChoosingChest() && gamePort.isRoomAdviceAvailable() && gamePort.isChestAdviceAvailable(selectedItem);
                case 'can-help-debt': return gamePort.playerGold() > 0 && Number(comp.debt) > Number(comp.gold || 0);
                case 'no-debt-promise': return canPromise && comp.debt > 0;
                case 'can-promise-gift': return canPromise && gamePort.playerGold() > 0;
                case 'no-share-promise': return !ai.seen['promise:fairLoot'];
                case 'no-risk-promise': return !ai.seen['promise:risk'];
                case 'no-danger-promise': return !ai.seen['promise:noKnownDanger'];
                case 'bond-unrevealed': {
                    return !!comp.active;
                }
                case 'follow-bond': return ['bond','clarify-bond'].includes(ai.narrative?.lastIntent);
                case 'trust-question-ready': return !!comp.active;
                case 'fear-question-ready': return !!comp.active;
                case 'has-harm-memory': return harm && ai.seen.apologyFor !== ai.timeline.filter(e=>['injury','unfair-loot','forced-risk','broken-promise','player-pressure'].includes(e.type)).at(-1)?.no;
                case 'loot-dispute': return comp.lastLoot?.owner === 'rogi' && !!ownItem && discussion.requested && !discussion.pressureCount && !discussion.closed;
                case 'loot-repeat-pressure': return comp.lastLoot?.owner === 'rogi' && !!ownItem && discussion.pressureCount === 1 && !discussion.closed;
                case 'loot-negotiate': return comp.lastLoot?.owner === 'rogi' && !!ownItem && !discussion.negotiated && !discussion.closed;
                case 'loot-offer': return comp.lastLoot?.owner === 'rogi' && !!ownItem && !!comp.lastLoot.offer && !discussion.closed;
                case 'loot-owned': return comp.lastLoot?.owner === 'rogi' && !!ownItem && !discussion.requested && !discussion.closed;
                case 'more-choices': return true;
                default: return false;
            }
        };
        const prepared = ROGI_DIALOGUE_ACTIONS.filter(action => action.id !== 'more-questions' && requirementMet(action.requires)).map(action => {
            let text = action.text, disabled = false, disabledReason = '';
            if (action.id === 'survey-room' || action.id === 'inspect-chest') {
                const free = gamePort.questionFree();
                const price = gamePort.advicePrice(action.id);
                text = (action.id === 'survey-room' ? 'Оценить комнату' : 'Проверить сундук') + ' · 1 сосред. · ' + (free ? 'бесплатно' : price + ' зол.');
                if (comp.hp <= 0) disabledReason = 'Роги ранена. Нужен отдых у костра.';
                else if (ai.focus < 1) disabledReason = 'Роги устала. Силы вернутся у костра или в новом походе.';
                else if (!free && gamePort.playerGold() < price) disabledReason = 'Не хватает ' + Math.max(0,price-gamePort.playerGold()) + ' зол.';
                disabled = !!disabledReason;
            }
            if (action.id === 'buy-loot') { text = 'Выкупить свиток · ' + (comp.lastLoot?.price || 0) + ' зол.'; disabled = gamePort.playerGold() < Number(comp.lastLoot?.price || Infinity); if (disabled) disabledReason = 'Не хватает золота для выкупа.'; }
            if (action.id === 'personal-bond' && ai.disclosedBond) text = 'Вернуться к твоему рассказу';
            return { ...action, text, disabled, disabledReason };
        });
        const initiative = collectModifiers(ai.profile).situational.initiative || 0;
        const recent = ai.timeline.slice(-8).map(e => e.type), last = ai.narrative?.lastIntent;
        const priority = action => {
            let score = ['survey-room','inspect-chest'].includes(action.id) ? initiative : 0;
            if (comp.lastLoot?.owner === 'rogi' && ['request-share-loot','negotiate-loot','buy-loot','pressure','repeat-pressure'].includes(action.id)) score += 55;
            if (recent.includes('injury') && ['ask-fear','promise-risk','promise-no-danger','support','apologize'].includes(action.id)) score += 40;
            if ((recent.includes('deadline-near') || comp.settlement) && ['ask-debt','offer-gold','promise-if-needed','ask-future'].includes(action.id)) score += 45;
            if (recent.includes('rest') && ['personal-bond','ask-future','support'].includes(action.id)) score += 30;
            if (['bond','clarify-bond'].includes(last) && ['clarify-bond','support','joke'].includes(action.id)) score += 80;
            if (ai.narrative?.playerActs?.slice(-3).some(x => x.id === action.id)) score -= 18;
            return score;
        };
        prepared.sort((a,b) => priority(b)-priority(a));
        if(typeof RogiConversation!=='undefined')return RogiConversation.choices(comp,prepared,pageSize);
        const pages = Math.max(1, Math.ceil(prepared.length / pageSize));
        const page = Math.floor(Number(ai.choicePage || 0) / pageSize) % pages;
        const rows = prepared.slice(page * pageSize, page * pageSize + pageSize);
        if (pages > 1) rows.push({ ...ROGI_DIALOGUE_ACTIONS.find(action => action.id === 'more-questions'),
            text: page === pages - 1 ? '← К первым вопросам' : 'Другие вопросы →', topicPage: ((page + 1) % pages) * pageSize });
        return rows;
    }
    function dialogue(comp, action) {
        const ai = ensure(comp); if (!ai) return 'Роги сейчас не может говорить.';
        const definition = ROGI_DIALOGUE_ACTIONS.find(item => item.id === action);
        if (!definition) return ai.drama.pending?.line || comp.line || 'Пока всё спокойно. Давай не терять бдительность.';
        const bond = ai.profile.bond, modifiers = collectModifiers(ai.profile), id = definition.id;
        switch (definition.reaction) {
            case 'debt':
                event(comp, 'debt-question', { key: 'dialogue', action: id });
                if (ai.stress >= 65 && (modifiers.actions.lie || 0) > (modifiers.actions.honest || 0) + 5)
                    return 'Цифры не изменились. Просто не хочу снова считать их вслух — давай сначала выберемся отсюда.';
                return voice(comp,'debt',{},'У меня ' + Math.max(0,comp.debt) + ' зол. долга и ' + comp.gold + ' монет.');
            case 'support': {
                const supportKey = 'support:' + (comp.dungeon || 0);
                if (!ai.seen[supportKey]) {
                    ai.seen[supportKey] = true; event(comp, 'support', { key: supportKey });
                    const trustGain = clamp(1 + Math.floor((ai.dimensions.sensitivity - 50) / 30) + Math.floor((modifiers.situational.closeness || 0) / 20), 0, 3);
                    if (trustGain) gamePort.bumpTrust(trustGain);
                }
                return voice(comp,'support',{},'Спасибо. Мне важна твоя поддержка.');
            }
            case 'joke': {
                const jokeKey = 'joke:' + (comp.dungeon || 0), count = ai.seen[jokeKey] || 0;
                ai.seen[jokeKey] = count + 1; if(count===0)event(comp, 'joke', { key: jokeKey });
                const relief = clamp(4 + Math.round((modifiers.situational.humor || 0) / 5), 2, 8);
                ai.stress = Math.max(0, ai.stress - (count === 0 ? relief : count === 1 ? Math.floor(relief / 3) : 0));
                refreshMood(comp);
                const jokes = ['Если подземелье хочет нас съесть, пусть хотя бы сначала предложит приличный ужин.', 'Я бы назвала это прогулкой, но у прогулки обычно меньше зубов.', 'Хорошая новость: сундук молчит. Плохая: это обычно ненадолго.'];
                return voice(comp,'joke',{},jokes[Math.floor(random(ai.seed, 'joke:' + ai.eventNo) * jokes.length)]);
            }
            case 'bond':
            case 'clarify-bond':
                if (!ai.narrative?.disclosures?.[bond.id]?.turns) event(comp,'bond-discussed',{key:bond.id});
                return voice(comp,definition.reaction,{},'Есть вещи, о которых я пока не готова рассказать. Давай дадим друг другу время.');
            case 'trust': {
                const key = 'question:trust:' + (comp.dungeon || 0); ai.seen[key] = true;
                const threshold = 10 - Math.round((ai.dimensions.sensitivity - 50) / 8) - Math.round((modifiers.situational.trust || 0) / 8) - Math.round((modifiers.situational.talk || 0) / 3);
                return voice(comp,'trust',{},gamePort.playerTrust() >= threshold ? 'Я начинаю тебе доверять. Посмотрим, как мы поступим дальше.' : 'Я пока осторожничаю. Дай мне немного времени.');
            }
            case 'fear': {
                ai.seen['question:fear:' + (comp.dungeon || 0)] = true;
                const fear = modifiers.situational.fear || 0;
                return voice(comp,'fear',{},ai.stress + fear >= 60 ? 'Мне сейчас тревожно. Давай сначала составим план.' : 'Неизвестность. Мне легче, когда у нас есть план.');
            }
            case 'future': return voice(comp,'future',{},'После долга я хочу выбирать своё дело сама.');
            case 'promise': {
                const kind = ({'promise-share':'fairLoot','promise-risk':'risk','promise-no-danger':'noKnownDanger'})[id] || 'helpDebt';
                const financialKind = id === 'promise-cover' ? 'cover-shortfall' : id === 'promise-if-needed' ? 'exit-shortfall' : 'shared-goal';
                if (!promiseDomain.recordPromise(comp,kind,{kind:financialKind})) return 'У нас уже есть договорённость. Сначала давай разберёмся с ней.';
                return voice(comp,'promise-made',{promise:kind},'Запомню нашу договорённость.');
            }
            case 'apology': {
                const harmNo=ai.timeline.filter(e=>['injury','unfair-loot','forced-risk','broken-promise','player-pressure'].includes(e.type)).at(-1)?.no||0;
                if (ai.seen.apologyFor !== harmNo) {
                    ai.seen.apology = true; ai.seen.apologyFor=harmNo; event(comp, 'apology',{forEvent:harmNo});
                    const forgiveness = Number(modifiers.actions.forgive || 0);
                    const gain = clamp(2 + Math.round((ai.dimensions.sensitivity - 50) / 25) + Math.round(forgiveness / 12), 0, 5);
                    if (gain) gamePort.bumpTrust(gain);
                }
                return voice(comp,'apology',{},'Я услышала. Давай попробуем не повторять это.');
            }
            case 'argue': {
                event(comp, 'player-choice', { key: 'disagree', actor: 'player' });
                const cost = clamp(1 + Math.round((ai.dimensions.pride + ai.dimensions.sensitivity) / 60), 1, 4);
                gamePort.bumpTrust(-cost);
                return voice(comp,'argument',{},'Я выслушаю. Только давай спорить о решении, а не друг о друге.');
            }
            case 'pressure':
                if (gamePort.hasRequestLoot()) { gamePort.requestLoot('pressure'); return comp.line; }
                event(comp, 'player-pressure', { actor: 'player' }); gamePort.bumpTrust(-3); return 'Не дави на меня. Спроси, и я отвечу.';
            case 'survey': return 'Один взгляд ничего не гарантирует. ' + survey(comp, gamePort.advisor()?.facts || gamePort.roomFacts(), gamePort.floor());
            case 'inspect': return 'Дай посмотреть на замок. ' + inspectChest(comp, gamePort.chestAt(selectedChestIndex()));
            case 'deal': return comp.lastLoot?.offer ? 'Свиток можно выкупить за ' + comp.lastLoot.price + ' зол. Это честная цена за находку.' : 'Сейчас у нас нет предмета для сделки.';
            case 'share': return 'Давай обсудим, как поделить находку.';
            case 'help': return 'Давай решим, сколько ты готов передать.';
            case 'topic': return 'Давай сменим тему. О чём хочешь поговорить?';
            default: return ai.drama.pending?.line || comp.line || 'Пока всё спокойно. Давай не терять бдительность.';
        }
    }
    function selectedChestIndex() { return gamePort.selectedChestIndex(); }
    function openDialogueCore(comp, reason = '') {
        const ai = ensure(comp); if (!ai) return;
        const pending = ai.drama.pending;
        if (!ai.dialogueResumeState) ai.dialogueResumeState = { ...ai.behaviorState };
        ai.behaviorState = { root: 'companion', branch: 'relationship', leaf: 'conversation' }; ai.state = 'conversation';
        let opening = reason || comp.line || 'Что хотел спросить?';
        if (!reason && pending) {
            const intent = ({injury:'injury','deadline-near':'deadline','broken-promise':'promise-broken','promise-kept':'promise-kept','debt-help':'thanks','repeated-asks':'refusal'})[pending.type];
            opening = pending.detail.line || (intent ? voice(comp,intent,{promise:pending.detail.key,reason:pending.type === 'repeated-asks' ? 'resentment' : undefined},pending.line) : comp.line || pending.line);
        }
        setDialogue(comp,opening);
        comp.dialogueChoices = availableChoices(comp, selectedChestIndex());
        if (pending) { ai.drama.last = pending.key; ai.drama.pending = null; }
        if (ai.drama.cooldown > 0) ai.drama.cooldown--;
        gamePort.setModal({ type: 'dialogue' });
    }
    function openDialogue(comp, reason = '') {
        if (typeof RogiConversation !== 'undefined')
            return RogiConversation.openDialogue(comp, reason, openDialogueCore);
        return openDialogueCore(comp, reason);
    }
    function markConversation(comp) {
        const ai = ensure(comp); if (!ai) return;
        ai.behaviorState = { root: 'companion', branch: 'relationship', leaf: 'conversation' };
        ai.state = 'conversation';
    }
    function closeDialogue(comp = gamePort.companion()) {
        const ai = ensure(comp); if (!ai) return;
        if (ai.dialogueResumeState) ai.behaviorState = ai.dialogueResumeState;
        else ai.behaviorState = { root: 'companion', branch: 'journey', leaf: ai.stress >= 75 ? 'danger' : 'exploring' };
        ai.state = ai.behaviorState.leaf; ai.dialogueResumeState = null;
    }
    function actCore(comp, id) {
        const definition = ROGI_DIALOGUE_ACTIONS.find(item => item.id === id);
        const effect = definition?.effect;
        if (!definition) return comp.dialogueLine || '';
        if (effect === 'next-page') {
            const selectedTopic = comp.dialogueChoices?.find(choice => choice.id === id);
            const ai = ensure(comp);
            if (selectedTopic) ai.choicePage = selectedTopic.topicPage;
            // Paging the questions must not overwrite an important answer or a long personal story.
            comp.dialogueChoices = availableChoices(comp, selectedChestIndex(), ai.choicePageSize || 3); markConversation(comp);
            gamePort.updateUI();
            return comp.dialogueLine;
        }
        if (typeof RogiVoice !== 'undefined') {
            const n = RogiVoice.state(comp); n.playerActs.push({id,text:definition.text,eventNo:ensure(comp).eventNo});
            if (n.playerActs.length > 12) n.playerActs.shift(); n.textPage = 0;
        }
        const visible = comp.dialogueChoices?.find(item => item.id === id);
        if (visible?.disabled) { setDialogue(comp,visible.disabledReason || 'Сейчас это действие недоступно.'); gamePort.updateUI(); return comp.dialogueLine; }
        if (effect === 'survey' && gamePort.hasAskRoom()) { gamePort.askRoom(); if (gamePort.modalType() === 'dialogue') markConversation(comp); return comp.dialogueLine; }
        if (effect === 'inspect' && gamePort.hasAskChest()) { gamePort.askChest(); if (gamePort.modalType() === 'dialogue') markConversation(comp); return comp.dialogueLine; }
        if (effect === 'buy-loot' && gamePort.hasBuyLoot()) {
            if (gamePort.playerGold() < Number(comp.lastLoot?.price || Infinity)) comp.line = 'Пока у тебя не хватает золота на эту сделку.';
            else gamePort.buyLoot();
            setDialogue(comp,comp.line); comp.dialogueChoices = availableChoices(comp, selectedChestIndex(), ensure(comp).choicePageSize || 3); markConversation(comp);
            gamePort.updateUI(); return comp.dialogueLine;
        }
        if (effect === 'share-loot' && gamePort.hasRequestLoot()) {
            gamePort.requestLoot('polite'); setDialogue(comp,comp.line); ensure(comp).drama.pending = null; comp.dialogueChoices = availableChoices(comp, selectedChestIndex(), ensure(comp).choicePageSize || 3); markConversation(comp);
            gamePort.updateUI(); return comp.dialogueLine;
        }
        if (effect === 'negotiate-loot' && gamePort.hasNegotiateLoot()) {
            gamePort.negotiateLoot(); setDialogue(comp,comp.line); ensure(comp).drama.pending = null;
            comp.dialogueChoices = availableChoices(comp,selectedChestIndex(),ensure(comp).choicePageSize || 3); markConversation(comp);
            gamePort.updateUI(); return comp.dialogueLine;
        }
        if (effect === 'pressure' || effect === 'repeat-pressure') {
            if (gamePort.hasPressureLoot()) gamePort.pressureLoot();
            else dialogue(comp,id);
            setDialogue(comp,comp.line); ensure(comp).drama.pending = null;
            comp.dialogueChoices = availableChoices(comp, selectedChestIndex(), ensure(comp).choicePageSize || 3); markConversation(comp);
            gamePort.updateUI(); return comp.dialogueLine;
        }
        if (effect === 'transfer') {
            closeDialogue(comp);
            gamePort.setModal({ type: 'transfer', amount: Math.min(25, gamePort.playerGold()) });
            return 'Давай решим, сколько ты готов передать.';
        }
        if (effect === 'promise-gift') {
            closeDialogue(comp); gamePort.setModal({type:'transfer',amount:Math.min(25,gamePort.playerGold()),promiseDraft:true});
            gamePort.updateUI();
            return 'Давай договоримся о точной сумме и сроке.';
        }
        const action = dialogue(comp, id);
        setDialogue(comp,action);
        comp.dialogueChoices = availableChoices(comp, selectedChestIndex(), ensure(comp).choicePageSize || 3);
        comp.line = action;
        markConversation(comp);
        gamePort.updateUI();
        return action;
    }
    function act(comp, id, displayed) {
        if (typeof RogiConversation !== 'undefined')
            return RogiConversation.act(comp, id, displayed, actCore);
        return actCore(comp, id);
    }
    const promiseDomain = RogiPromiseDomain.create({ ensure, event, finances, freePlayerGold });
    return {
        MAX_FOCUS, DIMENSIONS, MODIFIER_KEYS, campaignSeed, generateProfile, collectModifiers, create, ensure,
        event, transition, queueDrama, utility, choose, roll, spendFocus, rest, newDungeon, roomTransition,
        endDungeon: promiseDomain.endDungeon, survey, inspectChest, ownsMemory: promiseDomain.ownsMemory,
        recordPromise: promiseDomain.recordPromise, resolvePromise: promiseDomain.resolvePromise,
        reviewFinancialPromise: promiseDomain.reviewFinancialPromise, availableChoices, dialogue,
        openDialogue, markConversation, closeDialogue, act, finances, syncFinances, knowledge,
        refreshMood, moodLabel, voice, setDialogue, goldOfferDecision,
        getGamePort: () => gamePortApi, configureGamePort
    };
})();
