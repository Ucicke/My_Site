// Responsive Canvas UI: rendering and hit testing share a layout.
'use strict';
const UI_FONT='Consolas, monospace';
const UI_DISPLAY_FONT='"DeadweedTerminal", Consolas, monospace';
const UI_TITLE_FONT='"DeadweedTitle", "DeadweedTerminal", Consolas, monospace';
// Scratch geometry is consumed synchronously by Canvas; reusing it avoids
// allocating four small arrays and one rectangle for every HUD panel.
const UI_PANEL_RECT={x:0,y:0,w:0,h:0};
const UI_FRAME_SOURCE_X=new Float64Array(4),UI_FRAME_SOURCE_Y=new Float64Array(4);
const UI_FRAME_DEST_X=new Float64Array(4),UI_FRAME_DEST_Y=new Float64Array(4);
const UI_METER_GRADIENT_CACHE=[];
let UI_METER_GRADIENT_NEXT=0;
const UI_HUD_METER_TRANSFORM={a:1,b:0,c:0,d:1,e:0,f:0};
let UI_SNAP_SCALE_X=1,UI_SNAP_SCALE_Y=1;
const DRIFT_ART_KEYS=['play','settings','info','volume_up','target','warning','medkit','arrow_left','pause'];
const INPUT_ART_KEYS=[...Array.from('abcdefghijklmnopqrstuvwxyz',k=>'keyboard_'+k),...Array.from({length:10},(_,i)=>'keyboard_'+i),...Array.from({length:12},(_,i)=>'keyboard_f'+(i+1)),...['tab','space','enter','escape','shift','ctrl','alt','backspace','end','arrow_up','arrow_down','arrow_left','arrow_right'].map(k=>'keyboard_'+k),...['button_a','button_b','button_x','button_y','button_view','button_start','dpad_up','dpad_down','dpad_left','dpad_right','lb','rb','lt','rt','ls','rs'].map(k=>'xbox_'+k),...['button_cross','button_circle','button_square','button_triangle','dpad_up','dpad_down','dpad_left','dpad_right','trigger_l1','trigger_r1','trigger_l2','trigger_r2','button_l3','button_r3'].map(k=>'playstation_'+k),'playstation4_button_share','playstation4_button_options'];
const INPUT_XBOX_ICONS={confirm:'button_a',back:'button_b',newRun:'button_a',collectLeft:'button_x',collectRight:'button_y',fuse:'button_view',pause:'button_start',inspect:'dpad_up',dig:'dpad_down',dropLeft:'dpad_left',dropRight:'dpad_right',dash:'button_a',melee:'button_b',fireLeft:'lt',fireRight:'rt',sprint:'ls',flipLeft:'rs'};
const INPUT_PLAYSTATION_ICONS={confirm:'button_cross',back:'button_circle',newRun:'button_cross',collectLeft:'button_square',collectRight:'button_triangle',inspect:'dpad_up',dig:'dpad_down',dropLeft:'dpad_left',dropRight:'dpad_right',dash:'button_cross',melee:'button_circle',fireLeft:'trigger_l2',fireRight:'trigger_r2',sprint:'button_l3',flipLeft:'button_r3'};
const INPUT_KEY_ICONS={Tab:'tab',Space:'space',Enter:'enter',Escape:'escape',ShiftLeft:'shift',ShiftRight:'shift',ControlLeft:'ctrl',ControlRight:'ctrl',AltLeft:'alt',AltRight:'alt',Backspace:'backspace',End:'end',ArrowUp:'arrow_up',ArrowDown:'arrow_down',ArrowLeft:'arrow_left',ArrowRight:'arrow_right'};
const INPUT_CODE_FALLBACK={confirm:'Enter',back:'Escape',menuUp:'ArrowUp',menuDown:'ArrowDown'};
const HINT_KEY_FALLBACK={confirm:'Enter',back:'Esc'};
const ACTION_HINT_SCRATCH=Array.from({length:8},()=>({img:null,key:'',label:'',keyW:0,w:0}));
const HINTS_FUSE_CANCEL=[['fuse','отпустить'],['inspect','характеристики']];
const HINTS_PICKUP_HANDS=[['collectLeft','левая рука'],['collectRight','правая рука']];
const HINTS_PICKUP_DETAILS=[['collectLeft','левая рука'],['collectRight','правая рука'],['inspect','характеристики']];
const HINTS_INSPECT=[['inspect','характеристики']];
const HINTS_FUSE=[['fuse','срастить'],['inspect','характеристики']];
const HINTS_PAUSE=[['confirm','выбор'],['back','продолжить']];
const HINTS_MENU=[['confirm','выбрать']];
function inputIconName(input,action,keyboardOnly=false) {
 if(input.usingPad&&!keyboardOnly) {
  if(input.padStyle==='playstation')return action==='fuse'?'playstation4_button_share':action==='pause'?'playstation4_button_options':INPUT_PLAYSTATION_ICONS[action]?'playstation_'+INPUT_PLAYSTATION_ICONS[action]:null;
  return INPUT_XBOX_ICONS[action]?'xbox_'+INPUT_XBOX_ICONS[action]:null;
 }
 const code=input.bindingCode(action)||INPUT_CODE_FALLBACK[action]||'';
 if(/^Key[A-Z]$/.test(code))return 'keyboard_'+code.slice(3).toLowerCase();
 if(/^Digit[0-9]$/.test(code))return 'keyboard_'+code.slice(5);
 if(/^F([1-9]|1[0-2])$/.test(code))return 'keyboard_'+code.toLowerCase();
 return INPUT_KEY_ICONS[code]?'keyboard_'+INPUT_KEY_ICONS[code]:null;
}
function drawActionHints(ctx,input,hints,x,y,width,color='#b9d1bf',scale=1) {
 const fontSize=Math.round(11*scale),iconH=24*scale,innerGap=10*scale,outerGap=10*scale;
 ctx.font='bold '+fontSize+'px '+UI_FONT;
 const count=hints.length;if(count>ACTION_HINT_SCRATCH.length){let fallback='';for(let i=0;i<count;i++){const [action,label]=hints[i];if(i)fallback+=' · ';fallback+=(input.prompt(action)||HINT_KEY_FALLBACK[action]||action)+' '+label;}uiFit(ctx,fallback,x,y,width,fontSize,color);return;}
 let totalWidth=0;
 for(let i=0;i<count;i++){const [action,label]=hints[i],piece=ACTION_HINT_SCRATCH[i],img=getSprite('input_'+inputIconName(input,action)),key=input.prompt(action)||HINT_KEY_FALLBACK[action]||action,keyW=img?Math.min(44*scale,iconH*img.naturalWidth/img.naturalHeight):ctx.measureText(key).width+8*scale;piece.img=img;piece.key=key;piece.label=label;piece.keyW=keyW;piece.w=keyW+ctx.measureText(label).width+innerGap;totalWidth+=piece.w;}
 if(totalWidth+outerGap*(count-1)>width){let fallback='';for(let i=0;i<count;i++){const piece=ACTION_HINT_SCRATCH[i];if(i)fallback+=' · ';fallback+=piece.key+' '+piece.label;}uiFit(ctx,fallback,x,y,width,fontSize,color);return;}
 for(let i=0;i<count;i++){const piece=ACTION_HINT_SCRATCH[i];if(piece.img)ctx.drawImage(piece.img,x,y-iconH*.75,piece.keyW,iconH);else uiText(ctx,piece.key,x+2*scale,y,fontSize,'#e2e9c8');uiText(ctx,piece.label,x+piece.keyW+5*scale,y+scale,fontSize,color);x+=piece.w+outerGap;}
}
function drawDriftIcon(ctx,key,x,y,size=20) {
 const img=getSprite('drift_'+key);if(!img)return false;ctx.drawImage(img,x,y,size,size);return true;
}
// BOTANICAL ATLAS BEGIN
const BOTANICAL_UI_RECTS={"bio_bone":[19,4,89,120],"bio_tendon":[150,4,83,120],"bio_cocoon":[274,4,91,120],"bio_vertebra":[420,4,55,120],"bio_carapace":[517,4,117,120],"bio_hive":[655,4,97,120],"bio_needle":[780,4,104,120],"bio_womb":[914,4,91,120],"biotech_btn_wide_normal":[4,133,248,118],"biotech_btn_wide_focus":[260,132,248,120],"biotech_btn_wide_violet_normal":[516,132,248,120],"biotech_btn_wide_violet_focus":[772,132,248,120],"biotech_checkbox_off_normal":[6,260,116,120],"biotech_checkbox_on_normal":[135,260,113,120],"biotech_checkbox_off_focus":[264,260,111,120],"biotech_checkbox_on_focus":[392,260,111,120],"biotech_slot_tile_normal":[522,260,108,120],"biotech_slot_tile_focus":[650,260,108,120],"biotech_dna":[801,260,61,120],"biotech_biomass":[904,260,112,120]};
// BOTANICAL ATLAS END
function initializeBotanicalUI(root) {
 if(!SPRITES.botanical_ui) {
  const image=registerSprite('botanical_ui',root+'atlas.png');
  if(image)image.onload=()=>{if(botanicalUIReady()&&typeof LOOT_SPRITES!=='undefined')LOOT_SPRITES.clear();};
 }
}
function botanicalUIReady() {
 const img=getSprite('botanical_ui');return !!img&&img.naturalWidth===1024&&img.naturalHeight===384;
}
function drawBotanicalSprite(ctx,key,x,y,w,h=w) {
 const r=BOTANICAL_UI_RECTS[key];if(!r||!botanicalUIReady())return false;
 const scale=Math.min(w/r[2],h/r[3]),dw=r[2]*scale,dh=r[3]*scale;
 ctx.drawImage(getSprite('botanical_ui'),...r,x+(w-dw)/2,y+(h-dh)/2,dw,dh);return true;
}
// Shared atlas: horizontal 3-slice buttons and transparent 9-slice root frames.
function drawBiotechButton(ctx,r,selected,violet=false) {
 const a=BOTANICAL_UI_RECTS['biotech_btn_wide'+(violet?'_violet':'')+(selected?'_focus':'_normal')];if(!a||!botanicalUIReady())return false;
 const img=getSprite('botanical_ui'),[sx,sy,sw,sh]=a,edge=Math.min(40,sw/4),left=uiSnap(ctx,r.x,'x'),top=uiSnap(ctx,r.y,'y'),right=uiSnap(ctx,r.x+r.w,'x'),bottom=uiSnap(ctx,r.y+r.h,'y'),w=right-left,h=bottom-top,d=Math.min(w/3,edge*h/sh),x1=uiSnap(ctx,left+d,'x'),x2=uiSnap(ctx,right-d,'x');
 ctx.save();ctx.globalAlpha=selected?1:.88;
 ctx.drawImage(img,sx,sy,edge,sh,left,top,x1-left,h);
 ctx.drawImage(img,sx+edge,sy,sw-edge*2,sh,x1,top,x2-x1,h);
 ctx.drawImage(img,sx+sw-edge,sy,edge,sh,x2,top,right-x2,h);
 ctx.restore();return true;
}
function drawBiotechFrame(ctx,r,selected) {
 const a=BOTANICAL_UI_RECTS['biotech_slot_tile_'+(selected?'focus':'normal')];if(!a||!botanicalUIReady())return false;
 const img=getSprite('botanical_ui'),[sx,sy,sw,sh]=a,edge=Math.round(Math.min(sw,sh)*.2),sourceX=UI_FRAME_SOURCE_X,sourceY=UI_FRAME_SOURCE_Y,dx=UI_FRAME_DEST_X,dy=UI_FRAME_DEST_Y;
 sourceX[0]=sx;sourceX[1]=sx+edge;sourceX[2]=sx+sw-edge;sourceX[3]=sx+sw;
 sourceY[0]=sy;sourceY[1]=sy+edge;sourceY[2]=sy+sh-edge;sourceY[3]=sy+sh;
 const left=uiSnap(ctx,r.x,'x'),top=uiSnap(ctx,r.y,'y'),right=uiSnap(ctx,r.x+r.w,'x'),bottom=uiSnap(ctx,r.y+r.h,'y'),corner=Math.min(17,(right-left)/3,(bottom-top)/3);
 dx[0]=left;dx[1]=uiSnap(ctx,left+corner,'x');dx[2]=uiSnap(ctx,right-corner,'x');dx[3]=right;
 dy[0]=top;dy[1]=uiSnap(ctx,top+corner,'y');dy[2]=uiSnap(ctx,bottom-corner,'y');dy[3]=bottom;
 ctx.save();ctx.globalAlpha=selected?1:.72;
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)ctx.drawImage(img,sourceX[col],sourceY[row],sourceX[col+1]-sourceX[col],sourceY[row+1]-sourceY[row],dx[col],dy[row],dx[col+1]-dx[col],dy[row+1]-dy[row]);
 ctx.restore();return true;
}
function drawBiotechPanel(ctx,r,selected=false) {
 return drawBiotechFrame(ctx,r,selected);
}
function drawBiotechIcon(ctx,key,x,y,size) {
 return drawBotanicalSprite(ctx,'biotech_'+key,x,y,size);
}
// Botanical horror cutouts generated for DEADWEED. See assets/botanical-horror/SOURCE.md.
const BIO_ART_KEYS=['bone','tendon','cocoon','vertebra','carapace','hive','needle','womb'];
const BIO_WEAPON_ART={bone:'bone',spitter:'needle',seedshot:'hive',thorn:'tendon',glob:'womb'};
const BIO_UPGRADE_ART={boneBounce:'bone',thornPierce:'tendon',seedSlug:'hive',spitterSlow:'needle',globEcho:'womb',relay:'vertebra',
 'Толстая гниль':'carapace','Проворные руки':'cocoon','Быстрые пальцы':'needle','Острые кости':'bone','Вампирский голод':'hive','Гнилая регенерация':'cocoon','Лёгкий рывок':'tendon','Гильдия охотников':'womb','Второе сердце':'womb','Толстый череп':'carapace','Глубокие карманы':'vertebra'};
function drawBioIcon(ctx,key,x,y,size,t=0,framed=true) {
 if(!BOTANICAL_UI_RECTS['bio_'+key]||!botanicalUIReady())return false;
 ctx.save();
 if(framed) {
  const glow=ctx.createRadialGradient(x,y,0,x,y,size*.58);glow.addColorStop(0,'#264b47');glow.addColorStop(1,'rgba(10,22,21,0)');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,size*.58,0,TAU);ctx.fill();
 }
 const breath=1+Math.sin(t*2.4)*.018,edge=size*breath;
 drawBotanicalSprite(ctx,'bio_'+key,x-edge/2,y-edge/2,edge);
 ctx.restore();return true;
}
function drawWeaponPortrait(ctx,id,x,y,size,t=0,framed=true) {
 const def=WEAPON_DEFS[id];if(!def)return;
 // Prefer the same articulated graft used in the player's hands and on the
 // ground. Generated UI portraits remain a graceful fallback before rig load.
 if(typeof drawArtWeapon==='function'&&drawArtWeapon(ctx,id,x-size*.29,y,0,size/38,Math.sin(t*2.4)*.32))return;
 if(!def.fused) {
  if(!drawBioIcon(ctx,BIO_WEAPON_ART[id],x,y,size,t,framed))drawOrganicWeapon(ctx,id,x-8,y,0,size/55);
  return;
 }
 const genes=def.genes;
 if(!botanicalUIReady()) {drawOrganicWeapon(ctx,id,x-8,y,0,size/55);return;}
 ctx.save();
 drawBioIcon(ctx,BIO_WEAPON_ART[genes[0]],x-size*.17,y-size*.05,size*.77,t,false);
 drawBioIcon(ctx,BIO_WEAPON_ART[genes[1]],x+size*.17,y+size*.08,size*.77,t+1,false);
 if(framed)drawBiotechIcon(ctx,'dna',x,y+size*.34,size*.2);ctx.restore();
}
function drawBoundedCopy(ctx,text,x,y,width,lineHeight,maxLines) {
 const words=String(text).split(' '),lines=[];let line='';
 for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width && line){lines.push(line);line=word;}else line=next;}
 if(line)lines.push(line);
 const visible=lines.slice(0,Math.max(0,maxLines));
 if(lines.length>visible.length && visible.length){let last=visible[visible.length-1];while(last && ctx.measureText(last+'…').width>width)last=last.slice(0,-1);visible[visible.length-1]=last+'…';}
 visible.forEach((value,i)=>ctx.fillText(value,uiSnap(ctx,x,'x'),uiSnap(ctx,y+i*lineHeight,'y')));return y+visible.length*lineHeight;
}
function uiText(ctx,text,x,y,size=14,color='#d9eddb',align='left',font=typeof text==='number'?UI_DISPLAY_FONT:UI_FONT) {
 ctx.font='bold '+size+'px '+font;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(String(text),uiSnap(ctx,x,'x'),uiSnap(ctx,y,'y'));
}
function uiSnap(ctx,value,axis='x') {
 const scale=Math.abs(axis==='y'?UI_SNAP_SCALE_Y:UI_SNAP_SCALE_X)||1;
 return Math.round(value*scale)/scale;
}
function setUiSnapScale(scaleX,scaleY=scaleX) {UI_SNAP_SCALE_X=scaleX||1;UI_SNAP_SCALE_Y=scaleY||1;}
function uiPanel(ctx,x,y,w,h,color='#172720',selected=false) {
 const right=uiSnap(ctx,x+w,'x'),bottom=uiSnap(ctx,y+h,'y');x=uiSnap(ctx,x,'x');y=uiSnap(ctx,y,'y');w=right-x;h=bottom-y;
 const r=UI_PANEL_RECT,inset=Math.min(22,Math.max(8,Math.min(w,h)*.28));r.x=x;r.y=y;r.w=w;r.h=h;
 // Keep the tinted surface inside the transparent center of the organic frame.
 const innerLeft=uiSnap(ctx,x+inset,'x'),innerTop=uiSnap(ctx,y+inset,'y'),innerRight=uiSnap(ctx,x+w-inset,'x'),innerBottom=uiSnap(ctx,y+h-inset,'y');
 ctx.save();ctx.globalAlpha=selected?.2:.12;ctx.fillStyle=color;ctx.fillRect(innerLeft,innerTop,Math.max(0,innerRight-innerLeft),Math.max(0,innerBottom-innerTop));ctx.restore();
 drawBiotechPanel(ctx,r,selected);
}
function uiRoundRect(ctx,x,y,w,h,r) {
 r=Math.max(0,Math.min(r,w/2,h/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function drawBioMeter(ctx,x,y,w,h,value,color='#a6d783',cacheTransform=null) {
 if(w<=0||h<=0)return;const r=h/2,v=clamp(value,0,1),innerX=x+1,innerY=y+1,innerW=Math.max(0,w-2),innerH=Math.max(1,h-2),fillW=innerW*v;
 ctx.save();uiRoundRect(ctx,x,y,w,h,r);ctx.fillStyle='rgba(3,12,9,.88)';ctx.fill();ctx.clip();
 if(fillW>0){ctx.fillStyle=color;ctx.fillRect(innerX,innerY,fillW,innerH);
  if(cacheTransform){
   let shine=null;const backingW=ctx.canvas.width,backingH=ctx.canvas.height;
   for(let i=0;i<UI_METER_GRADIENT_CACHE.length;i++){const entry=UI_METER_GRADIENT_CACHE[i];if(entry.ctx===ctx&&entry.y===innerY&&entry.h===innerH&&entry.backingW===backingW&&entry.backingH===backingH&&entry.a===cacheTransform.a&&entry.b===cacheTransform.b&&entry.c===cacheTransform.c&&entry.d===cacheTransform.d&&entry.e===cacheTransform.e&&entry.f===cacheTransform.f){shine=entry.gradient;break;}}
   if(!shine){shine=ctx.createLinearGradient(0,innerY,0,innerY+innerH);shine.addColorStop(0,'rgba(235,250,193,.28)');shine.addColorStop(.55,'rgba(235,250,193,.04)');shine.addColorStop(1,'rgba(2,12,8,.22)');const entry={ctx,y:innerY,h:innerH,backingW,backingH,a:cacheTransform.a,b:cacheTransform.b,c:cacheTransform.c,d:cacheTransform.d,e:cacheTransform.e,f:cacheTransform.f,gradient:shine};if(UI_METER_GRADIENT_CACHE.length<32)UI_METER_GRADIENT_CACHE.push(entry);else{UI_METER_GRADIENT_CACHE[UI_METER_GRADIENT_NEXT]=entry;UI_METER_GRADIENT_NEXT=(UI_METER_GRADIENT_NEXT+1)%32;}}
   ctx.fillStyle=shine;ctx.fillRect(innerX,innerY,fillW,innerH);
  }else {ctx.fillStyle='rgba(235,250,193,.12)';ctx.fillRect(innerX,innerY,fillW,Math.min(1,innerH));}
  if(h>=6)for(let sx=innerX+18;sx<innerX+fillW-2;sx+=22){ctx.fillStyle='rgba(5,17,10,.25)';ctx.fillRect(sx,innerY+1,1,innerH-2);}
 }
 ctx.restore();ctx.save();uiRoundRect(ctx,x+.5,y+.5,Math.max(0,w-1),Math.max(0,h-1),r);ctx.strokeStyle='rgba(152,181,125,.52)';ctx.lineWidth=Math.min(1,h*.16);ctx.stroke();ctx.restore();
}
function drawBioKnot(ctx,x,y,r,value) {
 const glow=ctx.createRadialGradient(x-r*.2,y-r*.3,1,x,y,r);glow.addColorStop(0,value>0?'#e7f2bd':'#73836a');glow.addColorStop(.65,value>0?'#98b96e':'#394b3d');glow.addColorStop(1,'#16251c');
 ctx.save();ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.strokeStyle='#c3d18f';ctx.lineWidth=Math.max(1,r*.16);ctx.stroke();ctx.restore();
}
function wrapText(ctx,text,cx,y,maxWidth,lineHeight) {
 let line='',yy=y;
 for(const word of String(text).split(' ')) {const next=line ? line+' '+word:word;if(ctx.measureText(next).width>maxWidth && line){ctx.fillText(line,uiSnap(ctx,cx,'x'),uiSnap(ctx,yy,'y'));line=word;yy+=lineHeight;}else line=next;}
 if(line)ctx.fillText(line,uiSnap(ctx,cx,'x'),uiSnap(ctx,yy,'y'));return yy+lineHeight;
}
function getUpgradeLayout(vw,vh,count=3) {
 const vertical=vw<740, gap=12;
 if(vertical) {const top=vh<420?96:vh<600?96:135,h=Math.max(36,Math.min(164,(vh-top-24-gap*(count-1))/count));return Array.from({length:count},(_,i)=>({x:16,y:top+i*(h+gap),w:vw-32,h}));}
 const w=Math.min(238,(vw-64-gap*(count-1))/count), h=Math.min(300,vh-200),x=(vw-count*w-gap*(count-1))/2;
 return Array.from({length:count},(_,i)=>({x:x+i*(w+gap),y:150,w,h}));
}
function drawHandSlot(ctx,g,x,y,index,label,w=196,meterTransform=null) {
 const weapon=g.player.hands[index], empty=!weapon || weapon.empty;
 uiPanel(ctx,x,y,w,67);
 uiText(ctx,label,x+22,y+23,10,'#a4bcae');
 if(weapon)drawWeaponPortrait(ctx,weapon.id,x+36,y+35,26,g.time);
 let name=weapon ? weapon.def.name:'Пустая рука';ctx.font='bold 12px '+UI_FONT;
 while(ctx.measureText(name).width>w-100 && name.length>4)name=name.slice(0,-2)+'…';
 uiText(ctx,name,x+62,y+42,12);
 uiText(ctx,empty ? '—':weapon.ammo,x+w-23,y+42,16,empty?'#ffb888':'#e6fcae','right');
 drawBioMeter(ctx,x+22,y+49,w-44,5,empty?0:weapon.ammo/weapon.cap,empty?'#956045':weapon.ammo<weapon.cap*0.2?'#d59a63':'#a9cb77',meterTransform);
}
function drawWorldSignals(ctx,g) {
 const o=g.objective;
 if(o&&(o.kind==='hold'||o.kind==='survive')) {
  ctx.fillStyle='rgba(100,210,240,0.09)';ctx.strokeStyle='#80def3';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,TAU);ctx.fill();ctx.stroke();
  uiText(ctx,'БЕЗОПАСНЫЙ КРУГ',o.x,o.y-12,12,'#bdefff','center');
 }
 for(const nest of g.nests||[])if(!nest.dead)drawRootNest(ctx,g,nest);
 for(const w of g.spawnWarnings) {
  const statKind=w.kind==='resonator'?'spitter':w.kind,source=w.sourceNestId&&(g.nests||[]).find(n=>n.id===w.sourceNestId);
  if(source){ctx.strokeStyle='rgba(227,190,116,.46)';ctx.lineWidth=2;ctx.setLineDash([7,6]);ctx.beginPath();ctx.moveTo(source.x,source.y);ctx.lineTo(w.x,w.y);ctx.stroke();ctx.setLineDash([]);}
  ctx.strokeStyle='#ffb375';ctx.lineWidth=3;ctx.beginPath();ctx.arc(w.x,w.y,PLANT_STATS[statKind].r+10+(w.t*12),0,TAU);ctx.stroke();uiText(ctx,'!',w.x,w.y+5,18,'#ffce9e','center');
 }
 for(const e of g.enemies) {
  if(e.dead)continue;
  if(g.encounter?.stage2hVariant&&e.stage2hNestId)drawNestOriginMark(ctx,e.stage2hNestId,e.x,e.y-e.r-13);
  if(e.marked || e.recoverT>0 || e.slowT>0) {ctx.strokeStyle=e.marked?'#fff3a2':e.recoverT>0?'#a5eaff':'#91d3fa';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.r+7,0,TAU);ctx.stroke();}
  if(e.marked)uiText(ctx,'ЦЕЛЬ',e.x,e.y-e.r-14,11,'#fff3a2','center');
  if(e.attackWind>0 || e.state==='wind') {
   const a=e.attackAngle===undefined?e.angle:e.attackAngle;
   ctx.strokeStyle='#ffb16d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,e.r+10,0,TAU);ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(a)*110,e.y+Math.sin(a)*110);ctx.stroke();
  }
 }
 if(g.digSite) {
  const site=g.digSite;
  ctx.fillStyle='#725337';ctx.strokeStyle='#c9aa77';ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(site.x,site.y,20,11,0,0,TAU);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#bcda8a';ctx.beginPath();ctx.moveTo(site.x-7,site.y);ctx.quadraticCurveTo(site.x,site.y-19,site.x+8,site.y-8);ctx.stroke();
  if(g.balanceConfig?.stage2mRecovery?.enabled){
   // This is a world marker below the player and bullets, not a new collider.
   ctx.save();ctx.strokeStyle='#eddda5';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(site.x,site.y,26,0,TAU);ctx.stroke();ctx.restore();
  }else{
   uiText(ctx,g.input.prompt('dig')+' · ОТКОПАТЬ',site.x,site.y-29,12,'#ecd3a1','center');
   drawBioMeter(ctx,site.x-22,site.y+16,44,6,site.progress/.9,'#a9c77a');
  }
 }
 if(g.balanceConfig?.stage2mRecovery?.enabled&&g.recoveryFeedbackT>0&&Number.isFinite(g.recoveryFeedbackX)&&Number.isFinite(g.recoveryFeedbackY)){
  ctx.save();ctx.globalAlpha=clamp(g.recoveryFeedbackT/.8,0,1);ctx.strokeStyle='#eddda5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(g.recoveryFeedbackX,g.recoveryFeedbackY,24+(1-clamp(g.recoveryFeedbackT/.8,0,1))*18,0,TAU);ctx.stroke();ctx.restore();
 }
 const p=g.player;
 ctx.strokeStyle='#d2efff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,p.r+9,-Math.PI/2,-Math.PI/2+TAU*(1-clamp(p.dashCd/p.dashCooldown,0,1)));ctx.stroke();
 if(p.invuln>0){ctx.strokeStyle='#eefaff';ctx.beginPath();ctx.arc(p.x,p.y,p.r+4,0,TAU);ctx.stroke();}
}
function drawRootNest(ctx,g,nest) {
 const pulse=.5+.5*Math.sin(g.time*3.1+(nest.id==='west-spore'?0:1.8)),r=nest.r;
 ctx.save();ctx.translate(nest.x,nest.y);
 ctx.shadowColor='rgba(183,220,105,.45)';ctx.shadowBlur=9+pulse*7;
 ctx.fillStyle='#18271a';ctx.strokeStyle=nest.hitFlash>0?'#f2ffd0':'#91ad58';ctx.lineWidth=3;
 ctx.beginPath();ctx.ellipse(0,0,r*.79,r*.69,-.18,0,TAU);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
 for(let i=0;i<5;i++){const a=-Math.PI*.82+i*Math.PI*.41,inner=r*.47,outer=r*(1.13+(i%2)*.12);ctx.strokeStyle=i%2?'#647c3d':'#a0ba61';ctx.lineWidth=i===2?4:2;ctx.beginPath();ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);ctx.quadraticCurveTo(Math.cos(a+.2)*outer*.72,Math.sin(a+.2)*outer*.72,Math.cos(a)*outer,Math.sin(a)*outer);ctx.stroke();ctx.fillStyle='#9ebc64';ctx.beginPath();ctx.ellipse(Math.cos(a)*outer,Math.sin(a)*outer,4,7,a,0,TAU);ctx.fill();}
 ctx.fillStyle=nest.hitFlash>0?'#efffb2':`rgba(183,225,92,${.6+pulse*.35})`;ctx.beginPath();ctx.arc(0,0,r*.3,0,TAU);ctx.fill();
 ctx.strokeStyle='#c1d884';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*.42,g.time*.45,g.time*.45+Math.PI*1.45);ctx.stroke();
 ctx.restore();
 if(g.encounter?.stage2hVariant)drawNestOriginMark(ctx,nest.id,nest.x-54,nest.y-r-27);
 uiText(ctx,nest.label.toUpperCase(),nest.x,nest.y-r-24,11,'#e0e9b2','center');
 const barW=84,barY=nest.y+r+9;ctx.fillStyle='rgba(4,13,8,.85)';ctx.fillRect(nest.x-barW/2-3,barY-3,barW+6,13);drawBioMeter(ctx,nest.x-barW/2,barY,barW,7,nest.hp/nest.maxHp,'#a9cc67');
 const until=Math.max(0,nest.nextActivationAt-(g.currentWaveStats?.seconds||0));
 uiText(ctx,nest.remainingBudget>0?`ПОДКРЕПЛЕНИЕ · ${until.toFixed(1)}с · ×${nest.remainingBudget}`:'ПОДКРЕПЛЕНИЯ ИСЧЕРПАНЫ',nest.x,barY+20,9,'#c9d59b','center');
}
function drawNestOriginMark(ctx,nestId,x,y) {
 ctx.save();ctx.fillStyle=nestId==='west-spore'?'#edc17d':'#a1ddc8';ctx.strokeStyle='#102219';ctx.lineWidth=1.5;
 ctx.beginPath();if(nestId==='west-spore'){ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);}else ctx.arc(x,y,4.5,0,TAU);
 ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function inputFusionLabel(g,p) {return p.fuseT>0?'СРАЩИВАНИЕ… отпусти для отмены':g.input.prompt('fuse')+' УДЕРЖИВАТЬ · БИОМАССИВНЫЙ СПЛАВ';}
// UI consumes the exact object selected by Player.update; no second gameplay selector.
function combatContext(g) {
 const p=g.player,candidate=p.nearbyWeapon;
 const found=candidate&&!candidate.dead&&candidate.lock<=0&&!(candidate.avoidMagnet&&dist2(p.x,p.y,candidate.x,candidate.y)<=160*160)&&candidate.type==='weapon'&&candidate.ammo>0?candidate:null;
 let others=0;
 if(found)for(const item of g.pickups)if(item!==found&&!item.dead&&item.type==='weapon'&&item.ammo>0&&item.lock<=0&&(!item.avoidMagnet||dist2(p.x,p.y,item.x,item.y)>160*160)&&dist2(p.x,p.y,item.x,item.y)<115*115)others++;
 const fusion=fusionPreview(p.hands[0],p.hands[1],UI_FUSION_PREVIEW),inspect=g.input.actionDown('inspect'),merging=g.input.actionDown('fuse');
 const left=p.hands[0],right=p.hands[1],reason=left?.def.fused||right?.def.fused?'Сплав уже стабилен':!left||left.empty||!right||right.empty?'Нужны два заряженных органа':'Недостаточно заряда';
 const state=COMBAT_CONTEXT_STATE;
 state.found=found;state.others=others;state.fusion=fusion;state.inspect=inspect;state.merging=merging;state.reason=reason;state.progress=clamp(p.fuseT/.85,0,1);
 return state;
}
const UI_FUSION_PREVIEW={id:null,def:null,ammo:0,cap:0,sourceDamage:0,resultDamage:0};
const UI_EFFECTIVE_SHOT={};
const COMBAT_CONTEXT_STATE={found:null,others:0,fusion:null,inspect:false,merging:false,reason:'',progress:0};
const COMBAT_LAYOUT={x:0,y:0,w:0,h:0};
const COMBAT_DOCK_OPTIONS=[{x:0,y:0,w:0,h:0},{x:0,y:0,w:0,h:0},{x:0,y:0,w:0,h:0},{x:0,y:0,w:0,h:0}];
const RECOVERY_DOCK_OPTIONS=[{x:0,y:0,w:0,h:0},{x:0,y:0,w:0,h:0},{x:0,y:0,w:0,h:0},{x:0,y:0,w:0,h:0}];
function recoveryEnabled(g){return !!g.balanceConfig?.stage2mRecovery?.enabled;}
function recoveryDry(g){const p=g.player;return (!p.hands[0]||p.hands[0].empty)&&(!p.hands[1]||p.hands[1].empty);}
function recoveryDock(g,vw,vh) {
 const w=Math.min(320,vw-24),h=86,top=Math.min(Math.max(vw<760?175:145,0),Math.max(0,vh-h-84)),bottom=Math.max(top,vh-h-82),right=Math.max(12,vw-w-12),opts=RECOVERY_DOCK_OPTIONS;
 for(let i=0;i<4;i++){const r=opts[i];r.x=i%2?right:12;r.y=i<2?top:bottom;r.w=w;r.h=h;}
 let best=null,bestCost=Infinity;
 for(const r of opts){
  // Keep the header, player, living enemies and projectile centres readable.
  let cost=0;if(combatDockIntersects(g,r,g.player,14,vw,vh))cost+=10000;
  for(const e of g.enemies)if(!e.dead&&combatDockIntersects(g,r,e,8,vw,vh))cost+=100;
  for(const b of g.enemyBullets)if(combatDockIntersects(g,r,b,8,vw,vh))cost+=1000;
  if(cost<bestCost){bestCost=cost;best=r;}
 }
 // Prefer withholding the panel to hiding the player or a projectile.
 return bestCost>=1000?null:best;
}
function recoveryPromptLayout(g,vw,vh) {
 return recoveryEnabled(g)&&g.state==='playing'&&recoveryDry(g)?recoveryDock(g,vw,vh):null;
}
function drawRecoveryHUD(ctx,g,vw,vh,meterTransform=null) {
 if(!recoveryEnabled(g)||g.state!=='playing')return;
 const p=g.player,dry=recoveryDry(g),site=g.digSite,automatic=g.balanceConfig?.stage2mRecovery?.mode==='stationary';
 if(dry){
  const r=recoveryPromptLayout(g,vw,vh);
  if(r){
   const near=!!site&&dist2(p.x,p.y,site.x,site.y)<75*75;
   uiPanel(ctx,r.x,r.y,r.w,r.h,'rgba(27,30,19,.94)');
   uiFit(ctx,'ОБЕ РУКИ ПУСТЫ',r.x+18,r.y+23,r.w-36,14,'#ffe2a5');
   if(site&&near){uiFit(ctx,automatic?'ОСТАНОВИСЬ · ОТКОПАТЬ':'УДЕРЖИВАЙ '+g.input.prompt('dig')+' · ОТКОПАТЬ',r.x+18,r.y+46,r.w-36,12,'#f6e6bd');uiFit(ctx,'КОРЕНЬ РЯДОМ · '+Math.round(clamp(site.progress/.9,0,1)*100)+'%',r.x+18,r.y+64,r.w-36,11,'#d7e6bc');drawBioMeter(ctx,r.x+18,r.y+70,r.w-36,7,site.progress/.9,'#c7db83',meterTransform);}
   else if(site){uiFit(ctx,'ПОДОЙДИ К КОРНЮ',r.x+18,r.y+46,r.w-36,12,'#f6e6bd');uiFit(ctx,automatic?'ЗАТЕМ ОСТАНОВИСЬ':'ЗАТЕМ УДЕРЖИВАЙ '+g.input.prompt('dig'),r.x+18,r.y+66,r.w-36,11,'#d7e6bc');}
   else {
    let dugNearby=false;
    if(g.recoveryFeedbackT>0)for(const item of g.pickups)if(!item.dead&&item.type==='weapon'&&item.ammo>0&&item.unearthed&&dist2(item.x,item.y,p.x,p.y)<130*130){dugNearby=true;break;}
    if(dugNearby){uiFit(ctx,'ОРГАН ОТКОПАН',r.x+18,r.y+46,r.w-36,12,'#f6e6bd');uiFit(ctx,'ПОДБЕРИ ОРУЖИЕ',r.x+18,r.y+66,r.w-36,11,'#d7e6bc');}
    else {uiFit(ctx,'РАСКОПКА СЕЙЧАС НЕДОСТУПНА',r.x+18,r.y+46,r.w-36,12,'#f6e6bd');uiFit(ctx,'ИЩИ ЛЕЖАЩИЙ ОРГАН',r.x+18,r.y+66,r.w-36,11,'#d7e6bc');}
   }
  }
  if(site){
   const sx=(site.x-g.cam.x)*g.zoom+vw/2,sy=(site.y-g.cam.y)*g.zoom+vh/2;
   if(sx<24||sx>vw-24||sy<110||sy>vh-80){const a=Math.atan2(site.y-p.y,site.x-p.x),k=Math.min((vw/2-30)/Math.max(.001,Math.abs(Math.cos(a))),(vh/2-110)/Math.max(.001,Math.abs(Math.sin(a))));ctx.save();ctx.translate(vw/2+Math.cos(a)*Math.max(30,k),vh/2+Math.sin(a)*Math.max(30,k));ctx.rotate(a);ctx.fillStyle='#f6d88f';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-7,-7);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.restore();}
  }
 }else if(g.recoveryFeedbackT>0){
  // A short status is reserved for successful recovery, never a new pickup.
  const r=recoveryDock(g,vw,vh);if(r)uiText(ctx,'ОРГАН ВОССТАНОВЛЕН',r.x+18,r.y+23,12,'#e7f4b9');
 }
}
function contextLayout(vw,vh,detailed=false,compactHeight=124) {
 const w=detailed?Math.min(520,vw-24):Math.min(440,vw-24),h=detailed?Math.min(vw<760?540:470,vh-(vw<760?104:104)):compactHeight;
 const r=COMBAT_LAYOUT;r.x=vw<760?12:vw-w-18;r.y=vh-(vw<760?76:12)-h;r.w=w;r.h=h;return r;
}
const COMBAT_DOCKS=new WeakMap();
function combatDockIntersects(g,r,e,pad,vw,vh) {
 const x=(e.x-g.cam.x)*g.zoom+vw/2,y=(e.y-g.cam.y)*g.zoom+vh/2,radius=e.r*g.zoom+pad;
 return (x-clamp(x,r.x,r.x+r.w))**2+(y-clamp(y,r.y,r.y+r.h))**2<radius*radius;
}
function combatDock(g,vw,vh,height=124) {
 const base=contextLayout(vw,vh,false,height),p=g.player,top=vw<760?208:146; // reserve the compact mission/boss header
 const options=COMBAT_DOCK_OPTIONS;
 for(let i=0;i<4;i++){options[i].x=base.x;options[i].y=base.y;options[i].w=base.w;options[i].h=base.h;}
 if(vw<760){options[1].y=top;}
 else {options[1].y=top;options[2].x=12;options[2].y=top;options[3].x=12;options[3].y=vh-161;}
 const optionCount=vw<760?2:4;
 const prior=COMBAT_DOCKS.get(p)||0;
 let best=0,score=Infinity;
 for(let i=0;i<optionCount;i++){
  const r=options[i];let cost=(i===prior?0:1)+i*.001;
  if(combatDockIntersects(g,r,p,22,vw,vh))cost+=10000;
  for(const e of g.enemies)if(!e.dead&&dist2(e.x,e.y,p.x,p.y)<360*360&&combatDockIntersects(g,r,e,10,vw,vh))cost+=100;
  if(cost<score){score=cost;best=i;}
 }
 COMBAT_DOCKS.set(p,best);return options[best];
}
const PICKUP_READOUT={def:null,cap:0,ammo:0};
function pickupReadout(found,p) {
 const def=WEAPON_DEFS[found.weaponId],bonus=found.fresh===false?1:1+(p.ammoBonus||0)*.15;
 const cap=found.weaponCap||Math.max(1,Math.round((def.mag+def.reserve)*(1+(p.ammoBonus||0)*.15)));
 const readout=PICKUP_READOUT;readout.def=def;readout.cap=cap;readout.ammo=Math.min(Math.round(found.ammo*bonus),cap);return readout;
}
function uiFit(ctx,text,x,y,width,size=12,color='#d9eddb') {
 ctx.font='bold '+size+'px '+UI_FONT;let value=String(text);
 while(value.length>1&&ctx.measureText(value).width>width)value=value.slice(0,-2)+'…';
 uiText(ctx,value,x,y,size,color);
}
function drawCombatContext(ctx,g,vw,vh,meterTransform=null) {
 const m=combatContext(g),p=g.player;
 if(m.inspect){drawOrganDetails(ctx,g,m,vw,vh,meterTransform);return;}
 const pickupCompact=!!m.found&&vw<560,cardHeight=m.found?(pickupCompact?152:124):m.merging?124:m.fusion?76:36,r=combatDock(g,vw,vh,cardHeight),x=r.x,y=r.y,w=r.w;
 if(m.merging){
  uiPanel(ctx,x,y,w,124,'rgba(37,24,35,.97)');
  uiFit(ctx,m.fusion?'СРАЩИВАНИЕ · '+m.fusion.def.name:m.reason,x+18,y+30,w-36,15,'#f4c4db');
  if(m.fusion){const shot=effectiveShot(m.fusion.def,p,UI_EFFECTIVE_SHOT);uiFit(ctx,Number(shot.dmg.toFixed(1))+' × '+shot.pellets+' · '+Number(shot.rate.toFixed(2))+'/с · заряд '+m.fusion.ammo+'/'+m.fusion.cap,x+18,y+56,w-36,13);uiFit(ctx,FUSION_ROLES[m.fusion.id],x+18,y+78,w-36,12,'#cfaabb');uiText(ctx,'УДЕРЖИВАЙ '+g.input.prompt('fuse')+' · '+Math.round(m.progress*100)+'%',x+18,y+101,10,'#e9b2cc');drawBioMeter(ctx,x+18,y+107,w-36,7,m.progress,'#bd8199',meterTransform);}
  else {uiFit(ctx,'Условия сращивания не выполнены',x+18,y+58,w-36,13,'#cfaabb');drawActionHints(ctx,g.input,HINTS_FUSE_CANCEL,x+18,y+101,w-36,'#f4c4db',1.2);}
  return;
 }
 if(m.found){
  const found=m.found,{def,ammo,cap}=pickupReadout(found,p),shot=effectiveShot(def,p,UI_EFFECTIVE_SHOT);
  uiPanel(ctx,x,y,w,cardHeight,'rgba(17,33,29,.97)');drawWeaponPortrait(ctx,found.weaponId,x+42,y+32,44,g.time);
  const source=ORGAN_SOURCE_NAMES[found.origin?.kind]||(found.origin?.type==='dig'?'раскопка':null);
  uiFit(ctx,def.name+' · '+ammo+'/'+cap+(source?' · '+source:''),x+82,y+38,w-104,15,'#f1dda7');
  uiFit(ctx,Number(shot.dmg.toFixed(1))+' × '+shot.pellets+' · '+Number(shot.rate.toFixed(2))+'/с'+(m.others?' · ещё '+m.others:''),x+82,y+64,w-104,13);
   if(pickupCompact){drawActionHints(ctx,g.input,HINTS_PICKUP_HANDS,x+18,y+102,w-36,'#d6e8d4',1.2);drawActionHints(ctx,g.input,HINTS_INSPECT,x+18,y+136,w-36,'#c2d5c7',1.2);}
   else drawActionHints(ctx,g.input,HINTS_PICKUP_DETAILS,x+18,y+102,w-36,'#d6e8d4',1.2);return;
 }
  if(m.fusion){uiPanel(ctx,x,y,w,76,'rgba(37,24,35,.96)');uiFit(ctx,'ВОЗМОЖЕН СПЛАВ · '+m.fusion.def.name,x+18,y+27,w-36,13,'#f1dda7');drawActionHints(ctx,g.input,HINTS_FUSE,x+18,y+58,w-36,'#e5c5d3',1.2);}
  else if(p.hands[0]||p.hands[1])drawActionHints(ctx,g.input,HINTS_INSPECT,x+16,y+25,w-32,'#d5e1d5',1.1);
}
function organHuntHint(g){
 let target=null,d=650;for(const e of g.enemies)if(!e.dead){const dd=dist(g.player.x,g.player.y,e.x,e.y);if(dd<d){target=e;d=dd;}}
 if(!target)return null;
 const weights=ORGAN_ORIGINS[target.kind];if(!weights)return null;const top=weights.map((weight,i)=>({weight,id:WEAPON_IDS[i]})).sort((a,b)=>b.weight-a.weight).slice(0,2);
 return 'ПРИ ДРОПЕ · '+ORGAN_SOURCE_NAMES[target.kind]+' → '+top.map(x=>WEAPON_DEFS[x.id].name+' '+Math.round(x.weight*100)+'%').join(' / ');
}
function drawOrganDetails(ctx,g,m,vw,vh,meterTransform=null) {
 const p=g.player,r=contextLayout(vw,vh,true),x=r.x+20,w=r.w-40;
 uiPanel(ctx,r.x,r.y,r.w,r.h,'rgba(12,25,22,.98)');ctx.save();ctx.beginPath();ctx.rect(r.x+12,r.y+12,r.w-24,r.h-24);ctx.clip();
 uiFit(ctx,organHuntHint(g)||g.input.prompt('inspect')+' УДЕРЖИВАТЬ · ХАРАКТЕРИСТИКИ',x,r.y+20,w,11,'#dfc9a5');
 let y=r.y+40;
 uiFit(ctx,'Защита '+((1-(p.dmgTakenMul||1))*100).toFixed(1)+'% · получаемый урон ×'+(p.dmgTakenMul||1).toFixed(3),x,y,w,11,'#c5dcb3');y+=17;
 if(p.lifeOnKill>0){uiFit(ctx,'За убийство +'+p.lifeOnKill+' HP'+(p.sustainRules?' · бюджет '+p.vampirismBudget.toFixed(1)+' / '+vampirismCapacity(p)+' HP':' · без бюджета'),x,y,w,11,'#c5dcb3');y+=17;}
 const row=(label,def,ammo,cap)=>{
  uiFit(ctx,label+' · '+def.name+' · '+ammo+'/'+cap,x,y,w,12,'#e5eecb');y+=17;
  const shot=effectiveShot(def,p,UI_EFFECTIVE_SHOT);ctx.font='10px '+UI_FONT;ctx.fillStyle='#bcd7c4';ctx.textAlign='left';y=drawBoundedCopy(ctx,shotSummary(shot),x,y,w,13,2);
  y=drawBoundedCopy(ctx,'Скорость '+shot.speed+' · отдача '+shot.recoil+' · отбрасывание '+shot.knock,x,y,w,13,2);
  const traits=[shot.slug?'Три зуба · −20% залпа':null,shot.slow?'Замедление 35% / 1,5с':null,shot.bounce?'Рикошет ×'+shot.bounce:null,shot.echo?'Эхо 65% / 0,4с · первый взрыв':null,shot.relay?'Связка: +50% прямому контакту другой руки':null].filter(Boolean).join(' · ');
  if(traits)y=drawBoundedCopy(ctx,traits,x,y,w,13,3);
  y+=7;
 };
 if(m.found){const {def,ammo,cap}=pickupReadout(m.found,p);row('НА ЗЕМЛЕ',def,ammo,cap);}
 for(let i=0;i<2;i++){const hand=p.hands[i];if(hand)row(i?'ПРАВАЯ':'ЛЕВАЯ',hand.def,hand.ammo,hand.cap);else{uiText(ctx,(i?'ПРАВАЯ':'ЛЕВАЯ')+' · пусто',x,y,11,'#899a8d');y+=20;}}
 if(m.fusion){row('СПЛАВ',m.fusion.def,m.fusion.ammo,m.fusion.cap);const resourceGain=m.fusion.sourceDamage>0?Math.round((m.fusion.resultDamage/m.fusion.sourceDamage-1)*100):0;uiFit(ctx,'Ресурс после округления +'+resourceGain+'% · мутации не меняют заряд',x,y,w,10,'#cba7b9');}
 else uiFit(ctx,p.hands.some(w=>w?.def.fused)?p.hands.filter(w=>w?.def.fused).map(w=>FUSION_ROLES[w.id]).join(' / '):'Сплав: '+m.reason,x,y,w,11,'#cba7b9');
 if(m.merging){uiText(ctx,'СРАЩИВАНИЕ '+Math.round(m.progress*100)+'%',x,r.y+r.h-16,10,'#e9b2cc');drawBioMeter(ctx,x,r.y+r.h-11,w,7,m.progress,'#bd8199',meterTransform);}
 ctx.restore();
}
function drawHUD(ctx,g,vw,vh,dryLoot=null) {
 // The main canvas HUD always uses the DPR screen transform established by resize().
 // Reuse this key instead of allocating a DOMMatrix with getTransform() every frame.
 const meterTransform=UI_HUD_METER_TRANSFORM,dpr=g.dpr||1;
 meterTransform.a=dpr;meterTransform.b=0;meterTransform.c=0;meterTransform.d=dpr;meterTransform.e=0;meterTransform.f=0;
 const p=g.player,compact=vw<760, slotW=Math.min(218,(vw-36)/2), centerY=compact?103:30;
 drawHandSlot(ctx,g,12,12,0,p.leftMirrored?'ЛЕВАЯ ◀ НАЗАД':'ЛЕВАЯ РУКА',slotW,meterTransform);
 drawHandSlot(ctx,g,vw-12-slotW,12,1,'ПРАВАЯ РУКА',slotW,meterTransform);
 const experiment=g.experimentDisplay,level01=g.level01?.state;
 uiText(ctx,g.recoveryLabScene?'СЦЕНА '+g.recoveryLabScene:level01?'СЕКТОР '+level01.sector+' / 5':experiment?'ЭПИЗОД '+experiment.episode+' / '+experiment.total:'ВОЛНА '+g.wave+' / '+FINAL_WAVE,vw/2,centerY,15,'#d9f1b7','center');
 let nestReserve=0;
 if(g.nests)for(let i=0;i<g.nests.length;i++){const n=g.nests[i];if(!n.dead)nestReserve+=n.remainingBudget;}
 uiText(ctx,'СЧЁТ '+g.score+'  ·  ВРАГИ '+(g.enemies.length+g.spawnQueue.length+g.spawnWarnings.length+nestReserve),vw/2,centerY+20,11,'#b7c8ba','center');
 const o=g.objective;
 if(o && g.encounter && !g.recoveryLabScene) {
  const progress=o.kind==='roots' ? '· ГНЕЗДА '+Math.floor(o.progress)+' / '+o.goal:o.kind==='hunt' ? Math.floor(o.progress)+' / '+o.goal:o.kind==='hold'||o.kind==='survive'?Math.floor(o.progress)+' / '+o.goal+' с':g.encounter.limit ? Math.max(0,Math.ceil(g.encounter.limit-(g.currentWaveStats?g.currentWaveStats.seconds:0)))+' с на бонус':'';
  uiText(ctx,g.encounter.name.toUpperCase()+' '+progress,vw/2,centerY+40,11,'#a4e5ed','center');
 }
 if(level01&&g.state==='playing'&&level01.phase==='combat'){
  const unlocked=level01.sector!==3||g.nests.some(n=>n.dead),target=g.level01.targetX;
  uiText(ctx,level01.sector===5?'ПОБЕДИ ПАСТЬ':unlocked?'ДВИГАЙСЯ ВПРАВО →':'УНИЧТОЖЬ ОДНО ГНЕЗДО',vw/2,centerY+59,11,'#f1dea0','center');
  if(target!==null&&unlocked){const sx=(target-g.cam.x)*g.zoom+vw/2,x=clamp(sx,34,vw-34),y=clamp((p.y-g.cam.y)*g.zoom+vh/2,160,vh-90);ctx.fillStyle='#f1dea0';ctx.beginPath();ctx.moveTo(x+9,y);ctx.lineTo(x-6,y-7);ctx.lineTo(x-6,y+7);ctx.closePath();ctx.fill();}
 }
 const exitOpen=experiment&&(experiment.phase==='pursuit'||experiment.phase==='roots'&&g.nests?.some(n=>n.dead));
 if(exitOpen&&g.state==='playing'){
  const sx=(experiment.exitX-g.cam.x)*g.zoom+vw/2,x=clamp(sx,34,vw-34),py=clamp((p.y-g.cam.y)*g.zoom+vh/2,160,vh-90);
  uiText(ctx,'ВЫХОД К ПАСТИ →',vw/2,centerY+59,11,'#f1dea0','center');
  uiText(ctx,'ПРОЙДИ ВПРАВО ЧЕРЕЗ ГРАНИЦУ →',vw/2,centerY+74,11,'#f1dea0','center');
  ctx.save();
  if(sx>=34&&sx<=vw-34){
   // The left edge of the shaded exit is exactly the x coordinate used by the scene.
   ctx.fillStyle='rgba(224,198,121,.08)';ctx.fillRect(sx,0,Math.min(26,vw-sx),vh);
   ctx.fillStyle='rgba(238,214,145,.65)';for(let y=150;y<vh-90;y+=28)ctx.fillRect(sx-1,y,2,14);
   for(let y=180;y<vh-90;y+=105){ctx.beginPath();ctx.moveTo(sx+20,y);ctx.lineTo(sx+8,y-7);ctx.lineTo(sx+8,y+7);ctx.closePath();ctx.fill();}
  }
  ctx.fillStyle='#f1dea0';ctx.beginPath();ctx.moveTo(x+9,py);ctx.lineTo(x-6,py-7);ctx.lineTo(x-6,py+7);ctx.closePath();ctx.fill();ctx.restore();
 }
 if(dryLoot&&g.state==='playing'&&!(recoveryEnabled(g)&&g.digSite&&recoveryDry(g))){
  const sx=(dryLoot.x-g.cam.x)*g.zoom+vw/2,sy=(dryLoot.y-g.cam.y)*g.zoom+vh/2;
  if(sx<24||sx>vw-24||sy<150||sy>vh-90){const a=Math.atan2(sy-vh/2,sx-vw/2),k=Math.min((vw/2-30)/Math.max(.001,Math.abs(Math.cos(a))),(vh/2-125)/Math.max(.001,Math.abs(Math.sin(a))));ctx.save();ctx.translate(vw/2+Math.cos(a)*Math.max(30,k),vh/2+Math.sin(a)*Math.max(30,k));ctx.rotate(a);ctx.fillStyle='#f1dea0';ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-6);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.restore();}
 }
 let boss=null;
 for(let i=0;i<g.enemies.length;i++){const e=g.enemies[i];if(e.kind==='maw'&&!e.dead){boss=e;break;}}
 if(boss){const w=Math.min(vw-40,420),y=centerY+58;drawBioMeter(ctx,(vw-w)/2,y,w,9,boss.hp/boss.maxHp,boss.recoverT>0?'#8fc5c4':boss.enraged?'#c88467':'#a36c6c',meterTransform);uiText(ctx,boss.recoverT>0?'ОКНО КОНТРАТАКИ':boss.enraged?'ЦАРЬ-ПАСТЬ · ВТОРАЯ ФАЗА':'ЦАРЬ-ПАСТЬ',vw/2,y+22,10,'#ffcbd1','center');
  if(boss.glandsEnabled){for(let i=0;i<2;i++){const side=i?'right':'left',gland=boss.glands[side],gw=76,gx=vw/2+(i?12:-gw-12),gy=y+29;uiText(ctx,(side==='left'?'КОЛЬЦО / СЕКТОР':'ВЕЕР')+(gland.enabled?'':' · ОТКЛ.'),gx+gw/2,gy,8,gland.enabled?'#c3d58d':'#858a70','center');drawBioMeter(ctx,gx,gy+4,gw,6,gland.hp/gland.maxHp,gland.enabled?'#a9c86e':'#5b6547',meterTransform);}}
 }
 if(g.nests)for(let i=0;i<g.nests.length;i++){const nest=g.nests[i];if(nest.dead)continue;const sx=(nest.x-g.cam.x)*g.zoom+vw/2,sy=(nest.y-g.cam.y)*g.zoom+vh/2;if(sx>=28&&sx<vw-28&&sy>=150&&sy<vh-90)continue;const a=Math.atan2(sy-vh/2,sx-vw/2),k=Math.min((vw/2-25)/Math.max(.001,Math.abs(Math.cos(a))),(vh/2-120)/Math.max(.001,Math.abs(Math.sin(a))));ctx.save();ctx.translate(vw/2+Math.cos(a)*Math.max(30,k),vh/2+Math.sin(a)*Math.max(30,k));ctx.rotate(a);ctx.fillStyle='#d7e99b';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-6,-6);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.restore();}
 const hw=Math.min(vw-24,250);uiPanel(ctx,12,vh-70,hw,58);
 const healthIcon=drawDriftIcon(ctx,'medkit',22,vh-57,18),healthContentX=healthIcon?48:34;
 uiText(ctx,'HP '+Math.ceil(p.hp)+' / '+p.maxHp,healthContentX,vh-50,13,p.hp<30?'#ffb080':'#e1f0cd');
 drawBioMeter(ctx,healthContentX,vh-45,hw-(healthContentX-12)-22,9,p.hp/p.maxHp,p.hp<30?'#c78865':'#a6d783',meterTransform);
 uiText(ctx,'РЫВОК '+(p.dashCd<=0?'ГОТОВ':p.dashCd.toFixed(1)+'с')+' · БЕГ '+Math.round(p.stamina)+'%',healthContentX,vh-26,10,'#b5d7e5');
 if(p.sustainRules&&p.lifeOnKill>0)uiFit(ctx,'ГОЛОД '+Math.ceil(p.vampirismBudget)+'/'+vampirismCapacity(p)+' HP · НА ВСТРЕЧУ',18,vh-77,hw-12,10,'#c7dca1');
 if(g.comboT>0 && g.combo>1)uiText(ctx,'ЦЕПОЧКА ×'+g.combo,vw-16,vh-25,14,'#ffe5a0','right');
  if(g.preferences.tips && g.tipT>0 && g.tip && !(recoveryEnabled(g)&&recoveryDry(g)&&g.tip.startsWith('Под землёй остался живой корешок.')) && !g.input.actionDown('inspect') && !g.input.actionDown('fuse') && !(p.nearbyWeapon&&!p.nearbyWeapon.dead)) {
  const tw=Math.min(320,vw-24),ty=compact?164:94;uiPanel(ctx,12,ty,tw,46,'rgba(13,28,23,.9)');ctx.font='11px '+UI_FONT;ctx.fillStyle='#d6e8d4';ctx.textAlign='left';drawBoundedCopy(ctx,g.tip,28,ty+18,tw-40,14,2);
 }
 drawCombatContext(ctx,g,vw,vh,meterTransform);
 drawRecoveryHUD(ctx,g,vw,vh,meterTransform);
 let livingTargets=0;
 if(g.spawnQueue.length===0 && g.spawnWarnings.length===0)for(let i=0;i<g.enemies.length&&livingTargets<=3;i++)if(!g.enemies[i].dead)livingTargets++;
 if(livingTargets>0&&livingTargets<=3 && g.spawnQueue.length===0 && g.spawnWarnings.length===0) for(let i=0;i<g.enemies.length;i++) {const e=g.enemies[i];if(e.dead)continue;
  const sx=(e.x-g.cam.x)*g.zoom+vw/2,sy=(e.y-g.cam.y)*g.zoom+vh/2;
  if(sx>=20&&sx<vw-20&&sy>=150&&sy<vh-80)continue;
  const a=Math.atan2(sy-vh/2,sx-vw/2),k=Math.min((vw/2-25)/Math.max(.001,Math.abs(Math.cos(a))),(vh/2-120)/Math.max(.001,Math.abs(Math.sin(a))));
  ctx.save();ctx.translate(vw/2+Math.cos(a)*Math.max(30,k),vh/2+Math.sin(a)*Math.max(30,k));ctx.rotate(a);ctx.fillStyle='#ffcf8c';ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-6);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.restore();
 }
}
function getBackButton(vw,vh){const w=Math.min(136,Math.max(0,vw-32)),h=36;return {x:16,y:16,w,h};}
function getAboutButton(vw,vh){return getBackButton(vw,vh);}
function drawBackButton(ctx,vw,vh){const r=getBackButton(vw,vh);uiPanel(ctx,r.x,r.y,r.w,r.h,'#20352d');const label='НАЗАД';ctx.font='bold 11px '+UI_FONT;const labelWidth=ctx.measureText(label).width,groupWidth=24+labelWidth,start=r.x+(r.w-groupWidth)/2;drawDriftIcon(ctx,'arrow_left',start,r.y+9,18);uiText(ctx,label,start+24,r.y+r.h/2+3,11,'#c3dec9');}
function drawAboutButton(ctx,vw,vh){drawBackButton(ctx,vw,vh);}
function uiContains(r,p){return p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;}
function getFrontButtons(vw,vh,paused=false,level01Available=false,preset='baseline') {
 const w=Math.min(340,vw-48),x=vw<760?(vw-w)/2:Math.max(40,vw*.12),h=Math.min(54,Math.max(34,vh*.075)),gap=10;
 const items=paused?[['resume','Продолжить'],['settings','Настройки'],['about','Об игре'],['finish','Завершить забег']]:level01Available?[['start','Начать забег'],['level01','Заражённый периметр'],['level01Preset',preset==='near-wasd'?'Клавиши: F / R / G':'Клавиши: текущие'],['settings','Настройки'],['about','Об игре']]:[['start','Начать забег'],['settings','Настройки'],['about','Об игре']];
 const top=Math.min(vh*.49,vh-40-items.length*(h+gap));
 return items.map(([id,label],i)=>({id,label,x,y:top+i*(h+gap),w,h}));
}
function getSettingsLayout(vw,vh) {
 const w=Math.min(640,vw-32),h=Math.min(54,Math.max(24,(vh-115)/6-5)),gap=5;
 return Array.from({length:6},(_,i)=>({x:(vw-w)/2,y:(vh<400?75:95)+i*(h+gap),w,h}));
}
function getSettingsSlider(r,ctx) {
 ctx.save();ctx.font='bold 11px '+UI_FONT;const valueWidth=ctx.measureText('100%').width;ctx.restore();
 const x=r.x+r.w*.58,right=r.x+r.w-18;return {x,w:Math.max(36,right-x-valueWidth-10)};
}
function drawFrontGarden(ctx,g,vw,vh) {
 const bg=ctx.createRadialGradient(vw*.7,vh*.43,0,vw*.65,vh*.5,Math.max(vw,vh));
 bg.addColorStop(0,'#20362a');bg.addColorStop(.5,'#0b1916');bg.addColorStop(1,'#030b0a');ctx.fillStyle=bg;ctx.fillRect(0,0,vw,vh);
 const heroScreen=g.state==='splash'||g.state==='menu';
 if(heroScreen&&typeof drawSplashMonster==='function'){
  const splash=g.state==='splash',compact=vw<760;
  const x=splash||compact?vw*.5:vw*.77,y=splash?vh*.52:vh*.49;
  const width=splash?vw*.88:Math.min(vw*.46,620),height=splash?vh*.56:vh*.78;
  const scale=Math.min(width/520,height/500,1.2);
  ctx.save();ctx.globalAlpha=splash?.58:.92;drawSplashMonster(ctx,x,y,scale,g.time);ctx.restore();
 }else{
  ctx.save();const cx=vw*(vw<760?.5:.77),cy=vh*.49,scale=Math.min(vw*.33,vh*.44);ctx.translate(cx,cy);
  if(vw<760)ctx.globalAlpha=.25;
  for(let i=0;i<23;i++) {
   const a=i*2.39996,length=scale*(.55+(i%5)*.11),sway=Math.sin(g.time*.3+i)*.06;
   const x=Math.cos(a+sway)*length,y=Math.sin(a+sway)*length;
   ctx.strokeStyle=i%3===0?'#77865a':'#395a46';ctx.lineWidth=1+(i%4)*1.3;
   ctx.beginPath();ctx.moveTo(0,scale*.7);ctx.bezierCurveTo(-x*.35,y*.3,x*.6,y*.8,x,y);ctx.stroke();
   for(let j=1;j<4;j++){const t=j/4,bx=x*t,by=scale*.7*(1-t)+y*t,dir=j%2?1:-1;ctx.fillStyle=i%4===0?'#714d54':'#344f39';ctx.beginPath();ctx.ellipse(bx+dir*12,by,7+3*(i%3),24+4*j,a+dir*.7,0,TAU);ctx.fill();}
   ctx.fillStyle=i%4===0?'#bf8580':'#adc784';ctx.beginPath();ctx.ellipse(x,y,3+(i%3),8+(i%4)*2,a,0,TAU);ctx.fill();
  }
  ctx.strokeStyle='#869565';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,scale*.2,scale*.32,Math.sin(g.time*.4)*.04,0,TAU);ctx.stroke();
  ctx.fillStyle='#192e24';ctx.beginPath();ctx.ellipse(0,0,scale*.17,scale*.28,0,0,TAU);ctx.fill();
  for(let i=0;i<7;i++){ctx.strokeStyle='#687653';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-scale*.14,-scale*.19+i*scale*.06);ctx.quadraticCurveTo(0,scale*.03+i*scale*.035,scale*.14,-scale*.19+i*scale*.06);ctx.stroke();}
  ctx.fillStyle='#d3aa8b';ctx.beginPath();ctx.ellipse(0,-scale*.03,scale*.027,scale*.11,0,0,TAU);ctx.fill();ctx.restore();
 }
 ctx.fillStyle='#72917c';for(let i=0;i<28;i++){const x=(i*137.5+Math.sin(g.time*.2+i)*14)%vw,y=(i*79.3-g.time*(3+i%4))%vh;ctx.globalAlpha=.15+(i%4)*.06;ctx.fillRect(x,(y+vh)%vh,2,2);}ctx.globalAlpha=1;
}
function drawFrontMenu(ctx,g,vw,vh) {
 drawFrontGarden(ctx,g,vw,vh);
 const splash=g.state==='splash',paused=g.state==='paused',compact=vw<760;
 const x=splash?vw/2:compact?vw/2:Math.max(40,vw*.12),align=splash||compact?'center':'left';
 const titleY=vh<460&&!splash?45:Math.max(70,vh*(splash?.39:.25));
 uiText(ctx,'ХИЩНЫЙ САД',x,titleY-35,11,'#92a78a',align);
 ctx.font='900 '+Math.min(splash?78:65,vw/(splash?6.5:7.5))+'px '+UI_TITLE_FONT;ctx.textAlign=align;ctx.fillStyle='#d2dfac';ctx.fillText('DEADWEED',uiSnap(ctx,x,'x'),uiSnap(ctx,titleY+25,'y'));
 if(vh>=400)uiText(ctx,paused?'ПАУЗА':'ПУСТИ КОРНИ. ПЕРЕЖИВИ САД.',x,titleY+58,Math.min(12,vw/33),'#839d8e',align);
 if(splash){ctx.globalAlpha=.35+.65*(.5+.5*Math.sin(g.time*3));uiText(ctx,'НАЖМИТЕ, ЧТОБЫ ПРОДОЛЖИТЬ',vw/2,vh*.71,Math.min(15,vw/27),'#dce8c1','center');ctx.globalAlpha=1;}
 else getFrontButtons(vw,vh,paused,typeof g.startLevel01==='function',g.level01Preset).forEach((r,i)=>{
  const selected=i===g.menuSelection;
  const art=drawBiotechButton(ctx,r,selected,r.id==='finish');
  if(!art)uiPanel(ctx,r.x,r.y,r.w,r.h,selected?'#304b32':'rgba(17,34,28,.85)',selected);
  ctx.save();ctx.shadowColor='#020a04';ctx.shadowBlur=4;ctx.shadowOffsetY=1;
  uiText(ctx,r.label,r.x+r.w/2,r.y+r.h/2+5,16,selected?'#f2f4d5':r.id==='finish'?'#d8a2b1':'#b8c9ad','center',UI_DISPLAY_FONT);ctx.restore();
  if(selected)uiText(ctx,'›',r.x+r.w-22,r.y+r.h/2+5,20,'#e6edbb','right');
  ctx.save();ctx.globalAlpha=selected?1:.6;drawDriftIcon(ctx,({start:'play',resume:'play',settings:'settings',about:'info',finish:'warning'})[r.id],r.x+30,r.y+r.h/2-10);ctx.restore();
 });
 if(paused)drawDriftIcon(ctx,'pause',Math.max(12,x-28),titleY+42,18);
 uiText(ctx,compact?'DEADWEED':'DEADWEED / '+(paused?'ЗАБЕГ ПРИОСТАНОВЛЕН':'БИОПАНК • ВЫЖИВАНИЕ'),24,vh-20,10,'#607b6a');
 if(!splash)drawActionHints(ctx,g.input,paused?HINTS_PAUSE:HINTS_MENU,vw-(paused?246:140),vh-20,paused?230:124,'#8da58b');
}
function drawSettings(ctx,g,vw,vh) {
 drawFrontGarden(ctx,g,vw,vh);ctx.fillStyle='rgba(3,12,10,.82)';ctx.fillRect(0,0,vw,vh);
 const back=getBackButton(vw,vh),titleX=vw<480?(back.x+back.w+vw-16)/2:vw/2;
 drawBackButton(ctx,vw,vh);uiText(ctx,'НАСТРОЙКИ',titleX,52,28,'#d5e2b8','center');
 const labels=['Общая громкость','Музыка','Тряска камеры','Подсказки в бою','Управление','Сбросить настройки'];
 getSettingsLayout(vw,vh).forEach((r,i)=>{
  const selected=g.settingsSelection===i;uiPanel(ctx,r.x,r.y,r.w,r.h,selected?'#293e30':'#11251d',selected);
  const rowIcon=drawDriftIcon(ctx,['volume_up','volume_up','target','info','settings','warning','arrow_left'][i],r.x+18,r.y+r.h/2-10);
  uiText(ctx,labels[i],r.x+(rowIcon?46:20),r.y+r.h/2+4,Math.min(13,vw/30),'#d2dfc7');
  if(i<2){const value=i===0?g.sfx.volume:g.music?g.music.volume:.35,slider=getSettingsSlider(r,ctx),x=slider.x,w=slider.w,y=r.y+r.h*.54,valueRight=r.x+r.w-18;
   drawBioMeter(ctx,x,y-3,w,7,value,'#a9c77a');drawBioKnot(ctx,x+w*value,y+1,5,value);
   uiText(ctx,'0%',x-10,y+4,11,'#8fa798','right');uiText(ctx,Math.round(value*100)+'%',valueRight,y+4,11,'#d3deb8','right');
  } else if(i<4){const on=g.preferences[i===2?'shake':'tips'],size=Math.min(36,r.h-4);
   const art=drawBotanicalSprite(ctx,'biotech_checkbox_'+(on?'on':'off')+'_'+(selected?'focus':'normal'),r.x+r.w-size-18,r.y+(r.h-size)/2,size);
   uiText(ctx,on?'ВКЛ':'ВЫКЛ',r.x+r.w-(art?size+28:20),r.y+r.h/2+4,12,'#bbd29b','right');
  }
  else uiText(ctx,'›',r.x+r.w-16,r.y+r.h/2+5,18,'#bbd29b','right');
 });
}
function drawOverlay(ctx,g,vw,vh) {
 if(g.state==='playing')return;
 ctx.fillStyle=g.state==='gameover'?'rgba(36,12,14,.88)':'rgba(6,18,15,.94)';ctx.fillRect(0,0,vw,vh);ctx.textAlign='center';
 const titleSize=Math.min(42,vw/11), margin=24, input=g.input;
 if(g.state==='about') {
  const back=getBackButton(vw,vh),titleX=vw<480?(back.x+back.w+vw-16)/2:vw/2;
  drawBackButton(ctx,vw,vh);uiText(ctx,'ОБ ИГРЕ',titleX,48,28,'#d9edb6','center');
  const width=Math.min(700,vw-72),left=(vw-width)/2,contentX=left+16,contentWidth=width-32;
  const panelBottom=vh-112;uiPanel(ctx,left-14,68,width+28,Math.max(20,panelBottom-68),'rgba(7,18,15,.9');
  const contentTop=84,contentBottom=vh-126;ctx.save();ctx.beginPath();ctx.rect(contentX,contentTop,contentWidth,Math.max(20,contentBottom-contentTop));ctx.clip();
  const scroll=Math.max(0,g.aboutScroll||0);let y=98-scroll;
  const sections=[['DEADWEED','Зомби против хищного сада. Две руки, живые органы и биосплавы.'],['МУЗЫКА — h5isy','Organic Machine: Gothic Biopunk — Music Asset Pack.'],['ИСПОЛЬЗОВАННЫЕ КОМПОЗИЦИИ','Outpost Chill — меню, пауза и победа. Bullet Jump Reaction — бой. Neural Decay — поражение.'],['ЛИЦЕНЗИЯ МУЗЫКИ','Creative Commons Attribution 4.0 International (CC BY 4.0). https://creativecommons.org/licenses/by/4.0/'],['АДАПТАЦИЯ','WAV перекодированы в Ogg Vorbis. Громкость и плавные переходы добавлены в игре. Вступления и петли сохранены из набора автора.'],['ГРАФИКА — DEADWEED','Растительные органы, карточки и корневой интерфейс созданы для проекта через OpenAI imagegen. Атлас, подготовка изображений и игровая палитра — DEADWEED.']];
  sections.push(['ШРИФТ — Not Jam','Not Jam Mono Clean 13 и 16. not-jam.itch.io/not-jam-mono-clean-13. CC0 1.0. Кириллица и моноширинные цифры.'],['ОРГАНИЧЕСКИЕ ЗВУКИ — IcySoap','Free Gore Foley Sound Pack, Stephen / IcySoap. icysoap.itch.io/free-gore-foley-sound-pack. Используется с разрешения автора при указании имени. Шесть записей: обрезана тишина, выровнен уровень, перекодированы в моно Ogg.']);
  sections.push(['ИНТЕРФЕЙС И СИГНАЛЫ — VictorGabrielF / VinniBr','DRIFTWORKS Free: пиктограммы, наведение, подтверждение, отмена, переключатели, подбор и экипировка. Royalty-free.'],['ОБОЗНАЧЕНИЯ УПРАВЛЕНИЯ — Kenney','Input Prompts. kenney-assets.itch.io/input-prompts. CC0 1.0. Клавиши следуют переназначениям, значки геймпада — Xbox или PlayStation.'],['ВЛАЖНЫЕ ЗВУКИ — Van Noise / Enzo','Flesh and Fracture Lite. vannoise.itch.io/flesh-and-fracture. Семь записей: влажные попадания, разрывы, сок, оболочки и сращивание. Обрезана тишина, выровнена громкость, моно Ogg.']);
  const pity=g.balanceConfig?.pityAfterMisses||3,dropRule=g.balanceConfig?.resourcePity?'При нехватке заряда и отсутствии доступного органа поблизости гарантия срабатывает на '+pity+'-м убийстве подряд без оружейного дропа; при высоком запасе и нескольких близких органах шанс снижен. Царь-Пасть всегда оставляет орган.':'Безусловная гарантия срабатывает на '+pity+'-м убийстве подряд без оружейного дропа. Царь-Пасть всегда оставляет орган.';
  sections.push(['ПРОИСХОЖДЕНИЕ ОРГАНОВ','Ростки чаще оставляют кость и слюну; хищники — выводковый зев; стрелки — Слюнник и желчь; шипастые кусты — Сухожильник; пасть — желчь. Это предпочтения, любой вид может оставить каждый базовый орган. '+dropRule+' Tab показывает предпочтения ближайшего врага. Сращивание переносит гены, даёт номинальный бонус ресурса с округлением и освобождает правую руку; пока она пуста, второй поток огня потерян.']);
  for(const [title,body] of sections){uiText(ctx,title,contentX,y,12,'#d3dba5');ctx.font='12px '+UI_FONT;ctx.fillStyle='#b6d0c1';ctx.textAlign='left';y=wrapText(ctx,body,contentX,y+23,contentWidth,18)+20;}
  g.aboutMaxScroll=Math.max(0,y+scroll-(vh-142));g.aboutScroll=clamp(scroll,0,g.aboutMaxScroll);
  ctx.restore();
  if(g.music && g.music.playingKey)uiText(ctx,'Сейчас: '+({menu:'Outpost Chill',combat:'Bullet Jump Reaction',defeat:'Neural Decay'}[g.music.playingKey]),vw/2,vh-94,11,'#8fbaac','center');
  uiText(ctx,'↑ / ↓ — прокрутка · Esc / B — назад',vw/2,vh-74,11,'#a6c6b4','center');return;
 }
 if(g.state==='splash' || g.state==='menu') {drawFrontMenu(ctx,g,vw,vh);return;}
 if(g.state==='settings') {drawSettings(ctx,g,vw,vh);return;}
 if(g.state==='upgrade') {
  const compactCards=vw<420;uiText(ctx,'ВСТРЕЧА ЗАВЕРШЕНА',vw/2,compactCards?32:58,Math.min(30,vw/15),'#c7eaa1','center');
  uiText(ctx,'Выбери мутацию или усиление',vw/2,compactCards?55:87,14,'#c8d9cc','center');
  uiText(ctx,'↑ / ↓ и Enter / A · или клик по карточке',vw/2,compactCards?76:110,11,'#9cb6a7','center');
  getUpgradeLayout(vw,vh,g.cards.length).forEach((r,i)=>{
   const selected=g.hoverCard===i;uiPanel(ctx,r.x,r.y,r.w,r.h,selected?'#29483a':'#14291f',selected);
   const card=g.cards[i],vertical=vw<740,art=BIO_UPGRADE_ART[card.id||card.name]||'cocoon';
    const iconSize=compactCards?Math.min(38,r.h*.34):vertical?Math.min(66,r.h-18):Math.min(80,r.h*.32);
    const iconX=compactCards?r.x+37:vertical?r.x+43:r.x+r.w/2,iconY=compactCards?r.y+40:vertical?r.y+r.h/2:r.y+38+iconSize/2;
   const hasArt=drawBioIcon(ctx,art,iconX,iconY,iconSize,g.time);
   if(!hasArt)drawOrganicWeapon(ctx,'glob',iconX-10,iconY,0,.8);
    const tx=compactCards?r.x+66:vertical?r.x+100:r.x+28,tw=compactCards?r.w-82:vertical?r.w-120:r.w-56;
   const hasBadge=drawBiotechIcon(ctx,card.id?'dna':'biomass',tx,r.y+16,16);
    uiText(ctx,'['+input.bindingKeyName('upgrade'+(i+1))+'] '+(card.id?'МУТАЦИЯ':'УСИЛЕНИЕ'),tx+(hasBadge?21:0),r.y+29,10,'#9dbab0');
    ctx.font='bold '+(compactCards?12:vertical?13:15)+'px '+UI_FONT;ctx.fillStyle='#e5f0dc';ctx.textAlign='left';
    const titleY=compactCards?r.y+47:vertical?r.y+50:r.y+52+iconSize;
    const next=drawBoundedCopy(ctx,card.name,tx,titleY,tw,17,compactCards?1:vertical&&r.h<100?1:2);
    ctx.font=(compactCards?10:vertical?11:12)+'px '+UI_FONT;ctx.fillStyle='#b3ccbf';
    const context=cardContext(card,g.player),description=cardCopy(card,g.player);
    if(compactCards){drawBoundedCopy(ctx,description,r.x+14,r.y+64,r.w-28,12,Math.max(1,Math.floor((r.h-90)/12)));ctx.fillStyle='#e0c394';drawBoundedCopy(ctx,context,r.x+14,r.y+r.h-18,r.w-28,11,1);}
    else {const descEnd=drawBoundedCopy(ctx,description,tx,next+5,tw,15,Math.max(1,Math.floor((r.y+r.h-34-next-5)/15)));ctx.fillStyle='#e0c394';drawBoundedCopy(ctx,context,tx,descEnd+5,tw,14,Math.max(1,Math.floor((r.y+r.h-12-descEnd-5)/14)));}

  });return;
 }
 if(g.state==='paused') {
  if(input.controlsOpen) {
   uiText(ctx,'УПРАВЛЕНИЕ',vw/2,42,26,'#d8edb7','center');
   uiText(ctx,input.waitingForBinding?'Нажми клавишу · Esc — отмена':'↑ / ↓ · Enter — изменить · Backspace — сброс',vw/2,70,11,'#b4cbbb','center');
   const rows=Math.max(3,Math.floor((vh-170)/30)),first=clamp(input.selectedBinding-Math.floor(rows/2),0,Math.max(0,input.bindingActions.length-rows));
   input.bindingActions.slice(first,first+rows).forEach((action,i)=>{const y=105+i*30,selected=first+i===input.selectedBinding;uiPanel(ctx,16,y-20,vw-32,28,selected?'#2a4c3a':'#12261c',selected);uiText(ctx,input.bindingLabels[action],34,y,Math.min(12,vw/34));const icon=getSprite('input_'+inputIconName(input,action,true));if(icon)ctx.drawImage(icon,vw-110,y-15,22,22);uiText(ctx,input.bindingKeyName(action),vw-34,y,12,'#ffe0a2','right');});
   if(input.bindingMessage)uiText(ctx,input.bindingMessage,vw/2,vh-65,11,'#ffcf9d','center');
   uiPanel(ctx,16,vh-50,(vw-40)/2,34);uiText(ctx,'СБРОСИТЬ',vw/4,vh-28,12,'#b9c9a8','center');
   uiPanel(ctx,vw/2+4,vh-50,(vw-40)/2,34);uiText(ctx,'НАЗАД',vw*.75,vh-28,12,'#d9e7bc','center');return;
  }
  drawFrontMenu(ctx,g,vw,vh);return;
 }
 if(g.state==='victory'||g.state==='gameover') {
  const won=g.state==='victory',report=g.createBalanceReport(),total=report.waves.reduce((a,w)=>a+w.seconds,0);
  uiPanel(ctx,Math.max(12,vw*.08),vh*.12,vw-Math.max(24,vw*.16),vh*.76,'rgba(7,18,15,.9');
  const resultTextWidth=Math.max(100,vw*.84-48);
  uiText(ctx,won?'БОЛОТО ПОБЕЖДЕНО':g.outcome==='abandoned'?'ЗАБЕГ ЗАВЕРШЁН':'САД ОКАЗАЛСЯ СИЛЬНЕЕ',vw/2,vh*.21,Math.min(34,vw/16),won?'#ffe6a5':'#ffb799','center');
  let y=vh*.21+38;
  const progress=g.level01?.state?'Сектор '+g.level01.state.sector+' / 5':g.experimentDisplay?'Эпизод '+g.experimentDisplay.episode+' / '+g.experimentDisplay.total:'Волна '+g.wave+' / 10';
  const lines=[progress+' · Счёт '+g.score,'Рекорд до забега: '+(g.previousBest===null?'нет данных':g.previousBest)+' · Лучшая цепочка: '+g.bestCombo,'Время: '+Math.round(total)+' с · Убийства: '+g.runStats.kills,g.endReason||'Царь-Пасть повержен','Потеряно патронов при замене: '+g.runStats.losses.filter(x=>x.reason==='replacement').reduce((a,x)=>a+x.ammo,0)];
  ctx.font='13px '+UI_FONT;ctx.fillStyle='#ccdcca';ctx.textAlign='center';for(const line of lines)y=wrapText(ctx,line,vw/2,y,resultTextWidth,21)+10;
  uiText(ctx,input.bindingKeyName('newRun')+' / Enter / A — НОВЫЙ ЗАБЕГ',vw/2,y+20,Math.min(17,vw/27),'#ffe2a3','center');
  if(g.reportStorageError)uiText(ctx,'История не сохранена. Сохрани JSON клавишей '+input.bindingKeyName('exportReport'),vw/2,vh-20,11,'#ffb799','center');
  uiText(ctx,input.bindingKeyName('restart')+' — повторить seed · '+input.bindingKeyName('exportReport')+' — JSON',vw/2,y+50,12,'#acccbc','center');
  return;
 }
}
