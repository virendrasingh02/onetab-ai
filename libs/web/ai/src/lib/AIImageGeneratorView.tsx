import { Button, EmptyState, Input, Page, PageHeader, Panel } from '@org/ui';
import {
  Download,
  Image as ImageIcon,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { useAIImageGeneration } from './use-ai.js';

export function AIImageGeneratorView() {
  const [prompt, setPrompt] = useState('');
  /** The prompt the visible image was actually generated from. */
  const [generatedFrom, setGeneratedFrom] = useState('');
  const generate = useAIImageGeneration();

  const imageUrl = generate.data?.imageUrl ?? null;

  return (
    <Page>
      <PageHeader
        title="Image generator"
        description="Generate UI mockups, icons and graphics from a prompt."
        icon={<ImageIcon />}
        accent="pink"
      />

      <Panel className="max-w-3xl">
        <form
          className="gap-2 sm:flex-row flex flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = prompt.trim();
            if (!trimmed || generate.isPending) return;
            setGeneratedFrom(trimmed);
            generate.mutate({ prompt: trimmed });
          }}
        >
          <Input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the image or UI mockup to generate…"
            aria-label="Image prompt"
          />
          <Button
            type="submit"
            loading={generate.isPending}
            disabled={!prompt.trim()}
            leadingIcon={<Sparkles />}
            className="shrink-0"
          >
            {generate.isPending ? 'Generating…' : 'Generate'}
          </Button>
        </form>

        {generate.isError ? (
          <div className="mt-6">
            <EmptyState
              size="sm"
              icon={<TriangleAlert />}
              title="Generation failed"
              description={
                generate.error instanceof Error
                  ? generate.error.message
                  : 'The image could not be generated.'
              }
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generate.mutate({ prompt: generatedFrom })}
                  disabled={!generatedFrom}
                >
                  Try again
                </Button>
              }
            />
          </div>
        ) : null}

        {imageUrl ? (
          <figure className="group mt-6 max-w-xl relative overflow-hidden rounded-xl border bg-background">
            <img
              src={imageUrl}
              alt={`Generated asset for the prompt: ${generatedFrom}`}
              className="h-80 w-full object-cover"
            />
            {/*
              The download affordance is always in the DOM and reachable by
              keyboard; hover only changes its opacity, and focus reveals it so
              it is not mouse-only.
            */}
            <figcaption className="inset-0 bg-black/50 absolute flex items-center justify-center opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100 focus-within:opacity-100">
              <Button asChild variant="secondary" size="sm">
                <a href={imageUrl} target="_blank" rel="noreferrer">
                  <Download className="size-4" aria-hidden />
                  Download asset
                </a>
              </Button>
            </figcaption>
          </figure>
        ) : null}
      </Panel>
    </Page>
  );
}
