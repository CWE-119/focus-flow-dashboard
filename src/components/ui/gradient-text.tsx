import { useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { motion, useMotionValue, useAnimationFrame, useTransform } from 'motion/react';

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
  direction?: 'horizontal' | 'vertical' | 'diagonal';
  pauseOnHover?: boolean;
  animateOnHover?: boolean; // Only animate when hovered
  yoyo?: boolean;
}

export default function GradientText({
  children,
  className = '',
  colors = ['#5ca8e0', '#9b7ed9', '#d96aa3', '#e09746'],
  animationSpeed = 8,
  showBorder = false,
  direction = 'horizontal',
  pauseOnHover = false,
  animateOnHover = false,
  yoyo = true
}: GradientTextProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPaused, setIsPaused] = useState(animateOnHover); // Start paused if animateOnHover
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const animationDuration = animationSpeed * 1000;

  useAnimationFrame(time => {
    if (isPaused) {
      lastTimeRef.current = null;
      return;
    }
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += deltaTime;

    if (yoyo) {
      const fullCycle = animationDuration * 2;
      const cycleTime = elapsedRef.current % fullCycle;
      if (cycleTime < animationDuration) {
        progress.set((cycleTime / animationDuration) * 100);
      } else {
        progress.set(100 - ((cycleTime - animationDuration) / animationDuration) * 100);
      }
    } else {
      progress.set((elapsedRef.current / animationDuration) * 100);
    }
  });

  useEffect(() => {
    elapsedRef.current = 0;
    progress.set(0);
  }, [animationSpeed, yoyo, progress]);

  const backgroundPosition = useTransform(progress, p => {
    if (direction === 'horizontal') {
      return `${p}% 50%`;
    } else if (direction === 'vertical') {
      return `50% ${p}%`;
    } else {
      return `${p}% 50%`;
    }
  });

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (animateOnHover) {
      setIsPaused(false);
    } else if (pauseOnHover) {
      setIsPaused(true);
    }
  }, [pauseOnHover, animateOnHover]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (animateOnHover) {
      setIsPaused(true);
      // Reset animation when mouse leaves
      elapsedRef.current = 0;
      lastTimeRef.current = null;
      progress.set(0);
    } else if (pauseOnHover) {
      setIsPaused(false);
    }
  }, [pauseOnHover, animateOnHover, progress]);

  const gradientAngle =
    direction === 'horizontal' ? 'to right' : direction === 'vertical' ? 'to bottom' : 'to bottom right';

  const gradientColors = [...colors, colors[0]].join(', ');

  const gradientStyle = {
    backgroundImage: `linear-gradient(${gradientAngle}, ${gradientColors})`,
    backgroundSize: direction === 'horizontal' ? '300% 100%' : direction === 'vertical' ? '100% 300%' : '300% 300%',
    backgroundRepeat: 'repeat' as const
  };

  return (
    <motion.span
      className={`relative inline-flex items-center font-medium overflow-visible cursor-default ${showBorder ? 'py-1 px-2 rounded-[1.25rem]' : ''} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showBorder && (
        <motion.span
          className="absolute inset-0 z-0 pointer-events-none rounded-[1.25rem]"
          style={{ ...gradientStyle, backgroundPosition }}
        >
          <span
            className="absolute bg-background rounded-[1.25rem] z-[-1]"
            style={{
              width: 'calc(100% - 2px)',
              height: 'calc(100% - 2px)',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />
        </motion.span>
      )}
      <motion.span
        className="inline relative z-[2]"
        style={{ 
          ...gradientStyle, 
          backgroundPosition,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {children}
      </motion.span>
    </motion.span>
  );
}
