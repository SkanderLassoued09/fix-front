import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Product } from 'src/app/demo/api/product';

import {
    MessageService,
    PrimeNGConfig,
    ConfirmationService,
} from 'primeng/api';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { STATUS_DI } from 'src/app/layout/api/status-di';
import {
    AbstractControl,
    FormControl,
    FormGroup,
    ValidationErrors,
    ValidatorFn,
    Validators,
} from '@angular/forms';
import {
    CreateDiMutationResult,
    DiQueryResult,
    GetClientsQueryResult,
    GetCompaniesQueryResult,
} from './ticket-list.interface';
import * as FileSaver from 'file-saver';
import { NotificationService } from 'src/app/demo/service/notification.service';
import { PageEvent } from '../../profile/profile-list/profile-list.interfaces';
import { map, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

interface Column {
    field: string;
    header: string;
}

interface UploadEvent {
    originalEvent: Event;
    files: File[];
}

function noSpecialCharactersValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const regex = /["'<>]/;
        return regex.test(control.value) ? { specialCharacters: true } : null;
    };
}

@Component({
    selector: 'app-ticket-list',
    standalone: false,
    templateUrl: './ticket-list.component.html',
    styleUrl: './ticket-list.component.scss',
})
export class TicketListComponent implements OnInit {
    baseUrl = environment.apiUrl;

    ticketSelected: any;
    openUpdateModal: boolean = false;
    // Add these boolean flags to your component class
    isBCUploaded: boolean = false;
    isDevisUploaded: boolean = false;
    ticketData: any;

    // Used for the mini Dashboard
    counterInMagasin = 0;
    counterInDiagnostique = 0;
    counterInReperation = 0;
    counterPending = 0;
    counterRetour = 0;

    filsFinished: boolean = false;
    creationDiForm = new FormGroup({
        title: new FormControl('', [
            Validators.required,
            Validators.pattern(/^[a-zA-Z0-9\s]+$/),
        ]),
        description: new FormControl('', [Validators.required]),
        typeClient: new FormControl(),
        status: new FormControl(),
        client_id: new FormControl(),
        company_id: new FormControl(),
        nSerie: new FormControl(),
        category: new FormControl(),
        location: new FormControl(),
        remarqueManager: new FormControl(),
    });
    updateDiForm = new FormGroup({
        title: new FormControl('', [Validators.required]),
        description: new FormControl('', [Validators.required]),
        typeClient: new FormControl(),
        status: new FormControl(),
        client_id: new FormControl(),
        company_id: new FormControl(),
        nSerie: new FormControl(),
        category: new FormControl(),
        location: new FormControl(),
        remarqueManager: new FormControl(),
    });
    tarif_Techs = new FormGroup({
        tarifFromAdmin: new FormControl(),
    });
    //ADD category CRUD
    categoryForm = new FormGroup({
        categoryName: new FormControl(),
    });
    //ADD location CRUD
    locationForm = new FormGroup({
        locationName: new FormControl(),
    });
    statuses = [
        { label: 'Created', value: 'CREATED' },
        { label: 'Pending1', value: 'PENDING1' },
        { label: 'Diagnostic', value: 'DIAGNOSTIC' },
        { label: 'Indiagnostic', value: 'INDIAGNOSTIC' },
        { label: 'Inmagasin', value: 'INMAGASIN' },
        { label: 'Pending2', value: 'PENDING2' },
        { label: 'Pricing', value: 'PRICING' },
        { label: 'Negotiation1', value: 'NEGOTIATION1' },
        { label: 'Negotiation2', value: 'NEGOTIATION2' },
        { label: 'Pending3', value: 'PENDING3' },
        { label: 'Reparation', value: 'REPARATION' },
        { label: 'Inreparation', value: 'INREPARATION' },
        { label: 'Finished', value: 'FINISHED' },
        { label: 'Annuler', value: 'ANNULER' },
        { label: 'Retour1', value: 'RETOUR1' },
        { label: 'Retour2', value: 'RETOUR2' },
        { label: 'Retour3', value: 'RETOUR3' },
    ];

    // You can use the statuses array in your code wherever needed
    files = [];

    totalSize: number = 0;

    totalSizePercent: number = 0;
    sizes = [
        { name: 'Small', class: 'p-datatable-sm' },
        { name: 'Normal', class: '' },
        { name: 'Large', class: 'p-datatable-lg' },
    ];
    openAddDiModal: boolean = false;
    openCategoryModal: boolean = false;
    openLocationsModal: boolean = false;
    openPriceTechModal: boolean = false;

    radioBtn;
    selectedStatusDefault;
    // these button to distignuye betwwen di to coordinator or not cooredinator
    stateOptions: any[] = [
        { label: 'Sauvgarder', value: 'CREATED' }, // value : status
        { label: 'Sauvgarder et envoyer', value: 'PENDING1' }, // value : status
    ];
    statusDefault = [
        { name: 'sans affecter au coordinateur', code: 'CREATED' },
        { name: 'Affecter au coordinateur', code: 'PENDING1' },
    ];
    products!: Product[];
    loading: boolean = false;
    roles;
    tstatuses = [{ label: 'Pending3', value: 'Pending3' }];

    ingredient;
    uploadedFiles: any[] = [];
    cols = [
        { field: '_id', header: 'DI id' },
        { field: 'title', header: 'Titre' },
        { field: 'image', header: 'Image' },
        { field: 'location_id', header: 'Location' },
        { field: 'status', header: 'Status' },
        { field: 'company_id', header: 'Company' },
        { field: 'client_id', header: 'Client' },
        { field: 'createdBy', header: 'Créer par' },
        { field: 'techDiag', header: 'Diagnostique' },
        { field: 'techRep', header: 'Reparation' },
    ];

    colCategory = [{ field: 'category_name', name: 'Name' }];

    colEmplacement = [{ field: 'location_name', name: 'Emplacement' }];

    diList: any[];
    diListCount: any;
    statusDI: STATUS_DI = STATUS_DI.CREATED;
    clientListDropDown: any;
    companiesListDropDown: any;
    loadingCreatingDi: boolean;
    pricingModal: boolean = false;
    discountPercent: number = 0;
    totalComposant: any;
    array_composants: any;
    _idDi: any;
    price: number;
    seletedRow: any;
    discountedPriceNeg: number = 0;
    slideEnd: any;
    slideAdminEnd: any;
    negocite1Modal: boolean;
    negocite2Modal: boolean = false;
    s: any;
    secondNegocition: any;
    slectedRow: any;
    exportColumns: any;
    selectedSize;
    data_discount: DiQueryResult;
    dataById: any;
    finalPrice: any;
    allComposants = [];
    number_total_composant: number = this.allComposants.length;
    private _idcomposant: any;
    name_composant: any;
    ArrayofcomposantDATA: DiQueryResult;
    oneComposant_QueryValue: DiQueryResult;
    $composant: any;
    current_id: any;
    timeDiagnostique: string;
    ignoreCount: any;
    composantQuantity: number;
    tarif_Tech: number;
    allCategoryDiArray: any;
    // payloadBonCommande: { pdf: string };
    locationDropDown: any[];
    categorieDiListDropDown: any[];
    timepart: { hours: any; minutes: any; seconds: any };
    facturationDiagnostique: number = 0;
    tarif_Technicien: number;
    payload: { file: string } = { file: '' };

    facturePDF: { file: string };
    blPDF: { file: string };
    private _idPDFFinished: string;
    ticketDetailsInfo: boolean;
    selectedTicket: any;
    updateticketView: boolean;
    selectedRowInNegociate1: any;
    selectedRowInNegociate2: any;
    first: number = 0;
    rows: number = 10;
    page: any;
    uploadFileLoading: boolean;
    statusCount: any[];
    basicOptions: any;
    basicData: any;
    selectedBc: any;
    selectedDevis: any;
    selectedBL: string;
    selectedFacture: string;
    ignoreCountNeg1: any;
    logsDi: any;
    finishedData: any;
    filesSelected: any;
    isErrorFromFixtronix: any;
    ignoreCountPricing: number;
    instantSelectedBc: string;
    instantSelectedDevis: string;
    ignoreCountN1: any;
    bcUploaded: boolean;
    devisUploaded: boolean;
    initialPriceAffichage: any;
    priceRemiseAffichage: any;
    remiseAffichage: any;
    retourNumberAffichage: any;
    devisBtnDisabled: boolean = false;
    bcBtnDisabled: boolean = false;
    factureBtnDisabled: boolean = false;
    blBtnDisabled: boolean = false;
    enregistrerBlBtncondition: boolean = true;
    enregistrerFactureBtncondition: boolean = true;
    enregistrerBcBtncondition: boolean = true;
    enregistrerDevisBtncondition: boolean = true;
    ignoreCountForBtns: number = 0;
    modalRetour1Info: boolean=false;
    retourInfoFromLogs: any;

    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private cdr: ChangeDetectorRef,
        private readonly messageservice: MessageService,
        private readonly notificationService: NotificationService,
        private config: PrimeNGConfig,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.getStatusCount();
        this.getDi(this.first, this.rows);
        this.getCompanyList();
        this.getClientList();
        this.allCategoryDi();
        this.getLocationList();
        this.notificationService.startWorker();
        this.notificationService.notification$.subscribe((message: any) => {
            if (message) {
                this.getDi(this.first, this.rows);
                this.getStatusCount();
            }
        });
    }
    blockSpecialCharacters(event: KeyboardEvent): void {
        const invalidCharacters = ['"', "'"];
        if (invalidCharacters.includes(event.key)) {
            event.preventDefault(); // Prevent the character from being typed
        }
    }
    showDialogDiCreation() {
        this.openAddDiModal = true;
    }
    updateDi(rowDataTicket: any) {
        this.selectedTicket = rowDataTicket ?? {}; // Populate selected ticket details
        this.updateticketView = true; // Open the update modal
    }
    infoRetour1(){
        this.modalRetour1Info = true
        console.log(this.retourInfoFromLogs[0],"this.retourInfoFromLogs R1");
         

    }
    cancelUpdateDi() {
        this.openUpdateModal = false;
    }
    showDialogCategoryDI() {
        this.openCategoryModal = true;
    }
    showDialogLocations() {
        this.openLocationsModal = true;
    }

    saveUpdateTicket() {
        const { _id, title, description } = this.selectedTicket;
        const extractedData = { _id, title, description };

        // Call your mutation service to update the ticket
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.updateTicket(extractedData),
            })
            .subscribe(({ data }) => {
                if (data) {
                    // If the ticket ID exists, update the list with the modified ticket details
                    if (this.selectedTicket._id) {
                        this.diList[
                            this.findIndexById(this.selectedTicket._id)
                        ] = this.selectedTicket;

                        // Show success message
                        this.messageservice.add({
                            severity: 'success',
                            summary: 'Success',
                            detail: 'The ticket has been successfully updated',
                        });
                        this.openUpdateModal = false; // Close the modal after successful update
                    }
                }
            });
    }

    findIndexById(_id: string): number {
        let index = -1;
        for (let i = 0; i < this.diList.length; i++) {
            if (this.diList[i]._id === _id) {
                index = i;
                break;
            }
        }
        return index;
    }

    showDialogPriceTech() {
        this.openPriceTechModal = true;
        this.apollo
            .query<any>({
                query: this.ticketSerice.getTechTarif(),
            })
            .subscribe(({ data }) => {
                this.tarif_Tech = data.getTarif.tarif;
            });
    }
    //! MUTATION WORKING ON
    confirmerTarifs() {
        this.tarif_Techs.value;

        const { tarifFromAdmin } = this.tarif_Techs.value;
        const tarifForTechs = tarifFromAdmin;
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.affectNewTarif(tarifForTechs),
            })
            .subscribe(({ data }) => {});
        this.apollo
            .query<any>({
                query: this.ticketSerice.getTechTarif(),
            })
            .subscribe(({ data }) => {
                this.tarif_Tech = data.getTarif.tarif;
            });
        this.openPriceTechModal = false;
    }

    getStatusCount() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue(
            '--text-color-secondary'
        );
        const surfaceBorder =
            documentStyle.getPropertyValue('--surface-border');
        this.apollo
            .query<any>({
                query: this.ticketSerice.getStatusCount(),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.statusCount = data.getStatusCount;
                    this.basicData = {
                        labels: this.statusCount.map((el) => el.status),
                        datasets: [
                            {
                                label: 'Di',
                                data: this.statusCount.map((el) => el.count),
                                backgroundColor: [
                                    'rgba(255, 159, 64, 0.2)',
                                    'rgba(75, 192, 192, 0.2)',
                                    'rgba(54, 162, 235, 0.2)',
                                    'rgba(153, 102, 255, 0.2)',
                                ],
                                borderColor: [
                                    'rgb(255, 159, 64)',
                                    'rgb(75, 192, 192)',
                                    'rgb(54, 162, 235)',
                                    'rgb(153, 102, 255)',
                                ],
                                borderWidth: 1,
                            },
                        ],
                    };
                    this.basicOptions = {
                        plugins: {
                            legend: {
                                labels: {
                                    color: textColor,
                                },
                            },
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: textColorSecondary,
                                    stepSize: 1, // Ensures the interval is 1
                                    callback: (value: number) =>
                                        value.toFixed(0), // Show whole numbers only
                                },
                                grid: {
                                    color: surfaceBorder,
                                    drawBorder: false,
                                },
                            },
                            x: {
                                ticks: {
                                    color: textColorSecondary,
                                },
                                grid: {
                                    color: surfaceBorder,
                                    drawBorder: false,
                                },
                            },
                        },
                    };
                }
            });
    }

    confirmerNegociation(step: any) {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation du prix final',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.nego1nego2_InMagasin(
                    this._idDi,
                    this.price,
                    this.finalPrice
                );

                // Null and undefined checks added here
                //condition for STATUS
                //@skander
                if (
                    !this.selectedRowInNegociate1?.contain_pdr ||
                    (this.selectedRowInNegociate2 &&
                        !this.selectedRowInNegociate2?.contain_pdr)
                ) {
                    this.changeStatusPending3(this._idDi);
                }
                if (
                    this.selectedRowInNegociate1?.can_be_repaired === false ||
                    this.selectedRowInNegociate2?.can_be_repaired === false
                ) {
                    this.changeStatusFinished(this._idDi);
                }
                if (
                    (this.selectedRowInNegociate1?.contain_pdr &&
                        this.selectedRowInNegociate1?.can_be_repaired) ||
                    (this.selectedRowInNegociate2?.contain_pdr &&
                        this.selectedRowInNegociate2?.can_be_repaired)
                ) {
                    this.changeStatusDiToInMagasin(this._idDi);
                }

                this.getDi(this.first, this.rows);

                console.log;
               /* if (step === 0) {
                    this.saveDevisPDF(this._idDi, this.payload.file);
                    this.saveBCPDF(this._idDi, this.payload.file);
                }*/
                this.payload.file = '';
                this.negocite1Modal = false;
                this.negocite2Modal = false;

                // Reset fields
                this.isBCUploaded = false;
                this.isDevisUploaded = false;
                this.selectedBc = null;
                this.selectedDevis = null;
                this.discountPercent = 0;
                this.price = 0;
                this.finalPrice = 0;
            },
        });
    }

    enregistrerBC() {
        this.confirmationService.confirm({
            message: 'Voulez vous Enregistrer Bon de commande',
            header: 'Confirmation Fichier',
            icon: 'pi pi-exclamation-triangle',
            accept: async () => {
                this.saveBCPDF(this._idDi, this.payload.file);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                this.devisBtnDisabled = false;
                this.enregistrerBcBtncondition = true;
            },
        });
    }
    enregistrerDevis() {
        this.confirmationService.confirm({
            message: 'Voulez vous Enregistrer Devis',
            header: 'Confirmation Fichier',
            icon: 'pi pi-exclamation-triangle',
            accept: async () => {
                this.saveDevisPDF(this._idDi, this.payload.file);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                this.bcBtnDisabled = false;
                this.enregistrerDevisBtncondition = true;
            },
        });
    }
    enregistrerBL() {
        this.confirmationService.confirm({
            message: 'Voulez vous Enregistrer Bon de livraison',
            header: 'Confirmation Fichier',
            icon: 'pi pi-exclamation-triangle',
            accept: async () => {
                this.saveBLPDF(this._idPDFFinished, this.payload.file);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                this.factureBtnDisabled = false;
                this.enregistrerBlBtncondition = true;
            },
        });
    }
    enregistrerFacture() {
        this.confirmationService.confirm({
            message: 'Voulez vous Enregistrer Bon de livraison',
            header: 'Confirmation Fichier',
            icon: 'pi pi-exclamation-triangle',
            accept: async () => {
                this.saveFacturePDF(this._idPDFFinished, this.payload.file);
                await new Promise((resolve) => setTimeout(resolve, 2000));
                this.blBtnDisabled = false;
                this.enregistrerFactureBtncondition = true;
            },
        });
    }

    saveDevisPDF(_id: string, pdf: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addDevis(_id, pdf),
            })
            .subscribe(({ data }) => {});
    }
    saveBLPDF(_id: string, pdf: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addBL(_id, pdf),
            })
            .subscribe(({ data }) => {
                console.log('data BL', data);
            });
    }
    saveFacturePDF(_id: string, pdf: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addFacture(_id, pdf),
            })
            .subscribe(({ data }) => {
                console.log('🥟[data]:', data);
            });
    }
    saveBCPDF(_id: string, pdf: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addBC(_id, pdf),
            })
            .subscribe(({ data }) => {});
    }

    timeStringIntoHours(timeString) {
        const [hours, minutes, seconds] = timeString.split(':').map(Number);
        return {
            hours: hours,
            minutes: minutes,
            seconds: seconds,
        };
    }

    showDialogForPricing(data) {
        this.seletedRow = data;
        const MyID = data._id;
        this.isErrorFromFixtronix = data.isErrorFromFixtronix;
        this.ignoreCountPricing = data.ignoreCount;
        console.log('ignoreCount =>', data.ignoreCount);
        this.ignoreCountN1 = data.ignoreCount;
        // Reset tarif and time values to ensure they are not carrying over from previous calls
        this.tarif_Technicien = null;
        this.timeDiagnostique = null;
        this.facturationDiagnostique = null;

        // First query: get technician tarif
        const tarifQuery = this.apollo
            .query<any>({
                query: this.ticketSerice.getTechTarif(),
            })
            .toPromise()
            .then(({ data }) => {
                if (data) {
                    this.tarif_Technicien = data.getTarif.tarif;
                }
            });

        // Second query: get diagnostic time
        let statQuery;
        if (data?.ignoreCount && data?.ignoreCount > 0) {
            this.apollo
                .query<any>({
                    query: this.ticketSerice.getDiById(data._id),
                })
                .subscribe(({ data }) => {
                    console.log('🥝[data]:', data);
                    if (data) {
                        console.log(data.getDiById.di.price, 'data originale');
                        this.initialPriceAffichage = data.getDiById.di.price;
                        this.priceRemiseAffichage =
                            data.getDiById.di.final_price;
                        this.remiseAffichage = Math.floor(
                            (1 -
                                this.priceRemiseAffichage /
                                    this.initialPriceAffichage) *
                                100
                        );
                    }
                });

            this.apollo
                .query<any>({
                    query: this.ticketSerice.getLogsDiById(
                        data.ignoreCount,
                        data._id
                    ),
                })
                .subscribe(({ data }) => {
                    if (data) {
                        console.log('🍎[data]:', data);
                        this.isErrorFromFixtronix =
                            data.getLigsById.isErrorFromFixtronix;
                    }
                });
            statQuery = this.apollo
                .query<any>({
                    query: this.ticketSerice.getStatByDI_ID(
                        MyID,
                        data?.ignoreCount
                    ),
                })
                .toPromise()
                .then(({ data }) => {
                    console.log('🥪[data]:', data);
                    if (data) {
                        this.timeDiagnostique =
                            data.getInfoStatByIdDi.diag_time;
                        this.timepart = this.timeStringIntoHours(
                            data.getInfoStatByIdDi.diag_time
                        );
                    }
                });
        } else {
            this.apollo
                .query<any>({
                    query: this.ticketSerice.getDiById(data._id),
                })
                .subscribe(({ data }) => {
                    console.log('🥝[data]:', data);
                    if (data) {
                        this.isErrorFromFixtronix =
                            data.getDiById.di.isErrorFromFixtronix;
                    }
                });
            statQuery = this.apollo
                .query<any>({
                    query: this.ticketSerice.getStatByDI_ID(MyID),
                })
                .toPromise()
                .then(({ data }) => {
                    if (data) {
                        this.timeDiagnostique =
                            data.getInfoStatByIdDi.diag_time;
                        this.timepart = this.timeStringIntoHours(
                            data.getInfoStatByIdDi.diag_time
                        );
                    }
                });
        }

        // Wait for both queries to complete before calculating facturationDiagnostique
        Promise.all([tarifQuery, statQuery]).then(() => {
            if (this.timepart && this.tarif_Technicien) {
                this.facturationDiagnostique = parseFloat(
                    (
                        this.timepart.hours * this.tarif_Technicien +
                        this.timepart.minutes *
                            parseFloat(
                                (this.tarif_Technicien / 60).toFixed(2)
                            ) +
                        parseFloat((this.tarif_Technicien / 60).toFixed(2))
                    ).toFixed(2)
                );
            }
        });

        this.current_id = data._id;
        for (let oneComposant of data.array_composants) {
            this.getcomposantByName(oneComposant.nameComposant);
        }

        this.composantQuantity = this.allComposants.length;

        this.pricingModal = true;

        this.changeStatusPricing(data._id);
        this.getTotalComposant(data._id);
    }

    hideNegModal(data) {
        console.log('🍢[data]:', data);

        // Reset uploaded file URLs
        this.selectedBc = null;
        this.selectedDevis = null;
        this.instantSelectedBc = null;
        this.instantSelectedDevis = null;

        // Reset discount and price-related values
        this.discountPercent = 0;
        this.finalPrice = null;
        this.discountedPriceNeg = null;

        // Reset any flags or states
        this.slideEnd = 0;
        this.ignoreCountNeg1 = 0;

        // Reset other form-related values if needed
        // Add any additional fields to reset here

        console.log('All values have been reset.');
    }

    formatSize(bytes) {
        const k = 1024;
        const dm = 3;
        const sizes = this.config.translation.fileSizeTypes;
        if (bytes === 0) {
            return `0 ${sizes[0]}`;
        }

        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

        return `${formattedSize} ${sizes[i]}`;
    }
    onSelectedFiles(event) {
        this.files = event.currentFiles;
        this.files.forEach((file) => {
            this.totalSize += parseInt(this.formatSize(file.size));
        });
        this.totalSizePercent = this.totalSize / 10;
    }

    showDialogForNegociate1(data) {
        console.log('🥫[data]:', data);

        this.devisBtnDisabled = false;
        this.bcBtnDisabled = false;
        this.enregistrerBcBtncondition = true;
        this.enregistrerDevisBtncondition = true;
        // this.selectedRowInNegociate1 = data;
        this._idDi = data._id;

        this.seletedRow = data._id;
        this.ignoreCountNeg1 = data.ignoreCount;
        console.log('ignoreCountNeg1', this.ignoreCountNeg1);
        this._idDi = this.seletedRow;
        this.getDiByID(this._idDi);
        this.secondNegocition = data._id;
        this.negocite1Modal = true;
        this.getTotalComposant(data._id);
        this.isFormComplete();
    }
    showDialogForNegociate2(data) {
        this.devisBtnDisabled = false;
        this.bcBtnDisabled = false;
        this.enregistrerBcBtncondition = true;
        this.enregistrerDevisBtncondition = true;

        this.selectedRowInNegociate2 = data;
        this.slectedRow = data._id;
        this._idDi = data._id;
        this.ignoreCountNeg1 = data.ignoreCount;
        this.negocite2Modal = true;
        this.getTotalComposant(data._id);
        this.getDiByID(this.slectedRow);
    }

    onSizeSelect() {}

    //Get composant Info for admins
    async getcomposantByName(name_composant: string) {
        await this.apollo
            .watchQuery<DiQueryResult>({
                query: this.ticketSerice.composantByName_forAdmin(
                    name_composant
                ),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.allComposants.push(data);
                }
            });
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;
        this.getDi(this.first, this.rows);
    }

    getDi(first, rows) {
        this.apollo
            .watchQuery<DiQueryResult>({
                query: this.ticketSerice.getAllDi(first, rows),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.diList = data.getAllDi.di;
                    this.diListCount = data.getAllDi.totalDiCount;
                    this.diList.filter((di) => {
                        switch (di.status) {
                            case 'INMAGASIN':
                            case 'MagasinEstimation':
                                this.counterInMagasin =
                                    this.counterInMagasin + 1;
                                break;
                            case 'DIAGNOSTIC':
                            case 'INDIAGNOSTIC':
                            case 'DIAGNOSTIC_Pause':
                                this.counterInDiagnostique =
                                    this.counterInDiagnostique + 1;
                                break;
                            case 'REPARATION':
                            case 'INREPARATION':
                            case 'REPARATION_Pause':
                                this.counterInReperation =
                                    this.counterInReperation + 1;
                                break;
                            case 'PENDING1':
                            case 'PENDING2':
                            case 'PENDING3':
                                this.counterPending = this.counterPending + 1;
                                break;
                            case 'RETOUR1':
                            case 'RETOUR2':
                            case 'RETOUR3':
                                this.counterRetour = this.counterRetour + 1;
                                break;
                            default:
                                break;
                        }
                    });
                }
            });
    }
    //New Query
    getDiByID(_idDi: string) {
        console.log('🥐[getDiByID]: fired');
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getDiById(_idDi),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.dataById = data;
                    console.log('data NEGOCIATION111', data);

                    // set here value
                    this.selectedRowInNegociate1 =
                        data.getDiById.logsDi &&
                        data.getDiById.logsDi.length > 0
                            ? data.getDiById.logsDi.reduce((prev, current) =>
                                  prev.idIgnore > current.idIgnore
                                      ? prev
                                      : current
                              )
                            : data.getDiById.di;
                    console.log(
                        '🍇🍇🍇🍇[this.selectedRowInNegociate1]:',
                        this.selectedRowInNegociate1
                    );
                    if (this.dataById.getDiById.logsDi) {
                        const filtredLogsDi =
                            this.dataById.getDiById.logsDi.find(
                                (el) => el.idIgnore === this.ignoreCountNeg1
                            );

                        this.price = filtredLogsDi.price;
                        this.selectedBc = filtredLogsDi.bon_de_commande;
                        this.selectedDevis = filtredLogsDi.devis;
                        console.log('INSIDE LOGS');

                        console.log('this.selectedBc', this.selectedBc);
                        console.log('this.selectedDevis', this.selectedDevis);
                    } else {
                        console.log('OUTSIDE LOGS');
                        this.price = this.dataById.getDiById.di.price;
                        this.selectedBc =
                            this.dataById.getDiById.di.bon_de_commande;
                        this.selectedDevis = this.dataById.getDiById.di.devis;
                        this.selectedDevis
                            ? (this.devisUploaded = true)
                            : (this.devisUploaded = false);
                        this.selectedBc
                            ? (this.bcUploaded = true)
                            : (this.bcUploaded = false);
                        console.log('this.selectedBc', this.selectedBc);
                        console.log('this.selectedDevis', this.selectedDevis);
                    }
                }
            });
    }
    changeStatusPricing(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusPricing(_id),
            })
            .subscribe(({ data }) => {});
    }
    getTotalComposant(_id: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.totalComposant(_id),
            })
            .valueChanges.subscribe(({ data }) => {
                this.totalComposant = data.calculateTicketComposantPrice;
            });
    }

    pricing() {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation du prix Initial',
            icon: 'pi pi-question-circle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.pricing(
                            this.current_id,
                            this.price
                        ),
                    })
                    .subscribe(({ data, loading }) => {
                        if (data) {
                            this.getDi(this.first, this.rows);
                            this.pricingModal = false;
                            this.changeStatusNegiciate1(this.current_id);
                        }
                    });
            },
        });
    }

    deleteDi(rowData) {
        this.confirmationService.confirm({
            message: 'Voulez vous supprimer ce DI',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.deleteDi(rowData._id),
                    })
                    .subscribe(({ data }) => {
                        const index = this.diList.findIndex((el) => {
                            el._id === rowData._id;
                        });
                        this.diList.splice(index, 0);
                        this.messageservice.add({
                            severity: 'danger',
                            summary: 'Deleted',
                            detail: 'La demande service supprimer',
                        });
                        this.getDi(this.first, this.rows);
                    });
            },
        });
    }

    changeStatusNegiciate1(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusNegociate1(_id),
            })
            .subscribe(({ data }) => {});
    }
    changeStatusNegociate2(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusNegociate2(_id),
            })
            .subscribe(({ data }) => {});
    }
    changeStatusPending3(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusPending3(_id),
            })
            .subscribe(({ data }) => {});
    }
    changeStatusFinished(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeFinishStatus(_id),
            })
            .subscribe(({ data }) => {});
    }
    load() {
        this.loading = true;

        setTimeout(() => {
            this.loading = false;
        }, 2000);
    }

    getSeverity(status: string) {
        switch (status) {
            case 'CREATED':
                return 'success';
            case 'PENDING1':
            case 'PENDING2':
            case 'PENDING3':
                return 'help';
            case 'DIAGNOSTIC':
            case 'INDIAGNOSTIC':
                return 'info';
            case 'INMAGASIN':
            case 'MagasinEstimation':
                return 'warning';
            case 'PRICING':
                return 'warning';
            case 'NEGOTIATION1':
            case 'NEGOTIATION2':
                return 'warning';
            case 'REPARATION':
            case 'INREPARATION':
                return 'info';
            case 'FINISHED':
                return 'success';
            case 'ANNULER':
                return 'contrast';
            case 'RETOUR1':
            case 'RETOUR2':
            case 'RETOUR3':
                return 'danger';
            default:
                return 'warn';
        }
    }
    getSt(selected) {
        if (selected && selected.value) {
            this.radioBtn = selected.value;
        }
    }
    onSelectStatusDefaultDI(selectedStatus) {
        this.statusDI = STATUS_DI.CREATED;
        if (selectedStatus.checked) {
            this.statusDI = STATUS_DI.PENDING1;
        } else {
            this.statusDI = STATUS_DI.CREATED;
        }
    }
    //TODO Make the creation only possible when the user have chosen the client
    //Todo Add mutation to the delete DI
    //FIXME
    createDi() {
        {
            this.confirmationService.confirm({
                message: 'Voulez vous confirmer les changements',
                header: "Confirmation Demande d'intevention",
                icon: 'pi pi-question-circle',
                accept: () => {
                    const {
                        title,
                        description,
                        client_id,
                        company_id,
                        nSerie,
                        typeClient,
                        remarqueManager,
                        category,
                        location,
                    } = this.creationDiForm.value;

                    const diInfo = {
                        title,
                        description,
                        client_id,
                        company_id,
                        nSerie,
                        status: this.statusDI,
                        typeClient,
                        remarqueManager,
                        di_category_id: category,
                        location,
                        image: this.payload.file,
                    };

                    let _idQuery;

                    this.apollo
                        .mutate<CreateDiMutationResult>({
                            mutation: this.ticketSerice.createDi(diInfo),
                            useMutationLoading: true,
                        })
                        .subscribe(({ data, loading, errors }) => {
                            this.loadingCreatingDi = loading;

                            if (data) {
                                this.messageservice.add({
                                    severity: 'success',
                                    summary: 'Success',
                                    detail: 'La demande service ajouté',
                                });
                                _idQuery = data.createDi._id;

                                this.creationDiForm.reset();
                                this.payload.file = '';
                                this.openAddDiModal = false;
                                this.getDi(this.first, this.rows);
                                this.getStatusCount();
                            }
                        });
                },
            });
        }
    }

    getCompanyList() {
        this.apollo
            .watchQuery<GetCompaniesQueryResult>({
                query: this.ticketSerice.getCompanies(),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.companiesListDropDown =
                        data.getAllComapnyforDropDown.map((Company) => ({
                            company_name: `${Company.name}`,
                            value: Company._id, // ID as value
                        }));
                }
            });
    }

    getClientList() {
        this.apollo
            .watchQuery<GetClientsQueryResult>({
                query: this.ticketSerice.getClients(),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.clientListDropDown = data.getAllClient.map(
                        (client) => ({
                            label: `${client.first_name} ${client.last_name}`, // Concatenated name
                            value: client._id, // ID as value
                        })
                    );
                }
            });
    }

    onSlideEnd(percent) {
        this.slideEnd = percent.value;
    }
    onSlideAdminEnd(percent) {
        this.slideAdminEnd = percent.value;
    }

    changeStatusDiToInMagasin(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusDiToInMagasin(_id),
            })
            .subscribe(({ data }) => {});
    }

    changeStatusRetour1(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusRetour1(_id),
            })
            .subscribe(({ data }) => {});
    }
    changeStatusRetour2(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusRetour2(_id),
            })
            .subscribe(({ data }) => {});
    }
    changeStatusRetour3(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusRetour3(_id),
            })
            .subscribe(({ data }) => {});
    }

    changeToPending1(data) {
        this.confirmationService.confirm({
            message: 'Voulez-vous envoyer le DI au Coordinateur?',
            header: "Relancer la Demande d'intervention",
            icon: 'pi pi-question-circle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.changeToPending1(data._id),
                    })
                    .subscribe(({ data }) => {
                        //! NEED TO SELECT THE ID OF THE SELECTED DI
                    });

                this.getDi(this.first, this.rows);
            },
        });
    }
    // TODO cannot return null for non nullable field below
    nego1nego2_InMagasin(_id: string, price, final_price) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.nego1nego2_InMagasin(
                    _id,
                    price,
                    final_price
                ),
            })
            .subscribe(({ data }) => {
                console.log('data', data);
            });
    }

    //! Nan c bon
    // the discount function the price and the discounts are affected
    //in the confirmation btn the mutation is fired

    discountByPercent() {
        this.discountedPriceNeg = (this.price * this.discountPercent) / 100;
        this.finalPrice = this.price - this.discountedPriceNeg; //! Nezih
    }

    discountByPercent2() {
        this.discountedPriceNeg = (this.price * this.discountPercent) / 100;
        this.finalPrice = this.price - this.discountedPriceNeg;
    }

    nextNegociate2() {
        this.confirmationService.confirm({
            message: 'Voulez vous envoyer ce di a l admin Manager',
            header: 'Confirmation Pricing',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                if (this.secondNegocition) {
                    this.changeStatusNegociate2(this.secondNegocition);
                    this.negocite1Modal = false;
                    this.getDi(this.first, this.rows);
                }
            },
        });
    }

    //---- Files
    exportPdf() {
        // Extract headers from exportColumns
        const headers = this.cols.map((col) => col.header);

        const diList = this.diList.map((di) => [
            di.title,
            di.status,
            di.client_id,
            di.createdBy,
        ]);

        // Transform data for compatibility with jsPDF-autotable
        const formattedData =
            this.diList.length === 0
                ? headers.map(() => '') // Create empty body for headers if no data
                : this.diList.map((item) => {
                      return this.cols.reduce((acc, column) => {
                          acc[column.header] = item[column.field];
                          return acc;
                      }, {});
                  });

        // Asynchronous import with potential Promise.all
        Promise.all([import('jspdf'), import('jspdf-autotable')])
            .then(([jsPDF, { default: autoTable }]) => {
                // Destructure imports

                const doc = new jsPDF.default('p', 'px', 'a4');
                autoTable(doc, {
                    head: [headers],
                    body: diList,
                });
                doc.save('Users.pdf');
            })
            .catch((err) => {
                // Handle import errors
            });
    }

    exportExcel() {
        import('xlsx').then((xlsx) => {
            const worksheet = xlsx.utils.json_to_sheet(this.diList);
            const workbook = {
                Sheets: { data: worksheet },
                SheetNames: ['data'],
            };
            const excelBuffer: any = xlsx.write(workbook, {
                bookType: 'xlsx',
                type: 'array',
            });
            this.saveAsExcelFile(excelBuffer, 'products');
        });
    }

    saveAsExcelFile(buffer: any, fileName: string): void {
        let EXCEL_TYPE =
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
        let EXCEL_EXTENSION = '.xlsx';
        const data: Blob = new Blob([buffer], {
            type: EXCEL_TYPE,
        });
        FileSaver.saveAs(
            data,
            fileName + '_export_' + new Date().getTime() + EXCEL_EXTENSION
        );
    }

    // count ignore ticket and save it
    //!POP HERE
    ignore(_idticket) {
        this.confirmationService.confirm({
            message: 'Voulez-vous continuer ?',
            header: "Envoyer Demande d'intervention Retour",
            icon: 'pi pi-question-circle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.ignore(_idticket._id),
                    })
                    .subscribe(({ data }) => {
                        if (data) {
                            const updatedIgnoreCount =
                                data.countIgnore.ignoreCount;

                            // Conditional checks for status updates
                            if (updatedIgnoreCount === 1) {
                                this.changeStatusRetour1(_idticket._id);
                            } else if (updatedIgnoreCount === 2) {
                                this.changeStatusRetour2(_idticket._id);
                            } else if (updatedIgnoreCount === 3) {
                                this.changeStatusRetour3(_idticket._id);
                            }

                            // Update the ignore count in the diList
                            const ticketIndex = this.diList.findIndex(
                                (item) => item._id === _idticket._id
                            );
                            if (ticketIndex !== -1) {
                                this.diList[ticketIndex].ignoreCount =
                                    updatedIgnoreCount;
                            }
                        }
                        this.cdr.detectChanges();
                    });
            },
        });
    }

    addCategoryDi() {
        this.confirmationService.confirm({
            message: 'Voulez-vous créer cette categorie ?',
            header: 'Confirmation Creation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {

                typeof (this.categoryForm.value.categoryName, 'TYPE');
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.addCatgoryDi(
                            this.categoryForm.value.categoryName
                        ),
                    })
                    .subscribe(({ data }) => {
                        if (data) {
                            let obj: { value: string; category_name: string } = {
                                value: '',
                                category_name: '',
                            };
                            obj.category_name = data?.createDiCategory?.category;
                            obj.value = data?.createDiCategory?._id;
                            this.categorieDiListDropDown.push(obj);
                            this.categoryForm.reset();
                        }
                    });
            }})
        
    }
    addLocation() {
        this.confirmationService.confirm({
            message: 'Voulez-vous créer cette emplacement ?',
            header: 'Confirmation Creation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                .mutate<any>({
                    mutation: this.ticketSerice.addLocation(
                        this.locationForm.value.locationName
                    ),
                })
                .subscribe(({ data }) => {
                    if (data) {
                        let obj: { location_name: string; value: string } = {
                            location_name: '',
                            value: '',
                        };
                        obj.value = data?.createLocation?._id;
                        obj.location_name = data?.createLocation?.location_name;
                        this.locationDropDown.push(obj);
                        this.locationForm.reset();
                    }
                })
            }})
        
    }

    allCategoryDi() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllDiCategory(),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.categorieDiListDropDown = data.findAllDiCategory.map(
                        (categoryDi) => ({
                            category_name: `${categoryDi.category}`,
                            value: categoryDi._id, // ID as value
                        })
                    );
                }
            });
    }

    onPaste(event: ClipboardEvent) {
        console.log('🍚');
        // Get pasted data and remove line breaks
        const clipboardData = event.clipboardData?.getData('text') || '';
        const sanitizedData = clipboardData.replace(/(\r\n|\n|\r)/gm, ' '); // Replace with space or remove

        // Prevent default paste and update value
        event.preventDefault();
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        target.value = sanitizedData;

        // If using Angular forms, update the control's value (e.g., for reactive forms)
        // this.myFormControl.setValue(sanitizedData);
    }
    getLocationList() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllLocation(),
            })
            .subscribe(({ data }) => {
                this.locationDropDown = data.findAllLocation.map((el) => ({
                    location_name: el.location_name,
                    value: el._id, // ID as value
                }));
            });
    }

    onUpload(event: any, type: string) {
        this.uploadFileLoading = true;

        for (let file of event.files) {
            const reader = new FileReader();
            reader.readAsArrayBuffer(file); // Read file as ArrayBuffer for Blob creation
            const readerForBase64 = new FileReader();
            readerForBase64.readAsDataURL(file); // Read file as Base64 for upload

            // Blob URL creation
            reader.onload = () => {
                const arrayBuffer = reader.result as ArrayBuffer;

                // Create a Blob and generate its URL
                const blob = new Blob([arrayBuffer], {
                    type: 'application/pdf',
                });
                const blobUrl = URL.createObjectURL(blob);

                if (type === 'BC') {
                    this.instantSelectedBc = blobUrl;
                    this.bcUploaded = true;
                    this.devisBtnDisabled = true;
                    this.enregistrerBcBtncondition = false;
                } else if (type === 'Devis') {
                    this.devisUploaded = true;
                    this.instantSelectedDevis = blobUrl;
                    this.bcBtnDisabled = true;
                    this.enregistrerDevisBtncondition = false;
                } else if (type == 'BL') {
                    this.selectedBL = blobUrl;
                    this.factureBtnDisabled = true;
                    this.enregistrerBlBtncondition = false;
                } else if (type == 'Facture') {
                    this.selectedFacture = blobUrl;
                    this.blBtnDisabled = true;
                    this.enregistrerFactureBtncondition = false;
                }

                this.uploadFileLoading = false;

                // Show a success message
                this.messageservice.add({
                    severity: 'info',
                    summary: 'Fichier enregistré',
                    detail: 'Fichier a été ajouté avec succès',
                });
            };

            reader.onerror = (error) => {
                console.error('File read error:', error);
                this.uploadFileLoading = false;
            };

            // Base64 creation
            readerForBase64.onload = () => {
                const base64 = readerForBase64.result as string;

                // Call uploadFile with Base64 string
                this.uploadFile(base64, type);
            };

            readerForBase64.onerror = (error) => {
                console.error('Base64 conversion error:', error);
            };
        }
    }

    // Update the isFormComplete method to check file upload statuses
    isFormComplete() {
        return this.bcUploaded && this.devisUploaded;
    }

    uploadFile(base64: string, type: string) {
        if (type === 'image') {
            const payload = {
                file: base64,
                // add other necessary data here
            };

            this.payload = payload;
        }
        if (type === 'BC') {
            const payload = {
                file: base64,
                // add other necessary data here
            };

            this.payload = payload;
        }
        if (type === 'Devis') {
            const payload = {
                file: base64,
                // add other necessary data here
            };
            this.payload = payload;
        }
        if (type === 'BL') {
            const payload = {
                file: base64,
                // add other necessary data here
            };
            this.payload = payload;
        }
        if (type === 'Facture') {
            const payload = {
                file: base64,
                // add other necessary data here
            };
            this.payload = payload;
        }
    }

    deletLocation(selected) {
        this.confirmationService.confirm({
            message: 'Voulez-vous supprimer cette emplacement ?',
            header: 'Supprimer',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {

                this.apollo
                .mutate<any>({
                    mutation: this.ticketSerice.deleteLocation(selected.value),
                })
                .subscribe(({ data }) => {
                    if (data) {
                        const index = this.locationDropDown.findIndex((el) => {
                            return el.value === selected.value;
                        });
    
                        this.locationDropDown.splice(index, 1);
                    }
                });
            }})
       
    }

    deleteCategory(selected) {
        this.confirmationService.confirm({
            message: 'Voulez-vous supprimer cette categorie ?',
            header: 'Supprimer ?',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.removeCategory(selected.value),
            })
            .subscribe(({ data }) => {
                if (data) {
                    const index = this.categorieDiListDropDown.findIndex(
                        (el) => {
                            return el.value === selected.value;
                        }
                    );
                    this.categorieDiListDropDown.splice(index, 1);
                }
            })
            }})
        ;
    }

    //editCategory(selected) {}

    annulerDi() {
        this.openAddDiModal = false;
        this.creationDiForm.reset();
    }
    openUploadFileFinished(dataselected: any) {
        this.filesSelected = dataselected;
        console.log('🥩[dataselected]:', dataselected);
        this.factureBtnDisabled = false;
        this.blBtnDisabled = false;

        this.enregistrerBlBtncondition = true;
        this.enregistrerFactureBtncondition = true;

        this.filsFinished = true;
        this._idPDFFinished = dataselected._id;

        this.apollo
            .query<any>({
                query: this.ticketSerice.getLogsDi(dataselected._id),
            })
            .pipe(
                tap(({ data }) => {
                    if (data) {
                        const logs = data.getAllLogsByDi;
                        this.finishedData = { original: dataselected, logs };
                        console.log(
                            '🥠[ this.finishedData]:',
                            this.finishedData
                        );
                    }
                })
            )
            .subscribe({
                error: (err) => console.error('Error fetching logs:', err),
            });
    }

    onUploadFacture(event, type) {
        for (let file of event.files) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result as string;

                this.saveFileFinished(base64, type);
            };
        }
        this.messageservice.add({
            severity: 'info',
            summary: 'Fichier enregistré',
            detail: 'Fichier a été ajouter avec succès',
        });
    }
    onUploadBl(event, type) {
        for (let file of event.files) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result as string;

                this.saveFileFinished(base64, type);
            };
        }
        this.messageservice.add({
            severity: 'info',
            summary: 'Bon de livraison Ajouter',
            detail: 'Fichier a été ajouter avec succès',
        });
    }

    saveFileFinished(base64: string, type: string) {
        if (type === 'facture') {
            const payload = {
                file: base64,
                // add other necessary data here
            };

            this.facturePDF = payload;
        }
        if (type === 'bl') {
            const payload = {
                file: base64,
                // add other necessary data here
            };

            this.blPDF = payload;
        }
    }

    sendFilePdf() {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addPdfFile(
                    this._idPDFFinished,
                    this.facturePDF.file,
                    this.blPDF.file
                ),
            })
            .subscribe(({ data }) => {});
    }

    openTicketDetails(data: any) {
        this.getLogsDi(data._id);
        this.getLogsData(data._id).subscribe((pauseLogs) => {
            // nezih
            // this.ticketData = { ...data, ...pauseLogs, ...this.logsDi }; // Merge data and pauseLogs
            this.ticketData = {
                data: { ...data },
                pauseLogs: { ...pauseLogs },
                logsDi: { ...this.logsDi },
            };
            this.retourInfoFromLogs = this.logsDi
           
            this.ignoreCountForBtns = data.ignoreCount
            console.log(data.ignoreCount,"ignoreCountignoreCount");
            
            this.ticketDetailsInfo = true; // Open the dialog
            console.log('data inside =>', this.ticketData);
        });
    }

    getLogsDi(_id: string) {
        this.apollo
            .query<any>({ query: this.ticketSerice.getLogsDi(_id) })
            .subscribe(({ data }) => {
                if (data) {
                    this.logsDi = data.getAllLogsByDi;
                }
            });
    }

    getLogsData(_id: string) {
        return this.apollo
            .query<any>({
                query: this.ticketSerice.getLogsPause(_id),
            })
            .pipe(map(({ data }) => data?.getStatByIdlogs));
    }
}
