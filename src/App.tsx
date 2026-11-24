import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardHat,
  X,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { AppHeader } from './components/AppHeader';
import { LoginPage } from './components/LoginPage';
import { QuickStartGuide } from './components/QuickStartGuide';
import { AdminTab, AdminView } from './components/admin/AdminView';
import {
  WorkerMobileView,
  WorkerNavTab,
} from './components/worker/WorkerMobileView';

const ConfigurationMissingScreen: React.FC = () => (
  <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
    <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">
            Configurazione Backend Richiesta
          </h1>
          <p className="text-xs text-slate-400">Gestionale AMG Tech</p>
        </div>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">
        Le variabili ambiente del database non sono configurate. Imposta{' '}
        <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
          VITE_SUPABASE_URL
        </code>{' '}
        e{' '}
        <code className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
          VITE_SUPABASE_ANON_KEY
        </code>{' '}
        nel file <code className="text-slate-200">.env</code> (vedi{' '}
        <code className="text-slate-200">.env.example</code> e{' '}
        <code className="text-slate-200">docs/DEPLOY_AND_OPERATIONS.md</code>).
      </p>
    </div>
  </div>
);

const NotificationBanner: React.FC = () => {
  const { notification, dismissNotification } = useApp();
  if (!notification) return null;

  const styleMap = {
    error: 'bg-red-600 text-white border-red-700',
    warning: 'bg-amber-500 text-slate-950 border-amber-600',
    success: 'bg-emerald-600 text-white border-emerald-700',
  } as const;

  return (
    <div
      role="status"
      className={`border-b px-4 py-2.5 text-xs font-medium flex items-center justify-between gap-3 ${styleMap[notification.type]}`}
    >
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span className="leading-snug">{notification.message}</span>
        </div>
        <button
          type="button"
          onClick={dismissNotification}
          aria-label="Chiudi notifica"
          className="p-1 rounded-lg hover:bg-black/15 shrink-0 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const MainShell: React.FC = () => {
  const { authLoading, dataLoading, currentUser, completeOwnOnboarding } =
    useApp();

  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [quickStartMinimized, setQuickStartMinimized] = useState(false);
  const [quickStartStep, setQuickStartStep] = useState(0);
  const [adminTabRequest, setAdminTabRequest] = useState<{
    tab: AdminTab;
    nonce: number;
  } | null>(null);
  const [workerTabRequest, setWorkerTabRequest] = useState<{
    tab: WorkerNavTab;
    nonce: number;
  } | null>(null);
  const hasAutoOpenedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      hasAutoOpenedForUserRef.current = null;
      setQuickStartOpen(false);
      setQuickStartMinimized(false);
      setQuickStartStep(0);
      setAdminTabRequest(null);
      setWorkerTabRequest(null);
      return;
    }

    if (dataLoading) return;

    if (hasAutoOpenedForUserRef.current !== currentUser.id) {
      hasAutoOpenedForUserRef.current = currentUser.id;
      if (currentUser.onboardingCompletedAt === null) {
        setQuickStartStep(0);
        setQuickStartMinimized(false);
        setQuickStartOpen(true);
      }
    }
  }, [currentUser, dataLoading]);

  const handleOpenQuickStart = () => {
    setQuickStartStep(0);
    setQuickStartMinimized(false);
    setQuickStartOpen(true);
  };

  const handleCompleteQuickStart = () => {
    setQuickStartOpen(false);
    setQuickStartMinimized(false);
    void completeOwnOnboarding();
  };

  if (!isSupabaseConfigured) {
    return <ConfigurationMissingScreen />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3 p-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-400 animate-pulse">
          <HardHat className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-slate-300">
          Verifica sessione in corso...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div
      className={`${
        isAdmin ? 'min-h-screen lg:h-screen lg:overflow-hidden' : 'min-h-screen'
      } flex flex-col bg-slate-100 text-slate-900`}
    >
      <AppHeader onOpenQuickStart={handleOpenQuickStart} />
      <NotificationBanner />
      {dataLoading && (
        <div className="bg-blue-600/10 border-b border-blue-200 text-blue-900 px-4 py-1.5 text-xs font-medium text-center">
          Sincronizzazione dati aziendali in corso...
        </div>
      )}
      {isAdmin ? (
        <AdminView externalTabRequest={adminTabRequest} />
      ) : (
        <WorkerMobileView externalTabRequest={workerTabRequest} />
      )}

      <QuickStartGuide
        isOpen={quickStartOpen}
        isMinimized={quickStartMinimized}
        stepIndex={quickStartStep}
        onStepChange={setQuickStartStep}
        onMinimize={() => setQuickStartMinimized(true)}
        onResume={() => setQuickStartMinimized(false)}
        onCompleteAndClose={handleCompleteQuickStart}
        onNavigateAdminTab={(tab) =>
          setAdminTabRequest((prev) => ({
            tab,
            nonce: (prev?.nonce || 0) + 1,
          }))
        }
        onNavigateWorkerTab={(tab) =>
          setWorkerTabRequest((prev) => ({
            tab,
            nonce: (prev?.nonce || 0) + 1,
          }))
        }
      />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}

export default App;
