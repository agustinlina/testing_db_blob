import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { put } from '@vercel/blob'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')
const LOCAL_DB = path.join(ROOT, 'users.json')

// URL pública de tu blob (mismo nombre de archivo):
const BLOB_URL =
  'https://yuvdb04fmqfuhxsy.public.blob.vercel-storage.com/users.json'

// Detecta Vercel
const isVercel = !!process.env.VERCEL

// Helpers CORS
function setCORS (res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// ---- LOCAL FS ----
async function readLocal () {
  if (!fs.existsSync(LOCAL_DB)) fs.writeFileSync(LOCAL_DB, '[]', 'utf8')
  const raw = await fs.promises.readFile(LOCAL_DB, 'utf8')
  try {
    return JSON.parse(raw) || []
  } catch {
    return []
  }
}
async function writeLocal (arr) {
  await fs.promises.writeFile(LOCAL_DB, JSON.stringify(arr, null, 2), 'utf8')
}

// ---- BLOB ----
async function readBlob () {
  const res = await fetch(BLOB_URL, { cache: 'no-store' })
  if (res.status === 404) {
    await writeBlob([])
    return []
  }
  if (!res.ok) return []
  return await res.json()
}
async function writeBlob (arr) {
  await put('users.json', JSON.stringify(arr, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json'
  })
}

export default async function handler (req, res) {
  setCORS(res)

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    if (req.method === 'GET') {
      // ➜ DEV: lee archivo local | VERCEL: lee blob
      const data = isVercel ? await readBlob() : await readLocal()
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).send(JSON.stringify(data)) // ← /api/users muestra el JSON tal cual
      return
    }

    if (req.method === 'POST') {
      // Alta de usuario (para que /api/users vaya creciendo)
      const chunks = []
      for await (const c of req) chunks.push(c)
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')

      let { usuario, password, sede } = body
      if (!usuario || !password || !sede)
        return res
          .status(400)
          .json({ error: 'Campos requeridos: usuario, password, sede' })

      sede = String(sede).toLowerCase()
      if (!['olavarria', 'cordoba'].includes(sede))
        return res.status(400).json({ error: 'Sede inválida' })

      const data = isVercel ? await readBlob() : await readLocal()
      const nuevo = {
        id: Date.now(),
        usuario: String(usuario),
        password: String(password),
        sede,
        createdAt: new Date().toISOString()
      }
      data.push(nuevo)
      if (isVercel) await writeBlob(data)
      else await writeLocal(data)

      return res.status(201).json({ ok: true, id: nuevo.id })
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    res.status(405).json({ error: 'Método no permitido' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error interno' })
  }
}
