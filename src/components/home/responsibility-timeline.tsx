import { siteContent } from "@/content/site";

import { Reveal } from "./reveal";

export function ResponsibilityTimeline() {
  const { responsibility } = siteContent;

  return (
    <section
      className="responsibility section-band"
      aria-labelledby="responsibility-heading"
      data-section="timeline"
    >
      <div className="page-shell">
        <h2 id="responsibility-heading" className="sr-only">
          {responsibility.heading}
        </h2>
        <Reveal>
          <ol className="responsibility__list">
            {responsibility.stages.map((stage) => (
              <li className="responsibility__item" key={stage}>
                <span aria-hidden="true" className="responsibility__marker" />
                <span>{stage}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
