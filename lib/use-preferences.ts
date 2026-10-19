'use client';
import {useSyncExternalStore} from 'react';
import {defaultPreferences,readPreferences,type PlayerPreferences} from './preferences';

const storageKey='chip-scope-preferences',changeEvent='vgmpulse-preferences';
let snapshot=defaultPreferences,lastRaw:string|null|undefined;
function readSnapshot(){
 try{
  const raw=localStorage.getItem(storageKey);
  if(raw!==lastRaw){lastRaw=raw;snapshot=readPreferences(raw);}
 }catch{}
 return snapshot;
}
function subscribe(listener:()=>void){
 window.addEventListener('storage',listener);window.addEventListener(changeEvent,listener);
 return()=>{window.removeEventListener('storage',listener);window.removeEventListener(changeEvent,listener);};
}
const serverSnapshot=()=>defaultPreferences;
function updatePreferences(patch:Partial<PlayerPreferences>){
 snapshot={...readSnapshot(),...patch};
 try{const raw=JSON.stringify(snapshot);localStorage.setItem(storageKey,raw);lastRaw=raw;}catch{}
 window.dispatchEvent(new Event(changeEvent));
}
export function usePlayerPreferences(){
 return [useSyncExternalStore(subscribe,readSnapshot,serverSnapshot),updatePreferences] as const;
}
