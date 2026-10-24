import { CustomerProfile } from './customer-profile';
import { IdentityDocument } from './identity-document';

const profile = (name: string | null, whatsapp: string | null, displayName: string) =>
  new CustomerProfile('c-1', '+51987654321', displayName, name, whatsapp, null, null);

describe('CustomerProfile', () => {
  it('shows the WhatsApp name apart only when the typed name hides it (C2)', () => {
    expect(profile('Rosa Huamán', 'Rosita H.', 'Rosa Huamán').otherWhatsappName).toBe('Rosita H.');
    expect(profile(null, 'Rosita H.', 'Rosita H.').otherWhatsappName).toBeNull();
    expect(profile('Rosa', null, 'Rosa').otherWhatsappName).toBeNull();
  });

  it('gives its editable state with empty texts for what is missing', () => {
    expect(profile(null, null, '+51987654321').details).toEqual({
      name: '',
      documentType: null,
      documentNumber: '',
      notes: '',
    });
    const full = new CustomerProfile(
      'c-1',
      '+51987654321',
      'Rosa',
      'Rosa',
      null,
      new IdentityDocument('dni', '45678912'),
      'Prefiere los sábados',
    );
    expect(full.details).toEqual({
      name: 'Rosa',
      documentType: 'dni',
      documentNumber: '45678912',
      notes: 'Prefiere los sábados',
    });
  });
});
