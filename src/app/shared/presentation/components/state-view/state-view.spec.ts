import { TestBed } from '@angular/core/testing';
import { provideSpanish } from '../../../../../testing/provide-spanish';
import { StateKind, StateView } from './state-view';

describe('StateView', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideSpanish()] }));

  async function render(kind: StateKind, inputs: Record<string, string> = {}) {
    const fixture = TestBed.createComponent(StateView);
    fixture.componentRef.setInput('kind', kind);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    await fixture.whenStable();
    return fixture;
  }

  it('promises that retrying while offline does not duplicate', async () => {
    const element = (await render('offline')).nativeElement as HTMLElement;

    expect(element.getAttribute('role')).toBe('alert');
    expect(element.textContent).toContain('No hay conexión');
    expect(element.textContent).toContain('no se duplicará');
  });

  it('emits retry from the error state', async () => {
    const fixture = await render('error');
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);

    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();

    expect(retry).toHaveBeenCalledOnce();
  });

  it.each(['empty', 'forbidden', 'notFound'] as const)('offers no retry when %s', async (kind) => {
    const element = (await render(kind)).nativeElement as HTMLElement;

    expect(element.getAttribute('role')).toBe('status');
    expect(element.querySelector('button')).toBeNull();
  });

  it('uses the screen texts when given', async () => {
    const element = (await render('forbidden', { title: 'pageNotFound.title' }))
      .nativeElement as HTMLElement;

    expect(element.querySelector('h2')?.textContent).toBe('Página no encontrada');
    expect(element.textContent).toContain('Pídele al dueño o a un encargado');
  });
});
