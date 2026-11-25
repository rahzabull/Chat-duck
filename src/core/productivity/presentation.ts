import { localDate, type Reminder } from './types';

/** Shared by confirmations and cards; always plain English with minute precision. */
export function reminderLabel(r: Reminder, now = new Date()): string {
  const date = new Date(r.state === 'due' && r.lastFiredAt ? r.lastFiredAt : r.snoozedUntil ?? r.at);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const when = localDate(date) === localDate(now) ? 'Today' : localDate(date) === localDate(tomorrow) ? 'Tomorrow'
    : `${weekdays[date.getDay()].slice(0, 3)} ${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const rule = r.recurrence;
  if (rule?.kind === 'interval') {
    const n = rule.intervalMinutes!;
    const cadence = n % 60 === 0 ? `Every ${n / 60 === 1 ? 'hour' : `${n / 60} hours`}` : `Every ${n} minutes`;
    const clock = (value: string) => { const [h, m] = value.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
    return cadence + (rule.window ? `, ${clock(rule.window.start)}–${clock(rule.window.end)}` : '');
  }
  const repeat = rule?.kind === 'daily' ? 'Every day' : rule?.kind === 'weekly' ? `Every ${rule.weekdays!.map(n => weekdays[n]).join(', ')}`
    : rule?.kind === 'monthly' ? `Every month, day ${rule.dayOfMonth} (last day if shorter)` : rule?.kind === 'custom' ? `Every ${rule.intervalDays} days` : '';
  if (repeat && r.state === 'scheduled' && !r.snoozedUntil) return `${repeat}, ${time}`;
  return `${r.snoozedUntil ? 'Snoozed until ' : ''}${when}, ${time}${repeat ? ` · ${repeat}` : ''}`;
}
