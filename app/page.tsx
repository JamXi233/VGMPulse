'use client';
import {memo,useCallback,useEffect,useRef,useState} from 'react';
import {VGMEngine,readVGM,type Track,type ScopeFrame} from '../lib/player';
import PlayerSettings from './PlayerSettings';
import TrackInfo from './TrackInfo';
import About from './About';
import LanguageSwitcher from './LanguageSwitcher';
import {project} from '../lib/project';
import {useLanguage} from '../lib/language-context';
import {translateError} from '../lib/i18n';
import type {Density} from '../lib/preferences';
import {usePlayerPreferences} from '../lib/use-preferences';
import {animate} from '../lib/animation';
import {samplePeak,smoothLevel,levelDb} from '../lib/meter';
import {assetUrl} from '../lib/assets.js';
type Entry={id:string;file:File;demo?:boolean};
const fmt=(s:number)=>`${Math.floor(Math.max(0,s)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,s)%60).toString().padStart(2,'0')}`;
function Icon({name,size=20}:{name:string;size?:number}){
 const paths:Record<string,React.ReactNode>={play:<path d="m8 5 11 7-11 7Z"/>,pause:<path d="M8 5v14M16 5v14"/>,upload:<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>,folder:<path d="M3 6h7l2 3h9v11H3z"/>,wave:<path d="M2 12h4l2-8 4 16 4-16 2 8h4"/>,chip:<><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/></>,reset:<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>,loop:<path d="m17 2 4 4-4 4M3 11V6h18M7 22l-4-4 4-4m14-1v5H3"/>,volume:<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>,chevron:<path d="m9 5 7 7-7 7"/>,info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v2"/></>,close:<path d="m6 6 12 12M6 18 18 6"/>,grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,settings:<><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,list:<path d="M3 5h18M3 12h18M3 19h18"/>};
 return <svg width={size} height={size} viewBox="0 0 24 24" fill={name==='play'?'currentColor':'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.wave}</svg>;
}
const Scope=memo(function Scope({frames,id,color,scale,muted=false,playing,normalize,timebase,fps}:{frames:React.RefObject<ScopeFrame|null>;id:number;color:string;scale:number;muted?:boolean;playing:boolean;normalize:boolean;timebase:number;fps:30|60}){
 const {t}=useLanguage();
 const ref=useRef<HTMLCanvasElement>(null),cursor=useRef(0),referencePeak=useRef(0);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  let width=0,height=0,dpr=1,dirty=true,visible=true,lastFrame:ScopeFrame|null=null,lastTime=performance.now();
  const resize=()=>{const box=canvas.getBoundingClientRect();width=box.width;height=box.height;dpr=Math.min(2,window.devicePixelRatio||1);const w=Math.round(width*dpr),h=Math.round(height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}dirty=true;};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)dirty=true;});intersection.observe(canvas);
  const c=canvas.getContext('2d');if(!c)return;
  const draw=(now:number)=>{
   const elapsed=Math.min(100,now-lastTime);lastTime=now;const frame=frames.current;
   if(visible&&width>0&&(playing||dirty||frame!==lastFrame)){
    const data=frame?.waves[id];if(playing&&frame?.timestamp)cursor.current=Math.max(0,Math.min((data?.length||2048)-timebase-100,(now-frame.timestamp)*44.1));else if(frame!==lastFrame)cursor.current=0;
    const w=width,h=height;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);c.shadowBlur=0;
    c.strokeStyle='#ffffff07';c.lineWidth=1;c.beginPath();for(let x=0;x<w;x+=w/12){c.moveTo(x,0);c.lineTo(x,h);}for(let y=h/4;y<h;y+=h/4){c.moveTo(0,y);c.lineTo(w,y);}c.stroke();
    c.strokeStyle='#ffffff15';c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.stroke();
    let peak=0,start=Math.floor(cursor.current);if(data&&!muted){for(let i=start;i<Math.min(start+timebase+100,data.length);i++)peak=Math.max(peak,Math.abs(data[i]));for(let i=start+1;i<Math.min(start+100,data.length-timebase);i++){if(data[i-1]<0&&data[i]>=0){start=i;break;}}}
    if(frame!==lastFrame&&(!lastFrame||!frame))referencePeak.current=peak;else referencePeak.current=Math.max(peak,referencePeak.current*Math.exp(-elapsed/180));
    const divisor=normalize?Math.max(.00001,referencePeak.current):1;
    c.strokeStyle=muted?'#515950':color;c.lineWidth=1.35;c.beginPath();const samples=Math.min(timebase,(data?.length||timebase)-start);
    for(let x=0;x<w;x++){const i=start+Math.floor(x/w*samples),v=muted?0:(data?.[i]||0),y=h/2-Math.max(-.46,Math.min(.46,v/divisor*.36*scale))*h;if(x===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();dirty=false;lastFrame=frame;
   }
  };const stop=animate(draw,fps);return()=>{stop();observer.disconnect();intersection.disconnect();};
 },[frames,id,color,scale,muted,playing,normalize,timebase,fps]);
 return <canvas ref={ref} className="scope-canvas" aria-label={t('waveform')}/>;
});
const ChannelMeter=memo(function ChannelMeter({frames,id,muted,playing,fps}:{frames:React.RefObject<ScopeFrame|null>;id:number;muted:boolean;playing:boolean;fps:30|60}){
 const {t}=useLanguage(),mutedText=t('muted');
 const fillRef=useRef<HTMLSpanElement>(null),labelRef=useRef<HTMLSpanElement>(null),envelope=useRef(0),cursor=useRef(0);
 useEffect(()=>{
  const fill=fillRef.current,label=labelRef.current;if(!fill||!label)return;
  let lastTime=performance.now(),lastText=0,lastFrame:ScopeFrame|null=null,visible=true,dirty=true;
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)dirty=true;});intersection.observe(fill.parentElement!);
  const draw=(now:number)=>{
   const elapsed=Math.min(100,now-lastTime);lastTime=now;const frame=frames.current;
   if(visible&&(playing||dirty||frame!==lastFrame)){
    const wave=frame?.waves[id];
    if(playing&&frame?.timestamp)cursor.current=Math.max(0,Math.min((wave?.length||2048)-256,(now-frame.timestamp)*44.1));else if(frame!==lastFrame)cursor.current=0;
    if(muted||!frame)envelope.current=0;
    else if(playing)envelope.current=smoothLevel(envelope.current,samplePeak(wave,cursor.current),elapsed);
    else if(frame!==lastFrame)envelope.current=samplePeak(wave,cursor.current);
    const db=levelDb(envelope.current),amount=envelope.current<.001?0:Math.max(0,Math.min(1,(db+60)/60));
    fill.style.transform=`scaleX(${amount})`;
    if(now-lastText>=100||dirty||!playing){const text=muted?mutedText:envelope.current<.001?'−∞ dB':`${db.toFixed(1)} dB`;if(label.textContent!==text)label.textContent=text;lastText=now;}
    lastFrame=frame;dirty=false;
   }
  };const stop=animate(draw,fps);return()=>{stop();intersection.disconnect();};
 },[frames,id,muted,playing,fps,mutedText]);
 return <><div className="channel-meter" role="img" aria-label={t('levelMeter')}><span className="channel-meter-base"/><span ref={fillRef} className="channel-meter-fill" style={{transform:'scaleX(0)'}}/></div><span ref={labelRef} className="db-label">{muted?mutedText:'−∞ dB'}</span></>;
});
export default function Home(){
 const {language,t}=useLanguage();
 const scopeFrame=useRef<ScopeFrame|null>(null),lastUI=useRef(0);
 const engine=useRef<VGMEngine|null>(null),input=useRef<HTMLInputElement>(null),generation=useRef(0),volumeRoot=useRef<HTMLDivElement>(null);
 const [preferences,updatePreferences]=usePlayerPreferences();
 const [settingsOpen,setSettingsOpen]=useState(false),[about,setAbout]=useState(false),[libraryOpen,setLibraryOpen]=useState(false),[chipFilter,setChipFilter]=useState('all'),[collapsedChips,setCollapsedChips]=useState<Set<string>>(new Set());
 const [entries,setEntries]=useState<Entry[]>([]),[active,setActive]=useState(''),[track,setTrack]=useState<Track|null>(null);
 const [playing,setPlaying]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[position,setPosition]=useState(0),[volume,setVolume]=useState(.7),[loop,setLoop]=useState(false);
 const [muted,setMuted]=useState<Set<number>>(new Set()),[solo,setSolo]=useState<Set<number>>(new Set()),[scale,setScale]=useState(1),[dragging,setDragging]=useState(false),[info,setInfo]=useState(false),[query,setQuery]=useState(''),[volumeOpen,setVolumeOpen]=useState(false);
 const closeInfo=useCallback(()=>setInfo(false),[]),closeSettings=useCallback(()=>setSettingsOpen(false),[]);
 const closeAbout=useCallback(()=>setAbout(false),[]),openAbout=useCallback(()=>{setInfo(false);setSettingsOpen(false);setAbout(true);},[]);
 const cancelPending=useCallback(()=>{generation.current++;},[]);
 const compact=preferences.view==='list';
 const loopRef=useRef(loop),trackRef=useRef<Track|null>(null);
 useEffect(()=>{loopRef.current=loop;trackRef.current=track;},[loop,track]);
 const load=useCallback(async(entry:Entry)=>{
  const gen=++generation.current;setLoading(true);setPlaying(false);setError('');scopeFrame.current=null;setPosition(0);setMuted(new Set());setSolo(new Set());setActive(entry.id);setTrack(null);setLibraryOpen(false);setChipFilter('all');setCollapsedChips(new Set());
  try {await engine.current?.pause();const bytes=await readVGM(entry.file);if(gen!==generation.current)return false;const result=await engine.current!.load(bytes);if(gen!==generation.current)return false;setTrack(result);setLoading(false);return true;}
  catch(e){if(gen===generation.current){setError((e as Error).message);setLoading(false);}return false;}
 },[]);
 useEffect(()=>{
  const e=new VGMEngine();engine.current=e;e.onFrame=f=>{scopeFrame.current=f;const now=performance.now();if(now-lastUI.current>250||!e.playing){setPosition(f.position);lastUI.current=now;}};
  e.onEnd=()=>{if(!trackRef.current)return;if(loopRef.current){e.seek(0);setPosition(0);void e.play().then(started=>{if(started)setPlaying(true);});}else{setPlaying(false);setPosition(trackRef.current?.duration||0);}};
  e.onError=s=>{setError(s);setPlaying(false);setLoading(false);void e.pause();};let cancelled=false;const initialGeneration=generation.current;
  fetch(assetUrl('demo.vgm?v=20261020-vgmpulse-demo')).then(r=>{if(!r.ok)throw Error('DEMO_LOAD_FAILED');return r.blob();}).then(blob=>{if(cancelled||generation.current!==initialGeneration)return;const entry={id:'demo',file:new File([blob],`${project.name}.vgm`),demo:true};setEntries([entry]);void load(entry);}).catch(e=>{if(!cancelled&&generation.current===initialGeneration){setError(e.message);setLoading(false);}});
  return()=>{cancelled=true;cancelPending();e.destroy();};
 },[load,cancelPending]);
 useEffect(()=>{engine.current?.setDynamics(preferences.normalization,preferences.preampDb);},[preferences.normalization,preferences.preampDb]);
 useEffect(()=>{
  if(!volumeOpen)return;
  const outside=(event:PointerEvent)=>{if(!volumeRoot.current?.contains(event.target as Node))setVolumeOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setVolumeOpen(false);};
  window.addEventListener('pointerdown',outside);window.addEventListener('keydown',escape);
  return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('keydown',escape);};
 },[volumeOpen]);
 useEffect(()=>{let mask=0n;track?.voices.forEach(v=>{if(muted.has(v.id)||(solo.size>0&&!solo.has(v.id)))mask|=1n<<BigInt(v.id);});engine.current?.setMask(mask);},[muted,solo,track]);
 const toggle=useCallback(async()=>{if(!track||loading)return;const gen=generation.current;try{if(playing){await engine.current?.pause();setPlaying(false);}else{if(position>=track.duration){engine.current?.seek(0);setPosition(0);}const started=await engine.current?.play();if(started&&gen===generation.current)setPlaying(true);}}catch{setError('AUDIO_START_FAILED');}},[track,loading,playing,position]);
 const seek=useCallback((s:number)=>{setPosition(s);scopeFrame.current=null;engine.current?.seek(s);},[]);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{const el=e.target as HTMLElement;if(['INPUT','BUTTON','TEXTAREA'].includes(el.tagName)||el.tagName==='SELECT'||info||settingsOpen||about)return;if(e.code==='Space'){e.preventDefault();void toggle();}if(e.code==='ArrowRight'){e.preventDefault();seek(Math.max(0,Math.min((track?.duration||0)-.1,position+5)));}if(e.code==='ArrowLeft'){e.preventDefault();seek(Math.max(0,position-5));}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[toggle,position,track,seek,info,settingsOpen,about]);
 const importFiles=async(files:FileList|File[])=>{const valid=Array.from(files).filter(f=>/\.(vgm|vgz|vgm\.gz)$/i.test(f.name));if(!valid.length){setError('FILE_TYPE_REQUIRED');return;}const additions=valid.map(file=>({id:crypto.randomUUID(),file}));setQuery('');setEntries(old=>[...old,...additions]);await load(additions[0]);};
 const clearPlaylist=useCallback(()=>{
  generation.current++;trackRef.current=null;scopeFrame.current=null;lastUI.current=0;
  void engine.current?.clear();
  setEntries([]);setQuery('');setActive('');setTrack(null);setChipFilter('all');setCollapsedChips(new Set());setPlaying(false);setLoading(false);setPosition(0);setError('');
  setMuted(new Set());setSolo(new Set());setLoop(false);if(input.current)input.current.value='';
 },[]);
 const chooseTrack=async(entry:Entry,resume=false)=>{
  const pending=load(entry),gen=generation.current;
  if(!(await pending)||!resume||gen!==generation.current)return;
  try{const started=await engine.current?.play();if(started&&gen===generation.current)setPlaying(true);}
  catch{if(gen===generation.current)setError('AUDIO_START_FAILED');}
 };
 const removeEntry=(id:string)=>{
  const remaining=entries.filter(entry=>entry.id!==id);
  if(!remaining.length){clearPlaylist();return;}
  setEntries(remaining);
  if(id===active){const next=remaining[Math.min(entries.findIndex(entry=>entry.id===id),remaining.length-1)];void chooseTrack(next,playing);}
 };
 const setMasterVolume=(value:number)=>{setVolume(value);engine.current?.setVolume(value);};
 const changeSet=(setter:React.Dispatch<React.SetStateAction<Set<number>>>,id:number)=>setter(old=>{const n=new Set(old);if(n.has(id))n.delete(id);else n.add(id);return n;});
 const voices=track?.voices||[],groups=Array.from(new Set(voices.map(v=>v.chip))),activeEntry=entries.find(x=>x.id===active),activeIndex=entries.findIndex(x=>x.id===active);
 const visibleEntries=entries.map((entry,index)=>({entry,index})).filter(({entry})=>`${entry.file.name} ${entry.demo?t('demo.title'):''}`.toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language)));
 const displayTitle=activeEntry?.demo?t('demo.title'):track?.title||activeEntry?.file.name.replace(/\.(vgm|vgz|vgm\.gz)$/i,'')||t('noTrack');
 const shortChip=(s:string)=>s.replace('Yamaha ','').replace(/ \(.+\)/,'');
 return <div className={`app density-${preferences.density} ${preferences.focus?'focus-mode':''} ${libraryOpen?'library-open':''} ${dragging?'dragging':''}`} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();setDragging(true);}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDragging(false);}} onDrop={e=>{e.preventDefault();setDragging(false);if(e.dataTransfer.files.length)void importFiles(e.dataTransfer.files);}}>
  <input ref={input} className="file-input" type="file" accept=".vgm,.vgz,.gz" multiple onChange={e=>{if(e.target.files)void importFiles(e.target.files);e.target.value='';}}/>
  <aside className="sidebar" aria-label={t('library')}>
   <div className="brand"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/><i/></span><span>VGM<span className="brand-light">Pulse</span></span></div>
   <button className="import-button mobile-import" aria-label={t('addFiles')} onClick={()=>input.current?.click()}><Icon name="upload" size={16}/><span>{t('add')}</span></button>
   <button className="library-toggle" title={t('playlist')} aria-label={t('playlist')} aria-controls="music-library" onClick={()=>setLibraryOpen(!libraryOpen)} aria-expanded={libraryOpen}><Icon name="list" size={16}/><span className="library-count">{entries.length}</span></button>
   <div className="library-content" id="music-library">
    <div className="library-heading"><h2>{t('playlist')} <span className="library-count">{entries.length.toString().padStart(2,'0')}</span></h2><button className="clear-playlist" title={t('clearPlaylist')} disabled={!entries.length} onClick={clearPlaylist}>{t('clear')}</button></div>
    {(entries.length>6||query)&&<input className="library-search" type="search" aria-label={t('filterPlaylist')} placeholder={t('searchPlaceholder')} value={query} onChange={e=>setQuery(e.target.value)}/>}
    <div className="playlist" role="list" aria-label={t('playlist')}>
     {!visibleEntries.length&&<p className="playlist-empty">{t(entries.length?'noMatches':'emptyPlaylist')}</p>}
     {visibleEntries.map(({entry,index})=><div role="listitem" key={entry.id} className={`track-entry ${active===entry.id?'selected':''}`}>
      <button className="track-entry-play" onClick={()=>void chooseTrack(entry,playing)} aria-current={active===entry.id?'true':undefined} title={entry.file.name}>
       <span className="track-number" aria-hidden="true">{active===entry.id&&playing?<span className="mini-bars"><i/><i/><i/></span>:(index+1).toString().padStart(2,'0')}</span>
       <span className="track-entry-text"><strong>{entry.demo?t('demo.title'):entry.file.name.replace(/\.(vgm|vgz|vgm\.gz)$/i,'')}</strong><small><span>{/\.(vgz|gz)$/i.test(entry.file.name)?'VGZ':'VGM'}</span><span>{entry.file.size>=1048576?`${(entry.file.size/1048576).toFixed(1)} MB`:`${Math.ceil(entry.file.size/1024)} KB`}</span></small></span>
      </button>
      <button className="track-remove icon-button" aria-label={t('removeTrack',{name:entry.file.name})} title={t('remove')} onClick={()=>removeEntry(entry.id)}><Icon name="close" size={13}/></button>
     </div>)}
    </div>
   </div>
   <button className="drop-card" aria-label={t('addOrDrop')} onClick={()=>input.current?.click()}><Icon name="folder" size={24}/><span>{t('add')}</span></button>
   <div className="sidebar-bottom"><span className="local-dot"/>{t('localPlayback')}<button className="about-button" aria-label={t('aboutApp')} title={t('aboutApp')} onClick={openAbout}><Icon name="info" size={15}/>{t('about')}</button></div>
  </aside>
  <main>
   <header className="topbar">
    <div className="workspace-label"><Icon name="wave" size={18}/><span>{t('scope')}</span></div>
    <div className="topbar-actions"><span className="engine-status" role="status"><span className={playing?'status-dot live':'status-dot'}/>{t(loading?'loading':playing?'playing':track?'paused':'ready')}</span><button className="icon-button quick-import" aria-label={t('addFiles')} title={t('add')} onClick={()=>input.current?.click()}><Icon name="upload" size={17}/></button><button className={`focus-toggle ${preferences.focus?'active':''}`} aria-pressed={preferences.focus} onClick={()=>updatePreferences({focus:!preferences.focus})}>{t(preferences.focus?'exitFocus':'focus')}</button><LanguageSwitcher/><button className="settings-toggle" aria-label={t('settings')} title={t('settings')} onClick={()=>setSettingsOpen(true)}><Icon name="settings" size={16}/><span>{t('settings')}</span></button></div>
   </header>
   <section className="workspace" aria-label={t('oscilloscopes')}>
    <div className="now-playing">
     <div className="track-info"><h1 title={displayTitle}>{loading?t('loading'):displayTitle}</h1>{(track?.game||track?.artist)&&<p>{[track?.game,track?.artist].filter(Boolean).join(' · ')}</p>}
      {track&&<div className="track-metadata"><span className="format-tag">{/\.(vgz|gz)$/i.test(activeEntry?.file.name||'')?'VGZ':'VGM'}</span><span className="system-tag" title={track.system}>{track.system||t('unknownSystem')}</span><span>{t(groups.length===1?'chip':'chips',{count:groups.length})}</span><span>{t(voices.length===1?'channelCount':'channelsCount',{count:voices.length})}</span><span className="sample-rate">44.1 kHz / Stereo</span></div>}
     </div>
     <button className="track-details icon-button" title={t('trackInfo')} aria-label={t('trackInfo')} onClick={()=>setInfo(true)}><Icon name="info" size={18}/></button>
    </div>
    {error&&<div role="alert" className="error-banner"><Icon name="info" size={17}/><span>{translateError(error,t)}</span><button className="text-button" onClick={()=>input.current?.click()}>{t('reimport')}</button><button className="icon-button" aria-label={t('dismiss')} onClick={()=>setError('')}><Icon name="close" size={16}/></button></div>}
    <div className="scope-controls">
     <div className="scope-toolbar"><h2>{t('oscilloscopes')}</h2><div className="scope-options">
      <select className="density-select" aria-label={t('density')} value={preferences.density} onChange={e=>updatePreferences({density:e.target.value as Density})}><option value="auto">{t('density.auto')}</option><option value="comfortable">{t('density.comfortable')}</option><option value="compact">{t('density.compact')}</option><option value="dense">{t('density.dense')}</option></select>
      <button className="gain-button" aria-label={t('waveGainAction',{gain:scale})} title={t('waveGain')} onClick={()=>setScale(s=>s===16?1:s*2)}>×{scale}</button>
      <div className="view-switch" role="group" aria-label={t('channelView')}><button className={`icon-button ${!compact?'active':''}`} title={t('grid')} aria-label={t('grid')} aria-pressed={!compact} onClick={()=>updatePreferences({view:'grid'})}><Icon name="grid" size={15}/></button><button className={`icon-button ${compact?'active':''}`} title={t('list')} aria-label={t('list')} aria-pressed={compact} onClick={()=>updatePreferences({view:'list'})}><Icon name="list" size={16}/></button></div>
      <button className="icon-button reset-channels" title={t('resetChannels')} aria-label={t('resetChannels')} disabled={!muted.size&&!solo.size} onClick={()=>{setMuted(new Set());setSolo(new Set());}}><Icon name="reset" size={16}/></button>
     </div></div>
     <div className="sound-tools">
      <div className="chip-filters" role="group" aria-label={t('filterChips')}><button className={chipFilter==='all'?'active':''} aria-pressed={chipFilter==='all'} onClick={()=>setChipFilter('all')}>{t('all')} <span>{voices.length}</span></button>{groups.map(chip=><button key={chip} className={chipFilter===chip?'active':''} title={chip} aria-pressed={chipFilter===chip} onClick={()=>setChipFilter(chip)}>{shortChip(chip)} <span>{voices.filter(v=>v.chip===chip).length}</span></button>)}</div>
      <div className="sound-actions"><button className={`tool-toggle ${preferences.normalizeWave?'active':''}`} aria-label={t('normalizeWave')} title={t('normalizeWaveHint')} aria-pressed={preferences.normalizeWave} onClick={()=>updatePreferences({normalizeWave:!preferences.normalizeWave})}><span className="toggle-indicator"/><span className="wave-label-full">{t('normalizeWave')}</span><span className="wave-label-short">{t('normalizeWaveShort')}</span></button><button className={`tool-toggle ${preferences.normalization?'active':''}`} aria-label={t('autoVolume')} title={t('autoVolumeHint')} aria-pressed={preferences.normalization} onClick={()=>updatePreferences({normalization:!preferences.normalization})}><span className="toggle-indicator"/>{t('autoVolume')}</button><select className="boost-select" aria-label={t('preamp')} value={preferences.preampDb} onChange={e=>updatePreferences({preampDb:Number(e.target.value)})}>{[0,6,12,18].map(db=><option value={db} key={db}>{db===0?'0 dB':`+${db} dB`}</option>)}</select></div>
     </div>
    </div>
    {loading?<div className="loading-state" role="status"><span className="loader"/><span>{t('loading')}</span></div>:!track?<div className="empty-state"><Icon name="wave" size={32}/><button className="import-button" onClick={()=>input.current?.click()}><Icon name="upload" size={16}/>{t('add')}</button></div>:groups.filter(chip=>chipFilter==='all'||chip===chipFilter).map(chip=>{
     const gi=groups.indexOf(chip),color=['#bdef8c','#e9bd7e','#8fcfe8','#bda7ef'][gi%4],chipVoices=voices.filter(v=>v.chip===chip),folded=collapsedChips.has(chip);
     return <section key={chip} className="chip-section" style={{'--chip-color':color} as React.CSSProperties} aria-label={chip}>
      <div className="chip-heading"><h3><button className={`chip-fold ${folded?'folded':''}`} aria-label={t(folded?'expandChip':'collapseChip',{chip:shortChip(chip)})} aria-expanded={!folded} aria-controls={`chip-group-${gi}`} onClick={()=>setCollapsedChips(old=>{const next=new Set(old);if(next.has(chip))next.delete(chip);else next.add(chip);return next;})}><Icon name="chevron" size={12}/><Icon name="chip" size={16}/><span title={chip}>{shortChip(chip)}</span></button></h3><span className="chip-count">{chipVoices.length.toString().padStart(2,'0')} <span>{t(chipVoices.length===1?'channel':'channels')}</span></span></div>
      <div id={`chip-group-${gi}`} hidden={folded} className={`channel-grid ${compact?'compact':''}`}>{!folded&&chipVoices.map(v=>{
       const inactive=muted.has(v.id)||(solo.size>0&&!solo.has(v.id));
       return <article key={v.id} className={`channel-card ${inactive?'muted':''} ${solo.has(v.id)?'soloed':''}`} aria-label={`${shortChip(chip)} ${v.name}`}>
        <div className="channel-top"><span className="channel-index">{(v.id+1).toString().padStart(2,'0')}</span><strong title={v.name}>{v.name}</strong><div className="channel-buttons"><button className={muted.has(v.id)?'enabled mute-enabled':''} aria-label={t('muteChannel',{chip:shortChip(chip),name:v.name})} aria-pressed={muted.has(v.id)} title={t('mute')} onClick={()=>changeSet(setMuted,v.id)}>M</button><button className={solo.has(v.id)?'enabled':''} aria-label={t('soloChannel',{chip:shortChip(chip),name:v.name})} aria-pressed={solo.has(v.id)} title={t('solo')} onClick={()=>changeSet(setSolo,v.id)}>S</button></div></div>
        <Scope frames={scopeFrame} id={v.id} color={color} scale={scale} muted={inactive} playing={playing} normalize={preferences.normalizeWave} timebase={preferences.timebase} fps={preferences.fps}/>
        <div className="channel-bottom"><span title={chip}>{shortChip(chip)}</span><ChannelMeter frames={scopeFrame} id={v.id} muted={inactive} playing={playing} fps={preferences.fps}/></div>
       </article>;
      })}</div>
     </section>;
    })}
   </section>
   <footer className="transport" aria-label={t('playbackControls')}>
    <div className="seek-row"><span>{fmt(position)}</span><input type="range" aria-label={t('position')} aria-valuetext={`${fmt(position)} / ${fmt(track?.duration||0)}`} min="0" max={Math.max(1,track?.duration||1)} step="0.1" value={Math.max(0,Math.min(position,track?.duration||1))} disabled={!track||loading} style={{'--progress':`${Math.max(0,Math.min(100,position/Math.max(1,track?.duration||1)*100))}%`} as React.CSSProperties} onChange={e=>seek(Number(e.target.value))}/><span>{fmt(track?.duration||0)}</span></div>
    <div className="transport-row">
     <button className="transport-track" title={t('trackInfo')} aria-label={t('currentTrackInfo')} onClick={()=>setInfo(true)}><span className="transport-indicator" aria-hidden="true"><Icon name="wave" size={18}/></span><span><strong>{track?displayTitle:'VGMPulse'}</strong><small>{track?track.system||t('unknownSystem'):t('noFile')}</small></span></button>
     <div className="playback-controls">
      <button className="icon-button restart-button" disabled={!track||loading} title={t('restart')} aria-label={t('restart')} onClick={()=>seek(0)}><Icon name="reset" size={17}/></button>
      <button className="icon-button previous-button" disabled={loading||activeIndex<=0} title={t('previous')} aria-label={t('previous')} onClick={()=>void chooseTrack(entries[activeIndex-1],playing)}><Icon name="chevron" size={20}/></button>
      <button className="play-button" onClick={()=>void toggle()} disabled={!track||loading} title={`${t(playing?'pause':'play')} · Space`} aria-label={t(playing?'pause':'play')}><Icon name={playing?'pause':'play'} size={23}/></button>
      <button className="icon-button next-button" disabled={loading||activeIndex<0||activeIndex>=entries.length-1} title={t('next')} aria-label={t('next')} onClick={()=>void chooseTrack(entries[activeIndex+1],playing)}><Icon name="chevron" size={20}/></button>
      <button className={`icon-button loop-button ${loop?'active':''}`} disabled={!track||loading} title={t('loop')} aria-label={t('loop')} aria-pressed={loop} onClick={()=>setLoop(!loop)}><Icon name="loop" size={17}/></button>
     </div>
     <div className={`volume-controls ${volumeOpen?'volume-open':''}`} ref={volumeRoot}>
      <button className="icon-button desktop-mute" aria-label={t(volume===0?'unmute':'masterMute')} title={t(volume===0?'unmute':'mute')} onClick={()=>setMasterVolume(volume===0?.7:0)}><Icon name="volume" size={18}/></button>
      <button className="icon-button mobile-volume" aria-label={t('adjustVolume')} title={t('volume')} aria-expanded={volumeOpen} aria-controls="volume-panel" onClick={()=>setVolumeOpen(!volumeOpen)}><Icon name="volume" size={18}/></button>
      <div className="volume-panel" id="volume-panel"><button className="icon-button panel-mute" aria-label={t(volume===0?'unmute':'masterMute')} onClick={()=>setMasterVolume(volume===0?.7:0)}><Icon name="volume" size={16}/></button><input type="range" aria-label={t('masterVolume')} aria-valuetext={`${Math.round(volume*100)}%`} min="0" max="1" step="0.01" value={volume} style={{'--progress':`${volume*100}%`} as React.CSSProperties} onChange={e=>setMasterVolume(Number(e.target.value))}/><span className="volume-value">{Math.round(volume*100)}%</span></div>
     </div>
    </div>
   </footer>
  </main>
  {dragging&&<div className="drop-overlay"><Icon name="upload" size={36}/><h2>{t('drop')}</h2><span>.vgm / .vgz</span></div>}
  {settingsOpen&&<PlayerSettings settings={preferences} update={updatePreferences} close={closeSettings} openAbout={openAbout}/>}
  {about&&<About close={closeAbout}/>}
  {info&&<TrackInfo track={track} filename={activeEntry?.file.name} chips={groups} demo={activeEntry?.demo} close={closeInfo}/>}
 </div>;
}
