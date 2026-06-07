// Shows the official German "Anlage" form name next to an English section title,
// so users can cross-reference with ELSTER and the paper forms.
export function AnlageBadge({ name }: { name: string }) {
  return <span className="anlage-badge">{name}</span>;
}
