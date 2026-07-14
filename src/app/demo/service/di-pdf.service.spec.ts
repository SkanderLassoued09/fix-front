import { DiPdfService } from './di-pdf.service';

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

    it('maps the workflow status to a French label', () => {
        const svc: any = new DiPdfService();
        expect(svc.statusLabel('FINISHED')).toBe('Terminée');
        expect(svc.statusLabel('INREPARATION')).toBe('En réparation');
    });
});
