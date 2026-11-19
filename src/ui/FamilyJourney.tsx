import { useEffect, useRef, useState } from "react";
import {
  playCarLock,
  playElevatorDing,
  playEngineStart,
  playMallFanfare,
  playNavChime,
  playParkingBeep,
  unlockAudio,
} from "../audio";

type Props = {
  onComplete: () => void;
};

type JourneyStage = "auto_trip" | "parking_bay" | "mall_walkthrough";

export function FamilyJourney({ onComplete }: Props) {
  const [stage, setStage] = useState<JourneyStage>("auto_trip");
  const [autoStep, setAutoStep] = useState(0);

  const [carProgress, setCarProgress] = useState(0.12);
  const [radioPlaying, setRadioPlaying] = useState(true);

  const [mallStep, setMallStep] = useState<0 | 1 | 2 | 3>(0);

  const [liftFloor, setLiftFloor] = useState<"P2" | "L1" | "L2">("P2");
  const [liftDoorOpen, setLiftDoorOpen] = useState(false);

  const [atriumWalkProgress, setAtriumWalkProgress] = useState(0);

  const timersRef = useRef<number[]>([]);
  const clearAllTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const addTimer = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  useEffect(() => {
    if (stage !== "auto_trip") return;

    addTimer(() => setAutoStep(1), 1100);

    addTimer(() => {
      setAutoStep(2);
      unlockAudio();
      playEngineStart();
    }, 2400);

    addTimer(() => setAutoStep(3), 3600);

    addTimer(() => {
      setAutoStep(4);
      unlockAudio();
      playNavChime();
    }, 4600);

    return () => clearAllTimers();
  }, [stage]);

  useEffect(() => {
    if (stage !== "auto_trip" || autoStep !== 4) return;

    const interval = window.setInterval(() => {
      setCarProgress((prev) => {
        if (prev >= 0.96) {
          window.clearInterval(interval);
          addTimer(() => {
            unlockAudio();
            playParkingBeep();
            setStage("parking_bay");
          }, 500);
          return 0.96;
        }
        return prev + 0.024;
      });
    }, 110);

    return () => {
      window.clearInterval(interval);
      clearAllTimers();
    };
  }, [stage, autoStep]);

  const handleFastForwardToParking = () => {
    clearAllTimers();
    unlockAudio();
    playParkingBeep();
    setStage("parking_bay");
  };

  const handleParkAndEnterMall = () => {
    clearAllTimers();
    unlockAudio();
    playCarLock();
    setStage("mall_walkthrough");
    setMallStep(0);

    addTimer(() => {
      setMallStep(1);
      let p = 0;
      const walkInterval = window.setInterval(() => {
        p += 5;
        if (p >= 100) {
          p = 100;
          window.clearInterval(walkInterval);
        }
        setAtriumWalkProgress(p);
      }, 160);
    }, 3200);

    addTimer(() => {
      setMallStep(2);
      setLiftFloor("P2");
      setLiftDoorOpen(false);

      addTimer(() => setLiftFloor("L1"), 1600);
      addTimer(() => {
        setLiftFloor("L2");
        unlockAudio();
        playElevatorDing();
        setLiftDoorOpen(true);
      }, 3400);

      addTimer(() => {
        setMallStep(3);
      }, 5000);
    }, 7200);
  };

  const handleFastForwardToPlayArea = () => {
    clearAllTimers();
    setStage("mall_walkthrough");
    setMallStep(3);
    setLiftFloor("L2");
    setLiftDoorOpen(true);
  };

  const handleStepToMachine = () => {
    unlockAudio();
    playMallFanfare();
    onComplete();
  };

  return (
    <div className="journey-modal" role="dialog" aria-modal="true" aria-label="Family Journey to the Mall">
      <div className="journey-backdrop" onClick={onComplete} />

      <div className="journey-shell">
        <header className="journey-top">
          <div className="journey-breadcrumbs">
            <span className={stage === "auto_trip" && autoStep < 4 ? "crumb active" : "crumb done"}>
              1. Leaving Home
            </span>
            <span className="crumb-arrow">›</span>
            <span className={stage === "auto_trip" && autoStep >= 4 ? "crumb active" : stage === "auto_trip" ? "crumb" : "crumb done"}>
              2. Road & GPS
            </span>
            <span className="crumb-arrow">›</span>
            <span className={stage === "parking_bay" ? "crumb active" : stage === "mall_walkthrough" ? "crumb done" : "crumb"}>
              3. Parking Bay P2-23
            </span>
            <span className="crumb-arrow">›</span>
            <span className={stage === "mall_walkthrough" && (mallStep === 0 || mallStep === 1) ? "crumb active" : stage === "mall_walkthrough" && mallStep >= 2 ? "crumb done" : "crumb"}>
              4. Entering Mall
            </span>
            <span className="crumb-arrow">›</span>
            <span className={stage === "mall_walkthrough" && mallStep === 2 ? "crumb active" : stage === "mall_walkthrough" && mallStep === 3 ? "crumb done" : "crumb"}>
              5. Glass Lift
            </span>
            <span className="crumb-arrow">›</span>
            <span className={stage === "mall_walkthrough" && mallStep === 3 ? "crumb active" : "crumb"}>
              6. Play Area & Machine
            </span>
          </div>

          <button
            type="button"
            className="journey-skip-btn"
            onClick={onComplete}
            title="Jump directly to the 3D Vending Machine"
          >
            Skip to Game ⚡
          </button>
        </header>

        {stage === "auto_trip" && (
          <div className="journey-content scene-auto">
            <div className="auto-narrative-banner">
              <div className="banner-left">
                <span className="auto-pulse-dot" />
                <strong>AUTOMATIC CINEMATIC JOURNEY IN PROGRESS</strong>
              </div>
              <div className="banner-right">
                <button
                  type="button"
                  className="ff-link-btn"
                  onClick={handleFastForwardToParking}
                  title="Fast-forward directly to mall parking"
                >
                  Fast-Forward to Parking Bay 🅿️ ⏩
                </button>
              </div>
            </div>

            <div className="auto-timeline-bar">
              <div
                className="timeline-fill"
                style={{
                  width: `${
                    autoStep < 4
                      ? Math.round((autoStep / 4) * 35)
                      : Math.min(100, Math.round(35 + (carProgress / 0.96) * 65))
                  }%`,
                }}
              />
            </div>

            {autoStep < 4 ? (
              <div className="home-scene-wrapper">
                <div className="scene-badge">
                  🏡 7:15 PM · Oak Street Home
                  <span className="auto-pill">Leaving House & Boarding Car</span>
                </div>
                <h2>Coming Out of the House & Sitting in the Car</h2>
                <p className="scene-lead">
                  {autoStep === 0 && "The front door opens with warm golden light spilling onto the porch..."}
                  {autoStep === 1 && "Dad, Maya, and Leo walk out along the stone pathway to the car in the driveway..."}
                  {autoStep === 2 && "The car unlocks with a chime! Maya and Leo climb in back, Dad takes the driver seat."}
                  {autoStep >= 3 && "Doors close, headlights beam on! The electric motor powers up as the car rolls out..."}
                </p>

                <div className="home-visual-canvas">
                  <svg className="home-svg" viewBox="0 0 780 290">
                    <defs>
                      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#050a18" />
                        <stop offset="100%" stopColor="#0c162e" />
                      </linearGradient>
                      <linearGradient id="headlightBeam" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(0, 245, 255, 0.85)" />
                        <stop offset="100%" stopColor="rgba(0, 245, 255, 0)" />
                      </linearGradient>
                      <filter id="glowLight">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    <rect x="0" y="0" width="780" height="290" fill="url(#skyGrad)" />
                    <circle cx="90" cy="40" r="1.5" fill="#ffffff" opacity="0.8" />
                    <circle cx="210" cy="25" r="1.2" fill="#ffffff" opacity="0.6" />
                    <circle cx="340" cy="50" r="1.5" fill="#ffffff" opacity="0.9" />
                    <circle cx="500" cy="30" r="1.2" fill="#ffffff" opacity="0.7" />
                    <circle cx="680" cy="45" r="1.8" fill="#ffffff" opacity="0.8" />
                    <path d="M 700,30 A 14,14 0 0,0 688,16 A 12,12 0 1,1 700,30" fill="#fef08a" opacity="0.9" />

                    <rect x="0" y="215" width="780" height="75" fill="#061a10" />
                    <polygon points="380,290 460,215 780,215 780,290" fill="#1e2430" />

                    <g className="house-building" transform="translate(60, 70)">
                      <rect x="0" y="40" width="300" height="115" fill="#1b2438" stroke="#2d3b55" strokeWidth="2" />
                      <polygon points="-20,40 150,-18 320,40" fill="#0f172a" stroke="#334155" strokeWidth="2" />
                      <rect x="250" y="0" width="24" height="40" fill="#1e293b" />
                      <rect x="35" y="55" width="50" height="38" rx="3" fill="#fde047" opacity="0.85" filter="url(#glowLight)" />
                      <line x1="60" y1="55" x2="60" y2="93" stroke="#1b2438" strokeWidth="2" />
                      <line x1="35" y1="74" x2="85" y2="74" stroke="#1b2438" strokeWidth="2" />
                      <rect x="210" y="55" width="50" height="38" rx="3" fill="#fde047" opacity="0.85" filter="url(#glowLight)" />
                      <line x1="235" y1="55" x2="235" y2="93" stroke="#1b2438" strokeWidth="2" />
                      <line x1="210" y1="74" x2="260" y2="74" stroke="#1b2438" strokeWidth="2" />
                      <rect x="125" y="90" width="55" height="65" fill="#fef08a" stroke="#3b82f6" strokeWidth="1.5" />
                      <polygon points="125,90 180,90 220,155 85,155" fill="rgba(254, 240, 138, 0.35)" />
                      <circle cx="115" cy="98" r="5" fill="#fde047" filter="url(#glowLight)" />
                      <line x1="115" y1="92" x2="115" y2="98" stroke="#64748b" strokeWidth="2" />
                    </g>

                    <path d="M 210,225 Q 300,230 400,245 T 510,250" fill="none" stroke="#334155" strokeWidth="14" strokeDasharray="20 10" />

                    <g
                      className="driveway-car"
                      transform={autoStep >= 3 ? "translate(580, 180)" : "translate(510, 180)"}
                      style={{ transition: "transform 1.1s cubic-bezier(0.4, 0, 0.2, 1)" }}
                    >
                      {autoStep >= 2 && (
                        <polygon points="175,45 175,55 390,80 390,20" fill="url(#headlightBeam)" />
                      )}
                      <path
                        d="M 10,50 L 30,30 Q 60,18 120,18 Q 160,20 180,42 L 195,50 Q 200,55 195,64 L 15,64 Q 10,58 10,50 Z"
                        fill="#0f172a"
                        stroke="#00f5ff"
                        strokeWidth="2.5"
                      />
                      <path d="M 40,30 L 65,22 L 115,22 L 115,44 L 35,44 Z" fill="#38bdf8" opacity="0.6" />
                      <path d="M 122,22 L 158,26 L 172,44 L 122,44 Z" fill="#38bdf8" opacity="0.6" />
                      <circle cx="50" cy="64" r="14" fill="#020617" stroke="#475569" strokeWidth="4" />
                      <circle cx="155" cy="64" r="14" fill="#020617" stroke="#475569" strokeWidth="4" />
                      <circle cx="50" cy="64" r="5" fill="#00f5ff" />
                      <circle cx="155" cy="64" r="5" fill="#00f5ff" />
                      <circle
                        cx="192"
                        cy="48"
                        r="5"
                        fill={autoStep >= 2 ? "#00f5ff" : "#64748b"}
                        filter={autoStep >= 2 ? "url(#glowLight)" : undefined}
                      />
                      {autoStep >= 2 && (
                        <g opacity="0.95">
                          <circle cx="75" cy="30" r="5" fill="#facc15" />
                          <circle cx="135" cy="31" r="4.2" fill="#ff85a1" />
                          <circle cx="150" cy="32" r="3.8" fill="#38bdf8" />
                        </g>
                      )}
                    </g>

                    {autoStep === 1 && (
                      <g className="walking-family-group">
                        <g transform="translate(340, 195)" className="animated-walking-actor">
                          <circle cx="0" cy="-22" r="6.5" fill="#e2b186" />
                          <rect x="-4" y="-16" width="8" height="18" rx="2" fill="#1e293b" />
                          <line x1="-3" y1="2" x2="-6" y2="16" stroke="#0f172a" strokeWidth="3" className="animated-leg-left" />
                          <line x1="3" y1="2" x2="6" y2="16" stroke="#0f172a" strokeWidth="3" className="animated-leg-right" />
                        </g>
                        <g transform="translate(368, 201)" className="animated-walking-actor">
                          <circle cx="0" cy="-16" r="5.5" fill="#e2b186" />
                          <circle cx="-5" cy="-17" r="2.5" fill="#713f12" />
                          <rect x="-4" y="-11" width="8" height="15" rx="2" fill="#ff85a1" />
                          <circle cx="6" cy="-2" r="3" fill="#ffd700" filter="url(#glowLight)" />
                          <line x1="-2" y1="3" x2="-4" y2="14" stroke="#0f172a" strokeWidth="2.5" className="animated-leg-left" />
                          <line x1="2" y1="3" x2="5" y2="14" stroke="#0f172a" strokeWidth="2.5" className="animated-leg-right" />
                        </g>
                        <g transform="translate(395, 198)" className="animated-walking-actor">
                          <circle cx="0" cy="-14" r="5" fill="#e2b186" />
                          <rect x="-4" y="-17" width="8" height="3" fill="#38bdf8" />
                          <rect x="-3" y="-9.5" width="6" height="12" rx="2" fill="#38bdf8" />
                          <line x1="-2" y1="2.5" x2="-5" y2="13" stroke="#0f172a" strokeWidth="2.5" className="animated-leg-left" />
                          <line x1="2" y1="2.5" x2="5" y2="13" stroke="#0f172a" strokeWidth="2.5" className="animated-leg-right" />
                        </g>
                      </g>
                    )}
                  </svg>
                </div>

                <div className="journey-dialogue-card mini">
                  <div className="dialogue-row girl">
                    <span className="avatar">👧</span>
                    <div><strong>Maya:</strong> “Got our lucky coins! Leo, buckle in!”</div>
                  </div>
                  <div className="dialogue-row boy">
                    <span className="avatar">👦</span>
                    <div><strong>Leo:</strong> “All buckled! Let’s head to Starlight Mall!”</div>
                  </div>
                  <div className="dialogue-row parent">
                    <span className="avatar">🧔</span>
                    <div><strong>Dad:</strong> “Car started, GPS locked. Driving to the mall!”</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="road-scene-wrapper">
                <div className="scene-badge">
                  🚘 7:22 PM · Expressway 101
                  <span className="auto-pill">Highway Drive with Live GPS</span>
                </div>
                <h2>Cruising on the Highway to Starlight Mall</h2>

                <div className="road-scenic-canvas">
                  <svg className="road-svg" viewBox="0 0 780 145">
                    <defs>
                      <linearGradient id="mallGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#bf5af2" />
                        <stop offset="100%" stopColor="#00f5ff" />
                      </linearGradient>
                    </defs>

                    <rect x="0" y="0" width="780" height="145" fill="#040816" />
                    <polygon points="40,90 40,55 70,55 70,90" fill="#0c162e" />
                    <polygon points="90,90 90,40 130,40 130,90" fill="#0f1c3a" />
                    <polygon points="160,90 160,45 190,45 190,90" fill="#0c162e" />
                    <polygon points="210,90 210,30 250,30 250,90" fill="#142347" />

                    <g className="distant-mall" transform="translate(600, 38)">
                      <ellipse cx="70" cy="48" rx="65" ry="40" fill="rgba(191, 90, 242, 0.25)" />
                      <ellipse cx="70" cy="48" rx="50" ry="30" fill="#120826" stroke="url(#mallGlow)" strokeWidth="3" />
                      <line x1="70" y1="18" x2="70" y2="2" stroke="#00f5ff" strokeWidth="2.5" />
                      <circle cx="70" cy="2" r="3.5" fill="#00f5ff" />
                      <text x="70" y="52" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="var(--mono)">
                        STARLIGHT MALL
                      </text>
                    </g>

                    <rect x="0" y="90" width="780" height="55" fill="#111827" />
                    <line x1="0" y1="118" x2="780" y2="118" stroke="#facc15" strokeWidth="3" strokeDasharray="24 16" className="animated-road-stripes" />

                    <g className="driving-car-actor" transform="translate(220, 80)">
                      <polygon points="135,28 135,36 340,52 340,12" fill="url(#headlightBeam)" opacity="0.7" />
                      <path
                        d="M 10,34 L 28,18 Q 55,10 100,10 Q 130,12 145,28 L 158,34 Q 162,38 158,45 L 12,45 Z"
                        fill="#0a101f"
                        stroke="#00f5ff"
                        strokeWidth="2"
                      />
                      <circle cx="40" cy="45" r="9" fill="#020617" stroke="#475569" strokeWidth="3" />
                      <circle cx="125" cy="45" r="9" fill="#020617" stroke="#475569" strokeWidth="3" />
                      <circle cx="40" cy="45" r="3" fill="#00f5ff" />
                      <circle cx="125" cy="45" r="3" fill="#00f5ff" />
                      <circle cx="65" cy="20" r="4" fill="#facc15" />
                      <circle cx="105" cy="20" r="3.2" fill="#ff85a1" />
                    </g>
                  </svg>
                </div>

                <div className="car-dashboard">
                  <div className="dash-statusbar">
                    <div className="dash-left">
                      <span className="dash-time">7:25 PM</span>
                      <span className="dash-temp">70°F · Air Auto</span>
                    </div>
                    <div className="dash-brand">
                      <span className="brand-dot" /> EV NAVIGATION SYSTEM · REAL-TIME GPS
                    </div>
                    <div className="dash-right">
                      <span className="dash-stat">📶 5G Connected</span>
                      <span className="dash-battery">🔋 82% · 260 mi</span>
                    </div>
                  </div>

                  <div className="dash-turn-banner">
                    <div className="turn-icon">↱</div>
                    <div className="turn-info">
                      <strong>Approaching Starlight Mall Underground Parking Entrance</strong>
                      <small>Ramp leads directly to Underground Level P2</small>
                    </div>
                    <div className="dash-speed-badge">
                      <span className="speed-num">55</span>
                      <span className="speed-unit">MPH</span>
                    </div>
                  </div>

                  <div className="gps-map-container">
                    <svg className="gps-map-svg" viewBox="0 0 720 210">
                      <defs>
                        <linearGradient id="routeGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#00f5ff" />
                          <stop offset="60%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#00ff88" />
                        </linearGradient>
                      </defs>

                      <g className="map-grid" opacity="0.12">
                        <line x1="0" y1="35" x2="720" y2="35" stroke="#00f5ff" strokeWidth="1" strokeDasharray="4 6" />
                        <line x1="0" y1="90" x2="720" y2="90" stroke="#00f5ff" strokeWidth="1" strokeDasharray="4 6" />
                        <line x1="0" y1="150" x2="720" y2="150" stroke="#00f5ff" strokeWidth="1" strokeDasharray="4 6" />
                        <line x1="120" y1="0" x2="120" y2="210" stroke="#00f5ff" strokeWidth="1" strokeDasharray="4 6" />
                        <line x1="360" y1="0" x2="360" y2="210" stroke="#00f5ff" strokeWidth="1" strokeDasharray="4 6" />
                        <line x1="560" y1="0" x2="560" y2="210" stroke="#00f5ff" strokeWidth="1" strokeDasharray="4 6" />
                      </g>

                      <path
                        d="M 60,155 C 160,155 220,85 330,85 C 440,85 500,135 580,120 C 620,110 655,85 675,60"
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth="15"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 60,155 C 160,155 220,85 330,85 C 440,85 500,135 580,120 C 620,110 655,85 675,60"
                        fill="none"
                        stroke="url(#routeGradient2)"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />

                      <g transform="translate(60, 155)">
                        <circle r="14" fill="#00f5ff" opacity="0.25" />
                        <circle r="7" fill="#00f5ff" />
                        <text x="0" y="22" textAnchor="middle" fill="#9ab8c8" fontSize="11" fontFamily="var(--mono)">Home</text>
                      </g>

                      <g transform="translate(675, 60)">
                        <circle r="22" fill="#00ff88" opacity="0.3" className="ping-ring" />
                        <circle r="8" fill="#00ff88" />
                        <text x="0" y="-16" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="11" fontFamily="var(--mono)">
                          STARLIGHT MALL
                        </text>
                      </g>

                      {(() => {
                        const p = carProgress;
                        const cx = 60 + p * (675 - 60);
                        const cy = 155 - Math.sin(p * Math.PI) * 65 - (p > 0.6 ? (p - 0.6) * 90 : 0);
                        return (
                          <g transform={`translate(${cx}, ${cy})`}>
                            <circle r="15" fill="#00f5ff" opacity="0.35" className="car-radar" />
                            <circle r="9" fill="#030712" stroke="#00f5ff" strokeWidth="2.5" />
                            <polygon points="0,-6 5,4 -5,4" fill="#00f5ff" transform="rotate(40)" />
                          </g>
                        );
                      })()}
                    </svg>

                    <div className="dash-radio-bar">
                      <span className="radio-icon">📻</span>
                      <span className="radio-track">Playing: “Arcade Adventure Road Trip”</span>
                      <button type="button" className="radio-toggle" onClick={() => setRadioPlaying(!radioPlaying)}>
                        {radioPlaying ? "🔊 Audio On" : "🔈 Muted"}
                      </button>
                    </div>
                  </div>

                  <div className="car-kids-chatter">
                    <div className="chatter-bubble girl">
                      <span className="tag">👧 Maya:</span>
                      <p>“Look Leo! The giant mall dome is right ahead glowing in rainbow colors!”</p>
                    </div>
                    <div className="chatter-bubble boy">
                      <span className="tag">👦 Leo:</span>
                      <p>“We’re taking the parking ramp right now! I see the Level P2 sign!”</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {stage === "parking_bay" && (
          <div className="journey-content scene-parking">
            <div className="scene-badge">
              🅿️ 7:31 PM · Underground Level P2
              <span className="sensor-active-pill">Sensor Guidance Active</span>
            </div>
            <h2>Arrived at Parking Bay P2-23</h2>
            <p className="scene-lead">
              The car glides down into Underground Level P2. Ultrasonic parking sensors detect vacant <strong>Bay P2-23</strong> directly next to the mall lobby entrance doors.
            </p>

            <div className="parking-visual-canvas">
              <svg className="parking-svg" viewBox="0 0 780 250">
                <defs>
                  <linearGradient id="garageFloor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#111827" />
                    <stop offset="100%" stopColor="#080c14" />
                  </linearGradient>
                  <linearGradient id="mallDoorGlow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(254, 240, 138, 0.4)" />
                    <stop offset="100%" stopColor="rgba(56, 189, 248, 0.5)" />
                  </linearGradient>
                </defs>

                <rect x="0" y="0" width="780" height="70" fill="#0f172a" />
                <rect x="0" y="65" width="780" height="10" fill="#1e293b" />
                <line x1="0" y1="35" x2="780" y2="35" stroke="#f59e0b" strokeWidth="3" strokeDasharray="30 20" />
                <rect x="0" y="75" width="780" height="175" fill="url(#garageFloor)" />

                <g transform="translate(40, 75)">
                  <rect x="0" y="0" width="160" height="170" fill="rgba(255,255,255,0.02)" stroke="#334155" strokeWidth="2" strokeDasharray="6 6" />
                  <circle cx="80" cy="15" r="5" fill="#ef4444" />
                  <text x="80" y="32" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="var(--mono)">P2-22 [OCCUPIED]</text>
                  <rect x="25" y="45" width="110" height="110" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                  <rect x="40" y="65" width="80" height="45" rx="4" fill="#0f172a" />
                </g>

                <g transform="translate(240, 75)">
                  <rect x="0" y="0" width="220" height="170" fill="rgba(0, 255, 136, 0.08)" stroke="#00ff88" strokeWidth="3" rx="6" />
                  <circle cx="110" cy="15" r="7" fill="#00ff88" filter="url(#glowLight)" />
                  <text x="110" y="34" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="13" fontFamily="var(--mono)">
                    ★ BAY P2-23 [PARK HERE] ★
                  </text>
                  <g transform="translate(25, 45)">
                    <rect x="0" y="0" width="170" height="110" rx="10" fill="#030712" stroke="#00f5ff" strokeWidth="2.5" />
                    <rect x="25" y="20" width="120" height="55" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
                    <circle cx="35" cy="100" r="10" fill="#000" stroke="#00f5ff" strokeWidth="2" />
                    <circle cx="135" cy="100" r="10" fill="#000" stroke="#00f5ff" strokeWidth="2" />
                    <text x="85" y="55" textAnchor="middle" fill="#00f5ff" fontSize="10" fontFamily="var(--mono)">FAMILY EV CAR</text>
                  </g>
                </g>

                <g transform="translate(500, 75)">
                  <rect x="0" y="0" width="110" height="170" fill="rgba(255,255,255,0.02)" stroke="#334155" strokeWidth="2" strokeDasharray="6 6" />
                  <circle cx="55" cy="15" r="5" fill="#ef4444" />
                  <text x="55" y="32" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="var(--mono)">P2-24 [OCCUPIED]</text>
                  <rect x="15" y="50" width="80" height="105" rx="6" fill="#1e293b" />
                </g>

                <g transform="translate(635, 50)">
                  <rect x="0" y="0" width="135" height="190" fill="url(#mallDoorGlow)" rx="8" stroke="#38bdf8" strokeWidth="2" />
                  <rect x="8" y="10" width="119" height="24" rx="4" fill="#0f172a" />
                  <text x="67" y="26" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="9" fontFamily="var(--mono)">
                    ◄ MALL ENTRANCE
                  </text>
                  <text x="67" y="100" textAnchor="middle" fill="#ffffff" fontSize="28">🏬</text>
                  <text x="67" y="140" textAnchor="middle" fill="#00f5ff" fontWeight="bold" fontSize="9" fontFamily="var(--mono)">
                    GLASS LIFT LOBBY
                  </text>
                  <text x="67" y="160" textAnchor="middle" fill="#fde047" fontSize="8" fontFamily="var(--mono)">
                    ➔ LEVEL 2 ARCADE
                  </text>
                </g>
              </svg>
            </div>

            <div className="parking-hud">
              <div className="sensor-graphic">
                <div className="parking-spot taken">P2-22 [OCCUPIED]</div>
                <div className="parking-spot target">
                  <span className="sensor-light green" />
                  <strong>BAY P2-23 [PARK HERE]</strong>
                  <small>Ultrasonic Guidance: Aligned & Ready</small>
                </div>
                <div className="parking-spot taken">P2-24 [OCCUPIED]</div>
              </div>
              <div className="parking-status-text">
                <span className="status-badge success">READY TO PARK</span>
                <p className="lock-note">Click below to park vehicle and start the animated walk into the mall!</p>
              </div>
            </div>

            <div className="journey-dialogue-card">
              <div className="dialogue-row boy">
                <span className="avatar">👦</span>
                <div>
                  <strong>Leo:</strong>
                  <p>“Dad, park right here in Bay P2-23! The glass mall entrance doors are right in front of us!”</p>
                </div>
              </div>
              <div className="dialogue-row girl">
                <span className="avatar">👧</span>
                <div>
                  <strong>Maya:</strong>
                  <p>“Yay, we arrived! Unbuckle us as soon as you park so we can go inside!”</p>
                </div>
              </div>
            </div>

            <div className="journey-actions">
              <button
                type="button"
                className="journey-btn primary big-action"
                onClick={handleParkAndEnterMall}
              >
                <span>Park Car in Bay P2-23 & Enter Mall</span> 🅿️ 🚗 →
              </button>
            </div>
          </div>
        )}

        {stage === "mall_walkthrough" && (
          <div className="journey-content scene-walkthrough">
            <div className="auto-narrative-banner">
              <div className="banner-left">
                <span className="auto-pulse-dot" />
                <strong>
                  {mallStep === 0 && "STEPPING OUT OF CAR & ENTERING MALL DOORS..."}
                  {mallStep === 1 && "WALKING ACROSS GRAND ATRIUM TO GLASS LIFT..."}
                  {mallStep === 2 && "ASCENDING IN GLASS LIFT TO LEVEL 2 PLAY AREA..."}
                  {mallStep === 3 && "✨ ARRIVED AT LEVEL 2 PLAY AREA & VENDING MACHINE! ✨"}
                </strong>
              </div>
              {mallStep < 3 && (
                <div className="banner-right">
                  <button
                    type="button"
                    className="ff-link-btn"
                    onClick={handleFastForwardToPlayArea}
                    title="Jump straight to the playing area & machine"
                  >
                    Jump to Playing Area 🎪 ⏩
                  </button>
                </div>
              )}
            </div>

            <div className="auto-timeline-bar">
              <div
                className="timeline-fill"
                style={{
                  width: `${
                    mallStep === 0 ? "25%" : mallStep === 1 ? "50%" : mallStep === 2 ? "75%" : "100%"
                  }`,
                }}
              />
            </div>

            {mallStep === 0 && (
              <div className="walkthrough-step-view">
                <div className="scene-badge">
                  🅿️ 7:32 PM · Underground Parking P2 Entrance
                  <span className="auto-pill">Stepping Out & Entering Mall Doors</span>
                </div>
                <h2>Car Parked · Walking Through Sliding Mall Doors</h2>
                <p className="scene-lead">
                  The car locks safely with a remote chirp. Dad, Maya, and Leo step out and walk through the automatic sliding glass doors into Starlight Mall!
                </p>

                <div className="parking-visual-canvas">
                  <svg className="parking-svg" viewBox="0 0 780 250">
                    <rect x="0" y="0" width="780" height="70" fill="#0f172a" />
                    <rect x="0" y="75" width="780" height="175" fill="#080c14" />

                    <g transform="translate(60, 75)">
                      <rect x="0" y="0" width="220" height="170" fill="rgba(0, 255, 136, 0.05)" stroke="#00ff88" strokeWidth="2" rx="6" />
                      <text x="110" y="25" textAnchor="middle" fill="#00ff88" fontSize="11" fontFamily="var(--mono)">BAY P2-23 [LOCKED]</text>
                      <g transform="translate(25, 45)">
                        <rect x="0" y="0" width="170" height="110" rx="10" fill="#030712" stroke="#00f5ff" strokeWidth="2" />
                        <rect x="25" y="20" width="120" height="55" rx="6" fill="#0f172a" />
                        <circle cx="35" cy="100" r="10" fill="#000" stroke="#00f5ff" strokeWidth="2" />
                        <circle cx="135" cy="100" r="10" fill="#000" stroke="#00f5ff" strokeWidth="2" />
                      </g>
                    </g>

                    <g transform="translate(600, 45)">
                      <rect x="0" y="0" width="170" height="200" fill="rgba(254, 240, 138, 0.45)" rx="8" stroke="#38bdf8" strokeWidth="3" />
                      <rect x="5" y="10" width="25" height="180" fill="rgba(56, 189, 248, 0.3)" stroke="#00f5ff" strokeWidth="1.5" />
                      <rect x="140" y="10" width="25" height="180" fill="rgba(56, 189, 248, 0.3)" stroke="#00f5ff" strokeWidth="1.5" />
                      <text x="85" y="30" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="10" fontFamily="var(--mono)">
                        ◄ SLIDING DOORS OPEN ►
                      </text>
                      <text x="85" y="110" textAnchor="middle" fill="#ffffff" fontSize="32">🏬</text>
                      <text x="85" y="150" textAnchor="middle" fill="#00f5ff" fontWeight="bold" fontSize="10" fontFamily="var(--mono)">
                        GRAND MALL ATRIUM
                      </text>
                    </g>

                    <g transform="translate(420, 160)" className="animated-walking-actor">
                      <g transform="translate(0, 0)">
                        <circle cx="0" cy="-28" r="8" fill="#e2b186" />
                        <rect x="-5" y="-19" width="10" height="24" rx="2" fill="#1e293b" />
                        <line x1="-3" y1="5" x2="-7" y2="28" stroke="#0f172a" strokeWidth="3.5" className="animated-leg-left" />
                        <line x1="3" y1="5" x2="7" y2="28" stroke="#0f172a" strokeWidth="3.5" className="animated-leg-right" />
                      </g>

                      <g transform="translate(36, 4)">
                        <circle cx="0" cy="-20" r="6.5" fill="#e2b186" />
                        <circle cx="-5" cy="-22" r="3" fill="#713f12" />
                        <rect x="-4" y="-13" width="8" height="17" rx="2" fill="#ff85a1" />
                        <circle cx="6" cy="-4" r="4.5" fill="#ffd700" className="animated-lucky-coin" />
                        <line x1="-2" y1="4" x2="-5" y2="22" stroke="#0f172a" strokeWidth="3" className="animated-leg-left" />
                        <line x1="2" y1="4" x2="5" y2="22" stroke="#0f172a" strokeWidth="3" className="animated-leg-right" />
                      </g>

                      <g transform="translate(70, 6)">
                        <circle cx="0" cy="-18" r="6" fill="#e2b186" />
                        <rect x="-4" y="-21" width="8" height="3" fill="#38bdf8" />
                        <rect x="-3" y="-11" width="6" height="15" rx="2" fill="#38bdf8" />
                        <line x1="-2" y1="4" x2="-5" y2="18" stroke="#0f172a" strokeWidth="2.5" className="animated-leg-left" />
                        <line x1="2" y1="4" x2="5" y2="18" stroke="#0f172a" strokeWidth="2.5" className="animated-leg-right" />
                      </g>
                    </g>
                  </svg>
                </div>

                <div className="journey-dialogue-card mini">
                  <div className="dialogue-row parent">
                    <span className="avatar">🧔</span>
                    <div><strong>Dad:</strong> “Car is locked safely in Bay P2-23. Let’s head through the sliding doors!”</div>
                  </div>
                  <div className="dialogue-row boy">
                    <span className="avatar">👦</span>
                    <div><strong>Leo:</strong> “The automatic doors opened for us! Look at the mall inside!”</div>
                  </div>
                </div>
              </div>
            )}

            {mallStep === 1 && (
              <div className="walkthrough-step-view">
                <div className="scene-badge">
                  🏬 7:33 PM · Starlight Shopping Mall Grand Atrium
                  <span className="auto-pill">Walking Across Atrium to Glass Lift</span>
                </div>
                <h2>Walking Across the Atrium to the Central Glass Lift</h2>
                <p className="scene-lead">
                  The family steps into the gleaming multi-story mall atrium and walks across the polished marble floor straight towards the Central Panoramic Glass Elevator!
                </p>

                <div className="mall-entrance-canvas">
                  <svg className="mall-svg" viewBox="0 0 780 340">
                    <defs>
                      <linearGradient id="atriumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#030816" />
                        <stop offset="50%" stopColor="#0b1736" />
                        <stop offset="100%" stopColor="#142145" />
                      </linearGradient>
                      <linearGradient id="liftShaftGlow" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(0, 245, 255, 0.45)" />
                        <stop offset="50%" stopColor="rgba(0, 245, 255, 0.08)" />
                        <stop offset="100%" stopColor="rgba(0, 245, 255, 0.45)" />
                      </linearGradient>
                    </defs>

                    <rect x="0" y="0" width="780" height="340" fill="url(#atriumGrad)" />
                    <path d="M 0,0 Q 390,70 780,0" fill="none" stroke="rgba(0, 245, 255, 0.25)" strokeWidth="3" />
                    <circle cx="200" cy="45" r="5" fill="#fde047" filter="url(#glowLight)" />
                    <circle cx="340" cy="55" r="7" fill="#38bdf8" filter="url(#glowLight)" />

                    <g transform="translate(0, 75)">
                      <rect x="0" y="40" width="480" height="14" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                      <rect x="0" y="24" width="480" height="16" fill="rgba(56, 189, 248, 0.2)" stroke="#00f5ff" strokeWidth="1" />
                      <rect x="30" y="2" width="420" height="20" rx="4" fill="#2e1065" stroke="#f43f5e" strokeWidth="2" />
                      <text x="240" y="16" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="11" fontFamily="var(--mono)">
                        ★ LEVEL 2: STARLIGHT PLAY AREA & WONDERLAND ARCADE ★
                      </text>
                    </g>

                    <g transform="translate(0, 155)">
                      <rect x="0" y="40" width="480" height="14" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                      <rect x="0" y="24" width="480" height="16" fill="rgba(255, 255, 255, 0.08)" stroke="#64748b" strokeWidth="1" />
                      <g transform="translate(30, 2)">
                        <rect x="0" y="0" width="120" height="20" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                        <text x="60" y="14" textAnchor="middle" fill="#38bdf8" fontSize="9" fontFamily="var(--mono)">👗 LUXE FASHION</text>
                        <rect x="140" y="0" width="130" height="20" rx="3" fill="#0f172a" stroke="#f472b6" strokeWidth="1" />
                        <text x="205" y="14" textAnchor="middle" fill="#f472b6" fontSize="9" fontFamily="var(--mono)">🍰 SWEET HEAVEN</text>
                        <rect x="290" y="0" width="110" height="20" rx="3" fill="#0f172a" stroke="#facc15" strokeWidth="1" />
                        <text x="345" y="14" textAnchor="middle" fill="#facc15" fontSize="9" fontFamily="var(--mono)">☕ CAFE METRO</text>
                      </g>
                    </g>

                    <polygon points="0,340 0,230 780,230 780,340" fill="#0b1326" />
                    <line x1="0" y1="265" x2="780" y2="265" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
                    <line x1="0" y1="300" x2="780" y2="300" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />

                    <g transform="translate(15, 185)">
                      <rect x="0" y="0" width="14" height="110" fill="#334155" />
                      <rect x="110" y="0" width="14" height="110" fill="#334155" />
                      <text x="60" y="-8" textAnchor="middle" fill="#00f5ff" fontSize="8" fontFamily="var(--mono)">
                        ◄ MALL DOORS
                      </text>
                    </g>

                    <g transform="translate(520, 20)">
                      <rect x="0" y="0" width="220" height="285" rx="14" fill="url(#liftShaftGlow)" stroke="#00f5ff" strokeWidth="3" />
                      <rect x="-10" y="-18" width="240" height="24" rx="6" fill="#020617" stroke="#00ff88" strokeWidth="2" />
                      <text x="110" y="-2" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="10" fontFamily="var(--mono)">
                        🛗 CENTRAL GLASS LIFT
                      </text>

                      <g transform="translate(35, 175)">
                        <rect x="0" y="0" width="150" height="105" rx="10" fill="#0f172a" stroke="#00ff88" strokeWidth="3" filter="url(#glowLight)" />
                        <rect x="8" y="12" width="134" height="82" rx="6" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" strokeWidth="1.5" />
                        <text x="75" y="32" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="10" fontFamily="var(--mono)">
                          CABIN AT LEVEL P2
                        </text>
                        <text x="75" y="70" textAnchor="middle" fill="#ffffff" fontSize="28">🛗</text>
                        <circle cx="138" cy="55" r="4" fill="#00ff88" filter="url(#glowLight)" />
                      </g>
                    </g>

                    <g transform="translate(180, 205)">
                      <rect x="0" y="0" width="280" height="26" rx="5" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />
                      <text x="140" y="17" textAnchor="middle" fill="#fde047" fontWeight="bold" fontSize="9.5" fontFamily="var(--mono)">
                        ➔ WALK TO GLASS LIFT ➔ UP TO LEVEL 2
                      </text>
                    </g>

                    {(() => {
                      const xPos = 120 + (atriumWalkProgress / 100) * 370;
                      return (
                        <g transform={`translate(${xPos}, 260)`} className="animated-walking-actor">
                          <ellipse cx="40" cy="30" rx="45" ry="6" fill="rgba(0, 245, 255, 0.15)" />

                          <g transform="translate(0, 0)">
                            <circle cx="0" cy="-28" r="8.5" fill="#e2b186" />
                            <rect x="-6" y="-19" width="12" height="26" rx="3" fill="#1e293b" />
                            <line x1="-4" y1="7" x2="-8" y2="30" stroke="#0f172a" strokeWidth="4" className="animated-leg-left" />
                            <line x1="4" y1="7" x2="8" y2="30" stroke="#0f172a" strokeWidth="4" className="animated-leg-right" />
                          </g>

                          <g transform="translate(38, 4)">
                            <circle cx="0" cy="-20" r="7" fill="#e2b186" />
                            <circle cx="-6" cy="-22" r="3" fill="#713f12" />
                            <rect x="-5" y="-13" width="10" height="19" rx="2" fill="#ff85a1" />
                            <line x1="4" y1="-8" x2="22" y2="-26" stroke="#ff85a1" strokeWidth="3" />
                            <circle cx="24" cy="-28" r="5" fill="#ffd700" className="animated-lucky-coin" />
                            <line x1="-3" y1="6" x2="-6" y2="24" stroke="#0f172a" strokeWidth="3" className="animated-leg-left" />
                            <line x1="3" y1="6" x2="6" y2="24" stroke="#0f172a" strokeWidth="3" className="animated-leg-right" />
                          </g>

                          <g transform="translate(75, 6)">
                            <circle cx="0" cy="-18" r="6.5" fill="#e2b186" />
                            <rect x="-5" y="-22" width="10" height="4" fill="#38bdf8" />
                            <rect x="-4" y="-12" width="8" height="17" rx="2" fill="#38bdf8" />
                            <line x1="-4" y1="-8" x2="-12" y2="-24" stroke="#38bdf8" strokeWidth="2.5" />
                            <line x1="4" y1="-8" x2="16" y2="-24" stroke="#38bdf8" strokeWidth="2.5" />
                            <line x1="-3" y1="5" x2="-6" y2="20" stroke="#0f172a" strokeWidth="3" className="animated-leg-left" />
                            <line x1="3" y1="5" x2="6" y2="20" stroke="#0f172a" strokeWidth="3" className="animated-leg-right" />
                          </g>
                        </g>
                      );
                    })()}
                  </svg>
                </div>

                <div className="journey-dialogue-card mini">
                  <div className="dialogue-row girl">
                    <span className="avatar">👧</span>
                    <div><strong>Maya:</strong> “Look at the giant glass elevator straight ahead! It goes all the way to Level 2!”</div>
                  </div>
                  <div className="dialogue-row boy">
                    <span className="avatar">👦</span>
                    <div><strong>Leo:</strong> “I’ll press the green button! The glass doors are sliding open for us!”</div>
                  </div>
                </div>
              </div>
            )}

            {mallStep === 2 && (
              <div className="walkthrough-step-view">
                <div className="scene-badge">
                  🛗 7:35 PM · Central Panoramic Glass Elevator
                  <span className="auto-pill">Ascending Through Mall Atrium</span>
                </div>
                <h2>Ascending to Level 2 in the Panoramic Glass Lift</h2>
                <p className="scene-lead">
                  The family steps inside the glass lift. As the motor hums, the elevator climbs smoothly through the central atrium with the stores, cafes, and chandeliers gliding below through the transparent glass!
                </p>

                <div className="lift-scenic-canvas">
                  <svg className="lift-svg" viewBox="0 0 780 340">
                    <defs>
                      <linearGradient id="liftSkyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#081028" />
                        <stop offset="100%" stopColor="#111c38" />
                      </linearGradient>
                      <linearGradient id="liftGlassGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(56, 189, 248, 0.25)" />
                        <stop offset="100%" stopColor="rgba(0, 245, 255, 0.08)" />
                      </linearGradient>
                    </defs>

                    <rect x="0" y="0" width="780" height="340" fill="url(#liftSkyGrad)" />

                    {liftFloor === "P2" && (
                      <g className="scenery-p2" opacity="0.9">
                        <rect x="0" y="240" width="780" height="100" fill="#0f172a" />
                        <line x1="0" y1="280" x2="780" y2="280" stroke="#334155" strokeWidth="2" strokeDasharray="14 10" />
                        <text x="390" y="270" textAnchor="middle" fill="#64748b" fontSize="16" fontFamily="var(--mono)">
                          GROUND LEVEL P2 · PARKING LOBBY RECEDING BELOW...
                        </text>
                      </g>
                    )}

                    {liftFloor === "L1" && (
                      <g className="scenery-l1" opacity="0.95">
                        <rect x="40" y="110" width="220" height="100" rx="8" fill="#1e1b4b" stroke="#818cf8" strokeWidth="2" />
                        <text x="150" y="155" textAnchor="middle" fill="#c7d2fe" fontWeight="bold" fontSize="13" fontFamily="var(--mono)">
                          👗 LUXURY BOUTIQUES
                        </text>
                        <rect x="520" y="110" width="220" height="100" rx="8" fill="#1e1b4b" stroke="#f472b6" strokeWidth="2" />
                        <text x="630" y="155" textAnchor="middle" fill="#fbcfe8" fontWeight="bold" fontSize="13" fontFamily="var(--mono)">
                          🍰 GOURMET DESSERTS
                        </text>
                        <text x="390" y="80" textAnchor="middle" fill="#38bdf8" fontSize="14" fontWeight="bold" fontFamily="var(--mono)">
                          ⬆ LEVEL 1 PASSING OUTSIDE THE GLASS... RISING TO LEVEL 2!
                        </text>
                      </g>
                    )}

                    {liftFloor === "L2" && (
                      <g className="scenery-l2" opacity="0.95">
                        <rect x="20" y="35" width="740" height="115" rx="8" fill="#2e1065" stroke="#f43f5e" strokeWidth="3" />
                        <text x="390" y="75" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="16" fontFamily="var(--mono)">
                          ★ WELCOME TO LEVEL 2: STARLIGHT PLAY AREA & ARCADE ★
                        </text>
                        <text x="390" y="110" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="13" fontFamily="var(--mono)">
                          🔔 DING! GLASS DOORS OPENING DIRECTLY INTO THE PLAY AREA!
                        </text>
                      </g>
                    )}

                    <g transform="translate(140, 20)">
                      <rect x="0" y="0" width="500" height="300" rx="18" fill="none" stroke="#00f5ff" strokeWidth="4" />
                      <rect x="10" y="10" width="480" height="280" rx="14" fill="url(#liftGlassGrad)" stroke="rgba(0, 245, 255, 0.4)" strokeWidth="1.5" />

                      <rect x="60" y="18" width="380" height="42" rx="8" fill="#030712" stroke="#00ff88" strokeWidth="2" />
                      <text x="250" y="44" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="14" fontFamily="var(--mono)">
                        {liftFloor === "L2"
                          ? "★ ARRIVED: LEVEL 2 (PLAY AREA & ARCADE) ★"
                          : liftFloor === "L1"
                            ? "⬆ ASCENDING... PASSING LEVEL 1"
                            : "⬆ ASCENDING FROM LEVEL P2 (PARKING)..."}
                      </text>

                      <g transform="translate(250, 210)">
                        <circle cx="-50" cy="-28" r="9" fill="#e2b186" />
                        <rect x="-56" y="-19" width="12" height="26" rx="3" fill="#1e293b" />
                        <line x1="-54" y1="7" x2="-58" y2="30" stroke="#0f172a" strokeWidth="4" />
                        <line x1="-46" y1="7" x2="-42" y2="30" stroke="#0f172a" strokeWidth="4" />

                        <circle cx="0" cy="-20" r="7.5" fill="#e2b186" />
                        <circle cx="-6" cy="-22" r="3" fill="#713f12" />
                        <rect x="-5" y="-13" width="10" height="20" rx="2" fill="#ff85a1" />
                        <circle cx="8" cy="-16" r="4.5" fill="#ffd700" className="animated-lucky-coin" />
                        <line x1="-3" y1="7" x2="-6" y2="25" stroke="#0f172a" strokeWidth="3" />
                        <line x1="3" y1="7" x2="6" y2="25" stroke="#0f172a" strokeWidth="3" />

                        <circle cx="45" cy="-18" r="7" fill="#e2b186" />
                        <rect x="40" y="-22" width="10" height="4" fill="#38bdf8" />
                        <rect x="41" y="-12" width="8" height="18" rx="2" fill="#38bdf8" />
                        <line x1="38" y1="-6" x2="28" y2="-18" stroke="#38bdf8" strokeWidth="2.5" />
                        <line x1="48" y1="-6" x2="58" y2="-18" stroke="#38bdf8" strokeWidth="2.5" />
                        <line x1="42" y1="6" x2="39" y2="22" stroke="#0f172a" strokeWidth="3" />
                        <line x1="48" y1="6" x2="51" y2="22" stroke="#0f172a" strokeWidth="3" />
                      </g>

                      <g className={`svg-lift-doors ${liftDoorOpen ? "open" : "closed"}`}>
                        <rect
                          x="10"
                          y="10"
                          width="235"
                          height="280"
                          fill="rgba(15, 23, 42, 0.88)"
                          stroke="#00f5ff"
                          strokeWidth="2"
                          className="svg-door-left"
                          style={{
                            transform: liftDoorOpen ? "translateX(-230px)" : "none",
                            transition: "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                          }}
                        />
                        <rect
                          x="255"
                          y="10"
                          width="235"
                          height="280"
                          fill="rgba(15, 23, 42, 0.88)"
                          stroke="#00f5ff"
                          strokeWidth="2"
                          className="svg-door-right"
                          style={{
                            transform: liftDoorOpen ? "translateX(230px)" : "none",
                            transition: "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                          }}
                        />
                      </g>
                    </g>
                  </svg>
                </div>

                <div className="journey-dialogue-card mini">
                  <div className="dialogue-row boy">
                    <span className="avatar">👦</span>
                    <div><strong>Leo:</strong> “We’re passing Level 1! Level 2 is next! Look at the arcade lights!”</div>
                  </div>
                  <div className="dialogue-row girl">
                    <span className="avatar">👧</span>
                    <div><strong>Maya:</strong> “Ding! The doors are opening right into the Play Area!”</div>
                  </div>
                </div>
              </div>
            )}

            {mallStep === 3 && (
              <div className="walkthrough-step-view">
                <div className="scene-badge">
                  ✨ 7:36 PM · Level 2 Play Area & Wonderland Arcade
                  <span className="arcade-live-pill">Final Destination Reached</span>
                </div>
                <h2>Arrived at the Play Area: The Vending Machine Revealed!</h2>
                <p className="scene-lead">
                  The glass doors slide wide open into the buzzing arcade! Right in the center, glowing with vibrant neon coils and surrounded by cheering people, stands <strong>The Impossible Vending Machine</strong>!
                </p>

                <div className="playarea-visual-canvas">
                  <svg className="playarea-svg" viewBox="0 0 780 340">
                    <defs>
                      <linearGradient id="arcadeBg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#250938" />
                        <stop offset="100%" stopColor="#0b0818" />
                      </linearGradient>
                      <linearGradient id="machineGlowGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ff4b72" />
                        <stop offset="50%" stopColor="#bf5af2" />
                        <stop offset="100%" stopColor="#00f5ff" />
                      </linearGradient>
                      <linearGradient id="glassCaseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(6, 182, 212, 0.28)" />
                        <stop offset="100%" stopColor="rgba(59, 130, 246, 0.12)" />
                      </linearGradient>
                    </defs>

                    <rect x="0" y="0" width="780" height="340" fill="url(#arcadeBg)" />
                    <path d="M 0,35 Q 195,65 390,35 Q 585,65 780,35" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="14 12" />
                    <circle cx="95" cy="50" r="5" fill="#fde047" />
                    <circle cx="290" cy="50" r="5" fill="#00f5ff" />
                    <circle cx="485" cy="50" r="5" fill="#ff4b72" />
                    <circle cx="680" cy="50" r="5" fill="#00ff88" />

                    <rect x="180" y="8" width="420" height="32" rx="8" fill="#2e1065" stroke="url(#machineGlowGrad)" strokeWidth="2.5" />
                    <text x="390" y="29" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="13" fontFamily="var(--mono)">
                      ★ STARLIGHT WONDERLAND PLAY AREA & ARCADE ★
                    </text>

                    <g opacity="0.75">
                      <rect x="30" y="90" width="75" height="170" rx="4" fill="#1e1b4b" stroke="#4338ca" strokeWidth="1.5" />
                      <rect x="38" y="105" width="59" height="50" fill="#064e3b" />
                      <text x="67" y="135" textAnchor="middle" fill="#34d399" fontSize="10" fontFamily="var(--mono)">PINBALL</text>

                      <rect x="675" y="90" width="75" height="170" rx="4" fill="#1e1b4b" stroke="#ec4899" strokeWidth="1.5" />
                      <rect x="683" y="105" width="59" height="50" fill="#831843" />
                      <text x="712" y="135" textAnchor="middle" fill="#f472b6" fontSize="10" fontFamily="var(--mono)">RACING</text>
                    </g>

                    <g transform="translate(290, 50)">
                      <rect x="0" y="0" width="200" height="235" rx="14" fill="#0a0f1d" stroke="url(#machineGlowGrad)" strokeWidth="4" filter="url(#glowLight)" />

                      <rect x="14" y="14" width="172" height="28" rx="6" fill="#1e1b4b" stroke="#00f5ff" strokeWidth="1.5" />
                      <text x="100" y="32" textAnchor="middle" fill="#00f5ff" fontSize="10" fontWeight="bold" fontFamily="var(--mono)">
                        ✨ IMPOSSIBLE VENDING ✨
                      </text>

                      <rect x="16" y="48" width="168" height="115" rx="8" fill="url(#glassCaseGrad)" stroke="#00f5ff" strokeWidth="2" />

                      <line x1="25" y1="75" x2="175" y2="75" stroke="#f43f5e" strokeWidth="3" strokeDasharray="8 6" />
                      <circle cx="45" cy="75" r="9" fill="#facc15" filter="url(#glowLight)" />
                      <circle cx="82" cy="75" r="9" fill="#ff4b72" filter="url(#glowLight)" />
                      <circle cx="118" cy="75" r="9" fill="#00f5ff" filter="url(#glowLight)" />
                      <circle cx="155" cy="75" r="9" fill="#a855f7" filter="url(#glowLight)" />

                      <line x1="25" y1="110" x2="175" y2="110" stroke="#a855f7" strokeWidth="3" strokeDasharray="8 6" />
                      <circle cx="45" cy="110" r="9" fill="#38bdf8" />
                      <circle cx="82" cy="110" r="9" fill="#4ade80" />
                      <circle cx="118" cy="110" r="9" fill="#fb923c" />
                      <circle cx="155" cy="110" r="9" fill="#f43f5e" />

                      <line x1="25" y1="145" x2="175" y2="145" stroke="#38bdf8" strokeWidth="3" strokeDasharray="8 6" />
                      <circle cx="45" cy="145" r="9" fill="#ffd700" />
                      <circle cx="82" cy="145" r="9" fill="#e879f9" />
                      <circle cx="118" cy="145" r="9" fill="#22d3ee" />
                      <circle cx="155" cy="145" r="9" fill="#fde047" />

                      <g transform="translate(125, 172)">
                        <rect x="0" y="0" width="55" height="24" rx="4" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" className="animated-coin-slot" />
                        <circle cx="15" cy="12" r="5" fill="#f59e0b" />
                        <text x="35" y="16" textAnchor="middle" fill="#f59e0b" fontWeight="bold" fontSize="8" fontFamily="var(--mono)">COIN</text>
                      </g>

                      <rect x="22" y="172" width="95" height="48" rx="6" fill="#020617" stroke="#334155" strokeWidth="2" />
                      <text x="69" y="200" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="9" fontFamily="var(--mono)">
                        🎁 PRIZE CHUTE
                      </text>
                    </g>

                    <g transform="translate(150, 185)">
                      <circle cx="0" cy="-28" r="8.5" fill="#e2b186" />
                      <rect x="-6" y="-19" width="12" height="26" rx="3" fill="#1e293b" />
                      <line x1="-4" y1="7" x2="-8" y2="30" stroke="#0f172a" strokeWidth="4" />
                      <line x1="4" y1="7" x2="8" y2="30" stroke="#0f172a" strokeWidth="4" />

                      <g transform="translate(45, -5)">
                        <circle cx="0" cy="-20" r="7" fill="#e2b186" />
                        <circle cx="-6" cy="-22" r="3" fill="#713f12" />
                        <rect x="-5" y="-13" width="10" height="20" rx="2" fill="#ff85a1" />
                        <line x1="5" y1="-7" x2="22" y2="-26" stroke="#ff85a1" strokeWidth="3.5" />
                        <circle cx="26" cy="-28" r="7" fill="#ffd700" stroke="#f59e0b" strokeWidth="2" className="animated-lucky-coin" />
                        <line x1="-3" y1="7" x2="-6" y2="25" stroke="#0f172a" strokeWidth="3" />
                        <line x1="3" y1="7" x2="6" y2="25" stroke="#0f172a" strokeWidth="3" />
                      </g>

                      <g transform="translate(85, -12)" className="animated-jump">
                        <circle cx="0" cy="-18" r="6.5" fill="#e2b186" />
                        <rect x="-5" y="-22" width="10" height="4" fill="#38bdf8" />
                        <rect x="-4" y="-12" width="8" height="17" rx="2" fill="#38bdf8" />
                        <line x1="-4" y1="-8" x2="-14" y2="-25" stroke="#38bdf8" strokeWidth="3" />
                        <line x1="4" y1="-8" x2="14" y2="-25" stroke="#38bdf8" strokeWidth="3" />
                        <line x1="-3" y1="5" x2="-6" y2="20" stroke="#0f172a" strokeWidth="3" />
                        <line x1="3" y1="5" x2="6" y2="20" stroke="#0f172a" strokeWidth="3" />
                      </g>
                    </g>

                    <g transform="translate(540, 185)" opacity="0.85">
                      <circle cx="0" cy="-24" r="7.5" fill="#d97706" />
                      <rect x="-5" y="-16" width="10" height="22" fill="#334155" />
                      <circle cx="28" cy="-26" r="8" fill="#a78bfa" />
                      <rect x="23" y="-17" width="11" height="24" fill="#1e1b4b" />
                      <text x="14" y="-38" textAnchor="middle" fill="#00ff88" fontSize="10" fontWeight="bold" fontFamily="var(--mono)">
                        “LOOK AT THE PRIZES!”
                      </text>
                    </g>
                  </svg>
                </div>

                <div className="kids-plea-card">
                  <div className="plea-sparkle">✨ THE LIFT DOORS OPEN TO THE PLAY AREA! ✨</div>
                  <div className="dialogue-row boy excited">
                    <span className="avatar">👦</span>
                    <div>
                      <strong>Leo (Jumping and pointing at the machine):</strong>
                      <p>“DAD LOOK RIGHT IN FRONT OF US!! The Play Area! That giant glowing Impossible Vending Machine! CAN WE PLAY PLEASE, CAN WE PLEASE?!”</p>
                    </div>
                  </div>
                  <div className="dialogue-row girl excited">
                    <span className="avatar">👧</span>
                    <div>
                      <strong>Maya (Holding up her shiny gold coin):</strong>
                      <p>“Look at the spinning rainbow coils and mystery boxes! Dad, here’s our lucky coin! Let’s walk up to the machine right now!”</p>
                    </div>
                  </div>
                  <div className="dialogue-row parent">
                    <span className="avatar">🧔</span>
                    <div>
                      <strong>Dad (Smiling):</strong>
                      <p>“We made it! Let’s step up to the glass, choose our favorite gift topic, and insert the coin!”</p>
                    </div>
                  </div>
                </div>

                <div className="journey-actions">
                  <button
                    type="button"
                    className="journey-btn primary big-action"
                    onClick={handleStepToMachine}
                  >
                    <span>Walk Up to the Vending Machine & Insert Coin!</span> 🎰 ✨ →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
