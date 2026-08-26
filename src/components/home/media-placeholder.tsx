type MediaPlaceholderProps = {
  kind: "axis" | "project" | "portrait";
  label: string;
};

export function MediaPlaceholder({ kind, label }: MediaPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      className={`media-placeholder media-placeholder--${kind}`}
    >
      <span className="media-placeholder__label">{label}</span>
    </div>
  );
}
