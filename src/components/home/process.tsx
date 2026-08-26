import { siteContent } from "@/content/site";

import { Reveal } from "./reveal";

export function Process() {
  const { process } = siteContent;

  return (
    <section
      id="process"
      className="process section-band"
      aria-labelledby="process-heading"
      data-section="process"
    >
      <div className="page-shell">
        <h2 id="process-heading" className="eyebrow process__heading">
          {process.heading}
        </h2>
        <Reveal>
          <ol className="process__list">
            {process.items.map((item) => (
              <li className="process-step" key={item.number}>
                <span aria-hidden="true" className="process-step__marker" />
                <div>
                  <p className="process-step__title">
                    <span>{item.number}</span> {item.title}
                  </p>
                  <p className="process-step__body">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
