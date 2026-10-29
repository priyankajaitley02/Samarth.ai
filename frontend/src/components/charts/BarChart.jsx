import { useTheme } from '@mui/material/styles';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const BarChart = ({ title, data, xAxisLabel, yAxisLabel }) => {
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
        boxPadding: 5
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
    animation: {
      duration: 1000
    }
  };

  return (
    <div style={{ height: '300px', position: 'relative' }}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default BarChart;
