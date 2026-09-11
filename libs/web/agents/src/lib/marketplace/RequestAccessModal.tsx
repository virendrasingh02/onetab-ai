import React, { useState } from 'react';
import type { MarketplaceListing } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Textarea,
  Label,
} from '@org/ui';
import { renderEntityIcon } from './MarketplaceCard';
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
      <DialogContent className="max-w-md p-6 bg-surface border-border rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            {renderEntityIcon(listing.iconUrl ?? undefined, listing.kind, 'size-10')}
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Request Access for {listing.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Requires Workspace Admin Approval
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-3">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2.5">
            <Lock className="size-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              This {listing.kind === 'AGENT' ? 'agent' : 'integration'} requests administrative or elevated workspace permissions. An admin must review your request before it is activated.
            </p>
          </div>

          <div>
            <Label className="text-xs font-semibold text-foreground">
              Reason for request
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Need GitHub PR notifications in our team channel to coordinate weekly releases..."
              rows={3}
              required
              className="mt-1.5 text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="xs"
              loading={isSubmitting}
              disabled={!reason.trim()}
              className="text-xs font-semibold"
            >
              <Send className="size-3.5 mr-1.5" />
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
