// View pieces shared by the desktop/tablet and mobile layouts.
import { html, focusOnce } from '../html.js';
import { icon } from '../icons.js';
import { LIMITS } from '../store.js';
import { timezoneList } from '../dates.js';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

export function dial(v) {
    return html`
        <div class="dial" role="timer" aria-label=${`${v.modeLabel} ${v.time}`}>
            ${v.leds.map(l => html`<i class=${cx('led', l.on && 'on')} style=${`--a:${l.deg}deg`}></i>`)}
            <div class="dial-c">
                <div class="dial-mode">${v.modeLabel}</div>
                <div class="dial-time">${v.time}</div>
                <div class=${cx('dial-sess', v.sessOver && 'over')}>${v.sessLabel}</div>
            </div>
        </div>`;
}

export const strip = (cells, cls = '') => html`<div class=${cx('strip', cls)}>${cells.map(c => html`<i class=${c}></i>`)}</div>`;

export function controls(a, v) {
    return html`
        <div class="ctl">
            <button class="ctl-sq" title="Reset (R)" aria-label="Reset timer" onClick=${a.reset}>
                <span class="fx-spin">${icon('reset', 20)}</span>
            </button>
            <button class="ctl-main" title="Space" onClick=${a.toggleRun}>
                ${icon(v.running ? 'pause' : 'play', 18)}${v.runLabel}
            </button>
            <button class="ctl-sq" title=${v.focus ? 'Stop (S)' : 'Skip break (S)'} aria-label=${v.focus ? 'Stop' : 'Skip break'}
                onClick=${v.focus ? a.stop : a.skipBreak}>
                ${v.focus ? html`<span class="fx-shrink">${icon('square', 18)}</span>` : html`<span class="fx-nudge">${icon('skip', 18)}</span>`}
            </button>
        </div>`;
}

// Enter that is not confirming an IME composition (Japanese, Chinese, ...)
export const isEnter = e => e.key === 'Enter' && !e.isComposing && e.keyCode !== 229;

export function editKeys(a) {
    return e => {
        if (isEnter(e)) {
            e.preventDefault();
            a.commitEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            a.cancelEdit();
        }
    };
}

export function editInput(a, v, cls, label) {
    return html`<input class=${cx('edit-in', cls)} ref=${focusOnce} value=${v.s.editVal} aria-label=${label}
        onInput=${e => a.setState({ editVal: e.target.value })} onKeyDown=${editKeys(a)} />`;
}

// Put on the element wrapping an edit input and its buttons: the edit is saved
// once focus leaves the whole group, so Tab can reach Delete / Move to backlog.
export const editGroup = a => e => {
    if (!e.currentTarget.contains(e.relatedTarget)) a.commitEdit();
};

// Button inside an edit group. Mouse: act on mousedown (before the input loses focus).
// Keyboard: act on the click that Enter / Space produce.
export const press = fn => ({
    onMouseDown: e => {
        e.preventDefault();
        fn();
    },
    onClick: e => {
        if (e.detail === 0) fn();
    }
});

// A title that opens the editor on double-click (or tap), and on Enter / F2 for keyboard users.
export function editable(onEdit, tap) {
    return {
        tabindex: '0',
        title: tap ? null : 'Double-click to edit',
        onClick: tap ? onEdit : null,
        onDblClick: tap ? null : onEdit,
        onKeyDown: e => {
            if (isEnter(e) || e.key === 'F2') {
                e.preventDefault();
                onEdit();
            }
        }
    };
}

export function subRow(a, v, t, x, variant) {
    const ed = v.s.editing;
    const editing = !!ed && ed.id === t.id && ed.sub === x.id;
    const tap = variant === 'm';
    return html`
        <div class=${cx('sub', variant, x.done && 'done')}>
            <button class="sub-box" role="checkbox" aria-checked=${x.done} aria-label=${x.t} onClick=${() => a.toggleSub(t.id, x.id)}><i></i></button>
            ${editing
                ? html`<div class="sub-edit" onFocusOut=${editGroup(a)}>
                    ${editInput(a, v, '', 'Subtask')}
                    <button class="del-x" title="Delete subtask" aria-label="Delete subtask" ...${press(() => a.removeSub(t.id, x.id))}>${icon('x', tap ? 16 : 13)}</button>
                </div>`
                : html`<span class="sub-t" ...${editable(() => a.startEdit(t.id, x.id, x.t), tap)}>${x.t}</span>`}
        </div>`;
}

export function subAdd(a, v, t, variant) {
    return html`
        <div class=${cx('sub-add', variant)}>
            ${icon('plus', variant === 'm' ? 16 : variant === 'now' ? 14 : 12)}
            <input placeholder="Add subtask" aria-label=${`Add subtask to ${t.title}`} value=${v.s.subDrafts[t.id] || ''}
                onInput=${e => { const val = e.target.value; a.setState(s => ({ subDrafts: { ...s.subDrafts, [t.id]: val } })); }}
                onKeyDown=${e => { if (isEnter(e)) a.addSub(t.id, e.target.value); }} />
        </div>`;
}

export function archiveLink(a, v, cls = '') {
    return html`<button class=${cx('arch-link', cls)} onClick=${a.archiveDone}>Archive ${v.doneCount} done${icon('arrowRight', 12)}</button>`;
}

export function stepper(a, v, key, unit, cls = '') {
    const [lo, hi, step] = LIMITS[key];
    const val = v.s.cfg[key];
    return html`
        <div class=${cx('stepper', cls)}>
            <button aria-label="Decrease" disabled=${val <= lo} onClick=${() => a.setCfg(key, Math.max(lo, val - step))}>−</button>
            <div class="stepper-v">${val}${unit ? html` <span>${unit}</span>` : null}</div>
            <button aria-label="Increase" disabled=${val >= hi} onClick=${() => a.setCfg(key, Math.min(hi, val + step))}>+</button>
        </div>`;
}

export function seg(options, value, onPick, cls = '') {
    return html`
        <div class=${cx('seg', cls)} role="tablist">
            ${options.map(([k, l]) => html`<button role="tab" aria-selected=${value === k} class=${cx(value === k && 'on')} onClick=${() => onPick(k)}>${l}</button>`)}
        </div>`;
}

const STEPS = [['focus', 'Focus', 'min'], ['short', 'Short break', 'min'], ['long', 'Long break', 'min'], ['target', 'Daily target', 'sess']];
const TOGGLES = [['sound', 'Sound when session ends'], ['autoBreak', 'Auto-start break'], ['notify', 'Browser notification']];

export function settingsBody(a, v, mobile) {
    const s = v.s;
    const cfg = s.cfg;
    return html`
        ${mobile ? null : html`<div class="sec-cap">TIMER</div>`}
        ${STEPS.map(([k, l, u]) => html`<div class="set-row"><span>${l}</span>${stepper(a, v, k, mobile ? '' : u)}</div>`)}
        ${mobile ? null : html`<div class="sec-cap">BEHAVIOUR</div>`}
        ${TOGGLES.map(([k, l]) => html`
            <button class="set-row toggle-row" role="switch" aria-checked=${cfg[k]} onClick=${() => a.setCfg(k, !cfg[k])}>
                <span>${l}</span><span class=${cx('switch', cfg[k] && 'on')}><i></i></span>
            </button>`)}
        ${mobile ? null : html`<div class="sec-cap">GENERAL</div>`}
        <div class="set-row"><span>Theme</span>${seg([['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], cfg.theme, k => a.setCfg('theme', k), 'sm')}</div>
        <label class="set-row"><span>Timezone</span>
            <select class="tz-select" value=${cfg.tz} onChange=${e => a.setCfg('tz', e.target.value)}>
                ${timezoneList(cfg.tz).map(tz => html`<option value=${tz}>${tz.replace(/_/g, ' ')}</option>`)}
            </select>
        </label>
        ${s.confirmReset ? html`
            <div class="confirm">
                <div class="confirm-t">${icon('warn', 16)}Reset all data?</div>
                <div class="confirm-b">This deletes every task, backlog item, archived task and session record in this browser. Export first if you want a backup.</div>
                <div class="btn-row">
                    <button class="btn" onClick=${() => a.setState({ confirmReset: false })}>Cancel</button>
                    <button class="btn danger-fill" onClick=${a.doReset}>Delete everything</button>
                </div>
            </div>` : html`
            <div class="btn-row data-row">
                <button class="btn" onClick=${a.exportData}>${icon('download', 14)}Export</button>
                <button class="btn" onClick=${a.importData}>${icon('upload', 14)}Import</button>
                <button class="btn danger" onClick=${() => a.setState({ confirmReset: true })}>${mobile ? 'Reset all data' : 'Reset all'}</button>
            </div>`}
        <div class="set-foot">All data lives in this browser’s local storage.</div>`;
}

export function archiveGroups(a, v, mobile) {
    const ar = v.arch;
    const hl = r => html`${r.pre}${r.hit ? html`<mark>${r.hit}</mark>` : null}${r.post}`;
    return html`
        ${ar.groups.map(g => html`
            <div class="ag">
                <div class="ag-head"><span>${g.date}</span>${mobile ? null : html`<span>${g.rows.length}</span>`}</div>
                ${g.rows.map(r => mobile ? html`
                    <div class="ag-row m">
                        <span class="ag-t">${hl(r)} <span class="ag-when">${r.when || r.meta}</span></span>
                        <button class="ag-restore-m" onClick=${() => a.restore(r.id)}>Restore</button>
                    </div>` : html`
                    <div class="ag-row">
                        <span class="chk on static">✓</span>
                        <span class="ag-t">${hl(r)}</span>
                        <span class="ag-when">${r.when}</span>
                        <span class="ag-meta">${r.meta}</span>
                        <button class="ag-restore" onClick=${() => a.restore(r.id)}>${icon('reset', 12)}Restore</button>
                    </div>`)}
            </div>`)}
        ${ar.found ? null : html`<div class="ag-empty">${ar.q.trim() ? `No completed task matches “${ar.q.trim()}”.` : 'Nothing archived yet. Finished tasks land here.'}</div>`}`;
}

export function searchBox(a, v) {
    return html`
        <label class="search">
            ${icon('search', 15)}
            <input placeholder="Search completed tasks" aria-label="Search completed tasks" value=${v.s.aq} onInput=${e => a.setState({ aq: e.target.value })} />
            ${v.s.aq ? html`<button class="search-x" aria-label="Clear search" onClick=${() => a.setState({ aq: '' })}>${icon('x', 14)}</button>` : null}
        </label>`;
}

export function breakChoices(a, v, sheet) {
    const cfg = v.s.cfg;
    return html`
        <div class=${cx('bp-head', v.bpOver ? 'danger' : 'accent')}>${v.bpHead}</div>
        <div class="bp-title">${v.bpTitle}</div>
        ${sheet ? null : strip(v.bpCells, 'bp-strip')}
        <div class="bp-opts">
            <button class="bp-opt primary" onClick=${() => a.startBreak(cfg.short)}><span>Short break · ${cfg.short} min</span>${sheet ? null : html`<kbd>1</kbd>`}</button>
            <button class="bp-opt" onClick=${() => a.startBreak(cfg.long)}><span>Long break · ${cfg.long} min</span>${sheet ? null : html`<kbd>2</kbd>`}</button>
            <button class="bp-opt dim" onClick=${a.skipBreak}><span>Skip, keep going</span>${sheet ? null : html`<kbd>3</kbd>`}</button>
        </div>`;
}

export function toast(v) {
    const t = v.s.toast;
    if (!t) return null;
    return html`
        <div class=${cx('toast', t.k)} role="status">
            ${t.k === 'over' ? icon('warn', 16) : icon('checkCircle', 16)}${t.text}
        </div>`;
}

export const fileInput = a => html`<input type="file" accept=".json,application/json" ref=${a.fileInput} onChange=${a.onFile} hidden />`;

export const closeBtn = (onClick, label = 'Close') => html`
    <button class="close" aria-label=${label} onClick=${onClick}><span class="fx-rot">${icon('x', 15)}</span></button>`;
