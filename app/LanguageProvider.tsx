'use client';
import {useCallback,useEffect,useMemo,useSyncExternalStore} from 'react';
import {resolveLanguage,translator,type Language,type LanguagePreference} from '../lib/i18n';
import {usePlayerPreferences} from '../lib/use-preferences';
import {LanguageContext} from '../lib/language-context';

function subscribe(listener:()=>void){window.addEventListener('languagechange',listener);return()=>window.removeEventListener('languagechange',listener);}
const browserLanguages=()=>navigator.languages.length?navigator.languages.join(','):navigator.language;
export default function LanguageProvider({initialLanguage,children}:{initialLanguage:Language;children:React.ReactNode}){
 const [preferences,updatePreferences]=usePlayerPreferences();
 const languages=useSyncExternalStore(subscribe,browserLanguages,()=>initialLanguage);
 const language=resolveLanguage(preferences.language,languages.split(','));
 const setLanguage=useCallback((language:LanguagePreference)=>updatePreferences({language}),[updatePreferences]);
 const value=useMemo(()=>({language,t:translator(language),setLanguage}),[language,setLanguage]);
 useEffect(()=>{
  document.documentElement.lang=language;document.documentElement.dataset.locale=language;
  document.cookie=`vgmpulse-language=${preferences.language}; Path=/; Max-Age=31536000; SameSite=Lax`;
  for(const selector of ['meta[name="description"]','meta[property="og:description"]','meta[name="twitter:description"]'])document.querySelector(selector)?.setAttribute('content',value.t('app.description'));
 },[language,preferences.language,value]);
 return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
