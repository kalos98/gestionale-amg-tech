import React from 'react';
import {
  Building2,
  Calendar,
  ChevronRight,
  Filter,
  MapPin,
  Plus,
  Search,
} from 'lucide-react';
import { EquipmentLog, Site, WorkPhase } from '../../types/models';
import {
  SITE_SECTORS,
  SITE_STATUSES,
  getProgressColor,
  getSiteStatusBadge,
} from '../../constants/domain';
import { Pagination, paginate } from '../Pagination';
import { buildGoogleMapsUrl } from '../../utils/formatters';

interface SitesListTabProps {
  filteredSitesList: Site[];
  phases: WorkPhase[];
  equipmentLogs: EquipmentLog[];
  siteSearchQuery: string;
  onSearchChange: (q: string) => void;
  sectorFilter: string;
  onSectorFilterChange: (val: string) => void;
  siteStatusFilter: string;
  onSiteStatusFilterChange: (val: string) => void;
  sitesPage: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onOpenNewSite: () => void;
  onSelectSite: (siteId: string) => void;
}

export const SitesListTab: React.FC<SitesListTabProps> = ({
  filteredSitesList,
  phases,
  equipmentLogs,
  siteSearchQuery,
  onSearchChange,
  sectorFilter,
  onSectorFilterChange,
  siteStatusFilter,
  onSiteStatusFilterChange,
  sitesPage,
  onPageChange,
  pageSize,
  onPageSizeChange,
  onOpenNewSite,
  onSelectSite,
}) => {
  const { items: pagedSites, safePage } = paginate(
    filteredSitesList,
    sitesPage,
    pageSize
  );

  return (
    <>
      {/* PRIMA VISTA: INTESTAZIONE + CREA NUOVO CANTIERE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Cantieri
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Filtra l'elenco dei cantieri e clicca su una scheda per gestirne fasi,
            mezzi, dipendenti e registrazioni.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewSite}
          className="w-full sm:w-64 shrink-0 inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Crea Nuovo Cantiere</span>
        </button>
      </div>

      {/* BARRA FILTRI E RICERCA CANTIERI */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            <Search className="w-3.5 h-3.5 text-blue-500" />
            <span>Cerca Cantiere</span>
          </label>
          <input
            type="text"
            placeholder="Nome, codice, città o committente..."
            value={siteSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-50/80 border border-slate-300 text-slate-900 text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-4">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            <Filter className="w-3.5 h-3.5 text-blue-500" />
            <span>Settore d'Intervento</span>
          </label>
          <select
            value={sectorFilter}
            onChange={(e) => onSectorFilterChange(e.target.value)}
            className="w-full bg-slate-50/80 border border-slate-300 text-slate-800 text-sm font-medium rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="Tutti">Tutti i settori</option>
            {SITE_SECTORS.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Fase / Stato</span>
          </label>
          <select
            value={siteStatusFilter}
            onChange={(e) => onSiteStatusFilterChange(e.target.value)}
            className="w-full bg-slate-50/80 border border-slate-300 text-slate-800 text-sm font-medium rounded-xl px-3.5 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="Tutti">Tutti gli stati</option>
            {SITE_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* LISTA CANTIERI CLICCABILI */}
      {filteredSitesList.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-sm">
          <p className="text-slate-500 font-medium text-sm">
            Nessun cantiere corrisponde ai filtri selezionati.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {pagedSites.map((site) => {
              const phasesCount = phases.filter((p) => p.siteId === site.id).length;
              const eqLogsCount = equipmentLogs.filter(
                (l) => l.siteId === site.id
              ).length;
              const workersCount = (site.assignedWorkerIds || []).length;

              return (
                <div
                  key={site.id}
                  onClick={() => onSelectSite(site.id)}
                  className="group bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400/80 hover:shadow-md p-5 sm:p-6 transition cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 max-w-3xl">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-800 border border-blue-200/80">
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
                            className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/70"
                          >
                            {sec}
                          </span>
                        ))}
                      </div>

                      <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                        {site.name}
                      </h2>
                      {site.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {site.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <a
                            href={buildGoogleMapsUrl(site.address, site.city)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Apri su Google Maps"
                            className="hover:text-blue-700 hover:underline transition"
                          >
                            {site.address}, {site.city}
                          </a>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                          Committente:{' '}
                          <strong className="text-slate-700">{site.client}</strong>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-teal-500" />
                          {site.startDate} → {site.endDate}
                        </span>
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-2">
                      <div>
                        <span className="text-2xl font-bold text-slate-900">
                          {site.progress}%
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          Avanzamento
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                        <span>Apri cantiere</span>
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`${getProgressColor(
                        site.progress,
                        site.status === 'Completato'
                      )} h-full rounded-full transition-all`}
                      style={{ width: `${site.progress}%` }}
                    />
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-blue-50/70 text-blue-800 border border-blue-200/60 font-medium">
                      <strong>{phasesCount}</strong> Fasi programmate
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-indigo-50/70 text-indigo-800 border border-indigo-200/60 font-medium">
                      <strong>{workersCount}</strong> Dipendenti assegnati
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-amber-50/70 text-amber-900 border border-amber-200/60 font-medium">
                      <strong>{eqLogsCount}</strong> Utilizzi mezzi
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 px-4 pb-3 pt-0.5 shadow-sm">
            <Pagination
              currentPage={safePage}
              totalItems={filteredSitesList.length}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        </div>
      )}
    </>
  );
};
