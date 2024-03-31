import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { TicketService } from 'src/app/demo/service/ticket.service';
import {
    ComposantByNameQueryResponse,
    GetAllMagasinQueryResponse,
    UpdateComposantMutationResponse,
} from './magasin-di-list.interfaces';

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
        { field: 'status', header: 'Statut' },
    ];
    diList: any;
    diListCount: any;
    formMagasin = new FormGroup({
        composant: new FormControl(),
    });
    arrayComposant: any;
    selectedItem: any;
    loadedDataComposant: any;

    constructor(private ticketSerice: TicketService, private apollo: Apollo) {
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
    }

    getSeverity(status: string) {
        switch (status) {
            case 'INSTOCK':
                return 'success';

            case 'EXTERN':
                return 'warning';

            case 'INTERN':
                return 'info';

            default:
                return null;
        }
    }

    openDialogMagasin(item) {
        console.log('🍠[item]:', item);

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

    updateComposant() {
        console.log('🌭', this.formUpdateComposant.value);
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
            });
    }
}
