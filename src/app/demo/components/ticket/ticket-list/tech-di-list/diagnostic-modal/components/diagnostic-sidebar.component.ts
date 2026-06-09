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
 *   - Client info
 *   - Description
 *   - Progress ring + step counter
 *   - Décisions à venir (Pièce réparable / Contient PDR)
 *
 * Pure dumb component — receives a normalized DI summary + progress object.
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

      <section class="sav-diag-sidebar__block">
        <div class="sav-diag-sidebar__sectionLabel">INFORMATIONS CLIENT</div>
        <div class="sav-diag-sidebar__row">
          <i class="pi pi-user"></i>
          <strong>{{ di.clientName || 'N/A' }}</strong>
        </div>
        <div class="sav-diag-sidebar__row sav-diag-sidebar__row--muted">
          Tél : {{ di.clientPhone || 'N/A' }}
        </div>
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

      <section class="sav-diag-sidebar__block">
        <div class="sav-diag-sidebar__sectionLabel">AVANCEMENT</div>
        <div class="sav-diag-sidebar__progress">
          <svg viewBox="0 0 80 80" class="sav-diag-sidebar__ring">
            <circle cx="40" cy="40" r="34" stroke="#e2e8f0" stroke-width="8" fill="none"/>
            <circle
              cx="40" cy="40" r="34"
              stroke="#22c55e" stroke-width="8" fill="none"
              stroke-linecap="round"
              stroke-dasharray="213.6"
              [attr.stroke-dashoffset]="213.6 - (213.6 * progress.percent) / 100"
              transform="rotate(-90 40 40)"
            />
            <text x="40" y="46" text-anchor="middle" class="sav-diag-sidebar__ring-text">
              {{ progress.percent }}%
            </text>
          </svg>
          <div class="sav-diag-sidebar__progress-text">
            <strong>{{ progress.completedSteps }} / {{ progress.totalSteps }} étapes complétées</strong>
            <div class="sav-diag-sidebar__progress-bar">
              <span [style.width.%]="progress.percent"></span>
            </div>
          </div>
        </div>
      </section>

      <section class="sav-diag-sidebar__block">
        <div class="sav-diag-sidebar__sectionLabel">{{ decisionsLabel }}</div>
        <div class="sav-diag-sidebar__decisions">
          <div
            class="sav-diag-sidebar__decision"
            *ngFor="let d of resolvedDecisions; trackBy: trackByDecisionLabel"
          >
            <i class="pi" [ngClass]="d.icon"></i>
            <div>
              <small>{{ d.label }}</small>
              <strong [class.sav-diag-sidebar__faded]="d.faded">
                {{ d.value }}
              </strong>
            </div>
          </div>
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

      .sav-diag-sidebar__decisions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.6rem;
      }
      .sav-diag-sidebar__decision {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.85rem 0.9rem;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #f8fafc;
      }
      .sav-diag-sidebar__decision i { color: #64748b; font-size: 1rem; }
      .sav-diag-sidebar__decision small {
        display: block;
        font-size: 0.8rem;
        color: #64748b;
      }
      .sav-diag-sidebar__decision strong {
        display: block;
        font-size: 0.92rem;
        font-weight: 650;
        color: #0f172a;
        margin-top: 0.15rem;
      }
    `,
  ],
})
export class DiagnosticSidebarComponent {
  @Input({ required: true }) di!: DiagnosticDiSummary;
  @Input({ required: true }) progress!: DiagnosticProgress;

  /** Sidebar headline — defaults to the diagnostic copy. */
  @Input() title: string = 'Résumé du diagnostic';

  /** Section label for the bottom block. */
  @Input() decisionsLabel: string = 'DÉCISIONS (À VENIR)';

  /**
   * Optional override for the bottom decision rows. When `null` (default),
   * the component falls back to the legacy two-row layout built from the
   * `reparableLabel` + `pdrLabel` inputs — that's what the existing
   * diagnostic parent passes today, so behavior is unchanged.
   *
   * Pass an array to render any other set (used by the repair modal:
   * "Sous garantie ?" / "Temps passé").
   */
  @Input() decisions: readonly SidebarDecision[] | null = null;

  /** Legacy inputs — only consulted when `decisions` is null. */
  @Input() reparableLabel: string = 'Non défini';
  @Input() pdrLabel: string = 'Non défini';

  /** Resolved row list — `decisions` if provided, else legacy pair. */
  get resolvedDecisions(): readonly SidebarDecision[] {
    if (this.decisions) return this.decisions;
    return [
      {
        icon: 'pi-wrench',
        label: 'Pièce réparable ?',
        value: this.reparableLabel,
        faded: this.reparableLabel === 'Non défini',
      },
      {
        icon: 'pi-box',
        label: 'Contient PDR ?',
        value: this.pdrLabel,
        faded: this.pdrLabel === 'Non défini',
      },
    ];
  }

  trackByDecisionLabel(_: number, d: SidebarDecision): string {
    return d.label;
  }
}
