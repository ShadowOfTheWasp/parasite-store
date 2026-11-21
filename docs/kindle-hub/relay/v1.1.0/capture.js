class RelayCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.parts = [];
    this.samples = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) {
      this.parts.push(new Float32Array(input));
      this.samples += input.length;
      if (this.samples >= sampleRate * 4) {
        const block = new Float32Array(this.samples);
        let offset = 0;
        for (const part of this.parts) {
          block.set(part, offset);
          offset += part.length;
        }
        this.port.postMessage(block, [block.buffer]);
        this.parts = [];
        this.samples = 0;
      }
    }
    return true;
  }
}
registerProcessor('relay-capture', RelayCapture);
