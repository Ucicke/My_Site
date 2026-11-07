/* Companion card, transfer modal, and conversation screen rendering. */
'use strict';

function drawCompanionCard(box) {
    if (box.h < 115) return;
    fillRound(box.x, box.y, box.w, box.h, 13, 'rgba(15,13,24,0.88)', 'rgba(175,137,209,0.4)');
    drawText('РОГИ', box.x + 14, box.y + 21, '800 16px Manrope, sans-serif', '#e0c6ef', 'left', 'middle');
    drawText(companionRelation() + ' · ' + rogiTrust, box.x + 14, box.y + 44, '500 12px Inter, sans-serif', '#c4b0d1', 'left', 'middle');
    drawText('Её золото: ' + companion.gold + ' · долг: ' + companion.debt, box.x + 14, box.y + 66, '600 12px Inter, sans-serif', '#e2c89f', 'left', 'middle');
    const ai = RogiAI.ensure(companion);
    drawText('Сосредоточенность ' + ai.focus + '/' + ai.focusMax + ' · ' + RogiAI.moodLabel(ai.mood), box.x + 14, box.y + 84,
        '600 11px Inter, sans-serif', '#d8c295', 'left', 'middle');
    const lines = quartermasterTextLines(companion.line, 'italic 12px Georgia, serif', box.w - 28, Math.max(1, Math.floor((box.h - 104) / 17)));
    lines.forEach((line, i) => drawText(line, box.x + 14, box.y + 105 + i * 17, 'italic 12px Georgia, serif', '#e0d4e6', 'left', 'middle'));
}
function drawCompanionModal() {
    ctx.fillStyle = 'rgba(3,6,12,0.76)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (companionModal?.type === 'dialogue') { drawRogiDialogueScreen(); return; }
    const transfer = companionModal?.type === 'transfer';
    const farewell = companionModal?.type === 'farewell';
    const w = Math.min(transfer ? 480 : 560, VIEW_W - 28), h = Math.min(transfer ? 460 : farewell ? 330 : 490, VIEW_H - 30);
    const box = { x: (VIEW_W - w) / 2, y: (VIEW_H - h) / 2, w, h };
    fillRound(box.x, box.y, w, h, 16, '#13131e', 'rgba(190,155,218,0.5)');
    const x = box.x + 20, y = box.y + 20, innerW = w - 40;
    const farewellTitle = week === 1 ? 'ПЕРВАЯ ПЯТНИЦА · ДВА ДОЛГА' : 'ДВА ДОЛГА — ДВА РЕШЕНИЯ';
    drawText(companionModal.type === 'farewell' ? farewellTitle : 'РОГИ · ' + companionRelation(), x, y + 10,
        '800 15px Manrope, sans-serif', '#dec3ee', 'left', 'middle');
    drawText('Вы: ' + gold + ' зол. · долг ' + currentTribute(), x, y + 42, '600 13px Inter, sans-serif', UIC.gold, 'left', 'middle');
    drawText('Роги: ' + companion.gold + ' зол. · долг ' + companion.debt + ' · ♥ ' + companion.hp + '/' + companion.maxHp,
        x, y + 65, '600 13px Inter, sans-serif', '#dbc5ed', 'left', 'middle');
    const promise=companion.ai?.promises?.helpDebt;
    const reminder=promise?.status==='active'?' Я помню твоё обещание.':promise?.status==='kept'?' Спасибо за помощь.':promise?.status==='broken'?' Ты обещал помочь.':'';
    const line = companionModal.type === 'farewell'
        ? (week === 1 ? 'Первая пятница — и уже не хватает ' : 'Мне не хватает ') + Math.max(0, companion.debt - companion.gold) + ' зол.'+reminder+' Поможешь? Без выплаты мне придётся уйти.'
        : companion.line;
    const lines = quartermasterTextLines(line, '500 13px Inter, sans-serif', innerW, companionModal.type==='farewell'?4:3);
    lines.forEach((text, i) => drawText(text, x, y + 96 + i * 18, '500 13px Inter, sans-serif', UIC.text, 'left', 'middle'));
    let by = y + (companionModal.type==='farewell'?180:162);
    const button = (label, action, disabled = false, primary = false) => {
        chamberButton(label, { x, y: by, w: innerW, h: 34 }, action, disabled, primary); by += 41;
    };
    if (companionModal.type === 'transfer') {
        const amount = clamp(companionModal.amount || 0, 0, gold);
        companionModal.amount = amount;
        drawText('Передать ' + amount + ' · у вас останется ' + (gold - amount), x, by, '700 14px Inter, sans-serif', UIC.gold, 'left', 'middle'); by += 18;
        if (atDungeonExit()) {
            const impact = FirstFridayStory.transferImpact({
                playerGold:gold, amount, due:currentTribute(), exitScrollValue:exitScrollValue()
            });
            drawText(impact.threatensInstallment
                ? 'После продажи свитков не хватит ' + impact.shortfall + ' зол. на ваш долг.'
                : 'После продажи свитков хватит на вашу выплату.',
                x, by, '600 11px Inter, sans-serif', impact.threatensInstallment ? UIC.red : UIC.dim, 'left', 'middle');
            by += 17;
        }
        const changes = [-10, -1, 1, 10];
        changes.forEach((n, i) => chamberButton((n > 0 ? '+' : '') + n, { x: x + i * innerW / 4, y: by, w: innerW / 4 - 6, h: 30 },
            () => { companionModal.amount = clamp(amount + n, 0, gold); })); by += 39;
        button('До суммы долга: ' + Math.min(gold, Math.max(0, companion.debt - companion.gold)), () => { companionModal.amount = Math.min(gold, Math.max(0, companion.debt - companion.gold)); });
        if (companionModal.promiseDraft) {
            button('Обещать ' + amount + ' зол. к выходу', () => {
                if (!RogiAI.recordPromise(companion,'helpDebt',{kind:'fixed-gift',amount})) return;
                companion.line = RogiAI.voice(companion,'promise-made',{promise:'helpDebt'},'Запомню сумму и срок.');
                RogiAI.setDialogue(companion,companion.line); companionModal = {type:'dialogue'}; updateUI();
            },amount <= 0,true);
        } else {
            button('Подтвердить передачу', () => transferCompanionGold(companionModal.amount), amount <= 0, true);
            button('Поставить условие: никаких отказов', () => transferCompanionGold(companionModal.amount,'obedience'), amount <= 0);
        }
    } else if (companionModal.type === 'farewell') {
        button('Помочь Роги', () => { companionModal = { type: 'transfer', amount: Math.min(gold, Math.max(1, companion.debt - companion.gold)) }; }, gold <= 0, true);
        button('Продолжить без Роги', () => { companionModal = null; payTribute(true); });
    } else {
        button('Поделиться золотом', () => { companionModal = { type: 'transfer', amount: Math.min(25, gold) }; }, gold <= 0, true);
        const free = rogiQuestionFree();
        button('Спросить совет' + (free ? ' · бесплатно' : rogi ? ' · ' + (selected >= 0 ? rogi.chestPrice : rogi.roomPrice) + ' зол.' : ''), () => {
            companionModal = null; if (selected >= 0) askRogiChest(); else askRogiRoom();
        }, !rogi || !companionAvailable() || gameState !== STATES.CHOOSE || (selected >= 0 && chests[selected]?.opened));
        if (companion.lastLoot?.owner === 'rogi') {
            button('Выкупить находку · ' + companion.lastLoot.price + ' зол.', buyCompanionLoot,
                !companionAvailable() || !companion.lastLoot.offer || gold < companion.lastLoot.price);
            button('Попросить поделиться находкой', requestCompanionLoot,
                !companionAvailable() || !companion.inventory.find(item => item.uid === companion.lastLoot.uid && !item.asked));
        }
    }
    chamberButton('Закрыть', { x, y: box.y + box.h - 44, w: innerW, h: 30 }, () => { companionModal = null; });
}
function drawRogiDialogueScreen() {
    const narrow = VIEW_W < 700 || VIEW_H < 500;
    const rect = canvas.getBoundingClientRect(), cssScale = rect.width / VIEW_W;
    const u = narrow ? 1 / cssScale : 1;
    const w = Math.min(narrow ? 540 * u : 900, VIEW_W - 24);
    const h = narrow ? VIEW_H - 24 : Math.min(610,VIEW_H-24);
    const box = {x:(VIEW_W-w)/2,y:(VIEW_H-h)/2,w,h};
    fillRound(box.x,box.y,w,h,18,'#141722','rgba(201,163,91,0.68)');
    const ai = RogiAI.ensure(companion), narrative = RogiVoice.state(companion), pad = narrow ? 14*u : 18;
    let portrait, textBox;
    if (narrow) {
        const portraitH = Math.min(90*u,h*0.20);
        portrait = {x:box.x+pad,y:box.y+10*u,w:72*u,h:portraitH};
        textBox = {x:portrait.x+portrait.w+12*u,y:portrait.y+6*u,w:w-pad*2-portrait.w-12*u};
    } else {
        const portraitW = Math.min(290,w*0.34);
        portrait = {x:box.x+12,y:box.y+20,w:portraitW,h:h-80};
        textBox = {x:box.x+portraitW+24,y:box.y+22,w:w-portraitW-42};
    }
    fillRound(portrait.x,portrait.y,portrait.w,portrait.h,14,'rgba(5,7,12,0.55)','rgba(178,145,101,0.32)');
    containChamberImage(chamberImages['rogi-'+(['worried','tense'].includes(ai.mood)?'interact':'idle')],
        {x:portrait.x+3,y:portrait.y+3,w:portrait.w-6,h:portrait.h-6});
    const titleY = textBox.y+10*u;
    drawText('РОГИ',textBox.x,titleY,'800 '+18*u+'px Manrope, sans-serif','#e5c5f2','left','middle');
    drawText(companionRelation()+' · '+RogiAI.moodLabel(ai.mood),textBox.x,titleY+23*u,
        '600 '+11*u+'px Inter, sans-serif','#cbb9d4','left','middle');
    if (narrow) {
        drawText('♥ '+companion.hp+'/'+companion.maxHp+' · золото '+companion.gold,textBox.x,titleY+45*u,
            '600 '+11*u+'px Inter, sans-serif','#e7cc98','left','middle');
        drawText('долг '+companion.debt+' · фокус '+ai.focus+'/'+ai.focusMax,textBox.x,titleY+62*u,
            '600 '+11*u+'px Inter, sans-serif','#e7cc98','left','middle');
    } else drawFittedText('♥ '+companion.hp+'/'+companion.maxHp+' · её золото '+companion.gold+' · долг '+companion.debt+' · фокус '+ai.focus+'/'+ai.focusMax,
        textBox.x+textBox.w/2,titleY+47,textBox.w,'600 11px Inter, sans-serif','#e7cc98');
    const lineX = narrow ? box.x+pad : textBox.x;
    const lineW = narrow ? w-pad*2 : textBox.w;
    const lineY = narrow ? portrait.y+portrait.h+18*u : box.y+130;
    const fontSize = narrow ? 15*u : Math.max(14,14/cssScale), lineH = narrow ? 22*u : Math.max(20,20/cssScale);
    const conversation=typeof RogiConversation!=='undefined'?RogiConversation.state(companion):null;
    const lastTurn=conversation?.turns[conversation.viewTurn??conversation.turns.length-1];
    const playerLine=lastTurn?.player||ai.lastPlayerLine;
    const earlier=lastTurn&&conversation.viewTurn<conversation.turns.length-1;
    const replyText = lastTurn?.reply || companion.dialogueLine || companion.line || 'Что хотел спросить?';
    const fullText = (earlier?'Ранее, обмен '+(conversation.viewTurn+1)+'. ':'')+
        (playerLine?'Вы: «'+playerLine+'»\n\n':'')+'Роги: '+replyText;
    const closeH = narrow ? 34*u : 28;
    const closeY = box.y+h-closeH-10*u;
    const gap = 6*u, buttonH = narrow ? 64*u : 48;
    const roomForBody = closeY-lineY-3*(buttonH+gap)-42*u;
    const bodyLines = Math.max(2,Math.min(8,Math.floor(roomForBody/lineH)));
    const makeSections = (speaker, text) => {
        if (!text) return [];
        const lines = quartermasterTextLines(text,'500 '+fontSize+'px Georgia, serif',lineW-20*u,1000);
        const chunkSize = Math.max(1,bodyLines-2), blocks = [];
        for(let i=0;i<lines.length;i+=chunkSize)blocks.push({speaker,lines:lines.slice(i,i+chunkSize)});
        return blocks;
    };
    const sections = [
        ...makeSections(earlier?'ВЫ · ПРЕДЫДУЩИЙ ОБМЕН':'ВЫ',playerLine),
        ...makeSections('РОГИ',replyText)
    ];
    const sectionPages=[[]];let usedLines=0;
    for(const section of sections){
        const cost=1+section.lines.length;
        if(usedLines+cost>bodyLines&&sectionPages.at(-1).length){sectionPages.push([]);usedLines=0;}
        sectionPages.at(-1).push(section);usedLines+=cost;
    }
    const pages=sectionPages.length;
    narrative.textPage = Math.max(0,Math.min(pages-1,Number(narrative.textPage)||0));
    const pageSections=sectionPages[narrative.textPage];
    let bodyY=lineY;
    const visibleLines=[];
    for(const section of pageSections){
        const headerH=17*u, padding=7*u, sectionH=headerH+section.lines.length*lineH+padding*2;
        fillRound(lineX,bodyY,lineW,sectionH,8,section.speaker.startsWith('ВЫ')?'rgba(36,31,23,0.72)':'rgba(30,23,38,0.82)',
            section.speaker.startsWith('ВЫ')?'rgba(200,160,90,0.28)':'rgba(178,145,201,0.36)');
        drawText(section.speaker,lineX+10*u,bodyY+headerH/2,'800 '+10*u+'px Manrope, sans-serif',
            section.speaker.startsWith('ВЫ')?'#d7b77a':'#d8b9e6','left','middle');
        section.lines.forEach((line,i)=>{
            drawText(line,lineX+10*u,bodyY+headerH+padding+i*lineH+lineH/2,
                '500 '+fontSize+'px Georgia, serif','#f1eadc','left','middle');visibleLines.push(line);
        });
        bodyY+=sectionH+7*u;
    }
    const pagerY = bodyY;
    if (pages > 1) {
        const b = {x:lineX,y:pagerY,w:lineW,h:26*u};
        drawText((narrative.textPage+1)+' / '+pages,b.x+b.w/2,b.y+b.h/2,'600 '+11*u+'px Inter, sans-serif',UIC.dim,'center','middle');
        const pageButton = (label,x,next,disabled) => {
            chamberButton(label,{x,y:b.y,w:Math.min(132*u,b.w*0.36),h:b.h},() => {narrative.textPage=next;},disabled,false,'',
                narrow ? {wrap:true,font:11*u,subFont:10*u,lineH:13*u,subH:11*u} : {});
        };
        pageButton('← Текст',b.x,narrative.textPage-1,narrative.textPage===0);
        pageButton('Текст →',b.x+b.w-Math.min(132*u,b.w*0.36),narrative.textPage+1,narrative.textPage===pages-1);
    }
    const choicesY = pagerY+(pages>1?33*u:8*u);
    const maxRows = Math.max(1,Math.floor((closeY-10*u-choicesY+gap)/(buttonH+gap)));
    const choices = RogiAI.availableChoices(companion,selected,Math.min(3,Math.max(1,maxRows-1)));
    companion.dialogueChoices = choices;
    const typography = narrow ? {wrap:true,font:13*u,subFont:10*u,lineH:16*u,subH:12*u} : {};
    choices.slice(0,maxRows).forEach((choice,i) => {
        const y = choicesY+i*(buttonH+gap);
        if(y+buttonH>closeY-8*u)return;
        chamberButton(choice.text,{x:lineX,y,w:lineW,h:buttonH},() => RogiAI.act(companion,choice.id,choice.text),!!choice.disabled,i===0,
            choice.disabled ? (choice.disabledReason || (conversation?RogiConversation.names[conversation.topic]:choice.category)) : '',typography);
    });
    chamberButton('Продолжить',{x:box.x+pad,y:closeY,w:w-pad*2,h:closeH},() => {RogiAI.closeDialogue(companion);companionModal=null;updateUI();},false,false,'',typography);
    // Test/debug geometry has no authority over game decisions.
    ai.dialogueMetrics = {cssScale,bodyFontCss:fontSize*cssScale,bodyLines,pages,visiblePage:narrative.textPage,maxRows,
        fullText,visibleLines,
        turnDecisionId:lastTurn?.decisionId || null,history:!!earlier};
}
