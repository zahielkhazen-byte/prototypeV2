class Capture extends AudioWorkletProcessor {
  constructor(){super();this.active=false;this.port.onmessage=e=>{this.active=e.data==='record';if(!this.active)this.port.postMessage(null)}}
  process(inputs){const samples=inputs[0]?.[0];if(this.active&&samples)this.port.postMessage(samples.slice());return true}
}
registerProcessor('capture',Capture);
