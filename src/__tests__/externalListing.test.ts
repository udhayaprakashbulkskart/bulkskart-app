import { describe, expect, it } from 'vitest';
import {
  gemTenderUrl,
  isExternalFlag,
  readExternalAuction,
  sharedBuyerPhone,
  specificationProse,
  viewOnSourceLabel,
} from '@/lib/externalListing';

const GEM = 'https://bidplus.gem.gov.in/all-bids/GEM/2026/B/12345';

describe('public auction listings', () => {
  it('reads the external flag whether it is the string true or a boolean', () => {
    expect(isExternalFlag('true')).toBe(true);
    expect(isExternalFlag(' TRUE ')).toBe(true);
    expect(isExternalFlag(true)).toBe(true);
    expect(isExternalFlag('false')).toBe(false);
    expect(isExternalFlag(false)).toBe(false);
    expect(isExternalFlag(null)).toBe(false);
  });

  it('marks a flagged lot external and keeps the seller, source name and link', () => {
    const info = readExternalAuction(
      {
        external_listing: 'true',
        source_url: GEM,
        source_name: 'GeM',
        seller_org: 'Indian Railways',
        grade: 'IS 2062',
      },
      'Steel plates',
    );
    expect(info).toEqual({
      external: true,
      sourceUrl: GEM,
      sourceName: 'GeM',
      sellerOrg: 'Indian Railways',
    });
    expect(viewOnSourceLabel(info.sourceName)).toBe('View on GeM');
    expect(viewOnSourceLabel('BidPlus')).toBe('View on BidPlus');
    expect(viewOnSourceLabel(null)).toBe('View on GeM');
  });

  it('uses a GeM link written in the description when source_url is missing', () => {
    const info = readExternalAuction(
      { external_listing: true },
      `Published at ${GEM}.`,
    );
    expect(info.external).toBe(true);
    expect(info.sourceUrl).toBe(GEM);
  });

  it('treats a GeM link in the description as a public auction even without the flag', () => {
    const info = readExternalAuction({}, `See the notice ${GEM}`);
    expect(info.external).toBe(true);
    expect(info.sourceUrl).toBe(GEM);
  });

  it('leaves a normal auction alone, including one whose description has an ordinary link', () => {
    const info = readExternalAuction(
      { grade: 'A', datasheet: 'https://cdn.example.com/sheet.pdf' },
      'Photos: https://cdn.example.com/lot.jpg',
    );
    expect(info.external).toBe(false);
    expect(info.sourceUrl).toBeNull();
    expect(info.sellerOrg).toBeNull();
  });

});

describe('government tender requirements', () => {
  it('finds source_url on an object or in JSON text', () => {
    expect(gemTenderUrl({ source_url: GEM, item: 'Cable' })).toBe(GEM);
    expect(gemTenderUrl(JSON.stringify({ source_url: GEM }))).toBe(GEM);
    expect(gemTenderUrl(`source_url: ${GEM}\nQty: 10`)).toBe(GEM);
  });

  it('finds a bidplus.gem.gov.in link written in the specifications', () => {
    expect(gemTenderUrl(`Tender notice ${GEM} closes Friday.`)).toBe(GEM);
  });

  it('does not treat an ordinary specification, or a non-bidplus link, as a government tender', () => {
    expect(gemTenderUrl('Grade: IS 2062\nThickness: 8 mm')).toBeNull();
    expect(gemTenderUrl(null)).toBeNull();
    expect(gemTenderUrl('See https://gem.gov.in/about')).toBeNull();
    expect(gemTenderUrl('https://mkp.gem.gov.in/some-product')).toBeNull();
  });

  it('drops the importer keys from the text a buyer would read', () => {
    const prose = specificationProse(JSON.stringify({
      source_url: GEM,
      source_name: 'GeM',
      external_listing: 'true',
      seller_org: 'Indian Railways',
      item: 'HR coil',
    }));
    expect(prose).toBe('Item: HR coil');
    expect(specificationProse('Grade: A\nMake: SAIL')).toBe('Grade: A\nMake: SAIL');
  });

  it('only reports a phone the buyer actually saved', () => {
    expect(sharedBuyerPhone('  9876543210  ')).toBe('9876543210');
    expect(sharedBuyerPhone('')).toBeNull();
    expect(sharedBuyerPhone(null)).toBeNull();
    expect(sharedBuyerPhone(undefined)).toBeNull();
  });
});
