// Persistence layer. Every write is a read-modify-write against localStorage,
// so a stale tab can never overwrite changes another tab made.
import { systemTz, validTz, dayKey } from './dates.js';

const KEYS = {
    cfg: 'nx.cfg',
    tasks: 'nx.tasks',
    backlog: 'nx.backlog',
    archive: 'nx.archive',
    sessions: 'nx.sessions',
    legacy: 'nx.legacy',
    timer: 'nx.timer'
};
const META_KEY = 'nx.meta';
const V1_KEYS = ['noxcuse_tasks', 'noxcuse_backlog', 'noxcuse_daily_sessions', 'noxcuse_timer', 'noxcuse_timezone'];

export const NAMES = Object.keys(KEYS);

export const LIMITS = {
    focus: [5, 90, 5],
    short: [1, 30, 1],
    long: [5, 60, 5],
    target: [1, 32, 1]
};

export function defaultCfg() {
    return { focus: 25, short: 5, long: 15, target: 8, sound: true, autoBreak: false, notify: false, theme: 'system', tz: systemTz() };
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v));
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Math.round(+v || lo)));

function cleanSubs(subs) {
    return (Array.isArray(subs) ? subs : [])
        .filter(isObj)
        .map(s => ({ id: str(s.id) || uid(), t: str(s.t), done: !!s.done }));
}

function cleanTask(t) {
    return {
        id: str(t.id) || uid(),
        title: str(t.title),
        done: !!t.done,
        doneAt: Number.isFinite(t.doneAt) ? t.doneAt : null,
        day: typeof t.day === 'string' ? t.day : null,
        subs: cleanSubs(t.subs)
    };
}

const SANITIZE = {
    cfg(v) {
        const d = defaultCfg();
        const c = { ...d, ...(isObj(v) ? v : {}) };
        for (const k of Object.keys(LIMITS)) c[k] = clamp(c[k], LIMITS[k]);
        for (const k of ['sound', 'autoBreak', 'notify']) c[k] = !!c[k];
        if (!['system', 'light', 'dark'].includes(c.theme)) c.theme = 'system';
        if (!validTz(c.tz)) c.tz = d.tz;
        return c;
    },
    tasks: v => (Array.isArray(v) ? v.filter(isObj).map(cleanTask) : []),
    backlog: v => (Array.isArray(v) ? v.filter(isObj).map(b => ({ id: str(b.id) || uid(), title: str(b.title), subs: cleanSubs(b.subs) })) : []),
    archive: v => (Array.isArray(v) ? v.filter(a => isObj(a) && typeof a.day === 'string').map(a => ({ ...cleanTask(a), done: true })) : []),
    sessions(v) {
        const seen = new Set();
        return (Array.isArray(v) ? v : []).filter(s => {
            if (!isObj(s) || !Number.isFinite(s.start) || !Number.isFinite(s.end) || seen.has(s.id)) return false;
            seen.add(s.id);
            return true;
        });
    },
    legacy(v) {
        const out = {};
        if (isObj(v)) for (const [k, n] of Object.entries(v)) if (/^\d{4}-\d\d-\d\d$/.test(k) && +n > 0) out[k] = Math.round(+n);
        return out;
    },
    timer(v) {
        if (!isObj(v) || !['focus', 'break'].includes(v.mode)) return null;
        if (!['idle', 'running', 'paused', 'picking'].includes(v.status)) return null;
        if (!(v.dur > 0)) return null;
        if (v.status === 'running' && !Number.isFinite(v.endAt)) return null;
        if (v.status === 'paused' && !(v.leftMs >= 0 || v.left >= 0)) return null;
        return v;
    }
};

// localStorage throws when site data is blocked or full. Never crash: keep the
// value in memory so the app still works for this visit, and report the failure.
const memory = new Map();

function rawGet(key) {
    if (memory.has(key)) return memory.get(key);
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function rawSet(key, value) {
    try {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
        memory.delete(key);
        return true;
    } catch (err) {
        memory.set(key, value);
        onWriteError(err);
        return false;
    }
}

let onWriteError = () => {};

function readRaw(key) {
    try {
        const v = rawGet(key);
        return v == null ? undefined : JSON.parse(v);
    } catch {
        return undefined; // corrupted entry: fall back to defaults instead of crashing
    }
}

export function read(name) {
    return SANITIZE[name](readRaw(KEYS[name]));
}

export function readAll() {
    const out = {};
    for (const n of NAMES) out[n] = read(n);
    return out;
}

export function setWriteErrorHandler(fn) {
    onWriteError = fn;
}

export function write(name, value) {
    rawSet(KEYS[name], value == null ? null : JSON.stringify(value));
    return value;
}

// Apply fn to the freshest stored value and persist the result.
export function update(name, fn) {
    return write(name, fn(read(name)));
}

export function nameOfKey(key) {
    return NAMES.find(n => KEYS[n] === key) || null;
}

export function clearAll() {
    for (const k of [...Object.values(KEYS), ...V1_KEYS]) rawSet(k, null);
    rawSet(META_KEY, JSON.stringify({ version: 2, resetAt: Date.now() }));
}

export function exportData() {
    return { app: 'NoXcuse', version: 2, exportedAt: new Date().toISOString(), ...readAll(), timer: undefined };
}

export function importData(d) {
    if (!isObj(d) || !Array.isArray(d.tasks)) throw new Error('Not a NoXcuse backup');
    const next = {
        cfg: SANITIZE.cfg({ ...read('cfg'), ...(isObj(d.cfg) ? d.cfg : {}) }),
        tasks: SANITIZE.tasks(d.tasks),
        backlog: SANITIZE.backlog(d.backlog),
        archive: SANITIZE.archive(d.archive),
        sessions: SANITIZE.sessions(d.sessions),
        legacy: SANITIZE.legacy(d.legacy)
    };
    for (const [n, v] of Object.entries(next)) write(n, v);
    return next;
}

// One-time, non-destructive upgrade from the v1 storage layout (old keys are kept).
export function migrate() {
    const meta = readRaw(META_KEY);
    if (isObj(meta) && meta.version >= 2) return false;
    if (rawGet(KEYS.tasks) != null) {
        // v2 data exists but the marker was lost (e.g. storage was full): never overwrite it
        rawSet(META_KEY, JSON.stringify({ version: 2, repairedAt: Date.now() }));
        return false;
    }

    const oldTz = rawGet('noxcuse_timezone');
    const cfg = { ...defaultCfg(), tz: validTz(oldTz) ? oldTz : systemTz() };
    const today = dayKey(Date.now(), cfg.tz);
    const v1Sub = s => ({ id: str(s.id) || uid(), t: str(s.text), done: !!s.completed });
    const v1Subs = list => (Array.isArray(list) ? list.filter(s => isObj(s) && typeof s.text === 'string').map(v1Sub) : []);

    const tasks = [];
    const archive = [];
    const oldTasks = readRaw('noxcuse_tasks');
    for (const t of Array.isArray(oldTasks) ? oldTasks : []) {
        if (!isObj(t) || typeof t.text !== 'string') continue;
        const day = t.completed ? (typeof t.completedDate === 'string' ? t.completedDate : today) : null;
        const item = { id: str(t.id) || uid(), title: t.text, done: !!t.completed, doneAt: null, day, subs: v1Subs(t.subtasks) };
        if (item.done && day < today) archive.push(item);
        else tasks.push(item);
    }

    const oldBacklog = readRaw('noxcuse_backlog');
    const backlog = (Array.isArray(oldBacklog) ? oldBacklog : [])
        .filter(b => isObj(b) && typeof b.text === 'string')
        .map(b => ({ id: str(b.id) || uid(), title: b.text, subs: v1Subs(b.subtasks) }));

    const legacy = {};
    const daily = readRaw('noxcuse_daily_sessions');
    if (isObj(daily)) {
        if (isObj(daily.history)) Object.assign(legacy, daily.history);
        if (typeof daily.currentDate === 'string' && daily.currentSessions > 0) {
            legacy[daily.currentDate] = Math.max(+legacy[daily.currentDate] || 0, +daily.currentSessions);
        }
    }

    const sessions = [];
    let timer = null;
    const t = readRaw('noxcuse_timer');
    if (isObj(t) && !t.completed) {
        const mode = t.isBreak ? 'break' : 'focus';
        if (t.running && Number.isFinite(t.endAt)) {
            if (t.endAt > Date.now()) {
                const dur = mode === 'focus' ? 25 * 60 : (t.endAt - Date.now() > 5 * 60 * 1000 ? 15 * 60 : 5 * 60);
                timer = { mode, status: 'running', dur, endAt: t.endAt };
            } else if (mode === 'focus') {
                sessions.push({ id: 's' + t.endAt, start: t.endAt - 25 * 60 * 1000, end: t.endAt, taskId: null, task: '' });
                timer = { mode: 'focus', status: 'picking', dur: 25 * 60 };
            }
        } else if (!t.running && t.timeLeft > 0) {
            const dur = mode === 'focus' ? 25 * 60 : (t.timeLeft > 5 * 60 ? 15 * 60 : 5 * 60);
            timer = { mode, status: 'paused', dur, left: Math.min(dur, t.timeLeft) };
        }
    }

    write('cfg', cfg);
    write('tasks', tasks);
    write('backlog', backlog);
    write('archive', archive);
    write('sessions', sessions);
    write('legacy', SANITIZE.legacy(legacy));
    write('timer', timer);
    rawSet(META_KEY, JSON.stringify({ version: 2, migratedAt: Date.now(), from: oldTasks || oldBacklog || daily ? 1 : 0 }));
    return true;
}
