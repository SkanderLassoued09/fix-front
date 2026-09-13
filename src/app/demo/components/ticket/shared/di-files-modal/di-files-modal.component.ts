import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    OnChanges,
    Output,
    SimpleChanges,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Apollo } from 'apollo-angular';
import { tap } from 'rxjs/operators';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { docHref } from '../doc-href.util';
import { NotifyService } from '../../../../../shared/ui/notify.service';
import { ConfirmService } from '../../../../../shared/ui/confirm.service';

/**
 * Les 4 documents de cycle, dans l'ordre d'affichage. Constante de MODULE (et
 * non champ d'instance) pour que les getters de présentation soient des
 * fonctions pures de l'état : ils restent exerçables sur un objet créé par
 * `Object.create(prototype)`, sans TestBed ni injection.
 */
const AFFECTATION_DOC_TYPES: ReadonlyArray<{
    key: 'BC' | 'BL' | 'Facture' | 'Devis';
    tag: string;
    label: string;
    field: 'bon_de_commande' | 'bon_de_livraison' | 'facture' | 'devis';
}> = [
    { key: 'BC', tag: 'BC', label: 'Bon de commande', field: 'bon_de_commande' },
    { key: 'BL', tag: 'BL', label: 'Bon de livraison', field: 'bon_de_livraison' },
    { key: 'Facture', tag: 'FAC', label: 'Facture', field: 'facture' },
    { key: 'Devis', tag: 'DEV', label: 'Devis', field: 'devis' },
];

/**
 * MODALE « AFFECTATION DES FICHIERS » — composant PARTAGÉ.
 *
 * Extraite telle quelle de `ticket-list` (template, styles et logique
 * inchangés) pour une seule raison : la notification BL doit pouvoir l'ouvrir
 * SUR PLACE, depuis n'importe quelle page et pour n'importe quel rôle
 * destinataire.
 *
 * POURQUOI. Le deep-link naviguait vers `ticket-list?di=…&action=affectation`,
 * puis `DeepLinkConsumer` cherchait la ligne dans les DI DÉJÀ CHARGÉES — or la
 * liste n'en charge que 10 (les plus récentes) alors qu'une DI en `WAITING_BL`
 * est par construction ancienne. La ligne n'était donc jamais trouvée : après
 * 3,2 s de retries on retombait sur la modale DÉTAIL. Et la coordinatrice —
 * première destinataire de l'alerte — était de toute façon refusée sur
 * `ticket-list` par `routeAccessGuard`.
 *
 * Le montage reprend à l'identique celui de `di-info-modal` : une instance
 * GLOBALE dans `app.component.html` pilotée par `DiFilesService` (ouverture par
 * id, sans navigation), plus une instance LOCALE dans `ticket-list` pour le
 * bouton trombone — qui, elle, rafraîchit la liste via `(saved)`.
 *
 * Le composant ne connaît RIEN de la page hôte : il reçoit la DI, charge
 * lui-même ses `LogsDi`, et signale l'enregistrement par `(saved)`.
 */
@Component({
    selector: 'app-di-files-modal',
    standalone: true,
    imports: [CommonModule, DialogModule, ButtonModule],
    // `ConfirmationService` est désormais fourni à la RACINE (`app.module.ts`)
    // et rendu par l'unique `<app-fx-confirm-dialog>` du shell : cette modale
    // n'a plus besoin de son propre canal de confirmation.
    templateUrl: './di-files-modal.component.html',
    styleUrls: ['./di-files-modal.component.scss'],
})
export class DiFilesModalComponent implements OnChanges {

    @Input() visible = false;
    @Output() visibleChange = new EventEmitter<boolean>();

    /** La DI : une ligne de liste (bouton trombone) ou un objet chargé par id
     *  (`DiFilesService`). Les deux portent la même projection. */
    @Input() di: any | null = null;

    /** Récupération de la DI en cours (ouverture par id) → corps en attente.
     *  Toujours `false` pour le trombone, qui a déjà la ligne en main. */
    @Input() loading = false;

    /** Émis après un enregistrement réussi. */
    @Output() saved = new EventEmitter<void>();

    // ── État interne (identique à l'ancien état de ticket-list) ─────────────
    finishedData: any = null;
    selectedBL: string = '';
    selectedFacture: string = '';
    blLoading = false;
    factureLoading = false;
    blBtnDisabled = false;
    factureBtnDisabled = false;
    isLoading = false;

    /** Cache base64 par type, pour que l'unique « Enregistrer » du pied
     *  persiste BL ET Facture en une cascade. */
    affectationBase64: Record<string, string> = {};
    /** Nom + taille réels du fichier en attente, par emplacement. */
    afSelectedMeta: Record<string, { name: string; size: number }> = {};
    /** Surbrillance de survol par emplacement (visuel seul). */
    afDragActive: Record<string, boolean> = {};

    readonly docHref = docHref;

    constructor(
        private readonly apollo: Apollo,
        private readonly ticketService: TicketService,
        private readonly mutationRunner: MutationRunner,
        private readonly confirm: ConfirmService,
        private readonly notify: NotifyService,
    ) {}

    /** La DI courante. Conservé sous ce nom : le template l'utilise partout. */
    get filesSelected(): any {
        return this.di;
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['di']) {
            this.resetState();
            if (this.di?._id) this.loadLogs(this.di._id);
        }
    }

    /** Remet les drapeaux à neuf à chaque DI — sinon une sélection en attente
     *  d'une DI précédente fuirait sur la suivante (la modale globale est un
     *  singleton réutilisé d'une notification à l'autre). */
    private resetState(): void {
        this.finishedData = null;
        this.selectedBL = '';
        this.selectedFacture = '';
        this.affectationBase64 = {};
        this.afSelectedMeta = {};
        this.afDragActive = {};
        this.blLoading = false;
        this.factureLoading = false;
        this.blBtnDisabled = false;
        this.factureBtnDisabled = false;
        this.isLoading = false;
    }

    /** Historique des retours (LogsDi) pour la frise. */
    private loadLogs(diId: string): void {
        this.apollo
            .query<any>({ query: this.ticketService.getLogsDi(diId) })
            .pipe(
                tap(({ data }) => {
                    if (data) {
                        this.finishedData = {
                            original: this.di,
                            logs: data.getAllLogsByDi,
                        };
                    }
                }),
            )
            .subscribe({
                error: (err) => console.error('Error fetching logs:', err),
            });
    }

    close(): void {
        this.visible = false;
        this.visibleChange.emit(false);
    }

    onVisibleChange(v: boolean): void {
        this.visible = v;
        this.visibleChange.emit(v);
        if (!v) this.resetState();
    }

    // ─── Présentation ───────────────────────────────────────────────────────
    readonly affectationDocTypes = AFFECTATION_DOC_TYPES;

    /** Nombre de documents « Disponible » — alimente la pastille
     *  `FICHIERS PRINCIPAUX (n)`. Dérivé des cartes RÉELLEMENT affichées : la
     *  pastille comptait le miroir DI alors que les cartes montrent le cycle 0,
     *  donc elle annonçait « 4 » au-dessus de quatre cartes « Manquant ». */
    get affectationAvailableCount(): number {
        return this.affectationMainCards.filter((c) => c.present).length;
    }

    /** Cycle courant de la DI. `> 0` ⇒ la DI est en RETOUR, et son miroir
     *  (`di.devis`, `di.documents`…) décrit le cycle EN COURS, pas l'origine. */
    private get currentCycle(): number {
        return Number(this.filesSelected?.ignoreCount ?? 0) || 0;
    }

    /** Le dossier du CYCLE 0 (`logsdis.idIgnore === 0`), source de vérité des
     *  fichiers du flux d'origine. */
    private get cycle0Log(): any | null {
        const logs = this.finishedData?.logs ?? [];
        return logs.find((l: any) => Number(l?.idIgnore ?? 0) === 0) ?? null;
    }

    /** Fichiers sélectionnés mais pas encore enregistrés. */
    get affectationPendingCount(): number {
        return (this.selectedBL ? 1 : 0) + (this.selectedFacture ? 1 : 0);
    }

    /** Séquence documentaire de clôture : la Facture ne peut être téléversée
     *  qu'APRÈS le BL. Tant que la DI est en `WAITING_BL` (BL absent), le slot
     *  Facture est VERROUILLÉ ; l'upload du BL fait passer la DI en
     *  `WAITING_FACTURE` (transition auto back) → au ré-affichage le slot
     *  s'ouvre. Les DI legacy (`CLOSING`/`ATTENTE_BL_FACTURE`) et `FINISHED`
     *  ne sont PAS verrouillées (ancien flux BL+Facture ensemble / gestion
     *  a posteriori). */
    get factureSlotLocked(): boolean {
        return this.filesSelected?.status === 'WAITING_BL';
    }

    /**
     * « Fichiers principaux » — les documents du FLUX D'ORIGINE (cycle 0), et
     * eux seuls.
     *
     * POURQUOI ce n'est PAS le miroir de la DI. `Di.*` ne garde qu'un MIROIR du
     * cycle COURANT : sur une DI en retour, `di.documents` / `di.devis` sont les
     * fichiers du retour, pas ceux de l'origine. Le bloc affichait donc les
     * fichiers du retour sous « principaux », et les mêmes fichiers
     * réapparaissaient dans la frise juste en dessous.
     *
     * La source est donc la ligne `logsdis` du cycle 0. Au cycle 0 cette ligne
     * et le miroir disent la même chose : on garde le miroir (il porte les vrais
     * noms Drive via `documents[]`, que la requête `getAllLogsByDi` n'expose
     * pas). En retour, seule la ligne de cycle 0 fait foi.
     */
    get affectationMainCards(): Array<{
        tag: string;
        present: boolean;
        title: string;
        statusLabel: string;
        href: string | null;
    }> {
        const isRetour = this.currentCycle > 0;
        const log = this.cycle0Log;
        const byType = new Map<string, any>();
        for (const d of this.filesSelected?.documents ?? []) {
            if (d?.type) byType.set(String(d.type), d);
        }
        return AFFECTATION_DOC_TYPES.map((t) => {
            // En retour on lit l'URL sur le cycle 0 ; hors retour, le miroir.
            const doc = isRetour ? null : byType.get(t.key);
            const scalar = isRetour
                ? log?.[t.field]
                : this.filesSelected?.[t.field];
            const href = doc?.webViewLink || scalar || null;
            const present = !!href;
            // Le vrai nom Drive n'existe que sur `documents[]` (niveau DI) : en
            // retour on le retrouve par correspondance d'URL, sinon libellé.
            const name =
                (doc?.name && String(doc.name).trim()) ||
                (href ? this.driveNameForHref(href) : '');
            return {
                tag: t.tag,
                present,
                title: present ? name || t.label : t.label,
                statusLabel: present ? 'Disponible' : 'Manquant',
                href,
            };
        });
    }

    /**
     * Vrai nom Drive d'un document, retrouvé dans les `documents[]` de la DI par
     * correspondance EXACTE d'URL.
     *
     * Volontairement PAS de repli « par type » ici, contrairement aux puces de la
     * frise : `documents[]` décrit le cycle COURANT, donc sur une DI en retour un
     * repli par type collerait le nom du fichier DU RETOUR sous le lien du cycle
     * 0. Sans correspondance exacte on rend le libellé générique (« Facture ») —
     * moins précis, mais jamais le nom d'un fichier d'un autre cycle.
     */
    private driveNameForHref(href: string): string {
        const h = String(href ?? '').trim();
        if (!h) return '';
        for (const d of this.filesSelected?.documents ?? []) {
            const nm = String(d?.name ?? '').trim();
            if (nm && String(d?.webViewLink ?? '').trim() === h) return nm;
        }
        return '';
    }

    /** Historique des retours pour la frise (snapshots LogsDi). */
    get affectationRetours(): Array<{
        num: number;
        date: string;
        docs: Array<{ name: string; href: string }>;
    }> {
        const logs = this.finishedData?.logs ?? [];
        // `getAllLogsByDi` renvoie AUSSI la ligne du cycle 0 (voir le commentaire
        // de tri côté back). Sans ce filtre la frise affichait un « Retour N°0 »
        // — le flux d'origine n'est pas un retour, il est au-dessus.
        return logs
            .filter((log: any) => Number(log?.idIgnore ?? 0) > 0)
            .map((log: any, i: number) => ({
                num: Number(log?.idIgnore ?? i + 1),
                date: log?.createdAt
                    ? new Date(log.createdAt).toLocaleDateString('fr-FR')
                    : '',
                docs: this.affectationRetourDocs(log),
            }));
    }

    /** Puces de documents par retour (URLs scalaires du log). Le VRAI nom est
     *  résolu depuis les `documents` de la DI : correspondance exacte d'URL
     *  d'abord (le fichier précis), puis par TYPE (le fichier courant de ce
     *  type — BC/Devis sont rarement remplacés d'un cycle à l'autre), et repli
     *  sur le libellé générique seulement si la DI n'a aucun document de ce
     *  type. */
    affectationRetourDocs(log: any): Array<{ name: string; href: string }> {
        const nameByLink = new Map<string, string>();
        const nameByType = new Map<string, string>();
        for (const d of this.filesSelected?.documents ?? []) {
            const nm = String(d?.name ?? '').trim();
            if (!nm) continue;
            const link = String(d?.webViewLink ?? '').trim();
            if (link) nameByLink.set(link, nm);
            if (d?.type) nameByType.set(String(d.type), nm);
        }
        const out: Array<{ name: string; href: string }> = [];
        const push = (href: any, type: string, label: string) => {
            const h = String(href ?? '').trim();
            if (!h) return;
            out.push({
                name: nameByLink.get(h) || nameByType.get(type) || label,
                href: h,
            });
        };
        push(log?.bon_de_commande, 'BC', 'BC');
        push(log?.devis, 'Devis', 'Devis');
        push(log?.bon_de_livraison, 'BL', 'BL');
        push(log?.facture, 'Facture', 'Facture');
        return out;
    }

    // ─── Sélection de fichier (glisser-déposer + sélecteur) ─────────────────
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
        // PDF uniquement — l'attribut `accept` de la zone n'est qu'indicatif au drop.
        const files = all.filter(
            (f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name),
        );
        if (!files.length) {
            this.notify.warn('Glissez un fichier PDF.', {
                summary: 'Format non supporté',
            });
            return;
        }
        this.takeFile(files[0], key);
    }

    onAfPicker(ev: Event, key: string) {
        const input = ev.target as HTMLInputElement;
        const files = Array.from(input.files ?? []);
        if (files.length) this.takeFile(files[0], key);
        // Remis à zéro pour que re-choisir le MÊME fichier déclenche `change`.
        input.value = '';
    }

    /**
     * Prend en compte un fichier pour un emplacement ('BL' | 'Facture') :
     * aperçu local + base64 mis en cache pour l'enregistrement du pied.
     *
     * N'appelle PAS le `onUpload` de `ticket-list` : celui-ci est un aiguillage
     * multi-types (BC / Devis / image compris) couplé à l'état de cette page, et
     * il alimente le `payload` legacy que cette modale n'utilise pas. Seuls les
     * deux emplacements BL et Facture nous concernent ici.
     */
    private takeFile(file: File, key: string): void {
        // Emplacement verrouillé une fois le document présent sur la DI : on
        // ignore toute nouvelle sélection (couvre le drop, que `[disabled]` ne
        // bloque pas).
        const already =
            (key === 'BL' && !!this.filesSelected?.bon_de_livraison) ||
            (key === 'Facture' && !!this.filesSelected?.facture);
        if (already) return;

        this.afSelectedMeta = {
            ...this.afSelectedMeta,
            [key]: { name: file.name, size: file.size },
        };
        if (key === 'BL') this.blLoading = true;
        else this.factureLoading = true;
        this.isLoading = true;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = reader.result as string;
            this.affectationBase64 = {
                ...this.affectationBase64,
                [key]: base64,
            };
            // L'aperçu réutilise la data-URL : pas d'`URL.createObjectURL`, donc
            // rien à révoquer (l'ancien flux fuyait un blob par sélection).
            if (key === 'BL') {
                this.selectedBL = base64;
                this.blLoading = false;
            } else {
                this.selectedFacture = base64;
                this.factureLoading = false;
            }
            this.isLoading = false;
            this.notify.info(
                'Cliquez sur « Enregistrer » pour le téléverser.',
                { summary: 'Fichier prêt' },
            );
        };
        reader.onerror = (error) => {
            console.error('File read error:', error);
            this.blLoading = false;
            this.factureLoading = false;
            this.isLoading = false;
        };
    }

    /** Retire UN emplacement en attente sans toucher à l'autre : vide l'aperçu
     *  et le base64 caché pour que la zone de dépôt revienne (remplacement). */
    clearAffectationSlot(type: 'BL' | 'Facture') {
        const next = { ...this.affectationBase64 };
        delete next[type];
        this.affectationBase64 = next;
        const meta = { ...this.afSelectedMeta };
        delete meta[type];
        this.afSelectedMeta = meta;
        if (type === 'BL') {
            this.selectedBL = '';
            this.blLoading = false;
        } else {
            this.selectedFacture = '';
            this.factureLoading = false;
        }
    }

    /** Taille lisible : `n o` / `n Ko` / `n,nn Mo`. */
    formatFileSize(bytes: number | undefined): string {
        if (!Number.isFinite(bytes) || (bytes ?? 0) <= 0) return '0 o';
        const n = bytes as number;
        if (n < 1024) return `${n} o`;
        if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
        return `${(n / (1024 * 1024)).toFixed(2).replace('.', ',')} Mo`;
    }

    /** Unique « Enregistrer » : persiste tous les fichiers en attente (BL
     *  et/ou Facture) en une cascade, un seul confirm, un seul toast.
     *  `MutationRunner` gère l'anti-double-clic et la remise à zéro du spinner. */
    saveAffectationFichiers() {
        const id = this.filesSelected?._id;
        if (!id) return;
        const bl = this.affectationBase64['BL'];
        const fac = this.affectationBase64['Facture'];
        if (!bl && !fac) {
            this.close();
            return;
        }
        const count = (bl ? 1 : 0) + (fac ? 1 : 0);
        this.confirm.confirmSave({
            message: `Enregistrer ${count} fichier${count > 1 ? 's' : ''} ?`,
            accept: async () => {
                const steps: Array<{ mutation: any }> = [];
                if (bl) steps.push({ mutation: this.ticketService.addBL(id, bl) });
                if (fac)
                    steps.push({
                        mutation: this.ticketService.addFacture(id, fac),
                    });
                try {
                    await this.mutationRunner.runChain({
                        key: `affectationFichiers:${id}`,
                        steps,
                        // Toast de succès « Fichiers enregistrés » retiré (bruit :
                        // les cartes passent déjà à « Disponible »). On garde le
                        // toast d'ERREUR pour signaler un échec d'enregistrement.
                        errorToast: {
                            summary: 'Erreur',
                            detail: "Échec de l'enregistrement. Réessayez.",
                        },
                        onLoading: (v) => (this.isLoading = v),
                    });
                    this.close();
                    this.saved.emit();
                } catch {
                    /* toasté ; la modale reste ouverte pour réessayer */
                }
            },
        });
    }
}
