import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createTheme } from '@mui/material/styles';
import {
	AppBar,
	Container,
	Toolbar,
	Box,
	IconButton,
	Menu,
	MenuItem,
	Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useSelector } from 'react-redux';
import { ReactComponent as Logo } from '../images/logo.svg';
import UserMenu from './navbar/UserMenu';

const navbar_theme = createTheme({
	palette: {
		primary: {
			main: '#f5f5f5',
		},
		secondary: {
			main: '#FF1E56',
		},
	},
});

const NavBar = ({ t, handleLanguage, language }) => {
	const [anchorElNav, setAnchorElNav] = useState(null);

	const user = useSelector((state) => state.user);

	let pages = {};

	let translate1 = `${t('nav.1')}`;
	let translate2 = `${t('nav.2')}`;
	let translate3 = `${t('nav.3')}`;
	let translate4 = `${t('nav.4')}`;
	let translate5 = `${t('nav.5')}`;

	if (user === '') {
		pages[translate1] = '/login';
		pages[translate2] = '/signup';
	} else {
		pages[translate3] = '/profile';
		pages[translate4] = '/browsing';
		pages[translate5] = '/logout';
	}

	const handleOpenNavMenu = (event) => {
		setAnchorElNav(event.currentTarget);
	};

	const handleCloseNavMenu = () => {
		setAnchorElNav(null);
	};

	return (
		<AppBar position="static" theme={navbar_theme}>
			<Container maxWidth="xl">
				<Toolbar disableGutters>
					<Box
						component={Link}
						to="/"
						sx={{
							display: {
								xs: 'none',
								md: 'flex',
								marginRight: 20,
							},
							height: '40px',
						}}
					>
						<Logo fill="#000046" />
					</Box>
					<Box
						sx={{
							flexGrow: 1,
							display: { xs: 'flex', md: 'none' },
						}}
					>
						<IconButton
							size="large"
							aria-label="account of current user"
							aria-controls="menu-appbar"
							aria-haspopup="true"
							onClick={handleOpenNavMenu}
							color="inherit"
						>
							<MenuIcon />
						</IconButton>
						<Menu
							id="menu-appbar"
							anchorEl={anchorElNav}
							anchorOrigin={{
								vertical: 'bottom',
								horizontal: 'left',
							}}
							keepMounted
							transformOrigin={{
								vertical: 'top',
								horizontal: 'right',
							}}
							open={Boolean(anchorElNav)}
							onClose={handleCloseNavMenu}
							sx={{ display: { xs: 'block', md: 'none' } }}
						>
							{Object.keys(pages).map((page) => {
								return (
									<MenuItem
										key={page}
										onClick={handleCloseNavMenu}
										component={Link}
										to={pages[page]}
									>
										{page}
									</MenuItem>
								);
							})}
						</Menu>
					</Box>
					<Box
						sx={{
							flexGrow: 1,
							height: '40px',
							display: { xs: 'flex', md: 'none' },
						}}
						component={Link}
						to="/"
					>
						<Logo />
					</Box>

					<Box
						sx={{
							flexGrow: 1,
							display: { xs: 'none', md: 'flex' },
						}}
					>
						{Object.keys(pages).map((page) => {
							return (
								<Button
									color="inherit"
									key={page}
									onClick={handleCloseNavMenu}
									sx={{ mr: 2 }}
									component={Link}
									to={pages[page]}
								>
									{page}
								</Button>
							);
						})}
					</Box>
					<Box>
						<Button
							value={'ro'}
							variant={language === 'ro' ? 'contained' : 'text'}
							onClick={handleLanguage}
						>
							🇷🇴
						</Button>
						<Button
							value={'en'}
							variant={language === 'en' ? 'contained' : 'text'}
							onClick={handleLanguage}
						>
							🇬🇧
						</Button>
						<Button
							value={'fi'}
							variant={language === 'fi' ? 'contained' : 'text'}
							onClick={handleLanguage}
						>
							🇫🇮
						</Button>
						<Button
							value={'hu'}
							variant={language === 'hu' ? 'contained' : 'text'}
							onClick={handleLanguage}
						>
							🇭🇺
						</Button>
					</Box>
					<UserMenu user={user} t={t} />
				</Toolbar>
			</Container>
		</AppBar>
	);
};

export default NavBar;
