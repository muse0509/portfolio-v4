"use client";

import { useEffect, useRef, useState } from "react";

type AxisTeaserProps = {
  durationLabel: string;
  posterSrc: string | null;
  videoSrc: string | null;
};

export function AxisTeaser({
  durationLabel,
  posterSrc,
  videoSrc,
}: AxisTeaserProps) {
  const figureRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const figure = figureRef.current;
    const video = videoRef.current;

    if (!videoSrc || !figure || !video) {
      return;
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;

    if (reducedMotion || connection?.saveData) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry) {
          return;
        }

        if (entry.intersectionRatio >= 0.55) {
          video.muted = true;
          setIsMuted(true);
          void video.play().catch(() => setHasStarted(false));
          return;
        }

        if (entry.intersectionRatio <= 0.15) {
          video.pause();
        }
      },
      { threshold: [0, 0.15, 0.55, 1] },
    );

    observer.observe(figure);

    return () => observer.disconnect();
  }, [videoSrc]);

  if (!videoSrc) {
    return (
      <figure
        className="axis-teaser axis-teaser--empty"
        data-video-state="unavailable"
      >
        <div className="axis-teaser__empty-frame" aria-hidden="true" />
        <figcaption className="axis-teaser__caption">
          LAUNCH TEASER / {durationLabel}
        </figcaption>
      </figure>
    );
  }

  if (hasPlaybackError) {
    return (
      <figure
        className="axis-teaser axis-teaser--empty"
        data-video-state="error"
      >
        <div className="axis-teaser__empty-frame" aria-hidden="true" />
        <p className="sr-only">Axis launch teaserを読み込めませんでした。</p>
        <figcaption className="axis-teaser__caption">
          LAUNCH TEASER / {durationLabel}
        </figcaption>
      </figure>
    );
  }

  const playVideo = async () => {
    try {
      if (videoRef.current) {
        videoRef.current.muted = false;
      }
      setIsMuted(false);
      await videoRef.current?.play();
    } catch {
      setHasStarted(false);
    }
  };

  return (
    <figure
      ref={figureRef}
      className="axis-teaser"
      data-video-state="available"
      data-playback={hasStarted ? "playing" : "paused"}
    >
      <video
        ref={videoRef}
        className="axis-teaser__video"
        src={videoSrc}
        poster={posterSrc ?? undefined}
        preload="metadata"
        playsInline
        muted={isMuted}
        controls={hasStarted}
        aria-label="Axis launch teaser"
        onPlay={() => setHasStarted(true)}
        onPause={() => setHasStarted(false)}
        onEnded={() => setHasStarted(false)}
        onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
        onError={() => setHasPlaybackError(true)}
      />

      {!hasStarted ? (
        <button
          type="button"
          className="axis-teaser__play"
          aria-label="Axis launch teaserを再生"
          onClick={playVideo}
        >
          <span aria-hidden="true" />
        </button>
      ) : null}

      {!hasStarted ? (
        <figcaption className="axis-teaser__caption">
          LAUNCH TEASER / {durationLabel}
        </figcaption>
      ) : null}
    </figure>
  );
}
