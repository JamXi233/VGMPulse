/** Streaming peak normalization with gated gain and stereo-linked peak protection. */
export class OutputDynamics {
  constructor(sampleRate=44100) {
    this.output=[0,0];this.sampleRate=sampleRate;this.normalization=false;this.preampDb=0;
    this.referencePeak=0;this.normalGain=1;this.normalTarget=1;this.preampGain=1;this.preampTarget=1;
    this.rise=1-Math.exp(-1/(sampleRate*.5));
    this.fall=1-Math.exp(-1/(sampleRate*.012));
    this.preampStep=1-Math.exp(-1/(sampleRate*.025));
  }
  setSettings({normalization=false,preampDb=0}) {
    this.normalization=!!normalization;
    this.preampDb=Number.isFinite(preampDb)?Math.max(-12,Math.min(24,preampDb)):0;
    this.preampTarget=10**(this.preampDb/20);
    if(!this.normalization)this.normalTarget=1;
  }
  reset() {this.referencePeak=0;this.normalGain=1;this.normalTarget=1;this.preampGain=this.preampTarget;}
  prepareBlock(audio) {
    let peak=0;for(let i=0;i<audio.length;i++)peak=Math.max(peak,Math.abs(audio[i]));
    // Keep a long reference so rests and note envelopes do not cause rapid pumping.
    if(peak>=.00001)this.referencePeak=Math.max(peak,this.referencePeak*Math.exp(-(audio.length/2)/this.sampleRate/12));
    if(!this.normalization)this.normalTarget=1;
    else if(peak>=.00001)this.normalTarget=Math.max(.25,Math.min(10**(24/20),.7/Math.max(.00001,this.referencePeak)));
  }
  process(left,right) {
    this.normalGain+=(this.normalTarget-this.normalGain)*(this.normalTarget<this.normalGain?this.fall:this.rise);
    this.preampGain+=(this.preampTarget-this.preampGain)*this.preampStep;
    const gain=this.normalGain*this.preampGain;
    if(!this.normalization&&this.preampDb===0&&Math.abs(gain-1)<1e-6){this.output[0]=left;this.output[1]=right;return this.output;}
    left*=gain;right*=gain;
    const peak=Math.max(Math.abs(left),Math.abs(right));
    // A soft knee bounds the peak below 0.98 and preserves the stereo balance.
    if(peak>.9){const protectedPeak=Math.min(.979999,.9+.08*(1-Math.exp(-(peak-.9)/.08))),ratio=protectedPeak/peak;left*=ratio;right*=ratio;}
    this.output[0]=left;this.output[1]=right;return this.output;
  }
}
