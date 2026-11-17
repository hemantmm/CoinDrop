import { RARITY_COLOR, TYPE_LABEL } from "../generate";
import type { CabinetItem } from "../cabinet";

export function Cabinet({
  items,
  activeSeed,
  onOpen,
}: {
  items: CabinetItem[];
  activeSeed: string | null;
  onOpen: (seed: string) => void;
}) {
  return (
    <section className="cabinet">
      <div className="cabinet-head">
        <p className="kicker">Cabinet</p>
        <p className="serial">{items.length}</p>
      </div>
      {items.length === 0 ? (
        <p className="empty-copy">Nothing kept yet. A pull stays in this browser.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.seed}>
              <button
                type="button"
                className={item.seed === activeSeed ? "ticket active" : "ticket"}
                onClick={() => onOpen(item.seed)}
              >
                <span className="dot" style={{ background: RARITY_COLOR[item.rarity] }} />
                <span className="ticket-copy">
                  <strong>{item.title}</strong>
                  <small>
                    {TYPE_LABEL[item.type]} · {item.serial}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
