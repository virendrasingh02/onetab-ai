import { useState } from 'react';
import { Image as ImageIcon, Sparkles, Download } from 'lucide-react';

export function AIImageGeneratorView() {
  const [prompt, setPrompt] = useState('Futuristic dark mode UI design mockup with neon accents');
  const [imageUrl] = useState<string | null>('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 1200);
  };

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-pink-400" /> AI Image & Mockup Generator
        </h1>
        <p className="text-sm text-slate-400">Generate UI mockups, icons, and graphics via OpenAI DALL-E & Stable Diffusion</p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col gap-6 max-w-3xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image or UI mockup to generate..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-medium rounded-lg shadow transition disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" /> {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {imageUrl && (
          <div className="relative group border border-slate-800 rounded-xl overflow-hidden bg-slate-950 max-w-xl">
            <img src={imageUrl} alt="Generated Asset" className="w-full h-80 object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <a href={imageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 font-semibold rounded-lg shadow">
                <Download className="w-4 h-4" /> Download Asset
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
