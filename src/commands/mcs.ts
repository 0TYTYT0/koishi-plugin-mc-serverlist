import { Context, Logger } from "koishi";
import { Config } from '../index';
import { } from 'koishi-plugin-puppeteer';
import { formatMotdHtml, queryServerStatus } from './mcquery';

const logger = new Logger('mc-server-list');

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
  </style>
</head>
<body style="width: 550px">
  ${text}
  <footer class="bg-[${dark[2]}] text-center py-2">
    <p class="text-sm text-[${dark[1]}]">${footer}</p>
  </footer>
</body>
</html>`;
}

export async function bodyHtml(icon:string, text: string, config: Config) {
  const dark = [config.color0, config.color1, config.color2];
  return `
  <div class="py-4 px-6">
    <!-- 使用 grid 或 flex 分配空间 -->
    <div class="flex items-center" style="gap: 0;">
      <!-- 左侧固定空间，图标在其中居中 -->
      ${icon
        ? `<div style="width: 96px; display: flex; justify-content: center; flex-shrink: 0;">
            <img src="${icon}" width="72" height="72" />
          </div>`
        : ""
      }
      <!-- 文字区域占据剩余空间 -->
      <div class="flex-grow" style="padding-left: 24px;">
        <div class="text-lg font-bold text-[#cdd6f4]">${text}</div>
      </div>
    </div>
  </div>`;
}

export async function getStatus(serverName: string, serverIP: string, config: Config): Promise<{result: string, icon: string}> {
  let mcdata: any;
  try {
    const status = await queryServerStatus(serverIP);
    
    if (config.debug) {
      try { 
        const { favicon, modinfo, ...debugData } = status;
        logger.info('查询服务器:', `${serverName}`, `(${serverIP})`);
        logger.info('精简返回数据:', JSON.stringify(debugData, null, 2));
      } catch (e) {
        logger.info('调试信息时出错:', e);
      }
    }
    // 处理并生成 HTML 内容
    let result = '';
    result += `<p>${serverName}`;
    if (config.showIP){
      result += ` ${serverIP} </p>`;
    }else {
      result += `</p>`;
    }
    if (config.showMotd) {
      result += `<p>${formatMotdHtml(status.description)}</p>`;
    }
    const versionName = status.version?.name || '未知';
    result += `<p>版本: ${escapeHtml(versionName)}</p>`;

    const online = status.players?.online ?? 0;
    const max = status.players?.max ?? 0;
    if (online > 0) {
      if (status.players?.sample && status.players.sample.length > 0) {
        const playerNames = status.players.sample.map(player => player.name).join(', ');
        result += `<p>在线玩家(${online}/${max}): ${escapeHtml(playerNames)}</p>`;
      } else {
        result += `<p>在线玩家(${online}/${max}): 无法获取</p>`;
      }
    } else {
      result += `<p>在线玩家(${online}/${max}): 无人在线</p>`;
    }
    
    return { result , icon: status.favicon || '' };
  } catch (error) {
    logger.error('获取服务器状态时出错:', error);
    let result = '';
    result += `<p>${serverName}`;
      if (config.showIP){
        result += ` ${serverIP} </p>`;
      }else {
        result += `</p>`;
      }
      result += '<p>查询失败</p>';
    return { icon: '', result };
  }
}

export async function mcs(ctx: Context, config: Config) {
  ctx.command('mcs [server]', '查询 Minecraft 服务器状态', { authority: config.authority })
    .action(async ({ }, serverIP) => {
      try {
        if (serverIP){
          // 指定服务器查询
          let serverName = 'Minecraft Server';
          let { result, icon } = await getStatus(serverName, serverIP, config);
          const body = await bodyHtml(icon, result, config);
          const footer = config.footer.replace(/\n/g, '</br>');
          const html = await generateHtml(body, footer, config);
          const image = await ctx.puppeteer.render(html);
          if (config.debug) {
            logger.info('生成的 HTML:', html);
          }
          return image;
        } else {
          // 查询配置中的所有服务器
          let text = '';

          for (const server of config.servers) {
          const { result, icon } = await getStatus(server.name, server.ip, config);
          text += await bodyHtml(icon, result, config);
          }
          
          const footer = config.footer.replace(/\n/g, '</br>');
          const html = await generateHtml(text, footer, config);
          const image = await ctx.puppeteer.render(html);
          if (config.debug) {
            logger.info('生成的 HTML:', html);
          }
          return image;
        }
      } catch (e) {
        logger.error('获取服务器状态时出错:', e);
      }
    });
}

// 转义 HTML 特殊字符
function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
