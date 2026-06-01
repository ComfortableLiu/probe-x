import type { ThemeConfig } from 'antd'

/**
 * Probe-X Design System — Ant Design Theme Configuration
 *
 * 所有颜色、字号、间距等设计 Token 均在此定义，
 * 禁止在业务组件中硬编码与 Token 不一致的值。
 */
const theme: ThemeConfig = {
  token: {
    // ─── Brand ───────────────────────────────
    colorPrimary: '#3F51B5',
    colorInfo: '#3F51B5',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',

    // ─── Typography ──────────────────────────
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 20,
    fontSizeHeading1: 28,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,

    // ─── Spacing (base unit: 4px) ────────────
    padding: 16,
    paddingSM: 12,
    paddingLG: 24,
    paddingXL: 32,
    paddingXS: 8,
    paddingXXS: 4,

    margin: 16,
    marginSM: 12,
    marginLG: 24,
    marginXL: 32,
    marginXS: 8,
    marginXXS: 4,

    // ─── Border Radius ───────────────────────
    borderRadius: 6,
    borderRadiusSM: 4,
    borderRadiusLG: 8,

    // ─── Shadows ─────────────────────────────
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)',
    boxShadowSecondary: '0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)',

    // ─── Line Height ─────────────────────────
    lineHeight: 1.5714,
    lineHeightLG: 1.5,
    lineHeightSM: 1.6667,

    // ─── Motion ──────────────────────────────
    motionDurationFast: '0.1s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s',

    // ─── Misc ────────────────────────────────
    wireframe: false,
  },

  // ─── Component Overrides ─────────────────────
  components: {
    Layout: {
      siderBg: '#001529',
      headerBg: '#ffffff',
      bodyBg: '#f0f2f5',
    },
    Menu: {
      darkItemBg: '#001529',
      darkSubMenuItemBg: '#000c17',
      darkItemSelectedBg: '#1890ff20',
    },
    Table: {
      headerBg: '#fafafa',
      headerColor: 'rgba(0,0,0,0.88)',
      headerSplitColor: '#f0f0f0',
      rowHoverBg: '#fafafa',
      borderColor: '#f0f0f0',
    },
    Card: {
      paddingLG: 24,
    },
    Button: {
      fontWeight: 500,
    },
    Input: {
      hoverBorderColor: '#3F51B5',
      activeBorderColor: '#3F51B5',
    },
    Select: {
      optionSelectedBg: '#3F51B510',
    },
  },
}

export default theme
