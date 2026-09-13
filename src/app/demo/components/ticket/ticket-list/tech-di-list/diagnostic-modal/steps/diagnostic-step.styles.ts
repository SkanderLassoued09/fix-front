/**
 * Échelle COMMUNE aux cinq étapes de l'assistant de diagnostic.
 *
 * Pourquoi une constante et pas cinq blocs `styles:` : le squelette
 * (`.step`, `.step__head`, `.step__num`, `.field label`, `.req`…) était
 * recopié dans chaque étape, et c'est précisément ce qui a laissé l'étape
 * « Panne » dériver — padding 1.75/2rem, pastille 48 px, libellés 0.95rem —
 * quand les quatre autres tenaient 1.25/1.5rem, 36 px, 0.72rem. Passer d'une
 * étape à l'autre faisait « sauter » toute la typographie.
 *
 * Utilisation : `styles: [DIAG_STEP_STYLES, '…styles propres à l'étape…']`.
 * Angular concatène les deux, donc les règles spécifiques peuvent surcharger
 * celles-ci sans `!important` tant qu'elles sont au moins aussi spécifiques.
 *
 * ⚠️ Couleurs : jetons `--fx-*` UNIQUEMENT. Le modal est rendu sur `<body>`
 * (hors `.layout-wrapper`) : le crochet du mode sombre est `html.app-dark`, et
 * un hexadécimal en dur ne basculerait pas.
 */
export const DIAG_STEP_STYLES = `
  :host { display: block; }

  .step { padding: 1.5rem 1.75rem 1.75rem; }

  /* Filet sous l'en-tête : le corps de l'étape commence franchement, au lieu
     de flotter à distance variable du titre selon l'étape. */
  .step__head {
    display: flex;
    align-items: center;
    gap: .85rem;
    margin-bottom: 1.4rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--fx-border);
  }
  .step__num {
    display: inline-grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--fx-blue-soft-bg);
    color: var(--fx-blue-text);
    border: 1px solid var(--fx-blue-soft-bd);
    font-weight: 700;
    font-size: .95rem;
    flex-shrink: 0;
  }
  .step__head h3 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--fx-text);
    letter-spacing: -.01em;
    line-height: 1.25;
  }
  .step__head p {
    margin: .2rem 0 0;
    font-size: .83rem;
    color: var(--fx-text-muted);
    line-height: 1.4;
  }

  .step__grid { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }

  .field { display: flex; flex-direction: column; min-width: 0; }
  .field--full { grid-column: 1 / -1; }
  .field label {
    font-size: .78rem;
    font-weight: 650;
    color: var(--fx-text-strong);
    margin-bottom: .4rem;
    line-height: 1.2;
  }
  .field__hint {
    margin-top: .35rem;
    font-size: .75rem;
    color: var(--fx-text-subtle);
    line-height: 1.4;
  }
  .field__error {
    margin-top: .35rem;
    font-size: .75rem;
    font-weight: 600;
    color: var(--fx-red-text);
  }
  .req { color: var(--fx-red-text); margin-left: .15rem; }
  .optional { margin-left: .3rem; font-weight: 500; color: var(--fx-text-subtle); }

  /* Compteur de caractères : il passe en ambre AVANT que la saisie ne soit
     coupée — « maxlength » tronque en silence, ce qui se remarque trop tard. */
  .counter {
    align-self: flex-end;
    margin-top: .35rem;
    font-size: .78rem;
    color: var(--fx-text-subtle);
    font-variant-numeric: tabular-nums;
  }
  .counter.is-near { color: var(--fx-amber-text); font-weight: 600; }

  @media (max-width: 860px) {
    .step { padding: 1.15rem 1.15rem 1.35rem; }
  }
`;

/**
 * Hauteur unique des contrôles de saisie de l'assistant. Les étapes la
 * réutilisent pour que dropdown, arbre et compteur numérique s'alignent sur la
 * même ligne de base (le dropdown catégorie était à 48 px, tout le reste à 42).
 */
export const DIAG_CONTROL_HEIGHT = '42px';
