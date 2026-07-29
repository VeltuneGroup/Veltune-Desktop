import { createEffect, createMemo, createSignal, For, Index, Show } from 'solid-js';

import { type VirtualizerHandle } from 'virtua/solid';

import {
  type LineLyrics,
  type WordLyrics,
} from '@/plugins/synced-lyrics/types';

import { config, currentTime, effectiveOffsetMs } from '../renderer';
import { _ytAPI } from '..';

import { canonicalize, romanize, simplifyUnicode } from '../utils';

interface SyncedLineProps {
  scroller: VirtualizerHandle;
  index: number;
  line: LineLyrics;
  status: 'upcoming' | 'current' | 'previous';
  translation?: string;
}

const getCharOpacity = (
  word: WordLyrics,
  charIndex: number,
  totalChars: number,
  status: SyncedLineProps['status'],
  now: number,
  leadMs: number,
): number => {
  if (status === 'previous') return 1;
  if (status === 'upcoming') return 0.28;

  const lineNow = now + leadMs - effectiveOffsetMs();
  if (word.duration <= 0) return lineNow >= word.timeInMs ? 1 : 0.28;

  const elapsed = lineNow - word.timeInMs;
  if (elapsed <= 0) return 0.28;

  const wordProgress = Math.min(1, Math.max(0, elapsed / word.duration));
  if (totalChars === 0) return 1;

  const charPos = charIndex / totalChars;
  const delta = wordProgress - charPos;

  if (delta <= 0) return 0.28;
  if (delta >= 0.15) return 1;
  return 0.28 + (delta / 0.15) * 0.72;
};

const EmptyLine = (props: SyncedLineProps) => {
  const states = createMemo(() => {
    const defaultText = config()?.defaultTextString ?? '';
    return Array.isArray(defaultText) ? defaultText : [defaultText];
  });

  const index = createMemo(() => {
    const progress = currentTime() - effectiveOffsetMs() - props.line.timeInMs;
    const total = props.line.duration;
    const percentage = Math.min(1, Math.max(0, progress / Math.max(total, 1)));
    return Math.max(0, Math.floor((states().length - 1) * percentage));
  });

  const isInstrumentalGap = createMemo(
    () => props.line.duration >= (config()?.gapIndicatorThresholdMs ?? 5000),
  );

  return (
    <div
      class={`synced-line ${props.status}`}
      onClick={() => {
        _ytAPI?.seekTo((props.line.timeInMs + 10) / 1000);
      }}
    >
      <div class="description ytmusic-description-shelf-renderer" dir="auto">
        <yt-formatted-string
          text={{
            runs: [
              {
                text: config()?.showTimeCodes ? `[${props.line.time}] ` : '',
              },
            ],
          }}
        />

        <div class="text-lyrics instrumental-gap">
          <span>
            <span>
              <Show
                fallback={
                  <yt-formatted-string
                    text={{ runs: [{ text: states()[0] }] }}
                  />
                }
                when={states().length > 1}
              >
                <yt-formatted-string
                  text={{
                    runs: [
                      {
                        text: states().at(
                          props.status === 'current' ? index() : -1,
                        )!,
                      },
                    ],
                  }}
                />
              </Show>
            </span>
          </span>
          <Show when={isInstrumentalGap()}>
            <span class="translation">Instrumental</span>
          </Show>
        </div>
      </div>
    </div>
  );
};

export const SyncedLine = (props: SyncedLineProps) => {
  const text = createMemo(() => props.line.text.trim());
  const words = createMemo(() => props.line.words ?? []);
  const wordLeadMs = createMemo(() => (props.line.isWordSynced ? 90 : 140));
  const lineProgress = createMemo(() => {
    const now =
      currentTime() + Math.min(wordLeadMs(), 90) - effectiveOffsetMs();
    const progress = now - props.line.timeInMs;
    return Math.min(
      1,
      Math.max(0, progress / Math.max(props.line.duration, 1)),
    );
  });

  const [romanization, setRomanization] = createSignal('');
  createEffect(() => {
    const input = canonicalize(text());
    if (!config()?.romanization) {
      return;
    }

    romanize(input).then((result) => {
      setRomanization(canonicalize(result));
    });
  });

  const translatedLine = createMemo(() => props.translation?.trim() ?? '');

  return (
    <Show fallback={<EmptyLine {...props} />} when={text()}>
      <div
        class={`synced-line ${props.status}`}
        onClick={() => {
          _ytAPI?.seekTo((props.line.timeInMs + 10) / 1000);
        }}
      >
        <div class="description ytmusic-description-shelf-renderer" dir="auto">
          <yt-formatted-string
            text={{
              runs: [
                {
                  text: config()?.showTimeCodes ? `[${props.line.time}] ` : '',
                },
              ],
            }}
          />

          <div
            class="text-lyrics"
            ref={(div: HTMLDivElement) => {
              div.style.setProperty(
                '--lyrics-duration',
                `${props.line.duration / 1000}s`,
                'important',
              );
            }}
            style={{
              'display': 'flex',
              'flex-direction': 'column',
              '--line-progress': `${lineProgress()}`,
            }}
          >
            <span class="word-line">
              <For each={words()}>
                {(word) => {
                  const chars = [...word.text];
                  return (
                    <span class="lyric-word">
                      <Index each={chars}>
                        {(char, i) => (
                          <span
                            class="lyric-char"
                            style={{
                              opacity: getCharOpacity(word, i, chars.length, props.status, currentTime(), wordLeadMs()),
                            }}
                          >
                            {char()}
                          </span>
                        )}
                      </Index>
                    </span>
                  );
                }}
              </For>
            </span>

            <Show when={config()?.showTranslation && translatedLine()}>
              <span class="translation">{translatedLine()}</span>
            </Show>

            <Show
              when={
                config()?.romanization &&
                simplifyUnicode(text()) !== simplifyUnicode(romanization())
              }
            >
              <span class="romaji">
                <For each={romanization().split(' ')}>
                  {(word, index) => {
                    return (
                      <span
                        class="lyric-word"
                        style={{
                          '--word-progress': `${
                            props.status === 'previous'
                              ? 1
                              : props.status === 'current'
                                ? Math.min(1, lineProgress() + index() * 0.03)
                                : 0
                          }`,
                        }}
                      >
                        <yt-formatted-string
                          text={{
                            runs: [{ text: `${word} ` }],
                          }}
                        />
                      </span>
                    );
                  }}
                </For>
              </span>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};
