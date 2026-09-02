import { Button } from '@org/ui';
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
        <Link to="/" className="text-subtle hover:text-foreground transition-colors">
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
            className="w-full text-center font-mono text-2xl font-bold tracking-widest h-14 uppercase rounded-input bg-surface border border-input text-foreground placeholder:text-subtle outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 transition-[color,background-color,border-color,box-shadow]"
            maxLength={7}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <p className="text-xs text-muted-foreground">
          On your desktop app login screen, choose <strong>Sign in with Mobile</strong> to generate a code.
        </p>

        <Button
          type="submit"
          size="lg"
          className="w-full mt-2"
          disabled={code.replace(/[^A-Z0-9]/g, '').length < 6}
          trailingIcon={<ArrowRight className="size-4" />}
        >
          Continue
        </Button>
      </form>
    </AuthLayout>
  );
}

