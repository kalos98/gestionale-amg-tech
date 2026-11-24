import React, { useState } from 'react';
import { Eye, EyeOff, HardHat, Lock, LogIn, ShieldCheck, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toFriendlyErrorMessage } from '../services/apiErrors';

export const LoginPage: React.FC = () => {
  const { signIn } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await signIn(username, password);
    } catch (err) {
      setErrorMessage(toFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
        <div className="bg-slate-900 px-6 py-6 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <HardHat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                Gestionale AMG Tech
              </h1>
              <p className="text-xs text-slate-400">
                Portale Aziendale Cantieri e Squadre
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Accesso riservato al personale <strong>AMG Tech</strong> con credenziali personali.
            </span>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-800"
            >
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="login-username"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-username"
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="nome.cognome"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Usa il tuo username aziendale (es. <span className="font-mono">nome.cognome</span>).
            </p>
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="Inserisci la password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                className="p-1.5 text-slate-400 hover:text-slate-700 absolute right-2 top-1/2 -translate-y-1/2 rounded-lg"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>{isSubmitting ? 'Accesso in corso...' : 'Accedi'}</span>
          </button>

          <p className="text-[11px] text-center text-slate-400 pt-2 border-t border-slate-100">
            Nuovi utenti possono essere abilitati esclusivamente dall&apos;interno da un Amministratore.
          </p>
        </form>
      </div>
    </div>
  );
};
