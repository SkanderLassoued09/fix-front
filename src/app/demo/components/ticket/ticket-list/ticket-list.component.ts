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
    creationDiForm = new FormGroup({
        title: new FormControl('', [Validators.required]),
        designiation: new FormControl('', [Validators.required]),
        typeClient: new FormControl(),
        status: new FormControl(),
        client_id: new FormControl(),
        company_id: new FormControl(),
        nSerie: new FormControl(),
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
        { field: 'title', header: 'Title' },
        { field: 'image', header: 'Image' },
        // { field: 'description', header: 'Description' },
        // { field: 'can_be_repaired', header: 'Reparable' },
        // { field: 'bon_de_commande', header: 'BC' },
        // { field: 'bon_de_livraison', header: 'BL' },
        // { field: 'contain_pdr', header: 'PDR' },
        { field: 'status', header: 'Status' },
        { field: 'client_id', header: 'Client' },
        // { field: 'remarque_id', header: 'R.manager' },
        { field: 'createdBy', header: 'Cree par' },
        // { field: 'location_id', header: 'Location' },
        // { field: 'di_category_id', header: 'Categorie' },
    ];

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
    payloadImage: { image: string };
    // payloadBonCommande: { pdf: string };
    locationDropDown: any;
    categorieDiListDropDown: any;
    timepart: { hours: any; minutes: any; seconds: any };
    facturationDiagnostique: number = 0;
    tarif_Technicien: number;

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
        this.notificationService.startWorker();
    }

    showDialogDiCreation() {
        this.openAddDiModal = true;
    }

    showDialogCategoryDI() {
        this.openCategoryModal = true;
        this.allCategoryDi();
        console.log(this.allCategoryDiArray, 'this.allCategoryDiArray();');
    }
    showDialogLocations() {
        this.openLocationsModal = true;
        this.getLocationList();
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
        console.log('TarifFromAdmin:', this.tarif_Techs.value);
        const { tarifFromAdmin } = this.tarif_Techs.value;
        const tarifForTechs = tarifFromAdmin;
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.affectNewTarif(tarifForTechs),
            })
            .subscribe(({ data }) => {
                console.log(data, 'data TARIFICATION');
            });
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
        console.log('confirmerNegociation working');
        this.nego1nego2_InMagasin(this._idDi, this.price, this.finalPrice);
        this.changeStatusDiToInMagasin(this._idDi);
        console.log('🥓[this._idDi]:', this._idDi);
        this.getDi();
        this.negocite1Modal = false;
        this.negocite2Modal = false;
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
        console.log('verifiing the ID', MyID);
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
                console.log(
                    '🥚[data  NEZIH]:',
                    data.getInfoStatByIdDi.diag_time
                );
                this.timeDiagnostique = data.getInfoStatByIdDi.diag_time;
                this.timepart = this.timeStringIntoHours(
                    data.getInfoStatByIdDi.diag_time
                );
                this.facturationDiagnostique =
                    this.timepart.hours * this.tarif_Technicien +
                    this.timepart.minutes *
                        parseFloat((this.tarif_Technicien / 60).toFixed(2));
                console.log(
                    'this.facturationDiagnostique',
                    this.facturationDiagnostique
                );
                console.log('HOURS ', this.timepart.seconds);
                console.log('MIN ', this.timepart.minutes);
                console.log('seconds ', this.timepart.seconds);
                console.log('tarif TECHNICIENCS', this.tarif_Technicien);
            });

        this.current_id = data._id;
        for (let oneComposant of data.array_composants) {
            this.getcomposantByName(oneComposant.nameComposant);
            console.log('data quantity from here', oneComposant.quantity);
        }

        console.log('Quantite composants', this.allComposants);

        this.composantQuantity = this.allComposants.length;

        console.log('length all composant', this.allComposants.length);

        this.pricingModal = true;

        //! fnction delte here and add in the confirmer BTN

        this.changeStatusPricing(data._id);
        this.getTotalComposant(data._id);
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
        console.log('🍱[data ttttttttttttttttt]:', data);
        this.seletedRow = data._id;

        this._idDi = this.seletedRow;
        console.log('🌶[this._idDi]:', this._idDi);

        this.getDiByID(this._idDi);
        this.secondNegocition = data._id;
        console.log('🍈[ this.s]:', this.s);
        this.negocite1Modal = true;
        this.getTotalComposant(data._id);
    }
    showDialogForNegociate2(data) {
        this.slectedRow = data._id;
        console.log('🦑[slectedRow]:', data);
        this.negocite2Modal = true;
        this.getTotalComposant(data._id);
        this.getDiByID(this.slectedRow);
    }

    onSizeSelect() {
        console.log('Selected size:', this.selectedSize);
    }

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
                    console.log(data, 'lijùpioj');
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
                    console.log('🧀[data]:', data);
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
                    console.log('the NEW QUERY IS WORKING and value is', data);

                    this.dataById = data;
                    this.price = this.dataById.getDiById.price;
                    console.log('PRICE', this.price);
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
                console.log('🍌[ this.totalComposant ]:', this.totalComposant);
            });
    }

    pricing() {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.pricing(
                    this.current_id,
                    this.price
                ),
            })
            .subscribe(({ data, loading }) => {
                if (data) {
                    console.log(
                        this.current_id,
                        'data coming from pricing function'
                    );
                    this.getDi();
                    this.pricingModal = false;
                    //nezih

                    this.changeStatusNegiciate1(this.current_id);
                }
            });
    }

    deleteDi(rowData) {
        console.log('Fn delete');
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
                            severity: 'success',
                            summary: "Demande d'intervention a été créer",
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
        const {
            title,
            designiation,
            client_id,
            company_id,
            nSerie,
            status,
            typeClient,
            remarqueManager,
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
            image: this.payloadImage.image,
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
        console.log('🍻[percent]:', percent);
        this.slideEnd = percent.value;
    }
    onSlideAdminEnd(percent) {
        console.log('Admin percent', percent);
        this.slideAdminEnd = percent.value;
    }

    changeStatusDiToInMagasin(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusDiToInMagasin(_id),
            })
            .subscribe(({ data }) => {
                console.log('🥛[data]:', data);
            });
    }

    changeStatusRetour(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusRetour(_id),
            })
            .subscribe(({ data }) => {
                console.log('🥛[data]:', data);
            });
    }

    changeToPending1(data) {
        console.log('🥚[data]:', data);

        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeToPending1(data._id),
            })
            .subscribe(({ data }) => {
                //! NEED TO SELECT THE ID OF THE SELECTED DI
                console.log('🥛[ data from btn PENDING 1]:', data);
                console.log('the id selected', this._idDi);
            });
        this.getDi();
    }

    nego1nego2_InMagasin(_id, price, final_price) {
        console.log('🥕[final_price]:', final_price);
        console.log('🥨[price]:', price);
        console.log('🍨[_id]:', _id);
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
        console.log('discount ', this.discountPercent);
        console.log(this.price);

        this.discountedPriceNeg = (this.price * this.discountPercent) / 100;
        this.finalPrice = this.price - this.discountedPriceNeg;

        if (this.discountedPriceNeg) {
            console.log('🍠', this.slectedRow);
            this.changeStatusDiToInMagasin(this.slectedRow);
        }
    }

    nextNegociate2() {
        if (this.secondNegocition) {
            console.log('here 1');

            this.changeStatusNegociate2(this.secondNegocition);
            console.log('here 2');
            this.negocite1Modal = false;
            console.log('here 3');
            this.getDi();
        }
    }

    //---- Files
    exportPdf() {
        // Extract headers from exportColumns
        const headers = this.cols.map((col) => col.header);
        console.log('[headers]:', headers);

        const diList = this.diList.map((di) => [
            di.title,
            di.status,
            di.client_id,
            di.createdBy,
        ]);
        console.log('🦐[diList]:', diList);

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

        console.log('Formatted Data:', formattedData); // Check data structure

        // Asynchronous import with potential Promise.all
        Promise.all([import('jspdf'), import('jspdf-autotable')])
            .then(([jsPDF, { default: autoTable }]) => {
                // Destructure imports
                console.log('[autoTable]:', autoTable);
                const doc = new jsPDF.default('p', 'px', 'a4');
                autoTable(doc, {
                    head: [headers],
                    body: diList,
                });
                doc.save('Users.pdf');
            })
            .catch((err) => {
                // Handle import errors
                console.error('Error importing jsPDF libraries:', err);
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
        console.log('🍖[_idticket]:', _idticket);
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
    // ! CRUDS finish this today
    addCategoryDi() {
        console.log('category input', this.categoryForm.value.categoryName);
        typeof (this.categoryForm.value.categoryName, 'TYPE');
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addCatgoryDi(
                    this.categoryForm.value.categoryName
                ),
            })
            .subscribe(({ data }) => {
                console.log(data, 'data-category_DI');
            });
    }
    addLocation() {
        console.log('category input', this.locationForm.value.locationName);
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addLocation(
                    this.locationForm.value.locationName
                ),
            })
            .subscribe(({ data }) => {
                console.log(data, 'data-emplacement');
                this.openLocationsModal = false;
            });
    }

    allCategoryDi() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllDiCategory(),
            })
            .subscribe(({ data }) => {
                console.log(data.findAllDiCategory, 'all categroy === ');
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
                console.log(data);
                // this.locationDropDown = data.findAllLocation.map((Company) => ({
                //     company_name: `${Company.name}`,
                //     value: Company._id, // ID as value
                // }));
            });
    }

    onUpload(event: any) {
        console.log(event, 'this the event ');

        for (let file of event.files) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result as string;
                this.uploadFile(base64);
            };
        }
        this.messageservice.add({
            severity: 'info',
            summary: 'Image enregistré',
            detail: "l'image a été ajouter avec succès",
        });
    }

    uploadFile(base64: string) {
        const payload = {
            image: base64,
            // add other necessary data here
        };
        console.log('🌮[payload]:', payload);
        this.payloadImage = payload;
        // this.http.post('http://your-backend-url/tickets', payload).subscribe(
        //     (response) => {
        //         console.log('Upload successful', response);
        //     },
        //     (error) => {
        //         console.log('Upload failed', error);
        //     }
        // );
    }
    //! Bon de commande
    // onUploadBonCommande(event: any) {
    //     console.log(event, 'this the event ');

    //     for (let file of event.files) {
    //         const reader = new FileReader();
    //         reader.readAsDataURL(file);
    //         reader.onload = () => {
    //             const base64 = reader.result as string;
    //             this.uploadFileBonCommande(base64);
    //         };
    //     }
    // }

    // uploadFileBonCommande(base64: string) {
    //     const payload = {
    //         pdf: base64,
    //     };
    //     this.payloadBonCommande = payload;
    // }

    deletLocation() {}
    deletCategoryDi() {}
}
