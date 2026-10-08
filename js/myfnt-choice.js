/* Myfnt Core Choice v1 — button-only visual choices; no hidden checkbox/label chips. */
'use strict';
(()=>{
  const pressed=el=>el?.getAttribute('aria-pressed')==='true';
  const set=(el,on)=>{
    if(!el)return false;
    const next=Boolean(on);
    el.setAttribute('aria-pressed',String(next));
    el.classList.toggle('is-active',next);
    el.classList.toggle('is-selected',next);
    return next;
  };
  const toggle=el=>set(el,!pressed(el));
  const single=(root,el,selector='[data-choice-value]')=>{
    if(!root||!el)return;
    root.querySelectorAll(selector).forEach(node=>set(node,node===el));
  };
  const values=(root,selector='[data-choice-value]')=>root?[...root.querySelectorAll(selector)].filter(pressed).map(el=>String(el.dataset.choiceValue||'')):[];
  const bind=(root,selector='[data-choice-toggle]')=>{
    if(!root||root.dataset.choiceBound==='1')return;
    root.dataset.choiceBound='1';
    root.addEventListener('click',e=>{
      const btn=e.target.closest(selector);
      if(!btn||!root.contains(btn)||btn.disabled)return;
      e.preventDefault();
      e.stopPropagation();
      toggle(btn);
      btn.dispatchEvent(new CustomEvent('myfnt:choice-change',{bubbles:true,detail:{pressed:pressed(btn),button:btn}}));
    });
  };
  window.MyfntChoice=Object.freeze({pressed,set,toggle,single,values,bind});
})();
