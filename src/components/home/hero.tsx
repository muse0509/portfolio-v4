import { siteContent } from "@/content/site";

import { ArrowMark } from "./arrow-mark";
import { Reveal } from "./reveal";

export function Hero() {
  const { hero } = siteContent;

  return (
    <section className="hero" aria-labelledby="hero-heading" data-section="hero">
      <div className="page-shell hero__inner">
        <div className="hero__content">
          <Reveal mode="load" duration={0.8}>
            <p className="eyebrow">{hero.eyebrow}</p>
          </Reveal>

          <h1 id="hero-heading" className="hero__heading" aria-label={hero.headline}>
            {hero.headlineLines.map((line, index) => (
              <Reveal
                className="hero__heading-line"
                delay={0.08 + index * 0.08}
                duration={0.8}
                key={line}
                mode="load"
              >
                <span aria-hidden="true">{line}</span>
              </Reveal>
            ))}
          </h1>

          <Reveal className="hero__copy" delay={0.24} duration={0.8} mode="load">
            <p>{hero.description}</p>
          </Reveal>

          <Reveal className="hero__actions" delay={0.34} duration={0.8} mode="load">
            <a className="primary-action focus-ring" href={hero.primaryAction.href}>
              <span>{hero.primaryAction.label}</span>
              <ArrowMark />
            </a>
            <a
              className="secondary-action focus-ring"
              href={hero.secondaryAction.href}
            >
              <span>{hero.secondaryAction.label}</span>
              <ArrowMark />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
