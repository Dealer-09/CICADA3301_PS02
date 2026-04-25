import { Routes, Route } from "react-router-dom";
import Onboarding from "./Onboarding";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import FAQ from "./components/FAQ";
import Navbar from "./components/Navbar";

export default function App() {
  return (
    <div style={{ background: "#0b0b0b", minHeight: "100vh", color: "#fff" }}>
    <Navbar />
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/features" element={<Features />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/faq" element={<FAQ />} />
    </Routes>
    </div>
  );
}