import React from 'react';
import {
  Building2,
  Camera,
  ChevronRight,
  MapPin,
  Truck,
} from 'lucide-react';
import {
  Equipment,
  EquipmentLog,
  MaterialLog,
  PhotoLog,
  Site,
  TimeEntry,
  WorkPhase,
} from '../../types/models';
import { getProgressColor, getSiteStatusBadge } from '../../constants/domain';
import { buildGoogleMapsUrl } from '../../utils/formatters';

interface DashboardTabProps {
  sites: Site[];
  phases: WorkPhase[];
  equipment: Equipment[];
  equipmentLogs: EquipmentLog[];
  timeEntries: TimeEntry[];
  materialLogs: MaterialLog[];
  photoLogs: PhotoLog[];
  onSelectSite: (siteId: string) => void;
  onViewAllSites: () => void;
  onOpenLightbox: (photo: PhotoLog) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  sites,
  phases,
  equipment,
  equipmentLogs,
  timeEntries,
  materialLogs,
  photoLogs,
  onSelectSite,
  onViewAllSites,
  onOpenLightbox,
}) => {
  const activeSitesCount = sites.filter((s) => s.status === 'In Corso').length;
  const availableEquipmentCount = equipment.filter(
    (e) => e.status === 'Disponibile'
  ).length;
  const maintenanceEquipmentCount = equipment.filter(
    (e) => e.status === 'In Manutenzione'
  ).length;

  const siteById = new Map(sites.map((s) => [s.id, s]));

  const lastUpdateBySiteId = new Map<
    string,
    { timestamp: string; label: string }
  >();
  const recordUpdate = (siteId: string, timestamp: string | undefined, label: string) => {
    if (!timestamp) return;
    const prev = lastUpdateBySiteId.get(siteId);
    if (!prev || timestamp.localeCompare(prev.timestamp) > 0) {
      lastUpdateBySiteId.set(siteId, { timestamp, label });
    }
  };

  equipmentLogs.forEach((log) =>
    recordUpdate(log.siteId, log.timestamp, 'Mezzi & Attrezzature')
  );
  timeEntries.forEach((t) =>
    recordUpdate(t.siteId, t.createdAt, 'Ore Lavorate')
  );
  materialLogs.forEach((m) =>
    recordUpdate(m.siteId, m.createdAt, 'Materiali Consumati')
  );
  photoLogs.forEach((ph) =>
    recordUpdate(ph.siteId, ph.createdAt, 'Foto Cantiere')
  );

  const recentUpdatedSites = sites
    .map((site) => ({
      site,
      lastUpdate: lastUpdateBySiteId.get(site.id) || null,
    }))
    .filter((item) => item.lastUpdate !== null)
    .sort((a, b) => b.lastUpdate!.timestamp.localeCompare(a.lastUpdate!.timestamp))
    .slice(0, 5);

  const latestPhotos = [...photoLogs]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 4);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Dashboard Generale
        </h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-blue-200/70 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800/80">
              Cantieri Attivi
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">
              {activeSitesCount}
            </span>
            <span className="text-xs text-slate-500">
              su {sites.length} registrati
            </span>
          </div>
          <div className="mt-2 text-xs text-blue-700/80 font-medium">
            {phases.filter((p) => p.status === 'In Corso').length} fasi operative
            attualmente in corso
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-amber-200/70 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-900/80">
              Mezzi &amp; Attrezzature
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">
              {availableEquipmentCount}/{equipment.length}
            </span>
            <span className="text-xs text-slate-500">operativi</span>
          </div>
          <div className="mt-2 text-xs text-amber-800/80 font-medium">
            {equipmentLogs.length} utilizzi registrati
            {maintenanceEquipmentCount > 0
              ? ` • ${maintenanceEquipmentCount} in manutenzione`
              : ''}
          </div>
        </div>
      </div>

      {/* Active Sites Overview + Recent Field Photos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Ultimi 5 Cantieri Aggiornati */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <span>Ultimi Cantieri Aggiornati</span>
            </h2>
            <button
              type="button"
              onClick={onViewAllSites}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>Vedi tutti ({sites.length})</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentUpdatedSites.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Nessun aggiornamento recente disponibile sui cantieri.
              </div>
            ) : (
              recentUpdatedSites.map(({ site, lastUpdate }) => {
                const sitePhasesCount = phases.filter(
                  (p) => p.siteId === site.id
                ).length;
                const eqLogsCount = equipmentLogs.filter(
                  (l) => l.siteId === site.id
                ).length;
                return (
                  <div
                    key={site.id}
                    className="p-5 hover:bg-blue-50/20 transition cursor-pointer"
                    onClick={() => onSelectSite(site.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-800 border border-blue-200/70">
                            {site.code}
                          </span>
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getSiteStatusBadge(
                              site.status
                            )}`}
                          >
                            {site.status}
                          </span>
                          {(site.sectors || []).map((sec) => (
                            <span
                              key={sec}
                              className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/70"
                            >
                              {sec}
                            </span>
                          ))}
                        </div>
                        <h3 className="font-semibold text-slate-900 mt-1.5 text-base">
                          {site.name}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-500/80 shrink-0" />
                          <span>
                            <a
                              href={buildGoogleMapsUrl(site.address, site.city)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Apri su Google Maps"
                              className="hover:text-blue-700 hover:underline transition"
                            >
                              {site.address}, {site.city}
                            </a>{' '}
                            — Committente: {site.client}
                          </span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-lg font-bold text-slate-900">
                          {site.progress}%
                        </span>
                        <div className="text-[11px] text-slate-500">Avanzamento</div>
                      </div>
                    </div>

                    <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`${getProgressColor(
                          site.progress,
                          site.status === 'Completato'
                        )} h-full rounded-full transition-all`}
                        style={{ width: `${site.progress}%` }}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-3">
                        <span>
                          <strong className="text-slate-700">
                            {sitePhasesCount}
                          </strong>{' '}
                          Fasi
                        </span>
                        <span>
                          <strong className="text-slate-700">{eqLogsCount}</strong>{' '}
                          Utilizzi mezzi
                        </span>
                        {lastUpdate && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 text-[11px]">
                            Ultimo agg.:{' '}
                            <strong className="text-slate-800">
                              {lastUpdate.label}
                            </strong>{' '}
                            ({lastUpdate.timestamp})
                          </span>
                        )}
                      </div>
                      <span className="text-blue-600 font-medium flex items-center gap-1">
                        Apri scheda <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 col: Latest Photos from Field */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-violet-500/10 text-violet-600 flex items-center justify-center">
                <Camera className="w-3.5 h-3.5" />
              </div>
              <span>Ultime Foto dai Cantieri</span>
            </h2>
          </div>

          <div className="p-4 space-y-3 flex-1">
            {latestPhotos.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">
                Nessuna foto ancora caricata dai cantieri.
              </p>
            ) : (
              latestPhotos.map((photo) => {
                const site = siteById.get(photo.siteId);
                return (
                  <div
                    key={photo.id}
                    onClick={() => onOpenLightbox(photo)}
                    className="group flex gap-3 p-2.5 rounded-xl border border-slate-200/70 hover:border-violet-300/80 hover:bg-violet-50/20 transition cursor-pointer"
                  >
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption || photo.tag}
                      className="w-20 h-16 object-cover rounded-lg shrink-0 bg-slate-900 border border-slate-200"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-800 border border-violet-200/60 truncate">
                          {photo.tag}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {photo.createdAt}
                        </span>
                      </div>
                      {photo.caption && (
                        <p className="text-xs font-medium text-slate-900 line-clamp-2 mt-1">
                          {photo.caption}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {photo.workerName}
                        {site ? ` • ${site.code}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
