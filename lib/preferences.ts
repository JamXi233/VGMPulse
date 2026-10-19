import type {LanguagePreference} from './i18n';
export type Density='auto'|'comfortable'|'compact'|'dense';
export type PlayerPreferences={language:LanguagePreference;density:Density;view:'grid'|'list';normalizeWave:boolean;normalization:boolean;preampDb:number;timebase:number;focus:boolean;fps:30|60};
export const defaultPreferences:PlayerPreferences={language:'auto',density:'auto',view:'grid',normalizeWave:true,normalization:false,preampDb:0,timebase:520,focus:false,fps:60};
export function readPreferences(raw:string|null):PlayerPreferences {
  try {
    const value=raw?JSON.parse(raw):{};
    return {
      language:['auto','zh-CN','en'].includes(value?.language)?value.language:'auto',
      density:['auto','comfortable','compact','dense'].includes(value?.density)?value.density:'auto',
      view:value?.view==='list'?'list':'grid',
      normalizeWave:typeof value?.normalizeWave==='boolean'?value.normalizeWave:true,
      normalization:typeof value?.normalization==='boolean'?value.normalization:false,
      preampDb:[0,6,12,18].includes(value?.preampDb)?value.preampDb:0,
      timebase:[256,520,1024].includes(value?.timebase)?value.timebase:520,
      focus:typeof value?.focus==='boolean'?value.focus:false,
      fps:value?.fps===30?30:60,
    };
  }catch{return {...defaultPreferences};}
}
