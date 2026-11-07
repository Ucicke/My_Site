/* ================================================================
   SCROLL HUNTER · core/rogi.js
   Роги: знает содержимое сундуков лучше вас, но говорит загадками
   и берёт за это плату. Сначала совет — потом деньги.
   ================================================================ */
'use strict';

/* Услуги текущей комнаты */
let rogi = null;

/* Найден ли свиток Роги */
let rogiQuestFound = false;

/* Последние показанные реплики — чтобы не повторяться */
let rogiSaid = {};

/* Пороги, на которых Роги раскрывается */
const TRUST_STEPS = [25, 50, 75, 100];

/* Доверие может меняться от неприязни до полного расположения. */
function bumpTrust(n) {
    // Once Rogi has left, ordinary events cannot change her relationship.
    if (!n || typeof companion === 'undefined' || !companion.active) return;
    const before = rogiTrust;
    rogiTrust = Math.max(-100, Math.min(100, rogiTrust + n));
    for (const step of TRUST_STEPS) {
        if (before < step && rogiTrust >= step) say('trust' + step);
    }
}

/* Насколько Роги скинет за доверие: до 40% */
function trustDiscount() {
    return rogiTrust > 0 ? (1 - rogiTrust / 250) : 1;
}

/* Роги говорит: выбрать реплику по роду события */
function say(kind) {
    if (typeof companion === 'undefined' || !companion.active) return;
    const pool = (typeof ROGI_LINES !== 'undefined') ? ROGI_LINES[kind] : null;
    if (!pool || !pool.length) return;
    const used = rogiSaid[kind] || [];
    let idx = rogiRandInt(0, pool.length - 1, 'line:' + kind);
    for (let tries = 0; tries < pool.length && used.includes(idx); tries++) {
        idx = rogiRandInt(0, pool.length - 1, 'line:' + kind);
    }
    used.push(idx);
    rogiSaid[kind] = used;
    rogiLine = pool[idx];
    if (rogi) rogi.line = pool[idx];
}

/* Текущая реплика, даже если Роги ещё не появился в комнате */
let rogiLine = '';

/* ---------------------------------------------------------------
   Панель Роги: два вопроса — про сундук и про комнату
   --------------------------------------------------------------- */
/* Как Роги называет свою плату */
function rogiTermsLabel(terms) {
    if (terms === 'hp') return '1 ♥';
    if (terms === 'debt') return 'первая находка — моя';
    if (terms === 'share') return 'половина добычи';
    if (terms === 'insurance') return 'первый укус приму на себя';
    return rogi.chestPrice + ' зол.';
}

/* Панель Роги: собираем данные — рисует их холст */
function renderRogi() {
    if (!rogi || !companion.active) {
        rogiPanelData = null;
        return;
    }

    /* Вопросы: спрашивать можно сколько угодно — Роги берёт плату */
    const freeNow = rogiQuestionFree();
    const questions = [];
    if (selected >= 0) {
        questions.push({
            title: 'СПРОСИТЬ ПРО СУНДУК №' + (selected + 1),
            cost: freeNow ? 'бесплатно' : rogiTermsLabel(rogi.terms),
            action: askRogiChest
        });
    }
    questions.push({
        title: 'СПРОСИТЬ ПРО КОМНАТУ',
        cost: freeNow ? 'бесплатно' : (rogi.roomPrice + ' зол.'),
        action: askRogiRoom
    });

    let note = '';
    if (rogiTrust >= 75) note = 'первый вопрос — бесплатно';
    else if (rogiTrust >= 25) note = 'скидка ' + Math.round((1 - trustDiscount()) * 100) + '%';

    rogiPanelData = {
        mood: rogi.mood || '',
        line: rogi.line || '',
        trust: rogiTrust,
        quest: rogiQuestFound,
        note: note,
        questions: questions,
        height: 128
    };
}

/* ---------------------------------------------------------------
   Тип сундука: relic | mimic | empty.
   Считаем всегда от type — он меняется от проклятий, оберега,
   огненного шара и перестановок, а поле kind могло устареть.
   --------------------------------------------------------------- */
function chestKind(c) {
    if (!c) return 'empty';
    if (c.type === 'scroll') return 'relic';
    if (c.type === 'mimic') return 'mimic';
    return 'empty';
}

/* ---------------------------------------------------------------
   Факты о комнате — на них опираются загадки
   --------------------------------------------------------------- */
function roomFacts() {
    const n = chests.length;
    const kinds = chests.map(chestKind);
    const mimics = chests.map((c, i) => (chestKind(c) === 'mimic' ? i : -1)).filter(i => i >= 0);
    const relics = chests.map((c, i) => (chestKind(c) === 'relic' ? i : -1)).filter(i => i >= 0);
    const empties = chests.map((c, i) => (chestKind(c) === 'empty' ? i : -1)).filter(i => i >= 0);
    const mid = Math.floor(n / 2);
    const leftMimics = mimics.filter(i => i < n / 2).length;
    const rightMimics = mimics.filter(i => i >= n / 2).length;
    return {
        n: n,
        kinds: kinds,
        mimics: mimics,
        relics: relics,
        empties: empties,
        mid: mid,
        oneMimic: mimics.length === 1,
        edgesSafe: mimics.length > 0 && mimics.every(i => i > 0 && i < n - 1),
        mimicsAtEdges: mimics.length > 0 && mimics.every(i => i === 0 || i === n - 1),
        edgeNoRelic: relics.every(i => i > 0 && i < n - 1),
        middleSafe: n >= 5 && chests.every((c, i) => (i < mid - 1 || i > mid + 1) ? chestKind(c) !== 'mimic' : true),
        centerSafe: n >= 3 && chests.every((c, i) => Math.abs(i - mid) <= 1 ? chestKind(c) !== 'mimic' : true),
        doubleRatio: empties.length > 0 && mimics.length === empties.length * 2,
        moreLeft: leftMimics > rightMimics,
        moreRight: rightMimics > leftMimics,
        mostSafe: mimics.length * 2 < n,
        evenMimic: mimics.length === 1 && mimics[0] % 2 === 1,
        /* «полная противоположность» = на краях реликвия и мимик */
        mirrorOpposite: n >= 2 &&
            ((kinds[0] === 'mimic' && kinds[n - 1] === 'relic') ||
                (kinds[0] === 'relic' && kinds[n - 1] === 'mimic')),
        bestChest: relics.length ? relics[0] : (n ? n - 1 : 0),
        riskiest: mimics.length ? mimics[0] : 0
    };
}

/* ---------------------------------------------------------------
   Цена совета: динамическая, зависит от ценности комнаты
   --------------------------------------------------------------- */
/* Итоговая скидка: доверие + бонусы */
function rogiPriceFactor() {
    let f = trustDiscount();
    f *= (1 - (boosts.rogiDiscount || 0));
    f *= (1 - (giftFlags.rogiDiscount || 0));
    return Math.max(0.25, f);
}

/* Бесплатный ли этот совет */
function rogiQuestionFree() {
    if (boosts.freeFirstAsk) return true;
    if (rogiTrust >= 75 && rogi && !rogi.freeAskUsed) return true;
    if (rogiAsks > 0) return true;
    if (boosts.freeChecks > 0) return true;
    return false;
}

/* Списать бесплатный совет */
function rogiConsumeFree() {
    if (boosts.freeFirstAsk) { boosts.freeFirstAsk = false; return; }
    if (rogiTrust >= 75 && rogi && !rogi.freeAskUsed) { rogi.freeAskUsed = true; return; }
    if (rogiAsks > 0) { rogiAsks--; return; }
    if (boosts.freeChecks > 0) { boosts.freeChecks--; return; }
}

function rogiPrice() {
    /* база — средняя стоимость реликвии на текущей глубине */
    let avg = 30;
    const sample = SCROLL_TYPES.filter(s => s.price > 0);
    if (sample.length) {
        avg = sample.reduce((s, x) => s + x.price, 0) / sample.length;
        avg = avg * depthMultiplier(floor);
    }
    let price = Math.round(avg * randFloat(0.12, 0.45));
    price = Math.max(5, price);
    /* на последнем сердце всё дорожает */
    if (hp <= 1) price = Math.round(price * 2);
    /* за доверие и бонусы — скидка */
    price = Math.max(1, Math.round(price * rogiPriceFactor()));
    return price;
}

function randFloat(a, b) { return a + RogiAI.roll(companion, 'advice-price') * (b - a); }
function rogiRandInt(min, max, key = 'legacy-dialogue') { return min + Math.floor(RogiAI.roll(companion, key) * (max - min + 1)); }

/* ---------------------------------------------------------------
   Роги появился в комнате: назначает цены и условия
   --------------------------------------------------------------- */
function spawnRogi() {
    if (!companion.active) { rogi = null; return; }
    const facts = roomFacts();
    const chestPrice = rogiPrice();

    /* Иногда он работает не за золото, а за сделку */
    const r = RogiAI.roll(companion, 'spawn-terms');
    let terms = 'gold';

    /* при большом доверии он сам заговаривает о том, что ищет */
    if (rogiTrust >= 50 && !rogiQuestFound && RogiAI.roll(companion, 'spawn-quest') < 0.22) say('quest');
    else if (RogiAI.roll(companion, 'spawn-line') < 0.5) say('enter');

    /* при большом доверии он делится своими мыслями */
    let opening = rogiLine;
    if (!opening && typeof ROGI_THOUGHTS !== 'undefined') {
        const pool = rogiTrust >= 50 && ROGI_LINES.partner
            ? ROGI_LINES.partner.concat(ROGI_THOUGHTS)
            : ROGI_THOUGHTS;
        opening = pool[rogiRandInt(0, pool.length - 1, 'spawn-opening')];
    }

    rogi = {
        freeAskUsed: false,
        line: opening,
        mood: RogiMoods[rogiRandInt(0, RogiMoods.length - 1, 'spawn-mood')],
        facts: facts,
        chestPrice: chestPrice,
        roomPrice: Math.max(3, Math.round(chestPrice * 1.6)),
        terms: terms,
        riddle: null
    };
}

const RogiMoods = [
    'Роги поправляет фиолетовый капюшон.',
    'Роги ковыряет в замке отмычкой.',
    'Роги сидит на перевёрнутом ящике и смотрит исподлобья.',
    'Роги считает монеты, насвистывая.',
    'Роги точит нож о сундук и не смотрит на вас.'
];

/* ---------------------------------------------------------------
   Спросить Роги про сундук
   --------------------------------------------------------------- */
function askRogiChest() {
    if (!rogi || !companionAvailable() || gameState !== STATES.CHOOSE || performance.now() < companionAdviceUntil) return;
    const sel = selected;
    if (sel < 0 || !chests[sel] || chests[sel].opened) {
        lastEvent = 'Сначала выбери сундук.';
        updateUI();
        return;
    }
    if (chests[sel].adviceBought) { lastEvent = 'Я уже рассказала об этом сундуке.'; updateUI(); return; }
    if (RogiAI.ensure(companion).focus < 1) { lastEvent = 'У Роги не осталось сосредоточенности для проверки. Отдохните у костра или дождитесь следующего похода.'; RogiAI.setDialogue(companion,lastEvent); updateUI(); return; }

    /* Сначала — деньги (иначе он промолчит), потом — загадка */
    const free = rogiQuestionFree();
    const pay = takeRogiPayment(rogi.terms, free);
    if (!pay.ok) {
        lastEvent = pay.text;
        RogiAI.setDialogue(companion,pay.text);
        updateUI();
        return;
    }
    RogiAI.spendFocus(companion, 1, 'inspect-chest');
    rogiConsumeFree();
    companionAdviceUntil = performance.now() + 350;
    chests[sel].adviceBought = true;
    /* сделка вроде «долг» — только за первый совет в комнате */
    if (rogi.terms !== 'gold') rogi.terms = 'gold';

    /* Проверка касается только выбранного сундука. Для комнаты в целом точные позиции скрыты. */
    let say = RogiAI.inspectChest(companion, chests[sel]);
    let lied = false;
    if (boosts.lieNext) {
        boosts.lieNext = false;
        lied = true;
        chests[sel].known = null;
        chests[sel].rogiKnowledge = {kind:'unknown',source:'contradictory-signs',willingToShare:true,shared:false};
        say = 'С этим замком что-то не сходится. Я могла ошибиться — лучше не считай это точным знанием.';
    }
    lastEvent = say + '  (' + pay.text + ')';
    rogiMsg = 'РОГИ: ' + say;
    RogiAI.setDialogue(companion,say);
    Sfx.play('click');
    updateUI();
}

/* ---------------------------------------------------------------
   Спросить Роги про комнату
   --------------------------------------------------------------- */
function askRogiRoom() {
    if (!rogi || !companionAvailable() || gameState !== STATES.CHOOSE || performance.now() < companionAdviceUntil) return;
    if (rogi.roomAdviceBought) { lastEvent = 'Совет об этой комнате уже получен.'; updateUI(); return; }
    if (RogiAI.ensure(companion).focus < 1) { lastEvent = 'У Роги не осталось сосредоточенности для разведки. Отдохните у костра или дождитесь следующего похода.'; RogiAI.setDialogue(companion,lastEvent); updateUI(); return; }

    const free = rogiQuestionFree();
    const pay = takeRogiPayment('gold', free, rogi.roomPrice);
    if (!pay.ok) {
        lastEvent = pay.text;
        RogiAI.setDialogue(companion,pay.text);
        updateUI();
        return;
    }
    RogiAI.spendFocus(companion, 1, 'survey-room');
    rogiConsumeFree();
    companionAdviceUntil = performance.now() + 350;
    rogi.roomAdviceBought = true;

    const facts = roomFacts();
    const broadAdvice = RogiAI.survey(companion, facts, floor);
    const clueIndex = chests.findIndex(chest => !chest.opened && !chest.destroyed && !chest.known);
    let positionClue = '';
    if (clueIndex >= 0) {
        const chest = chests[clueIndex];
        chest.known = chest.type === 'scroll' ? 'scroll' : chest.type === 'mimic' ? 'mimic' : 'empty';
        chest.rogiKnowledge = { kind:chest.known, source:'paid-room-survey', willingToShare:true, shared:true,
            eventNo:RogiAI.ensure(companion).eventNo };
        positionClue = chest.known === 'mimic'
            ? ' А в сундуке №' + (clueIndex + 1) + ' я заметила следы зубов.'
            : chest.known === 'scroll'
                ? ' В сундуке №' + (clueIndex + 1) + ' есть свиток.'
                : ' Сундук №' + (clueIndex + 1) + ' пуст.';
    }
    const text = broadAdvice + positionClue;

    lastEvent = text + '  (' + pay.text + ')';
    rogiMsg = 'РОГИ: ' + text;
    RogiAI.setDialogue(companion,text);
    Sfx.play('click');
    updateUI();
}

/* ---------------------------------------------------------------
   Плата: Роги сначала говорит, потом забирает своё
   --------------------------------------------------------------- */
function takeRogiPayment(terms, free, price) {
    if (!companionAvailable()) return { ok: false, text: 'Роги сейчас не может помочь.' };
    if (free) return { ok: true, text: 'бесплатно' };
    if (terms !== 'insurance' && metaRogueMercy()) {
        return { ok: true, text: 'Роги решила помочь бесплатно.' };
    }
    if (terms === 'hp') {
        if (hp <= 1) return { ok: false, text: 'Роги вздыхает: на такие советы у меня самого не хватает.' };
        hp--;
        return { ok: true, text: '−1 ♥' };
    }
    if (terms === 'debt') {
        boosts.rogiDebt = true;
        return { ok: true, text: 'долг: первая находка моя' };
    }
    if (terms === 'share') {
        boosts.rogiShare = 0.5;
        return { ok: true, text: 'половина добычи' };
    }
    if (terms === 'insurance') {
        boosts.rogiInsurance = true;
        return { ok: true, text: 'страховка: первый укус мой' };
    }
    /* золото */
    const sum = (typeof price === 'number') ? price : rogi.chestPrice;
    if (gold < sum) return { ok: false, text: 'Роги качает головой: не хватает золота.' };
    gold -= sum;
    companion.gold += sum;
    return { ok: true, text: '−' + sum + ' зол.' };
}

/* ---------------------------------------------------------------
   Загадка про сундук: Роги знает тип и намекает на него
   --------------------------------------------------------------- */
function rogiRiddleForChest(kind) {
    const definite = ROGI_CHEST_RIDDLES.filter(r => r.reveals.length === 1 && r.reveals[0] === kind);
    const vague = ROGI_CHEST_RIDDLES.filter(r => r.reveals.length > 1 && r.reveals.indexOf(kind) >= 0);

    let pool;
    if (definite.length && (!vague.length || RogiAI.roll(companion, 'legacy-chest-riddle') < 0.55)) pool = definite;
    else pool = vague.length ? vague : definite;
    if (!pool.length) pool = ROGI_CHEST_RIDDLES;
    return pool[rogiRandInt(0, pool.length - 1, 'legacy-chest-riddle')];
}

/* Загадка превращается в знание о сундуке */
function applyRiddleToChest(c, riddle) {
    if (!c) return;
    const r = riddle.reveals;
    if (r.length === 1) {
        if (r[0] === 'mimic') c.known = 'mimic';
        else if (r[0] === 'relic') c.known = 'scroll';
        else c.known = 'empty';
    } else if (r.indexOf('mimic') < 0) {
        c.known = 'safe';        /* не мимик */
    } else {
        c.known = 'not_empty';   /* не пусто */
    }
}

/* ---------------------------------------------------------------
   Загадка про комнату: проверяем, что она правдива
   --------------------------------------------------------------- */
function roomRiddleTrue(mode, facts) {
    switch (mode) {
        case 'one_mimic': return facts.oneMimic;
        case 'more_left': return facts.moreLeft;
        case 'more_right': return facts.moreRight;
        case 'edge_safe': return facts.edgesSafe;
        case 'even_mimic': return facts.evenMimic;
        case 'mirror_opposite': return facts.mirrorOpposite;
        case 'double_ratio': return facts.doubleRatio;
        case 'most_safe': return facts.mostSafe;
        case 'edges_mimics': return facts.mimicsAtEdges;
        case 'edge_no_relic': return facts.edgeNoRelic;
        case 'center_safe': return facts.centerSafe;
        case 'pair_one_mimic': return facts.mimics.length > 0 && facts.mimics.length < facts.n;
        case 'neighbours_safe':
            return selected > 0 && selected < facts.n - 1 &&
                chestKind(chests[selected - 1]) !== 'mimic' && chestKind(chests[selected + 1]) !== 'mimic';
        case 'pair_empty': return facts.empties.length > 0 && facts.empties.length < facts.n;
        default: return false;
    }
}

/* Выбрать загадку про комнату.
   Факты считаем заново: комната могла измениться после появления Роги
   (проклятие, огненный шар, перестановка). */
function rogiRoomRiddle() {
    const facts = roomFacts();
    rogi.facts = facts;
    const pool = ROGI_ROOM_RIDDLES.filter(r => roomRiddleTrue(r.mode, facts));
    if (!pool.length) {
        return { id: 'fallback', mode: 'none', cat: 'logic', text: 'В этой комнате я не чувствую ничего особенного. Пустые глаза.' };
    }
    return pool[rogiRandInt(0, pool.length - 1, 'legacy-room-riddle')];
}

/* Загадка про комнату может кое-что пометить */
/* Загадка про комнату может кое-что пометить */
function applyRoomRiddle(riddle) {
    const facts = rogi.facts;
    if (riddle.mode === 'center_safe') {
        const mid = facts.mid;
        chests.forEach((x, i) => {
            if (Math.abs(i - mid) <= 1) x.known = chestKind(x) === 'mimic' ? 'mimic' : 'safe';
        });
    } else if (riddle.mode === 'edge_safe') {
        if (chests[0]) chests[0].known = chestKind(chests[0]) === 'mimic' ? 'mimic' : 'safe';
        if (chests[facts.n - 1]) chests[facts.n - 1].known = chestKind(chests[facts.n - 1]) === 'mimic' ? 'mimic' : 'safe';
    } else if (riddle.mode === 'pair_one_mimic') {
        /* один — точно мимик, второй — точно безопасный */
        const a = facts.mimics[rogiRandInt(0, facts.mimics.length - 1, 'legacy-room-hint')];
        const safeIdx = [];
        for (let i = 0; i < facts.n; i++) {
            if (i !== a && chestKind(chests[i]) !== 'mimic') safeIdx.push(i);
        }
        if (!safeIdx.length) return riddle.text;
        const b = safeIdx[rogiRandInt(0, safeIdx.length - 1, 'legacy-room-hint')];
        chests[a].known = 'mimic';
        chests[b].known = 'safe';
        return riddle.text + ' (сундуки ' + (a + 1) + ' и ' + (b + 1) + ')';
    } else if (riddle.mode === 'pair_empty') {
        /* в паре ровно один пустой */
        const a = facts.empties[rogiRandInt(0, facts.empties.length - 1, 'legacy-room-hint')];
        const otherIdx = [];
        for (let i = 0; i < facts.n; i++) {
            if (i !== a && chestKind(chests[i]) !== 'empty') otherIdx.push(i);
        }
        if (!otherIdx.length) return riddle.text;
        const b = otherIdx[rogiRandInt(0, otherIdx.length - 1, 'legacy-room-hint')];
        chests[a].known = 'empty';
        chests[b].known = 'not_empty';
        return riddle.text + ' (сундуки ' + (a + 1) + ' и ' + (b + 1) + ')';
    } else if (riddle.mode === 'neighbours_safe') {
        if (selected > 0) chests[selected - 1].known = chestKind(chests[selected - 1]) === 'mimic' ? 'mimic' : 'safe';
        if (selected < facts.n - 1) chests[selected + 1].known = chestKind(chests[selected + 1]) === 'mimic' ? 'mimic' : 'safe';
    } else if (riddle.mode === 'mirror_opposite') {
        chests[0].known = chestKind(chests[0]) === 'mimic' ? 'mimic' : 'scroll';
        chests[facts.n - 1].known = chestKind(chests[facts.n - 1]) === 'mimic' ? 'mimic' : 'scroll';
    }
    return riddle.text;
}

/* Открыть знание о сундуке */
function revealChest(i) {
    const c = chests[i];
    if (!c) return;
    c.known = chestKind(c) === 'mimic' ? 'mimic' : 'safe';
}
