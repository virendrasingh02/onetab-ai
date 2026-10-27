import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@org/ui';
import { cn } from '@org/utils';
import { AppWindow, CheckCircle2, Monitor, MonitorUp, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  getDesktopApi,
  type DesktopCaptureSource,
  type DesktopDisplayMediaRequest,
} from './desktop-api.js';

/** Screens before windows, each group in the order the OS listed them. */
export function groupCaptureSources(sources: readonly DesktopCaptureSource[]) {
  return {
    screens: sources.filter((source) => source.kind === 'screen'),
    windows: sources.filter((source) => source.kind === 'window'),
  };
}

function SourceGrid({
  title,
  sources,
  selectedId,
  onSelect,
  onShare,
}: {
  title: string;
  sources: DesktopCaptureSource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onShare: (id: string) => void;
}) {
  if (sources.length === 0) return null;

  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {title === 'Screens' ? <Monitor className="size-3.5" /> : <AppWindow className="size-3.5" />}
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {sources.map((source) => {
          const selected = source.id === selectedId;
          return (
            <button
              key={source.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(source.id)}
              onDoubleClick={() => onShare(source.id)}
              className={cn(
                'group flex flex-col gap-1.5 rounded-lg border bg-card p-1.5 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:bg-muted/50',
              )}
            >
              <span className="relative block">
                <img
                  src={source.thumbnail}
                  alt=""
                  draggable={false}
                  className="aspect-video w-full rounded-md bg-muted object-cover"
                />
                {/* The ring alone reads the same as keyboard focus, so selection gets a mark too. */}
                {selected ? (
                  <CheckCircle2
                    aria-hidden
                    className="absolute right-1.5 top-1.5 size-5 rounded-full bg-background text-primary"
                  />
                ) : null}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 px-0.5 text-xs">
                {source.appIcon ? (
                  <img src={source.appIcon} alt="" className="size-4 shrink-0" draggable={false} />
                ) : null}
                <span className="truncate" title={source.name}>
                  {source.name}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The picker behind `getDisplayMedia` (screen share in huddles and calls).
 *
 * A browser draws its own "choose what to share" sheet; Electron draws nothing,
 * so the shell forwards the request here and waits for the answer. Closing the
 * dialog any way other than "Share" cancels, which the page sees as the person
 * declining. Renders nothing in a browser or while no request is open.
 */
export function ScreenSharePicker() {
  const [request, setRequest] = useState<DesktopDisplayMediaRequest | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    return getDesktopApi()?.displayMedia?.onRequest((next) => {
      setRequest(next);
      setSelectedId(null);
    });
  }, []);

  const answer = useCallback(
    (sourceId: string | null) => {
      if (!request) return;
      setRequest(null);
      void getDesktopApi()?.displayMedia?.respond(request.requestId, sourceId);
    },
    [request],
  );

  if (!request) return null;

  const { screens, windows } = groupCaptureSources(request.sources);
  const blocked = request.blocked === 'os-permission';
  const empty = request.sources.length === 0;

  return (
    <Dialog open onOpenChange={(open) => !open && answer(null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-accent-blue/10 text-accent-blue">
              <MonitorUp className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Share your screen</DialogTitle>
              <DialogDescription className="text-xs">
                Choose a screen or a window. Everyone in the call will be able to see it.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="max-h-[55vh] space-y-4 overflow-y-auto">
          {blocked ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-2">
                <p>
                  Onetab AI is not allowed to record your screen. Turn it on under Privacy &amp;
                  Security → Screen Recording, then restart the app.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void getDesktopApi()?.shell.openSystemSettings?.('screen-recording');
                    answer(null);
                  }}
                >
                  Open System Settings
                </Button>
              </div>
            </div>
          ) : empty ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              There is nothing to share right now.
            </p>
          ) : (
            <>
              <SourceGrid
                title="Screens"
                sources={screens}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onShare={answer}
              />
              <SourceGrid
                title="Windows"
                sources={windows}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onShare={answer}
              />
            </>
          )}
        </DialogBody>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => answer(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!selectedId}
            onClick={() => answer(selectedId)}
          >
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
