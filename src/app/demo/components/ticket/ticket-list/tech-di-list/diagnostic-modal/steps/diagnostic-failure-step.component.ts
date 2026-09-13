import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Dropdown, DropdownModule } from 'primeng/dropdown';
import { SearchableDropdownDirective } from 'src/app/shared/searchable-dropdown.directive';
import { CategoryOption } from '../diagnostic-modal.types';
import { DIAG_STEP_STYLES } from './diagnostic-step.styles';

/** En deçà, « Créer » resterait proposé sur une frappe accidentelle. */
const MIN_CREATE_LENGTH = 2;
/** Seuil d'alerte du compteur de caractères (90 % de `maxlength`). */
const COUNTER_LIMIT = 1000;
const COUNTER_NEAR = COUNTER_LIMIT * 0.9;

/**
 * Étape « Panne & symptômes » :
 *   - Catégorie de diagnostic (obligatoire) — CHERCHABLE, et CRÉABLE depuis le
 *     panneau quand aucune catégorie ne porte le nom saisi ;
 *   - Description de la panne (obligatoire, compteur 0/1000) ;
 *   - Remarque technicien (OBLIGATOIRE, compteur).
 *
 * Le composant reste du pur câblage d'UI : il n'appelle AUCUNE mutation. La
 * création est une INTENTION (`createCategory`) que le parent `tech-di-list`
 * exécute — c'est lui qui détient le formulaire, la liste et `MutationRunner`.
 *
 * ⚠️ DEUX PIÈGES PrimeNG 17.2, tous deux vérifiés dans
 * `node_modules/primeng/fesm2022/primeng-dropdown.mjs` :
 *
 *  1. LE PANNEAU EST RENDU AVEC `appendTo="body"`, donc HORS du `:host`.
 *     `:host ::ng-deep .x` compile en `[_nghost-…] .x` et ne matcherait jamais
 *     ses enfants. On porte la portée par `panelStyleClass` + un `::ng-deep` de
 *     PREMIER NIVEAU. (Les éléments écrits dans NOTRE template — `.cat-empty`,
 *     `.cat-create` — emportent bien leur `_ngcontent` où qu'ils soient rendus,
 *     mais le conteneur, lui, appartient à PrimeNG.)
 *
 *  2. LE `mousedown` DANS LE PANNEAU DÉPLACE LE FOCUS hors du champ de filtre
 *     et PrimeNG referme AVANT que le `click` ne parte : le bouton « Créer »
 *     paraîtrait mort une fois sur deux. D'où le `preventDefault()` sur
 *     `mousedown`.
 *
 * Le terme saisi n'est pas lisible après coup : `hide()` (`:945`) appelle
 * `resetFilter()` quand `resetFilterOnHide` est vrai — et la directive maison
 * le met à vrai. On mémorise donc le terme au fil de `(onFilter)` (`:1306`).
 */
@Component({
  selector: 'sav-diag-failure-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DropdownModule,
    SearchableDropdownDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step" [formGroup]="form">
      <header class="step__head">
        <span class="step__num">{{ stepNumber }}</span>
        <div>
          <h3>Panne &amp; symptômes</h3>
          <p>Décrivez la panne rencontrée et les symptômes observés.</p>
        </div>
      </header>

      <div class="step__grid">
        <!-- Deux GROUPES au lieu de trois champs à plat : la catégorie CLASSE
             la panne, les deux zones de texte la DÉCRIVENT. Sans cette
             hiérarchie, les trois blocs pleine largeur se lisaient comme une
             seule colonne indifférenciée. -->
        <section class="fgroup">
          <h4 class="fgroup__label">Classification</h4>

          <div class="field" [class.field--error]="categoryError">
            <label for="diag-category">
              Catégorie de diagnostic <span class="req">*</span>
            </label>
            <p-dropdown
              inputId="diag-category"
              formControlName="di_category_id"
              optionLabel="category"
              optionValue="_id"
              [options]="categories"
              placeholder="Choisir une catégorie"
              [autoDisplayFirst]="false"
              [virtualScroll]="categories.length > 50"
              [virtualScrollItemSize]="38"
              appendTo="body"
              styleClass="sav-diag-dropdown"
              panelStyleClass="sav-diag-cat-panel"
              filterPlaceholder="Rechercher ou saisir un nouveau nom…"
              (onFilter)="filterTerm = $event.filter ?? ''"
              (onShow)="filterTerm = ''"
              (onChange)="categoryTouched = true"
              (onHide)="filterTerm = ''; categoryTouched = true"
            >
              <!-- Aucun résultat : on NOMME ce qui a été cherché. -->
              <ng-template pTemplate="emptyfilter">
                <div class="cat-empty">
                  <i class="pi pi-search"></i>
                  <span>Aucune catégorie ne correspond à « {{ term }} »</span>
                </div>
              </ng-template>

              <!-- Pied PERSISTANT (rendu hors de la liste d'items, donc visible
                   même quand la recherche ramène des voisins) : proposé dès
                   qu'aucune catégorie ne porte EXACTEMENT ce nom. -->
              <ng-template pTemplate="footer">
                <div class="cat-create" *ngIf="canCreateCategory">
                  <button
                    type="button"
                    class="cat-create__btn"
                    [disabled]="categoryCreating"
                    (mousedown)="$event.preventDefault(); $event.stopPropagation()"
                    (click)="$event.stopPropagation(); createCategory.emit(term)"
                  >
                    <i
                      class="pi"
                      [ngClass]="
                        categoryCreating ? 'pi-spin pi-spinner' : 'pi-plus'
                      "
                    ></i>
                    Créer « {{ term }} »
                  </button>
                  <small>
                    Ajoutée au référentiel, visible par toute l'équipe.
                  </small>
                </div>
              </ng-template>
            </p-dropdown>
            <small class="field__error" *ngIf="categoryError">
              Choisissez une catégorie, ou créez-la depuis la liste.
            </small>
            <small class="field__hint" *ngIf="!categoryError">
              Introuvable ? Saisissez son nom dans la recherche : un bouton
              « Créer » apparaîtra.
            </small>
          </div>
        </section>

        <section class="fgroup">
          <h4 class="fgroup__label">Constat du technicien</h4>

          <div class="field" [class.field--error]="remarkError">
            <label for="diag-desc">
              Description de la panne <span class="req">*</span>
            </label>
            <textarea
              id="diag-desc"
              class="sav-diag-textarea"
              rows="5"
              maxlength="1000"
              placeholder="Décrivez la panne en détail…"
              formControlName="remarqueTech"
              (blur)="remarkTouched = true"
            ></textarea>
            <small class="field__error" *ngIf="remarkError">
              La description de la panne est obligatoire.
            </small>
            <div class="counter" [class.is-near]="isNear('remarqueTech')">
              {{ length('remarqueTech') }} / 1000
            </div>
          </div>

          <div class="field" [class.field--error]="extraError">
            <label for="diag-extra">
              Remarque technicien <span class="req">*</span>
            </label>
            <textarea
              id="diag-extra"
              class="sav-diag-textarea"
              rows="3"
              maxlength="1000"
              placeholder="Remarques ou informations complémentaires…"
              formControlName="remarqueExtra"
              (blur)="extraTouched = true"
            ></textarea>
            <small class="field__error" *ngIf="extraError">
              La remarque technicien est obligatoire.
            </small>
            <div class="counter" [class.is-near]="isNear('remarqueExtra')">
              {{ length('remarqueExtra') }} / 1000
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    DIAG_STEP_STYLES,
    `
      /* ── Groupes de champs ────────────────────────────────────────────────
         Intertitre repris de la convention maison (cf. le modal « Affectation
         Estimation ») : petites capitales + filet. C'est ce qui donne le
         rythme — respiration LARGE entre groupes, serrée à l'intérieur. */
      .fgroup { min-width: 0; }
      .fgroup__label {
        margin: 0 0 0.55rem;
        padding-bottom: 0.4rem;
        border-bottom: 1px solid var(--fx-border);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        /* Couleur EXPLICITE : une valeur héritée perd contre le thème PrimeNG
           et l'intertitre passerait sombre-sur-sombre après bascule. */
        color: var(--fx-text-muted);
      }
      /* Les deux zones de texte du même groupe se suivent de près : elles
         forment un bloc, alors que le gap du grid (1.25rem) sépare les
         groupes entre eux. */
      .fgroup .field + .field { margin-top: 0.85rem; }

      .sav-diag-textarea {
        width: 100%;
        padding: 0.7rem 0.85rem;
        border: 1px solid var(--fx-border);
        border-radius: 9px;
        font-size: 0.88rem;
        font-family: inherit;
        resize: vertical;
        color: var(--fx-text);
        background: var(--fx-bg-card);
        line-height: 1.55;
        transition: border-color 120ms ease, box-shadow 120ms ease;
      }
      .sav-diag-textarea::placeholder { color: var(--fx-text-subtle); }
      .sav-diag-textarea:focus {
        outline: none;
        border-color: var(--fx-blue);
        box-shadow: 0 0 0 3px var(--fx-blue-soft-bg-2);
      }

      /* Sélecteur COMPOSÉ et ::ng-deep de PREMIER NIVEAU : « styleClass »
         atterrit sur le div .p-dropdown INTERNE, qui porte le _ngcontent
         de PrimeNG et non le nôtre. */
      :host ::ng-deep .sav-diag-dropdown.p-dropdown {
        width: 100%;
        border-color: var(--fx-border);
        border-radius: 9px;
        min-height: 42px;
        box-shadow: none;
      }
      :host ::ng-deep .sav-diag-dropdown.p-dropdown:not(.p-disabled).p-focus {
        border-color: var(--fx-blue);
        box-shadow: 0 0 0 3px var(--fx-blue-soft-bg-2);
      }
      :host ::ng-deep .sav-diag-dropdown.p-dropdown .p-dropdown-label {
        display: flex;
        align-items: center;
        padding: 0.55rem 0.85rem;
        font-size: 0.88rem;
      }
      :host
        ::ng-deep
        .sav-diag-dropdown.p-dropdown
        .p-dropdown-label.p-placeholder {
        color: var(--fx-text-subtle);
      }

      /* État d'erreur — le champ doit se voir, pas seulement le message. */
      .field--error .sav-diag-textarea { border-color: var(--fx-red); }
      :host ::ng-deep .field--error .sav-diag-dropdown.p-dropdown {
        border-color: var(--fx-red);
      }

      /* ── Contenu du panneau ────────────────────────────────────────────────
         PAS de :host devant ces deux blocs : le panneau est rendu sur <body>.
         Ces éléments viennent de NOTRE template, ils emportent donc leur
         attribut _ngcontent où qu'ils soient rendus — un sélecteur de classe
         simple suffit et reste encapsulé. */
      .cat-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1.1rem 0.9rem;
        color: var(--fx-text-muted);
        font-size: 0.82rem;
        text-align: center;
      }
      .cat-empty .pi { font-size: 0.9rem; color: var(--fx-text-subtle); }

      .cat-create {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 0.6rem;
        border-top: 1px solid var(--fx-border);
        background: var(--fx-bg-surface);
      }
      .cat-create__btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        width: 100%;
        min-height: 36px;
        padding: 0.45rem 0.8rem;
        border: 1px solid var(--fx-green-soft-bd);
        border-radius: 8px;
        background: var(--fx-green-soft-bg);
        color: var(--fx-green-text);
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 650;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease;
      }
      .cat-create__btn:hover:not(:disabled) {
        background: var(--fx-green-soft-bg-2);
        border-color: var(--fx-green);
      }
      .cat-create__btn:disabled { opacity: 0.6; cursor: progress; }
      .cat-create small {
        text-align: center;
        font-size: 0.7rem;
        color: var(--fx-text-subtle);
      }
    `,
    `
      /* Le CONTENEUR du panneau appartient à PrimeNG (pas notre _ngcontent) :
         portée par panelStyleClass + ::ng-deep de PREMIER NIVEAU, sans :host. */
      ::ng-deep .sav-diag-cat-panel .p-dropdown-items .p-dropdown-item {
        font-size: 0.85rem;
        padding: 0.5rem 0.85rem;
      }
      ::ng-deep .sav-diag-cat-panel .p-dropdown-filter { font-size: 0.85rem; }
    `,
  ],
})
export class DiagnosticFailureStepComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) categories!: readonly CategoryOption[];
  /** Numéro affiché — vient du MÊME tableau `steps` que le stepper de gauche. */
  @Input() stepNumber = 0;
  /** Création en vol → spinner + bouton inerte (anti double-clic visuel). */
  @Input() categoryCreating = false;

  /** Terme saisi, à créer. Le parent décide (doublon → sélection, sinon mutation). */
  @Output() createCategory = new EventEmitter<string>();

  @ViewChild(Dropdown) private dropdown?: Dropdown;

  filterTerm = '';
  private tick = 0;

  /**
   * Bumpé par le parent APRÈS une création (ou la sélection d'un doublon)
   * réussie → on referme le panneau. Un signal explicite plutôt qu'une
   * heuristique sur la valeur du formulaire : en cas d'ÉCHEC le panneau reste
   * ouvert et le terme saisi n'est pas perdu.
   */
  @Input() set categoryCreatedTick(v: number) {
    if (v !== this.tick) {
      this.tick = v;
      this.dropdown?.hide();
    }
  }

  get term(): string {
    return this.filterTerm.trim();
  }

  /** Proposé tant qu'AUCUNE catégorie ne porte exactement ce nom — même règle
   *  de comparaison que le back (trimé, insensible à la casse). */
  get canCreateCategory(): boolean {
    const t = this.term.toLocaleLowerCase();
    if (t.length < MIN_CREATE_LENGTH) return false;
    return !this.categories.some(
      (c) => (c.category ?? '').trim().toLocaleLowerCase() === t,
    );
  }

  /**
   * ⚠️ ON NE LIT PAS `control.touched` ICI.
   *
   * Le CVA du `p-dropdown` appelle `onModelTouched()` depuis la vue de
   * PrimeNG : cela salit SA vue, pas la nôtre. Et `markAsTouched()` n'émet
   * rien en Angular 17 (`statusChanges` ne se déclenche pas pour `touched`,
   * et `AbstractControl.events` n'existe qu'à partir de la v18). Dans un
   * composant OnPush, un template qui lit `touched` peut donc ne JAMAIS
   * repeindre.
   *
   * Les drapeaux ci-dessous sont posés par des écouteurs déclarés dans NOTRE
   * template — ils marquent donc notre vue à rafraîchir. `invalid` (les
   * Validators) reste la vérité ; le drapeau ne décide que du MOMENT où
   * l'erreur s'affiche.
   */
  categoryTouched = false;
  remarkTouched = false;
  extraTouched = false;

  get categoryError(): boolean {
    const c = this.form.get('di_category_id');
    return !!c && c.invalid && (this.categoryTouched || c.dirty);
  }

  /** Le `(input)` du textarea est câblé par `DefaultValueAccessor` DANS notre
   *  template : `dirty` y repeint donc de façon fiable. */
  get remarkError(): boolean {
    const c = this.form.get('remarqueTech');
    return !!c && c.invalid && (this.remarkTouched || c.dirty);
  }

  /** Même idiome que `remarkError` — la remarque technicien est obligatoire
   *  (elle est concaténée à la description et persistée par le parent). */
  get extraError(): boolean {
    const c = this.form.get('remarqueExtra');
    return !!c && c.invalid && (this.extraTouched || c.dirty);
  }

  length(name: string): number {
    return (this.form.get(name)?.value ?? '').toString().length;
  }

  isNear(name: string): boolean {
    return this.length(name) >= COUNTER_NEAR;
  }
}
