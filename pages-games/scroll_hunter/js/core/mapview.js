/* ================================================================
   SCROLL HUNTER · core/mapview.js
   Отрисовка карты этапа в SVG: ветвления, пройденный путь,
   доступные узлы, подсказки и клики мышью.
   ================================================================ */
'use strict';

const MAP_ROW_H = 58;
let MAP_NODE_R = 15;
let mapLayoutCache = null;

function mapNodeRadius(node) {
    return Math.round(MAP_NODE_R * (node.type === 'BOSS' ? 1.65 : 1));
}

function iconBody(type) {
    const svg = ICONS[type] || ICONS.FIGHT;
    return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

/* Раскладка по слоям: топология остаётся прежней, а комнаты сдвигаются
   по горизонтали к середине своих входящих и исходящих маршрутов. */
function projectMapRow(row, desired, minGap, maxSlot) {
    if (row.length < 2) return desired.map(value => clamp(value, 0, maxSlot));

    const gap = Math.min(minGap, maxSlot / (row.length - 1));
    const maxOffset = maxSlot - gap * (row.length - 1);
    const blocks = [];

    /* Изотоническая проекция: держим исходный порядок узлов и зазор между ними. */
    desired.forEach((value, index) => {
        blocks.push({ start: index, end: index, sum: value - index * gap, count: 1 });
        while (blocks.length > 1) {
            const right = blocks[blocks.length - 1];
            const left = blocks[blocks.length - 2];
            if (left.sum / left.count <= right.sum / right.count) break;
            blocks.splice(blocks.length - 2, 2, {
                start: left.start,
                end: right.end,
                sum: left.sum + right.sum,
                count: left.count + right.count
            });
        }
    });

    const result = new Array(row.length);
    blocks.forEach(block => {
        const value = clamp(block.sum / block.count, 0, maxOffset);
        for (let i = block.start; i <= block.end; i++) result[i] = value + i * gap;
    });
    return result;
}

function smoothMapColumns(rows, step) {
    const maxSlot = MAP_WIDTH - 1;
    const base = Object.create(null);
    const slots = Object.create(null);
    const incoming = Object.create(null);

    rows.forEach(row => row.forEach((node, index) => {
        const col = typeof node.col === 'number' ? node.col : index;
        base[node.id] = clamp(col, 0, maxSlot);
        slots[node.id] = base[node.id];
        node.next.forEach(nextId => {
            if (!incoming[nextId]) incoming[nextId] = [];
            incoming[nextId].push(node.id);
        });
    }));

    // Частые связи не должны стягивать всю сеть в узкий центральный столбик.
    const minGap = Math.max(0.9, (MAP_NODE_R * 2 + 10) / Math.max(1, step));
    for (let sweep = 0; sweep < 8; sweep++) {
        const order = sweep % 2 ? rows.slice().reverse() : rows;
        order.forEach(row => {
            const desired = row.map(node => {
                const neighbors = (incoming[node.id] || []).concat(node.next);
                if (!neighbors.length) return base[node.id];

                const values = neighbors.map(id => slots[id]).filter(value => typeof value === 'number');
                if (!values.length) return base[node.id];
                const center = values.reduce((sum, value) => sum + value, 0) / values.length;
                const spread = Math.max.apply(null, values) - Math.min.apply(null, values);
                const anchor = values.length === 1 ? 0.42 : spread < 0.35 ? 0.025 : spread < 1.5 ? 0.12 : 0.22;
                return center * (1 - anchor) + base[node.id] * anchor;
            });

            const fitted = projectMapRow(row, desired, minGap, maxSlot);
            row.forEach((node, index) => { slots[node.id] = fitted[index]; });
        });
    }
    return slots;
}

/* Укладываем соседние этажи по среднему соседей, сглаживая резкие зигзаги. */
function mapLayout() {
    const rows = map.length;
    const edge = Math.max(MAP_NODE_R * 2 + 20, Math.min(130, VIEW_W * 0.09));
    const endPad = Math.round(MAP_NODE_R * 1.65) + 24;
    const bossGap = 22;
    const LEFT = edge;
    const RIGHT = VIEW_W - edge;
    const STEP = (RIGHT - LEFT) / (MAP_WIDTH - 1);

    if (mapLayoutCache && mapLayoutCache.map === map &&
        mapLayoutCache.width === VIEW_W && mapLayoutCache.radius === MAP_NODE_R) {
        return mapLayoutCache.layout;
    }

    const pos = {};
    const slots = smoothMapColumns(map, STEP);

    /* кто в кого входит — чтобы развести веер входящих связей */
    const incoming = {};
    map.forEach(row => row.forEach(node => {
        node.next.forEach(nid => {
            if (!incoming[nid]) incoming[nid] = [];
            incoming[nid].push(node.id);
        });
    }));

    map.forEach((row, r) => {
        /* Row zero is the entrance; each later row sits higher on screen. */
        const y = endPad + (rows - 1 - r) * MAP_ROW_H + (r < rows - 1 ? bossGap : 0);
        row.forEach((node, i) => {
            const col = typeof slots[node.id] === 'number' ? slots[node.id] : i;
            const parents = (incoming[node.id] || []).slice();
            parents.sort((a, b) => (pos[a] ? pos[a].x : 0) - (pos[b] ? pos[b].x : 0));
            const fan = parents.map(pid => {
                const k = parents.indexOf(pid);
                return parents.length > 1 ? (k - (parents.length - 1) / 2) * 15 : 0;
            });

            pos[node.id] = {
                x: LEFT + col * STEP,
                radius: mapNodeRadius(node),
                parents: parents,
                y: y,
                idx: col,
                count: 1,
                out: node.next.length,
                fan: fan
            };
        });
    });
    const layout = { pos: pos, height: endPad * 2 + bossGap + Math.max(0, rows - 1) * MAP_ROW_H };
    mapLayoutCache = { map: map, width: VIEW_W, radius: MAP_NODE_R, layout: layout };
    return layout;
}

function mapAncestors(nodeId) {
    const positions = mapLayout().pos;
    const result = new Set();
    const pending = nodeId ? [nodeId] : [];
    while (pending.length) {
        const id = pending.pop();
        if (result.has(id) || !positions[id]) continue;
        result.add(id);
        pending.push(...positions[id].parents);
    }
    return result;
}

function renderMap() {
    if (!ui.map) return;
    if (!map.length) { ui.map.innerHTML = ''; return; }

    const layout = mapLayout();
    const pos = layout.pos;
    const reachable = attemptOver ? [] : reachableNodes(map, currentNodeId);
    const W = VIEW_W;

    let links = '';
    let nodes = '';

    map.forEach((row, r) => {
        row.forEach(node => {
            const a = pos[node.id];

            node.next.forEach((nid, k) => {
                const b = pos[nid];
                if (!b) return;
                const mid = (a.y + b.y) / 2;
                const done = visitedNodes.has(node.id) && visitedNodes.has(nid);
                const live = node.id === currentNodeId || (visitedNodes.has(node.id) && reachable.includes(nid));
                const sp = a.out > 1 ? (k - (a.out - 1) / 2) * 15 : 0;
                const sp2 = b.fan && b.fan.length ? (b.fan[Math.min(k, b.fan.length - 1)] || 0) : 0;
                links += '<path d="M' + (a.x + sp) + ' ' + (a.y - a.radius) +
                    ' C ' + (a.x + sp) + ' ' + mid + ', ' + (b.x + sp2) + ' ' + mid + ', ' + (b.x + sp2) + ' ' + (b.y + b.radius) +
                    '" class="map-link' + (done ? ' done' : '') + (live ? ' live' : '') + '"/>';
            });

            const type = node.type;
            const cls = ['map-node'];
            if (visitedNodes.has(node.id)) cls.push('visited');
            if (node.id === currentNodeId) cls.push('current');
            if (reachable.includes(node.id)) cls.push('reachable');

            const title = (ROOM_TYPES[type] || ROOM_TYPES.FIGHT);
            const label = '<title>' + title.name + ' — ' + title.desc + '</title>';

            nodes += '<g class="' + cls.join(' ') + '" data-node="' + node.id + '" transform="translate(' + a.x + ',' + a.y + ')">' +
                label +
                '<circle class="map-disc" r="' + mapNodeRadius(node) + '"/>' +
                '<circle class="map-ring" r="' + (mapNodeRadius(node) + 3) + '"/>' +
                '<g class="map-glyph" transform="translate(-11,-11)">' + iconBody(type) + '</g>' +
                '</g>';
        });

    });

    const svg = '<svg class="map-svg" viewBox="0 0 ' + W + ' ' + layout.height + '" ' +
        'preserveAspectRatio="xMidYMin meet" role="img" aria-label="Карта подземелья">' +
        '<g class="map-links">' + links + '</g>' +
        '<g class="map-nodes">' + nodes + '</g>' +
        '</svg>';

    ui.map.innerHTML = svg;
    ui.map.classList.toggle('empty', false);

    const cur = ui.map.querySelector('.map-node.current');
    if (cur && typeof cur.scrollIntoView === 'function') {
        try {
            cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch (e) {
            ui.map.scrollTop = Math.max(0, cur.offsetTop - ui.map.clientHeight / 2);
        }
    }
}

function bindMapInteraction() {
    if (!ui.map) return;
    ui.map.addEventListener('click', (e) => {
        const g = e.target.closest ? e.target.closest('[data-node]') : null;
        if (!g) return;
        if (attemptOver) return;
        const id = g.getAttribute('data-node');
        const reachable = reachableNodes(map, currentNodeId);
        if (!reachable.includes(id)) return;
        Sfx.play('click');
        chooseNode(id);
    });
}
