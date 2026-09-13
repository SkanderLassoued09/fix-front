import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    Output,
    SimpleChanges,
} from '@angular/core';
import { Apollo } from 'apollo-angular';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DiPdfService } from 'src/app/demo/service/di-pdf.service';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
import { environment } from 'src/environments/environment';
import { DiImageComponent } from '../di-image/di-image.component';
import { ComposantCatalogService, ComposantCatalog } from 'src/app/demo/service/composant-catalog.service';
import { docHref } from '../doc-href.util';
import {
    DiComposantLine,
    ComposantStatusKey,
    StockHealth,
    enrichComposants,
    composantsGrandTotal,
    composantsPricedCount,
    composantStatusKey,
    stockHealth,
    stockBadgeLabel,
    formatComingDate,
    cleanComposantValue,
} from '../composant-enrichment.util';
import {
    buildCycleTimeline,
    buildRawTimeline,
    sanitizeHistory,
    sliceHistoryByCycle,
    formatTimelineDate,
    formatDuration,
    RawTimelineRow,
    TimelineRow,
} from '../status-timeline.util';

/** Onglets du dossier. `dossier` = la vue historique, inchangée. */
// `journal` n'est plus un onglet AFFICHÉ : il subsiste comme clé de chargement
// des événements ERP, dont dépendent le motif du bandeau « Retour N » et les
// traces de dépôt de documents de l'onglet Liens.
export type DiInfoTab = 'dossier' | 'journal' | 'temps' | 'finances' | 'liens';

/**
 * Modal « Dossier d'intervention » — LECTURE SEULE, partagé par ticket-list ET
 * coordinateur (une seule implémentation).
 *
 * Refonte : coque bornée (~85vh) à 3 zones — en-tête + sélecteur de cycle FIXES,
 * corps DÉFILANT (une seule scrollbar), pied FIXE. Un sélecteur de CYCLE DE RETOUR
 * (Flow original · Retour 1…N) re-scope TOUT le dossier (parcours, temps,
 * documents, finances) au cycle choisi — SOURCE UNIQUE `di.logs` (cycle 0 = la DI
 * elle-même ; cycle N = `di.logs[idIgnore=N]`). Aucun `retour1/2/3` en secours.
 */
@Component({
    selector: 'app-di-info-modal',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        DialogModule,
        ButtonModule,
        DiImageComponent,
    ],
    templateUrl: './di-info-modal.component.html',
    styleUrls: ['./di-info-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiInfoModalComponent implements OnChanges {
    @Input() di: any = null;
    @Input() visible = false;
    @Output() visibleChange = new EventEmitter<boolean>();

    /** Plancher de facturation du diagnostic (borne basse 150 TND, front-only —
     *  cf. modal de tarification). L'écart se calcule contre max(plancher, coût). */
    private static readonly FLOOR = 150;
    /** Seuil « durée anormale » (rouge) — FIXE 48 h pour cette version. */
    private static readonly ANOMALY_MS = 48 * 3600 * 1000;
    /** Nombre d'étapes visibles avant « Tout afficher ». */
    private static readonly TIMELINE_PREVIEW = 5;

    /** Cycle actuellement consulté : 0 = flux original ; N = après le N-ième retour. */
    selectedCycle = 0;
    /** Section « Écart entre statuts » dépliée (au-delà des 5 premières). */
    timelineExpanded = false;

    // ── Coûts (ledger Stat + taux Tarif + coût composants) — par cycle ─────────
    costLoading = false;
    private _costsKey: string | null = null;
    diagSeconds = 0;
    repSeconds = 0;
    tarif = 0;
    composantCost = 0;
    downloading = false;

    // ── Catalogue composants (jointure par NOM) ───────────────────────────────
    /** Catalogue chargé (cache applicatif). `null` tant qu'il n'est pas arrivé. */
    private catalog: ComposantCatalog | null = null;
    catalogLoading = false;
    /** Incrémenté à l'arrivée du catalogue — entre dans la clé de mémoïsation. */
    private catalogVersion = 0;
    /** Mémoïsation des lignes enrichies : la vue les lit dans un `*ngFor`, donc
     *  à CHAQUE cycle de détection. Recalculer produirait de nouveaux objets à
     *  chaque tick (churn + `trackBy` inopérant sous OnPush). */
    private _linesKey: string | null = null;
    private _lines: DiComposantLine[] = [];

    /** Onglet actif. `dossier` porte EXACTEMENT le contenu d'avant la refonte. */
    activeTab: DiInfoTab = 'dossier';
    /** Onglets déjà chargés — le chargement est PARESSEUX (1 onglet = 1 requête
     *  au plus), pour ne pas payer 6 allers-retours à chaque ouverture. */
    private readonly loaded = new Set<DiInfoTab>();


    // ── Temps & chrono (onglet 3) ────────────────────────────────────────────
    timeLoading = false;
    statDetail: any = null;
    cycleStats: any[] = [];

    // ── Événements ERP (plus d'onglet, mais toujours consommés) ──────────────
    // Alimentent `retourContext` (motif du bandeau « Retour N ») et `docTrace`
    // (« Déposé le / Par » de l'onglet Liens). Aucune autre source n'existe.
    private events: any[] = [];

    // ── Liens (onglet 5) ─────────────────────────────────────────────────────
    linksLoading = false;
    pvs: any[] = [];
    alerts: any[] = [];
    stagnations: any[] = [];
    auditTrail: any[] = [];

    // ── Édition ADMIN_TECH ───────────────────────────────────────────────────
    /** Rôle courant, lu une fois (même source que le reste de l'app). */
    private readonly role = (localStorage.getItem('role') || '').toUpperCase();
    editing = false;
    saving = false;
    form: any = {};
    /** Valeurs de DÉPART, normalisées comme le formulaire — c'est contre elles
     *  que le diff est calculé (et non contre `di`, dont `di_category_id` /
     *  `location_id` peuvent porter un libellé au lieu d'un id). */
    private editBaseline: any = {};
    categories: Array<{ _id: string; category: string }> = [];
    locations: Array<{ _id: string; location_name: string }> = [];
    /** Émis après une édition réussie, pour que l'hôte rafraîchisse sa liste. */
    @Output() updated = new EventEmitter<any>();

    constructor(
        private readonly diPdf: DiPdfService,
        private readonly apollo: Apollo,
        private readonly ticket: TicketService,
        private readonly cdr: ChangeDetectorRef,
        private readonly runner: MutationRunner,
        private readonly catalogSvc: ComposantCatalogService,
    ) {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['di']) {
            // Nouvelle DI → ouvrir sur le cycle COURANT (le plus récent), replier
            // la timeline, réinitialiser le sélecteur.
            this.selectedCycle = this.cycleCount;
            this.timelineExpanded = false;
            // Nouveau dossier → tout ce qui a été chargé pour le PRÉCÉDENT est
            // périmé. Sans ce reset, l'onglet Journal afficherait l'historique
            // de la DI d'avant.
            this.resetLifecycleCaches();
            // Nouvelle DI → les lignes enrichies du dossier précédent sont périmées.
            this._linesKey = null;
        }
        const id = this.di?._id;
        if (id && this.visible) {
            this.fetchCosts();
            void this.ensureCatalog();
            // Un onglet autre que « Dossier » peut rester actif d'une ouverture
            // à l'autre : on le recharge pour la nouvelle DI.
            this.ensureTabLoaded(this.activeTab);
            // Le cycle pré-sélectionné est le plus récent : si c'est un retour,
            // l'encart de contexte a besoin du journal et des PV.
            this.ensureRetourContext();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Onglets — chargement PARESSEUX
    // ─────────────────────────────────────────────────────────────────────────

    readonly tabs: ReadonlyArray<{ key: DiInfoTab; label: string; icon: string }> = [
        { key: 'dossier', label: 'Dossier', icon: 'pi pi-folder' },
        { key: 'temps', label: 'Temps & chrono', icon: 'pi pi-stopwatch' },
        { key: 'finances', label: 'Finances', icon: 'pi pi-wallet' },
        { key: 'liens', label: 'Liens', icon: 'pi pi-link' },
    ];

    selectTab(tab: DiInfoTab): void {
        if (this.activeTab === tab) return;
        // Quitter le dossier en cours d'édition abandonnerait des saisies sans
        // le dire : on garde l'utilisateur sur place tant qu'il n'a pas tranché.
        if (this.editing && tab !== 'dossier') return;
        this.activeTab = tab;
        this.ensureTabLoaded(tab);
    }

    /** Vide tout ce qui est propre à UNE DI (changement de dossier). */
    private resetLifecycleCaches(): void {
        this.loaded.clear();
        this.events = [];
        this.statDetail = null;
        this.cycleStats = [];
        this.pvs = [];
        this.alerts = [];
        this.stagnations = [];
        this.auditTrail = [];
        this.cancelEdit();
    }

    private ensureTabLoaded(tab: DiInfoTab): void {
        if (!this.di?._id || this.loaded.has(tab)) return;
        this.loaded.add(tab);
        if (tab === 'temps') void this.loadTimes();
        else if (tab === 'liens') void this.loadLinks();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Événements ERP (SystemEvent) — l'onglet Journal a été RETIRÉ, mais ces
    // événements alimentent encore le motif du bandeau « Retour N »
    // (`retourContext`) et les traces de dépôt de documents (`docTrace`), qui
    // n'ont aucune autre source.
    // ─────────────────────────────────────────────────────────────────────────

    private loadJournal(): Promise<void> {
        const diId = this.di?._id;
        if (!diId) return Promise.resolve();
        return new Promise<void>((resolve) => {
        this.apollo
            .query<any>({
                query: this.ticket.getDiEventJournal(diId),
                fetchPolicy: 'network-only',
            })
            .subscribe({
                next: ({ data }) => {
                    // Le dossier peut avoir changé pendant la requête.
                    if (this.di?._id !== diId) return resolve();
                    this.events = data?.notificationHistory ?? [];
                    this.cdr.markForCheck();
                    resolve();
                },
                error: () => {
                    if (this.di?._id !== diId) return resolve();
                    // Le journal ERP est un PLUS : s'il échoue, on affiche quand
                    // même les transitions de statut (toujours en mémoire).
                    this.events = [];
                    this.cdr.markForCheck();
                    resolve();
                },
            });
        });
    }

    /** À quel cycle de retour appartient un instant donné. */


    /** Payload JSON → texte lisible ; null si vide ou illisible. */

    // ─────────────────────────────────────────────────────────────────────────
    // Onglet Temps & chrono
    // ─────────────────────────────────────────────────────────────────────────

    private loadTimes(): Promise<void> {
        const diId = this.di?._id;
        if (!diId) return Promise.resolve();
        this.timeLoading = true;

        const detail = new Promise<void>((resolve) => {
            this.apollo
                .query<any>({
                    query: this.ticket.getStatDetailByDI_ID(
                        diId,
                        this.selectedCycle > 0 ? this.selectedCycle : undefined,
                    ),
                    fetchPolicy: 'network-only',
                })
                .subscribe({
                    next: ({ data }) => {
                        if (this.di?._id === diId) {
                            this.statDetail = data?.getInfoStatByIdDi ?? null;
                            this.timeLoading = false;
                            this.cdr.markForCheck();
                        }
                        resolve();
                    },
                    error: () => {
                        if (this.di?._id === diId) {
                            this.statDetail = null;
                            this.timeLoading = false;
                            this.cdr.markForCheck();
                        }
                        resolve();
                    },
                });
        });

        const perCycle = new Promise<void>((resolve) => {
            this.apollo
                .query<any>({
                    query: this.ticket.getRetourDataStats(diId),
                    fetchPolicy: 'network-only',
                })
                .subscribe({
                    next: ({ data }) => {
                        if (this.di?._id === diId) {
                            this.cycleStats = data?.getRetourDataStats ?? [];
                            this.cdr.markForCheck();
                        }
                        resolve();
                    },
                    error: () => {
                        if (this.di?._id === diId) {
                            this.cycleStats = [];
                            this.cdr.markForCheck();
                        }
                        resolve();
                    },
                });
        });

        return Promise.all([detail, perCycle]).then(() => undefined);
    }

    get diagSegments(): any[] {
        return this.statDetail?.diagSegments ?? [];
    }
    get repSegments(): any[] {
        return this.statDetail?.repSegments ?? [];
    }
    get pauseLogs(): any[] {
        return this.statDetail?.pauseLogs ?? [];
    }
    get statAssignments(): any[] {
        return this.statDetail?.diagAssignments ?? [];
    }
    get hasOpenLeg(): boolean {
        return !!(this.statDetail?.diagRunStartedAt || this.statDetail?.repRunStartedAt);
    }

    /** Durée d'un segment fermé — « — » tant qu'il n'est pas borné. */
    segmentDuration(seg: any): string {
        const a = new Date(seg?.startedAt).getTime();
        const b = new Date(seg?.stoppedAt).getTime();
        if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return '—';
        return formatDuration(b - a);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Onglet Liens
    // ─────────────────────────────────────────────────────────────────────────

    private loadLinks(): Promise<void> {
        const diId = this.di?._id;
        if (!diId) return Promise.resolve();
        this.linksLoading = true;
        const idNum = String(this.di?._idnum ?? '').trim();

        // Chaque source est indépendante : l'échec de l'une ne doit pas priver
        // l'utilisateur des autres — d'où une résolution NEUTRE par requête.
        const pull = (query: any, apply: (d: any) => void): Promise<void> =>
            new Promise<void>((resolve) => {
                this.apollo
                    .query<any>({ query, fetchPolicy: 'network-only' })
                    .subscribe({
                        next: ({ data }) => {
                            if (this.di?._id === diId) {
                                apply(data);
                                this.cdr.markForCheck();
                            }
                            resolve();
                        },
                        error: () => resolve(),
                    });
            });

        const jobs = [
            pull(this.ticket.getDiReunionPvs(diId), (d) => (this.pvs = d?.reunionPVs ?? [])),
            pull(this.ticket.getDiAlerts(diId), (d) => (this.alerts = d?.listDiAlerts ?? [])),
            pull(this.ticket.getDiAuditTrail(diId), (d) => (this.auditTrail = d?.getAuditByDi ?? [])),
        ];
        if (idNum) {
            jobs.push(
                pull(
                    this.ticket.getDiStagnationHistory(idNum),
                    (d) => (this.stagnations = d?.diStagnationHistory ?? []),
                ),
            );
        }

        return Promise.all(jobs).then(() => {
            if (this.di?._id === diId) {
                this.linksLoading = false;
                this.cdr.markForCheck();
            }
        });
    }

    get hasAnyLink(): boolean {
        return !!(
            this.pvs.length ||
            this.alerts.length ||
            this.stagnations.length ||
            this.auditTrail.length
        );
    }

    /**
     * Date + acteur d'upload d'un document, reconstitués depuis le journal ERP
     * (`DI_DOC_BC` / `DI_DOC_DEVIS` / `DI_DOC_BL`). La table `driveDocs` ne
     * retient ni l'un ni l'autre : c'est la seule source disponible. `null`
     * quand le journal ne porte rien pour ce type.
     */
    docTrace(type: string): { date: string | null; actor: string | null } | null {
        // Pas de `Facture` : le back n'émet volontairement PAS de
        // `DI_DOC_FACTURE` (il ferait doublon avec `DI_DOC_BL`). La ligne
        // Facture reste donc sans date ni auteur — c'est exact, pas un oubli.
        const code = {
            BC: 'DI_DOC_BC',
            Devis: 'DI_DOC_DEVIS',
            BL: 'DI_DOC_BL',
        }[type];
        if (!code) return null;
        const hit = this.events
            .filter((e) => e?.type === code)
            .sort(
                (a, b) =>
                    new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime(),
            )[0];
        if (!hit) return null;
        return {
            date: formatTimelineDate(hit.createdAt),
            actor: hit.actorName ? String(hit.actorName) : null,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cycles de retour
    // ─────────────────────────────────────────────────────────────────────────

    /** Nombre de retours (0 → pas de sélecteur du tout). */
    get cycleCount(): number {
        return Math.max(0, Number(this.di?.ignoreCount ?? 0)) || 0;
    }

    /** Pastilles du sélecteur — affichées dès qu'il y a au moins un retour.
     *  Index 0 = « Flux original », 1..N = « Retour N ».
     *  (Sans retour, un seul cycle : le sélecteur n'apporte rien.) */
    get cycles(): Array<{ n: number; label: string }> {
        if (this.cycleCount <= 0) return [];
        const out = [{ n: 0, label: 'Flux original' }];
        for (let n = 1; n <= this.cycleCount; n++) {
            out.push({ n, label: `Retour ${n}` });
        }
        return out;
    }

    /** Le cycle sélectionné est-il le cycle VIVANT (le plus récent) ? Seul lui
     *  porte le statut courant de la DI. */
    private get isActiveCycle(): boolean {
        return this.selectedCycle >= this.cycleCount;
    }

    selectCycle(n: number): void {
        if (n === this.selectedCycle) return;
        // Même garde que `selectTab` : changer de cycle en pleine édition
        // laisserait le formulaire (qui porte le flux original) sur un autre
        // cycle que celui affiché.
        if (this.editing) return;
        this.selectedCycle = n;
        this.timelineExpanded = false;
        // Les composants sont PAR CYCLE : la mémoïsation doit tomber avec lui.
        this._linesKey = null;
        this.fetchCosts();
        // Le journal de travail est PAR CYCLE (`getInfoStatByIdDi(_idLogs)`) :
        // changer de cycle sans le recharger afficherait les segments du cycle
        // précédent.
        if (this.loaded.has('temps')) void this.loadTimes();
        this.ensureRetourContext();
    }

    /**
     * Le motif d'un retour vit dans le journal ERP et, à défaut, dans les PV.
     * Ces deux onglets étant chargés paresseusement, l'encart « Retour N » du
     * DOSSIER resterait muet tant qu'on ne les a pas ouverts : on les précharge
     * dès qu'un cycle de retour est sélectionné.
     */
    private ensureRetourContext(): void {
        if (this.selectedCycle <= 0 || !this.di?._id) return;
        if (!this.loaded.has('journal')) {
            this.loaded.add('journal');
            void this.loadJournal();
        }
        if (!this.loaded.has('liens')) {
            this.loaded.add('liens');
            void this.loadLinks();
        }
    }

    /**
     * Dossier du cycle sélectionné — LA ligne `logs[idIgnore === n]`, cycle 0
     * compris. Aucune fusion avec la DI.
     *
     * L'ancienne version partait de `{...this.di}` et n'écrasait qu'avec les
     * valeurs « présentes » du log (`[]` et `''` comptaient comme absentes).
     * Résultat exact du bug signalé : un retour déclaré SANS PDR héritait de la
     * liste PDR du cycle 0, et chaque document non redéposé affichait le
     * fichier — et le NOM de fichier — du flux original. Un badge « hérité » ne
     * corrigeait rien : c'était une étiquette posée sur une donnée d'un AUTRE
     * cycle. Une valeur absente doit rester absente.
     */
    get cycleSnapshot(): any {
        const logs: any[] = Array.isArray(this.di?.logs) ? this.di.logs : [];
        return (
            logs.find((l) => Number(l?.idIgnore) === this.selectedCycle) ?? null
        );
    }

    /** Le dossier de ce cycle a-t-il été RECONSTITUÉ par la migration ? Une
     *  donnée déduite après coup ne doit jamais se faire passer pour une donnée
     *  observée — la bannière le dit explicitement. */
    get cycleIsReconstructed(): boolean {
        return this.cycleSnapshot?.reconstructed === true;
    }

    get cycleReconstructedReason(): string | null {
        return this.cycleSnapshot?.reconstructedReason ?? null;
    }

    /** Une valeur est-elle renseignée pour ce cycle ? Sert UNIQUEMENT à
     *  l'affichage (« non renseigné pour ce cycle »), jamais à choisir une
     *  source de repli. */
    private isPresent(v: any): boolean {
        if (v === null || v === undefined) return false;
        if (typeof v === 'string') return v.trim() !== '';
        if (Array.isArray(v)) return v.length > 0;
        return true;
    }

    /** Libellé affiché quand le cycle ne porte PAS la valeur. `null` si elle
     *  est renseignée (rien à signaler). */
    originLabel(key: string): string | null {
        return this.isPresent(this.cycleSnapshot?.[key])
            ? null
            : 'non renseigné pour ce cycle';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Écart entre statuts (timeline) — réutilise le calcul du modal Coordination
    // ─────────────────────────────────────────────────────────────────────────

    /** Toutes les étapes RÉELLEMENT atteintes dans le cycle sélectionné. */
    get timelineRows(): TimelineRow[] {
        const segments = sliceHistoryByCycle(this.di?.statusHistory);
        const slice = segments[this.selectedCycle] ?? [];
        const currentStatus = this.isActiveCycle ? this.di?.status ?? null : null;
        return buildCycleTimeline(
            slice,
            currentStatus,
            DiInfoModalComponent.ANOMALY_MS,
        );
    }

    /** Étapes affichées (5 par défaut, tout si déplié). */
    get visibleTimelineRows(): TimelineRow[] {
        const rows = this.timelineRows;
        return this.timelineExpanded
            ? rows
            : rows.slice(0, DiInfoModalComponent.TIMELINE_PREVIEW);
    }

    get timelineHiddenCount(): number {
        return Math.max(
            0,
            this.timelineRows.length - DiInfoModalComponent.TIMELINE_PREVIEW,
        );
    }

    toggleTimeline(): void {
        this.timelineExpanded = !this.timelineExpanded;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bande de faits + sections snapshot (par cycle)
    // ─────────────────────────────────────────────────────────────────────────

    /** Client / Société — jamais un ObjectId (displayName filtre). */
    get customerLabel(): string {
        return this.displayName(
            this.di?.company_name,
            this.di?.client_name,
            this.di?.companyName,
            this.di?.clientName,
            this.di?.company_id,
            this.di?.client_id,
        );
    }

    get locationLabel(): string {
        return this.displayName(
            this.di?.location_name,
            this.di?.locationName,
            this.di?.location_id,
        );
    }

    /** Composants du cycle sélectionné (DI ou snapshot de log). */
    get activeComposants(): Array<{ nameComposant?: string; quantity?: number }> {
        const src = this.cycleSnapshot;
        return Array.isArray(src?.array_composants) ? src.array_composants : [];
    }

    // ── Composants enrichis du catalogue ──────────────────────────────────────

    /**
     * Charge le catalogue (au plus une fois par session grâce au cache du
     * service). L'échec n'est PAS bloquant : la carte retombe sur nom + qté.
     */
    private ensureCatalog(): Promise<void> {
        if (this.catalog) return Promise.resolve();
        this.catalogLoading = true;
        return new Promise<void>((resolve) => {
            this.catalogSvc.load().subscribe({
                next: (cat) => {
                    this.catalog = cat;
                    this.catalogVersion++;
                    this._linesKey = null;
                    this.catalogLoading = false;
                    this.cdr.markForCheck();
                    resolve();
                },
                error: () => {
                    this.catalogLoading = false;
                    this.cdr.markForCheck();
                    resolve();
                },
            });
        });
    }

    /**
     * Lignes composants DU CYCLE SÉLECTIONNÉ, enrichies du catalogue.
     *
     * Fonction PURE de (activeComposants, catalogue) : elle vaut donc pour TOUS
     * les cycles, cycle 0 compris, sans jamais retomber sur la racine `di` —
     * même discipline que `cycleSnapshot`.
     */
    get composantLines(): DiComposantLine[] {
        const src = this.activeComposants;
        const key = `${this.di?._id ?? ''}#${this.selectedCycle}#${this.catalogVersion}#${src.length}`;
        if (this._linesKey !== key) {
            this._lines = enrichComposants(src, this.catalog?.byName);
            this._linesKey = key;
        }
        return this._lines;
    }

    /** Identité stable d'une ligne — deux lignes peuvent porter le MÊME nom. */
    trackComposantLine = (i: number, l: DiComposantLine): string =>
        `${i}#${l.name}`;

    statusComposantKey(l: DiComposantLine): ComposantStatusKey {
        return l.found ? composantStatusKey(l.statusRaw) : 'ORPHAN';
    }

    statusComposantLabel(l: DiComposantLine): string {
        if (!l.found) return 'Hors catalogue';
        return cleanComposantValue(l.statusRaw) || 'Statut non renseigné';
    }

    stockHealthOf(l: DiComposantLine): StockHealth {
        return stockHealth(l.stock);
    }

    stockLabelOf(l: DiComposantLine): string {
        return stockBadgeLabel(l.stock);
    }

    comingDateLabel(l: DiComposantLine): string {
        return formatComingDate(l.comingDate) || '—';
    }

    /** Fiche technique : même résolution que les documents de la DI — le champ
     *  porte tantôt un `webViewLink` Drive, tantôt un nom de fichier hérité. */
    composantPdfHref(l: DiComposantLine): string {
        return docHref(l.pdf);
    }

    /** Libellé de catégorie du COMPOSANT. Nom distinct de `categoryLabel`, qui
     *  désigne la catégorie de PANNE de la DI. Les lignes héritées stockent le
     *  LIBELLÉ au lieu de l'id `C_Composant<N>` → on rend la valeur brute quand
     *  elle ne résout pas. */
    composantCategoryLabel(l: DiComposantLine): string {
        const raw = l.categoryRaw;
        if (!raw) return '—';
        return this.catalog?.categoryById.get(raw) ?? raw;
    }

    /** Total du cycle AFFICHÉ = Σ(prix_vente × quantité) sur les lignes tarifées. */
    get composantLinesTotal(): number {
        return composantsGrandTotal(this.composantLines);
    }

    get composantLinesPriced(): number {
        return composantsPricedCount(this.composantLines);
    }

    /** Vrai si certaines lignes n'ont pas pu être tarifées (total partiel). */
    get composantLinesPartial(): boolean {
        const rows = this.composantLines;
        return rows.length > 0 && this.composantLinesPriced < rows.length;
    }

    /** « Flux original » / « Retour N » — libellé du cycle affiché. */
    get selectedCycleLabel(): string {
        return this.selectedCycle === 0
            ? 'Flux original'
            : `Retour ${this.selectedCycle}`;
    }

    /** Remarques du cycle sélectionné. */
    get activeRemarques(): { admin: string; diag: string; rep: string } {
        const s = this.cycleSnapshot ?? {};
        return {
            admin: s.remarque_manager || s.remarque_admin_manager || '',
            diag: s.remarque_tech_diagnostic || '',
            rep: s.remarque_tech_repair || '',
        };
    }

    get hasAnyRemarque(): boolean {
        const r = this.activeRemarques;
        return !!(r.admin || r.diag || r.rep);
    }

    get activeCanBeRepaired(): boolean | null {
        const v = this.cycleSnapshot?.can_be_repaired;
        return v === true || v === false ? v : null;
    }

    get activeContainPdr(): boolean {
        return !!this.cycleSnapshot?.contain_pdr;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Documents (vrais noms de fichier) — par cycle
    // ─────────────────────────────────────────────────────────────────────────

    private readonly DOC_TYPES: ReadonlyArray<{
        type: string;
        label: string;
        scalar: string;
    }> = [
        { type: 'BC', label: 'Bon de commande', scalar: 'bon_de_commande' },
        { type: 'Devis', label: 'Devis', scalar: 'devis' },
        { type: 'BL', label: 'Bon de livraison', scalar: 'bon_de_livraison' },
        { type: 'Facture', label: 'Facture', scalar: 'facture' },
    ];

    /**
     * Les 4 emplacements documents DU CYCLE sélectionné : présent (nom réel +
     * lien) ou absent (`href: null`, signalé à l'écran).
     *
     * UN SEUL chemin pour tous les cycles, cycle 0 compris : on lit les
     * `documents[]` de la ligne de cycle, dérivés de SON `driveDocs`. Avant,
     * le cycle 0 lisait `di.documents` et les cycles N retombaient sur les
     * scalaires de la DI dès que le log n'avait rien — avec en prime un
     * `nameFor()` qui allait chercher le NOM du fichier dans `di.documents`,
     * c'est-à-dire dans le flux original. D'où « le même fichier » affiché sur
     * deux cycles différents.
     */
    get docSlots(): Array<{
        type: string;
        label: string;
        href: string | null;
    }> {
        const src = this.cycleSnapshot;
        const docs: any[] = Array.isArray(src?.documents) ? src.documents : [];
        return this.DOC_TYPES.map((t) => {
            const ref = docs.find((d: any) => d?.type === t.type);
            const href =
                String(ref?.webViewLink || src?.[t.scalar] || '').trim() || null;
            const label = href
                ? String(ref?.name ?? '').trim() || t.label
                : t.label;
            return { type: t.type, label, href };
        });
    }


    // ─────────────────────────────────────────────────────────────────────────
    // Historique d'abandon (conditionnel)
    // ─────────────────────────────────────────────────────────────────────────

    get hasDiagHistory(): boolean {
        return (this.di?.diagAssignments ?? []).some((a: any) => !!a.abandonedAt);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Coûts / finances (par cycle) — écart CORRIGÉ (contre max(plancher, coût))
    // ─────────────────────────────────────────────────────────────────────────

    /** HH:MM:SS persisté → secondes. */
    private hhmmssToSeconds(s: any): number {
        if (typeof s !== 'string') return 0;
        const p = s.split(':').map(Number);
        if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return 0;
        return p[0] * 3600 + p[1] * 60 + p[2];
    }

    /** Charge temps diag/répa (Stat DU CYCLE), taux, coût composants (DI). */
    private fetchCosts(): void {
        const diId = this.di?._id;
        if (!diId) return;
        const key = `${diId}#${this.selectedCycle}`;
        this._costsKey = key;
        this.costLoading = true;
        this.diagSeconds = this.repSeconds = 0;
        this.tarif = this.composantCost = 0;

        this.apollo
            .query<any>({ query: this.ticket.getTechTarif() })
            .subscribe(({ data }) => {
                if (this._costsKey !== key) return;
                this.tarif = Number(data?.getTarif?.tarif) || 0;
                this.cdr.markForCheck();
            });
        // Stat DU CYCLE sélectionné (arg _idLog) ; cycle 0 → Stat de la DI.
        this.apollo
            .query<any>({
                query: this.ticket.getStatByDI_ID(
                    diId,
                    this.selectedCycle > 0 ? this.selectedCycle : undefined,
                ),
            })
            .subscribe(({ data }) => {
                if (this._costsKey !== key) return;
                const s = data?.getInfoStatByIdDi;
                this.diagSeconds = this.hhmmssToSeconds(s?.diag_time);
                this.repSeconds = this.hhmmssToSeconds(s?.rep_time);
                this.cdr.markForCheck();
            });
        this.apollo
            .query<any>({ query: this.ticket.totalComposant(diId) })
            .subscribe(({ data }) => {
                if (this._costsKey !== key) return;
                this.composantCost =
                    Number(data?.calculateTicketComposantPrice) || 0;
                this.costLoading = false;
                this.cdr.markForCheck();
            });
    }

    /** Temps passé (humanisé) — du cycle sélectionné. « — » si nul. */
    get tempsDiagLabel(): string {
        return this.diagSeconds > 0 ? formatDuration(this.diagSeconds * 1000) : '—';
    }
    get tempsRepLabel(): string {
        return this.repSeconds > 0 ? formatDuration(this.repSeconds * 1000) : '—';
    }
    get hasTemps(): boolean {
        return this.diagSeconds > 0 || this.repSeconds > 0;
    }

    /** Coût calculé DIAGNOSTIC = main-d'œuvre (temps diag × taux). */
    get coutDiag(): number {
        return Math.round(((this.diagSeconds * this.tarif) / 3600) * 1000) / 1000;
    }
    /** Coût calculé RÉPARATION = main-d'œuvre (temps répa × taux) + pièces. */
    get coutRepair(): number {
        const labor = (this.repSeconds * this.tarif) / 3600;
        return Math.round((labor + this.composantCost) * 1000) / 1000;
    }
    /** Prix facturé DIAGNOSTIC du cycle : `di.price` (cycle 0) ou `log.price`. */
    get factureDiag(): number {
        return Number(this.cycleSnapshot?.price);
    }

    /**
     * Écart = facturé − max(plancher, coût). Le plancher 150 TND est un comportement
     * de facturation LÉGITIME (pas une marge) : on ne le compte donc pas comme un
     * écart. On garde le coût BRUT visible ailleurs (colonne « Coût réel »).
     */
    private computeEcart(
        facture: number,
        cout: number,
    ): {
        absent: boolean;
        montant: number;
        percent: number;
        tone: 'pos' | 'neg' | 'neutral';
    } {
        if (!Number.isFinite(facture) || facture <= 0) {
            return { absent: true, montant: 0, percent: 0, tone: 'neutral' };
        }
        const basis = Math.max(DiInfoModalComponent.FLOOR, cout);
        const montant = Math.round((facture - basis) * 1000) / 1000;
        const percent = basis > 0 ? (montant / basis) * 100 : 0;
        const tone: 'pos' | 'neg' | 'neutral' =
            Math.abs(montant) < 0.5 && Math.abs(percent) < 1
                ? 'neutral'
                : montant > 0
                  ? 'pos'
                  : 'neg';
        return { absent: false, montant, percent, tone };
    }

    /** Diagnostic NON PAYANT (flag DI) : le « facturé » n'est pas 0 mais
     *  « Non facturé » (le coût réel reste un coût interne assumé, pas un écart). */
    get diagNonPayant(): boolean {
        return this.di?.diagnosticPayant === false;
    }

    /** Lignes du tableau Finances : Diagnostic, Réparation, Total. Réparation
     *  facturée = « — » (n'existe pas en base). Diagnostic non payant → « Non
     *  facturé » (jamais 0,000, jamais d'écart −150). Écart contre max(plancher,
     *  coût) sinon. */
    get financeRows(): Array<{
        phase: string;
        coutReel: number | null;
        facture: number | null;
        ecart: ReturnType<DiInfoModalComponent['computeEcart']> | null;
        isTotal?: boolean;
        nonPayant?: boolean;
    }> {
        const np = this.diagNonPayant;
        const facture = this.factureDiag;
        const factureCell = np || !Number.isFinite(facture) ? null : facture;
        const coutTotal =
            Math.round((this.coutDiag + this.coutRepair) * 1000) / 1000;
        return [
            {
                phase: 'Diagnostic',
                coutReel: this.coutDiag,
                facture: factureCell,
                ecart: np ? null : this.computeEcart(facture, this.coutDiag),
                nonPayant: np,
            },
            {
                phase: 'Réparation',
                coutReel: this.coutRepair,
                facture: null, // pas de prix réparation facturé en base
                ecart: null,
            },
            {
                phase: 'Total',
                coutReel: coutTotal,
                facture: factureCell,
                ecart: np ? null : this.computeEcart(facture, coutTotal),
                isTotal: true,
                nonPayant: np,
            },
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Présentation / helpers
    // ─────────────────────────────────────────────────────────────────────────

    statusTone(status: any): 'ok' | 'ko' | 'info' | 'warn' {
        const s = (status ?? '').toString().trim();
        if (s === 'FINISHED') return 'ok';
        if (s === 'IRREPARABLE') return 'ko';
        if (s === 'ANNULER') return 'ko';
        if (s === 'RETOUR1' || s === 'RETOUR2' || s === 'RETOUR3') return 'info';
        return 'warn';
    }

    /** Statut brut en MAJUSCULES (décision d'affichage en vigueur). */
    statusLabel(status: any): string {
        // Affichage BRUT en MAJUSCULES. PRICING_DIAG et son ancienne valeur
        // PRICING sont ramenés au MÊME libellé « PRICING » : les deux valeurs
        // coexistent en base (renommage forward-only, sans backfill) et la
        // colonne « Statut » afficherait sinon deux libellés pour un même état.
        const s = (status ?? '').toString().trim();
        if (s === 'PRICING_DIAG' || s === 'PRICING') return 'PRICING';
        return s.toUpperCase() || '—';
    }

    private isObjectId(value: any): boolean {
        return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim());
    }

    /** Sentinelles d'absence renvoyées par le back — à traiter comme du vide. */
    private static readonly SENTINELS = new Set(['n/a', 'na', '-', '—', 'unknown']);

    /** La valeur porte-t-elle une information affichable ? */
    hasValue(v: any): boolean {
        if (v === null || v === undefined) return false;
        const t = String(v).trim();
        if (!t) return false;
        if (DiInfoModalComponent.SENTINELS.has(t.toLowerCase())) return false;
        return !this.isObjectId(t);
    }

    displayName(...candidates: any[]): string {
        for (const c of candidates) {
            if (!this.hasValue(c)) continue;
            return String(c).trim();
        }
        return '—';
    }

    initials(text: any): string {
        const s = String(text ?? '').trim();
        if (!s) return '?';
        const words = s.split(/\s+/).filter(Boolean);
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }

    formatTnd3(value: any): string {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return (
            n.toLocaleString('fr-TN', {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
            }) + ' TND'
        );
    }

    /** Date FR courte — réutilise le formateur du util (cohérent avec la timeline). */
    fmtDate(at: any): string {
        return formatTimelineDate(at) ?? '—';
    }

    onVisibleChange(v: boolean) {
        this.visible = v;
        this.visibleChange.emit(v);
    }
    close() {
        this.onVisibleChange(false);
    }

    /** Export PDF (dossier A4 entièrement déplié). On passe au service les données
     *  DÉRIVÉES que le modal détient (timeline par cycle + coûts) : le PDF n'a pas
     *  accès aux requêtes Stat/Tarif/composant. */
    async exportPdf(): Promise<void> {
        if (!this.di || this.downloading) return;
        this.downloading = true;
        try {
            // Le PDF est le dossier COMPLET : on charge d'abord ce que
            // l'utilisateur n'a pas encore consulté, sinon l'export refléterait
            // les onglets visités plutôt que la vie réelle de la DI.
            await this.loadAllTabs();
            // Les prix/statuts des composants viennent du catalogue : sans cette
            // attente, un export déclenché juste après l'ouverture partirait avec
            // des colonnes vides.
            await this.ensureCatalog();
            await this.diPdf.generateAndDownload(this.di, {
                cycles: this.buildPdfCycles(),
                finance: this.financeRows,
                financeCycleLabel: this.selectedCycleLabel,
                composants: {
                    cycleLabel: this.selectedCycleLabel,
                    total: this.composantLinesTotal,
                    partial: this.composantLinesPartial,
                    priced: this.composantLinesPriced,
                    rows: this.composantLines.map((l) => ({
                        name: l.name,
                        quantity: l.quantity,
                        status: this.statusComposantLabel(l),
                        prixVente: l.prixVente,
                        lineTotal: l.lineTotal,
                        comingDate: this.comingDateLabel(l),
                    })),
                },
                times: {
                    diagLabel: this.tempsDiagLabel,
                    repLabel: this.tempsRepLabel,
                    diagSegments: this.diagSegments,
                    repSegments: this.repSegments,
                    pauseLogs: this.pauseLogs,
                    cycleStats: this.cycleStats,
                    segmentDuration: (seg: any) => this.segmentDuration(seg),
                },
                links: {
                    pvs: this.pvs,
                    alerts: this.alerts,
                    stagnations: this.stagnations,
                },
            });
        } finally {
            this.downloading = false;
        }
    }

    /** Charge les onglets non encore visités (idempotent). */
    private async loadAllTabs(): Promise<void> {
        const jobs: Array<Promise<void>> = [];
        for (const tab of ['temps', 'liens'] as DiInfoTab[]) {
            if (this.loaded.has(tab)) continue;
            this.loaded.add(tab);
            jobs.push(tab === 'temps' ? this.loadTimes() : this.loadLinks());
        }
        // L'onglet Journal a été retiré, mais ses ÉVÉNEMENTS restent nécessaires :
        // `docTrace()` (« Déposé le / Par » de l'onglet Liens) et le motif du
        // bandeau « Retour N » n'ont aucune autre source. On les charge donc en
        // silence, sans onglet ni section PDF.
        if (!this.loaded.has('journal')) {
            this.loaded.add('journal');
            jobs.push(this.loadJournal());
        }
        await Promise.all(jobs);
    }


    /** Construit, pour le PDF, la timeline de CHAQUE cycle (tout déplié). Les coûts
     *  chargés (Stat/Tarif) ne concernent que le cycle courant ; le PDF affiche donc
     *  le détail des coûts pour le cycle affiché et le parcours pour tous. */
    private buildPdfCycles(): Array<{
        n: number;
        label: string;
        timeline: TimelineRow[];
    }> {
        const segments = sliceHistoryByCycle(this.di?.statusHistory);
        const count = this.cycleCount;
        const out: Array<{ n: number; label: string; timeline: TimelineRow[] }> =
            [];
        for (let n = 0; n <= count; n++) {
            const slice = segments[n] ?? [];
            if (n > 0 && !slice.length) continue; // cycle sans parcours → masqué
            const isActive = n >= count;
            out.push({
                n,
                label: n === 0 ? 'Flux original' : `Retour ${n}`,
                timeline: buildCycleTimeline(
                    slice,
                    isActive ? this.di?.status ?? null : null,
                    DiInfoModalComponent.ANOMALY_MS,
                ),
            });
        }
        return out;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Compléments de l'onglet Dossier
    // ─────────────────────────────────────────────────────────────────────────

    /** Catégorie de panne — le mapper coordination renvoie déjà un libellé,
     *  `getAllDi` un id + `di_category_name`. On prend le premier lisible. */
    get categoryLabel(): string {
        return this.displayName(this.di?.di_category_name, this.di?.di_category_id);
    }

    /** Contacts du tiers — peuplés uniquement par `getDiDetail`. */
    get contact(): any {
        return this.di?.contact ?? null;
    }
    get hasContact(): boolean {
        const c = this.contact;
        return !!(c && (c.email || c.phone || c.address || c.region || c.fax || c.mf));
    }

    /** Ancienneté dans le statut courant (moteur de stagnation). */
    get statusAge(): string {
        const at = this.di?.statusUpdatedAt;
        if (!at) return '—';
        const t = new Date(at).getTime();
        if (Number.isNaN(t)) return '—';
        return formatDuration(Date.now() - t);
    }

    /**
     * Contexte du retour pour le cycle affiché.
     *
     * `di.retourReason` / `di.retourDate` sont ÉCRASÉS à chaque retour
     * (`changeDiRetour1/2/3` écrivent les deux mêmes champs) : ils ne valent
     * donc que pour le DERNIER cycle. Le motif de chaque retour vit en revanche
     * dans le journal ERP — `SystemEvent DI_RETOUR_{n}`, `payload.reason` —
     * qui est append-only, et dans `ReunionPV.contexteRetour` quand un PV a été
     * rédigé. On interroge ces sources dans cet ordre.
     */
    get retourContext(): {
        level: number;
        date: string | null;
        motif: string | null;
        source: string;
    } | null {
        const n = this.selectedCycle;
        if (n <= 0) return null;

        // Date : l'entrée `RETOUR{n}` de l'historique est la seule datation
        // fiable par cycle ; `di.retourDate` ne vaut que pour le dernier.
        const hist = sanitizeHistory(this.di?.statusHistory);
        const entry = hist.find((h) => h.status === `RETOUR${n}`);
        const isLast = n >= this.cycleCount;
        const at = entry?.at ?? (isLast && this.di?.retourDate ? new Date(this.di.retourDate) : null);

        // Motif : journal ERP du niveau n → PV du même niveau → champ DI (dernier).
        let motif: string | null = null;
        let source = '';
        const ev = this.events.find((e) => e?.type === `DI_RETOUR_${n}`);
        if (ev) {
            try {
                const payload = ev.payloadJson ? JSON.parse(ev.payloadJson) : null;
                const r = String(payload?.reason ?? '').trim();
                if (r) {
                    motif = r;
                    source = 'journal';
                }
            } catch {
                /* payload illisible → on tente les autres sources */
            }
        }
        if (!motif) {
            const pv = this.pvs.find(
                (p) => Number(p?.contexteRetour?.niveau) === n,
            );
            const r = String(pv?.contexteRetour?.motif ?? '').trim();
            if (r) {
                motif = r;
                source = 'PV de réunion';
            }
        }
        if (!motif && isLast && this.hasValue(this.di?.retourReason)) {
            motif = String(this.di.retourReason).trim();
            source = 'dossier';
        }

        if (!at && !motif) return null;
        return {
            level: n,
            date: at ? formatTimelineDate(at) : null,
            motif,
            source,
        };
    }

    /** Bandeau Retour du flux original — pendant du bandeau Annulation. */
    get hasRetourInfo(): boolean {
        return (
            this.selectedCycle <= 0 &&
            !!(this.hasValue(this.di?.retourReason) || this.di?.retourDate)
        );
    }

    /**
     * Les remarques que le bloc historique n'affiche PAS.
     *
     * Le bloc existant montre 3 entrées : « administration » (`remarque_manager`
     * OU `remarque_admin_manager`), tech diagnostic et tech réparation. Quatre
     * des sept remarques persistées ne sortaient donc jamais — dont
     * `remarque_admin_manager` dès que `remarque_manager` est renseignée, qui
     * la masque. On les ajoute SANS toucher au bloc d'origine.
     */
    get extraRemarques(): Array<{ label: string; value: string }> {
        const s2 = this.cycleSnapshot ?? {};
        const shownAdmin = this.activeRemarques.admin;
        const rows = [
            { label: 'Remarque admin manager', value: s2.remarque_admin_manager },
            { label: 'Remarque admin technique', value: s2.remarque_admin_tech },
            { label: 'Remarque magasin', value: s2.remarque_magasin },
            { label: 'Remarque coordination', value: s2.remarque_coordinator },
        ];
        return rows
            .filter((r) => {
                const v = String(r.value ?? '').trim();
                return !!v && v !== shownAdmin;
            })
            .map((r) => ({ label: r.label, value: String(r.value) }));
    }

    get hasExtraRemarques(): boolean {
        return this.extraRemarques.length > 0;
    }

    /** Commentaire libre du cycle — champ persisté jamais affiché jusqu'ici. */
    get activeComment(): string {
        return String(this.cycleSnapshot?.comment ?? '').trim();
    }

    /** Drapeaux et jalons — uniquement ceux qui portent une information. */
    get flags(): Array<{ label: string; value: string; tone: string }> {
        const out: Array<{ label: string; value: string; tone: string }> = [];
        const s2 = this.cycleSnapshot ?? {};
        if (s2.isErrorFromFixtronix === true) {
            out.push({ label: 'Erreur Fixtronix', value: 'Oui', tone: 'ko' });
        }
        if (this.di?.needsDevisBeforeRepair === true) {
            out.push({ label: 'Devis requis avant réparation', value: 'Oui', tone: 'warn' });
        }
        if (this.di?.diagnosticPayant === false) {
            out.push({ label: 'Diagnostic', value: 'Non payant', tone: 'muted' });
        }
        if (s2.confirmationComposant) {
            out.push({
                label: 'Confirmation composants',
                value: String(s2.confirmationComposant),
                tone: 'info',
            });
        }
        const h = this.di?.handleSendingNotificationBetweenCoordinatorAndMagasin;
        if (h && h !== 'DEFAULT') {
            out.push({ label: 'Dossier détenu par', value: String(h), tone: 'info' });
        }
        if (this.di?.isSentToCoordinator === true) {
            out.push({ label: 'Liste envoyée à la coordination', value: 'Oui', tone: 'info' });
        }
        if (this.di?.isConfirmedComponentFromCoordinator === true) {
            out.push({ label: 'Composants confirmés', value: 'Oui', tone: 'ok' });
        }
        return out;
    }

    /** Jalons datés avec leur acteur (déjà résolus en noms côté serveur). */
    get milestones(): Array<{ label: string; date: string; actor: string }> {
        const out: Array<{ label: string; date: string; actor: string }> = [];
        if (this.di?.pricingRequestSentAt) {
            out.push({
                label: 'Demande de tarification',
                date: this.fmtDate(this.di.pricingRequestSentAt),
                actor: this.displayName(this.di.pricingRequestSentBy),
            });
        }
        if (this.di?.componentsConfirmedAt) {
            out.push({
                label: 'Composants confirmés',
                date: this.fmtDate(this.di.componentsConfirmedAt),
                actor: this.displayName(this.di.componentsConfirmedBy),
            });
        }
        return out;
    }

    /**
     * Photo du problème. Le fichier Drive est PRIVÉ : on passe par le proxy
     * back (`GET /di/:id/image`), exactement comme le modal Diagnostic
     * (`tech-di-list.resolveDiImage`). `viewUrl` sert de repli « ouvrir dans
     * Drive » quand le proxy ne peut pas servir (lignes legacy sans fileId).
     */
    get imageProxyUrl(): string {
        const raw = String(this.di?.image ?? '').trim();
        const id = this.di?._id ?? '';
        if (!raw || raw === '-' || !id) return '';
        const base = (environment.apiUrl ?? '').replace(/\/$/, '');
        return `${base}/di/${id}/image`;
    }
    get imageViewUrl(): string {
        const v = String(this.di?.image ?? '').trim();
        return /^https?:\/\//i.test(v) ? v : '';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Édition — RÉSERVÉE au rôle ADMIN_TECH (le serveur re-vérifie)
    // ─────────────────────────────────────────────────────────────────────────

    /** Le bouton n'est qu'un confort : la mutation est gardée côté serveur. */
    get canEdit(): boolean {
        return this.role === 'ADMIN_TECH' && !!this.di?._id;
    }

    /** Champs soumis à l'édition — même liste que l'input GraphQL. */
    private static readonly EDITABLE: string[] = [
        'title', 'description', 'nSerie', 'comment', 'dateReception',
        'di_category_id', 'location_id',
        'can_be_repaired', 'contain_pdr', 'isErrorFromFixtronix',
        'needsDevisBeforeRepair', 'retourReason',
        'remarque_manager', 'remarque_admin_manager', 'remarque_admin_tech',
        'remarque_tech_diagnostic', 'remarque_tech_repair', 'remarque_magasin',
        'remarque_coordinator',
        'price', 'final_price', 'repairEstimate', 'diagnosticEstimate',
        'diagnosticPayant', 'discount', 'discount_value', 'type_client',
        'service_quality',
    ];

    startEdit(): void {
        if (!this.canEdit) return;
        // `adminTechUpdateDi` écrit sur la DI, JAMAIS dans `logsdis`. Éditer
        // depuis un cycle de retour affichait donc des valeurs du cycle, et
        // l'enregistrement partait silencieusement dans le flux original.
        // On bascule explicitement sur le flux original (le bandeau le dit).
        this.selectedCycle = 0;
        this.activeTab = 'dossier';
        this.form = {};
        for (const k of DiInfoModalComponent.EDITABLE) {
            this.form[k] = (this.di as any)?.[k] ?? null;
        }
        // `<input type="date">` attend « yyyy-MM-dd ».
        this.form.dateReception = this.toDateInput(this.di?.dateReception);
        // Copie PROFONDE : éditer la liste ne doit pas muter l'objet affiché
        // tant que l'enregistrement n'a pas réussi.
        this.form.array_composants = (this.di?.array_composants ?? []).map(
            (c: any) => ({
                nameComposant: c?.nameComposant ?? '',
                quantity: Number(c?.quantity ?? 0),
            }),
        );
        this.editBaseline = { ...this.form };
        this.editing = true;
        this.loadEditOptions();
    }

    cancelEdit(): void {
        this.editing = false;
        this.saving = false;
        this.form = {};
        this.editBaseline = {};
    }

    addComposantRow(): void {
        (this.form.array_composants ??= []).push({ nameComposant: '', quantity: 1 });
    }
    removeComposantRow(i: number): void {
        (this.form.array_composants ?? []).splice(i, 1);
    }

    /** Listes de référence pour les deux sélecteurs — chargées une seule fois. */
    private loadEditOptions(): void {
        if (!this.categories.length) {
            this.apollo
                .query<any>({ query: this.ticket.getAllDiCategory() })
                .subscribe({
                    next: ({ data }) => {
                        this.categories = data?.findAllDiCategory ?? [];
                        this.normalizeRefSelections();
                        this.cdr.markForCheck();
                    },
                    error: () => undefined,
                });
        } else {
            this.normalizeRefSelections();
        }
        if (!this.locations.length) {
            this.apollo
                .query<any>({ query: this.ticket.getAllLocation() })
                .subscribe({
                    next: ({ data }) => {
                        this.locations = data?.findAllLocation ?? [];
                        this.normalizeRefSelections();
                        this.cdr.markForCheck();
                    },
                    error: () => undefined,
                });
        }
    }

    /**
     * Aligne les deux sélecteurs de référence sur des IDs.
     *
     * Nécessaire parce que les projections divergent : la vue coordination met
     * le LIBELLÉ dans `di_category_id`/`location_id`, `getAllDi` l'ID. Sans
     * cette normalisation le `<select>` n'aurait rien de présélectionné, et
     * l'enregistrement croirait la valeur modifiée à chaque fois.
     */
    private normalizeRefSelections(): void {
        if (!this.editing) return;
        if (this.categories.length) {
            this.form.di_category_id = this.optionValue(
                this.form.di_category_id,
                this.categories,
                '_id',
                'category',
            );
            this.editBaseline.di_category_id = this.optionValue(
                (this.di as any)?.di_category_id,
                this.categories,
                '_id',
                'category',
            );
        }
        if (this.locations.length) {
            this.form.location_id = this.optionValue(
                this.form.location_id,
                this.locations,
                '_id',
                'location_name',
            );
            this.editBaseline.location_id = this.optionValue(
                (this.di as any)?.location_id,
                this.locations,
                '_id',
                'location_name',
            );
        }
    }

    /**
     * Valeur à présélectionner dans un `<select>`. Les projections divergent :
     * la vue coordination met le LIBELLÉ dans `di_category_id`/`location_id`,
     * `getAllDi` y met l'ID. On accepte donc les deux et on retombe sur l'id.
     */
    optionValue(
        raw: any,
        options: any[],
        idKey: string,
        labelKey: string,
    ): string | null {
        const v = String(raw ?? '').trim();
        if (!v) return null;
        const byId = options.find((o) => String(o?.[idKey]) === v);
        if (byId) return String(byId[idKey]);
        const byLabel = options.find((o) => String(o?.[labelKey]) === v);
        return byLabel ? String(byLabel[idKey]) : null;
    }

    private toDateInput(v: any): string | null {
        if (!v) return null;
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return null;
        // Composantes LOCALES : `toISOString()` convertit en UTC et affichait
        // la veille pour une date à minuit en Africa/Tunis (UTC+1).
        const p2 = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    }

    private normalizeNumber(v: any): number | null {
        if (v === '' || v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }

    /**
     * Enregistre UNIQUEMENT ce qui a changé (l'input GraphQL ignore les clés
     * absentes, donc un champ non touché n'est jamais écrasé), puis recharge le
     * dossier pour que TOUTES les vues dérivées repartent des données à jour.
     */
    async saveEdit(): Promise<void> {
        if (!this.canEdit || this.saving) return;
        const _id = this.di._id;
        const input: any = { _id };

        const numeric = new Set([
            'price', 'final_price', 'repairEstimate', 'diagnosticEstimate',
            'discount', 'discount_value',
        ]);
        for (const k of DiInfoModalComponent.EDITABLE) {
            let next: any = this.form[k];
            if (k === 'dateReception') {
                next = next ? new Date(`${next}T00:00:00`).toISOString() : null;
            } else if (numeric.has(k)) {
                next = this.normalizeNumber(next);
            } else if (typeof next === 'string') {
                next = next.trim();
            }
            const prevRaw = this.editBaseline[k] ?? null;
            const prev =
                k === 'dateReception'
                    ? prevRaw
                        ? new Date(`${prevRaw}T00:00:00`).toISOString()
                        : null
                    : numeric.has(k)
                      ? this.normalizeNumber(prevRaw)
                      : typeof prevRaw === 'string'
                        ? prevRaw.trim()
                        : prevRaw ?? null;
            if (JSON.stringify(prev ?? null) !== JSON.stringify(next ?? null)) {
                input[k] = next;
            }
        }

        // Liste de composants : nettoyée (lignes vides ignorées) puis comparée.
        const comps = (this.form.array_composants ?? [])
            .map((c: any) => ({
                nameComposant: String(c?.nameComposant ?? '').trim(),
                quantity: Number(c?.quantity ?? 0),
            }))
            .filter((c: any) => c.nameComposant);
        const prevComps = (this.di?.array_composants ?? []).map((c: any) => ({
            nameComposant: String(c?.nameComposant ?? '').trim(),
            quantity: Number(c?.quantity ?? 0),
        }));
        if (JSON.stringify(prevComps) !== JSON.stringify(comps)) {
            input.array_composants = comps;
        }

        if (Object.keys(input).length === 1) {
            this.editing = false;
            return;
        }

        this.saving = true;
        try {
            await this.runner.run({
                key: `adminTechUpdateDi:${_id}`,
                mutation: this.ticket.adminTechUpdateDi(),
                variables: { input },
                successToast: {
                    summary: 'Dossier mis à jour',
                    detail: 'La modification est tracée dans le journal.',
                },
            });
            this.editing = false;
            await this.reloadDi();
            this.updated.emit(this.di);
            // La modification vient d'ajouter une ligne `DI_EDITED` au journal.
            if (this.loaded.has('journal')) void this.loadJournal();
        } catch {
            // `MutationRunner` a déjà notifié — on reste en édition pour que
            // l'utilisateur ne perde pas sa saisie.
        } finally {
            this.saving = false;
            this.cdr.markForCheck();
        }
    }

    /** Relit la DI dans la projection complète du dossier. */
    private reloadDi(): Promise<void> {
        const _id = this.di?._id;
        if (!_id) return Promise.resolve();
        return new Promise((resolve) => {
            this.apollo
                .query<any>({
                    query: this.ticket.getDiDetail(_id),
                    fetchPolicy: 'network-only',
                })
                .subscribe({
                    next: ({ data }) => {
                        if (data?.getDiDetail) this.di = data.getDiDetail;
                        // `di` remplacé → les lignes enrichies sont périmées.
                        this._linesKey = null;
                        this.cdr.markForCheck();
                        resolve();
                    },
                    error: () => resolve(),
                });
        });
    }

    /** Montant, ou « — » si la donnée est ABSENTE. `formatTnd3` ne distingue
     *  pas `null` de `0` (Number(null) === 0) et afficherait « 0,000 TND »
     *  pour un prix jamais saisi — ce qui serait un contresens comptable. */
    fmtMoney(v: any): string {
        if (v === null || v === undefined || v === '') return '—';
        return this.formatTnd3(v);
    }

    get hasCommercial(): boolean {
        return (
            this.di?.discount != null ||
            this.di?.discount_value != null ||
            !!this.di?.type_client ||
            !!this.di?.service_quality
        );
    }

    get hasAnyTimeDetail(): boolean {
        return !!(
            this.diagSegments.length ||
            this.repSegments.length ||
            this.pauseLogs.length ||
            this.statAssignments.length ||
            this.cycleStats.length ||
            this.hasTemps
        );
    }

}
