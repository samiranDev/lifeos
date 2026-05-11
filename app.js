/* LifeOS — app.js — Full Modular Platform */
'use strict';

// ════════ SCHEMAS ════════
const SCHEMAS = {
  goal:       {label:'Goal',       cat:'core',        icon:'bi-bullseye',           color:'#6366F1'},
  milestone:  {label:'Milestone',  cat:'core',        icon:'bi-flag-fill',          color:'#A855F7'},
  task:       {label:'Task',       cat:'core',        icon:'bi-check2-square',      color:'#6B7280'},
  journal:    {label:'Journal',    cat:'core',        icon:'bi-journal-text',       color:'#14B8A6'},
  debt:       {label:'Debt',       cat:'finance',     icon:'bi-exclamation-circle', color:'#EF4444'},
  income:     {label:'Income',     cat:'finance',     icon:'bi-currency-dollar',    color:'#10B981'},
  expense:    {label:'Expense',    cat:'finance',     icon:'bi-cart3',              color:'#F97316'},
  asset:      {label:'Asset',      cat:'finance',     icon:'bi-building-fill',      color:'#6366F1'},
  investment: {label:'Investment', cat:'finance',     icon:'bi-bar-chart-fill',     color:'#06B6D4'},
  kpi:        {label:'KPI',        cat:'finance',     icon:'bi-speedometer2',       color:'#8B5CF6'},
  learning:   {label:'Learning',   cat:'productivity',icon:'bi-book-fill',          color:'#14B8A6'},
  business:   {label:'Business',   cat:'productivity',icon:'bi-briefcase-fill',     color:'#F97316'},
  automation: {label:'Automation', cat:'productivity',icon:'bi-lightning-fill',     color:'#E879F9'},
  health:     {label:'Health',     cat:'health',      icon:'bi-heart-pulse-fill',   color:'#84CC16'},
};
const SCHEMA_CATS = {core:'Core',finance:'Finance',productivity:'Productivity',health:'Health'};

const CURRENCIES = {
  INR:{symbol:'₹',name:'Indian Rupee',rate:1},
  USD:{symbol:'$',name:'US Dollar',rate:84},
  EUR:{symbol:'€',name:'Euro',rate:91},
  GBP:{symbol:'£',name:'Pound',rate:107},
  AED:{symbol:'د.إ',name:'UAE Dirham',rate:22.9},
};

const WS_TYPES = {
  life:    {name:'Life Roadmap', icon:'bi-diagram-2',      color:'#6366F1'},
  finance: {name:'Finance',      icon:'bi-graph-up-arrow', color:'#22C55E'},
  youtube: {name:'YouTube',      icon:'bi-youtube',        color:'#EF4444'},
  stock:   {name:'Adobe Stock',  icon:'bi-images',         color:'#F97316'},
  trading: {name:'Trading',      icon:'bi-bar-chart-fill', color:'#06B6D4'},
  agency:  {name:'Agency',       icon:'bi-briefcase-fill', color:'#A855F7'},
  learning:{name:'Learning',     icon:'bi-book-fill',      color:'#14B8A6'},
  health:  {name:'Health',       icon:'bi-heart-pulse-fill',color:'#84CC16'},
  custom:  {name:'Custom',       icon:'bi-grid',           color:'#6B7280'},
};

const KANBAN_COLS = [
  {id:'todo',label:'Todo',color:'#6B7280'},
  {id:'active',label:'In Progress',color:'#6366F1'},
  {id:'review',label:'Review',color:'#F97316'},
  {id:'completed',label:'Completed',color:'#22C55E'},
];
const THEMES = ['midnight','space','arctic','cyber','aurora'];
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ════════ STATE ════════
const S = {
  user:null, workspaces:[], nodes:[], transactions:[],
  calEvents:[], notifications:[], aiInsights:[],
  settings:{theme:'midnight', geminiKey:'', baseCurrency:'INR'},
  view:'global-dashboard', activeWsId:null, wsTab:'roadmap',
  selectedNodeId:null, finPeriod:'monthly',
  calYear:new Date().getFullYear(), calMonth:new Date().getMonth(),
  canvas:{x:80,y:120,scale:1},
  drag:{on:false,nodeId:null,sx:0,sy:0,nx:0,ny:0},
  pan:{on:false,sx:0,sy:0,ox:0,oy:0},
  saveTimer:null, themeIdx:0, cmdFocusIdx:0,
  _nmType:'goal', _wsType:'life',
};

// ════════ HELPERS ════════
const $  = id  => document.getElementById(id);
const el = (tag,cls='',html='') => { const e=document.createElement(tag); if(cls)e.className=cls; if(html)e.innerHTML=html; return e; };
const uid = () => Math.random().toString(36).slice(2,9)+Date.now().toString(36);
const now = () => new Date().toISOString();
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const pct = (cur,tgt) => tgt>0?Math.min(100,Math.round((+cur||0)/(+tgt||1)*100)):0;
const fmtN = n => { const v=Number(n)||0; if(Math.abs(v)>=1e7)return (v/1e7).toFixed(1)+'Cr'; if(Math.abs(v)>=1e5)return (v/1e5).toFixed(1)+'L'; if(Math.abs(v)>=1000)return (v/1000).toFixed(1)+'K'; return v.toLocaleString('en-IN'); };
const fmtCur = (v,c='INR') => (CURRENCIES[c||'INR']||CURRENCIES.INR).symbol+fmtN(v);
const toINR = (v,c) => (+v||0)*((CURRENCIES[c||'INR']||CURRENCIES.INR).rate);
const colorOf = t => (SCHEMAS[t]||SCHEMAS.goal).color;
const iconOf  = t => (SCHEMAS[t]||SCHEMAS.goal).icon;
const daysUntil = d => { if(!d)return null; return Math.ceil((new Date(d)-Date.now())/86400000); };
const dateLabel = d => { if(!d)return '—'; const days=daysUntil(d); if(days===0)return 'Today'; if(days===1)return 'Tomorrow'; if(days===-1)return 'Yesterday'; if(days<0)return `${Math.abs(days)}d overdue`; return `${days}d left`; };
const todayStr = () => new Date().toDateString();
const monthKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const wsNodes  = wsId => S.nodes.filter(n=>n.wsId===wsId);
const activeNodes = () => wsNodes(S.activeWsId||'');
const timeAgo = iso => { if(!iso)return ''; const diff=(Date.now()-new Date(iso))/1000; if(diff<60)return 'Just now'; if(diff<3600)return `${Math.floor(diff/60)}m ago`; if(diff<86400)return `${Math.floor(diff/3600)}h ago`; return `${Math.floor(diff/86400)}d ago`; };

// ════════ TOAST & SAVE DOT ════════
function toast(msg,type='info',dur=3200){
  const c=$('toast-container'); if(!c)return;
  const icons={success:'bi-check-circle',error:'bi-x-circle',info:'bi-info-circle'};
  const t=el('div',`toast ${type}`,`<i class="bi ${icons[type]||'bi-info-circle'}"></i>${esc(msg)}`);
  c.appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),200);},dur);
}
function setSaveDot(s){const d=$('save-dot');if(!d)return;d.className='save-dot'+(s==='saving'?' saving':s==='error'?' error':'');}

// ════════ PERSIST ════════
function scheduleSave(){
  setSaveDot('saving'); clearTimeout(S.saveTimer);
  S.saveTimer=setTimeout(async()=>{
    if(!S.user||!window.FIREBASE_READY)return setSaveDot('saved');
    try{
      const uid=S.user.uid;
      await FB.saveProfile(uid,{settings:S.settings});
      await Promise.all([
        ...S.workspaces.map(w=>FB.saveToSub(uid,'workspaces',w.id,w)),
        ...S.nodes.map(n=>FB.saveToSub(uid,'nodes',n.id,n)),
      ]);
      setSaveDot('saved');
    }catch(e){setSaveDot('error');console.warn(e);}
  },900);
}
async function saveTx(tx){if(!S.user||!window.FIREBASE_READY)return;await FB.saveToSub(S.user.uid,'transactions',tx.id,tx);}
async function saveEvent(ev){if(!S.user||!window.FIREBASE_READY)return;await FB.saveToSub(S.user.uid,'calEvents',ev.id,ev);}
async function saveNotif(n){if(!S.user||!window.FIREBASE_READY)return;await FB.saveToSub(S.user.uid,'notifications',n.id,n);}

// ════════ AUTH ════════
function showLoader(){const l=$('app-loader');if(l)l.classList.remove('hidden');}
function hideLoader(){const l=$('app-loader');if(l)l.classList.add('hidden');}

async function initAuth(){
  const shareId=new URLSearchParams(location.search).get('share');
  if(shareId){loadSharedMapView(shareId);return;}
  FB.init();
  if(!window.FIREBASE_READY){hideLoader();$('auth-overlay').classList.remove('hidden');return;}
  FB.onAuthChange(u=>{ if(u){showApp(u);}else{hideLoader();$('auth-overlay').classList.remove('hidden');} });
}

async function showApp(user){
  S.user=user; hideLoader();
  $('auth-overlay').classList.add('hidden');
  if(user){
    const av=$('sb-avatar');
    if(av)av.innerHTML=user.photoURL?`<img src="${user.photoURL}" alt=""/>`:(user.displayName||'U')[0].toUpperCase();
    const nm=$('sb-user-name'); if(nm)nm.textContent=user.displayName||user.email||'User';
  }
  await loadData();
}

async function loadData(){
  if(!S.user||!window.FIREBASE_READY)return;
  const uid=S.user.uid;
  try{
    const [profile,workspaces,nodes,transactions,calEvents,notifications]=await Promise.all([
      FB.loadProfile(uid), FB.loadSub(uid,'workspaces'), FB.loadSub(uid,'nodes'),
      FB.loadSub(uid,'transactions'), FB.loadSub(uid,'calEvents'), FB.loadSub(uid,'notifications'),
    ]);
    if(profile?.settings)Object.assign(S.settings,profile.settings);
    S.workspaces=workspaces||[]; S.nodes=nodes||[];
    S.transactions=transactions||[]; S.calEvents=calEvents||[]; S.notifications=notifications||[];
  }catch(e){console.warn('Load error',e);}
  applyTheme(S.settings.theme||'midnight');
  S.activeWsId=S.workspaces[0]?.id||null;
  $('app').classList.remove('hidden');
  renderSidebar(); setView('global-dashboard');
  checkAutomation(); setSaveDot('saved');
}

async function loadSharedMapView(shareId){
  hideLoader(); FB.init();
  try{
    const data=await FB.loadSharedMap(shareId);
    if(!data){document.body.innerHTML='<div style="display:flex;height:100vh;align-items:center;justify-content:center;font-family:sans-serif;color:#888">Shared map not found.</div>';return;}
    S.workspaces=[data.workspace]; S.nodes=data.nodes||[]; S.activeWsId=data.workspace.id;
    $('app').classList.remove('hidden'); applyTheme('midnight');
    document.querySelectorAll('#ws-add-node-btn,#ws-delete-btn,#sb-add-ws').forEach(e=>e&&(e.style.display='none'));
    const banner=el('div','',`<div style="display:flex;align-items:center;gap:8px;padding:8px 16px;background:var(--ac-bg);border-bottom:1px solid var(--ac-bd);font-size:12.5px;color:var(--tx-2);"><i class="bi bi-eye"></i> Viewing <strong style="margin:0 3px">${esc(data.workspace.name)}</strong> · <a href="${location.origin}${location.pathname}" style="color:var(--ac)">Create your own LifeOS</a></div>`);
    $('main').prepend(banner);
    renderSidebar(); setView('workspace'); setWsTab('roadmap');
  }catch(e){document.body.innerHTML='<div style="height:100vh;display:flex;align-items:center;justify-content:center;color:#888">Unable to load map.</div>';}
}

// ════════ THEME ════════
function applyTheme(t){document.documentElement.dataset.theme=t;S.settings.theme=t;S.themeIdx=Math.max(0,THEMES.indexOf(t));}
function cycleTheme(){applyTheme(THEMES[(S.themeIdx+1)%THEMES.length]);scheduleSave();}

// ════════ SIDEBAR ════════
function renderSidebar(){
  renderWorkspaceNav();
  const unread=S.notifications.filter(n=>!n.read).length;
  const badge=$('notif-badge');
  if(badge){badge.textContent=unread>0?unread:'';badge.style.display=unread>0?'':'none';}
  document.querySelectorAll('#global-nav .nav-btn[data-view]').forEach(b=>{
    b.classList.toggle('active',b.dataset.view===S.view&&S.view!=='workspace');
  });
  document.querySelectorAll('.nav-btn[data-view="settings"]').forEach(b=>{
    b.classList.toggle('active',S.view==='settings');
  });
}

function renderWorkspaceNav(){
  const wrap=$('sb-workspaces'); if(!wrap)return;
  wrap.innerHTML='';
  S.workspaces.forEach(ws=>{
    const wt=WS_TYPES[ws.type]||WS_TYPES.custom;
    const isActive=ws.id===S.activeWsId&&S.view==='workspace';
    const item=el('div',`ws-nav-item${isActive?' active':''}`);
    if(isActive)item.style.borderLeft=`2.5px solid ${ws.color||wt.color}`;
    item.innerHTML=`<i class="bi ${ws.icon||wt.icon} ws-nav-icon" style="color:${ws.color||wt.color}"></i><span class="ws-nav-name nav-lbl">${esc(ws.name)}</span><span class="ws-nav-actions"><button class="ws-nav-act share" title="Share"><i class="bi bi-share"></i></button><button class="ws-nav-act" title="Delete"><i class="bi bi-trash3"></i></button></span>`;
    item.querySelector('.ws-nav-name').onclick=()=>openWorkspace(ws.id);
    item.querySelector('.ws-nav-icon').onclick=()=>openWorkspace(ws.id);
    item.querySelector('.ws-nav-act.share').onclick=e=>{e.stopPropagation();shareWorkspace(ws.id);};
    item.querySelector('.ws-nav-act:not(.share)').onclick=e=>{e.stopPropagation();deleteWorkspace(ws.id);};
    wrap.appendChild(item);
  });
}

// ════════ NAVIGATION ════════
function setView(view){
  S.view=view;
  document.querySelectorAll('.view-page').forEach(v=>v.classList.remove('active'));
  const isWs=(view==='workspace');
  $('ws-subnav').classList.toggle('hidden',!isWs);
  $('global-topbar').classList.toggle('hidden',isWs);
  $('canvas-toolbar').classList.toggle('hidden',!(isWs&&S.wsTab==='roadmap'));
  if(isWs){
    renderWorkspaceView();
  }else{
    const vEl=$(`view-${view}`); if(vEl)vEl.classList.add('active');
    const titles={'global-dashboard':'Dashboard','financial-overview':'Financial Intelligence','calendar':'Calendar','notifications':'Notifications','search':'Search','settings':'Settings'};
    const te=$('topbar-title'); if(te)te.textContent=titles[view]||'';
    renderGlobalView(view);
  }
  renderSidebar();
}

function openWorkspace(wsId){
  S.activeWsId=wsId; S.view='workspace';
  const ws=S.workspaces.find(w=>w.id===wsId);
  if(ws){
    const wt=WS_TYPES[ws.type]||WS_TYPES.custom;
    const icon=$('ws-title-icon'); if(icon){icon.className=`bi ${ws.icon||wt.icon} ws-title-icon`;icon.style.color=ws.color||wt.color;}
    const nm=$('ws-title-name'); if(nm)nm.textContent=ws.name;
  }
  setView('workspace');
}

function setWsTab(tab){
  S.wsTab=tab;
  document.querySelectorAll('.ws-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  renderWorkspaceView();
  $('canvas-toolbar').classList.toggle('hidden',tab!=='roadmap');
}

function renderWorkspaceView(){
  document.querySelectorAll('.ws-view').forEach(v=>v.classList.remove('active'));
  const vEl=$(`view-workspace-${S.wsTab}`); if(vEl)vEl.classList.add('active');
  switch(S.wsTab){
    case 'roadmap':   initCanvasPan(); renderCanvas(); break;
    case 'timeline':  renderTimeline(); break;
    case 'kanban':    renderKanban(); break;
    case 'analytics': renderWsAnalytics(); break;
    case 'dashboard': renderWsDashboard(); break;
  }
}

function renderGlobalView(view){
  switch(view){
    case 'global-dashboard':   renderGlobalDashboard(); break;
    case 'financial-overview': renderFinancialOverview(); break;
    case 'calendar':           renderCalendar(); break;
    case 'notifications':      renderNotifications(); break;
    case 'search':             renderSearch(''); break;
    case 'settings':           renderSettings(); break;
  }
}

// ════════ GLOBAL DASHBOARD ════════
function renderGlobalDashboard(){
  const c=$('gd-content'); if(!c)return; c.innerHTML='';
  const totalNodes=S.nodes.length;
  const completedNodes=S.nodes.filter(n=>n.status==='completed').length;
  const activeGoals=S.nodes.filter(n=>n.type==='goal'&&n.status!=='completed').length;
  const totalDebt=S.nodes.filter(n=>n.type==='debt').reduce((s,n)=>s+toINR(n.remainingBalance||n.principal||0,n.currency),0);
  const nw=calcNetWorth();
  const unread=S.notifications.filter(n=>!n.read).length;
  const todayIncome=S.transactions.filter(t=>new Date(t.date).toDateString()===todayStr()&&t.txType==='income').reduce((s,t)=>s+toINR(t.amount,t.currency),0);

  const statGrid=el('div','gd-stat-grid');
  [{icon:'bi-bullseye',color:'#6366F1',val:activeGoals,lbl:'Active Goals'},
   {icon:'bi-check-circle',color:'#22C55E',val:completedNodes,lbl:'Completed'},
   {icon:'bi-graph-up-arrow',color:'#10B981',val:fmtCur(nw,'INR'),lbl:'Net Worth'},
   {icon:'bi-exclamation-circle',color:'#EF4444',val:fmtCur(totalDebt,'INR'),lbl:'Total Debt'},
   {icon:'bi-currency-dollar',color:'#10B981',val:fmtCur(todayIncome,'INR'),lbl:"Today's Income"},
   {icon:'bi-bell',color:'#EAB308',val:unread,lbl:'Notifications'},
  ].forEach(s=>{
    const card=el('div','stat-card');
    card.innerHTML=`<div class="stat-card-top"><i class="bi ${s.icon} stat-card-icon" style="color:${s.color}"></i></div><div class="stat-card-val">${s.val}</div><div class="stat-card-lbl">${s.lbl}</div>`;
    statGrid.appendChild(card);
  });
  c.appendChild(statGrid);

  const grid=el('div','gd-grid');

  // Workspace summaries
  const wsCard=el('div','gd-card');
  wsCard.innerHTML=`<div class="gd-card-title">WORKSPACES <span class="gd-card-action">${S.workspaces.length} active</span></div>`;
  const wsAct=el('div','ws-activity-list');
  if(!S.workspaces.length){
    wsAct.innerHTML='<div style="text-align:center;color:var(--tx-3);padding:24px;font-size:13px">No workspaces yet — create one in the sidebar</div>';
  }else{
    S.workspaces.slice(0,6).forEach(ws=>{
      const wt=WS_TYPES[ws.type]||WS_TYPES.custom;
      const nodes=wsNodes(ws.id);
      const done=nodes.filter(n=>n.status==='completed').length;
      const p=nodes.length?pct(done,nodes.length):0;
      const item=el('div','ws-activity-item');
      item.onclick=()=>openWorkspace(ws.id);
      item.innerHTML=`<div class="ws-act-icon" style="background:${ws.color||wt.color}22;color:${ws.color||wt.color}"><i class="bi ${ws.icon||wt.icon}"></i></div><div class="ws-act-info"><div class="ws-act-name">${esc(ws.name)}</div><div class="ws-act-meta">${nodes.length} nodes · ${done} done</div></div><div class="ws-act-progress" style="color:${ws.color||wt.color}">${p}%</div>`;
      wsAct.appendChild(item);
    });
  }
  wsCard.appendChild(wsAct);
  grid.appendChild(wsCard);

  // AI Insights
  const aiCard=el('div','gd-card');
  aiCard.innerHTML=`<div class="gd-card-title"><i class="bi bi-stars" style="color:var(--ac)"></i>&nbsp;AI INSIGHTS <span class="gd-card-action" id="ai-refresh-btn" style="cursor:pointer;color:var(--ac)">Refresh</span></div><div id="ai-insights-container"><div class="ai-insight-loading"><div class="ai-spinner"></div>Loading insights…</div></div>`;
  grid.appendChild(aiCard);
  c.appendChild(grid);

  // Upcoming deadlines
  const deadlines=getUpcomingDeadlines();
  if(deadlines.length){
    const dlCard=el('div','gd-card');
    dlCard.innerHTML=`<div class="gd-card-title">UPCOMING DEADLINES</div>`;
    const dlList=el('div','deadline-list');
    deadlines.slice(0,6).forEach(d=>{
      const days=daysUntil(d.date);
      const item=el('div',`deadline-item${days!==null&&days<0?' overdue':''}`);
      item.innerHTML=`<i class="bi ${iconOf(d.type)}" style="color:${colorOf(d.type)}"></i><span style="flex:1">${esc(d.title)}</span><span class="deadline-days${days!==null&&days<=3?' urgent':''}">${dateLabel(d.date)}</span>`;
      dlList.appendChild(item);
    });
    dlCard.appendChild(dlList);
    c.appendChild(dlCard);
  }

  setTimeout(()=>{
    loadAIInsights();
    const rb=$('ai-refresh-btn'); if(rb)rb.onclick=()=>loadAIInsights(true);
  },50);
}

function getUpcomingDeadlines(){
  const items=[];
  S.nodes.forEach(n=>{
    if(n.dueDate&&n.status!=='completed')items.push({title:n.title,date:n.dueDate,type:n.type});
    if(n.type==='debt'&&n.dueDate)items.push({title:`EMI: ${n.title}`,date:n.dueDate,type:'debt'});
  });
  return items.sort((a,b)=>new Date(a.date)-new Date(b.date));
}

function calcNetWorth(){
  const assets=S.nodes.filter(n=>n.type==='asset'||n.type==='investment').reduce((s,n)=>s+toINR(n.currentValue||0,n.currency),0);
  const debts=S.nodes.filter(n=>n.type==='debt').reduce((s,n)=>s+toINR(n.remainingBalance||n.principal||0,n.currency),0);
  return assets-debts;
}

// ════════ AI ENGINE ════════
async function loadAIInsights(force=false){
  const key=S.settings.geminiKey;
  const container=$('ai-insights-container'); if(!container)return;
  if(!key){
    container.innerHTML=`<div class="ai-insight-card"><div class="ai-insight-header"><i class="bi bi-stars"></i> AI Insights</div><div class="ai-insight-text">Add your Gemini API key in <strong>Settings → AI Intelligence</strong> to unlock contextual insights.</div></div>`;
    return;
  }
  if(S.aiInsights.length&&!force){renderAIInsights(container);return;}
  container.innerHTML=`<div class="ai-insight-loading"><div class="ai-spinner"></div>Analyzing your data…</div>`;
  try{
    const ctx=buildAIContext();
    const prompt=`You are a personal life and financial intelligence AI. Analyze this data and provide exactly 3 specific, actionable insights:\n\n${ctx}\n\nRules: Give exactly 3 insights, each starting with "•". Be specific with numbers. Keep each under 2 sentences. Focus on finance, debt reduction, and productivity.`;
    const resp=await fetch(`${GEMINI_URL}?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:400}})});
    const data=await resp.json();
    const text=data.candidates?.[0]?.content?.parts?.[0]?.text||'';
    S.aiInsights=text.split('\n').filter(l=>l.trim().startsWith('•')).map(l=>l.replace(/^•\s*/,'').trim()).filter(Boolean);
    if(!S.aiInsights.length&&text)S.aiInsights=[text.trim()];
    renderAIInsights(container);
  }catch(e){
    container.innerHTML=`<div class="ai-insight-card"><div class="ai-insight-text" style="color:var(--red)"><i class="bi bi-exclamation-triangle"></i> Failed to load AI insights. Check your API key in Settings.</div></div>`;
  }
}

function buildAIContext(){
  const mIncome=getTxTotal('income','monthly');
  const mExpense=getTxTotal('expense','monthly');
  const debts=S.nodes.filter(n=>n.type==='debt');
  const investments=S.nodes.filter(n=>n.type==='investment');
  return `Financial Summary (INR):
Net Worth: ₹${fmtN(calcNetWorth())}
Monthly Income: ₹${fmtN(mIncome)} (${S.nodes.filter(n=>n.type==='income').length} sources)
Monthly Expenses: ₹${fmtN(mExpense)} (${S.nodes.filter(n=>n.type==='expense').length} categories)
Cashflow: ₹${fmtN(mIncome-mExpense)}
Debts: ${debts.length} (Total ₹${fmtN(debts.reduce((s,d)=>s+toINR(d.remainingBalance||0,d.currency),0))})
Investments: ${investments.length} (₹${fmtN(investments.reduce((s,i)=>s+toINR(i.currentValue||0,i.currency),0))})
Active Goals: ${S.nodes.filter(n=>n.type==='goal'&&n.status!=='completed').length}
Workspaces: ${S.workspaces.map(w=>w.name).join(', ')||'None'}`;
}

function renderAIInsights(container){
  container.innerHTML='';
  (S.aiInsights.length?S.aiInsights:['No insights available. Try refreshing.']).forEach(insight=>{
    const card=el('div','ai-insight-card');
    card.innerHTML=`<div class="ai-insight-header"><i class="bi bi-stars"></i> AI Insight</div><div class="ai-insight-text">${esc(insight)}</div>`;
    container.appendChild(card);
  });
}

// ════════ FINANCIAL ENGINE ════════
function filterTxByPeriod(txs,period){
  const now2=new Date();
  return txs.filter(t=>{
    const d=new Date(t.date);
    if(period==='weekly'){const w=new Date(now2);w.setDate(w.getDate()-7);return d>=w;}
    if(period==='monthly')return d.getFullYear()===now2.getFullYear()&&d.getMonth()===now2.getMonth();
    if(period==='quarterly'){const q=new Date(now2);q.setMonth(q.getMonth()-3);return d>=q;}
    if(period==='yearly')return d.getFullYear()===now2.getFullYear();
    return true; // lifetime
  });
}
function getTxTotal(txType,period='monthly'){return filterTxByPeriod(S.transactions.filter(t=>t.txType===txType),period).reduce((s,t)=>s+toINR(t.amount,t.currency),0);}
function getNodeTxTotal(nodeId,txType,period='monthly'){return filterTxByPeriod(S.transactions.filter(t=>t.nodeId===nodeId&&t.txType===txType),period).reduce((s,t)=>s+toINR(t.amount,t.currency),0);}

async function logTransaction(nodeId,wsId,txType,amount,currency,note,date){
  const tx={id:uid(),nodeId,wsId,txType,amount:+amount,currency,note:note||'',date:date||now()};
  S.transactions.push(tx); await saveTx(tx); scheduleSave();
  toast(`${txType==='income'?'+':'-'}${fmtCur(amount,currency)} logged`,'success');
  return tx;
}

// ════════ FINANCIAL OVERVIEW ════════
function renderFinancialOverview(){
  const c=$('fin-overview-content'); if(!c)return; c.innerHTML='';
  const p=S.finPeriod;
  const totalIncome=getTxTotal('income',p), totalExpense=getTxTotal('expense',p);
  const cashflow=totalIncome-totalExpense, nw=calcNetWorth();
  const totalDebt=S.nodes.filter(n=>n.type==='debt').reduce((s,n)=>s+toINR(n.remainingBalance||n.principal||0,n.currency),0);
  const totalAssets=S.nodes.filter(n=>n.type==='asset').reduce((s,n)=>s+toINR(n.currentValue||n.purchaseValue||0,n.currency),0);
  const totalInvest=S.nodes.filter(n=>n.type==='investment').reduce((s,n)=>s+toINR(n.currentValue||0,n.currency),0);
  const totalInvested=S.nodes.filter(n=>n.type==='investment').reduce((s,n)=>s+toINR(n.investedAmount||0,n.currency),0);
  const roi=totalInvested>0?pct(totalInvest-totalInvested,totalInvested):0;

  // KPI row
  const kpiRow=el('div','fin-kpi-row');
  [{icon:'bi-graph-up-arrow',color:'#22C55E',label:'Net Worth',val:fmtCur(nw,'INR'),vc:nw>=0?'#22C55E':'#EF4444'},
   {icon:'bi-currency-dollar',color:'#10B981',label:`${p} Income`,val:fmtCur(totalIncome,'INR'),vc:'#10B981'},
   {icon:'bi-cart3',color:'#F97316',label:`${p} Expenses`,val:fmtCur(totalExpense,'INR'),vc:'#F97316'},
   {icon:'bi-water',color:'#6366F1',label:'Cashflow',val:fmtCur(cashflow,'INR'),vc:cashflow>=0?'#22C55E':'#EF4444'},
   {icon:'bi-exclamation-circle',color:'#EF4444',label:'Total Debt',val:fmtCur(totalDebt,'INR'),vc:'#EF4444'},
   {icon:'bi-building-fill',color:'#6366F1',label:'Assets',val:fmtCur(totalAssets,'INR'),vc:'#6366F1'},
   {icon:'bi-bar-chart-fill',color:'#06B6D4',label:'Investments',val:fmtCur(totalInvest,'INR'),vc:'#06B6D4'},
   {icon:'bi-percent',color:'#8B5CF6',label:'Portfolio ROI',val:roi+'%',vc:roi>=0?'#22C55E':'#EF4444'},
  ].forEach(k=>{
    const card=el('div','fin-kpi');
    card.style.borderLeft=`3px solid ${k.color}`;
    card.innerHTML=`<div class="fin-kpi-icon"><i class="bi ${k.icon}" style="color:${k.color}"></i></div><div class="fin-kpi-val" style="color:${k.vc}">${k.val}</div><div class="fin-kpi-lbl">${k.label}</div>`;
    kpiRow.appendChild(card);
  });
  c.appendChild(kpiRow);

  // AI insight
  if(S.settings.geminiKey){
    const aiRow=el('div','');
    aiRow.innerHTML=`<div class="ai-insight-card"><div class="ai-insight-header"><i class="bi bi-stars"></i> Financial AI Analysis</div><div id="fin-ai-text" class="ai-insight-text"><span style="color:var(--tx-3)">Loading…</span></div></div>`;
    c.appendChild(aiRow);
    setTimeout(()=>loadFinAI($('fin-ai-text')),50);
  }

  // Income & Expense grid
  const secGrid=el('div','fin-section-grid');
  // Income
  const incCard=el('div','fin-section-card');
  incCard.innerHTML=`<div class="fin-section-title" style="color:var(--green)"><i class="bi bi-currency-dollar"></i> Income Sources</div>`;
  const incList=el('div','fin-item-list');
  S.nodes.filter(n=>n.type==='income').forEach(n=>{
    const amt=getNodeTxTotal(n.id,'income',p); const tgt=toINR(n.monthlyTarget||0,n.currency);
    const div=el('div','fin-item');
    div.innerHTML=`<div class="fin-item-dot" style="background:var(--green)"></div><div class="fin-item-name">${esc(n.title)}</div><div class="fin-item-val" style="color:var(--green)">${fmtCur(amt,'INR')}</div>`;
    if(tgt>0){const b=el('div','fin-item-bar');b.innerHTML=`<div class="fin-item-bar-fill" style="width:${pct(amt,tgt)}%;background:var(--green)"></div>`;div.appendChild(b);}
    div.style.cursor='pointer'; div.onclick=()=>selectNode(n.id);
    incList.appendChild(div);
  });
  if(!S.nodes.find(n=>n.type==='income'))incList.innerHTML=`<div style="color:var(--tx-3);font-size:12px;padding:10px 0">No income nodes. Add Income-type nodes to workspaces.</div>`;
  incCard.appendChild(incList); secGrid.appendChild(incCard);

  // Expenses
  const expCard=el('div','fin-section-card');
  expCard.innerHTML=`<div class="fin-section-title" style="color:var(--orange)"><i class="bi bi-cart3"></i> Expense Categories</div>`;
  const expList=el('div','fin-item-list');
  S.nodes.filter(n=>n.type==='expense').forEach(n=>{
    const amt=getNodeTxTotal(n.id,'expense',p); const budget=toINR(n.monthlyBudget||0,n.currency);
    const over=budget>0&&amt>budget;
    const div=el('div','fin-item');
    div.innerHTML=`<div class="fin-item-dot" style="background:var(--orange)"></div><div class="fin-item-name">${esc(n.title||n.category)}</div><div class="fin-item-val" style="color:${over?'var(--red)':'var(--orange)'}">${fmtCur(amt,'INR')}</div>`;
    if(budget>0){const b=el('div','fin-item-bar');b.innerHTML=`<div class="fin-item-bar-fill" style="width:${Math.min(100,pct(amt,budget))}%;background:${over?'var(--red)':'var(--orange)'}"></div>`;div.appendChild(b);}
    div.style.cursor='pointer'; div.onclick=()=>selectNode(n.id);
    expList.appendChild(div);
  });
  if(!S.nodes.find(n=>n.type==='expense'))expList.innerHTML=`<div style="color:var(--tx-3);font-size:12px;padding:10px 0">No expense nodes.</div>`;
  expCard.appendChild(expList); secGrid.appendChild(expCard);
  c.appendChild(secGrid);

  // Debt analytics
  const debts=S.nodes.filter(n=>n.type==='debt');
  if(debts.length){
    const debtCard=el('div','fin-section-card'); debtCard.style.gridColumn='1/-1';
    debtCard.innerHTML=`<div class="fin-section-title" style="color:var(--red)"><i class="bi bi-exclamation-circle"></i> Debt Analytics</div>`;
    debts.forEach(d=>{
      const rem=d.remainingBalance||d.principal||0; const prin=d.principal||rem;
      const paid=prin-rem; const p2=pct(paid,prin);
      const days=daysUntil(d.dueDate);
      const item=el('div','debt-item');
      item.innerHTML=`<div class="debt-item-header"><span class="debt-item-name">${esc(d.title)}</span><span class="debt-item-badge" style="${days!==null&&days<0?'background:var(--red-bg);color:var(--red)':''}">${days!==null&&days<0?'OVERDUE':`EMI: ${fmtCur(d.emi||0,d.currency)}`}</span></div><div class="debt-item-row"><span>Remaining: <strong>${fmtCur(rem,d.currency)}</strong></span><span>Rate: ${d.interestRate||0}% p.a.</span><span>Due: ${d.dueDate||'—'}</span></div><div class="debt-item-bar"><div class="debt-item-fill" style="width:${p2}%"></div></div>`;
      item.style.cursor='pointer'; item.onclick=()=>{selectNode(d.id);};
      debtCard.appendChild(item);
    });
    const totalEMI=debts.reduce((s,d)=>s+toINR(d.emi||0,d.currency),0);
    const sumRow=el('div','');sumRow.style.cssText='margin-top:10px;padding:10px;background:var(--bg-3);border-radius:var(--r-s);display:flex;justify-content:space-between;font-size:13px;';
    sumRow.innerHTML=`<span>Total Monthly EMI</span><span style="font-family:var(--font-m);font-weight:700;color:var(--red)">₹${fmtN(totalEMI)}</span>`;
    debtCard.appendChild(sumRow);
    c.appendChild(debtCard);
  }

  // Investments
  const invests=S.nodes.filter(n=>n.type==='investment');
  if(invests.length){
    const invCard=el('div','fin-section-card'); invCard.style.gridColumn='1/-1';
    invCard.innerHTML=`<div class="fin-section-title" style="color:var(--ac)"><i class="bi bi-bar-chart-fill"></i> Investment Portfolio</div>`;
    invests.forEach(inv=>{
      const invested=toINR(inv.investedAmount||0,inv.currency);
      const current=toINR(inv.currentValue||0,inv.currency);
      const pnl=current-invested; const r2=invested>0?((pnl/invested)*100).toFixed(1):0;
      const item=el('div','debt-item');
      item.innerHTML=`<div class="debt-item-header"><span class="debt-item-name">${esc(inv.title)}</span><span style="font-size:11px;font-family:var(--font-m);color:${pnl>=0?'var(--green)':'var(--red)'}">ROI: ${r2>=0?'+':''}${r2}%</span></div><div class="debt-item-row"><span>Invested: <strong>₹${fmtN(invested)}</strong></span><span>Value: <strong style="color:${pnl>=0?'var(--green)':'var(--red)'}">₹${fmtN(current)}</strong></span><span>P&L: <strong style="color:${pnl>=0?'var(--green)':'var(--red)'}">₹${fmtN(Math.abs(pnl))}</strong></span></div>`;
      invCard.appendChild(item);
    });
    c.appendChild(invCard);
  }
}

async function loadFinAI(el2){
  if(!el2||!S.settings.geminiKey)return;
  const mI=getTxTotal('income',S.finPeriod), mE=getTxTotal('expense',S.finPeriod);
  const debts=S.nodes.filter(n=>n.type==='debt');
  const prompt=`Financial data: Income ₹${fmtN(mI)}, Expenses ₹${fmtN(mE)}, Cashflow ₹${fmtN(mI-mE)}, ${debts.length} active debts. Provide ONE specific, actionable financial insight in 1-2 sentences. Use real numbers.`;
  try{
    const resp=await fetch(`${GEMINI_URL}?key=${S.settings.geminiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:150}})});
    const data=await resp.json();
    if(el2)el2.textContent=(data.candidates?.[0]?.content?.parts?.[0]?.text||'').trim()||'No insight available.';
  }catch(e){if(el2)el2.textContent='AI insight unavailable.';}
}

// ════════ CALENDAR ════════
function renderCalendar(){
  const c=$('cal-content'); if(!c)return; c.innerHTML='';
  const year=S.calYear, month=S.calMonth;
  const monthName=new Date(year,month,1).toLocaleString('default',{month:'long',year:'numeric'});
  const nav=el('div','cal-nav');
  nav.innerHTML=`<button class="cal-nav-btn" id="cal-prev"><i class="bi bi-chevron-left"></i></button><div class="cal-nav-title">${monthName}</div><button class="cal-nav-btn" id="cal-next"><i class="bi bi-chevron-right"></i></button>`;
  c.appendChild(nav);
  nav.querySelector('#cal-prev').onclick=()=>{S.calMonth--;if(S.calMonth<0){S.calMonth=11;S.calYear--;}renderCalendar();};
  nav.querySelector('#cal-next').onclick=()=>{S.calMonth++;if(S.calMonth>11){S.calMonth=0;S.calYear++;}renderCalendar();};
  const hdr=el('div','cal-grid-header',['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-day-label">${d}</div>`).join(''));
  c.appendChild(hdr);
  const grid=el('div','cal-grid');
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const daysInPrev=new Date(year,month,0).getDate();
  const today2=new Date();
  const monthEvts=getMonthEvents(year,month);
  for(let i=0;i<42;i++){
    let day, isOther=false;
    if(i<firstDay){day=daysInPrev-firstDay+i+1;isOther=true;}
    else if(i>=firstDay+daysInMonth){day=i-firstDay-daysInMonth+1;isOther=true;}
    else day=i-firstDay+1;
    const isToday=!isOther&&day===today2.getDate()&&month===today2.getMonth()&&year===today2.getFullYear();
    const dateStr=isOther?null:`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const cell=el('div',`cal-cell${isOther?' other-month':''}${isToday?' today':''}`);
    cell.innerHTML=`<div class="cal-cell-date">${day}</div>`;
    if(dateStr){
      monthEvts.filter(e=>e.date&&e.date.startsWith(dateStr)).slice(0,2).forEach(ev=>{
        cell.appendChild(el('div',`cal-event-dot ${ev.category||'milestone'}`,esc(ev.title.slice(0,16))));
      });
    }
    grid.appendChild(cell);
  }
  c.appendChild(grid);
  // EMI schedule
  const emiNodes=S.nodes.filter(n=>n.type==='debt'&&n.dueDate);
  if(emiNodes.length){
    const emiCard=el('div','cal-emi-summary');
    emiCard.innerHTML=`<div class="cal-emi-title"><i class="bi bi-exclamation-circle" style="color:var(--red)"></i> EMI Schedule — All Active Debts</div>`;
    const list=el('div','emi-list');
    emiNodes.forEach(n=>{
      const days=daysUntil(n.dueDate);
      const row=el('div',`emi-row${days!==null&&days<0?' overdue':''}`);
      row.innerHTML=`<i class="bi bi-exclamation-circle" style="color:${days!==null&&days<0?'var(--red)':'var(--yellow)'}"></i><span class="emi-name">${esc(n.title)}</span><span class="emi-amount" style="color:var(--red)">${fmtCur(n.emi||0,n.currency)}</span><span class="emi-date">${n.dueDate||'—'}&nbsp;(${dateLabel(n.dueDate)})</span>`;
      row.onclick=()=>selectNode(n.id);
      list.appendChild(row);
    });
    emiCard.appendChild(list);
    c.appendChild(emiCard);
  }
}

function getMonthEvents(year,month){
  const events=[];
  S.nodes.filter(n=>n.type==='debt'&&n.dueDate).forEach(n=>events.push({title:`EMI: ${n.title}`,date:n.dueDate,category:'emi'}));
  S.nodes.filter(n=>n.dueDate&&n.status!=='completed').forEach(n=>events.push({title:n.title,date:n.dueDate,category:'milestone'}));
  S.calEvents.forEach(e=>events.push(e));
  return events.filter(e=>{if(!e.date)return false;const d=new Date(e.date);return d.getFullYear()===year&&d.getMonth()===month;});
}

// ════════ NOTIFICATIONS ════════
function renderNotifications(){
  const c=$('notif-list'); if(!c)return; c.innerHTML='';
  if(!S.notifications.length){c.innerHTML=`<div class="notif-empty"><i class="bi bi-bell-slash" style="font-size:36px;display:block;margin-bottom:12px"></i>No notifications</div>`;return;}
  const typeIcons={emi:'bi-exclamation-circle',deadline:'bi-flag-fill',automation:'bi-lightning-fill',ai:'bi-stars',system:'bi-info-circle'};
  const typeColors={emi:'var(--red)',deadline:'var(--ac)',automation:'var(--orange)',ai:'var(--green)',system:'var(--tx-2)'};
  [...S.notifications].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).forEach(n=>{
    const icon=typeIcons[n.type]||'bi-bell', color=typeColors[n.type]||'var(--ac)';
    const item=el('div',`notif-item${n.read?'':' unread'}`);
    item.innerHTML=`<div class="notif-icon" style="background:${color}22;color:${color}"><i class="bi ${icon}"></i></div><div class="notif-body"><div class="notif-title">${esc(n.title)}</div><div class="notif-text">${esc(n.body||'')}</div></div><div class="notif-time">${timeAgo(n.createdAt)}</div>`;
    item.onclick=async()=>{n.read=true;await saveNotif(n);renderSidebar();renderNotifications();};
    c.appendChild(item);
  });
  const mr=$('mark-all-read');
  if(mr)mr.onclick=async()=>{S.notifications.forEach(n=>n.read=true);await Promise.all(S.notifications.map(n=>saveNotif(n)));renderSidebar();renderNotifications();};
}

function addNotification(title,body,type='system'){
  const n={id:uid(),title,body,type,read:false,createdAt:now()};
  S.notifications.unshift(n); saveNotif(n); renderSidebar();
}

// ════════ AUTOMATION ════════
function checkAutomation(){
  S.nodes.filter(n=>n.type==='debt'&&n.dueDate).forEach(n=>{
    const days=daysUntil(n.dueDate);
    if(days!==null&&days>=0&&days<=3){
      const key=`emi-${n.id}-${monthKey()}`;
      if(!S.notifications.find(no=>no.key===key)){
        const no={id:uid(),title:`EMI Due Soon: ${n.title}`,body:`${fmtCur(n.emi||0,n.currency)} due on ${n.dueDate}`,type:'emi',read:false,createdAt:now(),key};
        S.notifications.unshift(no); saveNotif(no);
      }
    }
    if(days!==null&&days<0){
      const key=`emi-overdue-${n.id}-${monthKey()}`;
      if(!S.notifications.find(no=>no.key===key)){
        const no={id:uid(),title:`OVERDUE EMI: ${n.title}`,body:`Payment of ${fmtCur(n.emi||0,n.currency)} was due ${Math.abs(days)} day(s) ago`,type:'emi',read:false,createdAt:now(),key};
        S.notifications.unshift(no); saveNotif(no);
      }
    }
  });
  S.nodes.filter(n=>n.dueDate&&n.status!=='completed').forEach(n=>{
    const days=daysUntil(n.dueDate);
    if(days===1){
      const key=`deadline-${n.id}-${new Date().toDateString()}`;
      if(!S.notifications.find(no=>no.key===key)){
        const no={id:uid(),title:`Deadline Tomorrow: ${n.title}`,body:`Due date: ${n.dueDate}`,type:'deadline',read:false,createdAt:now(),key};
        S.notifications.unshift(no); saveNotif(no);
      }
    }
  });
  renderSidebar();
}

// ════════ SEARCH ════════
function renderSearch(query){
  const c=$('search-results'); if(!c)return;
  if(!query.trim()){c.innerHTML=`<div style="color:var(--tx-3);text-align:center;padding:48px;font-size:13px"><i class="bi bi-search" style="font-size:28px;display:block;margin-bottom:10px;opacity:.3"></i>Search nodes, workspaces, transactions…</div>`;return;}
  const q=query.toLowerCase();
  const wsR=S.workspaces.filter(w=>w.name.toLowerCase().includes(q));
  const nodeR=S.nodes.filter(n=>n.title.toLowerCase().includes(q)||n.notes?.toLowerCase().includes(q));
  c.innerHTML='';
  if(wsR.length){
    const g=el('div','search-result-group','<div class="search-result-group-label">Workspaces</div>');
    wsR.forEach(w=>{const wt=WS_TYPES[w.type]||WS_TYPES.custom;const item=el('div','search-result-item');item.innerHTML=`<i class="bi ${w.icon||wt.icon}" style="color:${w.color||wt.color}"></i><span>${esc(w.name)}</span>`;item.onclick=()=>openWorkspace(w.id);g.appendChild(item);});
    c.appendChild(g);
  }
  if(nodeR.length){
    const g=el('div','search-result-group',`<div class="search-result-group-label">Nodes (${nodeR.length})</div>`);
    nodeR.slice(0,12).forEach(n=>{
      const item=el('div','search-result-item');
      item.innerHTML=`<i class="bi ${iconOf(n.type)}" style="color:${colorOf(n.type)}"></i><div style="flex:1"><div style="font-size:13px;font-weight:500">${esc(n.title)}</div><div style="font-size:11px;color:var(--tx-3)">${(SCHEMAS[n.type]||{label:''}).label} · ${S.workspaces.find(w=>w.id===n.wsId)?.name||'?'}</div></div>`;
      item.onclick=()=>{openWorkspace(n.wsId);setWsTab('roadmap');setTimeout(()=>{selectNode(n.id);centerOn(n);},100);};
      g.appendChild(item);
    });
    c.appendChild(g);
  }
  if(!wsR.length&&!nodeR.length)c.innerHTML=`<div style="color:var(--tx-3);text-align:center;padding:40px;font-size:13px">No results for "${esc(query)}"</div>`;
}

// ════════ WORKSPACE MANAGEMENT ════════
function openAddWsModal(){
  S._wsType='life';
  const grid=$('ws-type-grid'); if(grid)buildWsTypeGrid(grid);
  $('ws-name').value='';
  openModal('add-ws-modal'); setTimeout(()=>$('ws-name')?.focus(),60);
}

function buildWsTypeGrid(grid){
  grid.innerHTML='';
  Object.entries(WS_TYPES).forEach(([key,wt])=>{
    const btn=el('div',`ws-type-btn${key===S._wsType?' active':''}`);
    btn.innerHTML=`<i class="bi ${wt.icon} ws-type-btn-icon" style="color:${wt.color}"></i><span class="ws-type-btn-name">${wt.name}</span>`;
    btn.onclick=()=>{S._wsType=key;grid.querySelectorAll('.ws-type-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');};
    grid.appendChild(btn);
  });
}

async function createWorkspace(){
  const name=$('ws-name')?.value.trim(); if(!name){toast('Enter a workspace name','error');return;}
  const wt=WS_TYPES[S._wsType]||WS_TYPES.custom;
  const ws={id:uid(),name,type:S._wsType,icon:wt.icon,color:wt.color,createdAt:now()};
  S.workspaces.push(ws); closeModal('add-ws-modal'); scheduleSave();
  renderSidebar(); openWorkspace(ws.id); toast(`"${name}" created`,'success');
}

async function deleteWorkspace(wsId){
  const ws=S.workspaces.find(w=>w.id===wsId); if(!ws)return;
  if(!confirm(`Delete "${ws.name}" and all its nodes? This cannot be undone.`))return;
  const nodeIds=S.nodes.filter(n=>n.wsId===wsId).map(n=>n.id);
  S.nodes=S.nodes.filter(n=>n.wsId!==wsId);
  S.workspaces=S.workspaces.filter(w=>w.id!==wsId);
  if(S.user&&window.FIREBASE_READY){
    await FB.deleteFromSub(S.user.uid,'workspaces',wsId);
    for(const nid of nodeIds)await FB.deleteFromSub(S.user.uid,'nodes',nid);
  }
  if(S.activeWsId===wsId){S.activeWsId=S.workspaces[0]?.id||null;setView('global-dashboard');}
  else renderSidebar();
  toast('Workspace deleted','info');
}

async function shareWorkspace(wsId){
  if(!S.user||!window.FIREBASE_READY){toast('Sign in to share','error');return;}
  const ws=S.workspaces.find(w=>w.id===wsId);
  const nodes=S.nodes.filter(n=>n.wsId===wsId);
  try{
    await FB.saveSharedMap(wsId,{workspace:ws,nodes,ownerId:S.user.uid,ownerName:S.user.displayName||''});
    const url=`${location.origin}${location.pathname}?share=${wsId}`;
    await navigator.clipboard.writeText(url);
    toast('Share link copied!','success',4000);
  }catch(e){toast('Share failed — check console','error');}
}

// ════════ NODE MANAGEMENT ════════
let _nmType='goal';
function openAddNodeModal(){
  _nmType='goal';
  $('nm-title').value=''; $('nm-currency').value='INR'; $('nm-priority').value='medium';
  const grid=$('nm-type-grid'); if(grid)buildTypeGrid(grid,'goal',t=>_nmType=t);
  populateParentSelect('nm-parent',null,S.activeWsId);
  openModal('add-node-modal'); setTimeout(()=>$('nm-title')?.focus(),60);
}

function buildTypeGrid(grid,activeType,onSelect){
  grid.innerHTML='';
  Object.entries(SCHEMA_CATS).forEach(([cat,catLabel])=>{
    const types=Object.entries(SCHEMAS).filter(([,s])=>s.cat===cat);
    if(!types.length)return;
    const lbl=el('div','');
    lbl.style.cssText='font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--tx-3);width:100%;padding:7px 0 4px;';
    lbl.textContent=catLabel; grid.appendChild(lbl);
    types.forEach(([key,s])=>{
      const btn=el('button',`type-btn${key===activeType?' active':''}`,`<i class="bi ${s.icon}"></i> ${s.label}`);
      btn.onclick=()=>{grid.querySelectorAll('.type-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');onSelect(key);};
      grid.appendChild(btn);
    });
  });
}

function populateParentSelect(selId,currentId,wsId){
  const sel=$(selId); if(!sel)return;
  sel.innerHTML='<option value="">None (root node)</option>';
  (wsId?S.nodes.filter(n=>n.wsId===wsId):S.nodes).filter(n=>n.id!==currentId).forEach(n=>{
    const opt=document.createElement('option'); opt.value=n.id; opt.textContent=n.title.slice(0,45); sel.appendChild(opt);
  });
}

async function createNode(){
  const title=$('nm-title')?.value.trim(); if(!title){toast('Enter a node title','error');return;}
  if(!S.activeWsId){toast('Select a workspace first','error');return;}
  const n=mkNode({wsId:S.activeWsId,type:_nmType,title,currency:$('nm-currency')?.value||'INR',priority:$('nm-priority')?.value||'medium',parentId:$('nm-parent')?.value||null,x:100+Math.random()*500,y:100+Math.random()*400});
  S.nodes.push(n); closeModal('add-node-modal'); scheduleSave();
  if(S.view==='workspace'&&S.wsTab==='roadmap')renderCanvas();
  else if(S.view==='workspace')setWsTab('roadmap');
  else{openWorkspace(n.wsId);setWsTab('roadmap');}
  setTimeout(()=>{selectNode(n.id);centerOn(n);},120);
  toast(`${(SCHEMAS[n.type]||{label:'Node'}).label} created`,'success');
}

function mkNode({id,wsId,type='goal',title='New Node',currency='INR',priority='medium',status='active',parentId=null,x=300,y=300,...rest}){
  return {id:id||uid(),wsId,type,title,currency,priority,status,parentId,
    posX:+x,posY:+y,notes:'',dueDate:'',tags:'',category:'',
    currentValue:0,targetValue:100,completed:false,dependencies:[],
    ...rest,createdAt:now(),updatedAt:now()};
}

async function deleteNode(nodeId){
  S.nodes=S.nodes.filter(n=>n.id!==nodeId);
  S.nodes.forEach(n=>{if(n.parentId===nodeId)n.parentId=null;});
  if(S.user&&window.FIREBASE_READY)await FB.deleteFromSub(S.user.uid,'nodes',nodeId);
  closeNodePanel(); scheduleSave();
  if(S.wsTab==='roadmap')renderCanvas(); else renderWorkspaceView();
  toast('Node deleted','info');
}

// ════════ NODE PANEL ════════
function selectNode(nodeId){
  S.selectedNodeId=nodeId;
  const node=S.nodes.find(n=>n.id===nodeId); if(!node)return;
  openNodePanel(node);
  document.querySelectorAll('.node').forEach(e=>e.classList.toggle('selected',e.dataset.nodeId===nodeId));
}

function openNodePanel(node){
  $('node-panel').classList.remove('closed');
  const schema=SCHEMAS[node.type]||SCHEMAS.goal;
  const badge=$('np-type-badge');
  badge.innerHTML=`<i class="bi ${schema.icon}"></i> ${schema.label}`;
  badge.style.cssText+=`;background:${colorOf(node.type)}22;color:${colorOf(node.type)};`;
  const body=$('np-body'); body.innerHTML='';
  const ti=el('input','np-title-input'); ti.type='text'; ti.value=node.title; ti.placeholder='Node title…';
  body.appendChild(ti);
  body.appendChild(buildDynamicFields(node,schema));
  $('np-save-btn').onclick=()=>saveNode(node.id,ti);
  $('np-delete-btn').onclick=()=>{if(confirm('Delete this node?'))deleteNode(node.id);};
  $('np-focus-btn').onclick=()=>enterFocusMode(node.id);
}

function buildDynamicFields(node,schema){
  const wrap=el('div','');
  const type=node.type;
  // Status + Priority row (all types)
  wrap.innerHTML+=`<div class="np-section np-two-col"><div><div class="np-label">Status</div><select class="np-select" id="np-status">${KANBAN_COLS.map(c=>`<option value="${c.id}"${node.status===c.id?' selected':''}>${c.label}</option>`).join('')}</select></div><div><div class="np-label">Priority</div><select class="np-select" id="np-priority">${['low','medium','high','critical'].map(p=>`<option value="${p}"${node.priority===p?' selected':''}>${p[0].toUpperCase()+p.slice(1)}</option>`).join('')}</select></div></div>`;
  // Type-specific
  if(type==='debt'){
    wrap.innerHTML+=`<div class="np-section np-two-col"><div><div class="np-label">Lender</div><input class="np-input" id="np-lender" value="${esc(node.lender||'')}"/></div><div><div class="np-label">Currency</div><select class="np-select" id="np-currency">${Object.entries(CURRENCIES).map(([c,v])=>`<option value="${c}"${node.currency===c?' selected':''}>${v.symbol} ${c}</option>`).join('')}</select></div></div><div class="np-section np-three-col"><div><div class="np-label">Principal</div><input class="np-input" id="np-principal" type="number" value="${node.principal||0}"/></div><div><div class="np-label">Rate %</div><input class="np-input" id="np-interest" type="number" value="${node.interestRate||0}" step="0.1"/></div><div><div class="np-label">EMI</div><input class="np-input" id="np-emi" type="number" value="${node.emi||0}"/></div></div><div class="np-section np-two-col"><div><div class="np-label">Tenure (months)</div><input class="np-input" id="np-tenure" type="number" value="${node.tenure||0}"/></div><div><div class="np-label">EMI Due Date</div><input class="np-input" id="np-duedate" type="date" value="${node.dueDate||''}"/></div></div><div class="np-section"><div class="np-label">Remaining Balance</div><input class="np-input" id="np-remaining" type="number" value="${node.remainingBalance||node.principal||0}"/><div class="np-debt-calc" id="debt-calc"></div></div><button class="np-tx-btn log-payment" id="np-log-payment"><i class="bi bi-cash-stack"></i> Log EMI Payment</button><div class="np-section"><div class="np-label">Payment History</div><div class="np-tx-list" id="np-tx-list"></div></div>`;
    setTimeout(()=>{
      const calcD=()=>{const pr=+($('np-principal')?.value||0);const em=+($('np-emi')?.value||0);const rem=+($('np-remaining')?.value||pr);const paid=pr-rem;const calc=$('debt-calc');if(calc&&em>0&&pr>0){const tot=em*(node.tenure||12);calc.innerHTML=`<div class="np-debt-calc-row"><span>Total Payable</span><span class="np-debt-calc-val">${fmtCur(tot,node.currency)}</span></div><div class="np-debt-calc-row"><span>Total Interest</span><span class="np-debt-calc-val" style="color:var(--red)">${fmtCur(tot-pr,node.currency)}</span></div><div class="np-debt-calc-row"><span>Paid So Far</span><span class="np-debt-calc-val" style="color:var(--green)">${fmtCur(Math.max(0,paid),node.currency)}</span></div>`;}}
      [$('np-principal'),$('np-interest'),$('np-emi'),$('np-remaining')].forEach(i=>i?.addEventListener('input',calcD));
      calcD(); renderTxList('np-tx-list',node.id);
      $('np-log-payment')?.addEventListener('click',()=>openTxModal(node.id,node.wsId,'payment',node.currency));
    },0);
  }else if(type==='income'){
    wrap.innerHTML+=`<div class="np-section np-two-col"><div><div class="np-label">Source</div><input class="np-input" id="np-source" value="${esc(node.source||'')}"/></div><div><div class="np-label">Currency</div><select class="np-select" id="np-currency">${Object.entries(CURRENCIES).map(([c,v])=>`<option value="${c}"${node.currency===c?' selected':''}>${v.symbol} ${c}</option>`).join('')}</select></div></div><div class="np-section"><div class="np-label">Monthly Target</div><input class="np-input" id="np-monthly-target" type="number" value="${node.monthlyTarget||0}"/></div><div class="np-debt-calc" style="margin-bottom:10px"><div class="np-debt-calc-row"><span>This Month</span><span class="np-debt-calc-val" style="color:var(--green)">${fmtCur(getNodeTxTotal(node.id,'income','monthly'),node.currency)}</span></div><div class="np-debt-calc-row"><span>This Year</span><span class="np-debt-calc-val" style="color:var(--green)">${fmtCur(getNodeTxTotal(node.id,'income','yearly'),node.currency)}</span></div></div><button class="np-tx-btn add-income" id="np-log-income"><i class="bi bi-plus-lg"></i> Log Income</button><div class="np-section"><div class="np-label">Recent</div><div class="np-tx-list" id="np-tx-list"></div></div>`;
    setTimeout(()=>{renderTxList('np-tx-list',node.id);$('np-log-income')?.addEventListener('click',()=>openTxModal(node.id,node.wsId,'income',node.currency));},0);
  }else if(type==='expense'){
    wrap.innerHTML+=`<div class="np-section np-two-col"><div><div class="np-label">Category</div><input class="np-input" id="np-exp-cat" value="${esc(node.category||'')}"/></div><div><div class="np-label">Currency</div><select class="np-select" id="np-currency">${Object.entries(CURRENCIES).map(([c,v])=>`<option value="${c}"${node.currency===c?' selected':''}>${v.symbol} ${c}</option>`).join('')}</select></div></div><div class="np-section"><div class="np-label">Monthly Budget</div><input class="np-input" id="np-budget" type="number" value="${node.monthlyBudget||0}"/></div><div class="np-debt-calc" style="margin-bottom:10px"><div class="np-debt-calc-row"><span>This Month</span><span class="np-debt-calc-val" style="color:var(--red)">${fmtCur(getNodeTxTotal(node.id,'expense','monthly'),node.currency)}</span></div><div class="np-debt-calc-row"><span>Budget Left</span><span class="np-debt-calc-val">${fmtCur(Math.max(0,(node.monthlyBudget||0)-getNodeTxTotal(node.id,'expense','monthly')),node.currency)}</span></div></div><button class="np-tx-btn add-expense" id="np-log-expense"><i class="bi bi-minus-lg"></i> Log Expense</button><div class="np-section"><div class="np-label">Recent</div><div class="np-tx-list" id="np-tx-list"></div></div>`;
    setTimeout(()=>{renderTxList('np-tx-list',node.id);$('np-log-expense')?.addEventListener('click',()=>openTxModal(node.id,node.wsId,'expense',node.currency));},0);
  }else if(type==='investment'){
    wrap.innerHTML+=`<div class="np-section np-two-col"><div><div class="np-label">Type</div><input class="np-input" id="np-invest-type" value="${esc(node.investType||'')}"/></div><div><div class="np-label">Currency</div><select class="np-select" id="np-currency">${Object.entries(CURRENCIES).map(([c,v])=>`<option value="${c}"${node.currency===c?' selected':''}>${v.symbol} ${c}</option>`).join('')}</select></div></div><div class="np-section np-two-col"><div><div class="np-label">Invested Amount</div><input class="np-input" id="np-invested" type="number" value="${node.investedAmount||0}"/></div><div><div class="np-label">Current Value</div><input class="np-input" id="np-current-val" type="number" value="${node.currentValue||0}"/></div></div><div class="np-section"><div class="np-label">Start Date</div><input class="np-input" id="np-start-date" type="date" value="${node.startDate||''}"/></div><div class="np-debt-calc" id="inv-calc" style="margin-top:8px"></div>`;
    setTimeout(()=>{
      const calc=()=>{const inv=+($('np-invested')?.value||0);const cur=+($('np-current-val')?.value||0);const pnl=cur-inv;const r=inv>0?((pnl/inv)*100).toFixed(1):0;const c=$('inv-calc');if(c)c.innerHTML=`<div class="np-debt-calc-row"><span>P&L</span><span class="np-debt-calc-val" style="color:${pnl>=0?'var(--green)':'var(--red)'}">${pnl>=0?'+':''}${fmtCur(Math.abs(pnl),node.currency)}</span></div><div class="np-debt-calc-row"><span>ROI</span><span class="np-debt-calc-val" style="color:${r>=0?'var(--green)':'var(--red)'}">${r}%</span></div>`;};
      [$('np-invested'),$('np-current-val')].forEach(i=>i?.addEventListener('input',calc)); calc();
    },0);
  }else if(type==='asset'){
    wrap.innerHTML+=`<div class="np-section np-two-col"><div><div class="np-label">Asset Type</div><input class="np-input" id="np-asset-type" value="${esc(node.assetType||'')}"/></div><div><div class="np-label">Currency</div><select class="np-select" id="np-currency">${Object.entries(CURRENCIES).map(([c,v])=>`<option value="${c}"${node.currency===c?' selected':''}>${v.symbol} ${c}</option>`).join('')}</select></div></div><div class="np-section np-two-col"><div><div class="np-label">Purchase Value</div><input class="np-input" id="np-purchase-val" type="number" value="${node.purchaseValue||0}"/></div><div><div class="np-label">Current Value</div><input class="np-input" id="np-current-val" type="number" value="${node.currentValue||0}"/></div></div><div class="np-section"><div class="np-label">Purchase Date</div><input class="np-input" id="np-purchase-date" type="date" value="${node.purchaseDate||''}"/></div>`;
  }else if(type==='kpi'){
    wrap.innerHTML+=`<div class="np-section np-two-col"><div><div class="np-label">Metric</div><input class="np-input" id="np-metric" value="${esc(node.metric||'')}"/></div><div><div class="np-label">Period</div><input class="np-input" id="np-period" value="${esc(node.period||'monthly')}"/></div></div><div class="np-section np-two-col"><div><div class="np-label">Current</div><input class="np-input" id="np-current-val" type="number" value="${node.currentValue||0}"/></div><div><div class="np-label">Target</div><input class="np-input" id="np-target-val" type="number" value="${node.targetValue||100}"/></div></div><div class="np-section"><div class="np-label">Progress</div><div class="np-progress-bar"><div class="np-progress-fill" id="np-prog-fill" style="width:${pct(node.currentValue,node.targetValue)}%;background:${colorOf(node.type)}"></div></div></div>`;
    setTimeout(()=>{const upd=()=>{const f=$('np-prog-fill');if(f)f.style.width=pct(+($('np-current-val')?.value||0),+($('np-target-val')?.value||1))+'%';};[$('np-current-val'),$('np-target-val')].forEach(i=>i?.addEventListener('input',upd));},0);
  }else if(type==='health'){
    wrap.innerHTML+=`<div class="np-section np-two-col"><div><div class="np-label">Health Type</div><input class="np-input" id="np-health-type" value="${esc(node.healthType||'')}"/></div><div><div class="np-label">Unit</div><input class="np-input" id="np-unit" value="${esc(node.unit||'')}"/></div></div><div class="np-section np-two-col"><div><div class="np-label">Current</div><input class="np-input" id="np-current-val" type="number" value="${node.currentValue||0}"/></div><div><div class="np-label">Target</div><input class="np-input" id="np-target-val" type="number" value="${node.targetValue||0}"/></div></div><div class="np-section"><div class="np-label">Frequency</div><input class="np-input" id="np-frequency" value="${esc(node.frequency||'daily')}"/></div>`;
  }else{
    // Goal, milestone, task, journal, learning, business, automation
    wrap.innerHTML+=`<div class="np-section np-two-col"><div><div class="np-label">Currency</div><select class="np-select" id="np-currency">${Object.entries(CURRENCIES).map(([c,v])=>`<option value="${c}"${node.currency===c?' selected':''}>${v.symbol} ${c}</option>`).join('')}</select></div><div><div class="np-label">Due Date</div><input class="np-input" id="np-duedate" type="date" value="${node.dueDate||''}"/></div></div><div class="np-section np-two-col"><div><div class="np-label">Current Value</div><input class="np-input" id="np-current-val" type="number" value="${node.currentValue||0}"/></div><div><div class="np-label">Target Value</div><input class="np-input" id="np-target-val" type="number" value="${node.targetValue||100}"/></div></div><div class="np-section"><div class="np-label">Progress</div><div class="np-progress-bar"><div class="np-progress-fill" id="np-prog-fill" style="width:${pct(node.currentValue,node.targetValue)}%;background:${colorOf(node.type)}"></div></div></div>`;
    setTimeout(()=>{const upd=()=>{const f=$('np-prog-fill');if(f)f.style.width=pct(+($('np-current-val')?.value||0),+($('np-target-val')?.value||1))+'%';};[$('np-current-val'),$('np-target-val')].forEach(i=>i?.addEventListener('input',upd));},0);
  }
  // Common bottom
  wrap.innerHTML+=`<div class="np-section np-two-col"><div><div class="np-label">Category</div><input class="np-input" id="np-category" value="${esc(node.category||'')}"/></div><div><div class="np-label">Tags</div><input class="np-input" id="np-tags" value="${esc(node.tags||'')}"/></div></div><div class="np-section"><div class="np-label">Notes</div><textarea class="np-textarea" id="np-notes" placeholder="Strategy, context, next steps…">${esc(node.notes||'')}</textarea></div><div class="np-section"><div class="np-label">Parent Node</div><select class="np-select" id="np-parent"></select></div>`;
  setTimeout(()=>{populateParentSelect('np-parent',node.id,node.wsId);setTimeout(()=>{const s=$('np-parent');if(s&&node.parentId)s.value=node.parentId;},50);},0);
  return wrap;
}

function saveNode(nodeId,titleInput){
  const node=S.nodes.find(n=>n.id===nodeId); if(!node)return;
  node.title=titleInput.value.trim()||node.title;
  node.status=$('np-status')?.value||node.status;
  node.priority=$('np-priority')?.value||node.priority;
  node.notes=$('np-notes')?.value||'';
  node.tags=$('np-tags')?.value||'';
  node.category=$('np-category')?.value||node.category;
  node.parentId=$('np-parent')?.value||null;
  node.currency=$('np-currency')?.value||node.currency;
  if(node.type==='debt'){node.lender=$('np-lender')?.value||'';node.principal=+($('np-principal')?.value||0);node.interestRate=+($('np-interest')?.value||0);node.emi=+($('np-emi')?.value||0);node.tenure=+($('np-tenure')?.value||0);node.dueDate=$('np-duedate')?.value||'';node.remainingBalance=+($('np-remaining')?.value||0);node.currentValue=node.principal-node.remainingBalance;node.targetValue=node.principal;}
  else if(node.type==='income'){node.source=$('np-source')?.value||'';node.monthlyTarget=+($('np-monthly-target')?.value||0);node.targetValue=node.monthlyTarget;node.currentValue=getNodeTxTotal(node.id,'income','monthly');}
  else if(node.type==='expense'){node.category=$('np-exp-cat')?.value||node.category;node.monthlyBudget=+($('np-budget')?.value||0);node.targetValue=node.monthlyBudget;node.currentValue=getNodeTxTotal(node.id,'expense','monthly');}
  else if(node.type==='investment'){node.investType=$('np-invest-type')?.value||'';node.investedAmount=+($('np-invested')?.value||0);node.currentValue=+($('np-current-val')?.value||0);node.startDate=$('np-start-date')?.value||'';node.targetValue=node.investedAmount;}
  else if(node.type==='asset'){node.assetType=$('np-asset-type')?.value||'';node.purchaseValue=+($('np-purchase-val')?.value||0);node.currentValue=+($('np-current-val')?.value||0);node.purchaseDate=$('np-purchase-date')?.value||'';node.targetValue=node.purchaseValue;}
  else if(node.type==='kpi'){node.metric=$('np-metric')?.value||'';node.period=$('np-period')?.value||'monthly';node.currentValue=+($('np-current-val')?.value||0);node.targetValue=+($('np-target-val')?.value||100);}
  else if(node.type==='health'){node.healthType=$('np-health-type')?.value||'';node.unit=$('np-unit')?.value||'';node.currentValue=+($('np-current-val')?.value||0);node.targetValue=+($('np-target-val')?.value||100);node.frequency=$('np-frequency')?.value||'daily';}
  else{node.currentValue=+($('np-current-val')?.value||0);node.targetValue=+($('np-target-val')?.value||100);if(node.type!=='debt')node.dueDate=$('np-duedate')?.value||node.dueDate;}
  node.completed=node.status==='completed'; node.updatedAt=now();
  scheduleSave();
  if(S.wsTab==='roadmap')renderCanvas(); else renderWorkspaceView();
  toast('Saved','success',1400);
  if(node.completed)showCelebration(node.title);
}

function closeNodePanel(){
  S.selectedNodeId=null; $('node-panel').classList.add('closed');
  document.querySelectorAll('.node').forEach(n=>n.classList.remove('selected'));
}

function renderTxList(containerId,nodeId){
  const c=$(containerId); if(!c)return;
  const txs=S.transactions.filter(t=>t.nodeId===nodeId).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);
  c.innerHTML='';
  if(!txs.length){c.innerHTML=`<div style="color:var(--tx-3);font-size:12px;padding:6px 0">No transactions yet</div>`;return;}
  txs.forEach(t=>{
    const isIn=t.txType==='income';
    const item=el('div','np-tx-item');
    item.innerHTML=`<span class="np-tx-amount ${isIn?'income':'expense'}">${isIn?'+':'-'}${fmtCur(t.amount,t.currency)}</span><span class="np-tx-note">${esc(t.note||'')}</span><span class="np-tx-date">${t.date?new Date(t.date).toLocaleDateString('en-IN',{month:'short',day:'numeric'}):'—'}</span>`;
    c.appendChild(item);
  });
}

// ════════ TRANSACTION MODAL ════════
let _txNodeId=null,_txWsId=null,_txType='income',_txCurrency='INR';
function openTxModal(nodeId,wsId,txType,currency='INR'){
  _txNodeId=nodeId;_txWsId=wsId;_txType=txType;_txCurrency=currency;
  $('tx-modal-title').textContent=txType==='income'?'Log Income':txType==='expense'?'Log Expense':'Log Payment';
  $('tx-amount').value='';$('tx-note').value='';
  $('tx-date').value=new Date().toISOString().split('T')[0];
  $('tx-currency').value=currency;
  openModal('tx-modal');setTimeout(()=>$('tx-amount')?.focus(),60);
}

// ════════ CANVAS ════════
function renderCanvas(){
  const world=$('canvas-world'); if(!world)return;
  const svg=$('connections-svg');
  Array.from(world.children).forEach(c=>{if(c!==svg)world.removeChild(c);});
  svg.innerHTML='';
  const nodes=activeNodes();
  $('canvas-empty').classList.toggle('hidden',nodes.length>0);
  if(!nodes.length)return;
  nodes.forEach(n=>{if(n.parentId){const p=nodes.find(x=>x.id===n.parentId);if(p)drawConnection(svg,p,n);}});
  nodes.forEach(n=>world.appendChild(buildNodeEl(n)));
  applyTransform();renderMiniMap();
}

function buildNodeEl(node){
  const schema=SCHEMAS[node.type]||SCHEMAS.goal;
  const color=schema.color;
  const p=pct(node.currentValue,node.targetValue);
  const r=17,circ=2*Math.PI*r;
  const offset=circ-(circ*p/100);
  const isBlocked=(node.dependencies||[]).some(d=>{const dep=S.nodes.find(n=>n.id===d);return dep&&!dep.completed;});
  const d=el('div',`node${node.id===S.selectedNodeId?' selected':''}${node.completed?' completed':''}${isBlocked?' blocked':''}`);
  d.dataset.nodeId=node.id;
  d.style.left=node.posX+'px';d.style.top=node.posY+'px';
  d.innerHTML=`
    <div class="node-accent" style="background:${color}"></div>
    <div class="node-inner">
      <div class="node-ring-wrap">
        <svg width="42" height="42" viewBox="0 0 42 42" class="node-ring-svg">
          <circle class="node-ring-bg" cx="21" cy="21" r="${r}"/>
          <circle class="node-ring-arc" cx="21" cy="21" r="${r}" stroke="${color}"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
            transform="rotate(-90 21 21)"/>
        </svg>
        <div class="node-ring-pct" style="color:${color}">${p}%</div>
      </div>
      <div class="node-body">
        <div class="node-title-row">
          <div class="node-title">${esc(node.title)}</div>
          <div class="node-status-dot ${node.status||'active'}"></div>
        </div>
        <div class="node-cat" style="color:${color}">${esc(node.category||schema.label)}</div>
        <div class="node-metrics">${buildNodeMetrics(node,color)}</div>
      </div>
    </div>
    ${node.completed?'<div class="node-done-badge"><i class="bi bi-check-lg"></i></div>':''}
    ${isBlocked?'<div class="node-lock"><i class="bi bi-lock-fill"></i></div>':''}`;
  d.addEventListener('click',e=>{e.stopPropagation();if(!S.drag.on)selectNode(node.id);});
  d.addEventListener('mousedown',e=>startDrag(e,node.id));
  d.addEventListener('dblclick',e=>{e.stopPropagation();enterFocusMode(node.id);});
  return d;
}

function buildNodeMetrics(node,color){
  const sym=(CURRENCIES[node.currency||'INR']||CURRENCIES.INR).symbol;
  switch(node.type){
    case 'debt':
      return `<div class="node-metric-row"><span>Remaining</span><span class="node-metric-val" style="color:var(--red)">${sym}${fmtN(node.remainingBalance||0)}</span></div><div class="node-metric-row"><span>EMI${node.dueDate?' · '+node.dueDate:''}</span><span class="node-metric-val">${sym}${fmtN(node.emi||0)}</span></div>`;
    case 'income':
      return `<div class="node-metric-row"><span>This month</span><span class="node-metric-val" style="color:var(--green)">${sym}${fmtN(getNodeTxTotal(node.id,'income','monthly'))}</span></div><div class="node-metric-row"><span>Target</span><span class="node-metric-val">${sym}${fmtN(node.monthlyTarget||0)}</span></div>`;
    case 'expense':
      return `<div class="node-metric-row"><span>This month</span><span class="node-metric-val" style="color:var(--orange)">${sym}${fmtN(getNodeTxTotal(node.id,'expense','monthly'))}</span></div><div class="node-metric-row"><span>Budget</span><span class="node-metric-val">${sym}${fmtN(node.monthlyBudget||0)}</span></div>`;
    case 'investment':{
      const roi=node.investedAmount>0?(((node.currentValue||0)-(node.investedAmount||0))/(node.investedAmount||1)*100).toFixed(1):0;
      return `<div class="node-metric-row"><span>Invested</span><span class="node-metric-val">${sym}${fmtN(node.investedAmount||0)}</span></div><div class="node-metric-row"><span>ROI</span><span class="node-metric-val" style="color:${roi>=0?'var(--green)':'var(--red)'}">${roi}%</span></div>`;}
    case 'asset':
      return `<div class="node-metric-row"><span>Value</span><span class="node-metric-val" style="color:${color}">${sym}${fmtN(node.currentValue||0)}</span></div>`;
    case 'kpi':
      return `<div class="node-metric-row"><span>Current</span><span class="node-metric-val" style="color:${color}">${fmtN(node.currentValue||0)}</span></div><div class="node-metric-row"><span>Target</span><span class="node-metric-val">${fmtN(node.targetValue||0)}</span></div>`;
    default:
      return `<div class="node-metric-row"><span>Status</span><span class="node-metric-val">${node.status||'active'}</span></div>${node.dueDate?`<div class="node-metric-row"><span>Due</span><span class="node-metric-val">${dateLabel(node.dueDate)}</span></div>`:''}`;
  }
}

function drawConnection(svg,from,to){
  const W=275,H=72;
  const x1=from.posX+W/2,y1=from.posY+H;
  const x2=to.posX+W/2,y2=to.posY;
  const cy=Math.abs(y2-y1)*0.45+20;
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',`M${x1},${y1} C${x1},${y1+cy} ${x2},${y2-cy} ${x2},${y2}`);
  path.className.baseVal=`conn-path${to.completed?' done':to.status==='blocked'?' blocked':' active'}`;
  svg.appendChild(path);
}

function applyTransform(){
  const w=$('canvas-world'); if(!w)return;
  w.style.transform=`translate(${Math.round(S.canvas.x)}px,${Math.round(S.canvas.y)}px) scale(${S.canvas.scale})`;
  const zl=$('zoom-label'); if(zl)zl.textContent=Math.round(S.canvas.scale*100)+'%';
}

function fitView(){
  const nodes=activeNodes();
  if(!nodes.length){S.canvas={x:80,y:120,scale:1};applyTransform();return;}
  const wrap=$('canvas-wrap'); if(!wrap)return;
  const minX=Math.min(...nodes.map(n=>n.posX))-40;
  const minY=Math.min(...nodes.map(n=>n.posY))-40;
  const maxX=Math.max(...nodes.map(n=>n.posX+275))+40;
  const maxY=Math.max(...nodes.map(n=>n.posY+72))+40;
  const scale=clamp(Math.min(wrap.clientWidth/(maxX-minX),wrap.clientHeight/(maxY-minY)),0.2,1.5);
  S.canvas.scale=scale;
  S.canvas.x=-minX*scale+(wrap.clientWidth-(maxX-minX)*scale)/2;
  S.canvas.y=-minY*scale+(wrap.clientHeight-(maxY-minY)*scale)/2;
  applyTransform();renderMiniMap();
}

function centerOn(node){
  const wrap=$('canvas-wrap'); if(!wrap)return;
  S.canvas.x=-node.posX*S.canvas.scale+wrap.clientWidth/2-138;
  S.canvas.y=-node.posY*S.canvas.scale+wrap.clientHeight/2-36;
  applyTransform();
}

// ════════ DRAG ════════
function startDrag(e,nodeId){
  if(e.button!==0)return; e.stopPropagation();
  const node=S.nodes.find(n=>n.id===nodeId); if(!node)return;
  S.drag={on:false,nodeId,sx:e.clientX,sy:e.clientY,nx:node.posX,ny:node.posY};
  document.addEventListener('mousemove',onDragMove,{passive:true});
  document.addEventListener('mouseup',onDragEnd,{once:true});
}
function onDragMove(e){
  const d=S.drag; if(!d.nodeId)return;
  const dx=(e.clientX-d.sx)/S.canvas.scale,dy=(e.clientY-d.sy)/S.canvas.scale;
  if(Math.abs(dx)>3||Math.abs(dy)>3)d.on=true;
  if(!d.on)return;
  const node=S.nodes.find(n=>n.id===d.nodeId); if(!node)return;
  node.posX=Math.max(0,d.nx+dx); node.posY=Math.max(0,d.ny+dy);
  const el2=document.querySelector(`[data-node-id="${d.nodeId}"]`);
  if(el2){el2.style.left=node.posX+'px';el2.style.top=node.posY+'px';}
  renderConnections();
}
function onDragEnd(){
  document.removeEventListener('mousemove',onDragMove);
  if(S.drag.on)scheduleSave();
  setTimeout(()=>{S.drag.on=false;S.drag.nodeId=null;},10);
}

// ════════ PAN & ZOOM ════════
function initCanvasPan(){
  const wrap=$('canvas-wrap'); if(!wrap||wrap._panInit)return; wrap._panInit=true;
  wrap.addEventListener('mousedown',e=>{
    if(e.target.closest('.node'))return;
    S.pan={on:true,sx:e.clientX,sy:e.clientY,ox:S.canvas.x,oy:S.canvas.y};
    wrap.style.cursor='grabbing';
  });
  document.addEventListener('mousemove',e=>{
    if(!S.pan.on)return;
    S.canvas.x=S.pan.ox+(e.clientX-S.pan.sx);
    S.canvas.y=S.pan.oy+(e.clientY-S.pan.sy);
    applyTransform();
  });
  document.addEventListener('mouseup',()=>{if(S.pan.on){S.pan.on=false;const w=$('canvas-wrap');if(w)w.style.cursor='grab';}});
  wrap.addEventListener('wheel',e=>{
    e.preventDefault();
    const rect=wrap.getBoundingClientRect();
    const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const factor=e.deltaY<0?1.1:0.91;
    const ns=clamp(S.canvas.scale*factor,0.12,3);
    S.canvas.x=mx-(mx-S.canvas.x)*(ns/S.canvas.scale);
    S.canvas.y=my-(my-S.canvas.y)*(ns/S.canvas.scale);
    S.canvas.scale=ns; applyTransform(); renderMiniMap();
  },{passive:false});
  wrap.addEventListener('click',e=>{if(!e.target.closest('.node')&&!S.drag.on)closeNodePanel();});
}

function renderConnections(){
  const svg=$('connections-svg'); if(!svg)return; svg.innerHTML='';
  activeNodes().forEach(n=>{if(n.parentId){const p=activeNodes().find(x=>x.id===n.parentId);if(p)drawConnection(svg,p,n);}});
}

// ════════ MINIMAP ════════
function renderMiniMap(){
  const canvas=$('mini-map'); if(!canvas)return;
  const W=canvas.width=160,H=canvas.height=100;
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,W,H);
  const nodes=activeNodes(); if(!nodes.length)return;
  const minX=Math.min(...nodes.map(n=>n.posX));
  const minY=Math.min(...nodes.map(n=>n.posY));
  const maxX=Math.max(...nodes.map(n=>n.posX+275));
  const maxY=Math.max(...nodes.map(n=>n.posY+72));
  const sc=Math.min(W/(maxX-minX||1)*0.9,H/(maxY-minY||1)*0.9);
  const offX=(W-(maxX-minX)*sc)/2-minX*sc;
  const offY=(H-(maxY-minY)*sc)/2-minY*sc;
  nodes.forEach(n=>{
    ctx.fillStyle=colorOf(n.type)+'99';
    ctx.beginPath();
    ctx.roundRect(n.posX*sc+offX,n.posY*sc+offY,275*sc,72*sc,2);
    ctx.fill();
  });
}

// ════════ TIMELINE ════════
function renderTimeline(){
  const c=$('timeline-content'); if(!c)return; c.innerHTML='';
  const nodes=activeNodes().filter(n=>n.dueDate||n.createdAt).sort((a,b)=>new Date(a.dueDate||a.createdAt)-new Date(b.dueDate||b.createdAt));
  if(!nodes.length){c.innerHTML=`<div style="text-align:center;color:var(--tx-3);padding:48px;font-size:13px"><i class="bi bi-list-columns-reverse" style="font-size:30px;display:block;margin-bottom:10px;opacity:.3"></i>No timeline events — add due dates to nodes</div>`;return;}
  const list=el('div','tl-list');
  nodes.forEach(n=>{
    const color=colorOf(n.type);
    const item=el('div','tl-item');
    const dot=el('div','tl-dot'); dot.style.background=color; dot.style.boxShadow=`0 0 0 3px var(--bg-1)`;
    item.appendChild(dot);
    const card=el('div','tl-card');
    const days=daysUntil(n.dueDate);
    card.innerHTML=`<div class="tl-title"><i class="bi ${iconOf(n.type)}" style="color:${color}"></i> ${esc(n.title)}</div><div class="tl-meta"><span style="color:${color}">${(SCHEMAS[n.type]||{label:''}).label}</span>${n.dueDate?`<span>${n.dueDate} (${dateLabel(n.dueDate)})</span>`:''}<span style="color:${n.completed?'var(--green)':'var(--tx-3)'}">${n.status||'active'}</span></div>`;
    card.onclick=()=>selectNode(n.id);
    item.appendChild(card); list.appendChild(item);
  });
  c.appendChild(list);
}

// ════════ KANBAN ════════
function renderKanban(){
  const board=$('kanban-board'); if(!board)return; board.innerHTML='';
  KANBAN_COLS.forEach(col=>{
    const nodes=activeNodes().filter(n=>n.status===col.id);
    const column=el('div','kb-col'); column.dataset.col=col.id;
    column.innerHTML=`<div class="kb-col-header"><div class="kb-col-dot" style="background:${col.color}"></div>${col.label}<span class="kb-col-count">${nodes.length}</span></div>`;
    const wrap=el('div','kb-cards'); wrap.dataset.col=col.id;
    wrap.addEventListener('dragover',e=>{e.preventDefault();wrap.classList.add('drop-over');});
    wrap.addEventListener('dragleave',()=>wrap.classList.remove('drop-over'));
    wrap.addEventListener('drop',e=>{
      e.preventDefault(); wrap.classList.remove('drop-over');
      const nodeId=e.dataTransfer.getData('text/plain');
      const node=S.nodes.find(n=>n.id===nodeId);
      if(node&&node.status!==col.id){node.status=col.id;scheduleSave();renderKanban();toast(`Moved to ${col.label}`,'info',1400);}
    });
    nodes.forEach(n=>{
      const color=colorOf(n.type); const p=pct(n.currentValue,n.targetValue);
      const card=el('div','kb-card'); card.draggable=true;
      card.innerHTML=`<div class="kb-card-accent" style="background:${color}"></div><div class="kb-card-body"><div class="kb-card-title">${esc(n.title)}</div><div class="kb-card-cat" style="color:${color}">${esc(n.category||(SCHEMAS[n.type]||{label:''}).label)}</div><div class="kb-card-bar"><div class="kb-card-fill" style="width:${p}%;background:${color}"></div></div><div class="kb-card-meta"><span class="kb-priority ${n.priority||'medium'}">${n.priority||'medium'}</span><span style="font-family:var(--font-m);font-size:11px;color:${color}">${p}%</span>${n.dueDate?`<span style="color:var(--tx-3);font-size:11px"><i class="bi bi-calendar3"></i> ${n.dueDate}</span>`:''}</div></div>`;
      card.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',n.id);card.classList.add('dragging');});
      card.addEventListener('dragend',()=>card.classList.remove('dragging'));
      card.addEventListener('click',()=>selectNode(n.id));
      wrap.appendChild(card);
    });
    column.appendChild(wrap); board.appendChild(column);
  });
}

// ════════ WORKSPACE ANALYTICS ════════
function renderWsAnalytics(){
  const c=$('ws-analytics-content'); if(!c)return; c.innerHTML='';
  const nodes=activeNodes();
  const completed=nodes.filter(n=>n.completed).length;
  const wsIncome=filterTxByPeriod(S.transactions.filter(t=>t.wsId===S.activeWsId&&t.txType==='income'),'monthly').reduce((s,t)=>s+toINR(t.amount,t.currency),0);
  const wsExpense=filterTxByPeriod(S.transactions.filter(t=>t.wsId===S.activeWsId&&t.txType==='expense'),'monthly').reduce((s,t)=>s+toINR(t.amount,t.currency),0);
  const grid=el('div','ws-analytics-grid');
  // Type distribution
  const typeDist={};
  nodes.forEach(n=>{typeDist[n.type]=(typeDist[n.type]||0)+1;});
  const typeSorted=Object.entries(typeDist).sort((a,b)=>b[1]-a[1]);
  const barCard=el('div','an-card');
  barCard.innerHTML=`<div class="an-card-title">Node Distribution</div><div class="bar-chart" id="ws-bar-chart"></div>`;
  grid.appendChild(barCard);
  // Status
  const sbCard=el('div','an-card');
  sbCard.innerHTML=`<div class="an-card-title">Status Breakdown</div>`;
  const statuses={todo:0,active:0,review:0,completed:0};
  nodes.forEach(n=>{if(statuses[n.status]!==undefined)statuses[n.status]++;});
  KANBAN_COLS.forEach(col=>{
    const cnt=statuses[col.id]||0;
    const row=el('div','');
    row.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--bd);font-size:12.5px;"><span style="display:flex;align-items:center;gap:7px"><span style="width:7px;height:7px;border-radius:50%;background:${col.color};display:inline-block"></span>${col.label}</span><span style="font-family:var(--font-m);color:${col.color};font-weight:600">${cnt}</span></div>`;
    sbCard.appendChild(row);
  });
  grid.appendChild(sbCard);
  // Finance
  const finCard=el('div','an-card');
  finCard.innerHTML=`<div class="an-card-title">Monthly Finance</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px"><div style="background:var(--green-bg);border:1px solid var(--green-bd);border-radius:var(--r-s);padding:14px;text-align:center"><div style="font-family:var(--font-d);font-size:20px;font-weight:800;color:var(--green)">₹${fmtN(wsIncome)}</div><div style="font-size:11px;color:var(--tx-3);margin-top:3px">Income</div></div><div style="background:var(--red-bg);border:1px solid var(--red-bd);border-radius:var(--r-s);padding:14px;text-align:center"><div style="font-family:var(--font-d);font-size:20px;font-weight:800;color:var(--red)">₹${fmtN(wsExpense)}</div><div style="font-size:11px;color:var(--tx-3);margin-top:3px">Expenses</div></div></div><div style="margin-top:10px;text-align:center;font-size:12.5px;color:var(--tx-2)">Cashflow: <strong style="font-family:var(--font-m);color:${wsIncome-wsExpense>=0?'var(--green)':'var(--red)'}">₹${fmtN(wsIncome-wsExpense)}</strong></div>`;
  grid.appendChild(finCard);
  // AI
  const aiCard=el('div','an-card');
  aiCard.innerHTML=`<div class="an-card-title"><i class="bi bi-stars" style="color:var(--ac)"></i> AI Insight</div><div id="ws-ai-insight" class="ai-insight-loading"><div class="ai-spinner"></div>Loading…</div>`;
  grid.appendChild(aiCard);
  c.appendChild(grid);
  setTimeout(()=>{
    const bc=$('ws-bar-chart'); if(bc&&typeSorted.length){
      const max=Math.max(...typeSorted.map(([,v])=>v),1);
      typeSorted.slice(0,6).forEach(([type,count])=>{
        const item=el('div','bar-item');
        item.innerHTML=`<div class="bar-fill" style="height:${Math.round(count/max*80)+8}px;background:${colorOf(type)}"></div><div class="bar-lbl">${(SCHEMAS[type]||{label:type}).label}</div>`;
        bc.appendChild(item);
      });
    }
    if(S.settings.geminiKey){
      const ws=S.workspaces.find(w=>w.id===S.activeWsId);
      const prompt=`Workspace "${ws?.name}", ${nodes.length} nodes, ${completed} completed, monthly income ₹${fmtN(wsIncome)}, expenses ₹${fmtN(wsExpense)}. Give ONE specific insight in 1 sentence.`;
      fetch(`${GEMINI_URL}?key=${S.settings.geminiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:100}})})
        .then(r=>r.json()).then(data=>{
          const ai=$('ws-ai-insight'); if(!ai)return;
          const text=(data.candidates?.[0]?.content?.parts?.[0]?.text||'').trim();
          ai.className=''; ai.innerHTML=`<div class="ai-insight-text">${esc(text||'No insight available')}</div>`;
        }).catch(()=>{const ai=$('ws-ai-insight');if(ai)ai.textContent='AI unavailable.';});
    }else{
      const ai=$('ws-ai-insight');
      if(ai){ai.className='';ai.innerHTML=`<div style="color:var(--tx-3);font-size:12px">Add Gemini API key in Settings for insights</div>`;}
    }
  },50);
}

// ════════ WORKSPACE DASHBOARD ════════
function renderWsDashboard(){
  const c=$('ws-dashboard-content'); if(!c)return; c.innerHTML='';
  const ws=S.workspaces.find(w=>w.id===S.activeWsId);
  const nodes=activeNodes();
  const wt=WS_TYPES[ws?.type||'custom']||WS_TYPES.custom;
  const total=nodes.length,done=nodes.filter(n=>n.completed).length;
  const totalDebt=nodes.filter(n=>n.type==='debt').reduce((s,n)=>s+toINR(n.remainingBalance||0,n.currency),0);
  const mIncome=nodes.filter(n=>n.type==='income').reduce((s,n)=>s+getNodeTxTotal(n.id,'income','monthly'),0);
  const statGrid=el('div','gd-stat-grid');
  [{icon:ws?.icon||wt.icon,color:ws?.color||wt.color,val:total,lbl:'Total Nodes'},
   {icon:'bi-check-circle',color:'var(--green)',val:done,lbl:'Completed'},
   {icon:'bi-currency-dollar',color:'var(--green)',val:fmtCur(mIncome,'INR'),lbl:'Monthly Income'},
   {icon:'bi-exclamation-circle',color:'var(--red)',val:fmtCur(totalDebt,'INR'),lbl:'Total Debt'},
  ].forEach(s=>{
    const card=el('div','stat-card');
    card.innerHTML=`<div class="stat-card-top"><i class="bi ${s.icon} stat-card-icon" style="color:${s.color}"></i></div><div class="stat-card-val">${s.val}</div><div class="stat-card-lbl">${s.lbl}</div>`;
    statGrid.appendChild(card);
  });
  c.appendChild(statGrid);
  // Priority nodes
  const priorityCard=el('div','gd-card'); priorityCard.style.marginTop='16px';
  priorityCard.innerHTML=`<div class="gd-card-title">HIGH PRIORITY NODES</div>`;
  const pList=el('div','ws-activity-list');
  const highPri=nodes.filter(n=>n.priority==='critical'||n.priority==='high').slice(0,6);
  if(highPri.length){
    highPri.forEach(n=>{
      const item=el('div','ws-activity-item'); const color=colorOf(n.type);
      item.innerHTML=`<div class="ws-act-icon" style="background:${color}22;color:${color}"><i class="bi ${iconOf(n.type)}"></i></div><div class="ws-act-info"><div class="ws-act-name">${esc(n.title)}</div><div class="ws-act-meta">${n.priority} · ${n.dueDate?dateLabel(n.dueDate):'no deadline'}</div></div><div class="ws-act-progress" style="color:${color}">${pct(n.currentValue,n.targetValue)}%</div>`;
      item.onclick=()=>selectNode(n.id);
      pList.appendChild(item);
    });
  }else{pList.innerHTML='<div style="color:var(--tx-3);font-size:12px;padding:8px">No high priority nodes</div>';}
  priorityCard.appendChild(pList); c.appendChild(priorityCard);
}

// ════════ FOCUS MODE ════════
function enterFocusMode(nodeId){
  const node=S.nodes.find(n=>n.id===nodeId); if(!node)return;
  const schema=SCHEMAS[node.type]||SCHEMAS.goal;
  const color=colorOf(node.type);
  const p=pct(node.currentValue,node.targetValue);
  const children=S.nodes.filter(n=>n.parentId===nodeId);
  const ws=S.workspaces.find(w=>w.id===node.wsId);
  const r=52,circ=2*Math.PI*r;
  const bc=$('focus-breadcrumb'); if(bc)bc.textContent=`${ws?.name||'Workspace'} › ${schema.label}`;
  const body=$('focus-body');
  body.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1.6fr;gap:24px"><div style="display:flex;flex-direction:column;align-items:center;text-align:center;border-right:1px solid var(--bd);padding-right:20px"><div style="font-family:var(--font-d);font-size:21px;font-weight:800;line-height:1.25;margin-bottom:7px">${esc(node.title)}</div><div style="font-size:10.5px;font-family:var(--font-m);text-transform:uppercase;letter-spacing:.7px;padding:3px 10px;border-radius:99px;background:${color}22;color:${color};margin-bottom:20px">${schema.label}</div><div style="position:relative;width:130px;height:130px;margin-bottom:20px"><svg width="130" height="130" viewBox="0 0 130 130" style="transform:rotate(-90deg)"><circle cx="65" cy="65" r="${r}" fill="none" stroke="var(--bg-4)" stroke-width="10"/><circle cx="65" cy="65" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${(circ-(circ*p/100)).toFixed(2)}"/></svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-d);font-size:28px;font-weight:800">${p}%</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%">${node.dueDate?`<div style="background:var(--bg-3);border:1px solid var(--bd);border-radius:var(--r-s);padding:10px;text-align:center"><div style="font-size:13px;font-weight:700;color:${daysUntil(node.dueDate)<0?'var(--red)':'var(--tx)'}">${dateLabel(node.dueDate)}</div><div style="font-size:10px;color:var(--tx-3);margin-top:2px">Deadline</div></div>`:''}<div style="background:var(--bg-3);border:1px solid var(--bd);border-radius:var(--r-s);padding:10px;text-align:center"><div style="font-size:13px;font-weight:700;color:${color}">${node.status||'active'}</div><div style="font-size:10px;color:var(--tx-3);margin-top:2px">Status</div></div></div></div><div><div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--tx-3);margin-bottom:10px">CHILD GOALS (${children.length})</div><div style="display:flex;flex-direction:column;gap:5px;margin-bottom:20px">${children.length?children.map(ch=>`<div onclick="enterFocusMode('${ch.id}')" style="display:flex;align-items:center;gap:9px;padding:9px 11px;background:var(--bg-3);border:1px solid var(--bd);border-radius:var(--r-s);cursor:pointer"><div style="width:7px;height:7px;border-radius:50%;background:${colorOf(ch.type)};flex-shrink:0"></div><div style="flex:1;font-size:13px;font-weight:500">${esc(ch.title)}</div><div style="font-size:11px;font-family:var(--font-m);color:${colorOf(ch.type)}">${pct(ch.currentValue,ch.targetValue)}%</div></div>`).join(''):'<div style="color:var(--tx-3);font-size:12px">No child nodes</div>'}</div>${node.notes?`<div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--tx-3);margin-bottom:8px">NOTES</div><div style="background:var(--bg-3);border:1px solid var(--bd);border-radius:var(--r-s);padding:12px;font-size:13px;line-height:1.7;color:var(--tx-2);white-space:pre-wrap">${esc(node.notes)}</div>`:''}</div></div>`;
  $('focus-overlay').classList.remove('hidden');
}

// ════════ CELEBRATION ════════
function showCelebration(title){
  const c=$('cel-overlay'); if(!c)return;
  const t=$('cel-title'); if(t)t.textContent=`${title} — Completed!`;
  c.classList.remove('hidden');
  setTimeout(()=>c.classList.add('hidden'),4000);
}

// ════════ SETTINGS ════════
function renderSettings(){
  const c=$('settings-content'); if(!c)return; c.innerHTML='';
  const grid=el('div','settings-grid');
  const themeCard=el('div','settings-card');
  themeCard.innerHTML=`<h3>Appearance</h3><div class="np-label" style="margin-bottom:8px">Theme</div>`;
  const row=el('div','theme-row');
  const swatches={midnight:'#0B0B0D',space:'#0D0A18',arctic:'#F0F2F5',cyber:'#020508',aurora:'#0B0B14'};
  THEMES.forEach(t=>{
    const sw=el('div',`theme-swatch${t===S.settings.theme?' active':''}`);
    sw.style.cssText=`background:${swatches[t]||'#0B0B0D'};border:2px solid ${t===S.settings.theme?'var(--tx)':'transparent'};`;
    sw.title=t; sw.onclick=()=>{applyTheme(t);scheduleSave();renderSettings();};
    row.appendChild(sw);
  });
  themeCard.appendChild(row); grid.appendChild(themeCard);
  const curCard=el('div','settings-card');
  curCard.innerHTML=`<h3>Currency</h3><div class="np-label" style="margin-bottom:8px">Base Currency (analytics)</div>`;
  const cs=el('select','np-select');
  Object.entries(CURRENCIES).forEach(([code,v])=>{const o=document.createElement('option');o.value=code;o.text=`${v.symbol} ${code} — ${v.name}`;o.selected=S.settings.baseCurrency===code;cs.appendChild(o);});
  cs.onchange=()=>{S.settings.baseCurrency=cs.value;scheduleSave();};
  curCard.appendChild(cs); grid.appendChild(curCard);
  const aiCard=el('div','settings-card');
  aiCard.innerHTML=`<h3>AI Intelligence</h3><p style="font-size:12.5px;color:var(--tx-2);margin-bottom:12px;line-height:1.6">Connect Gemini AI for contextual insights across your financial data, workspaces, and goals.</p><div class="np-label" style="margin-bottom:6px">Gemini API Key</div>`;
  const ki=el('input','np-input'); ki.type='password'; ki.value=S.settings.geminiKey||''; ki.placeholder='AIza…'; ki.style.marginBottom='8px';
  const sk=el('button','btn-primary btn-sm','<i class="bi bi-key"></i> Save Key');
  sk.onclick=()=>{S.settings.geminiKey=ki.value.trim();scheduleSave();toast('API key saved','success');};
  const note=el('div','');note.style.cssText='margin-top:10px;font-size:11px;color:var(--tx-3);line-height:1.7';note.innerHTML='Get a free key at <a href="https://aistudio.google.com" target="_blank" style="color:var(--ac)">aistudio.google.com</a>. Keys are stored securely in your Firebase profile.';
  aiCard.appendChild(ki); aiCard.appendChild(sk); aiCard.appendChild(note); grid.appendChild(aiCard);
  const accCard=el('div','settings-card');
  accCard.innerHTML=`<h3>Account</h3>`;
  const logBtn=el('button','btn-ghost','<i class="bi bi-box-arrow-right"></i> Sign Out'); logBtn.style.marginBottom='8px';
  logBtn.onclick=async()=>{await FB.signOut();location.reload();};
  const clrBtn=el('button','btn-ghost btn-danger-ghost','<i class="bi bi-trash3"></i> Clear All Data');
  clrBtn.onclick=async()=>{if(!confirm('Delete ALL data? This cannot be undone.'))return;await clearAllData();};
  accCard.appendChild(logBtn); accCard.appendChild(clrBtn); grid.appendChild(accCard);
  const scCard=el('div','settings-card');
  scCard.innerHTML=`<h3>Keyboard Shortcuts</h3><div class="shortcut-list"><div class="shortcut-row"><kbd>N</kbd><span>New Node</span></div><div class="shortcut-row"><kbd>⌘K</kbd><span>Command Palette</span></div><div class="shortcut-row"><kbd>0</kbd><span>Fit Roadmap View</span></div><div class="shortcut-row"><kbd>T</kbd><span>Cycle Theme</span></div><div class="shortcut-row"><kbd>Esc</kbd><span>Close panels</span></div></div>`;
  grid.appendChild(scCard);
  c.appendChild(grid);
}

async function clearAllData(){
  if(!S.user||!window.FIREBASE_READY)return;
  const uid=S.user.uid;
  S.workspaces=[];S.nodes=[];S.transactions=[];S.calEvents=[];S.notifications=[];
  for(const col of ['workspaces','nodes','transactions','calEvents','notifications']){
    try{const docs=await FB.loadSub(uid,col);for(const d of docs)await FB.deleteFromSub(uid,col,d.id);}catch(e){}
  }
  setView('global-dashboard'); renderSidebar(); toast('All data cleared','info');
}

// ════════ MODALS & CMD ════════
function openModal(id){$(id)?.classList.remove('hidden');}
function closeModal(id){$(id)?.classList.add('hidden');}

let _cmdResults=[];
function openCmdPalette(){
  openModal('cmd-overlay');
  const inp=$('cmd-input'); if(inp){inp.value='';inp.focus();}
  buildCmdResults('');
}
function closeCmdPalette(){closeModal('cmd-overlay');}

function buildCmdResults(q){
  const c=$('cmd-results'); if(!c)return;
  const cmds=[
    {icon:'bi-grid-1x2-fill',title:'Dashboard',sub:'Global',action:()=>setView('global-dashboard')},
    {icon:'bi-graph-up-arrow',title:'Financial Overview',sub:'Global',action:()=>setView('financial-overview')},
    {icon:'bi-calendar3',title:'Calendar',sub:'Global',action:()=>setView('calendar')},
    {icon:'bi-bell',title:'Notifications',sub:'Global',action:()=>setView('notifications')},
    {icon:'bi-plus-lg',title:'New Node',sub:'Cmd',kb:'N',action:()=>openAddNodeModal()},
    {icon:'bi-diagram-2',title:'New Workspace',sub:'Cmd',action:()=>openAddWsModal()},
    {icon:'bi-arrows-angle-expand',title:'Fit View',sub:'Cmd',kb:'0',action:()=>fitView()},
    {icon:'bi-palette',title:'Cycle Theme',sub:'Cmd',kb:'T',action:()=>cycleTheme()},
    {icon:'bi-gear',title:'Settings',sub:'Global',action:()=>setView('settings')},
    ...S.workspaces.map(ws=>({icon:ws.icon||(WS_TYPES[ws.type]||WS_TYPES.custom).icon,title:ws.name,sub:'Workspace',action:()=>openWorkspace(ws.id)})),
  ];
  const filtered=q?cmds.filter(c=>(c.title+c.sub).toLowerCase().includes(q.toLowerCase())):cmds;
  const nodeR=q?S.nodes.filter(n=>n.title.toLowerCase().includes(q.toLowerCase())).slice(0,5):[];
  c.innerHTML='';
  if(filtered.length){
    c.appendChild(el('div','cmd-section-lbl','Commands'));
    filtered.slice(0,8).forEach((cmd,i)=>{
      const item=el('div',`cmd-item${i===S.cmdFocusIdx?' focused':''}`);
      item.innerHTML=`<div class="cmd-item-icon"><i class="bi ${cmd.icon}"></i></div><div class="cmd-item-text"><div class="cmd-item-title">${cmd.title}</div><div class="cmd-item-sub">${cmd.sub}</div></div>${cmd.kb?`<kbd>${cmd.kb}</kbd>`:''}`;
      item.onclick=()=>{cmd.action();closeCmdPalette();};
      c.appendChild(item);
    });
  }
  if(nodeR.length){
    c.appendChild(el('div','cmd-section-lbl','Nodes'));
    nodeR.forEach(n=>{
      const item=el('div','cmd-item');
      item.innerHTML=`<div class="cmd-item-icon"><i class="bi ${iconOf(n.type)}" style="color:${colorOf(n.type)}"></i></div><div class="cmd-item-text"><div class="cmd-item-title">${esc(n.title)}</div><div class="cmd-item-sub">${(SCHEMAS[n.type]||{label:''}).label}</div></div>`;
      item.onclick=()=>{openWorkspace(n.wsId);setWsTab('roadmap');setTimeout(()=>{selectNode(n.id);centerOn(n);},100);closeCmdPalette();};
      c.appendChild(item);
    });
  }
  _cmdResults=[...filtered.slice(0,8),...nodeR.map(n=>({action:()=>{openWorkspace(n.wsId);setWsTab('roadmap');setTimeout(()=>selectNode(n.id),100);}}))];
}

// ════════ EVENT LISTENERS ════════
document.addEventListener('DOMContentLoaded',()=>{
  // Auth
  $('google-login-btn')?.addEventListener('click',()=>FB.signInWithGoogle().catch(e=>toast(e.message||'Login failed','error')));
  // Workspace subnav tabs
  document.querySelectorAll('.ws-tab').forEach(b=>b.addEventListener('click',()=>setWsTab(b.dataset.tab)));
  // Global nav + settings
  document.querySelectorAll('.nav-btn[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  // Workspace actions
  $('ws-add-node-btn')?.addEventListener('click',openAddNodeModal);
  $('ws-share-btn')?.addEventListener('click',()=>S.activeWsId&&shareWorkspace(S.activeWsId));
  $('ws-delete-btn')?.addEventListener('click',()=>S.activeWsId&&deleteWorkspace(S.activeWsId));
  $('sb-add-ws')?.addEventListener('click',openAddWsModal);
  $('ws-create')?.addEventListener('click',createWorkspace);
  $('ws-cancel')?.addEventListener('click',()=>closeModal('add-ws-modal'));
  $('ws-modal-close')?.addEventListener('click',()=>closeModal('add-ws-modal'));
  // Node modal
  $('nm-create')?.addEventListener('click',createNode);
  $('nm-cancel')?.addEventListener('click',()=>closeModal('add-node-modal'));
  $('node-modal-close')?.addEventListener('click',()=>closeModal('add-node-modal'));
  // Transaction modal
  $('tx-save')?.addEventListener('click',async()=>{
    const amount=parseFloat($('tx-amount')?.value);
    if(!amount||amount<=0){toast('Enter valid amount','error');return;}
    await logTransaction(_txNodeId,_txWsId,_txType,amount,$('tx-currency')?.value,$('tx-note')?.value,$('tx-date')?.value);
    closeModal('tx-modal');
    const node=S.nodes.find(n=>n.id===_txNodeId); if(node)openNodePanel(node);
  });
  $('tx-cancel')?.addEventListener('click',()=>closeModal('tx-modal'));
  $('tx-modal-close')?.addEventListener('click',()=>closeModal('tx-modal'));
  // Node panel
  $('np-close-btn')?.addEventListener('click',closeNodePanel);
  // Canvas toolbar
  $('zoom-in-btn')?.addEventListener('click',()=>{S.canvas.scale=clamp(S.canvas.scale*1.2,0.12,3);applyTransform();renderMiniMap();});
  $('zoom-out-btn')?.addEventListener('click',()=>{S.canvas.scale=clamp(S.canvas.scale/1.2,0.12,3);applyTransform();renderMiniMap();});
  $('zoom-fit-btn')?.addEventListener('click',fitView);
  // Theme
  $('theme-btn')?.addEventListener('click',cycleTheme);
  // Cmd palette
  $('cmd-trigger')?.addEventListener('click',openCmdPalette);
  $('cmd-input')?.addEventListener('input',e=>{S.cmdFocusIdx=0;buildCmdResults(e.target.value);});
  $('cmd-overlay')?.addEventListener('click',e=>{if(e.target===$('cmd-overlay'))closeCmdPalette();});
  // Search
  $('search-input')?.addEventListener('input',e=>renderSearch(e.target.value));
  // Focus close
  $('focus-close')?.addEventListener('click',()=>$('focus-overlay').classList.add('hidden'));
  $('focus-overlay')?.addEventListener('click',e=>{if(e.target===e.currentTarget)$('focus-overlay').classList.add('hidden');});
  // Sidebar collapse
  $('sb-collapse')?.addEventListener('click',()=>$('sidebar').classList.toggle('collapsed'));
  // Financial period filters
  document.querySelectorAll('.filter-btn[data-period]').forEach(b=>{
    b.addEventListener('click',()=>{
      S.finPeriod=b.dataset.period;
      document.querySelectorAll('.filter-btn[data-period]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); renderFinancialOverview();
    });
  });
  // Canvas empty btn
  $('canvas-empty-btn')?.addEventListener('click',openAddNodeModal);
  // Minimap click
  $('mini-map')?.addEventListener('click',e=>{
    const canvas=$('mini-map'),rect=canvas.getBoundingClientRect();
    const nodes=activeNodes(); if(!nodes.length)return;
    const minX=Math.min(...nodes.map(n=>n.posX)),minY=Math.min(...nodes.map(n=>n.posY));
    const maxX=Math.max(...nodes.map(n=>n.posX+275)),maxY=Math.max(...nodes.map(n=>n.posY+72));
    const sc=Math.min(canvas.width/(maxX-minX||1)*0.9,canvas.height/(maxY-minY||1)*0.9);
    const offX=(canvas.width-(maxX-minX)*sc)/2-minX*sc,offY=(canvas.height-(maxY-minY)*sc)/2-minY*sc;
    const wx=(e.clientX-rect.left-offX)/sc,wy=(e.clientY-rect.top-offY)/sc;
    const wrap=$('canvas-wrap');
    S.canvas.x=-wx*S.canvas.scale+(wrap?.clientWidth||800)/2;
    S.canvas.y=-wy*S.canvas.scale+(wrap?.clientHeight||600)/2;
    applyTransform();
  });
  // Keyboard shortcuts
  document.addEventListener('keydown',e=>{
    const tag=document.activeElement?.tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    if(e.key==='Escape'){['cmd-overlay','add-node-modal','add-ws-modal','tx-modal'].forEach(id=>$(id)?.classList.add('hidden'));$('focus-overlay')?.classList.add('hidden');closeNodePanel();}
    if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();openCmdPalette();}
    if(e.key==='n'||e.key==='N'){openAddNodeModal();}
    if(e.key==='t'||e.key==='T'){cycleTheme();}
    if(e.key==='0'&&S.view==='workspace'&&S.wsTab==='roadmap'){fitView();}
    if(e.key==='ArrowDown'&&!$('cmd-overlay')?.classList.contains('hidden')){S.cmdFocusIdx=Math.min(S.cmdFocusIdx+1,_cmdResults.length-1);buildCmdResults($('cmd-input')?.value||'');}
    if(e.key==='ArrowUp'&&!$('cmd-overlay')?.classList.contains('hidden')){S.cmdFocusIdx=Math.max(S.cmdFocusIdx-1,0);buildCmdResults($('cmd-input')?.value||'');}
    if(e.key==='Enter'&&!$('cmd-overlay')?.classList.contains('hidden')){_cmdResults[S.cmdFocusIdx]?.action();closeCmdPalette();}
  });
});

// ════════ BOOT ════════
(function boot(){
  applyTheme('midnight');
  FB.init();
  initAuth();
  setSaveDot('saved');
})();
