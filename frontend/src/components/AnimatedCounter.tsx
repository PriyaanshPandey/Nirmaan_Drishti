import React, { useState, useEffect } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number; // duration in ms
  formatter?: (val: number) => string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, duration = 800, formatter }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentCount = Math.floor(easeProgress * value);
      
      setCount(currentCount);
      
      if (progress < 1) {
        animId = window.requestAnimationFrame(step);
      } else {
        setCount(value);
      }
    };
    
    animId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(animId);
    };
  }, [value, duration]);

  return <>{formatter ? formatter(count) : count.toLocaleString()}</>;
};
