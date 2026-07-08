// Renders a RoomType's arbitrary `packageDetails` JSON as a readable
// definition list instead of dumping raw JSON. Seed data shapes this as a
// flat object of amenity arrays/booleans (see database/seed.sql), but this
// stays defensive for any other JSON shape an admin might later save.

export interface PackageDetailsListProps {
  details: Record<string, unknown>;
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join(', ');
  if (value === null || value === undefined) return String.fromCharCode(8212); // em dash
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function PackageDetailsList({ details }: PackageDetailsListProps): JSX.Element {
  const entries = Object.entries(details);

  if (entries.length === 0) {
    return (
      <p className="font-sans text-sm text-sage-gray">No additional details for this room type.</p>
    );
  }

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="font-sans text-xs font-medium uppercase tracking-wide text-sage-gray">
            {formatLabel(key)}
          </dt>
          <dd className="mt-0.5 font-sans text-sm text-primary-dark">{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
