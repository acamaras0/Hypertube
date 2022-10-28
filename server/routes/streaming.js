module.exports = (app, fs, path, axios, pool, ffmpeg) => {

	let superFile = ""

	const getMagnetLink = (torrentInfo, film_title) => {
		let hash = torrentInfo.hash;
		let torrent_url = torrentInfo.url;

		return `magnet:?xt=urn:btih:${hash}&dn=${film_title.split(" ").join("+")}`;
	};

	const downloadTorrent = async (magnet_link, imdb_id) =>
		new Promise((resolve) => {
			let torrentStream = require("torrent-stream");

			let videoPath = path.resolve(__dirname, "../movies");
			console.log("Downloading files to: ", videoPath);

			let options = {
				trackers: [
					'udp://tracker.opentrackr.org:1337',
					'udp://9.rarbg.com:2810',
					'udp://tracker.openbittorrent.com:80',
					'udp://tracker.openbittorrent.com:6969',
					'udp://opentracker.i2p.rocks:6969',
					'udp://tracker.torrent.eu.org:451',
					'udp://open.stealth.si:80',
					'udp://vibe.sleepyinternetfun.xyz:1738',
					'udp://tracker2.dler.org:80',
					'udp://tracker1.bt.moack.co.kr:80',
					'udp://tracker.zerobytes.xyz:1337',
					'udp://tracker.tiny-vps.com:6969',
					'udp://tracker.theoks.net:6969',
					'udp://tracker.swateam.org.uk:2710',
					'udp://tracker.publictracker.xyz:6969',
					'udp://tracker.monitorit4.me:6969',
					'udp://tracker.moeking.me:6969',
					'udp://tracker.lelux.fi:6969',
					'udp://tracker.encrypted-data.xyz:1337',
				],
				path: videoPath, // Where to save the files. Overrides `tmp`.
			};
			let engine = torrentStream(magnet_link, options);

			let files = [];

			engine.on("ready", () => {
				superFile = engine.files.reduce((a, b) => (a.length > b.length ? a : b));
				engine.files.forEach(async (file) => {
					if (
						file.name.endsWith(".mp4") ||
						file.name.endsWith(".srt")
					) {
						files.push({
							name: file.name,
							path: file.path,
							size: file.length,
						});
						console.log("Now downloading: " + file.name);
						file.select();

						let sql = `SELECT * FROM downloads WHERE imdb_id = $1 AND path = $2`;
						const { rows } = await pool.query(sql, [
							imdb_id,
							`movies/${file.path}`,
						]);

						if (rows.length === 0) {
							sql = `INSERT INTO downloads (path, file_type, file_size, imdb_id) VALUES ($1,$2,$3,$4)`;
							pool.query(sql, [
								`movies/${file.path}`,
								file.name.slice(-3),
								file.length,
								imdb_id,
							]);
						}
					}
				});
			});

			engine.on("download", () => {
				console.log("Downloading...");
				resolve(files);
			});

			engine.on('idle', (files) => {
				console.log("All files downloaded");

				sql = `UPDATE downloads SET completed = 'YES' WHERE imdb_id = $1`
				pool.query(sql, [imdb_id])

				engine.destroy(() => {
					console.log("Engine connection destroyed");
				})
			})
		})

	app.get("/api/moviestream/:id", async (request, response) => {
		const id = request.params.id;

		let sql = `SELECT * FROM downloads WHERE imdb_id = $1 AND file_type = 'mp4'`;
		const { rows } = await pool.query(sql, [id]);

		let moviefile;
		if (rows.length > 0) moviefile = rows[0]["path"];
		else moviefile = `movies/pushthebutton.mp4`;

		const fileSize = fs.statSync(moviefile).size
		const range = request.headers.range
		if (range) {
			console.log("Requested Movie Range: ", range)
			const CHUNK_SIZE = 10 ** 6;
			const start = Number(range.replace(/\D/g, ""))
			const end = Math.min(start + CHUNK_SIZE, fileSize - 1);
			const contentLength = (end - start) + 1
			const head = {
				"Content-Range": `bytes ${start}-${end}/${fileSize}`,
				"Accept-Ranges": "bytes",
				"Content-Length": contentLength,
				"Content-Type": "video/mp4",
				"Cache-Control": "no-cache",
				"Connection": "upgrade, keep-alive"
			};
			response.writeHead(206, head);
			const videoStream = fs.createReadStream(moviefile, { start: start, end: end })
			// ffmpeg(videoStream)
			// 	.format('webm')
			// 	.on('error', () => { })
			// 	.pipe(response);
			videoStream.pipe(response);
		} else {
			console.log("No Movie Range Defined");
			const head = {
				'Content-Length': fileSize,
				'Content-Type': 'video/mp4',
			}
			response.writeHead(200, head)
			const videoStream = fs.createReadStream(moviefile)
			videoStream.pipe(response)
		}
	})

	app.post("/api/streaming/torrent/:id", async (request, response) => {
		const imdb_id = request.params.id;

		let sql = `SELECT * FROM downloads WHERE imdb_id = $1 AND file_type = 'mp4'`;
		const { rows } = await pool.query(sql, [imdb_id]);

		let responseSent = false;

		if (rows.length > 0 && rows[0]["completed"] === "YES")
			return response.status(200).send(`Ready to play`);
		else if (
			rows.length > 0 &&
			fs.existsSync(rows[0]["path"]) &&
			fs.statSync(rows[0]["path"]).size > 50000000
		) {
			response.status(200).send(`Ready to play`);
			responseSent = true;
		}

		const movieInfo = await axios.get(
			`${process.env.TORRENT_API}?query_term=${imdb_id}`
		).then(response => response.data.data.movies[0]);

		let torrentInfo = movieInfo.torrents;
		let film_title = movieInfo.title_long;

		if (torrentInfo.length > 1)
			torrentInfo.sort((a, b) => (a.seeds > b.seeds ? -1 : 1));

		let magnet_link = getMagnetLink(torrentInfo[0], film_title);

		let torrent_files = await downloadTorrent(magnet_link, imdb_id);
		console.log("Torrent files: ", torrent_files);

		while (fs.existsSync(`movies/${torrent_files[0].path}`) === false)
			await new Promise(r => setTimeout(r, 1000));

		fs.watch(`movies/${torrent_files[0].path}`, (curr, prev) => {
			fs.stat(`movies/${torrent_files[0].path}`, (err, stats) => {
				if (stats.size > 50000000 && responseSent === false) {
					console.log(stats.size);
					// if (stats.size > torrent_files[0].size / 10 && responseSent === false) {
					response.status(200).send(`Ready to play`);
					responseSent = true;
				}
			});
		});
	});

	const downloadFile = (imdb_id, language, download_url) => {
		if (!fs.existsSync(`./subtitles/${imdb_id}`)) {
			fs.mkdirSync(`./subtitles/${imdb_id}`, { recursive: true });
		}

		axios.get(download_url)
			.then((response) => {
				fs.writeFile(`./subtitles/${imdb_id}/${imdb_id}-${language}.vtt`, response.data, (err) => console.log(err))

				sql = "INSERT INTO subtitles (imdb_id, language, path) VALUES ($1,$2,$3)"
				pool.query(sql, [imdb_id, language, `/subtitles/${imdb_id}/${imdb_id}-${language}.vtt`])
			}).catch(err => {
				console.log(err)
			})
	}

	app.get("/api/streaming/download_subs/:id", async (request, response) => {
		const imdb_full_id = request.params.id
		const imdb_id = Number(request.params.id.replace(/\D/g, ""));
		const OST_API_KEY = process.env.OST_API_KEY

		let sql = `SELECT * FROM subtitles WHERE imdb_id = $1`
		const oldSubtitles = await pool.query(sql, [imdb_full_id])

		if (oldSubtitles.rows.length === 0) {
			// const token = await axios.post('https://api.opensubtitles.com/api/v1/login', {
			// 	headers: {
			// 		"Api-Key": OST_API_KEY,
			// 		"Content-Type": 'application/json'
			// 	},
			// 	data: {
			// 		"username": 'HypertubeHive',
			// 		"password": 'Hive123!'
			// 	}
			// })
			// console.log(token)

			const { data } = await axios.get(`https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${imdb_id}}`, {
				headers: {
					"Api-Key": OST_API_KEY,
					"Content-Type": 'application/json'
				}
			}).catch(error => {
				console.log(error);
			});

			let finalSubs = []
			const allSubs = data.data.map(sub => sub.attributes)
			let wantedLanguages = ["en", "fi"]

			wantedLanguages.forEach(language => {
				const languageSubs = allSubs.filter(sub => sub.language === language)
				if (languageSubs.length > 0) {
					const languageSub = languageSubs.reduce((a, b) => (a.download_count > b.download_count ? a : b))
					finalSubs.push(languageSub)
				}
			})

			console.log(finalSubs)

			// finalSubs.forEach(async (sub) => {
			// 	await axios.post(`https://api.opensubtitles.com/api/v1/download`, {
			// 		headers: {
			// 			"User-Agent": "curl",
			// 			"Api-Key": OST_API_KEY,
			// 			"Content-Type": 'application/json'
			// 		},
			// 		data: {
			// 			file_id: sub.files[0].file_id,
			// 			sub_format: 'webvtt'
			// 		}
			// 	}).then(downloadInfo => {
			// 		let download_url = downloadInfo.data.link
			// 		downloadFile(imdb_full_id, sub.language, download_url)
			// 	}).catch(error => {
			// 		console.log(error);
			// 	});
			// })

			finalSubs.forEach(sub => {
				downloadFile(imdb_full_id, sub.language, 'https://www.opensubtitles.com/download/C8032C1EC6A37D72EF182B7710D128213B29060B6F413CF7822780E1578F7748D9A587A82B99462FC34B4E9F371E4969FDED45A7A5F389EA093982C461824B8C55CA9C12457CE3E18AC629998F9099271C62DEA862FA3DF614024196E2C88D6AB9C4B7CA789A06590E36A0FA6D0A44C1B28E46A682E538540260E908E065DD5C758E73C86CA7DC9FCE29A7B44871D32B245C1BDCA0DAE5C02E8C9994D48BE1A436DD30F4B072F3A8F0F23461309FB18E6DE71CE129BCDC81816E92E6199DFBADCA05DC61033B87F5BF38AFEB0E27B987D27AE0148EE0A63A7FC8A35A3326E6E9647E41EA514765CBD0729400C39DCD1BC64E9D481AB058A1870F826B121382D00BB36D13A2D01861/subfile/Borat-aXXo.webvtt')
			})

			response.status(200).send("Download succesful")
		} else {
			response.status(200).send("Subs already downloaded")
		}
	})

	app.get("/api/streaming/subtext/:id/:language", async (request, response) => {
		const imdb_id = request.params.id
		const language = request.params.language
		const subtitle_file = `./subtitles/${imdb_id}/${imdb_id}-${language}.vtt`

		fs.readFile(subtitle_file, (err, data) => {
			if (err) {
				console.log(err)
				return response.status(404).send("Something went SO wrong")
			}
			response.set("Content-Type", "text/plain")
			response.status(200).send(data)
		})
	})

	app.get("/api/streaming/subs/:id", async (request, response) => {
		const imdb_id = request.params.id

		sql = `SELECT * FROM subtitles WHERE imdb_id = $1`
		const { rows } = await pool.query(sql, [imdb_id])

		let subtitleTracks = []
		rows.forEach(sub => {
			subtitleTracks.push({
				kind: "subtitles",
				src: process.env.BACKEND_URL + `/api/streaming/subtext/${imdb_id}/${sub['language']}`,
				srcLang: sub['language'],
				label: sub['language'],
				default: true,
			})
		})

		response.status(200).send(subtitleTracks)
	})

};
