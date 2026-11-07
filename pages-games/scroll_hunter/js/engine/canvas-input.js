/* ================================================================
   SCROLL HUNTER · engine/canvas-input.js
   Hit testing, прокрутка и доступные DOM-действия холста.
   ================================================================ */
'use strict';
let accessibleCanvasHits = [];
let canvasModalReturnLabel = '';
const canvasAccessibilityControls = document.getElementById('canvas-accessibility-controls');
const canvasAccessibilityStatus = document.getElementById('canvas-accessibility-status');
const canvasAccessibilityRules = document.getElementById('canvas-accessibility-rules');

function canvasHitAt(x, y) {
    for (let i = canvasHits.length - 1; i >= 0; i--) {
        const h = canvasHits[i];
        if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
}

function activateCanvasHit(hit) {
    if (!hit) return false;
    if (rulesOpen) {
        if (typeof hit.action === 'function') {
            Sfx.play('click');
            hit.action();
        }
        return true;
    }
    if (hit.node) {
        mapIntroStartedAt = null;
        if (gameState === STATES.STEP && canvasLastPointerType === 'touch' && !attemptOver) {
            mapPreviewNodeId = hit.node.id;
            Sfx.play('click');
            return true;
        }
        if (!hit.reachable || attemptOver) return true;
        Sfx.play('click');
        chooseNode(hit.node.id);
        return true;
    }
    if (hit.disabled || isLocked()) return true;
    if (typeof hit.action === 'function') {
        Sfx.play('click');
        hit.action();
    }
    return true;
}

function syncCanvasAccessibility() {
    if (!canvasAccessibilityControls) return;
    const hits = canvasHits.filter(hit => hit.ariaLabel).slice();

    if (gameState === STATES.CHOOSE && !companionModal && !isChamberScreen()) {
        const scaleY = UI.sceneScaleY || 1;
        chests.forEach((chest, index) => {
            if (chest.destroyed) return;
            const width = chest.w || CHEST_W;
            hits.push({
                x: chest.x - 6,
                y: UI.sceneY + (chest.y - CHEST_LID_H - 10) * scaleY,
                w: width + 12,
                h: (CHEST_LID_H + CHEST_BODY_H + 16) * scaleY,
                ariaLabel: 'Открыть сундук ' + (index + 1),
                action: () => selectChest(index)
            });
        });
    }

    const locked = isLocked();
    const dialog = rulesOpen ? 'rules' : companionModal ? 'companion' : '';
    const signature = hits.map((hit, index) => index + ':' + hit.ariaLabel + ':' + !!hit.disabled + ':' + !!hit.reachable + ':' + locked).join('|');
    const hadFocus = canvasAccessibilityControls.contains(document.activeElement);
    const activeIndex = hadFocus ? Number(document.activeElement.dataset.controlIndex || 0) : -1;
    const activeLabel = hadFocus ? document.activeElement.getAttribute('aria-label') : '';
    const enteringCompanionDialog = !!companionModal && canvasAccessibilityControls.dataset.dialog !== 'companion';
    const leavingCompanionDialog = !companionModal && canvasAccessibilityControls.dataset.dialog === 'companion';
    if (enteringCompanionDialog) canvasModalReturnLabel = hadFocus ? activeLabel : '';
    if (canvasAccessibilityControls.dataset.signature !== signature) {
        canvasAccessibilityControls.replaceChildren();
        hits.forEach((hit, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.controlIndex = String(index);
            if (hit.node) button.dataset.mapNode = hit.node.id;
            button.setAttribute('aria-label', hit.ariaLabel + (hit.disabled ? ', недоступно' : ''));
            button.textContent = hit.ariaLabel;
            if (/^(Как играть|Включить звук|Выключить звук)/.test(hit.ariaLabel)) button.classList.add('icon-control');
            if (hit.disabled || locked) button.setAttribute('aria-disabled', 'true');
            if (hit.node && !hit.reachable) button.setAttribute('aria-disabled', 'true');
            button.addEventListener('click', () => activateCanvasHit(accessibleCanvasHits[index]));
            button.addEventListener('focus', () => {
                const currentHit = accessibleCanvasHits[index];
                if (currentHit && currentHit.mapTooltip) {
                    mapKeyboardNodeId = currentHit.mapTooltip;
                    return;
                }
                if (gameState !== STATES.STEP || !currentHit || !currentHit.node) {
                    mapKeyboardNodeId = null;
                    return;
                }
                mapKeyboardNodeId = currentHit.node.id;
                canvasMousePosition = null;
                mapIntroStartedAt = null;
                const position = mapLayout().pos[mapKeyboardNodeId];
                if (position && (position.y - mapScrollY < 40 || position.y - mapScrollY > UI.mapAreaH - 40)) {
                    mapScrollY = clamp(position.y - UI.mapAreaH / 2, 0, Math.max(0, mapLayout().height - UI.mapAreaH));
                }
            });
            button.addEventListener('blur', () => {
                if (!canvasAccessibilityControls.contains(document.activeElement)) mapKeyboardNodeId = null;
            });
            canvasAccessibilityControls.appendChild(button);
        });
        canvasAccessibilityControls.dataset.signature = signature;
        accessibleCanvasHits = hits;
        if (leavingCompanionDialog) {
            const returnIndex = canvasModalReturnLabel
                ? hits.findIndex(hit => hit.ariaLabel + (hit.disabled ? ', недоступно' : '') === canvasModalReturnLabel)
                : -1;
            if (returnIndex >= 0) canvasAccessibilityControls.children[returnIndex].focus();
            else if (document.activeElement && canvasAccessibilityControls.contains(document.activeElement)) document.activeElement.blur();
            canvasModalReturnLabel = '';
        } else if ((hadFocus || rulesOpen || enteringCompanionDialog) && canvasAccessibilityControls.children.length) {
            const restoredIndex = hits.findIndex(hit => hit.ariaLabel + (hit.disabled ? ', недоступно' : '') === activeLabel);
            let focusIndex = restoredIndex >= 0 ? restoredIndex : Math.max(0, Math.min(activeIndex, canvasAccessibilityControls.children.length - 1));
            if (enteringCompanionDialog) {
                const firstEnabled = hits.findIndex(hit => !hit.disabled);
                if (firstEnabled >= 0) focusIndex = firstEnabled;
            }
            canvasAccessibilityControls.children[focusIndex].focus();
        }
    }

    if (rulesOpen) {
        canvasAccessibilityControls.setAttribute('role', 'dialog');
        canvasAccessibilityControls.setAttribute('aria-modal', 'true');
        canvasAccessibilityControls.setAttribute('aria-label', 'Как играть');
        canvasAccessibilityControls.setAttribute('aria-describedby', 'canvas-accessibility-rules');
        if (canvasAccessibilityRules) {
            canvasAccessibilityRules.textContent = RULES
                .map(rule => decodeEntities(rule.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim())
                .join(' ');
            canvasAccessibilityRules.hidden = false;
        }
        canvasAccessibilityControls.dataset.dialog = 'rules';
    } else if (companionModal) {
        canvasAccessibilityControls.setAttribute('role', 'dialog');
        canvasAccessibilityControls.setAttribute('aria-modal', 'true');
            canvasAccessibilityControls.setAttribute('aria-label', companionModal.type === 'farewell' ? 'Решение о долге Роги' : 'Разговор с Роги');
        canvasAccessibilityControls.setAttribute('aria-describedby', 'canvas-accessibility-rules');
        canvasAccessibilityControls.dataset.dialog = 'companion';
        if (canvasAccessibilityRules) {
            canvasAccessibilityRules.textContent = companionModal.type === 'farewell'
                ? 'Роги не хватает ' + Math.max(0, companion.debt - companion.gold) + ' зол. Можно помочь ей сейчас или продолжить в одиночку.'
                : (companion.dialogueLine || companion.line);
            canvasAccessibilityRules.hidden = false;
        }
    } else {
        canvasAccessibilityControls.setAttribute('role', 'group');
        canvasAccessibilityControls.setAttribute('aria-label', 'Действия на игровом экране');
        canvasAccessibilityControls.removeAttribute('aria-modal');
        canvasAccessibilityControls.removeAttribute('aria-describedby');
        canvasAccessibilityControls.dataset.dialog = '';
        if (canvasAccessibilityRules) canvasAccessibilityRules.hidden = true;
    }

    accessibleCanvasHits = hits;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;
    Array.from(canvasAccessibilityControls.children).forEach((button, index) => {
        const hit = hits[index];
        if (!hit) return;
        button.style.left = (hit.x / VIEW_W * 100) + '%';
        button.style.top = (hit.y / VIEW_H * 100) + '%';
        button.style.width = Math.max(24 / width * 100, hit.w / VIEW_W * 100) + '%';
        button.style.height = Math.max(24 / height * 100, hit.h / VIEW_H * 100) + '%';
    });

    if (canvasAccessibilityStatus) {
        const stateKey = Object.keys(STATES).find(key => STATES[key] === gameState) || String(gameState);
        const stateNames = {
            INTRO: 'Главное меню', PROLOGUE: 'История перед первым забегом', STEP: 'Карта подземелья',
            CHOOSE: 'Выбор сундука', INVENTORY: 'Сумка со свитками', SHOP: 'Торговец',
            EVENT: 'Событие', CAMP: 'Лагерь', BOSS_GIFT: 'Награда босса',
            QUARTERMASTER: 'Квартирмейстер', GAME_OVER: 'Кампания завершена', VICTORY: 'Победа'
        };
        const message = rulesOpen ? 'Открыты правила игры.' : (messageModel.runs || []).map(run => run.text).join('').replace(/\s+/g, ' ').trim();
        const savedDust = gameState === STATES.INTRO || gameState === STATES.QUARTERMASTER ? meta.dust + ' пыли' : '';
        const status = [stateNames[stateKey] || stateKey, hp + ' из ' + maxHp + ' сердец', gold + ' зол.', savedDust, message].filter(Boolean).join('. ');
        if (canvasAccessibilityStatus.textContent !== status) canvasAccessibilityStatus.textContent = status;
    }
}

function handleCanvasClick(x, y) {
    const hit = canvasHitAt(x, y);
    if (rulesOpen) return activateCanvasHit(hit) || true;
    return hit ? activateCanvasHit(hit) : false;
}

/* Прокрутка карты колесом мыши */
function handleCanvasWheel(delta) {
    if (rulesOpen) {
        rulesScrollY = clamp(rulesScrollY + delta * 0.6, 0, rulesScrollMax);
    } else if (gameState === STATES.QUARTERMASTER) {
        quartermasterScrollY = clamp(quartermasterScrollY + delta * 0.6, 0, quartermasterScrollMax);
    } else if (gameState === STATES.STEP && map.length) {
        mapIntroStartedAt = null;
        const layout = mapLayout();
        const maxScroll = Math.max(0, layout.height - UI.mapAreaH);
        mapScrollY = clamp(mapScrollY + delta * 0.6, 0, maxScroll);
    }
}

function canvasPointCanScroll(x, y) {
    if (rulesOpen) return true;
    if (gameState === STATES.QUARTERMASTER) {
        const area = quartermasterScrollArea;
        return quartermasterScrollMax > 0 && x >= area.x && x <= area.x + area.w &&
            y >= area.y && y <= area.y + area.h;
    }
    return gameState === STATES.STEP && map.length && y >= UI.mapAreaY && y <= UI.mapAreaY + UI.mapAreaH;
}

function handleCanvasKeyScroll(key) {
    if (gameState === STATES.QUARTERMASTER) {
        if (key === 'Home') quartermasterScrollY = 0;
        else if (key === 'End') quartermasterScrollY = quartermasterScrollMax;
        else handleCanvasWheel(key === 'PageDown' ? 260 : key === 'PageUp' ? -260 :
            key === 'ArrowDown' ? 72 : -72);
        return;
    }
    handleCanvasWheel(key === 'PageDown' ? 240 : key === 'PageUp' ? -240 :
        key === 'ArrowDown' ? 70 : -70);
}

function handleCanvasDrag(delta, y) {
    if (rulesOpen) {
        rulesScrollY = clamp(rulesScrollY + delta, 0, rulesScrollMax);
    } else if (gameState === STATES.QUARTERMASTER) {
        quartermasterScrollY = clamp(quartermasterScrollY + delta, 0, quartermasterScrollMax);
    } else if (gameState === STATES.STEP && map.length &&
        y >= UI.mapAreaY && y <= UI.mapAreaY + UI.mapAreaH) {
        mapIntroStartedAt = null;
        const layout = mapLayout();
        const maxScroll = Math.max(0, layout.height - UI.mapAreaH);
        mapScrollY = clamp(mapScrollY + delta, 0, maxScroll);
    }
}
