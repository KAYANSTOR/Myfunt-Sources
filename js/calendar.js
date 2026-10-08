"use strict";

/* نواة تقويم OZAN: مستقلة عن بقية التطبيق حتى لا يمنع خطأ جزئي عرض الأشهر.
   تدعم اللمس، التنقل، توسيع التقويم، وتزامن خصائص إمكانية الوصول. */
(() => {
  const core = {
    cfg: null,
    swipeStart: null,
    swiping: false,
    suppressClickUntil: 0,
    initialized: false,

    init(config) {
      this.cfg = config;
      const { grid, card, title, prevBtn, nextBtn, todayBtn, foldHandle } = config.elements;
      if (!grid || !card || !title) throw new Error("CALENDAR_REQUIRED_DOM_MISSING");
      if (!this.initialized) {
        grid.addEventListener("click", (e) => {
          if (performance.now() < this.suppressClickUntil || this.swiping) return;
          const day = e.target.closest(".calendar-day");
          if (day?.dataset.date) this.selectDate(day.dataset.date);
        });
        prevBtn?.addEventListener("click", () => this.moveMonth(-1));
        nextBtn?.addEventListener("click", () => this.moveMonth(1));
        todayBtn?.addEventListener("click", () => this.goToday());
        foldHandle?.addEventListener("click", () => this.setCollapsed(!this.isCollapsed()));
        this.bindSwipe(card);
        this.bindLongPress(grid);
        this.initialized = true;
      }
      this.syncCollapsedState();
      this.render();
      return true;
    },

    // ضغط مطوّل: إضافة حجز بالتاريخ المختار. إلغاء المؤقت عند الحركة/التمرير.
    bindLongPress(grid) {
      let timer=null, point=null, fired=false;
      const cancel=()=>{clearTimeout(timer);timer=null;point=null;};
      grid.addEventListener("pointerdown", e=>{
        if(e.button!==0 && e.pointerType==="mouse")return;
        // A NEW deliberate touch is independent from the previous long press/swipe.
        this.suppressClickUntil=0;
        const cell=e.target.closest(".calendar-day[data-date]");if(!cell)return;
        fired=false;point={x:e.clientX,y:e.clientY};
        timer=setTimeout(()=>{
          timer=null;fired=true;this.suppressClickUntil=performance.now()+650;
          this.cfg.onDateLongPress?.(cell.dataset.date);
        },560);
      });
      grid.addEventListener("pointermove",e=>{if(point&&Math.hypot(e.clientX-point.x,e.clientY-point.y)>11)cancel();});
      ["pointerup","pointercancel","pointerleave","scroll"].forEach(type=>grid.addEventListener(type,cancel));
      grid.addEventListener("contextmenu",e=>{if(e.target.closest(".calendar-day[data-date]"))e.preventDefault();});
    },

    bindSwipe(surface) {
      // Browsers must own vertical movement. Never capture the pointer or cancel
      // vertical touch events: doing so deadlocked scrolling in large workspaces.
      surface.style.touchAction = "pan-y pinch-zoom";
      const begin=(x,y,id)=>{this.swipeStart={x,y,id,t:performance.now(),axis:null};this.swiping=false;};
      const move=(x,y,id)=>{
        const start=this.swipeStart;if(!start||start.id!==id)return;
        const dx=x-start.x,dy=y-start.y,ax=Math.abs(dx),ay=Math.abs(dy);
        if(!start.axis&&Math.max(ax,ay)>12)start.axis=ax>ay*1.45?"x":"y";
        // Only a horizontal intentional swipe suppresses the following click.
        if(start.axis==="x")this.swiping=true;
      };
      const end=(x,y,id)=>{
        const start=this.swipeStart;if(!start||start.id!==id)return;
        this.swipeStart=null;
        const dx=x-start.x,dy=y-start.y,dt=Math.max(1,performance.now()-start.t);
        if(start.axis==="x"&&Math.abs(dx)>Math.abs(dy)*1.45&&
            (Math.abs(dx)>=48||(Math.abs(dx)>=32&&Math.abs(dx)/dt>.35))){
          // Suppress the synthetic click from THIS swipe, not the user's next tap.
          this.suppressClickUntil=performance.now()+110;
          this.moveMonth(dx>0?1:-1);
        }
        this.swiping=false;
      };
      if("PointerEvent" in window){
        surface.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button!==0)return;begin(e.clientX,e.clientY,e.pointerId);},{passive:true});
        surface.addEventListener("pointermove",e=>move(e.clientX,e.clientY,e.pointerId),{passive:true});
        surface.addEventListener("pointerup",e=>end(e.clientX,e.clientY,e.pointerId),{passive:true});
        surface.addEventListener("pointercancel",()=>{this.swipeStart=null;this.swiping=false;},{passive:true});
      }else{
        surface.addEventListener("touchstart",e=>{const t=e.changedTouches[0];if(t)begin(t.clientX,t.clientY,t.identifier);},{passive:true});
        surface.addEventListener("touchmove",e=>{const st=this.swipeStart;if(!st)return;const t=[...e.changedTouches].find(x=>x.identifier===st.id);if(t)move(t.clientX,t.clientY,t.identifier);},{passive:true});
        surface.addEventListener("touchend",e=>{const st=this.swipeStart;if(!st)return;const t=[...e.changedTouches].find(x=>x.identifier===st.id);if(t)end(t.clientX,t.clientY,t.identifier);},{passive:true});
        surface.addEventListener("touchcancel",()=>{this.swipeStart=null;this.swiping=false;},{passive:true});
      }
    },

    isCollapsed(){ return Boolean(this.cfg?.isCollapsed?.()); },
    setCollapsed(value){ const collapsed=Boolean(value); this.cfg?.setCollapsed?.(collapsed); document.body.classList.toggle("calendar-collapsed",collapsed); this.syncCollapsedState(); },
    syncCollapsedState(){
      const collapsed=this.isCollapsed(); document.body.classList.toggle("calendar-collapsed",collapsed);
      const handle=this.cfg?.elements?.foldHandle;
      if(handle){ handle.setAttribute("aria-expanded",collapsed?"false":"true"); handle.setAttribute("aria-label",collapsed?"فتح التقويم":"طي التقويم"); const icon=handle.querySelector("i"); if(icon)icon.className=`fa-solid ${collapsed?"fa-chevron-down":"fa-chevron-up"}`; }
    },

    render() {
      try { this.renderRich(); }
      catch (error) {
        console.error("[CalendarCore] rich render failed", error);
        try { this.renderFallback(); }
        catch (fallbackError) { console.error("[CalendarCore] fallback failed", fallbackError); }
      }
    },

    renderRich() {
      const c = this.cfg, viewDate = c.getViewDate();
      const year = viewDate.getFullYear(), month = viewDate.getMonth();
      c.elements.title.textContent = c.en(`${c.monthNames[month]} · ${String(month + 1).padStart(2, "0")} · ${year}`);
      const grid = c.elements.grid;
      grid.textContent = "";
      const first = new Date(year, month, 1);
      const saturdayIndex = (first.getDay() + 1) % 7;
      const start = new Date(year, month, 1 - saturdayIndex);
      const todayIso = c.isoDate(new Date());
      const markers = new Map();
      for (const b of c.getBookings()) {
        if (["cancelled","archived"].includes(b.status) || !b.date) continue;
        const rows=markers.get(b.date)||[];rows.push({temporary:b.status==="pending"||b.status==="temporary"||b.confirmation==="temporary"});markers.set(b.date,rows);
      }
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const value = c.isoDate(d), dayMarkers = markers.get(value) || [], count = dayMarkers.length;
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "calendar-day"; btn.dataset.date = value;
        btn.setAttribute("aria-label",`عرض حجوزات ${value}`);
        btn.setAttribute("role", "gridcell");
        btn.setAttribute("aria-selected", value === c.getSelectedDate() ? "true" : "false");
        if (d.getMonth() !== month) btn.classList.add("is-outside");
        if (value === todayIso) btn.classList.add("is-today");
        if (value === c.getSelectedDate()) btn.classList.add("is-selected");
        if (c.isSpecialDate(value)) btn.classList.add("is-special");
        if (c.isSeasonDate?.(value)) btn.classList.add("is-season");
        const label = value === todayIso ? '<span class="calendar-day__label">اليوم</span>' : "";
        let dots = "";
        const dot=(m)=>`<i class="calendar-day__dot${m?.temporary?' is-temporary':''}"></i>`;
        if (count === 1) dots = `<span class="calendar-day__dots">${dot(dayMarkers[0])}</span>`;
        else if (count === 2) dots = `<span class="calendar-day__dots">${dot(dayMarkers[0])}${dot(dayMarkers[1])}</span>`;
        else if (count > 2) dots = `<span class="calendar-day__dots"><span class="calendar-day__count${dayMarkers.some(m=>m.temporary)?' has-temporary':''}">${c.en(count)}</span></span>`;
        btn.innerHTML = `<span class="calendar-day__number">${c.en(d.getDate())}</span>${label}${dots}`;
        frag.appendChild(btn);
      }
      grid.appendChild(frag);
      grid.dataset.calendarReady = "true";
    },

    renderFallback() {
      const c = this.cfg, d = c.getViewDate();
      const year = d.getFullYear(), month = d.getMonth();
      c.elements.title.textContent = c.en(`${c.monthNames[month]} · ${String(month + 1).padStart(2, "0")} · ${year}`);
      const days = new Date(year, month + 1, 0).getDate();
      const first = new Date(year, month, 1), offset = (first.getDay() + 1) % 7;
      const grid = c.elements.grid; grid.textContent = "";
      const frag = document.createDocumentFragment();
      for (let i = 0; i < offset; i++) { const x = document.createElement("span"); x.className = "calendar-day is-outside"; frag.appendChild(x); }
      for (let day = 1; day <= days; day++) {
        const date = new Date(year, month, day), value = c.isoDate(date), btn = document.createElement("button");
        btn.type = "button"; btn.className = "calendar-day"; btn.dataset.date = value;
        btn.setAttribute("aria-label",`عرض حجوزات ${value}`);
        if (value === c.getSelectedDate()) btn.classList.add("is-selected");
        btn.innerHTML = `<span class="calendar-day__number">${c.en(day)}</span>`;
        frag.appendChild(btn);
      }
      grid.appendChild(frag);
      grid.dataset.calendarReady = "fallback";
    },

    syncSelection() {
      if (!this.cfg) return;
      const selectedDate = this.cfg.getSelectedDate();
      this.cfg.elements.grid.querySelectorAll(".calendar-day[data-date]").forEach(day => {
        const selected = day.dataset.date === selectedDate;
        day.classList.toggle("is-selected", selected);
        day.setAttribute("aria-selected", selected ? "true" : "false");
      });
    },

    animateMonth(direction=0) {
      const grid=this.cfg?.elements?.grid; if(!grid||typeof grid.animate!=="function")return;
      try{grid.animate([{opacity:.58},{opacity:1}],{duration:170,easing:"cubic-bezier(.2,.8,.2,1)"});}catch{}
    },

    moveMonth(delta) {
      const c = this.cfg, current = c.getViewDate();
      const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
      c.setViewDate(next); c.setSelectedDate("");
      this.animateMonth(delta); this.render(); c.onMonthChanged?.(next);
    },

    selectDate(value) {
      const c = this.cfg, d = c.parseIso(value), current = c.getViewDate();
      const changed = d.getFullYear() !== current.getFullYear() || d.getMonth() !== current.getMonth();
      const isSame=value===c.getSelectedDate();
      c.setSelectedDate(isSame?"":value);
      if (changed) { c.setViewDate(new Date(d.getFullYear(), d.getMonth(), 1)); this.render(); }
      else this.syncSelection();
      c.onDateSelected?.(isSame?"":value, changed);
    },

    goToday() {
      const c = this.cfg, d = new Date();
      c.setViewDate(new Date(d.getFullYear(), d.getMonth(), 1)); c.setSelectedDate("");
      this.animateMonth(0); this.render(); c.onToday?.();
    }
  };
  window.OzanCalendar = core;
  function bootstrapStandalone(){
    if(core.cfg) return;
    const grid=document.getElementById("calendarGrid"),card=document.getElementById("calendarCard"),title=document.getElementById("monthTitle");
    if(!grid||!card||!title) return;
    let viewDate=new Date(new Date().getFullYear(),new Date().getMonth(),1);
    let selectedDate="";
    const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const parse=v=>{const [y,m,d]=String(v).split("-").map(Number);return new Date(y,m-1,d);};
    try{
      core.init({
        elements:{grid,card,title,prevBtn:document.getElementById("prevMonthBtn"),nextBtn:document.getElementById("nextMonthBtn"),todayBtn:document.getElementById("todayBtn"),foldHandle:document.getElementById("calendarFoldHandle")},
        getViewDate:()=>viewDate,setViewDate:v=>{viewDate=v;},getSelectedDate:()=>selectedDate,setSelectedDate:v=>{selectedDate=v;},
        getBookings:()=>[],isSpecialDate:()=>false,isSeasonDate:()=>false,isCollapsed:()=>document.body.classList.contains("calendar-collapsed"),setCollapsed:v=>document.body.classList.toggle("calendar-collapsed",Boolean(v)),monthNames:["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],
        en:v=>String(v).replace(/[٠-٩]/g,d=>"0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)]).replace(/[۰-۹]/g,d=>"0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(d)]),isoDate:iso,parseIso:parse
      });
      document.documentElement.dataset.calendarCore="standalone";
    }catch(error){console.error("[CalendarCore] standalone bootstrap failed",error);}
  }
  document.addEventListener("DOMContentLoaded",bootstrapStandalone);
})();
