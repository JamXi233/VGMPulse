/** One frame callback for all visible waveform and meter animations. */
const subscribers=new Map<(now:number)=>void,{fps:number;last:number}>();
let handle=0;
function frame(now:number){
  for(const [callback,state] of subscribers){if(now-state.last>=1000/state.fps-.5){const interval=1000/state.fps;state.last=Number.isFinite(state.last)?now-Math.max(0,(now-state.last)%interval):now;callback(now);}}
  handle=subscribers.size?requestAnimationFrame(frame):0;
}
export function animate(callback:(now:number)=>void,fps=60):()=>void {
  subscribers.set(callback,{fps,last:-Infinity});
  if(!handle)handle=requestAnimationFrame(frame);
  return()=>{subscribers.delete(callback);if(!subscribers.size&&handle){cancelAnimationFrame(handle);handle=0;}};
}
