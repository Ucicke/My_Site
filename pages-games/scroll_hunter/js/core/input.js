/* ================================================================
   SCROLL HUNTER · core/input.js
   Ввод: мышь, тач, клавиатура.
   ================================================================ */
'use strict';


/* Клик по вопросу Роги */
if (ui.rogiPanel) {
    ui.rogiPanel.addEventListener('click', (e) => {
        const b = e.target.closest ? e.target.closest('[data-ask]') : null;
        if (!b) return;
        const kind = b.getAttribute('data-ask');
        if (kind === 'chest') askRogiChest();
        else if (kind === 'room') askRogiRoom();
    });
}

function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (VIEW_W / rect.width),
        y: (e.clientY - rect.top) * (VIEW_H / rect.height)
    };
}

function chestAt(p) {
    const sceneScaleY = UI.sceneScaleY || 1;
    if (p.y < UI.sceneY || p.y > UI.sceneY + UI.sceneH) return -1;
    const chestY = (p.y - UI.sceneY) / sceneScaleY;
    for (let i = 0; i < chests.length; i++) {
        const c = chests[i];
        if (c.destroyed) continue;
        if (c.hitBox) {
            if (pointInside(c.hitBox, p)) return i;
            continue;
        }
        const chestWidthPx = c.w || CHEST_W;
        if (p.x >= c.x - 6 && p.x <= c.x + chestWidthPx + 6 &&
            chestY >= c.y - CHEST_LID_H - 10 && chestY <= c.y + CHEST_BODY_H + 6) {
            return i;
        }
    }
    return -1;
}

canvas.addEventListener('click', (e) => {
    if (typeof canvasLastPointerType !== 'undefined' && e.pointerType) {
        canvasLastPointerType = e.pointerType;
    }
    if (suppressCanvasClick) {
        suppressCanvasClick = false;
        e.preventDefault();
        return;
    }
    const p = canvasPoint(e);
    if (rulesOpen) {
        if (typeof handleCanvasClick === 'function') handleCanvasClick(p.x, p.y);
        return;
    }
    if (isLocked()) return;
    /* Сначала интерфейс и карта — потом сундуки */
    if (typeof handleCanvasClick === 'function' && handleCanvasClick(p.x, p.y)) return;
    if (gameState !== STATES.CHOOSE) return;
    const idx = chestAt(p);
    if (idx >= 0) selectChest(idx);
});

canvas.addEventListener('pointerdown', (e) => {
    mapKeyboardNodeId = null;
    if (typeof canvasLastPointerType !== 'undefined') canvasLastPointerType = e.pointerType || 'mouse';
    const p = canvasPoint(e);
    const hit = typeof canvasHitAt === 'function' ? canvasHitAt(p.x, p.y) : null;
    canvasPressPoint = hit && !hit.disabled && !isLocked() ? p : null;
    canvasPressReleasePoint = null;
    if (e.pointerType !== 'touch') return;
    const inScrollableArea = rulesOpen || (gameState === STATES.QUARTERMASTER &&
        typeof canvasPointCanScroll === 'function' && canvasPointCanScroll(p.x, p.y)) ||
        (gameState === STATES.STEP && p.y >= UI.mapAreaY && p.y <= UI.mapAreaY + UI.mapAreaH);
    if (!inScrollableArea) return;
    canvasPointerScroll = { startY: p.y, lastY: p.y, moved: false };
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
    if (!canvasPointerScroll || e.pointerType !== 'touch') return;
    const p = canvasPoint(e);
    const dy = p.y - canvasPointerScroll.lastY;
    canvasPointerScroll.lastY = p.y;
    if (Math.abs(p.y - canvasPointerScroll.startY) > 5) canvasPointerScroll.moved = true;
    if (canvasPointerScroll.moved) handleCanvasDrag(-dy, p.y);
});

function finishCanvasPointerScroll(e) {
    if (typeof canvasLastPointerType !== 'undefined') canvasLastPointerType = e.pointerType || canvasLastPointerType;
    if (canvasPressPoint) {
        canvasPressReleasePoint = canvasPressPoint;
        canvasPressReleasedAt = performance.now();
        canvasPressPoint = null;
    }
    if (!canvasPointerScroll) return;
    if (canvasPointerScroll.moved) {
        suppressCanvasClick = true;
        window.setTimeout(() => { suppressCanvasClick = false; }, 120);
    }
    canvasPointerScroll = null;
    if (canvas.releasePointerCapture && canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
    }
}

canvas.addEventListener('pointerup', finishCanvasPointerScroll);
canvas.addEventListener('pointercancel', finishCanvasPointerScroll);

canvas.addEventListener('mousemove', (e) => {
    if (typeof canvasLastPointerType !== 'undefined') canvasLastPointerType = 'mouse';
    const p = canvasPoint(e);
    if (typeof canvasMousePosition !== 'undefined') canvasMousePosition = p;
    const overUi = typeof canvasHitAt === 'function' && canvasHitAt(p.x, p.y);
    if (overUi && !overUi.disabled) {
        canvas.style.cursor = 'pointer';
        return;
    }
    if (gameState !== STATES.CHOOSE) {
        canvas.style.cursor = 'default';
        return;
    }
    canvas.style.cursor = chestAt(p) >= 0 ? 'pointer' : 'crosshair';
});

canvas.addEventListener('mouseleave', () => {
    if (typeof canvasMousePosition !== 'undefined') canvasMousePosition = null;
});

/* Прокрутка карты колесом мыши */
canvas.addEventListener('wheel', (e) => {
    if (typeof handleCanvasWheel !== 'function') return;
    if (!rulesOpen && gameState !== STATES.STEP && gameState !== STATES.QUARTERMASTER) return;
    if (gameState === STATES.QUARTERMASTER) {
        const p = canvasPoint(e);
        if (typeof canvasPointCanScroll !== 'function' || !canvasPointCanScroll(p.x, p.y)) return;
    }
    e.preventDefault();
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? VIEW_H : 1);
    handleCanvasWheel(delta);
}, { passive: false });

document.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (gameState === STATES.PROLOGUE && e.key === 'Escape') {
        e.preventDefault();
        finishFirstFridayPrologue();
        return;
    }
    if (companionModal) {
        if (e.key === 'Escape') { if (companionModal.type === 'dialogue') RogiAI.closeDialogue(companion); companionModal = null; e.preventDefault(); }
        else if (e.key === 'Tab') {
            e.preventDefault();
            const buttons = [...canvasAccessibilityControls.querySelectorAll('button')].filter(button => !button.hasAttribute('aria-disabled'));
            const i = buttons.indexOf(document.activeElement);
            if (buttons.length) buttons[(i + (e.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
        } else if (!e.target.closest?.('#canvas-accessibility-controls button') && ['Enter', ' '].includes(e.key)) e.preventDefault();
        return;
    }
    if (!rulesOpen && gameState === STATES.STEP && e.key === 'Escape') {
        mapKeyboardNodeId = null;
        mapPreviewNodeId = null;
        canvasMousePosition = null;
        if (document.activeElement && canvasAccessibilityControls.contains(document.activeElement)) document.activeElement.blur();
        e.preventDefault();
        return;
    }
    if (!rulesOpen && gameState === STATES.INVENTORY && e.key === 'Escape') {
        e.preventDefault();
        if (selectedInventoryIndex >= 0) {
            selectedInventoryIndex = -1;
            updateUI();
        } else closeInventory();
        return;
    }
    const accessibleButton = e.target && e.target.closest &&
        e.target.closest('#canvas-accessibility-controls button');


    if (gameState === STATES.QUARTERMASTER &&
        ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        if (typeof handleCanvasKeyScroll === 'function') handleCanvasKeyScroll(e.key);
        return;
    }

    if (rulesOpen) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const closeButton = document.querySelector('#canvas-accessibility-controls button');
            if (closeButton) closeButton.focus();
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            openRules(false);
            return;
        }
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
            e.preventDefault();
            handleCanvasWheel(e.key === 'PageDown' ? 240 : 70);
            return;
        }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            handleCanvasWheel(e.key === 'PageUp' ? -240 : -70);
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            if (!accessibleButton) {
                e.preventDefault();
                openRules(false);
            }
            return;
        }
        return;
    }

    if (accessibleButton) {
        if (gameState === STATES.QUARTERMASTER || gameState === STATES.STEP) {
            if (e.key === 'ArrowDown' || e.key === 'PageDown') {
                e.preventDefault();
                if (typeof handleCanvasKeyScroll === 'function') handleCanvasKeyScroll(e.key);
                else handleCanvasWheel(e.key === 'PageDown' ? 240 : 70);
            } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
                e.preventDefault();
                if (typeof handleCanvasKeyScroll === 'function') handleCanvasKeyScroll(e.key);
                else handleCanvasWheel(e.key === 'PageUp' ? -240 : -70);
            }
        }
        return;
    }

    const k = e.key.toLowerCase();

    if (k === 'm') {
        toggleMute();
        return;
    }
    if (k === 'r') {
        if (gameState === STATES.INTRO) beginCampaignFromMenu();
        else if (gameState !== STATES.PROLOGUE) startCampaign();
        return;
    }

    if (gameState === STATES.CHOOSE) {
        if (/^[1-6]$/.test(k)) {
            selectChest(parseInt(k, 10) - 1);
            e.preventDefault();
            return;
        }
        if (k === 'c' || k === 'v') {
            askRogi();
            e.preventDefault();
            return;
        }
    }

    if (e.key === ' ' || e.key === 'Enter') {
        if (primaryAction && !isLocked()) {
            e.preventDefault();
            Sfx.play('click');
            primaryAction();
        }
    }
});
