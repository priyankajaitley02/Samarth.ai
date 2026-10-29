import React, { useEffect, useRef } from 'react';
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material';
import { 
  Chart as ChartJS,
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler 
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components (if they haven't been registered elsewhere)
if (!ChartJS.registry.controllers.get('line')) {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
  );
}

// Waveform Visualizer Component
export const WaveformVisualizer = ({ audioData, height }) => {
  const canvasRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  useEffect(() => {
    if (!audioData || !audioData.length || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Set line style
    ctx.lineWidth = isMobile ? 1.5 : 2;
    ctx.strokeStyle = theme.palette.primary.main;
    
    // Start path
    ctx.beginPath();
    
    // Draw waveform
    const sliceWidth = canvasWidth / audioData.length;
    let x = 0;
    
    for (let i = 0; i < audioData.length; i++) {
      const y = (1 - audioData[i]) * canvasHeight / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.stroke();
    
    // Add the center line
    ctx.beginPath();
    ctx.strokeStyle = `${theme.palette.text.secondary}40`;
    ctx.lineWidth = 1;
    ctx.moveTo(0, canvasHeight / 2);
    ctx.lineTo(canvasWidth, canvasHeight / 2);
    ctx.stroke();
    
  }, [audioData, height, isMobile, theme.palette.primary.main, theme.palette.text.secondary]);
  
  const canvasStyle = {
    width: '100%',
    height: height || 100,
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
  };
  
  return (
    <Box sx={{ width: '100%', mb: 2, overflow: 'hidden' }}>
      <canvas 
        ref={canvasRef} 
        height={height || 100} 
        width={1000} 
        style={canvasStyle} 
      />
    </Box>
  );
};

// Pitch Graph Component
export const PitchGraph = ({ data, labels }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Handle empty data
  if (!data || !data.length) {
    return (
      <Box 
        sx={{ 
          height: 150, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: `${theme.palette.background.paper}80`,
          borderRadius: theme.shape.borderRadius,
          color: theme.palette.text.secondary
        }}
      >
        No pitch data available
      </Box>
    );
  }
  
  // Process labels for better display - show only every nth label on mobile
  const skipFactor = isMobile ? 5 : 2;
  const processedLabels = labels.map((label, i) => 
    i % skipFactor === 0 ? `${label.toFixed(1)}s` : ''
  );
  
  const chartData = {
    labels: processedLabels,
    datasets: [
      {
        label: 'Pitch',
        data: data,
        borderColor: theme.palette.info.main,
        backgroundColor: `${theme.palette.info.main}20`,
        borderWidth: isMobile ? 1.5 : 2,
        pointRadius: isMobile ? 0 : 1,
        pointHoverRadius: 5,
        tension: 0.3,
        fill: true
      }
    ]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          boxWidth: 12,
          font: {
            size: isMobile ? 10 : 12
          }
        }
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 0,
          font: {
            size: isMobile ? 8 : 10
          }
        },
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          font: {
            size: isMobile ? 8 : 10
          }
        }
      }
    }
  };
  
  return (
    <Box sx={{ height: 200, mb: 2 }}>
      <Line data={chartData} options={options} />
    </Box>
  );
};

// Emotion Timeline Component
export const EmotionTimeline = ({ emotionData }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Handle empty data
  if (!emotionData || !emotionData.timestamps || !emotionData.timestamps.length) {
    return (
      <Box 
        sx={{ 
          height: 200, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: `${theme.palette.background.paper}80`,
          borderRadius: theme.shape.borderRadius,
          color: theme.palette.text.secondary
        }}
      >
        No emotion data available
      </Box>
    );
  }
  
  // Process labels for better display - show only every nth label on mobile
  const skipFactor = isMobile ? 5 : 2;
  const processedLabels = emotionData.timestamps.map((timestamp, i) => 
    i % skipFactor === 0 ? `${timestamp.toFixed(1)}s` : ''
  );
  
  const chartData = {
    labels: processedLabels,
    datasets: [
      {
        label: 'Confidence',
        data: emotionData.confidence,
        borderColor: theme.palette.success.main,
        backgroundColor: `${theme.palette.success.main}20`,
        borderWidth: isMobile ? 1.5 : 2,
        pointRadius: 0,
        fill: 'start',
        tension: 0.4
      },
      {
        label: 'Stress',
        data: emotionData.stress,
        borderColor: theme.palette.error.main,
        backgroundColor: `${theme.palette.error.main}20`,
        borderWidth: isMobile ? 1.5 : 2,
        pointRadius: 0,
        fill: 'start',
        tension: 0.4
      },
      {
        label: 'Hesitation',
        data: emotionData.hesitation,
        borderColor: theme.palette.warning.main,
        backgroundColor: `${theme.palette.warning.main}20`,
        borderWidth: isMobile ? 1.5 : 2,
        pointRadius: 0,
        fill: 'start',
        tension: 0.4
      }
    ]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          font: {
            size: isMobile ? 10 : 12
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += (context.parsed.y * 100).toFixed(1) + '%';
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 0,
          font: {
            size: isMobile ? 8 : 10
          }
        },
        grid: {
          display: false
        }
      },
      y: {
        min: 0,
        max: 1,
        ticks: {
          callback: (value) => `${(value * 100).toFixed(0)}%`,
          font: {
            size: isMobile ? 8 : 10
          }
        }
      }
    }
  };
  
  return (
    <Box sx={{ height: 200, mb: 2 }}>
      <Line data={chartData} options={options} />
    </Box>
  );
};

// Legend Component for showing emotion indicators in smaller screens
export const EmotionLegend = () => {
  const theme = useTheme();
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        flexWrap: 'wrap',
        gap: 2,
        mb: 2
      }}
    >
      {[
        { label: 'Confidence', color: theme.palette.success.main },
        { label: 'Stress', color: theme.palette.error.main },
        { label: 'Hesitation', color: theme.palette.warning.main }
      ].map((item) => (
        <Box 
          key={item.label} 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5 
          }}
        >
          <Box 
            sx={{ 
              width: 12, 
              height: 12, 
              backgroundColor: item.color,
              borderRadius: '50%'
            }} 
          />
          <Typography variant="caption">{item.label}</Typography>
        </Box>
      ))}
    </Box>
  );
};