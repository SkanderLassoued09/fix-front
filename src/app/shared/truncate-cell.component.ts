import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';

/**
 * Cellule de tableau à contenu long — TRONCATURE + tooltip, RÉUTILISABLE.
 *
 * Borne la hauteur des lignes (grille uniforme) tout en gardant la valeur
 * complète accessible au survol. `lines = 1` → ellipsis simple ; `lines > 1` →
 * line-clamp sur N lignes.
 *
 * Usage :
 *   <app-truncate-cell [value]="row.address" [lines]="2"></app-truncate-cell>
 *
 * La largeur est bornée par la cellule hôte (`max-width` sur le <td>), pas ici :
 * le composant s'adapte à son conteneur.
 */
@Component({
  selector: 'app-truncate-cell',
  standalone: true,
  imports: [CommonModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="trc"
      [class.trc--clamp]="lines > 1"
      [style.-webkit-line-clamp]="lines > 1 ? lines : null"
      [pTooltip]="text"
      tooltipPosition="top"
      [tooltipDisabled]="!text || text === placeholder"
      [attr.title]="null"
      >{{ text || placeholder }}</span
    >
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .trc {
        display: block;
        overflow: hidden;
        /* 1 ligne : ellipsis simple */
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      /* N lignes : line-clamp (hauteur bornée, grille régulière) */
      .trc--clamp {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        white-space: normal;
        text-overflow: clip;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class TruncateCellComponent {
  /** Valeur à afficher (déjà nettoyée par l'appelant si besoin). */
  @Input() value: unknown;
  /** Nombre de lignes avant troncature (1 = ellipsis, >1 = line-clamp). */
  @Input() lines = 1;
  /** Affiché quand la valeur est vide. */
  @Input() placeholder = '—';

  get text(): string {
    return (this.value ?? '').toString().trim();
  }
}
