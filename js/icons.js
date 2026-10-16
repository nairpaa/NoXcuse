// Lucide icons (https://lucide.dev), as used in the design.
import { h } from './vendor/preact.module.js';

const P = d => ['path', { d }];
const L = (x1, y1, x2, y2) => ['line', { x1, y1, x2, y2 }];
const C = (cx, cy, r) => ['circle', { cx, cy, r }];
const R = (x, y, width, height, rx) => ['rect', { x, y, width, height, rx }];
const PL = points => ['polyline', { points }];
const PG = points => ['polygon', { points }];

const ICONS = {
    timer: [L(10, 2, 14, 2), L(12, 14, 15, 11), C(12, 14, 8)],
    calendar: [P('M8 2v4'), P('M16 2v4'), R(3, 4, 18, 18, 2), P('M3 10h18')],
    archive: [R(2, 3, 20, 5, 1), P('M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8'), P('M10 12h4')],
    inbox: [PL('22 12 16 12 14 15 10 15 8 12 2 12'), P('M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z')],
    sliders: [P('M20 7h-9'), P('M14 17H5'), C(17, 17, 3), C(7, 7, 3)],
    reset: [P('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'), P('M3 3v5h5')],
    play: [PG('6 3 20 12 6 21 6 3')],
    pause: [R(14, 4, 4, 16, 1), R(6, 4, 4, 16, 1)],
    square: [R(4, 4, 16, 16, 2)],
    skip: [PG('5 4 15 12 5 20 5 4'), L(19, 5, 19, 19)],
    plus: [P('M5 12h14'), P('M12 5v14')],
    arrowRight: [P('M5 12h14'), P('m12 5 7 7-7 7')],
    pencil: [P('M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z')],
    trash: [P('M3 6h18'), P('M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'), P('M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2')],
    x: [P('M18 6 6 18'), P('m6 6 12 12')],
    grip: [C(9, 12, 1), C(9, 5, 1), C(9, 19, 1), C(15, 12, 1), C(15, 5, 1), C(15, 19, 1)],
    chevronRight: [P('m9 18 6-6-6-6')],
    chevronLeft: [P('m15 18-6-6 6-6')],
    search: [C(11, 11, 8), P('m21 21-4.3-4.3')],
    download: [P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), PL('7 10 12 15 17 10'), L(12, 15, 12, 3)],
    upload: [P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), PL('17 8 12 3 7 8'), L(12, 3, 12, 15)],
    warn: [P('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'), P('M12 9v4'), P('M12 17h.01')],
    checkCircle: [C(12, 12, 10), P('m9 12 2 2 4-4')],
    listChecks: [R(3, 5, 6, 6, 1), P('m3 17 2 2 4-4'), P('M13 6h8'), P('M13 12h8'), P('M13 18h8')],
    more: [C(12, 12, 1), C(19, 12, 1), C(5, 12, 1)]
};

const FILLED = new Set(['play', 'pause']);

export function icon(name, size = 16, props = {}) {
    const filled = FILLED.has(name);
    return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: filled ? 'currentColor' : 'none',
        stroke: name === 'pause' ? 'none' : 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        ...props
    }, ICONS[name].map(([tag, attrs]) => h(tag, attrs)));
}
