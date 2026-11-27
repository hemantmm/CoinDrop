import { useEffect, useRef, useState } from "react";
import { Journey3D } from "../scene/Journey3D";
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

// Main stages of the family journey:
// 1. auto_trip: Home -> Car -> Drive on highway with live GPS (automatic)
// 2. parking_bay: Car stops at Bay P2-23. USER INTERACTION: "Park Car in Bay P2-23 & Enter Mall"
// 3. mall_walkthrough: The complete grand architectural shopping mall & glass lift walkthrough:
//    - Phase 0: Approaching Lift (Family enters from parking and walks across Ground Floor to Glass Lift)
//    - Phase 1: Entering Lift (Elevator doors slide open, family walks INSIDE the elevator cabin)
//    - Phase 2: Lift Doors Close (Doors slide shut, level 2 selected)
//    - Phase 3: Lift Ascending (Elevator cabin visibly ascends up shaft P2 -> L1 -> L2 past shops, DING! chime)
//    - Phase 4: Exiting Lift (Doors slide open at Level 2, family walks OUT of the elevator)
//    - Phase 5: Moving to Play Area (Family walks across Level 2 into the Play Area & Vending Machine)
//    - Phase 6: At Machine (Maya holds coin to slot, Leo cheering, user ready to play!)
type JourneyStage = "auto_trip" | "parking_bay" | "mall_walkthrough";

export function FamilyJourney({ onComplete }: Props) {
  const [stage, setStage] = useState<JourneyStage>("auto_trip");

  // Sub-step inside auto_trip:
  // 0: Door opens at home
  // 1: Walking along stone pathway
  // 2: Sitting inside car
  // 3: Headlights beam on, engine powers up
  // 4: Highway driving with in-car GPS navigation dashboard
  const [autoStep, setAutoStep] = useState(0);

  // GPS navigation road progress (0.0 to 1.0)
  const [carProgress, setCarProgress] = useState(0.12);
  const [radioPlaying, setRadioPlaying] = useState(true);

  // Mall walkthrough phases:
  // 0 = Walking across ground floor to lift
  // 1 = Doors open, family walks INSIDE the lift cabin
  // 2 = Doors close
  // 3 = Lift cabin visibly ascends from P2 -> L1 -> L2 (Ding!)
  // 4 = Doors open at Level 2, family walks OUT of the lift
  // 5 = Family walks into the Play Area right in front of Vending Machine
  // 6 = Ready to play!
  const [walkPhase, setWalkPhase] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);

  // Elevator cabin Y offset (285 = Ground Floor P2, 165 = Level 1, 45 = Level 2)
  const [cabinY, setCabinY] = useState(285);
  // Elevator sliding doors open state
  const [doorsOpen, setDoorsOpen] = useState(false);
  // Current floor indicator readout
  const [currentFloor, setCurrentFloor] = useState<"P2" | "L1" | "L2">("P2");

  // Family X position on the floor
  // Ground floor: 80 -> 330 (walk to lift) -> 415 (inside cabin)
  // Level 2: 415 (inside cabin) -> 535 (walk out) -> 660 (at vending machine)
  const [familyX, setFamilyX] = useState(80);

  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const clearAllTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const addTimer = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  // =========================================================================
  // 1. AUTOMATIC CINEMATIC SEQUENCE: Home -> Walk -> Board Car -> Drive with GPS
  // Strictly automatic without asking the user until reaching the parking bay!
  // =========================================================================
  useEffect(() => {
    if (stage !== "auto_trip") return;

    // t = 0ms: Door opens
    // t = 1100ms: Family starts walking along stone pathway towards car
    addTimer(() => setAutoStep(1), 1100);

    // t = 2400ms: Family reaches car, doors open, kids & Dad sit inside
    addTimer(() => {
      setAutoStep(2);
      unlockAudio();
      playEngineStart();
    }, 2400);

    // t = 3600ms: Headlights beam on, car rolls out of driveway
    addTimer(() => setAutoStep(3), 3600);

    // t = 4600ms: Smoothly transitions to highway driving with live GPS navigation
    addTimer(() => {
      setAutoStep(4);
      unlockAudio();
      playNavChime();
    }, 4600);

    return () => clearAllTimers();
  }, [stage]);

  // Handle GPS Driving progress during autoStep === 4 smoothly at 60fps
  useEffect(() => {
    if (stage !== "auto_trip" || autoStep !== 4) return;
    let raf = 0;
    const driveStart = performance.now();
    const durationMs = 3850;
    let triggered = false;

    const tick = (now: number) => {
      const p = Math.min(1, (now - driveStart) / durationMs);
      setCarProgress(0.12 + p * (0.96 - 0.12));
      if (p < 1) {
        raf = window.requestAnimationFrame(tick);
      } else if (!triggered) {
        triggered = true;
        addTimer(() => {
          unlockAudio();
          playParkingBeep();
          setStage("parking_bay");
        }, 450);
      }
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      clearAllTimers();
    };
  }, [stage, autoStep]);

  // Fast forward directly to parking bay if user prefers
  const handleFastForwardToParking = () => {
    clearAllTimers();
    unlockAudio();
    playParkingBeep();
    setStage("parking_bay");
  };

  // =========================================================================
  // 2. USER CLICKS TO PARK: LAUNCHES THE COMPLETE ANIMATED MALL & LIFT JOURNEY!
  // "the lift is not properly designed make how people enters the lift and
  // when their floor comes they come out and move to that area"
  // =========================================================================
  const handleParkAndEnterMall = () => {
    clearAllTimers();
    unlockAudio();
    playCarLock();
    setStage("mall_walkthrough");

    setWalkPhase(0);
    setFamilyX(80);
    setCabinY(285);
    setDoorsOpen(false);
    setCurrentFloor("P2");

    let firedPhase1 = false;
    let firedPhase2 = false;
    let firedPhase3 = false;
    let firedPhase4 = false;
    let firedPhase5 = false;
    let firedPhase6 = false;
    const startMs = performance.now();

    const stepWalkthrough = (now: number) => {
      const elapsed = now - startMs;

      if (elapsed < 2200) {
        const p = Math.min(1, elapsed / 2200);
        setFamilyX(80 + (330 - 80) * p);
      } else if (elapsed < 4200) {
        if (!firedPhase1) {
          firedPhase1 = true;
          setDoorsOpen(true);
          setWalkPhase(1);
        }
        const p = Math.min(1, (elapsed - 2400) / 1600);
        if (p >= 0) setFamilyX(330 + (415 - 330) * p);
      } else if (elapsed < 5000) {
        if (!firedPhase2) {
          firedPhase2 = true;
          setFamilyX(415);
          setDoorsOpen(false);
          setWalkPhase(2);
        }
      } else if (elapsed < 8800) {
        if (!firedPhase3) {
          firedPhase3 = true;
          setWalkPhase(3);
        }
        const p = Math.min(1, (elapsed - 5000) / 3600);
        const eased = 1 - (1 - p) ** 2;
        const y = 285 - (285 - 45) * eased;
        setCabinY(y);
        if (y <= 170 && y > 60) setCurrentFloor("L1");
        else if (y <= 60) setCurrentFloor("L2");
      } else if (elapsed < 10800) {
        if (!firedPhase4) {
          firedPhase4 = true;
          setCabinY(45);
          setCurrentFloor("L2");
          unlockAudio();
          playElevatorDing();
          setDoorsOpen(true);
          setWalkPhase(4);
        }
        const p = Math.min(1, (elapsed - 9000) / 1700);
        if (p >= 0) setFamilyX(415 + (540 - 415) * p);
      } else if (elapsed < 12600) {
        if (!firedPhase5) {
          firedPhase5 = true;
          setWalkPhase(5);
        }
        const p = Math.min(1, (elapsed - 10800) / 1750);
        setFamilyX(540 + (660 - 540) * p);
      } else {
        if (!firedPhase6) {
          firedPhase6 = true;
          setFamilyX(660);
          setWalkPhase(6);
        }
        rafRef.current = null;
        return;
      }

      rafRef.current = window.requestAnimationFrame(stepWalkthrough);
    };

    rafRef.current = window.requestAnimationFrame(stepWalkthrough);
  };

  // Fast-forward directly to the vending machine
  const handleFastForwardToPlayArea = () => {
    clearAllTimers();
    setStage("mall_walkthrough");
    setWalkPhase(6);
    setCabinY(45);
    setDoorsOpen(true);
    setCurrentFloor("L2");
    setFamilyX(660);
  };

  // Final Action: Step up to Vending Machine & Play!
  const handleStepToMachine = () => {
    unlockAudio();
    playMallFanfare();
    onComplete();
  };

  return (
    <div className="journey-modal" role="dialog" aria-modal="true" aria-label="Family Journey to the Mall">
      <div className="journey-backdrop" onClick={onComplete} />

      <div className="journey-shell">
        {/* Navigation Breadcrumb Bar */}
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
            <span className={stage === "mall_walkthrough" && walkPhase <= 2 ? "crumb active" : stage === "mall_walkthrough" && walkPhase > 2 ? "crumb done" : "crumb"}>
              4. Boarding Glass Lift
            </span>
            <span className="crumb-arrow">›</span>
            <span className={stage === "mall_walkthrough" && (walkPhase === 3 || walkPhase === 4) ? "crumb active" : stage === "mall_walkthrough" && walkPhase >= 5 ? "crumb done" : "crumb"}>
              5. Lift Ascending & Exiting
            </span>
            <span className="crumb-arrow">›</span>
            <span className={stage === "mall_walkthrough" && walkPhase >= 5 ? "crumb active" : "crumb"}>
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

        {/* ========================================================
            STAGE 1: AUTOMATIC CINEMATIC TRIP (HOME -> BOARD CAR -> DRIVE)
            Strictly automatic without asking the user!
            ======================================================== */}
        {stage === "auto_trip" && (
          <div className="journey-content scene-auto">
            {/* Auto-Playing Status Header */}
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

            {/* Continuous Progress Bar */}
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

            {/* PART A: HOME & DRIVEWAY (autoStep 0, 1, 2, 3) */}
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

                {/* Real-Time Three.js 3D Home & Driveway Scene */}
                <div className="home-visual-canvas">
                  <Journey3D
                    stage={stage}
                    autoStep={autoStep}
                    carProgress={carProgress}
                    walkPhase={walkPhase}
                    cabinY={cabinY}
                    doorsOpen={doorsOpen}
                    familyX={familyX}
                  />
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
              /* PART B: ROAD & GPS DASHBOARD (autoStep === 4) */
              <div className="road-scene-wrapper">
                <div className="scene-badge">
                  🚘 7:22 PM · Expressway 101
                  <span className="auto-pill">Highway Drive with Live GPS</span>
                </div>
                <h2>Cruising on the Highway to Starlight Mall</h2>

                <div className="road-scenic-canvas">
                  <Journey3D
                    stage={stage}
                    autoStep={autoStep}
                    carProgress={carProgress}
                    walkPhase={walkPhase}
                    cabinY={cabinY}
                    doorsOpen={doorsOpen}
                    familyX={familyX}
                  />
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

        {/* ========================================================
            STAGE 2: PARKING BAY ARRIVAL (USER IS PROMPTED HERE!)
            "while parking only it should again start asking"
            ======================================================== */}
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
              <Journey3D
                stage={stage}
                autoStep={autoStep}
                carProgress={carProgress}
                walkPhase={walkPhase}
                cabinY={cabinY}
                doorsOpen={doorsOpen}
                familyX={familyX}
              />
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
                <p className="lock-note">Click below to park car and watch the family enter the mall and take the glass lift!</p>
              </div>
            </div>

            <div className="journey-dialogue-card">
              <div className="dialogue-row boy">
                <span className="avatar">👦</span>
                <div><strong>Leo:</strong> “Dad, park in Bay P2-23 right here! The mall doors are right ahead!”</div>
              </div>
              <div className="dialogue-row girl">
                <span className="avatar">👧</span>
                <div><strong>Maya:</strong> “Yay! Park the car so we can go inside and take the glass elevator!”</div>
              </div>
            </div>

            {/* ACTION: PARK VEHICLE & LAUNCH ANIMATED WALKTHROUGH */}
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

        {/* ========================================================
            STAGE 3: THE COMPLETE ANIMATED SHOPPING MALL & GLASS LIFT JOURNEY!
            "the lift is not properly designed make how people enters the lift
            and when their floor comes they come out and move to that area"
            ======================================================== */}
        {stage === "mall_walkthrough" && (
          <div className="journey-content scene-walkthrough">
            {/* Live Progress Banner with Fast-Forward Shortcut */}
            <div className="auto-narrative-banner">
              <div className="banner-left">
                <span className="auto-pulse-dot" />
                <strong>
                  {walkPhase === 0 && "STEPPING INTO MALL: WALKING ACROSS GROUND FLOOR TO GLASS LIFT..."}
                  {walkPhase === 1 && "DOORS SLIDE OPEN: FAMILY WALKS INSIDE THE GLASS LIFT!"}
                  {walkPhase === 2 && "DOORS SLIDE SHUT: LEVEL 2 SELECTED · PREPARING TO ASCEND..."}
                  {walkPhase === 3 && "GLASS LIFT ASCENDING THROUGH ATRIUM TO LEVEL 2 (PLAY AREA)..."}
                  {walkPhase === 4 && "DING! DOORS OPEN AT LEVEL 2: FAMILY WALKS OUT OF THE LIFT!"}
                  {walkPhase === 5 && "WALKING ACROSS LEVEL 2 INTO THE PLAY AREA & VENDING MACHINE!"}
                  {walkPhase === 6 && "✨ ARRIVED AT THE PLAY AREA! READY TO PLAY THE VENDING MACHINE! ✨"}
                </strong>
              </div>
              {walkPhase < 5 && (
                <div className="banner-right">
                  <button
                    type="button"
                    className="ff-link-btn"
                    onClick={handleFastForwardToPlayArea}
                    title="Jump straight to the play area"
                  >
                    Jump to Play Area 🎪 ⏩
                  </button>
                </div>
              )}
            </div>

            {/* Sub-scene Header Badge */}
            <div className="scene-badge">
              {walkPhase <= 2 && "🏬 Ground Floor Lobby · Boarding the Central Glass Lift"}
              {walkPhase === 3 && `🛗 Central Glass Shaft · Ascending to Floor ${currentFloor}`}
              {walkPhase >= 4 && "✨ Level 2 · Play Area, Wonderland Arcade & Vending Machine"}
              <span className="auto-pill">
                {walkPhase === 0 && "1/5: Walking to Lift"}
                {walkPhase === 1 && "2/5: Entering Lift Cabin"}
                {walkPhase === 2 && "Doors Closing"}
                {walkPhase === 3 && "3/5: Ascending to L2"}
                {walkPhase === 4 && "4/5: Exiting Lift Cabin"}
                {walkPhase >= 5 && "5/5: Arrived at Machine"}
              </span>
            </div>

            <h2>
              {walkPhase <= 2 && "Entering the Mall & Boarding the Central Glass Lift"}
              {walkPhase === 3 && "Ascending Through the Grand Atrium in the Glass Lift"}
              {walkPhase >= 4 && "Exiting the Lift into the Level 2 Play Area!"}
            </h2>
            <p className="scene-lead">
              {walkPhase === 0 && "The family enters through the sliding doors and walks across the polished marble floor straight towards the open glass elevator."}
              {walkPhase === 1 && "The elevator doors slide open with warm interior light! Dad, Maya, and Leo walk directly inside the glass cabin."}
              {walkPhase === 2 && "The doors slide closed, locking the cabin safely as the lift motor hums to life."}
              {walkPhase === 3 && "The glass cabin visibly climbs up through the central atrium! You can see Level 1 boutiques and chandeliers glide past outside through the transparent glass."}
              {walkPhase === 4 && "DING! The elevator arrives at Level 2. The glass doors slide open and the family walks out onto the arcade floor!"}
              {walkPhase >= 5 && "The family walks past the arcade games straight up to the glowing centerpiece: The Impossible Vending Machine!"}
            </p>

            {/* ========================================================
                GRAND ARCHITECTURAL SHOPPING MALL, GLASS LIFT & PLAY AREA CANVAS
                ViewBox: 840 x 440 (Shows Ground Floor, Level 1, Level 2,
                Lift Tower, Cabin physically moving, and people walking!)
                ======================================================== */}
            <div className="mall-grand-atrium-canvas">
              <Journey3D
                stage={stage}
                autoStep={autoStep}
                carProgress={carProgress}
                walkPhase={walkPhase}
                cabinY={cabinY}
                doorsOpen={doorsOpen}
                familyX={familyX}
              />
            </div>

            {/* Live Story Dialogue Card */}
            <div className="journey-dialogue-card">
              {walkPhase <= 1 && (
                <>
                  <div className="dialogue-row parent">
                    <span className="avatar">🧔</span>
                    <div><strong>Dad:</strong> “Here’s the Central Glass Lift! The call button is green. Let’s step inside!”</div>
                  </div>
                  <div className="dialogue-row girl">
                    <span className="avatar">👧</span>
                    <div><strong>Maya:</strong> “Look, the doors are opening! Leo, hurry into the elevator!”</div>
                  </div>
                </>
              )}
              {walkPhase === 2 || walkPhase === 3 ? (
                <>
                  <div className="dialogue-row boy">
                    <span className="avatar">👦</span>
                    <div><strong>Leo:</strong> “We’re going up!! Look at the whole mall outside the glass! Level 1 shops are right below us!”</div>
                  </div>
                  <div className="dialogue-row girl">
                    <span className="avatar">👧</span>
                    <div><strong>Maya:</strong> “Level 2 is right at the top! I can see the lights of the arcade!”</div>
                  </div>
                </>
              ) : null}
              {walkPhase >= 4 && (
                <>
                  <div className="dialogue-row boy excited">
                    <span className="avatar">👦</span>
                    <div><strong>Leo (Jumping and pointing at the machine):</strong> “DAD! The doors opened and we’re here! LOOK AT THE GIANT VENDING MACHINE! CAN WE PLAY PLEASE?!”</div>
                  </div>
                  <div className="dialogue-row girl excited">
                    <span className="avatar">👧</span>
                    <div><strong>Maya (Holding up her shiny gold coin):</strong> “I’ve got our lucky coin ready right at the coin slot! Dad, let’s insert it and pick our gift topic!”</div>
                  </div>
                  <div className="dialogue-row parent">
                    <span className="avatar">🧔</span>
                    <div><strong>Dad:</strong> “We arrived! All tasks complete. Let’s step up to the glass and insert the coin!”</div>
                  </div>
                </>
              )}
            </div>

            {/* FINAL ACTION BUTTON (Enabled when arrived at machine) */}
            <div className="journey-actions">
              <button
                type="button"
                className="journey-btn primary big-action"
                onClick={handleStepToMachine}
              >
                <span>Step Up to the Vending Machine & Insert Coin!</span> 🎰 ✨ →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
