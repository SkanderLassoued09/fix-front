import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';

@Injectable({
    providedIn: 'root',
})
export class TicketService {
    constructor() {}
    getAllDi() {
        return gql`
            {
                getAllDi(paginationConfig: { first: 0, rows: 10 }) {
                    di {
                        _id
                        title
                        description
                        can_be_repaired
                        bon_de_commande
                        bon_de_livraison
                        contain_pdr
                        status
                        createdAt
                        updatedAt
                        current_roles
                        client_id
                        remarque_id
                        createdBy
                        location_id
                        di_category_id
                    }
                    totalDiCount
                }
            }
        `;
    }

    getAllDiForCoordinator() {
        return gql`
            {
                get_coordinatorDI(paginationConfig: { first: 0, rows: 10 }) {
                    di {
                        _id
                        title
                        description
                        can_be_repaired
                        bon_de_commande
                        bon_de_livraison
                        contain_pdr
                        status
                        createdAt
                        updatedAt
                        current_roles
                        client_id
                        remarque_id
                        createdBy
                        location_id
                        di_category_id
                    }
                    totalDiCount
                }
            }
        `;
    }

    getAllMagasin() {
        return gql`
            {
                getDiForMagasin(paginationConfig: { first: 0, rows: 10 }) {
                    di {
                        _id
                        title
                        description
                        can_be_repaired
                        bon_de_commande
                        bon_de_livraison
                        contain_pdr
                        status
                        createdAt
                        updatedAt
                        current_roles
                        client_id
                        remarque_id
                        createdBy
                        location_id
                        di_category_id
                    }
                    totalDiCount
                }
            }
        `;
    }

    getAllTech() {
        return gql`
            {
                getAllTech {
                    _id
                    firstName
                    lastName
                }
            }
        `;
    }

    configDiagAffectation(_idDi, id_tech_diag) {
        return gql`
            mutation {
                createStat(
                    createStatInput: {
                        
                       
                        _idDi: "${_idDi}"
                        id_tech_diag: "${id_tech_diag}"
                      
                    }
                ) {
                    _idDi
                    messageNotification
                }
            }
        `;
    }
    configRepAffectation(_idDi, id_tech_rep?) {
        return gql`
            mutation {
                affectForDiag(_idDi: "${_idDi}", _idTech: "${id_tech_rep}")
            }
        `;
    }

    diListTech() {
        return gql`
            {
                getDiForTech {
                    _id
                    _idDi
                    id_tech_diag
                    id_tech_rep
                }
            }
        `;
    }

    // TODO
    createDi(diInfo) {
        return gql`
        mutation {
            createDi(
                createDiInput: {
                    title: "${diInfo.title}"
                    designiation: "${diInfo.designiation}"
                    typeClient: "${diInfo.typeClient}"
               
                    status: "${diInfo.status}"
                    client_id: "${diInfo.client_id}"
                    company_id: "${diInfo.company_id}"
                    nSerie: "${diInfo.nSerie}"
                }
            ) {
                _id
            }
        }
    `;
    }

    getCompanies() {
        return gql`
            {
                getAllComapnyforDropDown {
                    _id
                    name
                }
            }
        `;
    }
    getClients() {
        return gql`
            {
                getAllClient {
                    _id
                    first_name
                    last_name
                }
            }
        `;
    }

    tech_startDiagnostic(_idDi) {
        return gql`
            mutation {
                tech_startDiagnostic(_id: "${_idDi}") {
                    _id
                }
            }
        `;
    }
}
