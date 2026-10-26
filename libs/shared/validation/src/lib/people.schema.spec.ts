import { describe, expect, it } from 'vitest';
import { updateEmployeeProfileSchema } from './people.schema.js';

describe('updateEmployeeProfileSchema phone', () => {
  it('stores a valid number as E.164', () => {
    const r = updateEmployeeProfileSchema.safeParse({
      phone: '+91 98765 43210',
    });
    expect(r.success && r.data.phone).toBe('+919876543210');
  });
  it('rejects numbers without a valid country code and clears on empty', () => {
    expect(
      updateEmployeeProfileSchema.safeParse({ phone: '98765 43210' }).success,
    ).toBe(false);
    expect(
      updateEmployeeProfileSchema.safeParse({ phone: '+1 555 0100' }).success,
    ).toBe(false);
    const cleared = updateEmployeeProfileSchema.safeParse({ phone: '' });
    expect(cleared.success && cleared.data.phone).toBeNull();
    expect(updateEmployeeProfileSchema.safeParse({ phone: null }).success).toBe(
      true,
    );
  });
});
