import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';

/**
 * GraphQL operations for the ReunionPV (Procès-Verbal de Réunion) entity.
 *
 * The modal feeds its form values straight into `CreateReunionPVInput`. We
 * pass the whole payload through `$input` so the gql string stays stable
 * even as the schema grows (new optional fields don't need a new template
 * literal each time).
 */
@Injectable({ providedIn: 'root' })
export class ReunionPvService {
    createReunionPV() {
        return gql`
            mutation CreateReunionPV($input: CreateReunionPVInput!) {
                createReunionPV(input: $input) {
                    _id
                    reference
                    titre
                    dateReunion
                    di
                    createdBy
                    statut
                }
            }
        `;
    }

    /** List PVs attached to a DI (used by the future Réunions menu). */
    reunionPVsByDi() {
        return gql`
            query ReunionPVsByDi($diId: String!) {
                reunionPVs(diId: $diId) {
                    _id
                    reference
                    titre
                    dateReunion
                    statut
                    createdBy
                    contexteRetour {
                        niveau
                        motif
                    }
                }
            }
        `;
    }

    /** List all PVs (no filter — backend caps at 200, newest first). */
    reunionPVsAll() {
        return gql`
            query ReunionPVsAll {
                reunionPVs {
                    _id
                    reference
                    titre
                    dateReunion
                    lieu
                    modalite
                    statut
                    di
                    createdBy
                    contexteRetour {
                        niveau
                    }
                    createdAt
                }
            }
        `;
    }

    reunionPVById() {
        return gql`
            query ReunionPVById($id: String!) {
                reunionPV(_id: $id) {
                    _id
                    reference
                    titre
                    objet
                    dateReunion
                    lieu
                    modalite
                    di
                    contexteRetour {
                        niveau
                        motif
                    }
                    createdBy
                    participants {
                        profile
                        statut
                    }
                    ordreDuJour
                    decisions
                    pointsDiscutes {
                        titre
                        contenu
                    }
                    actions {
                        titre
                        description
                        responsable
                        echeance
                        priorite
                        statut
                    }
                    prochaineReunion
                    statut
                    createdAt
                }
            }
        `;
    }
}
