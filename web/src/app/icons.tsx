import type { SVGProps } from 'react';

// Minimal inline stroke icons (no external icon assets — agent-rules: assets).
const base: SVGProps<SVGSVGElement> = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function SubjectsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19a1 1 0 0 1 1 1v13" />
      <path d="M6 4v16" />
      <path d="M4 18.5A1.5 1.5 0 0 1 5.5 17H20" />
    </svg>
  );
}

export function GraphIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <circle cx="6" cy="7" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="16" cy="18" r="2.4" />
      <path d="M8.1 8.3l6 7.6M8.3 6.6l7.3-.4" />
    </svg>
  );
}

export function ReviewsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v4h-4" />
      <path d="M12 8v4l2.5 1.5" />
    </svg>
  );
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M4.2 7l2.2 1.3M17.6 15.7L19.8 17M4.2 17l2.2-1.3M17.6 8.3L19.8 7" />
    </svg>
  );
}
