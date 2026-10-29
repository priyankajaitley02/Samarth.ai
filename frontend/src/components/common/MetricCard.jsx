import { Box, Typography } from '@mui/material';

const MetricCard = ({ title, value, unit = '', icon: Icon }) => {
  return (
    <Box
      sx={{
        p: 2,
        border: 1,
        borderColor: 'grey.300',
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: 'background.paper',
        boxShadow: 1
      }}
    >
      {Icon && <Icon sx={{ color: 'primary.main', fontSize: 24 }} />}
      <Box>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h6" component="div">
          {value}
          {unit && (
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              sx={{ ml: 0.5 }}
            >
              {unit}
            </Typography>
          )}
        </Typography>
      </Box>
    </Box>
  );
};

export default MetricCard; 