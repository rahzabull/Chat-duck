export type Intent = { kind: 'remember'; text: string } | { kind: 'forget'; query: string } |
  { kind: 'memories' } | { kind: 'conversations'; when: 'yesterday' | 'last time' | 'earlier' } |
  { kind: 'mute'; minutes: number } | { kind: 'end' } | { kind: 'chat' };
export function parseIntent(input: string): Intent {
  const text = input.trim().replace(/[.!?]+$/, '').replace(/\u2019/g, "'");
  const polite = text.replace(/^please\s+/i, '');
  if (/^remember (?:this|that):?$/i.test(polite)) return { kind: 'remember', text: '' };
  const save = /^remember\s+(?:(?:that\s+)|(?:this\s*:\s*))?(.+)$/is.exec(polite);
  if (save && !/^(?:this|that)$/i.test(save[1].trim())) return { kind: 'remember', text: save[1].trim() };
  if (/^forget that$/i.test(polite)) return { kind: 'forget', query: '' };
  const forget = /^forget\s+(?:about\s+)?(.+)$/i.exec(polite);
  if (forget) return { kind: 'forget', query: forget[1].trim() };
  if (/^what do you remember(?: about me)?$/i.test(text)) return { kind: 'memories' };
  const recall = /^what were we (?:talking|discussing) about (yesterday|last time|earlier)$/i.exec(text);
  if (recall) return { kind: 'conversations', when: recall[1].toLowerCase() as 'yesterday' | 'last time' | 'earlier' };
  const mute = /^(?:shut up|be quiet)(?: for (?:(\d+) minutes?|an? hour))?$/i.exec(polite);
  if (mute) return { kind: 'mute', minutes: mute[1] ? Math.min(1440, Math.max(1, +mute[1])) : /hour/i.test(text) ? 60 : 30 };
  if (/^(?:bye|goodbye|that's all|thanks,? that's it)$/i.test(text)) return { kind: 'end' };
  return { kind: 'chat' };
}
export function flipPronouns(text: string): string {
  return text.replace(/\bI(?:'m|’m| am)\b/gi, 'you are').replace(/\bI(?:'ve|’ve)\b/gi, 'you have')
    .replace(/\bI(?:'ll|’ll)\b/gi, "you'll").replace(/\bmyself\b/gi, 'yourself')
    .replace(/\bmy\b/gi, 'your').replace(/\bmine\b/gi, 'yours').replace(/\b(?:I|me)\b/gi, 'you');
}
