import { Context, Schema } from 'koishi'
import { mcs } from './commands/mcs'

export const name = 'mc-serverlist'
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
  color0: string
  color1: string
  color2: string
  footer: string
  debug: boolean
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
    .default([{ name: 'default', ip: 'localhost:25565' }])
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
  color0: Schema.string()
    .role('color')
    .default('#2e3440')
    .description('图片背景颜色'),
  color1: Schema.string()
    .role('color')
    .default('#cdd6f4')
    .description('文字颜色'),
  color2: Schema.string()
    .role('color')
    .default('#434c5e')
    .description('底部文字背景颜色'),
  footer: Schema.string()
    .role('textarea', { rows: [2, 4] })
    .default('')
    .description('底部显示文字 (支持多行)'),
  debug: Schema.boolean()
    .default(false)
    .description('输出调试日志'),
})

export const usage = `
查询Minecraft JAVA 版服务器状态的插件, 并生成图片。支持同时查询多个服务器。  
使用mcsrvstat.us API。
`

export function apply(ctx: Context, config: Config) {
  mcs(ctx, config)
}
