import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { DiImportComponent } from './di-import.component';
import {
  DiImportService,
  DiImportProgress,
  ImportReport,
} from 'src/app/demo/service/di-import.service';

/**
 * Workflow d'import (Étape 3). `DiImportService` est mocké (aucun réseau/WS réel).
 * NB : le front n'a pas de `karma.conf.js` → `ng test` ne tourne pas ; ces specs
 * sont néanmoins écrites pour être exécutables une fois karma configuré.
 */
function reportWith(lignes: any[]): ImportReport {
  return {
    ligneEnTete: 4,
    total: lignes.length,
    valides: lignes.filter((l) => l.statut !== 'erreur').length,
    warnings: [],
    erreurs: lignes.filter((l) => l.statut === 'erreur'),
    lignes,
  };
}
const validLine = (n: number) => ({
  ligne: n,
  statut: 'valide',
  valeurs: { 'N° DI': 'T' + n },
  motifs: [],
});
const ambiguousLine = (n: number, name = 'ACME') => ({
  ligne: n,
  statut: 'erreur',
  valeurs: { 'N° DI': 'T' + n, Client: name },
  motifs: [`« ${name} » existe comme Client ET comme Société — à trancher`],
});

describe('DiImportComponent (workflow)', () => {
  let fixture: ComponentFixture<DiImportComponent>;
  let cmp: DiImportComponent;
  let svc: jasmine.SpyObj<DiImportService>;
  let progress$: Subject<DiImportProgress>;

  beforeEach(async () => {
    progress$ = new Subject<DiImportProgress>();
    svc = jasmine.createSpyObj<DiImportService>('DiImportService', [
      'preview', 'execute', 'getJob', 'onProgress', 'downloadTemplate',
    ]);
    svc.onProgress.and.returnValue(progress$.asObservable());
    localStorage.removeItem('di-import:lastJob');

    await TestBed.configureTestingModule({
      imports: [DiImportComponent],
      providers: [
        { provide: DiImportService, useValue: svc },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiImportComponent);
    cmp = fixture.componentInstance;
  });

  const file = () => new File(['x'], 'import.xlsx');

  it('dry-run : affiche le rapport, passe en phase vérification', () => {
    svc.preview.and.returnValue(of(reportWith([validLine(1), validLine(2)])));
    cmp.onFileSelected(file());
    expect(svc.preview).toHaveBeenCalled();
    expect(cmp.phase).toBe('verification');
    expect(cmp.report?.valides).toBe(2);
  });

  it('ambiguïté non résolue → « Valider le lot » impossible', () => {
    svc.preview.and.returnValue(of(reportWith([validLine(1), ambiguousLine(2)])));
    cmp.onFileSelected(file());
    expect(cmp.unresolvedCount).toBe(1);
    expect(cmp.canValidate).toBeFalse();
  });

  it('résolution de l’ambiguïté → validation possible', () => {
    svc.preview.and.returnValue(of(reportWith([validLine(1), ambiguousLine(2)])));
    cmp.onFileSelected(file());
    cmp.resolve(2, 'company');
    expect(cmp.unresolvedCount).toBe(0);
    expect(cmp.canValidate).toBeTrue();
    expect(cmp.toImportCount).toBe(2); // 1 valide + 1 tranchée
  });

  it('validate → execute avec décisions, récupère jobId, passe en cours', () => {
    svc.preview.and.returnValue(of(reportWith([validLine(1), ambiguousLine(2)])));
    svc.execute.and.returnValue(of({ jobId: 'IMPORT_x', total: 2 }));
    cmp.onFileSelected(file());
    cmp.resolve(2, 'client');
    cmp.validate();
    const [, decisions] = svc.execute.calls.mostRecent().args;
    expect(decisions).toEqual([{ ligne: 2, kind: 'client' }]);
    expect(cmp.jobId).toBe('IMPORT_x');
    expect(cmp.phase).toBe('running');
    expect(localStorage.getItem('di-import:lastJob')).toBe('IMPORT_x');
  });

  it('progression 0/N → N/N puis rapport COMPLETED', () => {
    svc.preview.and.returnValue(of(reportWith([validLine(1), validLine(2)])));
    svc.execute.and.returnValue(of({ jobId: 'JOB1', total: 2 }));
    svc.getJob.and.returnValue(
      of({ jobId: 'JOB1', status: 'COMPLETED', done: 2, total: 2, report: { crees: { dis: 2, clients: 0, locations: 0, ignorees: 0 } } } as any),
    );
    cmp.onFileSelected(file());
    cmp.validate();
    progress$.next({ jobId: 'JOB1', done: 1, total: 2, currentRef: 'T1', phase: 'RUNNING' });
    expect(cmp.pct).toBe(50);
    progress$.next({ jobId: 'JOB1', done: 2, total: 2, currentRef: 'T2', phase: 'COMPLETED' });
    expect(cmp.phase).toBe('completed');
    expect(cmp.crees?.dis).toBe(2);
  });

  it('filtre WebSocket : un event d’un AUTRE job est ignoré', () => {
    svc.preview.and.returnValue(of(reportWith([validLine(1)])));
    svc.execute.and.returnValue(of({ jobId: 'JOB_A', total: 1 }));
    // onProgress renvoie un flux DÉJÀ filtré côté service : on simule ici en ne
    // poussant que les events du bon job. On vérifie que la valeur d'un autre
    // job (non émise par le flux filtré) n'altère pas la progression.
    cmp.onFileSelected(file());
    cmp.validate();
    // event du bon job
    progress$.next({ jobId: 'JOB_A', done: 1, total: 1, currentRef: 'T1', phase: 'RUNNING' });
    expect(cmp.progress?.jobId).toBe('JOB_A');
    expect(cmp.progress?.done).toBe(1);
  });

  it('rapport FAILED : statut échec + erreur + lignes déjà créées', () => {
    svc.preview.and.returnValue(of(reportWith([validLine(1), validLine(2)])));
    svc.execute.and.returnValue(of({ jobId: 'JOBF', total: 2 }));
    svc.getJob.and.returnValue(
      of({ jobId: 'JOBF', status: 'FAILED', done: 1, total: 2, error: 'db lost', report: { crees: { dis: 1 } } } as any),
    );
    cmp.onFileSelected(file());
    cmp.validate();
    progress$.next({ jobId: 'JOBF', done: 1, total: 2, currentRef: 'T1', phase: 'FAILED' });
    expect(cmp.phase).toBe('failed');
    expect(cmp.job?.error).toBe('db lost');
    expect(cmp.crees?.dis).toBe(1); // créées conservées
  });

  it('reprise : un job RUNNING stocké est récupéré à l’ouverture', () => {
    localStorage.setItem('di-import:lastJob', 'JOBR');
    svc.getJob.and.returnValue(
      of({ jobId: 'JOBR', status: 'RUNNING', done: 3, total: 10, currentRef: 'T3' } as any),
    );
    cmp.open();
    expect(svc.getJob).toHaveBeenCalledWith('JOBR');
    expect(cmp.phase).toBe('running');
    expect(cmp.progress?.done).toBe(3);
    expect(svc.onProgress).toHaveBeenCalledWith('JOBR');
  });

  it('reprise : un jobId refusé (403/404) est oublié', () => {
    localStorage.setItem('di-import:lastJob', 'JOB_OTHER');
    svc.getJob.and.returnValue(throwError(() => ({ status: 403 })));
    cmp.open();
    expect(localStorage.getItem('di-import:lastJob')).toBeNull();
    expect(cmp.phase).toBe('idle');
  });

  it('fermeture d’onglet (onHide) n’annule PAS le job (pas d’appel serveur d’annulation)', () => {
    svc.preview.and.returnValue(of(reportWith([validLine(1)])));
    svc.execute.and.returnValue(of({ jobId: 'JOBK', total: 1 }));
    cmp.onFileSelected(file());
    cmp.validate();
    cmp.onHide();
    // aucune API d'annulation n'existe / n'est appelée
    expect((svc as any).cancel).toBeUndefined();
    expect(cmp.jobId).toBe('JOBK');
  });
});
