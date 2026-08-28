import {
  capabilityIndexHeader,
  coreTechnologies,
  extendedTechnologyCategories,
} from "@/content/capability-index";
import { TechIcon } from "@/components/ui/tech-icon";

import { Reveal } from "./reveal";

export function Capabilities() {
  return (
    <section
      className="capabilities section-band"
      aria-labelledby="capabilities-heading"
      data-section="capabilities"
    >
      <div className="page-shell">
        <header className="capabilities__header">
          <p className="capabilities__eyebrow">{capabilityIndexHeader.eyebrow}</p>
          <h2
            id="capabilities-heading"
            className="section-heading capabilities__heading"
          >
            {capabilityIndexHeader.heading}
          </h2>
          <div className="capabilities__introduction">
            <p>{capabilityIndexHeader.description}</p>
            <p className="capabilities__note">{capabilityIndexHeader.note}</p>
          </div>
        </header>

        <Reveal>
          <section
            className="capability-core"
            aria-labelledby="capability-core-heading"
          >
            <h3
              id="capability-core-heading"
              className="capability-index__label"
            >
              CORE STACK
            </h3>
            <ul className="capability-core__grid">
              {coreTechnologies.map((technology) => (
                <li className="capability-core__item" key={technology.name}>
                  <span
                    aria-hidden="true"
                    className="capability-core__icon-slot"
                    data-has-icon={technology.icon ? "true" : "false"}
                  >
                    {technology.icon ? (
                      <TechIcon
                        className="capability-core__icon"
                        icon={technology.icon}
                      />
                    ) : null}
                  </span>
                  <span className="capability-core__name">{technology.name}</span>
                  <span className="capability-core__duration">
                    {technology.duration}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="capability-extended"
            aria-labelledby="capability-extended-heading"
          >
            <h3
              id="capability-extended-heading"
              className="capability-index__label"
            >
              EXTENDED STACK
            </h3>
            <div className="capability-extended__categories">
              {extendedTechnologyCategories.map((category) => (
                <section
                  className="capability-category"
                  aria-labelledby={`capability-category-${category.id}`}
                  key={category.id}
                >
                  <h4 id={`capability-category-${category.id}`}>
                    {category.label}
                  </h4>
                  <ul>
                    {category.technologies.map((technology) => (
                      <li className="capability-tech" key={technology.name}>
                        <span
                          className="capability-tech__identity"
                          data-has-icon={technology.icon ? "true" : "false"}
                        >
                          <span
                            aria-hidden="true"
                            className="capability-tech__icon-slot"
                            data-has-icon={technology.icon ? "true" : "false"}
                          >
                            {technology.icon ? (
                              <TechIcon
                                className="capability-tech__icon"
                                icon={technology.icon}
                              />
                            ) : null}
                          </span>
                          <span className="capability-tech__name">
                            {technology.name}
                          </span>
                        </span>
                        <span className="capability-tech__duration">
                          {technology.duration}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        </Reveal>
      </div>
    </section>
  );
}
