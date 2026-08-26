import { siteContent } from "@/content/site";

import { MediaPlaceholder } from "./media-placeholder";
import { Reveal } from "./reveal";

export function AboutWriting() {
  const { about, writing } = siteContent;

  return (
    <section
      id="about"
      className="about-writing section-band"
      aria-labelledby="about-writing-heading"
      data-section="about-writing"
    >
      <h2 id="about-writing-heading" className="sr-only">
        About / Writing
      </h2>
      <div className="page-shell about-writing__grid">
        <Reveal className="about-panel">
          <h3 className="eyebrow">{about.heading}</h3>
          <MediaPlaceholder kind="portrait" label={about.mediaLabel} />
          <div className="about-panel__copy">
            <p className="about-panel__name">{about.name}</p>
            <p className="about-panel__role">{about.role}</p>
            <p className="about-panel__description">{about.description}</p>
          </div>
        </Reveal>

        <Reveal className="writing-panel">
          <h3 className="eyebrow">{writing.heading}</h3>
          <p className="writing-panel__description">{writing.description}</p>
          <div className="writing-panel__list">
            {writing.items.map((item) => (
              <article className="writing-row" key={item.title}>
                <h4>{item.title}</h4>
                <p>{item.status}</p>
                <span aria-hidden="true">↘</span>
              </article>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
