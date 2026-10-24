import { TestBed } from '@angular/core/testing';
import { TenantContext } from './tenant-context';

describe('TenantContext', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the establishment of each organization', () => {
    const tenant = TestBed.inject(TenantContext);

    tenant.selectOrganization('org-1');
    tenant.selectEstablishment('est-1');
    tenant.selectOrganization('org-2');
    expect(tenant.establishmentId()).toBeNull();
    tenant.selectEstablishment('est-2');
    tenant.selectOrganization('org-1');

    expect(tenant.establishmentId()).toBe('est-1');
  });

  it('survives a reload and forgets everything on clear', () => {
    const tenant = TestBed.inject(TenantContext);
    tenant.selectOrganization('org-1');
    tenant.selectEstablishment('est-1');

    TestBed.resetTestingModule();
    const reloaded = TestBed.inject(TenantContext);
    expect(reloaded.organizationId()).toBe('org-1');
    expect(reloaded.establishmentId()).toBe('est-1');

    reloaded.clear();
    expect(reloaded.organizationId()).toBeNull();
    expect(JSON.parse(localStorage.getItem('ccarita.tenant')!)).toEqual({
      organizationId: null,
      establishments: {},
    });
  });

  it('ignores an establishment while no organization is selected', () => {
    const tenant = TestBed.inject(TenantContext);

    tenant.selectEstablishment('est-1');

    expect(tenant.establishmentId()).toBeNull();
  });
});
