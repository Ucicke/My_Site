/* ================================================================
   SCROLL HUNTER · engine/canvas-messages.js
   Модель сюжетных сообщений, inbox писем и отрисовка панелей.
   ================================================================ */
'use strict';

let mapMessageExpanded = false;
let mapLetterInbox = [];
let mapLetterSelected = 0;
let mapLetterCollapsed = false;
let mapLetterRevealStartedAt = null;

function receiveMapLetter(text, reset) {
    if (reset) mapLetterInbox = [];
    mapLetterInbox.push({ text: text, read: false });
    mapLetterRevealStartedAt = null;
    mapLetterSelected = mapLetterInbox.length - 1;
    mapLetterCollapsed = !reset;
    mapMessageExpanded = false;
}

let messageModel = { runs: [] };

/* Задать сообщение: принимает разметку и превращает её в отрезки */
function setMessage(html) {
    messageModel.runs = html ? parseRichHtml(html) : [];
}

/* Разметка сообщения: считаем заранее, чтобы правильно разложить панели */
function layoutMessage() {
    const compactStory = gameState === STATES.EVENT && currentEvent?.storyEvent && VIEW_W < 500;
    const fontSize = compactStory ? 13 : 15;
    const lineH = compactStory ? 18 : 21;
    const contentWidth = compactStory ? VIEW_W - 40 : VIEW_W - 120;
    const lines = layoutRich(messageModel.runs, contentWidth, fontSize);
    if (!lines.length) return { lines: [], height: 0 };
    return { lines, fontSize, lineH, height: Math.max(58, lines.length * lineH + 22) };
}

function drawMessagePanel(y, layout) {
    if (!layout || !layout.lines.length) return 0;
    const lines = layout.lines;
    const lineH = layout.lineH || 21;
    const fontSize = layout.fontSize || 15;
    const boxH = layout.height;

    fillRound(0, y, VIEW_W, boxH, 12, 'rgba(13,17,23,0.68)', UIC.line);

    let ty = y + 11 + lineH / 2;
    for (const line of lines) {
        let tx = VIEW_W / 2 - line.width / 2;
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
        ty += lineH;
    }
    return boxH;
}

function layoutMapMessage() {
    const letter = !attemptOver && mapLetterInbox[mapLetterSelected];
    const preview = letter && !mapMessageExpanded;
    const width = VIEW_W < 760 ? Math.max(1, VIEW_W - 24) : Math.min(preview ? 440 : 560, Math.max(360, VIEW_W * 0.46));
    const unread = mapLetterInbox.filter(item => !item.read).length;
    if (letter && mapLetterCollapsed) return { width: 48, height: 48, collapsed: true, unread: unread };
    const runs = letter ? parseRichHtml(letter.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')) : messageModel.runs;
    const fontSize = letter ? (preview ? 13 : 16) : 12;
    const lineH = letter ? (preview ? 18 : 23) : 17;
    const lines = layoutRich(runs, Math.max(140, width - 58), fontSize);
    const previewLines = preview ? 1 : 2;
    const hasMore = !attemptOver && lines.length > previewLines;
    const shown = mapMessageExpanded || attemptOver ? lines : lines.slice(0, previewLines);
    return {
        width: Math.min(width, VIEW_W - 20),
        lines: shown,
        hasMore,
        letter: letter,
        fontSize, lineH,
        height: Math.max(58, 29 + shown.length * lineH + 12)
    };
}

function drawMapMessagePanel(y, layout) {
    if (!layout) return 0;
    const x = 12;
    const reduced = typeof prefersReducedMotion === 'function' && prefersReducedMotion();
    const now = performance.now();
    if (mapLetterRevealStartedAt === null) mapLetterRevealStartedAt = now;
    const elapsed = (now - mapLetterRevealStartedAt) / 1000;
    const unreadLetter = layout.collapsed ? layout.unread > 0 : layout.letter && !layout.letter.read;
    const pulse = reduced || elapsed > 2 ? 0 : Math.sin(elapsed * Math.PI / 2);
    const wave = !reduced && elapsed < 1.1 ? Math.sin(elapsed * Math.PI * 4 / 1.1) * 0.07 : 0;
    ctx.save();
    if (layout.letter || layout.collapsed) ctx.globalAlpha = reduced ? 1 : 0.35 + 0.65 * clamp(elapsed / 0.45, 0, 1);
    if (layout.collapsed) {
        const box = { x: x, y: y, w: 44, h: 44 };
        drawMenuControl(box, 'Письма: ' + layout.unread + ' непрочитанных. Открыть письма', () => {
            const unreadIndex = mapLetterInbox.findIndex(item => !item.read);
            if (unreadIndex >= 0) mapLetterSelected = unreadIndex;
            mapLetterCollapsed = false;
            mapMessageExpanded = true;
            mapLetterRevealStartedAt = null;
        }, hover => {
            const gold = layout.unread > 0;
            ctx.save();
            ctx.shadowColor = gold ? 'rgba(240,184,65,0.38)' : 'transparent';
            ctx.shadowBlur = gold ? 12 + pulse * 9 : 0;
            fillRound(x, y, 44, 44, 10, gold ? '#392c18' : '#171a20', gold ? '#dfad4e' : '#65533b');
            ctx.translate(x + 22, y + 21);
            ctx.rotate(gold ? wave : 0);
            drawText('✉', 0, 0, '24px Segoe UI, sans-serif', gold || hover ? '#f4cd76' : '#b5a78f', 'center', 'middle');
            ctx.restore();
            if (gold) {
                fillRound(x + 29, y + 29, 19, 19, 8, '#e3b14e', '#f5d58d');
                drawText(String(layout.unread), x + 38.5, y + 38.5, '800 11px Inter, sans-serif', '#21180b', 'center', 'middle');
            }
        });
        ctx.restore();
        return layout.height;
    }
    const w = layout.width;
    const h = layout.height;
    ctx.save();
    if (unreadLetter) {
        ctx.shadowColor = 'rgba(224,166,64,0.25)';
        ctx.shadowBlur = 9 + pulse * 8;
    }
    const paper = ctx.createLinearGradient(x, y, x + w, y + h);
    const openParchment = layout.letter && mapMessageExpanded;
    paper.addColorStop(0, openParchment ? '#dfc390' : layout.letter ? '#3d2d1d' : 'rgba(38,29,21,0.91)');
    paper.addColorStop(1, openParchment ? '#bfa06e' : layout.letter ? '#211b18' : 'rgba(38,29,21,0.91)');
    fillRound(x, y, w, h, 11, paper, unreadLetter ? 'rgba(229,179,91,' + (0.55 + pulse * 0.2) + ')' : 'rgba(196,148,78,0.36)');
    ctx.restore();
    if (openParchment) {
        fillRound(x + 7, y + 7, w - 14, h - 14, 7, null, 'rgba(100,66,32,0.28)');
    }
    fillRound(x + 1, y + 1, 3, h - 2, 2, 'rgba(218,169,100,0.72)');
    if (layout.letter && !mapMessageExpanded) {
        canvasHits.push({ x, y, w, h, ariaLabel: 'Открыть письмо от арендодателя',
            action: () => { mapMessageExpanded = true; mapLetterRevealStartedAt = null; } });
    }

    /* Simple letter mark, drawn as vector so it remains crisp at every scale. */
    const ix = x + 21, iy = y + 20;
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(unreadLetter ? wave : 0);
    ctx.translate(-ix, -iy);
    fillRound(ix - 8, iy - 5, 16, 11, 2, 'rgba(72,52,31,0.82)', 'rgba(225,185,121,0.68)');
    ctx.strokeStyle = 'rgba(225,185,121,0.72)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ix - 7, iy - 4);
    ctx.lineTo(ix, iy + 1);
    ctx.lineTo(ix + 7, iy - 4);
    ctx.stroke();
    if (layout.letter) {
        fillRound(ix + 3, iy + 1, 7, 7, 3.5, '#9d4140', '#c67457');
    }
    ctx.restore();
    drawText(layout.letter ? 'От арендодателя' : attemptOver ? 'РАСЧЁТ НЕДЕЛИ' : 'ЗАПИСКА', x + 40, y + 14,
        '800 10px Manrope, Inter, sans-serif', openParchment ? '#54391f' : 'rgba(240,202,141,0.95)', 'left', 'middle');

    const hasToggle = layout.hasMore || layout.letter;
    if (hasToggle) {
        const toggle = { x: x + w - 102, y: y + 5, w: 92, h: 18 };
        const hover = menuHover(toggle);
        drawText(mapMessageExpanded ? (layout.letter ? 'Прочитано ✓' : 'Свернуть −') : 'Читать дальше', toggle.x + toggle.w / 2,
            toggle.y + toggle.h / 2, '700 9px Manrope, Inter, sans-serif',
            openParchment ? '#59351d' : hover ? '#f4d9a7' : 'rgba(233,182,83,0.95)', 'center', 'middle');
        canvasHits.push({ x: toggle.x, y: toggle.y, w: toggle.w, h: toggle.h,
            ariaLabel: mapMessageExpanded ? (layout.letter ? 'Отметить письмо прочитанным и свернуть' : 'Свернуть сюжетное сообщение') : 'Развернуть сюжетное сообщение',
            action: () => {
                if (layout.letter && mapMessageExpanded) {
                    layout.letter.read = true;
                    mapLetterCollapsed = true;
                    mapMessageExpanded = false;
                } else {
                    mapMessageExpanded = !mapMessageExpanded;
                    mapLetterRevealStartedAt = null;
                }
            } });
    }

    let ty = y + 34;
    layout.lines.forEach((line, index) => {
        let tx = x + 40;
        for (const seg of line.segs) {
            ctx.save();
            ctx.font = (seg.bold ? '700 ' : '400 ') + layout.fontSize + 'px Inter, system-ui, sans-serif';
            ctx.fillStyle = seg.color || (openParchment ? '#352719' : '#f2e6d0');
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(seg.text, tx, ty);
            tx += ctx.measureText(seg.text).width;
            ctx.restore();
        }
        if (!mapMessageExpanded && layout.hasMore && index === layout.lines.length - 1) {
            drawText('…', Math.min(x + w - 18, tx + 2), ty, '700 12px Inter, system-ui, sans-serif',
                'rgba(242,230,208,0.92)', 'left', 'middle');
        }
        ty += layout.lineH;
    });
    ctx.restore();
    return h;
}

