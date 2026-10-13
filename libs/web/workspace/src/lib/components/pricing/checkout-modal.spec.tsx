import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const quote = vi.fn();
const validate = vi.fn();
const checkout = vi.fn();

vi.mock('@org/api-client', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return {
    ...actual,
    billingApi: {
      ...(actual['billingApi'] as object),
      quote: (...a: unknown[]) => quote(...a),
      validatePromotion: (...a: unknown[]) => validate(...a),
      checkout: (...a: unknown[]) => checkout(...a),
    },
  };
});

import { CheckoutModal } from './checkout-modal.js';

const baseQuote = {
  planTier: 'pro',
  billingInterval: 'monthly',
  currency: 'USD',
  subtotalCents: 3000,
  discountCents: 0,
  taxCents: 0,
  totalCents: 3000,
  renewalCents: 3000,
  trialDays: 0,
  dueNowCents: 3000,
  taxCalculatedByProvider: false,
  promotionCode: null,
};

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CheckoutModal open onOpenChange={vi.fn()} targetPlan="pro" isAnnual={false} workspaceId="ws-1" />
    </QueryClientProvider>,
  );
}

describe('CheckoutModal', () => {
  beforeEach(() => {
    quote.mockReset();
    validate.mockReset();
    checkout.mockReset();
    Object.defineProperty(window, 'location', { value: { assign: vi.fn() }, writable: true });
  });

  it('shows the server-computed total, not a client calculation', async () => {
    quote.mockResolvedValue(baseQuote);
    renderModal();
    expect((await screen.findAllByText('$30.00')).length).toBeGreaterThan(0);
    expect(screen.getByText('Due today')).toBeDefined();
  });

  it('starts with no coupon pre-filled and shows a clear rejection', async () => {
    quote.mockResolvedValue(baseQuote);
    validate.mockResolvedValue({ valid: false, code: 'NOPE', message: 'That coupon has expired.', discountCents: 0, discountPercent: 0 });
    renderModal();
    const input = (await screen.findByLabelText(/coupon code/i)) as HTMLInputElement;
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/expired/i);
  });

  it('applies a valid coupon, re-quotes with it, and can remove it', async () => {
    quote.mockImplementation(async (_ws: string, input: { promotionCode?: string }) =>
      input.promotionCode
        ? { ...baseQuote, discountCents: 3000, totalCents: 0, dueNowCents: 0, promotionCode: 'DEMO' }
        : baseQuote,
    );
    validate.mockResolvedValue({ valid: true, code: 'DEMO', discountCents: 3000, discountPercent: 100 });
    renderModal();
    fireEvent.change(await screen.findByLabelText(/coupon code/i), { target: { value: 'demo' } });
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(await screen.findByText(/DEMO/)).toBeDefined();
    await waitFor(() => expect(screen.getByText(/Discount \(DEMO\)/)).toBeDefined());
    expect(screen.getByRole('button', { name: /activate plan/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /remove coupon/i }));
    await waitFor(() => expect(screen.queryByText(/Discount \(DEMO\)/)).toBeNull());
  });

  it('sends the user to the payment provider rather than assuming success', async () => {
    quote.mockResolvedValue(baseQuote);
    checkout.mockResolvedValue({
      id: 'chk_1',
      status: 'PENDING',
      quote: baseQuote,
      redirectUrl: 'https://pay.example/session',
      activatedWithoutPayment: false,
      createdAt: new Date().toISOString(),
    });
    renderModal();
    const cta = await screen.findByRole('button', { name: /continue to payment/i });
    await waitFor(() => expect((cta as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(cta);
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledWith('https://pay.example/session'));
    expect(checkout.mock.calls[0][1]).toMatchObject({ targetPlan: 'pro', billingInterval: 'monthly' });
    expect(typeof checkout.mock.calls[0][1].idempotencyKey).toBe('string');
  });

  it('surfaces checkout errors inline', async () => {
    quote.mockResolvedValue(baseQuote);
    checkout.mockRejectedValue(new Error('Online payments are not enabled on this deployment yet.'));
    renderModal();
    const cta = await screen.findByRole('button', { name: /continue to payment/i });
    await waitFor(() => expect((cta as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(cta);
    expect((await screen.findByRole('alert')).textContent).toMatch(/not enabled/i);
  });
});
