import { createServer } from 'node:http';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createScenarioReader, readSubmission } from './scenario-data.mjs';
import { createEvidenceReader } from './evidence-data.mjs';
import { dashboardSnapshot, scenarioCatalog, scenarioMap, financeSnapshot } from './submission-adapter.mjs';

const deployMode = true;
if (!process.env.NEARMART_USERNAME || !process.env.NEARMART_PASSWORD) throw new Error('NEARMART_USERNAME and NEARMART_PASSWORD are required for deployment');
const source = process.env.NEARMART_SOURCE ?? join(homedir(), 'Desktop', 'NearMart_사전준비');
const experiments = join(source, '04_실험');
const runId = 'S6_INVESTMENT_COMPARE_20261112_01';
const scenario = 'N2_ORIGINAL__BASE__HYP_SLOW__NONE';
const resultFolder = process.env.NEARMART_SOURCE ? join(experiments, runId) :
  new URL('../outputs/NearMart_사전준비/04_실험/' + runId + '/', import.meta.url);
const candidateRun = 'S3_FOUNDATION_20261111_01';
const years = [2027, 2032, 2037, 2042];
const file = (name) => readFile(new URL(name, import.meta.url));
const json = (data) => JSON.parse(data.toString().replace(/^\uFEFF/, ''));
const digest = (data) => createHash('sha256').update(data).digest('hex');
const snapshotCache = new Map();
async function snapshot(version) {
  if (!snapshotCache.has(version)) snapshotCache.set(version,file('data/submission-'+version+'.json').then(json));
  return snapshotCache.get(version);
}

export function csv(data) {
  const [header, ...lines] = data.toString().replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
  const keys = header.split(',');
  return lines.map((line) => {
    const fields = [...(line + ',').matchAll(/(?:"((?:[^"]|"")*)"|([^,]*)),/g)]
      .map(([, quoted, unquoted]) => quoted?.replaceAll('""', '"') ?? unquoted);
    if (fields.length !== keys.length) throw new Error('CSV schema mismatch');
    return Object.fromEntries(keys.map((key, i) => [key, fields[i]]));
  });
}

export async function geography() {
  const [master, data] = await Promise.all([file('01_dong_master.csv'), file('02_dong_boundary.geojson')]);
  const rows = csv(master);
  const geo = json(data);
  const roster = new Map(rows.map(row => [row.adm_cd2, row]));
  const keys = new Set(geo.features.map(feature => feature.properties.adm_cd2));
  if (rows.length !== 427 || roster.size !== 427 || geo.features.length !== 427 || keys.size !== 427 ||
      new Set(rows.map(row => row.adm_cd)).size !== 427 ||
      geo.features.some(({ properties: p, geometry: g }) => {
        const row = roster.get(p.adm_cd2);
        return !row || row.adm_cd !== p.adm_cd || row.gu !== p.gu || row.dong !== p.dong ||
          !['Polygon', 'MultiPolygon'].includes(g.type);
      })) throw new Error('서울 행정동 코드 또는 경계 형식 불일치');
  return { geo, roster };
}

async function candidates(roster) {
  const bytes = await readFile(join(experiments, candidateRun, 'candidate_quality_ledger.csv'));
  if (digest(bytes) !== 'd3f736b783a1f73e8cbb7e527d1ce22e762b51fc83dd10a476431d26c60dec9c') throw new Error('후보 명부 해시 불일치');
  const rows = csv(bytes);
  if (rows.length !== 71 || new Set(rows.map(row => row.site_id)).size !== 71) throw new Error('거점 명부 불일치');
  return rows.map(row => {
    const lat = Number(row.lat), lon = Number(row.lon);
    const mapped = roster.has(row.adm_cd2) && row.geography_status === 'READY' &&
      lat > 37 && lat < 38 && lon > 126 && lon < 128;
    return {
      id: row.site_id, code: row.adm_cd2, gu: row.gu, dong: row.dong, year: Number(row.available_from_year) || null,
      sourceStatus: row.site_source_status, quality: row.quality_status, geography: row.geography_status,
      finance: row.financial_input_status, mapped, lat: mapped ? lat : null, lon: mapped ? lon : null
    };
  });
}

function number(row, key) {
  const value = row[key];
  return value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
}

const ratio = (numerator, denominator) => numerator == null || !denominator ? null : numerator / denominator;

async function conditional(roster) {
  const read = (name) => readFile(resultFolder instanceof URL ? new URL(name, resultFolder) : join(resultFolder, name));
  const manifest = json(await read('run_manifest.json'));
  if (manifest.run_id !== runId || manifest.official_result !== false ||
      manifest.status !== 'CONDITIONAL_COMPARISON_VERIFIED') throw new Error('실행 근거 불일치');
  const names = ['independent_validation.json', 'dashboard_v1/scenario_summary.csv',
    ...['annual_finance.csv','annual_site.csv','annual_dong.csv'].map(name => scenario + '/' + name)];
  const [validationData, summaryData, networkData, siteData, dongData] = await Promise.all(names.map(async name => {
    const data = await read(name);
    if (digest(data) !== manifest.output_hashes?.[name]) throw new Error('실행 결과 해시 불일치');
    return data;
  }));
  const validation = json(validationData).counts;
  const summary = csv(summaryData).find(row => row.scenario_id === scenario && row.run_id === runId);
  if (!validation.PASS || validation.FAIL || validation.NOT_CHECKED || summary?.status !== 'CONDITIONAL_ESTIMATE') throw new Error('검증 상태 불일치');
  const rows = csv(networkData);
  if (new Set(rows.map(row => row.year)).size !== rows.length) throw new Error('연도 중복');
  const annual = Object.fromEntries(rows.filter(row => years.includes(Number(row.year))).map(row => [row.year, {
    model_requests: number(row,'request'), model_completed: number(row,'completed'),
    model_ontime_over_completed: ratio(number(row,'ontime'),number(row,'completed')),
    operating_expenses: number(row,'operating_expenses'), ebitda: number(row,'ebitda'), cash: number(row,'cash'),
    active: number(row,'active_sites'), blockedDongs: number(row,'blocked_dongs'), sites: {}, dongs: {}
  }]));
  for (const row of csv(siteData)) {
    const year = annual[row.year];
    if (!year) continue;
    if (Object.hasOwn(year.sites,row.site_id)) throw new Error('거점 인스턴스 중복');
    const completed = number(row,'completed');
    year.sites[row.site_id] = {
      completed, share: ratio(completed,year.model_completed), ontime: ratio(number(row,'ontime'),completed),
      unprocessed: number(row,'unprocessed'), picker: number(row,'picker_roster'), riders: number(row,'rider_roster'),
      expenses: number(row,'site_total_operating_expenses_krw'), instance: row.site_instance, resource: row.resource_check, hubType: row.hub_type,
      request: number(row,'request'), assignedDongs: number(row,'assigned_dongs'),
      reject: number(row,'reject'), cancel: number(row,'cancel'), externalPending: number(row,'external_pending'),
      pickerFloorFailures: number(row,'full_service_picker_floor_fail_cells'),
      pickerDeficitMinutes: number(row,'max_optimistic_picker_deficit_min_per_day')
    };
  }
  for (const row of csv(dongData)) {
    const year = annual[row.year];
    if (!year) continue;
    if (!roster.has(row.adm_cd2) || Object.hasOwn(year.dongs,row.adm_cd2) ||
        (row.site_id && !Object.hasOwn(year.sites,row.site_id))) throw new Error('권역 조인 불일치');
    year.dongs[row.adm_cd2] = {
      site:row.site_id || null, blocked:row.input_status === 'BLOCKED_SOURCE_NULL', inputStatus:row.input_status,
      request:number(row,'request'), completed:number(row,'completed'), unprocessed:number(row,'unprocessed'),
      reject:number(row,'reject'), cancel:number(row,'cancel'), externalPending:number(row,'external_pending')
    };
  }
  for (const year of Object.values(annual)) {
    const dongs = Object.values(year.dongs);
    if (dongs.length !== roster.size || dongs.filter(dong => dong.blocked).length !== year.blockedDongs ||
        Object.keys(year.sites).length !== year.active) throw new Error('연도별 운영 범위 불일치');
  }
  return {
    runId, scenario, validation, annual, sources: ['run_manifest.json', ...names],
    npv: number(summary, 'npv_krw'),
    fundingPass: summary.funding_limit_pass === 'True',
    model: 'FIFO_15MIN_SINGLETON_75PCT_V1 · N2 원설계 · BASE · HYP_SLOW · 20mm · 423동'
  };
}

export async function dataset() {
  if (deployMode) return json(await file('data/deploy-base.json'));
  const { geo, roster } = await geography();
  const [sites, result] = await Promise.allSettled([candidates(roster), conditional(roster)]);
  return {
    years, geo, rosterCount: roster.size, sites: sites.value ?? [], result: result.value ?? null,
    errors: [sites.status === 'rejected' && '거점 명부 미연결', result.status === 'rejected' && '조건부 결과 미연결'].filter(Boolean),
    geographySource: 'NearMart_data.zip · 02_dong_boundary.geojson · SGIS / admdongkor 2026-10-01',
    candidateRun
  };
}

const scenarioReader = createScenarioReader({read:name=>readFile(resultFolder instanceof URL ? new URL(name,resultFolder) :
  join(resultFolder,name)),csv,digest,number,runId});
const evidenceReader = createEvidenceReader({experiments,csv,scenarioReader,geography});
const types = {
  '/whatif-view':['whatif-view/index.html','text/html'],
  '/whatif-view/style.css':['whatif-view/style.css','text/css'],
  '/whatif-view/app.js':['whatif-view/app.js','text/javascript'],
  '/whatif-view/data.json':['whatif-view/data.json','application/json'],
  '/simulation-view':['simulation-view/index.html','text/html'],
  '/simulation-view/style.css':['simulation-view/style.css','text/css'],
  '/simulation-view/app.js':['simulation-view/app.js','text/javascript'],
  '/simulation-view/data.json':['simulation-view/data.json','application/json'],
  '/demand-view':['demand-view/index.html','text/html'],
  '/demand-view/style.css':['demand-view/style.css','text/css'],
  '/demand-view/app.js':['demand-view/app.js','text/javascript'],
  '/demand-view/data.json':['demand-view/data.json','application/json'],
  '/dispatch-preview':['dispatch-preview/index.html','text/html'],
  '/dispatch-preview/app.js':['dispatch-preview/app.js','text/javascript'],
  '/dispatch-preview/scene.js':['dispatch-preview/scene.js','text/javascript'],
  '/dispatch-preview/preview.css':['dispatch-preview/preview.css','text/css'],
  '/dispatch-preview/data.json':['dispatch-preview/data.json','application/json'],
  ...Object.fromEntries(['/overview','/guide','/demand','/dispatch','/simulation','/decision','/report'].map(route=>[route,['process.html','text/html']])),
  '/process.js':['process.js','text/javascript'], '/process-content.js':['process-content.js','text/javascript'], '/dispatch-3d.js':['dispatch-3d.js','text/javascript'], '/story-s1-adapter.js':['story-s1-adapter.js','text/javascript'],
  '/submission-shell.js':['submission-shell.js','text/javascript'], '/submission-shell.css':['submission-shell.css','text/css'],
  '/version-client.js':['version-client.js','text/javascript'], '/version-client.css':['version-client.css','text/css'],
  '/evidence-entry.js':['evidence-entry.js','text/javascript'], '/evidence-cplus.js':['evidence-cplus.js','text/javascript'],
  '/process.css':['process.css','text/css'], '/process-nav.js':['process-nav.js','text/javascript'], '/process-nav.css':['process-nav.css','text/css'], '/evidence': ['evidence.html','text/html'], '/evidence.js': ['evidence.js','text/javascript'],
  '/evidence.css': ['evidence.css','text/css'], '/investment': ['investment.html','text/html'], '/investment.js': ['investment.js','text/javascript'],
  '/investment.css': ['investment.css','text/css'], '/scenario': ['scenario.html','text/html'], '/scenario.js': ['scenario.js','text/javascript'],
  '/scenario.css': ['scenario.css','text/css'], '/network': ['network.html', 'text/html'], '/network.js': ['network.js', 'text/javascript'], '/network.css': ['network.css', 'text/css'], '/adjacent-boundaries.geojson': ['adjacent-boundaries.geojson', 'application/geo+json'], '/han-river.geojson': ['han-river.geojson', 'application/geo+json'], '/login': ['login.html', 'text/html'], '/login.js': ['login.js', 'text/javascript'], '/login-background.png': ['login-background.png', 'image/png'], '/': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'] };
const sessionKey = randomBytes(32);
const sessionAge = 8 * 60 * 60;
const signature = (expires) => createHmac('sha256',sessionKey).update(expires).digest('hex');
const cookie = (value,age) => 'nearmart_demo=' + value + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + age + (deployMode && process.env.NEARMART_COOKIE_SECURE !== '0' ? '; Secure' : '');
function authenticated(req) {
  const match = req.headers.cookie?.match(/(?:^|;\s*)nearmart_demo=(\d+)\.([a-f0-9]{64})(?:;|$)/);
  if (!match || Number(match[1]) <= Date.now()) return false;
  return timingSafeEqual(Buffer.from(match[2],'hex'),Buffer.from(signature(match[1]),'hex'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const route = requestUrl.pathname;
      if (route === '/healthz') return res.writeHead(200, {'Content-Type':'text/plain'}).end('ok');
      if (req.method === 'POST' && route === '/login') {
        let body = '';
        for await (const chunk of req.setEncoding('utf8')) {
          body += chunk;
          if (body.length > 2048) return res.writeHead(413).end();
        }
        const form = new URLSearchParams(body);
        if (form.get('username') !== process.env.NEARMART_USERNAME || form.get('password') !== process.env.NEARMART_PASSWORD) return res.writeHead(401).end();
        const expires = String(Date.now() + sessionAge * 1000);
        return res.writeHead(303, { Location:'/',
          'Set-Cookie':cookie(expires + '.' + signature(expires),sessionAge), 'Cache-Control':'no-store' }).end();
      }
      if (req.method === 'POST' && route === '/logout') {
        return res.writeHead(303, { Location:'/login', 'Set-Cookie':cookie('',0), 'Cache-Control':'no-store' }).end();
      }
      if (!authenticated(req)) {
        if (route.startsWith('/dispatch-preview/') || route.startsWith('/demand-view/') || route.startsWith('/simulation-view/') || route.startsWith('/whatif-view/') || ['/','/whatif-view','/network','/scenario','/investment','/evidence','/overview','/guide','/demand','/demand-view','/dispatch','/dispatch-preview','/simulation','/simulation-view','/decision','/report'].includes(route)) return res.writeHead(302, { Location:'/login', 'Cache-Control':'no-store' }).end();
        if (route.startsWith('/api/')) return res.writeHead(401, { 'Cache-Control':'no-store' }).end();
      }
      if (route === '/api/evidence' || route === '/api/evidence-trace') {
        const result=route==='/api/evidence'?await evidenceReader.catalog():await evidenceReader.trace(Object.fromEntries(requestUrl.searchParams));
        if (!result) return res.writeHead(404).end();
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(result));
      } else if (route === '/api/story-s1') {
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(await file('data/story-s1.json'));
      } else if (route === '/api/submission' || route === '/api/submission-geo') {
        const version=requestUrl.searchParams.get('version')==='c'?'c':'cplus';
        const name=route==='/api/submission-geo'?'02_dong_boundary.geojson':'data/submission-'+version+'.json';
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(await file(name));
      } else if (route.startsWith('/api/evidence-file/')) {
        const result=await evidenceReader.get(route.slice('/api/evidence-file/'.length));
        if(!result) return res.writeHead(404).end();
        res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(result.name.split('/').at(-1))}).end(result.bytes);
      } else if (route === '/api/scenarios' || route === '/api/scenario-map' || route === '/api/investment') {
        const version=requestUrl.searchParams.get('version')??'cplus';
        let result;
        if (version === 'cplus' || version === 'c') {
          const current=await snapshot(version), other=await snapshot(version==='c'?'cplus':'c');
          const selected=requestUrl.searchParams.get('id')==='C_BASE'?await snapshot('c'):await snapshot('cplus');
          result=route==='/api/scenarios'?scenarioCatalog(current,other):
            route==='/api/investment'?financeSnapshot(selected,requestUrl.searchParams.get('id')):
              scenarioMap(selected,requestUrl.searchParams.get('id'),requestUrl.searchParams.get('year'));
        } else result = route === '/api/scenarios' ? await scenarioReader.catalog() :
          route === '/api/investment' ? await scenarioReader.finance(requestUrl.searchParams.get('id')) :
            await scenarioReader.map(requestUrl.searchParams.get('id'),requestUrl.searchParams.get('year'));
        if (!result) return res.writeHead(404).end();
        res.writeHead(200, { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' }).end(JSON.stringify(result));
      } else if (route.startsWith('/api/submissions/')) {
        const name = route.slice('/api/submissions/'.length);
        const bytes = await readSubmission(name)?.catch(error=>{ if (error.code !== 'ENOENT') throw error; });
        if (!bytes) return res.writeHead(404).end();
        res.writeHead(200, {'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="'+name+'"'}).end(bytes);
      } else if (route === '/api/dashboard') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        const version=requestUrl.searchParams.get('version')??'cplus';
        res.end(JSON.stringify(version==='cplus'||version==='c' ?
          dashboardSnapshot(await snapshot(version),await dataset()) : await dataset()));
      } else if (Object.hasOwn(types, route)) {
        const [name, type] = types[route];
        res.writeHead(200, { 'Content-Type': type.startsWith('image/') ? type : type + '; charset=utf-8',
          ...(type === 'text/html' || ['/app.js','/investment.js','/process.js','/story-s1-adapter.js','/process.css'].includes(route) || route.startsWith('/dispatch-preview/') || route.startsWith('/demand-view/') || route.startsWith('/simulation-view/') || route.startsWith('/whatif-view/') ? { 'Cache-Control':'no-store' } : {}) });
        const bytes=await file(name);
        const submissionPages=new Set(['/','/overview','/guide','/evidence','/demand','/network','/dispatch','/simulation','/investment','/scenario','/decision','/report']);
        const preview=requestUrl.searchParams.get('preview')==='submission'&&process.env.NEARMART_LEGACY_VIEW!=='1';
        let body=type==='text/html'&&submissionPages.has(route)&&preview?bytes.toString()
          .replace(/<script type="module" src="\/(?:app|network|scenario|investment|evidence|evidence-entry|process)\.js"><\/script>/,'')
          .replace('</head>','<link rel="stylesheet" href="/submission-shell.css"><script type="module" src="/submission-shell.js"></script></head>'):bytes;
        if(route==='/dispatch'&&!preview)body=body.toString().replace('href="/process.css"','href="/process.css?dispatch3d=bm2"').replace('src="/process.js"','src="/process.js?dispatch3d=bm2"');
        if(type==='text/html'&&process.env.NEARMART_LEGACY_VIEW==='1')body=body.toString().replace('</head>','<meta name="nearmart-legacy" content="s6"></head>');
        res.end(body);
      } else {
        res.writeHead(404).end();
      }
    } catch (error) {
      console.error(error.message);
      if (!res.headersSent) res.writeHead(503);
      res.end();
    }
  }).listen(Number(process.env.PORT ?? 4173), process.env.HOST ?? (deployMode ? '0.0.0.0' : '127.0.0.1'), () => console.log('NearMart Node server listening on ' + (process.env.PORT ?? 4173)));
}






