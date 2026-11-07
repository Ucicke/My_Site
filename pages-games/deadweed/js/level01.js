'use strict';
// First playable level. Kept separate from the existing ten-wave mode.
function installLevel01(game) {
 const CAP=20,WIDTH=6200,HEIGHT=1600,WEAK_HP=18;
 const LIFECYCLE={behindDistance:900,contactGrace:3,retireDelay:2};
 const SETPIECE_PROFILES=['horde-setpiece-20','horde-setpiece-28'],DIRECTED_PROFILE='level01-combat-direction',FRONT_GROUP_ID='stage3c-sector4-front';
 const FRONT_GROUP_POINTS=[['sprout',4230,600],['sprout',4300,600],['sprout',4370,600],['sprout',4230,700],['sprout',4300,700],['sprout',4370,700],['sprout',4230,800],['sprout',4300,800],['sprout',4370,800],['sprout',4230,900],['sprout',4300,900],['spitter',4410,510],['spitter',4410,990],['snapper',4480,800]];
 const isSetpieceProfile=profile=>SETPIECE_PROFILES.includes(profile);
 const stage3d=()=>run?.profile===DIRECTED_PROFILE;
 const stage3cOr3d=()=>isSetpieceProfile(run?.profile)||stage3d();
 const stage3c=()=>isSetpieceProfile(run?.profile);
 const streaming=()=>run?.profile==='level01-streaming'||stage3cOr3d();
 const activeCap=()=>stage3c()&&run.sector===4&&run.profile==='horde-setpiece-28'?28:CAP;
 function firingAtPursuer(p,angle){
  for(const e of game.enemies)if(!e.dead&&e.kind!=='maw'&&e.x<p.x){const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy);if(d>1100||d<1)continue;const diff=Math.atan2(Math.sin(Math.atan2(dy,dx)-angle),Math.cos(Math.atan2(dy,dx)-angle));if(Math.abs(diff)<.44)return true;}
  return false;
 }
 const names=['Прорыв','Инфицированный цех','Корни заражения','Биологический прорыв','Пасть'];
 const edges=[1300,2600,4000,5400],tips=['Прорвись к цеху →','Найди путь через цех →','Уничтожь одно гнездо','Прорвись к Пасти →','Победи Пасть'];
 const counts=[
  {sprout:32,spitter:4,snapper:0},{sprout:26,spitter:5,snapper:5},
  {sprout:16,spitter:3,snapper:3},{sprout:32,spitter:4,snapper:4},
  {sprout:4,spitter:2,snapper:2}
 ];
 const obstacles=[
  {x:820,y:590,r:68},{x:820,y:1020,r:68},
  {x:1700,y:680,r:80},{x:1700,y:990,r:75},{x:2000,y:460,r:65},{x:2000,y:1200,r:65},{x:2230,y:820,r:78},{x:2450,y:510,r:65},{x:2450,y:1120,r:65},
  {x:2850,y:800,r:70},{x:3500,y:800,r:70},{x:3750,y:500,r:68},{x:3750,y:1100,r:68},
  {x:4650,y:540,r:65},{x:4650,y:1060,r:65},{x:5100,y:800,r:70},{x:5700,y:480,r:65},{x:5700,y:1120,r:65}
 ].map((o,i)=>({...o,type:'rock',seed:21+i}));
 const nests=[
  {id:'level01-spore',label:'Гнездо стрелков',role:'ranged',x:3150,y:500,r:38,hp:170,interval:7,budget:3,spawnKinds:['spitter','spitter','spitter'],firstActivation:7},
  {id:'level01-brood',label:'Гнездо преследователей',role:'pursuit',x:3150,y:1100,r:38,hp:170,interval:7,budget:3,spawnKinds:['sprout','snapper','sprout'],firstActivation:7}
 ];
 const copy=x=>JSON.parse(JSON.stringify(x));
 const original={update:game.update.bind(game),startWave:game.startWave.bind(game),schedule:game.updateSpawnSchedule.bind(game),waveCleared:game.waveCleared.bind(game),spawn:game.spawnPlant.bind(game),death:game.onPlantDeath.bind(game),playerDeath:game.onPlayerDeath.bind(game),choose:game.chooseUpgrade.bind(game),report:game.createBalanceReport.bind(game),organEvent:game.organEvent.bind(game),damageNest:game.damageNest.bind(game),nestSchedule:game.updateNestReinforcements.bind(game),spawnEnemyBullet:game.spawnEnemyBullet.bind(game),hurtPlayer:game.hurtPlayer.bind(game),newRun:game.newRun.bind(game)};
 let active=false,run=null,queue=[],spawnClock=0,serial=0,guardReady=false,guardFlags=[],workshopFlags=[],crossfireFlags=[],rootFlags=[],nestClock=0,presenceSample=0,groupsById=new Map(),encountersById=new Map();
 let baseBindings=null;
 function setPreset(next){
  if(active||!['splash','menu'].includes(game.state))return false;
  const input=game.input,fields=['fuse','dig','flipLeft','restart'],candidate={fuse:'KeyF',dig:'KeyR',flipLeft:'KeyG',restart:'KeyB'};
  if(next==='near-wasd'){
   const proposed={...input.bindings,...candidate};
   for(const action of fields)for(const other of Object.keys(proposed))if(action!==other&&proposed[action]===proposed[other]){game.tip='Клавиша '+proposed[action]+' уже занята: сначала переназначь её в настройках.';game.tipT=5;return false;}
   baseBindings=Object.fromEntries(fields.map(k=>[k,input.bindings[k]]));input.bindings=proposed;game.level01Preset='near-wasd';
  } else {
   if(baseBindings)for(const key of fields)input.bindings[key]=baseBindings[key];
   baseBindings=null;game.level01Preset='baseline';
  }
  return true;
 }
 game.level01Preset='baseline';game.setLevel01Preset=setPreset;
 function config(profile){
  const cfg=copy(getBalanceConfig('mass-combat-slice'));
  const dense=profile!=='level01-original',is3c=isSetpieceProfile(profile),is3d=profile===DIRECTED_PROFILE,cap28=profile==='horde-setpiece-28',plans=counts.map((composition,i)=>({name:names[i],kind:i===2?'roots':'stage3a',stage2gScene:'level01',composition,goal:i===2?2:0,maxAlive:is3c&&i===3?(cap28?28:20):dense?[14,16,16,20,20][i]:i===0?8:i<3?10:i===3?16:CAP,batchSize:4,groupGap:.5,tip:tips[i],...(i===2?{nests:copy(nests)}:{}),...(i===4?{boss:true}:{})}));
  cfg.encounters=plans;
  if(is3c)cfg.level01={version:'stage3c-1',profile,economy:'A',cap:CAP,sector4Cap:cap28?28:20,lifecycle:{...LIFECYCLE,sector4Relief:{startAtX:3300,behindDistance:650,contactGrace:2,retireDelay:.75}},pickup:{magnetRadius:130,pullAcceleration:4200,maxPullSpeed:600}};
  else if(is3d)cfg.level01={version:'stage3d-1',profile,economy:'A',cap:CAP,sector4Cap:20,lifecycle:{...LIFECYCLE,sector4Relief:{startAtX:3300,behindDistance:650,contactGrace:2,retireDelay:.75}},pickup:{magnetRadius:130,pullAcceleration:4200,maxPullSpeed:600},encounters:{version:'directed-1'}};
  else cfg.level01=profile==='level01-streaming'?{version:'stage3b-1',profile,economy:'A',cap:CAP,lifecycle:{...LIFECYCLE},pickup:{magnetRadius:130,pullAcceleration:4200,maxPullSpeed:600}}:dense?{version:'stage3a1-1',profile,economy:'A',cap:CAP}:{version:'stage3a-1',economy:'A',cap:CAP};return cfg;
 }
 function roster(index){
  const row=counts[index],result=[],left={...row};
  if(stage3d()){
   const put=(kind,n,groupId,encounterId=groupId)=>{for(let i=0;i<n;i++)result.push({kind,weak:kind==='sprout',groupId,encounterId});};
   if(index===0){
    put('sprout',6,'level01-s1-opening','s1-mass-opening');
    let remaining=26,shot=0;while(remaining){const batch=Math.min(4,remaining);put('sprout',batch,'level01-s1-followup','s1-mass-followup');remaining-=batch;if(shot<4){put('spitter',1,'level01-s1-spitter-'+shot,'s1-spitters');shot++;}}
    return result;
   }
   if(index===1){
    const legacy=[];while(left.sprout||left.spitter||left.snapper)for(const [kind,n]of [['sprout',1],['spitter',1],['sprout',2],['snapper',1]])for(let k=0;k<n&&left[kind]>0;k++,left[kind]--)legacy.push({kind,weak:kind==='sprout'});
    let sprout=0,spitter=0,snapper=0;for(const item of legacy){if(item.kind==='sprout'){sprout++;item.groupId=sprout<=12?'level01-s2-mass-a':'level01-s2-mass-b';item.encounterId=sprout<=12?'s2-mass-a':'s2-mass-b';}else if(item.kind==='spitter'){spitter++;item.groupId=spitter===1?'level01-s2-north-spitter':spitter===2?'level01-s2-south-spitter':'level01-s2-ranged-followup';item.encounterId=spitter<=2?'s2-crossfire':'s2-ranged-followup';}else{snapper++;item.groupId='level01-s2-close-pressure';item.encounterId='s2-close-pressure';}}
    return legacy;
   }
   if(index===2){put('sprout',row.sprout,'level01-s3-mass','s3-root-approach');put('spitter',row.spitter,'level01-s3-ranged','s3-root-approach');put('snapper',row.snapper,'level01-s3-close','s3-root-approach');return result;}
   if(index===3){put('sprout',row.sprout,'level01-s4-mass','s4-followup-mass');put('spitter',row.spitter,'level01-s4-ranged','s4-followup-flank');put('snapper',row.snapper,'level01-s4-close','s4-followup-flank');return result;}
   if(index===4){put('sprout',row.sprout,'level01-s5-support','s5-support');put('spitter',row.spitter,'level01-s5-support','s5-support');put('snapper',row.snapper,'level01-s5-support','s5-support');return result;}
  }
  // Interleave specialists so they do not all wait at the end of a long queue.
  const order=index===1?[['sprout',1],['spitter',1],['sprout',2],['snapper',1]]:[['sprout',4],['spitter',1],['snapper',1]];
  while(left.sprout||left.spitter||left.snapper)for(const [kind,n] of order)for(let k=0;k<n&&left[kind]>0;k++,left[kind]--)result.push({kind,weak:kind==='sprout'});
  return result;
 }
 function guardRoster(profile){return isSetpieceProfile(profile)||profile===DIRECTED_PROFILE?FRONT_GROUP_POINTS.map(([kind])=>({kind,weak:kind==='sprout',groupId:FRONT_GROUP_ID,encounterId:'s4-frontal-breakthrough'})):[...Array.from({length:4},()=>({kind:'sprout',weak:true})),...Array.from({length:2},()=>({kind:'spitter',weak:false}))];}
 function occupied(){let n=0;for(const e of game.enemies)if(!e.dead&&e.kind!=='maw')n++;for(const w of game.spawnWarnings)if(w.kind!=='maw')n++;return n;}
 function encounterRole(id){return id.startsWith('s1-mass')?'mass-kill':id.startsWith('s1-spitters')||id==='s2-crossfire'||id==='s2-ranged-followup'?'crossfire':id.startsWith('s2-mass')?'mass-kill':id.includes('nest')||id.startsWith('s3-')?'nest-choice':id==='s4-frontal-breakthrough'?'horde-breakthrough':id.startsWith('s4-')?'flank-followup':id==='s5-boss'?'boss':id==='s5-support'?'boss-support':'contact';}
 function ensureEncounter(id){if(!stage3d()||!id)return null;let item=encountersById.get(id);if(item)return item;item={id,role:encounterRole(id),planned:0,spawned:0,kills:0,retired:0,byKind:{},killsByKind:{},firstSpawnAt:null,firstVisibleAt:null,firstAttackAt:null,firstContactAt:null,firstPlayerDamageAt:null,contactStartedAt:null,contactEndedAt:null,contactEndReason:null,contactSeconds:0,contactSegments:[],contactReengagements:0,endedAt:null,endReason:null,visibleSeconds:0,noVisibleSeconds:0,activeCombatSeconds:0,enemySeconds:0,maxVisible:0,visible8PlusSeconds:0,visible12PlusSeconds:0,visible16PlusSeconds:0,damageTakenBySource:{},damageAttribution:{exactHits:0,nearestFallbackHits:0},projectilesSpawnedByType:{},incomingHitsByType:{},dashUses:0,drops:[],pickups:[],replacements:[],fusions:[],cards:[],cardTriggers:{},hpAtStart:game.player.hp,handsAtStart:game.player.hands.map(w=>w?{id:w.id,ammo:w.ammo}:null),hpAtEnd:null,handsAtEnd:null,lastThreatAt:null,_liveNow:0,_visibleNow:0,_attackingNow:0,_nearbyNow:0,_contactOpen:false,_contactGap:0};encountersById.set(id,item);run.encounters.push(item);return item;}
 function registerEncounters(items){if(!stage3d())return;for(const item of items)if(item.encounterId)ensureEncounter(item.encounterId).planned++;}
 function pendingForEncounter(id){let count=0;for(const item of queue)if(item.encounterId===id)count++;for(const item of run.guardQueue)if(item.encounterId===id)count++;for(const item of run.rootQueue)if(item.encounterId===id)count++;for(const item of game.spawnWarnings)if(item.level01EncounterId===id)count++;const nestId=id==='s3-spore-defense'?'level01-spore':id==='s3-brood-defense'?'level01-brood':null;if(nestId){const nest=game.nests.find(item=>item.id===nestId);if(nest&&!nest.dead&&(nest.remainingBudget||0)>0)count+=nest.remainingBudget;}return count;}
 function finishEncounter(id,reason='complete'){const item=encountersById.get(id);if(!item||item.endedAt!==null)return;item.endedAt=run.seconds;item.endReason=reason;if(item._contactOpen){item.contactEndedAt=run.seconds;item.contactEndReason=reason;const segment=item.contactSegments.at(-1);if(segment){segment.endedAt=run.seconds;segment.endReason=reason;}item._contactOpen=false;}item.hpAtEnd=game.player.hp;item.handsAtEnd=game.player.hands.map(w=>w?{id:w.id,ammo:w.ammo}:null);if(id==='s5-boss')item.bossTelemetry=copy(game.threat.snapshot().bosses.find(b=>b.id==='maw-1')||null);}
 function recentEncounter(){if(!stage3d()||!run.encounters.length)return null;let best=null,distance=1100;for(const e of game.enemies)if(!e.dead&&e.kind!=='maw'&&e.level01EncounterId){const d=Math.hypot(e.x-game.player.x,e.y-game.player.y);if(d<distance){distance=d;best=encountersById.get(e.level01EncounterId)||null;}}if(best)return best;for(let i=run.encounters.length-1;i>=0;i--){const e=run.encounters[i];if(e.endedAt===null||e.lastThreatAt!==null&&run.seconds-e.lastThreatAt<=4)return e;}return null;}
 function updateEncounterActions(){if(!stage3d())return;const target=recentEncounter(),sources=game.runStats.combat.damageTakenBySource;for(const key of Object.keys(sources))run.damageCursor[key]=sources[key];const dash=game.runStats.combat.dashUses;if(dash>run.dashCursor&&target)target.dashUses+=dash-run.dashCursor;run.dashCursor=dash;const triggers=game.runStats.builds.triggers;for(const key of Object.keys(triggers)){const delta=triggers[key]-(run.triggerCursor[key]||0);if(delta>0&&target)target.cardTriggers[key]=(target.cardTriggers[key]||0)+delta;run.triggerCursor[key]=triggers[key];}while(run.fusionCursor<game.runStats.fusions.length){const fusion=copy(game.runStats.fusions[run.fusionCursor++]),owner=recentEncounter();if(owner)owner.fusions.push(fusion);}}
 game.spawnEnemyBullet=function(x,y,vx,vy,damage,color,size,attack={}){original.spawnEnemyBullet(x,y,vx,vy,damage,color,size,attack);if(!stage3d())return;let closest=null,best=Infinity;for(const enemy of game.enemies)if(!enemy.dead&&enemy.level01EncounterId){const distance=dist2(x,y,enemy.x,enemy.y);if(distance<=(enemy.r+size+4)**2&&distance<best){best=distance;closest=enemy;}}const bullet=game.enemyBullets[game.enemyBullets.length-1];if(closest&&bullet){bullet.level01EncounterId=closest.level01EncounterId;const encounter=encountersById.get(closest.level01EncounterId),key=(attack.sourceKind||'unknown')+':'+(attack.attackType||'single');if(encounter)encounter.projectilesSpawnedByType[key]=(encounter.projectilesSpawnedByType[key]||0)+1;}};
 game.hurtPlayer=function(amount,x,y,source){if(!stage3d())return original.hurtPlayer(amount,x,y,source);const meta=source&&typeof source==='object'?source:null,key=(meta?.sourceKind||'environment')+':'+(meta?.attackType||(source==='Споры вне круга'?'spore':'contact'));let encounterId=meta?.level01EncounterId||((meta?.bossId||meta?.sourceKind==='maw')?'s5-boss':null);if(!encounterId)for(const bullet of game.enemyBullets)if(bullet.sourceKind===meta?.sourceKind&&bullet.attackType===meta?.attackType&&dist2(bullet.x,bullet.y,x,y)<=(bullet.r+1)**2&&bullet.level01EncounterId){encounterId=bullet.level01EncounterId;break;}if(!encounterId&&meta?.sourceKind)for(const enemy of game.enemies)if(!enemy.dead&&enemy.kind===meta.sourceKind&&dist2(enemy.x,enemy.y,x,y)<=(enemy.r+2)**2&&enemy.level01EncounterId){encounterId=enemy.level01EncounterId;break;}const before=game.runStats.combat.damageTakenBySource[key]||0,result=original.hurtPlayer(amount,x,y,source),lost=(game.runStats.combat.damageTakenBySource[key]||0)-before;if(lost>0){const encounter=encountersById.get(encounterId)||(meta?recentEncounter():null);if(encounter){encounter.damageTakenBySource[key]=(encounter.damageTakenBySource[key]||0)+lost;encounter.incomingHitsByType[key]=(encounter.incomingHitsByType[key]||0)+1;encounter.damageAttribution[encounterId?'exactHits':'nearestFallbackHits']++;}}return result;};
 function safe(x,y,kind){
  const r=PLANT_STATS[kind].r,p=game.player;if(x<r+20||x>WIDTH-r-20||y<r+20||y>HEIGHT-r-20||Math.hypot(x-p.x,y-p.y)<p.r+r+110)return false;
  for(const o of LEVEL.obstacles)if(Math.hypot(x-o.x,y-o.y)<o.r+r+15)return false;
  for(const e of game.enemies)if(!e.dead&&Math.hypot(x-e.x,y-e.y)<e.r+r+12)return false;
  for(const w of game.spawnWarnings)if(Math.hypot(x-w.x,y-w.y)<(PLANT_STATS[w.kind]?.r||0)+r+12)return false;
  return true;
 }
 function newPresence(profile,sector){
  return {seconds:0,globalAlive:0,visibleAlive:0,nearbyThreats:0,aheadThreats:0,behindThreats:0,offscreenAlive:0,farThreats:0,freeSlots:0,queueLength:0,warnings:0,enemyBullets:0,groundOrgans:0,enemyBulletsPeak:0,groundOrgansPeak:0,visibleHordeSeconds:0,visibleThreatSeconds:0,activeCombatSeconds:0,spawnBlockedByCap:0,spawnBlockedBySectorCap:0,spawnBlockedByGeometry:profile!=='level01-original'&&sector<5?0:null,geometryFailedSearches:0,scheduleWaitSeconds:0,spawnSearches:0,samples:[]};
 }
 function newSetpiece(profile,sector){
  if(sector!==4||(!isSetpieceProfile(profile)&&profile!==DIRECTED_PROFILE))return null;
  return {profile,cap:profile==='horde-setpiece-28'?28:20,slotsAtBoundary:null,front:{groupId:FRONT_GROUP_ID,planned:14,spawned:0,kills:0,retired:0,firstVisibleAt:null,firstNearAt:null,firstAttackAt:null,firstContactAt:null,unplacedAtBoundary:0},maxVisible:0,visible8PlusSeconds:0,visible12PlusSeconds:0,visible16PlusSeconds:0,aheadThreatSeconds:0,aheadThreatCountSeconds:0,movementDirectionChanges:0,directionEvents:[],dashUsesStart:0,dashUses:0,firingSeconds:0,firingAtPursuersSeconds:0,endReason:null,missedGroups:{unissued:0,capBlockedSeconds:0,geometryFailures:0,queueAtEnd:0,pendingWarningsAtEnd:0,exitedBeforeScheduleComplete:false,primaryCause:null},damageByKind:{}};
 }
 function attachGroup(e,id,sector,encounterId=null){
  if(!e||e.kind==='maw')return;
  let group=groupsById.get(id);if(!group){group={id,sector,encounterId:stage3d()?(encounterId||id):null,createdAt:run.seconds,members:0,kills:0,retired:0,byKind:{},killsByKind:{},firstVisibleAt:null,firstNearAt:null,firstAttackAt:null,firstContactAt:null,firstContactKind:null};groupsById.set(id,group);run.groups.push(group);}
  group.members++;e.level01GroupId=id;e.level01EncounterId=stage3d()?(encounterId||group.encounterId||id):null;group.byKind[e.kind]=(group.byKind[e.kind]||0)+1;
  if(e.level01EncounterId){const encounter=ensureEncounter(e.level01EncounterId);encounter.spawned++;encounter.byKind[e.kind]=(encounter.byKind[e.kind]||0)+1;if(encounter.firstSpawnAt===null)encounter.firstSpawnAt=run.seconds;}
  if(id===FRONT_GROUP_ID&&run.sectors[3]?.setpiece)run.sectors[3].setpiece.front.spawned++;
  const hurt=e.hurt;e.hurt=function(amount,...args){if(amount>0&&!this.dead){if(streaming()){this.lifecycleLastContactAt=run.seconds;markLifecycleCombat(this);}const encounter=this.level01EncounterId&&encountersById.get(this.level01EncounterId);if(encounter&&encounter.firstPlayerDamageAt===null)encounter.firstPlayerDamageAt=run.seconds;}return hurt.call(this,amount,...args);};
 }
 function markLifecycleCombat(e){if(!e.lifecycleEngaged){e.lifecycleEngaged=true;run.lifecycle.enteredCombat++;}}
 function attacking(e){return e.attackWind>0||e.state==='wind'||e.state==='dash'||e.burstRemaining>0||e.chargeWind>0||e.chargeT>0||e.sectorActiveT>0||!!e.coordinatedAttack||!!e.activeSync;}
 function updateLifecycle(dt){
  if(!streaming())return;
  const stats=run.lifecycle,p=game.player,rules=game.balanceConfig.level01.lifecycle,relief=stage3cOr3d()&&run.sector===3&&p.x>=rules.sector4Relief.startAtX,behindDistance=relief?rules.sector4Relief.behindDistance:rules.behindDistance,contactGrace=relief?rules.sector4Relief.contactGrace:rules.contactGrace,retireDelay=relief?rules.sector4Relief.retireDelay:rules.retireDelay,hw=game.vw/(2*game.zoom),hh=game.vh/(2*game.zoom);
  let write=0,simulated=0,retiring=0;
  for(let i=0;i<game.enemies.length;i++){
   const e=game.enemies[i];
   if(e.dead||e.kind==='maw'){game.enemies[write++]=e;continue;}
   if(!e.lifecycleState){e.lifecycleState='active';e.lifecycleLastContactAt=run.seconds;e.lifecycleRetiringSeconds=0;}
   const distance=Math.hypot(e.x-p.x,e.y-p.y),attack=attacking(e);
   if(distance<550||(attack&&distance<700))e.lifecycleLastContactAt=run.seconds;
   if((attack&&distance<700)||distance<e.r+p.r+5)markLifecycleCombat(e);
   const outside=Math.abs(e.x-game.cam.x)>hw+e.r+64||Math.abs(e.y-game.cam.y)>hh+e.r+64;
   const protectedTarget=e.missionRequired||e.priorityTarget||e.isMissionTarget||e.marked||e.isResonator||game.objective?.target===e;
   const eligible=outside&&p.x-e.x-e.r>=behindDistance&&!protectedTarget&&!attack&&run.seconds-e.lifecycleLastContactAt>=contactGrace;
   if(eligible){
    if(e.lifecycleState!=='retiring'){e.lifecycleState='retiring';e.lifecycleRetiringSeconds=0;stats.candidates++;}
    e.lifecycleRetiringSeconds+=dt;
    if(e.lifecycleRetiringSeconds+1e-9>=retireDelay){
     e.lifecycleState='retired';stats.retired++;run.sectors[run.sector-1].retired++;
     const group=e.level01GroupId&&groupsById.get(e.level01GroupId);if(group){group.retired++;if(group.id===FRONT_GROUP_ID&&run.sectors[3]?.setpiece)run.sectors[3].setpiece.front.retired++;}
     const origin=e.level01Sector||run.sector;stats.byOrigin[origin]=(stats.byOrigin[origin]||0)+1;
     if(stats.events.length<128)stats.events.push({at:run.seconds,sector:run.sector,origin,kind:e.kind,x:Math.round(e.x),y:Math.round(e.y),behind:Math.round(p.x-e.x),offscreen:true,lastContactAt:e.lifecycleLastContactAt});else stats.eventOverflow++;
     // Deliberately bypass die/onPlantDeath. No death, drop, pity, objective or VFX events.
     continue;
    }
   }else if(e.lifecycleState==='retiring'){e.lifecycleState='active';e.lifecycleRetiringSeconds=0;stats.cancelled++;}
   simulated++;if(e.lifecycleState==='retiring')retiring++;game.enemies[write++]=e;
  }
  game.enemies.length=write;stats.active=simulated;stats.retiring=retiring;stats.peakActive=Math.max(stats.peakActive,simulated);
 }
 function forwardSpawnPos(kind,metric){
  const p=game.player,r=PLANT_STATS[kind].r,steps=[[270,0],[310,-95],[310,95],[350,-180],[350,180],[245,-160],[245,160],[390,-40],[390,40],[410,-235],[410,235],[220,-215],[220,215]];
  for(let i=0;i<steps.length;i++){
   const offset=steps[(i+serial)%steps.length],x=clamp(p.x+offset[0],r+20,WIDTH-r-20),y=clamp(p.y+offset[1],r+20,HEIGHT-r-20);
   if(safe(x,y,kind))return {x,y};metric.spawnBlockedByGeometry++;
  }
  return null;
 }
 function samplePresence(dt,sector){
  const m=sector.presence,p=game.player,hw=game.vw/(2*game.zoom),hh=game.vh/(2*game.zoom);
  let alive=0,visible=0,near=0,ahead=0,behind=0,far=0,attackThreat=false;
  if(stage3d())for(const encounter of run.encounters){encounter._liveNow=0;encounter._visibleNow=0;encounter._attackingNow=0;encounter._nearbyNow=0;encounter._activeThisTick=false;}
  const sampledGroups=presenceSample<=0?new Map():null;
  for(const e of game.enemies)if(!e.dead&&e.kind!=='maw'){
   const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy),vis=Math.abs(e.x-game.cam.x)<=hw+e.r&&Math.abs(e.y-game.cam.y)<=hh+e.r,closing=(-dx*e.vx-dy*e.vy)>0,attack=e.attackWind>0||e.state==='wind'||e.state==='dash'||e.burstRemaining>0;
   alive++;if(vis)visible++;if(d<550)near++;if(dx>=0&&(vis||(d<800&&closing)))ahead++;if(dx<0)behind++;if(d>=800)far++;if(attack&&d<700)attackThreat=true;
   const group=e.level01GroupId&&groupsById.get(e.level01GroupId);
    if(group){if(vis&&group.firstVisibleAt===null)group.firstVisibleAt=run.seconds;if(d<550&&group.firstNearAt===null)group.firstNearAt=run.seconds;if(attack&&group.firstAttackAt===null)group.firstAttackAt=run.seconds;if(d<e.r+p.r+5&&group.firstContactAt===null){group.firstContactAt=run.seconds;group.firstContactKind='touch';}
     if(group.id===FRONT_GROUP_ID){const front=run.sectors[3]?.setpiece?.front;if(front){if(vis&&front.firstVisibleAt===null){front.firstVisibleAt=run.seconds;if(stage3d()&&!run.frontCueShown){run.frontCueShown=true;game.banner='ОРДА ВПЕРЕДИ';game.bannerSub='Прорывайся к проходу →';game.bannerT=2.4;}}if(d<550&&front.firstNearAt===null)front.firstNearAt=run.seconds;if(attacking(e)&&front.firstAttackAt===null)front.firstAttackAt=run.seconds;if(d<e.r+p.r+5&&front.firstContactAt===null)front.firstContactAt=run.seconds;}}
     const encounter=group.encounterId&&encountersById.get(group.encounterId);if(encounter){encounter._liveNow++;if(vis){encounter._visibleNow++;if(encounter.firstVisibleAt===null)encounter.firstVisibleAt=run.seconds;}if(attack){encounter._attackingNow++;if(encounter.firstAttackAt===null)encounter.firstAttackAt=run.seconds;}if(d<550){encounter._nearbyNow++;if(encounter.firstContactAt===null)encounter.firstContactAt=run.seconds;}}
    if(sampledGroups){const old=sampledGroups.get(group.id);if(!old||d<old.distance)sampledGroups.set(group.id,{id:group.id,distance:Math.round(d),visible:vis,attacking:!!attack});else if(vis)old.visible=true;}
   }
  }
  if(stage3d())for(const e of game.enemies)if(!e.dead&&e.kind==='maw'&&e.level01EncounterId){const encounter=encountersById.get(e.level01EncounterId);if(encounter){const vis=Math.abs(e.x-game.cam.x)<=hw+e.r&&Math.abs(e.y-game.cam.y)<=hh+e.r,d=Math.hypot(e.x-p.x,e.y-p.y),attack=attacking(e);encounter._liveNow++;if(vis){encounter._visibleNow++;if(encounter.firstVisibleAt===null)encounter.firstVisibleAt=run.seconds;}if(attack){encounter._attackingNow++;if(encounter.firstAttackAt===null)encounter.firstAttackAt=run.seconds;}if(d<850){encounter._nearbyNow++;if(encounter.firstContactAt===null)encounter.firstContactAt=run.seconds;}}}
  if(stage3d())for(const encounter of run.encounters)if(encounter.endedAt===null){const seen=encounter._visibleNow,attackingNow=encounter._attackingNow,nearby=encounter._nearbyNow,activeNow=!!(seen||attackingNow||nearby);encounter._activeThisTick=activeNow;encounter.maxVisible=Math.max(encounter.maxVisible,seen);if(encounter.firstVisibleAt!==null){if(seen){encounter.visibleSeconds+=dt;if(seen>=8)encounter.visible8PlusSeconds+=dt;if(seen>=12)encounter.visible12PlusSeconds+=dt;if(seen>=16)encounter.visible16PlusSeconds+=dt;}else encounter.noVisibleSeconds+=dt;}if(activeNow){encounter.activeCombatSeconds+=dt;encounter.contactSeconds+=dt;encounter._contactGap=0;if(!encounter._contactOpen){if(encounter.contactStartedAt===null)encounter.contactStartedAt=run.seconds;else encounter.contactReengagements++;encounter.contactSegments.push({startedAt:run.seconds,endedAt:null,endReason:null});encounter._contactOpen=true;}}else if(encounter._contactOpen){encounter._contactGap+=dt;if(encounter._contactGap>=1){encounter.contactEndedAt=run.seconds;encounter.contactEndReason="contact-lost";const segment=encounter.contactSegments.at(-1);if(segment){segment.endedAt=run.seconds;segment.endReason=encounter.contactEndReason;}encounter._contactOpen=false;}}encounter.enemySeconds+=encounter._liveNow*dt;if(activeNow)encounter.lastThreatAt=run.seconds;const pending=pendingForEncounter(encounter.id);if(encounter._liveNow===0&&pending===0&&encounter.firstSpawnAt!==null)finishEncounter(encounter.id,'all-spawned-members-resolved');}
  if(stage3d()&&run.encounters.some(encounter=>encounter._activeThisTick))run.encounterCombatUnionSeconds+=dt;
  let bulletThreat=false;for(const b of game.enemyBullets)if(!b.dead&&Math.hypot(b.x-p.x,b.y-p.y)<250){bulletThreat=true;break;}
  let ground=0;for(const loot of game.pickups)if(!loot.dead&&loot.type==='weapon')ground++;m.enemyBullets+=game.enemyBullets.length*dt;m.groundOrgans+=ground*dt;m.enemyBulletsPeak=Math.max(m.enemyBulletsPeak,game.enemyBullets.length);m.groundOrgansPeak=Math.max(m.groundOrgansPeak,ground);if(streaming()){run.lifecycle.active=alive;run.lifecycle.retiring=0;for(const e of game.enemies)if(!e.dead&&e.lifecycleState==='retiring')run.lifecycle.retiring++;run.lifecycle.peakActive=Math.max(run.lifecycle.peakActive,alive);}
  m.seconds+=dt;m.globalAlive+=alive*dt;m.visibleAlive+=visible*dt;m.nearbyThreats+=near*dt;m.aheadThreats+=ahead*dt;m.behindThreats+=behind*dt;m.offscreenAlive+=(alive-visible)*dt;m.farThreats+=far*dt;m.freeSlots+=Math.max(0,activeCap()-occupied())*dt;m.queueLength+=queue.length*dt;m.warnings+=game.spawnWarnings.length*dt;
  const setpiece=stage3cOr3d()&&sector.index===4?sector.setpiece:null;
  if(setpiece){setpiece.maxVisible=Math.max(setpiece.maxVisible,visible);if(visible>=8)setpiece.visible8PlusSeconds+=dt;if(visible>=12)setpiece.visible12PlusSeconds+=dt;if(visible>=16)setpiece.visible16PlusSeconds+=dt;if(ahead>0)setpiece.aheadThreatSeconds+=dt;setpiece.aheadThreatCountSeconds+=ahead*dt;
   const pad=game.input.pad,move=game.input.moveVector(run.directionScratch);let mx=pad.active&&Math.hypot(pad.moveX,pad.moveY)>.15?pad.moveX:move.x,my=pad.active&&Math.hypot(pad.moveX,pad.moveY)>.15?pad.moveY:move.y;
   if(Math.hypot(mx,my)>.15){const direction=(Math.round((Math.atan2(my,mx)+Math.PI*2)/(Math.PI/4))%8);if(run.lastMoveDirection===null)run.lastMoveDirection=direction;else if(run.lastMoveDirection!==direction){if(run.moveCandidate!==direction){run.moveCandidate=direction;run.moveCandidateSeconds=dt;}else run.moveCandidateSeconds+=dt;if(run.moveCandidateSeconds>=.18){setpiece.movementDirectionChanges++;if(setpiece.directionEvents.length<64)setpiece.directionEvents.push({at:Math.round(run.seconds*100)/100,from:run.lastMoveDirection,to:direction});run.lastMoveDirection=direction;run.moveCandidate=null;run.moveCandidateSeconds=0;}}else{run.moveCandidate=null;run.moveCandidateSeconds=0;}}else{run.lastMoveDirection=null;run.moveCandidate=null;run.moveCandidateSeconds=0;}
   const firingL=!!p.firingL,firingR=!!p.firingR;if(firingL||firingR){setpiece.firingSeconds+=dt;if((firingL&&firingAtPursuer(p,p.aimLeft))||(firingR&&firingAtPursuer(p,p.aimRight)))setpiece.firingAtPursuersSeconds+=dt;}
   const dash=game.runStats.combat?.dashUses||0;setpiece.dashUses=Math.max(0,dash-setpiece.dashUsesStart);
  }
  if(visible>=8)m.visibleHordeSeconds+=dt;if(visible>0)m.visibleThreatSeconds+=dt;if((visible>0&&(p.firingL||p.firingR))||attackThreat||bulletThreat)m.activeCombatSeconds+=dt;
  presenceSample-=dt;if(sampledGroups){presenceSample=1;if(m.samples.length<1200)m.samples.push({at:run.seconds,globalAlive:alive,visibleAlive:visible,nearbyThreats:near,aheadThreats:ahead,behindThreats:behind,offscreenAlive:alive-visible,farThreats:far,freeSlots:Math.max(0,activeCap()-occupied()),queueLength:queue.length,warnings:game.spawnWarnings.length,enemyBullets:game.enemyBullets.length,groundOrgans:ground,retired:run.lifecycle.retired,retiring:run.lifecycle.retiring,groups:[...sampledGroups.values()]});}
 }
 function spawnDirect(x,y,item,origin,groupId=item.groupId){
  if(occupied()>=activeCap()||!safe(x,y,item.kind))return false;
  const e=original.spawn(x,y,item.kind);e.level01Sector=origin;e.level01Weak=item.weak;if(item.weak)e.hp=e.maxHp=WEAK_HP;attachGroup(e,groupId||'direct-'+origin+'-'+run.seconds.toFixed(3),origin,item.encounterId);
  run.sectors[origin-1].spawned++;game.recordCombatValue('spawnedEnemies');return true;
 }
 function preplaceOpening(){
  const points=stage3d()?[[540,700],[600,740],[660,780],[600,840],[660,880],[720,800]]:[[540,650],[570,750],[570,850],[540,950],[670,700],[670,900],[750,620],[750,980]];
  for(const [x,y] of points){const i=queue.findIndex(e=>e.kind==='sprout');if(i>=0&&spawnDirect(x,y,queue[i],1))queue.splice(i,1);}
 }
 function preplaceWorkshop(){
  if(stage3d()||run.sector!==1||game.player.x<800)return;
  const points=[['sprout',1500,600],['spitter',1500,1000]];
  for(let i=0;i<points.length;i++)if(!workshopFlags[i]){
   const [kind,x,y]=points[i],index=run.workshopQueue.findIndex(item=>item.kind===kind);
   if(index<0){workshopFlags[i]=true;continue;}
   if(spawnDirect(x,y,run.workshopQueue[index],2)){workshopFlags[i]=true;run.workshopQueue.splice(index,1);}
  }
 }
 function preplaceCrossfire(){
  if(!stage3d()||run.sector!==2||game.player.x<1350)return;
  const points=[['level01-s2-north-spitter',1860,420],['level01-s2-south-spitter',2380,1320]];
  for(let i=0;i<points.length;i++)if(!crossfireFlags[i]){const [groupId,x,y]=points[i],index=queue.findIndex(item=>item.groupId===groupId);if(index<0){crossfireFlags[i]=true;continue;}if(spawnDirect(x,y,queue[index],2,groupId)){crossfireFlags[i]=true;queue.splice(index,1);}}
 }
 function preplaceGuard(){
  if(guardReady||run.sector!==3||game.player.x<(stage3cOr3d()?3200:3600))return;
  const points=stage3cOr3d()?FRONT_GROUP_POINTS:[['sprout',4210,650],['sprout',4280,650],['sprout',4210,850],['sprout',4280,850],['spitter',4380,550],['spitter',4380,1030]];
  const reserve=run.guardQueue;
  for(let i=0;i<points.length;i++)if(!guardFlags[i]){
   const [kind,x,y]=points[i],idx=reserve.findIndex(item=>item.kind===kind&&(!stage3cOr3d()||item.groupId===FRONT_GROUP_ID));
   if(idx<0){guardFlags[i]=true;continue;}
   if(spawnDirect(x,y,reserve[idx],4,stage3cOr3d()?FRONT_GROUP_ID:undefined)){guardFlags[i]=true;reserve.splice(idx,1);}
  }
  guardReady=reserve.length===0;
 }
 function preplaceRoots(){
  if(run.profile==='level01-original'||run.sector!==2||game.player.x<2200)return;
  const points=[['spitter',2970,470],['sprout',2970,600],['sprout',2980,1020],['snapper',2970,1180]];
  for(let i=0;i<points.length;i++)if(!rootFlags[i]){
   const [kind,x,y]=points[i],index=run.rootQueue.findIndex(item=>item.kind===kind);
   if(index<0){rootFlags[i]=true;continue;}
   if(spawnDirect(x,y,run.rootQueue[index],3)){rootFlags[i]=true;run.rootQueue.splice(index,1);}
  }
 }
 function stateSnapshot(){
  return {at:run.seconds,hp:game.player.hp,hands:game.player.hands.map(w=>w?{id:w.id,ammo:w.ammo,origin:w.origin}:null),cards:game.player.build.slice(),mutations:copy(game.player.mods)};
 }
 function delta(current,baseline){const result={};for(const [key,value] of Object.entries(current))result[key]=Math.max(0,value-(baseline[key]||0));return result;}
 function finishSector(reason='transition'){
  const sector=run.sectors[run.sector-1];if(sector.endedAt!==null)return;
  sector.endedAt=run.seconds;sector.resultState=stateSnapshot();sector.unissued=queue.length+(run.sector===3?0:run.sector===4?run.guardQueue.length:0);
  sector.remainingAlive=game.enemies.filter(e=>!e.dead&&e.level01Sector===run.sector).length;
  sector.pendingWarnings=game.spawnWarnings.filter(w=>w.level01Sector===run.sector).length;
  sector.damageBySource=delta(game.runStats.combat.damageTakenBySource,sector.damageStart);sector.triggers=delta(game.runStats.builds.triggers,sector.triggersStart);
  if(sector.setpiece){const setpiece=sector.setpiece,missed=setpiece.missedGroups,unfinished=queue.length+sector.pendingWarnings>0;const byKind=setpiece.damageByKind={};for(const [key,value] of Object.entries(sector.damageBySource)){const kind=key.split(':')[0];byKind[kind]=(byKind[kind]||0)+value;}setpiece.firingAtPursuersRatio=setpiece.firingSeconds?setpiece.firingAtPursuersSeconds/setpiece.firingSeconds:0;setpiece.endReason=reason;missed.unissued=sector.unissued;missed.queueAtEnd=queue.length;missed.pendingWarningsAtEnd=sector.pendingWarnings;missed.capBlockedSeconds=sector.presence.spawnBlockedByCap;missed.geometryFailures=sector.presence.geometryFailedSearches;missed.exitedBeforeScheduleComplete=reason==='player-exit'&&unfinished;missed.primaryCause=missed.exitedBeforeScheduleComplete?'player advanced beyond the sector before its finite spawn schedule ended':unfinished?'combat ended before the finite spawn schedule ended':null;}
  sector.fusions=game.runStats.fusions.map((fusion,i)=>({...copy(fusion),shotsInSector:Math.max(0,(fusion.shots||0)-(sector.fusionShotsStart[i]||0))}));sector.secondsClass=sector.seconds<5?'very-short':sector.seconds>120?'long':'normal';
 }
 function applyWave(n){
  const hpBudget=game.player.regenBudget,vamp=game.player.vampirismBudget,oldNests=game.nests;
  original.startWave(n);game.player.regenBudget=hpBudget;game.player.vampirismBudget=vamp;game.spawnQueue=[];game.currentWaveStats.name=names[n-1];
  if(n>=4)game.nests=oldNests;
  run.sector=n;run.phase='combat';queue=roster(n-1);spawnClock=0;
  if(n===4&&stage3cOr3d()){const setpiece=run.sectors[3].setpiece,used=occupied();setpiece.slotsAtBoundary={occupied:used,capacity:activeCap(),free:Math.max(0,activeCap()-used),warnings:game.spawnWarnings.filter(w=>w.kind!=='maw').length};setpiece.front.unplacedAtBoundary=run.guardQueue.length;setpiece.dashUsesStart=game.runStats.combat?.dashUses||0;}
  if(n===2){for(let i=0;i<workshopFlags.length;i++)if(workshopFlags[i]){const kind=i===0?'sprout':'spitter',index=queue.findIndex(q=>q.kind===kind);if(index>=0)queue.splice(index,1);}run.workshopQueue=[];}
  if(n===3&&run.profile!=='level01-original'){for(let i=0;i<rootFlags.length;i++)if(rootFlags[i]){const kind=['spitter','sprout','sprout','snapper'][i],index=queue.findIndex(q=>q.kind===kind);if(index>=0)queue.splice(index,1);}run.rootQueue=[];}
  if(n===4){for(const item of run.guardQueue){const index=queue.findIndex(q=>q.kind===item.kind&&q.weak===item.weak);if(index>=0)queue.splice(index,1);}for(let i=0;i<guardFlags.length;i++)if(guardFlags[i]){const kind=stage3cOr3d()?FRONT_GROUP_POINTS[i][0]:i<4?'sprout':'spitter',weak=kind==='sprout',index=queue.findIndex(q=>q.kind===kind&&q.weak===weak);if(index>=0)queue.splice(index,1);}queue.push(...run.guardQueue);run.guardQueue=[];}
  if(n===5){
   if(stage3d())registerEncounters(queue);
   const boss=original.spawn(5780,800,'maw');run.bossStarted=run.seconds;if(stage3d()){boss.level01EncounterId='s5-boss';const encounter=ensureEncounter('s5-boss');encounter.spawned++;encounter.planned++;encounter.firstSpawnAt=run.seconds;}
   for(const [kind,x,y] of [['sprout',5580,700],['sprout',5580,900],['spitter',5680,620],['spitter',5680,980]]){
    const index=queue.findIndex(item=>item.kind===kind);
    if(index>=0&&spawnDirect(x,y,queue[index],5))queue.splice(index,1);
   }
  }
  if(stage3d()&&n!==5)registerEncounters(queue.filter(item=>item.encounterId!=='s4-frontal-breakthrough'));
  game.banner='СЕКТОР '+n+' · '+names[n-1].toUpperCase();game.bannerSub=tips[n-1];game.bannerT=3;game.tip=tips[n-1];game.tipT=5;
  const sector=run.sectors[n-1];sector.startedAt=run.seconds;sector.initial=stateSnapshot();sector.damageStart=copy(game.runStats.combat.damageTakenBySource);sector.triggersStart=copy(game.runStats.builds.triggers);sector.fusionShotsStart=game.runStats.fusions.map(f=>f.shots||0);
 }
 function card(next){
  finishSector('mission-advance');run.phase='card';run.nextSector=next;
  const keep={enemies:game.enemies,enemyBullets:game.enemyBullets,bullets:game.bullets,spawnWarnings:game.spawnWarnings,effects:game.effects,nests:game.nests};
  original.waveCleared();Object.assign(game,keep);
 }
 function begin(seed=game.seed,profile='level01-combat-direction'){
  if(!['level01-original','level01-density-test','level01-streaming',DIRECTED_PROFILE,...SETPIECE_PROFILES].includes(profile))throw Error('Unknown Level 01 profile');
  active=false;game.balanceProfileLocked=false;game.playtestBalanceConfiguration=null;game.balanceConfigId='mass-combat-slice';game.seed=seed;game.reset();
  LEVEL=new Level(WIDTH,HEIGHT,2);LEVEL.obstacles=copy(obstacles);if(game.biology)game.biology.dispose();game.biology=new BiologyFX(WIDTH,HEIGHT);
  const dx=250-game.player.x;game.player.x=250;game.player.y=800;for(const p of game.pickups)p.x+=dx;game.updateCamera(1,true);
  const cfg=config(profile);game.balanceConfig=cfg;game.playtestBalanceConfiguration=cfg;game.balanceProfileLocked=true;game.state='playing';game.sfx.ensure();
  run={version:profile===DIRECTED_PROFILE?'stage3d-1':isSetpieceProfile(profile)?'stage3c-1':profile==='level01-streaming'?'stage3b-1':profile==='level01-original'?'stage3a-1':'stage3a1-1',profile,seed,sector:1,phase:'combat',seconds:0,bossStarted:null,bossDefeated:false,bossLifetime:null,cards:[],groups:[],encounters:[],encounterCombatUnionSeconds:0,openingMassKillSeen:false,frontCueShown:false,damageCursor:copy(game.runStats.combat.damageTakenBySource),dashCursor:game.runStats.combat.dashUses,triggerCursor:copy(game.runStats.builds.triggers),fusionCursor:0,lifecycle:{active:0,retiring:0,retired:0,enteredCombat:0,candidates:0,cancelled:0,peakActive:0,byOrigin:{},events:[],eventOverflow:0},performance:{frames:0,wallSeconds:0,droppedSeconds:0,drawMs:[],updateMs:[],frameMs:[],aiMs:[],aiTicks:0,aiTotalMs:0},workshopQueue:[{kind:'sprout',weak:true},{kind:'spitter',weak:false}],rootQueue:profile===DIRECTED_PROFILE?[{kind:'spitter',weak:false,groupId:'level01-s3-spore-guard-a',encounterId:'s3-spore-defense'},{kind:'sprout',weak:true,groupId:'level01-s3-spore-guard-b',encounterId:'s3-spore-defense'},{kind:'sprout',weak:true,groupId:'level01-s3-brood-guard-a',encounterId:'s3-brood-defense'},{kind:'snapper',weak:false,groupId:'level01-s3-brood-guard-b',encounterId:'s3-brood-defense'}]:[{kind:'spitter',weak:false},{kind:'sprout',weak:true},{kind:'sprout',weak:true},{kind:'snapper',weak:false}],guardQueue:guardRoster(profile),directionScratch:{x:0,y:0},lastMoveDirection:null,moveCandidate:null,moveCandidateSeconds:0,sectors:names.map((name,i)=>({index:i+1,name,retired:0,startedAt:null,endedAt:null,seconds:0,kills:0,spawned:0,peakAlive:0,massSeconds:0,noVisibleSeconds:0,drySeconds:0,damageTaken:0,presence:newPresence(profile,i+1),setpiece:newSetpiece(profile,i+1),cardActiveSeconds:{},drops:[],pickups:[],cards:[],initial:null,resultState:null,unissued:null,remainingAlive:null,pendingWarnings:null,damageStart:{},triggersStart:{},fusionShotsStart:[],damageBySource:null,triggers:null,fusions:null,secondsClass:null}))};
  active=true;guardReady=false;guardFlags=Array(isSetpieceProfile(profile)||profile===DIRECTED_PROFILE?FRONT_GROUP_POINTS.length:6).fill(false);workshopFlags=Array(2).fill(false);crossfireFlags=Array(2).fill(false);rootFlags=Array(4).fill(false);groupsById=new Map();encountersById=new Map();presenceSample=0;nestClock=0;serial=0;game.level01=api;if(stage3d()){registerEncounters(run.rootQueue);registerEncounters(run.guardQueue);}applyWave(1);preplaceOpening();return run;
 }
 game.startLevel01=(profile=DIRECTED_PROFILE)=>begin(game.seed,profile);
 game.newRun=function(randomize){if(!active)return original.newRun(randomize);if(randomize)game.seed=((Date.now()^Math.floor(Math.random()*0xffffffff))>>>0)||1;return begin(game.seed,run.profile);};
 game.startWave=function(n){if(active&&run.phase==='card'&&n===run.nextSector){applyWave(n);return;}return original.startWave(n);};
 game.chooseUpgrade=function(i){
  const card=active&&run?.phase==='card'?game.cards[i]:null,oldSector=run?.sector,result=original.choose(i);
  if(card&&active){const row={at:run.seconds,afterSector:oldSector,name:card.name,key:cardKey(card),triggersAtChoice:copy(game.runStats.builds.triggers)};if(run.phase==='combat'){run.cards.push(row);run.sectors[oldSector-1].cards.push(row);}if(stage3d()){const encounter=recentEncounter();if(encounter)encounter.cards.push(row);}}
  return result;
 };
 game.waveCleared=function(){if(active&&run?.phase==='combat'){game.missionCompletePending=false;return;}return original.waveCleared();};
 game.updateSpawnSchedule=function(dt){
  if(!active||run?.phase!=='combat')return active?undefined:original.schedule(dt);
  const dense=run.profile!=='level01-original',limit=stage3c()&&run.sector===4?activeCap():dense?[14,16,16,20,20][run.sector-1]:run.sector===1?8:run.sector===2||run.sector===3&&!guardReady?10:run.sector===3||run.sector===4?16:CAP,m=run.sectors[run.sector-1].presence;
  spawnClock-=dt;
  if(stage3d()&&run.sector===1&&queue[0]?.kind==='spitter'&&!run.openingMassKillSeen){m.scheduleWaitSeconds+=dt;return;}
  if(queue.length){const used=occupied();if(used>=activeCap())m.spawnBlockedByCap+=dt;else if(used>=limit)m.spawnBlockedBySectorCap+=dt;else if(spawnClock>0)m.scheduleWaitSeconds+=dt;}
  if(spawnClock>0||!queue.length)return;
  let made=0;const batchId='batch-'+run.sector+'-'+serial;
  while(queue.length&&occupied()<limit&&made<4){
   const item=queue[0];m.spawnSearches++;const pos=dense&&run.sector<5?forwardSpawnPos(item.kind,m):game.findSpawnPos(item.kind);if(!pos){m.geometryFailedSearches++;break;}
   game.spawnWarnings.push({...pos,kind:item.kind,t:.8,level01Sector:run.sector,level01Weak:item.weak,level01GroupId:item.groupId||batchId,level01EncounterId:item.encounterId||null,level01Serial:serial++});queue.shift();made++;
  }
  if(made)game.recordCombatValue('spawnGroups');spawnClock=.4;
 };
 game.spawnPlant=function(x,y,kind){
  if(!active)return original.spawn(x,y,kind);
  const warning=game.spawnWarnings.find(w=>w.t<=0&&w.kind===kind&&w.x===x&&w.y===y),e=original.spawn(x,y,kind);
  if(warning?.level01Sector){e.level01Sector=warning.level01Sector;e.level01Weak=warning.level01Weak;if(e.level01Weak)e.hp=e.maxHp=WEAK_HP;run.sectors[e.level01Sector-1].spawned++;attachGroup(e,warning.level01GroupId||'warning-'+warning.level01Serial,e.level01Sector,warning.level01EncounterId);}
  else if(warning?.sourceNestId)attachGroup(e,'nest-'+warning.sourceNestId+'-'+warning.activationIndex,run.sector,stage3d()?(warning.sourceNestId==='level01-spore'?'s3-spore-defense':'s3-brood-defense'):null);
  return e;
 };
 game.onPlantDeath=function(e,meta){
  const previous=game.level01PendingEncounterId;if(stage3d())game.level01PendingEncounterId=e.level01EncounterId||null;let result;try{result=original.death(e,meta);}finally{game.level01PendingEncounterId=previous;}if(active&&run?.phase==='combat'){run.sectors[run.sector-1].kills++;if(e.kind==='maw'){run.bossDefeated=true;if(stage3d()){const encounter=encountersById.get('s5-boss');if(encounter){encounter.kills++;encounter.killsByKind.maw=(encounter.killsByKind.maw||0)+1;}finishEncounter('s5-boss','boss-defeated');}}if(stage3d()&&['s1-mass-opening','s1-mass-followup'].includes(e.level01EncounterId))run.openingMassKillSeen=true;const group=e.level01GroupId&&groupsById.get(e.level01GroupId);if(group){group.kills++;group.killsByKind[e.kind]=(group.killsByKind[e.kind]||0)+1;if(group.encounterId&&encountersById.has(group.encounterId))encountersById.get(group.encounterId).kills++;if(group.id===FRONT_GROUP_ID&&run.sectors[3]?.setpiece)run.sectors[3].setpiece.front.kills++;}}return result;
 };
 game.onPlayerDeath=function(){if(active&&run?.phase==='combat'){finishSector('player-death');if(stage3d())for(const encounter of run.encounters)finishEncounter(encounter.id,'player-death');run.phase='defeat';}return original.playerDeath();};
 game.createBalanceReport=function(){const report=original.report();if(active&&run)report.level01=api.snapshot();return report;};
 game.organEvent=function(type,detail){
  original.organEvent(type,detail);if(!active||!run)return;
  const sector=run.sectors[run.sector-1],row={at:run.seconds,...detail},encounter=stage3d()?encountersById.get(game.level01PendingEncounterId)||recentEncounter():null;
  if(type==='offer'&&detail.origin?.type==='enemy'){sector.drops.push(row);if(encounter)encounter.drops.push(row);}else if(type==='pickup'){sector.pickups.push(row);if(encounter){encounter.pickups.push(row);if(detail.replaced)encounter.replacements.push(row);}}else if(type==='card'){sector.cards.push(row);if(encounter)encounter.cards.push(row);}
 };
 game.damageNest=function(...args){const result=original.damageNest(...args);if(active&&run?.sector===3){const nest=args[0],amount=args[1],encounter=stage3d()?encountersById.get(nest?.id==='level01-spore'?'s3-spore-defense':'s3-brood-defense'):null;if(encounter&&amount>0){encounter.objectiveDamage=(encounter.objectiveDamage||0)+amount;if(nest.dead&&!(encounter.objectivesDestroyed||0)){encounter.objectivesDestroyed=1;encounter.objectiveDestroyedAt=run.seconds;}}game.missionCompletePending=false;if(game.nests.some(n=>n.dead)){game.tip='Путь открыт → · второе гнездо можно уничтожить';game.tipT=3;}}return result;};
 game.updateNestReinforcements=function(dt){
  if(!active||!run||!game.nests.some(n=>!n.dead))return original.nestSchedule(dt);
  const useRoots=run.sector>=4,kind=game.encounter.kind,seconds=game.currentWaveStats.seconds,before=game.spawnWarnings.length;if(useRoots){game.encounter.kind='roots';game.currentWaveStats.seconds=nestClock;}
  try{return original.nestSchedule(dt);}finally{if(stage3d())for(let i=before;i<game.spawnWarnings.length;i++){const warning=game.spawnWarnings[i];if(warning.sourceNestId){const encounter=ensureEncounter(warning.sourceNestId==='level01-spore'?'s3-spore-defense':'s3-brood-defense');encounter.planned++;}}if(useRoots){game.encounter.kind=kind;game.currentWaveStats.seconds=seconds;}}
 };
 game.update=function(dt){
  if(!active)return original.update(dt);
  if(run.phase==='combat'&&(run.profile==='level01-original'||game.state==='playing')){preplaceWorkshop();preplaceCrossfire();preplaceRoots();preplaceGuard();}
  for(const w of game.spawnWarnings)if(w.level01Sector&&w.t<=dt&&Math.hypot(w.x-game.player.x,w.y-game.player.y)<PLANT_STATS[w.kind].r+game.player.r+90)w.t=dt+.2;
  const playing=game.state==='playing',beforeDamage=game.runStats.damageTaken;if(playing&&run.phase==='combat')updateLifecycle(dt);const result=original.update(dt);if(stage3d())updateEncounterActions();
  if(playing&&run.phase==='combat'){
   const sector=run.sectors[run.sector-1];run.seconds+=dt;sector.seconds+=dt;sector.damageTaken+=Math.max(0,game.runStats.damageTaken-beforeDamage);if(run.sector>=3)nestClock+=dt;
   for(let i=0;i<run.cards.length;i++){const key=String(i)+':'+run.cards[i].key;sector.cardActiveSeconds[key]=(sector.cardActiveSeconds[key]||0)+dt;}
   let alive=0,visible=false;const hw=game.vw/(2*game.zoom),hh=game.vh/(2*game.zoom);
   for(const e of game.enemies)if(!e.dead){if(e.kind!=='maw')alive++;if(Math.abs(e.x-game.cam.x)<hw+e.r&&Math.abs(e.y-game.cam.y)<hh+e.r)visible=true;}
   sector.peakAlive=Math.max(sector.peakAlive,alive);if(alive>=8)sector.massSeconds+=dt;if(!visible)sector.noVisibleSeconds+=dt;
   if(game.player.hands.every(w=>!w||w.empty))sector.drySeconds+=dt;
   samplePresence(dt,sector);
   if(game.player.alive&&!game.outcome){
    if(run.sector===1&&game.player.x>=edges[0])card(2);
    else if(run.sector===2&&game.player.x>=edges[1]){finishSector('player-exit');game.finishWaveStats(true);applyWave(3);}
    else if(run.sector===3&&game.player.x>=edges[2]&&game.nests.some(n=>n.dead)){preplaceGuard();card(4);}
    else if(run.sector===4&&game.player.x>=edges[3]){finishSector('player-exit');game.finishWaveStats(true);applyWave(5);}
    else if(run.sector===5&&run.bossDefeated){run.bossLifetime=run.seconds-run.bossStarted;finishSector('boss-defeated');game.finishWaveStats(true);run.phase='complete';game.waveActive=false;game.outcome='victory';game.endReason='Пасть повержена';game.state='victory';game.saveBalanceReport();game.sfx.victory();}
   }
  }
  if(game.outcome==='defeat'&&run.phase==='combat'){finishSector('player-death');run.phase='defeat';}
  if(game.outcome==='victory'&&run.phase==='complete'&&stage3d())for(const encounter of run.encounters)finishEncounter(encounter.id,'run-complete');
  return result;
 };
 const api={begin,configuration:config,setPreset,recordAI(ms){if(!active||!run||run.phase!=='combat')return;const p=run.performance;p.aiTicks++;p.aiTotalMs+=ms;if(p.aiMs.length<12000)p.aiMs.push(ms);else p.aiMs[p.aiTicks%12000]=ms;},get state(){return run;},recordFrame(seconds,updateMs,drawMs,dropped){if(!active||!run||run.phase!=='combat'||game.state!=='playing')return;const p=run.performance;p.frames++;p.wallSeconds+=seconds;p.droppedSeconds+=dropped;if(p.updateMs.length<12000){p.updateMs.push(updateMs);p.drawMs.push(drawMs);p.frameMs.push(seconds*1000);}else{const i=p.frames%12000;p.updateMs[i]=updateMs;p.drawMs[i]=drawMs;p.frameMs[i]=seconds*1000;}},snapshot(){if(!run)return null;const result=copy(run);result.lifecycle.active=0;result.lifecycle.retiring=0;for(const e of game.enemies)if(!e.dead&&e.kind!=='maw'){result.lifecycle.active++;if(e.lifecycleState==='retiring')result.lifecycle.retiring++;}const p=result.performance,percentile=a=>{a.sort((x,y)=>x-y);return a.length?a[Math.ceil(.95*a.length)-1]:0;};p.averageFps=p.wallSeconds?p.frames/p.wallSeconds:0;p.updateMsP95=percentile(p.updateMs);p.drawMsP95=percentile(p.drawMs);p.frameMsP95=percentile(p.frameMs);p.aiMsP95=percentile(p.aiMs);p.aiMsMean=p.aiTicks?p.aiTotalMs/p.aiTicks:0;delete p.updateMs;delete p.drawMs;delete p.frameMs;delete p.aiMs;result.nests=game.nests.map(n=>({id:n.id,dead:n.dead,remainingBudget:n.remainingBudget,telemetry:copy(n.telemetry)}));if(stage3d()){const byRole={};for(const encounter of result.encounters){for(const field of ['_liveNow','_visibleNow','_attackingNow','_nearbyNow','_activeThisTick'])delete encounter[field];byRole[encounter.role]=(byRole[encounter.role]||0)+encounter.activeCombatSeconds;}result.encounterSummary={combatUnionSeconds:run.encounterCombatUnionSeconds,combatUnionShare:run.seconds?run.encounterCombatUnionSeconds/run.seconds:0,byRoleActiveSeconds:byRole,overlapMayCountMoreThanRunSeconds:true};result.bossTelemetry=copy(game.threat.snapshot().bosses);}result.outcome=game.outcome;return result;},get targetX(){return run&&run.sector<5?edges[run.sector-1]:null;}};
 return api;
}
