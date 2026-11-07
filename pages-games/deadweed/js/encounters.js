// Сценарии встреч и мутации меняют задачу, а не только количество HP.
'use strict';
const ENCOUNTERS = [
 { name:'Пробуждение', count:6, kinds:['sprout'], kind:'clear', tip:'Удерживай огонь. Пустая рука сама подберёт оружие.' },
 { name:'Перекрёстный огонь', count:8, kinds:['sprout','spitter','sprout'], kind:'clear', limit:35, tip:'Прячься от оранжевых семян. Бонус за зачистку за 35 с.' },
 { name:'Натиск', count:8, kinds:['snapper','sprout','sprout'], kind:'clear', limit:35, tip:'Рывок спасает от прыжка. Оранжевый контур — подготовка.' },
 { name:'Колючий сад', count:10, kinds:['thorn','spitter','sprout'], kind:'clear', limit:40, tip:'Сначала убери кусты. Стрелки укажут последних врагов.' },
 { name:'Хозяин сада', count:5, kinds:['sprout','spitter'], boss:true, kind:'clear', tip:'Босс готовит круговой залп. Не подходи к пасти.' },
 { name:'Охота', count:10, kinds:['snapper','sprout','spitter'], kind:'hunt', tip:'Уничтожь три отмеченные цели — охота закончится.' },
 { name:'Круг жизни', count:12, kinds:['sprout','spitter','snapper'], kind:'hold', goal:16, tip:'Удерживай светлый круг 16 с. Выходить из него можно.' },
 { name:'Блуждающие споры', count:14, kinds:['snapper','spitter'], kind:'survive', goal:24, tip:'Следуй за кругом 24 с. За его пределами споры жгут.' },
 { name:'Быстрая жатва', count:16, kinds:['sprout','snapper','spitter'], kind:'clear', limit:32, tip:'Убийства цепочкой дают больше очков. Бонус за 32 с.' },
 { name:'Сердце болота', count:5, kinds:['sprout','snapper'], boss:true, kind:'clear', tip:'На половине HP босс меняет атаки. Лови окно после залпа.' },
];

// Stage 2C starts from a frozen baseline and exposes isolated balance variants
// through ?balance=baseline|pressure|pressure-health|pressure-supply.
const PRESSURE_ENCOUNTERS = [
 {name:'Пробуждение',composition:{sprout:8,spitter:1},kind:'clear',maxAlive:8,batchSize:3,groupGap:2.2,tip:'Ростки сближаются, слюна держит дистанцию. Следи за янтарным прицелом.'},
 {name:'Перекрёстный огонь',composition:{sprout:8,spitter:6},kind:'clear',maxAlive:8,batchSize:3,groupGap:2.1,limit:45,tip:'Стрелки и ростки заходят группами. Уходи с линии залпа.'},
 {name:'Натиск',composition:{sprout:6,snapper:5,spitter:4},kind:'clear',maxAlive:12,batchSize:4,groupGap:1.9,limit:48,tip:'Прыгуны закрывают путь, слюнники держат дальние углы.'},
 {name:'Колючий сад',composition:{thorn:4,spitter:7,sprout:7},kind:'clear',maxAlive:14,batchSize:4,groupGap:1.8,limit:55,tip:'Кусты перекрывают линии отхода. Уведи врагов с узких проходов.'},
 {name:'Хозяин сада',composition:{maw:1,sprout:5,spitter:4},kind:'clear',maxAlive:16,batchSize:4,groupGap:1.6,boss:true,tip:'Пасть готовит кольцо; стрелки поддерживают её с флангов.'},
 {name:'Охота',composition:{snapper:7,sprout:7,spitter:8},kind:'hunt',goal:3,maxAlive:16,batchSize:4,groupGap:1.5,tip:'Уничтожь три отмеченные цели среди охраны и стрелков.'},
 {name:'Круг жизни',composition:{sprout:8,spitter:8,snapper:8,thorn:2},kind:'hold',goal:24,maxAlive:20,batchSize:5,groupGap:1.4,reinforcementBudget:8,tip:'Удерживай круг 24 с. Подкрепление спорит за зону ограниченными группами.'},
 {name:'Блуждающие споры',composition:{snapper:10,spitter:10,thorn:4},kind:'survive',goal:30,maxAlive:22,batchSize:5,groupGap:1.3,reinforcementBudget:10,tip:'Следуй за кругом 30 с. Прыгуны загоняют, кусты простреливают маршрут.'},
 {name:'Быстрая жатва',composition:{sprout:10,snapper:9,spitter:9,thorn:4},kind:'clear',maxAlive:24,batchSize:5,groupGap:1.2,limit:50,tip:'Четыре типа угроз заходят группами; ищи просвет между линиями.'},
 {name:'Сердце болота',composition:{maw:1,sprout:6,snapper:5,spitter:5,thorn:3},kind:'clear',maxAlive:26,batchSize:5,groupGap:1.1,boss:true,tip:'Пасть меняет атаки, пока поддержка закрывает фланги.'},
].map(plan=>({...plan,count:Object.values(plan.composition).reduce((sum,n)=>sum+n,0)}));

function expandEncounterComposition(plan) {
 if(!plan?.composition)return Array.from({length:plan?.count||0},(_,i)=>plan.kinds[i%plan.kinds.length]);
 if(plan.resonatorReplacement){
  const originalComposition={...plan.composition,spitter:(plan.composition.spitter||0)+(plan.composition.resonator||0)};delete originalComposition.resonator;
  const original=expandEncounterComposition({...plan,resonatorReplacement:false,resonatorOpeningGroup:false,stage2f1OpeningGroup:false,composition:originalComposition});let replacements=plan.composition.resonator||0;
  for(let i=0;i<original.length&&replacements>0;i++)if(original[i]==='spitter'){original[i]='resonator';replacements--;}
  if(replacements)throw Error('Resonator replacement has no Spitter to replace');
  return orderStage2F1Opening(plan,original);
 }
 const remaining={...plan.composition},kinds=Object.keys(remaining),queue=[];
 while(kinds.some(kind=>remaining[kind]>0))for(const kind of kinds)if(remaining[kind]>0){queue.push(kind);remaining[kind]--;}
 return orderStage2F1Opening(plan,queue);
}

function orderStage2F1Opening(plan,queue){
 if(!plan.resonatorOpeningGroup&&!plan.stage2f1OpeningGroup)return queue;
 const kinds=plan.composition.resonator||queue.includes('resonator')?['resonator','spitter','spitter']:['spitter','spitter','spitter'],opening=[];
 for(const kind of kinds){const index=queue.indexOf(kind);if(index<0)throw Error('Stage 2F.1 opening group is missing '+kind);opening.push(queue.splice(index,1)[0]);}
 return opening.concat(queue);
}

const BALANCE_CONFIGS = {
 baseline:{id:'baseline',ruleset:'genetic-builds-5',encounters:ENCOUNTERS,healthDropChance:.22,weaponDropMultiplier:1,pityAfterMisses:3,resourcePity:false},
 pressure:{id:'pressure',ruleset:'genetic-builds-5+pressure-2c',encounters:PRESSURE_ENCOUNTERS,healthDropChance:.22,weaponDropMultiplier:1,pityAfterMisses:3,resourcePity:false},
 'pressure-health':{id:'pressure-health',ruleset:'genetic-builds-5+pressure-health-2c',encounters:PRESSURE_ENCOUNTERS,healthDropChance:.10,weaponDropMultiplier:1,pityAfterMisses:3,resourcePity:false},
 'pressure-supply':{id:'pressure-supply',ruleset:'genetic-builds-5+pressure-supply-2c',encounters:PRESSURE_ENCOUNTERS,healthDropChance:.10,weaponDropMultiplier:.45,pityAfterMisses:4,resourcePity:true,lowAmmoRatio:.2,nearbyOrganRadius:280},
};
const BALANCE_CONFIG_VERSION='stage2c-1';
for(const [id,sustain,boss] of [['sustain-test',true,false],['boss-test',false,true],['sustain-boss-test',true,true]]) {
 BALANCE_CONFIGS[id]={...BALANCE_CONFIGS['pressure-health'],id,ruleset:'genetic-builds-5+stage2d-'+id,version:'stage2d-1',
  ...(sustain?{sustain:{armorMultiplier:.88,vampirismFirstBudget:18,vampirismRepeatBudget:12}}:{}),
  ...(boss?{boss:{firstHp:800,finalHp:1200,firstPhaseAt:.7,finalPhaseAt:.55,wind:.9,enragedWind:.75,recovery:.85,finalComboGap:.75,phaseResponseDelay:.1,chargeWind:.55,chargeLockWind:.28,chargeDuration:.45,chargeSpeed:560}}:{})};
}
BALANCE_CONFIGS['sustain-boss2e-test']={...BALANCE_CONFIGS['sustain-test'],id:'sustain-boss2e-test',ruleset:'genetic-builds-5+stage2e-meaningful-boss',version:'stage2e-1',
 boss:{firstHp:450,finalHp:473,firstPhaseAt:.7,finalPhaseAt:.55,wind:.9,enragedWind:.75,recovery:.85,finalComboGap:.75,phaseResponseDelay:.1,chargeWind:.55,chargeLockWind:.28,chargeDuration:.45,chargeSpeed:560,behavior:'meaningful',glandHp:120,glandDisableSeconds:6,sectorWind:.9,sectorRange:420,sectorHalfAngle:.4,sectorDamage:1.15}};
const THREAT_PRIORITY_ENCOUNTERS=BALANCE_CONFIGS['sustain-boss2e-test'].encounters.map((plan,index)=>{
 if(![2,3,5].includes(index))return plan;
 const composition={...plan.composition,spitter:plan.composition.spitter-1,resonator:1};
 if(composition.spitter===0)delete composition.spitter;
 return {...plan,composition,resonatorReplacement:true,count:Object.values(composition).reduce((sum,n)=>sum+n,0)};
});
const THREAT_PRIORITY_V2_ENCOUNTERS=BALANCE_CONFIGS['sustain-boss2e-test'].encounters.map((plan,index)=>{
 if(![2,3,5].includes(index))return plan;
 const composition={...plan.composition,spitter:plan.composition.spitter-1,resonator:1};
 if(composition.spitter===0)delete composition.spitter;
 return {...plan,composition,resonatorReplacement:true,resonatorOpeningGroup:true,count:Object.values(composition).reduce((sum,n)=>sum+n,0)};
});
const HUNT_SEQUENTIAL_ENCOUNTERS=BALANCE_CONFIGS['sustain-boss2e-test'].encounters.map((plan,index)=>index===5?{...plan,huntMode:'sequential'}:plan);
const stage2eBase=BALANCE_CONFIGS['sustain-boss2e-test'];
BALANCE_CONFIGS['mass-combat-slice']={...stage2eBase,id:'mass-combat-slice',ruleset:'genetic-builds-5+stage2l-mass-combat',version:'stage2l-1'};
BALANCE_CONFIGS['threat-priority-test']={...stage2eBase,id:'threat-priority-test',ruleset:'genetic-builds-5+stage2f-threat-priority',version:'stage2f-1',encounters:THREAT_PRIORITY_ENCOUNTERS};
BALANCE_CONFIGS['threat-priority-v2']={...stage2eBase,id:'threat-priority-v2',ruleset:'genetic-builds-5+stage2f-resonator-v2',version:'stage2f1-1',encounters:THREAT_PRIORITY_V2_ENCOUNTERS};
BALANCE_CONFIGS['hunt-sequential-test']={...stage2eBase,id:'hunt-sequential-test',ruleset:'genetic-builds-5+stage2f-hunt-sequential',version:'stage2f-hunt-1',encounters:HUNT_SEQUENTIAL_ENCOUNTERS};
const BALANCE_PROFILE_NAMES={baseline:'Baseline · контроль',pressure:'Pressure · боевое давление','pressure-health':'Pressure + меньше лечения','pressure-supply':'Pressure + ограниченное снабжение'};
Object.assign(BALANCE_PROFILE_NAMES,{'sustain-test':'Sustain · бюджет лечения и защита','boss-test':'Boss · угроза Пасти','sustain-boss-test':'Sustain + Boss · совместный эксперимент','sustain-boss2e-test':'Stage 2E · Sustain + значимый босс','threat-priority-test':'Stage 2F · Резонатор и синхронный огонь','threat-priority-v2':'Stage 2F.1 · ранний перекрёстный залп','hunt-sequential-test':'Stage 2F · последовательная Охота'});
BALANCE_PROFILE_NAMES['mass-combat-slice']='Stage 2L · массовый непрерывный бой';
function balanceManifest(id,configuration=getBalanceConfig(id)) {
 if(!Object.hasOwn(BALANCE_CONFIGS,id)||configuration.id!==id)throw Error('Unknown or mismatched balance profile: '+id);
 return {id,name:BALANCE_PROFILE_NAMES[id],version:configuration.version||BALANCE_CONFIG_VERSION,ruleset:configuration.ruleset,configuration:JSON.parse(JSON.stringify(configuration))};
}
function getBalanceConfig(id){return BALANCE_CONFIGS[id]||BALANCE_CONFIGS['pressure-supply'];}
const MUTATIONS = [
 {id:'boneBounce',name:'Костяной рикошет',desc:'Кость отскакивает от одного камня. Стреляй из-за угла.',apply:g=>{g.player.mods.boneBounce=true;}},
 {id:'thornPierce',name:'Нить шипов',desc:'Шип пробивает ещё 2 цели. Собирай врагов в линию.',apply:g=>{g.player.mods.thornPierce=true;}},
 {id:'seedSlug',name:'Плотный стручок',desc:'Зев: три зуба веером 0,12. −20% прямого и взрывного урона залпа за точность.',apply:g=>{g.player.mods.seedSlug=true;}},
 {id:'spitterSlow',name:'Липкая пыльца',desc:'Слюнник замедляет цель на 35% на 1,5 с.',apply:g=>{g.player.mods.spitterSlow=true;}},
 {id:'globEcho',name:'Гнилое эхо',desc:'Желчь: первый взрыв снаряда повторяется через 0,4 с с 65% урона. Не каждый контакт.',apply:g=>{g.player.mods.globEcho=true;}},
 {id:'relay',name:'Метка второй руки',desc:'Прямое попадание метит на 1,8 с. Первый контакт другого залпа другой руки: +50%. Взрывы не метят.',apply:g=>{g.player.mods.relay=true;}},
];

const MUTATION_GENES={boneBounce:'bone',thornPierce:'thorn',seedSlug:'seedshot',spitterSlow:'spitter',globEcho:'glob'};
function cardKey(c){return c.id||c.name;}
function buildDirections(p){return Object.entries(MUTATION_GENES).filter(([id])=>p.mods[id]).map(([,gene])=>gene);}
function cardWeight(c,p){const links={boneBounce:['thornPierce'],thornPierce:['globEcho','seedSlug','boneBounce'],seedSlug:['thornPierce','spitterSlow'],spitterSlow:['seedSlug','relay'],globEcho:['thornPierce'],relay:['spitterSlow']};return (links[c.id]||[]).some(id=>p.mods[id])?1.8:1;}
function offerCards(p,mode='uniform'){
 const common=UPGRADES.filter(c=>(c.name!=='Гильдия охотников'||p.hands.some(w=>w&&w.ammo>0))&&(c.name!=='Лёгкий рывок'||p.dashCooldown>.400001));
 const mutations=MUTATIONS.filter(c=>!p.mods[c.id]),pool=common.concat(mutations),result=[];
 const take=(eligible,weighted)=>{if(!eligible.length)return;const total=eligible.reduce((n,c)=>n+(weighted?cardWeight(c,p):1),0);let roll=random01()*total;let chosen=eligible.at(-1);for(const c of eligible){roll-=weighted?cardWeight(c,p):1;if(roll<0){chosen=c;break;}}result.push(chosen);pool.splice(pool.indexOf(chosen),1);};
 if(mode==='mixed'){take(common,false);take(mutations,true);}
 while(result.length<3&&pool.length)take(pool,mode==='weighted');
 return result;
}
function createBuildStats(){return {version:1,algorithm:'uniform',choices:[],offered:{},chosen:{},eligibleSeconds:{},firingSeconds:{},genesUsed:{},triggers:{},extraDamage:{relay:0,echo:0},segments:[]};}
function buildTrigger(g,id,amount=1){const b=g.runStats.builds;if(b)b.triggers[id]=(b.triggers[id]||0)+amount;}
function cardContext(c,p){
 if(c.name==='Вампирский голод'&&p.sustainRules){const cap=vampirismCapacity(p);return cap===null||cap===0?'18 HP на встречу; повтор: +12 к бюджету и +3 за убийство':'Сейчас '+cap+' HP на встречу; повтор: +12 и +3 за убийство';}
 if(c.name==='Толстый череп')return 'Защита сейчас '+((1-(p.dmgTakenMul||1))*100).toFixed(1)+'%; повтор умножает урон на '+(p.sustainRules?.armorMultiplier??.8);
 const gene=MUTATION_GENES[c.id],names={bone:'кость',thorn:'шип',seedshot:'зев',spitter:'слюна',glob:'желчь'},genes=buildDirections(p);
 if(c.id==='relay')return p.mods.spitterSlow?'Связка: замедленная цель удобнее для второй руки':'Две заряженные руки; merge временно лишает связки';
 if(gene){const held=p.hands.some(w=>w&&(w.def.genes||[w.id]).includes(gene));return 'Ген: '+names[gene]+(held?' · носитель в руках':' · ищи носитель')+(c.id==='globEcho'&&p.mods.thornPierce?' · эхо не повторяет все пробития':c.id==='thornPierce'&&p.mods.globEcho?' · контакты взрывают, эхо только первое':c.id==='seedSlug'&&p.mods.spitterSlow?' · узкий пучок переносит замедление':genes.length?' · сохраняется при смене носителя':'');}
 if(c.name==='Гильдия охотников')return 'Полный заряд обоих органов и ёмкость ×1,5';
 if(c.name==='Гнилая регенерация')return 'Бюджет 16 HP на встречу; убийство возвращает 2';
 if(c.name==='Быстрые пальцы')return 'Быстрее расходует конечный заряд'+(p.mods.relay?' · чаще окно второй руки':'');
 if(c.name==='Острые кости')return p.mods.globEcho?'Усиливает прямой урон, взрыв и эхо':'Прямой урон и взрывы ×1,15';
 if(c.name==='Глубокие карманы')return 'Только свежие органы; merge не выдаёт бонус повторно';
 return 'Сохраняется при смене органов';
}
function cardCopy(c,p){if(p?.sustainRules){if(c.name==='Толстый череп')return '−12% получаемого урона. Повтор: ещё ×0,88.';if(c.name==='Вампирский голод')return '+3 HP за убийство; бюджет 18 HP на встречу. Повтор: +3 и +12 к бюджету.';}return ({seedSlug:'Зев: 3 зуба, веер 0,12. −20% урона залпа.',globEcho:'Желчь: эхо 65% / 0,4 с. Одно на снаряд.',relay:'Л ↔ П: +50% первому прямому контакту за 1,8 с. Взрывы — нет.'})[c.id]||c.desc;}
