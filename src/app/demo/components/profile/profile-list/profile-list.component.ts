import { Component } from '@angular/core';
import { Product } from 'src/app/demo/api/product';
import { ProductService } from 'src/app/demo/service/product.service';
import { ROLES } from '../constant/role-constants';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
    AllProfileQueryResponse,
    PageEvent,
    ProfileAddMutationResponse,
} from './profile-list.interfaces';
import { debounceTime, Subject } from 'rxjs';

@Component({
    selector: 'app-profile-list',
    templateUrl: './profile-list.component.html',
    styleUrl: './profile-list.component.scss',
})
export class ProfileListComponent {
    // Search state tracking
    private currentSearchField: string = '';
    private currentSearchValue: string = '';
    private searchSubject$ = new Subject<void>();

    staffForm = new FormGroup({
        username: new FormControl(),
        email: new FormControl(),
        password: new FormControl(),
        role: new FormControl(),
        firstName: new FormControl(),
        lastName: new FormControl(),
        phone: new FormControl(),
    });

    visible: boolean = false;
    products!: Product[];
    loading: boolean = false;
    roles;
    cols = [
        { field: 'username', header: 'Username', searchKey: 'username' },
        { field: 'firstName', header: 'Prénom', searchKey: 'firstName' },
        { field: 'lastName', header: 'Nom', searchKey: 'lastName' },
        { field: 'phone', header: 'Téléphone', searchKey: 'phone' },
        { field: 'role', header: 'Role', searchKey: 'role' },
        { field: 'email', header: 'E-mail', searchKey: 'email' },
        { field: 'createdAt', header: 'Créer le', searchKey: 'createdAt' },
        { field: 'updatedAt', header: 'Modifier le', searchKey: 'updatedAt' },
    ];

    first: number = 0;
    page: number;
    rows: number = 10;

    profileList: any;
    totalProfileCount: any;
    profileData: any;
    profileDialog: boolean;
    submitted: boolean = false;

    showDialog() {
        this.visible = true;
    }

    constructor(
        private productService: ProductService,
        private apollo: Apollo,
        private profileService: ProfileService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
    ) {
        this.roles = ROLES;
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
        const hasActiveSearch =
            this.currentSearchField &&
            this.currentSearchValue &&
            this.currentSearchValue.trim().length > 0;

        if (hasActiveSearch) {
            // Perform search
            this.apollo
                .query<any>({
                    query: this.profileService.searchProfile(
                        this.currentSearchField,
                        this.currentSearchValue,
                        this.first,
                        this.rows,
                    ),
                    fetchPolicy: 'no-cache',
                })
                .subscribe(({ data }) => {
                    if (data && data.searchProfile) {
                        this.profileList = data.searchProfile.profileRecord;
                        this.totalProfileCount =
                            data.searchProfile.totalProfileCount;
                    }
                });
        } else {
            // Regular data fetch
            this.profiles(this.first, this.rows);
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

    addSTAFF() {
        this.apollo
            .mutate<ProfileAddMutationResponse>({
                mutation: this.profileService.addProfile(this.staffForm.value),
                useMutationLoading: true,
            })
            .subscribe(({ data, errors, loading }) => {
                this.loading = loading;
                if (data) {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'Le profil ajouté avec succés',
                    });
                    this.loadData(); // Reload data after adding
                    this.staffForm.reset();
                    this.visible = false;
                }
                if (errors) {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: "Erreur lors de l'ajout du profil",
                    });
                }
            });
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;
        this.loadData(); // Use loadData instead of profiles
    }

    profiles(first, rows) {
        this.apollo
            .watchQuery<AllProfileQueryResponse>({
                query: this.profileService.getAllProfile(rows, first),
                useInitialLoading: true,
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.profileList = data.getAllProfiles.profileRecord;
                    this.totalProfileCount =
                        data.getAllProfiles.totalProfileCount;
                }
            });
    }

    getSeverity(status: string) {
        switch (status) {
            case 'ADMIN_MANAGER':
                return 'success';
            case 'ADMIN_TECH':
                return 'warning';
            case 'TECH':
                return 'danger';
            case 'COORDIANTOR':
                return 'info';
            case 'MAGASIN':
                return 'help';
            case 'MANAGER':
                return 'contrast';
            default:
                return 'warn';
        }
    }

    editProfile(profile: any) {
        this.profileData = { ...profile };
        this.profileDialog = true;
    }

    saveUpdateProfile() {
        this.submitted = true;

        if (
            !this.profileData.firstName ||
            !this.profileData.lastName ||
            !this.profileData.phone ||
            !this.profileData.email
        ) {
            return;
        }

        this.apollo
            .mutate<any>({
                mutation: this.profileService.updateProfile(this.profileData),
            })
            .subscribe(({ data }) => {
                if (data) {
                    if (this.profileData._id) {
                        this.profileList[
                            this.findIndexById(this.profileData._id)
                        ] = this.profileData;

                        this.messageService.add({
                            severity: 'success',
                            summary: 'Success',
                            detail: 'Le profil a changé avec succé',
                        });
                        this.profileDialog = false;
                        this.submitted = false;
                        this.loadData(); // Reload data after update
                    }
                }
            });
    }

    cancel() {
        this.profileDialog = false;
        this.submitted = false;
        this.profileData = null;
    }

    findIndexById(_id: string): number {
        let index = -1;
        for (let i = 0; i < this.profileList.length; i++) {
            if (this.profileList[i]._id === _id) {
                index = i;
                break;
            }
        }

        return index;
    }

    deleteProfile(_id: string) {
        this.confirmationService.confirm({
            message: 'Êtes-vous sûr de vouloir supprimer ce profil?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.deleteProfileConfirmed(_id);
            },
        });
    }

    deleteProfileConfirmed(_id: string) {
        this.apollo
            .mutate<any>({ mutation: this.profileService.deleteProfile(_id) })
            .subscribe(({ data }) => {
                if (data) {
                    const index = this.profileList.findIndex((el) => {
                        return el._id === _id;
                    });
                    this.profileList.splice(index, 1);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Succès',
                        detail: 'Profil supprimé',
                        life: 3000,
                    });
                    this.loadData(); // Reload data after delete
                }
            });
    }
}
