import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, X, Play, Gamepad2, Shuffle, ArrowUp, Trophy, 
  RotateCcw, Maximize, Menu, Settings, History, Layout, 
  ChevronRight, Sparkles, Home, Grid, Info, ChevronLeft,
  Lock
} from 'lucide-react';
import gamesData from '../game.json';
import { GameCard } from './components/GameCard';
import Calculator from './components/Calculator';

interface Game {
  Title: string;
  Icon: string;
  IFrame: string;
  Categories: string[];
  badge: string;
}

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return new URLSearchParams(window.location.search).get('unlocked') === 'true';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [visibleGamesCount, setVisibleGamesCount] = useState(24);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset pagination on category change
  useEffect(() => {
    setVisibleGamesCount(24);
  }, [selectedCategory]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(() => {
    try {
      const saved = localStorage.getItem('nylo_active_game');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isPlayerOpen, setIsPlayerOpen] = useState(() => {
    return localStorage.getItem('nylo_player_open') === 'true';
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [refreshKeys, setRefreshKeys] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('nylo_settings');
      return saved ? JSON.parse(saved) : {
        autoFullscreen: false,
        enableTabs: false
      };
    } catch {
      return { autoFullscreen: false, enableTabs: false };
    }
  });
  const [openGames, setOpenGames] = useState<Game[]>([]);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'settings' | 'tabs'>('main');
  const [showUpdateLog, setShowUpdateLog] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState(() => Math.floor(Date.now() / (6 * 60 * 60 * 1000)));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('nylo_settings', JSON.stringify(settings));
  }, [settings]);

  // Persist active game state
  useEffect(() => {
    if (selectedGame) {
      localStorage.setItem('nylo_active_game', JSON.stringify(selectedGame));
    } else {
      localStorage.removeItem('nylo_active_game');
    }
    localStorage.setItem('nylo_player_open', isPlayerOpen.toString());
  }, [selectedGame, isPlayerOpen]);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Game Data Logic
  const games = useMemo(() => {
    return [...(gamesData as Game[])].sort((a, b) => a.Title.localeCompare(b.Title));
  }, []);

  const rotationIntervalMs = 3 * 60 * 60 * 1000; // 3 hours
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const nextPeriod = (Math.floor(now / rotationIntervalMs) + 1) * rotationIntervalMs;
      const diff = nextPeriod - now;
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      
      const newPeriod = Math.floor(now / rotationIntervalMs);
      setCurrentPeriod(prev => (prev !== newPeriod ? newPeriod : prev));
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, []);

  // ... (featuredGames memo uses currentPeriod)

  const featuredGames = useMemo(() => {
    if (games.length === 0) return [];
    let seed = currentPeriod;
    const shuffled = [...games];
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      const j = seed % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 5);
  }, [games, currentPeriod]);

  const categories = useMemo(() => {
    const allCats = games.flatMap(g => g.Categories || []);
    return Array.from(new Set(allCats.filter(c => typeof c === 'string' && c.trim() !== ''))).sort();
  }, [games]);

  const filteredGames = useMemo(() => {
    return games.filter(game => {
      const matchesSearch = game.Title.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || game.Categories.includes(selectedCategory);
      return matchesSearch && matchesCategory;
    });
  }, [games, debouncedSearchQuery, selectedCategory]);

  const visibleGames = useMemo(() => {
    return filteredGames.slice(0, visibleGamesCount);
  }, [filteredGames, visibleGamesCount]);

  // Infinite Scroll logic
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleGamesCount < filteredGames.length) {
          setVisibleGamesCount(prev => prev + 24);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [visibleGamesCount, filteredGames.length]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setVisibleGamesCount(24); // Reset pagination on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handlers
  const handleGameSelect = useCallback((game: Game) => {
    setSelectedGame(game);
    setIsPlayerOpen(true);
    
    if (settings.enableTabs) {
      setOpenGames(prev => {
        if (prev.find(g => g.Title === game.Title)) return prev;
        return [...prev, game];
      });
    } else {
      setOpenGames([game]);
    }

    if (settings.autoFullscreen) {
      setTimeout(() => toggleFullscreen(), 500);
    }
  }, [settings]);

  const handleRandomGame = () => {
    const randomIdx = Math.floor(Math.random() * games.length);
    handleGameSelect(games[randomIdx]);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closePlayer = () => {
    setIsPlayerOpen(false);
    if (!settings.enableTabs) {
      setOpenGames([]);
    }
  };

  const closeTab = (gameTitle: string) => {
    setOpenGames(prev => {
      const filtered = prev.filter(g => g.Title !== gameTitle);
      if (selectedGame?.Title === gameTitle) {
        setSelectedGame(filtered.length > 0 ? filtered[filtered.length - 1] : null);
        if (filtered.length === 0) setIsPlayerOpen(false);
      }
      return filtered;
    });
  };

  const refreshIframe = () => {
    if (selectedGame) {
      setRefreshKeys(prev => ({
        ...prev,
        [selectedGame.Title]: (prev[selectedGame.Title] || 0) + 1
      }));
    }
  };

  const toggleFullscreen = () => {
    if (!playerRef.current) return;
    if (!document.fullscreenElement) {
      playerRef.current.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  const updateLogs = [
    { 
      version: '2.0', 
      date: '2026-03-02', 
      sections: [
        {
          title: 'QoL',
          changes: ['Tabs', 'Fullscreen', 'Menu', 'Settings', 'Random Game is now in game player', 'Games sorted A-Z']
        },
        {
          title: 'New Games',
          games: ['Dumb Ways to Die', 'Granny 2', 'Granny 3', 'A Bite at Freddy\'s', 'Five Nights at Freddy\'s World: Refreshed', 'karlson', 'Smash Karts', 'Cut the Rope', 'Cut the Rope: Holiday Gift', 'Cut the Rope: Time Travel', 'Five Nights at Candy\'s', 'Five Nights at Candy\'s 2', 'Moto X3M 2', 'Moto X3M 3', 'Moto X3M Pool Party', 'Moto X3M Spooky', 'Moto X3M Winter', 'Bowmasters', 'Basket Random', 'Boxing Random', 'Soccer Random', 'Volley Random']
        },
        {
          title: 'Fixed Games - Maybe',
          games: ['Brotato', 'Hotline Miami', 'Escape Road', 'Angry Birds', 'SandBoxels', 'Balatro']
        }
      ]
    }
  ];

  const handleUnlock = () => {
    // Do nothing locally to ensure the main tab stays as a calculator
  };

  if (!isUnlocked) {
    return <Calculator onUnlock={handleUnlock} />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] font-sans selection:bg-[var(--accent)] selection:text-white pb-20 md:pb-0">
      {/* Header */}
      <header className={`sticky top-0 z-40 glass px-6 py-4 mb-8 transition-all duration-300 ${isPlayerOpen ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100 translate-y-0'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
             <h1 className="text-2xl font-bold tracking-tight text-white leading-none">Scientific Calculator</h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Search Bar - Desktop */}
             <div className="relative hidden md:block group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-muted)] group-focus-within:text-[var(--accent)] transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search games..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[var(--bg-surface)] border-none rounded-2xl py-2.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-[var(--accent)] w-64 transition-all placeholder:text-[var(--fg-muted)]/50 text-[var(--fg)]"
                />
             </div>
             
             <button 
               onClick={() => setIsSideMenuOpen(true)} 
               className="p-3 rounded-2xl bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] text-[var(--fg)] transition-all hover:scale-105 active:scale-95 shadow-sm"
             >
                <Menu className="w-5 h-5" />
             </button>
          </div>
        </div>
        
        {/* Mobile Search Bar */}
        <div className="md:hidden mt-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-muted)]" />
            <input 
              type="text" 
              placeholder="Search games..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border-none rounded-2xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-[var(--accent)] transition-all placeholder:text-[var(--fg-muted)]/50 text-[var(--fg)]"
            />
          </div>
        </div>
      </header>

      <main className={`max-w-7xl mx-auto px-6 transition-opacity duration-300 ${isPlayerOpen ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100'}`}>
         {/* Categories Pill List */}
         {!searchQuery && (
           <div className="mb-10 overflow-x-auto pb-2 scrollbar-hide">
             <div className="flex items-center gap-3 w-max">
               <button
                 onClick={() => setSelectedCategory(null)}
                 className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 ${
                   selectedCategory === null 
                     ? 'bg-[var(--accent)] text-white shadow-lg shadow-blue-500/25 scale-105' 
                     : 'bg-[var(--bg-surface)] text-[var(--fg-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--fg)]'
                 }`}
               >
                 All Games
               </button>
               {categories.map(cat => (
                 <button
                   key={cat}
                   onClick={() => setSelectedCategory(cat)}
                   className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 ${
                     selectedCategory === cat 
                       ? 'bg-[var(--accent)] text-white shadow-lg shadow-blue-500/25 scale-105' 
                       : 'bg-[var(--bg-surface)] text-[var(--fg-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--fg)]'
                   }`}
                 >
                   {cat}
                 </button>
               ))}
             </div>
           </div>
         )}

         {/* Featured Games Carousel */}
         {!searchQuery && !selectedCategory && (
           <section className="mb-12">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-bold text-white flex items-center gap-2">
                 <Sparkles className="w-5 h-5 text-[var(--accent)]" />
                 Featured
               </h2>
               <div className="text-xs font-mono text-[var(--fg-muted)] bg-[var(--bg-surface)] px-3 py-1 rounded-full">
                 {timeLeft}
               </div>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
               {featuredGames.map((game, idx) => (
                 <motion.div
                   key={`featured-${game.Title}`}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: idx * 0.1 }}
                   onClick={() => handleGameSelect(game)}
                   className="group relative aspect-square cursor-pointer transition-all duration-500 hover:-translate-y-2"
                 >
                   <div className="absolute inset-0 rounded-[2rem] overflow-hidden shadow-lg group-hover:shadow-2xl group-hover:shadow-[var(--accent)]/20 transition-all duration-500">
                     <img
                       src={`${game.Icon}${game.Icon.includes('?') ? '&' : '?'}v=1`}
                       alt={game.Title}
                       className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                       referrerPolicy="no-referrer"
                     />
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                       <div className="w-12 h-12 bg-[var(--accent)] rounded-full flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                         <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                       </div>
                     </div>
                     <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
                       <h3 className="text-lg font-bold text-white leading-tight">{game.Title}</h3>
                     </div>
                   </div>
                 </motion.div>
               ))}
             </div>
           </section>
         )}

         {/* Game Grid */}
         <section className="mb-20">
            <div className="flex items-center justify-between mb-6">
               <h2 className="text-xl font-bold text-white flex items-center gap-2">
                 <Grid className="w-5 h-5 text-[var(--accent)]" />
                 {searchQuery ? 'Search Results' : selectedCategory ? selectedCategory : 'Library'}
               </h2>
               <span className="text-sm text-[var(--fg-muted)] font-medium bg-[var(--bg-surface)] px-3 py-1 rounded-full">
                 {filteredGames.length} Games
               </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              <AnimatePresence mode="popLayout">
                {visibleGames.map((game, idx) => (
                  <GameCard 
                    key={game.Title} 
                    game={game} 
                    index={idx} 
                    onSelect={handleGameSelect} 
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Infinite Scroll Sentinel */}
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
              {visibleGamesCount < filteredGames.length && (
                <div className="w-8 h-8 border-4 border-[var(--bg-card)] border-t-[var(--accent)] rounded-full animate-spin" />
              )}
            </div>

            {filteredGames.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-[var(--fg-muted)]">
                <div className="w-20 h-20 bg-[var(--bg-surface)] rounded-full flex items-center justify-center mb-6">
                  <Gamepad2 className="w-10 h-10 opacity-50" />
                </div>
                <p className="text-lg font-medium">No games found</p>
                <p className="text-sm opacity-60">Try searching for something else</p>
              </div>
            )}
         </section>
      </main>

      {/* Back to Top */}
      <AnimatePresence>
        {showScrollTop && !isPlayerOpen && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-30 p-4 bg-[var(--accent)] text-white rounded-2xl shadow-lg hover:shadow-blue-500/40 hover:scale-105 transition-all active:scale-95"
          >
            <ArrowUp className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Player Overlay */}
      <div 
        ref={playerRef}
        className={`fixed inset-0 z-50 bg-[var(--bg)] flex flex-col transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isPlayerOpen && selectedGame ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        {/* Player Header */}
        {!isFullscreen && selectedGame && (
          <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)]/80 backdrop-blur-xl border-b border-white/5">
            <div className="flex items-center gap-4">
              <button 
                onClick={closePlayer}
                className="p-2 hover:bg-[var(--bg-card)] rounded-full transition-colors text-[var(--fg)]"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-white leading-none">{selectedGame.Title}</h2>
                <div className="flex gap-2 mt-1">
                  {selectedGame.Categories.slice(0, 3).map(cat => (
                    <span key={cat} className="text-[10px] text-[var(--fg-muted)] bg-[var(--bg-card)] px-2 py-0.5 rounded-md">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRandomGame}
                className="p-2.5 bg-[var(--bg-card)] hover:bg-[var(--accent)] hover:text-white text-[var(--fg)] rounded-xl transition-all"
                title="Random Game"
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <button 
                onClick={refreshIframe}
                className="p-2.5 bg-[var(--bg-card)] hover:bg-[var(--accent)] hover:text-white text-[var(--fg)] rounded-xl transition-all"
                title="Refresh"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button 
                onClick={toggleFullscreen}
                className="p-2.5 bg-[var(--bg-card)] hover:bg-[var(--accent)] hover:text-white text-[var(--fg)] rounded-xl transition-all"
                title="Fullscreen"
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Iframe Container */}
        <div className="flex-1 relative bg-black overflow-hidden">
          {openGames.map((game) => {
            const isActive = selectedGame?.Title === game.Title;
            if (!isActive && !settings.enableTabs) return null;
            
            return (
              <div 
                key={game.Title}
                className={`absolute inset-0 transition-opacity duration-300 ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none invisible'}`}
                style={{ 
                  // Use visibility and pointer-events to "hibernate" background tabs
                  // without triggering a reload that display:none might cause
                  visibility: isActive ? 'visible' : 'hidden',
                }}
              >
                <iframe
                  key={`${game.Title}-${refreshKeys[game.Title] || 0}`}
                  src={isActive || settings.enableTabs ? game.IFrame : 'about:blank'}
                  className="w-full h-full border-none"
                  sandbox="allow-forms allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-scripts allow-same-origin"
                  allow="autoplay; fullscreen; keyboard; pointer-lock; gamepad"
                  title={game.Title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
            );
          })}
          
          <div className="absolute inset-0 -z-10 flex items-center justify-center bg-[var(--bg)]">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-[var(--bg-card)] border-t-[var(--accent)] rounded-full animate-spin" />
              <p className="text-sm font-medium text-[var(--fg-muted)]">Loading Game...</p>
            </div>
          </div>
        </div>
      </div>

      {/* Side Menu Drawer (One UI Style Bottom Sheet on Mobile, Side on Desktop) */}
      <AnimatePresence>
        {isSideMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSideMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-[var(--bg-surface)] border-l border-white/5 z-[70] shadow-2xl flex flex-col rounded-l-3xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[var(--bg-card)]">
                <div className="flex items-center gap-3">
                  {menuView !== 'main' && (
                    <button 
                      onClick={() => setMenuView('main')}
                      className="p-1 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}
                  <h2 className="text-xl font-bold text-white">
                    {menuView === 'settings' ? 'Settings' : menuView === 'tabs' ? 'Tabs' : 'Menu'}
                  </h2>
                </div>
                <button 
                  onClick={() => setIsSideMenuOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {menuView === 'main' ? (
                  <div className="space-y-3">
                    <button 
                      onClick={() => setMenuView('settings')}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-card)] hover:bg-[var(--bg)] transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center group-hover:bg-[var(--accent)] transition-colors">
                        <Settings className="w-5 h-5 text-[var(--fg)] group-hover:text-white" />
                      </div>
                      <span className="text-sm font-semibold text-[var(--fg)]">Settings</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-[var(--fg-muted)]" />
                    </button>
                    
                    {settings.enableTabs && (
                      <button 
                        onClick={() => setMenuView('tabs')}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-card)] hover:bg-[var(--bg)] transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center group-hover:bg-[var(--accent)] transition-colors">
                          <Layout className="w-5 h-5 text-[var(--fg)] group-hover:text-white" />
                        </div>
                        <span className="text-sm font-semibold text-[var(--fg)]">Tabs</span>
                        <ChevronRight className="w-4 h-4 ml-auto text-[var(--fg-muted)]" />
                      </button>
                    )}
                    
                    <button 
                      onClick={() => {
                        setShowUpdateLog(true);
                        setIsSideMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-card)] hover:bg-[var(--bg)] transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center group-hover:bg-[var(--accent)] transition-colors">
                        <History className="w-5 h-5 text-[var(--fg)] group-hover:text-white" />
                      </div>
                      <span className="text-sm font-semibold text-[var(--fg)]">Update Log</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-[var(--fg-muted)]" />
                    </button>
                  </div>
                ) : menuView === 'settings' ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-[var(--bg-card)] flex items-center justify-between">
                      <span className="text-sm font-semibold">Auto Fullscreen</span>
                      <button 
                        onClick={() => setSettings({ ...settings, autoFullscreen: !settings.autoFullscreen })}
                        className={`w-12 h-7 rounded-full transition-colors relative ${settings.autoFullscreen ? 'bg-[var(--accent)]' : 'bg-[var(--bg-surface)]'}`}
                      >
                        <motion.div 
                          animate={{ x: settings.autoFullscreen ? 22 : 2 }}
                          className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm" 
                        />
                      </button>
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--bg-card)] flex items-center justify-between">
                      <span className="text-sm font-semibold">Enable Tabs</span>
                      <button 
                        onClick={() => {
                          const newVal = !settings.enableTabs;
                          setSettings({ ...settings, enableTabs: newVal });
                          if (!newVal) {
                            setOpenGames(selectedGame ? [selectedGame] : []);
                          }
                        }}
                        className={`w-12 h-7 rounded-full transition-colors relative ${settings.enableTabs ? 'bg-[var(--accent)]' : 'bg-[var(--bg-surface)]'}`}
                      >
                        <motion.div 
                          animate={{ x: settings.enableTabs ? 22 : 2 }}
                          className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm" 
                        />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {openGames.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-[var(--fg-muted)]">
                        <Layout className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-sm">No active tabs</p>
                      </div>
                    ) : (
                      openGames.map((game) => (
                        <div 
                          key={game.Title}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                            selectedGame?.Title === game.Title 
                              ? 'bg-[var(--accent)]/10 border-[var(--accent)]' 
                              : 'bg-[var(--bg-card)] border-transparent'
                          }`}
                        >
                          <button 
                            onClick={() => {
                              setSelectedGame(game);
                              setIsPlayerOpen(true);
                            }}
                            className="flex-1 text-left flex items-center gap-3"
                          >
                            <img src={game.Icon} className="w-8 h-8 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                            <span className={`text-sm font-semibold truncate ${
                              selectedGame?.Title === game.Title ? 'text-[var(--accent)]' : 'text-[var(--fg)]'
                            }`}>
                              {game.Title}
                            </span>
                          </button>
                          <button 
                            onClick={() => closeTab(game.Title)}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-[var(--fg-muted)] hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-[var(--bg-card)] text-center">
                <p className="text-xs text-[var(--fg-muted)] font-medium">Scientific Calculator v2.0</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Update Log Overlay */}
      <AnimatePresence>
        {showUpdateLog && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[var(--bg-surface)]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
                  <History className="w-6 h-6 text-[var(--accent)]" />
                </div>
                <h2 className="text-2xl font-bold text-white">Update Log</h2>
              </div>
              <button 
                onClick={() => setShowUpdateLog(false)}
                className="p-2 bg-[var(--bg-card)] hover:bg-[var(--accent)] hover:text-white rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-12 max-w-4xl mx-auto w-full">
              {updateLogs.map((log) => (
                <div key={log.version} className="mb-12">
                  <div className="flex items-baseline gap-4 mb-8">
                    <h3 className="text-4xl font-bold text-[var(--accent)]">v{log.version}</h3>
                    <span className="text-sm font-medium text-[var(--fg-muted)] bg-[var(--bg-card)] px-3 py-1 rounded-full">{log.date}</span>
                  </div>
                  
                  <div className="grid gap-8">
                    {log.sections.map((section, idx) => (
                      <div key={idx} className="bg-[var(--bg-surface)] rounded-3xl p-6 md:p-8">
                        <h4 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                          <div className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                          {section.title}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {section.changes?.map((change, i) => (
                            <div key={i} className="flex items-center gap-3 text-sm font-medium text-[var(--fg)]/80">
                              <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                              {change}
                            </div>
                          ))}
                          {section.games?.map((gameName, i) => {
                            const game = games.find(g => g.Title.toLowerCase() === gameName.toLowerCase() || g.Title.toLowerCase().includes(gameName.toLowerCase()));
                            return (
                              <button 
                                key={i} 
                                onClick={() => {
                                  if (game) {
                                    handleGameSelect(game);
                                    setShowUpdateLog(false);
                                  }
                                }}
                                className="flex items-center gap-3 text-sm font-medium text-[var(--fg)]/80 hover:text-[var(--accent)] transition-colors text-left group p-2 rounded-xl hover:bg-[var(--bg-card)]"
                              >
                                {game ? (
                                  <img src={game.Icon} className="w-6 h-6 rounded-md object-cover" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-6 h-6 rounded-md bg-[var(--bg-card)]" />
                                )}
                                <span>{gameName}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-6 border-t border-white/5 text-center text-sm text-[var(--fg-muted)]">
              Scientific Calculator &copy; {new Date().getFullYear()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
