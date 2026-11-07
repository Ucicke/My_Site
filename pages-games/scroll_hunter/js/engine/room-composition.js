/* ================================================================
   SCROLL HUNTER · engine/room-composition.js
   Счётчик содержимого комнаты и подпись уровня.
   ================================================================ */
'use strict';

/* Состав комнаты: сколько РЕЛИКВИЙ, МИМИКОВ и пустых сундуков ОСТАЛОСЬ.
   Пересчитывается каждый кадр — счётчик тает по мере вскрытия. */
function roomCompositionLeft() {
    let relic = 0, mimic = 0, empty = 0;
    for (const c of chests) {
        if (!c || c.opened) continue;
        if (c.type === 'scroll') relic++;
        else if (c.type === 'mimic') mimic++;
        else empty++;              /* 'empty' и 'dig' — пустота и раскопки */
    }
    return { relic: relic, mimic: mimic, empty: empty };
}

function drawRoomComposition() {
    if (!roomInfo || !roomInfo.total) return;
    const dig = roomInfo.room === 'DIG';
    const left = roomCompositionLeft();
    const items = [
        { label: 'РЕЛИКВИЯ', n: left.relic, color: '#ffc93c' },
        { label: 'МИМИК', n: left.mimic, color: '#f2555a' },
        { label: dig ? 'РАСКОПКА' : 'ПУСТО', n: left.empty, color: '#7d8aa0' }
    ];

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const pad = 13, dot = 8, gap = 18;
    const FONT_L = '600 12px Manrope, Inter, sans-serif';
    const FONT_C = '700 13px Manrope, Inter, sans-serif';

    /* ширина чипа = подпись + счётчик + отступы */
    const metrics = items.map(it => {
        ctx.font = FONT_L;
        const lw = ctx.measureText(it.label).width;
        ctx.font = FONT_C;
        const cw = ctx.measureText('×' + it.n).width;
        return { lw: lw, cw: cw, w: pad + dot + 6 + lw + 10 + cw + 12 };
    });
    const totalW = metrics.reduce((a, m) => a + m.w, 0) + gap * (items.length - 1);
    let x = Math.round(VIEW_W / 2 - totalW / 2);

    items.forEach((it, i) => {
        const m = metrics[i];
        if (it.n <= 0) { x += m.w + gap; return; }

        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        roundRect(ctx, x, 20, m.w, 28, 9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.09)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = it.color;
        ctx.beginPath();
        ctx.arc(x + pad + dot / 2, 34, dot / 2, 0, TAU);
        ctx.fill();

        ctx.font = FONT_L;
        ctx.fillStyle = 'rgba(226,232,240,0.88)';
        ctx.fillText(it.label, x + pad + dot + 6, 34);

        ctx.font = FONT_C;
        ctx.fillStyle = it.color;
        ctx.fillText('×' + it.n, x + m.w - 12 - m.cw, 34);

        x += m.w + gap;
    });
    ctx.restore();
}

function drawRoomPlaque(depth, maxDepth) {
    if (!depth) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 14px Manrope, Inter, sans-serif';
    ctx.fillStyle = 'rgba(190,210,245,0.38)';
    ctx.letterSpacing = '3px';
    ctx.fillText(`УРОВЕНЬ ${depth} / ${maxDepth}`, VIEW_W / 2, 40);
    ctx.strokeStyle = 'rgba(190,210,245,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 - 60, 52);
    ctx.lineTo(VIEW_W / 2 + 60, 52);
    ctx.stroke();
    ctx.restore();
}

