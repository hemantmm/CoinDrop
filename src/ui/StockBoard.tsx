import { useState } from "react";
import { RARITY_COLOR, type Rarity } from "../generate";
import type { StockSlot } from "../stock";

export function StockBoard({
  slots,
  selectedSlotIndex,
  onSelectSlot,
}: {
  slots: StockSlot[];
  selectedSlotIndex?: number | null;
  onSelectSlot?: (index: number) => void;
}) {
  const [filter, setFilter] = useState<Rarity | "all">("all");
  const remaining = slots.filter((slot) => !slot.claimed).length;

  const filteredSlots = filter === "all" ? slots : slots.filter((s) => s.product.rarity === filter);

  return (
    <section className="stock">
      <div className="cabinet-head">
        <div>
          <p className="kicker">Case Gifts · Click to target</p>
          <p className="stock-subtitle">Select any rarity to see unique presentation</p>
        </div>
        <p className="serial">{remaining} left</p>
      </div>

      <div className="rarity-filter-row" role="group" aria-label="Filter by rarity">
        {(["all", "common", "rare", "legendary", "impossible"] as const).map((r) => {
          const count = r === "all" ? slots.length : slots.filter((s) => s.product.rarity === r).length;
          const isActive = filter === r;
          return (
            <button
              key={r}
              type="button"
              className={`rarity-filter-chip ${isActive ? "active" : ""}`}
              style={{
                borderColor: r === "all" ? undefined : RARITY_COLOR[r],
                color: isActive && r !== "all" ? RARITY_COLOR[r] : undefined,
              }}
              onClick={() => {
                setFilter(r);
                if (r !== "all" && onSelectSlot) {
                  const firstMatch = slots.find((s) => s.product.rarity === r && !s.claimed);
                  if (firstMatch) onSelectSlot(firstMatch.index);
                }
              }}
            >
              {r === "all" ? "All" : r.charAt(0).toUpperCase() + r.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      <ol>
        {filteredSlots.map((slot) => {
          const isSelected = selectedSlotIndex === slot.index;
          return (
            <li
              key={slot.product.seed}
              className={`stock-item-row ${slot.claimed ? "taken" : ""} ${isSelected ? "targeted" : ""}`}
              onClick={() => {
                if (!slot.claimed && onSelectSlot) {
                  onSelectSlot(slot.index);
                }
              }}
              role="button"
              tabIndex={0}
              title={slot.claimed ? "Already dispensed" : `Target ${slot.product.title} for next coin`}
            >
              <span className="dot" style={{ background: RARITY_COLOR[slot.product.rarity] }} />
              <div className="stock-item-details">
                <div className="stock-item-title-line">
                  <strong>{slot.product.title}</strong>
                  {isSelected && <span className="target-pill">Targeted</span>}
                </div>
                <small>
                  <span className="rarity-label" style={{ color: RARITY_COLOR[slot.product.rarity] }}>
                    {slot.product.rarity}
                  </span>
                  {" · "}
                  {slot.product.traits[0]}
                  {slot.claimed ? " · taken" : " · ready"}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
