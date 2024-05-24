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

    sendingDiForDiagnostic(_idDi, id_tech_diag) {
        return gql`
            mutation {
                createStat(
                    createStatInput: {
                        id_tech_diag: "${id_tech_diag}"
                        notificationMessage: "default msg"
                        _idDi: "${_idDi}"
                    }
                ) {
                    _idDi
                    messageNotification
                    id_tech_diag
                }
            }
        `;
    }

    configRepAffectation(_idDi, id_tech_rep?) {
        return gql`
            mutation {
                affectForRep(_idDi: "${_idDi}", _idTech: "${id_tech_rep}")
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

    createDi(diInfo: CreateDiInput) {
        console.log('🍭[diInfo]:', diInfo);
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

    tech_startDiagnostic(_idDi: string) {
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

    lapTimeForPauseAndGetBackForReaparation(_id: string, repTime: string) {
        return gql`
            mutation {
                lapTimeForPauseAndGetBackForReaparation(
                    _id: "${_id}"
                    repTime: "${repTime}"
                )
            }
        `;
    }

    finishReparation(_idDi, remarque) {
        return gql`
            mutation {
                tech_finishReperation(_id: "${_idDi}", remarque: "${remarque}")
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

    nego1nego2_InMagasin(_id: string, price: number, final_price: number) {
        return gql`
            mutation {
                managerAdminManager_InMagasin(
                    _id: "${_id}"
                    price: ${price}
                    final_price: ${final_price}
                ) {
                    price
                    final_price
                }
            }
        `;
    }

    composantByName_forAdmin(selectedComposant: string) {
        return gql`
            {
                findOneComposant(name: "${selectedComposant}") {
                    _id
                    name
                    category_composant_id
                    prix_achat
                    prix_vente
                    coming_date
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
                 {
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

    totalComposant(_id: string) {
        return gql`
            {
                calculateTicketComposantPrice(_id: "${_id}")
            }
        `;
    }

    /**
     * Change DI status section
     */

    changeStatusDiToPending1(_id: string) {
        return gql`
            mutation {
                changeStatusPending1(_id: "${_id}")
            }
        `;
    }
    changeStatusDiToInDiagnostique(_id: string) {
        return gql`
            mutation {
                changeStatusInDiagnostic(_id: "${_id}")
            }
        `;
    }

    changeStatusDiToDiagnostique(_id: string) {
        return gql`
            mutation {
                coordinatorSendingDiDiag(_idDI: "${_id}") 
                {
                    _id
                }
            }
        `;
    }
    changeStatusDiToInMagasin(_id: string) {
        return gql`
            mutation {
                changeStatusInMagasin(_id: "${_id}")
            }
        `;
    }
    changeStatusMagasinEstimation(_id: string) {
        return gql`
            mutation {
                changeStatusMagasinEstimation(_id: "${_id}")
            }
        `;
    }
    changeStatusDiToPending2(_id: string) {
        return gql`
            mutation {
                changeStatusPending2(_id: "${_id}")
            }
        `;
    }
    changeStatusPricing(_id: string) {
        return gql`
            mutation {
                changeStatusPricing(_id: "${_id}")
            }
        `;
    }
    changeStatusNegociate1(_id: string) {
        return gql`
            mutation {
                changeStatusNegociate1(_id: "${_id}")
            }
        `;
    }
    changeStatusNegociate2(_id: string) {
        return gql`
            mutation {
                changeStatusNegociate2(_id: "${_id}")
            }
        `;
    }
    changeStatusPending3(_id: string) {
        console.log('🥦[_id]:', _id);
        return gql`
            mutation {
                changeStatusPending3(_id: "${_id}")
            }
        `;
    }

    pricing(_id: string, price: number) {
        return gql`
            mutation {
                affectinitialPrice(_id: "${_id}", price: ${price})
            }
        `;
    }

    changeStatusRepaire(_id: string) {
        return gql`
            mutation {
                changeStatusRepaire(_id: "${_id}")
            }
        `;
    }
    changeStatusInRepair(_id: string) {
        return gql`
            mutation {
                changeStatusInRepair(_id: "${_id}")
            }
        `;
    }
    getDiByID(_id: string) {
        return gql`
    query {
      getDiById(_id: "${_id}") {
        price
        array_composants {
          nameComposant
          quantity
        }
      }
    }
  `;
    }
}
