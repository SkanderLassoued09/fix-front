import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class NotificationService {
    private worker: Worker;

    constructor() {
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
