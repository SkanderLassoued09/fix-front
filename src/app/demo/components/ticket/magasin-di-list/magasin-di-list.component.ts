import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
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
import { NotificationService } from 'src/app/demo/service/notification.service';

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
    basicOptions: {
        plugins: { legend: { labels: { color: string } } };
        scales: {
            y: {
                beginAtZero: boolean;
                ticks: {
                    color: string;
                    stepSize: number; // Ensures the interval is 1
                    callback: (value: number) => string;
                };
                grid: { color: string; drawBorder: boolean };
            };
            x: {
                ticks: { color: string };
                grid: { color: string; drawBorder: boolean };
            };
        };
    };
    statusCount: any;
    basicData: {
        labels: any;
        datasets: {
            label: string;
            data: any;
            backgroundColor: string[];
            borderColor: string[];
            borderWidth: number;
        }[];
    };
    nameComposananrSelected: any;
    ignoreCount: any;

    constructor(
        private ticketSerice: TicketService,
        private readonly messageservice: MessageService,
        private apollo: Apollo,
        private router: Router,
        private confirmationService: ConfirmationService,
        private notificationService: NotificationService
    ) {
        this.formUpdateComposant = new FormGroup({
            name: new FormControl(null, Validators.required),
            package: new FormControl(null, Validators.required),
            category_composant_id: new FormControl(null),
            prix_achat: new FormControl(null, Validators.required),
            prix_vente: new FormControl(null, Validators.required),
            coming_date: new FormControl(null, Validators.required),
            link: new FormControl(null),
            quantity_stocked: new FormControl(null, Validators.required),
            pdf: new FormControl(null),
            status: new FormControl(null, Validators.required),
        });
        
    }

    ngOnInit() {
        this.getDi(this.first, this.rows);
        this.getAllComposant();
        this.getStatusCount();
        this.notificationService.notification$.subscribe((message: any) => {
            if (message) {
                this.getDi(this.first, this.rows);
                this.getStatusCount();
            }
        });

        this.formUpdateComposant.statusChanges.subscribe((susb) => {
            console.log('🎂susb', susb);
        });
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
    //
    //         'rowData coming from function',
    //         this.diList.getDiForMagasin.di
    //     );
    // }

    selectedDropDownComposant(selectedItem) {
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
                    this.loadedDataComposant = data.findOneComposant;

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
        this.selectedDi_id = item._id;
        this.ignoreCount = item.ignoreCount;

        if (item && item.ignoreCount && item.ignoreCount > 0) {
            this.apollo
                .query<any>({
                    query: this.ticketSerice.getLogsDiById(
                        item.ignoreCount,
                        item._id
                    ),
                })
                .subscribe(({ data }) => {
                    const logsDi = data?.getLigsById; // Assuming this is the response structure

                    if (logsDi?.array_composants) {
                        this.arrayComposant = logsDi.array_composants
                            .filter((el: any) => el.isUpdated === false)
                            .map((el: any) => {
                                return {
                                    infoComposant:
                                        el.nameComposant + ': ' + el.quantity,
                                    nameComposant: el.nameComposant,
                                    quantity: el.quantity,
                                };
                            });
                    }
                });
        } else {
            this.arrayComposant = item.array_composants
                .filter((el) => el.isUpdated === false)
                .map((el) => {
                    return {
                        infoComposant: el.nameComposant + ': ' + el.quantity,
                        nameComposant: el.nameComposant,
                        quantity: el.quantity,
                    };
                });
        }

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

    getLogsDiById(_id: number) {}

    selectedDropDown(selectedItem) {
        this.nameComposananrSelected = selectedItem.value;
        if (selectedItem.value) {
            this.selectedItem = selectedItem;
            this.apollo
                .query<ComposantByNameQueryResponse>({
                    query: this.ticketSerice.composantByName(
                        selectedItem.value
                    ),
                })
                .subscribe(({ data, loading }) => {
                    this.loadedDataComposant = data.findOneComposant;

                    if (data) {
                        console.log(data.findOneComposant.link,"data");
                        
                        // Initialize form fields with loaded data
                        this.formUpdateComposant.patchValue({
                            name: this.loadedDataComposant.name,
                            package: this.loadedDataComposant.package,
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
                            status: this.selectedstatusComposant,
                        });
                    }
                });
        } else {
            this.formUpdateComposant.reset();
        }
    }

    changeStatusDiToPending2(_id: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.changeStatusDiToPending2(_id),
            })
            .valueChanges.subscribe(({ data, loading }) => {});
    }

    updateComposantIncreation() {
        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements ?',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
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
    setComposantAsUpdate() {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.setComposantAsUpdated(
                    this.selectedDi_id,
                    this.nameComposananrSelected
                ),
            })
            .subscribe(({ data }) => {
                if (data) {
                    // Remove the selected item from the arrayComposant
                    const index = this.arrayComposant.findIndex(
                        (composant) =>
                            composant.nameComposant ===
                            this.nameComposananrSelected
                    );

                    if (index !== -1) {
                        this.arrayComposant.splice(index, 1);
                    }

                    // Optionally, reset the dropdown selection
                    this.nameComposananrSelected = null;
                    this.selectedItem = null;
                }
            });
    }

    updateComposant() {
        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements ?',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
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
                            }
                        },
                        (error) => {
                            console.error('Error updating composant: ', error);
                            // Add error handling logic here if needed
                        }
                    );
            },
        });
        this.getDi(this.first, this.rows);
    }

    finishMagasinEstimation() {
        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements',
            header: 'Confirmation Magasin Estimation',
            icon: 'pi pi-question-circle',
            accept: () => {
                this.changeStatusDiToPending2(this.selectedDi_id);
                this.getDi(this.first, this.rows);
                this.magasinDiDialog = false;
                this.formUpdateComposant.reset();
            },
        });
    }

    onUpload(event: any) {
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
        const payload = {
            image: base64,
            // add other necessary data here
        };

        this.payloadImage = payload;
    }

    addComposant() {
        if (!this.isToUpdate) {
            const composantDataForm = this.composantMagasin.value;

            const composantDataTosend = {
                ...composantDataForm,
                pdf: this.payloadImage?.image || null,
            };

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
                        this.composantMagasin.reset();
                    }
                });
        }

        if (this.isToUpdate) {
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

            this.apollo
                .mutate<any>({
                    mutation: this.ticketSerice.updateComposant(
                        formattedComposantInfo
                    ),
                    useMutationLoading: true,
                })
                .subscribe(({ data }) => {
                    if (data) {
                        this.composantMagasin.reset();
                        // Handle success
                    }
                });
        }

        this.openCreationComposantModal = false;
    }
}
