// game.js — игровой цикл, волны, снаряды, состояния
'use strict';
const BOSS_GLAND_SIDES=['left','right'];

// Stage 2D observational telemetry. No random draws and no gameplay decisions.
'use strict';
function vampirismCapacity(p,rules=p.sustainRules) {
 const picks=Math.round(p.lifeOnKill/3);
 return rules&&picks>0?rules.vampirismFirstBudget+Math.max(0,picks-1)*rules.vampirismRepeatBudget:null;
}
function createRiskStats(){return {seconds:0,fullSeconds:0,below75Seconds:0,below50Seconds:0,below30Seconds:0,dangerEpisodes:0,inDanger:false,acceptedHits:0,rawDamage:0,afterArmorDamage:0,preventedByArmor:0,hpLost:0,healing:{},recoveries:[],samples:[],sampleOverflow:0};}
class ThreatTelemetry {
 constructor(g){this.g=g;this.data={version:1,risk:createRiskStats(),encounters:[],bosses:[],resonators:[]};this.time=0;this.nextSample=0;this.recovery=null;}
 startWave(wave){
  const plan=this.g.encounter,hunt=plan?.kind==='hunt'?{mode:plan.huntMode||'simultaneous',goal:plan.goal||3,targets:[],offTargetKills:0,markedAliveMax:0,objectiveCompletedAt:null}:null;
  const threatPriority=['threat-priority-test','threat-priority-v2'].includes(this.g.balanceConfigId)?{resonatorsSpawned:0,syncStarts:0,syncCompletions:0,syncInterrupted:0,coordinationInterruptedByPlayer:0,coordinatedDamageToPlayer:0,ordinarySpitterDamageToPlayer:0,completion:null}:null;
  this.encounter={wave,startedAt:this.time,endedAt:null,durationSeconds:null,completed:null,vampirismCapacity:vampirismCapacity(this.g.player),vampirismSpent:0,risk:createRiskStats(),hunt,threatPriority};
  this.data.encounters.push(this.encounter);this.nextSample=this.time;this.sample('start');
 }

  resonatorSpawn(e){
    const id='resonator-'+(this.data.resonators.length+1),record={id,wave:this.g.wave,spawnedAt:this.time,x:Math.round(e.x),y:Math.round(e.y),maxHp:e.maxHp,deathAt:null,lifetimeSeconds:null,firstHit:null,killedBy:null,killedBeforeFirstSpecialShot:null,firstPreparationAt:null,timeToFirstPreparation:null,damageBeforePreparation:0,damageAfterPreparation:0,syncStarts:0,syncCompletions:0,syncInterrupted:0,coordinationInterruptedByPlayer:0,shotsFired:0,coordinatedDamageToPlayer:0,dashUsesDuringThreat:0,events:[],activations:[],attacks:[]};
    e.resonatorTelemetryId=id;this.data.resonators.push(record);
    if(this.encounter?.threatPriority)this.encounter.threatPriority.resonatorsSpawned++;
  }
  resonatorRecord(e){return this.data.resonators.find(r=>r.id===e?.resonatorTelemetryId)||null;}
  resonatorHit(e,meta={}){
    const r=this.resonatorRecord(e);if(!r)return;
    if(!r.firstHit)r.firstHit={at:this.time,weaponId:meta.weaponId||'unknown',damage:Math.round(meta.damage||0)};
    if(r.firstPreparationAt===null)r.damageBeforePreparation+=Math.max(0,meta.damage||0);else r.damageAfterPreparation+=Math.max(0,meta.damage||0);
  }
  resonatorSyncStart(e,sync,participants){
    const r=this.resonatorRecord(e);if(!r)return;
    r.syncStarts++;const p=this.g.player,dx=e.x-p.x,dy=e.y-p.y,distance=Math.hypot(dx,dy);
    if(r.firstPreparationAt===null){r.firstPreparationAt=this.time;r.timeToFirstPreparation=Math.max(0,this.time-r.spawnedAt);}
    r.activations.push({at:this.time,distance:Math.round(distance),quadrant:(dx<0?'W':'E')+(dy<0?'N':'S'),participantCount:participants.length});
    r.attacks.push({syncId:sync.id,startedAt:this.time,fireAt:this.time+sync.warningSeconds,warningSeconds:sync.warningSeconds,crossfire:!!sync.crossfire,target:{x:Math.round(sync.targetX??p.x),y:Math.round(sync.targetY??p.y)},participants:participants.map(e=>({x:Math.round(e.x),y:Math.round(e.y),angle:+(e.coordinatedAttack?.angle||0).toFixed(4)})),participantCount:participants.length,shots:0,coordinatorDeathAfterSeconds:null,endedAt:null,result:null,terminationReason:null,dashUses:0,dashEvents:[]});
    if(this.encounter?.threatPriority)this.encounter.threatPriority.syncStarts++;
  }
  resonatorSyncShot(e,participant,syncId){
    const r=this.resonatorRecord(e);if(!r)return;r.shotsFired++;
    const attack=r.attacks.find(a=>a.syncId===syncId);if(attack)attack.shots++;
  }
  resonatorSyncEnd(e,sync,interrupted,reason='shots-fired',playerInterrupted=false){
    const r=this.resonatorRecord(e);if(!r)return;
    const attack=r.attacks.find(a=>a.syncId===sync.id);if(attack){attack.endedAt=this.time;attack.result=interrupted?'interrupted':'completed';attack.terminationReason=reason;if(reason.startsWith('coordinator-'))attack.coordinatorDeathAfterSeconds=Math.max(0,this.time-attack.startedAt);}
    if(interrupted)r.syncInterrupted++;else r.syncCompletions++;
    if(playerInterrupted&&attack){
      const event={type:'coordinationInterruptedByPlayer',at:this.time,resonatorId:r.id,syncId:sync.id,secondsIntoPreparation:Math.max(0,this.time-attack.startedAt),damageBeforePreparation:r.damageBeforePreparation,damageAfterPreparation:r.damageAfterPreparation,position:{x:Math.round(e.x),y:Math.round(e.y)}};
      r.coordinationInterruptedByPlayer++;r.events.push(event);attack.coordinationInterruptedByPlayer=true;
    }
    if(this.encounter?.threatPriority){if(interrupted)this.encounter.threatPriority.syncInterrupted++;else this.encounter.threatPriority.syncCompletions++;if(playerInterrupted)this.encounter.threatPriority.coordinationInterruptedByPlayer++;}
  }
  resonatorDeath(e,meta={}){
    const r=this.resonatorRecord(e);if(!r||r.deathAt!==null)return;
    r.deathAt=this.time;r.lifetimeSeconds=Math.max(0,this.time-r.spawnedAt);r.killedBy=meta.weaponId||'unknown';r.killedBeforeFirstSpecialShot=r.shotsFired===0;
  }
  resonatorDamage(meta,damage){
    if(meta?.sourceKind!=='spitter'||meta?.attackType!=='resonant'||!(damage>0))return;
    const record=this.data.resonators.find(r=>r.id===meta.coordinatorId);if(record)record.coordinatedDamageToPlayer+=damage;
  }
  resonatorDashUse(){
    const p=this.g.player;if(p.dashT<=0)return;
    for(const e of this.g.enemies){if(!e.isResonator||!e.activeSync)continue;const r=this.resonatorRecord(e),attack=r?.attacks.find(a=>a.syncId===e.activeSync.id);if(!attack)continue;
      attack.dashUses++;attack.dashEvents.push({at:this.time,player:{x:Math.round(p.x),y:Math.round(p.y)}});r.dashUsesDuringThreat++;
    }
  }
  spitterDamage(meta,damage){
    if(meta?.sourceKind!=='spitter'||!(damage>0)||!this.encounter?.threatPriority)return;
    if(meta.attackType==='resonant')this.encounter.threatPriority.coordinatedDamageToPlayer+=damage;
    else this.encounter.threatPriority.ordinarySpitterDamageToPlayer+=damage;
  }
  huntTarget(e,activeCount=1){
    const h=this.encounter?.hunt;if(!h)return;
    const p=this.g.player,dx=e.x-p.x,dy=e.y-p.y,distance=Math.hypot(dx,dy),id=h.targets.length+1;
    e.huntTargetTelemetryId=id;h.targets.push({id,kind:e.kind,markedAt:this.time,dx:Math.round(dx/10)*10,dy:Math.round(dy/10)*10,distance:Math.round(distance),quadrant:(dx<0?'W':'E')+(dy<0?'N':'S'),killedAt:null,killedBy:null,lifetimeSeconds:null});
    h.markedAliveMax=Math.max(h.markedAliveMax,activeCount);
  }
  huntKill(e,meta={}){
    const h=this.encounter?.hunt;if(!h)return;
    if(e.marked){
      const target=h.targets.find(t=>t.id===e.huntTargetTelemetryId);
      if(target){target.killedAt=this.time;target.killedBy=meta.weaponId||'unknown';target.lifetimeSeconds=Math.max(0,this.time-target.markedAt);}
    }else if(this.g.objective?.progress<this.g.objective?.goal)h.offTargetKills++;
  }
  huntGoalComplete(){const h=this.encounter?.hunt;if(h&&h.objectiveCompletedAt===null)h.objectiveCompletedAt=Math.max(0,this.time-this.encounter.startedAt);}
 sample(event){const p=this.g.player,row={at:+this.time.toFixed(3),hp:+p.hp.toFixed(3),maxHp:p.maxHp,event};const r=this.encounter?.risk;if(r){if(r.samples.length<512)r.samples.push(row);else r.sampleOverflow++;}}
 damage(raw,multiplier,lost,meta){
  const first=this.data.risk,second=this.encounter?.risk,threshold=(this.g.player.hp-lost)/this.g.player.maxHp<.3;
  for(let i=0;i<2;i++){const r=i?second:first;if(!r)continue;r.acceptedHits++;r.rawDamage+=raw;r.afterArmorDamage+=raw*multiplier;r.preventedByArmor+=raw*(1-multiplier);r.hpLost+=lost;if(threshold&&!r.inDanger){r.dangerEpisodes++;r.inDanger=true;}}
  const p=this.g.player;
  if(!this.recovery)this.recovery={startedAt:this.time,targetRatio:p.hp/p.maxHp,hits:0};
  this.recovery.targetRatio=Math.max(this.recovery.targetRatio,p.hp/p.maxHp);this.recovery.hits++;
  this.resonatorDamage(meta,lost);this.spitterDamage(meta,lost);
  const boss=this.boss(meta.bossId);if(boss){boss.damageToPlayer+=lost;const attack=meta.attackType||'unknown';boss.damageToPlayerByAttack[attack]=(boss.damageToPlayerByAttack[attack]||0)+lost;boss.playerHitsByAttack[attack]=(boss.playerHitsByAttack[attack]||0)+1;}
 }
 healing(source,requested,applied,budgetDenied=0){
  const first=this.data.risk,second=this.encounter?.risk,waste=Math.max(0,requested-applied);
  for(let i=0;i<2;i++){const r=i?second:first;if(!r)continue;const h=r.healing[source]||(r.healing[source]={requested:0,restored:0,wastedMaxHp:0,deniedBudget:0});h.requested+=requested;h.restored+=applied;h.wastedMaxHp+=waste;h.deniedBudget+=budgetDenied;}
  if(source==='vampirism'&&this.encounter)this.encounter.vampirismSpent+=applied;
  if(applied>0){if(source!=='regeneration')this.sample('heal:'+source);if(this.recovery&&this.g.player.hp/this.g.player.maxHp>=this.recovery.targetRatio-1e-8)this.closeRecovery('recovered');}
 }
 closeRecovery(reason){if(!this.recovery)return;const row={...this.recovery,endedAt:this.time,seconds:this.time-this.recovery.startedAt,recovered:reason==='recovered',reason},first=this.data.risk,second=this.encounter?.risk;if(first.recoveries.length<256)first.recoveries.push(row);if(second&&second.recoveries.length<256)second.recoveries.push(row);this.recovery=null;}
 update(dt){
  this.time+=dt;const p=this.g.player,ratio=p.hp/p.maxHp;
  const first=this.data.risk,second=this.encounter?.risk;
  for(let i=0;i<2;i++){const r=i?second:first;if(!r)continue;r.seconds+=dt;if(ratio>=1-1e-8)r.fullSeconds+=dt;if(ratio<.75)r.below75Seconds+=dt;if(ratio<.5)r.below50Seconds+=dt;if(ratio<.3)r.below30Seconds+=dt;if(ratio<.3&&!r.inDanger){r.dangerEpisodes++;r.inDanger=true;}if(ratio>=.5)r.inDanger=false;}
  if(this.recovery&&ratio>=this.recovery.targetRatio-1e-8)this.closeRecovery('recovered');
  if(this.time>=this.nextSample){this.sample('second');this.nextSample=this.time+1;}
 }
 endWave(reason){this.sample(reason);this.closeRecovery(reason);if(this.encounter){this.encounter.endedAt=this.time;this.encounter.durationSeconds=Math.max(0,this.time-this.encounter.startedAt);this.encounter.completed=reason==='cleared';if(this.encounter.threatPriority)this.encounter.threatPriority.completion={reason,seconds:this.encounter.durationSeconds};}this.encounter=null;}
 boss(id){return id?this.data.bosses.find(b=>b.id===id):null;}
 spawnBoss(e){
  e.bossTelemetryId='maw-'+(this.data.bosses.length+1);
  this.data.bosses.push({id:e.bossTelemetryId,wave:this.g.wave,final:!!e.finalBoss,hp:e.maxHp,spawnAt:this.time,deathAt:null,lifetimeSeconds:null,damageableSeconds:0,interactionSeconds:0,bodyDamage:0,damageByWeapon:{},damageByHand:{left:0,right:0,other:0},damageByWeaponAndHand:{},damageByType:{},mutationDamage:{},attacks:{},suppressedAttacks:{},completedAttacks:0,phaseTransitions:[],damageToPlayer:0,damageToPlayerByAttack:{},playerHitsByAttack:{},counterattackDamage:0,sectorAttempts:0,sectorHits:0,sectorDodges:0,shotsByWeapon:{},dashUses:0,initialWeapons:this.g.player.hands.map(w=>w?.id||null)});
  const b=this.data.bosses.at(-1);if(e.glandsEnabled)b.glands=Object.fromEntries(['left','right'].map(side=>[side,{damage:0,damageByWeapon:{},disableCount:0,disabledSeconds:0,disableEvents:[]} ]));
 }
 bossTick(e,dt){const b=this.boss(e.bossTelemetryId);if(!b)return;b.damageableSeconds+=dt;const p=this.g.player;if(dist(e.x,e.y,p.x,p.y)<850&&!LEVEL.obstacles.some(o=>segmentCircleTime(e.x,e.y,p.x-e.x,p.y-e.y,o.x,o.y,o.r)!==null))b.interactionSeconds+=dt;}
 bossDamage(e,actual,meta,relayExtra){const b=this.boss(e.bossTelemetryId);if(!b)return;const add=(map,key,n)=>map[key]=(map[key]||0)+n,weapon=meta.weaponId||'other',hand=meta.hand===0?'left':meta.hand===1?'right':'other';b.bodyDamage+=actual;add(b.damageByWeapon,weapon,actual);add(b.damageByHand,hand,actual);add(b.damageByWeaponAndHand,weapon+':'+hand,actual);add(b.damageByType,meta.damageType==='explosive'?'explosive':'direct',actual);if(e.recoverT>0)b.counterattackDamage+=actual;if(relayExtra>0)add(b.mutationDamage,'relay',relayExtra);if(meta.effect==='echo')add(b.mutationDamage,'echo',actual);}
 glandDamage(e,side,actual,meta){const b=this.boss(e.bossTelemetryId),g=b?.glands?.[side];if(!g)return;g.damage+=actual;const key=meta.weaponId||'other';g.damageByWeapon[key]=(g.damageByWeapon[key]||0)+actual;}
 glandDisabled(e,side,duration){const b=this.boss(e.bossTelemetryId),g=b?.glands?.[side];if(!g)return;g.disableCount++;g.currentDisabledStartedAt=this.time;g.currentDisabledDuration=duration;if(g.disableEvents.length<128)g.disableEvents.push({at:+this.time.toFixed(3),duration});}
 glandRecovered(e,side,duration){const b=this.boss(e.bossTelemetryId),g=b?.glands?.[side];if(g){g.disabledSeconds+=duration;g.currentDisabledStartedAt=null;g.currentDisabledDuration=null;}}
 attackSuppressed(e,kind){const b=this.boss(e.bossTelemetryId);if(b)b.suppressedAttacks[kind]=(b.suppressedAttacks[kind]||0)+1;}
 sectorAttempt(e,hit,dodged){const b=this.boss(e.bossTelemetryId);if(!b)return;b.sectorAttempts++;if(hit)b.sectorHits++;if(dodged)b.sectorDodges++;}
 bossDeath(e){const b=this.boss(e.bossTelemetryId);if(b&&b.deathAt===null){b.deathAt=this.time;b.lifetimeSeconds=b.deathAt-b.spawnAt;for(const gland of Object.values(b.glands||{}))if(Number.isFinite(gland.currentDisabledStartedAt)){gland.disabledSeconds+=Math.min(gland.currentDisabledDuration||0,Math.max(0,b.deathAt-gland.currentDisabledStartedAt));gland.currentDisabledStartedAt=null;gland.currentDisabledDuration=null;}}}
 attack(e,kind){const b=this.boss(e.bossTelemetryId);if(b){b.attacks[kind]=(b.attacks[kind]||0)+1;b.completedAttacks++;}}
 phase(e){const b=this.boss(e.bossTelemetryId);if(b)b.phaseTransitions.push({at:this.time,hp:e.hp});}
 snapshot(){
  const copy=JSON.parse(JSON.stringify(this.data)),summarize=r=>{r.fractions=Object.fromEntries(['full','below75','below50','below30'].map(k=>[k,r.seconds?r[k+'Seconds']/r.seconds:0]));};
  summarize(copy.risk);for(const e of copy.encounters)summarize(e.risk);
  for(const b of copy.bosses){if(b.deathAt===null)b.observedAliveSeconds=this.time-b.spawnAt;for(const gland of Object.values(b.glands||{}))if(Number.isFinite(gland.currentDisabledStartedAt))gland.disabledSeconds+=Math.min(gland.currentDisabledDuration||0,Math.max(0,this.time-gland.currentDisabledStartedAt));}
  copy.openRecovery=this.recovery?{...this.recovery,seconds:this.time-this.recovery.startedAt,censored:true}:null;
  return copy;
 }
}

const FINAL_WAVE = 10;
function createEcologyStats(){return {version:1,playSeconds:0,offered:{},acquired:{},sources:{},events:[],eventLimit:512,truncatedEvents:0,oneEmptySeconds:0,emptyHandSeconds:0,dualLoadedSeconds:0,dualHeldSeconds:0,fusionEmptySeconds:0,dryEpisodes:0,longestDrySeconds:0,shotsByHand:[0,0],nominalSpent:0,replacementResourceLost:0,groundSamples:0,groundSum:0,groundMax:0,nearbySum:0,dryWithNearbySeconds:0};}
function createCombatStats(){return {population:{aliveSum:0,samples:0,maxAlive:0,activeEnemyBulletsMax:0,visibleEnemyBulletsSum:0,maxVisibleEnemyBullets:0},enemyShots:{},playerHits:{},damageTakenBySource:{},deathsBySource:{},healing:{healthCreated:0,healthCollected:0,restored:0,wastedOnFull:0,fullHealthTouches:0,expired:0,wastedAtExpiry:0,bySource:{}},lowHealthSeconds:0,dashUses:0,dashNearThreat:0,pressureSeconds:0,breatherSeconds:0,spawnGroups:0,reinforcementBatches:0,spawnedEnemies:0,weaponDrops:0,weaponPickups:0};}
function createArenaTelemetry(plan){
  const nests=(plan.nests||[]).map(n=>({id:n.id,label:n.label,role:n.role,kind:n.role,hp:n.hp,damage:0,damageByWeapon:{},destroyedAt:null,activations:0,reinforcementsSpawned:0,stoppedReinforcements:0,remainingBudget:n.budget,activationEvents:[]}));
  return {movementSeconds:0,stationarySeconds:0,distance:0,directionChanges:0,coverBlocks:0,coverBySource:{},coverEvents:[],killsByKind:{},killEvents:[],mission:{kind:plan.kind,completionReason:null,objectiveCompletedAt:null,timeAfterObjectiveSeconds:null,nestDamage:0,destroyedOrder:[],stoppedReinforcements:0,nests}};
}

// Compact hot entity lists in place. Array.filter() allocated a new array and
// callback on every 60 Hz simulation tick even when nothing had died.
function compactLive(items){
  let write=0;
  for(let read=0;read<items.length;read++)if(!items[read].dead)items[write++]=items[read];
  items.length=write;
}
function compactActiveWarnings(items){
  let write=0;
  for(let read=0;read<items.length;read++)if(items[read].t>0)items[write++]=items[read];
  items.length=write;
}
function compactResonatorBreaks(items,now){
  let write=0;
  for(let read=0;read<items.length;read++)if(now-items[read].at<items[read].duration)items[write++]=items[read];
  items.length=write;
}
function countLiveEnemies(items){
  let count=0;
  for(let i=0;i<items.length;i++)if(!items[i].dead)count++;
  return count;
}
function countMarkedEnemies(items,liveOnly){
  let count=0;
  for(let i=0;i<items.length;i++)if(items[i].marked&&(!liveOnly||!items[i].dead))count++;
  return count;
}
function addPopulationSample(target,alive,visibleBullets,enemyBulletCount){
  const p=target.population;
  p.aliveSum+=alive;p.samples++;p.maxAlive=Math.max(p.maxAlive,alive);
  p.activeEnemyBulletsMax=Math.max(p.activeEnemyBulletsMax,enemyBulletCount);
  p.visibleEnemyBulletsSum+=visibleBullets;
  p.maxVisibleEnemyBullets=Math.max(p.maxVisibleEnemyBullets,visibleBullets);
}
// Cache each projectile color's halo once. The original draw loop asked Canvas
// to blur every bullet on every frame; these 128x96 stamps retain that look at
// base size 10 and stay below 768 KiB even with the 16-color LRU cap.
const PROJECTILE_GLOW_CACHE=new Map();
const PROJECTILE_GLOW_CACHE_LIMIT=16;
function projectileGlowSprite(color){
  const key=String(color||'#d9eddb');
  let sprite=PROJECTILE_GLOW_CACHE.get(key);
  if(sprite){PROJECTILE_GLOW_CACHE.delete(key);PROJECTILE_GLOW_CACHE.set(key,sprite);return sprite;}
  let surface;
  try{
    surface=typeof OffscreenCanvas==='function'?new OffscreenCanvas(128,96):typeof document!=='undefined'&&typeof document.createElement==='function'?document.createElement('canvas'):null;
    if(!surface)return null;
    surface.width=128;surface.height=96;
    const ink=surface.getContext('2d');if(!ink||typeof ink.ellipse!=='function')return null;
    ink.shadowColor=key;ink.shadowBlur=8;ink.fillStyle=key;ink.beginPath();ink.ellipse(64,48,18,10,0,0,TAU);ink.fill();
  }catch(_){return null;}
  if(PROJECTILE_GLOW_CACHE.size>=PROJECTILE_GLOW_CACHE_LIMIT)PROJECTILE_GLOW_CACHE.delete(PROJECTILE_GLOW_CACHE.keys().next().value);
  PROJECTILE_GLOW_CACHE.set(key,surface);
  return surface;
}
function drawProjectileBody(ctx,b){
  const glow=projectileGlowSprite(b.color);
  if(glow){const scale=b.size/10;ctx.drawImage(glow,-64*scale,-48*scale,128*scale,96*scale);return true;}
  ctx.fillStyle=b.color;ctx.shadowBlur=8;ctx.shadowColor=b.color;ctx.beginPath();ctx.ellipse(0,0,b.size*1.8,b.size,0,0,TAU);ctx.fill();return false;
}
const UPGRADES = [
  { name: 'Толстая гниль', desc: '+25 к максимуму здоровья', apply: (g) => { g.player.maxHp += 25; g.player.hp = Math.min(g.player.maxHp, g.player.hp + 25); } },
  { name: 'Проворные руки', desc: '+12% к скорости бега', apply: (g) => { g.player.speedMul *= 1.12; } },
  { name: 'Быстрые пальцы', desc: '+12% к скорострельности', apply: (g) => { g.player.fireRateMul *= 1.12; } },
  { name: 'Острые кости', desc: '+15% к урону оружия', apply: (g) => { g.player.dmgMul *= 1.15; } },
  { name: 'Вампирский голод', desc: 'убийство восстанавливает 3 HP', apply: (g) => { g.player.lifeOnKill += 3; } },
  { name: 'Гнилая регенерация', desc: '+0.8 HP в секунду', apply: (g) => { g.player.regen += 0.8; } },
  { name: 'Лёгкий рывок', desc: '-35% к откату рывка', apply: (g) => { g.player.dashCooldown = Math.max(0.4, g.player.dashCooldown * 0.65); } },
  { name: 'Гильдия охотников', desc: '+50% патронов в оружии', apply: (g) => { for (const h of g.player.hands) if (h) { h.ammo = Math.round(h.cap * 1.5); h.cap = Math.round(h.cap * 1.5); } } },
  { name: 'Второе сердце', desc: 'полное лечение и +10 HP', apply: (g) => { g.player.maxHp += 10; g.player.hp = g.player.maxHp; } },
  { name: 'Толстый череп', desc: '-20% получаемого урона', apply: (g) => { g.player.dmgTakenMul = (g.player.dmgTakenMul || 1) * (g.balanceConfig?.sustain?.armorMultiplier??0.8); } },
  { name: 'Глубокие карманы', desc: '+15% патронов в новом оружии', apply: (g) => { g.player.ammoBonus = (g.player.ammoBonus || 0) + 1; } },
];

// Stage 2M only: estimate simultaneous sustained fire from actual weapon rates.
// This is an economy decision, not ammunition, cooldown or pickup simulation.
function stage2mSupplyState(g,rules) {
  const player=g.player,hands=player.hands,mul=player.fireRateMul??1;
  const handSeconds=hands.map(w=>w&&w.ammo>0?w.ammo/Math.max(.0001,w.def.rate*mul):0);
  const secondsLeft=Math.max(handSeconds[0],handSeconds[1]),dry=secondsLeft===0;
  // A spent weapon is discarded before the hand's magnet check in updateHands.
  const hasFreeHand=hands.some(w=>!w||w.ammo<=0),pickupRadius=hasFreeHand?rules.nearbyRadius:115;
  let availableNearby=0,digBlocked=false;
  for(const item of g.pickups){
    if(item.dead||item.type!=='weapon'||item.ammo<=0)continue;
    const dx=item.x-player.x,dy=item.y-player.y,d2=dx*dx+dy*dy;
    // Match updateDigging: even a temporarily locked, non-avoided organ blocks digging.
    if(!item.avoidMagnet&&d2<260*260)digBlocked=true;
    if(item.lock>0||d2>=pickupRadius*pickupRadius||(item.avoidMagnet&&d2>=115*115))continue;
    let blocked=false;
    for(const ob of LEVEL.obstacles){
      const t=clamp(((ob.x-player.x)*dx+(ob.y-player.y)*dy)/(d2||1),0,1);
      const ox=player.x+t*dx-ob.x,oy=player.y+t*dy-ob.y,r=ob.r+player.r;
      if(ox*ox+oy*oy<r*r){blocked=true;break;}
    }
    if(!blocked)availableNearby++;
  }
  const canDig=dry&&!digBlocked;
  const requiredMisses=dry?(canDig?rules.missesDryDigAvailable:rules.missesDryNoDig):rules.missesLow;
  return {handSeconds,secondsLeft,dry,availableNearby,canDig,digBlocked,requiredMisses,misses:g.killsWithoutWeaponDrop,
    shortage:secondsLeft<=rules.lowSeconds&&availableNearby===0};
}

class Game {
  constructor(canvas, input, sfx, seed) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sfx = sfx;
    this.seed = (Number.isFinite(Number(seed)) ? Number(seed) : Date.now()) >>> 0 || 1;
    const requestedBalance=typeof window!=='undefined'&&window.location?new URLSearchParams(window.location.search).get('balance'):null;
    const defaultBalance=typeof window!=='undefined'&&window.DEADWEED_PLAYTEST?'pressure':'pressure-supply';
    this.balanceConfigId=Object.hasOwn(BALANCE_CONFIGS,requestedBalance)?requestedBalance:defaultBalance;
    this.particles = new Particles();
    this.cam = { x: 0, y: 0 };
    this.state = 'splash';
    this.menuSelection=0;this.settingsSelection=0;
    this.preferences={shake:true,tips:true};
    try {const saved=JSON.parse(localStorage.getItem('deadweed-settings')||'{}');for(const key of ['shake','tips'])if(typeof saved[key]==='boolean')this.preferences[key]=saved[key];} catch(_) {}
    this.time = 0;
    this.dpr = 1;
    this.vw = 960;      // размер вьюпорта в CSS-пикселях (обновляется ресайзом)
    this.vh = 600;
    this.zoom = 1.25;
    this.view = { x0: 0, y0: 0, x1: 0, y1: 0 };
    this._ecologyGenes=new Set();
    this._ecologyFiring=new Set();
    this.reset();
  }

  reset() {
    setRandomSeed(this.seed);
    this.experimentDisplay=null;
    LEVEL = new Level(2200, 1600, this.seed);
    if(this.biology)this.biology.dispose();
    this.biology=new BiologyFX(LEVEL.w,LEVEL.h);
    this.particles.list.length=0;this.particles.shake=0;this.particles.shakeX=0;this.particles.shakeY=0;
    this.player = new Player(LEVEL.w / 2, LEVEL.h / 2);
    this.player.hands[0] = new Weapon('spitter');
    this.player.hands[1] = new Weapon('bone');
    this.enemies = [];
    this.pickups = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnGroupCount=0;this.reinforcementBudget=0;this.reinforcementKinds=[];this.reinforcementCursor=0;
    this.nests=[];this.missionCompletePending=false;this.arenaMotionSample={x:this.player.x,y:this.player.y,direction:{x:0,y:0},lastDirection:null,lastMoveAt:-Infinity};
    this.wave = 0;
    this.outcome = null;
    this.reportSaved = false;
    this.finalReport=null;this.completedAt=null;this.previousBest=null;this.reportStorageError=false;
    this.endReason = null;
    this.runId = String(this.seed) + '-' + Date.now();
    this.effects = []; this.spawnWarnings = [];
    this.resonatorBreaks=[];
    this.combo = 0; this.comboT = 0; this.bestCombo = 0;
    this.tip = ''; this.tipT = 0;
    this.objective = null;this.digSite=null;this.killsWithoutWeaponDrop=0;
    this.recoveryFeedbackT=0;this.recoveryFeedbackX=0;this.recoveryFeedbackY=0;this.recoveryLabScene=null;
    this.recoveryAutoActive=false;this.recoveryAutoReason=null;this.recoveryAutoLastX=null;this.recoveryAutoLastY=null;this.recoveryAutoMode=null;
    this.score = 0;
    this.balanceConfig=this.playtestBalanceConfiguration||getBalanceConfig(this.balanceConfigId);
    this.player.sustainRules=this.balanceConfig.sustain||null;this.player.vampirismBudget=0;
    this.threat=new ThreatTelemetry(this);
    this.runStats = { shotsFired: 0, damageDealt: 0, damageTaken: 0, kills: 0, farthestWave: 0, weaponPickups: 0, healthPickups: 0, weaponShots: {}, weaponPerformance: {}, fusions: [], economy:{drySeconds:0,digs:0,digSeconds:0,weaponDrops:0}, combat:createCombatStats(), losses: [], waveHistory: [] };
    this.runStats.ecology=createEcologyStats();this.organSerial=0;this.ecologyState={sample:0,dry:false,dryRun:0};
    this.runStats.builds=createBuildStats();this.shotSerial=0;
    for(let i=0;i<2;i++){this.player.hands[i].origin={type:'initial',slot:i};this.player.hands[i].organId=++this.organSerial;}
    this.currentWaveStats = null;
    this.banner = '';
    this.bannerSub = '';
    this.bannerT = 0;
    this.cards = [];
    this.hoverCard = -1;
    this.upgradeInputArmed = false;
    this.waveActive = false;

    // стартовое оружие рядом
    this.pickups.push(new Pickup(LEVEL.w / 2 + 120, LEVEL.h / 2 + 60, 'weapon', 'spitter', 30));
    this.pickups.push(new Pickup(LEVEL.w / 2 - 140, LEVEL.h / 2 + 90, 'weapon', 'seedshot', 10));
    this.pickups.push(new Pickup(LEVEL.w / 2 + 40, LEVEL.h / 2 + 190, 'health'));
    this.recordHealthCreated();
    for(const p of this.pickups)if(p.type==='weapon')this.offerOrgan(p,{type:'initial'});

    this.updateCamera(1, true);
  }

  // ---------------- состояния ----------------
  openSettings() {this.settingsReturn=this.state;this.settingsSelection=0;this.state='settings';this.sfx.ui('confirm');}

  updateSettings() {
    const input=this.input,rows=getSettingsLayout(this.vw,this.vh),mouse=input.mouse;
    const backButton=getBackButton(this.vw,this.vh),backClick=input.mouseJust.down&&uiContains(backButton,mouse);
    if(input.actionHit('back')||backClick) {this.state=this.settingsReturn||'menu';this.dragSetting=null;this.sfx.ui('cancel');return;}
    if(input.actionHit('menuUp'))this.settingsSelection=(this.settingsSelection+5)%6;
    if(input.actionHit('menuDown'))this.settingsSelection=(this.settingsSelection+1)%6;
    const clicked=input.mouseJust.down?rows.findIndex(r=>uiContains(r,mouse)):-1;
    if(clicked>=0)this.settingsSelection=clicked;
    const i=this.settingsSelection,r=rows[i];
    const direction=input.hit('ArrowLeft')||input.padEdges.has('dropLeft')?-1:input.hit('ArrowRight')||input.padEdges.has('dropRight')?1:0;
    const activate=clicked>=0 || input.actionHit('confirm');
    if(clicked>=0 && clicked<2){const slider=getSettingsSlider(rows[clicked],this.ctx);if(mouse.x>=slider.x-12&&mouse.x<=slider.x+slider.w+12)this.dragSetting=clicked;}
    if(!mouse.down)this.dragSetting=null;
    const dragging=this.dragSetting!==null && this.dragSetting!==undefined;
    const selectedSlider=i<2?getSettingsSlider(r,this.ctx):null;
    if((i<2 && direction) || (clicked>=0 && i<2 && selectedSlider&&mouse.x>=selectedSlider.x-12&&mouse.x<=selectedSlider.x+selectedSlider.w+12) || dragging) {
      const index=dragging?this.dragSetting:i,slider=rows[index];
      const track=getSettingsSlider(slider,this.ctx);
      const current=index===0?this.sfx.volume:(this.music?this.music.volume:.35);
      const value=clicked>=0||dragging?clamp((mouse.x-track.x)/track.w,0,1):current+direction*.05;
      if(index===0)this.sfx.setVolume(value);else if(this.music)this.music.setVolume(value);
    } else if((i===2||i===3) && (activate||direction)) {
      const key=i===2?'shake':'tips';this.preferences[key]=!this.preferences[key];
      this.sfx.ui(this.preferences[key]?'toggleOn':'toggleOff');
      try{localStorage.setItem('deadweed-settings',JSON.stringify(this.preferences));}catch(_){}
    } else if(activate && i===4) {
      this.controlsReturn='settings';this.input.controlsOpen=true;this.state='paused';
    } else if(activate && i===5) {
      this.sfx.setVolume(1);if(this.music)this.music.setVolume(.35);this.preferences={shake:true,tips:true};this.input.resetBindings();
      try{localStorage.removeItem('deadweed-settings');}catch(_){}
    }
  }

  updateFrontMenu() {
    const input=this.input,paused=this.state==='paused',buttons=getFrontButtons(this.vw,this.vh,paused,typeof this.startLevel01==='function',this.level01Preset);
    const priorSelection=this.menuSelection;
    if(input.mouse.moved){const hover=buttons.findIndex(r=>uiContains(r,input.mouse));if(hover>=0)this.menuSelection=hover;}
    if(input.actionHit('menuUp'))this.menuSelection=(this.menuSelection+buttons.length-1)%buttons.length;
    if(input.actionHit('menuDown'))this.menuSelection=(this.menuSelection+1)%buttons.length;
    this.menuSelection=clamp(this.menuSelection,0,buttons.length-1);
    if(this.menuSelection!==priorSelection)this.sfx.ui('hover');
    if(paused && (input.actionHit('back')||input.actionHit('pause'))) {this.state=this.returnState||'playing';this.menuSelection=0;this.sfx.ui('cancel');return;}
    if(input.hit('KeyC')){this.openSettings();return;}
    if(input.hit('KeyM')){this.sfx.setVolume(this.sfx.volume>0?0:1);return;}
    const clicked=input.mouseJust.down?buttons.findIndex(r=>uiContains(r,input.mouse)):-1;
    if(clicked<0 && !input.actionHit('confirm') && !input.hit('Space') && !(paused&&(input.hit('End')||input.padEdges.has('collectRight'))))return;
    const id=paused&&(input.hit('End')||input.padEdges.has('collectRight'))?'finish':buttons[clicked>=0?clicked:this.menuSelection].id;
    if(id!=='settings')this.sfx.ui(id==='resume'?'cancel':'confirm');
    if(id==='start')this.startGame();
    else if(id==='level01')this.startLevel01();
    else if(id==='level01Preset')this.setLevel01Preset(this.level01Preset==='near-wasd'?'baseline':'near-wasd');
    else if(id==='resume')this.state=this.returnState||'playing';
    else if(id==='settings')this.openSettings();
    else if(id==='about'){this.aboutReturn=this.state;this.aboutScroll=0;this.state='about';}
    else if(id==='finish'){this.outcome='abandoned';this.endReason='Завершён игроком';this.waveActive=false;this.finishWaveStats(false);this.state='gameover';this.saveBalanceReport();}
  }

  selectPlaytestBalance(id) {
    if(this.balanceProfileLocked||!['splash','menu'].includes(this.state))throw Error('Balance profile is locked for this run');
    if(!Object.hasOwn(BALANCE_CONFIGS,id))throw Error('Unknown balance profile: '+id);
    this.balanceConfigId=id;this.balanceConfig=getBalanceConfig(id);
    return balanceManifest(id,this.balanceConfig);
  }

  lockPlaytestBalance() {
    if(this.balanceProfileLocked)return;
    const id=this.balanceConfigId;
    const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
    const configuration=freeze(JSON.parse(JSON.stringify(this.balanceConfig)));
    Object.defineProperties(this,{
      balanceConfigId:{get:()=>id,set:value=>{if(value!==id)throw Error('Balance profile is locked for this run');},configurable:false},
      balanceConfig:{get:()=>configuration,set:value=>{if(value!==configuration)throw Error('Balance profile is locked for this run');},configurable:false},
      playtestBalanceConfiguration:{value:configuration,writable:false,configurable:false},
    });
    this.balanceProfileLocked=true;
  }

  startGame() {
    this.state = 'playing';
    this.sfx.ensure();
    this.startWave(1);
  }

  startWave(n) {
    this.wave = n;
    this.balanceConfig=this.playtestBalanceConfiguration||getBalanceConfig(this.balanceConfigId);
    this.encounter = this.balanceConfig.encounters[n - 1];
    const plan = this.encounter;
    this.runStats.farthestWave = Math.max(this.runStats.farthestWave, n);
    this.currentWaveStats = {wave:n, completed:false, seconds:0, combatSeconds:0, cleanupSeconds:0, idleSeconds:0, objectiveQuietSeconds:0, holdElapsedSeconds:0, holdProgressSeconds:0, holdOutsideSeconds:0, objectiveCompletionAt:null, postObjectiveSeconds:0, shots:0, damageDealt:0, damageTaken:0, kills:0, weaponPickups:0, healthPickups:0, weaponShots:{},combat:createCombatStats(),...(plan.stage2gScene?{arena:createArenaTelemetry(plan)}:{})};
    this.banner = 'ВОЛНА ' + n + ': ' + plan.name.toUpperCase();
    this.bannerSub = plan.tip; this.bannerT = 2.4;
    this.tip = plan.tip; this.tipT = 7;
    this.objective = {kind:plan.kind, progress:0, goal:plan.goal || 3, x:this.player.x, y:this.player.y, originX:this.player.x, originY:this.player.y, radius:plan.kind === 'survive' ? 175 : 135};
    this.nests=(plan.nests||[]).map(config=>{
      const telemetry=this.currentWaveStats.arena.mission.nests.find(n=>n.id===config.id);
      return {...config,hp:config.hp,maxHp:config.hp,remainingBudget:config.budget,activationIndex:0,nextActivationAt:config.interval,dead:false,hitFlash:0,lastActivatedAt:null,telemetry};
    });
    this.missionCompletePending=false;this.arenaMotionSample={x:this.player.x,y:this.player.y,direction:{x:0,y:0},lastDirection:null,lastMoveAt:-Infinity};
    this.player.regenBudget = 16;
    this.player.sustainRules=this.balanceConfig.sustain||null;
    this.player.vampirismBudget=vampirismCapacity(this.player);
    this.threat.startWave(n);
    this.spawnQueue = expandEncounterComposition(plan);
    this.reinforcementKinds=this.spawnQueue.filter(kind=>kind!=='maw');
    this.reinforcementCursor=0;
    this.reinforcementBudget=plan.reinforcementBudget||0;
    if (plan.boss && !plan.composition) this.spawnQueue.push('maw');
    this.spawnTimer = 0.5; this.spawnGroupCount=0; this.spawnKillsSinceGroup=0; this.waveActive = true; this.hoverCard = 0;
    this.sfx.wave();
  }

  waveCleared() {
    if (this.outcome || !this.player.alive) return;
    this.finishWaveStats(true);
    this.waveActive = false;
    this.missionCompletePending=false;
    this.enemies = []; this.enemyBullets = []; this.bullets = [];
    this.spawnQueue = []; this.spawnWarnings = []; this.effects = [];
    const last = this.runStats.waveHistory[this.runStats.waveHistory.length - 1];
    if (this.encounter.limit && last.seconds <= this.encounter.limit) { this.score += 250; const before=this.player.hp;this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8);this.recordHealing('contract',8,this.player.hp-before); last.contract = true; }

    if (this.wave >= FINAL_WAVE) {
      this.outcome = 'victory';
      this.state = 'victory';
      this.banner = 'БОЛОТО ЗАТИХЛО';
      this.bannerSub = 'ЦАРЬ-ПАСТЬ ПОВЕРЖЕН';
      this.bannerT = 3.5;
      this.saveBalanceReport();
      this.sfx.victory();
      return;
    }

    this.banner = 'ЗАЧИЩЕНО';
    this.bannerSub = 'ВЫБЕРИ УЛУЧШЕНИЕ';
    this.bannerT = 2.0;
    this.cards = offerCards(this.player,this.cardOfferMode||'uniform');
    const builds=this.runStats.builds;builds.algorithm=this.cardOfferMode||'uniform';
    const choice={wave:this.wave,at:this.runStats.ecology.playSeconds,offered:this.cards.map(cardKey),chosen:null,mutations:Object.keys(this.player.mods).filter(k=>this.player.mods[k])};
    if(builds.choices.length===32)builds.choices.shift();builds.choices.push(choice);
    for(const c of this.cards)builds.offered[cardKey(c)]=(builds.offered[cardKey(c)]||0)+1;
    this.state = 'upgrade';
    this.hoverCard = 0;
    this.upgradeInputArmed = false;
  }

  chooseUpgrade(i) {
    if (this.state !== 'upgrade' || !this.cards[i]) return;
    const resource=()=>this.player.hands.reduce((n,w)=>n+(w?w.ammo*weaponChargeDamage(w.def):0),0),before=resource(),hpBeforeCard=this.player.hp;
    this.cards[i].apply(this);
    const healRequest=this.cards[i].name==='Толстая гниль'?25:this.cards[i].name==='Второе сердце'?this.player.maxHp:Math.max(0,this.player.hp-hpBeforeCard);
    this.recordHealing('cardEffect',healRequest,Math.max(0,this.player.hp-hpBeforeCard));
    const builds=this.runStats.builds,key=cardKey(this.cards[i]);builds.chosen[key]=(builds.chosen[key]||0)+1;
    const choice=builds.choices.at(-1);if(choice)choice.chosen=key;
    builds.segments.push({after:key,seconds:0,dualLoadedSeconds:0,dualFireSeconds:0,shotsByHand:[0,0]});if(builds.segments.length>32)builds.segments.shift();
    this.organEvent('card',{card:this.cards[i].name,nominalResourceGain:resource()-before});
    this.player.build.push(this.cards[i].name);
    const hpBeforePick=this.player.hp;this.player.hp = Math.min(this.player.maxHp, this.player.hp + 12);
    this.recordHealing('cardPick',12,this.player.hp-hpBeforePick);
    this.sfx.pickup();
    this.state = 'playing';
    this.startWave(this.wave + 1);
  }

  onPlayerDeath() {
    if (this.outcome) return;
    this.outcome = 'defeat'; this.endReason = this.lastDamageSource || 'Урон растений';
    this.recordCombatKey('deathsBySource',this.endReason);
    this.finishWaveStats(false); this.waveActive = false; this.state = 'gameover';
    this.saveBalanceReport(); this.sfx.gameover();
    this.particles.burst(this.player.x,this.player.y,24,{speed:220,life:0.8,size:5,color:'#c5ddd0'});
  }

  finishWaveStats(completed = false) {
    if (!this.currentWaveStats) return;
    const arena=this.currentWaveStats.arena;
    if(arena){
      const mission=arena.mission;
      if(!mission.completionReason)mission.completionReason=completed?(mission.kind==='roots'?'all-nests-destroyed':'encounter-cleared'):(this.outcome||'stopped');
      if(mission.objectiveCompletedAt!==null)mission.timeAfterObjectiveSeconds=Math.max(0,this.currentWaveStats.seconds-mission.objectiveCompletedAt);
    }
    this.threat.endWave(completed?'cleared':this.outcome||'stopped');
    this.currentWaveStats.completed = completed;
    this.runStats.waveHistory.push({ ...this.currentWaveStats, weaponShots: { ...this.currentWaveStats.weaponShots } });
    this.currentWaveStats = null;
  }

  createBalanceReport() {
    if(this.outcome && this.finalReport)return this.finalReport;
    if(this.outcome && !this.completedAt)this.completedAt=new Date().toISOString();
    const report={
      version: 2,
      ruleset: this.balanceConfig?.ruleset||WEAPON_RULESET,
      balanceConfig: this.balanceConfigId,
      balanceConfigVersion: this.balanceConfig.version||BALANCE_CONFIG_VERSION,
      balanceConfiguration: balanceManifest(this.balanceConfigId,this.balanceConfig),
      runId: this.runId,
      reason: this.endReason,
      build: this.player.build.slice(),
      bestCombo: this.bestCombo,
      weaponNames: Object.fromEntries(Object.values(WEAPON_DEFS).map(d=>[d.id,d.name])),
      result: this.outcome || 'unfinished',
      seed: this.seed,
      completedAt: this.completedAt || new Date().toISOString(),
      score: this.score,
      farthestWave: this.runStats.farthestWave,
      totals: {
        shotsFired: this.runStats.shotsFired,
        damageDealt: Math.round(this.runStats.damageDealt),
        damageTaken: Math.round(this.runStats.damageTaken),
        kills: this.runStats.kills,
        weaponPickups: this.runStats.weaponPickups,
        healthPickups: this.runStats.healthPickups,
        weaponShots: { ...this.runStats.weaponShots },
        weaponPerformance: JSON.parse(JSON.stringify(this.runStats.weaponPerformance)),
        losses: this.runStats.losses.slice(),
        economy: {...this.runStats.economy},
        combat: {...JSON.parse(JSON.stringify(this.runStats.combat)),weaponLeftAtSnapshot:this.pickups.filter(p=>!p.dead&&p.type==='weapon'&&p.ammo>0).length,healthLeftAtSnapshot:this.pickups.filter(p=>!p.dead&&p.type==='health').length},
        fusions: JSON.parse(JSON.stringify(this.runStats.fusions)),
        ecology: JSON.parse(JSON.stringify(this.runStats.ecology)),
        builds: {...JSON.parse(JSON.stringify(this.runStats.builds)),activeMutations:MUTATIONS.filter(c=>this.player.mods[c.id]).map(c=>c.id)},
        threat: this.threat.snapshot(),
      },
      waves: this.runStats.waveHistory.map((wave) => ({ ...wave, damageDealt: Math.round(wave.damageDealt), damageTaken: Math.round(wave.damageTaken), weaponShots: { ...wave.weaponShots },combat:JSON.parse(JSON.stringify(wave.combat||createCombatStats())) })),
    };
    if(this.outcome)this.finalReport=report;
    return report;
  }

  saveBalanceReport() {
    if (this.reportSaved) return;
    try {
      const reports = JSON.parse(localStorage.getItem('deadweed-balance-history') || '[]');
      this.previousBest = Math.max(0, Number(localStorage.getItem('deadweed-best-score'))||0, ...reports.map(r => r.score || 0));
      reports.push(this.createBalanceReport());
      localStorage.setItem('deadweed-balance-history', JSON.stringify(reports.slice(-20)));
      localStorage.setItem('deadweed-best-score',String(Math.max(this.previousBest,this.score)));
      this.reportSaved = true;
      this.reportStorageError=false;
    } catch (_) {this.reportStorageError=true;}
  }

  downloadBalanceReport() {
    const blob = new Blob([JSON.stringify(this.createBalanceReport(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deadweed-run-${this.seed}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------------- сущности ----------------
  spawnPlant(x, y, kind) {
    const e = makePlant(kind, x, y);
    const scale = this.encounter?.maxAlive ? 1 : 1 + (this.wave - 1) * 0.13;
    e.maxHp = Math.round(e.maxHp * scale);
    e.hp = e.maxHp;
    e.speed *= 1 + (this.wave - 1) * 0.03;
    if (kind === 'maw' && this.wave === FINAL_WAVE) {
      e.maxHp = Math.round(e.maxHp * 1.05);
      e.hp = e.maxHp;
      e.finalBoss = true;
      e.dmg *= 1.1;
      e.speed *= 1.08;
    }
    if(kind==='resonator'){
      if(this.balanceConfigId==='threat-priority-v2'){e.resonanceCooldown=.32;e.warningSeconds=1.15;e.coordinationRadius=400;}
      this.threat.resonatorSpawn(e);
    }
    if(kind==='maw'){
      if(this.balanceConfig.boss)e.hp=e.maxHp=e.finalBoss?this.balanceConfig.boss.finalHp:this.balanceConfig.boss.firstHp;
      e.glandsEnabled=!!(this.balanceConfig.boss?.behavior==='meaningful'&&this.bossBehaviorMode!=='stage2d');
      if(e.glandsEnabled)for(const gland of Object.values(e.glands)){gland.maxHp=this.balanceConfig.boss.glandHp||120;gland.hp=gland.maxHp;}
      this.threat.spawnBoss(e);
    }
    this.enemies.push(e);
    return e;
  }

  spawnBullet(x, y, vx, vy, dmg, color, size, opts = {}) {
    this.bullets.push({
      x, y, vx, vy, dmg, color, size,
      r: size,
      life: 1.6,
      hitTargets: new Set(),
      weaponId: opts.weaponId || null, hand: opts.hand,fusionIndex:opts.fusionIndex,shotId:opts.shotId,relayTargets:opts.relayTargets,
      slow: opts.slow || false, bounce: opts.bounce || 0, echo: opts.echo || false,
      pierce: opts.pierce || 0,
      explode: opts.explode || 0,
      explodeDmg: opts.explodeDmg || 0,
      knock: opts.knock || 60,
      rot: Math.atan2(vy, vx),
      dead: false,
    });
  }

  spawnEnemyBullet(x, y, vx, vy, dmg, color, size, attack = {}) {
    const sourceKind=attack.sourceKind||'unknown',attackType=attack.attackType||'single';
    this.enemyBullets.push({
      x, y, vx, vy, dmg, color:'#ff9b62', size, r: size,
      life: 4, rot: Math.atan2(vy, vx), dead: false,sourceKind,attackType,bossId:attack.bossId,coordinatorId:attack.coordinatorId,syncId:attack.syncId,
    });
    this.recordCombatKey('enemyShots',sourceKind+':'+attackType);
  }

  shake(v) {
    this.particles.shake = Math.min(FX_CONFIG.maxShake, Math.max(this.particles.shake, v*FX_CONFIG.shakeScale));
  }

  hurtPlayer(dmg, srcX, srcY, source) {
    const attacker=this.enemies.find(e=>dist(e.x,e.y,srcX,srcY)<2);
    const meta=source&&typeof source==='object'?source:{label:source,sourceKind:attacker?.kind||'environment',attackType:source==='Споры вне круга'?'spore':'contact'};
    this.lastDamageSource=meta.label || (attacker ? {sprout:'Укус ростка',snapper:'Прыжок хищника',maw:'Пасть босса'}[attacker.kind]:null) || 'Атака растений';
    const mul = this.player.dmgTakenMul || 1;
    const before=this.player.hp;
    if(this.player.alive&&this.player.invuln<=0&&this.player.dashT<=0)this.threat.damage(dmg,mul,Math.min(before,dmg*mul),meta);
    this.player.hurt(dmg * mul, srcX, srcY, this);
    const lost=Math.max(0,before-this.player.hp);
    if(lost>0)this.threat.sample('hit');
    if(lost>0){this.recordCombatKey('playerHits',meta.attackType||'unknown');this.recordCombatKey('damageTakenBySource',(meta.sourceKind||'unknown')+':'+(meta.attackType||'unknown'),lost);}
  }

  recordCombatKey(field,key,amount=1) {
    const run=this.runStats?.combat,wave=this.currentWaveStats?.combat;
    if(run){const map=run[field]||(run[field]={});map[key]=(map[key]||0)+amount;}
    if(wave){const map=wave[field]||(wave[field]={});map[key]=(map[key]||0)+amount;}
  }

  recordCombatValue(field,amount=1) {
    const run=this.runStats?.combat,wave=this.currentWaveStats?.combat;
    if(run)run[field]=(run[field]||0)+amount;
    if(wave)wave[field]=(wave[field]||0)+amount;
  }

  recordHealing(source,requested,applied) {
    this.threat.healing(source,requested,applied);
    const run=this.runStats?.combat,wave=this.currentWaveStats?.combat,restored=Math.max(0,applied);
    if(run){const h=run.healing;h.restored+=restored;h.bySource[source]=(h.bySource[source]||0)+restored;if(requested>applied)h.wastedOnFull+=Math.max(0,requested-applied);}
    if(wave){const h=wave.healing;h.restored+=restored;h.bySource[source]=(h.bySource[source]||0)+restored;if(requested>applied)h.wastedOnFull+=Math.max(0,requested-applied);}
  }

  recordHealthCreated() {for(const stats of [this.runStats?.combat,this.currentWaveStats?.combat])if(stats)stats.healing.healthCreated++;}

  recordHealthExpiry() {
    const potential=Math.min(28,Math.max(0,this.player.maxHp-this.player.hp));
    for(const stats of [this.runStats?.combat,this.currentWaveStats?.combat])if(stats){stats.healing.expired++;stats.healing.wastedAtExpiry+=28-potential;}
  }

  recordDash() {
    this.recordCombatValue('dashUses');
    for(const b of this.threat.data.bosses)if(b.deathAt===null)b.dashUses++;
    const nearEnemy=this.enemies.some(e=>!e.dead&&dist(e.x,e.y,this.player.x,this.player.y)<240);
    const nearBullet=this.enemyBullets.some(b=>!b.dead&&dist(b.x,b.y,this.player.x,this.player.y)<190);
    if(nearEnemy||nearBullet)this.recordCombatValue('dashNearThreat');
  }

  onPlantDeath(e,meta={}) {
    const arena=this.currentWaveStats?.arena;
    if(arena){arena.killsByKind[e.kind]=(arena.killsByKind[e.kind]||0)+1;arena.killEvents.push({at:this.currentWaveStats.seconds,kind:e.kind,weaponId:meta.weaponId||null,hand:Number.isInteger(meta.hand)?meta.hand:null,x:e.x,y:e.y});if(arena.killEvents.length>128)arena.killEvents.shift();}
    if(e.isResonator)this.threat.resonatorDeath(e,meta);
    if(this.encounter?.kind==='hunt')this.threat.huntKill(e,meta);
    this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 3;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += Math.round(e.score * (1 + Math.min(10,this.combo - 1) * 0.1));
    this.spawnKillsSinceGroup++;
    this.player.regenBudget = Math.min(20, this.player.regenBudget + 2);
    if (e.marked && this.objective) {
      this.objective.progress++;
      if(this.objective.progress>=(this.objective.goal||3))this.threat.huntGoalComplete();
      else if(this.encounter?.huntMode==='sequential')this.markHuntTarget(this.enemies.find(x=>!x.dead&&!x.marked));
    }
    this.runStats.kills++;
    if (this.currentWaveStats) this.currentWaveStats.kills++;
    const s = PLANT_STATS[e.kind];

    this.killsWithoutWeaponDrop++;
    let guaranteed=false,dropChance=Math.min(.8,s.drop*1.25)*(this.balanceConfig?.weaponDropMultiplier??1);
    const stage2m=this.balanceConfig?.stage2mEconomy;
    if(stage2m&&e.kind==='sprout'&&e.stage2lWeak)dropChance*=stage2m.weakSproutMultiplier;
    let supplyState=null;
    if(stage2m?.pityMode==='resource-time'){
      supplyState=stage2mSupplyState(this,stage2m);
      guaranteed=supplyState.shortage&&this.killsWithoutWeaponDrop>=supplyState.requiredMisses;
    } else if(this.balanceConfig?.resourcePity) {
      const hands=this.player.hands,ammo=hands.reduce((sum,w)=>sum+(w?.ammo||0),0),capacity=hands.reduce((sum,w)=>sum+(w?.cap||0),0);
      const armed=hands.filter(w=>w&&w.ammo>0).length,nearby=this.pickups.filter(p=>!p.dead&&p.type==='weapon'&&p.ammo>0&&p.lock<=0&&!p.avoidMagnet&&dist(this.player.x,this.player.y,p.x,p.y)<this.balanceConfig.nearbyOrganRadius).length;
      const shortage=armed===0||ammo===0||(capacity>0&&ammo/capacity<=this.balanceConfig.lowAmmoRatio)||(armed<2&&ammo<=8);
      guaranteed=this.killsWithoutWeaponDrop>=this.balanceConfig.pityAfterMisses&&shortage&&nearby===0;
      if(armed===2&&capacity>0&&ammo/capacity>=.75&&nearby>=2)dropChance*=.12;
      else if(nearby>=3)dropChance*=.25;
    } else guaranteed=this.killsWithoutWeaponDrop>=this.balanceConfig.pityAfterMisses;
    const ordinaryDrop=guaranteed?false:chance(dropChance);
    if (guaranteed || ordinaryDrop || (!this.balanceConfig?.resourcePity&&e.kind==='maw')) {
      this.killsWithoutWeaponDrop=0;this.runStats.economy.weaponDrops++;this.recordCombatValue('weaponDrops');
      const id = chooseOrgan(e.kind);
      const def = WEAPON_DEFS[id];
      const organ=new Pickup(e.x,e.y,'weapon',id,def.mag+def.reserve);
      const origin={type:'enemy',kind:e.kind,guaranteed:guaranteed||(!this.balanceConfig?.resourcePity&&e.kind==='maw'),guaranteeReason:guaranteed?(supplyState?'resource-time':this.balanceConfig?.resourcePity?'resource-pity':'kill-streak'):e.kind==='maw'?'boss':null};
      if(supplyState)origin.stage2mSupply=supplyState;
      this.offerOrgan(organ,origin);this.pickups.push(organ);
    }
    if (chance(this.balanceConfig?.healthDropChance??.22)) {this.pickups.push(new Pickup(e.x + rand(-14, 14), e.y + rand(-14, 14), 'health'));this.recordHealthCreated();}

    // вампирский голод
    if (this.player.lifeOnKill > 0) {
      const p=this.player,requested=p.lifeOnKill,allowed=this.balanceConfig.sustain?Math.min(requested,p.vampirismBudget):requested,before=p.hp;
      p.hp=Math.min(p.maxHp,p.hp+allowed);const healed=p.hp-before;
      if(this.balanceConfig.sustain)p.vampirismBudget=Math.max(0,p.vampirismBudget-healed);
      this.recordHealing('vampirism',allowed,healed);
      if(allowed<requested){const denied=requested-allowed,first=this.threat.data.risk,second=this.threat.encounter?.risk;first.healing.vampirism.deniedBudget+=denied;if(second)second.healing.vampirism.deniedBudget+=denied;}
    }
  }

  markHuntTarget(e){
    if(!e||e.dead||e.marked||this.encounter?.kind!=='hunt'||this.objective.progress>=(this.objective.goal||3))return false;
    if(this.encounter.huntMode==='sequential'&&countMarkedEnemies(this.enemies,true)>0)return false;
    e.marked=true;e.maxHp*=1.2;e.hp=e.maxHp;
    this.threat.huntTarget(e,countMarkedEnemies(this.enemies,true));
    return true;
  }

  // ---------------- обновление ----------------
  update(dt) {
    this.time += dt;
    if(this.resonatorBreaks?.length)compactResonatorBreaks(this.resonatorBreaks,this.time);
    if (this.input.pauseRequested && this.state === 'playing') {
      this.input.pauseRequested=false; this.input.endFrame();
      this.returnState='playing'; this.state='paused';
      this.tip='Пауза: окно потеряло фокус'; return;
    }
    this.input.pauseRequested = false;

    if(this.state==='splash') {
      if(this.input.pressed.size || this.input.mouseJust.down || this.input.padEdges.size) {
        this.state='menu';this.menuSelection=0;this.input.endFrame();
      }
      return;
    }
    if(this.state==='settings') {this.updateSettings();return;}
    if(this.state==='about') {
      const aboutButton=getAboutButton(this.vw,this.vh),mouse=this.input.mouse;
      const aboutClick=this.input.mouseJust.down && mouse.x>=aboutButton.x && mouse.x<=aboutButton.x+aboutButton.w && mouse.y>=aboutButton.y && mouse.y<=aboutButton.y+aboutButton.h;
      if(this.input.actionHit('menuDown'))this.aboutScroll=Math.min(this.aboutMaxScroll||0,(this.aboutScroll||0)+45);
      if(this.input.actionHit('menuUp'))this.aboutScroll=Math.max(0,(this.aboutScroll||0)-45);
      if(this.input.actionHit('back') || this.input.actionHit('confirm') || this.input.hit('KeyO') || aboutClick)this.state=this.aboutReturn||'menu';
      return;
    }
    if((this.state==='menu' || this.state==='paused') && !this.input.controlsOpen && (this.input.hit('KeyO') || this.input.padEdges.has('fuse'))) {
      this.aboutReturn=this.state;this.aboutScroll=0;this.state='about';return;
    }
    if (this.state === 'menu') {this.updateFrontMenu();return;}

    if (this.state === 'gameover' || this.state === 'victory') {
      if (this.input.actionHit('exportReport')) this.downloadBalanceReport();
      if (this.input.actionHit('restart')) this.newRun(false);
      else if (this.input.actionHit('newRun') || this.input.hit('Enter') || this.input.actionHit('confirm')) this.newRun(true);
      this.particles.update(dt);
      this.biology.update(dt,this);
      return;
    }

    if (this.state === 'paused') {
      if (this.input.controlsOpen) {
        if (this.input.waitingForBinding) {
          if (this.input.actionHit('back')) this.input.waitingForBinding = false;
          return;
        }
        if (this.input.actionHit('back')) {this.input.controlsOpen = false;if(this.controlsReturn){this.state=this.controlsReturn;this.controlsReturn=null;}}
        else if (this.input.hit('Backspace')) this.input.resetBindings();
        else if (this.input.actionHit('menuUp')) this.input.selectBinding(-1);
        else if (this.input.actionHit('menuDown')) this.input.selectBinding(1);
        else if (this.input.actionHit('confirm')) this.input.beginBinding();
        else if(this.input.mouseJust.down) {
          if(this.input.mouse.y>this.vh-55){if(this.input.mouse.x<this.vw/2)this.input.resetBindings();else{this.input.controlsOpen=false;this.state=this.controlsReturn||'paused';this.controlsReturn=null;}}
          else {const rows=Math.max(3,Math.floor((this.vh-170)/30)),first=clamp(this.input.selectedBinding-Math.floor(rows/2),0,Math.max(0,this.input.bindingActions.length-rows)),row=Math.floor((this.input.mouse.y-85)/30);if(row>=0&&row<rows&&first+row<this.input.bindingActions.length){this.input.selectedBinding=first+row;this.input.beginBinding();}}
        }
        return;
      }
      this.updateFrontMenu();
      return;
    }

    if (this.state === 'upgrade') {
      this.handleUpgradeInput();
      this.particles.update(dt);
      this.biology.update(dt,this);
      this.updateCamera(dt, false);
      return;
    }

    // пауза
    if (this.input.actionHit('pause') || this.input.hit('Escape')) {
      this.returnState = 'playing'; this.state = 'paused';
      return;
    }

    if (this.currentWaveStats) this.currentWaveStats.seconds += dt;
    this.threat.update(dt);
    if (this.bannerT > 0) this.bannerT -= dt;

    this.tipT = Math.max(0,this.tipT-dt); this.comboT = Math.max(0,this.comboT-dt);
    this.player.update(dt, this);
    if(this.currentWaveStats?.arena)this.recordArenaMovement(dt);
    if (!this.player.alive || this.outcome) return;
    this.updateEncounter(dt);
    if(this.missionCompletePending){this.waveCleared();return;}
    if (this.state !== 'playing') return;

    this.updateSpawnSchedule(dt);
    this.updateNestReinforcements(dt);

    for (const warning of this.spawnWarnings) {
      warning.t -= dt;
      if (warning.t <= 0) {
        const min = PLANT_STATS[warning.kind==='resonator'?'spitter':warning.kind].r + this.player.r + 90;
        const sourceNest=warning.sourceNestId?this.nests.find(n=>n.id===warning.sourceNestId&&!n.dead):null;
        if(warning.sourceNestId&&!sourceNest)continue;
        if (dist(warning.x,warning.y,this.player.x,this.player.y) >= min) {
          const e = this.spawnPlant(warning.x,warning.y,warning.kind);this.recordCombatValue('spawnedEnemies');
          if(sourceNest){
            const event=sourceNest.telemetry.activationEvents[warning.activationIndex];
            if(event){event.spawnedAt=this.currentWaveStats?.seconds??this.time;event.status='spawned';}
            sourceNest.telemetry.reinforcementsSpawned++;
          }
          if (this.encounter.kind === 'hunt') {
            if(this.encounter.huntMode==='sequential')this.markHuntTarget(e);
            else if(countMarkedEnemies(this.enemies,false)+this.objective.progress<(this.objective.goal||3)){e.marked=true;e.maxHp*=1.2;e.hp=e.maxHp;this.threat.huntTarget(e,countMarkedEnemies(this.enemies,true));}
          }
        } else if(sourceNest)warning.t=.2;
        else this.spawnQueue.unshift(warning.kind);
      }
    }
    compactActiveWarnings(this.spawnWarnings);
    // враги
    const aiStart=this.level01&&typeof performance!=='undefined'?performance.now():null;
    for (const e of this.enemies) {
      if (!e.dead) {if(e.kind==='maw')this.threat.bossTick(e,dt);e.update(dt, this);}
      if (!this.player.alive || this.outcome) {if(aiStart!==null)this.level01.recordAI(performance.now()-aiStart);return;}
    }
    if(aiStart!==null)this.level01.recordAI(performance.now()-aiStart);
    compactLive(this.enemies);

    // Swept contacts are resolved in trajectory order, not entity-array order.
    for(const b of this.bullets){this.advanceProjectile(b,dt,false);if(this.missionCompletePending)break;}
    compactLive(this.bullets);
    if(this.missionCompletePending){this.waveCleared();return;}
    for(const b of this.enemyBullets){this.advanceProjectile(b,dt,true);if(!this.player.alive)return;}
    compactLive(this.enemyBullets);

    // предметы
    for (const p of this.pickups) {
      if (!p.dead) {
        p.update(dt, this);
        if(p.type==='health'&&p.dead&&!p.expiryRecorded){p.expiryRecorded=true;this.recordHealthExpiry();}
      }
    }
    compactLive(this.pickups);

    this.particles.update(dt);
    this.biology.update(dt,this);
    this.updateCamera(dt, false);

    // конец волны
    if (this.waveActive && this.encounter.kind === 'clear' && this.spawnQueue.length === 0 && this.spawnWarnings.length === 0 && this.enemies.length === 0) {
      this.waveCleared();
    }
  }

  updateSpawnSchedule(dt) {
    const plan=this.encounter;
    if(!plan?.maxAlive) {
      if(this.spawnQueue.length>0) {
        this.spawnTimer-=dt;
        if(this.spawnTimer<=0) {
          this.spawnTimer=rand(.24,.52);
          const kind=this.spawnQueue.shift(),pos=this.findSpawnPos(kind);
          if(pos)this.spawnWarnings.push({x:pos.x,y:pos.y,kind,t:.8});else this.spawnQueue.unshift(kind);
          if(pos)this.particles.burst(pos.x,pos.y,10,{speed:120,life:.4,size:4,color:'#3f7a2f'});
        }
      }
      return;
    }

    const occupied=countLiveEnemies(this.enemies)+this.spawnWarnings.length;
    let onlyOffscreenTail=false;
    if(!this.spawnQueue.length&&this.reinforcementBudget>0&&(plan.kind==='hold'||plan.kind==='survive')&&this.objective.progress<this.objective.goal&&occupied===1&&this.spawnWarnings.length===0){
      const halfW=this.vw/(2*this.zoom),halfH=this.vh/(2*this.zoom);
      for(const enemy of this.enemies)if(!enemy.dead){onlyOffscreenTail=enemy.x<this.cam.x-halfW-enemy.r||enemy.x>this.cam.x+halfW+enemy.r||enemy.y<this.cam.y-halfH-enemy.r||enemy.y>this.cam.y+halfH+enemy.r;break;}
    }
    if(!this.spawnQueue.length&&this.reinforcementBudget>0&&(plan.kind==='hold'||plan.kind==='survive')&&(occupied===0||onlyOffscreenTail)&&this.objective.progress<this.objective.goal) {
      const amount=Math.min(plan.batchSize||3,this.reinforcementBudget);
      for(let i=0;i<amount&&this.reinforcementKinds.length;i++) {
        const kind=this.reinforcementKinds[this.reinforcementCursor++%this.reinforcementKinds.length];
        this.spawnQueue.push(kind);
      }
      this.reinforcementBudget-=amount;
      this.recordCombatValue('reinforcementBatches');
    }
    if(!this.spawnQueue.length)return;
    this.spawnTimer-=dt;
    const alive=countLiveEnemies(this.enemies)+this.spawnWarnings.length;
    if(this.spawnTimer>0||alive>=plan.maxAlive)return;

    const size=Math.min(plan.batchSize||3,plan.maxAlive-alive,this.spawnQueue.length),groupId=++this.spawnGroupCount;
    const openingKinds=plan.stage2f1OpeningGroup||plan.resonatorOpeningGroup;
    const openingRoster=plan.composition?.resonator
      ?this.spawnQueue[0]==='resonator'&&this.spawnQueue[1]==='spitter'&&this.spawnQueue[2]==='spitter'
      :this.spawnQueue[0]==='spitter'&&this.spawnQueue[1]==='spitter'&&this.spawnQueue[2]==='spitter';
    const openingPositions=openingKinds&&groupId===1&&openingRoster?this.findOpeningGroupPositions():null;
    let spawned=0;
    for(let i=0;i<size;i++) {
      const kind=this.spawnQueue.shift(),pos=openingPositions&&i<3?openingPositions[i]:this.findSpawnPos(kind);
      if(!pos){this.spawnQueue.unshift(kind);break;}
      this.spawnWarnings.push({x:pos.x,y:pos.y,kind,t:.8,groupId});
      this.particles.burst(pos.x,pos.y,8,{speed:115,life:.38,size:4,color:'#3f7a2f'});
      spawned++;
    }
    if(!spawned){this.spawnTimer=.3;return;}
    this.recordCombatValue('spawnGroups');
    const kills=this.spawnKillsSinceGroup||0;this.spawnKillsSinceGroup=0;
    this.spawnTimer=Math.max(.4,(plan.groupGap||1.5)-Math.min(.8,kills*.16));
  }

  updateNestReinforcements(dt) {
    if(this.encounter?.kind!=='roots'||!this.waveActive||this.missionCompletePending)return;
    const elapsed=this.currentWaveStats?.seconds??0;
    if(this.nests.length)for(const nest of this.nests){
      nest.hitFlash=Math.max(0,nest.hitFlash-dt);
      if(nest.dead||nest.remainingBudget<=0||elapsed+1e-9<nest.nextActivationAt)continue;
      const alive=countLiveEnemies(this.enemies)+this.spawnWarnings.length;
      if(alive>=(this.encounter.maxAlive||Infinity))continue;
      const kind=nest.spawnKinds[nest.activationIndex%nest.spawnKinds.length];
      const pos=this.findNestSpawnPos(nest,kind);if(!pos)continue;
      const activationIndex=nest.telemetry.activationEvents.length;
      nest.telemetry.activationEvents.push({at:elapsed,kind,x:pos.x,y:pos.y,warningSeconds:.8,spawnedAt:null,status:'warning'});
      nest.telemetry.activations++;
      nest.remainingBudget--;nest.telemetry.remainingBudget=nest.remainingBudget;
      nest.activationIndex++;nest.lastActivatedAt=elapsed;nest.nextActivationAt=elapsed+nest.interval;
      this.spawnWarnings.push({x:pos.x,y:pos.y,kind,t:.8,sourceNestId:nest.id,activationIndex});
      this.recordCombatValue('reinforcementBatches');
    }
  }

  findNestSpawnPos(nest,kind) {
    const p=this.player,r=PLANT_STATS[kind].r,base=Math.atan2(nest.y-p.y,nest.x-p.x),distance=nest.r+r+92;
    for(let i=0;i<12;i++){
      const a=base+i*Math.PI/6,x=nest.x+Math.cos(a)*distance,y=nest.y+Math.sin(a)*distance;
      if(x<r+20||x>LEVEL.w-r-20||y<r+20||y>LEVEL.h-r-20)continue;
      if(dist(x,y,p.x,p.y)<p.r+r+90)continue;
      if(LEVEL.obstacles.some(ob=>dist(x,y,ob.x,ob.y)<ob.r+r+12))continue;
      if(this.enemies.some(e=>!e.dead&&dist(x,y,e.x,e.y)<e.r+r+16))continue;
      if(this.spawnWarnings.some(w=>dist(x,y,w.x,w.y)<r+PLANT_STATS[w.kind].r+16))continue;
      return {x,y};
    }
    return null;
  }

  damageNest(nest,amount,meta={}) {
    if(!nest||nest.dead||!Number.isFinite(amount)||amount<=0)return 0;
    const actual=Math.min(nest.hp,amount);nest.hp=Math.max(0,nest.hp-amount);nest.hitFlash=.16;
    nest.telemetry.damage+=actual;nest.telemetry.damageByWeapon[meta.weaponId||'unknown']=(nest.telemetry.damageByWeapon[meta.weaponId||'unknown']||0)+actual;
    const arena=this.currentWaveStats?.arena;if(arena)arena.mission.nestDamage+=actual;
    this.runStats.damageDealt+=actual;if(this.currentWaveStats)this.currentWaveStats.damageDealt+=actual;
    if(meta.weaponId){this.weaponMetric(meta.weaponId).damage+=actual;if(Number.isInteger(meta.fusionIndex)){const f=this.runStats.fusions[meta.fusionIndex];if(f)f.damage+=actual;}}
    this.particles.burst(nest.x,nest.y,5,{speed:85,life:.28,size:3,color:'#b8ef5a',color2:'#667d35'});
    this.sfx.hit();
    if(nest.hp>0)return actual;
    nest.dead=true;nest.telemetry.destroyedAt=this.currentWaveStats?.seconds??this.time;
    if(arena)arena.mission.destroyedOrder.push(nest.id);
    const pending=this.spawnWarnings.filter(w=>w.sourceNestId===nest.id);
    for(const warning of pending){const event=nest.telemetry.activationEvents[warning.activationIndex];if(event){event.status='stopped';event.stoppedAt=this.currentWaveStats?.seconds??this.time;}}
    const stopped=nest.remainingBudget+pending.length;
    nest.remainingBudget=0;nest.telemetry.remainingBudget=0;nest.telemetry.stoppedReinforcements+=stopped;
    this.spawnWarnings=this.spawnWarnings.filter(w=>w.sourceNestId!==nest.id);
    if(arena)arena.mission.stoppedReinforcements+=stopped;
    if(this.objective){this.objective.progress=arena?.mission.destroyedOrder.length||0;}
    this.particles.burst(nest.x,nest.y,26,{speed:175,life:.62,size:5,color:'#d0ef78',color2:'#466a32',grav:65,drag:.86});
    this.sfx.splat();
    if(this.nests.length&&this.nests.every(item=>item.dead)){
      if(arena){arena.mission.objectiveCompletedAt=this.currentWaveStats?.seconds??this.time;arena.mission.completionReason='all-nests-destroyed';}
      if(this.currentWaveStats)this.currentWaveStats.objectiveCompletionAt=this.currentWaveStats.seconds;
      this.missionCompletePending=true;
    }
    return actual;
  }

  recordArenaMovement(dt) {
    const stats=this.currentWaveStats?.arena;if(!stats)return;
    const p=this.player,sample=this.arenaMotionSample||(this.arenaMotionSample={x:p.x,y:p.y,direction:{x:0,y:0},lastDirection:null,lastMoveAt:-Infinity});
    const dx=p.x-sample.x,dy=p.y-sample.y,distance=Math.hypot(dx,dy),elapsed=this.currentWaveStats.seconds;
    sample.x=p.x;sample.y=p.y;
    if(distance>.35){
      stats.movementSeconds+=dt;stats.distance+=distance;
      if(elapsed-sample.lastMoveAt>.4)sample.lastDirection=null;
      const directionX=dx/distance,directionY=dy/distance;
      if(sample.lastDirection&&sample.lastDirection.x*directionX+sample.lastDirection.y*directionY<.5)stats.directionChanges++;
      const direction=sample.direction||(sample.direction={x:0,y:0});
      direction.x=directionX;direction.y=directionY;
      sample.lastDirection=direction;sample.lastMoveAt=elapsed;
    }else{
      stats.stationarySeconds+=dt;
      if(elapsed-sample.lastMoveAt>.4)sample.lastDirection=null;
    }
  }

  recordArenaCover(b,rock) {
    const arena=this.currentWaveStats?.arena;if(!arena)return;
    const length=Math.hypot(b.vx,b.vy)||1,dx=b.vx/length*2400,dy=b.vy/length*2400;
    if(segmentCircleTime(b.x,b.y,dx,dy,this.player.x,this.player.y,this.player.r+b.r)===null)return;
    arena.coverBlocks++;const key=(b.sourceKind||'unknown')+':'+(b.attackType||'single');arena.coverBySource[key]=(arena.coverBySource[key]||0)+1;
    arena.coverEvents.push({at:this.currentWaveStats.seconds,sourceKind:b.sourceKind||'unknown',attackType:b.attackType||'single',rockX:rock.x,rockY:rock.y});
    if(arena.coverEvents.length>128)arena.coverEvents.shift();
  }

  detonateProjectile(b) {
    if(!b.explode)return;
    this.explode(b.x,b.y,b.explode,b.explodeDmg,b);
    if(b.echo&&!b.echoScheduled){b.echoScheduled=true;buildTrigger(this,'globEcho');this.effects.push({t:.4,x:b.x,y:b.y,r:b.explode,dmg:b.explodeDmg*.65,meta:{weaponId:b.weaponId,hand:b.hand,fusionIndex:b.fusionIndex,effect:'echo'}});}
  }

  damageBossGland(boss,gland,amount,meta={}) {
    if(!boss?.glandsEnabled||!gland?.enabled||gland.disabledUntil>this.time||gland.hp<=0)return 0;
    const actual=Math.min(gland.hp,Math.max(0,amount));if(actual<=0)return 0;
    gland.hp-=actual;this.threat.glandDamage(boss,gland.side,actual,meta);
    this.runStats.damageDealt+=actual;if(this.currentWaveStats)this.currentWaveStats.damageDealt+=actual;
    if(meta.weaponId){this.weaponMetric(meta.weaponId).damage+=actual;if(Number.isInteger(meta.fusionIndex)){const f=this.runStats.fusions[meta.fusionIndex];if(f)f.damage+=actual;}}
    if(gland.hp<=1e-8){gland.hp=0;gland.enabled=false;gland.disabledAt=this.threat.time;gland.disabledDuration=this.balanceConfig.boss.glandDisableSeconds||6;gland.disabledRemaining=gland.disabledDuration;gland.disabledUntil=this.time+gland.disabledRemaining;this.threat.glandDisabled(boss,gland.side,gland.disabledDuration);this.particles.text(gland.x,gland.y-24,'ЖЕЛЕЗА ОТКЛЮЧЕНА · '+gland.disabledDuration+'С','#e2bf79',11);this.shake(1.1);}
    else this.particles.text(gland.x,gland.y-22,String(Math.round(actual)),'#dceca4',10);
    this.particles.burst(gland.x,gland.y,4,{speed:65,life:.24,size:2.5,color:'#c5d878',color2:'#75894d',drag:.88});this.sfx.hit();
    return actual;
  }

  advanceProjectile(b,dt,hostile=false) {
    if(b.dead)return;
    let remaining=Math.min(dt,Math.max(0,b.life)),contactAtEnd=false;
    for(let contacts=0;contacts<16 && remaining>1e-10 && !b.dead;contacts++) {
      const dx=b.vx*remaining,dy=b.vy*remaining;
      let first=null;
      const consider=(object,type)=>{
        const t=segmentCircleTime(b.x,b.y,dx,dy,object.x,object.y,b.r+object.r);
        // Rocks win exact ties, including a player overlapping cover.
        if(t!==null && (!first || t<first.t-1e-10))first={object,type,t};
      };
      if(LEVEL)for(const rock of LEVEL.obstacles)consider(rock,'rock');
      if(hostile)consider(this.player,'player');
      else {
        for(const nest of this.nests)if(!nest.dead&&!b.hitTargets.has(nest))consider(nest,'nest');
        for(const e of this.enemies)if(!e.dead){if(e.glandsEnabled)for(const side of BOSS_GLAND_SIDES){const gland=e.glandAt(side);if(gland.enabled&&gland.disabledUntil<=this.time&&!b.hitTargets.has(gland))consider(gland,'gland');}if(!b.hitTargets.has(e))consider(e,'enemy');}
      }
      if(!first){b.x+=dx;b.y+=dy;remaining=0;break;}
      b.x+=dx*first.t;b.y+=dy*first.t;remaining*=1-first.t;
      const target=first.object;
      if(first.type==='rock') {
        if(hostile)this.recordArenaCover(b,target);
        this.particles.burst(b.x,b.y,hostile?3:4,{speed:90,life:.25,size:3,color:'#9aa08a'});
        if(!hostile && b.bounce>0) {
          b.bounce--;
          buildTrigger(this,'boneBounce');
          let nx=b.x-target.x,ny=b.y-target.y,len=Math.hypot(nx,ny);
          if(len<1e-9){nx=-b.vx;ny=-b.vy;len=Math.hypot(nx,ny)||1;}
          nx/=len;ny/=len;const dot=b.vx*nx+b.vy*ny;
          if(dot<0){b.vx-=2*dot*nx;b.vy-=2*dot*ny;}
          b.x=target.x+nx*(target.r+b.r+.001);b.y=target.y+ny*(target.r+b.r+.001);
          b.rot=Math.atan2(b.vy,b.vx);
        } else {b.dead=true;this.detonateProjectile(b);contactAtEnd=true;}
      } else if(hostile) {
        b.dead=true;this.hurtPlayer(b.dmg,b.x,b.y,{label:'Вражеский снаряд',sourceKind:b.sourceKind||'unknown',attackType:b.attackType||'single',bossId:b.bossId,coordinatorId:b.coordinatorId});
      } else if(first.type==='nest') {
        b.hitTargets.add(target);this.damageNest(target,b.dmg,b);this.detonateProjectile(b);
        contactAtEnd=remaining<=1e-10;if(b.pierce>0)b.pierce--;else b.dead=true;
      } else if(first.type==='gland') {
        b.hitTargets.add(target);this.damageBossGland(target.boss,target,b.dmg,{...b,damageType:'direct'});this.detonateProjectile(b);contactAtEnd=remaining<=1e-10;if(b.pierce>0)b.pierce--;else b.dead=true;
      } else {
        b.hitTargets.add(target);
        if(b.slow){target.slowT=1.5;buildTrigger(this,'spitterSlow');}
        if(b.hitTargets.size>1)buildTrigger(this,'piercingContact');
        const carrier=WEAPON_DEFS[b.weaponId];if(carrier&&this.player.mods.thornPierce&&(carrier.genes||[carrier.id]).includes('thorn')&&b.hitTargets.size>(carrier.pierce||0)+1)buildTrigger(this,'thornPierce');
        target.hurt(b.dmg,this,b.x,b.y,b);
        const angle=Math.atan2(b.vy,b.vx);target.vx+=Math.cos(angle)*(b.knock||60);target.vy+=Math.sin(angle)*(b.knock||60);
        this.detonateProjectile(b);
        contactAtEnd=remaining<=1e-10;
        if(b.pierce>0)b.pierce--;else b.dead=true;
      }
    }
    // If the safety cap is reached, defer at the last safe position; never jump
    // through the unprocessed part of the trajectory.
    b.life=Math.max(0,b.life-dt);
    if(b.life<=1e-10&&!b.dead){if(!contactAtEnd)this.detonateProjectile(b);b.dead=true;}
  }

  explode(x, y, radius, dmg, meta = {}) {
    this.particles.burst(x, y, 26, {
      speed: 300, life: 0.7, size: 6, color: '#b6f27a', color2: '#4d8a33', drag: 0.86,
    });
    this.particles.burst(x, y, 10, {
      speed: 120, life: 1.0, size: 9, color: '#6a3a1a', color2: '#3a2010', drag: 0.9,
    });
    this.shake(9);
    this.sfx.explode();
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < radius + e.r) {
        const f = 1 - clamp((d - e.r) / radius, 0, 1);
        e.hurt(dmg * f, this, x, y, {...meta,damageType:'explosive'});
      }
      if(e.glandsEnabled&&!e.dead)for(const side of BOSS_GLAND_SIDES) {
        const gland=e.glandAt(side);if(!gland.enabled||gland.disabledUntil>this.time||meta.hitTargets?.has(gland))continue;
        const gd=dist(x,y,gland.x,gland.y);if(gd<radius+gland.r){const f=1-clamp((gd-gland.r)/radius,0,1);meta.hitTargets?.add(gland);this.damageBossGland(e,gland,dmg*f,{...meta,damageType:'explosive'});}
      }
    }
    for(const nest of this.nests){
      if(nest.dead||meta.hitTargets?.has(nest))continue;
      const d=dist(x,y,nest.x,nest.y);
      if(d<radius+nest.r){const f=1-clamp((d-nest.r)/radius,0,1);meta.hitTargets?.add(nest);this.damageNest(nest,dmg*f,meta);}
    }
  }

  handleUpgradeInput() {
    const input = this.input;
    if (!this.upgradeInputArmed) {
      const held=input.mouse.down||input.mouse.right||['Enter','Digit1','Digit2','Digit3'].some(key=>input.down(key))||['fireLeft','fireRight','confirm','upgrade1','upgrade2','upgrade3'].some(action=>input.actionDown(action));
      for(const key of ['Enter','Digit1','Digit2','Digit3',...['fireLeft','fireRight','confirm','upgrade1','upgrade2','upgrade3'].map(action=>input.bindings[action])]) input.pressed.delete(key);
      for(const action of ['fireLeft','fireRight','confirm','upgrade1','upgrade2','upgrade3']) input.padEdges.delete(action);
      input.mouseJust.down=false;input.mouseJust.right=false;
      if(held)return;
      this.upgradeInputArmed=true;
    }
    if (input.actionHit('menuUp')) this.hoverCard = (this.hoverCard + this.cards.length - 1) % this.cards.length;
    if (input.actionHit('menuDown')) this.hoverCard = (this.hoverCard + 1) % this.cards.length;
    if (input.actionHit('confirm')) { this.chooseUpgrade(Math.max(0,this.hoverCard)); return; }
    for (let i=0;i<this.cards.length;i++) if (input.actionHit('upgrade'+(i+1))) { this.chooseUpgrade(i); return; }
    const m=input.mouse;
    getUpgradeLayout(this.vw,this.vh,this.cards.length).forEach((r,i)=>{
      if (m.inside && m.x>=r.x && m.x<=r.x+r.w && m.y>=r.y && m.y<=r.y+r.h) {
        if (m.moved) this.hoverCard=i;
        if (input.mouseJust.down) this.chooseUpgrade(i);
      }
    });
  }

  findSpawnPos(kind = 'sprout') {
    const p=this.player, r=PLANT_STATS[kind==='resonator'?'spitter':kind].r;
    for (let i=0;i<96;i++) {
      const a=rand(0,TAU), d=rand(330,500);
      const x=clamp(p.x+Math.cos(a)*d,r+20,LEVEL.w-r-20), y=clamp(p.y+Math.sin(a)*d,r+20,LEVEL.h-r-20);
      if (dist(x,y,p.x,p.y)<300+r) continue;
      if (LEVEL.obstacles.some(ob=>dist(x,y,ob.x,ob.y)<ob.r+r+12)) continue;
      if (this.enemies.some(enemy=>!enemy.dead&&dist(x,y,enemy.x,enemy.y)<PLANT_STATS[enemy.kind].r+r+16)) continue;
      if (this.spawnWarnings.some(warning=>{if(!warning||!Number.isFinite(warning.x)||!Number.isFinite(warning.y))return false;const pending=PLANT_STATS[warning.kind==='resonator'?'spitter':warning.kind];return !!pending&&dist(x,y,warning.x,warning.y)<pending.r+r+16;})) continue;
      return {x,y};
    }
    return null;
  }

  findOpeningGroupPositions() {
    // Build the opening trio from the same safe spawn-point sampler used by
    // ordinary waves, then choose a readable pair that is actually in range.
    // This only affects opening groups explicitly tagged for Resonator testing.
    const points=[];
    for(let i=0;i<24;i++) {
      const point=this.findSpawnPos('spitter');
      if(point)points.push(point);
    }
    if(points.length<3)return null;
    const player=this.player,angleAt=point=>Math.atan2(player.y-point.y,player.x-point.x),angles=points.map(angleAt);
    const radius=400,minSeparation=50,minSpread=.96;
    let best=null,bestScore=Infinity;
    for(let r=0;r<points.length;r++) {
      const nearby=[];
      for(let i=0;i<points.length;i++)if(i!==r){
        const distance=dist(points[r].x,points[r].y,points[i].x,points[i].y);
        if(distance<=radius&&distance>=minSeparation)nearby.push({index:i,distance});
      }
      for(let a=0;a<nearby.length;a++)for(let b=a+1;b<nearby.length;b++) {
        const ia=nearby[a].index,ib=nearby[b].index,da=nearby[a].distance,db=nearby[b].distance;
        const between=dist(points[ia].x,points[ia].y,points[ib].x,points[ib].y);
        if(between<minSeparation)continue;
        const spread=Math.abs(Math.atan2(Math.sin(angles[ia]-angles[ib]),Math.cos(angles[ia]-angles[ib])));
        if(spread<minSpread)continue;
        const score=Math.abs(spread-1.5)*120+(da+db)*.025;
        if(score<bestScore){bestScore=score;best=[points[r],points[ia],points[ib]];}
      }
    }
    return best;
  }

  newRun(randomize) {
    if (randomize) this.seed = ((Date.now() ^ Math.floor(Math.random()*0xffffffff)) >>> 0) || 1;
    this.returnState=null; this.reset(); this.startGame();
  }

  weaponMetric(id) {
    const all=this.runStats.weaponPerformance;
    return all[id] || (all[id]={shots:0,damage:0,kills:0,seconds:0});
  }

  organEvent(type,detail) {
    const stats=this.runStats.ecology;
    if(stats.events.length>=stats.eventLimit){stats.events.shift();stats.truncatedEvents++;}
    stats.events.push({type,at:stats.playSeconds,wave:this.wave,...detail});
  }

  offerOrgan(p,origin) {
    p.origin={...origin};p.organId=++this.organSerial;p.offeredAt=this.runStats.ecology.playSeconds;
    const stats=this.runStats.ecology;stats.offered[p.weaponId]=(stats.offered[p.weaponId]||0)+1;
    const source=origin.type==='enemy'?origin.kind:origin.type;
    const row=stats.sources[source]||(stats.sources[source]={});row[p.weaponId]=(row[p.weaponId]||0)+1;
    this.organEvent('offer',{organId:p.organId,weapon:p.weaponId,ammo:p.ammo,origin:p.origin});
  }

  updateWeaponEcology(dt) {
    const stats=this.runStats.ecology,state=this.ecologyState,hands=this.player.hands;
    const loaded=(hands[0]&&!hands[0].empty?1:0)+(hands[1]&&!hands[1].empty?1:0);
    stats.playSeconds+=dt;stats.emptyHandSeconds+=(2-loaded)*dt;if(loaded<2)stats.oneEmptySeconds+=dt;
    const b=this.runStats.builds,genes=this._ecologyGenes,firing=this._ecologyFiring;
    genes.clear();firing.clear();
    for(let i=0;i<2;i++){
      const w=hands[i];if(!w||w.empty)continue;
      const active=i===0?this.player.firingL:this.player.firingR;
      if(w.def.genes){for(const gene of w.def.genes){genes.add(gene);if(active)firing.add(gene);}}
      else {genes.add(w.id);if(active)firing.add(w.id);}
    }
    for(const m of MUTATIONS)if(this.player.mods[m.id]){const gene=MUTATION_GENES[m.id],eligible=gene?genes.has(gene):loaded===2,active=gene?firing.has(gene):loaded===2&&(this.player.firingL||this.player.firingR);if(eligible)b.eligibleSeconds[m.id]=(b.eligibleSeconds[m.id]||0)+dt;if(active)b.firingSeconds[m.id]=(b.firingSeconds[m.id]||0)+dt;}
    const segment=b.segments.at(-1);if(segment){segment.seconds+=dt;if(loaded===2)segment.dualLoadedSeconds+=dt;if(loaded===2&&this.player.firingL&&this.player.firingR)segment.dualFireSeconds+=dt;}
    if(loaded===2){stats.dualLoadedSeconds+=dt;if(this.player.firingL&&this.player.firingR)stats.dualHeldSeconds+=dt;}
    if(loaded===1&&(hands[0]?.def.fused||hands[1]?.def.fused))stats.fusionEmptySeconds+=dt;
    if(!loaded){if(!state.dry)stats.dryEpisodes++;state.dryRun+=dt;stats.longestDrySeconds=Math.max(stats.longestDrySeconds,state.dryRun);}else state.dryRun=0;
    state.dry=!loaded;state.sample-=dt;
    if(state.sample<=0){state.sample+=1;let ground=0,near=0;for(const p of this.pickups)if(!p.dead&&p.type==='weapon'&&p.ammo>0){ground++;if(p.lock<=0&&!p.avoidMagnet&&dist(this.player.x,this.player.y,p.x,p.y)<260)near++;}stats.groundSamples++;stats.groundSum+=ground;stats.groundMax=Math.max(stats.groundMax,ground);stats.nearbySum+=near;state.near=near;}
    if(!loaded&&state.near>0)stats.dryWithNearbySeconds+=dt;
  }

  updateEncounter(dt) {
    const p=this.player, o=this.objective, stats=this.currentWaveStats;
    if (stats) {
      if(p.hp<=p.maxHp*.3)this.recordCombatValue('lowHealthSeconds',dt);
      let nearby=false,alive=0,visibleBullets=0;
      for(const e of this.enemies)if(!e.dead){alive++;if(!nearby&&dist(e.x,e.y,p.x,p.y)<550)nearby=true;}
      const halfW=this.vw/(2*this.zoom),halfH=this.vh/(2*this.zoom);
      for(const b of this.enemyBullets)if(!b.dead&&b.x>=this.cam.x-halfW&&b.x<=this.cam.x+halfW&&b.y>=this.cam.y-halfH&&b.y<=this.cam.y+halfH)visibleBullets++;
      addPopulationSample(this.runStats.combat,alive,visibleBullets,this.enemyBullets.length);
      addPopulationSample(stats.combat,alive,visibleBullets,this.enemyBullets.length);
      if(nearby||visibleBullets||this.spawnWarnings.length) {stats.combat.pressureSeconds+=dt;this.runStats.combat.pressureSeconds+=dt;}
      else {stats.combat.breatherSeconds+=dt;this.runStats.combat.breatherSeconds+=dt;}
      if (nearby) stats.combatSeconds+=dt;
      else if (o?.kind==='hold' && o.progress<o.goal) stats.objectiveQuietSeconds+=dt;
      else if (o?.kind!=='hold' && o?.kind!=='survive' && this.spawnQueue.length===0 && this.spawnWarnings.length===0) stats.cleanupSeconds+=dt;
      else stats.idleSeconds+=dt;
    }
    const leftId=p.hands[0]?.id,rightId=p.hands[1]?.id;
    if(leftId)this.weaponMetric(leftId).seconds+=dt;
    if(rightId&&rightId!==leftId)this.weaponMetric(rightId).seconds+=dt;
    this.updateWeaponEcology(dt);
    const effects=this.effects,initialCount=effects.length;
    let write=0;
    for(let i=0;i<initialCount;i++){
      const effect=effects[i];effect.t-=dt;
      if(effect.t>0)effects[write++]=effect;
      else this.explode(effect.x,effect.y,effect.r,effect.dmg,effect.meta);
    }
    // An explosion may schedule a new echo. The original forEach did not tick
    // newly appended effects until the next simulation step.
    for(let i=initialCount;i<effects.length;i++)effects[write++]=effects[i];
    effects.length=write;
    this.updateDigging(dt);
    if (!o) return;
    const seconds=stats ? stats.seconds : 0;
    if (o.kind==='hold' && stats && o.progress<o.goal) {stats.holdElapsedSeconds+=dt;if(dist(p.x,p.y,o.x,o.y)<=o.radius)stats.holdProgressSeconds+=dt;else stats.holdOutsideSeconds+=dt;}
    if (o.kind==='hold' || o.kind==='survive') {
      if(o.kind==='survive') {o.x=clamp(o.originX+Math.sin(seconds*0.18)*200,220,LEVEL.w-220);o.y=clamp(o.originY+Math.sin(seconds*0.13)*140,220,LEVEL.h-220);}
      const inside=dist(p.x,p.y,o.x,o.y)<=o.radius;
      if(o.kind==='hold' && inside) o.progress+=dt;
      if(o.kind==='survive') {o.progress+=dt;if(!inside && seconds>3 && Math.floor(seconds)!==this.sporeTick){this.sporeTick=Math.floor(seconds);this.lastDamageSource='Споры вне круга';this.hurtPlayer(5,o.x,o.y,'Споры вне круга');}}
      if(p.alive && o.progress>=o.goal) {if(stats){stats.objectiveCompletionAt=stats.seconds;stats.postObjectiveSeconds=0;}this.score+=300;this.waveCleared();}
    }
    if(o.kind==='hunt' && o.progress>=o.goal) {this.score+=300;this.waveCleared();}
  }

  updateDigging(dt) {
    if(this.recoveryFeedbackT>0)this.recoveryFeedbackT=Math.max(0,this.recoveryFeedbackT-dt);
    const p=this.player,armed=!!((p.hands[0]&&!p.hands[0].empty)||(p.hands[1]&&!p.hands[1].empty));
    const recovery=this.balanceConfig?.stage2mRecovery,mode=recovery?.enabled?(recovery.mode==='stationary'?'stationary':'manual'):null,auto=mode==='stationary';
    if(this.recoveryAutoMode!==mode&&this.digSite)this.digSite.progress=0;
    this.recoveryAutoMode=mode;
    const wasAutoActive=auto&&this.recoveryAutoActive;
    let moved=false;
    if(auto){
      const input=this.input,pad=input.pad,keyboard=input.moveVector(p.moveVector),padMoving=pad.active&&Math.hypot(pad.moveX,pad.moveY)>.15;
      // 12 world units/s is below deliberate movement but tolerates tiny physics jitter.
      const displaced=this.recoveryAutoLastX===null?0:Math.hypot(p.x-this.recoveryAutoLastX,p.y-this.recoveryAutoLastY);
      moved=!!(padMoving||keyboard.x||keyboard.y||p.dashT>0||Math.hypot(p.vx,p.vy)>12||displaced>Math.max(.2,12*dt));
      this.recoveryAutoLastX=p.x;this.recoveryAutoLastY=p.y;this.recoveryAutoActive=false;this.recoveryAutoReason=null;
    }else{this.recoveryAutoActive=false;this.recoveryAutoReason=null;this.recoveryAutoLastX=null;this.recoveryAutoLastY=null;}
    let nearbySupply=false;
    for(const x of this.pickups)if(!x.dead&&!x.avoidMagnet&&x.type==='weapon'&&x.ammo>0&&dist(p.x,p.y,x.x,x.y)<260){nearbySupply=true;break;}
    if(!armed)this.runStats.economy.drySeconds+=dt;
    if(armed || nearbySupply) {if(wasAutoActive)this.recoveryAutoReason='site_unavailable';this.digSite=null;return;}
    if(!this.digSite || dist(p.x,p.y,this.digSite.x,this.digSite.y)>260) {
      this.digSite={x:p.x,y:p.y+25,progress:0};
      this.tip=auto?'Под землёй остался живой корешок. Остановись, чтобы откопать.':'Под землёй остался живой корешок. Удерживай '+this.input.prompt('dig')+', чтобы откопать.';this.tipT=5;
    }
    const site=this.digSite,near=dist(p.x,p.y,site.x,site.y)<75;
    const digging=near&&(auto?!moved:this.input.actionDown('dig'));
    if(auto){this.recoveryAutoActive=digging;if(!digging&&site.progress>0)this.recoveryAutoReason=!near?'out_of_range':'motion';}
    if(digging) {
      site.progress+=dt;this.runStats.economy.digSeconds+=dt;
      this.particles.burst(site.x,site.y,2,{speed:55,life:.35,size:3,color:'#977656'});
      if(site.progress>=.9) {
        if(auto){this.recoveryAutoActive=false;this.recoveryAutoReason='completed';}
        if(this.balanceConfig?.stage2mRecovery?.enabled){this.recoveryFeedbackT=.8;this.recoveryFeedbackX=site.x;this.recoveryFeedbackY=site.y;}
        const supply=new Pickup(site.x,site.y,'weapon','bone',6);
        this.offerOrgan(supply,{type:'dig'});
        supply.fresh=false;supply.lock=.35;supply.unearthed=true;supply.vx=0;supply.vy=-35;
        this.pickups.push(supply);this.runStats.economy.digs++;
        this.digSite=null;this.tip='Откопан иссохший Костомозг: 6 зубов. Ищи свежие органы в растениях.';this.tipT=4;
        this.sfx.pickup();
      }
    } else site.progress=0;
  }

  updateCamera(dt, snap) {
    const p = this.player;
    const halfW = this.vw / (2 * this.zoom);
    const halfH = this.vh / (2 * this.zoom);
    const tx = clamp(p.x, halfW, Math.max(halfW, LEVEL.w - halfW));
    const ty = clamp(p.y, halfH, Math.max(halfH, LEVEL.h - halfH));
    if (snap) { this.cam.x = tx; this.cam.y = ty; }
    else {
      this.cam.x = lerp(this.cam.x, tx, clamp(dt * 7, 0, 1));
      this.cam.y = lerp(this.cam.y, ty, clamp(dt * 7, 0, 1));
    }
  }

  // ---------------- отрисовка ----------------
  draw() {
    const ctx = this.ctx;
    const vw = this.vw, vh = this.vh;
    const dpr=this.dpr||1;
    if(typeof setUiSnapScale==='function')setUiSnapScale(dpr,dpr);
    if(this.state==='splash'||this.state==='menu'||this.state==='settings'){drawOverlay(ctx,this,vw,vh);return;}

    const halfW = vw / (2 * this.zoom);
    const halfH = vh / (2 * this.zoom);
    this.view.x0 = this.cam.x - halfW;
    this.view.y0 = this.cam.y - halfH;
    this.view.x1 = this.cam.x + halfW;
    this.view.y1 = this.cam.y + halfH;

    // Clear the current frame without reallocating the backing canvas. The
    // canvas CSS background supplies the same dark edge during camera shake.
    ctx.clearRect(0, 0, vw, vh);

    ctx.save();
    ctx.translate(vw / 2 + (this.preferences.shake?this.particles.shakeX:0), vh / 2 + (this.preferences.shake?this.particles.shakeY:0));
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);
    if(typeof setUiSnapScale==='function')setUiSnapScale(dpr*this.zoom,dpr*this.zoom);

    LEVEL.drawGround(ctx, this.view);
    this.biology.drawStains(ctx,this.view);
    LEVEL.drawBorder(ctx);
    LEVEL.drawObstacles(ctx, this.view);

    this.biology.drawFragments(ctx,this.view);
    drawWorldSignals(ctx,this);
    if(typeof drawResonatorLinks==='function')drawResonatorLinks(ctx,this.enemies,this.time);
    if(typeof drawResonatorBreaks==='function')drawResonatorBreaks(ctx,this.resonatorBreaks,this.time);
    const dryLoot=typeof window!=='undefined'&&window.DEADWEED_LOOT_STYLE==='old'?null:findDryLootTarget(this);
    for (const p of this.pickups) {
      if(p.dead||p.x<this.view.x0-65||p.x>this.view.x1+65||p.y<this.view.y0-55||p.y>this.view.y1+55)continue;
      p.draw(ctx,this.time,p===this.player.nearbyWeapon,p===dryLoot);
    }
    for (const e of this.enemies) if(!e.dead)e.drawReactive(ctx, this.time);
    this.player.draw(ctx, this.time);

    // пули игрока
    for (const b of this.bullets) {
      ctx.save();
      if(b.weaponId==='bone'||b.weaponId==='spitter'){const speed=Math.hypot(b.vx,b.vy)||1,len=Math.min(b.weaponId==='bone'?24:11,speed*.008);ctx.strokeStyle=b.weaponId==='bone'?'rgba(255,232,180,.65)':'rgba(169,218,119,.55)';ctx.lineWidth=b.weaponId==='bone'?2.3:1.4;ctx.beginPath();ctx.moveTo(b.x-b.vx/speed*len,b.y-b.vy/speed*len);ctx.lineTo(b.x,b.y);ctx.stroke();}
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      drawProjectileBody(ctx,b);
      ctx.restore();
    }

    this.particles.draw(ctx);
    // вражеские снаряды
    for (const b of this.enemyBullets) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ffe3d2';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
    if(typeof setUiSnapScale==='function')setUiSnapScale(dpr,dpr);

    // The screen-space vignette only depends on viewport dimensions.
    if (!this.vignetteGradient || this.vignetteW !== vw || this.vignetteH !== vh) {
      const gradient = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.45)');
      this.vignetteGradient = gradient;
      this.vignetteW = vw;
      this.vignetteH = vh;
    }
    ctx.fillStyle = this.vignetteGradient;
    ctx.fillRect(0, 0, vw, vh);

    if(this.state!=='menu'&&this.state!=='splash'&&this.state!=='settings'&&!(this.state==='about'&&this.aboutReturn==='menu'))drawHUD(ctx,this,vw,vh,dryLoot);
    drawOverlay(ctx, this, vw, vh);
  }
}
