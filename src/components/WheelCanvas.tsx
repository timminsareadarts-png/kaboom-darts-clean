import React, { useRef, useEffect, useCallback } from 'react';
import { DrawWheelSegment } from '../types';

interface WheelCanvasProps {
  segments: DrawWheelSegment[];
  onSpinEnd?: (selectedSegment: DrawWheelSegment) => void;
  isSpinning: boolean;
  setIsSpinning?: (spinning: boolean) => void;
  size?: number;
  winnerSegmentId?: string | null;
}

// Helper to normalize any angle in radians to [0, 2 * Math.PI)
const normalizeAngle = (rad: number): number => {
  const twoPi = Math.PI * 2;
  return ((rad % twoPi) + twoPi) % twoPi;
};

// Calculate exact slice index directly beneath the top pointer (12 o'clock, -Math.PI / 2)
const getSliceIndexAtPointer = (rotationAngle: number, numSegs: number): number => {
  if (numSegs <= 0) return 0;
  const anglePerSegment = (Math.PI * 2) / numSegs;
  const pointerAngle = -Math.PI / 2;
  const localAngle = normalizeAngle(pointerAngle - rotationAngle);
  const index = Math.floor(localAngle / anglePerSegment) % numSegs;
  return index;
};

export const WheelCanvas: React.FC<WheelCanvasProps> = ({
  segments,
  onSpinEnd,
  isSpinning,
  setIsSpinning,
  size = 460,
  winnerSegmentId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastTickSliceRef = useRef<number>(-1);
  const isSpinningActiveRef = useRef<boolean>(false);

  // Keep references to latest callbacks and props to avoid cancelling active spin animations on re-renders
  const segmentsRef = useRef<DrawWheelSegment[]>(segments);
  segmentsRef.current = segments;

  const onSpinEndRef = useRef(onSpinEnd);
  onSpinEndRef.current = onSpinEnd;

  const setIsSpinningRef = useRef(setIsSpinning);
  setIsSpinningRef.current = setIsSpinning;

  // Initialize Web Audio synthesizer for tactile tick sound
  const playTickSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      if (audioCtxRef.current) {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(580, audioCtxRef.current.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, audioCtxRef.current.currentTime + 0.035);
        gain.gain.setValueAtTime(0.12, audioCtxRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.035);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        osc.stop(audioCtxRef.current.currentTime + 0.04);
      }
    } catch (e) {}
  }, []);

  const playWinSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current) {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = audioCtxRef.current!.createOscillator();
          const gain = audioCtxRef.current!.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const startTime = audioCtxRef.current!.currentTime + idx * 0.1;
          gain.gain.setValueAtTime(0.15, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
          osc.connect(gain);
          gain.connect(audioCtxRef.current!.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.4);
        });
      }
    } catch (e) {}
  }, []);

  const playTickSoundRef = useRef(playTickSound);
  playTickSoundRef.current = playTickSound;

  const playWinSoundRef = useRef(playWinSound);
  playWinSoundRef.current = playWinSound;

  // Draw the wheel onto the HTML5 canvas
  const drawWheel = useCallback((rotationAngle: number, customSegments?: DrawWheelSegment[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 18;

    ctx.clearRect(0, 0, width, height);

    const segs = customSegments || segmentsRef.current || [];
    const numSegments = segs.length;

    if (numSegments === 0) {
      // Empty wheel state
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No Paid Spots Yet', centerX, centerY - 10);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Add players to spin the wheel', centerX, centerY + 14);
      ctx.restore();
      return;
    }

    const anglePerSegment = (Math.PI * 2) / numSegments;

    // Draw Wheel Segments
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationAngle);

    for (let i = 0; i < numSegments; i++) {
      const seg = segs[i];
      const startAngle = i * anglePerSegment;
      const endAngle = startAngle + anglePerSegment;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      // Check if this segment is the highlighted winner
      const isWinner = winnerSegmentId && seg.id === winnerSegmentId;
      ctx.fillStyle = isWinner ? '#fbbf24' : seg.color;
      ctx.fill();

      // Segment separator border
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = numSegments > 30 ? 1 : 2;
      ctx.stroke();

      // Segment label text & avatar
      ctx.save();
      ctx.rotate(startAngle + anglePerSegment / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      // Contrast text
      ctx.fillStyle = isWinner ? '#0f172a' : '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;

      // Font size scales with segment count
      let fontSize = 13;
      if (numSegments > 24) fontSize = 10;
      if (numSegments > 36) fontSize = 9;
      if (numSegments > 48) fontSize = 8;

      ctx.font = `bold ${fontSize}px sans-serif`;

      // Text with occurrence badge if space allows
      const name = seg.playerName.length > 14 ? seg.playerName.slice(0, 12) + '…' : seg.playerName;
      const textToDraw = `${seg.avatar || '🎯'} ${name}`;
      ctx.fillText(textToDraw, radius - 14, 0);

      ctx.restore();
    }

    ctx.restore();

    // Outer Decorative Rims
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center Hub (Pin)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner center gem
    ctx.beginPath();
    ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    ctx.restore();

    // Top Pointer Indicator (Fixed arrow at top pointing down)
    ctx.save();
    ctx.translate(centerX, centerY - radius + 6);
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(-12, -10);
    ctx.lineTo(12, -10);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pointer shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.restore();
  }, [winnerSegmentId]);

  const drawWheelRef = useRef(drawWheel);
  drawWheelRef.current = drawWheel;

  // Initial draw and redraw when segments change while not spinning
  useEffect(() => {
    if (!isSpinningActiveRef.current) {
      drawWheel(rotationRef.current, segments);
    }
  }, [segments, drawWheel]);

  // Handle spin execution when isSpinning becomes true
  useEffect(() => {
    if (!isSpinning) {
      // Parent stopped spinning or reset
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      isSpinningActiveRef.current = false;
      return;
    }

    // If already actively spinning, do not restart!
    if (isSpinningActiveRef.current) {
      return;
    }

    const currentSegments = segmentsRef.current;
    if (!currentSegments || currentSegments.length === 0) {
      isSpinningActiveRef.current = false;
      setIsSpinningRef.current?.(false);
      return;
    }

    isSpinningActiveRef.current = true;
    let spinFinished = false;
    const spinSegments = [...currentSegments];
    const numSegments = spinSegments.length;
    const anglePerSegment = (Math.PI * 2) / numSegments;
    const pointerAngle = -Math.PI / 2; // Fixed top pointer (12 o'clock)

    // 1. Pick a random target slice index
    const targetSliceIndex = Math.floor(Math.random() * numSegments);

    // 2. Exact midpoint of the target slice in local coordinates:
    const sliceCenterLocal = (targetSliceIndex + 0.5) * anglePerSegment;

    // 3. The wheel rotation angle R required for this slice midpoint to land under pointer:
    const targetRestingAngleNormalized = normalizeAngle(pointerAngle - sliceCenterLocal);

    const startRotation = rotationRef.current;
    const currentAngleNormalized = normalizeAngle(startRotation);

    // 4. Forward angular distance needed to align pointer with the center of the target slice:
    let forwardDelta = normalizeAngle(targetRestingAngleNormalized - currentAngleNormalized);
    if (forwardDelta < 0.005) {
      forwardDelta += Math.PI * 2;
    }

    // 5. Add strictly integer full 360-degree rotations (5 to 8 full turns)
    const fullSpins = 5 + Math.floor(Math.random() * 4);
    const fullSpinsAngle = fullSpins * (Math.PI * 2);

    const totalRotationTarget = startRotation + forwardDelta + fullSpinsAngle;

    const duration = 4400; // 4.4 seconds smooth realistic spin
    const startTime = performance.now();

    // Easing: ease-out quartic
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const finishSpin = () => {
      if (spinFinished) return;
      spinFinished = true;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      // Snap directly to totalRotationTarget to guarantee exact landing
      rotationRef.current = totalRotationTarget;
      try {
        drawWheelRef.current(totalRotationTarget, spinSegments);
      } catch (e) {}

      // Derive winning slice directly from physical resting angle under pointer
      const finalSliceIndex = getSliceIndexAtPointer(totalRotationTarget, numSegments);
      const winningSlice = spinSegments[finalSliceIndex] || spinSegments[targetSliceIndex];

      isSpinningActiveRef.current = false;
      try {
        playWinSoundRef.current();
      } catch (e) {}

      if (setIsSpinningRef.current) {
        setIsSpinningRef.current(false);
      }
      if (onSpinEndRef.current) {
        onSpinEndRef.current(winningSlice);
      }
    };

    // Safety timeout: guaranteed termination even if requestAnimationFrame is throttled in background
    const safetyTimeout = setTimeout(() => {
      finishSpin();
    }, duration + 300);

    const animate = (now: number) => {
      if (spinFinished) return;

      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutQuart(progress);

      const currentAngle = startRotation + (totalRotationTarget - startRotation) * eased;
      rotationRef.current = currentAngle;

      try {
        drawWheelRef.current(currentAngle, spinSegments);
      } catch (e) {}

      // Sound tick detection: calculate current slice under pointer
      try {
        const currentSliceIndex = getSliceIndexAtPointer(currentAngle, numSegments);
        if (currentSliceIndex !== lastTickSliceRef.current) {
          lastTickSliceRef.current = currentSliceIndex;
          playTickSoundRef.current();
        }
      } catch (e) {}

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        clearTimeout(safetyTimeout);
        finishSpin();
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      clearTimeout(safetyTimeout);
      // Only tear down if isSpinning was explicitly turned off by parent
      if (!isSpinning && animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
        isSpinningActiveRef.current = false;
      }
    };
  }, [isSpinning]);

  return (
    <div className="flex flex-col items-center justify-center relative select-none">
      <div className="relative p-2 rounded-full bg-slate-900/90 shadow-2xl border border-slate-700/80">
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="rounded-full max-w-full h-auto cursor-default"
          style={{ width: size, height: size }}
        />
      </div>
    </div>
  );
};
