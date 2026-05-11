import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  PeriodPreset,
  PeriodSelection,
  buildPeriodFromPreset,
  granularityForRange,
} from './period-filter.types';

interface PresetButton {
  key: PeriodPreset;
  label: string;
}

/**
 * Presentational period selector. Parent owns the selection; this component
 * just emits whenever the user changes preset or custom range. Keeping it
 * dumb means we can drop it into any future BI screen without coupling.
 */
@Component({
  selector: 'app-sav-period-filter',
  templateUrl: './period-filter.component.html',
  styleUrls: ['./period-filter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodFilterComponent implements OnChanges {
  @Input() selection!: PeriodSelection;
  @Output() selectionChange = new EventEmitter<PeriodSelection>();

  readonly presets: PresetButton[] = [
    { key: 'TODAY', label: "Aujourd'hui" },
    { key: 'WEEK', label: 'Cette semaine' },
    { key: 'MONTH', label: 'Ce mois' },
    { key: 'YEAR', label: 'Cette année' },
    { key: 'CUSTOM', label: 'Personnalisé' },
  ];

  customRange: Date[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selection'] && this.selection) {
      this.customRange = [
        new Date(this.selection.startDate),
        new Date(this.selection.endDate),
      ];
    }
  }

  selectPreset(preset: PeriodPreset): void {
    if (preset === 'CUSTOM') {
      // Open the calendar — wait for the user to pick a range before emitting.
      this.selectionChange.emit({
        ...buildPeriodFromPreset('CUSTOM'),
        preset: 'CUSTOM',
      });
      return;
    }
    this.selectionChange.emit(buildPeriodFromPreset(preset));
  }

  onCustomRangeChange(range: Date[] | null): void {
    if (!range || !range[0] || !range[1]) return;
    const start = new Date(range[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range[1]);
    end.setHours(23, 59, 59, 999);
    this.selectionChange.emit({
      preset: 'CUSTOM',
      startDate: start,
      endDate: end,
      granularity: granularityForRange(start, end),
      label: 'Personnalisé',
    });
  }
}
