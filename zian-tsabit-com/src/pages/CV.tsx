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


function CV() {

  const [openRows, setOpenRows] = useState<number[]>([0, 1, 2, 3, 4]);
    
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
        - Being a PIC for one of the most used services at the entire Cermati Fintech Group, event tracking services.
        - Responsible for developing and maintaining the Redash Data Platform.
        - Responsible for developing and maintaining Airflow and DBT.
        - Work closely with the Business Intelligence and Risk Analsyt Team.

      `,
    },
    {
      role: "Data Engineer",
      company: "Intiva",
      link: "https://intiva.id/",
      duration: "June 2022 - June 2025",
      details: `
        - Create data and RAG pipelines using Airflow, MongoDB, Rabbit MQ, Elastic Stack, and Celery Worker.
        - Setup infrastructure and services monitoring, logging, and alerting using Grafana, Prometheus, Loki, and Promtail.
        - Setup LLM services and playground using Ollama, Langchain, Langfuse, and OpenWebUI.
        - Create data services API using FastAPI.
        - Setup secret management using Hashicorp Secret Vault.
        - Setup monorepo and CI/CD in the company code base.

      `,
    },
    {
      role: "Data Governance Intern",
      company: "Sinar Mas Land",
      link: "https://www.sinarmasland.com/",
      duration: "Apr 2024 - July 2024",
      details: `
        - Learn how to create metadata-driven data pipelines using Microsoft Azure Data Fabric.
        - Create and maintain data pipelines in Azure Synapse Analytics and Azure Data Fabric.
        - Migrate data pipelines from Azure Synapse Analytics to Azure Data Fabric.
        - Create documentation regarding existing data pipelines in both Azure Data Fabric and Azure Synapse Analytics.
      `,
    },
    {
      role: "Data Engineer Intern",
      company: "ITB Career Center",
      link: "https://career.itb.ac.id/",
      duration: "Sep 2023 - Dec 2023",
      details: `
        - Data acquisition from various sources (APIs, web scraping, databases).
        - Data cleaning and preprocessing using Python (Pandas).
        - Data analysis and visualization using Tableau.
      `,
    },
    {
      role: "Data Engineer Intern",
      company: "Cermati Fintech Group",
      link: "https://www.cermati.group/",
      duration: "May 2023 - Sep 2023",
      details: `
      - Migrate bigquery scheduled query to Apache Airflow and DBT.
      - Maintain and develop Redash Data Platform.
      `,
    },
  ];

  return (
    <Box
      sx={{
        width: "100vh",
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
                    textDecoration: "underline",
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
                textDecoration: "underline",
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
                textDecoration: "underline",
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

        <Box sx={{ marginBottom: "36px" }}>
            <Typography
            variant="body1"
            component="div"
            color="white"
            sx={{
              fontFamily: "'Ubuntu', sans-serif",
              textAlign: "left",
              marginLeft: "4px",
              fontWeight: "bold",
              fontSize: "16px",
            }}
            >
            🛠️ Skills
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
              marginTop: "12px",
            }}
          >
            <b>Programing Language:</b> Python, Java, JavaScript, SQL <br />
            <b>Cloud Platform:</b> GCP, Azure <br />
            <b>Database:</b> PostgreSQL, MongoDB, Elasticsearch, Redis <br />
            <b>Tools:</b> Airflow, Kafka, RabbitMQ, Spark, Debezium, Nifi, Docker, Git, DBT, Redash
          </Typography>
        </Box>

        <Box sx={{ marginBottom: "36px" }}>
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

                        <TableRow>
                        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={3}>
                            <Collapse in={openRows.includes(index)} timeout="auto" unmountOnExit>
                            <Box sx={{ margin: 0 }}>
                                <Typography
                                variant="body2"
                                component="div"
                                color="white"
                                sx={{
                                    fontFamily: "'Ubuntu', sans-serif",
                                    textAlign: "justify",
                                    marginY: "0px",
                                }}>
                                {row.details.split('\n').map((line, idx) => (
                                    <React.Fragment key={idx}>
                                    {line}
                                    <br />
                                    </React.Fragment>
                                ))}
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

        <Box sx={{ marginBottom: "36px" }}>
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
          <Link
            to="https://stei.itb.ac.id/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
                color: "#6497b1",
                textDecoration: "underline",
                fontFamily: "'Ubuntu', sans-serif",
                fontSize: "16px",
                display: "flex"
            }}>
            School of Electrical Engineering and Informatics, Bandung Institute of Technology
          </Link>
          <Typography
            variant="body2"
            component="div"
            color="white"
            sx={{
                fontFamily: "'Ubuntu', sans-serif",
                textAlign: "justify",
                marginBottom: "12px",
                whiteSpace: "pre-line",
            }}
            >
              Computer Science, GPA: 3.54/4.00
          </Typography>
            <Typography
            variant="body2"
            component="div"
            color="white"
            gutterBottom
            sx={{
              fontFamily: "'Ubuntu', sans-serif",
              textAlign: "justify",
              marginBottom: "12px",
              whiteSpace: "pre-line",
            }}
            >
              - <b>Thesis:</b> Development of a Transformation Mechanism from Document-Oriented NoSQL Database to Relational Database.
              <br />
              - <b>Completed Modules:</b> database management, AI & ML, parallel and distributed system, computer networks, big data technology, information retrieval system, data and information visualization.
            </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default CV;