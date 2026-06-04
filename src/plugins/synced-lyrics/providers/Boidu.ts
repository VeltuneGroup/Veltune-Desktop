import { TTML } from '../parsers/ttml';

import type { LyricProvider, LyricResult, SearchSongInfo } from '../types';

export class Boidu implements LyricProvider {
  name = 'Boidu';
  baseUrl = 'https://lyrics-api.boidu.dev';

  async search({ artist, title }: SearchSongInfo): Promise<LyricResult | null> {
    const query = new URLSearchParams({
      a: artist,
      s: title,
    });

    const url = `${this.baseUrl}/getLyrics?${query.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      // Uncached queries return 401/403 or similar if no API key
      return null;
    }

    const data = (await response.json()) as BoiduLyricsResponse;
    if (!data.ttml) {
      return null;
    }

    const lines = TTML.parse(data.ttml);

    return {
      title,
      artists: [artist],
      lines,
    };
  }
}

type BoiduLyricsResponse = {
  ttml?: string;
  error?: string;
  message?: string;
};
