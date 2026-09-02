import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';

export function MobileDevicePairPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (val.length > 6) val = val.slice(0, 6);
    if (val.length > 3) {
      val = `${val.slice(0, 3)}-${val.slice(3)}`;
    }
    setCode(val);
    if (error) setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length < 6) {
      setError('Please enter a complete 6-character pairing code.');
      return;
    }
    navigate(`/auth/device?code=${encodeURIComponent(code)}`);
  };

  return (
    <AuthLayout
      title="Device Pairing"
      subtitle="Enter the 6-character code displayed on your desktop screen."
      footer={
        <Link to="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          Cancel
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-center">
        <div className="space-y-2">
          <input
            type="text"
            autoFocus
            placeholder="ABC-123"
            value={code}
            onChange={handleInputChange}
            className="w-full text-center font-mono text-2xl font-bold tracking-widest h-14 uppercase rounded-lg bg-[#121214] border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
            maxLength={7}
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>

        <p className="text-xs text-zinc-400">
          On your desktop app login screen, choose <strong>Sign in with Mobile</strong> to generate a code.
        </p>

        <button
          type="submit"
          disabled={code.replace(/[^A-Z0-9]/g, '').length < 6}
          className="w-full h-10 rounded-lg bg-white text-black hover:bg-zinc-200 font-medium text-xs sm:text-sm transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          <span>Continue</span>
          <ArrowRight className="size-4" />
        </button>
      </form>
    </AuthLayout>
  );
}

