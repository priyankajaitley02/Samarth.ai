import React, { useCallback } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import {
  Line,
  Radar,
  Bubble,
  Scatter
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import { Download as DownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadialLinearScale,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

// Animation configurations
const ANIMATION_OPTIONS = {
  duration: 800,
  easing: 'easeInOutQuart'
};

// Progressive animation for datasets
const progressiveAnimation = {
  x: {
    type: 'number',
    easing: 'easeInOutQuart',
    duration: 800,
    from: NaN,
    delay(ctx) {
      if (ctx.type !== 'data') return 0;
      return ctx.dataIndex * 10;
    }
  },
  y: {
    type: 'number',
    easing: 'easeInOutQuart',
    duration: 800,
    from: NaN,
    delay(ctx) {
      if (ctx.type !== 'data') return 0;
      return ctx.dataIndex * 10;
    }
  }
};

const ChartControls = ({ onExport, onResetZoom }) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1, gap: 1 }}>
      <Tooltip title="Export as PNG">
        <IconButton onClick={onExport} size="small">
          <DownloadIcon />
        </IconButton>
      </Tooltip>
      {onResetZoom && (
        <Tooltip title="Reset Zoom">
          <IconButton onClick={onResetZoom} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export const TapPatternChart = ({ data, baselineData }) => {
  const chartRef = React.useRef(null);

  const handleExport = useCallback(() => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image();
      const link = document.createElement('a');
      link.download = `tap-pattern-${new Date().toISOString()}.png`;
      link.href = url;
      link.click();
    }
  }, []);

  const options = {
    responsive: true,
    animation: progressiveAnimation,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Tapping Pattern Analysis'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `Time: ${context.raw.x}ms, Amplitude: ${context.raw.y}mm, Speed: ${context.raw.r}mm/s`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time (ms)'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Amplitude (mm)'
        }
      }
    },
    transitions: {
      show: {
        animations: {
          x: { from: 0 },
          y: { from: 0 }
        }
      },
      hide: {
        animations: {
          x: { to: 0 },
          y: { to: 0 }
        }
      }
    }
  };

  const chartData = {
    datasets: [
      {
        label: 'Current Pattern',
        data: data.map(point => ({
          x: point.time,
          y: point.amplitude,
          r: point.speed * 2 // Bubble size based on speed
        })),
        backgroundColor: 'rgba(53, 162, 235, 0.5)'
      },
      {
        label: 'Baseline',
        data: baselineData?.map(point => ({
          x: point.time,
          y: point.amplitude,
          r: point.speed * 2
        })) || [],
        backgroundColor: 'rgba(75, 192, 192, 0.5)'
      }
    ]
  };

  return (
    <Box>
      <ChartControls onExport={handleExport} />
      <Bubble ref={chartRef} data={chartData} options={options} />
    </Box>
  );
};

export const RhythmAnalysisChart = ({ data }) => {
  if (!data?.timestamps?.length || !data?.intervals?.length) {
    return <div>No rhythm data available</div>;
  }

  const chartRef = React.useRef(null);

  const handleExport = useCallback(() => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image();
      const link = document.createElement('a');
      link.download = `rhythm-analysis-${new Date().toISOString()}.png`;
      link.href = url;
      link.click();
    }
  }, []);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  }, []);

  const chartData = {
    labels: data.timestamps.map(timestamp => 
      new Date(timestamp).toLocaleTimeString('en-US', { 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3 
      })
    ),
    datasets: [
      {
        label: 'Tap Intervals',
        data: data.intervals,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        fill: false
      },
      {
        label: 'Target Interval',
        data: Array(data.timestamps.length).fill(data.targetInterval),
        borderColor: 'rgba(255, 99, 132, 0.5)',
        borderDash: [5, 5],
        tension: 0,
        fill: false
      }
    ]
  };

  const options = {
    responsive: true,
    animation: {
      duration: 800,
      easing: 'easeInOutQuart',
      delay(ctx) {
        return ctx.dataIndex * 20;
      }
    },
    plugins: {
      title: {
        display: true,
        text: 'Tapping Rhythm Analysis'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x'
        },
        pan: { enabled: true, mode: 'x' }
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Interval (ms)'
        },
        min: 0,
        suggestedMax: data.targetInterval * 2
      },
      x: {
        title: {
          display: true,
          text: 'Time'
        }
      }
    }
  };

  return (
    <Box>
      <ChartControls onExport={handleExport} onResetZoom={handleResetZoom} />
      <Line ref={chartRef} data={chartData} options={options} />
    </Box>
  );
};

export const FatigueProgressionChart = ({ data }) => {
  const chartRef = React.useRef(null);

  const handleExport = useCallback(() => {
    exportChart(chartRef, 'fatigue-progression');
  }, []);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  }, []);

  const options = {
    responsive: true,
    animation: {
      ...ANIMATION_OPTIONS,
      delay(ctx) {
        return ctx.dataIndex * 20;
      }
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Fatigue Analysis'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => {
            const label = context.dataset.label;
            const value = context.raw.toFixed(1);
            return `${label}: ${value}%`;
          }
        }
      },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'x'
        },
        pan: { enabled: true, mode: 'x' }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time (s)'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Performance Metrics'
        },
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    }
  };

  const chartData = {
    labels: data.timestamps.map(t => (t / 1000).toFixed(1)),
    datasets: [
      {
        label: 'Speed',
        data: data.speedMetrics,
        borderColor: 'rgba(53, 162, 235, 1)',
        backgroundColor: 'rgba(53, 162, 235, 0.2)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'Accuracy',
        data: data.accuracyMetrics,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'Consistency',
        data: data.consistencyMetrics,
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        fill: true,
        tension: 0.4,
        yAxisID: 'y'
      }
    ]
  };

  return (
    <Box>
      <ChartControls onExport={handleExport} onResetZoom={handleResetZoom} />
      <Line ref={chartRef} data={chartData} options={options} />
    </Box>
  );
};

export const PrecisionMap = ({ data }) => {
  const chartRef = React.useRef(null);

  const handleExport = useCallback(() => {
    exportChart(chartRef, 'precision-map');
  }, []);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  }, []);

  const options = {
    responsive: true,
    animation: {
      ...ANIMATION_OPTIONS,
      delay(ctx) {
        return ctx.dataIndex * 20;
      }
    },
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Tapping Precision Map'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `Deviation: ${context.raw.y.toFixed(2)}mm, Frequency: ${context.raw.x.toFixed(1)}Hz`;
          }
        }
      },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: 'xy'
        },
        pan: { enabled: true, mode: 'xy' }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Tapping Frequency (Hz)'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Spatial Deviation (mm)'
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    }
  };

  const chartData = {
    datasets: [{
      label: 'Precision Distribution',
      data: data.map(point => ({
        x: point.frequency,
        y: point.deviation,
      })),
      backgroundColor: (context) => {
        const value = context.raw.y;
        const alpha = Math.max(0.2, 1 - value / 10);
        return `rgba(75, 192, 192, ${alpha})`;
      },
      pointRadius: 8
    }]
  };

  return (
    <Box>
      <ChartControls onExport={handleExport} onResetZoom={handleResetZoom} />
      <Scatter ref={chartRef} data={chartData} options={options} />
    </Box>
  );
}; 