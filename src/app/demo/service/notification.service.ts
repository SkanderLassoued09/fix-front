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
                console.log('Data received from worker:', data);
            };
        } else {
            console.warn('Web Workers are not supported in this environment.');
        }
    }

    startWorker() {
        if (this.worker) {
            this.worker.postMessage('start');
        }
    }
}
