/* ================================================================
   SCROLL HUNTER · engine/canvas-ui.js
   Весь интерфейс рисуется на холсте: шапка, чипы, сообщения,
   кнопки, панель Роги и карта подземелья.
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   Раскладка холста
   --------------------------------------------------------------- */
const UI = {
    hudH: 100,          /* шапка */
    boonsH: 30,         /* полоса активных даров */
    sceneY: 130,        /* верх сцены */
    sceneH: 400,        /* высота сцены (как раньше) */
    mapH: 492,          /* высота карты (со скроллом) */
    bottom: 880         /* низ холста */
};
UI.stageY = UI.sceneY + UI.sceneH;      /* где начинаются панели */
UI.mapAreaY = UI.sceneY;                /* карта рисуется в сцене */
UI.mapAreaH = UI.mapH;

function updateCanvasLayout() {
    if (compactLandscape) {
        MAP_NODE_R = 19;
        UI.hudH = 64;
        UI.sceneY = 98;
        UI.sceneH = Math.max(0, VIEW_H - UI.sceneY);
        UI.sceneScaleY = 1;
        UI.stageY = UI.sceneY + 92;
        UI.mapAreaY = UI.sceneY;
        UI.mapH = Math.max(80, VIEW_H - UI.sceneY - 92);
        UI.mapAreaH = UI.mapH;
        return;
    }
    const compact = VIEW_W < 900;
    MAP_NODE_R = VIEW_W < 500 ? 17 : compact ? 19 : 21;
    UI.hudH = compact ? 156 : 100;
    UI.sceneY = compact ? 192 : 130;
    UI.sceneH = Math.max(0, VIEW_H - UI.sceneY);
    UI.sceneScaleY = 1;
    UI.stageY = UI.sceneY + (compact ? 300 : 400);
    UI.mapAreaY = UI.sceneY;
    UI.mapH = Math.max(220, VIEW_H - UI.sceneY - (compact ? 300 : 400));
    UI.mapAreaH = UI.mapH;
}

/* Кнопки текущего экрана */
let canvasButtons = [];
/* Кликабельные зоны (кнопки + узлы карты + звук) */
let canvasHits = [];
/* Данные панели Роги */
let rogiPanelData = null;
/* Прокрутка карты */
let mapScrollY = 0;
let mapFocusNodeId = '__unset__';
let mapIntroStartedAt = null;
let rulesScrollY = 0;
let rulesScrollMax = 0;
let quartermasterScrollY = 0;
let quartermasterScrollMax = 0;
let quartermasterScrollArea = { x: 0, y: 0, w: 0, h: 0 };
let canvasPointerScroll = null;
let suppressCanvasClick = false;
const mapBackgroundImage = new Image();
mapBackgroundImage.src = 'assets/dungeon-map-background.png';
const quartermasterPortrait = new Image();
quartermasterPortrait.src = 'assets/quartermaster.png';
const quartermasterShopBackdrop = new Image();
quartermasterShopBackdrop.src = 'assets/quartermaster-shop.png';
const quartermasterShopComposite = new Image();
quartermasterShopComposite.src = 'assets/quartermaster-composition/final_composition.png?v=2';
const quartermasterUpgradeIcons = Object.create(null);
[
    'heart', 'checks', 'purse', 'greed', 'mercy', 'depths', 'insight', 'tally'
].forEach(id => {
    const icon = new Image();
    icon.src = 'assets/quartermaster/' + id + '.svg';
    quartermasterUpgradeIcons[id] = icon;
});
let canvasMousePosition = null;
let canvasPressPoint = null;
let canvasPressReleasedAt = 0;
let canvasPressReleasePoint = null;
let canvasLastPointerType = 'mouse';
let mapPreviewNodeId = null;
let mapHoverCard = null;
let mapKeyboardNodeId = null;
let mapFocusViewport = '';

let mapLayoutSource = null;

const quartermasterPurchaseGuards = Object.create(null);
let quartermasterLastPurchase = { id: '', at: 0 };
let quartermasterDustTransition = null;
let quartermasterReaction = { text: '', expiresAt: 0, kind: '' };

function showQuartermasterReaction(text, kind) {
    quartermasterReaction = { text: text, expiresAt: performance.now() + 3600, kind: kind || 'neutral' };
}

function quartermasterReactionActive() {
    return quartermasterReaction.text && performance.now() < quartermasterReaction.expiresAt;
}

function drawQuartermasterReaction(box, compact) {
    if (!quartermasterReactionActive() || !box || box.w < 100 || box.h < 30) return;
    const small = !!compact;
    const pad = (small ? 6 : 9);
    const bubbleH = small ? 23 : 48;
    const bubble = {
        x: box.x + pad,
        y: box.y + box.h - bubbleH - pad,
        w: box.w - pad * 2,
        h: bubbleH
    };
    fillRound(bubble.x, bubble.y, bubble.w, bubble.h, small ? 6 : 9,
        'rgba(8,11,16,0.91)', 'rgba(217,158,58,0.46)', 1);
    const font = (small ? '600 10px' : '600 12px') + ' Inter, system-ui, sans-serif';
    const lines = quartermasterTextLines(quartermasterReaction.text, font,
        bubble.w - 2 * pad, small ? 1 : 2);
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = quartermasterReaction.kind === 'success' ? '#f0d7a4' : '#e4d6bf';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineH = small ? 12 : 16;
    const startY = bubble.y + bubble.h / 2 - (lines.length - 1) * lineH / 2;
    lines.forEach((line, index) => ctx.fillText(line, bubble.x + bubble.w / 2, startY + index * lineH, bubble.w - 2 * pad));
    ctx.restore();
}

/* ---------------------------------------------------------------
   Цвета интерфейса
   --------------------------------------------------------------- */
const UIC = {
    text: '#f1eee8',
    dim: 'rgba(220,210,192,0.66)',
    gold: '#e9b653',
    green: '#5fd3a4',
    red: '#ff7a90',
    violet: '#c7b6ff',
    line: 'rgba(217,158,58,0.2)',
    surface: 'rgba(13,17,23,0.78)',
    bronze: 'rgba(217,158,58,0.38)',
    bronzeBright: 'rgba(236,194,123,0.78)',
    hoverSurface: 'rgba(45,34,23,0.86)'
};

const BTN_STYLE = {
    'btn-primary': { bg: '#3d2d1e', hoverBg: '#503b27', border: 'rgba(201,151,77,0.72)', hoverBorder: 'rgba(236,194,123,0.9)', text: '#f0ddb9', shadow: 'rgba(217,158,58,0.18)' },
    'btn-danger': { bg: 'rgba(61,29,33,0.88)', hoverBg: 'rgba(83,35,41,0.94)', border: 'rgba(177,82,91,0.5)', hoverBorder: 'rgba(220,117,123,0.78)', text: '#efacaa', shadow: 'rgba(190,76,83,0.14)' },
    'btn-gold': { bg: 'rgba(61,45,30,0.72)', hoverBg: '#503b27', border: 'rgba(201,151,77,0.54)', hoverBorder: 'rgba(236,194,123,0.82)', text: '#edc477', shadow: 'rgba(217,158,58,0.15)' },
    'btn-ghost': { bg: 'rgba(13,17,23,0.78)', hoverBg: 'rgba(45,34,23,0.86)', border: 'rgba(217,158,58,0.3)', hoverBorder: 'rgba(228,180,99,0.72)', text: '#e8d9be', shadow: 'rgba(217,158,58,0.12)' },
    'btn-muted': { bg: 'rgba(13,17,23,0.42)', hoverBg: 'rgba(35,29,22,0.62)', border: 'rgba(217,158,58,0.16)', hoverBorder: 'rgba(217,158,58,0.28)', text: 'rgba(220,210,192,0.5)', shadow: 'transparent' }
};

const FONT_UI = '600 15px Inter, system-ui, sans-serif';
const FONT_LABEL = '800 11px Manrope, Inter, sans-serif';
const FONT_SMALL = '500 12.5px Inter, system-ui, sans-serif';

/* ---------------------------------------------------------------
   Мелкие помощники отрисовки
   --------------------------------------------------------------- */
function fillRound(x, y, w, h, r, fill, stroke, lw) {
    roundRect(ctx, x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}

function drawText(str, x, y, font, color, align, baseline) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'alphabetic';
    ctx.fillText(str, x, y);
    ctx.restore();
}

/* ---------------------------------------------------------------
   Сообщение
   --------------------------------------------------------------- */
/* ---------------------------------------------------------------
   Модель сообщения: разобранные отрезки текста.
   Никакого DOM — всё рисуется на холсте.
   --------------------------------------------------------------- */
/* ---------------------------------------------------------------
   Кнопки
   --------------------------------------------------------------- */
/* Сколько места займут кнопки */
function buttonsHeight(list, dense = false) {
    if (!list || !list.length) return 0;
    const perRow = compactLandscape ? Math.min(3, list.length) : VIEW_W < 760 ? Math.min(2, list.length) : Math.max(1, Math.min(3, list.length));
    const rowH = list.some(btn => btn.subWrap) ? (dense ? 58 : 64) : dense ? 42 : 54;
    const gap = dense ? 8 : 12;
    const rows = Math.ceil(list.length / perRow);
    return rows * rowH + (rows - 1) * gap;
}





function pointInside(box, point) {
    return !!point && point.x >= box.x && point.x <= box.x + box.w &&
        point.y >= box.y && point.y <= box.y + box.h;
}

function canvasButtonPressScale(box) {
    if (typeof prefersReducedMotion === 'function' && prefersReducedMotion()) return 1;
    if (pointInside(box, canvasPressPoint)) return 0.975;
    if (!pointInside(box, canvasPressReleasePoint)) return 1;
    const releaseProgress = clamp((performance.now() - canvasPressReleasedAt) / 150, 0, 1);
    if (releaseProgress >= 1) canvasPressReleasePoint = null;
    return 0.975 + releaseProgress * 0.025;
}

function drawCommonButton(box, style, disabled, radius) {
    const hover = !disabled && menuHover(box);
    const scale = disabled ? 1 : canvasButtonPressScale(box);
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    if (hover && style.shadow !== 'transparent') {
        ctx.shadowColor = style.shadow;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 2;
    }
    fillRound(box.x, box.y, box.w, box.h, radius || 11,
        disabled ? 'rgba(13,17,23,0.38)' : hover ? style.hoverBg : style.bg,
        disabled ? 'rgba(217,158,58,0.12)' : hover ? style.hoverBorder : style.border);
    ctx.restore();
    return hover;
}

function drawSmallButton(btn, y) {
    if (!btn) return;
    const w = Math.min(248, VIEW_W - 40);
    const h = 40;
    const x = Math.round((VIEW_W - w) / 2);
    const ready = !!btn.highlight;
    const box = { x, y, w, h };
    const style = ready ? BTN_STYLE['btn-gold'] : BTN_STYLE['btn-ghost'];
    const hover = drawCommonButton(box, style, !!btn.disabled, 11);
    drawFittedText(btn.text, x + w / 2, y + h / 2, w - 20,
        '700 13px Manrope, Inter, sans-serif', ready || hover ? '#edc477' : UIC.dim,
        ready || hover ? 'rgba(217,158,58,0.12)' : null);
    canvasHits.push({ x: x, y: y, w: w, h: h,
        ariaLabel: btn.text + (btn.sub ? ', ' + btn.sub : ''), action: btn.action, disabled: !!btn.disabled });
}

function drawButtons(list, y, dense = false) {
    if (!list || !list.length) return y;
    const gap = dense ? 8 : 12;
    const rowH = list.some(btn => btn.subWrap) ? (dense ? 58 : 64) : dense ? 42 : 54;
    const perRow = compactLandscape ? Math.min(3, list.length) : VIEW_W < 760 ? Math.min(2, list.length) : Math.max(1, Math.min(3, list.length));
    /* одна кнопка — не растягиваем на всю ширину */
    const w = perRow === 1 ? Math.min(360, VIEW_W - 60) : Math.floor((VIEW_W - 60 - gap * (perRow - 1)) / perRow);
    const rowW = perRow === 1 ? w : w * perRow + gap * (perRow - 1);
    const startX = Math.round((VIEW_W - rowW) / 2);
    let ry = y;

    list.forEach((btn, i) => {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const x = startX + col * (w + gap);
        const by = ry + row * (rowH + gap);
        const st = BTN_STYLE[btn.cls] || BTN_STYLE['btn-ghost'];
        const disabled = !!btn.disabled;

        const box = { x, y: by, w, h: rowH };
        const hover = drawCommonButton(box, st, disabled, 11);

        const col2 = disabled ? 'rgba(220,210,192,0.38)' : hover ? '#f4d9a7' : st.text;
        if (btn.sub) {
            drawFittedText(btn.text, x + w / 2, by + (btn.subWrap ? 15 : dense ? 16 : 21), w - 24,
                '700 ' + (dense ? 12 : 15) + 'px Manrope, Inter, sans-serif', col2);
            const subFont = '500 ' + (btn.subWrap ? 9 : dense ? 9 : 12) + 'px Inter, system-ui, sans-serif';
            ctx.save();
            ctx.font = subFont;
            const maxW = w - 24;
            let lines = [String(btn.sub)];
            if (btn.subWrap) {
                lines = [''];
                for (const word of String(btn.sub).split(/\s+/)) {
                    const lineIndex = lines.length - 1;
                    const candidate = lines[lineIndex] ? lines[lineIndex] + ' ' + word : word;
                    if (ctx.measureText(candidate).width <= maxW) lines[lineIndex] = candidate;
                    else if (lines.length < 2) lines.push(word);
                    else {
                        while (lines[1].length > 1 && ctx.measureText(lines[1] + '…').width > maxW) lines[1] = lines[1].slice(0, -1);
                        lines[1] += '…';
                        break;
                    }
                }
            } else {
                while (lines[0].length > 4 && ctx.measureText(lines[0]).width > maxW) lines[0] = lines[0].slice(0, -1);
                if (lines[0] !== String(btn.sub)) lines[0] = lines[0].slice(0, -1) + '…';
            }
            ctx.restore();
            const subY = btn.subWrap ? (lines.length > 1 ? [by + 38, by + 51] : [by + 45]) : [by + (dense ? 32 : 39)];
            lines.forEach((line, index) => drawText(line, x + w / 2, subY[index] || subY[subY.length - 1], subFont,
                disabled ? 'rgba(220,210,192,0.3)' : UIC.dim, 'center', 'middle'));
        } else {
            drawFittedText(btn.text, x + w / 2, by + rowH / 2, w - 24, '700 15px Manrope, Inter, sans-serif', col2);
        }

        canvasHits.push({ x: x, y: by, w: w, h: rowH,
            ariaLabel: btn.text + (btn.sub ? ', ' + btn.sub : '') + (disabled ? ', недоступно' : ''),
            action: btn.action, disabled: disabled });
    });

    const rows = Math.ceil(list.length / perRow);
    return ry + rows * (rowH + gap) - gap;
}

const svgPathCache = {};
function parseSvgIcon(svg) {
    if (svgPathCache[svg]) return svgPathCache[svg];
    const root = svg.match(/<svg[^>]*>/)[0];
    const defaultFill = /fill="currentColor"/.test(root) && !/fill="none"/.test(root);
    const parts = [];
    const re = /<(path|circle)([^>]*)\/?>/g;
    let m;
    while ((m = re.exec(svg)) !== null) {
        const tag = m[1];
        const attrs = m[2];
        const fillAttr = (attrs.match(/fill="([^"]*)"/) || [])[1];
        const strokeAttr = (attrs.match(/stroke="([^"]*)"/) || [])[1];
        const filled = fillAttr === 'currentColor' || (fillAttr === undefined && defaultFill);
        if (tag === 'path') {
            const d = (attrs.match(/d="([^"]*)"/) || [])[1];
            if (d) parts.push({ kind: 'path', d: d, filled: filled });
        } else {
            const cx = parseFloat((attrs.match(/cx="([^"]*)"/) || [])[1] || 0);
            const cy = parseFloat((attrs.match(/cy="([^"]*)"/) || [])[1] || 0);
            const r = parseFloat((attrs.match(/r="([^"]*)"/) || [])[1] || 0);
            parts.push({ kind: 'circle', cx: cx, cy: cy, r: r, filled: filled });
        }
    }
    svgPathCache[svg] = parts;
    return parts;
}

function drawSvgIcon(svg, x, y, size, color) {
    const parts = parseSvgIcon(svg);
    const s = size / 24;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const p of parts) {
        if (p.kind === 'path') {
            const path = new Path2D(p.d);
            if (p.filled) ctx.fill(path); else ctx.stroke(path);
        } else {
            ctx.beginPath();
            ctx.arc(p.cx, p.cy, p.r, 0, TAU);
            if (p.filled) ctx.fill(); else ctx.stroke();
        }
    }
    ctx.restore();
}

/* ---------------------------------------------------------------
   Карта подземелья на холсте
   --------------------------------------------------------------- */
/* ---------------------------------------------------------------
   Окно правил — тоже на холсте
   --------------------------------------------------------------- */
let rulesOpen = false;

function drawRulesModal() {
    ctx.fillStyle = 'rgba(3,5,11,0.86)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const w = Math.max(1, Math.min(760, VIEW_W - 24));
    const padX = Math.min(34, Math.max(14, Math.round(w * 0.055)));
    const lineH = VIEW_W < 500 ? 19 : 21;
    const fontSize = VIEW_W < 500 ? 13 : 14;
    const lines = [];
    for (const rule of RULES) {
        const rl = layoutRich(parseRichHtml(rule), w - padX * 2);
        for (const line of rl) lines.push(line);
        lines.push({ segs: [], width: 0, gap: true });
    }

    const headerH = 64;
    const footerH = 112;
    const contentH = Math.max(80, VIEW_H - 24 - headerH - footerH);
    const cardH = Math.min(VIEW_H - 16, headerH + contentH + footerH);
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.max(8, Math.round((VIEW_H - cardH) / 2));
    const contentY = y + headerH;
    const contentW = w - padX * 2;
    const contentTotalH = lines.length * lineH;
    rulesScrollMax = Math.max(0, contentTotalH - contentH);
    rulesScrollY = clamp(rulesScrollY, 0, rulesScrollMax);

    fillRound(x, y, w, cardH, 16, 'rgba(7,11,19,0.98)', 'rgba(217,158,58,0.38)');
    fillRound(x + 1, y + 1, w - 2, headerH - 1, 14, 'rgba(45,34,23,0.16)', 'rgba(217,158,58,0.12)');
    drawText('КАК ИГРАТЬ', VIEW_W / 2, y + 34, '800 22px Manrope, Inter, sans-serif', UIC.gold, 'center', 'middle');

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + padX, contentY, contentW, contentH);
    ctx.clip();
    let ty = contentY + lineH / 2 - rulesScrollY;
    for (const line of lines) {
        if (!line.gap) {
            let tx = x + padX;
            for (const seg of line.segs) {
                ctx.save();
                ctx.font = (seg.bold ? '700 ' : '400 ') + fontSize + 'px Inter, system-ui, sans-serif';
                ctx.fillStyle = seg.color || UIC.text;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(seg.text, tx, ty);
                tx += ctx.measureText(seg.text).width;
                ctx.restore();
            }
        }
        ty += lineH;
    }
    ctx.restore();

    if (rulesScrollMax > 0) {
        const barH = Math.max(22, contentH * (contentH / contentTotalH));
        const barY = contentY + (contentH - barH) * (rulesScrollY / rulesScrollMax);
        fillRound(x + w - 7, barY, 3, barH, 1.5, 'rgba(217,158,58,0.38)');
    }

    const modeY = y + cardH - footerH + 6;
    const modeGap = 8;
    const modeW = Math.min(215, Math.floor((w - 40 - modeGap) / 2));
    const modeStartX = Math.round((VIEW_W - modeW * 2 - modeGap) / 2);
    const modeH = 30;
    const drawMode = (label, mode) => {
        const active = heistMode === mode;
        const box = { x:modeStartX + (mode === 'B1' ? modeW + modeGap : 0), y:modeY, w:modeW, h:modeH };
        const style = BTN_STYLE[active ? 'btn-gold' : 'btn-ghost'];
        const hover = drawCommonButton(box, style, false, 8);
        drawFittedText(label, box.x + box.w / 2, box.y + box.h / 2, box.w - 12,
            '700 11px Inter, sans-serif', active || hover ? UIC.gold : UIC.text);
        canvasHits.push({ ...box, ariaLabel:label, action:() => { HeistLoop.setMode(mode); updateUI(); } });
    };
    drawMode('A · Контроль', 'A');
    drawMode('B1 · Последний куш', 'B1');
    drawText(heistMode === 'B1' ? 'B1: после обнаружения доступен ещё один сундук.' : 'A: текущие правила вскрытия и выхода.',
        VIEW_W / 2, modeY + 39, '500 10px Inter, sans-serif', UIC.dim, 'center', 'middle');

    const bw = Math.min(180, w - 32), bh = 32;
    const bx = Math.round((VIEW_W - bw) / 2);
    const by = y + cardH - bh - 6;
    const closeBox = { x: bx, y: by, w: bw, h: bh };
    const closeHover = drawCommonButton(closeBox, BTN_STYLE['btn-gold'], false, 11);
    drawText('ПОНЯТНО', VIEW_W / 2, by + bh / 2, '700 15px Manrope, Inter, sans-serif', closeHover ? '#f4d9a7' : UIC.gold, 'center', 'middle');
    canvasHits.push({
        x: bx, y: by, w: bw, h: bh,
        ariaLabel: 'Закрыть правила',
        action: () => { rulesOpen = false; rulesScrollY = 0; updateUI(); }
    });
}


/* ---------------------------------------------------------------
   Сборка интерфейса на холсте
   --------------------------------------------------------------- */
function drawCanvasUI(t) {
    canvasHits = [];

    if (rulesOpen) {
        canvasHits = [];
        drawRulesModal();
        syncCanvasAccessibility();
        return;
    }
    if (companionModal && !isChamberScreen()) {
        drawMapPageBackground(); drawMapHud(); canvasHits = []; drawCompanionModal();
        syncCanvasAccessibility(); return;
    }
    if (isChamberScreen()) {
        drawChamber(t || 0); syncCanvasAccessibility(); return;
    }

    if (gameState === STATES.INTRO) {
        drawMainMenu(t || 0);
        syncCanvasAccessibility();
        return;
    }

    if (gameState === STATES.PROLOGUE) {
        drawFirstFridayPrologue(t || 0);
        syncCanvasAccessibility();
        return;
    }

    if (gameState === STATES.QUARTERMASTER) {
        drawQuartermasterScreen(t || 0);
        drawHud();
        syncCanvasAccessibility();
        return;
    }

    if (gameState === STATES.INVENTORY) {
        drawMapPageBackground();
        drawHud();
        drawInventoryWindow();
        syncCanvasAccessibility();
        return;
    }

    /* шапка */
    if (gameState === STATES.STEP) drawMapPageBackground();
    drawHud();
    drawBoons(UI.hudH);

    const onMap = gameState === STATES.STEP;
    const locationScreen = gameState === STATES.CAMP || gameState === STATES.SHOP;
    const compactStoryEvent = gameState === STATES.EVENT && currentEvent?.storyEvent && VIEW_W < 500;
    const showRogiPanel = !!rogiPanelData && !compactStoryEvent;
    /* A compact message leaves the route itself as the main surface. */
    const settlementScreen = onMap && attemptOver;
    const msgLayout = onMap ? layoutMapMessage() : layoutMessage();
    if (settlementScreen) msgLayout.height = exitSummaryHeight();
    const btnH = buttonsHeight(canvasButtons);
    const rogiH = !onMap && showRogiPanel ? (rogiPanelData.height || 128) + 12 : 0;
    const panelsH = onMap
        ? msgLayout.height + 10 + btnH + 22
        : rogiH + msgLayout.height + 14 + btnH + 30;

    /* сцена или карта */
    let mapBottom = UI.stageY;
    if (onMap) {
        UI.mapAreaH = Math.max(compactLandscape ? 70 : 170, VIEW_H - UI.sceneY - panelsH - 8);
        drawMapCanvas(t || 0);
        mapBottom = UI.mapAreaY + UI.mapAreaH;
    }

    if (settlementScreen) {
        const actionH = buttonsHeight(canvasButtons);
        const actionsY = VIEW_H - actionH - 12;
        drawExitSummary(actionsY - msgLayout.height - 12, msgLayout.height);
        drawButtons(canvasButtons, actionsY);
        syncCanvasAccessibility();
        return;
    }

    if (locationScreen) {
        drawLocationHeading();
        const dense = VIEW_W < 500 || compactLandscape;
        const actionH = buttonsHeight(canvasButtons, dense);
        const actionsY = Math.max(UI.sceneY + 154, VIEW_H - actionH - 12);
        if (msgLayout.height) {
            const messageY = Math.max(UI.sceneY + 144, actionsY - msgLayout.height - 10);
            drawMessagePanel(messageY, msgLayout);
        }
        drawButtons(canvasButtons, actionsY, dense);
        syncCanvasAccessibility();
        return;
    }

    /* панели снизу */
    let y = onMap ? mapBottom + 8 : UI.stageY + 12;
    if (showRogiPanel) y += drawRogiPanel(y) + 12;
    if (onMap) drawMapMessagePanel(y, msgLayout);
    else drawMessagePanel(y, msgLayout);
    y += msgLayout.height + 14;
    y = drawButtons(canvasButtons, y);
    syncCanvasAccessibility();
}
