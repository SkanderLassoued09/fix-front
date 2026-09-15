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

type AfDocKey = 'BC' | 'BL' | 'Facture' | 'Devis';

/**
 * Les 4 documents de cycle, dans l'ordre d'affichage. Constante de MODULE (et
 * non champ d'instance) pour que les getters de présentation soient des
 * fonctions pures de l'état : ils restent exerçables sur un objet créé par
 * `Object.create(prototype)`, sans TestBed ni injection.
 */
const AFFECTATION_DOC_TYPES: ReadonlyArray<{
    key: AfDocKey;
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
 * Emplacements de dépôt, dans l'ordre d'affichage ET d'enregistrement.
 *  - Clôture documentaire (WAITING_BL … FINISHED) : BL puis Facture.
 *  - DI IRRÉPARABLE : les 4 documents. Devis AVANT BC : le back refuse un BC
 *    sans devis (`BC_REQUIRES_DEVIS`), la chaîne doit donc déposer le devis
 *    d'abord quand les deux partent ensemble.
 */
const CLOSING_UPLOAD_KEYS: ReadonlyArray<AfDocKey> = ['BL', 'Facture'];
const IRREPARABLE_UPLOAD_KEYS: ReadonlyArray<AfDocKey> = [
    'Devis',
    'BC',
    'BL',
    'Facture',
];

export interface AfUploadSlot {
    key: AfDocKey;
    tag: string;
    label: string;
    /** Document déjà présent sur la DI : dépôt DÉFINITIVEMENT fermé (sur une
     *  DI irréparable, le back refuse aussi le second dépôt). */
    filled: boolean;
    /** Prérequis manquant : Facture sans BL (WAITING_BL), BC sans devis. */
    locked: boolean;
    lockHint: string;
}

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

    // ── État interne, par emplacement ───────────────────────────────────────
    finishedData: any = null;
    /** Aperçu (data-URL) du fichier en attente. */
    selected: Partial<Record<AfDocKey, string>> = {};
    /** Lecture du fichier en cours. */
    slotLoading: Partial<Record<AfDocKey, boolean>> = {};
    isLoading = false;

    /** Cache base64, pour que l'unique « Enregistrer » du pied persiste tous
     *  les emplacements en attente en une cascade. */
    affectationBase64: Partial<Record<AfDocKey, string>> = {};
    /** Nom + taille réels du fichier en attente. */
    afSelectedMeta: Partial<Record<AfDocKey, { name: string; size: number }>> =
        {};
    /** Surbrillance de survol (visuel seul). */
    afDragActive: Partial<Record<AfDocKey, boolean>> = {};

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
        this.selected = {};
        this.slotLoading = {};
        this.affectationBase64 = {};
        this.afSelectedMeta = {};
        this.afDragActive = {};
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

    /**
     * `documents[]` du CYCLE 0 : les VRAIS noms de ses fichiers (nom standard
     * `{Nom}_{Type}_{JJ-MM-AAAA}_{HH-mm-ss}`), dérivés de SON `driveDocs` par le
     * back (`withCycleDocuments`).
     *
     * Lus sur `di.logs` : la projection `COORDINATOR_DI_FIELDS` les porte sur les
     * deux chemins d'ouverture (trombone et deep-link), alors que
     * `getAllLogsByDi` rend des lignes brutes, sans `documents`.
     */
    private get cycle0Documents(): any[] {
        const loaded = this.cycle0Log?.documents;
        if (Array.isArray(loaded) && loaded.length) return loaded;
        const row = (this.filesSelected?.logs ?? []).find(
            (l: any) => Number(l?.idIgnore ?? 0) === 0,
        );
        return Array.isArray(row?.documents) ? row.documents : [];
    }

    /**
     * Emplacements de dépôt de la DI courante (voir `CLOSING_UPLOAD_KEYS` /
     * `IRREPARABLE_UPLOAD_KEYS`).
     *
     * `filled` lit le MIROIR de la DI, c'est-à-dire le cycle COURANT : c'est bien
     * là que le prochain dépôt écrirait (`writeCurrentCycleDoc`). Une fois rempli,
     * l'emplacement ne se rouvre plus — il n'y a pas de remplacement.
     */
    get uploadSlots(): AfUploadSlot[] {
        const di = this.filesSelected;
        const irreparable = di?.status === 'IRREPARABLE';
        const keys = irreparable ? IRREPARABLE_UPLOAD_KEYS : CLOSING_UPLOAD_KEYS;
        return keys.map((key) => {
            const t = AFFECTATION_DOC_TYPES.find((d) => d.key === key)!;
            const filled = !!di?.[t.field];
            let lockHint = '';
            if (!filled && key === 'Facture' && di?.status === 'WAITING_BL') {
                // Séquence de clôture : l'upload du BL fait passer la DI en
                // WAITING_FACTURE (transition auto back), qui rouvre la Facture.
                lockHint = "Téléversez d'abord le Bon de livraison (BL).";
            } else if (
                !filled &&
                irreparable &&
                key === 'BC' &&
                !di?.devis &&
                !this.affectationBase64?.['Devis']
            ) {
                lockHint = "Téléversez d'abord le devis.";
            }
            return {
                key,
                tag: t.tag,
                label: t.label,
                filled,
                locked: !!lockHint,
                lockHint,
            };
        });
    }

    /** Emplacements dont le fichier partira au prochain « Enregistrer », dans
     *  l'ordre de la chaîne (celui de `uploadSlots`). */
    get pendingUploadKeys(): AfDocKey[] {
        return this.uploadSlots
            .filter(
                (s) =>
                    !s.filled && !s.locked && !!this.affectationBase64?.[s.key],
            )
            .map((s) => s.key);
    }

    /** Fichiers sélectionnés mais pas encore enregistrés. */
    get affectationPendingCount(): number {
        return this.pendingUploadKeys.length;
    }

    trackSlot(_: number, s: AfUploadSlot): string {
        return s.key;
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
     * La source est donc la ligne `logsdis` du cycle 0. En retour, seule cette
     * ligne fait foi.
     *
     * NOM affiché = le nom STANDARD du fichier, comme dans la frise des retours :
     * d'abord les `documents[]` de la ligne de cycle 0 (`cycle0Documents`) —
     * lecture PAR TYPE sûre, ce sont ses propres fichiers. Au cycle 0, le miroir
     * EST ce cycle : repli sur `di.documents`. Un fichier hérité sans nom stocké
     * (lien nu, pas de `driveDocs`) garde le libellé générique.
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
        const cycle0ByType = new Map<string, any>();
        for (const d of this.cycle0Documents) {
            if (d?.type) cycle0ByType.set(String(d.type), d);
        }
        return AFFECTATION_DOC_TYPES.map((t) => {
            // En retour on lit l'URL sur le cycle 0 ; hors retour, le miroir.
            // Le nom vient d'abord des documents DU cycle 0, jamais du miroir
            // en retour (il décrit le retour).
            const doc =
                cycle0ByType.get(t.key) ?? (isRetour ? null : byType.get(t.key));
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
    onAfDragOver(ev: DragEvent, key: AfDocKey) {
        ev.preventDefault();
        this.afDragActive = { ...this.afDragActive, [key]: true };
    }

    onAfDragLeave(ev: DragEvent, key: AfDocKey) {
        ev.preventDefault();
        this.afDragActive = { ...this.afDragActive, [key]: false };
    }

    onAfDrop(ev: DragEvent, key: AfDocKey) {
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

    onAfPicker(ev: Event, key: AfDocKey) {
        const input = ev.target as HTMLInputElement;
        const files = Array.from(input.files ?? []);
        if (files.length) this.takeFile(files[0], key);
        // Remis à zéro pour que re-choisir le MÊME fichier déclenche `change`.
        input.value = '';
    }

    /**
     * Prend en compte un fichier pour un emplacement : aperçu local + base64
     * mis en cache pour l'enregistrement du pied.
     *
     * N'appelle PAS le `onUpload` de `ticket-list` : celui-ci est un aiguillage
     * multi-types couplé à l'état de cette page, et il alimente le `payload`
     * legacy que cette modale n'utilise pas.
     */
    takeFile(file: File, key: AfDocKey): void {
        // Emplacement rempli (document déjà sur la DI) ou verrouillé : on ignore
        // toute nouvelle sélection (couvre le drop, que `[disabled]` ne bloque
        // pas).
        const slot = this.uploadSlots.find((s) => s.key === key);
        if (!slot || slot.filled || slot.locked) return;

        this.afSelectedMeta = {
            ...this.afSelectedMeta,
            [key]: { name: file.name, size: file.size },
        };
        this.slotLoading = { ...this.slotLoading, [key]: true };
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
            this.selected = { ...this.selected, [key]: base64 };
            this.slotLoading = { ...this.slotLoading, [key]: false };
            this.isLoading = false;
            this.notify.info(
                'Cliquez sur « Enregistrer » pour le téléverser.',
                { summary: 'Fichier prêt' },
            );
        };
        reader.onerror = (error) => {
            console.error('File read error:', error);
            this.slotLoading = { ...this.slotLoading, [key]: false };
            this.isLoading = false;
        };
    }

    /** Retire UN emplacement en attente sans toucher aux autres : la zone de
     *  dépôt revient. Un emplacement qui en DÉPENDAIT (BC en attente dont on
     *  retire le devis) est vidé aussi — il redevient verrouillé, et son fichier
     *  serait refusé par le back. */
    clearAffectationSlot(key: AfDocKey) {
        this.dropPending(key);
        for (const s of this.uploadSlots) {
            if (s.locked && this.affectationBase64[s.key]) {
                this.dropPending(s.key);
            }
        }
    }

    private dropPending(key: AfDocKey): void {
        const next = { ...this.affectationBase64 };
        delete next[key];
        this.affectationBase64 = next;
        const meta = { ...this.afSelectedMeta };
        delete meta[key];
        this.afSelectedMeta = meta;
        const sel = { ...this.selected };
        delete sel[key];
        this.selected = sel;
        this.slotLoading = { ...this.slotLoading, [key]: false };
    }

    /** Taille lisible : `n o` / `n Ko` / `n,nn Mo`. */
    formatFileSize(bytes: number | undefined): string {
        if (!Number.isFinite(bytes) || (bytes ?? 0) <= 0) return '0 o';
        const n = bytes as number;
        if (n < 1024) return `${n} o`;
        if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
        return `${(n / (1024 * 1024)).toFixed(2).replace('.', ',')} Mo`;
    }

    /** Mutation de dépôt d'un emplacement. */
    private uploadMutation(key: AfDocKey, id: string, pdf: string): any {
        switch (key) {
            case 'Devis':
                return this.ticketService.addDevis(id, pdf);
            case 'BC':
                return this.ticketService.addBC(id, pdf);
            case 'BL':
                return this.ticketService.addBL(id, pdf);
            default:
                return this.ticketService.addFacture(id, pdf);
        }
    }

    /** Unique « Enregistrer » : persiste tous les fichiers en attente en une
     *  cascade (ordre Devis → BC → BL → Facture), un seul confirm, un seul toast.
     *  `MutationRunner` gère l'anti-double-clic et la remise à zéro du spinner. */
    saveAffectationFichiers() {
        const id = this.filesSelected?._id;
        if (!id) return;
        const keys = this.pendingUploadKeys;
        if (!keys.length) {
            this.close();
            return;
        }
        const count = keys.length;
        this.confirm.confirmSave({
            message: `Enregistrer ${count} fichier${count > 1 ? 's' : ''} ?`,
            accept: async () => {
                const steps = keys.map((key) => ({
                    mutation: this.uploadMutation(
                        key,
                        id,
                        this.affectationBase64[key] as string,
                    ),
                }));
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
