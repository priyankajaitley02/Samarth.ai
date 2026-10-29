import { useTheme } from '@mui/material/styles';
import { Line } from 'react-chartjs-2';
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

const LineChart = ({ title, data, xAxisLabel, yAxisLabel }) => {
  const theme = useTheme();

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            family: theme.typography.fontFamily,
            size: 12
          },
          color: theme.palette.text.primary
        }
      },
      title: {
        display: !!title,
        text: title || '',
        font: {
          family: theme.typography.fontFamily,
          size: 16,
          weight: 'bold'
        },
        color: theme.palette.text.primary,
        padding: {
          top: 10,
          bottom: 20
        }
      },
      tooltip: {
        backgroundColor: theme.palette.background.paper,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        borderWidth: 1,
        padding: 10,
        boxPadding: 5,
        usePointStyle: true,
        bodyFont: {
          family: theme.typography.fontFamily
        },
        titleFont: {
          family: theme.typography.fontFamily,
          weight: 'bold'
        }
      }
    },
    scales: {
      x: {
        title: {
          display: !!xAxisLabel,
          text: xAxisLabel || '',
          font: {
            family: theme.typography.fontFamily,
            size: 12
          },
          color: theme.palette.text.secondary
        },
        grid: {
          display: false
        },
        ticks: {
          font: {
            family: theme.typography.fontFamily,
            size: 11
          },
          color: theme.palette.text.secondary
        }
      },
      y: {
        title: {
          display: !!yAxisLabel,
          text: yAxisLabel || '',
          font: {
            family: theme.typography.fontFamily,
            size: 12
          },
          color: theme.palette.text.secondary
        },
        grid: {
          color: theme.palette.divider,
          drawBorder: false
        },
        ticks: {
          font: {
            family: theme.typography.fontFamily,
            size: 11
          },
          color: theme.palette.text.secondary
        }
      }
    },
    animations: {
      tension: {
        duration: 1000,
        easing: 'linear',
        from: 0.8,
        to: 0.2,
        loop: false
      }
    }
  };

  return (
    <div style={{ height: '300px', position: 'relative' }}>
      <Line data={data} options={options} />
    </div>
  );
};

export default LineChart;