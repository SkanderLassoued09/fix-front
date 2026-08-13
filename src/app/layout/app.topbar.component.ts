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

    // ── Utilisateur connecté (affiché en haut à droite) ──────────────────────
    userName = '';
    roleLabel = '';
    initials = '';
    userMenuItems: MenuItem[] = [];

    /** Libellés FR des rôles (la valeur brute vient de `localStorage('role')`).
     *  NB : le rôle coordinateur est stocké « COORDIANTOR » (typo historique). */
    private readonly ROLE_LABELS: Record<string, string> = {
        TECH: 'Technicien',
        COORDIANTOR: 'Coordinateur',
        MAGASIN: 'Magasin',
        MANAGER: 'Manager',
        ADMIN_MANAGER: 'Admin Manager',
        ADMIN_TECH: 'Admin Technique',
    };

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

        this.initUser();
        this.userMenuItems = [
            {
                label: 'Se déconnecter',
                icon: 'pi pi-sign-out',
                command: () => this.logout('top-right'),
            },
        ];
    }

    /** Renseigne nom + rôle + initiales depuis le `localStorage` (posé au login). */
    private initUser(): void {
        const username = (localStorage.getItem('username') ?? '').trim();
        const role = (localStorage.getItem('role') ?? '').trim();
        this.userName = username || 'Utilisateur';
        this.roleLabel =
            this.ROLE_LABELS[role.toUpperCase()] ?? this.prettifyRole(role);
        this.initials = this.computeInitials(this.userName);
    }

    private prettifyRole(role: string): string {
        if (!role) return '—';
        return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    }

    private computeInitials(name: string): string {
        const parts = name.split(/[\s._-]+/).filter(Boolean);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    /** Ouvre la confirmation de déconnexion (déclenchée par le menu utilisateur). */
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
