import { Box, Container, Stack, Typography } from "@mui/material";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import GitHubIcon from "@mui/icons-material/GitHub";
import EmailIcon from "@mui/icons-material/Email";

const links = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/ghaziantsabitalkamil/",
    Icon: LinkedInIcon,
    external: true,
  },
  {
    label: "GitHub",
    href: "https://github.com/ZianTsabit",
    Icon: GitHubIcon,
    external: true,
  },
  {
    label: "Email",
    href: "mailto:tsabitghazian@gmail.com",
    Icon: EmailIcon,
    external: false,
  },
];

function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        borderTop: "1px solid",
        borderColor: "divider",
        py: { xs: 3, sm: 3.5 },
      }}
    >
      <Container maxWidth="md">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 2, sm: 2 }}
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography
            component="div"
            sx={{
              color: "text.secondary",
              fontSize: { xs: "12px", sm: "13px" },
            }}
          >
            © {new Date().getFullYear()} Ghazian Tsabit Alkamil
          </Typography>

          <Stack direction="row" spacing={{ xs: 2, sm: 3 }}>
            {links.map(({ label, href, Icon, external }) => (
              <Box
                key={label}
                component="a"
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  color: "primary.main",
                  textDecoration: "none",
                  fontSize: { xs: "13px", sm: "14px" },
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                <Icon sx={{ fontSize: { xs: "16px", sm: "18px" } }} />
                {label}
              </Box>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

export default Footer;
