import { Context } from "koishi";
import { Config } from '../index';
import { } from 'koishi-plugin-puppeteer'
import { Logger } from 'koishi';

const logger = new Logger('mc-server');

export async function generateHtml(text: string, footer, config: Config) {
  const dark = [config.color0, config.color1, config.color2];
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
    .server-icon {
      width: 72px;
      height: 72px;
      object-fit: contain;
    }
  </style>
</head>
<body style="width: 700px">
  ${text}
  <footer class="bg-[${dark[2]}] text-center py-2">
    <p class="text-sm text-[${dark[1]}]">${footer}</p>
  </footer>
</body>
</html>`;
}

export async function bodyHtml(icon: string, text: string, config: Config) {
  const dark = [config.color0, config.color1, config.color2];
  return `
  <div class="container mx-auto pl-10 pr-8 py-4">
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
  </div>`;
}

export async function getStatus(serverName: string, serverIP: string, config: Config): Promise<{ icon: string; result: string }> {
  let originalName = serverName;
  let originalIP = serverIP;
  let mcdata: any;
  try {
    // 使用 mcsrvstat.us API 替代
    const apiUrl = `https://api.mcsrvstat.us/3/${encodeURIComponent(serverIP)}`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MinecraftServerStatus/1.0)'
     }
    });
    
    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status}`);
    }
    mcdata = await response.json();
    
    // 输出调试信息
    if (config.debug) {
      try { 
        const { icon, mods, ...debugData } = mcdata;
        logger.info('查询服务器:', `${originalName}`, `(${originalIP})`);
        logger.info('精简返回数据:', JSON.stringify(debugData, null, 2));
        if (mcdata.icon) {
          logger.info('服务器图标存在');
        }
      } catch (e) {
        logger.info('调试信息时出错:', e);
      }
    }
    const status = mcdata as any;
    // 处理并生成 HTML 内容
    let result = '';
    let icon = '';
    if (mcdata.online) {
      result += `<p>${originalName}</p>`;
      if (config.showMotd) {
        result += `<p>${status.motd.html}</p>`;
      }
      if (config.showIP){
        result += `<p>IP: ${originalIP} </p>`;
      }
      result += `<p>版本: ${status.version}</p>`;

      if (status.players.online > 0) {
        if (status.players.list && status.players.list.length > 0) {
          const playerNames = status.players.list.map(player => player.name).join(', ');
          result += `<p>在线玩家(${status.players.online}/${status.players.max}): ${playerNames}</p>`;
        } else {
          result += `<p>在线玩家(${status.players.online}/${status.players.max}): 无法获取</p>`;
        }
      } else {
        result += `<p>在线玩家(${status.players.online}/${status.players.max}): 无</p>`;
      }
    }else {
      result += `<p>${originalName}</p>`;
      if (config.showIP){
        result += `<p>IP: ${originalIP} </p>`;
      }
      result += '<p>查询失败，服务器离线或不存在</p>';
    }
    if (status.icon && status.icon.startsWith('data:image')) {
      icon += status.icon;
    }

    return { icon, result };
  } catch (error) {
    logger.error('获取服务器状态时出错:', error);
    return { icon: '', result: '获取服务器状态失败' };
  }
}

export async function mcs(ctx: Context, config: Config) {
  ctx.command('mcs [server]', '查询 Minecraft 服务器状态', { authority: config.authority })
    .action(async ({ }, server) => {
      try {
        if (server){
          let serverName = 'Minecraft Server';
          let serverIP = server
          let { icon, result } = await getStatus(serverName, serverIP, config);
          const text = await bodyHtml(icon, result, config);
          const footer = config.footer.replace(/\n/g, '</br>');
          const html = await generateHtml(text, footer, config);
          const image = await ctx.puppeteer.render(html);
          return image;
        } else {
          let text = '';

          for (const server of config.servers) {
          const { icon, result } = await getStatus(server.name, server.ip, config);
          text += await bodyHtml(icon, result, config);
          }
          
          const footer = config.footer.replace(/\n/g, '</br>');
          const html = await generateHtml(text, footer, config);
          const image = await ctx.puppeteer.render(html);
          return image;
        }
      } catch (e) {
        logger.error('获取服务器状态时出错:', e);
      }
    });
}
