import React, { memo } from "react";
import * as styles from "./styles.module.scss"
import icon from '@public/logo-w.png'
import WeChatQRCode from '@public/WeChat.png'
import { Github, Mail, Wechat } from "@icon-park/react";
import { Tooltip } from "antd";

const FooterView = () => {

  return (
    <div className={styles.footer}>
      <div className={styles.content}>
        <div className={styles.infoContainer}>
          <div className={styles.contactMe}>
            <span>联系我：</span>
            <a href="mailto:liuchengxu1994@gmail.com" target="_blank">
              <Mail className="icon" theme="outline" size="18" fill="#FFFFFF" />
            </a>
            <a href="https://github.com/ComfortableLiu/code-pulse-vue" target="_blank">
              <Github className="icon" theme="outline" size="18" fill="#FFFFFF" />
            </a>
            <a href="weixin://dl/chat">
              <Tooltip
                color="#FFFFFF"
                title={
                  <img
                    alt="微信号：xiaoyaochengjushi"
                    src={WeChatQRCode}
                    height="272"
                    width="200"
                  />
                }
              >
                <Wechat className="icon" theme="outline" size="18" fill="#FFFFFF" />
              </Tooltip>
            </a>
          </div>
          <div>
            声明：本网站部分工具是站长整合网上已有工具、开源包等，并全部遵循原有协议发布，著作权归属原作者或是团队。如有问题请联系站长。
          </div>
        </div>
        <div className={styles.logoImage}>
          <img
            alt="icon"
            src={icon}
            height="80"
            width="80"
          />
          <div className={styles.title}>Code Pulse</div>
        </div>
      </div>
    </div>
  )
}

export default memo(FooterView)
