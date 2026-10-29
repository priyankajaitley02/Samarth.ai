import { useEffect, useRef } from 'react';
import { Box, Paper, Typography, useTheme } from '@mui/material';
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

// Register ChartJS components
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

const ProgressChart = ({
  data,
  title,
  height = 300,
  showLegend = true,
  gradientFill = true,
  timeRange = 'month'
}) => {
  const theme = useTheme();
  const chartRef = useRef(null);

  useEffect(() => {
    const chart = chartRef.current;
    
    if (chart && gradientFill) {
      const ctx = chart.ctx;
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, theme.palette.primary.main + '40'); // 25% opacity
      gradient.addColorStop(1, theme.palette.primary.main + '00'); // 0% opacity
      
      chart.data.datasets[0].backgroundColor = gradient;
      chart.update();
    }
  }, [theme, height, gradientFill]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        position: 'top',
        labels: {
          color: theme.palette.text.primary,
          font: {
            family: theme.typography.fontFamily,
            size: 12
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: theme.palette.background.paper,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        borderWidth: 1,
        padding: 12,
        boxPadding: 4,
        callbacks: {
          label: (context) => `Score: ${context.parsed.y.toFixed(1)}`
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: theme.palette.divider,
          drawBorder: false
        },
        ticks: {
          color: theme.palette.text.secondary,
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: theme.palette.divider,
          drawBorder: false
        },
        ticks: {
          color: theme.palette.text.secondary,
          padding: 8
        }
      }
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2,
        borderColor: theme.palette.primary.main,
        fill: gradientFill
      },
      point: {
        radius: 4,
        borderWidth: 2,
        backgroundColor: theme.palette.background.paper,
        borderColor: theme.palette.primary.main,
        hoverRadius: 6,
        hoverBorderWidth: 2
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        height: height + 80, // Add padding for title and legend
        backgroundColor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2
      }}
    >
      {title && (
        <Typography variant="h6" gutterBottom sx={{ px: 1 }}>
          {title}
        </Typography>
      )}
      <Box sx={{ height: height }}>
        <Line
          ref={chartRef}
          data={data}
          options={options}
          height={height}
        />
      </Box>
    </Paper>
  );
};

export default ProgressChart; 