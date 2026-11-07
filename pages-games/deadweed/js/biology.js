// Decorative biology only: no combat references, colliders, gameplay RNG or damage.
'use strict';
const FX_CONFIG={
  enabled:true,
  maxGibs:80,
  maxParticles:1100,
  splatterDensity:.5,
  shakeScale:1,
  maxShake:7,
  gibLife:4,
  stainScale:.5, // world-sized surface: 1100 x 800 RGBA, about 3.36 MiB
  stainDetail:4,
};
const TISSUE_COLORS={petal:['#82935a','#687d48','#a2ad73'],jaw:['#d5d0a1','#b5ba85','#e0dfb5'],stem:['#78804b','#8f9457','#a6ac72'],shell:['#68745c','#879274','#9aa185'],tendon:['#a9b86b','#c4cd89','#869954'],pulp:['#849647','#a7b25c','#65783c'],seed:['#b9b569','#9fae79','#c9c58a']};
const GORE_PROFILES={
  sprout:{hit:'pulp',hitScale:.8,death:['petal','petal','stem','shell','jaw','seed'],scale:.58,speed:160,stain:.7},
  snapper:{hit:'pulp',hitScale:1,death:['jaw','jaw','shell','shell','tendon','tendon','pulp','pulp'],scale:1,speed:200,stain:1.12},
  spitter:{hit:'seed',hitScale:.7,death:['seed','seed','seed','shell','stem','pulp'],scale:.62,speed:175,stain:.82},
  resonator:{hit:'seed',hitScale:.8,death:['seed','seed','shell','shell','tendon','pulp','pulp'],scale:.72,speed:190,stain:.9},
  thorn:{hit:'shell',hitScale:.9,death:['shell','shell','shell','tendon','tendon','seed','seed','pulp'],scale:.82,speed:195,stain:1.02},
  maw:{hit:'tendon',hitScale:1.35,death:['jaw','jaw','shell','shell','shell','tendon','tendon','pulp','pulp','pulp','seed','seed'],scale:1.25,speed:235,stain:1.28}
};
const TISSUE_SPRITES=new Map();
function drawCachedTissue(ctx,p) {
  if(typeof drawArtTissue==='function'&&drawArtTissue(ctx,p))return;
  if(typeof document==='undefined'||typeof document.createElement!=='function'){drawTissue(ctx,p);return;}
  const key=p.type+p.color;
  if(!TISSUE_SPRITES.has(key)){
    const sprite=document.createElement('canvas');sprite.width=sprite.height=64;const ink=sprite.getContext('2d');
    drawTissue(ink,{...p,x:32,y:32,z:0,rot:0,size:16});TISSUE_SPRITES.set(key,sprite);
  }
  ctx.save();ctx.translate(p.x,p.y-(p.z||0));ctx.rotate(p.rot);ctx.drawImage(TISSUE_SPRITES.get(key),-p.size*2,-p.size*2,p.size*4,p.size*4);ctx.restore();
}
function drawTissue(ctx,p) {
  ctx.save();ctx.translate(p.x,p.y-(p.z||0));ctx.rotate(p.rot);ctx.scale(p.size,p.size);
  ctx.fillStyle=p.color;ctx.strokeStyle='#28351c';ctx.lineWidth=.13;
  ctx.beginPath();
  if(p.type==='jaw') {
    ctx.moveTo(-1,-.2);ctx.bezierCurveTo(-.3,-1,1,-.65,1,.05);ctx.lineTo(.65,.5);ctx.quadraticCurveTo(.15,-.1,-.8,.4);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#eee1b7';for(let i=0;i<4;i++){const x=-.6+i*.38;ctx.beginPath();ctx.moveTo(x,.05);ctx.lineTo(x+.2,.08);ctx.lineTo(x+.09,.6-(i%2)*.15);ctx.closePath();ctx.fill();}
  } else if(p.type==='stem'||p.type==='tendon') {
    ctx.moveTo(-1,-.2);ctx.bezierCurveTo(-.1,-.65,.3,.2,1,-.2);ctx.lineTo(.85,.25);ctx.bezierCurveTo(.1,.5,-.2,-.2,-1,.28);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle=p.type==='stem'?'#b5bc78':'#d0d99b';ctx.lineWidth=.09;ctx.beginPath();ctx.moveTo(-.8,0);ctx.bezierCurveTo(-.2,-.2,.3,.3,.85,0);ctx.stroke();
  } else if(p.type==='shell') {
    ctx.moveTo(-.9,-.2);ctx.lineTo(-.4,-.7);ctx.lineTo(.3,-.62);ctx.lineTo(.9,-.15);ctx.lineTo(.5,.45);ctx.lineTo(.05,.2);ctx.lineTo(-.4,.55);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle='#a19569';ctx.beginPath();ctx.moveTo(-.5,-.4);ctx.lineTo(.3,-.15);ctx.lineTo(.55,.2);ctx.stroke();
  } else if(p.type==='pulp') {
    ctx.moveTo(-.95,.12);ctx.bezierCurveTo(-1.1,-.5,-.3,-.95,.1,-.5);ctx.bezierCurveTo(.85,-.8,1.2,.05,.65,.42);ctx.bezierCurveTo(.15,.95,-.5,.4,-.95,.12);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#c1cd7e';ctx.beginPath();ctx.moveTo(-.65,-.15);ctx.quadraticCurveTo(-.1,.45,.45,-.18);ctx.stroke();
  } else if(p.type==='seed') {
    ctx.ellipse(0,0,.5,.8,.3,0,TAU);ctx.fill();ctx.stroke();ctx.strokeStyle='#e5d0a0';ctx.beginPath();ctx.moveTo(-.08,-.5);ctx.lineTo(.1,.45);ctx.stroke();
  } else {
    ctx.moveTo(-1,0);ctx.bezierCurveTo(-.7,-.8,.55,-.7,1,0);ctx.bezierCurveTo(.3,.6,-.55,.7,-1,0);ctx.fill();ctx.stroke();
    ctx.strokeStyle=p.type==='petal'?'#c0c987':'#9faa6c';ctx.lineWidth=.1;ctx.beginPath();ctx.moveTo(-.7,0);ctx.quadraticCurveTo(.1,-.1,.7,0);ctx.stroke();
  }
  ctx.restore();
}
class BiologyFX {
  constructor(w,h) {
    this.w=w;this.h=h;this.gibs=[];this.stampCount=0;this.emitted=0;this.landed=0;
    this.surface=null;this.ink=null;this.stainBounds=null;this.scale=FX_CONFIG.stainScale;
    if(typeof document!=='undefined'&&typeof document.createElement==='function') {
      const surface=document.createElement('canvas');surface.width=Math.ceil(w*this.scale);surface.height=Math.ceil(h*this.scale);
      const ink=surface.getContext('2d');if(ink){this.surface=surface;this.ink=ink;ink.setTransform(this.scale,0,0,this.scale,0,0);}
    }
  }
  get enabled(){return FX_CONFIG.enabled;}
  dispose(){this.gibs.length=0;if(this.surface){this.surface.width=0;this.surface.height=0;}this.ink=null;this.surface=null;}
  includeStain(x,y,r){
    const b=this.stainBounds;if(!b){this.stainBounds={x0:x-r,y0:y-r,x1:x+r,y1:y+r};return;}
    b.x0=Math.min(b.x0,x-r);b.y0=Math.min(b.y0,y-r);b.x1=Math.max(b.x1,x+r);b.y1=Math.max(b.y1,y+r);
  }
  stain(x,y,size,angle=0,death=false) {
    if(!this.enabled)return;this.stampCount++;
    const ctx=this.ink;if(!ctx)return;
    // Include lobes and the furthest splatter; padding covers raster rounding.
    this.includeStain(x,y,size*(death?1.8:2.8)+4);
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.fillStyle=death?'rgba(84,104,42,.76)':'rgba(99,126,49,.66)';ctx.beginPath();
    // Lobed tears and a narrow inner clot; no extra live particles or objects.
    ctx.moveTo(-size,0);ctx.bezierCurveTo(-size*.75,-size*.85,-size*.2,-size*.38,size*.1,-size*.66);ctx.bezierCurveTo(size*.8,-size*.8,size*1.2,-size*.05,size*.65,size*.24);ctx.bezierCurveTo(size*.9,size*.75,size*.08,size*.43,-size*.22,size*.58);ctx.bezierCurveTo(-size*.7,size*.77,-size*.55,size*.1,-size,0);ctx.fill();
    if(death){ctx.strokeStyle='rgba(170,184,90,.52)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-size*.65,-size*.04);ctx.quadraticCurveTo(-size*.05,-size*.28,size*.55,size*.1);ctx.stroke();}
    const n=Math.max(0,Math.round(FX_CONFIG.stainDetail*FX_CONFIG.splatterDensity));
    for(let i=0;i<n;i++){
      const a=death?visualRand(0,TAU):visualRand(-.6,.6),d=visualRand(size*.35,size*(death?1.45:2.4)),r=visualRand(1,size*.3);
      ctx.fillStyle=i%3===0?'rgba(132,145,65,.45)':'rgba(41,66,31,.62)';ctx.beginPath();ctx.ellipse(Math.cos(a)*d,Math.sin(a)*d,r,r*.55,a,0,TAU);ctx.fill();
    }
    if(death){ctx.fillStyle='rgba(169,174,76,.35)';ctx.beginPath();ctx.ellipse(-size*.15,-size*.1,size*.38,size*.17,-.4,0,TAU);ctx.fill();}
    ctx.restore();
  }
  hit(e,amount,sx,sy,meta,g) {
    const species=e.isResonator?'resonator':e.kind,profile=GORE_PROFILES[species];
    if(!this.enabled||!profile)return false;
    const explosive=meta.damageType==='explosive';
    const angle=!explosive&&Number.isFinite(meta.vx)?Math.atan2(meta.vy,meta.vx):Math.atan2(e.y-(sy??e.y),e.x-(sx??e.x-1));
    const force=clamp(amount/e.maxHp,0,1),same=e.visualHitTick===g.time;
    e.visualHitTick=g.time;e.reactAngle=angle;e.reactT=.16;e.reactStrength=clamp(Math.max(e.reactStrength||0,force)+force*.08,0,1);
    if(same)return true;
    const x=explosive?e.x:e.x-Math.cos(angle)*e.r*.7,y=explosive?e.y:e.y-Math.sin(angle)*e.r*.7;
    this.stain(x,y,3+force*7,angle);
    g.particles.burst(x,y,Math.max(0,Math.round((3+force*6)*FX_CONFIG.splatterDensity)),{angle,spread:1.15,speed:130+force*110,life:.22,lifeVar:.12,size:1.6+force*1.8,color:'#a4b455',color2:'#4c632c',drag:.86,type:'droplet'});
    if(force>.3){g.shake(1.2+force);this.fragment(x,y,angle,profile.hit,(3+force*3)*profile.hitScale,100,1,species);}
    if(g.sfx.biologicalHit)g.sfx.biologicalHit(meta.weaponId,force);
    return true;
  }
  fragment(x,y,angle,type,size,speed,lift=1,species=null) {
    if(!this.enabled||FX_CONFIG.maxGibs<=0)return;
    while(this.gibs.length>=FX_CONFIG.maxGibs){const old=this.gibs.shift();this.bake(old);}
    const colors=TISSUE_COLORS[type],a=angle+visualRand(-.9,.9),v=visualRand(speed*.45,speed);
    this.gibs.push({x,y,z:visualRand(2,8),vz:visualRand(100,220)*lift,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:visualRand(0,TAU),spin:visualRand(-9,9),size,type,species,color:colors[Math.floor(visualRand(0,colors.length))],age:0,landed:false});this.emitted++;
  }
  death(e,meta,g) {
    const species=e.isResonator?'resonator':e.kind,profile=GORE_PROFILES[species];
    if(!this.enabled||!profile)return false;
    const large=species==='snapper'||species==='maw',explosive=meta.damageType==='explosive',a=e.reactAngle??e.angle,types=profile.death;
    this.stain(e.x,e.y,e.r*profile.stain,a,true);
    const variant=Math.floor(visualRand(0,3));
    for(let i=0;i<types.length;i++){
      const type=types[(i+variant)%types.length],angle=explosive?i/types.length*TAU+visualRand(-.25,.25):a+visualRand(-1.1,1.1);
      const size=(type==='jaw'?15:type==='seed'?3:visualRand(8,13))*profile.scale;
      this.fragment(e.x+visualRand(-e.r*.3,e.r*.3),e.y+visualRand(-e.r*.3,e.r*.3),angle,type,size,explosive?290:profile.speed,explosive?1.25:1,species);
    }
    g.particles.burst(e.x,e.y,Math.round((large?18:11)*FX_CONFIG.splatterDensity),{angle:a,spread:explosive?TAU:1.9,speed:explosive?270:210,life:.42,lifeVar:.18,size:large?4:3,color:'#889e3c',color2:'#435620',drag:.87,type:'droplet'});
    g.shake(species==='maw'?5.2:large?4.3:species==='thorn'?2.8:1.5);
    if(g.sfx.tear)g.sfx.tear(species,explosive);
    return true;
  }
  bake(p) {
    if(this.ink&&this.enabled){const z=p.z;p.z=0;this.ink.save();this.ink.globalAlpha=.7;drawCachedTissue(this.ink,p);this.ink.restore();p.z=z;this.includeStain(p.x,p.y,p.size*3+4);this.stampCount++;}
  }
  update(dt,g) {
    if(!this.enabled){this.gibs.length=0;return;}
    for(let i=this.gibs.length-1;i>=0;i--){const p=this.gibs[i];p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=720*dt;p.rot+=p.spin*dt;
      if(p.z<=0){p.z=0;p.vz=0;p.vx*=Math.exp(-8*dt);p.vy*=Math.exp(-8*dt);p.spin*=Math.exp(-8*dt);
        if(!p.landed){p.landed=true;this.landed++;this.stain(p.x,p.y,p.size*.65,p.rot);if(p.size>=9&&g.sfx.fragment)g.sfx.fragment();}
      }else{p.vx*=Math.exp(-1.5*dt);p.vy*=Math.exp(-1.5*dt);}
      if(p.age>=FX_CONFIG.gibLife||(p.landed&&p.age>.6&&Math.hypot(p.vx,p.vy)<18)){this.bake(p);this.gibs.splice(i,1);}
    }
  }
  drawStains(ctx,view) {
    if(!this.enabled||!this.surface||!this.stainBounds)return;
    const b=this.stainBounds,x=clamp(Math.max(view.x0,b.x0),0,this.w),y=clamp(Math.max(view.y0,b.y0),0,this.h),w=clamp(Math.min(view.x1,b.x1),0,this.w)-x,h=clamp(Math.min(view.y1,b.y1),0,this.h)-y;
    if(w>0&&h>0)ctx.drawImage(this.surface,x*this.scale,y*this.scale,w*this.scale,h*this.scale,x,y,w,h);
  }
  drawFragments(ctx,view) {
    if(!this.enabled)return;
    for(const p of this.gibs){if(p.x<view.x0-60||p.x>view.x1+60||p.y<view.y0-60||p.y>view.y1+120)continue;
      if(p.z>1){ctx.fillStyle='rgba(9,10,7,.23)';ctx.beginPath();ctx.ellipse(p.x,p.y,p.size*.7,p.size*.26,0,0,TAU);ctx.fill();}drawCachedTissue(ctx,p);
    }
  }
}
