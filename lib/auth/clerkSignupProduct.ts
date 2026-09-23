/** Shared Clerk signup metadata. Atlas stamps `product: "atlas"`. */

export const ATLAS_CLERK_PRODUCT = "atlas";

export function clerkSignupProduct(data: {
  unsafe_metadata?: unknown;
  public_metadata?: unknown;
}): string | null {
  for (const bag of [data.unsafe_metadata, data.public_metadata]) {
    if (!bag || typeof bag !== "object" || !("product" in bag)) continue;
    const value = (bag as { product?: unknown }).product;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function isAtlasClerkSignup(data: {
  unsafe_metadata?: unknown;
  public_metadata?: unknown;
}): boolean {
  return clerkSignupProduct(data) === ATLAS_CLERK_PRODUCT;
}
