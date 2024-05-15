import { Component } from '@angular/core';
import { Product } from 'src/app/demo/api/product';
import { ProductService } from 'src/app/demo/service/product.service';
import { ROLES } from '../constant/role-constants';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { MessageService } from 'primeng/api';
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

    // TODO rectify this 2 any

    profileList: any;
    totalProfileCount: any;
    showDialog() {
        this.visible = true;
    }

    constructor(
        private productService: ProductService,
        private apollo: Apollo,
        private profileService: ProfileService,
        private messageService: MessageService
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
                console.log('🌮[loading]:', loading);
                this.loading = loading;
                if (data) {
                    console.log('🍒[data]:', data);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'Le profil ajouté avec succés',
                    });
                }
                if (errors) {
                    console.log('🍎[errors]:', errors);
                }
            });
    }

    onPageChange(event: PageEvent) {
        console.log('🥝[event]:', event);
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
                console.log('🍏[errors]:', errors);
                console.log('🍜[loading]:', loading);
                console.log('🍠[data]:', data);
                if (data) {
                    this.profileList = data.getAllProfiles.profileRecord;
                    this.totalProfileCount =
                        data.getAllProfiles.totalProfileCount;
                }
            });
    }

    getSeverity(status: string) {
        console.log('🍛[status]:', status);
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
}
