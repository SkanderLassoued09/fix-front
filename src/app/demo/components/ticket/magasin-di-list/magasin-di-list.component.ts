import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { TicketService } from 'src/app/demo/service/ticket.service';
import {
    ComposantByNameQueryResponse,
    GetAllMagasinQueryResponse,
    UpdateComposantMutationResponse,
} from './magasin-di-list.interfaces';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PageEvent } from '../../profile/profile-list/profile-list.interfaces';

@Component({
    selector: 'app-magasin-di-list',
    templateUrl: './magasin-di-list.component.html',
    styleUrl: './magasin-di-list.component.scss',
})
export class MagasinDiListComponent {
    statusComposant = [
        { name: 'En stock', value: 'En stock' },
        { name: 'Interne', value: 'Interne' },
        { name: 'Externe', value: 'Externe' },
    ];
    formUpdateComposant: FormGroup;
    // TODO change it to file of constant and instead of array of string , change it to object key value
    //! Done but you did not use it in here
    magasinDiDialog: boolean = false;
    cols = [
        { field: '_id', header: 'ID' },
        { field: 'title', header: 'Title' },
        { field: 'status', header: 'Status' },
    ];
    diList: any;
    diListCount: any;
    formMagasin = new FormGroup({
        composant: new FormControl(),
    });
    arrayComposant: any;
    selectedItem: any;
    loadedDataComposant: any;
    selectedDi_id: any;
    selectedstatusComposant: string;
    openCreationComposantModal: boolean;
    payloadImage: { image: string };
    first: number = 0;
    rows: number = 10;
    page: any;
    // Please do not use camel case in varaibles
    //MagasinEstimation_Condition: boolean = true;
    //MagasinCondition: boolean = true;

    composantMagasin = new FormGroup({
        name: new FormControl(),
        packageComposant: new FormControl(),
        category_composant_id: new FormControl(),
        link: new FormControl(),
        pdf: new FormControl(),
        quantity_stocked: new FormControl(),
        status: new FormControl(),
        prix_vente: new FormControl(),
        coming_date: new FormControl(),
        prix_achat: new FormControl(),
    });
    composantList: any;
    isToUpdate: boolean = false;

    constructor(
        private ticketSerice: TicketService,
        private readonly messageservice: MessageService,
        private apollo: Apollo,
        private router: Router,
        private confirmationService: ConfirmationService
    ) {
        this.formUpdateComposant = new FormGroup({
            name: new FormControl(),
            package: new FormControl(),
            category_composant_id: new FormControl(),
            prix_achat: new FormControl(),
            prix_vente: new FormControl(),
            coming_date: new FormControl(),
            link: new FormControl(),
            quantity_stocked: new FormControl(),
            pdf: new FormControl(),
            status: new FormControl(),
        });
    }

    ngOnInit() {
        this.getDi(this.first, this.rows);
        this.getAllComposant();
        //this.Magasin_buttonCondition();
    }
    annulerMagasinEstimation() {
        this.magasinDiDialog = false;
        this.openCreationComposantModal = false;
        this.formMagasin.reset();
        this.composantMagasin.reset();
    }
    showDialogcomposantCreation() {
        this.openCreationComposantModal = true;
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
    // Magasin_buttonCondition() {
    //     console.log(
    //         'rowData coming from function',
    //         this.diList.getDiForMagasin.di
    //     );
    // }

    selectedDropDownComposant(selectedItem) {
        console.log('🥕[selectedItem]:', selectedItem);
        this.isToUpdate = true;
        this.selectedItem = selectedItem;
        if (selectedItem.value) {
            this.apollo
                .query<ComposantByNameQueryResponse>({
                    query: this.ticketSerice.composantByName(
                        selectedItem.value
                    ),
                })
                .subscribe(({ data, loading }) => {
                    console.log('🥛[data]:', data);
                    this.loadedDataComposant = data.findOneComposant;
                    console.log('🍐', this.loadedDataComposant);
                    if (data) {
                        // Initialize form fields with loaded data
                        this.composantMagasin.patchValue({
                            name: this.loadedDataComposant.name,
                            packageComposant: this.loadedDataComposant.package,
                            category_composant_id:
                                this.loadedDataComposant.category_composant_id,
                            prix_achat: this.loadedDataComposant.prix_achat,
                            prix_vente: this.loadedDataComposant.prix_vente,
                            coming_date: new Date(
                                this.loadedDataComposant.coming_date
                            ),
                            link: this.loadedDataComposant.link,
                            quantity_stocked:
                                this.loadedDataComposant.quantity_stocked,
                            pdf: this.loadedDataComposant.pdf,
                            status: this.loadedDataComposant.status_composant,
                        });
                    }
                });
        }

        if (!selectedItem.value) {
            this.composantMagasin.reset();
        }
    }
    openDialogMagasin(item) {
        console.log('🍨[item]:', item);
        this.selectedDi_id = item._id;

        this.arrayComposant = item.array_composants.map((el) => {
            return {
                infoComposant: el.nameComposant + ': ' + el.quantity,
                nameComposant: el.nameComposant,
                quantity: el.quantity,
            };
        });

        this.magasinDiDialog = true;
    }
    //last add
    MagasinEstimation_Condition() {} //! open only when status === MagasinEstimation
    Magasin_Condition() {} //! open only when status === In Magasin

    takeMetoDetailsComponent(dataRowselected) {
        const _id = dataRowselected._id;
        this.router.navigate(['tickets/ticket/details', _id]);
    }

    getAllComposant() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllComposant(),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.composantList = data.findAllComposant;
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
            .watchQuery<GetAllMagasinQueryResponse>({
                query: this.ticketSerice.getAllMagasin(first, rows),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.diList = data.getDiForMagasin.di;

                    this.diListCount = data.getDiForMagasin.totalDiCount;
                }
            });
    }

    getSelectedStatus(statusComposant: any) {
        this.selectedstatusComposant = statusComposant.value;
    }

    selectedDropDown(selectedItem) {
        this.selectedItem = selectedItem;
        this.apollo
            .query<ComposantByNameQueryResponse>({
                query: this.ticketSerice.composantByName(selectedItem.value),
            })
            .subscribe(({ data, loading }) => {
                this.loadedDataComposant = data.findOneComposant;
                console.log('🍐', this.loadedDataComposant.pdf);
                if (data) {
                    // Initialize form fields with loaded data
                    this.formUpdateComposant.patchValue({
                        name: this.loadedDataComposant.name,
                        package: this.loadedDataComposant.package,
                        category_composant_id:
                            this.loadedDataComposant.category_composant_id,
                        prix_achat: this.loadedDataComposant.prix_achat,
                        prix_vente: this.loadedDataComposant.prix_vente,
                        coming_date: this.loadedDataComposant.coming_date,
                        link: this.loadedDataComposant.link,
                        quantity_stocked:
                            this.loadedDataComposant.quantity_stocked,
                        pdf: this.loadedDataComposant.pdf,
                        status: this.selectedstatusComposant,
                    });
                }
            });
    }

    changeStatusDiToPending2(_id: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.changeStatusDiToPending2(_id),
            })
            .valueChanges.subscribe(({ data, loading }) => {});
    }

    updateComposantIncreation() {
        console.log('working update');

        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements ?',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                console.log('inside condition working');

                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.updateComposant(
                            this.composantMagasin.value
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(
                        ({ data }) => {
                            if (data) {
                            }
                        },
                        (error) => {
                            console.error('Error updating composant: ', error);
                            // Add error handling logic here if needed
                        }
                    );
            },
        });
    }

    updateComposant() {
        console.log('working update');

        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements ?',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                console.log('inside condition working');

                this.apollo
                    .mutate<UpdateComposantMutationResponse>({
                        mutation: this.ticketSerice.updateComposant(
                            this.formUpdateComposant.value
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(
                        ({ data }) => {
                            if (data) {
                                this.changeStatusDiToPending2(
                                    this.selectedDi_id
                                );
                                this.getDi(this.first, this.rows);
                                this.magasinDiDialog = false;
                            }
                        },
                        (error) => {
                            console.error('Error updating composant: ', error);
                            // Add error handling logic here if needed
                        }
                    );
            },
        });
    }

    onUpload(event: any) {
        console.log('onUpload');
        for (let file of event.files) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result as string;
                this.uploadFile(base64);
            };
        }
    }

    uploadFile(base64: string) {
        console.log('🍢uploadFile');
        const payload = {
            image: base64,
            // add other necessary data here
        };

        this.payloadImage = payload;
    }

    addComposant() {
        if (!this.isToUpdate) {
            console.log('🌮to create');
            const composantDataForm = this.composantMagasin.value;

            const composantDataTosend = {
                ...composantDataForm,
                pdf: this.payloadImage.image,
            };

            console.log({ composantDataForm });

            this.apollo
                .mutate<any>({
                    mutation:
                        this.ticketSerice.addComposantMagasin(
                            composantDataTosend
                        ),
                })
                .subscribe(({ data }) => {
                    if (data) {
                        this.messageservice.add({
                            severity: 'success',
                            summary: 'Success',
                            detail: 'Le composant a été créer',
                        });
                    }
                });
        }

        if (this.isToUpdate) {
            console.log('🍼️update');
            const formattedComposantInfo = {
                name: this.composantMagasin.value.name,
                package: this.composantMagasin.value.packageComposant,

                prix_achat: this.composantMagasin.value.prix_achat,
                prix_vente: this.composantMagasin.value.prix_vente,
                coming_date: new Date(
                    this.composantMagasin.value.coming_date
                ).toISOString(),
                link: this.composantMagasin.value.link,
                quantity_stocked: this.composantMagasin.value.quantity_stocked,
                pdf: this.composantMagasin.value.pdf,
                status_composant: this.composantMagasin.value.status,
            };
            console.log({ formattedComposantInfo });

            this.apollo
                .mutate<any>({
                    mutation: this.ticketSerice.updateComposant(
                        formattedComposantInfo
                    ),
                    useMutationLoading: true,
                })
                .subscribe(({ data }) => {
                    if (data) {
                        console.log('🥚[data]:', data);
                        // Handle success
                    }
                });
        }

        this.openCreationComposantModal = false;
    }
}
