import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import crypto from 'crypto'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const app = express()
app.use(cors())
app.use(express.json())

// Hash simple pour mapname si mapid non fourni
function hashMapName(mapname) {
    const hash = crypto.createHash('sha256').update(mapname).digest('hex')
    return BigInt('0x' + hash.slice(0, 12)) % BigInt(1e12)
}

// Initialisation DB et RPC
async function initDB() {
    // Création tables
    await supabase.rpc('sql', { sql: `
        CREATE TABLE IF NOT EXISTS maps (
            mapid BIGINT PRIMARY KEY,
            mapname TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS runs (
            username TEXT NOT NULL,
            mapid BIGINT NOT NULL REFERENCES maps(mapid),
            time INTEGER NOT NULL,
            date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(username, mapid)
        );
    `})

    // Création RPC push_best_run
    await supabase.rpc('sql', { sql: `
        create or replace function push_best_run(
            p_username text,
            p_mapid bigint,
            p_time integer
        ) returns void as $$
        begin
            insert into runs(username, mapid, time, date)
            values (p_username, p_mapid, p_time, now())
            on conflict (username, mapid)
            do update set time = excluded.time, date = now()
            where excluded.time < runs.time;
        end;
        $$ language plpgsql;
    `})
}

// POST /pushRun
app.post('/pushRun', async (req, res) => {
    try {
        let { username, mapid, mapname, time } = req.body
        if (!username || !time) return res.status(400).json({ error: 'username and time required' })

        if (!mapid) {
            if (!mapname) return res.status(400).json({ error: 'mapid or mapname required' })
            mapid = hashMapName(mapname)
            await supabase.from('maps').upsert({ mapid, mapname }, { onConflict: ['mapid'] })
        }

        await supabase.rpc('push_best_run', { p_username: username, p_mapid: mapid, p_time: time })
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

        const { data, error } = await supabase
            .from('runs')
            .select('username, time, date')
            .eq('mapid', mapid)
            .order('time', { ascending: true })
            .limit(10)

        if (error) throw error
        res.json(data)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Database error' })
    }
})

// GET /allmaps
app.get('/allmaps', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('maps')
            .select('mapid, mapname')
            .order('mapname', { ascending: true })
        if (error) throw error
        res.json(data)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Database error' })
    }
})

// Démarrage serveur après initialisation DB
initDB().then(() => {
    const port = process.env.PORT || 3000
    app.listen(port, () => console.log(`Server running on port ${port}`))
}).catch(err => {
    console.error('Failed to initialize DB:', err)
})
