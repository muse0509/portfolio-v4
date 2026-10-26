import type { IconDefinition } from "@fortawesome/free-brands-svg-icons";
import type { SimpleIcon } from "simple-icons";

type TechIconProps = {
  readonly icon: SimpleIcon | IconDefinition;
  readonly className?: string;
};

export function TechIcon({ icon, className }: TechIconProps) {
  const classes = ["tech-icon", className].filter(Boolean).join(" ");
  const isSimpleIcon = "path" in icon;
  const viewBox = isSimpleIcon
    ? "0 0 24 24"
    : `0 0 ${icon.icon[0]} ${icon.icon[1]}`;
  const paths = isSimpleIcon
    ? [icon.path]
    : Array.isArray(icon.icon[4])
      ? icon.icon[4]
      : [icon.icon[4]];

  return (
    <svg
      aria-hidden="true"
      className={classes}
      focusable="false"
      viewBox={viewBox}
    >
      {paths.map((path, index) => (
        <path d={path} fill="currentColor" key={index} />
      ))}
    </svg>
  );
}
