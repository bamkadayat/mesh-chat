/** Use a short name in message headers 
 *  while keeping full names in the participant list. */
export function firstName(displayName: string): string {
  const [first] = displayName.trim().split(/\s+/);
  return first === undefined || first === '' ? displayName : first;
}
