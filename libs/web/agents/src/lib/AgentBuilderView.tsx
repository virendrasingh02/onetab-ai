import {
  Button,
  Input,
  Label,
  Page,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@org/ui';
import { Bot, Save } from 'lucide-react';
import { useState } from 'react';

const PROVIDERS = [
  { value: 'ollama', label: 'Ollama (local LLM)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
];

export function AgentBuilderView() {
  const [name, setName] = useState('Workspace Security Guard');
  const [role, setRole] = useState('Security auditor');
  const [provider, setProvider] = useState('ollama');
  const [model, setModel] = useState('llama3');
  const [systemPrompt, setSystemPrompt] = useState(
    'You are an autonomous AI security auditor. Inspect workspace activities, audit user permissions, and report suspicious actions.',
  );

  return (
    <Page>
      <PageHeader
        title="Agent builder"
        description="Configure an agent's instructions, model and permissions."
        icon={<Bot />}
        accent="violet"
        actions={
          <Button form="agent-form" type="submit" leadingIcon={<Save />}>
            Save agent
          </Button>
        }
      />

      {/*
        Every control is now label-associated via htmlFor/id — the previous
        markup used bare <label> elements that named nothing.
      */}
      <Panel className="max-w-2xl">
        <form
          id="agent-form"
          className="gap-5 flex flex-col"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="gap-4 sm:grid-cols-2 grid">
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">Agent name</Label>
              <Input
                id="agent-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-role">Role</Label>
              <Input
                id="agent-role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
            </div>
          </div>

          <div className="gap-4 sm:grid-cols-2 grid">
            <div className="space-y-1.5">
              <Label htmlFor="agent-provider">AI provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="agent-provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-model">Model</Label>
              <Input
                id="agent-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-prompt">System instructions</Label>
            <Textarea
              id="agent-prompt"
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              rows={5}
              className="text-sm resize-none font-mono"
              aria-describedby="agent-prompt-hint"
            />
            <p id="agent-prompt-hint" className="text-xs text-muted-foreground">
              Describe how the agent should behave and what it may access.
            </p>
          </div>
        </form>
      </Panel>
    </Page>
  );
}
