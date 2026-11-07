// plants.js — плотоядные растения (враги)
'use strict';

const PLANT_STATS = {
  sprout:  { hp: 26,  r: 16, speed: 112, dmg: 10, atkCd: 0.85, color: '#6fbf4a', score: 10,  drop: 0.18 },
  snapper: { hp: 70,  r: 25, speed: 88,  dmg: 20, atkCd: 1.5,  color: '#3f9e5a', score: 25,  drop: 0.3 },
  spitter: { hp: 26,  r: 15, speed: 66,  dmg: 10, atkCd: 1.7,  color: '#9ed84a', score: 20,  drop: 0.26 },
  thorn:   { hp: 95,  r: 22, speed: 0,   dmg: 9,  atkCd: 1.5,  color: '#5f8a3c', score: 30,  drop: 0.42 },
  maw:     { hp: 450, r: 52, speed: 66,  dmg: 26, atkCd: 1.6,  color: '#c0405f', score: 300, drop: 1 },
};
const PLANT_DRAW_SIGNS=[-1,1];
const PLANT_SIDE_NAMES=['left','right'];
const BURST_TELEGRAPH_RING_OFFSETS=[115,215];

class Plant {
  constructor(x, y, kind) {
    const s = PLANT_STATS[kind];
    this.kind = kind;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = s.r;
    this.hp = s.hp;
    this.maxHp = s.hp;
    this.speed = s.speed;
    this.dmg = s.dmg;
    this.atkCd = rand(0.4, 1.2);
    this.score = s.score;
    this.color = s.color;
    this.angle = rand(0, TAU);
    this.wob = rand(0, TAU); // affects Sprout movement, therefore gameplay RNG
    this.mouth = 0;
    this.hitFlash = 0;
    this.dead = false;
    this.spawnT = 0;
    this.state = 'idle';
    this.stateT = 0;
    this.shootT = 0;
  }

  // общий урон
  hurt(amount, g, srcX, srcY, meta = {}) {
    if (this.dead) return;
    if(this.recoverT>0) amount*=1.3;
    const beforeRelay=amount;let relayed=false;
    if(g.player.mods.relay && (meta.hand===0||meta.hand===1) && meta.damageType!=='explosive' && meta.relayTargets && !meta.relayTargets.has(this)) {
      meta.relayTargets.add(this);
      if(this.markHand!==undefined && this.markHand!==meta.hand && g.time<this.markUntil) {amount*=1.5;relayed=true;this.markHand=undefined;buildTrigger(g,'relay');g.particles.text(this.x,this.y-this.r-12,'СВЯЗКА','#aee8ff',12);}
      else {this.markHand=meta.hand;this.markUntil=g.time+1.8;}
    }
    const actual=Math.min(this.hp,amount);
    if(this.isResonator&&actual>0)g.threat.resonatorHit(this,{...meta,damage:actual});
    if(this.kind==='maw')g.threat.bossDamage(this,actual,meta,relayed?actual-Math.min(this.hp,beforeRelay):0);
    if(relayed)g.runStats.builds.extraDamage.relay+=actual-Math.min(this.hp,beforeRelay);
    if(meta.effect==='echo')g.runStats.builds.extraDamage.echo+=actual;
    if(Number.isInteger(meta.fusionIndex)){const f=g.runStats.fusions[meta.fusionIndex];if(f){f.damage+=actual;if(amount>=this.hp)f.kills++;}}
    if(meta.weaponId) {const metric=g.weaponMetric(meta.weaponId);metric.damage+=actual;if(amount>=this.hp)metric.kills++;}
    g.runStats.damageDealt += actual;
    if (g.currentWaveStats) g.currentWaveStats.damageDealt += Math.min(this.hp, amount);
    this.hp -= amount;
    this.hitFlash = 0.14;
    if (srcX !== undefined) {
      const a = Math.atan2(this.y - srcY, this.x - srcX);
      this.vx += Math.cos(a) * 70;
      this.vy += Math.sin(a) * 70;
    }
    const biological=g.biology.hit(this,actual,srcX,srcY,meta,g);
    if(!biological)g.particles.burst(this.x, this.y, 3, {
      speed: 130, life: 0.35, size: 3.4, color: '#7fd45a', color2: '#3d7a30',
    });
    if(biological && this.damageTextTick===g.time && this.damageText){this.damageTextAmount+=amount;this.damageText.text=String(Math.round(this.damageTextAmount));}
    else {this.damageTextTick=g.time;this.damageTextAmount=amount;this.damageText=g.particles.text(this.x,this.y-this.r-6,String(Math.round(amount)),'#d8ffb0',13);}
    if(!biological)g.sfx.hit();
    if (this.hp <= 0) this.die(g,meta);
  }

  die(g,meta={}) {
    if(this.dead)return;
    this.dead = true;
    if(this.isResonator)this.cancelResonance(g,meta);
    if(this.coordinatedAttack?.coordinator)this.coordinatedAttack.coordinator.coordinatedParticipantDied(this,g);
    if(this.kind==='maw')g.threat.bossDeath(this);
    const biological=g.biology.death(this,meta,g);
    if(!biological){
      g.particles.burst(this.x, this.y, 20, {
        speed: 220, life: 0.7, lifeVar: 0.4, size: 5, sizeVar: 3,
        color: '#8d9b4c', color2: '#40552a', grav: 260, drag: 0.9,
      });
      g.particles.burst(this.x, this.y, 6, {
        speed: 120, life: 0.5, size: 4, color: '#c8ff9a', type: 'square', spin: 6, grav: 300,
      });
      g.sfx.splat();
    }
    g.onPlantDeath(this,meta);
  }

  faceTarget(tx, ty, dt, rate = 8) {
    const a = Math.atan2(ty - this.y, tx - this.x);
    this.angle = lerpAngle(this.angle, a, clamp(dt * rate, 0, 1));
  }

  update(dt, g) {
    this.spawnT += dt;
    this.wob += dt * 3;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.reactT=Math.max(0,(this.reactT||0)-dt);if(!this.reactT)this.reactStrength=0;
    if (this.atkCd > 0) this.atkCd -= dt;
    this.mouth = approach(this.mouth, this.wantMouth ? 1 : 0.28, dt * 7);
    this.wantMouth = false;
    this.slowT=Math.max(0,(this.slowT || 0)-dt);
    this.recoverT=Math.max(0,(this.recoverT || 0)-dt);
    const baseSpeed=this.speed;this.speed*=this.slowT>0 ? 0.65 : 1;
    this.behave(dt, g);this.speed=baseSpeed;
    const vl=Math.hypot(this.vx,this.vy);
    if(vl>5 && this.speed>0) for(const ob of LEVEL.obstacles) {
      const d=dist(this.x,this.y,ob.x,ob.y);
      if(d<ob.r+this.r+50) {const side=(this.vx*(ob.y-this.y)-this.vy*(ob.x-this.x))>0 ? -1:1;this.vx+=-(ob.y-this.y)/Math.max(1,d)*side*180*dt;this.vy+=(ob.x-this.x)/Math.max(1,d)*side*180*dt;}
    }
    moveAndCollide(this, dt, this.r);
    this.x = clamp(this.x, this.r, LEVEL.w - this.r);
    this.y = clamp(this.y, this.r, LEVEL.h - this.r);
  }

  rangedReady(dt, g, range, wind = 0.55) {
    if(this.attackWind>0) {
      this.attackWind-=dt;this.wantMouth=true;
      return this.attackWind<=0;
    }
    if(this.atkCd<=0 && dist(this.x,this.y,g.player.x,g.player.y)<range) {this.attackWind=wind;this.attackDuration=wind;this.attackAngle=this.angle;}
    return false;
  }

  behave(dt, g) { }

  draw(ctx, t) { }

  drawReactive(ctx,t) {
    if(this.dead)return;
    const reactive=FX_CONFIG.enabled&&(this.kind==='sprout'||this.kind==='snapper'),strength=this.reactStrength||0;
    if(!reactive||(!(this.reactT>0)&&this.hp>=this.maxHp*.7)){this.draw(ctx,t);this.drawAttackTelegraph(ctx);return;}
    ctx.save();
    if(reactive&&this.reactT>0){const pulse=Math.sin(clamp(this.reactT/.16,0,1)*Math.PI/2)*strength,a=this.reactAngle||0;
      ctx.translate(this.x+Math.cos(a)*pulse*4,this.y+Math.sin(a)*pulse*4);ctx.rotate(a);ctx.scale(1-pulse*.24,1+pulse*.16);ctx.rotate(-a);ctx.translate(-this.x,-this.y);
    }
    this.draw(ctx,t);
    if(reactive&&this.hp<this.maxHp*.7){const a=this.reactAngle||0;ctx.save();ctx.translate(this.x-Math.cos(a)*this.r*.45,this.y-Math.sin(a)*this.r*.45);ctx.rotate(a);ctx.fillStyle='#465d27';ctx.strokeStyle='#c1cd7d';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,2,this.r*.23,-.4,0,TAU);ctx.fill();ctx.stroke();ctx.restore();}
    ctx.restore();
    this.drawAttackTelegraph(ctx);
  }

  drawAttackTelegraph(ctx) {
    const charge=this.chargeWind||0;
    const activeSector=this.sectorActiveT>0;
    if(!(this.attackWind>0||charge>0||activeSector)||!this.telegraphType&&!activeSector)return;
    const base=this.attackAngle||this.angle||0,count=this.telegraphCount||1,spread=this.telegraphSpread||0;
    ctx.save();ctx.globalAlpha=activeSector?.55:charge>0?.72:.35+.35*clamp(this.attackWind/(this.attackDuration||.6),0,1);
    ctx.strokeStyle=this.telegraphType==='charge'?'#f3ae68':'#d3bd7d';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=2.5;ctx.setLineDash([13,10]);
    if(this.telegraphType==='ring'){
      ctx.beginPath();ctx.arc(this.x,this.y,this.r+20,0,TAU);ctx.stroke();
      for(let i=0;i<count;i++){const a=base+i/count*TAU;ctx.beginPath();ctx.moveTo(this.x+Math.cos(a)*(this.r+6),this.y+Math.sin(a)*(this.r+6));ctx.lineTo(this.x+Math.cos(a)*(this.r+100),this.y+Math.sin(a)*(this.r+100));ctx.stroke();}
    } else if(this.telegraphType==='fan'){
      for(let i=0;i<count;i++){const offset=(i-(count-1)/2)*spread,a=base+offset;ctx.beginPath();ctx.moveTo(this.x+Math.cos(a)*(this.r+5),this.y+Math.sin(a)*(this.r+5));ctx.lineTo(this.x+Math.cos(a)*340,this.y+Math.sin(a)*340);ctx.stroke();}
    } else if(this.telegraphType==='sector'||activeSector){
      const half=this.sectorHalfAngle||.5,range=this.sectorRange||420,inner=this.sectorInner||this.r+25,start=base-half,end=base+half;ctx.setLineDash([]);ctx.fillStyle=activeSector?'rgba(240,167,107,.28)':'rgba(237,190,112,.14)';ctx.strokeStyle=activeSector?'#ffe1a0':'#f0ce88';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(this.x+Math.cos(start)*inner,this.y+Math.sin(start)*inner);ctx.lineTo(this.x+Math.cos(start)*range,this.y+Math.sin(start)*range);ctx.arc(this.x,this.y,range,start,end);ctx.lineTo(this.x+Math.cos(end)*inner,this.y+Math.sin(end)*inner);ctx.arc(this.x,this.y,inner,end,start,true);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(this.x+Math.cos(start)*inner,this.y+Math.sin(start)*inner);ctx.lineTo(this.x+Math.cos(start)*range,this.y+Math.sin(start)*range);ctx.moveTo(this.x+Math.cos(end)*inner,this.y+Math.sin(end)*inner);ctx.lineTo(this.x+Math.cos(end)*range,this.y+Math.sin(end)*range);ctx.arc(this.x,this.y,range,start,end);ctx.stroke();
    } else {
      const len=this.telegraphType==='charge'?360:320;
      ctx.beginPath();ctx.moveTo(this.x+Math.cos(base)*(this.r+5),this.y+Math.sin(base)*(this.r+5));ctx.lineTo(this.x+Math.cos(base)*len,this.y+Math.sin(base)*len);ctx.stroke();
      if(this.telegraphType==='burst'){ctx.setLineDash([]);for(const d of BURST_TELEGRAPH_RING_OFFSETS){ctx.beginPath();ctx.arc(this.x+Math.cos(base)*d,this.y+Math.sin(base)*d,7,0,TAU);ctx.fill();}}
    }
    ctx.restore();
  }

  // общий кусок: тело-луковица
  drawBulb(ctx, r, col) {
    if(this.kind==='sprout')col='#8b9b55';
    if(this.kind==='snapper')col='#648b78';
    if(this.hitFlash>0)col=mixHex(col,'#fff0ce',.8*clamp(this.hitFlash/.14,0,1));
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.15, 0, 0, r);
    g.addColorStop(0, lighten(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darken(col, 0.45));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    if(this.kind==='sprout'||this.kind==='snapper'){ctx.strokeStyle='#162b24';ctx.lineWidth=2;ctx.stroke();ctx.strokeStyle=this.kind==='snapper'?'#b7c6ac':'#d3c384';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r*.9,Math.PI*.9,Math.PI*1.7);ctx.stroke();}
  }

  drawJaw(ctx, r, open, teeth = 5) {
    ctx.save();
    ctx.rotate(this.angle);
    const mx = r * 0.5;
    const mw = r * 0.52;
    const mh = r * (0.06 + open * 0.44);

    // пасть
    ctx.fillStyle = '#182c13';
    ctx.beginPath();
    ctx.ellipse(mx, 0, mw, mh, 0, 0, TAU);
    ctx.fill();
    // язык
    ctx.fillStyle = '#718636';
    ctx.beginPath();
    ctx.ellipse(mx + mw * 0.25, 0, mw * 0.42, Math.max(1, mh * 0.55), 0, 0, TAU);
    ctx.fill();

    // зубы по краю пасти
    ctx.fillStyle = '#f2f7e2';
    const rows = Math.max(2, Math.round(teeth / 2));
    for (let i = 0; i < rows; i++) {
      const t = rows === 1 ? 0.5 : i / (rows - 1);
      const px = mx - mw * 0.8 + mw * 1.6 * t;
      const k = Math.sqrt(Math.max(0, 1 - Math.pow((px - mx) / mw, 2)));
      const s = Math.min(4.5, mh * 0.8 + 2.5);
      // верхний
      ctx.beginPath();
      ctx.moveTo(px - 3, -mh * k - 1);
      ctx.lineTo(px + 3, -mh * k - 1);
      ctx.lineTo(px, -mh * k + s);
      ctx.closePath();
      ctx.fill();
      // нижний
      ctx.beginPath();
      ctx.moveTo(px - 3, mh * k + 1);
      ctx.lineTo(px + 3, mh * k + 1);
      ctx.lineTo(px, mh * k - s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawShadow(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.r * 0.72, this.r * 0.85, this.r * 0.3, 0, 0, TAU);
    ctx.fill();
  }
}

// --- мелкие хищники ---
class Sprout extends Plant {
  constructor(x, y) { super(x, y, 'sprout'); }

  behave(dt, g) {
    const p = g.player;
    const d = dist(this.x, this.y, p.x, p.y);
    this.faceTarget(p.x, p.y, dt, 6);

    if (d > this.r + p.r + 4) {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      const wobble = Math.sin(this.wob * 2) * 0.35;
      this.vx += Math.cos(a + wobble) * this.speed * 5 * dt;
      this.vy += Math.sin(a + wobble) * this.speed * 5 * dt;
    } else {
      this.wantMouth = true;
      if (this.atkCd <= 0) {
        this.atkCd = PLANT_STATS.sprout.atkCd;
        g.hurtPlayer(this.dmg,this.x,this.y,{label:'Укус ростка',sourceKind:'sprout',attackType:'contact'});
        g.particles.burst(this.x, this.y, 6, { speed: 160, life: 0.3, size: 3, color: '#9be36a' });
      }
    }
  }

  draw(ctx, t) {
    if(typeof drawArtEnemy==='function'&&drawArtEnemy(ctx,this,t))return;
    this.drawShadow(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    const sway = Math.sin(this.wob) * 0.12;
    ctx.rotate(sway);
    // листья-лапы
    ctx.fillStyle = '#3f8c3a';
    for (const s of PLANT_DRAW_SIGNS) {
      ctx.save();
      ctx.rotate(s * (0.9 + Math.sin(this.wob * 1.5) * 0.25));
      ctx.beginPath();
      ctx.ellipse(this.r * 0.9, 0, this.r * 0.55, this.r * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    this.drawBulb(ctx, this.r, this.color);
    this.drawJaw(ctx, this.r, this.mouth, 4);
    // глазки
    ctx.fillStyle = '#12210f';
    ctx.beginPath();
    ctx.arc(-this.r * 0.45, -this.r * 0.42, this.r * 0.16, 0, TAU);
    ctx.arc(-this.r * 0.1, -this.r * 0.5, this.r * 0.14, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// --- прыгающий снаппер ---
class Snapper extends Plant {
  constructor(x, y) { super(x, y, 'snapper'); }

  behave(dt, g) {
    const p = g.player;
    const d = dist(this.x, this.y, p.x, p.y);
    this.faceTarget(p.x, p.y, dt, 5);

    if (this.state === 'idle') {
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      this.vx += Math.cos(a) * this.speed * 5 * dt;
      this.vy += Math.sin(a) * this.speed * 5 * dt;
      if (d < 260 && this.atkCd <= 0) {
        this.state = 'wind';
        this.attackAngle=Math.atan2(p.y-this.y,p.x-this.x);
        this.stateT = 0;
        this.atkCd = PLANT_STATS.snapper.atkCd;
      }
    } else if (this.state === 'wind') {
      this.stateT += dt;
      this.vx *= Math.pow(.9,dt*60); this.vy *= Math.pow(.9,dt*60);
      this.wantMouth = true;
      if (this.stateT > 0.5) {
        this.state = 'dash';
        this.stateT = 0;
        const a = this.attackAngle;
        this.vx = Math.cos(a) * 620;
        this.vy = Math.sin(a) * 620;
        g.sfx.shoot('plant');
      }
    } else if (this.state === 'dash') {
      this.stateT += dt;
      this.wantMouth = true;
      if (d < this.r + p.r + 4) {
        g.hurtPlayer(this.dmg,this.x,this.y,{label:'Прыжок хищника',sourceKind:'snapper',attackType:'charge'});
        this.state = 'idle';
        this.stateT = 0;
      }
      if (this.stateT > 0.45) { this.state = 'idle'; this.stateT = 0; }
    }
  }

  draw(ctx, t) {
    if(typeof drawArtEnemy==='function'&&drawArtEnemy(ctx,this,t))return;
    this.drawShadow(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.sin(this.wob * 0.8) * 0.1);
    // усики
    ctx.strokeStyle = '#2f6b2a';
    ctx.lineWidth = 3;
    for (const s of PLANT_DRAW_SIGNS) {
      ctx.beginPath();
      const a = s * (1.4 + Math.sin(this.wob + s) * 0.3);
      ctx.moveTo(Math.cos(a) * this.r * 0.7, Math.sin(a) * this.r * 0.7);
      ctx.quadraticCurveTo(
        Math.cos(a) * this.r * 1.5, Math.sin(a) * this.r * 1.5 - 8,
        Math.cos(a + 0.5) * this.r * 1.9, Math.sin(a + 0.5) * this.r * 1.9 - 12);
      ctx.stroke();
    }
    this.drawBulb(ctx, this.r, this.color);
    // пятна
    // Angular shoulder plates distinguish the heavy silhouette without a new collider.
    ctx.fillStyle='#84938a';ctx.strokeStyle='#283e36';ctx.lineWidth=1.5;
    for(const side of PLANT_DRAW_SIGNS){ctx.beginPath();ctx.moveTo(-this.r*.75,side*this.r*.35);ctx.lineTo(-this.r*.3,side*this.r*1.12);ctx.lineTo(this.r*.45,side*this.r*.82);ctx.lineTo(this.r*.1,side*this.r*.5);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.fillStyle = 'rgba(20,60,20,0.45)';
    for (let i = 0; i < 4; i++) {
      const a = i * 1.9 + this.wob * 0.2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * this.r * 0.6, Math.sin(a) * this.r * 0.6, this.r * 0.13, 0, TAU);
      ctx.fill();
    }
    this.drawJaw(ctx, this.r, this.mouth, 6);
    ctx.restore();
  }
}

// --- стреляющий сорняк ---
class Spitter extends Plant {
  constructor(x, y) { super(x, y, 'spitter'); }

  behave(dt, g) {
    const sync=this.coordinatedAttack;
    if(sync){
      const p=g.player,d=dist(this.x,this.y,p.x,p.y);
      if(sync.version===2){this.vx=0;this.vy=0;this.angle=sync.angle;}
      else {
        this.faceTarget(p.x,p.y,dt,4);
        if(d<250){const a=Math.atan2(this.y-p.y,this.x-p.x);this.vx+=Math.cos(a)*this.speed*4*dt;this.vy+=Math.sin(a)*this.speed*4*dt;}
        else if(d>400){const a=Math.atan2(p.y-this.y,p.x-this.x);this.vx+=Math.cos(a)*this.speed*4*dt;this.vy+=Math.sin(a)*this.speed*4*dt;}
      }
      this.attackWind=0;this.burstRemaining=0;this.telegraphType=null;this.wantMouth=true;
      if(!sync.fired&&g.time>=sync.fireAt){
        const a=sync.angle;
        g.spawnEnemyBullet(this.x+Math.cos(a)*this.r,this.y+Math.sin(a)*this.r,Math.cos(a)*380,Math.sin(a)*380,this.dmg,'#b8ef5a',4,{sourceKind:'spitter',attackType:'resonant',coordinatorId:sync.coordinator.resonatorTelemetryId,syncId:sync.syncId});
        sync.fired=true;sync.coordinator.coordinatedShot(this,g,sync.syncId);this.shootT=.25;g.sfx.shoot('plant');
      }
      if(this.shootT>0)this.shootT-=dt;
      return;
    }
    const p = g.player,d=dist(this.x,this.y,p.x,p.y),wave=g.wave||1;
    this.faceTarget(p.x,p.y,dt,4);
    if(!g.encounter?.maxAlive){
      if(d<250){const a=Math.atan2(this.y-p.y,this.x-p.x);this.vx+=Math.cos(a)*this.speed*4*dt;this.vy+=Math.sin(a)*this.speed*4*dt;}
      else if(d>400){const a=Math.atan2(p.y-this.y,p.x-this.x);this.vx+=Math.cos(a)*this.speed*4*dt;this.vy+=Math.sin(a)*this.speed*4*dt;}
      if(this.rangedReady(dt,g,620)){this.atkCd=PLANT_STATS.spitter.atkCd;this.wantMouth=true;this.shootT=.25;const a=this.attackAngle+rand(-.06,.06);g.spawnEnemyBullet(this.x+Math.cos(a)*this.r,this.y+Math.sin(a)*this.r,Math.cos(a)*380,Math.sin(a)*380,this.dmg,'#b8ef5a',4,{sourceKind:'spitter',attackType:'single'});g.sfx.shoot('plant');}
      if(this.shootT>0)this.shootT-=dt;return;
    }
    if(d<250){const a=Math.atan2(this.y-p.y,this.x-p.x);this.vx+=Math.cos(a)*this.speed*4*dt;this.vy+=Math.sin(a)*this.speed*4*dt;}
    else if(d>400){const a=Math.atan2(p.y-this.y,p.x-this.x);this.vx+=Math.cos(a)*this.speed*4*dt;this.vy+=Math.sin(a)*this.speed*4*dt;}

    if(this.burstRemaining>0){
      this.burstTimer-=dt;
      if(this.burstTimer<=0){const a=this.burstAngle;g.spawnEnemyBullet(this.x+Math.cos(a)*this.r,this.y+Math.sin(a)*this.r,Math.cos(a)*380,Math.sin(a)*380,this.dmg,'#b8ef5a',4,{sourceKind:'spitter',attackType:'burst'});this.burstRemaining=0;this.wantMouth=true;this.shootT=.2;g.sfx.shoot('plant');}
    }
    const cycle=this.attackCycle||0,fan=wave>=8&&cycle%2===1,hadWind=this.attackWind>0;
    const ready=this.rangedReady(dt,g,620,fan?.64:.45);
    if(!hadWind&&this.attackWind>0){this.telegraphType=fan?'fan':'burst';this.telegraphCount=fan?3:2;this.telegraphSpread=fan?.17:0;}
    if(ready){
      this.attackCycle=cycle+1;this.atkCd=PLANT_STATS.spitter.atkCd;this.wantMouth=true;this.shootT=.25;
      if(fan){for(let i=-1;i<=1;i++){const a=this.attackAngle+i*.17;g.spawnEnemyBullet(this.x+Math.cos(a)*this.r,this.y+Math.sin(a)*this.r,Math.cos(a)*380,Math.sin(a)*380,this.dmg,'#b8ef5a',4,{sourceKind:'spitter',attackType:'fan'});}}
      else {const a=this.attackAngle;g.spawnEnemyBullet(this.x+Math.cos(a)*this.r,this.y+Math.sin(a)*this.r,Math.cos(a)*380,Math.sin(a)*380,this.dmg,'#b8ef5a',4,{sourceKind:'spitter',attackType:wave>=4?'burst':'single'});if(wave>=4){this.burstAngle=a;this.burstTimer=.22;this.burstRemaining=1;}}
      this.telegraphType=null;g.sfx.shoot('plant');
    }
    if(this.shootT>0)this.shootT-=dt;
  }

  draw(ctx, t) {
    if(typeof drawArtEnemy==='function'&&drawArtEnemy(ctx,this,t))return;
    this.drawShadow(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    // стебель
    ctx.strokeStyle = '#3d7a30';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, this.r * 0.4);
    ctx.quadraticCurveTo(Math.sin(this.wob) * 6, this.r * 1.1, Math.sin(this.wob * 1.3) * 9, this.r * 1.5);
    ctx.stroke();
    ctx.translate(Math.sin(this.wob * 1.3) * 9, this.r * 1.5 - this.r * 0.4);
    this.drawBulb(ctx, this.r, this.color);
    // раструб
    ctx.save();
    ctx.rotate(this.angle);
    ctx.fillStyle = '#c8f27a';
    ctx.beginPath();
    ctx.moveTo(this.r * 0.2, -this.r * 0.35);
    ctx.lineTo(this.r * 1.15, -this.r * 0.6 - this.mouth * 3);
    ctx.lineTo(this.r * 1.15, this.r * 0.6 + this.mouth * 3);
    ctx.lineTo(this.r * 0.2, this.r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#354a1e';
    ctx.beginPath();
    ctx.arc(this.r * 1.02, 0, this.r * 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    // глаз
    ctx.fillStyle = '#12210f';
    ctx.beginPath();
    ctx.arc(-this.r * 0.5, -this.r * 0.35, this.r * 0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// --- стационарный шипастый куст ---
class Resonator extends Spitter {
  constructor(x,y){
    super(x,y);
    this.isResonator=true;
    this.hp=this.maxHp=Math.round(this.maxHp*1.4);
    this.resonanceCooldown=1.5;
    this.resonanceInterval=6;
    this.coordinationRadius=400;
    this.warningSeconds=1.1;
    this.activeSync=null;
    this.syncSerial=0;
  }

  behave(dt,g){
    if(g.balanceConfigId==='threat-priority-v2'){
      this.updateResonance(dt,g);
      if(this.activeSync){this.vx=0;this.vy=0;this.wantMouth=true;return;}
      super.behave(dt,g);
      return;
    }
    super.behave(dt,g);
    this.updateResonance(dt,g);
  }

  updateResonance(dt,g){
    if(this.dead)return;
    if(this.activeSync){this.resolveSync(g,this.activeSync);return;}
    this.resonanceCooldown-=dt;
    if(this.resonanceCooldown>0)return;
    const eligible=g.enemies
      .filter(e=>e!==this&&!e.dead&&e.kind==='spitter'&&!e.isResonator&&!e.coordinatedAttack&&!(e.attackWind>0)&&!(e.burstRemaining>0)&&dist(this.x,this.y,e.x,e.y)<=this.coordinationRadius)
      .sort((a,b)=>dist(this.x,this.y,a.x,a.y)-dist(this.x,this.y,b.x,b.y))
      .slice(0,8);
    let partners=eligible.slice(0,2),crossfire=false;
    const version2=g.balanceConfigId==='threat-priority-v2';
    if(version2&&eligible.length>1){
      const p=g.player;let best=null,bestSpread=0;
      for(let i=0;i<eligible.length;i++)for(let j=i+1;j<eligible.length;j++){
        const a=Math.atan2(p.y-eligible[i].y,p.x-eligible[i].x),b=Math.atan2(p.y-eligible[j].y,p.x-eligible[j].x);
        const spread=Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
        if(spread>bestSpread){bestSpread=spread;best=[eligible[i],eligible[j]];}
      }
      if(best&&bestSpread>=.96){partners=best;crossfire=true;}
      else {partners=[];}
    }
    if(version2&&eligible.length===1)partners=eligible.slice(0,1);
    if(!partners.length){this.resonanceCooldown=.35;return;}
    const warningSeconds=version2?1.15:this.warningSeconds,p=g.player;
    const sync={id:++this.syncSerial,version:version2?2:1,startedAt:g.time,fireAt:g.time+warningSeconds,warningSeconds,participants:partners.slice(),shots:0,crossfire,targetX:p.x,targetY:p.y,lockedPositions:partners.map(e=>({x:e.x,y:e.y}))};
    this.activeSync=sync;
    for(const e of partners){
      const angle=Math.atan2(p.y-e.y,p.x-e.x);
      e.attackWind=0;e.burstRemaining=0;e.telegraphType=null;
      if(version2)e.atkCd=Math.max(e.atkCd||0,warningSeconds+.35);
      e.coordinatedAttack={coordinator:this,syncId:sync.id,angle,fireAt:sync.fireAt,fired:false,version:version2?2:1,targetX:p.x,targetY:p.y};
    }
    this.resonanceCooldown=version2?6:this.resonanceInterval;
    g.threat.resonatorSyncStart(this,sync,partners);
  }

  coordinatedShot(partner,g,syncId){
    const sync=this.activeSync;if(!sync||sync.id!==syncId)return;
    sync.shots++;
    g.threat.resonatorSyncShot(this,partner,syncId);
    this.resolveSync(g,sync,'shots-fired');
  }

  coordinatedParticipantDied(partner,g){
    const sync=this.activeSync;if(!sync||!sync.participants.includes(partner))return;
    partner.coordinatedAttack=null;
    this.resolveSync(g,sync,'participant-died');
  }

  resolveSync(g,sync,reason='shots-fired'){
    if(this.activeSync!==sync)return;
    const alive=sync.participants.filter(e=>!e.dead);
    const noSurvivors=alive.length===0;
    const resolved=alive.every(e=>e.coordinatedAttack?.syncId===sync.id&&e.coordinatedAttack.fired);
    if(!resolved)return;
    const interrupted=noSurvivors||sync.shots<alive.length;
    for(const e of sync.participants)if(e.coordinatedAttack?.syncId===sync.id)e.coordinatedAttack=null;
    this.activeSync=null;
    g.threat.resonatorSyncEnd(this,sync,interrupted,interrupted?(noSurvivors?'all-participants-died':reason):'shots-fired');
  }

  cancelResonance(g,meta={}){
    const sync=this.activeSync;if(!sync)return;
    const playerKill=meta.source==='player'||meta.weaponId==='melee'||(meta.weaponId&&Number.isInteger(meta.hand)&&meta.hand>=0&&meta.hand<=1);
    const duringPreparation=sync.shots===0&&g.time<sync.fireAt;
    if(sync.version===2)g.resonatorBreaks.push({x:this.x,y:this.y,at:g.time,duration:.58,playerInterrupted:!!(playerKill&&duringPreparation),participants:sync.participants.map(e=>({x:e.x,y:e.y}))});
    for(const e of sync.participants)if(e.coordinatedAttack?.syncId===sync.id)e.coordinatedAttack=null;
    this.activeSync=null;
    for(const e of sync.participants){e.attackWind=0;e.burstRemaining=0;e.telegraphType=null;}
    g.threat.resonatorSyncEnd(this,sync,true,playerKill?'coordinator-killed-by-player':'coordinator-died',!!(playerKill&&duringPreparation));
  }
}

class ThornBush extends Plant {
  constructor(x, y) { super(x, y, 'thorn'); }

  behave(dt, g) {
    const p=g.player,wave=g.wave||1;
    this.faceTarget(p.x,p.y,dt,2);
    if(!g.encounter?.maxAlive){
      if(this.rangedReady(dt,g,700,.7)){this.atkCd=PLANT_STATS.thorn.atkCd;this.wantMouth=true;this.shootT=.35;const base=this.attackAngle;for(let i=-1;i<=1;i++){const a=base+i*.22;g.spawnEnemyBullet(this.x+Math.cos(a)*this.r,this.y+Math.sin(a)*this.r,Math.cos(a)*420,Math.sin(a)*420,this.dmg,'#e6d06a',5,{sourceKind:'thorn',attackType:'fan3'});}g.sfx.shoot('plant');}
      if(this.shootT>0)this.shootT-=dt;return;
    }
    const cycle=this.attackCycle||0,wide=wave>=7&&cycle%2===1,count=wide?5:3,spread=wide?.18:.22,hadWind=this.attackWind>0;
    const ready=this.rangedReady(dt,g,700,wide?.68:.58);
    if(!hadWind&&this.attackWind>0){this.telegraphType='fan';this.telegraphCount=count;this.telegraphSpread=spread;}
    if(ready){
      this.attackCycle=cycle+1;this.atkCd=PLANT_STATS.thorn.atkCd;this.wantMouth=true;this.shootT=.35;
      for(let i=0;i<count;i++){const offset=(i-(count-1)/2)*spread,a=this.attackAngle+offset;g.spawnEnemyBullet(this.x+Math.cos(a)*this.r,this.y+Math.sin(a)*this.r,Math.cos(a)*420,Math.sin(a)*420,this.dmg,'#e6d06a',5,{sourceKind:'thorn',attackType:wide?'fan5':'fan3'});}
      this.telegraphType=null;g.sfx.shoot('plant');
    }
    if(this.shootT>0)this.shootT-=dt;
  }

  draw(ctx, t) {
    if(typeof drawArtEnemy==='function'&&drawArtEnemy(ctx,this,t))return;
    this.drawShadow(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.wob * 0.15);
    // шипы
    ctx.fillStyle = '#2b4f22';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + this.wob * 0.1;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(this.r * 0.8, -4);
      ctx.lineTo(this.r * 1.5, 0);
      ctx.lineTo(this.r * 0.8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    this.drawBulb(ctx, this.r * 0.92, this.color);
    // центральная пасть
    ctx.save();
    ctx.rotate(this.angle);
    ctx.fillStyle = '#1e3017';
    ctx.beginPath();
    ctx.ellipse(this.r * 0.25, 0, this.r * (0.2 + this.mouth * 0.45), this.r * (0.5 + this.mouth * 0.2), 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8f0d0';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.arc(this.r * 0.25 + Math.cos(a) * this.r * 0.34, Math.sin(a) * this.r * 0.34, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }
}

// --- босс ---
class MawBoss extends Plant {
  constructor(x, y) { super(x, y, 'maw'); this.glands={left:{side:'left',hp:120,maxHp:120,r:17,disabledUntil:0,disabledAt:null,disabledRemaining:0,enabled:true,x:x,y:y},right:{side:'right',hp:120,maxHp:120,r:17,disabledUntil:0,disabledAt:null,disabledRemaining:0,enabled:true,x:x,y:y}};this.glandsEnabled=false;this.sectorActiveT=0;this.sectorResolved=false; }

  refreshGlands() {
    const nx=-Math.sin(this.angle),ny=Math.cos(this.angle),offset=this.r+24;
    for(const side of PLANT_SIDE_NAMES){const sign=side==='left'?-1:1,gland=this.glands[side];gland.x=this.x+nx*offset*sign;gland.y=this.y+ny*offset*sign;gland.boss=this;}
  }

  glandAt(side) { this.refreshGlands();return this.glands[side]; }

  updateGlands(dt,g) {
    for(const gland of Object.values(this.glands)) {
      if(!gland.enabled&&gland.disabledRemaining>0)gland.disabledRemaining=Math.max(0,gland.disabledRemaining-dt);
      if(!gland.enabled&&gland.disabledRemaining<=1e-8) {
        const duration=gland.disabledDuration||6;
        gland.disabledUntil=0;gland.disabledAt=null;gland.disabledDuration=0;gland.hp=gland.maxHp;gland.enabled=true;
        g.threat.glandRecovered(this,gland.side,duration);
        g.particles.text(gland.x,gland.y-24,'ЖЕЛЕЗА ВОССТАНОВЛЕНА','#b5dd8d',10);
      }
    }
    this.refreshGlands();
  }

  pointInSector(x,y,g) {
    const rules=g.balanceConfig.boss,dx=x-this.x,dy=y-this.y,d=Math.hypot(dx,dy);
    return d>=(this.sectorInner||this.r+g.player.r+8) && d<=rules.sectorRange && Math.abs(angleDiff(this.attackAngle,Math.atan2(dy,dx)))<=rules.sectorHalfAngle;
  }

  drawGlands(ctx) {
    if(!this.glandsEnabled)return;
    this.refreshGlands();
    for(const side of PLANT_SIDE_NAMES) {
      const gland=this.glands[side],active=gland.enabled;
      ctx.save();ctx.strokeStyle=active?'#9a7550':'#46503a';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(this.x,this.y);ctx.lineTo(gland.x,gland.y);ctx.stroke();
      ctx.fillStyle=active?'#41552c':'#202b22';ctx.beginPath();ctx.arc(gland.x,gland.y,gland.r+4,0,TAU);ctx.fill();
      ctx.fillStyle=active?side==='left'?'#afca61':'#85b778':'#4c5640';ctx.beginPath();ctx.ellipse(gland.x,gland.y,gland.r,gland.r*.78,0,0,TAU);ctx.fill();
      ctx.strokeStyle=active?'#d6e8a1':'#6d775b';ctx.lineWidth=2;ctx.stroke();
      if(active){ctx.strokeStyle='#e5e9a9';ctx.lineWidth=2;ctx.beginPath();ctx.arc(gland.x,gland.y,gland.r*.48,-.7,.7);ctx.stroke();
        ctx.fillStyle='#18251b';ctx.fillRect(gland.x-18,gland.y-gland.r-14,36,4);ctx.fillStyle='#c3dc7e';ctx.fillRect(gland.x-18,gland.y-gland.r-14,36*clamp(gland.hp/gland.maxHp,0,1),4);
      } else {ctx.strokeStyle='#596449';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(gland.x-6,gland.y-4);ctx.lineTo(gland.x+6,gland.y+4);ctx.moveTo(gland.x+6,gland.y-4);ctx.lineTo(gland.x-6,gland.y+4);ctx.stroke();}
      ctx.fillStyle=active?'#d6e3a5':'#88917a';ctx.font='9px Consolas, monospace';ctx.textAlign='center';ctx.fillText(side==='left'?'КОЛЬЦО / СЕКТОР':'ВЕЕР',gland.x,gland.y+gland.r+14);ctx.restore();
    }
  }

  behave(dt, g) {
    if(g.bossBehaviorMode==='stage2d')return this.behaveExperiment(dt,g);
    if(g.bossBehaviorMode==='meaningful'||g.balanceConfig?.boss?.behavior==='meaningful'){this.glandsEnabled=true;return this.behaveMeaningful(dt,g);}
    if(g.balanceConfig?.boss)return this.behaveExperiment(dt,g);
    const p=g.player,d=dist(this.x,this.y,p.x,p.y),phase2=this.finalBoss?this.hp<this.maxHp*.55:this.hp<this.maxHp*.7;
    this.faceTarget(p.x,p.y,dt,3);
    if(!g.encounter?.maxAlive){
      const oldPhase2=this.finalBoss&&this.hp<this.maxHp*.55;
      if(oldPhase2&&!this.enraged){this.enraged=true;g.threat.phase(this);g.tip='Босс раскрыл сердце: веер, рывок, кольцо. После атаки уязвим!';g.tipT=7;g.sfx.wave();}
      const touching=this.r+p.r+5;
      if(d<touching){const a=d>0.01?Math.atan2(p.y-this.y,p.x-this.x):this.angle;p.x=clamp(this.x+Math.cos(a)*touching,p.r,LEVEL.w-p.r);p.y=clamp(this.y+Math.sin(a)*touching,p.r,LEVEL.h-p.r);g.lastDamageSource='Пасть босса';g.hurtPlayer(this.dmg,this.x,this.y,{label:'Пасть босса',sourceKind:'maw',attackType:this.chargeT>0?'charge':'contact',bossId:this.bossTelemetryId});}
      if(this.chargeT>0){this.chargeT-=dt;this.vx=Math.cos(this.attackAngle)*560;this.vy=Math.sin(this.attackAngle)*560;if(this.chargeT<=0)g.threat.attack(this,'charge');return;}
      if(d>210&&!(this.attackWind>0)&&!(this.recoverT>0)){const a=Math.atan2(p.y-this.y,p.x-this.x);this.vx+=Math.cos(a)*this.speed*5*dt;this.vy+=Math.sin(a)*this.speed*5*dt;}
      if(this.rangedReady(dt,g,850,oldPhase2?.75:.9)){const cycle=this.attackCycle||0;this.attackCycle=cycle+1;const pattern=oldPhase2?cycle%3:0;this.atkCd=oldPhase2?2.4:2.0;this.recoverT=.85;this.shootT=.5;if(pattern===2)this.chargeT=.45;else{g.threat.attack(this,pattern===1?'fan':'ring');const count=pattern===1?5:10;for(let i=0;i<count;i++){const a=this.attackAngle+(pattern===1?(i-2)*.18:i/count*TAU),speed=pattern===1?420:290;g.spawnEnemyBullet(this.x+Math.cos(a)*(this.r+6),this.y+Math.sin(a)*(this.r+6),Math.cos(a)*speed,Math.sin(a)*speed,this.dmg*.55,'#ff9b62',5,{sourceKind:'maw',attackType:pattern===1?'fan':'ring',bossId:this.bossTelemetryId});}}g.sfx.shoot('plant');}
      if(this.shootT>0)this.shootT-=dt;
      if(!this.summoned&&this.hp<this.maxHp*.55){this.summoned=true;for(let i=0;i<3;i++){const pos=g.findSpawnPos('sprout');if(pos)g.spawnWarnings.push({...pos,kind:'sprout',t:1});}}
      return;
    }
    if(phase2&&!this.enraged){this.enraged=true;g.threat.phase(this);g.tip='Босс готовит веер, рывок и кольцо. Следи за телеграфом и окном после атаки.';g.tipT=7;g.sfx.wave();}
    const touching=this.r+p.r+5;
    if(d<touching){const a=d>.01?Math.atan2(p.y-this.y,p.x-this.x):this.angle;p.x=clamp(this.x+Math.cos(a)*touching,p.r,LEVEL.w-p.r);p.y=clamp(this.y+Math.sin(a)*touching,p.r,LEVEL.h-p.r);g.hurtPlayer(this.dmg,this.x,this.y,{label:'Пасть босса',sourceKind:'maw',attackType:this.chargeT>0?'charge':'contact',bossId:this.bossTelemetryId});}
    if(this.chargeWind>0){this.chargeWind-=dt;this.vx=0;this.vy=0;if(this.chargeWind<=0){this.chargeWind=0;this.chargeT=.45;this.telegraphType=null;}return;}
    if(this.chargeT>0){this.chargeT-=dt;this.vx=Math.cos(this.attackAngle)*560;this.vy=Math.sin(this.attackAngle)*560;if(this.chargeT<=0)g.threat.attack(this,'charge');return;}
    if(d>210&&!(this.attackWind>0)&&!(this.recoverT>0)){const a=Math.atan2(p.y-this.y,p.x-this.x);this.vx+=Math.cos(a)*this.speed*5*dt;this.vy+=Math.sin(a)*this.speed*5*dt;}
    const cycle=this.attackCycle||0,pattern=phase2?cycle%3:0,hadWind=this.attackWind>0;
    const ready=this.rangedReady(dt,g,850,phase2?.75:.9);
    if(!hadWind&&this.attackWind>0){this.telegraphType=pattern===0?'ring':pattern===1?'fan':'charge';this.telegraphCount=pattern===0?10:5;this.telegraphSpread=pattern===1?.18:0;}
    if(ready){
      this.attackCycle=cycle+1;this.atkCd=phase2?2.4:2.0;this.recoverT=.85;this.shootT=.5;
      if(pattern===2){this.chargeWind=.48;this.telegraphType='charge';}
      else {
        g.threat.attack(this,pattern===1?'fan':'ring');const count=pattern===1?5:10;
        for(let i=0;i<count;i++){const a=this.attackAngle+(pattern===1?(i-2)*.18:i/count*TAU),speed=pattern===1?420:290;g.spawnEnemyBullet(this.x+Math.cos(a)*(this.r+6),this.y+Math.sin(a)*(this.r+6),Math.cos(a)*speed,Math.sin(a)*speed,this.dmg*.55,'#ff9b62',5,{sourceKind:'maw',attackType:pattern===1?'fan':'ring',bossId:this.bossTelemetryId});}
        this.telegraphType=null;
      }
      g.sfx.shoot('plant');
    }
    if(this.shootT>0)this.shootT-=dt;
    const summonAt=this.finalBoss?.55:.7;
    if(!this.summoned&&this.hp<this.maxHp*summonAt){const cap=g.encounter.maxAlive,occupied=g.enemies.filter(e=>!e.dead).length+g.spawnWarnings.length;let added=0;for(let i=0;i<3&&occupied+added<cap;i++){const pos=g.findSpawnPos('sprout');if(pos){g.spawnWarnings.push({...pos,kind:'sprout',t:1,sourceKind:'mawSupport'});added++;}}if(added)this.summoned=true;}
  }

  behaveExperiment(dt,g) {
    const rules=g.balanceConfig.boss,p=g.player,d=dist(this.x,this.y,p.x,p.y);
    const phase2=this.hp<this.maxHp*(this.finalBoss?rules.finalPhaseAt:rules.firstPhaseAt);
    if(phase2&&!this.enraged){this.enraged=true;g.threat.phase(this);if(!(this.attackWind>0||this.chargeWind>0||this.chargeT>0)){this.atkCd=Math.min(this.atkCd,rules.phaseResponseDelay);this.attackCycle=this.finalBoss?1:2;}else this.phaseResponseQueued=true;g.tip=this.finalBoss?'Пасть связывает кольцо, рывок и веер. После рывка смещайся в сторону.':'Пасть раскрылась: кольцо, веер, рывок. Лови окно после атаки.';g.tipT=7;g.sfx.wave();}
    this.faceTarget(p.x,p.y,dt,3);
    const touching=this.r+p.r+5;
    if(d<touching){const a=d>.01?Math.atan2(p.y-this.y,p.x-this.x):this.angle;p.x=clamp(this.x+Math.cos(a)*touching,p.r,LEVEL.w-p.r);p.y=clamp(this.y+Math.sin(a)*touching,p.r,LEVEL.h-p.r);g.hurtPlayer(this.dmg,this.x,this.y,{label:'Пасть босса',sourceKind:'maw',attackType:this.chargeT>0?'charge':'contact',bossId:this.bossTelemetryId});}
    if(this.chargeWind>0){this.chargeWind-=dt;this.vx=0;this.vy=0;if(this.chargeWind<=0){this.chargeWind=0;this.chargeT=rules.chargeDuration;this.telegraphType=null;}return;}
    if(this.chargeT>0){this.chargeT-=dt;this.vx=Math.cos(this.attackAngle)*rules.chargeSpeed;this.vy=Math.sin(this.attackAngle)*rules.chargeSpeed;if(this.chargeT<=0){g.threat.attack(this,'charge');this.recoverT=rules.recovery;this.atkCd=this.phaseResponseQueued?rules.phaseResponseDelay:this.finalBoss&&phase2?rules.finalComboGap:1.5;this.phaseResponseQueued=false;}return;}
    if(d>210&&!(this.attackWind>0)&&!(this.recoverT>0)){const a=Math.atan2(p.y-this.y,p.x-this.x);this.vx+=Math.cos(a)*this.speed*5*dt;this.vy+=Math.sin(a)*this.speed*5*dt;}
    // Final phase links existing attacks; every element has its own locked aim and warning.
    const patterns=this.finalBoss?(phase2?['ring','charge','fan','fan']:['ring','fan','charge']):(phase2?['ring','fan','charge']:['ring','fan']);
    const hadWind=this.attackWind>0;
    if(!hadWind)this.pendingPattern=patterns[(this.attackCycle||0)%patterns.length];
    const pattern=this.pendingPattern,ready=this.rangedReady(dt,g,850,pattern==='charge'?rules.chargeWind:phase2?rules.enragedWind:rules.wind);
    if(!hadWind&&this.attackWind>0){this.telegraphType=pattern;this.telegraphCount=pattern==='ring'?10:5;this.telegraphSpread=pattern==='fan'?.18:0;}
    if(ready){
      this.attackCycle=(this.attackCycle||0)+1;this.atkCd=this.finalBoss&&phase2?rules.finalComboGap:phase2?2.4:2;this.recoverT=rules.recovery;this.shootT=.5;
      if(pattern==='charge'){this.chargeWind=rules.chargeLockWind;this.telegraphType='charge';}
      else{const count=pattern==='fan'?5:10;for(let i=0;i<count;i++){const a=this.attackAngle+(pattern==='fan'?(i-2)*.18:i/count*TAU),speed=pattern==='fan'?420:290;g.spawnEnemyBullet(this.x+Math.cos(a)*(this.r+6),this.y+Math.sin(a)*(this.r+6),Math.cos(a)*speed,Math.sin(a)*speed,this.dmg*.55,'#ff9b62',5,{sourceKind:'maw',attackType:pattern,bossId:this.bossTelemetryId});}g.threat.attack(this,pattern);this.telegraphType=null;}
      if(this.phaseResponseQueued&&pattern!=='charge'){this.phaseResponseQueued=false;this.attackCycle=this.finalBoss?1:2;this.atkCd=rules.phaseResponseDelay;}
      g.sfx.shoot('plant');
    }
    if(this.shootT>0)this.shootT-=dt;
    const summonAt=this.finalBoss?.55:.7;
    if(!this.summoned&&this.hp<this.maxHp*summonAt){const cap=g.encounter.maxAlive,occupied=g.enemies.filter(e=>!e.dead).length+g.spawnWarnings.length;let added=0;for(let i=0;i<3&&occupied+added<cap;i++){const pos=g.findSpawnPos('sprout');if(pos){g.spawnWarnings.push({...pos,kind:'sprout',t:1,sourceKind:'mawSupport'});added++;}}if(added)this.summoned=true;}
  }

  behaveMeaningful(dt,g) {
    const rules=g.balanceConfig.boss,p=g.player,d=dist(this.x,this.y,p.x,p.y),phase2=this.hp<this.maxHp*(this.finalBoss?rules.finalPhaseAt:rules.firstPhaseAt);
    this.glandsEnabled=true;this.sectorRange=rules.sectorRange;this.sectorHalfAngle=rules.sectorHalfAngle;this.sectorInner=this.r+p.r+8;this.updateGlands(dt,g);
    if(phase2&&!this.enraged){this.enraged=true;g.threat.phase(this);this.attackCycle=1;g.tip='Пасть раскрывается шире. Железы слева и справа питают разные атаки.';g.tipT=6;g.sfx.wave();}
    this.faceTarget(p.x,p.y,dt,3);
    const touching=this.r+p.r+5;
    if(d<touching){const a=d>.01?Math.atan2(p.y-this.y,p.x-this.x):this.angle;p.x=clamp(this.x+Math.cos(a)*touching,p.r,LEVEL.w-p.r);p.y=clamp(this.y+Math.sin(a)*touching,p.r,LEVEL.h-p.r);g.hurtPlayer(this.dmg,this.x,this.y,{label:'Пасть босса',sourceKind:'maw',attackType:this.chargeT>0?'charge':'contact',bossId:this.bossTelemetryId});}
    if(this.sectorActiveT>0) {
      this.sectorActiveT=Math.max(0,this.sectorActiveT-dt);this.vx=0;this.vy=0;
      if(!this.sectorResolved){this.sectorResolved=true;const hit=this.pointInSector(p.x,p.y,g),dodged=this.sectorWasInside&&!hit;g.threat.sectorAttempt(this,hit,dodged);if(hit)g.hurtPlayer(rules.sectorDamage*this.dmg,this.x,this.y,{label:'Волна Пасти',sourceKind:'maw',attackType:'sector',bossId:this.bossTelemetryId});}
      if(this.sectorActiveT<=0){this.recoverT=rules.recovery;this.atkCd=phase2?rules.finalComboGap:1.25;}
      return;
    }
    if(this.chargeWind>0){this.chargeWind-=dt;this.vx=0;this.vy=0;if(this.chargeWind<=0){this.chargeWind=0;this.chargeT=rules.chargeDuration;this.telegraphType=null;}return;}
    if(this.chargeT>0){this.chargeT-=dt;this.vx=Math.cos(this.attackAngle)*rules.chargeSpeed;this.vy=Math.sin(this.attackAngle)*rules.chargeSpeed;if(this.chargeT<=0){g.threat.attack(this,'charge');this.recoverT=rules.recovery;this.atkCd=phase2?rules.finalComboGap:1.35;}return;}
    if(d>210&&!(this.attackWind>0)&&!(this.recoverT>0)){const a=Math.atan2(p.y-this.y,p.x-this.x);this.vx+=Math.cos(a)*this.speed*5*dt;this.vy+=Math.sin(a)*this.speed*5*dt;}
    const patterns=phase2?['fan','sector','charge','ring']:['ring','fan','sector','charge'],hadWind=this.attackWind>0;
    if(!hadWind)this.pendingPattern=patterns[(this.attackCycle||0)%patterns.length];
    const pattern=this.pendingPattern,linked=pattern==='ring'||pattern==='sector'?'left':pattern==='fan'?'right':null;
    if(!hadWind&&linked&&!this.glands[linked].enabled){this.attackCycle=(this.attackCycle||0)+1;this.pendingPattern=null;this.telegraphType=null;this.atkCd=.7;this.recoverT=.32;g.threat.attackSuppressed(this,pattern);return;}
    const wind=pattern==='charge'?rules.chargeWind:pattern==='sector'?rules.sectorWind:phase2?rules.enragedWind:rules.wind;
    const ready=this.rangedReady(dt,g,850,wind);
    if(pattern==='sector'&&this.attackWind>0){this.vx=0;this.vy=0;}
    if(!hadWind&&this.attackWind>0){this.telegraphType=pattern;this.telegraphCount=pattern==='ring'?10:pattern==='sector'?1:5;this.telegraphSpread=pattern==='fan'?.18:0;if(pattern==='sector'){this.angle=this.attackAngle;this.sectorWasInside=this.pointInSector(p.x,p.y,g);}}
    if(hadWind&&pattern==='sector')this.angle=this.attackAngle;
    if(ready){
      this.attackCycle=(this.attackCycle||0)+1;this.atkCd=phase2?rules.finalComboGap:1.45;this.shootT=.3;
      if(pattern==='charge'){this.recoverT=rules.recovery;this.chargeWind=rules.chargeLockWind;this.telegraphType='charge';}
      else if(pattern==='sector'){this.telegraphType=null;this.sectorResolved=false;this.sectorActiveT=.16;g.threat.attack(this,'sector');}
      else{const count=pattern==='fan'?5:10;for(let i=0;i<count;i++){const a=this.attackAngle+(pattern==='fan'?(i-2)*.18:i/count*TAU),speed=pattern==='fan'?420:290;g.spawnEnemyBullet(this.x+Math.cos(a)*(this.r+6),this.y+Math.sin(a)*(this.r+6),Math.cos(a)*speed,Math.sin(a)*speed,this.dmg*.55,'#ff9b62',5,{sourceKind:'maw',attackType:pattern,bossId:this.bossTelemetryId});}g.threat.attack(this,pattern);this.telegraphType=null;this.recoverT=rules.recovery;}
      g.sfx.shoot('plant');
    }
    if(this.shootT>0)this.shootT-=dt;
  }

  draw(ctx, t) {
    if(typeof drawArtEnemy==='function'&&drawArtEnemy(ctx,this,t))return;
    this.drawShadow(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    // лепестки
    for (let layer = 0; layer < 3; layer++) {
      const n = 8 + layer * 2;
      const rr = this.r * (1.25 - layer * 0.18);
      ctx.save();
      ctx.rotate(this.wob * (0.12 + layer * 0.05) * (layer % 2 ? -1 : 1));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        ctx.save();
        ctx.rotate(a);
        const grad = ctx.createLinearGradient(0, 0, rr, 0);
        grad.addColorStop(0, darken(this.color, 0.25));
        grad.addColorStop(1, layer === 0 ? '#6b1a35' : lighten(this.color, 0.1 - layer * 0.05));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(rr * 0.72, 0, rr * 0.42, rr * 0.2, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    this.drawBulb(ctx, this.r * 0.8, this.color);
    this.drawJaw(ctx, this.r * 0.8, this.mouth, 8);
    // сателлиты
    ctx.fillStyle = '#1b2b12';
    for (let i = 0; i < 3; i++) {
      const a = this.wob * 0.3 + i * 2.1;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * this.r * 0.55, Math.sin(a) * this.r * 0.55, this.r * 0.14, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    this.drawGlands(ctx);
  }
}

function makePlant(kind, x, y) {
  switch (kind) {
    case 'snapper': return new Snapper(x, y);
    case 'resonator': return new Resonator(x, y);
    case 'spitter': return new Spitter(x, y);
    case 'thorn': return new ThornBush(x, y);
    case 'maw': return new MawBoss(x, y);
    default: return new Sprout(x, y);
  }
}

// вспомогательное: осветлить/затемнить цвет
function lighten(hex, amount) {
  return mixHex(hex, '#ffffff', amount);
}
function darken(hex, amount) {
  return mixHex(hex, '#000000', amount);
}
function mixHex(a, b, t) {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const r = Math.round(lerp(pa.r, pb.r, t));
  const g = Math.round(lerp(pa.g, pb.g, t));
  const bl = Math.round(lerp(pa.b, pb.b, t));
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(h) {
  if (h[0] !== '#') {
    const m = h.match(/\d+/g);
    return { r: +m[0], g: +m[1], b: +m[2] };
  }
  const v = parseInt(h.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
