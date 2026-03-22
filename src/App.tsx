import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  deleteDoc, 
  doc,
  setDoc,
  User
} from './firebase';
import { 
  Clipboard, 
  Send, 
  Trash2, 
  LogOut, 
  Smartphone, 
  Monitor, 
  Copy, 
  Check,
  Plus,
  Link2,
  Settings as SettingsIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Error handling as required by guidelines
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't throw here to avoid crashing the UI, but we log it.
}

interface Message {
  id: string;
  text: string;
  authorUid: string;
  createdAt: any;
  deviceType: 'pc' | 'mobile' | 'unknown';
}

interface UserSettings {
  bgType: 'default' | 'image' | 'video';
  bgUrl?: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>({ bgType: 'default' });
  const [showSettings, setShowSettings] = useState(false);
  const [bgInput, setBgInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Settings listener
  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/settings/current`;
    const unsubscribe = onSnapshot(doc(db, path), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as UserSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return () => unsubscribe();
  }, [user]);

  // Messages listener
  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }

    const path = `users/${user.uid}/messages`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-scroll to top (since we show newest first)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [messages]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !user) return;

    const deviceType = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      ? 'mobile' 
      : 'pc';

    const path = `users/${user.uid}/messages`;
    try {
      await addDoc(collection(db, path), {
        text: inputText.trim(),
        authorUid: user.uid,
        createdAt: serverTimestamp(),
        deviceType
      });
      setInputText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!user) return;
    const path = `users/${user.uid}/messages/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    const path = `users/${user.uid}/settings/current`;
    try {
      await setDoc(doc(db, path), { ...settings, ...newSettings });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0502] flex items-center justify-center">
        <div className="animate-pulse text-white/50 font-light tracking-widest uppercase text-xs">
          Initialising...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white/30 overflow-hidden relative">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {settings.bgType === 'default' && (
          <iframe 
            src="https://player.vimeo.com/video/1175849931?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&muted=1&loop=1&background=1" 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-[177.77777778vh] h-[56.25vw] border-0 opacity-100"
            allow="autoplay; fullscreen; picture-in-picture" 
            title="Background Video"
          />
        )}
        
        {settings.bgType === 'image' && settings.bgUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-100"
            style={{ backgroundImage: `url(${settings.bgUrl})` }}
          />
        )}

        {settings.bgType === 'video' && settings.bgUrl && (
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-100"
          >
            <source src={settings.bgUrl} type="video/mp4" />
          </video>
        )}
      </div>

      <div className="relative z-10 max-w-2xl mx-auto h-screen flex flex-col p-4 md:p-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 p-4 rounded-[2rem] bg-white/10 backdrop-blur-2xl border border-white/20 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shadow-inner">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">LinkDrop</h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold">Cross-Device Sync</p>
            </div>
          </div>
          
          {user && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2.5 rounded-full hover:bg-white/20 transition-all text-white/60 hover:text-white active:scale-90"
                title="Settings"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
              <button 
                onClick={handleLogout}
                className="p-2.5 rounded-full hover:bg-white/20 transition-all text-white/60 hover:text-white active:scale-90"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </header>

        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-sm p-10 rounded-[3rem] bg-white/10 backdrop-blur-3xl border border-white/20 shadow-2xl"
            >
              <h2 className="text-4xl font-light mb-6 leading-tight text-white">Your digital bridge across devices.</h2>
              <p className="text-white/60 text-base mb-10 font-light leading-relaxed">
                Sign in to instantly share text, links, and snippets between your PC and phone.
              </p>
              <button 
                onClick={handleLogin}
                className="w-full py-4 px-6 rounded-2xl bg-white text-black font-semibold hover:bg-white/90 transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl shadow-white/10"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" referrerPolicy="no-referrer" />
                Continue with Google
              </button>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Input Area */}
            <div className="mb-8">
              <form 
                onSubmit={sendMessage}
                className="relative group"
              >
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste text or type a message..."
                  className="w-full h-36 p-6 rounded-[2.5rem] bg-white/10 border border-white/20 focus:border-white/40 focus:bg-white/15 outline-none transition-all resize-none text-white placeholder:text-white/30 font-light leading-relaxed backdrop-blur-3xl shadow-2xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <div className="absolute bottom-5 right-5 flex items-center gap-3">
                  <span className="text-[10px] text-white/30 font-mono hidden md:block uppercase tracking-widest">Press Enter to send</span>
                  <button 
                    type="submit"
                    disabled={!inputText.trim()}
                    className="p-4 rounded-2xl bg-white text-black disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/20"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-5 px-4">
                <h3 className="text-[10px] uppercase tracking-[0.3em] text-white/60 font-black">Recent Drops</h3>
                <span className="text-[10px] text-white/40 font-mono bg-white/10 px-2 py-1 rounded-md backdrop-blur-sm">{messages.length} items</span>
              </div>
              
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto pr-2 space-y-5 custom-scrollbar"
              >
                <AnimatePresence initial={false}>
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 p-12 border border-dashed border-white/10 rounded-[3rem] bg-white/5 backdrop-blur-sm">
                      <Plus className="w-10 h-10 mb-4 opacity-30" />
                      <p className="text-base font-light italic">No drops yet. Send something!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        className="group relative p-6 rounded-[2rem] bg-white/10 border border-white/10 hover:bg-white/15 hover:border-white/30 transition-all backdrop-blur-2xl shadow-xl"
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-2.5 text-[10px] text-white/50 font-bold uppercase tracking-[0.15em]">
                            <div className="p-1.5 rounded-lg bg-white/10">
                              {msg.deviceType === 'pc' ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                            </div>
                            <span>{msg.deviceType}</span>
                            <span className="opacity-30">•</span>
                            <span>{msg.createdAt ? formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true }) : 'just now'}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                            <button 
                              onClick={() => copyToClipboard(msg.text, msg.id)}
                              className={cn(
                                "p-2.5 rounded-xl transition-all",
                                copiedId === msg.id ? "bg-emerald-500/30 text-emerald-300" : "hover:bg-white/20 text-white/50 hover:text-white"
                              )}
                              title="Copy to clipboard"
                            >
                              {copiedId === msg.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => deleteMessage(msg.id)}
                              className="p-2.5 rounded-xl hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-all"
                              title="Delete drop"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-base text-white font-light leading-relaxed break-words whitespace-pre-wrap selection:bg-white/40">
                          {msg.text}
                        </p>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSettings(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-[#121212] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-medium">Appearance</h2>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="p-2 rounded-full hover:bg-white/5 transition-colors text-white/40 hover:text-white/80"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold block mb-4">Background Type</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'default', label: 'Default', icon: Palette },
                        { id: 'image', label: 'Image', icon: ImageIcon },
                        { id: 'video', label: 'Video', icon: VideoIcon },
                      ].map((type) => (
                        <button
                          key={type.id}
                          onClick={() => updateSettings({ bgType: type.id as any })}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                            settings.bgType === type.id 
                              ? "bg-white/10 border-white/20 text-white" 
                              : "bg-white/5 border-transparent text-white/40 hover:bg-white/[0.07]"
                          )}
                        >
                          <type.icon className="w-5 h-5" />
                          <span className="text-[10px] font-medium uppercase tracking-wider">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {settings.bgType !== 'default' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3"
                    >
                      <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold block">
                        {settings.bgType === 'image' ? 'Image URL' : 'Video URL (MP4)'}
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={bgInput}
                          onChange={(e) => setBgInput(e.target.value)}
                          placeholder="https://..."
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/20 transition-all font-light"
                        />
                        <button 
                          onClick={() => {
                            updateSettings({ bgUrl: bgInput });
                            setBgInput('');
                          }}
                          className="px-4 py-3 bg-white text-black rounded-xl text-xs font-medium hover:bg-white/90 transition-all"
                        >
                          Apply
                        </button>
                      </div>
                      <p className="text-[10px] text-white/20 italic">
                        {settings.bgType === 'image' 
                          ? "Try Unsplash or direct image links." 
                          : "Use direct .mp4 links from Pexels or similar."}
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-8 py-4 border-t border-white/5 flex items-center justify-between text-[10px] text-white/20 font-mono uppercase tracking-widest">
          <span>&copy; 2026 LinkDrop</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}} />
    </div>
  );
}
