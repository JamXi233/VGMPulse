/** Read the audible part of a decoded channel instead of a whole-block peak. */
export function samplePeak(wave:Float32Array|undefined,offset:number,windowSize=256):number {
  if(!wave?.length)return 0;
  const start=Math.max(0,Math.min(wave.length-windowSize,Math.floor(offset)));
  const end=Math.min(wave.length,start+windowSize);
  let peak=0;
  for(let i=start;i<end;i++)peak=Math.max(peak,Math.abs(wave[i]));
  return peak;
}

/** Time-based attack/release keeps meter motion consistent at any refresh rate. */
export function smoothLevel(current:number,target:number,elapsedMs:number):number {
  const timeConstant=target>current?12:140;
  return target+(current-target)*Math.exp(-Math.max(0,elapsedMs)/timeConstant);
}

export function levelDb(level:number):number {
  return level>0?Math.max(-60,20*Math.log10(level)):-60;
}
