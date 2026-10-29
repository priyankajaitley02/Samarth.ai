import { Card, CardContent, Typography, Box, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { ArrowForward } from '@mui/icons-material';

const StyledCard = styled(Card)(({ theme }) => ({
  cursor: 'pointer',
  background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
  transition: 'all 0.3s ease-in-out',
  border: `1px solid ${theme.palette.divider}`,
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
    borderColor: theme.palette.primary.main,
    '& .MuiIconButton-root': {
      transform: 'translateX(4px)',
      color: theme.palette.primary.main,
    },
  },
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  transition: 'all 0.3s ease-in-out',
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    backgroundColor: theme.palette.primary.light,
  },
}));

const AssessmentCard = ({
  title,
  description,
  icon: Icon,
  onClick,
  completed,
  lastScore,
  trend,
  ...props
}) => {
  return (
    <StyledCard onClick={onClick} {...props}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" gutterBottom>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {Icon && (
              <Icon
                sx={{
                  fontSize: 32,
                  color: 'primary.main',
                  opacity: 0.8,
                }}
              />
            )}
            <StyledIconButton size="small">
              <ArrowForward />
            </StyledIconButton>
          </Box>
        </Box>

        {(completed || lastScore || trend) && (
          <Box sx={{ display: 'flex', gap: 2, mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            {completed && (
              <Typography variant="caption" color="text.secondary">
                Last completed: {new Date(completed).toLocaleDateString()}
              </Typography>
            )}
            {lastScore && (
              <Typography variant="caption" color="text.secondary">
                Last score: {lastScore}
              </Typography>
            )}
            {trend && (
              <Typography
                variant="caption"
                color={trend === 'improving' ? 'success.main' : trend === 'declining' ? 'error.main' : 'text.secondary'}
              >
                {trend.charAt(0).toUpperCase() + trend.slice(1)}
              </Typography>
            )}
          </Box>
        )}
      </CardContent>
    </StyledCard>
  );
};

export default AssessmentCard; 