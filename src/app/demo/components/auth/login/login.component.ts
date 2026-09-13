import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { SessionService } from 'src/app/demo/service/session.service';
import { NotificationCenterService } from 'src/app/demo/service/notification-center.service';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { landingRouteForRole } from 'src/app/shared/landing-route';
import { NotifyService } from '../../../../shared/ui/notify.service';

interface LoginMutationResponse {
    login: {
        access_token: string;
        user: {
            _id: string;
            role: string;
            email: string;
            username: string;
        };
    };
}

// Backend code surfaced when `isConnected` is already true on the profile.
// Distinct from "wrong password" so the dedicated banner renders instead
// of a generic error toast.
const ACCOUNT_ALREADY_CONNECTED = 'ACCOUNT_ALREADY_CONNECTED';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    // Styles are kept INLINE (not a separate .scss) on purpose: a newly-added
    // styleUrls file is not always picked up by an already-running `ng serve`
    // watcher, which left this page rendering unstyled. Inline styles ship with
    // the component JS and always recompile on change. Design system: Inter,
    // blue #2563eb / #3b82f6, slate text — no purple.
    styles: [
        `
            :host {
                display: block;
            }
            .fx-login {
                font-family: "Inter", system-ui, -apple-system, "Segoe UI",
                    sans-serif;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: radial-gradient(
                    1200px 600px at 50% -10%,
                    var(--fx-blue-soft-bg) 0%,
                    var(--fx-bg-surface-2) 55%,
                    var(--fx-bg-page) 100%
                );
                color: var(--fx-text-strong);
                -webkit-font-smoothing: antialiased;
            }
            .fx-login__wrap {
                width: 100%;
                max-width: 400px;
            }
            .fx-login__card {
                background: var(--fx-bg-card);
                border: 1px solid var(--fx-border);
                border-radius: 18px;
                overflow: hidden;
                box-shadow: 0 18px 44px rgba(15, 23, 42, 0.12);
            }
            .fx-login__head {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                padding: 30px 26px 22px;
                border-bottom: 1px solid var(--fx-border);
                background: linear-gradient(180deg, var(--fx-bg-surface), var(--fx-bg-card));
            }
            .fx-login__logo {
                height: 46px;
                width: auto;
            }
            .fx-login__tag {
                font-size: 13px;
                color: var(--fx-text-muted);
            }
            .fx-login__body {
                padding: 24px 26px 28px;
            }

            /* Session conflict alert (amber — semantic warning) */
            .fx-alert {
                display: flex;
                gap: 10px;
                padding: 12px 13px;
                border-radius: 11px;
                background: var(--fx-amber-soft-bg);
                border: 1px solid var(--fx-amber-soft-bd);
                margin-bottom: 20px;
            }
            .fx-alert__ico {
                flex: none;
                margin-top: 1px;
                color: var(--fx-amber-text);
                font-size: 1rem;
            }
            .fx-alert__body {
                flex: 1;
                min-width: 0;
            }
            .fx-alert__title {
                font-size: 12.5px;
                font-weight: 700;
                color: var(--fx-amber-text);
            }
            .fx-alert__text {
                font-size: 12px;
                line-height: 1.45;
                color: var(--fx-amber-soft-fg);
                margin-top: 2px;
            }
            .fx-alert__text strong {
                font-weight: 700;
            }
            .fx-alert__close {
                width: 24px;
                height: 24px;
                flex: none;
                border: none;
                background: transparent;
                color: var(--fx-amber-text);
                cursor: pointer;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.15s;
            }
            .fx-alert__close .pi {
                font-size: 0.72rem;
            }
            .fx-alert__close:hover {
                background: var(--fx-amber-soft-bg-2);
            }

            /* Form */
            .fx-form {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .fx-field {
                display: flex;
                flex-direction: column;
            }
            .fx-label {
                font-size: 12.5px;
                font-weight: 600;
                color: var(--fx-text-strong);
                margin-bottom: 7px;
            }
            .fx-input,
            .fx-pw {
                width: 100%;
                height: 46px;
                border: 1.5px solid var(--fx-border);
                border-radius: 11px;
                background: var(--fx-bg-surface);
                transition: border-color 0.15s, background 0.15s,
                    box-shadow 0.15s;
            }
            .fx-input {
                padding: 0 14px;
                font-size: 14.5px;
                font-family: inherit;
                color: var(--fx-text-strong);
                outline: none;
            }
            .fx-input::placeholder {
                color: var(--fx-text-subtle);
            }
            .fx-input:focus {
                border-color: var(--fx-blue-strong);
                background: var(--fx-bg-card);
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
            }
            .fx-pw {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 0 14px;
            }
            .fx-pw:focus-within {
                border-color: var(--fx-blue-strong);
                background: var(--fx-bg-card);
                box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
            }
            .fx-pw__input {
                flex: 1;
                min-width: 0;
                border: none;
                outline: none;
                background: transparent;
                font-size: 14.5px;
                font-family: inherit;
                color: var(--fx-text-strong);
            }
            .fx-pw__input::placeholder {
                color: var(--fx-text-subtle);
                letter-spacing: normal;
            }
            .fx-pw__input--masked {
                letter-spacing: 2px;
            }
            .fx-pw__toggle {
                border: none;
                background: transparent;
                color: var(--fx-text-subtle);
                cursor: pointer;
                padding: 4px;
                display: flex;
                transition: color 0.15s;
            }
            .fx-pw__toggle .pi {
                font-size: 1rem;
            }
            .fx-pw__toggle:hover {
                color: var(--fx-text-strong);
            }

            /* Submit */
            .fx-submit {
                margin-top: 4px;
                height: 48px;
                border: none;
                border-radius: 12px;
                background: var(--fx-blue-strong);
                color: var(--fx-text-on-accent);
                font-size: 15px;
                font-weight: 700;
                font-family: inherit;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 8px 20px rgba(37, 99, 235, 0.28);
                transition: background 0.15s, box-shadow 0.15s;
            }
            .fx-submit:hover:not(:disabled) {
                background: var(--fx-blue-strong);
            }
            .fx-submit:disabled,
            .fx-submit--loading {
                cursor: wait;
                background: var(--fx-blue-soft-bg-2);
                box-shadow: none;
            }
            .fx-spinner {
                width: 17px;
                height: 17px;
                border-radius: 50%;
                border: 2.4px solid rgba(255, 255, 255, 0.45);
                border-top-color: var(--fx-bg-card);
                display: inline-block;
                animation: fx-spin 0.7s linear infinite;
            }
            @keyframes fx-spin {
                to {
                    transform: rotate(360deg);
                }
            }

            /* Support */
            .fx-help {
                text-align: center;
                font-size: 12.5px;
                color: var(--fx-text-subtle);
                margin-top: 20px;
            }
            .fx-help__link {
                color: var(--fx-blue-text);
                font-weight: 600;
                cursor: pointer;
            }
            .fx-help__link:hover {
                text-decoration: underline;
            }
        `,
    ],
})
export class LoginComponent {
    loginForm = new FormGroup({
        username: new FormControl(),
        password: new FormControl(),
    });
    valCheck: string[] = ['remember'];

    password!: string;
    /** Password field visibility (custom eye toggle). */
    showPassword = false;
    /** In-flight sign-in — drives the button spinner + disabled state. */
    loading = false;
    // Drives the "déjà connecté sur un autre appareil" banner. Stays in
    // place until the next attempt.
    alreadyConnected = false;
    blockedUsername = '';

    constructor(
        private profileService: ProfileService,
        private apollo: Apollo,
        private router: Router,
        public layoutService: LayoutService,
        private readonly notify: NotifyService,
        private readonly sessionService: SessionService,
        private readonly notificationCenter: NotificationCenterService,
    ) {}

    togglePassword(): void {
        this.showPassword = !this.showPassword;
    }

    /** Dismiss the "déjà connecté ailleurs" banner without retrying. */
    dismissConflict(): void {
        this.alreadyConnected = false;
        this.blockedUsername = '';
    }

    login() {
        if (this.loading) return;
        const { username, password } = this.loginForm.value;
        this.alreadyConnected = false;
        this.blockedUsername = '';
        this.loading = true;
        this.apollo
            .query<LoginMutationResponse>({
                query: this.profileService.getTokenLogin(username, password),
            })
            .subscribe({
                // errorPolicy: 'all' in graphql.modules.ts routes GraphQL
                // errors here (NOT to error()) alongside `data: null`.
                next: (result: any) => {
                    const data = result?.data;
                    if (data?.login?.access_token) {
                        localStorage.setItem('token', data.login.access_token);
                        localStorage.setItem('_id', data.login.user._id);
                        localStorage.setItem('role', data.login.user.role);
                        localStorage.setItem(
                            'username',
                            data.login.user.username,
                        );
                        // Register the tab-close fallback so a tab kill
                        // also frees `isConnected` (best-effort).
                        this.sessionService.installAutoLogout();
                        // Rebranche le centre de notif sur le NOUVEL utilisateur
                        // (SPA sans reload → le socket singleton pointerait sinon
                        // sur le compte précédent → pas de toast/son temps réel).
                        this.notificationCenter.start();
                        // Land each profile on its own page (tech → atelier,
                        // coordinateur/magasin → their lists, else ticket list).
                        this.router.navigateByUrl(
                            landingRouteForRole(data.login.user.role),
                        );
                        return;
                    }
                    this.handleError(result?.errors, username);
                },
                error: (err) => this.handleError([err], username),
            });
    }

    /**
     * Walks every plausible error path (NestJS wraps HttpException in
     * `extensions.exception`, Apollo nests graphQLErrors, network errors
     * live elsewhere) for the dedicated `ACCOUNT_ALREADY_CONNECTED` code.
     */
    private handleError(rawErrors: any, attemptedUsername?: string): void {
        this.loading = false;
        const list: any[] = Array.isArray(rawErrors)
            ? rawErrors
            : rawErrors
              ? [rawErrors]
              : [];
        const haystack = list
            .flatMap((e) => [
                e?.message,
                e?.extensions?.exception?.message,
                e?.extensions?.exception?.response,
                e?.extensions?.response?.message,
                e?.extensions?.originalError?.message,
                e?.graphQLErrors?.[0]?.message,
                e?.networkError?.error?.errors?.[0]?.message,
                JSON.stringify(e ?? {}),
            ])
            .map((v) => (typeof v === 'string' ? v : JSON.stringify(v ?? '')))
            .join(' | ');

        if (haystack.includes(ACCOUNT_ALREADY_CONNECTED)) {
            this.alreadyConnected = true;
            this.blockedUsername = attemptedUsername ?? '';
            return;
        }
        this.notify.error('Identifiants incorrects.');
    }
}
