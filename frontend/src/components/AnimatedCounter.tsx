import React, { useState, useEffect, useRef } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  formatter?: (val: number) => string;
  resetKey?: string | number;
  triggerKey?: string | number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 900,
  formatter,
  resetKey,
  triggerKey
}) => {
  const [count, setCount] = useState<number>(0);
  const animRef = useRef<number>(0);

  const activeResetTrigger = resetKey !== undefined ? resetKey : triggerKey;

  useEffect(() => {
    if (value === 0) {
      setCount(0);
      return;
    }

    setCount(0);
    let startTimestamp: number | null = null;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out formula
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * value);
      setCount(current);

      if (progress < 1) {
        animRef.current = window.requestAnimationFrame(step);
      } else {
        setCount(value);
      }
    };

    animRef.current = window.requestAnimationFrame(step);
    return () => {
      if (animRef.current) {
        window.cancelAnimationFrame(animRef.current);
      }
    };
  }, [value, duration, activeResetTrigger]);

  return (
    <span className="animated-counter-span" style={{ display: 'inline-block' }}>
      {formatter ? formatter(count) : count.toLocaleString()}
    </span>
  );
};
