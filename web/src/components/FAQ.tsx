import { useState } from "react";

const faqs = [
  {
    q: "What is Niro?",
    a: "Niro is your AI buddy that lives on your desktop. It understands how you work, helps with tasks, and keeps your data private.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
  {
    q: "Is my data private?",
    a: "Yes. Your data stays on your device and is never shared with anyone.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
  },
  {
    q: "Where is my data stored?",
    a: "Everything is stored locally on your device. Nothing leaves your machine.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
      </svg>
    ),
  },
  {
    q: "What platforms does Niro support?",
    a: "Windows is fully supported. Linux support is coming soon.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      </svg>
    ),
  },
  {
    q: "Can I use Niro offline?",
    a: "Yes, with limited capabilities. Core features work offline; some advanced AI features need a connection.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    q: "How is Niro different from other AI tools?",
    a: "It adapts specifically to you and works quietly in the background — no prompting required.",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/>
      </svg>
    ),
  },
];

const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const ChevronUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

const FAQ = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        .faq-root, .faq-root * { font-family: 'Nunito', sans-serif; }
      `}</style>

      <div className="faq-root bg-[#0b0b0b] text-white" style={{ minHeight: "calc(100vh - 57px)" }}>
        <div className="flex" style={{ minHeight: "calc(100vh - 57px)" }}>

          {/* Left panel */}
          <div className="w-[300px] shrink-0 px-10 py-16 border-r border-white/5 flex flex-col justify-between">
            <div>
              <p className="text-green-400 text-xs tracking-widest uppercase mb-3" style={{ fontWeight: 700 }}>
                FAQ
              </p>
              <h1 className="text-4xl leading-tight" style={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
                You asked,<br />
                we <span className="text-green-400">answered.</span>
              </h1>
              <p className="text-gray-400 text-sm mt-4 leading-relaxed" style={{ fontWeight: 400 }}>
                Everything you need to know about Niro.
              </p>
            </div>
          </div>

          {/* Right panel — accordion */}
          <div className="flex-1 px-10 py-16">
            <div className="max-w-2xl space-y-2">
              {faqs.map((faq, i) => {
                const isOpen = open === i;
                return (
                  <div
                    key={i}
                    className="bg-[#161616] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/10 transition-colors"
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left"
                    >
                      <div className="w-8 h-8 shrink-0 rounded-lg bg-green-400/10 border border-green-400/20 flex items-center justify-center text-green-400">
                        {faq.icon}
                      </div>
                      <span className="flex-1 text-sm text-white" style={{ fontWeight: 600 }}>{faq.q}</span>
                      <span className="text-gray-400 shrink-0">
                        {isOpen ? <ChevronUp /> : <ChevronDown />}
                      </span>
                    </button>

                    <div
                      className={`px-5 text-gray-400 text-sm transition-all duration-300 ease-in-out leading-relaxed ${
                        isOpen ? "max-h-40 pb-5 opacity-100" : "max-h-0 opacity-0"
                      } overflow-hidden`}
                      style={{ fontWeight: 400 }}
                    >
                      {faq.a}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default FAQ;