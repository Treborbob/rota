import type { MetadataRoute } from "next";

/** Private app: nothing to index. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
