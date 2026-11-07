/* ================================================================
   SCROLL HUNTER · engine/environment.js — фон подземелья, факелы, пыль
   ================================================================ */
'use strict';

const locationBackgrounds = {};
for (const name of ['camp', 'shop']) {
    const image = new Image();
    image.src = 'assets/' + name + '-background.jpg';
    locationBackgrounds[name] = image;
}

/* ================================================================
   SCROLL HUNTER · engine/render.js — окружение, сундуки, заставки
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   5. Окружение подземелья
--------------------------------------------------------------- */
let WALL_H = 250;
const introPartyImage = new Image();
introPartyImage.src = 'assets/scroll-hunters-menu.png';
const reducedMotionMedia = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

function prefersReducedMotion() {
    return !!(reducedMotionMedia && reducedMotionMedia.matches);
}

function buildBackground() {
    bgLayer = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    bgLayer.width = Math.round(VIEW_W * dpr);
    bgLayer.height = Math.round(VIEW_H * dpr);
    const b = bgLayer.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Стена */
    const wall = b.createLinearGradient(0, 0, 0, WALL_H);
    wall.addColorStop(0, '#080d1a');
    wall.addColorStop(0.6, '#0d1425');
    wall.addColorStop(1, '#111a2e');
    b.fillStyle = wall;
    b.fillRect(0, 0, VIEW_W, WALL_H);

    /* Кладка */
    b.strokeStyle = 'rgba(255,255,255,0.025)';
    b.lineWidth = 2;
    for (let row = 0; row < Math.ceil(WALL_H / 58); row++) {
        const y = 20 + row * 58;
        const off = row % 2 ? 46 : 0;
        for (let x = -80 + off; x < VIEW_W + 80; x += 92) {
            b.strokeRect(x, y, 92, 58);
        }
    }

    /* Мягкие пятна света по стене */
    const pool = b.createRadialGradient(VIEW_W / 2, WALL_H, 60, VIEW_W / 2, WALL_H, 520);
    pool.addColorStop(0, 'rgba(80,130,220,0.10)');
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    b.fillStyle = pool;
    b.fillRect(0, 0, VIEW_W, WALL_H);

    /* Стык стены и пола */
    const base = b.createLinearGradient(0, WALL_H - 14, 0, WALL_H + 4);
    base.addColorStop(0, '#1a233d');
    base.addColorStop(1, '#05080f');
    b.fillStyle = base;
    b.fillRect(0, WALL_H - 12, VIEW_W, 16);

    /* Пол и перспектива нужны только если стена не заняла весь экран. */
    if (WALL_H < VIEW_H) {
        const floor = b.createLinearGradient(0, WALL_H, 0, VIEW_H);
        floor.addColorStop(0, '#090d18');
        floor.addColorStop(1, '#04060c');
        b.fillStyle = floor;
        b.fillRect(0, WALL_H, VIEW_W, VIEW_H - WALL_H);

        b.strokeStyle = 'rgba(255,255,255,0.022)';
        b.lineWidth = 1;
        const vpX = VIEW_W / 2, vpY = WALL_H;
        for (let i = 1; i <= 7; i++) {
            const y = WALL_H + Math.pow(i / 7, 1.8) * (VIEW_H - WALL_H);
            b.beginPath(); b.moveTo(0, y); b.lineTo(VIEW_W, y); b.stroke();
        }
        for (let i = -7; i <= 7; i++) {
            b.beginPath();
            b.moveTo(vpX + i * 26, vpY);
            b.lineTo(vpX + i * 190, VIEW_H);
            b.stroke();
        }
    }

    /* Пыль в углах */
    const dust = b.createRadialGradient(VIEW_W / 2, VIEW_H, 120, VIEW_W / 2, VIEW_H, 640);
    dust.addColorStop(0, 'rgba(0,0,0,0)');
    dust.addColorStop(1, 'rgba(2,4,10,0.75)');
    b.fillStyle = dust;
    b.fillRect(0, 0, VIEW_W, VIEW_H);
}

const torches = [
    { x: 112, y: 64, phase: 0.0 },
    { x: 888, y: 64, phase: 2.4 }
];

function updateEnvironmentLayout() {
    WALL_H = VIEW_H;
    torches[0].x = VIEW_W * 0.112;
    torches[1].x = VIEW_W * 0.888;
    torches.forEach(tr => { tr.y = WALL_H * 0.25; });
    motes.forEach(m => {
        if (m.x > VIEW_W) m.x = randIn('visual', 0, VIEW_W);
        if (m.y > VIEW_H) m.y = randIn('visual', 60, VIEW_H);
    });
}

/* Пылинки, висящие в воздухе */
const motes = [];
for (let i = 0; i < 46; i++) {
    motes.push({
        x: randIn('visual', 0, VIEW_W), y: randIn('visual', 60, VIEW_H),
        r: randIn('visual', 0.6, 2.1), sp: randIn('visual', 4, 16), ph: randIn('visual', 0, TAU), a: randIn('visual', 0.08, 0.3)
    });
}

function updateMotes(dt, t) {
    if (prefersReducedMotion()) return;
    for (const m of motes) {
        m.y -= m.sp * dt * 0.35;
        m.x += Math.sin(t * 0.6 + m.ph) * 6 * dt;
        if (m.y < 40) { m.y = VIEW_H + 10; m.x = randIn('visual', 0, VIEW_W); }
    }
}

function drawTorch(tr, t) {
    const flick = prefersReducedMotion()
        ? 0.82
        : 0.82 + Math.sin(t * 9 + tr.phase) * 0.09 + Math.sin(t * 21.7 + tr.phase * 2) * 0.06;
    const fx = prefersReducedMotion() ? tr.x : tr.x + Math.sin(t * 6.3 + tr.phase) * 1.6;

    /* Световое пятно на стене */
    ctx.save();
    const glow = ctx.createRadialGradient(tr.x, tr.y + 10, 10, tr.x, tr.y + 10, 280 * flick);
    glow.addColorStop(0, 'rgba(255,168,72,0.20)');
    glow.addColorStop(0.45, 'rgba(255,140,50,0.07)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y + 10, 280 * flick, 0, TAU);
    ctx.fill();
    ctx.restore();

    /* Крепление */
    ctx.fillStyle = '#2a2f3d';
    ctx.fillRect(tr.x - 4, tr.y + 20, 8, 30);
    ctx.fillStyle = '#1b1f2a';
    ctx.fillRect(tr.x - 12, tr.y + 46, 24, 8);

    /* Пламя */
    ctx.save();
    ctx.translate(fx, tr.y + 16);
    const h = 32 * flick;
    ctx.shadowBlur = 26;
    ctx.shadowColor = 'rgba(255,150,40,0.85)';
    const flame = ctx.createLinearGradient(0, 8, 0, -h);
    flame.addColorStop(0, 'rgba(255,80,20,0.15)');
    flame.addColorStop(0.35, '#ff7a18');
    flame.addColorStop(0.7, '#ffc24d');
    flame.addColorStop(1, '#fff3c4');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(-11, 0, -8, -h * 0.7, 0, -h);
    ctx.bezierCurveTo(8, -h * 0.7, 11, 0, 0, 10);
    ctx.fill();
    ctx.restore();
}


/* Переключение сцены подземелья */
function drawScene(name) {
    currentScene = name || null;
}

function drawEnvironment(t, scene) {
    scene = scene || currentScene;

    /* Лёгкий оттенок комнаты, чтобы залы не были одинаковыми */
    if (roomTint.a > 0) {
        ctx.save();
        ctx.globalAlpha = roomTint.a;
        ctx.fillStyle = `hsl(${roomTint.h}, ${roomTint.s}%, 50%)`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.restore();
    }

    if (scene) drawSceneProps(t, scene);
}

function drawEnvironmentBackdrop(t) {
    const renderState = gameState === STATES.INVENTORY ? inventoryReturnState : gameState;
    const location = renderState === STATES.CAMP ? 'camp' : renderState === STATES.SHOP ? 'shop' : null;
    const illustration = location && locationBackgrounds[location];
    if (illustration?.complete && illustration.naturalWidth) {
        const scale = Math.max(VIEW_W / illustration.naturalWidth, VIEW_H / illustration.naturalHeight);
        const w = illustration.naturalWidth * scale, h = illustration.naturalHeight * scale;
        ctx.drawImage(illustration, (VIEW_W - w) / 2, (VIEW_H - h) / 2, w, h);
        const shade = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        shade.addColorStop(0, 'rgba(4,7,12,0.2)');
        shade.addColorStop(0.55, 'rgba(4,7,12,0.02)');
        shade.addColorStop(1, 'rgba(4,7,12,0.58)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else if (bgLayer) ctx.drawImage(bgLayer, 0, 0, VIEW_W, VIEW_H);
    if (!location) torches.forEach(tr => drawTorch(tr, t));

    /* Пылинки */
    ctx.save();
    for (const m of motes) {
        ctx.globalAlpha = m.a * (prefersReducedMotion() ? 0.75 : 0.6 + 0.4 * Math.sin(t * 1.7 + m.ph));
        ctx.fillStyle = '#cfe0ff';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, TAU);
        ctx.fill();
    }
    ctx.restore();
}

function drawIntroJourney(t, hero) {
    if (!hero || hero.h < 24 || !introPartyImage.complete || !introPartyImage.naturalWidth || !introPartyImage.naturalHeight) return;
    const ratio = introPartyImage.naturalWidth / introPartyImage.naturalHeight;
    const compact = hero.w < 600;
    const drawW = Math.min(hero.w * (compact ? 0.69 : 0.41), hero.h * 0.92 * ratio);
    const drawH = drawW / ratio;
    const x = hero.x + hero.w * (compact ? 0.025 : 0.12);
    const y = hero.y + hero.h - drawH + hero.h * 0.015;

    ctx.save();
    roundRect(ctx, hero.x, hero.y, hero.w, hero.h, 14);
    ctx.clip();
    ctx.save();
    ctx.fillStyle = 'rgba(3,5,8,0.25)';
    ctx.shadowColor = 'rgba(3,5,8,0.42)';
    ctx.shadowBlur = compact ? 7 : 9;
    ctx.beginPath();
    ctx.ellipse(x + drawW * 0.38, hero.y + hero.h - 3, drawW * 0.105, compact ? 4 : 5, 0, 0, TAU);
    ctx.ellipse(x + drawW * 0.8, hero.y + hero.h - 3, drawW * 0.12, compact ? 4 : 5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.96;
    ctx.drawImage(introPartyImage, x, y, drawW, drawH);
    ctx.restore();
}

/* Гравировка с номером зала */
/* ---------------------------------------------------------------
   Сцены: у каждого состояния свой контекст вместо общей пещеры
   --------------------------------------------------------------- */
function drawSceneProps(t, scene) {
    const cx = VIEW_W / 2;
    const floorY = 250;

    /* Use the full illustrated scene instead of drawing the old schematic
       campfire and stall on top of it. */
    if ((scene === 'camp' || scene === 'shop') && locationBackgrounds[scene]?.complete && locationBackgrounds[scene].naturalWidth) return;

    switch (scene) {
        case 'camp': drawCampSceneProps(t, cx, floorY); break;
        case 'shop': drawShopSceneProps(t, cx, floorY); break;
        case 'event': drawEventSceneProps(t, cx, floorY); break;
        case 'boss': drawBossSceneProps(t, cx, floorY); break;
    }
}

function drawCampSceneProps(t, cx, floorY) {
    /* Костёр */
    const flick = 0.85 + Math.sin(t * 9) * 0.1 + Math.sin(t * 21) * 0.05;
    ctx.save();
    const pool = ctx.createRadialGradient(cx, floorY, 10, cx, floorY, 300);
    pool.addColorStop(0, 'rgba(255,150,60,0.22)');
    pool.addColorStop(0.5, 'rgba(255,120,40,0.07)');
    pool.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(cx, floorY + 10, 300, 160, 0, 0, TAU);
    ctx.fill();

    /* Поленья */
    ctx.fillStyle = '#4a3524';
    ctx.save();
    ctx.translate(cx, floorY + 14);
    ctx.rotate(-0.22);
    ctx.fillRect(-34, -5, 68, 11);
    ctx.restore();
    ctx.save();
    ctx.translate(cx, floorY + 14);
    ctx.rotate(0.22);
    ctx.fillRect(-34, -5, 68, 11);
    ctx.restore();

    /* Камни */
    ctx.fillStyle = '#3a3f4a';
    for (let i = 0; i < 6; i++) {
        const a2 = Math.PI + (i / 5) * Math.PI;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a2) * 40, floorY + 18 + Math.sin(a2) * 8, 9, 6, 0, 0, TAU);
        ctx.fill();
    }

    /* Пламя */
    const h = 58 * flick;
    ctx.shadowBlur = 34;
    ctx.shadowColor = 'rgba(255,150,50,0.8)';
    const flame = ctx.createLinearGradient(0, 12, 0, -h);
    flame.addColorStop(0, 'rgba(255,90,20,0.25)');
    flame.addColorStop(0.4, '#ff7a18');
    flame.addColorStop(0.75, '#ffc24d');
    flame.addColorStop(1, '#fff3c4');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(cx, 16);
    ctx.bezierCurveTo(cx - 26, 0, cx - 16, -h * 0.8, cx, -h);
    ctx.bezierCurveTo(cx + 16, -h * 0.8, cx + 26, 0, cx, 16);
    ctx.fill();
    ctx.restore();
    return;
}

function drawShopSceneProps(t, cx, floorY) {
    /* Прилавок с навесом и фонарём */
    ctx.save();
    const warm = ctx.createRadialGradient(cx, 150, 10, cx, 150, 260);
    warm.addColorStop(0, 'rgba(190,150,255,0.16)');
    warm.addColorStop(1, 'rgba(120,90,200,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    /* Столбцы */
    ctx.strokeStyle = '#2a2436';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - 190, floorY);
    ctx.lineTo(cx - 190, 96);
    ctx.moveTo(cx + 190, floorY);
    ctx.lineTo(cx + 190, 96);
    ctx.stroke();

    /* Навес */
    ctx.fillStyle = '#3b2f4d';
    ctx.beginPath();
    ctx.moveTo(cx - 215, 96);
    ctx.lineTo(cx + 215, 96);
    ctx.lineTo(cx + 190, 62);
    ctx.lineTo(cx - 190, 62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(167,139,250,0.28)';
    for (let i = -3; i <= 3; i++) {
        ctx.fillRect(cx + i * 56 - 13, 62, 26, 34);
    }

    /* Прилавок */
    ctx.fillStyle = '#241d2e';
    ctx.fillRect(cx - 175, floorY - 52, 350, 52);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(cx - 175, floorY - 52, 350, 5);

    /* Товар */
    const goods = ['#f0b24a', '#58c7f0', '#a78bfa', '#f2555a'];
    for (let i = 0; i < 4; i++) {
        ctx.fillStyle = goods[i];
        ctx.globalAlpha = 0.75;
        ctx.fillRect(cx - 140 + i * 74, floorY - 74 - (i % 2) * 10, 30, 24);
        ctx.globalAlpha = 1;
    }

    /* Фонарь */
    const lx = cx + 190;
    ctx.strokeStyle = '#3a3450';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, 96);
    ctx.lineTo(lx, 126);
    ctx.stroke();
    ctx.fillStyle = '#ffd98a';
    ctx.shadowBlur = 22;
    ctx.shadowColor = 'rgba(255,200,120,0.9)';
    ctx.beginPath();
    ctx.arc(lx, 138, 11, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
}

function drawEventSceneProps(t, cx, floorY) {
    /* Разлом в воздухе */
    ctx.save();
    const glow = ctx.createRadialGradient(cx, 190, 8, cx, 190, 250);
    glow.addColorStop(0, 'rgba(120,200,255,0.2)');
    glow.addColorStop(0.6, 'rgba(90,150,255,0.05)');
    glow.addColorStop(1, 'rgba(90,150,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const pulse = 1 + Math.sin(t * 1.6) * 0.04;
    ctx.save();
    ctx.translate(cx, 190);
    ctx.scale(1, 1.5 * pulse);
    ctx.strokeStyle = 'rgba(160,220,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(120,200,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 62, 62, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160,220,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 48, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    /* Искры */
    for (let i = 0; i < 18; i++) {
        const ph = t * 0.6 + i * 1.7;
        const x = cx + Math.sin(ph) * 90;
        const y = 190 + ((ph * 40) % 180) - 90;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#9fe8ff';
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, TAU);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
}

function drawBossSceneProps(t, cx, floorY) {
    /* Тронный зал */
    ctx.save();
    const red = ctx.createRadialGradient(cx, 250, 20, cx, 250, 420);
    red.addColorStop(0, 'rgba(220,50,70,0.22)');
    red.addColorStop(0.5, 'rgba(160,30,50,0.07)');
    red.addColorStop(1, 'rgba(160,30,50,0)');
    ctx.fillStyle = red;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    /* Колонны */
    ctx.fillStyle = '#171320';
    for (const px of [170, 830]) {
        ctx.fillRect(px - 26, 70, 52, 180);
        ctx.fillRect(px - 34, 60, 68, 16);
        ctx.fillRect(px - 34, 238, 68, 14);
    }

    /* Трон */
    ctx.fillStyle = '#241a2b';
    ctx.fillRect(cx - 78, 140, 156, 110);
    ctx.fillRect(cx - 62, 108, 124, 34);
    ctx.fillStyle = 'rgba(255,80,100,0.14)';
    ctx.fillRect(cx - 62, 108, 124, 34);
    ctx.fillStyle = '#120e18';
    ctx.fillRect(cx - 46, 150, 92, 100);
    ctx.restore();
    return;
}

