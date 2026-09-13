import { Injectable } from '@angular/core';
import { ConfirmationService } from 'primeng/api';

/** Habillage du bandeau : rouge (destructif), bleu (neutre), vert (validation). */
export type ConfirmVariant = 'danger' | 'primary' | 'success';

/** Les natures d'action qui méritent une confirmation dans l'application. */
export type ConfirmKind =
    'delete' | 'discard' | 'create' | 'save' | 'send' | 'validate';

export interface ConfirmRequest {
    /** La question posée, en une phrase complète et en français. */
    message: string;
    /** Remplace le titre du preset. À réserver aux cas où « Confirmer la
     *  suppression » serait trop vague pour situer l'action. */
    header?: string;
    /** Remplace le verbe du bouton d'acceptation. Doit rester un VERBE
     *  SPÉCIFIQUE — voir la note sur « Confirmer » plus bas. */
    acceptLabel?: string;
    accept?: () => void;
    reject?: () => void;
}

interface ConfirmPreset {
    variant: ConfirmVariant;
    icon: string;
    header: string;
    acceptLabel: string;
}

/**
 * Point d'entrée UNIQUE des modales de confirmation.
 *
 * Toutes les confirmations de l'app passent par ici, sont rendues par l'unique
 * `<app-fx-confirm-dialog>` monté dans `app.component.html`, et héritent donc
 * automatiquement du gabarit maison. Un appel direct à `ConfirmationService`
 * contourne les presets : c'est ce qui avait produit 20+ en-têtes différents
 * pour les mêmes actions.
 *
 * RÈGLE DE LIBELLÉ — le bouton d'acceptation porte un VERBE SPÉCIFIQUE
 * (« Supprimer », « Enregistrer », « Envoyer »…), jamais un « Confirmer » nu.
 *   - côté produit : le verbe dit ce qu'on valide, sans relire le message ;
 *   - côté tests : `qa/e2e/nego-confirm.spec.ts` cible
 *     `getByRole('button', { name: 'Confirmer' }).last()`. Un accepteur nommé
 *     « Confirmer » deviendrait le dernier match dès l'ouverture de la modale
 *     et casserait le test de double-clic.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
    private static readonly PRESETS: Record<ConfirmKind, ConfirmPreset> = {
        delete: {
            variant: 'danger',
            icon: 'pi pi-trash',
            header: 'Confirmer la suppression',
            acceptLabel: 'Supprimer',
        },
        discard: {
            variant: 'danger',
            icon: 'pi pi-exclamation-triangle',
            header: 'Confirmer l’abandon',
            acceptLabel: 'Abandonner',
        },
        create: {
            variant: 'primary',
            icon: 'pi pi-plus-circle',
            header: 'Confirmer la création',
            acceptLabel: 'Créer',
        },
        save: {
            variant: 'primary',
            icon: 'pi pi-question-circle',
            header: 'Confirmer l’enregistrement',
            acceptLabel: 'Enregistrer',
        },
        send: {
            variant: 'primary',
            icon: 'pi pi-send',
            header: 'Confirmer l’envoi',
            acceptLabel: 'Envoyer',
        },
        validate: {
            variant: 'success',
            icon: 'pi pi-check-circle',
            header: 'Confirmer la validation',
            acceptLabel: 'Valider',
        },
    };

    /** Lues par le template de `FxConfirmDialogComponent`. Une seule modale
     *  pouvant être ouverte à la fois, un champ courant suffit — l'objet
     *  `Confirmation` de PrimeNG n'accepte pas de champ libre. */
    variant: ConfirmVariant = 'primary';

    constructor(private readonly confirmation: ConfirmationService) {}

    /** Suppression définitive d'une entité. */
    confirmDelete(req: ConfirmRequest): void {
        this.open('delete', req);
    }

    /** Perte d'un travail en cours (fermeture d'un wizard sale, abandon). */
    confirmDiscard(req: ConfirmRequest): void {
        this.open('discard', req);
    }

    /** Création d'une entité. */
    confirmCreate(req: ConfirmRequest): void {
        this.open('create', req);
    }

    /** Enregistrement de modifications, changement d'état courant. */
    confirmSave(req: ConfirmRequest): void {
        this.open('save', req);
    }

    /** Transmission à un autre rôle (coordinateur, magasin, admin). */
    confirmSend(req: ConfirmRequest): void {
        this.open('send', req);
    }

    /** Validation qui fige une donnée (composant validé, prix arrêté). */
    confirmValidate(req: ConfirmRequest): void {
        this.open('validate', req);
    }

    /**
     * Variante attendant la réponse, pour les gardes de fermeture qui doivent
     * décider AVANT de poursuivre (`if (!(await confirm.ask(...))) return;`).
     * Résout `false` sur refus, fermeture, Échap ou clic sur le masque.
     */
    ask(
        kind: ConfirmKind,
        req: Omit<ConfirmRequest, 'accept' | 'reject'>,
    ): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this.open(kind, {
                ...req,
                accept: () => resolve(true),
                reject: () => resolve(false),
            });
        });
    }

    private open(kind: ConfirmKind, req: ConfirmRequest): void {
        const preset = ConfirmService.PRESETS[kind];
        this.variant = preset.variant;
        this.confirmation.confirm({
            message: req.message,
            header: req.header ?? preset.header,
            icon: preset.icon,
            acceptLabel: req.acceptLabel ?? preset.acceptLabel,
            rejectLabel: 'Annuler',
            accept: req.accept,
            reject: req.reject,
        });
    }
}
