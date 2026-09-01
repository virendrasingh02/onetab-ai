import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FeatureGateDialog } from './feature-gate-dialog.js';

describe('FeatureGateDialog', () => {
  it('renders required plan and feature name when open', () => {
    const onClose = vi.fn();
    const onUpgradeClick = vi.fn();

    render(
      <FeatureGateDialog
        isOpen={true}
        onClose={onClose}
        requiredPlan="pro"
        featureName="Gantt & Timeline Views"
      />,
    );

    expect(screen.getByText('Unlock Gantt & Timeline Views')).toBeDefined();
    expect(screen.getByText('Pro')).toBeDefined();
    expect(screen.getByText('Upgrade to Pro')).toBeDefined();
  });

  it('triggers upgrade callback on button click', () => {
    const onClose = vi.fn();
    const onUpgradeClick = vi.fn();

    render(
      <FeatureGateDialog
        isOpen={true}
        onClose={onClose}
        requiredPlan="business"
        featureName="Audit Logs"
        onUpgradeClick={onUpgradeClick}
      />,
    );

    const upgradeBtn = screen.getByText('Upgrade to Business');
    fireEvent.click(upgradeBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onUpgradeClick).toHaveBeenCalledWith('business');
  });
});
