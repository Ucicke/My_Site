// player.js — зомби-игрок с двумя руками
'use strict';
const PICKUP_REJECTION_REASONS=['avoidMagnet','locked','no_free_slot','no_eligible_item_in_radius'];

// Event counters describe decisions, not simulation ticks. No entity references
// enter the saved report, and the short diagnostic history has a fixed bound.
function pickupReliabilityStats(g) {
  const ecology=g.runStats.ecology;
  return ecology.pickupReliability||(ecology.pickupReliability={version:1,manualPickups:0,magnetPickups:0,contactPickups:0,attractionStarted:0,attractionCompleted:0,attractionInterrupted:0,obstructedAttractions:0,emptyHeldHands:0,rejections:{},events:[],eventLimit:128,truncatedEvents:0});
}
function recordPickupReliability(g,type,item,detail) {
  const stats=pickupReliabilityStats(g),event={at:g.runStats.ecology.playSeconds,type};
  if(item){event.organId=item.organId??null;event.weapon=item.weaponId;}
  if(detail)Object.assign(event,detail);
  if(stats.events.length<stats.eventLimit)stats.events.push(event);else stats.truncatedEvents++;
}

function drawPlayerArm(ctx,handX,handY,centerX,centerY,angle,color,flash) {
  const sin=Math.sin(angle),cos=Math.cos(angle),sx=-sin*7,sy=cos*7,hx=handX-centerX,hy=handY-centerY,mx=sx*.6+hx*.55,my=sy*.6+hy*.55;
  ctx.strokeStyle=color;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(sx,sy);ctx.quadraticCurveTo(mx,my,hx,hy);ctx.stroke();
  ctx.fillStyle=flash?'#e8ffd0':'#b3cd97';ctx.beginPath();ctx.arc(hx,hy,5,0,TAU);ctx.fill();
}

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = 17;
    this.maxHp = 100;
    this.hp = 100;
    this.speed = 250;
    this.speedMul = 1;
    this.dmgMul = 1;
    this.fireRateMul = 1;
    this.regen = 0.7;
    this.alive = true;
    this.invuln = 0;
    this.hurtCd = 0;
    this.dashCooldown = 1.3;
    this.dashCd = 0;
    this.emptyCue = [0,0]; this.meleeCd = 0;
    this.mods = {}; this.build = [];
    this.stamina = 100; this.regenBudget = 16;
    this.reach = [{x:0,y:0},{x:0,y:0}];
    this.moveVector = {x:0,y:0};
    this.nearbyWeapon = null; this.fuseT=0;
    this.dashT = 0;
    this.walkPhase = 0;
    this.aimRight = 0;
    this.aimLeft = Math.PI;
    this.handL = { x: x - 16, y: y };
    this.handR = { x: x + 16, y: y };
    this.hands = [null, null];         // [левая, правая]
    this.useMouse = true;
    this.mouseIdle = 99;
    this.leftMirrored = false;
    this.firingL = false;
    this.firingR = false;
    this.muzzleT = 0;
    this.ammoBonus = 0;      // +15% патронов в новом оружии за каждый уровень
    this.swapTurn = 0;       // 0 — левая рука, 1 — правая (при замене полного оружия)
    this.lifeOnKill = 0;     // восстановление HP за убийство
    this.magnetTarget=null;this.magnetTargetSlot=-1;this.magnetObstructed=false;this.pickupSignalMask=0;
  }

  get leftWeapon() { return this.hands[0]; }
  get rightWeapon() { return this.hands[1]; }

  update(dt, g) {
    const input = g.input;

    if (!this.alive) return;

    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.dashT = Math.max(0, this.dashT - dt);
    this.hurtCd = Math.max(0, this.hurtCd - dt);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    this.emptyCue[0] = Math.max(0, this.emptyCue[0] - dt);
    this.emptyCue[1] = Math.max(0, this.emptyCue[1] - dt);
    this.meleeCd = Math.max(0,this.meleeCd-dt);

    // --- прицел: мышь или геймпад ---
    if (input.mouse.moved) this.mouseIdle = 0; else this.mouseIdle += dt;
    const padAim = Math.hypot(input.pad.aimX, input.pad.aimY) > 0.35;
    this.useMouse = !(input.usingPad && this.mouseIdle > 0.6);

    let aimR, aimL;
    if (this.useMouse) {
      const wx = g.cam.x + (input.mouse.x - g.vw / 2) / g.zoom;
      const wy = g.cam.y + (input.mouse.y - g.vh / 2) / g.zoom;
      aimR = Math.atan2(wy - this.y, wx - this.x);
      aimL = this.leftMirrored ? aimR + Math.PI : aimR;
    } else {
      aimR = padAim ? Math.atan2(input.pad.aimY, input.pad.aimX) : this.aimRight;
      aimL = this.leftMirrored ? aimR + Math.PI : aimR;
    }
    this.aimRight = lerpAngle(this.aimRight, aimR, clamp(dt * 22, 0, 1));
    this.aimLeft = lerpAngle(this.aimLeft, aimL, clamp(dt * 22, 0, 1));

    // переворот направления левой руки
    if (input.actionHit('flipLeft')) {
      this.leftMirrored = !this.leftMirrored;
      g.sfx.ui();
    }

    // --- движение ---
    let mx = 0, my = 0;
    if (input.pad.active && Math.hypot(input.pad.moveX, input.pad.moveY) > 0.15) {
      mx = input.pad.moveX; my = input.pad.moveY;
    } else {
      const kv = input.moveVector(this.moveVector);
      mx = kv.x; my = kv.y;
    }
    const moving = mx || my;
    const sprint = input.actionDown('sprint') && this.stamina > 5 && !!moving;
    this.stamina = clamp(this.stamina + (sprint ? -35 : 22)*dt,0,100);
    const autoDig=!!g.balanceConfig?.stage2mRecovery?.enabled&&g.balanceConfig.stage2mRecovery.mode==='stationary';
    const digging=!autoDig && input.actionDown('dig') && g.digSite && dist(this.x,this.y,g.digSite.x,g.digSite.y)<75;
    const spd = this.speed * this.speedMul * (sprint ? 1.25 : 1) * (digging ? .35 : 1);

    if (this.dashT <= 0) {
      this.vx += mx * spd * 9 * dt;
      this.vy += my * spd * 9 * dt;
      const max = spd;
      const vl = Math.hypot(this.vx, this.vy);
      if (vl > max) { this.vx = this.vx / vl * max; this.vy = this.vy / vl * max; }
      this.vx *= Math.pow(0.0015, dt);
      this.vy *= Math.pow(0.0015, dt);
    }
    if (moving) this.walkPhase += dt * 12;

    // --- рывок ---
    if (input.actionHit('dash') && this.dashCd <= 0) {
      let dx = mx, dy = my;
      if (!dx && !dy) { dx = Math.cos(this.aimRight); dy = Math.sin(this.aimRight); }
      this.vx = dx * 720; this.vy = dy * 720;
      this.dashT = 0.18;
      this.dashCd = this.dashCooldown;
      if(g.recordDash)g.recordDash();
      if(g.threat?.resonatorDashUse)g.threat.resonatorDashUse();
      this.invuln = Math.max(this.invuln, 0.28);
      g.particles.burst(this.x, this.y, 10, {
        speed: 160, life: 0.4, size: 4, color: '#6a8a4a', color2: '#2c3f22', drag: 0.86,
      });
      g.sfx.ui();
    }

    // --- движение и столкновения ---
    moveAndCollide(this, dt, this.r);
    this.x = clamp(this.x, this.r, LEVEL.w - this.r);
    this.y = clamp(this.y, this.r, LEVEL.h - this.r);

    if (input.actionHit('dropLeft')) this.dropHand(0,g);
    if (input.actionHit('dropRight')) this.dropHand(1,g);

    let replacing=false;
    if(input.actionHit('collectLeft')||input.actionHit('collectRight'))for(let i=0;i<g.pickups.length;i++){const p=g.pickups[i];if(!p.dead&&p.lock<=0&&!p.avoidMagnet&&p.type==='weapon'&&p.ammo>0&&dist(this.x,this.y,p.x,p.y)<115){replacing=true;break;}}
    if(replacing){this.fuseT=0;this.fusePair=null;}
    // Fusion is deliberate: release or lose either ingredient to cancel.
    const fuseHit=input.actionHit('fuse'),fuseDown=input.actionDown('fuse');
    const recipe=fuseHit||fuseDown?fusionPreview(this.hands[0],this.hands[1]):null;
    if(fuseHit && !recipe) {
      g.tip=(this.hands[0]?.def.fused||this.hands[1]?.def.fused) ? 'Сплав уже стабилен: повторное сращивание невозможно.' : 'Нужны два базовых органа с достаточным остатком заряда.';
      g.tipT=3;
    }
    if(fuseDown && recipe) {
      if(!this.fusePair || this.fusePair[0]!==this.hands[0] || this.fusePair[1]!==this.hands[1]){this.fuseT=0;this.fusePair=this.hands.slice();}
      this.fuseT+=dt;
      if(this.fuseT>=.85) this.fuseWeapons(g);
    } else {this.fuseT=0;this.fusePair=null;}
    // --- руки ---
    this.updateHands(dt, g);


    if (input.actionHit('melee') && this.meleeCd <= 0) {
      this.meleeCd=0.8;
      g.particles.burst(this.x,this.y,10,{speed:100,life:0.2,size:3,color:'#dce9ff'});
      for (const enemy of g.enemies) if (!enemy.dead && dist(this.x,this.y,enemy.x,enemy.y)<this.r+enemy.r+54) enemy.hurt(12,g,this.x,this.y,{weaponId:'melee',hand:-1});
    }
    // --- регенерация ---
    if (this.hurtCd <= 0 && this.hp < this.maxHp && this.regenBudget > 0) {
      const heal = Math.min(this.regen * dt,this.regenBudget,this.maxHp-this.hp);
      this.hp += heal; this.regenBudget -= heal;
      if(g.recordHealing)g.recordHealing('regeneration',heal,heal);
    }

    // --- подбор ---
    this.nearbyWeapon = null;
    const manualCollect=input.actionHit('collectLeft')||input.actionHit('collectRight');
    let nearestWeapon = 115;
    for (const p of g.pickups) {
      if (p.dead || p.lock > 0) continue;
      if (p.avoidMagnet && !manualCollect && dist(this.x, this.y, p.x, p.y) <= 160) continue;
      const distance = dist(this.x,this.y,p.x,p.y);
      if (p.type === 'weapon' && p.ammo>0 && distance<nearestWeapon) {this.nearbyWeapon=p;nearestWeapon=distance;}
      if (distance < this.r + p.r + 6 && (p.type !== 'weapon' || !manualCollect&&!p.avoidMagnet&&(!this.hands[0] || this.hands[0].empty || !this.hands[1] || this.hands[1].empty))) this.takePickup(p,g,undefined,this.magnetTarget===p?'magnet':'contact');
    }
    if (this.nearbyWeapon && !this.nearbyWeapon.dead) {
      if(input.actionHit('collectLeft')) this.takePickup(this.nearbyWeapon,g,0,'manual');
      else if(input.actionHit('collectRight')) this.takePickup(this.nearbyWeapon,g,1,'manual');
    } else if(manualCollect) {
      const stats=pickupReliabilityStats(g);stats.rejections.manual_no_item=(stats.rejections.manual_no_item||0)+1;
      recordPickupReliability(g,'rejected',null,{reason:'manual_no_item'});
    }
  }

  updateHands(dt, g) {
    const input = g.input;
    for (const h of this.hands) if (h) h.update(dt);

    const heldL = this.fuseT<=0 && (input.mouse.down || input.mouseJust.down || input.actionHit('fireLeft') || input.actionDown('fireLeft') || input.pad.fireL);
    const heldR = this.fuseT<=0 && (input.mouse.right || input.mouseJust.right || input.actionHit('fireRight') || input.actionDown('fireRight') || input.pad.fireR);

    this.firingL = heldL;
    this.firingR = heldR;

    // позиции рук
    const sinR=Math.sin(this.aimRight),cosR=Math.cos(this.aimRight),sinL=Math.sin(this.aimLeft),cosL=Math.cos(this.aimLeft);
    this.handR.x=this.x+cosR*13-sinR*9;this.handR.y=this.y+sinR*13+cosR*9;
    this.handL.x=this.x+cosL*13+sinL*9;this.handL.y=this.y+sinL*13-cosL*9;

    for (let i=0;i<2;i++) if(this.hands[i] && this.hands[i].empty) {
      pickupReliabilityStats(g).emptyHeldHands++;recordPickupReliability(g,'empty_held',null,{slot:i,weapon:this.hands[i].id});this.hands[i]=null;
    }
    let reachIndex=-1;
    // пустая рука тянется к ближайшему стволу и притягивает его к игроку
    const emptyHand=!this.hands[0]||this.hands[0].ammo<=0?0:!this.hands[1]||this.hands[1].ammo<=0?1:-1;
    // Control profiles retain the old pull physics for reproducible comparisons.
    const magnetRules=g.balanceConfig?.level01?.pickup,legacyPull=!!g.balanceConfig?.level01&&!magnetRules;
    const magnetRadius=magnetRules?.magnetRadius??130,pullAcceleration=legacyPull?1400:magnetRules?.pullAcceleration??4200,maxPullSpeed=legacyPull?320:magnetRules?.maxPullSpeed??600;
    let target = null,nearest = magnetRadius,signalMask=0,nearEligible=false;
    for (const pickup of g.pickups) {
      if (pickup.dead || pickup.type !== 'weapon' || pickup.ammo <= 0) continue;
      const d=dist(this.x,this.y,pickup.x,pickup.y);if(d>=magnetRadius)continue;
      if(pickup.avoidMagnet){signalMask|=1;continue;}
      if(pickup.lock>0){signalMask|=2;continue;}
      nearEligible=true;
      if(emptyHand>=0&&d<nearest){nearest=d;target=pickup;}
    }
    if(emptyHand<0&&nearEligible)signalMask|=4;
    if(emptyHand>=0&&!target)signalMask|=8;
    for(let i=0;i<PICKUP_REJECTION_REASONS.length;i++)if((signalMask&(1<<i))&&!(this.pickupSignalMask&(1<<i))){const reason=PICKUP_REJECTION_REASONS[i],stats=pickupReliabilityStats(g);stats.rejections[reason]=(stats.rejections[reason]||0)+1;recordPickupReliability(g,'rejected',null,{reason});}
    this.pickupSignalMask=signalMask;
    if(this.magnetTarget!==target){
      if(this.magnetTarget&&!this.magnetTarget.dead){const old=this.magnetTarget,reason=emptyHand<0?'no_free_slot':old.avoidMagnet?'avoidMagnet':old.lock>0?'locked':old.ammo<=0?'empty_item':dist(this.x,this.y,old.x,old.y)>=magnetRadius?'out_of_range':target?'nearer_eligible_item':'target_unavailable';pickupReliabilityStats(g).attractionInterrupted++;recordPickupReliability(g,'attraction_interrupted',old,{reason});}
      if(target){pickupReliabilityStats(g).attractionStarted++;recordPickupReliability(g,'attraction_started',target,{slot:emptyHand,distance:Math.round(nearest),radius:magnetRadius,pullAcceleration,maxPullSpeed});}
      this.magnetTarget=target;this.magnetTargetSlot=emptyHand;
      this.magnetObstructed=false;
    }
    if (emptyHand >= 0) {
      if (target) {
        // Observe physical obstruction without changing pathing or eligibility.
        const dx=target.x-this.x,dy=target.y-this.y,len2=dx*dx+dy*dy;let obstructed=false;
        for(const o of LEVEL.obstacles){const u=clamp(((o.x-this.x)*dx+(o.y-this.y)*dy)/(len2||1),0,1),ox=this.x+u*dx-o.x,oy=this.y+u*dy-o.y,r=o.r+target.r;if(ox*ox+oy*oy<r*r){obstructed=true;break;}}
        if(obstructed&&!this.magnetObstructed){pickupReliabilityStats(g).obstructedAttractions++;recordPickupReliability(g,'attraction_obstructed',target,{reason:'obstacle_on_pull_path'});}
        this.magnetObstructed=obstructed;
        const hand = emptyHand === 0 ? this.handL : this.handR;
        reachIndex=emptyHand;
        const offset=this.reach[emptyHand];
        offset.x=lerp(offset.x,target.x-hand.x,clamp(dt*12,0,1));
        offset.y=lerp(offset.y,target.y-hand.y,clamp(dt*12,0,1));
        hand.x += offset.x; hand.y += offset.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        target.vx -= dx / d * pullAcceleration * dt;
        target.vy -= dy / d * pullAcceleration * dt;
        const speed = Math.hypot(target.vx, target.vy);
        if (speed > maxPullSpeed) { target.vx = target.vx / speed * maxPullSpeed; target.vy = target.vy / speed * maxPullSpeed; }
      }
    }

    for(let i=0;i<2;i++) if(i!==reachIndex) {
      const offset=this.reach[i];
      if(this.hands[i]) {offset.x=0;offset.y=0;}
      else {
        offset.x*=Math.exp(-12*dt);offset.y*=Math.exp(-12*dt);
        const hand=i===0 ? this.handL : this.handR;
        hand.x+=offset.x;hand.y+=offset.y;
      }
    }
    // любое оружие стреляет очередью, пока игрок удерживает кнопку
    for(let i=0;i<2;i++){
      const w=this.hands[i],held=i===0?heldL:heldR;if(!w)continue;
      if(!held){w.cool=Math.max(0,w.cool);continue;}
      let volleys=0;while(w.cool < -1e-9 && w.canFire() && volleys<64){this.shoot(w,i===0?this.aimLeft:this.aimRight,i===0?this.handL:this.handR,g,i);volleys++;}
      if(volleys===64)w.cool=Math.max(0,w.cool); // pathological rates: bounded work, no stored burst
    }
  }

  shoot(w, angle, hand, g, handIndex) {
    if (w.ammo <= 0) {
      if(this.emptyCue[handIndex || 0] <= 0) {g.particles.text(this.x,this.y-34,'ПУСТО','#ffb080',13);g.sfx.ui('error');this.emptyCue[handIndex || 0]=1.2;}
      return;
    }
    if (!w.canFire()) return;
    w.fire(this.dmgMul, this.fireRateMul);
    if(w.empty){g.tip='Ствол пуст. Подойди к находке или используй аварийный удар: '+g.input.prompt('melee');g.tipT=4;}
    g.runStats.shotsFired++;
    for(const b of g.threat.data.bosses)if(b.deathAt===null)b.shotsByWeapon[w.id]=(b.shotsByWeapon[w.id]||0)+1;
    if (g.currentWaveStats) g.currentWaveStats.shots++;
    g.runStats.weaponShots[w.id] = (g.runStats.weaponShots[w.id] || 0) + 1;
    if (g.currentWaveStats) g.currentWaveStats.weaponShots[w.id] = (g.currentWaveStats.weaponShots[w.id] || 0) + 1;

    const def = w.def;
    const mp = w.muzzlePos(hand.x, hand.y, angle);
    const mx = mp.x, my = mp.y;
    const shot=effectiveShot(w,this);
    const shotId=++g.shotSerial,relayTargets=shot.relay?new Set():null,builds=g.runStats.builds;for(const gene of def.genes||[w.id])builds.genesUsed[gene]=(builds.genesUsed[gene]||0)+1;
    if(shot.slug)buildTrigger(g,'seedSlug');const segment=builds.segments.at(-1);if(segment)segment.shotsByHand[handIndex||0]++;
    g.weaponMetric(w.id).shots++;
    const ecology=g.runStats.ecology;ecology.shotsByHand[handIndex||0]++;ecology.nominalSpent+=weaponChargeDamage(w.def);
    if(Number.isInteger(w.fusionIndex))g.runStats.fusions[w.fusionIndex].shots++;
    for (let i = 0; i < shot.pellets; i++) {
      const a = shotAngle(shot,i,angle,w);
      const sp = shot.speed * rand(0.92, 1.08);
      g.spawnBullet(mx, my, Math.cos(a) * sp, Math.sin(a) * sp, shot.dmg, def.color, def.size, {
        weaponId:w.id, hand:handIndex,fusionIndex:w.fusionIndex,shotId,relayTargets,
        slow:shot.slow,
        bounce:shot.bounce,
        echo:shot.echo,
        pierce:shot.pierce,
        explode:shot.explode,
        explodeDmg:shot.explodeDmg,
        knock: shot.knock,
        owner: 'player',
      });
    }

    // вспышка, дым, отдача
    g.particles.burst(mx, my, 4, {
      speed: 150, life: 0.18, size: 3, color: '#ffe9a0', color2: '#ffb347', drag: 0.8,
      angle: angle, spread: 1.1, glow: true,
    });
    this.vx -= Math.cos(angle) * def.recoil * 22;
    this.vy -= Math.sin(angle) * def.recoil * 22;
    g.shake(w.id==='bone'?3.1:w.id==='spitter'?.28:def.recoil*2.2);
    g.sfx.shoot(def.sound);
    this.muzzleT = 0.08;
  }

  fuseWeapons(g) {
    const recipe=fusionPreview(this.hands[0],this.hands[1]);
    this.fuseT=0;this.fusePair=null;
    if(!recipe)return false;
    const ingredients=this.hands.map(w=>({id:w.id,ammo:w.ammo,cap:w.cap,organId:w.organId,origin:w.origin}));
    this.hands=[new Weapon(recipe.id,recipe.ammo,0,recipe.cap),null];
    this.reach=[{x:0,y:0},{x:0,y:0}];
    g.runStats.fusions.push({wave:g.wave,at:g.runStats.ecology.playSeconds,id:recipe.id,ingredients,ammo:recipe.ammo,cap:recipe.cap,sourceDamage:recipe.sourceDamage,resultDamage:recipe.resultDamage,shots:0,damage:0,kills:0,firstRefillAt:null,refillDelay:null});
    this.hands[0].fusionIndex=g.runStats.fusions.length-1;this.hands[0].origin={type:'fusion'};
    g.organEvent('fusion',{id:recipe.id,ingredients,ammo:recipe.ammo,resourceBonus:recipe.resultDamage-recipe.sourceDamage});
    g.particles.burst(this.x,this.y,28,{speed:180,life:.65,size:5,color:'#c3ce7d',color2:'#b5db9a'});
    g.particles.text(this.x,this.y-38,recipe.def.name,'#ffd0e8',15);
    g.tip=recipe.def.desc+' Сплав в левой руке; правая свободна.';g.tipT=5;
    g.sfx.fuse();g.shake(5);
    return true;
  }

  takePickup(p, g, requestedSlot, method='manual') {
    if (p.type === 'weapon') {
      if (p.dead || p.ammo <= 0 || p.lock>0) return;
      const stats=pickupReliabilityStats(g),automatic=method==='magnet'||method==='contact';
      if(automatic&&(p.avoidMagnet||!this.hands.some(h=>!h||h.empty))){const reason=p.avoidMagnet?'avoidMagnet':'no_free_slot';stats.rejections[reason]=(stats.rejections[reason]||0)+1;recordPickupReliability(g,'rejected',p,{reason});return;}
      const bonus = this.ammoBonus || 0;
      const cap = p.weaponCap || Math.max(1, Math.round((WEAPON_DEFS[p.weaponId].mag + WEAPON_DEFS[p.weaponId].reserve) * (1 + bonus * 0.15)));

      // сперва занимаем пустой слот, иначе заменяем оружие по очереди
      let idx = this.hands.findIndex((h) => !h || h.ammo <= 0);
      if (idx < 0) {
        idx = this.swapTurn;
        this.swapTurn = 1 - this.swapTurn;
      }

      if (requestedSlot === 0 || requestedSlot === 1) idx=requestedSlot;
      const old = this.hands[idx];
      if(old && old.ammo>0){const resource=old.ammo*weaponChargeDamage(old.def);g.runStats.losses.push({wave:g.wave,at:g.runStats.ecology.playSeconds,weapon:old.id,ammo:old.ammo,cap:old.cap,resource,reason:'replacement'});g.runStats.ecology.replacementResourceLost+=resource;}
      if (old) {
        const message = old.ammo <= 0 ? 'орган иссох' : 'старый орган растворён';
        const color = old.ammo <= 0 ? '#9aa08a' : '#ffcf8a';
        g.particles.text(this.x, this.y - 30, message, color, 11);
        g.particles.burst(this.x, this.y, 8, { speed: 120, life: 0.4, size: 3, color: old.def.color });
      }
      this.fuseT=0;this.fusePair=null;
      this.hands[idx] = new Weapon(p.weaponId, Math.min(Math.round(p.ammo * (p.fresh === false ? 1 : 1 + bonus*0.15)), cap), bonus, cap);
      this.hands[idx].origin=p.origin||{type:'unknown'};this.hands[idx].organId=p.organId;
      if(Number.isInteger(p.fusionIndex))this.hands[idx].fusionIndex=p.fusionIndex;
      const eco=g.runStats.ecology;eco.acquired[p.weaponId]=(eco.acquired[p.weaponId]||0)+1;
      if(g.recordCombatValue)g.recordCombatValue('weaponPickups');
      g.organEvent('pickup',{organId:p.organId,weapon:p.weaponId,slot:idx,ammo:this.hands[idx].ammo,origin:this.hands[idx].origin,replaced:old?{id:old.id,ammo:old.ammo}:null});
      if(idx===1){const f=this.hands[0]?.fusionIndex;if(Number.isInteger(f)&&g.runStats.fusions[f].firstRefillAt===null){const record=g.runStats.fusions[f];record.firstRefillAt=g.runStats.ecology.playSeconds;record.refillDelay=record.firstRefillAt-record.at;}}
      g.runStats.weaponPickups++;
      const counter=method==='manual'?'manualPickups':method==='magnet'?'magnetPickups':'contactPickups';stats[counter]++;
      recordPickupReliability(g,'pickup',p,{method,slot:idx});
      if(this.magnetTarget===p){if(method==='magnet'){stats.attractionCompleted++;recordPickupReliability(g,'attraction_completed',p,{method,slot:idx});}else{stats.attractionInterrupted++;recordPickupReliability(g,'attraction_interrupted',p,{reason:'manual_pickup'});}this.magnetTarget=null;this.magnetTargetSlot=-1;}
      if (g.currentWaveStats) g.currentWaveStats.weaponPickups++;
      g.particles.text(this.x, this.y - 30, WEAPON_DEFS[p.weaponId].name, '#e8ffb0', 12);
      p.dead = true;
      g.sfx.pickup('equip');
    } else if (p.type === 'health') {
      if (this.hp >= this.maxHp) {if(!p.fullHealthTouchRecorded){p.fullHealthTouchRecorded=true;for(const s of [g.runStats?.combat,g.currentWaveStats?.combat])if(s)s.healing.fullHealthTouches++;}return;}
      const before=this.hp;this.hp = Math.min(this.maxHp, this.hp + 28);const restored=this.hp-before;
      if(g.recordHealing)g.recordHealing('healthPickup',28,restored);
      g.runStats.healthPickups++;
      for(const s of [g.runStats?.combat,g.currentWaveStats?.combat])if(s)s.healing.healthCollected++;
      if (g.currentWaveStats) g.currentWaveStats.healthPickups++;
      p.dead = true;
      g.particles.burst(this.x, this.y, 10, { speed: 140, life: 0.5, size: 4, color: '#7bf59a', glow: true });
      g.sfx.pickup();
    } else if (p.type === 'ammo') {
      // патронов в запасе больше нет — подбирать нечего
      p.dead = true;
    }
  }

  dropToGround(w, index, g) {
    if (!w || w.ammo <= 0) return;      // пустое оружие не падает на землю
    const a = index === 1 ? this.aimRight : this.aimLeft;
    const pk = new Pickup(this.x + Math.cos(a) * 55, this.y + Math.sin(a) * 55, 'weapon', w.id, w.ammo);
    pk.vx = Math.cos(a) * 180;
    pk.vy = Math.sin(a) * 180;
    pk.avoidMagnet = true; pk.fresh=false;pk.weaponCap=w.cap;
    pk.origin=w.origin;pk.organId=w.organId;pk.fusionIndex=w.fusionIndex;
    g.runStats.losses.push({wave:g.wave,weapon:w.id,ammo:w.ammo,reason:'manualDrop'});
    pk.lock = 0.6;
    g.pickups.push(pk);
    g.particles.text(this.x, this.y - 26, 'выброшено', '#ffcf8a', 11);
  }

  dropHand(index, g) {
    const w = this.hands[index];
    if (!w) return;
    this.fuseT=0;this.fusePair=null;
    this.hands[index] = null;
    this.dropToGround(w, index, g);
    g.sfx.ui('drop');
  }

  hurt(amount, srcX, srcY, g) {
    if (!this.alive) return;
    if (this.invuln > 0 || this.dashT > 0) return;
    g.runStats.damageTaken += Math.min(this.hp, amount);
    this.hp -= amount;
    this.hurtCd = 4;
    if (g.currentWaveStats) g.currentWaveStats.damageTaken += Math.min(this.hp + amount, amount);
    this.invuln = 0.55;
    const a = Math.atan2(this.y - srcY, this.x - srcX);
    this.vx += Math.cos(a) * 260;
    this.vy += Math.sin(a) * 260;
    g.particles.burst(this.x, this.y, 12, {
      speed: 190, life: 0.5, size: 4, color: '#8fdc5a', color2: '#3c6b2a',
    });
    g.particles.text(this.x, this.y - 26, '-' + Math.round(amount), '#ff8a8a', 15);
    g.shake(6);
    g.sfx.hurt();
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      g.onPlayerDeath();
    }
  }

  draw(ctx, t) {
    if (!this.alive) return;
    if(typeof drawArtPlayer==='function'&&drawArtPlayer(ctx,this,t))return;
    const flash = this.invuln > 0 && Math.floor(t * 20) % 2 === 0;
    ctx.save();
    ctx.translate(this.x, this.y);

    // мягкий свет вокруг игрока — чтобы не путать с растениями
    const halo = ctx.createRadialGradient(0, 4, 4, 0, 4, 40);
    halo.addColorStop(0, 'rgba(190,240,160,0.20)');
    halo.addColorStop(1, 'rgba(190,240,160,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 4, 40, 0, TAU);
    ctx.fill();

    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 14, 5, 0, 0, TAU);
    ctx.fill();

    // ноги
    const step = Math.sin(this.walkPhase) * 5;
    ctx.strokeStyle = '#3d5a33';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3, 6); ctx.lineTo(-4 - step * 0.6, 18);
    ctx.moveTo(3, 6); ctx.lineTo(4 + step * 0.6, 18);
    ctx.stroke();

    // корпус
    const grad = ctx.createLinearGradient(-this.r, -this.r, this.r, this.r);
    grad.addColorStop(0, '#b9d39a');
    grad.addColorStop(1, '#6b8a55');
    ctx.fillStyle = flash ? '#e8ffd0' : grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.r * 0.95, this.r * 1.1, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,18,8,0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // рваная одежда
    ctx.fillStyle = 'rgba(64,46,32,0.85)';
    ctx.beginPath();
    ctx.moveTo(-this.r * 0.9, -2);
    ctx.lineTo(this.r * 0.9, -2);
    ctx.lineTo(this.r * 0.6, 12);
    ctx.lineTo(this.r * 0.2, 6);
    ctx.lineTo(-this.r * 0.3, 13);
    ctx.lineTo(-this.r * 0.9, 5);
    ctx.closePath();
    ctx.fill();

    // голова
    const hx = Math.cos(this.aimRight) * 5, hy = Math.sin(this.aimRight) * 5 - 9;
    ctx.fillStyle = flash ? '#e8ffd0' : '#a9c98c';
    ctx.beginPath();
    ctx.arc(hx, hy, 10, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,18,8,0.85)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // лохматые волосы
    ctx.fillStyle = '#3f5236';
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      const rr = 10.5 + Math.sin(i * 2.3) * 2.5;
      const px = hx + Math.cos(a) * rr, py = hy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // глаза
    ctx.fillStyle = '#12210f';
    const ea = this.aimRight;
    ctx.beginPath();
    ctx.arc(hx + Math.cos(ea) * 3 - Math.sin(ea) * 3.5, hy + Math.sin(ea) * 3 + Math.cos(ea) * 3.5, 2.1, 0, TAU);
    ctx.arc(hx + Math.cos(ea) * 3 + Math.sin(ea) * 3.5, hy + Math.sin(ea) * 3 - Math.cos(ea) * 3.5, 2.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff5a6a';
    ctx.beginPath();
    ctx.arc(hx + Math.cos(ea) * 4 - Math.sin(ea) * 3.5, hy + Math.sin(ea) * 4 + Math.cos(ea) * 3.5, 0.9, 0, TAU);
    ctx.arc(hx + Math.cos(ea) * 4 + Math.sin(ea) * 3.5, hy + Math.sin(ea) * 4 - Math.cos(ea) * 3.5, 0.9, 0, TAU);
    ctx.fill();

    // руки (рукава)
    drawPlayerArm(ctx,this.handL.x,this.handL.y,this.x,this.y,this.aimLeft,'#7c9b62',flash);
    drawPlayerArm(ctx,this.handR.x,this.handR.y,this.x,this.y,this.aimRight,'#93b377',flash);

    ctx.restore();

    // оружие
    if (this.hands[0]) this.hands[0].draw(ctx, this.handL.x, this.handL.y, this.aimLeft, 0.85);
    if (this.hands[1]) this.hands[1].draw(ctx, this.handR.x, this.handR.y, this.aimRight, 0.85);
  }
}
