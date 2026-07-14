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

    /**
     * Phase-2 "document the meeting" write: fills the detailed sections from the
     * detail modal (ordre du jour, points, décisions, actions, 5M) and pushes
     * each action to Jira on the backend. `actions[]._id` is echoed for existing
     * actions so Jira updates the same issue instead of duplicating.
     */
    updateReunionPVDetails() {
        return gql`
            mutation UpdateReunionPVDetails($input: UpdateReunionPVDetailsInput!) {
                updateReunionPVDetails(input: $input) {
                    _id
                    reference
                    statut
                    ordreDuJour
                    decisions
                    pointsDiscutes {
                        titre
                        contenu
                    }
                    actions {
                        _id
                        titre
                        description
                        responsable
                        echeance
                        priorite
                        statut
                        jira {
                            synced
                            issueKey
                            url
                            assignFailed
                        }
                    }
                    ishikawa {
                        probleme
                        familles {
                            key
                            label
                            causes {
                                label
                                detail
                                custom
                            }
                        }
                    }
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
                        _id
                        titre
                        description
                        responsable
                        echeance
                        priorite
                        statut
                        jira {
                            synced
                            issueKey
                            url
                            assignFailed
                        }
                    }
                    ishikawa {
                        probleme
                        familles {
                            key
                            label
                            causes {
                                label
                                detail
                                custom
                            }
                        }
                    }
                    prochaineReunion
                    statut
                    createdAt
                }
            }
        `;
    }
}
