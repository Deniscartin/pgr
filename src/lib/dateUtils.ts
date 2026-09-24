// Le date di carico arrivano dall'OCR come stringhe libere: nel DB convivono
// "17/11/2025", "15/10/2025 13:28:00", "2026-03-18" e parecchio rumore
// ("07/10/2025'", "23/05/2026378", "27"). Le tabelle mostrano quel valore
// grezzo, quindi il filtro per data deve saperlo normalizzare.

const pad = (n: number) => String(n).padStart(2, '0');

const toIso = (day: number, month: number, year: number): string | null => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Anno a due cifre: "08/01/26" -> 2026.
  const fullYear = year < 100 ? 2000 + year : year;
  if (fullYear < 1900 || fullYear > 2200) return null;

  const date = new Date(fullYear, month - 1, day);
  // Scarta i giorni inesistenti (es. 31/02): il costruttore li fa slittare.
  if (date.getFullYear() !== fullYear || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return `${fullYear}-${pad(month)}-${pad(day)}`;
};

/**
 * Normalizza una data documentale in formato `YYYY-MM-DD`, confrontabile con i
 * valori degli input `type="date"`. Restituisce `null` se la stringa non
 * contiene una data riconoscibile.
 */
export function parseDocumentDate(value: string | undefined | null): string | null {
  if (!value) return null;

  const text = String(value).trim();
  if (!text) return null;

  // Formato ISO (anche annidato in una stringa più lunga): 2026-03-18, 2025/10/07.
  const iso = text.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (iso) {
    const parsed = toIso(Number(iso[3]), Number(iso[2]), Number(iso[1]));
    if (parsed) return parsed;
  }

  // Formato italiano giorno-primo: 17/11/2025, 1-10-25, 04/12/2025 08:41:00.
  // `\d{2,4}` evita di agganciare l'anno troncato di "23/05/2026378".
  const itaFull = text.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?!\d)/);
  if (itaFull) {
    const parsed = toIso(Number(itaFull[1]), Number(itaFull[2]), Number(itaFull[3]));
    if (parsed) return parsed;
  }

  return null;
}
