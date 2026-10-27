// UI capabilities of the explorer. The public site enables everything; partner
// embeds switch parts off. Data the partner must not show (contacts, booking
// links, prices) is also removed on the server, never only hidden here.
export type ExplorerFeatures = {
  header: boolean;
  search: boolean;
  categoryFilter: boolean;
  advancedFilters: boolean;
  favorites: boolean;
  route: boolean;
  prices: boolean;
  languageSwitch: boolean;
  contribute: boolean;
  account: boolean;
  about: boolean;
  branding: boolean;
};
export const fullFeatures: ExplorerFeatures = {
  header: true,
  search: true,
  categoryFilter: true,
  advancedFilters: true,
  favorites: true,
  route: true,
  prices: true,
  languageSwitch: true,
  contribute: true,
  account: true,
  about: true,
  branding: false,
};
