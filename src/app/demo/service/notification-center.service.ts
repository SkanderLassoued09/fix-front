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

    // ── Alerte BL « cœur qui bat » : son EN BOUCLE tant qu'une notif
    //    DI_DOC_BL_PENDING est présente (jusqu'à l'upload du BL). Snooze = coupe
    //    le SON pour un délai (le visuel continue de battre) ; réarmé au reload
    //    (état en mémoire) ou à l'arrivée d'une nouvelle alerte BL.
    private static readonly BL_PENDING_TYPE = 'DI_DOC_BL_PENDING';
    private static readonly HEARTBEAT_INTERVAL_MS = 2500;
    private static readonly BL_SNOOZE_MS = 5 * 60 * 1000;
    private blHeartbeatTimer: any = null;
    private blSnoozeTimer: any = null;
    private blSnoozeUntil = 0;
    /** true tant qu'une alerte BL est présente — pilote le battement visuel. */
    readonly blPending$ = new BehaviorSubject<boolean>(false);

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
                // Garde le contexte audio VIVANT (les navigateurs le suspendent
                // en arrière-plan) → le son reste fiable au retour sur l'onglet.
                this.audioCtx?.resume?.().catch(() => {});
            }
        });
        window.addEventListener('focus', () => {
            this.refreshUnreadCount();
            this.audioCtx?.resume?.().catch(() => {});
        });
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
        this.socket.on(
            'notification.removed',
            (p: { diId?: string | null; type?: string | null }) => {
                this.zone.run(() => this.onRemoved(p));
            },
        );
    }

    private onIncoming(n: ErpNotification): void {
        this.unreadCount$.next(this.unreadCount$.value + 1);
        this.notifications$.next([n, ...this.notifications$.value].slice(0, 50));
        this.incoming$.next(n); // → toast cliquable
        this.playSound();
        // Nouvelle alerte BL → on réarme le son (annule un snooze en cours) puis
        // on (re)démarre le cœur qui bat.
        if (n?.type === NotificationCenterService.BL_PENDING_TYPE) {
            this.blSnoozeUntil = 0;
        }
        this.recomputeBlPending();
    }

    /** Retrait temps réel (event `notification.removed`) : la notif dont l'action
     *  est faite (ex. BL/devis uploadé) disparaît de la cloche + coupe le son. */
    private onRemoved(p: { diId?: string | null; type?: string | null }): void {
        if (!p?.diId || !p?.type) return;
        const before = this.notifications$.value;
        const match = (n: ErpNotification) =>
            n.diId === p.diId && n.type === p.type;
        const removed = before.filter(match);
        if (!removed.length) {
            // Non présente en mémoire (liste pas encore chargée) → recale le compte.
            this.refreshUnreadCount();
        } else {
            const unreadRemoved = removed.filter((n) => !n.readAt).length;
            this.notifications$.next(before.filter((n) => !match(n)));
            if (unreadRemoved > 0) {
                this.unreadCount$.next(
                    Math.max(0, this.unreadCount$.value - unreadRemoved),
                );
            }
        }
        this.recomputeBlPending();
    }

    /** Recalcule la présence d'une alerte BL (par PRÉSENCE, pas `readAt` : elle
     *  nagge jusqu'à l'UPLOAD, pas jusqu'à la lecture) et pilote le battement. */
    private recomputeBlPending(): void {
        const pending = this.notifications$.value.some(
            (n) => n.type === NotificationCenterService.BL_PENDING_TYPE,
        );
        if (pending !== this.blPending$.value) this.blPending$.next(pending);
        this.updateHeartbeatLoop();
    }

    private updateHeartbeatLoop(): void {
        const shouldSound =
            this.blPending$.value &&
            this.soundEnabled$.value &&
            Date.now() >= this.blSnoozeUntil;
        if (shouldSound && !this.blHeartbeatTimer) {
            this.playHeartbeat(); // un battement immédiat…
            this.blHeartbeatTimer = setInterval(
                () => this.playHeartbeat(),
                NotificationCenterService.HEARTBEAT_INTERVAL_MS,
            ); // … puis en boucle.
        } else if (!shouldSound && this.blHeartbeatTimer) {
            clearInterval(this.blHeartbeatTimer);
            this.blHeartbeatTimer = null;
        }
    }

    /** Coupe le SON de l'alerte BL pour un délai (le visuel continue de battre).
     *  Le son revient au reload ou après le délai. */
    snoozeBl(): void {
        this.blSnoozeUntil = Date.now() + NotificationCenterService.BL_SNOOZE_MS;
        this.updateHeartbeatLoop();
        if (this.blSnoozeTimer) clearTimeout(this.blSnoozeTimer);
        // Ré-évalue à l'expiration du snooze (relance le son si BL toujours en attente).
        this.blSnoozeTimer = setTimeout(
            () => this.updateHeartbeatLoop(),
            NotificationCenterService.BL_SNOOZE_MS + 50,
        );
    }

    /** Battement SONORE de l'alerte BL = le MÊME son que la notification de l'app
     *  (ding-dong 880/660 Hz), audible sur haut-parleurs (un « lub-dub » grave
     *  ~120 Hz est inaudible sur la plupart des enceintes). */
    private playHeartbeat(): void {
        if (!this.soundEnabled$.value) return;
        this.emitDingDong();
    }

    /** Émet le ding-dong (880/660 Hz) — LE son de notification de l'app. Requiert
     *  l'audio débloqué. Réutilisé par le son one-shot (playSound) ET la boucle
     *  d'alerte BL (playHeartbeat). */
    private emitDingDong(): void {
        if (!this.audioUnlocked || !this.audioCtx) return;
        const ctx = this.audioCtx;
        const emit = () => {
            try {
                const t0 = ctx.currentTime;
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
                /* jamais d'erreur remontée */
            }
        };
        if (ctx.state === 'suspended') ctx.resume().then(emit).catch(emit);
        else emit();
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
                    this.recomputeBlPending();
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
        this.updateHeartbeatLoop(); // couper/relancer le cœur qui bat selon le son
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
        this.emitDingDong();
    }
}
