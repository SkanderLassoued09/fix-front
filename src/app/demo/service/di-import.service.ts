import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, filter } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

/**
 * REST client for the bulk DI import (the only non-GraphQL surface the app
 * talks to). Mirrors the backend `ImportReport` contract. Auth reuses the same
 * Bearer token Apollo sends (localStorage『token』).
 */

export type LigneStatut = 'valide' | 'avertissement' | 'erreur';

export interface ImportLigne {
  ligne: number;
  statut: LigneStatut;
  valeurs: Record<string, string>;
  motifs: string[];
}
export interface ImportWarning {
  ligne: number;
  message: string;
}
export interface ImportError {
  ligne: number;
  valeurs: Record<string, string>;
  motifs: string[];
}
export interface ImportCrees {
  dis: number;
  clients: number;
  locations: number;
  ignorees: number;
}
export interface ImportReport {
  ligneEnTete: number | null;
  total: number;
  valides: number;
  warnings: ImportWarning[];
  erreurs: ImportError[];
  lignes: ImportLigne[];
  enTeteInvalide?: boolean;
  crees?: ImportCrees;
}

/** Résolution d'une ambiguïté « both » (par n° de ligne), envoyée à l'exécution. */
export interface TierDecision {
  ligne: number;
  kind: 'client' | 'company';
}

/** Réponse immédiate de POST /di/import/execute (fire-and-forget serveur). */
export interface DiImportJobRef {
  jobId?: string;
  total: number;
  report?: ImportReport;
}

/** Événement WS `di-import.progress` — porte TOUJOURS `jobId` (broadcast filtré). */
export interface DiImportProgress {
  jobId: string;
  done: number;
  total: number;
  currentRef: string | null;
  phase: string;
}

export type DiImportJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/** État persisté d'un job (récupération après réouverture). */
export interface DiImportJob {
  jobId: string;
  createdBy?: string;
  status: DiImportJobStatus;
  done: number;
  total: number;
  currentRef?: string | null;
  error?: string | null;
  report?: ImportReport;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class DiImportService {
  private readonly base = (environment.apiUrl ?? '').replace(/\/+$/, '');

  constructor(private readonly http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  /** Dry-run preview — validates without persisting. */
  preview(file: File): Observable<ImportReport> {
    return this.upload(file, true);
  }

  /** Real import (LEGACY, synchrone) — persiste les lignes valides et renvoie le
   *  rapport. Conservé pour non-régression ; le workflow par job utilise `execute`. */
  import(file: File): Observable<ImportReport> {
    return this.upload(file, false);
  }

  private upload(file: File, dryRun: boolean): Observable<ImportReport> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ImportReport>(
      `${this.base}/di/import?dryRun=${dryRun}`,
      form,
      { headers: this.authHeaders() },
    );
  }

  /**
   * Lance l'exécution en JOB SERVEUR (fire-and-forget) + décisions d'ambiguïté
   * tranchées à l'écran de vérification. Renvoie `{ jobId, total }` immédiatement ;
   * la progression arrive via le WebSocket (`onProgress`).
   */
  execute(
    file: File,
    decisions: TierDecision[] = [],
  ): Observable<DiImportJobRef> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (decisions.length) form.append('decisions', JSON.stringify(decisions));
    return this.http.post<DiImportJobRef>(
      `${this.base}/di/import/execute`,
      form,
      { headers: this.authHeaders() },
    );
  }

  /** Récupère l'état d'un job (reconnexion/réouverture). Le back refuse le job
   *  d'un autre utilisateur (403). */
  getJob(jobId: string): Observable<DiImportJob> {
    return this.http.get<DiImportJob>(
      `${this.base}/di/import/jobs/${encodeURIComponent(jobId)}`,
      { headers: this.authHeaders() },
    );
  }

  // ---- Progression temps réel (WebSocket broadcast → filtré par jobId) -------
  private socket?: Socket;
  private readonly progress$ = new Subject<DiImportProgress>();

  private ensureSocket(): void {
    if (this.socket) return;
    this.socket = io(this.base);
    this.socket.on('di-import.progress', (p: DiImportProgress) =>
      this.progress$.next(p),
    );
  }

  /**
   * Flux de progression pour UN job. Le gateway diffuse en broadcast : on FILTRE
   * obligatoirement `event.jobId === jobId` pour ignorer les jobs des autres.
   */
  onProgress(jobId: string): Observable<DiImportProgress> {
    this.ensureSocket();
    return this.progress$.pipe(filter((p) => p && p.jobId === jobId));
  }

  /** Download the .xlsx model (headers + example rows). */
  downloadTemplate(): void {
    this.http
      .get(`${this.base}/di/import/template`, {
        headers: this.authHeaders(),
        responseType: 'blob',
      })
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modele_import_di.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
  }
}
