# Future full poses

Put trusted, self-contained Figma SVG exports here, with a tight viewBox and no
sheet background. Use the activity ID as the filename: `gaming.svg`, `focus.svg`,
`coffee.svg`, `alarm.svg`, `celebrate.svg`, `shrug.svg`, `laughing.svg`,
`confused.svg`, `strike.svg`, `sunglasses.svg`, `bread_snack.svg`, `visitor.svg`,
`yawn.svg`, `stretch.svg`, `dance.svg`. Aliases `laptop.svg` and `bread.svg` work too.
Conversation amused/unsure/explaining also use laughing/shrug when supplied.

Run `npm run figma:split` (also automatic before dev/build/pack:win). Commit the
SVG and regenerated `assets.generated.ts`; restart/rebuild the app. No adapter
change is needed. These are full poses, not accessory-only exports. They replace
the matching fallback pose and prop; independent sunglasses remain available.

For detailed motion, use `g data-part` around each logical part and `data-part`
on paths, following `../poses/idle.svg`. Keep wing fill + outline in one group.
Eyes use `g.eye-track > g.eye-blink > path`. Add `data-duck-hit` to only painted
body/head/wings/feet/tuft/beak paths, never the canvas or accessory props. Plain
unannotated exports still work: yellow/orange filled shapes get painted hits;
they remain static except whole-character reactions. Other palettes need explicit
hit attributes. Prefer tight viewBoxes starting at 0,0 and six-pixel padding.

Extras are trusted build assets, never fetched or accepted from model/user text
at runtime. Don't add scripts, external resources or foreignObject content.
