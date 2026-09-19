import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Copyright",
  description: "How to send a copyright notice to Ani Ghost.",
};

/**
 * Static by design: this page has to render and be readable even if every
 * script on the site fails, because it is the route a rights holder uses.
 */
export default function CopyrightPage() {
  return (
    <main className="wrap page legal">
      <header className="page__head">
        <span className="cap">Legal</span>
        <h1>Copyright</h1>
        <p className="page__sub">
          Ani Ghost respects copyright. If you own rights to something reachable through this
          site, use the process below and we will act on it.
        </p>
      </header>

      <section className="legal__block">
        <h2>Sending a notice</h2>
        <p>
          Send your notice to the address below. To let us act quickly, include all of the
          following:
        </p>
        <ul className="legal__list">
          <li>Identification of the work you hold rights to.</li>
          <li>The exact address on this site where the material appears.</li>
          <li>Your name, postal address, telephone number and email address.</li>
          <li>
            A statement that you believe in good faith the use is not authorised by the rights
            holder, its agent, or the law.
          </li>
          <li>
            A statement that the information in your notice is accurate, and that you are the
            rights holder or authorised to act on their behalf.
          </li>
          <li>Your physical or electronic signature.</li>
        </ul>
        <p className="legal__contact">
          <strong>Copyright agent — Ani Ghost</strong>
          <br />
          <a href="mailto:copyright@anighost.com">copyright@anighost.com</a>
        </p>
      </section>

      <section className="legal__block">
        <h2>What happens next</h2>
        <p>
          Complete notices are acted on promptly. Where the material sits with a third-party
          host rather than with us, we remove our reference to it and pass the notice on.
          Accounts that repeatedly infringe are terminated.
        </p>
      </section>

      <section className="legal__block">
        <h2>Counter notice</h2>
        <p>
          If your material was removed in error, reply to the same address with the material
          identified, its address before removal, your contact details, and a statement under
          penalty of perjury that the removal was a mistake or misidentification.
        </p>
      </section>

      <Footer />
    </main>
  );
}
