import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Volume2, VolumeX, ChevronDown } from 'lucide-react';
import './VideoHero.css';

interface VideoHeroProps {
  activeTab?: string;
  onFinished?: () => void;
}

export const VideoHero: React.FC<VideoHeroProps> = ({ onFinished }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isBlurring, setIsBlurring] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);

  // Dismiss video intro (fade overlay out without scrolling)
  const dismissVideo = () => {
    setIsBlurring(true);
    setIsDismissed(true);
    setTimeout(() => {
      if (onFinished) onFinished();
    }, 800);
  };

  // Monitor playback time to trigger blur-out (at ~2.2s real time)
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    // At 2.8x speed, 6.2s in video = ~2.2s in real time
    if (video.currentTime >= 6.2 && !isBlurring) {
      setIsBlurring(true);
    }
  };

  // Video finished playing (~3.0s) -> blur out and dismiss overlay smoothly
  const handleVideoEnded = () => {
    setIsBlurring(true);
    setTimeout(() => {
      dismissVideo();
    }, 150);
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

  // Configure 2.8x speed playback and guaranteed 3.0s dismiss trigger
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = 2.8;
      video.play().catch(() => {
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {});
      });
    }

    // Snappy blur-out bloom at 2.2 seconds
    const blurTimer = setTimeout(() => {
      setIsBlurring(true);
    }, 2200);

    // Guaranteed dismiss at 3.0 seconds
    const dismissTimer = setTimeout(() => {
      dismissVideo();
    }, 3000);

    return () => {
      clearTimeout(blurTimer);
      clearTimeout(dismissTimer);
    };
  }, []);

  // Render via portal directly into document.body to cover every inch of the screen edge-to-edge
  return ReactDOM.createPortal(
    <div className={`video-hero-overlay ${isDismissed ? 'is-dismissed' : ''}`}>
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

      {/* Feathered bottom dissolve */}
      <div className="video-hero-bottom-feather" />

      {/* Sound Toggle Button */}
      {!isDismissed && (
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

      {/* Sleek Skip CTA */}
      {!isDismissed && (
        <button
          type="button"
          className="video-hero-skip-cta"
          onClick={dismissVideo}
          aria-label="Skip video intro"
        >
          <span>Explore Overview</span>
          <ChevronDown size={16} className="skip-arrow-bounce" />
        </button>
      )}
    </div>,
    document.body
  );
};

// Export alias for backward compatibility
export const ScrollHero = VideoHero;
