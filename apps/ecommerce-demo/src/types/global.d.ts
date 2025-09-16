// 全局类型声明文件，解决React类型冲突问题

declare module 'react' {
  namespace React {
    type ReactNode = 
      | ReactElement
      | string
      | number
      | ReactFragment
      | ReactPortal
      | boolean
      | null
      | undefined;
  }
}

// 扩展全局类型
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.Component<any> {}
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicAttributes extends React.Attributes {}
    interface IntrinsicClassAttributes<T> extends React.ClassAttributes<T> {}
  }
}

export {};
