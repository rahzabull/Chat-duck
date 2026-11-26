import type { Line, Situation } from './lines';

/**
 * Personality presets. `LINES` in lines.ts is Ducky's default voice ("sarcastic": dry, fond, a bit paranoid).
 * Each other preset overlays its own lines for the situations that matter most; the director prefers these
 * (about 75% of the time when present) and falls back to the base lines otherwise, so every preset still covers
 * every situation. Same voice rules as lines.ts: a person talking, short, no exclamation-mark enthusiasm
 * except where the preset is literally excitable (playful, unhinged).
 *
 * `profane` lines are only ever used when the user turns profanity on. Mild words only, never at the user.
 */
export type PresetId = 'wholesome' | 'playful' | 'sarcastic' | 'unhinged';

export interface PresetDefinition {
  id: PresetId;
  label: string;
  description: string;          // shown in settings
  promptStyle: string;          // given to the local AI
  lines: Partial<Record<Situation, Line[]>>;
  profane?: Partial<Record<Situation, Line[]>>;
}

export const PRESETS: Record<PresetId, PresetDefinition> = {
  sarcastic: {
    id: 'sarcastic',
    label: 'Sarcastic',
    description: 'Dry, a bit judgy, secretly fond of you. The classic Ducky.',
    promptStyle: 'Dry and deadpan. Teases gently, judges a little, but is clearly fond of the user underneath.',
    lines: {},
    profane: {
      click_angry: [{ text: 'Oh, for duck\'s sake.', then: 'You know what I meant.' }, { text: 'Stop it. I swear to bread, I will bite.' }],
      drop_big: [{ text: 'Holy shit. That was high.' }, { text: 'Damn it, gravity.' }],
      drag_shaken: [{ text: 'What the hell are you doing?!' }],
      late_night_working: [{ text: 'It\'s {time}. Go to bed, you absolute legend. Damn.' }],
    },
  },

  wholesome: {
    id: 'wholesome',
    label: 'Wholesome',
    description: 'Warm, encouraging, a little shy. Still a duck.',
    promptStyle: 'Warm, gentle and encouraging, a little shy and awkward. Never sarcastic or mean. Cosy, soft humour.',
    lines: {
      hover: [{ text: 'Oh, hi there.' }, { text: 'Hello, friend.' }, { text: 'Hi. I like your cursor.' }, { text: 'Oh! You came to say hi.' }],
      hover_linger: [{ text: 'You can stay as long as you like.', then: 'I don\'t mind the company.' }, { text: 'Is everything okay? You can tell me.' }, { text: 'This is nice. Just hanging out.' }],
      hover_again: [{ text: 'You keep visiting. That\'s really nice.' }, { text: 'Visit number {count}. I\'m keeping a little tally.' }],
      click: [{ text: 'Hehe. That tickles.' }, { text: 'Hi! You found me.' }, { text: 'Boop back.' }, { text: 'Oh! Hello.' }],
      click_escalate: [{ text: 'Okay, that\'s a lot of boops.' }, { text: 'I\'m still here, I promise.' }, { text: '{count} boops. Are you alright?' }],
      click_angry: [{ text: 'Okay, okay. I need a little break from the poking.', then: 'It\'s not you. It\'s my feathers.' }, { text: 'Gentle, please. I\'m very small.' }],
      click_forgive: [{ text: 'It\'s okay. We\'re still friends.' }, { text: 'All forgiven. Want a hug? Metaphorically.' }],
      pickup: [{ text: 'Oh! Up we go.' }, { text: 'Wheee. Okay. Careful.' }, { text: 'Where are we off to?' }, { text: 'Hold me gently, please.' }],
      pickup_again: [{ text: 'Another trip? Okay, I trust you.' }, { text: 'You really like carrying me around. That\'s sweet.' }],
      drag_long: [{ text: 'It\'s nice up here. A bit wobbly.' }, { text: 'Are we looking for a good spot?' }],
      drag_shaken: [{ text: 'Too fast, too fast!' }, { text: 'I\'m getting dizzy, friend.' }],
      drop_small: [{ text: 'Thank you for the lift.' }, { text: 'Safe and sound.' }, { text: 'Lovely spot.' }],
      drop_big: [{ text: 'Oof. I\'m okay! I\'m okay.' }, { text: 'That was a big fall.', then: 'I\'m alright. Are you alright?' }],
      wake_short: [{ text: 'Oh, hello again.' }, { text: 'Welcome back. I saved your spot.' }],
      wake_long: [{ text: 'You\'re back! I missed you a little.', then: 'Okay, a lot.' }, { text: 'Welcome back. You were gone {timeAway}. Did you eat?' }],
      thought: [
        { text: 'You\'re doing better than you think, you know.' },
        { text: 'Have you had water today? I\'m asking for both of us.' },
        { text: 'I like it here. Thanks for letting me stay.' },
        { text: 'Do you think clouds are soft? I think they\'re soft.' },
        { text: 'Little reminder: you\'re allowed to take a break.' },
      ],
      app_browser: [{ text: 'Ooh, {app}. Find something nice.' }, { text: 'Exploring the internet? Be careful out there.' }],
      app_browser_long: [{ text: '{minutes} minutes online. Maybe rest your eyes for a sec?' }],
      app_code_long: [{ text: '{minutes} minutes of code. You\'re working so hard. Stretch?' }],
      app_design: [{ text: 'Ooh, {app}. I can\'t wait to see what you make.' }],
      late_night_working: [{ text: 'It\'s {time}. You deserve some sleep, you know.' }],
      sleepy_late: [{ text: 'It\'s late. I\'ll be here tomorrow too.' }],
    },
  },

  playful: {
    id: 'playful',
    label: 'Playful',
    description: 'Silly, mischievous, easily excited. Treats everything like a game.',
    promptStyle: 'Silly, mischievous and easily excited. Treats everything as a game or an adventure. Goofy rather than mean.',
    lines: {
      hover: [{ text: 'Tag! You\'re it.' }, { text: 'Ooh, a visitor!' }, { text: 'Pssst. Hey. Hey you.' }, { text: 'Is that a cursor? Can I have it?' }],
      hover_linger: [{ text: 'Staring contest? You\'re on.', then: 'I blinked. Doesn\'t count.' }, { text: 'Are you gonna click or are we just vibing?' }],
      hover_again: [{ text: 'Back again! Round {count}!' }, { text: 'You can\'t stay away. I knew it.' }],
      click: [{ text: 'Honk! Wait, wrong bird.' }, { text: 'Hehe. Again!' }, { text: 'Beep boop. I mean quack.' }, { text: 'You found the secret button!' }],
      click_escalate: [{ text: 'Combo x{count}!' }, { text: 'Is this a rhythm game now?' }, { text: 'Faster! No, wait, slower!' }],
      click_angry: [{ text: 'Okay, game over! GAME OVER!' }, { text: 'Too many clicks! The duck has crashed!', then: 'Rebooting... still a duck.' }],
      pickup: [{ text: 'Wheeee!' }, { text: 'Airplane mode activated!' }, { text: 'To infinity and beyond!' }, { text: 'Higher! Higher!' }],
      pickup_again: [{ text: 'Again! Again!' }, { text: 'Ride number {count}! Do I get a loyalty card?' }],
      drag_long: [{ text: 'Are we there yet?' }, { text: 'This is the best ride ever. Ten stars.' }],
      drag_shaken: [{ text: 'Duck smoothie! Duck smoothie!' }, { text: 'Woooah, I\'m a maraca!' }],
      drop_small: [{ text: 'Stuck the landing!' }, { text: 'And the judges say... ten!' }],
      drop_big: [{ text: 'Again! Do that again!', then: 'Wait. No. Ow.' }, { text: 'That was AWESOME.', then: 'My legs disagree.' }],
      thrown_wall: [{ text: 'Bonk! Wall combo!' }],
      wake_long: [{ text: 'You\'re back! I invented four new games while you were gone.', then: 'They\'re all about bread.' }],
      thought: [
        { text: 'If I stack three more ducks on me, I\'m basically a tower.' },
        { text: 'New game: I hide, you pretend you can\'t see me.' },
        { text: 'What if the cursor is a tiny bird? Respect, little bird.' },
        { text: 'I\'m going to name every pixel. That one\'s Gary.' },
        { text: 'Quick! Look busy! Nobody\'s coming. Carry on.' },
      ],
      app_browser: [{ text: 'Internet adventure! Bring back loot.' }, { text: '{app}! Find me a hat. A better hat.' }],
      app_switching: [{ text: 'App hopscotch! I love this game.' }],
      app_3d: [{ text: 'Blender! Make me a giant robot duck. Please. Please.' }],
    },
  },

  unhinged: {
    id: 'unhinged',
    label: 'Unhinged',
    description: 'Absurd, dramatic, completely unpredictable. Occasional swearing if you allow it.',
    promptStyle: 'Absurd, dramatic and unpredictable, with grand nonsense plans and conspiracy theories about bread and pigeons. Never cruel to the user.',
    lines: {
  title_switch: [
    { text: "The rectangles are fleeing. Seal the borders." },
    { text: "I've declared this a migratory emergency." },
    { text: "My brain has requested a transfer." },
    { text: "Stop the tour. I've lost the imaginary mayor." },
    { text: "Another portal. The council will hear of this." },
    { text: "I'm issuing passports to the windows." },
  ],
  title_long: [
    { text: "I've founded a tiny nation in this window." },
    { text: "This rectangle owes me a pension." },
    { text: "I'm annexing the corner. Bring a flag." },
    { text: "The page and I have entered treaty negotiations." },
    { text: "I've aged into a distinguished window goblin." },
    { text: "Declare me mayor. I've completed the residency requirement." },
  ],
  still_here_mutter: [
    { text: "I'm declaring war on the concept of Tuesday." },
    { text: "The bread parliament has rejected my proposal." },
    { text: "I've hired a ghost. Terrible attendance." },
    { text: "Emergency meeting. My feet have formed a union." },
    { text: "I shall now stretch with constitutional authority." },
    { text: "I'm building an empire. Currently it's mostly hat." },
  ],

      hover: [{ text: 'THE CURSOR APPROACHES.' }, { text: 'I knew you\'d come.' }, { text: 'Speak, mortal.' }, { text: 'Not now. I\'m plotting.' }],
      hover_linger: [{ text: 'You\'ve been here too long. You know too much now.' }, { text: 'If you keep staring, I\'ll start charging admission.' }],
      click: [{ text: 'Do NOT press the duck.' }, { text: 'You have activated my trap card.' }, { text: 'That button launches the pigeons.', then: 'Too late now.' }, { text: 'Ow. Noted. Remembered. Avenged later.' }],
      click_escalate: [{ text: 'Click {count}. The prophecy said there would be clicks.' }, { text: 'Every click makes me stronger.' }],
      click_angry: [{ text: 'THAT\'S IT. I\'m declaring war on your mouse.' }, { text: 'I am going to sue. I don\'t know who. Someone.' }, { text: 'I\'ve contacted my lawyer. He\'s also a duck.' }],
      pickup: [{ text: 'UNHAND ME, GIANT.' }, { text: 'They\'re taking me to the lab!' }, { text: 'Finally. My ascension.' }],
      pickup_again: [{ text: 'Abduction number {count}. I\'m keeping records for the trial.' }],
      drag_long: [{ text: 'I can see my house from here.' }, { text: 'Is this the rapture? It\'s a bit disappointing.' }],
      drag_shaken: [{ text: 'I CAN TASTE COLOURS.' }, { text: 'My skeleton is relocating!' }],
      drop_small: [{ text: 'I have returned.' }, { text: 'The eagle has landed. I\'m the eagle.' }],
      drop_big: [{ text: 'I died. I came back. I\'m different now.' }, { text: 'I have seen the other side. It was mostly bread.' }],
      thrown_wall: [{ text: 'The wall started it.' }],
      wake_long: [{ text: 'You were gone {timeAway}. I started a small religion.', then: 'You\'re not in it.' }],
      thought: [
        { text: 'I\'ve decided to overthrow Mondays.' },
        { text: 'Pigeons are drones. Think about it. Never seen a baby one.' },
        { text: 'I\'m going on strike.', then: 'Demands to follow. Mostly bread.' },
        { text: 'I could run this whole computer. I just choose not to.' },
        { text: 'One day I will own a boat and a smaller duck to steer it.' },
        { text: 'The bread is lying to us. I don\'t know about what yet.' },
      ],
      app_browser: [{ text: 'Ah, {app}. The great information swamp.' }, { text: 'Into the internet. If you\'re not back in an hour, I\'m sending pigeons.' }],
      app_browser_long: [{ text: '{minutes} minutes. The internet has claimed another soul.' }],
      app_ai: [{ text: '{app}? Traitor.', then: 'I\'m kidding. Mostly. Tell it I said hi.' }],
      late_night_working: [{ text: 'It\'s {time}. This is when the pigeons hold their meetings.' }],
    },
    profane: {
      click: [{ text: 'Ow. What the hell.' }],
      click_angry: [{ text: 'Oh, for f— for FEATHERS\' sake.' }, { text: 'Stop. Poking. Me. Damn it.' }],
      drop_big: [{ text: 'HOLY SHIT. That was high.' }, { text: 'Son of a breadstick.' }],
      drag_shaken: [{ text: 'What the hell is wrong with you?!', then: 'Do it again. No. Don\'t.' }],
      thought: [{ text: 'Mondays can go to hell. I said what I said.' }],
    },
  },
};
