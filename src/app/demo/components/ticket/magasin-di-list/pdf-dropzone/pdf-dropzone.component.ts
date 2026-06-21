import { CommonModule } from '@angular/common';
import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    Output,
    ViewChild,
} from '@angular/core';

/**
 * Reusable drag & drop PDF upload zone.
 *
 * Emits a validated `File` (type `application/pdf`, ≤ `maxSizeMo`) via
 * `fileSelected`, and `fileRemoved` when cleared. It is a *controlled* widget:
 * the parent owns the selected file and feeds it back through `[value]`. No
 * upload/encoding happens here — the host wires `fileSelected` into its own
 * upload pipeline and onto its form control.
 *
 * Used by the « Affectation des composants » modal for the `pdf` control of
 * `formUpdateComposant`, but intentionally generic (move to a shared folder if
 * reused elsewhere).
 */
@Component({
    selector: 'app-pdf-dropzone',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div
            class="dz"
            [class.dz--filled]="hasFile && !error"
            [class.dz--drag]="dragOver"
            [class.dz--error]="!!error"
            role="button"
            tabindex="0"
            [attr.aria-label]="ariaLabel"
            (click)="onZoneClick()"
            (keydown)="onKeydown($event)"
            (dragenter)="onDragOver($event)"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave($event)"
            (drop)="onDrop($event)"
        >
            <input
                #fileInput
                type="file"
                class="dz__input"
                [accept]="accept"
                (change)="onInputChange($event)"
                tabindex="-1"
                aria-hidden="true"
            />

            <!-- État « fichier sélectionné » -->
            <div class="dz__file" *ngIf="hasFile && !error">
                <span class="dz__thumb"><i [class]="thumbIcon"></i></span>
                <span class="dz__meta">
                    <span class="dz__name" [title]="fileName">{{
                        fileName
                    }}</span>
                    <span class="dz__size">{{ fileSizeLabel }}</span>
                </span>
                <span class="dz__actions">
                    <button
                        type="button"
                        class="dz__change"
                        (click)="$event.stopPropagation(); openPicker()"
                    >
                        Changer
                    </button>
                    <button
                        type="button"
                        class="dz__remove"
                        (click)="remove($event)"
                        aria-label="Supprimer le fichier"
                    >
                        <i class="pi pi-times"></i>
                    </button>
                </span>
            </div>

            <!-- État repos / drag-over / erreur -->
            <div class="dz__prompt" *ngIf="!hasFile || error">
                <span class="dz__icon"><i class="pi pi-upload"></i></span>
                <span class="dz__title">{{ title }}</span>
                <span class="dz__sub" *ngIf="!error">{{
                    dragOver
                        ? 'Déposez le fichier'
                        : 'Glissez le fichier ici ou cliquez · max ' +
                          maxSizeMo +
                          ' Mo'
                }}</span>
                <span class="dz__error" *ngIf="error">{{ error }}</span>
            </div>

            <!-- Annonce discrète pour lecteurs d'écran -->
            <span class="dz__sr" aria-live="polite">{{ liveMessage }}</span>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                font-family: inherit;
            }
            .dz {
                position: relative;
                border: 1.5px dashed #c7d2e0;
                border-radius: 12px;
                background: #fafbfd;
                cursor: pointer;
                padding: 22px 16px;
                outline: none;
                transition: border-color 0.15s, background 0.15s,
                    box-shadow 0.15s, transform 0.12s;
            }
            .dz:hover:not(.dz--filled):not(.dz--error) {
                border-color: #3b82f6;
                background: #eff6ff;
            }
            .dz:focus-visible {
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.13);
            }
            .dz--drag {
                border-style: solid;
                border-color: #3b82f6;
                background: #eff6ff;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.13);
                transform: scale(1.01);
            }
            .dz--filled {
                border-style: solid;
                border-color: #e2e8f0;
                background: #fff;
                cursor: default;
                padding: 10px 12px;
            }
            .dz--error {
                border-style: solid;
                border-color: #fecaca;
                background: #fef2f2;
            }

            .dz__input {
                position: absolute;
                width: 1px;
                height: 1px;
                opacity: 0;
                pointer-events: none;
            }

            /* Prompt (repos / drag / erreur) */
            .dz__prompt {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
            }
            .dz__icon {
                color: #2563eb;
                font-size: 24px;
            }
            .dz__title {
                font-size: 13px;
                font-weight: 600;
                color: #1e293b;
                margin-top: 8px;
            }
            .dz__sub {
                font-size: 11.5px;
                color: #94a3b8;
                margin-top: 3px;
            }
            .dz__error {
                font-size: 12px;
                font-weight: 600;
                color: #dc2626;
                margin-top: 4px;
            }

            /* Fichier sélectionné */
            .dz__file {
                display: flex;
                align-items: center;
                gap: 11px;
                text-align: left;
            }
            .dz__thumb {
                width: 34px;
                height: 34px;
                border-radius: 8px;
                background: #fef2f2;
                color: #dc2626;
                display: grid;
                place-items: center;
                font-size: 16px;
                flex: none;
            }
            .dz__meta {
                display: flex;
                flex-direction: column;
                min-width: 0;
                flex: 1;
            }
            .dz__name {
                font-size: 13px;
                font-weight: 600;
                color: #0f172a;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .dz__size {
                font-size: 11.5px;
                color: #64748b;
                margin-top: 1px;
            }
            .dz__actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex: none;
            }
            .dz__change {
                border: 1px solid #e2e8f0;
                background: #fff;
                color: #2563eb;
                border-radius: 7px;
                padding: 5px 10px;
                font-size: 12px;
                font-weight: 600;
                font-family: inherit;
                cursor: pointer;
                transition: background 0.12s, border-color 0.12s;
            }
            .dz__change:hover {
                background: #eff6ff;
                border-color: #3b82f6;
            }
            .dz__remove {
                border: none;
                background: transparent;
                color: #64748b;
                width: 28px;
                height: 28px;
                border-radius: 7px;
                cursor: pointer;
                display: grid;
                place-items: center;
                transition: background 0.12s, color 0.12s;
            }
            .dz__remove:hover {
                background: #fef2f2;
                color: #dc2626;
            }

            /* Visually-hidden live region */
            .dz__sr {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0 0 0 0);
                white-space: nowrap;
                border: 0;
            }
        `,
    ],
})
export class PdfDropzoneComponent {
    /** Accepted file types for the native picker. */
    @Input() accept = 'application/pdf,.pdf';
    /** Max size in Mo (megabytes). Files above this are rejected. */
    @Input() maxSizeMo = 10;
    /** The currently selected file (controlled by the parent). */
    @Input() value: File | null = null;
    /** Accessible label for the zone. */
    @Input() ariaLabel = 'Ajouter une fiche technique PDF';
    /** What kind of file to validate on drop/pick. Defaults to PDF so existing
     *  hosts keep their behavior; set to 'image' for picture uploads. */
    @Input() acceptKind: 'pdf' | 'image' | 'any' = 'pdf';
    /** Prompt title shown in the idle state. */
    @Input() title = 'Ajouter un PDF';
    /** Icon for the selected-file thumbnail. */
    @Input() thumbIcon = 'pi pi-file-pdf';

    /** Emits a validated PDF File. */
    @Output() fileSelected = new EventEmitter<File>();
    /** Emits when the user clears the selected file. */
    @Output() fileRemoved = new EventEmitter<void>();

    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    dragOver = false;
    error: string | null = null;

    get hasFile(): boolean {
        return !!this.value;
    }
    get fileName(): string {
        return this.value?.name ?? '';
    }
    get fileSizeLabel(): string {
        return this.formatSize(this.value?.size ?? 0);
    }
    get liveMessage(): string {
        if (this.error) return this.error;
        return this.hasFile ? `${this.fileName} sélectionné` : '';
    }

    openPicker(): void {
        this.fileInput?.nativeElement.click();
    }

    /** Container click: open the picker only when there's no file to manage
     *  (a filled state uses its explicit « Changer » button). */
    onZoneClick(): void {
        if (!this.hasFile || this.error) {
            this.openPicker();
        }
    }

    onKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            this.openPicker();
        }
    }

    onInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.handle(input.files?.[0] ?? null);
        // reset so picking the same file again re-fires `change`
        input.value = '';
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.dragOver = true;
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.dragOver = false;
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.dragOver = false;
        this.handle(event.dataTransfer?.files?.[0] ?? null);
    }

    remove(event?: Event): void {
        event?.stopPropagation();
        this.error = null;
        this.fileRemoved.emit();
    }

    /** Validate type + size, then emit or set an error. */
    private handle(file: File | null): void {
        if (!file) return;
        const typeOk =
            this.acceptKind === 'any'
                ? true
                : this.acceptKind === 'image'
                  ? /^image\//.test(file.type) ||
                    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name)
                  : file.type === 'application/pdf' ||
                    /\.pdf$/i.test(file.name);
        if (!typeOk) {
            this.error =
                this.acceptKind === 'image' ? 'Image uniquement' : 'PDF uniquement';
            return;
        }
        if (file.size > this.maxSizeMo * 1024 * 1024) {
            this.error = `Fichier trop volumineux (max ${this.maxSizeMo} Mo)`;
            return;
        }
        this.error = null;
        this.fileSelected.emit(file);
    }

    /** Human-readable size: « 1,4 Mo » / « 320 Ko » / « 0 o ». */
    private formatSize(bytes: number): string {
        if (!bytes) return '0 o';
        const mo = bytes / (1024 * 1024);
        if (mo >= 1) return `${mo.toFixed(1).replace('.', ',')} Mo`;
        const ko = bytes / 1024;
        if (ko >= 1) return `${Math.round(ko)} Ko`;
        return `${bytes} o`;
    }
}
