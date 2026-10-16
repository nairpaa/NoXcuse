// Mobile (<700px) layout: bottom tab bar with Timer, Tasks, Calendar, More.
import { html } from '../html.js';
import { icon } from '../icons.js';
import { dial, strip, controls, cx, editInput, editGroup, editable, press, isEnter, subRow, subAdd, archiveLink, stepper, seg, settingsBody, archiveGroups, searchBox, breakChoices, toast, fileInput } from './parts.js';

const TABS = [['timer', 'Timer', 'timer'], ['tasks', 'Tasks', 'listChecks'], ['calendar', 'Calendar', 'calendar'], ['more', 'More', 'more']];

export function renderMobile(a, v) {
    const s = v.s;
    const page = v.page;
    const title = { timer: v.dateShort, tasks: 'TASKS', calendar: 'CALENDAR', more: 'MORE' }[page];
    return html`
        <div class="nxm" data-mode=${v.focus ? 'focus' : 'break'} data-device="mobile" style=${`--dial:${v.size.dial}px`}>
            <header class="m-top">
                <div class="logo sm">No<span>X</span>cuse</div>
                <span class="cap muted">${title}</span>
            </header>
            <main class="m-main">
                ${page === 'timer' ? timerPage(a, v) : null}
                ${page === 'tasks' ? tasksPage(a, v) : null}
                ${page === 'calendar' ? calendarPage(a, v) : null}
                ${page === 'more' ? morePage(a, v) : null}
                ${v.showBreakPick ? html`
                    <div class="scrim"></div>
                    <div class="sheet" role="dialog" aria-label="Pick a break">${breakChoices(a, v, true)}</div>` : null}
                ${toast(v)}
                ${fileInput(a)}
            </main>
            <nav class="m-tabs" aria-label="Main">
                ${TABS.map(([k, l, ic]) => html`
                    <button class=${cx(page === k && 'on')} aria-current=${page === k ? 'page' : null} onClick=${() => a.go(k)}>${icon(ic, 20)}${l}</button>`)}
            </nav>
        </div>`;
}

function timerPage(a, v) {
    const t = v.nowTask;
    const done = t ? t.subs.filter(x => x.done).length : 0;
    const meta = t
        ? `${t.subs.length ? `${done}/${t.subs.length} subtasks` : 'No subtasks'} · ${Math.max(0, v.openCount - 1)} up next`
        : 'Tap to add your first task';
    return html`
        <div class="m-page m-timer">
            ${dial(v)}
            ${strip(v.cells, 'm')}
            ${controls(a, v)}
            <button class="m-now" onClick=${() => a.go('tasks')}>
                <div class="cap acc spread">${v.focus ? 'NOW' : 'AFTER THIS BREAK'}<span class="muted">${t ? `${v.spentOf(t.id)} SESSIONS SPENT` : ''}</span></div>
                <div class="m-now-t">${t ? t.title : v.tasks.length ? 'All clear.' : 'No tasks yet'}</div>
                <div class="m-now-m">${meta}</div>
            </button>
        </div>`;
}

// Touch-friendly reorder: press the grip, slide over another row, release.
function gripDown(a, id, e) {
    e.preventDefault();
    const el = e.currentTarget;
    try {
        el.setPointerCapture(e.pointerId);
    } catch {
        // pointer capture unsupported
    }
    a.setState({ drag: { id, over: id, touch: true } });
    const move = ev => {
        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        const row = hit && hit.closest && hit.closest('[data-tid]');
        const d = a.state.drag;
        if (row && d && row.dataset.tid !== d.over) a.setState({ drag: { ...d, over: row.dataset.tid } });
    };
    const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        const d = a.state.drag;
        if (d) a.moveTask(d.id, d.over);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
}

function taskRow(a, v, t, i) {
    const s = v.s;
    const ed = s.editing;
    const editing = !!ed && ed.id === t.id && ed.sub == null;
    const exp = !!s.expanded[t.id];
    const done = t.subs.filter(x => x.done).length;
    const d = s.drag;
    let line = '';
    if (d && d.touch && d.over === t.id && d.id !== t.id) line = v.tasks.findIndex(x => x.id === d.id) > i ? 'line-top' : 'line-bot';
    return html`
        <div class=${cx('mt', t.done && 'done', d && d.id === t.id && 'dragging', line)} data-tid=${t.id}>
            <div class="mt-row">
                <span class="mt-grip" aria-label="Drag to reorder" onPointerDown=${e => gripDown(a, t.id, e)}>${icon('grip', 16)}</span>
                <button class=${cx('chk', 'lg', t.done && 'on')} role="checkbox" aria-checked=${t.done} aria-label=${t.title} onClick=${() => a.toggleTask(t.id)}>${t.done ? '✓' : ''}</button>
                ${editing ? html`
                    <div class="mt-edit" onFocusOut=${editGroup(a)}>
                        ${editInput(a, v, '', 'Task title')}
                        <button class="del-x neutral" aria-label="Move to backlog" ...${press(() => a.taskToBacklog(t.id))}>${icon('inbox', 16)}</button>
                        <button class="del-x" aria-label="Delete task" ...${press(() => a.removeTask(t.id))}>${icon('trash', 16)}</button>
                    </div>` : html`
                    <span class="mt-title" ...${editable(() => a.startEdit(t.id, null, t.title), true)}>${t.title}</span>`}
                <span class="mt-meta">${t.subs.length ? `${done}/${t.subs.length}` : ''}</span>
                <button class=${cx('chev', 'mt-chev', t.subs.length && 'has', exp && 'open')} aria-label=${exp ? 'Collapse subtasks' : 'Expand subtasks'} aria-expanded=${exp}
                    onClick=${() => a.setState(x => ({ expanded: { ...x.expanded, [t.id]: !x.expanded[t.id] } }))}>${icon('chevronRight', 16)}</button>
            </div>
            ${exp ? html`
                <div class="mt-subs">
                    ${t.subs.map(x => subRow(a, v, t, x, 'm'))}
                    ${subAdd(a, v, t, 'm')}
                </div>` : null}
        </div>`;
}

function tasksPage(a, v) {
    const s = v.s;
    const today = s.mtab === 'today';
    return html`
        <div class="m-page m-tasks">
            ${seg([['today', html`Today <span class="cap muted">${v.openCount}</span>`], ['backlog', html`Backlog <span class="cap muted">${s.backlog.length}</span>`]], s.mtab, k => a.setState({ mtab: k }), 'm-tabs-seg')}
            ${today ? html`
                <div class="field m">
                    <span>+</span>
                    <input placeholder="Add task" aria-label="Add task" value=${s.draft}
                        onInput=${e => a.setState({ draft: e.target.value })}
                        onKeyDown=${e => { if (isEnter(e) && e.target.value.trim()) { a.addTask(e.target.value); a.setState({ draft: '' }); } }} />
                </div>
                ${v.tasks.map((t, i) => taskRow(a, v, t, i))}
                ${v.tasks.length ? null : html`<div class="m-empty"><b>Nothing here yet.</b><span>Add your first task above. Then hit Start.</span></div>`}
                ${v.doneCount ? archiveLink(a, v, 'm') : null}` : html`
                <div class="field m">
                    <span>+</span>
                    <input placeholder="Add to backlog" aria-label="Add to backlog" value=${s.bdraft}
                        onInput=${e => a.setState({ bdraft: e.target.value })}
                        onKeyDown=${e => { if (isEnter(e)) a.addBacklog(e.target.value); }} />
                </div>
                ${s.backlog.map(b => html`
                    <div class="mb-row">
                        <span class="mb-t">${b.title}${b.subs.length ? html` <span class="cap muted">${b.subs.length} sub</span>` : null}</span>
                        <button class="to-today m" onClick=${() => a.backlogToToday(b.id)}>Today${icon('arrowRight', 14)}</button>
                        <button class="del-x muted m" aria-label=${`Remove ${b.title}`} onClick=${() => a.removeBacklog(b.id)}>${icon('x', 16)}</button>
                    </div>`)}
                ${s.backlog.length ? null : html`<div class="m-empty"><span>Nothing parked. Ideas for later go here.</span></div>`}`}
        </div>`;
}

function calendarPage(a, v) {
    const c = v.cal;
    const sel = c.sel;
    return html`
        <div class="m-page m-cal">
            <div class="spread">
                <div class="mnav m">
                    <button class="sq-nav m" aria-label="Previous month" onClick=${() => a.shiftMonth(-1)}>${icon('chevronLeft', 16)}</button>
                    <span class="mlabel">${c.monthShort}</span>
                    <button class="sq-nav m" aria-label="Next month" disabled=${c.isCur} onClick=${() => a.shiftMonth(1)}>${icon('chevronRight', 16)}</button>
                </div>
                ${stepper(a, v, 'target', '/ day', 'm')}
            </div>
            <div class="stats m">
                ${c.stats.filter((_, k) => k !== 1).map(st => html`<div class="stat"><span class="cap muted">${st.l}</span><span class="stat-v">${st.v}</span></div>`)}
            </div>
            <div class="tl m">
                <div class="tl-grid-row tl-head"><span></span><div class="tl-axis">${c.hours.map(hr => html`<span style=${`left:${hr.l}%`}>${hr.t}</span>`)}</div><span></span></div>
                ${c.rows.map(r => html`
                    <div class=${cx('tl-grid-row', 'tl-row', r.sel && 'sel')} role="button" tabindex="0" onClick=${() => a.pickDay(r.key)}>
                        <span class=${cx('tl-name', r.today ? 'today' : r.sel && 'on')}>${r.name}</span>
                        <div class="tl-track">${r.blocks.map(b => html`<i class=${cx('tl-b', b.over && 'over')} title=${b.tip} style=${`left:${b.l}%;width:${b.w}%`}></i>`)}</div>
                        <span class=${cx('tl-tot', r.hit ? 'hit' : r.any && 'any')}>${r.tot}</span>
                    </div>`)}
            </div>
            <div class="m-card">
                <div class="cap muted">${sel.name}</div>
                <div class="m-sel">
                    <span class="m-sel-n">${sel.n}</span><span class="sel-of">/ ${v.target}</span>
                    <span class=${cx('sel-status', sel.tone)}>${sel.status}</span>
                </div>
                ${sel.log.map(g => html`<div class="m-sel-row"><span class="m-dot dim"></span><span class="grow">${g.task}</span><span class="cap muted">${g.span} · ${g.cnt}</span></div>`)}
                ${sel.completed.map(t => html`<div class="m-sel-row"><span class="m-dot"></span><span class="grow">${t.title}</span><span class="cap muted">${t.at}</span></div>`)}
            </div>
        </div>`;
}

function morePage(a, v) {
    const ar = v.arch;
    return html`
        <div class="m-page m-more">
            <div class="spread base"><span class="m-h">Archive</span><span class="cap muted">${ar.found} TASKS</span></div>
            ${searchBox(a, v)}
            ${seg([['day', 'Day'], ['month', 'Month'], ['year', 'Year']], ar.mode, k => a.setState({ agroup: k }), 'full')}
            ${archiveGroups(a, v, true)}
            <div class="m-h sp">Settings</div>
            <div class="m-settings">${settingsBody(a, v, true)}</div>
        </div>`;
}
