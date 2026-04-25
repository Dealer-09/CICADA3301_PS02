import type { JSX } from "react";

const featureIcons: Record<string, JSX.Element> = {
  "Understands you": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  "Handles tasks": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  "Private by design": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  "Always there": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  ),
  "Works with your apps": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  "Built to evolve": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/>
    </svg>
  ),
};

const features = [
  { title: "Understands you", desc: "Learns how you communicate and what matters to you." },
  { title: "Handles tasks", desc: "Takes care of small things so you can focus on big things." },
  { title: "Private by design", desc: "Your data stays on your device. Always yours." },
  { title: "Always there", desc: "Lives in the background and shows up when you need it." },
  { title: "Works with your apps", desc: "Connects with tools you use every day." },
  { title: "Built to evolve", desc: "Keeps getting better with you every single day." },
];

const Features = () => {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        .features-root, .features-root * { font-family: 'Nunito', sans-serif; }
      `}</style>

      <div className="features-root bg-[#0b0b0b] text-white" style={{ minHeight: "calc(100vh - 57px)" }}>
        <div className="flex" style={{ minHeight: "calc(100vh - 57px)" }}>

          {/* Left panel */}
          <div className="w-[340px] shrink-0 px-10 py-16 flex flex-col justify-between border-r border-white/5">
            <div>
              <p className="text-green-400 text-xs tracking-widest uppercase mb-3" style={{ fontWeight: 700 }}>
                Features
              </p>
              <h1 className="text-4xl leading-tight" style={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
                Built to be<br />
                your <span className="text-green-400">buddy.</span>
              </h1>
              <p className="text-gray-400 text-sm mt-4 leading-relaxed" style={{ fontWeight: 400 }}>
                Niro lives on your desktop, understands your world and helps you get things done — quietly.
              </p>
            </div>
          </div>

          {/* Right panel — feature cards */}
          <div className="flex-1 px-10 py-16">
            <div className="grid grid-cols-3 gap-4">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="bg-[#161616] border border-white/[0.06] rounded-2xl p-6 hover:border-green-400/30 transition-colors duration-200"
                >
                  <div className="w-10 h-10 mb-5 rounded-xl bg-green-400/10 border border-green-400/20 flex items-center justify-center text-green-400">
                    {featureIcons[f.title]}
                  </div>
                  <h3 className="text-base text-white" style={{ fontWeight: 700 }}>{f.title}</h3>
                  <p className="text-gray-400 text-sm mt-2 leading-relaxed" style={{ fontWeight: 400 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default Features;