'use client';

export type Dimension = 'overworld' | 'the_nether' | 'the_end';

interface DimensionSelectorProps {
  currentDimension: Dimension;
  onDimensionChange: (dimension: Dimension) => void;
  playerDimensions?: Map<string, string>; // sessionId -> dimension
}

const DIMENSIONS: { id: Dimension; label: string; color: string; fullId: string }[] = [
  { id: 'overworld', label: 'Overworld', color: 'bg-green-500', fullId: 'minecraft:overworld' },
  { id: 'the_nether', label: 'Nether', color: 'bg-red-500', fullId: 'minecraft:the_nether' },
  { id: 'the_end', label: 'End', color: 'bg-purple-500', fullId: 'minecraft:the_end' },
];

export function DimensionSelector({
  currentDimension,
  onDimensionChange,
  playerDimensions,
}: DimensionSelectorProps) {
  // Count players in each dimension
  const playerCounts = new Map<string, number>();
  if (playerDimensions) {
    for (const dim of playerDimensions.values()) {
      const count = playerCounts.get(dim) || 0;
      playerCounts.set(dim, count + 1);
    }
  }

  return (
    <div className="flex gap-1 bg-slate-800/90 rounded-lg p-1">
      {DIMENSIONS.map((dim) => {
        const isActive = currentDimension === dim.id;
        const playerCount = playerCounts.get(dim.fullId) || 0;

        return (
          <button
            key={dim.id}
            onClick={() => onDimensionChange(dim.id)}
            className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
              isActive
                ? 'bg-slate-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${dim.color}`}></span>
              {dim.label}
            </span>
            {playerCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {playerCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Helper to convert full dimension ID to short form
export function dimensionToShort(fullId: string): Dimension {
  switch (fullId) {
    case 'minecraft:the_nether':
      return 'the_nether';
    case 'minecraft:the_end':
      return 'the_end';
    default:
      return 'overworld';
  }
}

// Helper to convert short form to full dimension ID
export function dimensionToFull(short: Dimension): string {
  switch (short) {
    case 'the_nether':
      return 'minecraft:the_nether';
    case 'the_end':
      return 'minecraft:the_end';
    default:
      return 'minecraft:overworld';
  }
}
