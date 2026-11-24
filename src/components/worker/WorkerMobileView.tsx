import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  Edit3,
  HardHat,
  MapPin,
  Package,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  EquipmentLog,
  MaterialLog,
  PhotoLog,
  PhotoTag,
} from '../../types/models';
import { compressImageFilesToBlobs } from '../../utils/imageHelper';
import {
  EQUIPMENT_CATEGORIES,
  MATERIAL_CATEGORIES,
  MATERIAL_UNITS,
  PHOTO_TAGS,
} from '../../constants/domain';
import {
  buildGoogleMapsUrl,
  compareByDateDesc,
  formatLocalTimestamp,
  generateUuid,
  getLocalDateString,
  phaseStatusFromProgress,
} from '../../utils/formatters';
import { toFriendlyErrorMessage } from '../../services/apiErrors';
import { InlineConfirmDelete } from '../ui/InlineConfirmDelete';
import { PhaseProgressSlider } from '../ui/PhaseProgressSlider';
import { PhotoPreviewGrid } from '../ui/PhotoPreviewGrid';
import { Pagination, paginate, DEFAULT_PAGE_SIZE } from '../Pagination';

export type WorkerNavTab = 'home' | 'hours' | 'materials' | 'equipment' | 'photos';
type MobileListKey = 'phases' | 'hours' | 'materials' | 'siteEq' | 'photos';

interface SelectedPhotoItem {
  blob?: Blob;
  previewUrl: string;
}

const INITIAL_MOBILE_PAGES: Record<MobileListKey, number> = {
  phases: 1,
  hours: 1,
  materials: 1,
  siteEq: 1,
  photos: 1,
};

const WORKER_NAV_ITEMS: Array<{
  id: WorkerNavTab;
  lines: string[];
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
}> = [
  {
    id: 'home',
    lines: ['Cantiere'],
    icon: HardHat,
    activeClass: 'text-blue-700 font-semibold bg-blue-500/10',
  },
  {
    id: 'hours',
    lines: ['Ore'],
    icon: Clock,
    activeClass: 'text-teal-700 font-semibold bg-teal-500/10',
  },
  {
    id: 'materials',
    lines: ['Materiali'],
    icon: Package,
    activeClass: 'text-orange-700 font-semibold bg-orange-500/10',
  },
  {
    id: 'equipment',
    lines: ['Mezzi e', 'Attrezzature'],
    icon: Wrench,
    activeClass: 'text-amber-700 font-semibold bg-amber-500/10',
  },
  {
    id: 'photos',
    lines: ['Foto'],
    icon: Camera,
    activeClass: 'text-violet-700 font-semibold bg-violet-500/10',
  },
];

function revokeBlobPreviews(items: SelectedPhotoItem[]): void {
  items.forEach((item) => {
    if (item.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
}

interface WorkerMobileViewProps {
  externalTabRequest?: { tab: WorkerNavTab; nonce: number } | null;
}

export const WorkerMobileView: React.FC<WorkerMobileViewProps> = ({
  externalTabRequest,
}) => {
  const {
    currentUser,
    db,
    updatePhase,
    addEquipmentUsageLog,
    updateEquipmentLog,
    deleteEquipmentLog,
    addTimeEntry,
    addMaterialLog,
    updateMaterialLog,
    deleteMaterialLog,
    addPhotoLogs,
    updatePhotoLog,
    deletePhotoLog,
  } = useApp();

  const [activeTab, setActiveTab] = useState<WorkerNavTab>('home');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  useEffect(() => {
    if (!externalTabRequest) return;
    setActiveTab(externalTabRequest.tab);
  }, [externalTabRequest]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<MobileListKey, number>>(INITIAL_MOBILE_PAGES);
  const [pageSizes, setPageSizes] = useState<Partial<Record<MobileListKey, number>>>({});
  const setPage = (key: MobileListKey, page: number) =>
    setPages((prev) => ({ ...prev, [key]: page }));
  const getPageSize = (key: MobileListKey) => pageSizes[key] ?? DEFAULT_PAGE_SIZE;
  const setListPageSize = (key: MobileListKey, size: number) =>
    setPageSizes((prev) => ({ ...prev, [key]: size }));

  const workerId = currentUser?.id || '';
  const workerName = currentUser?.name || 'Dipendente';
  const workerType = currentUser?.workerType || 'Edilizia';
  const workerInitials = currentUser?.avatarInitials || 'DP';

  // Only non-completed sites to which the authenticated employee is assigned
  const accessibleSites = db.sites
    .filter(
      (site) =>
        site.status !== 'Completato' &&
        (site.assignedWorkerIds || []).includes(workerId)
    )
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  const selectedSite =
    accessibleSites.find((s) => s.id === selectedSiteId) ||
    accessibleSites[0] ||
    null;

  const sitePhases = db.phases
    .filter((p) => p.siteId === selectedSite?.id)
    .sort((a, b) => a.order - b.order);

  // null = non ancora scelta esplicitamente (usa prima fase disponibile); '' = scelta esplicita "Generale Cantiere"
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  const currentPhaseId =
    selectedPhaseId === ''
      ? ''
      : selectedPhaseId && sitePhases.some((p) => p.id === selectedPhaseId)
      ? selectedPhaseId
      : sitePhases[0]?.id || '';

  // Time Entry Form
  const [regularHours, setRegularHours] = useState<number>(8);
  const [workDate, setWorkDate] = useState<string>(() => getLocalDateString());
  const [workDescription, setWorkDescription] = useState<string>('');
  const [isSavingHours, setIsSavingHours] = useState(false);
  const hoursRequestIdRef = useRef<string | null>(null);

  // Material Form
  const materialFormRef = useRef<HTMLFormElement | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<MaterialLog | null>(null);
  const [matCode, setMatCode] = useState<string>('');
  const [matName, setMatName] = useState<string>('');
  const [matCategory, setMatCategory] = useState<MaterialLog['category']>('Elettrico');
  const [matQty, setMatQty] = useState<number>(1);
  const [matUnit, setMatUnit] = useState<MaterialLog['unit']>('pz');
  const [matDate, setMatDate] = useState<string>(() => getLocalDateString());
  const [matNotes, setMatNotes] = useState<string>('');
  const [isSavingMaterial, setIsSavingMaterial] = useState(false);
  const materialRequestIdRef = useRef<string | null>(null);

  // Equipment Form & Logs State
  const eqFormRef = useRef<HTMLDivElement | null>(null);
  const [editingEqLog, setEditingEqLog] = useState<EquipmentLog | null>(null);
  const [selectedEqId, setSelectedEqId] = useState<string>('');
  const [eqUsageDate, setEqUsageDate] = useState<string>(() => getLocalDateString());
  const [eqUsageHours, setEqUsageHours] = useState<string>('');
  const [eqUsageNotes, setEqUsageNotes] = useState<string>('');
  const [isSavingEq, setIsSavingEq] = useState(false);
  const eqRequestIdRef = useRef<string | null>(null);

  // Photo Form & Viewer State
  const photoFormRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const selectedPhotosRef = useRef<SelectedPhotoItem[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhotoItem[]>([]);
  const [photoCaption, setPhotoCaption] = useState<string>('');
  const [photoTag, setPhotoTag] = useState<PhotoTag>('Avanzamento Lavori');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [isSavingPhoto, setIsSavingPhoto] = useState<boolean>(false);
  const [editingPhoto, setEditingPhoto] = useState<PhotoLog | null>(null);
  const [viewerPhotoId, setViewerPhotoId] = useState<string | null>(null);

  selectedPhotosRef.current = selectedPhotos;

  const viewerPhoto = viewerPhotoId
    ? db.photoLogs.find((p) => p.id === viewerPhotoId) || null
    : null;

  const resetMaterialForm = useCallback(() => {
    setEditingMaterial(null);
    setMatCode('');
    setMatName('');
    setMatNotes('');
    setMatQty(1);
    materialRequestIdRef.current = null;
  }, []);

  const resetEqForm = useCallback(() => {
    setEditingEqLog(null);
    setSelectedEqId('');
    setEqUsageDate(getLocalDateString());
    setEqUsageHours('');
    setEqUsageNotes('');
    eqRequestIdRef.current = null;
  }, []);

  const resetPhotoForm = useCallback(() => {
    revokeBlobPreviews(selectedPhotosRef.current);
    setEditingPhoto(null);
    setSelectedPhotos([]);
    setPhotoCaption('');
    setPhotoTag('Avanzamento Lavori');
  }, []);

  useEffect(() => {
    setPages(INITIAL_MOBILE_PAGES);
    setSelectedPhaseId(null);
    hoursRequestIdRef.current = null;
    resetMaterialForm();
    resetEqForm();
    resetPhotoForm();
    setViewerPhotoId(null);
  }, [
    selectedSite?.id,
    workerId,
    resetMaterialForm,
    resetEqForm,
    resetPhotoForm,
  ]);

  useEffect(() => {
    if (activeTab !== 'materials' && editingMaterial) {
      resetMaterialForm();
    }
    if (activeTab !== 'equipment' && editingEqLog) {
      resetEqForm();
    }
    if (activeTab !== 'photos' && editingPhoto) {
      resetPhotoForm();
    }
    if (activeTab !== 'photos' && viewerPhotoId) {
      setViewerPhotoId(null);
    }
  }, [
    activeTab,
    editingMaterial,
    editingEqLog,
    editingPhoto,
    viewerPhotoId,
    resetMaterialForm,
    resetEqForm,
    resetPhotoForm,
  ]);

  useEffect(() => {
    if (!viewerPhotoId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setViewerPhotoId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [viewerPhotoId]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      revokeBlobPreviews(selectedPhotosRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3600);
  };

  if (!currentUser) return null;

  const workerSiteTimeEntries = db.timeEntries
    .filter((t) => t.siteId === selectedSite?.id && t.workerId === workerId)
    .sort(compareByDateDesc);

  const workerSiteTotalHours = workerSiteTimeEntries.reduce(
    (sum, t) => sum + (Number(t.regularHours) || 0),
    0
  );

  const handleSaveHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite || isSavingHours) return;
    const reg = Number(regularHours) || 0;
    if (reg <= 0) {
      showToast('Inserisci almeno 0,5 ore lavorate.');
      return;
    }
    if (!workDescription.trim()) {
      showToast('Inserisci la descrizione dei lavori svolti.');
      return;
    }

    const wasInactive =
      selectedSite.status === 'Pianificato' ||
      selectedSite.status === 'Sospeso';
    if (!hoursRequestIdRef.current) {
      hoursRequestIdRef.current = generateUuid();
    }

    setIsSavingHours(true);
    try {
      await addTimeEntry({
        siteId: selectedSite.id,
        phaseId: currentPhaseId,
        workerId,
        workerName,
        date: workDate,
        regularHours: reg,
        description: workDescription.trim(),
        clientRequestId: hoursRequestIdRef.current,
      });
      hoursRequestIdRef.current = null;
      setWorkDescription('');
      setPage('hours', 1);
      showToast(
        wasInactive
          ? "Ore lavorate registrate. Il cantiere è passato automaticamente in stato 'In Corso'."
          : 'Ore lavorate registrate e inviate in amministrazione.'
      );
    } catch (err) {
      showToast(toFriendlyErrorMessage(err));
    } finally {
      setIsSavingHours(false);
    }
  };

  const siteMaterials = db.materialLogs
    .filter((m) => m.siteId === selectedSite?.id)
    .sort(compareByDateDesc);

  const startEditMaterial = (mat: MaterialLog) => {
    setEditingMaterial(mat);
    setSelectedPhaseId(mat.phaseId || '');
    setMatDate(mat.date);
    setMatCode(mat.articleCode || '');
    setMatName(mat.materialName || '');
    setMatCategory(mat.category);
    setMatQty(mat.quantity);
    setMatUnit(mat.unit);
    setMatNotes(mat.notes || '');
    materialFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeleteMaterial = async (matId: string) => {
    try {
      await deleteMaterialLog(matId);
      if (editingMaterial?.id === matId) {
        resetMaterialForm();
      }
      showToast('Materiale eliminato.');
    } catch (err) {
      showToast(toFriendlyErrorMessage(err));
    }
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite || isSavingMaterial) return;

    const qty = Number(matQty);
    if (Number.isNaN(qty) || qty <= 0) {
      showToast('Inserisci una quantità valida.');
      return;
    }

    if (editingMaterial) {
      if (!matCode.trim() && !matName.trim()) {
        showToast("Inserisci almeno il codice o il nome dell'articolo.");
        return;
      }
      setIsSavingMaterial(true);
      try {
        await updateMaterialLog({
          ...editingMaterial,
          phaseId: currentPhaseId,
          date: matDate,
          articleCode: matCode.trim() || undefined,
          materialName: matName.trim() || undefined,
          category: matCategory,
          quantity: qty,
          unit: matUnit,
          notes: matNotes.trim() || undefined,
        });
        resetMaterialForm();
        showToast('Materiale aggiornato.');
      } catch (err) {
        showToast(toFriendlyErrorMessage(err));
      } finally {
        setIsSavingMaterial(false);
      }
      return;
    }

    if (!matCode.trim()) {
      showToast("Inserisci il codice dell'articolo.");
      return;
    }

    const wasInactive =
      selectedSite.status === 'Pianificato' ||
      selectedSite.status === 'Sospeso';
    if (!materialRequestIdRef.current) {
      materialRequestIdRef.current = generateUuid();
    }

    setIsSavingMaterial(true);
    try {
      await addMaterialLog({
        siteId: selectedSite.id,
        phaseId: currentPhaseId,
        workerId,
        workerName,
        date: matDate,
        articleCode: matCode.trim(),
        materialName: matName.trim() || undefined,
        category: matCategory,
        quantity: qty,
        unit: matUnit,
        notes: matNotes.trim() || undefined,
        clientRequestId: materialRequestIdRef.current,
      });
      resetMaterialForm();
      setPage('materials', 1);
      showToast(
        wasInactive
          ? "Consumo materiale registrato. Il cantiere è passato automaticamente in stato 'In Corso'."
          : 'Consumo materiale registrato sul cantiere.'
      );
    } catch (err) {
      showToast(toFriendlyErrorMessage(err));
    } finally {
      setIsSavingMaterial(false);
    }
  };

  const operationalEquipment = db.equipment.filter(
    (eq) => eq.status !== 'In Manutenzione'
  );
  const selectableEquipmentForForm =
    editingEqLog &&
    !operationalEquipment.some((eq) => eq.id === editingEqLog.equipmentId)
      ? [
          ...operationalEquipment,
          ...db.equipment.filter((eq) => eq.id === editingEqLog.equipmentId),
        ]
      : operationalEquipment;
  const activeSelectedEqId = selectableEquipmentForForm.some(
    (eq) => eq.id === selectedEqId
  )
    ? selectedEqId
    : selectableEquipmentForForm[0]?.id || '';
  const siteEquipmentLogs = db.equipmentLogs
    .filter((l) => l.siteId === selectedSite?.id)
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  const isOwnEquipmentLog = (log: EquipmentLog): boolean =>
    log.actorId
      ? log.actorId === workerId
      : log.actorRole === 'Dipendente' && log.actorName === workerName;

  const startEditEquipmentLog = (log: EquipmentLog) => {
    setEditingEqLog(log);
    setSelectedEqId(log.equipmentId);
    const parsedDate = (log.timestamp || '').slice(0, 10);
    setEqUsageDate(
      /^\d{4}-\d{2}-\d{2}$/.test(parsedDate)
        ? parsedDate
        : getLocalDateString()
    );
    setEqUsageHours(
      log.hoursUsed !== undefined && log.hoursUsed > 0
        ? String(log.hoursUsed)
        : ''
    );
    setEqUsageNotes(log.notes || '');
    eqFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeleteEquipmentLog = async (logId: string) => {
    try {
      await deleteEquipmentLog(logId);
      if (editingEqLog?.id === logId) {
        resetEqForm();
      }
      showToast('Utilizzo mezzo eliminato.');
    } catch (err) {
      showToast(toFriendlyErrorMessage(err));
    }
  };

  const handleLogEquipmentUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite || !activeSelectedEqId || isSavingEq) return;
    const eq = db.equipment.find((item) => item.id === activeSelectedEqId);
    if (!eq) return;

    const parsedHours = Number(eqUsageHours);
    const validHours =
      eqUsageHours.trim() !== '' &&
      !Number.isNaN(parsedHours) &&
      parsedHours > 0
        ? parsedHours
        : undefined;

    if (editingEqLog) {
      const existingTimeSuffix =
        (editingEqLog.timestamp || '').slice(11, 16) ||
        formatLocalTimestamp().slice(11, 16);
      setIsSavingEq(true);
      try {
        await updateEquipmentLog({
          ...editingEqLog,
          equipmentId: eq.id,
          equipmentName: eq.name,
          timestamp: `${eqUsageDate || getLocalDateString()} ${existingTimeSuffix}`,
          hoursUsed: validHours,
          notes: eqUsageNotes.trim() || undefined,
        });
        resetEqForm();
        showToast('Utilizzo mezzo aggiornato.');
      } catch (err) {
        showToast(toFriendlyErrorMessage(err));
      } finally {
        setIsSavingEq(false);
      }
      return;
    }

    const timeSuffix = formatLocalTimestamp().slice(11, 16);
    if (!eqRequestIdRef.current) {
      eqRequestIdRef.current = generateUuid();
    }

    setIsSavingEq(true);
    try {
      await addEquipmentUsageLog({
        equipmentId: eq.id,
        equipmentName: eq.name,
        siteId: selectedSite.id,
        actorId: workerId,
        actorName: workerName,
        actorRole: 'Dipendente',
        hoursUsed: validHours,
        timestamp: `${eqUsageDate || getLocalDateString()} ${timeSuffix}`,
        notes: eqUsageNotes.trim() || undefined,
        clientRequestId: eqRequestIdRef.current,
      });
      eqRequestIdRef.current = null;
      setEqUsageHours('');
      setEqUsageNotes('');
      setPage('siteEq', 1);
      showToast(
        validHours
          ? `Utilizzo registrato: ${eq.code} (${validHours}h).`
          : `Utilizzo registrato: ${eq.code}.`
      );
    } catch (err) {
      showToast(toFriendlyErrorMessage(err));
    } finally {
      setIsSavingEq(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setIsCompressing(true);
    try {
      const { items, failedCount } = await compressImageFilesToBlobs(
        files,
        1280,
        0.82
      );
      if (items.length > 0) {
        if (editingPhoto) {
          revokeBlobPreviews(selectedPhotos);
          setSelectedPhotos([items[0]]);
        } else {
          setSelectedPhotos((prev) => [...prev, ...items]);
        }
      }
      if (failedCount > 0) {
        showToast(
          items.length === 0
            ? 'Impossibile elaborare le immagini selezionate. Riprova con file validi.'
            : `${failedCount} immagine/i non valida/e ignorata/e.`
        );
      }
    } catch (err) {
      console.error(err);
      showToast('Impossibile elaborare questa immagine. Riprova con un file valido.');
    } finally {
      setIsCompressing(false);
    }
  };

  const startEditPhoto = (photo: PhotoLog) => {
    revokeBlobPreviews(selectedPhotos);
    setEditingPhoto(photo);
    setSelectedPhaseId(photo.phaseId || '');
    setPhotoTag(photo.tag);
    setPhotoCaption(photo.caption || '');
    setSelectedPhotos([{ previewUrl: photo.imageUrl }]);
    setViewerPhotoId(null);
    photoFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await deletePhotoLog(photoId);
      if (editingPhoto?.id === photoId) {
        resetPhotoForm();
      }
      if (viewerPhotoId === photoId) {
        setViewerPhotoId(null);
      }
      showToast('Foto eliminata.');
    } catch (err) {
      showToast(toFriendlyErrorMessage(err));
    }
  };

  const handleSavePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite || isSavingPhoto || isCompressing) return;

    if (editingPhoto) {
      setIsSavingPhoto(true);
      try {
        await updatePhotoLog({
          photo: {
            ...editingPhoto,
            phaseId: currentPhaseId,
            tag: photoTag,
            caption: photoCaption.trim(),
          },
          newBlob: selectedPhotos[0]?.blob,
        });
        resetPhotoForm();
        showToast('Foto aggiornata.');
      } catch (err) {
        showToast(toFriendlyErrorMessage(err));
      } finally {
        setIsSavingPhoto(false);
      }
      return;
    }

    const uploadItems = selectedPhotos.filter(
      (item): item is { blob: Blob; previewUrl: string } => Boolean(item.blob)
    );
    if (uploadItems.length === 0) return;

    const count = uploadItems.length;
    const today = getLocalDateString();
    const trimmedCaption = photoCaption.trim();

    setIsSavingPhoto(true);
    try {
      await addPhotoLogs(
        uploadItems.map((item) => ({
          siteId: selectedSite.id,
          phaseId: currentPhaseId,
          workerId,
          workerName,
          uploaderRole: 'worker',
          date: today,
          blob: item.blob,
          caption: trimmedCaption,
          tag: photoTag,
        }))
      );
      revokeBlobPreviews(selectedPhotos);
      setSelectedPhotos([]);
      setPhotoCaption('');
      setPage('photos', 1);
      showToast(
        count === 1
          ? 'Fotografia caricata e visibile in amministrazione.'
          : `${count} fotografie caricate e visibili in amministrazione.`
      );
    } catch (err) {
      showToast(toFriendlyErrorMessage(err));
    } finally {
      setIsSavingPhoto(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-100 flex justify-center md:py-4 md:px-4">
      <div className="w-full max-w-xl bg-slate-50 md:rounded-2xl md:border md:border-slate-200 md:shadow-sm flex flex-col justify-between relative overflow-hidden">
        {/* Top Mobile Header */}
        <div className="bg-slate-900 text-white px-4 pt-3 pb-4 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-200 font-semibold flex items-center justify-center text-xs">
                {workerInitials}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-white">
                    {workerName}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {workerType}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Dipendente
                </div>
              </div>
            </div>
          </div>

          {/* Active Site Selector */}
          <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              I Tuoi Cantieri Attivi ({accessibleSites.length})
            </label>
            {accessibleSites.length === 0 ? (
              <div className="text-xs text-slate-400 py-1 font-medium">
                Nessun cantiere attivo assegnato a {workerName}
              </div>
            ) : (
              <>
                <select
                  value={selectedSite?.id || ''}
                  onChange={(e) => {
                    setSelectedSiteId(e.target.value);
                    setSelectedPhaseId(null);
                  }}
                  className="w-full bg-slate-900 text-white text-xs font-semibold rounded-md px-2.5 py-2 border border-slate-700 focus:outline-none focus:border-slate-500"
                >
                  {accessibleSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.code}] {s.name}
                    </option>
                  ))}
                </select>
                {selectedSite && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300 mt-2 px-1">
                    <a
                      href={buildGoogleMapsUrl(
                        selectedSite.address,
                        selectedSite.city
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Apri su Google Maps"
                      className="flex items-center gap-1 min-w-0 text-sky-300 hover:text-sky-200 underline decoration-sky-400/50 underline-offset-2 transition"
                    >
                      <MapPin className="w-3 h-3 text-sky-400 shrink-0" />
                      <span className="truncate">
                        {selectedSite.address}, {selectedSite.city}
                      </span>
                    </a>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          selectedSite.status === 'In Corso'
                            ? 'bg-blue-500/20 text-blue-200 border-blue-400/40'
                            : selectedSite.status === 'Sospeso'
                            ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                            : 'bg-sky-500/20 text-sky-200 border-sky-400/40'
                        }`}
                      >
                        {selectedSite.status}
                      </span>
                      <span className="font-semibold text-white">
                        {selectedSite.progress}%
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Toast Feedback Notification */}
        {toastMessage && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-md flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Scrollable Body Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedSite && (
            <div className="bg-white rounded-xl p-6 border border-slate-200 text-center space-y-2 my-8 shadow-sm">
              <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                <HardHat className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">
                Nessun Cantiere Attivo Disponibile
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Non puoi accedere ai cantieri completati o ai cantieri ai quali l&apos;Amministratore non ti ha assegnato.
              </p>
            </div>
          )}

          {/* MOBILE TAB 1: HOME CANTIERE & AZIONI RAPIDE */}
          {activeTab === 'home' && selectedSite && (
            <>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Operazioni Rapide
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    {
                      tab: 'hours' as const,
                      label: 'Segna Ore',
                      icon: Clock,
                      cardClass: 'bg-teal-50/70 hover:bg-teal-50 border-teal-200/80',
                      iconClass: 'bg-teal-500/15 text-teal-700',
                      labelClass: 'text-teal-950',
                    },
                    {
                      tab: 'materials' as const,
                      label: 'Materiali Usati',
                      icon: Package,
                      cardClass: 'bg-orange-50/70 hover:bg-orange-50 border-orange-200/80',
                      iconClass: 'bg-orange-500/15 text-orange-700',
                      labelClass: 'text-orange-950',
                    },
                    {
                      tab: 'equipment' as const,
                      label: 'Mezzi e Attrezzature',
                      icon: Wrench,
                      cardClass: 'bg-amber-50/70 hover:bg-amber-50 border-amber-200/80',
                      iconClass: 'bg-amber-500/15 text-amber-700',
                      labelClass: 'text-amber-950',
                    },
                    {
                      tab: 'photos' as const,
                      label: 'Scatta Foto',
                      icon: Camera,
                      cardClass: 'bg-violet-50/70 hover:bg-violet-50 border-violet-200/80',
                      iconClass: 'bg-violet-500/15 text-violet-700',
                      labelClass: 'text-violet-950',
                    },
                  ].map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <button
                        key={action.tab}
                        type="button"
                        onClick={() => setActiveTab(action.tab)}
                        className={`p-3.5 rounded-xl active:scale-[0.99] text-slate-900 border text-left shadow-sm transition flex flex-col justify-between h-20 ${action.cardClass}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${action.iconClass}`}
                        >
                          <ActionIcon className="w-4 h-4" />
                        </div>
                        <div
                          className={`font-semibold text-sm leading-tight ${action.labelClass}`}
                        >
                          {action.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Work Phases */}
              {(() => {
                const pageSize = getPageSize('phases');
                const { items: pagedPhases, safePage } = paginate(
                  sitePhases,
                  pages.phases,
                  pageSize
                );
                return (
                  <div className="space-y-2.5">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Fasi di Lavoro ({sitePhases.length})
                    </h2>

                    {sitePhases.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-white p-4 rounded-xl border border-slate-200">
                        Nessuna fase programmata su questo cantiere.
                      </p>
                    ) : (
                      <>
                        {pagedPhases.map((phase) => (
                          <div
                            key={phase.id}
                            className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm"
                          >
                            <h3 className="font-semibold text-slate-900 text-sm">
                              {phase.title}
                            </h3>
                            <p className="text-xs text-slate-600 mt-1">
                              {phase.description}
                            </p>

                            <div className="mt-3 pt-2.5 border-t border-slate-100">
                              <PhaseProgressSlider
                                value={phase.progress}
                                ariaLabel={`Avanzamento fase ${phase.title}`}
                                getAccentClassName={(draft) =>
                                  draft === 100
                                    ? 'accent-emerald-600'
                                    : 'accent-slate-800'
                                }
                                renderHeader={(draft) => (
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-slate-500">
                                      Avanzamento Fase ({phaseStatusFromProgress(draft)})
                                    </span>
                                    <span className="font-bold text-slate-900">
                                      {draft}%
                                    </span>
                                  </div>
                                )}
                                onCommit={(val) => {
                                  void updatePhase({
                                    ...phase,
                                    progress: val,
                                    status: phaseStatusFromProgress(val),
                                  }).catch((err) => {
                                    showToast(toFriendlyErrorMessage(err));
                                  });
                                }}
                              />
                            </div>
                          </div>
                        ))}

                        <Pagination
                          compact
                          currentPage={safePage}
                          totalItems={sitePhases.length}
                          pageSize={pageSize}
                          onPageChange={(p) => setPage('phases', p)}
                          onPageSizeChange={(size) => setListPageSize('phases', size)}
                        />
                      </>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {/* MOBILE TAB 2: SEGNA ORE LAVORATE */}
          {activeTab === 'hours' && selectedSite && (
            <div className="space-y-4">
              <form
                onSubmit={handleSaveHours}
                className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3.5"
              >
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Inserisci Rapportino Ore</span>
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fase di Lavoro
                  </label>
                  <select
                    value={currentPhaseId}
                    onChange={(e) => setSelectedPhaseId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">Generale Cantiere</option>
                    {sitePhases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Data *
                    </label>
                    <input
                      type="date"
                      required
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                    />
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
                      value={regularHours}
                      onChange={(e) => setRegularHours(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[4, 6, 8].map((h) => (
                    <button
                      type="button"
                      key={h}
                      onClick={() => setRegularHours(h)}
                      className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 border border-slate-200"
                    >
                      {h}h Giornata
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Descrizione Lavori Svolti *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="es. Posa tubazioni corrugate e scatole derivazione Piano 2..."
                    value={workDescription}
                    onChange={(e) => setWorkDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingHours}
                  className="w-full py-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-sm shadow-sm transition"
                >
                  {isSavingHours ? 'Invio in corso...' : 'Registra Ore Lavorate'}
                </button>
              </form>

              {(() => {
                const pageSize = getPageSize('hours');
                const { items: pagedHours, safePage } = paginate(
                  workerSiteTimeEntries,
                  pages.hours,
                  pageSize
                );
                const phaseById = new Map(sitePhases.map((p) => [p.id, p]));
                return (
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                        Le tue ore su {selectedSite.code} (
                        {workerSiteTimeEntries.length})
                      </h4>
                      <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-900 border border-teal-300/80 font-bold text-[11px] shrink-0">
                        Tot. {workerSiteTotalHours}h
                      </span>
                    </div>

                    {workerSiteTimeEntries.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        Nessuna ora registrata da te per questo cantiere.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {pagedHours.map((t) => {
                            const phase = phaseById.get(t.phaseId);
                            return (
                              <div
                                key={t.id}
                                className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-semibold text-slate-800">
                                      {t.date}
                                    </span>
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 truncate max-w-[170px]">
                                      {phase ? phase.title : 'Generale Cantiere'}
                                    </span>
                                  </div>
                                  <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-950 border border-teal-300 font-bold text-[11px] shrink-0">
                                    {t.regularHours}h
                                  </span>
                                </div>
                                {t.description && (
                                  <p className="text-[11px] text-slate-700 leading-relaxed">
                                    {t.description}
                                  </p>
                                )}
                                <div className="text-[10px] text-slate-400">
                                  Registrato: {t.createdAt}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <Pagination
                          compact
                          currentPage={safePage}
                          totalItems={workerSiteTimeEntries.length}
                          pageSize={pageSize}
                          onPageChange={(p) => setPage('hours', p)}
                          onPageSizeChange={(size) => setListPageSize('hours', size)}
                        />
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* MOBILE TAB 3: MATERIALI CONSUMATI */}
          {activeTab === 'materials' && selectedSite && (
            <div className="space-y-4">
              <form
                ref={materialFormRef}
                onSubmit={handleSaveMaterial}
                className={`bg-white rounded-xl p-4 border shadow-sm space-y-3.5 ${
                  editingMaterial
                    ? 'border-orange-300 ring-1 ring-orange-200/70'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-500" />
                    <span>
                      {editingMaterial
                        ? 'Modifica Materiale Registrato'
                        : 'Segna Materiali Consumati'}
                    </span>
                  </h3>
                  {editingMaterial && (
                    <button
                      type="button"
                      onClick={resetMaterialForm}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition"
                    >
                      Annulla
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Fase di Lavoro
                    </label>
                    <select
                      value={currentPhaseId}
                      onChange={(e) => setSelectedPhaseId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium bg-white"
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
                      value={matDate}
                      onChange={(e) => setMatDate(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Codice Articolo {!editingMaterial || !matName.trim() ? '*' : '(opzionale)'}
                  </label>
                  <input
                    type="text"
                    required={!editingMaterial || !matName.trim()}
                    placeholder="es. EL-0042"
                    value={matCode}
                    onChange={(e) => setMatCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Materiale (opzionale)
                  </label>
                  <input
                    type="text"
                    placeholder="es. Cavo FG16OR16 3G2,5 mmq"
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Categoria
                    </label>
                    <select
                      value={matCategory}
                      onChange={(e) =>
                        setMatCategory(e.target.value as MaterialLog['category'])
                      }
                      className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      {MATERIAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat === 'Sicurezza/Ferramenta' ? 'Ferramenta' : cat}
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
                      min={0.5}
                      step={0.5}
                      required
                      value={matQty}
                      onChange={(e) => setMatQty(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Unità
                    </label>
                    <select
                      value={matUnit}
                      onChange={(e) =>
                        setMatUnit(e.target.value as MaterialLog['unit'])
                      }
                      className="w-full px-2 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      {MATERIAL_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit === 'm' ? 'metri (m)' : unit}
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
                    placeholder="es. Prelevato da magazzino furgone"
                    value={matNotes}
                    onChange={(e) => setMatNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingMaterial}
                  className="w-full py-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-sm shadow-sm transition"
                >
                  {isSavingMaterial
                    ? 'Salvataggio...'
                    : editingMaterial
                    ? 'Salva modifiche'
                    : 'Registra materiale'}
                </button>
              </form>

              {(() => {
                const pageSize = getPageSize('materials');
                const { items: pagedMaterials, safePage } = paginate(
                  siteMaterials,
                  pages.materials,
                  pageSize
                );
                const phaseById = new Map(sitePhases.map((p) => [p.id, p]));
                return (
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2.5">
                    <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                      Materiali su {selectedSite.code} ({siteMaterials.length})
                    </h4>

                    {siteMaterials.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        Nessun materiale registrato per questo cantiere.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {pagedMaterials.map((mat) => {
                            const phase = phaseById.get(mat.phaseId);
                            const isOwn = mat.workerId === workerId;
                            return (
                              <div
                                key={mat.id}
                                className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-800 border border-orange-200/70">
                                        {mat.category}
                                      </span>
                                      {mat.articleCode && mat.materialName && (
                                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800">
                                          Cod. {mat.articleCode}
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className={`font-semibold text-slate-900 text-xs mt-1 ${
                                        !mat.materialName && mat.articleCode
                                          ? 'font-mono'
                                          : ''
                                      }`}
                                    >
                                      {mat.materialName
                                        ? mat.materialName
                                        : mat.articleCode
                                        ? `Cod. ${mat.articleCode}`
                                        : '—'}
                                    </div>
                                  </div>
                                  <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-950 border border-orange-300 font-bold text-[11px] shrink-0">
                                    {mat.quantity} {mat.unit}
                                  </span>
                                </div>

                                {phase && (
                                  <div className="text-[11px] text-slate-500">
                                    {phase.title}
                                  </div>
                                )}
                                {mat.notes && (
                                  <p className="text-[11px] text-slate-600">
                                    Nota: {mat.notes}
                                  </p>
                                )}

                                <div className="flex items-center justify-between gap-2 pt-0.5">
                                  <span className="text-[10px] text-slate-400">
                                    {mat.date} • {mat.workerName}
                                  </span>
                                  {isOwn && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => startEditMaterial(mat)}
                                        className="p-1 rounded-md text-slate-400 hover:text-orange-700 hover:bg-orange-50 transition"
                                        title="Modifica materiale"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <InlineConfirmDelete
                                        onConfirm={() =>
                                          void handleDeleteMaterial(mat.id)
                                        }
                                        title="Elimina materiale"
                                        iconClassName="w-3.5 h-3.5"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <Pagination
                          compact
                          currentPage={safePage}
                          totalItems={siteMaterials.length}
                          pageSize={pageSize}
                          onPageChange={(p) => setPage('materials', p)}
                          onPageSizeChange={(size) =>
                            setListPageSize('materials', size)
                          }
                        />
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* MOBILE TAB 4: MEZZI & ATTREZZATURE */}
          {activeTab === 'equipment' && selectedSite && (
            <div className="space-y-4">
              {/* Card 1: Registra o modifica utilizzo mezzo */}
              <div
                ref={eqFormRef}
                className={`bg-white rounded-xl p-4 border shadow-sm space-y-3.5 ${
                  editingEqLog
                    ? 'border-amber-300 ring-1 ring-amber-200/70'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-amber-600" />
                      <span>
                        {editingEqLog
                          ? 'Modifica Utilizzo Mezzo'
                          : 'Registra Utilizzo Mezzo'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {editingEqLog
                        ? 'Aggiorna mezzo, data, ore o note della registrazione.'
                        : 'Seleziona il mezzo usato ed eventuale durata in ore.'}
                    </p>
                  </div>
                  {editingEqLog && (
                    <button
                      type="button"
                      onClick={resetEqForm}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
                    >
                      Annulla
                    </button>
                  )}
                </div>

                {selectableEquipmentForForm.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    Nessun mezzo operativo disponibile al momento.
                  </p>
                ) : (
                  <form onSubmit={handleLogEquipmentUsage} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mezzo / Attrezzatura *
                      </label>
                      <select
                        required
                        value={activeSelectedEqId}
                        onChange={(e) => setSelectedEqId(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                      >
                        {EQUIPMENT_CATEGORIES.map((cat) => {
                          const items = selectableEquipmentForForm.filter(
                            (eq) => eq.category === cat
                          );
                          if (items.length === 0) return null;
                          return (
                            <optgroup key={cat} label={cat}>
                              {items.map((eq) => (
                                <option key={eq.id} value={eq.id}>
                                  [{eq.code}] {eq.name}
                                  {eq.status === 'In Manutenzione'
                                    ? ' (In Manutenzione)'
                                    : ''}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Data *
                        </label>
                        <input
                          type="date"
                          required
                          value={eqUsageDate}
                          onChange={(e) => setEqUsageDate(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Ore (opzionale)
                        </label>
                        <input
                          type="number"
                          min={0.5}
                          max={24}
                          step={0.5}
                          placeholder="es. 4"
                          value={eqUsageHours}
                          onChange={(e) => setEqUsageHours(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Note (opzionale)
                      </label>
                      <input
                        type="text"
                        placeholder="es. Trasporto materiale o lavorazione..."
                        value={eqUsageNotes}
                        onChange={(e) => setEqUsageNotes(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingEq}
                      className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs shadow-sm transition"
                    >
                      {isSavingEq
                        ? 'Salvataggio...'
                        : editingEqLog
                        ? 'Salva modifiche'
                        : 'Registra Utilizzo Mezzo'}
                    </button>
                  </form>
                )}
              </div>

              {/* Card 2: Registro utilizzi del cantiere */}
              {(() => {
                const pageSize = getPageSize('siteEq');
                const { items: pagedEqLogs, safePage } = paginate(
                  siteEquipmentLogs,
                  pages.siteEq,
                  pageSize
                );
                const eqById = new Map(db.equipment.map((e) => [e.id, e]));
                return (
                  <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-2.5">
                    <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                      Utilizzi su {selectedSite.code} ({siteEquipmentLogs.length})
                    </h4>
                    {siteEquipmentLogs.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        Nessun utilizzo mezzi registrato per questo cantiere.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {pagedEqLogs.map((log) => {
                            const eq = eqById.get(log.equipmentId);
                            const isOwn = isOwnEquipmentLog(log);
                            return (
                              <div
                                key={log.id}
                                className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    {eq && (
                                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                                        {eq.code}
                                      </span>
                                    )}
                                    <div className="font-semibold text-slate-900 text-xs mt-1">
                                      {log.equipmentName}
                                    </div>
                                  </div>
                                  {log.hoursUsed !== undefined &&
                                    log.hoursUsed > 0 && (
                                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-950 border border-amber-300 font-bold text-[11px] shrink-0">
                                        {log.hoursUsed}h
                                      </span>
                                    )}
                                </div>
                                {log.notes && (
                                  <p className="text-[11px] text-slate-600">
                                    {log.notes}
                                  </p>
                                )}
                                <div className="flex items-center justify-between gap-2 pt-0.5">
                                  <span className="text-[10px] text-slate-400">
                                    {log.actorName} • {log.timestamp}
                                  </span>
                                  {isOwn && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => startEditEquipmentLog(log)}
                                        className="p-1 rounded-md text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition"
                                        title="Modifica utilizzo mezzo"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <InlineConfirmDelete
                                        onConfirm={() =>
                                          void handleDeleteEquipmentLog(log.id)
                                        }
                                        title="Elimina utilizzo mezzo"
                                        iconClassName="w-3.5 h-3.5"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <Pagination
                          compact
                          currentPage={safePage}
                          totalItems={siteEquipmentLogs.length}
                          pageSize={pageSize}
                          onPageChange={(p) => setPage('siteEq', p)}
                          onPageSizeChange={(size) => setListPageSize('siteEq', size)}
                        />
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* MOBILE TAB 5: DOCUMENTAZIONE FOTOGRAFICA STATO LAVORI */}
          {activeTab === 'photos' && selectedSite && (
            <div className="space-y-4">
              <form
                ref={photoFormRef}
                onSubmit={handleSavePhoto}
                className={`bg-white rounded-xl p-4 border shadow-sm space-y-3.5 ${
                  editingPhoto
                    ? 'border-violet-300 ring-1 ring-violet-200/70'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span>
                      {editingPhoto
                        ? 'Modifica Foto Caricata'
                        : 'Documenta Stato Lavori con Foto'}
                    </span>
                  </h3>
                  {editingPhoto && (
                    <button
                      type="button"
                      onClick={resetPhotoForm}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold transition"
                    >
                      Annulla
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple={!editingPhoto}
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {editingPhoto
                      ? 'Sostituisci Foto'
                      : 'Fotocamera / Galleria'}
                  </span>
                </button>

                {isCompressing && (
                  <p className="text-xs text-slate-600 font-medium text-center">
                    Compressione e ottimizzazione foto in corso...
                  </p>
                )}

                <PhotoPreviewGrid
                  urls={selectedPhotos.map((item) => item.previewUrl)}
                  allowRemoveSingle={!editingPhoto}
                  countLabel={(count) => `${count} foto pronte`}
                  onRemoveAt={(idx) =>
                    setSelectedPhotos((prev) => {
                      const target = prev[idx];
                      if (target) revokeBlobPreviews([target]);
                      return prev.filter((_, i) => i !== idx);
                    })
                  }
                  onClearAll={() => {
                    revokeBlobPreviews(selectedPhotos);
                    setSelectedPhotos([]);
                  }}
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Fase di Lavoro Documentata
                  </label>
                  <select
                    value={currentPhaseId}
                    onChange={(e) => setSelectedPhaseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium bg-white"
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
                    Categoria Foto
                  </label>
                  <select
                    value={photoTag}
                    onChange={(e) => setPhotoTag(e.target.value as PhotoTag)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
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
                    placeholder="es. Posa tubazioni e prova in pressione collettore Piano 2..."
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    (!editingPhoto && selectedPhotos.length === 0) ||
                    isCompressing ||
                    isSavingPhoto
                  }
                  className={`w-full py-3 rounded-lg font-semibold text-sm transition ${
                    (editingPhoto || selectedPhotos.length > 0) &&
                    !isCompressing &&
                    !isSavingPhoto
                      ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isSavingPhoto
                    ? 'Caricamento in corso...'
                    : editingPhoto
                    ? 'Salva modifiche'
                    : selectedPhotos.length > 1
                    ? `Carica ${selectedPhotos.length} Foto`
                    : 'Invia Foto in Amministrazione'}
                </button>
              </form>

              {/* Recent Photos on this Site */}
              {(() => {
                const sitePhotosList = db.photoLogs
                  .filter((p) => p.siteId === selectedSite.id)
                  .sort((a, b) =>
                    (b.createdAt || '').localeCompare(a.createdAt || '')
                  );
                const pageSize = getPageSize('photos');
                const { items: pagedPhotos, safePage } = paginate(
                  sitePhotosList,
                  pages.photos,
                  pageSize
                );
                return (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Foto su {selectedSite.code} ({sitePhotosList.length})
                    </h4>
                    {sitePhotosList.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        Nessuna foto ancora caricata su questo cantiere.
                      </p>
                    ) : (
                      <>
                        {pagedPhotos.map((p) => {
                          const phase = sitePhases.find((ph) => ph.id === p.phaseId);
                          const isOwn =
                            p.workerId === workerId && p.uploaderRole === 'worker';
                          return (
                            <div
                              key={p.id}
                              onClick={() => setViewerPhotoId(p.id)}
                              className="bg-white p-2.5 rounded-lg border border-slate-200 hover:border-violet-300 transition flex gap-3 items-center cursor-pointer"
                            >
                              <img
                                src={p.imageUrl}
                                alt={p.caption || p.tag}
                                className="w-16 h-14 rounded-md object-cover bg-slate-900 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-medium text-slate-500">
                                    {p.tag}
                                  </span>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-800 border border-violet-200/70 truncate max-w-[180px]">
                                    {phase ? phase.title : 'Generale Cantiere'}
                                  </span>
                                </div>
                                {p.caption && (
                                  <p className="text-xs font-medium text-slate-900 truncate mt-0.5">
                                    {p.caption}
                                  </p>
                                )}
                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-400 truncate">
                                    {p.workerName} • {p.createdAt}
                                  </span>
                                  {isOwn && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1 shrink-0"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => startEditPhoto(p)}
                                        className="p-1 rounded-md text-slate-400 hover:text-violet-700 hover:bg-violet-50 transition"
                                        title="Modifica foto"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <InlineConfirmDelete
                                        onConfirm={() => void handleDeletePhoto(p.id)}
                                        title="Elimina foto"
                                        iconClassName="w-3.5 h-3.5"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        <Pagination
                          compact
                          currentPage={safePage}
                          totalItems={sitePhotosList.length}
                          pageSize={pageSize}
                          onPageChange={(p) => setPage('photos', p)}
                          onPageSizeChange={(size) => setListPageSize('photos', size)}
                        />
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Full-screen Photo Viewer Modal */}
        {viewerPhoto &&
          (() => {
            const viewerPhase = db.phases.find(
              (ph) => ph.id === viewerPhoto.phaseId
            );
            const isOwnViewerPhoto =
              viewerPhoto.workerId === workerId &&
              viewerPhoto.uploaderRole === 'worker';
            return (
              <div
                onClick={() => setViewerPhotoId(null)}
                className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-w-md w-full shadow-2xl"
                >
                  <div className="relative bg-slate-950">
                    <img
                      src={viewerPhoto.imageUrl}
                      alt={viewerPhoto.caption || viewerPhoto.tag}
                      className="max-h-[65vh] w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setViewerPhotoId(null)}
                      aria-label="Chiudi foto"
                      className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-2.5 text-white">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-violet-500/20 text-violet-200 border border-violet-400/30">
                        {viewerPhoto.tag}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                        {viewerPhase ? viewerPhase.title : 'Generale Cantiere'}
                      </span>
                    </div>

                    {viewerPhoto.caption && (
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {viewerPhoto.caption}
                      </p>
                    )}

                    <div className="text-[11px] text-slate-400">
                      {viewerPhoto.workerName} • {viewerPhoto.createdAt}
                    </div>

                    {isOwnViewerPhoto && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => startEditPhoto(viewerPhoto)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Modifica</span>
                        </button>
                        <InlineConfirmDelete
                          onConfirm={() => void handleDeletePhoto(viewerPhoto.id)}
                          buttonLabel="Elimina"
                          title="Elimina foto"
                          iconClassName="w-3.5 h-3.5"
                          buttonClassName="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 hover:text-red-200 hover:bg-red-500/15 border border-red-400/30 transition"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Bottom Mobile Navigation Bar */}
        <nav
          aria-label="Navigazione dipendente"
          className="bg-white border-t border-slate-200 px-1.5 py-1.5 grid grid-cols-5 gap-1 shrink-0"
        >
          {WORKER_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-start pt-2 pb-1.5 px-0.5 rounded-xl transition ${
                  isActive
                    ? item.activeClass
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="text-[10px] leading-[1.15] tracking-tight mt-1 text-center">
                  {item.lines.map((line, idx) => (
                    <React.Fragment key={line}>
                      {idx > 0 && <br />}
                      {line}
                    </React.Fragment>
                  ))}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
