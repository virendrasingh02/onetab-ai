import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailCard,
  EmailHeading,
  EmailText,
} from '../../components/index.js';

export const BILLING_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'BILLING_TRIAL_STARTED',
    name: 'Trial Started',
    category: 'BILLING',
    description: 'Welcome email when a user or workspace activates a free trial.',
    subject: 'Your free trial of {{billing.plan || "Pro"}} has started!',
    previewText: 'Enjoy {{trialDays || "14"}} days of full access.',
    htmlBody: `
      ${EmailHeading('Welcome to your {{billing.plan || "Pro"}} trial! 🎉')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('Your {{trialDays || "14"}}-day free trial has started. You now have access to premium features including unlimited AI agent runs, custom integrations, and team workspaces.')}
      ${EmailCard([
        { label: 'Plan', value: '{{billing.plan || "Pro"}}' },
        { label: 'Trial Ends', value: '{{formatDate trialEndsAt}}' },
      ])}
      ${EmailButton('Explore Pro Features', '{{dashboardUrl || "http://localhost:4200"}}')}
    `,
    textBody: `Your free trial of {{billing.plan || "Pro"}} has started!\n\nTrial ends: {{formatDate trialEndsAt}}.\n\nExplore: {{dashboardUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'billing.plan', type: 'string', description: 'Plan name', sampleValue: 'Pro' },
        { name: 'trialEndsAt', type: 'date', description: 'Trial end date', sampleValue: '2026-10-21T00:00:00Z' },
      ],
      samplePayload: { billing: { plan: 'Pro' }, trialEndsAt: '2026-10-21T00:00:00Z', dashboardUrl: 'https://app.onetab.ai' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_TRIAL_ENDING',
    name: 'Trial Ending Soon',
    category: 'BILLING',
    description: 'Reminder sent 3 days before trial expiration.',
    subject: 'Your {{billing.plan || "Pro"}} trial ends in {{daysLeft || "3"}} days',
    previewText: 'Add a payment method to avoid service interruption.',
    htmlBody: `
      ${EmailHeading('Your trial is ending soon')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailAlert('Your free trial of {{billing.plan || "Pro"}} ends on {{formatDate trialEndsAt}}.', 'warning')}
      ${EmailText('To maintain continuous access to your workspaces, agents, and data, please add a payment method:')}
      ${EmailButton('Set Up Billing', '{{billing.paymentUrl || "http://localhost:4200/settings/billing"}}')}
    `,
    textBody: `Your trial of {{billing.plan || "Pro"}} ends on {{formatDate trialEndsAt}}.\n\nSet up billing: {{billing.paymentUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'billing.plan', type: 'string', description: 'Plan name', sampleValue: 'Pro' },
        { name: 'trialEndsAt', type: 'date', description: 'Expiration date', sampleValue: '2026-10-18T00:00:00Z' },
        { name: 'billing.paymentUrl', type: 'url', description: 'Billing page URL' },
      ],
      samplePayload: { billing: { plan: 'Pro', paymentUrl: 'https://app.onetab.ai/settings/billing' }, trialEndsAt: '2026-10-18T00:00:00Z' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_TRIAL_EXPIRED',
    name: 'Trial Expired',
    category: 'BILLING',
    description: 'Notice sent when a free trial ends without active subscription.',
    subject: 'Your {{billing.plan || "Pro"}} trial has expired',
    previewText: 'Your account has been switched to the Free tier.',
    htmlBody: `
      ${EmailHeading('Your trial has expired')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('Your free trial of {{billing.plan || "Pro"}} has ended and your account was switched to the Free tier. Your data remains secure.')}
      ${EmailButton('Upgrade to Pro', '{{billing.paymentUrl || "http://localhost:4200/settings/billing"}}')}
    `,
    textBody: `Your trial of {{billing.plan || "Pro"}} has expired. Upgrade anytime at: {{billing.paymentUrl}}`,
    variablesSchema: {
      variables: [{ name: 'billing.plan', type: 'string', description: 'Plan', sampleValue: 'Pro' }],
      samplePayload: { billing: { plan: 'Pro', paymentUrl: 'https://app.onetab.ai/settings/billing' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_SUBSCRIPTION_STARTED',
    name: 'Subscription Started',
    category: 'BILLING',
    description: 'Welcome and receipt email when a paid subscription starts.',
    subject: 'Thank you for subscribing to {{billing.plan}}!',
    previewText: 'Your subscription is active.',
    htmlBody: `
      ${EmailHeading('Subscription Active 🎉')}
      ${EmailText('Thank you for subscribing to <strong>{{billing.plan}}</strong>!')}
      ${EmailCard([
        { label: 'Plan', value: '{{billing.plan}}' },
        { label: 'Billing Period', value: '{{billing.billingPeriod || "Monthly"}}' },
        { label: 'Amount', value: '{{formatCurrency billing.amount billing.currency}}' },
      ])}
      ${EmailButton('Manage Subscription', '{{billing.invoiceUrl || "http://localhost:4200/settings/billing"}}')}
    `,
    textBody: `Thank you for subscribing to {{billing.plan}}!\nAmount: {{formatCurrency billing.amount billing.currency}} / {{billing.billingPeriod}}\n\nManage: {{billing.invoiceUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'billing.plan', type: 'string', description: 'Plan name', sampleValue: 'Pro Team' },
        { name: 'billing.amount', type: 'currency', description: 'Subscription amount', sampleValue: 49 },
        { name: 'billing.currency', type: 'string', description: 'Currency', sampleValue: 'USD' },
      ],
      samplePayload: { billing: { plan: 'Pro Team', amount: 49, currency: 'USD', billingPeriod: 'Monthly' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_SUBSCRIPTION_UPGRADED',
    name: 'Subscription Upgraded',
    category: 'BILLING',
    description: 'Confirmation when plan is upgraded to higher tier.',
    subject: 'Your plan has been upgraded to {{billing.plan}}',
    previewText: 'You now have access to {{billing.plan}} features.',
    htmlBody: `
      ${EmailHeading('Plan Upgraded 🚀')}
      ${EmailAlert('Your subscription was successfully upgraded to {{billing.plan}}.', 'success')}
      ${EmailText('Your prorated invoice has been calculated and charged.')}
      ${EmailButton('View Account', '{{billing.invoiceUrl || "http://localhost:4200/settings/billing"}}')}
    `,
    textBody: `Your plan has been upgraded to {{billing.plan}}!\n\nView: {{billing.invoiceUrl}}`,
    variablesSchema: {
      variables: [{ name: 'billing.plan', type: 'string', description: 'New plan', sampleValue: 'Enterprise' }],
      samplePayload: { billing: { plan: 'Enterprise', invoiceUrl: 'https://app.onetab.ai/settings/billing' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_SUBSCRIPTION_DOWNGRADED',
    name: 'Subscription Downgraded',
    category: 'BILLING',
    description: 'Notice when plan is scheduled to downgrade at the end of the term.',
    subject: 'Your plan will change to {{billing.plan}} on {{formatDate nextBillingDate}}',
    previewText: 'Plan change confirmation.',
    htmlBody: `
      ${EmailHeading('Plan Downgrade Scheduled')}
      ${EmailText('Your plan will change to <strong>{{billing.plan}}</strong> at the end of your current cycle on {{formatDate nextBillingDate}}.')}
      ${EmailText('You will continue to have full access to your existing plan until that date.')}
    `,
    textBody: `Your plan will change to {{billing.plan}} on {{formatDate nextBillingDate}}.`,
    variablesSchema: {
      variables: [
        { name: 'billing.plan', type: 'string', description: 'Plan', sampleValue: 'Starter' },
        { name: 'nextBillingDate', type: 'date', description: 'Date', sampleValue: '2026-11-01T00:00:00Z' },
      ],
      samplePayload: { billing: { plan: 'Starter' }, nextBillingDate: '2026-11-01T00:00:00Z' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_SUBSCRIPTION_CANCELLED',
    name: 'Subscription Cancelled',
    category: 'BILLING',
    description: 'Notice when auto-renew is turned off.',
    subject: 'Your subscription has been cancelled',
    previewText: 'Auto-renewal was disabled for {{billing.plan}}.',
    htmlBody: `
      ${EmailHeading('Subscription Cancelled')}
      ${EmailText('Auto-renewal for your <strong>{{billing.plan}}</strong> subscription has been cancelled.')}
      ${EmailText('You will retain access through {{formatDate accessEndDate}}.')}
      ${EmailButton('Reactivate Subscription', '{{billing.paymentUrl || "http://localhost:4200/settings/billing"}}')}
    `,
    textBody: `Your subscription to {{billing.plan}} has been cancelled. Access ends {{formatDate accessEndDate}}.\n\nReactivate: {{billing.paymentUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'billing.plan', type: 'string', description: 'Plan', sampleValue: 'Pro' },
        { name: 'accessEndDate', type: 'date', description: 'End date', sampleValue: '2026-11-01T00:00:00Z' },
      ],
      samplePayload: { billing: { plan: 'Pro', paymentUrl: 'https://app.onetab.ai/settings/billing' }, accessEndDate: '2026-11-01T00:00:00Z' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_PAYMENT_SUCCESSFUL',
    name: 'Payment Successful',
    category: 'BILLING',
    description: 'Payment receipt for renewal or one-time charge.',
    subject: 'Payment receipt: {{formatCurrency billing.amount billing.currency}} for {{billing.plan}}',
    previewText: 'Payment successful for invoice #{{billing.invoiceNumber}}.',
    htmlBody: `
      ${EmailHeading('Payment Receipt 🧾')}
      ${EmailAlert('Payment of {{formatCurrency billing.amount billing.currency}} was successful.', 'success')}
      ${EmailCard([
        { label: 'Invoice #', value: '{{billing.invoiceNumber}}' },
        { label: 'Amount', value: '{{formatCurrency billing.amount billing.currency}}' },
        { label: 'Date', value: '{{formatDate paymentDate}}' },
      ])}
      ${EmailButton('Download Invoice PDF', '{{billing.invoiceUrl || "http://localhost:4200/settings/billing"}}')}
    `,
    textBody: `Payment receipt: {{formatCurrency billing.amount billing.currency}} for invoice #{{billing.invoiceNumber}}.\n\nDownload: {{billing.invoiceUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'billing.amount', type: 'currency', description: 'Amount', sampleValue: 49 },
        { name: 'billing.currency', type: 'string', description: 'Currency', sampleValue: 'USD' },
        { name: 'billing.invoiceNumber', type: 'string', description: 'Invoice number', sampleValue: 'INV-2026-0814' },
      ],
      samplePayload: { billing: { amount: 49, currency: 'USD', invoiceNumber: 'INV-2026-0814', plan: 'Pro', invoiceUrl: 'https://app.onetab.ai/invoices/1' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_PAYMENT_FAILED',
    name: 'Payment Failed',
    category: 'BILLING',
    description: 'High-priority alert when a renewal charge is declined.',
    subject: 'Action Required: Payment failed for {{appName || "OneTab AI"}}',
    previewText: 'We were unable to process your payment of {{formatCurrency billing.amount billing.currency}}.',
    htmlBody: `
      ${EmailHeading('Payment Failed ⚠️')}
      ${EmailAlert('We could not charge your card on file for invoice #{{billing.invoiceNumber}}.', 'danger')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('Your recent renewal payment of <strong>{{formatCurrency billing.amount billing.currency}}</strong> failed. Please update your payment method to keep your account active.')}
      ${EmailButton('Update Payment Method', '{{billing.paymentUrl || "http://localhost:4200/settings/billing"}}', { color: '#dc2626' })}
    `,
    textBody: `Action Required: Payment of {{formatCurrency billing.amount billing.currency}} failed for invoice #{{billing.invoiceNumber}}.\n\nUpdate card: {{billing.paymentUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'billing.amount', type: 'currency', description: 'Amount', sampleValue: 49 },
        { name: 'billing.currency', type: 'string', description: 'Currency', sampleValue: 'USD' },
        { name: 'billing.invoiceNumber', type: 'string', description: 'Invoice #', sampleValue: 'INV-2026-0814' },
      ],
      samplePayload: { billing: { amount: 49, currency: 'USD', invoiceNumber: 'INV-2026-0814', paymentUrl: 'https://app.onetab.ai/settings/billing' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_PAYMENT_RETRY',
    name: 'Payment Retry Scheduled',
    category: 'BILLING',
    description: 'Notification about subsequent automatic charge attempts.',
    subject: 'Payment retry scheduled for {{formatDate nextRetryDate}}',
    previewText: 'We will retry charging your card in {{daysUntilRetry || "3"}} days.',
    htmlBody: `
      ${EmailHeading('Upcoming Payment Retry')}
      ${EmailText('We will retry processing payment for invoice #{{billing.invoiceNumber}} on <strong>{{formatDate nextRetryDate}}</strong>.')}
      ${EmailButton('Update Payment Method', '{{billing.paymentUrl}}')}
    `,
    textBody: `Payment retry scheduled for invoice #{{billing.invoiceNumber}} on {{formatDate nextRetryDate}}.\n\nUpdate: {{billing.paymentUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'billing.invoiceNumber', type: 'string', description: 'Invoice #', sampleValue: 'INV-2026-0814' },
        { name: 'nextRetryDate', type: 'date', description: 'Date', sampleValue: '2026-10-10T00:00:00Z' },
      ],
      samplePayload: { billing: { invoiceNumber: 'INV-2026-0814', paymentUrl: 'https://app.onetab.ai/billing' }, nextRetryDate: '2026-10-10T00:00:00Z' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_INVOICE_GENERATED',
    name: 'Invoice Generated',
    category: 'BILLING',
    description: 'Notice that a new invoice has been drafted.',
    subject: 'Invoice #{{billing.invoiceNumber}} generated',
    previewText: 'A new invoice of {{formatCurrency billing.amount billing.currency}} is ready.',
    htmlBody: `
      ${EmailHeading('Invoice Generated')}
      ${EmailText('Invoice <strong>#{{billing.invoiceNumber}}</strong> has been generated for your account.')}
      ${EmailCard([
        { label: 'Amount', value: '{{formatCurrency billing.amount billing.currency}}' },
        { label: 'Due Date', value: '{{formatDate billing.dueDate}}' },
      ])}
      ${EmailButton('View Invoice', '{{billing.invoiceUrl}}')}
    `,
    textBody: `Invoice #{{billing.invoiceNumber}} generated: {{formatCurrency billing.amount billing.currency}}.\n\nView: {{billing.invoiceUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'billing.invoiceNumber', type: 'string', description: 'Invoice #', sampleValue: 'INV-1029' },
        { name: 'billing.amount', type: 'currency', description: 'Amount', sampleValue: 1200 },
      ],
      samplePayload: { billing: { invoiceNumber: 'INV-1029', amount: 1200, currency: 'USD', invoiceUrl: 'https://app.onetab.ai/invoices/1029' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_INVOICE_READY',
    name: 'Invoice Ready for Payment',
    category: 'BILLING',
    description: 'Sent when invoice is published for manual payment.',
    subject: 'Invoice ready: #{{billing.invoiceNumber}}',
    previewText: 'Invoice #{{billing.invoiceNumber}} is ready for payment.',
    htmlBody: `
      ${EmailHeading('Invoice Ready')}
      ${EmailText('Your invoice <strong>#{{billing.invoiceNumber}}</strong> for <strong>{{formatCurrency billing.amount billing.currency}}</strong> is ready for review.')}
      ${EmailButton('Pay Invoice', '{{billing.paymentUrl}}')}
    `,
    textBody: `Invoice #{{billing.invoiceNumber}} ready for payment: {{formatCurrency billing.amount billing.currency}}.\n\nPay: {{billing.paymentUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'billing.invoiceNumber', type: 'string', description: 'Invoice #', sampleValue: 'INV-1029' },
        { name: 'billing.amount', type: 'currency', description: 'Amount', sampleValue: 1200 },
      ],
      samplePayload: { billing: { invoiceNumber: 'INV-1029', amount: 1200, currency: 'USD', paymentUrl: 'https://app.onetab.ai/pay/1029' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_INVOICE_PAID',
    name: 'Invoice Marked Paid',
    category: 'BILLING',
    description: 'Confirmation that invoice was marked as paid.',
    subject: 'Invoice #{{billing.invoiceNumber}} has been paid',
    previewText: 'Thank you! Invoice #{{billing.invoiceNumber}} is marked paid.',
    htmlBody: `
      ${EmailHeading('Invoice Paid ✅')}
      ${EmailAlert('Invoice #{{billing.invoiceNumber}} was marked paid.', 'success')}
      ${EmailButton('Download PDF', '{{billing.invoiceUrl}}')}
    `,
    textBody: `Invoice #{{billing.invoiceNumber}} marked paid.\n\nDownload: {{billing.invoiceUrl}}`,
    variablesSchema: {
      variables: [{ name: 'billing.invoiceNumber', type: 'string', description: 'Invoice #', sampleValue: 'INV-1029' }],
      samplePayload: { billing: { invoiceNumber: 'INV-1029', invoiceUrl: 'https://app.onetab.ai/invoices/1029' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_INVOICE_OVERDUE',
    name: 'Invoice Overdue Notice',
    category: 'BILLING',
    description: 'Notice sent when invoice passes due date without payment.',
    subject: 'Overdue Notice: Invoice #{{billing.invoiceNumber}}',
    previewText: 'Invoice #{{billing.invoiceNumber}} is past due.',
    htmlBody: `
      ${EmailHeading('Invoice Overdue ⚠️')}
      ${EmailAlert('Invoice #{{billing.invoiceNumber}} for {{formatCurrency billing.amount billing.currency}} was due on {{formatDate billing.dueDate}} and is past due.', 'danger')}
      ${EmailButton('Pay Now', '{{billing.paymentUrl}}', { color: '#dc2626' })}
    `,
    textBody: `Invoice #{{billing.invoiceNumber}} is overdue! Amount: {{formatCurrency billing.amount billing.currency}}.\n\nPay: {{billing.paymentUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'billing.invoiceNumber', type: 'string', description: 'Invoice #', sampleValue: 'INV-1029' },
        { name: 'billing.amount', type: 'currency', description: 'Amount', sampleValue: 1200 },
      ],
      samplePayload: { billing: { invoiceNumber: 'INV-1029', amount: 1200, currency: 'USD', paymentUrl: 'https://app.onetab.ai/pay/1029' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_REFUND_PROCESSED',
    name: 'Refund Processed',
    category: 'BILLING',
    description: 'Notice confirming a credit or refund was issued.',
    subject: 'Refund confirmation: {{formatCurrency billing.amount billing.currency}}',
    previewText: 'A refund has been processed to your payment method.',
    htmlBody: `
      ${EmailHeading('Refund Processed')}
      ${EmailAlert('A refund of {{formatCurrency billing.amount billing.currency}} has been processed.', 'info')}
      ${EmailText('Refunds typically appear on your statement within 5–10 business days depending on your bank.')}
    `,
    textBody: `Refund of {{formatCurrency billing.amount billing.currency}} processed. Appears in 5-10 business days.`,
    variablesSchema: {
      variables: [
        { name: 'billing.amount', type: 'currency', description: 'Refund amount', sampleValue: 49 },
        { name: 'billing.currency', type: 'string', description: 'Currency', sampleValue: 'USD' },
      ],
      samplePayload: { billing: { amount: 49, currency: 'USD' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_USAGE_WARNING',
    name: 'Usage Limit Warning (80%)',
    category: 'BILLING',
    description: 'Warning when workspace reaches 80% of storage, seats, or tokens.',
    subject: 'Usage Warning: You have reached {{usagePercent || "80%"}} of your {{usageType || "plan"}} limit',
    previewText: 'Approaching plan capacity limit.',
    htmlBody: `
      ${EmailHeading('Usage Warning')}
      ${EmailAlert('Your workspace has consumed {{usagePercent || "80%"}} of your allocated {{usageType || "storage/token"}} quota.', 'warning')}
      ${EmailButton('View Usage & Upgrade', '{{upgradeUrl || "http://localhost:4200/settings/billing"}}')}
    `,
    textBody: `You have reached {{usagePercent || "80%"}} of your {{usageType || "plan"}} limit.\n\nManage: {{upgradeUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'usagePercent', type: 'string', description: 'Usage percentage', sampleValue: '85%' },
        { name: 'usageType', type: 'string', description: 'Quota type', sampleValue: 'AI Token' },
      ],
      samplePayload: { usagePercent: '85%', usageType: 'AI Token', upgradeUrl: 'https://app.onetab.ai/settings/billing' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'BILLING_USAGE_LIMIT_REACHED',
    name: 'Usage Limit Reached (100%)',
    category: 'BILLING',
    description: 'Notice when workspace hits 100% capacity.',
    subject: 'Quota Exceeded: Your {{usageType || "plan"}} limit has been reached',
    previewText: 'Usage cap reached for this billing period.',
    htmlBody: `
      ${EmailHeading('Quota Exceeded 🛑')}
      ${EmailAlert('You have reached 100% of your {{usageType || "plan"}} quota.', 'danger')}
      ${EmailButton('Upgrade Plan Now', '{{upgradeUrl || "http://localhost:4200/settings/billing"}}')}
    `,
    textBody: `100% quota reached for {{usageType}}.\n\nUpgrade: {{upgradeUrl}}`,
    variablesSchema: {
      variables: [{ name: 'usageType', type: 'string', description: 'Quota type', sampleValue: 'File Storage' }],
      samplePayload: { usageType: 'File Storage', upgradeUrl: 'https://app.onetab.ai/settings/billing' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];
