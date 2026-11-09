// main.js — запуск, ресайз, главный цикл
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sfx = new Sfx();
const seedParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('seed') : null;
const requestedSeed = seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) : undefined;
const game = new Game(canvas, input, sfx, requestedSeed);
if(typeof installLevel01==='function')installLevel01(game);

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  const backingW = Math.max(1, Math.floor(w * dpr));
  const backingH = Math.max(1, Math.floor(h * dpr));
  // Assigning width/height clears the backing store and resets the context.
  // Only do it when the actual backing size changes, never from the frame loop.
  if (canvas.width !== backingW) canvas.width = backingW;
  if (canvas.height !== backingH) canvas.height = backingH;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.vw = w;
  game.vh = h;
  game.dpr = dpr;
}

window.addEventListener('resize', resize);
if (typeof document.addEventListener === 'function') document.addEventListener('visibilitychange',()=>{if(document.hidden) input.pauseRequested=true;});
resize();

// Resolve relative to this script, so index.html and dev previews share the same assets.
const assetsRoot=typeof document.currentScript==='object' && document.currentScript && document.currentScript.src ? new URL('../assets/',document.currentScript.src).href : 'assets/';
if(typeof initializeStageArt==='function')initializeStageArt(assetsRoot+'stage1c/');
initializeBotanicalUI(assetsRoot+'botanical-horror/');
sfx.configureSamples(assetsRoot+'sfx/icysoap/');
for(const key of DRIFT_ART_KEYS)registerSprite('drift_'+key,assetsRoot+'driftworks/'+key+'.png');
for(const key of INPUT_ART_KEYS)registerSprite('input_'+key,assetsRoot+'input-prompts/'+key+'.png');
sfx.configureExtraSamples({drift:assetsRoot+'sfx/driftworks/',flesh:assetsRoot+'sfx/flesh-fracture/'});

const musicRoot=assetsRoot+'music/';
game.music=new Music(sfx,musicRoot);
// Returning to an already activated page can start immediately. A fresh page waits
// for ordinary input instead of attempting a blocked AudioContext startup.
if (navigator.userActivation && navigator.userActivation.hasBeenActive) game.music.unlock();

// разблокировка звука по первому клику
const unlock = () => { game.music.unlock(); if (!game.music.unlocked) return; sfx.preloadSamples(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('pointerup', unlock); window.removeEventListener('keydown', unlock); };
window.addEventListener('pointerdown', unlock);
window.addEventListener('pointerup', unlock);
window.addEventListener('keydown', unlock);

let last = performance.now();
const simulationClock=new FixedClock();
let brandMenuState=null;

function simulationStep(dt) {
  const before=game.state;
  game.update(dt);
  input.endFrame();
  // Never spend pre-pause/pre-menu time after a state transition.
  return game.state===before;
}

function frame(now) {
  const elapsed = (now - last) / 1000;
  last = now;

  const profiling=!!game.level01&&game.state==='playing',start=profiling?performance.now():0,dropped=profiling?simulationClock.droppedSeconds:0;
  input.update();
  simulationClock.advance(elapsed,simulationStep);
  const afterUpdate=profiling?performance.now():0;
  game.music.update(game.state);
  if(game.state!==brandMenuState){brandMenuState=game.state;document.body.classList.toggle('brand-menu-visible',['splash','menu'].includes(brandMenuState));}
  game.draw();
  if(profiling)game.level01.recordFrame(elapsed,afterUpdate-start,performance.now()-afterUpdate,simulationClock.droppedSeconds-dropped);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
