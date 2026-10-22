import { configureCaptcha } from '@org/api-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/app';
import { Providers } from './app/providers';
import './styles.css';

// Invisible CAPTCHA on public auth routes; a no-op without a site key.
configureCaptcha(import.meta.env['VITE_CAPTCHA_SITE_KEY']);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root was not found in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <App />
      </Providers>
    </BrowserRouter>
  </StrictMode>,
);
