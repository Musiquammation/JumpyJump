import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import crypto from 'crypto'
import pg from 'pg'

dotenv.config()

const { Pool } = pg
const pool = new Pool({
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT
})

const app = express()
app.use(cors())
app.use(express.json())

// Hash simple pour mapname si mapid non fourni
function hashMapName(mapname) {
    const hash = crypto.createHash('sha256').update(mapname).digest('hex')
    return BigInt('0x' + hash.slice(0, 12)) % BigInt(1e12)
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
            time INTEGER NOT NULL,
            date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(username, mapid)
        );
    `)
}

// POST /pushRun
app.post('/pushRun', async (req, res) => {
    try {
        let { username, mapid, mapname, time } = req.body
        if (!username || !time) return res.status(400).json({ error: 'username and time required' })

        if (!mapid) {
            if (!mapname) return res.status(400).json({ error: 'mapid or mapname required' })
            mapid = hashMapName(mapname)
            await pool.query(
                `INSERT INTO maps(mapid, mapname)
                 VALUES($1, $2)
                 ON CONFLICT(mapid) DO NOTHING`,
                 [mapid, mapname]
            )
        }

        await pool.query(
            `INSERT INTO runs(username, mapid, time, date)
             VALUES($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT(username, mapid)
             DO UPDATE SET time = EXCLUDED.time, date = CURRENT_TIMESTAMP
             WHERE EXCLUDED.time < runs.time`,
            [username, mapid, time]
        )

        res.json({ success: true, mapid })
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
            `SELECT username, time, date
             FROM runs
             WHERE mapid=$1
             ORDER BY time ASC
             LIMIT 10`,
             [mapid]
        )

        res.json(rows)
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

// Démarrage serveur
initDB().then(() => {
    const port = process.env.PORT || 3000
    app.listen(port, () => console.log(`Server running on port ${port}`))
}).catch(err => console.error('Failed to initialize DB', err))
