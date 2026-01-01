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

    getAllDi(first, rows, startDate?: any, endDate?: any) {
        console.log('🍨[endDate]:', endDate);
        console.log('🍌[startDate]:', startDate);
        return gql`{
    getAllDi(
        paginationConfig: { first: ${first}, rows: ${rows} }, 
        filterConfig: { startDate: "${
            startDate ? startDate : null
        }", endDate: "${endDate ? endDate : null}" }
    ) {
        di {
            _id
            _idnum
            final_price
            price
            title
            description
            can_be_repaired
            bon_de_commande
            bon_de_livraison
            contain_pdr
            facture
            devis
            status
            createdAt
            updatedAt
            image
            isErrorFromFixtronix
            company_id
            client_id
            techRep
            techDiag
            remarque_tech_diagnostic
            remarque_tech_repair
            remarque_manager
            createdBy
            ignoreCount
            location_id
            di_category_id
            logs {
                idIgnore
                facture
            }
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
                        price
                        final_price
                        title
                        description
                        ignoreCount
                        can_be_repaired
                        bon_de_commande
                        bon_de_livraison
                        contain_pdr
                        status
                        techRep
                        techDiag
                        createdAt
                        updatedAt
                        comment
                             array_composants {
                            nameComposant
                            quantity
                            isUpdated 
                        }
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
                        handleSendingNotificationBetweenCoordinatorAndMagasin
                        logs{idIgnore isSentToCoordinator isConfirmedComponentFromCoordinator handleSendingNotificationBetweenCoordinatorAndMagasin}
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

    changeStatusToFinished(_id: string) {
        return gql`
        mutation{
        changestatusToFinishReparation(_id:"${_id}")
        {
            _id
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

    getLogsDi(_id: string) {
        return gql`
            {
                getAllLogsByDi(_idDi: "${_id}") {
                    _id
                    idIgnore
                    can_be_repaired
                    bon_de_commande
                    bon_de_livraison
                    facture
                    devis
                    contain_pdr
                    status
                    createdAt
                    updatedAt
                    remarque_tech_diagnostic
                    remarque_tech_repair
                    remarque_manager
                    price
                    isErrorFromFixtronix
                    final_price
                    array_composants {
                        nameComposant
                        quantity
                        isUpdated
                    }
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
                    UpdateDi: { _id: "${data._id}", title: "${data.title}", description: "${data.description}",remarque_manager: "${data.remarque_manager}" }
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

    findLocationById(locationId: string) {
        return gql`
            {
              findOneLocation(_id:"${locationId}"){_id location_name}
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
                    description
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
                    description: "${diInfo.description}"
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
                addBl(_id: "${_id}", pdf: "${pdf}") {
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
                        pdf: "${pdf ?? null}"
                    }
                ) {
                    _id
                    name
                    package
                    category_composant_id
                    link
                    pdf
                }
            }
        `;
    }

    removeComposant(_id: string) {
        return gql`
           mutation {
            removeComposant(_id: "${_id}"){_id isDeleted}
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

    searchComposants(name) {
        return gql`
            {
                searchComposants(name: "${name}") {
                    _id
                    name
                 
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
                    isErrorFromFixtronix
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
    nego1nego2_InMagasin_noFinalPrice(_id: string, price: number) {
        return gql`
            mutation {
                managerAdminManager_InMagasin(
                    _id: "${_id}"
                    price: ${price}
                    final_price: ${price}
                ) {
                    price
                    final_price
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

    addNewCategoryComposant(nameCategoryComponent: string) {
        return gql`
            mutation {
                createComposant_Category(
                    createComposant_CategoryInput: {
                        category_composant: "${nameCategoryComponent}"
                    }
                ) {
                    _id
                    category_composant
                }
            }
        
            `;
    }

    updateComposant(composantInfo) {
        console.log('🍬[composantInfo]:', composantInfo);
        console.log('🍬[composantInfo statusstatus]:', composantInfo.status);
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
                        status_composant: "${
                            composantInfo.status ||
                            composantInfo.status_composant
                        }"
                        category_composant_id: "${
                            composantInfo.category_composant_id
                        }"
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

    findAllComposant_Category() {
        return gql`
            {
                findAllComposant_Category {
                    _id
                    category_composant
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

    sentComponentToCoordinatorToConfirm(_id: string) {
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
                    handleSendingNotificationBetweenCoordinatorAndMagasin
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
                    handleSendingNotificationBetweenCoordinatorAndMagasin
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

    getDiById(_id: string) {
        return gql`
            {
                getDiById(_id: "${_id}") {
                    logsDi {
                        _id
                        price
                        idIgnore
                        final_price
                        isSentToCoordinator
                        isConfirmedComponentFromCoordinator
                        remarque_tech_diagnostic
                        remarque_tech_repair
                        can_be_repaired
                        di_category_id
                        contain_pdr
                        isErrorFromFixtronix
                        devis
                        handleSendingNotificationBetweenCoordinatorAndMagasin
                        bon_de_commande
                        array_composants {
                            nameComposant
                            quantity
                        }
                    }
                    di {
                        _id
                        _idnum
                        ignoreCount
                        di_category_id
                        price
                        handleSendingNotificationBetweenCoordinatorAndMagasin
                        final_price
                        isSentToCoordinator
                        di_category_id
                        isConfirmedComponentFromCoordinator
                        remarque_tech_diagnostic
                        remarque_tech_repair
                        can_be_repaired
                        devis
                        bon_de_commande
                        contain_pdr
                        image
                        nSerie
                        location_id
                        description
                        array_composants {
                            nameComposant
                            quantity
                        }
                        isErrorFromFixtronix
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
        console.log(_id, 'çf');
        return gql`
            mutation {
                removeLocation(_id: "${_id}")
            {isDeleted}
            }
        `;
    }
    removeComposant_Category(_id: string) {
        console.log('🍢[_id]:', _id);
        return gql`
            mutation {
                removeComposant_Category(_id: "${_id}"){isDeleted}
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
                removeDiCategory(_id: "${_id}") {
                    _id
                    category
                    isDeleted
                }
            }
        `;
    }

    addComposantMagasin(composantData: any) {
        console.log('🍖[composantData]:', composantData);
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
      category_composant_id: "${composantData.category_composant_id}"
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
        return gql`
            mutation {
                createLogsDi(_id: ${_id},_idDi:"${_idDi}") {
                    _id
                }
            }
        `;
    }
}
