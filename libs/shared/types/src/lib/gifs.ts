/**
 * GIF search DTOs.
 *
 * The API proxies a provider (Tenor) so the key stays server-side and the
 * client sees one stable shape regardless of provider. When no key is
 * configured the API serves {@link CURATED_GIFS} through the same contract, so
 * the picker's GIF tab works with zero configuration.
 */

export interface GifItem {
  /** Provider id, or `curated-*` for the bundled fallback set. */
  id: string;
  /** Human title, used as the alt text and the message caption. */
  title: string;
  /** The GIF to send — a reasonably sized `.gif` (Tenor `tinygif`). */
  url: string;
  /** A smaller still/loop for the grid thumbnail (Tenor `nanogif`). */
  previewUrl: string;
  width: number;
  height: number;
}

export interface GifPage {
  items: GifItem[];
  /** Opaque cursor for the next page; empty when there is no more. */
  next: string;
}

/**
 * Offline fallback. Small, broadly useful reactions — enough for the GIF tab
 * to be worth opening before anyone configures `TENOR_API_KEY`. Shared by the
 * API (no-key path) and `@org/ui` (no provider path).
 */
export const CURATED_GIFS: GifItem[] = [
  {
    id: 'curated-tada',
    title: 'Celebration confetti',
    url: 'https://media.tenor.com/EW4t0xjw7UwAAAAC/celebrate-celebration.gif',
    previewUrl: 'https://media.tenor.com/EW4t0xjw7UwAAAAM/celebrate-celebration.gif',
    width: 220,
    height: 220,
  },
  {
    id: 'curated-thumbsup',
    title: 'Thumbs up',
    url: 'https://media.tenor.com/8ISvR0aDVVIAAAAC/thumbs-up-thumbs-up-gif.gif',
    previewUrl: 'https://media.tenor.com/8ISvR0aDVVIAAAAM/thumbs-up-thumbs-up-gif.gif',
    width: 220,
    height: 220,
  },
  {
    id: 'curated-clap',
    title: 'Applause',
    url: 'https://media.tenor.com/0KMrEg5NLmcAAAAC/clapping-applause.gif',
    previewUrl: 'https://media.tenor.com/0KMrEg5NLmcAAAAM/clapping-applause.gif',
    width: 220,
    height: 165,
  },
  {
    id: 'curated-mindblown',
    title: 'Mind blown',
    url: 'https://media.tenor.com/1Iae2wZ8mVYAAAAC/mind-blown-explosion.gif',
    previewUrl: 'https://media.tenor.com/1Iae2wZ8mVYAAAAM/mind-blown-explosion.gif',
    width: 220,
    height: 124,
  },
  {
    id: 'curated-facepalm',
    title: 'Facepalm',
    url: 'https://media.tenor.com/mfEt6QVQ2GsAAAAC/facepalm-really.gif',
    previewUrl: 'https://media.tenor.com/mfEt6QVQ2GsAAAAM/facepalm-really.gif',
    width: 220,
    height: 165,
  },
  {
    id: 'curated-shrug',
    title: 'Shrug',
    url: 'https://media.tenor.com/xnHZ1IVN6pIAAAAC/shrug-i-dont-know.gif',
    previewUrl: 'https://media.tenor.com/xnHZ1IVN6pIAAAAM/shrug-i-dont-know.gif',
    width: 220,
    height: 124,
  },
  {
    id: 'curated-eyeroll',
    title: 'Eye roll',
    url: 'https://media.tenor.com/Sm5W3gZzY3kAAAAC/eye-roll-annoyed.gif',
    previewUrl: 'https://media.tenor.com/Sm5W3gZzY3kAAAAM/eye-roll-annoyed.gif',
    width: 220,
    height: 165,
  },
  {
    id: 'curated-typing',
    title: 'Typing furiously',
    url: 'https://media.tenor.com/Hrf1DUj6-b0AAAAC/typing-fast-typing.gif',
    previewUrl: 'https://media.tenor.com/Hrf1DUj6-b0AAAAM/typing-fast-typing.gif',
    width: 220,
    height: 124,
  },
  {
    id: 'curated-facepalm-picard',
    title: 'Picard facepalm',
    url: 'https://media.tenor.com/0nWyEwyEwZgAAAAC/picard-facepalm.gif',
    previewUrl: 'https://media.tenor.com/0nWyEwyEwZgAAAAM/picard-facepalm.gif',
    width: 220,
    height: 168,
  },
  {
    id: 'curated-dance',
    title: 'Happy dance',
    url: 'https://media.tenor.com/dSEQF7DCS1kAAAAC/dancing-happy.gif',
    previewUrl: 'https://media.tenor.com/dSEQF7DCS1kAAAAM/dancing-happy.gif',
    width: 220,
    height: 220,
  },
  {
    id: 'curated-thisisfine',
    title: 'This is fine',
    url: 'https://media.tenor.com/Gg7Yr8Bg2iEAAAAC/this-is-fine-fire.gif',
    previewUrl: 'https://media.tenor.com/Gg7Yr8Bg2iEAAAAM/this-is-fine-fire.gif',
    width: 220,
    height: 124,
  },
  {
    id: 'curated-nod',
    title: 'Agreeing nod',
    url: 'https://media.tenor.com/8w1nigncEHkAAAAC/nod-yes.gif',
    previewUrl: 'https://media.tenor.com/8w1nigncEHkAAAAM/nod-yes.gif',
    width: 220,
    height: 165,
  },
];
