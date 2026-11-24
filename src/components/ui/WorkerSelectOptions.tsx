import React from 'react';
import { Worker } from '../../types/models';

interface WorkerSelectOptionsProps {
  workers: Worker[];
  assignedWorkerIds?: string[];
  includeWorkerId?: string;
  includeAdminOption?: boolean;
  adminLabel?: string;
}

export const WorkerSelectOptions: React.FC<WorkerSelectOptionsProps> = ({
  workers,
  assignedWorkerIds = [],
  includeWorkerId,
  includeAdminOption = false,
  adminLabel = 'Amministratore (Admin)',
}) => {
  const selectableWorkers = workers.filter(
    (w) => w.active || (includeWorkerId !== undefined && w.id === includeWorkerId)
  );
  const assignedIds = new Set(assignedWorkerIds);
  const assignedWorkers = selectableWorkers.filter((w) => assignedIds.has(w.id));
  const otherWorkers = selectableWorkers.filter((w) => !assignedIds.has(w.id));

  return (
    <>
      {selectableWorkers.length === 0 && !includeAdminOption && (
        <option value="" disabled>
          Nessun dipendente attivo disponibile
        </option>
      )}
      {assignedWorkers.length > 0 && (
        <optgroup label="Dipendenti assegnati al cantiere">
          {assignedWorkers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.type})
              {!w.active ? ' [Disattivato]' : ''}
            </option>
          ))}
        </optgroup>
      )}
      {otherWorkers.length > 0 && (
        <optgroup label="Altri dipendenti in organico">
          {otherWorkers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.type})
              {!w.active ? ' [Disattivato]' : ''}
            </option>
          ))}
        </optgroup>
      )}
      {includeAdminOption && (
        <optgroup label="Amministrazione">
          <option value="__admin__">{adminLabel}</option>
        </optgroup>
      )}
    </>
  );
};
