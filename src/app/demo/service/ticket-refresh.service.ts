import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { debounceTime, map, share, tap } from 'rxjs/operators';

export type TicketRefreshViewKey =
    | 'ticket-list'
    | 'coordinator-list'
    | 'magasin-list'
    | 'tech-list'
    | string;

interface RefreshRequest {
    reason?: any;
    requestedAt: string;
}

@Injectable({
    providedIn: 'root',
})
export class TicketRefreshService {
    private readonly debounceMs = 350;
    private readonly subjects = new Map<string, Subject<RefreshRequest>>();
    private readonly streams = new Map<string, Observable<void>>();
    private readonly pendingCounts = new Map<string, number>();

    requestRefresh(viewKey: TicketRefreshViewKey, reason?: any): void {
        const key = this.normalizeViewKey(viewKey);
        const nextCount = (this.pendingCounts.get(key) || 0) + 1;

        this.pendingCounts.set(key, nextCount);
        this.log('ticket.refresh.requested', key, {
            pendingCount: nextCount,
            reason,
        });

        this.getSubject(key).next({
            reason,
            requestedAt: new Date().toISOString(),
        });
    }

    listen(viewKey: TicketRefreshViewKey): Observable<void> {
        const key = this.normalizeViewKey(viewKey);
        const existingStream = this.streams.get(key);

        if (existingStream) {
            return existingStream;
        }

        const stream = this.getSubject(key).pipe(
            debounceTime(this.debounceMs),
            tap((request) => {
                const collapsedCount = this.pendingCounts.get(key) || 0;

                this.log('ticket.refresh.emitted', key, {
                    collapsedCount,
                    lastReason: request.reason,
                    requestedAt: request.requestedAt,
                });

                this.pendingCounts.set(key, 0);
            }),
            map(() => undefined),
            share(),
        );

        this.streams.set(key, stream);
        return stream;
    }

    private getSubject(viewKey: string): Subject<RefreshRequest> {
        let subject = this.subjects.get(viewKey);

        if (!subject) {
            subject = new Subject<RefreshRequest>();
            this.subjects.set(viewKey, subject);
        }

        return subject;
    }

    private normalizeViewKey(viewKey: TicketRefreshViewKey): string {
        return String(viewKey || 'unknown').trim();
    }

    private log(event: string, viewKey: string, details: Record<string, any>) {
        // Temporary structured console logging for rollout visibility.
        // TODO: remove or route through a real frontend logger after adoption.
        console.debug({
            event,
            viewKey,
            emittedAt: new Date().toISOString(),
            ...details,
        });
    }
}
