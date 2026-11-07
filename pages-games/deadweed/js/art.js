// Generated atlas metadata; regenerate with dev/prepare-stage1c.py.
'use strict';
const STAGE_ART_RECTS={"sprout_body":[4,39,120,50],"sprout_body_hit":[132,39,120,50],"sprout_root":[260,33,120,61],"sprout_root_hit":[388,33,120,61],"sprout_jawTop":[516,45,120,37],"sprout_jawTop_hit":[644,45,120,37],"sprout_jawBottom":[772,42,120,44],"sprout_jawBottom_hit":[900,42,120,44],"sprout_plate":[4,155,120,74],"sprout_plate_hit":[132,155,120,74],"sprout_pulp":[260,159,120,66],"sprout_pulp_hit":[388,159,120,66],"snapper_body":[516,156,120,71],"snapper_body_hit":[644,156,120,71],"snapper_root":[772,141,120,102],"snapper_root_hit":[900,141,120,102],"snapper_jawTop":[4,295,120,49],"snapper_jawTop_hit":[132,295,120,49],"snapper_jawBottom":[260,291,120,57],"snapper_jawBottom_hit":[388,291,120,57],"snapper_plate":[516,293,120,53],"snapper_plate_hit":[644,293,120,53],"snapper_pulp":[772,281,120,78],"snapper_pulp_hit":[900,281,120,78],"player_body":[4,413,120,69],"player_body_hit":[132,413,120,69],"player_armLeft":[260,430,120,35],"player_armLeft_hit":[388,430,120,35],"player_armRight":[516,428,120,39],"player_armRight_hit":[644,428,120,39],"player_leg":[772,425,120,45],"player_leg_hit":[900,425,120,45],"player_bone":[4,555,120,41],"player_bone_hit":[132,555,120,41],"player_spitter":[260,555,120,41],"player_spitter_hit":[388,555,120,41]};
// RENDERER BELOW
// GENERATED ENEMY ATLAS RECTS START
const ENEMY_ART_RECTS={"spitter_body":[4,39,120,50],"spitter_body_hit":[132,39,120,50],"spitter_root":[260,43,120,42],"spitter_root_hit":[388,43,120,42],"spitter_jawTop":[516,35,120,58],"spitter_jawTop_hit":[644,35,120,58],"spitter_jawBottom":[772,35,120,57],"spitter_jawBottom_hit":[900,35,120,57],"spitter_plate":[4,167,120,50],"spitter_plate_hit":[132,167,120,50],"spitter_pulp":[260,172,120,40],"spitter_pulp_hit":[388,172,120,40],"thorn_body":[516,164,120,55],"thorn_body_hit":[644,164,120,55],"thorn_root":[772,168,120,48],"thorn_root_hit":[900,168,120,48],"thorn_jawTop":[4,291,120,58],"thorn_jawTop_hit":[132,291,120,58],"thorn_jawBottom":[260,289,120,62],"thorn_jawBottom_hit":[388,289,120,62],"thorn_plate":[516,293,120,53],"thorn_plate_hit":[644,293,120,53],"thorn_spike":[772,297,120,45],"thorn_spike_hit":[900,297,120,45],"maw_body":[4,421,120,54],"maw_body_hit":[132,421,120,54],"maw_root":[260,423,120,50],"maw_root_hit":[388,423,120,50],"maw_jawTop":[516,420,120,56],"maw_jawTop_hit":[644,420,120,56],"maw_jawBottom":[772,420,120,56],"maw_jawBottom_hit":[900,420,120,56],"maw_petal":[4,549,120,54],"maw_petal_hit":[132,549,120,54],"maw_gland":[260,549,120,53],"maw_gland_hit":[388,549,120,53]};
// GENERATED ENEMY ATLAS RECTS END
// Two bounded rig atlases plus plant palette caches. Rendering consumes no gameplay RNG.
const ART_CONFIG={enabled:true,ready:false,enemyReady:false,error:null,textureBytes:0,textureCount:0,baseAtlasBytes:0,enemyAtlasBytes:0,cacheBytes:0,maxTextureBytes:6*1024*1024,maxAtlasBytes:3*1024*1024,wholeGlowBytes:0,maxWholeGlowBytes:2*1024*1024};
// Weak keys cannot retain dead enemies across a new run.
const STAGE_ART_MOTION=new WeakMap();
// Plant sap palette is baked once into small source-part caches, never per frame.
const PLANT_TISSUE_ART=new Map();
// Each complete plant is displayed much smaller than its source PNG. Bake its
// glow and hit tint at twice the world size when the image loads, not per enemy
// and per frame. The two small surfaces per species are bounded to 2 MiB.
const WHOLE_PLANT_GLOW=new Map();
const SECONDARY_PLANT_KINDS=['spitter','thorn','maw'];
const SUPPORTED_PLANT_KINDS=['sprout','snapper','spitter','thorn','maw'];
const ART_DRAW_SIGNS=[-1,1];
function cacheWholePlantGlow(kind,image){
  if(typeof PLANT_STATS==='undefined'||!PLANT_STATS[kind]||!image?.naturalWidth||!image?.naturalHeight)return;
  const r=PLANT_STATS[kind].r,size=r*(kind==='maw'?3:3.15),ratio=image.naturalWidth/image.naturalHeight;
  const w=ratio>=1?size:size*ratio,h=ratio>=1?size/ratio:size,pad=8,scale=2;
  const pixelW=Math.ceil((w+pad*2)*scale),pixelH=Math.ceil((h+pad*2)*scale),bytes=pixelW*pixelH*4*2;
  const prior=WHOLE_PLANT_GLOW.get(kind);
  if(prior?.source===image)return;
  const used=ART_CONFIG.wholeGlowBytes-(prior?.bytes||0);
  if(used+bytes>ART_CONFIG.maxWholeGlowBytes)return;
  const make=(flash)=>{
    const tile=typeof OffscreenCanvas==='function'?new OffscreenCanvas(pixelW,pixelH):typeof document!=='undefined'&&typeof document.createElement==='function'?document.createElement('canvas'):null;
    if(!tile)return null;
    tile.width=pixelW;tile.height=pixelH;
    const ink=tile.getContext('2d');if(!ink||typeof ink.drawImage!=='function')return null;
    ink.setTransform(scale,0,0,scale,0,0);
    ink.shadowColor='rgba(194,228,137,.8)';ink.shadowBlur=2*scale;
    if(flash)ink.filter='brightness(1.8) saturate(.65)';
    ink.drawImage(image,(pixelW/scale-w)/2,(pixelH/scale-h)/2,w,h);
    return tile;
  };
  let normal,hit;
  try{normal=make(false);hit=make(true);}catch(_){return;}
  if(!normal||!hit)return;
  WHOLE_PLANT_GLOW.set(kind,{source:image,normal,hit,w:pixelW/scale,h:pixelH/scale,r,bytes});
  ART_CONFIG.wholeGlowBytes=used+bytes;
}
function cachePlantTissueArt(image) {
  PLANT_TISSUE_ART.clear();
  ART_CONFIG.baseAtlasBytes=image.naturalWidth*image.naturalHeight*4;ART_CONFIG.cacheBytes=0;
  if(typeof document==='undefined'||typeof document.createElement!=='function')return;
  let bytes=0;
  for(const [name,r] of Object.entries(STAGE_ART_RECTS)){
    if(!/^(sprout|snapper)_/.test(name)||name.endsWith('_hit'))continue;
    if(ART_CONFIG.baseAtlasBytes+ART_CONFIG.enemyAtlasBytes+bytes+r[2]*r[3]*4>ART_CONFIG.maxTextureBytes)continue;
    const tile=document.createElement('canvas');tile.width=r[2];tile.height=r[3];const ink=tile.getContext('2d');
    if(!ink||typeof ink.getImageData!=='function')continue;
    ink.drawImage(image,...r,0,0,r[2],r[3]);const pixels=ink.getImageData(0,0,r[2],r[3]),data=pixels.data;
    for(let i=0;i<data.length;i+=4){
      const red=data[i],green=data[i+1],blue=data[i+2];
      const vascular=name.endsWith('_pulp')||name.endsWith('_root');
      if(!data[i+3]||red<=green*(vascular?1.05:1.25)||red-green<=(vascular?5:18))continue;
      const light=red*.2126+green*.7152+blue*.0722;
      data[i]=Math.round(light*.73);data[i+1]=Math.min(255,Math.round(light*1.16));data[i+2]=Math.round(light*.4);
    }
    ink.putImageData(pixels,0,0);bytes+=tile.width*tile.height*4;PLANT_TISSUE_ART.set(name,tile);
  }
  ART_CONFIG.cacheBytes=bytes;updateArtTextureStats();
}
function updateArtTextureStats(){
  ART_CONFIG.textureBytes=ART_CONFIG.baseAtlasBytes+ART_CONFIG.enemyAtlasBytes+ART_CONFIG.cacheBytes;
  ART_CONFIG.textureCount=(ART_CONFIG.baseAtlasBytes?1:0)+(ART_CONFIG.enemyAtlasBytes?1:0)+PLANT_TISSUE_ART.size;
}
function initializeStageArt(root) {
  if(!ART_CONFIG.enabled||typeof Image==='undefined')return;
  for(const kind of ['sprout','snapper','spitter','thorn','maw']){
    const key='whole_'+kind,image=SPRITES[key]||registerSprite(key,root+'whole-'+kind+'.png');
    if(!image)continue;
    const bake=()=>cacheWholePlantGlow(kind,image);
    if(image.complete&&image.naturalWidth)bake();
    else if(typeof image.addEventListener==='function')image.addEventListener('load',bake,{once:true});
    else image.onload=bake;
  }
  if(!SPRITES.organic_ground)registerSprite('organic_ground',root+'ground.png');
  if(!SPRITES.organic_rock)registerSprite('organic_rock',root+'rock.png');
  const bindAtlas=(key,path,onload,onerror)=>{
    let image=SPRITES[key];if(!image)image=registerSprite(key,root+path);if(!image)return;
    image.onload=onload;image.onerror=onerror;if(image.complete&&image.naturalWidth)onload();
  };
  bindAtlas('stage1c','atlas.png',()=>{
    const image=SPRITES.stage1c;
    const bytes=image.naturalWidth*image.naturalHeight*4;
    ART_CONFIG.ready=image.naturalWidth===1024&&image.naturalHeight===640&&bytes<=ART_CONFIG.maxAtlasBytes;
    ART_CONFIG.error=ART_CONFIG.ready?null:'Unexpected atlas dimensions';
    ART_CONFIG.baseAtlasBytes=ART_CONFIG.ready?bytes:0;ART_CONFIG.cacheBytes=0;updateArtTextureStats();
    if(ART_CONFIG.ready)cachePlantTissueArt(image);
    if(typeof LOOT_SPRITES!=='undefined'){LOOT_SPRITES.delete('bone');LOOT_SPRITES.delete('spitter');}
  },()=>{ART_CONFIG.ready=false;ART_CONFIG.baseAtlasBytes=0;ART_CONFIG.cacheBytes=0;ART_CONFIG.error='Rig atlas unavailable; procedural fallback active';updateArtTextureStats();});
  bindAtlas('stage1c_enemies','enemies.png',()=>{
    const image=SPRITES.stage1c_enemies,bytes=image.naturalWidth*image.naturalHeight*4;
    ART_CONFIG.enemyReady=image.naturalWidth===1024&&image.naturalHeight===640&&bytes<=ART_CONFIG.maxAtlasBytes;
    ART_CONFIG.enemyAtlasBytes=ART_CONFIG.enemyReady?bytes:0;updateArtTextureStats();
    if(!ART_CONFIG.enemyReady)ART_CONFIG.error='Enemy rig atlas has unexpected dimensions';
  },()=>{ART_CONFIG.enemyReady=false;ART_CONFIG.enemyAtlasBytes=0;ART_CONFIG.error='Enemy rig atlas unavailable; remaining plants use procedural fallback';updateArtTextureStats();});
}
function stageArtReady(){return ART_CONFIG.enabled&&ART_CONFIG.ready&&!!getSprite('stage1c');}
function enemyArtReady(){return ART_CONFIG.enabled&&ART_CONFIG.enemyReady&&!!getSprite('stage1c_enemies');}
function drawArtPart(ctx,name,x,y,w,h,angle=0,pivotX=.5,pivotY=.5,flash=false,rim=true){
  const secondary=/^(spitter|thorn|maw)_/.test(name),image=secondary?getSprite('stage1c_enemies'):getSprite('stage1c'),rects=secondary?ENEMY_ART_RECTS:STAGE_ART_RECTS;
  if(secondary?!enemyArtReady():!stageArtReady())return false;
  const r=rects[name+(flash?'_hit':'')];if(!r)return false;
  if(h==null)h=w*r[3]/r[2];
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  const tissue=!flash&&PLANT_TISSUE_ART.get(name);
  // A tight bioluminescent rim separates dark organic silhouettes from the
  // forest floor without another explicit draw call or edits to atlas pixels.
  if(rim){ctx.shadowColor='rgba(194, 228, 137, .92)';ctx.shadowBlur=1.8;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
  if(tissue)ctx.drawImage(tissue,0,0,r[2],r[3],-w*pivotX,-h*pivotY,w,h);
  else ctx.drawImage(image,r[0],r[1],r[2],r[3],-w*pivotX,-h*pivotY,w,h);
  ctx.restore();return true;
}
function stageArtPose(e,t){
  const wind=e.kind==='snapper'&&e.state==='wind'||SECONDARY_PLANT_KINDS.includes(e.kind)&&e.attackWind>0||e.kind==='maw'&&e.chargeWind>0,dash=e.kind==='snapper'&&e.state==='dash'||e.kind==='maw'&&e.chargeT>0;
  let motion=STAGE_ART_MOTION.get(e);
  if(!motion){motion={state:e.state,recoverUntil:0,pose:{}};STAGE_ART_MOTION.set(e,motion);}
  if(motion.state==='dash'&&e.state==='idle')motion.recoverUntil=t+.18;
  motion.state=e.state;
  const recover=t<motion.recoverUntil||e.recoverT>0,bite=e.kind==='sprout'&&e.wantMouth&&e.atkCd>.7;
  const prepare=e.kind==='sprout'&&e.wantMouth&&e.atkCd<=.2||SECONDARY_PLANT_KINDS.includes(e.kind)&&e.attackWind>0||e.kind==='maw'&&e.chargeWind>0;
  const pose=motion.pose;
  pose.angle=wind||dash?e.attackAngle:e.angle;pose.wind=wind;pose.dash=dash;
  pose.recover=recover;pose.bite=bite;pose.prepare=prepare;
  pose.step=Math.sin(e.wob||t*8)*Math.min(1,Math.hypot(e.vx,e.vy)/90);
  pose.jaw=wind?.25+Math.min(1,e.stateT/.5)*.65:dash?.85:recover?.12:bite?.02:prepare?.7:Math.max(0,e.mouth||0)*.5;
  pose.flash=e.hitFlash>0;
  return pose;
}
function drawArtEnemy(ctx,e,t){
  if(drawWholePlant(ctx,e,t))return true;
  const secondary=SECONDARY_PLANT_KINDS.includes(e.kind);
  if(!SUPPORTED_PLANT_KINDS.includes(e.kind)||(secondary?!enemyArtReady():!stageArtReady()))return false;
  const p=stageArtPose(e,t),k=e.kind+'_';e.drawShadow(ctx);
  if(e.kind==='sprout'||e.kind==='snapper'){
    const big=e.kind==='snapper',b=big?1.6:1;ctx.save();ctx.translate(e.x,e.y);ctx.rotate(p.angle||0);
    for(const side of ART_DRAW_SIGNS)for(let i=0;i<2;i++){const swing=p.step*(i?1:-1)*.3;drawArtPart(ctx,k+'root',(-9+i*10)*b,side*9*b,17*b,7*b,side*(.35+swing+(p.wind?.3:p.dash?-.4:0)),.6,.5,p.flash);}
    drawArtPart(ctx,k+'body',0,0,big?51:35,big?38:24,0,.5,.5,p.flash);
    if(big)for(const side of ART_DRAW_SIGNS)drawArtPart(ctx,k+'plate',-4-(p.recover?2:0),side*(14+Math.sin(t*2)*.4),28,15,side*(p.wind?.28:.12),.5,.5,p.flash);
    if(e.hp<e.maxHp*.7)drawArtPart(ctx,k+'pulp',-2,0,big?20:12,big?12:7);
    for(const side of ART_DRAW_SIGNS)drawArtPart(ctx,k+(side<0?'jawTop':'jawBottom'),big?10:6,side*(big?7:3),big?32:18,big?14:8,side*(.05+p.jaw*.55),.12,.5,p.flash);
    ctx.restore();return true;
  }
  if(e.kind==='spitter'){
    const open=clamp(Math.max(e.mouth||0,e.attackWind>0?.75:0,e.shootT>0?.9:0,e.coordinatedAttack?.version===2?.95:0,e.isResonator&&e.activeSync?.9:0),0,1),sway=Math.sin(e.wob)*.08;
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate(p.angle);
    for(const side of ART_DRAW_SIGNS)drawArtPart(ctx,k+'root',-5,side*6,22,8,side*(.2+sway),.12,.5,p.flash);
    drawArtPart(ctx,k+'body',0,0,38,27,0,.48,.5,p.flash);
    for(const side of ART_DRAW_SIGNS)drawArtPart(ctx,k+'plate',-4,side*6,24,12,side*.12,.5,.5,p.flash);
    drawArtPart(ctx,k+'jawTop',8,-3,22,13,-open*.4,.1,.55,p.flash);
    drawArtPart(ctx,k+'jawBottom',8,3,22,13,open*.4,.1,.45,p.flash);
    if(e.isResonator){
      const pulse=.5+.5*Math.sin(t*6.2+(e.resonatorTelemetryId?e.resonatorTelemetryId.length:0));
      const preparing=!!e.activeSync;ctx.save();ctx.globalAlpha=preparing?.82:.62+.28*pulse;ctx.fillStyle=preparing?'#5e4220':'#47351e';ctx.strokeStyle=preparing?'#ffd17a':'#c39b54';ctx.lineWidth=preparing?2.5:1.8;
      ctx.beginPath();ctx.moveTo(-20,-6);ctx.lineTo(-25,-15);ctx.lineTo(-14,-21);ctx.lineTo(-5,-15);ctx.lineTo(-7,-6);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle=preparing?'#ffd17a':'#c69646';ctx.shadowColor=preparing?'#ffd17a':'transparent';ctx.shadowBlur=preparing?12:0;ctx.beginPath();ctx.ellipse(-15,-14,5.2+1.1*pulse,6.1+1.2*pulse,-.35,0,TAU);ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle='#332615';ctx.beginPath();ctx.ellipse(-15,-14,2.1,3.2,-.35,0,TAU);ctx.fill();ctx.restore();
    }
    if(e.hp<e.maxHp*.7)drawArtPart(ctx,k+'pulp',-4,0,15,10,0,.5,.5,p.flash);
    ctx.restore();return true;
  }
  if(e.kind==='thorn'){
    const open=clamp(Math.max(e.mouth||0,e.attackWind>0?.65:0,e.shootT>0?.9:0),0,1),wob=e.wob||t*3;
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate((p.angle||0)+Math.sin(wob*.15)*.025);
    for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,side=Math.sin(a);drawArtPart(ctx,k+'root',Math.cos(a)*10,Math.sin(a)*10,25,9,a,.1,.5,p.flash);}
    for(let i=0;i<8;i++){const a=i*Math.PI/4+wob*.025;drawArtPart(ctx,k+'spike',Math.cos(a)*e.r*.45,Math.sin(a)*e.r*.45,e.r*.9,e.r*.27,a,.12,.5,p.flash);}
    for(const side of ART_DRAW_SIGNS)drawArtPart(ctx,k+'plate',-3,side*6,20,12,side*.55,.1,.5,p.flash);
    drawArtPart(ctx,k+'body',0,0,39,34,0,.5,.5,p.flash);
    drawArtPart(ctx,k+'jawTop',8,-3,23,13,-open*.32,.08,.55,p.flash);
    drawArtPart(ctx,k+'jawBottom',8,3,23,13,open*.32,.08,.45,p.flash);
    ctx.restore();return true;
  }
  if(e.kind==='maw'){
    const open=clamp(Math.max(e.mouth||0,e.attackWind>0?.75:0,e.shootT>0?.8:0),0,1),wind=p.wind||e.chargeWind>0,reach=e.r*(.42+(wind?.11:0)),petalW=e.r*.88,petalH=e.r*.38;
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate(p.angle||0);
    for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.sin(t*.7)*.025,dist=e.r*.38+(wind?e.r*.08:0);drawArtPart(ctx,k+'root',Math.cos(a)*dist,Math.sin(a)*dist,e.r*.9,e.r*.32,a,.12,.5,p.flash);}
    for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.sin(t*.35+i)*.035;drawArtPart(ctx,k+'petal',Math.cos(a)*reach*.34,Math.sin(a)*reach*.34,petalW,petalH,a,.08,.5,p.flash);}
    drawArtPart(ctx,k+'body',0,0,e.r*2.1,e.r*1.62,0,.48,.5,p.flash);
    drawArtPart(ctx,k+'jawTop',e.r*.36,-e.r*.12,e.r*1.12,e.r*.5,-open*.18,.08,.55,p.flash);
    drawArtPart(ctx,k+'jawBottom',e.r*.36,e.r*.12,e.r*1.12,e.r*.5,open*.18,.08,.45,p.flash);
    if(e.hp<e.maxHp*.7)drawArtPart(ctx,k+'gland',-e.r*.28,0,e.r*.56,e.r*.32,0,.5,.5,p.flash);
    ctx.restore();if(typeof e.drawGlands==='function')e.drawGlands(ctx);return true;
  }
  return false;
}

// Whole sprites avoid assembly seams while keeping gameplay poses and indicators.
function drawWholePlant(ctx,e,t){
  const image=getSprite('whole_'+e.kind);if(!ART_CONFIG.enabled||!image)return false;
  const pose=stageArtPose(e,t),size=e.r*(e.kind==='maw'?3.0:3.15);
  e.drawShadow(ctx);ctx.save();ctx.translate(e.x,e.y);ctx.rotate(pose.angle||0);
  const breathing=1+Math.sin(t*3+(e.wob||0))*.025;
  const stretch=pose.wind?.94:pose.dash?1.1:1;
  ctx.scale(stretch*breathing,breathing/Math.sqrt(stretch));
  const baked=WHOLE_PLANT_GLOW.get(e.kind);
  if(baked?.source===image&&baked.r===e.r){
    ctx.drawImage(pose.flash?baked.hit:baked.normal,-baked.w/2,-baked.h/2,baked.w,baked.h);
  }else{
    // Old browsers without a 2D offscreen surface keep the original artwork.
    ctx.shadowColor='rgba(194,228,137,.8)';ctx.shadowBlur=2;
    if(pose.flash)ctx.filter='brightness(1.8) saturate(.65)';
    const ratio=image.naturalWidth/image.naturalHeight,w=ratio>=1?size:size*ratio,h=ratio>=1?size/ratio:size;
    ctx.drawImage(image,-w/2,-h/2,w,h);ctx.filter='none';ctx.shadowBlur=0;
  }
  if(e.isResonator){const pulse=.5+.5*Math.sin(t*6.2),active=!!e.activeSync;ctx.fillStyle=active?'#ffd17a':'#c69646';ctx.strokeStyle='#352719';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(-e.r*.65,-e.r*.7,5.2+pulse,6.1+pulse,-.35,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#332615';ctx.beginPath();ctx.ellipse(-e.r*.65,-e.r*.7,2,3,-.35,0,TAU);ctx.fill();}
  ctx.restore();if(e.kind==='maw'&&typeof e.drawGlands==='function')e.drawGlands(ctx);return true;
}

function drawResonatorLinks(ctx,enemies,time){
  for(const resonator of enemies){
    const sync=resonator.activeSync;
    if(!resonator.isResonator||resonator.dead||!sync)continue;
    const version2=sync.version===2,progress=clamp(1-(sync.fireAt-time)/sync.warningSeconds,0,1),alpha=version2?.62+.3*progress:.28+.48*progress;
    for(const partner of sync.participants){
      const attack=partner.coordinatedAttack;
      if(partner.dead||!attack||attack.syncId!==sync.id)continue;
      const mx=(resonator.x+partner.x)*.5,my=(resonator.y+partner.y)*.5+Math.sin(time*8+sync.id)*7;
      ctx.save();ctx.lineCap='round';
      if(version2){
        ctx.shadowColor='#e6b75d';ctx.shadowBlur=8;ctx.strokeStyle='rgba(35,22,10,.88)';ctx.lineWidth=7;
        ctx.beginPath();ctx.moveTo(resonator.x,resonator.y);ctx.quadraticCurveTo(mx,my,partner.x,partner.y);ctx.stroke();
        ctx.shadowBlur=3;ctx.strokeStyle='rgba(227,178,89,'+alpha+')';ctx.lineWidth=3.2+progress*.8;
        ctx.beginPath();ctx.moveTo(resonator.x,resonator.y);ctx.quadraticCurveTo(mx,my,partner.x,partner.y);ctx.stroke();
      }else {ctx.strokeStyle='rgba(204,158,78,'+alpha+')';ctx.lineWidth=1.2+progress*.7;ctx.beginPath();ctx.moveTo(resonator.x,resonator.y);ctx.quadraticCurveTo(mx,my,partner.x,partner.y);ctx.stroke();}
      const ray=resonatorAimSegment(partner,attack,typeof LEVEL!=='undefined'?LEVEL:null),{x1:muzzleX,y1:muzzleY,x2,y2}=ray;
      if(version2){
        ctx.setLineDash([]);ctx.shadowBlur=0;ctx.strokeStyle='rgba(18,20,10,.92)';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(muzzleX,muzzleY);ctx.lineTo(x2,y2);ctx.stroke();
        ctx.shadowColor='#f4ca77';ctx.shadowBlur=7;ctx.strokeStyle='rgba(255,211,125,'+alpha+')';ctx.lineWidth=3.4;ctx.beginPath();ctx.moveTo(muzzleX,muzzleY);ctx.lineTo(x2,y2);ctx.stroke();
        ctx.setLineDash([10,8]);ctx.strokeStyle='rgba(255,245,210,'+(.64+.3*progress)+')';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(muzzleX,muzzleY);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);
      }else{ctx.setLineDash([7,8]);ctx.strokeStyle='rgba(236,183,92,'+(.18+.32*progress)+')';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(partner.x,partner.y);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);}
      ctx.restore();
    }
    if(version2&&sync.targetX!==undefined){
      const pulse=progress>.88?1:.58+.24*Math.sin(time*10),r=progress>.88?16+Math.sin(time*25)*3:12;
      ctx.save();ctx.globalAlpha=pulse;ctx.strokeStyle=progress>.88?'#fff0b3':'#e6b75d';ctx.lineWidth=2.2;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=9;
      ctx.beginPath();ctx.arc(sync.targetX,sync.targetY,r,0,TAU);ctx.moveTo(sync.targetX-r-7,sync.targetY);ctx.lineTo(sync.targetX+r+7,sync.targetY);ctx.moveTo(sync.targetX,sync.targetY-r-7);ctx.lineTo(sync.targetX,sync.targetY+r+7);ctx.stroke();ctx.restore();
    }
  }
}

function resonatorAimSegment(partner,attack,level=typeof LEVEL!=='undefined'?LEVEL:null){
  const dx=Math.cos(attack.angle),dy=Math.sin(attack.angle),x1=partner.x+dx*(partner.r+4),y1=partner.y+dy*(partner.r+4);
  const targetX=attack.targetX??partner.x+dx*320,targetY=attack.targetY??partner.y+dy*320;
  let length=Math.max(36,Math.hypot(targetX-x1,targetY-y1)+34);
  if(level){
    const edge=dx>0?(level.w-x1)/dx:dx<0?(0-x1)/dx:Infinity,vertical=dy>0?(level.h-y1)/dy:dy<0?(0-y1)/dy:Infinity;
    length=Math.min(length,edge>0?edge:Infinity,vertical>0?vertical:Infinity);
    for(const rock of level.obstacles||[]){const hit=segmentCircleTime(x1,y1,dx*length,dy*length,rock.x,rock.y,rock.r+4);if(hit!==null)length=Math.min(length,Math.max(0,hit*length));}
  }
  return {x1,y1,x2:x1+dx*length,y2:y1+dy*length,length,angle:attack.angle};
}

function drawResonatorBreaks(ctx,breaks,time){
  for(const effect of breaks||[]){
    const age=time-effect.at,progress=clamp(age/effect.duration,0,1),alpha=1-progress;
    if(alpha<=0)continue;
    ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.strokeStyle=effect.playerInterrupted?'#f2d38a':'#c7af72';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=7;ctx.lineWidth=2.5;
    for(const partner of effect.participants||[]){
      const dx=partner.x-effect.x,dy=partner.y-effect.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,gap=8+progress*24,midX=(effect.x+partner.x)*.5,midY=(effect.y+partner.y)*.5;
      ctx.beginPath();ctx.moveTo(effect.x+ux*gap,effect.y+uy*gap);ctx.lineTo(midX-ux*gap,midY-uy*gap);ctx.moveTo(midX+ux*gap,midY+uy*gap);ctx.lineTo(partner.x-ux*gap,partner.y-uy*gap);ctx.stroke();
    }
    const radius=12+progress*46;ctx.lineWidth=2.6;ctx.beginPath();ctx.arc(effect.x,effect.y,radius,0,TAU);ctx.moveTo(effect.x-radius*.7,effect.y-radius*.7);ctx.lineTo(effect.x+radius*.7,effect.y+radius*.7);ctx.moveTo(effect.x+radius*.7,effect.y-radius*.7);ctx.lineTo(effect.x-radius*.7,effect.y+radius*.7);ctx.stroke();ctx.restore();
  }
}
// Weapons are living grafts made from the same articulated anatomy as their
// source plants. Fusions layer both parent rigs, so every combination keeps a
// readable visual lineage instead of falling back to a single portrait PNG.
const WEAPON_ART_RIGS={
  bone:{species:'snapper',root:'root',chamber:'pulp',clamp:'plate',muzzle:'jaw'},
  spitter:{species:'spitter',root:'root',chamber:'pulp',clamp:'plate',muzzle:'jaw'},
  seedshot:{species:'maw',root:'root',chamber:'gland',clamp:'petal',muzzle:'petal'},
  thorn:{species:'thorn',root:'root',chamber:'plate',clamp:'plate',muzzle:'spike'},
  glob:{species:'maw',root:'root',chamber:'gland',clamp:'petal',muzzle:'jaw'}
};
function weaponRigReady(gene){
  const rig=WEAPON_ART_RIGS[gene];if(!rig)return false;
  return /^(spitter|thorn|maw)$/.test(rig.species)?enemyArtReady():stageArtReady();
}
function drawWeaponGeneRig(ctx,gene,offset,unit,pulse,flash){
  const rig=WEAPON_ART_RIGS[gene];if(!rig)return false;
  const k=rig.species+'_',breath=clamp(pulse,-.6,.6),firing=flash;
  const root=drawArtPart(ctx,k+rig.root,offset-3*unit,0,20*unit,9*unit,breath*.08,.13,.5,firing);
  const chamberName=k+rig.chamber;
  const chamber=drawArtPart(ctx,chamberName,offset+8*unit,0,17*unit,(gene==='glob'?15:12)*unit*(1+Math.max(0,breath)*.045),breath*.04,.48,.5,firing);
  if(rig.clamp==='plate'||rig.clamp==='petal'){
    const clampName=k+rig.clamp;
    drawArtPart(ctx,clampName,offset+7*unit,-4*unit,16*unit,7*unit,-.18+breath*.07,.12,.5,firing);
  }
  const jawOpen=.07+Math.max(0,breath)*.12+(firing ? .2 : 0),jawW=gene==='seedshot'?15:16,jawH=gene==='seedshot'?8:6;
  if(rig.muzzle==='spike'){
    drawArtPart(ctx,k+'spike',offset+13*unit,0,16*unit,6*unit,breath*.035,.12,.5,firing);
    drawArtPart(ctx,k+'jawTop',offset+9*unit,-3*unit,12*unit,5*unit,-jawOpen,.1,.55,firing);
    drawArtPart(ctx,k+'jawBottom',offset+9*unit,3*unit,12*unit,5*unit,jawOpen,.1,.45,firing);
  } else {
    const top=rig.muzzle==='petal'?(gene==='seedshot'?'petal':'jawTop'):'jawTop';
    const bottom=rig.muzzle==='petal'?(gene==='seedshot'?'petal':'jawBottom'):'jawBottom';
    drawArtPart(ctx,k+top,offset+13*unit,-2.5*unit,jawW*unit,jawH*unit,-jawOpen,.1,.55,firing);
    drawArtPart(ctx,k+bottom,offset+13*unit,2.5*unit,jawW*unit,jawH*unit,jawOpen,.1,.45,firing);
  }
  // Seedshot keeps its three opening petals; the other weapons stay compact.
  if(gene==='seedshot')for(const side of ART_DRAW_SIGNS)
    drawArtPart(ctx,k+'petal',offset+8*unit,side*5*unit,13*unit,5*unit,side*(.28+breath*.08),.08,.5,firing);
  return root||chamber;
}
function drawArtWeapon(ctx,id,x,y,angle=0,scale=1,pulse=0){
  const def=typeof WEAPON_DEFS!=='undefined'&&WEAPON_DEFS[id];
  if(!def)return false;
  const genes=def.genes;
  if(genes){if(!genes.length)return false;for(let i=0;i<genes.length;i++)if(!weaponRigReady(genes[i]))return false;}
  else if(!weaponRigReady(id))return false;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  const flash=pulse>=.95;
  if(!genes)drawWeaponGeneRig(ctx,id,0,scale,pulse,flash);
  else if(genes.length===1)drawWeaponGeneRig(ctx,genes[0],0,scale,pulse,flash);
  else {
    // Rear graft forms the stock; the shifted, smaller graft stays exposed as
    // a second chamber and muzzle organ. Same-gene fusions remain visibly dual.
    drawWeaponGeneRig(ctx,genes[0],-2*scale,scale,pulse,flash);
    drawWeaponGeneRig(ctx,genes[1],5*scale,.68*scale,pulse,flash);
  }
  ctx.restore();return true;
}
function createSplashMonsterDesign(seed){
  let state=(seed>>>0)||1;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const species=['snapper','spitter','thorn','maw'],pick=()=>species[Math.floor(random()*species.length)];
  const main=pick(),count=7+Math.floor(random()*4),tendrils=[];
  for(let i=0;i<count;i++)tendrils.push({
    species:pick(),angle:i*Math.PI*2/count+(random()-.5)*.52,length:126+random()*83,
    width:13+random()*12,front:random()<.38,phase:random()*Math.PI*2,claw:random()<.58
  });
  const heads=Array.from({length:2+Math.floor(random()*3)},(_,i)=>{
    const side=i%2?-1:1;
    return {species:pick(),x:side*(35+random()*51),y:(random()-.5)*92,
      size:.42+random()*.26,angle:side*(.18+random()*.38),open:.12+random()*.38};
  });
  return {main,open:.35+random()*.5,tendrils,heads,eyeSeed:Math.floor(random()*100000)};
}
const SPLASH_MONSTER_DESIGN=createSplashMonsterDesign((Date.now()^Math.floor(Math.random()*0x100000000))>>>0);
function drawSplashHead(ctx,species,x,y,w,h,angle,open,t){
  const k=species+'_';ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  drawArtPart(ctx,k+'body',0,0,w,h,Math.sin(t*.7+x*.01)*.015,.5,.5);
  if(species==='maw'){
    drawArtPart(ctx,'maw_petal',-w*.12,-h*.22,w*.72,h*.34,-.28,.08,.5);
    drawArtPart(ctx,'maw_petal',-w*.12,h*.22,w*.72,h*.34,.28,.08,.5);
    drawArtPart(ctx,'maw_gland',-w*.2,0,w*.36,h*.34,Math.sin(t*1.3+y*.02)*.025);
  } else {
    const clampName=species+'_plate';drawArtPart(ctx,clampName,-w*.04,-h*.1,w*.72,h*.48,-.04,.5,.5);
    const core=species==='thorn'?'thorn_spike':k+'pulp';
    drawArtPart(ctx,core,-w*.16,0,w*.48,h*.34,Math.sin(t*1.1+x*.02)*.025,.5,.5);
  }
  const jawTop=species+'_jawTop',jawBottom=species+'_jawBottom',jawW=w*.72,jawH=h*.45;
  drawArtPart(ctx,jawTop,w*.19,-h*.13,jawW,jawH,-open,.08,.55);
  drawArtPart(ctx,jawBottom,w*.19,h*.13,jawW,jawH,open,.08,.45);
  if(species==='thorn')drawArtPart(ctx,'thorn_spike',w*.54,0,w*.42,h*.17,0,.12,.5);
  ctx.restore();
}
function drawSplashMonsterSilhouette(ctx,x,y,scale,t){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='#07100d';ctx.strokeStyle='#263b2b';ctx.lineCap='round';
  ctx.beginPath();ctx.ellipse(0,0,74,57,-.12,0,TAU);ctx.fill();
  for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.sin(t*.6+i)*.03;ctx.lineWidth=9-i%3*2;ctx.beginPath();ctx.moveTo(Math.cos(a)*43,Math.sin(a)*31);ctx.quadraticCurveTo(Math.cos(a)*115,Math.sin(a)*92,Math.cos(a)*196,Math.sin(a)*150);ctx.stroke();}
  ctx.fillStyle='#a7cf72';for(const side of ART_DRAW_SIGNS){ctx.beginPath();ctx.ellipse(side*21,-8,7,4,side*.12,0,TAU);ctx.fill();}
  ctx.restore();
}
function drawSplashMonster(ctx,x,y,scale,t,design=SPLASH_MONSTER_DESIGN){
  const ready=stageArtReady()&&enemyArtReady();
  if(!ready){drawSplashMonsterSilhouette(ctx,x,y,scale,t);return false;}
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  const tendril=(part,index)=>{
    const sway=Math.sin(t*.8+part.phase)*.035,a=part.angle+sway,bx=Math.cos(a)*43,by=Math.sin(a)*31,len=part.length*(1+Math.sin(t*.55+part.phase)*.018),k=part.species+'_';
    drawArtPart(ctx,k+'root',bx,by,len,part.width,a,.1,.5);
    if(part.claw){const tx=bx+Math.cos(a)*len*.82,ty=by+Math.sin(a)*len*.82;
      if(part.species==='thorn')drawArtPart(ctx,'thorn_spike',tx,ty,30,12,a,.12,.5);
      else if(part.species==='maw')drawArtPart(ctx,'maw_petal',tx,ty,31,13,a,.08,.5);
      else drawArtPart(ctx,k+'jawTop',tx,ty,27,13,a,.08,.5);
    }
  };
  design.tendrils.forEach((part,i)=>{if(!part.front)tendril(part,i);});
  drawSplashHead(ctx,design.main,0,0,132,94,Math.sin(t*.35)*.025,design.open+Math.sin(t*1.2)*.045,t);
  for(const head of design.heads)drawSplashHead(ctx,head.species,head.x,head.y,91*head.size,70*head.size,head.angle,head.open+Math.sin(t*1.1+head.x)*.04,t);
  for(let i=0;i<3;i++)drawArtPart(ctx,'maw_gland',-32+i*28,-51-Math.sin(t+i)*2,16,11,(i-1)*.12);
  design.tendrils.forEach((part,i)=>{if(part.front)tendril(part,i);});
  ctx.restore();return true;
}
function drawArtPlayer(ctx,p,t){
  if(!stageArtReady())return false;
  const a=p.aimRight,flash=p.invuln>0&&Math.floor(t*20)%2===0;
  const left=p.handL,right=p.handR,sin=Math.sin(a),cos=Math.cos(a);
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);
  const legSwing=Math.sin(p.walkPhase)*.25;
  for(let i=0;i<2;i++){const side=i?1:-1;drawArtPart(ctx,'player_leg',-12,side*7,16,7,Math.PI+legSwing*side,.15,.5,flash);}
  ctx.restore();
  if(p.leftMirrored)drawArtPlayerArm(ctx,p,left,sin,cos,'player_armLeft',flash);
  drawArtPart(ctx,'player_body',p.x,p.y,37,30,a,.5,.5,flash);
  if(!p.leftMirrored)drawArtPlayerArm(ctx,p,left,sin,cos,'player_armLeft',flash);
  drawArtPlayerArm(ctx,p,right,sin,cos,'player_armRight',flash);
  for(let i=0;i<2;i++)if(p.hands[i]){const h=i===0?p.handL:p.handR,w=p.hands[i];w.draw(ctx,h.x,h.y,i===0?p.aimLeft:p.aimRight,w.id==='bone'||w.id==='spitter'?1:.85);}
  return true;
}
function drawArtPlayerArm(ctx,p,hand,sin,cos,part,flash){
  const side=part==='player_armLeft'?-1:1,sx=p.x-cos*3-sin*side*9,sy=p.y-sin*3+cos*side*9;
  drawArtPart(ctx,part,sx,sy,Math.max(7,Math.hypot(hand.x-sx,hand.y-sy)),7,Math.atan2(hand.y-sy,hand.x-sx),0,.5,flash);
}
const STAGE_TISSUE_PARTS={jaw:'jawTop',shell:'plate',petal:'plate',stem:'root',tendon:'root',pulp:'pulp',seed:'pulp'};
function drawArtTissue(ctx,p){
  if(!p.species||!stageArtReady())return false;
  const part=STAGE_TISSUE_PARTS[p.type];
  return part?drawArtPart(ctx,p.species+'_'+part,p.x,p.y-(p.z||0),p.size*2.4,null,p.rot,.5,.5,false,false):false;
}
