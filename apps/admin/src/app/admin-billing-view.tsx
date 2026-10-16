import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminBillingApi } from '@org/api-client';
import {
  PLAN_TIERS,
  type FreeCheckoutPolicy,
  type PlanBillingInterval,
  type PlanTier,
  type PromotionDto,
  type SavePromotionInput,
} from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Page,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@org/ui';
import { formatDateTime } from '@org/utils';
import { Download, Pencil, Plus, Receipt } from 'lucide-react';

const money = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-success/15 text-success-text border-success/25',
  TRIALING: 'bg-sky-500/15 text-sky-500 border-sky-500/25',
  PAST_DUE: 'bg-amber-500/15 text-amber-500 border-amber-500/25',
  UNPAID: 'bg-destructive/15 text-destructive border-destructive/25',
  EXHAUSTED: 'bg-amber-500/15 text-amber-500 border-amber-500/25',
  EXPIRED: 'bg-muted text-muted-foreground border-border',
  INACTIVE: 'bg-muted text-muted-foreground border-border',
  SCHEDULED: 'bg-sky-500/15 text-sky-500 border-sky-500/25',
  PAID: 'bg-success/15 text-success-text border-success/25',
};

function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
        STATUS_STYLE[value] ?? 'bg-muted text-muted-foreground border-border'
      }`}
    >
      {value.replace('_', ' ')}
    </span>
  );
}

async function download(kind: 'subscriptions' | 'invoices') {
  try {
    const blob = await adminBillingApi.exportCsv(kind);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${kind}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Export failed.');
  }
}

/* ------------------------------------------------------------- overview --- */

function OverviewTab() {
  const stats = useQuery({ queryKey: ['admin-billing', 'stats'], queryFn: () => adminBillingApi.stats() });
  if (stats.isLoading) return <LoadingState />;
  if (stats.isError || !stats.data) return <ErrorState onRetry={() => stats.refetch()} />;
  const s = stats.data;
  const tiles = [
    { label: 'Paid revenue (30d)', value: money(s.paidRevenueCents), note: `${s.paidInvoiceCount} paid invoices` },
    { label: 'Estimated MRR', value: money(s.estimatedMrrCents), note: s.estimatedMrrNote },
    { label: 'Failed-payment subscriptions', value: String(s.failedPaymentSubscriptions), note: 'Past due or unpaid now' },
    { label: 'Subscriptions ended (30d)', value: String(s.subscriptionsEnded), note: 'Returned to Free' },
    {
      label: 'Trial conversion (30d)',
      value: s.trialConversionRate == null ? '—' : `${Math.round(s.trialConversionRate * 100)}%`,
      note: `${s.trialsConverted} of ${s.trialsStarted} trials`,
    },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{t.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t.note}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground mb-3">Workspaces by plan</p>
        <div className="flex flex-wrap gap-3">
          {s.subscriptionsByPlan.map((p) => (
            <div key={p.plan} className="rounded-lg border border-border px-3 py-2 text-xs">
              <span className="font-semibold uppercase">{p.plan}</span>
              <span className="ml-2 text-muted-foreground">{p.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- coupons --- */

type CouponForm = {
  code: string;
  name: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: string;
  applicablePlans: PlanTier[];
  applicableIntervals: PlanBillingInterval[];
  minPurchaseCents: string;
  firstTimeCustomerOnly: boolean;
  trialExtensionDays: string;
  freeCheckoutPolicy: FreeCheckoutPolicy;
  validFrom: string;
  validUntil: string;
  maxRedemptions: string;
  perUserLimit: string;
  active: boolean;
};

const emptyForm: CouponForm = {
  code: '',
  name: '',
  discountType: 'PERCENTAGE',
  discountValue: '10',
  applicablePlans: ['pro', 'max'],
  applicableIntervals: [],
  minPurchaseCents: '',
  firstTimeCustomerOnly: false,
  trialExtensionDays: '',
  freeCheckoutPolicy: 'DISABLED',
  validFrom: '',
  validUntil: '',
  maxRedemptions: '',
  perUserLimit: '1',
  active: true,
};

const toLocalInput = (iso?: string | null) => (iso ? iso.slice(0, 16) : '');

function fromCoupon(c: PromotionDto): CouponForm {
  return {
    code: c.code,
    name: c.name ?? '',
    discountType: c.discountType,
    discountValue: String(c.discountValue),
    applicablePlans: c.applicablePlans,
    applicableIntervals: c.applicableIntervals,
    minPurchaseCents: c.minPurchaseCents == null ? '' : String(c.minPurchaseCents),
    firstTimeCustomerOnly: c.firstTimeCustomerOnly,
    trialExtensionDays: c.trialExtensionDays == null ? '' : String(c.trialExtensionDays),
    freeCheckoutPolicy: c.freeCheckoutPolicy,
    validFrom: toLocalInput(c.validFrom),
    validUntil: toLocalInput(c.validUntil),
    maxRedemptions: c.maxRedemptions == null ? '' : String(c.maxRedemptions),
    perUserLimit: String(c.perUserLimit),
    active: c.active,
  };
}

function toInput(f: CouponForm, isNew: boolean): SavePromotionInput {
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  return {
    code: f.code,
    name: f.name || null,
    discountType: f.discountType,
    discountValue: Number(f.discountValue),
    applicablePlans: f.applicablePlans,
    applicableIntervals: f.applicableIntervals,
    minPurchaseCents: num(f.minPurchaseCents),
    firstTimeCustomerOnly: f.firstTimeCustomerOnly,
    trialExtensionDays: num(f.trialExtensionDays),
    freeCheckoutPolicy: f.freeCheckoutPolicy,
    ...(f.validFrom || isNew ? { validFrom: f.validFrom ? new Date(f.validFrom).toISOString() : null } : {}),
    validUntil: f.validUntil ? new Date(f.validUntil).toISOString() : null,
    maxRedemptions: num(f.maxRedemptions),
    perUserLimit: Number(f.perUserLimit) || 1,
    active: f.active,
  };
}

function CouponDialog({
  coupon,
  open,
  onOpenChange,
}: {
  coupon: PromotionDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isNew = !coupon;
  const [form, setForm] = useState<CouponForm>(coupon ? fromCoupon(coupon) : emptyForm);
  const set = <K extends keyof CouponForm>(k: K, v: CouponForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const togglePlan = (p: PlanTier) =>
    set('applicablePlans', form.applicablePlans.includes(p) ? form.applicablePlans.filter((x) => x !== p) : [...form.applicablePlans, p]);
  const toggleInterval = (i: PlanBillingInterval) =>
    set('applicableIntervals', form.applicableIntervals.includes(i) ? form.applicableIntervals.filter((x) => x !== i) : [...form.applicableIntervals, i]);

  const save = useMutation({
    mutationFn: () => adminBillingApi.saveCoupon(toInput(form, isNew)),
    onSuccess: () => {
      toast.success('Coupon saved.');
      void queryClient.invalidateQueries({ queryKey: ['admin-billing'] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const field = 'space-y-1.5';
  const label = 'text-xs font-medium text-foreground';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New coupon' : `Edit ${coupon.code}`}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={field}>
              <label className={label} htmlFor="c-code">Code</label>
              <Input id="c-code" value={form.code} disabled={!isNew} onChange={(e) => set('code', e.target.value.toUpperCase())} className="font-mono" />
            </div>
            <div className={field}>
              <label className={label} htmlFor="c-name">Internal name</label>
              <Input id="c-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className={field}>
              <label className={label}>Discount type</label>
              <Select value={form.discountType} onValueChange={(v) => set('discountType', v as CouponForm['discountType'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  <SelectItem value="FIXED">Fixed amount (cents)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <label className={label} htmlFor="c-value">{form.discountType === 'PERCENTAGE' ? 'Percent off (0–100)' : 'Amount off (cents, USD)'}</label>
              <Input id="c-value" type="number" min={0} value={form.discountValue} onChange={(e) => set('discountValue', e.target.value)} />
            </div>
            <div className={field}>
              <label className={label} htmlFor="c-from">Starts</label>
              <Input id="c-from" type="datetime-local" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
            </div>
            <div className={field}>
              <label className={label} htmlFor="c-until">Expires</label>
              <Input id="c-until" type="datetime-local" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} />
            </div>
            <div className={field}>
              <label className={label} htmlFor="c-max">Total redemptions (blank = unlimited)</label>
              <Input id="c-max" type="number" min={1} value={form.maxRedemptions} onChange={(e) => set('maxRedemptions', e.target.value)} />
            </div>
            <div className={field}>
              <label className={label} htmlFor="c-user">Per-user limit</label>
              <Input id="c-user" type="number" min={1} value={form.perUserLimit} onChange={(e) => set('perUserLimit', e.target.value)} />
            </div>
            <div className={field}>
              <label className={label} htmlFor="c-min">Minimum purchase (cents)</label>
              <Input id="c-min" type="number" min={0} value={form.minPurchaseCents} onChange={(e) => set('minPurchaseCents', e.target.value)} />
            </div>
            <div className={field}>
              <label className={label} htmlFor="c-trial">Extra trial days</label>
              <Input id="c-trial" type="number" min={0} value={form.trialExtensionDays} onChange={(e) => set('trialExtensionDays', e.target.value)} />
            </div>
          </div>

          <div className={field}>
            <span className={label}>Eligible plans</span>
            <div className="flex flex-wrap gap-2">
              {PLAN_TIERS.filter((p) => p !== 'free' && p !== 'enterprise').map((p) => (
                <Button key={p} type="button" size="sm" variant={form.applicablePlans.includes(p) ? 'primary' : 'outline'} onClick={() => togglePlan(p)} aria-pressed={form.applicablePlans.includes(p)}>
                  {p.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <div className={field}>
            <span className={label}>Eligible billing intervals (none selected = all)</span>
            <div className="flex gap-2">
              {(['monthly', 'annual'] as PlanBillingInterval[]).map((i) => (
                <Button key={i} type="button" size="sm" variant={form.applicableIntervals.includes(i) ? 'primary' : 'outline'} onClick={() => toggleInterval(i)} aria-pressed={form.applicableIntervals.includes(i)}>
                  {i}
                </Button>
              ))}
            </div>
          </div>

          <div className={field}>
            <label className={label}>Fully-discounted checkout without a payment provider</label>
            <Select value={form.freeCheckoutPolicy} onValueChange={(v) => set('freeCheckoutPolicy', v as FreeCheckoutPolicy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DISABLED">Disabled — payment provider always required</SelectItem>
                <SelectItem value="TEST_ONLY">Test mode only</SelectItem>
                <SelectItem value="APPROVED">Approved for production (use sparingly)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              With a payment provider configured, a $0 total still goes through the provider. This only governs deployments with no provider.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-xs text-foreground">First-time customers only</span>
            <Switch checked={form.firstTimeCustomerOnly} onCheckedChange={(v) => set('firstTimeCustomerOnly', v)} aria-label="First-time customers only" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <span className="text-xs text-foreground">Active</span>
            <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} aria-label="Active" />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" disabled={save.isPending || !form.code.trim()} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save coupon'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CouponsTab() {
  const coupons = useQuery({ queryKey: ['admin-billing', 'coupons'], queryFn: adminBillingApi.coupons });
  const [editing, setEditing] = useState<PromotionDto | null>(null);
  const [creating, setCreating] = useState(false);

  if (coupons.isLoading) return <LoadingState />;
  if (coupons.isError) return <ErrorState onRetry={() => coupons.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="primary" className="gap-1.5" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> New coupon
        </Button>
      </div>
      {coupons.data && coupons.data.length > 0 ? (
        <div className="rounded-xl border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Plans</TableHead>
                <TableHead>Redemptions</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><span className="sr-only">Edit</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs font-semibold">{c.code}</TableCell>
                  <TableCell className="text-xs">
                    {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : money(c.discountValue, c.currency)}
                  </TableCell>
                  <TableCell className="text-xs">{c.applicablePlans.join(', ')}</TableCell>
                  <TableCell className="text-xs">
                    {c.redemptionsCount}
                    {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ''}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.validUntil ? `until ${formatDateTime(c.validUntil)}` : 'no expiry'}
                  </TableCell>
                  <TableCell><StatusPill value={c.status} /></TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" aria-label={`Edit ${c.code}`} onClick={() => setEditing(c)}>
                      <Pencil className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState title="No coupons yet" description="Create one to offer discounts at checkout." />
      )}
      {editing && <CouponDialog key={editing.id} coupon={editing} open onOpenChange={(o) => !o && setEditing(null)} />}
      {creating && <CouponDialog key="new" coupon={null} open onOpenChange={(o) => !o && setCreating(false)} />}
    </div>
  );
}

/* ---------------------------------------------------------- subscriptions --- */

function SubscriptionsTab() {
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['admin-billing', 'subs', search, plan, status, page],
    queryFn: () =>
      adminBillingApi.subscriptions({
        search: search || undefined,
        plan: plan === 'all' ? undefined : plan,
        status: status === 'all' ? undefined : status,
        page,
      }),
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search workspace…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="max-w-xs h-9 text-xs" aria-label="Search workspaces" />
        <Select value={plan} onValueChange={(v) => { setPlan(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {PLAN_TIERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {['ACTIVE', 'TRIALING', 'PAST_DUE', 'UNPAID', 'CANCELLED', 'EXPIRED'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => void download('subscriptions')}>
          <Download className="size-3.5" /> CSV
        </Button>
      </div>
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data && q.data.items.length > 0 ? (
        <>
          <div className="rounded-xl border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Period ends</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.items.map((s) => (
                  <TableRow key={s.workspaceId}>
                    <TableCell className="text-xs font-medium">{s.workspaceName}</TableCell>
                    <TableCell className="text-xs uppercase">{s.plan} · {s.billingInterval}</TableCell>
                    <TableCell><StatusPill value={s.status} /></TableCell>
                    <TableCell className="text-xs">{s.source}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(s.currentPeriodEnd)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[s.cancelAtPeriodEnd ? 'cancelling' : null, s.scheduledPlanTier ? `→ ${s.scheduledPlanTier}` : null, s.appliedPromotionCode].filter(Boolean).join(' · ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{q.data.total} total</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page * q.data.pageSize >= q.data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState title="No subscriptions match" />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- invoices --- */

function InvoicesTab() {
  const [status, setStatus] = useState('all');
  const q = useQuery({
    queryKey: ['admin-billing', 'invoices', status],
    queryFn: () => adminBillingApi.invoices({ status: status === 'all' ? undefined : status }),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {['PAID', 'OPEN', 'REFUNDED', 'VOID', 'UNCOLLECTIBLE'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => void download('invoices')}>
          <Download className="size-3.5" /> CSV
        </Button>
      </div>
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data && q.data.items.length > 0 ? (
        <div className="rounded-xl border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.number}</TableCell>
                  <TableCell className="text-xs">{i.workspaceName}</TableCell>
                  <TableCell className="text-xs font-semibold">{money(i.amountCents, i.currency)}</TableCell>
                  <TableCell><StatusPill value={i.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(i.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={<Receipt />} title="No invoices" />
      )}
    </div>
  );
}

function AuditTab() {
  const q = useQuery({ queryKey: ['admin-billing', 'audit'], queryFn: () => adminBillingApi.audit({ take: 100 }) });
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <EmptyState title="No audit entries yet" />;
  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Actor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.data.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</TableCell>
              <TableCell><Badge variant="secondary" className="font-mono text-[10px]">{e.action}</Badge></TableCell>
              <TableCell className="text-xs">{e.targetType}{e.targetId ? ` · ${e.targetId}` : ''}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{e.actorId ?? 'system'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AdminBillingView() {
  return (
    <Page>
      <PageHeader
        title="Billing & Coupons"
        description="Revenue from recorded invoices, coupons, subscriptions and billing audit trail."
      />
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="coupons"><CouponsTab /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsTab /></TabsContent>
        <TabsContent value="invoices"><InvoicesTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </Page>
  );
}
