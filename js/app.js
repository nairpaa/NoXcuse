import { h, render, Component, createRef } from './vendor/preact.module.js';
import * as store from './store.js';
import { dayKey, hm, minuteOfDay, splitKey, keyOf, daysIn, dowOf, addDays, addMonths, dayLabel, dayTitle, fmtDuration, pad, MONTHS, MON3, DOW3 } from './dates.js';
import { beep, unlockAudio, notify, requestNotify } from './sound.js';
import { renderDesktop } from './views/desktop.js';
import { renderMobile } from './views/mobile.js';

const TICK_MS = 250;

function deviceOf(w) {
    if (w < 700) return 'mobile';
    if (w < 1000) return 'tablet';
    return 'desktop';
}

// Desktop has no Tasks/More pages and mobile has no Archive page.
function pageFor(device, page) {
    if (device === 'mobile') return page === 'archive' ? 'more' : page;
    return page === 'tasks' || page === 'more' ? 'timer' : page;
}

// The user is not looking at this tab (hidden, or another app has focus).
const away = () => document.hidden || !document.hasFocus();

// Space activates these controls natively instead of starting the timer.
const NATIVE_SPACE = '[role="checkbox"],[role="switch"],[role="tab"],[role="dialog"]';

class App extends Component {
    constructor() {
        super();
        store.setWriteErrorHandler(() => {
            if (!this.mounted) this.storageWarning = true;
            else if (Date.now() - (this.lastStorageWarning || 0) > 60000) {
                this.lastStorageWarning = Date.now();
                this.flash('Can’t save: browser storage is full or blocked', 'over');
            }
        });
        store.migrate();
        const data = store.readAll();
        this.state = {
            ...data,
            now: Date.now(),
            page: 'timer',
            overlay: null,
            toast: null,
            confirmReset: false,
            draft: '',
            bdraft: '',
            subDrafts: {},
            editing: null,
            editVal: '',
            expanded: {},
            drag: null,
            bdrag: null,
            cal: null,
            selDay: null,
            aq: '',
            agroup: 'day',
            ascope: null,
            mtab: 'today',
            vw: window.innerWidth,
            vh: window.innerHeight,
            systemDark: window.matchMedia('(prefers-color-scheme: dark)').matches
        };
        this.addInput = createRef();
        this.fileInput = createRef();
        this.lastDay = dayKey(Date.now(), data.cfg.tz);
    }

    // ---------- lifecycle & sync ----------

    componentDidMount() {
        this.mounted = true;
        if (this.storageWarning) {
            this.lastStorageWarning = Date.now();
            this.flash('Can’t save: browser storage is full or blocked', 'over');
        }
        this.autoArchive();
        this.iv = setInterval(this.tick, TICK_MS);
        this.tick();
        this.mq = window.matchMedia('(prefers-color-scheme: dark)');
        this.mq.addEventListener('change', this.onScheme);
        window.addEventListener('storage', this.onStorage);
        window.addEventListener('keydown', this.onKey);
        window.addEventListener('resize', this.onResize);
        window.addEventListener('pointerdown', unlockAudio, { passive: true });
        window.addEventListener('keydown', unlockAudio);
        document.addEventListener('visibilitychange', this.onVisible);
        this.applyTheme();
        this.armTimer();
    }

    componentWillUnmount() {
        clearInterval(this.iv);
        clearTimeout(this.toastTimer);
        clearTimeout(this.endTimer);
        this.mq.removeEventListener('change', this.onScheme);
        window.removeEventListener('storage', this.onStorage);
        window.removeEventListener('keydown', this.onKey);
        window.removeEventListener('resize', this.onResize);
        document.removeEventListener('visibilitychange', this.onVisible);
    }

    componentDidUpdate(_, prev) {
        if (prev.cfg !== this.state.cfg || prev.systemDark !== this.state.systemDark) this.applyTheme();
        if (prev.timer !== this.state.timer) this.armTimer();
        const v = this.lastVals;
        if (v) document.title = v.running ? `${v.time} · ${v.focus ? 'Focus' : 'Break'} · NoXcuse` : 'NoXcuse';
    }

    applyTheme() {
        const { cfg, systemDark } = this.state;
        const dark = cfg.theme === 'dark' || (cfg.theme === 'system' && systemDark);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = dark ? '#0e0f11' : '#f4f3ef';
    }

    onScheme = e => this.setState({ systemDark: e.matches });
    onResize = () => this.setState({ vw: window.innerWidth, vh: window.innerHeight });

    // Another tab wrote to storage: adopt its value.
    onStorage = e => {
        if (e.key === null) return this.setState(store.readAll());
        const name = store.nameOfKey(e.key);
        if (name) this.setState({ [name]: store.read(name) });
    };

    onVisible = () => {
        if (document.hidden) return;
        this.setState({ ...store.readAll(), now: Date.now() });
        this.tick();
    };

    tick = () => {
        const now = Date.now();
        const t = this.state.timer;
        if (t && t.status === 'running' && now >= t.endAt) this.finish();
        const day = dayKey(now, this.state.cfg.tz);
        if (day !== this.lastDay) {
            this.lastDay = day;
            this.autoArchive();
        }
        // repaint when the shown countdown changes; when idle, twice a minute (header date)
        const cur = this.state.timer;
        const running = cur && cur.status === 'running';
        if (running ? this.leftOf(cur, now) !== this.leftOf(cur, this.state.now) : now - this.state.now >= 30000) this.setState({ now });
    };

    // ---------- toast ----------

    flash = (text, k = 'info') => {
        this.setState({ toast: { k, text } });
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.setState({ toast: null }), 4000);
    };

    // ---------- timer ----------

    timerOf(s = this.state) {
        const t = s.timer;
        if (!t) return { mode: 'focus', status: 'idle', dur: s.cfg.focus * 60 };
        if (t.mode === 'focus' && t.status === 'idle') return { ...t, dur: s.cfg.focus * 60 };
        return t;
    }

    // Background tabs throttle the 250ms interval (to once a minute after a while),
    // so also wake up exactly when the running timer ends.
    armTimer(t = this.state.timer) {
        clearTimeout(this.endTimer);
        if (t && t.status === 'running') this.endTimer = setTimeout(this.tick, Math.max(0, t.endAt - Date.now()) + 30);
    }

    leftOf(t, now = Date.now()) {
        if (t.status === 'running') return Math.max(0, Math.ceil((t.endAt - now) / 1000));
        if (t.status === 'paused') return Math.ceil(this.leftMs(t) / 1000);
        if (t.status === 'picking') return 0;
        return t.dur;
    }

    leftMs(t) {
        return t.leftMs != null ? t.leftMs : t.left * 1000;
    }

    setTimer(t) {
        store.write('timer', t);
        this.setState({ timer: t, now: Date.now() });
    }

    toggleRun = () => {
        const t = this.timerOf();
        const now = Date.now();
        if (t.status === 'picking') return;
        if (t.status === 'running') return this.setTimer({ mode: t.mode, status: 'paused', dur: t.dur, leftMs: Math.max(0, t.endAt - now), taskId: t.taskId ?? null });
        const ms = t.status === 'paused' ? this.leftMs(t) : t.dur * 1000;
        // a focus session is credited to the task that was "now" when it started
        const first = store.read('tasks').find(x => !x.done);
        const taskId = t.status === 'paused' ? t.taskId ?? null : t.mode === 'focus' && first ? first.id : null;
        this.setTimer({ mode: t.mode, status: 'running', dur: t.dur, endAt: now + ms, taskId });
    };

    reset = () => {
        const t = this.timerOf();
        if (t.status === 'picking') return;
        this.setTimer(t.mode === 'focus' ? null : { mode: 'break', status: 'idle', dur: t.dur });
    };

    stop = () => this.setTimer(null);

    skipBreak = () => {
        this.setTimer(null);
        this.setState({ overlay: null });
    };

    startBreak = min => {
        this.setTimer({ mode: 'break', status: 'running', dur: min * 60, endAt: Date.now() + min * 60 * 1000 });
        this.setState({ overlay: null });
    };

    // The running timer reached zero. Safe to call from several tabs at once:
    // the session id is derived from endAt, so it is only ever recorded once.
    finish() {
        const t = store.read('timer');
        const now = Date.now();
        if (!t || t.status !== 'running' || now < t.endAt) {
            this.graceUsed = false;
            return this.setState({ timer: t });
        }
        if (document.hidden && !this.graceUsed && now - t.endAt < 1500) {
            // let a visible tab claim the completion (and play the sound) first
            this.graceUsed = true;
            clearTimeout(this.graceTimer);
            this.graceTimer = setTimeout(() => this.finish(), 700);
            return;
        }
        this.graceUsed = false;
        const { cfg } = this.state;

        if (t.mode === 'break') {
            store.write('timer', null);
            this.setState({ timer: null, now });
            this.flash('Break over · back to focus');
            if (cfg.sound) beep('break');
            if (cfg.notify && away()) notify('Break over', 'Ready for the next focus session?');
            return;
        }

        const sid = 's' + t.endAt;
        let fresh = false;
        const tasks = store.read('tasks');
        const credit = (t.taskId && (tasks.find(x => x.id === t.taskId) || store.read('archive').find(x => x.id === t.taskId))) || tasks.find(x => !x.done);
        const sessions = store.update('sessions', list => {
            if (list.some(x => x.id === sid)) return list;
            fresh = true;
            return [...list, { id: sid, start: t.endAt - t.dur * 1000, end: t.endAt, taskId: credit ? credit.id : null, task: credit ? credit.title : '' }];
        });
        const day = dayKey(t.endAt, cfg.tz);
        const n = sessions.filter(x => dayKey(x.end, cfg.tz) === day).length + (this.state.legacy[day] || 0);
        const kind = n === cfg.target ? 'target' : n > cfg.target ? 'over' : 'done';
        const next = cfg.autoBreak
            ? { mode: 'break', status: 'running', dur: (kind === 'target' ? cfg.long : cfg.short) * 60, endAt: now + (kind === 'target' ? cfg.long : cfg.short) * 60 * 1000 }
            : { mode: 'focus', status: 'picking', dur: cfg.focus * 60 };
        store.write('timer', next);
        this.setState(cfg.autoBreak ? { sessions, timer: next, now } : { sessions, timer: next, now, overlay: null, confirmReset: false });
        if (!fresh) return;
        const text = kind === 'target' ? `Daily target hit · ${n}/${cfg.target}`
            : kind === 'over' ? `Overtime +${n - cfg.target} · past your ${cfg.target}-session target`
                : `Session ${pad(n)} done · ${n}/${cfg.target} today`;
        this.flash(text, kind);
        if (cfg.sound) beep(kind);
        if (cfg.notify && away()) notify(kind === 'target' ? 'Daily target hit' : 'Session complete', text);
    }

    // ---------- tasks ----------

    today() {
        return dayKey(Date.now(), this.state.cfg.tz);
    }

    setTasks(fn) {
        const tasks = store.update('tasks', fn);
        this.setState({ tasks });
        return tasks;
    }

    addTask = (title, subs = []) => {
        const t = title.trim();
        if (!t) return;
        this.setTasks(list => [
            ...list.filter(x => !x.done),
            { id: store.uid(), title: t, done: false, doneAt: null, day: null, subs },
            ...list.filter(x => x.done)
        ]);
    };

    toggleTask = id => {
        const now = Date.now();
        const day = this.today();
        this.setTasks(list => list.map(t => t.id !== id ? t
            : t.done ? { ...t, done: false, doneAt: null, day: null } : { ...t, done: true, doneAt: now, day }));
    };

    removeTask = id => {
        this.setState({ editing: null });
        this.setTasks(list => list.filter(t => t.id !== id));
    };

    mapTask(id, fn) {
        this.setTasks(list => list.map(t => (t.id === id ? fn(t) : t)));
    }

    toggleSub = (id, sid) => this.mapTask(id, t => ({ ...t, subs: t.subs.map(x => (x.id === sid ? { ...x, done: !x.done } : x)) }));

    addSub = (id, text) => {
        const v = text.trim();
        if (!v) return;
        this.mapTask(id, t => ({ ...t, subs: [...t.subs, { id: store.uid(), t: v, done: false }] }));
        this.setState(s => ({ subDrafts: { ...s.subDrafts, [id]: '' }, expanded: { ...s.expanded, [id]: true } }));
    };

    removeSub = (id, sid) => {
        this.setState({ editing: null });
        this.mapTask(id, t => ({ ...t, subs: t.subs.filter(x => x.id !== sid) }));
    };

    moveTask = (fromId, toId) => {
        this.setState({ drag: null });
        if (!fromId || !toId || fromId === toId) return;
        this.setTasks(list => {
            const from = list.findIndex(t => t.id === fromId);
            const to = list.findIndex(t => t.id === toId);
            if (from < 0 || to < 0) return list;
            const next = [...list];
            const [it] = next.splice(from, 1);
            next.splice(to, 0, it);
            return next;
        });
    };

    startEdit = (id, sub = null, val = '') => this.setState({ editing: { id, sub }, editVal: val });
    cancelEdit = () => this.setState({ editing: null });

    commitEdit = () => {
        const ed = this.state.editing;
        if (!ed) return;
        const v = (this.state.editVal || '').trim();
        this.setState({ editing: null });
        if (ed.sub == null) {
            if (v) this.mapTask(ed.id, t => ({ ...t, title: v }));
        } else {
            this.mapTask(ed.id, t => ({ ...t, subs: v ? t.subs.map(x => (x.id === ed.sub ? { ...x, t: v } : x)) : t.subs.filter(x => x.id !== ed.sub) }));
        }
    };

    archiveDone = () => {
        const now = Date.now();
        const day = this.today();
        let done = [];
        this.setTasks(list => {
            done = list.filter(t => t.done);
            return list.filter(t => !t.done);
        });
        if (!done.length) return;
        const archive = store.update('archive', a => [...done.map(t => ({ ...t, doneAt: t.doneAt ?? now, day: t.day || day })), ...a]);
        this.setState({ archive });
        this.flash(`Archived ${done.length} done`);
    };

    // Tasks finished on an earlier day move to the archive automatically.
    autoArchive() {
        const day = this.today();
        const stale = store.read('tasks').filter(t => t.done && t.day && t.day < day);
        if (!stale.length) return;
        const ids = new Set(stale.map(t => t.id));
        this.setTasks(list => list.filter(t => !ids.has(t.id)));
        const archive = store.update('archive', a => [...stale.filter(t => !a.some(x => x.id === t.id)), ...a]);
        this.setState({ archive });
    }

    restore = id => {
        let item = null;
        const archive = store.update('archive', a => {
            item = a.find(x => x.id === id) || null;
            return a.filter(x => x.id !== id);
        });
        this.setState({ archive });
        if (!item) return;
        const restored = { ...item, done: false, doneAt: null, day: null };
        this.setTasks(list => [...list.filter(t => !t.done && t.id !== id), restored, ...list.filter(t => t.done && t.id !== id)]);
        this.flash(`Restored “${item.title}”`);
    };

    // ---------- backlog ----------

    setBacklog(fn) {
        const backlog = store.update('backlog', fn);
        this.setState({ backlog });
    }

    addBacklog = title => {
        const t = title.trim();
        if (!t) return;
        this.setBacklog(list => [...list, { id: store.uid(), title: t, subs: [] }]);
        this.setState({ bdraft: '' });
    };

    removeBacklog = id => this.setBacklog(list => list.filter(b => b.id !== id));

    backlogToToday = id => {
        let item = null;
        this.setBacklog(list => {
            item = list.find(b => b.id === id) || null;
            return list.filter(b => b.id !== id);
        });
        if (item) this.addTask(item.title, item.subs.map(s => ({ ...s })));
    };

    taskToBacklog = id => {
        let item = null;
        this.setState({ editing: null });
        this.setTasks(list => {
            item = list.find(t => t.id === id) || null;
            return list.filter(t => t.id !== id);
        });
        if (item) {
            this.setBacklog(list => [...list, { id: item.id, title: item.title, subs: item.subs }]);
            this.flash('Moved to backlog');
        }
    };

    moveBacklog = (fromId, toId) => {
        this.setState({ bdrag: null });
        if (!fromId || !toId || fromId === toId) return;
        this.setBacklog(list => {
            const from = list.findIndex(b => b.id === fromId);
            const to = list.findIndex(b => b.id === toId);
            if (from < 0 || to < 0) return list;
            const next = [...list];
            const [it] = next.splice(from, 1);
            next.splice(to, 0, it);
            return next;
        });
    };

    // ---------- settings & data ----------

    setCfg = (k, v) => {
        const cfg = store.update('cfg', c => ({ ...c, [k]: v }));
        this.setState({ cfg });
        if (k === 'notify' && v) {
            requestNotify().then(p => {
                if (p === 'granted') return;
                this.setState({ cfg: store.update('cfg', c => ({ ...c, notify: false })) });
                this.flash(p === 'unsupported' ? 'This browser has no notifications' : 'Notifications are blocked by the browser', 'over');
            });
        }
        if (k === 'tz') this.lastDay = dayKey(Date.now(), cfg.tz);
    };

    exportData = () => {
        const data = store.exportData();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        a.download = `noxcuse-backup-${this.today()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
        this.flash('Backup exported');
    };

    importData = () => this.fileInput.current && this.fileInput.current.click();

    onFile = e => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        file.text()
            .then(text => {
                const d = store.importData(JSON.parse(text));
                this.setState({ ...store.readAll(), editing: null, confirmReset: false });
                this.flash(`Imported ${d.tasks.length} tasks · ${d.archive.length} archived`);
            })
            .catch(() => this.flash('That file is not a NoXcuse backup', 'over'));
    };

    doReset = () => {
        store.clearAll();
        this.setState({ ...store.readAll(), overlay: null, confirmReset: false, editing: null, expanded: {}, subDrafts: {} });
        this.flash('All data cleared');
    };

    // ---------- calendar ----------

    shiftMonth = n => {
        const [ty, tm] = splitKey(this.today());
        const cur = this.state.cal || { y: ty, m: tm };
        const next = addMonths(cur.y, cur.m, n);
        if (next.y * 12 + next.m > ty * 12 + tm) return;
        this.setState({ cal: next.y === ty && next.m === tm ? null : next, selDay: null });
    };

    pickDay = key => {
        const [y, m] = splitKey(key);
        const [ty, tm] = splitKey(this.today());
        this.setState({ selDay: key, cal: y === ty && m === tm ? null : { y, m } });
    };

    // ---------- navigation & keys ----------

    go = page => this.setState({ page, overlay: null, confirmReset: false });

    toggleOverlay = name => this.setState(s => ({ overlay: s.overlay === name ? null : name, confirmReset: false }));

    focusAdd = () => {
        this.setState({ page: 'timer', overlay: null }, () => this.addInput.current && this.addInput.current.focus());
    };

    onKey = e => {
        const device = deviceOf(this.state.vw);
        if (device === 'mobile' || e.repeat) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tg = e.target;
        if (tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable)) return;
        const s = this.state;
        const k = e.key;
        if (k === ' ' && tg && tg.closest && tg.closest(NATIVE_SPACE)) return;
        const t = this.timerOf();
        if (t.status === 'picking' && pageFor(device, s.page) === 'timer') {
            const pick = { 1: () => this.startBreak(s.cfg.short), 2: () => this.startBreak(s.cfg.long), 3: this.skipBreak }[k];
            if (pick) {
                e.preventDefault();
                pick();
            }
            return;
        }
        if (k === 'Escape') {
            if (s.editing) {
                e.preventDefault();
                this.cancelEdit();
            } else if (s.overlay || s.confirmReset) {
                e.preventDefault();
                this.setState({ overlay: null, confirmReset: false });
            }
            return;
        }
        const map = {
            ' ': this.toggleRun,
            r: this.reset,
            s: t.mode === 'focus' ? this.stop : this.skipBreak,
            n: this.focusAdd,
            t: () => this.go('timer'),
            c: () => this.go('calendar'),
            a: () => this.go('archive'),
            b: () => this.toggleOverlay('backlog'),
            ',': () => this.toggleOverlay('settings'),
            '?': () => this.toggleOverlay('keys')
        };
        const fn = map[k.length === 1 ? k.toLowerCase() : k];
        if (fn) {
            e.preventDefault();
            fn();
        }
    };

    // ---------- derived data ----------

    dayStats() {
        const { sessions, legacy, cfg } = this.state;
        const c = this.statsCache;
        if (c && c.sessions === sessions && c.legacy === legacy && c.tz === cfg.tz) return c.value;
        const byDay = new Map();
        const spent = new Map();
        for (const x of sessions) {
            const d = dayKey(x.end, cfg.tz);
            if (!byDay.has(d)) byDay.set(d, []);
            byDay.get(d).push(x);
            if (x.taskId) spent.set(x.taskId, (spent.get(x.taskId) || 0) + 1);
        }
        for (const list of byDay.values()) list.sort((a, b) => a.start - b.start);
        const value = {
            byDay,
            spent,
            count: d => (byDay.get(d) || []).length + (legacy[d] || 0),
            minutes: d => (byDay.get(d) || []).reduce((m, x) => m + (x.end - x.start) / 60000, 0) + (legacy[d] || 0) * 25
        };
        this.statsCache = { sessions, legacy, tz: cfg.tz, value };
        return value;
    }

    sizes(device) {
        const { vw, vh } = this.state;
        let dial;
        let panelH = 0;
        if (device === 'mobile') dial = Math.min(330, vw - 40, vh - 64 - 78 - 230);
        else if (device === 'tablet') {
            panelH = Math.round(Math.min(480, Math.max(320, vh * 0.42)));
            dial = Math.min(440, vh - 64 - panelH - 190, vw - 64);
        } else dial = Math.min(440, vh - 64 - 200, vw - 380 - 64);
        dial = Math.max(200, Math.round(dial));
        return { dial, panelH };
    }

    vals() {
        const s = this.state;
        const { cfg } = s;
        const tz = cfg.tz;
        const now = s.now;
        const today = dayKey(now, tz);
        const device = deviceOf(s.vw);
        const page = pageFor(device, s.page);
        const stats = this.dayStats();
        const target = cfg.target;

        // timer
        const t = this.timerOf();
        const focus = t.mode === 'focus';
        const running = t.status === 'running';
        const picking = t.status === 'picking';
        const left = this.leftOf(t, now);
        const remDeg = t.dur ? (left / t.dur) * 360 : 0;
        const leds = Array.from({ length: 25 }, (_, i) => ({ deg: i * 14.4, on: i * 14.4 < remDeg - 0.01 }));
        const n = stats.count(today);
        const over = n >= target;
        const strip = (count, live) => Array.from({ length: Math.max(target, count + (live ? 1 : 0)) }, (_, i) =>
            i < count ? (i < target ? 'done' : 'over') : live && i === count ? (focus ? 'live' : 'live-break') : 'empty');

        // tasks
        const tasks = s.tasks;
        const nowTask = tasks.find(x => !x.done) || null;
        const doneCount = tasks.filter(x => x.done).length;
        const openCount = tasks.length - doneCount;

        const time = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
        const v = {
            s, device, page, today, target, tz,
            size: this.sizes(device),
            focus, running, picking, left, time, leds,
            idle: t.status === 'idle',
            modeLabel: focus ? (running ? 'FOCUS' : t.status === 'idle' ? 'READY' : 'PAUSED') : (running ? 'BREAK' : 'BREAK · PAUSED'),
            sessLabel: !focus ? 'STEP AWAY' : over ? `OVERTIME +${n - target + 1}` : `SESSION ${pad(n + 1)}`,
            sessOver: focus && over,
            runLabel: running ? 'Pause' : focus ? 'Start focus' : 'Resume break',
            cells: strip(n, !picking),
            sessCount: n,
            focusedToday: fmtDuration(stats.minutes(today)),
            showBreakPick: picking && (device === 'mobile' || page === 'timer'),
            bpHead: n === target ? `DAILY TARGET HIT · ${n}/${target}` : n > target ? `OVERTIME +${n - target}` : `SESSION ${pad(n)} COMPLETE`,
            bpOver: n > target,
            bpTitle: n === target ? 'Target hit. Take the long break.' : n > target ? 'You’re past your target. Rest.' : 'Take a break.',
            bpCells: strip(n, false),
            tasks, nowTask, doneCount, openCount,
            spentOf: id => stats.spent.get(id) || 0,
            dateTitle: dayTitle(today),
            dateShort: dayLabel(today).split(' ').slice(0, 3).join(' ')
        };
        if (page === 'calendar') Object.assign(v, this.calendarVals(stats, today, target));
        if (page === 'archive' || page === 'more') Object.assign(v, this.archiveVals(today));
        this.lastVals = v;
        return v;
    }

    calendarVals(stats, today, target) {
        const s = this.state;
        const tz = s.cfg.tz;
        const [ty, tm, td] = splitKey(today);
        const { y, m } = s.cal || { y: ty, m: tm };
        const isCur = y === ty && m === tm;
        const nDays = daysIn(y, m);
        const lastDay = isCur ? td : nDays;
        const counts = Array.from({ length: lastDay }, (_, i) => stats.count(keyOf(y, m, i + 1)));
        const total = counts.reduce((a, b) => a + b, 0);
        const hitDays = counts.filter(c => c >= target).length;
        const best = Math.max(0, ...counts);
        const bestDay = counts.indexOf(best) + 1;
        let minutes = 0;
        for (let d = 1; d <= lastDay; d++) minutes += stats.minutes(keyOf(y, m, d));

        // consecutive days at target, ending today (today may still be in progress)
        let streak = 0;
        let k = today;
        if (stats.count(k) < target) k = addDays(k, -1);
        for (let guard = 0; guard < 3660 && stats.count(k) >= target; guard++) {
            streak++;
            k = addDays(k, -1);
        }

        const stat = [
            { l: 'SESSIONS', v: String(total), sub: `avg ${(total / lastDay).toFixed(1)} / day` },
            { l: 'FOCUSED', v: fmtDuration(minutes), sub: isCur ? 'this month' : MONTHS[m - 1] },
            { l: 'TARGET HIT', v: `${hitDays}/${lastDay}`, sub: isCur ? 'days so far' : 'days' },
            { l: 'STREAK', v: `${streak} ${streak === 1 ? 'day' : 'days'}`, sub: best ? `best: ${best} on ${bestDay} ${MON3[m - 1]}` : 'no sessions yet' }
        ];

        // timeline (06:00–24:00 unless something ran earlier)
        // a session that started before midnight is drawn from 00:00 on the day it ended
        const place = (x, key) => {
            const sameDay = dayKey(x.start, tz) === key;
            const startMin = sameDay ? minuteOfDay(x.start, tz) : 0;
            const len = sameDay ? (x.end - x.start) / 60000 : minuteOfDay(x.end, tz);
            return { startMin, len: Math.max(1, Math.min(len, 24 * 60 - startMin)) };
        };
        let startH = 6;
        for (let d = 1; d <= lastDay && startH; d++) {
            const key = keyOf(y, m, d);
            if ((stats.byDay.get(key) || []).some(x => place(x, key).startMin < startH * 60)) startH = 0;
        }
        const span = (24 - startH) * 60;
        const hours = [];
        for (let hr = startH; hr <= 24; hr += 3) hours.push({ l: ((hr - startH) * 60 / span) * 100, t: `${pad(hr % 24)}:00` });

        const selKey = s.selDay && s.selDay.startsWith(`${y}-${pad(m)}-`) && +s.selDay.slice(8) <= lastDay ? s.selDay : keyOf(y, m, lastDay);
        const rows = [];
        for (let d = lastDay; d >= 1; d--) {
            const key = keyOf(y, m, d);
            const list = stats.byDay.get(key) || [];
            const c = stats.count(key);
            const legacyN = s.legacy[key] || 0;
            rows.push({
                key,
                name: `${DOW3[dowOf(y, m, d)]} ${pad(d)}`,
                tot: `${c}/${target}`,
                hit: c >= target && c > 0,
                any: c > 0,
                today: key === today,
                sel: key === selKey,
                legacyN,
                blocks: list.map((x, j) => {
                    const { startMin, len } = place(x, key);
                    return {
                        l: Math.max(0, (startMin - startH * 60) / span) * 100,
                        w: (len / span) * 100,
                        over: j + legacyN >= target,
                        tip: `${hm(x.start, tz)}–${hm(x.end, tz)} · ${x.task || 'No task'}`
                    };
                })
            });
        }

        const sel = selKey;
        const selN = stats.count(sel);
        const groups = [];
        for (const x of stats.byDay.get(sel) || []) {
            const g = groups[groups.length - 1];
            const label = x.task || 'No task';
            if (g && g.task === label) {
                g.n++;
                g.to = hm(x.end, tz);
            } else groups.push({ task: label, from: hm(x.start, tz), to: hm(x.end, tz), n: 1 });
        }
        const completed = [
            ...s.archive.filter(a => a.day === sel),
            ...s.tasks.filter(t => t.done && t.day === sel)
        ].sort((a, b) => (a.doneAt || 0) - (b.doneAt || 0)).map(a => ({ title: a.title, at: a.doneAt ? hm(a.doneAt, tz) : '' }));

        const scaleMax = Math.max(target, ...Array.from({ length: 14 }, (_, i) => stats.count(addDays(keyOf(y, m, lastDay), i - 13)))) + 1;
        const bars = Array.from({ length: 14 }, (_, i) => {
            const key = addDays(keyOf(y, m, lastDay), i - 13);
            const c = stats.count(key);
            return { key, d: +key.slice(8), h: (c / scaleMax) * 100, kind: c > target ? 'over' : c >= target ? 'hit' : 'under', sel: key === sel };
        });

        return {
            cal: {
                y, m, isCur, monthLabel: `${MONTHS[m - 1]} ${y}`, monthShort: MONTHS[m - 1],
                stats: stat, hours, rows, bars, tgtPct: (target / scaleMax) * 100,
                sel: {
                    key: sel,
                    name: dayLabel(sel) + (sel === today ? ' · TODAY' : ''),
                    n: selN,
                    status: !selN ? 'No sessions' : selN < target ? `${target - selN} short of target` : selN === target ? 'Target hit' : `Target hit · +${selN - target} overtime`,
                    tone: !selN ? 'muted' : selN < target ? 'dim' : selN === target ? 'accent' : 'danger',
                    cells: Array.from({ length: Math.max(target, selN) }, (_, i) => (i < selN ? (i < target ? 'done' : 'over') : 'empty')),
                    focused: `${fmtDuration(stats.minutes(sel))} focused`,
                    log: groups.map(g => ({ ...g, span: g.n > 1 ? `${g.from}–${g.to}` : g.from, cnt: `${g.n}×` })),
                    legacyN: s.legacy[sel] || 0,
                    completed
                }
            }
        };
    }

    archiveVals(today) {
        const s = this.state;
        const tz = s.cfg.tz;
        const q = s.aq.trim().toLowerCase();
        const sc = s.ascope;
        const mode = s.agroup;
        const ymd = a => splitKey(a.day);
        const sorted = [...s.archive].sort((a, b) => b.day.localeCompare(a.day) || (b.doneAt || 0) - (a.doneAt || 0));
        const inScope = a => {
            if (!sc) return true;
            const [y, m] = ymd(a);
            return y === sc.y && (sc.m == null || m === sc.m);
        };
        const found = sorted.filter(a => inScope(a) && (!q || a.title.toLowerCase().includes(q)));
        const gmap = new Map();
        for (const a of found) {
            const [y, m, d] = ymd(a);
            const key = mode === 'day' ? a.day : mode === 'month' ? `${y}-${m}` : String(y);
            if (!gmap.has(key)) {
                gmap.set(key, {
                    key,
                    date: mode === 'day' ? dayLabel(a.day) + (a.day === today ? ' · TODAY' : '') : mode === 'month' ? `${MONTHS[m - 1].toUpperCase()} ${y}` : String(y),
                    rows: []
                });
            }
            const ix = q ? a.title.toLowerCase().indexOf(q) : -1;
            gmap.get(key).rows.push({
                id: a.id,
                pre: ix < 0 ? a.title : a.title.slice(0, ix),
                hit: ix < 0 ? '' : a.title.slice(ix, ix + q.length),
                post: ix < 0 ? '' : a.title.slice(ix + q.length),
                when: mode === 'day' ? '' : `${d} ${MON3[m - 1]}`,
                meta: [a.subs.length ? `${a.subs.length} subtask${a.subs.length === 1 ? '' : 's'}` : '', a.doneAt ? hm(a.doneAt, tz) : ''].filter(Boolean).join(' · ')
            });
        }
        const years = [...new Set(s.archive.map(a => ymd(a)[0]))].sort((a, b) => b - a).map(y => ({
            y,
            count: s.archive.filter(a => ymd(a)[0] === y).length,
            on: !!sc && sc.y === y && sc.m == null,
            months: [...new Set(s.archive.filter(a => ymd(a)[0] === y).map(a => ymd(a)[1]))].sort((a, b) => b - a).map(m => ({
                m,
                l: MONTHS[m - 1],
                count: s.archive.filter(a => { const [yy, mm] = ymd(a); return yy === y && mm === m; }).length,
                on: !!sc && sc.y === y && sc.m === m
            }))
        }));
        return {
            arch: {
                groups: [...gmap.values()],
                years,
                total: s.archive.length,
                found: found.length,
                scopeLabel: !sc ? 'All time' : sc.m == null ? String(sc.y) : `${MONTHS[sc.m - 1]} ${sc.y}`,
                q: s.aq,
                mode
            }
        };
    }

    render() {
        const v = this.vals();
        return v.device === 'mobile' ? renderMobile(this, v) : renderDesktop(this, v);
    }
}

render(h(App), document.getElementById('app'));
