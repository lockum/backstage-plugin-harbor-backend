import express from 'express'
import { Config } from '@backstage/config'
import Router from 'express-promise-router'
import {
  LoggerService,
  AuthService,
  HttpAuthService,
} from '@backstage/backend-plugin-api'
import { getArtifacts } from './artifact'
import { repoSearch } from './search'
import { getHarborInstances } from './config'

export interface RouterOptions {
  logger: LoggerService
  config: Config
  auth: AuthService
  httpAuth: HttpAuthService
}

export async function createRouter(
  options: RouterOptions
): Promise<express.Router> {
  const { logger, config } = options

  logger.info('Initializing harbor backend')
  const harborInstances = getHarborInstances(config)
  const redisConfig = config.getOptionalConfig('redis')

  const router = Router()
  router.use(express.json())

  router.get('/artifacts', async (request, response) => {
    try {
      let host: string = (request.query.host as string) ?? ''
      let project: string = (request.query.project as string) ?? ''
      let repository: string = (request.query.repository as string) ?? ''
      const slug: string = (request.query.slug as string) ?? ''

      if (slug) {
        const decodedSlug = decodeURIComponent(slug).trim()
        const parts = decodedSlug.split('/')
        if (parts.length >= 2) {
          const matchingInstance = harborInstances.find(
            (i) => i.host && i.host.toLowerCase() === parts[0].toLowerCase()
          )
          if (matchingInstance) {
            host = matchingInstance.host
            project = parts[1]
            repository = parts.slice(2).join('/')
          } else if (
            parts[0].includes('.') ||
            parts[0].includes(':') ||
            parts[0].toLowerCase() === 'localhost'
          ) {
            if (parts.length >= 3) {
              host = parts[0]
              project = parts[1]
              repository = parts.slice(2).join('/')
            } else {
              host = ''
              project = parts[0]
              repository = parts.slice(1).join('/')
            }
          } else {
            host = ''
            project = parts[0]
            repository = parts.slice(1).join('/')
          }
        }
      } else if (host && project && repository) {
        const decodedHost = decodeURIComponent(host)
        const hostExists = harborInstances.some((i) => i.host === decodedHost)
        const defaultExists = harborInstances.some((i) => i.host === '')
        if (!hostExists && defaultExists) {
          const originalProject = decodeURIComponent(project)
          const originalRepo = decodeURIComponent(repository)
          project = decodedHost
          repository = `${originalProject}/${originalRepo}`
          host = ''
        } else {
          host = decodedHost
          project = decodeURIComponent(project)
          repository = decodeURIComponent(repository)
        }
      } else {
        if (host) host = decodeURIComponent(host)
        if (project) project = decodeURIComponent(project)
        if (repository) repository = decodeURIComponent(repository)
      }

      const artifacts = await getArtifacts(
        harborInstances,
        host,
        project,
        repository
      )

      response.send(artifacts)
    } catch (error) {
      console.error('Error in /artifacts handler:', error)
      response.status(500).json({ error: (error as Error).message })
    }
  })

  router.post('/search', async (request, response) => {
    const host: string = (request.query.host as string) ?? ''
    const team: any = request.query.team
    const search = await repoSearch(
      harborInstances,
      host,
      request.body,
      team,
      redisConfig
    )

    response.send(search)
  })

  router.get('/health', (_, response) => {
    response.send({ status: 'ok' })
  })
  return router
}
