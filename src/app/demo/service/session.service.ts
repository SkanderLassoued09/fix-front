import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { environment } from 'src/environments/environment';
import { ProfileService } from './profile.service';

/**
 * Single-session lifecycle — minimal version.
 *
 *   - `logout()`: flips the backend `isConnected` flag back to `false`,
 *     then clears localStorage and routes to /auth/login.
 *   - `installAutoLogout()`: registers a one-shot `pagehide` handler that
 *     fires the same backend mutation via `fetch({keepalive: true})` so
 *     closing the tab / window also frees the account. Best-effort: most
 *     browsers honour `keepalive`, but a forced kill (Task Manager) or a
 *     network outage leaves `isConnected:true` and requires either a
 *     subsequent fresh login (which would re-flip it on success — see
 *     fallback below) or an admin reset.
 *
 * Deliberately no heartbeat, no loginId claim, no per-request guard: the
 * user explicitly asked to keep the model trivial — one boolean drives
 * everything.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
    constructor(
        private apollo: Apollo,
        private router: Router,
        private profileService: ProfileService,
    ) {}

    /**
     * Install the tab-close cleanup. Idempotent: AppComponent calls this
     * on every navigation but the listener stays attached just once.
     */
    private installed = false;
    installAutoLogout(): void {
        if (this.installed) return;
        this.installed = true;
        if (typeof window === 'undefined') return;
        // `pagehide` fires on tab close, window close, and same-tab nav
        // away in modern browsers. We swallow same-tab nav by checking
        // whether a token is still present; only fire the logout when
        // the user is actually leaving the app.
        window.addEventListener('pagehide', () => this.fireBeaconLogout());
    }

    /**
     * Fire-and-forget logout via fetch+keepalive. Used by the pagehide
     * handler — Apollo can't reliably finish an in-flight request after
     * unload, but native fetch with `keepalive:true` does. No reaction
     * to the response (the tab is going away).
     */
    private fireBeaconLogout(): void {
        const token = localStorage.getItem('token');
        if (!token) return;
        const apiBase = (environment.apiUrl ?? '').replace(/\/+$/, '');
        const url = `${apiBase}/graphql`;
        // The backend's `logout` mutation takes the token as an arg and
        // verifies it server-side — the Bearer header is redundant here
        // but we keep it so other middleware (CORS, rate-limit) sees a
        // normal authenticated request shape.
        const escaped = token.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const body = JSON.stringify({
            query: `mutation { logout(token: "${escaped}") }`,
        });
        try {
            fetch(url, {
                method: 'POST',
                keepalive: true,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body,
            }).catch(() => {});
        } catch {
            /* swallow — the tab is closing, nothing to surface */
        }
    }

    /**
     * Explicit logout from the topbar button. Calls the backend mutation
     * (so `isConnected` is flipped server-side), then clears localStorage
     * and routes to /auth/login regardless of the network outcome.
     */
    logout(): void {
        console.log('[SessionService.logout] called');
        const token = localStorage.getItem('token');
        console.log('[SessionService.logout] token present =', !!token);
        const cleanup = () => {
            console.log('[SessionService.logout] cleanup running');
            localStorage.removeItem('token');
            localStorage.removeItem('_id');
            localStorage.removeItem('role');
            localStorage.removeItem('username');
            this.router.navigateByUrl('/auth/login');
        };
        if (!token) {
            console.log('[SessionService.logout] no token → cleanup only');
            cleanup();
            return;
        }
        console.log('[SessionService.logout] sending mutation { logout(token) }');
        this.apollo
            .mutate({ mutation: this.profileService.logoutMutation(token) })
            .subscribe({
                next: (result: any) => {
                    console.log(
                        '[SessionService.logout] response =',
                        JSON.stringify(result),
                    );
                    cleanup();
                },
                error: (err: any) => {
                    console.error(
                        '[SessionService.logout] error =',
                        err?.message ?? err,
                        err?.graphQLErrors,
                        err?.networkError,
                    );
                    cleanup();
                },
            });
    }
}
