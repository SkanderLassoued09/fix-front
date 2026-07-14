import { Injectable } from '@angular/core';

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
        profilesById: Map<string, string> = new Map(),
    ): Promise<void> {
        const doc = await this.buildDoc(di, profilesById);
        const idnum = this.raw(di?._idnum) || 'DI';
        doc.save(`DI_${idnum}.pdf`);
    }

    /**
     * Build the jsPDF document (returned so callers/tests can inspect the
     * output, e.g. assert it starts with "%PDF"). Does NOT trigger a download.
     */
    async buildDoc(
        di: any,
        profilesById: Map<string, string> = new Map(),
    ): Promise<any> {
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
            ['Date de création', this.raw(di?.createdAt) || '—'],
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
        ]);

        // ── Techniciens ────────────────────────────────────────────────
        kv('Techniciens', [
            ['Tech. diagnostic', this.name(di, ['techDiag'])],
            ['Tech. réparation', this.name(di, ['techRep'])],
        ]);

        // ── Coûts ──────────────────────────────────────────────────────
        kv('Coûts', [
            ['Prix initial', di?.price == null ? '—' : this.cur(di.price)],
            ['Prix final', di?.final_price == null ? '—' : this.cur(di.final_price)],
        ]);

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

        // ── Footer on every page ───────────────────────────────────────
        this.addFooter(doc, MARGIN_X);

        return doc;
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
        const when = new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Africa/Tunis',
            dateStyle: 'short',
            timeStyle: 'short',
        }).format(new Date());
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

    /** Raw workflow status → French label (mirrors the app's UI labels). */
    private statusLabel(status: any): string {
        const map: Record<string, string> = {
            CREATED: 'Créée',
            PENDING1: 'En attente diagnostic',
            DIAGNOSTIC: 'Diagnostic affecté',
            DIAGNOSTIC_Pause: 'Diagnostic en pause',
            INDIAGNOSTIC: 'En diagnostic',
            MagasinEstimation: 'Estimation magasin',
            INMAGASIN: 'En magasin',
            PENDING2: 'En attente de facturation',
            PRICING: 'Facturation en cours',
            NEGOTIATION1: 'Négociation 1',
            NEGOTIATION2: 'Négociation 2',
            ANNULER: 'Annulée',
            PENDING3: 'En attente réparation',
            REPARATION: 'Réparation affectée',
            REPARATION_Pause: 'Réparation en pause',
            INREPARATION: 'En réparation',
            FINISHED: 'Terminée',
            RETOUR1: 'Retour 1',
            RETOUR2: 'Retour 2',
            RETOUR3: 'Retour 3',
        };
        const s = this.raw(status);
        return map[s] || s || '—';
    }
}
