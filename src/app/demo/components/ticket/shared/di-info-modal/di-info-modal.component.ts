import { CommonModule } from '@angular/common';
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

/**
 * Shared read-only "Information demande d'intervention" modal.
 *
 * Used by BOTH the Coordinator and Interventions (ticket-list) pages — the two
 * pages used to ship the same modal as two inline copies which drifted apart
 * (font sizes, off-charte purple). One component now owns the markup so the
 * two pages always render identically.
 *
 * Usage:
 *   <app-di-info-modal
 *     [(visible)]="ticketDetailsInfo"
 *     [di]="ticketData?.data"
 *   ></app-di-info-modal>
 *
 * The component is pure presentation — no mutations, no GraphQL — and inputs
 * the DI as a flat object (`{title, _idnum, price, final_price, …}`). Optional
 * `context` lets the host hint at a small variant if ever needed; today both
 * pages render exactly the same shape.
 */
@Component({
    selector: 'app-di-info-modal',
    standalone: true,
    imports: [CommonModule, DialogModule, ButtonModule],
    templateUrl: './di-info-modal.component.html',
    styleUrls: ['./di-info-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiInfoModalComponent implements OnChanges {
    @Input() di: any = null;
    @Input() visible = false;
    @Input() context: 'coordinator' | 'interventions' = 'interventions';
    // Per-cycle retour snapshots (LogsDi), passed by the host. retour1 = #1, etc.
    @Input() retour1: any = null;
    @Input() retour2: any = null;
    @Input() retour3: any = null;
    @Output() visibleChange = new EventEmitter<boolean>();

    /** Historique d'affectation diagnostic à afficher : uniquement si au moins un
     *  ABANDON a eu lieu (une simple affectation en cours n'est pas un historique). */
    get hasDiagHistory(): boolean {
        return (this.di?.diagAssignments ?? []).some((a: any) => !!a.abandonedAt);
    }

    /** Retour cycles to display, gated by the DI's ignoreCount. */
    get retourEntries(): Array<{ n: number; data: any }> {
        const count = Number(this.di?.ignoreCount ?? 0);
        return [
            { n: 1, data: this.retour1 },
            { n: 2, data: this.retour2 },
            { n: 3, data: this.retour3 },
        ].filter((e) => e.n <= count);
    }

    /** Retour cycles newest-first, decorated for the vertical timeline
     *  (`last` drops the connector line on the final node). */
    get retoursNewestFirst(): Array<{ n: number; data: any; last: boolean }> {
        const list = this.retourEntries.slice().reverse();
        return list.map((e, i) => ({ ...e, last: i === list.length - 1 }));
    }

    /** Coarse workflow status → visual tone for the header pill.
     *  ok = terminée (green) · ko = annulée (red) · info = retour (cyan) ·
     *  warn = every in-progress state (amber, the design default). */
    statusTone(status: any): 'ok' | 'ko' | 'info' | 'warn' {
        const s = (status ?? '').toString().trim();
        if (s === 'FINISHED') return 'ok';
        if (s === 'ANNULER') return 'ko';
        if (s === 'RETOUR1' || s === 'RETOUR2' || s === 'RETOUR3') return 'info';
        return 'warn';
    }

    /** Per-retour document chips (scalar Drive URLs on the LogsDi snapshot).
     *  LogsDi stores only the URL, not the file name — so we recover the REAL
     *  name by matching the URL against the DI's `documents` (which carry
     *  name + webViewLink), exactly like the main Documents section. Falls back
     *  to the generic type label when the file isn't among the current
     *  DI documents (e.g. replaced in a later cycle). */
    retourDocs(data: any): Array<{ label: string; href: string }> {
        const nameByLink = new Map<string, string>();
        const nameByType = new Map<string, string>();
        for (const d of this.di?.documents ?? []) {
            const name = String(d?.name ?? '').trim();
            if (!name) continue;
            const link = String(d?.webViewLink ?? '').trim();
            if (link) nameByLink.set(link, name);
            if (d?.type) nameByType.set(String(d.type), name);
        }
        const out: Array<{ label: string; href: string }> = [];
        const push = (href: any, type: string, typeLabel: string) => {
            const h = String(href ?? '').trim();
            if (!h) return;
            out.push({
                label: nameByLink.get(h) || nameByType.get(type) || typeLabel,
                href: h,
            });
        };
        push(data?.bon_de_commande, 'BC', 'BC');
        push(data?.devis, 'Devis', 'Devis');
        push(data?.bon_de_livraison, 'BL', 'BL');
        push(data?.facture, 'Facture', 'Facture');
        return out;
    }

    /** Set while the PDF is being generated (one-time lazy jsPDF import). */
    downloading = false;

    // ── Décomposition coût Diagnostic / Réparation (lecture seule) ──────────
    // Le modal est majoritairement présentationnel ; ces 3 lectures (temps
    // persistés du ledger Stat + taux Tarif + coût composants) alimentent les
    // blocs « Diagnostic » et « Réparation ». Aucune capture, aucune mutation.
    costLoading = false;
    private _costsForId: string | null = null;
    diagSeconds = 0;
    repSeconds = 0;
    tarif = 0;
    composantCost = 0;

    constructor(
        private readonly diPdf: DiPdfService,
        private readonly apollo: Apollo,
        private readonly ticket: TicketService,
        private readonly cdr: ChangeDetectorRef,
    ) {}

    ngOnChanges(_changes: SimpleChanges): void {
        const id = this.di?._id;
        if (id && this.visible && id !== this._costsForId) {
            this.fetchCosts(id);
        }
    }

    /** HH:MM:SS persisté → secondes (0 si absent/malformé). */
    private hhmmssToSeconds(s: any): number {
        if (typeof s !== 'string') return 0;
        const p = s.split(':').map(Number);
        if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return 0;
        return p[0] * 3600 + p[1] * 60 + p[2];
    }

    /** Charge temps diag/répa (ledger Stat), taux (Tarif), coût composants. */
    private fetchCosts(diId: string): void {
        this._costsForId = diId;
        this.costLoading = true;
        this.diagSeconds = this.repSeconds = 0;
        this.tarif = this.composantCost = 0;

        this.apollo
            .query<any>({ query: this.ticket.getTechTarif() })
            .subscribe(({ data }) => {
                if (this._costsForId !== diId) return;
                this.tarif = Number(data?.getTarif?.tarif) || 0;
                this.cdr.markForCheck();
            });
        this.apollo
            .query<any>({ query: this.ticket.getStatByDI_ID(diId) })
            .subscribe(({ data }) => {
                if (this._costsForId !== diId) return;
                const s = data?.getInfoStatByIdDi;
                this.diagSeconds = this.hhmmssToSeconds(s?.diag_time);
                this.repSeconds = this.hhmmssToSeconds(s?.rep_time);
                this.cdr.markForCheck();
            });
        this.apollo
            .query<any>({ query: this.ticket.totalComposant(diId) })
            .subscribe(({ data }) => {
                if (this._costsForId !== diId) return;
                this.composantCost =
                    Number(data?.calculateTicketComposantPrice) || 0;
                this.costLoading = false;
                this.cdr.markForCheck();
            });
    }

    /** Coût calculé DIAGNOSTIC = main-d'œuvre (temps diag × taux). Composants
     *  rattachés à la RÉPARATION (décision produit) → 0 ici. */
    get coutDiag(): number {
        return (
            Math.round(((this.diagSeconds * this.tarif) / 3600) * 1000) / 1000
        );
    }
    /** Coût calculé RÉPARATION = main-d'œuvre (temps répa × taux) + pièces. */
    get coutRepair(): number {
        const labor = (this.repSeconds * this.tarif) / 3600;
        return Math.round((labor + this.composantCost) * 1000) / 1000;
    }
    /** Prix facturé DIAGNOSTIC = `di.price` (saisi dans « Fixer le prix »). */
    get factureDiag(): number {
        return Number(this.di?.price);
    }
    /** Écart diagnostic (facturé − calculé) — même formule/format que l'écart du
     *  modal de tarification (montant + %, vert marge / rouge sous-facturation). */
    get ecartDiag(): {
        absent: boolean;
        montant: number;
        percent: number;
        tone: 'pos' | 'neg' | 'neutral';
    } {
        return this.computeEcart(this.factureDiag, this.coutDiag);
    }

    /** Logique d'écart partagée (identique au modal « Fixer le prix »). */
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
        const montant = Math.round((facture - cout) * 1000) / 1000;
        const percent = cout > 0 ? (montant / cout) * 100 : 0;
        const tone: 'pos' | 'neg' | 'neutral' =
            Math.abs(montant) < 0.5 && Math.abs(percent) < 1
                ? 'neutral'
                : montant > 0
                  ? 'pos'
                  : 'neg';
        return { absent: false, montant, percent, tone };
    }

    onVisibleChange(v: boolean) {
        this.visible = v;
        this.visibleChange.emit(v);
    }
    close() {
        this.onVisibleChange(false);
    }

    /** Export the DI as a formal A4 PDF dossier (`DI_{N°DI}.pdf`) — reuses the
     *  same client-side jsPDF pipeline as the PV export. */
    async exportPdf(): Promise<void> {
        if (!this.di || this.downloading) return;
        this.downloading = true;
        try {
            await this.diPdf.generateAndDownload(this.di);
        } finally {
            this.downloading = false;
        }
    }

    /** Raw workflow status → French label (mirrors the app's UI labels). */
    statusLabel(status: any): string {
        // Affichage BRUT de la valeur DB en MAJUSCULES.
        return (status ?? '').toString().trim().toUpperCase() || '—';
    }

    /** Document types shown in the Documents section, in display order.
     *  `type` matches the backend DriveDoc key; `scalar` is the legacy mirror
     *  URL used as a fallback when no DriveDoc ref is present. */
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

    /** Renderable document links for the Documents section.
     *  - Link text is the REAL Drive file name (`DriveDocRef.name`); when the
     *    name is absent/empty it falls back to the generic type label.
     *  - `href` uses the DriveDoc `webViewLink`, falling back to the legacy
     *    scalar URL for older records.
     *  - A type with neither a Drive ref nor a scalar URL is omitted entirely
     *    (no DriveDocRef → no link). */
    get docLinks(): Array<{ label: string; href: string }> {
        const byType = new Map<string, any>();
        for (const d of this.di?.documents ?? []) {
            if (d?.type) byType.set(String(d.type), d);
        }
        const out: Array<{ label: string; href: string }> = [];
        for (const t of this.DOC_TYPES) {
            const ref = byType.get(t.type);
            const href = String(ref?.webViewLink || this.di?.[t.scalar] || '').trim();
            if (!href) continue;
            const name = String(ref?.name ?? '').trim();
            out.push({ label: name || t.label, href });
        }
        return out;
    }

    /** True when the DI has at least one uploaded document. */
    get hasAnyDoc(): boolean {
        return this.docLinks.length > 0;
    }

    /** True when a value looks like a raw Mongo ObjectId (24 hex chars).
     *  Such ids must never be shown to a user — we fall back to a placeholder. */
    private isObjectId(value: any): boolean {
        return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value.trim());
    }

    /** Human-readable display for a field that may legitimately hold a name OR,
     *  on legacy records, a raw ObjectId. Returns the first non-empty candidate
     *  that is not an ObjectId, else the '—' placeholder. */
    displayName(...candidates: any[]): string {
        for (const c of candidates) {
            if (c == null) continue;
            const s = String(c).trim();
            if (!s || this.isObjectId(s)) continue;
            return s;
        }
        return '—';
    }

    /** Two letters max, uppercase, derived from a display name. Falls back to
     *  '?' for empty/unknown so the avatar tiles are never blank. */
    initials(text: any): string {
        const s = String(text ?? '').trim();
        if (!s) return '?';
        const words = s.split(/\s+/).filter(Boolean);
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }

    /** TND with 3 decimals, fr-TN locale ("X XXX,XXX TND"). Non-finite → "—". */
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

    /** Print the open modal. The `@media print` block in the SCSS hides
     *  everything except `.di-info-modal` so the printer gets only the modal
     *  content. Body class restored on `afterprint`. */
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
