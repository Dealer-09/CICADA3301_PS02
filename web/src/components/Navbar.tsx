import { NavLink } from "react-router-dom";

const navItems = [
  { name: "Home", path: "/" },
  { name: "Features", path: "/features" },
  { name: "How it works", path: "/how-it-works" },
  { name: "FAQ", path: "/faq" },
];

const Navbar = () => {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Syne:wght@700&display=swap');
        .niro-navbar * { font-family: 'Nunito', sans-serif; }
      `}</style>

      <div className="niro-navbar" style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        padding: "14px 40px",
        background: "#0b0b0b",
        color: "#fff",
        boxSizing: "border-box",
      }}>

      {/* Left — Logo */}
      <h1 style={{
        fontSize: 22,
        fontWeight: 700,
        fontFamily: "'Syne', sans-serif",
        letterSpacing: "0",
        margin: 0,
      }}>
        Ni<span style={{ color: "#4ade80" }}>ro</span>
      </h1>

        {/* Center — Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              style={{ textDecoration: "none" }}
            >
              {({ isActive }) => (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}>
                  <span style={{
                    fontSize: 13.5,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
                    transition: "color 0.2s",
                    fontFamily: "'Nunito', sans-serif",
                    letterSpacing: "0.01em",
                  }}>
                    {item.name}
                  </span>
                  <span style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "#4ade80",
                    opacity: isActive ? 1 : 0,
                    transition: "opacity 0.2s",
                  }} />
                </div>
              )}
            </NavLink>
          ))}
        </div>

        {/* Right — spacer */}
        <div />
      </div>
    </>
  );
};

export default Navbar;