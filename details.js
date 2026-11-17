/* The event ledger and methodology panels are rendered from the same local release as the chart. */
(() => {
  'use strict';
  const PAGE_SIZE = 12;
  const fmt = x => (x > 0 ? '+' : '') + x.toFixed(1).replace('-', '−');
  const monthLabel = s => s.slice(0, 4) + ' 年 ' + Number(s.slice(5, 7)) + ' 月';
  const classes = { positive: '合作', negative: '冲突', zero: '零分', pending: '待定' };
  const kind = n => !Number.isFinite(n) ? 'pending' : n > 0 ? 'positive' : n < 0 ? 'negative' : 'zero';

  function node(tag, cls, text) {
    const out = document.createElement(tag);
    if (cls) out.className = cls;
    if (text != null) out.textContent = text;
    return out;
  }
  function append(parent, tag, cls, text) {
    const child = node(tag, cls, text);
    parent.append(child);
    return child;
  }
  function external(parent, label, url) {
    try {
      const u = new URL(url);
      if (!['https:', 'http:'].includes(u.protocol)) return;
      const a = append(parent, 'a', 'dt-source', label + ' ↗');
      a.href = u.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } catch { /* A missing secondary source has no link. */ }
  }
  function button(text, className) {
    const b = node('button', className, text);
    b.type = 'button';
    return b;
  }
  function mount(host, title, subtitle) {
    styles();
    const page = node('div', 'dt-wrap');
    const header = append(page, 'header', 'dt-head');
    append(header, 'h1', '', title);
    append(header, 'p', '', subtitle);
    host.replaceChildren(page);
    return page;
  }
  function filter(form, label, entries, selected) {
    const field = append(form, 'label', 'dt-field');
    append(field, 'span', '', label);
    const select = append(field, 'select', '');
    for (const [value, text] of entries) {
      const option = append(select, 'option', '', text);
      option.value = value;
    }
    select.value = selected;
    return select;
  }

  function eventRow(e) {
    const category = kind(e.score);
    const row = node('details', 'dt-item');
    const headline = append(row, 'summary', 'dt-summary');
    const day = append(headline, 'time', 'dt-date', e.date.replaceAll('-', '.'));
    day.dateTime = e.date;
    append(headline, 'span', 'dt-country', e.country);
    append(headline, 'span', 'dt-action', e.action);
    const score = append(headline, 'span', 'dt-score dt-' + category, category === 'pending' ? '待定' : fmt(e.score));
    score.setAttribute('aria-label', '事件原始分，' + classes[category] + (category === 'pending' ? '' : ' ' + fmt(e.score)));
    append(headline, 'span', 'dt-chevron').setAttribute('aria-hidden', 'true');
    const block = append(row, 'div', 'dt-body');
    const dl = append(block, 'dl', '');
    function line(label, value) {
      if (!value) return;
      append(dl, 'dt', '', label);
      append(dl, 'dd', '', value);
    }
    line('事件编号', e.id);
    line('赋值条款', e.rule);
    line('备选赋值', Number.isFinite(e.alternative) ? fmt(e.alternative) : '');
    line('备选依据', e.alternativeReason);
    line('归并与判断', e.note);
    const links = append(block, 'div', 'dt-links');
    external(links, '来源原文', e.url);
    if (e.url2 && e.url2 !== e.url) external(links, '补充原文', e.url2);
    return row;
  }

  window.renderEvents = function renderEvents(host, {data, country = '', month = '', onCloseFilter}) {
    const all = [...data.events].sort((a, b) => b.date.localeCompare(a.date) || a.country.localeCompare(b.country, 'zh-CN') || a.id.localeCompare(b.id));
    const periods = [...new Set(data.monthly.map(r => r.month))].sort().reverse();
    const page = mount(host, '事件档案', '按发生日期查阅各国行动、原始赋值和来源。');
    const card = append(page, 'section', 'dt-card dt-ledger');
    const form = append(card, 'div', 'dt-controls');
    const unknownMonth = month && !periods.includes(month);
    const cp = filter(form, '国家', [['', '全部国家'], ...data.countries.map(c => [c,c])], data.countries.includes(country) ? country : '');
    const periodOptions = [['', '全部月份'], ...periods.map(m => [m,monthLabel(m)])];
    if (unknownMonth && /^\d{4}-\d{2}$/.test(month)) periodOptions.push([month, monthLabel(month) + '（无事件账）']);
    const mp = filter(form, '月份', periodOptions, periodOptions.some(pair => pair[0] === month) ? month : '');
    const kp = filter(form, '编码分类', [['','全部编码'], ...Object.entries(classes)], '');
    const searchLabel = append(form, 'label', 'dt-field dt-search');
    append(searchLabel, 'span', '', '关键词');
    const input = append(searchLabel, 'input', '');
    input.type = 'search';
    input.placeholder = '检索事件、编号或条款';
    const summary = append(card, 'div', 'dt-result');
    const count = append(summary, 'span', '');
    count.setAttribute('aria-live', 'polite');
    const reset = button('清除筛选', 'dt-reset');
    summary.append(reset);
    const coverage = append(card, 'div', 'dt-coverage');
    const list = append(card, 'div', 'dt-list');
    const pager = append(card, 'div', 'dt-pager');
    let current = 1;
    let previousScope;
    function results() {
      const q = input.value.trim().toLowerCase();
      const rows = all.filter(e => (!cp.value || e.country === cp.value) && (!mp.value || e.date.startsWith(mp.value)) &&
        (!kp.value || kind(e.score) === kp.value) &&
        (!q || [e.action, e.id, e.rule, e.note, e.alternativeReason, e.country].some(s => String(s || '').toLowerCase().includes(q))));
      const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
      current = Math.max(1, Math.min(current, pages));
      reset.hidden = !(cp.value || mp.value || kp.value || q);
      count.textContent = '共 ' + rows.length.toLocaleString('zh-CN') + ' 条事件';
      const scopeKey = cp.value + '/' + mp.value;
      if (scopeKey !== previousScope) {
        previousScope = scopeKey;
        coverage.replaceChildren();
        const record = cp.value && mp.value && data.monthly.find(r => r.country === cp.value && r.month === mp.value);
        if (record?.scope) {
          const detail = append(coverage, 'details', '');
          append(detail, 'summary', '', '本月核查范围与来源');
          append(detail, 'p', '', record.scope);
          const references = append(detail, 'div', 'dt-links');
          for (const [i,url] of (record.urls || []).entries()) external(references, '来源 ' + (i + 1), url);
        }
      }
      list.replaceChildren();
      if (rows.length) {
        const titles = append(list, 'div', 'dt-column-head');
        titles.setAttribute('aria-hidden', 'true');
        for (const name of ['发生日期','国家','行动','事件分','']) append(titles, 'span', '', name);
        rows.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE).forEach(e => list.append(eventRow(e)));
      } else {
        append(list, 'p', 'dt-empty', mp.value && !periods.includes(mp.value)
          ? '本月仅收录历史关系分。事件账自 ' + (periods.at(-1) || '—') + ' 起可查。'
          : '没有符合这些条件的事件。可更换关键词或清除筛选。');
      }
      pager.replaceChildren();
      pager.hidden = pages <= 1;
      if (pages <= 1) return;
      const back = button('上一页', 'dt-page-btn');
      const next = button('下一页', 'dt-page-btn');
      pager.append(back, node('span', '', current + ' / ' + pages), next);
      back.disabled = current === 1;
      next.disabled = current === pages;
      function go(step) {
        current += step;
        results();
        const first = list.querySelector('summary');
        if (first) first.focus();
      }
      back.onclick = () => go(-1);
      next.onclick = () => go(1);
    }
    function change() { current = 1; results(); }
    [cp, mp, kp].forEach(s => s.addEventListener('change', change));
    input.addEventListener('input', change);
    reset.onclick = () => {
      cp.value = mp.value = kp.value = input.value = '';
      change();
      if (onCloseFilter) onCloseFilter();
    };
    results();
  };

  const base = 'https://www.tuiir.tsinghua.edu.cn';
  const original = {
    directory: base + '/kycg/zwgxsj.htm', table: base + '/info/1145/6264.htm',
    coding: base + '/info/1145/2599.htm', manual: base + '/info/1145/2618.htm',
    note: base + '/__local/6/D5/F2/63B9DA89FD71D740917D2B41D55_FF27587D_41A4D.pdf',
    vn: 'https://gjzzkx.cbpt.cnki.net/portal/journal/portal/client/paper/6c9bae3822d6f321654ae62f5544c426',
    au: base + '/guojiguanxiyucezhongaoguanxihuanhetaishijiqigaishanxiandu.PDF#page=2',
    news: 'https://www.mfa.gov.cn/web/fyrbt_673021/jzhsl_673025/'
  };
  window.renderMethod = function renderMethod(host, {data}) {
    const page = mount(host, '方法与来源', '关系水平、单项事件分和观测来源分别记录。');
    const layout = append(page, 'div', 'dt-method-grid');
    const main = append(layout, 'div', 'dt-stack');
    const side = append(layout, 'div', 'dt-stack');
    function section(parent, title) {
      const s = append(parent, 'section', 'dt-card dt-prose');
      append(s, 'h2', '', title);
      return s;
    }
    const sources = section(main, '怎样读这组分数');
    const items = [
      ['清华公布值', '官网十二国月表涵盖 ' + data.history[0].month + ' 至 ' + data.officialEnd + '。国别专题明确写出的实测月值也单独标识。'],
      ['原图约值', '从原组论文曲线读取的近似值，保留原图出处。'],
      ['项目独立估计', '本项目按清华公开的规则，对核实的事件赋值并逐月计算；来源覆盖和事件归属会产生差异。'],
      ['月内暂估', '月份尚未结束时，只纳入截止日已发生的事件。该月后续更新仍从同一上月末起点重算。']
    ];
    const key = append(sources, 'dl', 'dt-key');
    items.forEach(([name, text]) => { append(key, 'dt', '', name); append(key, 'dd', '', text); });
    const formula = section(main, '从事件到月末分');
    append(formula, 'p', '', '先归并同一行动的多篇报道。按发生月分别求出正向事件分之和 A、负向事件分之和 B（带负号），用上月末关系分 P 计算当月影响力 I。量表范围为 −9 至 +9。');
    append(formula, 'div', 'dt-formula', 'I = [(9 − P) × A + (9 + P) × k × B] / 9');
    append(formula, 'p', '', '中美自 2019 年 1 月起使用 k = 2/3，其他本研究对象使用 k = 1。本项目每满 0.5 个影响分，令关系分向同一方向移动 0.1，未满部分向零截去。主分待定的事件保留空白。');
    append(formula, 'p', '', '有备选编码的事件另行计算低、高两种情景。两条情景反映已知编码差异，无法量化未收录事件带来的偏差。');
    const fLinks = append(formula, 'div', 'dt-links');
    external(fLinks, '清华使用手册', original.manual); external(fLinks, '赋值细则', original.coding); external(fLinks, '中美修订说明', original.note);
    const calibration = section(main, '已发表的对照');
    append(calibration, 'h3', '', '中越 · 2025 年 12 月');
    append(calibration, 'p', '', '本次历史续算为 6.3，原组论文明确给出 6.4。保留两数，从 2026 年 1 月改用清华的 6.4 作月初起点。原组结果在本轮编码前已知。');
    external(calibration, '中越专题原文', original.vn);
    append(calibration, 'h3', '', '中澳 · 2025 年 9 月和 10 月');
    append(calibration, 'p', '', '原图两月与 8 月同高，均约为 −0.6。项目估计也为 −0.6，这两个读图值仅用于近似对照。');
    external(calibration, '中澳原图 · 第 2 页', original.au);
    const files = section(side, '下载数据');
    const first = data.history[0].month;
    const periods = [...new Set(data.monthly.map(r=>r.month))].sort();
    const downloads = [
      ['清华历史月表', first + ' — ' + data.officialEnd, 'history.csv'],
      ['项目月度分与对照', periods[0] + ' — ' + periods.at(-1), 'monthly.csv'],
      ['国别事件账', data.events.length.toLocaleString('zh-CN') + ' 条 · 含来源链接', 'events.csv']
    ];
    downloads.forEach(([name, info, filename]) => {
      const a = append(files, 'a', 'dt-download'); a.href = 'data/' + filename; a.download = filename;
      const group = append(a, 'span', ''); append(group, 'b', '', name); append(group, 'small', '', info);
      append(a, 'span', 'dt-format', 'CSV ↓');
    });
    const review = section(side, '历史回测');
    append(review, 'p', '', '从四国 2025 年 6 月原值出发，先封存 7、8 月编码与估计，再与原组 8 个答案核对。7 个方向一致，3 个数值相同。');
    append(review, 'p', '', '项目平均绝对误差为 0.10，以 6 月原分一路持平为 0.0875。这个样本中，持平基准的绝对误差更小。');
    const refs = section(side, '研究与采集来源');
    append(refs, 'p', '', '历史数据来自清华大学国际关系研究院。项目事件账核对中外双方的外交、经贸通报、使馆公告和公开报道，每条事件附原文。');
    append(refs, 'p', '', '清华手册以《人民日报》和中国外交部网站为主要来源。此次续算也查当事国政府公告，覆盖范围因而更宽。资料登记中的“九国”指一次打包的九个中国外交部国别栏目，美、日、法的栏目另行收集。');
    const rLinks = append(refs, 'div', 'dt-links');
    external(rLinks, '清华数据目录', original.directory); external(rLinks, '十二国原表', original.table); external(rLinks, '外交部记者会', original.news);
    external(rLinks, '外交部日本栏目', 'https://www.mfa.gov.cn/gjhdq_676201/gj_676203/yz_676205/1206_676836/xgxw_676842/');
  };

  function styles() {
    if (document.getElementById('dt-panel-style')) return;
    const s = node('style');
    s.id = 'dt-panel-style';
    s.textContent = `
      .dt-wrap{color:#183730;max-width:1280px;margin:0 auto;padding-bottom:36px}
      .dt-head{padding:10px 0 24px}.dt-head h1{font-size:clamp(27px,3vw,38px);letter-spacing:-.035em;margin:0 0 6px;line-height:1.3}
      .dt-head p{margin:0;color:#576e64;font-size:14px}
      .dt-card{border:1px solid #dce4de;border-radius:12px;background:#fff}
      .dt-controls{display:grid;grid-template-columns:1fr 1fr 1fr minmax(195px,1.55fr);gap:14px;padding:22px}
      .dt-field{display:flex;min-width:0;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:#435f52}
      .dt-field input,.dt-field select{font:inherit;font-size:14px;font-weight:400;height:40px;min-width:0;width:100%;padding:5px 10px;border:1px solid #d4ded8;
        border-radius:6px;background:#fff;color:#183730;box-sizing:border-box}.dt-field input::placeholder{color:#75837b}
      .dt-wrap :focus-visible{outline:2px solid #16786a;outline-offset:2px}
      .dt-result{display:flex;justify-content:space-between;align-items:center;min-height:35px;border-top:1px solid #e6ebe7;padding:6px 22px;color:#476256;font-size:13px}
      .dt-coverage:empty{display:none}.dt-coverage{padding:0 22px 10px;font-size:13px;color:#496658}
      .dt-coverage summary{cursor:pointer;color:#14685d}.dt-coverage p{line-height:1.7;margin:6px 0}
      .dt-wrap button{font:inherit;cursor:pointer}.dt-reset,.dt-page-btn{border:1px solid #d6e1db;color:#14685d;background:white;border-radius:5px}
      .dt-reset{padding:3px 8px;font-size:12px}.dt-reset[hidden],.dt-pager[hidden]{display:none}
      .dt-column-head,.dt-summary{display:grid;grid-template-columns:95px 72px minmax(0,1fr) 72px 10px;gap:13px;align-items:center;padding:12px 22px}
      .dt-column-head{background:#f1f5f1;font-size:11px;color:#597066}.dt-column-head span:nth-child(4){text-align:right}
      .dt-item{border-bottom:1px solid #e4eae6}.dt-summary{font-size:14px;cursor:pointer;list-style:none;line-height:1.6;min-height:25px}
      .dt-summary::-webkit-details-marker{display:none}.dt-item[open]>.dt-summary,.dt-summary:hover{background:#f6faf7}
      .dt-date{font-variant-numeric:tabular-nums;color:#667b70;font-size:13px}.dt-country{font-size:13px;color:#416453;white-space:nowrap}
      .dt-action{font-weight:560;overflow-wrap:anywhere;line-height:1.6}.dt-score{justify-self:end;border-radius:4px;padding:1px 7px;
        font-size:12px;line-height:1.6;font-weight:650;font-variant-numeric:tabular-nums;white-space:nowrap}
      .dt-positive{color:#126552;background:#e5f1e9}.dt-negative{color:#975144;background:#f5ebe6}
      .dt-zero{color:#52665a;background:#edf1ed}.dt-pending{color:#826131;background:#f6efdf}
      .dt-chevron{width:6px;height:6px;border-right:1.5px solid #6f8278;border-bottom:1.5px solid #6f8278;transform:rotate(45deg);margin-top:-3px}
      .dt-item[open] .dt-chevron{transform:rotate(225deg);margin-top:4px}
      .dt-body{padding:1px 28px 17px max(22px,8%);background:#f6faf7;color:#40594b;font-size:13px;line-height:1.65}
      .dt-body dl,.dt-key{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:5px 15px;margin:0 0 7px}
      .dt-body dt{color:#64766b}.dt-body dd,.dt-key dd{margin:0;overflow-wrap:anywhere}
      .dt-links{display:flex;flex-wrap:wrap;gap:4px 16px}.dt-source{color:#14685d;font-size:13px;text-underline-offset:3px}
      .dt-empty{padding:25px 22px;color:#63776b;text-align:center}.dt-pager{display:flex;gap:12px;align-items:center;justify-content:flex-end;padding:15px 22px;
        font-size:13px;color:#5c7265;font-variant-numeric:tabular-nums}.dt-page-btn{padding:5px 12px}.dt-page-btn:disabled{opacity:.35;cursor:default}
      .dt-method-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);gap:18px}
      .dt-stack{display:flex;flex-direction:column;gap:16px}.dt-prose{padding:22px 24px;min-width:0}
      .dt-prose h2{font-size:18px;line-height:1.5;margin:0 0 12px;color:#183730}.dt-prose h3{font-size:15px;margin:17px 0 4px}
      .dt-prose p,.dt-key{font-size:14px;line-height:1.82;color:#486155}.dt-prose p{margin:6px 0 12px}.dt-prose p:last-child{margin-bottom:0}
      .dt-key{gap:8px 16px}.dt-key dt{font-weight:650;color:#264b3d}.dt-formula{background:#eef5f0;color:#234e3b;padding:12px 14px;border-left:3px solid #338672;
        font:600 14px/1.6 ui-monospace,monospace;border-radius:4px;overflow-wrap:anywhere}
      .dt-download{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 0;border-top:1px solid #e3eae5;color:#184c3b;text-decoration:none}
      .dt-download b,.dt-download small{display:block}.dt-download b{font-size:14px}.dt-download small{font-size:12px;color:#64796b;margin-top:3px}
      .dt-format{font-size:11px;white-space:nowrap;color:#477160}
      @media(max-width:760px){.dt-controls{grid-template-columns:1fr 1fr;gap:10px;padding:16px}.dt-method-grid{grid-template-columns:1fr}
        .dt-column-head,.dt-summary{grid-template-columns:78px 55px minmax(0,1fr) 45px 8px;gap:8px;padding:12px 15px}.dt-result,.dt-pager{padding-left:15px;padding-right:15px}}
      @media(max-width:550px){.dt-head{padding:6px 0 18px}.dt-column-head{display:none}.dt-item:first-child{border-top:1px solid #e4eae6}
        .dt-summary{grid-template-columns:max-content minmax(0,1fr) max-content 10px;gap:4px 9px}.dt-date{grid-area:1/1}.dt-country{grid-area:1/2}
        .dt-score{grid-area:1/3}.dt-chevron{grid-area:1/4}.dt-action{grid-area:2/1/3/5}.dt-body{padding:6px 15px 15px}
        .dt-prose{padding:17px}.dt-key{grid-template-columns:1fr;gap:2px}.dt-key dd{margin-bottom:8px}}
    `;
    document.head.append(s);
  }
})();
