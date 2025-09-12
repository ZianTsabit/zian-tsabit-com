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
            <Box sx={{ bgcolor: '#24292d', height: '100vh' }}>
                <Stack
                    direction="row"
                    sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <Avatar
                            alt="Zian Tsabit"
                            src="src/assets/pp-github.jpeg"
                            sx={{ width: 150, height: 150 }}
                        />
                        <Box>
                            <Typography gutterBottom variant="h5" component="div">
                                Hello, I'm Ghazian Tsabit Alkamil
                            </Typography>
                            <Typography gutterBottom variant="h5" component="div">
                                please just call me Zian
                            </Typography>
                        </Box>
                        
                </Stack>
            </Box>
        </Container>
    );
}

export default Home