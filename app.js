const state = {
  games: [],
  filtered: [],
  selectedCategories: new Set(),
  visibleCount: 30,
  search: '',
  playerSearch: '',
  isPlayerOpen: false,
  selectedGame: null,
  openTabs: [],
  showCategories: false,
  showMenu: false,
  menuView: 'main',
  showSocial: false,
  showUpdate: false,
  settings: JSON.parse(localStorage.getItem('coral_settings') || '{"autoFullscreen":false,"enableTabs":true}'),
  refreshKeys: {},
  context: {open:false,x:0,y:0},
};

const app = document.getElementById('app');

const esc = (s='') => s.replace(/[&<>"]/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
const saveSettings = ()=>localStorage.setItem('coral_settings', JSON.stringify(state.settings));
const recent = ()=>JSON.parse(localStorage.getItem('coral_recent')||'[]');
const setRecent = (title)=> localStorage.setItem('coral_recent', JSON.stringify([title, ...recent().filter(t=>t!==title)].slice(0,8)));

function getSimilar(game) {
  if (!game) return [];
  const cats = new Set(game.Categories || []);
  return state.games
    .filter((g)=>g.Title!==game.Title)
    .map((g)=>({g,score:(g.Categories||[]).filter(c=>cats.has(c)).length}))
    .filter((x)=>x.score>=1)
    .sort((a,b)=>b.score-a.score)
    .slice(0,20)
    .map((x)=>x.g);
}

function filterGames() {
  const q = state.search.toLowerCase();
  const cats = [...state.selectedCategories];
  state.filtered = state.games.filter((g)=> {
    const a = g.Title.toLowerCase().includes(q);
    const b = cats.length===0 || cats.every((c)=>g.Categories.includes(c));
    return a && b;
  });
}

function openGame(game) {
  if (!game) return;
  state.selectedGame = game;
  state.isPlayerOpen = true;
  setRecent(game.Title);
  if (state.settings.enableTabs) {
    if (!state.openTabs.find((g)=>g.Title===game.Title)) state.openTabs.push(game);
  } else {
    state.openTabs = [game];
  }
  try {
    const origin = new URL(game.IFrame).origin;
    const ln = document.createElement('link');
    ln.rel = 'preconnect';
    ln.href = origin;
    document.head.appendChild(ln);
  } catch {}
  render();
  if (state.settings.autoFullscreen) {
    const p = document.getElementById('player');
    p?.requestFullscreen?.().catch(()=>{});
  }
}

function closeGame() {
  state.isPlayerOpen = false;
  render();
}

function refreshGame() {
  if (!state.selectedGame) return;
  const t = state.selectedGame.Title;
  state.refreshKeys[t] = (state.refreshKeys[t] || 0) + 1;
  render();
}

function render() {
  filterGames();
  const cats = [...new Set(state.games.flatMap((g)=>g.Categories||[]))].sort();
  const featured = state.games.slice(0, 6);
  const visible = state.filtered.slice(0, state.visibleCount);
  const sim = (state.playerSearch
    ? state.games.filter(g=>g.Title.toLowerCase().includes(state.playerSearch.toLowerCase())).slice(0,25)
    : getSimilar(state.selectedGame));

  app.innerHTML = `
    <div class="app" id="root-wrap">
      <header class="top">
        <div class="top-row">
          <div class="brand"><h1>Coral</h1><p>Scientific Calculator</p></div>
          <div class="actions">
            <input class="search" id="search" placeholder="Search games..." value="${esc(state.search)}" />
            <button class="icon-btn ${state.selectedCategories.size ? 'active':''}" id="cat-btn">🧩 ${state.selectedCategories.size||''}</button>
            <button class="icon-btn" id="menu-btn">☰</button>
          </div>
        </div>
        ${state.settings.enableTabs && state.openTabs.length ? `<div class="tab-ribbon">${state.openTabs.map(g=>`
          <div class="tab ${state.selectedGame?.Title===g.Title?'active':''}">
            <button data-tab="${esc(g.Title)}">${esc(g.Title)}</button>
            <button data-close-tab="${esc(g.Title)}">✕</button>
          </div>`).join('')}</div>`:''}
        <div class="filter-panel ${state.showCategories?'open':''}" id="cat-panel">
          <div class="chips">
            ${cats.map(c=>`<button class="chip ${state.selectedCategories.has(c)?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
          </div>
          <div style="margin-top:8px"><button class="chip" id="apply-cats">Filter</button><button class="chip" id="clear-cats">Clear</button></div>
        </div>
      </header>

      <main class="${state.isPlayerOpen?'hidden':''}">
        <section class="section">
          <h2>Featured</h2>
          <div class="grid">${featured.map(card).join('')}</div>
        </section>
        <section class="section">
          <h2>Library (${state.filtered.length})</h2>
          <div class="grid">${visible.map(card).join('')}</div>
          <div class="sentinel" id="sentinel">${state.visibleCount < state.filtered.length ? 'Loading more…' : ''}</div>
        </section>
      </main>

      <section id="player" class="player ${state.isPlayerOpen?'open':''}">
        <div class="player-header">
          <div><button class="icon-btn" id="back-btn">←</button> <strong>${esc(state.selectedGame?.Title||'')}</strong></div>
          <div>
            <button class="icon-btn" id="random-btn">🎲</button>
            <button class="icon-btn" id="refresh-btn">⟳</button>
            <button class="icon-btn" id="full-btn">⛶</button>
          </div>
        </div>
        <div class="player-layout">
          <aside class="left">
            <input id="player-search" placeholder="Search any game..." value="${esc(state.playerSearch)}" />
            <div class="similar-list">
              ${sim.map(g=>`<button data-open="${esc(g.Title)}">${esc(g.Title)}</button>`).join('') || '<p style="color:var(--fg-muted)">No similar games</p>'}
            </div>
          </aside>
          <div class="right">
            <div class="frame-wrap" id="frame-wrap">
              ${(state.openTabs.length?state.openTabs:[state.selectedGame]).filter(Boolean).map(g=>`
                <iframe
                  key="${esc(g.Title)}-${state.refreshKeys[g.Title]||0}"
                  src="${esc(g.IFrame)}"
                  title="${esc(g.Title)}"
                  loading="${state.selectedGame?.Title===g.Title?'eager':'lazy'}"
                  sandbox="allow-forms allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-scripts allow-same-origin"
                  allow="autoplay; fullscreen; keyboard; pointer-lock; gamepad"
                  style="${state.selectedGame?.Title===g.Title?'':'display:none'}"
                  referrerpolicy="no-referrer"
                ></iframe>`).join('')}
            </div>
            <div class="wip">WIP</div>
          </div>
        </div>
      </section>
    </div>

    <div class="drawer-bg ${state.showMenu?'open':''}" id="drawer-bg"></div>
    <aside class="drawer ${state.showMenu?'open':''}">
      <h3>Menu</h3>
      ${state.menuView==='main' ? `
        <button class="menu-item" id="settings-open">Settings →</button>
        <button class="menu-item" id="updates-open">Update Log →</button>
        <button class="menu-item" id="social-open">Social <span class="badge">WIP</span> →</button>
      ` : `
        <button class="menu-item" id="menu-back">← Back</button>
        <div class="settings-row"><span>Auto Fullscreen</span><button class="icon-btn" id="toggle-full">${state.settings.autoFullscreen?'ON':'OFF'}</button></div>
        <div class="settings-row"><span>Enable Tabs</span><button class="icon-btn" id="toggle-tabs">${state.settings.enableTabs?'ON':'OFF'}</button></div>
      `}
    </aside>

    <div class="modal-bg ${state.showUpdate||state.showSocial?'open':''}" id="modal-bg"></div>
    <section class="modal ${state.showUpdate?'open':''}">
      <h3>Update Log</h3><p>WIP</p><button class="icon-btn" id="close-update">Close</button>
    </section>
    <section class="modal ${state.showSocial?'open':''}">
      <h3>Social <span class="badge">WIP</span></h3><p>WIP</p><button class="icon-btn" id="close-social">Close</button>
    </section>

    <div class="context ${state.context.open?'open':''}" id="ctx" style="left:${state.context.x}px;top:${state.context.y}px">
      <button id="ctx-refresh">Refresh game</button>
      <button id="ctx-random">Random game</button>
      <button id="ctx-close">Close player</button>
    </div>
  `;

  bindEvents();
  setupInfiniteLoad();
}

function card(g) {
  return `<article class="card" data-open="${esc(g.Title)}"><img loading="lazy" src="${esc(g.Icon)}" alt="${esc(g.Title)}"><div class="title">${esc(g.Title)}</div></article>`;
}

function bindEvents() {
  document.getElementById('search')?.addEventListener('input', (e)=>{ state.search=e.target.value; state.visibleCount=30; render(); });
  document.getElementById('cat-btn')?.addEventListener('click', ()=>{ state.showCategories=!state.showCategories; render(); });
  document.getElementById('apply-cats')?.addEventListener('click', ()=>{ state.showCategories=false; render(); });
  document.getElementById('clear-cats')?.addEventListener('click', ()=>{ state.selectedCategories.clear(); render(); });
  document.querySelectorAll('[data-cat]').forEach((el)=>el.addEventListener('click', ()=>{
    const c=el.getAttribute('data-cat'); if (state.selectedCategories.has(c)) state.selectedCategories.delete(c); else state.selectedCategories.add(c); render();
  }));

  document.getElementById('menu-btn')?.addEventListener('click', ()=>{ state.showMenu=true; render(); });
  document.getElementById('drawer-bg')?.addEventListener('click', ()=>{ state.showMenu=false; state.menuView='main'; render(); });
  document.getElementById('settings-open')?.addEventListener('click', ()=>{ state.menuView='settings'; render(); });
  document.getElementById('menu-back')?.addEventListener('click', ()=>{ state.menuView='main'; render(); });
  document.getElementById('updates-open')?.addEventListener('click', ()=>{ state.showUpdate=true; state.showMenu=false; render(); });
  document.getElementById('social-open')?.addEventListener('click', ()=>{ state.showSocial=true; state.showMenu=false; render(); });
  document.getElementById('close-update')?.addEventListener('click', ()=>{ state.showUpdate=false; render(); });
  document.getElementById('close-social')?.addEventListener('click', ()=>{ state.showSocial=false; render(); });
  document.getElementById('modal-bg')?.addEventListener('click', ()=>{ state.showUpdate=false; state.showSocial=false; render(); });
  document.getElementById('toggle-full')?.addEventListener('click', ()=>{ state.settings.autoFullscreen=!state.settings.autoFullscreen; saveSettings(); render(); });
  document.getElementById('toggle-tabs')?.addEventListener('click', ()=>{ state.settings.enableTabs=!state.settings.enableTabs; if (!state.settings.enableTabs && state.selectedGame) state.openTabs=[state.selectedGame]; saveSettings(); render(); });

  document.querySelectorAll('[data-open]').forEach((el)=>el.addEventListener('click', ()=> openGame(state.games.find(g=>g.Title===el.getAttribute('data-open')))));
  document.getElementById('back-btn')?.addEventListener('click', closeGame);
  document.getElementById('refresh-btn')?.addEventListener('click', refreshGame);
  document.getElementById('random-btn')?.addEventListener('click', ()=> openGame(state.games[Math.floor(Math.random()*state.games.length)]));
  document.getElementById('full-btn')?.addEventListener('click', ()=> document.fullscreenElement ? document.exitFullscreen() : document.getElementById('player')?.requestFullscreen?.().catch(()=>{}));
  document.getElementById('player-search')?.addEventListener('input', (e)=>{ state.playerSearch=e.target.value; render(); });
  document.querySelectorAll('[data-tab]').forEach((el)=>el.addEventListener('click', ()=>{ const g = state.openTabs.find(x=>x.Title===el.getAttribute('data-tab')); if (g) {state.selectedGame=g; render();} }));
  document.querySelectorAll('[data-close-tab]').forEach((el)=>el.addEventListener('click', ()=>{
    const t = el.getAttribute('data-close-tab');
    state.openTabs = state.openTabs.filter(g=>g.Title!==t);
    if (state.selectedGame?.Title===t) state.selectedGame = state.openTabs.at(-1) || null;
    if (!state.selectedGame) state.isPlayerOpen=false;
    render();
  }));

  document.getElementById('frame-wrap')?.addEventListener('wheel', (e)=> e.preventDefault(), {passive:false});

  document.getElementById('ctx-refresh')?.addEventListener('click', refreshGame);
  document.getElementById('ctx-random')?.addEventListener('click', ()=> openGame(state.games[Math.floor(Math.random()*state.games.length)]));
  document.getElementById('ctx-close')?.addEventListener('click', closeGame);
}

function setupInfiniteLoad() {
  const sentinel = document.getElementById('sentinel');
  if (!sentinel) return;
  const obs = new IntersectionObserver((entries)=>{
    if (entries[0].isIntersecting && state.visibleCount < state.filtered.length) {
      state.visibleCount += 30;
      render();
    }
  }, {rootMargin:'300px'});
  obs.observe(sentinel);
}

fetch('./game.json')
  .then((r)=>r.json())
  .then((games)=>{
    state.games = [...games].sort((a,b)=>a.Title.localeCompare(b.Title));
    render();
  })
  .catch(()=> { app.innerHTML = '<div class="app"><p>Failed to load games.</p></div>'; });


document.addEventListener('contextmenu', (e)=>{
  e.preventDefault();
  state.context={open:true,x:e.clientX,y:e.clientY};
  render();
});

document.addEventListener('click', ()=>{
  if (state.context.open) {
    state.context.open=false;
    render();
  }
});
