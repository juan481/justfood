const pesoFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function formatPesos(amount: number): string {
  return pesoFormatter.format(amount);
}
