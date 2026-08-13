import { Injectable, NgZone } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

export interface ErpNotification {
    _id: string;
    eventId?: string;
    type: string;
    diId?: string | null;
    message: string;
    readAt?: string | null;
    createdAt?: string;
}

/**
 * Cloche ERP (v1). UN socket AUTHENTIFIÉ dédié (`io(base,{auth:{token}})`) →
 * le back joint l'utilisateur à sa room `user:{id}` et ne pousse QUE ses
 * notifications. Le worker existant (`updateTicket`, …) n'est PAS touché → zéro
 * régression sur le temps réel existant.
 *
 * Perf (postes lents) : au démarrage on ne charge QUE le compteur non-lus (un
 * `count` indexé) + un abonnement socket ; la LISTE n'est chargée qu'à
 * l'ouverture de la cloche. Aucun polling.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
    private readonly base = (environment.apiUrl ?? '').replace(/\/+$/, '');
    private socket?: Socket;
    private started = false;

    readonly unreadCount$ = new BehaviorSubject<number>(0);
    readonly notifications$ = new BehaviorSubject<ErpNotification[]>([]);
    readonly soundEnabled$ = new BehaviorSubject<boolean>(true);

    // ── Son : Web Audio (aucun asset), débloqué au 1er geste, anti-spam ──────
    private audioCtx: AudioContext | null = null;
    private audioUnlocked = false;
    private lastSoundAt = 0;
    private static readonly SOUND_MIN_INTERVAL_MS = 3000;

    constructor(private readonly apollo: Apollo, private readonly zone: NgZone) {}

    /** À appeler une fois l'utilisateur authentifié (topbar `ngOnInit`). */
    start(): void {
        if (this.started) return;
        this.started = true;
        this.primeAudioUnlockOnFirstGesture();
        this.refreshUnreadCount();
        this.loadSoundPref();
        this.connectSocket();
    }

    stop(): void {
        this.socket?.disconnect();
        this.socket = undefined;
        this.started = false;
        this.unreadCount$.next(0);
        this.notifications$.next([]);
    }

    private connectSocket(): void {
        const token = localStorage.getItem('token') ?? '';
        this.socket = io(this.base, { auth: { token } });
        this.socket.on('notification.new', (n: ErpNotification) => {
            // Hors zone Angular (socket.io) → on rentre pour déclencher le rendu.
            this.zone.run(() => this.onIncoming(n));
        });
    }

    private onIncoming(n: ErpNotification): void {
        this.unreadCount$.next(this.unreadCount$.value + 1);
        this.notifications$.next([n, ...this.notifications$.value].slice(0, 50));
        this.playSound();
    }

    // ── GraphQL ──────────────────────────────────────────────────────────────
    refreshUnreadCount(): void {
        this.apollo
            .query<any>({
                query: gql`
                    query {
                        unreadNotificationCount
                    }
                `,
                fetchPolicy: 'network-only',
            })
            .subscribe({
                next: ({ data }) =>
                    this.unreadCount$.next(Number(data?.unreadNotificationCount) || 0),
                error: () => {},
            });
    }

    /** Chargé UNIQUEMENT à l'ouverture de la cloche (pas au démarrage). */
    loadList(limit = 20): void {
        this.apollo
            .query<any>({
                query: gql`
                    query ($limit: Int) {
                        myNotifications(limit: $limit) {
                            _id
                            eventId
                            type
                            diId
                            message
                            readAt
                            createdAt
                        }
                    }
                `,
                variables: { limit },
                fetchPolicy: 'network-only',
            })
            .subscribe({
                next: ({ data }) =>
                    this.notifications$.next(data?.myNotifications ?? []),
                error: () => {},
            });
    }

    markRead(notifId: string): void {
        this.apollo
            .mutate<any>({
                mutation: gql`
                    mutation ($notifId: String!) {
                        markNotificationRead(notifId: $notifId)
                    }
                `,
                variables: { notifId },
            })
            .subscribe({
                next: () => {
                    this.notifications$.next(
                        this.notifications$.value.map((n) =>
                            n._id === notifId
                                ? { ...n, readAt: new Date().toISOString() }
                                : n,
                        ),
                    );
                    this.unreadCount$.next(Math.max(0, this.unreadCount$.value - 1));
                },
                error: () => {},
            });
    }

    markAllRead(): void {
        this.apollo
            .mutate<any>({
                mutation: gql`
                    mutation {
                        markAllNotificationsRead
                    }
                `,
            })
            .subscribe({
                next: () => {
                    const now = new Date().toISOString();
                    this.notifications$.next(
                        this.notifications$.value.map((n) => ({
                            ...n,
                            readAt: n.readAt ?? now,
                        })),
                    );
                    this.unreadCount$.next(0);
                },
                error: () => {},
            });
    }

    private loadSoundPref(): void {
        this.apollo
            .query<any>({
                query: gql`
                    query {
                        notificationSoundEnabled
                    }
                `,
                fetchPolicy: 'network-only',
            })
            .subscribe({
                next: ({ data }) =>
                    this.soundEnabled$.next(data?.notificationSoundEnabled !== false),
                error: () => {},
            });
    }

    setSound(enabled: boolean): void {
        this.soundEnabled$.next(enabled);
        if (enabled) this.unlockAudio(); // un clic « activer » débloque aussi l'audio
        this.apollo
            .mutate<any>({
                mutation: gql`
                    mutation ($enabled: Boolean!) {
                        setNotificationSound(enabled: $enabled)
                    }
                `,
                variables: { enabled },
            })
            .subscribe({ error: () => {} });
    }

    // ── Son (Web Audio) ───────────────────────────────────────────────────────
    private primeAudioUnlockOnFirstGesture(): void {
        if (typeof window === 'undefined') return;
        const unlock = () => this.unlockAudio();
        // Un seul déblocage suffit (les navigateurs exigent un geste préalable).
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
    }

    private unlockAudio(): void {
        try {
            if (!this.audioCtx) {
                const Ctx =
                    (window as any).AudioContext ||
                    (window as any).webkitAudioContext;
                if (!Ctx) return;
                this.audioCtx = new Ctx();
            }
            this.audioCtx?.resume?.();
            this.audioUnlocked = true;
        } catch {
            /* blocage navigateur → on reste en visuel-only, SANS erreur console */
        }
    }

    private playSound(): void {
        if (!this.soundEnabled$.value) return;
        if (!this.audioUnlocked || !this.audioCtx) return; // pas encore débloqué
        const now = Date.now();
        // Anti-spam : un seul son si plusieurs notifs arrivent en rafale.
        if (now - this.lastSoundAt < NotificationCenterService.SOUND_MIN_INTERVAL_MS)
            return;
        this.lastSoundAt = now;
        try {
            const ctx = this.audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 880;
            gain.gain.value = 0.06;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch {
            /* jamais d'erreur remontée à l'utilisateur */
        }
    }
}
