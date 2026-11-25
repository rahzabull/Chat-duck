import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProductivityService, type ProductivityHooks } from '../src/main/productivity/service';
import { ProductivityStore } from '../src/main/productivity/store';
let directory: string; let service: ProductivityService; let store: ProductivityStore; let hooks: ProductivityHooks;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 25, 10)); directory = mkdtempSync(join(tmpdir(), 'ducky-productivity-'));
  store = new ProductivityStore(directory); hooks = { changed: vi.fn(), attention: vi.fn(), notify: vi.fn(), export: vi.fn(async () => true), doNotDisturb: () => false };
  service = new ProductivityService(store, hooks);
});
afterEach(() => { service.dispose(); rmSync(directory, { recursive: true, force: true }); vi.useRealTimers(); });
async function action(name: string, args: Record<string, unknown> = {}, token?: string) { const p = service.action({ name, args, token }); await vi.advanceTimersByTimeAsync(300); return p; }
async function local(text: string) { const p = service.local(text); await vi.advanceTimersByTimeAsync(300); return p; }
describe('AI-independent productivity orchestration', () => {
  it('persists clean titles from the desktop feedback across a restart', async () => {
    expect((await local('can you remind me to drink water in every half an hour'))?.ok).toBe(true);
    expect((await local('can you add buy milk to my list'))?.ok).toBe(true);
    service.dispose(); store = new ProductivityStore(directory); service = new ProductivityService(store, hooks);
    expect(store.reminders.value[0]).toMatchObject({ text: 'drink water', recurrence: { kind: 'interval', intervalMinutes: 30 } });
    expect(store.tasks.value[0].title).toBe('buy milk');
  });
  it('keeps the series through Snooze and Done, and confirms a spoken stop before deleting it', async () => {
    await local('remind me to drink water every half an hour');
    const original = store.reminders.value[0]; expect(Date.parse(original.at) - Date.parse(original.createdAt)).toBe(1800000);
    vi.setSystemTime(new Date(original.at)); await service.tick();
    const next = store.reminders.value[0].at; await action('snooze_reminder', { id: original.id, minutes: 10 });
    expect(store.reminders.value[0].at).toBe(next);
    vi.setSystemTime(new Date(store.reminders.value[0].snoozedUntil!)); await service.tick();
    await action('done_reminder', { id: original.id }); expect(store.reminders.value[0]).toMatchObject({ at: next, state: 'scheduled', recurrence: { kind: 'interval', intervalMinutes: 30 } });
    service.dispose(); store = new ProductivityStore(directory); service = new ProductivityService(store, hooks);
    expect(store.reminders.value[0].createdAt).toBe(original.createdAt);
    const stop = await local('stop the water reminder'); expect(stop?.confirmation).toMatchObject({ name: 'cancel_reminder', args: { id: original.id } }); expect(store.reminders.value).toHaveLength(1);
    const result = service.registry.run(stop!.confirmation!, 0, true); await vi.advanceTimersByTimeAsync(300); expect((await result).ok).toBe(true); expect(store.reminders.value).toEqual([]);
  });
  it('reports too-short intervals locally without creating a reminder', async () => {
    expect((await local('remind me to drink water every 2 minutes'))?.message).toContain('5 whole minutes'); expect(store.reminders.value).toEqual([]);
  });
  it('uses the shared plain-words reminder label in confirmations', async () => {
    const result = await action('add_reminder', { text: 'water', at: new Date(2026, 10, 25, 16, 17, 59).toISOString() });
    expect(result.message).toBe('Reminder saved: water — Today, 4:17 PM');
    const repeating = await action('add_reminder', { text: 'water', at: new Date(2026, 11, 1, 9).toISOString(), recurrence: { kind: 'weekly', weekdays: [2] } });
    expect(repeating.message).toBe('Reminder saved: water — Every Tuesday, 9:00 AM');
  });
  it('creates and edits tasks, disambiguates titles, and celebrates completion', async () => {
    expect((await local('add campaign presentation tomorrow'))?.ok).toBe(true); await local('add campaign budget Friday');
    expect((await local('mark campaign done'))?.message).toContain('1. campaign presentation');
    expect((await local('2'))?.ok).toBe(true); expect(store.tasks.value[1].done).toBe(true); expect(hooks.attention).toHaveBeenCalledWith('celebrate', 'task_done');
    await local('move the presentation task to Friday'); expect(store.tasks.value[0].due).toBe('2026-11-27');
    await local('rename campaign presentation to slides'); expect(store.tasks.value[0].title).toBe('slides');
  });
  it('confirms all destructive tools and rejects forged, expired and replayed tokens', async () => {
    await local('add bread'); const id = store.tasks.value[0].id;
    const prompt = await action('delete_task', { id }); expect(prompt.token).toBeTruthy(); expect(store.tasks.value).toHaveLength(1);
    const forged = await service.action({ name: 'delete_task', args: { id }, token: 'fake' }); expect(forged.ok).toBe(false);
    expect((await action('delete_task', {}, prompt.token)).ok).toBe(true); expect(store.tasks.value).toHaveLength(0);
    expect((await action('delete_task', {}, prompt.token)).ok).toBe(false);
    for (const name of ['delete_task', 'clear_completed', 'cancel_reminder', 'delete_note', 'delete_all_tasks', 'delete_all_reminders', 'delete_all_notes']) expect(service.tools.find(t => t.name === name)?.permission).toBe('confirm');
  });
  it('local deletion produces the same registry confirmation and numeric choices cannot delete unconfirmed', async () => {
    await local('add bread'); await local('add bread crumbs');
    expect((await local('delete bread'))?.confirmation).toMatchObject({ name: 'delete_task' }); expect(store.tasks.value).toHaveLength(2);
    await local('add bread rolls'); const result = await local('delete bread r'); expect(result?.message).toContain('Which one');
    expect((await local('1'))?.confirmation).toMatchObject({ name: 'delete_task' }); expect(store.tasks.value).toHaveLength(3);
  });
  it('asks When and resolves the next input locally', async () => {
    expect((await local('remind me to call Mum'))?.message).toBe('When?'); expect(store.reminders.value).toEqual([]);
    expect((await local('tomorrow 9am'))?.ok).toBe(true); expect(store.reminders.value[0].text).toBe('call Mum');
  });
  it('never claims a failed write succeeded', async () => {
    mkdirSync(`${store.tasks.path}.tmp`); const result = await local('add bread'); expect(result?.ok).toBe(false); expect(store.tasks.value).toEqual([]); expect(service.view.card).toBeNull();
  });
  it('serializes concurrent writes without losing tasks', async () => {
    const a = service.action({ name: 'add_task', args: { title: 'a' } }); const b = service.action({ name: 'add_task', args: { title: 'b' } });
    await vi.advanceTimersByTimeAsync(600); expect((await a).ok).toBe(true); expect((await b).ok).toBe(true); expect(store.tasks.value).toHaveLength(2);
  });
  it('persists delivery before notifying, queues one card, and snoozes independently of mute/AI', async () => {
    await local('remind me to drink water in 1 minute'); await local('remind me to stretch in 1 minute');
    hooks.notify = vi.fn(r => { const data = JSON.parse(readFileSync(store.reminders.path, 'utf8')).data; expect(data.find((v: any) => v.id === r.id).lastFiredAt).toBeTruthy(); });
    service.start(); await vi.advanceTimersByTimeAsync(75000);
    expect(service.view.card).toBe('reminder-due'); expect(service.view.queue).toBe(1); expect(hooks.notify).toHaveBeenCalledOnce();
    const id = service.view.selected!; await action('snooze_reminder', { id, minutes: 5 }); expect(store.reminders.value.find(r => r.id === id)?.snoozedUntil).toBeTruthy();
    expect(service.view.selected).not.toBe(id); expect(hooks.notify).toHaveBeenCalledTimes(2);
    await action('done_reminder', { id: service.view.selected }); await vi.advanceTimersByTimeAsync(315000);
    expect(service.view.selected).toBe(id); expect(hooks.notify).toHaveBeenCalledTimes(3);
  });
  it('retries failed fired-marker persistence before showing anything', async () => {
    await local('remind me to drink in 1 minute'); await action('close'); mkdirSync(`${store.reminders.path}.tmp`);
    vi.setSystemTime(Date.now() + 60000); await service.tick(true); expect(hooks.notify).not.toHaveBeenCalled(); expect(hooks.attention).not.toHaveBeenCalledWith('alarm', expect.anything());
    rmSync(`${store.reminders.path}.tmp`, { recursive: true }); await service.tick(true); expect(hooks.notify).toHaveBeenCalledOnce();
  });
  it('recovers missed reminders once and does not renotify a fired occurrence after restart', async () => {
    await local('remind me to drink in 1 minute'); vi.setSystemTime(Date.now() + 3600000); await service.tick(true);
    expect(hooks.attention).toHaveBeenCalledWith('alarm', 'You missed this while I was asleep: drink'); expect(hooks.notify).toHaveBeenCalledOnce();
    service.dispose(); service = new ProductivityService(new ProductivityStore(directory), hooks); service.start(); await vi.advanceTimersByTimeAsync(30000);
    expect(hooks.notify).toHaveBeenCalledOnce();
  });
  it('runs focus, pause/resume, optional history and a long break every four sessions', async () => {
    await action('start_focus', { minutes: .05 }); await action('pause_focus'); const remaining = service.view.focus!.remaining;
    await vi.advanceTimersByTimeAsync(20000); expect(service.view.focus?.remaining).toBe(remaining);
    await action('resume_focus'); await vi.advanceTimersByTimeAsync(4000); expect(service.view.focus).toBeUndefined(); expect(store.focus.value.history).toEqual([]);
    await action('settings', { keepHistory: true, autoBreak: true });
    for (let i = 0; i < 3; i++) { await action('start_focus', { minutes: .05 }); await vi.advanceTimersByTimeAsync(4000); }
    expect(store.focus.value.history).toHaveLength(3); expect(service.view.focus).toMatchObject({ kind: 'break', minutes: 15 });
    await action('stop_focus'); expect(service.view.focus).toBeUndefined(); await action('settings', { keepHistory: false }); expect(store.focus.value.history).toEqual([]);
  });
  it('does not let an old deadline finish a replacement focus session during its durable write', async () => {
    await action('start_focus', { minutes: .05 }); await vi.advanceTimersByTimeAsync(2850);
    await action('start_focus', { minutes: 25 }); await vi.advanceTimersByTimeAsync(1000);
    expect(service.view.focus?.minutes).toBe(25); expect(hooks.attention).not.toHaveBeenCalledWith('celebrate', 'focus_done');
  });
  it('holds due presentation behind the DND hook and honors disabled OS notifications', async () => {
    await action('settings', { notifications: false }); await local('remind me to drink in 1 minute'); await action('close');
    hooks.doNotDisturb = () => true; vi.setSystemTime(Date.now() + 60000); await service.tick();
    expect(service.view.card).toBeNull(); expect(store.reminders.value[0].lastFiredAt).toBeTruthy(); expect(hooks.notify).not.toHaveBeenCalled();
    hooks.doNotDisturb = () => false; await service.tick(); expect(service.view.card).toBe('reminder-due'); expect(hooks.notify).not.toHaveBeenCalled();
  });
  it('expires deletion confirmations and creation Undo without deleting anything', async () => {
    await local('add bread'); const prompt = await action('delete_task', { id: store.tasks.value[0].id });
    await vi.advanceTimersByTimeAsync(10000); expect((await action('undo')).ok).toBe(false);
    await vi.advanceTimersByTimeAsync(60000); expect((await action('delete_task', {}, prompt.token)).ok).toBe(false); expect(store.tasks.value).toHaveLength(1);
  });
  it('saves output notes and finds them by topic independently of memory', async () => {
    await action('add_note', { text: 'Campaign plan from reading panel', topic: 'saved', pinned: true });
    expect((await local('what notes do I have about the campaign?'))?.data).toHaveLength(1);
    expect(store.notes.value[0]).toMatchObject({ topic: 'saved', pinned: true });
    await action('update_note', { id: store.notes.value[0].id, text: '<script>alert(1)</script>' }); expect(store.notes.value[0].text).toContain('<script>');
  });
  it('defaults to notifications on and history off, and uses a 15-second idle scheduler only', async () => {
    expect(service.view.settings).toMatchObject({ notifications: true, keepHistory: false });
    const tick = vi.spyOn(service, 'tick'); service.start(); await vi.advanceTimersByTimeAsync(14999); expect(tick).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1); expect(tick).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(1);
  });
});


describe('Phase C notification-only delivery', () => {
  it('notifies once during gaming/DND even with normal OS notifications disabled, without a duck replay', async () => {
    await action('settings', { notifications: false }); await local('remind me to drink in 1 minute'); await action('close');
    hooks.doNotDisturb = () => true; hooks.notificationOnly = () => true;
    vi.setSystemTime(Date.now() + 60000); await service.tick();
    expect(hooks.notify).toHaveBeenCalledOnce(); expect(hooks.attention).not.toHaveBeenCalled(); expect(service.view.card).toBeNull();
    await service.tick(); expect(hooks.notify).toHaveBeenCalledOnce();
    hooks.doNotDisturb = () => false; hooks.notificationOnly = () => false; await service.tick();
    expect(service.view.card).toBeNull(); expect(hooks.attention).not.toHaveBeenCalled();
    expect(store.reminders.value[0].state).toBe('due');
  });
  it('retains delivery when the native notification fails so it can be retried', async () => {
    await local('remind me to drink in 1 minute'); await action('close');
    hooks.notificationOnly = () => true; hooks.notify = vi.fn(() => false);
    vi.setSystemTime(Date.now() + 60000); await service.tick(); expect(service.view.card).toBeNull();
    hooks.notificationOnly = () => false; await service.tick(); expect(service.view.card).toBe('reminder-due');
    expect(hooks.attention).toHaveBeenCalledOnce();
  });
});
