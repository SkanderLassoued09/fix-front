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
                        facture
                        status
                        createdAt
                        updatedAt
                        image
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

    // add pdf finle finished
    addPdfFile(_id: string, facture: string, bl: string) {
        return gql`
            mutation {
                addPDFFile(_id: "${_id}", facture: "${facture}", bl: "${bl}") {
                    _id
                    bon_de_livraison facture
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

    updateTicket(data: any) {
        return gql`
            mutation {
                updateDi(
                    UpdateDi: { _id: "${data._id}", title: "${data.title}", description: "${data.description}" }
                ) {
                    _id
                }
            }
        `;
    }

    sendingDiForDiagnostic(_idDi, id_tech_diag, location) {
        return gql`
            mutation {
                createStat(
                    createStatInput: {
                        id_tech_diag: "${id_tech_diag}"
                        notificationMessage: "default msg"
                        _idDi: "${_idDi}"
                       
                        location_id:"${location}"
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

    diListTech(startDate?: string, endDate?: string) {
        return gql`
            {
                getDiForTech(
                    startDate: "${startDate ?? ''}"
                    endDate: "${endDate ?? ''}"
                ) {
                    _id
                    _idDi
                    id_tech_diag
                    id_tech_rep
                    diag_time
                    rep_time
                    status
                    location_id 
                }
            }
        `;
    }

    getDataForTech(startDate?: string, endDate?: string) {
        return gql`
            {
                getDiStatusCounts(
                    startDate: "${startDate ?? ''}"
                    endDate: "${endDate ?? ''}"
                ) {
                    status
                    count
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
                    di_category_id:"${diInfo.di_category_id}"
                    location_id:"${diInfo.location}"
                }
            ) {
                _id
            }
        }
    `;
    }

    addDevis(_id: string, pdf: string) {
        return gql`
            mutation {
                addDevis(_id: "${_id}", pdf: "${pdf}") {
                    _id
                }
            }
        `;
    }
    addBC(_id: string, pdf: string) {
        return gql`
            mutation {
                addBC(_id: "${_id}", pdf: "${pdf}") {
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

    changeFinishStatus(_id: string) {
        return gql`
            mutation {
                changestatusToFinishReparation(_id: "${_id}") {
                    status
                }
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

    getDiById(_id: string) {
        return gql`
            {
                getDiById(_id: "${_id}") {
                    remarque_tech_diagnostic
                    can_be_repaired
                    contain_pdr
                    array_composants {
                        nameComposant
                        quantity
                    }
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

    deleteLocation(_id: string) {
        return gql`
            mutation {
                removeLocation(_id: "${_id}")
            }
        `;
    }
    addLocation(
        location_name: string

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
                    }
                ) {
                    _id
                    location_name
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
                }
            }
        `;
    }
    getAllLocationWithInfo() {
        return gql`
            query {
                findAllLocation {
                    _id
                    location_name
                    max_capacity
                    current_item_stored
                    avaible
                }
            }
        `;
    }
    getImageforDI(_idDi: string) {
        return gql`
            query {
                getDiById(_id: "DI0") {
                    image
                }
            }
        `;
    }

    removeCategory(_id: string) {
        return gql`
            mutation {
                removeDiCategory(_id: "${_id}")
            }
        `;
    }

    addComposantMagasin(composantData: any) {
        return gql`
       mutation {
  createComposant(
    createComposantInput: {
      name: "${composantData.name}"
      package: "${composantData.packageComposant}"
      category_composant_id: "${composantData.category_composant_id}"
      prix_achat: ${composantData.prix_achat}
      prix_vente: ${composantData.prix_vente}
      coming_date: "${composantData.coming_date}"
      link: "${composantData.link}"
      quantity_stocked: ${composantData.quantity_stocked}
      pdf: "${composantData.pdf.image}"
      status_composant: "${composantData.status}"
    }
  ) {
    _id
  }
}`;
    }

    diDiagnostiqueInPAUSE(_id: string) {
        return gql`
            mutation {
                changeToDiagnosticInPause(_idDI: "${_id}") {
                    _id
                    status
                }
            }
        `;
    }
    diReperationInPAUSE(_id: string) {
        return gql`
            mutation {
                changeToReparationInPause(_idDI: "${_id}") {
                    _id
                }
            }
        `;
    }
}
