/**
 * Home page sections that are switched off for now.
 *
 * Their components, data and pages are kept as they are; set a flag back to `false` to show the section again.
 * A hidden section is not rendered and its code is not downloaded.
 */
export const HIDDEN_HOME_SECTIONS = {
  /** "Explore Bulk Product Categories" (CategoriesAndStatsSection) */
  exploreCategories: true,
  /** "Fast-Track Sourcing & Selling Workflows" (VerifiedSupplierQuickActions) */
  tradeWorkflows: true,
  /** "Sell Products in 24 Hours" auction rail (LiveReverseAuctionsRail) */
  sellIn24Hours: true,
} as const;
