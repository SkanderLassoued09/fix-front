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
import { MessageService } from 'primeng/api';

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
    // Please do not use camel case in varaibles
    //MagasinEstimation_Condition: boolean = true;
    //MagasinCondition: boolean = true;

    composantMagasin = new FormGroup({
        _idComposant: new FormControl(), // ???
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

    constructor(
        private ticketSerice: TicketService,
        private readonly messageservice: MessageService,
        private apollo: Apollo,
        private router: Router
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
        this.getDi();
        //this.Magasin_buttonCondition();
    }
    annulerMagasinEstimation() {
        this.magasinDiDialog = false;
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
    openDialogMagasin(item) {
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

    getDi() {
        this.apollo
            .watchQuery<GetAllMagasinQueryResponse>({
                query: this.ticketSerice.getAllMagasin(),
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

    updateComposant() {
        this.apollo
            .mutate<UpdateComposantMutationResponse>({
                mutation: this.ticketSerice.updateComposant(
                    this.formUpdateComposant.value
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                if (data) {
                    this.changeStatusDiToPending2(this.selectedDi_id);
                    this.getDi();
                    this.magasinDiDialog = false;
                }
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
        // this.http.post('http://your-backend-url/tickets', payload).subscribe(
        //     (response) => {
        //
        //     },
        //     (error) => {
        //
        //     }
        // );
    }

    addComposant() {
        const composantDataForm = this.composantMagasin.value;
        const composantDataTosend = {
            ...composantDataForm,
            pdf: this.payloadImage,
        };

        this.apollo
            .mutate<any>({
                mutation:
                    this.ticketSerice.addComposantMagasin(composantDataTosend),
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
        this.openCreationComposantModal = false;
    }
}
