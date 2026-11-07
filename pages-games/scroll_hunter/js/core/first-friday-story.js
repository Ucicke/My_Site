/* Small, persistent story state for the optional first-run prologue. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.FirstFridayStory = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function () {
    'use strict';

    const CHOICES = Object.freeze({
        'stand-together': Object.freeze({ id:'stand-together', text:'Не будем искать виноватого. Сначала сверим подписи.', trust:2 }),
        'blame-rogi': Object.freeze({ id:'blame-rogi', text:'Ты тоже поставила подпись, Роги.', trust:-2 })
    });

    function profileIds(profile) {
        return {
            traits:new Set((profile?.traits || []).map(item => item?.id).filter(Boolean)),
            ideal:profile?.ideal?.id || '', bond:profile?.bond?.id || '', flaw:profile?.flaw?.id || ''
        };
    }

    function replyFor(profile, choiceId) {
        const ids = profileIds(profile);
        const protective = ['trap-suspicion','careful-observer','slow-to-trust','reads-people'].some(id => ids.traits.has(id));
        const riskTaking = ['risk-seeker','acts-first','competitive'].some(id => ids.traits.has(id));
        const keepsPrivate = ['private-grief','quiet-watcher'].some(id => ids.traits.has(id)) || ids.flaw === 'secretive';
        const moneyFocused = ['counts-every-coin','bargainer','hates-waste'].some(id => ids.traits.has(id)) || ids.ideal === 'wealth';
        const principled = ['honor','justice','truth','promises'].includes(ids.ideal);

        if (choiceId === 'stand-together') {
            if (ids.bond === 'debt-ledger') return '«Тогда положим расписки рядом и сверим каждую цифру. Я не дам ему переписать долг задним числом».';
            if (ids.bond === 'shared-table') return '«Ладно. Только в этот раз делим не выигрыш, а работу. Иначе опять поссоримся из-за последней монеты».';
            if (ids.bond === 'freedom-road') return '«Я иду рядом, пока сама выбираю этот путь. Не решай за меня — и я не брошу тебя одного».';
            if (keepsPrivate) return '«Спасибо. Только не спрашивай пока, кто именно держал банк. Сначала сверим обе расписки».';
            if (principled) return '«Фишки были меченые. Это не отменяет наших подписей, но я не дам кредитору переписать условия».';
            if (protective) return '«Я просила проверить стол: фишки были подменены. Ладно. Теперь проверим хотя бы мелкий шрифт».';
            if (riskTaking) return '«Я всё ещё думаю, что там мог быть выигрыш. Но тот проигрыш уже настоящий. Идём дальше — вместе».';
            if (moneyFocused) return '«Сначала посчитаем проценты, потом будем спорить о казино. Я не собираюсь платить дважды за одну подпись».';
            return '«Хорошо. В этот раз сначала читаем, потом ставим подпись. Даже если бумага обещает сокровища».';
        }
        if (ids.bond === 'debt-ledger') return '«Моя расписка — моя ответственность. Но твою сумму я тоже проверю, прежде чем нас обоих отправят в яму».';
        if (ids.bond === 'shared-table') return '«Обвиняй, если хочешь. Только в следующий раз не называй нас командой, когда делим удачу».';
        if (ids.bond === 'freedom-road') return '«Я отвечу за свою подпись. Но не путай совместную ошибку с правом мной командовать».';
        if (keepsPrivate) return '«Моя подпись — моя ошибка. Но у арендодателя есть вторая расписка, и вот она мне не нравится».';
        if (protective) return '«Я подписала после третьего бокала. Ты — после четвёртого. Давай не будем делать вид, что проверили хоть что-нибудь».';
        if (principled) return '«Да. И отвечу за неё. Но обещать, что договор настоящий, я не стану».';
        if (riskTaking) return '«Поставила. И тогда верила, что отыграю всё за одну раздачу. Смешно, правда?».';
        if (moneyFocused) return '«Поставила — и до сих пор помню сумму до последней монеты. Не заставляй меня считать её вслух».';
        return '«Поставила. Ты тоже. Поэтому спорить будем после того, как выберемся с добычей».';
    }

    function choiceEffect(choiceId) {
        return CHOICES[choiceId] ? { trust:CHOICES[choiceId].trust } : { trust:0 };
    }

    function transferImpact({ playerGold = 0, amount = 0, due = 0, exitScrollValue = 0 } = {}) {
        const cash = Math.max(0, Number(playerGold) || 0);
        const gift = Math.max(0, Math.min(cash, Number(amount) || 0));
        const installment = Math.max(0, Number(due) || 0);
        const scrolls = Math.max(0, Number(exitScrollValue) || 0);
        const remainingCash = cash - gift;
        const availableAfterSale = remainingCash + scrolls;
        const shortfall = Math.max(0, installment - availableAfterSale);
        return { remainingCash, availableAfterSale, shortfall, threatensInstallment: shortfall > 0 };
    }

    function createProgress(initial = {}) {
        let seen = initial.seen === true;
        let page = Number.isInteger(initial.page) ? Math.max(0,Math.min(2,initial.page)) : 0;
        let choice = Object.hasOwn(CHOICES,initial.choice) ? initial.choice : null;
        return {
            begin() { page=0; choice=null; },
            setPage(value) { page=Number.isInteger(value)?Math.max(0,Math.min(2,value)):page; },
            setChoice(value) { if (Object.hasOwn(CHOICES,value)) choice=value; },
            complete() { seen=true; },
            snapshot() { return { seen,page,choice }; }
        };
    }

    return Object.freeze({ choices:CHOICES, replyFor, choiceEffect, transferImpact, createProgress });
});
