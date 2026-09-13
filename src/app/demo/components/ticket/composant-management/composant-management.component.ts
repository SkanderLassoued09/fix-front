import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    AbstractControl,
    FormGroup,
    FormControl,
    ValidationErrors,
    Validators,
    ReactiveFormsModule,
} from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { Subject, debounceTime } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
import { PdfDropzoneComponent } from '../magasin-di-list/pdf-dropzone/pdf-dropzone.component';
import { docHref } from '../shared/doc-href.util';
import { SearchableDropdownDirective } from 'src/app/shared/searchable-dropdown.directive';
import {
    TABLE_EMPTY_VALUE,
    formatTableValue,
    trackByColumn,
} from '../table-display.utils';
import { TableCellTruncateDirective } from 'src/app/shared/table-cell-truncate.directive';
import { NotifyService } from '../../../../shared/ui/notify.service';
import { ConfirmService } from '../../../../shared/ui/confirm.service';

interface Column {
    field: string;
    header: string;
    searchKey: string;
    /** Largeur fixe ; les colonnes sans largeur se partagent le reste. */
    width?: string;
}

interface PageEvent {
    first: number;
    rows: number;
    page: number;
    pageCount: number;
}

/**
 * « Catalogue composants » — page de menu à part entière (/tickets/composants),
 * réservée à ADMIN_MANAGER / ADMIN_TECH / MAGASIN (`composant-access.ts`).
 *
 * Standalone : un seul import dans le module de routage suffit, comme
 * `ReunionListComponent`. `MessageService` n'est VOLONTAIREMENT pas fourni ici
 * → l'instance racine (`app.module.ts`) est injectée, donc les toasts sortent
 * dans le `<p-toast>` global de `app.component.html`. En fournir un ici
 * recréerait le bug des toasts en double.
 */
@Component({
    selector: 'app-composant-management',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        TableModule,
        ButtonModule,
        InputTextModule,
        InputNumberModule,
        CalendarModule,
        DropdownModule,
        DialogModule,
        TagModule,
        TooltipModule,
        PaginatorModule,
        TableCellTruncateDirective,
        SearchableDropdownDirective,
        PdfDropzoneComponent,
    ],
    templateUrl: './composant-management.component.html',
    styleUrl: './composant-management.component.scss',
})
export class ComposantManagementComponent implements OnInit {
    openModalEdit: boolean = false;

    /**
     * Avec 10 colonnes, `table-layout: fixed` (cf. `company-list`) est
     * indispensable : sans lui le tableau déborde de sa carte et la colonne
     * Actions est rognée. Les colonnes courtes sont bornées ici, les trois
     * colonnes de texte (Nom, Package, Catégorie) se partagent le reste et
     * sont tronquées en « … » par `TableCellTruncateDirective`.
     *
     * La somme des largeurs fixes (636 px) + 3 colonnes de texte donne le
     * `min-width: 990px` du tableau : en deçà, la carte défile horizontalement
     * (`.p-datatable-wrapper` est déjà en `overflow-x: auto`) plutôt que de
     * réduire « condensateur » à « con… ». Dix colonnes ne tiennent pas sous
     * ~1000 px de large.
     */
    cols: Column[] = [
        { field: '_id', header: 'Réf.', searchKey: '_id', width: '78px' },
        { field: 'name', header: 'Nom', searchKey: 'name' },
        { field: 'package', header: 'Package', searchKey: 'package' },
        {
            field: 'category_composant_id',
            header: 'Catégorie',
            searchKey: 'category_composant_id',
        },
        {
            field: 'prix_achat',
            header: 'Prix achat',
            searchKey: 'prix_achat',
            width: '92px',
        },
        {
            field: 'prix_vente',
            header: 'Prix vente',
            searchKey: 'prix_vente',
            width: '92px',
        },
        {
            field: 'coming_date',
            header: "Date d'arrivée",
            searchKey: 'coming_date',
            width: '108px',
        },
        {
            field: 'quantity_stocked',
            header: 'Stock',
            searchKey: 'quantity_stocked',
            width: '70px',
        },
        {
            field: 'status_composant',
            header: 'Statut',
            searchKey: 'status_composant',
            width: '100px',
        },
    ];

    /**
     * `findAllComposant` ne prend AUCUN argument et renvoie tout le catalogue :
     * il n'existe ni requête paginée ni recherche par colonne côté serveur.
     * Le filtrage et la pagination sont donc faits ici, sur la liste complète —
     * le rendu (ligne de filtres + paginateur en pied de carte) reste celui des
     * autres listes de l'app.
     */
    private allComposants: any[] = [];
    private filteredComposants: any[] = [];
    pagedComposants: any[] = [];

    first: number = 0;
    rows: number = 10;
    totalComposantRecord: number = 0;

    /** Colonne → texte cherché (minuscules). Cumulatif : toutes doivent matcher. */
    private filters: Record<string, string> = {};
    private searchSubject$ = new Subject<void>();

    /** Options du dropdown catégorie : { name: libellé, value: _id }. */
    composantCategory: Array<{ name: string; value: string }> = [];

    /**
     * Mode du modal composant. Le MÊME modal sert à créer et à modifier : même
     * formulaire, même dropzone PDF, même SCSS. Seuls le titre, le libellé du
     * bouton et la mutation appelée changent. Dupliquer un second formulaire
     * composant sur cette page aurait signifié deux `buildSavePayload`, deux
     * chemins PDF et deux validations à garder synchronisés.
     */
    isCreateMode = false;

    // ── Gestion des catégories (modal déplacé depuis l'écran magasin) ──────
    /** Visibilité du modal « Création Catégorie Composants ». */
    openCreationCategoryComposantModal = false;
    /** Lignes brutes de la table de gestion des catégories. */
    composantCatgorieList: any[] = [];
    colCategoryComposants = [
        { field: 'category_composant', header: 'Nom de la catégorie' },
    ];
    addCategoryCompsant = new FormGroup({
        categoryName: new FormControl(null, Validators.required),
    });
    trackByColumn = trackByColumn;

    /** Fichier en attente (dropzone) + son base64. Seul le base64 part au back. */
    pdfFile: File | null = null;
    pdfPayload: string | null = null;

    /** Pilote `[loading]` du bouton « Enregistrer » et le blocage des actions. */
    loading = false;

    // ── Création rapide d'une catégorie, dépliée DANS le modal composant ──
    // Sans ce raccourci, créer une catégorie manquante imposait de FERMER ce
    // modal (saisie perdue), d'ouvrir celui de l'en-tête, puis de tout
    // ressaisir. Le panneau se déplie sous le dropdown : pas de second
    // `p-dialog`, donc pas de masque empilé ni de vol de focus.

    /** Le panneau « nouvelle catégorie » est-il déplié ? */
    quickCategoryOpen = false;

    /**
     * Nom saisi dans le panneau rapide.
     *
     * Contrôle SÉPARÉ, et surtout pas `addCategoryCompsant` : ce dernier est
     * lié par `formControlName` au formulaire de l'AUTRE modal, et
     * `addNewCategoryComposant()` fait un `reset()` dessus — les deux champs
     * partageraient valeur, `touched` et état d'erreur.
     *
     * Il ne doit pas non plus rejoindre `updateComposantForm` :
     * `buildSavePayload()` étale `updateComposantForm.value`, un contrôle de
     * plus partirait donc au back — et cette forme est épinglée par le spec.
     * D'où `[formControl]` (et non `formControlName`) côté template, qui
     * permet de poser le champ DANS le `<form>` sans l'y rattacher.
     */
    quickCategoryName = new FormControl('', [
        ComposantManagementComponent.nonBlank,
    ]);

    /**
     * Spinner PROPRE au panneau. Réutiliser `this.loading` ferait tourner le
     * spinner du bouton « Enregistrer » (et griserait les boutons de la table)
     * pendant qu'on crée une catégorie. Les deux boutons du pied de modal
     * écoutent quand même ce drapeau, pour qu'on ne puisse pas enregistrer le
     * composant au milieu d'une création de catégorie.
     */
    quickCategoryLoading = false;

    /** Ligne en cours d'édition — sert au lien « Consulter le PDF actuel ». */
    selectedComposant: any = null;

    /** Résolution d'un lien de document stocké (Drive / data: / héritage). */
    docHref = docHref;

    statusComposant = [
        { name: 'En stock', value: 'En stock' },
        { name: 'Interne', value: 'Interne' },
        { name: 'Externe', value: 'Externe' },
    ];

    /**
     * `Validators.required` accepte «    » : il teste `value.length === 0`, et
     * une chaîne d'espaces n'est pas vide. Le back, lui, `trim()` puis refuse
     * (`composant_category.service.ts`). On valide donc sur la valeur TRIMÉE,
     * pour que le bouton « Créer » soit réellement grisé plutôt que de laisser
     * partir une requête vouée à l'échec.
     */
    private static nonBlank(control: AbstractControl): ValidationErrors | null {
        return String(control.value ?? '').trim().length
            ? null
            : { required: true };
    }

    updateComposantForm = new FormGroup({
        _id: new FormControl(null),

        // SEUL `name` est requis : c'est la CLÉ de liaison des DI
        // (`array_composants[].nameComposant`), elle ne doit jamais être vide.
        //
        // Les autres ne le sont PAS, volontairement. 30 des 137 composants en
        // base n'ont ni prix, ni statut, ni package (données héritées) ; les
        // exiger rendait le bouton « Enregistrer » définitivement grisé sur ces
        // lignes — impossible de corriger précisément celles qui en ont besoin.
        // Un champ laissé vide est de toute façon ignoré par `addComposantInfo`
        // (la valeur stockée est conservée), donc « vide » = « ne pas toucher ».
        name: new FormControl('', Validators.required),
        package: new FormControl(''),
        prix_achat: new FormControl(null),
        prix_vente: new FormControl(null),

        coming_date: new FormControl(null),

        quantity_stocked: new FormControl(0),
        status_composant: new FormControl(''),

        // Optionnels, comme dans le formulaire magasin.
        category_composant_id: new FormControl(null),
        link: new FormControl(''),
        pdf: new FormControl(''),
    });

    constructor(
        private readonly ticketService: TicketService,
        private readonly apollo: Apollo,
        private readonly confirm: ConfirmService,
        private readonly notify: NotifyService,
        private readonly mutationRunner: MutationRunner
    ) {}

    ngOnInit() {
        // Même contrat que les autres listes : 400 ms de debounce sur la saisie.
        this.searchSubject$
            .pipe(debounceTime(400))
            .subscribe(() => this.applyFilters());
        this.getAllCategories();
        this.getAllComposants();
    }

    /**
     * Options du dropdown catégorie. Chargées AVANT toute édition : sans elles
     * `normalizeCategoryId` ne peut pas traduire une valeur héritée, et
     * `categoryLabel` afficherait l'`_id` brut dans la table.
     */
    getAllCategories() {
        this.apollo
            .query<any>({
                query: this.ticketService.findAllComposant_Category(),
            })
            .subscribe({
                next: ({ data, errors }) => {
                    if (errors?.length || !data?.findAllComposant_Category) {
                        // Non bloquant : la table reste lisible, seul le
                        // dropdown est vide — d'où le `emptyMessage` côté
                        // template plutôt qu'un toast d'erreur en plein écran.
                        return;
                    }
                    // Lignes brutes pour la table du modal de gestion…
                    this.composantCatgorieList = data.findAllComposant_Category;
                    // …et options { name, value } pour le dropdown. Les deux
                    // sortent de la MÊME requête : une catégorie créée doit
                    // apparaître dans le tableau ET dans le dropdown, d'où le
                    // rappel de cette méthode après chaque création/suppression.
                    this.composantCategory =
                        data.findAllComposant_Category.map((el: any) => ({
                            name: el.category_composant,
                            value: el._id,
                        }));
                    // Les libellés de catégorie sont affichés dans la table :
                    // re-rendre la page courante une fois la liste connue.
                    this.slice();
                },
                error: () => {
                    /* idem : dégradation silencieuse, la liste reste utilisable */
                },
            });
    }

    /**
     * Traduit la valeur STOCKÉE en `_id` de catégorie exploitable par le
     * dropdown. D'anciennes lignes contiennent le LIBELLÉ (le front l'envoyait
     * avant le fix des dropdowns) ; le renvoyer tel quel ferait rejeter
     * l'enregistrement par `assertCategoryExists`. Introuvable ⇒ `null` ⇒ le
     * champ part vide ⇒ le back n'y touche pas.
     * Repris de `magasin-di-list.component.ts`.
     */
    private normalizeCategoryId(stored: string | null): string | null {
        if (!stored || stored === 'null' || stored === 'undefined') return null;
        const options = this.composantCategory || [];
        if (!options.length) return stored; // liste pas encore chargée
        if (options.some((o) => o.value === stored)) return stored;
        const byLabel = options.find((o) => o.name === stored);
        return byLabel ? byLabel.value : null;
    }

    /** Libellé affichable d'une catégorie ; valeur héritée rendue telle quelle. */
    categoryLabel(stored: any): string {
        const raw = this.formatValue(stored);
        if (raw === TABLE_EMPTY_VALUE) return TABLE_EMPTY_VALUE;
        const hit = (this.composantCategory || []).find(
            (o) => o.value === stored
        );
        return hit ? hit.name : raw;
    }

    /** Message serveur réel (tableau `errors` d'errorPolicy 'all', ApolloError
     *  ou erreur réseau), sinon le fallback. Même contrat que magasin-di-list. */
    private errorDetail(source: any, fallback: string): string {
        if (Array.isArray(source)) {
            return source[0]?.message || fallback;
        }
        return (
            source?.graphQLErrors?.[0]?.message ||
            source?.networkError?.message ||
            source?.message ||
            fallback
        );
    }

    getAllComposants() {
        this.apollo
            .query<any>({ query: this.ticketService.getAllComposant() })
            .subscribe({
                // errorPolicy 'all' (queries) : une erreur GraphQL arrive ici
                // avec `data: null` — l'accès direct crashait (TypeError).
                next: ({ data, errors }) => {
                    if (errors?.length) {
                        this.notify.error(
                            this.errorDetail(
                                errors,
                                'Impossible de charger les composants.'
                            ),
                            { summary: 'Erreur de chargement' },
                        );
                        return;
                    }
                    if (data?.findAllComposant) {
                        this.allComposants = data.findAllComposant;
                        // Rechargement après création/suppression : les filtres
                        // en cours doivent être re-appliqués, pas perdus.
                        this.applyFilters();
                    }
                },
                error: (error) => {
                    this.notify.error(
                        this.errorDetail(
                            error,
                            'Impossible de charger les composants.'
                        ),
                        { summary: 'Erreur de chargement' },
                    );
                },
            });
    }

    /** Saisie dans la ligne de filtres. Valeur vide ⇒ la colonne ne filtre plus. */
    onColumnSearch(field: string, value: string) {
        const v = (value ?? '').trim();
        const f = (field ?? '').trim();
        if (!f) return;

        if (v.length > 0) {
            this.filters[f] = v.toLowerCase();
        } else {
            delete this.filters[f];
        }
        this.first = 0; // nouvelle recherche ⇒ retour à la première page
        this.searchSubject$.next();
    }

    /** Applique tous les filtres actifs (ET logique), puis re-découpe la page. */
    applyFilters() {
        const active = Object.entries(this.filters);

        this.filteredComposants = this.allComposants.filter((row) =>
            active.every(([field, needle]) =>
                this.searchableValue(row, field).includes(needle)
            )
        );

        this.totalComposantRecord = this.filteredComposants.length;
        // Le filtre peut réduire la liste sous la page courante : sans ce
        // garde-fou la table apparaîtrait vide alors qu'il y a des résultats.
        if (this.first >= this.totalComposantRecord) {
            this.first = 0;
        }
        this.slice();
    }

    /**
     * Valeur comparée par le filtre. `coming_date` est cherchée sur la date
     * AFFICHÉE (`YYYY-MM-DD`) et non sur l'horodatage brut : sinon taper
     * « 2025-03 » ne trouverait rien.
     */
    private searchableValue(row: any, field: string): string {
        let raw: any;
        if (field === 'coming_date') {
            raw = this.getFormattedDate(row?.coming_date);
        } else if (field === 'category_composant_id') {
            // On cherche sur le LIBELLÉ affiché, pas sur l'`_id` (`C_ComposantN`)
            // que l'utilisateur ne voit jamais.
            raw = this.categoryLabel(row?.category_composant_id);
        } else {
            raw = row?.[field];
        }
        return String(raw ?? '').toLowerCase();
    }

    private slice() {
        this.pagedComposants = this.filteredComposants.slice(
            this.first,
            this.first + this.rows
        );
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.rows = event.rows;
        this.slice();
    }

    /**
     * Classe de pastille pour le statut. Les valeurs réellement persistées sont
     * « En stock » / « Interne » / « Externe » (cf. `magasin-di-list`) : un
     * libellé avec espace ne peut pas servir de nom de classe, d'où le mappage.
     */
    statusClass(value: string): string {
        switch ((value ?? '').trim()) {
            case 'En stock':
                return 'composant-INSTOCK';
            case 'Interne':
                return 'composant-INTERN';
            case 'Externe':
                return 'composant-EXTERN';
            default:
                return 'composant-UNKNOWN';
        }
    }

    /**
     * Suppression (soft delete côté back). Prend la LIGNE et non le seul `_id` :
     * le toast de succès nomme le composant, comme sur les autres écrans.
     */
    deleteComposant(composant: any) {
        const _id = composant?._id;
        if (!_id) return;

        this.confirm.confirmDelete({
            message: 'Voulez-vous supprimer ce composant ?',
            accept: async () => {
                try {
                    await this.mutationRunner.run({
                        key: `removeComposant:${_id}`,
                        mutation: this.ticketService.removeComposant(_id),
                        successToast: {
                            summary: 'Composant supprimé',
                            detail: this.displayName(composant),
                        },
                        // Toast d'erreur émis par nous : le runner en pose un
                        // générique, alors que le back renvoie un message utile.
                        errorToast: null,
                        onLoading: (v) => (this.loading = v),
                    });
                    this.getAllComposants();
                } catch (err) {
                    this.failWithToast(
                        err,
                        'Suppression impossible. Réessayez.'
                    );
                }
            },
        });
    }

    /** Ouvre la modale sur une ligne : préremplit les 10 champs éditables. */
    updateComposant(composant: any) {
        this.isCreateMode = false;
        this.selectedComposant = composant;
        // Toute sélection PDF d'une édition précédente doit être oubliée, sinon
        // elle serait réenvoyée sur un AUTRE composant.
        this.pdfFile = null;
        this.pdfPayload = null;
        // Un panneau « nouvelle catégorie » laissé ouvert ne doit pas
        // réapparaître déplié, ni pré-rempli, sur la ligne suivante.
        this.closeQuickCategory();

        this.updateComposantForm.patchValue({
            _id: composant._id,
            name: composant.name,
            package: composant.package,
            prix_achat: composant.prix_achat,
            prix_vente: composant.prix_vente,
            coming_date: composant.coming_date
                ? new Date(composant.coming_date)
                : null,
            quantity_stocked: composant.quantity_stocked,
            status_composant: composant.status_composant,
            category_composant_id: this.normalizeCategoryId(
                composant.category_composant_id
            ),
            link: this.editableValue(composant.link),
            pdf: this.editableValue(composant.pdf),
        });

        this.openModalEdit = true;
    }

    /**
     * Ouvre le MÊME modal en mode création.
     *
     * Le `reset()` est indispensable : `updateComposantForm` n'était jamais
     * réinitialisé (le modal ne servait qu'à l'édition, et `updateComposant`
     * repatche tous les champs). Sans lui, une création ouverte après une
     * édition héritait des valeurs précédentes — **`_id` compris**, ce qui
     * aurait silencieusement transformé la création en mise à jour.
     * `quantity_stocked: 0` reproduit la valeur par défaut du FormGroup.
     */
    openCreateComposant() {
        this.isCreateMode = true;
        this.selectedComposant = null;
        this.pdfFile = null;
        this.pdfPayload = null;
        // Un panneau « nouvelle catégorie » laissé ouvert ne doit pas
        // réapparaître déplié, ni pré-rempli, sur la ligne suivante.
        this.closeQuickCategory();
        this.updateComposantForm.reset({
            _id: null,
            name: '',
            package: '',
            prix_achat: null,
            prix_vente: null,
            coming_date: null,
            quantity_stocked: 0,
            status_composant: '',
            category_composant_id: null,
            link: '',
            pdf: '',
        });
        this.openModalEdit = true;
    }

    /**
     * `(onHide)` du modal composant. Ceinture ET bretelles : les deux ouvreurs
     * replient déjà le panneau, mais eux seuls — la croix, Échap et « Annuler »
     * passaient à côté, et ce modal n'avait aucun `(onHide)` jusqu'ici.
     */
    onComposantDialogHide() {
        this.closeQuickCategory();
    }

    /** Valeur d'un champ texte pour le formulaire : les sentinelles historiques
     *  'undefined' / 'null' (écrites en base par l'ancien enregistrement) ne
     *  doivent pas apparaître comme du contenu éditable. */
    private editableValue(value: any): string {
        if (!value || value === 'undefined' || value === 'null') return '';
        return String(value);
    }

    /** Nom lisible d'un composant pour les toasts. */
    private displayName(composant: any): string {
        const name = this.editableValue(composant?.name);
        return name || composant?._id || '';
    }

    /** Fiche technique déjà stockée sur la ligne en cours d'édition, s'il y en a. */
    get storedPdf(): string {
        return this.editableValue(this.selectedComposant?.pdf);
    }

    /**
     * La dropzone n'émet qu'un `File` validé — l'encodage est à la charge de
     * l'hôte. On garde le base64 à part : c'est LUI qui part au back (seul un
     * data-URL déclenche le téléversement Drive), le contrôle `pdf` ne sert
     * qu'à afficher le nom du fichier retenu.
     */
    onPdfFileSelected(file: File) {
        this.pdfFile = file;
        const reader = new FileReader();
        reader.onload = () => {
            this.pdfPayload = String(reader.result || '');
        };
        reader.onerror = () => {
            this.pdfFile = null;
            this.pdfPayload = null;
            this.notify.error('Lecture du PDF impossible. Réessayez.');
        };
        reader.readAsDataURL(file);
        this.updateComposantForm.patchValue({ pdf: file.name });
    }

    /**
     * Retire le fichier EN ATTENTE. Ne supprime pas la fiche déjà stockée :
     * `addComposantInfo` ignore les champs vides (c'est ce qui protège les
     * données), il n'existe pas de chemin « effacer le PDF ».
     */
    onPdfFileRemoved() {
        this.pdfFile = null;
        this.pdfPayload = null;
        this.updateComposantForm.patchValue({ pdf: '' });
    }

    /**
     * Charge utile envoyée au back.
     *
     * `pdf` ne porte le base64 QUE si un fichier vient d'être déposé ; sinon
     * `''`, qui signifie « ne touche pas à la fiche stockée » côté
     * `addComposantInfo`. Même logique pour tout champ laissé vide : le back
     * ignore `''`/`null`, donc un formulaire partiel ne détruit rien.
     */
    buildSavePayload(): any {
        return {
            ...this.updateComposantForm.value,
            _id: this.updateComposantForm.value._id,
            pdf: this.pdfPayload || '',
        };
    }

    /** Toast d'erreur unique portant le VRAI message serveur. */
    private failWithToast(source: any, fallback: string) {
        this.notify.error(this.errorDetail(source, fallback));
    }

    saveComposant() {
        if (this.updateComposantForm.invalid) return;
        const payload = this.buildSavePayload();

        if (this.isCreateMode) {
            this.createComposant(payload);
            return;
        }

        this.confirm.confirmSave({
            message: 'Voulez-vous enregistrer les modifications ?',
            accept: async () => {
                try {
                    // `ticketService.updateComposant` construit la mutation
                    // `addComposantInfo` : mise à jour PARTIELLE (un champ vide
                    // n'écrase jamais), catégorie validée, téléversement Drive
                    // de la fiche, et renommage répercuté sur les DI liées.
                    // L'ancien `updateComposantTable` faisait un $set complet et
                    // écrasait lien / PDF / catégorie à chaque enregistrement.
                    await this.mutationRunner.run({
                        key: `updateComposant:${payload._id}`,
                        mutation: this.ticketService.updateComposant(payload),
                        successToast: {
                            summary: 'Composant mis à jour',
                            detail: this.displayName(payload),
                        },
                        errorToast: null,
                        onLoading: (v) => (this.loading = v),
                    });
                    this.openModalEdit = false;
                    this.pdfFile = null;
                    this.pdfPayload = null;
                    this.getAllComposants();
                } catch (err) {
                    // Le modal RESTE ouvert : la saisie n'est pas perdue.
                    this.failWithToast(err, 'Sauvegarde impossible. Réessayez.');
                }
            },
        });
    }

    /**
     * Branche « création » de `saveComposant`.
     *
     * `addComposantMagasin` (ticket.service.ts) attend `packageComposant` et
     * `status`, alors que le formulaire — pensé pour la mise à jour — expose
     * `package` et `status_composant`. On adapte ici les clés plutôt que de
     * toucher `buildSavePayload()`, dont la forme est épinglée par le spec.
     * `_id` est ignoré par la mutation : le back génère lui-même son `Cmp<N>`.
     */
    private createComposant(payload: any) {
        this.confirm.confirmCreate({
            message: 'Voulez-vous créer ce composant ?',
            accept: async () => {
                try {
                    await this.mutationRunner.run({
                        key: 'createComposant',
                        mutation: this.ticketService.addComposantMagasin({
                            ...payload,
                            packageComposant: payload.package,
                            status: payload.status_composant,
                        }),
                        // Même garde-fou que la création de catégorie : un
                        // résultat sans `_id` est un échec, pas un succès.
                        check: (data) =>
                            data?.createComposant?._id
                                ? undefined
                                : 'Création impossible : le composant n’a pas été enregistré.',
                        successToast: {
                            summary: 'Composant créé',
                            detail: this.displayName(payload),
                        },
                        errorToast: null,
                        onLoading: (v) => (this.loading = v),
                    });
                    this.openModalEdit = false;
                    this.isCreateMode = false;
                    this.pdfFile = null;
                    this.pdfPayload = null;
                    this.getAllComposants();
                } catch (err) {
                    if ((err as Error)?.message === 'mutation-in-flight') return;
                    // Le modal RESTE ouvert : la saisie n'est pas perdue.
                    this.failWithToast(err, 'Création impossible. Réessayez.');
                }
            },
        });
    }

    // ── Création rapide d'une catégorie (panneau déplié dans le modal) ────
    // Chemin COURT, volontairement distinct de `addNewCategoryComposant()`
    // (modal dédié) : pas de confirmation, pas de navigation, la saisie du
    // composant en cours est préservée, et la catégorie créée est sélectionnée.

    /**
     * Déplie / replie le panneau. L'ouverture REMET le champ à zéro : un nom
     * abandonné lors d'une ouverture précédente ne doit pas revenir prérempli.
     */
    toggleQuickCategory() {
        if (this.quickCategoryLoading) return;
        if (this.quickCategoryOpen) {
            this.closeQuickCategory();
            return;
        }
        this.quickCategoryName.reset('');
        this.quickCategoryOpen = true;
    }

    /** Bouton « Annuler » du panneau. */
    cancelQuickCategory() {
        if (this.quickCategoryLoading) return;
        this.closeQuickCategory();
    }

    /**
     * Replie ET vide. Appelé aussi à chaque ouverture/fermeture du modal.
     * Ne touche à RIEN d'autre — surtout pas `getAllCategories()` : les specs
     * instancient le composant avec un `apollo` à `null`, et cette méthode est
     * appelée depuis `updateComposant()` / `openCreateComposant()`, eux-mêmes
     * testés sans TestBed.
     */
    private closeQuickCategory() {
        this.quickCategoryOpen = false;
        this.quickCategoryName.reset('');
    }

    /**
     * Entrée dans le champ = « Créer ».
     *
     * `preventDefault()` n'est pas cosmétique : ce champ vit DANS le
     * `<form [formGroup]="updateComposantForm">`. On ne veut même pas
     * déclencher le chemin de soumission du formulaire composant.
     */
    onQuickCategoryEnter(event: Event) {
        event.preventDefault();
        this.createQuickCategory();
    }

    /**
     * Crée la catégorie SANS quitter le modal composant, puis la sélectionne.
     *
     * Écarts assumés avec `addNewCategoryComposant()` :
     *  - pas de `confirmationService.confirm` : le geste est déjà explicite
     *    (déplier, saisir, « Créer »), et un `p-confirmDialog` par-dessus un
     *    modal vole le focus du champ ;
     *  - clé de runner PROPRE : `addComposantCategory` appartient à l'autre
     *    modal, et `MutationRunner` garde ses clés en vol dans un registre
     *    GLOBAL (service root) — partager la clé ferait avaler ce clic en
     *    silence dès qu'une création tourne ailleurs ;
     *  - `quickCategoryLoading` au lieu de `loading` (cf. le champ).
     * `errorToast: null` est conservé : on veut le VRAI message du back
     * (« Cette catégorie existe déjà. ») via `failWithToast`.
     */
    async createQuickCategory() {
        const name = String(this.quickCategoryName.value ?? '').trim();
        if (!name) {
            this.quickCategoryName.markAsTouched();
            return;
        }

        // Doublon connu localement : le back refuserait avec un conflit. On
        // évite l'aller-retour ET on donne à l'utilisateur ce qu'il voulait
        // vraiment — la catégorie sélectionnée. Même règle de comparaison que
        // le back (insensible à la casse, sur le nom trimé).
        const known = this.findCategoryOptionByLabel(name);
        if (known) {
            this.updateComposantForm.patchValue({
                category_composant_id: known.value,
            });
            // Succès et non `info` : l'utilisateur voulait une catégorie, il
            // l'a. Le `summary` dit qu'elle a été retrouvée, pas créée.
            this.notify.success(`« ${known.name} » a été sélectionnée.`, {
                summary: 'Catégorie déjà existante',
            });
            this.closeQuickCategory();
            return;
        }

        try {
            const data = await this.mutationRunner.run({
                key: 'quickAddComposantCategory',
                mutation: this.ticketService.addNewCategoryComposant(name),
                // Même garde-fou que l'autre chemin : le back a déjà renvoyé un
                // Error sérialisé en `{_id: null}` SANS tableau `errors`, que le
                // runner prenait pour un succès.
                check: (d) =>
                    d?.createComposant_Category?._id
                        ? undefined
                        : 'Création impossible : la catégorie n’a pas été enregistrée.',
                successToast: { summary: 'Catégorie créée', detail: name },
                errorToast: null,
                onLoading: (v) => (this.quickCategoryLoading = v),
            });

            const created = data.createComposant_Category;
            this.selectCreatedCategory(
                created._id,
                created.category_composant || name,
            );
            this.closeQuickCategory();
            // APRÈS la sélection optimiste : la réponse serveur contient la
            // nouvelle catégorie, la valeur choisie reste donc valide, et la
            // table du modal de gestion est resynchronisée au passage.
            this.getAllCategories();
        } catch (err) {
            if ((err as Error)?.message === 'mutation-in-flight') return;
            // Le panneau RESTE ouvert, le nom saisi n'est pas perdu — même
            // convention que `saveComposant()` / `createComposant()`.
            this.failWithToast(
                err,
                'La catégorie n’a pas pu être créée. Réessayez.',
            );
            // Conflit « existe déjà » alors que la liste locale était périmée
            // (catégorie créée entre-temps ailleurs) : on relit, et le 2e clic
            // sur « Créer » tombera sur la branche `known` et sélectionnera.
            this.getAllCategories();
        }
    }

    /**
     * Option correspondant à ce libellé. Comparaison INSENSIBLE à la casse et
     * aux espaces de bord : c'est exactement la règle du back
     * (`$regex: ^nom$` avec `$options: 'i'` sur le nom trimé).
     */
    private findCategoryOptionByLabel(
        label: string,
    ): { name: string; value: string } | undefined {
        const needle = String(label ?? '')
            .trim()
            .toLowerCase();
        if (!needle) return undefined;
        return (this.composantCategory || []).find(
            (o) =>
                String(o?.name ?? '')
                    .trim()
                    .toLowerCase() === needle,
        );
    }

    /**
     * Insère l'option et la sélectionne, SANS attendre `getAllCategories()`.
     *
     * Deux raisons :
     *  1. `p-dropdown` ne sait afficher un libellé que si la valeur figure dans
     *     `options` ; patcher avant l'insertion laisserait le placeholder
     *     « Choisir une catégorie » le temps de l'aller-retour réseau ;
     *  2. il faut une NOUVELLE référence de tableau — un `push` ne déclenche
     *     pas le `ngOnChanges` du dropdown, l'option resterait invisible.
     * Tête de liste = l'ordre que renverra le back (`createdAt: -1`).
     */
    private selectCreatedCategory(id: string, label: string) {
        if (!this.composantCategory.some((o) => o.value === id)) {
            this.composantCategory = [
                { name: label, value: id },
                ...this.composantCategory,
            ];
        }
        this.updateComposantForm.patchValue({ category_composant_id: id });
    }

    // ── Modal « Création Catégorie Composants » ───────────────────────────
    // Déplacé depuis l'écran magasin : le catalogue est désormais le seul
    // endroit où l'on crée composants et catégories.

    showDialogCategoryComposant() {
        this.openCreationCategoryComposantModal = true;
        this.getAllCategories();
    }

    formatCell(row: any, field: string): string {
        return formatTableValue(row, field);
    }

    addNewCategoryComposant() {
        const categoryName = this.addCategoryCompsant.value.categoryName;
        if (!categoryName?.trim()) {
            this.addCategoryCompsant.markAllAsTouched();
            return;
        }
        this.confirm.confirmCreate({
            message: 'Voulez-vous créer cette catégorie ?',
            accept: async () => {
                try {
                    await this.mutationRunner.run({
                        key: 'addComposantCategory',
                        mutation:
                            this.ticketService.addNewCategoryComposant(
                                categoryName
                            ),
                        // Le back a déjà renvoyé un objet Error sérialisé en
                        // `{_id: null}` SANS tableau `errors`, ce que le runner
                        // prenait pour un succès (toast vert, rien de créé).
                        // Un `_id` absent = échec, point.
                        check: (data) =>
                            data?.createComposant_Category?._id
                                ? undefined
                                : 'Création impossible : la catégorie n’a pas été enregistrée.',
                        successToast: {
                            summary: 'Catégorie créée',
                            detail: categoryName,
                        },
                        // Toast générique désactivé : on veut le VRAI message
                        // du back (« Cette catégorie existe déjà. »).
                        errorToast: null,
                        onLoading: (v) => (this.loading = v),
                    });
                    this.addCategoryCompsant.reset();
                    this.getAllCategories();
                } catch (err) {
                    if ((err as Error)?.message === 'mutation-in-flight') return;
                    this.failWithToast(
                        err,
                        'La catégorie n’a pas pu être créée. Réessayez.'
                    );
                }
            },
        });
    }

    deleteCategorycomposant(rowData: any) {
        this.confirm.confirmDelete({
            message: 'Voulez-vous supprimer cette catégorie ?',
            accept: async () => {
                try {
                    await this.mutationRunner.run({
                        key: `removeComposantCategory:${rowData._id}`,
                        mutation: this.ticketService.removeComposant_Category(
                            rowData._id
                        ),
                        successToast: {
                            summary: 'Catégorie supprimée',
                            detail: rowData.category_composant || '',
                        },
                        errorToast: {
                            summary: 'Erreur',
                            detail: 'Suppression impossible. Réessayez.',
                        },
                        onLoading: (v) => (this.loading = v),
                    });
                    // Rafraîchit la table du modal ET les options du dropdown.
                    this.getAllCategories();
                } catch {
                    /* toast déjà affiché par le runner */
                }
            },
        });
    }

    getFormattedDate(date: string | null): string {
        if (!date) return TABLE_EMPTY_VALUE;
        const d = new Date(date);
        return isNaN(d.getTime())
            ? TABLE_EMPTY_VALUE
            : d.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    /**
     * Cellule vide : « — », le placeholder partagé de toutes les listes
     * (`table-display.utils`). Les chaînes 'undefined' / 'null' sont des
     * valeurs RÉELLEMENT présentes en base sur d'anciens composants, d'où le
     * traitement en amont de `formatTableValue`.
     */
    formatValue(value: any): string {
        if (value === 'undefined' || value === 'null') {
            return TABLE_EMPTY_VALUE;
        }
        return formatTableValue({ value }, 'value');
    }

    /** Un statut réellement renseigné ? Sinon on n'affiche pas de pastille vide. */
    hasStatus(value: any): boolean {
        return this.formatValue(value) !== TABLE_EMPTY_VALUE;
    }
}
