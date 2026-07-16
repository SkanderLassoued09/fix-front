import { Directive, OnInit } from '@angular/core';
import { Dropdown } from 'primeng/dropdown';

/**
 * Rend TOUS les `<p-dropdown>` recherchables, sans avoir à répéter la config sur
 * chaque instance. S'applique automatiquement dès que la directive est importée
 * dans le module / composant standalone qui héberge le dropdown.
 *
 * Ce qu'elle règle :
 *  - `filter` → activé (PrimeNG le laisse à false par défaut ; `p-multiSelect`,
 *    lui, l'a déjà à true — d'où l'absence de directive équivalente).
 *  - `resetFilterOnHide` → true, pour rouvrir le dropdown sur une liste propre.
 *  - `filterBy` → PIÈGE PrimeNG : sans `filterBy`/`filterFields`/`optionValue`,
 *    le filtre traite chaque option comme une STRING (`option.toLowerCase()`) et
 *    lève un TypeError sur des options OBJET. On cible donc explicitement
 *    `optionLabel` quand il existe, ce qui bascule sur le `filterService`.
 *    (`filterMatchMode` vaut déjà 'contains' par défaut.)
 *
 * Une instance qui définit explicitement `[filter]="true"` ou son propre
 * `filterBy` garde sa configuration : on ne fait que combler ce qui manque.
 */
@Directive({
  selector: 'p-dropdown',
  standalone: true,
})
export class SearchableDropdownDirective implements OnInit {
  constructor(private readonly dropdown: Dropdown) {}

  ngOnInit(): void {
    const d = this.dropdown;

    if (!d.filter) d.filter = true;
    d.resetFilterOnHide = true;

    // Évite le TypeError décrit ci-dessus sur les options objet.
    if (!d.filterBy && !d.filterFields && d.optionLabel) {
      d.filterBy = d.optionLabel;
    }

    if (!d.filterPlaceholder) d.filterPlaceholder = 'Rechercher…';
  }
}
