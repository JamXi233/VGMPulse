'use client';
import {createContext,useContext} from 'react';
import type {Language,LanguagePreference,Translator} from './i18n';

type LanguageState={language:Language;t:Translator;setLanguage:(language:LanguagePreference)=>void};
export const LanguageContext=createContext<LanguageState|null>(null);
export function useLanguage(){
 const state=useContext(LanguageContext);
 if(!state)throw Error('LanguageProvider is missing.');
 return state;
}
