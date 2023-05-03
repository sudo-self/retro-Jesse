import { Client } from '@microsoft/microsoft-graph-client'
import { lightFormat, parse, toDate } from 'date-fns'
import ky from 'ky'
import queryString from 'query-string'
import { oneDriveAuth } from '../../constants/auth'
import { getJson, replaceJson, updateJson } from '../../helpers/local-storage'
import { type FileSummary, type FileSystemProvider } from './file-system-provider'

const authorizeUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

const { clientId, scope, redirectUri, codeChallenge } = oneDriveAuth
const stateCreateTimeFormat = 'yyyyMMddHHmmssSSS'

let onedriveCloudProvider
export class OneDriveProvider implements FileSystemProvider {
  private client: Client

  private constructor() {
    this.client = Client.init({
      authProvider(done) {
        done(undefined, getJson('onedrive').access_token)
      },
    })
  }

  static get() {
    if (onedriveCloudProvider) {
      return onedriveCloudProvider as OneDriveProvider
    }
    onedriveCloudProvider = new OneDriveProvider()
    OneDriveProvider.dectectRedirect()
    return onedriveCloudProvider as OneDriveProvider
  }

  static authorize() {
    const query = {
      client_id: clientId,
      scope,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
    }
    const url = queryString.stringifyUrl({ url: authorizeUrl, query })
    location.assign(url)
  }

  static async getToken() {
    const { code, error, error_description: errorDescription } = queryString.parse(location.search)
    if (error) {
      console.error({ error, errorDescription })
      return
    }
    if (!code || typeof code !== 'string') {
      return
    }
    const result = await ky
      .post(tokenUrl, {
        body: new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          code,
          grant_type: 'authorization_code',
          code_verifier: codeChallenge,
        }),
      })
      .json<any>()
    replaceJson('onedrive', result)
  }

  static async refreshToken() {
    const refreshToken = getJson('onedrive').refresh_token
    if (!refreshToken) {
      return
    }
    const result = await ky
      .post(tokenUrl, {
        body: new URLSearchParams({
          client_id: clientId,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          code_verifier: codeChallenge,
        }),
      })
      .json<any>()
    updateJson('onedrive', result)
  }

  private static dectectRedirect() {
    if (location.search.includes('code')) {
      OneDriveProvider.getToken()
    }
  }

  private static async wrapRequest(request: any) {
    try {
      return await request()
    } catch (error: any) {
      if (error.code === 'InvalidAuthenticationToken') {
        await OneDriveProvider.refreshToken()
        return await request()
      }
      throw error
    }
  }

  async getFileContent(path: string) {
    const request = this.client.api(`/me/drive/root:${path}`)
    const { '@microsoft.graph.downloadUrl': downloadUrl } = await OneDriveProvider.wrapRequest(() => request.get())
    return await ky(downloadUrl).blob()
  }

  async listDirFilesRecursely(path: string) {
    if (localStorage.remoteFiles && path === '/test-roms/') {
      return JSON.parse(localStorage.remoteFiles)
    }
    const files: FileSummary[] = []

    const list = async (path: string) => {
      const children = await this.listDir(path)
      for (const child of children) {
        const childParentPath = decodeURIComponent(child.parentReference.path.replace(/^\/drive\/root:/, ''))
        if (child.folder?.childCount) {
          const childPath = `${childParentPath}/${child.name}`
          await list(childPath)
        } else if (child.file) {
          files.push({
            name: child.name,
            path: `${childParentPath}/${child.name}`,
            dir: childParentPath,
            downloadUrl: child['@microsoft.graph.downloadUrl'],
          })
        }
      }
    }

    await list(path)

    return files
  }

  // path should start with a slash
  async createFile({ file, path }) {
    if (!file || !path) {
      return
    }
    const request = this.client.api(`/me/drive/root:${path}:/content`)
    await OneDriveProvider.wrapRequest(() => request.put(file))
  }

  async deleteFile(path: string) {
    if (!path) {
      return
    }
    const request = this.client.api(`/me/drive/root:${path}`)
    await OneDriveProvider.wrapRequest(() => request.delete())
  }

  async uploadState(state) {
    const { core, name, createTime, blob, thumbnailBlob } = state
    const stateBaseFileName = lightFormat(toDate(createTime), stateCreateTimeFormat)
    const stateDirPath = `/test-roms/retro-assembly/states/${core}/${name}/`
    await Promise.all([
      this.createFile({ file: blob, path: `${stateDirPath}${stateBaseFileName}.state` }),
      this.createFile({ file: thumbnailBlob, path: `${stateDirPath}${stateBaseFileName}.png` }),
    ])
  }

  async getStates({ name, core }) {
    const stateDirPath = `/test-roms/retro-assembly/states/${core}/${name}/`
    const children = await this.listDirFilesRecursely(stateDirPath)
    const states: any = []
    const thumbnailMap: Record<string, string> = {}

    for (const child of children) {
      const [base, ext] = child.name.split('.')
      const createTime = parse(base, stateCreateTimeFormat, new Date())
      if (createTime) {
        if (ext === 'state') {
          const state = {
            core,
            name,
            createTime,
            path: child.path,
            thumbnailUrl: '',
          }
          states.push(state)
        } else if (ext === 'png') {
          thumbnailMap[base] = child.downloadUrl
        }
      }
    }

    for (const state of states) {
      const key = lightFormat(state.createTime, stateCreateTimeFormat)
      state.thumbnailUrl = thumbnailMap[key] ?? state.thumbnailUrl
    }

    return states
  }

  async deleteState({ core, name, createTime }) {
    const stateBaseFileName = createTime
    const stateDirPath = `/test-roms/retro-assembly/states/${core}/${name}/`
    await Promise.allSettled([
      this.deleteFile(`${stateDirPath}${stateBaseFileName}.state`),
      this.deleteFile(`${stateDirPath}${stateBaseFileName}.png`),
    ])
  }

  private async listDir(path = '/') {
    const children: any[] = []

    let apiPath = path === '/' ? '/me/drive/root/children' : `/me/drive/root:${path}:/children`

    // "top" means page size
    let top = 200
    let token = ''
    do {
      const request = this.client.api(apiPath).top(top).skipToken(token)
      const result = await OneDriveProvider.wrapRequest(() => request.get())
      children.push(...result.value)

      const nextLink = result['@odata.nextLink']
      if (nextLink) {
        const { url, query } = queryString.parseUrl(nextLink)
        apiPath = new URL(url).pathname.replace('/v1.0', '')
        token = query.$skipToken ? `${query.$skipToken}` : ''
        top = Number.parseInt(`${query.$top}`, 10) ?? top
      } else {
        apiPath = ''
      }
    } while (apiPath)

    return children
  }
}
