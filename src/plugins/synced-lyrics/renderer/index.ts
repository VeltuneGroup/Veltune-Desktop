import { createRenderer } from '@/utils';
import { waitForElement } from '@/utils/wait-for-element';

import { selectors, tabStates } from './utils';
import { setConfig, setCurrentTime } from './renderer';
import { fetchLyrics } from './store';

import type { RendererContext } from '@/types/contexts';
import type { YoutubePlayer } from '@/types/youtube-player';
import type { SongInfo } from '@/providers/song-info';
import type { SyncedLyricsPluginConfig } from '../types';

export let _ytAPI: YoutubePlayer | null = null;
export let netFetch: (
  url: string,
  init?: RequestInit,
) => Promise<[number, string, Record<string, string>]>;

export const renderer = createRenderer<
  {
    observerCallback: MutationCallback;
    observer?: MutationObserver;
    videoDataChange: () => Promise<void>;
    syncClock: () => void;
    options?: SyncedLyricsPluginConfig;
    updateTimestampInterval?: number;
    updateTimestampFrame?: number;
  },
  SyncedLyricsPluginConfig
>({
  onConfigChange(newConfig) {
    this.options = newConfig;
    setConfig(newConfig);
    this.syncClock();
  },

  syncClock() {
    if (this.updateTimestampInterval !== undefined) {
      window.clearInterval(this.updateTimestampInterval);
      this.updateTimestampInterval = undefined;
    }

    if (this.updateTimestampFrame !== undefined) {
      window.cancelAnimationFrame(this.updateTimestampFrame);
      this.updateTimestampFrame = undefined;
    }

    const updateCurrentTime = () => {
      setCurrentTime((_ytAPI?.getCurrentTime() ?? 0) * 1000);
    };

    if (this.options?.preciseTiming) {
      const tick = () => {
        updateCurrentTime();
        this.updateTimestampFrame = window.requestAnimationFrame(tick);
      };

      tick();
      return;
    }

    updateCurrentTime();
    this.updateTimestampInterval = window.setInterval(updateCurrentTime, 100);
  },

  observerCallback(mutations: MutationRecord[]) {
    for (const mutation of mutations) {
      const header = mutation.target as HTMLElement;

      switch (mutation.attributeName) {
        case 'disabled':
          header.removeAttribute('disabled');
          break;
        case 'aria-selected':
          tabStates[header.ariaSelected ?? 'false']();
          break;
      }
    }
  },

  async onPlayerApiReady(api: YoutubePlayer) {
    _ytAPI = api;

    api.addEventListener('videodatachange', this.videoDataChange);

    this.syncClock();
    await this.videoDataChange();
  },
  async videoDataChange() {
    this.syncClock();

    // prettier-ignore
    this.observer ??= new MutationObserver(this.observerCallback);
    this.observer.disconnect();

    // Force the lyrics tab to be enabled at all times.
    const header = await waitForElement<HTMLElement>(selectors.head);
    {
      header.removeAttribute('disabled');
      tabStates[header.ariaSelected ?? 'false']();
    }

    this.observer.observe(header, { attributes: true });
    header.removeAttribute('disabled');
  },

  async start(ctx: RendererContext<SyncedLyricsPluginConfig>) {
    netFetch = ctx.ipc.invoke.bind(ctx.ipc, 'synced-lyrics:fetch');

    this.options = await ctx.getConfig();
    setConfig(this.options);

    ctx.ipc.on('ytmd:update-song-info', (info: SongInfo) => {
      fetchLyrics(info);
    });
  },
});
