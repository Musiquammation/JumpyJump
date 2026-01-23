import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import crypto from 'crypto'
import pg from 'pg'

dotenv.config()

const { Pool } = pg
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: {
	  rejectUnauthorized: false
	}
  })
  

const app = express()
app.use(cors())
app.use(express.json())

// Hash simple pour mapname si mapid non fourni
function hashMapName(mapname) {
	const hash = crypto.createHash('sha256').update(mapname).digest('hex')
	return BigInt('0x' + hash.slice(0, 12)) % BigInt(1e12)
}

function generateRunId(mapId, time, username, now) {
	const raw = `${time}:${mapId}:${username}:${now}`;
	const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
	return `${mapId}-${hash}`;
}



// Initialisation DB
async function initDB() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS maps (
			mapid BIGINT PRIMARY KEY,
			mapname TEXT NOT NULL UNIQUE
		);
	`)

	await pool.query(`
		CREATE TABLE IF NOT EXISTS runs (
			username TEXT NOT NULL,
			mapid BIGINT NOT NULL REFERENCES maps(mapid),
			time INT NOT NULL,
			runid TEXT NOT NULL,
			date BIGINT NOT NULL,
			PRIMARY KEY(username, mapid)
		);
	`)
}



// POST /pushRun
app.post('/pushRun', async (req, res) => {
	try {
		let { username, mapid, mapname, time } = req.body
		if (!username) return res.status(400).json({ error: 'username required' })

		const now = Date.now();

		if (!mapid) {
			if (!mapname) return res.status(400).json({ error: 'mapid or mapname required' })
			mapid = hashMapName(mapname)
		}

		await pool.query(
			`INSERT INTO maps(mapid, mapname)
			VALUES($1, $2)
			ON CONFLICT(mapid) DO NOTHING`,
			[mapid, mapname]
		)

		const runid = generateRunId(mapid, time, username, now);

		await pool.query(
			`INSERT INTO runs(username, mapid, time, runid, date)
			 VALUES($1, $2, $3, $4, $5)
			 ON CONFLICT(username, mapid)
			 DO UPDATE SET time = EXCLUDED.time, date = $5
			 WHERE EXCLUDED.time < runs.time`,
			[username, mapid, time, runid, now]
		)

		res.json({ success: true, mapid: mapid.toString() })
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Database error' })
	}
})  

// GET /leaderboard?mapid=XXX ou mapname=YYY
app.get('/leaderboard', async (req, res) => {
	try {
		let { mapid, mapname } = req.query
		if (!mapid) {
			if (!mapname) return res.status(400).json({ error: 'mapid or mapname required' })
			mapid = hashMapName(mapname)
		}

		const { rows } = await pool.query(
			`SELECT username, time, date, runid
			 FROM runs
			 WHERE mapid=$1
			 ORDER BY time ASC, date ASC
			 LIMIT 10`,
			 [mapid]
		);

		res.json(rows.map(row => {return {
			username: row.username,
			time: row.time,
			runid: row.runid,
			date: row.date.toString(),
		}}));
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Database error' })
	}
})

// GET /allmaps
app.get('/allmaps', async (req, res) => {
	try {
		const { rows } = await pool.query(`SELECT mapid, mapname FROM maps ORDER BY mapname ASC`)
		res.json(rows)
	} catch (err) {
		console.error(err)
		res.status(500).json({ error: 'Database error' })
	}
})
















// Middleware de vérification admin
function checkAdmin(req, res, next) {
	const password = req.headers['x-admin-password'];
	if (password !== process.env.ADMIN_PASSWORD) {
		return res.status(403).json({ error: 'Unauthorized' });
	}
	next();
}

// GET /admin/runs - Récupérer toutes les runs avec infos de map
app.get('/admin/runs', checkAdmin, async (req, res) => {
	try {
		const { rows } = await pool.query(`
			SELECT r.username, r.mapid, r.time, r.runid, r.date, m.mapname
			FROM runs r
			JOIN maps m ON r.mapid = m.mapid
			ORDER BY m.mapname ASC, r.time ASC
		`);
		res.json(rows.map(row => ({
			username: row.username,
			mapid: row.mapid.toString(),
			time: row.time,
			runid: row.runid,
			date: row.date.toString(),
			mapname: row.mapname
		})));
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Database error' });
	}
});

// DELETE /admin/run - Supprimer une run
app.delete('/admin/run', checkAdmin, async (req, res) => {
	try {
		const { username, mapid } = req.body;
		await pool.query(
			`DELETE FROM runs WHERE username=$1 AND mapid=$2`,
			[username, mapid]
		);
		res.json({ success: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Database error' });
	}
});

// PUT /admin/run - Modifier le temps d'une run
app.put('/admin/run', checkAdmin, async (req, res) => {
	try {
		const { username, mapid, time } = req.body;
		await pool.query(
			`UPDATE runs SET time=$3, date=$4 WHERE username=$1 AND mapid=$2`,
			[username, mapid, time, Date.now()]
		);
		res.json({ success: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Database error' });
	}
});

// DELETE /admin/map - Supprimer une map (cascade les runs)
app.delete('/admin/map', checkAdmin, async (req, res) => {
	try {
		const { mapid } = req.body;
		// D'abord supprimer les runs
		await pool.query(`DELETE FROM runs WHERE mapid=$1`, [mapid]);
		// Puis la map
		await pool.query(`DELETE FROM maps WHERE mapid=$1`, [mapid]);
		res.json({ success: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Database error' });
	}
});
















// Démarrage serveur
initDB().then(() => {
	const port = process.env.PORT || 3000
	app.listen(port, () => console.log(`Server running on port ${port}`))
}).catch(err => console.error('Failed to initialize DB', err))


