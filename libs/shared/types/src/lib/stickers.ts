/**
 * Sticker DTOs and data models.
 *
 * Stickers are data-driven packs of transparent-background graphic reactions.
 * When no remote provider/server is configured, the platform serves
 * {@link CURATED_STICKER_PACKS} so the sticker tab is immediately functional
 * with rich, high-quality stickers out of the box.
 */

export interface StickerItem {
  /** Unique sticker identifier. */
  id: string;
  /** ID of the pack this sticker belongs to. */
  packId: string;
  /** Display name/title for the sticker. */
  name: string;
  /** Full resolution media URL (PNG, WebP, GIF, or SVG). */
  url: string;
  /** Optional smaller thumbnail URL for the grid. */
  thumbnail?: string;
  /** Accessibility text and fallback label. */
  alt: string;
  /** Search keywords and synonyms. */
  tags?: string[];
  /** Optional extra metadata (dimensions, creator, license, etc.). */
  metadata?: Record<string, unknown>;
}

export interface StickerPack {
  /** Unique pack identifier. */
  id: string;
  /** Human-readable pack name. */
  name: string;
  /** Icon representation (emoji or image URL). */
  icon?: string;
  /** List of stickers in this pack. */
  stickers: StickerItem[];
}

/**
 * Curated offline fallback sticker packs.
 * High-quality transparent reaction stickers with reliable, fast public CDNs.
 */
export const CURATED_STICKER_PACKS: StickerPack[] = [
  {
    id: 'pack-party-vibes',
    name: 'Party Vibes',
    icon: '🎉',
    stickers: [
      {
        id: 'pv-celebrate',
        packId: 'pack-party-vibes',
        name: 'Celebrate',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f389.svg',
        alt: 'Party Popper Confetti',
        tags: ['party', 'celebrate', 'tada', 'congrats', 'woohoo'],
      },
      {
        id: 'pv-sparkles',
        packId: 'pack-party-vibes',
        name: 'Sparkles',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2728.svg',
        alt: 'Magic Sparkles',
        tags: ['sparkles', 'magic', 'shine', 'special', 'clean'],
      },
      {
        id: 'pv-fire',
        packId: 'pack-party-vibes',
        name: 'Lit Fire',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f525.svg',
        alt: 'Fire Blaze',
        tags: ['fire', 'hot', 'lit', 'flame', 'hype'],
      },
      {
        id: 'pv-rocket',
        packId: 'pack-party-vibes',
        name: 'To The Moon',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f680.svg',
        alt: 'Rocket Ship Launch',
        tags: ['rocket', 'launch', 'ship', 'moon', 'fast', 'speed'],
      },
      {
        id: 'pv-trophy',
        packId: 'pack-party-vibes',
        name: 'Winner Trophy',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3c6.svg',
        alt: 'Gold Trophy Cup',
        tags: ['trophy', 'win', 'champion', 'first', 'success'],
      },
      {
        id: 'pv-crown',
        packId: 'pack-party-vibes',
        name: 'Royal Crown',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f451.svg',
        alt: 'Gold Crown',
        tags: ['crown', 'king', 'queen', 'boss', 'goat'],
      },
      {
        id: 'pv-disco',
        packId: 'pack-party-vibes',
        name: 'Disco Ball',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1faa9.svg',
        alt: 'Mirror Disco Ball',
        tags: ['disco', 'dance', 'music', 'party', 'fun'],
      },
      {
        id: 'pv-clinking-glasses',
        packId: 'pack-party-vibes',
        name: 'Cheers',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f942.svg',
        alt: 'Cheers Toasting Glasses',
        tags: ['cheers', 'toast', 'celebration', 'drinks'],
      },
    ],
  },
  {
    id: 'pack-dev-life',
    name: 'Dev Life',
    icon: '💻',
    stickers: [
      {
        id: 'dl-bug',
        packId: 'pack-dev-life',
        name: 'Bug',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f41b.svg',
        alt: 'Green Bug',
        tags: ['bug', 'issue', 'glitch', 'error', 'defect'],
      },
      {
        id: 'dl-shipit',
        packId: 'pack-dev-life',
        name: 'Ship It',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f6a2.svg',
        alt: 'Cargo Ship',
        tags: ['ship', 'deploy', 'release', 'production', 'prod'],
      },
      {
        id: 'dl-coffee',
        packId: 'pack-dev-life',
        name: 'Coffee Fuel',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2615.svg',
        alt: 'Hot Coffee Cup',
        tags: ['coffee', 'tea', 'caffeine', 'energy', 'morning', 'code'],
      },
      {
        id: 'dl-laptop',
        packId: 'pack-dev-life',
        name: 'Hacking',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4bb.svg',
        alt: 'Personal Computer Laptop',
        tags: ['computer', 'laptop', 'code', 'dev', 'work'],
      },
      {
        id: 'dl-brain',
        packId: 'pack-dev-life',
        name: 'Big Brain',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f9e0.svg',
        alt: 'Brain',
        tags: ['brain', 'smart', 'genius', 'think', 'solve'],
      },
      {
        id: 'dl-detective',
        packId: 'pack-dev-life',
        name: 'Debugging',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f575.svg',
        alt: 'Detective Spy',
        tags: ['detective', 'debug', 'investigate', 'search', 'inspect'],
      },
      {
        id: 'dl-wrench',
        packId: 'pack-dev-life',
        name: 'Refactor',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f527.svg',
        alt: 'Wrench Tool',
        tags: ['wrench', 'fix', 'refactor', 'maintenance', 'tools'],
      },
      {
        id: 'dl-lock',
        packId: 'pack-dev-life',
        name: 'Secure',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f512.svg',
        alt: 'Security Padlock',
        tags: ['lock', 'security', 'safe', 'auth', 'pass'],
      },
    ],
  },
  {
    id: 'pack-cute-critters',
    name: 'Cute Critters',
    icon: '🐱',
    stickers: [
      {
        id: 'cc-cat-love',
        packId: 'pack-cute-critters',
        name: 'Heart Eyes Cat',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f63b.svg',
        alt: 'Smiling Cat With Heart Eyes',
        tags: ['cat', 'love', 'cute', 'heart', 'adore'],
      },
      {
        id: 'cc-cat-joy',
        packId: 'pack-cute-critters',
        name: 'Laughing Cat',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f639.svg',
        alt: 'Cat With Tears Of Joy',
        tags: ['cat', 'haha', 'lmao', 'laugh', 'funny'],
      },
      {
        id: 'cc-dog-happy',
        packId: 'pack-cute-critters',
        name: 'Happy Doggo',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f436.svg',
        alt: 'Cute Dog Face',
        tags: ['dog', 'puppy', 'good boy', 'friendly', 'pet'],
      },
      {
        id: 'cc-fox-clever',
        packId: 'pack-cute-critters',
        name: 'Clever Fox',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f98a.svg',
        alt: 'Orange Fox Face',
        tags: ['fox', 'smart', 'clever', 'wild'],
      },
      {
        id: 'cc-panda-chill',
        packId: 'pack-cute-critters',
        name: 'Chill Panda',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f43c.svg',
        alt: 'Panda Bear Face',
        tags: ['panda', 'chill', 'relax', 'bear', 'cute'],
      },
      {
        id: 'cc-unicorn',
        packId: 'pack-cute-critters',
        name: 'Magical Unicorn',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f984.svg',
        alt: 'Unicorn Face',
        tags: ['unicorn', 'magic', 'dream', 'rare'],
      },
      {
        id: 'cc-sloth',
        packId: 'pack-cute-critters',
        name: 'Slow Sloth',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f9a5.svg',
        alt: 'Hanging Sloth',
        tags: ['sloth', 'slow', 'monday', 'tired', 'relax'],
      },
      {
        id: 'cc-penguin',
        packId: 'pack-cute-critters',
        name: 'Cozy Penguin',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f427.svg',
        alt: 'Penguin',
        tags: ['penguin', 'cool', 'linux', 'cute', 'ice'],
      },
    ],
  },
  {
    id: 'pack-mood-reactions',
    name: 'Mood & Reactions',
    icon: '⚡',
    stickers: [
      {
        id: 'mr-mind-blown',
        packId: 'pack-mood-reactions',
        name: 'Mind Blown',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f92f.svg',
        alt: 'Exploding Head Mind Blown',
        tags: ['mind blown', 'wow', 'shook', 'insane', 'shocked'],
      },
      {
        id: 'mr-sunglasses',
        packId: 'pack-mood-reactions',
        name: 'Cool Sunglasses',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f60e.svg',
        alt: 'Smiling Face With Sunglasses',
        tags: ['cool', 'chill', 'sunglasses', 'swag', 'smooth'],
      },
      {
        id: 'mr-salute',
        packId: 'pack-mood-reactions',
        name: 'Respect Salute',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1fae1.svg',
        alt: 'Saluting Face',
        tags: ['salute', 'respect', 'yes sir', 'understood', 'o7'],
      },
      {
        id: 'mr-melt',
        packId: 'pack-mood-reactions',
        name: 'Melting Away',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1fae0.svg',
        alt: 'Melting Face',
        tags: ['melting', 'overwhelmed', 'done', 'hot', 'tired'],
      },
      {
        id: 'mr-pleading',
        packId: 'pack-mood-reactions',
        name: 'Please',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f97a.svg',
        alt: 'Pleading Face With Puppy Eyes',
        tags: ['please', 'begging', 'puppy eyes', 'request'],
      },
      {
        id: 'mr-skull',
        packId: 'pack-mood-reactions',
        name: 'Dead / I Cant',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f480.svg',
        alt: 'Skull',
        tags: ['dead', 'dying', 'skull', 'rip', 'laugh'],
      },
      {
        id: 'mr-100',
        packId: 'pack-mood-reactions',
        name: '100 Percent',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4af.svg',
        alt: 'Hundred Points Symbol',
        tags: ['100', 'perfect', 'agreed', 'facts', 'absolute'],
      },
      {
        id: 'mr-clapping',
        packId: 'pack-mood-reactions',
        name: 'Round of Applause',
        url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f44f.svg',
        alt: 'Clapping Hands',
        tags: ['clap', 'applause', 'bravo', 'congrats', 'kudos'],
      },
    ],
  },
];
