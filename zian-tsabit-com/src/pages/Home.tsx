import { useState } from 'react'
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import '../css/Home.css';;

function Home() {
    return (
        <Container maxWidth="xl">
            <Box sx={{ bgcolor: '#24292d', height: '100vh', width: '85vh', margin: '24px', padding: '18px' }}>
                <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <Avatar
                            alt="Zian Tsabit"
                            src="src/assets/pp-github.jpeg"
                            sx={{ width: 120, height: 120 }}
                        />
                        <Box>
                            <Typography gutterBottom variant="h5" component="div">
                                Hello, I'm Ghazian Tsabit Alkamil
                            </Typography>
                        </Box>
                        
                </Stack>
            </Box>
        </Container>
    );
}

export default Home