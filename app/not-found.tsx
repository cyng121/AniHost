import { Notice } from "@/components/Notice";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <main className="wrap page">
      <Notice
        title="Nothing lives at this address"
        body="The title may have been renamed upstream, or the link is older than the catalogue."
        action={{ href: "/", label: "Back to Home" }}
      />
      <Footer />
    </main>
  );
}
