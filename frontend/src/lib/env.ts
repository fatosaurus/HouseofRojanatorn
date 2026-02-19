const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

const defaultApiBaseUrl = import.meta.env.DEV
  ? 'http://localhost:7071/api'
  : 'https://houseofrojanatorn-g8exadena3btbea7.southeastasia-01.azurewebsites.net/api'

export const env = {
  apiBaseUrl: (rawBaseUrl?.trim() || defaultApiBaseUrl).replace(/\/$/, '')
}
