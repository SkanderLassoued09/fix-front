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
import {
    buildCycleTimeline,
    buildRawTimeline,
    sliceHistoryByCycle,
    formatTimelineDate,
    formatDuration,
    TimelineRow,
} from '../status-timeline.util';

/** Onglets du dossier. `dossier` = la vue historique, inchangée. */
export type DiInfoTab = 'dossier' | 'journal' | 'temps' | 'finances' | 'liens';

/** Une ligne du journal fusionné (événement ERP OU transition de statut). */
export interface JournalRow {
    kind: 'event' | 'status';
    at: Date;
    date: string | null;
    /** Code d'événement (`DI_DOC_BC`…) ou statut brut (`PENDING2`…). */
    code: string;
    label: string;
    actor: string | null;
    actorRole: string | null;
    cycle: number | null;
    /** Payload JSON déplié à la demande (événements uniquement). */
    details: string | null;
}

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
    @Input() context: 'coordinator' | 'interventions' = 'interventions';
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

    /** Onglet actif. `dossier` porte EXACTEMENT le contenu d'avant la refonte. */
    activeTab: DiInfoTab = 'dossier';
    /** Onglets déjà chargés — le chargement est PARESSEUX (1 onglet = 1 requête
     *  au plus), pour ne pas payer 6 allers-retours à chaque ouverture. */
    private readonly loaded = new Set<DiInfoTab>();

    // ── Journal (onglet 2) ───────────────────────────────────────────────────
    journalLoading = false;
    /** Événements ERP bruts (`SystemEvent`) — porteurs de l'ACTEUR. */
    private events: any[] = [];
    /** Filtre par code d'événement/statut ; '' = tout. */
    journalFilter = '';
    /** Index des lignes dont le payload est déplié. */
    readonly journalOpen = new Set<number>();

    // ── Temps & chrono (onglet 3) ────────────────────────────────────────────
    timeLoading = false;
    statDetail: any = null;
    cycleStats: any[] = [];

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
        }
        const id = this.di?._id;
        if (id && this.visible) {
            this.fetchCosts();
            // Un onglet autre que « Dossier » peut rester actif d'une ouverture
            // à l'autre : on le recharge pour la nouvelle DI.
            this.ensureTabLoaded(this.activeTab);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Onglets — chargement PARESSEUX
    // ─────────────────────────────────────────────────────────────────────────

    readonly tabs: ReadonlyArray<{ key: DiInfoTab; label: string; icon: string }> = [
        { key: 'dossier', label: 'Dossier', icon: 'pi pi-folder' },
        { key: 'journal', label: 'Journal', icon: 'pi pi-history' },
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
        this.journalFilter = '';
        this.journalOpen.clear();
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
        // Le résultat n'intéresse que l'export PDF (qui, lui, l'attend).
        if (tab === 'journal') void this.loadJournal();
        else if (tab === 'temps') void this.loadTimes();
        else if (tab === 'liens') void this.loadLinks();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Onglet Journal — SystemEvent (avec acteur) ∪ statusHistory (exhaustif)
    // ─────────────────────────────────────────────────────────────────────────

    private loadJournal(): Promise<void> {
        const diId = this.di?._id;
        if (!diId) return Promise.resolve();
        this.journalLoading = true;
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
                    this.journalLoading = false;
                    this.cdr.markForCheck();
                    resolve();
                },
                error: () => {
                    if (this.di?._id !== diId) return resolve();
                    // Le journal ERP est un PLUS : s'il échoue, on affiche quand
                    // même les transitions de statut (toujours en mémoire).
                    this.events = [];
                    this.journalLoading = false;
                    this.cdr.markForCheck();
                    resolve();
                },
            });
        });
    }

    /** À quel cycle de retour appartient un instant donné. */
    private cycleAt(at: Date): number {
        const rows = buildRawTimeline(
            this.di?.statusHistory,
            DiInfoModalComponent.ANOMALY_MS,
        );
        let cycle = 0;
        for (const r of rows) {
            if (r.at.getTime() <= at.getTime()) cycle = r.cycle;
            else break;
        }
        return cycle;
    }

    /**
     * Journal FUSIONNÉ, du plus récent au plus ancien.
     *
     * Les deux sources sont complémentaires et aucune ne suffit seule :
     * `statusHistory` contient TOUTES les transitions mais sans auteur (le hook
     * Mongoose n'a pas de contexte de requête) ; `SystemEvent` porte l'acteur et
     * les actions non-transitionnelles (uploads, confirmations, abandons) mais
     * n'est pas émis à chaque changement de statut.
     */
    get journalRows(): JournalRow[] {
        const rows: JournalRow[] = [];

        for (const r of buildRawTimeline(
            this.di?.statusHistory,
            DiInfoModalComponent.ANOMALY_MS,
        )) {
            rows.push({
                kind: 'status',
                at: r.at,
                date: r.date,
                code: r.rawStatus,
                label: r.label,
                actor: null,
                actorRole: null,
                cycle: r.cycle,
                details: r.duration
                    ? `Durée jusqu'à l'étape suivante : ${r.duration.text}${
                          r.duration.ongoing ? ' (en cours)' : ''
                      }`
                    : null,
            });
        }

        for (const e of this.events) {
            const at = new Date(e?.createdAt);
            if (Number.isNaN(at.getTime())) continue;
            rows.push({
                kind: 'event',
                at,
                date: formatTimelineDate(at),
                code: String(e?.type ?? ''),
                label: String(e?.message ?? e?.type ?? ''),
                actor: e?.actorId ? String(e.actorId) : null,
                actorRole: e?.actorRole ? String(e.actorRole) : null,
                cycle: this.cycleAt(at),
                details: this.prettyPayload(e?.payloadJson),
            });
        }

        rows.sort((a, b) => b.at.getTime() - a.at.getTime());
        const f = this.journalFilter;
        return f ? rows.filter((r) => r.code === f) : rows;
    }

    /** Codes présents, pour alimenter le filtre (jamais une liste en dur). */
    get journalCodes(): string[] {
        const set = new Set<string>();
        for (const r of this.journalRows) set.add(r.code);
        // `journalRows` est déjà filtré : on repart des sources pour garder la
        // liste complète même quand un filtre est actif.
        for (const e of this.events) if (e?.type) set.add(String(e.type));
        return [...set].sort();
    }

    setJournalFilter(code: string): void {
        this.journalFilter = code;
        this.journalOpen.clear();
    }

    toggleJournalRow(i: number): void {
        this.journalOpen.has(i)
            ? this.journalOpen.delete(i)
            : this.journalOpen.add(i);
    }

    /** Payload JSON → texte lisible ; null si vide ou illisible. */
    private prettyPayload(payloadJson: any): string | null {
        if (!payloadJson) return null;
        try {
            const obj = JSON.parse(String(payloadJson));
            if (!obj || typeof obj !== 'object') return null;
            const keys = Object.keys(obj);
            if (!keys.length) return null;
            return JSON.stringify(obj, null, 2);
        } catch {
            return null;
        }
    }

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
            actor: hit.actorId ? String(hit.actorId) : null,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cycles de retour
    // ─────────────────────────────────────────────────────────────────────────

    /** Nombre de retours (0 → pas de sélecteur du tout). */
    get cycleCount(): number {
        return Math.max(0, Number(this.di?.ignoreCount ?? 0)) || 0;
    }

    /** Pastilles du sélecteur — UNIQUEMENT si la DI a au moins un retour.
     *  Index 0 = « Flow original », 1..N = « Retour N ». */
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
        this.selectedCycle = n;
        this.timelineExpanded = false;
        this.fetchCosts();
        // Le journal de travail est PAR CYCLE (`getInfoStatByIdDi(_idLogs)`) :
        // changer de cycle sans le recharger afficherait les segments du cycle
        // précédent.
        if (this.loaded.has('temps')) void this.loadTimes();
    }

    /** Snapshot du cycle sélectionné : la DI (cycle 0) ou la ligne `di.logs`
     *  correspondante (cycle N). `null` si le cycle N n'a pas de ligne de log
     *  (retour capturé sans re-diagnostic → sections snapshot masquées). */
    get cycleSnapshot(): any {
        if (this.selectedCycle <= 0) return this.di;
        const logs: any[] = Array.isArray(this.di?.logs) ? this.di.logs : [];
        return logs.find((l) => Number(l?.idIgnore) === this.selectedCycle) ?? null;
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
            this.di?.clientName,
            this.di?.companyName,
            this.di?.client_name,
            this.di?.company_name,
            this.di?.client_id,
            this.di?.company_id,
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

    /** Récupère le vrai nom de fichier depuis `di.documents` (DriveDocRef.name),
     *  par lien puis par type ; sinon le libellé générique. */
    private nameFor(href: string, type: string, fallback: string): string {
        for (const d of this.di?.documents ?? []) {
            const name = String(d?.name ?? '').trim();
            if (!name) continue;
            if (String(d?.webViewLink ?? '').trim() === href) return name;
        }
        for (const d of this.di?.documents ?? []) {
            if (d?.type === type) {
                const name = String(d?.name ?? '').trim();
                if (name) return name;
            }
        }
        return fallback;
    }

    /** Les 4 emplacements documents du cycle sélectionné : présent (nom réel +
     *  lien) OU absent (`href: null`, signalé). Cycle 0 : `di.documents`
     *  (DriveDocRef.name) + repli scalaire. Cycle N : URLs scalaires du snapshot,
     *  nom récupéré best-effort depuis `di.documents`. */
    get docSlots(): Array<{
        type: string;
        label: string;
        href: string | null;
    }> {
        const src = this.cycleSnapshot ?? {};
        return this.DOC_TYPES.map((t) => {
            let href: string | null = null;
            let label = t.label;
            if (this.selectedCycle <= 0) {
                const ref = (this.di?.documents ?? []).find(
                    (d: any) => d?.type === t.type,
                );
                const h = String(
                    ref?.webViewLink || this.di?.[t.scalar] || '',
                ).trim();
                href = h || null;
                if (h) label = String(ref?.name ?? '').trim() || t.label;
            } else {
                const h = String(src?.[t.scalar] ?? '').trim();
                href = h || null;
                if (h) label = this.nameFor(h, t.type, t.label);
            }
            return { type: t.type, label, href };
        });
    }

    get hasAnyDoc(): boolean {
        return this.docSlots.some((d) => !!d.href);
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
        // Affichage BRUT en MAJUSCULES, SAUF PRICING_DIAG (+ ancienne valeur
        // PRICING) affiché « Pricing » (demande produit).
        const s = (status ?? '').toString().trim();
        if (s === 'PRICING_DIAG' || s === 'PRICING') return 'Pricing';
        return s.toUpperCase() || '—';
    }

    private isObjectId(value: any): boolean {
        return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim());
    }

    displayName(...candidates: any[]): string {
        for (const c of candidates) {
            if (c == null) continue;
            const s = String(c).trim();
            if (!s || this.isObjectId(s)) continue;
            return s;
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
            await this.diPdf.generateAndDownload(this.di, {
                cycles: this.buildPdfCycles(),
                finance: this.financeRows,
                financeCycleLabel:
                    this.selectedCycle === 0
                        ? 'Flux original'
                        : `Retour ${this.selectedCycle}`,
                journal: this.journalRowsForPdf,
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
        for (const tab of ['journal', 'temps', 'liens'] as DiInfoTab[]) {
            if (this.loaded.has(tab)) continue;
            this.loaded.add(tab);
            if (tab === 'journal') jobs.push(this.loadJournal());
            else if (tab === 'temps') jobs.push(this.loadTimes());
            else jobs.push(this.loadLinks());
        }
        await Promise.all(jobs);
    }

    /** Journal COMPLET (sans le filtre d'écran) pour l'export. */
    private get journalRowsForPdf(): Array<{
        date: string | null;
        label: string;
        code: string;
        actor: string | null;
        cycle: number | null;
    }> {
        const keep = this.journalFilter;
        this.journalFilter = '';
        try {
            return this.journalRows.map((r) => ({
                date: r.date,
                label: r.label,
                code: r.code,
                actor: r.actor ? this.displayName(r.actor) : null,
                cycle: r.cycle,
            }));
        } finally {
            this.journalFilter = keep;
        }
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

    /** Bandeau Retour — pendant du bandeau Annulation. */
    get hasRetourInfo(): boolean {
        return !!(this.di?.retourReason || this.di?.retourDate);
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
        // L'édition porte sur la DI elle-même, jamais sur un snapshot de cycle :
        // on force donc l'affichage sur le flux courant pour éviter que
        // l'utilisateur croie modifier un retour archivé.
        this.selectedCycle = this.cycleCount;
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
        return d.toISOString().slice(0, 10);
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

    /** Impression : `@media print` ne garde que `.di-info-modal`. */
    print() {
        try {
            document.body.classList.add('di-info-printing');
            const restore = () => {
                document.body.classList.remove('di-info-printing');
                window.removeEventListener('afterprint', restore);
            };
            window.addEventListener('afterprint', restore);
            window.print();
        } catch {
            document.body.classList.remove('di-info-printing');
        }
    }
}
