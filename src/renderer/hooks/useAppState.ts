import { useSyncExternalStore } from 'react';
import { appStore, type AppState } from '../stores/appStore';

/** Subscribes to one slice of app state; re-renders only when that slice's reference changes. */
export function useAppSelector<T>(selector: (state: AppState) => T): T {
  return useSyncExternalStore(appStore.subscribe, () => selector(appStore.get()));
}
