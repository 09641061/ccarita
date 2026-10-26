import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { settle } from '../../../../../testing/settle';
import { ApiError } from '../../../../shared/domain/model/api-error';
import { CurrentEstablishment } from '../../../application/current-establishment.store';
import { CurrentOrganization } from '../../../application/current-organization.store';
import { Establishment } from '../../../domain/model/establishment';
import { EstablishmentDetails } from './establishment-details';

const SURCO = new Establishment('est-2', 'Surco', 'Av. Primavera 120', 'America/Lima', null);

describe('EstablishmentDetails', () => {
  let describeEstablishment: ReturnType<typeof vi.fn>;

  async function render(planActive = true) {
    describeEstablishment = vi.fn(async () => SURCO);
    TestBed.configureTestingModule({
      providers: [
        provideSpanish(),
        { provide: CurrentOrganization, useValue: { planActive: signal(planActive) } },
        { provide: CurrentEstablishment, useValue: { describe: describeEstablishment } },
      ],
    });
    const fixture = TestBed.createComponent(EstablishmentDetails);
    fixture.componentRef.setInput('place', SURCO);
    const saved = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    fixture.componentInstance.cancelled.subscribe(cancelled);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement, saved, cancelled };
  }

  const button = (host: HTMLElement, label: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent!.includes(label),
    )!;

  it('O7: fills the given establishment and saves it with a PUT', async () => {
    const { fixture, host, saved } = await render();
    const name = host.querySelector<HTMLInputElement>('input')!;
    expect(name.value).toBe('Surco');
    name.value = 'Sede Surco';
    name.dispatchEvent(new Event('input'));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    await fixture.whenStable();

    expect(describeEstablishment).toHaveBeenCalledWith('est-2', {
      name: 'Sede Surco',
      address: 'Av. Primavera 120',
      timeZone: 'America/Lima',
    });
    expect(saved).toHaveBeenCalled();
  });

  it('shows why saving failed and stays open', async () => {
    const { fixture, host, saved } = await render();
    describeEstablishment.mockRejectedValue(new ApiError(402, 'PLAN_INACTIVE', ''));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    await fixture.whenStable();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(saved).not.toHaveBeenCalled();
  });

  it('cancels without saving', async () => {
    const { host, cancelled } = await render();
    button(host, 'Cancelar').click();
    expect(cancelled).toHaveBeenCalled();
    expect(describeEstablishment).not.toHaveBeenCalled();
  });

  it('O6: an inactive plan disables saving', async () => {
    const { host } = await render(false);
    expect(button(host, 'Guardar cambios').disabled).toBe(true);
  });
});
