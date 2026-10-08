/* OZAN V2.0.5 — تأكيدات عربية محلية آمنة، مستقلة عن confirm/alert في المتصفح. */
"use strict";
(()=>{
 let busy=false;
 const queue=[];
 const host=()=>document.getElementById('ozSystemDialog');
 function run(){
  if(busy||!queue.length)return;busy=true;
  const task=queue.shift(),dialog=host();if(!dialog){busy=false;task.resolve(false);run();return;}
  const title=dialog.querySelector('#ozSystemTitle'),message=dialog.querySelector('#ozSystemMessage'),ok=dialog.querySelector('#ozSystemOk'),cancel=dialog.querySelector('#ozSystemCancel');
  title.textContent=task.options.title||'تأكيد الإجراء';message.textContent=task.message;
  ok.textContent=task.options.confirmLabel||'متابعة';cancel.textContent=task.options.cancelLabel||'إلغاء';
  ok.classList.toggle('oz-danger-button',Boolean(task.options.danger));cancel.hidden=Boolean(task.options.notice);
  const previous=document.activeElement;dialog.hidden=false;document.body.classList.add('oz-system-dialog-open');
  function finish(value){
   ok.removeEventListener('click',yes);cancel.removeEventListener('click',no);dialog.removeEventListener('click',outside);document.removeEventListener('keydown',keys,true);
   dialog.hidden=true;document.body.classList.remove('oz-system-dialog-open');
   if(previous?.isConnected)previous.focus({preventScroll:true});
   busy=false;task.resolve(value);run();
  }
  const yes=()=>finish(true),no=()=>finish(false),outside=e=>{if(e.target===dialog&&!task.options.notice)finish(false);};
  const keys=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}else if(e.key==='Tab'){
    const items=[cancel,ok].filter(x=>!x.hidden);if(!items.length)return;
    const current=items.indexOf(document.activeElement);if(e.shiftKey&&current<=0){e.preventDefault();items[items.length-1].focus();}
    else if(!e.shiftKey&&current===items.length-1){e.preventDefault();items[0].focus();}
  }};
  ok.addEventListener('click',yes);cancel.addEventListener('click',no);dialog.addEventListener('click',outside);document.addEventListener('keydown',keys,true);(task.options.notice?ok:cancel).focus({preventScroll:true});
 }
 window.ozConfirm=(message,options={})=>new Promise(resolve=>{queue.push({message:String(message),options,resolve});run();});
 window.ozWarn=(message,options={})=>window.ozConfirm(message,{title:'تنبيه من مايفنت',confirmLabel:'حسنًا',...options,notice:true});
})();
