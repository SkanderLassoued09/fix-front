// ═══════════════════════════════════════════════════
//  SAV ATELIER — KPI DASHBOARD
//  dashboard.component.ts
// ═══════════════════════════════════════════════════
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Subject, finalize, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationService } from 'src/app/demo/service/notification.service';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { TicketRefreshService } from 'src/app/demo/service/ticket-refresh.service';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { SavDashboardService } from './dashboard-data/dashboard.service';
import {
  DashboardOverview,
  TechLeaderRow,
  TrendPoint,
  FinanceTrendPoint,
  CategorySlice,
} from './dashboard-data/dashboard.types';
import {
  PeriodSelection,
  buildPeriodFromPreset,
} from './period-filter/period-filter.types';

interface Technicien {
  nom: string;
  role: string;
  nbDiTraites: number;
  nbDiClotures: number;
  firstTimeRight: number;
  tauxRetours: number;
  tatMoyen: number;
  tauxIrreparables: number;
}

interface FinanceKpiTile {
  label: string;
  value: string;
  icon: string;
  target?: string;
  statusClass: string;
  /** When true the tile is rendered as an empty-state instead of showing
   *  a fabricated number. Used for metrics that depend on Phase B schemas. */
  isPlaceholder?: boolean;
}

interface RhKpiTile {
  label: string;
  value: string;
  progress: number;
  class: string;
  isPlaceholder?: boolean;
}

interface TechWorkflowCard {
  key: string;
  title: string;
  icon: string;
  className: string;
  totalLabel: string;
  total: number;
  stats: Array<{ label: string; value: number; icon: string }>;
}

@Component({
  selector: 'app-sav-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private isTechWorkflowRequestInFlight = false;
  private hasPendingTechWorkflowRefresh = false;
  private isDashboardRequestInFlight = false;
  private hasPendingDashboardRefresh = false;
  private isDestroyed = false;

  today = new Date();
  isTechWorkflowLoading = false;
  isDashboardLoading = false;

  /** Active period — drives every backend query on the dashboard. */
  periodSelection: PeriodSelection = buildPeriodFromPreset('MONTH');

  techWorkflowCards: TechWorkflowCard[] = [];

  // ─── A — KPI ATELIER ──────────────────────────────
  kpiAtelier = { tauxClotures: 0 };

  // ─── B — DÉLAIS ───────────────────────────────────
  kpiDelais = {
    tatMoyen: 0,
    tauxEnCours: 0,
    tauxStagnant: 0,
    delaiMoyenStatut: 0,
  };

  get tatProgress(): number {
    return Math.min((this.kpiDelais.tatMoyen / 10) * 100, 100);
  }

  // ─── C — VOLUME & CHARGE ──────────────────────────
  kpiVolume = { nbRecus: 0, nbClotures: 0, nbEnCours: 0, nbRetours: 0 };

  volumeStats: Array<{ label: string; value: number; class: string; target: string }> = [
    { label: 'DI Reçus', value: 0, class: 'kpi-neutral', target: '' },
    { label: 'DI Clôturés', value: 0, class: 'kpi-green', target: '' },
    { label: 'DI en cours', value: 0, class: 'kpi-green', target: '≤ 30' },
    { label: 'Retours/sem', value: 0, class: 'kpi-green', target: '≤ 2' },
  ];

  // ─── D — SATISFACTION (Phase B) ───────────────────
  /** Score is null until the Phase B DiRating schema lands — template uses
   *  `hasSatisfactionData` to render an empty-state badge in the same card. */
  satisfactionScore: number | null = null;
  nbReclamations: number | null = null;
  hasSatisfactionData = false;

  // ─── STATUS GLOBAL ────────────────────────────────
  get globalStatus(): { label: string; severity: string } {
    const score = this.kpiAtelier.tauxClotures;
    if (score >= 80) return { label: '✓ Objectifs Atteints', severity: 'success' };
    if (score >= 65) return { label: '⚠ Attention', severity: 'warning' };
    return { label: '✗ Sous Objectif', severity: 'danger' };
  }

  // ─── TECHNICIANS ──────────────────────────────────
  techniciens: Technicien[] = [];
  hasLeaderboardData = false;

  // ─── FINANCE ──────────────────────────────────────
  /** Sentinel object preserved for the `Recouvrement` card; null marks Phase B. */
  finance = {
    tauxRecouvrement: null as number | null,
    creances: null as number | null,
    facturesGt90: null as number | null,
    delaiPaiement: null as number | null,
  };
  hasRecouvrementData = false;
  hasFinanceTrendData = false;

  financeKpis: FinanceKpiTile[] = [];
  rhKpis: RhKpiTile[] = [];

  // ═══════════════════════════════════════════════════
  //  CHART CONFIGURATIONS
  // ═══════════════════════════════════════════════════
  volumeChartData: any;
  volumeChartOptions: any;
  trendChartData: any;
  trendChartOptions: any;
  categoryChartData: any;
  categoryChartOptions: any;
  satisfactionTrendData: any;
  satisfactionTrendOptions: any;
  techFtrChartData: any;
  techFtrChartOptions: any;
  financeBarData: any;
  financeBarOptions: any;

  constructor(
    private apollo: Apollo,
    private ticketService: TicketService,
    private notificationService: NotificationService,
    private ticketRefreshService: TicketRefreshService,
    private profileService: ProfileService,
    private dashboardService: SavDashboardService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.buildTechWorkflowCards({});
    this.initEmptyFinanceTiles();
    this.initRhPlaceholders();
    this.buildVolumeChart();
    this.buildTrendChart([]);
    this.buildCategoryChart([]);
    this.buildSatisfactionTrendChart([]);
    this.buildTechFtrChart([]);
    this.buildFinanceChart([]);

    this.loadTechWorkflowCounts();
    this.refreshDashboard();
    this.setupRealtimeRefresh();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByTechWorkflowCard(_: number, card: TechWorkflowCard): string {
    return card.key;
  }

  trackByTechWorkflowStat(_: number, stat: { label: string }): string {
    return stat.label;
  }

  // ─── PERIOD FILTER ──────────────────────────────────────────────────────

  onPeriodChange(selection: PeriodSelection): void {
    this.periodSelection = selection;
    this.refreshDashboard();
    this.ticketRefreshService.requestRefresh('dashboard-tech-workflow', {
      source: 'period-change',
    });
  }

  // ─── REALTIME WIRING ────────────────────────────────────────────────────

  private setupRealtimeRefresh(): void {
    // The tech-workflow refresh key is shared: every websocket event that
    // implies a DI state change funnels through it (debounced 350ms by
    // TicketRefreshService). Both the flux cards AND the dashboard analytics
    // re-fetch off the same tick.
    this.ticketRefreshService
      .listen('dashboard-tech-workflow')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadTechWorkflowCounts();
        this.refreshDashboard();
      });

    const requestRefresh = (source: string) => {
      this.ticketRefreshService.requestRefresh('dashboard-tech-workflow', {
        source,
      });
    };

    this.notificationService.notification$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        if (message) requestRefresh('websocket:updateTicket');
      });

    this.notificationService.blAdded$
      .pipe(takeUntil(this.destroy$))
      .subscribe((message) => {
        if (message) requestRefresh('websocket:blAdded');
      });

    // Stagnation / generic operational alerts — each new alert may change the
    // "Taux DI stagnants" / "Délai moyen par statut" tiles, so refresh.
    this.notificationService.alertCreated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => requestRefresh('websocket:alertCreated'));
    this.notificationService.alertResolved$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => requestRefresh('websocket:alertResolved'));

    this.apollo
      .subscribe<any>({ query: this.profileService.notificationDiagnostic() })
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => requestRefresh('graphql:notificationDiagnostic'));

    this.apollo
      .subscribe<any>({ query: this.profileService.notificationrep() })
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => requestRefresh('graphql:notificationReparation'));
  }

  // ─── FLUX TECHNICIEN (unchanged from before — already wired) ────────────

  private loadTechWorkflowCounts(): void {
    if (this.isTechWorkflowRequestInFlight) {
      this.hasPendingTechWorkflowRefresh = true;
      return;
    }
    this.isTechWorkflowRequestInFlight = true;
    this.isTechWorkflowLoading = true;

    this.apollo
      .query<any>({
        query: this.ticketService.getDataForTech(),
        fetchPolicy: 'no-cache',
      })
      .pipe(
        finalize(() => {
          this.isTechWorkflowLoading = false;
          this.isTechWorkflowRequestInFlight = false;
          if (!this.isDestroyed && this.hasPendingTechWorkflowRefresh) {
            this.hasPendingTechWorkflowRefresh = false;
            this.loadTechWorkflowCounts();
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(({ data }) => {
        this.buildTechWorkflowCards(
          this.normalizeTechWorkflowCounts(data?.getDiStatusCounts),
        );
      });
  }

  private normalizeTechWorkflowCounts(
    rows: Array<{ status: string; count: number }> = [],
  ): Record<string, number> {
    return rows.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = Number(item.count || 0);
      return acc;
    }, {});
  }

  private buildTechWorkflowCards(counts: Record<string, number>): void {
    const diagPaused = counts['DIAGNOSTIC_Pause'] || 0;
    const diagNotOpened = counts['DIAGNOSTIC'] || 0;
    const repPaused = counts['REPARATION_Pause'] || 0;
    const repNotOpened = counts['REPARATION'] || 0;
    const retour1 = counts['RETOUR1'] || 0;
    const retour2 = counts['RETOUR2'] || 0;
    const retour3 = counts['RETOUR3'] || 0;
    const finished = counts['FINISHED'] || 0;
    const knownStatuses = [
      'DIAGNOSTIC_Pause',
      'DIAGNOSTIC',
      'REPARATION_Pause',
      'REPARATION',
      'RETOUR1',
      'RETOUR2',
      'RETOUR3',
      'FINISHED',
    ];
    const administration = Object.entries(counts).reduce(
      (sum, [status, count]) =>
        knownStatuses.includes(status) ? sum : sum + count,
      0,
    );

    this.techWorkflowCards = [
      {
        key: 'diagnostic',
        title: 'Diagnostic',
        icon: 'pi pi-wrench',
        className: 'sav-dash-card--diag',
        totalLabel: 'Total',
        total: diagPaused + diagNotOpened,
        stats: this.nonZeroStats([
          { label: 'En pause', value: diagPaused, icon: 'pi pi-pause-circle' },
          { label: 'Non ouvert', value: diagNotOpened, icon: 'pi pi-envelope' },
        ]),
      },
      {
        key: 'repair',
        title: 'Réparation',
        icon: 'pi pi-cog',
        className: 'sav-dash-card--rep',
        totalLabel: 'Total',
        total: repPaused + repNotOpened,
        stats: this.nonZeroStats([
          { label: 'En pause', value: repPaused, icon: 'pi pi-pause-circle' },
          { label: 'Non ouvert', value: repNotOpened, icon: 'pi pi-envelope' },
        ]),
      },
      {
        key: 'retour',
        title: 'Retour',
        icon: 'pi pi-refresh',
        className: 'sav-dash-card--retour',
        totalLabel: 'Total',
        total: retour1 + retour2 + retour3,
        stats: this.nonZeroStats([
          { label: 'Retour 1', value: retour1, icon: 'pi pi-angle-right' },
          { label: 'Retour 2', value: retour2, icon: 'pi pi-angle-right' },
          { label: 'Retour 3', value: retour3, icon: 'pi pi-angle-right' },
        ]),
      },
      {
        key: 'admin',
        title: 'Administration',
        icon: 'pi pi-shield',
        className: 'sav-dash-card--admin',
        totalLabel: 'Autre',
        total: administration,
        stats: this.nonZeroStats([
          { label: 'Finie', value: finished, icon: 'pi pi-check-circle' },
        ]),
      },
    ];
  }

  private nonZeroStats(stats: TechWorkflowCard['stats']) {
    return stats.filter((stat) => stat.value > 0);
  }

  // ─── DASHBOARD ANALYTICS (everything below this line is new) ────────────

  private refreshDashboard(): void {
    if (this.isDashboardRequestInFlight) {
      this.hasPendingDashboardRefresh = true;
      return;
    }
    this.isDashboardRequestInFlight = true;
    this.isDashboardLoading = true;

    const startIso = this.periodSelection.startDate.toISOString();
    const endIso = this.periodSelection.endDate.toISOString();
    const granularity = this.periodSelection.granularity;

    forkJoin({
      overview: this.dashboardService
        .fetchOverview(startIso, endIso)
        .pipe(catchError(() => of(null))),
      trend: this.dashboardService
        .fetchTrend(startIso, endIso, granularity)
        .pipe(catchError(() => of([] as TrendPoint[]))),
      categories: this.dashboardService
        .fetchCategories(startIso, endIso)
        .pipe(catchError(() => of([] as CategorySlice[]))),
      leaderboard: this.dashboardService
        .fetchLeaderboard(startIso, endIso, 20)
        .pipe(catchError(() => of([] as TechLeaderRow[]))),
      financeTrend: this.dashboardService
        .fetchFinanceTrend(startIso, endIso, 'MONTH')
        .pipe(catchError(() => of([] as FinanceTrendPoint[]))),
    })
      .pipe(
        finalize(() => {
          this.isDashboardLoading = false;
          this.isDashboardRequestInFlight = false;
          if (!this.isDestroyed && this.hasPendingDashboardRefresh) {
            this.hasPendingDashboardRefresh = false;
            this.refreshDashboard();
          }
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(({ overview, trend, categories, leaderboard, financeTrend }) => {
        if (overview) this.applyOverview(overview);
        this.buildTrendChart(trend);
        this.buildCategoryChart(categories);
        this.applyLeaderboard(leaderboard);
        this.buildTechFtrChart(this.techniciens);
        this.buildFinanceChart(financeTrend);
      });
  }

  private applyOverview(o: DashboardOverview): void {
    // Round to one decimal so the knob/progressbar bindings get stable values.
    const r1 = (n: number | null | undefined): number =>
      n == null ? 0 : Math.round(n * 10) / 10;

    this.kpiAtelier = { tauxClotures: r1(o.atelier?.tauxClotures) };
    this.kpiDelais = {
      tatMoyen: r1(o.delais?.tatMoyenJours),
      tauxEnCours: r1(o.atelier?.tauxEnCours),
      tauxStagnant: r1(o.delais?.tauxStagnant),
      delaiMoyenStatut: r1(o.delais?.delaiMoyenStatutJours),
    };
    this.kpiVolume = {
      nbRecus: o.volume?.nbRecus ?? 0,
      nbClotures: o.volume?.nbClotures ?? 0,
      nbEnCours: o.volume?.nbEnCours ?? o.atelier?.nbEnCours ?? 0,
      nbRetours: o.volume?.nbRetours ?? 0,
    };
    this.volumeStats = [
      { label: 'DI Reçus', value: this.kpiVolume.nbRecus, class: 'kpi-neutral', target: '' },
      { label: 'DI Clôturés', value: this.kpiVolume.nbClotures, class: 'kpi-green', target: '' },
      {
        label: 'DI en cours',
        value: this.kpiVolume.nbEnCours,
        class:
          this.kpiVolume.nbEnCours <= 30
            ? 'kpi-green'
            : this.kpiVolume.nbEnCours <= 40
              ? 'kpi-orange'
              : 'kpi-red',
        target: '≤ 30',
      },
      {
        label: 'Retours',
        value: this.kpiVolume.nbRetours,
        class:
          this.kpiVolume.nbRetours <= 2
            ? 'kpi-green'
            : this.kpiVolume.nbRetours <= 5
              ? 'kpi-orange'
              : 'kpi-red',
        target: '≤ 2',
      },
    ];
    this.buildVolumeChart();

    this.satisfactionScore = o.satisfaction?.score ?? null;
    this.nbReclamations = o.satisfaction?.nbReclamations ?? null;
    this.hasSatisfactionData =
      this.satisfactionScore !== null && this.satisfactionScore !== undefined;

    const f = o.finance ?? ({} as any);
    this.finance = {
      tauxRecouvrement: f.tauxRecouvrement ?? null,
      creances: f.creances ?? null,
      facturesGt90: f.facturesGt90 ?? null,
      delaiPaiement: f.delaiPaiementJours ?? null,
    };
    this.hasRecouvrementData = this.finance.tauxRecouvrement !== null;
    this.financeKpis = this.buildFinanceTiles(f);
  }

  private applyLeaderboard(rows: TechLeaderRow[]): void {
    this.hasLeaderboardData = rows.length > 0;
    this.techniciens = rows.map<Technicien>((r) => ({
      nom: r.techName,
      role: r.role || 'Technicien',
      nbDiTraites: r.nbDiTraites,
      nbDiClotures: r.nbDiClotures,
      firstTimeRight: Math.round(r.firstTimeRight),
      tauxRetours: Math.round(r.tauxRetours),
      tatMoyen: Math.round(r.tatMoyenJours * 10) / 10,
      tauxIrreparables: Math.round(r.tauxIrreparables),
    }));
  }

  // ─── FINANCE / RH tile builders ─────────────────────────────────────────

  private initEmptyFinanceTiles(): void {
    this.financeKpis = this.buildFinanceTiles(null);
  }

  private buildFinanceTiles(f: any): FinanceKpiTile[] {
    const fmtPct = (v: number | null) =>
      v == null ? '—' : `${Math.round(v)}%`;
    const fmtEur = (v: number | null) =>
      v == null
        ? '—'
        : new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0,
          }).format(v);
    const fmtDays = (v: number | null) =>
      v == null ? '—' : `${Math.round(v)} jours`;

    const isPh = (v: number | null | undefined) => v == null;

    return [
      {
        label: 'Taux Facturation',
        value: fmtPct(f?.tauxFacturation ?? null),
        icon: 'pi-file-edit',
        target: 'Cible ≥ 90%',
        statusClass: isPh(f?.tauxFacturation)
          ? 'fin-neutral'
          : f.tauxFacturation >= 90
            ? 'fin-green'
            : 'fin-orange',
        isPlaceholder: isPh(f?.tauxFacturation),
      },
      {
        label: 'CA Facturé',
        value: fmtEur(f?.caFacture ?? null),
        icon: 'pi-euro',
        target: '',
        statusClass: 'fin-blue',
        isPlaceholder: isPh(f?.caFacture),
      },
      {
        label: 'Marge Brute',
        value: fmtPct(f?.margeBrute ?? null),
        icon: 'pi-chart-line',
        target: 'Bientôt disponible',
        statusClass: 'fin-neutral',
        isPlaceholder: true,
      },
      {
        label: 'Coût Horaire',
        value: f?.coutHoraire == null ? '—' : `${f.coutHoraire} €/h`,
        icon: 'pi-stopwatch',
        target: 'Bientôt disponible',
        statusClass: 'fin-neutral',
        isPlaceholder: true,
      },
      {
        label: 'Taux Recouvr.',
        value: fmtPct(f?.tauxRecouvrement ?? null),
        icon: 'pi-wallet',
        target: 'Bientôt disponible',
        statusClass: 'fin-neutral',
        isPlaceholder: true,
      },
      {
        label: 'Créances',
        value: fmtEur(f?.creances ?? null),
        icon: 'pi-credit-card',
        target: 'Bientôt disponible',
        statusClass: 'fin-neutral',
        isPlaceholder: true,
      },
      {
        label: 'Fact. > 90j',
        value: fmtEur(f?.facturesGt90 ?? null),
        icon: 'pi-exclamation-triangle',
        target: 'Bientôt disponible',
        statusClass: 'fin-neutral',
        isPlaceholder: true,
      },
      {
        label: 'Délai Paiement',
        value: fmtDays(f?.delaiPaiementJours ?? null),
        icon: 'pi-calendar-times',
        target: 'Bientôt disponible',
        statusClass: 'fin-neutral',
        isPlaceholder: true,
      },
    ];
  }

  private initRhPlaceholders(): void {
    this.rhKpis = [
      {
        label: 'Absentéisme',
        value: '—',
        progress: 0,
        class: 'kpi-neutral',
        isPlaceholder: true,
      },
      {
        label: 'Heures travaillées',
        value: '—',
        progress: 0,
        class: 'kpi-neutral',
        isPlaceholder: true,
      },
      {
        label: 'Formations réal.',
        value: '—',
        progress: 0,
        class: 'kpi-neutral',
        isPlaceholder: true,
      },
    ];
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────

  kpiClass(value: number, target: number, mode: 'gte' | 'lte'): string {
    const ok = mode === 'gte' ? value >= target : value <= target;
    const mid =
      mode === 'gte' ? value >= target * 0.85 : value <= target * 1.25;
    if (ok) return 'kpi-green';
    if (mid) return 'kpi-orange';
    return 'kpi-red';
  }

  kpiKnobColor(value: number, target: number, mode: 'gte' | 'lte'): string {
    const cls = this.kpiClass(value, target, mode);
    const map: Record<string, string> = {
      'kpi-green': '#22c55e',
      'kpi-orange': '#f97316',
      'kpi-red': '#ef4444',
    };
    return map[cls] ?? '#94a3b8';
  }

  // ─── CHART BUILDERS ─────────────────────────────────────────────────────

  private buildVolumeChart(): void {
    this.volumeChartData = {
      labels: ['Reçus', 'Clôturés', 'En cours', 'Retours'],
      datasets: [
        {
          label: 'Volume DI',
          data: [
            this.kpiVolume.nbRecus,
            this.kpiVolume.nbClotures,
            this.kpiVolume.nbEnCours,
            this.kpiVolume.nbRetours,
          ],
          backgroundColor: ['#3b82f6', '#22c55e', '#f97316', '#ef4444'],
          borderRadius: 6,
          barThickness: 32,
        },
      ],
    };
    this.volumeChartOptions = {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
        x: { grid: { display: false } },
      },
      responsive: true,
      maintainAspectRatio: false,
    };
  }

  private buildTrendChart(points: TrendPoint[]): void {
    this.trendChartData = {
      labels: points.map((p) => p.label),
      datasets: [
        {
          label: 'DI Reçus',
          data: points.map((p) => p.recus),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'DI Clôturés',
          data: points.map((p) => p.clotures),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Retours',
          data: points.map((p) => p.retours),
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.05)',
          fill: false,
          tension: 0.4,
          borderDash: [5, 5],
          pointRadius: 3,
        },
      ],
    };
    this.trendChartOptions = {
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
        x: { grid: { display: false } },
      },
      responsive: true,
      maintainAspectRatio: false,
    };
  }

  private buildCategoryChart(slices: CategorySlice[]): void {
    // Top 5 + group everything else into "Autres" so the donut stays readable.
    const palette = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#0ea5e9', '#94a3b8'];
    const top = slices.slice(0, 5);
    const otherCount = slices.slice(5).reduce((sum, s) => sum + s.count, 0);
    const labels = top.map((s) => s.categoryName);
    const data = top.map((s) => s.count);
    if (otherCount > 0) {
      labels.push('Autres');
      data.push(otherCount);
    }
    this.categoryChartData = {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          hoverOffset: 10,
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    };
    this.categoryChartOptions = {
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, padding: 12, font: { size: 11 } },
        },
      },
      cutout: '65%',
      responsive: true,
      maintainAspectRatio: false,
    };
  }

  private buildSatisfactionTrendChart(_points: any[]): void {
    // Phase B will populate this with monthly satisfaction averages.
    this.satisfactionTrendData = {
      labels: [],
      datasets: [
        {
          label: 'Score /5',
          data: [],
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
        },
      ],
    };
    this.satisfactionTrendOptions = {
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 3,
          max: 5,
          grid: { color: '#e2e8f0' },
          ticks: { callback: (v: number) => v + '/5' },
        },
        x: { grid: { display: false } },
      },
      responsive: true,
      maintainAspectRatio: false,
    };
  }

  private buildTechFtrChart(techs: Technicien[]): void {
    const names = techs.map((t) => t.nom);
    const ftrValues = techs.map((t) => t.firstTimeRight);
    const bgColors = ftrValues.map((v) =>
      v >= 85 ? '#22c55e' : v >= 72 ? '#f97316' : '#ef4444',
    );
    this.techFtrChartData = {
      labels: names,
      datasets: [
        {
          label: 'FTR %',
          data: ftrValues,
          backgroundColor: bgColors,
          borderRadius: 6,
          barThickness: 40,
        },
        {
          label: 'Objectif (85%)',
          data: names.map(() => 85),
          type: 'line',
          borderColor: '#3b82f6',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
      ],
    };
    this.techFtrChartOptions = {
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } },
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: { color: '#e2e8f0' },
          ticks: { callback: (v: number) => v + '%' },
        },
        x: { grid: { display: false } },
      },
      responsive: true,
      maintainAspectRatio: false,
    };
  }

  private buildFinanceChart(points: FinanceTrendPoint[]): void {
    this.hasFinanceTrendData = points.some(
      (p) => p.caFacture > 0 || (p.tauxFacturation ?? 0) > 0,
    );
    this.financeBarData = {
      labels: points.map((p) => p.label),
      datasets: [
        {
          label: 'CA Facturé (€)',
          data: points.map((p) => p.caFacture),
          backgroundColor: '#3b82f6',
          borderRadius: 6,
          barThickness: 22,
          yAxisID: 'y',
        },
        {
          label: 'Taux Facturation (%)',
          data: points.map((p) => p.tauxFacturation ?? 0),
          type: 'line',
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.1)',
          fill: false,
          tension: 0.4,
          pointRadius: 4,
          yAxisID: 'y1',
        },
      ],
    };
    this.financeBarOptions = {
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: '€' },
          grid: { color: '#e2e8f0' },
        },
        y1: {
          position: 'right',
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          ticks: { callback: (v: number) => v + '%' },
        },
        x: { grid: { display: false } },
      },
      responsive: true,
      maintainAspectRatio: false,
    };
  }
}
