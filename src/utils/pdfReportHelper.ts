import {
  Equipment,
  Site,
  WorkPhase,
  Worker,
  EquipmentLog,
  TimeEntry,
  MaterialLog,
  PhotoLog,
} from '../types/models';
import { aggregateEquipmentHours, escapeXml } from './formatters';

export interface PdfReportOptions {
  includeWorkers: boolean;
  includePhases: boolean;
  includeEquipmentHistory: boolean;
  includeHours: boolean;
  includeMaterials: boolean;
  includePhotos: boolean;
}

export interface SiteReportData {
  site: Site;
  workers: Worker[];
  phases: WorkPhase[];
  equipment: Equipment[];
  equipmentLogs: EquipmentLog[];
  timeEntries: TimeEntry[];
  materialLogs: MaterialLog[];
  photoLogs: PhotoLog[];
  options: PdfReportOptions;
}

export function buildSiteReportHtml(data: SiteReportData): string {
  const {
    site,
    workers,
    phases,
    equipment,
    equipmentLogs,
    timeEntries,
    materialLogs,
    photoLogs,
    options,
  } = data;

  const now = new Date();
  const printDate = `${now.toLocaleDateString('it-IT')} ${now
    .toTimeString()
    .slice(0, 5)}`;

  const totalAllHours = timeEntries.reduce((acc, t) => acc + t.regularHours, 0);

  const phaseTitleById = new Map<string, string>();
  phases.forEach((p) => phaseTitleById.set(p.id, p.title));

  const { totals: eqHoursList, totalHours: totalEqHours } =
    aggregateEquipmentHours(equipmentLogs, equipment);

  const kpiBoxes: string[] = [
    `<div class="kpi-box">
      <div class="kpi-title">Avanzamento</div>
      <div class="kpi-num">${site.progress}%</div>
      <div class="kpi-sub">Stato: ${escapeXml(site.status)}</div>
    </div>`,
  ];

  if (options.includePhases) {
    kpiBoxes.push(`
    <div class="kpi-box">
      <div class="kpi-title">Fasi Lavoro</div>
      <div class="kpi-num">${phases.length}</div>
      <div class="kpi-sub">${phases.filter((p) => p.status === 'Completata').length} completate</div>
    </div>`);
  }

  if (options.includeWorkers) {
    kpiBoxes.push(`
    <div class="kpi-box">
      <div class="kpi-title">Dipendenti</div>
      <div class="kpi-num">${workers.length}</div>
      <div class="kpi-sub">Assegnati al cantiere</div>
    </div>`);
  }

  if (options.includeHours) {
    kpiBoxes.push(`
    <div class="kpi-box">
      <div class="kpi-title">Ore Totali</div>
      <div class="kpi-num">${totalAllHours}h</div>
      <div class="kpi-sub">${timeEntries.length} registrazioni</div>
    </div>`);
  }

  if (options.includeMaterials) {
    kpiBoxes.push(`
    <div class="kpi-box">
      <div class="kpi-title">Materiali</div>
      <div class="kpi-num">${materialLogs.length}</div>
      <div class="kpi-sub">Scarichi registrati</div>
    </div>`);
  }

  if (options.includeEquipmentHistory) {
    kpiBoxes.push(`
    <div class="kpi-box">
      <div class="kpi-title">Ore Mezzi</div>
      <div class="kpi-num">${totalEqHours}h</div>
      <div class="kpi-sub">Ore utilizzo registrate</div>
    </div>`);
  }

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Report Cantiere ${escapeXml(site.code)} - ${escapeXml(site.name)} | Gestionale AMG Tech</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 14mm 16mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.45;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1e3a8a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #2563eb;
      margin-bottom: 4px;
    }
    .doc-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px 0;
    }
    .doc-subtitle {
      font-size: 11px;
      color: #475569;
      margin: 0;
    }
    .meta-right {
      text-align: right;
      font-size: 10px;
      color: #475569;
    }
    .code-badge {
      display: inline-block;
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 4px;
    }
    .status-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 999px;
      background: ${
        site.status === 'Completato'
          ? '#d1fae5'
          : site.status === 'In Corso'
          ? '#dbeafe'
          : site.status === 'Sospeso'
          ? '#fef3c7'
          : '#e0f2fe'
      };
      color: ${
        site.status === 'Completato'
          ? '#065f46'
          : site.status === 'In Corso'
          ? '#1e40af'
          : site.status === 'Sospeso'
          ? '#92400e'
          : '#075985'
      };
      border: 1px solid ${
        site.status === 'Completato'
          ? '#6ee7b7'
          : site.status === 'In Corso'
          ? '#93c5fd'
          : site.status === 'Sospeso'
          ? '#fcd34d'
          : '#7dd3fc'
      };
      margin-left: 6px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
    }
    .info-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      display: block;
    }
    .info-value {
      font-size: 11px;
      font-weight: 600;
      color: #0f172a;
    }
    .sectors-row {
      margin-top: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .sector-pill {
      font-size: 9.5px;
      font-weight: 600;
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
      padding: 2px 7px;
      border-radius: 4px;
    }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 8px;
      margin-bottom: 18px;
    }
    .kpi-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
      background: #ffffff;
    }
    .kpi-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
    }
    .kpi-num {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .kpi-sub {
      font-size: 9px;
      color: #64748b;
    }
    .section {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .section-breakable {
      margin-bottom: 18px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #1e3a8a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 5px;
      margin: 0 0 10px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      font-size: 9.5px;
      text-transform: uppercase;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .worker-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .worker-chip {
      border: 1px solid #c7d2fe;
      background: #eef2ff;
      color: #1e1b4b;
      padding: 4px 9px;
      border-radius: 6px;
      font-size: 10.5px;
      font-weight: 600;
    }
    .worker-type {
      font-weight: 400;
      color: #4f46e5;
      font-size: 9.5px;
    }
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .photo-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      page-break-inside: avoid;
      background: #fff;
    }
    .photo-card img {
      width: 100%;
      height: 155px;
      object-fit: cover;
      display: block;
      background: #0f172a;
    }
    .photo-meta {
      padding: 7px 9px;
      font-size: 10px;
    }
    .footer-signatures {
      margin-top: 26px;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      page-break-inside: avoid;
    }
    .sig-box {
      font-size: 10px;
      color: #475569;
    }
    .sig-line {
      margin-top: 28px;
      border-bottom: 1px solid #94a3b8;
    }
    .empty-note {
      font-style: italic;
      color: #64748b;
      font-size: 10.5px;
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <!-- INTESTAZIONE REPORT -->
  <div class="header-bar">
    <div>
      <div class="brand">Gestionale AMG Tech</div>
      <h1 class="doc-title">${escapeXml(site.name)}</h1>
      <p class="doc-subtitle">Scheda Tecnica e Report Stato Avanzamento Cantiere</p>
      <div class="sectors-row">
        ${(site.sectors || [])
          .map((sec) => `<span class="sector-pill">${escapeXml(sec)}</span>`)
          .join('')}
      </div>
    </div>
    <div class="meta-right">
      <div>
        <span class="code-badge">${escapeXml(site.code)}</span>
        <span class="status-badge">${escapeXml(site.status)}</span>
      </div>
      <div style="margin-top: 4px;">Avanzamento: <strong>${site.progress}%</strong></div>
      <div>Data stampa: <strong>${printDate}</strong></div>
    </div>
  </div>

  <!-- ANAGRAFICA CANTIERE -->
  <div class="info-card">
    ${
      site.description
        ? `<div style="font-size: 11px; color: #334155;">
      <strong>Descrizione Lavori:</strong> ${escapeXml(site.description)}
    </div>`
        : ''
    }
    <div class="info-grid">
      <div>
        <span class="info-label">Committente / Cliente</span>
        <span class="info-value">${escapeXml(site.client)}</span>
      </div>
      <div>
        <span class="info-label">Ubicazione Cantiere</span>
        <span class="info-value">${escapeXml(site.address)}, ${escapeXml(site.city)}</span>
      </div>
      <div>
        <span class="info-label">Cronoprogramma</span>
        <span class="info-value">Dal ${escapeXml(site.startDate)} al ${escapeXml(site.endDate)}</span>
      </div>
    </div>
  </div>

  <!-- SINTESI KPI DINAMICA -->
  <div class="kpi-row">
    ${kpiBoxes.join('')}
  </div>

  ${
    options.includeWorkers
      ? `
  <!-- SEZIONE 1: DIPENDENTI ASSEGNATI -->
  <div class="section">
    <h2 class="section-title">
      <span>Dipendenti Assegnati al Cantiere</span>
      <span>Totale: ${workers.length}</span>
    </h2>
    ${
      workers.length === 0
        ? `<p class="empty-note">Nessun dipendente attualmente assegnato al cantiere.</p>`
        : `<div class="worker-chips">
            ${workers
              .map(
                (w) =>
                  `<div class="worker-chip">${escapeXml(w.name)} <span class="worker-type">(${escapeXml(w.type)})</span></div>`
              )
              .join('')}
          </div>`
    }
  </div>`
      : ''
  }

  ${
    options.includePhases
      ? `
  <!-- SEZIONE 2: FASI DI LAVORO -->
  <div class="section-breakable">
    <h2 class="section-title">
      <span>Cronoprogramma e Fasi di Lavoro</span>
      <span>Totale: ${phases.length}</span>
    </h2>
    ${
      phases.length === 0
        ? `<p class="empty-note">Nessuna fase di lavoro programmata per questo cantiere.</p>`
        : `<table>
            <thead>
              <tr>
                <th style="width: 34%;">Fase</th>
                <th style="width: 36%;">Descrizione Operativa</th>
                <th style="width: 16%;">Periodo</th>
                <th style="width: 14%;">Stato / Avanz.</th>
              </tr>
            </thead>
            <tbody>
              ${phases
                .map(
                  (p) => `
                <tr>
                  <td><strong>${escapeXml(p.title)}</strong></td>
                  <td>${escapeXml(p.description)}</td>
                  <td>${escapeXml(p.startDate)}<br/>→ ${escapeXml(p.endDate)}</td>
                  <td><strong>${p.progress}%</strong><br/><span style="font-size:9.5px;color:#475569;">${escapeXml(p.status)}</span></td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  </div>`
      : ''
  }

  ${
    options.includeEquipmentHistory
      ? `
  <!-- SEZIONE 3: REGISTRO CRONOLOGICO & ORE UTILIZZO MEZZI -->
  <div class="section-breakable">
    <h2 class="section-title">
      <span>Cronologia &amp; Ore Utilizzo Mezzi (${totalEqHours}h totali mezzi)</span>
      <span>Registrazioni: ${equipmentLogs.length}</span>
    </h2>
    ${
      equipmentLogs.length === 0
        ? `<p class="empty-note">Nessuna registrazione mezzi presente per questo cantiere.</p>`
        : `
          ${
            eqHoursList.length > 0
              ? `<div style="margin-bottom: 8px; font-size: 10px; color: #334155;">
                  <strong>Riepilogo Ore Totali per Mezzo:</strong>
                  ${eqHoursList
                    .map(
                      (eh) =>
                        `<span style="display:inline-block; background:#fffbeb; border:1px solid #fde68a; padding:2px 7px; border-radius:4px; margin: 2px 4px 2px 0;">
                          <strong>[${escapeXml(eh.code)}] ${escapeXml(eh.name)}</strong>: ${eh.hours}h
                        </span>`
                    )
                    .join('')}
                </div>`
              : ''
          }
          <table>
            <thead>
              <tr>
                <th style="width: 20%;">Data / Ora</th>
                <th style="width: 44%;">Mezzo / Attrezzatura</th>
                <th style="width: 20%;">Dipendente</th>
                <th style="width: 16%;">Ore di Utilizzo</th>
              </tr>
            </thead>
            <tbody>
              ${equipmentLogs
                .map(
                  (log) => `
                <tr>
                  <td>${escapeXml(log.timestamp)}</td>
                  <td>
                    <strong>${escapeXml(log.equipmentName)}</strong>
                    ${
                      log.notes
                        ? `<br/><span style="color:#64748b; font-size:9px;">${escapeXml(log.notes)}</span>`
                        : ''
                    }
                  </td>
                  <td>${escapeXml(log.actorName)}</td>
                  <td>${
                    log.hoursUsed && log.hoursUsed > 0
                      ? `<strong style="color:#b45309;">${log.hoursUsed}h</strong>`
                      : '—'
                  }</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  </div>`
      : ''
  }

  ${
    options.includeHours
      ? `
  <!-- SEZIONE 4: ORE LAVORATE -->
  <div class="section-breakable">
    <h2 class="section-title">
      <span>Registro Ore Lavorate (${totalAllHours}h totali)</span>
      <span>Registrazioni: ${timeEntries.length}</span>
    </h2>
    ${
      timeEntries.length === 0
        ? `<p class="empty-note">Nessun rapportino ore registrato per questo cantiere.</p>`
        : `<table>
            <thead>
              <tr>
                <th style="width: 12%;">Data</th>
                <th style="width: 20%;">Dipendente</th>
                <th style="width: 24%;">Fase di Lavoro</th>
                <th style="width: 14%;">Ore</th>
                <th style="width: 30%;">Descrizione Attività</th>
              </tr>
            </thead>
            <tbody>
              ${timeEntries
                .map(
                  (t) => `
                <tr>
                  <td>${escapeXml(t.date)}</td>
                  <td><strong>${escapeXml(t.workerName)}</strong></td>
                  <td>${escapeXml(phaseTitleById.get(t.phaseId) || 'Generale Cantiere')}</td>
                  <td><strong>${t.regularHours}h</strong></td>
                  <td>${escapeXml(t.description || '—')}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  </div>`
      : ''
  }

  ${
    options.includeMaterials
      ? `
  <!-- SEZIONE 5: MATERIALI CONSUMATI -->
  <div class="section-breakable">
    <h2 class="section-title">
      <span>Materiali Consumati in Cantiere</span>
      <span>Voci: ${materialLogs.length}</span>
    </h2>
    ${
      materialLogs.length === 0
        ? `<p class="empty-note">Nessun materiale registrato per questo cantiere.</p>`
        : `<table>
            <thead>
              <tr>
                <th style="width: 14%;">Codice</th>
                <th style="width: 13%;">Categoria</th>
                <th style="width: 27%;">Materiale</th>
                <th style="width: 12%;">Quantità</th>
                <th style="width: 16%;">Dipendente</th>
                <th style="width: 18%;">Fase / Note</th>
              </tr>
            </thead>
            <tbody>
              ${materialLogs
                .map(
                  (m) => `
                <tr>
                  <td style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600;">${escapeXml(m.articleCode || '—')}</td>
                  <td>${escapeXml(m.category)}</td>
                  <td><strong>${escapeXml(m.materialName || '—')}</strong></td>
                  <td><strong>${m.quantity} ${escapeXml(m.unit)}</strong></td>
                  <td>${escapeXml(m.workerName)}</td>
                  <td>${escapeXml(
                    m.notes || phaseTitleById.get(m.phaseId) || '—'
                  )}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>`
    }
  </div>`
      : ''
  }

  ${
    options.includePhotos
      ? `
  <!-- SEZIONE 6: DOCUMENTAZIONE FOTOGRAFICA -->
  <div class="section-breakable">
    <h2 class="section-title">
      <span>Documentazione Fotografica Cantiere</span>
      <span>Foto: ${photoLogs.length}</span>
    </h2>
    ${
      photoLogs.length === 0
        ? `<p class="empty-note">Nessuna fotografia registrata per questo cantiere.</p>`
        : `<div class="photos-grid">
            ${photoLogs
              .map((ph) => {
                const phaseLabel =
                  phaseTitleById.get(ph.phaseId) || 'Generale Cantiere';
                return `
              <div class="photo-card">
                <img src="${escapeXml(ph.imageUrl)}" alt="${escapeXml(ph.caption || ph.tag)}" />
                <div class="photo-meta">
                  <div style="font-size:9.5px; font-weight:700; color:#5b21b6; margin-bottom:2px;">Fase: ${escapeXml(phaseLabel)}</div>
                  <div style="font-weight:700; color:#1e293b;">[${escapeXml(ph.tag)}]${ph.caption ? ` ${escapeXml(ph.caption)}` : ''}</div>
                  <div style="color:#64748b; margin-top:2px;">Scattata da: ${escapeXml(ph.workerName)} • ${escapeXml(ph.createdAt)}</div>
                </div>
              </div>`;
              })
              .join('')}
          </div>`
    }
  </div>`
      : ''
  }

  <!-- FIRME A FONDO PAGINA -->
  <div class="footer-signatures">
    <div class="sig-box">
      <strong>AMG Tech • Direzione Tecnica / Amministrazione</strong>
      <div class="sig-line"></div>
    </div>
    <div class="sig-box">
      <strong>Il Committente / Responsabile Cantiere</strong>
      <div class="sig-line"></div>
    </div>
  </div>
</body>
</html>`;
}

export function printSiteReportPdf(data: SiteReportData): void {
  const html = buildSiteReportHtml(data);

  const existingFrame = document.getElementById('amg-tech-print-iframe');
  if (existingFrame && existingFrame.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'amg-tech-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc || !iframe.contentWindow) return;

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const imgs = Array.from(frameDoc.querySelectorAll('img'));
  const imagePromises = imgs.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    });
  });

  const triggerPrint = (() => {
    let called = false;
    return () => {
      if (called) return;
      called = true;
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
  })();

  const timeoutId = window.setTimeout(triggerPrint, 6000);
  Promise.all(imagePromises).then(() => {
    window.clearTimeout(timeoutId);
    window.setTimeout(triggerPrint, 50);
  });
}
