import { Injectable } from '@angular/core';

/**
 * Procès-Verbal de Réunion — PDF generator.
 *
 * Produces a Word-style PV document: branded header, sectioned body
 * (Informations / Participants table / Ordre du jour / Points discutés /
 * Décisions / Actions table) and footer with reference + page counter.
 *
 * Implementation notes:
 *   - jsPDF + jspdf-autotable are **dynamically imported** so the main
 *     bundle stays unaffected (~200 kB extra only when a tech actually
 *     downloads a PV). Same lazy pattern the ticket-list export uses.
 *   - All measurements are in `pt` (default jsPDF unit when you pass
 *     'a4') — A4 page = 595×842 pt. We keep a 42 pt outer margin so the
 *     output prints cleanly on both A4 and US Letter.
 *   - Colors mirror the design system: header bar `#2563eb`, section
 *     bars `#3b82f6`, status badges (`A_FAIRE` amber, `EN_COURS` blue,
 *     `TERMINE` green), priorities (`HAUTE` red, `MOYENNE` amber,
 *     `BASSE` slate). No purple anywhere.
 *
 * Async generate so the caller can await + show a spinner during the
 * one-time dynamic import (subsequent calls are instant).
 */
@Injectable({ providedIn: 'root' })
export class ReunionPvPdfService {
    /**
     * Generate + download. `profilesById` is an optional lookup from
     * profile `_id` → display name so participants/responsables show
     * human names instead of opaque ids (the underlying GraphQL query
     * still returns just ids, by design — no data duplication backend
     * side).
     */
    async generateAndDownload(
        pv: any,
        profilesById: Map<string, string> = new Map(),
    ): Promise<void> {
        const [jspdfMod, autoTableMod] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable'),
        ]);
        const JsPDF = (jspdfMod as any).default || (jspdfMod as any).jsPDF;
        const autoTable: any =
            (autoTableMod as any).default || (autoTableMod as any);

        const doc = new JsPDF('p', 'pt', 'a4');
        const PAGE_W = doc.internal.pageSize.getWidth();
        const PAGE_H = doc.internal.pageSize.getHeight();
        const MARGIN_X = 42;
        const CONTENT_W = PAGE_W - MARGIN_X * 2;

        const COLORS = {
            primary: [37, 99, 235] as [number, number, number],
            primaryLight: [59, 130, 246] as [number, number, number],
            text: [15, 23, 42] as [number, number, number],
            muted: [100, 116, 139] as [number, number, number],
            border: [226, 232, 240] as [number, number, number],
            zebra: [248, 250, 252] as [number, number, number],
            amber: [180, 83, 9] as [number, number, number],
            green: [22, 163, 74] as [number, number, number],
            red: [220, 38, 38] as [number, number, number],
            blue: [37, 99, 235] as [number, number, number],
        };

        // ── Header band ─────────────────────────────────────────────
        doc.setFillColor(...COLORS.primary);
        doc.rect(0, 0, PAGE_W, 70, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text('PROCÈS-VERBAL DE RÉUNION', MARGIN_X, 32);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Fixtronix — Industrial Repair Services', MARGIN_X, 50);

        // Reference badge in the top-right corner.
        const ref = String(pv?.reference || 'PV-—');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        const refW = doc.getTextWidth(ref) + 22;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(PAGE_W - MARGIN_X - refW, 22, refW, 26, 6, 6, 'F');
        doc.setTextColor(...COLORS.primary);
        doc.text(ref, PAGE_W - MARGIN_X - refW / 2, 39, { align: 'center' });

        // ── Title block ─────────────────────────────────────────────
        let y = 96;
        doc.setTextColor(...COLORS.text);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        const titre = this.wrap(doc, pv?.titre || 'Réunion sans titre', CONTENT_W);
        titre.forEach((line) => {
            doc.text(line, MARGIN_X, y);
            y += 18;
        });

        if (pv?.objet) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            doc.setTextColor(...COLORS.muted);
            const objet = this.wrap(doc, pv.objet, CONTENT_W);
            objet.forEach((line) => {
                doc.text(line, MARGIN_X, y);
                y += 13;
            });
            doc.setTextColor(...COLORS.text);
        }
        y += 8;

        // Contexte retour banner — when present, surfaces "Retour 2"
        // tag so the reader sees at a glance why the meeting happened.
        if (pv?.contexteRetour?.niveau) {
            const niveau = pv.contexteRetour.niveau;
            const motif = pv.contexteRetour.motif || '—';
            const bg =
                niveau === 3 ? COLORS.red : niveau === 2 ? COLORS.amber : COLORS.amber;
            doc.setFillColor(bg[0], bg[1], bg[2]);
            doc.roundedRect(MARGIN_X, y, CONTENT_W, 22, 4, 4, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(
                `RETOUR ${niveau} — ${this.truncate(motif, 90)}`,
                MARGIN_X + 10,
                y + 15,
            );
            doc.setTextColor(...COLORS.text);
            y += 32;
        }

        // ── Informations générales (key/value grid) ────────────────
        y = this.sectionTitle(doc, 'INFORMATIONS GÉNÉRALES', y, MARGIN_X, CONTENT_W, COLORS);
        const dateReunion = this.formatDate(pv?.dateReunion);
        const lieu = pv?.lieu || '—';
        const modalite = this.modaliteLabel(pv?.modalite);
        const statut = this.statutLabel(pv?.statut);
        const prochaine = this.formatDate(pv?.prochaineReunion, true) || '—';

        autoTable(doc, {
            startY: y,
            margin: { left: MARGIN_X, right: MARGIN_X },
            theme: 'plain',
            styles: { font: 'helvetica', fontSize: 10, cellPadding: 6 },
            body: [
                [{ content: 'Date', styles: { fontStyle: 'bold' } }, dateReunion, { content: 'Lieu', styles: { fontStyle: 'bold' } }, lieu],
                [{ content: 'Modalité', styles: { fontStyle: 'bold' } }, modalite, { content: 'Statut', styles: { fontStyle: 'bold' } }, statut],
                [{ content: 'Prochaine réunion', styles: { fontStyle: 'bold' } }, prochaine, { content: 'Date du PV', styles: { fontStyle: 'bold' } }, this.formatDate(pv?.createdAt)],
            ],
            columnStyles: {
                0: { cellWidth: 110, textColor: COLORS.muted as any },
                1: { cellWidth: (CONTENT_W - 220) / 2 },
                2: { cellWidth: 110, textColor: COLORS.muted as any },
                3: { cellWidth: (CONTENT_W - 220) / 2 },
            },
            didDrawCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 0) {
                    doc.setDrawColor(...COLORS.border);
                    doc.line(
                        data.cell.x,
                        data.cell.y + data.cell.height,
                        data.cell.x + CONTENT_W,
                        data.cell.y + data.cell.height,
                    );
                }
            },
        });
        y = (doc as any).lastAutoTable.finalY + 16;

        // ── Participants (table) ────────────────────────────────────
        const participants = (pv?.participants ?? []) as Array<{
            profile: string;
            statut?: string;
        }>;
        if (participants.length) {
            y = this.sectionTitle(doc, 'PARTICIPANTS', y, MARGIN_X, CONTENT_W, COLORS);
            autoTable(doc, {
                startY: y,
                margin: { left: MARGIN_X, right: MARGIN_X },
                styles: { font: 'helvetica', fontSize: 10, cellPadding: 6 },
                headStyles: {
                    fillColor: COLORS.primaryLight as any,
                    textColor: [255, 255, 255] as any,
                    fontStyle: 'bold',
                },
                alternateRowStyles: { fillColor: COLORS.zebra as any },
                head: [['#', 'Participant', 'Présence']],
                body: participants.map((p, i) => [
                    String(i + 1),
                    profilesById.get(p.profile) || p.profile,
                    this.presenceLabel(p.statut),
                ]),
                columnStyles: {
                    0: { cellWidth: 28, halign: 'center' },
                    2: { cellWidth: 110 },
                },
            });
            y = (doc as any).lastAutoTable.finalY + 16;
        }

        // ── Ordre du jour ──────────────────────────────────────────
        const ordre = (pv?.ordreDuJour ?? []) as string[];
        if (ordre.length) {
            y = this.sectionTitle(doc, 'ORDRE DU JOUR', y, MARGIN_X, CONTENT_W, COLORS);
            doc.setFontSize(10);
            doc.setTextColor(...COLORS.text);
            ordre.forEach((line, i) => {
                const wrapped = this.wrap(doc, `${i + 1}. ${line}`, CONTENT_W - 16);
                wrapped.forEach((w) => {
                    y = this.ensurePage(doc, y, PAGE_H);
                    doc.text(w, MARGIN_X + 4, y);
                    y += 14;
                });
            });
            y += 8;
        }

        // ── Points discutés ─────────────────────────────────────────
        const points = (pv?.pointsDiscutes ?? []) as Array<{
            titre: string;
            contenu?: string;
        }>;
        if (points.length) {
            y = this.sectionTitle(doc, 'POINTS DISCUTÉS', y, MARGIN_X, CONTENT_W, COLORS);
            points.forEach((p, i) => {
                y = this.ensurePage(doc, y, PAGE_H);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(...COLORS.primary);
                doc.text(`${i + 1}. ${this.truncate(p.titre || '—', 120)}`, MARGIN_X, y);
                y += 14;
                if (p.contenu) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(...COLORS.text);
                    const lines = this.wrap(doc, p.contenu, CONTENT_W - 12);
                    lines.forEach((l) => {
                        y = this.ensurePage(doc, y, PAGE_H);
                        doc.text(l, MARGIN_X + 12, y);
                        y += 13;
                    });
                }
                y += 6;
            });
        }

        // ── Décisions ──────────────────────────────────────────────
        const decisions = (pv?.decisions ?? []) as string[];
        if (decisions.length) {
            y = this.sectionTitle(doc, 'DÉCISIONS', y, MARGIN_X, CONTENT_W, COLORS);
            doc.setFontSize(10);
            doc.setTextColor(...COLORS.text);
            decisions.forEach((line) => {
                const wrapped = this.wrap(doc, `▸ ${line}`, CONTENT_W - 12);
                wrapped.forEach((w) => {
                    y = this.ensurePage(doc, y, PAGE_H);
                    doc.text(w, MARGIN_X + 4, y);
                    y += 14;
                });
            });
            y += 8;
        }

        // ── Actions table ──────────────────────────────────────────
        const actions = (pv?.actions ?? []) as Array<any>;
        if (actions.length) {
            y = this.sectionTitle(doc, 'PLAN D’ACTIONS', y, MARGIN_X, CONTENT_W, COLORS);
            autoTable(doc, {
                startY: y,
                margin: { left: MARGIN_X, right: MARGIN_X },
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, valign: 'middle' },
                headStyles: {
                    fillColor: COLORS.primaryLight as any,
                    textColor: [255, 255, 255] as any,
                    fontStyle: 'bold',
                    fontSize: 9,
                },
                alternateRowStyles: { fillColor: COLORS.zebra as any },
                head: [['#', 'Action', 'Responsable', 'Échéance', 'Priorité', 'Statut']],
                body: actions.map((a, i) => [
                    String(i + 1),
                    this.truncate(a?.titre || '—', 60),
                    profilesById.get(a?.responsable) || a?.responsable || '—',
                    this.formatDate(a?.echeance, true),
                    this.priorityLabel(a?.priorite),
                    this.actionStatutLabel(a?.statut),
                ]),
                columnStyles: {
                    0: { cellWidth: 24, halign: 'center' },
                    1: { cellWidth: 145 },
                    2: { cellWidth: 90 },
                    3: { cellWidth: 65, halign: 'center' },
                    4: { cellWidth: 55, halign: 'center' },
                    5: { cellWidth: 60, halign: 'center' },
                },
                didParseCell: (data: any) => {
                    // Color priority + statut cells per design system.
                    if (data.section === 'body' && data.column.index === 4) {
                        const v = String(data.cell.raw || '');
                        if (v === 'Haute') data.cell.styles.textColor = COLORS.red;
                        else if (v === 'Moyenne') data.cell.styles.textColor = COLORS.amber;
                        else if (v === 'Basse') data.cell.styles.textColor = COLORS.muted;
                        data.cell.styles.fontStyle = 'bold';
                    }
                    if (data.section === 'body' && data.column.index === 5) {
                        const v = String(data.cell.raw || '');
                        if (v === 'Terminé') data.cell.styles.textColor = COLORS.green;
                        else if (v === 'En cours') data.cell.styles.textColor = COLORS.blue;
                        else if (v === 'À faire') data.cell.styles.textColor = COLORS.amber;
                        data.cell.styles.fontStyle = 'bold';
                    }
                },
            });
            y = (doc as any).lastAutoTable.finalY + 20;
        }

        // ── Signature area ─────────────────────────────────────────
        y = this.ensurePage(doc, y, PAGE_H, 80);
        doc.setDrawColor(...COLORS.border);
        doc.line(MARGIN_X, y, MARGIN_X + 180, y);
        doc.line(PAGE_W - MARGIN_X - 180, y, PAGE_W - MARGIN_X, y);
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.muted);
        doc.text('Rédacteur (créateur du PV)', MARGIN_X, y + 12);
        doc.text(
            'Validation Responsable',
            PAGE_W - MARGIN_X - 180,
            y + 12,
        );

        // ── Footer on every page ───────────────────────────────────
        const pageCount = (doc as any).getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            (doc as any).setPage(i);
            doc.setDrawColor(...COLORS.border);
            doc.line(MARGIN_X, PAGE_H - 28, PAGE_W - MARGIN_X, PAGE_H - 28);
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.muted);
            doc.setFont('helvetica', 'normal');
            doc.text(
                `${ref} · ${pv?.titre || ''}`.slice(0, 110),
                MARGIN_X,
                PAGE_H - 14,
            );
            doc.text(
                `Page ${i} / ${pageCount}`,
                PAGE_W - MARGIN_X,
                PAGE_H - 14,
                { align: 'right' },
            );
        }

        const safeRef = ref.replace(/[^A-Za-z0-9_-]/g, '_');
        doc.save(`${safeRef}.pdf`);
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private sectionTitle(
        doc: any,
        label: string,
        y: number,
        marginX: number,
        contentW: number,
        colors: any,
    ): number {
        // Vertical accent bar + uppercase label, mimicking the Word
        // "Heading 2" style without being heavy.
        const PAGE_H = doc.internal.pageSize.getHeight();
        y = this.ensurePage(doc, y, PAGE_H, 30);
        doc.setFillColor(...colors.primary);
        doc.rect(marginX, y - 10, 3, 13, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...colors.primary);
        doc.text(label, marginX + 9, y);
        doc.setTextColor(...colors.text);
        doc.setFont('helvetica', 'normal');
        return y + 10;
    }

    private wrap(doc: any, text: string, maxWidth: number): string[] {
        return doc.splitTextToSize(text || '', maxWidth) as string[];
    }

    private truncate(s: string, n: number): string {
        const t = String(s || '');
        return t.length > n ? `${t.slice(0, n - 1)}…` : t;
    }

    /** Page-break helper: jumps to a fresh page if the next block won't
     *  fit (uses a 28pt footer reservation by default). */
    private ensurePage(doc: any, y: number, pageH: number, blockH = 14): number {
        if (y + blockH > pageH - 40) {
            doc.addPage();
            return 60;
        }
        return y;
    }

    private formatDate(d: any, dateOnly = false): string {
        if (!d) return '—';
        const dt = new Date(d);
        if (isNaN(+dt)) return '—';
        const pad = (n: number) => String(n).padStart(2, '0');
        const dmy = `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
        if (dateOnly) return dmy;
        return `${dmy} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    }

    private modaliteLabel(v?: string): string {
        switch (v) {
            case 'PRESENTIEL':
                return 'Présentiel';
            case 'VISIO':
                return 'Visioconférence';
            case 'HYBRIDE':
                return 'Hybride';
            default:
                return '—';
        }
    }

    private statutLabel(v?: string): string {
        return v === 'FINALISE' ? 'Finalisé' : 'Brouillon';
    }

    private presenceLabel(v?: string): string {
        switch (v) {
            case 'PRESENT':
                return 'Présent';
            case 'ABSENT':
                return 'Absent';
            case 'EXCUSE':
                return 'Excusé';
            default:
                return '—';
        }
    }

    private priorityLabel(v?: string): string {
        switch (v) {
            case 'HAUTE':
                return 'Haute';
            case 'MOYENNE':
                return 'Moyenne';
            case 'BASSE':
                return 'Basse';
            default:
                return '—';
        }
    }

    private actionStatutLabel(v?: string): string {
        switch (v) {
            case 'A_FAIRE':
                return 'À faire';
            case 'EN_COURS':
                return 'En cours';
            case 'TERMINE':
                return 'Terminé';
            default:
                return '—';
        }
    }
}
