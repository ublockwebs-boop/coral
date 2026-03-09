const state = {
  games: [],
  filtered: [],
  categories: [],
  selectedCategories: new Set(),
  search: '',
  selectedGame: null,
  recentlyPlayed: JSON.parse(localStorage.getItem('coral_recent') || '[]'),
};

const app = document.getElementById('app');

function saveRecent(title) {
  state.recentlyPlayed = [title, ...state.recentlyPlayed.filter((t) => t !== title)].slice(0, 8);
  localStorage.setItem('coral_recent', JSON.stringify(state.recentlyPlayed));
}

function filterGames() {
  const q = state.search.toLowerCase();
  state.filtered = state.games.filter((g) => {
    const searchMatch = g.Title.toLowerCase().includes(q);
    const cats = [...state.selectedCategories];
    const catMatch = cats.length === 0 || cats.every((cat) => g.Categories.includes(cat));
    return searchMatch && catMatch;
  });
}

function openPlayer(game) {
  state.selectedGame = game;
  saveRecent(game.Title);
  render();
}

function closePlayer() {
  state.selectedGame = null;
  render();
}

function render() {
  filterGames();
  const featured = state.games.slice(0, 6);
  const selected = state.selectedGame;

  app.innerHTML = `
    <header class="topbar">
      <h1>Coral</h1>
      <div class="controls">
        <input id="search" placeholder="Search games..." value="${state.search.replace(/"/g, '&quot;')}" />
        <button id="category-toggle">Categories (${state.selectedCategories.size})</button>
      </div>
    </header>

    <section id="categories" class="panel ${state.selectedCategories.size ? 'open' : ''}">
      ${state.categories.map((cat) => `
        <button class="chip ${state.selectedCategories.has(cat) ? 'active' : ''}" data-cat="${cat}">${cat}</button>
      `).join('')}
      <button id="clear-cats" class="chip">Clear</button>
    </section>

    <section class="recent panel">
      <h3>Continue Playing</h3>
      <div class="row">
        ${state.recentlyPlayed.map((title) => `<span class="pill">${title}</span>`).join('') || '<span class="muted">No recent games yet</span>'}
      </div>
    </section>

    <section class="panel">
      <h2>Featured</h2>
      <div class="grid">
        ${featured.map((g) => card(g)).join('')}
      </div>
    </section>

    <section class="panel">
      <h2>Library (${state.filtered.length})</h2>
      <div class="grid">
        ${state.filtered.map((g) => card(g)).join('')}
      </div>
    </section>

    ${selected ? player(selected) : ''}
  `;

  document.getElementById('search').addEventListener('input', (e) => {
    state.search = e.target.value;
    render();
  });

  document.getElementById('category-toggle').addEventListener('click', () => {
    document.getElementById('categories').classList.toggle('open');
  });

  app.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-cat');
      if (state.selectedCategories.has(cat)) state.selectedCategories.delete(cat);
      else state.selectedCategories.add(cat);
      render();
    });
  });

  document.getElementById('clear-cats').addEventListener('click', () => {
    state.selectedCategories.clear();
    render();
  });

  app.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const title = btn.getAttribute('data-open');
      const game = state.games.find((g) => g.Title === title);
      if (game) openPlayer(game);
    });
  });

  const closeBtn = document.getElementById('close-player');
  if (closeBtn) closeBtn.addEventListener('click', closePlayer);
}

function card(game) {
  return `
    <article class="game-card">
      <img loading="lazy" src="${game.Icon}" alt="${game.Title}" />
      <div class="meta">
        <strong>${game.Title}</strong>
        <button data-open="${game.Title}">Play</button>
      </div>
    </article>
  `;
}

function player(game) {
  const similar = state.games.filter((g) => g.Title !== game.Title && g.Categories.some((c) => game.Categories.includes(c))).slice(0, 8);
  return `
    <section class="player-overlay">
      <div class="player-header">
        <button id="close-player">Back</button>
        <h3>${game.Title}</h3>
      </div>
      <div class="player-body">
        <aside>
          <h4>Similar games</h4>
          ${similar.map((g) => `<button data-open="${g.Title}" class="left-btn">${g.Title}</button>`).join('') || '<p class="muted">No similar games</p>'}
        </aside>
        <main>
          <iframe src="${game.IFrame}" title="${game.Title}" loading="eager" referrerpolicy="no-referrer"></iframe>
          <div class="wip">WIP</div>
        </main>
      </div>
    </section>
  `;
}

fetch('./game.json')
  .then((r) => r.json())
  .then((games) => {
    state.games = [...games].sort((a, b) => a.Title.localeCompare(b.Title));
    const all = state.games.flatMap((g) => g.Categories || []);
    state.categories = [...new Set(all)].sort();
    render();
  })
  .catch(() => {
    app.innerHTML = '<p class="muted">Failed to load game library.</p>';
  });
