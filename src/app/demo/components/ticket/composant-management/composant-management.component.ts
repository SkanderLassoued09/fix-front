import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ConfirmationService } from 'primeng/api';
import { TicketService } from 'src/app/demo/service/ticket.service';

@Component({
    selector: 'app-composant-management',
    templateUrl: './composant-management.component.html',
    styleUrl: './composant-management.component.scss',
})
export class ComposantManagementComponent {
    listComposants: any;
    openModalEdit: boolean = false;
    selectedComposant: any;
    statusComposant = [
        { name: 'En stock', value: 'En stock' },
        { name: 'Interne', value: 'Interne' },
        { name: 'Externe', value: 'Externe' },
    ];
    updateComposantForm = new FormGroup({
        _id: new FormControl(null),

        package: new FormControl('', Validators.required),
        prix_achat: new FormControl(null, Validators.required),
        prix_vente: new FormControl(null, Validators.required),

        coming_date: new FormControl(null),

        quantity_stocked: new FormControl(0, Validators.required),
        status_composant: new FormControl('', Validators.required),
    });
    constructor(
        private readonly ticketService: TicketService,
        private readonly apollo: Apollo,
        private readonly confirmationService: ConfirmationService
    ) {}
    ngOnInit() {
        this.getAllComposants();
    }

    getAllComposants() {
        this.apollo
            .query<any>({ query: this.ticketService.getAllComposant() })
            .subscribe(({ data }) => {
                console.log('data composants', data);
                this.listComposants = data.findAllComposant;
            });
    }
    deleteComposant(_id: string) {
        this.confirmationService.confirm({
            message: 'Voulez-vous Supprimer ce composant ?',
            header: 'Confirmation Suppression',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketService.removeComposant(_id),
                    })
                    .subscribe(({ data }) => {
                        console.log('🥨[data]:', data);
                        if (data) {
                            this.getAllComposants();
                        }
                    });
            },
        });
    }
    updateComposant(composant: any) {
        console.log('composant to update:', composant);

        this.updateComposantForm.patchValue({
            _id: composant._id,
            package: composant.package,
            prix_achat: composant.prix_achat,
            prix_vente: composant.prix_vente,
            coming_date: composant.coming_date
                ? new Date(composant.coming_date)
                : null,
            quantity_stocked: composant.quantity_stocked,
            status_composant: composant.status_composant,
        });

        this.openModalEdit = true;
    }

    saveComposant() {
        const patchedValue = this.updateComposantForm.value;

        console.log('updateComposantIncreation', patchedValue);
        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements ?',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketService.updateComposantTable({
                            _id: this.updateComposantForm.value._id,
                            ...patchedValue,
                        }),
                        useMutationLoading: true,
                    })
                    .subscribe(
                        ({ data }) => {
                            if (data) {
                                console.log('helo');
                                this.getAllComposants();
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

    getFormattedDate(date: string | null): string {
        if (!date) return '-';
        const d = new Date(date);
        return isNaN(d.getTime()) ? '-' : d.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    formatValue(value: any): string {
        return value !== null &&
            value !== undefined &&
            value !== 'undefined' &&
            value !== 'null'
            ? value
            : '-';
    }
}
