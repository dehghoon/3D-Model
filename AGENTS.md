# Linkoteq SEO and Social — development requirement

Before creating or changing any public tool landing page or published article, read the current approved SEO contract at `dehghoon/Main-website/contracts/marketing/seo-social-standard-v1.json` on main. GPT-8 owns marketing requirements; engineering tool maintainers (including GPT-3/GPT-4) implement them in their own repositories. Do not change GPT plugins or Structural Core.

For new public tool pages: unique title and meta description; absolute canonical; Open Graph title, description and URL; discoverable robots.txt and sitemap.xml; truthful readiness status (Trial/Beta), appropriate registration/request-access CTA; no claim of verified calculations without evidence. Keep actual tool execution gated by existing Access Manager policies. For new published articles: SSR-visible title and description, canonical, BlogPosting structured data with real dates, OG image, relevant internal links and CTA. Avoid invented ratings/prices.

Run the repository SEO check on pull requests. Fix failing SEO checks before release; do not disable unrelated engineering CI or bypass branch protection. The SEO contract is versioned independently from Structural Core.
