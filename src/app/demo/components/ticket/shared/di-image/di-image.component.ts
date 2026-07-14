import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

/**
 * Shared "Photo du problème" block for the Diagnostic and Réparation modals.
 *
 * The DI's creation photo is a PRIVATE Google Drive file, so `imageUrl` points
 * at the backend proxy (GET /di/:id/image) that streams the bytes. We DON'T bind
 * that URL to `<img src>` directly: a plain resource load can be swallowed by the
 * app's PWA service worker / browser quirks, showing a broken image. Instead we
 * fetch it with HttpClient (the exact path GraphQL uses successfully, CORS-ok)
 * and display the result as an in-memory `blob:` object URL — which can never
 * network-fail. So the photo shows INLINE, directly, as soon as it arrives.
 *
 * Clicking it opens an in-page lightbox (dark overlay, click / Échap to close).
 * If the fetch truly fails (404 for legacy filename-only rows, revoked file…) it
 * falls back to a clean "Ouvrir l'image" link (`viewUrl` = the Drive viewer).
 * Renders nothing when the DI has no image at all.
 */
@Component({
  selector: 'app-di-image',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="di-photo" *ngIf="imageUrl || viewUrl">
      <label class="di-photo__label">Photo du problème</label>

      <!-- Loading skeleton while the bytes stream in. -->
      <div class="di-photo__frame di-photo__frame--loading" *ngIf="loading">
        <i class="pi pi-spin pi-spinner"></i>
        <span>Chargement de l'image…</span>
      </div>

      <button
        *ngIf="!loading && objectUrl; else fallback"
        type="button"
        class="di-photo__frame"
        title="Cliquer pour agrandir"
        (click)="zoomed = true"
      >
        <img [src]="objectUrl" alt="Photo du problème" />
        <span class="di-photo__zoom"><i class="pi pi-search-plus"></i></span>
      </button>

      <ng-template #fallback>
        <div class="di-photo__unavailable" *ngIf="!loading">
          <i class="pi pi-image"></i>
          <span>Aperçu indisponible</span>
          <a
            *ngIf="viewUrl"
            [href]="viewUrl"
            target="_blank"
            rel="noopener"
            class="di-photo__open"
          >
            <i class="pi pi-external-link"></i> Ouvrir l'image
          </a>
        </div>
      </ng-template>
    </div>

    <!-- In-page lightbox: full-screen dark overlay above the dialog. -->
    <div
      class="di-lightbox"
      *ngIf="zoomed && objectUrl"
      (click)="zoomed = false"
    >
      <button
        type="button"
        class="di-lightbox__close"
        aria-label="Fermer"
        (click)="zoomed = false"
      >
        <i class="pi pi-times"></i>
      </button>
      <img
        [src]="objectUrl"
        alt="Photo du problème (agrandie)"
        (click)="$event.stopPropagation()"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .di-photo__label {
        display: block;
        font-size: 0.72rem;
        font-weight: 650;
        color: #64748b;
        margin-bottom: 0.35rem;
      }
      .di-photo__frame {
        position: relative;
        display: block;
        width: 100%;
        max-width: 460px;
        padding: 0;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #f1f5f9;
        overflow: hidden;
        cursor: zoom-in;
      }
      .di-photo__frame img {
        display: block;
        width: 100%;
        max-height: 340px;
        object-fit: contain;
        background: #f1f5f9;
      }
      .di-photo__frame--loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        min-height: 120px;
        color: #94a3b8;
        font-size: 0.82rem;
        cursor: default;
      }
      .di-photo__zoom {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: rgba(37, 99, 235, 0.92);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.15s;
      }
      .di-photo__frame:hover .di-photo__zoom {
        opacity: 1;
      }
      .di-photo__unavailable {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.85rem 1rem;
        border: 1px dashed #cbd5e1;
        border-radius: 10px;
        background: #f8fafc;
        color: #64748b;
        font-size: 0.82rem;
      }
      .di-photo__unavailable > i {
        font-size: 1.1rem;
        color: #94a3b8;
      }
      .di-photo__open {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: #2563eb;
        font-weight: 600;
        text-decoration: none;
        font-size: 0.82rem;
        white-space: nowrap;
      }
      .di-photo__open:hover {
        text-decoration: underline;
      }
      .di-lightbox {
        position: fixed;
        inset: 0;
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 3vh 3vw;
        background: rgba(2, 6, 23, 0.86);
        cursor: zoom-out;
        animation: di-lightbox-in 0.12s ease-out;
      }
      .di-lightbox img {
        max-width: 94vw;
        max-height: 90vh;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
        cursor: default;
      }
      .di-lightbox__close {
        position: fixed;
        top: 18px;
        right: 22px;
        width: 42px;
        height: 42px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
        font-size: 1.1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      }
      .di-lightbox__close:hover {
        background: rgba(255, 255, 255, 0.25);
      }
      @keyframes di-lightbox-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    `,
  ],
})
export class DiImageComponent implements OnChanges, OnDestroy {
  @Input() imageUrl = '';
  @Input() viewUrl = '';

  /** Blob object URL once the bytes are fetched — bound to <img>. */
  objectUrl = '';
  loading = false;
  zoomed = false;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['imageUrl']) {
      this.zoomed = false;
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.revoke();
  }

  /**
   * Fetch the (private) photo through the proxy with HttpClient — the same
   * transport GraphQL already uses successfully — and expose it as a blob URL.
   * A blob: source never triggers an <img> network error, so a proxy that
   * answers 200 always renders; only a real HTTP failure shows the fallback.
   */
  private load(): void {
    this.revoke();
    const url = (this.imageUrl ?? '').trim();
    if (!url) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.objectUrl = URL.createObjectURL(blob);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        // Proxy couldn't serve it (legacy row, revoked file…) → clean fallback.
        this.objectUrl = '';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private revoke(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = '';
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.zoomed) this.zoomed = false;
  }
}
