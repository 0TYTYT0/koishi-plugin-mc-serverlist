import { Context, Schema } from 'koishi'
import { mcs } from './commands/mcs'

export const name = 'mc-server'

export const inject = [
  'puppeteer'
]

export interface Config {
  IP: string
  motd: boolean
  authority: number
  footer: string
}

export const Config: Schema<Config> = Schema.object({
  IP: Schema.string()
    .required(true)
    .description('默认服务器IP'),
  authority: Schema
    .number()
    .default(0)
    .description('默认指令权限等级 (mcs)'),
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

export function apply(ctx: Context, config: Config) {
  mcs(ctx, config)
}
