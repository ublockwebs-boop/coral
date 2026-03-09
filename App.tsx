import { useState, useMemo, useEffect, useRef, useCallback, type WheelEventHandler } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, X, Play, Gamepad2, Shuffle, ArrowUp, RotateCcw, Maximize,
  Menu, Settings, History, ChevronRight, Sparkles, Grid,
  ChevronLeft, MousePointer2, Users, Check, SlidersHorizontal
} from 'lucide-react';
import gamesData from './game.json';
import { GameCard } from './GameCard';

interface Game {
  Title: string;
  Icon: string;
  IFrame: string;
  Categories: string[];
  badge: string;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [visibleGamesCount, setVisibleGamesCount] = useState(24);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [selectedGame, setSelectedGame] = useState<Game | null>(() => {
    try {
      const saved = localStorage.getItem('coral_active_game');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isPlayerOpen, setIsPlayerOpen] = useState(() => localStorage.getItem('coral_player_open') === 'true');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('coral_settings');
      return saved ? JSON.parse(saved) : { autoFullscreen: false, enableTabs: true };
    } catch {
      return { autoFullscreen: false, enableTabs: true };
    }
  });
  const [openGames, setOpenGames] = useState<Game[]>([]);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'settings'>('main');
  const [showUpdateLog, setShowUpdateLog] = useState(false);
  const [showSocial, setShowSocial] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [recentlyPlayed, setRecentlyPlayed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('coral_recent') || '[]');
    } catch {
      return [];
    }
  });
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('coral_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('coral_recent', JSON.stringify(recentlyPlayed.slice(0, 8)));
  }, [recentlyPlayed]);

  useEffect(() => {
    if (selectedGame) {
      localStorage.setItem('coral_active_game', JSON.stringify(selectedGame));
    } else {
      localStorage.removeItem('coral_active_game');
    }
    localStorage.setItem('coral_player_open', isPlayerOpen.toString());
  }, [selectedGame, isPlayerOpen]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const closeMenu = () => setContextMenu((prev) => ({ ...prev, visible: false }));
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === '/' && document.activeElement !== searchInputRef.current) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setContextMenu((prev) => ({ ...prev, visible: false }));
        setShowCategoryPicker(false);
        setIsSideMenuOpen(false);
        setShowSocial(false);
        setShowUpdateLog(false);
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, []);

  const games = useMemo(() => [...(gamesData as Game[])].sort((a, b) => a.Title.localeCompare(b.Title)), []);

  const gameByTitle = useMemo(() => {
    const map = new Map<string, Game>();
    games.forEach((game) => map.set(game.Title, game));
    return map;
  }, [games]);

  const categories = useMemo(() => {
    const allCats = games.flatMap((g) => g.Categories || []);
    return Array.from(new Set(allCats.filter((c) => typeof c === 'string' && c.trim() !== ''))).sort();
  }, [games]);

  const featuredGames = useMemo(() => games.slice(0, 5), [games]);

  const similarGames = useMemo(() => {
    if (!selectedGame) return [];
    const selectedSet = new Set(selectedGame.Categories);
    return games
      .filter((g) => g.Title !== selectedGame.Title)
      .map((g) => ({ game: g, score: g.Categories.filter((c) => selectedSet.has(c)).length }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((item) => item.game);
  }, [games, selectedGame]);

  const playerLeftGames = useMemo(() => {
    if (playerSearch.trim()) {
      return games.filter((game) => game.Title.toLowerCase().includes(playerSearch.toLowerCase())).slice(0, 20);
    }
    return similarGames;
  }, [games, playerSearch, similarGames]);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchesSearch = game.Title.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      const matchesCategories = selectedCategories.length === 0 || selectedCategories.every((cat) => game.Categories.includes(cat));
      return matchesSearch && matchesCategories;
    });
  }, [games, debouncedSearchQuery, selectedCategories]);

  const visibleGames = useMemo(() => filteredGames.slice(0, visibleGamesCount), [filteredGames, visibleGamesCount]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && visibleGamesCount < filteredGames.length) {
        setVisibleGamesCount((prev) => prev + 24);
      }
    }, { threshold: 0.1, rootMargin: '200px' });

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [visibleGamesCount, filteredGames.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setVisibleGamesCount(24);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleGameSelect = useCallback((game: Game) => {
    setSelectedGame(game);
    setIsPlayerOpen(true);
    setRecentlyPlayed((prev) => [game.Title, ...prev.filter((title) => title !== game.Title)].slice(0, 8));

    if (settings.enableTabs) {
      setOpenGames((prev) => (prev.some((g) => g.Title === game.Title) ? prev : [...prev, game]));
    } else {
      setOpenGames([game]);
    }

    try {
      const host = new URL(game.IFrame).origin;
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = host;
      document.head.appendChild(link);
    } catch {
      // no-op
    }

    if (settings.autoFullscreen) {
      setTimeout(() => toggleFullscreen(), 250);
    }
  }, [settings.enableTabs, settings.autoFullscreen]);

  const handleRandomGame = () => handleGameSelect(games[Math.floor(Math.random() * games.length)]);
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const closePlayer = () => {
    setIsPlayerOpen(false);
    if (!settings.enableTabs) setOpenGames([]);
  };

  const closeTab = (gameTitle: string) => {
    setOpenGames((prev) => {
      const filtered = prev.filter((g) => g.Title !== gameTitle);
      if (selectedGame?.Title === gameTitle) {
        setSelectedGame(filtered.at(-1) || null);
        if (filtered.length === 0) setIsPlayerOpen(false);
      }
      return filtered;
    });
  };

  const refreshIframe = () => {
    if (!selectedGame) return;
    setRefreshKeys((prev) => ({ ...prev, [selectedGame.Title]: (prev[selectedGame.Title] || 0) + 1 }));
  };

  const toggleFullscreen = () => {
    if (!playerRef.current) return;
    if (!document.fullscreenElement) {
      playerRef.current.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen();
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  };

  const handleWheelGuard: WheelEventHandler<HTMLDivElement> = (event) => event.preventDefault();

  return (
    <div
      className="coral-cursor min-h-screen bg-[var(--bg)] text-[var(--fg)] font-sans selection:bg-[var(--accent)] selection:text-white pb-20 md:pb-0"
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
      }}
    >
      <header className={`sticky top-0 z-40 glass px-6 py-4 transition-all duration-300 ${isPlayerOpen ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100 translate-y-0'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white leading-none">Coral</h1>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-muted)] group-focus-within:text-[var(--accent)] transition-colors" />
              <input ref={searchInputRef} type="text" placeholder="Search games... ( / )" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-[var(--bg-surface)] border-none rounded-2xl py-2.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-[var(--accent)] w-64 transition-all placeholder:text-[var(--fg-muted)]/50 text-[var(--fg)]" />
            </div>

            <button type="button" onClick={() => setShowCategoryPicker((prev) => !prev)} className={`group flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border transition-all shadow-sm ${selectedCategories.length ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-surface)] border-white/10 hover:bg-[var(--bg-card)] text-[var(--fg)]'}`}>
              <SlidersHorizontal className="w-4 h-4" />
              <span className="text-sm font-semibold">Categories</span>
              {selectedCategories.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20">{selectedCategories.length}</span>}
            </button>

            <button type="button" onClick={() => setIsSideMenuOpen(true)} className="p-3 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] text-[var(--fg)] transition-all hover:scale-105 active:scale-95 shadow-sm">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {settings.enableTabs && openGames.length > 0 && (
          <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-white/5">
            <div className="flex items-end gap-1.5 overflow-x-auto scrollbar-hide pb-1">
              {openGames.map((game) => {
                const active = selectedGame?.Title === game.Title;
                return (
                  <div key={`top-tab-${game.Title}`} className={`group flex items-center gap-2 px-3 py-2 min-w-36 rounded-t-2xl border-b-0 border ${active ? 'bg-[var(--bg)] border-white/20 text-white' : 'bg-[var(--bg-card)]/70 border-white/10 text-[var(--fg-muted)] hover:bg-[var(--bg-card)]'}`}>
                    <button type="button" className="truncate text-xs font-semibold text-left" onClick={() => setSelectedGame(game)}>{game.Title}</button>
                    <button type="button" className="opacity-70 hover:opacity-100" onClick={() => closeTab(game.Title)}><X className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="md:hidden mt-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-muted)]" />
            <input type="text" placeholder="Search games..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-[var(--bg-surface)] border-none rounded-2xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-[var(--accent)] transition-all placeholder:text-[var(--fg-muted)]/50 text-[var(--fg)]" />
          </div>
        </div>

        {showCategoryPicker && (
          <div className="max-w-7xl mx-auto mt-4 bg-[var(--bg-surface)] rounded-3xl p-4 border border-white/10 shadow-2xl">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
              {categories.map((cat) => {
                const active = selectedCategories.includes(cat);
                return (
                  <button type="button" key={cat} onClick={() => toggleCategory(cat)} className={`text-left px-3 py-2 rounded-xl text-xs border transition-all ${active ? 'bg-[var(--accent)]/20 border-[var(--accent)] text-white' : 'bg-[var(--bg-card)] border-white/10 text-[var(--fg-muted)] hover:border-white/30'}`}>
                    <span className="inline-flex items-center gap-2">{active && <Check className="w-3.5 h-3.5" />} {cat}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCategoryPicker(false)} className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold">Apply Filter</button>
              <button type="button" onClick={() => setSelectedCategories([])} className="px-4 py-2 rounded-xl bg-[var(--bg-card)] text-[var(--fg-muted)] text-xs font-semibold">Clear</button>
            </div>
          </div>
        )}
      </header>

      <main className={`max-w-7xl mx-auto px-6 transition-opacity duration-300 ${isPlayerOpen ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100'}`}>
        {recentlyPlayed.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-[var(--fg-muted)] mb-2">Continue Playing</h2>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {recentlyPlayed.map((title) => {
                const game = gameByTitle.get(title);
                if (!game) return null;
                return <button type="button" key={`recent-${title}`} onClick={() => handleGameSelect(game)} className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] text-xs whitespace-nowrap">{title}</button>;
              })}
            </div>
          </section>
        )}

        {!searchQuery && selectedCategories.length === 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6"><Sparkles className="w-5 h-5 text-[var(--accent)]" />Featured</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {featuredGames.map((game) => (
                <motion.div key={`featured-${game.Title}`} onClick={() => handleGameSelect(game)} className="group relative aspect-square cursor-pointer transition-all duration-500 hover:-translate-y-2">
                  <div className="absolute inset-0 rounded-[2rem] overflow-hidden shadow-lg group-hover:shadow-2xl group-hover:shadow-[var(--accent)]/20 transition-all duration-500">
                    <img src={game.Icon} alt={game.Title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"><div className="w-12 h-12 bg-[var(--accent)] rounded-full flex items-center justify-center"><Play className="w-5 h-5 text-white fill-white ml-0.5" /></div></div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Grid className="w-5 h-5 text-[var(--accent)]" />Library</h2>
            <span className="text-sm text-[var(--fg-muted)] font-medium bg-[var(--bg-surface)] px-3 py-1 rounded-full">{filteredGames.length} Games</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            <AnimatePresence mode="popLayout">
              {visibleGames.map((game, idx) => <GameCard key={game.Title} game={game} index={idx} onSelect={handleGameSelect} />)}
            </AnimatePresence>
          </div>

          <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
            {visibleGamesCount < filteredGames.length && <div className="w-8 h-8 border-4 border-[var(--bg-card)] border-t-[var(--accent)] rounded-full animate-spin" />}
          </div>

          {filteredGames.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--fg-muted)]">
              <div className="w-20 h-20 bg-[var(--bg-surface)] rounded-full flex items-center justify-center mb-6"><Gamepad2 className="w-10 h-10 opacity-50" /></div>
              <p className="text-lg font-medium">No games found</p>
            </div>
          )}
        </section>
      </main>

      <AnimatePresence>
        {showScrollTop && !isPlayerOpen && (
          <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={scrollToTop} className="fixed bottom-6 right-6 z-30 p-4 bg-[var(--accent)] text-white rounded-2xl shadow-lg hover:scale-105 transition-all">
            <ArrowUp className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      <div ref={playerRef} className={`fixed inset-0 z-50 bg-[var(--bg)] transition-all duration-500 ${isPlayerOpen && selectedGame ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        {!isFullscreen && selectedGame && (
          <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)]/80 backdrop-blur-xl border-b border-white/5">
            <div className="flex items-center gap-4">
              <button type="button" onClick={closePlayer} className="p-2 hover:bg-[var(--bg-card)] rounded-full transition-colors text-[var(--fg)]"><ChevronLeft className="w-6 h-6" /></button>
              <h2 className="text-lg font-bold text-white">{selectedGame.Title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleRandomGame} className="p-2.5 bg-[var(--bg-card)] hover:bg-[var(--accent)] rounded-xl"><Shuffle className="w-5 h-5" /></button>
              <button type="button" onClick={refreshIframe} className="p-2.5 bg-[var(--bg-card)] hover:bg-[var(--accent)] rounded-xl"><RotateCcw className="w-5 h-5" /></button>
              <button type="button" onClick={toggleFullscreen} className="p-2.5 bg-[var(--bg-card)] hover:bg-[var(--accent)] rounded-xl"><Maximize className="w-5 h-5" /></button>
            </div>
          </div>
        )}

        <div className="h-[calc(100%-70px)] grid grid-cols-1 lg:grid-cols-[340px_1fr]">
          <aside className="bg-[var(--bg-surface)] border-r border-white/10 p-4 overflow-y-auto">
            <h3 className="font-semibold mb-3">Preferences / Next Game</h3>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-muted)]" />
              <input value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} placeholder="Search any game..." className="w-full bg-[var(--bg-card)] rounded-xl py-2 pl-10 pr-3 text-sm" />
            </div>
            <div className="space-y-2">
              {playerLeftGames.map((game) => (
                <button type="button" key={`next-${game.Title}`} onClick={() => handleGameSelect(game)} className="w-full flex items-center gap-3 p-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--accent)]/20 text-left">
                  <img src={game.Icon} className="w-8 h-8 rounded" alt="" referrerPolicy="no-referrer" />
                  <span className="text-sm truncate">{game.Title}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="grid grid-rows-[1fr_160px] bg-black">
            <div className="relative overflow-hidden" onWheelCapture={handleWheelGuard}>
              {openGames.map((game) => {
                const isActive = selectedGame?.Title === game.Title;
                if (!isActive && !settings.enableTabs) return null;
                return (
                  <div key={game.Title} className={`absolute inset-0 ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none invisible'}`}>
                    <iframe
                      key={`${game.Title}-${refreshKeys[game.Title] || 0}`}
                      src={game.IFrame}
                      className="w-full h-full border-none"
                      sandbox="allow-forms allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-scripts allow-same-origin"
                      allow="autoplay; fullscreen; keyboard; pointer-lock; gamepad"
                      title={game.Title}
                      loading={isActive ? 'eager' : 'lazy'}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                );
              })}
            </div>
            <div className="bg-[var(--bg-surface)] border-t border-white/10 flex items-center justify-center">
              <span className="text-lg font-bold text-[var(--fg-muted)]">WIP</span>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSideMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSideMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed right-0 top-0 bottom-0 w-80 bg-[var(--bg-surface)] border-l border-white/5 z-[70] shadow-2xl flex flex-col rounded-l-3xl overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[var(--bg-card)]">
                <div className="flex items-center gap-3">
                  {menuView !== 'main' && <button type="button" onClick={() => setMenuView('main')} className="p-1 hover:bg-white/10 rounded-full"><ChevronLeft className="w-5 h-5" /></button>}
                  <h2 className="text-xl font-bold text-white">{menuView === 'settings' ? 'Settings' : 'Menu'}</h2>
                </div>
                <button type="button" onClick={() => setIsSideMenuOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {menuView === 'main' ? (
                  <div className="space-y-3">
                    <button type="button" onClick={() => setMenuView('settings')} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-card)]"><Settings className="w-5 h-5" />Settings<ChevronRight className="w-4 h-4 ml-auto" /></button>
                    <button type="button" onClick={() => { setShowUpdateLog(true); setIsSideMenuOpen(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-card)]"><History className="w-5 h-5" />Update Log<ChevronRight className="w-4 h-4 ml-auto" /></button>
                    <button type="button" onClick={() => { setShowSocial(true); setIsSideMenuOpen(false); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-card)]"><Users className="w-5 h-5" />Social <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">WIP</span><ChevronRight className="w-4 h-4 ml-auto" /></button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-[var(--bg-card)] flex items-center justify-between"><span className="text-sm font-semibold">Auto Fullscreen</span><button type="button" onClick={() => setSettings({ ...settings, autoFullscreen: !settings.autoFullscreen })} className={`w-12 h-7 rounded-full ${settings.autoFullscreen ? 'bg-[var(--accent)]' : 'bg-[var(--bg-surface)]'}`} /></div>
                    <div className="p-4 rounded-2xl bg-[var(--bg-card)] flex items-center justify-between"><span className="text-sm font-semibold">Enable Tabs</span><button type="button" onClick={() => { const next = !settings.enableTabs; setSettings({ ...settings, enableTabs: next }); if (!next) setOpenGames(selectedGame ? [selectedGame] : []); }} className={`w-12 h-7 rounded-full ${settings.enableTabs ? 'bg-[var(--accent)]' : 'bg-[var(--bg-surface)]'}`} /></div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-[var(--bg-card)] text-center"><p className="text-xs text-[var(--fg-muted)] font-medium">Coral</p></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUpdateLog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[var(--bg-surface)]"><h2 className="text-2xl font-bold text-white">Update Log</h2><button type="button" onClick={() => setShowUpdateLog(false)} className="p-2 bg-[var(--bg-card)] rounded-full"><X className="w-6 h-6" /></button></div>
            <div className="flex-1 grid place-items-center text-[var(--fg-muted)] text-lg">v2.2 UI + QoL + perf updates</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSocial && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[101] bg-[var(--bg)] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[var(--bg-surface)]"><h2 className="text-2xl font-bold text-white flex items-center gap-2">Social <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300">WIP</span></h2><button type="button" onClick={() => setShowSocial(false)} className="p-2 bg-[var(--bg-card)] rounded-full"><X className="w-6 h-6" /></button></div>
            <div className="flex-1 grid place-items-center text-[var(--fg-muted)] text-lg">WIP</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {contextMenu.visible && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ left: contextMenu.x, top: contextMenu.y }} className="fixed z-[120] min-w-48 rounded-xl border border-white/10 bg-[var(--bg-surface)] shadow-2xl p-2">
            <button type="button" onClick={refreshIframe} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-card)] text-sm flex items-center gap-2"><RotateCcw className="w-4 h-4" />Refresh game</button>
            <button type="button" onClick={handleRandomGame} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-card)] text-sm flex items-center gap-2"><Shuffle className="w-4 h-4" />Random game</button>
            <button type="button" onClick={closePlayer} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-card)] text-sm flex items-center gap-2"><MousePointer2 className="w-4 h-4" />Close player</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
