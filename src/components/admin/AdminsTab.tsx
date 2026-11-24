import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { AdminUser } from '../../types/models';
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

interface AdminsTabProps {
  admins: AdminUser[];
  currentAdminId: string;
  onCreateAdmin: (params: {
    firstName: string;
    lastName: string;
    password: string;
    customUsername?: string;
  }) => Promise<{ username: string; name: string }>;
  onUpdateAdmin: (params: {
    userId: string;
    firstName: string;
    lastName: string;
    expectedVersion: number;
  }) => Promise<void>;
  onResetPassword: (userId: string, newPassword: string) => Promise<void>;
  onSetAdminActive: (
    userId: string,
    active: boolean,
    expectedVersion: number
  ) => Promise<void>;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

export const AdminsTab: React.FC<AdminsTabProps> = ({
  admins,
  currentAdminId,
  onCreateAdmin,
  onUpdateAdmin,
  onResetPassword,
  onSetAdminActive,
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
}) => {
  const [statusFilter, setStatusFilter] =
    useState<AccountStatusFilter>('active');

  // Form creazione nuovo admin
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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

  // Modifica inline anagrafica
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Modale reset password & disattivazione inline
  const [resetTarget, setResetTarget] = useState<ResetPasswordTarget | null>(
    null
  );
  const [confirmToggleId, setConfirmToggleId] = useState<string | null>(null);

  const generatedUsername = buildUsername(firstName, lastName);
  const displayedUsername = usernameTouched
    ? customUsername
    : generatedUsername;

  const filteredAdmins = useMemo(() => {
    return admins.filter((adm) => {
      if (statusFilter === 'active') return adm.active;
      if (statusFilter === 'inactive') return !adm.active;
      return true;
    });
  }, [admins, statusFilter]);

  useEffect(() => {
    onPageChange(1);
    setEditingId(null);
    setConfirmToggleId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    setEditingId(null);
    setConfirmToggleId(null);
  }, [page]);

  const { items: pagedAdmins, safePage } = paginate(
    filteredAdmins,
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
      const created = await onCreateAdmin({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
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
        `Amministratore: ${createdCredentials.name}\nUsername: ${createdCredentials.username}\nPassword: ${createdCredentials.password}`
      );
      setCopiedCredentials(true);
      window.setTimeout(() => setCopiedCredentials(false), 2000);
    } catch {
      // Clipboard API non disponibile
    }
  };

  const startEdit = (adm: AdminUser) => {
    setEditingId(adm.id);
    setEditFirstName(adm.firstName);
    setEditLastName(adm.lastName);
    setEditError(null);
  };

  const saveEdit = async (adm: AdminUser) => {
    if (isSavingEdit) return;
    if (!editFirstName.trim() || (adm.lastName !== '' && !editLastName.trim())) {
      setEditError('Compila i campi obbligatori.');
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await onUpdateAdmin({
        userId: adm.id,
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        expectedVersion: adm.version,
      });
      setEditingId(null);
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
            Amministratori
          </h1>
          <p className="text-sm text-slate-600">
            Accesso riservato agli amministratori per abilitare e gestire altri account amministrativi.
          </p>
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === opt.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Box Credenziali Appena Create */}
      {createdCredentials && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="space-y-1 text-xs text-emerald-950">
            <div className="font-bold text-sm flex items-center gap-1.5 text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                Amministratore &quot;{createdCredentials.name}&quot; creato con successo
              </span>
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

      {/* Form Creazione Nuovo Amministratore */}
      <form
        onSubmit={handleCreateSubmit}
        className="bg-white rounded-2xl p-5 border border-blue-200/80 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <UserPlus className="w-4 h-4 text-blue-600" />
          <span>Crea Nuovo Account Amministratore</span>
        </div>

        {createError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-800"
          >
            {createError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome *
            </label>
            <input
              type="text"
              required
              placeholder="es. Mario"
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
              placeholder="es. Rossi"
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

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-slate-500">
            L&apos;amministratore creato potrà accedere subito e creare ulteriori account amministratori o dipendenti.
          </p>
          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm shadow-sm transition shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>
              {isCreating ? 'Creazione in corso...' : 'Crea Amministratore'}
            </span>
          </button>
        </div>
      </form>

      {/* Lista Amministratori */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {editError && (
          <div className="mx-4 mt-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2 text-xs font-medium text-red-800">
            {editError}
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {filteredAdmins.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Nessun amministratore trovato per il filtro selezionato.
            </div>
          ) : (
            pagedAdmins.map((adm) => {
              const isSelf = adm.id === currentAdminId;
              const cannotDeactivate = isSelf || adm.isRootAdmin;

              return (
                <div
                  key={adm.id}
                  className={`p-4 flex flex-wrap items-center justify-between gap-4 transition ${
                    adm.active
                      ? 'hover:bg-blue-50/20'
                      : 'bg-slate-50/70 opacity-75'
                  }`}
                >
                  {editingId === adm.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveEdit(adm);
                      }}
                      className="flex flex-1 flex-wrap items-center gap-2.5"
                    >
                      <input
                        type="text"
                        required
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        placeholder="Nome"
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium w-40"
                      />
                      <input
                        type="text"
                        required={adm.lastName !== ''}
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        placeholder={adm.lastName === '' ? 'Cognome (opzionale)' : 'Cognome'}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium w-40"
                      />
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          type="submit"
                          disabled={isSavingEdit}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSavingEdit ? 'Salvo...' : 'Salva'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
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
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-blue-500/12 border border-blue-200 text-blue-800 font-semibold text-xs flex items-center justify-center shrink-0">
                          {adm.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-900 text-sm">
                              {adm.name}
                            </span>
                            {adm.isRootAdmin && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-800 border border-blue-200">
                                Originario
                              </span>
                            )}
                            {isSelf && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-200">
                                Tu
                              </span>
                            )}
                            {!adm.active && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 border border-red-200">
                                Disattivato
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            @{adm.username}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {adm.active && (
                          <button
                            type="button"
                            onClick={() => startEdit(adm)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition"
                            title="Modifica anagrafica amministratore"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Modifica</span>
                          </button>
                        )}

                        {adm.active && (
                          <button
                            type="button"
                            onClick={() =>
                              setResetTarget({
                                id: adm.id,
                                name: adm.name,
                                username: adm.username,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-amber-700 hover:bg-amber-50 border border-transparent hover:border-amber-200 transition"
                            title="Reimposta password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Password</span>
                          </button>
                        )}

                        {!cannotDeactivate &&
                          (confirmToggleId === adm.id ? (
                            <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-300 px-2 py-1 rounded-lg">
                              <span className="text-[11px] font-semibold text-slate-800">
                                {adm.active ? 'Disattivare?' : 'Riattivare?'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  void onSetAdminActive(
                                    adm.id,
                                    !adm.active,
                                    adm.version
                                  ).catch(() => {});
                                  setConfirmToggleId(null);
                                }}
                                className={`px-2 py-0.5 rounded text-white text-[11px] font-semibold ${
                                  adm.active
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
                          ) : adm.active ? (
                            <button
                              type="button"
                              onClick={() => setConfirmToggleId(adm.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition"
                              title="Disattiva account amministratore"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              <span>Disattiva</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmToggleId(adm.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition"
                              title="Riattiva account amministratore"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Riattiva</span>
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {filteredAdmins.length > 0 && (
          <div className="px-4 pb-3">
            <Pagination
              currentPage={safePage}
              totalItems={filteredAdmins.length}
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
