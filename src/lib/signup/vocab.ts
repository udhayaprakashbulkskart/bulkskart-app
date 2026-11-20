/**
 * The lists the manufacturer sign-up shares with the Business Setup Wizard, so both ask for the same things
 * in the same words and a profile started in one can be finished in the other.
 */

/** What a supplier account can be (the wizard's account types, without the buyer). */
export const SUPPLIER_BUSINESS_TYPES = ['Manufacturer', 'Wholesaler', 'Distributor', 'Importer', 'Exporter'] as const;
export type SupplierBusinessType = (typeof SUPPLIER_BUSINESS_TYPES)[number];

export const PRODUCT_CATEGORIES = [
  'Machinery & Industrial Equipment',
  'Packaging & Printing',
  'Textiles & Apparel',
  'Chemicals & Raw Materials',
  'Construction & Building Materials',
  'Electronics & Electricals',
  'Auto Parts & Vehicles',
  'Pharmaceuticals & Healthcare',
  'Agriculture & Food Products',
  'Plastics & Rubber',
  'Furniture & Home Decor',
  'Gems & Jewellery',
  'Handicrafts & Gifts',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type TradeType = 'domestic' | 'import' | 'export' | 'both';

/** 15 characters: state code, PAN, entity number, "Z", check character. */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const IEC_REGEX = /^[0-9]{10}$/;
