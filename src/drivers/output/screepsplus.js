import axios from 'axios'
import { Agent } from 'http'

let http = axios.defaults({
  url: 'https://screepspl.us/api/stats/submit',
  httpAgent: new Agent({ keepAlive: true })
})

export default async function handle ({ token } = {}, { type, stats }) {
  if (!token) throw new Error('Token required')
  let resp = await http({
    data: stats,
    auth: {
      username: 'token',
      password: token
    },
    headers: {
      'content-type': type
    }
  })
  return resp.body
}
