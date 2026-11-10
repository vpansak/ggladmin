/** Old single-person tickets may not have a quantity field. Never infer it from price. */
export function getTicketQuantity(quantity: unknown): number {
  const count = Number(quantity);
  return Number.isSafeInteger(count) && count > 0 ? count : 1;
}
