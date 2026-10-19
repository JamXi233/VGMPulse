export type Voice={id:number;name:string;chip:string};
export type Track={title:string;artist:string;game:string;system:string;date:string;comment:string;duration:number;voices:Voice[]};
export type ScopeFrame={waves:Float32Array[];levels:number[];position:number;timestamp?:number};
type Block=ScopeFrame & {id:number;epoch:number;audio:Float32Array};
export class VGMEngine {
  worker:Worker|null=null; context:AudioContext|null=null; node:AudioWorkletNode|null=null; gain:GainNode|null=null;
  blocks=new Map<number,Block>(); pending:Block[]=[]; epoch=0; volume=.7; playing=false; ended=false;
  private dynamics={normalization:false,preampDb:0};
  private previewPosition:number|null=0;
  private cancelLoad:((reason:DOMException)=>void)|null=null;
  private seekTimer:ReturnType<typeof setTimeout>|null=null;
  onFrame:((f:ScopeFrame)=>void)|null=null; onEnd:(()=>void)|null=null; onError:((s:string)=>void)|null=null;
  private request(){this.worker?.postMessage({type:'render',epoch:this.epoch});}
  private fill(){for(let i=0;i<4;i++)this.request();}
  async load(bytes:ArrayBuffer):Promise<Track>{
    const stopped=this.clear(),loadEpoch=this.epoch;
    await stopped;
    if(loadEpoch!==this.epoch)throw new DOMException('PLAYBACK_CANCELLED','AbortError');
    const worker=new Worker('/engine/decoder-worker.js?v=20261020-localized',{type:'module'});this.worker=worker;
    return new Promise((resolve,reject)=>{
      this.cancelLoad=reject;
      worker.onerror=()=>{if(worker!==this.worker)return;this.cancelLoad=null;const msg='DECODER_FAILED';reject(Error(msg));this.onError?.(msg);};
      worker.onmessage=({data:m})=>{
        if(worker!==this.worker)return;
        if(m.type==='error'){this.cancelLoad=null;reject(Error(m.message));this.onError?.(m.message);return;}
        if(m.epoch!==this.epoch)return;
        if(m.type==='ready'){this.cancelLoad=null;resolve({...m.meta,duration:m.duration,voices:m.voices});this.fill();}
        if(m.type==='seeked'){this.fill();}
        if(m.type==='block'){if(this.previewPosition!==null){this.onFrame?.({...m,position:this.previewPosition});this.previewPosition=null;}this.blocks.set(m.id,m);if(this.node)this.node.port.postMessage({id:m.id,epoch:m.epoch,audio:m.audio},[m.audio.buffer]);else this.pending.push(m);}
        if(m.type==='end'){this.ended=true;if(this.blocks.size===0)this.finish();}
      };
      worker.postMessage({type:'load',bytes,epoch:this.epoch},[bytes]);
    });
  }
  private finish(){this.playing=false;void this.context?.suspend();this.onEnd?.();}
  async play(){
    const playEpoch=this.epoch;
    if(!this.context){
      this.context=new AudioContext({sampleRate:44100});
      // Resume from the user's click before waiting for the worklet module.
      const resume=this.context.resume();
      await this.context.audioWorklet.addModule('/engine/audio-worklet.js');
      this.node=new AudioWorkletNode(this.context,'chip-output',{outputChannelCount:[2]});
      this.gain=this.context.createGain();this.gain.gain.value=this.volume;this.node.connect(this.gain).connect(this.context.destination);
      this.node.port.postMessage({type:'settings',...this.dynamics});
      this.node.port.postMessage({type:'flush',epoch:this.epoch,resetDynamics:true});
      this.node.port.onmessage=({data:m})=>{
        if(m.epoch!==this.epoch)return;
        const b=this.blocks.get(m.id);
        if(m.type==='started'){if(b)this.onFrame?.({...b,position:Math.max(0,b.position-2048/44100),timestamp:performance.now()});return;}
        if(b)this.blocks.delete(m.id);
        if(this.ended){if(this.blocks.size===0)this.finish();}else this.request();
      };
      for(const b of this.pending)this.node.port.postMessage({id:b.id,epoch:b.epoch,audio:b.audio},[b.audio.buffer]);this.pending=[];await resume;
    }
    if(playEpoch!==this.epoch)return false;
    await this.context.resume();
    if(playEpoch!==this.epoch){if(!this.playing)await this.context.suspend();return false;}
    this.playing=true;return true;
  }
  async pause(){this.playing=false;await this.context?.suspend();}
  seek(position:number){
    this.previewPosition=position;this.epoch++;this.ended=false;this.blocks.clear();this.pending=[];
    this.node?.port.postMessage({type:'flush',epoch:this.epoch});
    if(this.seekTimer)clearTimeout(this.seekTimer);
    const epoch=this.epoch,worker=this.worker;
    this.seekTimer=setTimeout(()=>{this.seekTimer=null;if(worker===this.worker&&epoch===this.epoch)worker?.postMessage({type:'seek',position,epoch});},0);
  }
  setMask(mask:bigint){this.worker?.postMessage({type:'mask',mask:mask.toString()});}
  setVolume(v:number){this.volume=v;if(this.gain&&this.context)this.gain.gain.setTargetAtTime(v,this.context.currentTime,.02);}
  setDynamics(normalization:boolean,preampDb:number){this.dynamics={normalization,preampDb};this.node?.port.postMessage({type:'settings',...this.dynamics});}
  clear():Promise<void>{
    if(this.seekTimer)clearTimeout(this.seekTimer);this.seekTimer=null;
    this.cancelLoad?.(new DOMException('PLAYBACK_CANCELLED','AbortError'));this.cancelLoad=null;
    this.worker?.terminate();this.worker=null;this.epoch++;this.playing=false;this.ended=false;this.previewPosition=0;
    this.blocks.clear();this.pending=[];this.node?.port.postMessage({type:'flush',epoch:this.epoch,resetDynamics:true});
    return this.context?.suspend()??Promise.resolve();
  }
  destroy(){void this.clear();void this.context?.close();}

}
export async function readVGM(file:File):Promise<ArrayBuffer>{
  if(file.size>32*1024*1024)throw Error('FILE_TOO_LARGE');
  let bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes[0]===0x1f&&bytes[1]===0x8b){
    const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();const chunks:Uint8Array[]=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32*1024*1024){await reader.cancel();throw Error('FILE_EXPANDED_TOO_LARGE');}chunks.push(value);}}
    catch(error){if(error instanceof Error&&error.message==='FILE_EXPANDED_TOO_LARGE')throw error;throw Error('GZIP_INVALID');}
    bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  }
  if(bytes.length<64||String.fromCharCode(...bytes.slice(0,4))!=='Vgm ')throw Error('FILE_INVALID');
  const v=new DataView(bytes.buffer);const version=v.getUint32(8,true);const start=version>=0x150?(v.getUint32(0x34,true)||12)+0x34:0x40;
  if(start>=bytes.length||start<0x40)throw Error('FILE_TRUNCATED');
  return bytes.buffer as ArrayBuffer;
}
