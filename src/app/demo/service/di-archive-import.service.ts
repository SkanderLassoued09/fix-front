import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

/**
 * REST client for the SEPARATE archive import (`POST /di-archive/import`).
 * Same report contract as the DI importer; only the endpoint + `crees` differ.
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
  archives: number;
  ignorees: number;
  importBatchId?: string;
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
export class DiArchiveImportService {
  private readonly base = (environment.apiUrl ?? '').replace(/\/+$/, '');

  constructor(private readonly http: HttpClient) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  preview(file: File): Observable<ImportReport> {
    return this.upload(file, true);
  }

  import(file: File): Observable<ImportReport> {
    return this.upload(file, false);
  }

  private upload(file: File, dryRun: boolean): Observable<ImportReport> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ImportReport>(
      `${this.base}/di-archive/import?dryRun=${dryRun}`,
      form,
      { headers: this.authHeaders() },
    );
  }

  downloadTemplate(): void {
    this.http
      .get(`${this.base}/di-archive/import/template`, {
        headers: this.authHeaders(),
        responseType: 'blob',
      })
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modele_import_di_archive.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
  }
}
