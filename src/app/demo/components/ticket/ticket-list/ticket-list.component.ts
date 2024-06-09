import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Product } from 'src/app/demo/api/product';

import { MessageService } from 'primeng/api';
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

    sizes = [
        { name: 'Small', class: 'p-datatable-sm' },
        { name: 'Normal', class: '' },
        { name: 'Large', class: 'p-datatable-lg' },
    ];
    openAddDiModal: boolean = false;
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

    diList: any;
    diListCount: any;
    statusDI: STATUS_DI = STATUS_DI.CREATED;
    clientListDropDown: any;
    companiesListDropDown: any;
    loadingCreatingDi: boolean;
    pricingDoalog: boolean = false;
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

    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private readonly messageservice: MessageService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.getDi();
        this.getCompanyList();
        this.getClientList();
    }

    showDialog() {
        this.openAddDiModal = true;
    }

    confirmerNegociation() {
        console.log('hello');
        this.nego1nego2_InMagasin(this._idDi, this.price, this.finalPrice);
        this.changeStatusDiToInMagasin(this._idDi);
        console.log('Confirmer Nego1 success');
        this.negocite1Modal = false;
    }

    // this will show only if status allows
    //! working here *******************************************************
    showDialogForPricing(data) {
        this.seletedRow = data;
        let MyID = data._id;
        console.log('verifiing the ID', MyID);

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
            });

        this.current_id = data._id;
        for (let oneComposant of data.array_composants) {
            this.getcomposantByName(oneComposant.nameComposant);
            console.log('data quantity from here', oneComposant.quantity);
        }

        console.log('DATA FROM allcomposant query', this.allComposants);
        console.log('length all composant', this.allComposants.length);

        this.pricingDoalog = true;

        //! fnction delte here and add in the confirmer BTN

        this.changeStatusPricing(data._id);
        this.getTotalComposant(data._id);
    }
    showDialogForNegociate1(data) {
        this.seletedRow = data._id;

        this._idDi = this.seletedRow;

        this.getDiByID(this._idDi);
        this.secondNegocition = data._id;
        console.log('🍈[ this.s]:', this.s);
        this.negocite1Modal = true;
        this.getTotalComposant(data._id);
    }
    showDialogForNegociate2(data) {
        this.slectedRow = data._id;
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

                    this.changeStatusNegiciate1(this.current_id);
                }
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

    onUpload(event: UploadEvent) {
        for (let file of event.files) {
            this.uploadedFiles.push(file);
        }
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
        } = this.creationDiForm.value;
        const diInfo = {
            title,
            designiation,
            client_id,
            company_id,
            nSerie,
            status: this.statusDI,
            typeClient,
        };
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
                    this.creationDiForm.reset();
                    this.openAddDiModal = false;
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
                    this.companiesListDropDown = data.getAllComapnyforDropDown;
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
            .subscribe(({ data }) => {});
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
            .subscribe(({ data }) => {
                console.log('data', data);
            });
    }

    //! Nan c bon
    // the discount function the price and the discounts are affected
    //in the confirmation btn the mutation is fired

    discountByPercent() {
        this.discountedPriceNeg = (this.price * this.discountPercent) / 100;
        this.finalPrice = this.price - this.discountedPriceNeg;
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
            this.changeStatusNegociate2(this.secondNegocition);
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
}
/**
 * Review all the code function remove unused code
 * TODO add image file, toastr for success and errors
 *
 */
