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

@Component({
    selector: 'app-profile-list',
    templateUrl: './profile-list.component.html',
    styleUrl: './profile-list.component.scss',
})
export class ProfileListComponent {
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
        { field: 'username', header: 'Username' },
        { field: 'firstName', header: 'Prénom' },
        { field: 'lastName', header: 'Nom' },
        { field: 'phone', header: 'Téléphone' },
        { field: 'role', header: 'Role' },
        { field: 'email', header: 'E-mail' },
        { field: 'createdAt', header: 'Créer le' },
        { field: 'updatedAt', header: 'Modifier le' },
    ];
    first: number = 0;
    page: number;
    rows: number = 10;

    profileList: any;
    totalProfileCount: any;
    profileData: any;
    profileDialog: boolean;
    showDialog() {
        this.visible = true;
    }

    constructor(
        private productService: ProductService,
        private apollo: Apollo,
        private profileService: ProfileService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {
        this.roles = ROLES;
    }

    ngOnInit() {
        this.profiles(this.first, this.rows);
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
                }
                if (errors) {
                }
            });
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;
        this.profiles(this.first, this.rows);
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
                return 'danger';
            case 'MAGASIN':
                return 'danger';
            case 'MANAGER':
                return 'danger';
            default:
                return 'warn';
        }
    }

    //  (rowData) {
    //     this.confirmationService.confirm({
    //         message: 'Voulez vous supprimer cette société',
    //         header: 'Confirmation',
    //         icon: 'pi pi-exclamation-triangle',
    //         accept: () => {
    //

    //             this.apollo
    //                 .mutate<any>({
    //                     mutation: this.companyService.removeCompany(
    //                         rowData._id
    //                     ),
    //                 })
    //                 .subscribe(({ data }) => {
    //
    //                 });
    //

    //             this.messageService.add({
    //                 severity: 'warn',
    //                 summary: 'Supprimer',
    //                 detail: `La société ${rowData._id} a été supprimé`,
    //                 life: 3000,
    //             });
    //         },
    //     });
    //     this.companies(this.first, this.rows);
    // }

    /**
     * Edit profile
     */

    editProfile(profile: any) {
        this.profileData = { ...profile };
        this.profileDialog = true;
    }

    saveUpdateProfile() {
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
                    }
                }
            });
    }
    //!!!!!!!!NEZIH
    cancel() {
        // this.profileDialog = false;
        //this.visible = true;
        this.staffForm.reset();
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
            message: 'Are you sure you want to delete the selected profile?',
            header: 'Confirm',
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
                        summary: 'Successful',
                        detail: 'Profile Deleted',
                        life: 3000,
                    });
                }
            });
    }
}
