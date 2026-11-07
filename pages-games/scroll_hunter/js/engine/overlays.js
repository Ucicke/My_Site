/* ================================================================
   SCROLL HUNTER · engine/overlays.js — экранные заставки
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   7. Экранные заставки
--------------------------------------------------------------- */
/* Тонкая светящаяся арка — задаёт глубину пустой сцене этапа */
function drawPortal(t) {
    const cx = VIEW_W / 2;
    const baseY = 250;          // линия пола
    const w = 210;
    const h = 180;
    const top = baseY - h;

    ctx.save();

    /* Мягкий свет из проёма */
    const pulse = 0.10 + Math.sin((t || 0) * 1.3) * 0.03;
    const glow = ctx.createRadialGradient(cx, baseY - 60, 8, cx, baseY - 60, 230);
    glow.addColorStop(0, `rgba(240,178,74,${pulse.toFixed(3)})`);
    glow.addColorStop(0.6, 'rgba(240,178,74,0.02)');
    glow.addColorStop(1, 'rgba(240,178,74,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 50, 220, 170, 0, 0, TAU);
    ctx.fill();

    /* Контур арки */
    const stroke = ctx.createLinearGradient(0, top, 0, baseY);
    stroke.addColorStop(0, 'rgba(240,178,74,0.05)');
    stroke.addColorStop(0.55, 'rgba(240,178,74,0.22)');
    stroke.addColorStop(1, 'rgba(240,178,74,0.42)');
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, baseY);
    ctx.lineTo(cx - w / 2, top + w / 2);
    ctx.quadraticCurveTo(cx, top - 22, cx + w / 2, top + w / 2);
    ctx.lineTo(cx + w / 2, baseY);
    ctx.stroke();

    /* Каменные блоки по краям проёма */
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        const y = baseY - 24 - i * 40;
        ctx.beginPath();
        ctx.moveTo(cx - w / 2 - 14, y);
        ctx.lineTo(cx - w / 2 - 3, y);
        ctx.moveTo(cx + w / 2 + 3, y);
        ctx.lineTo(cx + w / 2 + 14, y);
        ctx.stroke();
    }

    /* Блик на полу у порога */
    const refl = ctx.createLinearGradient(0, baseY, 0, baseY + 34);
    refl.addColorStop(0, 'rgba(240,178,74,0.09)');
    refl.addColorStop(1, 'rgba(240,178,74,0)');
    ctx.fillStyle = refl;
    ctx.fillRect(cx - w / 2, baseY, w, 34);

    ctx.restore();
}

function drawFittedText(text, cx, y, maxWidth, font, color, glowColor) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font;
    let size = parseInt(font.match(/(\d+)px/)?.[1] || '40', 10);
    while (ctx.measureText(text).width > maxWidth && size > 12) {
        size -= 2;
        ctx.font = font.replace(/(\d+)px/, size + 'px');
    }
    if (glowColor) {
        ctx.shadowBlur = 28;
        ctx.shadowColor = glowColor;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, cx, y);
    ctx.restore();
}

function drawOverlay(state, data, t) {
    ctx.save();
    const intro = state === 'intro';
    const scrim = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 60, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.72);
    scrim.addColorStop(0, `rgba(6, 8, 14, ${intro ? 0.52 : 0.86})`);
    scrim.addColorStop(0.6, `rgba(6, 8, 14, ${intro ? 0.3 : 0.58})`);
    scrim.addColorStop(1, `rgba(6, 8, 14, ${intro ? 0.1 : 0.18})`);
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    /* Декоративная рамка */
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    roundRect(ctx, 34, 28, VIEW_W - 68, VIEW_H - 56, 16);
    ctx.stroke();

    if (state === 'intro') {
        const compact = VIEW_W < 760;
        const yScale = UI.sceneScaleY || 1;
        const smallLabelY = compact ? 52 : 80;
        const firstLineY = compact ? 88 : 126;
        const secondLineY = compact ? 126 : 174;
        const subtitleY = compact ? 164 : 216;
        const drawUpright = (y, draw) => {
            ctx.save();
            ctx.translate(0, y);
            if (yScale < 1) ctx.scale(1, 1 / yScale);
            draw();
            ctx.restore();
        };
        drawUpright(smallLabelY, () => drawFittedText('ДОЛГ НЕ ЖДЁТ', VIEW_W / 2, 0, VIEW_W - 80,
            '700 11px Manrope, Inter, sans-serif', 'rgba(240,178,74,0.78)'));
        drawUpright(firstLineY, () => drawFittedText('ОХОТНИКИ ЗА СВИТКАМИ', VIEW_W / 2, 0, VIEW_W - (compact ? 48 : 160),
            `800 ${compact ? 32 : 46}px Manrope, Inter, sans-serif`, '#ffffff', 'rgba(240,178,74,0.4)'));
        drawUpright(secondLineY, () => drawFittedText('ПРОТИВ АРЕНДОДАТЕЛЯ', VIEW_W / 2, 0, VIEW_W - (compact ? 48 : 160),
            `800 ${compact ? 28 : 40}px Manrope, Inter, sans-serif`, '#f0b24a', 'rgba(240,178,74,0.28)'));
        ctx.save();
        const ruleY = secondLineY + 24;
        ctx.strokeStyle = 'rgba(240,178,74,0.38)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(VIEW_W / 2 - 54, ruleY);
        ctx.lineTo(VIEW_W / 2 + 54, ruleY);
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = compact ? '400 13px Inter, sans-serif' : '400 15.5px Inter, sans-serif';
        ctx.fillStyle = 'rgba(200,215,240,0.68)';
        drawUpright(subtitleY, () => ctx.fillText(data?.sub || 'Шесть недель, чтобы расплатиться.', VIEW_W / 2, 0));
        ctx.restore();
    } else if (state === 'node') {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (!data?.noIcon) {
            ctx.font = '64px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
            ctx.fillText(data?.icon || '🕳️', VIEW_W / 2, VIEW_H / 2 - 56);
        }
        ctx.font = '800 32px Manrope, Inter, sans-serif';
        ctx.fillStyle = data?.color || '#ffffff';
        ctx.shadowBlur = 18;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.fillText(data?.title || '', VIEW_W / 2, VIEW_H / 2 + 18);
        ctx.shadowBlur = 0;
        ctx.font = '400 16px Inter, sans-serif';
        ctx.fillStyle = 'rgba(200,215,240,0.68)';
        const sub = data?.sub || '';
        let subSize = 17;
        while (ctx.measureText(sub).width > VIEW_W - 140 && subSize > 11) {
            subSize -= 1;
            ctx.font = '400 ' + subSize + 'px Inter, sans-serif';
        }
        ctx.fillText(sub, VIEW_W / 2, VIEW_H / 2 + 62);
    } else if (state === 'over' || state === 'win') {
        const win = state === 'win';
        drawFittedText(win ? 'ПОБЕДА!' : 'ИГРА ОКОНЧЕНА', VIEW_W / 2, 152, VIEW_W - 160,
            '800 46px Manrope, Inter, sans-serif',
            win ? '#46d39a' : '#f2555a',
            win ? 'rgba(70,211,154,0.4)' : 'rgba(242,85,90,0.4)');
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '500 17px Inter, sans-serif';
        ctx.fillStyle = 'rgba(233,237,245,0.9)';
        ctx.fillText(data?.line1 || '', VIEW_W / 2, 212);
        ctx.fillStyle = 'rgba(139,149,169,0.85)';
        ctx.font = '400 15px Inter, sans-serif';
        ctx.fillText(data?.line2 || '', VIEW_W / 2, 246);
        ctx.fillText(data?.line3 || '', VIEW_W / 2, 272);
        ctx.restore();
    }
    ctx.restore();
}

