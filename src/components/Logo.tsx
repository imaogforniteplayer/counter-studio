import { useId } from 'react';

/** The Tickwell mark: four tally strokes crossed by a slash, on a warm gradient tile. */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  const id = `logo-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="Tickwell">
      <defs>
        <linearGradient id={id} x1="8" y1="4" x2="58" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ff4d5e" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <g stroke="#fff8f0" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M17 18v28" />
        <path d="M26.5 18v28" />
        <path d="M36 18v28" />
        <path d="M45.5 18v28" />
        <path d="M10.5 40 53.5 24" stroke="#0b0b0e" strokeOpacity=".85" strokeWidth="4.5" />
      </g>
    </svg>
  );
}
