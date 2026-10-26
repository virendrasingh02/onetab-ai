import type { EmployeeProfileView } from '@org/types';
import { createContext, useContext } from 'react';

/**
 * Where the profile rail gets a person's employee details (department, phone,
 * skills, birthday…). The rail lives in a shared lib that cannot call the API,
 * so the app supplies this — the same arrangement as `MemberProfileProvider`.
 * Without a provider the rail simply omits the Work section.
 */
export interface EmployeeInfoSource {
  /** A hook: loads what the *viewer* may see of `userId` (either id spelling). */
  useEmployee: (userId?: string) => EmployeeProfileView | undefined;
  /** HR: open the employment editor for this person. */
  onEditEmployment?: (employee: EmployeeProfileView) => void;
  /** Self: jump to the place the employee edits their own work profile. */
  onEditSelf?: () => void;
}

const EmployeeInfoContext = createContext<EmployeeInfoSource | null>(null);

export const EmployeeInfoProvider = EmployeeInfoContext.Provider;

export const useEmployeeInfoSource = (): EmployeeInfoSource | null => useContext(EmployeeInfoContext);
