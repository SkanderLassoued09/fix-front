import { Component, OnInit } from '@angular/core';
import { MessageService, PrimeNGConfig } from 'primeng/api';
import { ProfileService } from './demo/service/profile.service';
import { Apollo } from 'apollo-angular';

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
        private messageService: MessageService
    ) {
        this._idtech = localStorage.getItem('_id');
    }

    ngOnInit() {
        this.primengConfig.ripple = true;
        this.notification();
        console.log('🍸[notification');
    }

    notification() {
        this.apollo
            .subscribe<NotificationSubscriptionResponse>({
                query: this.profileService.notificationDiagnostic(),
            })
            .subscribe(({ data }) => {
                console.log('🥔[data]:', data);
                if (this._idtech == data.notificationDiagnostic._idtechDiag) {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Travaille à faire',
                        detail: 'Vous avez réçu une notification',
                    });
                }
            });
    }
    notificationrep() {
        this.apollo
            .subscribe<NotificationSubscriptionResponse>({
                query: this.profileService.notificationrep(),
            })
            .subscribe(({ data }) => {
                console.log('🥔[data]:', data);
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
