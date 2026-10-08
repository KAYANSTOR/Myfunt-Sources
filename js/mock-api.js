"use strict";
(function(){
  const delay=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
  const base={mode:"mock",baseUrl:"/api/v1",timeout:5000};
  window.OzanApi={
    config:{...base},
    async request(path,{method="POST",body=null}={}){
      await delay(240);
      return {ok:true,status:200,mock:true,path,method,body,serverTime:new Date().toISOString()};
    },
    async sync(payload={}){ return this.request("/sync",{body:payload}); },
    async pushBooking(booking){ return this.request("/bookings",{body:booking}); },
    async health(){ return this.request("/health",{method:"GET"}); }
  };
})();
