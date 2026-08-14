import { Injectable, NgZone } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { BehaviorSubject, Subject } from 'rxjs';
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
    /** _id de l'utilisateur sur lequel le socket est ACTUELLEMENT branché. Si le
     *  compte change (logout → login autre rôle, SANS reload), on rebranche. */
    private connectedUserId: string | null = null;
    /** true dès que la liste de la cloche a été chargée au moins une fois. */
    private lastListLoaded = false;

    readonly unreadCount$ = new BehaviorSubject<number>(0);
    readonly notifications$ = new BehaviorSubject<ErpNotification[]>([]);
    readonly soundEnabled$ = new BehaviorSubject<boolean>(true);
    /** Émet chaque notification entrante (temps réel) — pour le toast cliquable. */
    readonly incoming$ = new Subject<ErpNotification>();

    // ── Son : Web Audio (aucun asset), débloqué au 1er geste, anti-spam ──────
    private audioCtx: AudioContext | null = null;
    private audioUnlocked = false;
    private lastSoundAt = 0;
    private static readonly SOUND_MIN_INTERVAL_MS = 3000;

    constructor(private readonly apollo: Apollo, private readonly zone: NgZone) {}

    /** À appeler une fois l'utilisateur authentifié (topbar `ngOnInit`). */
    /**
     * Appelé à CHAQUE init du topbar. Le service est un singleton root qui
     * survit à la destruction/recréation du topbar (logout → login) : sans
     * garde sur l'utilisateur, le socket resterait abonné aux rooms de l'ANCIEN
     * compte → aucune notif temps réel (toast + son) pour le nouveau. On rebranche
     * donc dès que l'`_id` courant diffère de celui du socket connecté.
     */
    start(): void {
        const currentUser = localStorage.getItem('_id');
        // Déjà branché sur le bon utilisateur → rien à faire.
        if (this.started && this.connectedUserId === currentUser) return;

        // Installation des écouteurs GLOBAUX une seule fois (jamais en double).
        if (!this.started) {
            this.started = true;
            this.primeAudioUnlockOnFirstGesture();
            this.installVisibilityRefresh();
        }

        // (Re)branchement du socket sur l'utilisateur COURANT.
        this.connectedUserId = currentUser;
        this.unreadCount$.next(0);
        this.notifications$.next([]);
        this.lastListLoaded = false;
        this.loadSoundPref();
        this.socket?.disconnect();
        this.socket = undefined;
        this.connectSocket();
        this.refreshUnreadCount();
    }

    /** Filet de sécurité SI le socket temps réel est indisponible (proxy qui ne
     *  relaie pas les WebSockets, back multi-instances sans adapter, etc.) : au
     *  RETOUR sur l'onglet on rafraîchit le compteur non-lus (count INDEXÉ, pas
     *  de polling par timer). La cloche montre alors les nouvelles notifs sans
     *  recharger toute la page. */
    private installVisibilityRefresh(): void {
        if (typeof document === 'undefined') return;
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.refreshUnreadCount();
                if (this.lastListLoaded) this.loadList();
            }
        });
        window.addEventListener('focus', () => this.refreshUnreadCount());
    }

    stop(): void {
        this.socket?.disconnect();
        this.socket = undefined;
        this.started = false;
        this.connectedUserId = null;
        this.lastListLoaded = false;
        this.unreadCount$.next(0);
        this.notifications$.next([]);
    }

    private connectSocket(): void {
        // `auth` en FONCTION → le token COURANT est relu à CHAQUE (re)connexion
        // (re-login, reconnexion réseau) et non figé à la création du socket.
        // websocket d'abord, repli polling → plus robuste derrière un proxy.
        this.socket = io(this.base, {
            auth: (cb) => cb({ token: localStorage.getItem('token') ?? '' }),
            transports: ['websocket', 'polling'],
        });
        // Diagnostics visibles en console (DevTools) : permet de vérifier que le
        // socket AUTHENTIFIÉ se connecte bien (sinon : aucune notif temps réel).
        this.socket.on('connect', () =>
            console.log('[notif] socket temps réel connecté', this.socket?.id),
        );
        this.socket.on('connect_error', (e: any) =>
            console.warn('[notif] socket connect_error:', e?.message ?? e),
        );
        this.socket.on('disconnect', (reason: any) =>
            console.warn('[notif] socket déconnecté:', reason),
        );
        this.socket.on('notification.new', (n: ErpNotification) => {
            // Hors zone Angular (socket.io) → on rentre pour déclencher le rendu.
            this.zone.run(() => this.onIncoming(n));
        });
    }

    private onIncoming(n: ErpNotification): void {
        this.unreadCount$.next(this.unreadCount$.value + 1);
        this.notifications$.next([n, ...this.notifications$.value].slice(0, 50));
        this.incoming$.next(n); // → toast cliquable
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
                next: ({ data }) => {
                    this.notifications$.next(data?.myNotifications ?? []);
                    this.lastListLoaded = true;
                },
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
        // On écoute plusieurs types de gestes pour débloquer au plus tôt.
        ['pointerdown', 'click', 'keydown', 'touchstart'].forEach((ev) =>
            window.addEventListener(ev, unlock, { once: true }),
        );
    }

    /** Débloque l'audio explicitement (ex. clic sur la cloche) — public. */
    unlockAudio(): void {
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
            // Le contexte peut être repassé en « suspended » (inactivité,
            // politique navigateur) → on le réveille avant de jouer, sinon le
            // son est programmé mais jamais audible.
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            const t0 = ctx.currentTime;
            // Petit « ding-dong » à deux tons, avec fondu pour éviter le clic.
            const play = (freq: number, start: number, dur: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.0001, t0 + start);
                gain.gain.exponentialRampToValueAtTime(0.12, t0 + start + 0.02);
                gain.gain.exponentialRampToValueAtTime(
                    0.0001,
                    t0 + start + dur,
                );
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(t0 + start);
                osc.stop(t0 + start + dur + 0.02);
            };
            play(880, 0, 0.14); // ding
            play(660, 0.13, 0.18); // dong
        } catch {
            /* jamais d'erreur remontée à l'utilisateur */
        }
    }
}
