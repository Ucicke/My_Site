function drawHudIconButton(box, icon, ariaLabel, action) {
    drawMenuControl(box, ariaLabel, action, active => {
        drawSvgIcon(icon, box.x + (box.w - 18) / 2, box.y + (box.h - 18) / 2, 18,
            settings.muted && ariaLabel.indexOf('звук') >= 0 ? 'rgba(220,210,192,0.58)' : active ? '#f1c46f' : '#e7d7b5');
    });
}

function drawHelpButton(cx, cy) {
    const box = { x: cx - 18, y: cy - 18, w: 36, h: 36 };
    drawMenuControl(box, 'Как играть: открыть правила', () => openRules(true), active => {
        drawText('?', cx, cy + 0.5, '800 20px Manrope, Inter, sans-serif', active ? '#f1c46f' : UIC.gold, 'center', 'middle');
    });
}

function drawLocationHeading() {
    const isCamp = gameState === STATES.CAMP;
    const isFinal = isCamp && currentNode?.type === 'CAMP_FINALE';
    const title = isCamp ? (isFinal ? 'ПОСЛЕДНИЙ КОСТЁР' : 'ЛАГЕРЬ') : 'ЛАВКА';
    const subtitle = isCamp
        ? 'Передышка перед следующим участком пути'
        : 'Припасы, реликвии и торговля со странником';
    const w = Math.min(520, VIEW_W - 28), h = 62;
    const narrowPhone = canvas.getBoundingClientRect().width < 340;
    const headingOffset = narrowPhone ? 110 : 72;
    const box = { x: (VIEW_W - w) / 2, y: UI.sceneY + headingOffset, w, h };
    fillRound(box.x, box.y, box.w, box.h, 12, 'rgba(7,10,16,0.76)', 'rgba(217,158,58,0.32)');
    drawFittedText(title, VIEW_W / 2, box.y + 23, w - 28,
        '800 23px Manrope, Inter, sans-serif', UIC.gold);
    drawFittedText(subtitle, VIEW_W / 2, box.y + 45, w - 28,
        '500 12px Inter, sans-serif', '#d5c8b4');
}

function drawMapHud() {
    const mobile = VIEW_W < 900 && !compactLandscape;
    const h = UI.hudH;
    const tribute = currentTribute();
    const labelColor = 'rgba(220,210,192,0.58)';
    fillRound(10, 7, VIEW_W - 20, h - 12, 14, 'rgba(10,15,23,0.96)', 'rgba(217,158,58,0.25)');
    const controlsX = VIEW_W - 28;
    drawHudIconButton({ x: controlsX - 17, y: 14, w: 34, h: 34 },
        settings.muted ? ICONS.soundOff : ICONS.soundOn,
        settings.muted ? 'Включить звук' : 'Выключить звук', toggleMute);
    drawHelpButton(controlsX - 42, 31);
    const statWidth = mobile ? VIEW_W - 110 : VIEW_W * 0.48;
    const xs = [20, 20 + statWidth * 0.5];
    const labelY = compactLandscape ? 18 : 29;
    const valueY = compactLandscape ? 40 : 57;
    [companion.active ? 'ВЫ' : 'ЖИЗНИ', 'НЕДЕЛЯ'].forEach((label, i) => {
        drawText(label, xs[i], labelY, '800 ' + (mobile ? 8 : 10) + 'px Manrope, Inter, sans-serif', labelColor, 'left', 'middle');
    });
    for (let i = 0; i < maxHp; i++) {
        drawSvgIcon(ICONS.heart, xs[0] + i * (mobile ? 12 : 18), valueY - 7,
            mobile ? 10 : 14, i < hp ? '#ff7186' : 'rgba(220,210,192,0.2)');
    }
    if (companion.active) {
        drawText('РОГИ', xs[0], valueY + 18, '800 8px Manrope, sans-serif', '#cfb2e5', 'left', 'middle');
        for (let i = 0; i < companion.maxHp; i++) drawSvgIcon(ICONS.heart,
            xs[0] + 35 + i * 13, valueY + 12, 10, i < companion.hp ? '#c495e3' : '#51445e');
        const companionBox = { x: xs[0], y: valueY + 8, w: 35 + companion.maxHp * 13, h: 22 };
        if (!isLocked()) canvasHits.push({ ...companionBox, ariaLabel: 'Роги: здоровье, золото и помощь',
            action: () => RogiAI.openDialogue(companion) });
    }
    drawText(week + '/' + CAMPAIGN.weeks, xs[1], valueY, '800 ' + (mobile ? 19 : 25) + 'px Manrope, Inter, sans-serif', UIC.text, 'left', 'middle');
    const bagBox = { x: mobile ? 20 + statWidth * 0.73 : VIEW_W * 0.38,
        y: compactLandscape ? 10 : 18, w: mobile ? statWidth * 0.24 : VIEW_W * 0.12,
        h: compactLandscape ? 42 : 51 };
    const bagDisabled = gameState !== STATES.INVENTORY && !canOpenInventory();
    drawCommonButton(bagBox, BTN_STYLE['btn-ghost'], bagDisabled, 9);
    drawSvgIcon(ICONS.backpack, bagBox.x + 10, bagBox.y + (bagBox.h - 22) / 2, 22, UIC.gold);
    if (!mobile) drawText('ИНВЕНТАРЬ', bagBox.x + 40, bagBox.y + bagBox.h / 2,
        '800 9px Manrope, Inter, sans-serif', UIC.text, 'left', 'middle');
    drawText(String(scrollInventory.length), bagBox.x + bagBox.w - 15, bagBox.y + bagBox.h / 2,
        '800 19px Manrope, Inter, sans-serif', UIC.gold, 'center', 'middle');
    canvasHits.push({ ...bagBox, disabled: bagDisabled, ariaLabel: 'Инвентарь: ' + scrollCountText(scrollInventory.length),
        action: gameState === STATES.INVENTORY ? closeInventory : openInventory });
    const gx = mobile ? 20 : VIEW_W * 0.52;
    const gy = mobile ? 94 : compactLandscape ? 16 : 27;
    const gw = mobile ? VIEW_W - 40 : VIEW_W - gx - 110;
    if (!mobile) fillRound(gx - 22, 18, 1, h - 38, 0.5, 'rgba(217,158,58,0.2)');
    drawText('ВАШЕ ЗОЛОТО И ДОЛГ', gx, gy, '800 10px Manrope, Inter, sans-serif', labelColor, 'left', 'middle');
    drawText(String(gold), gx, gy + 27, '800 ' + (mobile ? 29 : compactLandscape ? 27 : 34) + 'px Manrope, Inter, sans-serif', UIC.gold, 'left', 'middle');
    drawText('Долг: ' + tribute + ' зол.', gx + gw, gy + 27,
        '600 ' + (mobile ? 13 : 16) + 'px Inter, sans-serif', UIC.text, 'right', 'middle');
    const barY = mobile ? 141 : compactLandscape ? 53 : 73;
    fillRound(gx, barY, gw, mobile ? 7 : 9, 4, 'rgba(217,158,58,0.17)');
    const progress = clamp(gold / Math.max(1, tribute), 0, 1);
    if (progress > 0) fillRound(gx, barY, Math.max(6, gw * progress), mobile ? 7 : 9, 4,
        progress >= 1 ? '#5fcfa1' : '#e9b653');
}

/* A parchment illustration uses the same glyph as its inventory slot. */
function drawHud() {
    const menuMode = [STATES.INTRO, STATES.GAME_OVER, STATES.VICTORY, STATES.QUARTERMASTER].includes(gameState);
    if (menuMode) {
        const mx = VIEW_W < 900 ? VIEW_W - 24 : VIEW_W - 42;
        drawHudIconButton({ x: mx - 18, y: 12, w: 36, h: 36 },
            settings.muted ? ICONS.soundOff : ICONS.soundOn,
            settings.muted ? 'Включить звук' : 'Выключить звук', toggleMute);
        drawHelpButton(mx - 44, 30);
        return;
    }
    drawMapHud();
}

/* ---------------------------------------------------------------
   Активные дары (чипы)
   --------------------------------------------------------------- */
function drawBoons(y) {
    const chips = boonChips();
    if (!chips.length) return;
    const MAX = 9;
    const shown = chips.slice(0, MAX);
    let x = 30;
    const cy = y + UI.boonsH / 2;
    ctx.save();
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    for (const c of shown) {
        const label = c.icon + ' ' + c.text;
        const w = ctx.measureText(label).width + 20;
        const col = c.cls === 'bad' ? 'rgba(61,29,33,0.7)' : 'rgba(22,35,31,0.68)';
        const border = c.cls === 'bad' ? 'rgba(177,82,91,0.36)' : 'rgba(95,170,135,0.32)';
        fillRound(x, cy - 11, w, 22, 8, col, border);
        ctx.fillStyle = c.cls === 'bad' ? UIC.red : UIC.green;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + 10, cy + 0.5);
        x += w + 8;
    }
    ctx.restore();
}

/* ---------------------------------------------------------------
   Панель Роги
   --------------------------------------------------------------- */
function drawRogiPanel(y) {
    const d = rogiPanelData;
    if (!d) return 0;
    const compact = VIEW_W < 760 || compactLandscape;
    const landscape = compactLandscape;
    const h = landscape ? 102 : compact ? Math.max(d.height || 118, 156) : (d.height || 118);
    fillRound(16, y, VIEW_W - 32, h, 12, 'rgba(13,17,23,0.72)', 'rgba(167,139,250,0.2)');

    /* голова */
    const ax = 44, ay = y + 30;
    fillRound(ax - 18, ay - 18, 36, 36, 11,
        d.quest ? 'rgba(61,45,30,0.76)' : 'rgba(39,32,50,0.68)',
        d.quest ? 'rgba(217,158,58,0.46)' : 'rgba(167,139,250,0.28)');
    drawText(d.quest ? '🔥' : '🗝️', ax, ay + 1, '17px "Segoe UI Emoji", sans-serif', '#fff', 'center', 'middle');

    drawText('РОГИ', ax + 28, ay - 6, '800 13px Manrope, Inter, sans-serif', UIC.violet, 'left', 'middle');
    drawText(d.mood || '', ax + 28, ay + 12, FONT_SMALL, UIC.dim, 'left', 'middle');

    /* реплика */
    if (d.line) {
        const runs = [{ text: d.line, bold: false, color: '#ddd3ff' }];
        const lines = layoutRich(runs, VIEW_W - (compact ? 60 : 130));
        let ty = y + (landscape ? 45 : 62);
        ctx.save();
        ctx.font = 'italic 400 13.5px Inter, system-ui, sans-serif';
        for (const line of lines.slice(0, landscape ? 1 : 2)) {
            let tx = 34;
            for (const seg of line.segs) {
                ctx.fillStyle = '#ddd3ff';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(seg.text, tx, ty);
                tx += ctx.measureText(seg.text).width;
            }
            ty += 19;
        }
        ctx.restore();
    }

    /* полоса доверия — справа от кнопок */
    const pct = clamp(d.trust || 0, -100, 100);
    const tbw = compact ? VIEW_W - 60 : 250;
    const tbx = compact ? 30 : VIEW_W - 34 - tbw;
    const tby = y + h - (compact ? 23 : 44);
    if (landscape) {
        drawText('ДОВЕРИЕ ' + Math.round(pct), VIEW_W - 18, ay, FONT_LABEL,
            'rgba(241,238,232,0.78)', 'right', 'middle');
    } else if (compact) {
        drawText('ДОВЕРИЕ ' + Math.round(pct), VIEW_W - 18, ay, FONT_LABEL,
            'rgba(241,238,232,0.78)', 'right', 'middle');
    } else {
        fillRound(tbx, tby, tbw, 16, 8, UIC.surface, 'rgba(167,139,250,0.2)');
        if (pct !== 0) {
            const g = ctx.createLinearGradient(tbx, 0, tbx + tbw, 0);
            g.addColorStop(0, pct < 0 ? 'rgba(190,76,83,0.65)' : 'rgba(167,139,250,0.5)');
            g.addColorStop(1, pct < 0 ? 'rgba(220,117,123,0.45)' : 'rgba(255,176,92,0.6)');
            const trustW = Math.max(2, tbw * Math.abs(pct) / 200);
            ctx.save();
            roundRect(ctx, tbx + tbw / 2 - (pct < 0 ? trustW : 0), tby, trustW, 16, 3);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.restore();
        }
        ctx.save();
        ctx.fillStyle = 'rgba(241,238,232,0.25)';
        ctx.fillRect(tbx + tbw / 2, tby + 2, 1, 12);
        ctx.restore();
        drawText('ДОВЕРИЕ ' + Math.round(pct), tbx + 9, tby + 8, FONT_LABEL, 'rgba(241,238,232,0.92)', 'left', 'middle');
        if (d.note) drawText(d.note, tbx + tbw - 9, tby + 8, '500 11px Inter, system-ui, sans-serif', 'rgba(255,226,180,0.85)', 'right', 'middle');
    }

    /* кнопки советов */
    let bx = 30;
    const by = y + h - (landscape ? 48 : compact ? 54 : 56);
    for (const q of d.questions) {
        if (bx > (compact ? VIEW_W - 30 : tbx - 20)) break;
        const label = q.title;
        const cost = q.cost;
        ctx.save();
        ctx.font = '800 11.5px Manrope, Inter, sans-serif';
        const w1 = ctx.measureText(label).width;
        ctx.font = '500 12px Inter, system-ui, sans-serif';
        const w2 = ctx.measureText(cost).width;
        ctx.restore();
        const w = Math.min(compact && !landscape ? 150 : Infinity, Math.max(w1, w2) + 28);
        const box = { x: bx, y: by, w, h: 46 };
        const hover = menuHover(box);
        fillRound(bx, by, w, 46, 10,
            hover ? 'rgba(42,34,53,0.82)' : 'rgba(13,17,23,0.7)',
            hover ? 'rgba(197,174,244,0.58)' : 'rgba(167,139,250,0.28)');
        drawText(label, bx + 14, by + 16, '800 11.5px Manrope, Inter, sans-serif', hover ? '#e1d3ff' : UIC.violet, 'left', 'middle');
        drawText(cost, bx + 14, by + 32, '500 12px Inter, system-ui, sans-serif', UIC.gold, 'left', 'middle');
        canvasHits.push({ x: bx, y: by, w: w, h: 46,
            ariaLabel: label + ', ' + cost, action: q.action });
        bx += w + 10;
    }

    return h;
}

/* ---------------------------------------------------------------
   Векторные иконки на холсте
   --------------------------------------------------------------- */
