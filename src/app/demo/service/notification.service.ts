import { Injectable } from '@angular/core';
import { ROLES } from '../components/profile/constant/role-constants';
import { MessageService } from 'primeng/api';
import {
    BehaviorSubject,
    catchError,
    interval,
    of,
    Subject,
    switchMap,
    tap,
} from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root',
})
export class NotificationService {
    private worker: Worker;
    private role: string;

    private notificationSubject = new Subject<any>(); // Subject to emit notifications
    private reminderSubject = new Subject<any>(); // Subject to emit notifications
    public notification$ = this.notificationSubject.asObservable(); // Observable to expose notifications
    public reminder$ = this.reminderSubject.asObservable(); // Observable to expose notifications
    private handleState = new BehaviorSubject<any>(false); // Initialize with a default value or null
    public handleState$ = this.handleState.asObservable();
    // -- conx
    private onlineStatus = new BehaviorSubject<boolean>(navigator.onLine);
    public onlineStatus$ = this.onlineStatus.asObservable();
    private speedCheckUrl = 'https://jsonplaceholder.typicode.com/posts/1'; // Change this to a lightweight endpoint
    private speedThreshold = 1000; // Threshold in ms to consider the connection slow
    private slowConnection = new BehaviorSubject<boolean>(false);
    public slowConnection$ = this.slowConnection.asObservable();
    constructor(
        private readonly messageservice: MessageService,
        private http: HttpClient
    ) {
        // --
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () =>
            this.updateOnlineStatus(false)
        );
        // --

        // -- network speed threshold
        // Check speed periodically (e.g., every 30 seconds)
        interval(30000)
            .pipe(switchMap(() => this.checkConnectionSpeed()))
            .subscribe();
        // -- network speed threshold
        this.role === localStorage.getItem('role');
        if (typeof Worker !== 'undefined') {
            // Create a new web worker
            this.worker = new Worker(
                new URL('./notification.worker.ts', import.meta.url)
            );
            this.worker.onmessage = ({ data }) => {
                this.handlenotification(data);
            };
        } else {
            console.warn('Web Workers are not supported in this environment.');
        }
    }

    get getstate() {
        return this.handleState.value;
    }

    // Helper method to get current value
    getCurrentState(): boolean {
        return this.handleState.value;
    }

    public handlenotification(data: any) {
        switch (data.event) {
            case 'updateTicket':
                if (data.message.action === 'updateState') {
                    this.notificationSubject.next(data.message.content.states); // Emit the message
                    return data.message.target;
                }

                break;
            case 'sendComponentToCoordinatorFromMagasin':
                this.notificationSubject.next(data.message); // Emit the message
                return data.message;

                break;

            // case 'sendDitoDiagnostique':
            //     if (
            //         data.message.profile.username ===
            //         localStorage.getItem('username')
            //     ) {
            //         this.messageservice.add({
            //             severity: 'success',
            //             summary: 'Success',
            //             detail: 'Notification',
            //             sticky: true,
            //         });
            //         // Implement your notification logic for sendDitoDiagnostique event
            //
            //             'Notification for sendDitoDiagnostique:',
            //             data.message
            //         );
            //         this.notificationSubject.next(data.message.stat); // Emit the message
            //         return data.message.profile.profile;
            //     }
            //     break;

            // case 'reminder':
            //     // Implement your notification logic for reminder event
            //     this.messageservice.add({
            //         severity: 'warn',
            //         summary: 'Reminder',
            //         detail: data.message,
            //         sticky: true,
            //     });

            //     this.reminderSubject.next(data.message.payload.reminder.data);
            //     break;
            // // TODO nezih
            // case 'sendNotifcationToAdmins':
            //     if (this.role === 'ADMIN_MANAGER' || 'ADMIN_TECH') {
            //         // Implement your notification logic for sendDitoDiagnostique event
            //         this.messageservice.add({
            //             severity: 'success',
            //             summary: 'Success',
            //             detail: 'Notification',
            //             sticky: true,
            //         });
            //
            //             'Notification for sendDitoDiagnostique:',
            //             data.message
            //         );
            //         return data.message.profile;
            //     }

            //     break;
            // case 'confirmAllComposant':
            //     if (localStorage.getItem('username')) {
            //         this.messageservice.add({
            //             severity: 'success',
            //             summary: 'Success',
            //             detail: 'confirmAllComposant',
            //             sticky: true,
            //         });
            //         // Implement your notification confirm composant
            //
            //             'Notification for confirmAllComposant:',
            //             data.message
            //         );
            //         this.reminderSubject.next(data);
            //         return 'confirmAllComposant';
            //     }
            //     break;
            default:
                console.warn('Unhandled event:', data.event);
                break;
        }
    }
    private updateOnlineStatus(isOnline: boolean) {
        this.onlineStatus.next(isOnline);
    }
    private checkConnectionSpeed() {
        const startTime = Date.now();

        return this.http.get(this.speedCheckUrl).pipe(
            tap(() => {
                const duration = Date.now() - startTime;
                this.slowConnection.next(duration > this.speedThreshold);
            }),
            catchError(() => {
                // Consider connection slow if the request fails
                this.slowConnection.next(true);
                return of(null);
            })
        );
    }
    startWorker() {
        if (this.worker) {
            this.worker.postMessage('start');
        }
    }
}
