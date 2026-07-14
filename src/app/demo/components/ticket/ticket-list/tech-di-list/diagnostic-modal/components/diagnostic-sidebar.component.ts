import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DiagnosticDiSummary,
  DiagnosticProgress,
  SidebarDecision,
} from '../diagnostic-modal.types';

/**
 * Right sidebar — diagnostic-aid panel. Holds ONLY context the tech can't
 * already read in the top info-strip / header, so nothing is duplicated:
 *   - Entity CONTACTS — 3 service contacts for a company OR the client phone
 *     (the company/client *name* is shown once, in the top "Client / Société"
 *     card, so it is NOT repeated here).
 *   - Description — the ticket title + the frozen creation description.
 *   - Remarques — previous-step remarks (admin / diag / repair).
 *
 * Deliberately absent (each lives elsewhere, exactly once): location →
 * info-strip "Emplacement"; status → info-strip "Statut actuel"; DI code →
 * header title; retour counter → the modal's retour banner. The progress ring
 * + "Décisions à venir" + "Besoin d'aide" sections were removed earlier —
 * the tech reads context, not progress.
 */
@Component({
  selector: 'sav-diag-sidebar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sav-diag-sidebar">
      <header class="sav-diag-sidebar__head">
        <h3>{{ title }}</h3>
      </header>

      <!-- Company-DI: only the TECHNIQUE service phone number is shown (the
           diagnostic tech only needs to reach the technical contact). Client-DI
           keeps its single client phone row below. -->
      <section
        class="sav-diag-sidebar__block"
        *ngIf="di.entityType === 'company'"
      >
        <div class="sav-diag-sidebar__sectionLabel">CONTACT TECHNIQUE</div>
        <a
          *ngIf="di.serviceTechnique?.phone; else noTechPhone"
          class="sav-diag-sidebar__row sav-diag-sidebar__contact-link"
          [href]="'tel:' + di.serviceTechnique?.phone"
        ><i class="pi pi-phone"></i>{{ di.serviceTechnique?.phone }}</a>
        <ng-template #noTechPhone>
          <div class="sav-diag-sidebar__row sav-diag-sidebar__faded">
            Tél non renseigné
          </div>
        </ng-template>
      </section>

      <section
        class="sav-diag-sidebar__block"
        *ngIf="di.entityType === 'client'"
      >
        <div class="sav-diag-sidebar__sectionLabel">CONTACT CLIENT</div>
        <a
          *ngIf="di.clientPhone; else noPhone"
          class="sav-diag-sidebar__row sav-diag-sidebar__contact-link"
          [href]="'tel:' + di.clientPhone"
        ><i class="pi pi-phone"></i>{{ di.clientPhone }}</a>
        <ng-template #noPhone>
          <div class="sav-diag-sidebar__row sav-diag-sidebar__faded">
            Tél non renseigné
          </div>
        </ng-template>
      </section>

      <section class="sav-diag-sidebar__block">
        <div class="sav-diag-sidebar__sectionLabel">DESCRIPTION</div>
        <!-- Description-only — the title already lives in the modal header
             and the Step 1 "Titre du ticket" field. Repeating it under a
             "DESCRIPTION" label was the source of the "description shows
             the title" confusion. The body falls back to a faded
             placeholder when the field is genuinely empty. -->
        <p class="sav-diag-sidebar__desc" *ngIf="di.description; else noDesc">
          {{ di.description }}
        </p>
        <ng-template #noDesc>
          <p class="sav-diag-sidebar__desc sav-diag-sidebar__faded">
            Aucune description ajoutée
          </p>
        </ng-template>
      </section>

      <!-- Previous-step remarks (admin / diag / repair) — pre-fill context a
           tech reads before acting, especially on a retour cycle. Location and
           the retour counter live elsewhere (top info-strip + retour banner),
           so they are NOT repeated here. Hidden entirely when empty. -->
      <section
        class="sav-diag-sidebar__block"
        *ngIf="
          di.remarqueManager ||
          di.remarqueTechDiagnostic ||
          di.remarqueTechReparation
        "
      >
        <div class="sav-diag-sidebar__sectionLabel">REMARQUES</div>
        <div
          *ngIf="di.remarqueManager"
          class="sav-diag-sidebar__note sav-diag-sidebar__note--admin"
        >
          <small>Remarque administration</small>
          <p>{{ di.remarqueManager }}</p>
        </div>
        <div
          *ngIf="di.remarqueTechDiagnostic"
          class="sav-diag-sidebar__note sav-diag-sidebar__note--diag"
        >
          <small>Remarque tech diagnostique</small>
          <p>{{ di.remarqueTechDiagnostic }}</p>
        </div>
        <div
          *ngIf="di.remarqueTechReparation"
          class="sav-diag-sidebar__note sav-diag-sidebar__note--rep"
        >
          <small>Remarque tech réparation</small>
          <p>{{ di.remarqueTechReparation }}</p>
        </div>
      </section>

    </aside>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .sav-diag-sidebar {
        height: 100%;
        padding: 1.5rem 1.15rem;
        background: #ffffff;
        border-left: 1px solid #e2e8f0;
        overflow-y: auto;
      }
      .sav-diag-sidebar__head h3 {
        margin: 0 0 1.15rem;
        font-size: 1.1rem;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.01em;
      }
      .sav-diag-sidebar__block {
        padding: 1rem 1.05rem;
        margin-bottom: 0.85rem;
        border: 1px solid #edf2f7;
        border-radius: 12px;
        background: #ffffff;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
      }
      .sav-diag-sidebar__block:last-child { margin-bottom: 0; }
      .sav-diag-sidebar__sectionLabel {
        font-size: 0.78rem;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 0.08em;
        margin-bottom: 0.75rem;
      }
      .sav-diag-sidebar__row {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        font-size: 0.95rem;
        color: #0f172a;
        line-height: 1.3;
      }
      .sav-diag-sidebar__row i { color: #64748b; font-size: 0.95rem; }
      .sav-diag-sidebar__row strong { font-weight: 650; }
      .sav-diag-sidebar__desc {
        margin: 0.6rem 0 0;
        font-size: 0.88rem;
        color: #64748b;
        line-height: 1.5;
      }
      .sav-diag-sidebar__faded { color: #94a3b8 !important; font-style: italic; }

      .sav-diag-sidebar__contacts {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.55rem;
        margin-top: 0.6rem;
      }
      .sav-diag-sidebar__contact {
        padding: 0.6rem 0.75rem;
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        background: #f8fafc;
      }
      .sav-diag-sidebar__contact-head {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #1d4ed8;
        margin-bottom: 0.35rem;
      }
      .sav-diag-sidebar__contact-head i {
        color: #2563eb;
        font-size: 0.78rem;
      }
      .sav-diag-sidebar__contact-row {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.83rem;
        color: #1e293b;
        padding: 2px 0;
      }
      .sav-diag-sidebar__contact-row i {
        color: #94a3b8;
        font-size: 0.78rem;
        width: 12px;
      }
      .sav-diag-sidebar__contact-link {
        color: #2563eb;
        text-decoration: none;
      }
      .sav-diag-sidebar__contact-link:hover {
        color: #1d4ed8;
        text-decoration: underline;
      }
      .sav-diag-sidebar__note {
        margin-top: 0.6rem;
        padding: 0.55rem 0.7rem;
        border-left: 3px solid #2563eb;
        background: #f8fafc;
        border-radius: 0 8px 8px 0;
      }
      .sav-diag-sidebar__note--admin { border-left-color: #1d4ed8; }
      .sav-diag-sidebar__note--diag { border-left-color: #3b82f6; }
      .sav-diag-sidebar__note--rep { border-left-color: #b45309; }
      .sav-diag-sidebar__note small {
        display: block;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #64748b;
        margin-bottom: 0.2rem;
      }
      .sav-diag-sidebar__note p {
        margin: 0;
        font-size: 0.85rem;
        color: #1e293b;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
      }
    `,
  ],
})
export class DiagnosticSidebarComponent {
  @Input({ required: true }) di!: DiagnosticDiSummary;

  /** Sidebar headline — defaults to the diagnostic copy. */
  @Input() title: string = 'Résumé du diagnostic';

  // ── Legacy inputs (kept for backwards compatibility with the repair
  //    modal that still passes them) — no longer consumed by the template.
  //    Safe to drop once every call site is migrated.
  @Input() progress?: DiagnosticProgress;
  @Input() decisionsLabel?: string;
  @Input() decisions?: readonly SidebarDecision[] | null;
  @Input() reparableLabel?: string;
  @Input() pdrLabel?: string;
}
