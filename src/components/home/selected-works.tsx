import { siteContent } from "@/content/site";

import { MediaPlaceholder } from "./media-placeholder";
import { Reveal } from "./reveal";

export function SelectedWorks() {
  const { selectedWorks } = siteContent;

  return (
    <section
      id="works"
      className="selected-works section-band"
      aria-labelledby="selected-works-heading"
      data-section="works"
    >
      <div className="page-shell">
        <h2 id="selected-works-heading" className="eyebrow selected-works__heading">
          {selectedWorks.heading}
        </h2>

        <div className="selected-works__list">
          {selectedWorks.items.map((work, index) => (
            <Reveal
              className={`work-row${index % 2 === 1 ? " work-row--reverse" : ""}`}
              key={work.number}
            >
              <div className="work-row__copy">
                <div className="work-row__title-line">
                  <span className="work-row__number">{work.number}</span>
                  <h3>{work.title}</h3>
                </div>
                <p className="work-row__description">{work.description}</p>
                <p className="work-row__status">{work.status}</p>
              </div>
              <div className="work-row__media">
                <MediaPlaceholder kind="project" label={work.mediaLabel} />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
