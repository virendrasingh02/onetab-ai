import { Button, ScrollArea } from '@org/ui';
import { cn } from '@org/utils';
import {
  Film,
  Flame,
  Grid,
  PartyPopper,
  Search,
  Smile,
  Sparkles,
  ThumbsUp,
  X,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';

export interface DiscordEmojiGifPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (gifUrl: string, title?: string) => void;
  onClose: () => void;
  defaultTab?: 'emoji' | 'gif';
}

export interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: { char: string; name: string; keywords: string[] }[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'frequent',
    name: 'Frequently Used',
    icon: '⚡',
    emojis: [
      { char: '👍', name: '+1', keywords: ['thumb', 'up', 'plus1', 'yes', 'ok'] },
      { char: '🔥', name: 'fire', keywords: ['hot', 'flame', 'lit'] },
      { char: '❤️', name: 'heart', keywords: ['love', 'like'] },
      { char: '🎉', name: 'tada', keywords: ['party', 'celebrate', 'congrats'] },
      { char: '😄', name: 'smile', keywords: ['happy', 'joy', 'giggle'] },
      { char: '🚀', name: 'rocket', keywords: ['ship', 'launch', 'fast'] },
      { char: '👀', name: 'eyes', keywords: ['look', 'see', 'watching'] },
      { char: '✅', name: 'white_check_mark', keywords: ['done', 'check', 'ok'] },
    ],
  },
  {
    id: 'people',
    name: 'Smileys & People',
    icon: '😀',
    emojis: [
      { char: '😀', name: 'grinning', keywords: ['smile', 'happy'] },
      { char: '😃', name: 'smiley', keywords: ['happy', 'joy'] },
      { char: '😄', name: 'smile', keywords: ['happy', 'laugh'] },
      { char: '😁', name: 'grin', keywords: ['happy', 'teeth'] },
      { char: '😅', name: 'sweat_smile', keywords: ['hot', 'laugh'] },
      { char: '🤣', name: 'rofl', keywords: ['lol', 'laugh'] },
      { char: '😂', name: 'joy', keywords: ['cry', 'laugh'] },
      { char: '😉', name: 'wink', keywords: ['flirt'] },
      { char: '😊', name: 'blush', keywords: ['cute', 'happy'] },
      { char: '😇', name: 'halo', keywords: ['angel'] },
      { char: '🥰', name: 'smiling_face_with_3_hearts', keywords: ['love'] },
      { char: '😍', name: 'heart_eyes', keywords: ['love', 'crush'] },
      { char: '🤩', name: 'star_struck', keywords: ['wow', 'eyes'] },
      { char: '😘', name: 'kissing_heart', keywords: ['love'] },
      { char: '😋', name: 'yum', keywords: ['food', 'delicious'] },
      { char: '😛', name: 'stuck_out_tongue', keywords: ['funny'] },
      { char: '😜', name: 'stuck_out_tongue_winking_eye', keywords: ['joke'] },
      { char: '🤪', name: 'zany_face', keywords: ['crazy'] },
      { char: '😝', name: 'stuck_out_tongue_closed_eyes', keywords: ['mischief'] },
      { char: '🤑', name: 'money_mouth', keywords: ['cash', 'rich'] },
      { char: '🤗', name: 'hugs', keywords: ['hug'] },
      { char: '🤭', name: 'hand_over_mouth', keywords: ['oops'] },
      { char: '🤫', name: 'shushing_face', keywords: ['quiet', 'secret'] },
      { char: '🤔', name: 'thinking', keywords: ['hmm', 'think'] },
      { char: '🤐', name: 'zipper_mouth', keywords: ['silent'] },
      { char: '🤨', name: 'raised_eyebrow', keywords: ['skeptical'] },
      { char: '😐', name: 'neutral_face', keywords: ['meh'] },
      { char: '😑', name: 'expressionless', keywords: ['blank'] },
      { char: '😶', name: 'no_mouth', keywords: ['mute'] },
      { char: '😏', name: 'smirk', keywords: ['smug'] },
      { char: '😒', name: 'unamused', keywords: ['bored'] },
      { char: '🙄', name: 'roll_eyes', keywords: ['whatever'] },
      { char: '😬', name: 'grimacing', keywords: ['yikes'] },
      { char: '😮‍💨', name: 'exhale', keywords: ['sigh', 'gasp'] },
      { char: '🤥', name: 'lying_face', keywords: ['pinocchio'] },
      { char: '😌', name: 'relieved', keywords: ['calm'] },
      { char: '😔', name: 'pensive', keywords: ['sad'] },
      { char: '😪', name: 'sleepy', keywords: ['tired'] },
      { char: '🤤', name: 'drooling_face', keywords: ['want'] },
      { char: '😴', name: 'sleeping', keywords: ['zzz'] },
      { char: '😷', name: 'mask', keywords: ['sick'] },
      { char: '🤒', name: 'thermometer_face', keywords: ['fever'] },
      { char: '🤕', name: 'head_bandage', keywords: ['hurt'] },
      { char: '🤢', name: 'nauseated_face', keywords: ['gross'] },
      { char: '🤮', name: 'vomiting', keywords: ['sick'] },
      { char: '🤧', name: 'sneezing', keywords: ['achoo'] },
      { char: '🥵', name: 'hot_face', keywords: ['heat'] },
      { char: '🥶', name: 'cold_face', keywords: ['freeze'] },
      { char: '🥴', name: 'woozy_face', keywords: ['drunk'] },
      { char: '😵', name: 'dizzy', keywords: ['dead'] },
      { char: '🤯', name: 'exploding_head', keywords: ['mindblown'] },
      { char: '🤠', name: 'cowboy', keywords: ['yeehaw'] },
      { char: '🥳', name: 'partying_face', keywords: ['celebrate'] },
      { char: '😎', name: 'sunglasses', keywords: ['cool'] },
      { char: '🤓', name: 'nerd', keywords: ['geek'] },
      { char: '🧐', name: 'monocle', keywords: ['inspect'] },
      { char: '😕', name: 'confused', keywords: ['what'] },
      { char: '😟', name: 'worried', keywords: ['anxious'] },
      { char: '🙁', name: 'slightly_frowning', keywords: ['sad'] },
      { char: '😮', name: 'open_mouth', keywords: ['surprised', 'wow'] },
      { char: '😯', name: 'hushed', keywords: ['quiet'] },
      { char: '😲', name: 'astonished', keywords: ['shocked'] },
      { char: '😳', name: 'flushed', keywords: ['blush', 'shock'] },
      { char: '🥺', name: 'pleading_face', keywords: ['please', 'puppy'] },
      { char: '😦', name: 'frowning_with_open_mouth', keywords: ['shock'] },
      { char: '😨', name: 'fearful', keywords: ['scared'] },
      { char: '😰', name: 'cold_sweat', keywords: ['nervous'] },
      { char: '😥', name: 'disappointed_relieved', keywords: ['whew'] },
      { char: '😢', name: 'cry', keywords: ['sad', 'tear'] },
      { char: '😭', name: 'sob', keywords: ['cry', 'bawl'] },
      { char: '😱', name: 'scream', keywords: ['horror'] },
      { char: '😖', name: 'confounded', keywords: ['frustrated'] },
      { char: '😣', name: 'persevere', keywords: ['struggling'] },
      { char: '😞', name: 'disappointed', keywords: ['down'] },
      { char: '😓', name: 'sweat', keywords: ['phew'] },
      { char: '😩', name: 'weary', keywords: ['tired'] },
      { char: '😫', name: 'tired_face', keywords: ['exhausted'] },
      { char: '🥱', name: 'yawning_face', keywords: ['sleepy'] },
      { char: '😤', name: 'triumph', keywords: ['steam', 'angry'] },
      { char: '😡', name: 'rage', keywords: ['mad', 'angry'] },
      { char: '😠', name: 'angry', keywords: ['mad'] },
      { char: '🤬', name: 'cursing', keywords: ['swear'] },
      { char: '👿', name: 'imp', keywords: ['devil'] },
      { char: '💀', name: 'skull', keywords: ['dead', 'skeleton', 'lol'] },
      { char: '💩', name: 'poop', keywords: ['pooper'] },
      { char: '🤡', name: 'clown', keywords: ['joke'] },
      { char: '👹', name: 'ogre', keywords: ['monster'] },
      { char: '👻', name: 'ghost', keywords: ['halloween'] },
      { char: '👽', name: 'alien', keywords: ['ufo'] },
      { char: '🤖', name: 'robot', keywords: ['bot', 'ai'] },
    ],
  },
  {
    id: 'nature',
    name: 'Animals & Nature',
    icon: '🐶',
    emojis: [
      { char: '🐶', name: 'dog', keywords: ['puppy', 'pet'] },
      { char: '🐱', name: 'cat', keywords: ['kitten', 'kitty'] },
      { char: '🐭', name: 'mouse', keywords: ['rodent'] },
      { char: '🐹', name: 'hamster', keywords: ['pet'] },
      { char: '🐰', name: 'rabbit', keywords: ['bunny'] },
      { char: '🦊', name: 'fox', keywords: ['animal'] },
      { char: '🐻', name: 'bear', keywords: ['teddy'] },
      { char: '🐼', name: 'panda', keywords: ['cute'] },
      { char: '🐨', name: 'koala', keywords: ['australia'] },
      { char: '🐯', name: 'tiger', keywords: ['cat'] },
      { char: '🦁', name: 'lion', keywords: ['king'] },
      { char: '🐮', name: 'cow', keywords: ['moo'] },
      { char: '🐷', name: 'pig', keywords: ['oink'] },
      { char: '🐸', name: 'frog', keywords: ['pepe'] },
      { char: '🐵', name: 'monkey', keywords: ['ape'] },
      { char: '🐔', name: 'chicken', keywords: ['rooster'] },
      { char: '🐧', name: 'penguin', keywords: ['bird', 'linux'] },
      { char: '🐦', name: 'bird', keywords: ['tweet'] },
      { char: '🐤', name: 'baby_chick', keywords: ['bird'] },
      { char: '🦆', name: 'duck', keywords: ['bird'] },
      { char: '🦅', name: 'eagle', keywords: ['bird'] },
      { char: '🦉', name: 'owl', keywords: ['bird', 'wise'] },
      { char: '🦇', name: 'bat', keywords: ['vampire'] },
      { char: '🐺', name: 'wolf', keywords: ['howl'] },
      { char: '🐗', name: 'boar', keywords: ['wild'] },
      { char: '🐴', name: 'horse', keywords: ['pony'] },
      { char: '🦄', name: 'unicorn', keywords: ['magic'] },
      { char: '🐝', name: 'bee', keywords: ['honey'] },
      { char: '🐛', name: 'bug', keywords: ['caterpillar', 'code'] },
      { char: '🦋', name: 'butterfly', keywords: ['pretty'] },
      { char: '🐌', name: 'snail', keywords: ['slow'] },
      { char: '🐞', name: 'lady_beetle', keywords: ['bug'] },
      { char: '🐜', name: 'ant', keywords: ['bug'] },
      { char: '🦟', name: 'mosquito', keywords: ['bug'] },
      { char: '🌾', name: 'ear_of_rice', keywords: ['grain'] },
      { char: '💐', name: 'bouquet', keywords: ['flowers'] },
      { char: '🌸', name: 'cherry_blossom', keywords: ['flower', 'sakura'] },
      { char: '🌹', name: 'rose', keywords: ['flower', 'love'] },
      { char: '🌺', name: 'hibiscus', keywords: ['flower'] },
      { char: '🌻', name: 'sunflower', keywords: ['flower', 'yellow'] },
      { char: '🌼', name: 'blossom', keywords: ['flower'] },
      { char: '🌷', name: 'tulip', keywords: ['flower'] },
      { char: '🌱', name: 'seedling', keywords: ['plant', 'sprout'] },
      { char: '🌲', name: 'evergreen_tree', keywords: ['pine', 'nature'] },
      { char: '🌳', name: 'deciduous_tree', keywords: ['tree'] },
      { char: '🌴', name: 'palm_tree', keywords: ['beach', 'summer'] },
      { char: '🌵', name: 'cactus', keywords: ['desert'] },
      { char: '🍀', name: 'four_leaf_clover', keywords: ['luck'] },
      { char: '🍁', name: 'maple_leaf', keywords: ['canada', 'autumn'] },
      { char: '🍂', name: 'fallen_leaf', keywords: ['autumn'] },
      { char: '🍃', name: 'leaf_fluttering_in_wind', keywords: ['nature'] },
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍕',
    emojis: [
      { char: '🍏', name: 'green_apple', keywords: ['fruit'] },
      { char: '🍎', name: 'red_apple', keywords: ['fruit'] },
      { char: '🍐', name: 'pear', keywords: ['fruit'] },
      { char: '🍊', name: 'tangerine', keywords: ['orange'] },
      { char: '🍋', name: 'lemon', keywords: ['citrus'] },
      { char: '🍌', name: 'banana', keywords: ['fruit'] },
      { char: '🍉', name: 'watermelon', keywords: ['summer'] },
      { char: '🍇', name: 'grapes', keywords: ['wine'] },
      { char: '🍓', name: 'strawberry', keywords: ['fruit'] },
      { char: '🫐', name: 'blueberries', keywords: ['fruit'] },
      { char: '🍈', name: 'melon', keywords: ['fruit'] },
      { char: '🍒', name: 'cherries', keywords: ['fruit'] },
      { char: '🍑', name: 'peach', keywords: ['fruit'] },
      { char: '🥭', name: 'mango', keywords: ['fruit'] },
      { char: '🍍', name: 'pineapple', keywords: ['fruit'] },
      { char: '🥥', name: 'coconut', keywords: ['tropical'] },
      { char: '🥝', name: 'kiwi_fruit', keywords: ['green'] },
      { char: '🍅', name: 'tomato', keywords: ['vegetable'] },
      { char: '🥑', name: 'avocado', keywords: ['guacamole'] },
      { char: '🍆', name: 'eggplant', keywords: ['aubergine'] },
      { char: '🥔', name: 'potato', keywords: ['fries'] },
      { char: '🥕', name: 'carrot', keywords: ['rabbit'] },
      { char: '🌽', name: 'ear_of_corn', keywords: ['popcorn'] },
      { char: '🌶️', name: 'hot_pepper', keywords: ['spicy'] },
      { char: '🫑', name: 'bell_pepper', keywords: ['capsicum'] },
      { char: '🥒', name: 'cucumber', keywords: ['pickle'] },
      { char: '🥬', name: 'leafy_green', keywords: ['salad'] },
      { char: '🥦', name: 'broccoli', keywords: ['veggie'] },
      { char: '🧄', name: 'garlic', keywords: ['spice'] },
      { char: '🧅', name: 'onion', keywords: ['cry'] },
      { char: '🍄', name: 'mushroom', keywords: ['mario'] },
      { char: '🥜', name: 'peanuts', keywords: ['nuts'] },
      { char: '🌰', name: 'chestnut', keywords: ['acorn'] },
      { char: '🍞', name: 'bread', keywords: ['toast'] },
      { char: '🥐', name: 'croissant', keywords: ['french'] },
      { char: '🥖', name: 'baguette_bread', keywords: ['french'] },
      { char: '🥨', name: 'pretzel', keywords: ['snack'] },
      { char: '🥯', name: 'bagel', keywords: ['cream_cheese'] },
      { char: '🥞', name: 'pancakes', keywords: ['breakfast'] },
      { char: '🧇', name: 'waffle', keywords: ['breakfast'] },
      { char: '🧀', name: 'cheese', keywords: ['swiss'] },
      { char: '🍖', name: 'meat_on_bone', keywords: ['steak'] },
      { char: '🍗', name: 'poultry_leg', keywords: ['chicken'] },
      { char: '🥩', name: 'cut_of_meat', keywords: ['beef'] },
      { char: '🥓', name: 'bacon', keywords: ['breakfast'] },
      { char: '🍔', name: 'hamburger', keywords: ['burger'] },
      { char: '🍟', name: 'french_fries', keywords: ['mcdonalds'] },
      { char: '🍕', name: 'pizza', keywords: ['italy', 'cheese'] },
      { char: '🌭', name: 'hotdog', keywords: ['sausage'] },
      { char: '🥪', name: 'sandwich', keywords: ['lunch'] },
      { char: '🌮', name: 'taco', keywords: ['mexican'] },
      { char: '🌯', name: 'burrito', keywords: ['wrap'] },
      { char: '🥙', name: 'stuffed_flatbread', keywords: ['gyro'] },
      { char: '🧆', name: 'falafel', keywords: ['mediterranean'] },
      { char: '🍳', name: 'egg', keywords: ['fried'] },
      { char: '🥘', name: 'shallow_pan_of_food', keywords: ['paella'] },
      { char: '🍲', name: 'stew', keywords: ['soup'] },
      { char: '🥣', name: 'bowl_with_spoon', keywords: ['cereal'] },
      { char: '🥗', name: 'green_salad', keywords: ['healthy'] },
      { char: '🍿', name: 'popcorn', keywords: ['movie'] },
      { char: '☕', name: 'coffee', keywords: ['espresso', 'tea', 'cafe'] },
      { char: '🍵', name: 'teacup', keywords: ['matcha', 'green_tea'] },
      { char: '🍺', name: 'beer', keywords: ['drink', 'cheers'] },
      { char: '🍻', name: 'beers', keywords: ['clinking', 'cheers'] },
      { char: '🥂', name: 'champagne', keywords: ['toast', 'celebrate'] },
      { char: '🍷', name: 'wine_glass', keywords: ['drink'] },
      { char: '🧃', name: 'beverage_box', keywords: ['juice'] },
      { char: '🧋', name: 'boba', keywords: ['bubble_tea'] },
    ],
  },
  {
    id: 'objects',
    name: 'Objects & Symbols',
    icon: '💡',
    emojis: [
      { char: '💡', name: 'light_bulb', keywords: ['idea', 'bright'] },
      { char: '📌', name: 'pushpin', keywords: ['pin', 'note'] },
      { char: '📎', name: 'paperclip', keywords: ['attach', 'file'] },
      { char: '📅', name: 'calendar', keywords: ['date', 'schedule'] },
      { char: '⏰', name: 'alarm_clock', keywords: ['time', 'alert'] },
      { char: '⚠️', name: 'warning', keywords: ['caution', 'alert'] },
      { char: '🔒', name: 'lock', keywords: ['secret', 'secure'] },
      { char: '📈', name: 'chart_increasing', keywords: ['growth', 'stats'] },
      { char: '🧪', name: 'test_tube', keywords: ['science', 'experiment'] },
      { char: '💻', name: 'laptop', keywords: ['code', 'tech', 'computer'] },
      { char: '📱', name: 'iphone', keywords: ['mobile', 'phone'] },
      { char: '🎮', name: 'video_game', keywords: ['gaming', 'controller'] },
      { char: '🎯', name: 'bullseye', keywords: ['target', 'goal'] },
      { char: '🎨', name: 'art', keywords: ['design', 'paint'] },
      { char: '🎧', name: 'headphones', keywords: ['music', 'audio'] },
      { char: '🎤', name: 'microphone', keywords: ['sing', 'voice'] },
      { char: '📷', name: 'camera', keywords: ['photo'] },
      { char: '🎥', name: 'movie_camera', keywords: ['video', 'film'] },
      { char: '🔑', name: 'key', keywords: ['unlock', 'password'] },
      { char: '🎁', name: 'gift', keywords: ['present', 'birthday'] },
      { char: '🎈', name: 'balloon', keywords: ['party'] },
      { char: '⭐', name: 'star', keywords: ['favorite', 'rating'] },
      { char: '✨', name: 'sparkles', keywords: ['magic', 'shine', 'ai'] },
      { char: '💥', name: 'boom', keywords: ['collision', 'explosion'] },
      { char: '💯', name: '100', keywords: ['perfect', 'score'] },
      { char: '⚡', name: 'zap', keywords: ['lightning', 'fast'] },
    ],
  },
];

export interface GifItem {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  category: string;
}

export const POPULAR_GIFS: GifItem[] = [
  {
    id: 'gif-1',
    title: 'Cat Hype Dance',
    url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeTFnbXBod21zYzBva2Qxb2UzaHNmNThxdTN6MGlkcGR3YzQ0NiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/GeimqsH0TLDt4tScGw/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hpeTFnbXBod21zYzBva2Qxb2UzaHNmNThxdTN6MGlkcGR3YzQ0NiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/GeimqsH0TLDt4tScGw/giphy.gif',
    category: 'hype',
  },
  {
    id: 'gif-2',
    title: 'Mind Blown Celebration',
    url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2JvZmt2aWJycDNldWZvdTRnYWkza3kxdjhzcnltbm5tNGdxeHh6cCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ufdipQqU2lhNA4g/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2JvZmt2aWJycDNldWZvdTRnYWkza3kxdjhzcnltbm5tNGdxeHh6cCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ufdipQqU2lhNA4g/giphy.gif',
    category: 'hype',
  },
  {
    id: 'gif-3',
    title: 'GG Well Played',
    url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNDRkMmthbXdtMjM0dzBscG9ucWJ6NDJvaTRjcmxoa3IycHlsdnhkcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlHJGHe3yAMhdQY/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNDRkMmthbXdtMjM0dzBscG9ucWJ6NDJvaTRjcmxoa3IycHlsdnhkcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlHJGHe3yAMhdQY/giphy.gif',
    category: 'gg',
  },
  {
    id: 'gif-4',
    title: 'Popcorn Watching Drama',
    url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnE4aHl6dnA1NXZubXZjMGhhaGkwdzJndmsyNmppNGY3bzdkZ2FycCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/gl0mkIZOW6Nwc/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnE4aHl6dnA1NXZubXZjMGhhaGkwdzJndmsyNmppNGY3bzdkZ2FycCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/gl0mkIZOW6Nwc/giphy.gif',
    category: 'laugh',
  },
  {
    id: 'gif-5',
    title: 'Hype Confetti Party',
    url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOW82bmNlcm1scW5ld3lydmsxMzdsa2x1M3N2NXQydGF1bmplYXExdCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/g9582DNuQppxC/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOW82bmNlcm1scW5ld3lydmsxMzdsa2x1M3N2NXQydGF1bmplYXExdCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/g9582DNuQppxC/giphy.gif',
    category: 'celebrate',
  },
  {
    id: 'gif-6',
    title: 'Vibe Cat Jamming',
    url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnJ2NXdwNHR3OW5mMnZybG53a2g5NjdxeTN6a2k4NG5vZzJpYndzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JUqiFpNaUkV2M/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnJ2NXdwNHR3OW5mMnZybG53a2g5NjdxeTN6a2k4NG5vZzJpYndzeSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JUqiFpNaUkV2M/giphy.gif',
    category: 'dance',
  },
  {
    id: 'gif-7',
    title: 'Shocked Facepalm',
    url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3Y1NXZ0cjBqaTFycTNsdnl1ZndwbndkOHdtNDcxeWhraDZrdXZubCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKr3nzbh5WgCFxe/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3Y1NXZ0cjBqaTFycTNsdnl1ZndwbndkOHdtNDcxeWhraDZrdXZubCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKr3nzbh5WgCFxe/giphy.gif',
    category: 'sad',
  },
  {
    id: 'gif-8',
    title: 'Thumbs Up Cool Cat',
    url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnVsbmp2MnRndTB2b3d3azNmNzdtbjI0ZWV4bmxyeGF5cHVrcTBtdiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/BzyTuYCmvSORqs1ABM/giphy.gif',
    previewUrl: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnVsbmp2MnRndTB2b3d3azNmNzdtbjI0ZWV4bmxyeGF5cHVrcTBtdiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/BzyTuYCmvSORqs1ABM/giphy.gif',
    category: 'cat',
  },
];

export function DiscordEmojiGifPicker({
  onSelectEmoji,
  onSelectGif,
  onClose,
  defaultTab = 'emoji',
}: DiscordEmojiGifPickerProps) {
  const [tab, setTab] = useState<'emoji' | 'gif'>(defaultTab);
  const [search, setSearch] = useState('');
  const [gifCategory, setGifCategory] = useState<string>('all');
  const [hoveredEmoji, setHoveredEmoji] = useState<{ char: string; name: string } | null>(null);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return EMOJI_CATEGORIES;

    return EMOJI_CATEGORIES.map((cat) => {
      const matched = cat.emojis.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.keywords.some((k) => k.toLowerCase().includes(query)),
      );
      return { ...cat, emojis: matched };
    }).filter((cat) => cat.emojis.length > 0);
  }, [search]);

  const filteredGifs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return POPULAR_GIFS.filter((gif) => {
      const matchCat = gifCategory === 'all' || gif.category === gifCategory;
      const matchQuery =
        !query ||
        gif.title.toLowerCase().includes(query) ||
        gif.category.toLowerCase().includes(query);
      return matchCat && matchQuery;
    });
  }, [search, gifCategory]);

  return (
    <div
      role="dialog"
      aria-label="Emoji and GIF picker"
      className="absolute bottom-full left-0 z-50 mb-2.5 flex h-[420px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Top Header & Search Bar */}
      <div className="flex flex-col border-b border-border bg-surface p-3 gap-2">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-surface-inset p-1 text-xs font-semibold">
            <button
              onClick={() => {
                setTab('emoji');
                setSearch('');
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors',
                tab === 'emoji'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Smile className="size-4" />
              <span>Emojis</span>
            </button>
            <button
              onClick={() => {
                setTab('gif');
                setSearch('');
              }}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors',
                tab === 'gif'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Film className="size-4" />
              <span>GIFs</span>
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close picker"
            onClick={onClose}
            className="text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Search Field */}
        <div className="relative flex items-center">
          <Search className="absolute left-3 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'emoji' ? 'Search emojis...' : 'Search GIFs...'}
            className="w-full rounded-md border border-transparent bg-surface-inset py-1.5 pl-9 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-subtle focus:border-primary"
            autoFocus
          />
          {search ? (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Content Area */}
      <ScrollArea className="min-h-0 flex-1" contentClassName="p-3">
        {tab === 'emoji' ? (
          <div className="space-y-4">
            {filteredCategories.map((cat) => (
              <section key={cat.id} className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji.name + emoji.char}
                      onClick={() => {
                        onSelectEmoji(emoji.char);
                        onClose();
                      }}
                      onMouseEnter={() => setHoveredEmoji({ char: emoji.char, name: emoji.name })}
                      onMouseLeave={() => setHoveredEmoji(null)}
                      title={`:${emoji.name}:`}
                      className="flex size-9 items-center justify-center rounded-lg text-2xl transition-transform hover:scale-125 hover:bg-accent"
                    >
                      {emoji.char}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          /* GIF Tab */
          <div className="space-y-3">
            {/* Category Quick Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'All', icon: <Grid className="size-3" /> },
                { id: 'hype', label: 'Hype', icon: <Flame className="size-3" /> },
                { id: 'dance', label: 'Dance', icon: <Sparkles className="size-3" /> },
                { id: 'celebrate', label: 'Party', icon: <PartyPopper className="size-3" /> },
                { id: 'cat', label: 'Cat', icon: <Smile className="size-3" /> },
                { id: 'gg', label: 'GG', icon: <ThumbsUp className="size-3" /> },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setGifCategory(chip.id)}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                    gifCategory === chip.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-inset text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {chip.icon}
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>

            {/* GIF Grid */}
            <div className="grid grid-cols-2 gap-2">
              {filteredGifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => {
                    onSelectGif(gif.url, gif.title);
                    onClose();
                  }}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-surface-inset transition-transform hover:scale-[1.03] hover:border-primary"
                >
                  <img
                    src={gif.previewUrl}
                    alt={gif.title}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-transparent to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="truncate text-[10px] font-medium text-white">
                      {gif.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Footer Info / Hovered Emoji Bar */}
      <div className="flex h-10 items-center justify-between border-t border-border bg-popover px-3 text-xs text-muted-foreground">
        {tab === 'emoji' && hoveredEmoji ? (
          <div className="flex items-center gap-2">
            <span className="text-xl">{hoveredEmoji.char}</span>
            <span className="font-mono text-[11px] font-semibold text-foreground">
              :{hoveredEmoji.name}:
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-subtle">
            <Zap className="size-3 text-primary-text" />
            <span>Discord Emoji & GIF Engine</span>
          </div>
        )}
      </div>
    </div>
  );
}
