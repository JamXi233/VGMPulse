'use client';
import {useEffect,type RefObject} from 'react';

export function useDialog(ref:RefObject<HTMLElement|null>,close:()=>void){
 useEffect(()=>{
  const panel=ref.current;if(!panel)return;
  const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const controls=()=>Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length>0);
  controls()[0]?.focus();
  const handleKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
   if(event.key!=='Tab')return;
   const items=controls(),first=items[0],last=items.at(-1);
   if(!first){event.preventDefault();panel.focus();return;}
   if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',handleKey,true);
  return()=>{document.removeEventListener('keydown',handleKey,true);document.body.style.overflow=previousOverflow;previousFocus?.focus();};
 },[ref,close]);
}
