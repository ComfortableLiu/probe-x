/**
 * 签名验证工具函数
 */
import { IAnyObj } from "@utils/type";
import { hmacSHA } from "@utils/encryption";

interface ISignatureData {
  method: string
  path: string
  query?: IAnyObj
  body?: IAnyObj
}

/**
 * 生成签名
 * @param signatureData 加密所需数据
 * @param timestamp 时间戳
 * @param nonce 随机字符串
 * @param secretKey 密钥
 */
export async function generateSignature(
  signatureData: ISignatureData,
  timestamp: number,
  nonce: string,
  secretKey: string
) {

  const params = {
    timestamp,
    nonce,
    method: signatureData.method.toUpperCase(),
    path: signatureData.path || '',
    query: signatureData.query || {},
    body: signatureData.body || {}
  };

  // 过滤并排序参数
  const sortedParams: IAnyObj = {};
  Object.keys(params)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .filter(key => key !== 'signature') // 排除签名本身
    .forEach((key: string) => sortedParams[key] = params[key as keyof typeof params]);

  // 构造待签名字符串
  const signStr = Object.entries(sortedParams)
    .map(([key, value]) => {
      // 处理嵌套对象
      if (typeof value === 'object' && value !== null) {
        return `${key}=${JSON.stringify(value)}`;
      }
      return `${key}=${value}`;
    })
    .join('&');

  // 使用 HMAC-SHA256 生成签名
  return await hmacSHA(signStr, '256', secretKey)
}

/**
 * 验证签名
 * @param data 需要验证的数据
 * @param timestamp 时间戳
 * @param nonce 随机字符串
 * @param signature 待验证的签名
 * @param secretKey 密钥
 */
export async function verifySignature(
  data: ISignatureData,
  timestamp: number,
  nonce: string,
  signature: string,
  secretKey: string
) {
  const expectedSignature = await generateSignature(data, timestamp, nonce, secretKey);
  return expectedSignature === signature;
}

/**
 * 生成随机字符串
 */
export function generateNonce(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
