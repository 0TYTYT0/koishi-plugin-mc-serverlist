import { Context } from "koishi";
import { Config } from '../index';
import { } from 'koishi-plugin-puppeteer'
import url from 'node:url';
import { Logger } from 'koishi';

const logger = new Logger('mc-server');
interface Status {
  motd: { html: string };
  players: { max: number; online: number ;list: { name: string; id: string }[] };
  version: string;
  icon: string;
  mods: { name: string; version: string };
}

const dark = ["#2e3440", "#cdd6f4", "#434c5e"];

export async function generateHtml(icon: any, text: string, footer) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=auto, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      background-color: ${dark[0]};
      color: ${dark[1]};
    }
  </style>
</head>
<body style="width: 750px">
  <div class="container mx-auto pl-20 pr-8 py-4">
    <div class="px-6 flex items-center gap-10">
      ${
        icon
          ? `<div class="flex-shrink-0">
               <img src="${icon}" alt="server icon" class="server-icon rounded-lg" />
             </div>`
          : ""
      }
      <div class="flex-grow pl-25">
        <div class="text-lg font-bold text-[${dark[1]}]">${text}</div>
      </div>
    </div>
  </div>
  <footer class="bg-[${dark[2]}] text-center py-2">
    <p class="text-sm text-[${dark[1]}]">${footer}</p>
  </footer>
</body>
</html>`;
}

function convertToPunycode(hostname: string): string {
  try {
    // Check if hostname contains non-ASCII characters
    if (!/^[\x00-\x7F]*$/.test(hostname)) {
      return url.domainToASCII(hostname)
    }
    return hostname;
  } catch {
    // If conversion fails, return original hostname
    return hostname;
  }
}


export async function mcs(ctx: Context, config: Config) {
  ctx.command('mcs [server]', '查询 Minecraft 服务器状态', { authority: config.authority })
    .action(async ({ session }, server) => {
      
      server = server || (await ctx.database.get('mc_server_status', session.guildId))[0]?.server_ip || config.IP;
      const originalServer = server
      
      let serverAddress = server;
      let mcdata: any;
      try {
        // 使用 mcsrvstat.us API 替代
        const apiUrl = `https://api.mcsrvstat.us/3/${encodeURIComponent(serverAddress)}`;
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MinecraftServerStatus/1.0)'
          }
        });
        
        if (!response.ok) {
          throw new Error(`API 请求失败: ${response.status}`);
        }
        mcdata = await response.json();
        
        try {
         // 输出调试信息
        const { icon, mods, ...debugData } = mcdata;
        logger.info('原始数据:', JSON.stringify(debugData, null, 2));
        } catch (e) {
        logger.info('调试信息时出错:', e);
        }
      const status: Status = mcdata as any;
      
      // 处理并生成 HTML 内容
      let result = '';
      if (config.motd) {
        result += `<p>${status.motd.html}</p>`;
      }
      result += `<p>IP: ${originalServer} </p>`;
      result += `<p>版本: ${status.version}</p>`;
      result += `<p>在线人数: ${status.players.online}/${status.players.max}</p>`;

      if (status.players.list && status.players.list.length > 0) {
      // 提取玩家名称
        const playerNames = status.players.list.map(player => player.name).join(', ');
       result += `<p>在线玩家: ${playerNames}</p>`;
      } else {
       result += `<p>在线玩家: 无法获取</p>`;
      }
      const icon = status.icon
      const footer = config.footer.replace(/\n/g, '</br>');
      const html = await generateHtml(icon, result, footer);
      const image = await ctx.puppeteer.render(html);
      return image;
      } catch (e) {
        logger.error('查询服务器状态失败:', e);
        return '查询服务器状态失败';
      }
    });
}
