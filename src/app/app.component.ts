import { Component, OnInit } from '@angular/core';
import { MessageService, PrimeNGConfig } from 'primeng/api';
import { SwUpdate } from '@angular/service-worker';
import { SessionService } from './demo/service/session.service';
import { NotificationService } from './demo/service/notification.service';
import { DiDetailService } from './demo/service/di-detail.service';
import { DiFilesService } from './demo/service/di-files.service';
import { NotificationDeepLinkService } from './demo/service/notification-deep-link.service';
import {
    NotificationCenterService,
    ErpNotification,
} from './demo/service/notification-center.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
    constructor(
        private primengConfig: PrimeNGConfig,
        private messageService: MessageService,
        private notificationService: NotificationService,
        private readonly sessionService: SessionService,
        public detailService: DiDetailService,
        public filesService: DiFilesService,
        private notifCenter: NotificationCenterService,
        private deepLink: NotificationDeepLinkService,
        private swUpdate: SwUpdate,
    ) {}

    /** Clic sur le toast temps réel → marque lu D'ABORD, puis deep-link vers la
     *  modale d'action (sinon modal détail en fallback). */
    onErpToastClick(n: ErpNotification): void {
        this.messageService.clear('erp-notif');
        if (n?._id) this.notifCenter.markRead(n._id);
        this.deepLink.open(n);
    }

    onDetailVisibleChange(v: boolean): void {
        this.detailService.setVisible(v);
    }

    /** Fermeture de la modale GLOBALE « Affectation des Fichiers » (ouverte par
     *  la notification BL). Aucune liste à rafraîchir ici : la page courante
     *  n'est pas forcément une liste de DI, et la notif est retirée côté back
     *  dès l'upload du BL (événement temps réel `notification.removed`). */
    onFilesVisibleChange(v: boolean): void {
        this.filesService.setVisible(v);
    }

    /** Enregistrement réussi depuis la modale globale : le service referme et
     *  demande le rafraîchissement des listes qui écoutent. */
    onFilesSaved(): void {
        this.filesService.markSaved();
    }

    ngOnInit() {
        // PWA : dès qu'une NOUVELLE version est déployée, on l'active et on
        // recharge. Sans ça, le service worker continue de servir l'ANCIEN
        // bundle en cache — c'est ce qui fait que des correctifs (ex. socket
        // temps réel) « ne s'appliquent pas » tant qu'on ne vide pas le cache.
        // No-op en dev (SW désactivé → isEnabled=false).
        if (this.swUpdate.isEnabled) {
            this.swUpdate.versionUpdates.subscribe((e) => {
                if (e.type === 'VERSION_READY') {
                    this.swUpdate
                        .activateUpdate()
                        .then(() => document.location.reload());
                }
            });
            this.swUpdate.checkForUpdate().catch(() => {});
        }

        // Toast temps réel CLIQUABLE (clé dédiée `erp-notif` → n'affecte pas les
        // autres toasts). Le clic ouvre le modal détail de la DI concernée.
        // SEUL toast qui ne passe pas par `NotifyService`, et c'est voulu : il
        // porte `data` (la notification complète, lue par le gestionnaire de
        // clic) et vise un exutoire à template custom, qui remplace tout le
        // corps du message. Sa sévérité n'a donc aucun effet visuel — la charte
        // bleue lui vient de son propre CSS (`.erp-toast` dans `styles.scss`).
        this.notifCenter.incoming$.subscribe((n) => {
            this.messageService.add({
                key: 'erp-notif',
                severity: 'info',
                summary: 'Notification',
                detail: n?.message,
                data: n,
                life: 6000,
            });
        });
        // Best-effort tab-close cleanup so closing the browser also flips
        // `isConnected` back to false on the backend (otherwise the
        // account stays locked until the user clicks Déconnexion).
        this.sessionService.installAutoLogout();
        this.notificationService.startWorker();
        this.primengConfig.ripple = true;

        // Libellés FR des boutons de confirmation. Sans ça, PrimeNG retombe sur
        // ses défauts « Yes » / « No » : l'app affichait un texte français sous
        // des boutons anglais dans 44 de ses 45 confirmations.
        // `setTranslation` FUSIONNE avec la table existante — les clés de
        // p-calendar (jours, mois) sont préservées.
        this.primengConfig.setTranslation({
            accept: 'Confirmer',
            reject: 'Annuler',
        });
        // Notification subscription
        this.notificationService.notification$.subscribe((message: any) => {
            if (message) {
                console.log('from app component', message);
                // this.messageService.add({
                //     severity: 'info',
                //     summary: 'Nouveau ticket',
                //     detail: 'Un nouveau ticket vient d’être assigné',
                //     sticky: true,
                // });
                // setTimeout(() => {
                //     this.loadData();
                // }, 1000);
            }
        });
        // this.notificationService.blAdded$.subscribe((message: any) => {
        //     console.log('from app component BBBLLLLL', message);
        //     if (message) {
        //         //   this.messageService.add({
        //         //       severity: 'info',
        //         //       summary: 'Nouveau ticket',
        //         //       detail: 'Un nouveau ticket vient d’être assigné',
        //         //       sticky: true,
        //         //   });
        //         // setTimeout(() => {
        //         //     this.loadData();
        //         // }, 1000);
        //     }
        // });
        this.notificationService.reminder$.subscribe((message: any) => {
            if (message) {
                //CONFIRMATION_COMPOSANT ??
                console.log('from app component REPLYYY', message);
                //   this.messageService.add({
                //       severity: 'info',
                //       summary: 'Nouveau ticket',
                //       detail: 'Un nouveau ticket vient d’être assigné',
                //       sticky: true,
                //   });

                // setTimeout(() => {
                //     this.loadData();
                // }, 1000);
            }
        });
    }
}
