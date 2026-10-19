/**
 * File transfers for the web build, where `expo-file-system` (native streaming
 * upload/download) is not available. The browser already holds a picked file
 * as a `Blob`, so uploads are plain `fetch` calls and downloads go through an
 * object URL. Results use the same `{ status, body }` shape as the native
 * `File.upload`, so callers share their response handling.
 *
 * Platform-free (fetch and the document are injected) so it is unit tested
 * in Node.
 */
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TransferResult {
  status: number;
  body: string;
}

async function toResult(response: Response): Promise<TransferResult> {
  return { status: response.status, body: await response.text() };
}

/** `multipart/form-data` with the file under `fieldName` (the API upload). */
export async function uploadMultipart(
  fetchImpl: FetchLike,
  url: string,
  blob: Blob,
  options: {
    filename: string;
    fieldName?: string;
    headers?: Record<string, string>;
  },
): Promise<TransferResult> {
  // React Native's `FormData` typing has no (name, blob, filename) overload;
  // this runs only in a browser, whose `FormData` does.
  const form = new FormData() as unknown as {
    append(name: string, value: Blob, filename: string): void;
  };
  form.append(options.fieldName ?? 'file', blob, options.filename);
  // No Content-Type: the browser adds the multipart boundary itself.
  return toResult(
    await fetchImpl(url, {
      method: 'POST',
      headers: options.headers,
      body: form as unknown as RequestInit['body'],
    }),
  );
}

/** The raw bytes as the body (the Matrix media upload). */
export async function uploadBinary(
  fetchImpl: FetchLike,
  url: string,
  blob: Blob,
  options: { mimeType: string; headers?: Record<string, string> },
): Promise<TransferResult> {
  return toResult(
    await fetchImpl(url, {
      method: 'POST',
      headers: { ...options.headers, 'Content-Type': options.mimeType },
      body: blob,
    }),
  );
}

/** Fetches with auth headers (which an `<a href>` cannot send). */
export async function fetchBlob(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string>,
): Promise<Blob> {
  const response = await fetchImpl(url, { headers });
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  return response.blob();
}

export interface DownloadDocument {
  createElement(tag: 'a'): {
    href: string;
    download: string;
    rel: string;
    click(): void;
  };
}

export interface ObjectUrls {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

/** Hands the blob to the browser's own download (the web "share sheet"). */
export function saveBlob(
  doc: DownloadDocument,
  urls: ObjectUrls,
  blob: Blob,
  filename: string,
  schedule: (run: () => void) => void = (run) => setTimeout(run, 60_000),
): void {
  const url = urls.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.click();
  // Revoked later: some browsers read the URL after `click` returns.
  schedule(() => urls.revokeObjectURL(url));
}
