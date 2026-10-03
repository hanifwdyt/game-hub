import type { SVGProps } from "react";
type P = SVGProps<SVGSVGElement>;
const s = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const IconSearch = (p: P) => <svg viewBox="0 0 24 24" {...s} {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.8-4.8" /></svg>;
export const IconPlay = (p: P) => <svg viewBox="0 0 16 16" fill="currentColor" {...p}><path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5z" /></svg>;
export const IconHeart = (p: P) => <svg viewBox="0 0 24 24" {...s} {...p}><path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.8 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.4 0 5.6 3.3 4.4 6.7C19.5 15.4 12 20 12 20z" /></svg>;
export const IconPc = (p: P) => <svg viewBox="0 0 24 24" {...s} {...p}><rect x="2.5" y="4" width="19" height="12.5" rx="2" /><path d="M8.5 20.5h7M12 16.5v4" /></svg>;
export const IconMobile = (p: P) => <svg viewBox="0 0 24 24" {...s} {...p}><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M11 18.5h2" /></svg>;
export const IconSound = ({ off, ...p }: P & { off?: boolean }) => (
  <svg viewBox="0 0 24 24" {...s} {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
    {off ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.8 6a8.5 8.5 0 0 1 0 12" />}</svg>
);
export const IconGrid = (p: P) => <svg viewBox="0 0 24 24" {...s} {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>;
export const IconBack = (p: P) => <svg viewBox="0 0 24 24" {...s} {...p}><path d="M15 5l-7 7 7 7" /></svg>;
export const IconExpand = (p: P) => <svg viewBox="0 0 24 24" {...s} {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>;
export const IconReload = (p: P) => <svg viewBox="0 0 24 24" {...s} {...p}><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" /></svg>;
export const IconTrophy = (p: P) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M7 3h10v2h3a1 1 0 0 1 1 1v2a5 5 0 0 1-4.6 5A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 7.6 13 5 5 0 0 1 3 8V6a1 1 0 0 1 1-1h3zm0 4H5v1a3 3 0 0 0 2 2.8zm12 0h-2v3.8A3 3 0 0 0 19 8z" /></svg>;
export const IconClock = (p: P) => <svg viewBox="0 0 24 24" {...s} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
export const IconPad = (p: P) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M7 7h10a5 5 0 0 1 5 5l.5 4a3 3 0 0 1-5 2.4L15 16H9l-2.5 2.4a3 3 0 0 1-5-2.4L2 12a5 5 0 0 1 5-5z" /></svg>;
export const IconSpark = (p: P) => <svg viewBox="0 0 48 48" {...p}><path d="M24 4l5.5 14.5L44 24l-14.5 5.5L24 44l-5.5-14.5L4 24l14.5-5.5z" fill="#fff" /><circle cx="24" cy="24" r="4" fill="#0b0c12" /><circle cx="39" cy="9" r="2.4" fill="#fff" opacity=".7" /><circle cx="9" cy="39" r="1.8" fill="#fff" opacity=".5" /></svg>;
export const IconNews = (p: P) => <svg viewBox="0 0 24 24" {...s} {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 9h10M7 13h10M7 17h6" /></svg>;
export const Logo = (p: P) => (
  <svg viewBox="0 0 64 44" fill="none" {...p}><defs><linearGradient id="lg1" x1="0" y1="0" x2="64" y2="44"><stop stopColor="#9d8cff" /><stop offset="1" stopColor="#46b6ff" /></linearGradient></defs>
    <path d="M14 4h36c7 0 12 5 13 12l1 14c.4 7-6 12-12 9l-7-4H19l-7 4c-6 3-12-2-12-9l1-14C2 9 7 4 14 4z" fill="url(#lg1)" />
    <path d="M18 16v10M13 21h10" stroke="#0b0a12" strokeWidth="3.4" strokeLinecap="round" /><circle cx="44" cy="17" r="2.6" fill="#0b0a12" /><circle cx="50" cy="23" r="2.6" fill="#0b0a12" /></svg>
);
