import { Button, Input } from '../ui';

// Structured key/value editor for a RoomType's arbitrary `packageDetails`
// JSON field -- deliberately not a raw JSON textarea, per product direction
// (non-technical staff should not have to hand-write JSON). Every value is
// edited as plain text; on save, values are stored as strings rather than
// attempting to preserve the original booleans/arrays a value might have
// held before editing.

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
}

function generatePairId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Math.random());
}

/** Converts an existing packageDetails object into editable key/value pairs. */
// eslint-disable-next-line react-refresh/only-export-components -- small pure helper colocated with the editor it serves, by design
export function recordToPairs(record: Record<string, unknown> | null | undefined): KeyValuePair[] {
  if (!record) return [];
  return Object.entries(record).map(([key, value]) => ({
    id: generatePairId(),
    key,
    value: formatPairValue(value),
  }));
}

function formatPairValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (value === null || value === undefined) return '';
  return JSON.stringify(value);
}

/** Converts editable key/value pairs back into a plain string-valued record, dropping blank keys. */
// eslint-disable-next-line react-refresh/only-export-components -- small pure helper colocated with the editor it serves, by design
export function pairsToRecord(pairs: KeyValuePair[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const pair of pairs) {
    const key = pair.key.trim();
    if (!key) continue;
    record[key] = pair.value;
  }
  return record;
}

// eslint-disable-next-line react-refresh/only-export-components -- small pure helper colocated with the editor it serves, by design
export function createEmptyPair(): KeyValuePair {
  return { id: generatePairId(), key: '', value: '' };
}

export interface PackageDetailsEditorProps {
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
}

export function PackageDetailsEditor({ pairs, onChange }: PackageDetailsEditorProps): JSX.Element {
  function updatePair(id: string, field: 'key' | 'value', value: string): void {
    onChange(pairs.map((pair) => (pair.id === id ? { ...pair, [field]: value } : pair)));
  }

  function removePair(id: string): void {
    onChange(pairs.filter((pair) => pair.id !== id));
  }

  function addPair(): void {
    onChange([...pairs, createEmptyPair()]);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-sm font-medium text-primary-dark">Package Details</p>
      {pairs.length === 0 && (
        <p className="font-sans text-sm text-sage-gray">No package details yet.</p>
      )}
      {pairs.map((pair, index) => (
        <div key={pair.id} className="flex items-end gap-2">
          <Input
            label={index === 0 ? 'Key' : undefined}
            placeholder="e.g. breakfastIncluded"
            value={pair.key}
            onChange={(e) => updatePair(pair.id, 'key', e.target.value)}
            className="flex-1"
          />
          <Input
            label={index === 0 ? 'Value' : undefined}
            placeholder="e.g. Yes"
            value={pair.value}
            onChange={(e) => updatePair(pair.id, 'value', e.target.value)}
            className="flex-1"
          />
          <Button variant="ghost" type="button" onClick={() => removePair(pair.id)}>
            Remove
          </Button>
        </div>
      ))}
      <Button variant="secondary" type="button" onClick={addPair} className="self-start">
        Add Detail
      </Button>
    </div>
  );
}
