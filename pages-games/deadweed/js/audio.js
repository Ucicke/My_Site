// WebAudio: bounded procedural voices plus cached IcySoap organic foley.
'use strict';
const DRIFT_SAMPLES={click:'ui_click_3',hover:'ui_hover_1',confirm:'ui_confirm_1',cancel:'ui_cancel_2',error:'ui_error_2',pickup:'ui_pickup_2',drop:'ui_drop_1',equip:'ui_equip_heavy',toggleOn:'ui_toggle_on',toggleOff:'ui_toggle_off',levelUp:'ui_level_up'};
const FLESH_SAMPLES=['wet-hit-a','wet-hit-b','wet-tear-a','wet-tear-b','sap-burst','shell-snap','wet-graft'];

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.enabled = true;
    this.volume = this._readVolume();
    this.voices = 0;
    this.sampleBuffers=new Map();this.sampleTurns={};this.sampleErrors=[];
  }

  configureSamples(root) {this.sampleRoot=root;}
  configureExtraSamples(roots) {
    this.extraSamplePaths={};
    for(const [key,file] of Object.entries(DRIFT_SAMPLES))this.extraSamplePaths['ui-'+key]=roots.drift+file+'.ogg';
    for(const key of FLESH_SAMPLES)this.extraSamplePaths[key]=roots.flesh+key+'.ogg';
  }

  preloadSamples() {
    if(this.sampleLoading)return this.sampleLoading;
    if(!this.ctx || !this.sampleRoot || typeof fetch!=='function')return Promise.resolve();
    const names=['crack-a','crack-b','crack-c','tear-a','tear-b','graft'];
    const paths={...Object.fromEntries(names.map(name=>[name,this.sampleRoot+name+'.ogg'])),...this.extraSamplePaths};
    this.sampleLoading=Promise.all(Object.entries(paths).map(async ([name,url])=>{
      try {
        const response=await fetch(url);
        if(!response.ok)throw new Error('HTTP '+response.status);
        const buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());
        this.sampleBuffers.set(name,buffer);
      } catch(error) {this.sampleErrors.push(name+': '+String(error));}
    }));
    return this.sampleLoading;
  }

  _sample(group,names,gain=1,maxDuration=.7) {
    const available=names.filter(name=>this.sampleBuffers.has(name));if(!available.length)return false;
    // Audio variation is round-robin and does not consume the simulation RNG.
    const turn=this.sampleTurns[group]||0;this.sampleTurns[group]=turn+1;
    const buffer=this.sampleBuffers.get(available[turn%available.length]),rate=[.96,1,1.04][turn%3];
    this._playVoice(keep=>{
      const src=keep(this.ctx.createBufferSource());src.buffer=buffer;src.playbackRate.value=rate;
      const g=keep(this.ctx.createGain()),duration=Math.max(.04,Math.min(maxDuration,buffer.duration/rate)),t=this.t;
      g.gain.setValueAtTime(gain,t);g.gain.setValueAtTime(gain,t+Math.max(0,duration-.03));g.gain.linearRampToValueAtTime(0,t+duration);
      src.connect(g);g.connect(this.master);
      return {source:src,start:()=>{src.start(t);src.stop(t+duration+.01);}};
    });
    return true;
  }

  fuse() {
    if(!this.enabled||!this.ensure())return;
    if(!this._sample('fuse',['wet-graft','graft'],.85,1.15)){this.pickup();return;}
    this._tone(180,540,.24,.08,'triangle',.15);
  }

  ensure() {
    // Programmatic starts (including dev previews) must not create/resume audio
    // before the browser has registered a real interaction with this page.
    if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') { const resume=this.ctx.resume(); if(resume && resume.catch)resume.catch(()=>{}); }
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.45;
      this.master.connect(this.ctx.destination);

      const len = Math.floor(this.ctx.sampleRate * 0.6);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      return true;
    } catch (e) {
      this.ctx = null;
      return false;
    }
  }

  _readVolume() {
    try {
      const saved = localStorage.getItem('deadweed-volume');
      const value = saved === null ? 1 : Number(saved);
      return Number.isFinite(value) ? clamp(value, 0, 1) : 1;
    } catch (_) { return 1; }
  }

  setVolume(value) {
    this.volume = clamp(value, 0, 1);
    if (this.master) this.master.gain.setTargetAtTime(this.volume * 0.45, this.ctx.currentTime, 0.03);
    try { localStorage.setItem('deadweed-volume', String(this.volume)); } catch (_) {}
  }

  get t() { return this.ctx.currentTime; }

  _budget(max = 24) {
    if (this.voices >= max) return false;
    this.voices++;
    return true;
  }

  // One voice = one scheduled source, including delayed oscillators. Release is
  // idempotent and disconnects the entire source/filter/gain chain.
  _playVoice(build) {
    if(!this.enabled || !this.ensure() || !this._budget())return;
    const nodes=[];let source,ended=false;
    const keep=node=>{nodes.push(node);return node;};
    const release=()=>{if(ended)return;ended=true;this.voices--;for(const node of nodes){try{node.disconnect();}catch(_){}}};
    try {
      const voice=build(keep);source=voice.source;source.onended=release;voice.start();
    } catch(_) {for(const node of nodes){try{if(node.stop)node.stop();}catch(_){}}release();}
  }

  _noiseBurst(dur, freq, q, gain, type = 'lowpass') {
    this._playVoice(keep=>{
      const src=keep(this.ctx.createBufferSource());src.buffer=this.noise;src.playbackRate.value=.8+Math.random()*.5;
      const filt=keep(this.ctx.createBiquadFilter());filt.type=type;filt.frequency.value=freq;filt.Q.value=q;
      const g=keep(this.ctx.createGain());g.gain.setValueAtTime(gain,this.t);g.gain.exponentialRampToValueAtTime(.0008,this.t+dur);
      src.connect(filt);filt.connect(g);g.connect(this.master);
      return {source:src,start:()=>{src.start();src.stop(this.t+dur+.02);}};
    });
  }

  _tone(f0, f1, dur, gain, type = 'square', delay = 0) {
    this._playVoice(keep=>{
      const o=keep(this.ctx.createOscillator());o.type=type;const t=this.t+delay;
      o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
      const g=keep(this.ctx.createGain());g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.008);g.gain.exponentialRampToValueAtTime(.0008,t+dur);
      o.connect(g);g.connect(this.master);
      return {source:o,start:()=>{o.start(t);o.stop(t+dur+.02);}};
    });
  }

  _cue(key,interval) {
    if(!this.enabled||!this.ensure())return false;
    if(!this.cues)this.cues={};
    if((this.cues[key]??-Infinity)>this.t)return false;
    this.cues[key]=this.t+interval;return true;
  }

  biologicalHit(weapon,force) {
    const heavy=weapon==='bone'||force>.45;
    if(!this._cue(heavy?'heavyHit':'seedHit',heavy?.075:.055))return;
    const wet=weapon==='spitter'||weapon==='glob'||String(weapon).includes('glob');
    if(this._sample(heavy?'heavyHit':wet?'wetHit':'seedHit',heavy?['shell-snap','crack-b','crack-c']:wet?['wet-hit-a','wet-hit-b']:['crack-a','crack-b'],heavy?.7:wet?.52:.38,heavy?.34:.2))return;
    this._noiseBurst(heavy?.085:.035,heavy?850:1700,1.4,heavy?.18:.075,'bandpass');
    if(heavy)this._tone(210,65,.065,.12,'triangle');
  }

  tear(kind,explosive=false) {
    const heavy=kind==='snapper';if(!this._cue(heavy?'largeTear':'smallTear',heavy?.13:.065))return;
    if(this._sample(heavy?'largeTear':'smallTear',explosive?['sap-burst','wet-tear-b']:heavy?['wet-tear-b','tear-b','graft']:['wet-tear-a','tear-a','tear-b'],heavy?.85:.55,heavy?.8:.42)){
      if(explosive)this._tone(105,35,.14,.07,'triangle');return;
    }
    this._noiseBurst(heavy?.29:.16,heavy?410:650,.8,heavy?.34:.2);
    this._tone(heavy?125:190,heavy?35:65,heavy?.24:.12,heavy?.17:.1,explosive?'sawtooth':'triangle');
  }

  fragment() {
    if(!this._cue('fragment',.13))return;
    if(this._sample('fragment',['crack-c','crack-a'],.14,.1))return;
    this._noiseBurst(.045,370,1.3,.055,'bandpass');
  }

  shoot(kind) {
    if (!this.enabled || !this.ensure()) return;
    switch (kind) {
      case 'pistol':
        this._noiseBurst(0.12, 1800, 1, 0.35);
        this._tone(420, 90, 0.1, 0.16, 'square');
        break;
      case 'smg':
        this._noiseBurst(0.06, 2600, 1, 0.22);
        this._tone(700, 200, 0.05, 0.1, 'square');
        break;
      case 'shotgun':
        this._noiseBurst(0.24, 1100, 0.7, 0.5);
        this._tone(180, 50, 0.2, 0.22, 'sawtooth');
        break;
      case 'bow':
        this._tone(900, 180, 0.16, 0.14, 'triangle');
        this._noiseBurst(0.08, 3000, 2, 0.15, 'bandpass');
        break;
      case 'glob':
        this._tone(300, 120, 0.22, 0.16, 'sine');
        this._noiseBurst(0.14, 700, 1, 0.2);
        break;
      case 'plant':
        this._noiseBurst(0.16, 900, 2, 0.22, 'bandpass');
        this._tone(240, 140, 0.14, 0.1, 'sawtooth');
        break;
    }
  }

  hit() {
    if (!this.enabled || !this.ensure()) return;
    this._noiseBurst(0.07, 700, 1.5, 0.16, 'bandpass');
  }

  splat() {
    if (!this.enabled || !this.ensure()) return;
    this._noiseBurst(0.18, 500, 0.8, 0.24);
    this._tone(160, 60, 0.16, 0.1, 'sine');
  }

  explode() {
    if (!this.enabled || !this.ensure()) return;
    this._noiseBurst(0.5, 420, 0.6, 0.5);
    this._tone(140, 30, 0.45, 0.28, 'sawtooth');
  }

  hurt() {
    if (!this.enabled || !this.ensure()) return;
    this._tone(320, 90, 0.22, 0.24, 'sawtooth');
    this._noiseBurst(0.12, 900, 1, 0.2);
  }

  pickup(kind='pickup') {
    if (!this.enabled || !this.ensure()) return;
    if(this._sample('pickup-'+kind,['ui-'+kind],.55,.65))return;
    this._tone(520, 780, 0.1, 0.16, 'triangle');
    this._tone(780, 1150, 0.12, 0.14, 'triangle', 0.08);
  }

  wave() {
    if (!this.enabled || !this.ensure()) return;
    if(this._sample('wave',['ui-levelUp'],.6,1.1))return;
    this._tone(150, 300, 0.5, 0.2, 'sawtooth');
    this._tone(220, 440, 0.5, 0.14, 'triangle', 0.12);
  }


  victory() {
    if (!this.enabled || !this.ensure()) return;
    this._tone(392, 523, 0.2, 0.2, 'triangle');
    this._tone(523, 784, 0.28, 0.19, 'triangle', 0.16);
    this._tone(659, 1046, 0.42, 0.16, 'triangle', 0.34);
  }

  gameover() {
    if (!this.enabled || !this.ensure()) return;
    this._tone(300, 60, 1.2, 0.28, 'sawtooth');
    this._tone(200, 40, 1.4, 0.2, 'triangle', 0.2);
  }

  ui(kind='click') {
    if (!this.enabled || !this.ensure()) return;
    if(kind==='hover'&&!this._cue('uiHover',.055))return;
    if(this._sample('ui-'+kind,['ui-'+kind],kind==='hover'?.28:.5,.65))return;
    this._tone(700, 900, 0.07, 0.12, 'square');
  }
}
