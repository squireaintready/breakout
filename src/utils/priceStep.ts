/** Compute a step value so the browser arrows increment the 2nd-to-last digit. */
export function priceStep(value: string): string {
  const dot = value.indexOf('.');
  if (dot < 0) return '1';
  const decimals = value.length - dot - 1;
  if (decimals <= 1) return '1';
  return Math.pow(10, -(decimals - 1)).toFixed(decimals - 1);
}
