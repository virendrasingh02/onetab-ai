/**
 * GIF search DTOs.
 *
 * The API proxies a provider (GIPHY) so the key stays server-side and the
 * client sees one stable shape regardless of provider. When no key is
 * configured the API serves {@link CURATED_GIFS} through the same contract, so
 * the picker's GIF tab works with zero configuration.
 */

export interface GifItem {
  /** Provider id, or `curated-*` for the bundled fallback set. */
  id: string;
  /** Human title, used as the alt text and the message caption. */
  title: string;
  /** The GIF to send — a reasonably sized `.gif` (GIPHY `fixed_height` / `downsized`). */
  url: string;
  /** A smaller still/loop for the grid thumbnail (GIPHY `fixed_height_small`). */
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
 * to be worth opening before anyone configures `GIPHY_API_KEY`. Shared by the
 * API (no-key path) and `@org/ui` (no provider path).
 */
export const CURATED_GIFS: GifItem[] = [
  {
    id: 'curated-tada',
    title: 'Celebration confetti',
    url: 'https://media.giphy.com/media/ePaw7nwYmSI1t389Sy/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/ePaw7nwYmSI1t389Sy/200.gif',
    width: 200,
    height: 200,
  },
  {
    id: 'curated-thumbsup',
    title: 'Thumbs up',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/200.gif',
    width: 268,
    height: 200,
  },
  {
    id: 'curated-clap',
    title: 'Applause',
    url: 'https://media.giphy.com/media/2xIOiAPXonois/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/2xIOiAPXonois/200.gif',
    width: 228,
    height: 200,
  },
  {
    id: 'curated-mindblown',
    title: 'Mind blown',
    url: 'https://media.giphy.com/media/5aLrlDiJPMPFS/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/5aLrlDiJPMPFS/200.gif',
    width: 172,
    height: 200,
  },
  {
    id: 'curated-facepalm',
    title: 'Facepalm',
    url: 'https://media.giphy.com/media/XD4qHZpkyUFfq/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/XD4qHZpkyUFfq/200.gif',
    width: 280,
    height: 200,
  },
  {
    id: 'curated-shrug',
    title: 'Shrug',
    url: 'https://media.giphy.com/media/jPAdK8Nfzzwt2/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/jPAdK8Nfzzwt2/200.gif',
    width: 352,
    height: 200,
  },
  {
    id: 'curated-eyeroll',
    title: 'Eye roll',
    url: 'https://media.giphy.com/media/dEdmW17JnZhiU/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/dEdmW17JnZhiU/200.gif',
    width: 356,
    height: 200,
  },
  {
    id: 'curated-typing',
    title: 'Typing furiously',
    url: 'https://media.giphy.com/media/7NoNw4pMNTvgc/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/7NoNw4pMNTvgc/200.gif',
    width: 200,
    height: 200,
  },
  {
    id: 'curated-facepalm-picard',
    title: 'Picard facepalm',
    url: 'https://media.giphy.com/media/o14YPU6vooy0o/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/o14YPU6vooy0o/200.gif',
    width: 262,
    height: 200,
  },
  {
    id: 'curated-dance',
    title: 'Happy dance',
    url: 'https://media.giphy.com/media/Xw6yFn7frR3Y4/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/Xw6yFn7frR3Y4/200.gif',
    width: 164,
    height: 200,
  },
  {
    id: 'curated-thisisfine',
    title: 'This is fine',
    url: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/QMHoU66sBXqqLqYvGO/200.gif',
    width: 356,
    height: 200,
  },
  {
    id: 'curated-nod',
    title: 'Agreeing nod',
    url: 'https://media.giphy.com/media/10Jpr9KSaXLchW/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/10Jpr9KSaXLchW/200.gif',
    width: 262,
    height: 200,
  },
];
