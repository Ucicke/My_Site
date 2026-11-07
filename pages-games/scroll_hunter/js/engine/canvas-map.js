/* ================================================================
   SCROLL HUNTER · engine/canvas-map.js
   Отрисовка карты, подсказок узлов и прокрутки маршрута.
   ================================================================ */
'use strict';

function mapPositionScroll(nodeId, areaH) {
    const layout = mapLayout();
    const node = nodeById(map, nodeId);
    const ids = [nodeId].concat(node && !attemptOver ? node.next : []);
    const positions = ids.map(id => layout.pos[id]).filter(Boolean);
    if (!positions.length) return 0;
    const top = Math.min(...positions.map(p => p.y - p.radius - 36));
    const bottom = Math.max(...positions.map(p => p.y + p.radius + 24));
    return clamp((top + bottom) / 2 + 18 - areaH / 2, 0, Math.max(0, layout.height - areaH));
}

function mapApproachNodes(nodeId) {
    const ancestors = mapAncestors(nodeId);
    if (!currentNodeId) return ancestors;
    const possible = new Set();
    const pending = [currentNodeId];
    const nodes = new Map(map.flat().map(node => [node.id, node]));
    while (pending.length) {
        const id = pending.pop();
        if (possible.has(id)) continue;
        possible.add(id);
        const node = nodes.get(id);
        if (node) pending.push(...node.next);
    }
    return new Set([...ancestors].filter(id => possible.has(id)));
}

function drawMapCanvas(t) {
    if (!map.length) return;
    const areaY = UI.mapAreaY;
    const areaH = UI.mapAreaH;
    const layout = mapLayout();
    const pos = layout.pos;
    const reachable = attemptOver ? [] : reachableNodes(map, currentNodeId);
    const reducedMotion = typeof prefersReducedMotion === 'function' && prefersReducedMotion();
    const time = reducedMotion ? 0 : (t || 0);

    if (mapLayoutSource !== map) {
        mapLayoutSource = map;
        mapIntroStartedAt = !reducedMotion && !currentNodeId && !attemptOver ? performance.now() : null;
        mapFocusNodeId = '__unset__';
        mapScrollY = 0;
        mapPreviewNodeId = null;
        mapMessageExpanded = false;
    }

    const maxScroll = Math.max(0, layout.height - areaH);
    const cur = currentNodeId ? pos[currentNodeId] : null;
    const viewportKey = VIEW_W + ':' + areaH;
    if (currentNodeId !== mapFocusNodeId || (cur && viewportKey !== mapFocusViewport)) {
        if (currentNodeId) mapIntroStartedAt = null;
        mapFocusNodeId = currentNodeId;
        mapPreviewNodeId = null;
        mapKeyboardNodeId = null;
        mapScrollY = cur ? mapPositionScroll(currentNodeId, areaH) : maxScroll;
        mapFocusViewport = viewportKey;
    }
    if (mapIntroStartedAt !== null) {
        const progress = reducedMotion ? 1 : clamp((performance.now() - mapIntroStartedAt - 250) / 1600, 0, 1);
        mapScrollY = maxScroll * progress * progress * (3 - 2 * progress);
        if (progress >= 1) mapIntroStartedAt = null;
    }
    mapScrollY = clamp(mapScrollY, 0, maxScroll);
    const offY = areaY + 18 - mapScrollY;

    /* Low-contrast generated slate texture; routes and room symbols remain code-drawn. */
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, areaY, VIEW_W, areaH);
    ctx.clip();
    drawMapAtmosphere(areaY, areaH, time, reducedMotion);

    const hoveredNodeId = findHoveredMapNode(pos, offY, areaY, areaH);
    const inspectedNodeId = hoveredNodeId || mapKeyboardNodeId || mapPreviewNodeId;
    const approachNodes = mapApproachNodes(inspectedNodeId);


    drawMapRoutes(pos, offY, areaY, areaH, reachable, approachNodes, inspectedNodeId);

    drawMapNodes(pos, offY, areaY, areaH, reachable, hoveredNodeId, inspectedNodeId, approachNodes);

    drawMapStartHint(pos, offY, areaY, maxScroll);

    ctx.restore();

    const inspected = inspectedNodeId && map.flat().find(node => node.id === inspectedNodeId);
    mapHoverCard = null;
    if (inspected) {
        const a = pos[inspected.id];
        drawMapNodeTooltip(inspected, a.x, a.y + offY, areaY, areaH, time);
    }

    if (cur) {
        const currentY = cur.y + offY;
        const nextVisible = reachable.every(id => pos[id] && pos[id].y + offY > areaY + 35 && pos[id].y + offY < areaY + areaH - 24);
        if (currentY < areaY + 45 || currentY > areaY + areaH - 24 || !nextVisible) {
            const returnBox = { x: VIEW_W - 156, y: areaY + 43, w: 138, h: 30 };
            const hover = drawCommonButton(returnBox, BTN_STYLE['btn-ghost'], false, 8);
            drawText('К ТЕКУЩЕЙ ТОЧКЕ', returnBox.x + returnBox.w / 2, returnBox.y + 15,
                '800 8px Manrope, Inter, sans-serif', hover ? '#f4d9a7' : UIC.gold, 'center', 'middle');
            canvasHits.push({ x: returnBox.x, y: returnBox.y, w: returnBox.w, h: returnBox.h,
                ariaLabel: 'Вернуться к текущей комнате',
                action: () => { mapScrollY = mapPositionScroll(currentNodeId, areaH); } });
        }
    }

    if (maxScroll > 4) {
        const barH = areaH * (areaH / layout.height);
        const barY = areaY + (areaH - barH) * (mapScrollY / maxScroll);
        fillRound(VIEW_W - 7, areaY, 3, areaH, 1.5, 'rgba(217,158,58,0.08)');
        fillRound(VIEW_W - 8, barY, 5, Math.max(22, barH), 2.5, 'rgba(229,181,101,0.55)');
    }

    ctx.strokeStyle = 'rgba(217,158,58,0.22)';
    ctx.beginPath();
    ctx.moveTo(0, areaY + areaH + 0.5);
    ctx.lineTo(VIEW_W, areaY + areaH + 0.5);
    ctx.stroke();
}

function drawMapAtmosphere(areaY, areaH, time, reducedMotion) {
    ctx.fillStyle = 'rgba(5,8,14,0.28)';
    ctx.fillRect(0, areaY, VIEW_W, areaH);
    const centerShade = ctx.createRadialGradient(VIEW_W / 2, areaY + areaH * 0.48, 30,
        VIEW_W / 2, areaY + areaH * 0.48, Math.max(VIEW_W, areaH) * 0.72);
    centerShade.addColorStop(0, 'rgba(5,9,16,0.10)');
    centerShade.addColorStop(1, 'rgba(3,6,12,0.62)');
    ctx.fillStyle = centerShade;
    ctx.fillRect(0, areaY, VIEW_W, areaH);

    /* Restrained torch light and slow motes, omitted for reduced motion. */
    const flicker = reducedMotion ? 0 : Math.sin(time * 0.75) * 0.006;
    [0.12, 0.88].forEach((rx, index) => {
        const cx = VIEW_W * rx;
        const cy = areaY + areaH * 0.28;
        const radius = Math.min(VIEW_W * 0.22, areaH * 0.58);
        const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
        const alpha = 0.045 + (index ? -flicker : flicker);
        glow.addColorStop(0, 'rgba(220,151,72,' + alpha.toFixed(3) + ')');
        glow.addColorStop(0.44, 'rgba(169,105,52,0.018)');
        glow.addColorStop(1, 'rgba(169,105,52,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    });
    if (!reducedMotion) {
        const motes = [
            [0.18, 0.72, 0.014, 0.2], [0.38, 0.48, 0.011, 0.63],
            [0.66, 0.78, 0.013, 0.41], [0.83, 0.35, 0.010, 0.86], [0.52, 0.22, 0.009, 0.12]
        ];
        ctx.save();
        motes.forEach(([x, y, size, phase]) => {
            const drift = Math.sin(time * 0.24 + phase * 12) * 5;
            const rise = ((time * 0.012 + phase) % 1) * areaH * 0.22;
            ctx.globalAlpha = 0.11 + Math.sin(time * 0.8 + phase * 8) * 0.025;
            ctx.fillStyle = '#e5bb77';
            ctx.beginPath();
            ctx.arc(VIEW_W * x + drift, areaY + areaH * y - rise, 0.75 + size * 18, 0, TAU);
            ctx.fill();
        });
        ctx.restore();
    }
}

function findHoveredMapNode(pos, offY, areaY, areaH) {
    let hoveredNodeId = null;
    if (canvasLastPointerType !== 'touch' && canvasMousePosition &&
        canvasMousePosition.y >= areaY && canvasMousePosition.y <= areaY + areaH) {
        const heldCard = mapHoverCard && mapHoverCard.map === map &&
            mapHoverCard.scrollY === mapScrollY && mapHoverCard.width === VIEW_W &&
            mapHoverCard.areaY === areaY && mapHoverCard.areaH === areaH ? mapHoverCard : null;
        // The card is above the map: nodes behind it must not steal its hover.
        if (heldCard && pointInside(heldCard.box, canvasMousePosition)) {
            hoveredNodeId = heldCard.nodeId;
        } else map.some(row => row.some(node => {
            const a = pos[node.id];
            const box = { x: a.x - a.radius - 5, y: a.y + offY - a.radius - 5,
                w: a.radius * 2 + 10, h: a.radius * 2 + 10 };
            if (!pointInside(box, canvasMousePosition)) return false;
            hoveredNodeId = node.id;
            return true;
        }));
        if (!hoveredNodeId && heldCard && pointInside(heldCard.bridge, canvasMousePosition)) {
            hoveredNodeId = heldCard.nodeId;
        }
    }
    return hoveredNodeId;
}

function drawMapRoutes(pos, offY, areaY, areaH, reachable, approachNodes, inspectedNodeId) {
    map.forEach(row => row.forEach(node => {
        const a = pos[node.id];
        if (!a) return;
        node.next.forEach((nid, k) => {
            const b = pos[nid];
            if (!b) return;
            const done = visitedNodes.has(node.id) && visitedNodes.has(nid);
            const live = !attemptOver && node.id === currentNodeId && reachable.includes(nid);
            const focusRoute = approachNodes.has(node.id) && approachNodes.has(nid);
            const ay = a.y + offY, by = b.y + offY;
            if (by < areaY - 40 || ay > areaY + areaH + 40) return;
            const mid = (ay + by) / 2;
            const sp = a.out > 1 ? (k - (a.out - 1) / 2) * 15 : 0;
            const sp2 = (b.fan && b.fan.length) ? (b.fan[Math.min(k, b.fan.length - 1)] || 0) : 0;
            ctx.save();
            if (inspectedNodeId && !focusRoute) ctx.globalAlpha = 0.82;
            ctx.beginPath();
            ctx.moveTo(a.x + sp, ay - a.radius + 1);
            ctx.bezierCurveTo(a.x + sp, mid, b.x + sp2, mid, b.x + sp2, by + b.radius - 1);
            ctx.lineCap = 'round';
            if (focusRoute) {
                ctx.shadowColor = 'rgba(241,191,108,0.58)';
                ctx.shadowBlur = 10;
            }
            ctx.strokeStyle = focusRoute ? 'rgba(245,205,133,0.92)' :
                done ? 'rgba(137,177,151,0.80)' : live ? 'rgba(239,193,116,0.95)' : 'rgba(203,164,109,0.64)';
            ctx.lineWidth = focusRoute ? 3 : done || live ? 2.6 : 2;
            ctx.stroke();
            ctx.restore();
        });
    }));
}

function drawMapNodes(pos, offY, areaY, areaH, reachable, hoveredNodeId, inspectedNodeId, approachNodes) {
    map.forEach((row, r) => {
        const firstPos = row[0] && pos[row[0].id];
        const rowY = (firstPos ? firstPos.y : 0) + offY;
        if (rowY < areaY - 40 || rowY > areaY + areaH + 40) return;
        row.forEach(node => {
            const a = pos[node.id];
            if (!a) return;
            const x = a.x, cy = a.y + offY;
            const radius = a.radius;
            const isCur = node.id === currentNodeId;
            const isReach = reachable.includes(node.id);
            const isVisited = visitedNodes.has(node.id);
            const active = isReach && !attemptOver;
            const title = ROOM_TYPES[node.type] || ROOM_TYPES.FIGHT;
            const nodeBox = { x: x - radius - 5, y: cy - radius - 5,
                w: radius * 2 + 10, h: radius * 2 + 10 };
            const hovered = node.id === hoveredNodeId || node.id === mapPreviewNodeId || node.id === mapKeyboardNodeId;
            const onApproach = approachNodes.has(node.id);
            ctx.save();
            if (inspectedNodeId && !onApproach && !isCur && !active) ctx.globalAlpha = 0.9;

            const starting = active && r === 0 && !currentNodeId;
            const pulse = 0.6;
            if (starting) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, cy, radius + 5 + pulse * 4, 0, TAU);
                ctx.strokeStyle = 'rgba(255,207,101,' + (0.28 + pulse * 0.42) + ')';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#e9ad40';
                ctx.shadowBlur = 9;
                ctx.stroke();
                ctx.restore();
            }
            ctx.save();
            if (active || isCur || onApproach) {
                ctx.shadowBlur = hovered ? 18 : 9;
                ctx.shadowColor = hovered ? 'rgba(237,190,111,0.52)' : 'rgba(217,158,58,0.24)';
            }
            ctx.beginPath();
            ctx.arc(x, cy, radius, 0, TAU);
            const disc = ctx.createRadialGradient(x - radius * 0.25, cy - radius * 0.34, 1,
                x, cy, radius * 1.25);
            disc.addColorStop(0, isCur ? 'rgba(68,52,32,0.98)' : hovered ? 'rgba(57,43,27,0.98)' :
                active ? 'rgba(42,37,29,0.96)' : isVisited ? 'rgba(23,32,34,0.88)' : 'rgba(13,20,29,0.92)');
            disc.addColorStop(1, 'rgba(7,11,17,0.98)');
            ctx.fillStyle = disc;
            ctx.fill();
            ctx.strokeStyle = isCur || hovered || onApproach ? '#ecc27b' : active ? 'rgba(226,178,102,0.86)' :
                isVisited ? 'rgba(119,161,139,0.78)' : 'rgba(199,165,112,0.64)';
            ctx.lineWidth = isCur || hovered ? 2.7 : active ? 2.2 : 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, cy, radius - 4, 0, TAU);
            ctx.strokeStyle = active || isCur ? 'rgba(232,189,116,0.25)' : 'rgba(210,190,151,0.10)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();

            if (hovered && active) {
                ctx.beginPath();
                ctx.arc(x, cy, radius + 5, 0, TAU);
                ctx.strokeStyle = 'rgba(217,158,58,0.48)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            if (active && canvasPressPoint && pointInside(nodeBox, canvasPressPoint)) {
                ctx.beginPath();
                ctx.arc(x, cy, radius - 2, 0, TAU);
                ctx.fillStyle = 'rgba(240,191,102,0.16)';
                ctx.fill();
            }
            if (isCur) {
                ctx.beginPath();
                ctx.arc(x, cy, radius + 5, 0, TAU);
                ctx.strokeStyle = 'rgba(255,215,106,0.62)';
                ctx.lineWidth = 2.2;
                ctx.stroke();
                ctx.save();
                ctx.translate(x, cy - radius - 8);
                ctx.rotate(Math.PI / 4);
                fillRound(-4, -4, 8, 8, 1, '#edc477', 'rgba(255,238,197,0.72)');
                ctx.restore();
            }

            const iconSize = node.type === 'BOSS' ? 36 : 24;
            drawSvgIcon(ICONS[node.type] || ICONS.FIGHT, x - iconSize / 2, cy - iconSize / 2, iconSize,
                isCur || hovered || onApproach ? '#f7dfaa' : active ? (title.color || UIC.gold) :
                    isVisited ? 'rgba(186,205,189,0.90)' : 'rgba(235,224,203,0.84)');

            if (isVisited && !isCur) {
                ctx.beginPath();
                ctx.arc(x + radius * 0.72, cy + radius * 0.7, 6, 0, TAU);
                ctx.fillStyle = 'rgba(19,39,33,0.98)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(112,181,143,0.82)';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + radius * 0.72 - 2.5, cy + radius * 0.7);
                ctx.lineTo(x + radius * 0.72 - 0.5, cy + radius * 0.7 + 2);
                ctx.lineTo(x + radius * 0.72 + 3, cy + radius * 0.7 - 2.5);
                ctx.strokeStyle = '#a6d6b3';
                ctx.lineWidth = 1.3;
                ctx.stroke();
            }
            if (isCur) {
                const candidates = [
                    { x: x - radius - 94, y: cy - 9 },
                    { x: x + radius + 12, y: cy - 9 },
                    { x: x - 41, y: cy + radius + 7 },
                    { x: x - 41, y: cy - radius - 27 }
                ];
                const label = candidates.find(box => box.x >= 8 && box.x + 82 <= VIEW_W - 8 &&
                    box.y >= areaY + 4 && box.y + 18 <= areaY + areaH - 4 &&
                    !Object.entries(pos).some(([id, p]) => id !== currentNodeId &&
                        box.x < p.x + p.radius + 5 && box.x + 82 > p.x - p.radius - 5 &&
                        box.y < p.y + offY + p.radius + 5 && box.y + 18 > p.y + offY - p.radius - 5)) ||
                    { x: clamp(x - radius - 94, 8, VIEW_W - 90), y: cy - 9 };
                fillRound(label.x, label.y, 82, 18, 6,
                    'rgba(31,25,18,0.94)', 'rgba(217,158,58,0.48)');
                drawText('ВЫ ЗДЕСЬ', label.x + 41, label.y + 9, '800 9px Manrope, Inter, sans-serif',
                    '#f0d39a', 'center', 'middle');
            }

            canvasHits.push({ x: nodeBox.x, y: nodeBox.y, w: nodeBox.w, h: nodeBox.h,
                ariaLabel: 'Этаж ' + (r + 1) + ': ' + title.name +
                    (isCur ? ', ваша позиция' : isReach ? ', доступно для выбора' : isVisited ? ', пройдено' : ', дальше по маршруту'),
                node: node, reachable: isReach, map: true, disabled: !isReach || attemptOver });
            ctx.restore();
        });
    });
}

function drawMapStartHint(pos, offY, areaY, maxScroll) {
    if (mapStartHintVisible && !currentNodeId && !attemptOver && mapIntroStartedAt === null && mapScrollY >= maxScroll - 45) {
        if (!tutorial.mapStartHintSeen) {
            tutorial.mapStartHintSeen = true;
            persist();
        }
        const entranceTop = Math.min(...map[0].map(node => pos[node.id].y + offY - pos[node.id].radius));
        const entranceCenter = map[0].reduce((sum, node) => sum + pos[node.id].x, 0) / map[0].length;
        drawText('Выберите первый путь', clamp(entranceCenter, 115, VIEW_W - 115), Math.max(areaY + 20, entranceTop - 22),
            '600 17px Inter, sans-serif', '#f1cd83', 'center', 'middle');

    }
}

function drawMapPageBackground() {
    ctx.save();
    ctx.fillStyle = '#080d17';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (drawImageCover(mapBackgroundImage, 0, 0, VIEW_W, VIEW_H)) {
        ctx.fillStyle = 'rgba(4,7,13,0.52)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.restore();
}

function drawMapNodeTooltip(node, anchorX, anchorY, areaY, areaH) {
    const room = ROOM_TYPES[node.type] || ROOM_TYPES.FIGHT;
    const reachable = !attemptOver && reachableNodes(map, currentNodeId).includes(node.id);
    const visited = visitedNodes.has(node.id);
    const current = node.id === currentNodeId;
    const narrow = VIEW_W < 500;
    const boxW = Math.min(narrow ? 260 : 280, VIEW_W - 24);
    const hasEnter = reachable && !current;
    const descLines = quartermasterTextLines(room.mapSummary || room.desc, '500 13px Inter, system-ui, sans-serif', boxW - 26, 2);
    const boxH = 54 + descLines.length * 16 + (room.risk ? 18 : 0) + (hasEnter ? 43 : 8);
    const radius = mapNodeRadius(node) + 8;
    const candidateXs = [anchorX + radius + 7, anchorX - radius - boxW - 7];
    const boxY = clamp(anchorY - boxH / 2, areaY + 8, Math.max(areaY + 8, areaY + areaH - boxH - 8));
    const positions = mapLayout().pos;
    const score = candidateX => Object.entries(positions).reduce((sum, [id, p]) => {
        if (id === node.id) return sum;
        const py = p.y + areaY + 18 - mapScrollY;
        return sum + (candidateX < p.x + p.radius && candidateX + boxW > p.x - p.radius &&
            boxY < py + p.radius && boxY + boxH > py - p.radius ? 1 : 0);
    }, 0);
    const candidates = candidateXs.filter(value => value >= 10 && value + boxW <= VIEW_W - 10);
    const boxX = candidates.length ? candidates.sort((a, b) => score(a) - score(b))[0] :
        clamp(anchorX + radius + 7, 10, Math.max(10, VIEW_W - boxW - 10));
    const cardBox = { x: boxX, y: boxY, w: boxW, h: boxH };
    const nearX = clamp(anchorX, boxX, boxX + boxW);
    mapHoverCard = { nodeId: node.id, map, scrollY: mapScrollY, width: VIEW_W, areaY, areaH,
        box: { x: boxX - 3, y: boxY - 3, w: boxW + 6, h: boxH + 6 },
        bridge: { x: Math.min(anchorX, nearX) - 4, y: anchorY - radius,
            w: Math.abs(nearX - anchorX) + 8, h: radius * 2 } };
    // Consume clicks on the card itself instead of activating a node behind it.
    canvasHits.push({ ...cardBox, disabled: true });
    fillRound(boxX, boxY, boxW, boxH, 12, 'rgba(8,12,19,0.97)',
        current ? 'rgba(239,194,116,0.72)' : reachable ? 'rgba(217,158,58,0.56)' : 'rgba(165,151,128,0.30)', 1.2);
    const status = current ? 'Вы здесь' : reachable ? 'Доступна' : visited ? 'Пройдено' : '';
    drawText(room.mapName || room.name, boxX + 13, boxY + 20,
        '800 16px Manrope, Inter, sans-serif', UIC.text, 'left', 'middle');
    drawText('Этаж ' + (node.row + 1) + (status ? ' · ' + status : ''), boxX + 13, boxY + 39,
        '500 11px Inter, sans-serif', '#bdae97', 'left', 'middle');
    descLines.forEach((line, index) => drawText(line, boxX + 13, boxY + 60 + index * 16,
        '500 13px Inter, sans-serif', '#d6cbb9', 'left', 'middle'));
    if (room.risk) {
        drawText('Риск: ' + room.risk, boxX + 13, boxY + 57 + descLines.length * 16 + 5,
            '600 11px Inter, sans-serif', '#caae7d', 'left', 'middle');
    }

    if (hasEnter) {
        const enterBox = { x: boxX + boxW - 153, y: boxY + boxH - 38, w: 140, h: 30 };
        const hover = drawCommonButton(enterBox, BTN_STYLE['btn-gold'], false, 7);
        drawText('Войти в комнату  ›', enterBox.x + enterBox.w / 2, enterBox.y + 15,
            '800 10px Manrope, Inter, sans-serif', hover ? '#f4d9a7' : UIC.gold, 'center', 'middle');
        canvasHits.push({ x: enterBox.x, y: enterBox.y, w: enterBox.w, h: enterBox.h,
            ariaLabel: 'Войти в комнату ' + room.name, mapTooltip: node.id,
            action: () => { mapPreviewNodeId = null; chooseNode(node.id); } });
    }
}

