import { Context, Schema } from 'koishi'
import { mcs } from './commands/mcs'

export const name = 'mc-server'
export const inject = [
  'puppeteer'
]

export interface ServerItem {
  name: string
  ip: string
}

export interface Config {
  servers: ServerItem[]
  showMotd: boolean
  showIP: boolean
  authority: number
  footer: string
}

export const Config: Schema<Config> = Schema.object({
  servers: Schema.array(
    Schema.object({
      name: Schema.string()
        .required(true)
        .description('服务器名称'),
      ip: Schema.string()
        .required(true)
        .description('服务器地址'),
    })
  )
    .role('table')
    .default([{ name: 'default', ip: 'localhost' }])
    .description('服务器列表，支持多个服务器查询'),
  authority: Schema
    .number()
    .default(0)
    .description('默认指令权限等级 (mcs)'),
  showMotd: Schema.boolean()
    .default(true)
    .description('是否显示服务器 MOTD'),
  showIP: Schema.boolean()
    .default(true)
    .description('是否显示服务器地址'),
  footer: Schema.string()
    .role('textarea', { rows: [2, 4] })
    .default('')
    .description('底部显示文字 (支持多行)')
})

export const usage = `
自用查询 Minecraft JAVA版服务器状态的插件。支持查询多个服务器, 并生成图片返回。
`

export function apply(ctx: Context, config: Config) {
  mcs(ctx, config)
}
