/* eslint-disable */
/**
 * AudioWorklet: 2-channel Float32 in (ch0 = mic, ch1 = tab) →
 * 16 kHz Int16 interleaved stereo frames of exactly 100 ms (6400 bytes).
 * Posts { type: "frame", pcm: ArrayBuffer, levels: [rms0, rms1] } per frame.
 * Mirrors src/audio/pcm.ts (a worklet cannot import modules); see worklet.test.ts.
 */
class PcmEncoder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.targetRate = opts.targetRate || 16000;
    this.frameSamples = opts.frameSamples || 1600;
    this.step = sampleRate / this.targetRate;
    this.position = 1;
    this.previous = [0, 0];
    this.frame = new Int16Array(this.frameSamples * 2);
    this.filled = 0;
    this.sumSquares = [0, 0];
  }

  static toInt16(sample) {
    const c = Math.max(-1, Math.min(1, sample));
    return c < 0 ? Math.round(c * 32768) : Math.round(c * 32767);
  }

  process(inputs) {
    const input = inputs[0] || [];
    const length = (input[0] || input[1] || []).length;
    if (length === 0) return true;
    const channels = [input[0], input[1]];
    for (;;) {
      const index = Math.floor(this.position);
      const frac = this.position - index;
      if ((frac === 0 ? index : index + 1) > length) break;
      for (let ch = 0; ch < 2; ch++) {
        this.push(ch, this.sampleAt(channels[ch], ch, index, frac));
      }
      this.filled++;
      if (this.filled === this.frameSamples) this.flush();
      this.position += this.step;
    }
    this.position -= length;
    for (let ch = 0; ch < 2; ch++) {
      const data = channels[ch];
      if (data && data.length) this.previous[ch] = data[length - 1];
    }
    return true;
  }

  sampleAt(data, ch, index, frac) {
    const at = (i) => (i === 0 ? this.previous[ch] : data ? data[i - 1] : 0);
    const a = at(index);
    return frac === 0 ? a : a + (at(index + 1) - a) * frac;
  }

  push(ch, value) {
    this.frame[this.filled * 2 + ch] = PcmEncoder.toInt16(value);
    this.sumSquares[ch] += value * value;
  }

  flush() {
    const levels = this.sumSquares.map((sum) => Math.sqrt(sum / this.frameSamples));
    const pcm = this.frame.buffer;
    this.port.postMessage({ type: "frame", pcm, levels }, [pcm]);
    this.frame = new Int16Array(this.frameSamples * 2);
    this.filled = 0;
    this.sumSquares = [0, 0];
  }
}

registerProcessor("pcm-encoder", PcmEncoder);
