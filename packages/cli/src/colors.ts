const enabled = process.stdout.isTTY ?? false;

function code(ansi: string): string {
  return enabled ? ansi : '';
}

export const RED = code('\x1b[31m');
export const YELLOW = code('\x1b[33m');
export const GREEN = code('\x1b[32m');
export const BLUE = code('\x1b[36m');
export const DIM = code('\x1b[2m');
export const BOLD = code('\x1b[1m');
export const RESET = code('\x1b[0m');
