import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Spinner,
  toast,
} from '@org/ui';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useIntegrationMutations } from './use-integrations.js';

interface TrelloConnectModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Trello has no server-side OAuth2 code exchange — each user brings their own
 * personal API key + token (same bring-your-own-credential model as the
 * Custom API connector). The key identifies a Trello "Power-Up"/app and the
 * token authorizes it against one Trello account; Trello generates the token
 * via a page it serves itself, not a redirect we can intercept, so the user
 * copies it here manually.
 */
export function TrelloConnectModal({ workspaceId, isOpen, onClose }: TrelloConnectModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');
  const { connect } = useIntegrationMutations(workspaceId);

  const tokenUrl = apiKey.trim()
    ? `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=OneTab%20AI&key=${encodeURIComponent(apiKey.trim())}`
    : undefined;

  const handleConnect = async () => {
    if (!apiKey.trim() || !token.trim()) {
      toast.error('Both an API key and a token are required.');
      return;
    }
    try {
      await connect.mutateAsync({
        provider: 'TRELLO',
        config: { apiKey: apiKey.trim(), token: token.trim() },
      });
      toast.success('Trello connected.');
      setApiKey('');
      setToken('');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect Trello.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Trello</DialogTitle>
          <DialogDescription>
            Trello doesn't support the usual "sign in with" flow — you'll generate a personal API key
            and token from your own Trello account and paste them below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="API key" required hint="From trello.com/app-key, while signed in to Trello.">
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your Trello API key" />
          </Field>

          {tokenUrl ? (
            <a
              href={tokenUrl}
              target="_blank"
              rel="noreferrer"
              className="gap-1.5 text-xs font-medium text-primary flex items-center hover:underline"
            >
              Generate a token with this key <ExternalLink className="size-3" />
            </a>
          ) : null}

          <Field label="Token" required hint="Generated on the page the link above opens.">
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Trello token"
            />
          </Field>
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={connect.isPending}>
            {connect.isPending ? <Spinner className="size-3.5" /> : 'Connect'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
