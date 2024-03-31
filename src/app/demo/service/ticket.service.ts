import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';
import { CreateDiInput } from '../components/ticket/ticket-list/ticket-list.interface';

@Injectable({
    providedIn: 'root',
})
export class TicketService {
    constructor() {}
    //Ask skander
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
    // query getAllMagasin change with variable
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
                        array_composants {
                            nameComposant
                            quantity
                        }
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
    createDi(diInfo: CreateDiInput) {
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

    createComposant(composantName: string) {
        return gql`
            mutation {
                createComposant(createComposantInput: { name: "${composantName}" }) {
                    _id
                    name
                }
            }
        `;
    }

    getAllComposant() {
        return gql`
            {
                findAllComposant {
                    _id
                    name
                }
            }
        `;
    }

    lapTimeForPauseAndGetBack(_id: string, diagTime: string) {
        return gql`
            mutation {
                lapTimeForPauseAndGetBack(_id: "${_id}", diagTime: "${diagTime}")
            }
        `;
    }

    finish(diagInfo) {
        console.log('🍔[diagInfo]:', diagInfo);
        const array = diagInfo.composant.map((el) => {
            return `{nameComposant: "${el.nameComposant}", quantity: ${el.quantity}}`;
        });

        console.log(` mutation {
            tech_startDiagnostic(
                _id: "${diagInfo._idDi}"
                diag: {
                    remarqueTech: "${diagInfo.remarqueTech}"
                    contain_pdr: ${diagInfo.pdr}
                    can_be_repaired: ${diagInfo.reparable}
                    array_composants: [${array.join(', ')}]
                }
            ) 
        }`);

        return gql`
           mutation {
            tech_startDiagnostic(
                _id: "${diagInfo._idDi}"
                diag: {
                    remarqueTech: "${diagInfo.remarqueTech}"
                    contain_pdr: ${diagInfo.pdr}
                    can_be_repaired: ${diagInfo.reparable}
                    array_composants: [${array.join(', ')}]
                }
            ) 
        }
        `;
    }

    // to populate category , change name by _id
    composantByName(selectedComposant: string) {
        return gql`
            {
                findOneComposant(name: "${selectedComposant}") {
                    _id
                    name
                    package
                    category_composant_id
                    prix_achat
                    prix_vente
                    coming_date
                    link
                    quantity_stocked
                    pdf
                    status
                }
            }
        `;
    }

    updateComposant(composantInfo) {
        return gql`
            mutation {
                addComposantInfo(
                    updateComposant: {    
                        name: "${composantInfo.name}"
                        package: "${composantInfo.package}"
                        category_composant_id: "${composantInfo.category_composant_id}"
                        prix_achat: ${composantInfo.prix_achat}
                        prix_vente: ${composantInfo.prix_vente}
                        coming_date: "${composantInfo.coming_date}"
                        link: "${composantInfo.link}"
                        quantity_stocked: ${composantInfo.quantity_stocked}
                        pdf: "${composantInfo.pdf}"
                        status: "${composantInfo.status}"
                    }
                )
            }
        `;
    }
}
