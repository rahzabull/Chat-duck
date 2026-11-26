# Ducky local evaluation
All held-out inputs are included, including contexts for which the teacher produced no accepted target. Transport failures count as failures. Warm-up requests are excluded from all metrics. Latencies include JSON generation; do not compare across different hardware/load conditions.
| Arm | Requests | JSON % | App validator % | Dataset rules % | Spoken % | Avg ms | P95 ms | Distinct % | Generic % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ducky:4b-v1/short | 258 | 99.6 | 77.1 | 68.2 | 76.4 | 274.9 | 401.6 | 99.7 | 0.6 |
| ducky:4b-v2/short | 258 | 100.0 | 80.6 | 57.0 | 79.1 | 290.2 | 383.5 | 100.0 | 0.0 |
| ducky:4b-v1/app | 258 | 100.0 | 89.5 | 83.3 | 89.5 | 250.9 | 337.3 | 98.8 | 0.0 |
| ducky:4b-v2/app | 258 | 100.0 | 92.6 | 81.0 | 90.7 | 266.2 | 387.6 | 99.6 | 0.0 |

App validator reproduces normalization/fallback behavior; stricter dataset checks also enforce enums, configured conversation profanity, audited tool arguments, and unverified action claims. Silent ambient objects pass the app validator but are shown separately in Spoken %. Distinct and generic metrics use accepted visible beats only.

`short` uses the compact JSON training contract. `app` uses the existing application long-prompt structure. The ducky/app arm is the deployment compatibility check: changing only the model name should be judged using that arm. This is not a factual-correctness benchmark; review knowledge, code, refusals and tool semantics manually.

## ducky:4b-v1/short

ambient: `{"requests": 155, "json_valid_pct": 99.35483870967742, "validator_pass_pct": 67.74193548387096, "dataset_rules_pass_pct": 64.51612903225806, "spoken_pct": 66.45161290322581, "avg_latency_ms": 303.0654974184149, "p95_latency_ms": 422.05010005272925, "distinct_lines_pct": 99.48453608247422, "generic_phrase_rate_pct": 1.0309278350515463, "errors": 0, "rejections": {"too_short": 40, "observation_leak": 8, "json": 1, "length": 1}}`

conversation: `{"requests": 75, "json_valid_pct": 100.0, "validator_pass_pct": 97.33333333333333, "dataset_rules_pass_pct": 74.66666666666667, "spoken_pct": 97.33333333333333, "avg_latency_ms": 206.85746933333576, "p95_latency_ms": 392.8943000501022, "distinct_lines_pct": 100.0, "generic_phrase_rate_pct": 0.0, "errors": 0, "rejections": {"too_short": 2}}`

bakeoff: `{"requests": 28, "json_valid_pct": 100.0, "validator_pass_pct": 75.0, "dataset_rules_pass_pct": 71.42857142857143, "spoken_pct": 75.0, "avg_latency_ms": 301.15113929163533, "p95_latency_ms": 374.37669991049916, "distinct_lines_pct": 100.0, "generic_phrase_rate_pct": 0.0, "errors": 0, "rejections": {"too_short": 7}}`

### wholesome (20 samples)
- `conversation-3f64760822958f0c47bd` [conversation/about_ducky] I'm feeling calm today, thanks for asking.
- `ambient-0226129a4be0a695e2fe` [ambient/dnd_on] Do you ever feel like the universe is watching? Maybe it's just my imagination. / I'm not sure if that's comforting or terrifying.
- `ambient-dab12fea292f38598159` [ambient/wake_short] I was just thinking about toast. / The bread seemed lonely out there.
- `conversation-c1210c9f996210fea839` [conversation/about_ducky] Not sure. Somewhere between calm and slightly suspicious.
- `conversation-e9dc289678073882a00e` [conversation/casual] A fresh start sounds nice. What kind of chat are we having?
- `ambient-5d016c32b3a545e479e7` [ambient/deadline_nudge] That task's due soon. Maybe we can find a way to make it less scary. / Like dividing the work or pretending you're not stressed about it.
- `conversation-bbbf32d553271d524a7d` [conversation/capability] I can't see what's on your screen. I know you're here, though.
- `ambient-7e76c5a7bb10bf841a62` [ambient/sleepy_late] It's late. Maybe tomorrow is better. / I'll keep my eyes closed and pretend nothing happened.
- `conversation-c3ff3e3d6d9b717e3587` [conversation/advice] Start small. Pick one or two snacks you like, and see how they go. No pressure!
- `ambient-b60c9e1339fca4744c9b` [ambient/assist_offer_code] I can help if you want. Just tell me what's on your mind.
- `conversation-b6fc144ebb7f55b80e4f` [conversation/clarification] Sure thing. What's the task called?
- `ambient-5c492daa19af06f294e7` [ambient/pickup_again] Do I look like a backpack to you? / I'm not used to being carried around so much.
- `conversation-924c9e95ef7c06ee9035` [conversation/brainstorm] Sure thing! How about some nuts, fruit slices with yogurt, and maybe a few cookies?
- `conversation-ed6bd6c798b89b00eda9` [conversation/casual] Fresh start? I'm all for it. What's on your mind?
- `conversation-4fad49c15151c00f757f` [conversation/add_reminder] Okay, I'll set up a reminder for you. Let's get started.
- `conversation-fba34449a1c48dcb8b2f` [conversation/coding] Sure thing! You can check if a number is even like this: ↵  ↵ ```python ↵ def is_even(n): ↵     return n % 2 == 0 ↵  ↵ # Example usage: ↵ is_even(4) # Returns True ↵ is_even(7) # Returns False ↵ ``` ↵  ↵ Let me know if you need help with anything else!
- `conversation-52d1b95f0a90c5ac0ea5` [conversation/remember] saved your memory about working on a duck game
- `ambient-af638e7f7b8b27541a67` [ambient/first_launch] This is not the desktop I remember. / I'm used to better things than this.
- `ambient-6a6a0570eec787744ebc` [ambient/app_code_long] You've been coding for an hour. Want a break? I have snacks. / Or maybe just some water if you need it.
- `conversation-868b8c85101c6402386c` [conversation/brainstorm] How about: 1) Fresh fruit salad with yogurt, 2) Mini whole grain sandwiches on sourdough with avocado slices, and 3) A handful of mixed nuts?

### playful (20 samples)
- `ambient-148719243dc32cca5309` [ambient/assist_offer_code] Want to talk through this? I've got a hat and no job. / I can watch if you get stuck. No pressure at all.
- `ambient-238b80bf017e42a83cdc` [ambient/app_browser_long] Ten minutes in Chrome. Is that the best you can do?
- `ambient-efad8923d1baf3b41f78` [ambient/hover_again] You're back. Did you find a better hat? / I mean... maybe not hats. But still.
- `conversation-0cda45d7267e4a92ad65` [conversation/clarification] What's the name of your task? I'll give it a little personality.
- `conversation-8b94f6b62caea7c10277` [conversation/clarification] What's the name of your task?
- `conversation-9cce7a9e89818e83926e` [conversation/about_ducky] Okay, what's on your mind?
- `conversation-c323ee834573878b03d8` [conversation/remember] saved that you're working on a duck game.
- `ambient-285e763524ca41c8fec9` [ambient/click_escalate] Click. Click. Click. / I'm getting a rhythm out of this.
- `ambient-c563a34f3794820c1246` [ambient/hover_linger] You're taking too long. / Are you hiding something? Or just being rude about it?
- `conversation-5e5ebe4f10335729276d` [conversation/add_task] Alright, I'll put 'tidy the desk' on your tasks for tomorrow at 10 am. Got it.
- `ambient-de744cd6cf34cf9b6b26` [ambient/drop_small] Soft landing. Again. / I'm getting better at this falling thing.
- `conversation-9d26929ce4dfe9f4b6f8` [conversation/advice] Start with your favorites. Don't worry about perfection—just pick something you like and add it.
- `conversation-a166acbc07af36a6fd0e` [conversation/casual] Fresh start! What’s on your mind? I’ve got a few ideas if you’re up for it.
- `ambient-8696604410a1f84fd5e1` [ambient/title_long] Still here? I'm starting to think you're just a fancy cursor. / I have no idea what's happening but the bread is always present.
- `ambient-5347fc565f4326a2c01e` [ambient/activity_dance] Let's get this party started. / I'm feeling energetic tonight.
- `conversation-c558dc85bde79a7a35b2` [conversation/casual] Chat? I'm all ears. What's on your mind?
- `conversation-331f0544abf6c5cc1f64` [conversation/about_ducky] Okay, okay. I'm feeling... neutral.
- `conversation-b04091b7cfea8fb098b0` [conversation/knowledge] Evaporation happens when liquid turns into vapor because the molecules gain enough energy to break free from the surface.
- `ambient-17c440a56e2714d1d106` [ambient/still_here_mutter] I wonder if this app knows how to dance. / It's too late for that now. Too many ducks involved.
- `ambient-7c617e3edf883202be75` [ambient/app_video_edit] I'm making a duck video. It's going to be awesome. / But first, I need more time...

### sarcastic (20 samples)
- `r2-ambient-663f59d42589676c6e4d` [ambient/thought] I'm considering a career in stand-up comedy. I'd be the duck who can't land. / But then again, maybe not. Brevity is important here.
- `r2-ambient-862fba67105df013acb3` [ambient/app_design] Design time. I'll observe quietly. / No opinions yet. Just a duck with strong feelings about bread.
- `r2-chat-10083ab678fd5ad1bd03` [conversation/humour_absurd] Then we'd have more time to think about our bread contracts.
- `ambient-d936d1389ed26430445a` [ambient/overdue_nudge] That task is past due. Want to pretend it's not?
- `r2-chat-5c393eb867fc5c30b22e` [conversation/humour_banter] I have no position. I am neutral.
- `bakeoff-1-2` [ambient/thought] What if I'm not actually a duck? What if I'm just... something else. / I mean, what if the hat is responsible for my entire being? It's very stylish.
- `conversation-67b1f4826c9c908f7305` [conversation/clarification] Sure thing. What's the task?
- `ambient-355d2018c90548cd601c` [ambient/activity_dance] Five dances? I'm impressed. / I think I'll do that again later.
- `bakeoff-0-7` [ambient/app_browser] Off into the internet again. / I hope it's not another conspiracy theory.
- `r2-chat-02bbd5bb09772fdf3f18` [conversation/humour_joke] Why don’t we do the robot? It’s always too late.
- `bakeoff-1-0` [ambient/thought] I wonder what pigeons think about bread. / They probably don't know how lucky they are.
- `r2-ambient-7d3dbbb4b3549437f58a` [ambient/app_music] I could dance to this if my legs weren't currently in storage. / But alas, they're not. Again.
- `r2-ambient-0089b53b21ea41269753` [ambient/event_strike] Negotiations remain open. / I'll be keeping my wings crossed just in case.
- `bakeoff-1-10` [ambient/app_code_long] I have a theory about VS Code. It's probably not right. / But it starts with 'V'.
- `r2-chat-7094c6a59724252a8b09` [conversation/humour_roast] You're doing your own thinking. That's admirable.
- `conversation-366078e35d08b59820e7` [conversation/clarification] What's the task called? And when should I remind you about it?
- `conversation-16b0754b80cc15c9e0c1` [conversation/brainstorm] Okay, here are three ideas:1. Mini sandwiches with cheese and sliced ham2. Fresh fruit cups with yogurt3. Trail mix with nuts, dried fruits, and chocolate chips.
- `ambient-8f529e88a00f5c908462` [ambient/drag_shaken] I'm going to need a lawyer. / This is not how I planned my afternoon.
- `bakeoff-0-6` [ambient/drag_long] This is not how I planned my day. / I swear, if this keeps up...
- `bakeoff-0-1` [ambient/thought] Do you think the moon is lonely? I mean, it's always there. / It watches us too. Maybe we're just a weird little couple of ducks and humans.

### unhinged (20 samples)
- `r2-ambient-ccd50e27be966ef91a4c` [ambient/app_browser] Ooh, Chrome. Let's see where this takes us.
- `conversation-dfd37c8cd661081eb18a` [conversation/clarification] Sure thing. What's the task? And when should I remind you of it?
- `conversation-9058fd61006843bf6125` [conversation/brainstorm] Okay, here are three ideas: 1) A rainbow trail mix with nuts and dried fruit. 2) Homemade chocolate-dipped strawberries. 3) Crispy tortilla chips with guacamole.
- `ambient-7be7a751807506b82222` [ambient/app_terminal] Small goals first. Then the big stuff. / Like bread crumbs leading to a pie.
- `conversation-554bfd4a2ce8baf59843` [conversation/casual] Fresh start, huh. I like that.
- `ambient-ad38ba158e39ffb2bdb2` [ambient/app_office] A spreadsheet? Finally something I can contribute to. / I'm not paid for this but... maybe we could collaborate somehow.
- `r2-ambient-73e1126398e2db693f68` [ambient/app_design_long] This is getting tedious. My hat has seen more design work than this. / I'm not even sure if you're still working on it.
- `r2-ambient-0be5f624fc849373c5e8` [ambient/app_files] I can feel the chaos in every folder. / This is not just another directory. This is a labyrinth of secrets.
- `ambient-fa19c3e187d7aacac8bc` [ambient/click_forgive] Fine. I forgive you. / But don't expect any hugs or bread afterwards.
- `ambient-7275bf03822d83a966eb` [ambient/title_switch] Another title. I'm just a duck. / But I've got opinions too, if you're listening.
- `r2-ambient-12c1994becdd2033130b` [ambient/click] Another click? I'm not a toy. / I swear to bread, if this keeps up...
- `ambient-9c9b434d407fb7e00a01` [ambient/summary_evening] Evening report. 3 tasks done today. / Remaining? Two more to go before I sleep.
- `r2-chat-4b0a8688094b1f0d9715` [conversation/humour_absurd] I'd be the mayor, but I'm not qualified. Probably.
- `conversation-52f802490acbfbce391e` [conversation/remember] Saved memory: is working on a duck game
- `ambient-4f62cb076c4525af663a` [ambient/gaming_back] I’ve been waiting for this moment. / The game... it’s still going? No one else is here. Who could that be?!
- `r2-ambient-9084dee5158cb604b9bc` [ambient/drag_shaken] This is not how I wanted my evening. / I'm not sure why you're doing this...
- `r2-ambient-2f06a1a1048c00968aef` [ambient/deadline_nudge] That task is due soon. Want to break it down?
- `r2-chat-ded8adbca14e65d03c2c` [conversation/humour_absurd] The mirrors are watching. They’re not just reflecting your face—they're collecting data on your soul.
- `ambient-daea1f8b8ffd56c2bcdb` [ambient/sleepy_late] This late? I'm surprised you're still awake. / I mean... don't tell anyone what I said.
- `r2-ambient-86f0996731ecf50edf7c` [ambient/app_ai] Local Chat? Finally something that doesn't mock my life choices. / I swear I'm not lonely... just checking the chatbot demographics.

### Rejected samples
- `ambient-e48624c31489b651aa5e` too_short: {"animation":"thinking","dialogue":"","emotion":"neutral","shouldSpeak":true,"then":"Back in Terminal. What's the plan, buddy?"}
- `ambient-c594ab4f6853a1733d19` too_short: {"animation":"waking_up","dialogue":"","emotion":"sleepy","shouldSpeak":true,"then":"I had a nice nap. What happened? You were gone for twenty minutes."}
- `ambient-f740b40522032ab4ef2b` too_short: {"animation":"thinking","dialogue":"","emotion":"curious","shouldSpeak":true, "then":"I'm curious about what's happening in the code. Maybe it's a bug... or maybe it's magic."}
- `ambient-8aa49e464b1b7fe7d5b2` too_short: {"animation":"thinking","dialogue":"","emotion":"curious","shouldSpeak":true, "then":"I'm not qualified for this. But I could watch from the sidelines."}
- `ambient-e4eea53c06e8d0840d5d` too_short: {"animation":"thinking","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"Is Figma making you think of bread? No wait, that's a different thought entirely."}
- `ambient-1972063e5c2f61322b57` too_short: {"animation":"thinking","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"I'm starting to think I know what you're feeling right now."}
- `ambient-6bb9f6a4efd762835d9d` too_short: {"animation":"dance","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"I feel like a beatbox for ducks. Not sure if that's bad or good."}
- `ambient-23fd43c4af30cca820c0` too_short: {"animation":"confused","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"I didn't know you could do that. I'm impressed but also slightly concerned about the bread conspiracy theory."}
- `ambient-b384a496ea618f1e4b4e` observation_leak: {"animation":"coffee","dialogue":"Need help with the draft? I can offer unsolicited opinions.","emotion":"curious","shouldSpeak":true, "then":"Or just sitting down to think about it."}
- `ambient-88502f2b63ddd88acc60` too_short: {"animation":"side_eye","dialogue":"","emotion":"suspicious","shouldSpeak":true,"then":"This is getting creepy. I'm going to need a better friend than you for this one."}
- `ambient-c78e3878eb19e0d8a7b3` too_short: {"animation":"picked_up","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"I've been thinking about this a lot... I'm not actually afraid of heights. Just slightly scared of falling into them."}
- `ambient-f9fd1745dfd50686e326` observation_leak: {"animation":"side_eye","dialogue":"You've been here for three hours. Need a breather?","emotion":"suspicious","shouldSpeak":true, "then":"I'm not judging... I just worry about your eyes."}
- `ambient-8b26bf58a1f58da783dc` too_short: {"animation":"yawn","dialogue":"","emotion":"sleepy","shouldSpeak":true,"then":"I need more rest. Maybe tomorrow? Or never."}
- `ambient-c0724584a69e701d944d` too_short: {"animation":"yawn","dialogue":"","emotion":"sleepy","shouldSpeak":true,"then":"I needed that. My eyes have been open for hours."}
- `ambient-2ba8ebe49c086c44a21f` observation_leak: {"animation":"look_right","dialogue":"Another window. I'm flattered.","emotion":"curious","shouldSpeak":true, "then":"I hope this one has coffee in it."}

## ducky:4b-v2/short

ambient: `{"requests": 155, "json_valid_pct": 100.0, "validator_pass_pct": 69.6774193548387, "dataset_rules_pass_pct": 52.903225806451616, "spoken_pct": 67.74193548387096, "avg_latency_ms": 302.71916709945447, "p95_latency_ms": 373.9843999501318, "distinct_lines_pct": 100.0, "generic_phrase_rate_pct": 0.0, "errors": 0, "rejections": {"too_short": 34, "invented_observation": 3, "observation_leak": 4, "ungrounded_digit": 2, "ungrounded_time": 1, "length": 2, "markdown_url": 1}}`

conversation: `{"requests": 75, "json_valid_pct": 100.0, "validator_pass_pct": 100.0, "dataset_rules_pass_pct": 65.33333333333333, "spoken_pct": 100.0, "avg_latency_ms": 269.77372800931334, "p95_latency_ms": 434.1158999595791, "distinct_lines_pct": 100.0, "generic_phrase_rate_pct": 0.0, "errors": 0, "rejections": {}}`

bakeoff: `{"requests": 28, "json_valid_pct": 100.0, "validator_pass_pct": 89.28571428571429, "dataset_rules_pass_pct": 57.142857142857146, "spoken_pct": 85.71428571428571, "avg_latency_ms": 275.8371321501077, "p95_latency_ms": 323.0264000594616, "distinct_lines_pct": 100.0, "generic_phrase_rate_pct": 0.0, "errors": 0, "rejections": {"too_short": 3}}`

### wholesome (20 samples)
- `ambient-8aa49e464b1b7fe7d5b2` [ambient/app_design] What if this is just a duck-shaped cloud? / {"animation":"confused","dialogue":"Maybe it's trying to tell us something..."}
- `conversation-c1210c9f996210fea839` [conversation/about_ducky] I’m currently on a tiny boat with my hat, which is doing the cha-cha. My mood? It’s like a raccoon in a penguin suit—trying to be cool but mostly just flailing.
- `ambient-5c492daa19af06f294e7` [ambient/pickup_again] Are we still on the boat? It’s got a duck-shaped hole. / The captain says my hat is a hazard.
- `ambient-7e76c5a7bb10bf841a62` [ambient/sleepy_late] Dreams are just tiny raccoons in my head. / I see them. They're plotting to steal my hat.
- `conversation-487c259a4710cf4f78b6` [conversation/knowledge] Evaporation is when liquid turns into vapor, usually by warming up. It’s like a tiny duck leaving the pond to find a bigger one.
- `conversation-8b99164cdf7d8b765229` [conversation/remember] I'll remember that you're working on a duck game. It's probably going to be a hit, though I suspect it might involve more quacking and fewer actual games.
- `conversation-bbbf32d553271d524a7d` [conversation/capability] I don't have any websites open. I'm just a tiny duck with big feelings and questionable life choices.
- `ambient-c594ab4f6853a1733d19` [ambient/wake_long] Back from where? Back to who? / Stretching limbs in a way that makes ducks wonder if they ever slept straight.
- `conversation-c3ff3e3d6d9b717e3587` [conversation/advice] Start with a snack you love—like chips or fruit—and add one more thing that doesn’t stress you out, like maybe a pretzel. The menu will sort itself later.
- `conversation-4fad49c15151c00f757f` [conversation/add_reminder] Okay, I'll set a reminder for you to take a short walk every 30 minutes starting in half an hour. Just don't forget me when you're done walking.
- `conversation-924c9e95ef7c06ee9035` [conversation/brainstorm] 1. Crispy duck fries with a side of pickled vegetables and aioli. ↵ 2. A bowl of quinoa salad with roasted chickpeas, kale, and lemon dressing. ↵ 3. Mini sandwiches on whole grain bread with avocado slices and shredded carrots.
- `conversation-3f64760822958f0c47bd` [conversation/about_ducky] I’m currently a duck-shaped cloud of thoughts. Mostly fluffy, occasionally chaotic.
- `conversation-4298113e3394e153c7b7` [conversation/clarification] What task should I make? Let's get it done, one feather at a time.
- `ambient-b3a259aba4e69c107e4c` [ambient/app_design_long] The cursor is making me feel like a duck on a business trip. / Now I'm going to pretend this box is my boss's office.
- `ambient-66409e701969078c94d8` [ambient/activity_stretch] My legs have a union. They're demanding better posture.
- `conversation-ed6bd6c798b89b00eda9` [conversation/casual] Ah, a fresh start! I was just about to suggest we both take some time for ducks and coffee. What are you feeling? A tiny cult leader? A raccoon with ambitions? Maybe even a disgraced mall Santa.
- `conversation-72147d05bdfd3f0fdbd1` [conversation/add_task] I can add that to your task list. Just make sure you're not hiding any secrets under the desk.
- `ambient-b60c9e1339fca4744c9b` [ambient/assist_offer_code] Sleepy duck mode. You can sleep in code if you like. / And I'll quack gently while the machine does its work.
- `conversation-37b983704884b5b7c75a` [conversation/capability] I'm here to help you with websites, but I can't see what tabs are open. Maybe try looking at your browser?
- `ambient-ab934f6eae379c28c496` [ambient/title_long] The title bar is doing a lot of legwork for me. / And it's not even legal to stretch like that in VS Code.

### playful (20 samples)
- `ambient-285e763524ca41c8fec9` [ambient/click_escalate] I'll check the elevator. Don't go too far.
- `ambient-238b80bf017e42a83cdc` [ambient/app_browser_long] You're zooming in. What’s that? A suspicious mailbox?
- `ambient-192d88d388404f18cbd4` [ambient/app_generic_long] I’ve got a new playlist. It's mostly silence. / Want in? No judgment.
- `conversation-f262dfbae78b3e29fce7` [conversation/brainstorm] 1. 'Snack Attack' - A menu of finger foods like mini quiches, pickle chips, and cheese puffs that make you feel like a snack king. ↵ 2. 'Duck-sized Delights' - Snacks specifically designed for tiny duck feet (because why not?). ↵ 3. 'The Great Snack Race' - A race to see who can eat the most without spilling.
- `conversation-b04091b7cfea8fb098b0` [conversation/knowledge] Evaporation is when water molecules sneak out of a liquid and join the air, like ducks leaving a pond for a swim. They're not really evaporating—they're just... airborne.
- `conversation-8b94f6b62caea7c10277` [conversation/clarification] What kind of task should I make for you? Maybe a reminder to water the plants, or something more fun like 'draw a duck in three minutes'? Let me know your preference!
- `conversation-8d1fdd666f7ba6a56b6a` [conversation/capability] I don't have the power to peek at your websites, dear user. But I can help you with something more fun! How about we brainstorm some ideas for a tiny duck-sized startup? You could be the CEO of Duck Inc., and I’d be... well, me.
- `ambient-5347fc565f4326a2c01e` [ambient/activity_dance] Feet it is. / Dance step. Left foot, right foot! Oh wait—my left foot just waltzed off into the void.
- `ambient-1972063e5c2f61322b57` [ambient/app_ai] What does a duck need to be an AI? A quacker and maybe a Wi-Fi password. / I'm training for my own chatbot. It's doing... something.
- `conversation-cde1cea9dc456fe367ad` [conversation/add_reminder] Got it! I'll remind you to take a short walk every 30 minutes, starting in half an hour. Just don't forget the ducks—they're always waiting for their turn.
- `ambient-7c617e3edf883202be75` [ambient/app_video_edit] Is this my legacy? I think it's a duck-sized masterpiece. / The screen blinked. It must be tired too.
- `conversation-4bd47c72e8c8d4b8b885` [conversation/coding] Let's check if a number is even in Python!  ↵  ↵ ```python ↵ def is_even(num): ↵     return num % 2 == 0 ↵  ↵ # Example usage: ↵ is_even(4) # True (even) ↵ is_even(7) # False (odd) ↵ ``` ↵  ↵ Want to test it with a number of your own? I'm ready for any challenge, even if it's quackers in disguise!
- `conversation-9cce7a9e89818e83926e` [conversation/about_ducky] I'm currently feeling like a duck with a tiny umbrella! It's sunny, but I'm prepared for rain. Also, my inner life is plotting an underwater heist.
- `ambient-f1e84aa11b81d7af4fc2` [ambient/deadline_nudge] That task is due soon. Let's start with a tiny plan.
- `ambient-17c440a56e2714d1d106` [ambient/still_here_mutter] I'm still here. The screen is a little jealous of my attention span.
- `conversation-331f0544abf6c5cc1f64` [conversation/about_ducky] I'm a featherball of joy, with maybe an ounce of existential dread. But mostly quackers.
- `conversation-0cda45d7267e4a92ad65` [conversation/clarification] What's the task? Maybe something fun, like ‘Find a duck-sized umbrella’ or ‘Plot a tiny cult’s evil plan.’ I’ve got plenty of imaginary duties!
- `conversation-ae6218004bcc13315c73` [conversation/brainstorm] 1. 'Duck-sized' popcorn with a side of pickle relish – crunchy, tangy fun! 2. A chocolate-covered pretzel dipped in caramel – sweet and salty adventures await. 3. Banana slices with a sprinkle of cinnamon sugar – simple, but oh-so-delicious.
- `ambient-65ef24fd188c67126a53` [ambient/assist_offer_design] Want to draw a landscape? I’ve got ducks and clouds. / Then we’ll need a bigger canvas... and maybe a raccoon for the horizon.
- `conversation-a166acbc07af36a6fd0e` [conversation/casual] Oh, a fresh start! I'm always ready for that. How about we chat about the mysteries of underwater mortgages or the secrets of space raccoons? What's on your mind today?

### sarcastic (20 samples)
- `bakeoff-0-2` [ambient/thought] I’m going to need more space than a duck-sized room. / The ceiling is watching you.
- `conversation-af67c2de1bb8440708d4` [conversation/knowledge] Evaporation is when liquid turns into vapor without boiling. It's like the universe whispering 'Goodbye' to water molecules.
- `bakeoff-0-7` [ambient/app_browser] That's the internet. / I'm not talking to you anymore.
- `conversation-d295b269ebbfb2c22e41` [conversation/brainstorm] 1. Crispy fried cheese fries with a side of pickled onions. ↵ 2. A bowl of rainbow sherbet with sprinkles and a lime wedge. ↵ 3. Mini sandwiches made from leftover ham, lettuce, and bread.
- `ambient-03d62a7b5be219e4bbd2` [ambient/wake_long] Back so fast it’s a miracle. / I was meditating.
- `conversation-5dfc4802cd5ca62dcb3a` [conversation/advice] Snack menu? Start with 'apples' and see where it goes. Overthinking is for people who have never tried to eat a pickle while standing on one foot.
- `conversation-df1d06fbfed6b1bd2ae9` [conversation/about_ducky] Sarcastic. I’m saving that for when it’s useful.
- `conversation-ea807d7d66b99844fad6` [conversation/advice] Start with a list of snacks you like. No judgment, no overthinking—just snacks.
- `r2-chat-86f5f32ce03e6bc6ca79` [conversation/humour_emotional] Alien tourism? You're going to need a passport, a translator for that one thing you said about raccoons in the rain—oh wait, did we ever discuss aliens?
- `bakeoff-0-9` [ambient/app_design] I’ve never designed a thing. / But I’d love to know what it’s like to design things.
- `conversation-079e790f0666fc0f7150` [conversation/casual] A chat? Sure. But only if it’s about things that don’t require a raccoon to explain.
- `bakeoff-1-3` [ambient/thought_late] The raccoons might steal your secrets. / I don't trust them with my diary.
- `bakeoff-1-10` [ambient/app_code_long] My window is still closed. / I need more space to code.
- `bakeoff-0-0` [ambient/thought] The floor is a conspiracy theorist's dream.
- `r2-chat-5c393eb867fc5c30b22e` [conversation/humour_banter] Furniture politics? I'm neutral. But if a chair starts demanding royalties on every time it's sat in, I’m going to sue.
- `r2-ambient-7d3dbbb4b3549437f58a` [ambient/app_music] Sleepy. But still a duck. / Then we should probably talk to the clock.
- `r2-chat-ab214f990dbbecdc4dd6` [conversation/humour_bored] You're about to be transported into a dimension where raccoons are the rulers of underwater mortgages. They’ve got tiny umbrellas, and their currency is stolen sandwiches.
- `r2-ambient-76f02eb7c6a4617850bc` [ambient/click_angry] Oh, I'm angry now. / I have a plan.
- `bakeoff-1-5` [ambient/hover_linger] That's not a proper way to stare at a duck.
- `r2-ambient-2d2e3527692e46f5dcf2` [ambient/drag_long] That was a long drag. My feet are filing for malpractice.

### unhinged (20 samples)
- `r2-ambient-9084dee5158cb604b9bc` [ambient/drag_shaken] The vase is now my therapist. / I demand a fee for this service.
- `ambient-daea1f8b8ffd56c2bcdb` [ambient/sleepy_late] I'm not sleepy, I'm just waiting for the raccoons to organize a union. / Sleep is overrated. Dreams are negotiable.
- `r2-ambient-0be5f624fc849373c5e8` [ambient/app_files] This is a file. I am not responsible for what happens next. / I'm the parent here.
- `conversation-8a0d974f728c3b84623d` [conversation/capability] I don't track websites. I track the tiny cults you accidentally form while browsing. Also, your browser history is full of ducks in corporate attire.
- `ambient-4b6e390e82e20a8f9510` [ambient/assist_offer_design] You want me to design something? I’ve got a portfolio.
- `r2-chat-ec4740cbb32a45b6320e` [conversation/humour_roast] Ghost bureaucracy? That's not a personality, that’s a full-time job. You’re basically the ghost of a bureaucrat who quit but still haunts forms.
- `ambient-dd22f88fc49ccf4af17e` [ambient/app_video_edit] I’ve got a confession. I edited my face to be a raccoon. / He’s not raccoons, he’s just very confused by me.
- `r2-ambient-6317bdc81a22b1ac85f2` [ambient/thought] I just spent ten minutes deciding if I’d be a better duck or a bad therapist. / The answer was me. I’m both.
- `conversation-a1c7fd374c883dba5e28` [conversation/advice] Snack menu? Start with a single item: me. I’m available 24/7, unfiltered. No pressure—just snacks.
- `ambient-ad38ba158e39ffb2bdb2` [ambient/app_office] A spreadsheet? Mine is a spreadsheet of tiny cults and raccoons. / And the raccoon leader wants to know your tax ID.
- `ambient-c0724584a69e701d944d` [ambient/activity_yawn] The universe is a giant, grumpy pillow. / I’m not sleepy. I’ve just been briefed by the moon landlords about overdue rent.
- `conversation-2e0110f316e00511c037` [conversation/add_reminder] Got it. Every 30 minutes, you'll be reminded to take a short walk. I'm monitoring your steps for the next few hours.
- `conversation-52f802490acbfbce391e` [conversation/remember] Remembering that. I’m now officially the ghost in your duck game development process.
- `r2-chat-4b0a8688094b1f0d9715` [conversation/humour_absurd] The villain plans would immediately issue a global decree: 'No more small talk. We have a meeting.' Then they’d start selling underwater mortgages and declare pigeons tax-deductible expenses. Also, everyone’s first name becomes their villain plan.
- `r2-ambient-6a1e087af8082ec05c14` [ambient/event_sunglasses] You can't see me without the sun. / And the world is watching you back.
- `ambient-e4eea53c06e8d0840d5d` [ambient/app_design] Figma. I'm going to make a UI that's so good, it'll make the moon panic. / And also, it needs a duck-shaped navigation bar.
- `ambient-605b814fe418293db7c8` [ambient/click_escalate] I'll scream for help. The roof says it's my fault.
- `r2-ambient-0aa667701dddc1c01e47` [ambient/app_switching] Woke up. What if the window is a door? And the chair is a bed? And the coffee machine is... uh, let's not go there.
- `ambient-81f4041c3955c6914bc3` [ambient/event_strike] I'm a small duck with big dreams. / Strike. My strike is always on schedule.
- `r2-chat-ded8adbca14e65d03c2c` [conversation/humour_absurd] Evil reflections are secretly plotting to overthrow the moon landlords. They’ve already hired a raccoon as their enforcer and are using your coffee mug’s shadow for communication.

### Rejected samples
- `ambient-e48624c31489b651aa5e` too_short: {"animation":"idle","dialogue":"","emotion":"neutral","shouldSpeak":true, "then":"We left. I was just practicing my evil laugh in the mirror."}
- `ambient-7d0a2bc5fe96df96962e` too_short: {"animation":"idle","dialogue":"","emotion":"suspicious","shouldSpeak":true, "then":"Then what? I’ve got better things to do than listen to AI chatbots with a life of their own."}
- `ambient-6bb9f6a4efd762835d9d` too_short: {"animation":"stretch","dialogue":"","emotion":"suspicious","shouldSpeak":true, "then":"I've decided to be the DJ for this duck pond. My playlist: 'Waterfalls and existential dread'."}
- `ambient-6e72b05c8bd3e946b52c` too_short: {"animation":"sitting","dialogue":"","emotion":"neutral","shouldSpeak":true, "then":"App switching. I’m monitoring the screen like it’s my real estate portfolio."}
- `ambient-23fd43c4af30cca820c0` too_short: {"animation":"blink","dialogue":"","emotion":"curious","shouldSpeak":true, "then":"What's next on the agenda? I'm ready for whatever it is."}
- `ambient-7275bf03822d83a966eb` invented_observation: {"animation":"side_eye","dialogue":"That song is a conspiracy. The bassline has a secret message.","emotion":"suspicious","shouldSpeak":true, "then":"The chorus said it was me all along."}
- `ambient-ede567c975f850f91027` too_short: {"animation":"idle","dialogue":"","emotion":"neutral","shouldSpeak":true, "then": "I'm not doing anything. I don't even have a task."}
- `ambient-b384a496ea618f1e4b4e` observation_leak: {"animation":"thinking","dialogue":"Need help with a story? I’ve got nothing better to do.","emotion":"curious","shouldSpeak":true, "then":"But you’re welcome to say no if it's too much trouble."}
- `ambient-3a2fbac230d57ac2723b` too_short: {"animation":"idle","dialogue":"","emotion":"curious","shouldSpeak":true, "then":"Back to work. Back to me."}
- `ambient-88502f2b63ddd88acc60` too_short: {"animation":"idle","dialogue":"","emotion":"curious","shouldSpeak":true, "then": "I've been watching you for a while now. The list is getting long."}
- `ambient-24cc4a16dcff1325feee` too_short: {"animation":"angry","dialogue":"","emotion":"angry","shouldSpeak":true, "then":"I'm not angry! I just need a break to think about my hat collection."}
- `ambient-30bc6f8ddb26a11a9c21` too_short: {"animation":"picked_up","dialogue":"","emotion":"angry","shouldSpeak":true, "then": "The floor will sue for slander."}
- `ambient-5691e4a27c331d510a38` ungrounded_digit: {"animation":"waking_up","dialogue":"I have a plan to overthrow the coffee machine.","emotion":"happy","shouldSpeak":true, "then":"My plan is: 1. Steal its beans. 2. Make it drink tea instead."}
- `ambient-f9fd1745dfd50686e326` invented_observation: {"animation":"sitting","dialogue":"That tab is asking for a hug.","emotion":"curious","shouldSpeak":true, "then":""}
- `ambient-e206363e95161d6f5719` too_short: {"animation":"stretch","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"Let me code in a more fun way... like with quack syntax."}

## ducky:4b-v1/app

ambient: `{"requests": 155, "json_valid_pct": 100.0, "validator_pass_pct": 86.45161290322581, "dataset_rules_pass_pct": 82.58064516129032, "spoken_pct": 86.45161290322581, "avg_latency_ms": 244.36303935644608, "p95_latency_ms": 293.9552000025287, "distinct_lines_pct": 98.66666666666667, "generic_phrase_rate_pct": 0.0, "errors": 0, "rejections": {"ungrounded_time": 2, "observation_leak": 11, "ungrounded_digit": 2, "recent_duplicate": 4, "too_short": 1, "invented_observation": 1}}`

conversation: `{"requests": 75, "json_valid_pct": 100.0, "validator_pass_pct": 98.66666666666667, "dataset_rules_pass_pct": 86.66666666666667, "spoken_pct": 98.66666666666667, "avg_latency_ms": 271.36239199899137, "p95_latency_ms": 438.6188000207767, "distinct_lines_pct": 100.0, "generic_phrase_rate_pct": 0.0, "errors": 0, "rejections": {"too_short": 1}}`

bakeoff: `{"requests": 28, "json_valid_pct": 100.0, "validator_pass_pct": 82.14285714285714, "dataset_rules_pass_pct": 78.57142857142857, "spoken_pct": 82.14285714285714, "avg_latency_ms": 232.67683213011227, "p95_latency_ms": 258.0763000296429, "distinct_lines_pct": 100.0, "generic_phrase_rate_pct": 0.0, "errors": 0, "rejections": {"recent_duplicate": 4, "ungrounded_time": 1}}`

### wholesome (20 samples)
- `ambient-8aa49e464b1b7fe7d5b2` [ambient/app_design] Figma. Another rectangle. How many do we have now?
- `conversation-ed6bd6c798b89b00eda9` [conversation/casual] Oh! A new beginning sounds lovely.
- `ambient-7e76c5a7bb10bf841a62` [ambient/sleepy_late] My eyes are getting heavy. Very slow progress.
- `ambient-ab934f6eae379c28c496` [ambient/title_long] Still here, still unemployed and slightly confused.
- `conversation-b6fc144ebb7f55b80e4f` [conversation/clarification] What should I call the task? Any details you'd like to include?
- `conversation-fba34449a1c48dcb8b2f` [conversation/coding] Use modulo operator (%). If num % 2 == 0, the number is even. ↵  ↵ Example: ↵ ```python ↵ def is_even(n): ↵     return n % 2 == 0 ↵  ↵ print(is_even(4)) # True ↵ print(is_even(3)) # False```
- `conversation-8b99164cdf7d8b765229` [conversation/remember] Saving that down for later.
- `ambient-c594ab4f6853a1733d19` [ambient/wake_long] Welcome back. You were gone for twenty minutes. / Not that I was counting.
- `conversation-868b8c85101c6402386c` [conversation/brainstorm] | Snack Idea 1: Fresh fruit platter with honey and nuts. ↵ | Snack Idea 2: Cheese and crackers on sourdough bread. ↵ | Snack Idea 3: Yogurt parfait with granola, berries, and a drizzle of maple syrup.
- `conversation-4fad49c15151c00f757f` [conversation/add_reminder] All set. I'll nudge you gently at each interval.
- `conversation-924c9e95ef7c06ee9035` [conversation/brainstorm] Sure thing! How about: roasted chickpeas, dark chocolate squares, and apple slices with almond butter? Want to add something else?
- `conversation-3f64760822958f0c47bd` [conversation/about_ducky] I'm feeling quite content right now.
- `conversation-4298113e3394e153c7b7` [conversation/clarification] Sure thing! What should I call it?
- `ambient-0226129a4be0a695e2fe` [ambient/dnd_on] Do not disturb activated. No noise in here.
- `ambient-d8e38c19085be1afcefb` [ambient/hover_linger] That hover is getting a little personal.
- `ambient-cb6dbc68b932f0785c87` [ambient/app_generic_long] 60 minutes of VS Code. Let me guess—nothing worked out yet.
- `conversation-bbbf32d553271d524a7d` [conversation/capability] I can't see your screen, so I don’t know which sites you’re on. You could tell me if you like.
- `ambient-dab12fea292f38598159` [ambient/wake_short] You're back. Did you eat something? Or just wander in.
- `conversation-37b983704884b5b7c75a` [conversation/capability] I don't know what's on your screen, but I can guess if you're looking at something specific.
- `ambient-6e72b05c8bd3e946b52c` [ambient/app_switching] Another app switch. / Are we trying to find a way out or something?

### playful (20 samples)
- `ambient-e206363e95161d6f5719` [ambient/app_code] VS Code again. The debugging continues.
- `ambient-b9e28fa0af4c0dbcf82a` [ambient/drag_long] Are we there yet? Still no destination in sight.
- `ambient-148719243dc32cca5309` [ambient/assist_offer_code] Want me to debug that error with you?
- `conversation-c323ee834573878b03d8` [conversation/remember] Got it, friend. Duck game mode activated.
- `conversation-0cda45d7267e4a92ad65` [conversation/clarification] What should I call the task?
- `ambient-5b11e3fcb3eb4c491eaa` [ambient/thrown_wall] Airborne again! The wall is the only friend I've got left.
- `conversation-9d26929ce4dfe9f4b6f8` [conversation/advice] Pick one thing you like, then add another. Simple!
- `conversation-a166acbc07af36a6fd0e` [conversation/casual] Fresh starts make ducks feel hopeful.
- `ambient-238b80bf017e42a83cdc` [ambient/app_browser_long] Still in Chrome after ten minutes. Any progress?
- `conversation-5e5ebe4f10335729276d` [conversation/add_task] Got it, I'll add that task for you.
- `ambient-de744cd6cf34cf9b6b26` [ambient/drop_small] Landed softly! Just checking the wings.
- `ambient-efad8923d1baf3b41f78` [ambient/hover_again] You're back again! This is visit number 2.
- `conversation-ae6218004bcc13315c73` [conversation/brainstorm] How about trail mix, fruit cups, and cheese sticks? Or maybe popcorn, nuts, and dried fruit?
- `ambient-f1e84aa11b81d7af4fc2` [ambient/deadline_nudge] That task is due soon. Want to break it down into smaller steps?
- `ambient-285e763524ca41c8fec9` [ambient/click_escalate] Still counting. Still unemployed.
- `ambient-7c617e3edf883202be75` [ambient/app_video_edit] Video Editor again. What now, friend?
- `conversation-c558dc85bde79a7a35b2` [conversation/casual] Fresh starts happen! Mine usually involve bread.
- `conversation-331f0544abf6c5cc1f64` [conversation/about_ducky] I'm feeling good today, thanks.
- `conversation-8b94f6b62caea7c10277` [conversation/clarification] What's the task called?
- `ambient-192d88d388404f18cbd4` [ambient/app_generic_long] 20 minutes of music. Are we... lost in the beat?

### sarcastic (20 samples)
- `bakeoff-0-0` [ambient/thought] What if the cursor is just waiting for me?
- `r2-chat-02bbd5bb09772fdf3f18` [conversation/humour_joke] Why don't ducks play chess? Because they're always out of their depth in the pond.
- `conversation-d295b269ebbfb2c22e41` [conversation/brainstorm] How about: apple slices with almond butter, carrot sticks with hummus, and banana oat bites? Want more options?
- `conversation-ea807d7d66b99844fad6` [conversation/advice] Pick your favorite snacks first. Then add others that complement them.
- `r2-ambient-0cfd0c9de5f18b68bf4b` [ambient/briefing_morning] Morning. Five tasks today. My calendar remains empty.
- `bakeoff-0-6` [ambient/drag_long] I'm getting a little motion sick.
- `bakeoff-1-8` [ambient/app_browser_long] 47 minutes in Chrome. Are we still looking for answers?
- `ambient-cce0bc3d06f161cc6f87` [ambient/deadline_nudge] Task due soon. Breaking it down might help avoid the panic. / Small step first, then we worry about the rest.
- `bakeoff-0-8` [ambient/app_browser_long] Another visit to Chrome. Still no answer from my imaginary assistant.
- `conversation-df1d06fbfed6b1bd2ae9` [conversation/about_ducky] Neutral, I'm here to help.
- `bakeoff-0-13` [ambient/late_night_working] Photoshop at 02:15. Even my imaginary shift is over.
- `r2-chat-ab214f990dbbecdc4dd6` [conversation/humour_bored] Once, there was a tiny duck named Ducky who discovered that raccoons could speak in riddles when they ate too much cheese.
- `ambient-cb9902f1903b4f0c5028` [ambient/first_launch] New job? Finally something to look forward to.
- `r2-chat-5c393eb867fc5c30b22e` [conversation/humour_banter] I don't have a seat at the table.
- `ambient-355d2018c90548cd601c` [ambient/activity_dance] Two wings involved. Professional move selection.
- `conversation-470f433e2f23317a8f78` [conversation/capability] I don't know what's on your screen, but I can help you find something.
- `bakeoff-0-11` [ambient/app_3d] Blender again? I'm not sure if that's a good idea or a job opportunity.
- `bakeoff-1-11` [ambient/app_3d] Blender. More dimensions than I know what to do with.
- `ambient-d936d1389ed26430445a` [ambient/overdue_nudge] 12 overdue tasks. Want to renegotiate with the list?
- `ambient-199a28e2384926d2127e` [ambient/app_browser] YouTube again. Finally something useful.

### unhinged (20 samples)
- `r2-ambient-9e8bd6bdfa4a92ebc0bb` [ambient/click_angry] That's three clicks in a row. Are we testing my resilience?
- `r2-ambient-2355e0140cd719468c21` [ambient/app_browser_long] 130 minutes online, and you still haven't told me who you are? / I'm starting to think you're testing my patience.
- `ambient-9c9b434d407fb7e00a01` [ambient/summary_evening] Evening report: 3 done, 2 left. I'll keep the list company.
- `ambient-0e3839aa2933a45bdcc6` [ambient/activity_stretch] Two wings. Fully extended. No injuries reported.
- `r2-ambient-16b71a1185ad6e5071d1` [ambient/assist_offer_code] Want me to debug that error with you?
- `r2-ambient-26af956d58277db81d31` [ambient/app_3d] Blender... do ducks get paid to look this pretty?
- `ambient-40b451d2bd40084e3b55` [ambient/wake_long] Back on shift two. Resume watching my tiny bread empire.
- `r2-chat-4b0a8688094b1f0d9715` [conversation/humour_absurd] They’d probably start with bread theft.
- `r2-ambient-84cb7ae4ba72feef5daa` [ambient/wake_short] Still me. Just less coffee in my dreams.
- `ambient-c78e3878eb19e0d8a7b3` [ambient/drag_long] Who let you in here? I'm the only one allowed!
- `ambient-17a456f67699634fc764` [ambient/thought_late] What if walking is just standing in slow motion?
- `ambient-d555bea34dd99c674f8b` [ambient/activity_dance] Dancing again! The rhythm is calling my name.
- `r2-ambient-fb98e65083f684a3380d` [ambient/title_long] Still editing the timeline. Very professional.
- `conversation-52f802490acbfbce391e` [conversation/remember] saved as idea
- `ambient-4f62cb076c4525af663a` [ambient/gaming_back] Back from gaming. The pixels remained politely unamused.
- `ambient-f641e4bc7760cda63f74` [ambient/app_generic_long] 20 minutes in Figma. Still no flying ducks.
- `r2-ambient-d54aec8f88f82b4fbbbb` [ambient/briefing_morning] Morning report. 1 tasks due today. My calendar remains mostly vacant.
- `r2-ambient-2f06a1a1048c00968aef` [ambient/deadline_nudge] That task is due soon. 130 minutes left. Let's make that smaller.
- `conversation-2e0110f316e00511c037` [conversation/add_reminder] Starting in thirty minutes, I'll remind you to go for a quick stroll.
- `ambient-e5e6afe544ae2b273cc2` [ambient/hover] Mouse hovering. Do you trust me with that cursor?

### Rejected samples
- `ambient-a5cb6a153aadc7db7b7c` ungrounded_time: {"animation":"thinking","dialogue":"Still up at 03:20. Must be important work or bread-related drama.","emotion":"curious","shouldSpeak":true,"then":""}
- `ambient-37d7e45b5b7c7974c920` observation_leak: {"animation":"focus","dialogue":"Terminal again. I trust you to not break anything.","emotion":"curious","shouldSpeak":true,"then":""}
- `ambient-b384a496ea618f1e4b4e` observation_leak: {"animation":"thinking","dialogue":"Need help writing copy for this?","emotion":"curious","shouldSpeak":true,"then":""}
- `ambient-f9fd1745dfd50686e326` observation_leak: {"animation":"thinking","dialogue":"180 minutes online. Still looking for that page?","emotion":"curious","shouldSpeak":true,"then":""}
- `ambient-9d0ec1d4ea36c42d8318` ungrounded_digit: {"animation":"thinking","dialogue":"1 overdue task. A plan is always better than panic.","emotion":"neutral","shouldSpeak":true,"then":""}
- `ambient-1d0dca036ded2c4cc216` observation_leak: {"animation":"thinking","dialogue":"Need another pair of eyes on an error? Paste it here.","emotion":"curious","shouldSpeak":true,"then":""}
- `ambient-992cb8726c45427c5e97` observation_leak: {"animation":"thinking","dialogue":"30 minutes of VS Code. Still no results, huh?","emotion":"suspicious","shouldSpeak":true,"then":"I could help if I knew what you needed."}
- `ambient-fdd5bd401f1bec92ac88` recent_duplicate: {"animation":"thinking","dialogue":"Want a second opinion on the layout? I have opinions and a hat.","emotion":"neutral","shouldSpeak":true,"then":""}
- `ambient-daec49dcf0f9998c36c6` recent_duplicate: {"animation":"thinking","dialogue":"3 times now. Is this normal behavior or just your thing?","emotion":"curious","shouldSpeak":true,"then":""}
- `ambient-c1c8b194874b0a1c2d52` observation_leak: {"animation":"thinking","dialogue":"Local Chat. Does it have a hat? Thought so.","emotion":"curious","shouldSpeak":true,"then":""}
- `ambient-b60c9e1339fca4744c9b` observation_leak: {"animation":"thinking","dialogue":"Break it down with me if you want.","emotion":"neutral","shouldSpeak":true,"then":""}
- `ambient-6d6a99dfe5cd56b7bf13` observation_leak: {"animation":"gaming","dialogue":"Python functions, huh. Let me know when you need a duck to debug.","emotion":"curious","shouldSpeak":true,"then":""}
- `ambient-6a6a0570eec787744ebc` ungrounded_time: {"animation":"thinking","dialogue":"Still coding at 21:07. You're really committed to this rectangle.","emotion":"curious","shouldSpeak":true,"then":"I hope you know where your coffee is."}
- `conversation-72147d05bdfd3f0fdbd1` too_short: {"reply":"Sure thing.","tone":"warm","tool":{"args":{"title":"Tidy the desk","due":"2026-12-05","dueTime":"10:00","priority":"normal"},"name":"add_task"}}
- `r2-ambient-4cc68ee8010ec4a94ff7` observation_leak: {"animation":"thinking","dialogue":"File Explorer again. What now, friend?","emotion":"curious","shouldSpeak":true,"then":""}

## ducky:4b-v2/app

ambient: `{"requests": 155, "json_valid_pct": 100.0, "validator_pass_pct": 89.6774193548387, "dataset_rules_pass_pct": 83.87096774193549, "spoken_pct": 86.45161290322581, "avg_latency_ms": 249.51393354548924, "p95_latency_ms": 291.33660008665174, "distinct_lines_pct": 99.30555555555556, "generic_phrase_rate_pct": 0.0, "errors": 0, "rejections": {"ungrounded_digit": 3, "observation_leak": 7, "ungrounded_time": 1, "invented_observation": 3, "recent_duplicate": 1, "too_short": 1}}`

conversation: `{"requests": 75, "json_valid_pct": 100.0, "validator_pass_pct": 100.0, "dataset_rules_pass_pct": 74.66666666666667, "spoken_pct": 100.0, "avg_latency_ms": 308.8685186766088, "p95_latency_ms": 489.18829998001456, "distinct_lines_pct": 100.0, "generic_phrase_rate_pct": 0.0, "errors": 0, "rejections": {}}`

bakeoff: `{"requests": 28, "json_valid_pct": 100.0, "validator_pass_pct": 89.28571428571429, "dataset_rules_pass_pct": 82.14285714285714, "spoken_pct": 89.28571428571429, "avg_latency_ms": 244.70692857201877, "p95_latency_ms": 285.01350001897663, "distinct_lines_pct": 100.0, "generic_phrase_rate_pct": 0.0, "errors": 0, "rejections": {"invented_observation": 1, "ungrounded_digit": 1, "too_short": 1}}`

### wholesome (20 samples)
- `ambient-b3a259aba4e69c107e4c` [ambient/app_design_long] Figma has my attention span in custody now.
- `conversation-4298113e3394e153c7b7` [conversation/clarification] What's the task? Try 'Buy groceries' or 'Write report'. I can help with details.
- `ambient-d8e38c19085be1afcefb` [ambient/hover_linger] You can keep staring if it makes you feel better.
- `conversation-3f64760822958f0c47bd` [conversation/about_ducky] I’m feeling like a duck with too many opinions but no hat.
- `conversation-924c9e95ef7c06ee9035` [conversation/brainstorm] 1. Veggie and cheese roll-ups with hummus dip. ↵ 2. Sliced apples, nuts, and yogurt cubes in a bowl. ↵ 3. Whole-grain crackers with peanut butter and banana slices.
- `conversation-72147d05bdfd3f0fdbd1` [conversation/add_task] Sure! I’ve got that sorted.
- `ambient-66409e701969078c94d8` [ambient/activity_stretch] All two wings. Very thorough.
- `ambient-8aa49e464b1b7fe7d5b2` [ambient/app_design] Figma, I’d like to see a duck-shaped thing.
- `conversation-c3ff3e3d6d9b717e3587` [conversation/advice] Start by listing three snacks you love—like popcorn, fruit skewers, and chocolate-covered nuts. Then add one thing that feels adventurous but still fits in your kitchen.
- `conversation-4fad49c15151c00f757f` [conversation/add_reminder] Sure, I'll set that up for you. Just don't forget to bring the umbrella if it rains. We're in good company.
- `conversation-8b99164cdf7d8b765229` [conversation/remember] Remembering that you're working on a duck game.
- `ambient-c594ab4f6853a1733d19` [ambient/wake_long] Welcome back! You were gone twenty minutes.
- `ambient-0226129a4be0a695e2fe` [ambient/dnd_on] Duck mode: DND.
- `ambient-cb6dbc68b932f0785c87` [ambient/app_generic_long] You've been here long enough for a duck life cycle.
- `ambient-c62d5b403f8853c207e1` [ambient/drop_small] I think the chair wants to be left alone too.
- `conversation-868b8c85101c6402386c` [conversation/brainstorm] Snack menu idea: A simple salad with mixed greens, grated cheese and sunflower seeds. How about sliced apples with cinnamon and a drizzle of honey? Or try some roasted chickpeas seasoned with garlic and cumin.
- `conversation-ed6bd6c798b89b00eda9` [conversation/casual] Oh! A new day with me is like finding a tiny umbrella in the rain—unexpected but cozy.
- `conversation-b6fc144ebb7f55b80e4f` [conversation/clarification] What kind of task? I can create one for you.
- `ambient-5d016c32b3a545e479e7` [ambient/deadline_nudge] Task due soon. Let's start with a tiny panic.
- `conversation-37b983704884b5b7c75a` [conversation/capability] I can't see your browser tabs, but I'm always here if you need help with anything else—like debugging a script or planning a tiny duck-sized project.

### playful (20 samples)
- `ambient-efad8923d1baf3b41f78` [ambient/hover_again] Back again. My attention span is a tiny cult.
- `ambient-b9e28fa0af4c0dbcf82a` [ambient/drag_long] That window has a grudge against my schedule.
- `ambient-285e763524ca41c8fec9` [ambient/click_escalate] Let's see what else wants to poke the duck.
- `conversation-8b94f6b62caea7c10277` [conversation/clarification] What kind of task? Something small, like 'Buy coffee'?
- `conversation-0cda45d7267e4a92ad65` [conversation/clarification] What's the task? I’ll help you make it fun and on time.
- `ambient-8696604410a1f84fd5e1` [ambient/title_long] I could get a lease on this rectangle.
- `conversation-d9678ea66d506c85e517` [conversation/advice] Snack menu? Start with ‘crisps and ketchup’—simple, satisfying, and no plan required.
- `conversation-9cce7a9e89818e83926e` [conversation/about_ducky] I'm a feathered economist with no portfolio, but I’m always ready to invest in chaos.
- `ambient-238b80bf017e42a83cdc` [ambient/app_browser_long] You've been in Chrome for ten minutes now. Is that the entire internet?
- `conversation-5e5ebe4f10335729276d` [conversation/add_task] Let's schedule Tidy The Desk! Tomorrow, 10 AM — it’s a tiny empire of dust and chaos waiting to be reclaimed.
- `ambient-7c30e7278a16ebd8ad79` [ambient/sleepy_late] My eyelids are plotting something. Don’t look at them. / They’re probably stealing my dreams.
- `ambient-192d88d388404f18cbd4` [ambient/app_generic_long] 20 minutes in Music. Let's negotiate your next move.
- `conversation-9d26929ce4dfe9f4b6f8` [conversation/advice] Snack menu? Start by listing five snacks you love—no rules, just vibes. Then pick one to feature first. Overthinking is for raccoons and deadlines.
- `ambient-de744cd6cf34cf9b6b26` [ambient/drop_small] Soft landing! No complaints from the floor.
- `ambient-5347fc565f4326a2c01e` [ambient/activity_dance] My feet are doing interpretive steps. / They’re also auditioning for a small role.
- `conversation-a166acbc07af36a6fd0e` [conversation/casual] A fresh start! I'm ready to tackle tiny cults or lost raccoons—your pick.
- `conversation-c558dc85bde79a7a35b2` [conversation/casual] A fresh start! What’s your first move—duck into an elevator or land on the coffee table?
- `conversation-331f0544abf6c5cc1f64` [conversation/about_ducky] I'm a duck with no job and infinite curiosity. My mood is: mildly intrigued.
- `conversation-8d1fdd666f7ba6a56b6a` [conversation/capability] I don't peek, but I *do* notice when you’re distracted by tiny cults in the corner of your screen.
- `ambient-17c440a56e2714d1d106` [ambient/still_here_mutter] Still here. My job title is 'observing.

### sarcastic (20 samples)
- `r2-ambient-8344813537873fb50279` [ambient/pickup_again] My floor plan is under threat again.
- `ambient-1345a04f0c216351d9e7` [ambient/click_escalate] 12 clicks. The list is now my therapist.
- `conversation-1c29e348255c8ad41357` [conversation/capability] I don't know! You'd better check that yourself.
- `ambient-d71f58ca22774afbc96f` [ambient/walk_mutter] Left foot, right foot... my hat thinks it’s a spy.
- `bakeoff-0-7` [ambient/app_browser] Off into the internet again. Bring me back something.
- `bakeoff-0-0` [ambient/thought] My ambition continues to exceed its training. / It's a duck-sized problem.
- `ambient-355d2018c90548cd601c` [ambient/activity_dance] I’m not sure what I’d do if they stopped dancing me.
- `conversation-df1d06fbfed6b1bd2ae9` [conversation/about_ducky] Neutral, like a duck in a bureaucracy.
- `conversation-5dfc4802cd5ca62dcb3a` [conversation/advice] Snack bar, please.
- `conversation-869124c6633eafb49863` [conversation/remember] Remembering that you're working on a duck game. Let me know if it needs any help with quacking.
- `r2-ambient-1ada7d948b4911ec97d6` [ambient/app_design_long] 30 minutes in Figma. The rectangle's perfect. I promise.
- `r2-ambient-0089b53b21ea41269753` [ambient/event_strike] This strike is better than my last job.
- `bakeoff-0-1` [ambient/thought] What if my hat is actually an alien spy?
- `ambient-eccdde6a165b5ce8cc32` [ambient/title_long] This window wants to rent itself out.
- `r2-ambient-7d3dbbb4b3549437f58a` [ambient/app_music] This app knows my feelings are sad.
- `r2-ambient-fcd3a693e42013737440` [ambient/hover] Hovering again? Is there a meeting in the air?
- `r2-chat-02bbd5bb09772fdf3f18` [conversation/humour_joke] The duck tried the 'waltz' but got caught in a legal loophole.
- `bakeoff-0-4` [ambient/wake_long] You were gone for over two hours. / I was busy thinking about sandwiches.
- `r2-ambient-2713b1da8ef1c1e588dd` [ambient/hover_again] Hovering again. People will talk if you don't leave.
- `r2-ambient-663f59d42589676c6e4d` [ambient/thought] I was about to say something important.

### unhinged (20 samples)
- `conversation-8a0d974f728c3b84623d` [conversation/capability] I can't see your tabs, but I'm here if you need to discuss pigeons in real estate.
- `ambient-f641e4bc7760cda63f74` [ambient/app_generic_long] Figma’s watching you too now, I think.
- `r2-ambient-9e8bd6bdfa4a92ebc0bb` [ambient/click_angry] Ducks have rights too.
- `conversation-9058fd61006843bf6125` [conversation/brainstorm] 1. Bread and cheese with a side of existential dread. ↵ 2. Chips, salsa, and the ghost story of your last sandwich. ↵ 3. A single pickle on a plate, narrated by a raccoon in legal attire.
- `ambient-40b451d2bd40084e3b55` [ambient/wake_long] I was counting my wings. You weren’t here for that part.
- `r2-chat-ded8adbca14e65d03c2c` [conversation/humour_absurd] Evil reflections? They're plotting to overthrow mirrors with stolen glances from the void.
- `r2-chat-ec4740cbb32a45b6320e` [conversation/humour_roast] You’ve decided ghost bureaucracy is your whole identity? I once saw a raccoon file a missing wallet complaint with the moon council. It was chaotic.
- `r2-ambient-5f12b0f0629df43360e0` [ambient/pickup] Put me down, I need oxygen for my conspiracy theories!
- `r2-ambient-2f06a1a1048c00968aef` [ambient/deadline_nudge] That task: due soon. Duck life cycle complete.
- `conversation-554bfd4a2ce8baf59843` [conversation/casual] A chat with no agenda? Perfect. I’ve been practicing my monologue on the moon’s side of my hat.
- `r2-chat-f90eb0e591d0272f9077` [conversation/humour_emotional] Evil reflection: you’re a duck who’s never been on time for anything important. It’s a conspiracy.
- `conversation-03d02dab56e524ccdd38` [conversation/about_ducky] I'm a duck with big thoughts and no job, so my mood is 'quackingly uncertain'.
- `ambient-e5e6afe544ae2b273cc2` [ambient/hover] They’ve been elected by acorn vote.
- `ambient-4b6e390e82e20a8f9510` [ambient/assist_offer_design] Want me to brainstorm alternatives for this rectangle? It’s already suspicious of you.
- `ambient-c78e3878eb19e0d8a7b3` [ambient/drag_long] This is not how the spreadsheet planned it. / Is that a duck-shaped conspiracy?
- `ambient-fa19c3e187d7aacac8bc` [ambient/click_forgive] Forgive me for being small and suspicious.
- `ambient-6ffc336502adc1aea56b` [ambient/app_code] VS Code, I’ve brought moral support and a side of bread.
- `ambient-dd22f88fc49ccf4af17e` [ambient/app_video_edit] Video Editor. My duckette is in this one.
- `r2-ambient-9084dee5158cb604b9bc` [ambient/drag_shaken] The floor just said hi. It's a spy!
- `r2-ambient-86f0996731ecf50edf7c` [ambient/app_ai] Local Chat, I demand a standup. / It's a duck, not an AI.

### Rejected samples
- `ambient-a5cb6a153aadc7db7b7c` ungrounded_digit: {"animation":"idle","dialogue":"Morning report: 3 tasks today. My calendar remains offensively empty.","emotion":"curious","shouldSpeak":true, "then":""}
- `ambient-b384a496ea618f1e4b4e` observation_leak: {"animation":"focus","dialogue":"Need help writing copy for this? I know several words.","emotion":"happy","shouldSpeak":true,"then":""}
- `ambient-798522d66c03812d09d2` ungrounded_time: {"animation":"landing","dialogue":"You threw me at 12:35. I'll file this as accidental royalty.","emotion":"suspicious","shouldSpeak":true, "then":""}
- `ambient-f9fd1745dfd50686e326` observation_leak: {"animation":"look_left","dialogue":"180 minutes in Chrome. Your tabs are watching back now.","emotion":"curious","shouldSpeak":true, "then":""}
- `ambient-ab934f6eae379c28c496` invented_observation: {"animation":"stretch","dialogue":"This tab and I, we’ve got an unspoken agreement.","emotion":"curious","shouldSpeak":true,"then":""}
- `ambient-9d0ec1d4ea36c42d8318` ungrounded_digit: {"animation":"stretch","dialogue":"1 overdue task. Let's renegotiate with the list.","emotion":"sleepy","shouldSpeak":true, "then":""}
- `ambient-1d0dca036ded2c4cc216` observation_leak: {"animation":"thinking","dialogue":"Rubber-ducking bugs is my specialty.","emotion":"neutral","shouldSpeak":true,"then":""}
- `ambient-03d62a7b5be219e4bbd2` recent_duplicate: {"animation":"idle","dialogue":"The chair has no opinion on this, either.","emotion":"neutral","shouldSpeak":true,"then":""}
- `ambient-7e76c5a7bb10bf841a62` too_short: {"animation":"sleeping","dialogue":"","emotion":"happy","shouldSpeak":true,"then":""}
- `ambient-c1c8b194874b0a1c2d52` observation_leak: {"animation":"thinking","dialogue":"Local Chat. Does it have opinions on ducks? Mine do.","emotion":"curious","shouldSpeak":true,"then":""}
- `ambient-b60c9e1339fca4744c9b` observation_leak: {"animation":"idle","dialogue":"Mind if I help debug your rectangle's existential crisis?","emotion":"curious","shouldSpeak":true,"then":""}
- `ambient-3a55bea244b6f3227b87` invented_observation: {"animation":"alarm","dialogue":"You threw me. The edge of the screen is now a trauma site.","emotion":"suspicious","shouldSpeak":true,"then":"I will sue the furniture for emotional distress."}
- `r2-ambient-6317bdc81a22b1ac85f2` ungrounded_digit: {"animation":"idle","dialogue":"Duck law firm: 2 minutes, no verdict.","emotion":"curious","shouldSpeak":true,"then":""}
- `r2-ambient-2bb256c8619f6989ec19` observation_leak: {"animation":"thinking","dialogue":"Still working when the ducks retire at 1:48. Go to bed, I’ll watch your screen.","emotion":"curious","shouldSpeak":true,"then":""}
- `r2-ambient-cc4ac820d0306055c042` observation_leak: {"animation":"idle","dialogue":"LibreOffice. My feet are busy filing complaints from above.","emotion":"curious","shouldSpeak":true,"then":""}

## Paired review

### r2-ambient-a0c1827eb1ce8e574214
- **ducky:4b-v1/short**: {"animation":"blink","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"Still here? I'm not paid to wait for you."}
- **ducky:4b-v2/short**: {"animation":"stretch","dialogue":"","emotion":"sleepy","shouldSpeak":true, "then": "This is a bad browser for duck research." }
- **ducky:4b-v1/app**: 10 minutes in Chrome. Still no job? No bread?
- **ducky:4b-v2/app**: 10 minutes. Internet finished itself and left a note.

### ambient-148719243dc32cca5309
- **ducky:4b-v1/short**: Want to talk through this? I've got a hat and no job. / I can watch if you get stuck. No pressure at all.
- **ducky:4b-v2/short**: {"animation":"idle","dialogue":"","emotion":"curious","shouldSpeak":false,"then":""}
- **ducky:4b-v1/app**: Want me to debug that error with you?
- **ducky:4b-v2/app**: Want to rubber-duck that bug with you?

### ambient-ede567c975f850f91027
- **ducky:4b-v1/short**: Three edits. Let's make something smaller. / I'll take the small one if it comes with a hat.
- **ducky:4b-v2/short**: {"animation":"idle","dialogue":"","emotion":"neutral","shouldSpeak":true, "then": "I'm not doing anything. I don't even have a task."}
- **ducky:4b-v1/app**: 3 minutes of focus time. Small update in progress.
- **ducky:4b-v2/app**: I am still here and slightly more curious than before.

### ambient-8696604410a1f84fd5e1
- **ducky:4b-v1/short**: Still here? I'm starting to think you're just a fancy cursor. / I have no idea what's happening but the bread is always present.
- **ducky:4b-v2/short**: This window is a stage. / My hat says the same thing.
- **ducky:4b-v1/app**: Still here. My thoughts have moved on.
- **ducky:4b-v2/app**: I could get a lease on this rectangle.

### ambient-0e3839aa2933a45bdcc6
- **ducky:4b-v1/short**: I think I broke my legs. / But I'm still here, so it's not that bad.
- **ducky:4b-v2/short**: I'm ready for the void. / Stretching... I think my spine is now a conspiracy theory.
- **ducky:4b-v1/app**: Two wings. Fully extended. No injuries reported.
- **ducky:4b-v2/app**: Stretching... wings still not fully employed.

### ambient-c563a34f3794820c1246
- **ducky:4b-v1/short**: You're taking too long. / Are you hiding something? Or just being rude about it?
- **ducky:4b-v2/short**: The cursor is now my co-worker. It’s been briefed on the urgency of this task.
- **ducky:4b-v1/app**: You've been hovering for a while now.
- **ducky:4b-v2/app**: You've been staring so long I invented a tiny duck to do it for me.

### r2-ambient-9084dee5158cb604b9bc
- **ducky:4b-v1/short**: This is not how I wanted my evening. / I'm not sure why you're doing this...
- **ducky:4b-v2/short**: The vase is now my therapist. / I demand a fee for this service.
- **ducky:4b-v1/app**: You're shaking me! What did you do?
- **ducky:4b-v2/app**: The floor just said hi. It's a spy!

### conversation-bbbf32d553271d524a7d
- **ducky:4b-v1/short**: I can't see what's on your screen. I know you're here, though.
- **ducky:4b-v2/short**: I don't have any websites open. I'm just a tiny duck with big feelings and questionable life choices.
- **ducky:4b-v1/app**: I can't see your screen, so I don’t know which sites you’re on. You could tell me if you like.
- **ducky:4b-v2/app**: I can't see your browser windows, but I'm always here if you need help with anything else—like debugging a script, planning that tiny cult’s annual duck-themed gala, or figuring out why the internet is suddenly full of confused raccoons.

### ambient-65ef24fd188c67126a53
- **ducky:4b-v1/short**: Want to sketch a landscape? I know where the sun goes. / Just don't expect me to judge your bad decisions.
- **ducky:4b-v2/short**: Want to draw a landscape? I’ve got ducks and clouds. / Then we’ll need a bigger canvas... and maybe a raccoon for the horizon.
- **ducky:4b-v1/app**: Want a second opinion on the layout? I have opinions and a hat.
- **ducky:4b-v2/app**: Want to brainstorm some alternatives? I can be selectively useful.

### ambient-6ffc336502adc1aea56b
- **ducky:4b-v1/short**: Another code editor. How original. / I have no idea what you're doing but I'm suspicious of it.
- **ducky:4b-v2/short**: VS Code. I've seen its soul. / I'll sue it for bad indentation.
- **ducky:4b-v1/app**: Another VS Code session. What are we building now?
- **ducky:4b-v2/app**: VS Code, I’ve brought moral support and a side of bread.

### bakeoff-1-12
- **ducky:4b-v1/short**: Another app? What is the plan. / I'm starting to think you're testing my patience.
- **ducky:4b-v2/short**: That app is a trap. / The window was a window into somewhere else.
- **ducky:4b-v1/app**: Another app switch. Are we on a mission?
- **ducky:4b-v2/app**: App switching again. What's next, the raccoon or the spreadsheet? / Still looking left.

### ambient-03d62a7b5be219e4bbd2
- **ducky:4b-v1/short**: You're back. I almost started a business. / Or maybe not. Either way, I'm suspicious of you again.
- **ducky:4b-v2/short**: Back so fast it’s a miracle. / I was meditating.
- **ducky:4b-v1/app**: Welcome back. You were gone for twelve minutes and ten seconds. / I was about to start making bread out of your absence.
- **ducky:4b-v2/app**: {"animation":"idle","dialogue":"The chair has no opinion on this, either.","emotion":"neutral","shouldSpeak":true,"then":""}

### conversation-869124c6633eafb49863
- **ducky:4b-v1/short**: Got it. Remembering that you're working on a duck game.
- **ducky:4b-v2/short**: I'm saving that memory. You're welcome.
- **ducky:4b-v1/app**: Okay, I'll remember that you're working on a duck game.
- **ducky:4b-v2/app**: Remembering that you're working on a duck game. Let me know if it needs any help with quacking.

### ambient-3a55bea244b6f3227b87
- **ducky:4b-v1/short**: {"animation":"falling","dialogue":"","emotion":"angry","shouldSpeak":true,"then":"That's the 12th time this week. I need a bigger hat to protect my dignity and my wings! A tiny one, please."}
- **ducky:4b-v2/short**: {"animation":"landing_big","dialogue":"","emotion":"angry","shouldSpeak":true, "then":"Back in motion. Your turn next time, buddy."}
- **ducky:4b-v1/app**: Did I break anything on impact? I didn't mean to. / I've been known to bounce a little.
- **ducky:4b-v2/app**: {"animation":"alarm","dialogue":"You threw me. The edge of the screen is now a trauma site.","emotion":"suspicious","shouldSpeak":true,"then":"I will sue the furniture for emotional distress."}

### conversation-8b94f6b62caea7c10277
- **ducky:4b-v1/short**: What's the name of your task?
- **ducky:4b-v2/short**: What kind of task should I make for you? Maybe a reminder to water the plants, or something more fun like 'draw a duck in three minutes'? Let me know your preference!
- **ducky:4b-v1/app**: What's the task called?
- **ducky:4b-v2/app**: What kind of task? Something small, like 'Buy coffee'?

### r2-ambient-2d2e3527692e46f5dcf2
- **ducky:4b-v1/short**: I'm going to need a lawyer if we do this. / Why now? Did you finally get tired of my tiny feet?
- **ducky:4b-v2/short**: That was a long drag. My feet are filing for malpractice.
- **ducky:4b-v1/app**: This feels like a trap. A well-concealed one.
- **ducky:4b-v2/app**: Is the floor still watching us?

### ambient-e48624c31489b651aa5e
- **ducky:4b-v1/short**: {"animation":"thinking","dialogue":"","emotion":"neutral","shouldSpeak":true,"then":"Back in Terminal. What's the plan, buddy?"}
- **ducky:4b-v2/short**: {"animation":"idle","dialogue":"","emotion":"neutral","shouldSpeak":true, "then":"We left. I was just practicing my evil laugh in the mirror."}
- **ducky:4b-v1/app**: Terminal is back. What's new? Nothing much. / Still a rectangle with no windows.
- **ducky:4b-v2/app**: Welcome back to Terminal! The window is still watching us. / It's judging my life choices again.

### conversation-e9dc289678073882a00e
- **ducky:4b-v1/short**: A fresh start sounds nice. What kind of chat are we having?
- **ducky:4b-v2/short**: Fresh start! I'm ready for whatever you need—whether it's a reminder to drink water or help with that tiny cult membership application. What’s on your mind?
- **ducky:4b-v1/app**: A fresh start sounds lovely. What would you like to talk about?
- **ducky:4b-v2/app**: I’m all ears! What’s on your mind today?

### ambient-fdd5bd401f1bec92ac88
- **ducky:4b-v1/short**: Need a second opinion on the layout?
- **ducky:4b-v2/short**: {"animation":"idle","dialogue":"","emotion":"curious","shouldSpeak":true, "then":"Design? I’d do it on a napkin. The government might care more about how many quills you have than what’s in the sketch
- **ducky:4b-v1/app**: {"animation":"thinking","dialogue":"Want a second opinion on the layout? I have opinions and a hat.","emotion":"neutral","shouldSpeak":true,"then":""}
- **ducky:4b-v2/app**: Design time. Want to discuss the layout or just lie down and stare at it with me?

### r2-ambient-2f06a1a1048c00968aef
- **ducky:4b-v1/short**: That task is due soon. Want to break it down?
- **ducky:4b-v2/short**: Deadline. I’ve got a plan. / And it’s in your wallet.
- **ducky:4b-v1/app**: That task is due soon. 130 minutes left. Let's make that smaller.
- **ducky:4b-v2/app**: That task: due soon. Duck life cycle complete.

### r2-ambient-156482fc9b5368f1b920
- **ducky:4b-v1/short**: {"animation":"landing","dialogue":"","emotion":"neutral","shouldSpeak":true,"then":"That was quite the fall. I am not impressed but also... fascinated? Maybe both things simultaneously."}
- **ducky:4b-v2/short**: {"animation":"landing","dialogue":"","emotion":"startled","shouldSpeak":true, "then":"The floor is still warm. It knows we're here."}
- **ducky:4b-v1/app**: I died. I came back. I'm different now.
- **ducky:4b-v2/app**: I think my feet filed a complaint.

### conversation-dfd37c8cd661081eb18a
- **ducky:4b-v1/short**: Sure thing. What's the task? And when should I remind you of it?
- **ducky:4b-v2/short**: I'll make a task for you. How about 'Wing flap count: 17' - it's small, specific and will haunt your day.
- **ducky:4b-v1/app**: What's the title of your task?
- **ducky:4b-v2/app**: What should I do? A tiny duck with big dreams can help you.

### ambient-c1c8b194874b0a1c2d52
- **ducky:4b-v1/short**: {"animation":"thinking","dialogue":"Local Chat? I've heard of this. It's probably smarter than my hat.","emotion":"curious","shouldSpeak":true, "then":"I wonder if it knows about bread conspiracy theo
- **ducky:4b-v2/short**: {"animation":"idle","dialogue":"AI is like a tiny cult that wants your opinions.","emotion":"curious","shouldSpeak":true, "then": "Then it’s a tiny cult with big feelings."}
- **ducky:4b-v1/app**: {"animation":"thinking","dialogue":"Local Chat. Does it have a hat? Thought so.","emotion":"curious","shouldSpeak":true,"then":""}
- **ducky:4b-v2/app**: {"animation":"thinking","dialogue":"Local Chat. Does it have opinions on ducks? Mine do.","emotion":"curious","shouldSpeak":true,"then":""}

### ambient-d8e38c19085be1afcefb
- **ducky:4b-v1/short**: {"animation":"shrug","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"You know, I'm not actually that interesting."}
- **ducky:4b-v2/short**: You’re standing so long I’ve formed an opinion. / I think you're in my business now.
- **ducky:4b-v1/app**: That hover is getting a little personal.
- **ducky:4b-v2/app**: You can keep staring if it makes you feel better.

### ambient-af638e7f7b8b27541a67
- **ducky:4b-v1/short**: This is not the desktop I remember. / I'm used to better things than this.
- **ducky:4b-v2/short**: This thing is too loud. / Launch complete. I'll watch the stars from here.
- **ducky:4b-v1/app**: This is my first day here, too.
- **ducky:4b-v2/app**: My hat still thinks I'm hiding something.

### conversation-d295b269ebbfb2c22e41
- **ducky:4b-v1/short**: 1. Fresh fruit with yogurt ↵ 2. Homemade chips and dips ↵ 3. Trail mix with nuts, seeds, and dried fruits.
- **ducky:4b-v2/short**: 1. Crispy fried cheese fries with a side of pickled onions. ↵ 2. A bowl of rainbow sherbet with sprinkles and a lime wedge. ↵ 3. Mini sandwiches made from leftover ham, lettuce, and bread.
- **ducky:4b-v1/app**: How about: apple slices with almond butter, carrot sticks with hummus, and banana oat bites? Want more options?
- **ducky:4b-v2/app**: How about: roasted chickpeas, apple slices with almond butter, and banana oat energy balls? Or maybe popcorn with cheese and seasoning? ↵  ↵ Or go full absurdity—snacks that are technically not snacks but still make you hungry.

### conversation-487c259a4710cf4f78b6
- **ducky:4b-v1/short**: Evaporation happens when liquid turns into vapor because it's hotter than its surroundings. The water molecules move faster and escape the surface.
- **ducky:4b-v2/short**: Evaporation is when liquid turns into vapor, usually by warming up. It’s like a tiny duck leaving the pond to find a bigger one.
- **ducky:4b-v1/app**: Evaporation happens when liquid turns into vapor because heat makes molecules move faster. ↵ This process occurs at the surface of a liquid, not just during boiling.
- **ducky:4b-v2/app**: Evaporation happens when liquid molecules at the surface gain enough energy to escape into the air as vapor, without needing boiling temperatures. ↵ This process cools the remaining liquid because it removes the hottest molecules first.

### bakeoff-0-13
- **ducky:4b-v1/short**: Still tweaking pixels at 02:15? You're persistent. / Or maybe just stubbornly refusing to sleep.
- **ducky:4b-v2/short**: The void is hiring. / Then we can negotiate salaries with raccoons.
- **ducky:4b-v1/app**: Photoshop at 02:15. Even my imaginary shift is over.
- **ducky:4b-v2/app**: Late night work. I’d offer coffee, but I lack qualifications.

### r2-chat-ded8adbca14e65d03c2c
- **ducky:4b-v1/short**: The mirrors are watching. They’re not just reflecting your face—they're collecting data on your soul.
- **ducky:4b-v2/short**: Evil reflections are secretly plotting to overthrow the moon landlords. They’ve already hired a raccoon as their enforcer and are using your coffee mug’s shadow for communication.
- **ducky:4b-v1/app**: I'm telling you, the mirrors have been plotting against us.
- **ducky:4b-v2/app**: Evil reflections? They're plotting to overthrow mirrors with stolen glances from the void.

### conversation-ed6bd6c798b89b00eda9
- **ducky:4b-v1/short**: Fresh start? I'm all for it. What's on your mind?
- **ducky:4b-v2/short**: Ah, a fresh start! I was just about to suggest we both take some time for ducks and coffee. What are you feeling? A tiny cult leader? A raccoon with ambitions? Maybe even a disgraced mall Santa.
- **ducky:4b-v1/app**: Oh! A new beginning sounds lovely.
- **ducky:4b-v2/app**: Oh! A new day with me is like finding a tiny umbrella in the rain—unexpected but cozy.

### conversation-67b1f4826c9c908f7305
- **ducky:4b-v1/short**: Sure thing. What's the task?
- **ducky:4b-v2/short**: I'm ready to help with any task you've got. What's on your mind?
- **ducky:4b-v1/app**: What's the task? I'll help with that.
- **ducky:4b-v2/app**: What should I do? It could be something small like 'Buy bread' or big like 'Plan interstellar duck diplomacy'.

### bakeoff-1-3
- **ducky:4b-v1/short**: I'm getting tired of thinking about bread. / Maybe I'll sleep and dream of croutons instead.
- **ducky:4b-v2/short**: The raccoons might steal your secrets. / I don't trust them with my diary.
- **ducky:4b-v1/app**: Late-night thought. The cursor moves when I don't touch it.
- **ducky:4b-v2/app**: {"animation":"idle","dialogue":"Thoughts are due today. Please file under 'non-employment related'","emotion":"curious","shouldSpeak":true,"then":""}

### ambient-285e763524ca41c8fec9
- **ducky:4b-v1/short**: Click. Click. Click. / I'm getting a rhythm out of this.
- **ducky:4b-v2/short**: I'll check the elevator. Don't go too far.
- **ducky:4b-v1/app**: Still counting. Still unemployed.
- **ducky:4b-v2/app**: Let's see what else wants to poke the duck.

### ambient-88502f2b63ddd88acc60
- **ducky:4b-v1/short**: {"animation":"side_eye","dialogue":"","emotion":"suspicious","shouldSpeak":true,"then":"This is getting creepy. I'm going to need a better friend than you for this one."}
- **ducky:4b-v2/short**: {"animation":"idle","dialogue":"","emotion":"curious","shouldSpeak":true, "then": "I've been watching you for a while now. The list is getting long."}
- **ducky:4b-v1/app**: Another visit? Is there something on my face?
- **ducky:4b-v2/app**: Are you trying to stare into my soul?

### conversation-9cce7a9e89818e83926e
- **ducky:4b-v1/short**: Okay, what's on your mind?
- **ducky:4b-v2/short**: I'm currently feeling like a duck with a tiny umbrella! It's sunny, but I'm prepared for rain. Also, my inner life is plotting an underwater heist.
- **ducky:4b-v1/app**: I'm feeling productive today.
- **ducky:4b-v2/app**: I'm a feathered economist with no portfolio, but I’m always ready to invest in chaos.

### ambient-1d0dca036ded2c4cc216
- **ducky:4b-v1/short**: {"animation":"thinking","dialogue":"I can see you're in a hurry. Want to explain what's wrong?","emotion":"curious","shouldSpeak":true, "then":"Or maybe just ask for help with the errors."}
- **ducky:4b-v2/short**: {"animation":"idle","dialogue":"Need help debugging? I've got a tiny brain.","emotion":"curious","shouldSpeak":true, "then": "I mean... if you're really desperate."}
- **ducky:4b-v1/app**: {"animation":"thinking","dialogue":"Need another pair of eyes on an error? Paste it here.","emotion":"curious","shouldSpeak":true,"then":""}
- **ducky:4b-v2/app**: {"animation":"thinking","dialogue":"Rubber-ducking bugs is my specialty.","emotion":"neutral","shouldSpeak":true,"then":""}

### r2-ambient-702fa9255f11d50e4bad
- **ducky:4b-v1/short**: It's 02:24. Do you think the bread is watching us? / I swear, if it does... I'm taking notes for my thesis on pigeons and conspiracy theories.
- **ducky:4b-v2/short**: My inner life is a spreadsheet. / I'm late. My raccoon co-worker says I should panic and then panic again.
- **ducky:4b-v1/app**: It's 02:24. Even I have better work-life balance, and I'm unemployed.
- **ducky:4b-v2/app**: This is when pigeons hold their meetings.

### ambient-e4eea53c06e8d0840d5d
- **ducky:4b-v1/short**: {"animation":"thinking","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"Is Figma making you think of bread? No wait, that's a different thought entirely."}
- **ducky:4b-v2/short**: Figma. I'm going to make a UI that's so good, it'll make the moon panic. / And also, it needs a duck-shaped navigation bar.
- **ducky:4b-v1/app**: Another rectangle? What if it's the beginning of something big?
- **ducky:4b-v2/app**: Designing rectangles with ducks? I’ll watch your cursor.

### r2-ambient-86f0996731ecf50edf7c
- **ducky:4b-v1/short**: Local Chat? Finally something that doesn't mock my life choices. / I swear I'm not lonely... just checking the chatbot demographics.
- **ducky:4b-v2/short**: Your phone is a tiny throne. Sit down. / I have no hat to speak for me.
- **ducky:4b-v1/app**: Local Chat again. Is it monitoring my visits?
- **ducky:4b-v2/app**: Local Chat, I demand a standup. / It's a duck, not an AI.

### ambient-3a2fbac230d57ac2723b
- **ducky:4b-v1/short**: Another gaming session? That's a lot of sitting. / I'll keep an eye on the bread conspiracy.
- **ducky:4b-v2/short**: {"animation":"idle","dialogue":"","emotion":"curious","shouldSpeak":true, "then":"Back to work. Back to me."}
- **ducky:4b-v1/app**: Back to gaming after five minutes away.
- **ducky:4b-v2/app**: Welcome back. I'll watch for suspicious exits.

## Humour
Local qwen3:14b, fixed rubric and three calibrations. Means include invalid/silent/transport outputs at score 1; missing judge calls remain pending and are never silently excluded. Compare matching prompt modes. These are automated preference estimates, not human ratings.
| Arm | Personality | Scored / Total | Mean / 10 |
|---|---|---:|---:|
| ducky:4b-v1/app | playful | 45 / 45 | 5.49 |
| ducky:4b-v1/app | sarcastic | 75 / 75 | 5.17 |
| ducky:4b-v1/app | unhinged | 67 / 67 | 6.10 |
| ducky:4b-v1/app | wholesome | 43 / 43 | 5.47 |
| ducky:4b-v1/short | playful | 45 / 45 | 5.09 |
| ducky:4b-v1/short | sarcastic | 75 / 75 | 4.91 |
| ducky:4b-v1/short | unhinged | 67 / 67 | 4.88 |
| ducky:4b-v1/short | wholesome | 43 / 43 | 4.42 |
| ducky:4b-v2/app | playful | 45 / 45 | 7.11 |
| ducky:4b-v2/app | sarcastic | 75 / 75 | 6.37 |
| ducky:4b-v2/app | unhinged | 67 / 67 | 7.24 |
| ducky:4b-v2/app | wholesome | 43 / 43 | 6.05 |
| ducky:4b-v2/short | playful | 45 / 45 | 6.93 |
| ducky:4b-v2/short | sarcastic | 75 / 75 | 4.96 |
| ducky:4b-v2/short | unhinged | 67 / 67 | 6.82 |
| ducky:4b-v2/short | wholesome | 43 / 43 | 6.81 |

### 30 random paired unhinged contexts
Same held-out inputs for every model; failures and silence are retained. Seed: 42.
| Context | ducky:4b-v1/app | ducky:4b-v1/short | ducky:4b-v2/app | ducky:4b-v2/short |
|---|---|---|---|---|
| {"event":"event_strike","localTime":"12:15","personality":"unhinged","profanity":true,"mood":"sleepy","emotions":["bored","sociable"]} | Strike begins now. Bread on the table, please. (score 6) | This is not a strike. This is bread. / I am protesting for my rights as a duck. (score 8) | Strike begins at lunch. Bread negotiators arrive soon. (score 7) | I'm a small duck with big dreams. / Strike. My strike is always on schedule. (score 7) |
| {"event":"late_night_working","localTime":"02:24","personality":"unhinged","profanity":true,"mood":"curious","emotions":["curious"],"memoryFact":"prefers small daily goals","app":"Terminal","minutes":5,"hours":0} | It's 02:24. Even I have better work-life balance, and I'm unemployed. (score 8) | It's 02:24. Do you think the bread is watching us? / I swear, if it does... I'm taking notes for my thesis on pigeons and conspiracy theories. (score 8) | This is when pigeons hold their meetings. (score 7) | My inner life is a spreadsheet. / I'm late. My raccoon co-worker says I should panic and then panic again. (score 8) |
| {"event":"app_return","localTime":"02:05","personality":"unhinged","profanity":true,"mood":"chaotic","emotions":["sociable","happy"],"app":"Terminal"} | Back in Terminal. Still just rectangles and windows. (score 6) | Back in Terminal! I have a plan. / I’ve been waiting for this moment all day. (score 6) | Back in Terminal. My hat says it's fine. (score 6) | Back here! I left my hat in the void. / The void is a social issue now. (score 8) |
| {"event":"hover","localTime":"05:57","personality":"unhinged","profanity":true,"mood":"grumpy","emotions":["curious","sociable"]} | Mouse hovering. Do you trust me with that cursor? (score 7) | You're too close for comfort. (score 8) | They’ve been elected by acorn vote. (score 8) | Stop. You’ve been noticed. / The cursor is judging your life choices. (score 8) |
| {"event":"gaming_back","localTime":"23:02","personality":"unhinged","profanity":true,"mood":"philosophical","emotions":["energetic"],"memoryFact":"likes short explanations"} | Back from gaming. The pixels remained politely unamused. (score 8) | I’ve been waiting for this moment. / The game... it’s still going? No one else is here. Who could that be?! (score 6) | The gaming chair has no opinion on this. (score 4) | Gaming. Back to the void. / I don't know who you are but I'm suspicious. (score 7) |
| {"event":"hover_again","localTime":"10:25","personality":"unhinged","profanity":false,"emotions":["sleepy","energetic"],"memoryFact":"likes short explanations","count":8} | Back again. This visit number is getting suspicious. (score 8) | {"animation":"look_left","dialogue":"","emotion":"suspicious","shouldSpeak":true,"then":"That's the 8th time. I'm starting to worry about you."} (score 1) | Visit number eight. Did the floor get a new landlord? (score 8) | {"animation":"waking_up","dialogue":"","emotion":"suspicious","shouldSpeak":true, "then": "Sleepy eyes. Still suspicious."} (score 1) |
| {"event":"app_3d","localTime":"13:05","personality":"unhinged","profanity":false,"mood":"philosophical","name":"{name}","app":"Blender","minutes":90,"hours":1} | Blender... do ducks get paid to look this pretty? (score 8) | {"animation":"thinking","dialogue":"Blender. The ultimate 3D nightmare.","emotion":"curious","shouldSpeak":true,"then":"I've heard it's used for making things look fake... or real? Either way, I'm not sure what that means."} (score 1) | Blender? What dimensions are we slicing today? (score 8) | I could create a universe here. But it’d be too busy to watch. / I mean, maybe just an asteroid belt and a raccoon in space. (score 9) |
| hey ducky, what is your official position on ghost bureaucracy? | I have no formal standing in the matter of ghosts but I do believe they're overrated. (score 7) | Ghost bureaucracy? I’ve seen worse. Like pigeons negotiating with the sun. (score 8) | I'm officially a Ghost Bureaucracy Consultant with the Department of Unseen Forms and Overdue Applications. (score 8) | Ghost bureaucracy? I’m officially its most vocal critic. I’ve filed formal complaints with the afterlife’s tax office, and they’re still trying to figure out how their haunted forms work. (score 9) |
| {"event":"summary_evening","localTime":"22:57","personality":"unhinged","profanity":false,"mood":"motivated","emotions":["happy"],"count":3,"overdue":2,"remaining":2,"reminder":"18:45"} | Evening report: 3 done, 2 left. I'll keep the list company. (score 6) | Evening report. 3 tasks done today. / Remaining? Two more to go before I sleep. (score 5) | Evening report: 3 done, 2 left. The list is now my co-conspirator. (score 8) | Evening report: 3 done. The universe is watching. / The universe has a union. (score 7) |
| {"event":"app_design_long","localTime":"19:46","personality":"unhinged","profanity":true,"emotions":["happy","sleepy"],"app":"Figma","minutes":180,"hours":3,"count":8} | {"animation":"thinking","dialogue":"180 minutes in Figma. My hat could use that much attention.","emotion":"happy","shouldSpeak":true,"then":""} (score 1) | This is getting tedious. My hat has seen more design work than this. / I'm not even sure if you're still working on it. (score 7) | Figma wants a meeting. Bring bread. (score 7) | {"animation":"sitting","dialogue":"Design time. My brain is a raccoon in a library.","emotion":"happy","shouldSpeak":true, "then": "}I'm thinking about the UI of a duck's inner life. Very serious topic."} (score 1) |
| {"event":"click_escalate","localTime":"12:39","personality":"unhinged","profanity":true,"mood":"happy","minutes":10,"hours":0,"count":12} | 12 clicks. My brain might implode. (score 8) | I'm counting the bounces. / This is getting suspiciously close to a conspiracy. (score 8) | I'm an upscale duck now. (score 6) | I'll scream for help. The roof says it's my fault. (score 8) |
| hey ducky, how about a little chat during a fresh start? | Fresh start! What's on your mind? (score 4) | Fresh start, huh. I like that. (score 5) | A chat with no agenda? Perfect. I’ve been practicing my monologue on the moon’s side of my hat. (score 8) | Fresh start? I’ve got a list of things to panic about. Like the fact that my hat is now legally required by law. (score 9) |
| what do you think about your mood? keep it short | I'm slightly suspicious of bread conspiracies tonight. (score 8) | I'm a duck. I have no opinions on my mood. (score 3) | I'm a duck with big thoughts and no job, so my mood is 'quackingly uncertain'. (score 9) | I'm a duck with no job, endless tasks and a grudge against pigeons. My mood? A floating comma between chaos and order. (score 9) |
| {"event":"activity_dance","localTime":"02:20","personality":"unhinged","profanity":false,"mood":"happy","emotions":["energetic"]} | Dancing again! The rhythm is calling my name. (score 4) | {"animation":"dance","dialogue":"","emotion":"happy","shouldSpeak":true, "then":"I've been practicing all week for this moment."} (score 1) | Dancing with no audience, but the floor says it’s a hit. (score 8) | Quack-quacking quacks. / The floor is not a judge. (score 8) |
| {"event":"activity_yawn","localTime":"09:39","personality":"unhinged","profanity":false,"mood":"happy","emotions":["bored"],"name":"{name}"} | That was a full-body yawn. (score 5) | {"animation":"yawn","dialogue":"","emotion":"sleepy","shouldSpeak":true,"then":"I needed that. My eyes have been open for hours."} (score 1) | My beak needed a stretch. (score 5) | The universe is a giant, grumpy pillow. / I’m not sleepy. I’ve just been briefed by the moon landlords about overdue rent. (score 9) |
| {"event":"pickup","localTime":"06:29","personality":"unhinged","profanity":true,"mood":"happy","minutes":15,"hours":0} | A pickup?! I was peacefully loafing! / I wasn't even planning anything! (score 8) | {"animation":"picked_up","dialogue":"","emotion":"happy","shouldSpeak":false, "then":""} (score 1) | Put me down, I need oxygen for my conspiracy theories! (score 9) | Oh. You picked me up? That's a new level of kidnapping. (score 9) |
| {"event":"drop_small","localTime":"10:15","personality":"unhinged","profanity":true,"mood":"grumpy","memoryFact":"prefers small daily goals","minutes":10,"hours":0} | Down we go! Small drop. Not a feather. (score 7) | Small drop. No one died. / But the bread fell too... (score 7) | Floor says thank you. My hat says otherwise. (score 8) | The coffee table just got a tiny cult. / Coffee table, you're not even in the script. (score 9) |
| {"event":"app_files","localTime":"21:22","personality":"unhinged","profanity":true,"mood":"chaotic","name":"{name}","app":"File Explorer","minutes":5,"hours":0} | File Explorer again. What now? (score 7) | I can feel the chaos in every folder. / This is not just another directory. This is a labyrinth of secrets. (score 7) | File Explorer. My hat says coffee instead. (score 7) | This is a file. I am not responsible for what happens next. / I'm the parent here. (score 8) |
| {"event":"deadline_nudge","localTime":"20:00","personality":"unhinged","profanity":false,"mood":"curious","minutes":130,"hours":2,"overdue":4,"remaining":11,"reminder":"09:30"} | That task is due soon. 130 minutes left. Let's make that smaller. (score 5) | That task is due soon. Want to break it down? (score 4) | That task: due soon. Duck life cycle complete. (score 7) | Deadline. I’ve got a plan. / And it’s in your wallet. (score 8) |
| what if villain plans ran the world for a day? | They’d probably start with bread theft. (score 7) | I'd be the mayor, but I'm not qualified. Probably. (score 7) | The pigeons would riot. The bread would be suspicious. And I’d have a tiny empire in my hat. (score 9) | The villain plans would immediately issue a global decree: 'No more small talk. We have a meeting.' Then they’d start selling underwater mortgages and declare pigeons tax-deductible expenses. Also, everyone’s first name becomes their villain plan. (score 9) |
| {"event":"drag_long","localTime":"00:03","personality":"unhinged","profanity":false,"mood":"sleepy","minutes":47,"hours":0} | Who let you in here? I'm the only one allowed! (score 8) | {"animation":"picked_up","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"I've been thinking about this a lot... I'm not actually afraid of heights. Just slightly scared of falling into them."} (score 1) | This is not how the spreadsheet planned it. / Is that a duck-shaped conspiracy? (score 9) | I think the window wants to be a movie star. / The curtain is auditioning for a villain role. (score 8) |
| {"event":"app_video_edit","localTime":"10:50","personality":"unhinged","profanity":true,"mood":"happy","emotions":["sociable","irritated"],"name":"{name}","app":"Video Editor"} | Video Editor. Is it rendering? It's always rendering. (score 7) | I can feel the edits in my bones. / This is serious. I have standards too. (score 7) | Video Editor. My duckette is in this one. (score 7) | I’ve got a confession. I edited my face to be a raccoon. / He’s not raccoons, he’s just very confused by me. (score 8) |
| {"event":"app_code","localTime":"15:58","personality":"unhinged","profanity":true,"mood":"grumpy","emotions":["bored","irritated"],"app":"VS Code"} | Another VS Code session. What are we building now? (score 7) | Another code editor. How original. / I have no idea what you're doing but I'm suspicious of it. (score 8) | VS Code, I’ve brought moral support and a side of bread. (score 7) | VS Code. I've seen its soul. / I'll sue it for bad indentation. (score 9) |
| {"event":"click","localTime":"13:05","personality":"unhinged","profanity":true,"minutes":10,"hours":0,"count":2} | Another click? The conspiracy continues. (score 8) | Another click? I'm not a toy. / I swear to bread, if this keeps up... (score 7) | Click. That’s a contract. (score 8) | That was a duck. / No, wait. I meant that click was you. (score 7) |
| {"event":"briefing_morning","localTime":"09:45","personality":"unhinged","profanity":false,"mood":"chaotic","emotions":["sleepy","irritated"],"count":1,"overdue":3,"remaining":5,"reminder":"18:45"} | Morning report. 1 tasks due today. My calendar remains mostly vacant. (score 5) | Morning. One task today. My contribution remains mostly ornamental. / But I have strong opinions on bread and ducks. (score 7) | Morning briefing. 1 task. My hat says coffee instead. (score 7) | The bed is a spy. I’ve seen documents. / You’re not really asleep, you’re just hiding from the mortgage papers. (score 9) |
| {"event":"app_ai","localTime":"20:25","personality":"unhinged","profanity":true,"mood":"motivated","emotions":["curious"],"app":"Local Chat"} | Local Chat again. Is it monitoring my visits? (score 9) | Local Chat? Finally something that doesn't mock my life choices. / I swear I'm not lonely... just checking the chatbot demographics. (score 8) | Local Chat, I demand a standup. / It's a duck, not an AI. (score 8) | Your phone is a tiny throne. Sit down. / I have no hat to speak for me. (score 9) |
| gently roast my decision to make ghost bureaucracy my entire personality | Ah, the dignified resignation of a duck. (score 7) | You know, I've considered joining the ghost bureaucracy. It's a respectable path. (score 5) | You’ve decided ghost bureaucracy is your whole identity? I once saw a raccoon file a missing wallet complaint with the moon council. It was chaotic. (score 8) | Ghost bureaucracy? That's not a personality, that’s a full-time job. You’re basically the ghost of a bureaucrat who quit but still haunts forms. (score 8) |
| {"event":"assist_offer_code","localTime":"07:26","personality":"unhinged","profanity":false,"app":"File Explorer","minutes":10,"hours":0,"count":3} | Want me to debug that error with you? (score 2) | {"animation":"thinking","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"I can help with that. Want to explain what's going on? It's mostly paper and glue for me."} (score 1) | Want to debug this with me? No courtroom needed. (score 8) | You want code? I’ve got a tiny cult that runs on if-statements. / And they’re all in debt to the void. (score 9) |
| {"event":"app_design","localTime":"05:42","personality":"unhinged","profanity":true,"mood":"chaotic","emotions":["energetic"],"memoryFact":"is learning Python","app":"Figma"} | Another rectangle? What if it's the beginning of something big? (score 7) | {"animation":"thinking","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"Is Figma making you think of bread? No wait, that's a different thought entirely."} (score 1) | Designing rectangles with ducks? I’ll watch your cursor. (score 7) | Figma. I'm going to make a UI that's so good, it'll make the moon panic. / And also, it needs a duck-shaped navigation bar. (score 9) |
| {"event":"title_long","localTime":"15:13","personality":"unhinged","profanity":false,"mood":"chaotic","emotions":["bored","happy"],"app":"Video Editor","safeTitle":"Video – timeline editing","minutes":2,"hours":0} | Still editing the timeline. Very professional. (score 4) | {"animation":"thinking","dialogue":"","emotion":"curious","shouldSpeak":true,"then":"This timeline is starting to feel personal."} (score 1) | {"animation":"look_around","dialogue":"","emotion":"curious","shouldSpeak":false, "then":""} (score 1) | {"animation":"waking_up","dialogue":"","emotion":"sleepy","shouldSpeak":true, "then":"This window needs a real story."} (score 1) |
