// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { TaskStatus } from '@org/types';
import { TooltipProvider } from '@org/ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getStatusLabel, StatusIcon } from './kanban-icons.js';

describe('getStatusLabel', () => {
  it('returns appropriate labels for standard TaskStatus enum values', () => {
    expect(getStatusLabel(TaskStatus.BACKLOG)).toBe('Backlog');
    expect(getStatusLabel(TaskStatus.TODO)).toBe('Planned');
    expect(getStatusLabel(TaskStatus.IN_PROGRESS)).toBe('In Progress');
    expect(getStatusLabel(TaskStatus.IN_REVIEW)).toBe('In Review');
    expect(getStatusLabel(TaskStatus.DONE)).toBe('Completed');
    expect(getStatusLabel(TaskStatus.CANCELLED)).toBe('Cancelled');
  });

  it('formats custom or string status values nicely', () => {
    expect(getStatusLabel('TODO')).toBe('Planned');
    expect(getStatusLabel('BACKLOG')).toBe('Backlog');
    expect(getStatusLabel('IN_TESTING')).toBe('In Testing');
    expect(getStatusLabel('')).toBe('Status');
  });
});

describe('StatusIcon', () => {
  it('renders status icon with accessible label and tooltip support', () => {
    render(
      <TooltipProvider>
        <StatusIcon status={TaskStatus.IN_PROGRESS} />
      </TooltipProvider>,
    );

    const icon = screen.getByRole('img', { name: 'In Progress' });
    expect(icon).toBeInTheDocument();
  });

  it('renders with custom tooltip label when specified', () => {
    render(
      <TooltipProvider>
        <StatusIcon status="DONE" tooltipLabel="Finished Task" />
      </TooltipProvider>,
    );

    const icon = screen.getByRole('img', { name: 'Finished Task' });
    expect(icon).toBeInTheDocument();
  });

  it('renders without tooltip wrapper when showTooltip is false', () => {
    const { container } = render(
      <StatusIcon status={TaskStatus.TODO} showTooltip={false} />,
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label', 'Planned');
  });
});
