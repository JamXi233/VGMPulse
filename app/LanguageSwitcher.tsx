'use client';
import {useLanguage} from '../lib/language-context';

export default function LanguageSwitcher(){
 const {language,t,setLanguage}=useLanguage();
 return <div className="language-switch" role="group" aria-label={t('settings.language')}>
  <button type="button" lang="zh-CN" aria-label="简体中文" title="简体中文" aria-pressed={language==='zh-CN'} onClick={()=>setLanguage('zh-CN')}>中</button>
  <button type="button" lang="en" aria-label="English" title="English" aria-pressed={language==='en'} onClick={()=>setLanguage('en')}>EN</button>
 </div>;
}
