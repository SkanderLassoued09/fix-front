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
        background: #e2e8f0;
        color: #64748b;
        font-weight: 700;
        font-size: 1.2rem;
        flex-shrink: 0;
      }
      .step__head h3 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.015em;
        line-height: 1.2;
      }
      .step__head p {
        margin: 0.3rem 0 0;
        font-size: 0.95rem;
        color: #64748b;
        line-height: 1.35;
      }

      .picker {
        margin-bottom: 1.35rem;
        padding: 1.15rem;
        border: 1px solid #e2e8f0;
        border-radius: 11px;
        background: #f8fafc;
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
        color: #334155;
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
      .btn--primary { background: #3b82f6; color: #ffffff; border-color: #2563eb; }
      .btn--primary:hover { background: #2563eb; }

      .table-wrap {
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
      }
      .table-head {
        padding: 0.85rem 1.1rem;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      .table-head strong {
        font-size: 0.92rem;
        font-weight: 700;
        color: #0f172a;
      }
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td {
        padding: 0.75rem 1.05rem;
        font-size: 0.92rem;
        text-align: left;
        border-bottom: 1px solid #f1f5f9;
      }
      .table th {
        background: #ffffff;
        color: #64748b;
        font-weight: 650;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .table tbody tr:last-child td { border-bottom: none; }
      .ref { color: #475569; font-family: 'JetBrains Mono', 'Menlo', monospace; font-size: 0.88rem; }
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
        color: #ef4444;
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
        border: 1px dashed #cbd5e1;
        border-radius: 10px;
        color: #64748b;
        text-align: center;
      }
      .empty i { font-size: 1.6rem; color: #94a3b8; }
      .empty strong { font-size: 0.98rem; color: #334155; }
      .empty span { font-size: 0.9rem; line-height: 1.4; }

      :host ::ng-deep .sav-diag-dropdown { width: 100%; }
      :host ::ng-deep .sav-diag-dropdown .p-dropdown {
        border-color: #e2e8f0;
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
