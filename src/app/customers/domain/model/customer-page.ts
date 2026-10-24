import { CustomerProfile } from './customer-profile';

/** One page of a customer search; pibble counts no total, it says whether another page has customers. */
export class CustomerPage {
  constructor(
    readonly items: readonly CustomerProfile[],
    readonly page: number,
    readonly hasMore: boolean,
  ) {}
}
