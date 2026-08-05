import { useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";

/**
 * The gate in front of the admin page.
 *
 * `onSubmit` is expected to reject on a bad password -- the message belongs next
 * to the fields that produced it, not in the page around them.
 */
function LoginForm({
  onSubmit,
}: {
  onSubmit: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(username, password);
      // Nothing to reset on success: the parent swaps this form out entirely.
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : "Could not sign in.");
      setSubmitting(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        py: 4,
      }}
    >
      <Stack sx={{ gap: 2, width: "100%", maxWidth: "340px" }}>
        <Typography
          component="h1"
          sx={{ fontWeight: "bold", fontSize: "20px", color: "text.primary" }}
        >
          Sign in
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          label="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoFocus
          required
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          fullWidth
        />

        <Button type="submit" variant="contained" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>

        <Typography sx={{ fontSize: "13px", color: "text.secondary" }}>
          The same account as the Django admin. Create one with{" "}
          <Box component="code" sx={{ fontFamily: "monospace" }}>
            manage.py createsuperuser
          </Box>
          .
        </Typography>
      </Stack>
    </Box>
  );
}

export default LoginForm;
