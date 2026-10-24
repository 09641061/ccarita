import { DocumentType } from './identity-document';

/**
 * What staff type about a customer (C4); every field is optional and an empty one means none. Updating sends all
 * of it, because pibble clears what is left out. The phone is not here: it never changes (C1).
 */
export interface CustomerDetails {
  readonly name: string;
  readonly documentType: DocumentType | null;
  readonly documentNumber: string;
  readonly notes: string;
}

/** C4: the half of the document that is missing when only the other half was given, else `null`. */
export function missingDocumentPart(
  details: Pick<CustomerDetails, 'documentType' | 'documentNumber'>,
): 'type' | 'number' | null {
  const hasType = details.documentType !== null;
  const hasNumber = details.documentNumber.trim() !== '';
  if (hasType === hasNumber) return null;
  return hasType ? 'number' : 'type';
}
