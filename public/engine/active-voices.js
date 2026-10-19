// Conservatively detect used YM2610 voices. Unknown commands keep all voices.
export function activeYM2610Voices(bytes,voices) {
  if(voices.length!==16||!voices.every(v=>v.chip.includes('YM2610')))return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),active=new Set();
  let at=(view.getUint32(0x34,true)||12)+0x34;
  while(at<bytes.length){
    const op=bytes[at++];
    if(op===0x66)return active;
    if(op===0x61){at+=2;continue;}
    if(op===0x62||op===0x63||(op>=0x70&&op<=0x7f))continue;
    if(op===0x67){if(at+6>bytes.length||bytes[at]!==0x66)return null;at+=2;const n=view.getUint32(at,true);at+=4+n;continue;}
    if((op!==0x58&&op!==0x59)||at+2>bytes.length)return null;
    const r=bytes[at++],v=bytes[at++];
    if(op===0x58){
      if(r===0x28&&(v&0xf0)){const c=v&3;if(c<3)active.add(c+((v&4)?3:0));}
      if(r>=8&&r<=10&&(v&31))active.add(13+r-8);
      if(r===0x10&&(v&0x80))active.add(12);
    }else if(r===0&&!(v&0x80)){for(let ch=0;ch<6;ch++)if(v&(1<<ch))active.add(6+ch);}
  }
  return null;
}
