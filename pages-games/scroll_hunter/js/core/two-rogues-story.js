/* Optional story events built on the existing resources and Rogi memory. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.TwoRoguesStory = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
    'use strict';

    const eventIds = Object.freeze(['casino-witness', 'questionable-deal', 'unexpected-witness', 'inspector-callback']);
    const HISTORY = Object.freeze({
        betrayal: new Set(['team-heist-contract-broken', 'player-unfair-loot', 'forced-risk']),
        support: new Set(['debt-help', 'fair-deal', 'team-heist-kept', 'promise-kept']),
        refusal: new Set(['heist-last-score-refused', 'two-rogues-risk-refused']),
        risk: new Set(['player-hurt-due-to-deal'])
    });

    const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const eventsOf = context => Array.isArray(context?.ai?.timeline) ? context.ai.timeline
        : Array.isArray(context?.history) ? context.history : [];

    function summarizeHistory(context = {}) {
        const history = eventsOf(context);
        let latest = null, branch = 'none';
        for (let index = history.length - 1; index >= 0; index--) {
            const item = history[index];
            for (const kind of ['betrayal', 'support', 'refusal', 'risk']) {
                const firstFridaySupport = kind === 'support' && item?.type === 'first-friday-choice' && item.detail?.choice === 'stand-together';
                if (HISTORY[kind].has(item?.type) || firstFridaySupport) { latest = item; branch = kind; break; }
            }
            if (latest) break;
        }
        return { branch, event:latest, timelineLength:history.length };
    }

    function seen(context, id) {
        if (id === 'inspector-callback') return context?.storyFlags?.inspectorCallbackResolved === true;
        const ai = context?.ai;
        return !!(ai?.seen?.['two-rogues-story:' + id] || ai?.memory?.some(item =>
            item.type === 'two-rogues-story' && item.detail?.eventId === id));
    }

    function hasInspectorSuccess(context) {
        const ai = context?.ai;
        return !!(ai?.seen?.['counterfeit-inspector-success'] ||
            eventsOf(context).some(item => item?.type === 'counterfeit-inspector-success'));
    }

    function rogiView(id, context, history) {
        const profile = context?.ai?.profile || {};
        const dimensions = profile.dimensions || {};
        if (history.branch === 'betrayal') return '«После той сделки я читаю мелкий шрифт. Ищу, кому опять назначат виноватого».';
        if (history.branch === 'support') return '«Я пойду рядом. Сначала сверим цифры, потом достанем кошель».';
        if (history.branch === 'refusal') return '«Послушать могу. Подписывать за меня — нет».';
        if (history.branch === 'risk') return '«Ты уже сам принял такой удар. Не придумывай к нему заговор».';
        if (id === 'casino-witness' && number(dimensions.greed, 50) > 60)
            return '«Он узнал нас первым. Значит, либо у него хорошая память, либо он хочет продать нам собственную историю».';
        if (number(dimensions.caution, 50) >= 60)
            return '«Сначала проверь, кто держит дверь и кто ведёт счёт».';
        return '«Пусть начнёт с того, кто записал наши подписи».';
    }

    function createScenario(id, context = {}) {
        if (!eventIds.includes(id) || seen(context, id)) return null;
        if (id === 'inspector-callback') {
            if (!hasInspectorSuccess(context)) return null;
            const gold = number(context.gold), hp = number(context.hp), active = context.active !== false;
            const scrolls = Array.isArray(context.scrolls) ? context.scrolls : [];
            return {
                id, title:'Проверка по вашей бумаге',
                sceneText:'Купец Фен узнал выдуманную должность из журнала казино. Он просит заверить партию свитков: если проверка ложная, его товар конфискуют.',
                rogiView:active ? '«Он верит печати, а не нам. Если поставим её — отвечать придётся перед ним».' : '',
                choices:[
                    { id:'forge-report', text:'Подделать заключение', hint:active
                        ? 'Если Роги согласится: +18 зол., −1 фокус и розыск'
                        : '55%: +18 зол. и розыск · 45%: −1 ♥', disabled:!active && hp <= 1 },
                    { id:'demand-cut', text:'Потребовать плату', hint:active
                        ? 'Если Роги согласится: +12 зол. и −1 фокус'
                        : '55%: +12 зол. · 45%: −1 ♥', disabled:!active && hp <= 1 },
                    { id:'warn-and-pay', text:'Предупредить купца', hint:'−8 зол. · груз спасён', disabled:gold < 8 },
                    { id:'hand-over-scroll', text:'Оставить свиток залогом', hint:'−1 свиток · розыска не будет', disabled:scrolls.length === 0 },
                    { id:'leave', text:'Уйти', hint:'Без цены · купец будет искать вас' }
                ]
            };
        }
        if (context.active === false) return null;
        const history = summarizeHistory(context);
        const gold = number(context.gold), hp = number(context.hp), risk = hp <= 1;
        let scene;
        if (id === 'casino-witness') {
            scene = {
                title:'Свидетель из казино',
                cause:'Клерк узнал ваши подписи с расписок казино и помнит вечер проигрыша, но не называет хозяина банка.',
                plan:'Узнать, что он видел, или выдать себя за проверяющих.',
                complication:'У него журнал учёта; блеф легко проверить.',
                sceneText:'Клерк сверяет две даты в журнале. За точную сверку он готов заплатить; на двери уже дежурит охрана.',
                choices:[
                    { id:'ask-clerk', text:'Сверить записи за плату', hint:'Роги решит · при помощи +12 зол.' },
                    { id:'bluff', text:'Назваться проверяющими', hint:'Риск: успех принесёт 25 зол.; провал снимет 1 ♥.', disabled:risk },
                    { id:'leave', text:'Закрыть журнал и уйти', hint:'Без затрат и новых выводов о казино.' }
                ]
            };
        } else if (id === 'questionable-deal') {
            scene = {
                title:'Сомнительная сделка',
                cause:'Посредник кладёт аванс за опись. Тяжёлая печать может сорваться и ударить по тому, кто подпишет.',
                plan:'Взять аванс, поторговаться или уйти.',
                complication:'Это риск в комнате: будущий долг или обязанность договор не создаёт.',
                sceneText:'Посредник кладёт на стол аванс. Под сломанной печатью опасно ставить подпись, но будущего долга мелкий шрифт не создаёт.',
                choices:[
                    { id:'sign', text:'Подписать как есть', hint:'+35 зол. · если Роги согласится, −1 фокус; при отказе −1 ♥ и −4 доверия.', disabled:risk },
                    { id:'counter', text:'Потребовать меньший аванс без залога', hint:'Роги может поддержать торг; при отказе сделки не будет.' },
                    { id:'refuse', text:'Отказаться от сделки', hint:'Без оплаты и без риска для Роги.' }
                ]
            };
        } else {
            const cause = history.branch === 'betrayal'
                ? 'Писарь показывает копию договора о спорной добыче и называет комнату, где вы его подписали.'
                : history.branch === 'support'
                    ? 'Казначей проверил запись о помощи с выплатой и пришёл вернуть ошибочно удержанные деньги.'
                : history.branch === 'refusal'
                        ? 'Свидетель подтвердил отказ Роги от опасного поручения и просит её показания.'
                        : history.branch === 'risk'
                            ? 'Писарь видел, как на вас упала печать из сомнительного договора. Он принёс квитанцию об ущербе.'
                : 'Писарь узнаёт вас по двум распискам казино. Дату помнит, причины проигрыша — нет.';
            const honestText = history.branch === 'betrayal' ? 'Вернуть 20 зол. за старый договор'
                : history.branch === 'support' ? 'Попросить проверить возврат'
                    : history.branch === 'refusal' ? 'Подтвердить отказ Роги' : history.branch === 'risk' ? 'Показать квитанцию об ущербе' : 'Сверить дату и подписи';
            const honestHint = history.branch === 'betrayal' ? '−20 зол. · исправит ущерб и укрепит доверие'
                : history.branch === 'support' ? '+18 зол. · возврат по проверенной записи'
                    : history.branch === 'refusal' ? '+10 зол. · свидетель подтверждает её решение'
                        : history.branch === 'risk' ? '+10 зол. · возмещение по квитанции'
                        : '+8 зол. · плата за помощь в поиске записи';
            scene = {
                title:'Неожиданный свидетель', cause,
                plan:'Проверить запись, не приписывая себе чужих поступков.',
                complication:'Запись подтверждает сделку, но не доказывает заговор.',
                sceneText: cause + ' Писарь кладёт раскрытый журнал между вами и ждёт ответа.',
                choices:[
                    { id:'answer-honestly', text:honestText, hint:honestHint,
                        disabled:history.branch === 'betrayal' && gold < 20 },
                    { id:'bluff', text:'Сделать вид, что вы его не знаете', hint:'Успех: +25 зол.; провал: −1 ♥ и −2 доверия.', disabled:risk },
                    { id:'leave', text:'Не продолжать разговор', hint:'Без затрат; свидетель не делает выводов за вас.' }
                ]
            };
        }
        return { id, ...scene, text:scene.sceneText || (scene.cause + ' ' + scene.plan),
            rogiView:rogiView(id, context, history), historyBranch:history.branch };
    }

    function decision(context, kind, actions) {
        if (number(context.rogiFocus, number(context.ai?.focus, 1)) <= 0 || context.ai?.promises?.risk?.status === 'active') return 'refuse';
        return context.rogiDecision?.(kind, actions, summarizeHistory(context)) || actions[0]?.id || 'refuse';
    }

    function resolve(id, choiceId, context = {}) {
        const scene = createScenario(id, context);
        const choice = scene?.choices.find(item => item.id === choiceId);
        if (!choice || choice.disabled) return null;
        const branch = summarizeHistory(context).branch;
        const result = { eventId:id, choiceId, branch, outcome:choiceId, text:'', goldDelta:0, hpDelta:0,
            rogiFocusDelta:0, trustDelta:0, addScroll:false, riskRefused:false, rogiDecision:null,
            recordInspectorSuccess:false, merchantSearchPending:false, consumeScroll:false };
        const roll = () => number(context.roll?.('two-rogues:' + id + ':' + choiceId), 0.5);

        if (id === 'casino-witness') {
            if (choiceId === 'ask-clerk') {
                result.rogiDecision = decision(context, 'casino-witness-talk', [
                    { id:'help', base:38, tags:['help','truth','curiosity','deal'], traitWeights:{ curiosity:.18, cooperation:.15, greed:-.05 }, needWeight:{ fairness:.1 } },
                    { id:'hold', base:30, tags:['safe','refuse','caution'], traitWeights:{ caution:.16, fear:.08, independence:.05 }, needWeight:{ safety:.14 } }
                ]);
                if (result.rogiDecision === 'help') {
                    result.goldDelta=12; result.trustDelta=1;
                    result.text='Роги сверила две даты в журнале. Клерк заплатил 12 зол. за помощь с описанием, но о хозяине казино не сказал ничего.';
                } else {
                    result.text='Роги не стала подходить к журналу: «Сначала выясним, кто его переплёл». Клерк закрыл книгу и ушёл.';
                }
            } else if (choiceId === 'bluff') {
                if (roll() < 0.55) {
                    result.goldDelta=25; result.recordInspectorSuccess=true;
                    result.text='Клерк поверил в проверку и заплатил 25 зол. за тишину. В журнале осталась копия выдуманного удостоверения.';
                } else {
                    result.hpDelta=-1; result.trustDelta=-1; result.text='Клерк попросил показать полномочия, затем позвал охрану. Вы ушли с разбитой губой и без ответа.';
                }
            } else result.text='Вы закрыли журнал. Вопрос о казино остался открытым.';
        } else if (id === 'questionable-deal') {
            if (choiceId === 'sign') {
                const actions = [
                    { id:'agree', base:branch==='support'?36:branch==='betrayal'?24:32, tags:['deal','reward','risk','greed'], traitWeights:{ greed:.2, courage:.12, pragmatism:.12, caution:-.1 }, needWeight:{ debt:.28, safety:-.08 } },
                    { id:'refuse', base:branch==='betrayal'?39:branch==='risk'?37:30, tags:['refuse','safe','risk'], traitWeights:{ caution:.2, fear:.2, independence:.1 }, needWeight:{ safety:.25, fairness:.08 } }
                ];
                result.rogiDecision=decision(context,'questionable-deal-sign',actions);
                result.goldDelta=35;
                if (result.rogiDecision === 'agree') {
                    result.rogiFocusDelta=-1; result.trustDelta=1;
                    result.text='Роги прочла оговорку, подписала только свою долю и настояла на копии. Аванс — 35 зол.; сосредоточенности у неё стало меньше.';
                } else {
                    result.riskRefused=true; result.hpDelta=-1; result.trustDelta=-4;
                    result.text='Роги отказалась подписывать риск. Вы поставили только свою подпись, получили 35 зол. и сами приняли удар от внезапно рухнувшей печати.';
                }
            } else if (choiceId === 'counter') {
                const history= summarizeHistory(context);
                const actions = [
                    { id:'counter', base:history.branch==='support'?40:history.branch==='betrayal'?18:30,
                        tags:['negotiate','fairness','deal','help'], traitWeights:{ pragmatism:.2, fairness:.16, cooperation:.12 }, needWeight:{ debt:.14, fairness:.16 } },
                    { id:'refuse', base:history.branch==='betrayal'?42:29, tags:['refuse','safe'],
                        traitWeights:{ caution:.16, fear:.12, independence:.06 }, needWeight:{ safety:.16 } }
                ];
                result.rogiDecision=decision(context,'questionable-deal-counter',actions);
                if (result.rogiDecision === 'counter') {
                    result.goldDelta=18; result.rogiFocusDelta=-1; result.trustDelta=2;
                    result.text='Роги нашла в договоре пустую графу и заставила посредника вписать туда его собственную комиссию. Вы получили 18 зол. без залога.';
                } else {
                    result.riskRefused=true;
                    result.text='Роги отказалась вести переговоры после прошлых условий. Посредник свернул бумаги; денег и ущерба нет.';
                }
            } else {
                result.text='Вы оставили перо на столе. Посредник свернул бумаги; будущих претензий не возникло.';
            }
        } else if (id === 'unexpected-witness') {
            if (choiceId === 'answer-honestly') {
                if (branch === 'betrayal') {
                    result.goldDelta=-20; result.trustDelta=4;
                    result.text='Вы вернули 20 зол. по старому договору. Писарь отметил исправление; Роги запомнила, что вы не спрятали подпись.';
                } else if (branch === 'support') {
                    result.goldDelta=18; result.trustDelta=2;
                    result.text='Проверка подтвердила прежнюю помощь. Казначей вернул 18 зол., ошибочно удержанных при расчёте.';
                } else if (branch === 'refusal') {
                    result.goldDelta=10; result.trustDelta=2;
                    result.text='Свидетель подтвердил, что Роги сама отказалась от поручения. Он выдал 10 зол. за точное показание.';
                } else if (branch === 'risk') {
                    result.goldDelta=10; result.trustDelta=1;
                    result.text='Квитанция подтвердила ущерб от печати. Вам вернули 10 зол. расходов; писарь не стал домысливать, кто был виноват.';
                } else {
                    result.goldDelta=8; result.trustDelta=1;
                    result.text='Вы сверили дату и подписи. Писарь заплатил 8 зол. за помощь найти пропущенную строку; никаких признаний о казино не последовало.';
                }
            } else if (choiceId === 'bluff') {
                if (roll() < 0.55) { result.goldDelta=25; result.text='Свидетель принял вашу версию и заплатил 25 зол. за то, чтобы вы поискали нужную папку.'; }
                else { result.hpDelta=-1; result.trustDelta=-2; result.text='Свидетель раскрыл блеф и позвал стражу. Роги не успела увести вас без синяка.'; }
            } else result.text='Вы ушли. Свидетель не добавил к вашему прошлому ни одного выдуманного поступка.';
        } else if (id === 'inspector-callback') {
            if (choiceId === 'forge-report') {
                if (context.active !== false) {
                    result.rogiDecision=decision(context,'inspector-callback-forge',[
                        { id:'support',base:34,tags:['deal','risk','greed','initiative'],traitWeights:{ greed:.2,courage:.12,pragmatism:.1,caution:-.12 },needWeight:{ debt:.18 } },
                        { id:'refuse',base:34,tags:['refuse','safe','fairness'],traitWeights:{ caution:.18,fear:.14,independence:.08,fairness:.12 },needWeight:{ safety:.2 } }
                    ]);
                    if (result.rogiDecision === 'support') {
                        result.goldDelta=18; result.rogiFocusDelta=-1; result.merchantSearchPending=true;
                        result.text='Роги сверила печати и поставила ложную отметку. Фен потерял партию, а копию отчёта отправили настоящим проверяющим. Он уже ищет лжеинспектора.';
                    } else {
                        result.text='Роги отвела твою руку от сургуча: «Нет. Он принёс нам свой груз, а не чужой долг». Фен успел остановить отгрузку.';
                    }
                } else if (roll() < 0.55) {
                    result.goldDelta=18; result.merchantSearchPending=true;
                    result.text='Ты поставил фальшивую отметку. Фен лишился партии, а копию отчёта отправили настоящим проверяющим; он уже ищет лжеинспектора.';
                } else {
                    result.hpDelta=-1;
                    result.text='Под сургучом оказался сигнальный порошок. Фен успел остановить отгрузку, а ты ушёл с ожогом и без денег.';
                }
            } else if (choiceId === 'demand-cut') {
                if (context.active !== false) {
                    result.rogiDecision=decision(context,'inspector-callback-cut',[
                        { id:'negotiate',base:36,tags:['negotiate','fairness','deal'],traitWeights:{ pragmatism:.18,fairness:.16,greed:.08,cooperation:.08 },needWeight:{ debt:.12 } },
                        { id:'refuse',base:30,tags:['refuse','safe','choice'],traitWeights:{ caution:.12,independence:.08 },needWeight:{ safety:.1 } }
                    ]);
                    if (result.rogiDecision === 'negotiate') {
                        result.goldDelta=12; result.rogiFocusDelta=-1;
                        result.text='Роги потребовала вписать оплату за сверку до осмотра. Фен согласился на 12 зол.; Роги потратила 1 фокус, а отгрузку остановили.';
                    } else result.text='Роги не стала торговаться за чужой груз. Фен остановил отгрузку; вы ушли без платы.';
                } else if (roll() < 0.55) {
                    result.goldDelta=12;
                    result.text='Фен заплатил 12 зол. за сверку и сам остановил отгрузку.';
                } else {
                    result.hpDelta=-1;
                    result.text='Фен проверил удостоверение и не заплатил. Ты ушёл с разбитой губой, но без разоблачения груза.';
                }
            } else if (choiceId === 'warn-and-pay') {
                result.goldDelta=-8; result.trustDelta=context.active !== false ? 1 : 0;
                result.text='Ты предупредил Фена о фальшивом удостоверении и заплатил 8 зол. за срочную остановку отгрузки. Он успел спасти товар.';
            } else if (choiceId === 'hand-over-scroll') {
                result.consumeScroll=true; result.trustDelta=context.active !== false ? 1 : 0;
                result.text='Ты оставил свиток залогом, пока Фен остановил груз и сверил печати. Он не стал искать тебя.';
            } else {
                result.merchantSearchPending=true;
                result.text='Вы ушли, не предупредив Фена. Партия пропала, а он начал искать тех, кто назвался проверяющими.';
            }
        }
        result.goldAfter = Math.max(0, number(context.gold) + result.goldDelta);
        result.hpAfter = Math.max(0, number(context.hp) + result.hpDelta);
        return result;
    }

    return Object.freeze({ eventIds, createScenario, resolve, summarizeHistory });
});
