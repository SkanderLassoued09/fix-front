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
import { SessionService } from '../demo/service/session.service';
import {
    NotificationCenterService,
    ErpNotification,
} from '../demo/service/notification-center.service';
import { NotificationDeepLinkService } from '../demo/service/notification-deep-link.service';
import { ProfileService } from '../demo/service/profile.service';
import { MutationRunner } from '../demo/service/mutation-runner.service';

@Component({
    selector: 'app-topbar',
    templateUrl: './app.topbar.component.html',
})
export class AppTopBarComponent implements OnInit {
    /**
     * Affichage du bouton clair/sombre dans la topbar.
     *
     * Mis a `false` sur demande : la fonctionnalite est complete (jetons,
     * persistance, application avant le premier rendu) mais pas encore exposee.
     * Passer a `true` pour la livrer — rien d'autre a modifier.
     *
     * Tant que ce drapeau est `false`, `FOLLOW_SYSTEM_COLOR_SCHEME` doit rester
     * `false` dans `app.layout.service.ts` ET dans le script inline
     * d'`index.html` : sans bouton visible, suivre le theme du systeme
     * enfermerait un poste en mode sombre sans aucun moyen d'en sortir.
     */
    showThemeToggle = false;

    items!: MenuItem[];

    @ViewChild('menubutton') menuButton!: ElementRef;

    @ViewChild('topbarmenubutton') topbarMenuButton!: ElementRef;

    @ViewChild('topbarmenu') menu!: ElementRef;
    /** Confirmation de déconnexion. La modale est CENTRÉE : plus de
     *  `[position]`, elle s'aligne sur toutes les autres modales de l'app. */
    visible: boolean;
    listReminders: any;
    nbReminder: number = 0;
    badgeIs: boolean = false;
    isDisable: boolean = false;
    isOnline: boolean = true;
    isSlowConnection: boolean = false;

    // ── Cloche notifications ERP ─────────────────────────────────────────────
    bellOpen = false;
    erpUnread = 0;
    erpNotifications: ErpNotification[] = [];
    erpSoundOn = true;
    /** true tant qu'une alerte BL est présente — pilote le battement (cœur) de la
     *  cloche et de l'item, et l'affichage du bouton snooze. */
    blPending = false;
    /** Type de la notif d'alerte BL (cœur qui bat + son en boucle). */
    readonly BL_PENDING_TYPE = 'DI_DOC_BL_PENDING';

    // ── Utilisateur connecté (affiché en haut à droite) ──────────────────────
    userName = '';
    roleLabel = '';
    initials = '';
    userMenuItems: MenuItem[] = [];

    // ── « Mon profil » : changement de mot de passe ──────────────────────────
    /** Clé anti-double-soumission de `MutationRunner`. */
    readonly PWD_KEY = 'change-my-password';
    /** Longueur minimale — doit rester alignée sur `@MinLength` côté serveur. */
    readonly PWD_MIN = 8;
    profileDialog = false;
    pwdForm = { current: '', next: '', confirm: '' };
    /** Motif de refus renvoyé par le SERVEUR (mot de passe actuel faux, règle
     *  métier…). Affiché dans la modale : un toast générique « Opération
     *  impossible » ne dit pas à l'utilisateur qu'il s'est trompé de mot de
     *  passe. Effacé dès qu'il corrige sa saisie. */
    pwdServerError: string | null = null;

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
        private cdr: ChangeDetectorRef,
        private readonly router: Router,
        private readonly sessionService: SessionService,
        private readonly notificationCenter: NotificationCenterService,
        private readonly deepLink: NotificationDeepLinkService,
        private readonly profileService: ProfileService,
        private readonly mutationRunner: MutationRunner,
    ) {}
    ngOnInit(): void {
        // Le bloc commenté qui vivait ici alimentait l'ancienne modale
        // « Notifications » (`getNotificationFromDb` / `allNotification` /
        // `nbNotification`). Cette modale était inatteignable et a été
        // supprimée avec son état : le commentaire ne référençait plus que des
        // symboles inexistants. La cloche ERP (`notificationCenter`, plus bas)
        // est le remplaçant vivant.
        this.notificationService.onlineStatus$.subscribe((status) => {
            this.isOnline = status;
        });

        this.notificationService.slowConnection$.subscribe((isSlow) => {
            this.isSlowConnection = isSlow;
        });

        this.initUser();
        this.userMenuItems = [
            {
                label: 'Mon profil',
                icon: 'pi pi-user-edit',
                command: () => this.openProfileDialog(),
            },
            { separator: true },
            {
                label: 'Se déconnecter',
                icon: 'pi pi-sign-out',
                command: () => this.logout(),
            },
        ];

        // Cloche ERP : au démarrage on ne charge QUE le compteur (count indexé)
        // + on ouvre le socket authentifié. La liste ne se charge qu'à l'ouverture.
        this.notificationCenter.start();
        this.notificationCenter.unreadCount$.subscribe((n) => {
            this.erpUnread = n;
            this.cdr.markForCheck?.();
        });
        this.notificationCenter.notifications$.subscribe((list) => {
            this.erpNotifications = list;
        });
        this.notificationCenter.soundEnabled$.subscribe(
            (on) => (this.erpSoundOn = on),
        );
        this.notificationCenter.blPending$.subscribe((p) => {
            this.blPending = p;
            this.cdr.markForCheck?.();
        });
    }

    /** Coupe le SON de l'alerte BL pour un délai (le cœur continue de battre). */
    snoozeBlAlert(): void {
        this.notificationCenter.snoozeBl();
    }

    /** Ouvre/ferme le panneau cloche ; charge la liste À l'ouverture seulement.
     *  Le clic débloque aussi l'audio (geste utilisateur → le son marchera). */
    toggleBell(): void {
        this.bellOpen = !this.bellOpen;
        this.notificationCenter.unlockAudio();
        if (this.bellOpen) this.notificationCenter.loadList();
    }

    /** Clic sur une notification : marquée lue D'ABORD (badge/bandeau corrects),
     *  puis deep-link → modale d'ACTION de la page-rôle, sinon modal détail
     *  (fallback). Fonctionne depuis n'importe quelle page. */
    onErpNotifClick(n: ErpNotification): void {
        if (!n?.readAt) this.notificationCenter.markRead(n._id);
        this.bellOpen = false;
        this.deepLink.open(n);
    }

    markAllErpRead(): void {
        this.notificationCenter.markAllRead();
    }

    toggleErpSound(): void {
        this.notificationCenter.setSound(!this.erpSoundOn);
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

    // ── « Mon profil » ───────────────────────────────────────────────────────

    /** Ouvre la modale en repartant TOUJOURS d'un formulaire vide. */
    openProfileDialog(): void {
        this.pwdForm = { current: '', next: '', confirm: '' };
        this.pwdServerError = null;
        this.profileDialog = true;
    }

    /** Toute correction invalide le refus précédent. */
    onPwdInput(): void {
        this.pwdServerError = null;
    }

    get pwdBusy(): boolean {
        return this.mutationRunner.isBusy(this.PWD_KEY);
    }

    /**
     * Motif du refus, ou `null` si la saisie est valide. Sert à la fois à
     * désactiver le bouton et à afficher l'explication : sans message,
     * l'utilisateur ne comprend pas pourquoi « Enregistrer » reste grisé.
     * Le serveur revérifie tout — ceci n'évite qu'un aller-retour.
     */
    get pwdError(): string | null {
        const f = this.pwdForm;
        if (!f.current || !f.next || !f.confirm) return null; // saisie en cours
        if (f.next.length < this.PWD_MIN) {
            return `Le nouveau mot de passe doit contenir au moins ${this.PWD_MIN} caractères.`;
        }
        if (f.next !== f.confirm) {
            return 'La confirmation ne correspond pas au nouveau mot de passe.';
        }
        if (f.next === f.current) {
            return "Le nouveau mot de passe doit être différent de l'actuel.";
        }
        return null;
    }

    /** Message affiché sous le formulaire : règle client, sinon refus serveur. */
    get pwdMessage(): string | null {
        return this.pwdError ?? this.pwdServerError;
    }

    get pwdSubmitDisabled(): boolean {
        const f = this.pwdForm;
        return (
            this.pwdBusy ||
            !f.current ||
            !f.next ||
            !f.confirm ||
            this.pwdError !== null
        );
    }

    /**
     * Envoie le changement. Aucun identifiant n'est transmis : le serveur prend
     * l'acteur dans le jeton.
     *
     * La session est CONSERVÉE après succès — le jeton courant reste valide de
     * toute façon (signé, 365 j, sans révocation), déconnecter donnerait une
     * fausse impression de sécurité.
     */
    async submitPasswordChange(): Promise<void> {
        if (this.pwdSubmitDisabled) return;
        try {
            await this.mutationRunner.run({
                key: this.PWD_KEY,
                mutation: this.profileService.changeMyPassword(),
                variables: {
                    input: {
                        currentPassword: this.pwdForm.current,
                        newPassword: this.pwdForm.next,
                    },
                },
                successToast: {
                    summary: 'Mot de passe modifié',
                    detail: 'Utilisez-le à votre prochaine connexion.',
                },
                // Le toast par défaut (« Opération impossible ») masquerait la
                // vraie raison : on affiche le message serveur dans la modale.
                errorToast: null,
            });
            this.profileDialog = false;
            // Ne pas laisser les valeurs en mémoire une fois la modale fermée.
            this.pwdForm = { current: '', next: '', confirm: '' };
        } catch (err: any) {
            // `MutationRunner` relaie l'erreur GraphQL telle quelle. On la montre
            // là où l'utilisateur regarde — la modale reste ouverte et la saisie
            // est conservée pour qu'il corrige.
            this.pwdServerError =
                typeof err?.message === 'string' && err.message.trim()
                    ? err.message
                    : 'Changement refusé. Réessayez.';
        }
    }

    /** Ouvre la confirmation de déconnexion (déclenchée par le menu utilisateur). */
    logout() {
        this.visible = true;
    }

    yes() {
        this.visible = false;
        this.sessionService.logout();
    }
}
