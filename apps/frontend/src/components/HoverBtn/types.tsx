import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { Button } from 'antd'
import { ButtonProps } from 'antd/lib/button'

export interface ITooltipProps {
  children: ReactNode;
  clipboard?: string | number;
  open?: string | boolean | {
    pathname: string;
    target?: string;
  };
  extra?: Array<ReactElement<typeof Button> | undefined | boolean>;
  className?: string;
  style?: CSSProperties;
  goPage?: ITypeGoPage | Array<ITypeGoPage>
}


type ITypeGoPage = {
  pathname: string;
  query: { [k: string]: number | string },
  label: string;
  buttonProps?: ButtonProps
}
