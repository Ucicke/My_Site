/* Object-bound conversation scenes composed with the stable RogiAI handlers. */
'use strict';
const RogiConversation = (() => {
    const game = RogiAI.getGamePort();
    const clone = value => JSON.parse(JSON.stringify(value));
    const names = {loot:'Находка',refusal:'Опасный сундук',injury:'Ранение',promise:'Данное слово',finance:'Помощь с долгом',personal:'Личный разговор'};
    function snapshot(comp) {
        return {gold:game.playerGold(),hp:game.playerHp(),trust:game.playerTrust(),
            ownGold:comp.gold,debt:comp.debt,hpRogi:comp.hp,focus:comp.ai.focus,stress:comp.ai.stress,
            inventory:(comp.inventory||[]).map(i=>i.uid),playerScrolls:game.playerScrollCount(),
            promises:clone(comp.ai.promises),owner:comp.lastLoot?.owner||null};
    }
    function trace(comp,kind,context,actions,scores,chosen) {
        const ai=RogiAI.ensure(comp);ai.roleSchema=23;ai.decisionJournal||=[];ai.decisionSerial=(ai.decisionSerial||0)+1;
        const roles={initiator:'player',executor:kind==='conversation'?'player':'rogi',riskBearer:null,lootOwner:comp.lastLoot?.owner||null,subject:ai.conversation?.subject||null,...context};
        const record={decisionId:ai.seed+':'+ai.decisionSerial,kind,eventNo:ai.eventNo,context:clone(roles),
            parentId:ai.conversationActionId||null,allowed:actions.map(a=>a.id),scores:clone(scores||[]),chosen,
            before:snapshot(comp),applied:false,reply:null};
        ai.decisionJournal.push(record);if(ai.decisionJournal.length>100)ai.decisionJournal.shift();
        ai.pendingDecisionId=record.decisionId;return record;
    }
    function flush(comp) {
        if(!comp?.ai)return;
        for(const r of comp.ai.decisionJournal||[])if(!r.applied){r.after=snapshot(comp);r.result={owner:comp.lastLoot?.owner||null,active:comp.active};r.applied=true;}
    }
    function migrateLegacyRoles(comp) {
        const ai=comp.ai;if(!ai||ai.roleSchema===23)return;
        const accepted=e=>e.type==='forced-risk'&&['open','break'].includes(e.detail?.method)&&e.detail.actor==='player'&&e.detail.coerced!==true&&e.detail.consented!==false;
        for(const e of [...(ai.timeline||[]),...(ai.memory||[])])if(accepted(e)){
            e.type='companion-risk';if(e.key)e.key=e.key.replace(/^forced-risk:/,'companion-risk:');
            e.detail={...e.detail,originalType:'forced-risk',actor:'rogi',initiator:'player',executor:'rogi',riskBearer:'rogi',consented:true};
        }
        ai.roleSchema=23;
    }
    function spoken(comp,utterance) {
        const ai=comp.ai,r=ai.decisionJournal?.find(r=>r.decisionId===ai.pendingDecisionId);
        if(r&&!r.applied)r.reply=clone(utterance);
    }
    function roomKey(comp) {return (comp.dungeon||0)+':'+game.roomId();}
    function state(comp) {
        const c=comp.ai.conversation;
        if(c&&c.room!==roomKey(comp)){comp.ai.conversation=null;return null;}
        return c||null;
    }
    function subject(comp,topic,extra={}) {
        if(topic==='loot')return{uid:comp.lastLoot?.uid,decision:comp.lastLoot?.decision,reviewAt:comp.lastLoot?.reviewAt||0};
        if(topic==='refusal'){const index=game.selectedChestIndex();return{index,chestId:game.chestAt(index)?.id||null,reason:extra.reason||'danger'};}
        if(topic==='promise'){const e=[...comp.ai.timeline].reverse().find(e=>e.type==='broken-promise');return{kind:e?.detail.key,event:e?.no,createdAt:comp.ai.promises[e?.detail.key]?.createdAt};}
        if(topic==='injury'){const e=[...comp.ai.timeline].reverse().find(e=>e.type==='injury');return{event:e?.no};}
        return{dungeon:comp.dungeon};
    }
    function start(comp,topic,extra={}) {
        const s=subject(comp,topic,extra),key=roomKey(comp)+':'+topic+':'+JSON.stringify(s),old=state(comp);
        if(old?.key===key)return old;
        const c={key,room:roomKey(comp),topic,subject:s,used:[],turns:[],agreements:[],complete:false,page:0};
        comp.ai.conversation=c;comp.ai.choicePage=0;return c;
    }
    function valid(comp,c) {
        if(!c)return false;
        if(c.topic==='loot')return comp.lastLoot?.uid===c.subject.uid&&(comp.lastLoot.owner==='player'||comp.inventory.some(i=>i.uid===c.subject.uid));
        if(c.topic==='refusal'){const chest=game.chestAt(c.subject.index);return !!chest&&!chest.opened&&chest.id===c.subject.chestId;}
        if(c.topic==='promise')return comp.ai.promises[c.subject.kind]?.createdAt===c.subject.createdAt;
        return true;
    }
    function open(comp,pending) {
        comp.ai.lastPlayerLine=null;
        const item=comp.inventory.find(i=>i.uid===comp.lastLoot?.uid),rest=comp.ai.timeline.filter(e=>e.type==='rest').at(-1);
        if(item?.discussion?.deferredAt!=null&&rest?.no>item.discussion.deferredAt&&rest.no>(comp.lastLoot.reviewAt||0)){
            comp.lastLoot.reviewAt=rest.no;item.discussion.requested=false;item.discussion.negotiated=false;item.discussion.closed=false;
            comp.ai.conversation=null;
        }
        let c=state(comp);if(c&&!valid(comp,c))comp.ai.conversation=c=null;
        if(pending?.type==='injury')start(comp,'injury');
        else if(pending?.type==='broken-promise')start(comp,'promise');
        else if(pending?.type==='deadline-near')start(comp,'finance');
        else if(pending?.type==='chest-refusal')start(comp,'refusal',{reason:pending.detail.reason});
        else if(pending?.type==='valuable-find'&&comp.lastLoot)start(comp,'loot');
        else if(!c&&comp.lastLoot?.owner==='rogi'&&!item?.discussion?.closed)start(comp,'loot');
    }
    function anchor(comp) {return comp.ai.timeline.filter(e=>!['support','joke','bond-discussed','conversation-respect','dialogue-act'].includes(e.type)).at(-1)?.no||0;}
    function playerText(comp,a) {
        const c=state(comp),injured=comp.hp<comp.maxHp;
        const room=game.roomType();
        const map={support:injured?'Ты мне нужна живой. Больше не торопимся.':'Я ценю то, что ты делаешь. Мы справляемся вместе.',
            joke:room==='CAMP'?'Хорошо, что костёр пока не требует плату за обогрев.':room==='SHOP'?'Если продавец предложит сундук со скидкой, попросим сначала показать зубы.':injured?'В следующий раз пусть сундук сначала покажет меню.':'Если сундук попросит чаевые, делаем вид, что нас здесь нет.',
            argue:'Почему ты решила оставить этот свиток?',pressure:'Отдай свиток. Я не собираюсь это обсуждать.',
            'repeat-pressure':'Я всё ещё требую, чтобы ты отдала свиток.', 'request-share-loot':'Можешь отдать мне этот свиток?',
            'negotiate-loot':'Давай договоримся о компенсации за свиток.', 'personal-bond':comp.ai.disclosedBond?'Хочешь вернуться к тому, что ты рассказывала?':'Что держит тебя на этой дороге?',
            'clarify-bond':'Если хочешь, расскажи об этом подробнее.',apologize:'Я был неправ. Хочу это исправить.',
            'ask-future':'Что ты будешь делать, когда выберемся?', 'promise-risk':'Следующий опасный сундук открою я.',
            'promise-no-danger':'Я не стану посылать тебя к известному мимику.', 'promise-share':'Спорные находки будем обсуждать без давления.'};
        return map[a.id]||a.text;
    }
    /* A reason is part of the disabled state, not a stale subtitle. Keep the
       label, accessibility state and action guard in sync after every turn. */
    const action=(id,text,enabled=true,why='')=>({id:'conversation-'+id,text,category:'Разговор',disabled:!enabled,disabledReason:enabled?'':why});
    function history(c,rows) {
        if(c.turns.length>1){const cursor=c.viewTurn??c.turns.length-1;
            rows.push(action('history-prev','← Предыдущие реплики',cursor>0),action('history-next','Следующие реплики →',cursor<c.turns.length-1));}
        return rows;
    }
    function options(comp,c) {
        if(!valid(comp,c)||c.complete)return history(c,[action('menu','Поговорим о другом.'),action('finish','Вернёмся к дороге.')]);
        const a=[];const loot=comp.lastLoot,item=comp.inventory.find(i=>i.uid===c.subject.uid),d=item?.discussion||{};
        const add=(id,text,enabled=true,why='')=>{
            if(c.topic==='loot'&&['share','compensate','buy','pressure','pressure-repeat','agreement'].includes(id)&&comp.hp<=0){enabled=false;why='Роги ранена. Для этого действия нужен отдых у костра.';}
            if(!c.used.includes(id))a.push(action(id,text,enabled,why));
        };
        if(c.topic==='loot'){
            if(loot?.owner==='player'){add('thank','Спасибо. Я ценю, что ты поделилась.');}
            else if(item&&!d.closed){
                add('explain','Почему ты решила оставить этот свиток?');
                if(!d.requested)add('share','Можешь отдать мне этот свиток?');
                add('respect','Хорошо, это твоя находка. Решай сама.');
                if(!d.negotiated&&!loot.offer)add('compensate','Предлагаю компенсировать твою долю. Договоримся?');
                if(loot.offer)add('buy',(loot.splitOffer?'Разделить стоимость':'Выкупить свиток')+' · '+loot.price+' зол.',game.playerGold()>=loot.price,'Не хватает золота.');
                if(comp.ai.promises.fairLoot?.status==='active')add('agreement','Мы обещали обсуждать находки без давления.');
                if(!d.pressureCount)add('pressure','Отдай свиток. Я не собираюсь это обсуждать.');
                else if(d.pressureCount===1)add('pressure-repeat','Я всё ещё требую, чтобы ты отдала свиток.');
                if(loot.decision==='defer')add('defer','Хорошо. Вернёмся к находке после отдыха.');
            }
        }else if(c.topic==='refusal'){
            const index=c.subject.index,assessment=game.canCompanionAct('open',index),chest=game.chestAt(index);
            add('self','Хорошо, этот сундук открою я.');
            const free=game.questionFree(),price=free?0:game.advicePrice('inspect-chest');
            if(!chest?.adviceBought)add('inspect','Давай сначала проверим сундук. · 1 сосред. · '+(free?'бесплатно':price+' зол.'),comp.hp>0&&comp.ai.focus>=1&&game.playerGold()>=price,'Не хватает сил или золота для проверки.');
            add('safe','Пожалуй, оставим этот сундук и поищем другой.');
            add('mutual','Обсудим, кто рискует и кому достанется находка?');
            if(assessment.allowed)add('retry',chest.known==='scroll'?'Здесь может быть свиток. Ты согласна попробовать?':chest.known==='mimic'?'Мы знаем о мимике. Ты согласна попробовать?':'Ты согласна попробовать открыть этот сундук?');
        }else if(c.topic==='injury'){
            add('health','Как ты? Насколько сильно тебя задело?');
            if(!comp.ai.seen['promise:risk'])add('risk','Следующий опасный сундук открою я.');
            if(!comp.ai.seen['promise:noKnownDanger'])add('no-danger','Я не буду посылать тебя к известному мимику.');
            add('rest','До костра сундуки беру на себя. Тебе нужна передышка.');
            add('decline','Не стану обещать того, чего не смогу выполнить.');
        }else if(c.topic==='promise'){
            add('promise-explain','Ты права, мы договаривались иначе. Как теперь быть?');
            if(c.subject.kind==='helpDebt'&&comp.ai.promises.helpDebt?.status==='broken')add('repair','Я могу передать золото сейчас. Это не отменяет моего поступка.');
            add('apology','Я был неправ. Постараюсь не повторять этого.');
            add('decline','Я услышал. Обещать снова пока не стану.');
        }else if(c.topic==='finance'){
            add('finance-status','Сколько тебе ещё не хватает? Давай посчитаем.');
            if(game.playerGold()>0)add('repair','Давай посмотрим, сколько золота я могу передать.');
            if(comp.ai.promises.helpDebt?.status!=='active'&&comp.ai.promises.helpDebt?.dungeon!==comp.dungeon)add('conditional','Помогу, если на выходе тебе не хватит.');
            add('decline','Сейчас не могу обещать помощь. Давай считать только то, что есть.');
        }else if(c.topic==='personal'){
            add('support','Спасибо, что рассказала. Я не буду тебя торопить.');
            add('clarify','Если хочешь, расскажи ещё немного.');
            add('joke','Давай на минуту вспомним, что кроме долгов бывают и хорошие вечера.');
        }
        a.push(action('menu','Поговорим о другом.'));return history(c,a);
    }
    function choices(comp,prepared,pageSize) {
        let c=state(comp);if(c&&!valid(comp,c)){comp.ai.conversation=null;c=null;}
        let list=c?options(comp,c):prepared.filter(a=>a.id!=='argue'||(comp.lastLoot?.owner==='rogi'&&comp.inventory.some(i=>i.uid===comp.lastLoot.uid))).map(a=>({...a,text:playerText(comp,a),
            ...(['request-share-loot','negotiate-loot','buy-loot','pressure','repeat-pressure'].includes(a.id)&&comp.hp<=0?{disabled:true,disabledReason:'Роги ранена. Нужен отдых у костра.'}:{})}));
        const pages=Math.max(1,Math.ceil(list.length/pageSize)),page=Math.floor((comp.ai.choicePage||0)/pageSize)%pages;
        const rows=list.slice(page*pageSize,page*pageSize+pageSize);
        if(pages>1)rows.push({id:'more-questions',effect:'next-page',category:c?'Продолжения':'Темы',text:page===pages-1?'← К первым вопросам':'Другие вопросы →',topicPage:((page+1)%pages)*pageSize});
        return rows;
    }
    function say(comp,text) {comp.line=text;RogiAI.setDialogue(comp,text);return text;}
    function effectOnce(comp,key,fn) {comp.ai.socialEffects||={};if(comp.ai.socialEffects[key])return false;comp.ai.socialEffects[key]=true;fn();return true;}
    function respect(comp,c) {
        if(c.topic==='loot'){const item=comp.inventory.find(i=>i.uid===c.subject.uid);if(item){game.companionLootDiscussion(item).closed=true;delete item.discussion.deferredAt;}}
        effectOnce(comp,'respect:'+c.key,()=>{game.bumpTrust(1);RogiAI.event(comp,'conversation-respect',{subject:c.subject,actor:'player'});});
    }
    function handle(comp,c,id,baseAct) {
        if(id==='menu'){c.complete=true;comp.ai.conversation=null;comp.ai.choicePage=0;return say(comp,'Хорошо. О чём хочешь спросить?');}
        if(id==='finish'){c.complete=true;RogiAI.closeDialogue(comp);game.setModal(null);return comp.line;}
        if(id==='explain')return say(comp,comp.lastLoot?.decision==='defer'?'Пока не хочу решать сгоряча. Давай вернёмся к этому после настоящей передышки.':RogiAI.voice(comp,'loot-keep',{uid:c.subject.uid},'Я хочу сохранить эту находку.'));
        if(id==='share'){game.requestLoot('polite');return say(comp,comp.line);}
        if(id==='compensate'||id==='mutual'||id==='agreement'){
            if(c.topic==='loot'){
                if(id==='agreement'){
                    const p=comp.ai.promises.fairLoot;RogiAI.event(comp,'agreement-reminder',{actor:'player',promise:'fairLoot',createdAt:p.createdAt,uid:c.subject.uid});
                    const item=comp.inventory.find(i=>i.uid===c.subject.uid);
                    if(item?.discussion?.negotiated)return say(comp,'Я помню: обсуждаем находки без давления. Мои предложенные условия пока остаются прежними.');
                }
                game.negotiateLoot();return say(comp,comp.line);
            }
            return say(comp,'Давай. Можно сначала проверить сундук или выбрать другой. Сам разговор об условиях ещё не означает, что я согласилась его открыть.');
        }
        if(id==='buy'){game.buyLoot();c.complete=comp.lastLoot.owner==='player';return say(comp,comp.line);}
        if(id==='pressure'||id==='pressure-repeat'){game.pressureLoot();const item=comp.inventory.find(i=>i.uid===c.subject.uid);if(!item||item.discussion?.closed)c.complete=true;return say(comp,comp.line);}
        if(id==='health')return say(comp,RogiAI.voice(comp,'injury',{},'Мне нужна передышка.'));
        if(id==='finance-status')return say(comp,RogiAI.voice(comp,'debt',{},'Давай посчитаем средства.'));
        if(id==='respect'||id==='safe'||id==='thank'){respect(comp,c);c.complete=true;if(id==='safe')game.setSelectedChest(-1);return say(comp,id==='thank'?'Береги находку. Мне приятно, что ты это заметил.':'Спасибо, что услышал. Так мне проще идти рядом.');}
        if(id==='defer'){const item=comp.inventory.find(i=>i.uid===c.subject.uid);if(item){game.companionLootDiscussion(item).deferredAt=comp.ai.eventNo;item.discussion.closed=true;}c.complete=true;return say(comp,'Хорошо. После отдыха сможем обсудить её снова.');}
        if(id==='self'||id==='retry'){
            game.setSelectedChest(c.subject.index);RogiAI.closeDialogue(comp);game.setModal(null);c.complete=true;
            if(id==='self')say(comp,'Хорошо. В этот раз риск принимаешь ты.');
            if(id==='self')game.requestOpen();else game.requestCompanionChest('open');return comp.line;
        }
        if(id==='inspect'){game.setSelectedChest(c.subject.index);game.askChest();return comp.dialogueLine;}
        if(id==='risk'||id==='no-danger'||id==='conditional'){
            const kind=id==='risk'?'risk':id==='no-danger'?'noKnownDanger':'helpDebt';
            if(RogiAI.recordPromise(comp,kind,{kind:'exit-shortfall'})){c.agreements.push({kind,createdAt:comp.ai.promises[kind].createdAt});c.complete=true;return say(comp,RogiAI.voice(comp,'promise-made',{promise:kind},'Договорились.'));}
            return say(comp,'У нас уже есть такое обещание. Давай сначала разберёмся с ним.');
        }
        if(id==='rest'){
            comp.ai.restAgreement={after:comp.ai.eventNo,dungeon:comp.dungeon,status:'active'};c.agreements.push({kind:'until-rest'});c.complete=true;
            RogiAI.event(comp,'rest-agreed',{actor:'player',until:'rest'});return say(comp,'Хорошо. Пока не отдохну у костра, сундуки берёшь на себя.');
        }
        if(id==='repair'){RogiAI.closeDialogue(comp);game.setModal({type:'transfer',amount:Math.min(25,game.playerGold())});return comp.line;}
        if(id==='promise-explain')return say(comp,'Ты обещал '+RogiVoice.promiseDescription(comp,c.subject.kind)+'. Мне важно, что ты признаёшь именно этот договор. Давай решим, как поступать дальше.');
        if(id==='decline'){c.complete=true;return say(comp,'Лучше честный ответ сейчас, чем ещё одно невыполненное обещание.');}
        if(['support','joke','apology','clarify'].includes(id))return baseAct(comp,id==='clarify'?'clarify-bond':id==='apology'?'apologize':id);
    }
    function act(comp,id,displayed,baseAct) {
        if(id==='more-questions')return baseAct(comp,id);
        if(id==='argue'&&comp.lastLoot?.owner!=='rogi')return comp.dialogueLine;
        let c=state(comp),choice=c?options(comp,c).find(a=>a.id===id):comp.dialogueChoices?.find(a=>a.id===id);
        if(id.startsWith('conversation-')&&(!choice||choice.disabled||!valid(comp,c)))return comp.dialogueLine;
        if(choice?.disabled)return comp.dialogueLine;
        if(id==='conversation-history-prev'||id==='conversation-history-next'){
            c.viewTurn=(c.viewTurn??c.turns.length-1)+(id.endsWith('prev')?-1:1);comp.ai.narrative.textPage=0;
            game.updateUI();return comp.dialogueLine;
        }
        const line=displayed||choice?.text||playerText(comp,ROGI_DIALOGUE_ACTIONS.find(a=>a.id===id)||{id,text:id});
        const legal=(c?options(comp,c):comp.dialogueChoices||[]).filter(a=>!a.disabled&&a.id!=='more-questions');
        const previousAct=comp.ai.narrative?.playerActs?.at(-1),record=trace(comp,'conversation',{topic:c?.topic||'general',subject:c?.subject||null,initiator:'player',executor:'player',riskBearer:null},legal.length?legal:[{id}],[],id);
        comp.ai.conversationActionId=record.decisionId;comp.ai.decisionLog=[];
        let reply;
        try{
            if(id.startsWith('conversation-')){const key=id.slice(13);c.used.push(key);reply=handle(comp,c,key,baseAct);}
            else if(id==='argue'){c=start(comp,'loot');reply=handle(comp,c,'explain',baseAct);c.used.push('explain');}
            else{
                const social=['support','joke','apologize','personal-bond','clarify-bond'].includes(id),token=id+':'+roomKey(comp)+':'+anchor(comp);
                if(social&&comp.ai.socialEffects?.[token])reply=say(comp,RogiAI.voice(comp,id==='personal-bond'?'bond':id==='clarify-bond'?'clarify-bond':id==='apologize'?'apology':id,{},'Я тебя услышала.'));
                else{if(social)effectOnce(comp,token,()=>{});reply=baseAct(comp,id);}
                if(['personal-bond','clarify-bond'].includes(id))c=start(comp,'personal');
                else if(['request-share-loot','negotiate-loot','pressure','repeat-pressure'].includes(id))c=start(comp,'loot');
            }
            if(c){c.turns.push({player:line,reply:comp.dialogueLine||reply,action:id,decisionId:record.decisionId,eventNo:comp.ai.eventNo});c.viewTurn=c.turns.length-1;if(c.turns.length>=4)c.complete=true;}
            comp.ai.lastPlayerLine=line;record.playerLine=line;record.after=snapshot(comp);record.reply=comp.dialogueLine||reply;record.applied=true;
            const n=RogiVoice.state(comp);
            if(n.playerActs.at(-1)&&n.playerActs.at(-1)!==previousAct)n.playerActs.at(-1).text=line;
            else{n.playerActs.push({id,text:line,eventNo:comp.ai.eventNo});if(n.playerActs.length>12)n.playerActs.shift();}
            comp.ai.choicePage=0;return reply;
        }finally{comp.ai.conversationActionId=null;flush(comp);game.updateUI();}
    }
    function openDialogue(comp,reason,baseOpen) {
        open(comp,comp.ai.drama.pending);
        return baseOpen(comp,reason);
    }
    return{state,start,choices,act,openDialogue,trace,flush,spoken,snapshot,playerText,names,migrateLegacyRoles};
})();
