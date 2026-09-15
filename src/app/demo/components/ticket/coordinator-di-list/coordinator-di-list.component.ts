import { Component, OnDestroy } from '@angular/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { Product } from 'src/app/demo/api/product';
import { TicketService } from 'src/app/demo/service/ticket.service';
import {
    ConfigRepAffectationMutationResponse,
    GetAllTechQueryResponse,
    TechStartDiagnosticMutationResponse,
} from './coordinator-di-list.interfaces';
import {
    APPROVAL_DOC_STATUS_VALUES,
    STATUS_DI,
} from 'src/app/layout/api/status-di';
import { environment } from 'src/environments/environment';
import { PageEvent } from '../../profile/profile-list/profile-list.interfaces';
import { NotificationService } from 'src/app/demo/service/notification.service';
import { debounceTime, finalize, Subject, takeUntil } from 'rxjs';
import { TicketRefreshService } from 'src/app/demo/service/ticket-refresh.service';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DiDetailService } from 'src/app/demo/service/di-detail.service';
import { DeepLinkConsumer } from 'src/app/demo/service/deep-link-consumer';
import {
    formatTableValue,
    isLocationColumn,
    isEmplacementVide as isEmplacementVideUtil,
    trackByColumn,
} from '../table-display.utils';
// SOURCE UNIQUE du calcul de durées entre statuts — partagée avec di-info-modal
// (« ne le réimplémente pas »). Les méthodes ci-dessous délèguent à ces fonctions.
import {
    ALL_STATUS_ORDER as SHARED_STATUS_ORDER,
    BASE_PHASES as SHARED_BASE_PHASES,
    sanitizeHistory as sharedSanitizeHistory,
    phaseEntry as sharedPhaseEntry,
    isPhaseBehindCurrent as sharedIsPhaseBehind,
    computePhaseState as sharedComputePhaseState,
    formatDuration as sharedFormatDuration,
    phaseOfStatus as sharedPhaseOfStatus,
} from '../shared/status-timeline.util';
import { applyChartTheme } from '../../../../shared/chart-theme';
import { LayoutService } from '../../../../layout/service/app.layout.service';
import { NotifyService } from '../../../../shared/ui/notify.service';
import { ConfirmService } from '../../../../shared/ui/confirm.service';
import { splitRemarqueDiagnostic } from '../shared/remarque-diagnostic.util';

/** Les 5 étapes du panneau « Contrôles par étape » du modal Coordination. */
export type CoordFlowStep =
    | 'diagnostic'
    | 'magasin'
    | 'admin'
    | 'repair'
    | 'closure';

/** `skipped` = étape qui n'aura JAMAIS lieu pour cette DI (pas « pas encore »). */
export type CoordFlowStepState = 'done' | 'current' | 'skipped' | 'pending';

export const COORD_FLOW_STEP_LABEL: Record<CoordFlowStepState, string> = {
    done: 'Terminé',
    current: 'En attente',
    skipped: 'Sauté',
    pending: 'Non démarrée',
};

export const COORD_FLOW_STEP_ICON: Record<CoordFlowStepState, string> = {
    done: 'pi pi-check-circle',
    current: 'pi pi-clock',
    skipped: 'pi pi-angle-double-right',
    pending: 'pi pi-minus-circle',
};

@Component({
    selector: 'app-coordinator-di-list',
    templateUrl: './coordinator-di-list.component.html',
    styleUrl: './coordinator-di-list.component.scss',
})
export class CoordinatorDiListComponent implements OnDestroy {
    // Filtres de colonnes CUMULATIFS : searchKey → valeur saisie (trimée).
    private columnFilters: Record<string, string> = {};
    private searchSubject$ = new Subject<void>();
    private destroy$ = new Subject<void>();
    /** Jeton anti-réponse périmée : seule la DERNIÈRE requête de `loadData`
     *  (recherche, pagination, notification) peut écrire la liste. */
    private loadSeq = 0;

    visible: boolean = false;
    products!: Product[];

    //--
    diag_condition: boolean = true; // enable when status = pending1
    admin_condition: boolean = true; //enable when status = pending2
    rep_condition: boolean = true; // enable when status = pending3
    // Manager gate: while the DI is in a Retour cycle, diagnostic (re)assignment
    // stays VISIBLE but locked. It unlocks only once the manager relaunches the
    // DI into the flow (status → PENDING1). Set in `<the flow-modal opener>`.
    diagReassignLockedByRetour: boolean = false;
    rangeDates: Date[] | undefined;

    selectedTech: any; // Variable to store the selected tech data

    // ── Raccourci « retour sans pièces » (envoi en réparation avec devis) ────
    // La DI (needsDevisBeforeRepair) a sauté magasin + tarification : la
    // coordinatrice choisit le technicien réparateur ET joint le devis, puis
    // envoie en UN SEUL geste. Le bouton reste bloqué tant que les deux manquent.
    selectedRepTechForDevis: any = null;
    repairDevisBase64: string | null = null; // data-URL base64 du PDF
    repairDevisName: string | null = null; // nom de fichier (affichage)
    sendingRepairWithDevis = false;

    //--
    //Btn for confirmation
    confirmationBTN = false;
    loading: boolean = false;
    roles;
    tstatuses = [{ label: 'Pending3', value: 'Pending3' }];
    // Used for the mini Dashboard
    counterInMagasin = 0;
    counterInDiagnostique = 0;
    counterInReperation = 0;
    counterPending = 0;
    counterRetour = 0;
    isLoading: boolean = true;

    uploadedFiles: any[] = [];
    cols = [
        { field: '_idnum', header: 'ID', searchKey: '_idnum' },
        { field: 'title', header: 'Title', searchKey: 'title' },
        { field: 'status', header: 'Status', searchKey: 'status' },
        { field: 'client_id', header: 'Client', searchKey: 'client' },
        { field: 'company_id', header: 'Company', searchKey: 'company' },
        { field: 'createdBy', header: 'Cree par', searchKey: 'createdBy' },
        { field: 'location_id', header: 'Location', searchKey: 'location' },
    ];

    countries;
    selectedCountry;
    diList: any;
    diListCount: any;
    diDialog: boolean = false;
    di: any;
    techList: any;
    selectedDi: any;
    /** Statut de la DI sélectionnée — pilote le bouton coordinateur
     *  « Confirmer les composants » (v2). Legacy CONFIRMATION_COMPOSANTS toléré. */
    selectedDiStatus: string;
    pricingDoalog: boolean = false;
    reperationCondition: boolean;
    remarque_manager: string;
    remarque_admin_manager: string;
    remarque_admin_tech: string;
    remarque_tech_diagnostic: string;
    remarque_tech_repair: string;
    remarque_magasin: string;
    remarque_coordinator: string;
    remarqueTech: string;
    /** `remarque_tech_diagnostic` redécoupé comme le compose le formulaire de
     *  diagnostic : description de la panne, puis remarque technicien. */
    get techDiagSplit(): { description: string; remarque: string } {
        return splitRemarqueDiagnostic(this.remarque_tech_diagnostic);
    }
    selectedDiLocation: any;
    selectedTechDiagModel: null;
    isConfirmed: any;
    first: number = 0;
    rows: number = 10;
    modalRetour1Info: boolean = false;
    modalRetour2Info: boolean = false;
    modalRetour3Info: boolean = false;
    page: any;
    basicOptions: {
        plugins: { legend: { labels: { color: string } } };
        scales: {
            y: {
                beginAtZero: boolean;
                ticks: {
                    color: string;
                    stepSize: number;
                    callback: (value: number) => string;
                };
                grid: { color: string; drawBorder: boolean };
            };
            x: {
                ticks: { color: string };
                grid: { color: string; drawBorder: boolean };
            };
        };
    };
    statusCount: any;
    basicData: {
        labels: any;
        datasets: {
            label: string;
            data: any;
            backgroundColor: string[];
            borderColor: string[];
            borderWidth: number;
        }[];
    };
    openBtnConfirm: boolean;
    componentInfo: any;
    componentConfirmedFromCoordinator: any;
    magasinsentToCoordinator: boolean;
    gotComposantFromMagasinCondition: boolean;
    ignoreCount: any;
    adminSentAt: any = null;
    magasinConfirmedAt: any = null;
    pricingRequestInFlight = false;
    componentsConfirmInFlight = false;

    // ─── Retour-aware flow state ──────────────────────────────────────────
    // A DI that returns (`Di.ignoreCount > 0`) runs through the same 5-stage
    // pipeline again — each retour is a fresh cycle with its own snapshot
    // logged to LogsDi. The modal now models that as N+1 tabs (Flow Original
    // + one Retour #N per ignoreCount), with per-segment timeline + motif.
    /** All LogsDi snapshots for the open DI, sorted by `idIgnore` ASC. */
    flowLogsDi: any[] = [];
    /** Techniciens diagnostic sélectionnables — MÉMOÏSÉ (le getter recréait un
     *  tableau à chaque cycle de détection → le p-dropdown re-traitait ses
     *  options en boucle). Recalculé à l'ouverture du modal + au chargement des
     *  techniciens. */
    availableDiagTechsList: any[] = [];
    private refreshAvailableDiagTechs(): void {
        const abandoned = new Set(
            (this.di?.diagAssignments ?? [])
                .filter((a: any) => !!a.abandonedAt)
                .map((a: any) => a.techId),
        );
        this.availableDiagTechsList = (this.techList ?? []).filter(
            (t: any) => !abandoned.has(t?._id),
        );
    }

    /** ─── Coordination-modal: real-data-only state ─────────────────────────
     *  techAvgRepairByTechId is populated by the dashboardTechLeaderboard
     *  query when the modal opens. Keys = Profile._id, value = avg days
     *  spent on FINISHED DIs. Techs with zero finished DIs are absent from
     *  the map → UI hides the "Temps moyen réparation" tile for them.
     *  techSearchTerm filters the tech grid; empty = show all.
     */
    techAvgRepairByTechId: Record<string, number> = {};
    techSearchTerm = '';

    /** Status-code → user-readable French label. Used in the dynamic flow
     *  timeline so every node always shows the REAL underlying DB status,
     *  never a generic "En attente / Terminé" placeholder when the system
     *  knows more. */
    /** Affichage BRUT du statut en MAJUSCULES (décision produit — plus de
     *  libellés « jolis » ; la valeur DB est montrée telle quelle). */
    private statusRaw(s: string | null | undefined): string {
        return (s ?? '').toString().toUpperCase() || '—';
    }

    /** Canonical status ordering — SOURCE UNIQUE partagée (status-timeline.util). */
    private readonly ALL_STATUS_ORDER = SHARED_STATUS_ORDER;

    /** Timeline « Contrôle du Flow » — UN statut PAR étape (plus de regroupement
     *  en 5 phases). Ordre canonique du flux ; Retour 1/2/3 ajoutés dynamiquement
     *  par getFlowPhases(). Par étape :
     *   - `key`      : valeur de statut canonique (clé unique — pilote les lookups
     *                  date/écart/valeur brute) ;
     *   - `group`    : famille pour l'acteur (createdBy / tech / magasin / admin) ;
     *   - `label`    : libellé FR lisible ;
     *   - `statuses` : jeu d'appariement, valeurs LEGACY incluses (DI pré-migration)
     *                  + variantes `_Pause` ; ORDONNÉ pour que le DERNIER élément
     *                  ait l'index le PLUS ÉLEVÉ dans ALL_STATUS_ORDER (ancre du
     *                  seuil done/pending). */
    private readonly BASE_PHASES = SHARED_BASE_PHASES;
    ticketData: { data: any; pauseLogs: any; logsDi: any };
    retour1InfoFromLogs: any;
    retour2InfoFromLogs: any;
    retour3InfoFromLogs: any;
    ignoreCountForBtns: number = 0;
    ticketDetailsInfo: boolean;
    techInfo: any;
    baseUrl = environment.apiUrl;

    /** Resolve a stored doc reference into an openable href: Drive uploads store
     *  an absolute webViewLink (opened as-is); legacy values get the API root. */
    docHref(value?: string | null): string {
        if (!value) return '';
        return /^https?:\/\//i.test(value) || value.startsWith('data:')
            ? value
            : this.baseUrl + value;
    }

    // ── Annulation d'une DI (bouton coordinateur, confirmée par mot de passe) ─
    cancelDialog = false;
    cancelForm: {
        parClient: boolean;
        motif: string | null;
        motifAutre: string;
        commentaire: string;
        password: string;
    } = { parClient: false, motif: null, motifAutre: '', commentaire: '', password: '' };
    readonly CANCEL_KEY = 'annuler-di';
    /** Motifs métier (atelier réparation industrielle). Les CODES doivent
     *  correspondre à la liste blanche serveur (`DiService.ANNUL_MOTIFS`). */
    readonly cancelMotifs = [
        { label: 'Prix trop élevé', value: 'PRIX_TROP_ELEVE' },
        { label: 'Délai trop long', value: 'DELAI_TROP_LONG' },
        { label: 'Pièce introuvable / non disponible', value: 'PIECE_INTROUVABLE' },
        { label: 'Équipement irréparable', value: 'IRREPARABLE' },
        { label: 'Client a renoncé', value: 'CLIENT_RENONCE' },
        { label: 'Réparé ailleurs', value: 'REPARE_AILLEURS' },
        { label: 'Doublon / erreur de saisie', value: 'DOUBLON_ERREUR' },
        { label: 'Autre', value: 'AUTRE' },
    ];

    /** Deep-link notification → ouverture de la modale d'affectation. */
    private deepLinkConsumer?: DeepLinkConsumer;

    constructor(
        public layoutService: LayoutService,
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private readonly notify: NotifyService,
        private readonly confirm: ConfirmService,
        private notificationService: NotificationService,
        private ticketRefreshService: TicketRefreshService,
        private mutationRunner: MutationRunner,
        private route: ActivatedRoute,
        private router: Router,
        private diDetail: DiDetailService,
    ) {
        // Chart.js dessine sur un canvas : il n'herite pas des variables CSS.
        // Sans cette reapplication, axes et legende gardent les couleurs de
        // l'ancien theme apres une bascule clair/sombre.
        this.layoutService.configUpdate$.subscribe(() => {
            if (this.basicOptions) {
                this.basicOptions = applyChartTheme(this.basicOptions);
            }
        });
}

    /** Ouvre le modal d'annulation (repart d'un formulaire vierge). */
    openCancelDialog() {
        this.cancelForm = {
            parClient: false,
            motif: null,
            motifAutre: '',
            commentaire: '',
            password: '',
        };
        this.cancelDialog = true;
    }

    /** Anti double-submit exposé au template (le champ runner est privé). */
    get cancelBusy(): boolean {
        return this.mutationRunner.isBusy(this.CANCEL_KEY);
    }

    /** Validation front (le back re-valide) : motif + mot de passe requis,
     *  texte libre obligatoire si « Autre », et anti double-submit. */
    get cancelSubmitDisabled(): boolean {
        const f = this.cancelForm;
        if (!f.motif || !f.password) return true;
        if (f.motif === 'AUTRE' && !f.motifAutre.trim()) return true;
        return this.mutationRunner.isBusy(this.CANCEL_KEY);
    }

    /** Envoie l'annulation. Ferme + rafraîchit UNIQUEMENT en cas de succès ;
     *  un échec (ex. mot de passe faux) est toasté et laisse le modal ouvert —
     *  la DI reste inchangée. */
    async submitCancelDi() {
        if (this.cancelSubmitDisabled) return;
        const f = this.cancelForm;
        try {
            await this.mutationRunner.run({
                key: this.CANCEL_KEY,
                mutation: this.ticketSerice.annulerDi(),
                variables: {
                    input: {
                        diId: this.selectedDi,
                        parClient: !!f.parClient,
                        motif: f.motif,
                        motifAutre:
                            f.motif === 'AUTRE' ? f.motifAutre.trim() : null,
                        commentaire: f.commentaire?.trim() || null,
                        password: f.password,
                    },
                },
                successToast: {
                    summary: 'DI annulée',
                    detail: 'La DI a été annulée et le motif enregistré.',
                },
                onLoading: (l) => (this.isLoading = l),
            });
            this.cancelDialog = false;
            this.diDialog = false;
            this.loadData();
        } catch {
            // Échec déjà toasté par MutationRunner. Modal laissé ouvert pour
            // correction ; aucune modification de la DI côté serveur.
        }
    }

    // ── Réactivation d'une DI annulée → statut précédent ─────────────────────
    // L'annulation n'a rien détruit ; on relit le statut précédent dans
    // `statusHistory`. Miroir FRONT des gardes back (informatif : le back reste
    // autoritaire et renvoie un message clair en cas de refus).
    private readonly POST_DOC_STATUSES = [
        'WAITING_BL',
        'WAITING_FACTURE',
        'CLOSING',
        'ATTENTE_BL_FACTURE',
        'FINISHED',
    ];
    reactivateBusy = false;

    /** Statut juste avant la DERNIÈRE annulation (entrée avant le dernier ANNULER
     *  de l'historique), ou null si introuvable. */
    get reactivablePreviousStatus(): string | null {
        const di = this.di;
        if (!di || di.status !== 'ANNULER') return null;
        const h = Array.isArray(di.statusHistory) ? di.statusHistory : [];
        let lastAnn = -1;
        for (let i = h.length - 1; i >= 0; i--) {
            if (h[i]?.status === 'ANNULER') {
                lastAnn = i;
                break;
            }
        }
        return lastAnn > 0 ? h[lastAnn - 1]?.status ?? null : null;
    }

    /** Raison de blocage de la réactivation (null = réactivable). */
    get reactivateBlockedReason(): string | null {
        const di = this.di;
        if (!di || di.status !== 'ANNULER') return null;
        const prev = this.reactivablePreviousStatus;
        if (!prev) return 'Statut précédent introuvable';
        if (this.POST_DOC_STATUSES.includes(prev))
            return 'Origine post-document (BL/facture émis)';
        const h = Array.isArray(di.statusHistory) ? di.statusHistory : [];
        const already = h.some(
            (e: any, i: number) =>
                e?.status === 'ANNULER' &&
                i < h.length - 1 &&
                h[i + 1]?.status !== 'ANNULER',
        );
        if (already) return 'DI déjà réactivée une fois';
        return null;
    }

    /** Réactive la DI (remet au statut précédent). Confirmation → mutation ;
     *  succès → toast + rafraîchit + ferme ; refus back → toast du message. */
    reactivateDi(): void {
        const di = this.di;
        if (!di?._id || di.status !== 'ANNULER') return;
        const blocked = this.reactivateBlockedReason;
        if (blocked) {
            this.notify.warn(blocked, { summary: 'Réactivation impossible' });
            return;
        }
        const prev = this.reactivablePreviousStatus;
        this.confirm.confirmSave({
            message: `Réactiver cette DI et la remettre en « ${prev} » ? L'annulation sera défaite (action tracée).`,
            header: 'Réactiver la DI',
            acceptLabel: 'Réactiver',
            accept: () => {
                this.reactivateBusy = true;
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.reactiverDi(di._id),
                    })
                    .subscribe({
                        next: () => {
                            this.notify.success(
                                `Remise en « ${prev} ».`,
                                { summary: 'DI réactivée' },
                            );
                            this.reactivateBusy = false;
                            this.loadData();
                            this.diDialog = false;
                        },
                        error: (e) => {
                            this.reactivateBusy = false;
                            this.notify.error(
                                e?.message ??
                                    'La réactivation a échoué.',
                                { summary: 'Réactivation refusée' },
                            );
                        },
                    });
            },
        });
    }

    ngOnInit() {
        // Initial load
        this.loadData();
        this.getAllTech();
        this.getStatusCount();
        this.confirmationBTN = false;

        // Deep-link notification : ?di=&action= → ouvre la modale d'affectation
        // (openModalConfig) sur la ligne concernée, sinon modal détail.
        this.deepLinkConsumer = new DeepLinkConsumer(
            this.route,
            this.router,
            () => this.diList,
            (row, diId, action) => this.openFromParams(row, diId, action),
        );
        this.deepLinkConsumer.listen(this.destroy$);

        // Setup search with debounce
        this.searchSubject$
            .pipe(debounceTime(400), takeUntil(this.destroy$))
            .subscribe(() => {
                this.loadData();
            });

        this.ticketRefreshService
            .listen('coordinator-list')
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.loadData();
            });

        this.notificationService.sentComponentToCoordinator$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: any) => {
                if (message) {
                    // Ancien toast « Components Received » retiré (remplacé par la
                    // notification ERP). On garde UNIQUEMENT le rafraîchissement
                    // de la liste quand le magasin envoie les composants.
                    this.ticketRefreshService.requestRefresh(
                        'coordinator-list',
                        {
                            source: 'component:sent_to_coordinator',
                            message,
                        },
                    );
                }
            });

        // Notification subscription
        this.notificationService.notification$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: any) => {
                console.log('🍻[message]:', message);
                if (message) {
                    console.log('🍚[message]:', message);
                    this.ticketRefreshService.requestRefresh(
                        'coordinator-list',
                        {
                            source: 'updateTicket',
                            message,
                        },
                    );
                    this.getStatusCount();
                }
            });
    }

    ngOnDestroy() {
        this.deepLinkConsumer?.destroy();
        this.destroy$.next();
        this.destroy$.complete();
    }

    /** Deep-link : ouvre la modale d'affectation pour la ligne trouvée, sinon
     *  retombe sur le modal détail partagé (jamais un clic mort). */
    private openFromParams(
        row: any | null,
        diId: string,
        action: string,
    ): void {
        if (row && action === 'affecter') {
            this.openModalConfig(row);
            return;
        }
        this.diDetail.openById(diId);
    }

    /**
     * Centralized data loading method
     * Handles both search and regular data fetching with pagination
     */
    loadData() {
        this.isLoading = true;
        // Une réponse lente d'une requête DÉPASSÉE ne doit ni écraser la liste
        // ni éteindre le chargement de la requête en cours.
        const seq = ++this.loadSeq;
        const isCurrent = () => seq === this.loadSeq;

        const searches = Object.entries(this.columnFilters).map(
            ([field, value]) => ({ field, value }),
        );

        if (searches.length) {
            // Perform search — saisie en variable GraphQL, jamais interpolée
            this.apollo
                .query<any>({
                    query: this.ticketSerice.searchCoordinatorDI(
                        this.first,
                        this.rows,
                    ),
                    variables: { search: searches },
                    fetchPolicy: 'no-cache',
                })
                .pipe(
                    finalize(() => {
                        if (isCurrent()) this.isLoading = false;
                    }),
                )
                .subscribe({
                    // `errorPolicy: 'all'` (graphql.modules) livre les erreurs
                    // GraphQL dans `next`, pas dans `error` : sans ce test la
                    // recherche échouait sans le moindre toast.
                    next: ({ data, errors }) => {
                        if (!isCurrent()) return;
                        if (errors?.length) {
                            this.notify.error(
                                errors[0]?.message ||
                                    'La recherche a échoué. Réessayez.',
                                { summary: 'Erreur de recherche' },
                            );
                            return;
                        }
                        if (data?.searchCoordinatorDI) {
                            this.diList = data.searchCoordinatorDI.di;
                            this.diListCount =
                                data.searchCoordinatorDI.totalDiCount;
                            this.updateCounters();
                        }
                    },
                    error: (error) => {
                        if (!isCurrent()) return;
                        this.notify.error(
                            error?.message ||
                                'La recherche a échoué. Réessayez.',
                            { summary: 'Erreur de recherche' },
                        );
                    },
                });
        } else {
            // Regular data fetch
            this.apollo
                .query<any>({
                    query: this.ticketSerice.getAllDiForCoordinator(
                        this.first,
                        this.rows,
                    ),
                    fetchPolicy: 'no-cache',
                })
                .pipe(
                    finalize(() => {
                        if (isCurrent()) this.isLoading = false;
                    }),
                )
                .subscribe(({ data }) => {
                    if (!isCurrent()) return;
                    console.log('🌶[*************data]:', data);

                    if (data && data.get_coordinatorDI) {
                        this.diList = data.get_coordinatorDI.di;
                        this.diListCount = data.get_coordinatorDI.totalDiCount;
                        this.updateCounters();
                    }
                });
        }
    }

    getStatusLabel(status: string): string {
        // Affichage BRUT en MAJUSCULES. PRICING_DIAG et son ancienne valeur
        // PRICING sont ramenés au MÊME libellé « PRICING » : les deux valeurs
        // coexistent en base (renommage forward-only, sans backfill) et la
        // colonne « Statut » afficherait sinon deux libellés pour un même état.
        const s = (status ?? '').toString().trim();
        if (s === 'PRICING_DIAG' || s === 'PRICING') return 'PRICING';
        return s.toUpperCase() || '—';
    }

    /**
     * Update counters for mini dashboard
     */
    updateCounters() {
        // Reset counters
        this.counterInMagasin = 0;
        this.counterInDiagnostique = 0;
        this.counterInReperation = 0;
        this.counterPending = 0;
        this.counterRetour = 0;

        // Count status occurrences
        this.diList.forEach((di) => {
            switch (di.status) {
                case 'CONFIRMATION':
                case 'PROCESSING':
                case 'MagasinEstimation':
                    this.counterInMagasin++;
                    break;
                case 'DIAGNOSTIC':
                case 'INDIAGNOSTIC':
                case 'DIAGNOSTIC_Pause':
                    this.counterInDiagnostique++;
                    break;
                case 'REPARATION':
                case 'INREPARATION':
                case 'REPARATION_Pause':
                    this.counterInReperation++;
                    break;
                case 'PENDING1':
                case 'PENDING2':
                case 'PENDING3':
                    this.counterPending++;
                    break;
                case 'RETOUR1':
                case 'RETOUR2':
                case 'RETOUR3':
                    this.counterRetour++;
                    break;
                default:
                    break;
            }
        });
    }

    /**
     * Handle column search — filtres CUMULATIFS : chaque colonne garde sa
     * valeur ; vider une colonne ne retire QUE son propre filtre.
     */
    onColumnSearch(field: string, value: string) {
        const f = field?.trim();
        if (!f) return;
        const v = value?.trim() ?? '';
        if ((this.columnFilters[f] ?? '') === v) return;

        if (v) {
            this.columnFilters[f] = v;
        } else {
            delete this.columnFilters[f];
        }
        this.first = 0; // Reset to first page on new search
        // Debounced for typing AND clearing (clearing used to fire at once and
        // could race a pending search).
        this.searchSubject$.next();
    }

    /** Dernier rang affiché dans le compteur « a–b sur N résultats ». */
    get rangeEnd(): number {
        return Math.min(this.first + this.rows, this.diListCount || 0);
    }

    formatCell(row: any, field: string): string {
        return formatTableValue(row, field);
    }

    isLocationCell(field: string): boolean {
        return isLocationColumn(field);
    }

    /** Point LOCATION : emplacement vide → vert, renseigné → rouge. */
    isEmplacementVide(row: any, field: string): boolean {
        return isEmplacementVideUtil(row, field);
    }

    trackByColumn = trackByColumn;

    /**
     * Handle page change
     */
    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;

        // Load data (will automatically use search if active)
        this.loadData();
    }

    diagnosticOpen() {}

    showDialog() {
        this.visible = true;
    }

    infoRetour1OPEN() {
        this.modalRetour1Info = !this.modalRetour1Info;
    }

    infoRetour2OPEN() {
        this.modalRetour2Info = !this.modalRetour2Info;
    }

    infoRetour3OPEN() {
        this.modalRetour3Info = !this.modalRetour3Info;
    }

    getStatusCount() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue(
            '--text-color-secondary',
        );
        const surfaceBorder =
            documentStyle.getPropertyValue('--surface-border');
        this.apollo
            .query<any>({
                query: this.ticketSerice.getStatusCount(),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.statusCount = data.getStatusCount;
                    this.basicData = {
                        labels: this.statusCount.map((el) => el.status),
                        datasets: [
                            {
                                label: 'Di',
                                data: this.statusCount.map((el) => el.count),
                                backgroundColor: [
                                    'rgba(255, 159, 64, 0.2)',
                                    'rgba(75, 192, 192, 0.2)',
                                    'rgba(54, 162, 235, 0.2)',
                                    'rgba(153, 102, 255, 0.2)',
                                ],
                                borderColor: [
                                    'rgb(255, 159, 64)',
                                    'rgb(75, 192, 192)',
                                    'rgb(54, 162, 235)',
                                    'rgb(153, 102, 255)',
                                ],
                                borderWidth: 1,
                            },
                        ],
                    };
                    this.basicOptions = {
                        plugins: {
                            legend: {
                                labels: {
                                    color: textColor,
                                },
                            },
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: textColorSecondary,
                                    stepSize: 1,
                                    callback: (value: number) =>
                                        value.toFixed(0),
                                },
                                grid: {
                                    color: surfaceBorder,
                                    drawBorder: false,
                                },
                            },
                            x: {
                                ticks: {
                                    color: textColorSecondary,
                                },
                                grid: {
                                    color: surfaceBorder,
                                    drawBorder: false,
                                },
                            },
                        },
                    };
                }
            });
    }

    getReperationCoordinatorCondition() {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getReperationCoordinatorCondition(
                    this.selectedDi,
                ),
            })
            .valueChanges.subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.reperationCondition =
                        data.getDiById.di.gotComposantFromMagasin;
                }
            });
    }

    getAllTech() {
        this.apollo
            .watchQuery<GetAllTechQueryResponse>({
                query: this.ticketSerice.getAllTech(),
            })
            .valueChanges.subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.techList = data.getAllTech;
                    // Techniciens chargés → recalcule la liste filtrée du modal.
                    this.refreshAvailableDiagTechs();
                }
            });
    }

    load() {
        this.loading = true;

        setTimeout(() => {
            this.loading = false;
        }, 2000);
    }

    /**
     * True when the opened DI SKIPS the component-confirmation phase: it has no
     * components (`contain_pdr` false OR an empty `array_composants`). Such a DI
     * goes straight from negotiation to PENDING3, so « Confirmer la réception
     * des composants » never applies — the card shows « Étape sautée » instead
     * of a dead confirm button. Mirrors the backend routing/guard criterion.
     */
    get componentStepSkipped(): boolean {
        const di = this.di;
        if (!di) return false;
        const hasComponents =
            !!di.contain_pdr && (di.array_composants?.length ?? 0) > 0;
        return !hasComponents;
    }

    // NB : la logique « techniciens diagnostic sélectionnables » (masque ceux
    // ayant abandonné ce cycle) est désormais MÉMOÏSÉE dans
    // `availableDiagTechsList` / `refreshAvailableDiagTechs()` (voir plus haut) —
    // l'ancien getter recalculé à chaque cycle de détection faisait re-traiter le
    // p-dropdown en boucle et participait au freeze du modal.

    openModalConfig(di) {
        this.di = { ...di };
        // Raccourci « retour sans pièces » : repart d'un état vierge à chaque
        // ouverture (aucun devis/technicien résiduel d'une DI précédente).
        this.selectedRepTechForDevis = null;
        this.repairDevisBase64 = null;
        this.repairDevisName = null;
        this.sendingRepairWithDevis = false;
        this.refreshAvailableDiagTechs();
        this.adminSentAt = di.pricingRequestSentAt ?? null;
        this.magasinConfirmedAt = di.componentsConfirmedAt ?? null;
        this.pricingRequestInFlight = false;
        this.componentsConfirmInFlight = false;
        this.gotComposantFromMagasinCondition = di.gotComposantFromMagasin;
        this.techSearchTerm = '';
        this.fetchTechAvgRepair();
        // Snapshots LogsDi des cycles retour — ne sert plus qu'au repli de la
        // date de retour dans la bannière (cf. fetchFlowLogsDi).
        this.fetchFlowLogsDi(di._id);
        if (di.logs && di.logs.length > 0) {
            const highestIgnoreLog = di.logs.reduce((prev, current) =>
                prev.idIgnore > current.idIgnore ? prev : current,
            );
            this.magasinsentToCoordinator =
                highestIgnoreLog.isSentToCoordinator;
            this.componentConfirmedFromCoordinator =
                highestIgnoreLog.handleSendingNotificationBetweenCoordinatorAndMagasin;
            console.log(
                ' this.componentConfirmedFromCoordinator 0',
                highestIgnoreLog,
            );
        } else {
            this.magasinsentToCoordinator = di.isSentToCoordinator;
            this.componentConfirmedFromCoordinator =
                di.handleSendingNotificationBetweenCoordinatorAndMagasin;
            console.log(
                '🍝 this.componentConfirmedFromCoordinator',
                this.componentConfirmedFromCoordinator,
            );
        }

        this.openBtnConfirm = di.isSentToCoordinator;
        this.remarque_manager = di.remarque_manager;
        this.remarque_admin_manager = di.remarque_admin_manager;
        this.remarque_admin_tech = di.remarque_admin_tech;
        this.remarque_tech_diagnostic = di.remarque_tech_diagnostic;
        this.remarque_tech_repair = di.remarque_tech_repair;
        this.remarque_magasin = di.remarque_magasin;
        this.remarque_coordinator = di.remarque_coordinator;
        this.remarqueTech = di.remarqueTech;
        this.selectedDi = di._id;
        this.selectedDiStatus = di.status;
        this.selectedDiLocation = di.location_id;
        this.ignoreCount = di.ignoreCount;
        this.diDialog = true;
        this.getReperationCoordinatorCondition();

        // condition to send to diag — PENDING1 (first pass) OR any RETOUR cycle
        // (a returned DI is re-affected to a tech for re-diagnosis).
        [
            STATUS_DI.PENDING1,
            STATUS_DI.RETOUR1,
            STATUS_DI.RETOUR2,
            STATUS_DI.RETOUR3,
        ].includes(di.status)
            ? (this.diag_condition = false)
            : (this.diag_condition = true);
        // Manager gate: diagnostic (re)assignment is LOCKED during any Retour
        // cycle and only unlocks at PENDING1 (after the manager relaunches the
        // DI). The dropdown stays visible so the gate is discoverable.
        this.diagReassignLockedByRetour = [
            STATUS_DI.RETOUR1,
            STATUS_DI.RETOUR2,
            STATUS_DI.RETOUR3,
        ].includes(di.status);
        // condition to send to admin
        di.status == STATUS_DI.PENDING2
            ? (this.admin_condition = false)
            : (this.admin_condition = true);
        //condition to send to repair
        di.status == STATUS_DI.PENDING3
            ? (this.rep_condition = false)
            : (this.rep_condition = true);
    }

    // ── Retour-aware flow helpers (Flow Original + Retour #1/2/3) ─────────

    /**
     * Charge les snapshots LogsDi de la DI ouverte.
     *
     * ⚠️ Cette requête SURVIT au retrait de la colonne « Historique du flow »,
     * qui en était pourtant la consommatrice principale : `flowLogsDi` alimente
     * encore `diLatestRetour`, dont dépend le REPLI de `diRetourDate`
     * (`di.retourDate ?? diLatestRetour.createdAt`) affiché dans la BANNIÈRE de
     * statut. La supprimer ferait silencieusement disparaître la date de retour
     * sur les DI héritées dépourvues de `di.retourDate`.
     */
    private fetchFlowLogsDi(_idDi: string) {
        this.flowLogsDi = [];
        if (!_idDi) return;
        this.apollo
            .query<any>({
                query: this.ticketSerice.getLogsDi(_idDi),
                fetchPolicy: 'no-cache',
            })
            .subscribe(({ data }) => {
                const logs = data?.getAllLogsByDi || [];
                this.flowLogsDi = [...logs].sort(
                    (a, b) => (a.idIgnore ?? 0) - (b.idIgnore ?? 0),
                );
            });
    }

    /** Retour count = the DI's `ignoreCount`. Source of truth for the red
     *  top badge + the number of `Retour #N` tabs. */
    get diRetourCount(): number {
        return Number(this.di?.ignoreCount ?? 0);
    }

    /** Latest LogsDi snapshot — surfaces motif + date in the status banner. */
    get diLatestRetour(): any | null {
        if (!this.flowLogsDi?.length) return null;
        return this.flowLogsDi[this.flowLogsDi.length - 1];
    }

    /** Date du retour = `DI.retourDate` (falls back to the latest LogsDi). */
    get diRetourDate(): string {
        return this.formatDateTime(
            this.di?.retourDate ?? this.diLatestRetour?.createdAt,
        );
    }

    /** Red-badge escalation: 1 → mild, 2 → strong, 3+ → critical. */
    get diRetourEscalationClass(): string {
        const n = this.diRetourCount;
        if (n >= 3) return 'cf-retour-pill--critical';
        if (n === 2) return 'cf-retour-pill--strong';
        if (n === 1) return 'cf-retour-pill--mild';
        return '';
    }

    /** Status pill for the top banner — French label via the existing map. */
    get diCurrentStatusLabel(): string {
        return this.statusRaw(this.di?.status);
    }

    /**
     * Teinte de la pastille de statut de la bannière, dérivée de la FAMILLE du
     * statut (même source que l'état des étapes) plutôt que d'une couleur figée :
     * la pastille dit donc où en est la DI, pas seulement qu'elle existe.
     */
    get diCurrentStatusTone(): string {
        const status = this.di?.status;
        if (!status) return 'cf-pill--slate';
        if (status === STATUS_DI.ANNULER) return 'cf-pill--slate';
        if (
            [STATUS_DI.RETOUR1, STATUS_DI.RETOUR2, STATUS_DI.RETOUR3].includes(
                status,
            )
        ) {
            return 'cf-pill--red';
        }
        if (status === STATUS_DI.IRREPARABLE) return 'cf-pill--red';
        switch (sharedPhaseOfStatus(status)?.group) {
            case 'diagnostic':
            case 'repair':
                return 'cf-pill--green';
            case 'magasin':
            case 'admin':
                return 'cf-pill--amber';
            case 'closed':
                return 'cf-pill--green';
            default:
                return 'cf-pill--blue';
        }
    }

    formatDateTime(value: any): string {
        if (!value) return '—';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    formatTechName(tech: any): string {
        if (!tech) return 'N/A';
        if (typeof tech === 'string') return tech || 'N/A';
        return [tech.firstName, tech.lastName].filter(Boolean).join(' ') || 'N/A';
    }

    getAssignedDiagnosticTech(): string {
        const selected = this.formatTechName(this.selectedTechDiagModel);
        return selected !== 'N/A'
            ? selected
            : this.formatTableValueFallback(this.di?.techDiag);
    }

    getAssignedRepairTech(): string {
        return this.formatTableValueFallback(this.di?.techRep);
    }

    private formatTableValueFallback(value: any): string {
        const formatted = formatTableValue({ value }, 'value');
        return formatted && formatted !== '—' && formatted !== 'N/A' ? formatted : 'N/A';
    }

    /**
     * État d'une des 5 étapes du panneau « Contrôles par étape ».
     *
     * `current` est ce qui permet à la coordinatrice de repérer d'un coup d'œil
     * l'étape qui l'attend ; `skipped` distingue une étape RÉELLEMENT sautée
     * (DI sans composant, raccourci « retour sans pièces ») d'une étape pas
     * encore atteinte — les deux affichaient « En attente » auparavant.
     */
    getFlowStepState(step: CoordFlowStep): CoordFlowStepState {
        const status = this.di?.status;
        const afterDiagnostic = [
            STATUS_DI.PENDING2,
            STATUS_DI.PRICING,
            // Phase Approval documentaire (WAITING_DEVIS/WAITING_BC + legacy
            // ATTENTE_BC_DEVIS/NEGOTIATION1, base non migrée).
            ...APPROVAL_DOC_STATUS_VALUES,
            STATUS_DI.NEGOTIATION2,
            STATUS_DI.PENDING3,
            STATUS_DI.REPARATION,
            STATUS_DI.INREPARATION,
            STATUS_DI.FINISHED,
            // Terminal irréparable : le diagnostic EST fait (verdict non réparable).
            STATUS_DI.IRREPARABLE,
            STATUS_DI.RETOUR1,
            STATUS_DI.RETOUR2,
            STATUS_DI.RETOUR3,
        ];
        const afterAdmin = [
            STATUS_DI.PENDING3,
            STATUS_DI.REPARATION,
            STATUS_DI.INREPARATION,
            STATUS_DI.FINISHED,
            // Terminal irréparable : la phase admin est franchie (payant : facturé ;
            // non payant : clôturé) — la DI ne reviendra plus dans ce flux.
            STATUS_DI.IRREPARABLE,
            STATUS_DI.RETOUR1,
            STATUS_DI.RETOUR2,
            STATUS_DI.RETOUR3,
        ];
        // NB : IRREPARABLE n'est PAS dans `afterRepair` — l'équipement n'a jamais
        // été réparé, l'étape « réparation » ne doit pas s'afficher « faite ».
        const afterRepair = [STATUS_DI.FINISHED, STATUS_DI.RETOUR1, STATUS_DI.RETOUR2, STATUS_DI.RETOUR3];

        // Étape « en cours » = celle dont la FAMILLE contient le statut vivant.
        // La correspondance statut → famille n'est pas réécrite ici : elle vient
        // de `BASE_PHASES.group` (status-timeline.util), source unique partagée
        // avec le dossier détaillé — un statut legacy ou une variante `_Pause`
        // y est déjà rattaché à la bonne famille.
        const isCurrent = step === this.currentFlowStep;

        if (step === 'diagnostic') {
            if (afterDiagnostic.includes(status)) return 'done';
            return isCurrent ? 'current' : 'pending';
        }

        if (step === 'magasin') {
            // DI sans composant, ou raccourci « retour sans pièces » : la phase
            // magasin n'aura JAMAIS lieu — « sautée », pas « en attente ».
            if (this.componentStepSkipped || this.di?.needsDevisBeforeRepair) {
                return 'skipped';
            }
            if (
                this.magasinConfirmedAt ||
                this.componentConfirmedFromCoordinator === 'DEFAULT'
            ) {
                return 'done';
            }
            return isCurrent ? 'current' : 'pending';
        }

        if (step === 'admin') {
            // Raccourci « retour sans pièces » : tarification sautée aussi, la
            // coordinatrice envoie directement en réparation avec le devis.
            if (this.di?.needsDevisBeforeRepair) return 'skipped';
            if (this.adminSentAt || afterAdmin.includes(status)) return 'done';
            return isCurrent ? 'current' : 'pending';
        }

        if (step === 'closure') {
            if (status === STATUS_DI.FINISHED) return 'done';
            return isCurrent ? 'current' : 'pending';
        }

        if (afterRepair.includes(status)) return 'done';
        return isCurrent ? 'current' : 'pending';
    }

    /**
     * Famille de l'étape à laquelle appartient le statut courant, traduite dans
     * le vocabulaire des 5 étapes du modal. `closed` couvre à la fois la clôture
     * documentaire et les états terminaux (FINISHED / IRREPARABLE).
     */
    private get currentFlowStep(): CoordFlowStep | null {
        const status = this.di?.status;
        if (!status) return null;
        const group = sharedPhaseOfStatus(status)?.group;
        switch (group) {
            case 'diagnostic':
                return 'diagnostic';
            case 'magasin':
                return 'magasin';
            case 'admin':
                return 'admin';
            case 'repair':
                return 'repair';
            case 'closed':
                return 'closure';
            default:
                // CREATED, RETOUR1/2/3, ANNULER : hors des 5 étapes — aucune
                // n'est « en cours ».
                return null;
        }
    }

    getFlowStepLabel(step: CoordFlowStep): string {
        return COORD_FLOW_STEP_LABEL[this.getFlowStepState(step)];
    }

    getFlowStepIcon(step: CoordFlowStep): string {
        return COORD_FLOW_STEP_ICON[this.getFlowStepState(step)];
    }

    getFlowStepClass(step: CoordFlowStep): string {
        return `cf-step--${this.getFlowStepState(step)}`;
    }

    /**
     * Returns the formatted real DB timestamp for this step, or null if no
     * per-step timestamp exists in the document. The template uses *ngIf
     * to hide the line entirely when null — NO fabricated fallback.
     *
     * Step → DB field mapping:
     *   diagnostic → none stored per-step → always null (hidden)
     *   admin      → di.pricingRequestSentAt
     *   magasin    → di.componentsConfirmedAt
     *   repair     → none stored per-step → always null (hidden)
     *   closure    → di.statusUpdatedAt, mais SEULEMENT à FINISHED (sinon
     *                `statusUpdatedAt` daterait d'une transition sans rapport)
     *
     * Previously this method fell back to `di.updatedAt` for "done" steps,
     * which was misleading — updatedAt is the last write of ANY field,
     * not the moment the step completed.
     */
    getFlowTimestamp(step: CoordFlowStep): string | null {
        if (step === 'closure' && this.di?.status === STATUS_DI.FINISHED) {
            const at = this.di?.statusUpdatedAt || this.di?.updatedAt;
            return at ? this.formatDateTime(at) : null;
        }
        if (step === 'admin' && this.adminSentAt) {
            return this.formatDateTime(this.adminSentAt);
        }
        if (step === 'magasin' && this.magasinConfirmedAt) {
            return this.formatDateTime(this.magasinConfirmedAt);
        }
        return null;
    }

    getCoordinatorActionMode(): 'diagnostic' | 'repair' | 'none' {
        if (!this.diag_condition) return 'diagnostic';
        if (!this.rep_condition) return 'repair';
        return 'none';
    }

    assignTechnician(tech: any) {
        const mode = this.getCoordinatorActionMode();
        if (mode === 'diagnostic') {
            this.selectedTechDiag({ value: tech });
            return;
        }
        if (mode === 'repair') {
            this.selectedTechRep({ value: tech });
        }
    }

    getAssignButtonLabel(): string {
        const mode = this.getCoordinatorActionMode();
        if (mode === 'diagnostic') return 'Affecter diagnostic';
        if (mode === 'repair') return 'Affecter réparation';
        return 'Affectation indisponible';
    }

    getCurrentAssignmentStageLabel(): string {
        const mode = this.getCoordinatorActionMode();
        if (mode === 'diagnostic') return 'Diagnostic';
        if (mode === 'repair') return 'Réparation';
        return 'Aucune étape ouverte';
    }

    /**
     * Active DI count per technician, derived from the live diList (real DB
     * snapshot). Used for the availability badge and for filtering. Returns
     * 0 if we cannot match the tech (never null/undefined).
     */
    getTechActiveDiCount(tech: any): number {
        const name = this.formatTechName(tech).toLowerCase();
        if (!name || name === 'n/a') return 0;
        const activeStatuses = new Set([
            STATUS_DI.DIAGNOSTIC,
            'DIAGNOSTIC_Pause',
            STATUS_DI.INDIAGNOSTIC,
            STATUS_DI.REPARATION,
            'REPARATION_Pause',
            STATUS_DI.INREPARATION,
            STATUS_DI.PENDING1,
            STATUS_DI.PENDING3,
        ]);

        return (this.diList || []).filter((di) => {
            if (!activeStatuses.has(di?.status)) return false;
            const diagName = this.formatTableValueFallback(di?.techDiag).toLowerCase();
            const repName = this.formatTableValueFallback(di?.techRep).toLowerCase();
            return diagName === name || repName === name;
        }).length;
    }

    /**
     * Availability label derived strictly from real active DI count.
     * "Charge actuelle" fake percent was removed — only the bucket label
     * remains because it's computed from real data.
     */
    getTechLoadLabel(tech: any): string {
        const active = this.getTechActiveDiCount(tech);
        if (active <= 2) return 'Disponible';
        if (active <= 5) return 'Occupé';
        return 'Saturé';
    }

    getTechLoadClass(tech: any): string {
        const active = this.getTechActiveDiCount(tech);
        if (active <= 2) return 'sav-tech-status--available';
        if (active <= 5) return 'sav-tech-status--busy';
        return 'sav-tech-status--full';
    }

    /**
     * Returns the historical avg repair time in days for this tech, or
     * null if no FINISHED DI exists yet. Populated by fetchTechAvgRepair
     * from the existing dashboardTechLeaderboard query (Phase A backend).
     * The UI uses null to HIDE the field entirely.
     */
    getTechAvgRepairDays(tech: any): number | null {
        if (!tech?._id) return null;
        const v = this.techAvgRepairByTechId[tech._id];
        return typeof v === 'number' && v > 0 ? Math.round(v * 10) / 10 : null;
    }

    /**
     * Filtered tech list (search bar). Empty term → show all.
     */
    getFilteredTechList(): any[] {
        const term = (this.techSearchTerm || '').trim().toLowerCase();
        const list = this.techList || [];
        if (!term) return list;
        return list.filter((t) =>
            this.formatTechName(t).toLowerCase().includes(term),
        );
    }

    /**
     * True if `tech` is the already-assigned technician for the current
     * stage (diagnostic or repair). Used for the highlighted-card state.
     */
    isTechAssigned(tech: any): boolean {
        if (!tech) return false;
        const candidate = this.formatTechName(tech).toLowerCase();
        if (!candidate || candidate === 'n/a') return false;
        const mode = this.getCoordinatorActionMode();
        if (mode === 'diagnostic') {
            const sel = this.formatTechName(this.selectedTechDiagModel).toLowerCase();
            const fromDi = this.formatTableValueFallback(this.di?.techDiag).toLowerCase();
            return candidate === sel || candidate === fromDi;
        }
        if (mode === 'repair') {
            const fromDi = this.formatTableValueFallback(this.di?.techRep).toLowerCase();
            return candidate === fromDi;
        }
        return false;
    }

    /**
     * Dynamic phase model — drives the "État actuel du flow" timeline.
     * Always renders the 5 base phases (Diagnostic, Magasin, Administration,
     * Réparation, Clôture). Retour 1/2/3 are appended ONLY when the DI is
     * currently in or past that retour cycle, derived from `di.status` and
     * `di.ignoreCount` (real DB fields — no fabrication).
     */
    getFlowPhases(): Array<{
        key: string;
        label: string;
        number: number;
        icon: string;
        state: 'done' | 'current' | 'pending' | 'skipped';
        badgeLabel: string;
        timestamp: string | null;
    }> {
        const status = this.di?.status;
        const ignoreCount = Number(this.di?.ignoreCount ?? 0);
        const retourStatuses = ['RETOUR1', 'RETOUR2', 'RETOUR3'];
        const out: any[] = [];

        // Base phases
        this.BASE_PHASES.forEach((phase, idx) => {
            const state = this.computePhaseState(phase, status);
            out.push({
                key: phase.key,
                label: this.statusRaw(phase.key),
                number: idx + 1,
                icon: phase.icon,
                state,
                badgeLabel: this.computePhaseBadgeLabel(phase, status, state),
                timestamp: this.computePhaseTimestamp(phase.key, state),
            });
        });

        // Conditional retour phases — only show ones the DI has reached
        const isInRetour = retourStatuses.includes(status);
        const retourReached = Math.min(
            3,
            Math.max(
                ignoreCount,
                isInRetour ? retourStatuses.indexOf(status) + 1 : 0,
            ),
        );
        for (let i = 0; i < retourReached; i++) {
            const retourStatus = retourStatuses[i];
            const isCurrent = status === retourStatus;
            out.push({
                key: `retour${i + 1}`,
                label: `Retour ${i + 1}`,
                number: this.BASE_PHASES.length + i + 1,
                icon: 'pi pi-refresh',
                state: isCurrent ? 'current' : 'done',
                badgeLabel: this.statusRaw(retourStatus),
                timestamp: null,
            });
        }

        return out;
    }

    /** État d'une étape. L'état « franchie » (done) se déduit de la PRÉSENCE
     *  RÉELLE d'une entrée `statusHistory` (segment actif), PAS de la position
     *  dans l'ordre : le flux a des SAUTS légitimes (ex. aucun composant → saute
     *  le magasin), donc « avant dans l'ordre » ≠ « passée par là ».
     *   - current : statut courant ∈ étape ;
     *   - done    : une entrée d'historique existe pour cette étape ;
     *   - skipped : AUCUNE entrée mais l'étape est DERRIÈRE le statut courant
     *               (jamais atteinte — sautée) ;
     *   - pending : AUCUNE entrée et l'étape est DEVANT.
     *  Segment d'HISTORIQUE (retour, sans `statusHistory` par phase) : on retombe
     *  sur l'ordre (best-effort, pas de distinction « sautée »). */
    private computePhaseState(
        phase: { key: string; statuses: string[] },
        status: string,
        isActive: boolean = true,
    ): 'done' | 'current' | 'pending' | 'skipped' {
        return sharedComputePhaseState(
            this.sanitizedHistory(),
            phase,
            status,
            isActive,
        );
    }

    /** Le DERNIER statut de l'étape est-il AVANT le statut courant dans l'ordre
     *  canonique (donc l'étape est « derrière » le curseur) ? */
    private isPhaseBehindCurrent(
        phase: { statuses: string[] },
        status: string,
    ): boolean {
        return sharedIsPhaseBehind(phase, status);
    }

    private computePhaseBadgeLabel(
        _phase: { statuses: string[] },
        status: string,
        state: 'done' | 'current' | 'pending' | 'skipped',
    ): string {
        if (state === 'current') return this.statusRaw(status);
        if (state === 'done') return 'Terminé';
        if (state === 'skipped') return 'Sautée'; // jamais atteinte
        return 'En attente';
    }

    /** Date a phase was ENTERED, read from the SINGLE source of truth
     *  (`di.statusHistory`): the first history entry whose status belongs to the
     *  phase. Covers EVERY phase — including Diagnostic/Réparation, which had no
     *  dedicated date field before. Null when the DI has no matching history
     *  entry (legacy DIs that transited before statusHistory existed). */
    private phaseDateFromHistory(phaseKey: string): string | null {
        const phase = this.BASE_PHASES.find((p) => p.key === phaseKey);
        const hist: any[] = this.di?.statusHistory ?? [];
        if (!phase || !hist.length) return null;
        const entry = hist.find((h) => phase.statuses.includes(h?.status));
        return entry?.at ? this.formatDateTime(entry.at) : null;
    }

    private computePhaseTimestamp(
        phaseKey: string,
        state: 'done' | 'current' | 'pending' | 'skipped',
    ): string | null {
        // 'skipped' = jamais atteinte → aucune date (pas d'entrée statusHistory).
        if (state === 'pending' || state === 'skipped') return null;
        // Primary: the single-source transition history (every phase covered).
        const fromHistory = this.phaseDateFromHistory(phaseKey);
        if (fromHistory) return fromHistory;
        // Fallback for LEGACY DIs that transited before statusHistory existed
        // (no retroactive backfill possible — expected). The old ad-hoc fields
        // still cover admin/magasin/closure for those historical rows.
        if (phaseKey === 'admin' && this.adminSentAt) {
            return this.formatDateTime(this.adminSentAt);
        }
        if (phaseKey === 'magasin' && this.magasinConfirmedAt) {
            return this.formatDateTime(this.magasinConfirmedAt);
        }
        if (
            phaseKey === 'closed' &&
            state === 'current' &&
            this.di?.statusUpdatedAt
        ) {
            return this.formatDateTime(this.di.statusUpdatedAt);
        }
        return null;
    }

    /** `statusHistory` nettoyé + ordonné chronologiquement. Ignore les entrées
     *  malformées (statut non-string — ex. héritage du bug `:1493`) et les dates
     *  invalides, pour ne jamais planter le calcul d'écart. */
    private sanitizedHistory(): Array<{ status: string; at: Date }> {
        return sharedSanitizeHistory(this.di?.statusHistory);
    }

    /** Entrée d'historique d'ENTRÉE dans une phase = 1re entrée `statusHistory`
     *  dont le statut appartient à la phase. Source COMMUNE de la date ET de la
     *  valeur brute affichées (la MÊME entrée réellement stockée — aucun
     *  recalcul ; les valeurs legacy comme `NEGOTIATION1` sortent telles quelles). */
    private phaseEntry(phaseKey: string): { status: string; at: Date } | null {
        return sharedPhaseEntry(this.sanitizedHistory(), phaseKey);
    }

    /** Date brute d'ENTRÉE dans une phase = `at` de l'entrée d'historique. */
    private phaseEntryRawDate(phaseKey: string): Date | null {
        return this.phaseEntry(phaseKey)?.at ?? null;
    }

    /** Durée passée dans une phase, purement dérivée des `at` de `statusHistory`.
     *  - phase `done`    → jusqu'à l'entrée de la phase suivante atteinte (figé) ;
     *  - phase `current` → depuis l'entrée jusqu'à MAINTENANT (« en cours ») ;
     *  - `pending` / entrée absente / pas de borne → null (affiché « — »). */
    /** Millisecondes → durée humaine FR compacte : « 2 j 4 h », « 3 h 15 min »,
     *  « 12 min », « moins d'1 min ». La durée est un DELTA → indépendante du
     *  fuseau (l'instant courant = heure locale de la machine). */
    formatDuration(ms: number): string {
        return sharedFormatDuration(ms);
    }

    /** Footer card: human-readable current phase label. */
    getCurrentPhaseLabel(): string {
        const current = this.getFlowPhases().find((p) => p.state === 'current');
        return current ? current.label : 'N/A';
    }

    /** Footer card: last DB update — uses statusUpdatedAt (real per-status
     *  timestamp from the Phase 1 backend stagnation hook) with fallback to
     *  updatedAt. Returns 'N/A' if neither field exists. */
    getLastUpdateDisplay(): string {
        const ts = this.di?.statusUpdatedAt ?? this.di?.updatedAt;
        return ts ? this.formatDateTime(ts) : 'N/A';
    }

    /** Footer card: who created the DI (closest field we have in DB — no
     *  `lastModifiedBy` column exists; per safety rule we show N/A when
     *  the data isn't there rather than fabricate). */
    getModifiedByDisplay(): string {
        return this.formatTableValueFallback(this.di?.createdBy);
    }

    /** Tech card avatar — initials in a colored circle (stable per tech id).
     *  We don't have real photo URLs in DB; this is a derived display
     *  element, not a fake DB value. */
    getTechInitials(tech: any): string {
        const first = (tech?.firstName ?? '').trim()[0] ?? '';
        const last = (tech?.lastName ?? '').trim()[0] ?? '';
        const initials = (first + last).toUpperCase();
        if (initials) return initials;
        const name = this.formatTechName(tech);
        return (name[0] ?? '?').toUpperCase();
    }

    getTechAvatarColor(tech: any): string {
        const seed = tech?._id ?? this.formatTechName(tech);
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash << 5) - hash + seed.charCodeAt(i);
        }
        const palette = [
            '#3b82f6',
            '#8b5cf6',
            '#f59e0b',
            '#10b981',
            '#ef4444',
            '#06b6d4',
        ];
        return palette[Math.abs(hash) % palette.length];
    }

    getTechRoleDisplay(tech: any): string {
        return tech?.role && typeof tech.role === 'string' ? tech.role : 'N/A';
    }

    /**
     * Pull avg repair days per tech from the existing leaderboard query.
     * No new backend endpoint — reuses Phase A's dashboardTechLeaderboard.
     * All-time window (no date filter). Failure is silent (degrades to
     * "field hidden" for every tech) — capture happens server-side.
     */
    private fetchTechAvgRepair() {
        this.techAvgRepairByTechId = {};
        this.apollo
            .query<{
                dashboardTechLeaderboard: Array<{
                    techId: string;
                    tatMoyenJours: number;
                    nbDiClotures: number;
                }>;
            }>({
                query: gql`
                    query DashboardTechLeaderboardForModal($limit: Int) {
                        dashboardTechLeaderboard(limit: $limit) {
                            techId
                            tatMoyenJours
                            nbDiClotures
                        }
                    }
                `,
                variables: { limit: 100 },
                fetchPolicy: 'no-cache',
            })
            .subscribe({
                next: ({ data }) => {
                    const rows = data?.dashboardTechLeaderboard ?? [];
                    const map: Record<string, number> = {};
                    for (const r of rows) {
                        // Only keep techs with at least one FINISHED DI — otherwise
                        // `tatMoyenJours` would be 0 and the UI would mislead.
                        if (r?.nbDiClotures > 0 && typeof r.tatMoyenJours === 'number') {
                            map[r.techId] = r.tatMoyenJours;
                        }
                    }
                    this.techAvgRepairByTechId = map;
                },
                error: () => {
                    // Silent — UI will hide the "Temps moyen réparation" tile
                    // for every tech, which is the correct N/A behavior.
                    this.techAvgRepairByTechId = {};
                },
            });
    }

    getModalInfoValue(field: 'id' | 'client' | 'location' | 'status'): string {
        if (field === 'id') return this.di?._idnum || this.di?._id || 'N/A';
        if (field === 'client') {
            const company = this.formatTableValueFallback(this.di?.company_id);
            if (company !== 'N/A') return company;
            return this.formatTableValueFallback(this.di?.client_id);
        }
        if (field === 'location') {
            return (
                this.di?.location_name ||
                this.formatTableValueFallback(this.di?.location_id)
            );
        }
        return this.di?.status || 'N/A';
    }

    showDialogForPricing() {
        this.pricingDoalog = true;
    }

    getSeverity(status: string) {
        switch (status) {
            case 'CREATED':
                return 'success';
            case 'PENDING1':
            case 'PENDING2':
            case 'PENDING3':
                return 'help';
            case 'DIAGNOSTIC':
            case 'INDIAGNOSTIC':
                return 'info';
            case 'CONFIRMATION':
            case 'PROCESSING':
            case 'MagasinEstimation':
                return 'warning';
            case 'PRICING':
            case 'PRICING_DIAG':
                return 'warning';
            case 'WAITING_DEVIS':
            case 'WAITING_BC':
            case 'NEGOTIATION1':
            case 'ATTENTE_BC_DEVIS':
            case 'NEGOTIATION2':
                return 'warning';
            case 'REPARATION':
            case 'INREPARATION':
                return 'info';
            case 'FINISHED':
                return 'success';
            case 'IRREPARABLE':
                return 'danger';
            case 'ANNULER':
                return 'contrast';
            case 'RETOUR1':
            case 'RETOUR2':
            case 'RETOUR3':
                return 'danger';
            default:
                return 'warn';
        }
    }

    hideDialog() {
        this.diDialog = false;
    }

    getLogsDi(_id: string) {
        return this.apollo
            .query<any>({ query: this.ticketSerice.getLogsDi(_id) })
            .toPromise()
            .then(({ data }) => data?.getAllLogsByDi || []);
    }

    getLogsData(_id: string) {
        return this.apollo
            .query<any>({ query: this.ticketSerice.getLogsPause(_id) })
            .toPromise()
            .then(({ data }) => data?.getStatByIdlogs || []);
    }

    /** Idem ticket-list : recharge la liste après une édition ADMIN_TECH. */
    onDiUpdatedFromModal(): void {
        this.ticketRefreshService.requestRefresh('coordinator-list', {
            source: 'di-info-modal:updated',
        });
    }

    openTicketDetails(data: any) {
        Promise.all([this.getLogsDi(data._id), this.getLogsData(data._id)])
            .then(([logsDi, pauseLogs]) => {
                this.ticketData = {
                    data: { ...data },
                    pauseLogs: { ...pauseLogs },
                    logsDi: { ...logsDi },
                };
                console.log(data, 'dtatatatata');
                if (data.ignoreCount >= 1) {
                    this.retour1InfoFromLogs = logsDi[0];
                }
                if (data.ignoreCount >= 2) {
                    this.retour2InfoFromLogs = logsDi[1];
                }
                if (data.ignoreCount >= 3) {
                    this.retour3InfoFromLogs = logsDi[2];
                }

                this.ignoreCountForBtns = data.ignoreCount;
                console.log(data.ignoreCount, 'ignoreCountignoreCount');

                this.ticketDetailsInfo = true;
                this.techInfo = { ...pauseLogs };
                console.log('data inside sknder =>', this.ticketData.data);
                console.log(data, 'all the data needed here');
            })
            .catch((error) => {
                console.error('Error fetching logs:', error);
            });
    }

    changeStatusRepaire(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusRepaire(_id),
                useMutationLoading: true,
            })
            .subscribe(() => {});
    }

    sendDiToDiag(selectedDi, dataId, selectedDiLocation) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.sendingDiForDiagnostic(
                    selectedDi,
                    dataId,
                    selectedDiLocation,
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;

                if (data) {
                    this.apollo
                        .mutate<TechStartDiagnosticMutationResponse>({
                            mutation:
                                this.ticketSerice.changeStatusDiToDiagnostique(
                                    this.selectedDi,
                                ),
                            useMutationLoading: true,
                        })
                        .subscribe(({ loading }) => {
                            this.isLoading = loading;

                            this.loadData();
                            console.log('🥪 emit');
                        });
                    this.diDialog = false;
                    this.selectedTechDiagModel = null;
                    console.log('emitter');

                    this.notify.success('La DI a été envoyée au technicien.');
                }
            });
    }

    selectedTechDiag(data) {
        console.log('slected tech for diagnostic');
        this.confirm.confirmValidate({
            message: 'Confirmer ce technicien pour le diagnostic ?',
            header: 'Affectation du technicien',
            acceptLabel: 'Affecter',
            accept: () => {
                this.sendDiToDiag(
                    this.selectedDi,
                    data.value._id,
                    this.selectedDiLocation,
                );
            },
        });
    }

    selectedTechRep(data) {
        console.log('select tech for rep');
        this.confirm.confirmValidate({
            message: 'Confirmer ce technicien pour la réparation ?',
            header: 'Affectation du technicien',
            acceptLabel: 'Affecter',
            accept: () => {
                this.apollo
                    .mutate<ConfigRepAffectationMutationResponse>({
                        mutation: this.ticketSerice.configRepAffectation(
                            this.selectedDi,
                            data.value._id,
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;

                        if (data) {
                            this.changeStatusRepaire(this.selectedDi);
                            this.loadData();
                            this.diDialog = false;
                        }
                    });
            },
        });
    }

    /** Raccourci « retour sans pièces » : PDF déposé → data-URL base64 mémorisée
     *  (PAS d'upload immédiat : le devis part avec l'envoi en réparation). */
    onRepairDevisDrop(file: File) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            this.repairDevisBase64 = reader.result as string;
            this.repairDevisName = file.name;
        };
        reader.onerror = () => {
            this.repairDevisBase64 = null;
            this.repairDevisName = null;
            this.notify.error(
                'Le PDF n’a pas pu être préparé.',
                { summary: 'Fichier non chargé' },
            );
        };
        reader.readAsDataURL(file);
    }

    /** Envoi en réparation avec devis joint — UN SEUL geste (mutation
     *  coordinatorSendToRepairWithDevis : devis + affectation tech + REPARATION).
     *  Bloqué si le technicien ou le devis manque (double garde front + back). */
    sendToRepairWithDevis() {
        const techId = this.selectedRepTechForDevis?._id;
        if (!techId || !this.repairDevisBase64) {
            this.notify.warn(
                'Sélectionnez un technicien et joignez le devis.',
                { summary: 'Envoi impossible' },
            );
            return;
        }
        if (this.sendingRepairWithDevis) return;

        this.confirm.confirmSend({
            message: 'Envoyer en réparation avec le devis joint ? Le magasin et la ' +
                'tarification ont été sautés (retour sans pièces).',
            header: 'Envoyer en réparation',
            accept: () => {
                this.sendingRepairWithDevis = true;
                this.apollo
                    .mutate<any>({
                        mutation:
                            this.ticketSerice.coordinatorSendToRepairWithDevis(
                                this.selectedDi,
                                techId,
                                this.repairDevisBase64,
                            ),
                        useMutationLoading: true,
                    })
                    .subscribe({
                        next: ({ data }) => {
                            if (data) {
                                this.notify.success(
                                    'Devis joint et technicien affecté.',
                                    { summary: 'Envoyée en réparation' },
                                );
                                this.selectedRepTechForDevis = null;
                                this.repairDevisBase64 = null;
                                this.repairDevisName = null;
                                this.loadData();
                                this.diDialog = false;
                            }
                            this.sendingRepairWithDevis = false;
                        },
                        error: (err) => {
                            this.sendingRepairWithDevis = false;
                            this.notify.error(
                                err?.message ??
                                    'La réparation n’a pas pu être lancée.',
                                { summary: 'Envoi échoué' },
                            );
                        },
                    });
            },
        });
    }

    changestatusToPricing(_data) {
        this.confirm.confirmSend({
            message: "Envoyer aux administrateurs pour l'affectation du prix ?",
            accept: () => {
                if (this.adminSentAt || this.pricingRequestInFlight) {
                    return;
                }
                this.pricingRequestInFlight = true;
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.sendDiToAdminsForPricing(
                            this.di._id,
                        ),
                    })
                    .pipe(finalize(() => (this.pricingRequestInFlight = false)))
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;

                        if (data?.sendDiToAdminsForPricing) {
                            const updated = data.sendDiToAdminsForPricing;
                            this.adminSentAt = updated.pricingRequestSentAt;
                            this.di = { ...this.di, ...updated };
                            this.loadData();
                        }
                    });
            },
        });
    }

    gotcomposantfromMagasin() {
        this.confirm.confirmValidate({
            message: 'Confirmer les composants de cette DI ?',
            header: 'Confirmation des composants',
            accept: () => {
                if (this.magasinConfirmedAt || this.componentsConfirmInFlight) {
                    return;
                }
                this.componentsConfirmInFlight = true;
                this.apollo
                    .mutate<any>({
                        mutation:
                            this.ticketSerice.confirmDiComponents(
                                this.di._id,
                            ),
                    })
                    .pipe(
                        finalize(() => (this.componentsConfirmInFlight = false)),
                    )
                    .subscribe({
                        next: ({ data, loading }) => {
                            this.isLoading = loading;

                            if (data?.confirmDiComponents) {
                                const updated = data.confirmDiComponents;
                                this.componentConfirmedFromCoordinator =
                                    updated.handleSendingNotificationBetweenCoordinatorAndMagasin;
                                this.magasinConfirmedAt =
                                    updated.componentsConfirmedAt;
                                this.di = { ...this.di, ...updated };
                                this.loadData();
                                this.reperationCondition = true;
                                this.notify.success(
                                    'La réception des composants a été confirmée.',
                                    { summary: 'Composants confirmés' },
                                );
                            }
                        },
                        // Plus d'échec silencieux : toute erreur de la mutation
                        // (garde back, transition refusée…) remonte un toast avec
                        // le message serveur au lieu de ne rien faire.
                        error: (err) => {
                            this.isLoading = false;
                            this.notify.error(
                                err?.message ??
                                    'La confirmation des composants a échoué.',
                                { summary: 'Échec de la confirmation' },
                            );
                        },
                    });
            },
        });
    }

    sendRequestToMagasin() {
        console.log(' this.selectedDi', this.selectedDi);
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.confirmComposant(
                    this.selectedDi,
                    'CONFIRM',
                ),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;

                if (data) {
                    console.log('🎂[data]:', data);
                    this.isConfirmed =
                        data.confirmationComposant.confirmationComposant;
                    console.log('🍰[this.isConfirmed]:', this.isConfirmed);
                }
            });
    }
}
