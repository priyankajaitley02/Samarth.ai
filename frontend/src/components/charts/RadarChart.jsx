import { useTheme } from '@mui/material/styles';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const RadarChart = ({ title, data }) => {
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
      r: {
        angleLines: {
          color: theme.palette.divider
        },
        grid: {
          color: theme.palette.divider
        },
        pointLabels: {
          font: {
            family: theme.typography.fontFamily,
            size: 11
          },
          color: theme.palette.text.secondary
        },
        ticks: {
          backdropColor: 'transparent',
          font: {
            family: theme.typography.fontFamily,
            size: 9
          },
          color: theme.palette.text.secondary
        }
      }
    },
    elements: {
      point: {
        radius: 3,
        hoverRadius: 5
      }
    }
  };

  return (
    <div style={{ height: '300px', position: 'relative' }}>
      <Radar data={data} options={options} />
    </div>
  );
};

export default RadarChart;
