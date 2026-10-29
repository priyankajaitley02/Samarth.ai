import { Button } from '@mui/material';

const CustomButton = ({ children, ...props }) => {
  return (
    <Button
      {...props}
      sx={{
        borderRadius: 2,
        textTransform: 'none',
        fontWeight: 600,
        boxShadow: 2,
        '&:hover': {
          boxShadow: 4,
        },
        ...props.sx
      }}
    >
      {children}
    </Button>
  );
};

export default CustomButton; 