import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';

const Target = ({ phase, isRecording }) => {
  const [position, setPosition] = useState({ x: 50, y: 50 }); // Center position in percentage

  useEffect(() => {
    if (!isRecording || !phase) return;

    if (phase === 'CALIBRATION' || phase === 'FIXATION_TEST') {
      setPosition({ x: 50, y: 50 });
      return;
    }

    let animationFrame;
    const startTime = performance.now();
    let previousSaccadicIndex = -1;

    const animate = (timestamp) => {
      const elapsed = timestamp - startTime;

      switch (phase) {
        case 'SACCADIC_TEST': {
          const positions = [
            { x: 20, y: 20 }, { x: 80, y: 20 },
            { x: 50, y: 50 },
            { x: 20, y: 80 }, { x: 80, y: 80 }
          ];
          const index = Math.floor(elapsed / 1000) % positions.length;
          if (index !== previousSaccadicIndex) {
            setPosition(positions[index]);
            previousSaccadicIndex = index;
          }
          break;
        }

        case 'PURSUIT_TEST': {
          const radius = 30;
          const centerX = 50;
          const centerY = 50;
          const angle = (elapsed / 2000) * Math.PI * 2;
          const nextPosition = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          };
          setPosition((currentPosition) =>
            currentPosition.x === nextPosition.x &&
            currentPosition.y === nextPosition.y
              ? currentPosition
              : nextPosition
          );
          break;
        }

        default:
          return;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [phase, isRecording]);

  if (!isRecording || !phase) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        width: { xs: 16, sm: 20 },
        height: { xs: 16, sm: 20 },
        borderRadius: '50%',
        backgroundColor: 'primary.main',
        boxShadow: '0 0 10px rgba(0,0,0,0.3)',
        transition: 'none',
        zIndex: 10
      }}
    />
  );
};

export default Target;