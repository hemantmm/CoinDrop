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

  // Handle GPS Driving progress during autoStep === 4
  useEffect(() => {
    if (stage !== "auto_trip" || autoStep !== 4) return;

    const interval = window.setInterval(() => {
      setCarProgress((prev) => {
        if (prev >= 0.96) {
          window.clearInterval(interval);
          // Car reaches Starlight Mall underground parking bay -> Now stop and ask the user!
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

    // Initialize state at Ground Floor:
    setWalkPhase(0);
    setFamilyX(80);
    setCabinY(285);
    setDoorsOpen(false);
    setCurrentFloor("P2");

    // ---------------------------------------------------------------------
    // TIMELINE OF THE COMPLETE ANIMATED SEQUENCE:
    // ---------------------------------------------------------------------

    // PHASE 0: Family walks across Ground Floor towards the lift (t = 0 to 2200ms)
    let curX = 80;
    const walkToLiftInterval = window.setInterval(() => {
      curX += 16;
      if (curX >= 330) {
        curX = 330;
        window.clearInterval(walkToLiftInterval);
      }
      setFamilyX(curX);
    }, 120);

    // PHASE 1: At t = 2400ms, elevator doors SLIDE OPEN, family walks INSIDE!
    addTimer(() => {
      setDoorsOpen(true);
      setWalkPhase(1);

      // Family steps inside the elevator cabin: X moves from 330 to 415
      let inX = 330;
      const enterLiftInterval = window.setInterval(() => {
        inX += 10;
        if (inX >= 415) {
          inX = 415;
          window.clearInterval(enterLiftInterval);
        }
        setFamilyX(inX);
      }, 140);
    }, 2400);

    // PHASE 2: At t = 4200ms, elevator doors SLIDE CLOSED!
    addTimer(() => {
      setDoorsOpen(false);
      setWalkPhase(2);
    }, 4200);

    // PHASE 3: At t = 5000ms, elevator cabin VISIBLY ASCENDS through the shaft!
    addTimer(() => {
      setWalkPhase(3);

      // Cabin Y moves smoothly from 285 up to 45 over 3.6 seconds:
      let curY = 285;
      const ascendInterval = window.setInterval(() => {
        curY -= 8;
        if (curY <= 170 && curY > 150) {
          setCurrentFloor("L1");
        }
        if (curY <= 45) {
          curY = 45;
          setCurrentFloor("L2");
          window.clearInterval(ascendInterval);
        }
        setCabinY(curY);
      }, 110);
    }, 5000);

    // PHASE 4: At t = 8800ms, elevator arrives at Level 2, DING! doors SLIDE OPEN!
    addTimer(() => {
      unlockAudio();
      playElevatorDing();
      setDoorsOpen(true);
      setWalkPhase(4);

      // Family walks OUT of the elevator cabin onto Level 2: X moves from 415 to 540
      let outX = 415;
      const exitLiftInterval = window.setInterval(() => {
        outX += 12;
        if (outX >= 540) {
          outX = 540;
          window.clearInterval(exitLiftInterval);
        }
        setFamilyX(outX);
      }, 140);
    }, 8800);

    // PHASE 5: At t = 10800ms, family moves across Level 2 to the Vending Machine!
    addTimer(() => {
      setWalkPhase(5);

      // Family walks across Level 2 floor to Vending Machine: X moves from 540 to 660
      let playX = 540;
      const walkToMachineInterval = window.setInterval(() => {
        playX += 12;
        if (playX >= 660) {
          playX = 660;
          window.clearInterval(walkToMachineInterval);
        }
        setFamilyX(playX);
      }, 130);
    }, 10800);

    // PHASE 6: At t = 12600ms, arrived at Vending Machine! Final CTA ready!
    addTimer(() => {
      setWalkPhase(6);
    }, 12600);
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

                {/* Animated Home & Driveway Canvas */}
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
              /* PART B: ROAD & GPS DASHBOARD (autoStep === 4) */
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

                {/* BAY P2-22 */}
                <g transform="translate(40, 75)">
                  <rect x="0" y="0" width="160" height="170" fill="rgba(255,255,255,0.02)" stroke="#334155" strokeWidth="2" strokeDasharray="6 6" />
                  <circle cx="80" cy="15" r="5" fill="#ef4444" />
                  <text x="80" y="32" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="var(--mono)">P2-22 [OCCUPIED]</text>
                  <rect x="25" y="45" width="110" height="110" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                  <rect x="40" y="65" width="80" height="45" rx="4" fill="#0f172a" />
                </g>

                {/* BAY P2-23 (TARGET) */}
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

                {/* BAY P2-24 */}
                <g transform="translate(500, 75)">
                  <rect x="0" y="0" width="110" height="170" fill="rgba(255,255,255,0.02)" stroke="#334155" strokeWidth="2" strokeDasharray="6 6" />
                  <circle cx="55" cy="15" r="5" fill="#ef4444" />
                  <text x="55" y="32" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="var(--mono)">P2-24 [OCCUPIED]</text>
                  <rect x="15" y="50" width="80" height="105" rx="6" fill="#1e293b" />
                </g>

                {/* DIRECT ENTRANCE TO MALL ATRIUM */}
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
              <svg className="mall-grand-svg" viewBox="0 0 840 440">
                <defs>
                  {/* Sky & Lighting Gradients */}
                  <linearGradient id="mallVaultGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#040816" />
                    <stop offset="40%" stopColor="#0a1532" />
                    <stop offset="100%" stopColor="#111c38" />
                  </linearGradient>
                  <linearGradient id="shaftGlassGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(0, 245, 255, 0.45)" />
                    <stop offset="50%" stopColor="rgba(0, 245, 255, 0.08)" />
                    <stop offset="100%" stopColor="rgba(0, 245, 255, 0.45)" />
                  </linearGradient>
                  <linearGradient id="cabinGlass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(56, 189, 248, 0.35)" />
                    <stop offset="100%" stopColor="rgba(0, 245, 255, 0.12)" />
                  </linearGradient>
                  <linearGradient id="marbleTile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#15213b" />
                    <stop offset="100%" stopColor="#0a0f1d" />
                  </linearGradient>
                  <linearGradient id="machineNeon" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ff4b72" />
                    <stop offset="50%" stopColor="#bf5af2" />
                    <stop offset="100%" stopColor="#00f5ff" />
                  </linearGradient>
                </defs>

                {/* 1. Atrium Vaulted Background */}
                <rect x="0" y="0" width="840" height="440" fill="url(#mallVaultGrad)" />
                {/* Skylight Steel Arches */}
                <path d="M 0,0 Q 420,80 840,0" fill="none" stroke="rgba(0, 245, 255, 0.3)" strokeWidth="3" />
                <circle cx="210" cy="55" r="5" fill="#fde047" filter="url(#glowLight)" />
                <circle cx="630" cy="55" r="5" fill="#38bdf8" filter="url(#glowLight)" />

                {/* 2. LEVEL 1 (MID FLOOR): MEZZANINE SHOPS (Left Side) */}
                <g transform="translate(0, 250)">
                  <rect x="0" y="0" width="345" height="15" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                  <rect x="0" y="-18" width="345" height="18" fill="rgba(56, 189, 248, 0.15)" stroke="#64748b" strokeWidth="1" />
                  <g transform="translate(15, -45)">
                    <rect x="0" y="0" width="95" height="24" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                    <text x="47" y="16" textAnchor="middle" fill="#38bdf8" fontSize="9" fontFamily="var(--mono)">👗 FASHION</text>
                    <rect x="110" y="0" width="95" height="24" rx="3" fill="#0f172a" stroke="#f472b6" strokeWidth="1" />
                    <text x="157" y="16" textAnchor="middle" fill="#f472b6" fontSize="9" fontFamily="var(--mono)">🍰 BAKERY</text>
                    <rect x="220" y="0" width="95" height="24" rx="3" fill="#0f172a" stroke="#facc15" strokeWidth="1" />
                    <text x="267" y="16" textAnchor="middle" fill="#facc15" fontSize="9" fontFamily="var(--mono)">☕ CAFE</text>
                  </g>
                </g>

                {/* 3. LEVEL 2 (TOP FLOOR): THE PLAY AREA & ARCADE (Right Side) */}
                <g transform="translate(545, 130)">
                  <rect x="0" y="0" width="295" height="16" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                  <rect x="0" y="-18" width="295" height="18" fill="rgba(244, 63, 94, 0.2)" stroke="#f43f5e" strokeWidth="1" />
                  {/* Neon Signboard for Play Area */}
                  <rect x="10" y="-115" width="275" height="26" rx="5" fill="#2e1065" stroke="url(#machineNeon)" strokeWidth="2" />
                  <text x="147" y="-98" textAnchor="middle" fill="#ffffff" fontWeight="bold" fontSize="10.5" fontFamily="var(--mono)">
                    ★ LEVEL 2: STARLIGHT PLAY AREA ★
                  </text>
                  {/* Bunting & Arcade Games */}
                  <path d="M 10,-80 Q 75,-65 140,-80 Q 205,-65 270,-80" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="8 6" />
                  <circle cx="45" cy="-70" r="4" fill="#fde047" />
                  <circle cx="110" cy="-70" r="4" fill="#ff4b72" />
                  <circle cx="180" cy="-70" r="4" fill="#00f5ff" />

                  {/* Pinball Machine on Level 2 */}
                  <g transform="translate(15, -75)" opacity="0.85">
                    <rect x="0" y="0" width="45" height="75" rx="3" fill="#1e1b4b" stroke="#4338ca" strokeWidth="1.5" />
                    <rect x="5" y="8" width="35" height="26" fill="#064e3b" />
                    <text x="22" y="25" textAnchor="middle" fill="#34d399" fontSize="7" fontFamily="var(--mono)">PINBALL</text>
                  </g>

                  {/* Racing Rig on Level 2 */}
                  <g transform="translate(70, -75)" opacity="0.85">
                    <rect x="0" y="0" width="45" height="75" rx="3" fill="#1e1b4b" stroke="#ec4899" strokeWidth="1.5" />
                    <rect x="5" y="8" width="35" height="26" fill="#831843" />
                    <text x="22" y="25" textAnchor="middle" fill="#f472b6" fontSize="7" fontFamily="var(--mono)">RACING</text>
                  </g>

                  {/* ========================================================
                      HERO PIECE: THE 3D IMPOSSIBLE VENDING MACHINE!
                      Standing at x = 135 to 265 on Level 2
                      ======================================================== */}
                  <g transform="translate(135, -125)">
                    {/* Machine Outer Shell */}
                    <rect x="0" y="0" width="130" height="125" rx="10" fill="#080e1c" stroke="url(#machineNeon)" strokeWidth="3" filter="url(#glowLight)" />
                    {/* Header Marquee */}
                    <rect x="8" y="8" width="114" height="18" rx="4" fill="#1e1b4b" stroke="#00f5ff" strokeWidth="1" />
                    <text x="65" y="21" textAnchor="middle" fill="#00f5ff" fontSize="7.5" fontWeight="bold" fontFamily="var(--mono)">
                      IMPOSSIBLE VENDING
                    </text>
                    {/* Glass Window with Coils & Gifts */}
                    <rect x="10" y="30" width="110" height="60" rx="5" fill="rgba(6, 182, 212, 0.22)" stroke="#00f5ff" strokeWidth="1.5" />
                    {/* Coils & Colorful Gift Spheres */}
                    <line x1="16" y1="46" x2="114" y2="46" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="6 4" />
                    <circle cx="32" cy="46" r="6" fill="#facc15" filter="url(#glowLight)" />
                    <circle cx="58" cy="46" r="6" fill="#ff4b72" filter="url(#glowLight)" />
                    <circle cx="84" cy="46" r="6" fill="#00f5ff" filter="url(#glowLight)" />
                    <line x1="16" y1="68" x2="114" y2="68" stroke="#a855f7" strokeWidth="2.5" strokeDasharray="6 4" />
                    <circle cx="32" cy="68" r="6" fill="#38bdf8" />
                    <circle cx="58" cy="68" r="6" fill="#4ade80" />
                    <circle cx="84" cy="68" r="6" fill="#fb923c" />

                    {/* Coin Slot with Pulsing Glow Pointer */}
                    <g transform="translate(78, 94)">
                      <rect x="0" y="0" width="40" height="18" rx="3" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" className="animated-coin-slot" />
                      <circle cx="10" cy="9" r="3.5" fill="#f59e0b" />
                      <text x="26" y="12" textAnchor="middle" fill="#f59e0b" fontWeight="bold" fontSize="6.5" fontFamily="var(--mono)">COIN</text>
                    </g>
                    {/* Prize Chute */}
                    <rect x="14" y="93" width="56" height="24" rx="4" fill="#020617" stroke="#334155" strokeWidth="1.5" />
                    <text x="42" y="108" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="6.5" fontFamily="var(--mono)">PRIZE CHUTE</text>
                  </g>
                </g>

                {/* 4. GROUND FLOOR LOBBY (P2) POLISHED REFLECTIVE MARBLE */}
                <polygon points="0,440 0,370 840,370 840,440" fill="url(#marbleTile)" />
                <line x1="0" y1="400" x2="840" y2="400" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />

                {/* Left Side: Automatic Sliding Glass Doors from Parking */}
                <g transform="translate(20, 305)">
                  <rect x="0" y="0" width="12" height="75" fill="#334155" />
                  <rect x="90" y="0" width="12" height="75" fill="#334155" />
                  <rect x="12" y="4" width="22" height="67" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" strokeWidth="1.5" />
                  <rect x="68" y="4" width="22" height="67" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" strokeWidth="1.5" />
                  <rect x="-8" y="-14" width="120" height="14" rx="2" fill="#0f172a" stroke="#00f5ff" strokeWidth="1" />
                  <text x="52" y="-3" textAnchor="middle" fill="#00f5ff" fontSize="7" fontFamily="var(--mono)">
                    ◄ FROM PARKING P2-23
                  </text>
                </g>

                {/* ========================================================
                    5. THE CENTRAL GLASS ELEVATOR TOWER (x = 350 to 540)
                    A Realistic, Magnificent Glass Lift Shaft & Moving Cabin!
                    ======================================================== */}
                <g transform="translate(350, 20)">
                  {/* Vertical Steel & Glass Shaft Columns */}
                  <rect x="0" y="10" width="190" height="350" fill="url(#shaftGlassGrad)" stroke="#00f5ff" strokeWidth="2.5" />
                  <line x1="25" y1="10" x2="25" y2="360" stroke="#00f5ff" strokeWidth="1" strokeDasharray="6 6" />
                  <line x1="165" y1="10" x2="165" y2="360" stroke="#00f5ff" strokeWidth="1" strokeDasharray="6 6" />

                  {/* Top Machine House & Hoist Cables */}
                  <rect x="-5" y="-5" width="200" height="18" rx="4" fill="#020617" stroke="#00ff88" strokeWidth="2" />
                  <text x="95" y="8" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="8.5" fontFamily="var(--mono)">
                    🛗 CENTRAL GLASS LIFT
                  </text>
                  {/* Steel Hoist Cables connected to cabin */}
                  <line x1="75" y1="10" x2="75" y2={cabinY} stroke="#94a3b8" strokeWidth="2" />
                  <line x1="115" y1="10" x2="115" y2={cabinY} stroke="#94a3b8" strokeWidth="2" />

                  {/* Shaft Floor Landing Markers */}
                  <g transform="translate(165, 45)">
                    <rect x="5" y="0" width="18" height="14" rx="2" fill={currentFloor === "L2" ? "#00ff88" : "#334155"} />
                    <text x="14" y="10" textAnchor="middle" fill={currentFloor === "L2" ? "#000" : "#fff"} fontWeight="bold" fontSize="8">L2</text>
                  </g>
                  <g transform="translate(165, 165)">
                    <rect x="5" y="0" width="18" height="14" rx="2" fill={currentFloor === "L1" ? "#00ff88" : "#334155"} />
                    <text x="14" y="10" textAnchor="middle" fill={currentFloor === "L1" ? "#000" : "#fff"} fontWeight="bold" fontSize="8">L1</text>
                  </g>
                  <g transform="translate(165, 285)">
                    <rect x="5" y="0" width="18" height="14" rx="2" fill={currentFloor === "P2" ? "#00ff88" : "#334155"} />
                    <text x="14" y="10" textAnchor="middle" fill={currentFloor === "P2" ? "#000" : "#fff"} fontWeight="bold" fontSize="8">P2</text>
                  </g>

                  {/* ====================================================
                      THE MOVING GLASS ELEVATOR CABIN (Y = cabinY)
                      Physically moves from 285 up to 45!
                      ==================================================== */}
                  <g
                    transform={`translate(20, ${cabinY})`}
                    style={{ transition: "transform 0.1s linear" }}
                  >
                    {/* Cabin Steel Outer Frame */}
                    <rect x="0" y="0" width="150" height="95" rx="8" fill="#070d1a" stroke="#00ff88" strokeWidth="3" filter="url(#glowLight)" />
                    {/* Panoramic Curved Glass Panel */}
                    <rect x="6" y="8" width="138" height="78" rx="6" fill="url(#cabinGlass)" stroke="#38bdf8" strokeWidth="1.5" />

                    {/* Digital LED Floor Display Inside Cabin */}
                    <rect x="35" y="14" width="80" height="18" rx="4" fill="#020617" stroke="#00ff88" strokeWidth="1" />
                    <text x="75" y="27" textAnchor="middle" fill="#00ff88" fontWeight="bold" fontSize="9" fontFamily="var(--mono)">
                      FLOOR: {currentFloor}
                    </text>

                    {/* DUAL SLIDING ELEVATOR DOORS */}
                    <g className="svg-cabin-doors">
                      {/* Left Door Panel */}
                      <rect
                        x="10"
                        y="10"
                        width="64"
                        height="76"
                        fill="rgba(15, 23, 42, 0.9)"
                        stroke="#00f5ff"
                        strokeWidth="1.5"
                        style={{
                          transform: doorsOpen ? "translateX(-60px)" : "none",
                          transition: "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                      />
                      {/* Right Door Panel */}
                      <rect
                        x="76"
                        y="10"
                        width="64"
                        height="76"
                        fill="rgba(15, 23, 42, 0.9)"
                        stroke="#00f5ff"
                        strokeWidth="1.5"
                        style={{
                          transform: doorsOpen ? "translateX(60px)" : "none",
                          transition: "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)",
                        }}
                      />
                    </g>
                  </g>
                </g>

                {/* ========================================================
                    6. THE ANIMATED FAMILY (DAD, MAYA, LEO)
                    Walking across the floor, entering the lift, ascending,
                    exiting the lift, and moving to the Play Area!
                    ======================================================== */}
                {(() => {
                  // Y coordinate for family:
                  // If on ground floor (walkPhase 0 or 1): Y = 380
                  // If inside cabin (walkPhase 2 or 3): Y moves with cabinY + 80!
                  // If on Level 2 (walkPhase 4, 5, 6): Y = 140!
                  const famY =
                    walkPhase <= 1
                      ? 380
                      : walkPhase === 2 || walkPhase === 3
                        ? 20 + cabinY + 76
                        : 140;

                  const isWalking = walkPhase === 0 || walkPhase === 1 || walkPhase === 4 || walkPhase === 5;

                  return (
                    <g transform={`translate(${familyX}, ${famY})`}>
                      {/* Floor shadow */}
                      <ellipse cx="25" cy="0" rx="35" ry="4" fill="rgba(0, 245, 255, 0.2)" />

                      {/* Dad */}
                      <g transform="translate(0, -26)" className={isWalking ? "animated-walking-actor" : undefined}>
                        <circle cx="0" cy="0" r="7.5" fill="#e2b186" />
                        <rect x="-5" y="8" width="10" height="22" rx="2" fill="#1e293b" />
                        <line x1="-3" y1="30" x2="-6" y2="48" stroke="#0f172a" strokeWidth="3" className={isWalking ? "animated-leg-left" : undefined} />
                        <line x1="3" y1="30" x2="6" y2="48" stroke="#0f172a" strokeWidth="3" className={isWalking ? "animated-leg-right" : undefined} />
                      </g>

                      {/* Maya (carrying shiny lucky coin) */}
                      <g transform="translate(30, -22)" className={isWalking ? "animated-walking-actor" : undefined}>
                        <circle cx="0" cy="0" r="6.5" fill="#e2b186" />
                        <circle cx="-5" cy="-2" r="2.5" fill="#713f12" />
                        <rect x="-4" y="7" width="8" height="17" rx="2" fill="#ff85a1" />
                        {/* Golden coin held high! */}
                        <line x1="4" y1="11" x2="16" y2="-6" stroke="#ff85a1" strokeWidth="2.5" />
                        <circle cx="18" cy="-8" r="5.5" fill="#ffd700" stroke="#f59e0b" strokeWidth="1.5" className="animated-lucky-coin" />
                        <line x1="-2" y1="24" x2="-5" y2="42" stroke="#0f172a" strokeWidth="2.5" className={isWalking ? "animated-leg-left" : undefined} />
                        <line x1="2" y1="24" x2="5" y2="42" stroke="#0f172a" strokeWidth="2.5" className={isWalking ? "animated-leg-right" : undefined} />
                      </g>

                      {/* Leo (wearing cap, jumping when arrived) */}
                      <g transform="translate(56, -20)" className={walkPhase >= 5 ? "animated-jump" : isWalking ? "animated-walking-actor" : undefined}>
                        <circle cx="0" cy="0" r="6" fill="#e2b186" />
                        <rect x="-4" y="-3" width="8" height="3" fill="#38bdf8" />
                        <rect x="-3" y="6" width="6" height="15" rx="2" fill="#38bdf8" />
                        {/* Arms in air when arrived at machine */}
                        {walkPhase >= 5 ? (
                          <>
                            <line x1="-3" y1="9" x2="-10" y2="-4" stroke="#38bdf8" strokeWidth="2.5" />
                            <line x1="3" y1="9" x2="10" y2="-4" stroke="#38bdf8" strokeWidth="2.5" />
                          </>
                        ) : null}
                        <line x1="-2" y1="21" x2="-4" y2="38" stroke="#0f172a" strokeWidth="2.5" className={isWalking ? "animated-leg-left" : undefined} />
                        <line x1="2" y1="21" x2="4" y2="38" stroke="#0f172a" strokeWidth="2.5" className={isWalking ? "animated-leg-right" : undefined} />
                      </g>
                    </g>
                  );
                })()}
              </svg>
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
