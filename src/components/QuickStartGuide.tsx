import React, { useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Compass,
  ExternalLink,
  HardHat,
  HelpCircle,
  KeyRound,
  Lock,
  Minimize2,
  Package,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { AdminTab } from './admin/AdminView';
import type { WorkerNavTab } from './worker/WorkerMobileView';

interface QuickStartGuideProps {
  isOpen: boolean;
  isMinimized: boolean;
  stepIndex: number;
  onStepChange: (index: number) => void;
  onMinimize: () => void;
  onResume: () => void;
  onCompleteAndClose: () => void;
  onNavigateAdminTab: (tab: AdminTab) => void;
  onNavigateWorkerTab: (tab: WorkerNavTab) => void;
}

interface GuideStep {
  id: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  renderBody: () => React.ReactNode;
}

export const QuickStartGuide: React.FC<QuickStartGuideProps> = ({
  isOpen,
  isMinimized,
  stepIndex,
  onStepChange,
  onMinimize,
  onResume,
  onCompleteAndClose,
  onNavigateAdminTab,
  onNavigateWorkerTab,
}) => {
  const { currentUser, db } = useApp();

  const isAdmin = currentUser?.role === 'admin';

  const jumpToAdmin = (tab: AdminTab) => {
    onNavigateAdminTab(tab);
    onMinimize();
  };

  const jumpToWorker = (tab: WorkerNavTab) => {
    onNavigateWorkerTab(tab);
    onMinimize();
  };

  // Checklist live per Amministratore
  const activeWorkersCount = db.workers.filter((w) => w.active).length;
  const equipmentCount = db.equipment.length;
  const sitesCount = db.sites.length;
  const configuredSitesCount = db.sites.filter(
    (s) =>
      (s.assignedWorkerIds || []).length > 0 ||
      db.phases.some((p) => p.siteId === s.id)
  ).length;

  const adminChecklist = [
    {
      done: activeWorkersCount > 0,
      label: 'Crea almeno un Dipendente',
      detail:
        activeWorkersCount > 0
          ? `${activeWorkersCount} dipendent${activeWorkersCount === 1 ? 'e attivo' : 'i attivi'}`
          : 'Genera le credenziali nome.cognome per i tuoi operai',
      actionLabel: 'Vai a Dipendenti',
      onAction: () => jumpToAdmin('workers'),
    },
    {
      done: equipmentCount > 0,
      label: 'Carica il parco Mezzi & Attrezzature',
      detail:
        equipmentCount > 0
          ? `${equipmentCount} dotazion${equipmentCount === 1 ? 'e inserita' : 'i inserite'}`
          : 'Aggiungi veicoli, macchinari e attrezzature utilizzabili in cantiere',
      actionLabel: 'Vai a Mezzi',
      onAction: () => jumpToAdmin('equipment'),
    },
    {
      done: sitesCount > 0,
      label: 'Crea il primo Cantiere',
      detail:
        sitesCount > 0
          ? `${sitesCount} cantier${sitesCount === 1 ? 'e registrato' : 'i registrati'}`
          : 'Imposta codice, ubicazione, committente e cronoprogramma',
      actionLabel: 'Vai a Cantieri',
      onAction: () => jumpToAdmin('sites'),
    },
    {
      done: configuredSitesCount > 0,
      label: 'Assegna la squadra o programma le fasi',
      detail:
        configuredSitesCount > 0
          ? `${configuredSitesCount} cantier${configuredSitesCount === 1 ? 'e configurato' : 'i configurati'}`
          : 'Apri un cantiere per assegnare i dipendenti (⚙) e le fasi',
      actionLabel: 'Apri Cantieri',
      onAction: () => jumpToAdmin('sites'),
    },
  ];
  const adminChecklistDone = adminChecklist.filter((c) => c.done).length;

  // Conteggio live cantieri assegnati al Dipendente autenticato
  const assignedActiveSitesCount = currentUser
    ? db.sites.filter(
        (s) =>
          s.status !== 'Completato' &&
          (s.assignedWorkerIds || []).includes(currentUser.id)
      ).length
    : 0;

  const adminSteps: GuideStep[] = [
    {
      id: 'admin-welcome',
      shortLabel: 'Inizio',
      title: 'Benvenuto in Gestionale AMG Tech',
      subtitle: 'Pannello di Controllo Amministratore',
      icon: Sparkles,
      accentBg: 'bg-blue-500/20',
      accentText: 'text-blue-300',
      accentBorder: 'border-blue-400/30',
      renderBody: () => (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Ciao <strong>{currentUser?.name}</strong>, questo è il pannello centrale da cui coordini cantieri, squadre, mezzi, avanzamento lavori, materiali e foto dal campo in tempo reale.
          </p>

          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-950">
            <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Primo passo consigliato:</strong> se stai usando una password iniziale, personalizzala subito dal pulsante <strong>Password</strong> nella barra in alto.
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Checklist Avvio Rapido
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {adminChecklistDone} / {adminChecklist.length} completati
              </span>
            </div>

            <div className="space-y-2">
              {adminChecklist.map((item) => (
                <div
                  key={item.label}
                  className="bg-white rounded-xl border border-slate-200/90 px-3 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {item.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div
                        className={`text-xs font-semibold ${
                          item.done ? 'text-emerald-900 line-through' : 'text-slate-900'
                        }`}
                      >
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.detail}
                      </div>
                    </div>
                  </div>
                  {!item.done && (
                    <button
                      type="button"
                      onClick={item.onAction}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold shrink-0 transition"
                    >
                      <span>{item.actionLabel}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'admin-workers',
      shortLabel: 'Dipendenti',
      title: 'Dipendenti e Credenziali Personali',
      subtitle: 'Sezione Dipendenti',
      icon: Users,
      accentBg: 'bg-indigo-500/20',
      accentText: 'text-indigo-300',
      accentBorder: 'border-indigo-400/30',
      ctaLabel: 'Vai a Dipendenti',
      onCtaClick: () => jumpToAdmin('workers'),
      renderBody: () => (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>
            Nella sezione <strong>Dipendenti</strong> crei le utenze personali per gli operai e i tecnici di cantiere:
          </p>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                Inserisci <strong>Nome</strong>, <strong>Cognome</strong> e tipologia (<em>Edilizia</em> o <em>Impiantistica</em>): lo username <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">nome.cognome</code> viene generato in automatico.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                Dopo la creazione puoi copiare le credenziali con un clic e reimpostare in seguito la password con il pulsante <strong>Password</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                Se un dipendente non collabora più, usa <strong>Disattiva</strong>: l&apos;accesso viene bloccato subito senza perdere lo storico di ore, materiali o foto.
              </span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'admin-equipment',
      shortLabel: 'Mezzi',
      title: 'Catalogo Mezzi e Attrezzature',
      subtitle: 'Parco mezzi e stato operativo',
      icon: Wrench,
      accentBg: 'bg-amber-500/20',
      accentText: 'text-amber-300',
      accentBorder: 'border-amber-400/30',
      ctaLabel: 'Vai a Mezzi & Attrezzature',
      onCtaClick: () => jumpToAdmin('equipment'),
      renderBody: () => (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>
            Solo gli amministratori gestiscono l&apos;anagrafica dei mezzi e delle attrezzature aziendali:
          </p>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Ogni dotazione riceve un <strong>codice univoco automatico</strong> (es. <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">MEZ-01</code>), categoria e targa/matricola.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Impostando lo stato <strong>In Manutenzione</strong>, il mezzo non sarà selezionabile dai dipendenti in cantiere finché non torna <strong>Disponibile</strong>.
              </span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'admin-sites',
      shortLabel: 'Cantieri',
      title: 'Cantieri, Squadre, Fasi e Report PDF',
      subtitle: 'Cuore operativo della piattaforma',
      icon: Building2,
      accentBg: 'bg-blue-500/20',
      accentText: 'text-blue-300',
      accentBorder: 'border-blue-400/30',
      ctaLabel: 'Vai a Cantieri',
      onCtaClick: () => jumpToAdmin('sites'),
      renderBody: () => (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>
            Apri qualsiasi scheda cantiere per coordinare l&apos;avanzamento e controllare tutti i costi operativi:
          </p>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Assegna Squadra:</strong> clicca sull&apos;icona ingranaggio (⚙) in alto a destra nella scheda cantiere → <em>Assegna Dipendenti</em>. Solo gli operai assegnati vedranno il cantiere sul telefono.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Fasi di Lavoro:</strong> programma le fasi operative; la percentuale complessiva del cantiere si aggiorna in automatico quando tu o un operaio aggiornate le fasi.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Report PDF A4:</strong> dallo stesso menu ⚙ puoi stampare o salvare in PDF la scheda tecnica completa scegliendo esattamente quali sezioni e foto includere.
              </span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'admin-admins',
      shortLabel: 'Admin',
      title: 'Creazione Nuovi Amministratori',
      subtitle: 'Accesso chiuso e controllo ruoli',
      icon: ShieldCheck,
      accentBg: 'bg-blue-500/20',
      accentText: 'text-blue-300',
      accentBorder: 'border-blue-400/30',
      ctaLabel: 'Vai ad Amministratori',
      onCtaClick: () => jumpToAdmin('admins'),
      renderBody: () => (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>
            Nessuno può registrarsi dall&apos;esterno: tutti i nuovi utenti nascono esclusivamente dall&apos;interno dell&apos;app.
          </p>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Nella sezione <strong>Amministratori</strong> (visibile a tutti gli amministratori attivi) puoi aggiungere colleghi d&apos;ufficio con <strong>Nome</strong>, <strong>Cognome</strong> e password iniziale.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                L&apos;amministratore originario (<code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Originario</code>) e l&apos;ultimo amministratore attivo sono sempre protetti contro disattivazioni accidentali.
              </span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'admin-safety',
      shortLabel: 'Sicurezza',
      title: 'Concorrenza, Storico e Backup Automatici',
      subtitle: 'Protezione dei dati aziendali',
      icon: Lock,
      accentBg: 'bg-emerald-500/20',
      accentText: 'text-emerald-300',
      accentBorder: 'border-emerald-400/30',
      renderBody: () => (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>
            Più amministratori e dipendenti possono lavorare contemporaneamente sugli stessi cantieri in piena sicurezza:
          </p>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Sincronizzazione live &amp; Anti-sovrascrittura:</strong> se due amministratori modificano lo stesso record nello stesso momento, il secondo viene avvisato con i dati aggiornati anziché sovrascrivere il lavoro altrui.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Zero perdita dati:</strong> le archiviazioni mantengono intatto lo storico nel database con traccia delle modifiche e backup automatici cifrati notturni.
              </span>
            </li>
          </ul>
        </div>
      ),
    },
  ];

  const workerSteps: GuideStep[] = [
    {
      id: 'worker-welcome',
      shortLabel: 'Inizio',
      title: 'Benvenuto in Gestionale AMG Tech',
      subtitle: 'App Dipendente per il cantiere',
      icon: HardHat,
      accentBg: 'bg-teal-500/20',
      accentText: 'text-teal-300',
      accentBorder: 'border-teal-400/30',
      renderBody: () => (
        <div className="space-y-3.5 text-sm text-slate-600 leading-relaxed">
          <p>
            Ciao <strong>{currentUser?.name}</strong>, da qui registri ogni giorno ore lavorate, materiali usati, utilizzo mezzi e foto di avanzamento direttamente dal tuo smartphone.
          </p>

          <div className="rounded-xl bg-teal-50/70 border border-teal-200 p-3.5 space-y-1.5">
            <div className="text-xs font-bold text-teal-950 flex items-center justify-between">
              <span>I Tuoi Cantieri Attivi assegnati</span>
              <span className="px-2 py-0.5 rounded-full bg-white border border-teal-200 text-teal-800">
                {assignedActiveSitesCount}
              </span>
            </div>
            <p className="text-xs text-teal-900/90 leading-relaxed">
              {assignedActiveSitesCount > 0
                ? 'Seleziona il cantiere su cui stai lavorando dal menu a tendina in alto. Tocca l’indirizzo per aprire Google Maps e raggiungerlo subito.'
                : "Quando l'Amministrazione ti assegnerà a un cantiere attivo, lo vedrai comparire automaticamente nel selettore in alto (i cantieri completati non compaiono)."}
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-950">
            <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Puoi cambiare in autonomia la tua password iniziale toccando il pulsante <strong>Password</strong> in alto a destra.
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'worker-home',
      shortLabel: 'Cantiere',
      title: 'Operazioni Rapide e Fasi di Lavoro',
      subtitle: 'Scheda Cantiere',
      icon: Compass,
      accentBg: 'bg-blue-500/20',
      accentText: 'text-blue-300',
      accentBorder: 'border-blue-400/30',
      ctaLabel: 'Vai a Cantiere',
      onCtaClick: () => jumpToWorker('home'),
      renderBody: () => (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>
            La schermata principale <strong>Cantiere</strong> ti dà accesso immediato a tutte le funzioni:
          </p>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Usa i 4 riquadri in <strong>Operazioni Rapide</strong> oppure la barra in basso per passare tra <em>Ore</em>, <em>Materiali</em>, <em>Mezzi e Attrezzature</em> e <em>Foto</em>.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Sotto le operazioni trovi le <strong>Fasi di Lavoro</strong>: trascina il cursore percentuale e rilascia per aggiornare l&apos;avanzamento verso l&apos;ufficio.
              </span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'worker-hours',
      shortLabel: 'Ore',
      title: 'Registra Ore Lavorate e Storico',
      subtitle: 'Scheda Ore',
      icon: Clock,
      accentBg: 'bg-teal-500/20',
      accentText: 'text-teal-300',
      accentBorder: 'border-teal-400/30',
      ctaLabel: 'Vai a Ore',
      onCtaClick: () => jumpToWorker('hours'),
      renderBody: () => (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>
                Scegli la fase di lavoro, la data, imposta le ore (anche con i tasti rapidi <strong>4h / 6h / 8h</strong>) e descrivi brevemente l&apos;attività svolta.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>
                Subito sotto trovi <strong>Le tue ore</strong> con il totale cumulato e lo storico completo delle tue registrazioni su quel cantiere.
              </span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'worker-materials',
      shortLabel: 'Materiali',
      title: 'Segna i Materiali Consumati',
      subtitle: 'Scheda Materiali',
      icon: Package,
      accentBg: 'bg-orange-500/20',
      accentText: 'text-orange-300',
      accentBorder: 'border-orange-400/30',
      ctaLabel: 'Vai a Materiali',
      onCtaClick: () => jumpToWorker('materials'),
      renderBody: () => (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              <span>
                Inserisci sempre il <strong>Codice Articolo</strong> (ed eventualmente il nome), categoria, quantità e unità di misura, quindi premi <strong>Registra materiale</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              <span>
                Nella lista sotto vedi tutti i materiali caricati sul cantiere e puoi <strong>modificare o eliminare</strong> quelli inseriti da te.
              </span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'worker-equipment',
      shortLabel: 'Mezzi',
      title: 'Utilizzo Mezzi e Attrezzature',
      subtitle: 'Scheda Mezzi e Attrezzature',
      icon: Wrench,
      accentBg: 'bg-amber-500/20',
      accentText: 'text-amber-300',
      accentBorder: 'border-amber-400/30',
      ctaLabel: 'Vai a Mezzi e Attrezzature',
      onCtaClick: () => jumpToWorker('equipment'),
      renderBody: () => (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Seleziona un mezzo o un&apos;attrezzatura disponibile dal catalogo aziendale, indica la data ed eventualmente le ore di utilizzo o note.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Puoi consultare la cronologia degli utilizzi sul cantiere e correggere o rimuovere esclusivamente le tue registrazioni.
              </span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: 'worker-photos',
      shortLabel: 'Foto',
      title: 'Carica Più Foto di Cantiere',
      subtitle: 'Scheda Foto',
      icon: Camera,
      accentBg: 'bg-violet-500/20',
      accentText: 'text-violet-300',
      accentBorder: 'border-violet-400/30',
      ctaLabel: 'Vai a Foto',
      onCtaClick: () => jumpToWorker('photos'),
      renderBody: () => (
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
              <span>
                Tocca <strong>Fotocamera / Galleria</strong> per selezionare e inviare <strong>una o più foto contemporaneamente</strong>: vengono ottimizzate in automatico prima del caricamento.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <CheckCircle2 className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
              <span>
                Puoi vedere a schermo intero tutte le foto del cantiere e modificare o eliminare <strong>solo le foto caricate da te</strong>.
              </span>
            </li>
          </ul>
        </div>
      ),
    },
  ];

  const steps = isAdmin ? adminSteps : workerSteps;
  const safeStepIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
  const currentStep = steps[safeStepIndex];
  const isFirstStep = safeStepIndex === 0;
  const isLastStep = safeStepIndex === steps.length - 1;
  const StepIcon = currentStep.icon;

  useEffect(() => {
    if (!isOpen || isMinimized) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (event.key === 'Escape') {
        onCompleteAndClose();
      } else if (event.key === 'ArrowRight' && safeStepIndex < steps.length - 1) {
        onStepChange(safeStepIndex + 1);
      } else if (event.key === 'ArrowLeft' && safeStepIndex > 0) {
        onStepChange(safeStepIndex - 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isMinimized,
    safeStepIndex,
    steps.length,
    onStepChange,
    onCompleteAndClose,
  ]);

  if (!isOpen || !currentUser) return null;

  if (isMinimized) {
    return (
      <div
        className={`fixed z-50 ${
          isAdmin ? 'bottom-4 right-4' : 'bottom-20 right-3'
        } max-w-[calc(100vw-1.5rem)]`}
      >
        <div className="bg-slate-900 text-white border border-slate-700 shadow-2xl rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5">
          <HelpCircle className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="text-xs leading-tight min-w-0">
            <div className="font-semibold truncate">
              Guida rapida ({safeStepIndex + 1}/{steps.length})
            </div>
            <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
              {currentStep.shortLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shrink-0"
          >
            Riprendi
          </button>
          <button
            type="button"
            onClick={onCompleteAndClose}
            aria-label="Chiudi guida rapida"
            title="Chiudi guida"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick Start Guide Interattiva"
      onClick={onCompleteAndClose}
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${currentStep.accentBg} ${currentStep.accentText} ${currentStep.accentBorder}`}
              >
                <StepIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <span>
                    Quick Start • {isAdmin ? 'Amministratore' : 'Dipendente'}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-blue-300">
                    Passo {safeStepIndex + 1} di {steps.length}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white truncate mt-0.5">
                  {currentStep.title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onMinimize}
                title="Riduci a icona mentre provi"
                aria-label="Riduci a icona guida"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onCompleteAndClose}
                title="Chiudi guida"
                aria-label="Chiudi guida"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar + Interactive Step Pills */}
          <div className="mt-3.5 space-y-2">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-200"
                style={{
                  width: `${Math.round(((safeStepIndex + 1) / steps.length) * 100)}%`,
                }}
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {steps.map((step, idx) => {
                const isCurrent = idx === safeStepIndex;
                const isVisited = idx < safeStepIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => onStepChange(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition border ${
                      isCurrent
                        ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                        : isVisited
                        ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {idx + 1}. {step.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable Step Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {currentStep.subtitle}
          </div>

          {currentStep.renderBody()}

          {currentStep.ctaLabel && currentStep.onCtaClick && (
            <div className="pt-1">
              <button
                type="button"
                onClick={currentStep.onCtaClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
              >
                <span>{currentStep.ctaLabel}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <span className="block text-[11px] text-slate-400 mt-1.5">
                La guida si ridurrà in basso così potrai provare subito la sezione e poi riprenderla.
              </span>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onCompleteAndClose}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition"
            >
              Salta guida
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onStepChange(Math.max(0, safeStepIndex - 1))}
                disabled={isFirstStep}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-700 text-xs font-semibold transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Indietro</span>
              </button>

              {isLastStep ? (
                <button
                  type="button"
                  onClick={onCompleteAndClose}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  <span>Inizia a lavorare</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onStepChange(Math.min(steps.length - 1, safeStepIndex + 1))
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  <span>Avanti</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <p className="text-[11px] text-center text-slate-400">
            Puoi riaprire questa guida in qualsiasi momento dal pulsante <strong>Guida</strong> in alto.
          </p>
        </div>
      </div>
    </div>
  );
};
