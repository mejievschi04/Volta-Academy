import { STORAGE_ORIGIN } from '../config';

export function toImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const origin = STORAGE_ORIGIN;
  if (!origin) return trimmed;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${origin}${trimmed}`;
  return `${origin}/${trimmed.replace(/^\/+/, '')}`;
}

