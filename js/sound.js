// Session-end beeps (Web Audio) and browser notifications.

let ctx = null;

function audio() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
    }
    return ctx;
}

// Browsers only allow audio after a user gesture; call this from one.
export function unlockAudio() {
    try {
        const a = audio();
        if (a && a.state === 'suspended') a.resume();
    } catch {
        // audio unavailable
    }
}

const NOTES = {
    done: [660, 880],
    target: [660, 880, 1320],
    over: [520, 390],
    break: [880, 660]
};

export function beep(kind = 'done') {
    try {
        const a = audio();
        if (!a) return;
        if (a.state === 'suspended') a.resume();
        (NOTES[kind] || NOTES.done).forEach((freq, i) => {
            const t0 = a.currentTime + i * 0.16;
            const osc = a.createOscillator();
            const gain = a.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
            osc.connect(gain);
            gain.connect(a.destination);
            osc.start(t0);
            osc.stop(t0 + 0.32);
        });
    } catch {
        // audio unavailable
    }
}

export const notifySupported = () => 'Notification' in window;

export async function requestNotify() {
    if (!notifySupported()) return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    try {
        return await Notification.requestPermission();
    } catch {
        return 'denied';
    }
}

export function notify(title, body) {
    if (!notifySupported() || Notification.permission !== 'granted') return;
    try {
        const n = new Notification(title, { body, icon: 'assets/icons/icon-192.png', tag: 'noxcuse', renotify: true });
        n.onclick = () => {
            window.focus();
            n.close();
        };
    } catch {
        // some mobile browsers only allow notifications from a service worker
    }
}
