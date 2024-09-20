import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { ProductService } from 'src/app/demo/service/product.service';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { UpdateComposantMutationResponse } from '../magasin-di-list.interfaces';

// TODO check type of these fields
export interface Composant {
    _id: string;
    name: string;
    category_composant_id: string;
    coming_date: string;
    link: string;
    package: string;
    pdf: string;
    prix_achat: string;
    prix_vente: string;
    quantity_stocked: string;
    status: string;
}
@Component({
    selector: 'app-details-composant',
    templateUrl: './details-composant.component.html',
    styleUrl: './details-composant.component.scss',
})
export class DetailsComposantComponent implements OnInit {
    products;
    composants: any[];
    formUpdateComposant: FormGroup;
    selectedDi_id: any;

    composantValues: Composant;
    isActive: boolean;
    private _id: string;
    constructor(
        private ticketSerice: TicketService,
        private productService: ProductService,
        private route: ActivatedRoute,
        private apollo: Apollo,
        private readonly router: Router
    ) {
        this._id = this.route.snapshot.paramMap.get('id');

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

    ngOnInit(): void {
        this.getDiByID(this._id);
        this.productService
            .getProductsSmall()
            .then((cars) => (this.products = cars));
    }

    getCompsantInfo(selectedComposant: string) {
        // get the value of current form and affect it to value displayed
        this.apollo
            .query<any>({
                query: this.ticketSerice.composantByName(selectedComposant),
            })
            .subscribe(({ data }) => {
                console.log(
                    data,
                    'this is my data coming from composant querys'
                );
                this.composantValues = data.findOneComposant;
                if (data) {
                    // Initialize form fields with loaded data
                    // TODO Change response from the server to object of data not boolean
                    this.formUpdateComposant.patchValue({
                        name: this.composantValues.name,
                        package: this.composantValues.package,
                        category_composant_id:
                            this.composantValues.category_composant_id,
                        prix_achat: this.composantValues.prix_achat,
                        prix_vente: this.composantValues.prix_vente,
                        coming_date: this.composantValues.coming_date,
                        link: this.composantValues.link,
                        quantity_stocked: this.composantValues.quantity_stocked,
                        pdf: this.composantValues.pdf,
                        status: this.composantValues.status,
                    });
                }
            });
    }
    select(data) {
        this.getCompsantInfo(data.nameComposant);
    }

    getDiByID(_id: string) {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getDiByID(_id),
            })
            .subscribe(({ data }) => {
                this.composants = data.getDiById.array_composants;
            });
    }

    changeStatusDiToPending2(_id: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.changeStatusDiToPending2(_id),
            })
            .valueChanges.subscribe(({ data }) => {});
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
                    // Update composantValues with the latest form values
                    Object.assign(
                        this.composantValues,
                        this.formUpdateComposant.value
                    );
                    console.log(
                        '🥒[   this.composantValues]:',
                        this.composantValues
                    );
                    this.changeStatusDiToPending2(this.selectedDi_id);
                    this.isActive = false;
                }
            });
    }

    changeStatusPending3() {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusPending3(this._id),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.router.navigate(['/tickets/ticket/magasin-di-list']);
                }
            });
    }
    // map over the array of composant existed in tickets data
    // get composant data by id to update them
    //*******THESE APIs ARE ALREADY IMPLMENNTED IN TICKET COMPONENT YOU JUES NEED TO CHANGE THE PLACE */
    // when btn EDIT click show inputs with value
    // when click save or cancel hide input if save get these data from the form
}
