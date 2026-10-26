import { Injectable, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, map, of, throwError } from 'rxjs';
import { SessionStore } from '../../iam/public-api';
import { ApiError } from '../../shared/domain/model/api-error';
import { OperatorApi } from '../infrastructure/operator.api';

const isDenied = (error: unknown) => ApiError.of(error).status === 403;

/**
 * Whether the signed-in user is on the Takodu team, as pibble's operator check says. pibble reads the flag on every
 * internal call, so the guard asks again on each entry; the cached answer only decides whether to offer the link.
 */
@Injectable({ providedIn: 'root' })
export class OperatorStore {
  private readonly api = inject(OperatorApi);
  private readonly session = inject(SessionStore);

  /** Asked once per signed-in user; `false` on a 403, an error otherwise. */
  readonly check = rxResource({
    params: () => this.session.user()?.id,
    stream: () =>
      this.api.check().pipe(
        map(() => true),
        catchError((error: unknown) => (isDenied(error) ? of(false) : throwError(() => error))),
      ),
  });

  readonly isOperator = computed(() => this.check.hasValue() && this.check.value() === true);

  /** For the guard: `false` on a 403. @throws ApiError on any other failure. */
  async verify(): Promise<boolean> {
    try {
      await firstValueFrom(this.api.check());
      return true;
    } catch (error) {
      if (isDenied(error)) return false;
      throw error;
    }
  }
}
