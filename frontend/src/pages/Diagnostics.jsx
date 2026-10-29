import React from "react";
import {
  Container,
  Typography,
  Box,
  Paper,
  Divider,
  Alert,
  Grid,
  Card,
  CardContent,
  Button,
} from "@mui/material";
import Layout from "../components/Layout";
import DatabaseChecker from "../components/diagnostics/DatabaseChecker";
import StorageIcon from "@mui/icons-material/Storage";
import BugReportIcon from "@mui/icons-material/BugReport";
import ConstructionIcon from "@mui/icons-material/Construction";
import { useAuth } from "../contexts/AuthContext";

const Diagnostics = () => {
  const isDev = import.meta.env.DEV;
  const { user } = useAuth();

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            System Diagnostics
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {!isDev && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              Diagnostic tools are typically used in development mode. Some
              features may be limited in production.
            </Alert>
          )}

          <Typography variant="body1" paragraph>
            This page contains diagnostic tools to help troubleshoot issues with
            your Samarth Health application. Use these tools if you're
            experiencing problems with missing data or unexpected behavior.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                    <StorageIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Database Status</Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}>
                    Check the status and content of your database storage.
                  </Typography>
                  <Typography variant="body2">
                    User ID: {user?.id || "Not logged in"}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                    <BugReportIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Troubleshooting</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Tools to diagnose and fix common issues with your
                    assessments and data.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                    <ConstructionIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Developer Tools</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Advanced tools for system maintenance and development.
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={!isDev}
                      onClick={() => {
                        localStorage.clear();
                        alert("Local storage cleared!");
                      }}>
                      Clear Local Storage
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>

        <DatabaseChecker />
      </Container>
    </Layout>
  );
};

export default Diagnostics;
