const pesoFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

export function formatPesos(amount: number): string {
  return pesoFormatter.format(amount);
}

// Builds a wa.me deep link from whatever a staff member typed into a free-text
// phone field. Three screens used to each hardcode `54${digits}`, which
// double-prefixes (and breaks the link) whenever the number was already
// entered with the country code — the single most common way to type/paste
// an Argentine mobile number.
export function waLink(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  const withCountryCode = digits.startsWith('54') ? digits : `54${digits}`;
  return `https://wa.me/${withCountryCode}`;
}
