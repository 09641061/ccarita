/** C4: the identity documents a customer may have. */
export type DocumentType = 'dni' | 'ruc' | 'ce' | 'passport';

export const DOCUMENT_TYPES: readonly DocumentType[] = ['dni', 'ruc', 'ce', 'passport'];

export function isDocumentType(value: unknown): value is DocumentType {
  return DOCUMENT_TYPES.includes(value as DocumentType);
}

/** C4: an identity document as pibble stores it; pibble checks the number's format, nothing looks it up. */
export class IdentityDocument {
  constructor(
    readonly type: DocumentType,
    /** Upper case, without spaces. */
    readonly number: string,
  ) {}
}
