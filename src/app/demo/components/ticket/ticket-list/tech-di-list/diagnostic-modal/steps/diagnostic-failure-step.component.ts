import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { CategoryOption } from '../diagnostic-modal.types';

/**
 * Step 2 · Panne & symptômes — matches the uploaded screenshot.
 *   - Catégorie de diagnostic (required dropdown bound to form.di_category_id)
 *   - Description de la panne (required, with 0/1000 counter)
 *   - Remarque technicien (counter)
 *   - Tip box "Conseil: Soyez le plus précis possible…"
 *
 * Binds directly to the parent's existing `diagFormTech` FormGroup so the
 * mutations and validators in the legacy code path keep working untouched.
 */
@Component({
  selector: 'sav-diag-failure-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DropdownModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step" [formGroup]="form">
      <header class="step__head">
        <span class="step__num">2</span>
        <div>
          <h3>Panne &amp; symptômes</h3>
          <p>Décrivez la panne rencontrée et les symptômes observés.</p>
        </div>
      </header>

      <div class="step__grid">
        <div class="field">
          <label>
            Catégorie de diagnostic <span class="req">*</span>
          </label>
          <p-dropdown
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
          ></p-dropdown>
        </div>

        <div class="field">
          <label>
            Description de la panne <span class="req">*</span>
          </label>
          <textarea
            class="sav-diag-textarea"
            rows="5"
            maxlength="1000"
            placeholder="Décrivez la panne en détail…"
            formControlName="remarqueTech"
          ></textarea>
          <div class="counter">{{ (form.get('remarqueTech')?.value?.length ?? 0) }} / 1000</div>
        </div>

        <div class="field field--full">
          <label>Remarque technicien</label>
          <textarea
            class="sav-diag-textarea"
            rows="3"
            maxlength="1000"
            placeholder="Remarques ou informations complémentaires…"
            formControlName="remarqueExtra"
          ></textarea>
          <div class="counter">{{ (form.get('remarqueExtra')?.value?.length ?? 0) }} / 1000</div>
        </div>

        <div class="tip">
          <i class="pi pi-lightbulb"></i>
          <div>
            <strong>Conseil</strong>
            <span>Soyez le plus précis possible dans la description pour faciliter le diagnostic et la réparation.</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .step { padding: 1.75rem 2rem 1.75rem; }
      .step__head { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.75rem; }
      .step__num {
        display: inline-grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #3b82f6;
        color: #ffffff;
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

      .step__grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.35rem;
      }
      .field { display: flex; flex-direction: column; }
      .field--full { grid-column: 1 / -1; }
      .field label {
        font-size: 0.95rem;
        font-weight: 650;
        color: #334155;
        margin-bottom: 0.5rem;
      }
      .req { color: #ef4444; margin-left: 0.15rem; }
      .sav-diag-textarea {
        width: 100%;
        padding: 0.95rem 1.05rem;
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        font-size: 0.98rem;
        font-family: inherit;
        resize: vertical;
        color: #0f172a;
        background: #ffffff;
        line-height: 1.5;
        transition: border-color 120ms ease, box-shadow 120ms ease;
      }
      .sav-diag-textarea:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      }
      .counter {
        align-self: flex-end;
        margin-top: 0.35rem;
        font-size: 0.82rem;
        color: #94a3b8;
      }

      .tip {
        grid-column: 1 / -1;
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        padding: 1rem 1.1rem;
        background: rgba(59, 130, 246, 0.08);
        border: 1px solid rgba(59, 130, 246, 0.2);
        border-radius: 10px;
        color: #1d4ed8;
      }
      .tip i { font-size: 1.2rem; margin-top: 0.1rem; }
      .tip strong { display: block; font-size: 0.98rem; font-weight: 700; }
      .tip span {
        display: block;
        margin-top: 0.25rem;
        font-size: 0.9rem;
        color: #334155;
        line-height: 1.5;
      }

      :host ::ng-deep .sav-diag-dropdown {
        width: 100%;
      }
      :host ::ng-deep .sav-diag-dropdown .p-dropdown {
        border-color: #e2e8f0;
        border-radius: 9px;
        min-height: 48px;
        font-size: 0.98rem;
      }
      :host ::ng-deep .sav-diag-dropdown .p-dropdown .p-dropdown-label {
        padding: 0.85rem 1.05rem;
        font-size: 0.98rem;
      }
      @media (max-width: 720px) {
        .step { padding: 1.25rem; }
        .step__grid { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class DiagnosticFailureStepComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) categories!: readonly CategoryOption[];
}
