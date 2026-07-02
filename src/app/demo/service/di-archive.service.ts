import { Injectable } from '@angular/core';
import gql from 'graphql-tag';

/**
 * GraphQL documents for the `DiArchive` document-upload feature. Parameterized
 * `$variables` (base64 file is passed as a variable, not string-interpolated).
 * Mirrors the `Di` upload flow (base64 data-URL → mutation → updated entity).
 */
@Injectable({ providedIn: 'root' })
export class DiArchiveService {
  private readonly DOC_FIELDS = `
    _id
    title
    clientNom
    societeNom
    refOrigine
    statutCompletude
    statutHistorique
    bc { driveFileId webViewLink name }
    bl { driveFileId webViewLink name }
    devis { driveFileId webViewLink name }
    facture { driveFileId webViewLink name }
    bcRef
    blRef
    devisRef
    factureRef
    validClient
  `;

  diArchiveQuery() {
    return gql`
      query DiArchive($id: String!) {
        diArchive(id: $id) { ${this.DOC_FIELDS} }
      }
    `;
  }

  /** Full archive list for the « Archives DI » page. */
  diArchivesQuery() {
    return gql`
      query DiArchives {
        diArchives { ${this.DOC_FIELDS} }
      }
    `;
  }

  /** Create a manual archive (origin MANUAL) → returns it so the modal can open. */
  createDiArchiveMutation() {
    return gql`
      mutation CreateDiArchive($input: CreateDiArchiveInput!) {
        createDiArchive(createDiArchiveInput: $input) { ${this.DOC_FIELDS} }
      }
    `;
  }

  /** Upload one document (base64 data-URL) → returns the updated archive. */
  uploadDocMutation() {
    return gql`
      mutation UploadDiArchiveDoc(
        $diArchiveId: String!
        $docType: DiArchiveDocType!
        $file: String!
      ) {
        uploadDiArchiveDoc(diArchiveId: $diArchiveId, docType: $docType, file: $file) {
          ${this.DOC_FIELDS}
        }
      }
    `;
  }

  /** Clôture (admin/manager) — COMPLET → CLOTURE. Returns the updated archive. */
  clotureMutation() {
    return gql`
      mutation ClotureDiArchive($diArchiveId: String!) {
        clotureDiArchive(diArchiveId: $diArchiveId) { ${this.DOC_FIELDS} }
      }
    `;
  }

  /** Unlink one document → returns the updated archive. */
  removeDocMutation() {
    return gql`
      mutation RemoveDiArchiveDoc($diArchiveId: String!, $docType: DiArchiveDocType!) {
        removeDiArchiveDoc(diArchiveId: $diArchiveId, docType: $docType) {
          ${this.DOC_FIELDS}
        }
      }
    `;
  }
}
