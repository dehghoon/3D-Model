# Linkoteq Design System Compliance

All global navigation, logo, product menu and design tokens MUST comply with the [Linkoteq Platform Design System Contract](https://github.com/dehghoon/Main-website/blob/design/skyciv-inspired-platform-refresh-20261111/contracts/platform-design-system-v1.md).

Canonical CSS: `https://linkoteq.com/design-system/linkoteq-shell-v1.css` (publish Main-website first).
Canonical logo: `https://linkoteq.com/linko-logo-final.svg`.
Canonical product registry: `Main-website/lib/engineering-tools.ts`.

Current status: temporary local navigation adapter; reusable shared header package not yet implemented. Verify 360/390/768/1440px, accessibility, build, calculation/editor regression and access gating before merge/deploy. New tools MUST NOT ship independent global headers.
