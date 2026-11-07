// core.js — математика, утилиты, общие константы
'use strict';

const TAU = Math.PI * 2;

let randomState = 1;
function setRandomSeed(seed) { randomState = (Number(seed) >>> 0) || 1; }
function random01() {
  randomState = (randomState + 0x6D2B79F5) | 0;
  let t = randomState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// A separate stream: render/effect density must never consume gameplay entropy.
let visualState=0x12345678;
function visualRandom() {
  visualState=(Math.imul(visualState,1664525)+1013904223)>>>0;
  return visualState/4294967296;
}
function visualRand(min=0,max=1){return min+visualRandom()*(max-min);}
function visualChance(p){return visualRandom()<p;}

// Edges are consumed only by simulated steps, never by an empty render frame.
class FixedClock {
  constructor(step=1/60,maxSteps=6){this.step=step;this.maxSteps=maxSteps;this.accumulator=0;this.droppedSeconds=0;}
  reset(){this.accumulator=0;}
  advance(seconds,tick){
    const elapsed=Number.isFinite(seconds)?Math.max(0,seconds):0;
    const budget=this.step*this.maxSteps;
    this.droppedSeconds+=Math.max(0,elapsed-budget);
    this.accumulator+=Math.min(elapsed,budget);
    let count=0;
    while(this.accumulator+1e-10>=this.step && count<this.maxSteps){
      this.accumulator-=this.step;count++;
      if(tick(this.step)===false){this.reset();break;}
    }
    if(this.accumulator>=this.step){this.droppedSeconds+=this.accumulator;this.reset();}
    return count;
  }
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min = 0, max = 1) { return min + random01() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[(random01() * arr.length) | 0]; }
function chance(p) { return random01() < p; }
function sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); }
function dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }

function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function lerpAngle(a, b, t) { return a + angleDiff(a, b) * t; }

// плавное приближение значения к цели
function approach(cur, target, delta) {
  if (cur < target) return Math.min(cur + delta, target);
  return Math.max(cur - delta, target);
}

// нормализованный вектор в объект {x,y}
function norm(x, y) {
  const l = Math.hypot(x, y);
  if (l < 0.00001) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

// круг пересекает круг
function circleHit(ax, ay, ar, bx, by, br) {
  const r = ar + br;
  return dist2(ax, ay, bx, by) <= r * r;
}

// Earliest contact on [start,end], with a Minkowski-expanded target radius.
// A projectile born inside a collider contacts it at t=0; tangency counts.
function segmentCircleTime(x,y,dx,dy,cx,cy,radius) {
  const ox=x-cx,oy=y-cy,c=ox*ox+oy*oy-radius*radius;
  if(c<=1e-9)return 0;
  const a=dx*dx+dy*dy;if(a<1e-18)return null;
  const b=ox*dx+oy*dy,disc=b*b-a*c;
  if(disc < -1e-9)return null;
  const t=(-b-Math.sqrt(Math.max(0,disc)))/a;
  return t>=-1e-10&&t<=1+1e-10?clamp(t,0,1):null;
}

// точка внутри круга
function pointInCircle(px, py, cx, cy, r) {
  return dist2(px, py, cx, cy) <= r * r;
}

function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }

// детерминированный шум для декора
function hashNoise(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// --- реестр спрайтов (пиксель-арт оружия) ---
const SPRITES = {};

function registerSprite(name, path) {
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.src = path;
  SPRITES[name] = img;
  return img;
}

function getSprite(name) {
  if (!name) return null;
  const img = SPRITES[name];
  if (!img) return null;
  if (img.complete && img.naturalWidth > 0) return img;
  return null;
}
