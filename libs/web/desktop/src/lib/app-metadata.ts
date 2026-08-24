import { useEffect, useState } from 'react';
import { getDesktopApi, type DesktopAppMetadata } from './desktop-api.js';

export const DEFAULT_APP_METADATA: DesktopAppMetadata = {
  name: 'onetab-ai',
  productName: 'OneTab AI',
  version: '0.0.1',
  build: '2026.08.1',
  publisher: 'OneTab AI Inc.',
  copyright: 'Copyright © OneTab AI Inc. All rights reserved.',
  website: 'https://onetab.ai',
  supportUrl: 'https://onetab.ai/support',
  privacyUrl: 'https://onetab.ai/privacy',
  termsUrl: 'https://onetab.ai/terms',
  license: 'MIT / Proprietary Enterprise',
  description: 'OneTab AI — Unified Collaborative Workspace & AI Agents Platform',
};

let cachedMetadata: DesktopAppMetadata = DEFAULT_APP_METADATA;

export function getAppMetadata(): DesktopAppMetadata {
  return cachedMetadata;
}

export function useAppMetadata(): DesktopAppMetadata {
  const [metadata, setMetadata] = useState<DesktopAppMetadata>(cachedMetadata);

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;

    let active = true;
    void api.getAppMetadata().then((data) => {
      if (active && data) {
        cachedMetadata = data;
        setMetadata(data);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return metadata;
}
