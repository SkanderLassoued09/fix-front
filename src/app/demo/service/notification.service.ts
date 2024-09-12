import { Injectable } from '@angular/core';
import { ROLES } from '../components/profile/constant/role-constants';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class NotificationService {
    private worker: Worker;
    private role: string;
    private notificationSubject = new Subject<any>(); // Subject to emit notifications
    public notification$ = this.notificationSubject.asObservable(); // Observable to expose notifications
    constructor(private readonly messageservice: MessageService) {
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

    public handlenotification(data: any) {
        switch (data.event) {
            case 'sendDitoDiagnostique':
                if (
                    data.message.profile.username ===
                    localStorage.getItem('username')
                ) {
                    this.messageservice.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'Notification',
                        sticky: true,
                    });
                    // Implement your notification logic for sendDitoDiagnostique event
                    console.log(
                        'Notification for sendDitoDiagnostique:',
                        data.message
                    );
                    this.notificationSubject.next(data.message.stat); // Emit the message
                    return data.message.profile.profile;
                }
                break;

            case 'reminder':
                // Implement your notification logic for reminder event
                this.messageservice.add({
                    severity: 'warn',
                    summary: 'Reminder',
                    detail: data.message,
                    sticky: true,
                });
                console.log('Notification for reminder:', data.message);
                break;
            // TODO nezih
            case 'sendNotifcationToAdmins':
                if (this.role === 'ADMIN_MANAGER' || 'ADMIN_TECH') {
                    // Implement your notification logic for sendDitoDiagnostique event
                    this.messageservice.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'Notification',
                        sticky: true,
                    });
                    console.log(
                        'Notification for sendDitoDiagnostique:',
                        data.message
                    );
                    return data.message.profile;
                }

                break;
            case 'confirmAllComposant':
                if (
                    data.message.username === localStorage.getItem('username')
                ) {
                    this.messageservice.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'Notification',
                        sticky: true,
                    });
                    // Implement your notification logic for sendDitoDiagnostique event
                    console.log(
                        'Notification for confirmAllComposant:',
                        data.message
                    );
                    return data.message.profile;
                }
                break;
            default:
                console.warn('Unhandled event:', data.event);
                break;
        }
    }

    startWorker() {
        if (this.worker) {
            this.worker.postMessage('start');
        }
    }
}
