import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserIdentity } from './user-identity.js';

describe('UserIdentity', () => {
  it('renders user display name and handle/email', () => {
    render(
      <UserIdentity
        name="alice"
        displayName="Alice Cooper"
        handle="alice_cooper"
        email="alice@example.com"
      />,
    );

    expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
    expect(screen.getByText('@alice_cooper')).toBeInTheDocument();
  });

  it('renders email when no handle is provided', () => {
    render(
      <UserIdentity
        name="alice_cooper"
        displayName="Alice Cooper"
        email="alice@example.com"
      />,
    );

    expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('renders custom subtitle when provided', () => {
    render(
      <UserIdentity
        name="bob"
        displayName="Bob Builder"
        subtitle="Lead Architect"
      />,
    );

    expect(screen.getByText('Bob Builder')).toBeInTheDocument();
    expect(screen.getByText('Lead Architect')).toBeInTheDocument();
  });
});
