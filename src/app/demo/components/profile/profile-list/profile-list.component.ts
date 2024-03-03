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
    cols!: Column[];
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
        this.productService.getProducts().then((data) => {
            this.products = data;
        });
        this.cols = [
            { field: 'code', header: 'Code' },
            { field: 'name', header: 'Name' },
            { field: 'category', header: 'Category' },
            { field: 'quantity', header: 'Quantity' },
        ];
    }

    // load() {
    //     this.loading = true;

    //     setTimeout(() => {
    //         this.loading = false;
    //     }, 2000);
    // }

    addSTAFF() {
        // this.loading = true

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
}
