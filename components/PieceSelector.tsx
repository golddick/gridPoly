"use client";

export const PIECE_OPTIONS: { id: string; color: string; label: string }[] = [
  { id: "cone-gold", color: "#F0B94A", label: "Gold" },
  { id: "cone-emerald", color: "#12A66A", label: "Emerald" },
  { id: "cone-purple", color: "#4A2E6B", label: "Purple" },
  { id: "cone-red", color: "#C13A3A", label: "Red" },
  { id: "cone-teal", color: "#5AA9E6", label: "Teal" },
  { id: "cone-pink", color: "#E8C9F0", label: "Pink" },
  { id: "cone-blue", color: "#8FB8AD", label: "Sage" },
  { id: "cone-orange", color: "#E67E5A", label: "Orange" },
];

export function pieceColor(pieceId: string): string {
  return PIECE_OPTIONS.find((p) => p.id === pieceId)?.color ?? "#F0B94A";
}

export default function PieceSelector({
  selectedPieceId,
  takenPieceIds,
  onSelect,
}: {
  selectedPieceId: string | null;
  takenPieceIds: string[];
  onSelect: (pieceId: string) => void;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-cream/50">Choose your piece</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {PIECE_OPTIONS.map((p) => {
          const taken = takenPieceIds.includes(p.id) && p.id !== selectedPieceId;
          const selected = p.id === selectedPieceId;
          return (
            <button
              key={p.id}
              type="button"
              disabled={taken}
              onClick={() => onSelect(p.id)}
              title={p.label}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition ${
                selected ? "border-gold bg-gold/10" : "border-white/10 hover:border-white/25"
              } ${taken ? "cursor-not-allowed opacity-30" : ""}`}
            >
              <span
                className="h-5 w-5 rounded-full"
                style={{ backgroundColor: p.color, boxShadow: selected ? `0 0 0 2px #D4AF37` : undefined }}
              />
              <span className="text-[10px] text-cream/60">{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
