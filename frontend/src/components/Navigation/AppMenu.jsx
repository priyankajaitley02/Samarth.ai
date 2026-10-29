// ...existing imports
import BugReportIcon from '@mui/icons-material/BugReport';

const AppMenu = () => {
  const isDev = import.meta.env.DEV;
  // ...existing code

  return (
    <Menu>
      {/* ...existing menu items */}
      
      {isDev && (
        <MenuItem component={Link} to="/diagnostics">
          <ListItemIcon>
            <BugReportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Diagnostics</ListItemText>
        </MenuItem>
      )}
    </Menu>
  );
};
