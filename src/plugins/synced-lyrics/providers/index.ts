import * as z from 'zod';

import type { LyricResult } from '../types';

export enum ProviderNames {
  YTMusic = 'YTMusic',
  LRCLib = 'LRCLib',
  MusixMatch = 'MusixMatch',
  LyricsGenius = 'LyricsGenius',
  Boidu = 'BetterLyrics',
}

export const ProviderNameSchema = z.enum(ProviderNames);
export type ProviderName = z.infer<typeof ProviderNameSchema>;
export const providerNames = ProviderNameSchema.options;

export const providerRegistry = {
  [ProviderNames.YTMusic]: {
    tier: 4,
    baseRank: 95,
    sourceQuality: 'excellent',
  },
  [ProviderNames.LRCLib]: {
    tier: 3,
    baseRank: 82,
    sourceQuality: 'good',
  },
  [ProviderNames.MusixMatch]: {
    tier: 3,
    baseRank: 80,
    sourceQuality: 'good',
  },
  [ProviderNames.Boidu]: {
    tier: 2,
    baseRank: 68,
    sourceQuality: 'fair',
  },
  [ProviderNames.LyricsGenius]: {
    tier: 1,
    baseRank: 52,
    sourceQuality: 'basic',
  },
} as const;

export type ProviderState = {
  state: 'fetching' | 'done' | 'error';
  data: LyricResult | null;
  error: Error | null;
};
