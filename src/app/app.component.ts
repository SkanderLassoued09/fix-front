import { Component, OnInit } from '@angular/core';
import { MessageService, PrimeNGConfig } from 'primeng/api';
import { ProfileService } from './demo/service/profile.service';
import { Apollo } from 'apollo-angular';

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
    }

    notification() {
        this.apollo
            .subscribe<any>({
                query: this.profileService.notificationDiagnostic(),
            })
            .subscribe(({ data }) => {
                console.log('🥡[NOTIFICATION]:', data.notificationDiagnostic);
                this.messageService.add({
                    severity: 'success',
                    summary: 'Success',
                    detail: 'Le profil ajouté avec succés',
                });
            });
    }
}
