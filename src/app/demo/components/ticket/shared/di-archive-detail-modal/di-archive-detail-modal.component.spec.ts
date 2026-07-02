import { DiArchiveDetailModalComponent } from './di-archive-detail-modal.component';

/**
 * Per-slot loader isolation (pure component logic — no TestBed).
 *  - uploading/removing one slot flips ONLY that slot's `busy` flag;
 *  - the flag is cleared on success AND on failure (no leak);
 *  - the loader spans the whole cycle (file read is stubbed here).
 */
describe('DiArchiveDetailModalComponent — per-slot loader', () => {
  function setup() {
    let resolveRun!: (v: any) => void;
    const runner: any = {
      run: jasmine
        .createSpy('run')
        .and.callFake(() => new Promise((res) => (resolveRun = res))),
    };
    const gql: any = {
      uploadDocMutation: () => ({}),
      removeDocMutation: () => ({}),
    };
    const c = new DiArchiveDetailModalComponent(runner, gql);
    c.archive = {
      _id: 'DIA_1',
      bc: null,
      bl: null,
      devis: null,
      facture: null,
      statutCompletude: 'INCOMPLET',
    };
    // Skip the real FileReader → isolate the busy/loading logic.
    (c as any).toBase64 = () => Promise.resolve('data:application/pdf;base64,QUJD');
    return { c, runner, getResolve: () => resolveRun };
  }

  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };

  it('upload flips busy ONLY for the target slot; the other 3 stay active', async () => {
    const { c, getResolve } = setup();
    const bc = c.slots.find((s) => s.docType === 'BC')!;
    const p = c.onUpload(bc, new File(['x'], 'x.pdf'));
    await flush(); // let toBase64 + run() start
    expect(c.busy['BC']).toBe(true);
    expect(!!c.busy['BL']).toBe(false);
    expect(!!c.busy['DEVIS']).toBe(false);
    expect(!!c.busy['FACTURE']).toBe(false);

    getResolve()({
      uploadDiArchiveDoc: {
        statutCompletude: 'INCOMPLET',
        bc: { driveFileId: 'a', webViewLink: 'b', name: 'c' },
      },
    });
    await p;
    expect(c.busy['BC']).toBe(false); // cleared on success
  });

  it('remove flips busy ONLY for the target slot', async () => {
    const { c, getResolve } = setup();
    c.archive.devis = { driveFileId: 'a', webViewLink: 'b', name: 'c' };
    const devis = c.slots.find((s) => s.docType === 'DEVIS')!;
    const p = c.onRemove(devis);
    await flush();
    expect(c.busy['DEVIS']).toBe(true);
    expect(!!c.busy['BC']).toBe(false);

    getResolve()({ removeDiArchiveDoc: { statutCompletude: 'INCOMPLET', devis: null } });
    await p;
    expect(c.busy['DEVIS']).toBe(false);
  });

  it('upload failure clears the slot busy (no leak); status untouched', async () => {
    const { c } = setup();
    (c as any).runner.run.and.returnValue(Promise.reject(new Error('drive fail')));
    const bl = c.slots.find((s) => s.docType === 'BL')!;
    await c.onUpload(bl, new File(['x'], 'x.pdf'));
    expect(c.busy['BL']).toBe(false);
    expect(c.archive.bl).toBeNull();
  });
});
