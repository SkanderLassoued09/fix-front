import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { BehaviorSubject } from 'rxjs';
import { TicketService } from './ticket.service';

/**
 * Ouvre le modal détail PARTAGÉ (`app-di-info-modal`) pour une DI donnée, depuis
 * N'IMPORTE QUELLE page — utilisé par le deep-link des notifications. Le modal
 * global est monté une seule fois dans le layout et piloté par ce service.
 */
@Injectable({ providedIn: 'root' })
export class DiDetailService {
    readonly di$ = new BehaviorSubject<any>(null);
    readonly visible$ = new BehaviorSubject<boolean>(false);
    readonly loading$ = new BehaviorSubject<boolean>(false);

    constructor(
        private readonly apollo: Apollo,
        private readonly ticket: TicketService,
    ) {}

    /** Charge la DI (projection coordinatrice) et ouvre le modal. */
    openById(diId: string): void {
        if (!diId) return;
        this.loading$.next(true);
        this.di$.next(null);
        this.visible$.next(true);
        this.apollo
            .query<any>({
                query: this.ticket.getDiDetail(diId),
                fetchPolicy: 'network-only',
            })
            .subscribe({
                next: ({ data }) => {
                    this.di$.next(data?.getDiDetail ?? null);
                    this.loading$.next(false);
                },
                error: () => this.loading$.next(false),
            });
    }

    setVisible(v: boolean): void {
        this.visible$.next(v);
        if (!v) this.di$.next(null);
    }
}
