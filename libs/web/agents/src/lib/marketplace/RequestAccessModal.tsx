import React, { useState } from 'react';
import type { MarketplaceListing } from '@org/types';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Field,
  Textarea,
} from '@org/ui';
import { EntityIcon } from './marketplace-ui';
import { Lock, Send } from 'lucide-react';

interface RequestAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: MarketplaceListing;
  onSubmit: (reason: string) => Promise<void>;
}

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({
  isOpen,
  onClose,
  listing,
  onSubmit,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setReason('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <EntityIcon iconUrl={listing.iconUrl} kind={listing.kind} />
            <div>
              <DialogTitle>
                Request access for {listing.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Requires workspace admin approval
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
          <div className="gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 flex items-start">
            <Lock className="mt-0.5 size-4 shrink-0 text-warning-text" aria-hidden />
            <p className="text-xs text-muted-foreground leading-relaxed">
              This {listing.kind === 'AGENT' ? 'agent' : 'integration'} requests administrative or elevated workspace permissions. An admin must review your request before it is activated.
            </p>
          </div>

          <Field label="Reason for request" required>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Need GitHub PR notifications in our team channel to coordinate weekly releases..."
              rows={3}
            />
          </Field>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              disabled={!reason.trim()}
            >
              <Send aria-hidden />
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
