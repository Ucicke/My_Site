/* Independent artwork layers: background, character and chest states. */
'use strict';
const chamberImages = {};
for (const name of ['room', 'rogi-idle', 'rogi-interact', 'chest-closed', 'chest-empty', 'chest-relic', 'chest-mimic', 'chest-broken']) {
    const image = new Image(); image.src = 'assets/chamber/' + name + '.png'; chamberImages[name] = image;
}
let chamberRogiX = null;
function chamberButton(text, box, action, disabled = false, primary = false, sub = '', typography = {}) {
    drawCommonButton(box, BTN_STYLE[primary ? 'btn-gold' : 'btn-ghost'], disabled, 10);
    if (typography.wrap) {
        const font = '700 ' + typography.font + 'px Inter, sans-serif', subFont = '500 ' + typography.subFont + 'px Inter, sans-serif';
        const lines = quartermasterTextLines(text,font,box.w-16,2), subLines = sub ? quartermasterTextLines(sub,subFont,box.w-16,2) : [];
        const lineH = typography.lineH, subH = typography.subH;
        const total = lines.length*lineH+subLines.length*subH;
        let y = box.y+(box.h-total)/2+lineH/2;
        lines.forEach(line => { drawText(line,box.x+box.w/2,y,font,disabled ? UIC.dim : primary ? UIC.gold : UIC.text,'center','middle'); y += lineH; });
        y -= lineH/2; y += subH/2;
        subLines.forEach(line => { drawText(line,box.x+box.w/2,y,subFont,UIC.dim,'center','middle'); y += subH; });
        canvasHits.push({...box,ariaLabel:text+(sub?'. '+sub:''),disabled,action}); return;
    }
    drawFittedText(text, box.x + box.w / 2, box.y + (sub ? 17 : box.h / 2), box.w - 20,
        '700 13px Inter, sans-serif', disabled ? UIC.dim : primary ? UIC.gold : UIC.text);
    if (sub) drawFittedText(sub, box.x + box.w / 2, box.y + box.h - 13, box.w - 16,
        '500 10px Inter, sans-serif', UIC.dim);
    canvasHits.push({ ...box, ariaLabel: text + (sub ? '. ' + sub : ''), disabled, action });
}
function containChamberImage(image, box) {
    if (!image || !image.complete || !image.naturalWidth) return;
    const scale = Math.min(box.w / image.naturalWidth, box.h / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    ctx.drawImage(image, box.x + (box.w - w) / 2, box.y + box.h - h, w, h);
}
function drawCollectorPortrait(x,y,size) {
    ctx.save();
    ctx.translate(x,y); ctx.scale(size/40,size/40);
    ctx.fillStyle='#53664a'; ctx.strokeStyle='#c6a15e'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(8,12); ctx.lineTo(0,4); ctx.lineTo(14,8); ctx.quadraticCurveTo(20,3,26,8); ctx.lineTo(40,3); ctx.lineTo(32,15); ctx.quadraticCurveTo(37,30,26,35); ctx.lineTo(23,40); ctx.lineTo(17,35); ctx.quadraticCurveTo(4,31,8,12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#d7bf83'; ctx.beginPath(); ctx.ellipse(20,20,10,11,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#241a13'; ctx.beginPath(); ctx.arc(16,19,1.5,0,Math.PI*2); ctx.arc(24,19,1.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#5e2b22'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(16,26); ctx.quadraticCurveTo(20,29,24,26); ctx.stroke();
    ctx.restore();
}
function isChamberScreen() {
    return [STATES.CHOOSE, STATES.HEIST_CRISIS, STATES.OPENING, STATES.REACTION].includes(gameState) && chests.length > 0;
}
function drawChamber(t) {
    const narrow = VIEW_W < 700, low = compactLandscape;
    const top = UI.hudH + 14;
    const crisisActive = gameState === STATES.HEIST_CRISIS;
    const heistActive = HeistLoop.active();
    const guardedTreasury = crisisActive && HeistLoop.state().crisis?.scene === 'guarded-treasury';
    const guardedTreasuryOffer = !crisisActive && HeistLoop.guardedTreasuryAvailable();
    const selectedChest = selected >= 0 ? chests[selected] : null;
    const needsActionTray = crisisActive || (!!selectedChest && !selectedChest.opened && !isLocked());
    const footerH = crisisActive ? (narrow ? 280 : 238)
        : needsActionTray ? (narrow ? 254 : low ? 156 : 178)
            : guardedTreasuryOffer ? (narrow ? 176 : 152) : (narrow ? 112 : low ? 92 : 104);
    const footerY = VIEW_H - footerH - 14;
    UI.sceneY = top; UI.sceneH = Math.max(0, footerY - top); UI.sceneScaleY = 1;
    drawImageCover(chamberImages.room, 0, 0, VIEW_W, VIEW_H);
    const vignette = ctx.createLinearGradient(0, top, 0, VIEW_H);
    vignette.addColorStop(0, 'rgba(4,8,15,0.05)'); vignette.addColorStop(0.65, 'rgba(4,8,15,0.06)');
    vignette.addColorStop(1, 'rgba(4,8,15,0.85)'); ctx.fillStyle = vignette; ctx.fillRect(0, top, VIEW_W, VIEW_H - top);
    drawMapHud();
    const type = ROOM_TYPES[currentNode?.type] || ROOM_TYPES.FIGHT;
    const crisisState = HeistLoop.state().crisis;
    const title = guardedTreasury || guardedTreasuryOffer ? 'Охраняемая сокровищница'
        : currentNode?.type === 'BOSS' ? STAGES[stageIndex].boss : type.name;
    drawText(title,
        VIEW_W / 2, top + 20, '800 19px Manrope, Inter, sans-serif', '#f0d8ac', 'center', 'middle');
    const closed = chests.filter(c => !c.opened).length;
    const guardedPhase = crisisState?.view === 'treasury-briefing' ? 'ЗАМЫСЕЛ · решить, рисковать ли вместе'
        : crisisState?.view === 'team-plan' ? 'ПЛАН · выберите, кто отвлекает и кто вскрывает'
            : crisisState?.view === 'team-terms' ? 'ДОГОВОРЁННОСТЬ · согласуйте добычу до риска'
                : crisisState?.view === 'team-counter' ? 'ДОГОВОРЁННОСТЬ · Роги меняет условия'
                    : crisisState?.view === 'team-targets' ? 'ИСПОЛНЕНИЕ · условия уже зафиксированы' : 'ИТОГ АФЕРЫ';
    const sceneSubtitle = guardedTreasury || guardedTreasuryOffer
        ? (guardedTreasury ? guardedPhase : 'Часовой рядом · грубый взлом поднимет тревогу')
        : 'Этаж ' + floor + ' · закрытых сундуков: ' + closed + (boss && currentNode?.type === 'BOSS' ? ' · предводитель: ' + boss.hp + ' ХП' : '');
    drawText(sceneSubtitle,
        VIEW_W / 2, top + 44, '500 12px Inter, sans-serif', '#d4c3a7', 'center', 'middle');
    if (heistActive) {
        const hs = HeistLoop.state(), meterY = top + 64;
        if (narrow) {
            const focusX = VIEW_W * 0.25, noiseX = VIEW_W * 0.75;
            drawText('Фокус игрока ' + hs.playerFocus + '/' + HEIST_LOOP_RULES.maxFocus, focusX, meterY,
                '700 10px Inter, sans-serif', '#e4d1ae', 'center', 'middle');
            drawText('Тревога ' + hs.noise + '/' + HEIST_LOOP_RULES.alertAt, noiseX, meterY,
                '700 10px Inter, sans-serif', hs.noise >= HEIST_LOOP_RULES.alertAt - 1 ? '#f2a18f' : '#d8c9ae', 'center', 'middle');
            for (let i = 0; i < HEIST_LOOP_RULES.maxFocus; i++) fillRound(focusX - 19 + i * 13, meterY + 7, 9, 5, 2,
                i < hs.playerFocus ? '#e8bd65' : 'rgba(220,205,175,.16)', 'rgba(235,195,115,.5)');
            for (let i = 0; i < HEIST_LOOP_RULES.alertAt; i++) fillRound(noiseX - 25 + i * 13, meterY + 7, 9, 5, 2,
                i < hs.noise ? (i >= HEIST_LOOP_RULES.alertAt - 1 ? '#dc776e' : '#cf9c52') : 'rgba(220,205,175,.13)',
                'rgba(220,205,175,.25)');
        } else {
            drawText('Фокус игрока', VIEW_W / 2 - 122, meterY, '600 11px Inter, sans-serif', '#e4d1ae', 'right', 'middle');
            for (let i = 0; i < HEIST_LOOP_RULES.maxFocus; i++) {
                fillRound(VIEW_W / 2 - 112 + i * 13, meterY - 4, 9, 8, 3,
                    i < hs.playerFocus ? '#e8bd65' : 'rgba(220,205,175,.16)', 'rgba(235,195,115,.5)');
            }
            drawText('Тревога ' + hs.noise + '/' + HEIST_LOOP_RULES.alertAt,
                VIEW_W / 2 + 8, meterY, '700 11px Inter, sans-serif', hs.noise >= HEIST_LOOP_RULES.alertAt - 1 ? '#f2a18f' : '#d8c9ae', 'left', 'middle');
            for (let i = 0; i < HEIST_LOOP_RULES.alertAt; i++) {
                fillRound(VIEW_W / 2 + 96 + i * 12, meterY - 4, 8, 8, 3,
                    i < hs.noise ? (i >= HEIST_LOOP_RULES.alertAt - 1 ? '#dc776e' : '#cf9c52') : 'rgba(220,205,175,.13)',
                    'rgba(220,205,175,.25)');
            }
        }
    }
    const sideW = narrow ? 0 : Math.min(320, VIEW_W * 0.24);
    const sceneX = narrow ? 12 : sideW + 12;
    const sceneW = VIEW_W - sceneX - 18;
    const columns = narrow ? 2 : chests.length;
    const rows = Math.ceil(chests.length / columns);
    const gridY = top + (heistActive ? (narrow ? 88 : 86) : (narrow ? 66 : 74));
    const gridH = Math.max(100, footerY - gridY - (narrow && companion.active ? 66 : 10));
    const cellW = sceneW / columns, cellH = gridH / rows;
    const boxes = chests.map((c, i) => {
        const w = Math.min(narrow ? 210 : 300, cellW - 10);
        const h = Math.min(cellH - 15, w * 0.85);
        const box = { x: sceneX + i % columns * cellW + (cellW - w) / 2,
            y: gridY + Math.floor(i / columns) * cellH + (cellH - h) / 2, w, h };
        c.hitBox = box; c.x = box.x; c.y = box.y - top + box.h * 0.5; c.w = box.w;
        return box;
    });
    boxes.forEach((box, i) => {
        const c = chests[i];
        const hover = !c.opened && menuHover(box), chosen = selected === i;
        const centerX = box.x + box.w / 2;
        ctx.save();
        if (hover || chosen) { ctx.shadowColor = 'rgba(241,190,103,0.5)'; ctx.shadowBlur = chosen ? 22 : 12; }
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath();
        ctx.ellipse(centerX, box.y + box.h - 8, box.w * 0.4, 10, 0, 0, TAU); ctx.fill();
        if (hover || chosen) fillRound(box.x, box.y + 4, box.w, box.h - 2, 14,
            'rgba(240,184,77,0.04)', chosen ? '#dbb66e' : 'rgba(219,182,110,0.6)');
        const revealed = c.resolved;
        const state = c.destroyed ? 'broken' : revealed ? c.type === 'mimic' ? 'mimic' : c.type === 'scroll' ? 'relic' : 'empty' : 'closed';
        let shakeX = 0;
        if (!prefersReducedMotion() && gameState === STATES.OPENING && selected === i) shakeX = Math.sin(c.openT * 32) * (c.method === 'break' ? 5 : 1.5);
        containChamberImage(chamberImages['chest-' + state], { x: box.x + shakeX, y: box.y, w: box.w, h: box.h });
        ctx.restore();
        const marker = c.destroyed ? 'Разбит' : c.resolved ? 'Вскрыт' : c.known === 'mimic' ? 'Опасность' : c.known === 'scroll' ? 'Свиток' : c.known === 'safe' ? 'Безопасен' : 'Сундук ' + (i + 1);
        drawText(marker, centerX, box.y + box.h + 9, '600 11px Inter, sans-serif',
            c.known === 'mimic' ? '#f39a99' : chosen ? '#f5d18a' : '#e1d1b8', 'center', 'middle');
        if (!c.opened) canvasHits.push({ ...box, ariaLabel: 'Выбрать сундук ' + (i + 1), action: () => selectChest(i), disabled: isLocked() || crisisActive });
    });
    if (companion.active) {
        const target = selected >= 0 && chests[selected]?.actor === 'rogi' && isLocked() ? boxes[selected] : null;
        const home = narrow ? 8 : 24;
        const aim = target ? target.x - (narrow ? 30 : 110) : home;
        if (chamberRogiX === null || prefersReducedMotion()) chamberRogiX = aim;
        else chamberRogiX += (aim - chamberRogiX) * 0.13;
        /* На телефонах оставляем персонажу отдельное место под сундуками,
           чтобы Роги не терялась у самого пола и не перекрывала добычу. */
        const figureH = narrow ? 74 : Math.max(120, Math.min(345, footerY - top - 180));
        const figureY = narrow && !target ? top + 8 : footerY - figureH - 4;
        containChamberImage(chamberImages[target ? 'rogi-interact' : 'rogi-idle'], { x: chamberRogiX, y: figureY, w: narrow ? 54 : sideW - 12, h: figureH });
        if (!narrow) drawCompanionCard({ x: 18, y: top + 70, w: sideW - 20, h: Math.min(205, footerY - top - figureH - 70) });
    }
    const footer = { x: 14, y: footerY, w: VIEW_W - 28, h: footerH };
    fillRound(footer.x, footer.y, footer.w, footer.h, 14, 'rgba(9,14,22,0.95)', 'rgba(206,160,88,0.4)');
    const crisisMode = crisisState?.mode || HeistLoop.mode();
    const result = guardedTreasuryOffer
        ? 'Часовой обходит комнату. Можно отвлечь его вместе с Роги — или выбрать обычный взлом.'
        : crisisActive && guardedTreasury ? 'Сначала договоритесь о ролях и добыче. Оба потратят по 1 фокусу только при выборе сундука.'
        : crisisActive ? crisisMode === 'B1'
        ? 'Гоблин-сборщик требует пошлину. Уйти можно сейчас — или рискнуть одним закрытым сундуком.'
        : 'Монстр услышал шум. Сундуки и пути выбора приостановлены, пока вы не решите, как выкрутиться.'
        : isLocked() ? gameState === STATES.OPENING ? (chests[selected]?.actor === 'rogi' ? 'Роги ' + (chests[selected].method === 'break' ? 'взламывает сундук…' : 'осторожно поднимает крышку…') : 'Вы открываете сундук…') : lastEvent : lastEvent || (selected < 0 ? 'Выберите сундук, чтобы решить, кто примет на себя риск.' : 'Выберите следующий закрытый сундук.');
    const resultX = crisisActive && crisisMode === 'B1' ? footer.x + 62 : footer.x + 14;
    const resultLines = quartermasterTextLines(result, '500 13px Inter, sans-serif', footer.x + footer.w - resultX - 14, 2);
    if (crisisActive && crisisMode === 'B1') {
        drawCollectorPortrait(footer.x + 16,footer.y + 8,38);
        drawText('СБОРЩИК ПОШЛИНЫ',resultX,footer.y+9,'800 9px Inter, sans-serif','#d8b36e','left','middle');
    }
    resultLines.forEach((line, i) => drawText(line, resultX, footer.y + (crisisActive && crisisMode === 'B1' ? 26 : 21) + i * 18, '500 13px Inter, sans-serif', UIC.text, 'left', 'middle'));
    const actionY = footer.y + 62;
    const c = chests[selected];
    if (crisisActive) {
        const crisis = HeistLoop.state().crisis;
        const ai = companion.active ? RogiAI.ensure(companion) : null;
        const available = chests.map((item,index)=>({item,index})).filter(({item})=>!item.opened&&!item.destroyed);
        if (guardedTreasury) {
            if (crisis.view === 'treasury-briefing') {
                drawText('ЧАСОВОЙ РЯДОМ',footer.x+14,actionY-9,'800 10px Inter, sans-serif',UIC.gold,'left','middle');
                const lines=['Сборщик следит за сундуками. Один отвлекает его, второй проверяет замок.','Успех не добавляет тревогу; при обнаружении пострадает отвлекавший.'];
                lines.forEach((line,i)=>drawText(line,footer.x+14,actionY+9+i*18,'500 12px Inter, sans-serif',UIC.text,'left','middle'));
                const y=actionY+62,gap=8,bh=narrow?48:52,bw=(footer.w-28-gap)/2;
                chamberButton('Согласовать роли',{x:footer.x+14,y,w:bw,h:bh},
                    ()=>HeistLoop.resolve('guarded-heist-continue'),false,true,'риск и цена будут показаны до сделки',
                    narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{});
                chamberButton('К обычному взлому',{x:footer.x+14+bw+gap,y,w:bw,h:bh},
                    ()=>HeistLoop.resolve('guarded-heist-decline'),false,false,'без цены и без штрафа',
                    narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{});
            } else if (crisis.view === 'team-plan') {
                drawText('КТО ОТВЛЕКАЕТ СБОРЩИКА?',footer.x+14,actionY-9,'800 10px Inter, sans-serif',UIC.gold,'left','middle');
                const plans=HeistLoop.teamHeistPlans();
                const choices=plans.map(plan=>[
                    plan.id==='player-distracts-rogi-opens'?'Вы отвлекаете · Роги вскрывает':'Роги отвлекает · вы вскрываете',
                    ()=>HeistLoop.resolve('team-heist-plan',plan.id),!plan.available,
                    '1 фокус каждому · '+Math.round(plan.detectionChance*100)+'% обнаружения · '+
                        (plan.distractor==='player'?'если найдут — −1 ♥ вам':'если найдут — −1 ♥ Роги')+' · мимик ранит вскрывшего'
                ]);
                const perRow=narrow?1:2,gap=7,bh=narrow?52:56,bw=(footer.w-28-gap*(perRow-1))/perRow;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+Math.floor(i/perRow)*(bh+gap),w:bw,h:bh},
                    action,disabled,i===0,sub,narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{}));
                chamberButton('Назад',{x:footer.x+14,y:footer.y+footer.h-42,w:Math.min(140,footer.w-28),h:28},
                    ()=>HeistLoop.resolve('team-heist-back'));
            } else if (crisis.view === 'team-terms') {
                const plan=TEAM_HEIST_PLANS[crisis.teamHeistDraft?.planId];
                const terms=HeistLoop.teamHeistTerms(crisis.teamHeistDraft?.planId);
                const choices=terms.map(term=>{
                    const owner=term.owner==='opener'?plan?.opener:term.owner;
                    const label=term.id==='player-keeps-share25'?'Находка игроку · 25% с продажи':
                        owner==='rogi'?'Вся находка Роги':'Вся находка игроку';
                    return [label,()=>HeistLoop.resolve('team-heist-offer',term.id),false,
                        term.sharePercent?'только при фактической продаже':'без доли и перевода золота'];
                });
                drawText('КОМУ ДОСТАНЕТСЯ НАХОДКА?',footer.x+14,actionY-9,'700 11px Inter, sans-serif',UIC.gold,'left','middle');
                const perRow=narrow?1:3,gap=7,bh=narrow?44:50,bw=(footer.w-28-gap*(perRow-1))/perRow;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+Math.floor(i/perRow)*(bh+gap),w:bw,h:bh},
                    action,disabled,i===0,sub,narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{}));
                chamberButton('Назад',{x:footer.x+14,y:footer.y+footer.h-42,w:Math.min(140,footer.w-28),h:28},
                    ()=>HeistLoop.resolve('team-heist-back'));
            } else if (crisis.view === 'team-counter') {
                const draft=crisis.teamHeistDraft,term=TEAM_HEIST_TERMS[draft?.counterTermId],plan=TEAM_HEIST_PLANS[draft?.planId];
                const owner=term?.owner==='opener'?plan?.opener:term?.owner;
                const condition=term?.id==='player-keeps-share25'?'Свиток остаётся у вас; Роги получает 25% только после фактической продажи.'
                    :owner==='rogi'?'Роги забирает находку. Вместо ненадёжной доли она просит закрепить свиток за собой.'
                        :'Роги оставляет находку вам без доли.';
                drawText('ВСТРЕЧНОЕ УСЛОВИЕ',footer.x+14,actionY-9,'800 10px Inter, sans-serif',UIC.gold,'left','middle');
                drawText(condition,footer.x+14,actionY+12,'600 12px Inter, sans-serif',UIC.text,'left','middle');
                const choices=[['Принять',()=>HeistLoop.resolve('team-heist-counter-accept'),false,'по 1 фокусу каждому при выборе сундука'],
                    ['Отказаться',()=>HeistLoop.resolve('team-heist-counter-decline'),false,'обычный взлом останется доступен']];
                const perRow=narrow?1:2,gap=7,bh=narrow?46:52,bw=(footer.w-28-gap)/2;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+52+i*(bh+gap),w:bw,h:bh},action,disabled,i===0,sub,
                    narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{}));
            } else if (crisis.view === 'team-targets') {
                const plan=TEAM_HEIST_PLANS[crisis.teamHeist?.planId],term=TEAM_HEIST_TERMS[crisis.teamHeist?.termId];
                const owner=term?.owner==='opener'?plan?.opener:term?.owner;
                const share=owner==='player'?(term?.sharePercent||0):0;
                const chance=HeistLoop.teamHeistPlans().find(item=>item.id===plan?.id)?.detectionChance||0;
                drawText('ВЫБЕРИТЕ СУНДУК',footer.x+14,actionY-9,'800 10px Inter, sans-serif',UIC.gold,'left','middle');
                const choices=available.map(({index},i)=>[
                    'Сундук '+(index+1),()=>HeistLoop.resolve('team-heist-target',index),false,
                    '−1 фокус каждому · обнаружение '+Math.round(chance*100)+'% · '+
                        (owner==='rogi'?'находка Роги':owner==='player'?'находка игрока':'находка вскрывшего')+
                        (share?' · доля Роги '+share+'% с продажи':'')
                ]);
                const perRow=narrow?2:3,gap=7,bh=narrow?48:52,bw=(footer.w-28-gap*(perRow-1))/perRow;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+18+Math.floor(i/perRow)*(bh+gap),w:bw,h:bh},
                    action,disabled,i===0,sub,narrow?{wrap:true,font:12,subFont:8,lineH:14,subH:9}:{}));
                drawText('При обнаружении страдает отвлекавший; мимик кусает вскрывавшего.',footer.x+14,footer.y+footer.h-25,
                    '600 10px Inter, sans-serif','#e1c8f1','left','middle');
            } else {
                drawText(lastEvent||'Сцену можно продолжить обычным способом.',footer.x+14,actionY,'600 12px Inter, sans-serif',UIC.text,'left','middle');
                chamberButton('К комнате',{x:footer.x+14,y:actionY+26,w:Math.min(170,footer.w-28),h:44},
                    ()=>HeistLoop.resolve('guarded-heist-decline'),false,true);
            }
        } else if (crisisMode === 'B1') {
            const targetSource = crisis.rogiDealPending ? 'rogi' : 'player';
            if (crisis.lastScore?.committed) {
                const chestNo = crisis.lastScore.target + 1;
                chamberButton('Продолжить вскрытие · сундук ' + chestNo,
                    { x:footer.x+14, y:actionY, w:footer.w-28, h:narrow?52:56 },
                    () => HeistLoop.resolve('resume-last-score'), false, true,
                    'цена уже списана · содержимое зафиксировано · после результата обязательный выход',
                    narrow ? {wrap:true,font:12,subFont:9,lineH:14,subH:10} : {});
            } else if (crisis.teamHeist?.committed) {
                const plan=TEAM_HEIST_PLANS[crisis.teamHeist.planId];
                chamberButton('Продолжить аферу · вскрывает '+(plan?.opener==='rogi'?'Роги':'игрок'),
                    {x:footer.x+14,y:actionY,w:footer.w-28,h:narrow?52:56},
                    ()=>HeistLoop.resolve('resume-team-heist'),false,true,
                    'договор и оба расхода уже сохранены · повторно не исполнится',
                    narrow?{wrap:true,font:12,subFont:9,lineH:14,subH:10}:{});
            } else if (crisis.view === 'team-plan') {
                const plans=HeistLoop.teamHeistPlans();
                const choices=plans.map(plan=>[
                    plan.id==='player-distracts-rogi-opens'?'Игрок отвлекает · Роги вскрывает':'Роги отвлекает · игрок вскрывает',
                    ()=>HeistLoop.resolve('team-heist-plan',plan.id),!plan.available,
                    'по 1 фокусу каждому · обнаружение '+Math.round(plan.detectionChance*100)+'% · мимик бьёт вскрывшего'
                ]);
                const perRow=narrow?1:2,gap=7,bh=narrow?46:52,bw=(footer.w-28-gap*(perRow-1))/perRow;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+Math.floor(i/perRow)*(bh+gap),w:bw,h:bh},
                    action,disabled,i===0,sub,narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{}));
                chamberButton('Назад',{x:footer.x+14,y:footer.y+footer.h-42,w:Math.min(140,footer.w-28),h:28},
                    ()=>HeistLoop.resolve('team-heist-back'));
            } else if (crisis.view === 'team-terms') {
                const planId=crisis.teamHeistDraft?.planId,plan=TEAM_HEIST_PLANS[planId];
                const terms=HeistLoop.teamHeistTerms(planId);
                const choices=terms.map(term=>{
                    const owner=term.owner==='opener'?plan?.opener:term.owner;
                    const label=term.id==='opener-keeps'?'Находка — '+(owner==='rogi'?'Роги':'игроку')
                        :term.id==='player-keeps-share25'?'Игроку · Роги 25% с продажи'
                            :term.id==='player-keeps'?'Игроку · без доли':'Роги забирает свиток';
                    return [label,()=>HeistLoop.resolve('team-heist-offer',term.id),false,
                        term.sharePercent?'только если свиток продадут':'без передачи золота'];
                });
                const perRow=narrow?1:3,gap=7,bh=narrow?42:50,bw=(footer.w-28-gap*(perRow-1))/perRow;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+Math.floor(i/perRow)*(bh+gap),w:bw,h:bh},
                    action,disabled,i===0,sub,narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{}));
                chamberButton('Назад',{x:footer.x+14,y:footer.y+footer.h-42,w:Math.min(140,footer.w-28),h:28},
                    ()=>HeistLoop.resolve('team-heist-back'));
            } else if (crisis.view === 'team-counter') {
                const draft=crisis.teamHeistDraft,term=TEAM_HEIST_TERMS[draft?.counterTermId],plan=TEAM_HEIST_PLANS[draft?.planId];
                const owner=term?.owner==='opener'?plan?.opener:term?.owner;
                const offered=term?.id==='player-keeps-share25'?'Свиток игроку, Роги получает 25% будущей продажи.'
                    :owner==='rogi'?'Роги оставляет находку себе по договору.':'Игрок оставляет находку без доли Роги.';
                drawText('Роги меняет условия: '+offered,footer.x+14,actionY-12,'600 12px Inter, sans-serif',UIC.gold,'left','middle');
                const choices=[
                    ['Принять условия',()=>HeistLoop.resolve('team-heist-counter-accept'),false,'фокус спишется только при выборе сундука'],
                    ['Отказаться',()=>HeistLoop.resolve('team-heist-counter-decline'),false,'обычные выходы останутся']
                ];
                const perRow=narrow?1:2,gap=7,bh=narrow?46:52,bw=(footer.w-28-gap*(perRow-1))/perRow;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+Math.floor(i/perRow)*(bh+gap),w:bw,h:bh},
                    action,disabled,i===0,sub,narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{}));
            } else if (crisis.view === 'team-targets') {
                const plan=TEAM_HEIST_PLANS[crisis.teamHeist?.planId],term=TEAM_HEIST_TERMS[crisis.teamHeist?.termId];
                const owner=term?.owner==='opener'?plan?.opener:term?.owner;
                const share=owner==='player'?(term?.sharePercent||0):0;
                const choices=available.map(({item,index})=>[
                    'Сундук '+(index+1),()=>HeistLoop.resolve('team-heist-target',index),false,
                    'договор: '+(owner==='rogi'?'находка Роги':owner==='player'?'находка игрока':'вскрывший владеет')+
                        (share?' · Роги '+share+'% при продаже':'')
                ]);
                const perRow=narrow?2:3,gap=7,bh=narrow?46:52,bw=(footer.w-28-gap*(perRow-1))/perRow;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+Math.floor(i/perRow)*(bh+gap),w:bw,h:bh},
                    action,disabled,i===0,sub,narrow?{wrap:true,font:12,subFont:8,lineH:14,subH:9}:{}));
                drawText('По 1 фокусу каждому · '+Math.round((HeistLoop.teamHeistPlans().find(item=>item.id===plan?.id)?.detectionChance||0)*100)+
                    '% риск обнаружения · мимик кусает вскрывшего',footer.x+14,footer.y+footer.h-27,
                    '600 10px Inter, sans-serif','#e1c8f1','left','middle');
            } else if (crisis.view === 'rogi-terms') {
                const choices = [
                    ['Принять · 50%', () => HeistLoop.resolve('rogi-deal-accept'), false, 'доля Роги только от продажи'],
                    ['Предложить 25%', () => HeistLoop.resolve('rogi-deal-counter'), false, 'встречное предложение'],
                    ['Отказаться', () => HeistLoop.resolve('rogi-deal-decline'), false, 'без расхода фокуса']
                ];
                const perRow=narrow?1:3,gap=7,bh=narrow?43:52,bw=(footer.w-28-gap*(perRow-1))/perRow;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+Math.floor(i/perRow)*(bh+gap),w:bw,h:bh},
                    action,disabled,i===0,sub,narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{}));
            } else if (crisis.view === 'targets') {
                const choices = available.map(({item,index})=>[
                    'Сундук ' + (index + 1),
                    () => HeistLoop.resolve('last-score-target',index,targetSource),
                    targetSource === 'player' && (HeistLoop.focus() < 1 || gold < 15),
                    targetSource === 'rogi' ? 'фокус Роги · ' + (crisis.rogiSharePercent || 50) + '% с будущей продажи'
                        : 'цена: 1 фокус + 15 зол. · риск мимика · затем выход'
                ]);
                const perRow = narrow ? 2 : 3, gap=7, bh=narrow?48:52;
                const bw=(footer.w-28-gap*(perRow-1))/perRow;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+Math.floor(i/perRow)*(bh+gap),w:bw,h:bh},
                    action,disabled,i===0,sub,narrow?{wrap:true,font:12,subFont:9,lineH:14,subH:10}:{}));
                if (!crisis.rogiDealPending) chamberButton('Назад',
                    {x:footer.x+14,y:footer.y+footer.h-44,w:Math.min(150,footer.w-28),h:30},
                    ()=>HeistLoop.resolve('last-score-back'),false,false,'вернуться к решению');
                else drawText('Роги отвлекает сборщика — выберите один сундук.',footer.x+14,footer.y+footer.h-28,
                    '600 11px Inter, sans-serif','#e1c8f1','left','middle');
            } else if (crisis.view === 'escape') {
                const choices = [
                    ['Затаиться и уйти', () => HeistLoop.resolve('hide'), HeistLoop.focus() < HEIST_LOOP_RULES.hideCost, 'фокус игрока −2 · уход'],
                    [scrollInventory.length ? 'Отдать свиток' : 'Нет свитка', () => HeistLoop.resolve('scroll'), !scrollInventory.length, scrollInventory.length ? 'самый дешёвый · уход' : 'в сумке пусто'],
                    ['Пошлина · 30 зол.', () => HeistLoop.resolve('gold'), gold < HEIST_LOOP_RULES.bribeGold, 'полная цена · гарантированный уход'],
                    ['Предложить 15 зол.', () => HeistLoop.resolve('haggle',15), gold < 15, 'сборщик может отказаться'],
                    ['Предложить 20 зол.', () => HeistLoop.resolve('haggle',20), gold < 20, 'нижняя цена сборщика · гарантированный проход'],
                    [crisis?.rogiTried ? 'Роги уже ответила' : 'Попросить Роги уйти', () => HeistLoop.resolve('rogi'), !companion.active || !ai || ai.focus < 1 || companion.hp <= 0 || !!crisis?.rogiTried, 'её решение · фокус −1'],
                    ['Бежать', () => HeistLoop.resolve('flee'), !available.length && !chests.some(item=>item.opened&&!item.destroyed), '−1 ♥ · покинуть комнату'],
                    ['Назад', () => HeistLoop.resolve('crisis-back'), false, 'к выбору между уходом и последним сундуком']
                ];
                const perRow=narrow?2:3,gap=7,bh=narrow?42:48,bw=(footer.w-28-gap*(perRow-1))/perRow;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+Math.floor(i/perRow)*(bh+gap),w:bw,h:bh},
                    action,disabled,i===0,sub,narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{}));
            } else {
                const hasClosed=available.length>0;
                const choices = [
                    ['Последний куш', () => HeistLoop.resolve('last-score'), !hasClosed || HeistLoop.focus()<1 || gold<15,
                        !hasClosed ? 'закрытых сундуков не осталось' : '1 фокус + 15 зол. · содержимое фиксировано · риск мимика'],
                    ['Совместная афера', () => HeistLoop.resolve('team-heist'), !hasClosed || !companion.active || !ai || ai.focus<1 ||
                        companion.hp<=0 || crisis.teamHeistTried || HeistLoop.focus()<1,
                        !hasClosed?'закрытых сундуков не осталось':'договор до риска · по 1 фокусу · выбор ролей'],
                    [!companion.active ? 'Роги недоступна' : crisis.rogiScoreTried ? 'Роги уже ответила' : 'Попросить Роги прикрыть',
                        () => HeistLoop.resolve('last-score-rogi'), !hasClosed || !companion.active || !ai || ai.focus<1 || companion.hp<=0 || crisis.rogiScoreTried,
                        !companion.active ? 'вы одни' : crisis.rogiScoreTried ? 'её ответ окончательный' : 'может отказать · условия сделки до риска'],
                    ['Уйти с добытым', () => HeistLoop.resolve('escape-options'), false, 'пошлина, свиток, тишина или бегство']
                ];
                const perRow=narrow?2:2,gap=7,bh=narrow?48:52,bw=(footer.w-28-gap*(perRow-1))/perRow;
                choices.forEach(([label,action,disabled,sub],i)=>chamberButton(label,
                    {x:footer.x+14+i%perRow*(bw+gap),y:actionY+Math.floor(i/perRow)*(bh+gap),w:bw,h:bh},
                    action,disabled,i===0,sub,narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{}));
            }
        } else {
        const choices = [
            ['Затаиться и уйти', () => HeistLoop.resolve('hide'), HeistLoop.focus() < HEIST_LOOP_RULES.hideCost, 'фокус игрока −2 · уход'],
            [scrollInventory.length ? 'Отдать свиток' : 'Нет свитка', () => HeistLoop.resolve('scroll'), !scrollInventory.length,
                scrollInventory.length ? 'самый дешёвый · уход' : 'в сумке пусто'],
            ['Подкупить', () => HeistLoop.resolve('gold'), gold < HEIST_LOOP_RULES.bribeGold, '−' + HEIST_LOOP_RULES.bribeGold + ' золота · уход'],
            [crisis?.rogiTried ? 'Роги уже ответила' : 'Попросить Роги', () => HeistLoop.resolve('rogi'),
                !companion.active || !ai || ai.focus < 1 || companion.hp <= 0 || !!crisis?.rogiTried,
                !companion.active ? 'вы одни' : crisis?.rogiTried ? 'действуйте сами' : 'фокус Роги −1 · уход'],
            ['Бежать', () => HeistLoop.resolve('flee'), !chests.some(item => item.opened && !item.destroyed), '−1 ♥ · выйти из комнаты']
        ];
        const perRow = narrow ? 2 : 3, gap = 7, bh = narrow ? 48 : 52;
        const bw = (footer.w - 28 - gap * (perRow - 1)) / perRow;
        choices.forEach(([label, action, disabled, sub], i) => chamberButton(label,
            { x: footer.x + 14 + i % perRow * (bw + gap), y: actionY + Math.floor(i / perRow) * (bh + gap), w: bw, h: bh },
            action, disabled, i === 0, sub, narrow ? { wrap:true, font:12, subFont:9, lineH:14, subH:10 } : {}));
        }
    } else if (c && !c.opened && !isLocked()) {
        const actions = [
            ['Вскрыть тихо', () => requestOpen('careful'), HeistLoop.active() && HeistLoop.focus() < HEIST_LOOP_RULES.carefulCost,
                HeistLoop.active() ? '−1 фокус · +1 тревога' : 'Рискуете вы · добыча ваша'],
            ['Вскрыть грубо', () => requestOpen('rough'), false,
                HeistLoop.active() ? 'без фокуса · +2 тревоги' : 'Рискуете вы · добыча ваша'],
            ['Попросить Роги открыть', () => requestCompanionChest('open'), !!companionActionReason('open'), 'Рискует Роги · находка её'],
            ['Попросить Роги сломать', () => requestCompanionChest('break'), !!companionActionReason('break'), 'Шанс разбить мимика · риск порчи']
        ];
        const perRow = narrow ? 2 : 4, gap = 8, bh = narrow ? 46 : 52;
        const bw = (footer.w - 28 - gap * (perRow - 1)) / perRow;
        actions.forEach(([label, action, disabled, sub], i) => {
            if (i >= 2 && !companion.active) return;
            const reason = i >= 2 && disabled ? companionActionReason(i === 3 ? 'break' : 'open') : sub;
            chamberButton(label, { x: footer.x + 14 + i % perRow * (bw + gap), y: actionY + Math.floor(i / perRow) * (bh + gap), w: bw, h: bh }, action, disabled, i === 0,
                i === 0 || i === 1 ? sub : reason);
        });
    } else if (!isLocked()) {
        if (guardedTreasuryOffer) {
            drawText('Можно договориться до первого взлома.',footer.x+14,actionY-10,'600 12px Inter, sans-serif',UIC.text,'left','middle');
            chamberButton('Предложить совместный план',{x:footer.x+14,y:actionY+5,w:Math.min(narrow?footer.w-28:310,footer.w-28),h:42},
                ()=>HeistLoop.beginGuardedTreasury(),!companion.active||companion.hp<=0||HeistLoop.focus()<1||RogiAI.ensure(companion)?.focus<1,
                true,'по 1 фокусу каждому · сначала роли и условия',narrow?{wrap:true,font:11,subFont:8,lineH:12,subH:9}:{});
        } else drawText('Нажмите на закрытый сундук, чтобы выбрать действие.', footer.x + 14, actionY + 15,
            '500 13px Inter, sans-serif', UIC.dim, 'left', 'middle');
    }
    if (!crisisActive && companion.active && narrow) drawText('Роги ' + companion.hp + '/' + companion.maxHp + ' ♥ · ' + companion.gold + ' зол. · долг ' + companion.debt + ' · доверие ' + rogiTrust,
        VIEW_W - 18, footerY - 24, '600 10px Inter, sans-serif', '#e1c8f1', 'right', 'middle');
    const bottomY = footer.y + footer.h - 38;
    if (!crisisActive && companion.active) {
        const ai = RogiAI.ensure(companion);
        chamberButton('Роги · фокус ' + ai.focus + '/' + ai.focusMax, { x: footer.x + 12, y: bottomY, w: narrow ? 178 : 210, h: 28 }, () => RogiAI.openDialogue(companion), isLocked());
    }
    const canLeave = chests.some(item => item.opened && !item.destroyed);
    if (!crisisActive && currentNode?.type !== 'BOSS') chamberButton('Покинуть комнату',
        { x: footer.x + footer.w - (narrow ? 153 : 190) - 12, y: bottomY, w: narrow ? 153 : 190, h: 28 }, leaveRoom, !canLeave || isLocked());
    if (companionModal) { canvasHits = []; drawCompanionModal(); }
}
