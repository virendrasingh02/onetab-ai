import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
} from '@org/ui';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <KeyRound className="size-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Device Pairing</CardTitle>
          <CardDescription className="text-xs">
            Enter the 6-character code displayed on your desktop screen.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-1">
            <div className="space-y-2 text-center">
              <Input
                type="text"
                autoFocus
                placeholder="ABC-123"
                value={code}
                onChange={handleInputChange}
                className="text-center font-mono text-2xl font-bold tracking-widest h-14 uppercase"
                maxLength={7}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              On your desktop app login screen, choose <strong>Sign in with Mobile</strong> to generate a code.
            </p>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              className="w-full gap-2 h-10"
              disabled={code.replace(/[^A-Z0-9]/g, '').length < 6}
            >
              <span>Continue</span>
              <ArrowRight className="size-4" />
            </Button>

            <Button variant="ghost" asChild className="w-full text-xs text-muted-foreground">
              <Link to="/">Cancel</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
