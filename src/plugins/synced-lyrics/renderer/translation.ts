import { detect } from 'tinyld';

const cache = new Map<string, Promise<string>>();

const normalizeTargetLanguage = (target: string) => {
  if (target === 'app') {
    return (navigator.language || 'en').split('-')[0] || 'en';
  }

  return target;
};

const translateLine = async (line: string, target: string) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return line;
  }

  const normalizedTarget = normalizeTargetLanguage(target);
  if (detect(trimmed) === normalizedTarget) {
    return line;
  }

  const key = `${normalizedTarget}::${trimmed}`;
  if (!cache.has(key)) {
    const query = new URLSearchParams({
      client: 'gtx',
      sl: 'auto',
      tl: normalizedTarget,
      dt: 't',
      q: trimmed,
    }).toString();

    cache.set(
      key,
      fetch(`https://translate.googleapis.com/translate_a/single?${query}`)
        .then((response) => response.json())
        .then((data: unknown) => {
          if (!Array.isArray(data) || !Array.isArray(data[0])) {
            return line;
          }

          return (
            data[0]
              .map((entry: unknown) => {
                if (Array.isArray(entry) && typeof entry[0] === 'string') {
                  return entry[0];
                }

                return '';
              })
              .join('') || line
          );
        })
        .catch(() => line),
    );
  }

  return cache.get(key)!;
};

export const translateLines = (lines: string[], target: string) =>
  Promise.all(lines.map((line) => translateLine(line, target)));
