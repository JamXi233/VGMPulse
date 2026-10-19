// Random access to continuous YM2610 ADPCM-A streams. Register seeking handles
// FM and end-address writes; these indexed codec states restore the PCM cursor.
const steps=[16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552];
const adjust=[-16,-16,-16,-16,32,80,112,144],stride=4096;
const delta=Int32Array.from({length:49*16},(_,i)=>{const nib=i&15,d=Math.floor((2*(nib&7)+1)*steps[i>>4]/8);return nib&8?-d:d;});
export function continuousPCM(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(0x4c,true)!==8000000||view.getUint32(0x1c,true))return null;
 let p=(view.getUint32(0x34,true)||12)+0x34;
 if(bytes[p]!==0x67||bytes[p+1]!==0x66||bytes[p+2]!==0x82||p+15>bytes.length)return null;
 const size=view.getUint32(p+3,true),romSize=view.getUint32(p+7,true);
 if(size!==romSize+8||view.getUint32(p+11,true)!==0||p+7+size>bytes.length)return null;
 const rom=bytes.subarray(p+15,p+7+size),registers=new Uint8Array(48);
 p+=7+size;let samples=0,started=false,stopped=false,enabled=0;const starts=[];
 while(p<bytes.length){
  const op=bytes[p++];if(op===0x66)break;
  if(op===0x61){samples+=view.getUint16(p,true);p+=2;continue;}
  if(op===0x62){samples+=735;continue;}if(op===0x63){samples+=882;continue;}
  if(op>=0x70&&op<=0x7f){samples+=(op&15)+1;continue;}
  if((op!==0x58&&op!==0x59)||p+2>bytes.length)return null;
  const r=bytes[p++],v=bytes[p++];if(op===0x58)continue;
  if(r>=48)continue;
  if(r===0){
   if(!started&&samples===0&&v>0&&v<=63){
    started=true;enabled=v;for(let ch=0;ch<6;ch++)starts.push((registers[16+ch]|registers[24+ch]<<8)*256);
   }else if(started&&!stopped&&v===(128|enabled)&&samples===view.getUint32(0x18,true)){stopped=true;}
   else return null;
  }else if(started&&((r>=16&&r<32)||r===1||(r>=8&&r<=13)))return null;
  registers[r]=v;
 }
 const channels=Array.from({length:6},(_,ch)=>ch).filter(ch=>enabled&(1<<ch));
 const ordered=channels.slice().sort((a,b)=>starts[a]-starts[b]);
 if(!started||!stopped||ordered.some((ch,i)=>starts[ch]>=rom.length||(i&&starts[ch]===starts[ordered[i-1]])))return null;
 const lanes=Array(6);
 for(let i=0;i<ordered.length;i++){const ch=ordered[i];lanes[ch]={start:starts[ch],end:starts[ordered[i+1]]??rom.length,acc:null,step:null};}
 let indexed=false,locations=null;
 function index(){
  if(indexed)return;indexed=true;
  for(const ch of channels){const lane=lanes[ch];
   const length=(lane.end-lane.start)*2,n=Math.ceil(length/stride)+1;
   lane.acc=new Int16Array(n);lane.step=new Int16Array(n);
   let acc=0,step=0;
   for(let i=0;i<length;i++){
    const byte=rom[lane.start+(i>>1)],code=i&1?byte&15:byte>>4;
    acc=((acc+delta[step+code]+2048)&4095)-2048;step=Math.max(0,Math.min(768,step+adjust[code&7]));
    if((i+1)%stride===0){const at=(i+1)/stride;lane.acc[at]=acc;lane.step[at]=step;}
   }
  }
 }
 function state(ch,n){
  const lane=lanes[ch];if(n<0||n>(lane.end-lane.start)*2)throw Error('PCM seek outside stream');
  let at=Math.floor(n/stride)*stride,acc=lane.acc[at/stride],step=lane.step[at/stride];
  while(at<n){const byte=rom[lane.start+(at>>1)],code=at&1?byte&15:byte>>4;acc=((acc+delta[step+code]+2048)&4095)-2048;step=Math.max(0,Math.min(768,step+adjust[code&7]));at++;}
  return {acc,step};
 }
 function locate(core){
  if(locations?.core===core)return locations;
  const h=core.HEAPU8,v=new DataView(h.buffer),main=[],solo=Array.from({length:6},()=>[]),records=[];
  // ADPCM_CH is 52 bytes in the pinned, bundled 32-bit MAME core. Verify all
  // six records, starts, rates and mute masks before enabling this fast path.
  for(let at=0;at<h.length-6*52;at+=4){
   if(h[at+1]!==1||v.getUint32(at+12,true)!==21845||v.getUint32(at+16,true)!==starts[0])continue;
   let mask=0,valid=true;
   for(let ch=0;ch<6;ch++){
    const o=at+ch*52;
    if(h[o]>1||h[o+1]!==1<<ch||v.getUint32(o+12,true)!==21845||v.getUint32(o+16,true)!==starts[ch]||v.getUint32(o+8,true)>=65536||h[o+48]>1){valid=false;break;}
    mask|=h[o+48]<<ch;
   }
   if(valid){records.push({at,mask});if(mask===0)main.push(at);for(let ch=0;ch<6;ch++)if(mask===(63^(1<<ch)))solo[ch].push(at);}
  }
  if(main.length!==1||channels.some(ch=>solo[ch].length!==1))return null;
  // Match the pinned function-pointer-based RESMPL_STATE layout to each
  // verified chip record; buffer bounds and one-to-one ownership are checked.
  const resamplers=[];
  for(let at=0;at<h.length-68;at+=4){
   if(v.getUint32(at,true)!==55555||v.getUint32(at+4,true)!==44100||v.getUint32(at+12,true)!==0||v.getUint32(at+56,true)!==55555)continue;
   const chip=v.getUint32(at+24,true),left=v.getUint32(at+60,true),right=v.getUint32(at+64,true);
   if(right-left!==55555*4||right+55555*4>h.length)continue;
   const match=records.filter(r=>r.at>chip&&r.at-chip<32768);
   if(match.length!==1)return null;
   resamplers.push({at,record:match[0]});
  }
  if(resamplers.length!==records.length||new Set(resamplers.map(r=>r.record.at)).size!==records.length)return null;
  locations={core,main:main[0],solo:solo.map(s=>s[0]),resamplers};return locations;
 }
 return {index,locate,
  nativePosition(core){const loc=locate(core);if(!loc)return null;const ch=channels[0],v=new DataView(core.HEAPU8.buffer),o=loc.main+ch*52;return ((v.getUint32(o+4,true)-starts[ch]*2)*65536+v.getUint32(o+8,true))/21845;},
  restore(core,nativeFrames){
   const loc=locate(core);if(!loc||!Number.isInteger(nativeFrames)||nativeFrames<0)return false;
   index();const clocks=nativeFrames*21845,n=Math.floor(clocks/65536),fraction=clocks%65536;
   const v=new DataView(core.HEAPU8.buffer);
   for(const ch of channels){
    const {acc,step}=state(ch,n),byte=n?rom[starts[ch]+((n-1)>>1)]:0;
    for(const base of [loc.main,loc.solo[ch]]){
     const o=base+ch*52;v.setUint8(o+2,byte);v.setUint32(o+4,starts[ch]*2+n,true);v.setUint32(o+8,fraction,true);
     v.setInt32(o+28,acc,true);v.setInt32(o+32,step,true);
     v.setInt32(o+36,((acc*v.getInt8(o+40))>>v.getUint8(o+41))&~3,true);
    }
   }
   return true;
  },
  seek(core,sample){
   const loc=locate(core);if(!loc)return false;
   // Restore the pinned core's fractional downsampler position and previous PCM
   // sample. No audio is rendered or discarded before the destination.
   const ended=sample>=view.getUint32(0x18,true);
   const nativeFrames=Math.ceil(Math.min(sample,view.getUint32(0x18,true))*55555/44100);
   if(!this.restore(core,nativeFrames))return false;
   const v=new DataView(core.HEAPU8.buffer);
   for(const {at,record} of loc.resamplers){
    const local=sample%44100,last=Math.ceil(local*55555/44100);
    v.setUint32(at+28,local,true);v.setUint32(at+32,last,true);v.setUint32(at+36,last,true);
    let left=0,right=0;
    if(ended)for(let ch=0;ch<6;ch++)v.setUint8(record.at+ch*52,0);
    if(sample&&!ended)for(const ch of channels)if(!(record.mask&(1<<ch))){
     const o=record.at+ch*52,value=v.getInt32(o+36,true)*2,pan=registers[8+ch];
     if(pan&128)left+=value;if(pan&64)right+=value;
    }
    v.setInt32(at+40,left,true);v.setInt32(at+44,right,true);
    v.setInt32(at+48,0,true);v.setInt32(at+52,0,true);
   }
   return true;
  }
 };
}
