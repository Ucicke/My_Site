"use strict";
// Cached SVG parts share one coordinate system and a neck pivot.
// Arms, hands, string and arrow use the same grip/nock points in every pose.
(() => {
    'use strict';
    const parts = {
        legs: '<path d="M-17-14 L-20 12 Q-25 19-36 19 L-36 25 Q-18 29-9 22 L-3 4 L4 4 L9 22 Q18 29 36 25 L36 19 Q23 19 20 12 L17-14Z" fill="#805038" stroke="#241d1b" stroke-width="5.5" stroke-linejoin="round"/><path d="M-17-12 L-20 11 L-9 13 L-3 4 L4 4 L9 13 L20 11 L17-12Z" fill="#60382d"/><path d="M-20 14 Q-25 20-34 21 L-34 25 Q-18 27-10 21L-8 15ZM9 15L11 21Q19 27 34 25v-4q-10-1-14-7Z" fill="#4b2d25"/><path d="M-18 13h9M10 13h9" stroke="#e3b36e" stroke-width="1.3"/>',
        torso: '<path d="M-25-64 Q-16-73-5-70 Q12-74 25-65 Q30-57 27-44 Q22-32 21-25 Q24-16 21-7 Q0 1-21-7 Q-24-17-21-27 Q-27-39-29-49 Q-31-58-25-64Z" fill="#70ac55" stroke="#241d1b" stroke-width="5.5" stroke-linejoin="round"/><path d="M-26-57 Q-16-50-14-36 L-19-29 Q-20-20-19-10 L-22-9 Q-24-18-21-27 Q-29-42-26-57Z M12-49Q20-47 25-54L24-39 19-29 12-35Z" fill="#39703c"/><path d="M-20-17 Q0-10 20-17 L19-8 Q0-2-20-8Z" fill="#315f35"/><path d="M-23-59 Q-5-45 22-59" fill="none" stroke="#e9c27d" stroke-width="1.5"/><path d="M-22-27 Q0-20 22-27 L21-18 Q0-11-21-18Z" fill="#b56835" stroke="#2d2623" stroke-width="2.1"/><path d="M-20-20 Q0-14 20-20 L20-18 Q0-12-20-18Z" fill="#713b29"/><path id="belt-buckle" d="M-4-25 Q.5-25.5 5-24 L4.5-16.5 Q0-17-4.2-16.8Z" fill="#f6ce70" stroke="#2d2623" stroke-width="1.5" stroke-linejoin="round"/><path d="M-15-38 Q-9.8-39-4-37.6 L-4.2-29 Q-9-28-15.2-29.5Z" fill="#d3a05e" stroke="#3d3826" stroke-width="1.2" stroke-linejoin="round"/><path d="M-13.8-36.4l-.1 1.2m.1 1.5v1.2m.3 1.6l1.1.2m1.3.1l1.1.1m1.3 0l1.1-.2m1.4-.1l.1-1.2m.1-1.4v-1.2" fill="none" stroke="#705039" stroke-width=".7" stroke-linecap="round"/>',
        bodyShadows: '<path d="M-17-64 Q0-69 18-64 L17-56 Q14-47 1-45 Q-12-46-17-55Z" fill="#245331"/><path d="M-17-64 Q0-69 18-64" fill="none" stroke="#c69c63" stroke-width="1.2"/>',
        armShadow: '<path d="M11-62 Q19-62 24-57 L25-48 L19-42 Q13-46 6-52Z" fill="#2c6036"/>',
        head: '<path d="M-19-90 Q-22-111-2-115 Q18-116 21-96 L18-78 Q9-66-7-68 Q-19-72-19-90Z" fill="#f3bd8d" stroke="#241d1b" stroke-width="5.5"/><path d="M-18-105 Q0-111 19-105 L20-96 Q5-101-18-96Z" fill="#b96e55"/><path d="M-17-82Q-8-73 3-73L10-68Q-7-64-17-75Z M12-82l-7 5 9 1 4-4Z" fill="#d99369"/><path d="M15-87q8 4 1 7" fill="#e29b71" stroke="#302721" stroke-width="1.4"/>',
        browsRelax: '<path d="M5-96 L19-100 L19-96 L7-93Z M-13-97 L-2-94 L-3-91 L-14-94Z" fill="#543225"/>',
        browsStrain: '<path d="M5-94 L19-99 L19-95 L7-91Z M-13-98 L-2-94 L-3-90 L-14-94Z" fill="#543225"/>',
        eyeOpen: '<path d="M7-92 Q12-96 19-91 Q14-85 7-88Z M-14-91 Q-9-94-3-90 Q-8-86-14-89Z" fill="#fff0ca" stroke="#302721" stroke-width="1.2"/><circle cx="16" cy="-90" r="1.8" fill="#282321"/><circle cx="-5.5" cy="-90" r="1.6" fill="#282321"/>',
        eyeStrain: '<path d="M7-90 Q12-87 19-91" fill="none" stroke="#302721" stroke-width="2.1" stroke-linecap="round"/><path d="M-14-91 Q-9-94-3-90 Q-8-86-14-89Z" fill="#fff0ca" stroke="#302721" stroke-width="1.2"/><circle cx="-5.5" cy="-90" r="1.6" fill="#282321"/><path d="M10-87l-2 2m7-3 1 2" fill="none" stroke="#a9684f" stroke-width="1"/>',
        hat: '<path d="M-23-105 Q-23-125-5-129 Q12-129 21-111 L22-105 Q1-111-23-105Z" fill="#c65b3a" stroke="#2d2623" stroke-width="4.5" stroke-linejoin="round"/><path d="M-22-112Q-20-125-8-128Q-14-118-10-111Z" fill="#8e382e"/><path d="M-23-109 Q-1-116 22-108 L23-102 Q1-108-23-102Z" fill="#efd09a" stroke="#2d2623" stroke-width="3"/><path d="M-21-104Q0-110 21-104" fill="none" stroke="#bc936b" stroke-width="1.5"/><path d="M-6-128l5-5 6 5" fill="#f5cf7e" stroke="#2d2623" stroke-width="1.8"/>',
        beard: '<path d="M-18-83 Q-14-70-6-66 L-3-51 L4-58 L10-56 L14-69 L20-80 Q14-77 8-80 Q2-75-4-80 Q-11-76-18-83Z" fill="#a35a32" stroke="#2d2623" stroke-width="4" stroke-linejoin="round"/><path d="M-17-81Q-10-74-5-77Q-5-67-1-57L-3-53L-7-66Q-15-71-17-81Z M8-75Q13-75 18-79L13-68 10-58 6-60Z" fill="#703b2d"/><path d="M-7-74q-3 8 2 14m5-14q-1 8 3 11" fill="none" stroke="#d28d51" stroke-width="1.2"/><path d="M2-80q5-7 10-4q4 2 7-1q-1 7-8 6q-5-1-9 2q-4-3-9-1q-6 2-8-4q5 2 8 0q5-4 9 2Z" fill="#79432c" stroke="#2d2623" stroke-width="2"/>',
        gripHand: '<path d="M-7-3 Q-6-7-2-7 L2-6 Q6-6 6-2 L6 3 Q4 7 0 7 L-4 6 Q-7 5-7 1Z" fill="#f3bd8d" stroke="#2d2623" stroke-width="3.2" stroke-linejoin="round"/><path d="M-5 2Q-4 6 1 6Q4 5 5 3" fill="#cc8c68"/><path d="M-5-2Q-1-3 2-1Q4 1 2 3Q0 4-2 2" fill="#f3bd8d" stroke="#a76e50" stroke-width="1.2"/><path d="M2-5v3m2-2v3" stroke="#a76e50" stroke-width="1"/>',
        drawHand: '<path d="M-6-2 Q-6-6-2-6 L2-6 Q6-6 7-2 L6 4 Q3 7-1 6 L-5 4Z" fill="#f3bd8d" stroke="#2d2623" stroke-width="2.5" stroke-linejoin="round"/><path d="M-5 2Q-3 6 1 6L5 3" fill="#cc8c68"/><path d="M-3-3l5 1m-5 2 5 1m-5 1 4 1" stroke="#a76e50" stroke-width="1.2" stroke-linecap="round"/>',
    };
    const torsoOutline = /^<path d="([^"]+)"/.exec(parts.torso)?.[1];
    if (!torsoOutline)
        throw new Error('The archer torso outline is missing.');
    const VIEW_X = -90, VIEW_Y = -150, VIEW_WIDTH = 280, VIEW_HEIGHT = 210;
    const VIEW_BOX = `${VIEW_X} ${VIEW_Y} ${VIEW_WIDTH} ${VIEW_HEIGHT}`;
    const POSE_STEPS = 20;
    const RECOIL_STEPS = 12;
    const ANIMATION_TIMING = { idleFrame: .1, drawFrame: .025, drawHold: .15, releaseFrames: [.016, .032, .05, .05, .05], recoverFrame: .06 };
    const RELEASE_DURATION = ANIMATION_TIMING.releaseFrames.reduce((sum, duration) => sum + duration, 0);
    const SPRITE_CACHE_LIMIT = 8;
    const spriteCache = new Map();
    const projectileCache = new Map();
    const tracerAnchors = new WeakMap();
    const DEFAULT_APPEARANCE = { height: 1, bodyW: 1, hood: 0, scar: 0, patch: 0, trim: 2, bowTilt: 0, cap: 1, wear: 0, beard: 2, beardLen: 1, moustache: 1 };
    const CLASS_PALETTE = {
        short: { tunic: '#83b86a', shade: '#527744', deep: '#315f35', cap: '#4d8878', capShade: '#315e58', beard: '#a35a32' },
        medium: { tunic: '#70ac55', shade: '#3f7d42', deep: '#315f35', cap: '#c65b3a', capShade: '#8e382e', beard: '#a35a32' },
        heavy: { tunic: '#b86f58', shade: '#754b45', deep: '#513b38', cap: '#7b668d', capShade: '#51465f', beard: '#694638' }
    };
    function clamp(value, min, max) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
    function n(value) { return String(Math.round(value * 100) / 100); }
    function p(x, y) { return { x, y }; }
    function pathPoints(points) { const first = points[0]; if (!first)
        return ''; return `M${n(first.x)} ${n(first.y)}${points.slice(1).map(point => ` L${n(point.x)} ${n(point.y)}`).join('')}`; }
    function colorize(markup, palette) {
        const substitutions = [['#70ac55', palette.tunic], ['#3f7d42', palette.shade], ['#315f35', palette.deep], ['#2c6036', palette.deep], ['#c65b3a', palette.cap], ['#8e382e', palette.capShade], ['#a35a32', palette.beard]];
        return substitutions.reduce((value, [from, to]) => value.replaceAll(from, to), markup);
    }
    function safeAppearance(source) {
        return { height: clamp(source.height, .6, 1.6), bodyW: clamp(source.bodyW, .7, 1.35), hood: source.hood ? 1 : 0, scar: source.scar ? 1 : 0, patch: source.patch ? 1 : 0, trim: Math.round(clamp(source.trim, 0, 2)), bowTilt: clamp(source.bowTilt, -12, 12), cap: Math.round(clamp(source.cap, 0, 2)), wear: clamp(source.wear, 0, 1), beard: Math.round(clamp(source.beard, 0, 3)), beardLen: clamp(source.beardLen, .65, 1.5), moustache: source.moustache ? 1 : 0 };
    }
    function normalizedRelics(relics = []) { return [...new Set(relics)]; }
    function safeConfig(klass, appearance, relics = []) { return { klass, appearance: safeAppearance(appearance), relics: normalizedRelics(relics) }; }
    function appearanceKey(config) { return `${config.klass}|${Object.values(config.appearance).join(',')}|${config.relics.join(',')}`; }
    function inverseBody(point, x, y, angle) {
        const px = point.x - x, py = point.y - y + 15, cosine = Math.cos(angle), sine = Math.sin(angle);
        return p(px * cosine + py * sine, -px * sine + py * cosine - 15);
    }
    function loadedArrowMarkup(nock, bodyAngle, bodyWidth, aimAngle, opacity) {
        const relativeAngle = aimAngle - bodyAngle, cosine = Math.cos(relativeAngle), sine = Math.sin(relativeAngle);
        const point = (x, y) => p(nock.x + (x * cosine - y * sine) / bodyWidth, nock.y + x * sine + y * cosine);
        const length = 71;
        const shaft = pathPoints([point(0, 0), point(length, 0)]);
        const head = pathPoints([point(length - 9, -4), point(length, 0), point(length - 9, 4), point(length - 7, 0)]);
        const feathers = pathPoints([point(0, 0), point(-5, -5), point(2, -5), point(7, 0), point(2, 5), point(-5, 5)]);
        const featherDetail = pathPoints([point(-2, -3), point(2, 0), point(-2, 3)]);
        return `<g id="arrow-current" opacity="${n(opacity)}"><path id="arrow-shaft" d="${shaft}" fill="none" stroke="#2d2623" stroke-width="3.5"/><path d="${shaft}" fill="none" stroke="#e8bc71" stroke-width="1.8"/><path id="arrow-tip" d="${head}Z" fill="#e7e8dc" stroke="#2d2623" stroke-width="1.4"/><path d="${feathers}Z" fill="#f6e3af" stroke="#2d2623" stroke-width="1"/><path d="${featherDetail}" fill="none" stroke="#ce8b58" stroke-width="1"/></g>`;
    }
    function quiverFeathers() {
        const arrows = [[-42, -103], [-31, -106], [-20, -105]];
        return `<g id="quiver-arrows"><path d="M-36-72L-42-103M-31-70L-31-106M-27-70L-20-105" fill="none" stroke="#2d211d" stroke-width="5" stroke-linecap="round"/><path d="M-36-72L-42-103M-31-70L-31-106M-27-70L-20-105" fill="none" stroke="#edc67d" stroke-width="2.2"/>${arrows.map(([x, y], index) => `<g id="quiver-feather-${index + 1}" fill="#f6e3af" stroke="#342820" stroke-width="1.4" stroke-linejoin="round"><path d="M${x} ${y}l-10-7 2 7-8-3 5 7-7-1 7 5-5 1 8 4 8-1-5-4 7 1-6-5 7 1-7-6 6 1-6-8Z"/><path d="M${x} ${y - 10}V${y + 3}" fill="none" stroke="#8f6847" stroke-width="1.3"/></g>`).join('')}</g>`;
    }
    function handImage(key, x, y, pull = 0, open = false) {
        const id = key === 'gripHand' ? 'hand-left-grip' : 'hand-right-draw';
        const fingers = `M-3-3l${n(5 - pull)} 1m${n(-5 + pull)} 2 ${n(5 - pull)} 1m${n(-5 + pull)} 1 ${n(4 - pull)} 1`;
        const hand = key === 'drawHand' && open ? '<path d="M-6-2 Q-7-6-4-8 L-2-6 L-1-9 L1-9 L2-6 L4-8 L6-7 L6-3 Q9-2 7 1 L4 6 Q0 8-5 4Z" fill="#f3bd8d" stroke="#2d2623" stroke-width="2.5" stroke-linejoin="round"/><path d="M-4-4l1 3m2-5 1 4m3-4-1 4" fill="none" stroke="#a76e50" stroke-width="1.2"/>' : key === 'drawHand' ? parts.drawHand.replace('M-3-3l5 1m-5 2 5 1m-5 1 4 1', fingers) : parts.gripHand;
        return `<svg id="${id}" x="${n(x - 9)}" y="${n(y - 9)}" width="18" height="18" viewBox="-9 -9 18 18">${hand}</svg>`;
    }
    function relicMarkup(relics) {
        return `<g id="relics">${relics.map((relic, index) => {
            const x = -9 + index * 5.5;
            if (relic === 'perun')
                return `<g id="relic-perun"><path d="M${x} 5l3 3-3 3-3-3Z" fill="#f5d26f" stroke="#4d3727" stroke-width=".8"/><path d="M${x} 6v4m-1-2h2" stroke="#805427" stroke-width=".7"/></g>`;
            if (relic === 'kvass')
                return `<g id="relic-kvass"><rect x="${x - 1.5}" y="4" width="4" height="7" rx="1" fill="#a86d43" stroke="#4d3727" stroke-width=".8"/><path d="M${x - 1} 6h3" stroke="#edc67d" stroke-width=".7"/></g>`;
            if (relic === 'boots')
                return `<g id="relic-boots"><path d="M${x - 2} 5h2v3l2 1v2h-5v-2l1-1Z" fill="#aa7750" stroke="#4d3727" stroke-width=".7"/></g>`;
            if (relic === 'amulet')
                return `<g id="relic-amulet"><path d="M${x} 4v4l2 2-2 2-2-2 2-2" fill="#8ad6cd" stroke="#4d3727" stroke-width=".8"/></g>`;
            return `<g id="relic-quiver"><path d="M${x - 2} 5v6m2-7v7m2-6v6" stroke="#edc67d" stroke-width=".8"/><path d="M${x - 2} 5l1-2 1 2m1 0 1-2 1 2" fill="#f2d9a2" stroke="#4d3727" stroke-width=".6"/></g>`;
        }).join('')}</g>`;
    }
    function facialHairMarkup(config, pull, beardLift = 0, breath = 0) {
        const ap = config.appearance, palette = CLASS_PALETTE[config.klass];
        const beardMarkup = ap.moustache ? parts.beard : parts.beard.replace(/<path d="M2-80q5-7[^"]*"[^>]*\/>/, '');
        const beard = ap.beard ? colorize(beardMarkup, palette) : '';
        const moustache = !ap.beard && ap.moustache ? `<path id="moustache" d="M-2-80Q-11-87-17-81Q-12-75-3-77Q0-73 3-77Q12-75 17-81Q10-87 2-80Z" fill="${palette.beard}" stroke="#2d2623" stroke-width="2"/>` : '';
        const compression = clamp((pull - .5) / .5, 0, 1), beardScale = (.82 + ap.beardLen * .18) * (1 - .05 * compression) * (1 + .02 * breath);
        return `<g id="facial-hair" style="transform:translate(${n(-1.5 * pull + beardLift * .3)}px,${n(-4 * compression - beardLift + 1.6 * breath)}px) scaleY(${n(beardScale)})">${beard}${moustache}</g>`;
    }
    function headMarkup(config, pull, trim, beardLift = 0, breath = 0) {
        const ap = config.appearance, palette = CLASS_PALETTE[config.klass], strain = Math.max(0, (pull - .55) / .45);
        const hood = ap.hood ? `<path id="hood" d="M-25-104Q-30-127 0-135Q27-129 28-103L17-108Q12-126 0-126Q-13-124-17-103Z" fill="${palette.capShade}" stroke="#241d1b" stroke-width="4"/>` : '';
        const scar = ap.scar ? '<path id="scar" d="M8-91l7 10" stroke="#7d3f36" stroke-width="2" stroke-linecap="round"/>' : '';
        const hat = ap.cap === 1 ? colorize(parts.hat, palette) : ap.cap === 0
            ? `<path id="hat" d="M-25-106Q-23-132 0-137Q21-134 26-108L14-111Q-3-118-25-106Z" fill="${palette.cap}" stroke="#2d2623" stroke-width="5"/><path d="M-22-108Q1-119 26-108L25-100Q1-111-22-101Z" fill="${trim}" stroke="#2d2623" stroke-width="3"/>`
            : `<path id="hat" d="M-24-111Q0-123 24-111L22-100Q0-108-23-100Z" fill="${palette.cap}" stroke="#2d2623" stroke-width="5"/><path d="M-22-105Q0-113 23-105" fill="none" stroke="${trim}" stroke-width="2.5"/>`;
        const brow = strain > .2 ? parts.browsStrain : parts.browsRelax, eye = strain > .2 ? parts.eyeStrain : parts.eyeOpen;
        const helmet = config.klass === 'heavy' ? '<path id="class-helmet" d="M-29-102L-22-132 0-141 23-129 30-101 14-108 9-122 0-113-13-123-17-105Z" fill="#706377" stroke="#241d1b" stroke-width="5"/><path d="M-22-115H23M0-137v23" stroke="#e1c17c" stroke-width="2.5"/>' : '';
        return `<g id="head" style="transform:rotate(${-pull * 2.2}deg)">${hood}${parts.head}${facialHairMarkup(config, pull, beardLift, breath)}${brow}${eye}${scar}${hat}${helmet}<path id="head-shadow" d="M-18-105Q0-114 18-105L16-96Q0-102-17-96Z" fill="#965d48" opacity=".38"/></g>`;
    }
    function renderArcherSvg(klass, appearance, pullInput = 0, shotFlash = 0, relicList = [], recoilProgress = null, breath = 0, hideRecoverySmoke = false) {
        const config = safeConfig(klass, appearance, relicList), ap = config.appearance, art = CLASS_PALETTE[klass], pull = clamp(pullInput, 0, 1), flash = clamp(shotFlash, 0, 1);
        const trim = ap.trim === 0 ? '#e9c27d' : ap.trim === 1 ? art.cap : '#f1d7a0';
        const recoil = recoilProgress === null ? null : clamp(recoilProgress, 0, 1);
        const snap = recoil === null ? 0 : Math.max(0, 1 - recoil / .17);
        const settle = recoil === null ? 0 : recoil < .3 ? recoil / .3 : Math.max(0, (1 - recoil) / .7);
        const impact = recoil === null ? 0 : recoil < 1 / 12 ? recoil * 12 : Math.max(0, (.3 - recoil) / (.3 - 1 / 12));
        const ripple = recoil === null ? 0 : Math.sin(recoil * Math.PI * 5) * (1 - recoil);
        const beardLift = 4 * snap + 8 * impact + 4 * settle + ripple;
        const braceProgress = clamp((pull - .65) / .35, 0, 1), brace = braceProgress * braceProgress * (3 - 2 * braceProgress);
        const crouch = recoil === null ? 8 * (pull <= .35 ? pull / .35 : 1 - clamp((pull - .35) / .4, 0, 1)) : 0;
        const bodyX = -3 * pull - 4 * brace + 3 * snap + 3 * impact - 2 * settle, bodyY = crouch + 5 * impact + 1.5 * settle + 2 * breath;
        const lean = pull <= .25 ? 0 : pull <= .75 ? 8 * (pull - .25) : 5;
        const bodyAngle = (-lean * (1 - impact) + 3 * impact) * Math.PI / 180, bodyWidth = Number(n(ap.bodyW));
        const push = clamp((pull - .4) / .35, 0, 1);
        const frontShoulder = 14 + 5 * pull + 1.5 * brace + 7 * push + 6 * snap, shoulder = p(frontShoulder * Math.cos(bodyAngle) + 44 * Math.sin(bodyAngle) + bodyX, -15 + frontShoulder * Math.sin(bodyAngle) - 44 * Math.cos(bodyAngle) + bodyY);
        const armAngle = -.015 * brace - .11 * snap + .14 * settle;
        const armDx = 52 * Math.cos(armAngle) + 18 * Math.sin(armAngle), armDy = 52 * Math.sin(armAngle) - 18 * Math.cos(armAngle);
        const grip = p(shoulder.x + armDx, shoulder.y + armDy), leftElbow = p(shoulder.x + armDx / 2, shoulder.y + armDy / 2);
        const localDelta = (x, y) => p((x * Math.cos(bodyAngle) + y * Math.sin(bodyAngle)) / bodyWidth, -x * Math.sin(bodyAngle) + y * Math.cos(bodyAngle));
        const leftShoulderLocal = inverseBody(shoulder, bodyX, bodyY, bodyAngle), elbowDelta = localDelta(leftElbow.x - shoulder.x, leftElbow.y - shoulder.y), wristDelta = localDelta(armDx, armDy);
        const leftElbowLocal = p(leftShoulderLocal.x + elbowDelta.x, leftShoulderLocal.y + elbowDelta.y), leftWristLocal = p(leftShoulderLocal.x + wristDelta.x, leftShoulderLocal.y + wristDelta.y);
        const curve = recoil === null ? 22 + 12 * pull : 22, bowHalf = recoil === null ? 55 - 10 * pull : 55;
        const bowTilt = clamp(ap.bowTilt, -4, 4) * Math.PI / 180, pivot = leftWristLocal;
        const weaponPoint = (x, y) => {
            const dx = x * Math.cos(bowTilt) - y * Math.sin(bowTilt), dy = x * Math.sin(bowTilt) + y * Math.cos(bowTilt);
            return p(pivot.x + (dx * Math.cos(bodyAngle) + dy * Math.sin(bodyAngle)) / bodyWidth, pivot.y - dx * Math.sin(bodyAngle) + dy * Math.cos(bodyAngle));
        };
        const nockX = recoil === null ? -curve * (1 - pull) + (14 - grip.x) * pull : -curve + 10 * snap + 2 * ripple;
        const stringNock = weaponPoint(nockX, -5), backShoulder = p(-13 - 7 * pull - 3 * brace, -60 - 12 * pull - brace);
        const wristX = recoil === null ? nockX : -curve + (14 - grip.x + curve) * (1 - recoil) - 12 * snap;
        const elbowLift = 8 * clamp(pull / .35, 0, 1) * (1 - clamp((pull - .35) / .65, 0, 1));
        const rightShoulderLocal = inverseBody(backShoulder, bodyX, bodyY, bodyAngle), rightElbowLocal = weaponPoint(recoil === null ? nockX - 49 + 6 * pull : wristX - 20 - 29 * recoil, -5 + 24 * (1 - pull) - pull + 2 * brace + 8 * settle - 7 * snap - (recoil === null ? elbowLift : 0)), rightWristLocal = recoil === null ? stringNock : weaponPoint(wristX, -5 + 10 * settle);
        const outline = '#2d2623', sleeve = art.tunic, skin = '#f3bd8d';
        const rightArm = `<g id="arm-right-pull"><path id="arm-right-outline" d="${pathPoints([rightShoulderLocal, rightElbowLocal, rightWristLocal])}" fill="none" stroke="${outline}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><path id="arm-right-sleeve" d="${pathPoints([rightShoulderLocal, rightElbowLocal])}" fill="none" stroke="${sleeve}" stroke-width="13" stroke-linecap="round"/><path id="arm-right-forearm" d="${pathPoints([rightElbowLocal, rightWristLocal])}" fill="none" stroke="${skin}" stroke-width="11" stroke-linecap="round"/><path d="${pathPoints([p(rightShoulderLocal.x, rightShoulderLocal.y + 3), p(rightElbowLocal.x, rightElbowLocal.y + 3)])}" fill="none" stroke="${art.shade}" stroke-width="2.4" stroke-linecap="round"/></g>`;
        const shoulderFold = `M${n(leftShoulderLocal.x - 8)} ${n(leftShoulderLocal.y + 5)} Q${n(leftShoulderLocal.x - 2)} ${n(leftShoulderLocal.y + 8)} ${n(leftShoulderLocal.x + 4)} ${n(leftShoulderLocal.y + 4)}`;
        const leftArm = `<path id="arm-left-outline" d="${pathPoints([leftShoulderLocal, leftElbowLocal, leftWristLocal])}" fill="none" stroke="${outline}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" mask="url(#shoulder-outline-mask)"/><path id="arm-left-sleeve" d="${pathPoints([leftShoulderLocal, leftElbowLocal])}" fill="none" stroke="${sleeve}" stroke-width="13" stroke-linecap="round"/><path id="arm-left-forearm" d="${pathPoints([leftElbowLocal, leftWristLocal])}" fill="none" stroke="${skin}" stroke-width="11" stroke-linecap="round"/><path d="${pathPoints([p(leftShoulderLocal.x, leftShoulderLocal.y + 3), p(leftElbowLocal.x, leftElbowLocal.y + 3)])}" fill="none" stroke="${art.shade}" stroke-width="2.4" stroke-linecap="round"/><path id="shoulder-fold" d="${shoulderFold}" fill="none" stroke="${art.shade}" stroke-width="1.5" stroke-linecap="round" opacity="${n(.15 + .45 * brace)}"/>`;
        const bowWidth = curve / 14, bowHeight = bowHalf / 55;
        const bowPoint = (x, y) => weaponPoint(x - curve, y);
        const coords = (point) => `${n(point.x)} ${n(point.y)}`;
        const stringTop = bowPoint(0, -bowHalf), stringBottom = bowPoint(0, bowHalf);
        const outer = bowPoint(36 * bowWidth, 0), inner = bowPoint(20 * bowWidth, 0), shadow = bowPoint(25 * bowWidth, 0);
        const bowPath = `M${coords(stringTop)} Q${coords(outer)} ${coords(stringBottom)} Q${coords(inner)} ${coords(stringTop)} Z`;
        const bowShadow = `M${coords(stringTop)} Q${coords(shadow)} ${coords(stringBottom)} Q${coords(inner)} ${coords(stringTop)} Z`;
        const highlight = `M${coords(bowPoint(4 * bowWidth, -bowHalf + 10 * bowHeight))} Q${coords(bowPoint(33 * bowWidth, 0))} ${coords(bowPoint(4 * bowWidth, bowHalf - 10 * bowHeight))}`;
        const wrap = pathPoints([bowPoint(14 * bowWidth, -7 * bowHeight), bowPoint(14 * bowWidth, 7 * bowHeight)]);
        const wrapDetail = [-5, -2, 1].map(y => pathPoints([bowPoint(11 * bowWidth, y * bowHeight), bowPoint(17 * bowWidth, (y + 2) * bowHeight)])).join(' ');
        const bow = `<g id="bow-weapon" mask="url(#bow-grip-mask)"><path id="bow-wood" d="${bowPath}" fill="#d49343" stroke="#241d1b" stroke-width="5" stroke-linejoin="round"/><path id="bow-shadow" d="${bowShadow}" fill="#8d4c2b"/><path id="bow-outline" d="${bowPath}" fill="none" stroke="#241d1b" stroke-width="5"/><path id="bow-highlight" d="${highlight}" fill="none" stroke="#efb963" stroke-width="1.5" stroke-linecap="round"/><path id="bow-wrap" d="${wrap}" fill="none" stroke="#673b2a" stroke-width="6"/><path d="${wrapDetail}" fill="none" stroke="#f2d18d" stroke-width="1.3"/><path id="bow-stress" d="${bowPath}" fill="none" stroke="#241d1b" stroke-width="7" opacity="${n(Math.max(0, (pull - .72) / .28) * .35)}"/></g>`;
        const string = `<path id="bow-string" d="M${n(stringTop.x)} ${n(stringTop.y)} Q${n(stringNock.x)} ${n(stringNock.y)} ${n(stringNock.x)} ${n(stringNock.y)} L${n(stringBottom.x)} ${n(stringBottom.y)}" fill="none" stroke="#e2d4a9" stroke-width="2" stroke-linejoin="miter" mask="url(#bow-string-mask)"/>`;
        const cheekMask = `<g style="transform-box:view-box;transform-origin:0px -66px;transform:rotate(${-pull * 2.2}deg)"><path d="M-21-105Q0-114 21-105L20-84Q0-80-20-84Z" fill="#000"/></g>`;
        const hairSilhouette = facialHairMarkup(config, pull, beardLift, breath).replace(/\s+id="[^"]+"/g, '').replace(/\b(fill|stroke)="(?!none")[^"]*"/g, (_match, attribute) => `${attribute}="#000"`);
        const hairMask = `<g data-occluder="facial-hair" style="transform-box:view-box;transform-origin:0px -66px;transform:rotate(${-pull * 2.2}deg)">${hairSilhouette}</g>`;
        const maskBackground = '<rect x="-200" y="-250" width="500" height="500" fill="#fff"/>';
        const armMask = `<path d="${pathPoints([leftShoulderLocal, leftElbowLocal, leftWristLocal])}" fill="none" stroke="#000" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${n(leftWristLocal.x)}" cy="${n(leftWristLocal.y)}" r="9" fill="#000"/>`;
        const gripSilhouette = parts.gripHand.replace(/\b(fill|stroke)="(?!none")[^"]*"/g, (_match, attribute) => `${attribute}="#000"`);
        const rigMasks = `<mask id="bow-string-mask" maskUnits="userSpaceOnUse" x="-200" y="-250" width="500" height="500">${maskBackground}${armMask}${cheekMask}${hairMask}</mask><mask id="draw-hand-mask" maskUnits="userSpaceOnUse" x="-200" y="-250" width="500" height="500">${maskBackground}${cheekMask}${hairMask}</mask><mask id="shoulder-outline-mask" maskUnits="userSpaceOnUse" x="-200" y="-250" width="500" height="500">${maskBackground}<path d="${torsoOutline}" fill="#000" stroke="#000" stroke-width="3"/></mask><mask id="bow-grip-mask" maskUnits="userSpaceOnUse" x="-200" y="-250" width="500" height="500">${maskBackground}<svg x="${n(leftWristLocal.x - 9)}" y="${n(leftWristLocal.y - 9)}" width="18" height="18" viewBox="-9 -9 18 18">${gripSilhouette}</svg></mask>`;
        const loadedArrow = loadedArrowMarkup(stringNock, bodyAngle, bodyWidth, bowTilt, recoil === null && flash <= .04 ? 1 : 0);
        const patch = ap.patch ? '<g id="patch"><path d="M20-28Q25-31 30-27L29-15Q23-14 19-18Z" fill="#d3b985" stroke="#3d3826" stroke-width="1.2"/><path d="M21-26l2 1 2-1 2 1 2-1m-7 7 2 1 2-1 2 1 2-1" fill="none" stroke="#755a3d" stroke-width=".8" stroke-linecap="round"/></g>' : '<g id="patch" opacity="0"/>';
        const wear = ap.wear > .05 ? `<g id="wear" fill="none" stroke="#604e3c" stroke-width="1.2" opacity="${n(ap.wear)}"><path d="M-23-49l5 3m-2-8 4 3m20 38 4 3m-9-1 4 3M-17-6l5 2m26-44 3 4"/><path d="M-20 14l5 2m24-27 3 3" stroke="${trim}"/></g>` : '<g id="wear" opacity="0"/>';
        const vfxFrame = recoil === null ? -1 : hideRecoverySmoke ? 5 : Math.round(recoil * RECOIL_STEPS);
        let shot = '<g id="shot-vfx"/>';
        if (vfxFrame === 0) {
            const rays = Array.from({ length: 16 }, (_, i) => { const angle = -Math.PI / 2 + i * Math.PI / 8, radius = i % 2 ? 12 : 36; return weaponPoint(18 + Math.cos(angle) * radius, -5 + Math.sin(angle) * radius); });
            const ring = `M${coords(weaponPoint(-13, -5))} Q${coords(weaponPoint(0, -18))} ${coords(weaponPoint(13, -5))} Q${coords(weaponPoint(0, 8))} ${coords(weaponPoint(-13, -5))}`;
            const tracer = pathPoints([weaponPoint(20, -7), weaponPoint(240, -5), weaponPoint(20, -3)]);
            shot = `<g id="shot-vfx"><path id="vfx-tracer" d="${tracer}Z" fill="#fff" opacity=".85"/><path id="vfx-shockwave" d="${ring}" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/><path id="vfx-muzzle" d="${pathPoints(rays)}Z" fill="#fff" opacity=".96"/></g>`;
        }
        else if (vfxFrame === 1) {
            const sparks = [-16, -9, 0, 8].map((y, i) => pathPoints([weaponPoint(20 + i * 2, y), weaponPoint(30 + i * 2, y)])).join(' ');
            const wind = [-3, 3].map(offset => `M${coords(weaponPoint(-curve + offset, -bowHalf))} Q${coords(weaponPoint(nockX + offset + 8, -5))} ${coords(weaponPoint(-curve + offset, bowHalf))}`).join(' ');
            shot = `<g id="shot-vfx"><path id="vfx-sparks" d="${sparks}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path id="vfx-string-wind" d="${wind}" fill="none" stroke="#fff" stroke-width="1.5" opacity=".5"/></g>`;
        }
        else if (vfxFrame >= 2 && vfxFrame <= 4) {
            const smokeOpacity = [.3, .18, .07][vfxFrame - 2] ?? 0, growth = 1 + (vfxFrame - 2) * .25, a = weaponPoint(18, -9), b = weaponPoint(28, 2);
            shot = `<g id="shot-vfx"><g id="vfx-smoke" fill="#e7ebec" opacity="${n(smokeOpacity)}"><circle cx="${n(a.x)}" cy="${n(a.y)}" r="${n(5 * growth)}"/><circle cx="${n(b.x)}" cy="${n(b.y)}" r="${n(4 * growth)}"/></g></g>`;
        }
        const quiver = `<g id="quiver" style="transform-box:view-box;transform-origin:-26px -55px;transform:translate(${n(-1.5 * brace)}px,${n(.6 * brace - 6 * impact - 2 * settle - ripple)}px) rotate(${n(3 * pull + 5 * settle)}deg)"><path id="quiver-case" d="M-26-64L-36-74L-37-31L-23-24L-16-58Z" fill="#b9703d" stroke="#241d1b" stroke-width="5" stroke-linejoin="round"/><path d="M-35-68l6 6-3 31-4-2Z" fill="#79432d"/><path d="M-34-49l12 5" stroke="#e9b878" stroke-width="1.4"/>${quiverFeathers()}<path id="quiver-strap" d="M-34-52L-21-47" stroke="#e9c27d" stroke-width="2"/></g>`;
        const body = `<g id="body-armor">${colorize(parts.torso, art)}${colorize(parts.bodyShadows, art)}${colorize(parts.armShadow, art)}<path id="collar-extension" d="M-21-58Q-14-52-8-54" fill="none" stroke="${trim}" stroke-width="2" stroke-linecap="round"/>${patch}${wear}${relicMarkup(config.relics)}</g>`;
        const projectile = projectileMarkup('#e8bc71', '#e7e8dc');
        const worldPoint = (point) => { const x = point.x * bodyWidth, y = point.y + 15; return p(x * Math.cos(bodyAngle) - y * Math.sin(bodyAngle) + bodyX, x * Math.sin(bodyAngle) + y * Math.cos(bodyAngle) - 15 + bodyY); };
        const tracerStart = worldPoint(weaponPoint(20, -5)), tracerEnd = worldPoint(weaponPoint(40, -5));
        const tracerData = vfxFrame === 0 ? ` data-tracer="${n(tracerStart.x)},${n(tracerStart.y)},${n(tracerEnd.x - tracerStart.x)},${n(tracerEnd.y - tracerStart.y)}"` : '';
        const sourceTag = `data-archer-class="${klass}" data-appearance="${encodeURIComponent(JSON.stringify(ap))}" data-relics="${config.relics.join(',')}"${recoil === null ? '' : ` data-recoil="${n(recoil)}"`}${breath ? ' data-breath="1"' : ''}${hideRecoverySmoke ? ' data-recovery-start="1"' : ''}${tracerData}`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" id="archer-rig" viewBox="${VIEW_BOX}" width="${VIEW_WIDTH * 2}" height="${VIEW_HEIGHT * 2}" role="img" aria-label="Лучник: SVG-риг" ${sourceTag} data-tension="${n(pull)}"><title>Лучник ${klass}</title><defs id="rig-defs">${projectile}${rigMasks}</defs><style id="rig-styles">#legs{transform-box:view-box;transform-origin:0px 25px;transform:translate(0px,25px) scale(${n(1 + .04 * (bodyY - 2 * breath) / 2)},${n(1 - .06 * (bodyY - 2 * breath) / 2)}) translate(0px,-25px)}.upper-body{transform-box:view-box;transform-origin:0px -15px;transform:translate(${n(bodyX)}px,${n(bodyY)}px) rotate(${n(bodyAngle * 180 / Math.PI)}deg) scaleX(${n(ap.bodyW)})}#left_arm{transform-box:view-box;transform-origin:${n(leftShoulderLocal.x)}px ${n(leftShoulderLocal.y)}px}#head{transform-box:view-box;transform-origin:0px -66px}#bow-string{stroke-linecap:round}.outline{stroke-linecap:round;stroke-linejoin:round}</style><g id="character-base"><g id="character_body"><g id="legs">${parts.legs}</g><g id="torso" class="upper-body">${quiver}${body}</g></g><g id="string_and_right_hand" class="upper-body">${rightArm}${string}<g id="draw-hand-layer" mask="url(#draw-hand-mask)">${handImage('drawHand', rightWristLocal.x, rightWristLocal.y, pull, snap > .1)}</g></g><g id="character_head" class="upper-body">${headMarkup(config, pull, trim, beardLift, breath)}</g><g class="upper-body"><g id="left_arm">${leftArm}${handImage('gripHand', leftWristLocal.x, leftWristLocal.y)}</g></g><g id="bow_and_arrow" class="upper-body">${bow}${loadedArrow}${shot}</g></g></svg>`;
        return colorize(svg, art);
    }
    function svgDataUrl(svg) { return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; }
    function imageFromMarkup(cache, key, markup) {
        const cached = cache.get(key);
        if (cached)
            return cached;
        const image = new Image();
        const tracer = /data-tracer="([^"]+)"/.exec(markup)?.[1]?.split(',').map(Number);
        if (tracer && tracer.length === 4) {
            const [x, y, dx, dy] = tracer;
            if (x !== undefined && y !== undefined && dx !== undefined && dy !== undefined && [x, y, dx, dy].every(Number.isFinite) && dx > 0)
                tracerAnchors.set(image, { start: p(x, y), direction: p(dx, dy) });
        }
        image.decoding = 'async';
        image.src = svgDataUrl(markup);
        cache.set(key, image);
        return image;
    }
    function touchAppearance(key) {
        const cached = spriteCache.get(key);
        if (cached) {
            spriteCache.delete(key);
            spriteCache.set(key, cached);
            return cached;
        }
        const created = new Map();
        spriteCache.set(key, created);
        while (spriteCache.size > SPRITE_CACHE_LIMIT) {
            const oldest = spriteCache.keys().next().value;
            if (oldest === undefined)
                break;
            spriteCache.delete(oldest);
        }
        return created;
    }
    function renderSvg(klass, appearance, pull = 0, shotFlash = 0, relics = []) { return renderArcherSvg(klass, appearance, pull, shotFlash, relics); }
    function recoilTime(pose) {
        if (pose.phase !== 'release' && pose.phase !== 'recover')
            return null;
        if (pose.reduced)
            return 1;
        const progress = clamp(pose.progress, 0, 1);
        if (pose.phase === 'recover')
            return (4 + Math.min(8, Math.floor(progress * 9))) / RECOIL_STEPS;
        let elapsed = progress * RELEASE_DURATION;
        for (const [index, duration] of ANIMATION_TIMING.releaseFrames.entries()) {
            if (elapsed < duration)
                return index / RECOIL_STEPS;
            elapsed -= duration;
        }
        return 4 / RECOIL_STEPS;
    }
    function renderRecoilSvg(klass, appearance, progress, relics, hideRecoverySmoke = false) {
        const t = clamp(progress, 0, 1), release = clamp(t / .3, 0, 1), easing = release * release * (3 - 2 * release);
        return renderArcherSvg(klass, appearance, 1 - easing, Math.max(0, 1 - t / .2), relics, t, 0, hideRecoverySmoke);
    }
    function idleBreath(pose) {
        return pose.phase === 'idle' && !pose.reduced && pose.progress >= .25 && pose.progress < .75;
    }
    function renderPoseSvg(klass, appearance, pose, relics = []) {
        const time = recoilTime(pose);
        if (time !== null)
            return renderRecoilSvg(klass, appearance, time, relics, pose.phase === 'recover' && time === 4 / RECOIL_STEPS);
        if (idleBreath(pose))
            return renderArcherSvg(klass, appearance, 0, 0, relics, null, 1);
        return renderSvg(klass, appearance, pose.phase === 'idle' ? 0 : pose.pull, 0, relics);
    }
    function prepare(klass, appearance, relics = []) {
        const config = safeConfig(klass, appearance, relics), key = appearanceKey(config), cache = touchAppearance(key);
        for (let step = 0; step <= POSE_STEPS; step++)
            imageFromMarkup(cache, `${step}:0`, renderSvg(klass, appearance, step / POSE_STEPS, 0, relics));
        imageFromMarkup(cache, 'idle:breath', renderArcherSvg(klass, appearance, 0, 0, relics, null, 1));
        for (let step = 0; step <= RECOIL_STEPS; step++)
            imageFromMarkup(cache, `recoil:${step}`, renderRecoilSvg(klass, appearance, step / RECOIL_STEPS, relics));
        imageFromMarkup(cache, 'recover:0', renderRecoilSvg(klass, appearance, 4 / RECOIL_STEPS, relics, true));
    }
    function getImage(klass, appearance, pull, shotFlash = 0, relics = []) {
        const safePull = clamp(pull, 0, 1), config = safeConfig(klass, appearance, relics), key = appearanceKey(config), cache = touchAppearance(key);
        if (cache.size === 0)
            prepare(klass, appearance, relics);
        const current = touchAppearance(key), step = Math.round(safePull * POSE_STEPS), flashing = shotFlash > .07, imageKey = `${step}:${flashing ? 1 : 0}`;
        const image = imageFromMarkup(current, imageKey, renderSvg(klass, appearance, step / POSE_STEPS, flashing ? shotFlash : 0, relics));
        if (image.complete && image.naturalWidth > 0)
            return image;
        for (let distance = 1; distance <= POSE_STEPS; distance++)
            for (const neighbor of [step - distance, step + distance]) {
                if (neighbor < 0 || neighbor > POSE_STEPS)
                    continue;
                const nearby = current.get(`${neighbor}:0`);
                if (nearby?.complete && nearby.naturalWidth > 0)
                    return nearby;
            }
        return null;
    }
    function getPoseImage(klass, appearance, pose, relics = []) {
        const time = recoilTime(pose);
        if (time === null && !idleBreath(pose))
            return getImage(klass, appearance, pose.phase === 'idle' ? 0 : pose.pull, 0, relics);
        const key = appearanceKey(safeConfig(klass, appearance, relics)), cache = touchAppearance(key);
        if (cache.size === 0)
            prepare(klass, appearance, relics);
        const current = touchAppearance(key);
        if (time === null) {
            const breathing = current.get('idle:breath');
            return breathing?.complete && breathing.naturalWidth > 0 ? breathing : null;
        }
        const step = Math.round(time * RECOIL_STEPS), sprite = current.get(pose.phase === 'recover' && step === 4 ? 'recover:0' : `recoil:${step}`);
        if (sprite?.complete && sprite.naturalWidth > 0)
            return sprite;
        for (let distance = 1; distance <= RECOIL_STEPS; distance++)
            for (const neighbor of [step - distance, step + distance]) {
                if (neighbor < 0 || neighbor > RECOIL_STEPS)
                    continue;
                const nearby = current.get(`recoil:${neighbor}`);
                if (nearby?.complete && nearby.naturalWidth > 0)
                    return nearby;
            }
        return null;
    }
    function projectileMarkup(shaftColor, tipColor) {
        return `<g id="arrow-projectile"><path d="M0 19L-4 8L0-16L4 8Z" fill="#fff0c6" opacity=".18"/><path d="M0 16L0-17" stroke="#7f5d46" stroke-width="3.2" stroke-linecap="round"/><path d="M0 14L0-18" stroke="${shaftColor}" stroke-width="1.7" stroke-linecap="round"/><path d="M0-22L-5.5-9L0-12L5.5-9Z" fill="${tipColor}" stroke="#463d32" stroke-width=".8" stroke-linejoin="round"/><path d="M0-18L-2.4-11L0-13L2.4-11Z" fill="#fff3d2"/><path d="M0 12L-6.8 18M0 12L6.8 18" stroke="#cf9d70" stroke-width="2.2" stroke-linecap="round"/><path d="M0 11L-4.2 16M0 11L4.2 16" stroke="#f5e8cb" stroke-width="1" stroke-linecap="round"/></g>`;
    }
    function renderProjectile(color) {
        const safeColor = /^#[\da-f]{6}$/i.test(color) ? color : '#f5d7a9';
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -24 18 48" width="36" height="96">${projectileMarkup(safeColor, safeColor)}</svg>`;
    }
    function getProjectileImage(color) { const markup = renderProjectile(color); return imageFromMarkup(projectileCache, markup, markup); }
    function isReady() { const image = getImage('medium', DEFAULT_APPEARANCE, 0, 0); return Boolean(image?.complete && image.naturalWidth > 0); }
    function drawShotTracer(ctx, pose, sprite) {
        if (pose.reduced || pose.phase !== 'release' || recoilTime(pose) !== 0)
            return;
        const anchor = tracerAnchors.get(sprite);
        if (!anchor)
            return;
        const inverse = ctx.getTransform().inverse(), canvas = ctx.canvas;
        const corners = [new DOMPoint(0, 0), new DOMPoint(canvas.width, 0), new DOMPoint(0, canvas.height), new DOMPoint(canvas.width, canvas.height)];
        const edge = Math.max(...corners.map(point => point.matrixTransform(inverse).x));
        if (!Number.isFinite(edge) || edge <= anchor.start.x)
            return;
        const length = Math.hypot(anchor.direction.x, anchor.direction.y), nx = -anchor.direction.y / length * 2, ny = anchor.direction.x / length * 2;
        const endX = edge + 3, endY = anchor.start.y + (endX - anchor.start.x) * anchor.direction.y / anchor.direction.x;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,.82)';
        ctx.beginPath();
        ctx.moveTo(anchor.start.x + nx, anchor.start.y + ny);
        ctx.lineTo(endX, endY);
        ctx.lineTo(anchor.start.x - nx, anchor.start.y - ny);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    function draw(ctx, x, y, time, pose, transform = { scale: 1.25, facing: -1 }, options = {}) {
        const klass = options.klass ?? 'medium', appearance = options.appearance ?? DEFAULT_APPEARANCE, relics = options.relics ?? [];
        const idleCycle = ANIMATION_TIMING.idleFrame * 8;
        const progress = pose.phase === 'idle' ? ((time / idleCycle) % 1 + 1) % 1 : pose.progress;
        const sprite = getPoseImage(klass, appearance, { ...pose, progress }, relics);
        if (!sprite?.complete || sprite.naturalWidth === 0)
            return false;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(transform.facing * transform.scale, transform.scale);
        ctx.drawImage(sprite, VIEW_X, VIEW_Y, VIEW_WIDTH, VIEW_HEIGHT);
        drawShotTracer(ctx, { ...pose, progress }, sprite);
        ctx.restore();
        return true;
    }
    const previewAnimations = new WeakMap();
    function isAppearance(value) {
        if (value === null || typeof value !== 'object')
            return false;
        const candidate = value;
        return typeof candidate.height === 'number' && typeof candidate.bodyW === 'number' && typeof candidate.hood === 'number' && typeof candidate.scar === 'number' && typeof candidate.patch === 'number' && typeof candidate.trim === 'number' && typeof candidate.bowTilt === 'number' && typeof candidate.cap === 'number' && typeof candidate.wear === 'number' && typeof candidate.beard === 'number' && typeof candidate.beardLen === 'number' && typeof candidate.moustache === 'number';
    }
    function currentRigConfig(root) {
        const className = root.dataset['archerClass'], klass = className === 'short' || className === 'heavy' ? className : 'medium';
        let appearance = DEFAULT_APPEARANCE;
        const encoded = root.dataset['appearance'];
        if (encoded) {
            try {
                const parsed = JSON.parse(decodeURIComponent(encoded));
                if (isAppearance(parsed))
                    appearance = safeAppearance(parsed);
            }
            catch (error) {
                if (!(error instanceof URIError) && !(error instanceof SyntaxError))
                    throw error;
            }
        }
        const allowed = ['perun', 'kvass', 'boots', 'amulet', 'quiver'];
        const relics = (root.dataset['relics'] ?? '').split(',').filter((value) => allowed.includes(value));
        return safeConfig(klass, appearance, relics);
    }
    function updatePreview(root, config, tension) {
        const next = new DOMParser().parseFromString(renderSvg(config.klass, config.appearance, tension, 0, config.relics), 'image/svg+xml').documentElement;
        if (next.localName !== 'svg')
            return;
        root.innerHTML = next.innerHTML;
        root.dataset['tension'] = n(tension);
    }
    const renderer = { viewWidth: VIEW_WIDTH, timing: ANIMATION_TIMING, draw, drawShotTracer, isReady, getImage, getPoseImage, renderPoseSvg, prepare, renderSvg, renderProjectile, getProjectileImage };
    window.__archerRig = renderer;
    prepare('medium', DEFAULT_APPEARANCE);
    window.animateArcher = (tensionPercent) => {
        const root = document.getElementById('archer-rig');
        if (!root)
            return;
        const targetValue = clamp(tensionPercent, 0, 100) / 100, config = currentRigConfig(root);
        const target = previewAnimations.get(root) ?? { tension: Number(root.dataset['tension'] ?? 0), frame: null };
        previewAnimations.set(root, target);
        if (target.frame !== null) {
            cancelAnimationFrame(target.frame);
            target.frame = null;
        }
        const update = () => updatePreview(root, config, target.tension);
        const gsap = window.gsap;
        if (gsap) {
            gsap.killTweensOf(target);
            gsap.to(target, { tension: targetValue, duration: .4, ease: 'power2.out', onUpdate: update });
            return;
        }
        const start = target.tension, began = performance.now(), duration = 400;
        const step = (now) => { const progress = clamp((now - began) / duration, 0, 1), eased = progress * progress * (3 - 2 * progress); target.tension = start + (targetValue - start) * eased; update(); target.frame = progress < 1 ? requestAnimationFrame(step) : null; };
        target.frame = requestAnimationFrame(step);
    };
})();
//# sourceMappingURL=archer-rig.js.map