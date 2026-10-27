import type { MetadataRoute } from "next";

/** Private app: ask every crawler to stay out. The real protection is the login. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
