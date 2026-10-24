import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../http/api-base-url';
import { TenantContext } from './tenant-context';

/** Adds `X-Organization-Id` to calls to pibble's `/api/v1`; pibble ignores it where no organization applies. */
export const tenantInterceptor: HttpInterceptorFn = (request, next) => {
  const organizationId = inject(TenantContext).organizationId();
  if (!organizationId || !request.url.startsWith(`${inject(API_BASE_URL)}/api/v1/`))
    return next(request);
  return next(request.clone({ setHeaders: { 'X-Organization-Id': organizationId } }));
};
