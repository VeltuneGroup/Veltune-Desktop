import { getSongInfo } from '@/providers/song-info-front';
import { createRenderer } from '@/utils';
import { waitForElement } from '@/utils/wait-for-element';

import { disposeReactiveRoot } from './reactive-root';
import {
  setConfig,
  setCurrentSong,
  setCurrentTime,
  setIsFullscreen,
} from './renderer';
import { fetchLyrics } from './store';
import { selectors, tabStates } from './utils';

import type { SyncedLyricsPluginConfig } from '../types';
import type { SongInfo } from '@/providers/song-info';
import type { RendererContext } from '@/types/contexts';
import type { MusicPlayer } from '@/types/music-player';

export let _ytAPI: MusicPlayer | null = null;
export let netFetch: (
  url: string,
  init?: RequestInit,
) => Promise<[number, string, Record<string, string>]>;

export const renderer = createRenderer<
  {
    observerCallback: MutationCallback;
    observer?: MutationObserver;
    videoDataChange: () => Promise<void>;
    updateTimestampInterval?: NodeJS.Timeout | string | number;
    fullscreenObserver?: MutationObserver;
  },
  SyncedLyricsPluginConfig
>({
  onConfigChange(newConfig) {
    setConfig(newConfig);
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

  async onPlayerApiReady(api: MusicPlayer) {
    _ytAPI = api;

    api.addEventListener('videodatachange', this.videoDataChange);

    await this.videoDataChange();
  },
  async videoDataChange() {
    if (!this.updateTimestampInterval) {
      this.updateTimestampInterval = setInterval(
        () => setCurrentTime((_ytAPI?.getCurrentTime() ?? 0) * 1000),
        100,
      );
    }

    // prettier-ignore
    this.observer ??= new MutationObserver(this.observerCallback);
    this.observer.disconnect();

    const header = await waitForElement<HTMLElement>(selectors.head);
    {
      header.removeAttribute('disabled');
      tabStates[header.ariaSelected ?? 'false']();
    }

    this.observer.observe(header, { attributes: true });
    header.removeAttribute('disabled');

    this.fullscreenObserver?.disconnect();
    this.fullscreenObserver = undefined;

    const player = document.querySelector<HTMLElement>('ytmusic-player');
    const playerBar = document.querySelector<HTMLElement>('ytmusic-player-bar');
    const updateFullscreen = () => {
      const fullscreen =
        player?.getAttribute('player-ui-state') === 'FULLSCREEN' ||
        playerBar?.hasAttribute('player-fullscreened') === true;

      setIsFullscreen(fullscreen);
      if (fullscreen) {
        tabStates.true();
      } else if (header.ariaSelected !== 'true') {
        tabStates.false();
      }
    };

    this.fullscreenObserver = new MutationObserver(updateFullscreen);
    for (const target of [player, playerBar]) {
      if (target) {
        this.fullscreenObserver.observe(target, {
          attributes: true,
          attributeFilter: ['player-ui-state', 'player-fullscreened'],
        });
      }
    }
    updateFullscreen();
  },

  async start(ctx: RendererContext<SyncedLyricsPluginConfig>) {
    netFetch = ctx.ipc.invoke.bind(ctx.ipc, 'synced-lyrics:fetch');

    setConfig(await ctx.getConfig());
    const song = getSongInfo();
    setCurrentSong(song.videoId ? song : null);

    ctx.ipc.on('peard:update-song-info', (info: SongInfo) => {
      setCurrentSong(info);
      fetchLyrics(info);
    });
  },

  stop() {
    this.fullscreenObserver?.disconnect();
    setIsFullscreen(false);
    setCurrentSong(null);
    disposeReactiveRoot();
  },
});
