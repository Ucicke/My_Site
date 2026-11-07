/* ================================================================
   SCROLL HUNTER · engine/core.js — холст, константы, утилиты
   ================================================================ */
'use strict';


const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

/* Размеры игрового поля в логических координатах */
let VIEW_W = 1000;
let VIEW_H = 880;
let canvasScale = 1;
let compactLandscape = false;

/* Габариты сундука */
const CHEST_W = 220;
const CHEST_BODY_H = 92;
const CHEST_LID_H = 54;

const TAU = Math.PI * 2;

/* ---------------------------------------------------------------
   1. Мелкие утилиты
--------------------------------------------------------------- */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => GameRng.between('mechanics', a, b);
const randInt = (a, b) => GameRng.int('mechanics', a, b);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

function shuffle(list) {
    return GameRng.shuffle('mechanics', list);
}

function randIn(stream, min, max) { return GameRng.between(stream, min, max); }
function randIntIn(stream, min, max) { return GameRng.int(stream, min, max); }
function shuffleIn(stream, list) { return GameRng.shuffle(stream, list); }

function roundRect(c, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + rr, y);
    c.lineTo(x + w - rr, y);
    c.quadraticCurveTo(x + w, y, x + w, y + rr);
    c.lineTo(x + w, y + h - rr);
    c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    c.lineTo(x + rr, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rr);
    c.lineTo(x, y + rr);
    c.quadraticCurveTo(x, y, x + rr, y);
    c.closePath();
}

/* Ширина сундука для комнаты из N сундуков */
function chestWidth(count) {
    const maxW = CHEST_W;
    const gap = VIEW_W < 760 ? 6 : count >= 6 ? 12 : 18;
    const avail = VIEW_W - 60;
    return Math.max(VIEW_W < 760 ? 44 : 84, Math.min(maxW, Math.floor((avail - (count - 1) * gap) / count)));
}

/* Расстановка N сундуков по ширине экрана */
function chestXs(count) {
    const w = chestWidth(count);
    const gap = VIEW_W < 760 ? 6 : count >= 6 ? 12 : count >= 4 ? 18 : 40;
    const total = count * w + (count - 1) * gap;
    const start = Math.round((VIEW_W - total) / 2);
    const xs = [];
    for (let i = 0; i < count; i++) xs.push(start + i * (w + gap));
    return xs;
}

/* ---------------------------------------------------------------
   2. Холст: настройка под плотность пикселей
--------------------------------------------------------------- */
let bgLayer = null;
let currentScene = null;
let roomTint = { h: 210, s: 40, a: 0 };

function fitCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const landscapeLayout = rect.height < 700 && rect.width > rect.height;
    compactLandscape = landscapeLayout;
    canvasScale = landscapeLayout ? rect.width / 1000 : rect.height / 880;
    VIEW_H = landscapeLayout ? rect.height / canvasScale : 880;
    VIEW_W = rect.width / canvasScale;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr * canvasScale, 0, 0, dpr * canvasScale, 0, 0);
    if (typeof updateCanvasLayout === 'function') updateCanvasLayout();
    if (typeof updateEnvironmentLayout === 'function') updateEnvironmentLayout();
    /* фон живёт в environment.js и мог быть ещё не загружен */
    if (typeof buildBackground === 'function') buildBackground();
}

