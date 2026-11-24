import React, { useState } from 'react';
import { Edit3, Filter, Plus, Search, Wrench } from 'lucide-react';
import { Equipment, EquipmentLog, Site } from '../../types/models';
import { EQUIPMENT_CATEGORIES } from '../../constants/domain';
import { Pagination, paginate } from '../Pagination';
import { InlineConfirmDelete } from '../ui/InlineConfirmDelete';

interface EquipmentTabProps {
  equipment: Equipment[];
  equipmentLogs: EquipmentLog[];
  filteredGlobalEquipment: Equipment[];
  sites: Site[];
  categoryFilter: string;
  onCategoryFilterChange: (val: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onOpenNewEquipment: () => void;
  onOpenEditEquipment: (eq: Equipment) => void;
  onToggleMaintenance: (equipmentId: string) => void;
  onDeleteEquipment: (equipmentId: string) => void;
}

export const EquipmentTab: React.FC<EquipmentTabProps> = ({
  equipment,
  equipmentLogs,
  filteredGlobalEquipment,
  sites,
  categoryFilter,
  onCategoryFilterChange,
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
  onOpenNewEquipment,
  onOpenEditEquipment,
  onToggleMaintenance,
  onDeleteEquipment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const q = searchQuery.trim().toLowerCase();
  const searchedEquipment = q
    ? filteredGlobalEquipment.filter(
        (eq) =>
          eq.code.toLowerCase().includes(q) ||
          eq.name.toLowerCase().includes(q) ||
          eq.serialOrPlate.toLowerCase().includes(q)
      )
    : filteredGlobalEquipment;

  const { items: pagedGlobalEq, safePage } = paginate(
    searchedEquipment,
    page,
    pageSize
  );

  const siteById = new Map(sites.map((s) => [s.id, s]));
  const logStatsByEqId = new Map<
    string,
    { lastLog: EquipmentLog; count: number }
  >();
  equipmentLogs.forEach((log) => {
    const prev = logStatsByEqId.get(log.equipmentId);
    if (!prev) {
      logStatsByEqId.set(log.equipmentId, { lastLog: log, count: 1 });
      return;
    }
    const nextIsNewer =
      (log.timestamp || '').localeCompare(prev.lastLog.timestamp || '') > 0;
    logStatsByEqId.set(log.equipmentId, {
      lastLog: nextIsNewer ? log : prev.lastLog,
      count: prev.count + 1,
    });
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* INTESTAZIONE + AGGIUNGI MEZZO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Mezzi &amp; Attrezzature
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Catalogo generale del parco mezzi aziendale, stato operativo e storico utilizzi.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewEquipment}
          className="w-full sm:w-auto shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Aggiungi Mezzo / Attrezzatura</span>
        </button>
      </div>

      {/* BARRA FILTRI E RICERCA */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-7">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            <Search className="w-3.5 h-3.5 text-amber-600" />
            <span>Cerca Mezzo / Attrezzatura</span>
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              onPageChange(1);
            }}
            placeholder="Codice, nome o matricola/targa..."
            aria-label="Cerca mezzo o attrezzatura"
            className="w-full bg-slate-50/80 border border-slate-300 text-slate-900 text-sm rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="md:col-span-5">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            <span>Categoria</span>
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            aria-label="Filtra mezzi per categoria"
            className="w-full bg-slate-50/80 border border-slate-300 text-slate-800 text-sm font-medium rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-500"
          >
            <option value="Tutte">
              Tutte le categorie ({equipment.length})
            </option>
            {EQUIPMENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Codice &amp; Nome</th>
                <th className="py-3.5 px-4">Categoria / Matricola</th>
                <th className="py-3.5 px-4">Stato Operativo</th>
                <th className="py-3.5 px-4">Ultimo Utilizzo</th>
                <th className="py-3.5 px-4 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {pagedGlobalEq.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 px-4 text-center text-sm text-slate-400"
                  >
                    Nessun mezzo o attrezzatura trovato con i filtri selezionati.
                  </td>
                </tr>
              ) : (
                pagedGlobalEq.map((eq) => {
                  const stats = logStatsByEqId.get(eq.id);
                  const lastLog = stats?.lastLog || null;
                  const logCount = stats?.count || 0;
                  const lastSite = lastLog ? siteById.get(lastLog.siteId) : null;
                  const lastDate = lastLog
                    ? (lastLog.timestamp || '').slice(0, 10)
                    : '';
                  const maintenanceTitle =
                    eq.status === 'In Manutenzione'
                      ? 'Ripristina disponibile'
                      : 'Segna in manutenzione';
                  return (
                    <tr key={eq.id} className="hover:bg-amber-50/20">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/12 text-amber-900 border border-amber-200/80 shrink-0">
                            {eq.code}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {eq.name}
                          </span>
                        </div>
                        {eq.notes && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {eq.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div className="font-medium text-slate-800">
                          {eq.category}
                        </div>
                        <div>Targa/SN: {eq.serialOrPlate}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {eq.status === 'In Manutenzione' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/12 text-red-800 border border-red-200 whitespace-nowrap">
                            In Manutenzione
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/12 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                            Disponibile
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {lastLog ? (
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {lastSite && (
                                <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200/80">
                                  {lastSite.code}
                                </span>
                              )}
                              <span className="font-medium text-slate-800">
                                {lastLog.actorName}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {lastDate}
                              {logCount > 1 ? ` • ${logCount} utilizzi` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">
                            Nessun utilizzo registrato
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onToggleMaintenance(eq.id)}
                            title={maintenanceTitle}
                            aria-label={maintenanceTitle}
                            className={
                              eq.status === 'In Manutenzione'
                                ? 'p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition'
                                : 'p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition'
                            }
                          >
                            <Wrench className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenEditEquipment(eq)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition"
                            title="Modifica mezzo / attrezzatura"
                            aria-label="Modifica mezzo / attrezzatura"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <InlineConfirmDelete
                            onConfirm={() => onDeleteEquipment(eq.id)}
                            title="Elimina mezzo / attrezzatura"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {searchedEquipment.length > 0 && (
          <div className="px-4 pb-3">
            <Pagination
              currentPage={safePage}
              totalItems={searchedEquipment.length}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};
