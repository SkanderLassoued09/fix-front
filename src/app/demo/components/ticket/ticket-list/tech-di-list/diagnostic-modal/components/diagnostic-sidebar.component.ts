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
 * Right sidebar — sticky summary panel:
 *   - Entity contacts (3 services for a company OR client phone)
 *   - Description (frozen from DI creation)
 *   - Useful tech context (previous-cycle remarks, location, ignoreCount)
 *
 * Pure dumb component — receives a normalized DI summary. The progress ring
 * + "Décisions à venir" + "Besoin d'aide" sections were removed per spec —
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

      <!-- Contacts: 3 service rows for a company-DI, or a single phone row
           for a client-DI. Fallback when neither is resolvable. -->
      <section
        class="sav-diag-sidebar__block"
        *ngIf="di.entityType === 'company'"
      >
        <div class="sav-diag-sidebar__sectionLabel">SOCIÉTÉ</div>
        <div class="sav-diag-sidebar__row">
          <i class="pi pi-building"></i>
          <strong>{{ di.companyName || '—' }}</strong>
        </div>
        <div class="sav-diag-sidebar__contacts">
          <div
            class="sav-diag-sidebar__contact"
            *ngFor="
              let s of [
                { key: 'achat', icon: 'pi-shopping-cart', label: 'Achat', svc: di.serviceAchat },
                { key: 'tech', icon: 'pi-wrench', label: 'Technique', svc: di.serviceTechnique },
                { key: 'fin', icon: 'pi-credit-card', label: 'Financier', svc: di.serviceFinancier },
              ]; trackBy: trackByContactKey
            "
          >
            <div class="sav-diag-sidebar__contact-head">
              <i class="pi" [ngClass]="s.icon"></i>
              <span>{{ s.label }}</span>
            </div>
            <div *ngIf="s.svc?.name" class="sav-diag-sidebar__contact-row">
              <i class="pi pi-user"></i>{{ s.svc?.name }}
            </div>
            <a
              *ngIf="s.svc?.phone"
              class="sav-diag-sidebar__contact-row sav-diag-sidebar__contact-link"
              [href]="'tel:' + s.svc?.phone"
            ><i class="pi pi-phone"></i>{{ s.svc?.phone }}</a>
            <a
              *ngIf="s.svc?.email"
              class="sav-diag-sidebar__contact-row sav-diag-sidebar__contact-link"
              [href]="'mailto:' + s.svc?.email"
            ><i class="pi pi-envelope"></i>{{ s.svc?.email }}</a>
            <div
              *ngIf="!s.svc?.name && !s.svc?.phone && !s.svc?.email"
              class="sav-diag-sidebar__contact-row sav-diag-sidebar__faded"
            >Non renseigné</div>
          </div>
        </div>
      </section>

      <section
        class="sav-diag-sidebar__block"
        *ngIf="di.entityType === 'client'"
      >
        <div class="sav-diag-sidebar__sectionLabel">CLIENT</div>
        <div class="sav-diag-sidebar__row">
          <i class="pi pi-user"></i>
          <strong>{{ di.clientName || '—' }}</strong>
        </div>
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
        <div class="sav-diag-sidebar__row">
          <i class="pi pi-file"></i>
          <strong *ngIf="di.title">{{ di.title }}</strong>
          <strong *ngIf="!di.title" class="sav-diag-sidebar__faded">—</strong>
        </div>
        <p class="sav-diag-sidebar__desc" *ngIf="di.description; else noDesc">
          {{ di.description }}
        </p>
        <ng-template #noDesc>
          <p class="sav-diag-sidebar__desc sav-diag-sidebar__faded">
            Aucune description ajoutée
          </p>
        </ng-template>
      </section>

      <!-- Useful tech context: previous remarks (retour) + location.
           Hidden entirely when there's nothing to show. -->
      <section
        class="sav-diag-sidebar__block"
        *ngIf="
          di.remarqueManager ||
          di.remarqueTechDiagnostic ||
          di.remarqueTechReparation ||
          di.locationName ||
          (di.ignoreCount ?? 0) > 0
        "
      >
        <div class="sav-diag-sidebar__sectionLabel">INFOS UTILES</div>
        <div
          class="sav-diag-sidebar__row sav-diag-sidebar__row--muted"
          *ngIf="di.locationName"
        >
          <i class="pi pi-map-marker"></i>{{ di.locationName }}
        </div>
        <div
          class="sav-diag-sidebar__row sav-diag-sidebar__row--muted"
          *ngIf="(di.ignoreCount ?? 0) > 0"
        >
          <i class="pi pi-refresh"></i>Retour #{{ di.ignoreCount }}
        </div>
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
      .sav-diag-sidebar__row--muted {
        margin-top: 0.4rem;
        color: #64748b;
        font-size: 0.88rem;
      }
      .sav-diag-sidebar__desc {
        margin: 0.6rem 0 0;
        font-size: 0.88rem;
        color: #64748b;
        line-height: 1.5;
      }
      .sav-diag-sidebar__faded { color: #94a3b8 !important; font-style: italic; }

      .sav-diag-sidebar__progress {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.15rem 0;
      }
      .sav-diag-sidebar__ring {
        width: 80px;
        height: 80px;
        flex-shrink: 0;
      }
      .sav-diag-sidebar__ring-text {
        font-size: 18px;
        font-weight: 700;
        fill: #0f172a;
      }
      .sav-diag-sidebar__progress-text { flex: 1; min-width: 0; }
      .sav-diag-sidebar__progress-text strong {
        display: block;
        font-size: 0.92rem;
        font-weight: 650;
        color: #0f172a;
        line-height: 1.3;
      }
      .sav-diag-sidebar__progress-bar {
        margin-top: 0.6rem;
        height: 8px;
        border-radius: 999px;
        background: #e2e8f0;
        overflow: hidden;
      }
      .sav-diag-sidebar__progress-bar span {
        display: block;
        height: 100%;
        background: #22c55e;
        border-radius: inherit;
        transition: width 200ms ease;
      }

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

  trackByContactKey(_: number, s: { key: string }): string {
    return s.key;
  }
}
