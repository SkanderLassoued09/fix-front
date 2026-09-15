import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Product } from 'src/app/demo/api/product';

import {
    PrimeNGConfig,
} from 'primeng/api';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
import { STATUS_DI, isClosingStatus } from 'src/app/layout/api/status-di';
import {
    FormControl,
    FormGroup,
    Validators,
} from '@angular/forms';
import {
    CreateDiMutationResult,
    DiQueryResult,
    GetClientsQueryResult,
    GetCompaniesQueryResult,
} from './ticket-list.interface';
import * as FileSaver from 'file-saver';
import { NotificationService } from 'src/app/demo/service/notification.service';
import { PageEvent } from '../../profile/profile-list/profile-list.interfaces';
import {
    debounceTime,
    distinctUntilChanged,
    map,
    Subject,
    switchMap,
    tap,
    finalize,
    takeUntil,
} from 'rxjs';
import { environment } from 'src/environments/environment';
import { TicketRefreshService } from 'src/app/demo/service/ticket-refresh.service';
import { ActivatedRoute, Router } from '@angular/router';
import { DiDetailService } from 'src/app/demo/service/di-detail.service';
import { DiFilesService } from 'src/app/demo/service/di-files.service';
import { DeepLinkConsumer } from 'src/app/demo/service/deep-link-consumer';
import { canOpenApproval } from '../shared/di-approval.eligibility';
import { canAffectFiles } from '../shared/di-files-modal/di-files.eligibility';
import {
    formatTableValue,
    isLocationColumn,
    isEmplacementVide as isEmplacementVideUtil,
    trackByColumn,
} from '../table-display.utils';
import { applyChartTheme } from '../../../../shared/chart-theme';
import { LayoutService } from '../../../../layout/service/app.layout.service';
import { NotifyService } from '../../../../shared/ui/notify.service';
import { ConfirmService } from '../../../../shared/ui/confirm.service';

/**
 * ⚙️ INTERRUPTEUR TEMPORAIRE — PV de réunion après un Retour.
 *
 * `false` → confirmer un Retour n'ouvre PLUS le modal « Nouvelle réunion »
 * (`app-reunion-pv-modal`, mode `retour`) ; un toast de succès confirme le
 * retour à la place. La transition elle-même ne dépend pas du PV. Le code du
 * modal et la création manuelle depuis la page Réunions restent intacts.
 *
 * ▶️ POUR RÉACTIVER : repasser cette constante à `true` (une seule ligne).
 */
const REUNION_PV_ON_RETOUR_ENABLED = false;

@Component({
    selector: 'app-ticket-list',
    standalone: false,
    templateUrl: './ticket-list.component.html',
    styleUrl: './ticket-list.component.scss',
})
export class TicketListComponent implements OnInit, OnDestroy {
    private companySearch$ = new Subject<string>();
    // Filtres de colonnes CUMULATIFS : searchKey → valeur saisie (trimée).
    private columnFilters: Record<string, string> = {};
    private searchSubject$ = new Subject<void>();
    private destroy$ = new Subject<void>();
    /** Jeton anti-réponse périmée : seule la DERNIÈRE requête de `loadData`
     *  (recherche, pagination, notification) peut écrire la liste. */
    private loadSeq = 0;

    baseUrl = environment.apiUrl;

    /**
     * Resolve a stored document reference into an openable href. Drive uploads
     * now store an absolute `webViewLink` (opened as-is, in a new tab); a freshly
     * picked file is a `data:` URL; any other value is treated as a legacy local
     * name under the API root. Used by every "Voir" link.
     */
    docHref(value?: string | null): string {
        if (!value) return '';
        return /^https?:\/\//i.test(value) || value.startsWith('data:')
            ? value
            : this.baseUrl + value;
    }

    ticketSelected: any;
    openUpdateModal: boolean = false;
    isBCUploaded: boolean = false;
    isDevisUploaded: boolean = false;
    ticketData: any;
    rangeDate: any[] = [];
    // Used for the mini Dashboard
    counterInMagasin = 0;
    counterInDiagnostique = 0;
    counterInReperation = 0;
    counterPending = 0;
    counterRetour = 0;

    bcLoading: boolean = false;
    devisLoading: boolean = false;

    creationDiForm = new FormGroup({
        title: new FormControl('', [
            Validators.required,
            Validators.pattern(/^[a-zA-Z0-9\s]+$/),
        ]),
        description: new FormControl('', [Validators.required]),
        typeClient: new FormControl(),
        status: new FormControl(),
        client_id: new FormControl(),
        company_id: new FormControl(),
        nSerie: new FormControl(),
        category: new FormControl(),
        location: new FormControl(),
        remarqueManager: new FormControl(),
        // Diagnostic payant (défaut OUI = payant) + estimation prix diagnostic
        // (saisie uniquement si payant ; pré-remplit la tarification).
        diagnosticPayant: new FormControl(true),
        diagnosticEstimate: new FormControl(null),
    });
    /** Modal « Modifier la DI » — mêmes champs que `creationDiForm`, sans le
     *  statut (il a ses propres boutons). */
    updateDiForm = new FormGroup({
        title: new FormControl('', [Validators.required]),
        description: new FormControl('', [Validators.required]),
        nSerie: new FormControl(),
        location: new FormControl(),
        typeClient: new FormControl('CLIENT'),
        client_id: new FormControl(),
        company_id: new FormControl(),
        remarqueManager: new FormControl(),
        diagnosticPayant: new FormControl(true),
        diagnosticEstimate: new FormControl(null),
    });
    tarif_Techs = new FormGroup({
        tarifFromAdmin: new FormControl(),
    });
    categoryForm = new FormGroup({
        categoryName: new FormControl(),
    });
    locationForm = new FormGroup({
        locationName: new FormControl(),
    });
    composantCategoryForm = new FormGroup({
        composantCategoryName: new FormControl(),
    });
    pricesLogs: any[];
    statuses = [
        { label: 'Created', value: 'CREATED' },
        { label: 'Pending1', value: 'PENDING1' },
        { label: 'Diagnostic', value: 'DIAGNOSTIC' },
        { label: 'Indiagnostic', value: 'INDIAGNOSTIC' },
        { label: 'CONFIRMATION', value: 'CONFIRMATION' },
        { label: 'Pending2', value: 'PENDING2' },
        { label: 'PRICING', value: 'PRICING_DIAG' },
        // Approval split en deux gates documentaires (recherche back par regex).
        { label: 'Approval — attente devis', value: 'WAITING_DEVIS' },
        { label: 'Approval — attente BC', value: 'WAITING_BC' },
        { label: 'Negotiation2', value: 'NEGOTIATION2' },
        { label: 'Pending3', value: 'PENDING3' },
        { label: 'Reparation', value: 'REPARATION' },
        { label: 'Inreparation', value: 'INREPARATION' },
        // Clôture split en deux gates documentaires.
        { label: 'Clôture — attente BL', value: 'WAITING_BL' },
        { label: 'Clôture — attente facture', value: 'WAITING_FACTURE' },
        { label: 'Finished', value: 'FINISHED' },
        { label: 'Irréparable', value: 'IRREPARABLE' },
        { label: 'Annuler', value: 'ANNULER' },
        { label: 'Retour1', value: 'RETOUR1' },
        { label: 'Retour2', value: 'RETOUR2' },
        { label: 'Retour3', value: 'RETOUR3' },
    ];

    files = [];

    totalSize: number = 0;

    totalSizePercent: number = 0;
    sizes = [
        { name: 'Small', class: 'p-datatable-sm' },
        { name: 'Normal', class: '' },
        { name: 'Large', class: 'p-datatable-lg' },
    ];
    openAddDiModal: boolean = false;
    openCategoryModal: boolean = false;
    openLocationsModal: boolean = false;
    openPriceTechModal: boolean = false;
    // Unified Relations & Structure modal — supersedes the standalone
    // "Catégories DI" and "Emplacements" modals. Tabs:
    //   0 = Emplacements (location CRUD + DI reassignment)
    //   1 = Catégories DI (category CRUD + linked-DI count)
    //   2 = Catégories Composants (component-category CRUD)
    openRelationsModal: boolean = false;
    relationsActiveTabIndex: number = 0;
    composantCategoryList: Array<{
        _id: string;
        category_composant: string;
    }> = [];
    composantsForCategoryCount: Array<{
        _id: string;
        category_composant_id: string | null;
    }> = [];
    composantsForReassignment: Array<{
        _id: string;
        name: string;
        package?: string;
        category_composant_id: string | null;
    }> = [];
    relationsLoading: boolean = false;
    reassigningDiId: string | null = null;
    reassigningCategoryDiId: string | null = null;
    reassigningComposantId: string | null = null;
    /** DI rows recently modified via the Relations modal — used to flash
     *  a brief highlight in the table. Cleared automatically. */
    recentlyModifiedDiIds = new Set<string>();
    recentlyModifiedComposantIds = new Set<string>();
    colComposantCategory = [
        { field: 'category_composant', header: 'Nom' },
        { field: 'linkedComposants', header: 'Composants liés' },
    ];
    colRelationsDi = [
        { field: '_idnum', header: 'DI' },
        { field: 'title', header: 'Titre' },
        { field: 'currentLocation', header: 'Emplacement' },
        { field: 'di_category_id', header: 'Catégorie DI' },
        { field: 'status', header: 'Status' },
    ];

    radioBtn;
    selectedStatusDefault;
    stateOptions: any[] = [
        { label: 'Sauvgarder', value: 'CREATED' },
        { label: 'Sauvgarder et envoyer', value: 'PENDING1' },
    ];
    statusDefault = [
        { name: 'sans affecter au coordinateur', code: 'CREATED' },
        { name: 'Affecter au coordinateur', code: 'PENDING1' },
    ];
    products!: Product[];
    loading: boolean = false;
    roles;
    tstatuses = [{ label: 'Pending3', value: 'Pending3' }];

    ingredient;
    uploadedFiles: any[] = [];
    cols = [
        { field: '_idnum', header: 'ID', searchKey: '_idnum' },
        { field: 'title', header: 'Titre', searchKey: 'title' },
        { field: 'location_name', header: 'Location', searchKey: 'location' },
        { field: 'status', header: 'Status', searchKey: 'status' },
        { field: 'company_id', header: 'Company', searchKey: 'company' },
        { field: 'client_id', header: 'Client', searchKey: 'client' },
        { field: 'createdBy', header: 'Créer par', searchKey: 'createdBy' },
        { field: 'techDiag', header: 'Diagnostique', searchKey: 'techDiag' },
        { field: 'techRep', header: 'Reparation', searchKey: 'techRep' },
    ];

    colCategory = [{ field: 'category_name', name: 'Name' }];

    colEmplacement = [
        { field: 'location_name', name: 'Emplacement' },
        { field: 'storedDiCount', name: 'DI stockées' },
    ];

    diList: any[];
    diListCount: any;
    statusDI: STATUS_DI = STATUS_DI.CREATED;
    clientListDropDown: any;
    companiesListDropDown: any;
    loadingCreatingDi: boolean;
    pricingModal: boolean = false;
    discountPercent: number = 0;
    totalComposant: any;
    array_composants: any;
    _idDi: any;
    price: number;
    /** F1 — diagnostic payant + estimation de création, lus à l'ouverture du
     *  modal de tarification. Non payant → prix diagnostic désactivé, plancher
     *  150 non requis, aucune facturation (garde back en renfort). */
    pricingDiagnosticPayant = true;
    pricingDiagnosticEstimate: number | null = null;
    /** « Estimation réparation » saisie dans le modal de tarification
     *  diagnostic. Champ dédié (persisté via setRepairEstimate), optionnel —
     *  sert à comparer l'estimé au prix réel de réparation plus tard. */
    repairEstimate: number;
    seletedRow: any;
    discountedPriceNeg: number = 0;
    /** Estimation de réparation du CYCLE COURANT, relue pour les modales
     *  « Affectation du prix final ». Champ DISTINCT de `repairEstimate`, qui
     *  n'est alimenté que par le modal de tarification (`showDialogForPricing`)
     *  et porterait donc, ici, la valeur d'une DI ouverte précédemment. */
    negoRepairEstimate: number | null = null;
    /** `final_price` DÉJÀ persisté pour le cycle. Seul cas utile : diagnostic
     *  NON PAYANT, où le back a calculé le total serveur-autoritaire
     *  (réparation + main-d'œuvre diagnostic + pièces) dès la tarification. */
    negoServerFinalPrice: number | null = null;
    slideEnd: any;
    slideAdminEnd: any;
    negocite1Modal: boolean;
    negocite2Modal: boolean = false;
    s: any;
    secondNegocition: any;
    slectedRow: any;
    exportColumns: any;
    selectedSize;
    data_discount: DiQueryResult;
    dataById: any;
    finalPrice: any;
    // `allComposants` / `number_total_composant` / `composantQuantity` :
    // pipeline mort supprimé (2026-07-22) — N requêtes findOneComposant par
    // ouverture du modal pricing pour des valeurs jamais lues (ni .ts ni
    // template), avec en prime une course (length lu avant les réponses).
    name_composant: any;
    ArrayofcomposantDATA: DiQueryResult;
    oneComposant_QueryValue: DiQueryResult;
    $composant: any;
    current_id: any;
    timeDiagnostique: string;
    ignoreCount: any;
    tarif_Tech: number;
    allCategoryDiArray: any;
    locationDropDown: any[];
    categorieDiListDropDown: any[];
    timepart: { hours: any; minutes: any; seconds: any };
    facturationDiagnostique: number = 0;
    tarif_Technicien: number;
    payload: { file: string } = { file: '' };
    /** File staged in the create-DI image drag & drop zone (controlled value). */
    imageDropFile: File | null = null;

    ticketDetailsInfo: boolean;
    /** DI ouverte dans « Modifier la DI » — lue seulement : la saisie vit dans
     *  `updateDiForm`, la ligne du tableau n'est jamais mutée. */
    selectedTicket: any;
    updateticketView: boolean;
    /** Input du formulaire à l'ouverture : seuls les écarts sont envoyés. */
    private editBaseline: Record<string, any> = {};
    /** Photo de remplacement déposée (valeur contrôlée de la dropzone) et sa data-URL. */
    editImageDropFile: File | null = null;
    editImagePayload = '';
    savingEditDi = false;
    selectedRowInNegociate1: any;
    selectedRowInNegociate2: any;
    first: number = 0;
    rows: number = 10;
    page: any;
    uploadFileLoading: boolean;
    statusCount: any[];
    basicOptions: any;
    basicData: any;
    selectedBc: any;
    selectedDevis: any;
    ignoreCountNeg1: any;
    logsDi: any;
    isErrorFromFixtronix: any;
    ignoreCountPricing: number;
    /** Retour cycle # for the price-final modal banner (0 = original flow);
     *  set by every method that opens that modal so the badge is never stale. */
    pricingModalIgnoreCount: number = 0;
    instantSelectedBc: string;
    instantSelectedDevis: string;
    ignoreCountN1: any;
    bcUploaded: boolean;
    devisUploaded: boolean;
    initialPriceAffichage: any;
    priceRemiseAffichage: any;
    remiseAffichage: any;
    retourNumberAffichage: any;
    devisBtnDisabled: boolean = false;
    bcBtnDisabled: boolean = false;
    factureBtnDisabled: boolean = false;
    blBtnDisabled: boolean = false;
    enregistrerBcBtncondition: boolean = true;
    enregistrerDevisBtncondition: boolean = true;

    // La modale « Affectation des Fichiers » a été EXTRAITE dans le composant
    // partagé `app-di-files-modal` (demo/components/ticket/shared/di-files-modal),
    // monté globalement dans `app.component.html` et piloté par `DiFilesService`.
    // Raison : la notification BL doit pouvoir l'ouvrir depuis n'importe quelle
    // page et pour n'importe quel rôle destinataire — la coordinatrice n'a pas
    // accès à cette liste, et la DI visée n'est presque jamais dans les 10
    // lignes chargées. Le bouton trombone passe désormais par le service.
    /** Coût total = facturation diagnostic + total composants. Single source
     *  of truth for the marge calc + chip multipliers. Components may be null
     *  while the modal is still loading; coerce to 0 so the UI shows 0,000 TND
     *  rather than NaN. */
    get pricingCoutTotal(): number {
        const f = Number(this.facturationDiagnostique) || 0;
        const c = Number(this.totalComposant) || 0;
        return f + c;
    }

    // NB: l'ancien indicateur « Marge sur le coût théorique » (getter
    // `pricingEcart`) a été RETIRÉ : il comparait le PRIX du diagnostic au coût
    // (main-d'œuvre diag + pièces RÉPARATION), une base incohérente qui affichait
    // des pourcentages absurdes (ex. +13 433 %). Les boutons de majoration
    // (+10/+20/+25) et le clamp associé ont été retirés pour la même raison.

    /** Gating for "Confirmer le prix final": both BC and Devis must be present
     *  (already persisted OR uploaded in this session). Same rule applies to
     *  négo1 and négo2 — no bypass per spec. */
    get bcReady(): boolean {
        return !!(this.selectedBc || this.instantSelectedBc);
    }
    get devisReady(): boolean {
        return !!(this.selectedDevis || this.instantSelectedDevis);
    }
    /** Séquence Approval documentaire : le BC ne peut être chargé qu'APRÈS le
     *  devis. Le grisage ci-dessous n'est QUE du confort — la vraie garde est
     *  côté back (`addBCPDF` refuse sans devis, même en appel API direct).
     *  Verrouillé tant que le devis (persisté OU chargé dans la session) est
     *  absent — même notion que `devisReady`. */
    get bcUploadLocked(): boolean {
        return !this.devisReady;
    }
    /** Diagnostic NON PAYANT du cycle courant. Lu UNIQUEMENT sur la DI courante
     *  (getDiById.di ou la ligne du modal négociation 2), JAMAIS sur
     *  `pricingDiagnosticPayant` — fixé par le modal de tarification et jamais
     *  remis à zéro ici → risque de valeur périmée d'une DI précédente. */
    get negoNonPayant(): boolean {
        return (
            this.dataById?.getDiById?.di?.diagnosticPayant === false ||
            this.selectedRowInNegociate2?.diagnosticPayant === false
        );
    }

    /** Base de la remise dans les modales « Affectation du prix final ».
     *
     *  - NON PAYANT : le back a déjà calculé ET persisté un total
     *    serveur-autoritaire (réparation + main-d'œuvre diagnostic + pièces,
     *    cf. `setRepairFinalPrice`) — c'est LUI la base. Le recomposer ici
     *    donnerait un montant différent (`price` vaut 0 dans ce cas).
     *  - Sinon : prix du diagnostic facturé + estimation de réparation, les
     *    deux montants saisis à l'étape précédente (modal de tarification).
     *
     *  `negoRepairEstimate` est absent pour une DI IRRÉPARABLE (champ masqué en
     *  tarification) → la base retombe sur le seul prix du diagnostic. */
    get negoBaseAmount(): number {
        if (this.negoNonPayant) {
            const serverTotal = Number(this.negoServerFinalPrice);
            if (Number.isFinite(serverTotal) && serverTotal > 0)
                return serverTotal;
        }
        const diag = Number(this.price);
        const rep = Number(this.negoRepairEstimate);
        return (
            Math.round(
                ((Number.isFinite(diag) ? diag : 0) +
                    (Number.isFinite(rep) ? rep : 0)) *
                    1000,
            ) / 1000
        );
    }

    get prixFinalCanConfirm(): boolean {
        // Un diagnostic facturé à 0 est légitime PARTOUT (flux original, retour,
        // irréparable) : seul un prix ABSENT bloque « Confirmer le prix final »
        // (sinon une DI tarifée à 0 resterait bloquée après l'upload devis + BC).
        // Diagnostic NON PAYANT : aucun prix de diagnostic exigé.
        const price = this.toMoney(this.price);
        const priceOk = this.negoNonPayant || (price != null && price >= 0);
        return this.bcReady && this.devisReady && priceOk && !this.isLoading;
    }

    /** Normalise un montant venant de GraphQL. `null`/`undefined`/`''` →
     *  `null` (absent), afin de pouvoir enchaîner les sources avec `??`.
     *  ATTENTION : `Number(null) === 0`, un test de finitude seul ferait donc
     *  passer un champ absent pour un montant nul — or `0` est une valeur
     *  LÉGITIME (diagnostic non payant). D'où le test d'absence explicite. */
    toMoney(value: any): number | null {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    /** Montant d'un cycle PASSÉ (historique du modal de tarification) : une
     *  absence s'affiche comme telle, jamais « 0,000 TND » — `formatTnd3(null)`
     *  rend 0,000 puisque `Number(null) === 0`. */
    formatCycleMoney(value: number | null | undefined): string {
        return value === null || value === undefined
            ? 'Non renseigné'
            : this.formatTnd3(value);
    }

    /** `remarque_tech_diagnostic` tel que composé par le technicien
     *  (`description\n\nRemarque technicien :\nremarque`, cf.
     *  `composeRemarqueDiagnostic` de tech-di-list), redécoupé en deux parties
     *  lisibles. Une note sans séparateur reste entière dans `description`. */
    get pricingTechNote(): { description: string; remarque: string | null } | null {
        const raw = String(this.seletedRow?.remarque_tech_diagnostic ?? '').trim();
        if (!raw) return null;
        const [description, ...rest] = raw.split(/\s*Remarque technicien\s*:\s*/i);
        const remarque = rest.join(' ').trim();
        return { description: description.trim(), remarque: remarque || null };
    }

    /** TND with 3 decimals, fr-TN locale ("X XXX,XXX TND"). Falsy → "—". */
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

    /** Comme `formatTnd3` mais sans le suffixe « TND » — pour les mini-tuiles
     *  (Temps / Facturé / Pièces) de la bande d'info du modal de tarification. */
    formatNum3(value: any): string {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return n.toLocaleString('fr-TN', {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
        });
    }

    // ── Tarification diagnostic (redesign « Tarification diagnostic.dc.html ») ──
    // Deux questions gardées : coût RÉEL du diagnostic (borné 150–500 TND) et
    // estimation de la réparation (désormais OBLIGATOIRE, > 0). Les getters
    // ci-dessous pilotent l'état visuel (badge/bordure/aide) de chaque étape et
    // la ligne de statut du footer — miroir du `renderVals()` de la maquette.
    /** Le prix est-il PRÉ-REMPLI depuis l'estimation de création ? (DI payante
     *  ET estimation > 0). Quand c'est vrai, l'estimation est la RÉFÉRENCE : le
     *  champ est VERROUILLÉ (non modifiable) et l'aide au calcul (bornes 150–500)
     *  est tue. On exige > 0 pour ne jamais verrouiller sur une estimation
     *  nulle/absente (champ grisé ET vide → soumission bloquée).
     *  Jamais en retour « Facturer le diagnostic ? » : l'estimation de création
     *  vaut pour le cycle 0 ; repassé Payant, l'admin doit pouvoir SAISIR le
     *  prix du diagnostic retour (sinon champ grisé ET prix vide → bloqué). */
    get diagPriceFromEstimate(): boolean {
        return (
            this.pricingDiagnosticPayant &&
            Number(this.pricingDiagnosticEstimate) > 0 &&
            !this.showPricingPayantToggle
        );
    }
    get reelValid(): boolean {
        // (c) Bornes SOUPLES : la soumission n'exige plus 150–500, seulement un
        // montant SAISI, positif ou nul — 0 est accepté partout (flux original,
        // retour, irréparable ; demande utilisateur 2026-09-15). Un champ VIDE
        // reste invalide : il faut saisir une valeur, 0 compris.
        if (this.price == null) return false;
        const p = Number(this.price);
        return Number.isFinite(p) && p >= 0;
    }
    /** Hors des bornes recommandées 150–500 TND → avertissement non bloquant. */
    get reelOutOfBounds(): boolean {
        const p = Number(this.price);
        return Number.isFinite(p) && p > 0 && (p < 150 || p > 500);
    }
    get reelState(): 'idle' | 'ok' | 'warn' {
        const p = Number(this.price);
        if (this.price != null && p === 0) return 'ok';
        if (!Number.isFinite(p) || p <= 0) return 'idle';
        // Prix issu de l'estimation → référence, jamais d'état « hors bornes ».
        if (this.diagPriceFromEstimate) return 'ok';
        return this.reelOutOfBounds ? 'warn' : 'ok';
    }
    get repValid(): boolean {
        const r = Number(this.repairEstimate);
        return Number.isFinite(r) && r > 0;
    }
    /** DI marquée irréparable au diagnostic : l'estimation de réparation est
     *  masquée ET non requise (rien ne sera réparé). Piège évité : ne jamais
     *  bloquer la soumission sur un champ caché. */
    get isIrreparable(): boolean {
        return this.seletedRow?.can_be_repaired === false;
    }
    /** Toggle « Facturer le diagnostic ? » : tout RETOUR réparable arrivé en
     *  tarification, erreur client OU Fixtronix (un retour Fixtronix n'y arrive
     *  qu'avec des pièces ; sans pièces il part en PENDING3 direct). */
    get showPricingPayantToggle(): boolean {
        return this.ignoreCountPricing > 0 && !this.isIrreparable;
    }
    /** Retour « Non payant » : RIEN n'est facturé — diagnostic ET réparation
     *  grisés, enregistrés à 0 par « Valider le prix ». */
    get pricingRetourFree(): boolean {
        return this.showPricingPayantToggle && !this.pricingDiagnosticPayant;
    }
    get repState(): 'idle' | 'ok' | 'err' {
        const r = Number(this.repairEstimate);
        if (!Number.isFinite(r) || r <= 0) return 'idle';
        return 'ok';
    }
    /** Aide contextuelle sous l'étape 1 (coût réel). */
    get reelHelp(): { text: string; char: string; tone: string } {
        // Prix pré-rempli depuis l'estimation de création : c'est la référence,
        // on tait les bornes 150–500 (garde-fou de saisie manuelle seulement).
        if (this.diagPriceFromEstimate)
            return {
                text: 'Prix verrouillé sur l’estimation de création (non modifiable).',
                char: '🔒',
                tone: 'ok',
            };
        const st = this.reelState;
        if (st === 'warn')
            return {
                text: 'Hors des bornes recommandées 150–500 TND — autorisé, vérifiez le montant.',
                char: '!',
                tone: 'warn',
            };
        if (st === 'ok')
            return { text: 'Montant valide', char: '✓', tone: 'ok' };
        return {
            text: 'Recommandé entre 150 et 500 TND (hors bornes possible).',
            char: 'i',
            tone: 'idle',
        };
    }
    /** Aide contextuelle sous l'étape 2 (estimation réparation). */
    get repHelp(): { text: string; char: string; tone: string } {
        if (this.pricingRetourFree)
            return {
                text: 'Non payant : aucune réparation facturée',
                char: 'i',
                tone: 'idle',
            };
        return this.repState === 'ok'
            ? { text: 'Estimation enregistrée', char: '✓', tone: 'ok' }
            : {
                  text: 'Entrez le montant estimé (obligatoire)',
                  char: 'i',
                  tone: 'idle',
              };
    }
    /** Ligne de statut du footer — combine la validité des deux étapes. `tone`
     *  colore le texte, `iconTone` la pastille (le cas « estimation manquante »
     *  affiche un texte ambre mais une pastille neutre, comme la maquette). */
    get pricingStatus(): {
        text: string;
        char: string;
        tone: string;
        iconTone: string;
    } {
        // DI irréparable : l'estimation est masquée → on ne l'exige pas et on ne
        // l'affiche pas comme manquante ; seul le coût du diagnostic compte.
        // Retour NON PAYANT : rien n'est facturé, la réparation est grisée.
        const repRequired = !this.isIrreparable && !this.pricingRetourFree;
        // Diagnostic NON PAYANT : aucun coût de diagnostic à saisir/vérifier →
        // on ne l'exige pas et on ne montre pas l'avertissement « Vérifiez le
        // coût du diagnostic ». Miroir de `priceOk` (pricingSubmitDisabled).
        const diagCostOk = !this.pricingDiagnosticPayant || this.reelValid;
        if (!diagCostOk && repRequired && !this.repValid)
            return {
                text: 'Remplissez les 2 montants',
                char: '•',
                tone: 'idle',
                iconTone: 'idle',
            };
        if (!diagCostOk)
            return {
                text: 'Vérifiez le coût du diagnostic',
                char: '!',
                tone: 'err',
                iconTone: 'err',
            };
        if (repRequired && !this.repValid)
            return {
                text: "Ajoutez l'estimation de réparation",
                char: '•',
                tone: 'warn',
                iconTone: 'idle',
            };
        return {
            text: 'Tout est prêt',
            char: '✓',
            tone: 'ok',
            iconTone: 'ok',
        };
    }
    /** « Valider le prix » : coût diagnostic valide, estimation valide SAUF si la
     *  DI est irréparable (champ masqué → non requis), + aucune requête en vol. */
    get pricingSubmitDisabled(): boolean {
        const repOk =
            this.isIrreparable || this.pricingRetourFree || this.repValid;
        // Non payant : aucun prix diagnostic requis → on n'exige pas `reelValid`
        // (le plancher 150 ne s'applique pas).
        const priceOk = !this.pricingDiagnosticPayant || this.reelValid;
        return !priceOk || !repOk || this.isLoading;
    }


    /** Normalise le prix diagnostic au blur : empêche seulement un montant
     *  négatif (floor 0). AUCUN clamp 150–500 (l'estimation de création peut
     *  être hors bornes ; décision commerciale) — l'avertissement non bloquant
     *  (saisie manuelle sans estimation) gère l'information hors-bornes. */
    clampDiagCost(): void {
        if (this.price == null) return;
        const p = Number(this.price);
        if (!Number.isFinite(p)) return;
        this.price = Math.max(0, p);
    }

    /** Recompute the final price live as the user moves the slider / types in
     *  the input — spec says no separate "Appliquer remise" button. Source of
     *  truth = remise %. Soft cap at 20: values > 20 trigger a warning banner
     *  in the template (negociation 2 / admin approval path).
     *
     *  La base n'est PAS le seul prix du diagnostic : c'est `negoBaseAmount`
     *  (diagnostic + estimation de réparation, ou le total serveur quand le
     *  diagnostic est non payant). */
    onDiscountChange() {
        const p = this.negoBaseAmount;
        const d = Number(this.discountPercent);
        if (!Number.isFinite(p) || !Number.isFinite(d)) {
            this.finalPrice = null;
            this.discountedPriceNeg = 0;
            return;
        }
        this.discountedPriceNeg = Math.round(p * (d / 100) * 1000) / 1000;
        this.finalPrice = Math.round((p - this.discountedPriceNeg) * 1000) / 1000;
    }
    ignoreCountForBtns: number = 0;
    modalRetour1Info: boolean = false;
    modalRetour2Info: boolean = false;
    modalRetour3Info: boolean = false;
    retour1InfoFromLogs: any;
    retour2InfoFromLogs: any;
    retour3InfoFromLogs: any;
    // Retour motif dialog (captures the reason before sending a DI back).
    retourDialogVisible = false;
    retourMotifInput = '';
    retourTarget: any = null;

    // ── ReunionPV modal (opened additively after a Retour transition) ──
    // The transition itself runs untouched in confirmRetour(); this modal
    // is purely documentary so cancelling it leaves the DI exactly where
    // changeStatusRetour{N} left it. Set when we know the level + motif so
    // the modal can pre-fill the contexte retour.
    reunionPvModalVisible = false;
    reunionPvDiId: string | null = null;
    reunionPvDiIdnum: string | null = null;
    reunionPvNiveau: 1 | 2 | 3 | null = null;
    reunionPvMotif = '';
    totalDiCount: any;
    isLoading: boolean = true;

    /** Deep-link notification → ouverture des modales pricing / négociation 1 et 2. */
    private deepLinkConsumer?: DeepLinkConsumer;

    /** Règle UNIQUE du bouton « Approval (devis/BC) » et du deep-link `approval`. */
    readonly canOpenApproval = canOpenApproval;
    readonly canAffectFiles = canAffectFiles;

    constructor(
        public layoutService: LayoutService,
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private cdr: ChangeDetectorRef,
        private readonly notify: NotifyService,
        private readonly notificationService: NotificationService,
        private config: PrimeNGConfig,
        private readonly confirm: ConfirmService,
        private ticketRefreshService: TicketRefreshService,
        private readonly mutationRunner: MutationRunner,
        private route: ActivatedRoute,
        private router: Router,
        private diDetail: DiDetailService,
        private diFiles: DiFilesService,
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

    ngOnInit() {
        this.getStatusCount();
        this.loadData();
        this.getCompanyList();
        this.getClientList();
        this.allCategoryDi();
        this.getLocationList();
        this.notificationService.startWorker();

        // Deep-link notification : ?di=&action= → ouvre pricing / négociation 2
        // (openers qui MUTENT le statut → gardés par statut) ou, pour une
        // notification de devis/BC, « Approval (devis/BC) » — chargée par id,
        // d'où `approval` en action sans ligne. Sinon détail.
        this.deepLinkConsumer = new DeepLinkConsumer(
            this.route,
            this.router,
            () => this.diList,
            (row, diId, action) => this.openFromParams(row, diId, action),
            ['approval'],
        );
        this.deepLinkConsumer.listen(this.destroy$);

        // Setup search with debounce
        this.searchSubject$
            .pipe(debounceTime(400), takeUntil(this.destroy$))
            .subscribe(() => {
                this.loadData();
            });

        this.ticketRefreshService
            .listen('ticket-list')
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.loadData();
            });

        this.notificationService.notification$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: any) => {
                if (message) {
                    this.ticketRefreshService.requestRefresh('ticket-list', {
                        source: 'updateTicket',
                        message,
                    });
                    this.getStatusCount();
                }
            });
        this.notificationService.blAdded$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: any) => this.patchBlAddedRow(message));
        this.companySearch$
            .pipe(
                debounceTime(400),
                distinctUntilChanged(),
                switchMap((searchTerm) =>
                    this.apollo.query<any>({
                        query: this.ticketSerice.searchCompanies(searchTerm),
                    }),
                ),
            )
            .subscribe(({ data }) => {
                this.companiesListDropDown = data.searchCompanies;
            });
    }

    ngOnDestroy() {
        this.deepLinkConsumer?.destroy();
        this.destroy$.next();
        this.destroy$.complete();
    }

    /** Deep-link : ouvre pricing / négociation 2 pour la ligne trouvée SI le
     *  statut le permet (ces openers MUTENT le statut à l'ouverture), sinon
     *  retombe sur le modal détail partagé (jamais un clic mort). */
    private openFromParams(
        row: any | null,
        diId: string,
        action: string,
    ): void {
        const st = row?.status;
        if (
            row &&
            action === 'pricing' &&
            (st === 'PRICING' || st === 'PRICING_DIAG')
        ) {
            this.showDialogForPricing(row);
            return;
        }
        if (row && action === 'negociation2' && st === 'NEGOTIATION2') {
            this.showDialogForNegociate2(row);
            return;
        }
        // Notification de document (devis / BC attendu) : la DI est chargée par
        // son id et la modale ne s'ouvre QUE si le document est encore attendu —
        // sinon rien (décision produit).
        if (action === 'approval') {
            this.openApprovalById(diId);
            return;
        }
        // Deep-link hérité `?action=affectation` (lien partagé, favori). On ne
        // dépend PLUS de `row` : il était quasiment toujours `null`, la DI visée
        // n'étant pas dans les 10 lignes chargées. Le service récupère la DI par
        // son id, vérifie l'éligibilité et retombe sur le détail si besoin.
        if (action === 'affectation') {
            this.diFiles.openById(diId);
            return;
        }
        this.diDetail.openById(diId);
    }

    /**
     * Deep-link `approval` : charge la DI avec un statut FRAIS (la notification
     * peut être périmée, et une DI en attente de devis est rarement parmi les 10
     * lignes chargées), puis ouvre « Approval (devis/BC) » si un devis ou un BC
     * est encore attendu ; sinon un simple avis, aucune modale.
     */
    private openApprovalById(diId: string): void {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getDiDetail(diId),
                fetchPolicy: 'network-only',
            })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: ({ data }) => {
                    const di = data?.getDiDetail ?? null;
                    if (!di) {
                        this.notify.error("Cette DI n'existe plus.", {
                            summary: 'DI introuvable',
                        });
                        return;
                    }
                    if (!canOpenApproval(di)) {
                        this.notify.info(
                            'Plus aucun document à téléverser pour cette DI.',
                        );
                        return;
                    }
                    this.showDialogForNegociate1(di);
                },
                error: () =>
                    this.notify.error("Impossible d'ouvrir le dossier. Réessayez."),
            });
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
                    query: this.ticketSerice.searchDi(this.first, this.rows),
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
                        if (data?.searchDi) {
                            this.diList = data.searchDi.di;
                            // Compteur ET paginateur lisent `diListCount` :
                            // seul `totalDiCount` était écrit, d'où un total
                            // et des pages NON filtrés pendant une recherche.
                            this.diListCount = data.searchDi.totalDiCount;
                            this.totalDiCount = data.searchDi.totalDiCount;
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
                .query<DiQueryResult>({
                    query: this.ticketSerice.getAllDi(
                        this.first,
                        this.rows,
                        this.rangeDate[0],
                        this.rangeDate[1],
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
                    if (data) {
                        this.diList = data.getAllDi.di;
                        this.diListCount = data.getAllDi.totalDiCount;
                        this.updateCounters();
                    }
                });
        }
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

    private patchBlAddedRow(message: any): void {
        const di = message?.message?.di || message?.di;
        const diId = di?._id;

        if (!diId || !this.diList?.length) {
            return;
        }

        const rowIndex = this.diList.findIndex((item) => item?._id === diId);
        const row = rowIndex >= 0 ? this.diList[rowIndex] : null;

        if (!row || row.status !== 'FINISHED') {
            return;
        }

        // Replace the row with a new object reference and reassign the array
        // so PrimeNG's p-table re-renders the row template; in-place mutation
        // alone is not enough when default change detection is paired with
        // PrimeNG's internal value caching.
        const updatedRow = {
            ...row,
            bon_de_livraison:
                row.bon_de_livraison || di?.bon_de_livraison || true,
            __blAdded: true,
        };
        this.diList = [
            ...this.diList.slice(0, rowIndex),
            updatedRow,
            ...this.diList.slice(rowIndex + 1),
        ];
        this.cdr.markForCheck();
    }

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

    blockSpecialCharacters(event: KeyboardEvent): void {
        const invalidCharacters = ['"', "'"];
        if (invalidCharacters.includes(event.key)) {
            event.preventDefault();
        }
    }

    showDialogDiCreation() {
        this.openAddDiModal = true;
    }

    /** Ouvre « Modifier la DI » prérempli avec tout ce qui a été saisi à la
     *  création. Le formulaire est DÉTACHÉ de la ligne : Annuler ne la mute pas. */
    updateDi(rowDataTicket: any) {
        const di = rowDataTicket ?? {};
        this.selectedTicket = di;
        const companyId = this.isRealRef(di.company_id) ? di.company_id : null;
        const clientId = this.isRealRef(di.client_id) ? di.client_id : null;
        // Une recherche de société a pu remplacer la liste : sans l'option, la
        // présélection resterait vide.
        if (
            companyId &&
            !(this.companiesListDropDown ?? []).some(
                (c: any) => c?.value === companyId,
            )
        ) {
            this.companiesListDropDown = [
                { company_name: di.company_name || companyId, value: companyId },
                ...(this.companiesListDropDown ?? []),
            ];
        }
        this.updateDiForm.reset({
            title: di.title ?? '',
            description: di.description ?? '',
            nSerie: di.nSerie ?? '',
            location: this.isRealRef(di.location_id) ? di.location_id : null,
            typeClient: companyId ? 'COMPANY' : 'CLIENT',
            client_id: clientId,
            company_id: companyId,
            remarqueManager: di.remarque_manager ?? '',
            diagnosticPayant: di.diagnosticPayant !== false,
            diagnosticEstimate: di.diagnosticEstimate ?? null,
        });
        this.onEditImageRemoved();
        this.editBaseline = this.buildUpdateDiInfoInput();
        this.updateticketView = true;
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

    /** Annuler / fermeture de « Modifier la DI » (aussi branché sur `onHide`) :
     *  rien n'a été écrit, on jette seulement la photo en attente. */
    cancelUpdateDi() {
        this.updateticketView = false;
        this.onEditImageRemoved();
    }

    showDialogCategoryDI() {
        this.openCategoryModal = true;
    }

    showDialogLocations() {
        this.openLocationsModal = true;
        this.getLocationList();
    }

    /**
     * Open the centralized Relations & Structure modal. Loads everything
     * the three tabs need on demand: locations, DI categories, component
     * categories, and a lightweight component list for linked-count
     * computation. The DI rows shown in tab 1 reuse `this.diList`, which
     * is the same data already loaded in the underlying ticket-list — no
     * extra round trip needed.
     */
    showDialogRelations(initialTab: number = 0) {
        this.openRelationsModal = true;
        this.relationsActiveTabIndex = initialTab;
        this.relationsLoading = true;
        this.recentlyModifiedDiIds.clear();
        this.recentlyModifiedComposantIds.clear();

        // Refresh location & category dropdowns; both are used by the
        // reassignment tables and the linked-count columns.
        this.getLocationList();
        this.allCategoryDi();
        this.getComposantCategories();
        this.getComposantsForCategoryCount();
        this.loadComposantsForReassignment();
    }

    /** Mark a DI row as freshly modified for ~3s (UI highlight). */
    private flashDiRow(diId: string) {
        if (!diId) return;
        this.recentlyModifiedDiIds.add(diId);
        setTimeout(() => {
            this.recentlyModifiedDiIds.delete(diId);
        }, 3000);
    }

    private flashComposantRow(composantId: string) {
        if (!composantId) return;
        this.recentlyModifiedComposantIds.add(composantId);
        setTimeout(() => {
            this.recentlyModifiedComposantIds.delete(composantId);
        }, 3000);
    }

    /** Template helpers — invoked from [ngClass] on the rows. */
    isRecentlyModifiedDi(diId: string): boolean {
        return this.recentlyModifiedDiIds.has(diId);
    }

    isRecentlyModifiedComposant(composantId: string): boolean {
        return this.recentlyModifiedComposantIds.has(composantId);
    }

    /**
     * Load a fuller component list (with name + package + current
     * category id) for the reassignment table in tab 3. The lighter
     * `composantsForCategoryCount` list is kept separately for the
     * linked-count column on the categories table.
     */
    loadComposantsForReassignment() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllComposantsForReassignment(),
                fetchPolicy: 'no-cache',
            })
            .subscribe(({ data }) => {
                if (data?.findAllComposant) {
                    this.composantsForReassignment =
                        data.findAllComposant.map((c: any) => ({
                            _id: c._id,
                            name: c.name,
                            package: c.package,
                            category_composant_id:
                                c.category_composant_id || null,
                        }));
                }
            });
    }

    /**
     * Reassign a DI to a different category via the partial updateDi
     * mutation. Patches the loaded diList and flashes the row.
     */
    reassignDiCategory(di: any, newCategoryId: string): void {
        if (
            !di?._id ||
            !newCategoryId ||
            newCategoryId === di.di_category_id
        ) {
            return;
        }
        this.reassigningCategoryDiId = di._id;
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.reassignDiCategory(
                    di._id,
                    newCategoryId,
                ),
            })
            .subscribe({
                next: ({ data }) => {
                    if (data?.updateDi) {
                        // Keep both id and name in sync for the same
                        // reason as the location reassignment above.
                        const newCategoryName =
                            this.getDiCategoryNameById(newCategoryId);
                        const idx = this.diList?.findIndex(
                            (row: any) => row?._id === di._id,
                        );
                        if (idx !== undefined && idx >= 0) {
                            this.diList = [
                                ...this.diList.slice(0, idx),
                                {
                                    ...this.diList[idx],
                                    di_category_id: newCategoryId,
                                    di_category_name: newCategoryName,
                                },
                                ...this.diList.slice(idx + 1),
                            ];
                        }
                        this.flashDiRow(di._id);
                        this.notify.success(
                            `DI ${di._idnum} → ${newCategoryName}`,
                            { summary: 'Catégorie mise à jour' },
                        );
                        this.ticketRefreshService.requestRefresh(
                            'ticket-list',
                            { source: 'mutation:reassignDiCategory' },
                        );
                    }
                    this.reassigningCategoryDiId = null;
                },
                error: (err) => {
                    console.error('reassignDiCategory failed', err);
                    this.notify.error(
                        'Impossible de mettre à jour la catégorie',
                    );
                    this.reassigningCategoryDiId = null;
                },
            });
    }

    /**
     * Reassign a composant to a different category via the new
     * `updateComposantPartial` mutation. Patches the local composant
     * list immutably and flashes the row.
     */
    reassignComposantCategory(comp: any, newCategoryId: string): void {
        if (
            !comp?._id ||
            !newCategoryId ||
            newCategoryId === comp.category_composant_id
        ) {
            return;
        }
        this.reassigningComposantId = comp._id;
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.reassignComposantCategory(
                    comp._id,
                    newCategoryId,
                ),
            })
            .subscribe({
                next: ({ data }) => {
                    if (data?.updateComposantPartial) {
                        // Patch the reassignment list.
                        const idx = this.composantsForReassignment.findIndex(
                            (c) => c._id === comp._id,
                        );
                        if (idx >= 0) {
                            this.composantsForReassignment = [
                                ...this.composantsForReassignment.slice(
                                    0,
                                    idx,
                                ),
                                {
                                    ...this.composantsForReassignment[idx],
                                    category_composant_id: newCategoryId,
                                },
                                ...this.composantsForReassignment.slice(
                                    idx + 1,
                                ),
                            ];
                        }
                        // Patch the linked-count list so the count column
                        // updates without a refetch.
                        const idx2 =
                            this.composantsForCategoryCount.findIndex(
                                (c) => c._id === comp._id,
                            );
                        if (idx2 >= 0) {
                            this.composantsForCategoryCount = [
                                ...this.composantsForCategoryCount.slice(
                                    0,
                                    idx2,
                                ),
                                {
                                    ...this.composantsForCategoryCount[
                                        idx2
                                    ],
                                    category_composant_id: newCategoryId,
                                },
                                ...this.composantsForCategoryCount.slice(
                                    idx2 + 1,
                                ),
                            ];
                        }
                        this.flashComposantRow(comp._id);
                        const catName =
                            this.composantCategoryList.find(
                                (c) => c._id === newCategoryId,
                            )?.category_composant || '—';
                        this.notify.success(
                            `${comp.name} → ${catName}`,
                            { summary: 'Catégorie composant mise à jour' },
                        );
                    }
                    this.reassigningComposantId = null;
                },
                error: (err) => {
                    console.error('reassignComposantCategory failed', err);
                    this.notify.error(
                        "Impossible de mettre à jour la catégorie du composant",
                    );
                    this.reassigningComposantId = null;
                },
            });
    }

    /** Resolve a composant-category display name for the table. */
    getComposantCategoryNameById(categoryId: string | null): string {
        if (!categoryId) return '—';
        const found = this.composantCategoryList?.find(
            (c) => c._id === categoryId,
        );
        return found?.category_composant || '—';
    }

    /**
     * Compute how many DIs (in the currently loaded list) reference a
     * given location. Visible as the "DIs liés" column in the Emplacements
     * tab. Pure client-side aggregation — no backend roundtrip.
     */
    getLinkedDiCountForLocation(locationId: string): number {
        if (!locationId || !this.diList?.length) {
            return 0;
        }
        return this.diList.filter(
            (di: any) => di?.location_id === locationId,
        ).length;
    }

    /**
     * Same idea for DI categories.
     */
    getLinkedDiCountForCategory(categoryId: string): number {
        if (!categoryId || !this.diList?.length) {
            return 0;
        }
        return this.diList.filter(
            (di: any) => di?.di_category_id === categoryId,
        ).length;
    }

    /**
     * How many components reference the given component category.
     */
    getLinkedComposantCountForCategory(categoryId: string): number {
        if (!categoryId || !this.composantsForCategoryCount?.length) {
            return 0;
        }
        return this.composantsForCategoryCount.filter(
            (c) => c?.category_composant_id === categoryId,
        ).length;
    }

    /**
     * Resolve a location name from its id by looking up the already
     * loaded locations list. Used in the reassignment table.
     */
    getLocationNameById(locationId: string): string {
        if (!locationId) return '—';
        const found = this.locationDropDown?.find(
            (l: any) => l?.value === locationId || l?._id === locationId,
        );
        return found?.location_name || '—';
    }

    /**
     * Resolve a DI-category name from its id by looking up the loaded
     * categories list. Used in the reassignment table.
     */
    getDiCategoryNameById(categoryId: string): string {
        if (!categoryId) return '—';
        const found = this.categorieDiListDropDown?.find(
            (c: any) => c?.value === categoryId || c?._id === categoryId,
        );
        return found?.category_name || '—';
    }

    /**
     * Reassign a DI to a different emplacement via the existing updateDi
     * mutation. The backend now broadcasts updateTicket after a successful
     * updateDi (see di.service.ts), so subscribed lists/dashboards refresh
     * automatically. We also patch the loaded diList row so the modal
     * itself reflects the change without waiting for the WS round trip.
     */
    reassignLocation(di: any, newLocationId: string): void {
        if (!di?._id || !newLocationId || newLocationId === di.location_id) {
            return;
        }
        this.reassigningDiId = di._id;
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.reassignDiLocation(
                    di._id,
                    newLocationId,
                ),
            })
            .subscribe({
                next: ({ data }) => {
                    if (data?.updateDi) {
                        // Patch in place so the modal table updates instantly.
                        // Keep both `location_id` (the lookup key) and
                        // `location_name` (the displayed column) in sync,
                        // otherwise the main ticket-list column would
                        // briefly flash the old name until the next
                        // server reload arrives.
                        const newLocationName =
                            this.getLocationNameById(newLocationId);
                        const idx = this.diList?.findIndex(
                            (row: any) => row?._id === di._id,
                        );
                        if (idx !== undefined && idx >= 0) {
                            this.diList = [
                                ...this.diList.slice(0, idx),
                                {
                                    ...this.diList[idx],
                                    location_id: newLocationId,
                                    location_name: newLocationName,
                                },
                                ...this.diList.slice(idx + 1),
                            ];
                        }
                        this.notify.success(
                            `DI ${di._idnum} → ${newLocationName}`,
                            { summary: 'Emplacement mis à jour' },
                        );
                        // The backend's updateTicket broadcast will also
                        // trigger the standard refresh pipeline; this
                        // local request keeps things tight.
                        this.ticketRefreshService.requestRefresh(
                            'ticket-list',
                            { source: 'mutation:reassignDiLocation' },
                        );
                    }
                    this.reassigningDiId = null;
                },
                error: (err) => {
                    console.error('reassignDiLocation failed', err);
                    this.notify.error(
                        "Impossible de mettre à jour l'emplacement",
                    );
                    this.reassigningDiId = null;
                },
            });
    }

    /**
     * Component-category list loader — backs the third tab.
     */
    getComposantCategories() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllComposantCategory(),
                fetchPolicy: 'no-cache',
            })
            .subscribe(({ data }) => {
                this.relationsLoading = false;
                if (data?.findAllComposant_Category) {
                    this.composantCategoryList =
                        data.findAllComposant_Category.map((c: any) => ({
                            _id: c._id,
                            category_composant: c.category_composant,
                        }));
                }
            });
    }

    /**
     * Lightweight component fetch used only to compute linked-count per
     * component category. Selects only id + category id so payload stays
     * tiny.
     */
    getComposantsForCategoryCount() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllComposantsForCategoryCount(),
                fetchPolicy: 'no-cache',
            })
            .subscribe(({ data }) => {
                if (data?.findAllComposant) {
                    this.composantsForCategoryCount =
                        data.findAllComposant.map((c: any) => ({
                            _id: c._id,
                            category_composant_id:
                                c.category_composant_id || null,
                        }));
                }
            });
    }

    addComposantCategory() {
        const name =
            this.composantCategoryForm.value.composantCategoryName?.trim();
        if (!name) return;
        this.confirm.confirmCreate({
            message: 'Voulez-vous créer cette catégorie de composant ?',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation:
                            this.ticketSerice.addComposantCategory(name),
                    })
                    .subscribe(({ data }) => {
                        if (data?.createComposant_Category) {
                            this.composantCategoryList = [
                                ...this.composantCategoryList,
                                {
                                    _id: data.createComposant_Category._id,
                                    category_composant:
                                        data.createComposant_Category
                                            .category_composant,
                                },
                            ];
                            this.composantCategoryForm.reset();
                            this.notify.success(
                                name,
                                { summary: 'Catégorie créée' },
                            );
                        }
                    });
            },
        });
    }

    deleteComposantCategory(row: { _id: string; category_composant: string }) {
        if (!row?._id) return;
        this.confirm.confirmDelete({
            message: `Supprimer la catégorie « ${row.category_composant} » ?`,
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation:
                            this.ticketSerice.removeComposantCategoryById(
                                row._id,
                            ),
                    })
                    .subscribe(({ data }) => {
                        if (data?.removeComposant_Category) {
                            this.composantCategoryList =
                                this.composantCategoryList.filter(
                                    (c) => c._id !== row._id,
                                );
                            this.notify.success(
                                row.category_composant,
                                { summary: 'Catégorie supprimée' },
                            );
                        }
                    });
            },
        });
    }

    /**
     * Enregistre « Modifier la DI » : seuls les champs modifiés partent (le
     * journal `DI_EDITED` ne liste que de vrais changements). Un refus serveur
     * (statut, client/société, verrou de tarification) est affiché tel quel et
     * le modal reste ouvert. Succès → rechargement : noms client/société et
     * emplacement sont calculés côté serveur.
     */
    saveUpdateTicket() {
        const _id = this.selectedTicket?._id;
        if (!_id || !this.canSaveEditDi) return;
        const input = this.changedDiInfoFields(
            this.editBaseline,
            this.buildUpdateDiInfoInput(),
        );
        if (Object.keys(input).length === 1) {
            this.cancelUpdateDi();
            return;
        }

        this.confirm.confirmSave({
            message: 'Voulez-vous enregistrer les modifications ?',
            header: 'Mise à jour de la DI',
            accept: async () => {
                try {
                    await this.mutationRunner.run({
                        key: `updateDiInfo:${_id}`,
                        mutation: this.ticketSerice.updateDiInfo(),
                        variables: { input },
                        successToast: {
                            summary: 'DI modifiée',
                            detail: 'La DI a été modifiée.',
                        },
                        errorToast: null,
                        onLoading: (v) => (this.savingEditDi = v),
                    });
                } catch (err: any) {
                    if (err?.message !== 'mutation-in-flight') {
                        this.notify.error(
                            err?.message ||
                                'Échec de la modification. Réessayez.',
                            { summary: 'Modification impossible' },
                        );
                    }
                    return;
                }
                this.cancelUpdateDi();
                this.loadData();
            },
        });
    }

    /** Input `updateDiInfo` COMPLET depuis le formulaire : la partie non
     *  choisie part à `null`, l'estimation aussi si non payant, la photo
     *  seulement si une nouvelle a été déposée. */
    buildUpdateDiInfoInput(): Record<string, any> {
        const v = this.updateDiForm.getRawValue();
        const isCompany = v.typeClient === 'COMPANY';
        const payant = v.diagnosticPayant !== false;
        const input: Record<string, any> = {
            _id: this.selectedTicket?._id,
            title: (v.title ?? '').trim(),
            description: (v.description ?? '').trim(),
            nSerie: (v.nSerie ?? '').trim(),
            location_id: v.location ?? null,
            client_id: isCompany ? null : (v.client_id ?? null),
            company_id: isCompany ? (v.company_id ?? null) : null,
            remarque_manager: (v.remarqueManager ?? '').trim(),
            diagnosticPayant: payant,
            diagnosticEstimate: payant ? (v.diagnosticEstimate ?? null) : null,
        };
        if (this.editImagePayload) input['image'] = this.editImagePayload;
        return input;
    }

    /** Ne garde que les champs qui diffèrent de l'ouverture du modal (+ `_id`).
     *  Client et société voyagent ensemble : le back exige UNE seule partie. */
    changedDiInfoFields(
        baseline: Record<string, any>,
        next: Record<string, any>,
    ): Record<string, any> {
        const input: Record<string, any> = { _id: next['_id'] };
        for (const [key, value] of Object.entries(next)) {
            if (key === '_id') continue;
            if (
                JSON.stringify(baseline?.[key] ?? null) !==
                JSON.stringify(value ?? null)
            ) {
                input[key] = value;
            }
        }
        if ('client_id' in input || 'company_id' in input) {
            input['client_id'] = next['client_id'];
            input['company_id'] = next['company_id'];
        }
        return input;
    }

    /** « Enregistrer » : champs obligatoires + photo déposée entièrement lue. */
    get canSaveEditDi(): boolean {
        const v = this.updateDiForm.getRawValue();
        const partyOk =
            v.typeClient === 'COMPANY' ? !!v.company_id : !!v.client_id;
        const imageReady = !this.editImageDropFile || !!this.editImagePayload;
        return (
            !!(v.title ?? '').trim() &&
            !!(v.description ?? '').trim() &&
            partyOk &&
            imageReady &&
            !this.savingEditDi
        );
    }

    /** Photo actuelle via le proxy back (fichier Drive privé) — même règle que
     *  `DiInfoModalComponent.imageProxyUrl`. */
    get editImageProxyUrl(): string {
        const raw = String(this.selectedTicket?.image ?? '').trim();
        const id = this.selectedTicket?._id ?? '';
        if (!raw || raw === '-' || !id) return '';
        const base = (environment.apiUrl ?? '').replace(/\/$/, '');
        return `${base}/di/${id}/image`;
    }

    get editImageViewUrl(): string {
        const v = String(this.selectedTicket?.image ?? '').trim();
        return /^https?:\/\//i.test(v) ? v : '';
    }

    /** Photo de remplacement : état PROPRE au modal d'édition — `payload` est
     *  partagé par la création et les BC/Devis. */
    onEditImageSelected(file: File) {
        if (!file) return;
        this.editImageDropFile = file;
        this.editImagePayload = '';
        const reader = new FileReader();
        reader.onload = () => {
            // Fichier retiré ou remplacé pendant la lecture : on l'ignore.
            if (this.editImageDropFile !== file) return;
            this.editImagePayload = reader.result as string;
            this.cdr.markForCheck();
        };
        reader.onerror = () => {
            if (this.editImageDropFile !== file) return;
            this.onEditImageRemoved();
            this.notify.error("L'image n'a pas pu être préparée.", {
                summary: 'Fichier non chargé',
            });
        };
        reader.readAsDataURL(file);
    }

    onEditImageRemoved() {
        this.editImageDropFile = null;
        this.editImagePayload = '';
    }

    /** `createDi` écrit littéralement « null » / « undefined » pour une
     *  référence absente. */
    private isRealRef(value: unknown): value is string {
        return (
            typeof value === 'string' &&
            value.trim() !== '' &&
            value !== 'null' &&
            value !== 'undefined'
        );
    }

    findIndexById(_id: string): number {
        let index = -1;
        for (let i = 0; i < this.diList.length; i++) {
            if (this.diList[i]._id === _id) {
                index = i;
                break;
            }
        }
        return index;
    }

    showDialogPriceTech() {
        this.openPriceTechModal = true;
        this.apollo
            .query<any>({
                query: this.ticketSerice.getTechTarif(),
            })
            .subscribe(({ data, loading }) => {
                this.tarif_Tech = data.getTarif.tarif;
                this.isLoading = loading;
            });
    }

    confirmerTarifs() {
        this.tarif_Techs.value;

        const { tarifFromAdmin } = this.tarif_Techs.value;
        const tarifForTechs = tarifFromAdmin;
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.affectNewTarif(tarifForTechs),
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
        this.apollo
            .query<any>({
                query: this.ticketSerice.getTechTarif(),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                this.tarif_Tech = data.getTarif.tarif;
            });
        this.openPriceTechModal = false;
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

    onCompanyFilter(event: any) {
        const searchValue = event.filter?.trim();

        if (searchValue && searchValue.length >= 2) {
            this.companySearch$.next(searchValue);
        }
    }

    confirmerNegociation(_step: any) {
        this.confirm.confirmSave({
            message: 'Voulez-vous enregistrer le prix final ?',
            header: 'Prix final',
            accept: async () => {
                const r1 = this.selectedRowInNegociate1;
                const r2 = this.selectedRowInNegociate2;

                // Branch conditions — MUTUALLY EXCLUSIVE (priority order) so the
                // serialized cascade runs exactly ONE transition.
                //  1. Non-repairable wins → FINISHED (can't repair → done).
                //  2. Repairable but NO components → skip the confirmation phase,
                //     straight to PENDING3.
                //  3. Repairable WITH components → INMAGASIN, then the dedicated
                //     CONFIRMATION_COMPOSANTS phase before PENDING3.
                // "Has components" = `contain_pdr === true` AND a non-empty
                // `array_composants` — BOTH must agree (the toggle alone lies:
                // some diagnostic-finish paths set contain_pdr with an empty
                // list, which would strand a component-less DI in confirmation).
                const hasComponents = (r: any): boolean =>
                    !!r?.contain_pdr && (r?.array_composants?.length ?? 0) > 0;

                const notRepairable =
                    r1?.can_be_repaired === false ||
                    r2?.can_be_repaired === false;
                const anyHasComponents =
                    hasComponents(r1) || hasComponents(r2);

                let transitionStep:
                    | { mutation: any; variables?: any }
                    | undefined;
                if (notRepairable) {
                    transitionStep = {
                        mutation: this.ticketSerice.changeFinishStatus(
                            this._idDi,
                        ),
                    };
                } else if (!anyHasComponents) {
                    // Repairable, no components → skip confirmation → PENDING3.
                    transitionStep = {
                        mutation: this.ticketSerice.changeStatusPending3(
                            this._idDi,
                        ),
                    };
                } else {
                    // Repairable WITH components → magasin sources them, then the
                    // CONFIRMATION_COMPOSANTS phase (magasin ↔ coordinatrice).
                    transitionStep = {
                        mutation: this.ticketSerice.changeStatusDiToInMagasin(
                            this._idDi,
                        ),
                    };
                }

                // Step 1: persist the price (no status change). Step 2 (LAST):
                // the transition — only fires after the price is saved, and
                // from the correct source status (M1 guard).
                //
                // `price` reste le PRIX DU DIAGNOSTIC, sens inchangé (il est lu
                // par le PDF devis, le dossier, l'historique de retour et le
                // verrou `setDiagnosticPayant`). Seul `final_price` porte la
                // base sommée (diagnostic + estimation réparation, ou le total
                // serveur en non payant) diminuée de la remise.
                // `toMoney` et non `Number(...)` : `Number(null) === 0` est
                // fini — un prix final non calculé (modal ouvert sans réponse
                // serveur) serait persisté comme 0 au lieu de retomber sur la
                // base. `0` reste une valeur légitime et passe telle quelle.
                const finalToPersist =
                    this.toMoney(this.finalPrice) ?? this.negoBaseAmount;
                const priceStep = {
                    mutation: this.ticketSerice.nego1nego2_InMagasin(
                        this._idDi,
                        Number(this.price) || 0,
                        finalToPersist,
                    ),
                };
                const steps = transitionStep
                    ? [priceStep, transitionStep]
                    : [priceStep];

                try {
                    await this.mutationRunner.runChain({
                        key: `confirmerNegociation:${this._idDi}`,
                        steps,
                        successToast: {
                            summary: 'Prix confirmé',
                            detail: 'DI transmise à l’étape suivante.',
                        },
                        errorToast: {
                            summary: 'Erreur',
                            detail: 'Échec de la confirmation. Réessayez.',
                        },
                        onLoading: (v) => (this.isLoading = v),
                    });

                    // Side effects ONLY after the whole cascade succeeded.
                    this.loadData();
                    this.payload.file = '';
                    this.negocite1Modal = false;
                    this.negocite2Modal = false;
                    this.isBCUploaded = false;
                    this.isDevisUploaded = false;
                    this.selectedBc = null;
                    this.selectedDevis = null;
                    this.discountPercent = 0;
                    this.price = 0;
                    this.finalPrice = 0;
                    this.negoRepairEstimate = null;
                    this.negoServerFinalPrice = null;
                } catch {
                    /* toasted; modals stay open, status unchanged past the
                       failed step (no status advance on unsaved price) */
                }
            },
        });
    }

    enregistrerBC() {
        this.confirm.confirmSave({
            message: 'Voulez-vous enregistrer le bon de commande ?',
            header: 'Bon de commande',
            accept: async () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.addBC(
                            this._idDi,
                            this.payload.file,
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, loading }) => {
                        console.log('🌽[data]:', data);
                        console.log('🍒[loading]:', loading);
                        this.devisBtnDisabled = loading;
                        this.isLoading = loading;
                    });

                this.enregistrerBcBtncondition = true;
            },
        });
    }

    selectFilterRangeDate(data: Date) {
        if (!this.rangeDate.length) {
            this.rangeDate[0] = data;
        } else if (this.rangeDate.length === 1) {
            this.rangeDate[1] = data;
        } else {
            this.rangeDate = [data];
        }

        console.log('🍞[rangeDate]:', this.rangeDate);

        let start = this.rangeDate.length > 0 ? this.rangeDate[0] : null;
        let end = this.rangeDate.length > 1 ? this.rangeDate[1] : null;

        let rangeFilter = { start, end };
        console.log('🍅[rangeFilter]:', rangeFilter);
        this.loadData();
    }

    enregistrerDevis() {
        this.confirm.confirmSave({
            message: 'Voulez-vous enregistrer le devis ?',
            header: 'Devis',
            accept: async () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.addDevis(
                            this._idDi,
                            this.payload.file,
                        ),
                    })
                    .subscribe(({ loading }) => {
                        this.bcBtnDisabled = loading;
                        this.isLoading = loading;
                        // Statut avancé (WAITING_DEVIS → WAITING_BC) → refresh liste.
                        if (!loading) this.loadData();
                    });

                this.enregistrerDevisBtncondition = true;
            },
        });
    }



    saveDevisPDF(_id: string, pdf: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addDevis(_id, pdf),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                // Statut avancé (WAITING_DEVIS → WAITING_BC) → refresh liste.
                if (!loading) this.loadData();
            });
    }



    saveBCPDF(_id: string, pdf: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addBC(_id, pdf),
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    timeStringIntoHours(timeString) {
        const [hours, minutes, seconds] = timeString.split(':').map(Number);
        return {
            hours: hours,
            minutes: minutes,
            seconds: seconds,
        };
    }

    showDialogForPricing(data) {
        // Reset every modal-bound field synchronously so the dialog never
        // renders with residue from the previously selected DI. Capture the
        // current row id and gate every async callback against it: a late
        // response from a prior selection must not overwrite the current
        // modal state.
        const MyID = data._id;
        this.current_id = MyID;
        const requestedRowId = MyID;

        this.seletedRow = data;
        this.repairEstimate = data?.repairEstimate ?? null;
        // F1 — diagnostic payant + estimation (pré-remplira le prix si payant).
        this.pricingDiagnosticPayant = data?.diagnosticPayant !== false;
        this.pricingDiagnosticEstimate = data?.diagnosticEstimate ?? null;
        this.isErrorFromFixtronix = data.isErrorFromFixtronix;
        this.ignoreCountPricing = data.ignoreCount;
        this.pricingModalIgnoreCount = data.ignoreCount ?? 0;
        this.ignoreCountN1 = data.ignoreCount - 1;

        this.tarif_Technicien = null;
        this.timeDiagnostique = null;
        this.facturationDiagnostique = null;
        this.timepart = null;
        this.initialPriceAffichage = null;
        this.priceRemiseAffichage = null;
        this.pricesLogs = [];
        this.totalComposant = null;
        // Pré-remplissage MODIFIABLE depuis l'estimation de création (payant) ;
        // non payant → aucun prix diagnostic.
        this.price = this.pricingDiagnosticPayant
            ? this.pricingDiagnosticEstimate
            : null;

        const isStale = () => this.current_id !== requestedRowId;

        const tarifQuery = this.apollo
            .query<any>({
                query: this.ticketSerice.getTechTarif(),
            })
            .toPromise()
            .then(({ data }) => {
                if (isStale()) return;
                if (data) {
                    this.tarif_Technicien = data.getTarif.tarif;
                }
            });

        let statQuery;
        if (data?.ignoreCount && data?.ignoreCount > 0) {
            this.apollo
                .query<any>({
                    query: this.ticketSerice.getDiById(data._id),
                })
                .subscribe(({ data, loading }) => {
                    if (isStale()) return;
                    this.isLoading = loading;
                    if (data) {
                        // Historique par CYCLE : chaque montant est lu sur SA
                        // ligne `logsDi`, jamais sur la DI — `di.price` /
                        // `di.final_price` sont le miroir du cycle COURANT,
                        // vidé à l'entrée en retour (d'où « Avant Retour :
                        // 0,000 »). `toMoney` garde une absence (null)
                        // distincte d'un 0 réel (diagnostic non payant).
                        const logs: any[] = data.getDiById.logsDi ?? [];
                        const original = logs.find(
                            (el) => Number(el?.idIgnore) === 0,
                        );
                        this.initialPriceAffichage = this.toMoney(
                            original?.price,
                        );
                        this.priceRemiseAffichage = this.toMoney(
                            original?.final_price,
                        );

                        // Retours PRÉCÉDENTS uniquement : le cycle courant est
                        // celui qu'on tarife, il n'a pas encore de prix.
                        this.pricesLogs = logs
                            .filter((el) => {
                                const cycle = Number(el?.idIgnore);
                                return (
                                    cycle >= 1 &&
                                    cycle < this.pricingModalIgnoreCount
                                );
                            })
                            .sort(
                                (a, b) =>
                                    Number(a.idIgnore) - Number(b.idIgnore),
                            )
                            .map((el) => ({
                                priceLogs: this.toMoney(el.price),
                                final_priceLog: this.toMoney(el.final_price),
                                ignoreDispaly: el.idIgnore,
                            }));
                    }
                });

            this.apollo
                .query<any>({
                    query: this.ticketSerice.getLogsDiById(
                        data.ignoreCount,
                        data._id,
                    ),
                })
                .subscribe(({ data, loading }) => {
                    if (isStale()) return;
                    this.isLoading = loading;
                    if (data) {
                        this.isErrorFromFixtronix =
                            data.getLigsById.isErrorFromFixtronix;
                    }
                });
            statQuery = this.apollo
                .query<any>({
                    query: this.ticketSerice.getStatByDI_ID(
                        MyID,
                        data?.ignoreCount,
                    ),
                })
                .toPromise()
                .then(({ data }) => {
                    if (isStale()) return;
                    if (data) {
                        this.timeDiagnostique =
                            data.getInfoStatByIdDi.diag_time;
                        this.timepart = this.timeStringIntoHours(
                            data.getInfoStatByIdDi.diag_time,
                        );
                    }
                });
        } else {
            this.apollo
                .query<any>({
                    query: this.ticketSerice.getDiById(data._id),
                })
                .subscribe(({ data, loading }) => {
                    if (isStale()) return;
                    this.isLoading = loading;
                    if (data) {
                        this.isErrorFromFixtronix =
                            data.getDiById.di.isErrorFromFixtronix;
                    }
                });
            statQuery = this.apollo
                .query<any>({
                    query: this.ticketSerice.getStatByDI_ID(MyID),
                })
                .toPromise()
                .then(({ data }) => {
                    if (isStale()) return;
                    if (data) {
                        this.timeDiagnostique =
                            data.getInfoStatByIdDi.diag_time;
                        this.timepart = this.timeStringIntoHours(
                            data.getInfoStatByIdDi.diag_time,
                        );
                    }
                });
        }

        Promise.all([tarifQuery, statQuery]).then(() => {
            if (isStale()) return;
            if (this.timepart && this.tarif_Technicien) {
                // Coût théorique de la MAIN-D'ŒUVRE = temps RÉEL de diagnostic ×
                // taux horaire. Basé sur les SECONDES.
                //   labor = totalSeconds × tarif / 3600
                // L'ancien calcul était triplement faux : il ignorait les
                // secondes (h+m seulement → 0 pour 21 s), ajoutait une minute
                // parasite (+ tarif/60), puis BORNAIT à [150,500] → 150 DT pour
                // 21 s. Ici : coût RÉEL, NON borné (la borne 150–500 reste sur le
                // PRIX saisi, pas sur le coût). Ex. 21 s @ 77 DT/h → 0,449 DT.
                const totalSeconds =
                    (Number(this.timepart.hours) || 0) * 3600 +
                    (Number(this.timepart.minutes) || 0) * 60 +
                    (Number(this.timepart.seconds) || 0);
                this.facturationDiagnostique =
                    Math.round(
                        ((totalSeconds * this.tarif_Technicien) / 3600) * 1000,
                    ) / 1000;
            }
        });

        this.pricingModal = true;

        this.changeStatusPricing(data._id);
        this.getTotalComposant(data._id);
    }

    hideNegModal(data) {
        console.log('🍢[data]:', data);

        this.selectedBc = null;
        this.selectedDevis = null;
        this.instantSelectedBc = null;
        this.instantSelectedDevis = null;

        this.discountPercent = 0;
        this.finalPrice = null;
        this.discountedPriceNeg = null;
        this.negoRepairEstimate = null;
        this.negoServerFinalPrice = null;

        this.slideEnd = 0;
        this.ignoreCountNeg1 = 0;

        console.log('All values have been reset.');
    }

    formatSize(bytes) {
        const k = 1024;
        const dm = 3;
        const sizes = this.config.translation.fileSizeTypes;
        if (bytes === 0) {
            return `0 ${sizes[0]}`;
        }

        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

        return `${formattedSize} ${sizes[i]}`;
    }

    onSelectedFiles(event) {
        this.files = event.currentFiles;
        this.files.forEach((file) => {
            this.totalSize += parseInt(this.formatSize(file.size));
        });
        this.totalSizePercent = this.totalSize / 10;
    }

    showDialogForNegociate1(data) {
        console.log('🥫[data]:', data);

        this.devisBtnDisabled = false;
        this.bcBtnDisabled = false;
        this.enregistrerBcBtncondition = true;
        this.enregistrerDevisBtncondition = true;

        this._idDi = data._id;

        // Reset SYNCHRONE avant la requête : la base du prix final est
        // désormais une SOMME — un `price`/`negoRepairEstimate` résiduel d'une
        // autre DI afficherait un montant faux le temps que `getDiByID`
        // réponde, pas seulement une valeur périmée.
        this.price = null;
        this.negoRepairEstimate = null;
        this.negoServerFinalPrice = null;
        this.finalPrice = null;
        this.discountPercent = 0;
        this.discountedPriceNeg = 0;

        this.seletedRow = data._id;
        this.ignoreCountNeg1 = data.ignoreCount;
        this.pricingModalIgnoreCount = data.ignoreCount ?? 0;
        console.log('ignoreCountNeg1', this.ignoreCountNeg1);
        this._idDi = this.seletedRow;
        this.getDiByID(this._idDi);
        this.secondNegocition = data._id;
        this.negocite1Modal = true;
        this.getTotalComposant(data._id);
        this.isFormComplete();
    }

    showDialogForNegociate2(data) {
        this.devisBtnDisabled = false;
        this.bcBtnDisabled = false;
        this.enregistrerBcBtncondition = true;
        this.enregistrerDevisBtncondition = true;

        // Reset SYNCHRONE avant la requête : la base du prix final est
        // désormais une SOMME — un `price`/`negoRepairEstimate` résiduel d'une
        // autre DI afficherait un montant faux le temps que `getDiByID`
        // réponde, pas seulement une valeur périmée.
        this.price = null;
        this.negoRepairEstimate = null;
        this.negoServerFinalPrice = null;
        this.finalPrice = null;
        this.discountPercent = 0;
        this.discountedPriceNeg = 0;

        this.selectedRowInNegociate2 = data;
        this.slectedRow = data._id;
        this._idDi = data._id;
        this.ignoreCountNeg1 = data.ignoreCount;
        this.pricingModalIgnoreCount = data.ignoreCount ?? 0;
        this.negocite2Modal = true;
        this.getTotalComposant(data._id);
        this.getDiByID(this.slectedRow);
    }

    onSizeSelect() {}

    // `getcomposantByName()` supprimé : il alimentait `allComposants`, dont
    // seul le `.length` était copié dans `composantQuantity` — jamais lu.
    // (`composantByName_forAdmin` reste dans TicketService, désormais orphelin.)

    getLatestLogFacture(logs: any[]): any {
        if (!logs || logs.length === 0) {
            return null;
        }
        return logs.reduce((prev, curr) =>
            prev.idIgnore > curr.idIgnore ? prev : curr,
        ).facture;
    }

    getDiByID(_idDi: string) {
        console.log('🥐[getDiByID]: fired');
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getDiById(_idDi),
            })
            .valueChanges.subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.dataById = data;
                    console.log('data NEGOCIATION111', data);

                    this.selectedRowInNegociate1 =
                        data.getDiById.logsDi &&
                        data.getDiById.logsDi.length > 0
                            ? data.getDiById.logsDi.reduce((prev, current) =>
                                  prev.idIgnore > current.idIgnore
                                      ? prev
                                      : current,
                              )
                            : data.getDiById.di;
                    console.log(
                        '🍇🍇🍇🍇[this.selectedRowInNegociate1]:',
                        this.selectedRowInNegociate1,
                    );
                    const di = this.dataById.getDiById.di;
                    const filtredLogsDi = (
                        this.dataById.getDiById.logsDi ?? []
                    ).find((el) => el.idIgnore === this.ignoreCountNeg1);

                    // ARGENT DU CYCLE — le log d'abord, la DI en repli.
                    // `getDiById` renvoie TOUJOURS un tableau `logsDi` (`[]`
                    // est truthy), mais `affectinitialPrice` et
                    // `setRepairFinalPrice` n'écrivent sur `logsdis` que si
                    // `ignoreCount > 0` : au cycle 0 la ligne de log existe
                    // (créée à l'affectation technicien) mais reste un
                    // SQUELETTE sans montant, et les prix vivent sur la DI.
                    // Lire le log sans repli laissait `price` sur une valeur
                    // résiduelle — inoffensif tant qu'on ne faisait que
                    // l'afficher, faux dès qu'on le SOMME.
                    this.price =
                        this.toMoney(filtredLogsDi?.price) ??
                        this.toMoney(di?.price);
                    this.negoServerFinalPrice =
                        this.toMoney(filtredLogsDi?.final_price) ??
                        this.toMoney(di?.final_price);
                    // L'estimation de réparation vit TOUJOURS sur le miroir DI :
                    // `setRepairEstimate` écrit `di.repairEstimate` quel que
                    // soit `ignoreCount` (le log n'est jamais alimenté).
                    this.negoRepairEstimate = this.toMoney(di?.repairEstimate);

                    // Documents : inchangé — ils sont attachés à la ligne de
                    // cycle par le back (`withCycleDocuments`), y compris au
                    // cycle 0.
                    this.selectedBc = filtredLogsDi?.bon_de_commande ?? null;
                    this.selectedDevis = filtredLogsDi?.devis ?? null;
                    console.log('this.selectedBc', this.selectedBc);
                    console.log('this.selectedDevis', this.selectedDevis);

                    // Amorce le prix final dès l'ouverture : sans cela il reste
                    // null tant que le curseur n'a pas bougé, et la confirmation
                    // persisterait le prix du diagnostic seul comme prix final.
                    this.onDiscountChange();
                }
            });
    }

    changeStatusPricing(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusPricing(_id),
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    getTotalComposant(_id: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.totalComposant(_id),
            })
            .valueChanges.subscribe(({ data, loading }) => {
                this.isLoading = loading;
                this.totalComposant = data.calculateTicketComposantPrice;
            });
    }

    /**
     * RETOUR réparable (erreur client ou Fixtronix) : bascule « facturer le
     * diagnostic ? » du modal Pricing. Persiste le flag DI `diagnosticPayant`
     * AVANT toute validation de prix (setDiagnosticPayant est verrouillé une fois
     * price>0). Le routage n'en dépend PAS. Non payant ⇒ on efface le prix (le
     * back rejette tout prix positif en non payant) ; Payant ⇒ champ rouvert,
     * pré-rempli (modifiable) avec l'estimation de création s'il est vide.
     */
    onPricingPayantToggle(): void {
        const id = this.current_id;
        if (!id) return;
        if (!this.pricingDiagnosticPayant) {
            // Non payant : rien n'est facturé → les deux saisies sont vidées
            // (et grisées dans le modal).
            this.price = null;
            this.repairEstimate = null;
        } else if (
            this.price == null &&
            Number(this.pricingDiagnosticEstimate) > 0
        ) {
            this.price = this.pricingDiagnosticEstimate;
        }
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.setDiagnosticPayant(
                    id,
                    this.pricingDiagnosticPayant,
                ),
            })
            .subscribe({ error: () => {} });
    }

    pricing() {
        this.confirm.confirmSave({
            message: 'Voulez-vous enregistrer le prix initial ?',
            header: 'Prix initial',
            accept: async () => {
                // Cascade sérialisée (M2/M5 pattern): persist initial price,
                // THEN transition status. Step 2 only runs if step 1 succeeds,
                // so a failed save never advances the workflow. Per-DI key
                // prevents double-clicks from firing the chain twice.
                const id = this.current_id;
                // Non payant : on NE facture PAS le diagnostic (le back rejette
                // tout prix positif) → on saute l'étape prix.
                // RETOUR « Non payant » : RIEN n'est facturé — diagnostic ET
                // réparation enregistrés à 0 (le cycle affiche 0, pas « Non
                // renseigné »).
                const retourFree = this.pricingRetourFree;
                const priceSteps = this.pricingDiagnosticPayant
                    ? [{ mutation: this.ticketSerice.pricing(id, this.price) }]
                    : retourFree
                      ? [{ mutation: this.ticketSerice.pricing(id, 0) }]
                      : [];
                // Persist the repair estimate (dedicated field, no status
                // change) between the price save and the transition — only when
                // the admin entered one. Backend clears it on a non-finite value.
                // NON PAYANT + réparable : le prix final est CALCULÉ CÔTÉ SERVEUR
                // = prix_réparation + main-d'œuvre diagnostic + pièces
                // (setRepairFinalPrice, server-authoritative). PAYANT : on ne
                // persiste que l'estimation de réparation (comparaison ultérieure).
                const hasRepair =
                    Number.isFinite(this.repairEstimate) &&
                    this.repairEstimate != null;
                const estimateSteps = retourFree
                    ? [{ mutation: this.ticketSerice.setRepairEstimate(id, 0) }]
                    : !hasRepair
                    ? []
                    : !this.pricingDiagnosticPayant && !this.isIrreparable
                      ? [
                            {
                                mutation:
                                    this.ticketSerice.setRepairFinalPrice(
                                        id,
                                        this.repairEstimate,
                                    ),
                            },
                        ]
                      : [
                            {
                                mutation: this.ticketSerice.setRepairEstimate(
                                    id,
                                    this.repairEstimate,
                                ),
                            },
                        ];
                // DI NON RÉPARABLE (payant) : après facturation du diagnostic,
                // « Valider le prix » clôture DIRECTEMENT en IRREPARABLE (pas de
                // devis/BC/réparation). Sinon, flux Approval normal (WAITING_DEVIS).
                const transitionStep = this.isIrreparable
                    ? {
                          mutation:
                              this.ticketSerice.changeStatusIrreparableFromPricing(
                                  id,
                              ),
                      }
                    : {
                          mutation: this.ticketSerice.changeStatusNegociate1(id),
                      };
                try {
                    await this.mutationRunner.runChain({
                        key: `pricing:${id}`,
                        steps: [...priceSteps, ...estimateSteps, transitionStep],
                        successToast: {
                            summary: 'Prix initial affecté',
                            detail: 'DI transmise à la négociation.',
                        },
                        errorToast: {
                            summary: 'Erreur',
                            detail: "Échec de l'affectation. Réessayez.",
                        },
                        onLoading: (v) => (this.isLoading = v),
                    });
                    this.loadData();
                    this.pricingModal = false;
                } catch {
                    /* toasted; modal stays open, status unchanged */
                }
            },
        });
    }

    /** « Renvoyer au diagnostic » — from the pricing step (status PRICING), the
     *  admin bounces the DI back to the coordinator (PRICING → PENDING1) so a
     *  technician is re-assigned for a fresh diagnostic. Backend guard enforces
     *  the transition; anti double-submit + single toast via the runner. */
    sendBackToDiagnostic(): void {
        const id = this.current_id;
        if (!id) return;
        this.confirm.confirmSend({
            message: 'Renvoyer cette DI au diagnostic ? Elle repartira au coordinateur pour réaffectation à un technicien.',
            header: 'Renvoyer au diagnostic',
            acceptLabel: 'Renvoyer',
            accept: async () => {
                try {
                    await this.mutationRunner.runChain({
                        key: `backToDiag:${id}`,
                        steps: [
                            {
                                mutation:
                                    this.ticketSerice.sendDiBackToDiagnostic(id),
                            },
                        ],
                        successToast: {
                            summary: 'Renvoyée au diagnostic',
                            detail: 'La DI est repartie au coordinateur pour réaffectation.',
                        },
                        errorToast: {
                            summary: 'Erreur',
                            detail: 'Échec du renvoi au diagnostic. Réessayez.',
                        },
                        onLoading: (v) => (this.isLoading = v),
                    });
                    this.loadData();
                    this.pricingModal = false;
                } catch {
                    /* toasted; modal stays open */
                }
            },
        });
    }

    deleteDi(rowData) {
        this.confirm.confirmDelete({
            message: 'Voulez-vous supprimer cette DI ?',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.deleteDi(rowData._id),
                    })
                    .subscribe(({ loading }) => {
                        this.isLoading = loading;
                        // N'agir qu'à la fin de la mutation (une seule fois).
                        if (loading) return;
                        this.notify.success(
                            rowData?._idnum
                                ? `La demande de service ${rowData._idnum} a été supprimée.`
                                : 'La demande de service a été supprimée.',
                            { summary: 'DI supprimée' },
                        );
                        this.loadData();
                    });
            },
        });
    }

    changeStatusNegiciate1(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusNegociate1(_id),
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    changeStatusNegociate2(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusNegociate2(_id),
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    changeStatusPending3(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusPending3(_id),
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    changeStatusFinished(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeFinishStatus(_id),
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    load() {
        this.loading = true;

        setTimeout(() => {
            this.loading = false;
        }, 2000);
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

    /** Icône du bouton Approval : un gate documentaire = une icône (plus de `$`,
     *  réservé à « Affecter prix »). Défaut = legacy NEGOTIATION1/ATTENTE_BC_DEVIS
     *  + IRREPARABLE retour. */
    approvalActionIcon(status: string): string {
        switch (status) {
            case 'WAITING_DEVIS':
                return 'pi pi-file-edit';
            case 'WAITING_BC':
                return 'pi pi-file-check';
            default:
                return 'pi pi-file';
        }
    }

    approvalActionTooltip(status: string): string {
        switch (status) {
            case 'WAITING_DEVIS':
                return 'Attente devis';
            case 'WAITING_BC':
                return 'Attente BC';
            default:
                return 'Approval (devis/BC)';
        }
    }

    getSt(selected) {
        if (selected && selected.value) {
            this.radioBtn = selected.value;
        }
    }

    onSelectStatusDefaultDI(selectedStatus) {
        this.statusDI = STATUS_DI.CREATED;
        if (selectedStatus.checked) {
            this.statusDI = STATUS_DI.PENDING1;
        } else {
            this.statusDI = STATUS_DI.CREATED;
        }
    }

    createDi() {
        {
            this.confirm.confirmSave({
                message: 'Voulez-vous enregistrer les modifications ?',
                header: "Demande d'intervention",
                accept: () => {
                    const {
                        title,
                        description,
                        client_id,
                        company_id,
                        nSerie,
                        typeClient,
                        remarqueManager,
                        category,
                        location,
                        diagnosticPayant,
                        diagnosticEstimate,
                    } = this.creationDiForm.value;

                    const diInfo = {
                        title,
                        description,
                        client_id,
                        company_id,
                        nSerie,
                        status: this.statusDI,
                        typeClient,
                        remarqueManager,
                        di_category_id: category,
                        location,
                        image: this.payload.file,
                        diagnosticPayant,
                        // Estimation seulement si payant (sinon null).
                        diagnosticEstimate: diagnosticPayant
                            ? diagnosticEstimate
                            : null,
                    };
                    console.log('data used is ', diInfo);
                    this.apollo
                        .mutate<CreateDiMutationResult>({
                            mutation: this.ticketSerice.createDi(diInfo),
                            useMutationLoading: true,
                        })
                        .subscribe(({ data, loading }) => {
                            console.log(
                                'loadingloadingloadingloadingloadingloading',
                                loading,
                            );
                            this.isLoading = loading;
                            this.loadingCreatingDi = loading;

                            if (data) {
                                this.notify.success(
                                    "La demande d'intervention a été créée.",
                                );

                                this.creationDiForm.reset();
                                this.payload.file = '';
                                this.imageDropFile = null;
                                this.openAddDiModal = false;
                                this.loadData();
                                this.getStatusCount();
                            }
                        });
                },
            });
        }
    }

    getCompanyList() {
        this.apollo
            .watchQuery<GetCompaniesQueryResult>({
                query: this.ticketSerice.getCompanies(),
            })
            .valueChanges.subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.companiesListDropDown =
                        data.getAllComapnyforDropDown.map((Company) => ({
                            company_name: `${Company.name}`,
                            value: Company._id,
                        }));
                }
            });
    }

    getClientList() {
        this.apollo
            .watchQuery<GetClientsQueryResult>({
                query: this.ticketSerice.getClients(),
            })
            .valueChanges.subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.clientListDropDown = data.getAllClient.map(
                        (client) => ({
                            label: `${client.first_name} ${client.last_name}`,
                            value: client._id,
                        }),
                    );
                }
            });
    }

    onSlideEnd(percent) {
        this.slideEnd = percent.value;
    }

    onSlideAdminEnd(percent) {
        this.slideAdminEnd = percent.value;
    }

    changeStatusDiToInMagasin(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusDiToInMagasin(_id),
            })
            .subscribe(() => {});
    }

    changeStatusRetour1(_id, reason?: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusRetour1(_id, reason),
            })
            .subscribe(() => {});
    }

    changeStatusRetour2(_id, reason?: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusRetour2(_id, reason),
            })
            .subscribe(() => {});
    }

    changeStatusRetour3(_id, reason?: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusRetour3(_id, reason),
            })
            .subscribe(() => {});
    }

    changeToPending1(data) {
        this.confirm.confirmSend({
            message: 'Voulez-vous envoyer cette DI au coordinateur ?',
            header: "Relancer la demande d'intervention",
            acceptLabel: 'Relancer',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.changeToPending1(data._id),
                    })
                    .subscribe(({ loading }) => {
                        this.isLoading = loading;
                    });

                this.loadData();
            },
        });
    }

    nego1nego2_InMagasin(_id: string, price, final_price?) {
        console.log(_id, price, final_price, 'id here ----------');

        if (final_price == undefined) {
            this.apollo
                .mutate<any>({
                    mutation:
                        this.ticketSerice.nego1nego2_InMagasin_noFinalPrice(
                            _id,
                            price,
                        ),
                })
                .subscribe(({ data, loading }) => {
                    console.log('data', data);
                    this.isLoading = loading;
                });
        } else {
            this.apollo
                .mutate<any>({
                    mutation: this.ticketSerice.nego1nego2_InMagasin(
                        _id,
                        price,
                        final_price,
                    ),
                })
                .subscribe(({ data, loading }) => {
                    console.log('data', data);
                    this.isLoading = loading;
                });
        }
    }

    discountByPercent() {
        this.discountedPriceNeg = (this.price * this.discountPercent) / 100;
        this.finalPrice = this.price - this.discountedPriceNeg;
    }

    discountByPercent2() {
        this.discountedPriceNeg = (this.price * this.discountPercent) / 100;
        this.finalPrice = this.price - this.discountedPriceNeg;
    }

    nextNegociate2() {
        this.confirm.confirmSend({
            message: "Voulez-vous envoyer cette DI à l'admin manager ?",
            header: 'Envoi à l’administration',
            accept: () => {
                if (this.secondNegocition) {
                    this.changeStatusNegociate2(this.secondNegocition);
                    this.negocite1Modal = false;
                    this.loadData();
                }
            },
        });
    }

    exportPdf() {
        const headers = this.cols.map((col) => col.header);

        const diList = this.diList.map((di) => [
            di.title,
            di.status,
            di.client_id,
            di.createdBy,
        ]);

        Promise.all([import('jspdf'), import('jspdf-autotable')])
            .then(([jsPDF, { default: autoTable }]) => {
                const doc = new jsPDF.default('p', 'px', 'a4');
                autoTable(doc, {
                    head: [headers],
                    body: diList,
                });
                doc.save('Users.pdf');
            })
            .catch(() => {});
    }

    exportExcel() {
        import('xlsx').then((xlsx) => {
            const worksheet = xlsx.utils.json_to_sheet(this.diList);
            const workbook = {
                Sheets: { data: worksheet },
                SheetNames: ['data'],
            };
            const excelBuffer: any = xlsx.write(workbook, {
                bookType: 'xlsx',
                type: 'array',
            });
            this.saveAsExcelFile(excelBuffer, 'products');
        });
    }

    saveAsExcelFile(buffer: any, fileName: string): void {
        let EXCEL_TYPE =
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
        let EXCEL_EXTENSION = '.xlsx';
        const data: Blob = new Blob([buffer], {
            type: EXCEL_TYPE,
        });
        FileSaver.saveAs(
            data,
            fileName + '_export_' + new Date().getTime() + EXCEL_EXTENSION,
        );
    }

    /**
     * Le bouton « Retour » est-il disponible sur cette ligne ?
     *
     * Toute la phase de CLÔTURE DOCUMENTAIRE y donne droit — `WAITING_BL`,
     * `WAITING_FACTURE` et les valeurs legacy `CLOSING` / `ATTENTE_BL_FACTURE`
     * (via `isClosingStatus`) — plus la DI clôturée (`FINISHED`). Avant, la
     * règle était une liste de DEUX valeurs codée en dur dans le template :
     * `WAITING_FACTURE` était grisé alors que le back accepte le retour depuis
     * n'importe quel statut, et que le bouton « Fichiers » de la même cellule
     * couvre déjà les quatre statuts de clôture.
     *
     * Seule limite réelle : 3 retours maximum (`countIgnore` plafonne à 3).
     */
    canRetour(rowData: any): boolean {
        if (!rowData || rowData.ignoreCount === 3) {
            return false;
        }
        return (
            isClosingStatus(rowData.status) ||
            rowData.status === STATUS_DI.FINISHED
        );
    }

    /** Open the retour dialog so the user can enter a motif before returning. */
    ignore(_idticket) {
        this.retourTarget = _idticket;
        this.retourMotifInput = '';
        this.retourDialogVisible = true;
    }

    /**
     * Confirme le retour — UNE seule mutation, le serveur fait le reste.
     *
     * Avant : `countIgnore` puis, dans le callback, `changeStatusRetour{1,2,3}`
     * choisi d'après le compteur renvoyé. Deux mutations non atomiques pilotées
     * par le client — si la seconde échouait, la DI gardait un compteur
     * incrémenté avec un statut inchangé, et le cycle retour écrivait alors sur
     * les données du flux original. Le niveau est désormais revendiqué par le
     * serveur (plafond de 3 compris) et renvoyé.
     *
     * Le PV de réunion (en pause, cf. `REUNION_PV_ON_RETOUR_ENABLED`) s'ouvre
     * APRÈS la transition : le fermer sans enregistrer
     * ne doit jamais annuler le retour.
     */
    confirmRetour() {
        const _idticket = this.retourTarget;
        if (!_idticket) return;
        const reason = (this.retourMotifInput || '').trim();
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.startRetour(_idticket._id, reason),
            })
            .subscribe({
                next: ({ data, loading }) => {
                    this.isLoading = loading;
                    const level = data?.changeStatusRetour?.level as
                        | 1
                        | 2
                        | 3
                        | undefined;

                    if (level) {
                        const ticketIndex = this.diList.findIndex(
                            (item) => item._id === _idticket._id,
                        );
                        if (ticketIndex !== -1) {
                            this.diList[ticketIndex].ignoreCount = level;
                        }
                        if (REUNION_PV_ON_RETOUR_ENABLED) {
                            this.openReunionPv(_idticket, level, reason);
                        } else {
                            this.notify.success(
                                `Retour ${level} enregistré pour ${_idticket?._idnum ?? 'la DI'}.`,
                                { summary: 'Retour enregistré' },
                            );
                        }
                        this.loadData?.();
                    }

                    this.closeRetourDialog();
                },
                error: (err) => {
                    this.isLoading = false;
                    // Le serveur refuse au-delà de 3 retours : on le dit, plutôt
                    // que de fermer la modale comme si c'était passé.
                    const code =
                        err?.graphQLErrors?.[0]?.extensions?.code ?? null;
                    this.notify.error(
                        code === 'RETOUR_LIMIT_REACHED'
                                ? 'Cette DI a déjà atteint le maximum de 3 retours.'
                                : "Échec de l'enregistrement du retour. Réessayez.",
                        { summary: 'Retour refusé' },
                    );
                    this.closeRetourDialog();
                },
            });
    }

    private closeRetourDialog(): void {
        this.retourDialogVisible = false;
        this.retourTarget = null;
        this.retourMotifInput = '';
        this.cdr.detectChanges();
    }

    /** Open the PV modal pre-filled with the DI + retour context. */
    openReunionPv(
        ticket: any,
        niveau: 1 | 2 | 3,
        motif: string,
    ): void {
        this.reunionPvDiId = ticket?._id ?? null;
        this.reunionPvDiIdnum = ticket?._idnum ?? null;
        this.reunionPvNiveau = niveau;
        this.reunionPvMotif = motif;
        this.reunionPvModalVisible = true;
    }

    onReunionPvCreated(evt: { _id: string; reference: string }): void {
        // PV persisted backend-side; the inverse link `Di.pvReunions` was
        // also pushed. Refresh the list so the new PV count surfaces.
        this.loadData?.();
    }

    onReunionPvCancelled(): void {
        // Pure UX: the retour transition has already fired and stays.
        this.reunionPvModalVisible = false;
    }

    addCategoryDi() {
        this.confirm.confirmCreate({
            message: 'Voulez-vous créer cette catégorie ?',
            accept: () => {
                typeof (this.categoryForm.value.categoryName, 'TYPE');
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.addCatgoryDi(
                            this.categoryForm.value.categoryName,
                        ),
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;
                        console.log(data, 'add category');
                        if (data) {
                            let obj: { value: string; category_name: string } =
                                {
                                    value: '',
                                    category_name: '',
                                };
                            obj.category_name =
                                data?.createDiCategory?.category;
                            obj.value = data?.createDiCategory?._id;
                            this.categorieDiListDropDown.push(obj);
                            this.categoryForm.reset();
                        }
                    });
            },
        });
    }

    addLocation() {
        this.confirm.confirmCreate({
            message: 'Voulez-vous créer cet emplacement ?',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.addLocation(
                            this.locationForm.value.locationName,
                        ),
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;
                        if (data) {
                            this.locationDropDown.push(
                                this.toLocationOption(data?.createLocation),
                            );
                            this.locationForm.reset();
                        }
                    });
            },
        });
    }

    allCategoryDi() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllDiCategory(),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.categorieDiListDropDown = data.findAllDiCategory.map(
                        (categoryDi) => ({
                            category_name: `${categoryDi.category}`,
                            value: categoryDi._id,
                        }),
                    );
                }
            });
    }

    onPaste(event: ClipboardEvent) {
        console.log('🍚');
        const clipboardData = event.clipboardData?.getData('text') || '';
        const sanitizedData = clipboardData.replace(/(\r\n|\n|\r)/gm, ' ');

        event.preventDefault();
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        target.value = sanitizedData;
    }

    getLocationList() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllLocation(),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                console.log(data, 'data LOCATIONS ');

                this.locationDropDown = data.findAllLocation.map((el) =>
                    this.toLocationOption(el),
                );
            });
    }

    toLocationOption(location: any) {
        const storedDiCount =
            location?.storedDiCount ?? location?.current_item_stored ?? 0;

        return {
            ...location,
            location_name: location?.location_name || '—',
            value: location?._id,
            storedDiCount,
            hasStoredDi: location?.hasStoredDi ?? storedDiCount > 0,
        };
    }

    getLocationOccupancyLabel(location: any): string {
        const count = location?.storedDiCount ?? 0;
        return count > 0 ? `Occupied (${count})` : 'Empty';
    }

    getLocationOccupancyClass(location: any): string {
        const count = location?.storedDiCount ?? 0;
        const capacity = location?.max_capacity;

        if (capacity && count >= capacity) {
            return 'location-occupancy--full';
        }

        return count > 0
            ? 'location-occupancy--occupied'
            : 'location-occupancy--empty';
    }

    onImageSelect(event: any) {
        if (event?.files?.length) {
            this.uploadFileLoading = true;
        }
    }

    onImageUploadError() {
        this.uploadFileLoading = false;
        this.notify.error(
            "L'image n'a pas pu être préparée.",
            { summary: 'Image non chargée' },
        );
    }

    /** Image chosen via the drag & drop zone → reuse the existing image upload
     *  pipeline (`onUpload` → base64 → `payload.file` → createDi). */
    onImageDropSelected(file: File) {
        this.imageDropFile = file;
        this.uploadFileLoading = true;
        this.onUpload({ files: [file] }, 'image');
    }

    /** Drag & drop zone cleared → drop the staged image. */
    onImageDropRemoved() {
        this.imageDropFile = null;
        this.payload = { file: '' };
    }

    /** BC / Devis dropped in the price-final modal → upload AND persist in one
     *  step (no separate "Enregistrer" button, no confirm dialog). The card
     *  badge flips to "Chargé ✓" once saved. */
    onDocDrop(file: File, type: 'BC' | 'Devis') {
        if (!file) return;
        if (type === 'BC') this.bcLoading = true;
        else this.devisLoading = true;

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            const blobUrl = URL.createObjectURL(file);
            if (type === 'BC') {
                this.instantSelectedBc = blobUrl;
                this.bcUploaded = true;
            } else {
                this.instantSelectedDevis = blobUrl;
                this.devisUploaded = true;
            }
            this.payload = { file: base64 };
            this.persistDoc(type);
        };
        reader.onerror = () => {
            if (type === 'BC') this.bcLoading = false;
            else this.devisLoading = false;
            this.notify.error(
                'Le PDF n’a pas pu être préparé.',
                { summary: 'Fichier non chargé' },
            );
        };
        reader.readAsDataURL(file);
    }

    /** Persist a dropped BC/Devis straight away (auto-save). */
    private persistDoc(type: 'BC' | 'Devis') {
        const mutation =
            type === 'BC'
                ? this.ticketSerice.addBC(this._idDi, this.payload.file)
                : this.ticketSerice.addDevis(this._idDi, this.payload.file);
        this.apollo
            .mutate<any>({ mutation, useMutationLoading: true })
            .subscribe({
                next: ({ loading }) => {
                    if (type === 'BC') {
                        this.bcLoading = loading;
                        this.devisBtnDisabled = loading;
                    } else {
                        this.devisLoading = loading;
                        this.bcBtnDisabled = loading;
                    }
                    this.isLoading = loading;
                    if (!loading) {
                        this.notify.success(
                            `${type} enregistré avec succès`,
                        );
                        // L'upload du devis fait avancer le statut côté back
                        // (WAITING_DEVIS → WAITING_BC). On recharge la liste pour
                        // que le nouveau statut s'affiche SANS refresh manuel.
                        this.loadData();
                    }
                },
                error: () => {
                    if (type === 'BC') this.bcLoading = false;
                    else this.devisLoading = false;
                },
            });
    }

    /** Téléversement BC / Devis / image. Les emplacements BL et Facture ont
     *  quitté cette méthode avec la modale « Affectation des Fichiers » : ils
     *  sont gérés par `di-files-modal`, qui a son propre lecteur de fichier. */
    onUpload(event: any, type: 'image' | 'BC' | 'Devis') {
        // Emplacement verrouillé une fois le document chargé : on ignore toute
        // nouvelle sélection (couvre le drag-drop, que [disabled] ne bloque pas).
        // Demande produit : « une fois le fichier uploadé, désactiver l'endroit
        // d'upload ».
        const alreadyUploaded =
            (type === 'BC' && this.bcReady) ||
            (type === 'Devis' && this.devisReady);
        if (alreadyUploaded) return;
        this.uploadFileLoading = true;
        if (type !== 'image') {
            this.isLoading = this.uploadFileLoading;
        }

        // ADD THESE: set per-file loading spinner
        if (type === 'BC') this.bcLoading = true;
        else if (type === 'Devis') this.devisLoading = true;

        for (let file of event.files) {
            const reader = new FileReader();
            reader.readAsArrayBuffer(file);
            const readerForBase64 = new FileReader();
            readerForBase64.readAsDataURL(file);

            reader.onload = () => {
                const arrayBuffer = reader.result as ArrayBuffer;
                const blob = new Blob([arrayBuffer], {
                    type: 'application/pdf',
                });
                const blobUrl = URL.createObjectURL(blob);

                if (type === 'BC') {
                    this.instantSelectedBc = blobUrl;
                    this.bcUploaded = true;
                    this.devisBtnDisabled = true;
                    this.enregistrerBcBtncondition = false;
                    this.bcLoading = false; // STOP spinner
                } else if (type === 'Devis') {
                    this.devisUploaded = true;
                    this.instantSelectedDevis = blobUrl;
                    this.bcBtnDisabled = true;
                    this.enregistrerDevisBtncondition = false;
                    this.devisLoading = false; // STOP spinner
                }

                if (type !== 'image') {
                    this.uploadFileLoading = false;
                    this.isLoading = this.uploadFileLoading;
                }

                this.notify.success('Le fichier a été enregistré.');
            };

            reader.onerror = (error) => {
                console.error('File read error:', error);
                this.uploadFileLoading = false;
                if (type !== 'image') {
                    this.isLoading = this.uploadFileLoading;
                }
                this.bcLoading = false; // STOP spinner on error
                this.devisLoading = false;
            };

            readerForBase64.onload = () => {
                const base64 = readerForBase64.result as string;
                this.uploadFile(base64, type);
                if (type === 'image') {
                    this.uploadFileLoading = false;
                }
            };

            readerForBase64.onerror = (error) => {
                console.error('Base64 conversion error:', error);
                if (type === 'image') {
                    this.onImageUploadError();
                }
            };
        }
    }

    isFormComplete() {
        return this.bcUploaded && this.devisUploaded;
    }

    uploadFile(base64: string, type: string) {
        if (type === 'image') {
            const payload = {
                file: base64,
            };

            this.payload = payload;
        }
        if (type === 'BC') {
            const payload = {
                file: base64,
            };

            this.payload = payload;
        }
        if (type === 'Devis') {
            const payload = {
                file: base64,
            };
            this.payload = payload;
        }
        if (type === 'BL') {
            const payload = {
                file: base64,
            };
            this.payload = payload;
        }
        if (type === 'Facture') {
            const payload = {
                file: base64,
            };
            this.payload = payload;
        }
    }

    deletLocation(rowData) {
        console.log(rowData, 'eee');
        this.confirm.confirmDelete({
            message: 'Voulez-vous supprimer cet emplacement ?',
            accept: () => {
                console.log('DELETING now');
                console.log(rowData, 'data we gonna USE');

                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.deleteLocation(
                            rowData.value,
                        ),
                    })

                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;
                        if (data) {
                            const index = this.locationDropDown.findIndex(
                                (el) => el.value === rowData.value,
                            );
                            this.locationDropDown.splice(index, 1);
                        }
                    });
            },
        });
    }

    deleteCategory(selected) {
        this.confirm.confirmDelete({
            message: 'Voulez-vous supprimer cette catégorie ?',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.removeCategory(
                            selected.value,
                        ),
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;
                        if (data) {
                            const index =
                                this.categorieDiListDropDown.findIndex((el) => {
                                    return el.value === selected.value;
                                });
                            this.categorieDiListDropDown.splice(index, 1);
                        }
                    });
            },
        });
    }

    annulerDi() {
        this.openAddDiModal = false;
        this.creationDiForm.reset();
        this.payload = { file: '' };
        this.imageDropFile = null;
    }

    /** Bouton trombone d'une ligne : la DI est déjà en main, on la passe au
     *  service qui pilote la modale globale (aucune requête supplémentaire). */
    openUploadFileFinished(dataselected: any) {
        this.diFiles.open(dataselected);
    }





    /**
     * Le dossier vient d'être modifié (édition ADMIN_TECH dans le modal).
     * Sans ce rafraîchissement la ligne de la liste gardait ses anciennes
     * valeurs jusqu'au prochain rechargement manuel.
     */
    onDiUpdatedFromModal(): void {
        this.ticketRefreshService.requestRefresh('ticket-list', {
            source: 'di-info-modal:updated',
        });
    }

    openTicketDetails(data: any) {
        Promise.all([
            this.getLogsDi(data._id),
            this.getLogsData(data._id).toPromise(),
        ])
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
                console.log('data inside =>', this.ticketData.data);
            })
            .catch((error) => {
                console.error('Error fetching logs:', error);
            });
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
            .pipe(map(({ data }) => data?.getStatByIdlogs || []));
    }

    /** Affichage BRUT de la valeur DB en MAJUSCULES (décision produit : plus de
     *  libellés « jolis » ; on montre le statut tel qu'il est stocké). */
    getStatusLabel(status: string): string {
        // Affichage BRUT en MAJUSCULES. PRICING_DIAG et son ancienne valeur
        // PRICING sont ramenés au MÊME libellé « PRICING » : les deux valeurs
        // coexistent en base (renommage forward-only, sans backfill) et la
        // colonne « Statut » afficherait sinon deux libellés pour un même état.
        const s = (status ?? '').toString().trim();
        if (s === 'PRICING_DIAG' || s === 'PRICING') return 'PRICING';
        return s.toUpperCase() || '—';
    }
}
