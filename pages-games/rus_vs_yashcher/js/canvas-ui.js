"use strict";
(() => {
    'use strict';
    const t = window.__zastavaUi;
    if (!t) {
        document.body.textContent = 'Не удалось загрузить игру';
        return;
    }
    const sceneCanvas = t.sceneCanvas;
    const UI_FACE_INDICES = [0, 1, 2, 3, 4, 5], UI_SLOT_IDS = [0, 1, 2, 3, 4], SLOT_X = [110, 280, 450, 620, 790];
    function requiredAt(items, index) { const value = items[index]; if (value === undefined)
        throw new RangeError(`Index ${index} is outside the available items`); return value; }
    function isSlotId(value) { return Number.isInteger(value) && value >= 0 && value < UI_SLOT_IDS.length; }
    const s = t.state, screen = document.createElement('canvas');
    screen.id = 'game-screen';
    screen.setAttribute('role', 'img');
    screen.setAttribute('aria-label', 'Русы против ящеров — игровое поле');
    screen.tabIndex = 0;
    document.body.appendChild(screen);
    const a11yRoot = document.createElement('div');
    a11yRoot.className = 'canvas-controls';
    a11yRoot.setAttribute('role', 'group');
    a11yRoot.setAttribute('aria-label', 'Элементы управления игрой');
    const a11yHelp = document.createElement('p');
    a11yHelp.id = 'canvasControlHelp';
    a11yHelp.className = 'canvas-sr-only';
    a11yHelp.textContent = 'Действия игрового поля доступны кнопками после Canvas. Переходите клавишей Tab, активируйте клавишей Enter или пробел.';
    const a11yStatus = document.createElement('p');
    a11yStatus.className = 'canvas-sr-only';
    a11yStatus.setAttribute('role', 'status');
    a11yStatus.setAttribute('aria-live', 'polite');
    a11yStatus.setAttribute('aria-atomic', 'true');
    a11yRoot.append(a11yHelp, a11yStatus);
    document.body.appendChild(a11yRoot);
    screen.setAttribute('aria-describedby', a11yHelp.id);
    let a11yButtons = [], a11yContext = '', a11yStatusKey = '';
    const context2d = screen.getContext('2d');
    if (!context2d)
        throw new Error('A 2D canvas context is unavailable');
    const c = context2d;
    const PALETTE = { bg: '#101b23', paper: '#23363b', raised: '#30494a', gold: '#f2cb93', ivory: '#f1e7ce', muted: '#a9bdb3', line: '#658079', green: '#94c5a0', red: '#d98e82' };
    let VW = 1180, VH = 940, mobile = false, regions = [], activeRegionStart = 0, pointer = { x: -1, y: -1, down: false }, drag = null, tree = false, helpOpen = false, controlMenuOpen = false, landingHover = 'idle', launchStartedAt = null, gameEntryStartedAt = null, relicDetailSlot = null, bagPage = 0, treeOffset = { x: 0, y: 0 }, treeScale = .76, cardPage = 1, paintTime = 0, fxBursts = [], uiAudio = null;
    let settingsOpen = false, menuMotionReduced = false, menuSound = true, menuDieAngle = .5, menuDieLastTime = null, currentDpr = 0;
    try {
        const raw = localStorage.getItem('zastava-menu-settings');
        if (raw) {
            const value = JSON.parse(raw);
            if (value && typeof value === 'object' && 'reducedMotion' in value && 'sound' in value) {
                menuMotionReduced = value.reducedMotion === true;
                menuSound = value.sound !== false;
            }
        }
    }
    catch { /* Settings are optional when storage is unavailable. */ }
    function saveMenuSettings() { try {
        localStorage.setItem('zastava-menu-settings', JSON.stringify({ reducedMotion: menuMotionReduced, sound: menuSound }));
    }
    catch { /* The current session still retains the settings. */ } t.setIntroReducedMotion(menuMotionReduced); }
    t.setIntroReducedMotion(menuMotionReduced);
    const CONTROL_MODES = [
        { id: 'full', name: 'Полный автопилот', short: 'ПОЛНЫЙ ИИ', description: 'ИИ: стрельба, найм, обучение, карты и реликвии.' },
        { id: 'quartermaster', name: 'Управление дружиной', short: 'ДРУЖИНА', description: 'ИИ нанимает, обучает и надевает реликвии; карты — ты.' },
        { id: 'prompts', name: 'Помощник', short: 'ПОМОЩНИК', description: 'Автострельба; окна найма, карт и реликвий открываются сами.' },
        { id: 'shooting', name: 'Автострельба', short: 'СТРЕЛЬБА', description: 'Русы стреляют сами; все решения и окна открываешь ты.' },
        { id: 'manual', name: 'Всё вручную', short: 'ВРУЧНУЮ', description: 'Ты управляешь решениями и запускаешь каждый залп.' }
    ];
    const uiReduceMotion = () => menuMotionReduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
    function unlockUiAudio() {
        if (!menuSound)
            return Promise.resolve();
        if (!uiAudio && typeof AudioContext !== 'undefined') {
            try {
                uiAudio = new AudioContext();
            }
            catch {
                uiAudio = null;
            }
        }
        if (uiAudio?.state === 'suspended')
            return uiAudio.resume().then(() => undefined).catch(() => undefined);
        return Promise.resolve();
    }
    function playHammerTap() {
        if (!menuSound || !uiAudio || uiAudio.state !== 'running')
            return;
        const now = uiAudio.currentTime;
        for (const [i, hz] of [410, 620, 930].entries()) {
            const tone = uiAudio.createOscillator(), envelope = uiAudio.createGain();
            tone.type = i === 0 ? 'triangle' : 'sine';
            tone.frequency.setValueAtTime(hz, now);
            tone.frequency.exponentialRampToValueAtTime(hz * .76, now + .11);
            envelope.gain.setValueAtTime(.0001, now);
            envelope.gain.exponentialRampToValueAtTime(.035 / (i + 1), now + .006);
            envelope.gain.exponentialRampToValueAtTime(.0001, now + .19 + i * .025);
            tone.connect(envelope);
            envelope.connect(uiAudio.destination);
            tone.start(now);
            tone.stop(now + .24);
        }
    }
    function resize() {
        const old = mobile;
        const cssW = Math.max(1, document.documentElement.clientWidth || innerWidth);
        const cssH = Math.max(1, innerHeight);
        mobile = cssW / cssH < 1.20;
        const baseW = mobile ? 500 : 1180, baseH = mobile ? 940 : 940;
        // One uniform zoom factor prevents the entire UI (including type) from stretching.
        const zoomFactor = Math.min(cssW / baseW, cssH / baseH);
        VW = cssW / zoomFactor;
        VH = cssH / zoomFactor;
        const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
        currentDpr = dpr;
        screen.width = Math.round(cssW * dpr);
        screen.height = Math.round(cssH * dpr);
        screen.style.width = cssW + 'px';
        screen.style.height = cssH + 'px';
        c.setTransform(screen.width / VW, 0, 0, screen.height / VH, 0, 0);
        screen.dataset['renderResolution'] = screen.width + '×' + screen.height;
        screen.dataset['sceneResolution'] = sceneCanvas.width + '×' + sceneCanvas.height;
        if (old !== mobile) {
            treeOffset = { x: VW / 2 - 600 * .76, y: VH / 2 - 520 * .76 };
        }
    }
    addEventListener('resize', resize);
    resize();
    treeOffset = { x: VW / 2 - 600 * .76, y: VH / 2 - 520 * .76 };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const fmt = (v) => { if (!Number.isFinite(Number(v)))
        return '0'; return Number(v.toFixed(2)).toLocaleString('ru-RU', { maximumFractionDigits: 2 }); };
    let selectedMetaNode = null;
    function rect(x, y, w, h, fill, r = 0, stroke = null, line = 1) { c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) {
        c.fillStyle = fill;
        c.fill();
    } if (stroke) {
        c.strokeStyle = stroke;
        c.lineWidth = line;
        c.stroke();
    } }
    function txt(st, x, y, size = 14, color = PALETTE.ivory, weight = 650, align = 'left') { c.font = `${weight} ${size}px system-ui,-apple-system,Segoe UI,sans-serif`; c.fillStyle = color; c.textAlign = align; c.fillText(String(st), x, y); c.textAlign = 'left'; }
    function fit(st, n) { const value = String(st); return value.length > n ? value.slice(0, n - 1) + '…' : value; }
    function bar(x, y, w, h, progress, color = '#e8bd7b', pulseBoost = 0) { rect(x, y, w, h, '#15282c', h / 2); if (progress > 0) {
        rect(x, y, Math.max(2, w * clamp(progress, 0, 1)), h, color, h / 2);
    } if (pulseBoost > 0) {
        const a = (uiReduceMotion() ? 0 : (.42 + .32 * Math.sin(paintTime * 4.4))) * pulseBoost;
        c.save();
        c.globalAlpha = a;
        rect(x - 2, y - 2, w + 4, h + 4, null, h / 2 + 3, '#f7d9a5', 2);
        c.restore();
    } }
    function hit(x, y, w, h, fn, tip = '', enabled = true, accessible = true) { if (enabled || accessible)
        regions.push({ x, y, w, h, fn, tip, enabled, accessible, label: String(tip || 'Действие') }); }
    function button(label, x, y, w, h, fn, enabled = true, bright = false, size = 13, tip = null, icon = null) {
        const hover = enabled && pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
        const q = uiReduceMotion() ? 0 : (.5 + .5 * Math.sin(paintTime * 2.1));
        const lift = hover && !uiReduceMotion() ? 3 : 0, drawY = y - lift;
        c.save();
        if (hover) {
            c.shadowColor = bright ? 'rgba(249,201,126,.72)' : 'rgba(134,218,180,.60)';
            c.shadowBlur = 20;
            c.shadowOffsetY = 4;
        }
        const bg = enabled ? (hover ? (bright ? '#ffdfaa' : '#4d7368') : bright ? '#e5b97f' : '#334e4d') : '#243438';
        const edge = enabled ? (hover ? '#fff0c7' : bright ? '#e6c994' : '#7b9485') : '#354744';
        rect(x, drawY, w, h, bg, 11, edge, hover ? 2.8 : 1.8);
        c.shadowBlur = 0;
        if (enabled && (hover || bright)) {
            rect(x + 4, drawY + 4, w - 8, Math.max(2, h * .10), `rgba(255,245,215,${hover ? .36 : .17})`, 5);
        }
        if (enabled && bright && !hover && !uiReduceMotion()) {
            const alpha = .09 + .15 * (.5 + .5 * Math.sin(paintTime * 2.7));
            rect(x + 5, drawY + 5, w - 10, Math.max(2, h * .18), `rgba(255,255,218,${alpha})`, 5);
        }
        if (enabled && hover && !uiReduceMotion()) {
            c.globalAlpha = .18 + .12 * q;
            const g = c.createLinearGradient(x, y, x + w, y);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(.5, '#fff4d7');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g;
            c.beginPath();
            c.roundRect(x + 5, drawY + 5, w - 10, h - 10, 7);
            c.fill();
            c.globalAlpha = 1;
        }
        let fs = size;
        c.font = `850 ${fs}px system-ui`;
        while (c.measureText(String(label)).width > w - (icon ? 62 : 18) && fs > 8) {
            fs -= .5;
            c.font = `850 ${fs}px system-ui`;
        }
        const textX = x + w / 2 + (icon ? 13 : 0);
        txt(label, textX, drawY + h / 2 + fs * .34, fs, enabled && (bright || hover) ? '#203039' : enabled ? '#f2e4c6' : '#61756e', 900, 'center');
        if (icon === 'die')
            canvasDie(t.introArcher, x + 31, drawY + h / 2, Math.min(30, h * .58), { rx: -.42, ry: landingHover === 'help' || uiReduceMotion() ? 0 : paintTime * (hover ? 1.5 : .34), rz: .04, up: 0, scale: .9, phase: 'hold' }, true);
        if (icon === 'hammer')
            drawHammerIcon(x + 27, drawY + h / 2, hover);
        c.restore();
        hit(x, y, w, h, fn, tip === null ? String(label) : String(tip || label), enabled, true);
    }
    function drawHammerIcon(x, y, active) { c.save(); c.translate(x, y); c.rotate(-.48); c.strokeStyle = active ? '#332b23' : '#edd09a'; c.fillStyle = active ? '#332b23' : '#edd09a'; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 9); c.stroke(); c.beginPath(); c.roundRect(-8, -10, 16, 7, 2); c.fill(); c.restore(); }
    function syncCanvasControls(start = 0) {
        const modal = s.phase.modal, modalContext = modal.type === 'upgrade' ? `${modal.kind}:${modal.kind === 'personal' ? modal.slot : ''}` : modal.type === 'recruit' ? `${modal.slot}:${modal.replacing}` : modal.type === 'equip' ? modal.relicIndex : '';
        const actions = regions.slice(start).filter(r => r.accessible), context = [tree ? 'tree' : 'game', helpOpen ? 'help' : '', settingsOpen ? 'settings' : '', controlMenuOpen ? 'control-menu' : '', s.controlMode, launchStartedAt === null ? 'ready' : 'launching', relicDetailSlot ?? '', s.phase.mode, modalContext, s.archers.length, selectedMetaNode || ''].join('|');
        const focusedIndex = document.activeElement instanceof HTMLButtonElement ? a11yButtons.indexOf(document.activeElement) : -1, restoreFocus = focusedIndex >= 0;
        if (context !== a11yContext || a11yButtons.length !== actions.length) {
            a11yContext = context;
            a11yRoot.replaceChildren(a11yHelp, a11yStatus);
            a11yButtons = actions.map(() => { const el = document.createElement('button'); el.type = 'button'; el.className = 'canvas-control'; a11yRoot.appendChild(el); return el; });
            if (restoreFocus && a11yButtons.length)
                requiredAt(a11yButtons, Math.min(focusedIndex, a11yButtons.length - 1)).focus({ preventScroll: true });
            else if (restoreFocus)
                screen.focus({ preventScroll: true });
        }
        const bounds = screen.getBoundingClientRect();
        for (let i = 0; i < actions.length; i++) {
            const r = requiredAt(actions, i), el = requiredAt(a11yButtons, i), label = r.label || 'Действие';
            el.textContent = label;
            el.setAttribute('aria-label', label);
            el.title = label;
            el.disabled = !r.enabled;
            el.onclick = r.enabled ? () => r.fn() : null;
            el.style.left = `${bounds.left + r.x / VW * bounds.width}px`;
            el.style.top = `${bounds.top + r.y / VH * bounds.height}px`;
            el.style.width = `${Math.max(1, r.w / VW * bounds.width)}px`;
            el.style.height = `${Math.max(1, r.h / VH * bounds.height)}px`;
        }
        const gateMaximum = t.maxGate(), modeLabels = { idle: 'Главное меню', playing: 'Игра продолжается', paused: 'Игра на паузе', upgrade: 'Выбор улучшения', recruit: 'Выбор лучника', equip: 'Выбор реликвии', win: 'Победа', lose: 'Поражение' }, modeName = modeLabels[s.phase.mode];
        const screenSummary = `Русы против ящеров. ${modeName}. Режим: ${CONTROL_MODES.find(mode => mode.id === s.controlMode)?.name ?? ''}. Ночь ${s.night || t.meta.night}, волна ${Math.min(s.wave + 1, s.totalWaves)} из ${s.totalWaves}. Ворота: ${Math.ceil(s.lives)} из ${gateMaximum}. Золото: ${Math.floor(s.gold)}. Лучников: ${s.archers.length}. Ящеров на поле: ${s.enemies.length}.`;
        screen.setAttribute('aria-label', screenSummary);
        const announcementKey = [s.phase.mode, s.controlMode, s.night, s.wave, modalContext].join('|');
        if (announcementKey !== a11yStatusKey) {
            a11yStatusKey = announcementKey;
            let detail = screenSummary;
            if (modal.type === 'upgrade')
                detail += ` Варианты: ${modal.options.map(o => `${o.name}. ${o.note || ''}`).join('; ')}.`;
            else if (modal.type === 'recruit')
                detail += ` Кандидаты: ${modal.options.map(o => `${o.name}, ${t.CLASSES[o.klass].name}`).join('; ')}.`;
            else if (modal.type === 'equip') {
                const r = t.RELICS.find(item => item.id === s.relics[modal.relicIndex]);
                detail += ` Реликвия: ${r?.name || 'не выбрана'}.`;
            }
            a11yStatus.textContent = detail;
        }
    }
    function actionBurst(x, y, clr = '#f2ca89') {
        if (uiReduceMotion())
            return;
        for (let i = 0; i < 11; i++) {
            let a = Math.PI * 2 * i / 11 + (Math.random() - .5) * .3;
            fxBursts.push({ x, y, vx: Math.cos(a) * (50 + Math.random() * 65), vy: Math.sin(a) * (50 + Math.random() * 65), life: .5 + Math.random() * .28, color: clr });
        }
    }
    function drawUiBursts() {
        if (uiReduceMotion()) {
            fxBursts.length = 0;
            return;
        }
        for (const p of fxBursts) {
            p.x += p.vx / 60;
            p.y += p.vy / 60;
            p.life -= 1 / 60;
            c.save();
            c.globalAlpha = Math.min(1, p.life * 1.8);
            c.fillStyle = p.color;
            c.beginPath();
            c.arc(p.x, p.y, 1.4 + 2 * p.life, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
        fxBursts = fxBursts.filter(p => p.life > 0);
    }
    function drawAttackMark(mode, x, y, r, color = '#f4cb9a') {
        c.save();
        c.translate(x, y);
        c.strokeStyle = color;
        c.fillStyle = color;
        c.lineWidth = Math.max(.012, r * .13);
        c.lineCap = 'round';
        c.lineJoin = 'round';
        const arrow = (dy = 0, scale = 1) => {
            const R = r * scale;
            c.beginPath();
            c.moveTo(-R * .83, dy);
            c.lineTo(R * .42, dy);
            c.stroke();
            c.beginPath();
            c.moveTo(R * .9, dy);
            c.lineTo(R * .26, dy - R * .33);
            c.lineTo(R * .38, dy);
            c.lineTo(R * .26, dy + R * .33);
            c.closePath();
            c.fill();
            c.beginPath();
            c.moveTo(-R * .78, dy);
            c.lineTo(-R * .99, dy - R * .29);
            c.lineTo(-R * .65, dy - R * .22);
            c.lineTo(-R * .43, dy);
            c.lineTo(-R * .65, dy + R * .22);
            c.lineTo(-R * .99, dy + R * .29);
            c.closePath();
            c.fill();
        };
        if (mode === 'plain')
            arrow();
        else if (mode === 'pierce') {
            arrow();
            c.beginPath();
            c.moveTo(r * .3, -r * .65);
            c.lineTo(r * .48, -r * .48);
            c.moveTo(r * .3, r * .65);
            c.lineTo(r * .48, r * .48);
            c.stroke();
        }
        else if (mode === 'spread' || mode === 'spreadPierce') {
            arrow(0, .82);
            c.save();
            c.translate(-r * .08, -r * .53);
            c.rotate(-.12);
            arrow(0, .58);
            c.restore();
            c.save();
            c.translate(-r * .08, r * .53);
            c.rotate(.12);
            arrow(0, .58);
            c.restore();
            if (mode === 'spreadPierce') {
                c.beginPath();
                c.moveTo(r * .48, -r * .82);
                c.lineTo(r * .65, -r * .65);
                c.moveTo(r * .48, r * .82);
                c.lineTo(r * .65, r * .65);
                c.stroke();
            }
        }
        else {
            c.beginPath();
            for (let j = 0; j < 16; j++) {
                const a = -Math.PI / 2 + j * Math.PI / 8, dist = r * (j % 2 ? .36 : .96);
                const px = Math.cos(a) * dist, py = Math.sin(a) * dist;
                if (j === 0)
                    c.moveTo(px, py);
                else
                    c.lineTo(px, py);
            }
            c.closePath();
            c.fill();
            if (mode === 'fieldPierce') {
                c.beginPath();
                c.arc(0, 0, r * .66, 0, Math.PI * 2);
                c.stroke();
            }
        }
        c.restore();
    }
    function drawStatusMark(id, x, y, r = 5) {
        const colors = { burn: '#ffad69', poison: '#94e9ab', slow: '#9edffa', stun: '#e9d38d', vulnerable: '#ed9cc0' };
        const col = colors[id] || '#f1d6aa';
        c.save();
        c.translate(x, y);
        c.strokeStyle = col;
        c.fillStyle = col;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.lineWidth = Math.max(.8, r * .22);
        c.beginPath();
        if (id === 'burn') {
            c.moveTo(0, -r);
            c.bezierCurveTo(r * .85, 0, r * .45, r * .26, 0, r);
            c.bezierCurveTo(-r * .88, r * .3, -r * .5, -r * .2, 0, -r);
            c.fill();
        }
        else if (id === 'poison') {
            c.moveTo(0, -r);
            c.bezierCurveTo(-r * 1.1, r * .35, -r * .7, r, 0, r);
            c.bezierCurveTo(r * .8, r, r * 1.05, r * .3, 0, -r);
            c.stroke();
        }
        else if (id === 'slow') {
            for (let k = 0; k < 3; k++) {
                const a = k * Math.PI / 3;
                c.moveTo(-Math.cos(a) * r, -Math.sin(a) * r);
                c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            c.stroke();
        }
        else if (id === 'stun') {
            c.moveTo(r * .1, -r);
            c.lineTo(-r * .6, r * .1);
            c.lineTo(r * .1, r * .1);
            c.lineTo(-r * .2, r);
            c.lineTo(r * .7, -r * .2);
            c.lineTo(0, -r * .2);
            c.closePath();
            c.fill();
        }
        else {
            c.moveTo(0, -r);
            c.lineTo(r * .8, -r * .2);
            c.lineTo(r * .6, r * .75);
            c.lineTo(-r * .6, r * .75);
            c.lineTo(-r * .8, -r * .2);
            c.closePath();
            c.stroke();
        }
        c.restore();
    }
    function getArch(slot) { return s.archers.find(a => a.slot === slot); }
    // Perspective-projected six-face 3D cube rendered in Canvas.
    // Face indices deliberately use exactly the same normals as frontFace() in the combat simulation.
    const DIE_FACE_AXES = [
        { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, // 1 front
        { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, // 2 right
        { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }, // 3 back
        { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] }, // 4 left
        { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] }, // 5 upper face, x=-90 reveals
        { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] } // 6 lower face, x=+90 reveals
    ];
    function dieMix(a, b, k) {
        k = clamp(k, 0, 1);
        const p = a.match(/[0-9a-f]{2}/ig), q = b.match(/[0-9a-f]{2}/ig);
        if (!p || !q)
            return a;
        return '#' + p.map((v, i) => Math.round(parseInt(v, 16) * (1 - k) + parseInt(requiredAt(q, i), 16) * k).toString(16).padStart(2, '0')).join('');
    }
    function dieRotation(v, rx, ry, rz) {
        // Matrix Rz * Rx * Ry. Its camera-facing Z component matches frontFace(rx,ry).
        const x = v[0] * Math.cos(ry) + v[2] * Math.sin(ry), z = -v[0] * Math.sin(ry) + v[2] * Math.cos(ry), y = v[1];
        const yy = y * Math.cos(rx) - z * Math.sin(rx), zz = y * Math.sin(rx) + z * Math.cos(rx);
        return [x * Math.cos(rz) - yy * Math.sin(rz), x * Math.sin(rz) + yy * Math.cos(rz), zz];
    }
    function roundedFacePath(points, round = .085) {
        if (points.length < 3)
            return;
        const starts = points.map((vertex, i) => { const prev = requiredAt(points, (i + points.length - 1) % points.length); return { x: vertex.x + (prev.x - vertex.x) * round, y: vertex.y + (prev.y - vertex.y) * round }; });
        const ends = points.map((vertex, i) => { const next = requiredAt(points, (i + 1) % points.length); return { x: vertex.x + (next.x - vertex.x) * round, y: vertex.y + (next.y - vertex.y) * round }; });
        const first = requiredAt(starts, 0);
        c.beginPath();
        c.moveTo(first.x, first.y);
        for (let i = 0; i < points.length; i++) {
            const corner = requiredAt(points, i), end = requiredAt(ends, i), next = requiredAt(starts, (i + 1) % points.length);
            c.quadraticCurveTo(corner.x, corner.y, end.x, end.y);
            c.lineTo(next.x, next.y);
        }
        c.closePath();
    }
    function diePose(a) {
        const d = a.die, period = Math.max(.2, d.cycleEnd || 3), time = clamp(d.timer || 0, 0, period);
        const spinEnd = period * .37, landEnd = period * .49, revealEnd = period * .65;
        let rx = 0, ry = 0, rz = 0, up = 0, scale = 1, phase = 'hold';
        const wobble = Math.sin((d.startX || 0) * .031 + a.slot * 2.31);
        if (time < spinEnd) {
            const q = clamp(time / spinEnd, 0, 1), ease = 1 - (1 - q) ** 3;
            rx = ((d.startX || 0) + ((d.endX || 0) - (d.startX || 0)) * ease) * Math.PI / 180;
            ry = ((d.startY || 0) + ((d.endY || 0) - (d.startY || 0)) * ease) * Math.PI / 180;
            rz = (wobble * .42 + .17 * Math.sin(q * 9.4)) * (1 - q);
            up = -13 * (1 - q) - 40 * Math.sin(q * Math.PI);
            scale = .83 + .17 * ease;
            phase = 'rolling';
        }
        else if (time < landEnd) {
            const q = clamp((time - spinEnd) / (landEnd - spinEnd), 0, 1);
            rx = (d.endX || 0) * Math.PI / 180;
            ry = (d.endY || 0) * Math.PI / 180;
            up = -9 * Math.sin(q * Math.PI);
            scale = 1 - .05 * Math.sin(q * Math.PI * 2);
            phase = 'landing';
        }
        else if (time < revealEnd) {
            const q = clamp((time - landEnd) / (revealEnd - landEnd), 0, 1), ease = q * q * (3 - 2 * q);
            rx = ((d.endX || 0) + ((d.finalX || 0) - (d.endX || 0)) * ease) * Math.PI / 180;
            ry = ((d.endY || 0) + ((d.finalY || 0) - (d.endY || 0)) * ease) * Math.PI / 180;
            up = -5 * Math.sin(q * Math.PI);
            scale = 1 + .27 * ease;
            phase = 'reveal';
        }
        else {
            rx = (d.finalX || 0) * Math.PI / 180;
            ry = (d.finalY || 0) * Math.PI / 180;
            scale = 1.27;
            if (time > period - .30) {
                let q = clamp((time - (period - .30)) / .30, 0, 1);
                scale = 1.27 - (1.27 - .88) * (q * q * (3 - 2 * q));
            }
        }
        return { rx, ry, rz, up, scale, phase };
    }
    function canvasDie(a, x, y, sz, poseOverride, menuStyle = false) {
        const pose = poseOverride ?? diePose(a), base = menuStyle ? '#bd874d' : t.CLASSES[a.klass].color, size = sz * pose.scale, centerY = y + pose.up;
        // The shadow stays on the parapet while the cube flies upward.
        c.save();
        c.globalAlpha = .22 + Math.max(0, pose.up) / 170;
        c.fillStyle = '#091d22';
        c.beginPath();
        c.ellipse(x + 2, y + size * .49, size * .53, size * .15, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
        c.save();
        c.translate(x, centerY);
        const rotate = (p) => dieRotation(p, pose.rx, pose.ry, pose.rz);
        // Perspective camera: z toward the viewer. Camera-space coordinates are in cube-side units.
        const proj = (p) => { const r = rotate(p), depth = 4.5 / (4.5 - r[2]); return { x: r[0] * size * depth, y: r[1] * size * depth, z: r[2] }; };
        const faces = [];
        for (const i of UI_FACE_INDICES) {
            const def = DIE_FACE_AXES[i];
            if (!def)
                continue;
            const n = rotate(def.normal);
            if (n[2] <= .012)
                continue; // Cull back faces; three faces can be visible at most.
            const add = (u, v, dist = .5) => [
                def.normal[0] * dist + def.u[0] * u + def.v[0] * v,
                def.normal[1] * dist + def.u[1] * u + def.v[1] * v,
                def.normal[2] * dist + def.u[2] * u + def.v[2] * v
            ];
            const poly = [proj(add(-.5, -.5)), proj(add(.5, -.5)), proj(add(.5, .5)), proj(add(-.5, .5))];
            faces.push({ i, def, n, poly, add, depth: poly.reduce((sum, p) => sum + p.z, 0) / 4 });
        }
        faces.sort((leftFace, rightFace) => leftFace.depth - rightFace.depth);
        for (const face of faces) {
            const { i, n, poly, add } = face, light = clamp(.20 + .45 * n[2] + .11 * Math.max(0, -n[1]), .13, .78);
            roundedFacePath(poly, .10);
            c.fillStyle = menuStyle ? dieMix('#754a31', '#efd09b', clamp(light * .76, .16, .60)) : dieMix(base, '#fff2d5', light);
            c.fill();
            c.strokeStyle = menuStyle ? '#49372d' : dieMix(base, '#554a37', .45);
            c.lineJoin = 'round';
            c.lineWidth = Math.max(1.2, size * (menuStyle ? .061 : .055));
            c.stroke();
            // Embossed inner frame. The inset also follows perspective instead of being a flat rectangle.
            const inset = [proj(add(-.425, -.425, .505)), proj(add(.425, -.425, .505)), proj(add(.425, .425, .505)), proj(add(-.425, .425, .505))];
            c.beginPath();
            inset.forEach((p, k) => k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
            c.closePath();
            c.strokeStyle = menuStyle ? `rgba(255,228,172,${(.20 + .36 * n[2]).toFixed(3)})` : `rgba(255,241,206,${(.24 + .42 * n[2]).toFixed(3)})`;
            c.lineWidth = Math.max(.65, size * .021);
            c.stroke();
            if (n[2] < .20)
                continue;
            // Numbers and type symbols live on the projected face itself.
            const center = proj(add(0, 0, .511)), right = proj(add(1, 0, .511)), down = proj(add(0, 1, .511));
            const ux = right.x - center.x, uy = right.y - center.y, vx = down.x - center.x, vy = down.y - center.y;
            c.save();
            roundedFacePath(poly, .10);
            c.clip();
            c.transform(ux, uy, vx, vy, center.x, center.y);
            c.fillStyle = '#243f3d';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            const mode = t.faceModeFor(a, i);
            const ink = menuStyle ? '#38291e' : '#243f3d';
            drawAttackMark(mode, 0, .19, menuStyle ? .22 : .20, ink);
            const count = t.faceRepeats(a, i);
            c.font = `900 ${count >= 100 ? '.20' : count >= 10 ? '.24' : '.29'}px system-ui,-apple-system,Segoe UI,sans-serif`;
            c.fillStyle = ink;
            c.fillText(String(count), 0, -.22);
            c.restore();
        }
        c.restore();
    }
    function header() {
        rect(0, 0, VW, VH, PALETTE.bg);
        rect(10, 8, VW - 20, 46, '#213439', 9, '#46605a');
        txt(`НОЧЬ ${s.night || t.meta.night}   ·   ВОЛНА ${Math.min(s.wave + 1, s.totalWaves || 12)}/${s.totalWaves || 12}`, 24, 37, mobile ? 15 : 17, PALETTE.gold, 850);
        const countdown = Math.max(0, Math.ceil(s.nextWaveAt - s.elapsed)), control = CONTROL_MODES.find(mode => mode.id === s.controlMode);
        if (mobile) {
            txt(`◷ ${String(Math.floor(countdown / 60)).padStart(2, '0')}:${String(countdown % 60).padStart(2, '0')}`, VW - 338, 37, 14, '#d9e4cd');
            button(control?.short ?? 'РЕЖИМ', VW - 238, 14, 96, 34, () => { controlMenuOpen = !controlMenuOpen; }, s.phase.mode === 'playing', s.controlMode === 'full', 10, 'Режим управления: ' + (control?.name ?? ''));
            if (s.phase.mode === 'playing')
                button('ВОЛНА ▶', VW - 136, 14, 124, 34, () => t.beginWave(true), s.wave < s.totalWaves, false, 11, '');
        }
        else {
            txt(`◷ ${String(Math.floor(countdown / 60)).padStart(2, '0')}:${String(countdown % 60).padStart(2, '0')}`, 350, 37, 17, '#d9e4cd');
            button(control?.short ?? 'РЕЖИМ', 645, 14, 120, 34, () => { controlMenuOpen = !controlMenuOpen; }, s.phase.mode === 'playing', s.controlMode === 'full', 12, 'Режим управления: ' + (control?.name ?? ''));
            if (s.phase.mode === 'playing')
                button('ВОЛНА ▶', 775, 14, 165, 34, () => t.beginWave(true), s.wave < s.totalWaves, false, 13, '');
        }
        if (!mobile)
            button('Ⅱ Пауза', 951, 14, 170, 34, () => t.pause(), s.phase.mode === 'playing', false, 13, 'Пауза');
    }
    function drawControlMenu() {
        const w = Math.min(450, VW - 24), h = 340, x = mobile ? VW - w - 12 : Math.min(645, VW - w - 12), y = 58;
        rect(x, y, w, h, '#20383b', 12, '#c5ad7f', 2);
        txt('УПРАВЛЕНИЕ', x + 16, y + 28, 16, PALETTE.gold, 900);
        button('×', x + w - 45, y + 6, 34, 30, () => { controlMenuOpen = false; }, true, false, 18, 'Закрыть выбор режима');
        CONTROL_MODES.forEach((mode, i) => { const yy = y + 42 + i * 57, selected = s.controlMode === mode.id; rect(x + 8, yy, w - 16, 52, selected ? '#4f6d57' : '#2c4847', 8, selected ? '#e8ca8e' : '#58746a', selected ? 2 : 1); txt((selected ? '●  ' : '○  ') + mode.name, x + 18, yy + 20, 14, selected ? PALETTE.gold : PALETTE.ivory, 850); txt(fit(mode.description, mobile ? 54 : 65), x + 20, yy + 40, 10, PALETTE.muted, 650); hit(x + 8, yy, w - 16, 52, () => { t.setControlMode(mode.id); controlMenuOpen = false; }, mode.name + '. ' + mode.description); });
    }
    function stage() {
        const y = mobile ? 65 : 63;
        const maxW = VW - (mobile ? 24 : 36), maxH = mobile ? Math.max(280, VH * .39) : Math.max(450, Math.min(580, VH * .62));
        // The battle scene always preserves 900:540 proportions (no stretched actors).
        const w = Math.min(maxW, maxH * 900 / 540), h = w * 540 / 900, x = (VW - w) / 2;
        c.save();
        c.beginPath();
        c.roundRect(x, y, w, h, 12);
        c.clip();
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.drawImage(sceneCanvas, x, y, w, h);
        // Slight vignetting at upper and lower edges to support UI affordances
        const g = c.createLinearGradient(0, y, 0, y + 110);
        g.addColorStop(0, '#0a1a2288');
        g.addColorStop(1, '#0a1a2200');
        c.fillStyle = g;
        c.fillRect(x, y, w, 120);
        if (s.controlMode === 'manual' && s.phase.mode === 'playing')
            hit(x, y, w, h, () => { const px = (pointer.x - x) * 900 / w, py = (pointer.y - y) * 540 / h; const targets = s.enemies.map(enemy => { const depth = .44 + clamp((enemy.y - 237) / 210, 0, 1) * .56; return { enemy, distance: Math.hypot(px - enemy.x, py - (enemy.y - 30 * depth)), radius: Math.max(20, enemy.radius * depth * 1.8) }; }).filter(item => item.distance <= item.radius).sort((a, b) => a.distance - b.distance); const target = targets[0]; if (target)
                t.manualVolley(target.enemy.id); }, '', true, false);
        for (const slot of UI_SLOT_IDS) {
            const a = getArch(slot), xx = x + w * tSlotX(slot) / 900, yy = y + h * (mobile ? .73 : .70);
            if (a) {
                const dieSize = a.klass === 'heavy' ? (mobile ? 58 : 69) : a.klass === 'short' ? (mobile ? 41 : 44) : (mobile ? 49 : 55);
                canvasDie(a, xx, yy, dieSize);
                if (s.controlMode === 'manual') {
                    const ready = t.canManualVolley(slot);
                    if (ready)
                        txt('ГОТОВ', xx, yy + dieSize * .68, 10, PALETTE.gold, 900, 'center');
                    hit(xx - dieSize * .55, yy - dieSize * .55, dieSize * 1.1, dieSize * 1.1, () => t.manualVolley(undefined, slot), `Выстрелить: ${a.name}`, ready, true);
                }
            }
            else {
                const price = t.SLOTS[slot].price;
                const can = s.gold >= price && s.phase.mode === 'playing';
                button('+', xx - 19, y + h * .77 - 16, 38, 38, () => t.openRecruit(slot), can, can, 27, `Нанять лучника за ${fmt(price)} золота`);
                txt('◈' + fmt(price), xx, y + h * .77 + 38, mobile ? 13 : 14, '#f3dfb3', 850, 'center');
            }
        }
        // Gate health strips below the gate.
        const seg = 12, gw = w * .19, gh = mobile ? 7 : 8, gx = x + w * .405, gy = y + h * .845, ratio = clamp(s.lives / Math.max(1, t.maxGate()), 0, 1), filled = Math.round(seg * ratio);
        for (let i = 0; i < seg; i++) {
            const sw = (gw - (seg - 1) * 4) / seg, sx = gx + i * (sw + 4);
            rect(sx, gy, sw, gh, i < filled ? (ratio > .4 ? '#84c792' : '#df9a84') : '#24353b', gh / 2, i < filled ? '#dbe8d9' : '#405259', 1);
        }
        c.restore();
        rect(x, y, w, h, null, 12, '#667f77', 1.5);
        txt('◈ ' + Math.floor(s.gold) + '  золота', x + 12, y + 25, mobile ? 14 : 16, PALETTE.gold, 900);
        txt('ᛟ ' + t.meta.runes + ' рун', x + 12, y + 48, mobile ? 11 : 13, '#bed9cf', 800);
        if (s.controlMode === 'manual') {
            txt('Нажми ящера или кубик', x + 12, y + 69, mobile ? 10 : 12, PALETTE.ivory, 750);
            button('ЗАЛП · ПРОБЕЛ', x + w - (mobile ? 164 : 190), y + 52, mobile ? 152 : 178, 32, () => t.manualVolley(), t.canManualVolley(), true, mobile ? 10 : 12, 'Выстрелить всеми готовыми русами');
        }
        if (mobile)
            button('Ⅱ', x + w - 50, y + 9, 38, 33, () => t.pause(), s.phase.mode === 'playing', false, 13, 'Пауза');
    }
    function tSlotX(slot) { return SLOT_X[slot]; }
    function mainPanels() {
        const sceneW = Math.min(VW - (mobile ? 24 : 36), (mobile ? Math.max(280, VH * .39) : Math.max(450, Math.min(580, VH * .62))) * 900 / 540), sceneH = sceneW * 540 / 900;
        const top = mobile ? 65 + sceneH + 13 : 63 + sceneH + 13;
        rect(10, top, VW - 20, 28, '#20343a', 6);
        txt('ОПЫТ ДРУЖИНЫ · ' + s.level + ' ур.', 23, top + 19, mobile ? 11 : 13, PALETTE.ivory, 800);
        bar(206, top + 9, (mobile ? VW - 324 : VW - 355), 9, s.xp / Math.max(.001, s.xpNeeded), '#d8b17d', s.xp >= s.xpNeeded ? 1 : 0);
        button(s.xp >= s.xpNeeded ? 'СОВЕТ ✦' : 'СОВЕТ', VW - 138, top + 1, 124, 25, () => t.showNextLevel('team'), s.phase.mode === 'playing' && s.xp >= s.xpNeeded, s.xp >= s.xpNeeded, 12, 'Выбрать улучшение дружины');
        if (mobile) {
            button('◀', 10, top + 34, 42, 35, () => cardPage = Math.max(0, cardPage - 1), cardPage > 0, false, 13, 'Предыдущие карточки лучников');
            button('▶', VW - 52, top + 34, 42, 35, () => cardPage = Math.min(3, cardPage + 1), cardPage < 3, false, 13, 'Следующие карточки лучников');
        }
        const count = mobile ? 2 : 5, gap = mobile ? 10 : 7, x0 = mobile ? 53 : 15, w = mobile ? (VW - 116) / 2 : (VW - 30 - gap * 4) / 5, cardY = top + (mobile ? 80 : 37), cardH = mobile ? Math.max(295, Math.min(365, VH - cardY - 142)) : 180;
        for (let i = 0; i < count; i++) {
            const slot = mobile ? i + cardPage : i, x = x0 + i * (w + gap);
            if (isSlotId(slot))
                drawArcherCard(getArch(slot), slot, x, cardY, w, cardH);
        }
        if (mobile) {
            drawBag(13, cardY + cardH + 11, VW - 26, 98);
        }
        else
            drawBag(14, top + 228, VW - 28, 42);
    }
    function drawArcherCard(a, slot, x, y, w, h) {
        rect(x, y, w, h, '#203439', 9, '#516963');
        if (!a) {
            txt('СВОБОДНО', x + w / 2, y + 28, 14, '#abc0ae', 850, 'center');
            txt('◈ ' + fmt(t.SLOTS[slot].price) + ' · урон ×' + fmt(t.SLOTS[slot].mult), x + w / 2, y + 62, 12, PALETTE.gold, 800, 'center');
            button('+ Нанять', x + 10, y + h - 44, w - 20, 34, () => t.openRecruit(slot), s.gold >= t.SLOTS[slot].price && s.phase.mode === 'playing', true, mobile ? 15 : 12);
            return;
        }
        const short = t.CLASSES[a.klass].name;
        txt(fit(a.name, mobile ? 15 : 13), x + 9, y + 21, mobile ? 19 : 14, t.CLASSES[a.klass].color, 850);
        txt('Лучник · ' + short + ' · ' + a.level + ' ур.', x + 9, y + 39, mobile ? 12 : 10, PALETTE.muted, 600);
        const bw = w - 18;
        bar(x + 9, y + 48, bw, 5, a.hp / a.maxHp, a.hp / a.maxHp < .35 ? '#e98e84' : '#85ce9d');
        bar(x + 9, y + 58, bw, 7, a.xp / a.xpNeeded, '#f0c186', a.xp >= a.xpNeeded ? 1 : 0);
        txt('ОПЫТ  ' + Math.floor(a.xp) + '/' + a.xpNeeded, x + 9, y + 79, mobile ? 11 : 9, '#d9c9a9');
        let gy = y + 88;
        for (const j of UI_FACE_INDICES) {
            const xx = x + 8 + j * (bw / 6), width = bw / 6 - 1.5;
            rect(xx, gy, width, mobile ? 58 : 34, a.die.face === j ? '#566451' : '#34494a', 3);
            const ff = t.FACE_ATTACKS[j], repeats = t.faceRepeats(a, j);
            drawAttackMark(t.faceModeFor(a, j), xx + width / 2, gy + (mobile ? 14 : 11), mobile ? 8.5 : 6, ff.color);
            for (const [q, st] of t.activeStatuses(a).slice(0, 2).entries())
                drawStatusMark(st.id, xx + width - 6 - q * 9, gy + 6, 3.1);
            txt('×' + repeats, xx + width / 2, gy + (mobile ? 37 : 27), mobile ? 15 : 11, '#efd4a1', 850, 'center');
            if (mobile)
                txt('⚔' + t.formatDamage(t.displayedShotDamage(a, j)), xx + width / 2, gy + 52, 9, '#c5d8ca', 650, 'center');
            hit(xx, gy, width, mobile ? 58 : 34, () => { }, t.faceInfo(a, j).label + ' — ' + t.faceInfo(a, j).desc + ' Урон ' + t.formatDamage(t.displayedShotDamage(a, j)) + ', повторов ' + repeats, true, false);
        }
        const speedMult = fmt((t.CLASSES[a.klass].period / a.period) * a.speed);
        if (mobile) {
            txt('У/С ' + fmt(t.estimateDps(a)) + '    Скорость ×' + speedMult, x + 9, gy + 75, 12, '#bdcbc4');
            const ry = gy + 93;
            for (let j = 0; j < 6; j++) {
                const relic = a.relics[j], r = t.RELICS.find(z => z.id === relic);
                button(r ? r.icon : '·', x + 9 + j * (bw / 6), ry, bw / 6 - 2, 28, () => relic ? t.unequipRelic(slot, j) : undefined, !!relic, false, 13, r ? `Снять реликвию ${r.name}` : `Пустая ячейка реликвий ${j + 1}`);
            }
            button(t.boostPrice(a) === 0 ? 'ОБУЧИТЬ ✦' : 'ОБУЧИТЬ ◈' + t.boostPrice(a), x + 9, y + h - 42, (w - 27) * .55, 32, () => t.boostArcher(slot), s.phase.mode === 'playing' && s.gold >= t.boostPrice(a), t.boostPrice(a) === 0, 11);
            const swapPrice = Math.round(t.SLOTS[slot].price * .65 + 25);
            button('СМЕНА ◈' + swapPrice, x + 15 + (w - 27) * .55, y + h - 42, (w - 27) * .45, 32, () => t.openRecruit(slot, true), s.phase.mode === 'playing' && s.gold >= swapPrice, false, 11);
        }
        else {
            txt('У/С ' + fmt(t.estimateDps(a)) + ' · ⚔ ' + t.formatDamage(t.displayedShotDamage(a, a.die.face)) + ' · ◇ ' + a.relics.length + '/6', x + 8, gy + 47, 10, '#b6cfbf');
            hit(x + 6, gy + 34, w - 12, 23, () => relicDetailSlot = slot, t.relicTable(a));
            button(t.boostPrice(a) === 0 ? 'ОБУЧИТЬ ✦' : 'ОБУЧИТЬ ◈' + t.boostPrice(a), x + 7, y + h - 28, w * .60 - 8, 23, () => t.boostArcher(slot), s.phase.mode === 'playing' && s.gold >= t.boostPrice(a), t.boostPrice(a) === 0, 10, '');
            const swapPrice = Math.round(t.SLOTS[slot].price * .65 + 25);
            button('СМЕНА ◈' + swapPrice, x + w * .62, y + h - 28, w * .34, 23, () => t.openRecruit(slot, true), s.phase.mode === 'playing' && s.gold >= swapPrice, false, 11, '');
        }
    }
    function drawBag(x, y, w, h) { rect(x, y, w, h, '#1c2d35', 7, '#415a55'); txt('РЕЛИКВИИ', x + 10, y + 17, 12, PALETTE.gold, 820); const max = mobile ? 5 : 10; bagPage = Math.min(bagPage, Math.max(0, Math.ceil(s.relics.length / max) - 1)); const base = x + (mobile ? 15 : 104), start = bagPage * max; for (let j = 0; j < Math.min(max, s.relics.length - start); j++) {
        const i = j + start, r = t.RELICS.find(o => o.id === s.relics[i]);
        if (!r)
            continue;
        const icons = { perun: '⚡', kvass: '♨', boots: '⌁', amulet: '◇', quiver: '➶' };
        button(icons[r.id] || '◆', base + j * (mobile ? 58 : 62), y + (mobile ? 25 : 7), mobile ? 52 : 55, 27, () => t.openEquip(i), s.phase.mode === 'playing', false, 17, t.relicInfo(r.id));
    } if (s.relics.length > max) {
        button('◀', x + w - 84, y + 5, 34, 28, () => bagPage = Math.max(0, bagPage - 1), bagPage > 0, false, 14, '');
        button('▶', x + w - 45, y + 5, 34, 28, () => bagPage = Math.min(Math.ceil(s.relics.length / max) - 1, bagPage + 1), start + max < s.relics.length, false, 14, '');
    } if (!s.relics.length)
        txt('Пусто. У шаманов надо отобрать амулеты.', mobile ? x + 10 : x + 210, y + (mobile ? 44 : 20), mobile ? 11 : 12, PALETTE.muted); }
    function shade(alpha = .87) { rect(0, 0, VW, VH, `rgba(5,15,21,${alpha})`); }
    function multiline(st, x, y, width, lineH = 22, size = 15, color = PALETTE.muted) { const words = String(st).split(/\s+/); let line = '', cy = y; for (const word of words) {
        const test = line ? line + ' ' + word : word;
        c.font = `600 ${size}px system-ui`;
        if (c.measureText(test).width > width && line) {
            txt(line, x, cy, size, color, 600);
            cy += lineH;
            line = word;
        }
        else
            line = test;
    } if (line)
        txt(line, x, cy, size, color, 600); return cy + lineH; }
    function dialogBase(title, sub = '') {
        shade(.91);
        const ww = Math.min(VW - 24, mobile ? 720 : 900), hh = Math.min(VH - 45, mobile ? 630 : 505), x = (VW - ww) / 2, y = (VH - hh) / 2;
        c.save();
        c.shadowColor = 'rgba(0,0,0,.55)';
        c.shadowBlur = 30;
        rect(x, y, ww, hh, '#22383f', 17, '#8ca38c', 2);
        c.restore();
        rect(x + 8, y + 8, ww - 16, 5, '#a18b60', 3);
        const titleSize = mobile ? Math.min(29, ww / 20) : 32;
        txt(fit(title, Math.floor(ww / (titleSize * .6))), x + ww / 2, y + 52, titleSize, PALETTE.ivory, 950, 'center');
        if (sub)
            txt(fit(sub, Math.floor(ww / 10)), x + ww / 2, y + 85, mobile ? 13 : 15, PALETTE.muted, 650, 'center');
        return { x, y, w: ww, h: hh };
    }
    const rarityColors = { common: '#acb7af', uncommon: '#80cb9c', rare: '#80bdf3', epic: '#c69afa', legendary: '#f4cf7b' };
    function modalUpgrade() {
        const modal = s.phase.modal;
        if (modal.type !== 'upgrade')
            return;
        if (modal.kind === 'personal') {
            const a = getArch(modal.slot);
            if (!a)
                return;
            shade(.55);
            const ww = Math.min(238, (VW - 30) / 2 - 7), hh = mobile ? 242 : 252, gap = 10;
            const sceneMaxH = mobile ? Math.max(280, VH * .39) : Math.max(450, Math.min(580, VH * .62));
            const sceneW = Math.min(VW - (mobile ? 24 : 36), sceneMaxH * 900 / 540);
            const cx = VW / 2 - sceneW / 2 + sceneW * a.x / 900;
            const left = clamp(cx - ww - gap / 2, 10, VW - (ww * 2 + gap) - 10), top = clamp(60 + sceneW / 900 * 155, 76, VH - hh - 35);
            txt('✦ ' + a.name + ' · ' + a.level + ' → ' + (a.level + 1) + ' ур.', left + ww + gap / 2, top - 14, 16, PALETTE.gold, 900, 'center');
            for (let i = 0; i < 2; i++) {
                const o = modal.options[i];
                if (!o)
                    continue;
                const x = left + i * (ww + gap), tc = rarityColors[o.tier] || PALETTE.gold;
                rect(x, top, ww, hh, '#2d4648', 12, tc, 2.5);
                rect(x + 6, top + 6, ww - 12, 6, tc, 3);
                txt(({ common: 'ОБЫЧНАЯ', uncommon: 'НЕОБЫЧНАЯ', rare: 'РЕДКАЯ', epic: 'ЭПИЧЕСКАЯ', legendary: 'ЛЕГЕНДАРНАЯ' })[o.tier] || 'КАРТА', x + 11, top + 29, 10, tc, 850);
                drawGlyph(o.art, x + ww - 32, top + 42, 16, tc);
                const ey = multiline(o.name, x + 12, top + 53, ww - 62, 19, 15, PALETTE.ivory);
                const lines = o.lines?.length ? o.lines.slice(0, 4).map(q => `${q.sig} ${q.from} → ${q.to}`) : [o.note || 'Улучшение'];
                let yy = ey + 9;
                for (const ln of lines) {
                    if (yy > top + hh - 65)
                        break;
                    rect(x + 9, yy - 12, ww - 18, 24, '#1c343a', 6);
                    let size = 12;
                    c.font = `650 ${size}px system-ui`;
                    while (c.measureText(ln).width > ww - 35 && size > 9) {
                        size -= .5;
                        c.font = `650 ${size}px system-ui`;
                    }
                    txt(fit(ln, 44), x + 16, yy + 4, size, PALETTE.ivory);
                    yy += 29;
                }
                button('ВЫБРАТЬ', x + 12, top + hh - 43, ww - 24, 32, () => t.chooseUpgrade(i), true, false, 12, `Выбрать карту ${o.name}: ${o.note || 'Улучшение'}`);
                hit(x, top, ww, hh, () => t.chooseUpgrade(i), 'Карта ' + o.name, true, false);
            }
            return;
        }
        const target = 'ДРУЖИНА · ОБЩАЯ КАРТА';
        const b = dialogBase('СОВЕТ ДРУЖИНЫ', target), gap = 14, ww = (b.w - 50) / 2;
        const h = mobile ? Math.min(480, b.h - 145) : Math.min(340, b.h - 135), yy = b.y + 108;
        const tierRu = { common: 'ОБЫЧНАЯ', uncommon: 'НЕОБЫЧНАЯ', rare: 'РЕДКАЯ', epic: 'ЭПИЧЕСКАЯ', legendary: 'ЛЕГЕНДАРНАЯ' };
        for (let i = 0; i < 2; i++) {
            const o = modal.options[i];
            if (!o)
                continue;
            const x = b.x + 18 + i * (ww + gap), tierColor = rarityColors[o.tier] || PALETTE.ivory;
            const hovered = pointer.x >= x && pointer.x <= x + ww && pointer.y >= yy && pointer.y <= yy + h;
            c.save();
            if (hovered) {
                c.shadowColor = tierColor;
                c.shadowBlur = 20;
            }
            rect(x, yy, ww, h, hovered ? '#435955' : '#31474a', 14, tierColor, hovered ? 3 : 2);
            c.restore();
            rect(x + 6, yy + 6, ww - 12, 7, tierColor, 4);
            txt(tierRu[o.tier] || 'КАРТА', x + 16, yy + 33, mobile ? 12 : 12, tierColor, 900);
            const nameSize = mobile ? 18 : 21;
            const textEnd = multiline(o.name, x + 15, yy + 62, ww - 30, mobile ? 20 : 23, nameSize, PALETTE.ivory);
            const gy = textEnd + 6;
            rect(x + 15, gy, 57, 54, '#223b42', 10, '#788e80');
            drawGlyph(o.art, x + 43, gy + 27, 20, tierColor);
            const detailY = gy + 70;
            if (o.lines?.length) {
                const maxLines = Math.min(o.lines.length, mobile ? 7 : 5);
                for (let k = 0; k < maxLines; k++) {
                    const L = o.lines[k];
                    if (!L)
                        continue;
                    const ry = detailY + k * (mobile ? 31 : 27);
                    rect(x + 12, ry - 18, ww - 24, mobile ? 27 : 24, '#263d40', 6);
                    txt(L.sig, x + 21, ry, 17, tierColor, 900);
                    txt(fit(`${L.from} → ${L.to}`, 20), x + 53, ry, 13, PALETTE.ivory, 800);
                }
                if (o.lines.length > maxLines)
                    txt('и ещё ' + (o.lines.length - maxLines) + ' усилений', x + 14, detailY + maxLines * 29, 11, PALETTE.muted);
            }
            else
                multiline(o.note || 'Усиление дружины', x + 15, detailY, ww - 30, 21, mobile ? 12 : 14, PALETTE.ivory);
            const by = yy + h - 48;
            button(hovered ? 'ВЗЯТЬ КАРТУ' : 'ВЫБРАТЬ', x + 12, by, ww - 24, 36, () => t.chooseUpgrade(i), true, hovered, 14, `Выбрать карту ${o.name}: ${o.note || 'Улучшение'}`);
            // The whole board-game card selects the upgrade, not just its small button.
            // Region order is intentional: full-surface action is added last.
            hit(x, yy, ww, h, () => t.chooseUpgrade(i), 'Выбрать карту «' + o.name + '»', true, false);
        }
    }
    function drawGlyph(type, x, y, r, color) {
        c.save();
        c.translate(x, y);
        c.strokeStyle = color;
        c.fillStyle = color;
        c.lineWidth = Math.max(2, r * .1);
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath();
        switch (type) {
            case 'sun':
                c.arc(0, 0, r * .52, 0, Math.PI * 2);
                for (let i = 0; i < 8; i++) {
                    let a = i * Math.PI / 4;
                    c.moveTo(Math.cos(a) * r * .70, Math.sin(a) * r * .70);
                    c.lineTo(Math.cos(a) * r * 1.06, Math.sin(a) * r * 1.06);
                }
                break;
            case 'shield':
                c.moveTo(0, -r);
                c.lineTo(r * .75, -r * .52);
                c.lineTo(r * .65, r * .5);
                c.quadraticCurveTo(0, r * 1.3, -r * .65, r * .5);
                c.lineTo(-r * .75, -r * .52);
                c.closePath();
                c.moveTo(0, -r * .65);
                c.lineTo(0, r * .72);
                break;
            case 'bow':
                c.moveTo(-r * .56, -r);
                c.quadraticCurveTo(r * .67, 0, -r * .56, r);
                c.moveTo(-r * .56, -r);
                c.lineTo(r * .32, 0);
                c.lineTo(-r * .56, r);
                c.moveTo(-r * .8, 0);
                c.lineTo(r * .92, 0);
                c.moveTo(r * .92, 0);
                c.lineTo(r * .57, -r * .2);
                c.moveTo(r * .92, 0);
                c.lineTo(r * .57, r * .2);
                break;
            case 'sword':
                c.moveTo(-r * .8, r * .85);
                c.lineTo(r * .60, -r * .72);
                c.lineTo(r, -r);
                c.lineTo(r * .8, -r * .4);
                c.lineTo(-r * .65, r);
                c.moveTo(-r * .6, r * .15);
                c.lineTo(-r * .15, r * .55);
                break;
            case 'coin':
                c.arc(0, 0, r * .82, 0, Math.PI * 2);
                c.moveTo(r * .52, 0);
                c.arc(0, 0, r * .53, 0, Math.PI * 2);
                c.moveTo(0, -r * .37);
                c.lineTo(0, r * .37);
                c.moveTo(-r * .19, -r * .22);
                c.lineTo(r * .25, -r * .22);
                c.moveTo(-r * .25, r * .22);
                c.lineTo(r * .19, r * .22);
                break;
            case 'hearts':
                c.moveTo(0, r * .75);
                c.bezierCurveTo(-r * 1.4, -r * .04, -r * .92, -r * 1.12, 0, -r * .53);
                c.bezierCurveTo(r * .92, -r * 1.12, r * 1.4, -r * .04, 0, r * .75);
                break;
            case 'star':
                for (let i = 0; i < 10; i++) {
                    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .38 : r * .92;
                    if (!i)
                        c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
                    else
                        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
                }
                c.closePath();
                break;
            default:
                c.arc(0, 0, r * .65, 0, Math.PI * 2);
                c.moveTo(-r * .4, 0);
                c.lineTo(r * .4, 0);
        }
        c.stroke();
        c.restore();
    }
    function modalRecruit() {
        const modal = s.phase.modal;
        if (modal.type !== 'recruit')
            return;
        const slot = t.SLOTS[modal.slot], b = dialogBase(modal.replacing ? 'СМЕНА ДРУЖИННИКА' : 'НАЙМ РУСА', modal.replacing ? 'Половина прежних улучшений перейдёт новобранцу.' : `Позиция: урон ×${fmt(slot.mult)} · цена ◈${slot.price}`), w = (b.w - 54) / 3, yy = b.y + 113, h = mobile ? Math.min(440, b.h - 188) : Math.min(320, b.h - 168);
        for (let i = 0; i < 3; i++) {
            const o = modal.options[i];
            if (!o)
                continue;
            const x = b.x + 14 + i * (w + 13), col = t.CLASSES[o.klass].color, preview = { klass: o.klass, faces: o.faces, faceDamage: o.faceDamage, damage: o.damage, slotPower: 1, relics: [], mods: t.modifierDefaults(), x: 0 };
            const hovered = pointer.x >= x && pointer.x <= x + w && pointer.y >= yy && pointer.y <= yy + h;
            c.save();
            if (hovered) {
                c.shadowColor = col;
                c.shadowBlur = 18;
            }
            rect(x, yy, w, h, hovered ? '#47605a' : '#32474b', 13, col, hovered ? 3 : 2);
            c.restore();
            txt(fit(o.name, mobile ? 10 : 17), x + w / 2, yy + 39, mobile ? 14 : 19, col, 900, 'center');
            txt(fit(t.CLASSES[o.klass].name, mobile ? 12 : 22), x + w / 2, yy + 66, mobile ? 11 : 14, PALETTE.ivory, 750, 'center');
            txt('Урон ' + fmt(o.damage), x + w / 2, yy + 100, mobile ? 13 : 16, PALETTE.gold, 900, 'center');
            txt('Бросок ' + fmt(o.period) + ' с', x + w / 2, yy + 126, mobile ? 11 : 13, PALETTE.muted, 650, 'center');
            for (const j of UI_FACE_INDICES) {
                const xx = x + 8 + (j % 3) * (w - 16) / 3, ry = yy + 161 + Math.floor(j / 3) * 34;
                rect(xx + 1, ry - 19, (w - 16) / 3 - 3, 29, '#274244', 5);
                drawAttackMark(t.faceModeFor({ klass: o.klass }, j), xx + (w - 16) / 6, ry - 9, mobile ? 5 : 7, t.FACE_ATTACKS[j].color);
                txt('×' + (o.faces[j] || 1), xx + (w - 16) / 6, ry + 5, mobile ? 9 : 11, '#f3cf9b', 850, 'center');
                txt(t.faceSymbolFor({ klass: o.klass }, j), xx + (w - 16) / 3 - 12, ry + 5, 10, '#c8ddd0', 700, 'center');
                hit(xx, ry - 21, (w - 16) / 3, 32, () => { }, t.faceInfo(preview, j).label + ' · урон ' + fmt(o.damage * (o.faceDamage[j] || t.FACE_ATTACKS[j].damage)), true, false);
            }
            button(hovered ? 'НАНЯТЬ' : 'ВЫБРАТЬ', x + 10, yy + h - 47, w - 20, 35, () => t.recruitChoice(i), true, hovered, 13, `Нанять ${o.name}, ${t.CLASSES[o.klass].name}; урон ${fmt(o.damage)}, бросок ${fmt(o.period)} секунды`);
            hit(x, yy, w, h, () => t.recruitChoice(i), 'Нанять ' + o.name, true, false);
        }
        const backY = b.y + b.h - 49;
        button('НАЗАД', b.x + b.w / 2 - 72, backY, 144, 36, () => t.closeModal(), true, false, 14);
    }
    function modalEquip() {
        const modal = s.phase.modal;
        if (modal.type !== 'equip')
            return;
        const relicId = s.relics[modal.relicIndex];
        if (!relicId)
            return;
        const r = t.RELICS.find(z => z.id === relicId);
        const b = dialogBase('РЕЛИКВИЯ', r?.name || 'Выбери руса');
        rect(b.x + 25, b.y + 97, b.w - 50, 50, '#354c48', 8, '#8a9f82');
        multiline('ЭФФЕКТ: ' + (r?.desc || 'Неизвестный предмет'), b.x + 40, b.y + 117, b.w - 80, 19, 14, PALETTE.ivory);
        for (let i = 0; i < s.archers.length; i++) {
            const a = s.archers[i];
            if (!a)
                continue;
            const x = b.x + 30, yy = b.y + 162 + i * 50;
            button(`${a.name} · ${a.relics.length}/6`, x, yy, b.w - 60, 40, () => t.equipRelic(a.slot), a.relics.length < 6, false, 16, `Надеть ${r?.name || 'реликвию'} на ${a.name}; ячеек занято ${a.relics.length} из 6`);
        }
        button('ОТМЕНА', b.x + b.w / 2 - 100, b.y + b.h - 50, 200, 38, () => t.closeModal(), true, false, 13, 'Отменить выбор реликвии');
    }
    function modalRelics() { const slot = relicDetailSlot; if (slot === null || !isSlotId(slot))
        return; const a = getArch(slot); if (!a) {
        relicDetailSlot = null;
        return;
    } const b = dialogBase('РЕЛИКВИИ РУСА', a.name + ' · шесть ячеек'); const step = mobile ? 82 : 58, ww = b.w - 75; for (const i of UI_FACE_INDICES) {
        const id = a.relics[i], r = t.RELICS.find(z => z.id === id);
        const y = b.y + 108 + i * step;
        rect(b.x + 30, y, ww, step - 10, '#344d4c', 8, '#688075');
        txt(r ? ((r.icon || '◇') + '  ' + r.name) : '◇  Пустая ячейка', b.x + 46, y + 22, mobile ? 14 : 16, PALETTE.ivory);
        if (r)
            multiline(r.desc, b.x + 46, y + 40, ww - 170, 16, mobile ? 11 : 12, '#c8d8ce');
        if (r)
            button('СНЯТЬ', b.x + b.w - 143, y + 10, 103, step - 29, () => { t.unequipRelic(slot, i); if (!a.relics.length)
                relicDetailSlot = null; }, s.phase.mode === 'playing', false, 13, `Снять реликвию ${r.name}`);
    } button('ЗАКРЫТЬ', b.x + b.w / 2 - 100, b.y + b.h - 48, 200, 37, () => relicDetailSlot = null, true, false, 14, 'Закрыть реликвии лучника'); }
    function landingProgress() { if (launchStartedAt === null)
        return 0; const duration = uiReduceMotion() ? 0.72 : 1.28; return clamp((paintTime - launchStartedAt) / duration, 0, 1); }
    function drawLandingScene(magnification) {
        const archer = t.introArcher, scale = (mobile ? Math.max(VW / 900, VH * .58 / 540) : Math.max(VW / 900, VH / 540)) * magnification;
        const minX = VW - 900 * scale, minY = VH - 540 * scale;
        const targetX = mobile ? VW * .72 : VW * .62, targetY = VH * .78;
        const x = clamp(targetX - archer.x * scale, minX, 0), y = mobile ? VH * (hasPreviousRun() ? .235 : .31) : clamp(targetY - archer.y * scale, minY, 0);
        c.fillStyle = '#0c171d';
        c.fillRect(0, 0, VW, VH);
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.drawImage(sceneCanvas, x, y, 900 * scale, 540 * scale);
        if (mobile) {
            const fade = Math.min(100, 80 * scale), topEdge = c.createLinearGradient(0, y, 0, y + fade), bottomEdge = c.createLinearGradient(0, y + 540 * scale - fade, 0, y + 540 * scale);
            topEdge.addColorStop(0, '#0c171d');
            topEdge.addColorStop(1, 'rgba(12,23,29,0)');
            bottomEdge.addColorStop(0, 'rgba(12,23,29,0)');
            bottomEdge.addColorStop(1, '#0c171d');
            c.fillStyle = topEdge;
            c.fillRect(0, y, VW, fade);
            c.fillStyle = bottomEdge;
            c.fillRect(0, y + 540 * scale - fade, VW, fade);
        }
        c.fillStyle = 'rgba(4,12,17,.20)';
        c.fillRect(0, 0, VW, VH);
        if (mobile) {
            const top = c.createLinearGradient(0, 0, 0, VH * .50);
            top.addColorStop(0, 'rgba(5,13,19,.82)');
            top.addColorStop(.68, 'rgba(5,13,19,.30)');
            top.addColorStop(1, 'rgba(5,13,19,0)');
            c.fillStyle = top;
            c.fillRect(0, 0, VW, VH * .52);
            const bottom = c.createLinearGradient(0, VH * .58, 0, VH);
            bottom.addColorStop(0, 'rgba(5,13,19,0)');
            bottom.addColorStop(1, 'rgba(5,13,19,.82)');
            c.fillStyle = bottom;
            c.fillRect(0, VH * .58, VW, VH * .42);
        }
        else {
            const side = c.createLinearGradient(0, 0, VW * .82, 0);
            side.addColorStop(0, 'rgba(5,13,19,.86)');
            side.addColorStop(.47, 'rgba(5,13,19,.58)');
            side.addColorStop(1, 'rgba(5,13,19,0)');
            c.fillStyle = side;
            c.fillRect(0, 0, VW, VH);
        }
        return { x, y, scale };
    }
    function hasPreviousRun() { return t.meta.night > 1 || t.meta.runes > 0 || Object.entries(t.meta.nodes).some(([id, level]) => id !== 'root' && typeof level === 'number' && level > 0); }
    function landingLayout() {
        const hasRun = hasPreviousRun(), mainW = Math.min(mobile ? VW - 56 : 410, VW - 40), mainX = mobile ? (VW - mainW) / 2 : Math.max(72, VW * .065), mainH = mobile ? 58 : 62;
        const mainY = mobile ? VH - (hasRun ? 222 : 140) : Math.min(VH - 280, 566), forgeW = Math.min(mobile ? VW - 90 : 260, mainW), forgeH = mobile ? 58 : 42;
        const forgeX = mobile ? (VW - forgeW) / 2 : mainX, forgeY = mainY + mainH + (mobile ? 9 : 14), helpW = mobile ? 154 : 180, settingsW = mobile ? 154 : 180, helpH = mobile ? 58 : 40;
        const helpX = mobile ? (VW - helpW - settingsW - 10) / 2 : mainX, settingsX = helpX + helpW + 10, helpY = mobile ? VH - 66 : hasRun ? forgeY + forgeH + 12 : mainY + mainH + 16;
        return { mainX, mainY, mainW, mainH, forgeX, forgeY, forgeW, forgeH, helpX, helpY, helpW, helpH, settingsX, settingsW, hasRun };
    }
    function containsPoint(x, y, w, h) { return pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h; }
    function updateLandingMood() {
        const previous = landingHover;
        if (launchStartedAt !== null) {
            landingHover = 'roll';
            t.setIntroMood(landingHover);
            return;
        }
        if (helpOpen) {
            landingHover = 'help';
            t.setIntroMood(landingHover);
            return;
        }
        if (settingsOpen) {
            landingHover = 'idle';
            t.setIntroMood(landingHover);
            return;
        }
        if (tree) {
            landingHover = 'forge';
            t.setIntroMood(landingHover);
            return;
        }
        const layout = landingLayout();
        landingHover = containsPoint(layout.helpX, layout.helpY, layout.helpW, layout.helpH) ? 'help' : layout.hasRun && containsPoint(layout.forgeX, layout.forgeY, layout.forgeW, layout.forgeH) ? 'forge' : containsPoint(layout.mainX, layout.mainY, layout.mainW, layout.mainH) ? 'roll' : 'idle';
        t.setIntroMood(landingHover);
        if (landingHover === 'forge' && previous !== 'forge')
            playHammerTap();
    }
    function drawLandingMenu() {
        const won = s.phase.mode === 'win', lost = s.phase.mode === 'lose', layout = landingLayout();
        const center = mobile ? VW / 2 : Math.max(72, VW * .065), align = mobile ? 'center' : 'left';
        const kickerY = mobile ? 82 : 205, titleY = mobile ? 130 : 260, titleSize = mobile ? 29 : Math.min(52, VW * .046), titleLine = mobile ? 35 : 59;
        txt(`ПОСЛЕДНЯЯ ЗАСТАВА · НОЧЬ ${t.meta.night}`, center, kickerY, mobile ? 11 : 14, PALETTE.gold, 900, align);
        txt('РУСЫ ПРОТИВ', center, titleY, titleSize, PALETTE.ivory, 950, align);
        txt('ЯЩЕРОВ', center, titleY + titleLine, titleSize, PALETTE.ivory, 950, align);
        if (won || lost) {
            const result = won ? `ЗАСТАВА ВЫСТОЯЛА · ОТБИТО ВОЛН ${s.wave}` : `ДОЗОР ПАЛ · ОТБИТО ВОЛН ${s.wave}`;
            txt(result, center, titleY + titleLine + (mobile ? 31 : 40), mobile ? 11 : 14, won ? '#a9dfa9' : '#efaa91', 900, align);
        }
        const dieX = mobile ? VW * .5 : VW * .79, dieY = mobile ? VH * .32 : VH * .33, dieSize = mobile ? 96 : 142, reduced = uiReduceMotion();
        const glow = c.createRadialGradient(dieX, dieY, dieSize * .12, dieX, dieY, dieSize * 1.15);
        glow.addColorStop(0, landingHover === 'roll' ? 'rgba(244,192,112,.27)' : 'rgba(244,192,112,.16)');
        glow.addColorStop(1, 'rgba(244,192,112,0)');
        c.fillStyle = glow;
        c.fillRect(dieX - dieSize * 1.2, dieY - dieSize * 1.2, dieSize * 2.4, dieSize * 2.4);
        c.save();
        c.globalAlpha = .48;
        c.beginPath();
        c.ellipse(dieX, dieY + dieSize * .52, dieSize * .62, dieSize * .18, 0, 0, Math.PI * 2);
        c.fillStyle = '#081619';
        c.fill();
        c.restore();
        const ring = dieSize * (.69 + (reduced ? 0 : .025 * Math.sin(paintTime * 1.1)));
        c.save();
        c.globalAlpha = .32;
        c.strokeStyle = '#edca8a';
        c.lineWidth = 2.2;
        c.beginPath();
        c.ellipse(dieX, dieY + dieSize * .50, ring, ring * .28, 0, 0, Math.PI * 2);
        c.stroke();
        c.restore();
        const aiming = landingHover === 'roll', front = landingHover === 'help';
        if (menuDieLastTime !== null && !reduced)
            menuDieAngle += clamp(paintTime - menuDieLastTime, 0, .1) * (aiming ? 1.15 : .34);
        menuDieLastTime = paintTime;
        const rx = front ? 0 : -.34 + (reduced ? 0 : Math.sin(paintTime * .48) * .08), ry = front ? 0 : reduced ? .48 : menuDieAngle, face = t.frontFace(rx * 180 / Math.PI, ry * 180 / Math.PI);
        canvasDie(t.introArcher, dieX, dieY, dieSize, { rx, ry, rz: front ? 0 : reduced ? 0 : Math.sin(paintTime * .31) * .04, up: reduced ? 0 : -3 + Math.sin(paintTime * .9) * 2, scale: 1.03, phase: 'hold' }, true);
        rect(dieX - 95, dieY + dieSize * .66, 190, 30, 'rgba(21,34,34,.93)', 8, '#ae8c60', 1);
        txt('КОСТЬ СУДЬБЫ', dieX, dieY + dieSize * .66 + 20, mobile ? 12 : 14, '#ffe0a7', 900, 'center');
        const dieHitX = dieX - dieSize * .68, dieHitY = dieY - dieSize * .68, dieHitSize = dieSize * 1.36, dieHovered = containsPoint(dieHitX, dieHitY, dieHitSize, dieHitSize);
        hit(dieHitX, dieHitY, dieHitSize, dieHitSize, () => { }, 'Показать, что выпало на кости', true, false);
        if (dieHovered || landingHover === 'help') {
            const detail = t.faceInfo(t.introArcher, face), tw = Math.min(mobile ? VW - 38 : 330, VW - 28), th = 34, tx = clamp(dieX - tw / 2, 14, VW - tw - 14), ty = dieY + dieSize * .66 + 49;
            rect(tx, ty, tw, th, 'rgba(18,33,35,.94)', 9, '#c8a66f', 1.5);
            txt(`ВЫСТРЕЛОВ: ${detail.number} · ${detail.label}`, tx + tw / 2, ty + 22, mobile ? 11 : 13, '#ffe2ae', 900, 'center');
        }
        button('БРОСИТЬ КОСТЬ', layout.mainX, layout.mainY, layout.mainW, layout.mainH, () => { if (launchStartedAt === null)
            launchStartedAt = paintTime; }, true, true, mobile ? 17 : 20, 'Бросить кость и начать дозор', 'die');
        if (layout.hasRun)
            button('КУЗНИЦА РОДА', layout.forgeX, layout.forgeY, layout.forgeW, layout.forgeH, () => { tree = true; helpOpen = false; selectedMetaNode = null; treeOffset = { x: VW / 2 - 600 * treeScale, y: VH / 2 - 490 * treeScale }; }, true, false, mobile ? 12 : 14, `Открыть кузницу рода, рун: ${t.meta.runes}`, 'hammer');
        button('КАК ИГРАТЬ', layout.helpX, layout.helpY, layout.helpW, layout.helpH, () => { helpOpen = true; }, true, false, mobile ? 12 : 14, 'Кратко объяснить правила');
        button('НАСТРОЙКИ', layout.settingsX, layout.helpY, layout.settingsW, layout.helpH, () => { settingsOpen = true; }, true, false, mobile ? 12 : 14, 'Настройки меню');
    }
    function drawSettingsDialog() {
        const b = dialogBase('НАСТРОЙКИ', 'Комфортное меню');
        button('АНИМАЦИЯ: ' + (menuMotionReduced ? 'МЕНЬШЕ' : 'ОБЫЧНАЯ'), b.x + 30, b.y + 120, b.w - 60, 48, () => { menuMotionReduced = !menuMotionReduced; saveMenuSettings(); }, true, false, mobile ? 13 : 15, 'Уменьшить анимацию меню');
        button('ЗВУК МЕНЮ: ' + (menuSound ? 'ВКЛ' : 'ВЫКЛ'), b.x + 30, b.y + 180, b.w - 60, 48, () => { menuSound = !menuSound; saveMenuSettings(); }, true, false, mobile ? 13 : 15, 'Включить или выключить звук меню');
        multiline('Системная настройка уменьшения движения учитывается всегда.', b.x + 30, b.y + 258, b.w - 60, 22, 13, PALETTE.muted);
        button('ГОТОВО', b.x + b.w / 2 - 105, b.y + b.h - 61, 210, 42, () => { settingsOpen = false; }, true, true, 15, 'Закрыть настройки');
    }
    function drawHelpDialog() {
        const b = dialogBase('КАК ИГРАТЬ', 'Командуй заставой и держи оборону');
        const left = b.x + 24, width = b.w - 48;
        let y = b.y + 121;
        y = multiline('Ты — командир заставы русов. Отбивайся от подлых ящеров: бросай кость, чтобы воодушевить дружинников и заставить их стрелять.', left, y, width, 23, mobile ? 14 : 16, PALETTE.ivory) + 7;
        y = multiline('Грань показывает, насколько русы воодушевились: число определяет количество выстрелов, а знак — особый эффект атаки.', left, y, width, 23, mobile ? 14 : 16, PALETTE.ivory) + 7;
        y = multiline('За поверженных ящеров застава получает золото и опыт. Трать золото на новых русов, а опыт — на улучшение их боеспособности.', left, y, width, 23, mobile ? 14 : 16, PALETTE.ivory) + 7;
        multiline('После дозора руны останутся навсегда. Потрать их в кузнице рода перед следующей ночью.', left, y, width, 23, mobile ? 14 : 16, PALETTE.ivory);
        button('ПОНЯТНО', b.x + b.w / 2 - 105, b.y + b.h - 61, 210, 42, () => { helpOpen = false; }, true, true, 15, 'Вернуться к заставе');
    }
    function drawLanding() {
        updateLandingMood();
        const progress = landingProgress(), moving = launchStartedAt !== null;
        if (moving && progress >= 1) {
            launchStartedAt = null;
            helpOpen = false;
            t.reset();
            t.beginWave(true);
            gameEntryStartedAt = paintTime;
            return true;
        }
        const eased = progress * progress * (3 - 2 * progress), scene = drawLandingScene(1 + (moving ? (uiReduceMotion() ? .06 : .30) * eased : 0));
        if (moving) {
            const archer = t.introArcher, fromX = mobile ? VW * .5 : VW * .79, fromY = mobile ? VH * .32 : VH * .33, toX = scene.x + archer.x * scene.scale, toY = scene.y + (archer.y - 52) * scene.scale;
            const x = fromX + (toX - fromX) * eased, y = fromY + (toY - fromY) * eased, size = (mobile ? 96 : 142) * (1 - .82 * eased);
            c.save();
            c.globalAlpha = 1 - eased * .16;
            c.fillStyle = 'rgba(246,208,139,.20)';
            c.beginPath();
            c.arc(x, y, size * .82, 0, Math.PI * 2);
            c.fill();
            c.restore();
            const turns = uiReduceMotion() ? 1 : 10;
            canvasDie(archer, x, y, size, { rx: -.48 + progress * Math.PI * turns, ry: .5 + progress * Math.PI * (uiReduceMotion() ? 1 : 12), rz: progress * Math.PI * (uiReduceMotion() ? .5 : 3), up: uiReduceMotion() ? 0 : -8 * Math.sin(progress * Math.PI), scale: 1, phase: progress < .72 ? 'rolling' : 'landing' }, true);
            const labelAlpha = 1 - clamp(progress * 1.5, 0, 1);
            if (labelAlpha > .01) {
                c.save();
                c.globalAlpha = labelAlpha;
                txt('СУДЬБА РЕШАЕТСЯ…', VW / 2, VH * .89, mobile ? 12 : 15, PALETTE.gold, 900, 'center');
                c.restore();
            }
        }
        else if (tree) {
            drawTree();
        }
        else if (helpOpen) {
            drawHelpDialog();
        }
        else if (settingsOpen) {
            drawSettingsDialog();
        }
        else {
            drawLandingMenu();
        }
        return false;
    }
    function startOrPause() {
        const ww = Math.min(VW - 24, mobile ? 660 : 730), hh = 325, x = (VW - ww) / 2, y = (VH - hh) / 2;
        shade(.78);
        c.save();
        c.shadowColor = 'rgba(0,0,0,.5)';
        c.shadowBlur = 28;
        rect(x, y, ww, hh, '#22383f', 16, '#90a58a', 2);
        c.restore();
        rect(x + 8, y + 7, ww - 16, 5, '#b79a6a', 4);
        txt('КНЯЖЬЯ ПЕРЕДЫШКА', x + ww / 2, y + 49, mobile ? 22 : 30, PALETTE.ivory, 900, 'center');
        const lore = t.pauseMessage;
        multiline(lore, x + 30, y + 98, ww - 60, 24, mobile ? 15 : 18, PALETTE.ivory);
        const bw = Math.min(330, ww - 60), bx = x + (ww - bw) / 2, by = y + hh - 81;
        button('ПРОДОЛЖИТЬ', bx, by, bw, 48, () => t.pause(), true, true, mobile ? 15 : 17, 'Продолжить дозор');
        txt('P или Esc — продолжить', x + ww / 2, y + hh - 13, 12, PALETTE.muted, 650, 'center');
    }
    function drawTree() {
        shade(.98);
        const x = 14, y = 60, w = VW - 28, h = VH - 118;
        rect(x, y, w, h, '#141f28', 12, '#60756b');
        c.save();
        c.beginPath();
        c.rect(x, y, w, h);
        c.clip();
        const nodes = t.META_NODES;
        for (const n of nodes) {
            for (const p of n.pre) {
                const a = nodes.find(z => z.id === p);
                if (!a)
                    continue;
                const x1 = treeOffset.x + a.x * treeScale, y1 = treeOffset.y + a.y * treeScale, x2 = treeOffset.x + n.x * treeScale, y2 = treeOffset.y + n.y * treeScale;
                const active = t.metaLevel(p) > 0;
                c.beginPath();
                c.moveTo(x1, y1);
                c.lineTo(x2, y2);
                c.strokeStyle = active ? '#6fd1a0' : '#27343a';
                c.lineWidth = active ? 4 : 3;
                c.stroke();
            }
        }
        for (const n of nodes) {
            const xx = treeOffset.x + n.x * treeScale, yy = treeOffset.y + n.y * treeScale, r = 36 * treeScale, purchased = t.metaLevel(n.id), ready = n.pre.every(p => t.metaLevel(p) > 0), maxed = purchased >= n.max, affordable = ready && t.meta.runes >= t.metaPrice(n.id) && !maxed;
            const fill = maxed ? '#255842' : purchased > 0 ? '#2c5447' : affordable ? '#324c62' : '#1a2025';
            const stroke = maxed ? '#7fe3a5' : affordable ? '#d8d67e' : '#4b5960';
            c.beginPath();
            c.arc(xx, yy, r, 0, 2 * Math.PI);
            c.fillStyle = fill;
            c.fill();
            c.strokeStyle = stroke;
            c.lineWidth = maxed ? 4 : 3;
            c.stroke();
            if (maxed) {
                c.beginPath();
                c.arc(xx, yy, r + 6, 0, 2 * Math.PI);
                c.strokeStyle = 'rgba(127,227,165,.24)';
                c.lineWidth = 6;
                c.stroke();
            }
            txt(n.id === 'root' ? '✹' : n.title.slice(0, 1), xx, yy + 5, Math.max(13, 22 * treeScale), maxed ? '#e8fff1' : affordable ? '#eef4ff' : ready ? '#f4dfb2' : '#76838a', 900, 'center');
            if (treeScale > .40)
                txt(fit(n.title, 18), xx, yy + r + 18, Math.max(10, 15 * treeScale), maxed ? '#c4ffd9' : affordable ? '#e2ecff' : '#c0cbc5', 760, 'center');
            if (maxed)
                txt('МАКС', xx, yy - r - 8, Math.max(9, 12 * treeScale), '#9cf0b7', 900, 'center');
            else if (affordable)
                txt('ᛟ' + t.metaPrice(n.id), xx, yy - r - 8, Math.max(9, 12 * treeScale), '#f4e08d', 850, 'center');
            hit(xx - r, yy - r, r * 2, r * 2, () => { selectedMetaNode = n.id; }, n.title + ' · ' + n.desc, true);
        }
        c.restore();
        txt('КУЗНИЦА РОДА · ᛟ ' + t.meta.runes, 23, 39, mobile ? 18 : 23, PALETTE.gold, 900);
        button('НАЗАД', VW - 175, 13, 155, 36, () => { tree = false; selectedMetaNode = null; }, true, false, 14, 'Закрыть дерево улучшений');
        button('＋', VW - 130, VH - 54, 43, 37, () => zoom(1.2), true, false, 23, 'Увеличить масштаб дерева');
        button('−', VW - 75, VH - 54, 43, 37, () => zoom(.82), true, false, 23, 'Уменьшить масштаб дерева');
        txt('Серое — закрыто · синее/жёлтое — можно купить · зелёное — изучено', 25, VH - 23, 12, PALETTE.muted);
        if (selectedMetaNode) {
            const n = nodes.find(z => z.id === selectedMetaNode);
            if (n) {
                const mw = Math.min(440, VW - 32), mh = 310, mx = VW - mw - 16, my = Math.max(60, (VH - mh) / 2), lvl = t.metaLevel(n.id), maxed = lvl >= n.max;
                rect(mx, my, mw, mh, '#283f43', 15, maxed ? '#7fe3a5' : '#e6c38a', 2);
                txt(fit(n.title, 28), mx + 20, my + 42, 22, maxed ? '#c7ffd8' : PALETTE.gold, 900);
                multiline(n.desc, mx + 20, my + 82, mw - 40, 22, 16, PALETTE.ivory);
                txt('Уровень ' + lvl + ' из ' + n.max, mx + 20, my + 145, 14, PALETTE.muted);
                txt(maxed ? 'МАКСИМУМ ДОСТИГНУТ' : 'Цена: ᛟ ' + t.metaPrice(n.id), mx + 20, my + 170, 17, maxed ? '#8fe5aa' : PALETTE.gold, 850);
                const can = n.pre.every(p => t.metaLevel(p) > 0) && t.meta.runes >= t.metaPrice(n.id) && lvl < n.max;
                button(maxed ? 'МАКС' : 'ИЗУЧИТЬ', mx + 20, my + 224, mw - 125, 45, () => { t.buyMeta(n.id); selectedMetaNode = null; }, can, can, 16, `Изучить улучшение ${n.title} за ${t.metaPrice(n.id)} рун`);
                button('×', mx + mw - 67, my + 224, 46, 45, () => selectedMetaNode = null, true, false, 18, 'Закрыть описание улучшения');
            }
        }
    }
    function zoom(f) { const cx = VW / 2, cy = VH / 2; treeOffset.x = cx - (cx - treeOffset.x) * f; treeOffset.y = cy - (cy - treeOffset.y) * f; treeScale = clamp(treeScale * f, .3, 1.65); }
    function draw() {
        if (Math.min(Math.max(devicePixelRatio || 1, 1), 2) !== currentDpr)
            resize();
        paintTime = performance.now() / 1000;
        c.setTransform(screen.width / VW, 0, 0, screen.height / VH, 0, 0);
        regions = [];
        if (['idle', 'win', 'lose'].includes(s.phase.mode) && !drawLanding()) {
            activeRegionStart = 0;
            const activeRegions = regions.slice(activeRegionStart), region = activeRegions.findLast(r => r.enabled && pointer.x >= r.x && pointer.x <= r.x + r.w && pointer.y >= r.y && pointer.y <= r.y + r.h);
            screen.style.cursor = region ? 'pointer' : tree ? 'grab' : 'default';
            syncCanvasControls(activeRegionStart);
            drawUiBursts();
            requestAnimationFrame(draw);
            return;
        }
        const entering = gameEntryStartedAt !== null, entryDuration = uiReduceMotion() ? .42 : .58;
        const entryAlpha = entering ? clamp((paintTime - (gameEntryStartedAt ?? paintTime)) / entryDuration, 0, 1) : 1;
        if (entering && entryAlpha >= 1)
            gameEntryStartedAt = null;
        c.save();
        c.globalAlpha = entryAlpha;
        header();
        stage();
        mainPanels();
        const overlayStart = regions.length, hasOverlay = tree || relicDetailSlot !== null || ['paused', 'upgrade', 'recruit', 'equip'].includes(s.phase.mode);
        if (hasOverlay)
            controlMenuOpen = false;
        else if (controlMenuOpen)
            drawControlMenu();
        if (tree)
            drawTree();
        else if (relicDetailSlot !== null)
            modalRelics();
        else if (s.phase.mode === 'upgrade')
            modalUpgrade();
        else if (s.phase.mode === 'recruit')
            modalRecruit();
        else if (s.phase.mode === 'equip')
            modalEquip();
        else if (s.phase.mode === 'paused')
            startOrPause();
        c.restore();
        activeRegionStart = entryAlpha < .9 ? regions.length : hasOverlay || controlMenuOpen ? overlayStart : 0;
        const activeRegions = regions.slice(activeRegionStart), region = activeRegions.findLast(r => r.enabled && pointer.x >= r.x && pointer.x <= r.x + r.w && pointer.y >= r.y && pointer.y <= r.y + r.h);
        screen.style.cursor = region ? 'pointer' : tree ? 'grab' : 'default';
        if (region?.tip && region.tip !== '+' && pointer.x > 0 && ['playing', 'recruit'].includes(s.phase.mode)) {
            const tip = String(region.tip), ww = Math.min(VW - 24, Math.max(220, Math.min(450, tip.length * 6))), xx = clamp(pointer.x - ww / 2, 12, VW - ww - 12), yy = clamp(pointer.y - 91, 12, VH - 92);
            rect(xx, yy, ww, 75, '#102b32', 9, '#87a999', 1.5);
            c.save();
            c.beginPath();
            c.rect(xx + 9, yy + 4, ww - 18, 68);
            c.clip();
            multiline(tip, xx + 10, yy + 20, ww - 20, 18, 12, PALETTE.ivory);
            c.restore();
        }
        syncCanvasControls(activeRegionStart);
        drawUiBursts();
        requestAnimationFrame(draw);
    }
    function point(ev) { const r = screen.getBoundingClientRect(); return { x: (ev.clientX - r.left) * VW / r.width, y: (ev.clientY - r.top) * VH / r.height }; }
    screen.addEventListener('pointerdown', ev => { if (landingHover === 'forge')
        void unlockUiAudio().then(playHammerTap);
    else
        void unlockUiAudio(); pointer = Object.assign(pointer, point(ev), { down: true }); drag = { ...pointer, ox: treeOffset.x, oy: treeOffset.y }; screen.setPointerCapture(ev.pointerId); });
    screen.addEventListener('pointerleave', () => { pointer.x = -1; pointer.y = -1; });
    screen.addEventListener('pointermove', ev => { pointer = Object.assign(pointer, point(ev)); if (tree && drag && pointer.down) {
        treeOffset.x = drag.ox + pointer.x - drag.x;
        treeOffset.y = drag.oy + pointer.y - drag.y;
    } });
    screen.addEventListener('pointerup', ev => { pointer = Object.assign(pointer, point(ev), { down: false }); if (drag && Math.hypot(pointer.x - drag.x, pointer.y - drag.y) < 12) {
        const r = [...regions.slice(activeRegionStart)].reverse().find(q => pointer.x >= q.x && pointer.x <= q.x + q.w && pointer.y >= q.y && pointer.y <= q.y + q.h);
        if (r?.enabled)
            try {
                const rx = r.x + r.w / 2, ry = r.y + r.h / 2;
                r.fn();
                actionBurst(rx, ry);
            }
            catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                console.error('Canvas UI click', detail);
            }
    } drag = null; });
    screen.addEventListener('wheel', ev => { if (tree) {
        ev.preventDefault();
        zoom(ev.deltaY < 0 ? 1.12 : .88);
    } }, { passive: false });
    window.addEventListener('keydown', ev => { if (ev.code === 'Space' && !ev.repeat && !controlMenuOpen && !tree && !helpOpen && !settingsOpen && relicDetailSlot === null && !(ev.target instanceof HTMLButtonElement) && !(ev.target instanceof HTMLInputElement) && !(ev.target instanceof HTMLTextAreaElement) && t.canManualVolley()) {
        ev.preventDefault();
        t.manualVolley();
        return;
    } if (ev.code === 'Escape') {
        if (launchStartedAt !== null) {
            launchStartedAt = null;
            return;
        }
        if (settingsOpen) {
            settingsOpen = false;
        }
        else if (helpOpen) {
            helpOpen = false;
        }
        else if (controlMenuOpen) {
            controlMenuOpen = false;
        }
        else if (tree) {
            if (selectedMetaNode)
                selectedMetaNode = null;
            else
                tree = false;
        }
        else if (relicDetailSlot !== null)
            relicDetailSlot = null;
        else if (['recruit', 'equip'].includes(s.phase.mode))
            t.closeModal();
        else if (['paused', 'playing'].includes(s.phase.mode))
            t.pause();
    } });
    requestAnimationFrame(draw);
})();
//# sourceMappingURL=canvas-ui.js.map