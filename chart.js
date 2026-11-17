/* Interactive monthly time series. All coordinates use the original −9 to +9 scale. */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const mounted = new WeakMap();
  const number = v => Number.isFinite(v) ? v.toFixed(1).replace('-', '−') : '—';
  const calendarIndex = month => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7));
  const valueAt = (records, month) => Number.isFinite(records?.[month]) ? records[month] : null;
  const labelMonth = month => month.slice(0, 4) + ' 年 ' + Number(month.slice(5, 7)) + ' 月';
  const css = `
    .trend-viewport{width:100%;height:var(--trend-height,clamp(245px,24vw,290px));position:relative;isolation:isolate}
    .trend-viewport>svg{display:block;width:100%;height:100%;overflow:visible;cursor:crosshair;touch-action:pan-y;outline-offset:2px}
    .trend-viewport>svg:focus-visible{outline:2px solid #117a70;border-radius:4px}
    .trend-viewport svg text{font-family:inherit;font-variant-numeric:tabular-nums}
    .trend-card-tip{position:absolute;z-index:2;pointer-events:none;background:#fff;color:#233935;border:1px solid #cddbd6;
      box-shadow:0 5px 18px #183a3321;border-radius:7px;padding:10px 13px;max-width:calc(100% - 12px);box-sizing:border-box;
      font-size:12px;line-height:1.45;font-variant-numeric:tabular-nums;}
    .trend-card-tip[hidden]{display:none}
    .trend-tip-title{font-weight:700;margin-bottom:5px}
    .trend-tip-line{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:3px}
    .trend-tip-name{white-space:nowrap}
    .trend-tip-name i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px}
    .trend-tip-values{display:flex;flex-wrap:wrap;gap:1px 8px;justify-content:flex-end;text-align:right}
    .trend-tip-values small{color:#526761;font-size:10px;margin-right:3px}
    .trend-tip-values b{font-size:12px}
    .trend-card-tip.trend-dense{font-size:11px;line-height:1.2;padding:7px 9px}
    .trend-dense .trend-tip-line{margin-top:2px}
    .trend-dense .trend-tip-values b{font-size:11px}
    @media(max-width:520px){.trend-card-tip{padding:7px 9px}.trend-tip-line{margin-top:1px}}
  `;

  function svg(tag, attributes, content) {
    const node = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attributes || {})) node.setAttribute(name, value);
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function html(tag, className, content) {
    const node = document.createElement(tag);
    node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function monthValues(s, month, officialEnd) {
    const values = [];
    const a = valueAt(s.official, month);
    const b = valueAt(s.estimates, month);
    const c = valueAt(s.graph, month);
    if (a !== null) values.push([month > officialEnd ? '原组明文' : '清华', a]);
    if (b !== null) values.push(['项目', b]);
    if (c !== null) values.push(['读图约', c]);
    return values;
  }

  function xTicks(months, xs, plotWidth) {
    const last = months.length - 1;
    if (!last) return [0];
    const gap = plotWidth < 460 ? 68 : 84;
    const stride = Math.max(1, Math.ceil(last / Math.max(1, Math.floor(plotWidth / gap))));
    const spacing = [1, 2, 3, 6, 12, 24, 36, 60, 120, 240, 600].find(n => n >= stride) || stride;
    const indices = [0];
    for (let i = 1; i < last; i++) {
      if ((calendarIndex(months[i]) - 1) % spacing === 0 &&
          xs[i] - xs[indices.at(-1)] >= gap * .8 && xs[last] - xs[i] >= gap * .8) indices.push(i);
    }
    indices.push(last);
    return indices;
  }

  window.drawTrend = function drawTrend(el, { months, series, selectedMonth, cutoff, officialEnd, onSelect }) {
    const previous = mounted.get(el);
    const hadFocus = previous && document.activeElement === previous.surface;
    previous?.dispose();
    if (!document.getElementById('trend-component-styles')) {
      const style = document.createElement('style');
      style.id = 'trend-component-styles';
      style.textContent = css;
      document.head.append(style);
    }

    const wrap = html('div', 'trend-viewport');
    const surface = svg('svg', { tabindex: '0', role: 'slider', 'aria-label': '关系走势图，左右方向键选择月份', 'aria-orientation': 'horizontal' });
    const tooltip = html('div', 'trend-card-tip');
    tooltip.classList.toggle('trend-dense', series.length > 7);
    tooltip.hidden = true;
    tooltip.setAttribute('aria-hidden', 'true');
    wrap.append(surface, tooltip);
    el.replaceChildren(wrap);

    const n = months.length;
    let selected = months.indexOf(selectedMonth);
    if (selected === -1) selected = Math.max(0, n - 1);
    let guide, xs = [], width, height, left, right, top, bottom;
    let pinnedMonth = previous?.pinnedMonth === selectedMonth ? selectedMonth : null;
    let inspected = pinnedMonth ? selected : null;
    const dates = months.map(calendarIndex);
    const dayText = String(cutoff || '').slice(0, 10);
    const y = v => top + (9 - v) / 18 * (bottom - top);
    const clampIndex = i => Math.min(n - 1, Math.max(0, i));

    function monthCaption(month) {
      if (dayText.startsWith(month + '-') && /^\d{4}-\d{2}-\d{2}$/.test(dayText)) {
        const [year, m, day] = dayText.split('-').map(Number);
        if (day < new Date(year, m, 0).getDate()) return labelMonth(month) + ' · 截至 ' + day + ' 日';
      }
      return labelMonth(month);
    }

    function syncAria() {
      surface.setAttribute('aria-valuemin', '1');
      surface.setAttribute('aria-valuemax', String(n || 1));
      surface.setAttribute('aria-valuenow', String(selected + 1));
      const month = months[selected];
      if (!month) return;
      const details = series.map(s => s.name + ' ' + (monthValues(s, month, officialEnd)
        .map(([label, v]) => label + ' ' + number(v)).join('，') || '无数据'));
      surface.setAttribute('aria-valuetext', [monthCaption(month), ...details].join('；'));
    }

    function showMonth(i, showTooltip) {
      if (!n || !guide) return;
      inspected = showTooltip ? i : null;
      const month = months[i], x = xs[i];
      guide.replaceChildren(svg('line', {
        x1: x, x2: x, y1: top, y2: bottom, stroke: '#9aafa8',
        'stroke-dasharray': '2 4', 'stroke-opacity': showTooltip ? '.9' : '.48'
      }));
      const body = document.createDocumentFragment();
      if (showTooltip) body.append(html('div', 'trend-tip-title', monthCaption(month)));
      for (const s of series) {
        const values = monthValues(s, month, officialEnd);
        const main = valueAt(s.estimates, month) ?? valueAt(s.official, month) ?? valueAt(s.graph, month);
        if (main !== null) guide.append(svg('circle', { cx: x, cy: y(main), r: 3.7, fill: s.color, stroke: '#fff', 'stroke-width': 1.4 }));
        if (!showTooltip) continue;
        const row = html('div', 'trend-tip-line');
        const name = html('span', 'trend-tip-name');
        const dot = document.createElement('i');
        dot.style.backgroundColor = s.color;
        name.append(dot, document.createTextNode(s.name));
        const info = html('span', 'trend-tip-values');
        if (!values.length) info.textContent = '无数据';
        for (const [label, v] of values) {
          const metric = document.createElement('span');
          metric.append(html('small', '', label), html('b', '', number(v)));
          info.append(metric);
        }
        row.append(name, info);
        body.append(row);
      }
      tooltip.hidden = !showTooltip || !series.length;
      if (!tooltip.hidden) {
        tooltip.replaceChildren(body);
        const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
        const side = x + tw + 14 < width ? x + 12 : x - tw - 12;
        tooltip.style.left = Math.max(4, Math.min(width - tw - 4, side)) + 'px';
        tooltip.style.top = Math.max(3, Math.min(top + 12, height - th - 3)) + 'px';
      }
    }

    function addSeries(s) {
      for (const [key, dashed] of [['official', false], ['estimates', true]]) {
        let commands = [];
        function flush() {
          if (!commands.length) return;
          if (commands.length === 1) {
            surface.append(svg('circle', { cx: commands[0][0], cy: commands[0][1], r: 2.2, fill: s.color }));
          } else {
            const d = commands.map(([x, yy], i) => (i ? 'L' : 'M') + x.toFixed(2) + ',' + yy.toFixed(2)).join(' ');
            const attr = { d, fill: 'none', stroke: s.color, 'stroke-width': 2.35, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
            if (dashed) attr['stroke-dasharray'] = '5 4.5';
            surface.append(svg('path', attr));
          }
          commands = [];
        }
        months.forEach((m, i) => {
          const val = valueAt(s[key], m);
          // Later official observations are shown as discrete diamonds below.
          if (val === null || (!dashed && m > officialEnd)) {
            flush();
            return;
          }
          if (i && dates[i] !== dates[i - 1] + 1) flush();
          if (dashed && i && dates[i] === dates[i - 1] + 1) {
            const prev = months[i - 1], anchor = valueAt(s.official, prev);
            if (anchor !== null && prev >= officialEnd && anchor !== valueAt(s.estimates, prev)) {
              flush();
              commands.push([xs[i - 1], y(anchor)]);
            }
          }
          commands.push([xs[i], y(val)]);
        });
        flush();
      }
      months.forEach((m, i) => {
        const exact = valueAt(s.official, m), graph = valueAt(s.graph, m), x = xs[i];
        if (m > officialEnd && exact !== null) {
          const yy = y(exact), d = 4.1;
          surface.append(svg('polygon', { points: [[x, yy-d], [x+d, yy], [x, yy+d], [x-d, yy]].map(p => p.join(',')).join(' '),
            fill: 'white', stroke: s.color, 'stroke-width': 1.7 }));
        }
        if (graph !== null) surface.append(svg('rect', { x: x-3.6, y: y(graph)-3.6, width: 7.2, height: 7.2,
          fill: 'white', stroke: s.color, 'stroke-width': 1.5 }));
      });
    }

    function render() {
      width = Math.max(1, wrap.clientWidth);
      height = Math.max(100, wrap.clientHeight);
      left = 30; right = Math.max(left + 1, width - 13); top = 16; bottom = height - 27;
      const plotWidth = right - left;
      surface.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      surface.replaceChildren();
      if (!n) {
        surface.append(svg('text', { x: width / 2, y: height / 2, 'text-anchor':'middle', fill:'#536963' }, '当前时段暂无数据'));
        tooltip.hidden = true;
        return;
      }
      xs = dates.map(d => n === 1 ? (left + right) / 2 : left + (d - dates[0]) / (dates.at(-1) - dates[0]) * plotWidth);
      const firstEstimate = months.findIndex(m => m > officialEnd);
      if (firstEstimate !== -1) {
        const edge = firstEstimate ? xs[firstEstimate - 1] : left;
        surface.append(svg('rect', { x: edge, y: top, width: right - edge, height: bottom - top, fill: '#f3f8f6' }));
        if (firstEstimate) surface.append(svg('line', { x1: edge, x2: edge, y1: top, y2: bottom,
          stroke: '#adc7bc', 'stroke-dasharray': '3 4' }));
      }
      for (const tick of [9, 6, 3, 0, -3, -6, -9]) {
        surface.append(svg('line', { x1: left, x2: right, y1: y(tick), y2: y(tick), stroke: tick ? '#e1e7e4' : '#bac9c2', 'stroke-width': 1 }));
        surface.append(svg('text', { x: left - 9, y: y(tick) + 3.8, 'text-anchor': 'end', fill: '#61736d', 'font-size': 11 }, String(tick).replace('-', '−')));
      }
      for (const i of xTicks(months, xs, plotWidth)) {
        const anchor = n === 1 ? 'middle' : i === 0 ? 'start' : i === n-1 ? 'end' : 'middle';
        const label = months.length >= 36 && i !== 0 && i !== n-1 && months[i].endsWith('-01') ? months[i].slice(0, 4) : months[i].replace('-', '.');
        surface.append(svg('text', { x: xs[i], y: height - 7, 'text-anchor': anchor, fill: '#61736d', 'font-size': 10.7 }, label));
      }
      for (const s of series) addSeries(s);
      if (!series.length) {
        surface.append(svg('text', { x: (right + left)/2, y: y(0)-12, 'text-anchor':'middle', fill:'#536963','font-size':13 }, '请选择要查看的国家'));
      }
      guide = svg('g', { 'pointer-events': 'none' });
      surface.append(guide);
      showMonth(inspected ?? selected, inspected !== null);
    }

    function nearest(event) {
      const x = event.clientX - surface.getBoundingClientRect().left;
      let a = 0, b = n - 1;
      while (a < b) {
        const mid = Math.floor((a + b) / 2);
        if (x > (xs[mid] + xs[mid+1]) / 2) a = mid + 1;
        else b = mid;
      }
      return a;
    }

    function select(i) {
      selected = i;
      pinnedMonth = months[i];
      syncAria();
      showMonth(i, true);
      if (onSelect) onSelect(months[i]);
    }

    const controls = new AbortController();
    const listen = (node, name, fn) => node.addEventListener(name, fn, { signal: controls.signal });
    listen(surface, 'pointermove', e => { if (n) showMonth(nearest(e), true); });
    listen(surface, 'pointerleave', e => {
      if (n && e.pointerType !== 'touch') { pinnedMonth = null; showMonth(selected, false); }
    });
    listen(document, 'pointerdown', e => {
      if (n && !wrap.contains(e.target)) { pinnedMonth = null; showMonth(selected, false); }
    });
    listen(surface, 'click', e => { if (n) select(nearest(e)); });
    listen(surface, 'keydown', e => {
      const steps = { ArrowLeft: selected - 1, ArrowRight: selected + 1, Home: 0, End: n-1 };
      if (e.key === 'Escape' && n) {
        pinnedMonth = null;
        showMonth(selected, false);
      } else if (Object.hasOwn(steps, e.key) && n) {
        e.preventDefault();
        select(clampIndex(steps[e.key]));
      }
    });
    listen(surface, 'blur', () => { if (n) { pinnedMonth = null; showMonth(selected, false); } });
    syncAria();
    render();
    const observer = new ResizeObserver(render);
    observer.observe(wrap);
    mounted.set(el, { surface, get pinnedMonth() { return pinnedMonth; }, dispose() { observer.disconnect(); controls.abort(); } });
    if (hadFocus) surface.focus({ preventScroll: true });
  };
})();
