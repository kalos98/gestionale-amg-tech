import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  Building2,
  Calendar,
  Camera,
  Clock,
  Download,
  Edit3,
  Filter,
  HardHat,
  MapPin,
  Package,
  Plus,
  Printer,
  Settings,
  Trash2,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import {
  Equipment,
  EquipmentLog,
  MaterialLog,
  PhaseStatus,
  PhotoLog,
  Site,
  SiteStatus,
  TimeEntry,
  WorkPhase,
  Worker,
} from '../../types/models';
import {
  EQUIPMENT_CATEGORIES,
  PHASE_STATUSES,
  SITE_STATUSES,
  getPhaseStatusBadge,
  getProgressColor,
  getSiteStatusBadge,
  getSliderAccent,
} from '../../constants/domain';
import {
  aggregateEquipmentHours,
  autoProgressFromPhaseStatus,
  buildGoogleMapsUrl,
  phaseStatusFromProgress,
} from '../../utils/formatters';
import { Pagination, paginate } from '../Pagination';
import { InlineConfirmDelete } from '../ui/InlineConfirmDelete';
import { PhaseProgressSlider } from '../ui/PhaseProgressSlider';

export type SiteDetailTab = 'phases' | 'equipment' | 'hours' | 'materials' | 'photos';
export type SiteDetailListKey =
  | 'phases'
  | 'siteEqLogs'
  | 'hours'
  | 'materials'
  | 'photos';

interface SiteDetailViewProps {
  site: Site;
  workers: Worker[];
  phases: WorkPhase[];
  allEquipment: Equipment[];
  siteEquipmentLogs: EquipmentLog[];
  siteTimeEntries: TimeEntry[];
  siteMaterials: MaterialLog[];
  sitePhotos: PhotoLog[];
  detailTab: SiteDetailTab;
  onDetailTabChange: (tab: SiteDetailTab) => void;
  siteEqCategoryFilter: string;
  onSiteEqCategoryFilterChange: (cat: string) => void;
  photoPhaseFilter: string;
  onPhotoPhaseFilterChange: (phaseId: string) => void;
  pages: Record<SiteDetailListKey, number>;
  onPageChange: (key: SiteDetailListKey, page: number) => void;
  getPageSize: (key: SiteDetailListKey) => number;
  onPageSizeChange: (key: SiteDetailListKey, size: number) => void;
  onBackToList: () => void;
  onOpenPdfModal: () => void;
  onOpenEditSiteModal: () => void;
  onDeleteSite: () => void;
  onUpdateSiteStatus: (status: SiteStatus, progress: number) => void;
  onToggleWorkerOnSite: (workerId: string) => void;
  onOpenNewPhaseModal: () => void;
  onOpenEditPhaseModal: (phase: WorkPhase) => void;
  onUpdatePhase: (phase: WorkPhase) => void;
  onDeletePhase: (phaseId: string) => void;
  onOpenNewEqUsageModal: () => void;
  onOpenEditEqUsageModal: (log: EquipmentLog) => void;
  onDeleteEquipmentLog: (logId: string) => void;
  onOpenNewTimeModal: () => void;
  onOpenEditTimeModal: (entry: TimeEntry) => void;
  onDeleteTimeEntry: (entryId: string) => void;
  onOpenNewMaterialModal: () => void;
  onOpenEditMaterialModal: (mat: MaterialLog) => void;
  onDeleteMaterialLog: (matId: string) => void;
  onOpenUploadPhotoModal: (preselectedPhaseId?: string) => void;
  onOpenLightbox: (photo: PhotoLog) => void;
  onDownloadPhoto: (photo: PhotoLog, e?: React.MouseEvent) => void;
  onDeletePhoto: (photoId: string) => void;
}

export const SiteDetailView: React.FC<SiteDetailViewProps> = ({
  site,
  workers,
  phases,
  allEquipment,
  siteEquipmentLogs,
  siteTimeEntries,
  siteMaterials,
  sitePhotos,
  detailTab,
  onDetailTabChange,
  siteEqCategoryFilter,
  onSiteEqCategoryFilterChange,
  photoPhaseFilter,
  onPhotoPhaseFilterChange,
  pages,
  onPageChange,
  getPageSize,
  onPageSizeChange,
  onBackToList,
  onOpenPdfModal,
  onOpenEditSiteModal,
  onDeleteSite,
  onUpdateSiteStatus,
  onToggleWorkerOnSite,
  onOpenNewPhaseModal,
  onOpenEditPhaseModal,
  onUpdatePhase,
  onDeletePhase,
  onOpenNewEqUsageModal,
  onOpenEditEqUsageModal,
  onDeleteEquipmentLog,
  onOpenNewTimeModal,
  onOpenEditTimeModal,
  onDeleteTimeEntry,
  onOpenNewMaterialModal,
  onOpenEditMaterialModal,
  onDeleteMaterialLog,
  onOpenUploadPhotoModal,
  onOpenLightbox,
  onDownloadPhoto,
  onDeletePhoto,
}) => {
  const [confirmDeleteSite, setConfirmDeleteSite] = useState(false);
  const [showSiteActionsMenu, setShowSiteActionsMenu] = useState(false);
  const [activeSiteDrawer, setActiveSiteDrawer] = useState<'none' | 'workers'>('none');
  const [photoSortOrder, setPhotoSortOrder] = useState<'newest' | 'oldest'>('newest');
  const siteActionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConfirmDeleteSite(false);
    setShowSiteActionsMenu(false);
    setActiveSiteDrawer('none');
    setPhotoSortOrder('newest');
  }, [site.id]);

  useEffect(() => {
    if (!showSiteActionsMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        siteActionsMenuRef.current &&
        !siteActionsMenuRef.current.contains(event.target as Node)
      ) {
        setShowSiteActionsMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSiteActionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSiteActionsMenu]);

  const siteWorkerIds = new Set<string>(site.assignedWorkerIds || []);
  const assignedSiteWorkers = workers.filter((w) => siteWorkerIds.has(w.id));
  const assignableWorkers = workers.filter(
    (w) => w.active || siteWorkerIds.has(w.id)
  );

  return (
    <>
      {/* TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToList}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs sm:text-sm font-semibold shadow-sm transition"
        >
          <ArrowLeft className="w-4 h-4 text-blue-600" />
          <span>Torna alla lista Cantieri</span>
        </button>

        <div className="text-xs text-slate-400 font-medium hidden sm:block">
          Cantieri /{' '}
          <span className="text-slate-700 font-semibold">{site.code}</span>
        </div>
      </div>

      {/* SCHEDA DESCRITTIVA DEL CANTIERE */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-5 border-b border-slate-100">
          <div className="space-y-2.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-800 border border-blue-200/80 font-mono text-xs font-semibold">
                {site.code}
              </span>
              {(site.sectors || []).map((sec) => (
                <span
                  key={sec}
                  className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-medium"
                >
                  {sec}
                </span>
              ))}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              {site.name}
            </h2>
            {site.description && (
              <p className="text-sm text-slate-600 leading-relaxed">
                {site.description}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 min-w-[285px] shrink-0">
            <div className="flex justify-end">
              <div ref={siteActionsMenuRef} className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setShowSiteActionsMenu(!showSiteActionsMenu)}
                  title="Impostazioni Cantiere"
                  aria-label="Impostazioni Cantiere"
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 border border-slate-200/90 transition flex items-center justify-center shadow-sm"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {showSiteActionsMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-30 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSiteDrawer(
                          activeSiteDrawer === 'workers' ? 'none' : 'workers'
                        );
                        setShowSiteActionsMenu(false);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-slate-700 hover:bg-indigo-50/60 flex items-center gap-2.5"
                    >
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>Assegna Dipendenti</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSiteActionsMenu(false);
                        onOpenEditSiteModal();
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-slate-700 hover:bg-blue-50/60 flex items-center gap-2.5 border-t border-slate-100"
                    >
                      <Edit3 className="w-4 h-4 text-blue-600" />
                      <span>Modifica Informazioni Cantiere</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSiteActionsMenu(false);
                        onOpenPdfModal();
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-slate-700 hover:bg-slate-100 flex items-center gap-2.5 border-t border-slate-100"
                    >
                      <Printer className="w-4 h-4 text-slate-600" />
                      <span>Stampa Report Cantiere (PDF)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteSite(true);
                        setShowSiteActionsMenu(false);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2.5 border-t border-slate-100"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                      <span>Archivia Cantiere</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {confirmDeleteSite && (
              <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <span className="text-xs font-semibold text-red-800">
                  Confermi archiviazione cantiere?
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onDeleteSite}
                    className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                  >
                    Sì, archivia
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteSite(false)}
                    className="px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-medium"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/90">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Fase / Stato del Cantiere
              </label>
              <select
                value={site.status}
                onChange={(e) => {
                  const nextStatus = e.target.value as SiteStatus;
                  onUpdateSiteStatus(
                    nextStatus,
                    nextStatus === 'Completato' ? 100 : site.progress
                  );
                }}
                className={`w-full text-sm font-semibold px-3 py-2 rounded-lg border cursor-pointer transition-colors ${getSiteStatusBadge(
                  site.status
                )}`}
              >
                {SITE_STATUSES.map((st) => (
                  <option key={st} value={st} className="bg-white text-slate-900">
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/90">
              {phases.length === 0 ? (
                <div>
                  <PhaseProgressSlider
                    value={site.progress}
                    ariaLabel="Avanzamento complessivo cantiere"
                    getAccentClassName={(draft) =>
                      getSliderAccent(draft, draft === 100 || site.status === 'Completato')
                    }
                    renderHeader={(draft) => (
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span>Avanzamento Complessivo</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {draft}%
                        </span>
                      </div>
                    )}
                    onCommit={(val) =>
                      onUpdateSiteStatus(
                        val === 100
                          ? 'Completato'
                          : val > 0
                          ? 'In Corso'
                          : 'Pianificato',
                        val
                      )
                    }
                  />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Nessuna fase presente: trascina per regolare l'avanzamento
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span>Avanzamento Complessivo</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {site.progress}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`${getProgressColor(
                        site.progress,
                        site.status === 'Completato'
                      )} h-full rounded-full transition-all`}
                      style={{ width: `${site.progress}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-400 block">Ubicazione Cantiere</span>
              <a
                href={buildGoogleMapsUrl(site.address, site.city)}
                target="_blank"
                rel="noopener noreferrer"
                title="Apri su Google Maps"
                className="font-medium text-blue-700 hover:text-blue-900 hover:underline transition inline-block"
              >
                {site.address}, {site.city}
              </a>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-400 block">Committente</span>
              <span className="font-medium text-slate-800">{site.client}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-slate-400 block">Cronoprogramma</span>
              <span className="font-medium text-slate-800">
                Dal {site.startDate} al {site.endDate}
              </span>
            </div>
          </div>
        </div>

        {/* Riepilogo Dipendenti del Cantiere */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-100/80">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-900/70 block mb-2">
              Dipendenti Assegnati al Cantiere ({assignedSiteWorkers.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {assignedSiteWorkers.length === 0 ? (
                <span className="text-xs text-slate-400 italic">
                  Nessun dipendente assegnato
                </span>
              ) : (
                assignedSiteWorkers.map((w) => (
                  <span
                    key={w.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-indigo-950 border border-indigo-200/80 text-xs font-medium shadow-sm"
                  >
                    <HardHat className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{w.name}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          {activeSiteDrawer === 'workers' && (
            <div className="mt-4 p-4 rounded-xl bg-indigo-50/40 border border-indigo-200/70 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-950">
                  Assegna Dipendenti al Cantiere: {site.name}
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveSiteDrawer('none')}
                  className="text-xs text-slate-500 hover:text-slate-900 font-semibold"
                >
                  Chiudi ×
                </button>
              </div>
              {assignableWorkers.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  Nessun dipendente attivo in organico. Aggiungi i dipendenti dalla sezione Dipendenti.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {assignableWorkers.map((w) => {
                    const isChecked = siteWorkerIds.has(w.id);
                    return (
                      <label
                        key={w.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                          isChecked
                            ? 'bg-indigo-500/10 border-indigo-400/80'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => onToggleWorkerOnSite(w.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-medium text-slate-900">
                            {w.name}
                            {!w.active ? ' (Disattivato)' : ''}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SUB-NAVIGATION TABS FOR SELECTED SITE */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-2">
          {(
            [
              {
                id: 'phases' as const,
                label: `Fasi di Lavoro (${phases.length})`,
                icon: Calendar,
                activeClass: 'bg-blue-600 text-white border-blue-600 shadow-sm',
                inactiveHoverClass: 'hover:bg-blue-50/50',
                inactiveIconClass: 'text-blue-500',
              },
              {
                id: 'equipment' as const,
                label: `Mezzi & Attrezzature (${siteEquipmentLogs.length})`,
                icon: Wrench,
                activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm',
                inactiveHoverClass: 'hover:bg-amber-50/50',
                inactiveIconClass: 'text-amber-500',
              },
              {
                id: 'hours' as const,
                label: `Ore Lavorate (${siteTimeEntries.length})`,
                icon: Clock,
                activeClass: 'bg-teal-600 text-white border-teal-600 shadow-sm',
                inactiveHoverClass: 'hover:bg-teal-50/50',
                inactiveIconClass: 'text-teal-500',
              },
              {
                id: 'materials' as const,
                label: `Materiali Consumati (${siteMaterials.length})`,
                icon: Package,
                activeClass: 'bg-orange-600 text-white border-orange-600 shadow-sm',
                inactiveHoverClass: 'hover:bg-orange-50/50',
                inactiveIconClass: 'text-orange-500',
              },
              {
                id: 'photos' as const,
                label: `Galleria Cantiere (${sitePhotos.length})`,
                icon: Camera,
                activeClass: 'bg-violet-600 text-white border-violet-600 shadow-sm',
                inactiveHoverClass: 'hover:bg-violet-50/50',
                inactiveIconClass: 'text-violet-500',
              },
            ] as const
          ).map((tab) => {
            const TabIcon = tab.icon;
            const isActive = detailTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onDetailTabChange(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 border ${
                  isActive
                    ? tab.activeClass
                    : `bg-white text-slate-600 ${tab.inactiveHoverClass} border-slate-200`
                }`}
              >
                <TabIcon
                  className={`w-4 h-4 ${
                    isActive ? 'text-white' : tab.inactiveIconClass
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {detailTab === 'phases' && (
          <button
            type="button"
            onClick={onOpenNewPhaseModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Programma Nuova Fase</span>
          </button>
        )}
      </div>

      {/* SITE SUB-TAB 1: PROGRAMMAZIONE FASI DI LAVORO */}
      {detailTab === 'phases' && (
        <div className="space-y-4">
          {phases.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
              <p className="text-slate-500 font-medium text-sm">
                Nessuna fase di lavoro ancora programmata per questo cantiere.
              </p>
            </div>
          ) : (
            (() => {
              const pageSize = getPageSize('phases');
              const { items: pagedPhases, safePage } = paginate(
                phases,
                pages.phases,
                pageSize
              );
              return (
                <>
                  {pagedPhases.map((phase) => {
                    const isPhaseCompleted = phase.status === 'Completata';
                    return (
                      <div
                        key={phase.id}
                        className={`bg-white rounded-2xl border shadow-sm p-5 transition ${
                          isPhaseCompleted
                            ? 'border-emerald-300/80 bg-emerald-50/15'
                            : 'border-slate-200/90 hover:border-blue-300/70'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={phase.status}
                                onChange={(e) => {
                                  const newStatus = e.target.value as PhaseStatus;
                                  onUpdatePhase({
                                    ...phase,
                                    status: newStatus,
                                    progress: autoProgressFromPhaseStatus(
                                      newStatus,
                                      phase.progress
                                    ),
                                  });
                                }}
                                className={`text-xs font-semibold px-3 py-0.5 rounded-full border cursor-pointer transition-colors ${getPhaseStatusBadge(
                                  phase.status
                                )}`}
                              >
                                {PHASE_STATUSES.map((ps) => (
                                  <option
                                    key={ps}
                                    value={ps}
                                    className="bg-white text-slate-900"
                                  >
                                    {ps}
                                  </option>
                                ))}
                              </select>

                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {phase.startDate} → {phase.endDate}
                              </span>
                            </div>

                            <h3 className="text-base font-semibold text-slate-900">
                              {phase.title}
                            </h3>
                            <p className="text-xs text-slate-600">
                              {phase.description}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 shrink-0">
                            <div className="w-48">
                              <PhaseProgressSlider
                                value={phase.progress}
                                ariaLabel={`Avanzamento fase ${phase.title}`}
                                getAccentClassName={(draft) =>
                                  getSliderAccent(
                                    draft,
                                    draft === 100 || isPhaseCompleted
                                  )
                                }
                                renderHeader={(draft) => (
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-500">
                                      Progresso fase
                                    </span>
                                    <span className="font-bold text-slate-900">
                                      {draft}%
                                    </span>
                                  </div>
                                )}
                                onCommit={(val) =>
                                  onUpdatePhase({
                                    ...phase,
                                    progress: val,
                                    status: phaseStatusFromProgress(val),
                                  })
                                }
                              />
                            </div>

                            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                              <button
                                type="button"
                                onClick={() => onOpenEditPhaseModal(phase)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                                title="Modifica fase"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <InlineConfirmDelete
                                onConfirm={() => onDeletePhase(phase.id)}
                                title="Elimina fase"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="bg-white rounded-2xl border border-slate-200/90 px-4 pb-3 pt-0.5 shadow-sm">
                    <Pagination
                      currentPage={safePage}
                      totalItems={phases.length}
                      pageSize={pageSize}
                      onPageChange={(p) => onPageChange('phases', p)}
                      onPageSizeChange={(s) => onPageSizeChange('phases', s)}
                    />
                  </div>
                </>
              );
            })()
          )}
        </div>
      )}

      {/* SITE SUB-TAB 2: MEZZI & ATTREZZATURE DEL CANTIERE */}
      {detailTab === 'equipment' &&
        (() => {
          const eqById = new Map(allEquipment.map((e) => [e.id, e]));

          const filteredSiteLogs = siteEquipmentLogs.filter((log) => {
            if (siteEqCategoryFilter === 'Tutte') return true;
            const eq = eqById.get(log.equipmentId);
            return eq ? eq.category === siteEqCategoryFilter : false;
          });

          const { totals: eqHoursList, totalHours: totalEqHours } =
            aggregateEquipmentHours(filteredSiteLogs, allEquipment);

          return (
            <div className="bg-white rounded-2xl border border-amber-200/70 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <Truck className="w-3.5 h-3.5" />
                    </div>
                    <span>
                      Registro Mezzi &amp; Attrezzature ({filteredSiteLogs.length})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Utilizzi mezzi e attrezzature registrati sul cantiere con eventuali ore e note.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-amber-600 shrink-0" />
                    <select
                      value={siteEqCategoryFilter}
                      onChange={(e) => onSiteEqCategoryFilterChange(e.target.value)}
                      aria-label="Filtra utilizzi per categoria"
                      className="bg-amber-50/50 border border-amber-200 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
                    >
                      <option value="Tutte">Tutte le categorie</option>
                      {EQUIPMENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={onOpenNewEqUsageModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Registra Utilizzo</span>
                  </button>
                </div>
              </div>

              {eqHoursList.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/80">
                      Riepilogo Ore Utilizzo
                    </span>
                    <span className="text-xs font-bold text-amber-950 bg-amber-500/20 px-2.5 py-0.5 rounded-md border border-amber-300">
                      Totale: {totalEqHours}h
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {eqHoursList.map((item) => (
                      <div
                        key={item.equipmentId}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-xs shadow-sm"
                      >
                        <span className="font-mono font-semibold text-amber-900">
                          [{item.code}]
                        </span>
                        <span className="font-medium text-slate-800">
                          {item.name}
                        </span>
                        <span className="font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
                          {item.hours}h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredSiteLogs.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Nessun utilizzo mezzi o attrezzature registrato per questa categoria sul cantiere.
                </p>
              ) : (
                (() => {
                  const pageSize = getPageSize('siteEqLogs');
                  const { items: pagedLogs, safePage } = paginate(
                    filteredSiteLogs,
                    pages.siteEqLogs,
                    pageSize
                  );
                  return (
                    <>
                      <div className="space-y-2.5">
                        {pagedLogs.map((log) => {
                          const eq = eqById.get(log.equipmentId);
                          return (
                            <div
                              key={log.id}
                              className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/20 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  {eq && (
                                    <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/12 text-amber-900 border border-amber-200/80">
                                      {eq.code}
                                    </span>
                                  )}
                                  {eq && (
                                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                                      {eq.category}
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-semibold text-slate-900 text-sm mt-1">
                                  {log.equipmentName}
                                </h4>
                                {log.notes && (
                                  <p className="text-xs text-slate-600 mt-1">
                                    Note: {log.notes}
                                  </p>
                                )}
                                <div className="text-[11px] text-slate-400 mt-1.5">
                                  {log.actorRole === 'Admin' ? 'Registrato da:' : 'Dipendente:'}{' '}
                                  <strong className="text-slate-600">{log.actorName}</strong> • {log.timestamp}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {log.hoursUsed !== undefined && log.hoursUsed > 0 && (
                                  <span className="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-950 border border-amber-300 font-bold text-xs">
                                    {log.hoursUsed}h
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onOpenEditEqUsageModal(log)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition"
                                  title="Modifica utilizzo mezzo"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                <InlineConfirmDelete
                                  onConfirm={() => onDeleteEquipmentLog(log.id)}
                                  title="Elimina utilizzo mezzo"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <Pagination
                        currentPage={safePage}
                        totalItems={filteredSiteLogs.length}
                        pageSize={pageSize}
                        onPageChange={(p) => onPageChange('siteEqLogs', p)}
                        onPageSizeChange={(s) => onPageSizeChange('siteEqLogs', s)}
                      />
                    </>
                  );
                })()
              )}
            </div>
          );
        })()}

      {/* SITE SUB-TAB 3: ORE LAVORATE */}
      {detailTab === 'hours' && (
        <div className="bg-white rounded-2xl border border-teal-200/70 shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-md bg-teal-500/10 text-teal-600 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span>
                Registro Ore Lavorate nel Cantiere ({siteTimeEntries.length})
              </span>
            </h3>

            <button
              type="button"
              onClick={onOpenNewTimeModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Aggiungi Ore Lavorate</span>
            </button>
          </div>
          <div className="space-y-3">
            {siteTimeEntries.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Nessun rapportino ore registrato per questo cantiere.
              </p>
            ) : (
              (() => {
                const pageSize = getPageSize('hours');
                const { items: pagedTimeEntries, safePage } = paginate(
                  siteTimeEntries,
                  pages.hours,
                  pageSize
                );
                return (
                  <>
                    {pagedTimeEntries.map((entry) => {
                      const phase = phases.find((p) => p.id === entry.phaseId);
                      return (
                        <div
                          key={entry.id}
                          className="p-3.5 rounded-xl border border-teal-100 bg-teal-50/20"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900 text-sm">
                              {entry.workerName}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-900 border border-teal-200 font-semibold text-xs">
                                {entry.regularHours}h
                              </span>

                              <button
                                type="button"
                                onClick={() => onOpenEditTimeModal(entry)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition"
                                title="Modifica ore lavorate"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <InlineConfirmDelete
                                onConfirm={() => onDeleteTimeEntry(entry.id)}
                                title="Elimina ore lavorate"
                              />
                            </div>
                          </div>
                          {phase && (
                            <div className="text-[11px] font-medium text-teal-800/80 mt-0.5">
                              {phase.title}
                            </div>
                          )}
                          {entry.description && (
                            <p className="text-xs text-slate-700 mt-1.5">
                              {entry.description}
                            </p>
                          )}
                          <div className="text-[10px] text-slate-400 mt-1">
                            Data: {entry.date} • Registrato: {entry.createdAt}
                          </div>
                        </div>
                      );
                    })}

                    <Pagination
                      currentPage={safePage}
                      totalItems={siteTimeEntries.length}
                      pageSize={pageSize}
                      onPageChange={(p) => onPageChange('hours', p)}
                      onPageSizeChange={(s) => onPageSizeChange('hours', s)}
                    />
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* SITE SUB-TAB 4: MATERIALI CONSUMATI */}
      {detailTab === 'materials' && (
        <div className="bg-white rounded-2xl border border-orange-200/70 shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
              <div className="w-6 h-6 rounded-md bg-orange-500/10 text-orange-600 flex items-center justify-center">
                <Package className="w-3.5 h-3.5" />
              </div>
              <span>
                Materiali Consumati in Cantiere ({siteMaterials.length})
              </span>
            </h3>

            <button
              type="button"
              onClick={onOpenNewMaterialModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Aggiungi Materiale</span>
            </button>
          </div>
          <div className="space-y-3">
            {siteMaterials.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                Nessun materiale scaricato per questo cantiere.
              </p>
            ) : (
              (() => {
                const pageSize = getPageSize('materials');
                const { items: pagedMaterials, safePage } = paginate(
                  siteMaterials,
                  pages.materials,
                  pageSize
                );
                return (
                  <>
                    {pagedMaterials.map((mat) => {
                      const phase = phases.find((p) => p.id === mat.phaseId);
                      return (
                        <div
                          key={mat.id}
                          className="p-3.5 rounded-xl border border-orange-100 bg-orange-50/20"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-orange-500/10 text-orange-800 border border-orange-200/60">
                                  {mat.category}
                                </span>
                                {mat.articleCode && mat.materialName && (
                                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300/80">
                                    Cod. {mat.articleCode}
                                  </span>
                                )}
                              </div>
                              <h4
                                className={`font-semibold text-slate-900 text-sm mt-1 ${
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
                              </h4>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-2.5 py-1 rounded-md bg-orange-500/15 text-orange-950 border border-orange-200 font-bold text-xs">
                                {mat.quantity} {mat.unit}
                              </span>

                              <button
                                type="button"
                                onClick={() => onOpenEditMaterialModal(mat)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-orange-700 hover:bg-orange-50 transition"
                                title="Modifica materiale registrato"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <InlineConfirmDelete
                                onConfirm={() => onDeleteMaterialLog(mat.id)}
                                title="Elimina materiale registrato"
                              />
                            </div>
                          </div>
                          {phase && (
                            <div className="text-[11px] text-slate-500 mt-1">
                              {phase.title}
                            </div>
                          )}
                          {mat.notes && (
                            <p className="text-xs text-slate-600 mt-1">
                              Nota: {mat.notes}
                            </p>
                          )}
                          <div className="text-[10px] text-slate-400 mt-1.5">
                            Data: {mat.date} • Segnato da: {mat.workerName} •{' '}
                            {mat.createdAt}
                          </div>
                        </div>
                      );
                    })}

                    <Pagination
                      currentPage={safePage}
                      totalItems={siteMaterials.length}
                      pageSize={pageSize}
                      onPageChange={(p) => onPageChange('materials', p)}
                      onPageSizeChange={(s) => onPageSizeChange('materials', s)}
                    />
                  </>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* SITE SUB-TAB 5: GALLERIA FOTOGRAFICA DEL CANTIERE */}
      {detailTab === 'photos' &&
        (() => {
          const hasPhases = phases.length > 0;
          const phaseMap = new Map(phases.map((p) => [p.id, p]));

          const generalPhotosCount = sitePhotos.filter(
            (ph) => !phaseMap.has(ph.phaseId)
          ).length;

          const effectiveFilter = !hasPhases
            ? 'ALL'
            : photoPhaseFilter === 'ALL'
            ? 'ALL'
            : photoPhaseFilter === 'NONE'
            ? generalPhotosCount > 0
              ? 'NONE'
              : 'ALL'
            : phaseMap.has(photoPhaseFilter)
            ? photoPhaseFilter
            : 'ALL';

          const filteredPhotos = sitePhotos.filter((ph) => {
            if (effectiveFilter === 'ALL') return true;
            if (effectiveFilter === 'NONE') return !phaseMap.has(ph.phaseId);
            return ph.phaseId === effectiveFilter;
          });

          const filteredOrderedPhotos = [...filteredPhotos].sort((a, b) => {
            const timeA = a.createdAt || a.date || '';
            const timeB = b.createdAt || b.date || '';
            return photoSortOrder === 'newest'
              ? timeB.localeCompare(timeA)
              : timeA.localeCompare(timeB);
          });

          const pageSize = getPageSize('photos');
          const { items: pagedPhotos, safePage } = paginate(
            filteredOrderedPhotos,
            pages.photos,
            pageSize
          );

          const showPhaseHeader = hasPhases && effectiveFilter !== 'ALL';
          const selectedPhaseObj =
            effectiveFilter !== 'ALL' && effectiveFilter !== 'NONE'
              ? phaseMap.get(effectiveFilter) || null
              : null;

          const renderPhotoCard = (photo: PhotoLog) => (
            <div
              key={photo.id}
              onClick={() => onOpenLightbox(photo)}
              className="group rounded-xl border border-slate-200 overflow-hidden bg-slate-50/70 hover:border-violet-300 hover:shadow-md transition cursor-pointer flex flex-col"
            >
              <div className="relative h-48 bg-slate-900 overflow-hidden">
                <img
                  src={photo.imageUrl}
                  alt={photo.caption || photo.tag}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <span className="absolute top-2.5 left-2.5 text-[10px] font-medium px-2.5 py-1 rounded-md bg-slate-900/80 text-white backdrop-blur-sm">
                  {photo.tag}
                </span>
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2.5 right-2.5 flex items-center gap-1.5"
                >
                  <button
                    type="button"
                    onClick={(e) => onDownloadPhoto(photo, e)}
                    className="p-2 rounded-lg bg-slate-900/80 hover:bg-white text-white hover:text-slate-900 transition shadow"
                    title="Scarica foto"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <InlineConfirmDelete
                    onConfirm={() => onDeletePhoto(photo.id)}
                    title="Elimina foto"
                    buttonClassName="p-2 rounded-lg bg-slate-900/80 hover:bg-red-600 text-white transition shadow"
                    iconClassName="w-3.5 h-3.5"
                  />
                </div>
              </div>
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  {photo.caption && (
                    <p className="text-xs font-medium text-slate-900">
                      {photo.caption}
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {photo.uploaderRole === 'admin'
                      ? `Amministratore: ${photo.workerName}`
                      : `Dipendente: ${photo.workerName}`}
                  </span>
                  <span>{photo.createdAt}</span>
                </div>
              </div>
            </div>
          );

          return (
            <div className="bg-white rounded-2xl border border-violet-200/70 shadow-sm p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-violet-500/10 text-violet-600 flex items-center justify-center">
                      <Camera className="w-3.5 h-3.5" />
                    </div>
                    <span>
                      Documentazione Fotografica Cantiere (
                      {filteredOrderedPhotos.length})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {showPhaseHeader
                      ? 'Foto della fase selezionata. Clicca su una foto per ingrandirla o gestirla.'
                      : 'Foto ordinate per data di caricamento. Clicca su una foto per ingrandirla o gestirla.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {hasPhases && (
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-violet-600" />
                      <select
                        value={effectiveFilter}
                        onChange={(e) => onPhotoPhaseFilterChange(e.target.value)}
                        aria-label="Filtra foto per fase"
                        className="bg-violet-50/50 border border-violet-200 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2 max-w-[260px]"
                      >
                        <option value="ALL">
                          Tutte le fasi ({sitePhotos.length})
                        </option>
                        {phases.map((p) => {
                          const count = sitePhotos.filter(
                            (ph) => ph.phaseId === p.id
                          ).length;
                          return (
                            <option key={p.id} value={p.id}>
                              {p.title} ({count})
                            </option>
                          );
                        })}
                        {generalPhotosCount > 0 && (
                          <option value="NONE">
                            Generale Cantiere ({generalPhotosCount})
                          </option>
                        )}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="w-4 h-4 text-violet-600 shrink-0" />
                    <select
                      value={photoSortOrder}
                      onChange={(e) => {
                        setPhotoSortOrder(e.target.value as 'newest' | 'oldest');
                        onPageChange('photos', 1);
                      }}
                      aria-label="Ordina foto per data di caricamento"
                      className="bg-violet-50/50 border border-violet-200 text-slate-900 text-xs font-semibold rounded-xl px-3 py-2"
                    >
                      <option value="newest">Più recenti</option>
                      <option value="oldest">Più vecchie</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenUploadPhotoModal(
                        effectiveFilter === 'ALL'
                          ? undefined
                          : effectiveFilter === 'NONE'
                          ? ''
                          : effectiveFilter
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Carica Foto</span>
                  </button>
                </div>
              </div>

              {filteredOrderedPhotos.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  {sitePhotos.length === 0
                    ? 'Nessuna foto ancora caricata per questo cantiere.'
                    : 'Nessuna foto presente per la fase selezionata.'}
                </p>
              ) : (
                <>
                  {showPhaseHeader ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-violet-50/70 border border-violet-200/80">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="text-xs sm:text-sm font-semibold text-violet-950 truncate">
                            {selectedPhaseObj
                              ? selectedPhaseObj.title
                              : 'Generale Cantiere'}
                          </span>
                          {selectedPhaseObj && (
                            <span
                              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getPhaseStatusBadge(
                                selectedPhaseObj.status
                              )}`}
                            >
                              {selectedPhaseObj.status}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-violet-800 bg-white px-2.5 py-0.5 rounded-md border border-violet-200/80 shrink-0">
                          {filteredOrderedPhotos.length} foto
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pagedPhotos.map(renderPhotoCard)}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pagedPhotos.map(renderPhotoCard)}
                    </div>
                  )}

                  <Pagination
                    currentPage={safePage}
                    totalItems={filteredOrderedPhotos.length}
                    pageSize={pageSize}
                    onPageChange={(p) => onPageChange('photos', p)}
                    onPageSizeChange={(s) => onPageSizeChange('photos', s)}
                  />
                </>
              )}
            </div>
          );
        })()}
    </>
  );
};
