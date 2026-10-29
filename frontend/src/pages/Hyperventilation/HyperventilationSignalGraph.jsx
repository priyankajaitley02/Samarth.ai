import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const HyperventilationSignalGraph = ({ eegData = [], ecgData = [], hr = 0, connected = false }) => {
  const eegChart = {
    labels: eegData.map((_, i) => i),
    datasets: [{
      label: 'EEG sample value (unit unspecified)',
      data: eegData,
      borderColor: '#3f51b5',
      borderWidth: 1,
      tension: 0,
      pointRadius: 0
    }]
  };
  const eegChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Sample index'
        },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 8,
          maxRotation: 0
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.08)'
        }
      },
      y: {
        title: {
          display: true,
          text: 'EEG sample value (unit unspecified)'
        },
        ticks: {
          maxTicksLimit: 6
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.12)'
        }
      }
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="subtitle1">Live EEG {connected ? '(connected)' : '(disconnected)'}</Typography>
      </Box>
      <Box sx={{ mt: 2, height: 280 }}>
        <Typography variant="subtitle2">EEG</Typography>
        <Line data={eegChart} options={eegChartOptions} />
      </Box>
    </Paper>
  );
};

export default HyperventilationSignalGraph;
