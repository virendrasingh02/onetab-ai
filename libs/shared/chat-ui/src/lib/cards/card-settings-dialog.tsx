import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Switch,
} from '@org/ui';
import { Sliders, RotateCcw } from 'lucide-react';
import { useAICardPreferencesStore, type CardDensity } from './card-preferences-store.js';

export interface CardSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CardSettingsDialog({ open, onOpenChange }: CardSettingsDialogProps) {
  const prefs = useAICardPreferencesStore();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-surface text-foreground border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Sliders className="size-4 text-primary" />
            <span>AI &amp; App Card Display Settings</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Customize how AI agent responses, tool executions, and integrated app cards appear in your timeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Card Density */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Card Density Mode</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['compact', 'comfortable', 'expanded'] as CardDensity[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => prefs.setDensity(mode)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium capitalize transition-all text-center ${
                    prefs.density === mode
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-surface-raised text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Display Toggles */}
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
              Display Elements
            </p>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-foreground">Show Execution Steps</Label>
                <p className="text-[11px] text-muted-foreground">Display running sub-steps and progress</p>
              </div>
              <Switch
                checked={prefs.showExecutionSteps}
                onCheckedChange={() => prefs.togglePreference('showExecutionSteps')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-foreground">Show Tool Calls</Label>
                <p className="text-[11px] text-muted-foreground">Display executed tools and durations</p>
              </div>
              <Switch
                checked={prefs.showTools}
                onCheckedChange={() => prefs.togglePreference('showTools')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-foreground">Show Sources</Label>
                <p className="text-[11px] text-muted-foreground">Display web, doc, and knowledge base citations</p>
              </div>
              <Switch
                checked={prefs.showSources}
                onCheckedChange={() => prefs.togglePreference('showSources')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-foreground">Show AI Model Badge</Label>
                <p className="text-[11px] text-muted-foreground">Display model name (e.g. GPT-5, Gemini 2.5)</p>
              </div>
              <Switch
                checked={prefs.showModel}
                onCheckedChange={() => prefs.togglePreference('showModel')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-foreground">Show Execution Duration</Label>
                <p className="text-[11px] text-muted-foreground">Display latency / duration timer in header</p>
              </div>
              <Switch
                checked={prefs.showDuration}
                onCheckedChange={() => prefs.togglePreference('showDuration')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-foreground">Technical / Debug Metadata</Label>
                <p className="text-[11px] text-muted-foreground">Inspect Event ID, Execution ID, and raw payload</p>
              </div>
              <Switch
                checked={prefs.showTechnicalMetadata}
                onCheckedChange={() => prefs.togglePreference('showTechnicalMetadata')}
              />
            </div>
          </div>

          {/* Behavior Toggles */}
          <div className="space-y-3 pt-2 border-t border-border">
            <p className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
              Collapsing Behavior
            </p>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground">Collapse tool calls by default</Label>
              <Switch
                checked={prefs.collapseToolCalls}
                onCheckedChange={() => prefs.togglePreference('collapseToolCalls')}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground">Collapse sources by default</Label>
              <Switch
                checked={prefs.collapseSources}
                onCheckedChange={() => prefs.togglePreference('collapseSources')}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground">Auto-expand running agents</Label>
              <Switch
                checked={prefs.autoExpandRunningAgents}
                onCheckedChange={() => prefs.togglePreference('autoExpandRunningAgents')}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={prefs.resetDefaults}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            <span>Reset Defaults</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
