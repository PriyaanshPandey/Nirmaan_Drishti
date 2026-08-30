import React, { useState, useEffect, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
  /** Change this key to force the counter to re-animate (e.g., pass the page tab name) */
  triggerKey?: string | number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 900,
  formatter,
  triggerKey,
}) => {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const animRef = useRef<number>(0);

  // IntersectionObserver: start count-up when element enters viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            setCount(0); // reset so animation always plays
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [triggerKey]);

  // Animate count from 0 → value whenever visible or value changes
  useEffect(() => {
    if (!visible || value === 0) {
      setCount(value);
      return;
    }

    let startTimestamp: number | null = null;
    const startVal = 0;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(startVal + eased * (value - startVal)));

      if (progress < 1) {
        animRef.current = window.requestAnimationFrame(step);
      } else {
        setCount(value);
      }
    };

    animRef.current = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animRef.current);
  }, [visible, value, duration, triggerKey]);

  return (
    <span ref={ref} className="animated-counter-span" style={{ display: 'inline-block' }}>
      {formatter ? formatter(count) : count.toLocaleString()}
    </span>
  );
};
