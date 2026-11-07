/* ================================================================
   SCROLL HUNTER · engine/main.js — игровой цикл
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   8. Главный цикл
--------------------------------------------------------------- */
let lastFrame = performance.now();
let canvasResizeObserver = null;

/* Счётчик кадров: позволяет тестам убедиться, что цикл рендера жив */
let frameCount = 0;

function frame(now) {
    frameCount++;
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    const t = now / 1000;

    updateEffects(dt);
    updateMotes(dt, t);
    if (typeof gameUpdate === 'function') gameUpdate(dt, t);

    ctx.clearRect(-30, -30, VIEW_W + 60, VIEW_H + 60);

    /* Фон и факелы закрывают весь экран, в том числе область под шапкой. */
    drawEnvironmentBackdrop(t);

    /* ---------- Сцена: своя область холста ---------- */
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, UI.sceneY, VIEW_W, UI.sceneH);
    ctx.clip();
    ctx.translate(0, UI.sceneY);
    ctx.scale(1, UI.sceneScaleY || 1);

    if (shake.time > 0) {
        const k = shake.time / shake.dur;
        ctx.translate(randIn('visual', -1, 1) * shake.mag * k, randIn('visual', -1, 1) * shake.mag * k);
    }

    drawEnvironment(t, currentScene);

    if (typeof gameRender === 'function') {
        gameRender(t);
    } else {
        drawRoomPlaque(1, 10);
    }

    drawEffects();

    /* Виньетка */
    const vig = ctx.createRadialGradient(VIEW_W / 2, 200, VIEW_W / 3.4, VIEW_W / 2, 200, VIEW_W / 1.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(2,4,10,0.9)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, VIEW_W, UI.sceneH);

    /* Вспышка */
    if (flash.time > 0) {
        ctx.save();
        ctx.globalAlpha = (flash.time / flash.dur) * 0.32;
        ctx.fillStyle = flash.color;
        ctx.fillRect(0, 0, VIEW_W, UI.sceneH);
        ctx.restore();
    }
    ctx.restore();

    /* ---------- Интерфейс: целиком на холсте ---------- */
    if (typeof drawCanvasUI === 'function') drawCanvasUI(t);
    if (typeof RogiWorld === 'object') RogiWorld.draw();

    requestAnimationFrame(frame);
}

/* Цикл стартует из core/main.js — к этому моменту загружены все данные,
   иначе первый кадр может прийти раньше, чем появятся STAGES и прочее. */
function startGameLoop() {
    fitCanvas();
    window.addEventListener('resize', fitCanvas);
    window.addEventListener('orientationchange', fitCanvas);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fitCanvas);
    /* CSS может изменить размер игровой области без window.resize
       (вкладки, панели браузера, flex-layout и смена ориентации). */
    if (window.ResizeObserver && !canvasResizeObserver) {
        canvasResizeObserver = new ResizeObserver(() => fitCanvas());
        canvasResizeObserver.observe(canvas.parentElement || canvas);
    }
    requestAnimationFrame(frame);
}
