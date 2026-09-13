import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TreeSelectModule } from 'primeng/treeselect';
import { TreeNode } from 'primeng/api';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ComposantEntry } from '../diagnostic-modal.types';
import { DIAG_STEP_STYLES } from './diagnostic-step.styles';

/**
 * Step 3 · Composants — arbre « Catégorie → Composant » + qty + add/remove +
 * create. Émet des intentions au parent : les mutations TicketService
 * existantes (recherche + ajout) continuent de passer par le code historique.
 *
 * Le picker était un `p-dropdown` PLAT alimenté par tout le catalogue
 * (`findAllComposant`). Il est devenu un `p-treeSelect` à deux niveaux dont les
 * enfants sont chargés À L'OUVERTURE du nœud, doublé d'une recherche qui
 * interroge le serveur directement.
 *
 * ⚠️ DEUX PIÈGES PrimeNG, tous deux déjà payés ici :
 *
 *  1. LE FILTRE INTÉGRÉ DE `p-treeSelect` EST VOLONTAIREMENT DÉSACTIVÉ
 *     (`[filter]="false"`) et remplacé par le champ du template `header`.
 *     Raison, vérifiée dans le code de PrimeNG 17.2 : le `p-tree` interne rend
 *     `getRootNode() = filteredNodes ?? value`, et `filteredNodes` n'est
 *     recalculé QUE par une frappe dans le champ intégré — le setter
 *     `options` appelle `updateTreeState()`, jamais `_filter()`, et le
 *     `ngOnChanges` de `p-tree` ne réagit qu'à `value`. Avec le filtre
 *     intégré, remplacer `[options]` par les résultats SERVEUR laisse donc un
 *     `filteredNodes` PÉRIMÉ à l'écran : la recherche profonde serait
 *     invisible. En le désactivant, `[options]` est toujours exactement ce qui
 *     est rendu, et le serveur reste la seule source de vérité.
 *
 *  2. `SearchableDropdownDirective` cible le sélecteur `p-dropdown` : elle ne
 *     s'applique PLUS ici. La recherche est donc câblée explicitement.
 */
@Component({
  selector: 'sav-diag-components-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    // `FormsModule` en PLUS de `ReactiveFormsModule` : la cellule quantité
    // utilise un `[ngModel]` standalone (hors FormGroup), que
    // `ReactiveFormsModule` ne fournit pas.
    FormsModule,
    TreeSelectModule,
    InputNumberModule,
    ProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step" [formGroup]="form">
      <!-- L'action de création vit dans l'EN-TÊTE de section : c'est une
           action de contexte, pas une étape du formulaire. « margin-left:auto »
           la pousse à droite sans toucher au gabarit d'en-tête partagé. -->
      <header class="step__head">
        <span class="step__num">{{ stepNumber }}</span>
        <div>
          <h3>Composants requis</h3>
          <p>Ajoutez les pièces nécessaires si le DI contient des PDR.</p>
        </div>
        <button type="button" class="head-action" (click)="create.emit()">
          <i class="pi pi-plus"></i> Créer un composant
        </button>
      </header>

      <!-- Blocage PDR sans composant — affiché ICI (étape Composants), pas à
           Validation. Visible tant que PDR est activé et qu'aucun composant n'a
           été ajouté ; il faut ajouter un composant OU désactiver PDR.
           Compact et sans bordure : c'est une condition à lever, pas le sujet
           de l'écran. -->
      <p
        class="notice"
        *ngIf="form.get('isPdr')?.value !== false && !composants.length"
      >
        <i class="pi pi-exclamation-triangle"></i>
        Ajoutez au moins un composant ou désactivez PDR (étape Validation).
      </p>

      <!-- Une seule ligne de formulaire, SANS carte : le champ porte déjà sa
           bordure, l'emboîter dans un bloc encadré ajoutait un niveau pour
           rien. -->
      <div class="add-row">
        <div class="field">
          <label for="diag-composant">Composant</label>
          <p-treeSelect
            inputId="diag-composant"
            formControlName="composantSelected"
            [options]="nodes"
            selectionMode="single"
            [filter]="false"
            placeholder="Parcourir par catégorie ou rechercher"
            appendTo="body"
            containerStyleClass="sav-diag-treeselect"
            panelStyleClass="sav-diag-treeselect-panel"
            (onNodeExpand)="onNodeExpand($event)"
          >
            <!-- Champ de recherche MAISON : voir la note ⚠️ 1 en tête de
                 fichier. Le filtre intégré de PrimeNG ne doit PAS être
                 activé ici. -->
            <ng-template pTemplate="header">
              <div class="tree-search">
                <i class="pi pi-search"></i>
                <input
                  #searchBox
                  type="text"
                  autocomplete="off"
                  placeholder="Rechercher dans tout le catalogue…"
                  (input)="filterChanged.emit(searchBox.value)"
                  (keydown.escape)="clearSearch(searchBox)"
                />
                <button
                  *ngIf="searchBox.value"
                  type="button"
                  class="tree-search__clear"
                  aria-label="Effacer la recherche"
                  (click)="clearSearch(searchBox)"
                >
                  <i class="pi pi-times"></i>
                </button>
              </div>
            </ng-template>

            <ng-template pTemplate="empty">
              <div class="tree-state">
                <ng-container *ngIf="treeLoading || searching; else noResult">
                  <i class="pi pi-spin pi-spinner"></i>
                  <span>{{ searching ? 'Recherche…' : 'Chargement…' }}</span>
                </ng-container>
                <ng-template #noResult>
                  <i class="pi pi-search"></i>
                  <span>Aucun composant trouvé</span>
                </ng-template>
              </div>
            </ng-template>
          </p-treeSelect>
        </div>

        <div class="field field--qty">
          <label for="diag-qty">Quantité</label>
          <p-inputNumber
            inputId="diag-qty"
            formControlName="quantity"
            [showButtons]="true"
            buttonLayout="stacked"
            [min]="1"
            inputStyleClass="sav-diag-qty"
            styleClass="sav-diag-qty-wrap"
          ></p-inputNumber>
        </div>

        <button type="button" class="btn btn--primary" (click)="add.emit()">
          <i class="pi pi-plus"></i> Ajouter composant
        </button>
      </div>

      <section class="selection">
        <div class="selection__head">
          <span class="selection__title">Composants sélectionnés</span>
          <span class="selection__count">{{ composants.length }}</span>
          <!-- Total de PIÈCES (≠ nombre de lignes) : c'est le chiffre que le
               magasin prépare. Il remplace le pied de tableau — même
               information, un bloc de moins. -->
          <span class="selection__total" *ngIf="composants.length">
            {{ totalQuantity }} pièce{{ totalQuantity > 1 ? 's' : '' }}
          </span>
        </div>

        <table class="table" *ngIf="composants.length; else empty">
          <thead>
            <tr>
              <th>Composant</th>
              <th class="qty">Quantité</th>
              <th class="act"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of composants; trackBy: trackByName">
              <td>{{ c.nameComposant }}</td>
              <!-- Quantité CORRIGIBLE sur place : même widget que la ligne
                   d'ajout ci-dessus. Liaison ngModel en UNE SEULE VOIE +
                   ngModelChange — l'entrée reste en lecture seule, on n'écrit
                   jamais dans la ligne ; c'est le parent qui remplace le
                   tableau. L'option « standalone » est obligatoire : ce
                   template vit dans un formGroup auquel ce contrôle
                   n'appartient pas. -->
              <td class="qty">
                <p-inputNumber
                  [ngModel]="c.quantity"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="onQuantityChange(c, $event)"
                  [showButtons]="true"
                  buttonLayout="stacked"
                  [min]="1"
                  [useGrouping]="false"
                  inputStyleClass="sav-diag-qty"
                  styleClass="sav-diag-qty-wrap sav-diag-qty-wrap--cell"
                  [attr.aria-label]="'Quantité de ' + c.nameComposant"
                ></p-inputNumber>
              </td>
              <td class="act">
                <button
                  type="button"
                  class="btn-icon"
                  (click)="remove.emit(c.nameComposant)"
                  [attr.aria-label]="'Retirer ' + c.nameComposant"
                >
                  <i class="pi pi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <ng-template #empty>
          <p class="empty">
            <i class="pi pi-inbox"></i>
            Aucun composant ajouté pour l'instant.
          </p>
        </ng-template>
      </section>
    </div>
  `,
  styles: [
    DIAG_STEP_STYLES,
    `
      /* Action de contexte dans l'en-tête de section. Le gabarit partagé
         (DIAG_STEP_STYLES) n'est pas modifié : seul cet enfant se pousse à
         droite, les autres étapes gardent leur en-tête tel quel. */
      .head-action {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        margin-left: auto;
        align-self: center;
        padding: 0.4rem 0.7rem;
        border: 1px solid var(--fx-border);
        border-radius: 7px;
        background: var(--fx-bg-card);
        color: var(--fx-text-strong);
        font-family: inherit;
        font-size: 0.78rem;
        font-weight: 650;
        white-space: nowrap;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease;
      }
      .head-action:hover {
        background: var(--fx-bg-surface);
        border-color: var(--fx-border-strong);
      }
      .head-action .pi { font-size: 0.7rem; }

      /* Condition à lever, pas le sujet de l'écran : une seule ligne, teinte
         douce, AUCUNE bordure — elle ne doit pas peser autant que le
         formulaire. */
      .notice {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        margin: 0 0 1.1rem;
        padding: 0.5rem 0.7rem;
        border-radius: 7px;
        background: var(--fx-amber-soft-bg);
        color: var(--fx-amber-text);
        font-size: 0.78rem;
        font-weight: 600;
        line-height: 1.35;
      }
      .notice .pi { font-size: 0.8rem; flex-shrink: 0; }

      /* UNE ligne, pas de carte : le champ le plus large d'abord, puis un
         compteur compact, puis l'action principale. « align-items: end » aligne
         les trois contrôles sur la même ligne de base malgré les libellés. */
      .add-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 116px auto;
        gap: 0.7rem;
        align-items: end;
        margin-bottom: 1.6rem;
      }
      /* PrimeFlex définit un « .field { margin-bottom: 1rem } » GLOBAL
         (styles.scss importe primeflex). Notre classe .field partagée le
         récupère : avec « align-items: end », c'est alors la boîte de MARGE
         qui s'aligne sur le bas de la ligne, et le bouton se retrouvait 14 px
         plus bas que les deux champs. L'espacement de cette ligne vient du
         « gap », pas de marges : on neutralise, ici seulement. */
      .add-row .field { margin-bottom: 0; }
      .field--qty { min-width: 0; }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        height: 42px;
        padding: 0 1rem;
        border-radius: 8px;
        font-family: inherit;
        font-size: 0.8rem;
        font-weight: 650;
        cursor: pointer;
        border: 1px solid transparent;
        white-space: nowrap;
      }
      .btn .pi { font-size: 0.72rem; }
      .btn--primary {
        background: var(--fx-blue);
        color: var(--fx-text-on-accent);
        border-color: var(--fx-blue-strong);
      }
      .btn--primary:hover { background: var(--fx-blue-strong); }

      /* En-tête de liste : même « eyebrow » que le reste de l'application
         (0.72rem / 700 / majuscules), pas un titre de carte. */
      .selection__head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--fx-border);
      }
      .selection__title {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--fx-text-muted-strong);
      }
      .selection__count {
        display: inline-grid;
        place-items: center;
        min-width: 20px;
        height: 20px;
        padding: 0 0.35rem;
        border-radius: 10px;
        background: var(--fx-slate-soft-bg-2);
        color: var(--fx-text-muted-strong);
        font-size: 0.72rem;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .selection__total {
        margin-left: auto;
        font-size: 0.74rem;
        color: var(--fx-text-subtle);
        font-variant-numeric: tabular-nums;
      }

      /* Tableau NU : pas de conteneur encadré, seules les lignes séparent. */
      .table { width: 100%; border-collapse: collapse; }
      .table th,
      .table td {
        padding: 0.55rem 0.5rem;
        font-size: 0.82rem;
        text-align: left;
        border-bottom: 1px solid var(--fx-border);
      }
      .table th {
        padding-top: 0.5rem;
        color: var(--fx-text-subtle);
        font-weight: 650;
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .table tbody tr:last-child td { border-bottom: none; }
      .table tbody tr:hover td { background: var(--fx-bg-hover); }
      .table td:first-child { color: var(--fx-text); }
      .qty { width: 132px; text-align: right; font-variant-numeric: tabular-nums; }
      /* La cellule ne respire pas comme une ligne de formulaire : on rend le
         padding vertical au tableau, pas au widget. */
      .table td.qty { padding-top: 0.3rem; padding-bottom: 0.3rem; }
      .act { width: 44px; text-align: right; }
      .btn-icon {
        display: inline-grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--fx-text-subtle);
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease;
      }
      .btn-icon:hover {
        background: var(--fx-red-soft-bg);
        color: var(--fx-red-text);
      }

      /* État vide COMPACT : une ligne centrée. Le grand rectangle en pointillés
         occupait un tiers de l'écran pour dire qu'il n'y avait rien. */
      .empty {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        margin: 0;
        padding: 1.35rem 1rem;
        color: var(--fx-text-subtle);
        font-size: 0.8rem;
      }
      .empty .pi { font-size: 0.9rem; }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      :host ::ng-deep p-treeselect { display: block; width: 100%; }

      /* ⚠️ Sélecteur COMPOSÉ. « styleClass » de PrimeNG atterrit SUR le div
         .p-treeselect lui-même : la forme descendante
         « .sav-diag-treeselect .p-treeselect » ne matche RIEN (il n'existe pas
         de .p-treeselect DANS un .p-treeselect). Elle était écrite ainsi, donc
         la hauteur et le rayon n'ont jamais été appliqués — le champ ne
         s'alignait sur le compteur et le bouton que par coïncidence. */
      :host ::ng-deep .sav-diag-treeselect.p-treeselect {
        display: flex;
        align-items: center;
        width: 100%;
        height: 42px;
        border-color: var(--fx-border);
        border-radius: 8px;
        box-shadow: none;
      }
      :host ::ng-deep .sav-diag-treeselect.p-treeselect:not(.p-disabled).p-focus {
        border-color: var(--fx-blue);
        box-shadow: 0 0 0 3px var(--fx-blue-soft-bg-2);
      }
      :host ::ng-deep .sav-diag-treeselect .p-treeselect-label {
        display: flex;
        align-items: center;
        padding: 0 0.75rem;
        font-size: 0.85rem;
      }
      :host ::ng-deep .sav-diag-treeselect .p-treeselect-label.p-placeholder {
        color: var(--fx-text-subtle);
      }
      /* ⚠️ PAS de :host devant ces règles. Le panneau est rendu avec
         appendTo="body" : il n'est donc PAS un descendant du :host, et
         ":host ::ng-deep .x" compile en "[_nghost-…] .x" — qui ne matcherait
         jamais. On s'appuie sur la classe unique panelStyleClass pour porter
         la portée à la place. (Les éléments écrits dans NOTRE template —
         .tree-search, .tree-state — n'ont pas ce problème : ils emportent leur
         attribut _ngcontent où qu'ils soient rendus.) */
      ::ng-deep .sav-diag-treeselect-panel .p-tree {
        border: none;
        padding: 0.25rem;
      }
      ::ng-deep .sav-diag-treeselect-panel .p-treenode-label {
        font-size: 0.84rem;
      }
      /* Catégories : non sélectionnables, donc jamais en surbrillance —
         on les distingue typographiquement pour que ce soit lisible. */
      ::ng-deep .sav-diag-treeselect-panel .p-treenode-content.p-disabled {
        opacity: 1;
        cursor: default;
      }
      ::ng-deep .sav-diag-treeselect-panel
        .p-treenode-content.p-disabled
        .p-treenode-label {
        font-weight: 700;
        color: var(--fx-text-muted);
        text-transform: uppercase;
        font-size: 0.7rem;
        letter-spacing: 0.04em;
      }
      .tree-search {
        position: relative;
        display: flex;
        align-items: center;
        padding: 0.5rem;
        border-bottom: 1px solid var(--fx-border);
      }
      .tree-search > .pi-search {
        position: absolute;
        left: 1.1rem;
        font-size: 0.8rem;
        color: var(--fx-text-subtle);
        pointer-events: none;
      }
      .tree-search input {
        width: 100%;
        padding: 0.5rem 2rem 0.5rem 2.1rem;
        border: 1px solid var(--fx-border);
        border-radius: 6px;
        background: var(--fx-bg-card);
        color: var(--fx-text);
        font-size: 0.82rem;
      }
      .tree-search input:focus {
        outline: none;
        border-color: var(--fx-blue);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
      }
      .tree-search__clear {
        position: absolute;
        right: 1rem;
        display: grid;
        place-items: center;
        width: 20px;
        height: 20px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--fx-text-muted);
        cursor: pointer;
      }
      .tree-search__clear:hover { background: var(--fx-bg-surface-2); }
      .tree-search__clear .pi { font-size: 0.7rem; }

      .tree-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1.25rem 0.75rem;
        color: var(--fx-text-muted);
        font-size: 0.8rem;
      }
      /* Quantity: a single integrated 42px field — the stepper buttons sit
         flush inside the same rounded box as the number input. */
      /* L'HÔTE ne porte que la mise en page. « display » est obligatoire :
         <p-inputnumber> est un élément personnalisé, donc « inline » par
         défaut — une hauteur n'y serait pas appliquée et l'hôte resterait plus
         haut que le champ qu'il contient. */
      :host ::ng-deep p-inputnumber {
        display: flex;
        width: 100%;
      }
      /* La BOÎTE VISIBLE est le span interne, et lui seul : la règle portait
         la bordure sur l'hôte ET sur le span — deux bordures imbriquées, et le
         champ décalé d'1 px vers le bas par rapport au reste de la ligne. */
      :host ::ng-deep .sav-diag-qty-wrap.p-inputnumber {
        width: 100%;
        height: 42px;
        border: 1px solid var(--fx-border);
        border-radius: 8px;
        background: var(--fx-bg-card);
        overflow: hidden;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      :host ::ng-deep .sav-diag-qty-wrap.p-inputwrapper-focus,
      :host ::ng-deep .sav-diag-qty-wrap:focus-within {
        border-color: var(--fx-blue);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
      }
      :host ::ng-deep .sav-diag-qty {
        height: 40px;
        width: 100%;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      :host ::ng-deep .sav-diag-qty-wrap .p-inputnumber-button {
        width: 2.1rem;
        background: var(--fx-bg-surface-2);
        color: var(--fx-text-muted);
        border: none;
      }
      :host ::ng-deep .sav-diag-qty-wrap .p-inputnumber-button:hover {
        background: var(--fx-bg-surface-2);
        color: var(--fx-text);
      }
      :host ::ng-deep .sav-diag-qty-wrap .p-inputnumber-button:focus {
        box-shadow: none;
      }
      :host ::ng-deep .sav-diag-qty-wrap .p-inputnumber-button-up {
        border-bottom: 1px solid var(--fx-border);
      }

      /* Variante COMPACTE pour la cellule du tableau : le gabarit de la ligne
         d'ajout (42 px) déformerait les lignes. On ne surcharge que les
         hauteurs et la largeur des boutons — le reste du skin est partagé. */
      :host ::ng-deep .sav-diag-qty-wrap--cell.p-inputnumber {
        height: 34px;
      }
      :host ::ng-deep .sav-diag-qty-wrap--cell .sav-diag-qty {
        height: 32px;
        padding-left: 0.5rem;
        padding-right: 0.35rem;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      :host ::ng-deep .sav-diag-qty-wrap--cell .p-inputnumber-button {
        width: 1.7rem;
      }

      @media (max-width: 860px) {
        .step { padding: 1.1rem; }
        .picker__row {
          grid-template-columns: 1fr;
          gap: 0.85rem;
        }
        .field--actions { display: block; }
        .btn { width: 100%; }
      }
    `,
  ],
})
export class DiagnosticComponentsStepComponent {
  @Input({ required: true }) form!: FormGroup;
  /** Numéro affiché — vient du MÊME tableau `steps` que le stepper de gauche. */
  @Input() stepNumber = 0;
  /** Racines (catégories) — enfants chargés à l'ouverture du nœud. */
  @Input() nodes: readonly TreeNode[] = [];
  @Input() composants: readonly ComposantEntry[] = [];
  /** Arbre ou branche en cours de chargement. */
  @Input() treeLoading = false;
  /** Recherche serveur en vol. */
  @Input() searching = false;

  @Output() add = new EventEmitter<void>();
  @Output() create = new EventEmitter<void>();
  @Output() remove = new EventEmitter<string>();
  /** Quantité corrigée sur une ligne DÉJÀ ajoutée. Le parent remplace le
   *  tableau (snapshot OnPush) — cette étape ne mute jamais la ligne. */
  @Output() quantityChange = new EventEmitter<{
    nameComposant: string;
    quantity: number;
  }>();
  /** Ouverture d'une catégorie → le parent charge la page d'enfants. */
  @Output() nodeExpand = new EventEmitter<TreeNode>();
  /** Terme de recherche brut — le parent le débounce puis interroge le serveur. */
  @Output() filterChanged = new EventEmitter<string>();

  /** Vide le champ et revient à la navigation par catégorie. */
  clearSearch(input: HTMLInputElement): void {
    input.value = '';
    this.filterChanged.emit('');
  }

  onNodeExpand(event: { node?: TreeNode } | TreeNode): void {
    const node = (event as { node?: TreeNode })?.node ?? (event as TreeNode);
    if (node) {
      this.nodeExpand.emit(node);
    }
  }

  trackByName(_: number, c: ComposantEntry): string {
    return c.nameComposant;
  }

  /** `p-inputNumber` émet `null` dès que le champ est vidé, et émet aussi à
   *  l'initialisation. On ne propage donc que des ENTIERS ≥ 1, et rien du tout
   *  si la valeur n'a pas bougé (sinon chaque rendu relancerait un cycle
   *  émission → snapshot → rendu). */
  onQuantityChange(c: ComposantEntry, value: number | null): void {
    const next = Math.max(1, Math.floor(Number(value) || 1));
    if (next === c.quantity) return;
    this.quantityChange.emit({
      nameComposant: c.nameComposant,
      quantity: next,
    });
  }

  /** Total de PIÈCES (≠ nombre de lignes) — c'est ce que le magasin prépare. */
  get totalQuantity(): number {
    return this.composants.reduce((sum, c) => sum + (c.quantity ?? 0), 0);
  }
}
