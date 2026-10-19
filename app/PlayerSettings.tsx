'use client';
import {useRef} from 'react';
import {useLanguage} from '../lib/language-context';
import type {PlayerPreferences,Density} from '../lib/preferences';
import {useDialog} from '../lib/use-dialog';
import {project} from '../lib/project';
import type {LanguagePreference} from '../lib/i18n';
export default function PlayerSettings({settings,update,close,openAbout}:{settings:PlayerPreferences;update:(patch:Partial<PlayerPreferences>)=>void;close:()=>void;openAbout:()=>void}){
 const {t,setLanguage}=useLanguage();
 const panel=useRef<HTMLElement>(null);useDialog(panel,close);
 return <div className="settings-backdrop" onClick={close}><section ref={panel} className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} onClick={e=>e.stopPropagation()}>
  <header className="dialog-heading"><h2 id="settings-title">{t('settings.title')}</h2><button className="dialog-close" onClick={close} aria-label={t('closeSettings')}>×</button></header>
  <fieldset><legend>{t('settings.language')}</legend><label className="settings-row language-row"><span><strong>{t('settings.language')}</strong></span><select aria-label={t('settings.language')} value={settings.language} onChange={e=>setLanguage(e.target.value as LanguagePreference)}><option value="auto">{t('language.auto')}</option><option value="zh-CN">简体中文</option><option value="en">English</option></select></label></fieldset>
  <fieldset><legend>{t('settings.display')}</legend><label className="settings-row"><span><strong>{t('settings.density')}</strong></span><select value={settings.density} onChange={e=>update({density:e.target.value as Density})}><option value="auto">{t('settings.autoDensity')}</option><option value="comfortable">{t('density.comfortable')}</option><option value="compact">{t('density.compact')}</option><option value="dense">{t('density.dense')}</option></select></label>
  <label className="settings-row"><span><strong>{t('settings.focus')}</strong><small>{t('settings.focusHint')}</small></span><input type="checkbox" role="switch" checked={settings.focus} onChange={e=>update({focus:e.target.checked})}/></label>
  <label className="settings-row"><span><strong>{t('settings.fps')}</strong><small>{t('settings.fpsHint')}</small></span><select value={settings.fps} onChange={e=>update({fps:Number(e.target.value) as 30|60})}><option value="60">{t('settings.fpsValue',{count:60})}</option><option value="30">{t('settings.fpsValue',{count:30})}</option></select></label></fieldset>
  <fieldset><legend>{t('settings.wave')}</legend><label className="settings-row"><span><strong>{t('normalizeWave')}</strong><small>{t('settings.waveHint')}</small></span><input type="checkbox" role="switch" checked={settings.normalizeWave} onChange={e=>update({normalizeWave:e.target.checked})}/></label>
  <label className="settings-row"><span><strong>{t('settings.timebase')}</strong></span><select value={settings.timebase} onChange={e=>update({timebase:Number(e.target.value)})}><option value="256">5.8 ms</option><option value="520">11.8 ms</option><option value="1024">23.2 ms</option></select></label></fieldset>
  <fieldset><legend>{t('settings.audio')}</legend><label className="settings-row"><span><strong>{t('settings.normalization')}</strong><small>{t('settings.normalizationHint')}</small></span><input type="checkbox" role="switch" checked={settings.normalization} onChange={e=>update({normalization:e.target.checked})}/></label>
  <label className="settings-row"><span><strong>{t('preamp')}</strong></span><select value={settings.preampDb} onChange={e=>update({preampDb:Number(e.target.value)})}>{[0,6,12,18].map(value=><option key={value} value={value}>{value===0?t('settings.originalVolume'):`+${value} dB`}</option>)}</select></label></fieldset>
  <button className="settings-done" onClick={close}>{t('done')}</button>
  <button className="settings-about" onClick={openAbout}><span>{t('aboutApp')}</span><span>v{project.version}</span></button>
 </section></div>;
}
