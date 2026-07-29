import type { SongInfo } from '@/providers/song-info';
import type { ProviderName } from './providers';

export type TranslationTarget =
  | 'app'
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'ja'
  | 'ko'
  | 'pt';

export type AutoScrollMode = 'center' | 'upper-third' | 'manual';

export type SyncedLyricsPluginConfig = {
  enabled: boolean;
  preferredProvider?: ProviderName;
  preciseTiming: boolean;
  showTimeCodes: boolean;
  defaultTextString: string | string[];
  showLyricsEvenIfInexact: boolean;
  lineEffect: LineEffect;
  romanization: boolean;
  offsetMs: number;
  showTranslation: boolean;
  translationTarget: TranslationTarget;
  autoScrollMode: AutoScrollMode;
  fontScale: number;
  inactiveOpacity: number;
  activeScale: number;
  glowStrength: number;
  gapIndicatorThresholdMs: number;
  leadMs: number;
};

export type LineLyricsStatus = 'previous' | 'current' | 'upcoming';

export type WordLyrics = {
  text: string;
  timeInMs: number;
  duration: number;
};

export type LineLyrics = {
  time: string;
  timeInMs: number;
  duration: number;
  text: string;
  translation?: string;
  words?: WordLyrics[];
  isWordSynced?: boolean;
  status: LineLyricsStatus;
};

export type LineEffect = 'fancy' | 'scale' | 'offset' | 'focus';

export type LyricSourceQuality = 'excellent' | 'good' | 'fair' | 'basic';
export type LyricQualityTier = 'word' | 'synced' | 'plain' | 'none';

export type LyricResultMeta = {
  provider: ProviderName;
  confidence: number;
  exact: boolean;
  inexact: boolean;
  sourceQuality: LyricSourceQuality;
  qualityTier: LyricQualityTier;
  durationDeltaMs: number | null;
  hasWordTimings: boolean;
  hasSyncedLyrics: boolean;
  hasPlainLyrics: boolean;
  hasTranslation: boolean;
  matchedBy: string[];
  fallbackUsed: boolean;
  preview: string;
};

export interface LyricResult {
  title: string;
  artists: string[];
  lyrics?: string;
  lines?: LineLyrics[];
  translatedLyrics?: string[];
  meta?: Partial<LyricResultMeta>;
}

export type SongCorrection = {
  provider?: ProviderName;
  offsetMs?: number;
  updatedAt: number;
};

export interface LyricProvider {
  name: string;
  baseUrl: string;
  search(songInfo: SearchSongInfo): Promise<LyricResult | null>;
}

export type SearchSongInfo = Pick<
  SongInfo,
  | 'title'
  | 'alternativeTitle'
  | 'artist'
  | 'album'
  | 'songDuration'
  | 'videoId'
  | 'tags'
>;
