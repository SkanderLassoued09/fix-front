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
  ComposantEntry,
  ComposantOption,
} from '../diagnostic-modal.types';

/**
 * Step 3 · Composants — composant dropdown + qty + add/remove + create.
 * Emits intents to the parent so the existing TicketService mutations
 * (composant lookups + addition) keep flowing through the legacy code.
 */
@Component({
  selector: 'sav-diag-components-step',
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
          <h3>Composants requis</h3>
          <p>Ajoutez les pièces ou composants nécessaires (si le DI contient des PDR).</p>
        </div>
      </header>

      <div class="picker">
        <div class="picker__row">
          <div class="field">
            <label>Composant</label>
            <p-dropdown
              formControlName="composantSelected"
              optionLabel="name"
              [options]="composantOptions"
              placeholder="Sélectionner un composant"
              [filter]="true"
              filterBy="name"
              [autoDisplayFirst]="false"
              [virtualScroll]="composantOptions.length > 50"
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
              buttonLayout="stacked"
              [min]="1"
              inputStyleClass="sav-diag-qty"
              styleClass="sav-diag-qty-wrap"
            ></p-inputNumber>
          </div>
          <div class="field field--actions">
            <button type="button" class="btn btn--primary" (click)="add.emit()">
              <i class="pi pi-plus"></i> Ajouter composant
            </button>
          </div>
        </div>
        <button type="button" class="btn btn--secondary picker__secondary" (click)="create.emit()">
          <i class="pi pi-plus-circle"></i> Créer un nouveau composant
        </button>
      </div>

      <div class="table-wrap" *ngIf="composants.length; else empty">
        <table class="table">
          <thead>
            <tr>
              <th>Composant</th>
              <th class="qty">Quantité</th>
              <th class="act"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of composants; trackBy: trackByName">
              <td>{{ c.nameComposant }}</td>
              <td class="qty">{{ c.quantity }}</td>
              <td class="act">
                <button
                  type="button"
                  class="btn-icon"
                  (click)="remove.emit(c.nameComposant)"
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
          <strong>Aucun composant ajouté</strong>
          <span>Sélectionnez un composant ci-dessus, indiquez la quantité, puis cliquez sur Ajouter.</span>
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .step { padding: 1.4rem 1.5rem 1.5rem; }
      .step__head { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1.25rem; }
      .step__num {
        display: inline-grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #e2e8f0;
        color: #64748b;
        font-weight: 700;
        font-size: 0.92rem;
        flex-shrink: 0;
      }
      .step__head h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #0f172a; }
      .step__head p { margin: 0.15rem 0 0; font-size: 0.82rem; color: #64748b; }

      .picker {
        margin-bottom: 1.25rem;
        padding: 1.25rem;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        background: #f8fafc;
      }
      .picker__row {
        display: grid;
        grid-template-columns: minmax(240px, 1fr) 150px auto;
        gap: 0.75rem 1rem;
        align-items: end;
      }
      .field { display: flex; flex-direction: column; min-width: 0; }
      .field--narrow { min-width: 0; }
      /* No label above the button → bottom-align it with the inputs. */
      .field--actions { align-self: end; }
      .field--actions .btn { width: 100%; }
      .field label {
        font-size: 0.72rem;
        font-weight: 650;
        color: #334155;
        margin-bottom: 0.4rem;
        line-height: 1.1;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        min-height: 42px;
        padding: 0.58rem 0.95rem;
        border-radius: 8px;
        font-size: 0.78rem;
        font-weight: 650;
        cursor: pointer;
        border: 1px solid transparent;
        white-space: nowrap;
      }
      .btn--primary { background: #3b82f6; color: #ffffff; border-color: #2563eb; }
      .btn--primary:hover { background: #2563eb; }
      .btn--secondary {
        background: #ffffff;
        color: #0f172a;
        border-color: #e2e8f0;
      }
      .btn--secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
      .picker__secondary {
        margin-top: 0.75rem;
        min-height: 36px;
        padding-inline: 0.85rem;
      }

      .table-wrap {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
      }
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td {
        padding: 0.55rem 0.85rem;
        font-size: 0.82rem;
        text-align: left;
        border-bottom: 1px solid #f1f5f9;
      }
      .table th {
        background: #f8fafc;
        color: #64748b;
        font-weight: 650;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .table tbody tr:last-child td { border-bottom: none; }
      .qty { width: 110px; text-align: right; }
      .act { width: 48px; text-align: right; }
      .btn-icon {
        display: inline-grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
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
        gap: 0.35rem;
        min-height: 180px;
        padding: 2rem 1rem;
        border: 1px dashed #cbd5e1;
        border-radius: 8px;
        background: #f8fafc;
        color: #64748b;
        text-align: center;
      }
      .empty i { font-size: 1.5rem; color: #94a3b8; margin-bottom: 0.2rem; }
      .empty strong { color: #0f172a; font-weight: 650; font-size: 0.88rem; }
      .empty span { font-size: 0.76rem; }

      :host ::ng-deep .sav-diag-dropdown { width: 100%; }
      :host ::ng-deep .sav-diag-dropdown .p-dropdown {
        border-color: #e2e8f0;
        border-radius: 8px;
        min-height: 42px;
      }
      :host ::ng-deep .sav-diag-dropdown .p-dropdown-label {
        display: flex;
        align-items: center;
      }
      /* Quantity: a single integrated 42px field — the stepper buttons sit
         flush inside the same rounded box as the number input. */
      :host ::ng-deep p-inputnumber,
      :host ::ng-deep .sav-diag-qty-wrap.p-inputnumber {
        width: 100%;
        height: 42px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #ffffff;
        overflow: hidden;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      :host ::ng-deep .sav-diag-qty-wrap.p-inputwrapper-focus,
      :host ::ng-deep .sav-diag-qty-wrap:focus-within {
        border-color: #3b82f6;
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
        background: #f1f5f9;
        color: #475569;
        border: none;
      }
      :host ::ng-deep .sav-diag-qty-wrap .p-inputnumber-button:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
      :host ::ng-deep .sav-diag-qty-wrap .p-inputnumber-button:focus {
        box-shadow: none;
      }
      :host ::ng-deep .sav-diag-qty-wrap .p-inputnumber-button-up {
        border-bottom: 1px solid #e2e8f0;
      }

      @media (max-width: 860px) {
        .step { padding: 1.1rem; }
        .picker__row {
          grid-template-columns: 1fr;
          gap: 0.85rem;
        }
        .field--actions { display: block; }
        .action-spacer { display: none; }
        .btn { width: 100%; }
        .picker__secondary { width: 100%; }
      }
    `,
  ],
})
export class DiagnosticComponentsStepComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() composantOptions: readonly ComposantOption[] = [];
  @Input() composants: readonly ComposantEntry[] = [];

  @Output() add = new EventEmitter<void>();
  @Output() create = new EventEmitter<void>();
  @Output() remove = new EventEmitter<string>();

  trackByName(_: number, c: ComposantEntry): string {
    return c.nameComposant;
  }
}
