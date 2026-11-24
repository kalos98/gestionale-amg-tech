import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  KeyRound,
  RefreshCw,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { Worker, WorkerType } from '../../types/models';
import { WORKER_TYPES } from '../../constants/domain';
import {
  buildUsername,
  generateTemporaryPassword,
  normalizeLoginUsername,
} from '../../utils/username';
import { toFriendlyErrorMessage } from '../../services/apiErrors';
import { Pagination, paginate } from '../Pagination';
import {
  ResetPasswordModal,
  ResetPasswordTarget,
} from '../ui/ResetPasswordModal';

type AccountStatusFilter = 'active' | 'inactive' | 'all';

interface WorkersTabProps {
  workers: Worker[];
  workerTypeFilter: 'Tutti' | WorkerType;
  onFilterChange: (val: 'Tutti' | WorkerType) => void;
  onCreateWorker: (params: {
    firstName: string;
    lastName: string;
    workerType: WorkerType;
    password: string;
    customUsername?: string;
  }) => Promise<{ username: string; name: string }>;
  onUpdateWorker: (params: {
    userId: string;
    firstName: string;
    lastName: string;
    workerType: WorkerType;
    expectedVersion: number;
  }) => Promise<void>;
  onResetPassword: (userId: string, newPassword: string) => Promise<void>;
  onSetWorkerActive: (
    userId: string,
    active: boolean,
    expectedVersion: number
  ) => Promise<void>;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

export const WorkersTab: React.FC<WorkersTabProps> = ({
  workers,
  workerTypeFilter,
  onFilterChange,
  onCreateWorker,
  onUpdateWorker,
  onResetPassword,
  onSetWorkerActive,
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
}) => {
  const [statusFilter, setStatusFilter] =
    useState<AccountStatusFilter>('active');

  // Form creazione nuovo dipendente
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [workerType, setWorkerType] = useState<WorkerType>('Edilizia');
  const [customUsername, setCustomUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [initialPassword, setInitialPassword] = useState(() =>
    generateTemporaryPassword()
  );
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    username: string;
    password: string;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Modifica inline
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editType, setEditType] = useState<WorkerType>('Edilizia');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Reset password & disattivazione
  const [resetTarget, setResetTarget] = useState<ResetPasswordTarget | null>(
    null
  );
  const [confirmToggleId, setConfirmToggleId] = useState<string | null>(null);

  const generatedUsername = buildUsername(firstName, lastName);
  const displayedUsername = usernameTouched
    ? customUsername
    : generatedUsername;

  const filteredWorkers = useMemo(() => {
    return workers.filter((w) => {
      const matchesType =
        workerTypeFilter === 'Tutti' || w.type === workerTypeFilter;
      const matchesStatus =
        statusFilter === 'active'
          ? w.active
          : statusFilter === 'inactive'
          ? !w.active
          : true;
      return matchesType && matchesStatus;
    });
  }, [workers, workerTypeFilter, statusFilter]);

  useEffect(() => {
    onPageChange(1);
    setEditingWorkerId(null);
    setConfirmToggleId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    setEditingWorkerId(null);
    setConfirmToggleId(null);
  }, [workerTypeFilter, page]);

  const { items: pagedWorkers, safePage } = paginate(
    filteredWorkers,
    page,
    pageSize
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    if (!firstName.trim() || !lastName.trim()) {
      setCreateError('Nome e Cognome sono obbligatori.');
      return;
    }
    if (initialPassword.length < 8) {
      setCreateError('La password iniziale deve contenere almeno 8 caratteri.');
      return;
    }

    setCreateError(null);
    setIsCreating(true);
    try {
      const normalizedCustom = usernameTouched
        ? normalizeLoginUsername(customUsername)
        : undefined;
      const created = await onCreateWorker({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        workerType,
        password: initialPassword,
        customUsername: normalizedCustom || undefined,
      });

      setCreatedCredentials({
        name: created.name,
        username: created.username,
        password: initialPassword,
      });
      setCopiedCredentials(false);
      setFirstName('');
      setLastName('');
      setCustomUsername('');
      setUsernameTouched(false);
      setInitialPassword(generateTemporaryPassword());
    } catch (err) {
      setCreateError(toFriendlyErrorMessage(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCreatedCredentials = async () => {
    if (!createdCredentials) return;
    try {
      await navigator.clipboard.writeText(
        `Dipendente: ${createdCredentials.name}\nUsername: ${createdCredentials.username}\nPassword: ${createdCredentials.password}`
      );
      setCopiedCredentials(true);
      window.setTimeout(() => setCopiedCredentials(false), 2000);
    } catch {
      // Clipboard API non disponibile
    }
  };

  const startEdit = (worker: Worker) => {
    setEditingWorkerId(worker.id);
    setEditFirstName(worker.firstName);
    setEditLastName(worker.lastName);
    setEditType(worker.type);
    setEditError(null);
  };

  const saveEdit = async (worker: Worker) => {
    if (isSavingEdit) return;
    if (
      !editFirstName.trim() ||
      (worker.lastName !== '' && !editLastName.trim())
    ) {
      setEditError('Compila i campi obbligatori.');
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await onUpdateWorker({
        userId: worker.id,
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        workerType: editType,
        expectedVersion: worker.version,
      });
      setEditingWorkerId(null);
    } catch (err) {
      setEditError(toFriendlyErrorMessage(err));
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dipendenti
          </h1>
          <p className="text-sm text-slate-600">
            Gestione anagrafica e credenziali di accesso personale per il personale in cantiere.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {(['Tutti', ...WORKER_TYPES] as const).map((typeOpt) => (
              <button
                type="button"
                key={typeOpt}
                onClick={() => onFilterChange(typeOpt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  workerTypeFilter === typeOpt
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {typeOpt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {(
              [
                { id: 'active', label: 'Attivi' },
                { id: 'inactive', label: 'Disattivati' },
                { id: 'all', label: 'Tutti' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStatusFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  statusFilter === opt.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Box Credenziali Dipendente Appena Creato */}
      {createdCredentials && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="space-y-1 text-xs text-emerald-950">
            <div className="font-bold text-sm text-emerald-900">
              Account dipendente &quot;{createdCredentials.name}&quot; attivato
            </div>
            <p className="text-emerald-800">
              Username:{' '}
              <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200">
                {createdCredentials.username}
              </strong>{' '}
              • Password iniziale:{' '}
              <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200">
                {createdCredentials.password}
              </strong>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyCreatedCredentials}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
            >
              {copiedCredentials ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedCredentials ? 'Copiato' : 'Copia credenziali'}</span>
            </button>
            <button
              type="button"
              onClick={() => setCreatedCredentials(null)}
              aria-label="Chiudi avviso credenziali"
              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Form Aggiungi Nuovo Dipendente con Credenziali */}
      <form
        onSubmit={handleCreateSubmit}
        className="bg-white rounded-2xl p-5 border border-indigo-200/70 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <UserPlus className="w-4 h-4 text-indigo-600" />
          <span>Nuovo Dipendente</span>
        </div>

        {createError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-800"
          >
            {createError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome *
            </label>
            <input
              type="text"
              required
              placeholder="es. Matteo"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (!usernameTouched) {
                  setCustomUsername(buildUsername(e.target.value, lastName));
                }
              }}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cognome *
            </label>
            <input
              type="text"
              required
              placeholder="es. Galli"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (!usernameTouched) {
                  setCustomUsername(buildUsername(firstName, e.target.value));
                }
              }}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipologia *
            </label>
            <select
              value={workerType}
              onChange={(e) => setWorkerType(e.target.value as WorkerType)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-medium bg-white"
            >
              {WORKER_TYPES.map((wt) => (
                <option key={wt} value={wt}>
                  {wt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Username (nome.cognome)
            </label>
            <input
              type="text"
              placeholder="nome.cognome"
              value={displayedUsername}
              onChange={(e) => {
                setUsernameTouched(true);
                setCustomUsername(e.target.value.toLowerCase());
              }}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono bg-slate-50/70"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password iniziale *
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                required
                minLength={8}
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setInitialPassword(generateTemporaryPassword())}
                title="Genera password casuale"
                className="p-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm shadow-sm transition shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>
              {isCreating ? 'Creazione in corso...' : 'Aggiungi Dipendente'}
            </span>
          </button>
        </div>
      </form>

      {/* Lista Dipendenti */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {editError && (
          <div className="mx-4 mt-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2 text-xs font-medium text-red-800">
            {editError}
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {filteredWorkers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Nessun dipendente trovato per i filtri selezionati.
            </div>
          ) : (
            pagedWorkers.map((worker) => (
              <div
                key={worker.id}
                className={`p-4 flex flex-wrap items-center justify-between gap-4 transition ${
                  worker.active
                    ? 'hover:bg-indigo-50/20'
                    : 'bg-slate-50/70 opacity-75'
                }`}
              >
                {editingWorkerId === worker.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveEdit(worker);
                    }}
                    className="flex flex-1 flex-wrap items-center gap-2.5"
                  >
                    <input
                      type="text"
                      required
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      placeholder="Nome"
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium w-36"
                    />
                    <input
                      type="text"
                      required={worker.lastName !== ''}
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      placeholder={
                        worker.lastName === '' ? 'Cognome (opzionale)' : 'Cognome'
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium w-36"
                    />
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as WorkerType)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white"
                    >
                      {WORKER_TYPES.map((wt) => (
                        <option key={wt} value={wt}>
                          {wt}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="submit"
                        disabled={isSavingEdit}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-semibold"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isSavingEdit ? 'Salvo...' : 'Salva'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWorkerId(null);
                          setEditError(null);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Annulla</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-full bg-indigo-500/12 border border-indigo-200 text-indigo-800 font-semibold text-xs flex items-center justify-center shrink-0">
                        {worker.avatarInitials}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-slate-900 text-sm">
                            {worker.name}
                          </span>
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                              worker.type === 'Edilizia'
                                ? 'bg-amber-500/10 text-amber-800 border-amber-200/80'
                                : 'bg-blue-500/10 text-blue-800 border-blue-200/80'
                            }`}
                          >
                            {worker.type}
                          </span>
                          {!worker.active && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 border border-red-200">
                              Disattivato
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          @{worker.username}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {worker.active && (
                        <button
                          type="button"
                          onClick={() => startEdit(worker)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition"
                          title="Modifica dipendente"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Modifica</span>
                        </button>
                      )}

                      {worker.active && (
                        <button
                          type="button"
                          onClick={() =>
                            setResetTarget({
                              id: worker.id,
                              name: worker.name,
                              username: worker.username,
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition"
                          title="Reimposta password dipendente"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Password</span>
                        </button>
                      )}

                      {confirmToggleId === worker.id ? (
                        <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-300 px-2 py-1 rounded-lg">
                          <span className="text-[11px] font-semibold text-slate-800">
                            {worker.active ? 'Disattivare?' : 'Riattivare?'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              void onSetWorkerActive(
                                worker.id,
                                !worker.active,
                                worker.version
                              ).catch(() => {});
                              setConfirmToggleId(null);
                            }}
                            className={`px-2 py-0.5 rounded text-white text-[11px] font-semibold ${
                              worker.active
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            Sì
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmToggleId(null)}
                            className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-700 text-[11px]"
                          >
                            No
                          </button>
                        </div>
                      ) : worker.active ? (
                        <button
                          type="button"
                          onClick={() => setConfirmToggleId(worker.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition"
                          title="Disattiva accesso dipendente (mantiene lo storico)"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Disattiva</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmToggleId(worker.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition"
                          title="Riattiva accesso dipendente"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Riattiva</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        {filteredWorkers.length > 0 && (
          <div className="px-4 pb-3">
            <Pagination
              currentPage={safePage}
              totalItems={filteredWorkers.length}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )}
      </div>

      <ResetPasswordModal
        targetUser={resetTarget}
        onClose={() => setResetTarget(null)}
        onResetPassword={onResetPassword}
      />
    </div>
  );
};
