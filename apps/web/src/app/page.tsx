import { AxisFeature } from "@/components/home/axis-feature";
import { Capabilities } from "@/components/home/capabilities";
import { ContactCta } from "@/components/home/contact-cta";
import { Hero } from "@/components/home/hero";
import { ProfileSection } from "@/components/home/profile-section";
import { SiteHeader } from "@/components/home/site-header";
import { GlassFilterDefs } from "@/components/ui/glass-filter-defs";
import { siteContent } from "@/content/site";

export default function Home() {
  return (
    <div id="top" className="site-page">
      <GlassFilterDefs />
      <SiteHeader navigation={siteContent.navigation} />
      <main id="main-content">
        <div className="opening-stage">
          <Hero />
          <AxisFeature />
        </div>
        <Capabilities />
        <ProfileSection />
        <ContactCta />
      </main>
    </div>
  );
}
