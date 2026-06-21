import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Product } from 'src/app/demo/api/product';

import {
    MessageService,
    PrimeNGConfig,
    ConfirmationService,
} from 'primeng/api';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
import { STATUS_DI } from 'src/app/layout/api/status-di';
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
import {
    formatTableValue,
    isLocationColumn,
    rowHasLoadedComposants,
    trackByColumn,
} from '../table-display.utils';

@Component({
    selector: 'app-ticket-list',
    standalone: false,
    templateUrl: './ticket-list.component.html',
    styleUrl: './ticket-list.component.scss',
})
export class TicketListComponent implements OnInit, OnDestroy {
    private companySearch$ = new Subject<string>();
    // Search state tracking
    private currentSearchField: string = '';
    private currentSearchValue: string = '';
    private searchSubject$ = new Subject<void>();
    private destroy$ = new Subject<void>();
    private lastSearchKey = '';

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
    blLoading: boolean = false;
    factureLoading: boolean = false;

    filsFinished: boolean = false;
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
    });
    updateDiForm = new FormGroup({
        title: new FormControl('', [Validators.required]),
        description: new FormControl('', [Validators.required]),
        typeClient: new FormControl(),
        status: new FormControl(),
        client_id: new FormControl(),
        company_id: new FormControl(),
        nSerie: new FormControl(),
        category: new FormControl(),
        location: new FormControl(),
        remarqueManager: new FormControl(),
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
        { label: 'Inmagasin', value: 'INMAGASIN' },
        { label: 'Pending2', value: 'PENDING2' },
        { label: 'Pricing', value: 'PRICING' },
        { label: 'Negotiation1', value: 'NEGOTIATION1' },
        { label: 'Negotiation2', value: 'NEGOTIATION2' },
        { label: 'Pending3', value: 'PENDING3' },
        { label: 'Reparation', value: 'REPARATION' },
        { label: 'Inreparation', value: 'INREPARATION' },
        { label: 'Finished', value: 'FINISHED' },
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
    seletedRow: any;
    discountedPriceNeg: number = 0;
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
    allComposants = [];
    number_total_composant: number = this.allComposants.length;
    name_composant: any;
    ArrayofcomposantDATA: DiQueryResult;
    oneComposant_QueryValue: DiQueryResult;
    $composant: any;
    current_id: any;
    timeDiagnostique: string;
    ignoreCount: any;
    composantQuantity: number;
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

    facturePDF: { file: string };
    blPDF: { file: string };
    private _idPDFFinished: string;
    ticketDetailsInfo: boolean;
    selectedTicket: any;
    updateticketView: boolean;
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
    selectedBL: string;
    selectedFacture: string;
    ignoreCountNeg1: any;
    logsDi: any;
    finishedData: any;
    filesSelected: any;
    isErrorFromFixtronix: any;
    ignoreCountPricing: number;
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
    enregistrerBlBtncondition: boolean = true;
    enregistrerFactureBtncondition: boolean = true;
    enregistrerBcBtncondition: boolean = true;
    enregistrerDevisBtncondition: boolean = true;

    // ─── "Affectation des Fichiers" modal (redesign of `filsFinished`) ─────
    // The existing modal lives on the FINISHED row's `pi-paperclip` button →
    // `openUploadFileFinished()` → `filsFinished = true`. We keep that flow
    // and just redesign its body to the design/image.png target. These two
    // helpers are pure presentation:
    //   `affectationDocTypes` drives the 4 status cards (BC/BL/Facture/Devis).
    //   `formatFileSize` formats pending file sizes.
    readonly affectationDocTypes: Array<{
        key: 'BC' | 'BL' | 'Facture' | 'Devis';
        tag: string;
        label: string;
        field:
            | 'bon_de_commande'
            | 'bon_de_livraison'
            | 'facture'
            | 'devis';
    }> = [
        { key: 'BC', tag: 'BC', label: 'Bon de commande', field: 'bon_de_commande' },
        { key: 'BL', tag: 'BL', label: 'Bon de livraison', field: 'bon_de_livraison' },
        { key: 'Facture', tag: 'FAC', label: 'Facture', field: 'facture' },
        { key: 'Devis', tag: 'DEV', label: 'Devis', field: 'devis' },
    ];

    /** Count of "Disponible" docs on the current `filesSelected` row.
     *  Drives the `FICHIERS PRINCIPAUX (n)` pill in the header. */
    get affectationAvailableCount(): number {
        if (!this.filesSelected) return 0;
        return this.affectationDocTypes.filter(
            (t) => !!this.filesSelected[t.field],
        ).length;
    }

    /** Files ready to persist (selected via PrimeNG `customUpload` but not yet
     *  saved). The existing flow keeps the BL preview in `selectedBL` and the
     *  Facture preview in `selectedFacture` (set by `onUpload`). */
    get affectationPendingCount(): number {
        return (
            (this.selectedBL ? 1 : 0) + (this.selectedFacture ? 1 : 0)
        );
    }

    /** Per-slot drag-over highlight (key = `'BL'` / `'Facture'`). Visual only —
     *  reset on drag-leave / drop / picker-pick. */
    afDragActive: Record<string, boolean> = {};

    /** Per-type base64 cache so the single footer "Enregistrer" can persist
     *  BOTH BL and Facture in one cascade. The legacy `this.payload.file` is
     *  a single string that gets overwritten on every upload — using it for a
     *  multi-file save would re-send the LAST file's content for every slot.
     *  Populated by `onUpload` once FileReader resolves the data-URL. */
    affectationBase64: Record<string, string> = {};

    /** Drag-and-drop or picker → reuse the existing `onUpload(event, key)`
     *  flow (FileReader → base64 → mutation). The event shape is exactly what
     *  PrimeNG's customUpload provides: `{ files: File[] }` — `onUpload`
     *  iterates `event.files` so the synthesized object stays compatible. */
    onAfDragOver(ev: DragEvent, key: string) {
        ev.preventDefault();
        this.afDragActive = { ...this.afDragActive, [key]: true };
    }
    onAfDragLeave(ev: DragEvent, key: string) {
        ev.preventDefault();
        this.afDragActive = { ...this.afDragActive, [key]: false };
    }
    onAfDrop(ev: DragEvent, key: string) {
        ev.preventDefault();
        this.afDragActive = { ...this.afDragActive, [key]: false };
        const all = Array.from(ev.dataTransfer?.files ?? []);
        // Keep PDFs only — the dropzone's accept attribute is hint-only on drop.
        const files = all.filter((f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name));
        if (!files.length) {
            this.messageservice?.add?.({
                severity: 'warn',
                summary: 'Format non supporté',
                detail: 'Glissez un fichier PDF.',
            });
            return;
        }
        this.onUpload({ files }, key);
    }
    onAfPicker(ev: Event, key: string) {
        const input = ev.target as HTMLInputElement;
        const files = Array.from(input.files ?? []);
        if (!files.length) return;
        this.onUpload({ files }, key);
        // Reset so picking the same file again still fires `change`.
        input.value = '';
    }

    /** Single "Enregistrer" for the Affectation modal — persists every
     *  pending file (BL and/or Facture) in one cascade, with one confirm
     *  dialog and one toast. Matches the design's single-CTA footer (the
     *  legacy per-slot "Enregistrer BL / Facture" buttons are gone).
     *  MutationRunner handles anti-double-click and spinner reset. */
    saveAffectationFichiers() {
        const id = this._idPDFFinished;
        if (!id) return;
        const bl = this.affectationBase64['BL'];
        const fac = this.affectationBase64['Facture'];
        if (!bl && !fac) {
            this.filsFinished = false;
            return;
        }
        const count = (bl ? 1 : 0) + (fac ? 1 : 0);
        this.confirmationService.confirm({
            message: `Enregistrer ${count} fichier${count > 1 ? 's' : ''} ?`,
            header: 'Confirmation',
            icon: 'pi pi-question-circle',
            accept: async () => {
                const steps: Array<{ mutation: any }> = [];
                if (bl) steps.push({ mutation: this.ticketSerice.addBL(id, bl) });
                if (fac)
                    steps.push({
                        mutation: this.ticketSerice.addFacture(id, fac),
                    });
                try {
                    await this.mutationRunner.runChain({
                        key: `affectationFichiers:${id}`,
                        steps,
                        successToast: {
                            summary: 'Fichiers enregistrés',
                            detail: `${count} fichier${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} au dossier Drive.`,
                        },
                        errorToast: {
                            summary: 'Erreur',
                            detail: "Échec de l'enregistrement. Réessayez.",
                        },
                        onLoading: (v) => (this.isLoading = v),
                    });
                    // Reset selection / cache so the cards flip to "Disponible"
                    // on the next data refresh.
                    this.selectedBL = '';
                    this.selectedFacture = '';
                    this.affectationBase64 = {};
                    this.enregistrerBlBtncondition = true;
                    this.enregistrerFactureBtncondition = true;
                    this.blBtnDisabled = false;
                    this.factureBtnDisabled = false;
                    this.filsFinished = false;
                    this.loadData();
                } catch {
                    /* toasted; modal stays open so the user can retry */
                }
            },
        });
    }

    /** Pretty file size: `n o` / `n Ko` / `n,nn Mo`. */
    formatFileSize(bytes: number | undefined): string {
        if (!Number.isFinite(bytes) || (bytes ?? 0) <= 0) return '0 o';
        const n = bytes as number;
        if (n < 1024) return `${n} o`;
        if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
        return `${(n / (1024 * 1024)).toFixed(2).replace('.', ',')} Mo`;
    }

    // Pricing-modal chips: label + multiplier vs the cost base (1.0 = Coût).
    // Order matters: rendered as a row.
    readonly pricingChips: Array<{ label: string; mult: number }> = [
        { label: 'Coût', mult: 1 },
        { label: '+20 %', mult: 1.2 },
        { label: '+30 %', mult: 1.3 },
        { label: '+50 %', mult: 1.5 },
    ];
    activePricingChip: number | null = null;

    /** Coût total = facturation diagnostic + total composants. Single source
     *  of truth for the marge calc + chip multipliers. Components may be null
     *  while the modal is still loading; coerce to 0 so the UI shows 0,000 TND
     *  rather than NaN. */
    get pricingCoutTotal(): number {
        const f = Number(this.facturationDiagnostique) || 0;
        const c = Number(this.totalComposant) || 0;
        return f + c;
    }

    /** Marge live vs the cost base: positive=green, negative=red (price below
     *  cost). Returned as both TND delta and % so the pill can show both. */
    get pricingMarge(): {
        tnd: number;
        percent: number;
        positive: boolean;
    } | null {
        const base = this.pricingCoutTotal;
        const p = Number(this.price);
        if (!base || !Number.isFinite(p)) return null;
        const tnd = p - base;
        const percent = (tnd / base) * 100;
        return { tnd, percent, positive: tnd >= 0 };
    }

    /** Gating for "Confirmer le prix final": both BC and Devis must be present
     *  (already persisted OR uploaded in this session). Same rule applies to
     *  négo1 and négo2 — no bypass per spec. */
    get bcReady(): boolean {
        return !!(this.selectedBc || this.instantSelectedBc);
    }
    get devisReady(): boolean {
        return !!(this.selectedDevis || this.instantSelectedDevis);
    }
    get prixFinalCanConfirm(): boolean {
        return (
            this.bcReady &&
            this.devisReady &&
            Number(this.price) > 0 &&
            !this.isLoading
        );
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

    /** Click on a pricing chip → fill price with cost × multiplier (rounded to
     *  3 dp to match the display format). Stores the active chip index for the
     *  pressed-state highlight. */
    applyPricingChip(index: number) {
        const chip = this.pricingChips[index];
        if (!chip) return;
        const base = this.pricingCoutTotal;
        if (!base) return;
        this.price = Math.round(base * chip.mult * 1000) / 1000;
        this.activePricingChip = index;
    }

    /** Recompute the final price live as the user moves the slider / types in
     *  the input — spec says no separate "Appliquer remise" button. Source of
     *  truth = remise %. Soft cap at 20: values > 20 trigger a warning banner
     *  in the template (negociation 2 / admin approval path). */
    onDiscountChange() {
        const p = Number(this.price);
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
    totalDiCount: any;
    isLoading: boolean = true;

    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private cdr: ChangeDetectorRef,
        private readonly messageservice: MessageService,
        private readonly notificationService: NotificationService,
        private config: PrimeNGConfig,
        private confirmationService: ConfirmationService,
        private ticketRefreshService: TicketRefreshService,
        private readonly mutationRunner: MutationRunner,
    ) {}

    ngOnInit() {
        this.getStatusCount();
        this.loadData();
        this.getCompanyList();
        this.getClientList();
        this.allCategoryDi();
        this.getLocationList();
        this.notificationService.startWorker();

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
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Centralized data loading method
     * Handles both search and regular data fetching with pagination
     */
    loadData() {
        this.isLoading = true;

        const hasActiveSearch =
            this.currentSearchField &&
            this.currentSearchValue &&
            this.currentSearchValue.trim().length > 0;

        if (hasActiveSearch) {
            // Perform search
            this.apollo
                .query<any>({
                    query: this.ticketSerice.searchDi(
                        this.currentSearchField,
                        this.currentSearchValue,
                        this.first,
                        this.rows,
                    ),
                    fetchPolicy: 'no-cache',
                })
                .pipe(finalize(() => (this.isLoading = false)))
                .subscribe(({ data }) => {
                    if (data && data.searchDi) {
                        this.diList = data.searchDi.di;
                        this.totalDiCount = data.searchDi.totalDiCount;
                        this.updateCounters();
                    }
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
                .pipe(finalize(() => (this.isLoading = false)))
                .subscribe(({ data }) => {
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
                case 'INMAGASIN':
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
     * Handle column search
     */
    onColumnSearch(field: string, value: string) {
        const v = value?.trim();
        const f = field?.trim();
        const searchKey = `${f || ''}:${v || ''}`;

        if (searchKey === this.lastSearchKey) {
            return;
        }

        this.lastSearchKey = searchKey;

        if (v && v.length > 0 && f && f.length > 0) {
            // Set search state
            this.currentSearchField = f;
            this.currentSearchValue = v;
            this.first = 0; // Reset to first page on new search

            // Trigger search
            this.searchSubject$.next();
        } else {
            // Clear search state
            this.currentSearchField = '';
            this.currentSearchValue = '';

            // Load regular data
            this.loadData();
        }
    }

    formatCell(row: any, field: string): string {
        return formatTableValue(row, field);
    }

    isLocationCell(field: string): boolean {
        return isLocationColumn(field);
    }

    hasLoadedComposants(row: any): boolean {
        return rowHasLoadedComposants(row);
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

    updateDi(rowDataTicket: any) {
        this.selectedTicket = rowDataTicket ?? {};
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

    cancelUpdateDi() {
        this.openUpdateModal = false;
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
                        this.messageservice.add({
                            severity: 'success',
                            summary: 'Catégorie mise à jour',
                            detail: `DI ${di._idnum} → ${newCategoryName}`,
                        });
                        this.ticketRefreshService.requestRefresh(
                            'ticket-list',
                            { source: 'mutation:reassignDiCategory' },
                        );
                    }
                    this.reassigningCategoryDiId = null;
                },
                error: (err) => {
                    console.error('reassignDiCategory failed', err);
                    this.messageservice.add({
                        severity: 'error',
                        summary: 'Échec',
                        detail: 'Impossible de mettre à jour la catégorie',
                    });
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
                        this.messageservice.add({
                            severity: 'success',
                            summary: 'Catégorie composant mise à jour',
                            detail: `${comp.name} → ${catName}`,
                        });
                    }
                    this.reassigningComposantId = null;
                },
                error: (err) => {
                    console.error('reassignComposantCategory failed', err);
                    this.messageservice.add({
                        severity: 'error',
                        summary: 'Échec',
                        detail: "Impossible de mettre à jour la catégorie du composant",
                    });
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
                        this.messageservice.add({
                            severity: 'success',
                            summary: 'Emplacement mis à jour',
                            detail: `DI ${di._idnum} → ${this.getLocationNameById(newLocationId)}`,
                        });
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
                    this.messageservice.add({
                        severity: 'error',
                        summary: 'Échec',
                        detail: "Impossible de mettre à jour l'emplacement",
                    });
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
        this.confirmationService.confirm({
            message: 'Voulez-vous créer cette catégorie de composant ?',
            header: 'Confirmation Création',
            icon: 'pi pi-exclamation-triangle',
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
                            this.messageservice.add({
                                severity: 'success',
                                summary: 'Catégorie créée',
                                detail: name,
                            });
                        }
                    });
            },
        });
    }

    deleteComposantCategory(row: { _id: string; category_composant: string }) {
        if (!row?._id) return;
        this.confirmationService.confirm({
            message: `Supprimer la catégorie « ${row.category_composant} » ?`,
            header: 'Confirmation Suppression',
            icon: 'pi pi-exclamation-triangle',
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
                            this.messageservice.add({
                                severity: 'success',
                                summary: 'Catégorie supprimée',
                                detail: row.category_composant,
                            });
                        }
                    });
            },
        });
    }

    saveUpdateTicket() {
        const { _id, title, description, remarque_manager } =
            this.selectedTicket;
        const extractedData = { _id, title, description, remarque_manager };

        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation Update DI',
            icon: 'pi pi-question-circle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.updateTicket(extractedData),
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;
                        if (data) {
                            if (this.selectedTicket._id) {
                                this.diList[
                                    this.findIndexById(this.selectedTicket._id)
                                ] = this.selectedTicket;

                                this.messageservice.add({
                                    severity: 'success',
                                    summary: 'Success',
                                    detail: 'Di a été Modifier',
                                });
                                this.updateticketView = false;
                            }
                        }
                    });
            },
        });
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
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation du prix final',
            icon: 'pi pi-exclamation-triangle',
            accept: async () => {
                const r1 = this.selectedRowInNegociate1;
                const r2 = this.selectedRowInNegociate2;

                // Branch conditions preserved from the original, made MUTUALLY
                // EXCLUSIVE (priority) so the serialized cascade runs exactly
                // ONE transition. Non-repairable wins: the original fired BOTH
                // Pending3 and Finished for (!pdr && !repairable) — a race; the
                // intent is FINISHED (can't repair → done).
                const notRepairable =
                    r1?.can_be_repaired === false ||
                    r2?.can_be_repaired === false;
                const notContainPdr =
                    !r1?.contain_pdr || (!!r2 && !r2?.contain_pdr);
                const containPdrAndRepairable =
                    (r1?.contain_pdr && r1?.can_be_repaired) ||
                    (r2?.contain_pdr && r2?.can_be_repaired);

                let transitionStep:
                    | { mutation: any; variables?: any }
                    | undefined;
                if (notRepairable) {
                    transitionStep = {
                        mutation: this.ticketSerice.changeFinishStatus(
                            this._idDi,
                        ),
                    };
                } else if (notContainPdr) {
                    transitionStep = {
                        mutation: this.ticketSerice.changeStatusPending3(
                            this._idDi,
                        ),
                    };
                } else if (containPdrAndRepairable) {
                    transitionStep = {
                        mutation: this.ticketSerice.changeStatusDiToInMagasin(
                            this._idDi,
                        ),
                    };
                }

                // Step 1: persist the price (no status change). Step 2 (LAST):
                // the transition — only fires after the price is saved, and
                // from the correct source status (M1 guard).
                const priceStep =
                    this.finalPrice == undefined
                        ? {
                              mutation:
                                  this.ticketSerice.nego1nego2_InMagasin_noFinalPrice(
                                      this._idDi,
                                      this.price,
                                  ),
                          }
                        : {
                              mutation: this.ticketSerice.nego1nego2_InMagasin(
                                  this._idDi,
                                  this.price,
                                  this.finalPrice,
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
                } catch {
                    /* toasted; modals stay open, status unchanged past the
                       failed step (no status advance on unsaved price) */
                }
            },
        });
    }

    enregistrerBC() {
        this.confirmationService.confirm({
            message: 'Voulez vous Enregistrer Bon de commande',
            header: 'Confirmation Fichier',
            icon: 'pi pi-exclamation-triangle',
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
        this.confirmationService.confirm({
            message: 'Voulez vous Enregistrer Devis',
            header: 'Confirmation Fichier',
            icon: 'pi pi-exclamation-triangle',
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
                    });

                this.enregistrerDevisBtncondition = true;
            },
        });
    }

    enregistrerBL() {
        this.confirmationService.confirm({
            message: 'Voulez vous Enregistrer Bon de livraison',
            header: 'Confirmation Fichier',
            icon: 'pi pi-exclamation-triangle',
            accept: async () => {
                this.saveBLPDF(this._idPDFFinished, this.payload.file);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                this.factureBtnDisabled = false;
                this.enregistrerBlBtncondition = true;
            },
        });
    }

    enregistrerFacture() {
        this.confirmationService.confirm({
            message: 'Voulez vous Enregistrer Bon de livraison',
            header: 'Confirmation Fichier',
            icon: 'pi pi-exclamation-triangle',
            accept: async () => {
                this.saveFacturePDF(this._idPDFFinished, this.payload.file);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                this.blBtnDisabled = false;
                this.enregistrerFactureBtncondition = true;
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
                console.log('data devis', data);
            });
    }

    saveBLPDF(_id: string, pdf: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addBL(_id, pdf),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                console.log('data BL', data);
            });
    }

    saveFacturePDF(_id: string, pdf: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addFacture(_id, pdf),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                console.log('🥟[data]:', data);
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
        this.isErrorFromFixtronix = data.isErrorFromFixtronix;
        this.ignoreCountPricing = data.ignoreCount;
        this.ignoreCountN1 = data.ignoreCount - 1;

        this.tarif_Technicien = null;
        this.timeDiagnostique = null;
        this.facturationDiagnostique = null;
        this.timepart = null;
        this.initialPriceAffichage = null;
        this.priceRemiseAffichage = null;
        this.pricesLogs = [];
        this.totalComposant = null;
        this.composantQuantity = 0;
        this.allComposants = [];
        this.price = null;
        this.activePricingChip = null;

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
                        this.initialPriceAffichage = data.getDiById.di.price;
                        this.priceRemiseAffichage =
                            data.getDiById.di.final_price;

                        this.pricesLogs = data.getDiById.logsDi
                            .map((el) => {
                                if (el.price && el.idIgnore) {
                                    return {
                                        priceLogs: el.price,
                                        final_priceLog: el.final_price,
                                        ignoreDispaly: el.idIgnore,
                                    };
                                }
                                return null;
                            })
                            .filter((log) => log !== null);
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
                this.facturationDiagnostique = parseFloat(
                    (
                        this.timepart.hours * this.tarif_Technicien +
                        this.timepart.minutes *
                            parseFloat(
                                (this.tarif_Technicien / 60).toFixed(2),
                            ) +
                        parseFloat((this.tarif_Technicien / 60).toFixed(2))
                    ).toFixed(2),
                );
            }
        });

        for (let oneComposant of data.array_composants) {
            this.getcomposantByName(oneComposant.nameComposant);
        }

        this.composantQuantity = this.allComposants.length;

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

        this.seletedRow = data._id;
        this.ignoreCountNeg1 = data.ignoreCount;
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

        this.selectedRowInNegociate2 = data;
        this.slectedRow = data._id;
        this._idDi = data._id;
        this.ignoreCountNeg1 = data.ignoreCount;
        this.negocite2Modal = true;
        this.getTotalComposant(data._id);
        this.getDiByID(this.slectedRow);
    }

    onSizeSelect() {}

    async getcomposantByName(name_composant: string) {
        await this.apollo
            .watchQuery<DiQueryResult>({
                query: this.ticketSerice.composantByName_forAdmin(
                    name_composant,
                ),
            })
            .valueChanges.subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.allComposants.push(data);
                }
            });
    }

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
                    if (this.dataById.getDiById.logsDi) {
                        const filtredLogsDi =
                            this.dataById.getDiById.logsDi.find(
                                (el) => el.idIgnore === this.ignoreCountNeg1,
                            );

                        this.price = filtredLogsDi.price;
                        this.selectedBc = filtredLogsDi.bon_de_commande;
                        this.selectedDevis = filtredLogsDi.devis;
                        console.log('INSIDE LOGS');

                        console.log('this.selectedBc', this.selectedBc);
                        console.log('this.selectedDevis', this.selectedDevis);
                    } else {
                        console.log('OUTSIDE LOGS');
                        this.price = this.dataById.getDiById.di.price;
                        this.selectedBc =
                            this.dataById.getDiById.di.bon_de_commande;
                        this.selectedDevis = this.dataById.getDiById.di.devis;
                        this.selectedDevis
                            ? (this.devisUploaded = true)
                            : (this.devisUploaded = false);
                        this.selectedBc
                            ? (this.bcUploaded = true)
                            : (this.bcUploaded = false);
                        console.log('this.selectedBc', this.selectedBc);
                        console.log('this.selectedDevis', this.selectedDevis);
                    }
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

    pricing() {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation du prix Initial',
            icon: 'pi pi-question-circle',
            accept: async () => {
                // Cascade sérialisée (M2/M5 pattern): persist initial price,
                // THEN transition status. Step 2 only runs if step 1 succeeds,
                // so a failed save never advances the workflow. Per-DI key
                // prevents double-clicks from firing the chain twice.
                const id = this.current_id;
                const priceStep = {
                    mutation: this.ticketSerice.pricing(id, this.price),
                };
                const transitionStep = {
                    mutation: this.ticketSerice.changeStatusNegociate1(id),
                };
                try {
                    await this.mutationRunner.runChain({
                        key: `pricing:${id}`,
                        steps: [priceStep, transitionStep],
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
                    this.activePricingChip = null;
                } catch {
                    /* toasted; modal stays open, status unchanged */
                }
            },
        });
    }

    deleteDi(rowData) {
        this.confirmationService.confirm({
            message: 'Voulez vous supprimer ce DI',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.deleteDi(rowData._id),
                    })
                    .subscribe(({ loading }) => {
                        this.isLoading = loading;
                        const index = this.diList.findIndex((el) => {
                            el._id === rowData._id;
                        });
                        this.diList.splice(index, 0);
                        this.messageservice.add({
                            severity: 'danger',
                            summary: 'Deleted',
                            detail: 'La demande service supprimer',
                        });
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
            case 'INMAGASIN':
            case 'MagasinEstimation':
                return 'warning';
            case 'PRICING':
                return 'warning';
            case 'NEGOTIATION1':
            case 'NEGOTIATION2':
                return 'warning';
            case 'REPARATION':
            case 'INREPARATION':
                return 'info';
            case 'FINISHED':
                return 'success';
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
            this.confirmationService.confirm({
                message: 'Voulez vous confirmer les changements',
                header: "Confirmation Demande d'intevention",
                icon: 'pi pi-question-circle',
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
                                this.messageservice.add({
                                    severity: 'success',
                                    summary: 'Success',
                                    detail: 'La demande service ajouté',
                                });

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
        this.confirmationService.confirm({
            message: 'Voulez-vous envoyer le DI au Coordinateur?',
            header: "Relancer la Demande d'intervention",
            icon: 'pi pi-question-circle',
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
        this.confirmationService.confirm({
            message: 'Voulez vous envoyer ce di a l admin Manager',
            header: 'Confirmation Pricing',
            icon: 'pi pi-exclamation-triangle',
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

    /** Open the retour dialog so the user can enter a motif before returning. */
    ignore(_idticket) {
        this.retourTarget = _idticket;
        this.retourMotifInput = '';
        this.retourDialogVisible = true;
    }

    /** Confirm the retour: bump ignoreCount, then transition with the motif. */
    confirmRetour() {
        const _idticket = this.retourTarget;
        if (!_idticket) return;
        const reason = (this.retourMotifInput || '').trim();
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.ignore(_idticket._id),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    const updatedIgnoreCount = data.countIgnore.ignoreCount;

                    if (updatedIgnoreCount === 1) {
                        this.changeStatusRetour1(_idticket._id, reason);
                    } else if (updatedIgnoreCount === 2) {
                        this.changeStatusRetour2(_idticket._id, reason);
                    } else if (updatedIgnoreCount === 3) {
                        this.changeStatusRetour3(_idticket._id, reason);
                    }

                    const ticketIndex = this.diList.findIndex(
                        (item) => item._id === _idticket._id,
                    );
                    if (ticketIndex !== -1) {
                        this.diList[ticketIndex].ignoreCount =
                            updatedIgnoreCount;
                    }
                }
                this.retourDialogVisible = false;
                this.retourTarget = null;
                this.retourMotifInput = '';
                this.cdr.detectChanges();
            });
    }

    addCategoryDi() {
        this.confirmationService.confirm({
            message: 'Voulez-vous créer cette categorie ?',
            header: 'Confirmation Creation',
            icon: 'pi pi-exclamation-triangle',
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
        this.confirmationService.confirm({
            message: 'Voulez-vous créer cette emplacement ?',
            header: 'Confirmation Creation',
            icon: 'pi pi-exclamation-triangle',
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
        this.messageservice.add({
            severity: 'error',
            summary: 'Image non chargée',
            detail: "L'image n'a pas pu être préparée.",
        });
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

    onUpload(event: any, type: string) {
        this.uploadFileLoading = true;
        if (type !== 'image') {
            this.isLoading = this.uploadFileLoading;
        }

        // ADD THESE: set per-file loading spinner
        if (type === 'BC') this.bcLoading = true;
        else if (type === 'Devis') this.devisLoading = true;
        else if (type === 'BL') this.blLoading = true;
        else if (type === 'Facture') this.factureLoading = true;

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
                } else if (type == 'BL') {
                    this.selectedBL = blobUrl;
                    this.factureBtnDisabled = true;
                } else if (type == 'Facture') {
                    this.selectedFacture = blobUrl;
                    this.blBtnDisabled = true;
                }

                if (type !== 'image') {
                    this.uploadFileLoading = false;
                    this.isLoading = this.uploadFileLoading;
                }

                this.messageservice.add({
                    severity: 'info',
                    summary: 'Fichier enregistré',
                    detail: 'Fichier a été ajouté avec succès',
                });
            };

            reader.onerror = (error) => {
                console.error('File read error:', error);
                this.uploadFileLoading = false;
                if (type !== 'image') {
                    this.isLoading = this.uploadFileLoading;
                }
                this.bcLoading = false; // STOP spinner on error
                this.devisLoading = false;
                this.blLoading = false;
                this.factureLoading = false;
            };

            readerForBase64.onload = () => {
                const base64 = readerForBase64.result as string;
                this.uploadFile(base64, type);
                // Per-type cache so the global footer save can persist BL +
                // Facture together without overwriting `payload.file`.
                if (type === 'BL' || type === 'Facture') {
                    this.affectationBase64 = {
                        ...this.affectationBase64,
                        [type]: base64,
                    };
                }
                if (type === 'BL') {
                    this.blLoading = false;
                    this.enregistrerBlBtncondition = false;
                } else if (type === 'Facture') {
                    this.factureLoading = false;
                    this.enregistrerFactureBtncondition = false;
                }
                if (type === 'image') {
                    this.uploadFileLoading = false;
                }
            };

            readerForBase64.onerror = (error) => {
                console.error('Base64 conversion error:', error);
                if (type === 'image') {
                    this.onImageUploadError();
                }
                this.blLoading = false;
                this.factureLoading = false;
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
        this.confirmationService.confirm({
            message: 'Voulez-vous supprimer cette emplacement ?',
            header: 'Supprimer',
            icon: 'pi pi-exclamation-triangle',
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
        this.confirmationService.confirm({
            message: 'Voulez-vous supprimer cette categorie ?',
            header: 'Supprimer ?',
            icon: 'pi pi-exclamation-triangle',
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

    openUploadFileFinished(dataselected: any) {
        this.filesSelected = dataselected;
        console.log('🥩[dataselected]:', dataselected);
        this.factureBtnDisabled = false;
        this.blBtnDisabled = false;
        this.blLoading = false;
        this.factureLoading = false;

        this.enregistrerBlBtncondition = true;
        this.enregistrerFactureBtncondition = true;

        this.filsFinished = true;
        this._idPDFFinished = dataselected._id;

        this.apollo
            .query<any>({
                query: this.ticketSerice.getLogsDi(dataselected._id),
            })
            .pipe(
                tap(({ data }) => {
                    if (data) {
                        const logs = data.getAllLogsByDi;
                        this.finishedData = { original: dataselected, logs };
                        console.log(
                            '🥠[ this.finishedData]:',
                            this.finishedData,
                        );
                    }
                }),
            )
            .subscribe({
                error: (err) => console.error('Error fetching logs:', err),
            });
    }

    onUploadFacture(event, type) {
        for (let file of event.files) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result as string;

                this.saveFileFinished(base64, type);
            };
        }
        this.messageservice.add({
            severity: 'info',
            summary: 'Fichier enregistré',
            detail: 'Fichier a été ajouter avec succès',
        });
    }

    onUploadBl(event, type) {
        for (let file of event.files) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result as string;

                this.saveFileFinished(base64, type);
            };
        }
        this.messageservice.add({
            severity: 'info',
            summary: 'Bon de livraison Ajouter',
            detail: 'Fichier a été ajouter avec succès',
        });
    }

    saveFileFinished(base64: string, type: string) {
        if (type === 'facture') {
            const payload = {
                file: base64,
            };

            this.facturePDF = payload;
        }
        if (type === 'bl') {
            const payload = {
                file: base64,
            };

            this.blPDF = payload;
        }
    }

    sendFilePdf() {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addPdfFile(
                    this._idPDFFinished,
                    this.facturePDF.file,
                    this.blPDF.file,
                ),
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
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

    getStatusLabel(status: string): string {
        const map = {
            CREATED: 'CREATED',
            PENDING1: 'PENDING1',
            PENDING2: 'PENDING2',
            PENDING3: 'PENDING3',
            DIAGNOSTIC: 'DIAGNOSTIC',
            INDIAGNOSTIC: 'INDIAGNOSTIC',
            INMAGASIN: 'INMAGASIN',
            PRICING: 'PRICING',
            NEGOTIATION1: 'NEGOTIATION1',
            NEGOTIATION2: 'NEGOTIATION2',
            REPARATION: 'REPARATION',
            INREPARATION: 'INREPARATION',
            FINISHED: 'FINISHED',
            ANNULER: 'ANNULER',
            RETOUR1: 'RETOUR1',
            RETOUR2: 'RETOUR2',
            RETOUR3: 'RETOUR3',
        };

        return map[status] || status;
    }
}
