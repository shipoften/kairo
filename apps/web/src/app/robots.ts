import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5180";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/*/admin", "/*/wallet", "/*/settings"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
