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
import { TicketService } from '../demo/service/ticket.service';
import { SessionService } from '../demo/service/session.service';

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
    nbNotification: number = 0;
    positionNotification: string;
    badgeIs: boolean = false;
    isDisable: boolean = false;
    disabledButtons: { [key: string]: boolean } = {};
    allNotification: any;
    openModalComposant: boolean;
    _idDoc: string;
    _idNotification: any;
    isOnline: boolean = true;
    isSlowConnection: boolean = false;
    constructor(
        public layoutService: LayoutService,
        private apollo: Apollo,
        private notificationService: NotificationService,
        private ticketService: TicketService,
        private cdr: ChangeDetectorRef,
        private readonly router: Router,
        private readonly sessionService: SessionService,
    ) {}
    ngOnInit(): void {
        // this.getNotificationFromDb();
        // this.notificationService.reminder$.subscribe((message: any) => {
        //     if (message) {
        //         this.badgeIs = false; // Make sure the badge is enabled when there's new data
        //         this.allNotification.push(message); // Add new reminders to the list
        //         this.nbNotification = this.allNotification.length; // Set the number of reminders
        //         this.cdr.detectChanges(); // Trigger change detection manually
        //     }
        // });
        this.notificationService.onlineStatus$.subscribe((status) => {
            this.isOnline = status;
        });

        this.notificationService.slowConnection$.subscribe((isSlow) => {
            this.isSlowConnection = isSlow;
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
                query: this.layoutService.getAllNotification(),
            })
            .valueChanges.subscribe(({ data }) => {
                if (data) {
                    this.allNotification = data.getAllNotification;
                    this.nbNotification = this.allNotification.length;
                    this.cdr.detectChanges();
                }
            });
    }
    getComposant(data, _idDoc: string) {
        this._idNotification = data;

        this.openModalComposant = true;
        this._idDoc = _idDoc;
        this.apollo
            .query<any>({
                query: this.ticketService.getDiById(_idDoc),
            })
            .subscribe(() => {});
    }

    confirmAndSendItBackToMagasin() {
        //
        this.apollo
            .mutate<any>({
                mutation: this.ticketService.confirmComposant(
                    this._idDoc,
                    'REPLY',
                    this._idNotification
                ),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.markAsSeen(this._idNotification);
                }
            });
    }
    yes() {
        console.log('[Topbar.yes] Déconnexion button clicked');
        this.visible = false;
        this.sessionService.logout();
    }

    markAsSeen(notificationId: string) {
        this.apollo
            .mutate<any>({
                mutation: this.layoutService.markAsSeen(notificationId),
            })
            .subscribe(() => {
                // this.markAuditAsSeen(auditId, reminderId);
                // this.disabledButtons[reminderId] = true;
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
            .subscribe(() => {});
    }
}
