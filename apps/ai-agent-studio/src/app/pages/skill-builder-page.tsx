import {
  Button,
  Card,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@org/ui';
import {
  ArrowLeft,
  CheckCircle2,
  FileCode,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { StudioPage } from '../components/studio-page.js';
import { useNavigate } from '../router.js';
import { useStudioSession } from '../session-guard.js';

export function SkillBuilderPage() {
  const navigate = useNavigate();
  const { activeWorkspace } = useStudioSession();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('social_media');
  const [executionType, setExecutionType] = useState('instruction');
  const [tags, setTags] = useState('custom, automation');
  const [instructions, setInstructions] = useState(
    '# Skill Protocol\n\n1. Analyze the input carefully.\n2. Follow retention rules and guidelines.\n3. Return structured output.',
  );
  const [voiceTemplate, setVoiceTemplate] = useState(
    '# Tone & Style Rules\n- Be concise, direct and conversational.\n- Avoid generic AI buzzwords.',
  );

  // Dynamic input fields
  const [inputFields, setInputFields] = useState<
    Array<{ key: string; name: string; type: string; description: string; required: boolean }>
  >([
    { key: 'topic', name: 'Topic', type: 'string', description: 'Core idea or subject', required: true },
  ]);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Playground state
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [testInput, setTestInput] = useState<Record<string, any>>({});
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const addInputField = () => {
    setInputFields((prev) => [
      ...prev,
      {
        key: `field_${prev.length + 1}`,
        name: `Field ${prev.length + 1}`,
        type: 'string',
        description: '',
        required: false,
      },
    ]);
  };

  const removeInputField = (index: number) => {
    setInputFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateInputField = (index: number, updates: Partial<(typeof inputFields)[0]>) => {
    setInputFields((prev) =>
      prev.map((field, i) => (i === index ? { ...field, ...updates } : field)),
    );
  };

  const buildPackagePayload = () => {
    const inputsMap: Record<string, any> = {};
    for (const f of inputFields) {
      if (f.key.trim()) {
        inputsMap[f.key.trim()] = {
          name: f.name || f.key,
          type: f.type,
          description: f.description,
          required: f.required,
        };
      }
    }

    return {
      name,
      description,
      category,
      executionType,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      instructions,
      inputs: inputsMap,
      outputs: {
        result: { name: 'result', type: 'string', description: 'Generated result' },
      },
      templates: voiceTemplate ? { 'voice.md': voiceTemplate } : {},
      permissions: [
        {
          scope: 'content:generate',
          label: 'Generate Output',
          description: 'Generates responses from instructions',
          sensitive: false,
        },
      ],
    };
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Skill Name is required.');
      return;
    }
    if (!description.trim()) {
      toast.error('Skill Description is required.');
      return;
    }

    try {
      setSaving(true);
      const payload = buildPackagePayload();
      const res = await fetch(`/api/v1/workspaces/${activeWorkspace.id}/skills/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Skill '${name}' built and registered successfully!`);
        navigate('/skills');
      } else {
        toast.error(data.message || 'Failed to save skill.');
      }
    } catch {
      toast.error('Network error saving skill.');
    } finally {
      setSaving(false);
    }
  };

  const runTestExecution = async () => {
    try {
      setTestRunning(true);
      setTestResult(null);
      const payload = buildPackagePayload();
      const res = await fetch(`/api/v1/workspaces/${activeWorkspace.id}/skills/custom/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: payload,
          testInput,
        }),
      });

      const data = await res.json();
      setTestResult(data);
      if (data.ok) {
        toast.success(`Test executed successfully in ${data.latencyMs || 0}ms!`);
      } else {
        toast.error(data.error?.message || 'Test execution failed.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Execution failed.');
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <StudioPage
      title="Dynamic Skill Builder"
      description="Design, test, and publish custom AI skills with modular instructions, schemas, and templates."
      icon={<Wand2 className="size-5 text-primary" />}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/skills')}
            className="flex items-center gap-1.5"
          >
            <ArrowLeft className="size-4" />
            Back to Skills
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTestInput({});
              setTestResult(null);
              setPlaygroundOpen(true);
            }}
            className="flex items-center gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <Play className="size-4" />
            Test in Playground
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="size-4" />
            {saving ? 'Publishing...' : 'Publish Skill'}
          </Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Core Metadata */}
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Skill Identity & Metadata
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Skill Name *</label>
              <Input
                placeholder="e.g. YouTube Retention Optimizer"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-xs"
              >
                <option value="social_media">Social Media & Video</option>
                <option value="writing">Writing & Copywriting</option>
                <option value="research">Research & Trends</option>
                <option value="marketing">Marketing & Growth</option>
                <option value="development">Development & Engineering</option>
                <option value="data_analysis">Data Analysis & Auditing</option>
                <option value="productivity">Productivity & Planning</option>
                <option value="custom">Custom Specialty</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Description *</label>
            <Input
              placeholder="Detailed description of what this skill accomplishes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Execution Type</label>
              <select
                value={executionType}
                onChange={(e) => setExecutionType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-card px-3 text-xs"
              >
                <option value="instruction">Instruction-based (Prompt & Guidelines)</option>
                <option value="script">Script-based (Sandboxed Logic)</option>
                <option value="tool_calling">Tool-calling (Orchestrates MCP / APIs)</option>
                <option value="composite">Composite (Multi-skill Workflow)</option>
                <option value="api">API-based (External Endpoint)</option>
                <option value="data_transformation">Data Processing / Normalization</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Tags (comma-separated)</label>
              <Input
                placeholder="youtube, scripts, hooks"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Input Schema Builder */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              Input Schema Builder
            </h3>
            <Button variant="outline" size="sm" onClick={addInputField} className="text-xs">
              <Plus className="size-3.5 mr-1" /> Add Input Field
            </Button>
          </div>

          <div className="space-y-3">
            {inputFields.map((field, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-lg border border-border bg-accent/20 items-center"
              >
                <div className="sm:col-span-3">
                  <Input
                    placeholder="Parameter key (e.g. topic)"
                    value={field.key}
                    onChange={(e) => updateInputField(idx, { key: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    placeholder="Display Label"
                    value={field.name}
                    onChange={(e) => updateInputField(idx, { name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <select
                    value={field.type}
                    onChange={(e) => updateInputField(idx, { type: e.target.value })}
                    className="w-full h-8 rounded-md border border-input bg-card px-2 text-xs"
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="array">array</option>
                    <option value="object">object</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <Input
                    placeholder="Description..."
                    value={field.description}
                    onChange={(e) => updateInputField(idx, { description: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeInputField(idx)}
                    className="text-destructive h-8 px-2"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* System Instructions Editor */}
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileCode className="size-4 text-primary" />
            Skill Execution Instructions (Markdown)
          </h3>
          <p className="text-xs text-muted-foreground">
            The system guidance and protocol injected when this skill executes. Markdown formatting and numbered steps are supported.
          </p>
          <textarea
            rows={8}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full rounded-md border border-input bg-accent/20 p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Write skill execution guidance here..."
          />
        </Card>

        {/* Style / Voice Profile Template */}
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Wand2 className="size-4 text-primary" />
            Voice Profile & Persona Rules (`voice.md`)
          </h3>
          <p className="text-xs text-muted-foreground">
            Enforces persona guidelines, banned phrases, and vocabulary constraints during generation.
          </p>
          <textarea
            rows={5}
            value={voiceTemplate}
            onChange={(e) => setVoiceTemplate(e.target.value)}
            className="w-full rounded-md border border-input bg-accent/20 p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Voice & style constraints..."
          />
        </Card>
      </div>

      {/* Playground Drawer */}
      <Sheet open={playgroundOpen} onOpenChange={setPlaygroundOpen}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-6">
          <SheetHeader>
            <SheetTitle className="text-lg">Skill Playground Test</SheetTitle>
            <SheetDescription className="text-xs">
              Test your draft skill in a simulated execution before publishing.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-4 my-4 pr-1">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Test Inputs
              </h4>
              {inputFields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-medium">{f.name || f.key}</label>
                  <Input
                    placeholder={`Enter ${f.key}...`}
                    value={testInput[f.key] ?? ''}
                    onChange={(e) =>
                      setTestInput((prev) => ({
                        ...prev,
                        [f.key]: e.target.value,
                      }))
                    }
                    className="text-xs h-9"
                  />
                </div>
              ))}
            </div>

            <Button
              onClick={runTestExecution}
              disabled={testRunning}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {testRunning ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Testing in Sandbox...
                </>
              ) : (
                <>
                  <Play className="size-4" />
                  Run Test Execution
                </>
              )}
            </Button>

            {testResult && (
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5">
                    {testResult.ok ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <CheckCircle2 className="size-4 text-destructive" />
                    )}
                    Status: {testResult.ok ? 'SUCCESS' : 'FAILED'}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {testResult.latencyMs || 0}ms
                  </span>
                </div>

                <pre className="rounded-lg bg-accent/30 p-3 font-mono text-xs overflow-x-auto max-h-64 border border-border whitespace-pre-wrap">
                  {JSON.stringify(testResult.data || testResult.error, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </StudioPage>
  );
}
