import React, { useState } from 'react';
import { HardHat, HelpCircle, KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ChangePasswordModal } from './ChangePasswordModal';

interface AppHeaderProps {
  onOpenQuickStart: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ onOpenQuickStart }) => {
  const { currentUser, signOut } = useApp();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!currentUser) return null;

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <>
      <header className="sticky top-0 z-50 shrink-0 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 px-4 py-2.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <HardHat className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-sm sm:text-base text-white">
                Gestionale AMG Tech
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-400/25">
                Cantieri &amp; Squadre
              </span>
            </div>
          </div>

          {/* Authenticated User & Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1">
              <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-100 text-[10px] font-bold flex items-center justify-center shrink-0">
                {currentUser.avatarInitials}
              </div>
              <div className="leading-tight">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    {currentUser.name}
                  </span>
                  <span
                    className={`hidden md:inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                      isAdmin
                        ? 'bg-blue-500/15 text-blue-300 border-blue-400/30'
                        : 'bg-teal-500/15 text-teal-300 border-teal-400/30'
                    }`}
                  >
                    {isAdmin && <ShieldCheck className="w-2.5 h-2.5" />}
                    {isAdmin
                      ? 'Amministratore'
                      : `Dipendente • ${currentUser.workerType || 'Edilizia'}`}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  @{currentUser.username}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenQuickStart}
              title="Apri guida rapida interattiva"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/35 text-blue-200 hover:text-white border border-blue-400/30 text-xs font-medium transition"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-300" />
              <span className="hidden sm:inline">Guida</span>
            </button>

            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              title="Cambia la tua password"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-medium transition"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">Password</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Esci dall'applicazione"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-600/90 text-slate-200 hover:text-white border border-slate-700/80 hover:border-red-500 text-xs font-medium transition disabled:opacity-60"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </>
  );
};
