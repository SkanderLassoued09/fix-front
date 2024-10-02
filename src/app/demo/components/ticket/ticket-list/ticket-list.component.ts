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
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
    CreateDiMutationResult,
    DiQueryResult,
    GetClientsQueryResult,
    GetCompaniesQueryResult,
} from './ticket-list.interface';
import * as FileSaver from 'file-saver';
import { NotificationService } from 'src/app/demo/service/notification.service';

interface Column {
    field: string;
    header: string;
}

interface UploadEvent {
    originalEvent: Event;
    files: File[];
}

@Component({
    selector: 'app-ticket-list',
    standalone: false,
    templateUrl: './ticket-list.component.html',
    styleUrl: './ticket-list.component.scss',
})
export class TicketListComponent implements OnInit {
    ticketSelected: any;
    openUpdateModal: boolean = false;
    ticketData: any = {
        _id: '',
        title: '',
        description: '',
        can_be_repaired: false,
        bon_de_commande: '',
        bon_de_livraison: '',
        contain_pdr: false,
        facture: '',
        status: '',
        createdAt: '',
        updatedAt: '',
        image: '',
        current_roles: '',
        client_id: '',
        remarque_tech_diagnostic: '',
        createdBy: '',
        ignoreCount: 0,
        location_id: '',
        di_category_id: '',
        array_composants: [],
    };
    filsFinished: boolean = false;
    creationDiForm = new FormGroup({
        title: new FormControl('', [Validators.required]),
        designiation: new FormControl('', [Validators.required]),
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
        designiation: new FormControl('', [Validators.required]),
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
    discountPercent;
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
        this.getDi();
        this.getCompanyList();
        this.getClientList();
        this.allCategoryDi();
        this.getLocationList();
        this.notificationService.startWorker();
    }

    showDialogDiCreation() {
        this.openAddDiModal = true;
    }
    updateDi(rowDataTicket: any) {
        this.selectedTicket = rowDataTicket ?? {}; // Populate selected ticket details

        this.updateticketView = true; // Open the update modal
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
    confirmerNegociation() {
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
                this.changeStatusDiToInMagasin(this._idDi);

                this.getDi();
                this.saveDevisPDF(this._idDi, this.payload.file);
                this.saveBCPDF(this._idDi, this.payload.file);
                this.negocite1Modal = false;
                this.negocite2Modal = false;
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
        let MyID = data._id;

        this.apollo
            .query<any>({
                query: this.ticketSerice.getTechTarif(),
            })
            .subscribe(({ data }) => {
                this.tarif_Technicien = data.getTarif.tarif;
            });

        this.apollo
            .query<any>({
                query: this.ticketSerice.getStatByDI_ID(MyID),
            })
            .subscribe(({ data }) => {
                this.timeDiagnostique = data.getInfoStatByIdDi.diag_time;
                this.timepart = this.timeStringIntoHours(
                    data.getInfoStatByIdDi.diag_time
                );
                this.facturationDiagnostique =
                    this.timepart.hours * this.tarif_Technicien +
                    this.timepart.minutes *
                        parseFloat((this.tarif_Technicien / 60).toFixed(2));
            });

        this.current_id = data._id;
        for (let oneComposant of data.array_composants) {
            this.getcomposantByName(oneComposant.nameComposant);
        }

        this.composantQuantity = this.allComposants.length;

        this.pricingModal = true;

        //! fnction delte here and add in the confirmer BTN

        this.changeStatusPricing(data._id);
        this.getTotalComposant(data._id);
    }

    isFormComplete(): boolean {
        return this.payload.file && this.discountPercent > 0;
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
        this.seletedRow = data._id;

        this._idDi = this.seletedRow;

        this.getDiByID(this._idDi);
        this.secondNegocition = data._id;

        this.negocite1Modal = true;
        this.getTotalComposant(data._id);
    }
    showDialogForNegociate2(data) {
        this.slectedRow = data._id;

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

    getDi() {
        this.apollo
            .watchQuery<DiQueryResult>({
                query: this.ticketSerice.getAllDi(),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.diList = data.getAllDi.di;
                    this.diListCount = data.getAllDi.totalDiCount;
                }
            });
    }
    //New Query
    getDiByID(_idDi: string) {
        this.apollo
            .watchQuery<DiQueryResult>({
                query: this.ticketSerice.getDiByID(_idDi),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.dataById = data;
                    this.price = this.dataById.getDiById.price;
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
                            this.getDi();
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
                        this.getDi();
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
        this.radioBtn = selected.value;
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
                        designiation,
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
                        designiation,
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
                                this.openAddDiModal = false;
                                this.getDi();
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

    changeStatusRetour(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusRetour(_id),
            })
            .subscribe(({ data }) => {});
    }

    changeToPending1(data) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeToPending1(data._id),
            })
            .subscribe(({ data }) => {
                //! NEED TO SELECT THE ID OF THE SELECTED DI
            });
        this.getDi();
    }

    nego1nego2_InMagasin(_id, price, final_price) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.nego1nego2_InMagasin(
                    _id,
                    price,
                    final_price
                ),
            })
            .subscribe(({ data }) => {});
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

        if (this.discountedPriceNeg) {
            this.changeStatusDiToInMagasin(this.slectedRow);
        }
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
                    this.getDi();
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
    ignore(_idticket) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.ignore(_idticket._id),
            })
            .subscribe(({ data }) => {
                if (data) {
                    const updatedIgnoreCount = data.countIgnore.ignoreCount;
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
    }

    addCategoryDi() {
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
    }
    addLocation() {
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
            });
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
        for (let file of event.files) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result as string;
                this.uploadFile(base64, type);
            };
        }
        this.messageservice.add({
            severity: 'info',
            summary: 'Fichier enregistré',
            detail: 'Fichier a été ajouter avec succès',
        });
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
    }

    deletLocation(selected) {
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
    }

    deleteCategory(selected) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.removeCategory(selected.value),
            })
            .subscribe(({ data }) => {
                if (data) {
                    const index = this.categorieDiListDropDown.find((el) => {
                        return el.value === selected.value;
                    });
                    this.categorieDiListDropDown.splice(index, 1);
                }
            });
    }
    editCategory(selected) {}

    annulerDi() {
        this.openAddDiModal = false;
        this.creationDiForm.reset();
    }

    openUploadFileFinished(_id: string) {
        this.filsFinished = true;
        this._idPDFFinished = _id;
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
            summary: 'Fichier enregistré',
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
        this.ticketData = data; // Bind the incoming data to the global object
        this.ticketDetailsInfo = true; // Open the dialog
    }
}
