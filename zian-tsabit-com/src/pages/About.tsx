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
  const [openRows, setOpenRows] = useState<number[]>([]);

  const toggleRow = (index: number) => {
    setOpenRows((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const rows = [
    {
      role: "Software Engineer I - Data",
      company: "Cermati Fintech Group",
      link: "https://www.cermati.group/",
      duration: "June 2025 - Present",
      details: `
        - Develop and maintain scalable data platforms and real-time data pipelines on Google Cloud Platform (GCP) using Apache Airflow, Apache Kafka, and Apache Spark.
        - Collaborate with cross-functional teams to design and implement data solutions that meet business requirements.
        - Optimize data workflows and improve data quality through effective monitoring and troubleshooting.
        - Utilize containerization technologies such as Docker to streamline deployment processes.
        - Work with various database management systems including PostgreSQL, MongoDB, Elasticsearch, Redis, and Clickhouse.
        - Implement data transformation and modeling using DBT to enhance data accessibility for analytics and reporting.
        - Create and maintain data visualizations using tools like Redash, Metabase, and Tableau to support data-driven decision-making.
      `,
    },
    {
      role: "Data Engineer",
      company: "Intiva",
      link: "https://intiva.id/",
      duration: "June 2022 - June 2025",
      details: `
        - Designed ETL pipelines for financial data.
        - Built monitoring dashboards to ensure data reliability.
      `,
    },
    {
      role: "Data Governance Intern",
      company: "Sinar Mas Land",
      link: "https://www.sinarmasland.com/",
      duration: "Apr 2024 - July 2024",
      details: `
        - Assisted in data quality and governance initiatives.
        - Created metadata documentation for internal data assets.
      `,
    },
    {
      role: "Data Engineer Intern",
      company: "ITB Career Center",
      link: "https://career.itb.ac.id/",
      duration: "Sep 2023 - Dec 2023",
      details: `
        - Developed APIs for student career data analytics.
        - Built reporting pipelines for employment statistics.
      `,
    },
    {
      role: "Data Engineer Intern",
      company: "Cermati Fintech Group",
      link: "https://www.cermati.group/",
      duration: "May 2023 - Sep 2023",
      details: `
        - Worked on improving existing data pipelines.
        - Assisted senior engineers with performance optimization.
      `,
    },
  ];

  return (
    <Box
      sx={{
        width: "75vh",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        bgcolor: "#0000",
        alignItems: "center",
        marginTop: "36px",
      }}
    >
      <Container maxWidth="md">
        <Stack
          direction="column"
          sx={{
            justifyContent: "center",
            alignItems: "center",
            marginBottom: "18px",
            marginTop: "18px",
          }}
        >
          <Typography
            gutterBottom
            variant="h4"
            component="div"
            sx={{
              fontFamily: "'Ubuntu', sans-serif",
              marginTop: "24px",
              fontWeight: "bold"
            }}
          >
            Ghazian Tsabit Alkamil
          </Typography>
          <Stack
            direction="row"
            sx={{ 
            justifyContent: "center", 
            alignItems: "center", 
            gap: 1
            }}
            >
            <Link
                to="https://www.linkedin.com/in/ghaziantsabitalkamil/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    color: "#6497b1",
                    textDecoration: "none",
                    fontFamily: "'Ubuntu', sans-serif",
                    fontSize: "16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                }}>
                <img
                    src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linkedin/linkedin-original.svg"
                    alt="LinkedIn"
                    style={{ width: "20px", height: "20px" }}
                />
                linkedIn
            </Link>
            <Typography
            variant="body1"
            component="div"
            color="white"
            sx={{ fontFamily: "'Ubuntu', sans-serif" }}>
            |
            </Typography>
            <Link
                to="https://github.com/ZianTsabit"
                style={{
                color: "#6497b1",
                textDecoration: "none",
                fontFamily: "'Ubuntu', sans-serif",
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
                gap: "4px"
                }}>
                <img
                    src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg"
                    alt="GitHub"
                    style={{ width: "20px", height: "20px" }}
                />
                github
                </Link>
            <Typography
            variant="body1"
            component="div"
            color="white"
            sx={{ fontFamily: "'Ubuntu', sans-serif" }}>
            |
            </Typography>
            <Link
                to="mailto:tsabitghazian@gmail.com"
                style={{
                color: "#6497b1",
                textDecoration: "none",
                fontFamily: "'Ubuntu', sans-serif",
                fontSize: "16px",
                }}>
                ✉️ email
            </Link>
        </Stack>
        </Stack>
        
        <Divider sx={{ bgcolor: "grey", marginTop: "8px", marginBottom: "8px" }} />
        
        <Box sx={{ marginTop: "18px", marginBottom: "36px" }}>
            <Typography
                variant="body1"
                component="div"
                color="white"
                sx={{
                    fontFamily: "'Ubuntu', sans-serif",
                    textAlign: "left",
                    marginBottom: "12px",
                    marginLeft: "4px",
                    fontWeight: "bold",
                    fontSize: "16px",
                }}
            >
                📄 Summaries
            </Typography>

            <Typography
                variant="body2"
                component="div"
                color="white"
                sx={{
                    fontFamily: "'Ubuntu', sans-serif",
                    textAlign: "justify",
                    marginLeft: "4px",
                    marginRight: "4px",
                    marginBottom: "12px",
                    marginTop: "12px",
                    whiteSpace: "pre-line",
                }}
            >
                Data Engineer with a Computer Science degree from Bandung Institute of Technology (ITB). Proven ability to develop scalable data platforms and real-time data pipelines on Google Cloud Platform, Microsoft Azure, and on-premise infrastructure. Proficient in Python, Java, Go, and SQL. Expertise in database management systems including PostgreSQL, MongoDB, Elasticsearch, Redis, and Clickhouse. Skilled in orchestration and processing tools such as Apache Airflow, Apache Kafka, Apache Spark, Docker, and DBT, alongside data visualization platforms like Redash, Metabase, and Tableau.
            </Typography>

        </Box>

        <Box sx={{ marginTop: "18px", marginBottom: "36px" }}>
            <Typography
                variant="body1"
                component="div"
                color="white"
                sx={{
                fontFamily: "'Ubuntu', sans-serif",
                textAlign: "left",
                marginBottom: "12px",
                marginLeft: "4px",
                fontWeight: "bold",
                fontSize: "16px",
                }}
            >
                💼 Working Experience
            </Typography>
                
            <TableContainer
                component={Paper}
                sx={{
                backgroundColor: "#1e1e1e",
                boxShadow: "none",
                border: "1px solid grey",
                borderRadius: "2px",
                }}
            >
                <Table sx={{ minWidth: 650 }} size="medium">
                <TableHead>
                    <TableRow sx={{ backgroundColor: "#2c2c2c" }}>
                    <TableCell sx={{ color: "white", fontFamily: "'Ubuntu', sans-serif" }}>
                        Roles
                    </TableCell>
                    <TableCell sx={{ color: "white", fontFamily: "'Ubuntu', sans-serif" }}>
                        Company
                    </TableCell>
                    <TableCell sx={{ color: "white", fontFamily: "'Ubuntu', sans-serif" }}>
                        Duration
                    </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((row, index) => (
                    <React.Fragment key={index}>
                        <TableRow
                        onClick={() => toggleRow(index)}
                        sx={{
                            backgroundColor: "#1e1e1e",
                            cursor: "pointer",
                            "&:hover": { backgroundColor: "#2c2c2c" },
                        }}
                        >
                        <TableCell sx={{ color: "white", fontFamily: "'Ubuntu', sans-serif" }}>
                            {row.role}
                        </TableCell>
                        <TableCell sx={{ color: "white", fontFamily: "'Ubuntu', sans-serif" }}>
                            <Link
                            to={row.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            color="inherit"
                            style={{ color: "#6497b1", textDecoration: "underline" }}
                            >
                            {row.company}
                            </Link>
                        </TableCell>
                        <TableCell sx={{ color: "white", fontFamily: "'Ubuntu', sans-serif" }}>
                            {row.duration}
                        </TableCell>
                        </TableRow>

                        {/* Collapsible Row */}
                        <TableRow>
                        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={3}>
                            <Collapse in={openRows.includes(index)} timeout="auto" unmountOnExit>
                            <Box sx={{ margin: 1 }}>
                                <Typography
                                variant="body2"
                                component="div"
                                color="white"
                                sx={{
                                    fontFamily: "'Ubuntu', sans-serif",
                                    textAlign: "justify",
                                    marginLeft: "4px",
                                    marginRight: "4px",
                                    marginBottom: "12px",
                                    marginTop: "12px",
                                }}
                                >
                                {row.details}
                                </Typography>
                            </Box>
                            </Collapse>
                        </TableCell>
                        </TableRow>
                    </React.Fragment>
                    ))}
                </TableBody>
                </Table>
            </TableContainer>
        </Box>
        
        <Box sx={{ marginTop: "18px", marginBottom: "36px" }}>
            <Typography
                variant="body1"
                component="div"
                color="white"
                sx={{
                fontFamily: "'Ubuntu', sans-serif",
                textAlign: "left",
                marginBottom: "12px",
                marginLeft: "4px",
                fontWeight: "bold",
                fontSize: "16px",
                }}
            >
            🎓 Education
            </Typography>
            <Typography
                variant="body2"
                component="div"
                color="white"
                sx={{
                    fontFamily: "'Ubuntu', sans-serif",
                    textAlign: "justify",
                    marginLeft: "4px",
                    marginRight: "4px",
                    marginBottom: "12px",
                    marginTop: "12px",
                    whiteSpace: "pre-line",
                }}
            >
                Computer Science, Bandung Institute of Technology (ITB), 2020 - 2025. GPA: 3.54/4.00
            </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default About;