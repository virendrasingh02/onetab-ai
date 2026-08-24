import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@org/ui';
import { CheckCircle2, Laptop } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

export function DesktopAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const [attempted, setAttempted] = useState(false);

  const desktopDeepLink = code && state ? `onetab://auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}` : 'onetab://open';

  useEffect(() => {
    if (code && state && !attempted) {
      setAttempted(true);
      window.location.href = desktopDeepLink;
    }
  }, [code, state, attempted, desktopDeepLink]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <CheckCircle2 className="size-6 text-primary" />
          </div>
          <CardTitle className="text-lg">Authentication Successful</CardTitle>
          <CardDescription className="text-xs">
            Redirecting to OneTab AI Desktop application…
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2 text-center">
          <p className="text-xs text-muted-foreground">
            If your desktop app did not open automatically, click the button below to complete sign-in.
          </p>

          <Button
            className="w-full gap-2"
            onClick={() => {
              window.location.href = desktopDeepLink;
            }}
          >
            <Laptop className="size-4" />
            <span>Open Desktop App</span>
          </Button>

          <div className="pt-2">
            <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground">
              <Link to="/">Continue in Web Browser instead</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
