/* ================================================================
   SCROLL HUNTER · engine/canvas-text.js
   Разбор форматированного текста и расчёт строк для холста.
   ================================================================ */
'use strict';

function decodeEntities(s) {
    return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function parseRichHtml(html) {
    const runs = [];
    let style = { bold: false, color: null };
    const stack = [];
    const re = /<\/?[a-zA-Z][^>]*>|[^<]+/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const raw = m[0];
        if (raw[0] === '<') {
            const tag = raw.toLowerCase();
            if (tag.indexOf('br') === 1) {
                runs.push({ text: '\n', bold: style.bold, color: style.color });
            } else if (tag === '<b>') {
                stack.push(Object.assign({}, style));
                style.bold = true;
            } else if (tag === '</b>') {
                const s = stack.pop();
                if (s) style = s;
            } else if (tag[1] === 's') {
                /* открывающий или закрывающий тег span */
                if (tag[2] === '/') {
                    const s = stack.pop();
                    if (s) style = s;
                } else {
                    stack.push(Object.assign({}, style));
                    const cls = (raw.match(/class="([^"]*)"/) || [])[1] || '';
                    const color = (raw.match(/color:\s*([^;"]+)/) || [])[1];
                    if (cls.indexOf('muted') >= 0) style.color = UIC.dim;
                    else if (cls.indexOf('good-text') >= 0) style.color = UIC.green;
                    else if (cls.indexOf('bad-text') >= 0) style.color = UIC.red;
                    if (color) style.color = color.trim();
                }
            }
            continue;
        }
        const text = decodeEntities(raw).replace(/\s+/g, ' ');
        if (!text) continue;
        if (text === ' ') {
            const prev = runs[runs.length - 1];
            if (prev && prev.text !== '\n' && !prev.text.endsWith(' ')) prev.text += ' ';
            continue;
        }
        runs.push({ text: text, bold: style.bold, color: style.color });
    }
    return runs;
}

/* Разбить отрезки на строки с переносом по ширине */
function layoutRich(runs, maxWidth, fontSize = 15) {
    const lines = [];
    let cur = { segs: [], width: 0 };
    function fontOf(seg) {
        return (seg.bold ? '700 ' : '400 ') + fontSize + 'px Inter, system-ui, sans-serif';
    }

    for (const run of runs) {
        if (run.text === '\n') {
            lines.push(cur);
            cur = { segs: [], width: 0 };
            continue;
        }
        const parts = run.text.split(' ');
        for (let i = 0; i < parts.length; i++) {
            const word = parts[i];
            if (word === '') continue;
            const seg = { text: word, bold: run.bold, color: run.color };
            ctx.font = fontOf(seg);
            const w = ctx.measureText(word).width;
            const space = (i > 0 || cur.segs.length) ? ctx.measureText(' ').width : 0;
            if (cur.width + space + w > maxWidth && cur.segs.length) {
                lines.push(cur);
                cur = { segs: [], width: 0 };
            }
            if (cur.segs.length) { cur.segs.push({ text: ' ', bold: run.bold, color: run.color }); cur.width += space; }
            cur.segs.push(seg);
            cur.width += w;
        }
    }
    if (cur.segs.length) lines.push(cur);
    return lines;
}

