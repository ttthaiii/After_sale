/**
 * Formats a date to DD/MM/YYYY (Christian Year) format.
 * Returns '-' if the input is empty or invalid.
 */
export const formatDate = (dateInput: Date | string | number | null | undefined): string => {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
};

/**
 * Formats a date to DD/MM/YYYY HH:MM (Christian Year) format.
 * Returns '-' if the input is empty or invalid.
 */
export const formatDateTime = (dateInput: Date | string | number | null | undefined): string => {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
};
