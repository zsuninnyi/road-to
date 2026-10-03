export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) {
    return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 320;
  const height = 72;
  const d = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <figure className="mt-4">
      <figcaption className="text-sm text-muted">{label}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 h-20 w-full text-ink" role="img">
        <title>{label}</title>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </figure>
  );
}
