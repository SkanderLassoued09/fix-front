import { Component } from '@angular/core';
import { Product } from 'src/app/demo/api/product';
import { ProductService } from 'src/app/demo/service/product.service';
import { ROLES } from '../constant/role-constants';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { MessageService } from 'primeng/api';
interface Column {
    field: string;
    header: string;
}
interface PageEvent {
    first: number;
    rows: number;
    page: number;
    pageCount: number;
}

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
        { field: '_id', header: 'Code' },
        { field: 'username', header: 'Username' },
        { field: 'firstName', header: 'Prénom' },
        { field: 'lastName', header: 'Nom' },
        { field: 'phone', header: 'Téléphone' },
        { field: 'role', header: 'Role' },
        { field: 'email', header: 'E-mail' },
        { field: 'createdAt', header: 'Créé le' },
        { field: 'updatedAt', header: 'Mise à jour le' },
    ];
    first: number = 0;
    page: number;
    rows: number = 10;
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
            .mutate<any>({
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
            .watchQuery<any>({
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
}
