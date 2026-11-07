// weapons.js — определения оружия и класс Weapon (конечный боезапас, стрельба)
'use strict';

const WEAPON_DEFS = {
  bone: {
    id: 'bone',
    name: 'Костомозг',
    short: 'МОЗГ',
    desc: 'Костный мозг выращивает зубы; хрящевой затвор выталкивает их с тяжёлым толчком.',
    dmg: 29, rate: 2.8, pellets: 1, spread: 0.025,
    speed: 1050, mag: 6, reserve: 12,
    color: '#efe6c8', size: 4, sound: 'pistol',
    recoil: 1.15, knock: 105,
  },
  spitter: {
    id: 'spitter',
    name: 'Слюнник',
    short: 'СЛЮНА',
    desc: 'Слюнная железа сжимается очередями, выплёвывая живые семена.',
    dmg: 9, rate: 9, pellets: 1, spread: 0.2,
    speed: 860, mag: 18, reserve: 36,
    color: '#9be08a', size: 3, sound: 'smg',
    recoil: 0.2, knock: 38,
  },
  seedshot: {
    id: 'seedshot',
    name: 'Выводковый зев',
    short: 'ЗЕВ',
    desc: 'Три лепестка раскрывают пасть и разом выбрасывают выводок спор.',
    dmg: 11, rate: 1.15, pellets: 7, spread: 0.62,
    speed: 720, mag: 4, reserve: 12,
    color: '#d9b23a', size: 4, sound: 'shotgun',
    recoil: 2.35, knock: 155,
  },
  thorn: {
    id: 'thorn',
    name: 'Сухожильник',
    short: 'ЖИЛА',
    desc: 'Натянутое сухожилие запускает хребтовый шип сквозь две цели.',
    dmg: 58, rate: 1.1, pellets: 1, spread: 0.006,
    speed: 1900, mag: 3, reserve: 7,
    color: '#e08040', size: 5, sound: 'bow',
    recoil: 1.7, knock: 190, pierce: 1,
  },
  glob: {
    id: 'glob',
    name: 'Желчный пузырь',
    short: 'ЖЕЛЧЬ',
    desc: 'Пульсирующий мешок отрывает желчный узел; при ударе тот лопается.',
    dmg: 65, rate: 0.65, pellets: 1, spread: 0.05,
    speed: 520, mag: 2, reserve: 4,
    color: '#93d167', size: 9, sound: 'glob',
    recoil: 2.8, knock: 135, explode: 90, explodeDmg: 78,
  },
};

const WEAPON_IDS = Object.keys(WEAPON_DEFS);
const WEAPON_RULESET='genetic-builds-5';
// Conditional on an existing weapon drop. The drop roll and pity remain separate.
const ORGAN_ORIGINS={
 sprout:[.28,.25,.20,.15,.12],snapper:[.24,.12,.32,.18,.14],
 spitter:[.12,.38,.14,.12,.24],thorn:[.18,.12,.12,.44,.14],maw:[.12,.12,.20,.20,.36],
};
const ORGAN_SOURCE_NAMES={sprout:'росток',snapper:'хищник',spitter:'стрелок',thorn:'шипастый куст',maw:'пасть'};
function chooseOrgan(kind){const weights=ORGAN_ORIGINS[kind];if(!weights)return pick(WEAPON_IDS);let roll=random01();for(let i=0;i<weights.length;i++){roll-=weights[i];if(roll<0)return WEAPON_IDS[i];}return WEAPON_IDS[WEAPON_IDS.length-1];}

// Только базовые органы выпадают из врагов. Сплавы выращиваются игроком.
const FUSION_NAMES = {
 'bone+bone':['Костный собор','Сросшийся мозг выталкивает пару зубов.'],
 'bone+spitter':['Зубная слюна','Слюнная железа разгоняет костяную крошку.'],
 'bone+seedshot':['Челюстной выводок','Костные лепестки выкашливают веер зубов.'],
 'bone+thorn':['Позвоночный гарпун','Сухожилие проталкивает зуб сквозь плоть.'],
 'bone+glob':['Костяной нарыв','Желчный узел несёт осколки костного мозга.'],
 'spitter+spitter':['Двойная глотка','Две железы пульсируют в одном ритме.'],
 'spitter+seedshot':['Роевая трахея','Каждый плевок выпускает малый выводок.'],
 'spitter+thorn':['Игольная гортань','Железа выплёвывает очереди сквозных игл.'],
 'spitter+glob':['Желчная слюна','Мелкие желчные узлы лопаются частой очередью.'],
 'seedshot+seedshot':['Маточный зев','Двойной выводок вырывается из широкой пасти.'],
 'seedshot+thorn':['Рёберный веер','Веер рёбер пронзает плотные группы.'],
 'seedshot+glob':['Гнойный выводок','Три желчных яйца разлетаются из зева.'],
 'thorn+thorn':['Хребтовая струна','Два сухожилия протягивают шип через целый ряд.'],
 'thorn+glob':['Желчный гарпун','Сквозной шип несёт взрывной желчный узел.'],
 'glob+glob':['Двухкамерное сердце','Сросшиеся пузыри выбрасывают тяжёлый двойной узел.'],
};
function fusionId(a,b) {
 const pair=[a,b].sort((x,y)=>WEAPON_IDS.indexOf(x)-WEAPON_IDS.indexOf(y));
 return WEAPON_IDS.includes(a)&&WEAPON_IDS.includes(b) ? 'fusion_'+pair.join('_') : null;
}
for(let i=0;i<WEAPON_IDS.length;i++) for(let j=i;j<WEAPON_IDS.length;j++) {
 const a=WEAPON_DEFS[WEAPON_IDS[i]],b=WEAPON_DEFS[WEAPON_IDS[j]],genes=[a.id,b.id];
 const [name,desc]=FUSION_NAMES[genes.join('+')],id=fusionId(a.id,b.id);
 const explosive=genes.includes('glob'), shotgun=genes.includes('seedshot');
 const pellets=shotgun ? (explosive?3:Math.min(10,Math.max(a.pellets,b.pellets)+1)) : a.id===b.id && !explosive?2:1;
 const rate=+(Math.sqrt(a.rate*b.rate)*.9).toFixed(2);
 const dmg=+(Math.sqrt(a.dmg*b.dmg)*(pellets>1 && !shotgun?.72:1.15)).toFixed(1);
 const cap=1; // Replaced below by the parents' damage budget.
 WEAPON_DEFS[id]={id,name,short:'СПЛАВ',desc,genes,fused:true,dmg,rate,pellets,
  spread:shotgun?.4:genes.includes('thorn')?.05:.14,
  speed:Math.round(Math.sqrt(a.speed*b.speed)),mag:cap,reserve:0,
  color:'#e8a5c1',size:explosive?7:4,sound:explosive?'glob':shotgun?'shotgun':a.sound,
  recoil:+((a.recoil+b.recoil)*.65).toFixed(2),knock:Math.round((a.knock+b.knock)*.65),
  pierce:genes.includes('thorn')?(a.id===b.id?3:1):0,
  explode:explosive?(a.id===b.id?115:shotgun?48:65):0,
  explodeDmg:explosive?(a.id===b.id?110:shotgun?30:45):0};
 const def=WEAPON_DEFS[id];
 if(id==='fusion_bone_seedshot')Object.assign(def,{pellets:5,spread:.18,pattern:'fan',desc:'Пять зубов расходятся ровным узким веером. Сохраняй дистанцию, веди центральным зубом.'});
 if(id==='fusion_spitter_seedshot')Object.assign(def,{pellets:3,rate:4.2,spread:.30,pattern:'braid',desc:'Три быстрых плевка переплетают полосы огня; ген железы переносит липкую пыльцу.'});
 if(id==='fusion_glob_glob')Object.assign(def,{pellets:2,dmg:37.4,explodeDmg:55,explode:100,spread:.28,pattern:'fan',desc:'Два расходящихся узла накрывают фланги; центр пуст. Для малой одиночной цели смести прицел под одну камеру.'});
 def.mag=Math.ceil(((a.mag+a.reserve)*weaponChargeDamage(a)+(b.mag+b.reserve)*weaponChargeDamage(b))*1.1/weaponChargeDamage(def));
}
const FUSION_ROLES={
 fusion_bone_bone:'Парные зубы · экономия одной руки',fusion_bone_spitter:'Длительный точный огонь',
 fusion_bone_seedshot:'Средняя дистанция · ровный веер',fusion_bone_thorn:'Длинная линия · кость и пробитие',
 fusion_bone_glob:'Костный удар с малым взрывом',fusion_spitter_spitter:'Частые парные плевки',
 fusion_spitter_seedshot:'Подавление трёх полос',fusion_spitter_thorn:'Частое пробитие и замедление',
 fusion_spitter_glob:'Частые малые взрывы',fusion_seedshot_seedshot:'Долгий ближний выводок',
 fusion_seedshot_thorn:'Рёберный веер сквозь группу',fusion_seedshot_glob:'Три взрыва в ближнем веере',
 fusion_thorn_thorn:'Глубокое пробитие рядов',fusion_thorn_glob:'Взрыв на каждом контакте шипа',
 fusion_glob_glob:'Два фланга · пустой центр',
};
function shotAngle(shot,index,angle,weapon){
 if(shot.pattern==='random')return angle+rand(-shot.spread/2,shot.spread/2);
 const phase=shot.pattern==='braid'?(weapon.ammo%2?-.04:.04):0;
 return angle+phase+(shot.pellets===1?0:(index/(shot.pellets-1)-.5)*shot.spread);
}
// Raw direct + single-target splash damage, before accuracy, mutations and upgrades.
function weaponChargeDamage(def) {return def.pellets*(def.dmg+(def.explodeDmg||0));}
// Actual discharge contract. Nominal merge resources deliberately use the raw
// definition above; relay and echo are conditional, not guaranteed DPS.
function weaponHasGene(def,gene) {return def.genes?def.genes.includes(gene):def.id===gene;}
function effectiveShot(weapon,player,out=null) {
 const def=weapon.def||weapon,mods=player.mods||{},slug=weaponHasGene(def,'seedshot')&&mods.seedSlug;
 const dmgMul=player.dmgMul??1,compression=slug?def.pellets*.8/3:1;
 const shot=out||{};
 shot.pellets=slug?3:def.pellets;shot.dmg=def.dmg*compression*dmgMul;shot.rate=def.rate*(player.fireRateMul??1);shot.spread=slug?.12:def.spread;shot.pattern=slug?'fan':def.pattern||'random';
 shot.speed=def.speed;shot.knock=def.knock;shot.recoil=def.recoil;shot.pierce=(def.pierce||0)+(weaponHasGene(def,'thorn')&&mods.thornPierce?2:0);
 shot.explode=def.explode||0;shot.explodeDmg=(def.explodeDmg||0)*compression*dmgMul;shot.slow=!!(weaponHasGene(def,'spitter')&&mods.spitterSlow);
 shot.bounce=weaponHasGene(def,'bone')&&mods.boneBounce?1:0;shot.echo=!!(weaponHasGene(def,'glob')&&mods.globEcho);shot.relay=!!mods.relay;shot.slug=!!slug;
 return shot;
}
function shotSummary(shot) {
 const n=value=>Number(value.toFixed(2));
 return n(shot.dmg)+' × '+shot.pellets+' · '+n(shot.rate)+'/с · разброс '+n(shot.spread)+(shot.pierce?' · целей '+(shot.pierce+1):'')+(shot.explode?' · взрыв '+n(shot.explodeDmg)+' / R'+shot.explode:'');
}
function shotEffects(shot) {
 return [shot.slug?'Три зуба · −20% урона залпа · веер 0,12':null,shot.slow?'Замедление 35% / 1,5 с':null,shot.bounce?'Рикошет ×'+shot.bounce:null,shot.echo?'Эхо 65% / 0,4 с · первый взрыв снаряда':null,shot.relay?'Связка: +50% первому прямому контакту другой руки':null].filter(Boolean).join(' · ');
}
function fusionPreview(left,right,out=null) {
 if(!left || !right || left.empty || right.empty)return null;
 const id=fusionId(left.id,right.id);if(!id)return null;
 const def=WEAPON_DEFS[id],perCharge=weaponChargeDamage(def);
 const sourceDamage=left.ammo*weaponChargeDamage(left.def)+right.ammo*weaponChargeDamage(right.def);
 const sourceCapacity=left.cap*weaponChargeDamage(left.def)+right.cap*weaponChargeDamage(right.def);
 const ammo=Math.ceil(sourceDamage*1.1/perCharge),cap=Math.ceil(sourceCapacity*1.1/perCharge);
 const preview=out||{};
 preview.id=id;preview.def=def;preview.ammo=ammo;preview.cap=cap;preview.sourceDamage=sourceDamage;preview.resultDamage=ammo*perCharge;
 return preview;
}

class Weapon {
  constructor(id, ammo, ammoBonus = 0, capacity) {
    const def = WEAPON_DEFS[id];
    this.id = id;
    this.def = def;
    this.bonus = ammoBonus || 0;
    // всего патронов навсегда: перезарядки нет, нужно брать новое оружие
    this.cap = Math.max(1, Math.round((def.mag + def.reserve) * (1 + this.bonus * 0.15)));
    if(Number.isFinite(capacity))this.cap=Math.max(1,Math.round(capacity));
    this.ammo = ammo !== undefined ? clamp(ammo, 0, this.cap) : this.cap;
    this.cool = 0;
    this.flash = 0;
    this.pulseT = 0;
    this.visualKick=0;
    this.muzzleScratch={x:0,y:0};
  }

  get empty() { return this.ammo <= 0; }

  update(dt) {
    this.pulseT += dt;
    this.visualKick*=Math.exp(-dt*(this.id==='bone'?18:28));
    this.cool -= dt;
    if (this.flash > 0) this.flash -= dt;
  }

  canFire() {
    return this.cool <= 1e-9 && this.ammo > 0;
  }

  // выстрел: возвращает true, если выстрел состоялся
  fire(dmgMul = 1, fireRateMul = 1) {
    if (!this.canFire()) return false;
    this.ammo--;
    this.cool += 1 / Math.max(.0001,this.def.rate * fireRateMul);
    this.flash=this.id==='bone'?.085:this.id==='spitter'?.045:.06;
    this.visualKick=this.id==='bone'?7:this.id==='spitter'?2.5:0;
    return true;
  }

  // Позиция выходного канала органа.
  muzzlePos(hx,hy,angle,out=null) {
    const length=this.id==='thorn'?30:this.id==='glob'?20:29;
    const point=out||{};point.x=hx+Math.cos(angle)*length;point.y=hy+Math.sin(angle)*length;return point;
  }

  draw(ctx,x,y,angle,scale=1) {
    ctx.save();ctx.translate(x-Math.cos(angle)*this.visualKick,y-Math.sin(angle)*this.visualKick);ctx.rotate(angle);
    const compress=this.id==='spitter'?this.visualKick*.04:this.visualKick*.006;
    ctx.scale(1-compress,1+compress*.6);
    drawOrganicWeapon(ctx,this.id,0,0,0,scale*(this.def.fused?1.14:1),this.flash>0?1:Math.sin(this.pulseT*4)*.6);ctx.restore();
    if(this.flash>0) {
      const p=this.muzzlePos(x,y,angle,this.muzzleScratch),bone=this.id==='bone',spitter=this.id==='spitter';
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.globalAlpha=clamp(this.flash/(bone?.085:.06),0,1);
      ctx.fillStyle=bone?'rgba(250,217,151,.17)':'rgba(181,222,131,.15)';ctx.beginPath();ctx.ellipse(1,0,bone?19:9,bone?13:7,0,0,TAU);ctx.fill();
      ctx.fillStyle=bone?'#fff0c7':spitter?'#ddf5ab':'#fff2bc';ctx.beginPath();ctx.moveTo(-3,-3);ctx.lineTo(bone?17:8,0);ctx.lineTo(-3,3);ctx.lineTo(1,0);ctx.closePath();ctx.fill();ctx.restore();
    }
  }
}

function drawOrganicWeapon(ctx,id,x,y,angle=0,scale=1,pulse=0) {
 if(typeof drawArtWeapon==='function'&&drawArtWeapon(ctx,id,x,y,angle,scale,pulse))return;
 const def=WEAPON_DEFS[id];if(!def)return;
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
 ctx.lineCap='round';ctx.lineJoin='round';
 const genes=def.genes||[id],fused=!!def.fused;
 ctx.strokeStyle='#293b32';ctx.lineWidth=2;
 const organ=(cx,cy,rx,ry,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,TAU);ctx.fill();ctx.stroke();};
 // Common graft: nerve root, vascular membrane and bone clamp.
 ctx.strokeStyle='#b67d8d';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-7,10);ctx.quadraticCurveTo(-14,-3,2,0);ctx.stroke();
 ctx.strokeStyle='#293b32';ctx.lineWidth=2;
 if(fused)organ(4,7,15,7+pulse,'#814c71');
 organ(6,0,16,7+pulse,fused?'#a45e83':'#7b986f');
 if(genes.includes('bone')) {
  ctx.strokeStyle='#e8dfbf';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-2,0);ctx.quadraticCurveTo(12,-5,28,0);ctx.stroke();
  ctx.lineWidth=2;ctx.strokeStyle='#293b32';organ(6,-1,7,8,'#c4b8a0');
  for(let i=0;i<3;i++)organ(4+i*4,-2,1.5,3,'#765b65');
 }
 if(genes.includes('spitter')) {
  for(let i=0;i<3;i++)organ(1+i*7,-5,5,5+pulse,'#9cbf79');
  organ(26,0,6,5,'#acc88b');organ(29,0,2,3,'#453745');
 }
 if(genes.includes('seedshot')) {
  for(let i=-1;i<=1;i++){organ(15,i*6,13,4,'#b39469');organ(27,i*6,5,3,'#dfb88b');organ(29,i*6,2,1.5,'#5a3b48');}
 }
 if(genes.includes('thorn')) {
  ctx.lineWidth=4;ctx.strokeStyle='#d9b28e';ctx.beginPath();ctx.moveTo(12,-19);ctx.quadraticCurveTo(-10,0,12,19);ctx.stroke();
  ctx.lineWidth=1.5;ctx.strokeStyle='#db879b';ctx.beginPath();ctx.moveTo(12,-19);ctx.lineTo(3,0);ctx.lineTo(12,19);ctx.stroke();
  ctx.fillStyle='#eee0b6';ctx.beginPath();ctx.moveTo(33,0);ctx.lineTo(12,-4);ctx.lineTo(17,0);ctx.lineTo(12,4);ctx.closePath();ctx.fill();
 }
 if(genes.includes('glob')) {
  organ(11,0,14,11+pulse,fused?'#a47a9d':'#7e9d62');
  for(let i=0;i<4;i++)organ(3+i*5,Math.sin(i*2)*5,3,3,'#c7d786');
 }
 // Exposed capillaries make every silhouette part of the same living arsenal.
 ctx.lineWidth=1;ctx.strokeStyle=fused?'#ffc1dc':'#c58e94';ctx.beginPath();ctx.moveTo(-5,3);ctx.bezierCurveTo(2,-5,12,7,23,1);ctx.moveTo(7,0);ctx.lineTo(9,-6);ctx.stroke();
 if(fused){organ(-1,0,5,5+pulse,'#e29cbb');ctx.strokeStyle='#edc0d0';ctx.beginPath();ctx.moveTo(-3,-4);ctx.lineTo(4,4);ctx.moveTo(-3,4);ctx.lineTo(4,-4);ctx.stroke();}
 ctx.restore();
}
