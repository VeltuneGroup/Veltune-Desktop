import {
  createEffect,
  createMemo,
  createSignal,
  Index,
  Match,
  type Setter,
  Show,
  Switch,
} from 'solid-js';

import {
  providerNames,
  providerRegistry,
  type ProviderName,
  type ProviderState,
} from '../../providers';
import {
  clearSongCorrectionProvider,
  currentSongKey,
  currentLyrics,
  lyricsStore,
  saveSongCorrection,
  songCorrection,
  setLyricsStore,
} from '../store';
import { config, effectiveOffsetMs } from '../renderer';
import { formatConfidence, formatDurationDelta } from '../../helpers';

import type { YtIcons } from '@/types/icons';

export const providerIdx = createMemo(() =>
  providerNames.indexOf(lyricsStore.provider),
);

const hasLyrics = (providerData: ProviderState) =>
  providerData.state === 'done' &&
  Boolean(providerData.data?.lines || providerData.data?.lyrics);

const providerScore = (provider: ProviderName) => {
  const state = lyricsStore.lyrics[provider];
  const meta = state.data?.meta;
  let score = providerRegistry[provider].baseRank;

  if (state.state === 'error') {
    return -10_000;
  }

  if (hasLyrics(state)) {
    score += 120;
  }

  if (state.state === 'fetching') {
    score -= 25;
  }

  if (meta) {
    score += Math.round((meta.confidence ?? 0) * 100);
    score +=
      meta.qualityTier === 'word'
        ? 60
        : meta.qualityTier === 'synced'
          ? 35
          : meta.qualityTier === 'plain'
            ? 10
            : 0;
    score += meta.exact ? 25 : -10;
    score -= Math.round(Math.abs(meta.durationDeltaMs ?? 0) / 250);
  }

  if (config()?.preferredProvider === provider && hasLyrics(state)) {
    score += 180;
  }

  if (songCorrection().provider === provider && hasLyrics(state)) {
    score += 260;
  }

  return score;
};

const pickBestProvider = () => {
  const corrected = songCorrection().provider;
  if (corrected && hasLyrics(lyricsStore.lyrics[corrected])) {
    return { provider: corrected, force: true };
  }

  const preferred = config()?.preferredProvider;
  if (preferred && hasLyrics(lyricsStore.lyrics[preferred])) {
    return { provider: preferred, force: true };
  }

  const providers = Array.from(providerNames).sort(
    (left, right) => providerScore(right) - providerScore(left),
  );

  return { provider: providers[0], force: false };
};

export const LyricsPicker = (props: {
  setStickRef: Setter<HTMLElement | null>;
}) => {
  const savedProvider = createMemo(() => songCorrection().provider ?? null);
  const [hasManuallySwitchedProvider, setHasManuallySwitchedProvider] =
    createSignal(false);

  createEffect(() => {
    currentSongKey();
    setHasManuallySwitchedProvider(false);
  });

  createEffect(() => {
    if (hasManuallySwitchedProvider()) {
      return;
    }

    const { provider, force } = pickBestProvider();
    if (
      force ||
      providerScore(lyricsStore.provider) < providerScore(provider)
    ) {
      setLyricsStore('provider', provider);
    }
  });

  const next = () => {
    setHasManuallySwitchedProvider(true);
    setLyricsStore('provider', (prevProvider) => {
      const idx = providerNames.indexOf(prevProvider);
      return providerNames[(idx + 1) % providerNames.length];
    });
  };

  const previous = () => {
    setHasManuallySwitchedProvider(true);
    setLyricsStore('provider', (prevProvider) => {
      const idx = providerNames.indexOf(prevProvider);
      return providerNames[
        (idx + providerNames.length - 1) % providerNames.length
      ];
    });
  };

  const selectProvider = (provider: ProviderName) => {
    setHasManuallySwitchedProvider(true);
    setLyricsStore('provider', provider);
  };

  const toggleSaveProvider = () => {
    if (savedProvider() === lyricsStore.provider) {
      clearSongCorrectionProvider();
      return;
    }

    saveSongCorrection({ provider: lyricsStore.provider });
  };

  const nudgeOffset = (delta: number) => {
    saveSongCorrection({ offsetMs: (songCorrection().offsetMs ?? 0) + delta });
  };

  const resetOffset = () => {
    saveSongCorrection({ offsetMs: 0 });
  };

  const currentMeta = createMemo(() => currentLyrics().data?.meta);

  const chevronLeft: YtIcons = 'yt-icons:chevron_left';
  const chevronRight: YtIcons = 'yt-icons:chevron_right';

  const successIcon: YtIcons = 'yt-icons:check-circle';
  const errorIcon: YtIcons = 'yt-icons:error';
  const notFoundIcon: YtIcons = 'yt-icons:warning';

  return (
    <div class="lyrics-picker" ref={props.setStickRef}>
      <div class="lyrics-picker-left">
        <yt-icon-button
          class="style-scope ytmusic-player-bar"
          icon={chevronLeft}
          onClick={previous}
          role={'button'}
        >
          <span class="yt-icon-shape style-scope yt-icon yt-spec-icon-shape">
            <div
              style={{
                'width': '100%',
                'height': '100%',
                'display': 'flex',
                'align-items': 'center',
                'fill': 'currentcolor',
              }}
            >
              <svg
                class="style-scope yt-icon"
                fill="#FFFFFF"
                height={'40px'}
                preserveAspectRatio="xMidYMid meet"
                viewBox="0 -960 960 960"
                width={'40px'}
              >
                <g class="style-scope yt-icon">
                  <path
                    class="style-scope yt-icon"
                    d="M560.67-240 320-480.67l240.67-240.66L608-674 414.67-480.67 608-287.33 560.67-240Z"
                  />
                </g>
              </svg>
            </div>
          </span>
        </yt-icon-button>
      </div>

      <div class="lyrics-picker-content">
        <div class="lyrics-picker-content-label">
          <Index each={providerNames}>
            {(provider) => {
              const state = createMemo(() => lyricsStore.lyrics[provider()]);
              const meta = createMemo(() => state().data?.meta);

              return (
                <div
                  class="lyrics-picker-item"
                  style={{
                    transform: `translateX(${Math.imul(providerIdx(), -100) - 5}%)`,
                  }}
                  tabindex="-1"
                >
                  <div class="lyrics-picker-provider-header">
                    <Switch>
                      <Match when={state().state === 'fetching'}>
                        <tp-yt-paper-spinner-lite
                          active
                          class="loading-indicator style-scope"
                          style={{ padding: '5px', transform: 'scale(0.5)' }}
                          tabindex="-1"
                        />
                      </Match>
                      <Match when={state().state === 'error'}>
                        <yt-icon
                          icon={errorIcon}
                          style={{ padding: '5px', transform: 'scale(0.8)' }}
                          tabindex="-1"
                        />
                      </Match>
                      <Match when={hasLyrics(state())}>
                        <yt-icon
                          icon={successIcon}
                          style={{ padding: '5px', transform: 'scale(0.8)' }}
                          tabindex="-1"
                        />
                      </Match>
                      <Match
                        when={
                          state().state === 'done' &&
                          !state().data?.lines &&
                          !state().data?.lyrics
                        }
                      >
                        <yt-icon
                          icon={notFoundIcon}
                          style={{ padding: '5px', transform: 'scale(0.8)' }}
                          tabindex="-1"
                        />
                      </Match>
                    </Switch>
                    <yt-formatted-string
                      class="description ytmusic-description-shelf-renderer"
                      text={{ runs: [{ text: provider() }] }}
                    />
                    <yt-icon
                      icon={
                        savedProvider() === provider()
                          ? 'yt-sys-icons:star-filled'
                          : 'yt-sys-icons:star'
                      }
                      onClick={toggleSaveProvider}
                      style={{
                        padding: '5px',
                        transform: 'scale(0.8)',
                        cursor: 'pointer',
                      }}
                      tabindex="-1"
                    />
                  </div>
                  <div class="lyrics-picker-badges">
                    <Show when={meta()?.qualityTier}>
                      <span class="lyrics-picker-badge">
                        {meta()?.qualityTier}
                      </span>
                    </Show>
                    <Show when={meta()?.sourceQuality}>
                      <span class="lyrics-picker-badge">
                        {meta()?.sourceQuality}
                      </span>
                    </Show>
                    <Show when={meta()}>
                      <span class="lyrics-picker-badge">
                        {meta()?.exact ? 'exact' : 'fuzzy'}
                      </span>
                    </Show>
                    <Show when={meta()?.hasTranslation}>
                      <span class="lyrics-picker-badge">dual</span>
                    </Show>
                    <Show when={meta()?.hasWordTimings}>
                      <span class="lyrics-picker-badge">karaoke</span>
                    </Show>
                  </div>
                  <div class="lyrics-picker-details">
                    <span>
                      Confidence {formatConfidence(meta()?.confidence)}
                    </span>
                    <span>
                      Δ {formatDurationDelta(meta()?.durationDeltaMs)}
                    </span>
                  </div>
                  <Show when={meta()?.preview}>
                    <div class="lyrics-picker-preview">{meta()?.preview}</div>
                  </Show>
                </div>
              );
            }}
          </Index>
        </div>

        <ul class="lyrics-picker-content-dots">
          <Index each={providerNames}>
            {(_, idx) => (
              <li
                class="lyrics-picker-dot"
                onClick={() => selectProvider(providerNames[idx])}
                style={{
                  background: idx === providerIdx() ? 'white' : 'black',
                }}
              />
            )}
          </Index>
        </ul>

        <div class="lyrics-picker-offset-controls">
          <button
            class="lyrics-offset-button"
            onClick={() => nudgeOffset(-500)}
          >
            -500ms
          </button>
          <button
            class="lyrics-offset-button"
            onClick={() => nudgeOffset(-100)}
          >
            -100ms
          </button>
          <button class="lyrics-offset-button" onClick={resetOffset}>
            Reset
          </button>
          <button class="lyrics-offset-button" onClick={() => nudgeOffset(100)}>
            +100ms
          </button>
          <button class="lyrics-offset-button" onClick={() => nudgeOffset(500)}>
            +500ms
          </button>
        </div>

        <div class="lyrics-picker-offset-value">
          Song offset {songCorrection().offsetMs ?? 0}ms · Effective{' '}
          {effectiveOffsetMs()}ms
        </div>

        <Show when={currentMeta()}>
          <div class="lyrics-picker-summary">
            <span class="lyrics-picker-badge">
              {currentMeta()!.inexact ? 'Needs review' : 'Matched'}
            </span>
            <span class="lyrics-picker-badge">
              {currentMeta()?.matchedBy?.join(', ') || 'provider score'}
            </span>
          </div>
        </Show>
      </div>

      <div class="lyrics-picker-right">
        <yt-icon-button
          class="style-scope ytmusic-player-bar"
          icon={chevronRight}
          onClick={next}
          role={'button'}
        >
          <span class="yt-icon-shape style-scope yt-icon yt-spec-icon-shape">
            <div
              style={{
                'width': '100%',
                'height': '100%',
                'display': 'flex',
                'align-items': 'center',
                'fill': 'currentcolor',
              }}
            >
              <svg
                class="style-scope yt-icon"
                fill="#FFFFFF"
                height={'40px'}
                preserveAspectRatio="xMidYMid meet"
                viewBox="0 -960 960 960"
                width={'40px'}
              >
                <g class="style-scope yt-icon">
                  <path
                    class="style-scope yt-icon"
                    d="m399.33-207.33-47.33-47.34L545.33-448 352-641.33l47.33-47.34L640-448 399.33-207.33Z"
                  />
                </g>
              </svg>
            </div>
          </span>
        </yt-icon-button>
      </div>
    </div>
  );
};
