import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ClientService } from 'src/app/demo/service/client.service';
import { REGION } from '../constant/region-constant';
import { debounceTime, finalize, Subject } from 'rxjs';

// Separate interface file
interface Column {
    field: string;
    header: string;
    searchKey?: string;
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
    // Search state tracking
    private currentSearchField: string = '';
    private currentSearchValue: string = '';
    private searchSubject$ = new Subject<void>();

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
    cols: Column[] = [
        { field: 'first_name', header: 'Prénom', searchKey: 'first_name' },
        { field: 'last_name', header: 'Nom', searchKey: 'last_name' },
        { field: 'email', header: 'E-mail', searchKey: 'email' },
        { field: 'region', header: 'Région', searchKey: 'region' },
        { field: 'phone', header: 'Téléphone', searchKey: 'phone' },
        { field: 'address', header: 'Adresse', searchKey: 'address' },
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
        private confirmationService: ConfirmationService,
    ) {
        this.region = REGION;
    }

    ngOnInit() {
        // Setup search with debounce
        this.searchSubject$.pipe(debounceTime(400)).subscribe(() => {
            this.loadData();
        });

        // Initial load
        this.loadData();
    }

    /**
     * Centralized data loading method
     * Handles both search and regular data fetching with pagination
     */
    loadData() {
        this.loading = true;

        const hasActiveSearch =
            this.currentSearchField &&
            this.currentSearchValue &&
            this.currentSearchValue.trim().length > 0;

        if (hasActiveSearch) {
            // Perform search
            this.apollo
                .query<any>({
                    query: this.clientService.searchClient(
                        this.currentSearchField,
                        this.currentSearchValue,
                        this.first,
                        this.rows,
                    ),
                    fetchPolicy: 'no-cache',
                })
                .pipe(finalize(() => (this.loading = false)))
                .subscribe(({ data }) => {
                    if (data && data.searchClient) {
                        this.clientsList = data.searchClient.clientRecords;
                        this.totalClientRecord =
                            data.searchClient.totalClientRecord;
                    }
                });
        } else {
            // Regular data fetch
            this.clients();
        }
    }

    /**
     * Handle column search
     */
    onColumnSearch(field: string, value: string) {
        const v = value?.trim();
        const f = field?.trim();

        if (v && v.length > 0 && f && f.length > 0) {
            // Set search state
            this.currentSearchField = f;
            this.currentSearchValue = v;
            this.first = 0; // Reset to first page on new search

            // Trigger search
            this.searchSubject$.next();
        } else {
            // Clear search state
            this.currentSearchField = '';
            this.currentSearchValue = '';

            // Load regular data
            this.loadData();
        }
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
                        summary: 'Succès',
                        detail: 'Le client ajouté avec succès',
                    });
                    this.loadData(); // Reload data after adding
                    this.clientForm.reset();
                    this.visible = false;
                }
                if (errors) {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Erreur',
                        detail: "Erreur lors de l'ajout du client",
                    });
                }
            });
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.rows = event.rows;
        this.loadData(); // Use loadData instead of clients
    }

    clients() {
        this.apollo
            .query<GetAllClientQueryResponse>({
                query: this.clientService.getAllClient(this.rows, this.first),
                fetchPolicy: 'no-cache',
            })
            .pipe(finalize(() => (this.loading = false)))
            .subscribe(({ data }) => {
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
        this.submitted = true;

        if (!this.clientData.first_name || !this.clientData.last_name) {
            return;
        }

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
                            summary: 'Succès',
                            detail: 'Le client a été modifié avec succès',
                        });
                        this.clientModalCondition = false;
                        this.submitted = false;
                        this.loadData(); // Reload data after update
                    }
                }
            });
    }

    deleteSelectedClient(_id: string) {
        this.confirmationService.confirm({
            message: 'Voulez-vous supprimer ce client?',
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
                        summary: 'Succès',
                        detail: 'Le client a été supprimé',
                        life: 3000,
                    });
                    this.loadData(); // Reload data after delete
                }
            });
    }

    cancel() {
        this.clientModalCondition = false;
        this.submitted = false;
        this.clientForm.reset();
        this.clientData = null;
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
