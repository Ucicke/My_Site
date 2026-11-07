// pickups.js — подбираемые предметы: оружие, здоровье, патроны
'use strict';
// At most one immutable 96x80 image per existing weapon definition (20 maximum).
const LOOT_SPRITES=new Map();
const LOOT_OUTLINES=new Map();
const PICKUP_SELECTION_SIDES=[-1,1];
// The indicator only points through clear space; it never changes selection or pickup.
function findDryLootTarget(g){
 const p=g.player,h=p.hands;if((h[0]&&!h[0].empty)||(h[1]&&!h[1].empty))return null;
 let best=null,bestDistance=Infinity;
 for(const item of g.pickups){if(item.dead||item.type!=='weapon'||item.ammo<=0||item.lock>0||item.avoidMagnet)continue;const dx=item.x-p.x,dy=item.y-p.y,d2=dx*dx+dy*dy;if(d2>=bestDistance)continue;let blocked=false;
  for(const ob of LEVEL.obstacles){const t=clamp(((ob.x-p.x)*dx+(ob.y-p.y)*dy)/(d2||1),0,1),ox=p.x+t*dx-ob.x,oy=p.y+t*dy-ob.y,r=ob.r+p.r+4;if(ox*ox+oy*oy<r*r){blocked=true;break;}}
  if(!blocked){best=item;bestDistance=d2;}
 }
 return best;
}
function drawLootOrgan(ctx,id,x,y,scale=1,outlined=false) {
  if(typeof document==='undefined'||typeof document.createElement!=='function'){drawOrganicWeapon(ctx,id,x-8*scale,y,0,.85*scale,0);return;}
  if(!LOOT_SPRITES.has(id)){
    const surface=document.createElement('canvas');surface.width=96;surface.height=80;
    const ink=surface.getContext('2d');
    if(typeof botanicalUIReady==='function'&&botanicalUIReady())drawWeaponPortrait(ink,id,48,40,38,0,false);
    else drawOrganicWeapon(ink,id,40,40,0,.85,0);
    LOOT_SPRITES.set(id,surface);
  }
  const sprite=LOOT_SPRITES.get(id);
  if(!outlined){ctx.drawImage(sprite,x-48*scale,y-40*scale,96*scale,80*scale);return;}
  if(!LOOT_OUTLINES.has(id)){
    const surface=document.createElement('canvas');surface.width=102;surface.height=86;const ink=surface.getContext('2d');
    for(const [dx,dy] of [[-2,0],[2,0],[0,-2],[0,2],[-1,-1],[-1,1],[1,-1],[1,1]])ink.drawImage(sprite,3+dx,3+dy);
    ink.globalCompositeOperation='source-in';ink.fillStyle='#d6d0a0';ink.fillRect(0,0,102,86);ink.globalCompositeOperation='source-over';ink.drawImage(sprite,3,3);LOOT_OUTLINES.set(id,surface);
  }
  ctx.drawImage(LOOT_OUTLINES.get(id),x-51*scale,y-43*scale,102*scale,86*scale);
}

class Pickup {
  constructor(x, y, type, weaponId = null, ammo = 0) {
    this.x = x;
    this.y = y;
    this.vx = rand(-40, 40);
    this.vy = rand(-40, 40);
    this.type = type;               // 'weapon' | 'health'
    this.weaponId = weaponId;
    this.ammo = ammo;               // оставшиеся патроны (для оружия)
    this.r = 14;
    this.life = type === 'weapon' ? Infinity : 22;
    this.bob = visualRand(0, TAU);
    this.lock = 0;                  // защита от мгновенного подбора выброшенного
    this.dead = false;
    this.spawnT = 0;
  }

  update(dt, g) {
    this.spawnT += dt;
    if (this.avoidMagnet && dist(g.player.x, g.player.y, this.x, this.y) > 160) this.avoidMagnet = false;
    if (this.lock > 0) this.lock -= dt;
    if (this.life !== Infinity) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
    }
    // инерция
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= Math.pow(0.88, dt * 60);
    this.vy *= Math.pow(0.88, dt * 60);

    // отталкивание от препятствий
    for (const o of LEVEL.obstacles) {
      const d = dist(this.x, this.y, o.x, o.y);
      const min = o.r + this.r;
      if (d < min && d > 0.001) {
        const push = (min - d);
        const nx = (this.x - o.x) / d, ny = (this.y - o.y) / d;
        this.x += nx * push;
        this.y += ny * push;
        this.vx += nx * push * 4;
        this.vy += ny * push * 4;
      }
    }

    // держимся в мире
    this.x = clamp(this.x, 30, LEVEL.w - 30);
    this.y = clamp(this.y, 30, LEVEL.h - 30);
  }

  draw(ctx,t,selected=false,dryFocus=false) {
    const y=this.y+Math.sin(t*3+this.bob)*2;
    ctx.save();
    if(this.type==='weapon') {
      const oldStyle=typeof window!=='undefined'&&window.DEADWEED_LOOT_STYLE==='old';
      if(!oldStyle){ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.ellipse(this.x,this.y+11,16,5,0,0,TAU);ctx.fill();}
      ctx.globalAlpha=oldStyle?(selected?1:.7):1;drawLootOrgan(ctx,this.weaponId,this.x,y,selected?1:(oldStyle?0.72:0.83),!oldStyle);ctx.globalAlpha=1;
      if(dryFocus&&!oldStyle){ctx.strokeStyle='rgba(241,222,160,.85)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(this.x,this.y,21,0,TAU);ctx.stroke();}
      // Access signal is separate from the organ and its deliberately requested details.
      ctx.fillStyle=this.lock>0||this.avoidMagnet||this.ammo<=0?'#71766d':'#e1d7a1';ctx.fillRect(this.x-(oldStyle?2:3),y+15,oldStyle?4:6,oldStyle?2:3);
      if(selected){ctx.strokeStyle='#e3d49f';ctx.lineWidth=1.5;ctx.beginPath();for(const s of PICKUP_SELECTION_SIDES){ctx.moveTo(this.x+s*19,y-8);ctx.lineTo(this.x+s*19,y-14);ctx.lineTo(this.x+s*12,y-14);ctx.moveTo(this.x+s*19,y+7);ctx.lineTo(this.x+s*19,y+12);ctx.lineTo(this.x+s*12,y+12);}ctx.stroke();}
    } else if(this.type==='health') {
      ctx.globalAlpha=clamp(this.life/3,0,1);ctx.fillStyle='#8baa9a';ctx.beginPath();ctx.arc(this.x,y,7.5,0,TAU);ctx.fill();ctx.fillStyle='#163c33';ctx.fillRect(this.x-5,y-1.5,10,3);ctx.fillRect(this.x-1.5,y-5,3,10);
    }
    ctx.restore();
  }
}
