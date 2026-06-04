import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
  untrack,
} from 'solid-js';
import { type VirtualizerHandle, VList } from 'virtua/solid';

import { LyricsPicker } from './components/LyricsPicker';

import { selectors } from './utils';

import {
  ErrorDisplay,
  LoadingKaomoji,
  NotFoundKaomoji,
  SyncedLine,
  PlainLyrics,
} from './components';

import { currentLyrics, songCorrection } from './store';
import { translateLines } from './translation';
import { t } from '@/i18n';

import type { LineLyrics, SyncedLyricsPluginConfig } from '../types';

export const [isVisible, setIsVisible] = createSignal<boolean>(false);
export const [config, setConfig] =
  createSignal<SyncedLyricsPluginConfig | null>(null);

export const effectiveOffsetMs = createMemo(
  () => (config()?.offsetMs ?? 0) + (songCorrection().offsetMs ?? 0),
);

createEffect(() => {
  if (!config()?.enabled) {
    return;
  }

  const root = document.documentElement;
  const fontScale = config()?.fontScale ?? 1;
  root.style.setProperty('--lyrics-font-scale', String(fontScale));
  root.style.setProperty(
    '--lyrics-inactive-opacity',
    String(config()?.inactiveOpacity ?? 0.33),
  );
  root.style.setProperty(
    '--lyrics-active-scale',
    String(config()?.activeScale ?? 1),
  );
  root.style.setProperty(
    '--glow-strength',
    String(config()?.glowStrength ?? 0.5),
  );

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
      root.style.setProperty('--lyrics-inactive-offset', '0');
      root.style.setProperty('--lyrics-active-font-weight', '700');
      root.style.setProperty('--lyrics-active-opacity', '1');
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
      root.style.setProperty('--lyrics-inactive-scale', '1');
      root.style.setProperty('--lyrics-inactive-offset', '0');
      root.style.setProperty('--lyrics-active-font-weight', '700');
      root.style.setProperty('--lyrics-active-opacity', '1');
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
      root.style.setProperty('--lyrics-inactive-scale', '1');
      root.style.setProperty('--lyrics-inactive-offset', '0');
      root.style.setProperty('--lyrics-active-font-weight', '700');
      root.style.setProperty('--lyrics-active-opacity', '1');
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
      root.style.setProperty('--lyrics-inactive-scale', '1');
      root.style.setProperty('--lyrics-inactive-offset', '0');
      root.style.setProperty('--lyrics-active-font-weight', '700');
      root.style.setProperty('--lyrics-active-opacity', '1');
      root.style.setProperty('--lyrics-active-offset', '0');
      break;
  }
});

type LyricsRendererChild =
  | { kind: 'LyricsPicker' }
  | { kind: 'LoadingKaomoji' }
  | { kind: 'NotFoundKaomoji' }
  | { kind: 'Error'; error: Error }
  | {
      kind: 'SyncedLine';
      line: LineLyrics;
      translation?: string;
    }
  | {
      kind: 'PlainLine';
      line: string;
      translation?: string;
    };

const lyricsPicker: LyricsRendererChild = { kind: 'LyricsPicker' };

export const [currentTime, setCurrentTime] = createSignal<number>(-1);
export const LyricsRenderer = () => {
  const [scroller, setScroller] = createSignal<VirtualizerHandle>();
  const [stickyRef, setStickRef] = createSignal<HTMLElement | null>(null);
  const [translatedLines, setTranslatedLines] = createSignal<string[]>([]);

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

  createEffect(() => {
    const current = currentLyrics().data;
    const shouldTranslate = config()?.showTranslation;
    const target = config()?.translationTarget ?? 'app';

    if (!current || !shouldTranslate) {
      setTranslatedLines([]);
      return;
    }

    const sourceLines = current.lines?.length
      ? current.lines.map((line) => line.translation ?? line.text)
      : current.lyrics
        ? current.lyrics.split('\n').filter((line) => line.trim())
        : [];

    if (!sourceLines.length) {
      setTranslatedLines([]);
      return;
    }

    if (current.translatedLyrics?.length === sourceLines.length) {
      setTranslatedLines(current.translatedLyrics);
      return;
    }

    let active = true;
    translateLines(sourceLines, target).then((lines) => {
      if (active) {
        setTranslatedLines(lines);
      }
    });

    onCleanup(() => {
      active = false;
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
    const translation = translatedLines();

    setChildren(() => {
      if (state === 'fetching') {
        return [{ kind: 'LoadingKaomoji' }];
      }

      if (state === 'error') {
        return [{ kind: 'Error', error: error! }];
      }

      if (data?.lines) {
        return data.lines.map((line, index) => ({
          kind: 'SyncedLine' as const,
          line,
          translation: translation[index],
        }));
      }

      if (data?.lyrics) {
        const lines = data.lyrics.split('\n').filter((line) => line.trim());
        return lines.map((line, index) => ({
          kind: 'PlainLine' as const,
          line,
          translation: translation[index],
        }));
      }

      return [{ kind: 'NotFoundKaomoji' }];
    });
  });

  const [statuses, setStatuses] = createSignal<
    ('previous' | 'current' | 'upcoming')[]
  >([]);
  createEffect(() => {
    const time = currentTime() - effectiveOffsetMs();
    const data = currentLyrics()?.data;

    if (!data || !data.lines) {
      setStatuses([]);
      return;
    }

    const previous = untrack(statuses);
    const current = data.lines.map((line) => {
      if (line.timeInMs >= time) {
        return 'upcoming';
      }
      if (time - line.timeInMs >= line.duration) {
        return 'previous';
      }
      return 'current';
    });

    if (previous.length !== current.length) {
      setStatuses(current);
      return;
    }
    if (previous.every((status, idx) => status === current[idx])) {
      return;
    }

    setStatuses(current);
  });

  const [currentIndex, setCurrentIndex] = createSignal(0);
  createEffect(() => {
    const index = statuses().findIndex((status) => status === 'current');
    if (index === -1) {
      return;
    }
    setCurrentIndex(index);
  });

  createEffect(() => {
    const current = currentLyrics();
    const idx = currentIndex();
    const maxIdx = untrack(statuses).length - 1;
    const scrollMode = config()?.autoScrollMode ?? 'center';

    if (!scroller() || !current.data?.lines || scrollMode === 'manual') {
      return;
    }

    const scrollIndex = Math.min(idx + 1, maxIdx);

    scroller()!.scrollToIndex(scrollIndex, {
      smooth: true,
      align: scrollMode === 'upper-third' ? 'start' : 'center',
    });
  });

  const emptyMessage = createMemo(() => {
    const current = currentLyrics().data?.meta;
    if (!current) {
      return null;
    }

    if (current.inexact) {
      return t('plugins.synced-lyrics.warnings.inexact');
    }

    if (
      typeof current.durationDeltaMs === 'number' &&
      Math.abs(current.durationDeltaMs) > 4000
    ) {
      return t('plugins.synced-lyrics.warnings.duration-mismatch');
    }

    return null;
  });

  return (
    <Show when={isVisible()}>
      <div class="lyrics-renderer">
        <Show when={emptyMessage()}>
          {(message) => <div class="warning-lyrics">{message()}</div>}
        </Show>
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
            if (typeof props === 'undefined') {
              return null;
            }
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
              case 'PlainLine': {
                return <PlainLyrics {...props} />;
              }
            }
          }}
        </VList>
      </div>
    </Show>
  );
};
