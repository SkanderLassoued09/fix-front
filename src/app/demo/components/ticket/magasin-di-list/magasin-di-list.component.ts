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

@Component({
    selector: 'app-magasin-di-list',
    templateUrl: './magasin-di-list.component.html',
    styleUrl: './magasin-di-list.component.scss',
})
export class MagasinDiListComponent {
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
    //MagasinEstimation_Condition: boolean = true;
    //MagasinCondition: boolean = true;

    constructor(
        private ticketSerice: TicketService,
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

    getSeverity(status: string) {
        console.log('🍛DI => [status]:', status);
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
        console.log('🍠[item]:', item);
        this.selectedDi_id = item._id;

        this.arrayComposant = item.array_composants.map((el) => {
            return {
                infoComposant: el.nameComposant + ': ' + el.quantity,
                nameComposant: el.nameComposant,
                quantity: el.quantity,
            };
        });
        console.log('🥝[  this.arrayComposant]:', this.arrayComposant);
        this.magasinDiDialog = true;
    }
    //last add
    MagasinEstimation_Condition() {} //! open only when status === MagasinEstimation
    Magasin_Condition() {} //! open only when status === In Magasin

    takeMetoDetailsComponent(dataRowselected) {
        console.log('Hello', dataRowselected._id);
        const _id = dataRowselected._id;
        this.router.navigate(['tickets/ticket/details', _id]);
    }

    getDi() {
        this.apollo
            .watchQuery<GetAllMagasinQueryResponse>({
                query: this.ticketSerice.getAllMagasin(),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                console.log('🥕[errors]:', errors);
                console.log('🍸[loading]:', loading);
                console.log('🍼️[data]:', data);
                if (data) {
                    this.diList = data.getDiForMagasin.di;
                    console.log('🍭[ this.diList]:', this.diList);
                    this.diListCount = data.getDiForMagasin.totalDiCount;
                }
            });
    }

    selectedDropDown(selectedItem) {
        console.log('🥥[selectedItem]:', selectedItem);
        this.selectedItem = selectedItem;
        this.apollo
            .query<ComposantByNameQueryResponse>({
                query: this.ticketSerice.composantByName(selectedItem.value),
            })
            .subscribe(({ data, loading }) => {
                console.log('🍱[data]:', data);
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
                        status: this.loadedDataComposant.status,
                    });
                }
            });
    }

    changeStatusDiToPending2(_id: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.changeStatusDiToPending2(_id),
            })
            .valueChanges.subscribe(({ data, loading }) => {
                console.log('🍩[data]:', data);
            });
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
                console.log('🥐[loading]:', loading);
                console.log('🌮[data]:', data);

                if (data) {
                    this.changeStatusDiToPending2(this.selectedDi_id);
                    this.getDi();
                    this.magasinDiDialog = false;
                }
            });
    }
}
