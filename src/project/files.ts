/**
 * Abrir/salvar `.MPC` no disco. Onde a File System Access API existe
 * (Chrome/Edge), guarda o handle e escreve de volta no mesmo arquivo — sem
 * baixar uma cópia nova a cada "salvar". Onde não existe (Firefox/Safari),
 * cai para `<input type="file">` na abertura e download na gravação —
 * previsto desde o início, não um remendo.
 */

export const supportsFileSystemAccess =
  typeof window !== 'undefined' && 'showOpenFilePicker' in window

export interface OpenedFile {
  readonly text: string
  readonly fileName: string
  /** `null` no fallback: não há como reescrever o mesmo arquivo sem a API. */
  readonly handle: FileSystemFileHandle | null
}

const MPC_TYPE: FilePickerAcceptType = {
  description: 'Programa MedState',
  accept: { 'text/plain': ['.mpc', '.MPC'] },
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function openMpcFile(): Promise<OpenedFile | null> {
  if (supportsFileSystemAccess) {
    let handle: FileSystemFileHandle
    try {
      ;[handle] = await window.showOpenFilePicker({ types: [MPC_TYPE] })
    } catch (error) {
      if (isAbort(error)) return null
      throw error
    }
    const file = await handle.getFile()
    return { text: await file.text(), fileName: file.name, handle }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mpc,.MPC,text/plain'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      file.text().then((text) => resolve({ text, fileName: file.name, handle: null }))
    })
    input.click()
  })
}

export interface SavedFile {
  readonly handle: FileSystemFileHandle | null
  readonly fileName: string
}

/**
 * Salva `text`. Passar o `handle` de uma abertura/gravação anterior escreve
 * nele direto ("salvar"); `handle: null` sempre pergunta onde ("salvar como").
 */
export async function saveMpcFile(
  text: string,
  handle: FileSystemFileHandle | null,
  suggestedName: string,
): Promise<SavedFile | null> {
  if (handle) {
    const writable = await handle.createWritable()
    await writable.write(text)
    await writable.close()
    return { handle, fileName: handle.name }
  }

  if (supportsFileSystemAccess) {
    let novoHandle: FileSystemFileHandle
    try {
      novoHandle = await window.showSaveFilePicker({ suggestedName, types: [MPC_TYPE] })
    } catch (error) {
      if (isAbort(error)) return null
      throw error
    }
    const writable = await novoHandle.createWritable()
    await writable.write(text)
    await writable.close()
    return { handle: novoHandle, fileName: novoHandle.name }
  }

  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = suggestedName
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
  return { handle: null, fileName: suggestedName }
}
