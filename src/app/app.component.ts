import { Component, Inject, OnInit } from '@angular/core';
import { MessageService, PrimeNGConfig } from 'primeng/api';
import { ProfileService } from './demo/service/profile.service';
import { Apollo } from 'apollo-angular';
import { SwPush } from '@angular/service-worker';
import { NotificationService } from './demo/service/notification.service';

/**
 *
 * to continuee implementing notification uzsing web worker
 */
interface NotificationSubscriptionResponse {
    notificationDiagnostic: {
        _idDi: string;
        messageNotification: string;
        _idtechDiag: string;
    };
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
    private _idtech: string;
    constructor(
        private primengConfig: PrimeNGConfig,
        private readonly profileService: ProfileService,
        private readonly apollo: Apollo,
        private messageService: MessageService,
        @Inject(SwPush) private swPush: SwPush,
        private notificationService: NotificationService
    ) {
        this._idtech = localStorage.getItem('_id');
    }

    ngOnInit() {
        this.notificationService.startWorker();
        this.primengConfig.ripple = true;
        this.notification();
    }

    notification() {
        this.swPush.subscription.subscribe((res) => {
            this.apollo
                .subscribe<NotificationSubscriptionResponse>({
                    query: this.profileService.notificationDiagnostic(),
                })
                .subscribe(({ data }) => {
                    if (
                        this._idtech == data.notificationDiagnostic._idtechDiag
                    ) {
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Travaille à faire',
                            detail: 'Vous avez réçu une notification',
                        });
                    }
                });
        });
    }
    notificationrep() {
        this.apollo
            .subscribe<NotificationSubscriptionResponse>({
                query: this.profileService.notificationrep(),
            })
            .subscribe(({ data }) => {
                if (this._idtech == data.notificationDiagnostic._idtechDiag) {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Travaille à faire',
                        detail: 'Vous avez réçu une notification',
                    });
                }
            });
    }
}
