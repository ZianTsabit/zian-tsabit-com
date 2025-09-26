import React from "react";
import { useState } from "react";
import {
  Box,
  Typography,
  Container,
  Stack,
  Divider,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { Link } from "react-router-dom";


function About() {
  
  return (
    <Box
      sx={{
      width: "100%",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      bgcolor: "#0000",
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Typography gutterBottom variant="h5" component="div" sx={{ fontFamily: "'Ubuntu', sans-serif" }}>
        Coming soon...
      </Typography>
    </Box>
  );
}

export default About;