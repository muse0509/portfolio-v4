import { siteContent } from "@/content/site";

import { Reveal } from "./reveal";

export function EvidenceGrid() {
  const { evidence } = siteContent;

  return (
    <section
      id="axis-evidence"
      className="evidence section-band"
      aria-labelledby="evidence-heading"
      data-section="evidence"
    >
      <div className="page-shell">
        <Reveal>
          <p className="eyebrow evidence__label">{evidence.label}</p>
          <h2 id="evidence-heading" className="sr-only">
            {evidence.heading}
          </h2>
          <div className="evidence__grid">
            {evidence.items.map((item) => (
              <article className="evidence__item" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
