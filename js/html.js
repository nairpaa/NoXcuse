import { h } from './vendor/preact.module.js';
import htm from './vendor/htm.module.js';

export const html = htm.bind(h);

// Focus (and place the caret at the end of) an input the first time it mounts.
export function focusOnce(el) {
    if (!el || el.dataset.focused) return;
    el.dataset.focused = '1';
    el.focus();
    if (typeof el.setSelectionRange === 'function') el.setSelectionRange(el.value.length, el.value.length);
}
