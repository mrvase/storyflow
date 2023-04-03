export const trimLeadingSlash = (el: string) => el.replace(/^\/+/, "");
export const trimTrailingSlash = (el: string) => el.replace(/\/+$/, "");
export const trimSlashes = (el: string) =>
  trimTrailingSlash(trimLeadingSlash(el));
