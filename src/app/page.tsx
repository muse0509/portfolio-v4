import { AboutWriting } from "@/components/home/about-writing";
import { AxisFeature } from "@/components/home/axis-feature";
import { Capabilities } from "@/components/home/capabilities";
import { ContactCta } from "@/components/home/contact-cta";
import { EvidenceGrid } from "@/components/home/evidence-grid";
import { Hero } from "@/components/home/hero";
import { Process } from "@/components/home/process";
import { ProofStrip } from "@/components/home/proof-strip";
import { ResponsibilityTimeline } from "@/components/home/responsibility-timeline";
import { SelectedWorks } from "@/components/home/selected-works";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";
import { siteContent } from "@/content/site";

export default function Home() {
  return (
    <div id="top" className="site-page">
      <SiteHeader
        homeHref={siteContent.routes.home}
        identity={siteContent.identity}
        navigation={siteContent.navigation}
      />
      <main id="main-content">
        <Hero />
        <ProofStrip />
        <AxisFeature />
        <EvidenceGrid />
        <ResponsibilityTimeline />
        <SelectedWorks />
        <Capabilities />
        <Process />
        <AboutWriting />
        <ContactCta />
      </main>
      <SiteFooter />
    </div>
  );
}
