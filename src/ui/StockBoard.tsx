import { useEffect, useState } from "react";
import { RARITY_COLOR, type Rarity } from "../generate";
import type { GiftTopic, StockSlot } from "../stock";

type RemainingTopic = {
  id: GiftTopic;
  label: string;
  icon: string;
  remaining: number;
};

export function StockBoard({
  slots,
  selectedSlotIndex,
  onSelectSlot,
  topicLabel = "Category",
  remainingTopics = [],
  soldOut = false,
  onMoveToTopic,
}: {
  slots: StockSlot[];
  selectedSlotIndex?: number | null;
  onSelectSlot?: (index: number) => void;
  topicLabel?: string;
  remainingTopics?: RemainingTopic[];
  soldOut?: boolean;
  onMoveToTopic?: (topic: GiftTopic) => void;
}) {
  const [filter, setFilter] = useState<Rarity | "all">("all");
  const availableSlots = slots.filter((slot) => !slot.claimed);
  const remaining = availableSlots.length;

  useEffect(() => {
    setFilter("all");
  }, [topicLabel]);

  useEffect(() => {
    if (filter !== "all" && availableSlots.length > 0 && !availableSlots.some((s) => s.product.rarity === filter)) {
      setFilter("all");
    }
  }, [filter, availableSlots]);

  const filteredSlots = filter === "all" ? availableSlots : availableSlots.filter((s) => s.product.rarity === filter);

  return (
    <section className="stock">
      <div className="cabinet-head">
        <div>
          <p className="kicker">{topicLabel} Gifts · Click to target</p>
          <p className="stock-subtitle">Only {topicLabel.toLowerCase()} items shown</p>
        </div>
        <p className="serial">{remaining} left</p>
      </div>

      {remaining > 0 ? (
        <>
          <div className="rarity-filter-row" role="group" aria-label="Filter by rarity">
            {(["all", "common", "rare", "legendary", "impossible"] as const).map((r) => {
              const count = r === "all" ? availableSlots.length : availableSlots.filter((s) => s.product.rarity === r).length;
              if (r !== "all" && count === 0) return null;
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
                      const firstMatch = availableSlots.find((s) => s.product.rarity === r);
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
                  className={`stock-item-row ${isSelected ? "targeted" : ""}`}
                  onClick={() => {
                    if (onSelectSlot) {
                      onSelectSlot(slot.index);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title={`Target ${slot.product.title} for next coin`}
                >
                  <span className="dot" style={{ background: RARITY_COLOR[slot.product.rarity] }} />
                  <div className="stock-item-details">
                    <div className="stock-item-title-line">
                      <strong>
                        <span className="slot-code-badge">{slot.code}</span> {slot.product.title}
                      </strong>
                      {isSelected && <span className="target-pill">Selected</span>}
                    </div>
                    <small>
                      <span className="rarity-label" style={{ color: RARITY_COLOR[slot.product.rarity] }}>
                        {slot.product.rarity}
                      </span>
                      {" · "}
                      {slot.product.traits[0]}
                      {" · ready"}
                    </small>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <div className="stock-empty-prompt" role="status">
          {!soldOut && remainingTopics.length > 0 ? (
            <>
              <p className="stock-empty-title">All {topicLabel} items claimed!</p>
              <p className="stock-empty-sub">Ask the family to move to a remaining category:</p>
              <div className="stock-move-links">
                {remainingTopics.map((rt) => (
                  <button
                    key={rt.id}
                    type="button"
                    className="move-topic-chip"
                    onClick={() => onMoveToTopic?.(rt.id)}
                  >
                    {rt.icon} {rt.label} ({rt.remaining} left) →
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="stock-empty-title">All categories claimed!</p>
              <p className="stock-empty-sub">Come back tomorrow again for a freshly restocked machine.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
