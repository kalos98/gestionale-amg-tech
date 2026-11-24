import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Camera,
  Clock,
  Download,
  Layers,
  Printer,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  Equipment,
  EquipmentCategory,
  EquipmentLog,
  EquipmentStatus,
  MaterialLog,
  PhaseStatus,
  PhotoLog,
  PhotoTag,
  Site,
  SiteSector,
  SiteStatus,
  TimeEntry,
  UserRole,
  WorkPhase,
  Worker,
} from '../../types/models';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_STATUSES,
  MATERIAL_CATEGORIES,
  MATERIAL_UNITS,
  PHASE_STATUSES,
  PHOTO_TAGS,
  SITE_SECTORS,
  SITE_STATUSES,
} from '../../constants/domain';
import {
  autoProgressFromPhaseStatus,
  formatLocalTimestamp,
  getLocalDateString,
  nextSequentialCode,
} from '../../utils/formatters';
import {
  CompressedImageBlobItem,
  compressImageFilesToBlobs,
} from '../../utils/imageHelper';
import { PdfReportOptions } from '../../utils/pdfReportHelper';
import { toFriendlyErrorMessage } from '../../services/apiErrors';
import { Modal } from '../ui/Modal';
import { WorkerSelectOptions } from '../ui/WorkerSelectOptions';
import { InlineConfirmDelete } from '../ui/InlineConfirmDelete';
import { PhotoPreviewGrid } from '../ui/PhotoPreviewGrid';

const ModalErrorBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div
      role="alert"
      className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-800"
    >
      {message}
    </div>
  ) : null;

/* ============================================================================
 * 1. UNIFIED SITE MODAL (CREATE / EDIT)
 * ============================================================================ */
interface SiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSite: Site | null;
  existingSiteCodes: string[];
  getNextSiteCode: () => Promise<string>;
  onSaveSite: (
    payload: Omit<Site, 'id' | 'progress' | 'assignedWorkerIds' | 'version'>,
    editingSite: Site | null
  ) => Promise<void>;
}

export const SiteModal: React.FC<SiteModalProps> = ({
  isOpen,
  onClose,
  editingSite,
  existingSiteCodes,
  getNextSiteCode,
  onSaveSite,
}) => {
  const [form, setForm] = useState({
    code: '',
    name: '',
    client: '',
    address: '',
    city: '',
    sectors: ['Edilizia'] as SiteSector[],
    status: 'In Corso' as SiteStatus,
    startDate: getLocalDateString(),
    endDate: getLocalDateString(90),
    description: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const prevInitKeyRef = useRef<string | null>(null);
  const codeEditedRef = useRef<boolean>(false);

  useEffect(() => {
    const nextKey = isOpen ? (editingSite ? `edit:${editingSite.id}` : 'new') : null;
    if (nextKey === prevInitKeyRef.current) return;
    prevInitKeyRef.current = nextKey;
    if (!isOpen) return;

    setSubmitError(null);
    codeEditedRef.current = false;

    if (editingSite) {
      setForm({
        code: editingSite.code,
        name: editingSite.name,
        client: editingSite.client,
        address: editingSite.address,
        city: editingSite.city,
        sectors:
          editingSite.sectors && editingSite.sectors.length > 0
            ? editingSite.sectors
            : ['Edilizia'],
        status: editingSite.status,
        startDate: editingSite.startDate,
        endDate: editingSite.endDate,
        description: editingSite.description,
      });
    } else {
      const year = new Date().getFullYear();
      const fallbackCode = nextSequentialCode(
        existingSiteCodes,
        `CNT-${year}-`,
        2
      );
      setForm({
        code: fallbackCode,
        name: '',
        client: '',
        address: '',
        city: '',
        sectors: ['Edilizia'],
        status: 'In Corso',
        startDate: getLocalDateString(),
        endDate: getLocalDateString(90),
        description: '',
      });

      let cancelled = false;
      getNextSiteCode()
        .then((atomicCode) => {
          if (!cancelled && !codeEditedRef.current && atomicCode) {
            setForm((prev) => ({ ...prev, code: atomicCode }));
          }
        })
        .catch(() => {});

      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, editingSite, existingSiteCodes, getNextSiteCode]);

  const toggleSector = (sec: SiteSector) => {
    setForm((prev) => {
      const exists = prev.sectors.includes(sec);
      if (exists && prev.sectors.length === 1) return prev;
      return {
        ...prev,
        sectors: exists
          ? prev.sectors.filter((item) => item !== sec)
          : [...prev.sectors, sec],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (
      !form.code.trim() ||
      !form.name.trim() ||
      !form.client.trim() ||
      !form.address.trim() ||
      !form.city.trim() ||
      form.sectors.length === 0
    ) {
      setSubmitError('Compila tutti i campi obbligatori.');
      return;
    }

    setSubmitError(null);
    setIsSaving(true);
    try {
      await onSaveSite(
        {
          ...form,
          code: form.code.trim(),
          name: form.name.trim(),
          client: form.client.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          description: form.description.trim(),
        },
        editingSite
      );
      onClose();
    } catch (err) {
      setSubmitError(toFriendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingSite ? 'Modifica Informazioni Cantiere' : 'Nuova Scheda Cantiere'
      }
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-sm">
        <ModalErrorBanner message={submitError} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Codice Cantiere *
            </label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) => {
                codeEditedRef.current = true;
                setForm({ ...form, code: e.target.value });
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Denominazione Cantiere *
            </label>
            <input
              type="text"
              required
              placeholder="es. Condominio Le Terrazze — Rifacimento Facciate"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={editingSite ? 'sm:col-span-3' : 'sm:col-span-2'}>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Committente / Cliente *
            </label>
            <input
              type="text"
              required
              placeholder="es. Studio Amministrazioni Rossi"
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
          {!editingSite && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stato Iniziale
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as SiteStatus })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              >
                {SITE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Settori d&apos;Intervento (seleziona uno o più settori) *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SITE_SECTORS.map((sec) => {
              const isChecked = form.sectors.includes(sec);
              return (
                <label
                  key={sec}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition select-none ${
                    isChecked
                      ? 'bg-blue-50/80 border-blue-400 text-blue-900 font-semibold'
                      : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100/70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSector(sec)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate">{sec}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Indirizzo Cantiere *
            </label>
            <input
              type="text"
              required
              placeholder="es. Via Roma 24"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Città (Provincia) *
            </label>
            <input
              type="text"
              required
              placeholder="es. Milano (MI)"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data Inizio Lavori
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => {
                const nextStart = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  startDate: nextStart,
                  endDate:
                    prev.endDate && nextStart && prev.endDate < nextStart
                      ? nextStart
                      : prev.endDate,
                }));
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data Fine Prevista
            </label>
            <input
              type="date"
              min={form.startDate || undefined}
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Descrizione Tecnica Lavori (facoltativa)
          </label>
          <textarea
            rows={3}
            placeholder="Descrivi le opere edili ed impiantistiche previste nel capitolato..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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
            {isSaving
              ? 'Salvataggio...'
              : editingSite
              ? 'Salva Modifiche'
              : 'Salva Scheda Cantiere'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ============================================================================
 * 2. PHASE MODAL (CREATE / EDIT)
 * ============================================================================ */
interface PhaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: Site | null;
  sitePhasesCount: number;
  editingPhase: WorkPhase | null;
  onSavePhase: (
    payload: Omit<WorkPhase, 'id' | 'version'>,
    editingPhase: WorkPhase | null
  ) => Promise<void>;
}

export const PhaseModal: React.FC<PhaseModalProps> = ({
  isOpen,
  onClose,
  site,
  sitePhasesCount,
  editingPhase,
  onSavePhase,
}) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    startDate: getLocalDateString(),
    endDate: getLocalDateString(30),
    status: 'Da Iniziare' as PhaseStatus,
    progress: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const prevInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const nextKey = isOpen ? (editingPhase ? `edit:${editingPhase.id}` : 'new') : null;
    if (nextKey === prevInitKeyRef.current) return;
    prevInitKeyRef.current = nextKey;
    if (!isOpen) return;
    setSubmitError(null);
    if (editingPhase) {
      setForm({
        title: editingPhase.title,
        description: editingPhase.description,
        startDate: editingPhase.startDate,
        endDate: editingPhase.endDate,
        status: editingPhase.status,
        progress: editingPhase.progress,
      });
    } else {
      setForm({
        title: '',
        description: '',
        startDate: getLocalDateString(),
        endDate: getLocalDateString(30),
        status: 'Da Iniziare',
        progress: 0,
      });
    }
  }, [isOpen, editingPhase]);

  if (!site) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!form.title.trim()) {
      setSubmitError('Il titolo della fase è obbligatorio.');
      return;
    }
    const progress = autoProgressFromPhaseStatus(form.status, form.progress);
    setSubmitError(null);
    setIsSaving(true);
    try {
      await onSavePhase(
        {
          siteId: site.id,
          order: editingPhase ? editingPhase.order : sitePhasesCount + 1,
          title: form.title.trim(),
          description: form.description.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          status: form.status,
          progress,
        },
        editingPhase
      );
      onClose();
    } catch (err) {
      setSubmitError(toFriendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingPhase ? 'Modifica Fase di Lavoro' : 'Programma Nuova Fase di Lavoro'
      }
      subtitle={site.name}
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-sm">
        <ModalErrorBanner message={submitError} />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Titolo Fase *
          </label>
          <input
            type="text"
            required
            placeholder="es. Fase 4: Montaggio Frutti, Apparecchi Illuminanti & Collaudo"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {editingPhase ? 'Stato Fase' : 'Stato Iniziale'}
          </label>
          <select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as PhaseStatus })
            }
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
          >
            {PHASE_STATUSES.map((ps) => (
              <option key={ps} value={ps}>
                {ps}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data Inizio Fase
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => {
                const nextStart = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  startDate: nextStart,
                  endDate:
                    prev.endDate && nextStart && prev.endDate < nextStart
                      ? nextStart
                      : prev.endDate,
                }));
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data Fine Fase
            </label>
            <input
              type="date"
              min={form.startDate || undefined}
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Descrizione Operativa
          </label>
          <textarea
            rows={2}
            placeholder="Dettaglio lavorazioni previste..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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
            {isSaving
              ? 'Salvataggio...'
              : editingPhase
              ? 'Salva Modifiche'
              : 'Aggiungi Fase'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ============================================================================
 * 3. EQUIPMENT MODAL (CREATE / EDIT)
 * ============================================================================ */
interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEquipment: Equipment | null;
  existingEquipmentCodes: string[];
  getNextEquipmentCode: () => Promise<string>;
  onSaveEquipment: (
    payload: Omit<Equipment, 'id' | 'version'>,
    editingEquipment: Equipment | null
  ) => Promise<void>;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  isOpen,
  onClose,
  editingEquipment,
  existingEquipmentCodes,
  getNextEquipmentCode,
  onSaveEquipment,
}) => {
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'Attrezzatura Elettrica / Impianti' as EquipmentCategory,
    serialOrPlate: '',
    status: 'Disponibile' as EquipmentStatus,
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const prevInitKeyRef = useRef<string | null>(null);
  const codeEditedRef = useRef<boolean>(false);

  useEffect(() => {
    const nextKey = isOpen
      ? editingEquipment
        ? `edit:${editingEquipment.id}`
        : 'new'
      : null;
    if (nextKey === prevInitKeyRef.current) return;
    prevInitKeyRef.current = nextKey;
    if (!isOpen) return;

    setSubmitError(null);
    codeEditedRef.current = false;

    if (editingEquipment) {
      setForm({
        code: editingEquipment.code,
        name: editingEquipment.name,
        category: editingEquipment.category,
        serialOrPlate: editingEquipment.serialOrPlate || '',
        status: editingEquipment.status,
        notes: editingEquipment.notes || '',
      });
    } else {
      const fallbackCode = nextSequentialCode(existingEquipmentCodes, 'MEZ-', 2);
      setForm({
        code: fallbackCode,
        name: '',
        category: 'Attrezzatura Elettrica / Impianti',
        serialOrPlate: '',
        status: 'Disponibile',
        notes: '',
      });

      let cancelled = false;
      getNextEquipmentCode()
        .then((atomicCode) => {
          if (!cancelled && !codeEditedRef.current && atomicCode) {
            setForm((prev) => ({ ...prev, code: atomicCode }));
          }
        })
        .catch(() => {});

      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, editingEquipment, existingEquipmentCodes, getNextEquipmentCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!form.code.trim() || !form.name.trim()) {
      setSubmitError('Codice e Nome sono obbligatori.');
      return;
    }

    setSubmitError(null);
    setIsSaving(true);
    try {
      await onSaveEquipment(
        {
          code: form.code.trim(),
          name: form.name.trim(),
          category: form.category,
          serialOrPlate: form.serialOrPlate.trim() || 'N/D',
          status: form.status,
          notes: form.notes.trim() || undefined,
        },
        editingEquipment
      );
      onClose();
    } catch (err) {
      setSubmitError(toFriendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingEquipment
          ? 'Modifica Mezzo o Attrezzatura'
          : 'Aggiungi Nuovo Mezzo o Attrezzatura'
      }
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-sm">
        <ModalErrorBanner message={submitError} />

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Codice
            </label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) => {
                codeEditedRef.current = true;
                setForm({ ...form, code: e.target.value });
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Mezzo / Attrezzatura *
            </label>
            <input
              type="text"
              required
              placeholder="es. Martello Demolitore Bosch GSH 11 VC"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Categoria
            </label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value as EquipmentCategory,
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
            >
              {EQUIPMENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Targa o Matricola S/N
            </label>
            <input
              type="text"
              placeholder="es. SN-882190"
              value={form.serialOrPlate}
              onChange={(e) =>
                setForm({ ...form, serialOrPlate: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Stato Operativo
          </label>
          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as EquipmentStatus,
              })
            }
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
          >
            {EQUIPMENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Note (opzionale)
          </label>
          <input
            type="text"
            placeholder="es. Dettagli tecnici o dotazioni incluse..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-semibold"
          >
            {isSaving
              ? 'Salvataggio...'
              : editingEquipment
              ? 'Salva Modifiche'
              : 'Aggiungi Dotazione'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ============================================================================
 * 4. TIME ENTRY MODAL (CREATE / EDIT)
 * ============================================================================ */
interface TimeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: Site | null;
  sitePhases: WorkPhase[];
  workers: Worker[];
  editingTimeEntry: TimeEntry | null;
  onSaveTimeEntry: (
    payload: Omit<TimeEntry, 'id' | 'createdAt' | 'version'>,
    editingTimeEntry: TimeEntry | null
  ) => Promise<void>;
}

export const TimeEntryModal: React.FC<TimeEntryModalProps> = ({
  isOpen,
  onClose,
  site,
  sitePhases,
  workers,
  editingTimeEntry,
  onSaveTimeEntry,
}) => {
  const [form, setForm] = useState({
    workerId: '',
    phaseId: '',
    date: getLocalDateString(),
    regularHours: 8,
    description: '',
  });
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const prevInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const nextKey =
      isOpen && site
        ? `${site.id}:${editingTimeEntry ? `edit:${editingTimeEntry.id}` : 'new'}`
        : null;
    if (nextKey === prevInitKeyRef.current) return;
    prevInitKeyRef.current = nextKey;
    if (!isOpen || !site) return;
    setHoursError(null);
    setSubmitError(null);
    if (editingTimeEntry) {
      setForm({
        workerId: editingTimeEntry.workerId,
        phaseId: editingTimeEntry.phaseId || '',
        date: editingTimeEntry.date,
        regularHours: editingTimeEntry.regularHours,
        description: editingTimeEntry.description,
      });
    } else {
      const activeWorkers = workers.filter((w) => w.active);
      const firstAssigned = (site.assignedWorkerIds || []).find((id) =>
        activeWorkers.some((w) => w.id === id)
      );
      setForm({
        workerId: firstAssigned || activeWorkers[0]?.id || '',
        phaseId: sitePhases[0]?.id || '',
        date: getLocalDateString(),
        regularHours: 8,
        description: '',
      });
    }
  }, [isOpen, site, editingTimeEntry, sitePhases, workers]);

  if (!site) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!form.workerId || !form.description.trim()) {
      setSubmitError('Seleziona un dipendente e inserisci una descrizione.');
      return;
    }
    const reg = Number(form.regularHours) || 0;
    if (reg <= 0) {
      setHoursError('Inserisci almeno 0,5 ore lavorate.');
      return;
    }
    setHoursError(null);
    setSubmitError(null);
    const worker = workers.find((w) => w.id === form.workerId);
    setIsSaving(true);
    try {
      await onSaveTimeEntry(
        {
          siteId: site.id,
          workerId: form.workerId,
          workerName: worker ? worker.name : 'Dipendente',
          phaseId: form.phaseId,
          date: form.date,
          regularHours: reg,
          description: form.description.trim(),
        },
        editingTimeEntry
      );
      onClose();
    } catch (err) {
      setSubmitError(toFriendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTimeEntry ? 'Modifica Ore Lavorate' : 'Aggiungi Ore Lavorate'}
      subtitle={site.name}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-sm">
        <ModalErrorBanner message={submitError} />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Dipendente *
          </label>
          <select
            required
            value={form.workerId}
            onChange={(e) => setForm({ ...form, workerId: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
          >
            <WorkerSelectOptions
              workers={workers}
              assignedWorkerIds={site.assignedWorkerIds}
              includeWorkerId={editingTimeEntry?.workerId}
            />
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fase di Lavoro
            </label>
            <select
              value={form.phaseId}
              onChange={(e) => setForm({ ...form, phaseId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
            >
              <option value="">Generale Cantiere</option>
              {sitePhases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data Lavorazione *
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Ore Lavorate *
          </label>
          <input
            type="number"
            required
            min={0.5}
            max={24}
            step={0.5}
            value={form.regularHours}
            onChange={(e) => {
              setHoursError(null);
              setForm({ ...form, regularHours: Number(e.target.value) });
            }}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        {hoursError && (
          <p className="text-xs font-medium text-red-600">{hoursError}</p>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Descrizione Attività Svolta *
          </label>
          <textarea
            rows={3}
            required
            placeholder="Descrivi le lavorazioni eseguite dal dipendente..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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
            disabled={isSaving || !form.workerId}
            className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold"
          >
            {isSaving
              ? 'Salvataggio...'
              : editingTimeEntry
              ? 'Salva Modifiche'
              : 'Registra Ore'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ============================================================================
 * 5. MATERIAL LOG MODAL (CREATE / EDIT)
 * ============================================================================ */
interface MaterialLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: Site | null;
  sitePhases: WorkPhase[];
  workers: Worker[];
  editingMaterialLog: MaterialLog | null;
  onSaveMaterialLog: (
    payload: Omit<MaterialLog, 'id' | 'createdAt' | 'version'>,
    editingMaterialLog: MaterialLog | null
  ) => Promise<void>;
}

export const MaterialLogModal: React.FC<MaterialLogModalProps> = ({
  isOpen,
  onClose,
  site,
  sitePhases,
  workers,
  editingMaterialLog,
  onSaveMaterialLog,
}) => {
  const [form, setForm] = useState<{
    workerId: string;
    phaseId: string;
    date: string;
    articleCode: string;
    materialName: string;
    category: MaterialLog['category'];
    quantity: number;
    unit: MaterialLog['unit'];
    notes: string;
  }>({
    workerId: '',
    phaseId: '',
    date: getLocalDateString(),
    articleCode: '',
    materialName: '',
    category: 'Edilizia',
    quantity: 1,
    unit: 'pz',
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const prevInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const nextKey =
      isOpen && site
        ? `${site.id}:${editingMaterialLog ? `edit:${editingMaterialLog.id}` : 'new'}`
        : null;
    if (nextKey === prevInitKeyRef.current) return;
    prevInitKeyRef.current = nextKey;
    if (!isOpen || !site) return;
    setSubmitError(null);
    if (editingMaterialLog) {
      setForm({
        workerId: editingMaterialLog.workerId,
        phaseId: editingMaterialLog.phaseId || '',
        date: editingMaterialLog.date,
        articleCode: editingMaterialLog.articleCode || '',
        materialName: editingMaterialLog.materialName || '',
        category: editingMaterialLog.category,
        quantity: editingMaterialLog.quantity,
        unit: editingMaterialLog.unit,
        notes: editingMaterialLog.notes || '',
      });
    } else {
      const activeWorkers = workers.filter((w) => w.active);
      const firstAssigned = (site.assignedWorkerIds || []).find((id) =>
        activeWorkers.some((w) => w.id === id)
      );
      setForm({
        workerId: firstAssigned || activeWorkers[0]?.id || '',
        phaseId: sitePhases[0]?.id || '',
        date: getLocalDateString(),
        articleCode: '',
        materialName: '',
        category: 'Edilizia',
        quantity: 1,
        unit: 'pz',
        notes: '',
      });
    }
  }, [isOpen, site, editingMaterialLog, sitePhases, workers]);

  if (!site) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const qty = Number(form.quantity);
    if (
      !form.workerId ||
      (!form.articleCode.trim() && !form.materialName.trim()) ||
      Number.isNaN(qty) ||
      qty <= 0
    ) {
      setSubmitError('Compila correttamente i campi obbligatori del materiale.');
      return;
    }
    const worker = workers.find((w) => w.id === form.workerId);
    setSubmitError(null);
    setIsSaving(true);
    try {
      await onSaveMaterialLog(
        {
          siteId: site.id,
          workerId: form.workerId,
          workerName: worker ? worker.name : 'Dipendente',
          phaseId: form.phaseId,
          date: form.date,
          articleCode: form.articleCode.trim() || undefined,
          materialName: form.materialName.trim() || undefined,
          category: form.category,
          quantity: qty,
          unit: form.unit,
          notes: form.notes.trim() || undefined,
        },
        editingMaterialLog
      );
      onClose();
    } catch (err) {
      setSubmitError(toFriendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingMaterialLog
          ? 'Modifica Materiale Consumato'
          : 'Aggiungi Materiale Consumato'
      }
      subtitle={site.name}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-sm">
        <ModalErrorBanner message={submitError} />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Dipendente *
          </label>
          <select
            required
            value={form.workerId}
            onChange={(e) => setForm({ ...form, workerId: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
          >
            <WorkerSelectOptions
              workers={workers}
              assignedWorkerIds={site.assignedWorkerIds}
              includeWorkerId={editingMaterialLog?.workerId}
            />
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fase di Lavoro
            </label>
            <select
              value={form.phaseId}
              onChange={(e) => setForm({ ...form, phaseId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
            >
              <option value="">Generale Cantiere</option>
              {sitePhases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data *
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Codice Articolo {!form.materialName.trim() ? '*' : '(opzionale)'}
          </label>
          <input
            type="text"
            required={!form.materialName.trim()}
            placeholder="es. EL-0042"
            value={form.articleCode}
            onChange={(e) => setForm({ ...form, articleCode: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nome / Descrizione Materiale (opzionale)
          </label>
          <input
            type="text"
            placeholder="es. Cavo Unipolare FS17 2,5 mm² / Malta Premiscelata..."
            value={form.materialName}
            onChange={(e) => setForm({ ...form, materialName: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-300"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Categoria *
            </label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value as MaterialLog['category'],
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
            >
              {MATERIAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantità *
            </label>
            <input
              type="number"
              required
              min={0.5}
              step={0.5}
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: Number(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unità *
            </label>
            <select
              value={form.unit}
              onChange={(e) =>
                setForm({
                  ...form,
                  unit: e.target.value as MaterialLog['unit'],
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
            >
              {MATERIAL_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Note (opzionale)
          </label>
          <input
            type="text"
            placeholder="es. Utilizzato al Piano 2..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
            disabled={isSaving || !form.workerId}
            className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-semibold"
          >
            {isSaving
              ? 'Salvataggio...'
              : editingMaterialLog
              ? 'Salva Modifiche'
              : 'Registra Materiale'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ============================================================================
 * 6. EQUIPMENT USAGE MODAL (CREATE / EDIT)
 * ============================================================================ */
interface EquipmentUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: Site | null;
  allEquipment: Equipment[];
  workers: Worker[];
  currentAdmin: { id: string; name: string };
  editingEqLog: EquipmentLog | null;
  onSaveEqUsage: (
    params: {
      equipmentId: string;
      equipmentName: string;
      actorId?: string;
      actorName: string;
      actorRole: 'Admin' | 'Dipendente';
      timestamp: string;
      hoursUsed?: number;
      notes?: string;
    },
    editingEqLog: EquipmentLog | null
  ) => Promise<void>;
}

export const EquipmentUsageModal: React.FC<EquipmentUsageModalProps> = ({
  isOpen,
  onClose,
  site,
  allEquipment,
  workers,
  currentAdmin,
  editingEqLog,
  onSaveEqUsage,
}) => {
  const [form, setForm] = useState({
    equipmentId: '',
    workerId: '',
    date: getLocalDateString(),
    hoursUsed: '',
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const prevInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const nextKey =
      isOpen && site
        ? `${site.id}:${editingEqLog ? `edit:${editingEqLog.id}` : 'new'}`
        : null;
    if (nextKey === prevInitKeyRef.current) return;
    prevInitKeyRef.current = nextKey;
    if (!isOpen || !site) return;
    setSubmitError(null);
    if (editingEqLog) {
      const matchedWorker =
        (editingEqLog.actorId &&
          workers.find((w) => w.id === editingEqLog.actorId)) ||
        workers.find((w) => w.name === editingEqLog.actorName);
      const isAdminActor = editingEqLog.actorRole === 'Admin';
      setForm({
        equipmentId: editingEqLog.equipmentId,
        workerId: isAdminActor
          ? '__admin__'
          : matchedWorker?.id || workers.find((w) => w.active)?.id || '__admin__',
        date:
          (editingEqLog.timestamp || '').slice(0, 10) || getLocalDateString(),
        hoursUsed:
          editingEqLog.hoursUsed && editingEqLog.hoursUsed > 0
            ? String(editingEqLog.hoursUsed)
            : '',
        notes: editingEqLog.notes || '',
      });
    } else {
      const firstAvailable = allEquipment.find(
        (e) => e.status !== 'In Manutenzione'
      );
      const activeWorkers = workers.filter((w) => w.active);
      const firstAssigned = (site.assignedWorkerIds || []).find((id) =>
        activeWorkers.some((w) => w.id === id)
      );
      setForm({
        equipmentId: firstAvailable?.id || allEquipment[0]?.id || '',
        workerId: firstAssigned || activeWorkers[0]?.id || '__admin__',
        date: getLocalDateString(),
        hoursUsed: '',
        notes: '',
      });
    }
  }, [isOpen, site, editingEqLog, allEquipment, workers]);

  if (!site) return null;

  const selectableEquipment = allEquipment.filter(
    (e) => e.status !== 'In Manutenzione' || e.id === editingEqLog?.equipmentId
  );
  const selectedEq = allEquipment.find((e) => e.id === form.equipmentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!form.equipmentId || !form.workerId || selectableEquipment.length === 0)
      return;

    const isAdminActor = form.workerId === '__admin__';
    const worker = workers.find((w) => w.id === form.workerId);
    const preservingEditedAdmin =
      isAdminActor && editingEqLog?.actorRole === 'Admin';

    const actorId = isAdminActor
      ? preservingEditedAdmin && editingEqLog?.actorId
        ? editingEqLog.actorId
        : currentAdmin.id
      : form.workerId;
    const actorName = isAdminActor
      ? preservingEditedAdmin && editingEqLog?.actorName
        ? editingEqLog.actorName
        : currentAdmin.name
      : worker?.name || 'Dipendente';
    const actorRole: 'Admin' | 'Dipendente' = isAdminActor
      ? 'Admin'
      : 'Dipendente';

    const originalTime = (editingEqLog?.timestamp || '').slice(11, 16);
    const timeSuffix =
      originalTime && /^\d{2}:\d{2}$/.test(originalTime)
        ? originalTime
        : formatLocalTimestamp().slice(11, 16);

    const parsedHours = Number(form.hoursUsed);
    const validHours =
      form.hoursUsed.trim() !== '' &&
      !Number.isNaN(parsedHours) &&
      parsedHours > 0
        ? parsedHours
        : undefined;

    setSubmitError(null);
    setIsSaving(true);
    try {
      await onSaveEqUsage(
        {
          equipmentId: form.equipmentId,
          equipmentName: selectedEq
            ? selectedEq.name
            : editingEqLog?.equipmentName || '',
          actorId,
          actorName,
          actorRole,
          timestamp: `${form.date} ${timeSuffix}`,
          hoursUsed: validHours,
          notes: form.notes.trim() || undefined,
        },
        editingEqLog
      );
      onClose();
    } catch (err) {
      setSubmitError(toFriendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingEqLog
          ? 'Modifica Utilizzo Mezzo'
          : 'Registra Utilizzo Mezzo / Attrezzatura'
      }
      subtitle={site.name}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-sm">
        <ModalErrorBanner message={submitError} />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Mezzo / Attrezzatura *
          </label>
          {selectableEquipment.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2 px-3 rounded-xl border border-slate-200 bg-slate-50">
              Nessun mezzo operativo disponibile al momento.
            </p>
          ) : (
            <select
              required
              value={form.equipmentId}
              onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
            >
              {EQUIPMENT_CATEGORIES.map((cat) => {
                const items = selectableEquipment.filter((e) => e.category === cat);
                if (items.length === 0) return null;
                return (
                  <optgroup key={cat} label={cat}>
                    {items.map((e) => (
                      <option key={e.id} value={e.id}>
                        [{e.code}] {e.name}
                        {e.status === 'In Manutenzione'
                          ? ' (In Manutenzione)'
                          : ''}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Dipendente *
          </label>
          <select
            required
            value={form.workerId}
            onChange={(e) => setForm({ ...form, workerId: e.target.value })}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
          >
            <WorkerSelectOptions
              workers={workers}
              assignedWorkerIds={site.assignedWorkerIds}
              includeWorkerId={
                editingEqLog?.actorRole === 'Dipendente'
                  ? editingEqLog.actorId
                  : undefined
              }
              includeAdminOption
              adminLabel={`${currentAdmin.name} (Admin)`}
            />
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data Utilizzo *
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ore di Utilizzo (opzionale)
            </label>
            <input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              placeholder="es. 4"
              value={form.hoursUsed}
              onChange={(e) =>
                setForm({ ...form, hoursUsed: e.target.value })
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Note (opzionale)
          </label>
          <input
            type="text"
            placeholder="es. Trasporto materiali, lavorazione in quota..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
            disabled={isSaving || selectableEquipment.length === 0}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-semibold"
          >
            {isSaving
              ? 'Salvataggio...'
              : editingEqLog
              ? 'Salva Modifiche'
              : 'Registra Utilizzo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ============================================================================
 * 7. PDF REPORT MODAL
 * ============================================================================ */
interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: Site | null;
  pdfOptions: PdfReportOptions;
  onChangeOptions: (opts: PdfReportOptions) => void;
  counts: {
    workers: number;
    phases: number;
    equipmentLogs: number;
    timeEntries: number;
    materials: number;
    photos: number;
  };
  onPrint: (e: React.FormEvent) => void;
}

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  isOpen,
  onClose,
  site,
  pdfOptions,
  onChangeOptions,
  counts,
  onPrint,
}) => {
  if (!site) return null;

  const sections: Array<{
    key: keyof PdfReportOptions;
    label: string;
    countLabel: string;
  }> = [
    {
      key: 'includeWorkers',
      label: 'Dipendenti Assegnati al Cantiere',
      countLabel: `${counts.workers} dipendenti`,
    },
    {
      key: 'includePhases',
      label: 'Cronoprogramma e Fasi di Lavoro',
      countLabel: `${counts.phases} fasi`,
    },
    {
      key: 'includeEquipmentHistory',
      label: 'Cronologia & Ore Utilizzo Mezzi',
      countLabel: `${counts.equipmentLogs} registrazioni`,
    },
    {
      key: 'includeHours',
      label: 'Registro Ore Lavorate',
      countLabel: `${counts.timeEntries} registrazioni`,
    },
    {
      key: 'includeMaterials',
      label: 'Materiali Consumati in Cantiere',
      countLabel: `${counts.materials} materiali`,
    },
    {
      key: 'includePhotos',
      label: 'Documentazione Fotografica Cantiere',
      countLabel: `${counts.photos} foto`,
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Stampa Report Cantiere in PDF"
      subtitle={`[${site.code}] ${site.name}`}
      icon={
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
          <Printer className="w-5 h-5" />
        </div>
      }
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={onPrint} className="space-y-4 mt-4 text-sm">
        <p className="text-xs text-slate-600 leading-relaxed">
          Seleziona le sezioni da includere nella scheda tecnica A4 del cantiere.
          Si aprirà la finestra di stampa nativa del sistema da cui potrai
          selezionare <strong>&quot;Salva come PDF&quot;</strong> o inviare
          direttamente alla stampante.
        </p>

        <div className="space-y-2">
          {sections.map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer transition"
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={pdfOptions[item.key]}
                  onChange={(e) =>
                    onChangeOptions({
                      ...pdfOptions,
                      [item.key]: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-semibold text-slate-800">
                  {item.label}
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                {item.countLabel}
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-medium"
          >
            Annulla
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            <Printer className="w-4 h-4" />
            <span>Stampa / Salva in PDF</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ============================================================================
 * 8. ADMIN PHOTO UPLOAD MODAL
 * ============================================================================ */
interface AdminPhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: Site | null;
  sitePhases: WorkPhase[];
  currentAdmin: { id: string; name: string };
  defaultPhaseId?: string;
  onSavePhotos: (
    photos: Array<{
      siteId: string;
      phaseId: string;
      workerId: string;
      workerName: string;
      uploaderRole: UserRole;
      date: string;
      blob: Blob;
      caption: string;
      tag: PhotoTag;
    }>
  ) => Promise<void>;
}

export const AdminPhotoUploadModal: React.FC<AdminPhotoUploadModalProps> = ({
  isOpen,
  onClose,
  site,
  sitePhases,
  currentAdmin,
  defaultPhaseId,
  onSavePhotos,
}) => {
  const [selectedPhotos, setSelectedPhotos] = useState<CompressedImageBlobItem[]>([]);
  const [phaseId, setPhaseId] = useState<string>('');
  const [tag, setTag] = useState<PhotoTag>('Avanzamento Lavori');
  const [date, setDate] = useState<string>(getLocalDateString());
  const [caption, setCaption] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const prevInitKeyRef = useRef<string | null>(null);
  const selectedPhotosRef = useRef<CompressedImageBlobItem[]>([]);

  selectedPhotosRef.current = selectedPhotos;

  const revokePreviews = (items: CompressedImageBlobItem[]) => {
    items.forEach((item) => {
      if (item.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  };

  useEffect(() => {
    const nextKey =
      isOpen && site ? `${site.id}:${defaultPhaseId ?? '__default__'}` : null;
    if (nextKey === prevInitKeyRef.current) return;
    prevInitKeyRef.current = nextKey;

    if (!isOpen) {
      revokePreviews(selectedPhotosRef.current);
      setSelectedPhotos([]);
      return;
    }

    revokePreviews(selectedPhotosRef.current);
    setSelectedPhotos([]);
    setPhaseId(
      defaultPhaseId !== undefined ? defaultPhaseId : sitePhases[0]?.id || ''
    );
    setTag('Avanzamento Lavori');
    setDate(getLocalDateString());
    setCaption('');
    setUploadError(null);
  }, [isOpen, site, sitePhases, defaultPhaseId]);

  useEffect(() => {
    return () => {
      revokePreviews(selectedPhotosRef.current);
    };
  }, []);

  if (!site) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setIsCompressing(true);
    setUploadError(null);
    try {
      const { items, failedCount } = await compressImageFilesToBlobs(
        files,
        1280,
        0.82
      );
      if (items.length > 0) {
        setSelectedPhotos((prev) => [...prev, ...items]);
      }
      if (failedCount > 0) {
        setUploadError(
          items.length === 0
            ? 'Impossibile elaborare le immagini selezionate. Riprova con file JPG o PNG validi.'
            : `${failedCount} file non ${
                failedCount === 1 ? 'è stato elaborato' : 'sono stati elaborati'
              } perché non validi.`
        );
      }
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPhotos.length === 0 || isCompressing || isSaving) return;
    const trimmedCaption = caption.trim();
    setUploadError(null);
    setIsSaving(true);
    try {
      await onSavePhotos(
        selectedPhotos.map((item) => ({
          siteId: site.id,
          phaseId,
          workerId: currentAdmin.id,
          workerName: currentAdmin.name,
          uploaderRole: 'admin',
          date,
          blob: item.blob,
          caption: trimmedCaption,
          tag,
        }))
      );
      revokePreviews(selectedPhotos);
      setSelectedPhotos([]);
      onClose();
    } catch (err) {
      setUploadError(toFriendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Carica Foto nel Cantiere"
      subtitle={site.name}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Seleziona Immagini *
          </label>
          <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/40 hover:bg-violet-50 cursor-pointer transition">
            <Upload className="w-5 h-5 text-violet-600" />
            <span className="text-xs font-semibold text-violet-900">
              {isCompressing
                ? 'Compressione immagini in corso...'
                : selectedPhotos.length > 0
                ? 'Aggiungi altre immagini'
                : 'Scegli una o più immagini dal computer'}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {uploadError && (
            <p className="mt-1.5 text-xs font-medium text-red-600">
              {uploadError}
            </p>
          )}
          {selectedPhotos.length > 0 && (
            <div className="mt-2.5">
              <PhotoPreviewGrid
                urls={selectedPhotos.map((p) => p.previewUrl)}
                showHeaderOnSingle
                maxGridHeightClass="max-h-56"
                onRemoveAt={(idx) =>
                  setSelectedPhotos((prev) => {
                    const target = prev[idx];
                    if (target) revokePreviews([target]);
                    return prev.filter((_, i) => i !== idx);
                  })
                }
                onClearAll={() => {
                  revokePreviews(selectedPhotos);
                  setSelectedPhotos([]);
                }}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fase di Lavoro
            </label>
            <select
              value={phaseId}
              onChange={(e) => setPhaseId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
            >
              <option value="">Generale Cantiere</option>
              {sitePhases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Data Scatto *
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Categoria Foto
          </label>
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value as PhotoTag)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
          >
            {PHOTO_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Didascalia / Note Tecniche (opzionale)
          </label>
          <textarea
            rows={2}
            placeholder="Descrizione tecnica delle foto (opzionale)..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
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
            disabled={selectedPhotos.length === 0 || isCompressing || isSaving}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white font-semibold"
          >
            {isSaving
              ? 'Caricamento...'
              : selectedPhotos.length > 1
              ? `Salva ${selectedPhotos.length} Foto`
              : 'Salva Foto'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ============================================================================
 * 9. PHOTO LIGHTBOX MODAL
 * ============================================================================ */
interface PhotoLightboxModalProps {
  photo: PhotoLog | null;
  sites: Site[];
  phases: WorkPhase[];
  onClose: () => void;
  onGoToSitePhotos: (siteId: string) => void;
  onDownloadPhoto: (photo: PhotoLog, e?: React.MouseEvent) => void;
  onDeletePhoto: (photoId: string) => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  photo,
  sites,
  phases,
  onClose,
  onGoToSitePhotos,
  onDownloadPhoto,
  onDeletePhoto,
}) => {
  useEffect(() => {
    if (!photo) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [photo, onClose]);

  if (!photo) return null;

  const photoSite = sites.find((s) => s.id === photo.siteId);
  const photoPhase = phases.find((p) => p.id === photo.phaseId);
  const tagBadgeClasses =
    photo.tag === 'Anomalia'
      ? 'bg-red-500/15 text-red-300 border-red-400/30'
      : photo.tag === 'Fine lavori'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
      : 'bg-violet-500/20 text-violet-200 border-violet-400/30';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Anteprima fotografia cantiere"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-black flex items-center justify-center max-h-[72vh]">
          <img
            src={photo.imageUrl}
            alt={photo.caption || photo.tag}
            className="max-h-[70vh] w-auto object-contain"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi anteprima foto"
            className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 text-white space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${tagBadgeClasses}`}
              >
                {photo.tag}
              </span>
              {photoSite && (
                <span
                  title={photoSite.name}
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-800/90 text-blue-300 border border-slate-700/80"
                >
                  <Building2 className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>{photoSite.code}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onGoToSitePhotos(photo.siteId)}
                title="Vai a tutte le foto del cantiere"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-violet-600 text-slate-200 hover:text-white border border-slate-700 hover:border-violet-500 font-medium text-xs transition"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Galleria</span>
              </button>
              <button
                type="button"
                onClick={(e) => onDownloadPhoto(photo, e)}
                title="Scarica foto"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Scarica</span>
              </button>
              <InlineConfirmDelete
                title="Elimina foto"
                buttonClassName="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white border border-slate-700 hover:border-red-500 transition"
                iconClassName="w-3.5 h-3.5"
                onConfirm={() => {
                  onDeletePhoto(photo.id);
                  onClose();
                }}
              />
            </div>
          </div>

          {photo.caption && (
            <p className="text-xs sm:text-sm text-slate-100 leading-snug">
              {photo.caption}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Layers className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-slate-500">Fase:</span>
              <span className="text-slate-200 font-medium truncate max-w-[260px]">
                {photoPhase ? photoPhase.title : 'Generale Cantiere'}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-slate-500">
                {photo.uploaderRole === 'admin' ? 'Amministratore:' : 'Dipendente:'}
              </span>
              <span className="text-slate-200 font-medium">
                {photo.workerName}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 sm:ml-auto">
              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-slate-300 tabular-nums">
                {photo.createdAt}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
