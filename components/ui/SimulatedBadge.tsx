export default function SimulatedBadge({
  source = "DEMO",
  simulated,
}: {
  source?: string;
  simulated?: boolean;
}) {
  return (
    <span
      className="simulated-badge"
      title="This data is generated or simulated for demonstration purposes and does not represent real-time exchange orders."
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        padding: "1px 5px",
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "0.05em",
        color: "#0a0a0a",
        background: "#e0a835",
        borderRadius: "2px",
        marginLeft: "6px",
      }}
    >
      ⚠ {source.toUpperCase()}
    </span>
  );
}
