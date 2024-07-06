import { Injectable } from '@angular/core';
import { ROLES } from '../components/profile/constant/role-constants';

@Injectable({
    providedIn: 'root',
})
export class NotificationService {
    private worker: Worker;
    private role: string;

    constructor() {
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

    private handlenotification(data: any) {
        switch (data.event) {
            case 'sendDitoDiagnostique':
                if (
                    data.message.username === localStorage.getItem('username')
                ) {
                    // Implement your notification logic for sendDitoDiagnostique event
                    console.log(
                        'Notification for sendDitoDiagnostique:',
                        data.message
                    );
                    return data.message.profile;
                }
                break;

            case 'reminder':
                // Implement your notification logic for reminder event
                console.log('Notification for reminder:', data.message);
                break;

            case 'sendNotifcationToAdmins':
                if (this.role === 'ADMIN_MANAGER' || 'ADMIN_TECH') {
                    // Implement your notification logic for sendDitoDiagnostique event
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
