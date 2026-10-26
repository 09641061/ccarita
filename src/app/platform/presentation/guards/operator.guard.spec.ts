import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { SessionStore } from '../../../iam/public-api';
import { ApiError } from '../../../shared/domain/model/api-error';
import { OperatorStore } from '../../application/operator.store';
import { operatorGuard } from './operator.guard';

function run(verify: () => Promise<boolean>, signedIn = true) {
  TestBed.configureTestingModule({
    providers: [
      { provide: OperatorStore, useValue: { verify } },
      { provide: SessionStore, useValue: { restore: async () => signedIn } },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    operatorGuard({} as ActivatedRouteSnapshot, { url: '/platform/org-1' } as RouterStateSnapshot),
  ) as Promise<boolean | UrlTree>;
}

const url = (result: boolean | UrlTree) => TestBed.inject(Router).serializeUrl(result as UrlTree);

describe('operatorGuard', () => {
  it('lets an operator in', async () => {
    expect(await run(async () => true)).toBe(true);
  });

  it('leaves a signed-out visitor to authGuard without asking pibble', async () => {
    const verify = vi.fn(async () => true);
    expect(await run(verify, false)).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('sends anyone else to /sin-permiso', async () => {
    expect(url(await run(async () => false))).toBe('/sin-permiso');
  });

  it('sends a session pibble refuses to sign in, keeping the address', async () => {
    const result = await run(async () => {
      throw new ApiError(401, 'UNAUTHENTICATED', '');
    });
    expect(url(result)).toBe('/ingresar?volver=%2Fplatform%2Forg-1');
  });

  it('opens the area offline, where the screens offer to retry', async () => {
    const result = await run(async () => {
      throw new ApiError(0, 'NETWORK_ERROR', '');
    });
    expect(result).toBe(true);
  });
});
