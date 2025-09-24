import type { ResponseType } from 'axios';
import type { CancelToken } from 'axios';

export interface IOption {
  responseType?: ResponseType; // 返回类型
  baseURL?: string; // 基础请求url
  target?: string; // 目标系统
  loading?: boolean; // 是否需要loading
  loadingText?: string; // loading展示文案
  successCode?: number | string; // 成功code，用于抹平不同系统的响应
  url: string; // 接口url
  method: 'get' | 'post' | 'delete' | 'put'; // 目前就封装了这四种，多了再改
  noCatch?: boolean; // 是否捕获错误不往上抛
  cancelToken?: CancelToken;
  headers?: {
    [key: string]: any;
  };
  // 其实我会赋值到data，用于抹平同学们之前的代码习惯(erp上get和post参数都是data)
  params?: {
    [key: string]: any;
  };
  // 同上
  data?: {
    [key: string]: any;
  };
  // 是否忽略错误
  missError?: boolean
}

export interface IResult<T> {
  code: string | number;
  msg: string;
  data: T;
}
