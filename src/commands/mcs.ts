import { Context, Logger } from "koishi";
import { indexConfig } from '../index';
import { } from 'koishi-plugin-puppeteer';
import { formatMotdHtml, queryServerStatus } from './mcquery';

const logger = new Logger('mc-server-list');

// 性能计时工具
function perfTimer(label: string) {
  const start = performance.now();
  return {
    end: () => {
      const elapsed = performance.now() - start;
      logger.info(`[计时] ${label}: ${elapsed.toFixed(2)}ms`);
      return elapsed;
    }
  };
}

export async function generateHtml(text: string, footer: string, config: indexConfig) {
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

export async function bodyHtml(icon: string, text: string, config: indexConfig) {
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

export async function getStatus(serverName: string, serverIP: string, config: indexConfig): Promise<{ result: string, icon: string }> {
  const timer = perfTimer(`查询服务器 ${serverName} (${serverIP}) 耗时`);
  try {
    const status = await queryServerStatus(serverIP);

    // 仅在 debug 模式下输出精简数据
    if (config.debug) {
      try {
        // 限制输出内容，避免大对象日志
        const { favicon, modinfo, forgeData, ...debugData } = status;
        const jsonStr = JSON.stringify(debugData);
        logger.info(`[数据(${serverName})] ${jsonStr.length > 500 ? jsonStr.slice(0, 500) + '... (已截断)' : jsonStr}`);
      } catch (e) {
        logger.info('[调试] 序列化调试数据失败:', e);
      }
    }
    // 处理并生成 HTML 内容
    let result = '';
    result += `<p>${serverName}` + (config.showIP ? ` ${serverIP} ` : '') + `</p>`;
    result += config.showMotd ? `<p>${formatMotdHtml(status.description)}</p>` : '';
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

    timer.end();
    return { result, icon: status.favicon || '' };
  } catch (error) {
    timer.end();
    // 精简错误日志，避免输出整个错误对象
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[查询失败] ${serverName} (${serverIP}): ${errorMsg}`);
    let result = '';
    result += `<p>${serverName}` + (config.showIP ? ` ${serverIP} ` : '') + `</p>`;
    result += '<p>查询失败</p>';
    return { icon: '', result };
  }
}

export async function mcs(ctx: Context, config: indexConfig) {
  ctx.command('mcs [server]', '查询 Minecraft 服务器状态', { authority: config.authority })
    .action(async ({ }, serverIP) => {
      const cmdTimer = perfTimer('mcs 命令总耗时');
      try {
        // 单服查询转为单元素数组，复用批量查询逻辑
        const servers = serverIP
          ? [{ name: 'Minecraft Server', ip: serverIP }]
          : config.servers;

        logger.debug(`[开始] 查询 ${servers.length} 个服务器`);

        const batchTimer = perfTimer('批量服务器查询');
        const results = await Promise.all(
          servers.map(async (server, index) => {
            const { result, icon } = await getStatus(server.name, server.ip, config);
            return { index, html: await bodyHtml(icon, result, config) };
          })
        );
        batchTimer.end();

        const renderTimer = perfTimer('HTML 生成与渲染');
        const html = await generateHtml(
          results.sort((a, b) => a.index - b.index).map(r => r.html).join(''),
          config.footer.replace(/\n/g, '</br>'),
          config
        );
        const image = await ctx.puppeteer.render(html);
        renderTimer.end();

        cmdTimer.end();
        return image;
      } catch (e) {
        cmdTimer.end();
        const errorMsg = e instanceof Error ? e.message : String(e);
        logger.error(`[命令失败] ${errorMsg}`);
        return '出现错误';
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
