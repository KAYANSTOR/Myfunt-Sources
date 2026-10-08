"use strict";
/* OZAN — مؤثرات صوتية اختيارية، دون ملفات خارجية أو تتبع.
   تتوفر بعد أول تفاعل مع الصفحة، وتُحترم إعدادات كتم الصوت بالنظام.
   تُحفظ رغبة المستخدم على نفس الجهاز فقط. */
(()=>{
  const KEY="ozan.sounds.enabled.v1";
  let ctx=null,lastNotification=0;
  const enabled=()=>{try{return localStorage.getItem(KEY)!=="false";}catch{return true;}};
  function toggle(){const value=!enabled();try{localStorage.setItem(KEY,String(value));}catch{}return value;}
  // Web Audio API تدعم Chrome وSafari؛ الفشل الصامت يمنع تعطل أي عملية حجز.
  function play(type){
    if(!enabled()||document.hidden)return;
    const now=Date.now();if(type==="notification"&&now-lastNotification<3500)return;
    if(type==="notification")lastNotification=now;
    const patterns={
      booking:[[660,.09,0],[880,.11,.105],[1046,.17,.235]],
      notification:[[880,.075,0],[1175,.12,.13]],
      save:[[720,.07,0],[960,.10,.095]],
      sync:[[620,.075,0],[830,.075,.095],[990,.10,.20]],
      warning:[[440,.11,0],[390,.14,.155]]
    };
    try{
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx)return;
      ctx ||= new AudioCtx();
      if(ctx.state==="suspended")ctx.resume().catch(()=>{});
      const base=ctx.currentTime+.005;
      for(const [freq,duration,offset] of patterns[type]||patterns.save){
        const oscillator=ctx.createOscillator(),gain=ctx.createGain(),t=base+offset;
        oscillator.type="sine";oscillator.frequency.setValueAtTime(freq,t);
        gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.045,t+.015);
        gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
        oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(t);oscillator.stop(t+duration+.015);
      }
    }catch(err){console.debug("[الأصوات] الصوت غير متاح",err);}
  }
  window.OzanSounds={enabled,toggle,play};
})();
