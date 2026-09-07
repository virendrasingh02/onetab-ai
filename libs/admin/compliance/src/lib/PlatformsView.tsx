import type { CompliancePlatformView } from '@org/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Page,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import {
  Apple,
  Globe,
  Layers,
  Monitor,
  Plus,
  Radio,
  RefreshCw,
  Sliders,
  Terminal,
} from 'lucide-react';
import { useState } from 'react';
import {
  useComplianceMutations,
  useCompliancePlatforms,
} from './use-compliance.js';

export function PlatformsView() {
  const query = useCompliancePlatforms();
  const mutations = useComplianceMutations();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'WEB' | 'DESKTOP' | 'MOBILE'>('DESKTOP');
  const [newVersion, setNewVersion] = useState('1.0.0');

  const [editingPlatform, setEditingPlatform] = useState<CompliancePlatformView | null>(null);
  const [editCurrentVersion, setEditCurrentVersion] = useState('');
  const [editMinVersion, setEditMinVersion] = useState('');

  if (query.isLoading) {
    return (
      <Page>
        <LoadingState label="Loading platforms and distribution channels…" />
      </Page>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Page>
        <ErrorState
          title="Could not load platform directory"
          description="Failed to fetch registered platforms and distribution channels."
        />
      </Page>
    );
  }

  const platforms = query.data;

  const handleAddPlatform = () => {
    if (!newCode || !newName) return;
    mutations.createPlatform.mutate(
      {
        code: newCode,
        name: newName,
        type: newType,
        currentVersion: newVersion,
        minSupportedVersion: newVersion,
      },
      {
        onSuccess: () => {
          setIsAddOpen(false);
          setNewCode('');
          setNewName('');
          setNewVersion('1.0.0');
        },
      },
    );
  };

  const handleUpdatePlatform = () => {
    if (!editingPlatform) return;
    mutations.updatePlatform.mutate(
      {
        id: editingPlatform.id,
        data: {
          currentVersion: editCurrentVersion,
          minSupportedVersion: editMinVersion,
        },
      },
      {
        onSuccess: () => {
          setEditingPlatform(null);
        },
      },
    );
  };

  return (
    <Page>
      <PageHeader
        title="Platform & Distribution Management"
        description="Unified Web and Desktop distribution channels with platform-specific compliance requirements."
        icon={<Monitor className="text-accent-blue" />}
        accent="blue"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${query.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Platform
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register New Platform</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-code">Platform Identifier</Label>
                    <Input
                      id="plat-code"
                      placeholder="e.g. android, ios, windows"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-name">Display Name</Label>
                    <Input
                      id="plat-name"
                      placeholder="e.g. Windows Desktop, Android Mobile"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-type">Platform Type</Label>
                    <Select
                      value={newType}
                      onValueChange={(val: any) => setNewType(val)}
                    >
                      <SelectTrigger id="plat-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DESKTOP">Desktop Application</SelectItem>
                        <SelectItem value="WEB">Web Application / PWA</SelectItem>
                        <SelectItem value="MOBILE">Mobile Application</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plat-ver">Initial Version</Label>
                    <Input
                      id="plat-ver"
                      placeholder="e.g. 1.0.0 or 2026.09.1"
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddPlatform}
                    disabled={!newCode || !newName || mutations.createPlatform.isPending}
                  >
                    Register Platform
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {platforms.map((p) => (
          <Card key={p.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg border border-border bg-secondary/50 flex items-center justify-center">
                    {p.code === 'web' ? (
                      <Globe className="w-5 h-5 text-accent-cyan" />
                    ) : p.code === 'macos' ? (
                      <Apple className="w-5 h-5 text-foreground" />
                    ) : p.code === 'linux' ? (
                      <Terminal className="w-5 h-5 text-success" />
                    ) : (
                      <Monitor className="w-5 h-5 text-accent-blue" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      ID: {p.code} · Type: {p.type}
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant={p.complianceStatus === 'PASSED' ? 'success' : 'warning'}
                  className="text-xs"
                >
                  {p.readinessScore}% Ready
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4 text-xs">
              {/* Versions */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-card/60">
                <div>
                  <div className="text-muted-foreground text-[11px]">Current Version</div>
                  <div className="font-mono font-medium text-sm mt-0.5">
                    {p.currentVersion}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[11px]">Minimum Supported</div>
                  <div className="font-mono font-medium text-sm mt-0.5">
                    {p.minSupportedVersion}
                  </div>
                </div>
              </div>

              {/* Distribution Channels */}
              <div>
                <div className="font-medium text-foreground mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-accent-purple" />
                  Distribution Channels ({p.distributions.length})
                </div>
                {p.distributions.length === 0 ? (
                  <div className="text-muted-foreground text-xs italic">
                    No discrete distribution channels configured.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {p.distributions.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between p-2 rounded border border-border bg-card/40 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Radio className="w-3 h-3 text-success" />
                          <span className="font-medium">{d.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ({d.code})
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="pt-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingPlatform(p);
                    setEditCurrentVersion(p.currentVersion);
                    setEditMinVersion(p.minSupportedVersion);
                  }}
                >
                  <Sliders className="w-3.5 h-3.5 mr-1.5" />
                  Configure Versions
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Platform Dialog */}
      {editingPlatform && (
        <Dialog
          open={!!editingPlatform}
          onOpenChange={(open) => !open && setEditingPlatform(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure {editingPlatform.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-curr-ver">Current Production Version</Label>
                <Input
                  id="edit-curr-ver"
                  value={editCurrentVersion}
                  onChange={(e) => setEditCurrentVersion(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-min-ver">Minimum Supported Version</Label>
                <Input
                  id="edit-min-ver"
                  value={editMinVersion}
                  onChange={(e) => setEditMinVersion(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPlatform(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdatePlatform}
                disabled={mutations.updatePlatform.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Page>
  );
}
