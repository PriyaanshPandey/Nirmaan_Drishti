import React, { useEffect, useRef, useCallback } from 'react';
import './ScrollHero.css';

interface ScrollHeroProps {
  activeTab?: string;
}

const TOTAL_FRAMES = 101;

// Exact naming pattern in public/scroll/
const getFramePath = (index: number): string => {
  const frameNum = String(index + 1).padStart(3, '0');
  return `/scroll/ezgif-frame-${frameNum}.jpg`;
};

export const ScrollHero: React.FC<ScrollHeroProps> = ({ activeTab }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hintRef = useRef<HTMLDivElement | null>(null);
  const dissolveOverlayRef = useRef<HTMLDivElement | null>(null);

  // In-memory image buffer
  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const currentFrameIndexRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  /**
   * Draw frame to canvas using object-fit: cover while strictly preserving 16:9 aspect ratio
   */
  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Pick target image, or fallback to closest loaded image (Frame 0 is guaranteed loaded)
    let img = imagesRef.current[frameIndex];
    if (!img || !img.complete || img.naturalWidth === 0) {
      for (let delta = 1; delta < TOTAL_FRAMES; delta++) {
        const prev = frameIndex - delta;
        if (prev >= 0 && imagesRef.current[prev]?.complete && (imagesRef.current[prev]?.naturalWidth || 0) > 0) {
          img = imagesRef.current[prev];
          break;
        }
        const next = frameIndex + delta;
        if (next < TOTAL_FRAMES && imagesRef.current[next]?.complete && (imagesRef.current[next]?.naturalWidth || 0) > 0) {
          img = imagesRef.current[next];
          break;
        }
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgWidth = img.naturalWidth || 1280;
    const imgHeight = img.naturalHeight || 720;

    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let renderWidth = canvasWidth;
    let renderHeight = canvasHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasRatio > imgRatio) {
      renderWidth = canvasWidth;
      renderHeight = canvasWidth / imgRatio;
      offsetY = (canvasHeight - renderHeight) / 2;
    } else {
      renderHeight = canvasHeight;
      renderWidth = canvasHeight * imgRatio;
      offsetX = (canvasWidth - renderWidth) / 2;
    }

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
  }, []);

  /**
   * Sync canvas internal resolution with devicePixelRatio for sharpness
   */
  const syncCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    const pixelWidth = Math.round(displayWidth * dpr);
    const pixelHeight = Math.round(displayHeight * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    drawFrame(currentFrameIndexRef.current);
  }, [drawFrame]);

  // Load Frame 001 immediately (0ms blank screen), then stream-load frames 1-100 in background
  useEffect(() => {
    let isCancelled = false;

    // Immediately size canvas
    syncCanvasDimensions();

    // 1. Prioritize Frame 0 (ezgif-frame-001.jpg)
    const frame0 = new Image();
    const onFrame0Ready = () => {
      if (isCancelled) return;
      imagesRef.current[0] = frame0;
      drawFrame(0);
    };

    frame0.onload = onFrame0Ready;
    frame0.onerror = onFrame0Ready;
    frame0.src = getFramePath(0);
    if (frame0.complete && frame0.naturalWidth > 0) {
      onFrame0Ready();
    }

    // 2. Preload remaining frames concurrently without blocking Frame 0
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      const onImgReady = () => {
        if (isCancelled) return;
        imagesRef.current[i] = img;
        if (currentFrameIndexRef.current === i) {
          drawFrame(i);
        }
      };

      img.onload = onImgReady;
      img.onerror = onImgReady;
      img.src = getFramePath(i);
      if (img.complete && img.naturalWidth > 0) {
        onImgReady();
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [drawFrame, syncCanvasDimensions]);

  // Scroll listener mapped to frame index + smooth white dissolve to match the main page
  useEffect(() => {
    const handleScroll = () => {
      if (rafIdRef.current !== null) return;

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const totalScrollDistance = rect.height - window.innerHeight;
        if (totalScrollDistance <= 0) return;

        const scrolled = -rect.top;
        const progress = Math.min(Math.max(scrolled / totalScrollDistance, 0), 1);

        // Map 0..1 to 0..100
        const targetFrame = Math.min(
          Math.floor(progress * (TOTAL_FRAMES - 1)),
          TOTAL_FRAMES - 1
        );

        if (targetFrame !== currentFrameIndexRef.current) {
          currentFrameIndexRef.current = targetFrame;
          drawFrame(targetFrame);
        }

        // As user scrolls, gently soften canvas opacity over white (1.0 -> 0.65)
        // This masks low resolution / artifacts while blending seamlessly into the white page
        if (canvasRef.current) {
          const targetOpacity = Math.max(0.65, 1.0 - progress * 0.35);
          canvasRef.current.style.opacity = `${targetOpacity.toFixed(3)}`;
        }

        // Dissolve into white towards the very end (progress 0.75 -> 1.0) so the switch to main page is 100% seamless
        if (dissolveOverlayRef.current) {
          if (progress > 0.75) {
            const dissolveVal = Math.min((progress - 0.75) / 0.25, 0.45);
            dissolveOverlayRef.current.style.opacity = `${dissolveVal.toFixed(3)}`;
          } else {
            dissolveOverlayRef.current.style.opacity = '0';
          }
        }

        // Hide scroll hint once user scrolls
        if (hintRef.current) {
          if (progress > 0.02) {
            hintRef.current.style.opacity = '0';
            hintRef.current.style.pointerEvents = 'none';
          } else {
            hintRef.current.style.opacity = '1';
            hintRef.current.style.pointerEvents = 'auto';
          }
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', syncCanvasDimensions);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', syncCanvasDimensions);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [drawFrame, syncCanvasDimensions]);

  // Re-sync canvas when tab switches back to home
  useEffect(() => {
    if (activeTab === 'home') {
      setTimeout(() => {
        syncCanvasDimensions();
        drawFrame(currentFrameIndexRef.current);
      }, 30);
    }
  }, [activeTab, syncCanvasDimensions, drawFrame]);

  return (
    <section className="scroll-hero-container" ref={containerRef}>
      <div className="scroll-hero-sticky">
        {/* Full-viewport Canvas */}
        <canvas
          className="scroll-hero-canvas"
          ref={canvasRef}
          aria-label="Full-screen scroll-driven sequence animation"
        />

        {/* Feathered bottom dissolve to eliminate any hard line into the main page */}
        <div className="scroll-hero-bottom-feather" />

        {/* Gentle white blend overlay active during scroll to smooth transition into main page */}
        <div className="scroll-hero-dissolve-overlay" ref={dissolveOverlayRef} />

        {/* Minimal scroll hint on initial frame (fades on first scroll) */}
        <div className="scroll-hero-hint" ref={hintRef}>
          <div className="scroll-mouse-icon">
            <div className="scroll-mouse-wheel" />
          </div>
          <span>Scroll down to play</span>
        </div>
      </div>
    </section>
  );
};
