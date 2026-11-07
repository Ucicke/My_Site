/* Narrative expression is downstream of decisions. No currency, trust, HP or utility mutations here. */
'use strict';
const RogiVoice = (() => {
    const STYLES = {
        bold: {
            trust: 'Я готова идти рядом. Только риск давай принимать по очереди, а не по привычке.',
            fear: 'Боюсь не сундуков самих по себе, а того, что однажды полезу вперёд, не подумав. Напомни мне остановиться, если понадобится.',
            support: 'Заметил? Хорошо. Я тоже вижу, когда мы справляемся вместе.',
            agree: 'Попробую. Давай только сразу договоримся: за мой риск тоже полагается доля.',
            injury: 'Попалась. Ладно, сначала переведу дух, потом будем решать, куда лезть дальше.'
        },
        cautious: {
            trust: 'Я начинаю полагаться на тебя. Но мне всё ещё спокойнее, когда мы заранее обсуждаем опасность.',
            fear: 'Больше всего меня тревожит то, чего мы ещё не проверили. Я лучше потрачу минуту на следы и замок, чем буду потом жалеть о спешке.',
            support: 'Спасибо. Мне легче собраться, когда осторожность не принимают за трусость.',
            agree: 'Хорошо. Я не стану торопиться с замком. Если замечу что-то важное, скажу.',
            injury: 'Надо было внимательнее. Я жива, но прежде чем продолжим, хочу спокойно оценить риск.'
        },
        warm: {
            trust: 'Мне хочется верить, что мы друг друга не бросим. Пока я выбираю идти с тобой.',
            fear: 'Страшнее всего, когда кто-то рядом страдает, а я не успеваю помочь. Только не проси меня делать вид, что мне всё равно.',
            support: 'Спасибо. Я рада, что от меня есть толк. И ты тоже не обязан вытягивать всё в одиночку.',
            agree: 'Давай я попробую. Побереги силы и подстрахуй, если что-то пойдёт не так.',
            injury: 'Досталось. Ты цел? Хорошо. Теперь дай и мне немного прийти в себя.'
        },
        pragmatic: {
            trust: 'Я ценю ясные договорённости. Если будем соблюдать их оба, мне будет проще на тебя положиться.',
            fear: 'Боюсь остаться без выхода и без запаса. Мне нужен план, в котором мы сможем позволить себе ошибку.',
            support: 'Спасибо. Значит, мой вклад заметен. Давай и дальше честно считать, кто чем рискует.',
            agree: 'Могу попробовать. Но о праве на находку договоримся заранее, хорошо?',
            injury: 'Это обошлось мне больнее, чем хотелось. Следующий риск надо оценить трезвее.'
        },
        proud: {
            trust: 'Я с тобой по собственной воле. Уважай мой выбор — тогда смогу доверять и твоему.',
            fear: 'Страх у меня есть. Только не решай за меня, что я из-за него могу или не могу сделать.',
            support: 'Я умею справляться. Но приятно, что ты заметил, а не принял это как должное.',
            agree: 'Я согласна попробовать. Согласна — это важная часть, не пропусти её.',
            injury: 'Я справлюсь. Только не надо сейчас объяснять мне, что я должна была сделать.'
        },
        reserved: {
            trust: 'Пока мне проще показать доверие делом. Со словами давай не торопиться.',
            fear: 'Не всё, что меня пугает, я готова обсуждать. Но если что-то помешает нам идти дальше, постараюсь сказать.',
            support: 'Спасибо. Я услышала. Мне просто нужно немного времени, чтобы привыкнуть к таким словам.',
            agree: 'Попробую. Дай мне спокойно посмотреть на замок.',
            injury: 'Больно. Сейчас помолчу немного, ладно? Потом решим, как идти дальше.'
        },
        candid: {
            trust: 'Мне легко захотеть довериться человеку. Я стараюсь всё-таки смотреть и на поступки. С тобой хочу попробовать.',
            fear: 'Иногда боюсь слишком быстро поверить хорошим словам. Неприятно признавать, но такое со мной бывает.',
            support: 'Спасибо! Я сразу начинаю чувствовать себя смелее. Только давай всё равно без лишнего риска.',
            agree: 'Хорошо, попробую. Ты рядом — уже легче собраться.',
            injury: 'Ай. Я надеялась, что обойдётся. Побудь рядом, пока перестану злиться на собственную удачу.'
        },
        wry: {
            trust: 'Пока я всё ещё иду рядом. Для меня это довольно убедительная форма доверия, даже без торжественной речи.',
            fear: 'Неизвестность меня не радует. Я предпочитаю, чтобы неприятности хотя бы представлялись, прежде чем кусать.',
            support: 'Спасибо. Редкий случай: меня оценили раньше, чем потребовалась следующая услуга.',
            agree: 'Ладно, посмотрим. Хорошо бы замок оказался разговорчивее содержимого.',
            injury: 'Ну вот. У сундука были возражения, и он выразил их зубами. Мне нужна передышка.'
        }
    };
    const PROMISE_NAMES = {
        risk: 'взять следующий риск на себя',
        noKnownDanger: 'не посылать меня к уже известному мимику',
        fairLoot: 'обсуждать спорную находку честно, без давления'
    };
    function state(comp) {
        const ai = RogiAI.ensure(comp);
        ai.narrative ||= {};
        const n = ai.narrative;
        n.serial ||= 0; n.mentions ||= {}; n.disclosures ||= {}; n.utterances ||= []; n.playerActs ||= [];
        n.textPage ||= 0;
        return n;
    }
    function style(comp) {
        const ai = RogiAI.ensure(comp), p = ai.profile, d = ai.dimensions, m = RogiAI.collectModifiers(p).situational;
        const ids = new Set([...p.traits, p.flaw].map(x => x.id));
        const scores = {
            bold: (d.courage - 50) * 1.15,
            cautious: (d.caution - d.courage) * 0.8 + (m.fear || 0),
            warm: (d.generosity - 50) * 1.15 + (d.cooperation - 50) * 0.35 + (m.loyalty || 0) * 0.3,
            pragmatic: (d.pragmatism - 50) * 0.8 + (m.greed || 0) * 2,
            proud: (d.pride - 50) + (d.independence - 50) * 0.6,
            reserved: -(m.talk || 0) * 2 - Math.min(0, m.trust || 0) * 2,
            candid: ids.has('too-trusting') ? 60 : Math.max(0, m.talk || 0),
            wry: (m.humor || 0) * 2 + (ids.has('sarcasm-shield') || ids.has('dry-sarcasm') ? 22 : 0)
        };
        return Object.keys(scores).sort((a,b) => scores[b] - scores[a] || a.localeCompare(b))[0];
    }
    function facts(comp, context = {}) {
        const ai = RogiAI.ensure(comp), finance = RogiAI.finances(comp);
        const trust = typeof rogiTrust === 'number' ? rogiTrust : Number(context.trust || 0);
        const knowledge = context.chest ? RogiAI.knowledge(comp, context.chest) : null;
        return { ...finance, hp: comp.hp, maxHp: comp.maxHp || 3, focus: ai.focus, stress: ai.stress, trust,
            knownDanger: knowledge?.shared === 'mimic', knowledge, mood: ai.mood, profile: ai.profile };
    }
    function relevantMemory(comp, intent, context = {}) {
        const ai = RogiAI.ensure(comp), n = state(comp);
        const relevance = {
            trust: { 'broken-promise': 12, 'promise-kept': 10, 'debt-help': 9, 'injury': 7, 'player-fair-deal': 8, support: 5 },
            fear: { injury: 12, 'known-danger': 8, 'forced-risk': 6 },
            support: { injury: 9, 'debt-help': 6, 'broken-promise': 7 },
            'world-camp': { injury: 10, 'debt-help': 6, support: 5 },
            refusal: { injury: 11, 'forced-risk': 9, 'broken-promise': 10 },
            apology: { 'broken-promise': 13, 'player-pressure': 10, injury: 8 },
            argument: { 'player-pressure': 10, 'broken-promise': 10 },
            thanks: { 'debt-help': 12 },
            'pressure-keep': { 'broken-promise': 12, 'player-pressure': 10 },
            'promise-broken': { 'broken-promise': 15 }
        }[intent] || {};
        const candidates = ai.timeline.filter(e => relevance[e.type] && e.no < ai.eventNo + 1 &&
            !(context.excludeCurrent && e.no === ai.eventNo) && (n.serial - (n.mentions[e.no] ?? -100) > 3));
        candidates.sort((a,b) => {
            const score = e => relevance[e.type] * 10 + (['broken-promise','injury'].includes(e.type) ? 18 : 0) - Math.min(70, ai.eventNo - e.no) * 0.8;
            return score(b) - score(a) || b.no - a.no;
        });
        return candidates[0] || null;
    }
    function promiseDescription(comp, kind, recordedContract) {
        const p = recordedContract ? {contract:recordedContract} : comp.ai.promises[kind];
        if (kind !== 'helpDebt') return PROMISE_NAMES[kind] || 'сдержать слово';
        return p?.contract?.kind === 'fixed-gift' ? 'передать мне ' + p.contract.amount + ' зол. к выходу'
            : p?.contract?.kind === 'shared-goal' ? 'помочь мне собрать недостающие средства'
                : p?.contract?.kind === 'cover-shortfall' ? 'полностью покрыть то, чего мне не хватит к выходу'
                    : 'помочь, если на выходе моих средств не хватит';
    }
    function memoryLine(comp, memory) {
        switch (memory.type) {
            case 'injury': return 'После того укуса мне нужно чуть больше осторожности.';
            case 'debt-help': return 'Я помню, что ты передал мне ' + Number(memory.detail.amount || 0) + ' зол.';
            case 'broken-promise': return 'Ты обещал ' + promiseDescription(comp, memory.detail.key, memory.detail.contract) + '. Для меня это ещё не забытый разговор.';
            case 'promise-kept': return 'Ты уже сдержал данное мне слово. Я это помню.';
            case 'player-fair-deal': return 'Мы уже сумели договориться о находке по-честному.';
            case 'player-pressure': return 'После твоего требования мне труднее спокойно обсуждать добычу.';
            case 'forced-risk': return 'Я помню, как ты просил меня принять риск.';
            case 'known-danger': return 'Мы уже встречали известную опасность. Хочу, чтобы такие решения мы обсуждали.';
            case 'support': return 'И твою поддержку я тоже помню.';
            default: return '';
        }
    }
    function financialLine(f, intent) {
        if (intent === 'debt') return 'Мой долг — ' + f.debt + ' зол. У меня ' + f.cash + '.' +
            (f.cash >= f.debt ? ' На выплату уже хватает.' : f.shortLiquid === 0 ? ' Если продам свои свитки на выходе, денег должно хватить.' : ' Даже с продажей свитков пока не хватает ' + f.shortLiquid + '.');
        if (intent === 'loot-give') return f.cash >= f.debt ? 'Я уже могу расплатиться. Держи свиток.'
            : f.shortLiquid === 0 ? 'Если продам оставшиеся свитки, на долг должно хватить. Этот можешь взять.'
                : 'Мне всё ещё не хватает денег, но я хочу тебе помочь. Забирай свиток.';
        if (intent === 'thanks') return f.cash >= f.debt ? 'Теперь у меня хватает монет на выплату. Спасибо за помощь.'
            : f.shortLiquid === 0 ? 'Спасибо. Если продам свои свитки, вместе с этими монетами должно хватить.'
                : 'Спасибо. Помощь пришлась кстати. Даже с продажей свитков мне пока не хватает ' + f.shortLiquid + ' зол.';
        return '';
    }
    function compose(comp, intent, context = {}) {
        const ai = RogiAI.ensure(comp), n = state(comp), f = facts(comp, context), selectedStyle = style(comp);
        const m = RogiAI.collectModifiers(ai.profile).situational, lines = STYLES[selectedStyle], claims = [];
        let text = '', disclosure = null, memory = null;
        const financial = ['debt','thanks','loot-give'].includes(intent);
        if (financial) {
            text = financialLine(f, intent);
            claims.push({ kind: 'finance', cash: f.cash, debt: f.debt, liquid: f.liquid, shortLiquid: f.shortLiquid });
            if (intent === 'thanks') text += selectedStyle === 'proud' ? ' Только давай без условий о моём послушании.' : (m.askHelp || 0) <= -8 ? ' Мне нелегко принимать такую помощь.' : selectedStyle === 'warm' ? ' Я не забуду, что мы здесь не поодиночке.' : selectedStyle === 'wry' ? ' Приятно, когда у монет нет скрытых зубов.' : '';
        } else if (intent === 'trust') {
            text = f.trust < -20 ? (selectedStyle === 'proud' ? 'Сейчас — нет. Но я предпочту честно сказать это, а не делать вид, что всё в порядке.' : 'Мне пока трудно на тебя положиться. Я хочу увидеть, что мои решения и риск тоже что-то значат.')
                : f.trust < 10 ? (selectedStyle === 'candid' ? 'Хочется довериться, но я попробую не спешить. Давай сначала узнаем друг друга в деле.' : 'Я пока присматриваюсь. Дай мне время увидеть, как мы поступаем, когда становится трудно.') : lines.trust;
        } else if (intent === 'fear') {
            text = f.hp <= 1 ? 'Сейчас меня пугает, что сил почти не осталось. Мне бы добраться до отдыха, а потом уже говорить о храбрости.' : lines.fear;
            if (f.hp <= 1) claims.push({ kind:'low-health' });
        } else if (intent === 'support') text = lines.support;
        else if (intent === 'agree') text = context.method === 'break' ? (selectedStyle === 'proud' ? 'Я согласна сломать замок. Но риск испортить находку никуда не делся.' : 'Попробую разбить замок. Только содержимое может не пережить удар.') : lines.agree;
        else if (intent === 'refusal') {
            switch (context.reason) {
                case 'exhaustion': text = 'Не хватает сосредоточенности. Дай мне отдохнуть у костра; к следующему походу я тоже восстановлю силы.'; claims.push({kind:'insufficient-focus', cost:context.focusCost || 1}); break;
                case 'injured': text = 'Я ранена и сейчас не могу открыть сундук. Сначала нужен отдых у костра.'; claims.push({kind:'incapacitated'}); break;
                case 'promise-risk': text = 'Ты обещал принять следующий риск на себя. Этот сундук открой сам.'; claims.push({kind:'promise-active',promise:'risk'}); break;
                case 'promise-danger': text = 'Ты обещал не посылать меня в уже известную опасность. Этот сундук открой сам.'; claims.push({kind:'promise-active',promise:'noKnownDanger'},{kind:'known-danger'}); break;
                case 'danger': text = selectedStyle === 'proud' ? 'Я вижу следы мимика и сама решаю сейчас не лезть. Не заставляй меня повторять.' : selectedStyle === 'cautious' ? 'Следы пасти мы уже видели. Я не хочу снова проверять их собой. В этот раз открой сам.' : 'Мы знаем о мимике. Я не готова принять этот риск — давай ты.'; claims.push({kind:'known-danger'}); break;
                case 'resentment': text = 'Ты снова просишь меня рисковать. После того, что между нами было, мне сначала нужен разговор.'; break;
                case 'pride': text = 'Не командуй. Я услышала, чего ты хочешь, и сейчас не согласна.'; break;
                default: text = selectedStyle === 'cautious' ? 'Пока слишком много неизвестного. Я лучше откажусь сейчас, чем полезу через силу.' : 'Я слишком напряжена, чтобы сейчас рисковать. Дай мне перевести дух.';
            }
        } else if (intent === 'injury') {
            text = f.hp <= 0 ? 'Не могу продолжать. Мне нужен отдых у костра, прежде чем я снова возьмусь за сундуки.' : lines.injury;
            claims.push({ kind:'health', value:f.hp });
        } else if (intent === 'loot-keep') {
            text = f.shortLiquid > 0 ? (selectedStyle === 'pragmatic' ? 'Этот свиток оставлю себе. Денег на выплату ещё не хватает, и я не хочу считать их дважды.' : 'Я рисковала ради этой находки. Пока мне ещё нужно собирать на долг, оставлю её себе.')
                : f.cash >= f.debt ? 'У меня уже хватает монет на выплату, но эту находку хочу пока сохранить. Она для меня не только цена.'
                    : 'Если продам свои свитки, на долг должно хватить. Но эту находку пока хочу оставить при себе.';
            claims.push({kind:'finance',cash:f.cash,debt:f.debt,liquid:f.liquid,shortLiquid:f.shortLiquid});
        }
        else if (intent === 'loot-offer') text = 'Свиток пока мой. Могу отдать его за ' + context.price + ' зол. — так моя доля не пропадёт.';
        else if (intent === 'loot-split') text = 'Я нашла его, но мы оба сюда дошли. Давай обсудим выкуп за ' + context.price + ' зол. или оставим решение до лавки.';
        else if (intent === 'loot-defer') text = 'Хочу пока оставить свиток при себе. Обсудим продажу, когда сможем спокойно оценить, что нам нужно.';
        else if (intent === 'pressure-keep') text = selectedStyle === 'proud' ? 'Нет. Ты можешь спорить со мной, но приказ не сделает этот свиток твоим.' : selectedStyle === 'wry' ? 'От более громкого требования владелец не меняется. Свиток остаётся у меня.' : 'Нет, я не согласна отдавать его под давлением. Давай либо договариваться, либо закончим этот спор.';
        else if (intent === 'pressure-give') text = 'Ладно, свиток твой. Но то, как ты его потребовал, мне не понравилось.';
        else if (intent === 'pressure-counter') text = 'Дарить под нажимом не буду. Если хочешь договориться, предлагаю выкуп за ' + context.price + ' зол.';
        else if (intent === 'pressure-end' || intent === 'pressure-repeat') text = selectedStyle === 'proud' ? 'Хватит. Моё решение ты услышал. Этот разговор закончен.' : 'Я уже ответила. Повторять требование не нужно — обсуждать этот свиток дальше я не буду.';
        else if (intent === 'negotiation-refuse') text = 'Сейчас не хочу продавать эту находку. Если решу иначе, скажу сама.';
        else if (intent === 'trade') text = 'Договорились. Свиток твой, монеты мои. Спасибо, что обошлись без спора.';
        else if (intent === 'help-refuse') text = selectedStyle === 'proud' ? 'Если монеты означают, что я должна беспрекословно лезть под зубы, оставь их себе.' : 'Помощь с условием молча подчиняться мне не подходит. На такую сделку я не согласна.';
        else if (intent === 'help-terms') text = 'Давай сначала уточним: это помощь без новых условий? За монеты я не обещаю отказываться от собственного решения.';
        else if (intent === 'apology') text = selectedStyle === 'proud' ? 'Я принимаю извинение. Но мне нужно увидеть, как ты поступишь в следующий раз.' : selectedStyle === 'reserved' ? 'Спасибо, что сказал. Мне понадобится немного времени, чтобы снова стало спокойно.' : selectedStyle === 'warm' ? 'Спасибо. Я хочу, чтобы у нас получилось это исправить. Давай начнём со следующего поступка.' : 'Я услышала. Давай попробуем не повторять то, за что сейчас пришлось извиняться.';
        else if (intent === 'argument') text = selectedStyle === 'proud' ? 'Можешь не соглашаться. Только объясни, в чём я ошиблась, а не решай за меня.' : selectedStyle === 'pragmatic' ? 'Давай разберём доводы. Я готова спорить об условиях, а не о том, кто здесь главный.' : 'Я выслушаю. Скажи, какое решение ты предлагаешь и почему оно лучше.';
        else if (intent === 'joke') text = selectedStyle === 'wry' ? 'Я бы назвала это прогулкой, но у прогулки обычно меньше зубов.' : selectedStyle === 'proud' ? 'Если выберемся, расскажешь, как я всё спасла. Только сначала дай мне действительно что-нибудь спасти.' : selectedStyle === 'cautious' ? 'Хорошая новость: я пока не заметила ничего нового. Давай не будем проверять удачу слишком громким смехом.' : 'Когда выберемся, хочу ужин, который точно не попробует съесть нас первым.';
        else if (intent === 'bond' || intent === 'clarify-bond') {
            const bond = ai.profile.bond, material = ROGI_BOND_VOICE[bond.id], known = n.disclosures[bond.id] || { maxLevel:-1, turns:0 };
            const openness = f.trust + (m.talk || 0) * 0.7 + (m.confess || 0) * 0.6 + ai.bondState.affinity * 0.5;
            const level = openness >= 60 ? 2 : openness >= 10 ? 1 : 0;
            const triggers = ROGI_BOND_MECHANICS[bond.id]?.triggers || [];
            const emotional = ['injury','broken-promise','unfair-loot','player-unfair-loot','player-pressure','deadline-near','forced-risk','known-danger','valuable-find'];
            const crisisEvent = [...ai.timeline].reverse().find(e => triggers.includes(e.type) &&
                (context.crisis ? e.type === context.crisis : emotional.includes(e.type)) && ai.eventNo-e.no <= 4 &&
                e.no > (known.lastCrisisNo || 0));
            const crisis = !!crisisEvent;
            if (!material) text = 'Есть вещи, о которых я пока не готова говорить.';
            else if (crisis) text = material.crisis;
            else if (known.turns && known.maxLevel >= level) text = known.maxLevel > 0 ? material.recall : 'Я пока не готова рассказать больше. Спасибо, что даёшь мне время.';
            else text = level === 2 ? material.open : level === 1 ? material.partial : material.surface;
            disclosure = { id:bond.id, level:crisis ? Math.min(1,level) : level, previous:known.maxLevel,crisisNo:crisisEvent?.no || 0 };
            claims.push({kind:'bond',id:bond.id});
            if (crisisEvent) claims.push({kind:'memory',no:crisisEvent.no,type:crisisEvent.type});
        } else if (intent === 'future') {
            const known = n.disclosures[ai.profile.bond.id];
            text = known?.maxLevel >= 1 ? ROGI_BOND_VOICE[ai.profile.bond.id].future : selectedStyle === 'proud' ? 'Хочу самой выбрать, где жить и чем заниматься. Пока мне достаточно знать, что это будет мой выбор.' : 'Хочу выбраться и заняться делом, которое я выбрала сама. Подробности, может быть, ещё обсудим.';
        } else if (intent === 'promise-made') text = context.promise === 'helpDebt' ? 'Запомню договор: ' + promiseDescription(comp,'helpDebt') + '. Давай проверим результат у выхода.' : 'Договорились: ты обещаешь ' + promiseDescription(comp,context.promise) + '. Я буду это помнить.';
        else if (intent === 'promise-broken') { text = 'Ты обещал ' + promiseDescription(comp,context.promise) + '. Сейчас вышло иначе. Я хочу понять, как мы будем с этим дальше.'; claims.push({kind:'promise-status',promise:context.promise,status:'broken'}); }
        else if (intent === 'promise-kept') { text = 'Ты выполнил нашу договорённость. Спасибо, что за словами последовало дело.'; claims.push({kind:'promise-status',promise:context.promise,status:'kept'}); }
        else if (intent === 'rest') text = 'Так лучше. Можно снова спокойно думать, а не только держаться на ногах.';
        else if (intent === 'sale-retain') text = 'Эту находку я пока сохраню. Есть вещи, с которыми мне трудно расстаться без необходимости.';
        else if (intent === 'sale-release') text = 'Мне жаль с ней расставаться. Но сейчас я решила её продать.';
        else if (intent === 'settled') text = 'С этой выплатой разобралась. Я остаюсь — пойдём дальше вместе.';
        else if (intent === 'farewell') { text = 'Мне всё ещё не хватает ' + f.shortCash + ' зол. на выплату. Придётся искать другой выход. Береги себя.'; claims.push({kind:'short-cash',value:f.shortCash}); }
        else if (intent === 'world-route') {
            const choices={camp:['Впереди есть лагерь. Я бы сначала перевела дух.','Видишь лагерь? Отдых может пригодиться нам обоим.'],
                treasure:['Там видна сокровищница. Добыча помогла бы нам с долгом.','Можно заглянуть в сокровищницу: до выплаты ещё надо собрать монеты.'],
                event:['Неизвестная комната манит. Интересно, что мы там найдём?','Там что-то неизвестное. Я бы заглянула, но решение за тобой.'],
                safe:['Пойдём осторожнее: после всего случившегося лучше не спешить.','На развилке давай выберем то, к чему сейчас готовы.'],
                other:['Посмотри на дороги. Выбирай, а я пойду рядом.','Несколько путей впереди. Давай решим вместе, куда свернуть.']};
            text=chooseRecent(n,intent,choices[context.routeKind]||choices.other);
        } else if (intent === 'world-camp') {
            const choices=context.rested?['Хорошо, что мы остановились. Я снова могу собраться.','После отдыха легче смотреть на дорогу. Спасибо за передышку.']
                :f.hp<comp.maxHp?['Костёр вовремя. Мне бы залечить раны, прежде чем идти дальше.','Здесь можно перевести дух. Я ещё не оправилась от ран.']
                :['Здесь спокойно. Давай хотя бы минуту побудем без погони.','Огонь настоящий и пока никого не кусает. Уже неплохо.'];
            text=chooseRecent(n,intent,choices);
        } else if (intent === 'world-shop') {
            const choices=f.shortLiquid>0?['Торговец может помочь с долгом. Только давай сначала посмотрим цены.','Монеты нам нужны, но я бы не продавала всё без раздумий.']
                :['Цены стоит сравнить. Не каждую находку нужно отдавать сразу.','Раз мы у торговца, давай посмотрим, что стоит сохранить.'];
            text=chooseRecent(n,intent,choices);
        } else if (intent === 'world-sale') {
            const choices=context.sentimental?['Жаль расставаться с этой находкой. Надеюсь, монеты помогут нам выбраться.','Я долго думала, прежде чем её продать. Спасибо, что дал мне решить.']
                :['Сделка состоялась. Теперь можно спокойнее считать монеты.','Продажа пригодится. Посмотрим, сколько осталось до выплаты.'];
            text=chooseRecent(n,intent,choices);
        } else if (intent === 'world-event') {
            text=chooseRecent(n,intent,worldEventLines(context));
        } else if (intent === 'world-exit') {
            text=f.shortCash>0?'До выплаты мне не хватает '+f.shortCash+' зол. Давай посмотрим, можем ли мы что-то сделать.':'На свою выплату у меня теперь хватает монет.';
            claims.push({kind:'finance',cash:f.cash,debt:f.debt,liquid:f.liquid,shortLiquid:f.shortLiquid});
        } else if (intent === 'deadline') {
            text = f.shortLiquid > 0 ? 'До расчёта уже недалеко, а средств ещё не хватает. Давай спокойно решим, что можем сделать.'
                : f.cash >= f.debt ? 'Расчёт близко. Монет на выплату уже хватает, но до выхода всё равно надо добраться.'
                    : 'Расчёт близко. Если продам свои свитки на выходе, денег должно хватить. Пока это ещё не монеты.';
            claims.push({kind:'finance',cash:f.cash,debt:f.debt,liquid:f.liquid,shortLiquid:f.shortLiquid});
        }
        else text = 'Давай решим, как нам идти дальше.';
        if(intent==='agree'&&context.method!=='break')text=chooseRecent(n,intent,[text,'Хорошо, я попробую. Ты будь рядом.','Ладно, возьмусь за замок. Будем осторожны.']);
        if(intent==='injury'&&f.hp>0)text=chooseRecent(n,intent,[text,'Ай. Мне нужна минутка, чтобы перевести дух.','Досталось. Прежде чем продолжим, давай оценим, как мы держимся.']);
        if(intent==='loot-keep'&&f.shortLiquid>0)text=chooseRecent(n,intent,[text,'Я пока оставлю находку себе. Мне ещё нужно собрать на выплату.','Этот свиток останется у меня: деньги на долг ещё не собраны.']);
        if (['loot-give','pressure-give','trade'].includes(intent)) claims.push({kind:'ownership',uid:context.uid,owner:'player'});
        if (['loot-keep','loot-offer','loot-split','loot-defer','pressure-keep','pressure-counter'].includes(intent)) claims.push({kind:'ownership',uid:context.uid,owner:'rogi'});
        if (['loot-offer','loot-split','pressure-counter'].includes(intent)) claims.push({kind:'offer',uid:context.uid,price:context.price});
        if (['trust','fear','support','refusal','apology','argument','pressure-keep','world-camp'].includes(intent)) {
            memory = relevantMemory(comp,intent,context);
            if (memory) { const recall = memoryLine(comp,memory); if (recall) { text += ' ' + recall; claims.push({kind:'memory',no:memory.no,type:memory.type}); } }
        }
        return { id:intent + ':' + selectedStyle, intent, style:selectedStyle, text, claims, memoryNo:memory?.no || null, disclosure, eventNo:ai.eventNo };
    }
    function chooseRecent(n,intent,choices) {
        const recent=n.utterances.slice(-6).filter(u=>u.intent===intent).map(u=>u.text);
        return choices.find(line=>!recent.some(text=>text.startsWith(line)))||choices[(n.serial+1)%choices.length];
    }
    function worldEventLines(context) {
        if(context.storyId==='inspector-callback') {
            if(context.choiceId==='forge-report'&&context.pursuit)
                return ['Мы получили восемнадцать, но Фен потерял груз и теперь ищет нас. Будем осторожнее в лавках.'];
            if(context.choiceId==='forge-report'&&context.rogiDecision==='refuse')
                return ['Хорошо, что я не дала поставить ложную печать. Фен остановил груз, и никто не пострадал.'];
            if(context.choiceId==='demand-cut'&&context.rogiDecision==='negotiate')
                return ['Фен заплатил за сверку и остановил груз. Мы заработали, не подставляя его.'];
            if(context.choiceId==='demand-cut')
                return ['В этот раз я не стала торговаться. Фен остановил груз, но мы ушли без платы.'];
            if(context.choiceId==='warn-and-pay')
                return ['Восемь зол. ушли, зато Фен спас груз и не станет нас искать.'];
            if(context.collateral)
                return ['Свиток ушёл Фену в залог. Он остановил груз и больше не ищет нас.'];
            return ['Мы не стали ставить печать, но Фен лишился партии и теперь нас ищет.'];
        }
        if(context.hurt)return ['Тебя задело? Давай дальше осторожнее.','Это обошлось нам больно. Проверь силы, прежде чем идти дальше.'];
        if(context.gainedGold)return ['Монеты сейчас не лишние. Не забудем про выплату.','Хорошо, что удалось найти немного золота. До расчёта оно пригодится.'];
        return ['Ну и встреча. Пойдём дальше, пока всё спокойно.','Такого я не ожидала. Давай запомним, как мы с этим справились.'];
    }
    function validate(comp, utterance, context = {}) {
        const f = facts(comp,context), ai = RogiAI.ensure(comp);
        return utterance.claims.filter(c => {
            switch(c.kind) {
                case 'finance': return c.cash !== f.cash || c.debt !== f.debt || c.liquid !== f.liquid || c.shortLiquid !== f.shortLiquid;
                case 'known-danger': return !f.knownDanger;
                case 'health': return c.value !== f.hp;
                case 'low-health': return f.hp > 1;
                case 'incapacitated': return f.hp > 0;
                case 'insufficient-focus': return f.focus >= c.cost;
                case 'short-cash': return c.value !== f.shortCash;
                case 'promise-active': return ai.promises[c.promise]?.status !== 'active';
                case 'promise-status': return ai.promises[c.promise]?.status !== c.status;
                case 'bond': return c.id !== ai.profile.bond.id || !ROGI_BOND_VOICE[c.id];
                case 'ownership': return comp.lastLoot?.uid !== c.uid || comp.lastLoot?.owner !== c.owner || (c.owner === 'rogi' && !comp.inventory.some(i => i.uid === c.uid));
                case 'offer': return !comp.lastLoot?.offer || comp.lastLoot.uid !== c.uid || comp.lastLoot.price !== c.price;
                case 'memory': return !ai.timeline.some(e => e.no === c.no && (e.type === c.type||e.detail.originalType===c.type));
                default: return true;
            }
        });
    }
    function say(comp, intent, context = {}) {
        const n = state(comp), utterance = compose(comp,intent,context), invalid = validate(comp,utterance,context);
        if (invalid.length) { utterance.text = 'Дай мне сначала разобраться, прежде чем я что-нибудь пообещаю.'; utterance.rejectedClaims = invalid; utterance.claims = []; }
        n.serial++; n.lastIntent = intent; n.textPage = 0;
        if (utterance.memoryNo) n.mentions[utterance.memoryNo] = n.serial;
        if (utterance.disclosure && !invalid.length) {
            const d = utterance.disclosure, old = n.disclosures[d.id] || { maxLevel:-1,turns:0 };
            n.disclosures[d.id] = { maxLevel:Math.max(old.maxLevel,d.level), turns:old.turns+1, lastEvent:utterance.eventNo,
                lastCrisisNo:d.crisisNo || old.lastCrisisNo || 0 };
            comp.ai.disclosedBond = n.disclosures[d.id].maxLevel >= 1;
        }
        n.utterances.push(utterance); if (n.utterances.length > 80) n.utterances.shift();
        if(typeof RogiConversation!=='undefined')RogiConversation.spoken(comp,utterance);
        return utterance.text;
    }
    return { state, style, facts, compose, say, validate, relevantMemory, promiseDescription };
})();
