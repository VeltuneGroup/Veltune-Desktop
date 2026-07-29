import Vudio from 'vudio/umd/vudio';

import { Visualizer } from './visualizer';

import type { VisualizerPluginConfig } from '../index';

class VudioVisualizer extends Visualizer<Vudio> {
  name = 'vudio';

  visualizer: Vudio;

  constructor(
    audioContext: AudioContext,
    audioSource: MediaElementAudioSourceNode,
    visualizerContainer: HTMLElement,
    canvas: HTMLCanvasElement,
    audioNode: GainNode,
    stream: MediaStream,
    options: VisualizerPluginConfig,
  ) {
    super(
      audioNode,
      audioContext,
      audioSource,
      visualizerContainer,
      canvas,
      stream,
      options,
    );

    this.visualizer = new Vudio(stream, canvas, {
      width: canvas.width,
      height: canvas.height,
      // Visualizer config
      ...options,
    });

    this.visualizer.dance();
  }

  resize(width: number, height: number) {
    this.visualizer.setOption({
      width,
      height,
    });
  }

  render() {}

  destroy() {
    this.visualizer.pause();
    this._audioNode.disconnect();
  }
}

export default VudioVisualizer;
