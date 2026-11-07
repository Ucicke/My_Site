/* ================================================================
   SCROLL HUNTER · engine/canvas-quartermaster.js
   Экран лавки и её карточки интерфейса.
   ================================================================ */
'use strict';

function quartermasterTextLines(text, font, maxWidth, maxLines) {
    ctx.save();
    ctx.font = font;
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(word => {
        const next = line ? line + ' ' + word : word;
        if (line && ctx.measureText(next).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
        lines.length = maxLines;
        let last = lines[maxLines - 1];
        while (last.length > 3 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
        lines[maxLines - 1] = last.replace(/[\s.,;:]+$/, '') + '…';
    }
    ctx.restore();
    return lines;
}

function drawQuartermasterPortrait(box, mode, t) {
    if (!box || box.w < 1 || box.h < 1) return;
    const compactPortrait = mode === 'bust';
    const compositeReady = !compactPortrait && quartermasterShopComposite.complete &&
        quartermasterShopComposite.naturalWidth && quartermasterShopComposite.naturalHeight;
    const panelFill = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    panelFill.addColorStop(0, 'rgba(31,31,32,0.92)');
    panelFill.addColorStop(0.58, 'rgba(17,21,27,0.96)');
    panelFill.addColorStop(1, 'rgba(10,15,22,0.98)');
    fillRound(box.x, box.y, box.w, box.h, compactPortrait ? 11 : 15,
        panelFill, 'rgba(217,158,58,0.22)', 1);

    ctx.save();
    roundRect(ctx, box.x + 1, box.y + 1, box.w - 2, box.h - 2, compactPortrait ? 10 : 14);
    ctx.clip();
    let shopCrop = null;
    if (quartermasterShopBackdrop.complete && quartermasterShopBackdrop.naturalWidth && quartermasterShopBackdrop.naturalHeight) {
        const imageW = quartermasterShopBackdrop.naturalWidth;
        const imageH = quartermasterShopBackdrop.naturalHeight;
        const targetAspect = box.w / box.h;
        const imageAspect = imageW / imageH;
        let sourceX = 0, sourceY = 0, sourceW = imageW, sourceH = imageH;
        if (imageAspect > targetAspect) {
            sourceW = imageH * targetAspect;
            const cropBias = compositeReady && box.h > box.w ? 0.62 : box.h > box.w ? 0.76 : 0.5;
            sourceX = Math.max(0, imageW - sourceW) * cropBias;
        } else if (imageAspect < targetAspect) {
            sourceH = imageW / targetAspect;
            sourceY = Math.max(0, imageH - sourceH) * 0.68;
        }
        const counterSourceY = imageH * (1122 / 1536);
        const counterCutY = !compactPortrait && counterSourceY > sourceY && counterSourceY < sourceY + sourceH
            ? box.y + (counterSourceY - sourceY) / sourceH * box.h
            : null;
        shopCrop = { imageW, imageH, sourceX, sourceY, sourceW, sourceH, counterSourceY, counterCutY };
        if (compositeReady) {
            ctx.drawImage(quartermasterShopComposite, sourceX, sourceY, sourceW, sourceH,
                box.x, box.y, box.w, box.h);
        } else {
            ctx.globalAlpha = 0.86;
            ctx.drawImage(quartermasterShopBackdrop, sourceX, sourceY, sourceW, sourceH,
                box.x, box.y, box.w, box.h);
            ctx.globalAlpha = 1;
            ctx.fillStyle = compactPortrait ? 'rgba(7,10,15,0.22)' : 'rgba(7,10,15,0.30)';
            ctx.fillRect(box.x, box.y, box.w, box.h);
        }
    }
    if (!compositeReady) {
        const pulse = prefersReducedMotion() ? 0.13 : 0.13 + Math.sin((t || 0) * 0.72) * 0.018;
        const glowX = box.x + box.w * 0.55;
        const glowY = box.y + box.h * (compactPortrait ? 0.34 : 0.4);
        const glowR = Math.max(box.w, box.h) * 0.5;
        const glow = ctx.createRadialGradient(glowX, glowY, 3, glowX, glowY, glowR);
        glow.addColorStop(0, 'rgba(213,143,61,' + pulse.toFixed(3) + ')');
        glow.addColorStop(1, 'rgba(213,143,61,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(box.x, box.y, box.w, box.h);
    }

    if (!compositeReady && quartermasterPortrait.complete && quartermasterPortrait.naturalWidth && quartermasterPortrait.naturalHeight) {
        const sourceW = quartermasterPortrait.naturalWidth;
        const sourceH = quartermasterPortrait.naturalHeight * (compactPortrait ? 0.64 : 1);
        const maxW = compactPortrait ? box.w * (box.w < 170 ? 0.9 : 0.27) : box.w * 1.04;
        const maxH = compactPortrait ? box.h * 0.94 : box.h - 12;
        const fit = Math.min(maxW / sourceW, maxH / sourceH);
        const drawW = sourceW * fit;
        const drawH = sourceH * fit;
        const drawX = box.x + (compactPortrait && box.w >= 170 ? box.w * 0.06 : (box.w - drawW) / 2);
        const drawY = compactPortrait
            ? box.y + (box.w >= 170 ? box.h - drawH + 3 : (box.h - drawH) / 2)
            : (shopCrop && shopCrop.counterCutY !== null
                ? shopCrop.counterCutY - drawH * 0.46
                : box.y + (box.h - drawH) / 2 + 5);
        ctx.globalAlpha = 0.98;
        ctx.drawImage(quartermasterPortrait, 0, 0, sourceW, sourceH, drawX, drawY, drawW, drawH);
    }
    if (!compositeReady && !compactPortrait && shopCrop && shopCrop.counterCutY !== null) {
        /* Draw the counter face over the merchant so he reads as standing behind the stall. */
        const cutY = shopCrop.counterCutY;
        ctx.save();
        ctx.globalAlpha = 0.86;
        ctx.drawImage(quartermasterShopBackdrop, shopCrop.sourceX, shopCrop.counterSourceY, shopCrop.sourceW,
            shopCrop.sourceY + shopCrop.sourceH - shopCrop.counterSourceY, box.x, cutY, box.w, box.y + box.h - cutY);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(7,10,15,0.30)';
        ctx.fillRect(box.x, cutY, box.w, box.y + box.h - cutY);
        const shade = ctx.createRadialGradient(box.x + box.w * 0.5, cutY + 3, 1,
            box.x + box.w * 0.5, cutY + 3, box.w * 0.46);
        shade.addColorStop(0, 'rgba(5,7,10,0.22)');
        shade.addColorStop(1, 'rgba(5,7,10,0)');
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.ellipse(box.x + box.w * 0.5, cutY + 3, box.w * 0.45, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawQuartermasterReaction({ x: box.x + 6, y: cutY + 8, w: box.w - 12, h: Math.min(54, box.y + box.h - cutY - 14) }, false);
    }
    if (compositeReady && shopCrop && shopCrop.counterCutY !== null) {
        const cutY = shopCrop.counterCutY;
        drawQuartermasterReaction({ x: box.x + 6, y: cutY + 8, w: box.w - 12, h: Math.min(54, box.y + box.h - cutY - 14) }, false);
    }
    if (compactPortrait && box.w >= 100) drawQuartermasterReaction(box, true);
    ctx.restore();
    ctx.save();
    roundRect(ctx, box.x, box.y, box.w, box.h, compactPortrait ? 11 : 15);
    ctx.strokeStyle = 'rgba(217,158,58,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

function drawQuartermasterUpgradeCard(btn, box, scale, t) {
    const ready = !!btn.can;
    const maxed = !!btn.maxed;
    const hovered = !!menuHover(box);
    const hover = menuHoverAmount('quartermaster-' + btn.id, hovered);
    const pressed = ready ? canvasButtonPressScale(box) : 1;
    const centerX = box.x + box.w / 2;
    const centerY = box.y + box.h / 2;
    const cardFill = ready ? 'rgba(33,28,22,0.96)' : maxed ? 'rgba(16,25,24,0.96)' : 'rgba(13,18,26,0.96)';
    const cardLine = ready ? 'rgba(216,165,87,0.55)' : maxed ? 'rgba(110,170,137,0.38)' : 'rgba(170,157,133,0.26)';
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(pressed, pressed);
    ctx.translate(-centerX, -centerY);
    if (hover > 0.01 || (quartermasterLastPurchase.id === btn.id && performance.now() - quartermasterLastPurchase.at < 1100)) {
        ctx.shadowColor = ready ? 'rgba(226,173,87,0.34)' : 'rgba(203,173,115,0.18)';
        ctx.shadowBlur = (7 + hover * 10) * scale;
        ctx.shadowOffsetY = 2 * scale;
    }
    fillRound(box.x, box.y, box.w, box.h, 13 * scale,
        hovered ? (ready ? 'rgba(45,36,25,0.98)' : 'rgba(24,28,33,0.98)') : cardFill,
        hovered ? 'rgba(235,197,125,0.78)' : cardLine, 1.15 * scale);
    if (hover > 0.01) {
        ctx.save();
        ctx.globalAlpha = hover * 0.18;
        fillRound(box.x + 1, box.y + 1, box.w - 2, box.h - 2, 12 * scale,
            'rgba(232,190,116,0.18)', null);
        ctx.restore();
    }
    ctx.restore();

    const pad = 14 * scale;
    const iconSize = 40 * scale;
    const iconX = box.x + pad;
    const iconY = box.y + 12 * scale;
    fillRound(iconX, iconY, iconSize, iconSize, 10 * scale,
        maxed ? 'rgba(38,53,45,0.88)' : 'rgba(27,31,37,0.9)',
        maxed ? 'rgba(130,188,150,0.42)' : 'rgba(217,158,58,0.24)', 1);
    const icon = quartermasterUpgradeIcons[btn.id];
    if (icon && icon.complete && icon.naturalWidth) {
        ctx.drawImage(icon, iconX + 3 * scale, iconY + 3 * scale, iconSize - 6 * scale, iconSize - 6 * scale);
    }

    const contentX = iconX + iconSize + 10 * scale;
    const contentW = Math.max(48 * scale, box.x + box.w - pad - contentX);
    const titleSize = (box.w < 340 * scale ? 15 : 17) * scale;
    ctx.save();
    ctx.font = '800 ' + titleSize + 'px Manrope, Inter, sans-serif';
    ctx.fillStyle = maxed ? '#f0f1e9' : '#f3eee4';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.name, contentX, box.y + 22 * scale, contentW);
    ctx.restore();

    ctx.save();
    ctx.font = '700 ' + (16 * scale) + 'px Inter, system-ui, sans-serif';
    ctx.fillStyle = ready ? '#e9c77f' : maxed ? '#c1dfc8' : '#e5dac7';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.desc, contentX, box.y + 51 * scale, contentW);
    ctx.restore();

    const detailFont = '500 ' + (13.5 * scale) + 'px Inter, system-ui, sans-serif';
    const detailX = box.x + pad;
    const detailW = box.w - pad * 2;
    const detailLines = quartermasterTextLines(btn.detail, detailFont, detailW, 3);
    ctx.save();
    ctx.font = detailFont;
    ctx.fillStyle = maxed ? 'rgba(220,226,215,0.86)' : 'rgba(228,218,200,0.84)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    detailLines.forEach((line, index) => ctx.fillText(line, detailX, box.y + (73 + index * 16) * scale, detailW));
    ctx.restore();

    const progressY = box.y + 119 * scale;
    drawText('УР. ' + btn.level + '/' + btn.max, box.x + box.w - pad, progressY,
        '700 ' + (12 * scale) + 'px Manrope, Inter, sans-serif', maxed ? '#c1dfc8' : 'rgba(230,220,203,0.88)', 'right', 'middle');

    const barX = box.x + pad;
    const barY = box.y + 128 * scale;
    const barW = box.w - pad * 2;
    const barH = 5 * scale;
    fillRound(barX, barY, barW, barH, 2 * scale, 'rgba(255,255,255,0.075)');
    const progress = btn.max > 0 ? clamp(btn.level / btn.max, 0, 1) : 0;
    if (progress > 0) fillRound(barX, barY, Math.max(barH, barW * progress), barH, 2 * scale,
        maxed ? 'rgba(122,194,146,0.86)' : 'rgba(225,177,91,0.86)');

    const footerY = box.y + box.h - 37 * scale;
    const footerH = 31 * scale;
    const footerX = box.x + pad;
    const footerW = box.w - pad * 2;
    if (maxed) {
        drawText('МАКС. УРОВЕНЬ', footerX + footerW / 2, footerY + footerH / 2,
            '800 ' + (13 * scale) + 'px Manrope, Inter, sans-serif', '#c1dfc8', 'center', 'middle');
    } else {
        const missingDust = Math.max(0, btn.cost - meta.dust);
        const buttonW = Math.min((ready ? 142 : 196) * scale, footerW * (ready ? 0.4 : 0.52));
        fillRound(footerX, footerY, footerW, footerH, 8 * scale,
            ready ? 'rgba(73,53,29,0.72)' : 'rgba(20,23,28,0.92)',
            ready ? 'rgba(225,177,91,0.62)' : 'rgba(183,164,131,0.30)', 1.1 * scale);
        drawText(btn.cost.toLocaleString('ru-RU') + ' ПЫЛИ', footerX + 10 * scale, footerY + footerH / 2,
            '800 ' + (13 * scale) + 'px Manrope, Inter, sans-serif',
            ready ? '#f0d18f' : 'rgba(228,218,200,0.9)', 'left', 'middle');
        const recentPurchase = quartermasterLastPurchase.id === btn.id && performance.now() - quartermasterLastPurchase.at < 1100;
        const buttonLabel = recentPurchase ? 'КУПЛЕНО' : ready ? 'УЛУЧШИТЬ' : 'НЕ ХВАТАЕТ ' + missingDust + ' ПЫЛИ';
        const buttonFill = ready ? 'rgba(217,158,58,0.25)' : 'rgba(100,102,104,0.16)';
        fillRound(footerX + footerW - buttonW, footerY + 2 * scale, buttonW, footerH - 4 * scale,
            7 * scale, buttonFill, ready ? 'rgba(246,204,125,0.52)' : 'rgba(220,210,192,0.16)', 1);
        drawText(buttonLabel, footerX + footerW - buttonW / 2, footerY + footerH / 2,
            '800 ' + (11 * scale) + 'px Manrope, Inter, sans-serif',
            recentPurchase ? '#c3e5c8' : ready ? '#ffe3ad' : 'rgba(230,220,203,0.6)', 'center', 'middle');
    }
}

function exitSummaryHeight() { return VIEW_W < 700 ? 148 : 96; }

function drawExitSummary(y, h) {
    const narrow = VIEW_W < 700;
    const margin = 12, gap = 8, w = VIEW_W - margin * 2;
    const sale = exitScrollValue(), available = gold + sale, tribute = currentTribute();
    const shortfall = Math.max(0, companion.debt - companion.gold);
    const help = Math.min(gold, shortfall);
    const afterHelp = available - help;
    const threatens = companion.active && help > 0 && afterHelp < tribute;
    fillRound(margin, y, w, h, 11, 'rgba(29,23,17,0.92)', 'rgba(217,158,58,0.46)');
    drawText('РАСЧЁТ · НЕДЕЛЯ ' + week, margin + 13, y + 15,
        '800 10px Manrope, Inter, sans-serif', UIC.gold, 'left', 'middle');
    if (narrow) {
        const cardH = 52, cardW = w - 18, cardX = margin + 9;
        const playerY = y + 25, rogiY = playerY + cardH + 5;
        fillRound(cardX, playerY, cardW, cardH, 8, 'rgba(9,13,19,0.62)', 'rgba(217,158,58,0.2)');
        fillRound(cardX, rogiY, cardW, cardH, 8, 'rgba(17,13,22,0.68)', 'rgba(178,145,201,0.25)');
        drawText('ВАШ ДОЛГ', cardX + 10, playerY + 13, '800 9px Manrope, sans-serif', '#e5d2ae', 'left', 'middle');
        drawText(gold + ' зол. · цель ' + tribute, cardX + 10, playerY + 29, '600 11px Inter, sans-serif', UIC.text, 'left', 'middle');
        drawText('Свитки +' + sale + ' · после продажи ' + (available >= tribute ? 'останется ' + (available - tribute) : 'нехватка ' + (tribute - available)),
            cardX + 10, playerY + 43, '500 9px Inter, sans-serif', UIC.dim, 'left', 'middle');
        if (companion.active) {
            drawText('ДОЛГ РОГИ', cardX + 10, rogiY + 13, '800 9px Manrope, sans-serif', '#d9c1e4', 'left', 'middle');
            drawText(companion.gold + ' / ' + companion.debt + ' зол. · не хватает ' + shortfall,
                cardX + 10, rogiY + 29, '600 10px Inter, sans-serif', UIC.text, 'left', 'middle');
            drawText(threatens ? 'Помощь может сорвать вашу выплату' : 'Можно передать до ' + help + ' зол.',
                cardX + 10, rogiY + 43, '600 9px Inter, sans-serif', threatens ? UIC.red : UIC.dim, 'left', 'middle');
        }
        return;
    }
    const cardY = y + 24, cardH = h - 32, cardW = (w - 18 - gap) / 2;
    const playerX = margin + 9, rogiX = playerX + cardW + gap;
    fillRound(playerX, cardY, cardW, cardH, 8, 'rgba(9,13,19,0.62)', 'rgba(217,158,58,0.2)');
    fillRound(rogiX, cardY, cardW, cardH, 8, 'rgba(17,13,22,0.68)', 'rgba(178,145,201,0.25)');
    drawText('ВАШ ДОЛГ', playerX + 11, cardY + 15, '800 9px Manrope, sans-serif', '#e5d2ae', 'left', 'middle');
    drawText(gold + ' зол. · требуется ' + tribute + ' · свитки +' + sale + ' (50%)',
        playerX + 11, cardY + 33, '600 11px Inter, sans-serif', UIC.text, 'left', 'middle');
    drawText(available >= tribute ? 'После продажи останется ' + (available - tribute) + ' зол.' : 'После продажи не хватит ' + (tribute - available) + ' зол.',
        playerX + 11, cardY + 51, '500 10px Inter, sans-serif', available >= tribute ? UIC.dim : UIC.red, 'left', 'middle');
    if (companion.active) {
        drawText('ДОЛГ РОГИ', rogiX + 11, cardY + 15, '800 9px Manrope, sans-serif', '#d9c1e4', 'left', 'middle');
        drawText(companion.gold + ' / ' + companion.debt + ' зол. · не хватает ' + shortfall,
            rogiX + 11, cardY + 33, '600 11px Inter, sans-serif', UIC.text, 'left', 'middle');
        drawText(threatens ? 'Передача до ' + help + ' зол. может сорвать вашу выплату' : 'Можно добровольно передать до ' + help + ' зол.',
            rogiX + 11, cardY + 51, '500 10px Inter, sans-serif', threatens ? UIC.red : UIC.dim, 'left', 'middle');
    }
}

function drawQuartermasterScreen(t) {
    const upgrades = canvasButtons.filter(btn => btn.upgrade);
    const backButton = canvasButtons.find(btn => !btn.upgrade);
    const narrow = VIEW_W < 560;
    const columns = narrow ? 1 : 2;
    const sidebar = VIEW_W >= 840 && !compactLandscape;
    const portraitBanner = !sidebar && !compactLandscape;
    const scale = clamp(1 / Math.max(canvasScale, 0.1), 0.85, 1.5);
    const margin = (compactLandscape ? 8 : narrow ? 8 : 24) * scale;
    const panelW = Math.max(1, Math.min(VIEW_W - margin * 2, 1320 * scale));
    const innerPad = (narrow ? 12 : compactLandscape ? 16 : 22) * scale;
    const gap = (narrow ? 8 : compactLandscape ? 8 : 11) * scale;
    const cardGap = (compactLandscape ? 8 : narrow ? 9 : 10) * scale;
    const cardH = (compactLandscape ? 162 : 172) * scale;
    const headerH = (compactLandscape ? 98 : narrow ? 108 : 104) * scale;
    const bannerH = portraitBanner ? (narrow ? 80 : 86) * scale : 0;
    const backH = (compactLandscape ? 40 : narrow ? 44 : 48) * scale;
    const portraitGap = portraitBanner ? 8 * scale : 0;
    const sidebarW = sidebar ? Math.min(440 * scale, Math.max(320 * scale, panelW * 0.38)) : 0;
    const bodyGap = sidebar ? 15 * scale : 0;
    const gridW = panelW - innerPad * 2 - sidebarW - bodyGap;
    const cardW = (gridW - cardGap * (columns - 1)) / columns;
    const rows = Math.ceil(upgrades.length / columns);
    const naturalGridH = rows ? rows * cardH + (rows - 1) * cardGap : 0;
    const fixedH = headerH + gap + bannerH + portraitGap + backH + 18 * scale;
    const gridAvailableH = Math.max(1, VIEW_H - margin * 2 - fixedH);
    const scrollEndPadding = naturalGridH > gridAvailableH ? 18 * scale : 0;
    const gridContentH = naturalGridH + scrollEndPadding;
    const gridViewportH = Math.min(gridContentH, gridAvailableH);
    const panelH = fixedH + gridViewportH;
    const top = Math.max(margin, Math.round((VIEW_H - panelH) / 2));
    const left = Math.round((VIEW_W - panelW) / 2);
    const goldReady = upgrades.some(btn => btn.can);
    quartermasterScrollMax = Math.max(0, gridContentH - gridViewportH);
    quartermasterScrollY = clamp(quartermasterScrollY, 0, quartermasterScrollMax);

    const panelGradient = ctx.createLinearGradient(left, top, left, top + panelH);
    panelGradient.addColorStop(0, 'rgba(8,12,20,0.97)');
    panelGradient.addColorStop(1, 'rgba(6,10,17,0.98)');
    fillRound(left, top, panelW, panelH, 18 * scale, panelGradient, 'rgba(217,158,58,0.34)', 1.2 * scale);
    const headerGradient = ctx.createLinearGradient(left, top, left + panelW, top + headerH);
    headerGradient.addColorStop(0, 'rgba(55,40,25,0.38)');
    headerGradient.addColorStop(0.5, 'rgba(27,27,29,0.2)');
    headerGradient.addColorStop(1, 'rgba(12,18,26,0.24)');
    fillRound(left + 1, top + 1, panelW - 2, headerH, 16 * scale,
        headerGradient, 'rgba(217,158,58,0.12)', 1);

    let titleX = left + innerPad;
    if (compactLandscape) {
        const avatar = { x: left + innerPad, y: top + 5 * scale, w: 57 * scale, h: 86 * scale };
        drawQuartermasterPortrait(avatar, 'bust', t || 0);
        titleX = avatar.x + avatar.w + 10 * scale;
    }
    drawText('КВАРТИРМЕЙСТЕР', titleX, top + (compactLandscape ? 24 : 28) * scale,
        '800 ' + (compactLandscape ? 17 : narrow ? 18 : 26) * scale + 'px Manrope, Inter, sans-serif',
        '#f5eee0', 'left', 'middle');
    drawText('Постоянные улучшения между забегами', titleX, top + (compactLandscape ? 50 : 54) * scale,
        '500 ' + (12 * scale) + 'px Inter, system-ui, sans-serif', 'rgba(220,210,192,0.76)', 'left', 'middle');

    const badgeW = (narrow ? 128 : compactLandscape ? 148 : 176) * scale;
    const badgeH = (compactLandscape ? 32 : 40) * scale;
    const badgeX = left + panelW - innerPad - badgeW;
    const badgeY = top + (compactLandscape ? 61 : narrow ? 59 : 54) * scale;
    const purchaseAge = (performance.now() - quartermasterLastPurchase.at) / 1000;
    const pulse = quartermasterLastPurchase.id && purchaseAge >= 0 && purchaseAge < 0.65 && !prefersReducedMotion()
        ? Math.sin((1 - purchaseAge / 0.65) * Math.PI) : 0;
    ctx.save();
    const badgeCenterX = badgeX + badgeW / 2;
    const badgeCenterY = badgeY + badgeH / 2;
    ctx.translate(badgeCenterX, badgeCenterY);
    ctx.scale(1 + pulse * 0.035, 1 + pulse * 0.035);
    ctx.translate(-badgeCenterX, -badgeCenterY);
    fillRound(badgeX, badgeY, badgeW, badgeH, 10 * scale,
        goldReady ? 'rgba(61,45,30,0.76)' : 'rgba(16,20,27,0.82)',
        pulse > 0 ? 'rgba(246,211,135,0.82)' : goldReady ? 'rgba(217,158,58,0.56)' : 'rgba(217,158,58,0.28)', 1.1 * scale);
    const coinSize = 18 * scale;
    drawSvgIcon(ICONS.coin, badgeX + 11 * scale, badgeCenterY - coinSize / 2,
        coinSize, goldReady ? '#edc477' : '#c6a66b');
    let displayedDust = meta.dust;
    if (quartermasterDustTransition) {
        const amount = clamp((performance.now() - quartermasterDustTransition.at) / 420, 0, 1);
        displayedDust = Math.round(quartermasterDustTransition.from +
            (quartermasterDustTransition.to - quartermasterDustTransition.from) * easeOutCubic(amount));
        if (amount >= 1) quartermasterDustTransition = null;
    }
    drawText(displayedDust.toLocaleString('ru-RU') + ' ПЫЛИ', badgeX + coinSize + 22 * scale, badgeCenterY,
        '800 ' + (narrow ? 11.5 : 13.5) * scale + 'px Manrope, Inter, sans-serif',
        goldReady ? '#f0d7a4' : 'rgba(220,210,192,0.86)', 'left', 'middle');
    ctx.restore();

    const statsText = 'Добыча ' + record.best + ' зол.   │   Побед ' + record.wins + '   │   Глубина: неделя ' + record.deepest;
    const compactStats = 'Добыча ' + record.best + ' зол.  │  Побед ' + record.wins + '  │  Неделя ' + record.deepest;
    if (narrow) {
        const statsW = Math.max(40, badgeX - titleX - 12 * scale);
        ctx.save();
        ctx.font = '650 ' + (11.5 * scale) + 'px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(232,221,201,0.82)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Добыча ' + record.best + ' зол. · Побед ' + record.wins,
            titleX, top + 82 * scale, statsW);
        ctx.fillText('Глубина: неделя ' + record.deepest,
            titleX, top + 98 * scale, statsW);
        ctx.restore();
    } else {
        const statsY = top + (compactLandscape ? 80 : 83) * scale;
        ctx.save();
        ctx.font = '650 ' + ((compactLandscape ? 11.5 : 13) * scale) + 'px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(232,221,201,0.82)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(compactLandscape ? compactStats : statsText, titleX, statsY,
            Math.max(40, badgeX - titleX - 12 * scale));
        ctx.restore();
    }

    const bannerY = top + headerH + gap;
    if (portraitBanner) {
        const banner = { x: left + innerPad, y: bannerY, w: panelW - innerPad * 2, h: bannerH };
        drawQuartermasterPortrait(banner, 'bust', t || 0);
    }

    const gridY = bannerY + bannerH + portraitGap;
    const gridX = left + innerPad + (sidebar ? sidebarW + bodyGap : 0);
    quartermasterScrollArea = { x: gridX, y: gridY, w: gridW, h: gridViewportH };
    if (sidebar) {
        drawQuartermasterPortrait({ x: left + innerPad, y: gridY, w: sidebarW, h: gridViewportH }, 'full', t || 0);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(gridX, gridY, gridW, gridViewportH);
    ctx.clip();
    upgrades.forEach((btn, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = gridX + col * (cardW + cardGap);
        const y = gridY + row * (cardH + cardGap) - quartermasterScrollY;
        const box = { x, y, w: cardW, h: cardH };
        drawQuartermasterUpgradeCard(btn, box, scale, t || 0);

        const hitTop = Math.max(gridY, y);
        const hitBottom = Math.min(gridY + gridViewportH, y + cardH);
        if (hitBottom > hitTop) {
            const state = btn.maxed ? 'максимальный уровень' : btn.can ? 'доступно для покупки' : 'не хватает ' + Math.max(0, btn.cost - meta.dust) + ' пыли';
            const price = btn.maxed ? 'покупка не требуется' : 'стоимость ' + btn.cost + ' пыли';
            canvasHits.push({
                x: x, y: hitTop, w: cardW, h: hitBottom - hitTop,
                ariaLabel: btn.name + '. ' + btn.desc + '. ' + btn.detail + '. ' + price + '; уровень ' + btn.level + ' из ' + btn.max + '. ' + state,
                action: btn.action, disabled: !!btn.disabled
            });
        }
    });
    ctx.restore();

    if (quartermasterScrollMax > 0) {
        const barH = Math.max(26 * scale, gridViewportH * (gridViewportH / gridContentH));
        const barX = left + panelW - 6 * scale;
        const barY = gridY + (gridViewportH - barH) * (quartermasterScrollY / quartermasterScrollMax);
        fillRound(barX, gridY, 3 * scale, gridViewportH, 1.5 * scale, 'rgba(217,158,58,0.12)');
        fillRound(barX, barY, 3 * scale, barH, 1.5 * scale, 'rgba(217,158,58,0.58)');
    }

    const backY = gridY + gridViewportH + gap;
    if (backButton) {
        const backW = Math.min(236 * scale, panelW - 36 * scale);
        const backX = Math.round(left + (panelW - backW) / 2);
        const backBox = { x: backX, y: backY, w: backW, h: backH };
        const backStyle = Object.assign({}, BTN_STYLE['btn-ghost'], {
            bg: 'rgba(13,17,23,0.92)',
            hoverBg: 'rgba(42,33,24,0.94)',
            border: 'rgba(217,158,58,0.52)',
            hoverBorder: 'rgba(240,197,116,0.86)',
            shadow: 'rgba(217,158,58,0.10)'
        });
        const backHover = drawCommonButton(backBox, backStyle, !!backButton.disabled, 11 * scale);
        drawText(backButton.text, backX + backW / 2, backY + backH / 2,
            '800 ' + (13 * scale) + 'px Manrope, Inter, sans-serif', backHover ? '#f4d9a7' : '#e7ddcd', 'center', 'middle');
        canvasHits.push({
            x: backX, y: backY, w: backW, h: backH,
            ariaLabel: 'Вернуться в главное меню', action: backButton.action, disabled: !!backButton.disabled
        });
    }

    if (compactLandscape && quartermasterReactionActive()) {
        const reactionW = Math.max(80, badgeX - titleX - 12 * scale);
        drawQuartermasterReaction({ x: titleX, y: top + 62 * scale, w: reactionW, h: 29 * scale }, true);
    }
}

/* ---------------------------------------------------------------
   Шапка
   --------------------------------------------------------------- */
