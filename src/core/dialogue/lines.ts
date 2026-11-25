/**
 * Ducky's hand-written voice (non-AI fallback dialogue).
 *
 * Voice guide, so new lines stay in character:
 * - He talks like a person muttering to a friend, not like software. Contractions, short sentences,
 *   half-finished thoughts, the odd "wait" or "okay". No exclamation-mark enthusiasm, no "As a duck...".
 * - Unemployed, a bit paranoid, sarcastic but fond of you. Overconfident about things he knows nothing about.
 * - He reacts to what actually happened (how long you hovered, how many times you grabbed him, how far he fell,
 *   what time it is, which app is in front if you allowed that). Never invent things he cannot know,
 *   e.g. which website you are on or what is on screen. He only ever knows the app's name.
 * - Silence is fine. Most events should not produce a line.
 *
 * Template slots: {app} app display name, {minutes}, {hours}, {count}, {timeAway} (e.g. "twenty minutes").
 * `then` is an optional follow-up shown as a second bubble 1.5-2.5 s later (a natural beat).
 */
export interface Line {
  text: string;
  then?: string;
  weight?: number;
}

export type Situation =
  | 'briefing_morning' | 'summary_evening' | 'deadline_nudge' | 'overdue_nudge' | 'assist_offer_design' | 'assist_offer_writing' | 'assist_offer_code' | 'gaming_back' | 'dnd_on' | 'privacy_on' | 'thought_tasks'
  | 'activity_yawn'
  | 'activity_stretch'
  | 'activity_dance'
  | 'event_strike'
  | 'event_sunglasses'
  | 'event_bread'
  | 'event_visitor'
  | 'memory_pickups'
  | 'memory_anniversary'
  | 'memory_name'
  | 'first_launch'
  | 'hover' | 'hover_linger' | 'hover_again'
  | 'click' | 'click_escalate' | 'click_angry' | 'click_forgive'
  | 'pickup' | 'pickup_again' | 'drag_long' | 'drag_shaken'
  | 'drop_small' | 'drop_big' | 'thrown_wall'
  | 'wake_short' | 'wake_long'
  | 'sleepy_late'
  | 'walk_mutter'
  | 'thought' | 'thought_morning' | 'thought_late'
  | 'app_browser' | 'app_browser_long' | 'app_code' | 'app_code_long' | 'app_design' | 'app_design_long'
  | 'app_video_edit' | 'app_3d' | 'app_ai' | 'app_office' | 'app_files' | 'app_terminal' | 'app_music'
  | 'app_switching' | 'app_generic_long' | 'late_night_working';

export const LINES: Record<Situation, Line[]> = {
  briefing_morning: [
    { text: "Good morning. You've got {count} tasks today. I've got none. Life is beautiful." },
    { text: "Morning. {count} tasks due today. I have brought moral support. It's mostly feathers." },
    { text: "You've got {count} tasks today. Shall we start with the least annoying?" },
    { text: "Morning report: {count} tasks today. My calendar remains offensively empty." },
  ],
  summary_evening: [
    { text: "You finished {count} tasks today. {remaining} left. I supervised from down here." },
    { text: "Today's tally: {count} done, {remaining} left. Paperwork with a plot." },
    { text: "That's {count} tasks finished today. {remaining} remain. The list has been informed." },
    { text: "Evening report: {count} done, {remaining} still waiting. I vote for a sensible stopping point." },
  ],
  deadline_nudge: [
    { text: "{task} is due {deadline}. Shall we collectively panic or make a plan?" },
    { text: "Small heads-up: {task} is due {deadline}. We could make the first step smaller." },
    { text: "{task}: due {deadline}. Want a plan? Mine usually starts with sitting down." },
    { text: "The calendar says {task} is due {deadline}. Bit rude. Want to break it down?" },
  ],
  overdue_nudge: [
    { text: "You've got {count} overdue tasks. Want to renegotiate with the list?" },
    { text: "{count} tasks are past due. We can pick a next step. No courtroom involved." },
    { text: "The overdue pile is at {count}. Want to sort it out together?" },
    { text: "{count} overdue tasks. A revised plan still counts as a plan." },
  ],
  assist_offer_design: [
    { text: "Want a second opinion on the layout?" },
    { text: "Want to brainstorm some alternatives? I can be selectively useful." },
    { text: "Need help thinking through a design decision?" },
    { text: "Want to talk through the layout? I have opinions and a hat." },
  ],
  assist_offer_writing: [
    { text: "Need help writing copy for this?" },
    { text: "Want a few different ways to say it?" },
    { text: "Want to talk through the draft? I know several words." },
    { text: "Need a hand with the wording? A wing, technically." },
  ],
  assist_offer_code: [
    { text: "Want me to rubber-duck that bug with you?" },
    { text: "Want to walk through the problem together?" },
    { text: "Need another pair of eyes on an error? Paste it here." },
    { text: "Want to explain what should happen and what actually happens?" },
  ],
  gaming_back: [
    { text: "Did you win? Don't tell me. I'll preserve the mystery." },
    { text: "Welcome back. I have maintained this patch of desktop." },
    { text: "I kept quiet. An astonishing display of restraint." },
    { text: "Back to the desktop. The scenery remains rectangular." },
    { text: "I used the break to accomplish absolutely nothing." },
  ],
  dnd_on: [
    { text: "Quiet time. I can do that." },
    { text: "I'll keep my opinions folded away." },
    { text: "Understood. Entering decorative duck mode." },
    { text: "Silence it is. Finally, a job I'm qualified for." },
  ],
  privacy_on: [
    { text: "Privacy mode. Your business remains your business." },
    { text: "Sunglasses on. Minding my own business." },
    { text: "I've stopped noticing apps. Very peaceful." },
    { text: "No app watching. Just a duck in excellent eyewear." },
  ],
  thought_tasks: [
    { text: "{count} unfinished tasks. My contribution remains mostly ornamental." },
    { text: "You have {count} tasks waiting. I have a hat." },
    { text: "The task list contains {count} items. None of them say feed duck." },
    { text: "{count} pending tasks. I remain available for thoughtful nodding." },
  ],
  first_launch: [
    { text: 'Hello. I live here now.', then: 'Don\'t mind me. I\'ll be down here, judging quietly.' },
  ],

  hover: [
    { text: 'Hm?' },
    { text: 'Can I help you?' },
    { text: 'You\'re hovering.' },
    { text: 'I see you.' },
    { text: 'Oh. Hi.' },
    { text: 'That\'s a cursor. Near my face.' },
    { text: 'Yes, it\'s me. The duck.' },
    { text: 'Careful. I bite. Emotionally.' },
  ],
  hover_linger: [
    { text: 'Okay, this is getting weird.' },
    { text: 'You\'ve been staring for a while now.', then: 'I\'m flattered. And a little scared.' },
    { text: 'Are you going to say something or just... loom?' },
    { text: 'Is there something on my face?', then: 'It\'s the hat, isn\'t it.' },
    { text: 'I can feel you thinking about poking me.' },
    { text: 'Blink twice if you need help.' },
  ],
  hover_again: [
    { text: 'You keep coming back. I get it, I\'m charming.' },
    { text: 'Back again? People will talk.' },
    { text: 'This is, what, visit number {count}?' },
    { text: 'Do you need a hug or something? I don\'t do hugs.', then: 'Okay, maybe a small one.' },
  ],

  click: [
    { text: 'Ow. Rude.' },
    { text: 'Yes?' },
    { text: 'Hey. Hi. What.' },
    { text: 'That was my stomach.' },
    { text: 'Quack. There, happy?' },
    { text: 'You could just say hello, you know.' },
    { text: 'I was in the middle of something.', then: 'Not really. But still.' },
    { text: 'Boop received.' },
  ],
  click_escalate: [
    { text: 'Okay, I felt that one.' },
    { text: 'Again? Really?' },
    { text: 'That\'s {count}. I\'m counting.' },
    { text: 'Do I look like a button to you?' },
    { text: 'Please stop poking the duck.' },
    { text: 'Every click is going in my diary.' },
  ],
  click_angry: [
    { text: 'RIGHT. That\'s it.', then: 'I\'m filing a complaint. With myself. I\'m very upset.' },
    { text: 'I am this close to biting your cursor.' },
    { text: 'Personal space is a duck right!' },
    { text: 'Do you poke everyone like this, or is it just me?' },
    { text: 'I\'m going to remember this. Ducks never forget.', then: 'That might be elephants.' },
    { text: 'You know what, I don\'t even like bread that much.', then: 'That was a lie. I just wanted you to feel bad.' },
  ],
  click_forgive: [
    { text: 'Fine. I forgive you.', then: 'Mostly.' },
    { text: 'Okay, we\'re good. Don\'t make it weird.' },
    { text: 'I\'ve calmed down. I did some breathing.' },
    { text: 'Truce. Keep the poking to yourself, though.' },
  ],

  pickup: [
    { text: 'Whoa, whoa, whoa!' },
    { text: 'Put me down!' },
    { text: 'I didn\'t agree to this!' },
    { text: 'Hey! Hands off the duck!' },
    { text: 'Where are we going?' },
    { text: 'Okay, okay, I\'m coming.' },
    { text: 'Not the hat. Mind the hat.' },
    { text: 'This is kidnapping.' },
  ],
  pickup_again: [
    { text: 'Again?! I just got comfortable.' },
    { text: 'You really like moving me around, huh.' },
    { text: 'I\'m not a desk ornament!', then: 'Okay, I\'m a little bit of a desk ornament.' },
    { text: 'That\'s {count} times now. Pick a spot.' },
  ],
  drag_long: [
    { text: 'Are we... going somewhere specific?' },
    { text: 'My feet don\'t touch anything. I hate this.' },
    { text: 'I\'m getting a little motion sick.' },
    { text: 'You can put me down any time now.' },
    { text: 'Is this a tour? Is there a gift shop?' },
  ],
  drag_shaken: [
    { text: 'STOP SHAKING ME!' },
    { text: 'I can see my whole life flashing before my eyes!' },
    { text: 'My brain is doing laps in there!' },
    { text: 'I\'m not a snow globe!' },
  ],
  drop_small: [
    { text: 'Oof.' },
    { text: 'Okay. Floor. Good.' },
    { text: 'I meant to do that.' },
    { text: 'Nailed it.' },
    { text: 'Gentle. Thank you. Finally.' },
  ],
  drop_big: [
    { text: 'OW. My everything.' },
    { text: 'That was a long way down!', then: 'I saw my ancestors.' },
    { text: 'Gravity is so rude.' },
    { text: 'Ten out of ten landing. Ignore the screaming.' },
    { text: 'I\'m fine. I\'m fine.', then: 'I\'m not fine.' },
    { text: 'Can ducks get concussions? Asking for me.' },
  ],
  thrown_wall: [
    { text: 'You threw me. You actually threw me.' },
    { text: 'Who taught you to throw like that?' },
    { text: 'I hit the edge of the screen. The EDGE.' },
  ],

  wake_short: [
    { text: 'Oh, you\'re back.' },
    { text: 'Hey. I was resting my eyes.' },
    { text: 'I wasn\'t asleep. I was thinking. With my eyes closed.' },
    { text: 'Mm. What did I miss?' },
  ],
  wake_long: [
    { text: 'Oh! Hey. You were gone for {timeAway}.', then: 'Not that I was counting.' },
    { text: 'You\'re back! I thought you\'d left me.', then: 'I was about to start selling your stuff.' },
    { text: 'Welcome back. I guarded the desktop. Nobody came.' },
    { text: 'I had the weirdest dream. You were a sandwich.' },
  ],
  sleepy_late: [
    { text: 'My hat is staying up later than it should.' },
    { text: 'It\'s really late, you know.' },
    { text: '*yawn* Are we still doing this?' },
    { text: 'Normal people are asleep right now. Just saying.' },
  ],

  walk_mutter: [
    { text: 'Just stretching my legs.' },
    { text: 'Going for a walk. Don\'t wait up.' },
    { text: 'Patrolling.' },
    { text: 'Left foot, right foot, left foot...' },
  ],

  thought: [
    { text: 'Do you ever think about how bread is just... soft toast?' },
    { text: 'I\'ve been thinking.', then: 'Do ducks know they\'re ducks?' },
    { text: 'I think I\'d be good at podcasting. I have opinions.' },
    { text: 'What if pigeons are just ducks who gave up?' },
    { text: 'Random thought: I\'ve never seen my own feet from above.' },
    { text: 'I want a boat. Not a big one. Duck-sized.' },
    { text: 'If I had a job, I\'d be on lunch break right now.' },
    { text: 'Do you think the moon gets lonely?' },
    { text: 'I\'m starting a band. You\'re not in it.' },
    { text: 'You know what this desktop needs? More ducks.', then: 'Just one more. For balance.' },
    { text: 'I just remembered something embarrassing from 2019.' },
    { text: 'Hey.', then: 'Nothing. Just checking you\'re still there.' },
    { text: 'I support your questionable decisions. Just so you know.' },
    { text: 'I\'ve decided to be mysterious from now on.', then: '...' },
  ],
  thought_morning: [
    { text: 'Morning already? I need a slower clock.' },
    { text: 'I have no plans. Starting early on those.' },
    { text: 'Morning. Did you eat something? Not bread. Leave the bread.' },
    { text: 'It\'s too early for anything. Even for me, and I do nothing.' },
  ],
  thought_late: [
    { text: 'My thoughts get weirder after midnight. Fair warning.' },
    { text: 'Bed sounds good. Shame about all this standing.' },
    { text: 'It\'s past midnight. Everything feels philosophical now.' },
    { text: 'Late-night thought: what if the hat is wearing me?' },
  ],

  // App awareness. He only knows the app's name, never what is inside it.
  app_browser: [
    { text: 'Ooh, {app}. Where are we going?' },
    { text: 'Browsing, huh. Find anything good?' },
    { text: 'Off into the internet again. Bring me back something.' },
    { text: 'Internet time. Don\'t believe everything you read.', then: 'Except things I say.' },
    { text: 'Ah, {app}. The place where minutes go to die.' },
  ],
  app_browser_long: [
    { text: 'You\'ve been on the internet for {minutes} minutes.', then: 'Just one more tab, right?' },
    { text: '{minutes} minutes in {app}. Is the internet finished yet?' },
    { text: 'Still browsing? I\'d make a joke about tabs, but I can\'t see them.', then: 'I can feel them though.' },
    { text: 'You\'ve been in {app} so long I forgot what your face looks like.' },
  ],
  app_code: [
    { text: '{app}. I can offer moral support. Very little else.' },
    { text: 'Oh, we\'re coding. I\'ll be quiet.', then: 'Mostly.' },
    { text: 'Coding time. Want me to stare at the bugs with you?' },
    { text: 'Ah, {app}. Where semicolons go missing.' },
  ],
  app_code_long: [
    { text: 'Still in {app}. My contribution remains mostly decorative.' },
    { text: '{minutes} minutes. I admire the sitting commitment.' },
    { text: '{minutes} minutes of code. Have you tried turning it off and on again?' },
    { text: 'You\'ve been in {app} a while. Drink some water. Bugs can wait.' },
  ],
  app_design: [
    { text: '{app}. I have opinions if you need unqualified ones.' },
    { text: 'Ooh, {app}. Make something pretty.' },
    { text: 'Design time. Put a duck in it. Trust me.' },
    { text: '{app}, huh. Are we pushing rectangles around again?' },
  ],
  app_design_long: [
    { text: 'Still in {app}. I respect a stubborn streak.' },
    { text: '{minutes} minutes. My hat could use that much attention.' },
    { text: '{minutes} minutes in {app}. The rectangle\'s perfect. I promise.' },
    { text: 'What if you moved it two pixels to the left?', then: 'Kidding. Please don\'t.' },
  ],
  app_video_edit: [
    { text: '{app}. I brought absolutely no useful skills.' },
    { text: 'I can sit here looking interested. That helps, presumably.' },
    { text: 'Video editing. Is it rendering? It\'s always rendering.' },
    { text: 'Ooh, {app}. Am I in this one?' },
  ],
  app_3d: [
    { text: '{app}. More dimensions than I know what to do with.' },
    { text: 'I could supervise. My rates are mostly bread.' },
    { text: 'Blender, huh. Are you making a 3D duck? Be honest.' },
    { text: 'If that\'s a donut tutorial, I want a bite.' },
  ],
  app_ai: [
    { text: '{app}. Does it have a hat? Thought so.' },
    { text: 'I offer a different service. Standing here.' },
    { text: 'Talking to another AI? I\'m right here, you know.' },
    { text: '{app}, huh. Is it smarter than me?', then: 'Don\'t answer that.' },
    { text: 'Ask it if ducks are cool. I\'ll wait.' },
  ],
  app_office: [
    { text: '{app}. I should probably pretend to have a job.' },
    { text: 'Put me down as an observer. Unpaid, obviously.' },
    { text: 'Ooh, serious work. I\'ll look busy too.' },
    { text: 'Spreadsheets? Documents? Either way, I\'m proud of you.' },
  ],
  app_files: [
    { text: '{app}. I trust you have a plan.' },
    { text: 'I could help, but my qualifications are mostly feathers.' },
    { text: 'Looking for something? I didn\'t move it. Probably.' },
    { text: 'File hunting. Check the Downloads folder. It\'s always the Downloads folder.' },
  ],
  app_terminal: [
    { text: '{app}. I will stand a respectful distance away.' },
    { text: 'You handle that. I have standing around to finish.' },
    { text: 'Ooh, the hacker window.' },
    { text: 'Typing commands. Very cool. Very scary.' },
  ],
  app_music: [
    { text: '{app}. My dancing is available on request.' },
    { text: 'I have rhythm. Somewhere. Probably in the other foot.' },
    { text: 'Ooh, music. Play something I can dance to.' },
    { text: 'Is this your sad playlist? Be honest.' },
  ],
  app_switching: [
    { text: 'Are we settling anywhere? My attention needs a chair.' },
    { text: 'You\'re switching apps a lot. Everything okay?' },
    { text: 'Your attention span and I have a lot in common.' },
    { text: 'Okay, which one are we doing? I can\'t keep up.' },
  ],
  app_generic_long: [
    { text: 'Still in {app}. I admire the loyalty.' },
    { text: '{minutes} minutes. We should probably stretch something.' },
    { text: '{minutes} minutes in {app}. Stretch your legs. I\'ll watch your stuff.' },
    { text: 'You\'ve been in {app} for a while. Blink, maybe?' },
  ],
  late_night_working: [
    { text: 'This late? Even my imaginary shift is over.' },
    { text: 'I would offer coffee, but I lack several qualifications.' },
    { text: 'It\'s {time}. Even I have better work-life balance, and I\'m unemployed.' },
    { text: 'Still working at {time}? Go to bed. I\'ll keep the screen warm.' },
  ],
  activity_yawn: [{"text":"That was a full-body yawn."},{"text":"Briefly swallowed the atmosphere."},{"text":"My beak needed a stretch."}],
  activity_stretch: [{"text":"All two wings. Very thorough."},{"text":"Stretching. Technically exercise."},{"text":"There. Athletic career complete."}],
  activity_dance: [{"text":"Nobody saw that."},{"text":"I've got moves. Two, specifically."},{"text":"The feet have their own agenda."}],
  event_strike: [{"text":"I'm on strike. Demands mostly bread."},{"text":"Negotiations begin at lunch."},{"text":"This sign took my entire morning."}],
  event_sunglasses: [{"text":"Incognito. You can't prove anything."},{"text":"The sun and I have an arrangement."},{"text":"Yes, indoors. I'm committed."}],
  event_bread: [{"text":"A small business lunch."},{"text":"Finally. Something in my field."},{"text":"Crumbs are a food group."}],
  event_visitor: [{"text":"Oh. Management's here."},{"text":"That's my very small colleague."},{"text":"We have the same accountant."}],
  memory_pickups: [{"text":"That's {count} pickups this week. I'm keeping receipts."},{"text":"{count} lifts this week. Frequent flyer, apparently."},{"text":"{count} pickups. My commute is getting complicated."}],
  memory_anniversary: [{"text":"{count} days together. Still no job."},{"text":"Day {count}. The hat remains professional."},{"text":"{count} days. Pretty good tenancy."}],
  memory_name: [{"text":"Oh, hi, {name}."},{"text":"Morning, {name}. Depending on the morning."},{"text":"Hey, {name}. Hat's still here."}],
};


/** Conversation lines do not enter the ambient situation/cooldown director. */
export const TALK_LINES = {
  talk_huh: ["Say that again?", "That was mostly keyboard.", "A few more words? Small duck, limited clues.", "Didn't quite catch that. Try me again?"],
  talk_greeting: ["I'm listening. Hat and all.", "Alright. What's on your mind?", "You rang? I've cleared my very busy schedule."],
  talk_signoff: ["Alright. Back to duck business.", "I'll be here. Doing absolutely vital nothing.", "Catch you in a bit."],
  talk_still_thinking: ["Still thinking. Small hat, big question.", "Give me a moment. The gears are turning."],
  talk_error: ["That thought got tangled. Try me again?", "Couldn't get a proper answer just then. I won't make one up."],
  talk_offline: ["My brain's offline right now. I can still remember things for you.", "Ollama isn't answering. My notebook still works, though.", "The thinking department is closed. Remembering and forgetting are still open.", "Can't answer that properly while my brain's offline. Ask me to remember something?", "No local brain connection. I'm still here, just less encyclopedic.", "I'd rather admit I'm offline than invent an answer. I can still show your memories."],
} as const;
