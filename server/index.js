import {readConfig} from './config.js';
import {createPool} from './db.js';
import {createApp} from './app.js';
const config=readConfig(),pool=createPool(config.DATABASE_URL);
try {await pool.query('SELECT 1 FROM patients LIMIT 1');}
catch {console.error('Database is not ready. Start PostgreSQL and run npm run db:migrate.');await pool.end();process.exit(1);}
const app=await createApp({pool,config});
const server=app.listen(config.PORT,config.HOST,()=>console.log(`SmartMed API listening on port ${config.PORT}`));
const clean=setInterval(()=>pool.query('DELETE FROM sessions WHERE expires_at<now(); DELETE FROM auth_limits WHERE expires_at<now()').catch(()=>console.error('Session cleanup failed.')),3600000);clean.unref();
async function stop(){clearInterval(clean);server.close(async()=>{await pool.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
