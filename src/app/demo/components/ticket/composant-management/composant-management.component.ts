import { Component } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { TicketService } from 'src/app/demo/service/ticket.service';

@Component({
    selector: 'app-composant-management',
    templateUrl: './composant-management.component.html',
    styleUrl: './composant-management.component.scss',
})
export class ComposantManagementComponent {
    listComposants: any;
    constructor(
        private readonly ticketService: TicketService,
        private apollo: Apollo
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
    deleteComposant(id: number) {}
    updateComposant(composant: any) {}
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
