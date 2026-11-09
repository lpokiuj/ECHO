import { Transform } from 'class-transformer';

// Public POSTs: 5 requests per 10 minutes per IP, per endpoint (see the controllers)
export const PUBLIC_POST_LIMIT = 5;
export const PUBLIC_POST_WINDOW_MS = 10 * 60 * 1000;

// Response of both public POSTs. Never echoes stored data.
export const SUBMISSION_ACCEPTED = { ok: true } as const;

// Trims strings for validation; other types pass through and fail their validators.
export const TrimText = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

// Like TrimText, but a blank string counts as "not sent" so @IsOptional skips it.
export const OptionalText = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });

// ValidationPipe may hand the handler the raw body, so services normalize again.
export function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

// Honeypot: any real value in the hidden `website` field means a bot filled it.
export function isHoneypotFilled(website: unknown): boolean {
  if (typeof website === 'string') return website.trim() !== '';
  return Boolean(website);
}
