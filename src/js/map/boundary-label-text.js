export function buildBoundaryLabelText(props) {
  if (props.neighbourhood == null) return String(props.district ?? "");

  const lines = [String(props.neighbourhood)];
  if (props.number != null) lines.push(String(props.number));
  return lines.join("\n");
}

export function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}
