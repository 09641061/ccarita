import { Injectable, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CurrentEstablishment } from '../../organization/public-api';
import { ConnectLine, SignupResult, WhatsappLine } from '../domain/model/whatsapp-line';
import { EmbeddedSignup } from '../infrastructure/embedded-signup';
import { WhatsappLinesApi } from '../infrastructure/whatsapp-lines.api';

/**
 * The selected establishment's WhatsApp line (W1, W2), which the inbox, the chat, Ajustes and Primeros pasos read.
 * Connecting and disconnecting reload it everywhere.
 */
@Injectable({ providedIn: 'root' })
export class WhatsappLineStore {
  private readonly api = inject(WhatsappLinesApi);
  private readonly establishment = inject(CurrentEstablishment);
  private readonly signup = inject(EmbeddedSignup);

  /** Connected or the last one; `WHATSAPP_LINE_NOT_FOUND` when it never had one. Reloads with the establishment. */
  readonly line = rxResource({
    params: () => this.establishment.id() ?? undefined,
    stream: ({ params }) => this.api.forEstablishment(params),
  });

  /** Whether this build can open Meta's Embedded Signup (`environment.metaSignup`). */
  readonly signupAvailable = this.signup.available;

  /** Opens Meta's window. @throws ApiError `SIGNUP_CANCELLED` when the owner closes it without finishing. */
  signUpWithMeta(): Promise<SignupResult> {
    return this.signup.launch();
  }

  /** @throws ApiError `LINE_ALREADY_CONNECTED`, `WHATSAPP_SIGNUP_FAILED`, `PLAN_INACTIVE`. */
  async connect(
    establishmentId: string,
    command: ConnectLine,
    idempotencyKey: string,
  ): Promise<WhatsappLine> {
    const line = await firstValueFrom(this.api.connect(establishmentId, command, idempotencyKey));
    this.line.reload();
    return line;
  }

  /** Owner only; the conversations stay (W1). */
  async disconnect(establishmentId: string): Promise<void> {
    await firstValueFrom(this.api.disconnect(establishmentId));
    this.line.reload();
  }
}
