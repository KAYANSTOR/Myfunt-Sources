/* OZAN 2.2.3: render the user's original profile controls in a full scrollable window. */
(()=>{'use strict';
 const former=document.getElementById('ozAuthAccount');
 const card=former?.querySelector('.oz-auth-card');
 if(!former||!card)return;
 const host=document.querySelector('.page')||document.getElementById('app')||document.body;
 const win=document.getElementById('ozProfileWindow')||document.createElement('section');
 win.className='window oz-profile-window';win.id='ozProfileWindow';win.setAttribute('aria-hidden','true');
 if(!win.querySelector('.window__header')){
   const header=document.createElement('header');header.className='window__header';
   header.innerHTML='<button type="button" class="icon-btn" data-window-close aria-label="إغلاق الملف الشخصي"><i class="fa-solid fa-xmark"></i></button><h2><i class="fa-solid fa-id-card"></i> ملفي الشخصي</h2><span aria-hidden="true"></span>';
   win.appendChild(header);
 }
 let body=win.querySelector('.window__body');if(!body){body=document.createElement('div');body.className='window__body oz-profile-page';win.appendChild(body);}
 card.classList.add('oz-profile-content');body.appendChild(card);host.appendChild(win);
 former.hidden=true;
 window.OzanProfilePage={open(){window.openWindow?.('ozProfileWindow');window.OzanProductionTools?.renderProfile?.();},close(){window.closeWindow?.('ozProfileWindow',{skipHistory:true});}};
})();
