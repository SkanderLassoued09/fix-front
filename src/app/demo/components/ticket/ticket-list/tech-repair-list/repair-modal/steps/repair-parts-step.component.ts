import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import {
  RepairPartEntry,
  RepairPartOption,
} from '../repair-modal.types';

/**
 * Step 3 · Pièces utilisées — part dropdown + reference + qty + add/remove.
 * Mirrors the diagnostic components step layout but with an extra reference
 * column and the "Pièces utilisées (n)" wording.
 */
@Component({
  selector: 'sav-repair-parts-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DropdownModule,
    InputNumberModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step" [formGroup]="form">
      <header class="step__head">
        <span class="step__num">3</span>
        <div>
          <h3>Pièces utilisées</h3>
          <p>Ajoutez les pièces consommées pour la réparation (référence + quantité).</p>
        </div>
      </header>

      <div class="picker">
        <div class="picker__row">
          <div class="field">
            <label>Pièce</label>
            <p-dropdown
              formControlName="partSelected"
              optionLabel="name"
              [options]="partOptions"
              placeholder="Sélectionner une pièce"
              [filter]="true"
              filterBy="name,reference"
              [autoDisplayFirst]="false"
              [virtualScroll]="partOptions.length > 50"
              [virtualScrollItemSize]="38"
              appendTo="body"
              styleClass="sav-diag-dropdown"
            ></p-dropdown>
          </div>
          <div class="field field--narrow">
            <label>Quantité</label>
            <p-inputNumber
              formControlName="quantity"
              [showButtons]="true"
              [min]="1"
              inputStyleClass="sav-diag-qty"
            ></p-inputNumber>
          </div>
          <div class="field field--actions">
            <span class="action-spacer" aria-hidden="true"></span>
            <button type="button" class="btn btn--primary" (click)="add.emit()">
              <i class="pi pi-plus"></i> Ajouter pièce
            </button>
          </div>
        </div>
      </div>

      <div class="table-wrap" *ngIf="parts.length; else empty">
        <header class="table-head">
          <strong>Pièces utilisées ({{ parts.length }})</strong>
        </header>
        <table class="table">
          <thead>
            <tr>
              <th>Pièce</th>
              <th>Référence</th>
              <th class="qty">Quantité</th>
              <th class="act"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of parts; trackBy: trackByName">
              <td>{{ p.nameComposant }}</td>
              <td class="ref">{{ p.reference || '—' }}</td>
              <td class="qty">{{ p.quantity }}</td>
              <td class="act">
                <button
                  type="button"
                  class="btn-icon"
                  (click)="remove.emit(p.nameComposant)"
                  aria-label="Retirer"
                >
                  <i class="pi pi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ng-template #empty>
        <div class="empty">
          <i class="pi pi-inbox"></i>
          <strong>Aucune pièce ajoutée</strong>
          <span>Sélectionnez une pièce ci-dessus, indiquez la quantité, puis cliquez sur Ajouter.</span>
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .step { padding: 1.75rem 2rem; }
      .step__head { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
      .step__num {
        display: inline-grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--fx-bg-surface-2);
        color: var(--fx-text-muted);
        font-weight: 700;
        font-size: 1.2rem;
        flex-shrink: 0;
      }
      .step__head h3 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--fx-text);
        letter-spacing: -0.015em;
        line-height: 1.2;
      }
      .step__head p {
        margin: 0.3rem 0 0;
        font-size: 0.95rem;
        color: var(--fx-text-muted);
        line-height: 1.35;
      }

      .picker {
        margin-bottom: 1.35rem;
        padding: 1.15rem;
        border: 1px solid var(--fx-border);
        border-radius: 11px;
        background: var(--fx-bg-surface);
      }
      .picker__row {
        display: grid;
        grid-template-columns: minmax(260px, 1fr) 150px minmax(170px, auto);
        gap: 0.9rem;
        align-items: stretch;
      }
      .field { display: flex; flex-direction: column; min-width: 0; }
      .field--narrow { min-width: 0; }
      .field--actions { display: flex; align-self: stretch; }
      .action-spacer { display: block; height: 1.45rem; flex: 0 0 auto; }
      .field label {
        font-size: 0.85rem;
        font-weight: 650;
        color: var(--fx-text-strong);
        margin-bottom: 0.42rem;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        min-height: 48px;
        padding: 0.7rem 1.1rem;
        border-radius: 9px;
        font-size: 0.92rem;
        font-weight: 650;
        cursor: pointer;
        border: 1px solid transparent;
        white-space: nowrap;
      }
      .btn--primary { background: var(--fx-blue); color: var(--fx-text-on-accent); border-color: var(--fx-blue-strong); }
      .btn--primary:hover { background: var(--fx-blue-strong); }

      .table-wrap {
        border: 1px solid var(--fx-border);
        border-radius: 10px;
        overflow: hidden;
      }
      .table-head {
        padding: 0.85rem 1.1rem;
        background: var(--fx-bg-surface);
        border-bottom: 1px solid var(--fx-border);
      }
      .table-head strong {
        font-size: 0.92rem;
        font-weight: 700;
        color: var(--fx-text);
      }
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td {
        padding: 0.75rem 1.05rem;
        font-size: 0.92rem;
        text-align: left;
        border-bottom: 1px solid var(--fx-border);
      }
      .table th {
        background: var(--fx-bg-card);
        color: var(--fx-text-muted);
        font-weight: 650;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .table tbody tr:last-child td { border-bottom: none; }
      .ref { color: var(--fx-text-muted); font-family: 'JetBrains Mono', 'Menlo', monospace; font-size: 0.88rem; }
      .qty { width: 110px; text-align: right; }
      .act { width: 56px; text-align: right; }
      .btn-icon {
        display: inline-grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 7px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--fx-red-text);
        cursor: pointer;
      }
      .btn-icon:hover { background: rgba(239, 68, 68, 0.08); }

      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        min-height: 200px;
        padding: 2.5rem 1rem;
        border: 1px dashed var(--fx-border-strong);
        border-radius: 10px;
        color: var(--fx-text-muted);
        text-align: center;
      }
      .empty i { font-size: 1.6rem; color: var(--fx-text-subtle); }
      .empty strong { font-size: 0.98rem; color: var(--fx-text-strong); }
      .empty span { font-size: 0.9rem; line-height: 1.4; }

      :host ::ng-deep .sav-diag-dropdown { width: 100%; }
      :host ::ng-deep .sav-diag-dropdown .p-dropdown {
        border-color: var(--fx-border);
        border-radius: 9px;
        min-height: 48px;
      }
      :host ::ng-deep .sav-diag-dropdown .p-dropdown .p-dropdown-label {
        padding: 0.85rem 1.05rem;
        font-size: 0.98rem;
      }
      :host ::ng-deep .sav-diag-qty { min-height: 48px; }

      @media (max-width: 880px) {
        .picker__row { grid-template-columns: 1fr; }
        .field--actions { justify-content: flex-end; }
      }
    `,
  ],
})
export class RepairPartsStepComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) partOptions!: readonly RepairPartOption[];
  @Input({ required: true }) parts!: readonly RepairPartEntry[];

  @Output() add = new EventEmitter<void>();
  @Output() remove = new EventEmitter<string>();

  trackByName(_: number, p: RepairPartEntry): string {
    return p.nameComposant;
  }
}
