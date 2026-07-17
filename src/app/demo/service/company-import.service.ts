import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

/**
 * Client REST pour l'export / import xlsx des sociétés
 * (`GET /company/export`, `GET /company/export/:id`,
 *  `GET /company/import/template`, `POST /company/import?dryRun=`).
 * Même contrat de rapport que l'import DiArchive, enrichi (créer / màj / action).
 */

export type LigneStatut = 'valide' | 'avertissement' | 'erreur';
export type LigneAction = 'create' | 'update' | null;
export interface ImportLigne {
  ligne: number;
  statut: LigneStatut;
  action: LigneAction;
  valeurs: Record<string, string>;
  motifs: string[];
}
export interface ImportError {
  ligne: number;
  valeurs: Record<string, string>;
  motifs: string[];
}
export interface ImportReport {
  ligneEnTete: number | null;
  total: number;
  valides: number;
  aCreer: number;
  aMettreAJour: number;
  warnings: { ligne: number; message: string }[];
  erreurs: ImportError[];
  lignes: ImportLigne[];
  enTeteInvalide?: boolean;
  crees?: { crees: number; majs: number; erreurs: number };
}

@Injectable({ providedIn: 'root' })
export class CompanyImportService {
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
      `${this.base}/company/import?dryRun=${dryRun}`,
      form,
      { headers: this.authHeaders() },
    );
  }

  downloadTemplate(): void {
    this.download(
      `${this.base}/company/import/template`,
      'modele_import_societes.xlsx',
    );
  }

  /** Export de toutes les sociétés. */
  exportAll(): void {
    this.download(`${this.base}/company/export`, 'societes.xlsx');
  }

  /** Export d'une seule société. */
  exportOne(id: string, label?: string): void {
    const safe = (label ?? id).replace(/[^\w\-]+/g, '_').slice(0, 40);
    this.download(`${this.base}/company/export/${id}`, `societe_${safe}.xlsx`);
  }

  private download(url: string, filename: string): void {
    this.http
      .get(url, { headers: this.authHeaders(), responseType: 'blob' })
      .subscribe((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      });
  }
}
