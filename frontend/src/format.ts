const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export const formatPrice = (value: number): string => currency.format(value);
export const formatDate = (iso: string): string => date.format(new Date(iso));

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  PAID: 'Payée',
  CANCELED: 'Annulée',
};
