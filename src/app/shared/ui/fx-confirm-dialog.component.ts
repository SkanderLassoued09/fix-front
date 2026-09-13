import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SharedModule } from 'primeng/api';
import { ConfirmService } from './confirm.service';

/**
 * L'UNIQUE modale de confirmation de l'application.
 *
 * Montée une seule fois dans `app.component.html`. Toutes les confirmations la
 * traversent via `ConfirmService`, ce qui garantit qu'elles se ressemblent.
 *
 * Pourquoi `pTemplate="headless"` : il permet de rendre le gabarit maison
 * (tuile d'icône dans l'entête, pied à boutons plats) tout en gardant
 * `ConfirmationService` et son API `accept`/`reject`. Le chrome PrimeNG par
 * défaut place l'icône dans le CORPS et ne s'y prête pas.
 *
 * `encapsulation: None` + préfixe `.fx-confirm*` sur TOUS les sélecteurs : le
 * style est donc global, mais sans collision possible. C'est volontaire — c'est
 * ce qui évite le piège maison de `.sav-dialog`, dont le bloc de base est
 * dupliqué dans 9 SCSS de composants et n'est injecté que si l'un d'eux a déjà
 * été instancié (d'où des modales sans fond selon la page d'ouverture). Monté
 * dans le shell, ce composant-ci est TOUJOURS instancié.
 */
@Component({
    selector: 'app-fx-confirm-dialog',
    standalone: true,
    imports: [CommonModule, ConfirmDialogModule, SharedModule],
    encapsulation: ViewEncapsulation.None,
    templateUrl: './fx-confirm-dialog.component.html',
    styleUrls: ['./fx-confirm-dialog.component.scss'],
})
export class FxConfirmDialogComponent {
    constructor(public readonly confirm: ConfirmService) {}
}
