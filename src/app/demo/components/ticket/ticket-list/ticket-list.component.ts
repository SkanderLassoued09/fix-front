import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Product } from 'src/app/demo/api/product';
import { ProductService } from 'src/app/demo/service/product.service';
import { ALL_USERS, COLUMNS } from './constant-queries';
import { ROLES } from '../../profile/constant/role-constants';

import { MessageService } from 'primeng/api';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { STATUS_DI } from 'src/app/layout/api/status-di';
import { FormControl, FormGroup } from '@angular/forms';
import {
    CreateDiMutationResult,
    DiQueryResult,
    GetClientsQueryResult,
    GetCompaniesQueryResult,
} from './ticket-list.interface';
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
        title: new FormControl(),
        designiation: new FormControl(),
        typeClient: new FormControl(),

        status: new FormControl(),
        client_id: new FormControl(),
        company_id: new FormControl(),
        nSerie: new FormControl(),
    });
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
        { field: '_id', header: 'ID' },
        { field: 'title', header: 'Title' },
        // { field: 'description', header: 'Description' },
        // { field: 'can_be_repaired', header: 'Reparable' },
        // { field: 'bon_de_commande', header: 'BC' },
        // { field: 'bon_de_livraison', header: 'BL' },
        // { field: 'contain_pdr', header: 'PDR' },
        { field: 'status', header: 'Statut' },
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
    discountedPrice1Neg: number;
    slideEnd: any;

    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private readonly messageservice: MessageService
    ) {}

    ngOnInit() {
        this.getDi();
        this.getCompanyList();
        this.getClientList();
    }

    showDialog() {
        this.openAddDiModal = true;
    }
    // this will show only if status allows
    showDialogForPricing(data) {
        console.log('🥘[data]:', data);
        this.seletedRow = data;
        this._idDi = data._id;
        this.array_composants = data.array_composants;

        this.pricingDoalog = true;

        this.changeStatusPricing(data._id);
        this.getTotalComposant(data._id);
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

    changeStatusPricing(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusPricing(_id),
            })
            .subscribe(({ data }) => {
                console.log('🍑[data]:', data);
            });
    }
    getTotalComposant(_id: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.totalComposant(_id),
            })
            .valueChanges.subscribe(({ data }) => {
                console.log('🍝[data]:', data);
                this.totalComposant = data.calculateTicketComposantPrice;
            });
    }

    pricing() {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.pricing(this._idDi, this.price),
            })
            .subscribe(({ data, loading }) => {
                console.log('🍍[data]:', data);
                if (data) {
                    this.changeStatusNegiciate1(this._idDi);
                }
            });
    }

    changeStatusNegiciate1(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusNegociate1(_id),
            })
            .subscribe(({ data }) => {
                console.log('🍑[data]:', data);
            });
    }
    changeStatusNegociate2(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusNegociate2(_id),
            })
            .subscribe(({ data }) => {
                console.log('🍑[data]:', data);
            });
    }
    changeStatusPending3(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusPending3(_id),
            })
            .subscribe(({ data }) => {
                console.log('🍑[data]:', data);
            });
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
            case 'PENDING3':
                return 'success';
            case 'LOWSTOCK':
                return 'warning';
            case 'OUTOFSTOCK':
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

    discountByPercent() {
        this.discountedPrice1Neg =
            (this.totalComposant * this.discountPercent) / 100;

        if (this.discountedPrice1Neg) {
            this.changeStatusNegiciate1(this.seletedRow._id);
        }
    }

    discountByPercent2() {
        this.discountedPrice1Neg =
            (this.totalComposant * this.discountPercent) / 100;

        if (this.discountedPrice1Neg) {
            this.changeStatusPending3(this.seletedRow._id);
        }
    }

    nextNegociate2() {
        this.changeStatusNegociate2(this.seletedRow._id);
    }
}
/**
 * Review all the code function remove unused code
 * TODO add image file, toastr for success and errors
 *
 */
