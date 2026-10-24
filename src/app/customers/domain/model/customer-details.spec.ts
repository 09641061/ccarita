import { missingDocumentPart } from './customer-details';

describe('missingDocumentPart (C4)', () => {
  it('accepts a whole document or none', () => {
    expect(missingDocumentPart({ documentType: null, documentNumber: ' ' })).toBeNull();
    expect(missingDocumentPart({ documentType: 'dni', documentNumber: '45678912' })).toBeNull();
  });

  it('names the missing half', () => {
    expect(missingDocumentPart({ documentType: 'ruc', documentNumber: '' })).toBe('number');
    expect(missingDocumentPart({ documentType: null, documentNumber: '45678912' })).toBe('type');
  });
});
