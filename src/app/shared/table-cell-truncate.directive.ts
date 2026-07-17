import { AfterViewInit, Directive, ElementRef, HostListener, inject } from '@angular/core';

/**
 * Tronque le CONTENU TEXTE des cellules de tableau (« … ») et affiche la valeur
 * complète au survol — même comportement que la colonne Adresse de la liste
 * Sociétés, mais appliqué automatiquement à tout un tableau.
 *
 * Sélecteur `td` : la directive s'attache à chaque cellule du/des tableau(x) du
 * composant qui l'importe. Elle est CONSERVATRICE — elle ne touche QUE les
 * cellules dont le contenu est du texte pur (`childElementCount === 0`) :
 * les cellules d'actions (boutons), de pastilles (`p-tag`) ou contenant un
 * composant (ex. `app-truncate-cell`) sont ignorées, donc jamais rognées.
 *
 * Le tooltip (attribut `title` natif) n'est posé QUE si le texte déborde
 * réellement (mesure scrollWidth/clientWidth) → aucune bulle sur les valeurs
 * courtes. `title` plutôt que `pTooltip` car le Tooltip de PrimeNG 17 n'est pas
 * `standalone` et ne peut donc pas être composé depuis une directive.
 *
 * Usage : importer `TableCellTruncateDirective` dans le module (ou le composant
 * standalone) qui déclare la liste. Aucune modification colonne par colonne.
 * La largeur max + l'ellipsis viennent de la classe globale `.trc-cell`
 * (styles.scss), posée ici.
 */
@Directive({
  selector: 'td',
  standalone: true,
})
export class TableCellTruncateDirective implements AfterViewInit {
  private readonly el: HTMLTableCellElement = inject(ElementRef).nativeElement;

  ngAfterViewInit(): void {
    this.sync();
  }

  /** Re-mesure avant l'affichage : le contenu d'une ligne peut avoir changé. */
  @HostListener('mouseenter')
  onEnter(): void {
    this.sync();
  }

  /**
   * Une cellule est « texte » tant qu'elle ne contient ni élément interactif ni
   * composant : les simples `<span>` de mise en forme (pastille de localisation,
   * lien d'ID…) sont donc acceptés et tronqués avec le texte, alors qu'un
   * `<button>`, un `<p-tag>` ou un `<app-…>` fait renoncer.
   */
  private isTextCell(): boolean {
    if (this.el.querySelector('button, a, input, select, textarea, img')) {
      return false;
    }
    // Toute balise à tiret = composant Angular/PrimeNG (p-tag, app-truncate-cell…)
    return !Array.from(this.el.querySelectorAll('*')).some((c) =>
      c.tagName.includes('-'),
    );
  }

  private sync(): void {
    if (!this.isTextCell()) {
      this.el.removeAttribute('title');
      return;
    }
    const text = (this.el.textContent ?? '').trim();
    if (!text) {
      this.el.removeAttribute('title');
      return;
    }

    this.el.classList.add('trc-cell'); // ellipsis + max-width (global)
    // Valeur complète au survol UNIQUEMENT si le texte est réellement tronqué.
    if (this.el.scrollWidth > this.el.clientWidth + 1) {
      this.el.setAttribute('title', text);
    } else {
      this.el.removeAttribute('title');
    }
  }
}
