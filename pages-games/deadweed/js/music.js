// Music by h5isy, Organic Machine: Gothic Biopunk — CC BY 4.0.
// Supplied intros and loops are scheduled on the WebAudio clock (no HTMLAudio loop gap).
'use strict';
class Music {
  constructor(sfx, root) {
    this.sfx=sfx;this.root=root;this.volume=.35;
    try {const saved=localStorage.getItem('deadweed-music-volume');if(saved!==null && Number.isFinite(Number(saved)))this.volume=clamp(Number(saved),0,1);}catch(_){}
    this.tracks={menu:{intro:'menu-intro.ogg',loop:'menu-loop.ogg'},combat:{intro:'combat-intro.ogg',loop:'combat-loop.ogg'},defeat:{intro:'defeat.ogg'}};
    this.cache=new Map();this.selected=null;this.lane=null;this.bus=null;this.generation=0;this.unlocked=false;this.state='menu';this.error=null;this.retryAt=0;
  }
  unlock() {
    if(!this.sfx.ensure())return;
    this.unlocked=true;
    if(!this.bus){this.bus=this.sfx.ctx.createGain();this.bus.gain.value=0;this.bus.connect(this.sfx.ctx.destination);}
    const resume=this.sfx.ctx.resume();if(resume && resume.catch)resume.catch(()=>{});
    this.update(this.state);
  }
  setVolume(value) {
    this.volume=clamp(value,0,1);
    try{localStorage.setItem('deadweed-music-volume',String(this.volume));}catch(_){}
    this.update(this.state);
  }
  update(state) {
    this.state=state;if(!this.unlocked || !this.bus)return;
    const key=state==='playing' || state==='upgrade'?'combat':state==='gameover'?'defeat':'menu';
    const duck=state==='upgrade'?.45:1;
    const hidden=typeof document!=='undefined' && document.hidden;
    this.bus.gain.setTargetAtTime(hidden?0:this.volume*this.sfx.volume*duck*.65,this.sfx.ctx.currentTime,.12);
    if(key!==this.selected||(this.error&&key===this.selected&&Date.now()>=this.retryAt))this.select(key);
  }
  async load(name) {
    if(!this.cache.has(name))this.cache.set(name,(async()=>{
      const response=await fetch(this.root+name);if(!response.ok)throw new Error('Music HTTP '+response.status);
      return this.sfx.ctx.decodeAudioData(await response.arrayBuffer());
    })().catch(error=>{this.cache.delete(name);throw error;}));
    return this.cache.get(name);
  }
  async select(key) {
    this.selected=key;const token=++this.generation,track=this.tracks[key];
    try {
      const [intro,loop]=await Promise.all([this.load(track.intro),track.loop?this.load(track.loop):null]);
      if(token!==this.generation)return;
      const ctx=this.sfx.ctx,start=ctx.currentTime+.05,fade=.7;
      const gain=ctx.createGain();gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(1,start+fade);gain.connect(this.bus);
      const lane={gain,sources:[]};
      const schedule=(buffer,when,repeating)=>{const source=ctx.createBufferSource();source.buffer=buffer;source.loop=repeating;if(repeating){source.loopStart=0;source.loopEnd=buffer.duration;}source.connect(gain);source.start(when);source.onended=()=>source.disconnect();lane.sources.push(source);};
      schedule(intro,start,false);if(loop)schedule(loop,start+intro.duration,true);
      if(this.lane){const old=this.lane;old.gain.gain.cancelScheduledValues(ctx.currentTime);old.gain.gain.setValueAtTime(old.gain.gain.value,ctx.currentTime);old.gain.gain.linearRampToValueAtTime(0,start+fade);for(const source of old.sources){try{source.stop(start+fade+.05);}catch(_){}}setTimeout(()=>old.gain.disconnect(),1000);}
      this.lane=lane;this.playingKey=key;this.error=null;
    } catch(error) {if(token===this.generation){this.error=String(error);this.retryAt=Date.now()+3000;if(typeof console!=='undefined')console.warn('Music unavailable:',error);}}
  }
}
