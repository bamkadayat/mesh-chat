/** Timestamps show as 09:21, matching the mockup. Invalid input renders nothing. */
export function formatTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
