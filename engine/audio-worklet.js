import {OutputDynamics} from './dynamics.js';
class ChipOutput extends AudioWorkletProcessor {
  constructor() {super();this.queue=[];this.offset=0;this.epoch=0;this.dynamics=new OutputDynamics();this.port.onmessage=({data:m})=>{if(m.type==='settings'){this.dynamics.setSettings(m);}else if(m.type==='flush'){this.queue=[];this.offset=0;this.epoch=m.epoch;if(m.resetDynamics)this.dynamics.reset();}else if(m.epoch===this.epoch)this.queue.push(m);};}
  process(inputs, outputs) {
    const channels=outputs[0];
    for(let i=0;i<channels[0].length;i++) {
      const b=this.queue[0];
      if(!b) {for(const ch of channels) ch[i]=0;continue;}
      if(this.offset===0){this.dynamics.prepareBlock(b.audio);this.port.postMessage({type:'started',id:b.id,epoch:b.epoch});}
      const output=this.dynamics.process(b.audio[this.offset*2],b.audio[this.offset*2+1]);
      for(let ch=0;ch<channels.length;ch++)channels[ch][i]=output[ch];
      this.offset++;
      if(this.offset===b.audio.length/2){this.port.postMessage({type:'consumed',id:b.id,epoch:b.epoch});this.queue.shift();this.offset=0;}
    }
    return true;
  }
}
registerProcessor('chip-output',ChipOutput);
