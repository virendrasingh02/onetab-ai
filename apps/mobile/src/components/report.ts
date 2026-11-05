import { safetyApi } from '@org/api-client';
import type { CreateContentReportInput } from '@org/validation';
import { Alert } from '../lib/alert';
import { REPORT_REASONS } from '../lib/safety-core';
import { showActionSheet } from './action-sheet';

export type ReportTarget = Omit<CreateContentReportInput, 'reason' | 'details'>;

/** Asks why, files the report and confirms it. Works for people, chat and AI output. */
export function showReportSheet(target: ReportTarget): void {
  showActionSheet({
    title: 'Why are you reporting this?',
    options: REPORT_REASONS.map((reason) => ({
      label: reason.label,
      onPress: () => {
        safetyApi
          .report({ ...target, reason: reason.value })
          .then(() =>
            Alert.alert(
              'Report sent',
              'Thanks. Our team reviews every report and acts on content that breaks the rules.',
            ),
          )
          .catch((error: unknown) =>
            Alert.alert(
              'Report not sent',
              error instanceof Error ? error.message : 'Try again.',
            ),
          );
      },
    })),
  });
}
