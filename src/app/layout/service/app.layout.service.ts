import { Injectable, effect, signal } from '@angular/core';
import { gql } from 'apollo-angular';
import { Subject } from 'rxjs';

export interface AppConfig {
    inputStyle: string;
    colorScheme: string;
    theme: string;
    ripple: boolean;
    menuMode: string;
    scale: number;
}

interface LayoutState {
    staticMenuDesktopInactive: boolean;
    overlayMenuActive: boolean;
    profileSidebarVisible: boolean;
    configSidebarVisible: boolean;
    staticMenuMobileActive: boolean;
    menuHoverActive: boolean;
}

/** Cle localStorage du mode clair/sombre. Le script inline d'index.html lit la
 *  MEME cle avant le premier rendu : les deux doivent rester synchronises. */
export const COLOR_SCHEME_KEY = 'fx-color-scheme';

/**
 * Suivre le theme clair/sombre du systeme d'exploitation.
 *
 * `false` tant que le bouton de bascule est masque (`showThemeToggle` dans
 * `app.topbar.component.ts`) : sans bouton, un poste regle en sombre afficherait
 * l'ERP en sombre SANS aucun moyen de revenir en clair. Repasser a `true` en
 * meme temps que le bouton — et penser au meme drapeau dans le script inline
 * d'`index.html`, qui applique le theme avant le premier rendu.
 */
export const FOLLOW_SYSTEM_COLOR_SCHEME = false;

/** Paire clair/sombre. Le bleu est la couleur de marque (topbar, toasts). */
export const LIGHT_THEME = 'lara-light-blue';
export const DARK_THEME = 'lara-dark-blue';

/** Preference stockee, sinon celle du systeme. Repique la logique du script
 *  inline d'index.html pour que le service demarre sur le meme etat. */
function initialColorScheme(): 'light' | 'dark' {
    try {
        const stored = localStorage.getItem(COLOR_SCHEME_KEY);
        if (stored === 'dark' || stored === 'light') {
            return stored;
        }
        if (!FOLLOW_SYSTEM_COLOR_SCHEME) return 'light';
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    } catch {
        /* localStorage indisponible (navigation privee) : on reste en clair. */
        return 'light';
    }
}

@Injectable({
    providedIn: 'root',
})
export class LayoutService {
    _config: AppConfig = {
        ripple: false,
        inputStyle: 'outlined',
        menuMode: 'static',
        colorScheme: initialColorScheme(),
        theme:
            initialColorScheme() === 'dark' ? DARK_THEME : LIGHT_THEME,
        scale: 14,
    };

    config = signal<AppConfig>(this._config);

    state: LayoutState = {
        staticMenuDesktopInactive: false,
        overlayMenuActive: false,
        profileSidebarVisible: false,
        configSidebarVisible: false,
        staticMenuMobileActive: false,
        menuHoverActive: false,
    };

    private configUpdate = new Subject<AppConfig>();

    private overlayOpen = new Subject<any>();

    configUpdate$ = this.configUpdate.asObservable();

    overlayOpen$ = this.overlayOpen.asObservable();

    constructor() {
        // Le script inline d'index.html a deja pose la classe et le bon href
        // avant le premier rendu ; on se contente de rester aligne ensuite.
        this.syncRootColorScheme(this._config.colorScheme);
        this.watchSystemColorScheme();

        effect(() => {
            const config = this.config();
            if (this.updateStyle(config)) {
                this.changeTheme();
            }
            this.syncRootColorScheme(config.colorScheme);
            this.changeScale(config.scale);
            this.onConfigUpdate();
        });
    }

    /** Bascule clair <-> sombre et memorise le choix. */
    toggleColorScheme() {
        this.setColorScheme(
            this.config().colorScheme === 'dark' ? 'light' : 'dark'
        );
    }

    /** Applique un mode et le persiste. Theme et colorScheme changent ensemble :
     *  `changeTheme()` echange le href de #theme-css, `syncRootColorScheme()`
     *  bascule le crochet CSS des styles maison. */
    setColorScheme(scheme: 'light' | 'dark', persist = true) {
        if (persist) {
            try {
                localStorage.setItem(COLOR_SCHEME_KEY, scheme);
            } catch {
                /* Stockage indisponible : la bascule reste valable pour la session. */
            }
        }
        this.config.update((config) => ({
            ...config,
            colorScheme: scheme,
            theme: scheme === 'dark' ? DARK_THEME : LIGHT_THEME,
        }));
    }

    isDarkMode() {
        return this.config().colorScheme === 'dark';
    }

    /** `layout-theme-dark` est pose sur `.layout-wrapper`, hors duquel sont
     *  rendues les surcouches `appendTo="body"` (dialogues, listes deroulantes,
     *  toasts, menu utilisateur). Le crochet des jetons est donc sur <html>. */
    private syncRootColorScheme(scheme: string) {
        const dark = scheme === 'dark';
        document.documentElement.classList.toggle('app-dark', dark);
        document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute('content', dark ? '#111827' : '#1976d2');
    }

    /** Sans choix explicite de l'utilisateur, on suit le systeme en direct. */
    private watchSystemColorScheme() {
        if (!FOLLOW_SYSTEM_COLOR_SCHEME) return;
        const media = window.matchMedia?.('(prefers-color-scheme: dark)');
        media?.addEventListener('change', (event) => {
            try {
                if (localStorage.getItem(COLOR_SCHEME_KEY)) return;
            } catch {
                return;
            }
            this.setColorScheme(event.matches ? 'dark' : 'light', false);
        });
    }

    updateStyle(config: AppConfig) {
        return (
            config.theme !== this._config.theme ||
            config.colorScheme !== this._config.colorScheme
        );
    }

    onMenuToggle() {
        if (this.isOverlay()) {
            this.state.overlayMenuActive = !this.state.overlayMenuActive;
            if (this.state.overlayMenuActive) {
                this.overlayOpen.next(null);
            }
        }

        if (this.isDesktop()) {
            this.state.staticMenuDesktopInactive =
                !this.state.staticMenuDesktopInactive;
        } else {
            this.state.staticMenuMobileActive =
                !this.state.staticMenuMobileActive;

            if (this.state.staticMenuMobileActive) {
                this.overlayOpen.next(null);
            }
        }
    }

    showProfileSidebar() {
        this.state.profileSidebarVisible = !this.state.profileSidebarVisible;
        if (this.state.profileSidebarVisible) {
            this.overlayOpen.next(null);
        }
    }

    showConfigSidebar() {
        this.state.configSidebarVisible = true;
    }

    isOverlay() {
        return this.config().menuMode === 'overlay';
    }

    isDesktop() {
        return window.innerWidth > 991;
    }

    isMobile() {
        return !this.isDesktop();
    }

    onConfigUpdate() {
        this._config = { ...this.config() };
        this.configUpdate.next(this.config());
    }

    changeTheme() {
        const config = this.config();
        const themeLink = <HTMLLinkElement>document.getElementById('theme-css');
        const themeLinkHref = themeLink.getAttribute('href')!;
        const newHref = themeLinkHref
            .split('/')
            .map((el) =>
                el == this._config.theme
                    ? (el = config.theme)
                    : el == `theme-${this._config.colorScheme}`
                    ? (el = `theme-${config.colorScheme}`)
                    : el
            )
            .join('/');

        this.replaceThemeLink(newHref);
    }
    replaceThemeLink(href: string) {
        const id = 'theme-css';
        let themeLink = <HTMLLinkElement>document.getElementById(id);
        const cloneLinkElement = <HTMLLinkElement>themeLink.cloneNode(true);

        cloneLinkElement.setAttribute('href', href);
        cloneLinkElement.setAttribute('id', id + '-clone');

        themeLink.parentNode!.insertBefore(
            cloneLinkElement,
            themeLink.nextSibling
        );
        cloneLinkElement.addEventListener('load', () => {
            themeLink.remove();
            cloneLinkElement.setAttribute('id', id);
        });
    }

    changeScale(value: number) {
        document.documentElement.style.fontSize = `${value}px`;
    }

    getAllNotification() {
        return gql`
            {
                getAllNotification {
                    _id
                    _idDoc
                    type
                    message
                    isSeen
                }
            }
        `;
    }

    markAsSeen(_id: string) {
        return gql`
            mutation {
                markAsSeenNotification(_id: "${_id}") {
                    isSeen
                }
            }
        `;
    }

    markAuditAsSeen(_auditId: string, _reminderId: string) {
        return gql`
            mutation {
                markReminderAsSeen(
                    auditId: "66ec8a363d2770641f5582e9"
                    reminderId: "DI0"
                ) {
                    _id
                    reminder {
                        data {
                            _id
                            title
                        }
                        isSeen
                    }
                }
            }
        `;
    }
}
