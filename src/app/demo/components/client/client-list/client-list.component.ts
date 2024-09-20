import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ClientService } from 'src/app/demo/service/client.service';
import { REGION } from '../constant/region-constant';

// Separate interface file
interface Column {
    field: string;
    header: string;
}

interface AddClientMutationResponse {
    createClient: {
        _id: string;
    };
}

interface PageEvent {
    first: number;
    rows: number;
    page: number;
    pageCount: number;
}

interface GetAllClientQueryResponse {
    findAllClient: {
        clientRecords: {
            _id: string;
            first_name: string;
            last_name: string;
            region: string;
            address: string;
            email: string;
            phone: string;
        }[];
        totalClientRecord: number;
    };
}

@Component({
    selector: 'app-client-list',
    templateUrl: './client-list.component.html',
    styleUrl: './client-list.component.scss',
})
export class ClientListComponent {
    clientForm = new FormGroup({
        first_name: new FormControl(),
        last_name: new FormControl(),
        region: new FormControl(),
        address: new FormControl(),
        email: new FormControl(),
        phone: new FormControl(),
    });

    visible: boolean = false;
    clientsList: any;
    loading: boolean = false;
    region;
    cols = [
        { field: 'first_name', header: 'Prénom' },
        { field: 'last_name', header: 'Nom' },
        { field: 'email', header: 'E-mail' },
        { field: 'region', header: 'Région' },
        { field: 'phone', header: 'Téléphone' },
        { field: 'address', header: 'Adresse' },
    ];
    first: number = 0;
    rows: number = 10;
    clientModalCondition: boolean = false;
    submitted: boolean;
    selectedProducts: null;
    totalClientRecord: any;
    clientData: any;

    constructor(
        private apollo: Apollo,
        private clientService: ClientService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {
        this.region = REGION;
    }

    ngOnInit() {
        this.clients(this.first, this.rows);
    }

    showDialog() {
        this.visible = true;
    }

    addClient() {
        const { region, ...data } = this.clientForm.value;
        const clientData = { ...data, region: region.name };
        this.apollo
            .mutate<AddClientMutationResponse>({
                mutation: this.clientService.addClient(clientData),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                this.loading = loading;
                if (data) {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'Le client ajouté avec succés',
                    });
                    this.clients(this.first, this.rows);
                    this.visible = false;
                }
                if (errors) {
                }
            });
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.rows = event.rows;
        this.clients(this.first, this.rows);
    }

    clients(first, rows) {
        this.apollo
            .watchQuery<GetAllClientQueryResponse>({
                query: this.clientService.getAllClient(this.rows, this.first),
                useInitialLoading: true,
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                this.loading = loading;
                if (data) {
                    this.clientsList = data.findAllClient.clientRecords;

                    this.totalClientRecord =
                        data.findAllClient.totalClientRecord;
                }
            });
    }

    editClient(client: any) {
        this.clientData = { ...client };

        this.clientModalCondition = true;
    }

    updateClient() {
        this.apollo
            .mutate<any>({
                mutation: this.clientService.updateClient(this.clientData),
            })
            .subscribe(({ data }) => {
                if (data) {
                    if (this.clientData._id) {
                        this.clientsList[
                            this.findIndexById(this.clientData._id)
                        ] = this.clientData;

                        this.messageService.add({
                            severity: 'success',
                            summary: 'Success',
                            detail: 'Le client a été modifié avec succés',
                        });
                        this.clientModalCondition = false;
                    }
                }
            });
    }

    deleteSelectedClient(_id: string) {
        this.confirmationService.confirm({
            message: 'Voulez vous supprimer ce client',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.deleteClientConfirmed(_id);
            },
        });
    }

    deleteClientConfirmed(_id: string) {
        this.apollo
            .mutate<any>({ mutation: this.clientService.removeClient(_id) })
            .subscribe(({ data }) => {
                if (data) {
                    const index = this.clientsList.findIndex((el) => {
                        return el._id === _id;
                    });
                    this.clientsList.splice(index, 1);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'Le client a été supprimé',
                        life: 3000,
                    });
                }
            });
    }

    cancel() {
        this.clientModalCondition = false;
        this.clientForm.reset();
    }

    findIndexById(_id: string): number {
        let index = -1;
        for (let i = 0; i < this.clientsList.length; i++) {
            if (this.clientsList[i]._id === _id) {
                index = i;
                break;
            }
        }
        return index;
    }
}
