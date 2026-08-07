import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  runWithOwner,
  Show,
  untrack,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { type VirtualizerHandle, VList } from 'virtua/solid';

import {
  ErrorDisplay,
  LoadingKaomoji,
  NotFoundKaomoji,
  SyncedLine,
  PlainLyrics,
} from './components';
import { LyricsPicker } from './components/LyricsPicker';
import { _ytAPI } from './index';
import { reactiveOwner } from './reactive-root';
import { currentLyrics } from './store';
import { selectors } from './utils';

import type { LineLyrics, SyncedLyricsPluginConfig } from '../types';
import type { SongInfo } from '@/providers/song-info';

export const [isVisible, setIsVisible] = createSignal<boolean>(false);
export const [config, setConfig] =
  createSignal<SyncedLyricsPluginConfig | null>(null);

runWithOwner(reactiveOwner, () => {
  createEffect(() => {
    if (!config()?.enabled) return;
    const root = document.documentElement;

    if (config()?.cinematic) {
      root.dataset.lyricsEffect = 'cinematic';
      return;
    }
    root.removeAttribute('data-lyrics-effect');

    switch (config()?.lineEffect) {
      case 'fancy':
        root.style.setProperty('--lyrics-font-size', '3rem');
        root.style.setProperty('--lyrics-line-height', '1.333');
        root.style.setProperty('--lyrics-width', '100%');
        root.style.setProperty('--lyrics-padding', '2rem');
        root.style.setProperty(
          '--lyrics-animations',
          'lyrics-glow var(--lyrics-glow-duration) forwards, lyrics-wobble var(--lyrics-wobble-duration) forwards',
        );

        root.style.setProperty('--lyrics-inactive-font-weight', '700');
        root.style.setProperty('--lyrics-inactive-opacity', '0.33');
        root.style.setProperty('--lyrics-inactive-scale', '0.95');
        root.style.setProperty('--lyrics-inactive-offset', '0');

        root.style.setProperty('--lyrics-active-font-weight', '700');
        root.style.setProperty('--lyrics-active-opacity', '1');
        root.style.setProperty('--lyrics-active-scale', '1');
        root.style.setProperty('--lyrics-active-offset', '0');
        break;
      case 'scale':
        root.style.setProperty(
          '--lyrics-font-size',
          'clamp(1.4rem, 1.1vmax, 3rem)',
        );
        root.style.setProperty(
          '--lyrics-line-height',
          'var(--ytmusic-body-line-height)',
        );
        root.style.setProperty('--lyrics-width', '83%');
        root.style.setProperty('--lyrics-padding', '0');
        root.style.setProperty('--lyrics-animations', 'none');

        root.style.setProperty('--lyrics-inactive-font-weight', '400');
        root.style.setProperty('--lyrics-inactive-opacity', '0.33');
        root.style.setProperty('--lyrics-inactive-scale', '1');
        root.style.setProperty('--lyrics-inactive-offset', '0');

        root.style.setProperty('--lyrics-active-font-weight', '700');
        root.style.setProperty('--lyrics-active-opacity', '1');
        root.style.setProperty('--lyrics-active-scale', '1.2');
        root.style.setProperty('--lyrics-active-offset', '0');
        break;
      case 'offset':
        root.style.setProperty(
          '--lyrics-font-size',
          'clamp(1.4rem, 1.1vmax, 3rem)',
        );
        root.style.setProperty(
          '--lyrics-line-height',
          'var(--ytmusic-body-line-height)',
        );
        root.style.setProperty('--lyrics-width', '100%');
        root.style.setProperty('--lyrics-padding', '0');
        root.style.setProperty('--lyrics-animations', 'none');

        root.style.setProperty('--lyrics-inactive-font-weight', '400');
        root.style.setProperty('--lyrics-inactive-opacity', '0.33');
        root.style.setProperty('--lyrics-inactive-scale', '1');
        root.style.setProperty('--lyrics-inactive-offset', '0');

        root.style.setProperty('--lyrics-active-font-weight', '700');
        root.style.setProperty('--lyrics-active-opacity', '1');
        root.style.setProperty('--lyrics-active-scale', '1');
        root.style.setProperty('--lyrics-active-offset', '5%');
        break;
      case 'focus':
        root.style.setProperty(
          '--lyrics-font-size',
          'clamp(1.4rem, 1.1vmax, 3rem)',
        );
        root.style.setProperty(
          '--lyrics-line-height',
          'var(--ytmusic-body-line-height)',
        );
        root.style.setProperty('--lyrics-width', '100%');
        root.style.setProperty('--lyrics-padding', '0');
        root.style.setProperty('--lyrics-animations', 'none');

        root.style.setProperty('--lyrics-inactive-font-weight', '400');
        root.style.setProperty('--lyrics-inactive-opacity', '0.33');
        root.style.setProperty('--lyrics-inactive-scale', '1');
        root.style.setProperty('--lyrics-inactive-offset', '0');

        root.style.setProperty('--lyrics-active-font-weight', '700');
        root.style.setProperty('--lyrics-active-opacity', '1');
        root.style.setProperty('--lyrics-active-scale', '1');
        root.style.setProperty('--lyrics-active-offset', '0');
        break;
    }
  });
});

type LyricsRendererChild =
  | { kind: 'LyricsPicker' }
  | { kind: 'LoadingKaomoji' }
  | { kind: 'NotFoundKaomoji' }
  | { kind: 'Error'; error: Error }
  | {
      kind: 'SyncedLine';
      line: LineLyrics;
    }
  | {
      kind: 'PlainLine';
      line: string;
    };

const lyricsPicker: LyricsRendererChild = { kind: 'LyricsPicker' };

export const [currentTime, setCurrentTime] = createSignal<number>(-1);
export const [isFullscreen, setIsFullscreen] = createSignal(false);
export const [currentSong, setCurrentSong] = createSignal<SongInfo | null>(
  null,
);

const formatTime = (seconds: number) => {
  seconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

const FullscreenControls = (props: {
  visible: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) => {
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [duration, setDuration] = createSignal(0);
  const [isMuted, setIsMuted] = createSignal(false);

  createEffect(() => {
    currentTime();
    const api = _ytAPI;
    setIsPlaying(api?.getPlayerState() === 1);
    setDuration(api?.getDuration() ?? 0);
    setIsMuted(api?.isMuted() ?? false);
  });

  const clickNative = (selector: string) => {
    document.querySelector<HTMLElement>(selector)?.click();
  };

  const togglePlayback = () => {
    if (_ytAPI?.getPlayerState() === 1) _ytAPI.pauseVideo();
    else _ytAPI?.playVideo();
  };

  return (
    <div
      class={`lyrics-fullscreen-controls ${props.visible ? 'visible' : ''}`}
      onMouseEnter={() => props.onMouseEnter()}
      onMouseLeave={() => props.onMouseLeave()}
    >
      <input
        aria-label="Seek"
        class="lyrics-fullscreen-progress"
        disabled={!duration()}
        max={duration() || 1}
        min="0"
        onInput={(event) => {
          _ytAPI?.seekTo(Number(event.currentTarget.value));
        }}
        step="0.1"
        type="range"
        value={Math.min(currentTime() / 1000, duration()) || 0}
      />
      <div class="lyrics-fullscreen-controls-row">
        <div class="lyrics-fullscreen-control-group lyrics-fullscreen-track-control">
          <button
            aria-label="Previous track"
            onClick={() => _ytAPI?.previousVideo()}
            title="Previous track"
            type="button"
          >
            <yt-icon icon={'yt-icons:skip_previous'} />
          </button>
          <button
            aria-label={isPlaying() ? 'Pause' : 'Play'}
            onClick={togglePlayback}
            title={isPlaying() ? 'Pause' : 'Play'}
            type="button"
          >
            <yt-icon
              icon={
                isPlaying() ? 'yt-icons:pause_outlined' : 'yt-icons:play_arrow'
              }
            />
          </button>
          <button
            aria-label="Next track"
            onClick={() => _ytAPI?.nextVideo()}
            title="Next track"
            type="button"
          >
            <yt-icon icon={'yt-icons:skip_next'} />
          </button>
          <span class="lyrics-fullscreen-time">
            {formatTime(currentTime() / 1000)} / {formatTime(duration())}
          </span>
        </div>
        <div class="lyrics-fullscreen-control-group lyrics-fullscreen-control-info">
          <Show when={currentSong()?.imageSrc}>
            <img alt="" src={currentSong()!.imageSrc!} />
          </Show>
          <span class="lyrics-fullscreen-track-text">
            <strong>{currentSong()?.title}</strong>
            <small>
              <span class="lyrics-fullscreen-explicit">E</span>
              {currentSong()?.artist}
              <Show when={currentSong()?.album}>
                {' · '}
                {currentSong()?.album}
              </Show>
            </small>
          </span>
          <span class="lyrics-fullscreen-metadata-actions">
            <button
              aria-label="Like"
              onClick={() =>
                clickNative('#like-button-renderer #button-shape-like > button')
              }
              title="Like"
              type="button"
            >
              <yt-icon icon={'yt-sys-icons:like'} />
            </button>
            <button
              aria-label="Dislike"
              onClick={() =>
                clickNative(
                  '#like-button-renderer #button-shape-dislike > button',
                )
              }
              title="Dislike"
              type="button"
            >
              <yt-icon icon={'yt-sys-icons:dislike'} />
            </button>
            <button
              aria-label="More options"
              onClick={() => clickNative('ytmusic-player-bar .more-button')}
              title="More options"
              type="button"
            >
              <yt-icon icon={'yt-icons:more_vert'} />
            </button>
          </span>
        </div>
        <div class="lyrics-fullscreen-control-group lyrics-fullscreen-secondary-controls">
          <button
            aria-label={isMuted() ? 'Unmute' : 'Mute'}
            aria-pressed={isMuted()}
            onClick={() => {
              if (isMuted()) _ytAPI?.unMute();
              else _ytAPI?.mute();
              setIsMuted(!isMuted());
            }}
            title={isMuted() ? 'Unmute' : 'Mute'}
            type="button"
          >
            <yt-icon
              icon={isMuted() ? 'yt-icons:volume_off' : 'yt-icons:volume_up'}
            />
          </button>
          <button
            aria-label="Repeat"
            class="lyrics-fullscreen-repeat"
            onClick={() => clickNative('.repeat.ytmusic-player-bar')}
            title="Repeat"
            type="button"
          >
            <svg
              aria-hidden="true"
              class="lyrics-fullscreen-repeat-icon"
              viewBox="0 0 24 24"
            >
              <path d="M7 7h10v3l4-4-4-4v3H5c-1.1 0-2 .9-2 2v4h2V7zm10 10H7v-3l-4 4 4 4v-3h12c1.1 0 2-.9 2-2v-4h-2v4z" />
            </svg>
          </button>
          <button
            aria-label="Shuffle"
            class="lyrics-fullscreen-shuffle"
            onClick={() => clickNative('.shuffle.ytmusic-player-bar')}
            title="Shuffle"
            type="button"
          >
            <yt-icon icon={'yt-icons:music_shuffle'} />
          </button>
          <button
            aria-label="Exit fullscreen"
            onClick={() => clickNative('.exit-fullscreen-button')}
            title="Exit fullscreen"
            type="button"
          >
            <yt-icon icon={'yt-icons:fullscreen_exit'} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const LyricsRenderer = () => {
  const [scroller, setScroller] = createSignal<VirtualizerHandle>();
  const [stickyRef, setStickRef] = createSignal<HTMLElement | null>(null);

  const tab = document.querySelector<HTMLElement>(selectors.body.tabRenderer)!;

  let mouseCoord = 0;
  const mousemoveListener = (e: Event) => {
    if ('clientY' in e) {
      mouseCoord = (e as MouseEvent).clientY;
    }

    const { top } = tab.getBoundingClientRect();
    const { clientHeight: height } = stickyRef()!;
    const scrollOffset = scroller()?.scrollOffset ?? -1;

    const isInView = scrollOffset <= height;
    const isMouseOver = mouseCoord - top - 5 <= height;

    const showPicker = isInView || isMouseOver;

    if (showPicker) {
      stickyRef()!.style.setProperty('--lyrics-picker-top', '0');
    } else {
      stickyRef()!.style.setProperty('--lyrics-picker-top', `-${height}px`);
    }
  };

  onMount(() => {
    const vList = document.querySelector<HTMLElement>('.synced-lyrics-vlist');

    tab.addEventListener('mousemove', mousemoveListener);
    vList?.addEventListener('scroll', mousemoveListener);
    vList?.addEventListener('scrollend', mousemoveListener);

    onCleanup(() => {
      tab.removeEventListener('mousemove', mousemoveListener);
      vList?.removeEventListener('scroll', mousemoveListener);
      vList?.removeEventListener('scrollend', mousemoveListener);
    });
  });

  const [children, setChildren] = createSignal<LyricsRendererChild[]>([
    { kind: 'LoadingKaomoji' },
  ]);

  createEffect(() => {
    const current = currentLyrics();
    if (!current) {
      setChildren(() => [{ kind: 'NotFoundKaomoji' }]);
      return;
    }

    const { state, data, error } = current;

    setChildren(() => {
      if (state === 'fetching') {
        return [{ kind: 'LoadingKaomoji' }];
      }

      if (state === 'error') {
        return [{ kind: 'Error', error: error! }];
      }

      if (data?.lines) {
        return data.lines.map((line) => ({
          kind: 'SyncedLine' as const,
          line,
        }));
      }

      if (data?.lyrics) {
        const lines = data.lyrics.split('\n').filter((line) => line.trim());
        return lines.map((line) => ({
          kind: 'PlainLine' as const,
          line,
        }));
      }

      return [{ kind: 'NotFoundKaomoji' }];
    });
  });

  const [statuses, setStatuses] = createSignal<
    ('previous' | 'current' | 'upcoming')[]
  >([]);
  createEffect(() => {
    const time = currentTime();
    const data = currentLyrics()?.data;

    if (!data || !data.lines) return setStatuses([]);

    const previous = untrack(statuses);
    const current = data.lines.map((line) => {
      if (line.timeInMs >= time) return 'upcoming';
      if (time - line.timeInMs >= line.duration) return 'previous';
      return 'current';
    });

    if (previous.length !== current.length) return setStatuses(current);
    if (previous.every((status, idx) => status === current[idx])) return;

    setStatuses(current);
    return;
  });

  const [currentIndex, setCurrentIndex] = createSignal(0);
  createEffect(() => {
    const index = statuses().findIndex((status) => status === 'current');
    if (index === -1) return;
    setCurrentIndex(index);
  });

  createEffect(() => {
    const current = currentLyrics();
    const idx = currentIndex();
    const lineCount = untrack(statuses).length;

    if (!scroller() || !current.data?.lines) return;

    const scrollIndex = Math.min(idx + 1, lineCount);

    scroller()!.scrollToIndex(scrollIndex, {
      smooth: true,
      align: 'center',
    });
  });

  const [fullscreenList, setFullscreenList] = createSignal<HTMLDivElement>();
  const [controlsVisible, setControlsVisible] = createSignal(false);
  const [controlsHovered, setControlsHovered] = createSignal(false);
  let controlsTimeout: ReturnType<typeof setTimeout> | undefined;
  const showControls = () => {
    setControlsVisible(true);
    if (controlsTimeout) clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
      if (!controlsHovered()) setControlsVisible(false);
    }, 3000);
  };
  const hideControls = () => {
    if (controlsTimeout) clearTimeout(controlsTimeout);
    setControlsVisible(false);
  };

  onCleanup(() => {
    if (controlsTimeout) clearTimeout(controlsTimeout);
  });

  createEffect(() => {
    if (!isFullscreen() || !fullscreenList()) return;
    currentIndex();
    fullscreenList()
      ?.querySelector<HTMLElement>(`[data-lyrics-index="${currentIndex()}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  const artwork = () => currentSong()?.imageSrc;
  const LyricsList = () => (
    <VList
      {...{
        ref: setScroller,
        style: { 'scrollbar-width': 'none' },
        class: 'synced-lyrics-vlist',
        keepMounted: [0],
        overscan: 4,
      }}
      data={[lyricsPicker, ...children()]}
    >
      {(props, idx) => {
        if (typeof props === 'undefined') return null;
        switch (props.kind) {
          case 'LyricsPicker':
            return <LyricsPicker setStickRef={setStickRef} />;
          case 'Error':
            return <ErrorDisplay {...props} />;
          case 'LoadingKaomoji':
            return <LoadingKaomoji />;
          case 'NotFoundKaomoji':
            return <NotFoundKaomoji />;
          case 'SyncedLine': {
            return (
              <SyncedLine
                {...props}
                index={idx()}
                scroller={scroller()!}
                status={statuses()[idx() - 1]}
              />
            );
          }
          case 'PlainLine':
            return <PlainLyrics {...props} />;
        }
      }}
    </VList>
  );

  return (
    <Show when={isVisible() || isFullscreen()}>
      <div
        class={`lyrics-layout ${
          isFullscreen() ? 'lyrics-layout-source-hidden' : ''
        }`}
      >
        <Show when={!isFullscreen()}>
          <LyricsList />
        </Show>
      </div>
      <Show when={isFullscreen()}>
        <Portal mount={document.body}>
          <div
            class="lyrics-layout lyrics-layout-fullscreen"
            onMouseMove={(event) => {
              if (event.clientY >= window.innerHeight - 140) showControls();
              else if (controlsVisible()) hideControls();
            }}
          >
            <div
              class="lyrics-fullscreen-background"
              style={{
                'background-image': artwork()
                  ? `url(${JSON.stringify(artwork())})`
                  : 'none',
              }}
            />
            <aside class="lyrics-fullscreen-info">
              <Show when={artwork()}>
                <img
                  alt=""
                  class="lyrics-fullscreen-artwork"
                  src={artwork()!}
                />
              </Show>
              <div class="lyrics-fullscreen-track">
                <strong>{currentSong()?.title}</strong>
                <span>{currentSong()?.artist}</span>
                <Show when={currentSong()?.album}>
                  <small>{currentSong()?.album}</small>
                </Show>
              </div>
            </aside>
            <div class="lyrics-fullscreen-list" ref={setFullscreenList}>
              <div class="lyrics-fullscreen-picker">
                <LyricsPicker setStickRef={setStickRef} />
              </div>
              <For each={children()}>
                {(props, idx) => {
                  switch (props.kind) {
                    case 'LyricsPicker':
                      return null;
                    case 'Error':
                      return <ErrorDisplay {...props} />;
                    case 'LoadingKaomoji':
                      return <LoadingKaomoji />;
                    case 'NotFoundKaomoji':
                      return <NotFoundKaomoji />;
                    case 'SyncedLine':
                      return (
                        <div data-lyrics-index={idx()}>
                          <SyncedLine
                            {...props}
                            index={idx()}
                            scroller={scroller()!}
                            status={statuses()[idx()]}
                          />
                        </div>
                      );
                    case 'PlainLine':
                      return <PlainLyrics {...props} />;
                  }
                }}
              </For>
            </div>
            <div
              onMouseEnter={() => {
                setControlsHovered(true);
                showControls();
              }}
              onMouseLeave={() => {
                setControlsHovered(false);
                hideControls();
              }}
            >
              <FullscreenControls
                onMouseEnter={showControls}
                onMouseLeave={hideControls}
                visible={controlsVisible()}
              />
            </div>
          </div>
        </Portal>
      </Show>
    </Show>
  );
};
