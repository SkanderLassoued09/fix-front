import { Component } from '@angular/core';
import {
    FormGroup,
    FormControl,
    Validators,
    AbstractControl,
} from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Product } from 'src/app/demo/api/product';
import { CompanyService } from 'src/app/demo/service/company.service';
import { REGION } from '../../client/constant/region-constant';
import { debounceTime, finalize, Subject, take } from 'rxjs';

interface Column {
    field: string;
    header: string;
    searchKey?: string;
}

interface AddCompanyMutationResponse {
    createCompany: {
        _id: string;
    };
}

interface PageEvent {
    first: number;
    rows: number;
    page: number;
    pageCount: number;
}

interface GetAllCompanyQueryResponse {
    findAllCompany: {
        companyRecords: {
            _id: string;
            name: string;
            region: string;
            address: string;
            email: string;
            activitePrincipale: string;
            activiteSecondaire: string;
            raisonSociale: string;
            exoneration: string;
            fax: string;
            webSiteLink: string;
            serviceAchat: {
                name: string;
                email: string;
                phone: string;
            };
            serviceFinancier: {
                name: string;
                email: string;
                phone: string;
            };
            serviceTechnique: {
                name: string;
                email: string;
                phone: string;
            };
        };
        totalCompanyRecord: number;
    };
}

@Component({
    selector: 'app-company-list',
    templateUrl: './company-list.component.html',
    styleUrl: './company-list.component.scss',
})
export class CompanyListComponent {
    // Search state tracking
    private currentSearchField: string = '';
    private currentSearchValue: string = '';
    private searchSubject$ = new Subject<void>();

    region;
    // Only « Raison sociale » is required (matches the UI). Optional fields are
    // format-validated when filled (Angular's pattern/email validators treat an
    // empty value as valid). Service contacts are fully optional. The submit
    // button is gated on `companyForm.valid`, so contacts can't make the form
    // invalid just by opening their editor.
    private static readonly PHONE = Validators.pattern(/^[+0-9 ()\-.]{6,20}$/);
    // Aligned with the backend's @IsUrl (require_tld): the host must have a
    // dot + alpha TLD, so `http://localhost:4200/...` is caught inline here
    // instead of round-tripping to a server BAD_REQUEST.
    private static readonly URL = Validators.pattern(
        /^https?:\/\/[^\s/:?#]+\.[a-z]{2,}(?:[:/?#][^\s]*)?$/i,
    );
    private static readonly CODE = Validators.pattern(/^[A-Za-z0-9/\- ]+$/);

    companyForm = new FormGroup({
        companyName: new FormControl('', [
            Validators.required,
            Validators.maxLength(255),
        ]),
        address: new FormControl('', [Validators.maxLength(255)]),
        phone: new FormControl('', [CompanyListComponent.PHONE]),
        email: new FormControl('', [Validators.email]),
        region: new FormControl('', [Validators.maxLength(120)]),
        fax: new FormControl('', [CompanyListComponent.PHONE]),
        website: new FormControl('', [CompanyListComponent.URL]),
        activitePrincipale: new FormControl('', [Validators.maxLength(255)]),
        activiteSecondaire: new FormControl('', [Validators.maxLength(255)]),
        Exoneration: new FormControl(''),
        rne: new FormControl('', [
            Validators.maxLength(60),
            CompanyListComponent.CODE,
        ]),
        mf: new FormControl('', [
            Validators.maxLength(60),
            CompanyListComponent.CODE,
        ]),
        achat: new FormGroup({
            fullName: new FormControl('', [Validators.maxLength(120)]),
            email: new FormControl('', [Validators.email]),
            phone: new FormControl('', [CompanyListComponent.PHONE]),
        }),
        financier: new FormGroup({
            fullName: new FormControl('', [Validators.maxLength(120)]),
            email: new FormControl('', [Validators.email]),
            phone: new FormControl('', [CompanyListComponent.PHONE]),
        }),
        technique: new FormGroup({
            fullName: new FormControl('', [Validators.maxLength(120)]),
            email: new FormControl('', [Validators.email]),
            phone: new FormControl('', [CompanyListComponent.PHONE]),
        }),
    });

    creationCompanyModalCondition: boolean = false;
    products!: Product[];
    loading: boolean = false;

    toHideAchat: boolean;
    toHideFinancier: boolean;
    toHideTechnique: boolean;
    companiesList: any;

    /** Oui/Non options for the Exonération select (sent as a string, matching
     *  the existing `Exoneration: "${...}"` interpolation in the mutation). */
    exonerationOptions = [
        { label: 'Oui', value: 'Oui' },
        { label: 'Non', value: 'Non' },
    ];
    /** « Contacts par service » cards. `key` = the matching `companyForm`
     *  sub-group name — controls are reused as-is, never renamed. */
    serviceCards = [
        { key: 'achat', label: 'Achat', icon: 'pi pi-shopping-cart' },
        { key: 'technique', label: 'Technique', icon: 'pi pi-wrench' },
        { key: 'financier', label: 'Financier', icon: 'pi pi-wallet' },
    ];

    /** The create modal doubles as the edit modal (same template/controls). */
    isEditMode = false;
    /** Original row being edited (preserves fields not exposed in the form). */
    editCompanyRow: any = null;

    /** Destructive delete-confirmation dialog state. */
    deleteCompanyDialog = false;
    companyToDelete: any = null;
    deleting = false;

    cols: Column[] = [
        { field: 'name', header: 'Nom', searchKey: 'name' },
        { field: 'region', header: 'Région', searchKey: 'region' },
        { field: 'address', header: 'Adresse', searchKey: 'address' },
        { field: 'email', header: 'E-mail', searchKey: 'email' },
        {
            field: 'raisonSociale',
            header: 'Raison sociale',
            searchKey: 'raisonSociale',
        },
        {
            field: 'Exoneration',
            header: 'Exonération',
            searchKey: 'Exoneration',
        },
        { field: 'fax', header: 'Fax', searchKey: 'fax' },
    ];

    companySelected: any;
    CompanyModalCondition: boolean = false;
    first: number = 0;
    rows: number = 10;
    totalCompanyRecord: number;
    page: number = 0;
    detailsView: boolean;
    companySelectedView = {
        serviceAchat: { name: '', email: '', phone: '' },
        serviceFinancier: { name: '', email: '', phone: '' },
        serviceTechnique: { name: '', email: '', phone: '' },
    };
    submitted: boolean = false;

    constructor(
        private apollo: Apollo,
        private companyService: CompanyService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
    ) {
        this.region = REGION;
    }

    ngOnInit() {
        // Setup search with debounce
        this.searchSubject$.pipe(debounceTime(400)).subscribe(() => {
            this.loadData();
        });

        // Initial load
        this.loadData();
    }

    /**
     * Per-field validation message for the company form, shown under the field
     * only once the user has interacted with it (touched/dirty). Returns null
     * when valid/pristine. Supports nested paths (e.g. 'achat.email').
     */
    fieldError(path: string): string | null {
        const c = this.companyForm.get(path);
        if (!c || !c.invalid || !(c.touched || c.dirty)) {
            return null;
        }
        const e = c.errors ?? {};
        // Server-mapped error wins (it's the most specific feedback).
        if (e['server']) return e['server'];
        if (e['required']) return 'Champ requis';
        if (e['email']) return 'E-mail invalide';
        if (e['maxlength'])
            return `Trop long (max ${e['maxlength'].requiredLength} caractères)`;
        if (e['pattern']) return 'Format invalide';
        return 'Valeur invalide';
    }

    // ── Server-error mapping (BAD_REQUEST message[] → form controls) ─────────

    /**
     * True when the form has a CLIENT-side validation error (required/email/
     * pattern/maxlength) — `server` errors are excluded. The submit button is
     * gated on this, so a server rejection NEVER freezes the button (the user
     * can resubmit after editing). Loading still disables it during a request.
     */
    get companyFormClientInvalid(): boolean {
        return this.controlHasClientError(this.companyForm);
    }
    private controlHasClientError(c: AbstractControl): boolean {
        if (c instanceof FormGroup) {
            return Object.values(c.controls).some((ctrl) =>
                this.controlHasClientError(ctrl),
            );
        }
        const errs = c.errors;
        if (!errs) return false;
        return Object.keys(errs).some((k) => k !== 'server');
    }

    /** DTO property path (e.g. `serviceFinancier.email`, `webSiteLink`) → the
     *  matching form-control path, or null if there is no field for it. */
    private mapDtoPathToForm(path: string): string | null {
        const seg = path.split('.');
        const svc: Record<string, string> = {
            serviceAchat: 'achat',
            serviceTechnique: 'technique',
            serviceFinancier: 'financier',
        };
        if (seg.length === 2 && svc[seg[0]]) {
            const sub = seg[1] === 'name' ? 'fullName' : seg[1];
            const p = `${svc[seg[0]]}.${sub}`;
            return this.companyForm.get(p) ? p : null;
        }
        // `name`/`raisonSociale` both map to the single « Raison sociale » field.
        const top: Record<string, string> = {
            name: 'companyName',
            raisonSociale: 'companyName',
            webSiteLink: 'website',
        };
        const p = top[path] ?? path;
        return this.companyForm.get(p) ? p : null;
    }

    /** Apply class-validator messages onto the matching controls (`server`
     *  error). Returns the messages that couldn't be mapped + the first errored
     *  field path. Reusable shape — the mapping is the only company-specific bit. */
    private applyServerErrors(messages: string[]): {
        unmapped: string[];
        firstPath: string | null;
    } {
        const unmapped: string[] = [];
        let firstPath: string | null = null;
        for (const raw of messages) {
            const msg = String(raw).trim();
            if (!msg) continue;
            const [path, ...rest] = msg.split(' ');
            const text = rest.length ? rest.join(' ') : msg;
            const formPath = this.mapDtoPathToForm(path);
            const control = formPath ? this.companyForm.get(formPath) : null;
            if (!control) {
                unmapped.push(msg);
                continue;
            }
            this.setServerError(control, this.translateConstraint(text));
            if (!firstPath) firstPath = formPath;
        }
        return { unmapped, firstPath };
    }

    /** Put a `server` error on a control (touched, with one-shot recovery as
     *  soon as the user edits the field). Shared by the validation mapping and
     *  the business-CONFLICT mapping. */
    private setServerError(control: AbstractControl, text: string): void {
        control.setErrors({ ...(control.errors || {}), server: text });
        control.markAsTouched();
        control.valueChanges
            .pipe(take(1))
            .subscribe(() => this.clearServerError(control));
    }

    /** Remove only the `server` error key, keeping any client validators. */
    private clearServerError(c: AbstractControl): void {
        if (!c.errors) return;
        const { server, ...rest } = c.errors as Record<string, any>;
        c.setErrors(Object.keys(rest).length ? rest : null);
    }

    /** Light FR translation of the common class-validator messages. */
    private translateConstraint(text: string): string {
        if (/must be an email/i.test(text)) return 'E-mail invalide';
        if (/should not be empty/i.test(text)) return 'Champ requis';
        if (/must be a URL/i.test(text)) return 'URL invalide';
        if (/must be a phone number/i.test(text)) return 'Téléphone invalide';
        if (/must be one of the following values/i.test(text))
            return 'Valeur non autorisée';
        if (/must be longer|must be shorter|must be a string/i.test(text))
            return 'Format invalide';
        return text;
    }

    /**
     * Route a GraphQL `errors[]` from a submit onto the form. Validation
     * messages (`extensions.validation`) → inline per field; anything unmapped
     * or non-validation (global/server) → a SINGLE error toast. Focuses the
     * first errored field.
     */
    private handleServerErrors(errors: readonly any[]): void {
        const fieldMsgs: string[] = [];
        const globalMsgs: string[] = [];
        let conflictPath: string | null = null;
        for (const e of errors ?? []) {
            const v = e?.extensions?.validation;
            if (Array.isArray(v) && v.length) {
                fieldMsgs.push(...v);
                continue;
            }
            // Business CONFLICT (duplicate raison sociale / MF): the backend
            // names the offending DTO field → inline, exactly like validation.
            if (e?.extensions?.code === 'CONFLICT') {
                const formPath = this.mapDtoPathToForm(
                    String(e.extensions.field ?? ''),
                );
                const control = formPath
                    ? this.companyForm.get(formPath)
                    : null;
                if (control) {
                    this.setServerError(
                        control,
                        e.message || 'Cette valeur existe déjà',
                    );
                    if (!conflictPath) conflictPath = formPath;
                } else {
                    globalMsgs.push(e.message || 'Cette société existe déjà');
                }
                continue;
            }
            globalMsgs.push(e?.message || 'Erreur serveur');
        }
        const { unmapped, firstPath } = this.applyServerErrors(fieldMsgs);
        const toastMsgs = [...globalMsgs, ...unmapped];
        if (toastMsgs.length) {
            this.messageService.add({
                severity: 'error',
                summary: 'Erreur',
                detail: toastMsgs.join(' · '),
            });
        }
        this.focusFirstError(firstPath ?? conflictPath);
    }

    /** Open the relevant contact editor (if the error is nested) and
     *  focus/scroll to the first errored field. */
    private focusFirstError(formPath: string | null): void {
        if (!formPath) return;
        const top = formPath.split('.')[0];
        if (top === 'achat') this.toHideAchat = true;
        else if (top === 'technique') this.toHideTechnique = true;
        else if (top === 'financier') this.toHideFinancier = true;
        setTimeout(() => {
            const el =
                (document.getElementById(formPath) as HTMLElement | null) ||
                (document.querySelector(
                    '.co-modal .co-input--err',
                ) as HTMLElement | null);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus?.();
            }
        }, 60);
    }

    /**
     * Centralized data loading method
     * Handles both search and regular data fetching with pagination
     */
    loadData() {
        this.loading = true;

        const hasActiveSearch =
            this.currentSearchField &&
            this.currentSearchValue &&
            this.currentSearchValue.trim().length > 0;

        if (hasActiveSearch) {
            // Perform search
            this.apollo
                .query<any>({
                    query: this.companyService.searchCompany(),
                    variables: {
                        config: { rows: this.rows, first: this.first },
                        search: {
                            field: this.currentSearchField,
                            value: this.currentSearchValue,
                        },
                    },
                    fetchPolicy: 'no-cache',
                })
                .pipe(finalize(() => (this.loading = false)))
                .subscribe(({ data }) => {
                    if (data && data.searchCompany) {
                        this.companiesList = data.searchCompany.companyRecords;
                        this.totalCompanyRecord =
                            data.searchCompany.totalCompanyRecord;
                    }
                });
        } else {
            // Regular data fetch
            this.companies(this.first, this.rows);
        }
    }

    /**
     * Handle column search
     */
    onColumnSearch(field: string, value: string) {
        const v = value?.trim();
        const f = field?.trim();

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

    load() {
        this.loading = true;
        setTimeout(() => {
            this.loading = false;
        }, 2000);
    }

    hideShowFormAchat() {
        this.toHideAchat = !this.toHideAchat;
    }

    hideShowFormFinancier() {
        this.toHideFinancier = !this.toHideFinancier;
    }

    hideShowFormTechnique() {
        this.toHideTechnique = !this.toHideTechnique;
    }

    /** Toggle the inline contact editor for a service card. */
    toggleService(key: string): void {
        if (key === 'achat') this.toHideAchat = !this.toHideAchat;
        else if (key === 'technique')
            this.toHideTechnique = !this.toHideTechnique;
        else if (key === 'financier')
            this.toHideFinancier = !this.toHideFinancier;
    }

    /** Whether a service's inline editor is currently open. */
    isServiceOpen(key: string): boolean {
        if (key === 'achat') return !!this.toHideAchat;
        if (key === 'technique') return !!this.toHideTechnique;
        return !!this.toHideFinancier;
    }

    /** Contact name entered for a service (drives the chip / filled state). */
    serviceContactName(key: string): string {
        return this.companyForm.get(key + '.fullName')?.value || '';
    }

    /** Remove a service's contact: clear its sub-group + close the editor. */
    removeServiceContact(key: string): void {
        this.companyForm
            .get(key)
            ?.reset({ fullName: '', email: '', phone: '' });
        if (key === 'achat') this.toHideAchat = false;
        else if (key === 'technique') this.toHideTechnique = false;
        else if (key === 'financier') this.toHideFinancier = false;
    }

    showDialog() {
        this.isEditMode = false;
        this.editCompanyRow = null;
        this.creationCompanyModalCondition = true;
    }

    /**
     * Open the SAME modal in edit mode, prefilled from the row. Controls are
     * reused as-is; service contacts surface as chips via `serviceContactName`.
     */
    openEditCompany(row: any): void {
        this.isEditMode = true;
        this.editCompanyRow = { ...row };
        this.toHideAchat = false;
        this.toHideTechnique = false;
        this.toHideFinancier = false;

        // Region is bound as an object (optionLabel="name") — reuse the actual
        // option reference so the dropdown shows it selected.
        const regionOption =
            (this.region || []).find((r: any) => r?.name === row?.region) ??
            null;

        this.companyForm.reset();
        this.companyForm.patchValue({
            companyName: row?.name ?? '',
            region: regionOption,
            address: row?.address ?? '',
            email: row?.email ?? '',
            fax: row?.fax ?? '',
            Exoneration: row?.Exoneration ?? '',
            website: row?.webSiteLink ?? '',
            rne: row?.rne ?? '',
            mf: row?.mf ?? '',
            activitePrincipale: row?.activitePrincipale ?? '',
            activiteSecondaire: row?.activiteSecondaire ?? '',
            achat: {
                fullName: row?.serviceAchat?.name ?? '',
                email: row?.serviceAchat?.email ?? '',
                phone: row?.serviceAchat?.phone ?? '',
            },
            technique: {
                fullName: row?.serviceTechnique?.name ?? '',
                email: row?.serviceTechnique?.email ?? '',
                phone: row?.serviceTechnique?.phone ?? '',
            },
            financier: {
                fullName: row?.serviceFinancier?.name ?? '',
                email: row?.serviceFinancier?.email ?? '',
                phone: row?.serviceFinancier?.phone ?? '',
            },
        });
        this.companyForm.markAsPristine();
        this.creationCompanyModalCondition = true;
    }

    /**
     * Save edits via the EXISTING `updatecompany` mutation. Sources values from
     * the reused form (spread over the original row so fields not in the form —
     * `_id`, `raisonSociale`, … — are preserved). API call is unchanged.
     */
    updateCompanyForm(): void {
        if (this.companyForm.get('companyName')?.invalid) {
            return;
        }
        this.loading = true;
        this.apollo
            .mutate<any>({
                mutation: this.companyService.updatecompany(),
                variables: { input: this.buildCompanyUpdateInput() },
                useMutationLoading: true,
                // Surface GraphQL errors in `next.errors` (not as a thrown
                // ApolloError) so we can map them onto the fields.
                errorPolicy: 'all',
            })
            .subscribe({
                next: ({ errors, loading }) => {
                    // Ignore the global `useMutationLoading` intermediate frame
                    // (else the success toast fires twice).
                    if (loading) return;
                    // Reset loading IMMEDIATELY so the button never freezes.
                    this.loading = false;
                    if (errors) {
                        // BAD_REQUEST message[] → inline per field; rest → toast.
                        this.handleServerErrors(errors);
                        return;
                    }
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Succès',
                        detail: 'La société modifiée avec succès',
                    });
                    this.loadData();
                    this.creationCompanyModalCondition = false; // onHide resets
                },
                error: () => {
                    this.loading = false;
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Erreur',
                        detail: 'Erreur lors de la modification de la société',
                    });
                },
            });
    }

    /** Reset the create/edit dialog whenever it hides (cancel, ✕, Esc, mask). */
    resetCompanyDialog(): void {
        this.companyForm.reset();
        this.isEditMode = false;
        this.editCompanyRow = null;
        this.toHideAchat = false;
        this.toHideTechnique = false;
        this.toHideFinancier = false;
    }

    // ── Suppression (dialog destructif) ───────────────────────────────────

    confirmDeleteCompany(row: any): void {
        this.companyToDelete = row;
        this.deleteCompanyDialog = true;
    }

    /** Display name for the delete confirmation. */
    companyDeleteName(): string {
        return (
            this.companyToDelete?.raisonSociale ||
            this.companyToDelete?.name ||
            'cette société'
        );
    }

    /** Number of service contacts that would be detached on delete. */
    associatedContactsCount(row: any): number {
        if (!row) return 0;
        return ['serviceAchat', 'serviceTechnique', 'serviceFinancier'].filter(
            (k) => row?.[k]?.name,
        ).length;
    }

    /** Delete via the EXISTING `removeCompany` mutation. */
    doDeleteCompany(): void {
        const row = this.companyToDelete;
        if (!row?._id) {
            return;
        }
        this.deleting = true;
        this.apollo
            .mutate<any>({
                mutation: this.companyService.removeCompany(),
                variables: { id: row._id },
            })
            .subscribe({
                next: ({ errors, loading }) => {
                    // `useMutationLoading: true` is set globally (APOLLO_FLAGS),
                    // so mutate() emits a loading frame THEN the result. Act
                    // only on the final frame — otherwise the toast fires twice
                    // (the reported duplicate-toast bug).
                    if (loading) return;
                    this.deleting = false;
                    if (errors) {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Erreur',
                            detail: 'Erreur lors de la suppression de la société',
                        });
                        return;
                    }
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Succès',
                        detail: 'La société supprimée avec succès',
                    });
                    if (this.companiesList) {
                        this.companiesList = this.companiesList.filter(
                            (c: any) => c._id !== row._id,
                        );
                    }
                    this.deleteCompanyDialog = false;
                    this.companyToDelete = null;
                    this.loadData();
                },
                error: () => {
                    this.deleting = false;
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Erreur',
                        detail: 'Erreur lors de la suppression de la société',
                    });
                },
            });
    }

    // ── GraphQL-variables input builders (no more string interpolation) ──

    /** Drop empty / null / undefined values + GraphQL `__typename`, recursively
     *  (one level, for the service sub-objects). Pruning the blanks is what
     *  keeps the optional validators (@IsEmail/@IsUrl) from firing on an empty
     *  optional once the ValidationPipe is active. */
    private pruneInput(obj: Record<string, any>): any {
        const out: any = {};
        for (const [k, v] of Object.entries(obj ?? {})) {
            if (k === '__typename') continue;
            if (v === null || v === undefined) continue;
            if (typeof v === 'string') {
                const t = v.trim(); // trim, then drop if empty
                if (t) out[k] = t;
                continue;
            }
            if (typeof v === 'object' && !Array.isArray(v)) {
                const nested = this.pruneInput(v);
                if (Object.keys(nested).length) out[k] = nested;
                continue;
            }
            out[k] = v;
        }
        return out;
    }

    /** form sub-group { fullName, email, phone } → ServiceContactInput. */
    private toServiceContact(c: any): any {
        if (!c) return undefined;
        return { name: c.fullName ?? c.name, email: c.email, phone: c.phone };
    }

    /** Reactive form → `CreateCompanyInput`. The single « Raison sociale »
     *  field feeds both `name` and `raisonSociale` (fixes the literal
     *  "undefined" that used to be persisted). */
    private buildCompanyInput(v: any): any {
        const region =
            v?.region && typeof v.region === 'object'
                ? v.region.name
                : v?.region;
        return this.pruneInput({
            name: v?.companyName,
            raisonSociale: v?.companyName,
            region,
            address: v?.address,
            email: v?.email,
            phone: v?.phone,
            fax: v?.fax,
            Exoneration: v?.Exoneration,
            webSiteLink: v?.website,
            mf: v?.mf,
            rne: v?.rne,
            activitePrincipale: v?.activitePrincipale,
            activiteSecondaire: v?.activiteSecondaire,
            serviceAchat: this.toServiceContact(v?.achat),
            serviceTechnique: this.toServiceContact(v?.technique),
            serviceFinancier: this.toServiceContact(v?.financier),
        });
    }

    /** Reactive form (+ original row for `_id`) → `UpdateCompanyInput`. */
    private buildCompanyUpdateInput(): any {
        const v: any = this.companyForm.value;
        const region =
            v?.region && typeof v.region === 'object'
                ? v.region.name
                : v?.region ?? this.editCompanyRow?.region;
        return this.pruneInput({
            _id: this.editCompanyRow?._id,
            name: v?.companyName,
            raisonSociale: v?.companyName,
            region,
            address: v?.address,
            email: v?.email,
            phone: v?.phone,
            fax: v?.fax,
            Exoneration: v?.Exoneration,
            webSiteLink: v?.website,
            mf: v?.mf,
            rne: v?.rne,
            activitePrincipale: v?.activitePrincipale,
            activiteSecondaire: v?.activiteSecondaire,
            serviceAchat: this.toServiceContact(v?.achat),
            serviceTechnique: this.toServiceContact(v?.technique),
            serviceFinancier: this.toServiceContact(v?.financier),
        });
    }

    /** Raw company row (legacy « Détails » modal, GraphQL-shaped) →
     *  `UpdateCompanyInput`. */
    private toUpdateInputFromRow(src: any): any {
        if (!src) return {};
        return this.pruneInput({
            _id: src._id,
            name: src.name,
            raisonSociale: src.raisonSociale || src.name,
            region: src.region,
            address: src.address,
            email: src.email,
            phone: src.phone,
            fax: src.fax,
            Exoneration: src.Exoneration,
            webSiteLink: src.webSiteLink,
            mf: src.mf,
            rne: src.rne,
            activitePrincipale: src.activitePrincipale,
            activiteSecondaire: src.activiteSecondaire,
            serviceAchat: src.serviceAchat,
            serviceTechnique: src.serviceTechnique,
            serviceFinancier: src.serviceFinancier,
        });
    }

    addCompany() {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation création de société',
            icon: 'pi pi-question-circle',
            accept: () => {
                this.loading = true;
                this.apollo
                    .mutate<AddCompanyMutationResponse>({
                        mutation: this.companyService.addCompany(),
                        variables: {
                            input: this.buildCompanyInput(
                                this.companyForm.value,
                            ),
                        },
                        useMutationLoading: true,
                        // Surface GraphQL errors in `next.errors` so we can map
                        // them onto the fields (not a thrown ApolloError).
                        errorPolicy: 'all',
                    })
                    .subscribe({
                        next: ({ data, errors, loading }) => {
                            // Skip the global useMutationLoading intermediate frame.
                            if (loading) return;
                            // Reset loading IMMEDIATELY so the button never freezes.
                            this.loading = false;
                            if (errors) {
                                // BAD_REQUEST message[] → inline per field; the
                                // rest → a single fallback toast.
                                this.handleServerErrors(errors);
                                return;
                            }
                            if (data) {
                                this.messageService.add({
                                    severity: 'success',
                                    summary: 'Succès',
                                    detail: 'La société ajoutée avec succès',
                                });
                                this.loadData();
                                this.companyForm.reset();
                                this.creationCompanyModalCondition = false;
                            }
                        },
                        error: () => {
                            this.loading = false;
                            this.messageService.add({
                                severity: 'error',
                                summary: 'Erreur',
                                detail: "Erreur lors de l'ajout de la société",
                            });
                        },
                    });
            },
        });
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;
        this.loadData(); // Use loadData instead of companies
    }

    companies(first, rows) {
        this.apollo
            .query<GetAllCompanyQueryResponse>({
                query: this.companyService.getAllCompany(),
                variables: { config: { rows, first } },
                fetchPolicy: 'no-cache',
            })
            .pipe(finalize(() => (this.loading = false)))
            .subscribe(({ data }) => {
                if (data) {
                    this.companiesList = data.findAllCompany.companyRecords;
                    this.totalCompanyRecord =
                        data.findAllCompany.totalCompanyRecord;
                }
            });
    }

    editCompany(rowDataClient) {
        this.companySelected = { ...rowDataClient };
        this.CompanyModalCondition = true;
    }

    saveUpdateCompany() {
        this.submitted = true;

        if (!this.companySelected.name) {
            return;
        }

        this.apollo
            .mutate<any>({
                mutation: this.companyService.updatecompany(),
                variables: {
                    input: this.toUpdateInputFromRow(this.companySelected),
                },
            })
            .subscribe(({ data }) => {
                if (data) {
                    if (this.companySelected._id) {
                        this.companiesList[
                            this.findIndexById(this.companySelected._id)
                        ] = this.companySelected;

                        this.messageService.add({
                            severity: 'success',
                            summary: 'Succès',
                            detail: 'La société a été modifiée avec succès',
                        });
                        this.CompanyModalCondition = false;
                        this.submitted = false;
                        this.loadData(); // Reload data after update
                    }
                }
            });
    }

    saveUpdateServiceCompany(rowDataClient) {
        this.companySelected = { ...rowDataClient };
        this.detailsView = false;
        this.messageService.add({
            severity: 'success',
            summary: 'Succès',
            detail: 'La société a changé avec succès',
        });
        this.loadData(); // Reload data after update
    }

    annuler() {
        this.CompanyModalCondition = false;
        this.submitted = false;
        this.companySelected = null;
    }

    annulerService() {
        this.detailsView = false;
        this.companySelected = null;
    }

    annulerUpdate() {
        this.creationCompanyModalCondition = false;
        this.companyForm.reset();
    }

    deleteSelectedCompany(rowData) {
        this.confirmationService.confirm({
            message: 'Voulez-vous supprimer cette société?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.companyService.removeCompany(),
                        variables: { id: rowData._id },
                    })
                    .subscribe(({ data }) => {
                        if (data) {
                            const index = this.companiesList.findIndex((el) => {
                                return el._id === rowData._id;
                            });
                            this.companiesList.splice(index, 1);

                            this.messageService.add({
                                severity: 'success',
                                summary: 'Supprimé',
                                detail: `La société ${rowData.name} a été supprimée`,
                                life: 3000,
                            });

                            this.loadData(); // Reload data after delete
                        }
                    });
            },
        });
    }

    findIndexById(_id: string): number {
        let index = -1;
        for (let i = 0; i < this.companiesList.length; i++) {
            if (this.companiesList[i]._id === _id) {
                index = i;
                break;
            }
        }

        return index;
    }

    modalServices(data) {
        this.companySelected = {
            _id: data._id,
            name: data.name,
            serviceAchat: data.serviceAchat || {
                name: '',
                email: '',
                phone: '',
            },
            serviceFinancier: data.serviceFinancier || {
                name: '',
                email: '',
                phone: '',
            },
            serviceTechnique: data.serviceTechnique || {
                name: '',
                email: '',
                phone: '',
            },
        };
        this.detailsView = true;
    }
}
