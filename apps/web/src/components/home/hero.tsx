import Image from "next/image";

import { siteContent } from "@/content/site";
import { LiquidGlassLink } from "@/components/ui/liquid-glass-link";

import { ArrowMark } from "./arrow-mark";
import { Reveal } from "./reveal";

export function Hero() {
  const { hero } = siteContent;

  return (
    <section className="hero" aria-labelledby="hero-heading" data-section="hero">
      <div className="hero__backdrop" aria-hidden="true">
        <Image
          alt=""
          className="hero__background-image"
          fill
          preload
          sizes="100vw"
          src="/images/hero/hero-yusuke-kikuta.png"
        />
        <span className="hero__background-scrim" />
      </div>

      <div className="page-shell hero__inner">
        <div className="hero__content">
          <h1 id="hero-heading" className="hero__heading" aria-label={hero.headline}>
            <span className="hero__heading-set hero__heading-set--desktop">
              {hero.headlineLines.map((line, index) => (
                <Reveal
                  className="hero__heading-line"
                  delay={index * 0.07}
                  duration={0.66}
                  key={line}
                  mode="load"
                >
                  <span aria-hidden="true">{line}</span>
                </Reveal>
              ))}
            </span>
            <span className="hero__heading-set hero__heading-set--mobile">
              {hero.headlineLinesMobile.map((line, index) => (
                <Reveal
                  className="hero__heading-line"
                  delay={index * 0.06}
                  duration={0.64}
                  key={line}
                  mode="load"
                >
                  <span aria-hidden="true">{line}</span>
                </Reveal>
              ))}
            </span>
          </h1>

          <Reveal className="hero__copy" delay={0.2} duration={0.62} mode="load">
            <p>
              <span className="hero__copy-sentence">
                {hero.description.lead}
                <span className="hero__copy-focus">
                  {hero.description.focus}
                </span>
                {hero.description.suffix}
              </span>
              <span className="hero__copy-sentence">
                {hero.description.closing}
              </span>
            </p>
          </Reveal>

          <Reveal className="hero__actions" delay={0.28} duration={0.62} mode="load">
            <LiquidGlassLink
              href={hero.primaryAction.href}
              label={hero.primaryAction.label}
              variant="hero"
            />
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
