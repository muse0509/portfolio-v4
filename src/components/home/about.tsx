import { siteContent } from "@/content/site";

import { Reveal } from "./reveal";

export function About() {
  const { about } = siteContent;

  return (
    <section
      id="about"
      className="about section-band"
      aria-labelledby="about-heading"
      data-section="about"
    >
      <div className="page-shell about__inner">
        <h2 id="about-heading" className="section-heading">
          {about.heading}
        </h2>
        <Reveal className="about__content">
          <div>
            <p className="about__name">{about.name}</p>
            <p className="about__role">{about.role}</p>
          </div>
          <p className="about__description">{about.description}</p>
        </Reveal>
      </div>
    </section>
  );
}
