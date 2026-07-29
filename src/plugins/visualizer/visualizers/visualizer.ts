import type { VisualizerPluginConfig } from '../index';

export abstract class Visualizer<T> {
  /**
   * The name must be the same as the file name.
   */
  abstract name: string;
  abstract visualizer: T;

  protected constructor(
    protected _audioNode: GainNode,
    _audioContext: AudioContext,
    _audioSource: MediaElementAudioSourceNode,
    _visualizerContainer: HTMLElement,
    _canvas: HTMLCanvasElement,
    _stream: MediaStream,
    _options: VisualizerPluginConfig,
  ) {}

  abstract resize(width: number, height: number): void;
  abstract render(): void;
  abstract destroy(): void;
}
