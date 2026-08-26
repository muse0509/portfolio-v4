import { siteContent } from "@/content/site";

import { ArrowMark } from "./arrow-mark";
import { Reveal } from "./reveal";

export function Capabilities() {
  const { capabilities } = siteContent;

  return (
    <section
      className="capabilities section-band"
      aria-labelledby="capabilities-heading"
      data-section="capabilities"
    >
      <div className="page-shell">
        <h2 id="capabilities-heading" className="eyebrow capabilities__heading">
          {capabilities.heading}
        </h2>
        <Reveal>
          <div className="capabilities__list">
            {capabilities.items.map((item) => (
              <article className="capability-row" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <ArrowMark />
              </article>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
