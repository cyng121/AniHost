import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import nextOnPages from "eslint-plugin-next-on-pages";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    /**
     * Two Next.js recommendations do not apply to this deployment target.
     *
     * no-img-element: Cloudflare Pages has no Image Optimization API, which is
     * why next.config sets `images.unoptimized`. With no optimizer available,
     * `next/image` is a wrapper around a plain `<img>` and the warning's
     * premise ("this may incur additional cost from your provider") inverts —
     * every image here is served straight from its CDN by design.
     *
     * no-page-custom-font: the rule exists for the Pages Router, where a font
     * <link> outside pages/_document only applies to one page. In the App
     * Router the <link> lives in the root layout, so it applies to every route.
     */
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    rules: {
      "@next/next/no-img-element": "off",
      "@next/next/no-page-custom-font": "off",
    },
  },
  {
    /**
     * Cloudflare Pages, built with @cloudflare/next-on-pages.
     *
     * The adapter only supports the Edge runtime, so these rules turn the two
     * ways an app silently stops being deployable into blocking lint errors:
     *
     *   no-nodejs-runtime            a page/route left on the Node.js runtime
     *   no-app-nodejs-dynamic-ssg    an app route that would need Node to
     *                                generate params at request time
     *   no-unsupported-configs       a next.config option the adapter cannot
     *                                honour (e.g. reactStrictMode, ppr)
     *
     * `npm run lint` deliberately includes next.config.ts, otherwise the
     * third rule would have no file to inspect.
     */
    files: ["app/**/*.ts", "app/**/*.tsx", "next.config.ts"],
    plugins: { "next-on-pages": nextOnPages },
    rules: {
      "next-on-pages/no-nodejs-runtime": "error",
      "next-on-pages/no-app-nodejs-dynamic-ssg": "error",
      "next-on-pages/no-unsupported-configs": "error",
    },
  },
];

export default eslintConfig;
