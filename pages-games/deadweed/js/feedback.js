// Optional ordinary-game survey. Recorder sessions keep their existing separate questionnaire.
'use strict';
(()=>{
 if(window.DEADWEED_PLAYTEST||typeof document.createElement!=='function')return;
 const questions=[['dodge','Была ли необходимость уклоняться?'],['danger','Было ли ощущение реальной угрозы смерти?'],['fairness','Сложность возникала из честных атак или нехватки восстановления?'],['boss_weapon','Пришлось ли выбирать оружие специально против босса?'],['boss_interest','Были ли боссы интересными, а не просто живучими?'],['replay','Хотелось ли повторить забег?']];
 const root=new URL('../',document.currentScript.src),endpoint=new URL('api/playtests',root),key='deadweed-feedback-outbox-v1',rejectedKey='deadweed-feedback-rejected-v1';
 let pending=[],rejected=[],sending=null,current=null,modal=null,draft=[],generation=0;const sent=new Set();
 try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))pending=saved.slice(0,10);}catch(_){}
 try{const saved=JSON.parse(localStorage.getItem(rejectedKey)||'[]');if(Array.isArray(saved))rejected=saved;}catch(_){}
 const release=fetch(new URL('release.json',root),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(r=>r?{release:r.release,commit:r.commit}:{release:'local',commit:null}).catch(()=>({release:'local',commit:null}));
 const style=document.createElement('style');style.textContent=`
 #deadweed-feedback-open{position:fixed;right:16px;bottom:18px;z-index:30;padding:12px 18px;background:#233b2c;color:#e7efcf;border:1px solid #8b9b65;font:14px Consolas,monospace;cursor:pointer}
 #deadweed-feedback{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;background:#05100dd9;padding:16px;box-sizing:border-box;color:#dce8cf;font:14px/1.45 Consolas,monospace}
 #deadweed-feedback form{box-sizing:border-box;width:min(620px,100%);max-height:94vh;overflow:auto;background:#10231b;border:1px solid #7e9461;padding:20px}
 #deadweed-feedback h2{font-size:20px;margin:0 0 8px}#deadweed-feedback small{display:block;color:#aebfa8;margin-bottom:12px}
 #deadweed-feedback label{display:block;margin:10px 0}#deadweed-feedback textarea{display:block;box-sizing:border-box;width:100%;min-height:48px;resize:vertical;margin-top:4px;background:#21372a;color:#edf1da;border:1px solid #657d58;font:inherit;padding:7px}
 #deadweed-feedback button{padding:10px 12px;margin:5px 8px 0 0;color:#e4efcf;background:#294332;border:1px solid #8b9b65;font:inherit;cursor:pointer}#deadweed-feedback button:disabled{opacity:.6}#deadweed-feedback p[role=status]{color:#d4dca6;margin:8px 0}`;document.head.append(style);
 const openButton=document.createElement('button');openButton.id='deadweed-feedback-open';openButton.textContent='Оставить отзыв о забеге';openButton.hidden=true;document.body.append(openButton);
 const persist=()=>localStorage.setItem(key,JSON.stringify(pending)),persistRejected=()=>{try{localStorage.setItem(rejectedKey,JSON.stringify(rejected));}catch(_){}};
 function flush(){
  if(sending)return sending;
  sending=(async()=>{while(pending.length){const item=pending[0],r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});if(!r.ok){if(r.status>=400&&r.status<500&&r.status!==429){pending.shift();rejected.push({item,status:r.status,at:new Date().toISOString()});persistRejected();try{persist();}catch(_){}continue;}throw Error('HTTP '+r.status);}const answer=await r.json();if(answer.submissionId!==item.submissionId)throw Error('Wrong submission receipt');pending.shift();sent.add(item.submissionId);if(current?.runId===item.submissionId)openButton.hidden=true;try{persist();}catch(_){} }})();
  return sending.finally(()=>{sending=null;});
 }
 function close(){modal?.remove();modal=null;}
 function show(){
  if(!current||modal||sent.has(current.runId))return;
  const report=current,token=generation;modal=document.createElement('div');modal.id='deadweed-feedback';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Отзыв о забеге');
  const form=document.createElement('form'),heading=document.createElement('h2'),note=document.createElement('small');heading.textContent='Как прошёл забег?';note.textContent='По желанию. К ответам приложится отчёт забега: профиль, карточки и бой. Видео не записывается. Данные отправятся разработчику игры.';form.append(heading,note);
  const info=document.createElement('small');info.textContent=report.balanceConfig+' · '+report.balanceConfigVersion+' · '+report.result;form.append(info);
  const queued=pending.find(p=>p.submissionId===report.runId);
  const fields=questions.map(([id,question],i)=>{const label=document.createElement('label'),field=document.createElement('textarea');label.textContent=question;field.maxLength=4000;field.value=queued?queued.answers[i].answer:(draft[i]||'');field.disabled=!!queued;field.addEventListener('input',()=>{draft[i]=field.value;});label.append(field);form.append(label);return field;});
  const status=document.createElement('p');status.setAttribute('role','status');form.append(status);
  const submit=document.createElement('button');submit.type='submit';submit.textContent='Отправить отзыв';
  const skip=document.createElement('button');skip.type='button';skip.textContent='Закрыть';skip.onclick=close;
  const download=document.createElement('button');download.type='button';download.textContent='Скачать ответы и отчёт';
  const payload=async()=>pending.find(p=>p.submissionId===report.runId)||rejected.find(entry=>entry.item?.submissionId===report.runId)?.item||({schemaVersion:1,kind:'public-playtest',submissionId:report.runId,report,release:await release,answers:questions.map(([id,question],i)=>({id,question,answer:fields[i].value.trim()}))});
  download.onclick=async()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(await payload(),null,2)],{type:'application/json'}));a.href=url;a.download='deadweed-feedback-'+report.runId+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  form.onsubmit=async e=>{
   e.preventDefault();if(!fields.some(f=>f.value.trim())){status.textContent='Заполни хотя бы один ответ или закрой опрос.';return;}
   submit.disabled=true;
   try{
    const item=await payload();if(token!==generation)return;
    const existing=pending.find(p=>p.submissionId===item.submissionId);
    if(!existing){if(pending.length>=10)throw Error('Очередь заполнена. Скачай ответы и отчёт.');pending.push(item);try{persist();}catch(_){pending.pop();throw Error('Не удалось сохранить в браузере. Скачай ответы и отчёт.');}}
    fields.forEach(f=>f.disabled=true);status.textContent='Отправляю…';await flush();
    if(pending.some(p=>p.submissionId===item.submissionId))throw Error('Отправка ещё не завершена');
    const permanent=rejected.find(entry=>entry.item?.submissionId===item.submissionId);if(permanent)throw Error('Сервер отклонил отзыв (HTTP '+permanent.status+'). Копия оставлена в браузере; скачай её и передай разработчику.');
    status.textContent='Спасибо! Отзыв и отчёт сохранены на сервере.';submit.textContent='Отправлено';openButton.hidden=true;
   }catch(error){status.textContent=pending.some(p=>p.submissionId===report.runId)?'Отзыв сохранён в браузере. Повторим отправку при восстановлении связи. Можно скачать копию.':String(error.message||error);submit.disabled=false;submit.textContent='Повторить отправку';}
  };
  form.append(submit,download,skip);modal.append(form);modal.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')close();});modal.addEventListener('pointerdown',e=>e.stopPropagation());document.body.append(modal);fields[0].focus();
 }
 openButton.onclick=show;
 const save=game.saveBalanceReport.bind(game);game.saveBalanceReport=()=>{save();if(!game.outcome)return;const report=JSON.parse(JSON.stringify(game.createBalanceReport()));if(current?.runId===report.runId)return;current=report;draft=[];openButton.hidden=false;openButton.textContent='Оставить отзыв о забеге';setTimeout(()=>{if(current?.runId===report.runId)show();},0);};
 const reset=game.reset.bind(game);game.reset=()=>{generation++;close();current=null;draft=[];openButton.hidden=true;reset();};
 window.addEventListener('online',()=>flush().catch(()=>{}));flush().catch(()=>{});
})();
