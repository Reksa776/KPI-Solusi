"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const motionTargets = [
  ".hero-grid > *", ".section-head", ".service-card", ".package-card",
  ".home-package-card", ".partner-panel", ".page-hero-inner > *",
  ".admin-heading", ".admin-stats > *", ".dashboard-metric", ".dashboard-note",
  ".admin-section-label", ".admin-table-wrap", ".analytics-panel",
  ".workflow-panel", ".workflow-form", ".package-edit-form",
  ".login-shell > *", ".footer-main > *",
];

export default function PageEntrance({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".page-entrance");
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const navigatorHints = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const lowDevice = (navigatorHints.deviceMemory !== undefined && navigatorHints.deviceMemory <= 4)
      || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4)
      || navigatorHints.connection?.saveData === true;
    root.classList.toggle("low-motion", lowDevice);

    const targets = [...new Set(root.querySelectorAll<HTMLElement>(motionTargets.join(",")))];
    if (!targets.length) return;

    const siblingCounts = new Map<Element, number>();
    targets.forEach((element) => {
      const parent = element.parentElement ?? root;
      const index = siblingCounts.get(parent) ?? 0;
      siblingCounts.set(parent, index + 1);
      const delay = lowDevice ? 45 : 130;
      element.style.setProperty("--component-delay", `${Math.min(index, 5) * delay}ms`);
      element.classList.add("component-enter");
      element.addEventListener("animationend", () => {
        element.classList.remove("component-enter", "component-enter-visible");
        element.style.removeProperty("--component-delay");
      }, { once: true });
    });

    if (!("IntersectionObserver" in window)) {
      targets.forEach((element) => element.classList.add("component-enter-visible"));
      return;
    }

    let observer: IntersectionObserver;
    const startObserving = () => {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("component-enter-visible");
          } else {
            entry.target.classList.remove("component-enter-visible");
          }
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -32px 0px" });
      targets.forEach((element) => observer.observe(element));
    };

    // Let the starting state paint before IntersectionObserver reveals the component.
    const firstFrame = requestAnimationFrame(() => requestAnimationFrame(startObserving));
    return () => {
      cancelAnimationFrame(firstFrame);
      observer?.disconnect();
      root.classList.remove("low-motion");
    };
  }, [pathname]);

  return <div key={pathname} className="page-entrance">{children}</div>;
}
