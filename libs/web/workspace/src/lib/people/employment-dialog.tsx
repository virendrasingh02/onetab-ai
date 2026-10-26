import type { EmployeeProfileView } from '@org/types';
import {
  Button,
  DatePicker,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  toast,
} from '@org/ui';
import { useState } from 'react';
import { errorMessage } from './people-utils.js';
import { usePeopleMutations } from './use-people.js';

/**
 * HR editor for the employment fields only a workspace admin may change
 * (department, team, official joining date, leaving date). The API enforces
 * `MANAGE_MEMBERS` and writes each change to the audit log.
 */
export function EmploymentDialog({
  workspaceId,
  employee,
  onClose,
}: {
  workspaceId: string | undefined;
  employee: EmployeeProfileView | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!employee} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        {employee && <EmploymentForm key={employee.userId} workspaceId={workspaceId} employee={employee} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function EmploymentForm({
  workspaceId,
  employee,
  onClose,
}: {
  workspaceId: string | undefined;
  employee: EmployeeProfileView;
  onClose: () => void;
}) {
  const { updateEmployment } = usePeopleMutations(workspaceId);
  const [department, setDepartment] = useState(employee.department ?? '');
  const [team, setTeam] = useState(employee.team ?? '');
  const [joiningDate, setJoiningDate] = useState(employee.joiningDate ?? '');
  const [leftAt, setLeftAt] = useState('');

  const submit = () =>
    updateEmployment.mutate(
      {
        userId: employee.userId,
        input: {
          department: department.trim() || null,
          team: team.trim() || null,
          joiningDate: joiningDate || null,
          ...(leftAt ? { leftAt } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success('Employment details saved');
          onClose();
        },
        onError: (err) => toast.error(errorMessage(err, 'Could not save employment details')),
      },
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Employment — {employee.name}</DialogTitle>
        <DialogDescription>
          HR-managed. Changes are written to the workspace audit log.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="gap-4 grid sm:grid-cols-2">
          <Field label="Department" optional>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Team" optional>
            <Input value={team} onChange={(e) => setTeam(e.target.value)} maxLength={80} />
          </Field>
        </div>
        <Field label="Official joining date" optional hint="Drives work anniversaries.">
          <DatePicker
            value={joiningDate}
            onChange={(d) => setJoiningDate(d ?? '')}
            placeholder="Select joining date"
            showPresets={false}
          />
        </Field>
        <Field label="Leaving date" optional hint="Set when the employee leaves; stops celebrations.">
          <DatePicker
            value={leftAt}
            onChange={(d) => setLeftAt(d ?? '')}
            placeholder="Select leaving date"
            minDate={joiningDate ? new Date(`${joiningDate}T00:00:00`) : undefined}
            showPresets={false}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={updateEmployment.isPending}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}
