// 普通SHA加密
export const sha = async (originalStr: string, name: '1' | '256' | '512') => {
  // 使用Web Crypto API实现SHA1加密
  const hash = await crypto.subtle
    .digest(`SHA-${name}`, new TextEncoder().encode(originalStr))
  const hashArray = Array.from(new Uint8Array(hash))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const hmacSha256 = async (message: string, secretKey: string) => {
  const encoder = new TextEncoder();

  // 导入密钥
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // 签名
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );

  // 转换为十六进制字符串
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// HMAC-SHA加密
export const hmacSHA = async (originalText: string, name: '1' | '256' | '512', key: string) => {
  const encoder = new TextEncoder();
  // 导入密钥
  const keyStr = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: `SHA-${name}` },
    false,
    ['sign']
  );

  // 签名
  const signature = await crypto.subtle.sign(
    'HMAC',
    keyStr,
    encoder.encode(originalText)
  );

  // 转换为十六进制字符串
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
