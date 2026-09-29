import { Icon, type IconName } from './Icon';

interface Props {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  return (
    <div className="empty" role="status">
      <div className="empty__icon">
        <Icon name={icon} size={20} />
      </div>
      <div className="empty__title">{title}</div>
      <div className="empty__message">{message}</div>
      {actionLabel && onAction && (
        <button className="pill-button" data-nodrag onClick={onAction} type="button">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
