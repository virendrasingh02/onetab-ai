import { useState } from 'react';
import { Button, Card, TextField } from './ui';

export interface AgentFormValues {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  welcomeMessage: string;
}

/** The fields of an agent that make sense to edit on a phone. Graphs and tools stay in Studio. */
export function AgentForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial: AgentFormValues;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: AgentFormValues) => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof AgentFormValues) => (text: string) =>
    setValues((v) => ({ ...v, [key]: text }));

  const submit = () => {
    if (!values.name.trim()) {
      setError('Give the agent a name.');
      return;
    }
    setError(null);
    onSubmit({
      name: values.name.trim(),
      role: values.role.trim(),
      description: values.description.trim(),
      systemPrompt: values.systemPrompt.trim(),
      welcomeMessage: values.welcomeMessage.trim(),
    });
  };

  return (
    <Card>
      <TextField
        label="Name"
        value={values.name}
        onChangeText={set('name')}
        error={error}
        maxLength={80}
      />
      <TextField
        label="Role"
        value={values.role}
        onChangeText={set('role')}
        placeholder="e.g. Support triage"
        maxLength={120}
      />
      <TextField
        label="Description"
        value={values.description}
        onChangeText={set('description')}
        multiline
        maxLength={500}
      />
      <TextField
        label="Instructions"
        value={values.systemPrompt}
        onChangeText={set('systemPrompt')}
        multiline
        placeholder="How the agent should behave, what it may and may not do…"
      />
      <TextField
        label="Welcome message"
        value={values.welcomeMessage}
        onChangeText={set('welcomeMessage')}
        multiline
        maxLength={500}
      />
      <Button label={submitLabel} onPress={submit} loading={submitting} />
    </Card>
  );
}
