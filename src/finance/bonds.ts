/** Price of a plain fixed-coupon bond given the market yield. */
export interface BondInput {
  face: number;
  couponRate: number;
  marketYield: number;
  years: number;
  paymentsPerYear?: number;
}

export function bondPrice({ face, couponRate, marketYield, years, paymentsPerYear = 2 }: BondInput): number {
  const n = Math.round(years * paymentsPerYear);
  const c = (face * couponRate) / paymentsPerYear;
  const y = marketYield / paymentsPerYear;
  if (y === 0) return c * n + face;
  const discount = Math.pow(1 + y, -n);
  return c * ((1 - discount) / y) + face * discount;
}
