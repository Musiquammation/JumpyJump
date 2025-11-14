import express from "express";
import cors from "cors";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const app = express();
app.use(cors());
app.use(express.json());

// Hash si mapid non fourni
function hashMapName(mapname) {
    return BigInt('0x' + crypto.createHash('sha256').update(mapname).digest('hex')) % BigInt(1e12);
}

// Création des tables si inexistantes
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS maps (
            mapid BIGINT PRIMARY KEY,
            mapname TEXT NOT NULL UNIQUE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS runs (
            username TEXT NOT NULL,
            mapid BIGINT NOT NULL REFERENCES maps(mapid),
            time INTEGER NOT NULL,
            date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(username, mapid)
        )
    `);

    // Index pour accélérer les requêtes leaderboard
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_runs_mapid_time ON runs(mapid, time)
    `);
}

// PUSH RUN
app.post("/pushRun", async (req, res) => {
    try {
        let { username, mapid, mapname, time } = req.body;
        if (!mapid) {
            if (!mapname) return res.status(400).json({ error: "mapid or mapname required" });
            mapid = hashMapName(mapname);
            await pool.query(
                `INSERT INTO maps(mapid, mapname)
                 VALUES ($1, $2)
                 ON CONFLICT (mapid) DO NOTHING`,
                 [mapid, mapname]
            );
        }

        // Insérer ou update seulement si meilleur temps
        await pool.query(
            `INSERT INTO runs(username, mapid, time, date)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT(username, mapid) DO UPDATE
             SET time = EXCLUDED.time,
                 date = CURRENT_TIMESTAMP
             WHERE EXCLUDED.time < runs.time`,
            [username, mapid, time]
        );

        res.json({ success: true, mapid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// GET LEADERBOARD
app.get("/leaderboard", async (req, res) => {
    try {
        let { mapid, mapname } = req.query;
        if (!mapid) {
            if (!mapname) return res.status(400).json({ error: "mapid or mapname required" });
            mapid = hashMapName(mapname);
        }
        const { rows } = await pool.query(
            `SELECT username, time, date FROM runs
             WHERE mapid = $1
             ORDER BY time ASC
             LIMIT 10`,
             [mapid]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// GET ALL MAPS
app.get("/allmaps", async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT mapid, mapname FROM maps ORDER BY mapname ASC`);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// Initialisation DB puis lancement serveur
initDB().then(() => {
    app.listen(process.env.PORT || 3000, () => console.log("Server running"));
}).catch(err => {
    console.error("Failed to initialize DB:", err);
});
