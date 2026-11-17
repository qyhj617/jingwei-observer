(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const data = window.RELATIONS;
  if (!data?.history?.length || !data?.monthly?.length) {
    $('main').textContent = '数据文件未能载入。请检查 data/site-data.js 后刷新页面。';
    return;
  }
  const ns = 'http://www.w3.org/2000/svg';
  const paths = {
    download:'M12 3v11m-4-4 4 4 4-4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
    settings:'M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6m-6 4v6',
    right:'m9 5 7 7-7 7',left:'m15 5-7 7 7 7',
    pointer:'m5 3 5 16 3-6 6-3-14-7Z',bars:'M4 19h16M6 15v-4m6 4V5m6 10V8'
  };
  function icon(name) {
    const s=document.createElementNS(ns,'svg'), p=document.createElementNS(ns,'path');
    for(const [k,v] of Object.entries({viewBox:'0 0 24 24',width:'15',height:'15',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'})) s.setAttribute(k,v);
    p.setAttribute('d',paths[name]); s.append(p); return s;
  }
  document.querySelectorAll('[data-icon]').forEach(n=>n.append(icon(n.dataset.icon)));
  function element(tag,cls,value) {
    const n=document.createElement(tag);
    if(cls) n.className=cls;
    if(value!==undefined) n.textContent=value;
    return n;
  }
  const signed = n => Number.isFinite(n) ? (n>0?'+':'')+n.toFixed(1).replace('-','−') : '—';
  const pretty = m => m.slice(0,4)+' 年 '+Number(m.slice(5))+' 月';
  const dotDate = d => d.replaceAll('-','.');
  const tone = n => n>0?'pos':n<0?'neg':'';
  const colors = {
    '美国':'#187b71','日本':'#d26d50','俄罗斯':'#b78a38','法国':'#5581b6','英国':'#99699c','德国':'#8c703b',
    '印度':'#667e32','越南':'#cc5968','韩国':'#5570aa','澳大利亚':'#28769b','印度尼西亚':'#a65477','巴基斯坦':'#538849'
  };
  const months = [...new Set([...data.history.map(r=>r.month),...data.monthly.map(r=>r.month)])].sort();
  const countries=data.countries, latest=months.at(-1);
  const indices=new Map(months.map((m,i)=>[m,i]));
  const seriesMap=new Map(countries.map(name=>[name,{name,color:colors[name] || '#628077',official:{},estimates:{},graph:{}}]));
  const rows=new Map(), events=new Map();
  const key=(c,m)=>c+'|'+m;
  for(const r of data.history) countries.forEach((c,i)=>{if(Number.isFinite(r.values[i])) seriesMap.get(c).official[r.month]=r.values[i];});
  for(const r of data.monthly) {
    rows.set(key(r.country,r.month),r);
    const s=seriesMap.get(r.country);
    for(const [field,to] of [['estimate','estimates'],['official','official'],['graph','graph']]) if(Number.isFinite(r[field])) s[to][r.month]=r[field];
  }
  for(const e of data.events) {
    const k=key(e.country,e.date.slice(0,7));
    if(!events.has(k)) events.set(k,[]);
    events.get(k).push(e);
  }
  for(const list of events.values()) list.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  function score(c,m) {
    const s=seriesMap.get(c);
    return s.official[m] ?? s.estimates[m] ?? null;
  }
  let month=latest, end=latest, span=60, focus='美国';
  const selected=new Set(['美国','日本','俄罗斯','法国'].filter(c=>seriesMap.has(c)));
  let pendingEventFilter=null;
  const monthInput=$('month-picker'), focusSelect=$('focus-select');
  monthInput.min=months[0]; monthInput.max=latest;
  focusSelect.replaceChildren(...countries.map(c=>new Option('中国 — '+c,c)));
  const isPartial = m => m===data.asOf.slice(0,7) && Number(data.asOf.slice(8))<new Date(Number(m.slice(0,4)),Number(m.slice(5)),0).getDate();
  function visibleMonths() {
    const i=indices.get(end);
    return span==='all' ? months : months.slice(Math.max(0,i-span+1),i+1);
  }
  function formatStatus(m) {
    if(m<=data.officialEnd) return '清华公布';
    return isPartial(m) ? dotDate(data.asOf.slice(5))+' 月内暂估' : '月末估计';
  }
  $('hero-span').textContent=months[0].slice(0,4)+'—'+latest.slice(0,4);
  $('hero-countries').textContent=countries.length;
  $('hero-events').textContent=data.events.length.toLocaleString('zh-CN');
  $('footer-date').textContent='数据截至 '+dotDate(data.asOf)+(data.checkedAt ? ' '+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(data.checkedAt))+'（北京时间）' : '');
  function togglePopover(control,panel,open) {
    control.setAttribute('aria-expanded',String(open)); panel.hidden=!open;
  }
  for(const [button,panel] of [[$('download'),$('download-menu')],[$('choose'),$('country-menu')]]) {
    button.addEventListener('click',()=>togglePopover(button,panel,panel.hidden));
    document.addEventListener('click',e=>{if(!button.parentElement.contains(e.target)) togglePopover(button,panel,false);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape' && !panel.hidden){togglePopover(button,panel,false);button.focus();}});
  }
  $('download-menu').addEventListener('click',e=>{if(e.target.closest('a')) togglePopover($('download'),$('download-menu'),false);});
  function seriesControls() {
    const chips=$('series-chips'); chips.replaceChildren();
    for(const c of selected) {
      const b=element('button','chip');
      const d=element('i','dot'); d.style.setProperty('--series',seriesMap.get(c).color);
      b.setAttribute('aria-label','从走势图移除'+c); b.title='从走势图移除'+c;
      b.append(d,document.createTextNode(c)); b.onclick=()=>changeSeries(c); chips.append(b);
    }
    if(!selected.size) chips.textContent='请选择要比较的国家';
    $('country-options').querySelectorAll('input').forEach(input=>{input.checked=selected.has(input.value);});
  }
  function changeSeries(c) {
    if(selected.has(c)) selected.delete(c); else selected.add(c);
    seriesControls(); plot();
  }
  for(const c of countries) {
    const label=element('label'),input=element('input'); input.type='checkbox';input.value=c;
    input.addEventListener('change',()=>changeSeries(c)); label.append(input,document.createTextNode(c));$('country-options').append(label);
  }
  function plot() {
    const showing=visibleMonths();
    $('chart-period').textContent=dotDate(showing[0])+' — '+dotDate(showing.at(-1))+'　·　分值范围 −9 至 +9';
    window.drawTrend($('chart'),{months:showing,series:[...selected].map(c=>seriesMap.get(c)),selectedMonth:month,cutoff:data.asOf,officialEnd:data.officialEnd,onSelect:setMonth});
  }
  document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{
    span=b.dataset.range==='all'?'all':Number(b.dataset.range);
    if(span!=='all') {
      const i=indices.get(month);
      end=indices.get(latest)-i < span ? latest : month;
    }
    document.querySelectorAll('[data-range]').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); plot();
  }));
  function spark(c,at) {
    const index=indices.get(at), windowMonths=months.slice(Math.max(0,index-11),index+1);
    const canvas=element('canvas','spark'); canvas.width=88;canvas.height=36;canvas.setAttribute('aria-hidden','true');
    const ctx=canvas.getContext('2d'); if(!ctx) return canvas;
    const vals=windowMonths.map(m=>score(c,m)), ok=vals.filter(Number.isFinite); if(!ok.length)return canvas;
    const min=Math.min(...ok),max=Math.max(...ok),mid=(max+min)/2,range=Math.max(1.1,max-min);
    ctx.strokeStyle=max===min?'#98aaa0':seriesMap.get(c).color;ctx.lineWidth=2.6;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
    let line=false;
    vals.forEach((v,i)=>{
      if(v===null){line=false;return;}
      const x=3+82*i/Math.max(1,vals.length-1),y=18-(v-mid)*26/range;
      if(line)ctx.lineTo(x,y);else ctx.moveTo(x,y);line=true;
    });ctx.stroke();return canvas;
  }
  function updateFocus(c) {
    focus=c; focusSelect.value=c;
    if(!selected.has(c)){selected.add(c);seriesControls();plot();}
    renderFocus();
    $('rank-list').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.country===focus)));
  }
  function renderRank() {
    const list=$('rank-list'); list.replaceChildren();
    $('rank-period').textContent=pretty(month)+' · '+countries.length+' 国';
    const hasOverlap=countries.some(c=>Number.isFinite(seriesMap.get(c).official[month]) && Number.isFinite(rows.get(key(c,month))?.estimate));
    $('rank-foot').textContent=hasOverlap?'同月有两种分值时，排名采用清华明文值。点国家可对照项目估计。':'按当月分值排列，同分并列。环比为较上月的分值变化。';
    const last=months[indices.get(month)-1];
    const ranked=countries.map(c=>({c,v:score(c,month)})).sort((a,b)=>(b.v??-Infinity)-(a.v??-Infinity));
    let rank=0;
    ranked.forEach(({c,v},i)=>{
      if(i===0||v!==ranked[i-1].v)rank=i+1;
      const b=element('button','rank-grid rank-row'); b.dataset.country=c;b.setAttribute('aria-pressed',String(focus===c)); b.setAttribute('aria-label','查看'+c+'，当月'+signed(v)+'分');
      const name=element('span','rank-name');name.append(element('span','ordinal',v===null?'—':String(rank).padStart(2,'0')),document.createTextNode(c));
      if(hasOverlap && Number.isFinite(seriesMap.get(c).official[month]) && Number.isFinite(rows.get(key(c,month))?.estimate)) name.append(element('small','rank-source','清华'));
      const prior=last?score(c,last):null,d=Number.isFinite(v)&&Number.isFinite(prior)?Math.round((v-prior)*10)/10:null;
      b.append(name,spark(c,month),element('strong','rank-score '+tone(v),signed(v)),element('span','rank-change '+(d>0?'up':d<0?'down':''),d===0?'持平':signed(d)));
      b.onclick=()=>updateFocus(c);list.append(b);
    });
  }
  function safeLink(address) {
    try {const u=new URL(address);return /^https?:$/.test(u.protocol)?u.href:null;} catch {return null;}
  }
  function eventLink(e) {
    const url=safeLink(e.url);
    if(!url)return element('span','',e.action);
    const a=element('a','',e.action);a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.title='阅读事件原文';return a;
  }
  function showEvents(c,m) {
    pendingEventFilter={country:c,month:m};
    if(location.hash==='#events') changeView(); else location.hash='events';
  }
  function renderFocus() {
    const host=$('focus-body');host.replaceChildren();
    $('focus-period').textContent='中国与'+focus+' · '+pretty(month);
    const r=rows.get(key(focus,month)),v=score(focus,month), es=events.get(key(focus,month))??[];
    const stats=element('div','focus-stats');
    const entries=r ? [[isPartial(month)?'项目月内暂估':'项目月末估计',signed(r.estimate)],['备选编码范围',Number.isFinite(r.low)&&Number.isFinite(r.high)?(r.low===r.high?signed(r.low):signed(r.low)+' 至 '+signed(r.high)):'—'],['已登记事件',r.count+' 条']] : [['清华公布值',signed(v)],['分值来源','历史整表'],['公布精度','0.1 分']];
    for(const [label,value] of entries){const cell=element('div');cell.append(element('small','',label),element('strong','',value));stats.append(cell);}
    host.append(stats);
    const official=seriesMap.get(focus).official[month];
    if(r && (Number.isFinite(official)||Number.isFinite(r.graph))){
      const refs=[];
      if(Number.isFinite(official)) refs.push('清华原组明文 '+signed(official));
      if(Number.isFinite(r.graph)) refs.push('清华原图约 '+signed(r.graph));
      host.append(element('p','focus-note',refs.join('，')+'，项目估计同时保留。'));
    }
    if(r) {
      for(const e of es.slice(0,3)) {
        const item=element('div','focus-event'),dt=element('time','',e.date.slice(5));dt.dateTime=e.date;
        item.append(dt,eventLink(e),element('b',e.score>0?'up':e.score<0?'down':'',e.score===null?'待定':signed(e.score)));host.append(item);
      }
      if(!es.length) host.append(element('p','focus-empty','本月事件账尚无逐条记录。'));
      const a=element('button','focus-more','查看本月事件档案');a.append(icon('right'));a.onclick=()=>showEvents(focus,month);host.append(a);
    } else {
      const firstProject=data.monthly.reduce((earliest,r)=>r.month<earliest?r.month:earliest,latest);
      host.append(element('p','focus-note','本月收录于清华历史整表；逐条事件档案自 '+dotDate(firstProject)+' 起提供。'));
    }
  }
  function setMonth(m) {
    if(!indices.has(m)){monthInput.value=month;return;}
    month=m;monthInput.value=month;
    if(!visibleMonths().includes(month))end=month;
    $('prev-month').disabled=month===months[0];$('next-month').disabled=month===latest;
    $('period-status').textContent=formatStatus(month);
    plot();renderRank();renderFocus();
  }
  $('prev-month').onclick=()=>setMonth(months[indices.get(month)-1]);
  $('next-month').onclick=()=>setMonth(months[indices.get(month)+1]);
  monthInput.onchange=()=>setMonth(monthInput.value);
  focusSelect.onchange=()=>updateFocus(focusSelect.value);
  function changeView() {
    const view=['overview','events','method'].includes(location.hash.slice(1))?location.hash.slice(1):'overview';
    document.querySelectorAll('[data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    for(const id of ['overview','events','method']) $(id).hidden=id!==view;
    if(view==='overview')setMonth(month);
    else if(view==='events') {
      window.renderEvents($('events'),{data,...pendingEventFilter});pendingEventFilter=null;
    } else window.renderMethod($('method'),{data});
    window.scrollTo({top:0,behavior:'instant'});
  }
  seriesControls();focusSelect.value=focus;changeView();window.addEventListener('hashchange',changeView);
})();
