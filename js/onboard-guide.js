/* Myfnt 2.14.11: focused first-use guides with a real viewport spotlight. */
'use strict';
(()=>{
 const el=id=>document.getElementById(id),tour=el('ozTourHint');if(!tour)return;
 const targets=['#calendarGrid','.calendar-day.is-today','#addBtn','.calendar-day.is-today','.booking-card'];
 let current=null,ring=null;
 function ensureRing(){if(ring?.isConnected)return ring;ring=document.createElement('div');ring.id='ozTourFocusRing';ring.className='oz-tour-focus-ring';ring.hidden=true;document.body.append(ring);return ring;}
 function clear(){current?.classList.remove('oz-guided-focus');current=null;document.body.classList.remove('oz-tour-active');const r=ensureRing();r.hidden=true;}
 function targetIndex(){const text=el('ozTourText')?.textContent||'';if(text.includes('اسحب'))return 0;if(text.includes('انقر يومًا'))return 1;if(text.includes('إضافة حجز'))return 2;if(text.includes('مطولًا'))return 3;return 4;}
 function fallback(idx){if(idx===4)return document.querySelector('.booking-card')||document.querySelector('#bookingList')||document.querySelector('#calendarGrid');return document.querySelector(targets[idx])||document.querySelector('#calendarGrid');}
 function positionRing(){if(!current||tour.hidden)return;const rect=current.getBoundingClientRect();if(rect.width<2||rect.height<2)return;const pad=6,r=ensureRing();r.hidden=false;r.style.left=`${Math.max(4,rect.left-pad)}px`;r.style.top=`${Math.max(4,rect.top-pad)}px`;r.style.width=`${Math.min(innerWidth-8,rect.width+pad*2)}px`;r.style.height=`${Math.min(innerHeight-8,rect.height+pad*2)}px`;}
 function update(){clear();if(tour.hidden)return;if(window.MyfntUiState?.blockingSurfaceOpen?.(['ozTourHint']))return;const idx=targetIndex(),node=fallback(idx);if(!node||!node.getClientRects().length)return;current=node;current.classList.add('oz-guided-focus');document.body.classList.add('oz-tour-active');positionRing();}
 new MutationObserver(update).observe(tour,{attributes:true,attributeFilter:['hidden']});
 el('ozTourNext')?.addEventListener('click',()=>requestAnimationFrame(update));
 el('ozTourSkip')?.addEventListener('click',()=>requestAnimationFrame(clear));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();else update();});
 window.addEventListener('resize',()=>requestAnimationFrame(positionRing),{passive:true});
 window.addEventListener('scroll',()=>requestAnimationFrame(positionRing),{passive:true,capture:true});
 const btn=el('ozReplayTour');btn?.setAttribute('title','إظهار إرشادات الاستخدام عند الطلب');
})();
