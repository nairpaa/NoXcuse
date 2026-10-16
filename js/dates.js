// Timezone-aware date helpers. Calendar math uses Date.UTC on plain (y, m, d)
// numbers so month arithmetic never overflows (e.g. 31 Oct + 1 month).

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MON3 = MONTHS.map(m => m.slice(0, 3));
export const DOW3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const DOW_TITLE = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const pad = n => String(n).padStart(2, '0');

export function systemTz() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

export function validTz(tz) {
    if (!tz || typeof tz !== 'string') return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

const formatters = new Map();
function partsFormatter(tz) {
    let f = formatters.get(tz);
    if (!f) {
        f = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
        });
        formatters.set(tz, f);
    }
    return f;
}

// { y, m (1-12), d, h (0-23), min } of an instant in the given timezone
export function parts(ms, tz) {
    const p = {};
    for (const { type, value } of partsFormatter(tz).formatToParts(ms)) p[type] = value;
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute };
}

export const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const splitKey = key => key.split('-').map(Number);

export function dayKey(ms, tz) {
    const p = parts(ms, tz);
    return keyOf(p.y, p.m, p.d);
}

export function hm(ms, tz) {
    const p = parts(ms, tz);
    return `${pad(p.h)}:${pad(p.min)}`;
}

export function minuteOfDay(ms, tz) {
    const p = parts(ms, tz);
    return p.h * 60 + p.min;
}

export const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const dowOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday

export function addDays(key, n) {
    const [y, m, d] = splitKey(key);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return keyOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function addMonths(y, m, n) {
    const abs = y * 12 + (m - 1) + n;
    return { y: Math.floor(abs / 12), m: (abs % 12) + 1 };
}

// "WED 14 OCT 2026"
export function dayLabel(key) {
    const [y, m, d] = splitKey(key);
    return `${DOW3[dowOf(y, m, d)]} ${d} ${MON3[m - 1].toUpperCase()} ${y}`;
}

// "Wed 14 Oct 2026"
export function dayTitle(key) {
    const [y, m, d] = splitKey(key);
    return `${DOW_TITLE[dowOf(y, m, d)]} ${d} ${MON3[m - 1]} ${y}`;
}

export function fmtDuration(minutes) {
    const m = Math.round(minutes);
    return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}

// Supported zones, always including the active one (some engines omit e.g. "UTC").
let zones = null;
export function timezoneList(current) {
    if (!zones) {
        try {
            zones = Intl.supportedValuesOf('timeZone');
        } catch {
            zones = [];
        }
    }
    return current && !zones.includes(current) ? [current, ...zones] : zones;
}
