/** A1: the business info is free text of at most this many characters (pibble's `AssistantSettings`). */
export const MAX_BUSINESS_INFO = 4000;

/**
 * A1: whether the assistant answers an establishment's customers, and what the owner wants it to know besides
 * services, prices and hours. Off with no business info until someone configures it.
 */
export class AssistantSettings {
  constructor(
    readonly establishmentId: string,
    readonly enabled: boolean,
    readonly businessInfo: string,
  ) {}
}

/** A1: turn the assistant on or off and replace the business info; pibble replaces both at once. */
export interface ConfigureAssistant {
  readonly enabled: boolean;
  readonly businessInfo: string;
}
