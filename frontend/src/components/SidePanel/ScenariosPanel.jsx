// Import hooks for the reveal timer
import { useEffect, useRef, useState } from "react";

// Short background story shown at the top of the panel
const STORY =
  "Friday morning, peak hour. Passengers move through Terminal 3 — check-in, baggage drop, security screening, passport control and boarding — seemingly a simple move from one station to the next.";

// The four scenarios (brief versions), each with the time it is revealed.
// Times are measured from the moment the chat opens, matching the reveals that
// appear inside the chat itself (event 1 from the start, then 7 / 14 / 21 min).
const SCENARIOS = [
  { afterMs: 0, text: "The automated baggage-sorting system slows to 60% of its normal rate due to a conveyor-belt fault." },
  { afterMs: 7 * 60 * 1000, text: "Two of the eight security-screening stations close due to a staff shortage." },
  { afterMs: 14 * 60 * 1000, text: "An airline moves up the boarding gate of a large flight — a crowd of passengers is pulled at once to one area." },
  { afterMs: 21 * 60 * 1000, text: "Stormy weather and aircraft congestion delay moving planes to the main runway by about 20 minutes, disrupting other aircraft's schedules." },
];

// Displays the background story and reveals the scenarios one by one over time,
// in parallel with the update messages the participant receives in the chat.
function ScenariosPanel() {
  // How many scenarios are currently revealed (event 1 is shown from the start)
  const [revealedCount, setRevealedCount] = useState(1);

  // The moment this panel opened, used to time the reveals
  const startRef = useRef(Date.now());

  useEffect(() => {
    // Check every few seconds whether the next scenario is due to appear
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;

      // The number of scenarios whose reveal time has already passed
      const due = SCENARIOS.filter((s) => elapsed >= s.afterMs).length;

      // Reveal any scenarios that have become due
      setRevealedCount((count) => (due > count ? due : count));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-md backdrop-blur-xl transition-colors sm:p-6 dark:border-white/5 dark:bg-[#1e2333]/80 dark:shadow-xl"
      dir="ltr"
    >
      {/* Panel title */}
      <h2 className="mb-3 text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl dark:text-white">
        Background story and scenarios
      </h2>

      {/* Background story */}
      <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {STORY}
      </p>

      {/* Revealed scenarios as a bulleted list */}
      <ul className="flex flex-col gap-2">
        {SCENARIOS.slice(0, revealedCount).map((scenario, index) => (
          <li
            key={index}
            className="flex gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm leading-relaxed text-slate-700 animate-in fade-in slide-in-from-bottom-1 duration-500 dark:border-indigo-500/20 dark:bg-indigo-950/30 dark:text-slate-200"
          >
            {/* Scenario number badge */}
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {index + 1}
            </span>
            <span>{scenario.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Export the component for use in the side panel
export default ScenariosPanel;
