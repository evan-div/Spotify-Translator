import type { LyricLensApi } from '@shared/types/ipc';

declare global {
  interface Window {
    lyricLens: LyricLensApi;
  }
}

export {};
