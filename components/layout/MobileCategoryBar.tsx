"use client";

export type MobileTab = "all" | "market" | "research" | "macro";

interface MobileCategoryBarProps {
  mobileTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
}

const TABS: { id: MobileTab; label: string }[] = [
  { id: "all", label: "ALL PANELS" },
  { id: "market", label: "MARKET" },
  { id: "research", label: "RESEARCH" },
  { id: "macro", label: "MACRO" },
];

export default function MobileCategoryBar({ mobileTab, onSelectTab }: MobileCategoryBarProps) {
  return (
    <nav className="mobile-category-bar" aria-label="Mobile workspace category navigation">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`mobile-cat-btn${mobileTab === tab.id ? " active" : ""}`}
          onClick={() => onSelectTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

