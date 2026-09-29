import { useEffect } from 'react';
import type { Notice } from '@shared/types/ipc';
import { appStore } from '../stores/appStore';

export function Toast({ notice }: { notice: Notice | null }) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => appStore.dismissNotice(notice.id), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <div className="toast" data-level={notice.level} role="status">
      {notice.message}
    </div>
  );
}
