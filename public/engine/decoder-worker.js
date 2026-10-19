import createCore from './chip-core.js';
import {activeYM2610Voices} from './active-voices.js';
import {continuousPCM} from './continuous-pcm.js';
let core, contexts = [], out, count = 0, epoch = 0, seq = 0;
let mixMask=0n;
let samplePosition=0,isolatedMix=false;
let fastPCM=null,sourceSamples=0,durationSamples=0;
const frames = 2048, rate = 44100;
function fail(message) { postMessage({type:'error', message}); }
function render() {
  if(!contexts.length)return;
  const audio=new Float32Array(frames*2),waves=[],levels=[];
  if(fastPCM&&samplePosition>=sourceSamples){
    if(samplePosition>=durationSamples){postMessage({type:'end',epoch});return;}
    samplePosition+=frames;
    for(let ch=0;ch<count;ch++){waves.push(new Float32Array(frames));levels.push(0);}
    postMessage({type:'block',epoch,id:seq++,audio,waves,levels,position:samplePosition/rate},[audio.buffer,...waves.map(w=>w.buffer)]);return;
  }
  const written=core._lvgm_render(contexts[0],out,frames);
  if(!written){postMessage({type:'end',epoch});return;}
  samplePosition+=written/8;
  const main=new Int32Array(core.HEAPU8.buffer,out,frames*2);
  for(let i=0;i<audio.length;i++)audio[i]=main[i]/134217728;
  const selected=isolatedMix&&mixMask!==0n?new Float32Array(frames*2):null;
  for(let ch=0;ch<count;ch++){
    const wave=new Float32Array(frames);let peak=0;
    if(contexts[ch+1]){
      core._lvgm_render(contexts[ch+1],out,frames);
      const samples=new Int32Array(core.HEAPU8.buffer,out,frames*2);
      for(let i=0;i<frames;i++){
        const l=samples[i*2]/134217728,r=samples[i*2+1]/134217728,v=Math.abs(l)>=Math.abs(r)?l:r;
        wave[i]=v;peak=Math.max(peak,Math.abs(v));
        if(selected&&!(mixMask&(1n<<BigInt(ch)))){selected[i*2]+=l;selected[i*2+1]+=r;}
      }
    }
    waves.push(wave);levels.push(peak);
  }
  const output=selected||audio;
  postMessage({type:'block',epoch,id:seq++,audio:output,waves,levels,position:samplePosition/rate},[output.buffer,...waves.map(w=>w.buffer)]);
}
function prepareDirectSeek(){
  if(!fastPCM)return;
  // Run one sample only to allocate the immutable ROMs and discover the native
  // channel/resampler records. No song is decoded or played ahead on a seek.
  for(const ctx of contexts)if(ctx)core._lvgm_render(ctx,out,1);
  if(fastPCM.locate(core))fastPCM.index();else fastPCM=null;
  for(const ctx of contexts)if(ctx)core._lvgm_seek_ms(ctx,0);
  if(fastPCM&&!fastPCM.seek(core,0))throw Error('PCM_INIT_FAILED');
  samplePosition=0;
}
function seek(position,newEpoch) {
  if(!contexts.length||!Number.isFinite(position))return;
  epoch=newEpoch;
  const target=Math.max(0,Math.round(position*rate));
  // Every supported chip uses the core's command seek. Never render the skipped
  // audio or gate seeking on a chip whitelist. Indexed continuous ADPCM adds
  // exact cursor/codec restoration after the common native seek.
  for(const ctx of contexts)if(ctx)core._lvgm_seek_ms(ctx,Math.round(target/rate*1000));
  if(fastPCM&&!fastPCM.seek(core,target))throw Error('PCM_SEEK_FAILED');
  samplePosition=target;applyMask();postMessage({type:'seeked',epoch});
}
function applyMask(){if(contexts.length&&!isolatedMix)core._lvgm_set_voice_mask(contexts[0],mixMask);}
self.onmessage = async ({data:m}) => {
  try {
    if (m.type==='load') {
      fastPCM=null;
      epoch=m.epoch;
      mixMask=0n;samplePosition=0;
      core = await createCore({locateFile:()=>new URL('./chip-core.wasm',import.meta.url).href});
      const bytes=new Uint8Array(m.bytes), p=core._malloc(bytes.length); core.HEAPU8.set(bytes,p);
      const main=core._lvgm_init(rate); contexts=[main];
      if(core._lvgm_load_data(main,p,bytes.length)!==0) throw Error('DECODE_FAILED');
      count=core._lvgm_get_voice_count(main);
      if(!count || count>64) throw Error(count>64?'VOICE_LIMIT':'NO_VOICES');
      const voices=Array.from({length:count},(_,i)=>({id:i,name:core.UTF8ToString(core._lvgm_get_voice_name(main,i)),chip:core.UTF8ToString(core._lvgm_get_voice_chip_name(main,i))}));
      // The upstream wrapper reuses chip names for dual-chip files. Label instances.
      const instances=new Map();
      for(const v of voices){let state=instances.get(v.chip);if(!state){state={index:1,seen:new Set()};instances.set(v.chip,state);}if(state.seen.has(v.name)){state.index++;state.seen.clear();}state.seen.add(v.name);v.instance=state.index;}
      for(const v of voices){if(instances.get(v.chip).index>1)v.chip+=` #${v.instance}`;}
      if(voices.some(v=>v.chip.includes('YMF278'))) throw Error('OPL4_ROM_REQUIRED');
      const mp=core._lvgm_get_metadata(main), meta={};
      ['title','artist','game','system','date','comment'].forEach((key,i)=>{const p=core.getValue(mp+i*4,'i32'); meta[key]=p?core.UTF8ToString(p):'';});
      core._lvgm_start(main);
      const mask=(1n<<BigInt(count))-1n;
      const active=activeYM2610Voices(bytes,voices);
      isolatedMix=active!==null;
      fastPCM=active&&[...active].some(id=>id>=6&&id<12)&&[12,13,14,15].every(id=>!active.has(id))?continuousPCM(bytes):null;
      for(let i=0;i<count;i++) {if(active&&!active.has(i)){contexts.push(null);continue;}const ctx=core._lvgm_init(rate);core._lvgm_load_data(ctx,p,bytes.length);core._lvgm_start(ctx);core._lvgm_set_voice_mask(ctx,mask ^ (1n<<BigInt(i)));contexts.push(ctx);}
      out=core._malloc(frames*8);
      const duration=core._lvgm_get_duration_ms(main)/1000;durationSamples=Math.round(duration*rate);sourceSamples=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0x18,true);
      prepareDirectSeek();
      postMessage({type:'ready',epoch,voices,meta,duration});
    } else if(m.type==='render' && m.epoch===epoch) render();
    else if(m.type==='seek') seek(m.position,m.epoch);
    else if(m.type==='mask') {mixMask=BigInt(m.mask);applyMask();}
  } catch(e) { fail(e.message || 'DECODE_FAILED'); }
};
