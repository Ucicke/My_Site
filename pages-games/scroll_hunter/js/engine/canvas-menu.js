/* ================================================================
   SCROLL HUNTER · engine/canvas-menu.js
   Компоновка и отрисовка главного меню.
   ================================================================ */
'use strict';
const menuHeroImage = new Image();
menuHeroImage.src = 'assets/dungeon-gate-menu.png';
const menuHoverTransitions = Object.create(null);

function drawMenuControl(box, ariaLabel, action, drawContent) {
    const hoverAmount = menuHoverAmount('control:' + ariaLabel, menuHover(box));
    const hover = hoverAmount > 0.5;
    const held = pointInside(box, canvasPressPoint);
    const pressScale = canvasButtonPressScale(box);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pressScale, pressScale);
    ctx.translate(-cx, -cy);
    if (hoverAmount > 0.001) {
        ctx.shadowColor = 'rgba(217,158,58,0.16)';
        ctx.shadowBlur = hoverAmount * 7;
    }
    fillRound(box.x, box.y, box.w, box.h, 9,
        held ? 'rgba(72,51,29,0.94)' : UIC.surface,
        held ? 'rgba(236,194,123,0.92)' : UIC.bronze);
    ctx.shadowBlur = 0;
    if (hoverAmount > 0.001 && !held) {
        ctx.save();
        ctx.globalAlpha = hoverAmount;
        fillRound(box.x, box.y, box.w, box.h, 9, UIC.hoverSurface, UIC.bronzeBright);
        ctx.restore();
    }
    drawContent(hover || held);
    ctx.restore();
    canvasHits.push({ x: box.x, y: box.y, w: box.w, h: box.h, ariaLabel, action });
    return hover;
}

/* Геометрия главного меню: сцена и старт — первые по вниманию. */
function mainMenuLayout() {
    const scale = Math.max(canvasScale, 0.1);
    const short = VIEW_H < 620;
    const narrow = VIEW_W < 760;
    const shellPad = narrow ? 8 : 16;
    const innerX = shellPad + 10;
    const innerW = Math.max(1, VIEW_W - innerX * 2);
    const titleY = short ? 44 : narrow ? 96 : 98;
    const titleTwoY = titleY + (short ? 18 : narrow ? 29 : 35);
    const heroY = short ? 72 : narrow ? 151 : 170;
    const primaryH = (short ? 52 : narrow ? 58 : 60) / scale;
    const resourceH = short ? 36 / scale : scale < 0.75 ? 44 / scale : 44;
    const targetButtonW = (narrow ? 330 : 404) / scale;
    const primaryW = Math.min(innerW, targetButtonW);
    const primaryX = Math.round((VIEW_W - primaryW) / 2);
    const targetResourceW = short || narrow || scale < 0.75 ? 216 / scale : 178;
    const resourceW = Math.min(innerW, targetResourceW);
    let primaryY;
    let resourceY;
    let heroH;

    if (short) {
        resourceY = VIEW_H - 13 - resourceH;
        primaryY = resourceY - 10 - primaryH;
        heroH = Math.max(0, primaryY - 10 - heroY);
    } else if (narrow) {
        heroH = Math.min(510, Math.max(292, VIEW_H - heroY - primaryH - resourceH - 90));
        primaryY = heroY + heroH + 14;
        resourceY = primaryY + primaryH + 14;
    } else {
        resourceY = VIEW_H - 28 - resourceH;
        primaryY = resourceY - 16 - primaryH;
        heroH = Math.min(560, Math.max(0, primaryY - 14 - heroY));
    }

    const heroW = Math.min(innerW, narrow ? innerW : 1320);
    const heroX = Math.round((VIEW_W - heroW) / 2);
    const resourceX = narrow
        ? Math.round((VIEW_W - resourceW) / 2)
        : heroX + heroW - resourceW;
    return {
        short, narrow, shellPad, innerX, innerW, titleY, titleTwoY,
        ornamentY: titleTwoY + (short ? 7 : 16),
        hero: { x: heroX, y: heroY, w: heroW, h: heroH },
        primary: { x: primaryX, y: primaryY, w: primaryW, h: primaryH },
        resource: { x: resourceX, y: resourceY, w: resourceW, h: resourceH }
    };
}

function drawImageCover(image, x, y, w, h) {
    if (!image || w <= 0 || h <= 0 || !image.complete || !image.naturalWidth || !image.naturalHeight) return false;
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (image.naturalWidth - sw) / 2;
    const sy = (image.naturalHeight - sh) / 2;
    ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
    return true;
}

function menuHover(box) {
    return canvasMousePosition && canvasMousePosition.x >= box.x && canvasMousePosition.x <= box.x + box.w &&
        canvasMousePosition.y >= box.y && canvasMousePosition.y <= box.y + box.h;
}

function menuHoverAmount(key, hovered) {
    const target = hovered ? 1 : 0;
    if (typeof prefersReducedMotion === 'function' && prefersReducedMotion()) return target;
    const now = performance.now();
    const state = menuHoverTransitions[key] || (menuHoverTransitions[key] = { value: 0, time: now });
    const step = Math.min(1, Math.max(0, now - state.time) / 190);
    state.value += Math.sign(target - state.value) * Math.min(Math.abs(target - state.value), step);
    state.time = now;
    return state.value;
}

function drawMenuAtmosphere(hero, t) {
    if (prefersReducedMotion() || !hero || hero.h < 24) return;
    const torches = [
        { x: 0.285, y: 0.44, phase: 0 },
        { x: 0.715, y: 0.44, phase: 2.1 }
    ];
    torches.forEach(torch => {
        const pulse = 0.032 + Math.sin(t * 0.8 + torch.phase) * 0.006;
        const cx = hero.x + hero.w * torch.x;
        const cy = hero.y + hero.h * torch.y;
        const radius = hero.w * 0.2;
        const light = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
        light.addColorStop(0, 'rgba(255,183,94,' + pulse.toFixed(3) + ')');
        light.addColorStop(0.48, 'rgba(255,157,65,' + (pulse * 0.38).toFixed(3) + ')');
        light.addColorStop(1, 'rgba(255,157,65,0)');
        ctx.fillStyle = light;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    });

    const drift = Math.sin(t * 0.13) * hero.w * 0.012;
    [0.23, 0.78].forEach((x, index) => {
        const cx = hero.x + hero.w * x + drift * (index ? -1 : 1);
        const cy = hero.y + hero.h * (0.81 + Math.sin(t * 0.16 + index) * 0.008);
        const radius = hero.w * 0.22;
        const haze = ctx.createRadialGradient(cx, cy, 1, cx, cy, radius);
        haze.addColorStop(0, 'rgba(188,190,194,0.026)');
        haze.addColorStop(0.42, 'rgba(154,166,178,0.012)');
        haze.addColorStop(1, 'rgba(154,166,178,0)');
        ctx.fillStyle = haze;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    });

    const dust = [
        { x: 0.19, y: 0.78, phase: 0.1, speed: 0.045, r: 0.8 },
        { x: 0.31, y: 0.68, phase: 0.57, speed: 0.032, r: 1.05 },
        { x: 0.53, y: 0.83, phase: 0.32, speed: 0.038, r: 0.75 },
        { x: 0.7, y: 0.73, phase: 0.81, speed: 0.028, r: 0.9 },
        { x: 0.86, y: 0.8, phase: 0.43, speed: 0.035, r: 0.72 }
    ];
    ctx.save();
    dust.forEach(particle => {
        const progress = (t * particle.speed + particle.phase) % 1;
        const x = hero.x + hero.w * particle.x + Math.sin(t * 0.28 + particle.phase * 8) * 4;
        const y = hero.y + hero.h * (particle.y - progress * 0.35);
        ctx.globalAlpha = 0.06 + (0.5 + 0.5 * Math.sin(t * 0.7 + particle.phase * 6)) * 0.035;
        ctx.fillStyle = '#f2c579';
        ctx.beginPath();
        ctx.arc(x, y, particle.r, 0, TAU);
        ctx.fill();
    });
    ctx.restore();
}

function drawMenuControls(l) {
    const scale = Math.max(canvasScale, 0.1);
    const cell = (l.narrow ? 34 : 40) / scale;
    const gap = 4 / scale;
    const pad = (l.narrow ? 3 : 5) / scale;
    const width = cell * 2 + gap + pad * 2;
    const x = VIEW_W - l.innerX - width;
    const y = (l.short || l.narrow ? 5 : 18) / scale;
    const height = cell + pad * 2;
    fillRound(x, y, width, height, 12, 'rgba(5,9,16,0.72)', 'rgba(217,158,58,0.28)');
    ctx.save();
    ctx.strokeStyle = 'rgba(217,158,58,0.22)';
    ctx.beginPath();
    ctx.moveTo(x + pad + cell + gap / 2, y + 10);
    ctx.lineTo(x + pad + cell + gap / 2, y + height - 10);
    ctx.stroke();
    ctx.restore();

    const controls = [
        { icon: settings.muted ? ICONS.soundOff : ICONS.soundOn,
            label: settings.muted ? 'Включить звук' : 'Выключить звук', action: toggleMute },
        { icon: ICONS.EVENT, label: 'Открыть правила игры', action: () => openRules(true) }
    ];
    controls.forEach((control, index) => {
        const box = { x: x + pad + index * (cell + gap), y: y + pad, w: cell, h: cell };
        drawMenuControl(box, control.label, control.action, active => {
            const iconSize = (l.narrow ? 16 : 20) / scale;
            drawSvgIcon(control.icon, box.x + (cell - iconSize) / 2, box.y + (cell - iconSize) / 2, iconSize,
                settings.muted && control.label.indexOf('звук') >= 0 ? 'rgba(220,210,192,0.58)' : active ? '#f1c46f' : '#e7d7b5');
        });
    });
}

function drawMenuDescentIcon(cx, cy, size, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.8, size * 0.085);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.28);
    ctx.lineTo(cx, cy + size * 0.12);
    ctx.moveTo(cx - size * 0.2, cy - size * 0.02);
    ctx.lineTo(cx, cy + size * 0.2);
    ctx.lineTo(cx + size * 0.2, cy - size * 0.02);
    ctx.stroke();
    ctx.restore();
}

function drawMenuResource(resource) {
    if (!resource) return;
    const scale = Math.max(canvasScale, 0.1);
    const gap = 4 / scale;
    const pad = 8 / scale;
    const iconSize = 14 / scale;
    const labelFont = 9 / scale;
    const currencyFont = 9 / scale;
    const action = canvasButtons[1] && canvasButtons[1].action;
    const amount = Number(meta.dust || 0).toLocaleString('ru-RU');
    const amountText = amount + ' пыли';
    ctx.save();
    ctx.font = '700 ' + currencyFont + 'px Manrope, Inter, sans-serif';
    const measuredCurrency = ctx.measureText(amountText).width;
    ctx.restore();

    const minButtonW = 92 / scale;
    const maxCurrencyW = Math.max(60 / scale, resource.w - minButtonW - gap);
    const currencyW = Math.min(maxCurrencyW, Math.max(64 / scale, measuredCurrency + iconSize + pad * 2 + 4 / scale));
    const buttonW = Math.max(1, resource.w - currencyW - gap);
    const buttonBox = { x: resource.x, y: resource.y, w: buttonW, h: resource.h };
    const currencyBox = { x: resource.x + buttonW + gap, y: resource.y, w: currencyW, h: resource.h };

    drawMenuControl(buttonBox, 'Открыть квартирмейстера: постоянные улучшения', action, active => {
        const textX = buttonBox.x + pad + iconSize + 5 / scale;
        const availableTextW = Math.max(1, buttonBox.x + buttonBox.w - pad - textX);
        ctx.save();
        ctx.font = '700 ' + labelFont + 'px Manrope, Inter, sans-serif';
        const measuredLabel = ctx.measureText('Квартирмейстер').width;
        ctx.restore();
        const fittedLabelFont = labelFont * Math.min(1, availableTextW / Math.max(1, measuredLabel));
        drawSvgIcon(ICONS.SHOP, buttonBox.x + pad, buttonBox.y + (buttonBox.h - iconSize) / 2, iconSize,
            active ? '#f1c46f' : '#d8a651');
        drawText('Квартирмейстер', textX + availableTextW / 2, buttonBox.y + buttonBox.h / 2,
            '700 ' + fittedLabelFont + 'px Manrope, Inter, sans-serif', active ? '#f2dfbd' : '#e8d2ab', 'center', 'middle');
    });

    fillRound(currencyBox.x, currencyBox.y, currencyBox.w, currencyBox.h, 9,
        'rgba(13,17,23,0.72)', 'rgba(217,158,58,0.30)');
    const coinX = currencyBox.x + pad * 0.75;
    const textStartX = coinX + iconSize + 4 / scale;
    const textWidth = Math.max(1, currencyBox.x + currencyBox.w - pad * 0.75 - textStartX);
    ctx.save();
    ctx.font = '800 ' + currencyFont + 'px Manrope, Inter, sans-serif';
    const measuredAmount = ctx.measureText(amountText).width;
    ctx.restore();
    const fittedCurrencyFont = currencyFont * Math.min(1, textWidth / Math.max(1, measuredAmount));
    drawSvgIcon(ICONS.coin, coinX, currencyBox.y + (currencyBox.h - iconSize) / 2, iconSize, '#d8a651');
    drawText(amountText, textStartX + textWidth / 2, currencyBox.y + currencyBox.h / 2,
        '800 ' + fittedCurrencyFont + 'px Manrope, Inter, sans-serif', '#f0d7a4', 'center', 'middle');
}

function drawMainMenu(t) {
    const l = mainMenuLayout();
    const shellX = l.shellPad;
    const shellY = l.short ? 6 : 10;
    const shellW = VIEW_W - shellX * 2;
    const shellH = VIEW_H - shellY * 2;

    fillRound(shellX, shellY, shellW, shellH, 22, 'rgba(7,11,19,0.97)', 'rgba(217,158,58,0.28)', 1.2);

    drawMenuControls(l);
    drawMenuResource(l.resource);

    const titleScale = canvasScale < 0.7 ? 1.2 : 1;
    const titleSize = (l.short ? (l.narrow ? 17 : 20) : l.narrow ? 27 : 31) * titleScale;
    drawFittedText('ОХОТНИКИ ЗА СВИТКАМИ', VIEW_W / 2, l.titleY,
        VIEW_W - (l.narrow ? 30 : 110), '800 ' + titleSize + 'px Manrope, Inter, sans-serif', '#f5eee0', 'rgba(217,158,58,0.16)');
    drawFittedText('ПРОТИВ АРЕНДОДАТЕЛЯ', VIEW_W / 2, l.titleTwoY,
        VIEW_W - (l.narrow ? 34 : 120), '800 ' + (l.short ? (l.narrow ? 13 : 16) : l.narrow ? 22 : 24) * titleScale + 'px Manrope, Inter, sans-serif', '#e3a33e');
    ctx.save();
    ctx.strokeStyle = 'rgba(217,158,58,0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 - (l.short ? 17 : 23), l.ornamentY);
    ctx.lineTo(VIEW_W / 2 - 4, l.ornamentY);
    ctx.moveTo(VIEW_W / 2 + 4, l.ornamentY);
    ctx.lineTo(VIEW_W / 2 + (l.short ? 17 : 23), l.ornamentY);
    ctx.stroke();
    ctx.fillStyle = '#c18a3b';
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2, l.ornamentY - 3);
    ctx.lineTo(VIEW_W / 2 + 3, l.ornamentY);
    ctx.lineTo(VIEW_W / 2, l.ornamentY + 3);
    ctx.lineTo(VIEW_W / 2 - 3, l.ornamentY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const hero = l.hero;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 5;
    roundRect(ctx, hero.x, hero.y, hero.w, hero.h, 14);
    ctx.fillStyle = '#080d17';
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, hero.x, hero.y, hero.w, hero.h, 14);
    ctx.clip();
    if (!drawImageCover(menuHeroImage, hero.x, hero.y, hero.w, hero.h)) {
        const fallback = ctx.createLinearGradient(hero.x, hero.y, hero.x + hero.w, hero.y + hero.h);
        fallback.addColorStop(0, '#0a111d');
        fallback.addColorStop(0.5, '#553714');
        fallback.addColorStop(1, '#111927');
        ctx.fillStyle = fallback;
        ctx.fillRect(hero.x, hero.y, hero.w, hero.h);
        drawPortal(t || 0);
    }
    const shade = ctx.createLinearGradient(0, hero.y + hero.h * 0.45, 0, hero.y + hero.h);
    shade.addColorStop(0, 'rgba(5,9,16,0)');
    shade.addColorStop(1, 'rgba(5,9,16,0.46)');
    ctx.fillStyle = shade;
    ctx.fillRect(hero.x, hero.y, hero.w, hero.h);
    drawMenuAtmosphere(hero, t || 0);
    const heroPulse = prefersReducedMotion() ? 0.035 : 0.035 + Math.sin((t || 0) * 1.2) * 0.012;
    const glow = ctx.createRadialGradient(hero.x + hero.w * 0.5, hero.y + hero.h * 0.55, 4,
        hero.x + hero.w * 0.5, hero.y + hero.h * 0.55, hero.w * 0.42);
    glow.addColorStop(0, 'rgba(255,174,63,' + heroPulse.toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(255,174,63,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(hero.x, hero.y, hero.w, hero.h);
    ctx.restore();
    ctx.save();
    roundRect(ctx, hero.x, hero.y, hero.w, hero.h, 14);
    ctx.strokeStyle = 'rgba(233,178,88,0.32)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    if (typeof drawIntroJourney === 'function') drawIntroJourney(t || 0, hero);

    const primary = l.primary;
    const hoverTarget = menuHover(primary);
    const hover = menuHoverAmount('primary-start', hoverTarget);
    const reducedMotion = prefersReducedMotion();
    const held = canvasPressPoint && canvasPressPoint.x >= primary.x && canvasPressPoint.x <= primary.x + primary.w &&
        canvasPressPoint.y >= primary.y && canvasPressPoint.y <= primary.y + primary.h;
    let pressScale = reducedMotion ? 1 : held ? 0.975 : 1;
    if (!reducedMotion && !held && canvasPressReleasePoint && canvasPressReleasePoint.x >= primary.x && canvasPressReleasePoint.x <= primary.x + primary.w &&
        canvasPressReleasePoint.y >= primary.y && canvasPressReleasePoint.y <= primary.y + primary.h) {
        const releaseProgress = clamp((performance.now() - canvasPressReleasedAt) / 150, 0, 1);
        pressScale = 0.975 + releaseProgress * 0.025;
        if (releaseProgress >= 1) canvasPressReleasePoint = null;
    }
    const centerX = primary.x + primary.w / 2;
    const centerY = primary.y + primary.h / 2;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(pressScale, pressScale);
    ctx.translate(-centerX, -centerY);
    ctx.shadowColor = hover > 0 ? 'rgba(217,158,58,0.2)' : 'rgba(0,0,0,0.16)';
    ctx.shadowBlur = 6 + hover * 9;
    const buttonGradient = ctx.createLinearGradient(primary.x, primary.y, primary.x, primary.y + primary.h);
    buttonGradient.addColorStop(0, '#493621');
    buttonGradient.addColorStop(0.55, '#42311f');
    buttonGradient.addColorStop(1, '#39291c');
    fillRound(primary.x, primary.y, primary.w, primary.h, 12,
        buttonGradient, 'rgba(201,151,77,0.84)', 1.25);
    if (hover > 0.001) {
        ctx.save();
        ctx.globalAlpha = hover;
        ctx.shadowColor = 'rgba(217,158,58,0.18)';
        ctx.shadowBlur = 12;
        fillRound(primary.x, primary.y, primary.w, primary.h, 12,
            'rgba(236,194,123,0.08)', 'rgba(236,194,123,0.94)', 1.25);
        ctx.restore();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(pressScale, pressScale);
    ctx.translate(-centerX, -centerY);
    const startFontSize = Math.max(l.short ? 13 : 15, 12 / Math.max(canvasScale, 0.1));
    const startFont = '800 ' + startFontSize + 'px Manrope, Inter, sans-serif';
    const startIconSize = 18 / Math.max(canvasScale, 0.1);
    const startGap = 8 / Math.max(canvasScale, 0.1);
    ctx.save();
    ctx.font = startFont;
    const startLabelWidth = ctx.measureText('НАЧАТЬ СПУСК').width;
    ctx.restore();
    const startGroupWidth = startIconSize + startGap + startLabelWidth;
    const startGroupX = VIEW_W / 2 - startGroupWidth / 2;
    drawMenuDescentIcon(startGroupX + startIconSize / 2, centerY, startIconSize, '#eed7aa');
    drawText('НАЧАТЬ СПУСК', startGroupX + startIconSize + startGap + startLabelWidth / 2, centerY,
        startFont, hover > 0.5 ? '#f5e5c8' : '#f0ddb9', 'center', 'middle');
    ctx.restore();
    canvasHits.push({ x: primary.x, y: primary.y, w: primary.w, h: primary.h,
        ariaLabel: 'Начать спуск', action: canvasButtons[0] && canvasButtons[0].action });
}

function wrapFirstFridayText(text, font, maxWidth) {
    ctx.save();
    ctx.font = font;
    const lines = [];
    let line = '';
    for (const word of String(text).split(/\s+/)) {
        const candidate = line ? line + ' ' + word : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
        } else line = candidate;
    }
    if (line) lines.push(line);
    ctx.restore();
    return lines;
}

function drawFirstFridayParagraph(text, x, y, width, font, color, lineHeight, maxLines = 10) {
    let lines = wrapFirstFridayText(text,font,width);
    if (lines.length > maxLines) {
        lines = lines.slice(0,maxLines);
        lines[maxLines-1] = lines[maxLines-1].replace(/[.,;:]?$/,'') + '…';
    }
    lines.forEach((line,index) => drawText(line,x,y+index*lineHeight,font,color,'left','middle'));
    return y + lines.length * lineHeight;
}

function drawFirstFridayButton(box, label, action, { disabled = false, selected = false, minor = false } = {}) {
    const hover = menuHover(box) && !disabled;
    const held = !disabled && pointInside(box,canvasPressPoint);
    const fill = disabled ? 'rgba(15,18,25,0.82)' : selected || held ? 'rgba(75,54,29,0.96)' : hover ? 'rgba(61,45,30,0.94)' : 'rgba(27,31,40,0.94)';
    const stroke = disabled ? 'rgba(217,158,58,0.18)' : selected || hover ? 'rgba(236,194,123,0.86)' : 'rgba(217,158,58,0.45)';
    fillRound(box.x,box.y,box.w,box.h,10,fill,stroke,1.2);
    const font = (minor ? '600 12px Inter, sans-serif' : '700 14px Manrope, Inter, sans-serif');
    const lines = wrapFirstFridayText(label,font,box.w-24).slice(0,2);
    const lineHeight = minor ? 16 : 19;
    const firstY = box.y + box.h/2 - (lines.length-1)*lineHeight/2;
    lines.forEach((line,index) => drawText(line,box.x+box.w/2,firstY+index*lineHeight,font,
        disabled ? 'rgba(220,210,192,0.42)' : selected || hover ? '#f5d99d' : '#e7d7b5','center','middle'));
    canvasHits.push({ ...box, ariaLabel:label, action, disabled });
}

function drawFirstFridayPrologue() {
    const story = firstFridayProgress.snapshot();
    const page = story.page;
    const narrow = VIEW_W < 600;
    const short = VIEW_H < 620;
    const card = {
        w:Math.min(VIEW_W-24,narrow?560:720),
        h:Math.min(VIEW_H-24,narrow?520:520)
    };
    card.x=(VIEW_W-card.w)/2;
    card.y=(VIEW_H-card.h)/2;
    const pad=narrow?20:34;

    drawImageCover(menuHeroImage,0,0,VIEW_W,VIEW_H);
    ctx.save();
    ctx.fillStyle='rgba(5,9,16,0.72)';
    ctx.fillRect(0,0,VIEW_W,VIEW_H);
    const wash=ctx.createRadialGradient(VIEW_W/2,VIEW_H/2,10,VIEW_W/2,VIEW_H/2,Math.max(VIEW_W,VIEW_H)*0.68);
    wash.addColorStop(0,'rgba(6,10,18,0.10)'); wash.addColorStop(1,'rgba(3,6,11,0.72)');
    ctx.fillStyle=wash; ctx.fillRect(0,0,VIEW_W,VIEW_H);
    const paper=ctx.createLinearGradient(card.x,card.y,card.x+card.w,card.y+card.h);
    paper.addColorStop(0,'rgba(24,31,43,0.98)'); paper.addColorStop(1,'rgba(12,18,29,0.99)');
    ctx.shadowColor='rgba(0,0,0,0.55)'; ctx.shadowBlur=28;
    fillRound(card.x,card.y,card.w,card.h,18,paper,'rgba(217,158,58,0.48)',1.25);
    ctx.restore();

    const contentX=card.x+pad, contentW=card.w-pad*2;
    drawText('ПРОЛОГ · ПЕРВАЯ НЕДЕЛЯ',contentX,card.y+32,'800 10px Manrope, Inter, sans-serif','#e4b760','left','middle');
    drawFirstFridayButton({x:card.x+card.w-(narrow?116:132),y:card.y+14,w:narrow?98:112,h:34},'Пропустить',finishFirstFridayPrologue,{minor:true});
    drawFittedText(page===0?'Две расписки. Шесть пятниц.':page===1?'Что скажет Роги?':'До первой пятницы',
        VIEW_W/2,card.y+78,contentW,'800 '+(narrow?22:27)+'px Manrope, Inter, sans-serif','#f3ead9');
    ctx.save(); ctx.strokeStyle='rgba(217,158,58,0.42)'; ctx.beginPath();
    ctx.moveTo(card.x+pad,card.y+103); ctx.lineTo(card.x+card.w-pad,card.y+103); ctx.stroke(); ctx.restore();

    const bodyFont=(narrow?'15':'17')+'px Inter, system-ui, sans-serif';
    const bodyLine=narrow?21:25;
    const bodyY=card.y+133;
    let footerY=card.y+card.h-(short?54:66);

    if(page===0) {
        const body='После удачного приключения вы с Роги месяц праздновали, а потом проигрались в казино. Утром на столе лежали две расписки — каждая на отдельный долг, обе с вашими подписями.';
        const bodyEnd=drawFirstFridayParagraph(body,contentX,bodyY,contentW,bodyFont,'#e8e1d4',bodyLine,6);
        const receiptY=bodyEnd+14, gap=10, receiptW=(contentW-gap)/2, receiptH=76;
        [
            {x:contentX,label:'ВАША РАСПИСКА',amount:currentTribute()+' зол.'},
            {x:contentX+receiptW+gap,label:'РАСПИСКА РОГИ',amount:companion.debt+' зол.'}
        ].forEach(item=>{
            fillRound(item.x,receiptY,receiptW,receiptH,9,'rgba(10,14,21,0.76)','rgba(217,158,58,0.32)');
            drawText(item.label,item.x+12,receiptY+23,'700 9px Manrope, Inter, sans-serif','#c9ae7e','left','middle');
            drawText(item.amount,item.x+12,receiptY+52,'800 '+(narrow?'17':'19')+'px Manrope, Inter, sans-serif','#f1d59b','left','middle');
        });
        drawFirstFridayParagraph('Арендодатель дал шесть недель. Почему его писарь знал, что вы проиграетесь, — вопрос на потом.',
            contentX,receiptY+receiptH+26,contentW,'italic 14px Georgia, serif','#c7b6a0',20,3);
    } else if(page===1) {
        drawFirstFridayParagraph('Роги смотрит на расписки, потом на тебя. Что ты ей скажешь?',contentX,bodyY,contentW,bodyFont,'#e8e1d4',bodyLine,3);
        const gap=10, buttonH=narrow?56:62;
        const buttonY=bodyY+68;
        const choiceW=narrow?contentW:(contentW-gap)/2;
        const first={x:contentX,y:buttonY,w:choiceW,h:buttonH};
        const second={x:narrow?contentX:contentX+choiceW+gap,y:narrow?buttonY+buttonH+9:buttonY,w:choiceW,h:buttonH};
        drawFirstFridayButton(first,FirstFridayStory.choices['stand-together'].text,()=>chooseFirstFriday('stand-together'),{selected:story.choice==='stand-together'});
        drawFirstFridayButton(second,FirstFridayStory.choices['blame-rogi'].text,()=>chooseFirstFriday('blame-rogi'),{selected:story.choice==='blame-rogi'});
        if(story.choice) {
            const replyY=second.y+buttonH+15;
            const replyLines=wrapFirstFridayText(companion.line,'italic 15px Georgia, serif',contentW-28).slice(0,4);
            const replyH=Math.max(86,52+replyLines.length*21);
            fillRound(contentX,replyY,contentW,replyH,10,'rgba(8,12,19,0.62)','rgba(199,182,160,0.2)');
            drawText('РОГИ',contentX+14,replyY+20,'800 9px Manrope, Inter, sans-serif','#d8b66f','left','middle');
            drawFirstFridayParagraph(companion.line,contentX+14,replyY+46,contentW-28,'italic 15px Georgia, serif','#eee3ce',21,4);
        }
    } else {
        const body='У вас неделя, чтобы вынести ценности и закрыть первый платёж. У Роги отдельный долг и собственная расписка. Помочь ей можно только своими деньгами — и это может поставить под угрозу вашу выплату.';
        const bodyEnd=drawFirstFridayParagraph(body,contentX,bodyY,contentW,bodyFont,'#e8e1d4',bodyLine,7);
        const calloutY=bodyEnd+14;
        fillRound(contentX,calloutY,contentW,92,10,'rgba(55,40,25,0.42)','rgba(217,158,58,0.34)');
        drawText('ВАША ЦЕЛЬ',contentX+14,calloutY+22,'800 10px Manrope, Inter, sans-serif','#e4b760','left','middle');
        drawFirstFridayParagraph('Пережить забег. В первую пятницу решить, какой долг платить первым.',
            contentX+14,calloutY+52,contentW-28,'600 15px Inter, sans-serif','#f0e4ce',21,3);
        drawText('Карта и комнаты останутся случайными. Вы сами выберете, где рисковать.',
            VIEW_W/2,calloutY+124,'italic 13px Georgia, serif','#bdb4a5','center','middle');
    }

    const nextLabel=page===0?'Дальше':page===2?'В подземелье':story.choice?'Продолжить':'Сначала ответь Роги';
    const nextDisabled=page===1&&!story.choice;
    const nextBox={x:VIEW_W/2-(narrow?card.w-40:300)/2,y:footerY,w:narrow?card.w-40:300,h:46};
    drawFirstFridayButton(nextBox,nextLabel,advanceFirstFridayPrologue,{disabled:nextDisabled});
    primaryAction=nextDisabled?null:advanceFirstFridayPrologue;
}

