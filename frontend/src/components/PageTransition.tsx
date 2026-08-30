/**
 * PageTransition — cross-dissolve page switcher.
 *
 * Strategy: ALL pages stay MOUNTED in the DOM at all times.
 * Only the active page is visible. Hidden pages are
 * collapsed to 0x0 with visibility:hidden (no layout cost,
 * but React state + component memory is fully preserved).
 *
 * This means:
 *  - Navigation is instant (no remount)
 *  - API data is cached in component state (no re-fetch on revisit)
 *  - Transition animates only the incoming page
 */

import React, { useEffect, useRef, useState } from 'react';
import './PageTransition.css';

interface PageSlotProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
}

type SlotState = 'hidden' | 'entering' | 'active' | 'exiting';

export const PageSlot: React.FC<PageSlotProps> = ({ id, activeTab, children }) => {
  const isActive = activeTab === id;
  const [slotState, setSlotState] = useState<SlotState>(isActive ? 'active' : 'hidden');
  const prevActiveRef = useRef(isActive);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = isActive;

    // Clear any pending timers
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);

    if (isActive && !wasActive) {
      // Page is becoming active → play enter animation
      setSlotState('entering');
      enterTimerRef.current = setTimeout(() => {
        setSlotState('active');
      }, 300); // matches animation duration
    } else if (!isActive && wasActive) {
      // Page is becoming inactive → play exit then hide
      setSlotState('exiting');
      exitTimerRef.current = setTimeout(() => {
        setSlotState('hidden');
      }, 160); // matches exit animation duration
    }

    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [isActive]);

  return (
    <div className={`page-slot page-${slotState}`} aria-hidden={!isActive}>
      {children}
    </div>
  );
};
