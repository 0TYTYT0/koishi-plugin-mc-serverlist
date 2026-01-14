import { Context, Schema } from 'koishi'
import { mcs } from './commands/mcs'

export const name = 'mc-server-status'

export const inject = [
  'puppeteer',
  'database',
]

export interface Config {
  IP: string
  motd: boolean
  skipSRV: boolean
  authority: number
  footer: string
  dnsServer: string
}

export const Config: Schema<Config> = Schema.object({
  IP: Schema.string()
    .required(true)
    .description('默认服务器IP'),
  authority: Schema
    .number()
    .default(0)
    .description('默认指令权限等级 (mcs)'),
  dnsServer: Schema.string()
    .description('DNS 服务器')
    .default('223.6.6.6'),
  skipSRV: Schema.boolean()
    .description('是否跳过 SRV 记录')
    .default(false),
  motd: Schema.boolean()
    .default(true)
    .description('是否显示服务器 MOTD'),
  footer: Schema.string()
    .role('textarea', { rows: [2, 4] })
    .default('')
    .description('底部显示文字 (支持多行)')
})

export const usage = `
自用查询 Minecraft 服务器状态的插件。
`

declare module 'koishi' {
  interface Tables {
    mc_server_status: McServerStatus
  }
}

export interface McServerStatus {
  id: string
  server_ip: string
}

export function apply(ctx: Context, config: Config) {
  
  const logger = ctx.logger('mc-server-status');
  ctx.model.extend('mc_server_status', {
    id: 'string',
    server_ip: 'string'
  }, {})
  mcs(ctx, config)
}
