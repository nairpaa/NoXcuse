// Desktop (≥1000px) and tablet (700–999px, stacked panels) layouts.
import { html } from '../html.js';
import { icon } from '../icons.js';
import { dial, strip, controls, cx, editInput, editGroup, editable, press, isEnter, subRow, subAdd, archiveLink, stepper, seg, settingsBody, archiveGroups, searchBox, breakChoices, toast, fileInput, closeBtn } from './parts.js';

const NAV = [['timer', 'Timer', 'timer'], ['calendar', 'Calendar', 'calendar'], ['archive', 'Archive', 'archive'], ['backlog', 'Backlog', 'inbox'], ['settings', 'Settings', 'sliders']];

const KEYS = [
    ['Start / pause', ['Space']], ['Reset timer', ['R']], ['Stop · skip break', ['S']], ['Pick break', ['1', '2', '3']],
    ['New task', ['N']], ['Timer', ['T']], ['Calendar', ['C']], ['Archive', ['A']],
    ['Backlog', ['B']], ['Settings', [',']], ['Shortcuts', ['?']], ['Close panel', ['Esc']]
];

export function renderDesktop(a, v) {
    const s = v.s;
    const page = v.page;
    const tablet = v.device === 'tablet';
    return html`
        <div class="nx" data-mode=${v.focus ? 'focus' : 'break'} data-device=${v.device}
            style=${`--dial:${v.size.dial}px;--panel-h:${v.size.panelH}px`}>
            <header class="top">
                <div class="logo">No<span>X</span>cuse</div>
                <nav class="nav" aria-label="Main">
                    ${NAV.map(([k, l, ic]) => {
                        const isOv = k === 'backlog' || k === 'settings';
                        const on = isOv ? s.overlay === k : page === k && s.overlay !== 'backlog' && s.overlay !== 'settings';
                        return html`<button class=${cx('nav-i', on && 'on')} aria-current=${on ? 'page' : null}
                            onClick=${() => (isOv ? a.toggleOverlay(k) : a.go(k))}>${icon(ic, 16)}${l}</button>`;
                    })}
                </nav>
                <div class="top-r">
                    ${tablet ? null : html`<span class="top-date">${v.dateTitle}</span>`}
                    <button class="kbtn" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick=${() => a.toggleOverlay('keys')}>?</button>
                </div>
            </header>
            <main class="main">
                ${page === 'timer' ? timerPage(a, v) : null}
                ${page === 'calendar' ? calendarPage(a, v) : null}
                ${page === 'archive' ? archivePage(a, v) : null}
                ${s.overlay === 'backlog' ? backlogDrawer(a, v) : null}
                ${s.overlay === 'settings' ? settingsModal(a, v) : null}
                ${v.showBreakPick && page === 'timer' ? html`
                    <div class="scrim dark center">
                        <div class="modal bp" role="dialog" aria-label="Pick a break">${breakChoices(a, v, false)}</div>
                    </div>` : null}
                ${s.overlay === 'keys' ? keysModal(a) : null}
                ${toast(v)}
                ${fileInput(a)}
            </main>
        </div>`;
}

// ---------- timer ----------

function timerPage(a, v) {
    return html`
        <section class="tp">
            <div class="tp-main">
                ${dial(v)}
                <div class="tp-strip">
                    ${strip(v.cells)}
                    <div class="cap muted">${v.sessCount} SESSIONS TODAY · ${v.focusedToday} FOCUSED</div>
                </div>
                ${controls(a, v)}
            </div>
            <aside class="panel tp-panel">${v.nowTask ? nowPanel(a, v) : emptyPanel(a, v)}</aside>
        </section>`;
}

function addField(a, v, cls, placeholder) {
    return html`<input ref=${a.addInput} class=${cls} placeholder=${placeholder} aria-label="Add task" value=${v.s.draft}
        onInput=${e => a.setState({ draft: e.target.value })}
        onKeyDown=${e => { if (isEnter(e) && e.target.value.trim()) { a.addTask(e.target.value); a.setState({ draft: '' }); } }} />`;
}

function emptyPanel(a, v) {
    const any = v.tasks.length > 0;
    const keys = [['New task', 'N'], ['Start focus', 'Space'], ['Open backlog', 'B'], ['All shortcuts', '?']];
    return html`
        <div class="empty">
            <div class="cap accent">${any ? 'ALL DONE' : 'GET STARTED'}</div>
            <div class="empty-title">${any ? 'All clear. What’s next?' : 'What are you working on?'}</div>
            <div class="empty-sub">Add a task, press Space, and the first ${v.s.cfg.focus} minutes start.</div>
            <div class="empty-add">${icon('plus', 16)}${addField(a, v, '', 'What are you working on?')}<kbd>↵</kbd></div>
            ${v.doneCount ? archiveLink(a, v) : null}
            <div class="empty-keys">${keys.map(([l, k]) => html`<div>${l}<kbd>${k}</kbd></div>`)}</div>
        </div>`;
}

function nowPanel(a, v) {
    const s = v.s;
    const t = v.nowTask;
    const ed = s.editing;
    const editingTitle = !!ed && ed.id === t.id && ed.sub == null;
    const done = t.subs.filter(x => x.done).length;
    const pct = t.subs.length ? Math.round((done / t.subs.length) * 100) : 0;
    return html`
        <div class="cap acc spread">${v.focus ? 'NOW' : 'AFTER THIS BREAK'}<span class="muted">${v.spentOf(t.id)} SESSIONS SPENT</span></div>
        ${editingTitle ? html`
            <div class="now-edit" onFocusOut=${editGroup(a)}>
                ${editInput(a, v, 'big', 'Task title')}
                <button class="sq-btn" title="Move to backlog" aria-label="Move to backlog" ...${press(() => a.taskToBacklog(t.id))}>${icon('inbox', 14)}</button>
                <button class="sq-btn danger" title="Delete task" aria-label="Delete task" ...${press(() => a.removeTask(t.id))}>${icon('trash', 14)}</button>
            </div>
            <div class="hint">ENTER SAVE · ESC CANCEL</div>` : html`
            <div class="now-row">
                <div class="now-title" ...${editable(() => a.startEdit(t.id, null, t.title))}>${t.title}</div>
                <button class="icon-btn" title="Edit task" aria-label="Edit task" onClick=${() => a.startEdit(t.id, null, t.title)}>${icon('pencil', 14)}</button>
            </div>`}
        <div class="subhead">
            <span>${t.subs.length ? `SUBTASKS · ${done}/${t.subs.length}` : 'SUBTASKS'}</span>
            <div class="bar"><i style=${`width:${pct}%`}></i></div>
        </div>
        <div class="now-subs">
            ${t.subs.map(x => subRow(a, v, t, x, 'now'))}
            ${subAdd(a, v, t, 'now')}
        </div>
        <div class="upnext spread"><span class="cap muted">UP NEXT</span>${v.doneCount ? archiveLink(a, v) : null}</div>
        <div class="queue">${v.tasks.filter(x => x !== t).map(x => queueRow(a, v, x))}</div>
        <div class="addbar"><span class="addbar-plus">+</span>${addField(a, v, '', 'Add task')}<kbd>↵</kbd></div>`;
}

function queueRow(a, v, t) {
    const s = v.s;
    const ed = s.editing;
    const editing = !!ed && ed.id === t.id && ed.sub == null;
    const exp = !!s.expanded[t.id];
    const done = t.subs.filter(x => x.done).length;
    const drag = s.drag;
    let line = '';
    if (drag && drag.over === t.id && drag.id !== t.id) {
        const from = v.tasks.findIndex(x => x.id === drag.id);
        const to = v.tasks.findIndex(x => x.id === t.id);
        line = from > to ? 'line-top' : 'line-bot';
    }
    return html`
        <div class=${cx('q', t.done && 'done', drag && drag.id === t.id && 'dragging', line)}
            draggable=${!!drag && drag.armed === t.id && !editing}
            onDragStart=${e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); a.setState({ drag: { id: t.id, over: null, armed: t.id } }); }}
            onDragOver=${e => { const d = a.state.drag; if (!d || !d.id) return; e.preventDefault(); if (d.over !== t.id) a.setState({ drag: { ...d, over: t.id } }); }}
            onDrop=${e => { e.preventDefault(); const d = a.state.drag; if (d && d.id) a.moveTask(d.id, t.id); }}
            onDragEnd=${() => a.setState({ drag: null })}>
            <div class="q-row">
                <span class="grip" title="Drag to reorder" onPointerDown=${() => a.setState({ drag: { armed: t.id } })}
                    onPointerUp=${() => { if (a.state.drag && !a.state.drag.id) a.setState({ drag: null }); }}>${icon('grip', 14)}</span>
                <button class=${cx('chev', t.subs.length && 'has', exp && 'open')} aria-label=${exp ? 'Collapse subtasks' : 'Expand subtasks'} aria-expanded=${exp}
                    onClick=${() => a.setState(x => ({ expanded: { ...x.expanded, [t.id]: !x.expanded[t.id] } }))}>${icon('chevronRight', 14)}</button>
                <button class=${cx('chk', t.done && 'on')} role="checkbox" aria-checked=${t.done} aria-label=${t.title} onClick=${() => a.toggleTask(t.id)}>${t.done ? '✓' : ''}</button>
                ${editing ? html`
                    <div class="q-edit" onFocusOut=${editGroup(a)}>
                        ${editInput(a, v, '', 'Task title')}
                        <button class="del-x neutral" title="Move to backlog" aria-label="Move to backlog" ...${press(() => a.taskToBacklog(t.id))}>${icon('inbox', 13)}</button>
                        <button class="del-x" title="Delete task" aria-label="Delete task" ...${press(() => a.removeTask(t.id))}>${icon('trash', 13)}</button>
                    </div>` : html`
                    <span class="q-title" ...${editable(() => a.startEdit(t.id, null, t.title))}>${t.title}</span>`}
                <div class="q-meta">
                    ${t.subs.length ? html`<div class="mini"><i style=${`width:${Math.round((done / t.subs.length) * 100)}%`}></i></div>` : null}
                    <span>${t.subs.length ? `${done}/${t.subs.length}` : ''}</span>
                </div>
            </div>
            ${exp ? html`
                <div class="q-subs">
                    ${t.subs.map(x => subRow(a, v, t, x, 'q'))}
                    ${subAdd(a, v, t, 'q')}
                </div>` : null}
        </div>`;
}

// ---------- calendar ----------

function calendarPage(a, v) {
    const c = v.cal;
    const sel = c.sel;
    const pick = key => a.pickDay(key);
    return html`
        <section class="cp">
            <div class="cp-main">
                <div class="spread">
                    <div class="mnav">
                        <button class="sq-nav" title="Previous month" aria-label="Previous month" onClick=${() => a.shiftMonth(-1)}><span class="fx-left">${icon('chevronLeft', 16)}</span></button>
                        <span class="mlabel">${c.monthLabel}</span>
                        <button class="sq-nav" title="Next month" aria-label="Next month" disabled=${c.isCur} onClick=${() => a.shiftMonth(1)}><span class="fx-right">${icon('chevronRight', 16)}</span></button>
                    </div>
                    <div class="tgt"><span>Daily target</span>${stepper(a, v, 'target', 'sess', 'sm')}</div>
                </div>
                <div class="stats">
                    ${c.stats.map(st => html`<div class="stat"><span class="cap muted">${st.l}</span><span class="stat-v">${st.v}</span><span class="stat-s">${st.sub}</span></div>`)}
                </div>
                <div class="tl">
                    <div class="tl-grid-row tl-head">
                        <span></span>
                        <div class="tl-axis">${c.hours.map(hr => html`<span style=${`left:${hr.l}%`}>${hr.t}</span>`)}</div>
                        <span class="tl-sess">SESS</span>
                    </div>
                    <div class="tl-rows">
                        ${c.rows.map(r => html`
                            <div class=${cx('tl-grid-row', 'tl-row', r.sel && 'sel')} role="button" tabindex="0" aria-label=${`${r.name}: ${r.tot} sessions`}
                                onClick=${() => pick(r.key)} onKeyDown=${e => { if (e.key === 'Enter') pick(r.key); }}>
                                <span class=${cx('tl-name', r.today ? 'today' : r.sel && 'on')}>${r.name}</span>
                                <div class="tl-track">
                                    ${c.hours.map(hr => html`<i class="tl-tick" style=${`left:${hr.l}%`}></i>`)}
                                    ${r.blocks.map(b => html`<i class=${cx('tl-b', b.over && 'over')} title=${b.tip} style=${`left:${b.l}%;width:${b.w}%`}></i>`)}
                                </div>
                                <span class=${cx('tl-tot', r.hit ? 'hit' : r.any && 'any')}
                                    title=${r.legacyN ? `${r.legacyN} session(s) from before the redesign have no time data` : null}>${r.tot}</span>
                            </div>`)}
                    </div>
                </div>
                <div class="legend">
                    <span><i class="sw accent"></i>1 block = 1 session, placed at the time it ran</span>
                    <span><b class="accent">${v.target}/${v.target}</b>target hit</span>
                    <span><i class="sw danger"></i>overtime</span>
                </div>
            </div>
            <aside class="panel cp-panel">
                <div class="cap muted">${sel.name}</div>
                <div class="sel-big"><span>${sel.n}</span><span class="sel-of">/ ${v.target}</span></div>
                <div class=${cx('sel-status', sel.tone)}>${sel.status}</div>
                ${strip(sel.cells, 'sm')}
                <div class="sel-focus">${sel.focused}</div>
                ${sel.log.length ? html`
                    <div class="sec-cap">FOCUSED ON</div>
                    ${sel.log.map(g => html`
                        <div class="log-row">
                            <div class="log-t"><span>${g.task}</span><span class="cap muted">${g.span}</span></div>
                            <span class="log-n">${g.cnt}</span>
                        </div>`)}` : null}
                <div class="sec-cap">COMPLETED</div>
                <div class="sel-list">
                    ${sel.completed.map(t => html`<div class="done-row"><span class="chk on static">✓</span><span>${t.title}</span><span class="cap muted">${t.at}</span></div>`)}
                    ${sel.completed.length ? null : html`<div class="none">Nothing completed.</div>`}
                </div>
                <div class="l14">
                    <div class="spread cap muted"><span>LAST 14 DAYS</span><span>TARGET ${v.target}</span></div>
                    <div class="l14-bars">
                        <i class="l14-tgt" style=${`bottom:${c.tgtPct}%`}></i>
                        ${c.bars.map(b => html`<button class=${cx('l14-bar', b.kind, b.sel && 'sel')} style=${`height:${b.h}%`} aria-label=${`Day ${b.d}`} onClick=${() => pick(b.key)}></button>`)}
                    </div>
                    <div class="l14-days">${c.bars.map(b => html`<span class=${cx(b.sel && 'sel')}>${b.d}</span>`)}</div>
                </div>
            </aside>
        </section>`;
}

// ---------- archive ----------

function archivePage(a, v) {
    const ar = v.arch;
    const sc = v.s.ascope;
    return html`
        <section class="ap">
            <nav class="ap-side" aria-label="Archive periods">
                <button class=${cx('ap-i', !sc && 'on')} onClick=${() => a.setState({ ascope: null })}>All time<span>${ar.total}</span></button>
                ${ar.years.map(yr => html`
                    <div class="ap-year">
                        <button class=${cx('ap-i', 'mono', yr.on && 'on')} onClick=${() => a.setState({ ascope: { y: yr.y, m: null } })}>${yr.y}<span>${yr.count}</span></button>
                        <div class="ap-months">
                            ${yr.months.map(mo => html`<button class=${cx('ap-i', 'month', mo.on && 'on')} onClick=${() => a.setState({ ascope: { y: yr.y, m: mo.m } })}>${mo.l}<span>${mo.count}</span></button>`)}
                        </div>
                    </div>`)}
            </nav>
            <div class="ap-main">
                <div class="ap-head">
                    <div class="spread base"><span class="ap-title">${ar.scopeLabel}</span><span class="cap muted">${ar.found} TASKS</span></div>
                    <div class="ap-tools">
                        ${searchBox(a, v)}
                        ${seg([['day', 'Day'], ['month', 'Month'], ['year', 'Year']], ar.mode, k => a.setState({ agroup: k }))}
                    </div>
                </div>
                <div class="ap-list">${archiveGroups(a, v, false)}</div>
            </div>
        </section>`;
}

// ---------- overlays ----------

function backlogDrawer(a, v) {
    const s = v.s;
    const close = () => a.setState({ overlay: null });
    const bd = s.bdrag;
    return html`
        <div class="scrim light" onClick=${close}></div>
        <aside class="drawer" role="dialog" aria-label="Backlog">
            <div class="spread">
                <div class="dr-title">Backlog<span>${s.backlog.length}</span></div>
                ${closeBtn(close, 'Close backlog')}
            </div>
            <div class="dr-sub">Later, not never.</div>
            <div class="field">
                <span>+</span>
                <input placeholder="Add to backlog" aria-label="Add to backlog" value=${s.bdraft}
                    onInput=${e => a.setState({ bdraft: e.target.value })}
                    onKeyDown=${e => { if (isEnter(e)) a.addBacklog(e.target.value); }} />
            </div>
            <div class="bl">
                ${s.backlog.map((b, i) => {
                    let line = '';
                    if (bd && bd.over === b.id && bd.id !== b.id) line = s.backlog.findIndex(x => x.id === bd.id) > i ? 'line-top' : 'line-bot';
                    return html`
                        <div class=${cx('bl-row', bd && bd.id === b.id && 'dragging', line)}
                            draggable=${!!bd && bd.armed === b.id}
                            onDragStart=${e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', b.id); a.setState({ bdrag: { id: b.id, over: null, armed: b.id } }); }}
                            onDragOver=${e => { const d = a.state.bdrag; if (!d || !d.id) return; e.preventDefault(); if (d.over !== b.id) a.setState({ bdrag: { ...d, over: b.id } }); }}
                            onDrop=${e => { e.preventDefault(); const d = a.state.bdrag; if (d && d.id) a.moveBacklog(d.id, b.id); }}
                            onDragEnd=${() => a.setState({ bdrag: null })}>
                            <span class="bl-grip" title="Drag to reorder" onPointerDown=${() => a.setState({ bdrag: { armed: b.id } })}>⋮⋮</span>
                            <span class="bl-t">${b.title}${b.subs.length ? html` <span class="cap muted">${b.subs.length} sub</span>` : null}</span>
                            <button class="to-today" onClick=${() => a.backlogToToday(b.id)}>Today${icon('arrowRight', 13)}</button>
                            <button class="del-x muted" aria-label=${`Remove ${b.title}`} onClick=${() => a.removeBacklog(b.id)}>${icon('x', 13)}</button>
                        </div>`;
                })}
                ${s.backlog.length ? null : html`<div class="none">Nothing parked. Ideas for later go here.</div>`}
            </div>
        </aside>`;
}

function settingsModal(a, v) {
    const close = () => a.setState({ overlay: null, confirmReset: false });
    return html`
        <div class="scrim center" onClick=${e => { if (e.target === e.currentTarget) close(); }}>
            <div class="modal settings" role="dialog" aria-label="Settings">
                <div class="spread"><span class="modal-title">Settings</span>${closeBtn(close, 'Close settings')}</div>
                ${settingsBody(a, v, false)}
            </div>
        </div>`;
}

function keysModal(a) {
    const close = () => a.setState({ overlay: null });
    return html`
        <div class="scrim center" onClick=${close}>
            <div class="modal keys" role="dialog" aria-label="Keyboard shortcuts" onClick=${e => e.stopPropagation()}>
                <div class="spread"><span class="modal-title">Keyboard shortcuts</span>${closeBtn(close)}</div>
                <div class="keys-grid">
                    ${KEYS.map(([l, ks]) => html`<div class="key-row">${l}<span>${ks.map(k => html`<kbd>${k}</kbd>`)}</span></div>`)}
                </div>
                <div class="set-foot">Shortcuts pause while you type in a text field.</div>
            </div>
        </div>`;
}
