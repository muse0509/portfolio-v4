import { siteContent } from "@/content/site";

import { MediaPlaceholder } from "./media-placeholder";
import { Reveal } from "./reveal";

export function AxisFeature() {
  const { axis } = siteContent;

  return (
    <section
      id="axis"
      className="axis-feature section-band"
      aria-labelledby="axis-heading"
      data-section="axis"
    >
      <div className="page-shell">
        <Reveal className="axis-feature__header">
          <div>
            <p className="eyebrow">{axis.eyebrow}</p>
            <h2 id="axis-heading" className="section-title">
              {axis.title}
            </h2>
          </div>
          <div className="axis-feature__summary">
            <p>{axis.description}</p>
            <p className="axis-feature__disclaimer">{axis.disclaimer}</p>
          </div>
        </Reveal>

        <Reveal className="axis-stage">
          <MediaPlaceholder kind="axis" label={axis.mediaLabel} />
        </Reveal>
      </div>
    </section>
  );
}
