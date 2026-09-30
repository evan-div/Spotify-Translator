import type { SVGProps } from 'react';

export type IconName =
  | 'lock'
  | 'unlock'
  | 'pointer'
  | 'gear'
  | 'eye-off'
  | 'compact'
  | 'music'
  | 'pause'
  | 'spotify'
  | 'search'
  | 'alert'
  | 'mic'
  | 'globe'
  | 'check'
  | 'context'
  | 'star'
  | 'trash'
  | 'close'
  | 'book';

const PATHS: Record<IconName, string> = {
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z',
  unlock: 'M7 11V8a5 5 0 0 1 9.5-2.2M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z',
  pointer: 'M6 4l12 6.5-5 1.6-2 5.4L6 4z',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5l1.6 1.2-1.6 2.8-1.9-.6a7 7 0 0 1-1.6.9L15.5 19h-3.1l-.4-1.2a7 7 0 0 1-1.6-.9l-1.9.6-1.6-2.8 1.5-1.2a7 7 0 0 1 0-1.8L6.9 10.5l1.6-2.8 1.9.6a7 7 0 0 1 1.6-.9L12.4 5.2h3.1l.4 1.2a7 7 0 0 1 1.6.9l1.9-.6 1.6 2.8-1.5 1.2a7 7 0 0 1 0 1.8z',
  'eye-off': 'M4 5l16 14M9.9 5.2A9.5 9.5 0 0 1 12 5c5 0 8.5 4.3 9.5 7a11 11 0 0 1-2.6 3.7M6.3 7.3A11 11 0 0 0 2.5 12c1 2.7 4.5 7 9.5 7a9.6 9.6 0 0 0 3.7-.7M10 10a3 3 0 0 0 4 4',
  compact: 'M5 9h14M5 15h14',
  context: 'M6 6h12M8 12h8M6 18h12',
  music: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  pause: 'M8 5v14M16 5v14',
  spotify: 'M4 9.5c5-1.5 11-1.2 16 1.5M5 13c4.2-1.1 9-.8 13 1.3M6.2 16.4c3.3-.8 6.6-.5 9.6.9M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  alert: 'M12 8v5M12 16.5v.01M10.3 4.5L3.5 17a2 2 0 0 0 1.7 3h13.6a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0z',
  mic: 'M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zM6 11.5a6 6 0 0 0 12 0M12 17.5V21',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9S9.5 5.7 12 3z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  star: 'M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.6z',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5',
  close: 'M6 6l12 12M18 6L6 18',
  book: 'M5 4.5h9a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5zM17 8h2v12h-2M8 9h6',
};

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
