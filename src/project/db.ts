import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

/**
 * Persistência local da sessão atual — sobrevive a fechar a aba/o navegador,
 * sem servidor. Guarda só o suficiente para recuperar de onde parou: o texto
 * do `.MPC`, o nome do arquivo (se veio de um) e quando foi salvo.
 *
 * Escopo de hoje: **uma sessão só**, não uma lista de projetos — o app ainda
 * edita um `.MPC` de cada vez. Virar "lista de projetos" é extensão natural
 * (trocar a chave fixa `'current'` por um id por projeto), mas não coube
 * nesta passada.
 */

export interface StoredSession {
  readonly id: 'current'
  readonly text: string
  readonly fileName: string | null
  readonly savedAt: number
}

interface MedPcDB extends DBSchema {
  session: {
    key: string
    value: StoredSession
  }
}

const DB_NAME = 'medpc-studio'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<MedPcDB>> | null = null

function getDb(): Promise<IDBPDatabase<MedPcDB>> {
  dbPromise ??= openDB<MedPcDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('session', { keyPath: 'id' })
    },
  })
  return dbPromise
}

export async function saveSession(text: string, fileName: string | null): Promise<void> {
  const db = await getDb()
  await db.put('session', { id: 'current', text, fileName, savedAt: Date.now() })
}

export async function loadSession(): Promise<StoredSession | undefined> {
  const db = await getDb()
  return db.get('session', 'current')
}

export async function clearSession(): Promise<void> {
  const db = await getDb()
  await db.delete('session', 'current')
}
