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

    getStatusCount() {
        return gql`
            {
                getStatusCount {
                    status
                    count
                }
            }
        `;
    }

    getAllDi(first, rows) {
        return gql`
            {
                getAllDi(paginationConfig: { first: ${first}, rows: ${rows} }) {
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
                        company_id
                        client_id
                        techRep
                        techDiag
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

    getAllDiForCoordinator(first, rows) {
        return gql`
            {
                get_coordinatorDI(paginationConfig: { first: ${first}, rows: ${rows} }) {
                    di {
                        _id
                        title
                        description
                        ignoreCount
                        can_be_repaired
                        bon_de_commande
                        bon_de_livraison
                        contain_pdr
                        status
                        createdAt
                        updatedAt
                        comment
                        company_id
                        client_id
                        remarque_manager
                        remarque_admin_manager
                        remarque_admin_tech
                        remarque_tech_diagnostic
                        remarque_tech_repair
                        remarque_magasin
                        remarque_coordinator
                        ignoreCount
                        createdBy
                        location_id
                        di_category_id
                        isSentToCoordinator
                        isConfirmedComponentFromCoordinator
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
    getAllMagasin(first, rows) {
        return gql`
            {
                getDiForMagasin(paginationConfig: { first: ${first}, rows: ${rows} }) {
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
                        ignoreCount 
                        array_composants {
                            nameComposant
                            quantity
                            isUpdated 
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

    sendingDiForDiagnostic(
        _idDi: string,
        id_tech_diag: string,
        location: string
    ) {
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

    diListTech(first, rows, startDate?: string, endDate?: string) {
        return gql`
         {
                getDiForTech(    
              
                startDate: "${startDate ?? ''}"
                    endDate: "${endDate ?? ''}",
                paginationConfig: { first: ${first}, rows: ${rows} }) {
                    stat {
                        _id
                        _idDi
                        id_tech_diag
                        ignoreCount
                        id_tech_rep
                        diag_time
                        rep_time
                        status
                        location_id
                         pauseLogs {
                        _id
                        pauseType
                        pauseStart
                        pauseEnd
                    }
                    }
                    totalTechDataCount
                }
            }`;
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
                    di_category_id
                }
            }
        `;
    }

    getStatAndDiInfo(_id: string) {
        return gql`
            {
                getStatInfoForTechReparation(_idDi: "${_id}") {
                    StatData {
                        _id
                        _idDi
                        id_tech_diag
                        diag_time
                        id_tech_rep
                        rep_time
                        location_id
                        status
                        retour_count
                    }
                    diData {
                        _id
                        array_composants {
                            nameComposant
                            quantity
                        }
                    }
                }
            }
        `;
    }

    addLogPause(pauseLogs: any) {
        return gql`mutation {addPauseLog(statId:"${pauseLogs._id}",pauseLog:{pauseType:"${pauseLogs.pauseType}" pauseStart:"${pauseLogs.pauseStart}" }){pauseLogs{pauseType pauseStart }}}
        `;
    }

    updateLogPause(updateLogs) {
        console.log('updateLogs.pauseLogId', updateLogs._idDoc);
        return gql`
            mutation {
                updatePauseLog(
                    statId: "${updateLogs._idStat}"
                    pauseLogId: "${updateLogs._idDoc}"
                    updatedPauseTime: { pauseEnd: "${updateLogs.pauseEnd}" }
                ) {
                    pauseLogs {
                        _id
                        pauseType
                        pauseStart
                        pauseEnd
                    }
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
                    image:"${diInfo.image ?? null}"
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
    addBL(_id: string, pdf: string) {
        return gql`
            mutation {
                addBL(_id: "${_id}", pdf: "${pdf}") {
                    _id
                }
            }
        `;
    }
    addFacture(_id: string, pdf: string) {
        return gql`
            mutation {
                addFacture(_id: "${_id}", pdf: "${pdf}") {
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

        link: string,
        pdf: string
    ) {
        return gql`
            mutation {
                createComposant(
                    createComposantInput: {
                        name: "${composantName}"
                        package: "${packageComposant}"
                
                        link: "${link}"
                        pdf: "${pdf ?? null}"
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

    saveTimeDiag(_id: string, diagTime: string) {
        return gql`
            mutation {
                lapTimeForPauseAndGetBack(_id: "${_id}", diagTime: "${diagTime}")
            }
        `;
    }

    lapTimeForPauseAndGetBackForReaparation(_id: string, repTime: string) {
        console.log('🥡[_id]:', _id);
        console.log('🥫[repTime]:', repTime);
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
        console.log('🍨[remarque]:', remarque);
        console.log('🍲[_idDi]:', _idDi);
        return gql`
            mutation {
                tech_finishReperation(_id: "${_idDi}", remarque: "${remarque}") {
                    status
                }
            }
        `;
    }

    finish(diagInfo) {
        console.log('🍱[diagInfo logs]:', diagInfo);

        const array = diagInfo.composant.map((el) => {
            return `{nameComposant: "${el.nameComposant}", quantity: ${el.quantity}}`;
        });

        return gql`
           mutation {
            tech_startDiagnostic(
                _id: "${diagInfo._idDi}"
                diag: {
                    remarque_tech_diagnostic: "${diagInfo.remarqueTech}"
                    contain_pdr: ${diagInfo.pdr}
                    can_be_repaired: ${diagInfo.reparable}
                    isErrorFromFixtronix: ${diagInfo.isErrorFromFixtronix}
                    di_category_id: "${diagInfo.di_category_id}"
                    array_composants: [${array.join(', ')}]
                }
            ) 
        }
        `;
    }

    getLogsDiById(_idLogsDi: number, _idDi: string) {
        return gql`
            {
                getLigsById(id: "${_idDi}", _idDi:${_idLogsDi}) {
                    _id
                    can_be_repaired
                    contain_pdr
                    stats_id
                    image
                    devis
                    facture
                    bon_de_commande
                    bon_de_livraison
                    price
                    final_price
                    discount
                    discount_value
                    confirmationComposant
                    array_composants {
                        nameComposant
                        quantity
                        isUpdated
                    }
                    status
                }
            }
        `;
    }

    finishLogsDi(diagInfo) {
        console.log('🍌[diagInfo]:', diagInfo);

        const array = diagInfo.composant.map((el) => {
            return `{nameComposant: "${el.nameComposant}", quantity: ${el.quantity}}`;
        });

        return gql`
           mutation {
            tech_startDiagnostic(
                _id: "${diagInfo._idDi}"
                diag: {
                    remarque_tech_diagnostic: "${diagInfo.remarqueTech}"
                    contain_pdr: ${diagInfo.pdr}
                    can_be_repaired: ${diagInfo.reparable}
                    isErrorFromFixtronix: ${diagInfo.isErrorFromFixtronix}
                    di_category_id: "${diagInfo.di_category_id}"
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
                 
                    prix_achat
                    prix_vente
                    coming_date
              status_composant
                }
            }
        `;
    }

    setComposantAsUpdated(_id: string, nameComposant: string) {
        return gql`
        mutation {
            setSelectedComponentAsDone(_id: "${_id}", nameComposant: "${nameComposant}") {
                _id
                array_composants {
                    nameComposant
                    quantity
                    isUpdated
                }
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
        console.log('🥘[_id]:', _id);
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
        console.log('🥦[_id]:', _id);
        return gql`
            mutation {
                changeStatusInRepair(_id: "${_id}")
            }
        `;
    }

    changeStatusRetour1(_id: string) {
        return gql`
            mutation {
                changeStatusRetour1(_id: "${_id}")
            }
        `;
    }
    changeStatusRetour2(_id: string) {
        return gql`
            mutation {
                changeStatusRetour2(_id: "${_id}")
            }
        `;
    }
    changeStatusRetour3(_id: string) {
        return gql`
            mutation {
                changeStatusRetour3(_id: "${_id}")
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
    //     getDiByID(_id: string) {
    //         return gql`
    //     query {
    //       getDiById(_id: "${_id}") {
    //         di{price
    //    isSentToCoordinator
    //    isConfirmedComponentFromCoordinator
    //         array_composants {
    //           nameComposant
    //           quantity
    //         }}
    //       }
    //     }
    //   `;
    //     }

    sentComponentToCoordinatorToConfirm(_id: string) {
        console.log('🍅[_id]:', _id);
        return gql`
            mutation {
                sendComponentToConMagasinForConfirmation(_id: "${_id}") {
                    _id
                    array_composants {
                        nameComposant
                        quantity
                        isUpdated
                    }
                    isSentToCoordinator
                    isConfirmedComponentFromCoordinator
                }
            }
        `;
    }

    componentConfirmedFromCoordinator(_id: string) {
        return gql`
            mutation {
                componentConfirmedFromCoordinator(_id: "${_id}") {
                    _id
                    array_composants {
                        nameComposant
                        quantity
                        isUpdated
                    }
                    isSentToCoordinator
                    isConfirmedComponentFromCoordinator
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

    markAsSeen(_id: string) {
        return gql`
            mutation {
                markAsSeenNotification(_id: "${_id}") {
                    isSeen
                }
            }
        `;
    }

    /**
     *
     *  {getDiById(_id:"DI2"){logsDi{remarque_tech_diagnostic
                    remarque_tech_repair
                    can_be_repaired
                    contain_pdr
                    array_composants {
                        nameComposant
                        quantity
                    }} di{remarque_tech_diagnostic
                    remarque_tech_repair
                    can_be_repaired
                    contain_pdr
                    array_composants {
                        nameComposant
                        quantity
                    }}}}
     *
     */

    getDiById(_id: string) {
        return gql`
            {
                getDiById(_id: "${_id}") {
                    logsDi {
                        _id
                        price
                        idIgnore
                        isSentToCoordinator
   isConfirmedComponentFromCoordinator
                        remarque_tech_diagnostic
                        remarque_tech_repair
                        can_be_repaired
                        contain_pdr
                        array_composants {
                            nameComposant
                            quantity
                        }
                    }
                    di {
                    _id
                    ignoreCount
                        price
                        isSentToCoordinator
   isConfirmedComponentFromCoordinator
                        remarque_tech_diagnostic
                        remarque_tech_repair
                        can_be_repaired
                        contain_pdr
                        array_composants {
                            nameComposant
                            quantity
                        }
                    }
                }
            }
        `;
    }

    getDataOriginalAndRetour(_id: string) {
        return gql`
            {
                getRetourDataStats(_idDi: "${_id}") {
                    _id
                    _idDi
                    id_tech_diag
                    id_tech_rep
                    diag_time
                    rep_time
                    ignoreCount
                }
            }
        `;
    }

    getLogsPause(_idDi: string) {
        return gql`
            {
                getStatByIdlogs(_idDi: "${_idDi}") {
                    id_tech_rep
                    id_tech_diag
                    pauseLogs {
                        pauseType
                        pauseStart
                        pauseEnd
                    }
                }
            }
        `;
    }

    getStatByDI_ID(_idDi: string, _idLog?: number) {
        if (_idLog) {
            return gql`
            query {
                getInfoStatByIdDi(_idDi: "${_idDi}", _idLogs:${_idLog}) {
                    diag_time
                    rep_time
                }
            }
        `;
        } else {
            return gql`
            query {
                getInfoStatByIdDi(_idDi: "${_idDi}") {
                    diag_time
                    rep_time
                }
            }
        `;
        }
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
                    di{gotComposantFromMagasin}
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
                getDiById(_id: "${_idDi}") {
                di {image}
                    
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
      prix_achat: ${composantData.prix_achat}
      prix_vente: ${composantData.prix_vente}
      coming_date: "${composantData.coming_date}"
      link: "${composantData.link}"
      quantity_stocked: ${composantData.quantity_stocked}
      pdf: "${composantData.pdf}"
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
        console.log('🍭[_id]:', _id);
        return gql`
            mutation {
                changeToReparationInPause(_idDI: "${_id}") {
                    _id
                }
            }
        `;
    }

    confirmComposant(
        _id: string,
        confirmMessage: string,
        _idNotification?: string
    ) {
        return gql`
            mutation {
                confirmationComposant(_id: "${_id}", confirmationState: "${confirmMessage}" ,_idNotification:"${_idNotification}") {
                    _id
                    confirmationComposant
                }
            }
        `;
    }

    // logs di
    createLogDi(_id: number, _idDi: string) {
        console.log('🍕[_id]:', _id);
        console.log('🥗[_idDi]:', _idDi);
        return gql`
            mutation {
                createLogsDi(_id: ${_id},_idDi:"${_idDi}") {
                    _id
                }
            }
        `;
    }
}
