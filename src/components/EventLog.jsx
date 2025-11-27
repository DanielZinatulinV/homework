import React from 'react';

export const formatClock = (timestamp) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);

export const formatDuration = (seconds, options = {}) => {
  const { compact = false, showDays = true } = options;
  const totalSeconds = Math.max(0, Math.round(seconds));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (compact && !showDays) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  const parts = [];
  if (showDays && days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
};

export const formatDetail = (event) => {
  if (event.type === 'seek' && typeof event.from === 'number' && typeof event.to === 'number') {
    const fromSeconds = Math.round(event.from);
    const toSeconds = Math.round(event.to);
    const fromDays = Math.floor(fromSeconds / 86400);
    const toDays = Math.floor(toSeconds / 86400);
    
    const sameDay = fromDays === toDays && fromDays > 0;
    
    const fromStr = sameDay 
      ? formatDuration(event.from, { compact: true, showDays: false })
      : formatDuration(event.from);
    const toStr = sameDay
      ? formatDuration(event.to, { compact: true, showDays: false })
      : formatDuration(event.to);
    
    return `${fromStr} → ${toStr}`;
  }

  if (typeof event.position === 'number') {
    return `at ${formatDuration(event.position)}`;
  }

  return 'pending position';
};

export default function EventLog({ events }) {
  if (!events.length) {
    return (
      <div className="banner" data-testid="empty-log">
        <div>
          <strong>Watching for interactions</strong>
          <div style={{ color: 'var(--muted)' }}>Play, pause, and seek actions will appear here.</div>
        </div>
      </div>
    );
  }

  return (
    <ul className="log-list" data-testid="event-log">
      {events.map((event) => (
        <li key={event.id} className="log-entry">
          <strong>{event.type.toUpperCase()}</strong>
          <span>
            {formatClock(event.at)} • {formatDetail(event)}
          </span>
        </li>
      ))}
    </ul>
  );
}
