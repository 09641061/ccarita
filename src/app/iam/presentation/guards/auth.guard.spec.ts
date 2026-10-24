import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { ApiError } from '../../../shared/domain/model/api-error';
import { SessionStore } from '../../application/session.store';
import { authGuard } from './auth.guard';

function run(restore: () => Promise<boolean>) {
  TestBed.configureTestingModule({
    providers: [{ provide: SessionStore, useValue: { restore } }],
  });
  return TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, { url: '/clientes?q=ana' } as RouterStateSnapshot),
  ) as Promise<boolean | UrlTree>;
}

describe('authGuard', () => {
  it('lets a signed-in user through', async () => {
    expect(await run(async () => true)).toBe(true);
  });

  it('sends a signed-out user to sign in, keeping the address', async () => {
    const result = await run(async () => false);

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/ingresar?volver=%2Fclientes%3Fq%3Dana',
    );
  });

  it('sends to sign in, where the stored session can be retried, when pibble is unreachable', async () => {
    const result = await run(async () => {
      throw new ApiError(0, 'NETWORK_ERROR', 'offline');
    });

    expect(result).toBeInstanceOf(UrlTree);
  });
});
