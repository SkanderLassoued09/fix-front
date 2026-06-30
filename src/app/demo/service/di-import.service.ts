import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  /** Real import — persists the valid rows. */
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
