export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** First validation message from an API error, else its message, else `fallback`. */
export function errorMessage(err: unknown, fallback: string): string {
  const e = err as {
    response?: {
      data?: { message?: string; errors?: Record<string, string[]> };
    };
  };
  const first =
    e.response?.data?.errors && Object.values(e.response.data.errors)[0]?.[0];
  return first ?? e.response?.data?.message ?? fallback;
}

export const formatDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
