import mascot2 from "../assets/mascot4.png";

const steps = [
  {
    n: "01",
    title: "You talk",
    desc: "Chat naturally or let Niro observe how you work.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    n: "02",
    title: "Niro learns",
    desc: "Understands your habits, preferences and context.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66z"/>
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66z"/>
      </svg>
    ),
  },
  {
    n: "03",
    title: "Niro helps",
    desc: "Suggests, automates and takes action for you.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    n: "04",
    title: "You achieve more",
    desc: "Save time, reduce stress and focus on what matters.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
  {
    n: "05",
    title: "Niro grows with you",
    desc: "Keeps improving and adapting to your world.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/>
      </svg>
    ),
  },
];

const RING_RADIUS = 220;
const CARD_W = 176;
const CARD_H = 88;

const HowItWorks = () => {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        .how-root, .how-root * { font-family: 'Nunito', sans-serif; }

        @keyframes spinCW {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes spinCCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }

        @keyframes spinRingCCW {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(-360deg); }
        }

        .orbit-ring {
          position: absolute;
          top: 50%; left: 50%;
          border-radius: 50%;
          animation: spinCW 80s linear infinite;
        }

        .orbit-card-wrap {
          position: absolute;
          animation: spinCCW 80s linear infinite;
        }

        .inner-ring {
          position: absolute;
          top: 50%; left: 50%;
          border-radius: 50%;
          animation: spinRingCCW 50s linear infinite;
          pointer-events: none;
        }

        .step-card {
          background: #161616;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 14px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          width: ${CARD_W}px;
          font-family: 'Nunito', sans-serif;
          transition: all 0.25s ease;
        }

        .step-card:hover {
          border-color: rgba(74,222,128,0.35);
          transform: translateY(-4px);
        }
      `}</style>

      <div className="how-root bg-[#0b0b0b] text-white flex" style={{ minHeight: "calc(100vh - 57px)" }}>

        {/* LEFT */}
        <div className="w-[300px] shrink-0 px-10 py-16 border-r border-white/5 flex flex-col justify-center">
          <p className="text-green-400 text-xs tracking-widest uppercase mb-3" style={{ fontWeight: 700 }}>
            How it works
          </p>

          <h1 className="text-3xl leading-tight" style={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
            Simple steps, <span className="text-green-400">smarter</span> every day.
          </h1>

          <p className="text-gray-400 text-sm mt-4 leading-relaxed" style={{ fontWeight: 400 }}>
            Niro learns, adapts and helps — so you can flow effortlessly.
          </p>
        </div>

        {/* RIGHT */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">

          {/* INNER RING */}
          <div
            className="inner-ring"
            style={{
              width: 140,
              height: 140,
              border: "1px solid rgba(74,222,128,0.12)",
            }}
          />

          {/* OUTER RING */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: RING_RADIUS * 2 + CARD_W,
              height: RING_RADIUS * 2 + CARD_W,
              transform: "translate(-50%,-50%)",
              borderRadius: "50%",
              border: "1px dashed rgba(255,255,255,0.06)",
            }}
          />

          {/* ROTATING */}
          <div
            className="orbit-ring"
            style={{
              width: RING_RADIUS * 2 + CARD_W,
              height: RING_RADIUS * 2 + CARD_W,
            }}
          >
            {steps.map((step, i) => {
              const angle = (i / steps.length) * 360;
              const rad = (angle - 90) * (Math.PI / 180);
              const r = RING_RADIUS + CARD_W / 2;

              const x = Math.cos(rad) * r;
              const y = Math.sin(rad) * r;
              const cx = (RING_RADIUS * 2 + CARD_W) / 2;

              return (
                <div
                  key={i}
                  className="orbit-card-wrap"
                  style={{
                    left: cx + x - CARD_W / 2,
                    top: cx + y - CARD_H / 2,
                  }}
                >
                  <div className="step-card">
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "rgba(74,222,128,0.08)",
                      border: "1px solid rgba(74,222,128,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#4ade80",
                      flexShrink: 0
                    }}>
                      {step.icon}
                    </div>

                    <div>
                      <p style={{ color: "#4ade80", fontSize: 10, fontWeight: 700 }}>
                        {step.n}
                      </p>
                      <p style={{ fontSize: 12, fontWeight: 700 }}>
                        {step.title}
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CENTER MASCOT */}
          <div className="relative z-10">
            <img src={mascot2} alt="Niro mascot" className="w-52 h-52" />
          </div>
        </div>
      </div>
    </>
  );
};

export default HowItWorks;