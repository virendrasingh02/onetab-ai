import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pdfjsLib } from './pdf-worker.js';

export type PdfDocumentStatus = 'loading' | 'ready' | 'error' | 'password';

export interface UsePdfDocumentResult {
  doc: PDFDocumentProxy | null;
  numPages: number;
  status: PdfDocumentStatus;
  error?: string;
  /** Retries the current load with a password — call again on a wrong
   * attempt, pdf.js re-prompts via the same in-flight load. */
  submitPassword: (password: string) => void;
}

/**
 * Loads one PDF document via pdf.js. A password-protected file is handled
 * entirely through pdf.js's own `onPassword` callback contract — that
 * callback retries decryption on the *same* loading task, so a wrong
 * password re-prompts instead of restarting the whole load.
 */
export function usePdfDocument(url: string | undefined): UsePdfDocumentResult {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [status, setStatus] = useState<PdfDocumentStatus>('loading');
  const [error, setError] = useState<string>();
  const passwordCallbackRef = useRef<((password: string) => void) | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    passwordCallbackRef.current = null;
    setStatus('loading');
    setError(undefined);
    setDoc(null);
    setNumPages(0);

    const loadingTask = pdfjsLib.getDocument({ url });

    // `onPassword` is a property to assign on the loading task, not a
    // constructor option — pdf.js calls it (potentially more than once, on
    // each wrong attempt) with a callback to submit the next try through.
    loadingTask.onPassword = (callback: (password: string) => void, reason: number) => {
      passwordCallbackRef.current = callback;
      if (cancelled) return;
      setStatus('password');
      setError(
        reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD
          ? 'Incorrect password. Try again.'
          : undefined,
      );
    };

    loadingTask.promise
      .then((pdf) => {
        if (cancelled) return;
        setDoc(pdf);
        setNumPages(pdf.numPages);
        setStatus('ready');
        setError(undefined);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(
          err instanceof Error
            ? err.message
            : 'This document could not be opened.',
        );
      });

    return () => {
      cancelled = true;
      passwordCallbackRef.current = null;
      void loadingTask.destroy();
    };
  }, [url]);

  return {
    doc,
    numPages,
    status,
    error,
    submitPassword: (password) => passwordCallbackRef.current?.(password),
  };
}
