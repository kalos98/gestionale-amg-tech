import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, RefreshCw } from 'lucide-react';
import { generateTemporaryPassword } from '../../utils/username';
import { toFriendlyErrorMessage } from '../../services/apiErrors';
import { Modal } from './Modal';

export interface ResetPasswordTarget {
  id: string;
  name: string;
  username: string;
}

interface ResetPasswordModalProps {
  targetUser: ResetPasswordTarget | null;
  onClose: () => void;
  onResetPassword: (userId: string, newPassword: string) => Promise<void>;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  targetUser,
  onClose,
  onResetPassword,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUser) return;
    setNewPassword(generateTemporaryPassword());
    setCopied(false);
    setErrorMessage(null);
  }, [targetUser]);

  if (!targetUser) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `Username: ${targetUser.username}\nPassword: ${newPassword}`
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API non disponibile in contesto non sicuro
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (newPassword.length < 8) {
      setErrorMessage('La password deve contenere almeno 8 caratteri.');
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await onResetPassword(targetUser.id, newPassword);
      onClose();
    } catch (err) {
      setErrorMessage(toFriendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(targetUser)}
      onClose={onClose}
      title="Reimposta Password Utente"
      subtitle={`${targetUser.name} (@${targetUser.username})`}
      icon={
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5" />
        </div>
      }
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-sm">
        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-800"
          >
            {errorMessage}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nuova Password * (minimo 8 caratteri)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setNewPassword(generateTemporaryPassword())}
              title="Genera nuova password casuale"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Genera</span>
            </button>
            <button
              type="button"
              onClick={handleCopy}
              title="Copia credenziali"
              className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Comunica la nuova password al diretto interessato prima di chiudere.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-medium"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-semibold"
          >
            {isSaving ? 'Aggiornamento...' : 'Salva Nuova Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
