import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, ChevronDown } from 'lucide-react';
import './VideoHero.css';

interface VideoHeroProps {
  activeTab?: string;
}

export const VideoHero: React.FC<VideoHeroProps> = ({ activeTab }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isBlurring, setIsBlurring] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [hasAutoScrolled, setHasAutoScrolled] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const autoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth scroll helper to main section
  const scrollToContent = useCallback(() => {
    const el = document.getElementById('home-main-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }
  }, []);

  // Replay video when switching back to home tab if at the top
  useEffect(() => {
    if (activeTab === 'home' && window.scrollY < 100) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        video.playbackRate = 2.8;
        video.play().catch(() => {});
        setIsBlurring(false);
        setHasAutoScrolled(false);
      }
    }
  }, [activeTab]);

  // Monitor video playback time to trigger blur-out (around 2.2s real time)
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    // At 2.8x speed, 6.2s in video = ~2.2s real time
    if (video.currentTime >= 6.2 && !isBlurring) {
      setIsBlurring(true);
    }
  };

  // Video finished playing (~3.0s) -> smooth scroll down immediately
  const handleVideoEnded = () => {
    setIsBlurring(true);
    if (!hasAutoScrolled) {
      setHasAutoScrolled(true);
      scrollToContent();
    }
  };

  // Sound toggle handler
  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  // Hide floating controls when user scrolls down manually
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setShowControls(false);
      } else {
        setShowControls(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Configure 2.8x speed playback and guaranteed 3.0s auto-scroll trigger
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // 8.38s video / 2.8x playbackRate = 2.99s (~3.0s total playtime)
      video.playbackRate = 2.8;
      video.play().catch(() => {
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {});
      });
    }

    // Blur-out bloom at 2.2 seconds
    const blurTimer = setTimeout(() => {
      setIsBlurring(true);
    }, 2200);

    // Guaranteed auto-scroll at 3.0 seconds
    autoScrollTimerRef.current = setTimeout(() => {
      if (!hasAutoScrolled) {
        setHasAutoScrolled(true);
        scrollToContent();
      }
    }, 3000);

    return () => {
      clearTimeout(blurTimer);
      if (autoScrollTimerRef.current) {
        clearTimeout(autoScrollTimerRef.current);
      }
    };
  }, [hasAutoScrolled, scrollToContent]);

  return (
    <section className="video-hero-container">
      {/* Full-viewport Background Video (Plays in 3 seconds at 2.8x speed) */}
      <video
        ref={videoRef}
        className={`video-hero-media ${isBlurring ? 'is-blurring' : ''}`}
        src="/video.mp4"
        autoPlay
        muted={isMuted}
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleVideoEnded}
      />

      {/* Dreamy white blur/dissolve overlay triggered near the end */}
      <div className={`video-hero-dissolve ${isBlurring ? 'is-active' : ''}`} />

      {/* Feathered bottom dissolve to eliminate any hard line with the main section */}
      <div className="video-hero-bottom-feather" />

      {/* Sound Toggle Button */}
      {showControls && (
        <button
          type="button"
          className="video-hero-sound-btn"
          onClick={toggleSound}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          <span>{isMuted ? 'Sound Off' : 'Sound On'}</span>
        </button>
      )}

      {/* Sleek Skip / Scroll Down CTA */}
      {showControls && (
        <button
          type="button"
          className="video-hero-skip-cta"
          onClick={scrollToContent}
          aria-label="Skip to main content"
        >
          <span>Explore Overview</span>
          <ChevronDown size={16} className="skip-arrow-bounce" />
        </button>
      )}
    </section>
  );
};

// Export alias for backward compatibility
export const ScrollHero = VideoHero;
