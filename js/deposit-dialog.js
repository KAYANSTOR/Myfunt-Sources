/* OZAN 2.1.0 — explicit underpaid-deposit choice, fully local. */
"use strict";
let ozDepositDialogBusy=false;
function ozAskDepositShortfall({packageName,required,paid,currency}){
  if(ozDepositDialogBusy)return Promise.resolve("cancel");
  const dialog=document.getElementById("ozDepositDialog");
  if(!dialog)return Promise.resolve("cancel");
  ozDepositDialogBusy=true;
  const cancel=dialog.querySelector("#ozDepositCancel");
  const modify=dialog.querySelector("#ozDepositModify");
  const temporary=dialog.querySelector("#ozDepositTemp");
  const message=dialog.querySelector("#ozDepositMessage");
  message.textContent=`الباقة: ${packageName}\nالعربون الإجباري: ${numberText(required)} ${currency}\nالمدفوع: ${numberText(paid)} ${currency}\nالمبلغ الناقص: ${numberText(required-paid)} ${currency}\nيمكنك تعديل المدفوع، أو حفظ هذا الحجز مؤقتًا دون تأكيده حتى تُسجّل بقية العربون.`;
  dialog.hidden=false;document.body.classList.add("oz-system-dialog-open");
  const previouslyFocused=document.activeElement;
  return new Promise(resolve=>{
    function done(value){
      cancel.removeEventListener("click",onCancel);modify.removeEventListener("click",onModify);temporary.removeEventListener("click",onTemporary);
      document.removeEventListener("keydown",onKeys,true);dialog.removeEventListener("click",onBackdrop);
      dialog.hidden=true;document.body.classList.remove("oz-system-dialog-open");
      if(previouslyFocused?.isConnected)previouslyFocused.focus({preventScroll:true});
      ozDepositDialogBusy=false;resolve(value);
    }
    const onCancel=()=>done("cancel"),onModify=()=>done("edit"),onTemporary=()=>done("temporary");
    const onBackdrop=e=>{if(e.target===dialog)done("cancel");};
    const controls=[cancel,modify,temporary];
    function onKeys(e){
      if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();done("cancel");}
      if(e.key==="Tab"){
        const i=controls.indexOf(document.activeElement);
        if(e.shiftKey&&i<=0){e.preventDefault();temporary.focus();}
        else if(!e.shiftKey&&i===2){e.preventDefault();cancel.focus();}
      }
    }
    cancel.addEventListener("click",onCancel);modify.addEventListener("click",onModify);temporary.addEventListener("click",onTemporary);
    dialog.addEventListener("click",onBackdrop);document.addEventListener("keydown",onKeys,true);modify.focus({preventScroll:true});
  });
}
