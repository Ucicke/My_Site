/* Short, non-modal comments. State changes and route selection remain with the game. */
'use strict';
const RogiWorld = (() => {
    let current=null,pending=null,cooldown=0,lastKey='',sequence=0;
    const priorities={route:1,camp:2,shop:2,event:3,sale:3,exit:5};
    function active(){return typeof companion!=='undefined'&&companion?.active&&companion.ai;}
    function enqueue(topic,context={},key=''){
        if(!active()||!priorities[topic])return false;
        const ai=RogiAI.ensure(companion);ai.worldSeen||={};
        const identity=key||[topic,companion.dungeon,typeof currentNodeId!=='undefined'?currentNodeId:''].join(':');
        if(ai.worldSeen[identity])return false;
        ai.worldSeen[identity]=true;
        const item={topic,context:JSON.parse(JSON.stringify(context)),priority:priorities[topic],identity,sequence:++sequence};
        if(current&&item.priority>current.priority){current=null;cooldown=0;}
        if(!pending||item.priority>=pending.priority)pending=item;
        return true;
    }
    function observe(){
        if(!active()||typeof gameState==='undefined'||typeof STATES==='undefined')return;
        const key=[companion.dungeon,gameState,typeof currentNodeId!=='undefined'?currentNodeId:'',!!attemptOver].join(':');
        if(key===lastKey)return;lastKey=key;
        if(gameState===STATES.STEP&&attemptOver&&companion.settlement?.phase==='prepared')enqueue('exit',{},'exit:'+companion.dungeon);
        else if(gameState===STATES.STEP&&!attemptOver&&Array.isArray(map)&&map.length){
            const available=reachableNodes(map,currentNodeId).map(id=>nodeById(map,id)).filter(Boolean).map(n=>n.type);
            const ai=RogiAI.ensure(companion),m=RogiAI.collectModifiers(ai.profile).situational,f=RogiAI.finances(companion);
            let routeKind='other';
            if((companion.hp<companion.maxHp||hp<maxHp||ai.focus<=1)&&available.some(t=>t==='CAMP'||t==='CAMP_FINALE'))routeKind='camp';
            else if(f.shortLiquid>0&&available.includes('TREASURE'))routeKind='treasure';
            else if((m.curiosity||0)>0&&available.includes('EVENT'))routeKind='event';
            else if(ai.stress>=55||ai.dimensions.caution>ai.dimensions.courage+10)routeKind='safe';
            enqueue('route',{routeKind,available},'route:'+companion.dungeon+':'+(currentNodeId||'start'));
        } else if(gameState===STATES.CAMP)enqueue('camp',{rested:false},'camp-enter:'+companion.dungeon+':'+currentNodeId);
        else if(gameState===STATES.SHOP)enqueue('shop',{},'shop:'+companion.dungeon+':'+currentNodeId);
    }
    function blocked(){return typeof gameState==='undefined'||[STATES.INTRO,STATES.PROLOGUE,STATES.GAME_OVER,STATES.VICTORY,STATES.QUARTERMASTER,STATES.EVENT,STATES.OPENING,STATES.REACTION,STATES.HEIST_CRISIS,STATES.INVENTORY].includes(gameState)||!!companionModal||!!rulesOpen;}
    function update(dt){
        if(!active()){current=null;pending=null;return;}
        if(blocked())return;
        if(current){current.remaining-=dt;if(current.remaining<=0){current=null;cooldown=8;}}
        if(cooldown>0)cooldown=Math.max(0,cooldown-dt);
        if(!pending||current||(cooldown>0&&pending.priority<5)||companion.ai.drama?.pending)return;
        const item=pending;pending=null;
        const text=RogiVoice.say(companion,'world-'+item.topic,item.context);
        current={...item,text,remaining:6};
        const ai=RogiAI.ensure(companion);ai.worldHistory||=[];
        ai.worldHistory.push({topic:item.topic,context:item.context,text,eventNo:ai.eventNo,dungeon:companion.dungeon});
        if(ai.worldHistory.length>80)ai.worldHistory.shift();
        if(typeof document!=='undefined'){
            let live=document.getElementById('rogi-world-live');
            if(!live){live=document.createElement('div');live.id='rogi-world-live';live.setAttribute('aria-live','polite');live.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';document.body.appendChild(live);}
            live.textContent='Роги: '+text;
        }
    }
    function draw(){
        if(!current||!active()||blocked()||typeof canvas==='undefined')return;
        const scale=canvas.getBoundingClientRect().width/VIEW_W,u=1/scale;
        const w=Math.min(350*u,VIEW_W-20*u),font='500 '+(13*u)+'px Georgia, serif';
        const lines=quartermasterTextLines(current.text,font,w-62*u,4),h=Math.max(56*u,(lines.length*18+18)*u);
        const x=VIEW_W-w-10*u,y=UI.hudH+10*u;
        fillRound(x,y,w,h,10*u,'rgba(16,18,28,0.94)','rgba(190,155,218,0.55)');
        if(typeof containChamberImage==='function')containChamberImage(chamberImages['rogi-idle'],{x:x+6*u,y:y+4*u,w:42*u,h:h-8*u});
        lines.forEach((line,i)=>drawText(line,x+54*u,y+(13+i*18)*u,font,'#eee2ee','left','middle'));
    }
    function reset(){current=null;pending=null;cooldown=0;lastKey='';sequence=0;}
    function debug(){return{current,pending,cooldown};}
    return{enqueue,observe,update,draw,reset,debug};
})();
