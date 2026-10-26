import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { ConversationStore } from '../../../application/conversation.store';
import { Message } from '../../../domain/model/message';

type MediaView =
  | { readonly state: 'loading' | 'pending' | 'failed' | 'removed' | 'unshown' | 'document' }
  | { readonly state: 'shown'; readonly url: string };

/**
 * A file a customer sent (07 §4). pibble serves it with the token, so it is fetched as a blob and shown through an
 * object URL, revoked when the message leaves the screen. Not ready, failed and removed (C5) are states of the
 * message; a document downloads only when asked.
 */
@Component({
  selector: 'app-message-media',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './message-media.html',
  styleUrl: './message-media.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageMedia {
  private readonly store = inject(ConversationStore);

  readonly message = input.required<Message>();

  protected readonly view = signal<MediaView>({ state: 'loading' });
  protected readonly kind = computed(() => this.message().kind);
  private url: string | null = null;
  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const message = this.message();
      untracked(() => this.show(message));
    });
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  protected retry(): void {
    this.loadedFor = null;
    this.show(this.message());
  }

  /** Fetches the document and hands it to the browser as a download. */
  protected async download(): Promise<void> {
    const message = this.message();
    try {
      const blob = await this.store.media(message.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url));
    } catch (error) {
      this.view.set({ state: stateOf(ApiError.of(error)) });
    }
  }

  protected unshown(): void {
    this.revoke();
    this.view.set({ state: 'unshown' });
  }

  private show(message: Message): void {
    if (message.mediaStatus === 'removed') return this.view.set({ state: 'removed' });
    if (message.mediaStatus === 'failed') return this.view.set({ state: 'failed' });
    if (message.mediaStatus !== 'ready') return this.view.set({ state: 'pending' });
    if (message.kind === 'document') return this.view.set({ state: 'document' });
    if (this.loadedFor === message.id) return;
    this.loadedFor = message.id;
    this.view.set({ state: 'loading' });
    this.store.media(message.id).then(
      (blob) => {
        if (this.loadedFor !== message.id) return;
        this.revoke();
        this.url = URL.createObjectURL(blob);
        this.view.set({ state: 'shown', url: this.url });
      },
      (error: unknown) => {
        this.loadedFor = null;
        this.view.set({ state: stateOf(ApiError.of(error)) });
      },
    );
  }

  private revoke(): void {
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }
}

function stateOf(error: ApiError): 'pending' | 'failed' | 'removed' {
  if (error.code === 'MEDIA_NOT_READY') return 'pending';
  if (error.code === 'MEDIA_REMOVED') return 'removed';
  return 'failed';
}
