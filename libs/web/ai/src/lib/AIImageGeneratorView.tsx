import { Button, Input, Page, PageHeader, Panel } from '@org/ui';
import { Download, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useState } from 'react';

export function AIImageGeneratorView() {
  const [prompt, setPrompt] = useState(
    'Futuristic dark mode UI design mockup with neon accents',
  );
  const [imageUrl] = useState<string | null>(
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 1200);
  };

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
            handleGenerate();
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
            loading={isGenerating}
            disabled={!prompt.trim()}
            leadingIcon={<Sparkles />}
            className="shrink-0"
          >
            {isGenerating ? 'Generating…' : 'Generate'}
          </Button>
        </form>

        {imageUrl ? (
          <figure className="group mt-6 max-w-xl relative overflow-hidden rounded-xl border bg-background">
            <img
              src={imageUrl}
              alt={`Generated asset for the prompt: ${prompt}`}
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
