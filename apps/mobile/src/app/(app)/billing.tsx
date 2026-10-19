import { billingApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import {
  AppText,
  Badge,
  Card,
  Divider,
  ListRow,
  ProgressBar,
  QueryBoundary,
  Screen,
  SectionHeader,
} from '../../components/ui';
import { formatLimit, humanize, statusTone } from '../../lib/format';
import { useWorkspace } from '../../lib/workspace';
import { spacing } from '../../theme/tokens';

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * Plan, limits and invoices — read-only.
 *
 * Purchases deliberately do not happen in the app: App Store and Google Play
 * rules forbid steering to an external checkout for digital services from
 * inside a store app, so plan changes stay with a workspace admin on the web.
 */
export default function BillingScreen() {
  const { workspaceId } = useWorkspace();

  const summary = useQuery({
    queryKey: queryKeys.billing.summary(workspaceId),
    queryFn: () => billingApi.summary(workspaceId),
  });
  const invoices = useQuery({
    queryKey: queryKeys.billing.invoices(workspaceId),
    queryFn: () => billingApi.invoices(workspaceId),
    enabled: Boolean(summary.data?.canManageBilling),
  });

  return (
    <Screen
      refreshing={summary.isRefetching}
      onRefresh={() =>
        void Promise.all([summary.refetch(), invoices.refetch()])
      }
    >
      <QueryBoundary query={summary} loadingLabel="Loading plan…">
        {(s) => (
          <>
            <Card>
              <View style={styles.row}>
                <AppText variant="title">{s.planConfig.name}</AppText>
                {s.subscription ? (
                  <Badge
                    label={humanize(s.subscription.status)}
                    tone={statusTone(s.subscription.status)}
                  />
                ) : null}
              </View>
              <AppText variant="muted">{s.planConfig.tagline}</AppText>
              {s.subscription?.currentPeriodEnd ? (
                <AppText variant="caption">
                  {s.subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'}{' '}
                  {new Date(
                    s.subscription.currentPeriodEnd,
                  ).toLocaleDateString()}
                </AppText>
              ) : null}
              {s.subscription?.trialEnd &&
              s.subscription.trialStatus === 'ACTIVE' ? (
                <AppText variant="caption">
                  Trial ends{' '}
                  {new Date(s.subscription.trialEnd).toLocaleDateString()}
                </AppText>
              ) : null}
              <AppText variant="caption">
                AI credit balance: {s.creditAccount.balance.toLocaleString()}{' '}
                {s.creditAccount.currency}
              </AppText>
            </Card>

            <SectionHeader title="Usage limits" />
            <Card>
              {Object.values(s.usage).map((metric) => (
                <View key={metric.key} style={styles.metric}>
                  <View style={styles.row}>
                    <AppText variant="body">{metric.label}</AppText>
                    <AppText variant="caption">
                      {formatLimit(metric.used, metric.limit, metric.unit)}
                    </AppText>
                  </View>
                  {metric.limit > 0 ? (
                    <ProgressBar
                      value={metric.percentage / 100}
                      tone={
                        metric.isLimitReached
                          ? 'danger'
                          : metric.isNearLimit
                            ? 'warning'
                            : 'success'
                      }
                    />
                  ) : null}
                </View>
              ))}
            </Card>

            <AppText variant="caption">
              {s.canManageBilling
                ? 'To change plan, payment method or seats, use Billing in the Onetab AI web app.'
                : 'Ask a workspace admin to change the plan.'}
            </AppText>

            {s.canManageBilling ? (
              <>
                <SectionHeader title="Invoices" />
                <QueryBoundary query={invoices}>
                  {(list) => (
                    <Card style={{ paddingVertical: 4 }}>
                      {list.length === 0 ? (
                        <AppText variant="muted">No invoices yet.</AppText>
                      ) : (
                        list.map((invoice, index) => (
                          <View key={invoice.id}>
                            {index > 0 ? <Divider /> : null}
                            <ListRow
                              title={`${invoice.invoiceNumber} · ${money(invoice.amountCents, invoice.currency)}`}
                              subtitle={`${new Date(invoice.periodStart).toLocaleDateString()} – ${new Date(invoice.periodEnd).toLocaleDateString()}`}
                              right={
                                <Badge
                                  label={humanize(invoice.status)}
                                  tone={
                                    invoice.status === 'PAID'
                                      ? 'success'
                                      : 'warning'
                                  }
                                />
                              }
                            />
                          </View>
                        ))
                      )}
                    </Card>
                  )}
                </QueryBoundary>
              </>
            ) : null}
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metric: { gap: spacing.xs, paddingVertical: spacing.xs },
});
