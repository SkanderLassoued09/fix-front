import {
    ChangeDetectorRef,
    Component,
    ElementRef,
    OnInit,
    ViewChild,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import { LayoutService } from './service/app.layout.service';
import { Router } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { NotificationService } from '../demo/service/notification.service';

@Component({
    selector: 'app-topbar',
    templateUrl: './app.topbar.component.html',
})
export class AppTopBarComponent implements OnInit {
    items!: MenuItem[];

    @ViewChild('menubutton') menuButton!: ElementRef;

    @ViewChild('topbarmenubutton') topbarMenuButton!: ElementRef;

    @ViewChild('topbarmenu') menu!: ElementRef;
    position: string;
    visible: boolean;
    visibleNotification: boolean;
    listReminders: any;
    nbReminder: number = 0;
    positionNotification: string;
    badgeIs: boolean = false;
    isDisable: boolean = false;
    disabledButtons: { [key: string]: boolean } = {};

    constructor(
        public layoutService: LayoutService,
        private apollo: Apollo,
        private notificationService: NotificationService,
        private cdr: ChangeDetectorRef,
        private readonly router: Router
    ) {}
    ngOnInit(): void {
        this.getNotificationFromDb();
        this.notificationService.reminder$.subscribe((message: any) => {
            console.log('🍈[message]:', message);
            if (message) {
                this.badgeIs = false; // Make sure the badge is enabled when there's new data
                this.nbReminder = message.length; // Set the number of reminders
                this.listReminders.push(...message); // Add new reminders to the list
                this.cdr.detectChanges(); // Trigger change detection manually
            }
        });
    }

    logout(position: string) {
        this.position = position;
        this.visible = true;
    }

    notification(position: string) {
        this.visibleNotification = true;
        this.positionNotification = position;
    }

    getNotificationFromDb() {
        this.apollo
            .watchQuery<any>({
                query: this.layoutService.getReminders(),
            })
            .valueChanges.subscribe(({ data, loading }) => {
                this.listReminders = data.remindersNotification;
            });
    }

    yes() {
        this.visible = false;
        localStorage.clear();
        this.router.navigate(['/auth/login']);
    }

    markAsSeen(reminderId: string, auditId: string) {
        console.log('🥕[auditId]:', auditId);
        console.log('🍑[reminderId]:', reminderId);

        this.apollo
            .mutate<any>({
                mutation: this.layoutService.markAsSeen(reminderId),
            })
            .subscribe(({ data }) => {
                console.log('🍞[data notificatrion]:', data);
                this.markAuditAsSeen(auditId, reminderId);
                this.disabledButtons[reminderId] = true;
            });
    }

    markAuditAsSeen(auditId, reminderId) {
        this.apollo
            .mutate<any>({
                mutation: this.layoutService.markAuditAsSeen(
                    auditId,
                    reminderId
                ),
            })
            .subscribe(({ data }) => {
                console.log('🍞[data notificatrion]:', data);
            });
    }
}
