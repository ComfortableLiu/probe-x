declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.webp';
declare module '*.svg' {
  const content: string;
  export default content;
}
declare module '*.svg?component' {
  import { FC, SVGProps } from 'react';
  const Component: FC<SVGProps<SVGSVGElement>>;
  export default Component;
}

declare module '*.module.scss' {
  const classes: {
    [key: string]: string
  };

  export = classes;
}
