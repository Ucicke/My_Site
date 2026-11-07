/* ================================================================
   SCROLL HUNTER · core/map.js
   Карта подземелья: сетка 7 в ширину и 15 в высоту, пути строятся
   снизу вверх и гарантированно ведут к логову предводителя.
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   Сетка карты
   --------------------------------------------------------------- */
const MAP_WIDTH = 7;        // комнат в ряду
const MAP_CENTER = 3;       // центральный столбец (куда стягиваются пути)
const ELITE_MIN_FLOOR = 5;  // элита не появляется выше этого этажа

/* Гарантированный минимум комнат на акт */
const ROOM_MINIMUMS = {
    ELITE: 3,
    SHOP: 2,
    EVENT: 2,
    TREASURE: 3,
    DIG: 2,
    CAMP: 2
};

/* ---------------------------------------------------------------
   Карта этапа
   --------------------------------------------------------------- */
function generateStageMap(stage) {
    const height = stageLevels();          // этажей сетки (15 + улучшения)
    const paths = buildPaths(height);      // пути снизу вверх
    const rows = buildRows(height, paths); // узлы и связи
    connectMapBranches(rows);
    assignTypes(rows, height, stage);      // содержимое комнат

    /* Логово предводителя — отдельным этажом над сеткой */
    const bossId = height + '-' + MAP_CENTER;
    const top = rows[height - 1][0];
    if (top) top.next = [bossId];
    rows.push([{
        id: bossId,
        row: height,
        col: MAP_CENTER,
        type: 'BOSS',
        next: [],
        visited: false
    }]);

    return rows;
}

/* ---------------------------------------------------------------
   Пути: строим их снизу вверх, каждый шаг — строго вверх
   --------------------------------------------------------------- */
function buildPaths(height) {
    /* Внизу — от 3 до 5 начальных комнат */
    const all = [];
    for (let i = 0; i < MAP_WIDTH; i++) all.push(i);
    const starts = shuffleIn('map', all).slice(0, randIntIn('map', 3, 5)).sort((a, b) => a - b);

    const paths = starts.map(c => [c]);
    const lastSharedByPath = starts.map(() => 0);
    const hasSharedByPath = starts.map(() => false);
    let lastMergeFloor = -2;

    for (let y = 1; y < height; y++) {
        const lo = MAP_CENTER - spanAt(y, height);
        const hi = MAP_CENTER + spanAt(y, height);
        const prev = paths.map(p => p[y - 1]);
        const last = (y === height - 1);
        const rowCapacity = Math.min(paths.length, hi - lo + 1);
        const overduePath = lastSharedByPath.some(floor => y - floor >= 4);
        const mergeDue = y < height - 2 && (y - lastMergeFloor >= 2 || overduePath);
        const targetNodes = Math.max(1, rowCapacity - (mergeDue ? 1 : 0));
        const sharePriority = lastSharedByPath.map(floor => y - floor);

        /* На слиянии перед боссом все пути сходятся в одну точку */
        const cols = last
            ? prev.map(() => MAP_CENTER)
            : solveFloor(prev, lo, hi, y, height, targetNodes, sharePriority, hasSharedByPath);

        paths.forEach((path, i) => { path[y] = cols[i]; });
        if (!last && new Set(cols).size < rowCapacity) lastMergeFloor = y;
        if (!last) {
            const groups = {};
            cols.forEach((col, i) => {
                if (!groups[col]) groups[col] = [];
                groups[col].push(i);
            });
            for (const col in groups) {
                if (groups[col].length > 1) groups[col].forEach(i => {
                    lastSharedByPath[i] = y;
                    hasSharedByPath[i] = true;
                });
            }
        }
    }
    return paths;
}

/* Раскладка путей на одном этаже.
   Ограничения: шаг не больше чем на столбец, порядок путей не меняется
   (крест-накрест не пересекаемся), в комнату входит не больше двух связей,
   в одном столбце не больше двух путей. */
function solveFloor(prev, lo, hi, y, height, targetNodes, sharePriority, hasSharedByPath) {
    const n = prev.length;
    let best = null;

    for (const limits of [[2, 2], [3, 3], [99, 99]]) {
        const found = searchFloor(prev, lo, hi, limits[0], limits[1], targetNodes, sharePriority, hasSharedByPath);
        if (!found) continue;
        if (found.uniqueCount === targetNodes) return found.cols;
        if (!best || found.score < best.score) best = found;
    }
    return best ? best.cols : prev.map(() => clamp(MAP_CENTER, lo, hi));
}

/* Перебор вариантов: по расписанию соединяем ветки, затем снова разводим их. */
function searchFloor(prev, lo, hi, maxBusy, maxIn, targetNodes, sharePriority, hasSharedByPath) {
    const n = prev.length;
    const cur = new Array(n);
    const busy = {};        /* сколько путей в столбце */
    const edges = {};       /* edges[v][src] = сколько путей идёт из src в v */
    const inDeg = {};       /* сколько входящих связей у столбца */

    let best = null;
    let bestScore = Infinity;

    function rec(i, floorVal) {
        if (i === n) {
            let uniqueCount = 0;
            for (const col in busy) if (busy[col] > 0) uniqueCount++;
            let movement = 0;
            let sharedPriority = 0;
            let proximity = 0;
            const groups = {};
            for (let j = 0; j < n; j++) movement += Math.abs(cur[j] - prev[j]);
            for (let j = 0; j < n; j++) {
                if (!groups[cur[j]]) groups[cur[j]] = [];
                groups[cur[j]].push(j);
            }
            for (const col in groups) {
                if (groups[col].length > 1) {
                    groups[col].forEach(index => {
                        sharedPriority += Math.min(6, sharePriority[index] || 0);
                    });
                }
            }
            for (let a = 0; a < n; a++) {
                for (let b = a + 1; b < n; b++) {
                    if (hasSharedByPath[a] && hasSharedByPath[b]) continue;
                    const urgency = Math.max(
                        hasSharedByPath[a] ? 0 : Math.min(6, sharePriority[a] || 1),
                        hasSharedByPath[b] ? 0 : Math.min(6, sharePriority[b] || 1)
                    );
                    proximity += Math.abs(cur[a] - cur[b]) * urgency;
                }
            }
            const score = Math.abs(uniqueCount - targetNodes) * 1000 + movement * 0.2 +
                proximity * 0.3 - sharedPriority * 1.5 + GameRng.next('map') * 0.15;
            if (score < bestScore) {
                bestScore = score;
                best = { cols: cur.slice(), uniqueCount: uniqueCount, score: score };
            }
            return;
        }

        const src = prev[i];
        let minX = Math.max(lo, src - 1, floorVal);
        let maxX = Math.min(hi, src + 1);
        if (minX > maxX) { minX = maxX = clamp(minX, lo, hi); }

        const opts = [];
        for (let v = minX; v <= maxX; v++) opts.push(v);
        const shuffled = shuffleIn('map', opts);
        opts.splice(0, opts.length, ...shuffled);

        for (const v of opts) {
            const used = busy[v] || 0;
            if (used >= maxBusy) continue;
            const already = (edges[v] && edges[v][src]) ? 1 : 0;
            if ((inDeg[v] || 0) + (already ? 0 : 1) > maxIn) continue;

            cur[i] = v;
            busy[v] = used + 1;
            if (!edges[v]) edges[v] = {};
            edges[v][src] = (edges[v][src] || 0) + 1;
            if (edges[v][src] === 1) inDeg[v] = (inDeg[v] || 0) + 1;

            rec(i + 1, v);

            edges[v][src]--;
            if (!edges[v][src]) { delete edges[v][src]; inDeg[v]--; }
            busy[v]--;
        }
    }

    rec(0, -Infinity);
    return best;
}

/* Насколько широко расходятся пути на этом этаже: внизу — все 7,
   вверху — воронка, которая сводит их в центр */
function spanAt(y, height) {
    if (height <= 1) return 0;
    const half = (MAP_WIDTH - 1) / 2;
    // Сохраняем место для смены маршрута в середине, сужаемся ближе к финалу.
    const t = Math.max(0, (y / (height - 1) - 0.45) / 0.55);
    let span = Math.round(half * Math.pow(1 - t, 0.85));
    if (y < height - 1) span = Math.max(1, span);   /* до последнего этажа хотя бы один столбец */
    return span;
}

/* Дополнительные переходы соединяют соседние ветки, а не просто повторяют
   траектории исходных путей. Все переходы ведут на следующий этаж. */
function connectMapBranches(rows) {
    const byId = new Map(rows.flat().map(node => [node.id, node]));
    const forcedLength = node => node.next.length === 1
        ? 1 + forcedLength(byId.get(node.next[0])) : 0;

    for (let r = 3; r < rows.length - 2; r++) {
        const sources = rows[r];
        const targets = rows[r + 1];
        if (targets.length < 2) continue;
        const incoming = id => sources.filter(node => node.next.includes(id)).length;
        const crosses = (source, target) => sources.some(other => other !== source &&
            other.next.some(id => {
                const end = byId.get(id);
                return end.id !== target.id && (source.col - other.col) * (target.col - end.col) < 0;
            }));
        const candidates = [];
        sources.forEach(source => {
            if (source.next.length !== 1) return;
            targets.forEach(target => {
                const distance = Math.abs(source.col - target.col);
                if (source.next.includes(target.id) || distance > 2 || incoming(target.id) >= 3 ||
                    crosses(source, target)) return;
                // Длинный коридор получает выход первым; случайность меняет расположение мостов.
                candidates.push({ source, target,
                    score: forcedLength(source) * 4 - distance + GameRng.next('map') * 3 });
            });
        });
        candidates.sort((a, b) => b.score - a.score);
        const bridge = candidates[0];
        if (bridge && (forcedLength(bridge.source) >= 2 || GameRng.next('map') < 0.65)) {
            bridge.source.next.push(bridge.target.id);
            bridge.source.next.sort((a, b) => byId.get(a).col - byId.get(b).col);
        }
    }
}

/* ---------------------------------------------------------------
   Узлы и связи: каждый путь даёт ребро снизу вверх
   --------------------------------------------------------------- */
function buildRows(height, paths) {
    const rows = [];

    for (let y = 0; y < height; y++) {
        const cols = [];
        for (const p of paths) if (cols.indexOf(p[y]) < 0) cols.push(p[y]);
        cols.sort((a, b) => a - b);

        rows.push(cols.map(col => ({
            id: y + '-' + col,
            row: y,
            col: col,
            type: null,          /* тип назначается позже */
            next: [],
            visited: false
        })));
    }

    for (let y = 0; y < height - 1; y++) {
        for (const p of paths) {
            const a = rows[y].find(n => n.col === p[y]);
            const b = rows[y + 1].find(n => n.col === p[y + 1]);
            if (a && b && a.next.indexOf(b.id) < 0) a.next.push(b.id);
        }
    }
    return rows;
}

/* ---------------------------------------------------------------
   Содержимое комнат
   --------------------------------------------------------------- */
function assignTypes(rows, height, stage) {
    const mid = Math.floor((height - 1) / 2);   /* ровно середина пути */
    const preBoss = height - 2;                /* лагерь перед боссом */
    const merge = height - 1;                  /* слияние путей */

    /* Фиксированные этажи */
    for (const n of rows[0]) n.type = 'FIGHT';
    for (const n of rows[mid]) n.type = 'CAMP';
    for (const n of rows[preBoss]) n.type = 'CAMP';
    for (const n of rows[merge]) n.type = 'CAMP_FINALE';

    /* Свободные узлы */
    const free = [];
    for (let y = 1; y < height; y++) {
        if (y === mid || y === preBoss || y === merge) continue;
        for (const n of rows[y]) free.push(n);
    }

    /* 1. Гарантированные минимумы */
    const order = ['TREASURE', 'ELITE', 'SHOP', 'CAMP', 'EVENT', 'DIG'];
    for (const type of order) {
        placeMinimum(free, rows, type, ROOM_MINIMUMS[type] || 0, height, stage);
    }

    /* 2. Остальное — случайно, с учётом «не повторяться подряд» */
    for (const node of free) {
        if (node.type) continue;
        const banned = neighbourTypes(node, rows);
        const pool = weightedRoomTypes(node.row, height, stage)
            .filter(t => t === 'FIGHT' || banned.indexOf(t) < 0);
        node.type = pool.length ? pool[randIntIn('map', 0, pool.length - 1)] : 'FIGHT';
    }
}

/* Типы комнат, взвешенные по глубине */
function weightedRoomTypes(row, height, stage) {
    const depth = height > 1 ? row / (height - 1) : 0;
    const stageBoost = stage ? stage.id * 2 : 0;
    const pool = [];
    const add = (t, n) => { for (let i = 0; i < n; i++) pool.push(t); };

    add('FIGHT', 40);
    add('EVENT', 12);
    add('DIG', 8);
    add('CAMP', 6);
    add('SHOP', 6);
    add('TREASURE', 4);

    /* элита — только глубже пятого этажа */
    if (row >= ELITE_MIN_FLOOR) add('ELITE', (depth > 0.6 ? 20 : 10) + stageBoost);

    /* ближе к логову сокровищницы и лавки нужнее */
    if (depth > 0.55) add('TREASURE', 6);
    if (depth > 0.7) add('SHOP', 5);
    if (depth > 0.8) add('ELITE', 6);

    return pool;
}

/* Можно ли поставить такой тип в этот узел */
function canRoomType(node, type) {
    if (type === 'ELITE' && node.row < ELITE_MIN_FLOOR) return false;
    return true;
}

/* Типы соседей (уже расставленные): один и тот же тип не идёт подряд */
function neighbourTypes(node, rows) {
    const out = [];
    for (const row of rows) {
        for (const n of row) {
            if (n === node) continue;
            if (n.next.indexOf(node.id) >= 0 && n.type) out.push(n.type);
            if (node.next.indexOf(n.id) >= 0 && n.type) out.push(n.type);
        }
    }
    return out;
}

/* Поставить гарантированный минимум комнат одного типа */
function placeMinimum(free, rows, type, count, height, stage) {
    let placed = 0;

    const candidates = () => free.filter(n =>
        !n.type &&
        canRoomType(n, type) &&
        neighbourTypes(n, rows).indexOf(type) < 0
    );

    while (placed < count) {
        const pool = candidates();
        if (!pool.length) break;

        /* берём узел, вокруг которого меньше всего таких комнат */
        let best = null;
        let bestScore = -Infinity;
        for (const n of pool) {
            const same = countNeighboursOfType(n, rows, type);
            const score = -same * 10 + GameRng.next('map') * 3;
            if (score > bestScore) { bestScore = score; best = n; }
        }
        if (!best) break;

        best.type = type;
        placed++;
    }
    return placed;
}

/* Сколько соседей такого типа уже стоит */
function countNeighboursOfType(node, rows, type) {
    let n = 0;
    for (const row of rows) {
        for (const other of row) {
            if (other === node || other.type !== type) continue;
            if (other.next.indexOf(node.id) >= 0) n++;
            if (node.next.indexOf(other.id) >= 0) n++;
        }
    }
    return n;
}

/* ---------------------------------------------------------------
   Достижимые узлы из текущей позиции
   --------------------------------------------------------------- */
function reachableNodes(map, fromId) {
    if (!fromId) return map[0].map(n => n.id);
    const row = map.find(r => r.some(n => n.id === fromId));
    if (!row) return map[0].map(n => n.id);
    const node = row.find(n => n.id === fromId);
    return node.next.slice();
}

function nodeById(map, id) {
    for (const row of map) {
        for (const n of row) if (n.id === id) return n;
    }
    return null;
}
