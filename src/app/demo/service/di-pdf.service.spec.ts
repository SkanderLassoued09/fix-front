import { DiPdfService } from './di-pdf.service';
import {
    buildAssignmentRows,
    buildLegacyPauseRows,
    buildStatusFlow,
    buildWorkJournal,
    sanitizeHistory,
} from '../components/ticket/shared/status-timeline.util';

/**
 * Verifies the DI PDF dossier is a real, non-empty PDF (magic bytes "%PDF"),
 * built via the same jsPDF pipeline as the PV export. No download side-effect
 * is triggered — we inspect the in-memory buffer from `buildDoc`.
 */
describe('DiPdfService', () => {
    const di = {
        _idnum: 'T279',
        title: 'Écran cassé',
        status: 'FINISHED',
        client_id: 'SO TU LIN SA',
        techDiag: 'Alice',
        techRep: 'Bob',
        price: 100,
        final_price: 120,
        description: 'Remplacement écran',
        array_composants: [{ nameComposant: 'Écran', quantity: 1 }],
        remarque_manager: 'ok',
        bon_de_livraison: 'https://drive/bl',
        facture: 'https://drive/fac',
    };

    it('builds a valid, non-empty PDF (magic bytes "%PDF")', async () => {
        const svc = new DiPdfService();
        const doc = await svc.buildDoc(di);
        const bytes = new Uint8Array(doc.output('arraybuffer'));

        expect(bytes.length).toBeGreaterThan(0);
        const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        expect(head).toBe('%PDF');
    });

    it('builds the enriched composant table when the modal supplies rows', async () => {
        // Le modal passe les lignes DÉJÀ jointes au catalogue et scopées au
        // cycle affiché (même convention que `cycles` / `finance` / `times`).
        const svc = new DiPdfService();
        const doc = await svc.buildDoc(di, {
            composants: {
                cycleLabel: 'Retour 1',
                total: 196,
                partial: true,
                priced: 2,
                rows: [
                    {
                        name: 'Écran LCD',
                        quantity: 1,
                        status: 'En stock',
                        prixVente: 140,
                        lineTotal: 140,
                        comingDate: '12/03/2026',
                    },
                    {
                        // Ligne hors catalogue : ni prix, ni total.
                        name: 'Composant fantôme',
                        quantity: 4,
                        status: 'Hors catalogue',
                        prixVente: null,
                        lineTotal: null,
                        comingDate: '—',
                    },
                ],
            },
        });
        const bytes = new Uint8Array(doc.output('arraybuffer'));

        expect(bytes.length).toBeGreaterThan(0);
        const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        expect(head).toBe('%PDF');
    });

    it('builds the parcours bar and the chrono tables (T1270-like data)', async () => {
        const svc = new DiPdfService();
        const history = sanitizeHistory([
            { status: 'INDIAGNOSTIC', at: '2026-08-24T12:37:43.021Z' },
            { status: 'DIAGNOSTIC_Pause', at: '2026-08-26T08:40:50.407Z' },
            { status: 'INDIAGNOSTIC', at: '2026-08-26T08:42:55.486Z' },
            { status: 'PENDING2', at: '2026-08-26T08:46:29.076Z' },
            { status: 'FINISHED', at: '2026-08-26T15:39:32.382Z' },
        ]);
        const flow = buildStatusFlow(history, 'FINISHED', null);
        const diag = buildWorkJournal({
            kind: 'diag',
            segments: [
                { startedAt: '2026-08-24T12:37:43.025Z', stoppedAt: '2026-08-26T08:40:50.426Z' },
                { startedAt: '2026-08-26T08:42:55.491Z', stoppedAt: '2026-08-26T08:46:29.079Z' },
            ],
            history,
            flow,
            storedCumul: '44:06:55',
        });
        const rep = buildWorkJournal({ kind: 'rep', segments: [], history, flow });
        const doc = await svc.buildDoc(di, {
            cycles: [{ n: 1, label: 'Retour 1', flow, inferredStart: true }],
            times: {
                cycleLabel: 'Retour 1',
                diagCumul: '44:06:55',
                repCumul: null,
                chrono: {
                    diag,
                    rep,
                    pauseSource: { diag: 'history', rep: 'legacy' },
                    legacyPauses: {
                        diag: [],
                        rep: buildLegacyPauseRows(
                            [{ pauseType: 'rep', pauseStart: '2026/08/26:17:00:00', pauseEnd: null }],
                            'rep',
                            null,
                        ),
                    },
                    assignments: buildAssignmentRows(
                        [{ tech: 'Ali', assignedAt: '2026-08-24T12:00:00Z', diagTimeStart: '00:00:00' }],
                        '44:06:55',
                        null,
                    ),
                },
                cycleStats: [{ ignoreCount: 1, diag_time: '44:06:55', rep_time: ' 00:54:36' }],
            },
        });
        const bytes = new Uint8Array(doc.output('arraybuffer'));
        expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('%PDF');
    });

    it('paginates a very long parcours instead of overflowing the page', async () => {
        const svc = new DiPdfService();
        const start = Date.parse('2026-01-01T00:00:00Z');
        const history = sanitizeHistory(
            Array.from({ length: 200 }, (_, i) => ({
                status: i % 2 ? 'DIAGNOSTIC_Pause' : 'INDIAGNOSTIC',
                at: new Date(start + i * 60_000).toISOString(),
            })),
        );
        const flow = buildStatusFlow(history, null, new Date(start + 200 * 60_000));
        const doc = await svc.buildDoc(di, { cycles: [{ n: 0, label: 'Flux original', flow }] });
        expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    });

    it('formats legacy pause strings on the right day (Tunis time)', () => {
        const svc: any = new DiPdfService();
        expect(svc.fmt('2026/07/29:11:45:24')).toBe('29/07/2026 11:45');
        expect(svc.pdfSafe('Fin du diagnostic → En attente prix')).toBe(
            'Fin du diagnostic > En attente prix',
        );
    });

    it('prints the raw workflow status in capitals, PRICING_DIAG merged into PRICING', () => {
        const svc: any = new DiPdfService();
        expect(svc.statusLabel('FINISHED')).toBe('FINISHED');
        expect(svc.statusLabel('INREPARATION')).toBe('INREPARATION');
        expect(svc.statusLabel('PRICING_DIAG')).toBe('PRICING');
        expect(svc.statusLabel('PRICING')).toBe('PRICING');
        expect(svc.statusLabel(null)).toBe('—');
    });
});
