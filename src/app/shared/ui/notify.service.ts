import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

/**
 * Les quatre seules natures de toast de l'application.
 *
 * Le vocabulaire des toasts n'est PAS celui des `<p-tag>` : ici `warn`, là-bas
 * `warning` (et `danger` au lieu de `error`). Ne pas recopier l'un dans l'autre
 * — cf. `ticket_status_severity.ts` et `dashboard.component.ts`, qui sont du
 * vocabulaire Tag et sont corrects tels quels.
 */
export type NotifyKind = 'success' | 'error' | 'info' | 'warn';

/** Réglages ponctuels. Dans l'écrasante majorité des cas, seul `detail` suffit. */
export interface NotifyOptions {
    /** Remplace le libellé standard. À réserver aux cas qui apportent vraiment
     *  une information que `detail` ne porte pas (ex. « Import terminé »). */
    summary?: string;
    /** Durée d'affichage en ms. Par défaut : celle du contrat ci-dessous. */
    life?: number;
    /** Toast persistant tant que l'utilisateur ne le ferme pas. À n'utiliser que
     *  pour une information qu'il serait grave de manquer. */
    sticky?: boolean;
    /** Exutoire nommé. Seul `erp-notif` existe (notifications temps réel). */
    key?: string;
}

/**
 * CONTRAT DE COULEUR — source unique de vérité pour tout le front.
 *
 *   success  VERT    une opération a abouti
 *   error    ROUGE   une opération a échoué, ou échec dur (ressource introuvable)
 *   info     BLEU    information ; JAMAIS le résultat d'une opération
 *   warn     ORANGE  saisie à corriger avant de pouvoir continuer
 *
 * Les couleurs viennent du thème PrimeNG (`lara-light-blue` / `lara-dark-blue`)
 * et sont déjà justes : il n'y a AUCUN CSS de sévérité à écrire. Le seul travail
 * est de choisir la bonne nature — ce que ce service rend impossible à rater,
 * puisque `severity` n'est plus un paramètre d'appel.
 *
 * Toujours passer par ce service plutôt que par `MessageService` directement :
 * c'est ce qui garantit que « Succès » ne redevienne pas « Success »/« Successful »
 * et qu'un enregistrement réussi ne reparte pas en bleu.
 */
@Injectable({ providedIn: 'root' })
export class NotifyService {
    /** Libellé et durée par nature. Modifier ICI change toute l'application. */
    private static readonly PRESETS: Record<
        NotifyKind,
        { summary: string; life: number }
    > = {
        success: { summary: 'Succès', life: 3000 },
        // Un échec demande plus de temps de lecture qu'une confirmation.
        error: { summary: 'Erreur', life: 6000 },
        info: { summary: 'Information', life: 4000 },
        warn: { summary: 'Attention', life: 5000 },
    };

    constructor(private readonly messages: MessageService) {}

    /** Une opération a abouti. */
    success(detail: string, opts?: NotifyOptions): void {
        this.show('success', detail, opts);
    }

    /** Une opération a échoué, ou une ressource attendue est introuvable. */
    error(detail: string, opts?: NotifyOptions): void {
        this.show('error', detail, opts);
    }

    /** Information pure. Ne JAMAIS l'utiliser pour annoncer un succès. */
    info(detail: string, opts?: NotifyOptions): void {
        this.show('info', detail, opts);
    }

    /** L'utilisateur doit corriger sa saisie avant de continuer. */
    warn(detail: string, opts?: NotifyOptions): void {
        this.show('warn', detail, opts);
    }

    /** Vide les toasts affichés (ou ceux d'un exutoire nommé). */
    clear(key?: string): void {
        this.messages.clear(key);
    }

    private show(kind: NotifyKind, detail: string, opts?: NotifyOptions): void {
        const preset = NotifyService.PRESETS[kind];
        this.messages.add({
            severity: kind,
            summary: opts?.summary ?? preset.summary,
            detail,
            // `sticky` et `life` s'excluent : PrimeNG ignore `life` si sticky.
            ...(opts?.sticky
                ? { sticky: true }
                : { life: opts?.life ?? preset.life }),
            ...(opts?.key ? { key: opts.key } : {}),
        });
    }
}
