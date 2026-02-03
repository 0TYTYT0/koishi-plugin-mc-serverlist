import net from 'node:net';
import { resolveSrv } from 'node:dns/promises';

const DEFAULT_PORT = 25565;
const DEFAULT_PROTOCOL_VERSION = 754;
const SOCKET_TIMEOUT_MS = 5000;

export type McStatusResponse = {
  version?: { name?: string; protocol?: number };
  players?: { online?: number; max?: number; sample?: { name: string; id?: string }[] };
  description?: string | { text?: string; extra?: any[]; color?: string; bold?: boolean; italic?: boolean; underlined?: boolean; strikethrough?: boolean; obfuscated?: boolean };
  favicon?: string;
};

const colorTable: Record<string, string> = {
  black: '#000000',
  dark_blue: '#0000AA',
  dark_green: '#00AA00',
  dark_aqua: '#00AAAA',
  dark_red: '#AA0000',
  dark_purple: '#AA00AA',
  gold: '#FFAA00',
  gray: '#AAAAAA',
  dark_gray: '#555555',
  blue: '#5555FF',
  green: '#55FF55',
  aqua: '#55FFFF',
  red: '#FF5555',
  light_purple: '#FF55FF',
  yellow: '#FFFF55',
  white: '#FFFFFF',
  reset: '',
};

const legacyColorTable: Record<string, string> = {
  '0': '#000000',
  '1': '#0000AA',
  '2': '#00AA00',
  '3': '#00AAAA',
  '4': '#AA0000',
  '5': '#AA00AA',
  '6': '#FFAA00',
  '7': '#AAAAAA',
  '8': '#555555',
  '9': '#5555FF',
  'a': '#55FF55',
  'b': '#55FFFF',
  'c': '#FF5555',
  'd': '#FF55FF',
  'e': '#FFFF55',
  'f': '#FFFFFF',
};

export function formatMotdHtml(description?: McStatusResponse['description']) {
  if (!description) return '';
  if (typeof description === 'string') {
    return renderLegacyToHtml(description);
  }
  const html = renderComponent(description);
  return html.replace(/\n/g, '<br>');
}

function renderLegacyToHtml(text: string) {
  const parts: string[] = [];
  let style: ChatStyle = {};
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    parts.push(wrapStyledText(buffer, style));
    buffer = '';
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '§' && i + 1 < text.length) {
      const code = text[i + 1].toLowerCase();
      i += 1;
      if (code === 'r') {
        flush();
        style = {};
        continue;
      }
      if (legacyColorTable[code]) {
        flush();
        style = { ...style, color: legacyColorTable[code] };
        continue;
      }
      if (code === 'l') {
        flush();
        style = { ...style, bold: true };
        continue;
      }
      if (code === 'o') {
        flush();
        style = { ...style, italic: true };
        continue;
      }
      if (code === 'n') {
        flush();
        style = { ...style, underlined: true };
        continue;
      }
      if (code === 'm') {
        flush();
        style = { ...style, strikethrough: true };
        continue;
      }
      if (code === 'k') {
        flush();
        style = { ...style, obfuscated: true };
        continue;
      }
      buffer += char + code;
      continue;
    }
    buffer += char;
  }

  flush();
  return parts.join('');
}

type ChatStyle = {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
};

function renderComponent(component: any, inherited: ChatStyle = {}) {
  if (component === null || component === undefined) return '';
  if (typeof component === 'string') {
    return wrapStyledText(component, inherited);
  }

  const style: ChatStyle = {
    color: component.color ? colorTable[component.color] || component.color : inherited.color,
    bold: component.bold ?? inherited.bold,
    italic: component.italic ?? inherited.italic,
    underlined: component.underlined ?? inherited.underlined,
    strikethrough: component.strikethrough ?? inherited.strikethrough,
    obfuscated: component.obfuscated ?? inherited.obfuscated,
  };

  let html = '';
  // 兼容 text/translate 字段作为基础文本
  const baseText = typeof component.text === 'string'
    ? component.text
    : typeof component.translate === 'string'
      ? component.translate
      : '';
  if (baseText) {
    // 若包含 § 颜色码则解析为带样式的 HTML
    html += baseText.includes('§')
      ? renderLegacyToHtml(baseText)
      : wrapStyledText(baseText, style);
  }
  // 兼容 translate 的 with 参数拼接
  if (Array.isArray(component.with)) {
    for (const part of component.with) {
      html += renderComponent(part, style);
    }
  }
  if (Array.isArray(component.extra)) {
    for (const child of component.extra) {
      html += renderComponent(child, style);
    }
  }
  return html;
}

function wrapStyledText(text: string, style: ChatStyle) {
  const safeText = escapeHtml(text);
  const styles: string[] = [];
  if (style.color) styles.push(`color: ${style.color}`);
  if (style.bold) styles.push('font-weight: 700');
  if (style.italic) styles.push('font-style: italic');
  const decorations: string[] = [];
  if (style.underlined) decorations.push('underline');
  if (style.strikethrough) decorations.push('line-through');
  if (decorations.length) styles.push(`text-decoration: ${decorations.join(' ')}`);
  if (style.obfuscated) styles.push('filter: blur(1px)');
  if (!styles.length) return safeText;
  return `<span style="${styles.join('; ')}">${safeText}</span>`;
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

function encodeVarInt(value: number) {
  const bytes: number[] = [];
  let val = value >>> 0;
  while (true) {
    if ((val & 0xffffff80) === 0) {
      bytes.push(val);
      break;
    }
    bytes.push((val & 0x7f) | 0x80);
    val >>>= 7;
  }
  return Buffer.from(bytes);
}

function encodeString(value: string) {
  const data = Buffer.from(value, 'utf8');
  return Buffer.concat([encodeVarInt(data.length), data]);
}

function encodeUShort(value: number) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16BE(value, 0);
  return buf;
}

function buildPacket(packetId: number, payload?: Buffer) {
  const id = encodeVarInt(packetId);
  const body = payload ? Buffer.concat([id, payload]) : id;
  return Buffer.concat([encodeVarInt(body.length), body]);
}

class SocketReader {
  private buffer = Buffer.alloc(0);
  private pending: { size: number; resolve: (buf: Buffer) => void; reject: (err: Error) => void }[] = [];

  push(data: Buffer) {
    this.buffer = Buffer.concat([this.buffer, data]);
    this.flush();
  }

  close(err: Error) {
    while (this.pending.length) {
      const item = this.pending.shift();
      if (item) item.reject(err);
    }
  }

  async readBytes(size: number): Promise<Buffer> {
    if (this.buffer.length >= size) {
      const chunk = this.buffer.subarray(0, size);
      this.buffer = this.buffer.subarray(size);
      return chunk;
    }
    return new Promise((resolve, reject) => {
      this.pending.push({ size, resolve, reject });
    });
  }

  private flush() {
    while (this.pending.length && this.buffer.length >= this.pending[0].size) {
      const item = this.pending.shift()!;
      const chunk = this.buffer.subarray(0, item.size);
      this.buffer = this.buffer.subarray(item.size);
      item.resolve(chunk);
    }
  }

  async readVarInt(): Promise<number> {
    let numRead = 0;
    let result = 0;
    while (true) {
      if (numRead > 4) {
        throw new Error('VarInt 过长');
      }
      const byte = (await this.readBytes(1))[0];
      result |= (byte & 0x7f) << (7 * numRead);
      numRead += 1;
      if ((byte & 0x80) === 0) {
        return result;
      }
    }
  }

  async readString(): Promise<string> {
    const length = await this.readVarInt();
    const data = await this.readBytes(length);
    return data.toString('utf8');
  }
}

async function parseServerAddress(address: string) {
  const trimmed = address.trim();
  if (trimmed.startsWith('[')) {
    const endIndex = trimmed.indexOf(']');
    if (endIndex !== -1) {
      const host = trimmed.slice(1, endIndex);
      const portPart = trimmed.slice(endIndex + 1);
      const port = portPart.startsWith(':') ? Number(portPart.slice(1)) : undefined;
      return { host, port: port || DEFAULT_PORT };
    }
  }

  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon > 0 && trimmed.indexOf(':') === lastColon) {
    const host = trimmed.slice(0, lastColon);
    const port = Number(trimmed.slice(lastColon + 1));
    if (!Number.isNaN(port)) {
      return { host, port };
    }
  }

  const host = trimmed;
  const port = await resolveSrvPort(host);
  return { host: port.host, port: port.port };
}

async function resolveSrvPort(host: string) {
  try {
    const records = await resolveSrv(`_minecraft._tcp.${host}`);
    if (records.length > 0) {
      const record = records[0];
      return { host: record.name, port: record.port };
    }
  } catch {
    // ignore SRV lookup errors
  }
  return { host, port: DEFAULT_PORT };
}

export async function queryServerStatus(address: string): Promise<McStatusResponse> {
  const { host, port } = await parseServerAddress(address);
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const reader = new SocketReader();
    let settled = false;

    const cleanup = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      if (err) {
        reader.close(err);
        reject(err);
      }
    };

    socket.setTimeout(SOCKET_TIMEOUT_MS, () => {
      cleanup(new Error('连接超时'));
    });

    socket.on('error', (err) => cleanup(err));
    socket.on('data', (data) => reader.push(data));

    socket.on('connect', async () => {
      try {
        const handshakePayload = Buffer.concat([
          encodeVarInt(DEFAULT_PROTOCOL_VERSION),
          encodeString(host),
          encodeUShort(port),
          encodeVarInt(1),
        ]);
        socket.write(buildPacket(0x00, handshakePayload));
        socket.write(buildPacket(0x00));

        const length = await reader.readVarInt();
        const packet = await reader.readBytes(length);
        const packetReader = new SocketReader();
        packetReader.push(packet);
        const packetId = await packetReader.readVarInt();
        if (packetId !== 0x00) {
          throw new Error(`响应包 ID 异常: ${packetId}`);
        }
        const json = await packetReader.readString();
        const parsed = JSON.parse(json) as McStatusResponse;
        if (!settled) {
          settled = true;
          socket.end();
          resolve(parsed);
        }
      } catch (err: any) {
        cleanup(err instanceof Error ? err : new Error('读取响应失败'));
      }
    });
  });
}
