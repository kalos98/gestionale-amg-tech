import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toFriendlyErrorMessage } from '../services/apiErrors';
import { Modal } from './ui/Modal';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { changeOwnPassword } = useApp();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage(null);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (newPassword.length < 8) {
      setErrorMessage('La nuova password deve contenere almeno 8 caratteri.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('La conferma password non coincide.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      onClose();
    } catch (err) {
      setErrorMessage(toFriendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cambia la tua password"
      icon={
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
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
            Password attuale *
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nuova password * (minimo 8 caratteri)
          </label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Conferma nuova password *
          </label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
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
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold"
          >
            {isSaving ? 'Salvataggio...' : 'Aggiorna Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
