let counter = 0;

export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export function resetIds(start = 0): void {
  counter = start;
}
