"use client";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
gsap.registerPlugin(useGSAP);
export default function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.fromTo(ref.current, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .55, ease: "power2.out", clearProps: "all" });
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}
