import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';
import { CreateDiInput } from '../components/ticket/ticket-list/ticket-list.interface';
import { di } from '@fullcalendar/core/internal-common';
import { ReturnStatement } from '@angular/compiler';

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
                        remarque_tech_diagnostic
                        createdBy
                        ignoreCount
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

    deleteDi(_id: string) {
        return gql`
            mutation {
                deleteDi(_id: "${_id}") {
                    _id
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
                        comment
                        client_id
                        remarque_manager
                        remarque_admin_manager
                        remarque_admin_tech
                        remarque_tech_diagnostic
                        remarque_tech_repair
                        remarque_magasin
                        remarque_coordinator
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
                    status
                }
            }
        `;
    }

    getAllRemarque(_id: string) {
        return gql`
            {
                getAllRemarque(_id: "${_id}") {
                    remarque_manager
                    remarque_magasin
                    remarque_admin_tech
                    remarque_tech_repair
                    remarque_coordinator
                    remarque_admin_manager
                    remarque_tech_diagnostic
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
                    remarque_manager: "${diInfo.remarqueManager}"
                    image:"${diInfo.image}"
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
    createComposantByTech(
        composantName: string,
        packageComposant: string,
        category_composant_id: string,
        link: string,
        pdf: string
    ) {
        return gql`
            mutation {
                createComposant(
                    createComposantInput: {
                        name: "${composantName}"
                        package: "${packageComposant}"
                        category_composant_id:"${category_composant_id}"
                        link: "${link}"
                        pdf: "${pdf}"
                    }
                ) {
                    _id
                }
            }
        `;
    }

    removeComposant(_id: string) {
        return gql`
        mutation {
            removeComposant(_id: "${_id}")
        }
    `;
    }

    getAllComposant() {
        return gql`
            {
                findAllComposant {
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
                    status_composant
                }
            }
        `;
    }

    lapTimeForPauseAndGetBack(_id: string, diagTime: string) {
        console.log('🍢[diagTime]:', diagTime);
        console.log('🌽[_id]:', _id);
        return gql`
            mutation {
                lapTimeForPauseAndGetBack(_id: "${_id}", diagTime: "${diagTime}")
            }
        `;
    }

    lapTimeForPauseAndGetBackForReaparation(_id: string, repTime: string) {
        console.log('🥧[repTime]:', repTime);
        console.log('🍝[_id]:', _id);
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
                tech_finishReperation(_id: "${_idDi}", remarque: "${remarque}") {
                    status
                }
            }
        `;
    }

    finish(diagInfo) {
        console.log(diagInfo);
        const array = diagInfo.composant.map((el) => {
            return `{nameComposant: "${el.nameComposant}", quantity: ${el.quantity}}`;
        });

        console.log(` mutation {
            tech_startDiagnostic(
                _id: "${diagInfo._idDi}"
                diag: {
                    remarque_tech_diagnostic: "${diagInfo.remarqueTech}"
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
                    remarque_tech_diagnostic: "${diagInfo.remarqueTech}"
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
                    status_composant
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
              status_composant
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
                        status_composant: "${composantInfo.status_composant}"
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
    status_composant
    
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

    getLastPauseTime(_idStat: string) {
        return gql`
            {
                getLastPauseTime(_id: "${_idStat}") {
                    diag_time
                    rep_time
                }
            }
        `;
    }

    ignore(_id) {
        return gql`
            mutation {
                countIgnore(_idDI: "${_id}") {
                    ignoreCount
                }
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

    changeStatusRetour(_id: string) {
        return gql`
            mutation {
                changeStatusRetour(_id: "${_id}")
            }
        `;
    }

    changeToPending1(_id: string) {
        return gql`
            mutation {
                changeToPending1(_id: "${_id}")
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

    getStatbyID(_idSTAT: string) {
        return gql`
            query {
                getStatbyID(_idSTAT:"${_idSTAT}") 
                {
                    _idDi
                }
            }
        `;
    }

    getStatByDI_ID(_idDi: string) {
        return gql`
            query {
                getInfoStatByIdDi(_idDi: "${_idDi}") {
                    diag_time
                    rep_time
                }
            }
        `;
    }
    confirmerRecoitComposant(_idDI: string) {
        return gql`
            mutation {
                confirmerRecoitComposant(_idDI: "${_idDI}") 
                {
                    _id
                }
            }
        `;
    }

    responseConfirmerRecoitComposant(_idDI: string) {
        return gql`
            mutation {
                responseConfirmerRecoitComposant(_idDI: "") {
                    gotComposantFromMagasin
                }
            }
        `;
    }

    getReperationCoordinatorCondition(_idDi: string) {
        return gql`
            query {
                getDiById(_id: "${_idDi}") {
                    gotComposantFromMagasin
                }
            }
        `;
    }
    getTechTarif() {
        return gql`
            query {
                getTarif {
                    tarif
                }
            }
        `;
    }
    affectNewTarif(tarifForTechs: number) {
        return gql`
        mutation {
            createTarif(
        createTarifInput: 
            { tarif: ${tarifForTechs} }) 
             {
                tarif
            }
        }
    `;
    }
    //!CRUD
    addCatgoryDi(category: string) {
        return gql`
            mutation {
                createDiCategory(category: "${category}") {
                    _id
                    category
                }
            }
        `;
    }
    addLocation(
        location_name: string,
        location_number: number
        // max_capacity: number,
        // avaible: boolean
    ) {
        return gql`
            mutation {
                createLocation(
                    createLocationInput: 
                    { 
                        _id: " ok", 
                        location_name: "${location_name}",
                        location_number:${location_number}
                    }
                ) {
                    _id
                    location_name
                    location_number
                    max_capacity
                    current_item_stored
                    avaible
                }
            }
        `;
    }

    getAllDiCategory() {
        return gql`
            query {
                findAllDiCategory {
                    _id
                    category
                }
            }
        `;
    }
    getAllLocation() {
        return gql`
            query {
                findAllLocation {
                    _id
                    location_name
                    location_number
                }
            }
        `;
    }
}
