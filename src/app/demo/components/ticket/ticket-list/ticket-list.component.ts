import { Component, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Product } from 'src/app/demo/api/product';
import { ProductService } from 'src/app/demo/service/product.service';
import { ALL_USERS, COLUMNS } from './constant-queries';

@Component({
    selector: 'app-ticket-list',
    standalone: false,

    templateUrl: './ticket-list.component.html',
    styleUrl: './ticket-list.component.scss',
})
export class TicketListComponent implements OnInit {
    users;
    cols: COLUMNS[] = [
        { field: '_id', header: 'ID' },
        { field: 'name', header: 'Name' },
        { field: 'age', header: 'Age' },
        { field: 'breed', header: 'Breed' },
    ];
    constructor(private apollo: Apollo) {}
    ngOnInit(): void {
        this.allUser();
    }
    allUser() {
        this.apollo.query<any>({ query: ALL_USERS }).subscribe(({ data }) => {
            console.log('🍷[data]:', data);
            this.users = data.findAll;
        });
    }

    deleteProduct(data) {
        console.log('🥔[data]:', data);
    }

    editProduct(data) {
        console.log('🍏[data]:', data);
    }
}
