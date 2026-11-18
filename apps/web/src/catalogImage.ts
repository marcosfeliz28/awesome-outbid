/** One local fallback per image source; never retry a failing placeholder. */
export function handleCatalogImageError(image: Pick<HTMLImageElement, "getAttribute" | "setAttribute">) {
  const fallback = "/products/accessories.svg";
  if (image.getAttribute("src") !== fallback) image.setAttribute("src", fallback);
}
