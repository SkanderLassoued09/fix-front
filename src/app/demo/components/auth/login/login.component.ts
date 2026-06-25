import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { MessageService } from 'primeng/api';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { SessionService } from 'src/app/demo/service/session.service';
import { LayoutService } from 'src/app/layout/service/app.layout.service';

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
    styles: [
        `
            :host ::ng-deep .pi-eye,
            :host ::ng-deep .pi-eye-slash {
                transform: scale(1.6);
                margin-right: 1rem;
                color: var(--primary-color) !important;
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
    // Drives the "déjà connecté sur un autre appareil" banner. Stays in
    // place until the next attempt.
    alreadyConnected = false;
    blockedUsername = '';

    constructor(
        private profileService: ProfileService,
        private apollo: Apollo,
        private router: Router,
        public layoutService: LayoutService,
        private readonly messageservice: MessageService,
        private readonly sessionService: SessionService,
    ) {}

    login() {
        const { username, password } = this.loginForm.value;
        this.alreadyConnected = false;
        this.blockedUsername = '';
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
                        this.router.navigateByUrl('/');
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
        this.messageservice.add({
            severity: 'error',
            summary: 'Login',
            detail: 'Authentification incorrect',
        });
    }
}
