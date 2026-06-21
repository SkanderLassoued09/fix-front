import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';

/**
 * Shared read-only "Information demande d'intervention" modal.
 *
 * Used by BOTH the Coordinator and Interventions (ticket-list) pages — the two
 * pages used to ship the same modal as two inline copies which drifted apart
 * (font sizes, off-charte purple). One component now owns the markup so the
 * two pages always render identically.
 *
 * Usage:
 *   <app-di-info-modal
 *     [(visible)]="ticketDetailsInfo"
 *     [di]="ticketData?.data"
 *   ></app-di-info-modal>
 *
 * The component is pure presentation — no mutations, no GraphQL — and inputs
 * the DI as a flat object (`{title, _idnum, price, final_price, …}`). Optional
 * `context` lets the host hint at a small variant if ever needed; today both
 * pages render exactly the same shape.
 */
@Component({
    selector: 'app-di-info-modal',
    standalone: true,
    imports: [CommonModule, DialogModule, TableModule, ButtonModule],
    templateUrl: './di-info-modal.component.html',
    styleUrls: ['./di-info-modal.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiInfoModalComponent {
    @Input() di: any = null;
    @Input() visible = false;
    @Input() context: 'coordinator' | 'interventions' = 'interventions';
    // Per-cycle retour snapshots (LogsDi), passed by the host. retour1 = #1, etc.
    @Input() retour1: any = null;
    @Input() retour2: any = null;
    @Input() retour3: any = null;
    @Output() visibleChange = new EventEmitter<boolean>();

    /** Retour cycles to display, gated by the DI's ignoreCount. */
    get retourEntries(): Array<{ n: number; data: any }> {
        const count = Number(this.di?.ignoreCount ?? 0);
        return [
            { n: 1, data: this.retour1 },
            { n: 2, data: this.retour2 },
            { n: 3, data: this.retour3 },
        ].filter((e) => e.n <= count);
    }

    onVisibleChange(v: boolean) {
        this.visible = v;
        this.visibleChange.emit(v);
    }
    close() {
        this.onVisibleChange(false);
    }

    /** Two letters max, uppercase, derived from a display name. Falls back to
     *  '?' for empty/unknown so the avatar tiles are never blank. */
    initials(text: any): string {
        const s = String(text ?? '').trim();
        if (!s) return '?';
        const words = s.split(/\s+/).filter(Boolean);
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }

    /** TND with 3 decimals, fr-TN locale ("X XXX,XXX TND"). Non-finite → "—". */
    formatTnd3(value: any): string {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return (
            n.toLocaleString('fr-TN', {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
            }) + ' TND'
        );
    }

    /** Difference price_final − price_initial.
     *  - absent → both equal → label "Aucun écart" (neutral grey)
     *  - positive (final > initial) → ambre (gain pour Fixtronix)
     *  - negative (final < initial) → vert (remise pour le client) */
    get ecart(): { absent: boolean; positive: boolean; label: string } {
        const initial = Number(this.di?.price);
        const final = Number(this.di?.final_price);
        if (!Number.isFinite(initial) || !Number.isFinite(final)) {
            return { absent: true, positive: true, label: '—' };
        }
        const delta = final - initial;
        if (delta === 0)
            return { absent: true, positive: true, label: 'Aucun écart' };
        const sign = delta > 0 ? '+' : '−';
        return {
            absent: false,
            positive: delta > 0,
            label: `${sign}${this.formatTnd3(Math.abs(delta))}`,
        };
    }

    /** Print the open modal. The `@media print` block in the SCSS hides
     *  everything except `.di-info-modal` so the printer gets only the modal
     *  content. Body class restored on `afterprint`. */
    print() {
        try {
            document.body.classList.add('di-info-printing');
            const restore = () => {
                document.body.classList.remove('di-info-printing');
                window.removeEventListener('afterprint', restore);
            };
            window.addEventListener('afterprint', restore);
            window.print();
        } catch {
            document.body.classList.remove('di-info-printing');
        }
    }
}
