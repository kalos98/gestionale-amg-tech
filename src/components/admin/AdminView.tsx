import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  Equipment,
  EquipmentLog,
  MaterialLog,
  PhotoLog,
  Site,
  SiteSector,
  TimeEntry,
  WorkPhase,
  WorkerType,
} from '../../types/models';
import { compareByDateDesc } from '../../utils/formatters';
import {
  PdfReportOptions,
  printSiteReportPdf,
} from '../../utils/pdfReportHelper';
import { DEFAULT_PAGE_SIZE } from '../Pagination';
import {
  AdminPhotoUploadModal,
  EquipmentModal,
  EquipmentUsageModal,
  MaterialLogModal,
  PdfReportModal,
  PhaseModal,
  PhotoLightboxModal,
  SiteModal,
  TimeEntryModal,
} from './AdminModals';
import { AdminsTab } from './AdminsTab';
import { DashboardTab } from './DashboardTab';
import { EquipmentTab } from './EquipmentTab';
import { SiteDetailTab, SiteDetailView } from './SiteDetailView';
import { SitesListTab } from './SitesListTab';
import { WorkersTab } from './WorkersTab';

export type AdminTab = 'dashboard' | 'sites' | 'equipment' | 'workers' | 'admins';
type AdminListKey =
  | 'sites'
  | 'phases'
  | 'siteEqLogs'
  | 'hours'
  | 'materials'
  | 'photos'
  | 'globalEq'
  | 'workers'
  | 'admins';

const INITIAL_PAGES: Record<AdminListKey, number> = {
  sites: 1,
  phases: 1,
  siteEqLogs: 1,
  hours: 1,
  materials: 1,
  photos: 1,
  globalEq: 1,
  workers: 1,
  admins: 1,
};

interface AdminViewProps {
  externalTabRequest?: { tab: AdminTab; nonce: number } | null;
}

export const AdminView: React.FC<AdminViewProps> = ({ externalTabRequest }) => {
  const {
    currentUser,
    db,
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
    deletePhotoLog,
  } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [siteDetailTab, setSiteDetailTab] = useState<SiteDetailTab>('phases');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!externalTabRequest) return;
    setActiveTab(externalTabRequest.tab);
    if (externalTabRequest.tab === 'sites') {
      setSelectedSiteId(null);
    }
  }, [externalTabRequest]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [activeTab, selectedSiteId]);

  // Filters state
  const [sectorFilter, setSectorFilter] = useState<string>('Tutti');
  const [siteStatusFilter, setSiteStatusFilter] = useState<string>('Tutti');
  const [siteSearchQuery, setSiteSearchQuery] = useState<string>('');
  const [equipmentCategoryFilter, setEquipmentCategoryFilter] =
    useState<string>('Tutte');
  const [siteEqCategoryFilter, setSiteEqCategoryFilter] =
    useState<string>('Tutte');
  const [photoPhaseFilter, setPhotoPhaseFilter] = useState<string>('ALL');
  const [workerTypeFilter, setWorkerTypeFilter] = useState<'Tutti' | WorkerType>(
    'Tutti'
  );

  // Pagination state (pages & per-list page sizes)
  const [pages, setPages] = useState<Record<AdminListKey, number>>(INITIAL_PAGES);
  const [pageSizes, setPageSizes] = useState<
    Partial<Record<AdminListKey, number>>
  >({});

  const getPageSize = (key: AdminListKey) =>
    pageSizes[key] ?? DEFAULT_PAGE_SIZE;
  const setPage = (key: AdminListKey, page: number) =>
    setPages((prev) => ({ ...prev, [key]: page }));
  const setListPageSize = (key: AdminListKey, size: number) =>
    setPageSizes((prev) => ({ ...prev, [key]: size }));

  useEffect(() => {
    setPages((prev) => ({ ...prev, sites: 1 }));
  }, [siteSearchQuery, sectorFilter, siteStatusFilter]);

  useEffect(() => {
    setPhotoPhaseFilter('ALL');
    setSiteEqCategoryFilter('Tutte');
    setPages((prev) => ({
      ...prev,
      phases: 1,
      siteEqLogs: 1,
      hours: 1,
      materials: 1,
      photos: 1,
    }));
  }, [selectedSiteId]);

  useEffect(() => {
    setPages((prev) => ({
      ...prev,
      siteEqLogs: 1,
    }));
  }, [siteEqCategoryFilter]);

  useEffect(() => {
    setPages((prev) => ({ ...prev, globalEq: 1 }));
  }, [equipmentCategoryFilter]);

  useEffect(() => {
    setPages((prev) => ({ ...prev, workers: 1 }));
  }, [workerTypeFilter]);

  // Modals state
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState<WorkPhase | null>(null);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(
    null
  );
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(
    null
  );
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterialLog, setEditingMaterialLog] =
    useState<MaterialLog | null>(null);
  const [showEqUsageModal, setShowEqUsageModal] = useState(false);
  const [editingEqLog, setEditingEqLog] = useState<EquipmentLog | null>(null);
  const [showPdfReportModal, setShowPdfReportModal] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<PdfReportOptions>({
    includeWorkers: true,
    includePhases: true,
    includeEquipmentHistory: true,
    includeHours: true,
    includeMaterials: true,
    includePhotos: true,
  });
  const [showPhotoUploadModal, setShowPhotoUploadModal] = useState(false);
  const [uploadPhotoPhaseId, setUploadPhotoPhaseId] = useState<string | undefined>(
    undefined
  );
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);

  const lightboxPhoto = lightboxPhotoId
    ? db.photoLogs.find((p) => p.id === lightboxPhotoId) || null
    : null;

  // Derived Collections
  const sortedSites = useMemo(
    () =>
      [...db.sites].sort((a, b) =>
        (b.startDate || '').localeCompare(a.startDate || '')
      ),
    [db.sites]
  );

  const existingSiteCodes = useMemo(
    () => db.sites.map((s) => s.code),
    [db.sites]
  );

  const existingEquipmentCodes = useMemo(
    () => db.equipment.map((e) => e.code),
    [db.equipment]
  );

  const selectedSite = selectedSiteId
    ? db.sites.find((s) => s.id === selectedSiteId) || null
    : null;

  const filteredSitesList = useMemo(
    () =>
      sortedSites.filter((s) => {
        const matchesSector =
          sectorFilter === 'Tutti' ||
          (s.sectors || []).includes(sectorFilter as SiteSector);
        const matchesStatus =
          siteStatusFilter === 'Tutti' || s.status === siteStatusFilter;
        const q = siteSearchQuery.trim().toLowerCase();
        const matchesSearch =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.client.toLowerCase().includes(q);
        return matchesSector && matchesStatus && matchesSearch;
      }),
    [sortedSites, sectorFilter, siteStatusFilter, siteSearchQuery]
  );

  const sitePhases = useMemo(
    () =>
      db.phases
        .filter((p) => p.siteId === selectedSite?.id)
        .sort((a, b) => a.order - b.order),
    [db.phases, selectedSite?.id]
  );

  const siteEquipmentLogs = useMemo(
    () =>
      db.equipmentLogs
        .filter((log) => log.siteId === selectedSite?.id)
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')),
    [db.equipmentLogs, selectedSite?.id]
  );

  const siteTimeEntries = useMemo(
    () =>
      db.timeEntries
        .filter((t) => t.siteId === selectedSite?.id)
        .sort(compareByDateDesc),
    [db.timeEntries, selectedSite?.id]
  );

  const siteMaterials = useMemo(
    () =>
      db.materialLogs
        .filter((m) => m.siteId === selectedSite?.id)
        .sort(compareByDateDesc),
    [db.materialLogs, selectedSite?.id]
  );

  const sitePhotos = useMemo(
    () =>
      db.photoLogs
        .filter((ph) => ph.siteId === selectedSite?.id)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [db.photoLogs, selectedSite?.id]
  );

  const filteredGlobalEquipment = useMemo(
    () =>
      db.equipment.filter(
        (eq) =>
          equipmentCategoryFilter === 'Tutte' ||
          eq.category === equipmentCategoryFilter
      ),
    [db.equipment, equipmentCategoryFilter]
  );

  if (!currentUser) return null;

  const currentAdminIdentity = {
    id: currentUser.id,
    name: currentUser.name,
  };

  const toggleWorkerOnSite = (workerId: string) => {
    if (!selectedSite) return;
    const current = selectedSite.assignedWorkerIds || [];
    const exists = current.includes(workerId);
    void setWorkerSiteAssignment(selectedSite.id, workerId, !exists).catch(
      () => {}
    );
  };

  const handleDownloadPhoto = async (photo: PhotoLog, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const site = db.sites.find((s) => s.id === photo.siteId);
    const filename = `foto-${site?.code || 'cantiere'}-${photo.date}-${photo.id.slice(0, 8)}.jpg`;

    try {
      const response = await fetch(photo.imageUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      const link = document.createElement('a');
      link.href = photo.imageUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = filename;
      link.click();
    }
  };

  const handlePrintPdfReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite) return;
    const assignedIds = new Set(selectedSite.assignedWorkerIds || []);
    const assignedWorkers = db.workers.filter((w) => assignedIds.has(w.id));

    printSiteReportPdf({
      site: selectedSite,
      workers: assignedWorkers,
      phases: sitePhases,
      equipment: db.equipment,
      equipmentLogs: siteEquipmentLogs,
      timeEntries: siteTimeEntries,
      materialLogs: siteMaterials,
      photoLogs: sitePhotos,
      options: pdfOptions,
    });
    setShowPdfReportModal(false);
  };

  const sidebarNavItems: Array<{
    id: AdminTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    activeClass: string;
    activeIconClass: string;
    onSelect: () => void;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard Generale',
      icon: LayoutDashboard,
      activeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30 font-semibold',
      activeIconClass: 'text-blue-400',
      onSelect: () => setActiveTab('dashboard'),
    },
    {
      id: 'sites',
      label: 'Cantieri',
      icon: Building2,
      activeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30 font-semibold',
      activeIconClass: 'text-blue-400',
      onSelect: () => {
        setActiveTab('sites');
        setSelectedSiteId(null);
      },
    },
    {
      id: 'equipment',
      label: 'Mezzi & Attrezzature',
      icon: Wrench,
      activeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold',
      activeIconClass: 'text-amber-400',
      onSelect: () => setActiveTab('equipment'),
    },
    {
      id: 'workers',
      label: 'Dipendenti',
      icon: Users,
      activeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 font-semibold',
      activeIconClass: 'text-indigo-400',
      onSelect: () => setActiveTab('workers'),
    },
    {
      id: 'admins',
      label: 'Amministratori',
      icon: ShieldCheck,
      activeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30 font-semibold',
      activeIconClass: 'text-blue-400',
      onSelect: () => setActiveTab('admins'),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row bg-slate-100/70 lg:overflow-hidden">
      {/* Left Desktop Sidebar (Anchored & Collapsible) */}
      <aside
        className={`w-full bg-slate-900 text-slate-300 shrink-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 lg:h-full lg:overflow-y-auto transition-all duration-200 ${
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-60'
        }`}
      >
        <div>
          <div
            className={`p-4 border-b border-slate-800/80 flex items-center gap-2 ${
              sidebarCollapsed
                ? 'justify-between lg:justify-center lg:px-2'
                : 'justify-between'
            }`}
          >
            <div className={sidebarCollapsed ? 'min-w-0 lg:hidden' : 'min-w-0'}>
              <div className="text-[11px] font-medium uppercase tracking-wider text-blue-400/80 truncate">
                Pannello di Controllo
              </div>
              <div className="text-sm font-semibold text-white mt-0.5 truncate">
                AMG Tech
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              title={
                sidebarCollapsed
                  ? 'Espandi barra laterale'
                  : 'Comprimi barra laterale'
              }
              aria-label={
                sidebarCollapsed
                  ? 'Espandi barra laterale'
                  : 'Comprimi barra laterale'
              }
              aria-expanded={!sidebarCollapsed}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700/80 transition shrink-0"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          <nav
            aria-label="Menu amministrazione"
            className={`${
              sidebarCollapsed
                ? 'hidden lg:flex lg:flex-col lg:items-center lg:px-2'
                : 'flex lg:flex-col px-3'
            } py-3 gap-1 overflow-x-auto`}
          >
            {sidebarNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onSelect}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center rounded-xl text-sm font-medium transition whitespace-nowrap border ${
                    sidebarCollapsed
                      ? 'lg:justify-center lg:px-0 lg:w-11 lg:h-11 gap-3 px-3.5 py-2.5 w-full'
                      : 'gap-3 px-3.5 py-2.5 w-full'
                  } ${
                    isActive
                      ? item.activeClass
                      : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? item.activeIconClass : 'text-slate-400'
                    }`}
                  />
                  <span className={sidebarCollapsed ? 'lg:hidden' : undefined}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {!sidebarCollapsed && (
          <div className="hidden lg:block px-4 py-3 m-3 rounded-xl bg-slate-800/50 border border-slate-800 text-[11px] text-slate-400">
            <div className="font-semibold text-slate-300">
              Sistema Multi-Utente
            </div>
            <p className="mt-0.5 leading-relaxed">
              Modifiche sincronizzate in tempo reale con protezione dei dati.
            </p>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main
        ref={mainRef}
        className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 lg:overflow-y-auto"
      >
        {activeTab === 'dashboard' && (
          <DashboardTab
            sites={db.sites}
            phases={db.phases}
            equipment={db.equipment}
            equipmentLogs={db.equipmentLogs}
            timeEntries={db.timeEntries}
            materialLogs={db.materialLogs}
            photoLogs={db.photoLogs}
            onSelectSite={(siteId) => {
              setSelectedSiteId(siteId);
              setSiteDetailTab('phases');
              setActiveTab('sites');
            }}
            onViewAllSites={() => {
              setSelectedSiteId(null);
              setActiveTab('sites');
            }}
            onOpenLightbox={(photo) => setLightboxPhotoId(photo.id)}
          />
        )}

        {activeTab === 'sites' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {!selectedSite ? (
              <SitesListTab
                filteredSitesList={filteredSitesList}
                phases={db.phases}
                equipmentLogs={db.equipmentLogs}
                siteSearchQuery={siteSearchQuery}
                onSearchChange={setSiteSearchQuery}
                sectorFilter={sectorFilter}
                onSectorFilterChange={setSectorFilter}
                siteStatusFilter={siteStatusFilter}
                onSiteStatusFilterChange={setSiteStatusFilter}
                sitesPage={pages.sites}
                onPageChange={(p) => setPage('sites', p)}
                pageSize={getPageSize('sites')}
                onPageSizeChange={(s) => setListPageSize('sites', s)}
                onOpenNewSite={() => {
                  setEditingSite(null);
                  setShowSiteModal(true);
                }}
                onSelectSite={(siteId) => {
                  setSelectedSiteId(siteId);
                  setSiteDetailTab('phases');
                }}
              />
            ) : (
              <SiteDetailView
                site={selectedSite}
                workers={db.workers}
                phases={sitePhases}
                allEquipment={db.equipment}
                siteEquipmentLogs={siteEquipmentLogs}
                siteTimeEntries={siteTimeEntries}
                siteMaterials={siteMaterials}
                sitePhotos={sitePhotos}
                detailTab={siteDetailTab}
                onDetailTabChange={setSiteDetailTab}
                siteEqCategoryFilter={siteEqCategoryFilter}
                onSiteEqCategoryFilterChange={setSiteEqCategoryFilter}
                photoPhaseFilter={photoPhaseFilter}
                onPhotoPhaseFilterChange={(val) => {
                  setPhotoPhaseFilter(val);
                  setPage('photos', 1);
                }}
                pages={{
                  phases: pages.phases,
                  siteEqLogs: pages.siteEqLogs,
                  hours: pages.hours,
                  materials: pages.materials,
                  photos: pages.photos,
                }}
                onPageChange={(key, page) => setPage(key, page)}
                getPageSize={(key) => getPageSize(key)}
                onPageSizeChange={(key, size) => setListPageSize(key, size)}
                onBackToList={() => setSelectedSiteId(null)}
                onOpenPdfModal={() => setShowPdfReportModal(true)}
                onOpenEditSiteModal={() => {
                  setEditingSite(selectedSite);
                  setShowSiteModal(true);
                }}
                onDeleteSite={() => {
                  void deleteSite(selectedSite.id)
                    .then(() => {
                      setSelectedSiteId(null);
                    })
                    .catch(() => {});
                }}
                onUpdateSiteStatus={(status, progress) => {
                  void updateSiteStatus(selectedSite.id, status, progress).catch(
                    () => {}
                  );
                }}
                onToggleWorkerOnSite={toggleWorkerOnSite}
                onOpenNewPhaseModal={() => {
                  setEditingPhase(null);
                  setShowPhaseModal(true);
                }}
                onOpenEditPhaseModal={(phase) => {
                  setEditingPhase(phase);
                  setShowPhaseModal(true);
                }}
                onUpdatePhase={(phase) => {
                  void updatePhase(phase).catch(() => {});
                }}
                onDeletePhase={(phaseId) => {
                  void deletePhase(phaseId).catch(() => {});
                }}
                onOpenNewEqUsageModal={() => {
                  setEditingEqLog(null);
                  setShowEqUsageModal(true);
                }}
                onOpenEditEqUsageModal={(log) => {
                  setEditingEqLog(log);
                  setShowEqUsageModal(true);
                }}
                onDeleteEquipmentLog={(logId) => {
                  void deleteEquipmentLog(logId).catch(() => {});
                }}
                onOpenNewTimeModal={() => {
                  setEditingTimeEntry(null);
                  setShowTimeModal(true);
                }}
                onOpenEditTimeModal={(entry) => {
                  setEditingTimeEntry(entry);
                  setShowTimeModal(true);
                }}
                onDeleteTimeEntry={(entryId) => {
                  void deleteTimeEntry(entryId).catch(() => {});
                }}
                onOpenNewMaterialModal={() => {
                  setEditingMaterialLog(null);
                  setShowMaterialModal(true);
                }}
                onOpenEditMaterialModal={(mat) => {
                  setEditingMaterialLog(mat);
                  setShowMaterialModal(true);
                }}
                onDeleteMaterialLog={(matId) => {
                  void deleteMaterialLog(matId).catch(() => {});
                }}
                onOpenUploadPhotoModal={(preselectedPhaseId) => {
                  setUploadPhotoPhaseId(preselectedPhaseId);
                  setShowPhotoUploadModal(true);
                }}
                onOpenLightbox={(photo) => setLightboxPhotoId(photo.id)}
                onDownloadPhoto={(photo, e) => {
                  void handleDownloadPhoto(photo, e);
                }}
                onDeletePhoto={(photoId) => {
                  void deletePhotoLog(photoId).catch(() => {});
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'equipment' && (
          <EquipmentTab
            equipment={db.equipment}
            equipmentLogs={db.equipmentLogs}
            filteredGlobalEquipment={filteredGlobalEquipment}
            sites={sortedSites}
            categoryFilter={equipmentCategoryFilter}
            onCategoryFilterChange={setEquipmentCategoryFilter}
            page={pages.globalEq}
            onPageChange={(p) => setPage('globalEq', p)}
            pageSize={getPageSize('globalEq')}
            onPageSizeChange={(s) => setListPageSize('globalEq', s)}
            onOpenNewEquipment={() => {
              setEditingEquipment(null);
              setShowEquipmentModal(true);
            }}
            onOpenEditEquipment={(eq) => {
              setEditingEquipment(eq);
              setShowEquipmentModal(true);
            }}
            onToggleMaintenance={(eqId) => {
              void toggleEquipmentMaintenance(eqId).catch(() => {});
            }}
            onDeleteEquipment={(eqId) => {
              void deleteEquipment(eqId).catch(() => {});
            }}
          />
        )}

        {activeTab === 'workers' && (
          <WorkersTab
            workers={db.workers}
            workerTypeFilter={workerTypeFilter}
            onFilterChange={setWorkerTypeFilter}
            onCreateWorker={(params) =>
              createUserAccount({
                ...params,
                role: 'worker',
              })
            }
            onUpdateWorker={(params) => updateUserAccount(params)}
            onResetPassword={resetUserPassword}
            onSetWorkerActive={setUserActive}
            page={pages.workers}
            onPageChange={(p) => setPage('workers', p)}
            pageSize={getPageSize('workers')}
            onPageSizeChange={(s) => setListPageSize('workers', s)}
          />
        )}

        {activeTab === 'admins' && (
          <AdminsTab
            admins={db.admins}
            currentAdminId={currentUser.id}
            onCreateAdmin={(params) =>
              createUserAccount({
                ...params,
                role: 'admin',
              })
            }
            onUpdateAdmin={(params) => updateUserAccount(params)}
            onResetPassword={resetUserPassword}
            onSetAdminActive={setUserActive}
            page={pages.admins}
            onPageChange={(p) => setPage('admins', p)}
            pageSize={getPageSize('admins')}
            onPageSizeChange={(s) => setListPageSize('admins', s)}
          />
        )}
      </main>

      {/* Modals */}
      <SiteModal
        isOpen={showSiteModal}
        onClose={() => {
          setShowSiteModal(false);
          setEditingSite(null);
        }}
        editingSite={editingSite}
        existingSiteCodes={existingSiteCodes}
        getNextSiteCode={getNextSiteCode}
        onSaveSite={async (payload, target) => {
          if (target) {
            await updateSite({ ...target, ...payload, status: target.status });
          } else {
            const created = await addSite(payload);
            setSelectedSiteId(created.id);
            setSiteDetailTab('phases');
            setActiveTab('sites');
          }
        }}
      />

      <PhaseModal
        isOpen={showPhaseModal}
        onClose={() => {
          setShowPhaseModal(false);
          setEditingPhase(null);
        }}
        site={selectedSite}
        sitePhasesCount={sitePhases.length}
        editingPhase={editingPhase}
        onSavePhase={async (payload, target) => {
          if (target) {
            await updatePhase({ ...target, ...payload });
          } else {
            await addPhase(payload);
          }
        }}
      />

      <EquipmentModal
        isOpen={showEquipmentModal}
        onClose={() => {
          setShowEquipmentModal(false);
          setEditingEquipment(null);
        }}
        editingEquipment={editingEquipment}
        existingEquipmentCodes={existingEquipmentCodes}
        getNextEquipmentCode={getNextEquipmentCode}
        onSaveEquipment={async (payload, target) => {
          if (target) {
            await updateEquipment({ ...target, ...payload });
          } else {
            await addNewEquipment(payload);
          }
        }}
      />

      <TimeEntryModal
        isOpen={showTimeModal}
        onClose={() => {
          setShowTimeModal(false);
          setEditingTimeEntry(null);
        }}
        site={selectedSite}
        sitePhases={sitePhases}
        workers={db.workers}
        editingTimeEntry={editingTimeEntry}
        onSaveTimeEntry={async (payload, target) => {
          if (target) {
            await updateTimeEntry({ ...target, ...payload });
          } else {
            await addTimeEntry(payload);
          }
        }}
      />

      <MaterialLogModal
        isOpen={showMaterialModal}
        onClose={() => {
          setShowMaterialModal(false);
          setEditingMaterialLog(null);
        }}
        site={selectedSite}
        sitePhases={sitePhases}
        workers={db.workers}
        editingMaterialLog={editingMaterialLog}
        onSaveMaterialLog={async (payload, target) => {
          if (target) {
            await updateMaterialLog({ ...target, ...payload });
          } else {
            await addMaterialLog(payload);
          }
        }}
      />

      <EquipmentUsageModal
        isOpen={showEqUsageModal}
        onClose={() => {
          setShowEqUsageModal(false);
          setEditingEqLog(null);
        }}
        site={selectedSite}
        allEquipment={db.equipment}
        workers={db.workers}
        currentAdmin={currentAdminIdentity}
        editingEqLog={editingEqLog}
        onSaveEqUsage={async (params, target) => {
          if (target) {
            await updateEquipmentLog({
              ...target,
              equipmentId: params.equipmentId,
              equipmentName: params.equipmentName,
              actorId: params.actorId,
              actorName: params.actorName,
              actorRole: params.actorRole,
              timestamp: params.timestamp,
              hoursUsed: params.hoursUsed,
              notes: params.notes,
            });
          } else if (selectedSite) {
            await addEquipmentUsageLog({
              equipmentId: params.equipmentId,
              equipmentName: params.equipmentName,
              siteId: selectedSite.id,
              actorId: params.actorId,
              actorName: params.actorName,
              actorRole: params.actorRole,
              hoursUsed: params.hoursUsed,
              timestamp: params.timestamp,
              notes: params.notes,
            });
          }
        }}
      />

      <PdfReportModal
        isOpen={showPdfReportModal}
        onClose={() => setShowPdfReportModal(false)}
        site={selectedSite}
        pdfOptions={pdfOptions}
        onChangeOptions={setPdfOptions}
        counts={{
          workers: selectedSite ? (selectedSite.assignedWorkerIds || []).length : 0,
          phases: sitePhases.length,
          equipmentLogs: siteEquipmentLogs.length,
          timeEntries: siteTimeEntries.length,
          materials: siteMaterials.length,
          photos: sitePhotos.length,
        }}
        onPrint={handlePrintPdfReport}
      />

      <AdminPhotoUploadModal
        isOpen={showPhotoUploadModal}
        onClose={() => {
          setShowPhotoUploadModal(false);
          setUploadPhotoPhaseId(undefined);
        }}
        site={selectedSite}
        sitePhases={sitePhases}
        currentAdmin={currentAdminIdentity}
        defaultPhaseId={uploadPhotoPhaseId}
        onSavePhotos={async (photos) => {
          if (photos.length === 0) return;
          await addPhotoLogs(photos);
          const firstPhoto = photos[0];
          const matchesActiveFilter =
            photoPhaseFilter === 'ALL'
              ? true
              : photoPhaseFilter === 'NONE'
              ? !firstPhoto.phaseId ||
                !sitePhases.some((p) => p.id === firstPhoto.phaseId)
              : firstPhoto.phaseId === photoPhaseFilter;

          if (!matchesActiveFilter) {
            setPhotoPhaseFilter('ALL');
          }

          setPage('photos', 1);
        }}
      />

      <PhotoLightboxModal
        photo={lightboxPhoto}
        sites={db.sites}
        phases={db.phases}
        onClose={() => setLightboxPhotoId(null)}
        onGoToSitePhotos={(targetSiteId) => {
          setLightboxPhotoId(null);
          setSelectedSiteId(targetSiteId);
          setSiteDetailTab('photos');
          setActiveTab('sites');
        }}
        onDownloadPhoto={(photo, e) => {
          void handleDownloadPhoto(photo, e);
        }}
        onDeletePhoto={(photoId) => {
          void deletePhotoLog(photoId).catch(() => {});
        }}
      />
    </div>
  );
};
