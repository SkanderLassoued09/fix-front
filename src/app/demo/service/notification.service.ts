import { Injectable, NgZone } from '@angular/core';
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
    private blAddedSubject = new Subject<any>(); // Subject to emit notifications
    private sentComponentToCoordinatorSubject = new Subject<any>(); // Subject to emit notifications
    private componentConfirmedByCoordinatorSubject = new Subject<any>(); // Subject to emit notifications
    // Generic operational alerts (stagnation, future monitors). Components
    // subscribe selectively without coupling to specific alert types.
    private alertCreatedSubject = new Subject<any>();
    private alertResolvedSubject = new Subject<any>();
    public notification$ = this.notificationSubject.asObservable(); // Observable to expose notificationsd
    public blAdded$ = this.blAddedSubject.asObservable(); // Observable to expose notificationsd
    public reminder$ = this.reminderSubject.asObservable(); // Observable to expose notifications
    public sentComponentToCoordinator$ =
        this.sentComponentToCoordinatorSubject.asObservable(); // Observable to expose notifications
    public componentConfirmedByCoordinator$ =
        this.componentConfirmedByCoordinatorSubject.asObservable(); // Observable to expose notifications
    public alertCreated$ = this.alertCreatedSubject.asObservable();
    public alertResolved$ = this.alertResolvedSubject.asObservable();
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
        private http: HttpClient,
        private readonly zone: NgZone,
    ) {
        // --
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () =>
            this.updateOnlineStatus(false),
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
                new URL('./notification.worker.ts', import.meta.url),
            );
            this.worker.onmessage = ({ data }) => {
                // Web worker onmessage is not always patched by zone.js under
                // Angular's ESBuild worker bundling, so dispatch inside NgZone
                // to guarantee change detection runs for purely-local handlers
                // such as patchBlAddedRow (no HTTP follow-up to re-trigger CD).
                this.zone.run(() => this.handlenotification(data));
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
        console.log('handlenotification', data);
        switch (data.event) {
            case 'confirmAllComposant':
                if (localStorage.getItem('username')) {
                    this.messageservice.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'confirmAllComposant',
                        sticky: true,
                    });

                    this.reminderSubject.next(data);
                    return 'confirmAllComposant';
                }
                break;
            case 'updateTicket':
                if (data.message.action === 'updateState') {
                    this.notificationSubject.next(data.message.content.states); // Emit the message
                    return data.message.target;
                }
                break;
            case 'sendDitoDiagnostique':
                this.notificationSubject.next(data);
                break;
            case 'sendComponentToCoordinatorFromMagasin':
                this.notificationSubject.next(data.message); // Emit the message
                break;

            case 'blAddedNotification':
                console.log('skander', data.message);
                this.blAddedSubject.next(data);

                break;

            case 'component:sent_to_coordinator':
                console.log('skander', data.message);
                this.sentComponentToCoordinatorSubject.next(data);

                break;
            case 'component:confirmed_by_coordinator':
                console.log('skander', data.message);
                this.componentConfirmedByCoordinatorSubject.next(data);

                break;

            // -- Generic operational alerts (stagnation + future monitors) --
            case 'alert.created':
                this.alertCreatedSubject.next(data.message);
                break;
            case 'alert.resolved':
                this.alertResolvedSubject.next(data.message);
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
            }),
        );
    }
    startWorker() {
        if (this.worker) {
            this.worker.postMessage('start');
        }
    }
}
