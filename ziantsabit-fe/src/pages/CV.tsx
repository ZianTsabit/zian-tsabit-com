import { Box, Typography, Container, Stack, Divider } from "@mui/material";
import TimelineItem from "../components/TimelineItem";
import SectionHeading from "../components/SectionHeading";
import { TagChipRow } from "../components/TagChip";

const summary = `Data Engineer with experience architecting high-throughput data platforms across GCP, Azure, and on-premise environments. Proven track record of leading event tracking services handling ~2,500 RPS and ~500 GB of daily data, achieving significant cloud cost reductions of ~30% for BigQuery and ~35% for Dataflow and Pub/Sub. Expertise spans the full data lifecycle, including implementing Medallion Architecture, orchestrating 800+ DBT models with Apache Airflow, and deploying AI-driven RAG pipelines using Gemma 3. Proficient in building scalable infrastructure and implementing observability infrastructure.`;

const experience = [
  {
    title: "Software Engineer - Data",
    subtitle: "Cermati Fintech Group",
    subtitleLink: "https://www.cermati.group/",
    location: "Jakarta, Indonesia",
    duration: "June 2025 - Present",
    blurb:
      "Cermati Fintech Group (CFG) is a fintech company founded in 2015, consisting of five entities. I am part of the Data Platform Team, supporting all entities under CFG (officially under the Indodana entity).",
    points: [
      "Owned a high-scale event tracking service adopted by the engineering team across the group company, managing ~2,500 RPS and ~500 GB of daily throughput. Redesigned data pipelines to slash Pub/Sub and Dataflow costs by ~35% (yielding ~$2,000 USD in monthly savings) and implemented a strict data retention strategy of the event's BigQuery table that successfully optimized the BigQuery costs by ~30% for several events.",
      "Maintained and enhanced a large-scale DBT project consisting of 800+ models, streamlined through the orchestration of 186+ Apache Airflow DAGs to assist the Business Intelligence team building and architecting the group company data warehouse and data mart.",
      "Maintained and managed group company-wide Apache Airflow infrastructure and successfully solved a critical memory leak in the Airflow Triggerer component thus removing the whole on-call routine related to that case.",
    ],
  },
  {
    title: "Data Engineer (Infrastructure)",
    subtitle: "Intiva",
    subtitleLink: "https://intiva.id/",
    location: "Jakarta, Indonesia",
    duration: "Sept 2024 - June 2025",
    blurb:
      "Intiva is an IT consulting and services company specializing in software development, automation, machine learning, and big data analytics.",
    points: [
      "Engineered the Bamtren MVP, a news analytics platform using Gemma 3 for RAG-driven content generation and sentiment analysis, processing hundreds of thousands of daily messages via a robust pipeline of Airflow, MongoDB, RabbitMQ, and Celery.",
      "Built internal LLM infrastructure and FastAPI services utilized by 5+ engineers and data scientists, integrating Ollama and LangChain while implementing a full-stack monitoring suite (Grafana, Prometheus, Loki) to track on-premise performance.",
      "Standardized DevOps and security protocols by establishing monorepo CI/CD pipelines and implementing HashiCorp Vault secret management, successfully adopted across two production projects to enhance deployment security and efficiency.",
    ],
  },
  {
    title: "Data Governance (Intern)",
    subtitle: "Sinar Mas Land",
    subtitleLink: "https://www.sinarmasland.com/",
    location: "Tangerang, Indonesia",
    duration: "April - July 2024",
    blurb:
      "Sinar Mas Land is one of Indonesia's largest real estate developers, part of the Sinarmas Group conglomerate.",
    points: [
      "Designed and managed metadata-driven ingestion pipelines to the Bronze layer in Medallion Architecture using Microsoft Azure Data Fabric, streamlining the integration of diverse data sources into a centralized environment.",
    ],
  },
];

const projects = [
  {
    title: "HomeLab Infrastructure Project",
    duration: "Oct 2025 - Present",
    points: [
      "Constructed self-hosted Kubernetes cluster on Proxmox virtualization, configured a multi-node architecture (1 control plane, 2 worker nodes) to master service orchestration and infrastructure management, also implemented observability across multi-node and across the homelab using Grafana and Prometheus, providing real-time monitoring and health metrics for the entire cluster lifecycle.",
      "Hosts this website: the site you are reading runs on that homelab rather than on a managed platform, with its frontend, Django API, PostgreSQL and object storage deployed as Docker Compose stacks on a Proxmox VM and reached only through a Cloudflare Zero Trust tunnel — no port forwarding, no reverse proxy, no certificate to renew.",
    ],
  },
];

const skills = [
  { label: "Programing Language", items: ["Python", "Java", "JavaScript"] },
  {
    label: "Data Engineering & Orchestration",
    items: ["Apache Airflow", "DBT", "Apache Beam"],
  },
  {
    label: "Database & Data Platforms",
    items: [
      "PostgreSQL",
      "Google BigQuery",
      "MongoDB",
      "Redis",
      "Elasticsearch",
      "Redash",
    ],
  },
  {
    label: "Cloud & Infrastructure",
    items: ["Google Cloud Platform", "Microsoft Azure", "Docker", "Kubernetes"],
  },
  { label: "Messaging & Streaming", items: ["RabbitMQ", "Google Pub/Sub"] },
  {
    label: "Monitoring, Logging, & Observability",
    items: ["Grafana", "Prometheus", "Loki", "Promtail"],
  },
  {
    label: "Security & DevOps",
    items: ["Keycloak", "HashiCorp Vault", "GitLab CI", "GitLab Runner"],
  },
  {
    label: "Machine Learning & LLM",
    items: ["LangChain", "Ollama", "Langfuse"],
  },
];

const education = [
  {
    title: "B.Sc. Computer Science",
    subtitle: "Bandung Institute of Technology",
    subtitleLink: "https://stei.itb.ac.id/",
    duration: "",
    points: [
      "CGPA: 3.54 / 4.00",
      "Thesis: Development of a Transformation Mechanism from Document-Oriented NoSQL Database to Relational Database.",
    ],
  },
  {
    title: "Associate Cloud Engineer",
    subtitle: "Google Cloud Platform",
    duration: "2024 - 2027",
  },
];

const socialLinkStyle = {
  color: "primary.main",
  textDecoration: "underline",
  fontSize: { xs: "14px", sm: "16px" },
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

function CV() {
  return (
    <Box
      sx={{
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "transparent",
        alignItems: "center",
        pt: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="md">
        {/* Header */}
        <Stack
          direction="column"
          sx={{
            justifyContent: "center",
            alignItems: "center",
            mb: "18px",
            mt: "18px",
            textAlign: "center",
          }}
        >
          <Typography
            gutterBottom
            component="div"
            sx={{
              mt: "24px",
              fontWeight: "bold",
              fontSize: { xs: "22px", sm: "28px" },
              color: "text.primary",
            }}
          >
            Ghazian Tsabit Alkamil
          </Typography>

          <Typography
            component="div"
            sx={{
              color: "text.secondary",
              fontSize: { xs: "13px", sm: "15px" },
              mb: 1,
            }}
          >
            Jakarta, Indonesia
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 1, sm: 2 }}
            sx={{
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
              mt: 1,
            }}
          >
            <Box
              component="a"
              href="https://www.linkedin.com/in/ghaziantsabitalkamil/"
              target="_blank"
              rel="noopener noreferrer"
              sx={socialLinkStyle}
            >
              <Box
                component="img"
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linkedin/linkedin-original.svg"
                alt=""
                sx={{ width: "20px", height: "20px" }}
              />
              LinkedIn
            </Box>

            <Box
              component="a"
              href="https://github.com/ZianTsabit"
              target="_blank"
              rel="noopener noreferrer"
              sx={socialLinkStyle}
            >
              <Box
                component="img"
                src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg"
                alt=""
                sx={{ width: "20px", height: "20px" }}
              />
              GitHub
            </Box>

            <Box
              component="a"
              href="mailto:tsabitghazian@gmail.com"
              sx={socialLinkStyle}
            >
              ✉️ Email
            </Box>
          </Stack>
        </Stack>

        <Divider sx={{ bgcolor: "divider", my: 2 }} />

        {/* Summary */}
        <Box sx={{ mb: 4 }}>
          <SectionHeading>📄 Summary</SectionHeading>
          <Typography
            component="div"
            sx={{
              textAlign: { xs: "left", sm: "justify" },
              color: "text.primary",
              fontSize: { xs: "12px", sm: "14px", md: "16px" },
              lineHeight: 1.7,
            }}
          >
            {summary}
          </Typography>
        </Box>

        {/* Experience */}
        <Box sx={{ mb: 4 }}>
          <SectionHeading>💼 Experience</SectionHeading>
          {experience.map((item, index) => (
            <TimelineItem
              key={item.title + item.subtitle}
              {...item}
              last={index === experience.length - 1}
            />
          ))}
        </Box>

        {/* Projects */}
        <Box sx={{ mb: 4 }}>
          <SectionHeading>🛠️ Projects</SectionHeading>
          {projects.map((item, index) => (
            <TimelineItem
              key={item.title}
              {...item}
              last={index === projects.length - 1}
            />
          ))}
        </Box>

        {/* Skills */}
        <Box sx={{ mb: 4 }}>
          <SectionHeading>⚙️ Skills</SectionHeading>
          <Stack direction="column" spacing={2}>
            {skills.map((group) => (
              <Box key={group.label}>
                <Typography
                  component="div"
                  sx={{
                    fontWeight: 700,
                    color: "text.secondary",
                    fontSize: { xs: "12px", sm: "13px", md: "14px" },
                    mb: 1,
                  }}
                >
                  {group.label}
                </Typography>
                <TagChipRow labels={group.items} />
              </Box>
            ))}
          </Stack>
        </Box>

        {/* Education & Certifications */}
        <Box sx={{ mb: 4 }}>
          <SectionHeading>🎓 Education &amp; Certifications</SectionHeading>
          {education.map((item, index) => (
            <TimelineItem
              key={item.title}
              {...item}
              last={index === education.length - 1}
            />
          ))}
        </Box>
      </Container>
    </Box>
  );
}

export default CV;
