import { RARITY_COLOR } from "../generate";
import type { StockSlot } from "../stock";

export function StockBoard({ slots }: { slots: StockSlot[] }) {
  const remaining = slots.filter((slot) => !slot.claimed).length;
  return (
    <section className="stock">
      <div className="cabinet-head">
        <p className="kicker">Gifts in the case</p>
        <p className="serial">{remaining} left</p>
      </div>
      <ol>
        {slots.map((slot) => (
          <li key={slot.product.seed} className={slot.claimed ? "taken" : ""}>
            <span className="dot" style={{ background: RARITY_COLOR[slot.product.rarity] }} />
            <span>
              <strong>{slot.product.title}</strong>
              <small>
                {slot.product.traits[0]}
                {slot.claimed ? " · taken" : " · left"}
              </small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
