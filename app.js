/* LifeOS Elite — app.js  */
'use strict';

// ════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════
const NODE_TYPES = {
  goal:        { label:'Goal',        icon:'🎯', color:'#4f8cff' },
  milestone:   { label:'Milestone',   icon:'⭐', color:'#a855f7' },
  financial:   { label:'Financial',   icon:'💰', color:'#22c55e' },
  habit:       { label:'Habit',       icon:'🔥', color:'#f59e0b' },
  achievement: { label:'Achievement', icon:'🏆', color:'#ec4899' },
  debt:        { label:'Debt',        icon:'📉', color:'#ef4444' },
  investment:  { label:'Investment',  icon:'📈', color:'#06b6d4' },
  kpi:         { label:'KPI',         icon:'📊', color:'#8b5cf6' },
  business:    { label:'Business',    icon:'🏢', color:'#f97316' },
  task:        { label:'Task',        icon:'✅', color:'#64748b' },
  learning:    { label:'Learning',    icon:'📚', color:'#14b8a6' },
  health:      { label:'Health',      icon:'💪', color:'#84cc16' },
  income:      { label:'Income',      icon:'💵', color:'#10b981' },
  asset:       { label:'Asset',       icon:'🏠', color:'#6366f1' },
  automation:  { label:'Automation',  icon:'⚡', color:'#e879f9' },
};

const THEMES = ['midnight','space','arctic','cyber','aurora','neon'];

const KANBAN_COLS = [
  { id:'active',    label:'In Progress', color:'#4f8cff' },
  { id:'paused',    label:'Paused',      color:'#f59e0b' },
  { id:'blocked',   label:'Blocked',     color:'#ef4444' },
  { id:'completed', label:'Done',        color:'#22c55e' },
];



// ════════════════════════════════════
// STATE
// ════════════════════════════════════
const S = {
  user: null,
  trees: [],
  nodes: [],
  habits: [],
  finance: { income:0, savings:0, investments:0, debts:0, loans:0, history:[] },
  stock: { uploads:0, approved:0, rejected:0, earnings:0, goal:10000, dailyStreak:0, history:[] },
  youtube: { subscribers:0, watchHours:0, uploads:0, rpm:0, goal:100000, history:[] },
  settings: { theme:'midnight', accentIdx:0 },
  activeTreeId: null,
  selectedNodeId: null,
  currentView: 'canvas',
  canvas: { x:80, y:100, scale:1 },
  drag: { on:false, nodeId:null, sx:0, sy:0, nx:0, ny:0 },
  pan: { on:false, sx:0, sy:0, ox:0, oy:0 },
  saveTimer: null,
  cmdFocusIdx: 0,
  themeIdx: 0,
  onboardingStep: 0,
  onboardingDone: false,
  activityLog: {},
};

// ════════════════════════════════════
// DOM HELPERS
// ════════════════════════════════════
const $ = id => document.getElementById(id);
const el = (tag, cls='', html='') => { const e = document.createElement(tag); if(cls) e.className = cls; if(html) e.innerHTML = html; return e; };

// ════════════════════════════════════
// UTILS
// ════════════════════════════════════
const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36);
const now = () => new Date().toISOString();
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const pct = (cur,tgt) => tgt>0 ? Math.min(100,Math.round(cur/tgt*100)) : 0;
const fmtN = n => { const v=Number(n); if(isNaN(v)) return '0'; if(v>=1e6) return (v/1e6).toFixed(1)+'M'; if(v>=1000) return (v/1000).toFixed(1)+'K'; return v.toLocaleString(); };
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const typeColor = t => (NODE_TYPES[t]||NODE_TYPES.goal).color;
const typeIcon  = t => (NODE_TYPES[t]||NODE_TYPES.goal).icon;

// ════════════════════════════════════
// AUTOSAVE (Firestore only)
// ════════════════════════════════════
function scheduleSave() {
  setSaveDot('saving');
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(async () => {
    if (S.user && window.FIREBASE_READY && !window.DEMO_MODE) {
      try {
        const userUid = S.user.uid;
        await Promise.all([
          ...S.trees.map(t => FirebaseService.fbSave('trees', {...t, uid: userUid})),
          ...S.nodes.map(n => FirebaseService.fbSave('nodes', {...n, uid: userUid})),
          FirebaseService.fbSaveProfile(userUid, {
            habits: S.habits,
            finance: S.finance,
            stock: S.stock,
            youtube: S.youtube,
            settings: S.settings,
            activityLog: S.activityLog,
            onboardingDone: S.onboardingDone,
          }),
        ]);
      } catch(e) { setSaveDot('error'); return; }
    }
    setSaveDot('saved');
  }, 700);
}
function setSaveDot(s) {
  const d = $('save-dot');
  if (!d) return;
  d.className = 'save-dot';
  if (s==='saving') d.classList.add('saving');
  if (s==='error') d.classList.add('error');
}

// ════════════════════════════════════
// TOAST
// ════════════════════════════════════
function toast(msg, type='info', dur=2800) {
  const t = el('div', `toast ${type}`, `<span>${{success:'✓',error:'✕',info:'◆'}[type]}</span><span>${msg}</span>`);
  $('toast-container').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, dur);
}

// ════════════════════════════════════
// PARTICLES
// ════════════════════════════════════
// AUTH
// ════════════════════════════════════
function showApp(user) {
  S.user = user;
  hideLoader();
  $('auth-overlay').classList.add('hidden');
  if (user) {
    const av = $('user-avatar');
    av.innerHTML = user.photoURL ? `<img src="${user.photoURL}" alt=""/>` : (user.displayName||'U')[0].toUpperCase();
    $('user-name').textContent = user.displayName || user.email || 'User';
  }
  loadData();
}

function showLoader() { const l=$('app-loader'); if(l) l.classList.remove('hidden'); }
function hideLoader() { const l=$('app-loader'); if(l) l.classList.add('hidden'); }

async function initAuth() {
  FirebaseService.init();
  if (!window.FIREBASE_READY || window.DEMO_MODE) {
    hideLoader();
    $('auth-overlay').classList.remove('hidden');
    return;
  }
  FirebaseService.onAuthChange(u => {
    if (u) {
      showApp(u);
    } else {
      hideLoader();
      $('auth-overlay').classList.remove('hidden');
    }
  });
}

$('google-login-btn').addEventListener('click', async () => {
  if (!window.FIREBASE_READY) { window.DEMO_MODE=true; showApp(null); return; }
  try {
    $('google-login-btn').textContent = 'Connecting...';
    await FirebaseService.signInWithGoogle();
  } catch(e) {
    toast('Login failed: '+e.message, 'error');
    $('google-login-btn').innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Continue with Google`;
  }
});

$('demo-btn').addEventListener('click', () => { window.DEMO_MODE=true; hideLoader(); showApp(null); });

// ════════════════════════════════════
// DATA LOADING
// ════════════════════════════════════
async function loadData() {
  if (S.user && window.FIREBASE_READY && !window.DEMO_MODE) {
    try {
      const [trees, nodes, profile] = await Promise.all([
        FirebaseService.fbLoadAll('trees', S.user.uid),
        FirebaseService.fbLoadAll('nodes', S.user.uid),
        FirebaseService.fbGetProfile(S.user.uid),
      ]);
      if (trees.length) S.trees = trees;
      if (nodes.length) S.nodes = nodes;
      if (profile) {
        if (profile.habits)      S.habits      = profile.habits;
        if (profile.finance)     S.finance     = { ...S.finance, ...profile.finance };
        if (profile.stock)       S.stock       = { ...S.stock, ...profile.stock };
        if (profile.youtube)     S.youtube     = { ...S.youtube, ...profile.youtube };
        if (profile.settings)    S.settings    = profile.settings;
        if (profile.activityLog) S.activityLog = profile.activityLog;
        if (profile.onboardingDone) S.onboardingDone = profile.onboardingDone;
      }
    } catch(e) { console.warn('Firestore load error, using local cache:', e); }
  }

  const firstTime = S.trees.length === 0 && !S.onboardingDone;
  if (firstTime) { seedDemo(); scheduleSave(); }
  if (S.trees.length) S.activeTreeId = S.trees[0].id;

  applyTheme(S.settings.theme || 'midnight');
  S.themeIdx = THEMES.indexOf(S.settings.theme || 'midnight');

  if (firstTime) {
    $('app').classList.remove('hidden');
    showOnboarding();
  } else {
    $('app').classList.remove('hidden');
    renderAll();
    setView('canvas');
  }

  updateStreakDisplay();
  setSaveDot('saved');
}

function seedDemo() {
  const treeId = uid();
  S.trees = [{ id:treeId, name:'Life Roadmap', uid: S.user?.uid||'demo', createdAt:now() }];
  const r=uid(), n1=uid(), n2=uid(), n3=uid(), n4=uid(), n5=uid(), n6=uid(), n7=uid();
  S.nodes = [
    mkNode({id:r,  treeId, parentId:null, type:'goal',      title:'Financial Freedom',        cur:12000, tgt:50000, x:1100, y:500,  cat:'Finance',  pri:'high'}),
    mkNode({id:n1, treeId, parentId:r,   type:'income',     title:'Earn $50,000',             cur:12000, tgt:50000, x:780,  y:720,  cat:'Income',   pri:'high'}),
    mkNode({id:n2, treeId, parentId:r,   type:'debt',       title:'Close All Loans',          cur:3,     tgt:7,     x:1400, y:720,  cat:'Finance',  pri:'high'}),
    mkNode({id:n3, treeId, parentId:n1,  type:'financial',  title:'10K Adobe Stock Assets',   cur:2500,  tgt:10000, x:560,  y:960,  cat:'Content',  pri:'medium', tags:'adobe,content'}),
    mkNode({id:n4, treeId, parentId:n1,  type:'kpi',        title:'100K YouTube Subscribers', cur:18200, tgt:100000,x:1020, y:960,  cat:'YouTube',  pri:'medium'}),
    mkNode({id:n5, treeId, parentId:n3,  type:'milestone',  title:'Buy New Camera Gear',      cur:0,     tgt:1,     x:380,  y:1200, cat:'Equipment',pri:'low'}),
    mkNode({id:n6, treeId, parentId:r,   type:'business',   title:'Launch Creative Agency',   cur:0,     tgt:1,     x:1360, y:960,  cat:'Business', pri:'high', deps:[n1,n2]}),
    mkNode({id:n7, treeId, parentId:n4,  type:'learning',   title:'Master Video Editing',     cur:60,    tgt:100,   x:860,  y:1200, cat:'Skills',   pri:'medium'}),
  ];
  S.habits = [
    { id:uid(), title:'Daily Upload', emoji:'📦', target:1, streak:7, history:[] },
    { id:uid(), title:'YouTube Script', emoji:'✍️', target:1, streak:3, history:[] },
    { id:uid(), title:'Workout',        emoji:'💪', target:1, streak:5, history:[] },
  ];
  S.stock   = { uploads:2500, approved:2180, rejected:320, earnings:1240, goal:10000, dailyStreak:7, history:[] };
  S.youtube = { subscribers:18200, watchHours:3400, uploads:42, rpm:2.4, goal:100000, history:[] };
  S.finance = { income:12000, savings:4500, investments:2000, debts:18000, loans:2, history:[] };
}

function mkNode({id,treeId,parentId=null,type='goal',title='New Goal',cur=0,tgt=100,x=400,y=400,cat='',pri='medium',notes='',status='active',dueDate='',completed=false,deps=[],tags=''}) {
  return { id:id||uid(), treeId, parentId, type, title,
    currentValue:+cur||0, targetValue:+tgt||100,
    progress:pct(cur,tgt), completed, status, priority:pri,
    category:cat, notes, dueDate, tags: tags||'',
    dependencies: deps||[], positionX:+x, positionY:+y,
    createdAt:now(), updatedAt:now() };
}

// ════════════════════════════════════
// ONBOARDING
// ════════════════════════════════════
function showOnboarding() {
  $('onboarding-overlay').classList.remove('hidden');
  S.onboardingStep = 0;
}

['ob-next-0','ob-next-1'].forEach((btnId,i) => {
  const btn = $(btnId);
  if (btn) btn.addEventListener('click', () => advanceOnboarding(i+1));
});

const obFinish = $('ob-finish-btn');
if (obFinish) obFinish.addEventListener('click', finishOnboarding);

function advanceOnboarding(step) {
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.ob-dot').forEach((d,i) => d.classList.toggle('active', i===step));
  const stepEl = document.querySelector(`.ob-step[data-step="${step}"]`);
  if (stepEl) stepEl.classList.add('active');
  S.onboardingStep = step;

  if (step===2) {
    const goalInput = $('ob-goal-input');
    if (goalInput && goalInput.value.trim()) {
      const title = goalInput.value.trim();
      const treeId = S.trees[0]?.id || uid();
      const node = mkNode({ treeId, type:'goal', title, tgt:100, x:900, y:500 });
      S.nodes.push(node);
      scheduleSave();
    }
  }
}

function finishOnboarding() {
  S.onboardingDone = true;
  $('onboarding-overlay').classList.add('hidden');
  scheduleSave();
  renderAll();
  setView('canvas');
  toast('Welcome to LifeOS! Press N to add your first node.', 'info', 4000);
}

// ════════════════════════════════════
// RENDER ALL
// ════════════════════════════════════
function renderAll() {
  renderSidebar();
  renderCanvas();
  renderMiniMap();
}

// ════════════════════════════════════
// SIDEBAR WORKSPACES
// ════════════════════════════════════
function renderSidebar() {
  const wrap = $('sb-trees');
  if (!wrap) return;
  wrap.innerHTML = '';
  S.trees.forEach(tree => {
    const item = el('div', `sb-tree-item${tree.id===S.activeTreeId?' active':''}`, `<span class="sb-tree-dot"></span>${esc(tree.name)}`);
    item.title = tree.name;
    item.addEventListener('click', () => {
      S.activeTreeId = tree.id;
      renderSidebar();
      renderCanvas();
      renderMiniMap();
    });
    wrap.appendChild(item);
  });
}

// ════════════════════════════════════
// CANVAS
// ════════════════════════════════════
function currentNodes() {
  return S.activeTreeId ? S.nodes.filter(n => n.treeId===S.activeTreeId) : S.nodes;
}

function renderCanvas() {
  const nodes = currentNodes();
  // Remove old node elements
  document.querySelectorAll('.node').forEach(e => e.remove());
  $('canvas-empty').classList.toggle('hidden', nodes.length>0);
  applyTransform();
  nodes.forEach(n => $('canvas-world').appendChild(buildNodeEl(n)));
  renderConnections(nodes);
  renderTreeTabs();
}

function buildNodeEl(node) {
  const p = pct(node.currentValue, node.targetValue);
  const color = typeColor(node.type);
  const info = NODE_TYPES[node.type]||NODE_TYPES.goal;
  const isBlocked = !!(node.dependencies||[]).length && !allDepsComplete(node);

  const d = el('div', `node${node.completed?' completed':''}${node.id===S.selectedNodeId?' selected':''}${isBlocked?' blocked':''}`);
  d.dataset.nodeId = node.id;
  d.dataset.type   = node.type;
  d.style.left = node.positionX+'px';
  d.style.top  = node.positionY+'px';
  d.style.setProperty('--node-glow', color+'55');
  d.innerHTML = `
    <div class="node-stripe" style="background:${color};box-shadow:0 0 8px ${color}88"></div>
    <div class="node-header">
      <div class="node-title">${info.icon} ${esc(node.title)}</div>
      <div class="node-badge" style="color:${color};background:${color}18;border:1px solid ${color}30">${info.label}</div>
    </div>
    <div class="node-progress">
      <div class="node-bar"><div class="node-bar-fill" style="width:${p}%;background:${color};box-shadow:0 0 6px ${color}88"></div></div>
      <div class="node-prog-text"><span>${fmtN(node.currentValue)} / ${fmtN(node.targetValue)}</span><span style="color:${color}">${p}%</span></div>
    </div>
    <div class="node-done-badge">✓</div>
    ${isBlocked ? '<div class="node-deps-lock">🔒</div>' : ''}
  `;

  d.addEventListener('click', e => { e.stopPropagation(); if (!S.drag.on) selectNode(node.id); });
  d.addEventListener('mousedown', e => { if(e.target.closest('.node-deps-lock')) return; startDrag(e, node.id); });
  d.addEventListener('dblclick', e => { e.stopPropagation(); enterFocusMode(node.id); });
  return d;
}

function allDepsComplete(node) {
  return (node.dependencies||[]).every(depId => {
    const dep = S.nodes.find(n => n.id===depId);
    return dep && dep.completed;
  });
}

function renderConnections(nodes) {
  const svg = $('connections-svg');
  svg.innerHTML = '';
  const map = {};
  nodes.forEach(n => map[n.id]=n);
  nodes.forEach(node => {
    if (!node.parentId || !map[node.parentId]) return;
    const par = map[node.parentId];
    const W=210, H=80;
    const x1=par.positionX+W/2, y1=par.positionY+H;
    const x2=node.positionX+W/2, y2=node.positionY;
    const my=(y2-y1)*0.42;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',`M${x1},${y1} C${x1},${y1+my} ${x2},${y2-my} ${x2},${y2}`);
    const isBlocked = !allDepsComplete(node) && (node.dependencies||[]).length>0;
    path.classList.add('conn-path', node.completed&&par.completed?'done': isBlocked?'blocked':'active');
    svg.appendChild(path);
  });
}

function applyTransform() {
  const w = $('canvas-world');
  w.style.transform = `translate(${S.canvas.x}px,${S.canvas.y}px) scale(${S.canvas.scale})`;
  $('zoom-label').textContent = Math.round(S.canvas.scale*100)+'%';
}

function renderTreeTabs() {
  const tb = $('tree-tabs');
  tb.innerHTML = '';
  S.trees.forEach(tree => {
    const chip = el('button', `tree-tab${tree.id===S.activeTreeId?' active':''}`, esc(tree.name));
    chip.addEventListener('click', () => { S.activeTreeId=tree.id; renderSidebar(); renderCanvas(); renderMiniMap(); });
    tb.appendChild(chip);
  });
}

// ── MINIMAP ──
function renderMiniMap() {
  const cv = $('mini-map');
  if (!cv) return;
  const W=160, H=110;
  cv.width=W; cv.height=H;
  const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,W,H);
  const nodes = currentNodes();
  if (!nodes.length) return;
  const minX=Math.min(...nodes.map(n=>n.positionX));
  const minY=Math.min(...nodes.map(n=>n.positionY));
  const maxX=Math.max(...nodes.map(n=>n.positionX+210));
  const maxY=Math.max(...nodes.map(n=>n.positionY+90));
  const scaleX=W/(maxX-minX+100), scaleY=H/(maxY-minY+100);
  const sc=Math.min(scaleX,scaleY)*.85;
  nodes.forEach(n => {
    const x=(n.positionX-minX)*sc+10, y=(n.positionY-minY)*sc+10;
    ctx.fillStyle = typeColor(n.type)+'bb';
    ctx.beginPath(); ctx.roundRect(x,y,Math.max(20,210*sc),Math.max(12,60*sc),3); ctx.fill();
  });
  // viewport rect
  const vc = $('canvas-container').getBoundingClientRect();
  const vx=(-S.canvas.x/S.canvas.scale-minX)*sc+10;
  const vy=(-S.canvas.y/S.canvas.scale-minY)*sc+10;
  const vw=(vc.width/S.canvas.scale)*sc;
  const vh=(vc.height/S.canvas.scale)*sc;
  ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=1.5;
  ctx.strokeRect(vx,vy,vw,vh);
}

// ════════════════════════════════════
// CANVAS EVENTS — PAN + ZOOM
// ════════════════════════════════════
const canvasWrap = $('canvas-view');

canvasWrap.addEventListener('mousedown', e => {
  const isCanvas = e.target===canvasWrap || e.target===$('canvas-container') || e.target===$('canvas-world') || e.target===$('connections-svg');
  if (!isCanvas) return;
  S.pan = { on:true, sx:e.clientX, sy:e.clientY, ox:S.canvas.x, oy:S.canvas.y };
  canvasWrap.style.cursor='grabbing';
});

document.addEventListener('mousemove', e => {
  if (S.pan.on) {
    S.canvas.x = S.pan.ox + (e.clientX-S.pan.sx);
    S.canvas.y = S.pan.oy + (e.clientY-S.pan.sy);
    applyTransform();
    renderMiniMap();
  }
  if (S.drag.on) {
    const dx=(e.clientX-S.drag.sx)/S.canvas.scale;
    const dy=(e.clientY-S.drag.sy)/S.canvas.scale;
    const node = S.nodes.find(n=>n.id===S.drag.nodeId);
    if (node) {
      node.positionX = S.drag.nx+dx;
      node.positionY = S.drag.ny+dy;
      const el = document.querySelector(`[data-node-id="${node.id}"]`);
      if (el) { el.style.left=node.positionX+'px'; el.style.top=node.positionY+'px'; }
      renderConnections(currentNodes());
    }
  }
});

document.addEventListener('mouseup', () => {
  if (S.pan.on) { S.pan.on=false; canvasWrap.style.cursor='grab'; }
  if (S.drag.on) {
    S.drag.on=false;
    document.querySelector(`[data-node-id="${S.drag.nodeId}"]`)?.classList.remove('dragging');
    scheduleSave();
    renderMiniMap();
  }
});

canvasWrap.addEventListener('click', e => {
  if (e.target===canvasWrap || e.target===$('canvas-container') || e.target===$('canvas-world')) closePanel();
});

canvasWrap.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY<0 ? 1.09 : 0.92;
  const ns = clamp(S.canvas.scale*factor, 0.1, 4);
  const rect = canvasWrap.getBoundingClientRect();
  const mx=e.clientX-rect.left, my=e.clientY-rect.top;
  const sc=ns/S.canvas.scale;
  S.canvas.x = mx - sc*(mx-S.canvas.x);
  S.canvas.y = my - sc*(my-S.canvas.y);
  S.canvas.scale = ns;
  applyTransform();
  renderMiniMap();
}, {passive:false});

function startDrag(e, nodeId) {
  e.preventDefault();
  const node = S.nodes.find(n=>n.id===nodeId);
  if (!node) return;
  S.drag = { on:true, nodeId, sx:e.clientX, sy:e.clientY, nx:node.positionX, ny:node.positionY };
  document.querySelector(`[data-node-id="${nodeId}"]`)?.classList.add('dragging');
}

$('zoom-in-btn').addEventListener('click', () => { S.canvas.scale=clamp(S.canvas.scale*1.2,0.1,4); applyTransform(); renderMiniMap(); });
$('zoom-out-btn').addEventListener('click', () => { S.canvas.scale=clamp(S.canvas.scale/1.2,0.1,4); applyTransform(); renderMiniMap(); });
$('zoom-fit-btn').addEventListener('click', fitView);

function fitView() {
  const nodes = currentNodes();
  if (!nodes.length) { S.canvas={x:80,y:100,scale:1}; applyTransform(); return; }
  const rect = $('canvas-container').getBoundingClientRect();
  const minX=Math.min(...nodes.map(n=>n.positionX));
  const minY=Math.min(...nodes.map(n=>n.positionY));
  const maxX=Math.max(...nodes.map(n=>n.positionX+220));
  const maxY=Math.max(...nodes.map(n=>n.positionY+100));
  const ww=maxX-minX+120, wh=maxY-minY+120;
  const sc = Math.min(rect.width/ww, rect.height/wh, 1.5)*0.88;
  S.canvas.scale=sc;
  S.canvas.x = (rect.width-(maxX+minX)*sc)/2 + 60*sc;
  S.canvas.y = (rect.height-(maxY+minY)*sc)/2 + 60*sc;
  applyTransform(); renderMiniMap();
}

// ════════════════════════════════════
// NAVIGATION / VIEWS
// ════════════════════════════════════
const VIEW_ELS = {
  canvas:         'canvas-view',
  timeline:       'timeline-view',
  kanban:         'kanban-view',
  analytics:      'analytics-view',
  dashboard:      'dashboard-view',
  habits:         'habits-view',
  finance:        'finance-view',
  'stock-tracker':'stock-tracker-view',
  'youtube-tracker':'youtube-tracker-view',
  completed:      'completed-view',
  settings:       'settings-view',
};

function setView(view) {
  S.currentView = view;
  Object.values(VIEW_ELS).forEach(id => $('main-content').querySelector('#'+id)?.classList.add('hidden'));
  const el = $(VIEW_ELS[view]);
  if (el) el.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view===view));
  // Lazy render each view
  if (view==='dashboard')       renderDashboard();
  if (view==='timeline')        renderTimeline();
  if (view==='kanban')          renderKanban();
  if (view==='analytics')       renderAnalytics();
  if (view==='habits')          renderHabits();
  if (view==='finance')         renderFinance();
  if (view==='stock-tracker')   renderStockTracker();
  if (view==='youtube-tracker') renderYouTube();
  if (view==='completed')       renderCompleted();
  if (view==='settings')        renderSettings();
  if (view==='canvas') { renderCanvas(); renderMiniMap(); }
}

document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.addEventListener('click', () => setView(item.dataset.view));
});

$('sidebar-toggle').addEventListener('click', () => $('sidebar').classList.toggle('collapsed'));
$('sb-add-tree').addEventListener('click', () => openModal('add-tree-modal'));
$('canvas-empty-btn')?.addEventListener('click', openAddNodeModal);

// ════════════════════════════════════
// NODE SELECTION + PANEL
// ════════════════════════════════════
function selectNode(nodeId) {
  S.selectedNodeId = nodeId;
  document.querySelectorAll('.node').forEach(e => e.classList.toggle('selected', e.dataset.nodeId===nodeId));
  const node = S.nodes.find(n=>n.id===nodeId);
  if (node) openPanel(node);
}

function openPanel(node) {
  // Recalculate auto-progress from children
  autoCalcProgress(node.id);

  $('dp-title').value = node.title;
  $('dp-current').value = node.currentValue;
  $('dp-target').value = node.targetValue;
  $('dp-priority').value = node.priority||'medium';
  $('dp-status').value = node.status||'active';
  $('dp-category').value = node.category||'';
  $('dp-due').value = node.dueDate||'';
  $('dp-notes').value = node.notes||'';
  $('dp-tags').value = node.tags||'';

  const info = NODE_TYPES[node.type]||NODE_TYPES.goal;
  $('dp-type-pill').textContent = info.icon+' '+info.label;
  $('dp-type-pill').style.background = typeColor(node.type)+'22';
  $('dp-type-pill').style.color = typeColor(node.type);
  $('dp-unit').textContent = node.type==='financial'||node.type==='income'||node.type==='debt' ? '$' : 'units';

  buildTypeGrid('dp-type-grid', node.type, t => {});
  updatePanelProgress();
  populateParentSelect('dp-parent', node.id, node.parentId);
  populateDepsUI(node);
  populateAddDepSelect(node);
  renderDpAnalytics(node);
  renderDpActivity(node.id);

  $('dp-complete-btn').style.opacity = node.completed ? '.4' : '1';
  $('detail-panel').classList.remove('closed');
}

function closePanel() {
  $('detail-panel').classList.add('closed');
  S.selectedNodeId = null;
  document.querySelectorAll('.node.selected').forEach(e => e.classList.remove('selected'));
}

function updatePanelProgress() {
  const cur=parseFloat($('dp-current').value)||0;
  const tgt=parseFloat($('dp-target').value)||0;
  const p=pct(cur,tgt);
  $('dp-bar-fill').style.width=p+'%';
  $('dp-pct').textContent=p+'%';
}

function buildTypeGrid(containerId, activeType, onSelect) {
  const grid = $(containerId);
  if (!grid) return;
  grid.innerHTML='';
  Object.entries(NODE_TYPES).forEach(([key,info]) => {
    const btn = el('button', `dp-type-btn${key===activeType?' active':''}`, `${info.icon} ${info.label}`);
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.dp-type-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(key);
    });
    grid.appendChild(btn);
  });
}

function populateParentSelect(selId, currentId, selectedParentId) {
  const sel = $(selId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— Root —</option>';
  S.nodes.forEach(n => {
    if (n.id===currentId) return;
    const opt = document.createElement('option');
    opt.value=n.id; opt.textContent=n.title;
    if (n.id===selectedParentId) opt.selected=true;
    sel.appendChild(opt);
  });
}

function populateDepsUI(node) {
  const list = $('dp-deps-list');
  if (!list) return;
  list.innerHTML='';
  (node.dependencies||[]).forEach(depId => {
    const dep = S.nodes.find(n=>n.id===depId);
    if (!dep) return;
    const item = el('div','dp-dep-item',`<span>${typeIcon(dep.type)} ${esc(dep.title)}</span><span class="dp-dep-remove" data-dep="${depId}">✕</span>`);
    item.querySelector('.dp-dep-remove').addEventListener('click', () => {
      node.dependencies = (node.dependencies||[]).filter(id=>id!==depId);
      populateDepsUI(node);
      renderCanvas();
    });
    list.appendChild(item);
  });
}

function populateAddDepSelect(node) {
  const sel = $('dp-add-dep');
  if (!sel) return;
  sel.innerHTML = '<option value="">+ Add dependency...</option>';
  S.nodes.forEach(n => {
    if (n.id===S.selectedNodeId || (node.dependencies||[]).includes(n.id)) return;
    const opt = document.createElement('option');
    opt.value=n.id; opt.textContent=n.title; sel.appendChild(opt);
  });
  sel.onchange = () => {
    if (!sel.value) return;
    const node = S.nodes.find(n=>n.id===S.selectedNodeId);
    if (!node) return;
    if (!node.dependencies) node.dependencies=[];
    if (!node.dependencies.includes(sel.value)) node.dependencies.push(sel.value);
    populateDepsUI(node); populateAddDepSelect(node);
    renderCanvas(); sel.value='';
  };
}

function renderDpAnalytics(node) {
  const box = $('dp-analytics');
  if (!box) return;
  const p = pct(node.currentValue, node.targetValue);
  const children = S.nodes.filter(n=>n.parentId===node.id);
  const childPct = children.length ? Math.round(children.reduce((a,c)=>a+pct(c.currentValue,c.targetValue),0)/children.length) : null;
  const daysLeft = node.dueDate ? Math.max(0,Math.ceil((new Date(node.dueDate)-Date.now())/(86400000))) : null;
  box.innerHTML=`
    <div class="dp-kpi"><div class="dp-kpi-val" style="color:${typeColor(node.type)}">${p}%</div><div class="dp-kpi-label">Progress</div></div>
    <div class="dp-kpi"><div class="dp-kpi-val">${children.length}</div><div class="dp-kpi-label">Sub-goals</div></div>
    ${childPct!==null ? `<div class="dp-kpi"><div class="dp-kpi-val">${childPct}%</div><div class="dp-kpi-label">Child avg</div></div>` : ''}
    ${daysLeft!==null ? `<div class="dp-kpi"><div class="dp-kpi-val" style="color:${daysLeft<7?'#ef4444':'inherit'}">${daysLeft}d</div><div class="dp-kpi-label">Days left</div></div>` : ''}
  `;
}

function renderDpActivity(nodeId) {
  const log = $('dp-activity');
  if (!log) return;
  const entries = (S.activityLog[nodeId]||[]).slice(-8).reverse();
  log.innerHTML = entries.length
    ? entries.map(e=>`<div class="dp-activity-item"><span class="dp-activity-time">${new Date(e.time).toLocaleDateString()}</span><span>${esc(e.msg)}</span></div>`).join('')
    : '<div class="dp-activity-item"><span style="color:var(--text-3)">No activity yet</span></div>';
}

function logActivity(nodeId, msg) {
  if (!S.activityLog[nodeId]) S.activityLog[nodeId]=[];
  S.activityLog[nodeId].push({ time:now(), msg });
  if (S.activityLog[nodeId].length>50) S.activityLog[nodeId].shift();
}

// auto-calc parent progress from children average
function autoCalcProgress(nodeId) {
  const children = S.nodes.filter(n=>n.parentId===nodeId);
  if (!children.length) return;
  const avgP = children.reduce((a,c)=>a+pct(c.currentValue,c.targetValue),0)/children.length;
  const node = S.nodes.find(n=>n.id===nodeId);
  if (node) {
    node.progress = Math.round(avgP);
  }
}

// ── Panel events ──
$('dp-current').addEventListener('input', updatePanelProgress);
$('dp-target').addEventListener('input', updatePanelProgress);
$('dp-close-btn').addEventListener('click', closePanel);
$('dp-focus-btn').addEventListener('click', () => { if(S.selectedNodeId) enterFocusMode(S.selectedNodeId); });

$('dp-save-btn').addEventListener('click', () => {
  const node = S.nodes.find(n=>n.id===S.selectedNodeId);
  if (!node) return;
  const activeType = $('dp-type-grid').querySelector('.dp-type-btn.active')?.textContent.split(' ')[1]?.toLowerCase();
  const type = Object.keys(NODE_TYPES).find(k=>NODE_TYPES[k].label===($('dp-type-grid').querySelector('.dp-type-btn.active')?.textContent.split(' ').slice(1).join(' '))) || node.type;
  const cur = parseFloat($('dp-current').value)||0;
  const tgt = parseFloat($('dp-target').value)||0;
  const p = pct(cur,tgt);
  const prevPct = node.progress;
  Object.assign(node, {
    title: $('dp-title').value.trim()||node.title,
    type, currentValue:cur, targetValue:tgt, progress:p,
    priority: $('dp-priority').value,
    status: $('dp-status').value,
    category: $('dp-category').value.trim(),
    dueDate: $('dp-due').value,
    notes: $('dp-notes').value.trim(),
    tags: $('dp-tags').value.trim(),
    parentId: $('dp-parent').value||null,
    updatedAt: now(),
  });
  logActivity(node.id, `Progress updated: ${prevPct}% → ${p}%`);
  if (p>=100 && !node.completed) { node.completed=true; node.status='completed'; celebrate(node.title); }
  scheduleSave();
  renderCanvas(); updateStreakDisplay();
  toast('Saved ✓', 'success');
});

$('dp-complete-btn').addEventListener('click', () => {
  const node = S.nodes.find(n=>n.id===S.selectedNodeId);
  if (!node) return;
  node.completed=!node.completed;
  node.status=node.completed?'completed':'active';
  node.updatedAt=now();
  logActivity(node.id, node.completed ? '✓ Marked complete' : 'Marked active');
  if (node.completed) celebrate(node.title);
  scheduleSave(); renderCanvas();
  $('dp-complete-btn').style.opacity=node.completed?.4:1;
});

$('dp-delete-btn').addEventListener('click', () => {
  const node = S.nodes.find(n=>n.id===S.selectedNodeId);
  if (!node||!confirm(`Delete "${node.title}" and all children?`)) return;
  const toDelete = [node.id, ...getAllDescendants(node.id)];
  S.nodes = S.nodes.filter(n=>!toDelete.includes(n.id));
  if (S.user && window.FIREBASE_READY && !window.DEMO_MODE) toDelete.forEach(id=>FirebaseService.fbDelete('nodes',id));
  closePanel(); scheduleSave(); renderCanvas();
  toast('Deleted', 'info');
});

function getAllDescendants(pid) {
  const ids=[];
  const collect = p => S.nodes.filter(n=>n.parentId===p).forEach(n=>{ ids.push(n.id); collect(n.id); });
  collect(pid); return ids;
}

// ════════════════════════════════════
// ADD NODE MODAL
// ════════════════════════════════════
let _modalSelectedType = 'goal';

function openAddNodeModal() {
  $('modal-title').value=''; $('modal-target').value=''; $('modal-category').value='';
  _modalSelectedType='goal';
  buildTypeGrid('modal-type-grid','goal', t=>{ _modalSelectedType=t; });
  populateParentSelect('modal-parent',null,null);
  openModal('add-node-modal');
  setTimeout(()=>$('modal-title').focus(),60);
}

$('add-node-btn').addEventListener('click', openAddNodeModal);
$('modal-cancel-btn').addEventListener('click', ()=>closeModal('add-node-modal'));
$('modal-cancel').addEventListener('click', ()=>closeModal('add-node-modal'));
$('add-node-modal').addEventListener('click', e=>{ if(e.target===$('add-node-modal')) closeModal('add-node-modal'); });

$('modal-create-btn').addEventListener('click', () => {
  const title = $('modal-title').value.trim();
  if (!title) { toast('Please enter a title','error'); $('modal-title').focus(); return; }
  const treeId = S.activeTreeId||S.trees[0]?.id;
  if (!treeId) { toast('Create a workspace first','error'); return; }
  const parentId = $('modal-parent').value||null;
  let x=900, y=400;
  if (parentId) {
    const par=S.nodes.find(n=>n.id===parentId);
    if(par){ const siblings=S.nodes.filter(n=>n.parentId===parentId); x=par.positionX+siblings.length*240; y=par.positionY+220; }
  } else {
    const ns=currentNodes(); x=200+ns.length*18; y=200+ns.length*14;
  }
  const node=mkNode({treeId,parentId,type:_modalSelectedType,title,tgt:parseFloat($('modal-target').value)||100,cat:$('modal-category').value.trim(),x,y});
  S.nodes.push(node);
  logActivity(node.id,'Node created');
  scheduleSave();
  closeModal('add-node-modal');
  renderCanvas();
  setTimeout(()=>selectNode(node.id),80);
  toast(`"${title}" created`,'success');
});

// ── Tree modal ──
$('tree-modal-create').addEventListener('click', () => {
  const name=$('tree-modal-name').value.trim();
  if(!name){toast('Enter workspace name','error');return;}
  const tree={id:uid(),name,uid:S.user?.uid||'demo',createdAt:now()};
  S.trees.push(tree); S.activeTreeId=tree.id;
  closeModal('add-tree-modal');
  scheduleSave(); renderAll(); setView('canvas');
  toast(`Workspace "${name}" created`,'success');
});
$('tree-modal-cancel').addEventListener('click',()=>closeModal('add-tree-modal'));
$('tree-modal-close').addEventListener('click',()=>closeModal('add-tree-modal'));
$('add-tree-modal').addEventListener('click',e=>{ if(e.target===$('add-tree-modal')) closeModal('add-tree-modal'); });

function openModal(id){ $(id).classList.remove('hidden'); }
function closeModal(id){ $(id).classList.add('hidden'); }

// ════════════════════════════════════
// COMMAND PALETTE
// ════════════════════════════════════
function openCmdPalette() {
  $('cmd-overlay').classList.remove('hidden');
  $('cmd-input').value=''; $('cmd-input').focus();
  buildCmdResults('');
}
function closeCmdPalette() { $('cmd-overlay').classList.add('hidden'); }

$('cmd-palette-trigger').addEventListener('click', openCmdPalette);
$('cmd-overlay').addEventListener('click', e=>{ if(e.target===$('cmd-overlay')) closeCmdPalette(); });
$('cmd-input').addEventListener('input', e=>buildCmdResults(e.target.value));
$('cmd-input').addEventListener('keydown', e=>{
  const items=[...$('cmd-results').querySelectorAll('.cmd-item')];
  if(e.key==='ArrowDown'){e.preventDefault(); S.cmdFocusIdx=Math.min(S.cmdFocusIdx+1,items.length-1); items.forEach((el,i)=>el.classList.toggle('focused',i===S.cmdFocusIdx));}
  if(e.key==='ArrowUp'){e.preventDefault(); S.cmdFocusIdx=Math.max(S.cmdFocusIdx-1,0); items.forEach((el,i)=>el.classList.toggle('focused',i===S.cmdFocusIdx));}
  if(e.key==='Enter'){const f=items[S.cmdFocusIdx]; if(f)f.click();}
});

function buildCmdResults(q='') {
  const qlo=q.toLowerCase();
  const container=$('cmd-results');
  container.innerHTML='';
  S.cmdFocusIdx=0;

  const commands=[
    {icon:'◈',title:'Roadmap View',sub:'Canvas',key:'canvas',kb:'1',action:()=>{setView('canvas');closeCmdPalette();}},
    {icon:'⟿',title:'Timeline View',sub:'',key:'timeline',action:()=>{setView('timeline');closeCmdPalette();}},
    {icon:'⊟',title:'Kanban Board',sub:'',key:'kanban',action:()=>{setView('kanban');closeCmdPalette();}},
    {icon:'◉',title:'Analytics',sub:'',key:'analytics',action:()=>{setView('analytics');closeCmdPalette();}},
    {icon:'⬡',title:'Dashboard',sub:'',key:'dashboard',action:()=>{setView('dashboard');closeCmdPalette();}},
    {icon:'🔥',title:'Habits Tracker',sub:'',key:'habits',action:()=>{setView('habits');closeCmdPalette();}},
    {icon:'💰',title:'Financial System',sub:'',key:'finance',action:()=>{setView('finance');closeCmdPalette();}},
    {icon:'📦',title:'Stock Asset Tracker',sub:'',key:'stock',action:()=>{setView('stock-tracker');closeCmdPalette();}},
    {icon:'▶',title:'YouTube Tracker',sub:'',key:'yt',action:()=>{setView('youtube-tracker');closeCmdPalette();}},
    {icon:'+',title:'New Node',sub:'',key:'newnode',kb:'N',action:()=>{closeCmdPalette();openAddNodeModal();}},
    {icon:'🔭',title:'Fit View',sub:'',key:'fit',kb:'0',action:()=>{fitView();closeCmdPalette();}},
    {icon:'◑',title:'Cycle Theme',sub:'',key:'theme',action:()=>{cycleTheme();closeCmdPalette();}},
    {icon:'↑',title:'Export Data',sub:'JSON',key:'export',action:()=>{exportData();closeCmdPalette();}},
  ];

  const matchCmds=qlo ? commands.filter(c=>c.title.toLowerCase().includes(qlo)||c.key.includes(qlo)) : commands;
  const matchNodes=qlo ? S.nodes.filter(n=>n.title.toLowerCase().includes(qlo)||(n.category||'').toLowerCase().includes(qlo)||(n.tags||'').toLowerCase().includes(qlo)).slice(0,6) : [];

  if(matchCmds.length){
    const lbl=el('div','cmd-section-label','Commands');
    container.appendChild(lbl);
    matchCmds.slice(0,8).forEach(cmd=>{
      const item=el('div','cmd-item');
      item.innerHTML=`<div class="cmd-item-icon">${cmd.icon}</div><div class="cmd-item-text"><div class="cmd-item-title">${cmd.title}</div>${cmd.sub?`<div class="cmd-item-sub">${cmd.sub}</div>`:''}</div>${cmd.kb?`<span class="cmd-item-kbd">${cmd.kb}</span>`:''}`;
      item.addEventListener('click',cmd.action);
      container.appendChild(item);
    });
  }
  if(matchNodes.length){
    container.appendChild(el('div','cmd-section-label','Nodes'));
    matchNodes.forEach(node=>{
      const item=el('div','cmd-item');
      const color=typeColor(node.type);
      item.innerHTML=`<div class="cmd-item-icon" style="background:${color}22;color:${color}">${typeIcon(node.type)}</div><div class="cmd-item-text"><div class="cmd-item-title">${esc(node.title)}</div><div class="cmd-item-sub">${node.type} · ${pct(node.currentValue,node.targetValue)}%</div></div>`;
      item.addEventListener('click',()=>{ setView('canvas'); S.activeTreeId=node.treeId; renderCanvas(); setTimeout(()=>{selectNode(node.id); centerOn(node);},80); closeCmdPalette(); });
      container.appendChild(item);
    });
  }
  if(!matchCmds.length&&!matchNodes.length) container.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-3);font-size:13px">No results for "'+esc(q)+'"</div>';
}

function centerOn(node) {
  const rect=$('canvas-container').getBoundingClientRect();
  S.canvas.x=rect.width/2-node.positionX*S.canvas.scale;
  S.canvas.y=rect.height/2-node.positionY*S.canvas.scale;
  applyTransform();
}

// ════════════════════════════════════
// FOCUS MODE
// ════════════════════════════════════
function enterFocusMode(nodeId) {
  const node=S.nodes.find(n=>n.id===nodeId);
  if(!node) return;
  $('focus-overlay').classList.remove('hidden');
  $('focus-title').textContent=node.title;
  const info=NODE_TYPES[node.type]||NODE_TYPES.goal;
  const color=typeColor(node.type);
  $('focus-type-badge').textContent=info.icon+' '+info.label;
  $('focus-type-badge').style.background=color+'22'; $('focus-type-badge').style.color=color;

  // Build breadcrumb
  const crumbs=[];
  let cur=node;
  while(cur){ crumbs.unshift(cur.title); const par=S.nodes.find(n=>n.id===cur.parentId); cur=par; }
  $('focus-breadcrumb').textContent=crumbs.join(' › ');

  const p=pct(node.currentValue,node.targetValue);
  const circ=$('focus-ring-arc');
  const r=52, circumference=2*Math.PI*r;
  circ.style.strokeDasharray=circumference;
  circ.style.stroke=color;
  setTimeout(()=>{ circ.style.strokeDashoffset=circumference*(1-p/100); },100);
  $('focus-ring-pct').textContent=p+'%';

  const kpis=$('focus-kpis');
  const daysLeft=node.dueDate?Math.max(0,Math.ceil((new Date(node.dueDate)-Date.now())/86400000)):null;
  kpis.innerHTML=`
    <div class="focus-kpi"><div class="focus-kpi-val">${fmtN(node.currentValue)}</div><div class="focus-kpi-label">Current</div></div>
    <div class="focus-kpi"><div class="focus-kpi-val">${fmtN(node.targetValue)}</div><div class="focus-kpi-label">Target</div></div>
    ${daysLeft!==null?`<div class="focus-kpi"><div class="focus-kpi-val" style="color:${daysLeft<7?'#ef4444':'inherit'}">${daysLeft}d</div><div class="focus-kpi-label">Days Left</div></div>`:''}
    <div class="focus-kpi"><div class="focus-kpi-val">${S.nodes.filter(n=>n.parentId===nodeId).length}</div><div class="focus-kpi-label">Sub-goals</div></div>
  `;

  const children=S.nodes.filter(n=>n.parentId===nodeId);
  const fc=$('focus-children');
  fc.innerHTML=children.length?children.map(c=>{
    const cp=pct(c.currentValue,c.targetValue); const cc=typeColor(c.type);
    return `<div class="focus-child-item" onclick="enterFocusMode('${c.id}')"><div class="focus-child-dot" style="background:${cc}"></div><span class="focus-child-name">${typeIcon(c.type)} ${esc(c.title)}</span><span class="focus-child-pct" style="color:${cc}">${cp}%</span></div>`;
  }).join(''):'<div style="color:var(--text-3);font-size:13px">No child nodes yet.</div>';

  $('focus-notes').textContent=node.notes||'No notes added yet. Click the node and add your strategy.';
}

$('focus-close-btn')?.addEventListener('click', ()=>$('focus-overlay').classList.add('hidden'));
$('focus-mode-btn').addEventListener('click', ()=>{ if(S.selectedNodeId) enterFocusMode(S.selectedNodeId); else toast('Select a node first','info'); });

// ════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════
function renderDashboard() {
  const dc=$('dashboard-content'); if(!dc)return;
  const nodes=S.nodes, total=nodes.length;
  const comp=nodes.filter(n=>n.completed).length;
  const active=nodes.filter(n=>!n.completed&&n.status==='active').length;
  const avgP=total?Math.round(nodes.reduce((a,n)=>a+pct(n.currentValue,n.targetValue),0)/total):0;
  const finNodes=nodes.filter(n=>n.type==='financial'||n.type==='income');
  const finP=finNodes.length?Math.round(finNodes.reduce((a,n)=>a+pct(n.currentValue,n.targetValue),0)/finNodes.length):0;

  dc.innerHTML=`
    <div class="stat-grid" id="dash-stats"></div>
    <div class="dash-grid" id="dash-grid"></div>
  `;

  const stats=[
    {label:'Total Goals',val:total,color:'#4f8cff'},
    {label:'Completed',val:comp,color:'#22c55e'},
    {label:'Active',val:active,color:'#f59e0b'},
    {label:'Avg Progress',val:avgP+'%',color:'#a855f7'},
    {label:'Financial',val:finP+'%',color:'#22c55e'},
    {label:'Workspaces',val:S.trees.length,color:'#ec4899'},
  ];
  const sg=$('dash-stats');
  stats.forEach(s=>{
    const c=el('div','stat-card');
    c.innerHTML=`<div class="stat-bar" style="background:${s.color}"></div><div class="stat-val">${s.val}</div><div class="stat-label">${s.label}</div>`;
    sg.appendChild(c);
  });

  const dg=$('dash-grid');
  // Progress bars card
  const topNodes=[...nodes].sort((a,b)=>pct(b.currentValue,b.targetValue)-pct(a.currentValue,a.targetValue)).slice(0,7);
  const pbCard=el('div','dash-card',`<div class="dash-card-title">Top Progress</div><div id="db-pb"></div>`);
  dg.appendChild(pbCard);
  const pbWrap=$('db-pb');
  topNodes.forEach(n=>{
    const p=pct(n.currentValue,n.targetValue), col=typeColor(n.type);
    const row=el('div','',`
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
        <span style="font-weight:500">${typeIcon(n.type)} ${esc(n.title)}</span>
        <span style="font-family:var(--font-m);color:${col}">${p}%</span>
      </div>
      <div style="height:5px;background:var(--glass-b);border-radius:99px;overflow:hidden;margin-bottom:10px">
        <div style="height:100%;width:${p}%;background:${col};border-radius:99px;box-shadow:0 0 6px ${col}88"></div>
      </div>`);
    pbWrap.appendChild(row);
  });

  // Activity heatmap
  const heatCard=el('div','dash-card',`<div class="dash-card-title">Activity Heatmap</div><div class="heatmap-grid" id="db-heat"></div><div style="font-size:10px;color:var(--text-3);margin-top:8px">Last 52 weeks</div>`);
  dg.appendChild(heatCard);
  const heat=$('db-heat');
  for(let i=0;i<52*7;i++){
    const cell=el('div','heatmap-cell');
    const r=Math.random(); if(r>.8)cell.classList.add('l4'); else if(r>.65)cell.classList.add('l3'); else if(r>.5)cell.classList.add('l2'); else if(r>.35)cell.classList.add('l1');
    heat.appendChild(cell);
  }

  // Achievements
  const achs=[
    {icon:'🎯',name:'First Goal',unlocked:total>=1},{icon:'🌳',name:'Strategist',unlocked:S.trees.length>=1},
    {icon:'✅',name:'Achiever',unlocked:comp>=1},{icon:'🚀',name:'Launcher',unlocked:total>=5},
    {icon:'💰',name:'Money Mind',unlocked:finNodes.length>=1},{icon:'🏆',name:'Champion',unlocked:comp>=3},
    {icon:'💯',name:'Centurion',unlocked:total>=10},{icon:'⭐',name:'Star',unlocked:avgP>=50},
    {icon:'🔥',name:'On Fire',unlocked:S.habits.some(h=>h.streak>=7)},{icon:'📦',name:'Stock Pro',unlocked:S.stock.uploads>=1000},
  ];
  const achCard=el('div','dash-card',`<div class="dash-card-title">Achievements</div><div style="display:flex;flex-wrap:wrap;gap:10px" id="db-ach"></div>`);
  dg.appendChild(achCard);
  const achWrap=$('db-ach');
  achs.forEach(a=>{
    const b=el('div',`achievement-badge${a.unlocked?' unlocked':''}`);
    b.innerHTML=`<div style="font-size:22px;opacity:${a.unlocked?1:.25}">${a.icon}</div><div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${a.unlocked?'#f59e0b':'var(--text-3)'};margin-top:5px">${a.name}</div>`;
    b.style.cssText='text-align:center;padding:10px 14px;background:var(--glass);border:1px solid var(--border);border-radius:var(--r-s);min-width:72px';
    if(a.unlocked) b.style.borderColor='rgba(245,158,11,.3)';
    achWrap.appendChild(b);
  });

  // Recent nodes
  const recentCard=el('div','dash-card',`<div class="dash-card-title">Recent Updates</div><div id="db-recent"></div>`);
  dg.appendChild(recentCard);
  const rw=$('db-recent');
  [...nodes].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,8).forEach(n=>{
    const p=pct(n.currentValue,n.targetValue), col=typeColor(n.type);
    const row=el('div','',`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer">
      <div style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0"></div>
      <span style="flex:1;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${typeIcon(n.type)} ${esc(n.title)}</span>
      <span style="font-family:var(--font-m);font-size:10px;color:${col}">${p}%</span>
    </div>`);
    row.querySelector('div').addEventListener('click',()=>{ setView('canvas'); S.activeTreeId=n.treeId; renderCanvas(); setTimeout(()=>{selectNode(n.id);centerOn(n);},80); });
    rw.appendChild(row);
  });
}

// ════════════════════════════════════
// TIMELINE VIEW
// ════════════════════════════════════
function renderTimeline() {
  const tc=$('timeline-content'); if(!tc)return;
  tc.innerHTML='';
  const sorted=[...S.nodes].filter(n=>n.dueDate||n.createdAt).sort((a,b)=>new Date(a.dueDate||a.createdAt)-new Date(b.dueDate||b.createdAt));
  if(!sorted.length){tc.innerHTML='<div style="color:var(--text-3);padding:20px">No nodes with dates yet.</div>';return;}
  sorted.forEach(n=>{
    const color=typeColor(n.type); const p=pct(n.currentValue,n.targetValue);
    const item=el('div','tl-item');
    item.innerHTML=`
      <div class="tl-dot" style="background:${color};box-shadow:0 0 8px ${color}88"></div>
      <div class="tl-card">
        <div class="tl-title">${typeIcon(n.type)} ${esc(n.title)}</div>
        <div class="tl-meta">
          <span>${n.type}</span>
          <span>${n.dueDate?'📅 '+n.dueDate:'Created '+new Date(n.createdAt).toLocaleDateString()}</span>
          <span class="tl-pct" style="color:${color}">${p}%</span>
        </div>
        <div style="height:3px;background:var(--glass-b);border-radius:99px;margin-top:8px;overflow:hidden">
          <div style="height:100%;width:${p}%;background:${color};border-radius:99px"></div>
        </div>
      </div>`;
    item.querySelector('.tl-card').addEventListener('click',()=>{ setView('canvas'); S.activeTreeId=n.treeId; renderCanvas(); setTimeout(()=>{selectNode(n.id);centerOn(n);},80); });
    tc.appendChild(item);
  });
}

// ════════════════════════════════════
// KANBAN VIEW
// ════════════════════════════════════
function renderKanban() {
  const board=$('kanban-board'); if(!board)return;
  board.innerHTML='';
  KANBAN_COLS.forEach(col=>{
    const nodes=S.nodes.filter(n=>n.status===col.id);
    const column=el('div','kb-col');
    column.innerHTML=`<div class="kb-col-header"><span style="color:${col.color}">${col.label}</span><span class="kb-col-count">${nodes.length}</span></div><div class="kb-cards" data-col="${col.id}"></div>`;
    const cardsWrap=column.querySelector('.kb-cards');
    nodes.forEach(n=>{
      const p=pct(n.currentValue,n.targetValue), color=typeColor(n.type);
      const card=el('div','kb-card');
      card.innerHTML=`
        <div style="height:2px;background:${color};border-radius:99px;margin-bottom:10px"></div>
        <div class="kb-card-title">${typeIcon(n.type)} ${esc(n.title)}</div>
        <div class="kb-card-bar"><div class="kb-card-fill" style="width:${p}%;background:${color}"></div></div>
        <div class="kb-card-meta"><span>${n.priority||'medium'}</span><span style="color:${color}">${p}%</span>${n.dueDate?`<span>📅 ${n.dueDate}</span>`:''}</div>`;
      card.addEventListener('click',()=>{ setView('canvas'); S.activeTreeId=n.treeId; renderCanvas(); setTimeout(()=>{selectNode(n.id);centerOn(n);},80); });
      cardsWrap.appendChild(card);
    });
    board.appendChild(column);
  });
}

// ════════════════════════════════════
// ANALYTICS VIEW
// ════════════════════════════════════
function renderAnalytics() {
  const ac=$('analytics-content'); if(!ac)return;
  const nodes=S.nodes;
  const typeCounts={};
  Object.keys(NODE_TYPES).forEach(k=>typeCounts[k]=nodes.filter(n=>n.type===k).length);
  const typeSorted=Object.entries(typeCounts).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);

  ac.innerHTML='';
  const row1=el('div','analytics-row');

  // Type distribution bar chart
  const barCard=el('div','analytics-card');
  barCard.innerHTML=`<div class="analytics-card-title">Node Types Distribution</div><div class="bar-chart" id="ac-bars"></div><div class="bar-chart-labels" id="ac-bar-labels"></div>`;
  row1.appendChild(barCard);
  setTimeout(()=>{
    const bars=$('ac-bars'), lbls=$('ac-bar-labels');
    if(!bars||!lbls) return;
    const max=Math.max(...typeSorted.map(([,v])=>v),1);
    typeSorted.slice(0,8).forEach(([type,count])=>{
      const h=Math.round(count/max*100);
      const bar=el('div','bar-chart-bar');
      bar.style.cssText=`height:${h}%;background:${typeColor(type)};box-shadow:0 0 8px ${typeColor(type)}66`;
      bar.dataset.label=`${count}`;
      bars.appendChild(bar);
      lbls.appendChild(el('div','bar-label',NODE_TYPES[type].label));
    });
  },50);

  // Priority breakdown donut (simplified)
  const pris={critical:0,high:0,medium:0,low:0};
  nodes.forEach(n=>{ if(pris[n.priority]!==undefined) pris[n.priority]++; });
  const priColors={critical:'#ef4444',high:'#f97316',medium:'#4f8cff',low:'#64748b'};
  const donutCard=el('div','analytics-card');
  donutCard.innerHTML=`<div class="analytics-card-title">Priority Breakdown</div>
    <div class="donut-wrap">
      <svg viewBox="0 0 100 100" width="100" height="100" style="transform:rotate(-90deg)">
        ${buildDonutPaths(pris,priColors)}
      </svg>
      <div class="donut-legend" id="donut-legend"></div>
    </div>`;
  row1.appendChild(donutCard);
  ac.appendChild(row1);

  setTimeout(()=>{
    const legend=$('donut-legend');
    if(!legend) return;
    Object.entries(pris).filter(([,v])=>v>0).forEach(([key,val])=>{
      legend.appendChild(el('div','donut-legend-item',`<div class="donut-legend-dot" style="background:${priColors[key]}"></div><span style="flex:1">${key}</span><span style="font-family:var(--font-m);font-size:11px">${val}</span>`));
    });
  },60);

  // Completion velocity card
  const row2=el('div','analytics-row');
  const velCard=el('div','analytics-card');
  const comp=nodes.filter(n=>n.completed).length;
  const rate=nodes.length>0?Math.round(comp/nodes.length*100):0;
  velCard.innerHTML=`<div class="analytics-card-title">Completion Metrics</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div class="stat-card"><div class="stat-val">${comp}</div><div class="stat-label">Completed</div></div>
      <div class="stat-card"><div class="stat-val">${rate}%</div><div class="stat-label">Success Rate</div></div>
      <div class="stat-card"><div class="stat-val">${nodes.filter(n=>n.status==='blocked').length}</div><div class="stat-label">Blocked</div></div>
    </div>`;
  row2.appendChild(velCard);

  // Progress distribution
  const progCard=el('div','analytics-card');
  const ranges=[{label:'0-25%',min:0,max:25},{label:'26-50%',min:26,max:50},{label:'51-75%',min:51,max:75},{label:'76-99%',min:76,max:99},{label:'100%',min:100,max:100}];
  const rangeCounts=ranges.map(r=>({...r,count:nodes.filter(n=>{const p=pct(n.currentValue,n.targetValue);return p>=r.min&&p<=r.max;}).length}));
  progCard.innerHTML=`<div class="analytics-card-title">Progress Distribution</div>
    <div style="display:flex;flex-direction:column;gap:8px">
    ${rangeCounts.map(r=>`<div style="display:flex;align-items:center;gap:10px;font-size:12px">
      <span style="width:50px;color:var(--text-2)">${r.label}</span>
      <div style="flex:1;height:8px;background:var(--glass-b);border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${nodes.length?r.count/nodes.length*100:0}%;background:var(--accent);border-radius:99px"></div>
      </div>
      <span style="width:20px;font-family:var(--font-m);color:var(--text-3)">${r.count}</span>
    </div>`).join('')}
    </div>`;
  row2.appendChild(progCard);
  ac.appendChild(row2);
}

function buildDonutPaths(data, colors) {
  const total=Object.values(data).reduce((a,v)=>a+v,0);
  if(!total) return '';
  let offset=0;
  const cx=50,cy=50,r=40,stroke=14;
  const circ=2*Math.PI*r;
  return Object.entries(data).filter(([,v])=>v>0).map(([key,val])=>{
    const dash=circ*val/total, gap=circ-dash;
    const path=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[key]}" stroke-width="${stroke}" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}" opacity=".9"/>`;
    offset+=dash; return path;
  }).join('');
}

// ════════════════════════════════════
// HABITS TRACKER
// ════════════════════════════════════
function renderHabits() {
  const hc=$('habits-content'); if(!hc)return;
  hc.innerHTML='';
  const today=new Date().toDateString();

  S.habits.forEach(habit=>{
    const card=el('div','habit-card');
    const todayDone=(habit.history||[]).includes(today);
    card.innerHTML=`
      <div class="habit-emoji">${habit.emoji}</div>
      <div class="habit-info">
        <div class="habit-title">${esc(habit.title)}</div>
        <div class="habit-meta">Target: daily · ${todayDone?'✅ Done today':'⏳ Pending'}</div>
        <div class="habit-checkboxes">${[...Array(7)].map((_,i)=>{
          const d=new Date(); d.setDate(d.getDate()-6+i);
          const done=(habit.history||[]).includes(d.toDateString());
          return `<div class="habit-day${done?' done':''}" data-habit="${habit.id}" data-date="${d.toDateString()}">${done?'✓':''}</div>`;
        }).join('')}</div>
      </div>
      <div class="habit-streak">${habit.streak||0}<div style="font-size:12px;font-weight:400;color:var(--text-2)">streak</div></div>`;
    card.querySelectorAll('.habit-day').forEach(dayEl=>{
      dayEl.addEventListener('click',()=>{
        const h=S.habits.find(h=>h.id===dayEl.dataset.habit);
        if(!h) return;
        const dateStr=dayEl.dataset.date;
        if(!h.history)h.history=[];
        const idx=h.history.indexOf(dateStr);
        if(idx===-1){h.history.push(dateStr); if(dateStr===today)h.streak=(h.streak||0)+1;}
        else{h.history.splice(idx,1); if(dateStr===today)h.streak=Math.max(0,(h.streak||0)-1);}
        scheduleSave(); renderHabits(); updateStreakDisplay();
      });
    });
    hc.appendChild(card);
  });

  // Add habit button
  const addBtn=el('div','habit-add-btn','<span style="font-size:20px">+</span> Track New Habit');
  addBtn.addEventListener('click',()=>{
    const title=prompt('Habit name (with emoji, e.g. "📦 Daily Upload"):');
    if(!title) return;
    const parts=title.trim().split(' ');
    const emoji=parts[0]; const name=parts.slice(1).join(' ')||parts[0];
    S.habits.push({id:uid(),title:name.trim()||title,emoji,target:1,streak:0,history:[]});
    scheduleSave(); renderHabits();
  });
  hc.appendChild(addBtn);
}

function updateStreakDisplay() {
  const maxStreak=Math.max(0,...S.habits.map(h=>h.streak||0));
  const el=$('user-streak');
  if(el) el.textContent=`🔥 ${maxStreak} day${maxStreak===1?'':'s'}`;
}

// ════════════════════════════════════
// FINANCE VIEW
// ════════════════════════════════════
function renderFinance() {
  const fc=$('finance-content'); if(!fc)return;
  const f=S.finance;
  const netWorth=f.income+f.savings+f.investments-f.debts;
  fc.innerHTML=`
    <div class="finance-card">
      <div class="finance-card-title">Net Worth <span style="font-size:11px;font-weight:400;color:var(--text-3)">Total</span></div>
      <div class="finance-big" style="color:${netWorth>=0?'var(--success)':'var(--danger)'}">₹${fmtN(netWorth)}</div>
      <div class="finance-delta ${netWorth>=0?'pos':'neg'}">${netWorth>=0?'+':''}${fmtN(netWorth)}</div>
    </div>
    <div class="finance-card">
      <div class="finance-card-title">Income</div>
      <div class="finance-item"><span class="finance-item-label">Total Earnings</span><span class="finance-item-val" style="color:var(--success)">₹${fmtN(f.income)}</span></div>
      <div class="finance-item"><span class="finance-item-label">Savings</span><span class="finance-item-val">₹${fmtN(f.savings)}</span></div>
      <div class="finance-item"><span class="finance-item-label">Investments</span><span class="finance-item-val">₹${fmtN(f.investments)}</span></div>
      <div class="finance-input-row">
        <input type="number" id="fin-income-input" placeholder="Update income..." />
        <button class="finance-input-row button" onclick="updateFinance('income')">Save</button>
      </div>
    </div>
    <div class="finance-card">
      <div class="finance-card-title">Liabilities</div>
      <div class="finance-item"><span class="finance-item-label">Total Debt</span><span class="finance-item-val" style="color:var(--danger)">₹${fmtN(f.debts)}</span></div>
      <div class="finance-item"><span class="finance-item-label">Active Loans</span><span class="finance-item-val">${f.loans}</span></div>
      <div class="finance-input-row">
        <input type="number" id="fin-debt-input" placeholder="Update debt..." />
        <button onclick="updateFinance('debt')">Save</button>
      </div>
    </div>
    <div class="finance-card">
      <div class="finance-card-title">Goals Progress</div>
      ${S.nodes.filter(n=>n.type==='financial'||n.type==='income'||n.type==='debt').map(n=>{
        const p=pct(n.currentValue,n.targetValue),col=typeColor(n.type);
        return `<div class="finance-item" style="flex-direction:column;align-items:stretch;gap:6px">
          <div style="display:flex;justify-content:space-between"><span class="finance-item-label">${typeIcon(n.type)} ${esc(n.title)}</span><span style="font-family:var(--font-m);font-size:11px;color:${col}">${p}%</span></div>
          <div style="height:4px;background:var(--glass-b);border-radius:99px;overflow:hidden"><div style="height:100%;width:${p}%;background:${col};border-radius:99px"></div></div>
        </div>`;
      }).join('')||'<div style="color:var(--text-3);font-size:13px">Add financial nodes to see progress.</div>'}
    </div>`;
}

window.updateFinance = function(field) {
  const input = $(field==='income'?'fin-income-input':'fin-debt-input');
  const val = parseFloat(input?.value)||0;
  if(field==='income') S.finance.income=val;
  if(field==='debt') S.finance.debts=val;
  scheduleSave(); renderFinance();
  toast('Finance updated','success');
};

// ════════════════════════════════════
// STOCK TRACKER
// ════════════════════════════════════
function renderStockTracker() {
  const sc=$('stock-content'); if(!sc)return;
  const s=S.stock;
  const approvalRate=s.uploads>0?Math.round(s.approved/s.uploads*100):0;
  sc.innerHTML=`
    <div class="tracker-hero">
      <div class="tracker-stat"><div class="tracker-stat-val" style="color:var(--accent)">${fmtN(s.uploads)}</div><div class="tracker-stat-label">Total Uploads</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" style="color:var(--success)">${fmtN(s.approved)}</div><div class="tracker-stat-label">Approved</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" style="color:var(--danger)">${fmtN(s.rejected)}</div><div class="tracker-stat-label">Rejected</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" style="color:#22c55e">₹${fmtN(s.earnings)}</div><div class="tracker-stat-label">Earnings</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val">${approvalRate}%</div><div class="tracker-stat-label">Approval Rate</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" style="color:var(--warning)">🔥 ${s.dailyStreak}</div><div class="tracker-stat-label">Day Streak</div></div>
    </div>
    <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-l);padding:18px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-2);margin-bottom:10px">Goal Progress</div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
        <span style="font-size:13px">${fmtN(s.uploads)} / ${fmtN(s.goal)} uploads</span>
        <span style="font-family:var(--font-m);font-size:12px;color:var(--accent)">${pct(s.uploads,s.goal)}%</span>
      </div>
      <div style="height:8px;background:var(--glass-b);border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${pct(s.uploads,s.goal)}%;background:var(--accent);border-radius:99px;box-shadow:0 0 8px var(--accent-g)"></div>
      </div>
    </div>
    <div class="tracker-input-card">
      <h3>Update Today's Numbers</h3>
      <div class="tracker-fields">
        <div class="tracker-field"><label>Uploads Today</label><input type="number" id="stock-upload-input" placeholder="0" /></div>
        <div class="tracker-field"><label>Approved</label><input type="number" id="stock-approved-input" placeholder="0" /></div>
        <div class="tracker-field"><label>Earnings (₹)</label><input type="number" id="stock-earn-input" placeholder="0" /></div>
        <div class="tracker-field"><label>Goal Total</label><input type="number" id="stock-goal-input" placeholder="${s.goal}" /></div>
      </div>
      <button class="tracker-save-btn" onclick="saveStock()">Update Stock Stats</button>
    </div>`;
}

window.saveStock = function() {
  const add=v=>parseFloat($(v)?.value)||0;
  S.stock.uploads += add('stock-upload-input');
  S.stock.approved += add('stock-approved-input');
  S.stock.rejected = S.stock.uploads - S.stock.approved;
  S.stock.earnings += add('stock-earn-input');
  if($('stock-goal-input').value) S.stock.goal=parseFloat($('stock-goal-input').value)||S.stock.goal;
  if(add('stock-upload-input')>0) S.stock.dailyStreak=(S.stock.dailyStreak||0)+1;
  scheduleSave(); renderStockTracker();
  toast('Stock stats updated','success');
};

// ════════════════════════════════════
// YOUTUBE TRACKER
// ════════════════════════════════════
function renderYouTube() {
  const yc=$('youtube-content'); if(!yc)return;
  const y=S.youtube;
  yc.innerHTML=`
    <div class="tracker-hero">
      <div class="tracker-stat"><div class="tracker-stat-val" style="color:#ef4444">${fmtN(y.subscribers)}</div><div class="tracker-stat-label">Subscribers</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val">${fmtN(y.watchHours)}</div><div class="tracker-stat-label">Watch Hours</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" style="color:var(--accent)">${y.uploads}</div><div class="tracker-stat-label">Videos</div></div>
      <div class="tracker-stat"><div class="tracker-stat-val" style="color:var(--success)">₹${fmtN(y.rpm)}</div><div class="tracker-stat-label">RPM</div></div>
    </div>
    <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--r-l);padding:18px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text-2);margin-bottom:10px">Subscriber Goal</div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
        <span>${fmtN(y.subscribers)} / ${fmtN(y.goal)} subscribers</span>
        <span style="font-family:var(--font-m);color:#ef4444">${pct(y.subscribers,y.goal)}%</span>
      </div>
      <div style="height:8px;background:var(--glass-b);border-radius:99px;overflow:hidden">
        <div style="height:100%;width:${pct(y.subscribers,y.goal)}%;background:#ef4444;border-radius:99px;box-shadow:0 0 8px rgba(239,68,68,.5)"></div>
      </div>
    </div>
    <div class="tracker-input-card">
      <h3>Update Channel Stats</h3>
      <div class="tracker-fields">
        <div class="tracker-field"><label>Subscribers</label><input type="number" id="yt-sub-input" placeholder="${y.subscribers}" /></div>
        <div class="tracker-field"><label>Watch Hours</label><input type="number" id="yt-wh-input" placeholder="${y.watchHours}" /></div>
        <div class="tracker-field"><label>Uploads</label><input type="number" id="yt-up-input" placeholder="${y.uploads}" /></div>
        <div class="tracker-field"><label>RPM (₹)</label><input type="number" id="yt-rpm-input" placeholder="${y.rpm}" /></div>
      </div>
      <button class="tracker-save-btn" onclick="saveYouTube()">Update YouTube Stats</button>
    </div>`;
}

window.saveYouTube = function() {
  const v=id=>parseFloat($(id)?.value)||undefined;
  if(v('yt-sub-input')) S.youtube.subscribers=v('yt-sub-input');
  if(v('yt-wh-input')) S.youtube.watchHours=v('yt-wh-input');
  if(v('yt-up-input')) S.youtube.uploads=v('yt-up-input');
  if(v('yt-rpm-input')) S.youtube.rpm=v('yt-rpm-input');
  scheduleSave(); renderYouTube();
  toast('YouTube stats updated','success');
};

// ════════════════════════════════════
// COMPLETED VIEW
// ════════════════════════════════════
function renderCompleted() {
  const cg=$('completed-grid'); if(!cg)return;
  cg.innerHTML='';
  const comp=S.nodes.filter(n=>n.completed);
  if(!comp.length){cg.innerHTML='<div style="color:var(--text-3);font-size:14px;grid-column:1/-1">No completed goals yet. Keep going! 🚀</div>';return;}
  comp.forEach(n=>{
    const p=pct(n.currentValue,n.targetValue), col=typeColor(n.type);
    const card=el('div','ng-card');
    card.innerHTML=`<div class="ng-stripe" style="background:${col}"></div><div class="ng-title">${typeIcon(n.type)} ${esc(n.title)}</div><div class="ng-meta">${n.type} · ${n.category||'General'}</div><div class="ng-bar"><div class="ng-fill" style="width:${p}%;background:${col}"></div></div>`;
    card.addEventListener('click',()=>{ setView('canvas'); S.activeTreeId=n.treeId; renderCanvas(); setTimeout(()=>selectNode(n.id),80); });
    cg.appendChild(card);
  });
}

// ════════════════════════════════════
// SETTINGS VIEW
// ════════════════════════════════════
function renderSettings() {
  const sc=$('settings-content'); if(!sc)return;
  const swatches=[{name:'midnight',bg:'#060810'},{name:'space',bg:'#03050d'},{name:'arctic',bg:'#f0f4f8'},{name:'cyber',bg:'#020306'},{name:'aurora',bg:'#0a0616'},{name:'neon',bg:'#000308'}];
  sc.innerHTML=`
    <div class="settings-card">
      <h3>Account</h3>
      <div style="color:var(--text-2);font-size:13px;margin-bottom:16px">${S.user?`Signed in as ${S.user.email}`:'Demo Mode — local storage only'}</div>
      <button class="settings-btn danger" id="settings-logout">Sign Out</button>
    </div>
    <div class="settings-card">
      <h3>Themes</h3>
      <div class="theme-picker" id="theme-picker">
        ${swatches.map(t=>`<div class="theme-swatch${S.settings.theme===t.name?' active':''}" data-theme="${t.name}" style="background:${t.bg};border:2px solid ${S.settings.theme===t.name?'white':'transparent'}" title="${t.name}"></div>`).join('')}
      </div>
      <div style="color:var(--text-3);font-size:12px;margin-top:10px">Current: ${S.settings.theme} · Press ◑ in toolbar to cycle</div>
    </div>
    <div class="settings-card">
      <h3>Data Management</h3>
      <button class="settings-btn" onclick="exportData()">↑ Export JSON Backup</button>
      <button class="settings-btn" onclick="document.getElementById('import-file').click()">↓ Import JSON</button>
      <button class="settings-btn danger" onclick="clearAllData()">Clear All Data</button>
    </div>
    <div class="settings-card">
      <h3>Keyboard Shortcuts</h3>
      <div class="shortcut-list">
        <div class="shortcut-row"><kbd>Ctrl+K</kbd><span>Command Palette</span></div>
        <div class="shortcut-row"><kbd>N</kbd><span>New Node</span></div>
        <div class="shortcut-row"><kbd>F</kbd><span>Focus Mode</span></div>
        <div class="shortcut-row"><kbd>Space</kbd><span>Fit View</span></div>
        <div class="shortcut-row"><kbd>Esc</kbd><span>Close Panel</span></div>
        <div class="shortcut-row"><kbd>Del</kbd><span>Delete Node</span></div>
        <div class="shortcut-row"><kbd>/</kbd><span>Quick Search</span></div>
        <div class="shortcut-row"><kbd>1-5</kbd><span>Switch Views</span></div>
      </div>
    </div>`;

  document.querySelectorAll('.theme-swatch').forEach(sw=>{
    sw.addEventListener('click',()=>{ applyTheme(sw.dataset.theme); renderSettings(); });
  });
  $('settings-logout')?.addEventListener('click',async()=>{
    await FirebaseService.signOut(); location.reload();
  });
}

// ════════════════════════════════════
// THEME
// ════════════════════════════════════
function applyTheme(theme) {
  document.documentElement.dataset.theme=theme;
  S.settings.theme=theme;
  S.themeIdx=THEMES.indexOf(theme);
  scheduleSave();
}
function cycleTheme() {
  S.themeIdx=(S.themeIdx+1)%THEMES.length;
  applyTheme(THEMES[S.themeIdx]);
  toast(`Theme: ${THEMES[S.themeIdx]}`,'info',1500);
}
$('theme-cycle-btn').addEventListener('click',cycleTheme);

// ════════════════════════════════════
// EXPORT / IMPORT
// ════════════════════════════════════
function exportData() {
  const data={trees:S.trees,nodes:S.nodes,habits:S.habits,finance:S.finance,stock:S.stock,youtube:S.youtube,exportedAt:now(),version:2};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`lifeos-backup-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
  toast('Exported ✓','success');
}
window.exportData=exportData;

$('export-btn').addEventListener('click',exportData);
$('import-btn').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',e=>{
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try {
      const data=JSON.parse(ev.target.result);
      if(!data.trees||!data.nodes) throw new Error('Invalid format');
      if(!confirm(`Import ${data.trees.length} trees and ${data.nodes.length} nodes?`)) return;
      const existT=new Set(S.trees.map(t=>t.id));
      const existN=new Set(S.nodes.map(n=>n.id));
      data.trees.forEach(t=>{if(!existT.has(t.id))S.trees.push(t);});
      data.nodes.forEach(n=>{if(!existN.has(n.id))S.nodes.push(n);});
      if(data.habits) S.habits=[...S.habits,...(data.habits||[])];
      if(data.finance) S.finance={...S.finance,...data.finance};
      if(data.stock) S.stock={...S.stock,...data.stock};
      if(data.youtube) S.youtube={...S.youtube,...data.youtube};
      scheduleSave(); renderAll();
      toast(`Imported ${data.nodes.length} nodes`,'success');
    } catch(e){toast('Import failed: '+e.message,'error');}
    $('import-file').value='';
  };
  reader.readAsText(file);
});

async function clearAllData() {
  if(!confirm('Clear ALL data permanently? This cannot be undone.')) return;
  S.trees=[]; S.nodes=[]; S.habits=[];
  S.finance={income:0,savings:0,investments:0,debts:0,loans:0,history:[]};
  S.stock={uploads:0,approved:0,rejected:0,earnings:0,goal:10000,dailyStreak:0,history:[]};
  S.youtube={subscribers:0,watchHours:0,uploads:0,rpm:0,goal:100000,history:[]};
  S.activityLog={}; S.onboardingDone=false;
  if (S.user && window.FIREBASE_READY && !window.DEMO_MODE) {
    try { await FirebaseService.fbClearUserData(S.user.uid); } catch(e) { console.warn('Clear error', e); }
  }
  scheduleSave(); renderAll();
  toast('All data cleared','info');
}
window.clearAllData=clearAllData;

// ════════════════════════════════════
// CELEBRATION
// ════════════════════════════════════
function celebrate(title) {
  $('cel-title').textContent=`"${title}" — Achieved! 🎉`;
  $('cel-sub').textContent='Outstanding progress. You\'re building something extraordinary.';
  $('celebration-overlay').classList.remove('hidden');
  // confetti
  const confetti=$('cel-confetti');
  confetti.innerHTML='';
  const colors=['#4f8cff','#22c55e','#f59e0b','#a855f7','#ec4899','#06b6d4'];
  for(let i=0;i<60;i++){
    const p=el('div','confetti-piece');
    p.style.cssText=`left:${Math.random()*100}%;top:0;background:${colors[i%colors.length]};animation-delay:${Math.random()*.8}s;animation-duration:${2+Math.random()*2}s;border-radius:${Math.random()>.5?'50%':'2px'}`;
    confetti.appendChild(p);
  }
  setTimeout(()=>$('celebration-overlay').classList.add('hidden'),4000);
}
$('celebration-overlay').addEventListener('click',()=>$('celebration-overlay').classList.add('hidden'));

// ════════════════════════════════════
// KEYBOARD SHORTCUTS
// ════════════════════════════════════
document.addEventListener('keydown', e => {
  const tag=document.activeElement?.tagName?.toLowerCase();
  const typing=['input','textarea','select'].includes(tag);
  if(e.key==='Escape'){
    if(!$('cmd-overlay').classList.contains('hidden')){closeCmdPalette();return;}
    if(!$('focus-overlay').classList.contains('hidden')){$('focus-overlay').classList.add('hidden');return;}
    if(!$('add-node-modal').classList.contains('hidden')){closeModal('add-node-modal');return;}
    if(!$('add-tree-modal').classList.contains('hidden')){closeModal('add-tree-modal');return;}
    closePanel(); return;
  }
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){ e.preventDefault(); openCmdPalette(); return; }
  if(!typing){
    if(e.key==='n'||e.key==='N'){ e.preventDefault(); openAddNodeModal(); }
    if(e.key==='f'||e.key==='F'){ e.preventDefault(); if(S.selectedNodeId) enterFocusMode(S.selectedNodeId); }
    if(e.key===' '){ e.preventDefault(); fitView(); }
    if(e.key==='/'){ e.preventDefault(); openCmdPalette(); }
    if(e.key==='+'||e.key==='='){ $('zoom-in-btn').click(); }
    if(e.key==='-'){ $('zoom-out-btn').click(); }
    if(e.key==='1') setView('canvas');
    if(e.key==='2') setView('timeline');
    if(e.key==='3') setView('kanban');
    if(e.key==='4') setView('analytics');
    if(e.key==='5') setView('dashboard');
    if((e.key==='Delete'||e.key==='Backspace')&&S.selectedNodeId){ $('dp-delete-btn').click(); }
  }
});

// ════════════════════════════════════
// BOOT
// ════════════════════════════════════
(function boot() {
  applyTheme('midnight');
  initAuth();
  setSaveDot('saved');
})();
