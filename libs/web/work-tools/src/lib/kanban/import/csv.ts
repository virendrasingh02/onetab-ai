/**
 * A small RFC 4180 reader.
 *
 * Every tool in the import list exports descriptions inline, so rows routinely
 * carry quoted commas and embedded newlines — a `split(',')` shreds roughly
 * every third row of a real Linear or Jira export. This walks the text once,
 * tracking quote state, which is the only way to get those rows back intact.
 */

export interface CsvTable {
  headers: string[];
  rows: string[][];
  /** Normalised header → every column index carrying that header. */
  index: Map<string, number[]>;
  delimiter: string;
}

/**
 * Headers are matched loosely because the same field is spelled differently by
 * every exporter: `Due Date`, `due_date`, and `DueDate` all collapse to one key.
 */
export function normalizeHeader(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const DELIMITERS = [',', ';', '\t', '|'];

/**
 * Counts candidate delimiters across the first unquoted line. Excel in a
 * European locale writes `;`, and a few exporters offer TSV, so guessing beats
 * hard-coding a comma.
 */
function sniffDelimiter(text: string): string {
  const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]));
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') i += 1;
        else quoted = false;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === '\n' || char === '\r') break;
    const seen = counts.get(char);
    if (seen !== undefined) counts.set(char, seen + 1);
  }

  let best = ',';
  let bestCount = 0;
  for (const [delimiter, count] of counts) {
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/** Splits `text` into raw rows, honouring quotes, `""` escapes, and CRLF. */
function readRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  // Distinguishes a trailing `a,b,` (three fields) from a file ending in a
  // newline (no extra row), which an emptiness check alone cannot do.
  let pending = false;

  const endField = () => {
    row.push(field);
    field = '';
    pending = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      pending = true;
      continue;
    }
    if (char === delimiter) {
      endField();
      pending = true;
      continue;
    }
    if (char === '\r') {
      // Bare CR is a line ending on legacy Mac exports; CRLF is one break.
      if (text[i + 1] === '\n') i += 1;
      endRow();
      continue;
    }
    if (char === '\n') {
      endRow();
      continue;
    }

    field += char;
    pending = true;
  }

  if (pending || field !== '' || row.length > 0) endRow();

  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ''));
}

export function parseCsv(text: string): CsvTable {
  // A BOM survives most exports and would otherwise glue itself to the first
  // header, so the first column never matches by name.
  const clean = text.replace(/^\uFEFF/, '');
  const delimiter = sniffDelimiter(clean);
  const rows = readRows(clean, delimiter);

  if (rows.length === 0) {
    return { headers: [], rows: [], index: new Map(), delimiter };
  }

  const headers = rows[0].map((header) => header.trim());
  const index = new Map<string, number[]>();

  headers.forEach((header, position) => {
    const key = normalizeHeader(header);
    if (!key) return;
    const existing = index.get(key);
    // Jira repeats `Labels` and `Comment` once per value rather than joining
    // them, so a header maps to a list of columns, not a single one.
    if (existing) existing.push(position);
    else index.set(key, [position]);
  });

  return { headers, rows: rows.slice(1), index, delimiter };
}

/** Every non-empty value under any of `names`, across repeated columns. */
export function cellValues(
  table: CsvTable,
  row: string[],
  names: readonly string[],
): string[] {
  const values: string[] = [];
  for (const name of names) {
    for (const position of table.index.get(normalizeHeader(name)) ?? []) {
      const value = (row[position] ?? '').trim();
      if (value) values.push(value);
    }
  }
  return values;
}

/** The first non-empty value under any of `names`, or `''`. */
export function cellValue(
  table: CsvTable,
  row: string[],
  names: readonly string[],
): string {
  return cellValues(table, row, names)[0] ?? '';
}

export function hasColumn(
  table: CsvTable,
  names: readonly string[],
): boolean {
  return names.some((name) => table.index.has(normalizeHeader(name)));
}
