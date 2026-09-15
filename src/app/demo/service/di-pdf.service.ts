import { Injectable } from '@angular/core';
import {
    fmtDateTime,
    fmtDurationPrecise,
    fmtHhmmss,
} from '../../shared/date-time.util';
import {
    AssignmentSummary,
    buildStatusBar,
    layoutBar,
    LegacyPauseRow,
    StatusFlow,
    StatusFlowStep,
    summarizeFlowByGroup,
    WorkJournal,
} from '../components/ticket/shared/status-timeline.util';

/** Chrono du cycle affiché, calculé par le modal (mêmes fonctions que l'onglet). */
export interface DiPdfChrono {
    diag: WorkJournal;
    rep: WorkJournal;
    pauseSource: { diag: string; rep: string };
    legacyPauses: { diag: LegacyPauseRow[]; rep: LegacyPauseRow[] };
    assignments: AssignmentSummary;
}

/** Couleurs RGB des groupes de statuts (même famille que les jetons du thème,
 *  sans violet). */
const PDF_GROUP_RGB: Record<string, [number, number, number]> = {
    created: [148, 163, 184],
    diagnostic: [37, 99, 235],
    magasin: [8, 145, 178],
    admin: [217, 119, 6],
    repair: [234, 88, 12],
    closed: [22, 163, 74],
    retour: [71, 85, 105],
    cancelled: [220, 38, 38],
    mixed: [100, 116, 139],
    other: [100, 116, 139],
};

/** Données DÉRIVÉES passées par le modal (le PDF n'a pas accès aux requêtes
 *  Stat/Tarif/composant) : parcours par cycle (tout déplié) + finances du cycle affiché. */
export interface DiPdfOptions {
    cycles?: Array<{
        n: number;
        label: string;
        flow: StatusFlow;
        inferredStart?: boolean;
    }>;
    finance?: any[];
    financeCycleLabel?: string;
    /** Chrono du cycle affiché : cumuls enregistrés, journal de travail,
     *  pauses et affectations. */
    times?: {
        cycleLabel?: string;
        diagCumul?: string | null;
        repCumul?: string | null;
        chrono?: DiPdfChrono | null;
        cycleStats?: any[];
    };
    /** Éléments rattachés (PV, alertes, rappels de stagnation). */
    links?: { pvs?: any[]; alerts?: any[]; stagnations?: any[] };
    /** Composants DU CYCLE AFFICHÉ, déjà joints au catalogue par le modal.
     *  Absent → repli sur `di.array_composants` (nom + qté), comme avant. */
    composants?: {
        cycleLabel?: string;
        total?: number;
        partial?: boolean;
        priced?: number;
        rows?: Array<{
            name: string;
            quantity: number;
            status: string;
            prixVente: number | null;
            lineTotal: number | null;
            comingDate: string;
        }>;
    };
}

/**
 * Demande d'Intervention — printable A4 PDF dossier.
 *
 * Reuses the SAME client-side pipeline as the PV export
 * (`ReunionPvPdfService`): jsPDF + jspdf-autotable, **dynamically imported** so
 * the main bundle only grows when a user actually exports a DI. NO new
 * dependency, NO Playwright/Chromium — identical infra to the existing export.
 *
 * Layout: branded header band (Fixtronix + N° DI + title), key/value section
 * tables (Identification, Client, Techniciens, Coûts, État, Documents),
 * Description, Composants table, Remarques, retour history, then a footer on
 * every page (generation date in Africa/Tunis + page counter). Colors mirror
 * the design system (blue #2563eb / #3b82f6, slate text). No purple.
 */
@Injectable({ providedIn: 'root' })
export class DiPdfService {
    private readonly COLORS = {
        primary: [37, 99, 235] as [number, number, number],
        primaryLight: [59, 130, 246] as [number, number, number],
        text: [15, 23, 42] as [number, number, number],
        muted: [100, 116, 139] as [number, number, number],
        border: [226, 232, 240] as [number, number, number],
        zebra: [248, 250, 252] as [number, number, number],
    };

    /** Build + download `DI_{_idnum}.pdf`. */
    async generateAndDownload(
        di: any,
        opts: DiPdfOptions = {},
    ): Promise<void> {
        const doc = await this.buildDoc(di, opts);
        const idnum = this.raw(di?._idnum) || 'DI';
        doc.save(`DI_${idnum}.pdf`);
    }

    /**
     * Build the jsPDF document (returned so callers/tests can inspect the
     * output, e.g. assert it starts with "%PDF"). Does NOT trigger a download.
     */
    async buildDoc(di: any, opts: DiPdfOptions = {}): Promise<any> {
        const [jspdfMod, autoTableMod] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable'),
        ]);
        const JsPDF = (jspdfMod as any).default || (jspdfMod as any).jsPDF;
        const autoTable: any =
            (autoTableMod as any).default || (autoTableMod as any);

        const doc = new JsPDF('p', 'pt', 'a4');
        const PAGE_W = doc.internal.pageSize.getWidth();
        const MARGIN_X = 42;
        const CONTENT_W = PAGE_W - MARGIN_X * 2;
        const C = this.COLORS;

        // ── Header band ────────────────────────────────────────────────
        doc.setFillColor(...C.primary);
        doc.rect(0, 0, PAGE_W, 78, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('FIXTRONIX', MARGIN_X, 32);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text("Dossier de demande d'intervention", MARGIN_X, 48);

        const idnum = this.raw(di?._idnum) || '—';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(`N° ${idnum}`, PAGE_W - MARGIN_X, 32, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(
            this.clip(this.raw(di?.title) || '—', 48),
            PAGE_W - MARGIN_X,
            48,
            { align: 'right' },
        );

        let y = 104;

        const kv = (title: string, rows: Array<[string, string]>) => {
            y = this.sectionTitle(doc, title, MARGIN_X, y, C);
            autoTable(doc, {
                startY: y,
                margin: { left: MARGIN_X, right: MARGIN_X },
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 4, textColor: C.text },
                columnStyles: {
                    0: { cellWidth: 150, textColor: C.muted, fontStyle: 'bold' },
                    1: { cellWidth: CONTENT_W - 150 },
                },
                body: rows.map(([k, v]) => [k, v || '—']),
            });
            y = (doc as any).lastAutoTable.finalY + 14;
        };

        // ── Identification ─────────────────────────────────────────────
        kv('Identification', [
            ['N° DI', idnum],
            ['Titre', this.raw(di?.title) || '—'],
            ['Statut', this.statusLabel(di?.status)],
            ['N° de série', this.raw(di?.nSerie) || '—'],
            ['Réparable', this.yesNo(di?.can_be_repaired)],
            ['PDR', di?.contain_pdr ? 'Oui' : 'Non'],
            ['Emplacement', this.name(di, ['location_name', 'locationName', 'location_id'])],
            ['Catégorie', this.name(di, ['di_category_name', 'di_category_id'])],
            ['Date de création', this.fmt(di?.createdAt)],
            ['Date de réception', this.fmt(di?.dateReception)],
            ['Erreur Fixtronix', this.yesNo(di?.isErrorFromFixtronix)],
        ]);

        // ── Client / Société ───────────────────────────────────────────
        kv('Client / Société', [
            [
                'Client / Société',
                this.name(di, [
                    'clientName',
                    'companyName',
                    'client_name',
                    'company_name',
                    'client_id',
                    'company_id',
                ]),
            ],
            ['Créé par', this.name(di, ['createdBy'])],
            ['Téléphone', this.raw(di?.contact?.phone) || '—'],
            ['Email', this.raw(di?.contact?.email) || '—'],
            ['Adresse', this.raw(di?.contact?.address) || '—'],
            ['Région', this.raw(di?.contact?.region) || '—'],
        ]);

        // ── Techniciens ────────────────────────────────────────────────
        kv('Techniciens', [
            ['Tech. diagnostic', this.name(di, ['techDiag'])],
            ['Tech. réparation', this.name(di, ['techRep'])],
        ]);

        // Note en petit italique, sur toute la largeur (texte rendu compatible
        // Helvetica WinAnsi).
        const note = (text: string, italic = true) => {
            doc.setFont('helvetica', italic ? 'italic' : 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(...C.muted);
            const lines = doc.splitTextToSize(this.pdfSafe(text), CONTENT_W);
            y = this.ensureSpace(doc, y, lines.length * 9 + 8);
            doc.text(lines, MARGIN_X, y + 2);
            y = y + 2 + lines.length * 9 + 6;
            doc.setFont('helvetica', 'normal');
        };
        const gridStyles = {
            styles: {
                fontSize: 7.5,
                cellPadding: 3.5,
                textColor: C.text,
                lineColor: C.border,
                lineWidth: 0.5,
            },
            headStyles: {
                fillColor: C.primaryLight,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
            },
        };

        // ── Parcours des statuts — TOUS les cycles, TOUT déplié ────────
        const cycles: any[] = Array.isArray(opts.cycles) ? opts.cycles : [];
        for (const cy of cycles) {
            const flow: StatusFlow | undefined = cy?.flow;
            const steps: StatusFlowStep[] = flow?.steps ?? [];
            if (!flow || !steps.length) continue;
            y = this.ensureSpace(doc, y, 90);
            y = this.sectionTitle(
                doc,
                `Parcours des statuts — ${this.raw(cy?.label) || 'Cycle'}`,
                MARGIN_X,
                y,
                C,
            );
            y = this.drawFlowBar(doc, flow, MARGIN_X, y, CONTENT_W);
            const groups = summarizeFlowByGroup(flow)
                .map(
                    (g) =>
                        `${g.label} ${fmtDurationPrecise(g.ms)} (${g.pct
                            .toFixed(1)
                            .replace('.', ',')} %)`,
                )
                .join(' · ');
            note(
                `Du ${this.fmtS(flow.startAt)} au ${
                    flow.ongoing ? 'maintenant' : this.fmtS(flow.endAt)
                } · amplitude ${fmtDurationPrecise(flow.spanMs)}. ${groups}. Teinte claire = pause.` +
                    (cy?.inferredStart
                        ? " Cycle déduit de l'ouverture du retour (aucune entrée RETOUR dans l'historique)."
                        : ''),
            );
            autoTable(doc, {
                startY: y,
                margin: { left: MARGIN_X, right: MARGIN_X },
                head: [['#', 'Statut', 'Entrée', "Écart jusqu'à l'étape suivante"]],
                body: steps.map((s) => [
                    String(s.index + 1),
                    `${s.label}${s.label !== s.status ? ` (${s.status})` : ''}${
                        s.dupCount > 1 ? ` x${s.dupCount}` : ''
                    }${s.reconstructed ? ' — reconstruit' : ''}`,
                    this.fmtS(s.enteredAt),
                    this.gapLabel(s),
                ]),
                ...gridStyles,
                alternateRowStyles: { fillColor: C.zebra },
                columnStyles: {
                    0: { cellWidth: 24, halign: 'right' },
                    2: { cellWidth: 100 },
                    3: { cellWidth: 150 },
                },
                // Écart anormal (> 48 h) en rouge.
                didParseCell: (data: any) => {
                    if (
                        data.section === 'body' &&
                        data.column.index === 3 &&
                        steps[data.row.index]?.long
                    ) {
                        data.cell.styles.textColor = [220, 38, 38];
                        data.cell.styles.fontStyle = 'bold';
                    }
                },
            });
            y = (doc as any).lastAutoTable.finalY + 14;
        }

        // ── Finances (écart = facturé − (coût réel + composants)) ──────
        const finance: any[] = Array.isArray(opts.finance) ? opts.finance : [];
        if (finance.length) {
            const cyLabel = opts.financeCycleLabel
                ? ` — ${opts.financeCycleLabel}`
                : '';
            y = this.sectionTitle(doc, `Finances${cyLabel}`, MARGIN_X, y, C);
            autoTable(doc, {
                startY: y,
                margin: { left: MARGIN_X, right: MARGIN_X },
                head: [['Phase', 'Coût réel', 'Composants', 'Facturé', 'Écart']],
                body: finance.map((f) => {
                    const sign = f?.ecart?.montant >= 0 ? '+' : '';
                    return [
                        this.raw(f?.phase) || '—',
                        f?.coutReel == null ? '—' : this.cur(f.coutReel),
                        f?.composants == null ? '—' : this.cur(f.composants),
                        f?.nonPayant
                            ? 'Non facturé'
                            : f?.facture == null
                              ? '—'
                              : this.cur(f.facture),
                        f?.nonPayant
                            ? 'Non facturé'
                            : f?.ecart && !f.ecart.absent
                              ? `${sign}${this.cur(f.ecart.montant)}${
                                    f.ecart.percent == null
                                        ? ''
                                        : ` (${sign}${Number(
                                              f.ecart.percent,
                                          ).toFixed(1)} %)`
                                }`
                              : '—',
                    ];
                }),
                styles: {
                    fontSize: 9,
                    cellPadding: 5,
                    textColor: C.text,
                    lineColor: C.border,
                    lineWidth: 0.5,
                },
                headStyles: {
                    fillColor: C.primaryLight,
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                },
                columnStyles: {
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                    4: { halign: 'right' },
                },
            });
            y = (doc as any).lastAutoTable.finalY + 6;
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(...C.muted);
            // Helvetica standard (WinAnsi) : ni « Σ » ni « − » → texte ASCII.
            const note = doc.splitTextToSize(
                'Coût réel = temps × taux horaire (calcul ERP). Composants = ' +
                    'somme des prix de vente × quantité. Facturé = montants ' +
                    'saisis (prix diagnostic, estimation réparation). ' +
                    'Écart = Facturé - (Coût réel + Composants).',
                CONTENT_W,
            );
            doc.text(note, MARGIN_X, y + 4);
            y = y + 4 + note.length * 10 + 12;
            doc.setFont('helvetica', 'normal');
        } else {
            // Repli (ex. tests) : coûts plats.
            kv('Coûts', [
                ['Prix initial', di?.price == null ? '—' : this.cur(di.price)],
                [
                    'Prix final',
                    di?.final_price == null ? '—' : this.cur(di.final_price),
                ],
            ]);
        }

        // ── Description ────────────────────────────────────────────────
        y = this.sectionTitle(doc, 'Description', MARGIN_X, y, C);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...C.text);
        const desc = doc.splitTextToSize(
            this.raw(di?.description) || '—',
            CONTENT_W,
        );
        doc.text(desc, MARGIN_X, y + 4);
        y = y + 4 + desc.length * 11 + 12;

        // ── Composants ─────────────────────────────────────────────────
        // Lignes ENRICHIES fournies par le modal (déjà jointes au catalogue et
        // scopées au cycle affiché) ; à défaut, repli sur la racine `di`.
        const enriched = opts.composants?.rows;
        if (enriched) {
            const cyLabel = opts.composants?.cycleLabel
                ? ` — ${opts.composants.cycleLabel}`
                : '';
            y = this.sectionTitle(
                doc,
                `Composants (${enriched.length})${cyLabel}`,
                MARGIN_X,
                y,
                C,
            );
            autoTable(doc, {
                startY: y,
                margin: { left: MARGIN_X, right: MARGIN_X },
                head: [['Composant', 'Qté', 'Statut', 'PU vente', 'Total', 'Arrivage']],
                body: enriched.length
                    ? enriched.map((r) => [
                          this.raw(r.name) || '—',
                          String(r.quantity ?? 0),
                          this.raw(r.status) || '—',
                          r.prixVente == null ? '—' : this.cur(r.prixVente),
                          r.lineTotal == null ? '—' : this.cur(r.lineTotal),
                          this.raw(r.comingDate) || '—',
                      ])
                    : [['Aucun composant', '', '', '', '', '']],
                foot: enriched.length
                    ? [['Total', '', '', '', this.cur(opts.composants?.total ?? 0), '']]
                    : undefined,
                styles: { fontSize: 8.5, cellPadding: 4, textColor: C.text, lineColor: C.border, lineWidth: 0.5 },
                headStyles: { fillColor: C.primaryLight, textColor: [255, 255, 255], fontStyle: 'bold' },
                footStyles: { fillColor: C.zebra, textColor: C.text, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: C.zebra },
                columnStyles: {
                    1: { halign: 'right', cellWidth: 34 },
                    2: { cellWidth: 70 },
                    3: { halign: 'right', cellWidth: 72 },
                    4: { halign: 'right', cellWidth: 72 },
                    5: { halign: 'right', cellWidth: 62 },
                },
            });
            y = (doc as any).lastAutoTable.finalY + 14;
            // Total partiel : le dire, plutôt que laisser croire à un total complet.
            if (opts.composants?.partial) {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8);
                doc.setTextColor(...C.muted);
                doc.text(
                    `Total calculé sur ${opts.composants?.priced ?? 0} ligne(s) sur ${enriched.length} — les autres n'ont pas de prix de vente au catalogue.`,
                    MARGIN_X,
                    y,
                );
                doc.setFont('helvetica', 'normal');
                y += 14;
            }
        } else {
            const comps: any[] = Array.isArray(di?.array_composants)
                ? di.array_composants
                : [];
            y = this.sectionTitle(
                doc,
                `Composants (${comps.length})`,
                MARGIN_X,
                y,
                C,
            );
            autoTable(doc, {
                startY: y,
                margin: { left: MARGIN_X, right: MARGIN_X },
                head: [['Composant', 'Qté']],
                body: comps.length
                    ? comps.map((c) => [this.raw(c?.nameComposant) || '—', String(c?.quantity ?? 0)])
                    : [['Aucun composant', '']],
                styles: { fontSize: 9, cellPadding: 5, textColor: C.text, lineColor: C.border, lineWidth: 0.5 },
                headStyles: { fillColor: C.primaryLight, textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: C.zebra },
                columnStyles: { 1: { halign: 'right', cellWidth: 70 } },
            });
            y = (doc as any).lastAutoTable.finalY + 14;
        }

        // ── Remarques ──────────────────────────────────────────────────
        kv('Remarques', [
            ['Administration', this.raw(di?.remarque_manager) || this.raw(di?.remarque_admin_manager) || 'Aucune remarque'],
            ['Tech. diagnostique', this.raw(di?.remarque_tech_diagnostic) || 'Aucune remarque'],
            ['Tech. réparation', this.raw(di?.remarque_tech_repair) || 'Aucune remarque'],
        ]);

        // ── Documents ──────────────────────────────────────────────────
        kv('Documents', [
            ['Bon de commande', di?.bon_de_commande ? 'Présent' : '—'],
            ['Devis', di?.devis ? 'Présent' : '—'],
            ['Bon de livraison', di?.bon_de_livraison ? 'Présent' : '—'],
            ['Facture', di?.facture ? 'Présent' : '—'],
        ]);

        // ── Autres remarques (4 des 7 n'apparaissaient nulle part) ─────
        const extra: Array<[string, string]> = [
            ['Admin manager', this.raw(di?.remarque_admin_manager)],
            ['Admin technique', this.raw(di?.remarque_admin_tech)],
            ['Magasin', this.raw(di?.remarque_magasin)],
            ['Coordination', this.raw(di?.remarque_coordinator)],
            ['Commentaire', this.raw(di?.comment)],
        ].filter(([, v]) => !!v) as Array<[string, string]>;
        if (extra.length) kv('Autres remarques', extra);

        // ── Jalons datés + acteur ──────────────────────────────────────
        const milestones: Array<[string, string]> = [];
        // Acteur inconnu → date seule (jamais « · — »).
        const dated = (at: any, key: string) => {
            const who = this.name(di, [key]);
            return who === '—' || who.toLowerCase() === 'unknown'
                ? this.fmt(at)
                : `${this.fmt(at)} · par ${who}`;
        };
        if (di?.pricingRequestSentAt) {
            milestones.push([
                'Demande de tarification',
                dated(di.pricingRequestSentAt, 'pricingRequestSentBy'),
            ]);
        }
        if (di?.componentsConfirmedAt) {
            milestones.push([
                'Composants confirmés',
                dated(di.componentsConfirmedAt, 'componentsConfirmedBy'),
            ]);
        }
        if (di?.retourDate || di?.retourReason) {
            milestones.push([
                'Dernier retour',
                `${this.fmt(di?.retourDate)}${di?.retourReason ? ' · ' + this.raw(di.retourReason) : ''}`,
            ]);
        }
        if (milestones.length) kv('Jalons', milestones);

        // ── Temps & chrono — pièce justificative du temps facturé ──────
        const t = opts.times;
        if (t) {
            const cyLabel = t.cycleLabel ? ` — ${t.cycleLabel}` : '';
            kv(`Cumuls enregistrés${cyLabel}`, [
                ['Diagnostic', this.cumul(t.diagCumul)],
                ['Réparation', this.cumul(t.repCumul)],
            ]);

            const ch = t.chrono;
            const journal = (
                j: WorkJournal | undefined,
                title: string,
                phase: string,
                source: string | undefined,
                legacy: LegacyPauseRow[] | undefined,
            ) => {
                const legacyRows = source === 'legacy' ? legacy ?? [] : [];
                if (!j || (!j.hasData && !legacyRows.length)) return;
                y = this.ensureSpace(doc, y, 90);
                y = this.sectionTitle(doc, `${title}${cyLabel}`, MARGIN_X, y, C);
                note(
                    `Début : instant, horodaté par le serveur, où le chrono du technicien s'ouvre (Démarrage, ou Reprise après une pause). ` +
                        `Fin : instant où le serveur ferme le segment (Mise en pause — bouton Pause ou fermeture de l'onglet du technicien —, fin ${phase}, abandon, ou tout autre changement de statut qui quitte la phase). ` +
                        `Pause : de l'entrée en pause jusqu'au statut suivant, d'après l'historique des statuts (même horloge serveur).`,
                );
                if (j.rows.length) {
                    autoTable(doc, {
                        startY: y,
                        margin: { left: MARGIN_X, right: MARGIN_X },
                        head: [['Type', 'Début', 'Fin', 'Durée']],
                        body: j.rows.map((r) => [
                            this.rowKind(r.kind),
                            `${this.fmtS(r.start)}\n${this.pdfSafe(r.startCause)}`,
                            `${r.end ? this.fmtS(r.end) : r.ongoing ? 'en cours' : '—'}${
                                r.endCause ? `\n${this.pdfSafe(r.endCause)}` : ''
                            }`,
                            `${
                                r.kind === 'pause'
                                    ? fmtDurationPrecise(r.ms)
                                    : fmtDurationPrecise(r.ms, { days: false })
                            }${r.long ? '\n> 12 h, anormalement long' : ''}${
                                r.kind === 'untracked' ? '\nnon vérifiable' : ''
                            }`,
                        ]),
                        ...gridStyles,
                        columnStyles: { 0: { cellWidth: 70 }, 3: { cellWidth: 95 } },
                        didParseCell: (data: any) => {
                            if (data.section !== 'body') return;
                            const r = j.rows[data.row.index];
                            if (r?.kind === 'pause') data.cell.styles.fillColor = C.zebra;
                            if (r?.kind === 'untracked') data.cell.styles.textColor = C.muted;
                            if (r?.long && data.column.index === 3) {
                                data.cell.styles.textColor = [220, 38, 38];
                                data.cell.styles.fontStyle = 'bold';
                            }
                        },
                    });
                    y = (doc as any).lastAutoTable.finalY + 6;
                }
                const work = (ms: number | null) => fmtDurationPrecise(ms, { days: false });
                const parts = [
                    `Travail (somme des segments clos) ${work(j.workMs)} sur ${j.workCount} segment(s)`,
                ];
                if (j.runningMs !== null) parts.push(`segment en cours ${work(j.runningMs)}`);
                if (j.pauseCount) {
                    parts.push(`pauses ${fmtDurationPrecise(j.pauseMs)} (${j.pauseCount})`);
                }
                if (j.untrackedCount) {
                    parts.push(`sans segment serveur ${work(j.untrackedMs)} (${j.untrackedCount})`);
                }
                parts.push(`cumul enregistré ${work(j.storedMs)}`);
                if (j.deltaMs) {
                    parts.push(
                        `écart ${work(Math.abs(j.deltaMs))}${
                            j.matchesStored ? ' (arrondi serveur à la seconde)' : ''
                        }`,
                    );
                }
                note(`${parts.join(' · ')}.`, false);
                if (j.longCount) {
                    note(
                        `${j.longCount} segment(s) de plus de 12 h : durée anormalement longue (session probablement restée ouverte). ` +
                            `Depuis la règle serveur de fin août 2026, un tel segment n'est plus ajouté au cumul ; avant, il l'était.`,
                    );
                }
                if (legacyRows.length) {
                    note(
                        "Aucune pause dans l'historique serveur pour ce cycle : pauses reprises du journal du navigateur — approximatif (horloge du poste, fins parfois rattachées à la mauvaise pause).",
                    );
                    autoTable(doc, {
                        startY: y,
                        margin: { left: MARGIN_X, right: MARGIN_X },
                        head: [['Pause — début', 'Fin', 'Durée']],
                        body: legacyRows.map((p) => [
                            this.fmtS(p.start),
                            this.legacyEnd(p),
                            fmtDurationPrecise(p.ms),
                        ]),
                        ...gridStyles,
                        alternateRowStyles: { fillColor: C.zebra },
                    });
                    y = (doc as any).lastAutoTable.finalY + 6;
                }
                y += 8;
            };
            if (ch) {
                journal(ch.diag, 'Chrono diagnostic', 'du diagnostic', ch.pauseSource?.diag, ch.legacyPauses?.diag);
                journal(ch.rep, 'Chrono réparation', 'de la réparation', ch.pauseSource?.rep, ch.legacyPauses?.rep);
            }

            const asg = ch?.assignments;
            if (asg?.rows?.length) {
                const work = (ms: number | null) => fmtDurationPrecise(ms, { days: false });
                y = this.ensureSpace(doc, y, 90);
                y = this.sectionTitle(doc, `Affectations diagnostic${cyLabel}`, MARGIN_X, y, C);
                note(
                    "Déjà cumulé à l'affectation : temps de diagnostic déjà enregistré sur ce cycle quand le technicien a été affecté (travail des techniciens précédents). " +
                        "Temps travaillé : ce que ce technicien a ajouté au cumul — figé par le serveur à l'abandon, calculé (cumul actuel - déjà cumulé) pour le dernier affecté.",
                );
                autoTable(doc, {
                    startY: y,
                    margin: { left: MARGIN_X, right: MARGIN_X },
                    head: [['Technicien', 'Affecté le', "Fin d'affectation", "Déjà cumulé à l'affectation", 'Temps travaillé']],
                    body: asg.rows.map((a) => [
                        this.raw(a.tech) || '—',
                        this.fmtS(a.assignedAt),
                        a.abandonedAt
                            ? `Abandon le ${this.fmtS(a.abandonedAt)}${a.motif ? `\nmotif : ${a.motif}` : ''}${
                                  a.abandonedBy ? `\npar ${a.abandonedBy}` : ''
                              }`
                            : 'Aucun abandon',
                        work(a.alreadyMs),
                        `${work(a.workedMs)}${a.running ? '\nchrono en cours' : ''}${
                            a.anomaly ? '\nà vérifier' : ''
                        }`,
                    ]),
                    foot:
                        asg.totalWorkedMs !== null
                            ? [['Somme', '', '', `cumul ${work(asg.storedMs)}`, work(asg.totalWorkedMs)]]
                            : undefined,
                    ...gridStyles,
                    footStyles: { fillColor: C.zebra, textColor: C.text, fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: C.zebra },
                });
                y = (doc as any).lastAutoTable.finalY + 14;
            }

            const cs: any[] = t.cycleStats ?? [];
            if (cs.length) {
                y = this.sectionTitle(doc, 'Temps par cycle', MARGIN_X, y, C);
                autoTable(doc, {
                    startY: y,
                    margin: { left: MARGIN_X, right: MARGIN_X },
                    head: [['Cycle', 'Diagnostic', 'Réparation', 'Tech. diag', 'Tech. répa']],
                    body: cs.map((c) => [
                        c?.ignoreCount ? `Retour ${c.ignoreCount}` : 'Flux original',
                        this.cumul(c?.diag_time),
                        this.cumul(c?.rep_time),
                        this.raw(c?.techDiag) || '—',
                        this.raw(c?.techRep) || '—',
                    ]),
                    styles: { fontSize: 8, cellPadding: 4, textColor: C.text, lineColor: C.border, lineWidth: 0.5 },
                    headStyles: { fillColor: C.primaryLight, textColor: [255, 255, 255], fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: C.zebra },
                });
                y = (doc as any).lastAutoTable.finalY + 14;
            }
        }

        // ── Éléments rattachés ─────────────────────────────────────────
        const L = opts.links;
        if (L?.pvs?.length) {
            y = this.sectionTitle(doc, `PV de réunion (${L.pvs.length})`, MARGIN_X, y, C);
            autoTable(doc, {
                startY: y,
                margin: { left: MARGIN_X, right: MARGIN_X },
                head: [['Référence', 'Titre', 'Date', 'Statut']],
                body: L.pvs.map((pv: any) => [
                    this.raw(pv?.reference) || '—',
                    this.raw(pv?.titre) || '—',
                    this.fmt(pv?.dateReunion),
                    this.raw(pv?.statut) || '—',
                ]),
                styles: { fontSize: 8, cellPadding: 4, textColor: C.text, lineColor: C.border, lineWidth: 0.5 },
                headStyles: { fillColor: C.primaryLight, textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: C.zebra },
            });
            y = (doc as any).lastAutoTable.finalY + 14;
        }
        if (L?.alerts?.length) {
            y = this.sectionTitle(doc, `Alertes (${L.alerts.length})`, MARGIN_X, y, C);
            autoTable(doc, {
                startY: y,
                margin: { left: MARGIN_X, right: MARGIN_X },
                head: [['Type', 'Sévérité', 'Créée le', 'Résolue']],
                body: L.alerts.map((a: any) => [
                    this.raw(a?.type) || '—',
                    this.raw(a?.severity) || '—',
                    this.fmt(a?.createdAt),
                    a?.resolvedAt ? this.fmt(a.resolvedAt) : 'ouverte',
                ]),
                styles: { fontSize: 8, cellPadding: 4, textColor: C.text, lineColor: C.border, lineWidth: 0.5 },
                headStyles: { fillColor: C.primaryLight, textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: C.zebra },
            });
            y = (doc as any).lastAutoTable.finalY + 14;
        }

        // ── Footer on every page ───────────────────────────────────────
        this.addFooter(doc, MARGIN_X);

        return doc;
    }

    /** Date FR courte (Luxon, heure de Tunis) — « — » si absente/invalide. */
    private fmt(v: any): string {
        return fmtDateTime(v);
    }

    /** Date à la seconde (heure de Tunis). */
    private fmtS(v: any): string {
        return fmtDateTime(v, { seconds: true });
    }

    /** Cumul « HH:MM:SS » → libellé exact ; valeur brute si illisible. */
    private cumul(v: any): string {
        return fmtHhmmss(v, { fallback: this.raw(v) || '—' });
    }

    /** Écart d'une étape du parcours, selon ce qui la termine. */
    private gapLabel(s: StatusFlowStep): string {
        const d = fmtDurationPrecise(s.ms);
        switch (s.endKind) {
            case 'next':
                return d;
            case 'boundary':
                return `${d} (jusqu'au cycle suivant)`;
            case 'ongoing':
                return `en cours · ${d}`;
            case 'terminal':
                return 'statut final';
            default:
                return 'inconnu';
        }
    }

    private rowKind(kind: string): string {
        return (
            ({
                work: 'Travail',
                running: 'Travail en cours',
                pause: 'Pause',
                untracked: 'Sans segment',
            } as Record<string, string>)[kind] ?? kind
        );
    }

    private legacyEnd(p: LegacyPauseRow): string {
        if (p.state === 'closed') return this.fmtS(p.end);
        if (p.state === 'ongoing') return 'en cours';
        if (p.state === 'inconsistent') return 'incohérente (fin avant début)';
        return 'fin non enregistrée';
    }

    /** Helvetica standard (WinAnsi) n'a ni flèches ni « Σ » ni « − ». */
    private pdfSafe(s: string): string {
        return String(s ?? '')
            .replace(/→/g, '>')
            .replace(/↓\s?/g, '')
            .replace(/Σ/g, 'Somme')
            .replace(/−/g, '-')
            .replace(/≥/g, '>=');
    }

    /** Saut de page si le bloc à venir ne tient plus (marges haute/basse). */
    private ensureSpace(doc: any, y: number, needed: number): number {
        const pageH = doc.internal.pageSize.getHeight();
        if (y + needed > pageH - 50) {
            doc.addPage();
            return 50;
        }
        return y;
    }

    /** Barre « répartition du temps par statut » : largeurs proportionnelles,
     *  largeur minimale garantie, pauses en teinte claire. */
    private drawFlowBar(doc: any, flow: StatusFlow, x: number, y: number, w: number): number {
        const blocks = buildStatusBar(flow);
        if (!blocks.length) return y;
        const H = 10;
        const widths = layoutBar(blocks.map((b) => b.ms), w, 1.5);
        let cx = x;
        blocks.forEach((b, i) => {
            const bw = widths[i];
            const rgb = PDF_GROUP_RGB[b.group] ?? PDF_GROUP_RGB['other'];
            const fill = b.isPause
                ? (rgb.map((c) => Math.round(c + (255 - c) * 0.55)) as [number, number, number])
                : rgb;
            doc.setFillColor(...fill);
            doc.rect(cx, y, bw, H, 'F');
            if (b.kind === 'cluster') {
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.4);
                doc.line(cx, y + H / 2, cx + bw, y + H / 2);
            }
            cx += bw;
        });
        doc.setDrawColor(...this.COLORS.border);
        doc.setLineWidth(0.5);
        doc.rect(x, y, w, H, 'S');
        return y + H + 6;
    }

    // ── helpers ────────────────────────────────────────────────────────

    private sectionTitle(
        doc: any,
        label: string,
        x: number,
        y: number,
        C: DiPdfService['COLORS'],
    ): number {
        doc.setFillColor(...C.primaryLight);
        doc.rect(x, y, 3, 12, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(...C.primary);
        doc.text(label.toUpperCase(), x + 9, y + 10);
        return y + 20;
    }

    private addFooter(doc: any, marginX: number): void {
        const pageCount = doc.getNumberOfPages();
        const PAGE_W = doc.internal.pageSize.getWidth();
        const PAGE_H = doc.internal.pageSize.getHeight();
        const when = fmtDateTime(new Date());
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(...this.COLORS.border);
            doc.line(marginX, PAGE_H - 34, PAGE_W - marginX, PAGE_H - 34);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...this.COLORS.muted);
            doc.text(`Fixtronix · Généré le ${when} (Africa/Tunis)`, marginX, PAGE_H - 20);
            doc.text(`Page ${i} / ${pageCount}`, PAGE_W - marginX, PAGE_H - 20, {
                align: 'right',
            });
        }
    }

    private raw(v: any): string {
        if (v == null) return '';
        return String(v).trim();
    }

    private isObjectId(v: any): boolean {
        return typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v.trim());
    }

    /** First non-empty, non-ObjectId candidate from the di object, else "—". */
    private name(di: any, keys: string[]): string {
        for (const k of keys) {
            const s = this.raw(di?.[k]);
            if (s && !this.isObjectId(s)) return s;
        }
        return '—';
    }

    private cur(value: any): string {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return (
            n.toLocaleString('fr-TN', {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
            }) + ' TND'
        );
    }

    private yesNo(v: any): string {
        if (v === true) return 'Oui';
        if (v === false) return 'Non';
        return '—';
    }

    private clip(s: string, max: number): string {
        return s.length > max ? s.slice(0, max - 1) + '…' : s;
    }

    /** Raw workflow status, in capitals (same as the DI list tags) — not a French label. */
    private statusLabel(status: any): string {
        // Affichage BRUT en MAJUSCULES. PRICING_DIAG et son ancienne valeur
        // PRICING sont ramenés au MÊME libellé « PRICING » : les deux valeurs
        // coexistent en base (renommage forward-only, sans backfill) et la
        // colonne « Statut » afficherait sinon deux libellés pour un même état.
        const s = (status ?? '').toString().trim();
        if (s === 'PRICING_DIAG' || s === 'PRICING') return 'PRICING';
        return s.toUpperCase() || '—';
    }
}
