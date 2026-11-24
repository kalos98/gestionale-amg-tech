import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AppDatabase,
  AuthUserProfile,
  Equipment,
  EquipmentLog,
  MaterialLog,
  PhotoLog,
  Site,
  SiteStatus,
  TimeEntry,
  UserRole,
  WorkerType,
  WorkPhase,
} from '../types/models';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { ConcurrencyConflictError, toFriendlyErrorMessage } from '../services/apiErrors';
import { EMPTY_DATABASE, databaseService } from '../services/databaseService';
import {
  USERNAME_PATTERN,
  normalizeLoginUsername,
  usernameToInternalEmail,
} from '../utils/username';
import { nextSequentialCode } from '../utils/formatters';

export interface AppNotification {
  id: number;
  type: 'error' | 'warning' | 'success';
  message: string;
}

interface AppContextType {
  authLoading: boolean;
  dataLoading: boolean;
  currentUser: AuthUserProfile | null;
  db: AppDatabase;
  notification: AppNotification | null;
  dismissNotification: () => void;
  notify: (type: AppNotification['type'], message: string) => void;
  // Auth
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  changeOwnPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  completeOwnOnboarding: () => Promise<void>;
  refreshDatabase: () => Promise<void>;
  // Atomic sequential codes
  getNextSiteCode: () => Promise<string>;
  getNextEquipmentCode: () => Promise<string>;
  // Sites & Phases
  addSite: (
    site: Omit<Site, 'id' | 'progress' | 'assignedWorkerIds' | 'version'>
  ) => Promise<Site>;
  updateSite: (site: Site) => Promise<void>;
  updateSiteStatus: (
    siteId: string,
    status: SiteStatus,
    progress?: number
  ) => Promise<void>;
  setWorkerSiteAssignment: (
    siteId: string,
    workerId: string,
    assign: boolean
  ) => Promise<void>;
  deleteSite: (siteId: string) => Promise<void>;
  addPhase: (phase: Omit<WorkPhase, 'id' | 'version'>) => Promise<void>;
  updatePhase: (phase: WorkPhase) => Promise<void>;
  deletePhase: (phaseId: string) => Promise<void>;
  // Account provisioning (Admins & Workers)
  createUserAccount: (params: {
    firstName: string;
    lastName: string;
    role: UserRole;
    workerType?: WorkerType;
    password: string;
    customUsername?: string;
  }) => Promise<{ username: string; name: string }>;
  updateUserAccount: (params: {
    userId: string;
    firstName: string;
    lastName: string;
    workerType?: WorkerType;
    expectedVersion: number;
  }) => Promise<void>;
  resetUserPassword: (userId: string, newPassword: string) => Promise<void>;
  setUserActive: (
    userId: string,
    active: boolean,
    expectedVersion: number
  ) => Promise<void>;
  // Equipment & logs
  addNewEquipment: (
    eq: Omit<Equipment, 'id' | 'version'>
  ) => Promise<Equipment>;
  updateEquipment: (eq: Equipment) => Promise<void>;
  toggleEquipmentMaintenance: (equipmentId: string) => Promise<void>;
  deleteEquipment: (equipmentId: string) => Promise<void>;
  addEquipmentUsageLog: (params: {
    equipmentId: string;
    equipmentName?: string;
    siteId: string;
    actorId?: string;
    actorName: string;
    actorRole: 'Admin' | 'Dipendente';
    hoursUsed?: number;
    timestamp?: string;
    notes?: string;
    clientRequestId?: string;
  }) => Promise<void>;
  updateEquipmentLog: (log: EquipmentLog) => Promise<void>;
  deleteEquipmentLog: (id: string) => Promise<void>;
  // Field logs
  addTimeEntry: (
    entry: Omit<TimeEntry, 'id' | 'createdAt' | 'version'> & {
      clientRequestId?: string;
    }
  ) => Promise<void>;
  updateTimeEntry: (entry: TimeEntry) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;
  addMaterialLog: (
    log: Omit<MaterialLog, 'id' | 'createdAt' | 'version'> & {
      clientRequestId?: string;
    }
  ) => Promise<void>;
  updateMaterialLog: (log: MaterialLog) => Promise<void>;
  deleteMaterialLog: (id: string) => Promise<void>;
  addPhotoLogs: (
    photos: Array<{
      siteId: string;
      phaseId: string;
      workerId: string;
      workerName: string;
      uploaderRole: UserRole;
      date: string;
      blob: Blob;
      caption: string;
      tag: PhotoLog['tag'];
    }>
  ) => Promise<void>;
  updatePhotoLog: (params: {
    photo: PhotoLog;
    newBlob?: Blob;
  }) => Promise<void>;
  deletePhotoLog: (photoId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthUserProfile | null>(null);
  const [db, setDb] = useState<AppDatabase>(EMPTY_DATABASE);
  const [notification, setNotification] = useState<AppNotification | null>(null);

  const currentUserRef = useRef<AuthUserProfile | null>(null);
  const isSigningInRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<number | null>(null);
  const activeRefreshPromiseRef = useRef<Promise<void> | null>(null);
  const notificationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const dismissNotification = useCallback(() => {
    if (notificationTimerRef.current !== null) {
      window.clearTimeout(notificationTimerRef.current);
      notificationTimerRef.current = null;
    }
    setNotification(null);
  }, []);

  const notify = useCallback(
    (type: AppNotification['type'], message: string) => {
      if (notificationTimerRef.current !== null) {
        window.clearTimeout(notificationTimerRef.current);
      }
      setNotification({ id: Date.now(), type, message });
      notificationTimerRef.current = window.setTimeout(() => {
        setNotification(null);
        notificationTimerRef.current = null;
      }, 6500);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current !== null) {
        window.clearTimeout(notificationTimerRef.current);
      }
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const refreshDatabase = useCallback(async () => {
    if (!supabase || !currentUserRef.current) return;
    if (activeRefreshPromiseRef.current) {
      return activeRefreshPromiseRef.current;
    }

    const run = async () => {
      const userId = currentUserRef.current?.id;
      if (!userId || !supabase) return;
      const profile = await databaseService.fetchCurrentProfile(userId);
      if (!profile || !profile.active) {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setDb(EMPTY_DATABASE);
        notify('error', "Account disattivato dall'amministratore.");
        return;
      }
      setCurrentUser(profile);
      const snapshot = await databaseService.fetchDatabaseSnapshot(profile);
      setDb(snapshot);
    };

    const promise = run().finally(() => {
      activeRefreshPromiseRef.current = null;
    });
    activeRefreshPromiseRef.current = promise;
    return promise;
  }, [notify]);

  const scheduleRefresh = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      refreshDatabase().catch(() => {
        // Errori transitori di sync in background ignorati silenziosamente
      });
    }, 300);
  }, [refreshDatabase]);

  // Initial session hydration & auth listener
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    const hydrateSessionUser = async (userId: string) => {
      try {
        const profile = await databaseService.fetchCurrentProfile(userId);
        if (!mounted) return;
        if (!profile || !profile.active) {
          await supabase?.auth.signOut();
          if (!mounted) return;
          setCurrentUser(null);
          setDb(EMPTY_DATABASE);
          notify('error', "Account disattivato dall'amministratore.");
          return;
        }
        setCurrentUser(profile);
        setDataLoading(true);
        const snapshot = await databaseService.fetchDatabaseSnapshot(profile);
        if (!mounted) return;
        setDb(snapshot);
      } catch (err) {
        if (!mounted) return;
        notify('error', toFriendlyErrorMessage(err));
      } finally {
        if (mounted) {
          setAuthLoading(false);
          setDataLoading(false);
        }
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        if (data.session?.user?.id) {
          void hydrateSessionUser(data.session.user.id);
        } else {
          setAuthLoading(false);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        notify('error', toFriendlyErrorMessage(err));
        setAuthLoading(false);
      });

    const { data: authSub } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setDb(EMPTY_DATABASE);
          setAuthLoading(false);
          setDataLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' && session?.user?.id) {
          if (isSigningInRef.current) return;
          if (currentUserRef.current?.id !== session.user.id) {
            void hydrateSessionUser(session.user.id);
          }
        }
      }
    );

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, [notify]);

  // Realtime sync across concurrent admins and field workers + focus/online refetch
  useEffect(() => {
    if (!supabase || !currentUser?.id) return;

    const client = supabase;
    const channel = client.channel('amg-tech-realtime-sync');
    const tables = [
      'sites',
      'site_workers',
      'work_phases',
      'equipment',
      'time_entries',
      'material_logs',
      'equipment_logs',
      'photo_logs',
      'profiles',
    ];

    tables.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          scheduleRefresh();
        }
      );
    });

    channel.subscribe();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh();
      }
    };
    const handleOnline = () => {
      scheduleRefresh();
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleOnline);
      void client.removeChannel(channel);
    };
  }, [currentUser?.id, scheduleRefresh]);

  const runMutation = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      options?: { notifyError?: boolean; refresh?: boolean }
    ): Promise<T> => {
      try {
        const result = await fn();
        if (options?.refresh !== false) {
          await refreshDatabase();
        }
        return result;
      } catch (err) {
        if (err instanceof ConcurrencyConflictError) {
          await refreshDatabase().catch(() => {});
          notify('warning', err.message);
        } else if (options?.notifyError !== false) {
          notify('error', toFriendlyErrorMessage(err));
        }
        throw err;
      }
    },
    [notify, refreshDatabase]
  );

  // Auth actions
  const signIn = async (username: string, password: string): Promise<void> => {
    if (!supabase) {
      throw new Error('Configurazione backend Supabase mancante.');
    }

    const cleanUsername = normalizeLoginUsername(username);
    if (!cleanUsername || !USERNAME_PATTERN.test(cleanUsername)) {
      throw new Error(
        'Inserisci uno username valido (es. nome.cognome, amministratore o dipendente).'
      );
    }
    if (!password) {
      throw new Error('Inserisci la password.');
    }

    const internalEmail = usernameToInternalEmail(cleanUsername);
    isSigningInRef.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

      if (error || !data.user) {
        const msg = (error?.message || '').toLowerCase();
        if (msg.includes('banned')) {
          throw new Error(
            "Questo account è stato disattivato dall'amministratore."
          );
        }
        if (msg.includes('invalid login credentials')) {
          throw new Error('Username o password non corretti.');
        }
        throw new Error(error?.message || 'Accesso non riuscito.');
      }

      const profile = await databaseService.fetchCurrentProfile(data.user.id);
      if (!profile || !profile.active) {
        await supabase.auth.signOut();
        throw new Error(
          "Questo account è stato disattivato dall'amministratore."
        );
      }

      setCurrentUser(profile);
      setDataLoading(true);
      const snapshot = await databaseService.fetchDatabaseSnapshot(profile);
      setDb(snapshot);
    } finally {
      isSigningInRef.current = false;
      setDataLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setCurrentUser(null);
    setDb(EMPTY_DATABASE);
    dismissNotification();
  };

  const changeOwnPassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<void> => {
    if (!supabase || !currentUser) {
      throw new Error('Utente non autenticato.');
    }
    if (newPassword.length < 8) {
      throw new Error('La nuova password deve contenere almeno 8 caratteri.');
    }

    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: usernameToInternalEmail(currentUser.username),
      password: currentPassword,
    });

    if (verifyErr) {
      throw new Error('La password attuale non è corretta.');
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateErr) {
      throw new Error(updateErr.message || 'Errore aggiornamento password.');
    }
    notify('success', 'Password aggiornata con successo.');
  };

  const completeOwnOnboarding = async (): Promise<void> => {
    if (!currentUser || currentUser.onboardingCompletedAt) return;
    const optimisticTimestamp = new Date().toISOString();
    setCurrentUser((prev) =>
      prev ? { ...prev, onboardingCompletedAt: optimisticTimestamp } : prev
    );
    try {
      const persistedTimestamp = await databaseService.completeOwnOnboarding();
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              onboardingCompletedAt:
                persistedTimestamp || prev.onboardingCompletedAt,
            }
          : prev
      );
    } catch {
      // Mantiene lo stato ottimistico locale in caso di disconnessione temporanea
    }
  };

  // Sequential code helpers
  const getNextSiteCode = async (): Promise<string> => {
    try {
      return await databaseService.fetchNextSiteCode(new Date().getFullYear());
    } catch {
      const year = new Date().getFullYear();
      return nextSequentialCode(
        db.sites.map((s) => s.code),
        `CNT-${year}-`,
        2
      );
    }
  };

  const getNextEquipmentCode = async (): Promise<string> => {
    try {
      return await databaseService.fetchNextEquipmentCode();
    } catch {
      return nextSequentialCode(
        db.equipment.map((e) => e.code),
        'MEZ-',
        2
      );
    }
  };

  // Sites & Phases
  const addSite = async (
    siteData: Omit<Site, 'id' | 'progress' | 'assignedWorkerIds' | 'version'>
  ): Promise<Site> => {
    return runMutation(() => databaseService.createSite(siteData), {
      notifyError: false,
    });
  };

  const updateSite = async (updatedSite: Site): Promise<void> => {
    await runMutation(() => databaseService.updateSite(updatedSite), {
      notifyError: false,
    });
  };

  const updateSiteStatus = async (
    siteId: string,
    status: SiteStatus,
    progress?: number
  ): Promise<void> => {
    const target = db.sites.find((s) => s.id === siteId);
    if (!target) return;
    await runMutation(() =>
      databaseService.updateSiteStatus(target, status, progress)
    );
  };

  const setWorkerSiteAssignment = async (
    siteId: string,
    workerId: string,
    assign: boolean
  ): Promise<void> => {
    const actorId = currentUser?.id;
    if (!actorId) return;
    await runMutation(() =>
      databaseService.setWorkerSiteAssignment(siteId, workerId, assign, actorId)
    );
  };

  const deleteSite = async (siteId: string): Promise<void> => {
    const target = db.sites.find((s) => s.id === siteId);
    if (!target) return;
    await runMutation(() => databaseService.deleteSite(siteId, target.version));
  };

  const addPhase = async (
    phaseData: Omit<WorkPhase, 'id' | 'version'>
  ): Promise<void> => {
    await runMutation(() => databaseService.createPhase(phaseData), {
      notifyError: false,
    });
  };

  const updatePhase = async (updatedPhase: WorkPhase): Promise<void> => {
    const isWorker = currentUser?.role === 'worker';
    await runMutation(() => databaseService.updatePhase(updatedPhase, isWorker));
  };

  const deletePhase = async (phaseId: string): Promise<void> => {
    const target = db.phases.find((p) => p.id === phaseId);
    if (!target) return;
    await runMutation(() =>
      databaseService.deletePhase(phaseId, target.version)
    );
  };

  // Account management (Admin only)
  const createUserAccount = async (params: {
    firstName: string;
    lastName: string;
    role: UserRole;
    workerType?: WorkerType;
    password: string;
    customUsername?: string;
  }) => {
    return runMutation(() => databaseService.createUserAccount(params), {
      notifyError: false,
    });
  };

  const updateUserAccount = async (params: {
    userId: string;
    firstName: string;
    lastName: string;
    workerType?: WorkerType;
    expectedVersion: number;
  }) => {
    await runMutation(() => databaseService.updateUserAccount(params), {
      notifyError: false,
    });
    notify('success', 'Anagrafica account aggiornata.');
  };

  const resetUserPassword = async (userId: string, newPassword: string) => {
    await runMutation(
      () => databaseService.resetUserPassword(userId, newPassword),
      { notifyError: false, refresh: false }
    );
    notify('success', 'Password reimpostata con successo.');
  };

  const setUserActive = async (
    userId: string,
    active: boolean,
    expectedVersion: number
  ) => {
    await runMutation(() =>
      databaseService.setUserActive(userId, active, expectedVersion)
    );
    notify(
      'success',
      active ? 'Account riattivato con successo.' : 'Account disattivato.'
    );
  };

  // Equipment & usage logs
  const addNewEquipment = async (
    eqData: Omit<Equipment, 'id' | 'version'>
  ): Promise<Equipment> => {
    return runMutation(() => databaseService.createEquipment(eqData), {
      notifyError: false,
    });
  };

  const updateEquipment = async (updatedEq: Equipment): Promise<void> => {
    await runMutation(() => databaseService.updateEquipment(updatedEq), {
      notifyError: false,
    });
  };

  const toggleEquipmentMaintenance = async (
    equipmentId: string
  ): Promise<void> => {
    const target = db.equipment.find((e) => e.id === equipmentId);
    if (!target) return;
    await runMutation(() =>
      databaseService.updateEquipment({
        ...target,
        status:
          target.status === 'In Manutenzione'
            ? 'Disponibile'
            : 'In Manutenzione',
      })
    );
  };

  const deleteEquipment = async (equipmentId: string): Promise<void> => {
    const target = db.equipment.find((e) => e.id === equipmentId);
    if (!target) return;
    await runMutation(() =>
      databaseService.deleteEquipment(equipmentId, target.version)
    );
  };

  const addEquipmentUsageLog = async (params: {
    equipmentId: string;
    equipmentName?: string;
    siteId: string;
    actorId?: string;
    actorName: string;
    actorRole: 'Admin' | 'Dipendente';
    hoursUsed?: number;
    timestamp?: string;
    notes?: string;
    clientRequestId?: string;
  }): Promise<void> => {
    const targetEq = db.equipment.find((e) => e.id === params.equipmentId);
    const resolvedName = params.equipmentName || targetEq?.name || '';
    if (!resolvedName) {
      throw new Error('Mezzo selezionato non valido.');
    }
    await runMutation(
      () =>
        databaseService.createEquipmentUsageLog({
          ...params,
          equipmentName: resolvedName,
        }),
      { notifyError: false }
    );
  };

  const updateEquipmentLog = async (
    updatedLog: EquipmentLog
  ): Promise<void> => {
    const isWorker = currentUser?.role === 'worker';
    await runMutation(
      () => databaseService.updateEquipmentLog(updatedLog, isWorker),
      { notifyError: false }
    );
  };

  const deleteEquipmentLog = async (id: string): Promise<void> => {
    const target = db.equipmentLogs.find((l) => l.id === id);
    await runMutation(() =>
      databaseService.deleteEquipmentLog(id, target?.version)
    );
  };

  // Time entries
  const addTimeEntry = async (
    entry: Omit<TimeEntry, 'id' | 'createdAt' | 'version'> & {
      clientRequestId?: string;
    }
  ): Promise<void> => {
    await runMutation(() => databaseService.createTimeEntry(entry), {
      notifyError: false,
    });
  };

  const updateTimeEntry = async (updatedEntry: TimeEntry): Promise<void> => {
    await runMutation(() => databaseService.updateTimeEntry(updatedEntry), {
      notifyError: false,
    });
  };

  const deleteTimeEntry = async (id: string): Promise<void> => {
    const target = db.timeEntries.find((t) => t.id === id);
    await runMutation(() =>
      databaseService.deleteTimeEntry(id, target?.version)
    );
  };

  // Materials
  const addMaterialLog = async (
    log: Omit<MaterialLog, 'id' | 'createdAt' | 'version'> & {
      clientRequestId?: string;
    }
  ): Promise<void> => {
    await runMutation(() => databaseService.createMaterialLog(log), {
      notifyError: false,
    });
  };

  const updateMaterialLog = async (updatedLog: MaterialLog): Promise<void> => {
    const isWorker = currentUser?.role === 'worker';
    await runMutation(
      () => databaseService.updateMaterialLog(updatedLog, isWorker),
      { notifyError: false }
    );
  };

  const deleteMaterialLog = async (id: string): Promise<void> => {
    const target = db.materialLogs.find((m) => m.id === id);
    await runMutation(() =>
      databaseService.deleteMaterialLog(id, target?.version)
    );
  };

  // Photos
  const addPhotoLogs = async (
    photos: Array<{
      siteId: string;
      phaseId: string;
      workerId: string;
      workerName: string;
      uploaderRole: UserRole;
      date: string;
      blob: Blob;
      caption: string;
      tag: PhotoLog['tag'];
    }>
  ): Promise<void> => {
    await runMutation(() => databaseService.createPhotoLogs(photos), {
      notifyError: false,
    });
  };

  const updatePhotoLog = async (params: {
    photo: PhotoLog;
    newBlob?: Blob;
  }): Promise<void> => {
    const actorId = currentUser?.id;
    if (!actorId) return;
    await runMutation(
      () =>
        databaseService.updatePhotoLog({
          photo: params.photo,
          newBlob: params.newBlob,
          actorId,
        }),
      { notifyError: false }
    );
  };

  const deletePhotoLog = async (photoId: string): Promise<void> => {
    const target = db.photoLogs.find((p) => p.id === photoId);
    await runMutation(() =>
      databaseService.deletePhotoLog(photoId, target?.version)
    );
  };

  return (
    <AppContext.Provider
      value={{
        authLoading,
        dataLoading,
        currentUser,
        db,
        notification,
        dismissNotification,
        notify,
        signIn,
        signOut,
        changeOwnPassword,
        completeOwnOnboarding,
        refreshDatabase,
        getNextSiteCode,
        getNextEquipmentCode,
        addSite,
        updateSite,
        updateSiteStatus,
        setWorkerSiteAssignment,
        deleteSite,
        addPhase,
        updatePhase,
        deletePhase,
        createUserAccount,
        updateUserAccount,
        resetUserPassword,
        setUserActive,
        addNewEquipment,
        updateEquipment,
        toggleEquipmentMaintenance,
        deleteEquipment,
        addEquipmentUsageLog,
        updateEquipmentLog,
        deleteEquipmentLog,
        addTimeEntry,
        updateTimeEntry,
        deleteTimeEntry,
        addMaterialLog,
        updateMaterialLog,
        deleteMaterialLog,
        addPhotoLogs,
        updatePhotoLog,
        deletePhotoLog,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
