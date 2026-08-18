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
import {
    buildCycleTimeline,
    sliceHistoryByCycle,
    formatTimelineDate,
    formatDuration,
    TimelineRow,
} from '../status-timeline.util';

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
    imports: [CommonModule, DialogModule, ButtonModule],
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

    constructor(
        private readonly diPdf: DiPdfService,
        private readonly apollo: Apollo,
        private readonly ticket: TicketService,
        private readonly cdr: ChangeDetectorRef,
    ) {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['di']) {
            // Nouvelle DI → ouvrir sur le cycle COURANT (le plus récent), replier
            // la timeline, réinitialiser le sélecteur.
            this.selectedCycle = this.cycleCount;
            this.timelineExpanded = false;
        }
        const id = this.di?._id;
        if (id && this.visible) this.fetchCosts();
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
        if (s === 'ANNULER') return 'ko';
        if (s === 'RETOUR1' || s === 'RETOUR2' || s === 'RETOUR3') return 'info';
        return 'warn';
    }

    /** Statut brut en MAJUSCULES (décision d'affichage en vigueur). */
    statusLabel(status: any): string {
        return (status ?? '').toString().trim().toUpperCase() || '—';
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
            await this.diPdf.generateAndDownload(this.di, {
                cycles: this.buildPdfCycles(),
                finance: this.financeRows,
                financeCycleLabel:
                    this.selectedCycle === 0
                        ? 'Flux original'
                        : `Retour ${this.selectedCycle}`,
            });
        } finally {
            this.downloading = false;
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
